/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Mp4Muxer from "mp4-muxer";
import { Typhoon, TyphoonState, TyphoonCategory, SimulationConfig } from "../types";
import { EAST_ASIA_LAND, getCategoryColor, getWindForceCategory, WEATHER_STATIONS_DATA, getEnvironmentalWind, getSST, getFluidDynamicsWindField, checkPointOnLandGeoJson, getProceduralElevation } from "../simulation/Engine";
import { landGeoJson } from "../simulation/NaturalEarthLoader";

function getWindColor(speed: number, alphaMultiplier: number = 1.0): string {
  if (speed < 10) return `rgba(30, 156, 255, ${0.32 * alphaMultiplier})`;
  if (speed < 17) return `rgba(69, 212, 131, ${0.55 * alphaMultiplier})`;
  if (speed < 24) return `rgba(246, 211, 74, ${0.75 * alphaMultiplier})`;
  if (speed < 32) return `rgba(255, 140, 58, ${0.88 * alphaMultiplier})`;
  return `rgba(255, 77, 79, ${0.95 * alphaMultiplier})`;
}

function getStationGradientColor(wind: number): string {
  const anchors = [
    [0, 16, 185, 129],
    [10, 34, 197, 94],
    [17, 234, 179, 8],
    [24, 249, 115, 22],
    [32, 239, 68, 68],
    [41, 220, 38, 38],
    [51, 168, 85, 247]
  ];
  if (wind <= 0) return `rgb(${anchors[0][1]}, ${anchors[0][2]}, ${anchors[0][3]})`;
  if (wind >= anchors[anchors.length - 1][0]) {
    const last = anchors[anchors.length - 1];
    return `rgb(${last[1]}, ${last[2]}, ${last[3]})`;
  }
  for (let i = 0; i < anchors.length - 1; i++) {
    const a1 = anchors[i];
    const a2 = anchors[i + 1];
    if (wind >= a1[0] && wind <= a2[0]) {
      const ratio = (wind - a1[0]) / (a2[0] - a1[0]);
      const r = Math.round(a1[1] + (a2[1] - a1[1]) * ratio);
      const g = Math.round(a1[2] + (a2[2] - a1[2]) * ratio);
      const b = Math.round(a1[3] + (a2[3] - a1[3]) * ratio);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  return "rgb(16, 185, 129)";
}

export interface VideoExportConfig {
  mode?: "trajectory" | "windfield" | "wind_forecast" | "rain_forecast"; // trajectory (台风轨迹动态) or windfield (卫星风场图HSCAT) or wind_forecast (台风大风预报) or rain_forecast (台风降水预报)
  forecastHours?: number; // 预报时效 (默认 24小时)
  durationSec?: number; // 动画时长 (2-30秒)
  dateTimePosition?: "inside" | "top-left" | "top-right" | "bottom-left" | "bottom-right"; // 日期显示位置
  // HSCAT Scatterometer Video parameters
  scatZoomSpan?: number; // 6.0 to 30.0
  scatBarbSpacing?: number; // 0.05 to 0.40
  scatBarbLength?: number; // 5.0 to 20.0
  scatBarbWidth?: number; // 0.5 to 3.0
  scatOrbitAngle?: number; // 0 to 45
  scatSwathWidth?: number; // 5 to 25
  scatNadirWidth?: number; // 0 to 5
  scatBackgroundScale?: number; // 0.0 to 2.0
  scatterometerLandData?: boolean; // 陆地风场显示
  // Trajectory parameters
  baseMap: "dark" | "satellite" | "terrain" | "light" | "googleSatellite" | "googleStreet" | "blueMarble" | "bingSatellite" | "none";
  showCoastline: boolean; // 海岸线图层开关
  rasterResolution: "low" | "medium" | "high" | "ultra";
  showGrid: boolean; // 经纬度线
  showForecast: boolean; // 预报路线图层
  showUncertaintyCone: boolean; // 预报不确定性概率锥
  showWindRadii: boolean; // 风圈渲染
  showStations?: boolean; // 气象站点图层
  stationSizeScale?: number; // 气象站点显示大小
  fps?: number; // 1 to 60 fps
  endAction?: "none" | "pause" | "report"; // 结束后动作 (片尾报告)
  dotInterval: number; // 0 (none), 1, 3, 6, 12 hours
  showDataLabel: boolean; // 数据标注开关
  labelContent: "all" | "pressure" | "windSpeed"; // 标注内容
  showStatus: boolean; // 台风状态显示
  labelSize: "small" | "medium" | "large" | "extraLarge"; // 标注字号大小
  labelPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right"; // 标注位置
  centerFollow: boolean; // 中心跟随
  showDateTime: boolean; // 是否显示时间总开关
  dateTimeFormat: "relative" | "calendar"; // 时间格式：相对小时 or 真实日期
  showCasualties: boolean; // 是否显示伤亡人数信息
  zoomLevel: number; // 缩放等级
  aspectRatio: "16:9" | "4:3" | "3:4" | "1:1" | "9:16"; // 画面比例
  videoResolution: "720p" | "1080p" | "2K" | "4K"; // 画质分辨率
  videoCodec?: "H.264" | "H.265"; // 视频编码格式
  bitrate?: number; // 视频码率 (bps)
  startDate?: Date; // 模拟起算时间
  animSpeed?: number; // legacy fallback
}

export function getSimulationStartDate(config?: VideoExportConfig): Date {
  if (config?.startDate) return new Date(config.startDate);
  const savedStart = localStorage.getItem("typhoon_sim_start_date");
  return savedStart ? new Date(savedStart) : new Date("2026-07-21T00:00:00");
}

/**
 * 根据台风物理参数生成台风状态文字描述
 */
export function getTyphoonStatusText(state: TyphoonState): string {
  if (state.dissipated) return "已消散";
  if (state.extrTransition && state.extrTransition >= 0.5) return "温带变性中";
  if (state.isStructureDamaged || ((state.maxLandElevationPassed || 0) > 2000 && (state.structuralDamageHours || 0) <= 48 && !state.landed)) {
    return "台风结构损坏";
  }
  if (state.landed) return "已登陆 (陆地衰减)";
  if (state.ewrcState === "forming" || state.ewrcState === "max_decay") return "眼墙置换中 (EWRC)";
  if (state.ewrcState === "recovering_success") return "置换成功 (新眼重建)";
  if (state.ewrcState === "recovering_failure") return "置换失败 (结构塌陷)";
  if (state.rapidIntensifying) return "爆发增强中 (RI)";
  
  if ((state.upwellingHours || 0) >= 6) {
    return "冷水上翻 (自涌衰减)";
  }

  if (state.isCoreDisrupted) return "核心结构破坏";
  if (state.category === TyphoonCategory.SuperTY) return "超强台风维持";
  if (state.vmax >= 45) return "强台风发展";
  if (state.vmax >= 33) return "稳步增强中";
  return "热带气旋发展中";
}

export interface RenderProgress {
  percentage: number;
  currentFrame: number;
  totalFrames: number;
  statusText: string;
}

// Convert zoom index (1..5) to Mercator zoom
export function getMercatorZoom(zoomIndex: number, canvasWidth: number = 1920): number {
  let baseZoom = 5.5;
  switch (zoomIndex) {
    case 1: baseZoom = 3.5; break;
    case 2: baseZoom = 4.5; break;
    case 3: baseZoom = 5.5; break;
    case 4: baseZoom = 6.5; break;
    case 5: baseZoom = 7.5; break;
    default: baseZoom = 5.5; break;
  }
  // Scale zoom so that map geographical framing is identical across 720p, 1080p, and 4K resolutions
  return baseZoom + Math.log2(canvasWidth / 1920);
}

// Convert video settings to canvas dimensions W x H
export function getCanvasDimensions(aspectRatio: string, resolution: string): { width: number; height: number } {
  let baseWidth = 1920;
  if (resolution === "720p") baseWidth = 1280;
  else if (resolution === "2K") baseWidth = 2560;
  else if (resolution === "4K") baseWidth = 3840;

  let width = baseWidth;
  let height = Math.round(baseWidth * (9 / 16));

  if (aspectRatio === "16:9") {
    height = Math.round(width * (9 / 16));
  } else if (aspectRatio === "4:3") {
    height = Math.round(width * (3 / 4));
  } else if (aspectRatio === "3:4") {
    height = Math.round(width * (4 / 3));
  } else if (aspectRatio === "1:1") {
    height = width;
  } else if (aspectRatio === "9:16") {
    height = Math.round(width * (16 / 9));
  }

  // Strictly align to multiples of 16 for hardware encoder compatibility across all devices
  width = Math.round(width / 16) * 16;
  height = Math.round(height / 16) * 16;

  // AVC Level 5.2 maximum coded area is 9,437,184 pixels (e.g. 4096x2304)
  // If resolution * aspect ratio exceeds 9,437,184 pixels,
  // clamp width & height proportionally to fit within 9,437,184 pixels safely.
  const MAX_CODED_AREA = 9437184;
  if (width * height > MAX_CODED_AREA) {
    const scale = Math.sqrt(MAX_CODED_AREA / (width * height));
    width = Math.floor((width * scale) / 16) * 16;
    height = Math.floor((height * scale) / 16) * 16;
  }

  return { width, height };
}

// Web Mercator coordinate transformations
export function latLonToMercatorPixel(
  lat: number,
  lon: number,
  centerLat: number,
  centerLon: number,
  zoom: number,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  const worldSize = 256 * Math.pow(2, zoom);

  // Mercator X
  const x = ((lon + 180) / 360) * worldSize;
  const cx = ((centerLon + 180) / 360) * worldSize;

  // Mercator Y
  const latRad = (lat * Math.PI) / 180;
  const centerLatRad = (centerLat * Math.PI) / 180;

  const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) * (worldSize / 2);
  const cy = (1 - Math.log(Math.tan(centerLatRad) + 1 / Math.cos(centerLatRad)) / Math.PI) * (worldSize / 2);

  const screenX = canvasWidth / 2 + (x - cx);
  const screenY = canvasHeight / 2 + (y - cy);

  return { x: screenX, y: screenY };
}

// Pre-loader for map tiles
class TileCache {
  private cache: Map<string, HTMLImageElement> = new Map();
  private pending: Map<string, Promise<HTMLImageElement>> = new Map();

    getTileUrl(baseMap: string, z: number, x: number, y: number): string {
    const maxTile = Math.pow(2, z);
    const tileZ = z;
    const tileX = ((x % maxTile) + maxTile) % maxTile;
    const tileY = Math.max(0, Math.min(maxTile - 1, y));

    switch (baseMap) {
      case "dark":
        return `https://a.basemaps.cartocdn.com/dark_all/${tileZ}/${tileX}/${tileY}.png`;
      case "light":
        return `https://a.basemaps.cartocdn.com/light_all/${tileZ}/${tileX}/${tileY}.png`;
      case "satellite":
        return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${tileZ}/${tileY}/${tileX}`;
      case "terrain":
        return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/${tileZ}/${tileY}/${tileX}`;
      case "googleSatellite":
        return `https://mt1.google.com/vt/lyrs=s&x=${tileX}&y=${tileY}&z=${tileZ}`;
      case "googleStreet":
        return `https://mt1.google.com/vt/lyrs=m&x=${tileX}&y=${tileY}&z=${tileZ}`;
      case "blueMarble": {
        const effZ = Math.min(tileZ, 8);
        const scaleFactor = Math.pow(2, tileZ - effZ);
        const effX = Math.floor(tileX / scaleFactor);
        const effY = Math.floor(tileY / scaleFactor);
        const maxT = Math.pow(2, effZ);
        const normX = ((effX % maxT) + maxT) % maxT;
        const normY = Math.max(0, Math.min(maxT - 1, effY));
        return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/${effZ}/${normY}/${normX}.jpeg`;
      }
      case "bingSatellite":
        let quadkey = '';
        for (let i = tileZ; i > 0; i--) {
          let digit = 0;
          let mask = 1 << (i - 1);
          if ((tileX & mask) !== 0) digit += 1;
          if ((tileY & mask) !== 0) digit += 2;
          quadkey += digit;
        }
        return `https://ecn.t0.tiles.virtualearth.net/tiles/a${quadkey}.jpeg?g=129&mkt=en-US`;
      default:
        return "";
    }
  }

  async loadTile(url: string, fallbackUrl?: string): Promise<HTMLImageElement | null> {
    if (!url) return Promise.resolve(null);
    if (this.cache.has(url)) return this.cache.get(url)!;
    if (this.pending.has(url)) return this.pending.get(url)!;

    const promise = new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        this.cache.set(url, img);
        this.pending.delete(url);
        resolve(img);
      };
      img.onerror = () => {
        // Retry with secondary fallback if available (e.g. ESRI World Imagery for Blue Marble failures)
        if (fallbackUrl && fallbackUrl !== url) {
          const fallbackImg = new Image();
          fallbackImg.crossOrigin = "anonymous";
          fallbackImg.onload = () => {
            this.cache.set(url, fallbackImg);
            this.pending.delete(url);
            resolve(fallbackImg);
          };
          fallbackImg.onerror = () => {
            this.pending.delete(url);
            resolve(null);
          };
          fallbackImg.src = fallbackUrl;
        } else if (url.includes("gibs.earthdata.nasa.gov")) {
          // Automatic fallback for NASA GIBS tile failures
          const fbImg = new Image();
          fbImg.crossOrigin = "anonymous";
          fbImg.onload = () => {
            this.cache.set(url, fbImg);
            this.pending.delete(url);
            resolve(fbImg);
          };
          fbImg.onerror = () => {
            this.pending.delete(url);
            resolve(null);
          };
          fbImg.src = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/4/6/12";
        } else {
          this.pending.delete(url);
          resolve(null);
        }
      };
      img.src = url;
    });

    this.pending.set(url, promise as any);
    return promise;
  }

  getTileIfLoaded(url: string): HTMLImageElement | null {
    return this.cache.get(url) || null;
  }
}

export const globalTileCache = new TileCache();

// Helper to interpolate typhoon state between two history steps
// Catmull-Rom spline formula for smooth C1 continuous movement
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

// Helper to interpolate typhoon state smoothly between history steps using spline curves
export function interpolateTyphoonSmooth(
  history: TyphoonState[],
  currentSimHour: number
): TyphoonState {
  if (!history || history.length === 0) return {} as TyphoonState;
  if (history.length === 1 || currentSimHour <= history[0].simHour) return history[0];
  if (currentSimHour >= history[history.length - 1].simHour) return history[history.length - 1];

  let i = 0;
  for (; i < history.length - 1; i++) {
    if (currentSimHour >= history[i].simHour && currentSimHour <= history[i + 1].simHour) {
      break;
    }
  }

  const s1 = history[i];
  const s2 = history[i + 1];
  const span = s2.simHour - s1.simHour;
  const t = span > 0 ? (currentSimHour - s1.simHour) / span : 0;

  const s0 = history[Math.max(0, i - 1)];
  const s3 = history[Math.min(history.length - 1, i + 2)];

  const smoothLat = catmullRom(s0.lat, s1.lat, s2.lat, s3.lat, t);
  const smoothLon = catmullRom(s0.lon, s1.lon, s2.lon, s3.lon, t);

  const isLandTransition = s1.landed !== s2.landed;
  const currentLanded = t < 0.5 ? s1.landed : s2.landed;

  const lerp = (a: number, b: number) => a + (b - a) * t;
  const last3Hour = Math.floor(currentSimHour / 3) * 3;
  const prev3Hour = Math.max(0, last3Hour - 3);
  const sLast3 = history.find(h => h.simHour === last3Hour) || s1;
  const sPrev3 = history.find(h => h.simHour === prev3Hour) || s1;
  
  const timeSinceLast3 = currentSimHour - last3Hour;
  // Make the animation snappy and sharp, completed within 0.1 hours of the 3h mark
  let radiiT = timeSinceLast3 < 0.1 ? timeSinceLast3 / 0.1 : 1.0;
  // Use a sharp cubic easing out for a crisp, snappy feel
  radiiT = 1 - Math.pow(1 - radiiT, 3);
  
  const lerpRadiusFast = (a: number, b: number) => {
    if (a > 0 && b === 0) return radiiT < 0.5 ? a : 0;
    if (a === 0 && b > 0) return radiiT > 0.5 ? b : 0;
    return a + (b - a) * radiiT;
  };

  return {
    ...s1,
    lat: smoothLat,
    lon: smoothLon,
    vmax: lerp(s1.vmax, s2.vmax),
    pmin: lerp(s1.pmin, s2.pmin),
    rmw: lerp(s1.rmw, s2.rmw),
    r7: {
      ne: lerpRadiusFast(sPrev3.r7.ne, sLast3.r7.ne),
      se: lerpRadiusFast(sPrev3.r7.se, sLast3.r7.se),
      sw: lerpRadiusFast(sPrev3.r7.sw, sLast3.r7.sw),
      nw: lerpRadiusFast(sPrev3.r7.nw, sLast3.r7.nw)
    },
    r10: {
      ne: lerpRadiusFast(sPrev3.r10.ne, sLast3.r10.ne),
      se: lerpRadiusFast(sPrev3.r10.se, sLast3.r10.se),
      sw: lerpRadiusFast(sPrev3.r10.sw, sLast3.r10.sw),
      nw: lerpRadiusFast(sPrev3.r10.nw, sLast3.r10.nw)
    },
    r12: {
      ne: lerpRadiusFast(sPrev3.r12.ne, sLast3.r12.ne),
      se: lerpRadiusFast(sPrev3.r12.se, sLast3.r12.se),
      sw: lerpRadiusFast(sPrev3.r12.sw, sLast3.r12.sw),
      nw: lerpRadiusFast(sPrev3.r12.nw, sLast3.r12.nw)
    },
    casualties: lerp(s1.casualties || 0, s2.casualties || 0),
    simHour: currentSimHour,
    stationReadings: s1.stationReadings
  };
}

export function interpolateTyphoonState(
  s1: TyphoonState,
  s2: TyphoonState,
  fraction: number
): TyphoonState {
  const isLandTransition = s1.landed !== s2.landed;
  const currentLanded = fraction < 0.5 ? s1.landed : s2.landed;

  const lerp = (a: number, b: number) => a + (b - a) * fraction;
  const lerpRadius = (a: number, b: number) => {
    if (isLandTransition) {
      return currentLanded ? 0 : (fraction < 0.5 ? a : b);
    }
    if (a > 0 && b === 0) return fraction < 0.5 ? a : 0;
    if (a === 0 && b > 0) return fraction > 0.5 ? b : 0;
    return lerp(a, b);
  };

  return {
    ...s1,
    lat: lerp(s1.lat, s2.lat),
    lon: lerp(s1.lon, s2.lon),
    vmax: lerp(s1.vmax, s2.vmax),
    pmin: lerp(s1.pmin, s2.pmin),
    rmw: lerp(s1.rmw, s2.rmw),
    r7: {
      ne: lerpRadius(s1.r7.ne, s2.r7.ne),
      se: lerpRadius(s1.r7.se, s2.r7.se),
      sw: lerpRadius(s1.r7.sw, s2.r7.sw),
      nw: lerpRadius(s1.r7.nw, s2.r7.nw)
    },
    r10: {
      ne: lerpRadius(s1.r10.ne, s2.r10.ne),
      se: lerpRadius(s1.r10.se, s2.r10.se),
      sw: lerpRadius(s1.r10.sw, s2.r10.sw),
      nw: lerpRadius(s1.r10.nw, s2.r10.nw)
    },
    r12: {
      ne: lerpRadius(s1.r12.ne, s2.r12.ne),
      se: lerpRadius(s1.r12.se, s2.r12.se),
      sw: lerpRadius(s1.r12.sw, s2.r12.sw),
      nw: lerpRadius(s1.r12.nw, s2.r12.nw)
    },
    casualties: lerp(s1.casualties || 0, s2.casualties || 0),
    simHour: s1.simHour + fraction * (s2.simHour - s1.simHour),
    stationReadings: s1.stationReadings
  };
}

export async function renderVideoFrameOnCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  typhoon: Typhoon,
  currentSimHour: number,
  exportConfig: VideoExportConfig,
  customCenter?: { lat: number; lon: number }
) {
  const history = typhoon.history;
  if (!history || history.length === 0) return;

  // 1. Determine current state with Catmull-Rom smooth spline interpolation
  const currentState: TyphoonState = interpolateTyphoonSmooth(history, currentSimHour);

  // Camera center
  let centerLat = currentState.lat;
  let centerLon = currentState.lon;

  if (customCenter) {
    centerLat = customCenter.lat;
    centerLon = customCenter.lon;
  } else if (!exportConfig.centerFollow) {
    // Calculate centroid of full history
    let sumLat = 0;
    let sumLon = 0;
    history.forEach((h) => {
      sumLat += h.lat;
      sumLon += h.lon;
    });
    centerLat = sumLat / history.length;
    centerLon = sumLon / history.length;
  }

  const zoom = getMercatorZoom(exportConfig.zoomLevel, width);

  // Helper for coordinate conversion
  const toScreen = (lat: number, lon: number) =>
    latLonToMercatorPixel(lat, lon, centerLat, centerLon, zoom, width, height);

  // 2. Clear canvas with oceanic background
  ctx.save();
  ctx.fillStyle = exportConfig.baseMap === "light" ? "#f8fafc" : "#07111F";
  ctx.fillRect(0, 0, width, height);

  // 3. Draw Map Tiles if enabled
  if (exportConfig.baseMap !== "none") {
    const tileZoom = Math.floor(zoom);
    const scaleFactor = Math.pow(2, zoom - tileZoom);
    const worldSize = 256 * Math.pow(2, tileZoom);

    const cx = ((centerLon + 180) / 360) * worldSize;
    const centerLatRad = (centerLat * Math.PI) / 180;
    const cy = (1 - Math.log(Math.tan(centerLatRad) + 1 / Math.cos(centerLatRad)) / Math.PI) * (worldSize / 2);

    const minX = Math.floor((cx - (width / (2 * scaleFactor))) / 256) - 1;
    const maxX = Math.ceil((cx + (width / (2 * scaleFactor))) / 256) + 1;
    const minY = Math.floor((cy - (height / (2 * scaleFactor))) / 256) - 1;
    const maxY = Math.ceil((cy + (height / (2 * scaleFactor))) / 256) + 1;

    for (let tx = minX; tx <= maxX; tx++) {
      for (let ty = minY; ty <= maxY; ty++) {
        const tileUrl = globalTileCache.getTileUrl(exportConfig.baseMap, tileZoom, tx, ty);
        let img = globalTileCache.getTileIfLoaded(tileUrl);
        if (!img && tileUrl) {
          img = await globalTileCache.loadTile(tileUrl);
        }

        const screenX = width / 2 + (tx * 256 - cx) * scaleFactor;
        const screenY = height / 2 + (ty * 256 - cy) * scaleFactor;
        const tileSize = 256 * scaleFactor;

        if (img) {
          ctx.drawImage(img, screenX, screenY, tileSize, tileSize);
        } else {
          // Draw fallback ocean grid tile
          ctx.strokeStyle = exportConfig.baseMap === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.03)";
          ctx.strokeRect(screenX, screenY, tileSize, tileSize);
        }
      }
    }
  }

  // 4. Draw Land Polygons (Coastlines/Borders) if enabled
  const uiScale = width / 1280;

  if (exportConfig.showCoastline) {
    ctx.fillStyle = exportConfig.baseMap === "light" ? "rgba(203,213,225,0.4)" : "rgba(15,23,42,0.5)";
    ctx.strokeStyle = exportConfig.baseMap === "light" ? "rgba(100,116,139,0.6)" : "rgba(30,156,255,0.7)";
    ctx.lineWidth = Math.max(1, 1.2 * uiScale);

    EAST_ASIA_LAND.forEach((land) => {
      if (!land.polygon || land.polygon.length < 3) return;
      ctx.beginPath();
      land.polygon.forEach((pt, idx) => {
        const scr = toScreen(pt[0], pt[1]);
        if (idx === 0) ctx.moveTo(scr.x, scr.y);
        else ctx.lineTo(scr.x, scr.y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
  }

  // 5. Draw Lat/Lon Grid Lines if enabled
  if (exportConfig.showGrid) {
    ctx.strokeStyle = exportConfig.baseMap === "light" ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)";
    ctx.fillStyle = exportConfig.baseMap === "light" ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)";
    ctx.font = `${Math.round(11 * uiScale)}px sans-serif`;
    ctx.lineWidth = Math.max(1, 1 * uiScale);

    for (let lat = 0; lat <= 55; lat += 5) {
      const p1 = toScreen(lat, 90);
      ctx.beginPath();
      ctx.moveTo(0, p1.y);
      ctx.lineTo(width, p1.y);
      ctx.stroke();
      if (p1.y > 20 * uiScale && p1.y < height - 20 * uiScale) {
        ctx.fillText(`${lat}°N`, 12 * uiScale, p1.y - 4 * uiScale);
      }
    }

    for (let lon = 90; lon <= 180; lon += 5) {
      const p1 = toScreen(0, lon);
      ctx.beginPath();
      ctx.moveTo(p1.x, 0);
      ctx.lineTo(p1.x, height);
      ctx.stroke();
      if (p1.x > 30 * uiScale && p1.x < width - 30 * uiScale) {
        ctx.fillText(`${lon}°E`, p1.x + 4 * uiScale, height - 12 * uiScale);
      }
    }
  }

  // 6. Draw Forecast Path & Uncertainty Cone if enabled
  const renderedHistory = history.filter((h) => h.simHour <= currentSimHour);
  const activeHist = renderedHistory.length > 0 ? renderedHistory[renderedHistory.length - 1] : history[0];
  const fPath = activeHist?.forecastPath || typhoon.forecastPath || [];

  if (exportConfig.showForecast && fPath && fPath.length > 0) {
    // Draw uncertainty cone if enabled
    if (exportConfig.showUncertaintyCone) {
      ctx.fillStyle = "rgba(71, 85, 105, 0.12)";
      ctx.strokeStyle = "rgba(100, 116, 139, 0.4)";
      ctx.lineWidth = Math.max(1, 1 * uiScale);

      fPath.forEach((pt) => {
        if (pt.simHour > 0) {
          const scr = toScreen(pt.lat, pt.lon);
          // radius in screen pixels based on mercator zoom
          const radiusKm = pt.simHour * 3.1;
          const radiusPx = (radiusKm / 111.12) * (256 * Math.pow(2, zoom) / 360);

          ctx.beginPath();
          ctx.arc(scr.x, scr.y, radiusPx, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      });
    }

    // Draw dashed forecast line
    ctx.setLineDash([Math.round(8 * uiScale), Math.round(6 * uiScale)]);
    ctx.lineWidth = Math.max(1.5, 3 * uiScale);

    for (let i = 0; i < fPath.length; i++) {
      const ptStart = i === 0 ? toScreen(currentState.lat, currentState.lon) : toScreen(fPath[i - 1].lat, fPath[i - 1].lon);
      const ptEnd = toScreen(fPath[i].lat, fPath[i].lon);

      ctx.strokeStyle = getCategoryColor(fPath[i].category);
      ctx.beginPath();
      ctx.moveTo(ptStart.x, ptStart.y);
      ctx.lineTo(ptEnd.x, ptEnd.y);
      ctx.stroke();
    }
    ctx.setLineDash([]); // reset

    // Draw forecast node dots
    fPath.forEach((pt) => {
      const scr = toScreen(pt.lat, pt.lon);
      ctx.fillStyle = getCategoryColor(pt.category);
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = Math.max(1, 1.5 * uiScale);
      ctx.beginPath();
      ctx.arc(scr.x, scr.y, Math.max(3, 5 * uiScale), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }

  // 7. Draw Historical Track (Up to currentSimHour)
  if (renderedHistory.length > 1) {
    for (let i = 0; i < renderedHistory.length - 1; i++) {
      const h1 = renderedHistory[i];
      const h2 = renderedHistory[i + 1];
      const scr1 = toScreen(h1.lat, h1.lon);
      const scr2 = toScreen(h2.lat, h2.lon);

      ctx.strokeStyle = getCategoryColor(h1.category);
      ctx.lineWidth = Math.max(2, 4 * uiScale);
      ctx.beginPath();
      ctx.moveTo(scr1.x, scr1.y);
      ctx.lineTo(scr2.x, scr2.y);
      ctx.stroke();
    }

    // Connect line to smooth interpolated currentState
    const lastHist = renderedHistory[renderedHistory.length - 1];
    if (lastHist.simHour < currentState.simHour) {
      const scr1 = toScreen(lastHist.lat, lastHist.lon);
      const scr2 = toScreen(currentState.lat, currentState.lon);

      ctx.strokeStyle = getCategoryColor(lastHist.category);
      ctx.lineWidth = Math.max(2, 4 * uiScale);
      ctx.beginPath();
      ctx.moveTo(scr1.x, scr1.y);
      ctx.lineTo(scr2.x, scr2.y);
      ctx.stroke();
    }
  }

  // Draw track dot nodes according to dotInterval
  if (exportConfig.dotInterval > 0) {
    renderedHistory.forEach((h) => {
      const showDot = h.simHour % exportConfig.dotInterval === 0 || h.simHour === 0;
      if (!showDot) return;

      const scr = toScreen(h.lat, h.lon);
      ctx.fillStyle = getCategoryColor(h.category);
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = Math.max(1, 1.5 * uiScale);
      ctx.beginPath();
      ctx.arc(scr.x, scr.y, Math.max(3, 5 * uiScale), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }

  // 8. Draw 3-Tier 4-Quadrant Wind Circles (`r7`, `r10`, `r12`) for current state
  // Wind circles now animate smoothly using interpolated radii for a better visual experience
  if (exportConfig.showWindRadii && !currentState.landed) {
    const levels = [
      { radii: currentState.r7, color: "rgba(243, 156, 18, 0.25)", stroke: "#f39c12", label: "7级风圈" },
      { radii: currentState.r10, color: "rgba(211, 84, 0, 0.35)", stroke: "#d35400", label: "10级风圈" },
      { radii: currentState.r12, color: "rgba(192, 57, 43, 0.45)", stroke: "#c0392b", label: "12级风圈" }
    ];

    levels.forEach((lvl) => {
      if (lvl.radii.ne <= 0 && lvl.radii.se <= 0 && lvl.radii.sw <= 0 && lvl.radii.nw <= 0) return;

      const quadPoints: { x: number; y: number }[] = [];

      // NE quadrant: 0 to 90 deg
      for (let deg = 0; deg <= 90; deg += 3) {
        const rad = (deg * Math.PI) / 180;
        const dLat = (lvl.radii.ne * Math.cos(rad)) / 111.12;
        const dLon = (lvl.radii.ne * Math.sin(rad)) / (111.12 * Math.cos((currentState.lat * Math.PI) / 180));
        quadPoints.push(toScreen(currentState.lat + dLat, currentState.lon + dLon));
      }

      // SE quadrant: 90 to 180 deg
      for (let deg = 90; deg <= 180; deg += 3) {
        const rad = (deg * Math.PI) / 180;
        const dLat = (lvl.radii.se * Math.cos(rad)) / 111.12;
        const dLon = (lvl.radii.se * Math.sin(rad)) / (111.12 * Math.cos((currentState.lat * Math.PI) / 180));
        quadPoints.push(toScreen(currentState.lat + dLat, currentState.lon + dLon));
      }

      // SW quadrant: 180 to 270 deg
      for (let deg = 180; deg <= 270; deg += 3) {
        const rad = (deg * Math.PI) / 180;
        const dLat = (lvl.radii.sw * Math.cos(rad)) / 111.12;
        const dLon = (lvl.radii.sw * Math.sin(rad)) / (111.12 * Math.cos((currentState.lat * Math.PI) / 180));
        quadPoints.push(toScreen(currentState.lat + dLat, currentState.lon + dLon));
      }

      // NW quadrant: 270 to 360 deg
      for (let deg = 270; deg <= 360; deg += 3) {
        const rad = (deg * Math.PI) / 180;
        const dLat = (lvl.radii.nw * Math.cos(rad)) / 111.12;
        const dLon = (lvl.radii.nw * Math.sin(rad)) / (111.12 * Math.cos((currentState.lat * Math.PI) / 180));
        quadPoints.push(toScreen(currentState.lat + dLat, currentState.lon + dLon));
      }

      ctx.fillStyle = lvl.color;
      ctx.strokeStyle = lvl.stroke;
      ctx.lineWidth = Math.max(1, 2 * uiScale);

      ctx.beginPath();
      quadPoints.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
  }

  // 9. Draw Active Typhoon Center Symbol
  const centerScr = toScreen(currentState.lat, currentState.lon);
  const catColor = getCategoryColor(currentState.category);

  // Outer glowing ring
  ctx.fillStyle = catColor;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.arc(centerScr.x, centerScr.y, 16 * uiScale, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // Solid center dot
  ctx.fillStyle = catColor;
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = Math.max(1, 2 * uiScale);
  ctx.beginPath();
  ctx.arc(centerScr.x, centerScr.y, 8 * uiScale, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Eye dot
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(centerScr.x, centerScr.y, 2.5 * uiScale, 0, Math.PI * 2);
  ctx.fill();

  // 10. Draw Weather Stations (Layer below HUD Box)
  if (exportConfig.showStations) {
    WEATHER_STATIONS_DATA.forEach(station => {
      let windSpeed = 0;
      const reading = currentState.stationReadings?.find(r => r.name === station.name);
      
      if (reading) {
        windSpeed = reading.windSpeed;
      } else {
        const R = 6371;
        const dLat = (station.lat - currentState.lat) * (Math.PI / 180);
        const dLon = (station.lon - currentState.lon) * (Math.PI / 180);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(currentState.lat * (Math.PI / 180)) * Math.cos(station.lat * (Math.PI / 180)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const dist = R * c;
        
        if (dist > 0) {
          if (currentState.vmax > 48.0 && dist < currentState.rmw) {
            windSpeed = currentState.vmax * (0.15 + 0.85 * (dist / currentState.rmw));
          } else {
            windSpeed = Math.max(0, Math.min(currentState.vmax, (currentState.vmax * currentState.rmw) / dist));
          }
        } else {
          windSpeed = currentState.vmax > 48.0 ? currentState.vmax * 0.15 : currentState.vmax;
        }
      }

      const pt = toScreen(station.lat, station.lon);
      if (pt.x < 0 || pt.x > width || pt.y < 0 || pt.y > height) return;

      const sizeScale = (exportConfig.stationSizeScale || 0.8) * uiScale;
      const w = 42 * sizeScale;
      const h = 18 * sizeScale;
      const borderRadius = 9 * sizeScale;

      ctx.fillStyle = getStationGradientColor(windSpeed);
      ctx.beginPath();
      ctx.roundRect(pt.x - w / 2, pt.y - h / 2, w, h, borderRadius);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "white";
      ctx.font = `bold ${10 * sizeScale}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(windSpeed.toFixed(1), pt.x, pt.y);
    });
  }

  // 11. Draw Data Annotation Badge (Highest Layer above Weather Stations)
  if (exportConfig.showDataLabel) {
    let sizeMultiplier = 1.0;
    if (exportConfig.labelSize === "small") sizeMultiplier = 0.85;
    else if (exportConfig.labelSize === "large") sizeMultiplier = 1.2;
    else if (exportConfig.labelSize === "extraLarge") sizeMultiplier = 1.4;

    // Slightly enlarged typography for optimal legibility
    let portraitBoost = 1.0;
    if (exportConfig.aspectRatio === "9:16" || exportConfig.aspectRatio === "3:4") {
      portraitBoost = 1.5;
    }

    const titleFontSize = Math.round(16 * sizeMultiplier * uiScale * portraitBoost);
    const categoryFontSize = Math.round(14 * sizeMultiplier * uiScale * portraitBoost);
    const bodyFontSize = Math.round(13 * sizeMultiplier * uiScale * portraitBoost);

    const paddingX = Math.round(14 * sizeMultiplier * uiScale * portraitBoost);
    const paddingY = Math.round(10 * sizeMultiplier * uiScale * portraitBoost);

    // Date/Time calculation
    let timeLabel = "";
    let calendarLine: string | null = null;
    if (exportConfig.showDateTime) {
      if (exportConfig.dateTimeFormat === "relative") {
        timeLabel = ` (${Math.round(currentSimHour)}h)`;
      } else {
        // Calculate calendar date starting from current simulation start date
        const date = getSimulationStartDate(exportConfig);
        date.setHours(date.getHours() + Math.round(currentSimHour));
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, "0");
        const d = date.getDate().toString().padStart(2, "0");
        const h = date.getHours().toString().padStart(2, "0");
        calendarLine = `${y}/${m}/${d} ${h}:00`;
      }
    }

    const titleText = `${typhoon.name}${timeLabel}`;
    const categoryText = currentState.category;

    // Build body lines dynamically
    let bodyLines: { text: string; color: string }[] = [];

    // Check date position option
    const dateInside = !exportConfig.dateTimePosition || exportConfig.dateTimePosition === "inside";

    if (calendarLine && dateInside) {
      bodyLines.push({
        text: calendarLine,
        color: "#cbd5e1" // slate-300
      });
    }
    bodyLines.push({
      text: `位置: ${currentState.lat.toFixed(2)}°N, ${currentState.lon.toFixed(2)}°E`,
      color: "rgba(226, 232, 240, 0.95)"
    });

    if (exportConfig.labelContent === "all" || exportConfig.labelContent === "pressure") {
      bodyLines.push({
        text: `中心气压: ${currentState.pmin.toFixed(0)} hPa`,
        color: "#1E9CFF"
      });
    }

    if (exportConfig.labelContent === "all" || exportConfig.labelContent === "windSpeed") {
      const force = getWindForceCategory(currentState.vmax);
      bodyLines.push({
        text: `最大风速: ${currentState.vmax.toFixed(1)} m/s (${force}级)`,
        color: "#f43f5e"
      });
    }

    if (exportConfig.showCasualties && currentState.casualties && currentState.casualties > 0) {
      const casualtyText = currentState.casualties > 10000 
        ? `${((currentState.casualties as number) / 10000).toFixed(1)} 万人` 
        : `${Math.round(currentState.casualties as number)} 人`;
      bodyLines.push({
        text: `预估伤亡: ${casualtyText}`,
        color: "#fca5a5"
      });
    }

    if (exportConfig.showStatus) {
      const statusText = getTyphoonStatusText(currentState);
      bodyLines.push({
        text: `状态: ${statusText}`,
        color: "#c084fc"
      });
    }

    // Measure widths dynamically so box size fits text perfectly without waste or overflow
    ctx.font = `bold ${titleFontSize}px sans-serif`;
    const titleWidth = ctx.measureText(titleText).width;

    ctx.font = `bold ${categoryFontSize}px sans-serif`;
    const catWidth = ctx.measureText(categoryText).width;

    const headerGap = Math.round(18 * sizeMultiplier * uiScale);
    const headerRowWidth = titleWidth + headerGap + catWidth;

    ctx.font = `${bodyFontSize}px monospace, sans-serif`;
    let maxBodyWidth = 0;
    bodyLines.forEach((line) => {
      const w = ctx.measureText(line.text).width;
      if (w > maxBodyWidth) maxBodyWidth = w;
    });

    const maxContentWidth = Math.max(headerRowWidth, maxBodyWidth);
    const badgeWidth = Math.ceil(maxContentWidth + paddingX * 2);

    const lineSpacing = Math.round(bodyFontSize * 1.35);
    const dividerMargin = Math.round(7 * sizeMultiplier * uiScale);
    const badgeHeight = Math.ceil(
      paddingY * 2 +
      titleFontSize +
      dividerMargin * 2 +
      (bodyLines.length > 0 ? bodyLines.length * lineSpacing : 0)
    );

    const margin = Math.round(22 * uiScale);

    let badgeX = margin;
    let badgeY = margin;

    if (exportConfig.labelPosition === "top-right") {
      badgeX = width - badgeWidth - margin;
      badgeY = margin;
    } else if (exportConfig.labelPosition === "bottom-left") {
      badgeX = margin;
      badgeY = height - badgeHeight - margin;
    } else if (exportConfig.labelPosition === "bottom-right") {
      badgeX = width - badgeWidth - margin;
      badgeY = height - badgeHeight - margin;
    }

    // HUD Glass Box Background - Non-colored neutral border
    ctx.fillStyle = "rgba(8, 18, 31, 0.92)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.32)";
    ctx.lineWidth = Math.max(1, 1.5 * uiScale);

    const cornerRadius = Math.round(10 * uiScale);
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, cornerRadius);
    ctx.fill();
    ctx.stroke();

    ctx.textBaseline = "top";
    ctx.textAlign = "left";

    // Title & Category
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `bold ${titleFontSize}px sans-serif`;
    const titleY = badgeY + paddingY;
    ctx.fillText(titleText, badgeX + paddingX, titleY);

    ctx.fillStyle = catColor;
    ctx.font = `bold ${categoryFontSize}px sans-serif`;
    ctx.fillText(categoryText, badgeX + badgeWidth - paddingX - catWidth, titleY);

    // Divider Line
    const dividerY = titleY + titleFontSize + dividerMargin;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = Math.max(1, 1 * uiScale);
    ctx.beginPath();
    ctx.moveTo(badgeX + paddingX, dividerY);
    ctx.lineTo(badgeX + badgeWidth - paddingX, dividerY);
    ctx.stroke();

    // Body Lines
    let currentY = dividerY + dividerMargin;
    ctx.font = `${bodyFontSize}px monospace, sans-serif`;

    bodyLines.forEach((line) => {
      ctx.fillStyle = line.color;
      ctx.fillText(line.text, badgeX + paddingX, currentY);
      currentY += lineSpacing;
    });
  }

  // Draw Date/Time at specified corner if configured
  if (exportConfig.showDateTime && exportConfig.dateTimePosition && exportConfig.dateTimePosition !== "inside") {
    drawCornerDateTime(ctx, width, height, currentSimHour, exportConfig, uiScale);
  }

  ctx.restore();
}

function drawCornerDateTime(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  currentSimHour: number,
  exportConfig: VideoExportConfig,
  uiScale: number
) {
  let dateStr = "";
  if (exportConfig.dateTimeFormat === "relative") {
    dateStr = `模拟时间: +${Math.round(currentSimHour)} 小时`;
  } else {
    const date = getSimulationStartDate(exportConfig);
    date.setHours(date.getHours() + Math.round(currentSimHour));
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const d = date.getDate().toString().padStart(2, "0");
    const h = date.getHours().toString().padStart(2, "0");
    dateStr = `${y}/${m}/${d} ${h}:00 UTC`;
  }

  const fontSize = Math.round(22 * uiScale);
  ctx.font = `600 ${fontSize}px "Inter", "Plus Jakarta Sans", system-ui, -apple-system, sans-serif`;
  const textWidth = ctx.measureText(dateStr).width;
  const paddingX = 14 * uiScale;
  const paddingY = 8 * uiScale;
  const boxW = textWidth + paddingX * 2;
  const boxH = fontSize + paddingY * 2;
  const margin = 20 * uiScale;

  let x = margin;
  let y = margin;
  const pos = exportConfig.dateTimePosition || "top-left";

  if (pos === "top-right") {
    x = width - boxW - margin;
    y = margin;
  } else if (pos === "bottom-left") {
    x = margin;
    y = height - boxH - margin;
  } else if (pos === "bottom-right") {
    x = width - boxW - margin;
    y = height - boxH - margin;
  }

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
  ctx.shadowBlur = 8 * uiScale;
  ctx.shadowOffsetX = 1 * uiScale;
  ctx.shadowOffsetY = 1.5 * uiScale;

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(dateStr, x + paddingX, y + paddingY);
  ctx.restore();
}

/**
 * Draws a final summary report overlay with wind and pressure curves
 */
function drawEndReport(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  typhoon: Typhoon,
  uiScale: number
) {
  const padding = 40 * uiScale;
  const panelW = width - padding * 2;
  const panelH = height - padding * 2;

  // Background blur panel
  ctx.save();
  ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 30 * uiScale;
  ctx.beginPath();
  ctx.roundRect(padding, padding, panelW, panelH, 24 * uiScale);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 2 * uiScale;
  ctx.stroke();
  ctx.restore();

  // Title (Enlarged)
  ctx.fillStyle = "white";
  ctx.font = `bold ${38 * uiScale}px "Inter", sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`${typhoon.name || "台风"} 路径强度分析报告`, padding + 40 * uiScale, padding + 40 * uiScale);

  // Statistics Summary (Enlarged Fonts)
  const history = typhoon.history;
  const maxVmax = Math.max(...history.map(h => h.vmax));
  const minPmin = Math.min(...history.map(h => h.pmin));
  const duration = history.length;
  const fatalities = typhoon.casualties || 0;

  const stats = [
    { label: "最大风速", value: `${maxVmax.toFixed(1)} m/s`, color: "#ef4444" },
    { label: "最低气压", value: `${minPmin} hPa`, color: "#3b82f6" },
    { label: "生命周期", value: `${duration} 小时`, color: "#10b981" },
    { label: "预估伤亡", value: `${Math.round(fatalities).toLocaleString()} 人`, color: "#f59e0b" }
  ];

  stats.forEach((stat, i) => {
    const x = padding + 40 * uiScale + i * 270 * uiScale;
    const y = padding + 105 * uiScale;
    
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = `${16 * uiScale}px sans-serif`;
    ctx.fillText(stat.label, x, y);
    
    ctx.fillStyle = stat.color;
    ctx.font = `bold ${28 * uiScale}px sans-serif`;
    ctx.fillText(stat.value, x, y + 28 * uiScale);
  });

  // Chart area
  const chartX = padding + 80 * uiScale;
  const chartY = padding + 220 * uiScale;
  const chartW = panelW - 160 * uiScale;
  const chartH = panelH - 300 * uiScale;

  // Grid and Axes (Enlarged Text)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 1;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.font = `${14 * uiScale}px sans-serif`;

  const vmaxMin = 0;
  const vmaxMax = Math.max(80, Math.ceil(maxVmax / 10) * 10 + 10);
  const pminMin = Math.min(880, Math.floor(minPmin / 10) * 10 - 10);
  const pminMax = 1020;

  // Horizontal Grid Lines and Y-axis labels
  for (let i = 0; i <= 5; i++) {
    const gy = chartY + (i / 5) * chartH;
    ctx.beginPath();
    ctx.moveTo(chartX, gy);
    ctx.lineTo(chartX + chartW, gy);
    ctx.stroke();

    // Left Y-axis (Wind Speed)
    const vVal = vmaxMax - (i / 5) * (vmaxMax - vmaxMin);
    ctx.fillStyle = "#ef4444";
    ctx.fillText(Math.round(vVal).toString(), chartX - 12 * uiScale, gy);

    // Right Y-axis (Pressure)
    const pVal = pminMax - (i / 5) * (pminMax - pminMin);
    ctx.fillStyle = "#3b82f6";
    ctx.textAlign = "left";
    ctx.fillText(Math.round(pVal).toString(), chartX + chartW + 12 * uiScale, gy);
    ctx.textAlign = "right";
  }

  // Axis Labels
  ctx.fillStyle = "#ef4444";
  ctx.font = `bold ${16 * uiScale}px sans-serif`;
  ctx.fillText("风速 (m/s)", chartX - 10 * uiScale, chartY - 24 * uiScale);
  ctx.fillStyle = "#3b82f6";
  ctx.textAlign = "left";
  ctx.fillText("气压 (hPa)", chartX + chartW + 10 * uiScale, chartY - 24 * uiScale);

  // X-axis (Hours)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.beginPath();
  ctx.moveTo(chartX, chartY + chartH);
  ctx.lineTo(chartX + chartW, chartY + chartH);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.font = `${14 * uiScale}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const hourStep = Math.max(6, Math.floor(duration / 10));
  for (let h = 0; h <= duration; h += hourStep) {
    const gx = chartX + (h / duration) * chartW;
    ctx.fillText(`${h}h`, gx, chartY + chartH + 12 * uiScale);
  }
  ctx.font = `bold ${15 * uiScale}px sans-serif`;
  ctx.fillText("模拟时间 (小时)", chartX + chartW / 2, chartY + chartH + 40 * uiScale);

  // Requirement 11: Apply high-frequency small turbulence jitter preserving key nodes
  const applyJitterWithKeyNodeProtection = (data: number[], isWind: boolean) => {
    if (data.length <= 2) return data;
    const keyIndices = new Set<number>([0, data.length - 1]);
    if (isWind) {
      const maxVal = Math.max(...data);
      data.forEach((v, idx) => { if (v === maxVal) keyIndices.add(idx); });
    } else {
      const minVal = Math.min(...data);
      data.forEach((v, idx) => { if (v === minVal) keyIndices.add(idx); });
    }
    if (typhoon.landfallRecords) {
      typhoon.landfallRecords.forEach(l => {
        if (l.simHour >= 0 && l.simHour < data.length) keyIndices.add(Math.round(l.simHour));
      });
    }

    return data.map((v, i) => {
      let minDist = 999;
      keyIndices.forEach(ki => {
        const d = Math.abs(i - ki);
        if (d < minDist) minDist = d;
      });
      const damp = Math.min(1.0, minDist / 2.5);
      if (damp <= 0) return v;

      const t = i * 0.8;
      const seed = isWind ? 1.7 : 3.1;
      const jitterSignal = (
        Math.sin(t * 2.3 + seed * 1.5) * 0.45 +
        Math.cos(t * 5.1 - seed * 2.2) * 0.35 +
        Math.sin(t * 11.7 + seed * 3.8) * 0.20
      ) * damp;

      const amp = isWind ? 0.9 : 1.4;
      return v + jitterSignal * amp;
    });
  };

  // Draw Curves
  const drawCurve = (data: number[], color: string, min: number, max: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5 * uiScale;
    ctx.beginPath();
    
    data.forEach((val, i) => {
      const x = chartX + (i / Math.max(1, data.length - 1)) * chartW;
      const y = chartY + chartH - ((val - min) / (max - min)) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Subtle area under curve
    ctx.lineTo(chartX + chartW, chartY + chartH);
    ctx.lineTo(chartX, chartY + chartH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, chartY, 0, chartY + chartH);
    grad.addColorStop(0, color.replace(")", ", 0.15)").replace("rgb", "rgba"));
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fill();
  };

  const rawVmaxData = history.map(h => h.vmax);
  const rawPminData = history.map(h => h.pmin);

  const vmaxData = applyJitterWithKeyNodeProtection(rawVmaxData, true);
  const pminData = applyJitterWithKeyNodeProtection(rawPminData, false);

  drawCurve(vmaxData, "#ef4444", vmaxMin, vmaxMax);
  drawCurve(pminData, "#3b82f6", pminMin, pminMax);
}

// Master Video Encoding Generator Function
export async function generateTyphoonVideo(
  typhoon: Typhoon,
  exportConfig: VideoExportConfig,
  onProgress: (prog: RenderProgress) => void,
  signal?: AbortSignal
): Promise<Blob> {
  const { width, height } = getCanvasDimensions(exportConfig.aspectRatio, exportConfig.videoResolution);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to create 2D canvas context");

  const history = typhoon.history;
  if (!history || history.length === 0) {
    throw new Error("Typhoon has no history path to render");
  }

  const startHour = history[0].simHour;
  const endHour = history[history.length - 1].simHour;
  const totalHours = endHour - startHour;

  // Video Parameters: Configurable Duration (2-30s) and FPS (1-60fps)
  const fps = exportConfig.fps || 30;
  const durationSec = exportConfig.durationSec || 10;
  const totalFrames = Math.max(1, Math.round(durationSec * fps));

  onProgress({
    percentage: 0,
    currentFrame: 0,
    totalFrames,
    statusText: "正在预加载地图瓦片数据..."
  });

  // Preload tiles for all centers across simulation frames with correct scale factor & trajectory interpolation
  const zoom = getMercatorZoom(exportConfig.zoomLevel, width);
  const tileZoom = Math.floor(zoom);

  let sumLat = 0;
  let sumLon = 0;
  history.forEach((h) => {
    sumLat += h.lat;
    sumLon += h.lon;
  });
  const avgLat = sumLat / history.length;
  const avgLon = sumLon / history.length;

  const tilePromises: Promise<HTMLImageElement | null>[] = [];
  if (exportConfig.baseMap !== "none") {
    const tileUrlsToLoad = new Set<string>();

    for (let f = 0; f <= totalFrames; f += 1) {
      const frac = f / totalFrames;
      const simHour = startHour + frac * totalHours;

      let cLat = avgLat;
      let cLon = avgLon;
      if (exportConfig.centerFollow) {
        let stateAtF = history[0];
        if (simHour <= history[0].simHour) {
          stateAtF = history[0];
        } else if (simHour >= history[history.length - 1].simHour) {
          stateAtF = history[history.length - 1];
        } else {
          for (let i = 0; i < history.length - 1; i++) {
            if (simHour >= history[i].simHour && simHour <= history[i + 1].simHour) {
              const span = history[i + 1].simHour - history[i].simHour;
              const subFrac = span > 0 ? (simHour - history[i].simHour) / span : 0;
              stateAtF = interpolateTyphoonState(history[i], history[i + 1], subFrac);
              break;
            }
          }
        }
        cLat = stateAtF.lat;
        cLon = stateAtF.lon;
      }

      const scaleFactor = Math.pow(2, zoom - tileZoom);
      const worldSize = 256 * Math.pow(2, tileZoom);
      const cx = ((cLon + 180) / 360) * worldSize;
      const centerLatRad = (cLat * Math.PI) / 180;
      const cy = (1 - Math.log(Math.tan(centerLatRad) + 1 / Math.cos(centerLatRad)) / Math.PI) * (worldSize / 2);

      const minX = Math.floor((cx - (width / (2 * scaleFactor))) / 256) - 3;
      const maxX = Math.ceil((cx + (width / (2 * scaleFactor))) / 256) + 3;
      const minY = Math.floor((cy - (height / (2 * scaleFactor))) / 256) - 3;
      const maxY = Math.ceil((cy + (height / (2 * scaleFactor))) / 256) + 3;

      for (let tx = minX; tx <= maxX; tx++) {
        for (let ty = minY; ty <= maxY; ty++) {
          const url = globalTileCache.getTileUrl(exportConfig.baseMap, tileZoom, tx, ty);
          if (url) tileUrlsToLoad.add(url);
        }
      }
    }

    tileUrlsToLoad.forEach((url) => {
      tilePromises.push(globalTileCache.loadTile(url));
    });
  }

  // Preload tiles with a 15s safety timeout to prevent hanging
  const tileTimeout = new Promise((r) => setTimeout(r, 15000));
  await Promise.race([Promise.all(tilePromises), tileTimeout]);

  if (signal?.aborted) throw new Error("Video rendering cancelled by user");

  
  let bitRate = exportConfig.bitrate || 28000000; // Use user provided bitrate or defaults
  if (!exportConfig.bitrate) {
    if (exportConfig.videoResolution === "720p") bitRate = 15000000; // 15 Mbps
    else if (exportConfig.videoResolution === "1080p") bitRate = 28000000; // 28 Mbps
    else if (exportConfig.videoResolution === "2K") bitRate = 45000000; // 45 Mbps for 2K
    else if (exportConfig.videoResolution === "4K") bitRate = 80000000; // 80 Mbps for 4K
  }

  const isH265 = exportConfig.videoCodec === "H.265"; // Only H.265 if explicitly selected

  if (typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined") {
    let muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: {
        codec: isH265 ? 'hevc' : 'avc',
        width: width,
        height: height
      },
      fastStart: 'in-memory'
    });

    let encoderError: any = null;
    let videoEncoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => {
        console.error("VideoEncoder error:", e);
        encoderError = e;
      }
    });

    const candidateCodecs = isH265 ? [
      'hev1.1.6.L153.B0', // HEVC Main Profile, Main Tier, Level 5.1
      'hev1.1.6.L150.B0', // HEVC Main Profile, Main Tier, Level 5.0
      'hev1.1.6.L120.B0', // HEVC Main Profile, Main Tier, Level 4.0
      'hev1.1.6.L93.B0',  // HEVC Main Profile, Main Tier, Level 3.1
      'hvc1.1.6.L153.B0', // Alternative identifier
      'hvc1.1.6.L150.B0',
      'hev1.1.6.L153',
      'hev1.1.6.L150',
      'hev1.2.4.L153.B0'  // HEVC Main 10 Profile
    ] : [
      'avc1.640034', // High Profile Level 5.2 (Required for 4K/60 H.264)
      'avc1.640033', // High Profile Level 5.1
      'avc1.4d0033', // Main Profile Level 5.1
      'avc1.42E033', // Baseline Level 5.1
      'avc1.640032', // High Profile Level 5.0
      'avc1.64002a', // High Profile Level 4.2
      'avc1.42E01E'  // Baseline Level 3.0
    ];

    let codecString = candidateCodecs[0];
    for (const cand of candidateCodecs) {
      try {
        const support = await VideoEncoder.isConfigSupported({
          codec: cand,
          width: width,
          height: height,
          bitrate: bitRate,
          framerate: fps
        });
        if (support && support.supported) {
          codecString = cand;
          break;
        }
      } catch (e) {
        // continue trying next codec
      }
    }

    videoEncoder.configure({
      codec: codecString,
      width: width,
      height: height,
      bitrate: bitRate,
      framerate: fps,
      latencyMode: "quality", // Prioritize extreme visual sharpness/quality over real-time streaming speed
    });

    const freezeFrames = (exportConfig.endAction && exportConfig.endAction !== "none") ? (2 * fps) : 0;
    const totalFramesWithFreeze = totalFrames + freezeFrames;
    const uiScale = width / 1920;

    // --- Unified Pipeline: Render and Encode on-the-fly ---
    try {
      for (let frame = 0; frame <= totalFramesWithFreeze; frame++) {
        if (signal?.aborted) {
          if (videoEncoder.state !== 'closed') videoEncoder.close();
          throw new Error("Video rendering cancelled by user");
        }
        if (encoderError) {
          throw new Error(`VideoEncoder failed: ${encoderError.message || encoderError}`);
        }

        const currentSimFrame = Math.min(frame, totalHours === 0 ? 0 : totalFrames);
        const frac = totalFrames === 0 ? 0 : currentSimFrame / totalFrames;
        const simHour = startHour + frac * totalHours;

        ctx.clearRect(0, 0, width, height);

        try {
          if (exportConfig.mode === "windfield") {
            renderWindFieldVideoFrameOnCanvas(ctx, width, height, typhoon, simHour, exportConfig);
          } else {
            await renderVideoFrameOnCanvas(ctx, width, height, typhoon, simHour, exportConfig);
          }
          
          if (frame > totalFrames && exportConfig.endAction === "report") {
            drawEndReport(ctx, width, height, typhoon, uiScale);
          }
        } catch (e) {
          console.warn(`Frame ${frame} render warning:`, e);
        }

        // Encode directly from canvas without creating an intermediate ImageBitmap list
        if (videoEncoder.state === 'configured') {
          const timestampMicroseconds = Math.round((frame / fps) * 1_000_000);
          // Pass the canvas directly to VideoFrame constructor - highly optimized by browsers
          const videoFrame = new VideoFrame(canvas, { timestamp: timestampMicroseconds });
          try {
            // Force ALL frames to be KeyFrames (I-frames/Intra) to fully eliminate inter-frame coding drift
            videoEncoder.encode(videoFrame, { keyFrame: true });
          } catch (e: any) {
            console.error("Encode failed at frame", frame, ":", e);
            videoFrame.close();
            encoderError = e;
            throw e;
          }
          videoFrame.close();
        } else {
          console.warn(`VideoEncoder state is ${videoEncoder.state} at frame ${frame}, skipping encode`);
          if (videoEncoder.state === 'closed') {
            encoderError = new Error("Codec closed unexpectedly");
            break;
          }
        }

        const percentage = Math.min(99, Math.round((frame / totalFramesWithFreeze) * 96));
        onProgress({
          percentage,
          currentFrame: frame,
          totalFrames: totalFramesWithFreeze,
          statusText: `正在渲染并合成无损风场序列... (第 ${frame}/${totalFramesWithFreeze} 帧)`
        });

        // Control queue size to prevent browser/encoder choking
        let queueWaitStartTime = Date.now();
        while (videoEncoder.encodeQueueSize > 12) {
          await new Promise(r => setTimeout(r, 8));
          if (encoderError) break;
          if (Date.now() - queueWaitStartTime > 5000) {
            console.warn("VideoEncoder queue stuck for 5s, proceeding anyway");
            break;
          }
        }
        
        // Yield to prevent tab freeze (increase frequency for smooth UI)
        if (frame % 15 === 0) {
          await new Promise((r) => setTimeout(r, 4));
        }
      }

      if (videoEncoder.state !== 'closed' && !encoderError) {
        await videoEncoder.flush();
        muxer.finalize();
        const buffer = muxer.target.buffer;
        return new Blob([buffer], { type: "video/mp4" });
      } else if (encoderError) {
        throw new Error(`VideoEncoder finalization failed: ${encoderError.message || encoderError}`);
      } else {
        throw new Error("VideoEncoder closed unexpectedly");
      }
    } finally {
      // Cleanup happens automatically as canvas and VideoFrames are garbage collected
    }
  }

  // Fallback to MediaRecorder for browsers without WebCodecs
  // Check supported mime types for MediaRecorder prioritizing MP4 format
  const candidateMimeTypes = isH265 ? [
    "video/mp4;codecs=hvc1",
    "video/mp4;codecs=hev1",
    "video/mp4;codecs=hevc",
    "video/mp4;codecs=h265",
    "video/webm;codecs=hevc",
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4;codecs=avc1",
    "video/mp4;codecs=h264",
    "video/mp4"
  ] : [
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4;codecs=avc1",
    "video/mp4;codecs=h264",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm"
  ];

  let chosenMimeType = candidateMimeTypes.find((t) => MediaRecorder.isTypeSupported(t)) || "";



  // Use 30 fps capture stream to ensure MediaRecorder records exact 30 FPS frame timestamps
  const stream = canvas.captureStream(fps);
  let recorder: MediaRecorder;

  try {
    recorder = new MediaRecorder(stream, {
      mimeType: chosenMimeType || undefined,
      videoBitsPerSecond: bitRate
    });
  } catch {
    try {
      recorder = new MediaRecorder(stream, { videoBitsPerSecond: bitRate });
    } catch {
      recorder = new MediaRecorder(stream);
    }
  }

  const actualMimeType = recorder.mimeType || chosenMimeType || "video/mp4";
  const isMp4 = actualMimeType.includes("mp4") || actualMimeType.includes("avc1") || actualMimeType.includes("h264");
  const blobType = isMp4 ? "video/mp4" : "video/webm";

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  // Helper to fix MP4 container duration header so mobile photo albums and media players display exact duration
  const fixMp4Duration = async (blob: Blob, durationSec: number): Promise<Blob> => {
    try {
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const view = new DataView(buffer);

      for (let i = 0; i < bytes.length - 32; i++) {
        // Search for 'mvhd' box (Movie Header Box)
        if (bytes[i] === 0x6d && bytes[i+1] === 0x76 && bytes[i+2] === 0x68 && bytes[i+3] === 0x64) {
          const version = bytes[i + 4];
          if (version === 0) {
            const timescale = view.getUint32(i + 16, false);
            if (timescale > 0) {
              view.setUint32(i + 20, Math.round(durationSec * timescale), false);
            }
          } else if (version === 1) {
            const timescale = view.getUint32(i + 24, false);
            if (timescale > 0) {
              const targetDur = BigInt(Math.round(durationSec * timescale));
              view.setBigUint64(i + 28, targetDur, false);
            }
          }
        }
        // Search for 'mdhd' box (Media Header Box)
        if (bytes[i] === 0x6d && bytes[i+1] === 0x64 && bytes[i+2] === 0x68 && bytes[i+3] === 0x64) {
          const version = bytes[i + 4];
          if (version === 0) {
            const timescale = view.getUint32(i + 16, false);
            if (timescale > 0) {
              view.setUint32(i + 20, Math.round(durationSec * timescale), false);
            }
          } else if (version === 1) {
            const timescale = view.getUint32(i + 24, false);
            if (timescale > 0) {
              const targetDur = BigInt(Math.round(durationSec * timescale));
              view.setBigUint64(i + 28, targetDur, false);
            }
          }
        }
        // Search for 'tkhd' box (Track Header Box)
        if (bytes[i] === 0x74 && bytes[i+1] === 0x6b && bytes[i+2] === 0x68 && bytes[i+3] === 0x64) {
          const version = bytes[i + 4];
          if (version === 0) {
            view.setUint32(i + 24, Math.round(durationSec * 1000), false);
          } else if (version === 1) {
            view.setBigUint64(i + 32, BigInt(Math.round(durationSec * 1000)), false);
          }
        }
      }
      return new Blob([buffer], { type: blob.type });
    } catch (e) {
      console.warn("Could not patch MP4 duration header:", e);
      return blob;
    }
  };

  // Helper to fix WebM duration header so media players display exact duration
  const fixWebmDuration = async (blob: Blob, durationMs: number): Promise<Blob> => {
    try {
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      
      // Search for Segment Info ID: 0x15, 0x49, 0xA9, 0x66
      for (let i = 0; i < bytes.length - 16; i++) {
        if (bytes[i] === 0x15 && bytes[i+1] === 0x49 && bytes[i+2] === 0xa9 && bytes[i+3] === 0x66) {
          let foundDuration = false;
          for (let j = i + 4; j < i + 200 && j < bytes.length - 8; j++) {
            if (bytes[j] === 0x44 && bytes[j+1] === 0x89) {
              foundDuration = true;
              const length = bytes[j+2];
              if (length === 8) {
                const view = new DataView(buffer, j + 3, 8);
                view.setFloat64(0, durationMs, false);
                return new Blob([buffer], { type: blob.type });
              } else if (length === 4) {
                const view = new DataView(buffer, j + 3, 4);
                view.setFloat32(0, durationMs, false);
                return new Blob([buffer], { type: blob.type });
              }
            }
          }

          // If Duration tag was missing, inject 0x44 0x89 0x88 [Float64 durationMs] into Segment Info
          if (!foundDuration && i + 8 < bytes.length) {
            const insertPos = i + 8; // Right inside Segment Info
            const durTag = new Uint8Array(11);
            durTag[0] = 0x44; // Element ID Duration
            durTag[1] = 0x89;
            durTag[2] = 0x88; // Length 8 bytes
            const view = new DataView(durTag.buffer, 3, 8);
            view.setFloat64(0, durationMs, false);

            const newBuffer = new Uint8Array(bytes.length + 11);
            newBuffer.set(bytes.subarray(0, insertPos), 0);
            newBuffer.set(durTag, insertPos);
            newBuffer.set(bytes.subarray(insertPos), insertPos + 11);

            return new Blob([newBuffer.buffer], { type: blob.type });
          }
        }
      }
    } catch (e) {
      console.warn("Could not patch EBML duration header:", e);
    }
    return blob;
  };

  const recorderStopped = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const rawBlob = new Blob(chunks, { type: blobType });
      let fixedBlob = await fixWebmDuration(rawBlob, durationSec * 1000);
      fixedBlob = await fixMp4Duration(fixedBlob, durationSec);
      resolve(fixedBlob);
    };
    recorder.onerror = (e) => {
      stream.getTracks().forEach((t) => t.stop());
      reject(e);
    };
  });

  // Start with 200ms timeslice to emit chunks progressively and prevent RAM spikes
  recorder.start(200);

  // Lockstep frame-by-frame rendering loop paced for 30 FPS (33.3ms per frame)
  const frameIntervalMs = 1000 / fps;
  for (let frame = 0; frame <= totalFrames; frame++) {
    const frameStartTime = performance.now();
    if (signal?.aborted) {
      if (recorder.state !== "inactive") recorder.stop();
      stream.getTracks().forEach((t) => t.stop());
      throw new Error("Video rendering cancelled by user");
    }

    const frac = frame / totalFrames;
    const simHour = startHour + frac * totalHours;

    try {
      await renderVideoFrameOnCanvas(ctx, width, height, typhoon, simHour, exportConfig);
    } catch (e) {
      console.warn(`Frame $${frame} render warning:`, e);
    }

    // Force frame capture on canvas stream if supported
    const track = stream.getVideoTracks()[0] as any;
    if (track && typeof track.requestFrame === "function") {
      track.requestFrame();
    }

    const percentage = Math.min(99, Math.round((frame / totalFrames) * 98));
    onProgress({
      percentage,
      currentFrame: frame,
      totalFrames,
      statusText: `正在逐帧合成 30 FPS MP4 动画视频 (第 ${frame}/${totalFrames} 帧)...`
    });

    const renderElapsed = performance.now() - frameStartTime;
    const delay = Math.max(1, Math.round(frameIntervalMs - renderElapsed));
    await new Promise((r) => setTimeout(r, delay));
  }

  
  // Hold the final frame for extra buffer ticks so MediaRecorder captures the entire video tail completely

  const extraHoldTicks = Math.max(16, Math.floor(fps * 0.8));
  for (let hold = 0; hold < extraHoldTicks; hold++) {
    if (signal?.aborted) break;
    try {
      await renderVideoFrameOnCanvas(ctx, width, height, typhoon, endHour, exportConfig);
    } catch {}
    const track = stream.getVideoTracks()[0] as any;
    if (track && typeof track.requestFrame === "function") {
      track.requestFrame();
    }
    await new Promise((r) => setTimeout(r, 16));
  }

  onProgress({
    percentage: 100,
    currentFrame: totalFrames,
    totalFrames,
    statusText: "正在封装导出的 MP4 动画视频文件..."
  });

  // Request any pending data buffer before stopping recorder
  if (recorder.state === "recording" && typeof recorder.requestData === "function") {
    recorder.requestData();
  }
  await new Promise((r) => setTimeout(r, 250));

  if (recorder.state !== "inactive") {
    recorder.stop();
  }
  return recorderStopped;
}

const getAngularRadius = (
  r: { ne?: number; se?: number; sw?: number; nw?: number } | undefined,
  angleRad: number,
  defaultVal: number
): number => {
  const ne = r?.ne ?? defaultVal;
  const se = r?.se ?? defaultVal;
  const sw = r?.sw ?? defaultVal;
  const nw = r?.nw ?? defaultVal;

  let deg = (angleRad * 180) / Math.PI;
  if (deg < 0) deg += 360;

  // NE center: 45 deg, NW center: 135 deg, SW center: 225 deg, SE center: 315 deg
  let shifted = (deg - 45) % 360;
  if (shifted < 0) shifted += 360;

  const segment = shifted / 90;
  const idx = Math.floor(segment);
  const frac = segment - idx;

  const t = (1 - Math.cos(frac * Math.PI)) / 2;

  if (idx === 0) {
    return ne * (1 - t) + nw * t;
  } else if (idx === 1) {
    return nw * (1 - t) + sw * t;
  } else if (idx === 2) {
    return sw * (1 - t) + se * t;
  } else {
    return se * (1 - t) + ne * t;
  }
};

const getMeanRadius = (
  rQuad: { ne: number; se: number; sw: number; nw: number } | undefined,
  defaultVal: number
): number => {
  if (!rQuad) return defaultVal;
  const sum = (rQuad.ne || 0) + (rQuad.se || 0) + (rQuad.sw || 0) + (rQuad.nw || 0);
  const count = ((rQuad.ne || 0) > 0 ? 1 : 0) + ((rQuad.se || 0) > 0 ? 1 : 0) + ((rQuad.sw || 0) > 0 ? 1 : 0) + ((rQuad.nw || 0) > 0 ? 1 : 0);
  return count > 0 ? sum / count : defaultVal;
};

const getTyphoonWindSpeed = (
  distKm: number,
  angleToPt: number,
  cvmax: number,
  radSnap: any,
  isLand: boolean = false,
  ewrcState: string = "none",
  ewrcProgress: number = 0
): { w_ty: number; rmw_km: number } => {
  let orgFactor = Math.min(1.0, Math.max(0.0, (cvmax - 28.0) / 55.0));
  if (isLand) orgFactor *= 0.25;

  // Use mean reference radii to maintain circular vortex symmetry (正圆)
  const r34_raw = getMeanRadius(radSnap?.r34 || radSnap?.r7, 220);
  const r50_raw = getMeanRadius(radSnap?.r50 || radSnap?.r10, 110);
  const r64_raw = getMeanRadius(radSnap?.r64 || radSnap?.r12, 45);

  const r34_eff = Math.max(35, r34_raw);
  const r50_eff = Math.max(25, r50_raw);
  const r64_eff = Math.max(18, r64_raw);

  // Compactness constraint: High intensity -> tight eye, Max 25km post-ERC constraint
  let baseRmw = Math.max(10, Math.min(65, r64_eff * (0.65 - 0.2 * orgFactor))); 
  
  if (ewrcState === "completed" || (ewrcState === "none" && radSnap?.ewrcCount > 0)) {
     baseRmw = Math.min(baseRmw, 25.0); // Rule 11 constraint
  }

  const rmw_km = baseRmw * (1.0 + 0.35 * (1.0 - orgFactor));
  let w_ty = 0;

  // Double eyewall logic during EWRC
  let outer_rmw_km = rmw_km * 2.5;
  let outer_w_ty = 0;
  let inner_w_ty = cvmax;

  if (ewrcState === "forming" || ewrcState === "max_decay") {
      inner_w_ty = cvmax * (1.0 - ewrcProgress * 0.4); 
      outer_w_ty = cvmax * (0.5 + ewrcProgress * 0.4);
  } else if (ewrcState === "recovering_success" || ewrcState === "recovering_failure") {
      inner_w_ty = 0; // old eye dissipated
      outer_w_ty = cvmax;
      // New eye contracts
      outer_rmw_km = outer_rmw_km - (outer_rmw_km - Math.min(rmw_km * 1.5, 25.0)) * ewrcProgress;
  }

  if (ewrcState !== "none" && ewrcState !== "completed") {
      // Double eyewall blending
      if (distKm < rmw_km) {
          const eyeExponent = orgFactor >= 0.7 ? 1.5 : 0.8;
          w_ty = inner_w_ty * Math.pow(distKm / rmw_km, eyeExponent);
      } else if (distKm < outer_rmw_km) {
          // Gap between inner and outer
          const gapFraction = (distKm - rmw_km) / (outer_rmw_km - rmw_km);
          // Inner eye decay using Holland
          const r_ratio_in = rmw_km / distKm;
          const r_ratio_in_b = Math.pow(r_ratio_in, 1.5);
          const gapWind = inner_w_ty * Math.sqrt(r_ratio_in_b * Math.exp(1.0 - r_ratio_in_b)) * (1.0 - gapFraction);
          
          const outerRamp = outer_w_ty * Math.pow(gapFraction, 2.0);
          w_ty = gapWind + outerRamp;
      } else {
          // Outside outer eye using fluid model
          const b = 2.0 * Math.log(34 / (outer_w_ty * 1.6487)) / Math.log(outer_rmw_km / r34_eff);
          const b_eff = Math.max(0.5, Math.min(3.0, b));
          const r_ratio = outer_rmw_km / distKm;
          const r_ratio_b = Math.pow(r_ratio, b_eff);
          w_ty = outer_w_ty * Math.sqrt(r_ratio_b * Math.exp(1.0 - r_ratio_b));
          
          if (distKm > r34_eff) {
            const dropFactor = Math.pow(r34_eff / distKm, 2.5);
            w_ty = w_ty * dropFactor;
          }
      }
      return { w_ty, rmw_km: outer_rmw_km };
  }

  if (distKm <= rmw_km) {
    const eyeExponent = orgFactor >= 0.7 ? 1.5 : 0.8;
    w_ty = cvmax * Math.pow(distKm / rmw_km, eyeExponent);
  } else {
    // Fluid model: Holland B profile derivative for smooth natural transitions
    // V(r) = Vmax * sqrt( (Rmw/r)^B * exp(1 - (Rmw/r)^B) )
    // We calculate a distance-dependent B parameter to anchor to reference radii
    const getB = (targetV: number, targetR: number) => {
      if (targetV >= cvmax || targetR <= rmw_km) return 1.5;
      // Approximation for r > rmw: V(r) ≈ Vmax * sqrt(e) * (rmw/r)^(B/2)
      // => B ≈ 2 * ln( V(r) / (Vmax * sqrt(e)) ) / ln(rmw / r)
      const b = 2.0 * Math.log(targetV / (cvmax * 1.6487)) / Math.log(rmw_km / targetR);
      return Math.max(0.5, Math.min(3.0, b));
    };

    let b_eff = 1.5;
    const b34 = getB(34, r34_eff);
    const b50 = getB(50, r50_eff);
    const b64 = getB(64, r64_eff);

    if (distKm >= r50_eff) {
      const f = Math.max(0, Math.min(1.0, (distKm - r50_eff) / Math.max(1, r34_eff - r50_eff)));
      b_eff = b50 * (1 - f) + b34 * f;
    } else if (distKm >= r64_eff) {
      const f = Math.max(0, Math.min(1.0, (distKm - r64_eff) / Math.max(1, r50_eff - r64_eff)));
      b_eff = b64 * (1 - f) + b50 * f;
    } else {
      b_eff = b64;
    }

    const r_ratio = rmw_km / distKm;
    const r_ratio_b = Math.pow(r_ratio, b_eff);
    w_ty = cvmax * Math.sqrt(r_ratio_b * Math.exp(1.0 - r_ratio_b));

    // Natural steep drop-off outside 7-level wind radius (r34)
    if (distKm > r34_eff) {
      const dropFactor = Math.pow(r34_eff / distKm, 2.5);
      w_ty = w_ty * dropFactor;
    }
    if (w_ty < 0.5) w_ty = 0;
  }

  return { w_ty, rmw_km };
};

const getSimulatedScatWind = (
  rawWind: number,
  distKm: number,
  rmw_km: number,
  cvmax: number
): number => {
  const exactCvmax = cvmax;

  let coreReduction = 5 + ((exactCvmax - 30) / (140 - 30)) * 20;
  coreReduction = Math.max(5, Math.min(25, coreReduction));

  const decayScale = rmw_km * 2.2;
  const decayFactor = Math.exp(-Math.pow(distKm / decayScale, 2));

  const reduction = coreReduction * decayFactor;

  let simulated = rawWind - reduction;

  if (rawWind > 15) {
    simulated = Math.max(10, simulated);
  }

  if (distKm < rmw_km * 4.0) {
    const maxAllowed = exactCvmax - (coreReduction * 0.8 * decayFactor);
    if (simulated > maxAllowed) {
      simulated = maxAllowed;
    }
  }

  return Math.max(1.0, simulated);
};

/**
 * Renders a satellite fluid dynamics wind field (HSCAT scatterometer) frame on canvas
 */
export function renderWindFieldVideoFrameOnCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  typhoon: Typhoon,
  currentSimHour: number,
  exportConfig: VideoExportConfig
) {
  const history = typhoon.history || [];
  if (history.length === 0) return;

  // Snaps to the closest discrete historical point to avoid any transition/interpolation and ensure pristine, sharp rendering
  let state = history[0];
  let closestIndex = 0;
  let minDiff = Math.abs(currentSimHour - history[0].simHour);
  for (let i = 1; i < history.length; i++) {
    const diff = Math.abs(currentSimHour - history[i].simHour);
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = i;
    }
  }
  state = history[closestIndex];

  const W = width;
  const H = height;
  const scale = W / 1920;

  // Use a modern, ultra-crisp font stack for technical diagrams
  const fontStyle = `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

  // Ensure high-quality, crisp rendering and prevent anti-aliasing fuzziness
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const mapLeft = 80 * scale; const mapRight = W - 150 * scale;
  const mapTop = 100 * scale; const mapBottom = H - 80 * scale;
  const mapWidth = mapRight - mapLeft; const mapHeight = mapBottom - mapTop;

  ctx.fillStyle = "#0f172a"; ctx.textAlign = "left"; ctx.font = `bold ${Math.round(28 * scale)}px ${fontStyle}`;
  ctx.fillText("Simulated Wind Field Diagram (HSCAT)", mapLeft, 40 * scale);
  
  const pad2 = (n: number) => String(n).padStart(2, "0");
  
  const savedStart = localStorage.getItem("typhoon_sim_start_date");
  const startDate = savedStart ? new Date(savedStart) : new Date("2026-07-21T00:00:00");

  const forecastBaseDate = new Date(startDate.getTime() + state.simHour * 60 * 60 * 1000);
  const yearStr = forecastBaseDate.getUTCFullYear();
  const monthStr = pad2(forecastBaseDate.getUTCMonth() + 1);
  const dayStr = pad2(forecastBaseDate.getUTCDate());
  const hourStr = pad2(forecastBaseDate.getUTCHours());
  const validTimeStr = `${yearStr}/${monthStr}/${dayStr} ${hourStr}00Z`;
  ctx.font = `bold ${Math.round(20 * scale)}px ${fontStyle}`;
  ctx.fillText(`Last Updated: ${validTimeStr} / Valid Time: ${validTimeStr}`, mapLeft, 70 * scale);

  const centerLat = state.lat;
  const cosLat = Math.cos(centerLat * Math.PI / 180);

  // Read wind field actual scan parameters directly from localStorage to keep them perfectly synced!
  const scatZoomSpan = (() => {
    const val = localStorage.getItem("forecast_scatZoomSpan");
    return val ? Number(val) : 12.0;
  })();
  const scatBarbSpacing = (() => {
    const val = localStorage.getItem("forecast_scatBarbSpacing");
    return val ? Number(val) : 0.05;
  })();
  const scatBarbLength = (() => {
    const val = localStorage.getItem("forecast_scatBarbLength");
    return val ? Number(val) : 10.0;
  })();
  const scatBarbWidth = (() => {
    const val = localStorage.getItem("forecast_scatBarbWidth");
    return val ? Number(val) : 1.0;
  })();
  const scatOrbitAngle = (() => {
    const val = localStorage.getItem("forecast_scatOrbitAngle");
    return val ? Number(val) : 15.0;
  })();
  const scatSwathWidth = (() => {
    const val = localStorage.getItem("forecast_scatSwathWidth");
    return val ? Number(val) : 12.0;
  })();
  const scatNadirWidth = (() => {
    const val = localStorage.getItem("forecast_scatNadirWidth");
    return val ? Number(val) : 0.0;
  })();
  const scatBackgroundScale = (() => {
    const val = localStorage.getItem("forecast_scatBackgroundScale");
    return val ? Number(val) : 1.0;
  })();
  const scatterometerLandData = (() => {
    const val = localStorage.getItem("forecast_scatterometerLandData");
    return val !== "false";
  })();
  const showNadirGap = (() => {
    const val = localStorage.getItem("forecast_showNadirGap");
    return val === "true";
  })();

  const baseLonSpan = scatZoomSpan;
  const baseLatSpan = (baseLonSpan * cosLat) * (mapHeight / mapWidth);

  const minLon = state.lon - baseLonSpan / 2;
  const maxLon = state.lon + baseLonSpan / 2;
  const minLat = state.lat - baseLatSpan / 2;
  const maxLat = state.lat + baseLatSpan / 2;

  const latLonToPixel = (lat: number, lon: number) => {
    return {
      x: mapLeft + ((lon - minLon) / (maxLon - minLon)) * mapWidth,
      y: mapBottom - ((lat - minLat) / (maxLat - minLat)) * mapHeight
    };
  };

  ctx.save();
  ctx.beginPath();
  ctx.rect(mapLeft, mapTop, mapWidth, mapHeight);
  ctx.clip();

  // Draw Coastlines ONLY (slightly thicker black lines for high visibility)
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1.6 * scale;
  const drawBorder = (coordinates: number[][][]) => {
    for (const ring of coordinates) {
      ctx.beginPath();
      for (let i = 0; i < ring.length; i++) {
        const pt = latLonToPixel(ring[i][1], ring[i][0]);
        if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    }
  };
  if (landGeoJson && landGeoJson.features) {
    landGeoJson.features.forEach((feat: any) => {
      if (feat.geometry.type === "Polygon") drawBorder(feat.geometry.coordinates);
      else if (feat.geometry.type === "MultiPolygon") feat.geometry.coordinates.forEach(drawBorder);
    });
  }

  // Grid lines: modern, visible gray color, slightly thicker
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 1.5 * scale;
  ctx.setLineDash([4 * scale, 6 * scale]);
  for (let l = Math.floor(minLat); l <= Math.ceil(maxLat); l++) {
    if (l % 5 === 0) {
      const pt = latLonToPixel(l, minLon);
      ctx.beginPath(); ctx.moveTo(mapLeft, pt.y); ctx.lineTo(mapRight, pt.y); ctx.stroke();
      ctx.fillStyle = "#0f172a"; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.font = `bold ${Math.round(18 * scale)}px ${fontStyle}`;
      ctx.fillText(l + "°N", mapLeft - 10 * scale, pt.y);
    }
  }
  for (let l = Math.floor(minLon); l <= Math.ceil(maxLon); l++) {
    if (l % 5 === 0) {
      const pt = latLonToPixel(minLat, l);
      ctx.beginPath(); ctx.moveTo(pt.x, mapTop); ctx.lineTo(pt.x, mapBottom); ctx.stroke();
      ctx.fillStyle = "#0f172a"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.font = `bold ${Math.round(18 * scale)}px ${fontStyle}`;
      ctx.fillText(l + "°E", pt.x, mapBottom + 10 * scale);
    }
  }
  ctx.setLineDash([]);

  // Scatterometer Swath Math
  const orbitAngle = (scatOrbitAngle * Math.PI) / 180;
  const barbGridSize = scatBarbSpacing;
  let maxKt = 0;

  // Increase barb sizes slightly for video/preview to guarantee sharpness and high visibility
  const effectiveBarbWidth = Math.max(1.8, scatBarbWidth);
  const effectiveBarbLength = Math.max(12.0, scatBarbLength);

  const drawBarb = (x: number, y: number, speedKt: number, mathAngleRad: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = effectiveBarbWidth * scale;
    ctx.beginPath();
    const shaftLen = effectiveBarbLength * scale;
    const canvasAngle = -mathAngleRad;
    const tailAngle = canvasAngle + Math.PI;
    const ex = x + Math.cos(tailAngle) * shaftLen;
    const ey = y + Math.sin(tailAngle) * shaftLen;
    ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);

    let remaining = Math.round(speedKt / 5) * 5;
    let curX = ex; let curY = ey;
    const barbSpacing = 4 * scale;
    const nx = Math.sin(canvasAngle);
    const ny = -Math.cos(canvasAngle);
    const stepX = Math.cos(canvasAngle) * barbSpacing;
    const stepY = Math.sin(canvasAngle) * barbSpacing;

    while (remaining >= 50) {
      ctx.stroke(); // Draw shaft segment before flag
      ctx.beginPath(); // Isolate the triangle path
      ctx.moveTo(curX, curY);
      ctx.lineTo(curX + nx * 10 * scale, curY + ny * 10 * scale);
      ctx.lineTo(curX + stepX * 0.8, curY + stepY * 0.8);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      
      ctx.beginPath(); // Re-initialize path for the rest of the wind barb
      curX += stepX; curY += stepY;
      remaining -= 50;
    }
    while (remaining >= 10) {
      ctx.moveTo(curX, curY);
      ctx.lineTo(curX + nx * 10 * scale, curY + ny * 10 * scale);
      curX += stepX; curY += stepY;
      remaining -= 10;
    }
    if (remaining >= 5) {
      ctx.moveTo(curX, curY);
      ctx.lineTo(curX + nx * 5 * scale, curY + ny * 5 * scale);
    }
    ctx.stroke();
  };

  const getColorForKt = (kt: number) => {
    if (kt < 5) return "#000000";
    if (kt < 10) return "#00CCFF";
    if (kt < 15) return "#0033FF";
    if (kt < 20) return "#00CC00";
    if (kt < 25) return "#FFFF00";
    if (kt < 30) return "#FF8080";
    if (kt < 35) return "#FF0000";
    if (kt < 40) return "#B07040";
    if (kt < 45) return "#FF00FF";
    if (kt < 50) return "#800080";
    if (kt < 55) return "#8B0000";
    if (kt < 60) return "#730000";
    return "#FF8C00";
  };

  const clat = state.lat;
  const clon = state.lon;
  const cvmax = Number((state.vmax * 1.9438).toFixed(1));

  const radSnap = {
    r34: (state as any)?.r7 || (state as any)?.r34 || (typhoon as any)?.r7,
    r50: (state as any)?.r10 || (state as any)?.r50 || (typhoon as any)?.r10,
    r64: (state as any)?.r12 || (state as any)?.r64 || (typhoon as any)?.r12,
    ewrcCount: (state as any)?.ewrcCount
  };

  const dLat = maxLat - minLat;
  const dLon = maxLon - minLon;
  const maxDist = Math.sqrt(dLat * dLat + dLon * dLon);

  const safeStep = Math.max(0.01, barbGridSize);
  const barbsToDraw: Array<{
    x: number;
    y: number;
    speed: number;
    angle: number;
    color: string;
    distKm: number;
  }> = [];

  const uMin = -maxDist * 1.5;
  const uMax = maxDist * 1.5;
  const vMin = -scatSwathWidth;
  const vMax = scatSwathWidth;

  const totalStepsU = Math.ceil((uMax - uMin) / safeStep);

  for (let i = 0; i <= totalStepsU; i++) {
    const u = uMin + i * safeStep;
    for (let v = vMin; v <= vMax; v += safeStep) {
      const seedRandom = (x: number, y: number) => {
        const sx = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
        return sx - Math.floor(sx);
      };
      const rnd = seedRandom(u, v);
      
      if (rnd > 0.94) continue;
      
      const jitterU = (seedRandom(u + 0.1, v) - 0.5) * safeStep * 0.45;
      const jitterV = (seedRandom(u, v + 0.1) - 0.5) * safeStep * 0.45;

      const glat = clat + (u + jitterU) * Math.sin(orbitAngle) + (v + jitterV) * Math.cos(orbitAngle);
      const glon = clon + (u + jitterU) * Math.cos(orbitAngle) - (v + jitterV) * Math.sin(orbitAngle);

      if (glat < minLat - 0.25 || glat > maxLat + 0.25 || glon < minLon - 0.25 || glon > maxLon + 0.25) {
        continue;
      }

      const distToOrbit = Math.abs(v);
      if (showNadirGap && distToOrbit < scatNadirWidth) continue;

      const dxKm = (glon - clon) * Math.cos(clat * Math.PI / 180) * 111;
      const dyKm = (glat - clat) * 111;
      const distKm = Math.sqrt(dxKm * dxKm + dyKm * dyKm);

      if (distKm < 1200) {
        const { w_ty, rmw_km: local_rmw } = getTyphoonWindSpeed(distKm, Math.atan2(dyKm, dxKm), cvmax, radSnap, false, (state as any).ewrcState || "none", (state as any).ewrcProgress || 0);
        const isLand = checkPointOnLandGeoJson(glat, glon);

        if (!scatterometerLandData && isLand) {
          continue;
        }

        let eff_w_ty = w_ty;
        if (isLand) {
          eff_w_ty *= 0.75;
          const elev = getProceduralElevation(glat, glon);
          if (elev > 100) {
            eff_w_ty *= Math.max(0.4, 1.0 - (elev / 2000));
          }
        }

        const angleToPt = Math.atan2(dyKm, dxKm);
        const inflowRad = 0.31;
        const tyWindDir = angleToPt + Math.PI / 2 - inflowRad;

        const headingRad = state.direction * Math.PI / 180;
        const relativeAngle = angleToPt - headingRad;
        const r34_eff = Math.max(35, getAngularRadius(radSnap.r34, angleToPt, 220));
        const asymFade = Math.max(0, 1.0 - Math.max(0, distKm - r34_eff) / (r34_eff * 0.5));
        const translationAsymmetry = 1.0 + 0.12 * Math.sin(relativeAngle) * Math.min(1.0, state.speed / 28.0) * asymFade;

        const u_ty = eff_w_ty * Math.cos(tyWindDir) * translationAsymmetry;
        const v_ty = eff_w_ty * Math.sin(tyWindDir) * translationAsymmetry;

        let u_env = -8;
        let v_env = 2;

        if (glat < 20) {
          u_env = -10 - Math.sin((glon - 110) * 0.05) * 3;
          v_env = 1 + Math.cos((glat - 15) * 0.1) * 2;
        } else if (glat > 28) {
          // Light 10m surface background wind
          u_env = -1.5 + Math.sin(glat * 0.3 + glon * 0.2) * 1.5;
          v_env = 0.5 + Math.cos(glat * 0.2 - glon * 0.3) * 1.5;
        } else {
          const frac = (glat - 20) / 8;
          const u_high = -1.5 + Math.sin(glat * 0.3 + glon * 0.2) * 1.5;
          const v_high = 0.5 + Math.cos(glat * 0.2 - glon * 0.3) * 1.5;
          u_env = (-10) * (1 - frac) + (u_high) * frac;
          v_env = (1) * (1 - frac) + (v_high) * frac;
        }

        if (glat < clat + 1 && glon < clon + 3) {
          const mDist = Math.hypot(glon - (clon - 4), glat - (clat - 4));
          const mWeight = Math.max(0, 1 - mDist / 8);
          u_env += mWeight * 4;
          v_env += mWeight * 3;
        }

        if (glon > clon + 2 && glat < 32) {
          const eWeight = Math.min(1.0, (glon - clon) / 6);
          u_env -= eWeight * 2;
          v_env += eWeight * 2;
        }

        const envMag = Math.hypot(u_env, v_env);
        const MAX_ENV_MAG = 18.0;
        if (envMag > MAX_ENV_MAG) {
          const capScale = MAX_ENV_MAG / envMag;
          u_env *= capScale;
          v_env *= capScale;
        }

        if (isLand) {
          u_env *= 0.65;
          v_env *= 0.65;
        }

        let u_total = u_ty + u_env * scatBackgroundScale;
        let v_total = v_ty + v_env * scatBackgroundScale;

        const noiseFactor = 0.88 + seedRandom(u + 0.2, v + 0.2) * 0.24;
        u_total *= noiseFactor;
        v_total *= noiseFactor;

        const w_total_raw = Math.sqrt(u_total * u_total + v_total * v_total);
        let w_total = getSimulatedScatWind(w_total_raw, distKm, local_rmw, cvmax);

        // Outside 7-level wind radius (r34), enforce total wind to drop below 25kt
        if (distKm > r34_eff) {
          const distRatio = (distKm - r34_eff) / (r34_eff * 0.5);
          const maxAllowedWind = Math.max(18.0, 34.0 - distRatio * 16.0);
          if (w_total > maxAllowedWind) {
            w_total = maxAllowedWind;
          }
        }

        if (w_total > 5.0) {
          const upLat = glat - (v_total / w_total_raw) * 0.65;
          const upLon = glon - (u_total / w_total_raw) * 0.65;
          if (checkPointOnLandGeoJson(upLat, upLon)) {
            w_total *= 0.76;
            const upLat2 = glat - (v_total / w_total_raw) * 0.65 * 2.2;
            const upLon2 = glon - (u_total / w_total_raw) * 0.65 * 2.2;
            if (checkPointOnLandGeoJson(upLat2, upLon2)) {
              w_total *= 0.80;
            }
          }
        }

        const windDirRadTotal = Math.atan2(v_total, u_total);

        if (w_total > maxKt) maxKt = w_total;

        const pt = latLonToPixel(glat, glon);
        barbsToDraw.push({
          x: pt.x,
          y: pt.y,
          speed: w_total,
          angle: windDirRadTotal,
          color: getColorForKt(w_total),
          distKm: distKm
        });
      }
    }
  }

  barbsToDraw.sort((a, b) => a.y - b.y);

  barbsToDraw.forEach(barb => {
    drawBarb(barb.x, barb.y, barb.speed, barb.angle, barb.color);
  });

  ctx.restore();

  ctx.fillStyle = "#0f172a"; ctx.textAlign = "right"; ctx.font = `bold ${Math.round(18 * scale)}px ${fontStyle}`;
  ctx.fillText(`Max. Wind: ${maxKt.toFixed(1)}kt`, mapRight, 70 * scale);

  // Colorbar on the right
  const cbLeft = mapRight + 20 * scale;
  const cbTop = mapTop;
  const cbWidth = 25 * scale;
  const cbHeight = mapHeight;
  const levels = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65];
  const segmentHeight = cbHeight / (levels.length - 1);

  for (let i = 0; i < levels.length - 1; i++) {
    ctx.fillStyle = getColorForKt(levels[i] + 0.1);
    const y = cbTop + cbHeight - (i+1) * segmentHeight;

    if (i === 0) {
      ctx.beginPath();
      ctx.moveTo(cbLeft, y);
      ctx.lineTo(cbLeft + cbWidth, y);
      ctx.lineTo(cbLeft + cbWidth/2, cbTop + cbHeight + 20 * scale);
      ctx.fill(); ctx.stroke();
    } else if (i === levels.length - 2) {
      ctx.beginPath();
      ctx.moveTo(cbLeft, y + segmentHeight);
      ctx.lineTo(cbLeft + cbWidth, y + segmentHeight);
      ctx.lineTo(cbLeft + cbWidth/2, cbTop - 20 * scale);
      ctx.fill(); ctx.stroke();
    } else {
      ctx.fillRect(cbLeft, y, cbWidth, segmentHeight);
      ctx.strokeRect(cbLeft, y, cbWidth, segmentHeight);
    }

    ctx.fillStyle = "#0f172a";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${Math.round(16 * scale)}px ${fontStyle}`;
    ctx.fillText(levels[i].toString(), cbLeft + cbWidth + 10 * scale, cbTop + cbHeight - i * segmentHeight);
  }
  ctx.fillText("65", cbLeft + cbWidth + 10 * scale, cbTop);

  // Station label "晚风气象台"
  ctx.fillStyle = "#1e3a8a"; ctx.textAlign = "right"; ctx.font = `bold ${Math.round(24 * scale)}px ${fontStyle}`;
  ctx.fillText("晚风气象台", mapRight - 20 * scale, mapTop + 40 * scale);
  ctx.font = `bold ${Math.round(20 * scale)}px ${fontStyle}`;
  ctx.fillText(`${forecastBaseDate.getMonth()+1}月${forecastBaseDate.getDate()}日${forecastBaseDate.getHours().toString().padStart(2, '0')}时制作`, mapRight - 20 * scale, mapTop + 70 * scale);

  ctx.strokeStyle = "#000000"; ctx.lineWidth = 2 * scale; ctx.strokeRect(mapLeft, mapTop, mapWidth, mapHeight);

  // Legend
  const legX = mapLeft + 20 * scale; const legY = mapBottom - 360 * scale;
  const legW = 220 * scale; const legH = 340 * scale;
  ctx.fillStyle = "#F8F9FA"; ctx.fillRect(legX, legY, legW, legH); ctx.strokeRect(legX, legY, legW, legH);
  ctx.fillStyle = "#0f172a"; ctx.textAlign = "left"; ctx.font = `bold ${Math.round(22 * scale)}px ${fontStyle}`;
  ctx.fillText("图例", legX + 20 * scale, legY + 30 * scale);

  const wItems = [
    { c: "#00CCFF", l: "6级" },
    { c: "#0066FF", l: "7级" },
    { c: "#0000CC", l: "8级" },
    { c: "#FFCC00", l: "9级" },
    { c: "#FF9900", l: "10级" },
    { c: "#FF6666", l: "11级" },
    { c: "#FF0000", l: "12级" },
    { c: "#CC0000", l: "13级及以上" }
  ];

  wItems.forEach((item, idx) => {
    ctx.fillStyle = item.c;
    ctx.fillRect(legX + 20 * scale, legY + 50 * scale + idx * 35 * scale, 40 * scale, 20 * scale);
    ctx.strokeRect(legX + 20 * scale, legY + 50 * scale + idx * 35 * scale, 40 * scale, 20 * scale);
    ctx.fillStyle = "#0f172a"; ctx.font = `bold ${Math.round(18 * scale)}px ${fontStyle}`;
    ctx.fillText(item.l, legX + 70 * scale, legY + 66 * scale + idx * 35 * scale);
  });
}
