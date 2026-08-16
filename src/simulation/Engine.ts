/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Typhoon, TyphoonState, TyphoonCategory, SimulationConfig, EventLog, StationReading } from "../types";
import { loadGSHHGFullData, getGSHHGFullLandMasses, GSHHGLandMass } from "./GSHHGData";
import { landGeoJson, checkPointOnLandGeoJson, getLandfallCountryGeoJson, getDistanceToLandGeoJson } from "./NaturalEarthLoader";
export { checkPointOnLandGeoJson, getLandfallCountryGeoJson, getDistanceToLandGeoJson };

// Automatically trigger GSHHS_f_L1 loading on module initialization
loadGSHHGFullData();

/**
 * Real historical wind radii reference table for 7, 10, 12-level winds based on max wind speed (vmax in m/s)
 */
export function getStandardAverageWindRadii(vmax: number): { r7: number; r10: number; r12: number } {
  if (vmax < 17.2) { // 7级 (13.9 - 17.1 m/s)
    return { r7: 0, r10: 0, r12: 0 };
  } else if (vmax < 20.8) { // 8级 (17.2 - 20.7 m/s)
    return { r7: 180, r10: 0, r12: 0 };
  } else if (vmax < 24.5) { // 9级 (20.8 - 24.4 m/s)
    return { r7: 200, r10: 0, r12: 0 };
  } else if (vmax < 28.5) { // 10级 (24.5 - 28.4 m/s)
    return { r7: 230, r10: 70, r12: 0 };
  } else if (vmax < 32.7) { // 11级 (28.5 - 32.6 m/s)
    return { r7: 260, r10: 100, r12: 0 };
  } else if (vmax < 37.0) { // 12级 (32.7 - 36.9 m/s)
    return { r7: 315, r10: 120, r12: 50 };
  } else if (vmax < 41.5) { // 13级 (37.0 - 41.4 m/s)
    return { r7: 335, r10: 135, r12: 70 };
  } else if (vmax < 46.2) { // 14级 (41.5 - 46.1 m/s)
    return { r7: 350, r10: 145, r12: 80 };
  } else if (vmax < 51.0) { // 15级 (46.2 - 50.9 m/s)
    return { r7: 370, r10: 155, r12: 90 };
  } else if (vmax < 56.1) { // 16级 (51.0 - 56.0 m/s)
    return { r7: 375, r10: 160, r12: 95 };
  } else if (vmax <= 68.0) { // 17级及部分17级以上 (56.1 - 68.0 m/s)
    return { r7: 380, r10: 165, r12: 100 };
  } else { // 18级及以上 (> 68 m/s)
    const extra = vmax - 68.0;
    return {
      r7: Math.round(380 + extra * 1.5),
      r10: Math.round(165 + extra * 1.0),
      r12: Math.round(100 + extra * 0.8)
    };
  }
}

// Seed-based PRNG
export class SeededRandom {
  private state: number;

  constructor(seedStr: string) {
    this.state = this.hashString(seedStr);
  }

  private hashString(str: string): number {
    let hash = 0;
    if (str.length === 0) return 123456789;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash) || 123456789;
  }

  public next(): number {
    // Standard LCG or simple sine hash
    const x = Math.sin(this.state++) * 10000;
    return x - Math.floor(x);
  }

  public nextRange(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

// Bounding box / simplified polygon representing mainlands & islands
export interface LandMass {
  name: string;
  isMountain: boolean;
  maxElevation: number; // meters
  polygon: [number, number][]; // [lat, lon]
  bbox?: { minLat: number; maxLat: number; minLon: number; maxLon: number };
}

// Helper to calculate bounding box for fast spatial indexing
function withBBox(land: LandMass): LandMass {
  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
  for (const p of land.polygon) {
    if (p[0] < minLat) minLat = p[0];
    if (p[0] > maxLat) maxLat = p[0];
    if (p[1] < minLon) minLon = p[1];
    if (p[1] > maxLon) maxLon = p[1];
  }
  return { ...land, bbox: { minLat, maxLat, minLon, maxLon } };
}

// Dynamic getter for GSHHG FULL Resolution (f) Level 1 landmasses
export function getGSHHGFullLandArray(): LandMass[] {
  const masses = getGSHHGFullLandMasses();
  return masses.map((m) => ({
    name: m.name || `GSHHS_f_L1_${m.id}`,
    isMountain: m.isMountain,
    maxElevation: m.maxElevation,
    polygon: m.polygon,
    bbox: m.bbox
  }));
}

export const PACIFIC_OCEAN_LAND: LandMass[] = new Proxy([] as LandMass[], {
  get(target, prop, receiver) {
    const arr = getGSHHGFullLandArray();
    if (prop === "length") return arr.length;
    if (prop === "forEach") return arr.forEach.bind(arr);
    if (prop === "map") return arr.map.bind(arr);
    if (prop === "some") return arr.some.bind(arr);
    if (prop === "filter") return arr.filter.bind(arr);
    if (prop === "find") return arr.find.bind(arr);
    if (typeof prop === "symbol" || !isNaN(Number(prop))) {
      return Reflect.get(arr, prop, receiver);
    }
    return Reflect.get(arr, prop, receiver);
  }
});

export const EAST_ASIA_LAND = PACIFIC_OCEAN_LAND;

const LEGACY_LAND_UNUSED: LandMass[] = [
  {
    name: "欧亚大陆主陆 (GSHHG Full Resolution: 全球欧亚及西伯利亚/欧洲)",
    isMountain: true,
    maxElevation: 3500,
    polygon: [
      [1.2, 103.8], [3.1, 101.4], [5.0, 95.0], [8.0, 77.0], [13.0, 80.0], [20.0, 72.0], [25.0, 62.0], [12.0, 44.0], [30.0, 32.0],
      [36.0, -9.5], [43.0, -9.5], [48.0, -4.0], [54.0, 5.0], [60.0, 5.0], [71.0, 28.0], [75.0, 60.0],
      [75.0, 100.0], [75.0, 170.0], [66.0, 180.0], [60.0, 170.0], [58.0, 160.0], [53.0, 141.0], [48.0, 140.0],
      [43.0, 132.0], [40.0, 124.0], [39.0, 121.5], [37.0, 122.5], [35.0, 119.5], [32.0, 121.5], [30.0, 122.0],
      [28.0, 121.5], [26.0, 119.8], [24.0, 118.0], [22.5, 114.0], [21.5, 110.0], [20.5, 106.5], [16.0, 108.5], [10.0, 105.0]
    ]
  },
  {
    name: "朝鲜半岛与辽东半岛",
    isMountain: true,
    maxElevation: 2744,
    polygon: [
      [39.8, 123.5], [38.5, 124.8], [37.5, 126.5], [36.5, 126.3], [34.3, 126.0], [34.3, 127.5],
      [35.1, 129.1], [36.0, 129.4], [38.2, 128.6], [40.0, 127.6], [42.0, 130.2], [43.0, 131.9],
      [45.0, 137.0], [48.0, 140.0], [53.0, 140.5], [54.0, 123.5]
    ]
  },
  {
    name: "台湾岛",
    isMountain: true,
    maxElevation: 3952,
    polygon: [
      [21.90, 120.85], [22.00, 120.72], [22.25, 120.60], [22.45, 120.40], [22.65, 120.25],
      [23.00, 120.08], [23.50, 120.12], [24.05, 120.35], [24.60, 120.75], [25.05, 121.00],
      [25.28, 121.45], [25.29, 121.55], [25.15, 121.80], [25.02, 122.00], [24.75, 121.85],
      [24.40, 121.82], [24.00, 121.65], [23.50, 121.45], [23.00, 121.32], [22.75, 121.15],
      [22.40, 120.90], [21.95, 120.90], [21.90, 120.85]
    ]
  },
  {
    name: "海南岛",
    isMountain: true,
    maxElevation: 1840,
    polygon: [
      [18.22, 109.52], [18.35, 109.15], [18.48, 108.62], [18.80, 108.65], [19.12, 108.58],
      [19.45, 108.92], [19.78, 109.15], [19.98, 109.55], [20.12, 110.25], [20.15, 110.58],
      [20.11, 110.95], [20.00, 111.02], [19.60, 110.80], [19.22, 110.55], [18.82, 110.45],
      [18.42, 110.12], [18.25, 109.75], [18.22, 109.52]
    ]
  },
  {
    name: "崇明岛与舟山群岛",
    isMountain: false,
    maxElevation: 508,
    polygon: [
      [29.5, 122.0], [30.0, 122.5], [30.8, 121.8], [31.5, 121.5], [31.7, 121.8], [31.2, 122.1], [29.8, 122.3]
    ]
  },
  {
    name: "香港与大屿山沿海",
    isMountain: true,
    maxElevation: 957,
    polygon: [
      [22.15, 113.85], [22.25, 113.82], [22.35, 113.90], [22.55, 114.30], [22.35, 114.40], [22.20, 114.25]
    ]
  },
  {
    name: "南海诸岛 (西沙/南沙/东沙/黄岩岛)",
    isMountain: false,
    maxElevation: 20,
    polygon: [
      [7.5, 111.5], [10.0, 115.5], [15.2, 117.8], [16.8, 112.5], [20.7, 116.8], [16.0, 111.5], [8.0, 110.0]
    ]
  },
  {
    name: "吕宋岛 (菲律宾)",
    isMountain: true,
    maxElevation: 2928,
    polygon: [
      [12.5, 124.0], [13.5, 122.2], [13.6, 120.6], [14.5, 120.2], [15.8, 119.8], [16.4, 119.8],
      [17.5, 120.4], [18.6, 120.6], [18.6, 122.1], [17.2, 122.4], [16.0, 122.2], [14.2, 122.4],
      [13.8, 123.7], [12.8, 124.2]
    ]
  },
  {
    name: "棉兰老岛 (菲律宾)",
    isMountain: true,
    maxElevation: 2954,
    polygon: [
      [5.5, 125.1], [6.8, 124.3], [7.5, 122.2], [8.1, 122.8], [8.7, 124.6], [9.8, 125.4],
      [8.0, 126.4], [6.3, 126.2], [5.8, 125.6]
    ]
  },
  {
    name: "米沙鄢群岛与萨马岛",
    isMountain: true,
    maxElevation: 2465,
    polygon: [
      [12.5, 124.2], [11.0, 125.7], [10.1, 125.2], [9.3, 124.5], [9.1, 123.2], [10.5, 122.3],
      [11.8, 121.9], [11.5, 123.2], [11.5, 124.5], [12.2, 123.6]
    ]
  },
  {
    name: "巴拉望岛",
    isMountain: true,
    maxElevation: 2086,
    polygon: [
      [8.3, 117.2], [9.5, 118.3], [11.4, 119.5], [10.2, 118.9], [9.0, 117.7]
    ]
  },
  {
    name: "日本九州岛",
    isMountain: true,
    maxElevation: 1791,
    polygon: [
      [31.0, 130.6], [31.4, 130.1], [32.2, 130.2], [32.8, 130.4], [33.2, 129.7], [33.9, 130.9],
      [33.2, 131.8], [31.5, 131.4]
    ]
  },
  {
    name: "日本四国岛",
    isMountain: true,
    maxElevation: 1982,
    polygon: [
      [32.7, 132.5], [33.4, 132.1], [34.1, 133.0], [34.4, 134.1], [34.2, 134.8], [33.5, 134.5],
      [32.8, 134.1]
    ]
  },
  {
    name: "日本本州岛",
    isMountain: true,
    maxElevation: 3776,
    polygon: [
      [34.2, 135.1], [34.6, 133.5], [34.3, 132.4], [34.0, 130.9], [34.8, 131.5], [35.5, 133.0],
      [35.7, 135.2], [36.8, 136.7], [37.2, 137.3], [38.0, 139.2], [40.0, 139.9], [41.2, 140.3],
      [41.5, 141.4], [40.5, 141.7], [38.3, 141.1], [35.7, 140.8], [34.9, 139.8], [35.3, 138.7],
      [34.6, 136.9]
    ]
  },
  {
    name: "日本北海道岛",
    isMountain: true,
    maxElevation: 2291,
    polygon: [
      [41.5, 140.0], [42.3, 140.3], [43.2, 140.3], [45.4, 141.6], [44.3, 143.3], [44.4, 145.3],
      [43.3, 145.8], [42.9, 144.3], [42.0, 143.3], [42.3, 140.9]
    ]
  },
  {
    name: "琉球群岛与南西诸岛 (冲绳/宫古/石垣)",
    isMountain: true,
    maxElevation: 503,
    polygon: [
      [24.0, 123.5], [24.5, 124.0], [24.8, 125.3], [26.1, 127.6], [26.8, 128.3], [28.3, 129.5],
      [28.0, 129.8], [26.5, 128.1], [24.3, 124.2]
    ]
  },
  {
    name: "关岛与马里亚纳群岛",
    isMountain: true,
    maxElevation: 965,
    polygon: [
      [13.2, 144.6], [13.6, 144.9], [14.1, 145.2], [15.2, 145.8], [18.0, 145.8], [20.0, 145.5],
      [18.2, 145.0], [15.0, 145.3], [13.3, 144.5]
    ]
  },
  {
    name: "库页岛/萨哈林岛与勘察加半岛",
    isMountain: true,
    maxElevation: 4750,
    polygon: [
      [45.9, 142.0], [46.5, 143.5], [51.0, 156.0], [56.0, 162.0], [60.0, 166.0], [56.0, 160.0],
      [51.0, 143.0], [45.9, 142.0]
    ]
  },
  {
    name: "阿留申群岛与白令海沿海",
    isMountain: true,
    maxElevation: 3108,
    polygon: [
      [51.5, 178.0], [53.0, -168.0], [55.0, -162.0], [58.0, -158.0], [56.0, -160.0], [52.0, -172.0], [51.0, 175.0]
    ]
  },
  {
    name: "千岛群岛",
    isMountain: true,
    maxElevation: 2339,
    polygon: [
      [43.8, 145.5], [45.0, 148.0], [48.0, 153.0], [50.8, 156.5], [50.5, 156.2], [47.5, 152.5], [43.5, 145.0]
    ]
  },
  {
    name: "加里曼丹岛/婆罗洲",
    isMountain: true,
    maxElevation: 4095,
    polygon: [
      [-4.0, 110.0], [-3.0, 115.0], [-4.0, 119.0], [1.0, 119.0], [4.0, 118.0], [6.0, 116.0],
      [4.0, 113.0], [1.5, 109.5]
    ]
  },
  {
    name: "苏门答腊岛",
    isMountain: true,
    maxElevation: 3805,
    polygon: [
      [5.5, 95.3], [2.5, 98.0], [-1.0, 101.5], [-5.5, 105.0], [-4.5, 103.5], [-0.5, 100.0],
      [3.0, 96.5]
    ]
  },
  {
    name: "爪哇岛与小巽他群岛",
    isMountain: true,
    maxElevation: 3726,
    polygon: [
      [-6.0, 105.2], [-6.2, 107.0], [-7.0, 110.0], [-7.5, 114.5], [-8.5, 116.0], [-8.8, 125.0],
      [-10.2, 124.0], [-8.5, 114.2], [-6.8, 105.8]
    ]
  },
  {
    name: "苏拉威西岛",
    isMountain: true,
    maxElevation: 3478,
    polygon: [
      [1.5, 124.8], [0.5, 120.0], [-3.0, 119.0], [-5.5, 119.5], [-5.0, 120.5], [-3.0, 121.0],
      [-1.0, 123.5], [1.2, 125.2]
    ]
  },
  {
    name: "新几内亚岛 (巴布亚新几内亚)",
    isMountain: true,
    maxElevation: 4884,
    polygon: [
      [-0.8, 131.0], [-2.5, 135.0], [-3.0, 141.0], [-9.5, 147.0], [-10.5, 150.0], [-8.0, 143.0],
      [-5.0, 138.0], [-2.0, 132.0]
    ]
  },
  {
    name: "所罗门群岛与瓦努阿图",
    isMountain: true,
    maxElevation: 2335,
    polygon: [
      [-6.5, 156.0], [-8.5, 158.0], [-10.5, 162.0], [-15.5, 167.0], [-19.5, 169.5], [-18.0, 168.5],
      [-14.0, 166.0], [-8.0, 156.5]
    ]
  },
  {
    name: "新喀里多尼亚",
    isMountain: true,
    maxElevation: 1628,
    polygon: [
      [-20.0, 164.0], [-21.5, 165.5], [-22.5, 167.0], [-22.0, 166.5], [-20.5, 164.5]
    ]
  },
  {
    name: "斐济与汤加群岛",
    isMountain: true,
    maxElevation: 1324,
    polygon: [
      [-16.0, 177.0], [-18.0, 178.0], [-21.0, -175.0], [-19.0, -174.0], [-16.5, 179.0]
    ]
  },
  {
    name: "萨摩亚与大溪地/法属波利尼西亚",
    isMountain: true,
    maxElevation: 2241,
    polygon: [
      [-13.5, -172.5], [-14.5, -170.5], [-17.5, -149.5], [-18.0, -149.0], [-13.8, -171.5]
    ]
  },
  {
    name: "夏威夷群岛",
    isMountain: true,
    maxElevation: 4207,
    polygon: [
      [18.9, -155.8], [20.0, -155.5], [20.3, -156.5], [21.3, -157.8], [22.2, -159.5],
      [21.8, -159.3], [20.8, -156.8], [19.2, -155.0]
    ]
  },
  {
    name: "澳大利亚大陆全境及塔斯马尼亚",
    isMountain: true,
    maxElevation: 2228,
    polygon: [
      [-12.0, 130.0], [-11.0, 136.0], [-15.0, 136.0], [-17.5, 140.0], [-10.8, 142.5], [-18.0, 146.0],
      [-25.0, 153.0], [-34.0, 151.2], [-38.0, 145.0], [-43.5, 147.0], [-43.0, 145.0], [-38.0, 140.0],
      [-34.0, 135.0], [-32.0, 125.0], [-34.0, 115.0], [-20.0, 115.0], [-14.0, 126.0]
    ]
  },
  {
    name: "新西兰南北岛",
    isMountain: true,
    maxElevation: 3724,
    polygon: [
      [-34.5, 172.5], [-37.0, 175.0], [-41.0, 176.0], [-46.5, 169.0], [-45.0, 166.5], [-41.0, 172.0]
    ]
  },
  {
    name: "美洲大陆全境 (GSHHG Full Resolution: 北美、中美与南美)",
    isMountain: true,
    maxElevation: 6961,
    polygon: [
      [72.0, -168.0], [70.0, -140.0], [60.0, -140.0], [55.0, -130.0], [48.0, -124.5], [38.0, -123.0],
      [32.0, -117.0], [23.0, -110.0], [15.0, -92.0], [8.5, -83.0], [2.0, -79.0], [-5.0, -81.0],
      [-18.0, -70.0], [-35.0, -72.0], [-56.0, -67.0], [-30.0, -50.0], [0.0, -50.0], [10.0, -60.0],
      [25.0, -80.0], [45.0, -60.0], [60.0, -60.0], [72.0, -100.0]
    ]
  }
];

// Optimized Helper: Bounding-box pre-filtering + Point in Polygon algorithm
export function checkPointInPolygon(lat: number, lon: number, polygon: [number, number][], bbox?: { minLat: number; maxLat: number; minLon: number; maxLon: number }): boolean {
  if (bbox) {
    if (lat < bbox.minLat || lat > bbox.maxLat || lon < bbox.minLon || lon > bbox.maxLon) {
      return false;
    }
  }
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][1], yi = polygon[i][0];
    const xj = polygon[j][1], yj = polygon[j][0];

    const intersect = ((yi > lat) !== (yj > lat))
        && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Calculates high-precision geographic elevation (meters) based on real East Asia topography.
 * Combines distance ratio curves with major mountain range ridges and high-frequency deterministic fractal noise.
 */
function getPreciseElevation(
  lat: number,
  lon: number,
  landName: string,
  baseElevation: number,
  distRatio: number
): number {
  let peakAdded = 0;

  // 1. Taiwan Central Mountain Range (中央山脉) - peaks up to 3952m
  if (lat >= 21.8 && lat <= 25.5 && lon >= 120.0 && lon <= 122.2) {
    const distToRidge = distToSegment(lat, lon, 22.0, 120.8, 25.3, 121.6);
    if (distToRidge < 0.6) {
      const ridgeFactor = 1.0 - (distToRidge / 0.6);
      peakAdded = Math.max(peakAdded, 3952 * ridgeFactor * Math.sin(Math.PI * (lat - 21.8) / 3.7));
    }
  }

  // 2. Mt. Fuji & Japanese Alps (日本阿尔卑斯山脉与富士山) - 3776m and 2800m
  if (lat >= 33.5 && lat <= 38.0 && lon >= 135.0 && lon <= 140.5) {
    const distToFuji = Math.sqrt(Math.pow(lat - 35.36, 2) + Math.pow(lon - 138.73, 2));
    if (distToFuji < 0.3) {
      const fujiFactor = 1.0 - (distToFuji / 0.3);
      peakAdded = Math.max(peakAdded, 3776 * fujiFactor);
    }

    const distToAlps = distToSegment(lat, lon, 35.0, 137.5, 36.8, 138.0);
    if (distToAlps < 0.5) {
      const alpsFactor = 1.0 - (distToAlps / 0.5);
      peakAdded = Math.max(peakAdded, 2800 * alpsFactor);
    }
  }

  // 3. Fujian Wuyi Mountains (武夷山脉) - peaks up to 2158m
  if (lat >= 24.5 && lat <= 28.5 && lon >= 115.5 && lon <= 119.5) {
    const distToWuyi = distToSegment(lat, lon, 25.5, 116.5, 28.2, 118.5);
    if (distToWuyi < 0.8) {
      const wuyiFactor = 1.0 - (distToWuyi / 0.8);
      peakAdded = Math.max(peakAdded, 2158 * wuyiFactor * Math.sin(Math.PI * (lat - 24.5) / 4.0));
    }
  }

  // 4. Luzon Cordillera Central (吕宋岛科迪勒拉山脉) - up to 2928m
  if (lat >= 15.0 && lat <= 19.0 && lon >= 119.8 && lon <= 122.5) {
    const distToCordillera = distToSegment(lat, lon, 15.8, 120.8, 18.5, 121.0);
    if (distToCordillera < 0.6) {
      const cordFactor = 1.0 - (distToCordillera / 0.6);
      peakAdded = Math.max(peakAdded, 2928 * cordFactor);
    }
  }

  // 5. Hainan Wuzhi Mountain (海南五指山) - up to 1840m
  if (lat >= 18.2 && lat <= 20.2 && lon >= 108.5 && lon <= 111.0) {
    const distToWuzhi = Math.sqrt(Math.pow(lat - 18.9, 2) + Math.pow(lon - 109.7, 2));
    if (distToWuzhi < 0.5) {
      const wuzhiFactor = 1.0 - (distToWuzhi / 0.5);
      peakAdded = Math.max(peakAdded, 1840 * wuzhiFactor);
    }
  }

  // 6. Korean Taebaek Mountains (朝鲜半岛太白山脉) - up to 1915m
  if (lat >= 34.5 && lat <= 41.5 && lon >= 126.5 && lon <= 130.0) {
    const distToTaebaek = distToSegment(lat, lon, 35.5, 128.8, 40.5, 127.5);
    if (distToTaebaek < 0.7) {
      const taebaekFactor = 1.0 - (distToTaebaek / 0.7);
      peakAdded = Math.max(peakAdded, 1915 * taebaekFactor);
    }
  }

  // 7. Mindanao Mt. Apo (棉兰老岛阿波火山) - up to 2954m
  if (lat >= 5.5 && lat <= 9.0 && lon >= 124.0 && lon <= 126.8) {
    const distToApo = Math.sqrt(Math.pow(lat - 7.0, 2) + Math.pow(lon - 125.4, 2));
    if (distToApo < 0.4) {
      const apoFactor = 1.0 - (distToApo / 0.4);
      peakAdded = Math.max(peakAdded, 2954 * apoFactor);
    }
  }

  // 7b. Palau Islands Peak - up to 242m
  if (lat >= 7.0 && lat <= 7.8 && lon >= 134.0 && lon <= 135.0) {
    const distToPalau = Math.sqrt(Math.pow(lat - 7.4, 2) + Math.pow(lon - 134.5, 2));
    if (distToPalau < 0.2) {
      const palauFactor = 1.0 - (distToPalau / 0.2);
      peakAdded = Math.max(peakAdded, 242 * palauFactor);
    }
  }

  // 7c. Yap Islands Peak - up to 178m
  if (lat >= 9.1 && lat <= 9.8 && lon >= 137.7 && lon <= 138.5) {
    const distToYap = Math.sqrt(Math.pow(lat - 9.5, 2) + Math.pow(lon - 138.1, 2));
    if (distToYap < 0.2) {
      const yapFactor = 1.0 - (distToYap / 0.2);
      peakAdded = Math.max(peakAdded, 178 * yapFactor);
    }
  }

  // 7d. Chuuk Islands Peak - up to 443m
  if (lat >= 7.0 && lat <= 7.7 && lon >= 151.4 && lon <= 152.2) {
    const distToChuuk = Math.sqrt(Math.pow(lat - 7.3, 2) + Math.pow(lon - 151.8, 2));
    if (distToChuuk < 0.25) {
      const chuukFactor = 1.0 - (distToChuuk / 0.25);
      peakAdded = Math.max(peakAdded, 443 * chuukFactor);
    }
  }

  // 7e. Nanling Mountains (华南沿海屏障南岭山脉) - up to 1902m (石坑崆)
  if (lat >= 24.0 && lat <= 26.5 && lon >= 110.0 && lon <= 114.5) {
    const distToNanling = distToSegment(lat, lon, 24.5, 110.5, 25.5, 114.0);
    if (distToNanling < 0.7) {
      const nanlingFactor = 1.0 - (distToNanling / 0.7);
      peakAdded = Math.max(peakAdded, 1902 * nanlingFactor);
    }
  }

  // 7f. Mount Tai (山东泰山) - up to 1545m
  if (lat >= 35.8 && lat <= 36.6 && lon >= 116.8 && lon <= 117.6) {
    const distToTai = Math.sqrt(Math.pow(lat - 36.25, 2) + Math.pow(lon - 117.1, 2));
    if (distToTai < 0.3) {
      const taiFactor = 1.0 - (distToTai / 0.3);
      peakAdded = Math.max(peakAdded, 1545 * taiFactor);
    }
  }

  // 7g. Mount Asahi (日本北海道旭岳) - up to 2291m
  if (lat >= 43.0 && lat <= 44.2 && lon >= 142.0 && lon <= 143.5) {
    const distToAsahi = Math.sqrt(Math.pow(lat - 43.66, 2) + Math.pow(lon - 142.85, 2));
    if (distToAsahi < 0.45) {
      const asahiFactor = 1.0 - (distToAsahi / 0.45);
      peakAdded = Math.max(peakAdded, 2291 * asahiFactor);
    }
  }

  // Combine base estimation and mountain peaks
  let elevation = Math.max(baseElevation, peakAdded);

  // 8. Add high-frequency terrain noise (simulates ravines, hills, and valleys)
  const f1 = Math.sin(lat * 37.3) * Math.sin(lon * 43.1) * 110;
  const f2 = Math.cos(lat * 79.7) * Math.sin(lon * 83.2) * 55;
  const f3 = Math.sin(lat * 183.5) * Math.cos(lon * 194.2) * 20;
  const localNoise = f1 + f2 + f3;

  // Fade out noise near the shores to ensure beaches/harbors are flat
  const fadeFactor = Math.min(distRatio * 5.0, 1.0);
  elevation += localNoise * fadeFactor;

  return Math.max(10, Math.round(elevation));
}

// 1. Precise, procedural mountain elevation profiles for West Pacific landmasses
const PROCEDURAL_MOUNTAIN_RANGES = [
  // Taiwan (Central Mountain Range) - Peaks up to 3952m
  { name: "Central Mountain Range (Taiwan)", peakLat: 23.8, peakLon: 121.0, maxElevation: 3952, radiusX: 0.8, radiusY: 1.8 },
  // Hainan (Wuzhi Mountain) - Peaks up to 1867m
  { name: "Wuzhi Mountain (Hainan)", peakLat: 18.9, peakLon: 109.7, maxElevation: 1867, radiusX: 0.7, radiusY: 0.5 },
  // Luzon Central Mountains (Philippines) - Peaks up to 2928m
  { name: "Cordillera Central (Luzon)", peakLat: 16.8, peakLon: 121.0, maxElevation: 2928, radiusX: 0.9, radiusY: 2.2 },
  // Honshu Alps & Fuji (Japan) - Peaks up to 3776m
  { name: "Japanese Alps & Mt Fuji (Honshu)", peakLat: 35.8, peakLon: 138.2, maxElevation: 3776, radiusX: 2.5, radiusY: 3.5 },
  // Jeju Island (Mount Hallasan) - Peaks up to 1947m
  { name: "Mt Hallasan (Jeju)", peakLat: 33.36, peakLon: 126.53, maxElevation: 1947, radiusX: 0.25, radiusY: 0.15 },
  // Korean Peninsula (Taebaek Mountains) - Peaks up to 1708m
  { name: "Taebaek Mountains", peakLat: 37.8, peakLon: 128.5, maxElevation: 1708, radiusX: 1.2, radiusY: 2.5 },
  // Kyushu Mountains (Japan) - Peaks up to 1700m
  { name: "Kyushu Mountains", peakLat: 32.4, peakLon: 130.8, maxElevation: 1700, radiusX: 0.8, radiusY: 1.0 },
  // Hokkaido Mountains (Japan) - Peaks up to 2291m
  { name: "Hokkaido Mountains", peakLat: 43.4, peakLon: 142.5, maxElevation: 2291, radiusX: 1.5, radiusY: 1.5 },
  // Mindanao (Mount Apo) - Peaks up to 2954m
  { name: "Mt Apo (Mindanao)", peakLat: 7.0, peakLon: 125.2, maxElevation: 2954, radiusX: 1.0, radiusY: 1.2 },
  // Sumatra (Barisan Mountains) - Peaks up to 3800m
  { name: "Barisan Mountains (Sumatra)", peakLat: -1.0, peakLon: 101.0, maxElevation: 3800, radiusX: 3.0, radiusY: 6.0 },
  // Southeast China (Wuyi Mountains) - Peaks up to 2158m
  { name: "Wuyi Mountains", peakLat: 27.5, peakLon: 117.5, maxElevation: 2158, radiusX: 2.5, radiusY: 3.0 },
  // South China (Nanling Mountains) - Peaks up to 1900m
  { name: "Nanling Mountains", peakLat: 25.0, peakLon: 113.0, maxElevation: 1900, radiusX: 3.0, radiusY: 2.0 },
  // Kamchatka Peninsula (Klyuchevskaya Sopka) - Peaks up to 4750m
  { name: "Kamchatka Volcanoes", peakLat: 56.0, peakLon: 160.5, maxElevation: 4750, radiusX: 2.0, radiusY: 5.0 }
];

export function getProceduralElevation(lat: number, lon: number): number {
  let elevation = 100; // Base land elevation is 100m
  for (const range of PROCEDURAL_MOUNTAIN_RANGES) {
    const dx = (lon - range.peakLon) / range.radiusX;
    const dy = (lat - range.peakLat) / range.radiusY;
    const distSq = dx * dx + dy * dy;
    if (distSq < 1.0) {
      // Gaussian scaling from peak center
      const currentElevation = range.maxElevation * Math.exp(-distSq * 1.5);
      if (currentElevation > elevation) {
        elevation = currentElevation;
      }
    }
  }
  return Math.round(elevation);
}

// Get filtered landmasses based on GSHHG Full Resolution (f) dataset
export function getFilteredLandMasses(coastlineSource?: string): LandMass[] {
  return getGSHHGFullLandArray();
}

interface CoastalCity {
  n: string;
  p: string;
  c: string;
  lat: number;
  lon: number;
}

const COASTAL_CITIES: CoastalCity[] = [
  // Special Administrative Regions
  { n: "香港", p: "特别行政区", c: "中国", lat: 22.32, lon: 114.17 },
  { n: "澳门", p: "特别行政区", c: "中国", lat: 22.19, lon: 113.54 },

  // Hainan
  { n: "海口市", p: "海南省", c: "中国", lat: 20.03, lon: 110.33 },
  { n: "文昌市", p: "海南省", c: "中国", lat: 19.61, lon: 110.79 },
  { n: "琼海市", p: "海南省", c: "中国", lat: 19.24, lon: 110.47 },
  { n: "万宁市", p: "海南省", c: "中国", lat: 18.80, lon: 110.39 },
  { n: "陵水县", p: "海南省", c: "中国", lat: 18.48, lon: 110.04 },
  { n: "三亚市", p: "海南省", c: "中国", lat: 18.25, lon: 109.51 },
  { n: "东方市", p: "海南省", c: "中国", lat: 19.10, lon: 108.65 },
  { n: "儋州市", p: "海南省", c: "中国", lat: 19.52, lon: 109.57 },

  // Guangdong
  { n: "徐闻县", p: "广东省", c: "中国", lat: 20.33, lon: 110.18 },
  { n: "雷州市", p: "广东省", c: "中国", lat: 20.91, lon: 110.10 },
  { n: "湛江市", p: "广东省", c: "中国", lat: 21.27, lon: 110.36 },
  { n: "吴川市", p: "广东省", c: "中国", lat: 21.44, lon: 110.78 },
  { n: "茂名市", p: "广东省", c: "中国", lat: 21.66, lon: 110.92 },
  { n: "阳西县", p: "广东省", c: "中国", lat: 21.75, lon: 111.62 },
  { n: "阳江市", p: "广东省", c: "中国", lat: 21.85, lon: 111.98 },
  { n: "台山市", p: "广东省", c: "中国", lat: 21.93, lon: 112.79 },
  { n: "珠海市", p: "广东省", c: "中国", lat: 22.27, lon: 113.58 },
  { n: "中山市", p: "广东省", c: "中国", lat: 22.52, lon: 113.52 },
  { n: "广州市(南沙)", p: "广东省", c: "中国", lat: 22.71, lon: 113.60 },
  { n: "深圳市", p: "广东省", c: "中国", lat: 22.54, lon: 114.06 },
  { n: "惠州市", p: "广东省", c: "中国", lat: 22.75, lon: 114.45 },
  { n: "海丰县", p: "广东省", c: "中国", lat: 22.97, lon: 115.33 },
  { n: "汕尾市", p: "广东省", c: "中国", lat: 22.78, lon: 115.36 },
  { n: "陆丰市", p: "广东省", c: "中国", lat: 22.94, lon: 115.65 },
  { n: "惠来县", p: "广东省", c: "中国", lat: 23.03, lon: 116.29 },
  { n: "汕头市", p: "广东省", c: "中国", lat: 23.35, lon: 116.68 },
  { n: "潮州市", p: "广东省", c: "中国", lat: 23.66, lon: 116.63 },

  // Guangxi
  { n: "北海市", p: "广西壮族自治区", c: "中国", lat: 21.48, lon: 109.12 },
  { n: "钦州市", p: "广西壮族自治区", c: "中国", lat: 21.95, lon: 108.62 },
  { n: "防城港市", p: "广西壮族自治区", c: "中国", lat: 21.61, lon: 108.35 },

  // Fujian
  { n: "诏安县", p: "福建省", c: "中国", lat: 23.72, lon: 117.17 },
  { n: "东山县", p: "福建省", c: "中国", lat: 23.70, lon: 117.43 },
  { n: "漳浦县", p: "福建省", c: "中国", lat: 24.12, lon: 117.61 },
  { n: "龙海区", p: "福建省", c: "中国", lat: 24.44, lon: 117.81 },
  { n: "厦门市", p: "福建省", c: "中国", lat: 24.48, lon: 118.09 },
  { n: "晋江市", p: "福建省", c: "中国", lat: 24.58, lon: 118.55 },
  { n: "石狮市", p: "福建省", c: "中国", lat: 24.73, lon: 118.65 },
  { n: "泉州市", p: "福建省", c: "中国", lat: 24.87, lon: 118.68 },
  { n: "莆田市", p: "福建省", c: "中国", lat: 25.43, lon: 119.01 },
  { n: "平潭县", p: "福建省", c: "中国", lat: 25.50, lon: 119.79 },
  { n: "福清市", p: "福建省", c: "中国", lat: 25.72, lon: 119.38 },
  { n: "长乐区", p: "福建省", c: "中国", lat: 25.96, lon: 119.52 },
  { n: "福州市", p: "福建省", c: "中国", lat: 26.07, lon: 119.30 },
  { n: "连江县", p: "福建省", c: "中国", lat: 26.20, lon: 119.54 },
  { n: "罗源县", p: "福建省", c: "中国", lat: 26.48, lon: 119.55 },
  { n: "宁德市", p: "福建省", c: "中国", lat: 26.66, lon: 119.52 },
  { n: "霞浦县", p: "福建省", c: "中国", lat: 26.88, lon: 120.00 },
  { n: "福鼎市", p: "福建省", c: "中国", lat: 27.32, lon: 120.21 },

  // Zhejiang
  { n: "苍南县", p: "浙江省", c: "中国", lat: 27.52, lon: 120.40 },
  { n: "平阳县", p: "浙江省", c: "中国", lat: 27.66, lon: 120.55 },
  { n: "瑞安市", p: "浙江省", c: "中国", lat: 27.78, lon: 120.65 },
  { n: "温州市", p: "浙江省", c: "中国", lat: 27.99, lon: 120.70 },
  { n: "乐清市", p: "浙江省", c: "中国", lat: 28.12, lon: 120.96 },
  { n: "玉环市", p: "浙江省", c: "中国", lat: 28.13, lon: 121.12 },
  { n: "温岭市", p: "浙江省", c: "中国", lat: 28.36, lon: 121.36 },
  { n: "台州市", p: "浙江省", c: "中国", lat: 28.66, lon: 121.42 },
  { n: "三门县", p: "浙江省", c: "中国", lat: 29.11, lon: 121.39 },
  { n: "象山县", p: "浙江省", c: "中国", lat: 29.48, lon: 121.87 },
  { n: "宁波市", p: "浙江省", c: "中国", lat: 29.87, lon: 121.54 },
  { n: "舟山市", p: "浙江省", c: "中国", lat: 29.99, lon: 122.21 },
  { n: "平湖市", p: "浙江省", c: "中国", lat: 30.68, lon: 121.02 },

  // Shanghai
  { n: "金山区", p: "上海市", c: "中国", lat: 30.74, lon: 121.34 },
  { n: "奉贤区", p: "上海市", c: "中国", lat: 30.91, lon: 121.47 },
  { n: "浦东新区", p: "上海市", c: "中国", lat: 31.22, lon: 121.54 },
  { n: "上海市", p: "上海市", c: "中国", lat: 31.23, lon: 121.47 },
  { n: "崇明区", p: "上海市", c: "中国", lat: 31.62, lon: 121.40 },

  // Jiangsu
  { n: "启东市", p: "江苏省", c: "中国", lat: 31.81, lon: 121.66 },
  { n: "盐城市", p: "江苏省", c: "中国", lat: 33.35, lon: 120.16 },
  { n: "连云港市", p: "江苏省", c: "中国", lat: 34.60, lon: 119.22 },

  // Shandong
  { n: "日照市", p: "山东省", c: "中国", lat: 35.42, lon: 119.52 },
  { n: "青岛市", p: "山东省", c: "中国", lat: 36.07, lon: 120.38 },
  { n: "威海市", p: "山东省", c: "中国", lat: 37.50, lon: 122.12 },
  { n: "烟台市", p: "山东省", c: "中国", lat: 37.54, lon: 121.39 },

  // North
  { n: "滨海新区", p: "天津市", c: "中国", lat: 39.03, lon: 117.68 },
  { n: "秦皇岛市", p: "河北省", c: "中国", lat: 39.94, lon: 119.60 },
  { n: "大连市", p: "辽宁省", c: "中国", lat: 38.91, lon: 121.61 },

  // Taiwan
  { n: "恒春镇", p: "台湾省", c: "中国", lat: 22.00, lon: 120.74 },
  { n: "高雄市", p: "台湾省", c: "中国", lat: 22.63, lon: 120.30 },
  { n: "台东县", p: "台湾省", c: "中国", lat: 22.76, lon: 121.15 },
  { n: "台南市", p: "台湾省", c: "中国", lat: 23.00, lon: 120.23 },
  { n: "澎湖县", p: "台湾省", c: "中国", lat: 23.57, lon: 119.57 },
  { n: "花莲县", p: "台湾省", c: "中国", lat: 23.98, lon: 121.61 },
  { n: "台中市", p: "台湾省", c: "中国", lat: 24.15, lon: 120.68 },
  { n: "宜兰县", p: "台湾省", c: "中国", lat: 24.76, lon: 121.76 },
  { n: "台北市", p: "台湾省", c: "中国", lat: 25.03, lon: 121.57 },
  { n: "基隆市", p: "台湾省", c: "中国", lat: 25.13, lon: 121.74 },

  // Japan
  { n: "石垣市", p: "冲绳县", c: "日本", lat: 24.34, lon: 124.16 },
  { n: "宫古岛市", p: "冲绳县", c: "日本", lat: 24.81, lon: 125.28 },
  { n: "那霸市", p: "冲绳县", c: "日本", lat: 26.21, lon: 127.68 },
  { n: "奄美市", p: "鹿儿岛县", c: "日本", lat: 28.37, lon: 129.49 },
  { n: "屋久岛町", p: "鹿儿岛县", c: "日本", lat: 30.34, lon: 130.51 },
  { n: "鹿儿岛市", p: "鹿儿岛县", c: "日本", lat: 31.60, lon: 130.56 },
  { n: "宫崎市", p: "宫崎县", c: "日本", lat: 31.91, lon: 131.42 },
  { n: "长崎市", p: "长崎县", c: "日本", lat: 32.75, lon: 129.87 },
  { n: "土佐清水市", p: "高知县", c: "日本", lat: 32.78, lon: 132.95 },
  { n: "熊本市", p: "熊本县", c: "日本", lat: 32.80, lon: 130.70 },
  { n: "高知市", p: "高知县", c: "日本", lat: 33.56, lon: 133.53 },
  { n: "福冈市", p: "福冈县", c: "日本", lat: 33.59, lon: 130.40 },
  { n: "松山市", p: "爱媛县", c: "日本", lat: 33.84, lon: 132.76 },
  { n: "串本町(潮岬)", p: "和歌山县", c: "日本", lat: 33.43, lon: 135.78 },
  { n: "和歌山市", p: "和歌山县", c: "日本", lat: 34.23, lon: 135.17 },
  { n: "广岛市", p: "广岛县", c: "日本", lat: 34.38, lon: 132.45 },
  { n: "大阪市", p: "大阪府", c: "日本", lat: 34.69, lon: 135.50 },
  { n: "神户市", p: "兵库县", c: "日本", lat: 34.69, lon: 135.19 },
  { n: "静冈市", p: "静冈县", c: "日本", lat: 34.98, lon: 138.38 },
  { n: "馆山市", p: "千叶县", c: "日本", lat: 34.99, lon: 139.86 },
  { n: "横滨市", p: "神奈川县", c: "日本", lat: 35.44, lon: 139.63 },
  { n: "东京", p: "东京都", c: "日本", lat: 35.68, lon: 139.65 },
  { n: "仙台市", p: "宫城县", c: "日本", lat: 38.27, lon: 140.87 },
  { n: "函馆市", p: "北海道", c: "日本", lat: 41.77, lon: 140.72 },

  // Korea
  { n: "西归浦市", p: "济州特别自治道", c: "韩国", lat: 33.25, lon: 126.56 },
  { n: "济州市", p: "济州特别自治道", c: "韩国", lat: 33.50, lon: 126.53 },
  { n: "木浦市", p: "全罗南道", c: "韩国", lat: 34.81, lon: 126.39 },
  { n: "丽水市", p: "全罗南道", c: "韩国", lat: 34.76, lon: 127.66 },
  { n: "统营市", p: "庆尚南道", c: "韩国", lat: 34.85, lon: 128.42 },
  { n: "昌原市", p: "庆尚南道", c: "韩国", lat: 35.15, lon: 128.68 },
  { n: "釜山市", p: "广域市", c: "韩国", lat: 35.18, lon: 129.08 },
  { n: "蔚山市", p: "广域市", c: "韩国", lat: 35.54, lon: 129.31 },
  { n: "浦项市", p: "庆尚北道", c: "韩国", lat: 36.02, lon: 129.37 },
  { n: "江陵市", p: "江原道", c: "韩国", lat: 37.75, lon: 128.90 },
  { n: "束草市", p: "江原道", c: "韩国", lat: 38.20, lon: 128.59 },
  { n: "仁川广域市", p: "广域市", c: "韩国", lat: 37.45, lon: 126.70 },
  { n: "首尔", p: "特别市", c: "韩国", lat: 37.57, lon: 126.98 },

  // Philippines
  { n: "巴士古镇", p: "巴坦群岛省", c: "菲律宾", lat: 20.45, lon: 121.97 },
  { n: "阿帕里镇", p: "卡加延省", c: "菲律宾", lat: 18.36, lon: 121.64 },
  { n: "卡塔曼市", p: "北萨马省", c: "菲律宾", lat: 12.50, lon: 124.64 },
  { n: "马尼拉市", p: "大马尼拉区", c: "菲律宾", lat: 14.60, lon: 120.98 },

  // Vietnam
  { n: "岘港市", p: "直辖市", c: "越南", lat: 16.05, lon: 108.20 },
  { n: "海防市", p: "直辖市", c: "越南", lat: 20.84, lon: 106.69 }
];

function getClosestCity(lat: number, lon: number, filterCountry: string, filterProvince?: string): string {
  let bestCity: typeof COASTAL_CITIES[0] | null = null;
  let minDist = 999999;
  const cosLat = Math.cos((lat * Math.PI) / 180);

  for (const c of COASTAL_CITIES) {
    if (filterCountry && c.c !== filterCountry) continue;
    if (filterProvince && c.p !== filterProvince) continue;
    const dLat = c.lat - lat;
    const dLon = (c.lon - lon) * cosLat;
    const dist = dLat * dLat + dLon * dLon;
    if (dist < minDist) {
      minDist = dist;
      bestCity = c;
    }
  }

  // Fallback if country/province filter yielded no match
  if (!bestCity) {
    for (const c of COASTAL_CITIES) {
      const dLat = c.lat - lat;
      const dLon = (c.lon - lon) * cosLat;
      const dist = dLat * dLat + dLon * dLon;
      if (dist < minDist) {
        minDist = dist;
        bestCity = c;
      }
    }
  }

  if (!bestCity) return "沿海地区";

  if (bestCity.c === "中国") {
    if (bestCity.p === "特别行政区") return `中国${bestCity.n}特别行政区`;
    if (bestCity.p === "台湾省") return `中国台湾省${bestCity.n}`;
    return `中国${bestCity.p}${bestCity.n}`;
  }
  return `${bestCity.c}${bestCity.p}${bestCity.n}`;
}

// OSM Nominatim Reverse Geocoding Cache & Fetcher
const osmLocationCache = new Map<string, string>();

export async function fetchOsmCityName(lat: number, lon: number): Promise<string> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  if (osmLocationCache.has(key)) {
    return osmLocationCache.get(key)!;
  }

  const fallback = getDetailedLandName(lat, lon, "", "");

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    // Increase zoom to 12 for better city/district precision
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=12&accept-language=zh-CN`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TyphoonSim/1.1 (Meteorological-Simulation-App)' },
      signal: controller.signal
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const state = addr.state || addr.province || addr.region || addr.municipality || "";
        const city = addr.city || addr.county || addr.town || addr.municipality || addr.district || addr.suburb || "";
        let osmName = "";
        
        if (state && city) {
          // Special handling for municipalities like Shanghai
          if (state.endsWith('市') && city.endsWith('区')) {
             osmName = `${state}${city}`;
          } else {
             osmName = state.includes(city) ? state : `${state}${city}`;
          }
        } else if (city) {
          osmName = city;
        } else if (state) {
          osmName = state;
        } else if (data.display_name) {
          osmName = data.display_name.split(",")[0];
        }

        if (osmName) {
          // Clean up common redundant suffixes for cleaner display
          osmName = osmName.replace(/中华人民共和国/g, '');
          osmLocationCache.set(key, osmName);
          return osmName;
        }
      }
    }
  } catch (e) {
    // Silent catch, fallback
  }

  osmLocationCache.set(key, fallback);
  return fallback;
}

// Centralized highly precise resolver for refined landfall naming in the Northwest Pacific
export function getDetailedLandName(lat: number, lon: number, country: string, admin: string): string {
  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  if (osmLocationCache.has(cacheKey)) {
    return osmLocationCache.get(cacheKey)!;
  }

  const normCountry = country ? country.trim() : "";

  // 1. Hong Kong
  if (lat >= 22.15 && lat <= 22.56 && lon >= 113.80 && lon <= 114.40) {
    return getClosestCity(lat, lon, "中国", "特别行政区");
  }

  // 2. Macao
  if (lat >= 22.08 && lat <= 22.25 && lon >= 113.48 && lon <= 113.65) {
    return getClosestCity(lat, lon, "中国", "特别行政区");
  }

  // 3. Taiwan Island (Strict longitude 120.0 to 122.2 to prevent overlap with Fujian!)
  if (lat >= 21.8 && lat <= 25.4 && lon >= 120.0 && lon <= 122.2) {
    return getClosestCity(lat, lon, "中国", "台湾省");
  }

  // 4. Fujian Province (Longitude 117.0 to 119.9)
  if (lat >= 23.5 && lat <= 27.5 && lon >= 117.0 && lon <= 119.9) {
    return getClosestCity(lat, lon, "中国", "福建省");
  }

  // 5. Shanghai (Prioritize Shanghai municipality bounds over Zhejiang)
  if (lat >= 30.65 && lat <= 31.88 && lon >= 120.85 && lon <= 122.3) {
    return getClosestCity(lat, lon, "中国", "上海市");
  }

  // 6. Zhejiang Province
  if (lat >= 27.1 && lat < 30.65 && lon >= 120.0 && lon <= 122.8) {
    return getClosestCity(lat, lon, "中国", "浙江省");
  }

  // 7. Guangdong
  if (lat >= 20.0 && lat <= 23.8 && lon >= 109.5 && lon <= 117.2) {
    return getClosestCity(lat, lon, "中国", "广东省");
  }

  // 8. Hainan
  if (lat >= 18.0 && lat <= 20.2 && lon >= 108.5 && lon <= 111.1) {
    return getClosestCity(lat, lon, "中国", "海南省");
  }

  // 9. Korea
  if (normCountry === "韩国" || normCountry === "朝鲜" || normCountry === "South Korea" || (lon >= 124.5 && lon <= 130.8 && lat >= 33.0 && lat <= 43.0)) {
    return getClosestCity(lat, lon, "韩国");
  }

  // 10. Japan
  if (normCountry === "日本" || normCountry === "Japan" || (lon >= 123.0 && lon <= 146.0 && lat >= 24.0 && lat <= 46.0 && !(lon <= 130.8 && lat >= 33.0 && lat <= 43.0))) {
    return getClosestCity(lat, lon, "日本");
  }

  // 11. Philippines
  if (lat >= 4.5 && lat <= 21.2 && lon >= 116.0 && lon <= 127.0) {
    return getClosestCity(lat, lon, "菲律宾");
  }

  // 12. Vietnam
  if (lat >= 8.5 && lat <= 22.0 && lon >= 102.0 && lon <= 110.0) {
    return getClosestCity(lat, lon, "越南");
  }

  // General China
  if (normCountry === "中国" || normCountry === "China") {
    return getClosestCity(lat, lon, "中国");
  }

  return getClosestCity(lat, lon, "中国");
}

const landMetricsCache = new Map<string, { isLand: boolean; elevation: number; landName: string }>();
const distToLandCache = new Map<string, number>();

export function clearLandMetricsCache() {
  landMetricsCache.clear();
  distToLandCache.clear();
}

// Get land fraction and elevation
export function getLandMetrics(lat: number, lon: number, coastlineSource?: string, fastMode: boolean = false): { isLand: boolean; elevation: number; landName: string } {
  const scale = fastMode ? 10 : 50;
  const key = `${Math.round(lat * scale)}_${Math.round(lon * scale)}_${coastlineSource || "default"}_${landGeoJson ? "1" : "0"}_${fastMode ? "F" : "N"}`;
  const cached = landMetricsCache.get(key);
  if (cached) return cached;

  let result: { isLand: boolean; elevation: number; landName: string };

  // Priority check using Natural Earth GeoJSON if loaded
  if (landGeoJson) {
    const isLand = checkPointOnLandGeoJson(lat, lon);
    if (isLand) {
      const countryInfo = getLandfallCountryGeoJson(lat, lon);
      const rawCountry = countryInfo ? countryInfo.country : "陆地";
      const rawAdmin = countryInfo ? countryInfo.admin : "";
      const landName = getDetailedLandName(lat, lon, rawCountry, rawAdmin);
      const elevation = getProceduralElevation(lat, lon);
      result = { isLand: true, elevation, landName };
      landMetricsCache.set(key, result);
      return result;
    }
  }

  // Fallback check on GSHHG bounding grids & polygons
  const lands = getFilteredLandMasses(coastlineSource);
  for (const land of lands) {
    if (checkPointInPolygon(lat, lon, land.polygon, land.bbox)) {
      // Calculate distance to polygon boundary as a proxy for elevation ramping up in central mountains
      let minDist = 999;
      const polyLen = land.polygon.length;
      const step = polyLen > 10000 ? 50 : (polyLen > 1000 ? 10 : 1);
      for (let i = 0; i < polyLen; i += step) {
        const p1 = land.polygon[i];
        const p2 = land.polygon[(i + step) % polyLen];
        if (Math.abs(p1[0] - lat) > 2.0 && Math.abs(p2[0] - lat) > 2.0) continue;
        if (Math.abs(p1[1] - lon) > 2.0 && Math.abs(p2[1] - lon) > 2.0) continue;
        const dist = distToSegment(lat, lon, p1[0], p1[1], p2[0], p2[1]);
        if (dist < minDist) minDist = dist;
      }
      
      const distRatio = Math.min(minDist / 1.5, 1.0); // 1.5 degrees is max slope distance
      const baseElevation = land.isMountain ? land.maxElevation * distRatio : 100;
      const elevation = getPreciseElevation(lat, lon, land.name, baseElevation, distRatio);
      const landName = getDetailedLandName(lat, lon, land.name, "");
      result = { isLand: true, elevation, landName };
      landMetricsCache.set(key, result);
      return result;
    }
  }
  result = { isLand: false, elevation: 0, landName: "海洋" };
  landMetricsCache.set(key, result);
  if (landMetricsCache.size > 20000) {
    const firstKey = landMetricsCache.keys().next().value;
    if (firstKey) landMetricsCache.delete(firstKey);
  }
  return result;
}

// Sample terrain elevation across the entire 12-level wind circle (r12) area
export function getMaxElevationInRadius(lat: number, lon: number, radiusKm: number, coastlineSource?: string): { maxElevation: number; isLandContact: boolean; landCoverage: number } {
  const centerMetrics = getLandMetrics(lat, lon, coastlineSource);
  let maxElevation = centerMetrics.elevation;
  let isLandContact = centerMetrics.isLand;
  let landPoints = centerMetrics.isLand ? 1 : 0;
  
  const sampleRadius = Math.max(20, radiusKm);
  const sampleRings = [0.4, 0.7, 1.0];
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];
  let totalSamples = 1 + sampleRings.length * angles.length;
  
  for (const ring of sampleRings) {
    const r = sampleRadius * ring;
    for (const angleDeg of angles) {
      const angleRad = (angleDeg * Math.PI) / 180;
      const dLat = (r * Math.cos(angleRad)) / 111.12;
      const dLon = (r * Math.sin(angleRad)) / (111.12 * Math.cos((lat * Math.PI) / 180));
      const m = getLandMetrics(lat + dLat, lon + dLon, coastlineSource);
      if (m.isLand) {
        isLandContact = true;
        landPoints++;
        if (m.elevation > maxElevation) {
          maxElevation = m.elevation;
        }
      }
    }
  }
  
  const landCoverage = landPoints / totalSamples;
  return { maxElevation, isLandContact, landCoverage };
}

// Get minimum distance to any land polygon (in degrees)

export function getLandCoverage(lat: number, lon: number, radiusKm: number, coastlineSource?: string): number {
  if (radiusKm <= 0) return 0;
  let landPoints = 0;
  const totalPoints = 16;
  for (let i = 0; i < totalPoints; i++) {
    const angle = (i / totalPoints) * Math.PI * 2;
    const r = radiusKm * 0.7; // sample at 70% of radius
    const dLat = (r * Math.cos(angle)) / 111.0;
    const dLon = (r * Math.sin(angle)) / (111.0 * Math.cos(lat * Math.PI / 180));
    if (getLandMetrics(lat + dLat, lon + dLon, coastlineSource).isLand) {
      landPoints++;
    }
  }
  return landPoints / totalPoints;
}

export function getDistanceToLand(lat: number, lon: number, coastlineSource?: string, fastMode: boolean = false): number {
  if (getLandMetrics(lat, lon, coastlineSource, fastMode).isLand) return 0;
  const scale = fastMode ? 10 : 50;
  const key = `${Math.round(lat * scale)}_${Math.round(lon * scale)}_${coastlineSource || "default"}_${fastMode ? "F" : "N"}`;
  const cached = distToLandCache.get(key);
  if (cached !== undefined) return cached;

  let minDistance = 999;
  if (landGeoJson) {
    minDistance = getDistanceToLandGeoJson(lat, lon);
  } else {
    const lands = getFilteredLandMasses(coastlineSource);
    for (const land of lands) {
      // Bounding box pre-filter to skip distant landmasses instantly
      let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
      for (let i = 0; i < land.polygon.length; i++) {
        const p = land.polygon[i];
        if (p[0] < minLat) minLat = p[0];
        if (p[0] > maxLat) maxLat = p[0];
        if (p[1] < minLon) minLon = p[1];
        if (p[1] > maxLon) maxLon = p[1];
      }
      if (lat < minLat - minDistance || lat > maxLat + minDistance ||
          lon < minLon - minDistance || lon > maxLon + minDistance) {
        continue;
      }

      const polyLen = land.polygon.length;
      const step = polyLen > 10000 ? 50 : (polyLen > 1000 ? 10 : 1);
      for (let i = 0; i < polyLen; i += step) {
        const p1 = land.polygon[i];
        const p2 = land.polygon[(i + step) % polyLen];
        if (Math.abs(p1[0] - lat) > minDistance && Math.abs(p2[0] - lat) > minDistance) continue;
        if (Math.abs(p1[1] - lon) > minDistance && Math.abs(p2[1] - lon) > minDistance) continue;
        const dist = distToSegment(lat, lon, p1[0], p1[1], p2[0], p2[1]);
        if (dist < minDistance) {
          minDistance = dist;
        }
      }
    }
  }
  distToLandCache.set(key, minDistance);
  if (distToLandCache.size > 10000) {
    const firstKey = distToLandCache.keys().next().value;
    if (firstKey) distToLandCache.delete(firstKey);
  }
  return minDistance;
}

function distToSegment(x: number, y: number, x1: number, y1: number, x2: number, y2: number): number {
  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  if (lenSq !== 0) param = dot / lenSq;

  let xx, yy;
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = x - xx;
  const dy = y - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

// Convert wind speed m/s to central pressure hPa using interpolation:
// 18 m/s -> 997 hPa
// 68 m/s -> 901 hPa
export function calculatePressure(vmax: number): number {
  if (vmax <= 18.0) {
    // Interpolate between 0 m/s (1012 hPa) and 18 m/s (997 hPa)
    return Math.round(1012 - 15 * (vmax / 18.0));
  } else if (vmax <= 68.0) {
    // Interpolate between 18 m/s (997 hPa) and 68 m/s (901 hPa)
    return Math.round(997 - 1.92 * (vmax - 18.0));
  } else {
    // Extrapolate for vmax > 68 m/s (up to 80 m/s which is 878 hPa)
    return Math.round(901 - 1.92 * (vmax - 68.0));
  }
}

// Check if the 10-level wind circle touches land
export function checkWindCircleTouchLand(lat: number, lon: number, r10: { ne: number; se: number; sw: number; nw: number }, coastlineSource?: string): boolean {
  if (!r10 || r10.ne <= 0) return false;
  
  // Angles: 0(N), 45(NE), 90(E), 135(SE), 180(S), 225(SW), 270(W), 315(NW)
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];
  for (const angleDeg of angles) {
    let r_km = r10.ne;
    if (angleDeg >= 0 && angleDeg < 90) r_km = r10.ne;
    else if (angleDeg >= 90 && angleDeg < 180) r_km = r10.se;
    else if (angleDeg >= 180 && angleDeg < 270) r_km = r10.sw;
    else r_km = r10.nw;
    
    const angleRad = (angleDeg * Math.PI) / 180;
    const dLat = (r_km * Math.cos(angleRad)) / 111.12;
    const dLon = (r_km * Math.sin(angleDeg * Math.PI / 180)) / (111.12 * Math.cos((lat * Math.PI) / 180));
    
    const testLat = lat + dLat;
    const testLon = lon + dLon;
    const testMetrics = getLandMetrics(testLat, testLon, coastlineSource);
    if (testMetrics.isLand) {
      return true;
    }
  }
  return false;
}

// --- Procedural Atmospheric/Oceanic Fields ---

// SST Field Model
export function getSST(lat: number, lon: number, config: SimulationConfig): number {
  // Normalize longitude to standard [-180, 180] range for consistent field models
  let normLon = lon;
  while (normLon < -180) normLon += 360;
  while (normLon > 180) normLon -= 360;

  // Requirement 3: Global zoned SST based on presets
  let baseSST = config.sstBase !== undefined ? config.sstBase : 30.5;
  
  let gradient = config.sstNorthSouthGradient !== undefined ? config.sstNorthSouthGradient : 1.0;
  const pivotLat = config.sstPivotLat !== undefined ? config.sstPivotLat : 29.3;
  
  if (lat > pivotLat) {
    // 1. Calculate drop at pivot using slightly reduced gradient (south of 29.3 gap narrowing)
    const southGradient = gradient * 0.82; 
    const pivotDrop = (0.17 * (pivotLat - 15) + 0.003 * Math.pow(pivotLat - 15, 2)) * southGradient;
    
    // 2. Rapid drop north of pivotLat
    const northDist = lat - pivotLat;
    const rapidDrop = (0.75 * northDist + 0.05 * Math.pow(northDist, 1.85)) * gradient;
    
    baseSST -= (pivotDrop + rapidDrop);
  } else if (lat > 15) {
    // South of 29.3: Slightly narrowed N-S gradient as requested
    const southGradient = gradient * 0.82;
    baseSST -= (0.17 * (lat - 15) + 0.003 * Math.pow(lat - 15, 2)) * southGradient;
  } else {
    // Equatorial regions stay very warm
    baseSST -= 0.06 * (15 - lat);
  }
  
  // Longitude gradient (warmer east, cooler near Chinese mainland)
  const lonOffset = normLon - 137;
  baseSST -= 0.0008 * Math.pow(lonOffset, 2); // Slightly wider warm pool
  if (normLon < 120) {
    baseSST -= 0.04 * (120 - normLon); // subtle shelf cooling
  }

  // Add warm pool boost (Intensified for September peak)
  if (config.warmPoolEnabled && lat >= 6 && lat <= 22 && normLon >= 120 && normLon <= 155) {
    // 2D gaussian-like warm pool spike
    const dLat = (lat - 14.5) / 7;
    const dLon = (normLon - 138) / 15;
    const poolSpike = 1.2 * Math.exp(-(dLat*dLat + dLon*dLon));
    baseSST += poolSpike;
  }

  // Add cold eddy penalty
  if (config.coldEddyEnabled) {
    // Cold eddy around 21°N, 128°E
    const dLat = (lat - 21) / 2.5;
    const dLon = (normLon - 128) / 2.5;
    const eddyDip = 1.6 * Math.exp(-(dLat*dLat + dLon*dLon));
    baseSST -= eddyDip;
  }

  // Add global anomaly
  baseSST += config.sstAnomaly;

  return Math.max(10, Math.min(32.0, baseSST));
}

// Ocean Heat Content (OHC) Field Model
export function getOHC(lat: number, lon: number, config: SimulationConfig, actualSST?: number): number {
  let normLon = lon;
  while (normLon < -180) normLon += 360;
  while (normLon > 180) normLon -= 360;

  const sst = actualSST !== undefined ? actualSST : getSST(lat, normLon, config);
  if (sst < 26.0) return 0;

  // Base OHC proportional to (SST - 26)
  let baseOHC = (sst - 26.0) * 22.0 * config.ohcScale;

  // Warm Pool has deep thermocline, boosting OHC significantly
  if (config.warmPoolEnabled && lat >= 8 && lat <= 22 && normLon >= 125 && normLon <= 152) {
    const distFromCenter = Math.sqrt(Math.pow((lat - 15) / 7, 2) + Math.pow((normLon - 138) / 13, 2));
    if (distFromCenter < 1.0) {
      baseOHC += 45 * (1.0 - distFromCenter);
    }
  }

  return Math.max(0, Math.min(180, baseOHC));
}

// 200-850 hPa Vertical Wind Shear Field Model (Western North Pacific Climatology)
export function getShear(lat: number, lon: number, config: SimulationConfig): number {
  let normLon = lon;
  while (normLon < -180) normLon += 360;
  while (normLon > 180) normLon -= 360;

  const preset = config.shearPreset || 'global_low';
  let baseShear = 8.0;

  if (preset === 'global_low') {
    // Global Low shear baseline (favorable for tropical development 8-14 kt)
    const troughLat = 18.0;
    const distTrough = Math.abs(lat - troughLat);
    baseShear = 6.0 + Math.min(10.0, distTrough * 0.4);

    // Jet stream band to the north
    const jetLat = config.westerliesLat || 32.0;
    if (lat > jetLat - 6.0) {
      const jetDist = Math.abs(lat - jetLat);
      const jetBand = Math.exp(-Math.pow(jetDist / 4.5, 2));
      const jetTail = lat > jetLat ? (lat - jetLat) * 0.8 : 0;
      baseShear += jetBand * 28.0 * (config.westerliesStrength || 1.0) + jetTail;
    }
  } else {
    // Realistic monthly shear distribution
    let monsoonTroughLat = 20.0;
    let jetLat = 38.0;
    let jetPeakShear = 35.0;
    let tuttCells: Array<{ lat: number; lon: number; rLat: number; rLon: number; boost: number }> = [];
    let neMonsoonActive = false;

    switch (preset) {
      case 'january':
        monsoonTroughLat = 5.0;
        jetLat = 25.0;
        jetPeakShear = 48.0;
        neMonsoonActive = true;
        break;
      case 'february':
        monsoonTroughLat = 5.0;
        jetLat = 26.0;
        jetPeakShear = 46.0;
        neMonsoonActive = true;
        break;
      case 'march':
        monsoonTroughLat = 6.0;
        jetLat = 28.0;
        jetPeakShear = 42.0;
        neMonsoonActive = true;
        break;
      case 'april':
        monsoonTroughLat = 8.0;
        jetLat = 30.0;
        jetPeakShear = 38.0;
        break;
      case 'may':
        monsoonTroughLat = 12.0;
        jetLat = 33.0;
        jetPeakShear = 35.0;
        tuttCells = [{ lat: 18.0, lon: 155.0, rLat: 4.0, rLon: 7.0, boost: 16.0 }];
        break;
      case 'june':
        monsoonTroughLat = 18.0;
        jetLat = 39.0;
        jetPeakShear = 32.0;
        tuttCells = [
          { lat: 20.0, lon: 152.0, rLat: 4.5, rLon: 8.0, boost: 18.0 },
          { lat: 24.0, lon: 168.0, rLat: 3.5, rLon: 6.0, boost: 15.0 }
        ];
        break;
      case 'july':
        monsoonTroughLat = 22.0;
        jetLat = 45.0;
        jetPeakShear = 30.0;
        tuttCells = [
          { lat: 22.0, lon: 150.0, rLat: 5.0, rLon: 9.0, boost: 20.0 },
          { lat: 26.0, lon: 166.0, rLat: 4.0, rLon: 7.0, boost: 18.0 }
        ];
        break;
      case 'august':
        monsoonTroughLat = 25.0;
        jetLat = 47.0;
        jetPeakShear = 28.0;
        tuttCells = [
          { lat: 24.0, lon: 148.0, rLat: 5.0, rLon: 10.0, boost: 22.0 },
          { lat: 28.0, lon: 165.0, rLat: 4.0, rLon: 8.0, boost: 18.0 }
        ];
        break;
      case 'september':
        monsoonTroughLat = 20.0;
        jetLat = 41.0;
        jetPeakShear = 34.0;
        tuttCells = [
          { lat: 21.0, lon: 152.0, rLat: 4.5, rLon: 8.0, boost: 18.0 }
        ];
        break;
      case 'october':
        monsoonTroughLat = 15.0;
        jetLat = 35.0;
        jetPeakShear = 38.0;
        neMonsoonActive = true;
        break;
      case 'november':
        monsoonTroughLat = 10.0;
        jetLat = 28.0;
        jetPeakShear = 42.0;
        neMonsoonActive = true;
        break;
      case 'december':
        monsoonTroughLat = 6.0;
        jetLat = 26.0;
        jetPeakShear = 46.0;
        neMonsoonActive = true;
        break;
    }

    // A. Monsoon trough low-shear belt (5 - 12 kt in main trough)
    const distTrough = Math.abs(lat - monsoonTroughLat);
    baseShear = 5.5 + Math.min(10.0, distTrough * 0.45);

    // B. Subtropical Westerly Jet Stream Band (Narrow zonal Gaussian band)
    const jetDist = Math.abs(lat - jetLat);
    const jetFactor = Math.exp(-Math.pow(jetDist / 4.5, 2));
    const jetTail = lat > jetLat ? (lat - jetLat) * 0.7 : 0;
    baseShear += jetFactor * jetPeakShear + jetTail;

    // C. TUTT Cold Low Cells (Discrete high shear pockets in Northwest Pacific)
    for (const cell of tuttCells) {
      const dLat = (lat - cell.lat) / cell.rLat;
      const dLon = (normLon - cell.lon) / cell.rLon;
      const cellDist = Math.sqrt(dLat * dLat + dLon * dLon);
      if (cellDist < 1.0) {
        baseShear += cell.boost * (1.0 - cellDist * cellDist);
      }
    }

    // D. Winter Northeast Monsoon Surge (SCS & East of Philippines high shear)
    if (neMonsoonActive && lat >= 10.0 && lat <= 22.0 && normLon >= 110.0 && normLon <= 126.0) {
      const surgeFactor = Math.sin(((lat - 10.0) / 12.0) * Math.PI) * Math.sin(((normLon - 110.0) / 16.0) * Math.PI);
      baseShear += Math.max(0, surgeFactor * 18.0);
    }
  }

  // Adjust by Subtropical High (Core of ridge is anticyclonic with light shear)
  if (config.subtropicalHighEnabled) {
    const subHighLat = config.subtropicalHighLat || 24.5;
    const subHighLon = config.subtropicalHighLon || 135.0;
    const distSubHigh = Math.sqrt(Math.pow((lat - subHighLat) / 7.0, 2) + Math.pow((normLon - subHighLon) / 14.0, 2));
    if (distSubHigh < 1.0) {
      // Light shear (4-8 kt) near ridge core
      baseShear = baseShear * (0.5 + 0.5 * distSubHigh);
    }
  }

  // Apply user scale slider
  return Math.max(2.0, Math.min(65.0, baseShear * (config.shearScale ?? 1.0)));
}

// Mid-level (700 hPa) Relative Humidity Field Model
export function getRH700(lat: number, lon: number, config: SimulationConfig): number {
  // Tropical zones are moist (70-85%), Subtropical High is dry (40-55%)
  let baseRH = 75.0;

  // Subtropical High dry zone
  if (config.subtropicalHighEnabled) {
    const subHighLat = config.subtropicalHighLat;
    const subHighLon = config.subtropicalHighLon;
    const dLat = (lat - subHighLat) / 6.0;
    const dLon = (lon - subHighLon) / 12.0;
    const dist = Math.sqrt(dLat*dLat + dLon*dLon);
    if (dist < 1.5) {
      const dryEffect = (1.5 - dist) / 1.5;
      baseRH -= 32.0 * dryEffect;
    }
  }

  // Dry continental air from the Northwest (Siberian high runoff / dry air intrusion)
  if (config.dryAirEnabled && lat > 25 && lon < 125) {
    const contInfluence = Math.min((lat - 25) / 15, 1.0) * Math.min((125 - lon) / 15, 1.0);
    baseRH -= 28 * contInfluence;
  }

  return Math.max(15, Math.min(95, baseRH * config.humidityScale));
}

// 500 hPa Geopotential Height (gpm) Model
export function getGeopotentialHeight500(lat: number, lon: number, config: SimulationConfig): number {
  // Standard standard atmospheric gradient: 5880 gpm near tropics, drops northwards
  let baseGpm = 5880;

  // Latitudinal drop
  if (lat > 20) {
    baseGpm -= 4.2 * (lat - 20) + 0.15 * Math.pow(lat - 20, 2);
  } else {
    baseGpm += 0.5 * (20 - lat);
  }

  // Subtropical High ridge amplification (represented as a 5880+ gpm high pressure core)
  if (config.subtropicalHighEnabled) {
    const subHighLat = config.subtropicalHighLat;
    const subHighLon = config.subtropicalHighLon;
    const strength = config.subtropicalHighStrength;
    const westExtend = config.subtropicalHighWestExtent;

    // Subtropical high is an elongated ellipsoid stretching from subHighLon westwards
    const nsSize = config.subtropicalHighNSSize !== undefined ? config.subtropicalHighNSSize : 1.0;
    const dLat = (lat - subHighLat) / (5.0 * nsSize);
    
    // Model elongation westwards
    let dLon = 0;
    if (lon > subHighLon) {
      dLon = (lon - subHighLon) / 8.0;
    } else if (lon >= westExtend) {
      dLon = 0; // flat ridge top
    } else {
      dLon = (westExtend - lon) / 6.0;
    }

    const dist = Math.sqrt(dLat*dLat + dLon*dLon);
    if (dist < 1.8) {
      const heightBonus = 35 * strength * (1.8 - dist) / 1.8;
      baseGpm += heightBonus;
    }
  }

  // Westerlies trough disturbance (cuts into the heights)
  if (config.westerliesEnabled) {
    const troughLon = config.westerliesTroughLon ?? 115.0;
    const depth = config.westerliesTroughDepth ?? 1.0;
    const westLat = config.westerliesLat ?? 30.0;

    if (lat > westLat - 8) {
      // Trough is a wave-like dip: sin/cos shape
      const dLon = lon - troughLon;
      // Trough amplitude peaks at westerliesLat and fades south
      const amplitude = 32 * depth * Math.exp(-Math.pow((lat - westLat)/6, 2));
      const wave = Math.cos((dLon * Math.PI) / 35.0); // wave period 70 degrees
      if (wave > 0) {
        // Trough cuts heights, ridge ahead increases them slightly
        baseGpm -= amplitude * wave;
      } else {
        baseGpm -= amplitude * wave * 0.4;
      }
    }
  }

  return Math.round(baseGpm);
}

// Helper to calculate raw westerlies vector push on typhoon (in m/s)
export function getWesterliesSteeringVector(lat: number, lon: number, config: SimulationConfig): { u: number; v: number } {
  if (!config.westerliesEnabled || (config.westerliesStrength ?? 1.0) <= 0) {
    return { u: 0, v: 0 };
  }
  const westerliesLat = config.westerliesLat ?? 30.0;
  const strength = config.westerliesStrength ?? 1.0;

  if (lat <= westerliesLat - 8.0) {
    return { u: 0, v: 0 };
  }

  const deltaLat = lat - (westerliesLat - 8.0);
  const ratio = Math.max(0, Math.min(1.0, deltaLat / 8.0));
  const smoothRatio = ratio * ratio * (3 - 2 * ratio);
  const uRamp = (5.0 + Math.max(0, lat - westerliesLat) * 1.8) * smoothRatio * strength;

  const troughLon = config.westerliesTroughLon ?? 115.0;
  const depth = config.westerliesTroughDepth ?? 1.0;
  const dLon = lon - troughLon;
  const vWave = Math.sin((dLon * Math.PI) / 35.0) * 10.0 * depth * Math.exp(-Math.pow((lat - westerliesLat) / 8.0, 2));

  return { u: uRamp, v: vWave };
}

// Environmental steering flow (U, V) in m/s at levels 850, 500, 200 hPa
export function getEnvironmentalWind(level: 850 | 500 | 200, lat: number, lon: number, config: SimulationConfig): { u: number; v: number } {
  let u = 0;
  let v = 0;

    // A. Westerlies Flow (west to east flow, U > 0, peaks in upper levels like 200 hPa)
    if (config.westerliesEnabled && (config.westerliesStrength ?? 1.0) > 0) {
      const westerliesLat = config.westerliesLat ?? 30.0;
      const strength = config.westerliesStrength ?? 1.0;

      // Altitude factor for westerlies
      let levelFactor = 1.0;
      if (level === 200) levelFactor = 1.8; // stronger jet stream
      if (level === 850) levelFactor = 0.4; // surface friction

      // Westerlies transition zone: starts 8° south of westerliesLat
      const transitionZone = 8.0; 
      if (lat > westerliesLat - transitionZone) {
        const deltaLat = lat - (westerliesLat - transitionZone);
        const ratio = Math.max(0, Math.min(1.0, deltaLat / transitionZone));
        // Gradually increase from 0 to full strength as it approaches the jet axis
        const smoothRatio = ratio * ratio * (3 - 2 * ratio);
        const rampFlow = (6.0 + Math.max(0, lat - westerliesLat) * 1.5) * smoothRatio * strength; 
        u += rampFlow * levelFactor;
      }

      // Westerlies Trough creates wave-like steering: V < 0 behind trough, V > 0 in front of trough
      const troughLon = config.westerliesTroughLon ?? 115.0;
      const depth = config.westerliesTroughDepth ?? 1.0;
      if (lat > westerliesLat - 8.0) { // start trough influence as typhoon approaches westerlies
        const dLon = lon - troughLon;
        const waveFactor = Math.sin((dLon * Math.PI) / 35.0) * 12.0 * depth * levelFactor;
        v += waveFactor * Math.exp(-Math.pow((lat - westerliesLat) / 8.0, 2));
      }
    }

  // B. Subtropical High Circulation (Clockwise flow around the ridge + boundary suppression)
  if (config.subtropicalHighEnabled) {
    const subHighLat = config.subtropicalHighLat;
    const subHighLon = config.subtropicalHighLon;
    const strength = config.subtropicalHighStrength;
    const westExtend = config.subtropicalHighWestExtent;

    // Standard high is at 500hPa, stronger at 500/850, weaker/reversed at 200 hPa (warm core high has outflow)
    let highFactor = 1.0;
    if (level === 200) highFactor = -0.3; // divergent outflow at upper level
    if (level === 850) highFactor = 0.8;

    // Define distance to ridge line
    const dLat = lat - subHighLat;
    let dLon = 0;
    if (lon > subHighLon) {
      dLon = lon - subHighLon;
    } else if (lon >= westExtend) {
      dLon = 0; // flat ridge
    } else {
      dLon = lon - westExtend;
    }

    const nsSize = config.subtropicalHighNSSize !== undefined ? config.subtropicalHighNSSize : 1.0;
    const latRadius = 6.0 * nsSize;
    const lonRadius = 15.0;

    const rSq = Math.pow(dLat / latRadius, 2) + Math.pow(dLon / lonRadius, 2);
    if (rSq < 20.0) {
      const r = Math.sqrt(rSq);
      // Wind profile: 0 at center, peaks at r=1 (5880 gpm edge), decays outwards
      const windProfile = r * Math.exp(1 - r) * 14.0 * strength * highFactor;

      // Directions
      const angle = Math.atan2(dLat * (lonRadius / latRadius), dLon);
      // Clockwise rotation around ridge perimeter
      let subHighU = Math.sin(angle) * windProfile;
      let subHighV = -Math.cos(angle) * windProfile;

      // Requirement 5 & 6: Remove rigid "wall" hacks and artificial turning.
      // Just rely on the geostrophic wind flow. Natural beta drift and westerlies will govern the escape.
      u += subHighU;
      v += subHighV;
    }
  }

  // C. Monsoon Trough & Easterly Waves at low level (850 hPa)
  if (level === 850) {
    if (config.monsoonTroughEnabled && lat < 16) {
      // Monsoon westerlies south of 12°N, turning to southwest
      if (lat < 12) {
        u += 4.5;
        v += 1.5;
      } else {
        // convergence zone
        u += 2.0 * (16 - lat) / 4;
        v += 1.0;
      }
    }
    
    if (config.eastWaveEnabled && lat < 18) {
      // Wave disturbance propagating west: Easterly waves
      const wave = Math.sin((lon - 0.5 * config.joystickDx) * 0.3) * 2.5;
      v += wave;
      u -= 1.5; // background easterlies booster
    }
  } else if (level === 500) {
    // Background tropical easterlies (trade winds) south of sub-high
    if (lat < 18) {
      u -= 3.5;
    }
  }

  return { u, v };
}

// Compute aggregate steering flow wind based on typhoon intensity weights
export function getSteeringFlow(lat: number, lon: number, vmax: number, config: SimulationConfig, isManualSteering?: boolean): { u: number; v: number } {
  // Aggregate steering flow is vertically weighted based on typhoon intensity:
  // Weaker systems (TD, TS) are controlled by low-to-mid levels (850, 700 hPa)
  // Stronger systems (TY, SuperTY) are governed by deeper layer average (850 to 200 hPa)
  
  // Weights (smoothly interpolating from vmax = 10 to 60 m/s)
  // We approximate 700 hPa as the average of 850 and 500 hPa for simplification
  const t = Math.min(Math.max((vmax - 15) / 45, 0.0), 1.0); // 0 at weak, 1 at strong

  // Weak system weights
  const w850_weak = 0.45;
  const w500_weak = 0.55; // represents mid-levels 700-500 hPa
  const w200_weak = 0.00;

  // Strong system weights
  const w850_strong = 0.15;
  const w500_strong = 0.60;
  const w200_strong = 0.25;

  const w850 = w850_weak * (1 - t) + w850_strong * t;
  const w500 = w500_weak * (1 - t) + w500_strong * t;
  const w200 = w200_weak * (1 - t) + w200_strong * t;

  const wind850 = getEnvironmentalWind(850, lat, lon, config);
  const wind500 = getEnvironmentalWind(500, lat, lon, config);
  const wind200 = getEnvironmentalWind(200, lat, lon, config);

  let u = wind850.u * w850 + wind500.u * w500 + wind200.u * w200;
  let v = wind850.v * w850 + wind500.v * w500 + wind200.v * w200;

  // Subtropical High Core Barrier & Breakthrough Physics
  if (config.subtropicalHighEnabled && config.subtropicalHighStrength > 0) {
    const subHighLat = config.subtropicalHighLat;
    const subHighLon = config.subtropicalHighLon;
    const westExtend = config.subtropicalHighWestExtent;
    const strength = config.subtropicalHighStrength;

    const nsSize = config.subtropicalHighNSSize !== undefined ? config.subtropicalHighNSSize : 1.0;
    const dLat = (lat - subHighLat) / (6.0 * nsSize);
    let dLon = 0;
    if (lon > subHighLon) {
      dLon = (lon - subHighLon) / 12.0;
    } else if (lon >= westExtend) {
      dLon = 0;
    } else {
      dLon = (lon - westExtend) / 10.0;
    }
    const r = Math.sqrt(dLat * dLat + dLon * dLon);

    // If cyclone approaches Subtropical High core interior (r < 1.25)
    if (r < 1.25) {
      // Breakthrough Check:
      // High-intensity Super Typhoon (vmax >= 55 m/s) has a tiny ~2% chance of fracturing/breaking through the high,
      // or if a deep westerly trough (depth > 0.90) cuts a breach in the high,
      // or if the user is manually operating the virtual joystick.
      let canBreakthrough = false;
      if (isManualSteering) {
        canBreakthrough = true;
      } else if (config.westerliesTroughDepth > 0.90 && lat > subHighLat - 2.0) {
        canBreakthrough = true;
      } else if (vmax >= 55.0) {
        // Deterministic roll based on coordinates/vmax
        const rollVal = Math.abs(Math.sin(lat * 12.9898 + lon * 78.233 + vmax * 3.14159)) % 1.0;
        if (rollVal < 0.02) {
          canBreakthrough = true;
        }
      }

      if (!canBreakthrough) {
        // Repel from core, forcing cyclone to slide smoothly along the outer 5880 gpm edge
        const pushFactor = Math.pow((1.25 - r) / 1.25, 1.2) * 8.5 * strength;
        const angle = Math.atan2(dLat * 1.5, dLon);
        u += Math.cos(angle) * pushFactor;
        v += Math.sin(angle) * pushFactor;
      }
    }
  }

  return { u, v };
}

// --- Typhoon Core Engine ---

export class TyphoonEngine {
  private prng: SeededRandom;

  private seedStr: string;
  constructor(seedStr: string) {
    this.seedStr = seedStr;
    this.prng = new SeededRandom(seedStr);
  }
  public syncPrngToHour(hour: number) {
    this.prng = new SeededRandom(this.seedStr);
    const steps = Math.floor(hour * 6); // 6 steps per hour
    for (let i = 0; i < steps; i++) {
       // Burn steps to catch up
       this.prng.next(); 
    }
  }

  // Generate an initial beautiful typhoon named "夜澜"
  public createDefaultTyphoon(id: string, name: string, lat: number, lon: number, config: SimulationConfig): Typhoon {
    const initialVmax = 15.0; // 15 m/s (7级)
    const initialPmin = calculatePressure(initialVmax);
    const sizeFactor = 1.0; // medium size
    const maxR7Limit = Math.round(this.prng.nextRange(330, 550));

    const r7 = { ne: 0, se: 0, sw: 0, nw: 0 };
    const r10 = { ne: 0, se: 0, sw: 0, nw: 0 };
    const r12 = { ne: 0, se: 0, sw: 0, nw: 0 };

    const readings = calculateStationReadings(lat, lon, initialVmax, initialPmin, 38, r7, r10, r12);

    return {
      id,
      name,
      lat,
      lon,
      vmax: initialVmax,
      pmin: initialPmin,
      direction: 315, // NW
      speed: 15,
      rmw: 16,
      r7,
      r10,
      r12,
      active: true,
      category: TyphoonCategory.TD,
      landed: false,
      dissipated: false,
      extrTransition: 0,
      ewrcState: "none",
      ewrcProgress: 0,
      rapidIntensifying: false,
      maxR7Limit,
      upwellingHours: 0,
      isManualSteering: false,
      lastVelocityU: 0,
      lastVelocityV: 0,
      stationReadings: readings,
      history: [
        {
          lat,
          lon,
          vmax: initialVmax,
          pmin: initialPmin,
          direction: 315,
          speed: 15,
          rmw: 16,
          r7,
          r10,
          r12,
          category: TyphoonCategory.TD,
          simHour: 0,
          landed: false,
          dissipated: false,
          extrTransition: 0,
          ewrcState: "none",
          ewrcProgress: 0,
          rapidIntensifying: false,
          maxR7Limit,
          upwellingHours: 0,
          stationReadings: readings
        }
      ]
    };
  }

  // Update simulation step (advances by simStepMins, default is 10 minutes)
  public stepSimulation(
    typhoons: Typhoon[],
    config: SimulationConfig,
    currentSimHourFloat: number,
    startDate?: Date
  ): { updatedTyphoons: Typhoon[]; logs: EventLog[] } {
    const logs: EventLog[] = [];
    const updatedTyphoons: Typhoon[] = [];

    // Store the original coordinates for Fujiwhara and interactions
    const originalPositions = typhoons.map(t => ({ id: t.id, lat: t.lat, lon: t.lon, vmax: t.vmax, active: t.active }));

    for (let index = 0; index < typhoons.length; index++) {
      const ty = typhoons[index];
      if (!ty.active || ty.dissipated) {
        updatedTyphoons.push({ ...ty, forecastPath: [], active: false, dissipated: true });
        continue;
      }

      const currentSimHour = Math.floor(currentSimHourFloat + 0.001); // Stable integer hour

      // Check current land metrics
      const landCheck = getLandMetrics(ty.lat, ty.lon, config?.coastlineSource);

      // --- 1. Path steering calculation ---
      const steering = getSteeringFlow(ty.lat, ty.lon, ty.vmax, config);

      // C. Declare variables for state tracking early to avoid reference errors
      let isStructureDamaged = ty.isStructureDamaged || false;
      let passedTaiwanCentral = ty.passedTaiwanCentral || false;
      let passedLuzonMountains = ty.passedLuzonMountains || false;
      let structuralDamagePenaltyFactor = ty.structuralDamagePenaltyFactor !== undefined ? ty.structuralDamagePenaltyFactor : 1.0;
      let maxLandElevationPassed = ty.maxLandElevationPassed || 0;
      let structuralDamageHours = ty.structuralDamageHours || 0;
      let warmWaterHoursAfterSea = ty.warmWaterHoursAfterSea || 0;
      let landHours = ty.landHours || 0;
      let landContactHours = ty.landContactHours || 0;
      let r10LandContactHours = ty.r10LandContactHours || 0;
      let forcedDecayStartVmax = ty.forcedDecayStartVmax;
      let forcedDecayTargetVmax = ty.forcedDecayTargetVmax;
      let forcedDecayElapsedHours = ty.forcedDecayElapsedHours || 0;
      let forcedDecayDuration = ty.forcedDecayDuration;
      let forcedDecayIsContinuous = ty.forcedDecayIsContinuous;

      // B. Beta-Drift (coriolis effect on vortex, creates slight NW shift)
      let betaU = 0;
      let betaV = 0;
      if (config.betaDriftEnabled) {
        // Requirement 5 & 6: Beta drift influenced by actual size (r7) and lat
        const scale = config.betaDriftScale;
        const r7avg = ty.r7 && ty.r7.ne > 0 ? (ty.r7.ne + ty.r7.nw + ty.r7.sw + ty.r7.se) / 4.0 : (ty.vmax * 5.8 + 30);
        const sizeFactor = Math.max(0.3, Math.min(2.0, r7avg / 250.0));
        betaU = -0.5 * scale * sizeFactor * (1.0 + Math.sin((ty.lat * Math.PI)/180));
        betaV = 0.7 * scale * sizeFactor * (1.0 + Math.sin((ty.lat * Math.PI)/180));
      }

      // C. Fujiwhara Effect (binary typhoon interaction)
      let fujiU = 0;
      let fujiV = 0;
      if (config.fujiwharaEnabled && originalPositions.length > 1) {
        const other = originalPositions.find(p => p.id !== ty.id && p.active);
        if (other) {
          const dLat = other.lat - ty.lat;
          const dLon = (other.lon - ty.lon) * Math.cos(((ty.lat + other.lat)/2 * Math.PI) / 180);
          const distDegrees = Math.sqrt(dLat*dLat + dLon*dLon);
          const distKm = distDegrees * 111.0;

          if (distKm < 1200.0) {
            // Threshold is around 1200km. Under this, they rotate counter-clockwise
            // Barycenter pulling force
            const force = Math.max(0.1, Math.min(2.5, (other.vmax * 200.0) / (distKm * distKm)));
            // Cyclonic rotation unit vector: rotates CCW around the other
            // Vector pointing to other: (dLon, dLat) -> CCW: (-dLat, dLon)
            const rotU = -dLat / distDegrees;
            const rotV = dLon / distDegrees;

            fujiU = rotU * force * 1.5;
            fujiV = rotV * force * 1.5;

            // Slight attraction component if very close (<600km)
            if (distKm < 600.0) {
              fujiU += (dLon / distDegrees) * force * 0.4;
              fujiV += (dLat / distDegrees) * force * 0.4;
            }

            if (currentSimHour % 6 === 0) {
              const checkDuplicate = logs.some(l => l.message.includes("双台风相互作用"));
              if (!checkDuplicate) {
                // Suppressed to keep logs focused on key milestones as requested
              }
            }
          }
        }
      }

      // D. User Virtual Joystick input
      let joyU = 0;
      let joyV = 0;
      
      // Track manual steering state
      let isManualSteering = ty.isManualSteering || false;
      let lastVelocityU = ty.lastVelocityU || 0;
      let lastVelocityV = ty.lastVelocityV || 0;

      const isDragging = config.joystickDragging || false;
      const effectiveDx = isDragging ? config.joystickDx : 0;
      const effectiveDy = isDragging ? config.joystickDy : 0;

      if (effectiveDx !== 0 || effectiveDy !== 0) {
        // sensitivity converts joystick offset (-1 to +1) to steering speed (m/s)
        const speedMultiplier = config.joystickStrength * config.joystickSensitivity * 4.5;
        joyU = effectiveDx * speedMultiplier;
        joyV = effectiveDy * speedMultiplier;
        
        isManualSteering = true;
      }

      // E. Small repeatable random noise
      let noiseU = 0;
      let noiseV = 0;
      if (config.randomNoise > 0) {
        noiseU = this.prng.nextRange(-1.0, 1.0) * config.randomNoise * 0.8;
        noiseV = this.prng.nextRange(-1.0, 1.0) * config.randomNoise * 0.8;
      }

      // Environmental background steering vector
      const envU = steering.u + betaU + fujiU + noiseU;
      const envV = steering.v + betaV + fujiV + noiseV;

      // Aggregate steering flow vectors (in m/s)
      let u_agg: number;
      let v_agg: number;

      if (effectiveDx !== 0 || effectiveDy !== 0) {
        // User actively steering with joystick
        // When in/approaching westerlies zone, combine joystick input with westerlies push force
        const westVec = getWesterliesSteeringVector(ty.lat, ty.lon, config);
        u_agg = joyU + westVec.u;
        v_agg = joyV + westVec.v;
        if (westVec.u > 0 && joyV > 0 && joyU <= 0.1) {
            // Requirement 3: If user steers North in Westerlies, force East-North-East movement
            u_agg += joyV * 0.5 + westVec.u * 0.5; 
        }
        lastVelocityU = u_agg;
        lastVelocityV = v_agg;
        isManualSteering = true;
      } else if (isManualSteering) {
        // User released joystick after manual steering:
        // Maintain the movement direction and speed from before joystick was released!
        u_agg = lastVelocityU;
        v_agg = lastVelocityV;
      } else {
        // Standard environmental steering flow
        u_agg = envU;
        v_agg = envV;
        lastVelocityU = envU;
        lastVelocityV = envV;
        isManualSteering = false;
      }

      // Westerlies active check (only when westerlies are enabled and typhoon is near/in the westerlies zone)
      const wLat = config.westerliesLat ?? 30.0;
      const isWesterliesZone = config.westerliesEnabled && (config.westerliesStrength ?? 1.0) > 0 && ty.lat > wLat - 8.0;

      // Calculate movement speed (km/h)
      const subHighLatLive = config.subtropicalHighLat ?? 28;
      const subHighWestLive = config.subtropicalHighWestExtent ?? 125;
      const isFarOceanLive = ty.lon > 140.0 && Math.abs(ty.lat - subHighLatLive) > 7.0 && ty.lon > subHighWestLive + 10;

      let speedMps = Math.hypot(u_agg, v_agg);
      let speedKmh = speedMps * 3.6;

      if (speedKmh < (isFarOceanLive ? 15.0 : 18.0) && speedKmh > 0 && !isManualSteering) {
          const targetMin = isFarOceanLive ? 15.0 : 18.0;
          const scale = targetMin / speedKmh;
          u_agg *= scale;
          v_agg *= scale;
          speedKmh = targetMin;
      }
      if (!isWesterliesZone && !isManualSteering) {
        if (isFarOceanLive) {
          const targetMin = 15.0;
          const targetMax = 20.0;
          if (speedKmh < targetMin && speedKmh > 0) {
            const scale = targetMin / speedKmh;
            u_agg *= scale;
            v_agg *= scale;
            speedKmh = targetMin;
          } else if (speedKmh > targetMax) {
            const scale = targetMax / speedKmh;
            u_agg *= scale;
            v_agg *= scale;
            speedKmh = targetMax;
          }
        } else {
          const targetMin = 18.0;
          const targetMax = 28.0;
          if (speedKmh < targetMin && speedKmh > 0) {
            const scale = targetMin / speedKmh;
            u_agg *= scale;
            v_agg *= scale;
            speedKmh = targetMin;
          } else if (speedKmh > targetMax) {
            const scale = targetMax / speedKmh;
            u_agg *= scale;
            v_agg *= scale;
            speedKmh = targetMax;
          }
        }

        if (speedKmh > 32.0) {
          const scale = 32.0 / speedKmh;
          u_agg *= scale;
          v_agg *= scale;
          speedKmh = 32.0;
        }
      } else if (isWesterliesZone) {
        // Westerlies speed acceleration cap: up to 60.0 km/h
        if (speedKmh > 60.0) {
          const scale = 60.0 / speedKmh;
          u_agg *= scale;
          v_agg *= scale;
          speedKmh = 60.0;
        }
      }

      // Update lastVelocityU and lastVelocityV
      lastVelocityU = u_agg;
      lastVelocityV = v_agg;

      // Convert m/s steering velocity to coordinates changes (degrees/hour)
      // 1 degree of latitude ≈ 111,111 meters.
      // 1 degree of longitude ≈ 111,111 * cos(lat) meters.
      const latSpeedDegHour = (v_agg * 3600.0) / 111111.0;
      const lonSpeedDegHour = (u_agg * 3600.0) / (111111.0 * Math.cos((ty.lat * Math.PI) / 180));

      let dirDegrees = Math.round((Math.atan2(u_agg, v_agg) * 180.0) / Math.PI);
      if (dirDegrees < 0) dirDegrees += 360;

      // Update positions for 10 minutes step (1/6 of an hour)
      const stepFraction = 1.0 / 6.0;
      let newLat = ty.lat + latSpeedDegHour * stepFraction;
      let newLon = ty.lon + lonSpeedDegHour * stepFraction;

      // Boundaries clamp to NW Pacific
      newLat = Math.max(0, Math.min(55, newLat));
      newLon = Math.max(95, Math.min(180, newLon));

      // --- 2. Intensity Engine (vmax and pmin) ---
      const metrics = getLandMetrics(newLat, newLon, config?.coastlineSource);
      let sstVal = getSST(newLat, newLon, config);
      
      // Safety guards for simulation parameters
      if (isNaN(sstVal)) sstVal = 28.0;
      let ohcValPre = getOHC(newLat, newLon, config);
      if (isNaN(ohcValPre)) ohcValPre = 50.0;

      // Guard against NaN in positions or intensity to prevent simulation freezing/crashing
      if (isNaN(newLat) || isNaN(newLon) || isNaN(ty.vmax)) {
        console.error(`Simulation encountered NaN for typhoon ${ty.id}. Forcing reset.`);
        newLat = ty.lat || 15;
        newLon = ty.lon || 135;
        updatedTyphoons.push({ ...ty, dissipated: true, active: false });
        continue;
      }

      if (metrics.isLand) {
        landHours += stepFraction;
      } else {
        landHours = 0;
      }

      // C. Track Landfall Mountain Elevation & Post-Landfall Structural Damage Mechanics (Calculate State)
      if (metrics.isLand) {
        if (metrics.elevation > maxLandElevationPassed) {
          maxLandElevationPassed = metrics.elevation;
          // Check if passing through Taiwan Central Mountain Range
          if (metrics.elevation > 1500 && ty.lat >= 21.5 && ty.lat <= 25.5 && ty.lon >= 119.5 && ty.lon <= 122.5) {
            passedTaiwanCentral = true;
          }
          // Requirement 5: Check if passing through Luzon Mountains (Cordillera Central)
          if (metrics.elevation > 700 && ty.lat >= 12.0 && ty.lat <= 19.5 && ty.lon >= 119.0 && ty.lon <= 124.0) {
            passedLuzonMountains = true;
          }
        }
        structuralDamageHours = 0;
        warmWaterHoursAfterSea = 0;
        isStructureDamaged = false;
        structuralDamagePenaltyFactor = 1.0;
      } else {
        // Over ocean
        if (passedLuzonMountains || passedTaiwanCentral || maxLandElevationPassed > 500 || landHours > 4 || ty.consecutiveUpwellingHours > 6) {
          structuralDamageHours += stepFraction;

          if (sstVal > 29.0) {
            warmWaterHoursAfterSea += stepFraction;
          }

          // Requirement 5: Luzon penalty set to max 50 hours total including recovery
          let damageLimitHours = 28.0;
          if (passedLuzonMountains) {
            const maxElev = Math.max(maxLandElevationPassed, 1600);
            damageLimitHours = 28.0 + Math.min(4.0, ((maxElev - 700) / 2000.0) * 4.0); // 28.0 to 32.0 hours
          } else if (passedTaiwanCentral) {
            damageLimitHours = 28.0 + Math.min(4.0, (maxLandElevationPassed / 4000.0) * 4.0); // 28.0 to 32.0 hours
          } else {
            const baseLimit = 22.0 + (Math.min(maxLandElevationPassed, 4000) / 4000) * 6.0; // 22.0 to 28.0 hours
            damageLimitHours = warmWaterHoursAfterSea >= 18.0 ? (baseLimit * 0.7) : baseLimit;
          }
          
          const recoveryPhaseHours = 14.0; // Slow gradual recovery phase
          // HARD CONSTRAINT: Structural damage penalty duration MUST NOT exceed 50.0 hours total
          if (damageLimitHours + recoveryPhaseHours > 50.0) {
            damageLimitHours = 50.0 - recoveryPhaseHours;
          }

          if (structuralDamageHours <= damageLimitHours) {
            isStructureDamaged = true;
            if (passedTaiwanCentral) {
              structuralDamagePenaltyFactor = 0.05;
            } else if (passedLuzonMountains) {
              structuralDamagePenaltyFactor = 0.18; // Heavy penalty during Luzon修复期
            } else {
              structuralDamagePenaltyFactor = 0.25;
            }

            if (structuralDamageHours <= stepFraction * 1.5) {
              const regionName = passedLuzonMountains ? "吕宋岛高山地形" : (passedTaiwanCentral ? "台湾中央山脉" : "高山地形");
              logs.push({
                id: `damage-start-${ty.id}-${currentSimHour}`,
                time: new Date(),
                simHour: currentSimHour,
                type: "danger",
                message: `⛰️ 核心结构重创：${ty.name} 穿过${regionName}(最高海拔 ${Math.round(maxLandElevationPassed)} 米)，核心对称结构毁损！出海后约 ${damageLimitHours.toFixed(1)} 小时内增强速度严重受限 (状态显示【中心结构修复中】)。`
              });
            }
          } else if (structuralDamageHours <= (damageLimitHours + recoveryPhaseHours)) {
            // Gradual recovery phase
            isStructureDamaged = true;
            const progress = (structuralDamageHours - damageLimitHours) / recoveryPhaseHours;
            const basePenalty = passedTaiwanCentral ? 0.05 : (passedLuzonMountains ? 0.18 : 0.25);
            // Non-linear slow ramp-up curve using exponent 1.8
            const slowRamp = Math.pow(progress, 1.8);
            structuralDamagePenaltyFactor = basePenalty + slowRamp * (1.0 - basePenalty);
          } else {
            if (isStructureDamaged) {
              isStructureDamaged = false;
              passedTaiwanCentral = false;
              passedLuzonMountains = false;
              structuralDamagePenaltyFactor = 1.0;
              maxLandElevationPassed = 0;
              logs.push({
                id: `damage-cleared-${ty.id}-${currentSimHour}`,
                time: new Date(),
                simHour: currentSimHour,
                type: "info",
                message: `🌀 结构彻底重塑：${ty.name} 出海已满足 ${damageLimitHours.toFixed(0)} 小时结构修复期及漫长过渡期，【中心结构修复中】状态正式解除。`
              });
            }
          }
          
          // Boost recovery if in very warm water
          if (warmWaterHoursAfterSea >= 6.0 && (warmWaterHoursAfterSea - stepFraction) < 6.0 && structuralDamagePenaltyFactor < 0.8) {
             structuralDamagePenaltyFactor = Math.max(structuralDamagePenaltyFactor, 0.8);
          }
        } else {
          isStructureDamaged = false;
          structuralDamagePenaltyFactor = 1.0;
        }
      }

      // D. Calculate Wind Radii (R7, R10, R12)
      // Only recalculate every 3 hours (at 3-hour marks), or when land state changes, or if ty.r7 is missing
      let r7 = ty.r7;
      let r10 = ty.r10;
      let r12 = ty.r12;
      
      const isExactlyOnThreeHour = (currentSimHour % 3 === 0) && (Math.abs((currentSimHourFloat % 1) * 60) < 1);
      const landStateChanged = metrics.isLand !== ty.landed;
      const needRecalcRadii = isExactlyOnThreeHour || landStateChanged || !ty.r7;

      if (needRecalcRadii) {
        let r10Boost = 0;
        let r12Boost = 0;
        if (ty.ewrcState === "recovering_success") {
          // Upon EWRC success, 10 and 12-level wind circles expand dynamically
          r10Boost = 0.08;
          r12Boost = 0.12;
        } else if (ty.rapidIntensifying) {
          r10Boost = 0.05;
          r12Boost = 0.08;
        }

        // Requirement 2: Structural damage mechanism no longer affects wind radii
        let structureDamageR7Scale = 1.0;
        let structureDamageR10R12Scale = 1.0;

        r7 = this.calculateWindRadii(newLat, newLon, ty.vmax, 1.0 * structureDamageR7Scale, u_agg, v_agg, metrics.isLand, ty.maxR7Limit, config, false);
        
        // Global 85% adjustment for R10 and R12
        const globalScale1012 = 0.85;

        const shrink = (r: { ne: number; se: number; sw: number; nw: number }) => ({
          ne: Math.round(r.ne * 0.68),
          se: Math.round(r.se * 0.68),
          sw: Math.round(r.sw * 0.68),
          nw: Math.round(r.nw * 0.68)
        });

        const r10_raw = ty.vmax >= 24.5 ? shrink(this.calculateWindRadii(newLat, newLon, ty.vmax, Math.max(0.40, (0.65 + r10Boost) * 1.15) * globalScale1012 * structureDamageR10R12Scale, u_agg, v_agg, metrics.isLand, ty.maxR7Limit, config, false)) : { ne: 0, se: 0, sw: 0, nw: 0 };
        r10 = { ne: Math.round(r10_raw.ne * 1.01 * 1.10), se: Math.round(r10_raw.se * 1.01 * 1.10), sw: Math.round(r10_raw.sw * 1.01 * 1.10), nw: Math.round(r10_raw.nw * 1.01 * 1.10) };
        const r12_raw = ty.vmax >= 32.7 ? shrink(this.calculateWindRadii(newLat, newLon, ty.vmax, Math.max(0.25, 0.42 + r12Boost) * globalScale1012 * structureDamageR10R12Scale, u_agg, v_agg, metrics.isLand, ty.maxR7Limit, config, false)) : { ne: 0, se: 0, sw: 0, nw: 0 };
        r12 = { ne: Math.round(r12_raw.ne * 0.90 * 1.10), se: Math.round(r12_raw.se * 0.90 * 1.10), sw: Math.round(r12_raw.sw * 0.90 * 1.10), nw: Math.round(r12_raw.nw * 0.90 * 1.10) };

        // Enforce physical gap hierarchy across all 4 quadrants: 12级 < 10级 < 7级, and difference >= 25km
        const quadrants = ["ne", "se", "sw", "nw"] as const;
        for (const q of quadrants) {
          if (r10[q] > 0) {
            r10[q] = Math.min(r10[q], Math.max(15, r7[q] - 25));
          }
          if (r12[q] > 0) {
            const maxAllowedR12 = r10[q] > 0 ? (r10[q] - 25) : (r7[q] - 50);
            r12[q] = Math.min(r12[q], Math.max(15, maxAllowedR12));
          }
        }
      } else {
        r7 = ty.r7 || { ne: 0, se: 0, sw: 0, nw: 0 };
        r10 = ty.r10 || { ne: 0, se: 0, sw: 0, nw: 0 };
        r12 = ty.r12 || { ne: 0, se: 0, sw: 0, nw: 0 };
      }

      const r7TouchesLand = checkWindCircleTouchLand(newLat, newLon, r7, config?.coastlineSource);
      const r10TouchesLand = checkWindCircleTouchLand(newLat, newLon, r10, config?.coastlineSource);

      if (metrics.isLand || r7TouchesLand) {
        landContactHours += stepFraction;
      } else {
        landContactHours = Math.max(0, landContactHours - stepFraction * 2.0);
      }

      if (r10TouchesLand) {
        r10LandContactHours += stepFraction;
      } else {
        r10LandContactHours = Math.max(0, r10LandContactHours - stepFraction * 2.0);
      }

      // Cold Water Upwelling & Spinning In Place Mechanism (冷水上翻与原地打转机制)
      let isSpinningInPlace = false;
      if (ty.history.length >= 6) {
        const recentPoints = ty.history.slice(-6);
        let maxDist = 0;
        const lastPt = recentPoints[recentPoints.length - 1];
        for (const pt of recentPoints) {
          const dLat = pt.lat - lastPt.lat;
          const dLon = (pt.lon - lastPt.lon) * Math.cos((lastPt.lat * Math.PI)/180);
          const dist = Math.sqrt(dLat*dLat + dLon*dLon);
          if (dist > maxDist) maxDist = dist;
        }
        // If moved less than 0.6 degrees (~66km) within 6 hours, it is spinning/looping in place
        if (maxDist < 0.6) {
          isSpinningInPlace = true;
        }
      }

      // Track upwelling hours
      let upwellingHours = ty.upwellingHours || 0;
      let consecutiveUpwellingHours = ty.consecutiveUpwellingHours || 0;
      let upwellingPersistentPenaltyHours = ty.upwellingPersistentPenaltyHours || 0;
      let currentCasualties = ty.casualties || 0;
      let ewrcCooldownHours = ty.ewrcCooldownHours || 0;
      
      if (ewrcCooldownHours > 0) {
        ewrcCooldownHours = Math.max(0, ewrcCooldownHours - stepFraction);
      }

      if (upwellingPersistentPenaltyHours > 0) {
        upwellingPersistentPenaltyHours = Math.max(0, upwellingPersistentPenaltyHours - stepFraction);
      }

      const isSlowOrSpinning = !metrics.isLand && speedKmh < 12.0;
      if (isSlowOrSpinning) {
        upwellingHours += stepFraction;
        consecutiveUpwellingHours += stepFraction;
      } else {
        // If we were in upwelling for 24h+, start the persistent penalty (Request 1)
        if (consecutiveUpwellingHours >= 24) {
          upwellingPersistentPenaltyHours = 36 + Math.random() * 12; // 36-48h duration
          logs.push({
            id: `upwelling-penalty-start-${ty.id}-${currentSimHour}`,
            time: new Date(),
            simHour: currentSimHour,
            type: "warning",
            message: `⚠️ 能量耗损：${ty.name} 此前长时间受冷水上翻影响，底层结构受损，其增强能力在未来 36-48 小时内将被大幅限制。`
          });
        }
        upwellingHours = Math.max(0, upwellingHours - stepFraction * 1.5);
        consecutiveUpwellingHours = 0;
      }

      let upwellingCooling = 0.0;
      let coldWaterDecay = 0.0;
      if (!metrics.isLand && speedKmh < 12.0) {
        let slownessFactor = Math.pow((12.0 - speedKmh) / 12.0, 0.85); // More aggressive slowness scaling

        // Inside the 10-level wind circle, stronger sucking of cold deep water causes rapid non-linear SST cooling
        const hasR10 = ty.vmax >= 24.5;
        const upwellingFactor = hasR10 ? 1.75 : 1.15;
        const intensityFactor = Math.pow(ty.vmax / 26.0, 1.4);
        
        // Non-linear acceleration over upwelling duration
        const nonLinearTime = Math.pow(upwellingHours + 0.5, 1.05);
        const upwellingCoolingRate = 0.06 * intensityFactor * slownessFactor * upwellingFactor * config.airSeaCoupling;
        
        upwellingCooling = Math.min(2.5, nonLinearTime * upwellingCoolingRate); // Cap reduced to 2.5C
        
        // Non-linear intensity decay: significantly weakened
        const decayAccel = 1.0 + 0.3 * Math.pow(upwellingHours, 0.9);
        coldWaterDecay = upwellingCooling * 0.04 * decayAccel * (1.0 + slownessFactor * 0.3);
        
        if (sstVal - upwellingCooling < 26.5) {
          const sstDeficit = 26.5 - (sstVal - upwellingCooling);
          coldWaterDecay += 0.02 * Math.pow(sstDeficit, 1.0);
        }

        // Apply upwelling factor adjustment slider
        const userAdjustment = Math.max(0.0, config.upwellingFactor !== undefined ? (1.0 + config.upwellingFactor / 100) : 1.0);
        coldWaterDecay *= userAdjustment;
        upwellingCooling *= userAdjustment;

        sstVal = Math.max(13, sstVal - upwellingCooling);

        // Log substantial cold water upwelling
        const isUpwellingSignificant = upwellingCooling >= 1.5;
        if (isUpwellingSignificant && !ty.upwellingLogged) {
          ty.upwellingLogged = true;
          logs.push({
            id: `upwelling-start-${ty.id}-${currentSimHour}`,
            time: new Date(),
            simHour: currentSimHour,
            type: "warning",
            message: `❄️ 冷水上翻：${ty.name} 移速缓慢 (${speedKmh.toFixed(1)} km/h)，强烈的气旋抽吸作用导致深层冷水上翻，表层海温骤降 ${upwellingCooling.toFixed(1)}℃ (降至 ${sstVal.toFixed(1)}℃)！台风能量供应受阻，强度开始衰减。`
          });
        }
      }

      if ((!isSlowOrSpinning || upwellingCooling < 1.5) && ty.upwellingLogged) {
        ty.upwellingLogged = false;
        logs.push({
          id: `upwelling-end-${ty.id}-${currentSimHour}`,
          time: new Date(),
          simHour: currentSimHour,
          type: "success",
          message: `🌊 摆脱冷水区：${ty.name} 移速增加或离开原地打转区域，摆脱了自激发的冷水上翻，环境海温及发展势头有所回升。`
        });
      }

      const ohcVal = getOHC(newLat, newLon, config, sstVal);
      let shearVal = getShear(newLat, newLon, config);
      if (ty.forcedShear !== undefined) {
        shearVal = ty.forcedShear;
      }
      const rhVal = getRH700(newLat, newLon, config);

      // Environment rating score (-1 to 1)
      let sstScore = 0;
      if (sstVal >= 26.5) {
        sstScore = Math.max(-1.0, Math.min(1.0, (sstVal - 26.5) / 2.0));
      } else {
        // Cold water weakens typhoon more severely
        sstScore = Math.max(-1.5, (sstVal - 26.5) / 1.5);
      }
      const ohcScore = Math.max(0.0, Math.min(1.0, ohcVal / 100.0));
      const rhScore = Math.max(-1.0, Math.min(1.0, (rhVal - 50.0) / 35.0));
      
      // Non-linear realistic regime-based vertical wind shear penalty (Requirement 7)
      let shearPenalty = 0.0;
      if (shearVal > 10.0) {
        shearPenalty = Math.min(1.5, Math.pow((shearVal - 10.0) / 16.0, 1.4));
      }

      // Low Peak Intensity Limit Factor & Adverse Climate Multiplier (Requirement 3)
      const configuredPeakLimit = config.maxIntensityLimitEnabled ? (config.maxIntensityLimit ?? 70) : 95;
      let lowPeakFactor = 1.0;
      let adverseClimateMultiplier = 1.0;
      if (config.maxIntensityLimitEnabled && configuredPeakLimit < 70) {
        lowPeakFactor = Math.max(0.25, configuredPeakLimit / 70.0);
        adverseClimateMultiplier = 1.0 / lowPeakFactor;
      }

      // Requirement 9: Smarter peak intensity setting mechanism (Ambition Factor)
      let ambitionFactor = 1.0;
      if (config.maxIntensityLimitEnabled && config.maxIntensityLimit && config.maxIntensityLimit > 50) {
        ambitionFactor = Math.max(1.0, config.maxIntensityLimit / 50.0);
        // Reduce moderate shear penalty
        if (shearVal < 15.0) {
          shearPenalty /= (ambitionFactor * 1.5);
        }
      }

      // Enhance shear penalty if peak limit is low (Requirement 3)
      shearPenalty *= adverseClimateMultiplier;
      
      // Calculate land fraction/elevation penalty
      let landPenalty = 0.0;
      let terrainPenalty = 0.0;
      if (metrics.isLand) {
        landPenalty = 0.90 * adverseClimateMultiplier; // Increased land penalty for low peak limit
        if (config.terrainDecayEnabled && metrics.elevation > 0) {
          let elevationScale = 4800.0; // Slightly reduced scale for slightly stronger elevation decay
          let terrainMulti = 0.55 * adverseClimateMultiplier; // Increased
          // Weaken Luzon mountain decay bonus (Luzon: 12-19N, 119-123E)
          if (newLat >= 12 && newLat <= 19 && newLon >= 119 && newLon <= 123) {
            elevationScale = 14500.0;
            terrainMulti = 0.018 * adverseClimateMultiplier;
          }
          // Substantially weaken Hainan mountain decay bonus (Hainan: 18-20.5N, 108.5-111.5E)
          if (newLat >= 18 && newLat <= 20.5 && newLon >= 108.5 && newLon <= 111.5) {
            elevationScale = 19000.0;
            terrainMulti = 0.0035 * adverseClimateMultiplier;
          }
          // Substantially weaken Taiwan mountain decay bonus (Taiwan: 21.5-25.5N, 119.5-122.5E)
          if (newLat >= 21.5 && newLat <= 25.5 && newLon >= 119.5 && newLon <= 122.5) {
            elevationScale = 3800.0; // Slightly stronger terrain effect (increased)
            terrainMulti = 0.48 * adverseClimateMultiplier; 
          }
          
          terrainPenalty = (metrics.elevation / elevationScale) * terrainMulti; 
          // Guard against infinity/NaN in terrain calculation
          if (isNaN(terrainPenalty) || !isFinite(terrainPenalty)) terrainPenalty = 0;
        }
      }

      // Outflow channel rating (based on altitude / latitude)
      let outflowScore = 0.35;
      if (newLat > 12 && newLat < 28) outflowScore += 0.25; // optimal outflow channel region
      outflowScore *= config.outflowScale;

      // Aggregated favorable environmental rating
      let favScore = (0.35 * sstScore) + (0.18 * ohcScore) + (0.17 * rhScore) + (0.12 * outflowScore);
      favScore -= (0.35 * shearPenalty);
      
      // Dry air core intrusion mechanism (50% impact for normal intact core)
      let dryAirPenalty = 0;
      if (config.dryAirStrength && config.dryAirStrength > 0) {
        dryAirPenalty = config.dryAirStrength * 0.85 * adverseClimateMultiplier;
        if (!ty.isStructureDamaged || ty.vmax >= 35.0) {
          dryAirPenalty *= 0.75; // Increased dry air penetration into intact cores
        }
        if (config.maxIntensityLimitEnabled && config.dryAirStrength < 1.2) {
          dryAirPenalty /= (ambitionFactor * 1.2);
        }
        favScore -= dryAirPenalty;
      }

      // Manual Dry Air, Wind Shear and Rapid Intensification overrides are handled in the unified Master Controller at the end of the physics step.
      
      // Decays
      if (config.landDecayEnabled) {
        favScore -= landPenalty + terrainPenalty;
      }
      
      if (config.westerliesEnabled && newLat >= config.westerliesLat - 3) {
        favScore -= 0.4 * adverseClimateMultiplier; // heavy westerlies interaction penalty
      }

      // Current intensity velocity delta (m/s change per hour)
      // --- NEW PHYSICALLY-BASED INTENSITY ENGINE ---
      
      // Sync parameters for Cloud Rendering (Requirement 4)
      ty.shear = shearVal;
      ty.shearDir = (ty.direction + 135) % 360; // Approximate shear direction for visual variety
      ty.upwellingIntensity = Math.min(1.0, upwellingCooling / 5.0);

      // Determine structuralState (Requirement 4)
      if (ty.vmax < 17.2 && !ty.landed) {
        ty.structuralState = 1; // Tropical Disturbance
      } else if (ty.isStructureDamaged) {
        ty.structuralState = 7; // Center Structure Damaged
      } else if (ty.landed) {
        ty.structuralState = 6; // Landfall Weakening
      } else if (ty.ewrcState === "recovering_failure") {
        ty.structuralState = 5; // Failed ERC
      } else if (ty.ewrcState !== "none" && ty.ewrcState !== "completed") {
        ty.structuralState = 4; // Normal ERC
      } else if (upwellingCooling > 1.2) {
        ty.structuralState = 3; // Cold water upwelling suppression
      } else {
        ty.structuralState = 2; // Normal Strengthening
      }

      // Determine eyeType (Requirement 4)
      if (ty.vmax < 30 || ty.structuralState === 1 || ty.structuralState === 7) {
        ty.eyeType = "none";
      } else if (ty.structuralState === 6 || ty.shear > 18) {
        ty.eyeType = "gap";
      } else if (ty.shear > 12) {
        ty.eyeType = "eccentric";
      } else if (ty.structuralState === 5) {
        ty.eyeType = "broken";
      } else if (ty.vmax >= 51) {
        ty.eyeType = "small_round";
      } else if (ty.vmax >= 41) {
        ty.eyeType = "large_round";
      } else {
        ty.eyeType = "irregular";
      }

      // 1. Calculate Maximum Potential Intensity (MPI) based on SST and OHC
      // Warm water supports higher maximum intensity.
      const sstFactor = Math.max(0, sstVal - 15);
      let baseMPI = 16.0 + 3.6 * Math.pow(sstFactor, 1.22) * (1.0 + ohcVal / 180.0); 
      
      // Numerical safety guard for baseMPI
      if (isNaN(baseMPI) || !isFinite(baseMPI)) baseMPI = 60.0;
      
      // 2. Adjust potential based on vertical wind shear, humidity (RH), and outflow channels
      // Non-linear realistic regime-based vertical wind shear MPI reduction (Requirement 7)
      let shearReduction = 0;
      if (shearVal < 10.0) {
        shearReduction = 0.02 * (shearVal / 10.0);
      } else if (shearVal < 20.0) {
        const frac = (shearVal - 10.0) / 10.0;
        shearReduction = 0.02 + 0.23 * Math.pow(frac, 1.5);
      } else if (shearVal < 32.0) {
        const frac = (shearVal - 20.0) / 12.0;
        shearReduction = 0.25 + 0.40 * Math.pow(frac, 1.2);
      } else {
        const excess = Math.min(20.0, shearVal - 32.0);
        shearReduction = 0.65 + 0.20 * (excess / 20.0);
      }
      const rhFactor = Math.max(0.10, Math.min(1.0, Math.pow(rhVal / 80.0, 1.8))); // dry air significantly reduces intensity under low RH
      const outflowFactor = Math.max(0.65, Math.min(1.35, outflowScore * 2.2)); // outflow channel boosts it
      
      const environmentalMPI = baseMPI * (1.0 - shearReduction) * rhFactor * outflowFactor;

      // Extratropical Transition (ET) Weakening Slowdown (New Requirement)
      // Gradually reduce overall weakening speed as the system transitions northwards into the baroclinic zone
      let etSlowdownFactor = 1.0;
      if (config.westerliesEnabled && newLat > (config.westerliesLat ?? 30.0) - 2.0) {
        const etDepth = Math.min((newLat - ((config.westerliesLat ?? 30.0) - 2.0)) / 12.0, 1.0);
        etSlowdownFactor = 1.0 - (etDepth * 0.55); // Up to 55% reduction in weakening speed
      }

      // Check if intercepted by westerlies and moving rapidly (speed > 40 km/h) (Requirement 4)
      const isInterceptedByFastWesterlies = config.westerliesEnabled && 
                                            (newLat >= (config.westerliesLat ?? 30.0) - 3.0) && 
                                            (speedKmh > 40.0);

      // 3. Raw change rate is determined continuously relative to MPI
      const maxLimit = config.maxIntensityLimitEnabled ? (config.maxIntensityLimit ?? 70) : 95;
      let vmaxDeltaPerHour = 0;
      if (ty.vmax < environmentalMPI) {
        // Strengthening rate: proportional to environmental favors and remaining growth room
        const rate = (config.intensificationRate ?? 1.0);
        // Monotonically decreasing curve: intensification potential slows as intensity increases
        const g_v = 1.5 / (1.0 + Math.pow(ty.vmax / 50.0, 1.2)); 
        
        // Calibrated coefficient to achieve realistic intensification
        const baseCoeff = 0.16 + 0.34 * rate;
        
        const growthRoom = environmentalMPI - ty.vmax;
        const envFavorability = Math.max(0.05, favScore + 0.5); // shift overall favors to positive range
        vmaxDeltaPerHour = baseCoeff * envFavorability * Math.sqrt(growthRoom) * g_v;

        // Requirement: Intensification rate scaling
        vmaxDeltaPerHour *= 0.54;

        // Requirement 3: Lower intensification rate if peak intensity limit is low
        vmaxDeltaPerHour *= lowPeakFactor;

        // Requirement: Global intensification rate cap = 1.85 m/s per hour at rate = 1.0 (100%)
        const maxAllowedIntensificationRate = 1.85 * rate;
        vmaxDeltaPerHour = Math.min(maxAllowedIntensificationRate, vmaxDeltaPerHour);

        // Slow down intensification as typhoon approaches peak potential; once at peak, fluctuate within +/-0.4 m/s
        if (growthRoom < 3.0) {
          const approachFactor = Math.max(0.1, (1.0 - Math.exp(-growthRoom / 1.5)));
          vmaxDeltaPerHour *= approachFactor;
          if (growthRoom < 0.6) {
            // Fluctuate within +/-0.4 m/s when at peak intensity
            const peakFluctuation = Math.sin((ty.history?.length || 0) * 0.7 + (ty.lat * 3.1)) * 0.4;
            vmaxDeltaPerHour += peakFluctuation;
          }
        }

        // Non-linear deceleration as typhoon approaches user-configured maximum intensity limit
        if (config.maxIntensityLimitEnabled && ty.vmax < maxLimit) {
          const growthToLimit = maxLimit - ty.vmax;
          if (growthToLimit > 0 && growthToLimit < 18.0) {
            const p = Math.max(0.0, growthToLimit / 18.0);
            const limitApproachFactor = 0.25 + 0.75 * Math.pow(Math.sin(p * Math.PI / 2), 0.85);
            vmaxDeltaPerHour *= limitApproachFactor;
          }
        }

        // Apply persistent upwelling penalty (Weakened impact)
        if (upwellingPersistentPenaltyHours > 0) {
          vmaxDeltaPerHour *= 0.7;
        }

        // Apply structural damage penalty
        vmaxDeltaPerHour *= structuralDamagePenaltyFactor;
      } else {
        // Weakening rate: proportional to how much we exceed MPI
        const excess = ty.vmax - environmentalMPI;
        // Reduced constant penalty and scaling to avoid sudden drops on sea
        // Added a cap to the weakening rate to prevent "sudden crash" behavior on open water
        // Base weakening rate adjusted by ET slowdown factor (Requirement)
        vmaxDeltaPerHour = Math.max(-3.2, -0.08 * excess - 0.25);
        if (vmaxDeltaPerHour < 0) {
          vmaxDeltaPerHour *= etSlowdownFactor;
        }
      }

      // 2. High-intensity typhoons have much higher SST requirements
      const requiredSST = 26.5 + Math.max(0, (ty.vmax - 17.2) / 50.8) * 2.5; 
      if (sstVal < requiredSST) {
        const sstDeficit = requiredSST - sstVal;
        const intensityScale = Math.pow(ty.vmax / 17.2, 1.5);
        let sstPenalty = 0.35 * sstDeficit * intensityScale;
        
        // Rapid translation in westerlies prevents low SST decay via baroclinic energy coupling
        if (isInterceptedByFastWesterlies) {
          sstPenalty *= 0.15; // 85% reduction in SST-deficit decay speed
        }
        
        // Apply ET slowdown (baroclinic energy support)
        if (sstPenalty > 0) {
          sstPenalty *= etSlowdownFactor;
        }
        
        vmaxDeltaPerHour -= sstPenalty;

        if (ty.vmax > 32.7 && sstVal < requiredSST - 0.5) {
          let sstLimitDecay = -0.2 * sstDeficit * (ty.vmax / 32.7);
          if (isInterceptedByFastWesterlies) {
            sstLimitDecay *= 0.15;
          }
          if (sstLimitDecay < 0) {
            sstLimitDecay *= etSlowdownFactor;
          }
          vmaxDeltaPerHour = Math.min(sstLimitDecay, vmaxDeltaPerHour);
        }
      }

      // Westerlies interaction decay (Requirement 2)
      if (config.westerliesEnabled && newLat >= config.westerliesLat - 3) {
        const depth = Math.min((newLat - (config.westerliesLat - 3.0)) / 10.0, 1.0);
        let westerliesDecay = 0.35;
        if (ty.vmax > 28.4) {
          // Strong decay above 10级 (28.4 m/s)
          westerliesDecay = 1.8 + (ty.vmax - 28.4) * 0.15;
        } else if (ty.vmax >= 13.9) {
          // Slower decay in 7-10级 range (13.9 - 28.4 m/s)
          westerliesDecay = 0.15 + (ty.vmax - 13.9) * 0.11;
        } else {
          // Extremely slow decay below 7级
          westerliesDecay = 0.05;
        }
        
        // Rapid translation also shields the core from dry air/shear erosion of westerlies
        if (isInterceptedByFastWesterlies) {
          westerliesDecay *= 0.25; // 75% reduction
        }
        
        // ET slowdown also applies to westerlies-induced decay
        if (westerliesDecay > 0) {
          westerliesDecay *= etSlowdownFactor;
        }
        
        vmaxDeltaPerHour -= westerliesDecay * depth;
      }

      // Cold water upwelling decay: force active intensity decay when speed < 12km/h over sea
      if (!metrics.isLand && speedKmh < 12.0) {
        // Calculate a slowness multiplier that increases as speed drops below 12 km/h
        const slownessFactor = (12.0 - speedKmh) / 12.0; // 0 (at 12) to 1.0 (at 0)
        // Immediate suppression penalty: even if upwelling hours are low, we immediately cap growth
        // Stronger typhoons create stronger upwelling, hence faster decay
        const strengthFactor = Math.max(1.0, ty.vmax / 25.0);
        
        // Base penalty that scales with slowness, strength and coupling coefficient
        const immediatePenalty = 0.25 * slownessFactor * strengthFactor * (config.airSeaCoupling ?? 0.5) * 2.0; // Reduced from 0.45 and 3.0
        
        // Combine with calculated coldWaterDecay
        const totalDecay = Math.max(immediatePenalty, coldWaterDecay);
        
        // Force vmaxDeltaPerHour to be negative! Slow moving typhoons MUST weaken.
        // Apply ET slowdown if applicable
        let forcedWeakening = -0.2 * slownessFactor * strengthFactor;
        let totalDecayWithET = vmaxDeltaPerHour - totalDecay;
        
        if (forcedWeakening < 0) forcedWeakening *= etSlowdownFactor;
        if (totalDecayWithET < 0) totalDecayWithET *= etSlowdownFactor;
        
        vmaxDeltaPerHour = Math.min(forcedWeakening, totalDecayWithET); // Reduced from -0.35
      }
      
      // Enforce physical constraints from environment: force decay if SST <= 26.5 and trying to grow
      if (sstVal <= 26.5 && vmaxDeltaPerHour > 0) {
        // More gradual transition for SST threshold penalty
        const deficit = Math.max(0.1, 26.5 - sstVal);
        vmaxDeltaPerHour = -Math.min(1.5, 0.4 + deficit * 0.5); 
        // Apply ET slowdown
        vmaxDeltaPerHour *= etSlowdownFactor;
      }

      // Requirement 6 & Requirement 8: Atmospheric Peak Fluctuation & Non-Linear Forced Decay
      
      // Calculate atmospheric fluctuation offset when approaching maxLimit (never exceeding maxLimit + 0.4)
      let envPeakOffset = 0;
      if (config.maxIntensityLimitEnabled && ty.vmax >= maxLimit - 2.0) {
        const timePhase = Math.sin((currentSimHour + (ty.id.charCodeAt(0) || 0)) * 0.22) * 0.35 + (this.prng.next() - 0.5) * 0.1;
        envPeakOffset = Math.max(-0.4, Math.min(0.4, timePhase));
      }
      const effectiveMaxLimit = Math.min(maxLimit + 0.4, maxLimit + envPeakOffset);
      const speedFactor = config.speed || 1.0;

      if (config.maxIntensityLimitEnabled && ty.vmax > effectiveMaxLimit) {
         ty.rapidIntensifying = false;
         if (forcedDecayTargetVmax !== maxLimit || forcedDecayStartVmax === undefined || ty.vmax > forcedDecayStartVmax) {
           forcedDecayStartVmax = ty.vmax;
           forcedDecayTargetVmax = maxLimit;
           forcedDecayElapsedHours = 0;

           const decayGap = ty.vmax - effectiveMaxLimit;
           // Rapid & responsive decay when user lowers max intensity limit
           // Weakening speed should not exceed 2m/s/h. So duration should be at least decayGap / 2.0
           let dur = Math.max(1.5, decayGap / 2.0);
           if (metrics.isLand) dur *= 0.8;
           forcedDecayDuration = dur;
         }
         forcedDecayElapsedHours += stepFraction;
         const dur = forcedDecayDuration || 3.0;

         const p = Math.max(0.001, Math.min(1.0, forcedDecayElapsedHours / dur));
         const deltaV = Math.max(0.1, forcedDecayStartVmax - forcedDecayTargetVmax);
         
         // Steady target decay rate
         let targetDecayRate = deltaV / dur;
         
         // Ensure it does not exceed 2m/s/h
         const localEnvQuality = Math.max(0, Math.min(1.0, (sstVal - 26.0) / 3.0 - shearVal / 22.0 + rhVal / 200.0));
         targetDecayRate = Math.min(localEnvQuality > 0.65 ? 1.2 : 2.0, targetDecayRate);

         // Apply forced decay, combining with any stronger environmental decay if present
         const forcedDecayRate = -targetDecayRate;
         vmaxDeltaPerHour = Math.min(vmaxDeltaPerHour, forcedDecayRate);
      } else {
         forcedDecayStartVmax = undefined;
         forcedDecayTargetVmax = undefined;
         forcedDecayElapsedHours = 0;
         forcedDecayDuration = undefined;
         forcedDecayIsContinuous = false;

         if (config.maxIntensityLimitEnabled) {
           const distanceToLimit = effectiveMaxLimit - ty.vmax;
           if (distanceToLimit <= 0.6) {
             // Reached max intensity range: fluctuate smoothly within [maxLimit - 0.4, maxLimit + 0.4]
             const targetFluctuationVmax = maxLimit + Math.sin((currentSimHour * 0.35) + (ty.id.charCodeAt(0) || 0)) * 0.38;
             const diff = targetFluctuationVmax - ty.vmax;
             vmaxDeltaPerHour = Math.max(-0.8, Math.min(0.8, diff * 2.0)) / speedFactor;
           } else if (vmaxDeltaPerHour > 0 && distanceToLimit < 2.5) {
             // Gently cushion near final boundary only (within 2.5 m/s) to prevent overshooting
             const approachFactor = Math.max(0.35, distanceToLimit / 2.5); 
             vmaxDeltaPerHour *= approachFactor;
           }
         }
      }

      // Add seeded natural fluctuation (deterministic noise based on PRNG)
      const prngNoise = (this.prng.next() - 0.5) * 0.25; // small fluctuation
      vmaxDeltaPerHour += prngNoise;

      if (ty.manualForcedDecay) {
        if (ty.vmax > ty.manualForcedDecay.targetVmax) {
          if (ty.manualForcedDecay.startVmax === undefined) {
            ty.manualForcedDecay.startVmax = ty.vmax;
            ty.manualForcedDecay.elapsedHours = 0;
          }
          ty.manualForcedDecay.elapsedHours = (ty.manualForcedDecay.elapsedHours || 0) + stepFraction;
          const progress = Math.min(1.0, ty.manualForcedDecay.elapsedHours / ty.manualForcedDecay.duration);
          
          const deltaV = ty.manualForcedDecay.startVmax - ty.manualForcedDecay.targetVmax;
          const rate = deltaV / ty.manualForcedDecay.duration;
          vmaxDeltaPerHour = Math.min(vmaxDeltaPerHour, -rate);
          
          if (progress >= 1.0) {
            delete ty.manualForcedDecay;
          }
        } else {
          delete ty.manualForcedDecay;
        }
      }

      // Apply Structural Damage Intensity Penalty
      if (isStructureDamaged && !metrics.isLand) {
        const maxElev = (ty as any).maxLandElevationPassed ?? 0;
        const landHrs = (ty as any).landHoursPassed ?? 0;
        const upwHrs = (ty as any).upwellingPersistentPenaltyHours ?? 0;
        if (maxElev > 500 || landHrs > 4 || upwHrs > 6) {
          const growthMultiplier = warmWaterHoursAfterSea >= 6.0 ? 0.80 : 0.20;
          if (vmaxDeltaPerHour > 0) {
            vmaxDeltaPerHour *= growthMultiplier;
          }
        }
      }

      // Landfall Decay Mechanism (New Model)
      // Calculates based on coverage, terrain elevation across the 12-level wind circle, and non-linear intensity scaling
      // Requirement 2: Increase decay when scraping high terrain land (trigger even if 7-level wind circle touches)
      if (metrics.isLand || r10TouchesLand || r7TouchesLand) {
         let coverage = 0;
         if (metrics.isLand) coverage = 1.0;
         else if (r10TouchesLand && r10) coverage = getLandCoverage(newLat, newLon, (r10.ne + r10.nw + r10.sw + r10.se)/4, config?.coastlineSource);
         else if (r7TouchesLand && r7) coverage = getLandCoverage(newLat, newLon, (r7.ne + r7.nw + r7.sw + r7.se)/4, config?.coastlineSource) * 0.3; // r7 coverage has less impact

         // Sample terrain elevation across the entire 12-level wind circle (r12) area
         // Requirement 2: Increase scraping high terrain land effect. Sample using r7 radius if scraping to catch the mountains.
         const r12Radius = (r12 && r12.ne > 0) ? (r12.ne + r12.nw + r12.se + r12.sw)/4 : (r10 ? (r10.ne + r10.nw)/2 * 0.7 : 35);
         const searchRadius = r7TouchesLand ? ((r7.ne + r7.nw + r7.se + r7.sw)/4) : r12Radius;
         const terrainSample = getMaxElevationInRadius(newLat, newLon, searchRadius, config?.coastlineSource);
         const maxElevation = terrainSample.maxElevation;

         // Non-linear decay scaling: High-intensity typhoons decay rapidly upon landfall due to loss of warm ocean moisture.
         // When dropping below category 12 (32.7m/s), decay continues at realistic speeds (0.8 - 1.8 m/s per hour) rather than stalling.
         // Below category 8 (< 17.2m/s), decay accelerates significantly to quickly dissipate tropical lows into remnants.
         let intensityFactor = 0.6;
         if (ty.vmax > 32.7) {
            intensityFactor = 1.2 + 1.8 * Math.pow((ty.vmax - 32.7) / 25.0, 0.9);
         } else if (ty.vmax > 17.2) {
            // Speed up weakening for 8-9 level tropical storms over land (17.2 - 24.4 m/s)
            const tFactor = (ty.vmax - 17.2) / 15.5;
            if (ty.vmax <= 24.5) {
               intensityFactor = 1.0 + 0.65 * tFactor;
            } else {
               intensityFactor = 0.6 + 0.8 * tFactor;
            }
         } else {
            // Speed up weakening for storms below level 8 (17.2m/s) over land
            intensityFactor = 1.05 + 0.65 * (1.0 - ty.vmax / 17.2);
         }
         // 深入内陆水汽供应不足后减弱速度加快
         const deepInlandFactor = 1.0 + Math.min(1.5, landHours / 18.0);

         // High-elevation terrain impact (Requirement 4: Reduced multipliers)
         let elevationScale = 11000.0;
         let terrainMulti = 0.09;
         let luzonFactor = 1.0;
         if (newLat >= 12 && newLat <= 19 && newLon >= 119 && newLon <= 123) {
            // Luzon (reduced terrain impact)
            elevationScale = 42000.0;
            terrainMulti = 0.006;
            luzonFactor = 0.82; // Slightly weaken the rate of intensity decrease on Luzon by 18%
         }
         if (newLat >= 18 && newLat <= 20.5 && newLon >= 108.5 && newLon <= 111.5) {
            // Hainan (drastically cut Wuzhi Mountain extra decay)
            elevationScale = 48000.0;
            terrainMulti = 0.0035;
         }
         // Taiwan mountain decay bonus (slightly strengthened further) (Requirement 3)
         if (newLat >= 21.5 && newLat <= 25.5 && newLon >= 119.5 && newLon <= 122.5) {
            // Taiwan Central Mountain Range
            elevationScale = 6200.0; 
            terrainMulti = 0.48; 
            if (ty.vmax > 30.0) {
              const taiwanShred = 1.0 + Math.pow((ty.vmax - 30.0) / 12.0, 1.2) * 0.38;
              terrainMulti *= taiwanShred;
            }
         }

         // Durational scaling: terrain height effect increases over continuous contact up to a cap
         const durationScale = Math.min(1.0, landContactHours / 24.0);
         const r10DurationFactor = Math.min(1.2, r10LandContactHours / 16.0);
         const elevationEffectMultiplier = (1.0 + 0.6 * Math.pow(durationScale, 1.25)) * (1.0 + r10DurationFactor * 0.5);
         const adjustedTerrainMulti = terrainMulti * elevationEffectMultiplier;

         const elevationFactor = Math.pow(maxElevation / elevationScale, 0.95);
         const r10FrictionMultiplier = 1.0 + 0.4 * Math.min(1.0, r10LandContactHours / 12.0);
         const baseLandDecay = (0.85 + elevationFactor * adjustedTerrainMulti) * intensityFactor * deepInlandFactor * r10FrictionMultiplier * luzonFactor;
         
         // Sea Wind Circle Gain Logic: 
         // If part of the wind circle is still over the sea, reduce the landfall decay.
          // This is to simulate the "island effect" (Taiwan, Hainan) where the sea continues to provide energy.
          const seaCoverage = 1.0 - coverage;
          // The more core the wind circles are on the sea, the slower the weakening.
          // We use the r10 coverage as a proxy for "core" sea contact.
          const coreSeaCoverage = 1.0 - (r10TouchesLand ? getLandCoverage(newLat, newLon, (r10.ne + r10.nw)/2, config?.coastlineSource) : 0);
          const seaGainFactor = Math.max(0.4, 1.0 - (seaCoverage * 0.5 + coreSeaCoverage * 0.35));
          
          const finalLandDecay = baseLandDecay * coverage * seaGainFactor;
          
          // Casualties estimation (more reasonable calculation)
          if (ty.vmax > 17 && (metrics.isLand || r7TouchesLand)) {
             let basePopDensity = 100;
             if (newLat > 20 && newLat < 40 && newLon > 110 && newLon < 125) basePopDensity = 500;
             else if (newLat > 30 && newLat < 45 && newLon > 128 && newLon < 145) basePopDensity = 300;
             else if (newLat > 5 && newLat < 20 && newLon > 115 && newLon < 125) basePopDensity = 400;
             
             // Wind damage scales with power of 3 for intensity, but let's add a lower threshold for structural failure
             const windDamageFactor = Math.pow(Math.max(0, ty.vmax - 17) / 13.0, 3.2); 
             // Rain damage factor: slow moving typhoons cause more flooding
             const speedFactor = Math.max(0.5, 2.5 - speedKmh / 15.0);
             const rainDamageFactor = (ty.vmax / 25.0) * (maxElevation > 300 ? 2.0 : 1.0) * speedFactor;
             
             const area = Math.PI * Math.pow(Math.max(30, r7 ? (r7.ne+r7.nw)/2 : 30), 2);
             
             let casualtyMultiplier = 1.0;
             // Half casualties for Mainland China (excluding Taiwan and Hainan)
             if (newLat > 18 && newLat < 45 && newLon > 105 && newLon < 123) {
               const isTaiwan = newLat >= 21.5 && newLat <= 25.5 && newLon >= 119.5 && newLon <= 122.5;
               const isHainan = newLat >= 18 && newLat <= 20.5 && newLon >= 108.5 && newLon <= 111.5;
               if (!isTaiwan && !isHainan) {
                 casualtyMultiplier = 0.4; // Slightly reduced from 0.5
               }
             }
             
             // Calibrated constant for more realistic numbers
             const casualtiesThisStep = (area * basePopDensity * coverage * (windDamageFactor * 0.7 + rainDamageFactor * 0.3)) * 0.00000003 * stepFraction * casualtyMultiplier;
             currentCasualties += casualtiesThisStep;
          }

          if (config.landDecayEnabled && finalLandDecay > 0) {
             let effectiveDecay = finalLandDecay;

             // 台风水汽供应机制：中低层水汽充足(相对湿度 rhVal >= 55%)时，强水汽输送提供持续潜热释放，但陆地摩擦依然占主导
             const moistureSupply = Math.max(0.0, Math.min(1.0, (rhVal - 50.0) / 40.0));
             const moistureReduction = 0.25 * moistureSupply;
             effectiveDecay *= (1.0 - moistureReduction);
             
             // ET slowdown also applies to landfall decay as baroclinic energy can sustain transitioning systems
             effectiveDecay *= etSlowdownFactor;

             if (metrics.isLand) {
                const landfallAdjustmentFactor = Math.max(0.01, 1.0 + (config.landfallDecayAdjustment ?? 0.0));
                effectiveDecay *= landfallAdjustmentFactor;
                // If center is on land, decay dominates
                vmaxDeltaPerHour = -effectiveDecay;
             } else {
                const proximityAdjustmentFactor = Math.max(0.01, 1.0 + (config.landProximityDecayAdjustment ?? 0.0));
                effectiveDecay *= proximityAdjustmentFactor;
                
                // In the South China Sea (semi-enclosed), dampen the land proximity penalty slightly
                if (newLon > 110 && newLon < 120 && newLat > 10 && newLat < 22) {
                  effectiveDecay *= 0.65;
                }

                // If center is still on sea, land decay is a penalty but we ensure it doesn't cause a "crash"
                // We use a non-linear combination: take the worse of (env decay) and (land decay), 
                // then add a small portion of the other to avoid discontinuity.
                const envDelta = vmaxDeltaPerHour;
                // Scraping detection: if it's been touching land for >3 hours but center is still not on land
                // it's likely scraping rather than a direct approach. Increase the decay.
                let scrapingMultiplier = 0.75; 
                if (landContactHours > 3.0) {
                    const scrapeIntensity = Math.min(1.0, (landContactHours - 3.0) / 6.0);
                    scrapingMultiplier = 0.75 + 0.65 * scrapeIntensity; // Up to 1.4x effectiveDecay
                }
                const landDelta = -effectiveDecay * scrapingMultiplier; 
                
                if (envDelta < 0) {
                   // Both are negative, take the more negative one plus a fraction of the other
                   vmaxDeltaPerHour = Math.min(envDelta, landDelta) + Math.max(envDelta, landDelta) * 0.2;
                } else {
                   // Environmental is positive, land is negative
                   vmaxDeltaPerHour = envDelta + landDelta;
                }
                
                // Final safety cap for open-water proximity weakening
                vmaxDeltaPerHour = Math.max(-10.5, vmaxDeltaPerHour);
             }
          }
       }
       
       // Limit acceleration bounds - global hard cap: intensification rate <= 2.2 m/s per hour under all conditions
       vmaxDeltaPerHour = Math.max(-12.5, Math.min(2.2, vmaxDeltaPerHour));
       
       // Dynamic states
       let rapidIntensifying = ty.rapidIntensifying;
       let ewrcState = ty.ewrcState;
       let ewrcProgress = ty.ewrcProgress;
       let ewrcDuration = ty.ewrcDuration ?? 12;
       let ewrcWeakenAmount = ty.ewrcWeakenAmount ?? 6;
       let ewrcColdWakeHours = ty.ewrcColdWakeHours ?? 0;
       let ewrcL12LandHours = ty.ewrcL12LandHours ?? 0;
       let ewrcStartVmax = ty.ewrcStartVmax ?? ty.vmax;
       let ewrcExtraAdjust = ty.ewrcExtraAdjust ?? 0;
       let ewrcRecoveryDuration = ty.ewrcRecoveryDuration ?? 12;
       let rmw = Math.max(7.5, Math.min(22.5, ty.rmw));
 
       // A. Rapid Intensification (RI) trigger
       if (
         config.rapidIntensifyEnabled &&
         !rapidIntensifying &&
         vmaxDeltaPerHour > 0.8 &&
         ty.vmax >= 25.0 &&
         !metrics.isLand &&
         ewrcState === "none"
       ) {
         // Trigger condition: perfect environments
         if (sstVal >= 28.5 && shearVal < 8.0 && rhVal > 72.0) {
           const triggerRoll = this.prng.next();
           if (triggerRoll < 0.28) { // 28% chance when environment is flawless
             rapidIntensifying = true;
             // Suppressed as requested: do not show every intensity change event
           }
         }
       }
 
       // RI growth boost
       if (rapidIntensifying) {
         // Dynamic parameter-driven RI boost:
         // Boost scales dynamically with extreme warm SST (> 28.0C), very low wind shear (< 10 knots), and high OHC
         const sstBoost = Math.max(0, sstVal - 28.0) * 0.45;
         const shearBoost = Math.max(0, 10.0 - shearVal) * 0.08;
         const ohcBoost = Math.min(1.0, ohcVal / 120.0) * 0.35;
         const dynamicBoost = 0.5 + sstBoost + shearBoost + ohcBoost;
         
         vmaxDeltaPerHour = Math.max(vmaxDeltaPerHour, 1.5) + dynamicBoost;
         rmw = Math.max(7.5, rmw - 0.5); // core collapses to smaller radius
         
         // Terminate RI if environmental score drops, or if too intense
         if (favScore < 0.1 || ty.vmax >= 58.0 || metrics.isLand) {
           rapidIntensifying = false;
           // Suppressed as requested: do not show every intensity change event
         }
       }
 
      // B. Eyewall Replacement Cycle (EWRC)
      // Requirement 7: Prohibit EWRC near coast; env-based duration (12-18h / 24-36h / 19-25h); failure penalty logic
      let ewrcFailureRestoredVmax: number | null = null;
      const isNearCoastForEWRC = metrics.isLand || landContactHours > 1.5;
      
      const hasForcedEWRC = ty.forcedEWRC !== undefined;
      if (hasForcedEWRC) {
        ewrcState = "none";
        ewrcCooldownHours = 0;
      }
      
      if (hasForcedEWRC || (config.ewrcTrigger !== "off" && !isNearCoastForEWRC && ewrcCooldownHours <= 0)) {
        const canForce = config.ewrcTrigger === "force" && ewrcState === "none" && ty.vmax >= 55.0;
        
        let prob = 0.0;
        if (ty.vmax >= 55.0) { prob = 0.08 + Math.max(0, (ty.vmax - 55.0) / 250.0); }
        
        const canAuto = config.ewrcTrigger === "auto" && ewrcState === "none" && ty.vmax >= 55.0 && vmaxDeltaPerHour > 0 && this.prng.next() < prob;

        if (hasForcedEWRC || canForce || canAuto) {
          const envQuality = Math.max(0, Math.min(1.0, (sstVal - 26.0) / 3.0 - shearVal / 22.0 + rhVal / 200.0));
          
          ewrcState = "forming";
          ewrcProgress = 0;
          
          // Duration based on environment: excellent -> 12-18h (rare 12h), poor -> 24-36h, normal -> 19-25h
          let dur = 19.0 + this.prng.next() * 6.0;
          if (envQuality >= 0.85) {
            dur = 12.0 + this.prng.next() * 6.0;
          } else if (envQuality < 0.35 || isNearCoastForEWRC) {
            dur = 24.0 + this.prng.next() * 12.0;
          }
          ewrcDuration = dur;
          ewrcWeakenAmount = 4.0 + this.prng.next() * 6.0;
          ewrcColdWakeHours = 0;
          ewrcL12LandHours = 0;
          ewrcStartVmax = ty.vmax;
          ewrcExtraAdjust = 0;
          ewrcRecoveryDuration = 8.0 + this.prng.next() * 6.0;
          
          if (hasForcedEWRC) {
            ty.ewrcIsFailure = (ty.forcedEWRC === "failure");
            delete ty.forcedEWRC;
          } else {
            // Pre-determine failure chance based on environment (mostly success in favorable open ocean)
            let failProb = 0.10 + Math.max(0, (0.75 - envQuality) * 0.4);
            if (isNearCoastForEWRC || ewrcL12LandHours > 0) failProb += 0.40;
            if (shearVal > 18.0) failProb += 0.25;
            
            ty.ewrcIsFailure = (this.prng.next() < failProb);
          }
          ty.ewrcCount = (ty.ewrcCount || 0) + 1;
          
          logs.push({
            id: `ewrc-start-${ty.id}-${currentSimHour}`,
            time: new Date(),
            simHour: currentSimHour,
            type: "warning",
            message: `🌀 眼墙置换启动：${ty.name} 达到 ${getWindForceCategory(ty.vmax)} 级，启动第 ${(ty.ewrcCount)} 次眼墙置换 (EWRC)。预计周期 ${ewrcDuration.toFixed(1)}h，外围风圈收缩，强度暂时回落。`
          });
        }
      }

      if (ewrcState === "forming" || ewrcState === "max_decay") {
        ewrcProgress += stepFraction / ewrcDuration;
        
        // Continuous intensity drop during EWRC replacement
        const weakenRate = (ewrcWeakenAmount / ewrcDuration);
        vmaxDeltaPerHour -= weakenRate;

        // Track Cold Water Upwelling time during EWRC
        if (coldWaterDecay > 0) {
          ewrcColdWakeHours += stepFraction;
        }
        
        // Track land scraping / contact during EWRC
        const isCoreLandScraping = metrics.isLand || landContactHours > 1.0;
        if (isCoreLandScraping) {
          ewrcL12LandHours += stepFraction;
        }
        
        if (ewrcProgress < 0.5) {
          if (ewrcState !== "forming") { ewrcState = "forming"; }
          rmw = Math.min(22.5, rmw + (6.0 / (ewrcDuration / 2)) * stepFraction);
        } else {
          if (ewrcState !== "max_decay") { ewrcState = "max_decay"; }
          rmw = Math.max(16.0, rmw - 0.2);
        }
        
        const isSevereLandFail = isCoreLandScraping && ewrcProgress >= 0.1;
        const isSevereShearFail = shearVal > 25.0 && ewrcProgress >= 0.1;
        const isSevereSSTFail = sstVal < 25.0 && ewrcProgress >= 0.1;
        const isColdWaterFail = (ewrcColdWakeHours / ewrcDuration >= 0.40) && ewrcProgress >= 0.1;

        if (isSevereLandFail || isSevereShearFail || isSevereSSTFail || isColdWaterFail) {
          const envQuality = Math.max(0, Math.min(1.0, (sstVal - 26.0) / 3.0 - shearVal / 22.0 + rhVal / 200.0));
          ewrcState = "penalty_failure";
          ewrcProgress = 0;
          
          // Scaled by typhoon intensity: stronger typhoons suffer longer and deeper penalty
          const intensityRatio = Math.max(1.0, ty.vmax / 38.0);
          ty.ewrcPenaltyTotalHours = (10.0 + (1.0 - envQuality) * 12.0) * Math.pow(intensityRatio, 0.7);
          ty.ewrcFailurePenaltyHours = 0;
          
          // Immediate structural shock drop proportional to intensity
          const shockDrop = Math.min(12.0, (ty.vmax / 45.0) * 4.0);
          ty.vmax = Math.max(18.0, ty.vmax - shockDrop);
          
          let failReason = "核心接触陆地地形受损";
          if (isSevereShearFail) failReason = `强风切(${Math.round(shearVal)}kt)撕裂外围眼墙`;
          else if (isSevereSSTFail) failReason = `低海温(${sstVal.toFixed(1)}℃)潜热供给不足`;
          else if (isColdWaterFail) failReason = `冷水上翻强烈`;

          logs.push({
            id: `ewrc-fail-${ty.id}-${currentSimHour}`,
            time: new Date(),
            simHour: currentSimHour,
            type: "danger",
            message: `🌀 置换宣告崩溃：${ty.name} 由于【${failReason}】，双眼墙结构坍塌瓦解，置换失败！强度瞬间挫跌 ${shockDrop.toFixed(1)}m/s，进入 ${ty.ewrcPenaltyTotalHours.toFixed(1)}h 严重发展受抑惩罚期。`
          });
        } else if (ewrcProgress >= 1.0) {
          const envQuality = Math.max(0, Math.min(1.0, (sstVal - 26.0) / 3.0 - shearVal / 22.0 + rhVal / 200.0));
          ewrcProgress = 0;
          
          if (!ty.ewrcIsFailure) {
            ewrcState = "recovering_success";
            let extraRise = 3.0 + this.prng.next() * 5.0;
            if (config.maxIntensityLimitEnabled && config.maxIntensityLimit) {
              const target = config.maxIntensityLimit;
              if (ty.vmax < target - 5) {
                const gap = target - ty.vmax;
                extraRise = Math.max(extraRise, Math.min(10.0, gap * 0.25 + this.prng.next() * 3.0));
              }
            }
            ewrcExtraAdjust = (ewrcWeakenAmount + extraRise) / ewrcRecoveryDuration;
            
            logs.push({
              id: `ewrc-success-${ty.id}-${currentSimHour}`,
              time: new Date(),
              simHour: currentSimHour,
              type: "success",
              message: `🌀 置换宣告成功：${ty.name} 新风眼完全重塑巩固！第 ${ty.ewrcCount || 1} 次眼墙置换成功，强度在接下来 ${ewrcRecoveryDuration.toFixed(1)}h 内平滑上涨 ${extraRise.toFixed(1)} m/s。`
            });
          } else {
            // Failure: No recovery, transition to penalty period
            ewrcState = "penalty_failure";
            
            // Scaled by typhoon intensity: stronger typhoons suffer longer and deeper penalty
            const intensityRatio = Math.max(1.0, ty.vmax / 38.0);
            ty.ewrcPenaltyTotalHours = (10.0 + (1.0 - envQuality) * 12.0) * Math.pow(intensityRatio, 0.7);
            ty.ewrcFailurePenaltyHours = 0;
            
            // Immediate structural shock drop proportional to intensity
            const shockDrop = Math.min(12.0, (ty.vmax / 45.0) * 4.0);
            ty.vmax = Math.max(18.0, ty.vmax - shockDrop);
            
            logs.push({
              id: `ewrc-failed-${ty.id}-${currentSimHour}`,
              time: new Date(),
              simHour: currentSimHour,
              type: "danger",
              message: `🌀 置换宣告失败：${ty.name} 第 ${ty.ewrcCount || 1} 次置换遭遇不良环境阻碍，核心流场失稳，置换失败且强度瞬间挫跌 ${shockDrop.toFixed(1)}m/s，进入 ${ty.ewrcPenaltyTotalHours.toFixed(1)}h 发展受抑惩罚期。`
            });
          }
        }
      } else if (ewrcState === "recovering_success") {
        ewrcProgress += stepFraction / ewrcRecoveryDuration;
        vmaxDeltaPerHour += ewrcExtraAdjust;
        
        if (ewrcProgress >= 1.0) {
          ewrcState = "none";
          ewrcProgress = 0;
          ewrcCooldownHours = 36.0;
          logs.push({
            id: `ewrc-recovery-done-${ty.id}-${currentSimHour}`,
            time: new Date(),
            simHour: currentSimHour,
            type: "info",
            message: `🌀 结构稳定：${ty.name} 眼墙置换成功后的恢复期结束，风场结构进入成熟阶段。`
          });
        }
      } else if (ewrcState === "recovering_failure" || ewrcState === "penalty_failure") {
        const totalPenalty = ty.ewrcPenaltyTotalHours || 12.0;
        let penaltyHours = (ty.ewrcFailurePenaltyHours || 0) + stepFraction;
        ty.ewrcFailurePenaltyHours = penaltyHours;

        // Requirement 2: Failing EWRC penalty rate scales non-linearly with typhoon intensity.
        const currentV = Math.max(30.0, ty.vmax);
        const intensityFactor = Math.pow(currentV / 38.0, 1.5);
        const failureDecayRate = -0.55 * intensityFactor;

        vmaxDeltaPerHour = failureDecayRate; 
        ty.isEyeClogged = true;
        ty.isStructureDamaged = true;

        if (penaltyHours >= totalPenalty) {
          ewrcState = "none";
          ewrcProgress = 0;
          ewrcCooldownHours = 36.0;
          ty.ewrcIsFailure = false;
          delete ty.forcedEWRC;
          ty.ewrcFailurePenaltyHours = 0;
          ty.ewrcPenaltyTotalHours = 0;
          
          // Initiate gradual structure recovery phase with core destruction inertia (scaled by intensity)
          ty.cloggedRecoveryTotalHours = Math.min(48.0, 28.0 * Math.max(1.0, ty.vmax / 45.0));
          ty.cloggedRecoveryHours = 0.0;
          
          logs.push({
            id: `ewrc-penalty-done-${ty.id}-${currentSimHour}`,
            time: new Date(),
            simHour: currentSimHour,
            type: "info",
            message: `🌀 惩罚期结束：${ty.name} 置换失败后的 ${totalPenalty.toFixed(1)}h 核心区抑制期结束，中心风眼结构开始缓慢重塑，台风增强速度将随结构稳固逐渐上升恢复。`
          });
        }
      }

      // --- Master Manual Intervention, Penalty, and Gradual Recovery System ---
      
      let forcedDecayTotal = 0;

      // 1. Dry Air Manual Penalty
      if (ty.forcedDryAir) {
        const isCore = ty.forcedDryAir === "core";
        if (ty.dryAirPenaltyHours === undefined || ty.dryAirPenaltyHours === null) {
          ty.dryAirPenaltyTotalHours = isCore ? 24.0 : 36.0; // Core: 24h, Periphery: 36h
          ty.dryAirPenaltyHours = ty.dryAirPenaltyTotalHours;
        }

        const p = Math.max(0, Math.min(1.0, 1.0 - (ty.dryAirPenaltyHours / ty.dryAirPenaltyTotalHours)));
        const rateFactor = Math.sin(p * Math.PI);
        
        // Decay rates:
        // Periphery (外围卷入): -10 to -18 m/s / 24h (average -0.58 m/s/h)
        // Core (核心侵入): -26 to -45 m/s / 24h (average -1.48 m/s/h)
        const dryAirRate = isCore 
          ? - (26.0 + 19.0 * rateFactor) / 24.0 
          : - (10.0 + 8.0 * rateFactor) / 24.0;
        forcedDecayTotal += dryAirRate;

        if (isCore) {
          ty.isEyeClogged = true;
          ty.isStructureDamaged = true;
        }

        ty.dryAirPenaltyHours = Math.max(0, ty.dryAirPenaltyHours - stepFraction);

        if (ty.dryAirPenaltyHours <= 0) {
          const wasCore = isCore;
          delete ty.forcedDryAir;
          delete ty.dryAirPenaltyHours;
          delete ty.dryAirPenaltyTotalHours;
          if (wasCore) {
            ty.cloggedRecoveryTotalHours = 28.0;
            ty.cloggedRecoveryHours = 0.0;
          } else {
            ty.cloggedRecoveryTotalHours = 12.0;
            ty.cloggedRecoveryHours = 0.0;
          }
          logs.push({
            id: `dry-air-done-${ty.id}-${currentSimHour}`,
            time: new Date(),
            simHour: currentSimHour,
            type: "info",
            message: `🍂 干空气干扰结束：${ty.name} 的干空气入侵惩罚期已满 ${wasCore ? "24" : "36"}h，干空气逐渐消散，中心结构开始缓慢重塑。`
          });
        }
      }
      
      // 2. Wind Shear Manual Penalty
      if (ty.forcedShear !== undefined && ty.forcedShear > 15.0) {
        if (ty.shearPenaltyHours === undefined || ty.shearPenaltyHours === null) {
          ty.shearPenaltyTotalHours = ty.forcedShear >= 30.0 ? 24.0 : 16.0;
          ty.shearPenaltyHours = ty.shearPenaltyTotalHours;
        }
        
        ty.isEyeClogged = true;
        ty.isStructureDamaged = true;
        
        const isExtreme = ty.forcedShear >= 30.0;
        const shearRate = isExtreme ? -1.35 : -0.55;
        forcedDecayTotal += shearRate;
        
        ty.shearPenaltyHours = Math.max(0, ty.shearPenaltyHours - stepFraction);

        if (ty.shearPenaltyHours <= 0) {
          const totalH = ty.shearPenaltyTotalHours || (isExtreme ? 24 : 16);
          delete ty.forcedShear;
          delete ty.shearPenaltyHours;
          delete ty.shearPenaltyTotalHours;
          ty.cloggedRecoveryTotalHours = 28.0;
          ty.cloggedRecoveryHours = 0.0;
          logs.push({
            id: `shear-done-${ty.id}-${currentSimHour}`,
            time: new Date(),
            simHour: currentSimHour,
            type: "info",
            message: `⚡ 强风切变压制结束：${ty.name} 的强风切变惩罚期已满 ${totalH}h，风切变平息，核心结构开始缓慢重塑。`
          });
        }
      }

      // Prohibit Rapid Intensification during Dry Air, Strong Shear, or EWRC Failure
      const isEnvironmentalSuppressionActive = !!ty.forcedDryAir || (ty.forcedShear !== undefined && ty.forcedShear > 15.0) || ewrcState === "penalty_failure" || ty.ewrcIsFailure;
      
      // Ensure environmental suppression dominates over background warm SST growth
      if (isEnvironmentalSuppressionActive) {
        if (vmaxDeltaPerHour > 0) {
          vmaxDeltaPerHour = 0;
        }
        if (forcedDecayTotal < 0) {
          vmaxDeltaPerHour += forcedDecayTotal;
        }
        if (vmaxDeltaPerHour > -0.3) {
          vmaxDeltaPerHour = -0.3;
        }
      } else if (forcedDecayTotal < 0) {
        vmaxDeltaPerHour += forcedDecayTotal;
      }
      if (isEnvironmentalSuppressionActive && ty.forcedRapidIntensification) {
        delete ty.forcedRapidIntensification;
        delete (ty as any).forcedRapidIntensificationDuration;
        rapidIntensifying = false;
      }

      // 3. Rapid Intensification Manual Boost
      if (ty.forcedRapidIntensification && !isEnvironmentalSuppressionActive) {
        if ((ty as any).forcedRapidIntensificationDuration === undefined) {
          (ty as any).forcedRapidIntensificationDuration = 18.0; // runs for 18 hours
        }

        const isOverLand = metrics.isLand || landContactHours > 3.0;
        const targetCapEnabled = config.maxIntensityLimitEnabled && maxLimit !== undefined;

        if (isOverLand) {
          // Rapid intensification cannot occur on land! Land friction decay must dominate.
          rapidIntensifying = false;
        } else if (targetCapEnabled && ty.vmax > maxLimit) {
          // Current intensity exceeds target intensity cap! Force weakening towards target.
          vmaxDeltaPerHour = -Math.min(2.5, (ty.vmax - maxLimit) * 1.0 + 0.5);
          rapidIntensifying = false;
        } else if (targetCapEnabled && ty.vmax >= maxLimit) {
          // At target intensity cap
          vmaxDeltaPerHour = 0;
          rapidIntensifying = false;
        } else {
          rapidIntensifying = true;
          ty.isEyeClogged = false;
          ty.isStructureDamaged = false;
          
          // High intensity boost (forced RI), capped by distance to target limit if enabled
          let boost = 2.0;
          if (targetCapEnabled && maxLimit !== undefined) {
            boost = Math.min(2.0, Math.max(0, (maxLimit - ty.vmax) / stepFraction));
          }
          vmaxDeltaPerHour = boost;
          rmw = Math.max(7.5, rmw - 0.5);
        }
        
        (ty as any).forcedRapidIntensificationDuration -= stepFraction;
        if ((ty as any).forcedRapidIntensificationDuration <= 0) {
          delete ty.forcedRapidIntensification;
          delete (ty as any).forcedRapidIntensificationDuration;
          rapidIntensifying = false;
        }
      }
      
      // 4. Gradual Recovery Phase (渐进式增强恢复)
      if (ty.cloggedRecoveryHours !== undefined && ty.cloggedRecoveryTotalHours !== undefined) {
        if (ty.forcedRapidIntensification) {
          // Forced rapid intensification overrides recovery smoothing completely
          delete ty.cloggedRecoveryHours;
          delete ty.cloggedRecoveryTotalHours;
        } else if (ty.cloggedRecoveryHours < ty.cloggedRecoveryTotalHours) {
          ty.cloggedRecoveryHours += stepFraction;
          const recoveryRatio = Math.min(1.0, ty.cloggedRecoveryHours / ty.cloggedRecoveryTotalHours);
          
          // Smooth ease-in curve for gradual recovery of intensification rate back to original speed
          const smoothFactor = recoveryRatio * recoveryRatio * (3 - 2 * recoveryRatio);
          if (vmaxDeltaPerHour > 0) {
            vmaxDeltaPerHour *= smoothFactor;
          }
          
          // Partially restore structural integrity visually
          if (recoveryRatio >= 0.5) {
            ty.isEyeClogged = false;
          }
        } else {
          // Fully recovered
          ty.isEyeClogged = false;
          ty.isStructureDamaged = false;
          delete ty.cloggedRecoveryHours;
          delete ty.cloggedRecoveryTotalHours;
        }
      }

      // C. Extratropical Transition (ET / 温带化) - DELETED
      let extrTransition = 0;

      // Integrate vmax change (Global hard constraint: intensification rate <= 2.2 m/s per hour)
      if (vmaxDeltaPerHour > 2.2) {
        vmaxDeltaPerHour = 2.2;
      }

      // Enforce Target Intensity (maxLimit) strictly
      if (config.maxIntensityLimitEnabled && maxLimit !== undefined) {
        if (ty.vmax > maxLimit) {
          // Actively weaken towards target intensity
          const weakenRate = Math.min(2.5, (ty.vmax - maxLimit) * 1.0 + 0.5);
          if (vmaxDeltaPerHour > -weakenRate) {
            vmaxDeltaPerHour = -weakenRate;
          }
        } else if (ty.vmax >= maxLimit && vmaxDeltaPerHour > 0) {
          vmaxDeltaPerHour = 0;
        }
      }

      let newVmax = ty.vmax + vmaxDeltaPerHour * stepFraction;
      if (config.maxIntensityLimitEnabled && maxLimit !== undefined) {
        if (ty.vmax <= maxLimit) {
          newVmax = Math.min(maxLimit, newVmax);
        } else {
          newVmax = Math.max(maxLimit, newVmax);
        }
      }

      // Numerical safety guard: prevent crashes from NaN/Infinity
      if (isNaN(newVmax) || !isFinite(newVmax)) {
        newVmax = ty.vmax || 10;
      }

      if (ewrcFailureRestoredVmax !== null) {
        newVmax = ewrcFailureRestoredVmax;
      }

      // Track Super Typhoon land duration
      let superTyLandHours = ty.superTyLandHours || 0;
      if (metrics.isLand && newVmax >= 51.0) {
        if (speedKmh < 30.0) {
          superTyLandHours += stepFraction;
        }
      } else {
        superTyLandHours = 0;
      }

      // Limit Super Typhoon on land duration under 8 hours (when speed is < 30km/h)
      if (superTyLandHours >= 8.0 && newVmax >= 51.0) {
        newVmax = 50.8;
        if ((ty.superTyLandHours || 0) < 8.0) {
          logs.push({
            id: `super-ty-land-decay-${ty.id}-${currentSimHour}`,
            time: new Date(),
            simHour: currentSimHour,
            type: "warning",
            message: `⚠️ 强衰减提示：${ty.name} 登陆后在陆地上以低于 30 km/h 的移速维持超强台风级别已达 8 小时，受地形剧烈摩擦与充沛水分断绝影响，强度已被强制降级至强台风。`
          });
        }
      }

      // Absolute limiters
      if (extrTransition >= 0.9) {
        // Fully transitioned to an extratropical cyclone: maintains a broad wind field but max speeds drop
        newVmax = Math.max(15, Math.min(32, newVmax));
      } else {
        newVmax = Math.max(8.0, newVmax);
        // Requirement 2: Once intensity is at or below maxLimit, strictly cap re-growth so it NEVER exceeds target maxLimit
        if (config.maxIntensityLimitEnabled) {
          if (ty.vmax <= maxLimit) {
            newVmax = Math.min(maxLimit, newVmax);
          } else {
            newVmax = Math.min(newVmax, ty.vmax);
          }
        }
      }

      // D. Landfall and Dissipation Checks
      let landed = ty.landed;
      let landfallRecords = ty.landfallRecords ? [...ty.landfallRecords] : [];
      if (metrics.isLand && !landed) {
        landed = true;
        const recIndex = landfallRecords.length;
        const initialRegion = metrics.landName || "沿海地区";
        landfallRecords.push({
          lat: newLat,
          lon: newLon,
          vmax: Number(newVmax.toFixed(1)),
          simHour: Number(currentSimHourFloat.toFixed(1)),
          region: initialRegion
        });
        // Requirement 3: Fetch precision OSM city data on demand (lazily) to avoid unnecessary performance overhead
        fetchOsmCityName(newLat, newLon).then((osmName) => {
          if (osmName && ty.landfallRecords && ty.landfallRecords[recIndex]) {
            ty.landfallRecords[recIndex].region = osmName;
          }
        }).catch(() => {});
        logs.push({
          id: `land-${ty.id}-${currentSimHour}`,
          time: new Date(),
          simHour: currentSimHour,
          type: "danger",
          message: `🚨 台风登陆：${ty.name} 已经在【${metrics.landName}】附近沿海登陆，最大风力 ${Math.round(newVmax)} m/s (约${getWindForceCategory(newVmax)}级)。受地形摩擦与水分切断，强度开始剧烈衰减！`
        });
      } else if (!metrics.isLand && landed) {
        // Re-enters sea
        landed = false;
        logs.push({
          id: `sea-reentry-${ty.id}-${currentSimHour}`,
          time: new Date(),
          simHour: currentSimHour,
          type: "success",
          message: `🌊 重返海洋：${ty.name} 中心移回海洋面，开始重新整合云系。`
        });
      }

      let dissipated = ty.dissipated;
      let tdHours = ty.tdHours || 0;
      let landTdHours = ty.landTdHours || 0;
      let etHours = ty.etHours || 0;

      if (extrTransition >= 0.8) {
        etHours += stepFraction;
      } else {
        etHours = 0;
      }

      if (newVmax < 17.2) {
        tdHours += stepFraction;
        if (metrics.isLand) {
          landTdHours += stepFraction;
        } else {
          landTdHours = 0;
        }
      } else {
        tdHours = 0;
        landTdHours = 0;
      }

      // Termination conditions:
      // 1. Landfall TD dissipation: if config mode is '6h' (default), stop after 6h as TD on land
      // 2. Extratropical Cyclone: 12 hours as ET OR (is ET and lon >= 160.0°E)
      // 3. Stays as TD for 72 hours continuously
      // 4. Crosses 170.0°E boundary
      // 5. Ocean weakens below 10.8m/s (TD lower bound)
      const landTdMode = config?.landTdDissipateMode || "6h";
      const isLandTdDissipate = landTdMode === "6h" && metrics.isLand && newVmax < 17.2 && landTdHours >= 6.0;
      const isOceanWeakenBelow10_8 = !landed && !metrics.isLand && newVmax < 10.8;

      if (isOceanWeakenBelow10_8 && !dissipated) {
        dissipated = true;
        newVmax = 8.0;
        logs.push({
          id: `dissipate-ocean-weaken-10_8-${ty.id}-${currentSimHour}`,
          time: new Date(),
          simHour: currentSimHour,
          type: "info",
          message: `💤 停止编号：${ty.name} 在海上减弱至 10.8 m/s 以下 (热带低压下限)，中央气象台对其停止编号。`
        });
      } else if (newLon >= 170.0 && !dissipated) {
        dissipated = true;
        newVmax = 8.0;
        logs.push({
          id: `dissipate-170e-${ty.id}-${currentSimHour}`,
          time: new Date(),
          simHour: currentSimHour,
          type: "info",
          message: `💤 停止编号：${ty.name} 已经移过东经 170º (越过责任警戒区边界)，中央气象台对其停止编号。`
        });
      } else if (isLandTdDissipate && !dissipated) {
        dissipated = true;
        newVmax = 8.0;
        logs.push({
          id: `dissipate-land-td-${ty.id}-${currentSimHour}`,
          time: new Date(),
          simHour: currentSimHour,
          type: "info",
          message: `💤 停止编号：${ty.name} 登陆减弱为热带低压已满 6 小时，中央气象台对其停止编号。`
        });
      } else if (etHours >= 12.0 && !dissipated) {
        dissipated = true;
        newVmax = 8.0;
        logs.push({
          id: `dissipate-et-12h-${ty.id}-${currentSimHour}`,
          time: new Date(),
          simHour: currentSimHour,
          type: "info",
          message: `💤 停止编号：${ty.name} 变性为温带气旋满 12 小时，中央气象台对其停止编号。`
        });
      } else if ((etHours > 0 || extrTransition >= 0.8) && newLon >= 160.0 && !dissipated) {
        dissipated = true;
        newVmax = 8.0;
        logs.push({
          id: `dissipate-et-160e-${ty.id}-${currentSimHour}`,
          time: new Date(),
          simHour: currentSimHour,
          type: "info",
          message: `💤 停止编号：${ty.name} 变性为温带气旋并到达东经 160º，中央气象台对其停止编号。`
        });
      } else if (tdHours >= 72.0 && !dissipated) {
        dissipated = true;
        newVmax = 8.0;
        logs.push({
          id: `dissipate-td-72h-${ty.id}-${currentSimHour}`,
          time: new Date(),
          simHour: currentSimHour,
          type: "info",
          message: `💤 停止编号：${ty.name} 减弱为热带低压已满 72 小时，中央气象台对其停止编号。`
        });
      }

      if (isNaN(newVmax) || !isFinite(newVmax)) newVmax = Math.max(8.0, ty.vmax || 18.0);
      if (isNaN(newLat) || !isFinite(newLat)) newLat = ty.lat || 20.0;
      if (isNaN(newLon) || !isFinite(newLon)) newLon = ty.lon || 135.0;

      // Center Minimum Pressure calculation (pmin) using interpolation:
      // 18m/s -> 997hpa, 68m/s -> 901hpa, etc.
      let targetPmin = calculatePressure(newVmax);
      if (isNaN(targetPmin) || !isFinite(targetPmin)) targetPmin = 998;
      
      const currentPmin = ty.pmin || 998;
      let newPmin = Math.round(currentPmin + (targetPmin - currentPmin) * 0.15);
      if (isNaN(newPmin) || !isFinite(newPmin)) newPmin = targetPmin;

      // Category assessment (China Tropical Cyclone standard)
      let category = TyphoonCategory.TD;
      if (dissipated) {
        category = TyphoonCategory.DS;
      } else if (newVmax >= 51.0) {
        category = TyphoonCategory.SuperTY;
      } else if (newVmax >= 41.5) {
        category = TyphoonCategory.STY;
      } else if (newVmax >= 32.7) {
        category = TyphoonCategory.TY;
      } else if (newVmax >= 24.5) {
        category = TyphoonCategory.STS;
      } else if (newVmax >= 17.2) {
        category = TyphoonCategory.TS;
      }

      // Check for level upgrades to trigger notifications/sound
      if (category !== ty.category && !dissipated) {
        const checkPriority = [TyphoonCategory.TD, TyphoonCategory.TS, TyphoonCategory.STS, TyphoonCategory.TY, TyphoonCategory.STY, TyphoonCategory.SuperTY];
        const prevIndex = checkPriority.indexOf(ty.category);
        const currIndex = checkPriority.indexOf(category);
        if (currIndex > prevIndex && prevIndex !== -1) {
          // Suppressed to keep logs focused on key milestones as requested
        } else if (currIndex < prevIndex && currIndex !== -1 && prevIndex !== -1) {
          // Suppressed to keep logs focused on key milestones as requested
        }
      }

      // Accumulate Ocean Cold Wake path coordinates - DISABLED for maximum program fluidity (Request 10) and cold wake deletion (Request 7)
      
      // Save intermediate history state at full hours
      const nextHour = Math.round(currentSimHour + stepFraction);
      let newHistory = ty.history;
      
      // Stability: Cull history to prevent memory crashes in extremely long sessions
      if (newHistory.length > 400) {
        // Keep initial state, and then the most recent 399 points
        newHistory = [newHistory[0], ...newHistory.slice(-399)];
      }

      let newForecastPath = ty.forecastPath;
      
      const lastHistoryHour = ty.history.length > 0 ? ty.history[ty.history.length - 1].simHour : -3;
      const finalRmw = Math.max(7.5, Math.min(22.5, rmw));
      
      // Request 1: Dynamic Wind Radii update based on newly computed newVmax
      // When typhoon weakens or changes intensity, wind circles shrink continuously and proportionally
      const vmaxChanged = Math.abs(newVmax - ty.vmax) > 0.1 || needRecalcRadii || newVmax < 10.0;
      if (vmaxChanged) {
        if (newVmax < 10.0 || dissipated) {
          r7 = { ne: 0, se: 0, sw: 0, nw: 0 };
          r10 = { ne: 0, se: 0, sw: 0, nw: 0 };
          r12 = { ne: 0, se: 0, sw: 0, nw: 0 };
        } else {
          let r10Boost = 0;
          let r12Boost = 0;
          if (ewrcState === "recovering_success") {
            r10Boost = 0.08;
            r12Boost = 0.12;
          } else if (rapidIntensifying) {
            r10Boost = 0.05;
            r12Boost = 0.08;
          }

          // Requirement 2: Structural damage mechanism no longer affects wind radii
          let structureDamageR7Scale = 1.0;
          let structureDamageR10R12Scale = 1.0;
          
          if (config.dryAirStrength && config.dryAirStrength > 0) {
             structureDamageR7Scale *= Math.max(0.7, 1.0 - config.dryAirStrength * 0.15); // Shrink r7 up to 30%
             structureDamageR10R12Scale *= Math.max(0.75, 1.0 - config.dryAirStrength * 0.12);
          }

          // Requirement 2: Outer wind radii are maintained during EWRC replacement
          const effectiveVmaxForRadii = (ewrcState === "forming" || ewrcState === "max_decay") ? Math.max(newVmax, ty.ewrcStartVmax || 0) : newVmax;

          r7 = this.calculateWindRadii(newLat, newLon, effectiveVmaxForRadii, 1.0 * structureDamageR7Scale, u_agg, v_agg, metrics.isLand, ty.maxR7Limit, config, false);
          
          const globalScale1012 = 0.85;

          const shrink = (r: { ne: number; se: number; sw: number; nw: number }) => ({
            ne: Math.round(r.ne * 0.68),
            se: Math.round(r.se * 0.68),
            sw: Math.round(r.sw * 0.68),
            nw: Math.round(r.nw * 0.68)
          });

          // Adjust r10 and r12 scales to match user averages
          // For STS (~220): 10: 70 (scale ~0.31)
          // For TY (~280): 10: 100 (scale ~0.35), 12: 50 (scale ~0.17)
          // For STY (~330): 10: 130 (scale ~0.39), 12: 70 (scale ~0.21)
          // For SuperTY (~380): 10: 160 (scale ~0.42), 12: 90 (scale ~0.23)
          let r10ScaleTarget = 0.35;
          let r12ScaleTarget = 0.20;
          if (effectiveVmaxForRadii > 50.9) { r10ScaleTarget = 0.42; r12ScaleTarget = 0.23; }
          else if (effectiveVmaxForRadii > 41.4) { r10ScaleTarget = 0.39; r12ScaleTarget = 0.21; }
          else if (effectiveVmaxForRadii > 32.6) { r10ScaleTarget = 0.35; r12ScaleTarget = 0.17; }
          else { r10ScaleTarget = 0.31; r12ScaleTarget = 0.0; } // <32.7 has no 12-level

          const r10_raw = effectiveVmaxForRadii >= 24.5 ? shrink(this.calculateWindRadii(newLat, newLon, effectiveVmaxForRadii, Math.max(0.20, r10ScaleTarget + r10Boost) * structureDamageR10R12Scale, u_agg, v_agg, metrics.isLand, ty.maxR7Limit, config, false)) : { ne: 0, se: 0, sw: 0, nw: 0 };
          r10 = { ne: Math.round(r10_raw.ne * 1.10), se: Math.round(r10_raw.se * 1.10), sw: Math.round(r10_raw.sw * 1.10), nw: Math.round(r10_raw.nw * 1.10) };
          const r12_raw = effectiveVmaxForRadii >= 32.7 ? shrink(this.calculateWindRadii(newLat, newLon, effectiveVmaxForRadii, Math.max(0.10, r12ScaleTarget + r12Boost) * structureDamageR10R12Scale, u_agg, v_agg, metrics.isLand, ty.maxR7Limit, config, false)) : { ne: 0, se: 0, sw: 0, nw: 0 };
          r12 = { ne: Math.round(r12_raw.ne * 1.10), se: Math.round(r12_raw.se * 1.10), sw: Math.round(r12_raw.sw * 1.10), nw: Math.round(r12_raw.nw * 1.10) };

          const quadrants = ["ne", "se", "sw", "nw"] as const;
          for (const q of quadrants) {
            if (r10[q] > 0) {
              r10[q] = Math.min(r10[q], Math.max(15, r7[q] - 25));
            }
            if (r12[q] > 0) {
              const maxAllowedR12 = r10[q] > 0 ? (r10[q] - 25) : (r7[q] - 50);
              r12[q] = Math.min(r12[q], Math.max(15, maxAllowedR12));
            }
          }
        }
      }

      const updatedTy: Typhoon = {
        ...ty,
        lat: newLat,
        lon: newLon,
        vmax: newVmax, // Keep full precision for internal simulation stability
        pmin: newPmin,
        direction: dirDegrees,
        speed: Math.round(speedKmh),
        rmw: finalRmw,
        r7,
        r10,
        r12,
        landed,
        dissipated,
        extrTransition,
        ewrcState,
        ewrcProgress,
        rapidIntensifying,
        forcedRapidIntensification: ty.forcedRapidIntensification,
        isEyeClogged: ty.isEyeClogged,
        cloggedRecoveryHours: ty.cloggedRecoveryHours,
        cloggedRecoveryTotalHours: ty.cloggedRecoveryTotalHours,
        dryAirPenaltyHours: ty.dryAirPenaltyHours,
        dryAirPenaltyTotalHours: ty.dryAirPenaltyTotalHours,
        shearPenaltyHours: ty.shearPenaltyHours,
        shearPenaltyTotalHours: ty.shearPenaltyTotalHours,
        category,
        upwellingHours,
        consecutiveUpwellingHours,
        upwellingPersistentPenaltyHours,
        tdHours,
        landTdHours,
        r10LandContactHours,
        superTyLandHours,
        etHours,
        casualties: currentCasualties,
        simHour: nextHour,
        maxLandElevationPassed,
        structuralDamageHours,
        warmWaterHoursAfterSea,
        isStructureDamaged,
        upwellingLogged: ty.upwellingLogged,
        ewrcCooldownHours,
        lastJoyU: ty.lastJoyU,
        lastJoyV: ty.lastJoyV,
        isManualSteering,
        lastVelocityU,
        lastVelocityV,
        forcedDecayStartVmax,
        forcedDecayTargetVmax,
        forcedDecayElapsedHours,
        forcedDecayDuration,
        forcedDecayIsContinuous,
        forcedShear: ty.forcedShear,
        forcedEWRC: ty.forcedEWRC,
        forcedDryAir: ty.forcedDryAir,
        landfallRecords
      };

      const start = startDate ? new Date(startDate) : new Date("2026-07-21T00:00:00");
      const simDate = new Date(start.getTime() + nextHour * 3600 * 1000);
      const simHourOfDay = simDate.getHours();
      const isUpdateTime = [2, 5, 8, 11, 14, 17, 20, 23].includes(simHourOfDay);
      const isFirstHour = ty.history.length === 0;

      if (nextHour - lastHistoryHour >= 1) {
        if (isUpdateTime || isFirstHour || !ty.forecastPath || ty.forecastPath.length === 0) {
          newForecastPath = calculateForecastPath(updatedTy, config, 120, true);
        } else {
          newForecastPath = ty.forecastPath;
        }

        const prevReadings = ty.history.length > 0 ? ty.history[ty.history.length - 1].stationReadings : undefined;
        const nextReadings = calculateStationReadings(
          newLat,
          newLon,
          Number(newVmax.toFixed(1)),
          newPmin,
          finalRmw,
          r7,
          r10,
          r12,
          prevReadings,
          currentCasualties
        );

        updatedTy.stationReadings = nextReadings;

        newHistory = [
          ...ty.history,
          {
              lat: newLat,
              lon: newLon,
              vmax: Number(newVmax.toFixed(1)),
              pmin: newPmin,
              direction: dirDegrees,
              speed: Math.round(speedKmh),
              rmw: finalRmw,
              r7,
              r10,
              r12,
              category,
              simHour: nextHour,
              landed,
              dissipated,
              extrTransition,
              ewrcState,
              ewrcProgress,
              rapidIntensifying,
              forcedRapidIntensification: ty.forcedRapidIntensification,
              isEyeClogged: ty.isEyeClogged,
              cloggedRecoveryHours: ty.cloggedRecoveryHours,
              cloggedRecoveryTotalHours: ty.cloggedRecoveryTotalHours,
              dryAirPenaltyHours: ty.dryAirPenaltyHours,
              dryAirPenaltyTotalHours: ty.dryAirPenaltyTotalHours,
              shearPenaltyHours: ty.shearPenaltyHours,
              shearPenaltyTotalHours: ty.shearPenaltyTotalHours,
              upwellingHours,
              consecutiveUpwellingHours,
              upwellingPersistentPenaltyHours,
              tdHours,
              landTdHours,
              r10LandContactHours,
              superTyLandHours,
              etHours,
              casualties: currentCasualties,
              forecastPath: newForecastPath,
              stationReadings: nextReadings,
              maxLandElevationPassed,
              structuralDamageHours,
              warmWaterHoursAfterSea,
              isStructureDamaged,
              upwellingLogged: ty.upwellingLogged,
              ewrcCooldownHours,
              lastJoyU: ty.lastJoyU,
              lastJoyV: ty.lastJoyV,
              isManualSteering,
              lastVelocityU,
              lastVelocityV,
              forcedDecayStartVmax,
              forcedDecayTargetVmax,
              forcedDecayElapsedHours,
              forcedDecayDuration,
              forcedDecayIsContinuous,
              forcedShear: ty.forcedShear,
              forcedEWRC: ty.forcedEWRC,
              forcedDryAir: ty.forcedDryAir,
              manualForcedDecay: ty.manualForcedDecay,
              landfallRecords,
              configSnapshot: { ...config }
            }
          ];
      } else {
        updatedTy.stationReadings = ty.stationReadings;
      }
      
      updatedTy.history = newHistory;
      updatedTy.forecastPath = newForecastPath;

      updatedTyphoons.push(updatedTy);
    }

    return { updatedTyphoons, logs };
  }

  // Calculate quadrant wind radius (km) based on maximum wind speed vmax
  // Modulates by asymmetrical movement factor (front-right quadrant gets stronger wind)
  // Accounts for real-time land squeeze, steering-driven asymmetry, and individual/global size limits
  private calculateWindRadii(
    lat: number,
    lon: number,
    vmax: number,
    scaleFactor: number,
    u: number,
    v: number,
    isLanded: boolean,
    maxR7Limit?: number,
    config?: SimulationConfig,
    isStructureDamagedAtSea?: boolean,
    targetLevel: 7 | 10 | 12 = 7
  ): { ne: number; se: number; sw: number; nw: number } {
    const std = getStandardAverageWindRadii(vmax);
    let baseR = targetLevel === 7 ? std.r7 : targetLevel === 10 ? std.r10 : std.r12;
    if (baseR <= 0) {
      return { ne: 0, se: 0, sw: 0, nw: 0 };
    }
    baseR *= scaleFactor;

    
    // 2. Translation movement asymmetry (Dangerous Semicircle vs Navigable Semicircle)
    // Northern Hemisphere: Dangerous semicircle is on the RIGHT side of the motion vector
    const speedMps = Math.sqrt(u * u + v * v);
    const headingRad = Math.atan2(u, v); // 0 = North, PI/2 = East, -PI/2 = West, PI = South
    const rightSideRad = headingRad + Math.PI / 2; // Dangerous semicircle center direction
    
    // Asymmetry scales smoothly with both translational velocity and typhoon base radius (vmax intensity) (Significantly amplified for realistic asymmetry)
    const speedAsym = Math.min(85 * scaleFactor, (speedMps * 3.2 + baseR * 0.08) * scaleFactor);

    // Quad angles: NE = PI/4, SE = 3PI/4, SW = 5PI/4, NW = 7PI/4
    let r_ne = baseR + Math.cos((Math.PI / 4) - rightSideRad) * speedAsym;
    let r_se = baseR + Math.cos(((3 * Math.PI) / 4) - rightSideRad) * speedAsym;
    let r_sw = baseR + Math.cos(((5 * Math.PI) / 4) - rightSideRad) * speedAsym;
    let r_nw = baseR + Math.cos(((7 * Math.PI) / 4) - rightSideRad) * speedAsym;

    // Direct Dangerous (+12%) vs Navigable (-12%) semicircle radius scaling
    const motionFactor = Math.min(1.0, speedMps / 8.0);
    const dangerousBoost = 0.12 * motionFactor;
    
    r_ne *= (1.0 + Math.cos((Math.PI / 4) - rightSideRad) * dangerousBoost);
    r_se *= (1.0 + Math.cos(((3 * Math.PI) / 4) - rightSideRad) * dangerousBoost);
    r_sw *= (1.0 + Math.cos(((5 * Math.PI) / 4) - rightSideRad) * dangerousBoost);
    r_nw *= (1.0 + Math.cos(((7 * Math.PI) / 4) - rightSideRad) * dangerousBoost);

    // 3. Fetch wind shear
    const shearVal = config ? getShear(lat, lon, config) : 8.0;
    const isStrongShear = shearVal > 15.0;

    // Latitudinal influence: Coriolis effect increases circle size at higher latitudes
    const latFactor = 1.0 + Math.abs(lat - 15) * 0.012;
    r_ne *= latFactor;
    r_se *= latFactor;
    r_sw *= latFactor;
    r_nw *= latFactor;

    // Check land squeeze on the actual quadrant radii
    const quadrants = [
      { name: "ne" as const, angle: 45, radius: r_ne },
      { name: "se" as const, angle: 135, radius: r_se },
      { name: "sw" as const, angle: 225, radius: r_sw },
      { name: "nw" as const, angle: 315, radius: r_nw },
    ];

    const squeezeFactors = { ne: 1.0, se: 1.0, sw: 1.0, nw: 1.0 };
    let anySqueeze = false;

    for (const q of quadrants) {
      // Check land at multiple angles within each quadrant (center, and +/- 30 degrees) to ensure robust detection
      const angles = [q.angle - 30, q.angle, q.angle + 30];
      
      for (const a of angles) {
        const angleRad = (a * Math.PI) / 180;
        // Check land at 0.4, 0.7, 1.0 of the calculated quadrant radius
        const testFractions = [0.4, 0.7, 1.0];
        for (const f of testFractions) {
          const testDist = q.radius * f;
          const dLat = (testDist * Math.cos(angleRad)) / 111.12;
          const dLon = (testDist * Math.sin(angleRad)) / (111.12 * Math.cos((lat * Math.PI) / 180));
          const metrics = getLandMetrics(lat + dLat, lon + dLon, config?.coastlineSource);
          if (metrics.isLand) {
            // Land squeeze (Slightly increased land squeeze effect)
            let squeeze = 0.62 + 0.25 * f; 
            if (metrics.elevation > 500) {
              squeeze *= Math.max(0.75, 1.0 - (metrics.elevation / 12000.0));
            }
            squeezeFactors[q.name] = Math.min(squeezeFactors[q.name], squeeze);
            anySqueeze = true;
          }
        }
      }
    }

    if (!anySqueeze && !isStrongShear) {
      // 在未受到陆地和强风切影响时，四个象限的风圈在原基础上做连续、平滑的低频偏移，彻底解决高频抖动问题
      // Smooth, continuous spatial waves to maintain stable organic asymmetry without frame jitter
      const angleNE = Math.sin(lat * 0.8 + lon * 0.5);
      const angleSE = Math.cos(lat * 0.7 - lon * 0.6);
      const angleSW = -Math.sin(lat * 0.6 - lon * 0.4);
      const angleNW = -Math.cos(lat * 0.5 + lon * 0.7);

      let offsetBase = 32;

      let o_ne = Math.round(angleNE * offsetBase * scaleFactor);
      let o_se = Math.round(angleSE * offsetBase * scaleFactor);
      let o_sw = Math.round(angleSW * offsetBase * scaleFactor);
      let o_nw = Math.round(angleNW * offsetBase * scaleFactor);

      // Guarantee that at least two are different with a larger minimum difference
      if (Math.abs(o_ne - o_se) < 5 && Math.abs(o_se - o_sw) < 5) {
        o_ne += Math.round(12 * scaleFactor) || 2;
        o_se -= Math.round(12 * scaleFactor) || 2;
      }

      r_ne = Math.max(15, Math.round(r_ne + o_ne));
      r_se = Math.max(15, Math.round(r_se + o_se));
      r_sw = Math.max(15, Math.round(r_sw + o_sw));
      r_nw = Math.max(15, Math.round(r_nw + o_nw));
    } else {
      // Under the influence of land squeeze or strong wind shear
      // 1. Wind Shear Distortion Effect
      let shearFactorNE = 1.0;
      let shearFactorSE = 1.0;
      let shearFactorSW = 1.0;
      let shearFactorNW = 1.0;

      if (isStrongShear) {
        const shearExcess = shearVal - 15.0;
        const shearStrength = Math.min(0.18, shearExcess * 0.008); // reduced gain (Requirement 8)
        
        if (lat > 22) {
          // Westerlies shear (stretches east, compresses west)
          shearFactorNE = 1.0 + shearStrength * 0.5;
          shearFactorSE = 1.0 + shearStrength * 0.3;
          shearFactorSW = 1.0 - shearStrength * 0.5;
          shearFactorNW = 1.0 - shearStrength * 0.3;
        } else {
          // Tropical easterlies shear (stretches west, compresses east)
          shearFactorNE = 1.0 - shearStrength * 0.5;
          shearFactorSE = 1.0 - shearStrength * 0.3;
          shearFactorSW = 1.0 + shearStrength * 0.3;
          shearFactorNW = 1.0 + shearStrength * 0.5;
        }
      }

      // Priority of speed/direction sits BELOW land squeeze/shear - we modify the asymmetrical r_ne (preserving movement effect but letting shear override/multiply it)
      r_ne = Math.round(r_ne * shearFactorNE);
      r_se = Math.round(r_se * shearFactorSE);
      r_sw = Math.round(r_sw * shearFactorSW);
      r_nw = Math.round(r_nw * shearFactorNW);

      // 2. Land Squeeze Effect (Applied LAST, sitting above movement priority)
      r_ne = Math.round(r_ne * squeezeFactors.ne);
      r_se = Math.round(r_se * squeezeFactors.se);
      r_sw = Math.round(r_sw * squeezeFactors.sw);
      r_nw = Math.round(r_nw * squeezeFactors.nw);
    }

    // 5. Apply general caps & limits proportionally so dangerous/navigable asymmetry ratio is strictly preserved
    const resolvedR7Limit = Math.min(550, maxR7Limit || 450);
    const maxLimit = resolvedR7Limit * scaleFactor;

    const maxQ = Math.max(r_ne, r_se, r_sw, r_nw);
    if (maxQ > maxLimit) {
      const capScale = maxLimit / maxQ;
      r_ne *= capScale;
      r_se *= capScale;
      r_sw *= capScale;
      r_nw *= capScale;
    }

    // If fully landed, apply further overall reduction
    if (isLanded) {
      r_ne = Math.round(r_ne * 0.7);
      r_se = Math.round(r_se * 0.7);
      r_sw = Math.round(r_sw * 0.7);
      r_nw = Math.round(r_nw * 0.7);
    }

    return {
      ne: Math.round(Math.max(15, r_ne)),
      se: Math.round(Math.max(15, r_se)),
      sw: Math.round(Math.max(15, r_sw)),
      nw: Math.round(Math.max(15, r_nw))
    };
  }
}

// Convert wind speed m/s to Beaufort scale force levels (China standards)
export function getWindForceCategory(vmax: number): number {
  if (vmax < 0.3) return 0;
  if (vmax < 1.5) return 1;
  if (vmax < 3.3) return 2;
  if (vmax < 5.4) return 3;
  if (vmax < 7.9) return 4;
  if (vmax < 10.7) return 5;
  if (vmax < 13.8) return 6;
  if (vmax < 17.1) return 7;
  if (vmax < 20.7) return 8;
  if (vmax < 24.4) return 9;
  if (vmax < 28.4) return 10;
  if (vmax < 32.6) return 11;
  if (vmax < 36.9) return 12;
  if (vmax < 41.4) return 13;
  if (vmax < 46.1) return 14;
  if (vmax < 50.9) return 15;
  if (vmax < 56.0) return 16;
  return 17; // 超强台风/极致风力
}

export function getCategoryColor(category: TyphoonCategory, config?: SimulationConfig): string {
  if (config?.categoryColors?.[category]) {
    return config.categoryColors[category];
  }

  switch (category) {
    case TyphoonCategory.TD:
      return "#F9D332";
    case TyphoonCategory.TS:
      return "#2056C6";
    case TyphoonCategory.STS:
      return "#1F8838";
    case TyphoonCategory.TY:
      return "#F07920";
    case TyphoonCategory.STY:
      return "#D829BC";
    case TyphoonCategory.SuperTY:
      return "#D62020";
    case TyphoonCategory.ET:
      return "#949297";
    case TyphoonCategory.DS:
    default:
      return "#8c9ba5";
  }
}

// Calculate the 120-hour projected forecast track (every 1 hour)
export function calculateForecastPath(
  typhoon: Typhoon,
  config: SimulationConfig,
  targetHours: number = 120,
  fastMode: boolean = false
): Array<{ lat: number; lon: number; vmax: number; pmin: number; simHour: number; category: TyphoonCategory; speed: number }> {
  let initialCategory = TyphoonCategory.TD;
  if (typhoon.vmax >= 51.0) initialCategory = TyphoonCategory.SuperTY;
  else if (typhoon.vmax >= 41.5) initialCategory = TyphoonCategory.STY;
  else if (typhoon.vmax >= 32.7) initialCategory = TyphoonCategory.TY;
  else if (typhoon.vmax >= 24.5) initialCategory = TyphoonCategory.STS;
  else if (typhoon.vmax >= 17.2) initialCategory = TyphoonCategory.TS;

  const forecast: Array<{ lat: number; lon: number; vmax: number; pmin: number; simHour: number; category: TyphoonCategory; speed: number }> = [
    {
      lat: typhoon.lat,
      lon: typhoon.lon,
      vmax: typhoon.vmax,
      pmin: typhoon.pmin,
      simHour: 0,
      category: initialCategory,
      speed: typhoon.speed
    }
  ];
  const maxLimit = config.maxIntensityLimitEnabled ? (config.maxIntensityLimit ?? 70) : 95;
  
  // Clone typhoon state
  const startLat = typhoon.lat;
  const startLon = typhoon.lon;
  let currentLat = typhoon.lat;
  let currentLon = typhoon.lon;
  let currentVmax = typhoon.vmax;
  let currentPmin = typhoon.pmin;

  // Reconstruct current actual velocity components (m/s) from current speed (km/h) and direction (degrees)
  const currentSpeedMps = typhoon.speed / 3.6;
  const currentDirRad = (typhoon.direction * Math.PI) / 180.0;
  const u_current = currentSpeedMps * Math.sin(currentDirRad);
  const v_current = currentSpeedMps * Math.cos(currentDirRad);

  // Current atmospheric steering flow at the typhoon's actual current location
  const currentSteering = getSteeringFlow(typhoon.lat, typhoon.lon, typhoon.vmax, config);
  const u_steer_current = currentSteering.u;
  const v_steer_current = currentSteering.v;

  // The base/non-atmospheric movement vector (joystick bias, beta drift, internal dynamics)
  const u_base = u_current - u_steer_current;
  const v_base = v_current - v_steer_current;
  let forecastUpwellingHours = typhoon.upwellingHours || 0;
  let forecastSuperTyLandHours = typhoon.superTyLandHours || 0;
  let forecastLandHours = typhoon.landHours || 0;
  let forecastLandContactHours = typhoon.landContactHours || 0;
  let forecastR10LandContactHours = typhoon.r10LandContactHours || 0;
  let forecastMaxLandElevationPassed = typhoon.maxLandElevationPassed || 0;
  let forecastStructuralDamageHours = typhoon.structuralDamageHours || 0;
  let forecastWarmWaterHoursAfterSea = typhoon.warmWaterHoursAfterSea || 0;
  let forecastIsStructureDamaged = typhoon.isStructureDamaged || false;
  let forecastPassedTaiwan = typhoon.passedTaiwanCentral || false;
  let forecastPassedLuzon = typhoon.passedLuzonMountains || false;
  let forecastUpwellingPersistentPenaltyHours = typhoon.upwellingPersistentPenaltyHours || 0;
  let forecastConsecutiveUpwellingHours = typhoon.consecutiveUpwellingHours || 0;
  let forecastRapidIntensifying = typhoon.rapidIntensifying || false;
  let forecastExtrTransition = typhoon.extrTransition || 0;
  let forecastEtHours = typhoon.etHours || 0;
  let forecastForcedDecayStartVmax = typhoon.forcedDecayStartVmax;
  let forecastForcedDecayTargetVmax = typhoon.forcedDecayTargetVmax;
  let forecastForcedDecayElapsedHours = typhoon.forcedDecayElapsedHours || 0;
  let forecastForcedDecayDuration = typhoon.forcedDecayDuration;
  let forecastForcedDecayIsContinuous = typhoon.forcedDecayIsContinuous || false;
  
  let ewrcState = typhoon.ewrcState || "none";
  let ewrcProgress = typhoon.ewrcProgress || 0;
  let ewrcDuration = typhoon.ewrcDuration || 12;
  let ewrcWeakenAmount = typhoon.ewrcWeakenAmount || 6;
  let ewrcExtraAdjust = typhoon.ewrcExtraAdjust || 0;
  let ewrcRecoveryDuration = typhoon.ewrcRecoveryDuration || 12;
  
  const totalHours = targetHours;
  const stepSizeHours = 1; // 1-hour simulation step size for robust prediction
  
  // Deterministic local pseudorandom noise generator for this specific member path
  let seedHash = 0;
  if (config.seed) {
    for (let charIdx = 0; charIdx < config.seed.length; charIdx++) {
      seedHash = (seedHash << 5) - seedHash + config.seed.charCodeAt(charIdx);
      seedHash |= 0; // Convert to 32bit integer
    }
  }
  let noiseSeed = (config.subtropicalHighLat ?? 28) * 17.3 + (config.subtropicalHighLon ?? 135) * 31.7 + (config.westerliesLat ?? 30) * 43.1 + Math.abs(seedHash) * 0.05;
  const rand = () => {
    const x = Math.sin(noiseSeed++) * 10000;
    return x - Math.floor(x);
  };

  const periodLong = 60 + rand() * 60; // 60 to 120 hours
  const periodMedium = 28 + rand() * 24; // 28 to 52 hours
  const ampLong = (fastMode ? 1.1 : 0.6) * (0.8 + rand() * 1.5); // m/s
  const ampMedium = (fastMode ? 0.7 : 0.4) * (0.5 + rand() * 0.9); // m/s
  const phaseLong = rand() * Math.PI * 2;
  const phaseMedium = rand() * Math.PI * 2;

  let u_drift = 0;
  let v_drift = 0;
  let hasRecurved = false;

  for (let h = stepSizeHours; h <= totalHours; h += stepSizeHours) {
    if (currentVmax <= 8.0 || typhoon.dissipated) {
      break;
    }
    // 1. Steering flow
    const steering = getSteeringFlow(currentLat, currentLon, currentVmax, config);
    
    // Apply ensemble member persistent bias (Requirement: prevent straight identical lines)
    // Modified: add a time-varying factor to the bias so it's not a simple linear translation
    if (config.steeringBiasU !== undefined) {
      const timeFactor = 1.0 + Math.sin(h / 60) * 0.2;
      steering.u += config.steeringBiasU * timeFactor;
    }
    if (config.steeringBiasV !== undefined) {
      const timeFactor = 1.0 + Math.cos(h / 72) * 0.25;
      steering.v += config.steeringBiasV * timeFactor;
    }

    const steeringStrength = Math.sqrt(steering.u * steering.u + steering.v * steering.v);
    
    // Requirement 1: In weak steering flow (< 3.0 m/s), path is NOT a simple straight line!
    // Infer user intention & momentum vector, and apply non-linear beta-gyre Coriolis curvature
    const weakSteeringFactor = Math.max(0, (3.0 - steeringStrength) / 3.0);
    
    // Trochoidal motion (Wobble): Typhoons naturally oscillate around their mean path (Requirement 2)
    const trochoidalPeriod = 16 + rand() * 16; // 16-32 hours
    const trochoidalAmp = 0.5 * weakSteeringFactor + 0.25; // Increased for more organic motion
    const trochoidalU = Math.sin((h / trochoidalPeriod) * Math.PI * 2 + phaseLong) * trochoidalAmp;
    const trochoidalV = Math.cos((h / trochoidalPeriod) * Math.PI * 2 + phaseMedium) * trochoidalAmp;

    // Organic Cross-flow Oscillation: prevent "unrealistic straight lines" by adding sinuosity (Requirement)
    const sinuosPeriod = 42 + rand() * 36; 
    const sinuosAmp = 0.55 * (1.2 + weakSteeringFactor);
    const crossU = -(steering.v / (steeringStrength + 0.6)) * Math.sin((h / sinuosPeriod) * Math.PI * 2 + phaseLong * 0.4) * sinuosAmp;
    const crossV = (steering.u / (steeringStrength + 0.6)) * Math.sin((h / sinuosPeriod) * Math.PI * 2 + phaseLong * 0.4) * sinuosAmp;

    const gyreCurvatureU = weakSteeringFactor * (0.025 * h * Math.sin((currentLat * Math.PI) / 180));
    const gyreCurvatureV = weakSteeringFactor * (0.015 * h);

    const inertiaDecay = Math.exp(-0.012 * h); // Slightly slower momentum decay for better "intent" (Requirement 3)
    
    // Beta Drift (Rossby wave dispersion)
    // Requirement 5 & 6: Beta drift influenced by actual size (r7) and lat
    const scale = config?.betaDriftScale ?? 1.0;
    const betaDriftBaseR7 = currentVmax * 5.8 + 30;
    const sizeFactor = Math.max(0.3, Math.min(2.0, betaDriftBaseR7 / 250.0));
    const betaLatBoost = 0.7 * scale * sizeFactor * (1.0 + Math.sin((currentLat * Math.PI)/180));
    const betaLonBoost = -0.5 * scale * sizeFactor * (1.0 + Math.sin((currentLat * Math.PI)/180));
    
    // Subtropical High Ridge Curvature (realistic parabolic arc)
    const subHighArcPhase = Math.sin((h / 120) * Math.PI) * 0.6;
    
    // Low-frequency waves and dynamic random walks for highly realistic, wavy meteorological pathways
    let waveU = 0;
    let waveV = 0;
    let finalNoiseVal = 1.0;
    if ((config.randomNoise ?? 0) > 0 || fastMode) {
      // Genesis uncertainty: newly generated or weak typhoons have 60% higher path controversy (Requirement)
      const isEarlyStage = (typhoon.history?.length ?? 0) < 12 || typhoon.vmax < 25.0;
      const noiseVal = (config.randomNoise ?? 0.3) * (isEarlyStage ? 1.6 : 1.0);
      
      // Uncertainty profile: extremely low in short-term (first 12h), dynamically widening in long-term
      let timeScale = 0;
      if (h <= 12) {
        timeScale = Math.pow(h / 12.0, 1.8) * 0.18; 
      } else if (h <= 72) {
        // Linear growth up to 3 days
        timeScale = 0.18 + (h - 12) / 60.0; 
      } else {
        // Slowing growth for very long term to prevent extreme "unphysical" outliers
        timeScale = 1.18 + Math.sqrt((h - 72) / 24.0) * 0.25;
      }
      
      // Cap maximum timeScale to prevent extreme divergence at 10+ days
      timeScale = Math.min(2.0, timeScale);

      // Genesis uncertainty also causes faster divergence in the first 24 hours
      if (isEarlyStage && h <= 36) {
        timeScale *= 1.25;
      }

      // Weak Steering Boost: Toned down to prevent chaotic patterns (Requirement)
      const steeringStrength = Math.sqrt(steering.u * steering.u + steering.v * steering.v);
      const weakSteeringNoiseBoost = 1.0 + Math.max(0, (3.0 - steeringStrength) / 3.0) * 0.7;
      finalNoiseVal = noiseVal * weakSteeringNoiseBoost;

      // Decouple U and V components and use slightly different frequencies to prevent systematic circular spiraling
      waveU = Math.sin((h / periodLong) * Math.PI * 2 + phaseLong) * ampLong * finalNoiseVal * 0.8 * timeScale + 
              Math.sin((h / periodMedium) * Math.PI * 2 + phaseMedium) * ampMedium * finalNoiseVal * 0.8 * timeScale;
      waveV = Math.sin((h / (periodLong * 1.27)) * Math.PI * 2 + phaseLong + 1.1) * ampLong * finalNoiseVal * 0.8 * timeScale + 
              Math.sin((h / (periodMedium * 0.78)) * Math.PI * 2 + phaseMedium + 0.6) * ampMedium * finalNoiseVal * 0.8 * timeScale;

      // High-frequency micro-wiggle (tortuosity) to give paths an organic "jitter"
      const microWiggleU = Math.sin((h / 4.2) * Math.PI * 2 + phaseLong * 6.0) * 0.16 * finalNoiseVal;
      const microWiggleV = Math.sin((h / 5.1) * Math.PI * 2 + phaseMedium * 6.0 + 0.5) * 0.16 * finalNoiseVal;
      // Pure random "shiver" reduced to prevent "drunk walk" look
      const shiverU = (rand() - 0.5) * 0.22 * finalNoiseVal;
      const shiverV = (rand() - 0.5) * 0.22 * finalNoiseVal;
      waveU += microWiggleU + shiverU;
      waveV += microWiggleV + shiverV;
              
      // Random walk steering drift: more persistent to create organic curves
      const persistence = 0.94; 
      const driftIntensity = finalNoiseVal * 0.12 * timeScale;
      u_drift = u_drift * persistence + (rand() - 0.5) * driftIntensity;
      v_drift = v_drift * persistence + (rand() - 0.5) * driftIntensity;
      
      const maxDrift = 1.2 * finalNoiseVal;
      u_drift = Math.max(-maxDrift, Math.min(maxDrift, u_drift));
      v_drift = Math.max(-maxDrift, Math.min(maxDrift, v_drift));

      const maxDistortion = Math.max(0.5, steeringStrength * 0.8);
      const waveMag = Math.sqrt(waveU*waveU + waveV*waveV);
      if (waveMag > maxDistortion) {
         waveU = (waveU / waveMag) * maxDistortion;
         waveV = (waveV / waveMag) * maxDistortion;
      }

      // Constrain perturbations relative to the steering force so they never overpower it
      let perturbU = waveU + u_drift + trochoidalU + crossU;
      let perturbV = waveV + v_drift + trochoidalV + crossV;
      const perturbMag = Math.sqrt(perturbU * perturbU + perturbV * perturbV);
      const maxPerturb = Math.min(3.5, 0.3 * steeringStrength + 0.8) * finalNoiseVal;
      if (perturbMag > maxPerturb && perturbMag > 0) {
        const scale = maxPerturb / perturbMag;
        perturbU *= scale;
        perturbV *= scale;
        // Scale drift back proportionally
        u_drift *= scale;
        v_drift *= scale;
      }

      // Angular perturbation: instead of just Cartesian noise, perturb the movement direction
      // This creates spread without reversing the motion
      const currentSpeed = Math.sqrt(steering.u * steering.u + steering.v * steering.v);
      if (currentSpeed > 0.4) {
        const angularNoise = (rand() - 0.5) * 0.18 * timeScale * noiseVal;
        const cosA = Math.cos(angularNoise);
        const sinA = Math.sin(angularNoise);
        const u_new = steering.u * cosA - steering.v * sinA;
        const v_new = steering.u * sinA + steering.v * cosA;
        steering.u = u_new;
        steering.v = v_new;
      }
    }

    // Accumulate components
    let perturbU_final = waveU + u_drift + trochoidalU + crossU;
    let perturbV_final = waveV + v_drift + trochoidalV + crossV;
    const finalPerturbMag = Math.sqrt(perturbU_final * perturbU_final + perturbV_final * perturbV_final);
    const finalMaxPerturb = Math.min(3.5, 0.3 * steeringStrength + 0.8) * (finalNoiseVal || 1.0);
    if (finalPerturbMag > finalMaxPerturb && finalPerturbMag > 0) {
      const scale = finalMaxPerturb / finalPerturbMag;
      perturbU_final *= scale;
      perturbV_final *= scale;
    }

    let u_agg = (u_base * inertiaDecay) + steering.u + betaLonBoost + gyreCurvatureU + perturbU_final;
    let v_agg = (v_base * inertiaDecay) + steering.v + betaLatBoost + gyreCurvatureV + perturbV_final;
    
    // Ensure minimum translation speed to prevent "getting stuck" in forecast
    const speed = Math.sqrt(u_agg * u_agg + v_agg * v_agg);
    const minSpeed = 2.8; // Lowered from 4.2 to allow for more natural slow movement
    if (speed < minSpeed && speed > 0) {
      const ratio = minSpeed / speed;
      u_agg *= ratio;
      v_agg *= ratio;
    }
    
    // 3. Westerlies steering force (Apply ONLY when westerlies are enabled and active)
    const isWesterliesActive = !!config?.westerliesEnabled && (config?.westerliesStrength ?? 1.0) > 0;
    const westerliesLat = config?.westerliesLat ?? 30.0;
    
    const inWesterliesZone = isWesterliesActive && currentLat > westerliesLat - 8.0;
    
    if (isWesterliesActive && currentLat > westerliesLat && currentLon > 125.0 && u_agg > 2.0) {
      hasRecurved = true;
    }

    // Safety check: Never return west if we hit the eastern boundary (Date Line)
    if (currentLon >= 179.0) {
      hasRecurved = true; // Effectively lost to westerlies
    }

    if ((inWesterliesZone && hasRecurved) || currentLon >= 179.0) {
      // Once fully recurved deep in the jet stream, the cyclone cannot turn back west
      const minEastWind = 2.5;
      if (u_agg < minEastWind) {
        u_agg = Math.max(minEastWind, u_agg);
      }
      // Strictly prevent southward movement back to the sub-tropics
      if (v_agg < -0.2) {
        v_agg = -0.2;
      }
    }
    
    // Apply Movement Speed Rules:
    // Ocean: 18-28 km/h, Far Ocean: 15-20 km/h, Max non-westerlies: <=32 km/h, Westerlies max: <=60 km/h
    const steeringMag = Math.hypot(steering.u, steering.v);
    const subHighLat = config.subtropicalHighLat ?? 28;
    const subHighWest = config.subtropicalHighWestExtent ?? 125;
    const isFarOcean = currentLon > 140.0 && Math.abs(currentLat - subHighLat) > 7.0 && currentLon > subHighWest + 10;

    let speedMps = Math.hypot(u_agg, v_agg);
    let speedKmh = speedMps * 3.6;

    if (speedKmh < (isFarOcean ? 15.0 : 18.0) && speedKmh > 0) {
          const targetMin = isFarOcean ? 15.0 : 18.0;
          const scale = targetMin / speedKmh;
          u_agg *= scale;
          v_agg *= scale;
          speedKmh = targetMin;
      }
      if (!inWesterliesZone) {
      if (isFarOcean) {
        // Far ocean speed: 15 - 20 km/h
        const targetMin = 15.0;
        const targetMax = 20.0;
        if (speedKmh < targetMin && speedKmh > 0) {
          const scale = targetMin / speedKmh;
          u_agg *= scale;
          v_agg *= scale;
          speedKmh = targetMin;
        } else if (speedKmh > targetMax) {
          const scale = targetMax / speedKmh;
          u_agg *= scale;
          v_agg *= scale;
          speedKmh = targetMax;
        }
      } else {
        // Standard ocean movement: 18 - 28 km/h
        const targetMin = 18.0;
        const targetMax = 28.0;
        if (speedKmh < targetMin && speedKmh > 0) {
          const scale = targetMin / speedKmh;
          u_agg *= scale;
          v_agg *= scale;
          speedKmh = targetMin;
        } else if (speedKmh > targetMax) {
          const scale = targetMax / speedKmh;
          u_agg *= scale;
          v_agg *= scale;
          speedKmh = targetMax;
        }
      }

      // Hard Cap outside westerlies: MUST NEVER exceed 32 km/h
      if (speedKmh > 32.0) {
        const scale = 32.0 / speedKmh;
        u_agg *= scale;
        v_agg *= scale;
        speedKmh = 32.0;
      }
    } else {
      if (speedKmh > 60.0) {
        const scale = 60.0 / speedKmh;
        u_agg *= scale;
        v_agg *= scale;
        speedKmh = 60.0;
      }
    }
    speedKmh = Math.round(speedKmh);
    
    // Convert m/s velocity to coordinates changes (degrees/hour)
    const latSpeedDegHour = (v_agg * 3600.0) / 111111.0;
    const lonSpeedDegHour = (u_agg * 3600.0) / (111111.0 * Math.cos((currentLat * Math.PI) / 180));
    
    currentLat += latSpeedDegHour * stepSizeHours;
    currentLon += lonSpeedDegHour * stepSizeHours;
    
    // Boundaries clamp
    currentLat = Math.max(0, Math.min(55, currentLat));
    currentLon = Math.max(95, Math.min(180, currentLon));
    
    // Full physics intensity engine evaluation along forecast path
    const metrics = getLandMetrics(currentLat, currentLon, config?.coastlineSource, fastMode);
    let sstVal = getSST(currentLat, currentLon, config);
    
    let coldWaterDecay = 0.0;
    const isSlowForecast = speedKmh < 12.0 && !metrics.isLand;
    if (isSlowForecast) {
      forecastUpwellingHours += stepSizeHours;
      forecastConsecutiveUpwellingHours += stepSizeHours;
      const slownessFactor = (12.0 - speedKmh) / 12.0;
      const intensityFactorForWake = Math.max(1.0, currentVmax / 25.0); 
      
      const upwellingCoolingRate = 0.06 * intensityFactorForWake * slownessFactor * config.airSeaCoupling;
      const nonLinearTime = Math.pow(forecastUpwellingHours + 0.5, 1.05);
      const upwellingCooling = Math.min(2.5, nonLinearTime * upwellingCoolingRate);
      
      sstVal = Math.max(16.0, sstVal - upwellingCooling);
      
      const decayAccel = 1.0 + 0.3 * Math.pow(forecastUpwellingHours, 0.9);
      coldWaterDecay = upwellingCooling * 0.04 * decayAccel * (1.0 + slownessFactor * 0.3);
    } else {
      if (forecastConsecutiveUpwellingHours >= 24) {
        forecastUpwellingPersistentPenaltyHours = Math.max(forecastUpwellingPersistentPenaltyHours, 36 + Math.random() * 12);
      }
      forecastUpwellingHours = Math.max(0, forecastUpwellingHours - stepSizeHours * 1.5);
      forecastConsecutiveUpwellingHours = 0;
    }

    if (forecastUpwellingPersistentPenaltyHours > 0) {
      forecastUpwellingPersistentPenaltyHours = Math.max(0, forecastUpwellingPersistentPenaltyHours - stepSizeHours);
    }

    const ohcVal = getOHC(currentLat, currentLon, config, sstVal);
    const shearVal = getShear(currentLat, currentLon, config);
    const rhVal = getRH700(currentLat, currentLon, config);

    // Environmental Rating & MPI calculation
    let sstScore = sstVal >= 26.5 ? Math.max(-1.0, Math.min(1.0, (sstVal - 26.5) / 2.0)) : Math.max(-1.5, (sstVal - 26.5) / 1.5);
    const ohcScore = Math.max(0.0, Math.min(1.0, ohcVal / 100.0));
    const rhScore = Math.max(-1.0, Math.min(1.0, (rhVal - 50.0) / 35.0));
    let shearPenalty = Math.max(0.0, Math.min(1.0, (shearVal - 9.0) / 18.0));

    // Low Peak Intensity Limit Factor & Adverse Climate Multiplier (Requirement 3)
    const configuredPeakLimit = config.maxIntensityLimitEnabled ? (config.maxIntensityLimit ?? 70) : 95;
    let lowPeakFactor = 1.0;
    let adverseClimateMultiplier = 1.0;
    if (config.maxIntensityLimitEnabled && configuredPeakLimit < 70) {
      lowPeakFactor = Math.max(0.25, configuredPeakLimit / 70.0);
      adverseClimateMultiplier = 1.0 / lowPeakFactor;
    }

    shearPenalty *= adverseClimateMultiplier;

    let outflowScore = 0.35;
    if (currentLat > 12 && currentLat < 28) outflowScore += 0.25;
    outflowScore *= config.outflowScale;

    let favScore = (0.35 * sstScore) + (0.18 * ohcScore) + (0.17 * rhScore) + (0.12 * outflowScore) - (0.35 * shearPenalty);

    // Compute MPI
    const sstFactorForMPI = Math.max(0, sstVal - 15);
    const baseMPI = 16.0 + 3.6 * Math.pow(sstFactorForMPI, 1.22) * (1.0 + ohcVal / 180.0); // Synchronized
    const shearReduction = Math.max(0, Math.min(0.75, (shearVal - 4.0) / 30.0));
    const rhFactor = Math.max(0.35, Math.min(1.0, rhVal / 80.0));
    const outflowFactor = Math.max(0.65, Math.min(1.35, outflowScore * 2.2));
    let environmentalMPI = Math.min(105.0, baseMPI * (1.0 - shearReduction) * rhFactor * outflowFactor);
    let forecastAmbitionFactor = 1.0;
    if (config.maxIntensityLimitEnabled && config.maxIntensityLimit && config.maxIntensityLimit > 50) {
      forecastAmbitionFactor = Math.max(1.0, config.maxIntensityLimit / 50.0);
    }
    if (config.maxIntensityLimitEnabled && config.maxIntensityLimit && environmentalMPI < config.maxIntensityLimit) {
      environmentalMPI += (config.maxIntensityLimit - environmentalMPI) * 0.4 * (forecastAmbitionFactor - 1.0);
    }

    let structuralDamagePenaltyFactor = forecastIsStructureDamaged ? (forecastPassedTaiwan ? 0.05 : 0.35) : 1.0;
    let vmaxDeltaPerHour = 0;

    if (currentVmax < environmentalMPI) {
      const rate = (config.intensificationRate ?? 1.0);
      const g_v = 1.5 / (1.0 + Math.pow(currentVmax / 50.0, 1.2)); 
      const baseCoeff = 0.16 + 0.34 * rate;
      const growthRoom = environmentalMPI - currentVmax;
      const envFavorability = Math.max(0.05, favScore + 0.5);
      vmaxDeltaPerHour = baseCoeff * envFavorability * Math.sqrt(growthRoom) * g_v;
      
      // Synchronized with main simulation rate (200% intensification rate = 0.54)
      vmaxDeltaPerHour *= 0.54;

      // Requirement 3: Lower intensification rate if peak limit is low
      vmaxDeltaPerHour *= lowPeakFactor;

      // Requirement 2: Hard constraint - rate = 1.5 -> max <= 2.0 m/s per hour
      const maxAllowedIntensificationRate = 2.0 * (rate / 1.5);
      vmaxDeltaPerHour = Math.min(maxAllowedIntensificationRate, vmaxDeltaPerHour);

      // Non-linear deceleration as typhoon approaches user-configured maximum intensity limit
      if (config.maxIntensityLimitEnabled && currentVmax < maxLimit) {
        const growthToLimit = maxLimit - currentVmax;
        if (growthToLimit > 0 && growthToLimit < 18.0) {
          const p = Math.max(0.0, growthToLimit / 18.0);
          const limitApproachFactor = 0.25 + 0.75 * Math.pow(Math.sin(p * Math.PI / 2), 0.85);
          vmaxDeltaPerHour *= limitApproachFactor;
        }
      }
      
      // Persistent upwelling penalty in forecast (if passed from simulation state)
      if (forecastUpwellingPersistentPenaltyHours > 0) {
        vmaxDeltaPerHour *= 0.7;
      }
      
      vmaxDeltaPerHour *= structuralDamagePenaltyFactor;
    } else {
      const excess = currentVmax - environmentalMPI;
      vmaxDeltaPerHour = Math.max(-3.2, -0.08 * excess - 0.25);
    }

    // 2. High-intensity typhoons have much higher SST requirements
    const requiredSST = 26.5 + Math.max(0, (currentVmax - 17.2) / 50.8) * 2.5; 
    if (sstVal < requiredSST) {
      let sstDeficit = requiredSST - sstVal;
      if (config.maxIntensityLimitEnabled && sstVal >= 26.5 && coldWaterDecay < 1.5) {
         sstDeficit /= (forecastAmbitionFactor * 1.5);
      }
      const intensityScale = Math.pow(currentVmax / 17.2, 1.5);
      const sstPenalty = 0.35 * sstDeficit * intensityScale;
      vmaxDeltaPerHour -= sstPenalty;

      if (currentVmax > 32.7 && sstVal < requiredSST - 0.5) {
        vmaxDeltaPerHour = Math.min(-0.2 * sstDeficit * (currentVmax / 32.7), vmaxDeltaPerHour);
      }
    }

    if (isWesterliesActive && currentLat >= westerliesLat - 3) {
      // Significantly increase decay when entering westerlies, especially if strong
      const westerliesShearPenalty = Math.max(0.5, (currentVmax / 20.0)) * 0.8 * (config.westerliesStrength ?? 1.0);
      vmaxDeltaPerHour -= westerliesShearPenalty;
      
      // If moving very fast eastward in westerlies, ET transition decay accelerates
      if (speedKmh > 35) {
        vmaxDeltaPerHour -= 0.45;
      }
    }

    if (!metrics.isLand && speedKmh < 12.0) {
      const slownessFactor = (12.0 - speedKmh) / 12.0;
      const strengthFactor = Math.max(1.0, currentVmax / 25.0);
      const immediatePenalty = 0.25 * slownessFactor * strengthFactor * (config.airSeaCoupling ?? 0.5) * 2.0;
      const totalDecay = Math.max(immediatePenalty, coldWaterDecay);
      vmaxDeltaPerHour = Math.min(-0.2 * slownessFactor * strengthFactor, vmaxDeltaPerHour - totalDecay);
    }

    if (sstVal <= 26.5 && vmaxDeltaPerHour > 0) {
      const deficit = Math.max(0.1, 26.5 - sstVal);
      vmaxDeltaPerHour = -Math.min(1.5, 0.4 + deficit * 0.5); // Synchronized
    }

    // Landfall Decay & Proximity Mechanism
    const baseR7 = currentVmax * 5.8 + 30;
    const distToLandKm = getDistanceToLand(currentLat, currentLon, config?.coastlineSource, fastMode) * 111.12;
    const r7TouchesLand = distToLandKm < baseR7;

    // Slider Limit constraint
    if (config.maxIntensityLimitEnabled && currentVmax > maxLimit) {
      forecastRapidIntensifying = false;
      if (forecastForcedDecayTargetVmax !== maxLimit || forecastForcedDecayStartVmax === undefined || currentVmax > forecastForcedDecayStartVmax) {
        forecastForcedDecayStartVmax = currentVmax;
        forecastForcedDecayTargetVmax = maxLimit;
        forecastForcedDecayElapsedHours = 0;

        const decayGap = currentVmax - maxLimit;
        let dur = Math.max(1.5, decayGap / 2.0);
        if (metrics.isLand) dur *= 0.8;
        forecastForcedDecayDuration = dur;
      }
      forecastForcedDecayElapsedHours += stepSizeHours;
      const dur = forecastForcedDecayDuration || 3.0;

      // Always use smooth non-linear S-curve / bell curve decay rate
      const p = Math.max(0.001, Math.min(1.0, forecastForcedDecayElapsedHours / dur));
      const deltaV = Math.max(0.5, forecastForcedDecayStartVmax - forecastForcedDecayTargetVmax);
      let targetDecayRate = deltaV / dur;
      const localEnvQuality = Math.max(0, Math.min(1.0, (sstVal - 26.0) / 3.0 - shearVal / 22.0 + rhVal / 200.0));
         targetDecayRate = Math.min(localEnvQuality > 0.65 ? 1.2 : 2.0, targetDecayRate);
      

      const forcedDecayRate = -targetDecayRate;
      vmaxDeltaPerHour = Math.min(vmaxDeltaPerHour, forcedDecayRate);
    } else {
      forecastForcedDecayStartVmax = undefined;
      forecastForcedDecayTargetVmax = undefined;
      forecastForcedDecayElapsedHours = 0;
      forecastForcedDecayDuration = undefined;
      forecastForcedDecayIsContinuous = false;
      if (vmaxDeltaPerHour > 0) {
        vmaxDeltaPerHour *= Math.min(1.0, Math.max(0, maxLimit - currentVmax) / 15.0);
      }
    }

    // Structural damage penalty check
    if (forecastIsStructureDamaged && !metrics.isLand) {
      const growthMultiplier = forecastPassedLuzon ? 0.18 : (forecastPassedTaiwan ? 0.05 : 0.25);
      if (vmaxDeltaPerHour > 0) {
        vmaxDeltaPerHour *= growthMultiplier;
      }
    }

    const r10Radius = currentVmax >= 24.5 ? currentVmax * 4.2 + 20 : 0;
    const forecastR10TouchesLand = r10Radius > 0 && distToLandKm < r10Radius;
    if (forecastR10TouchesLand) {
      forecastR10LandContactHours += stepSizeHours;
    } else {
      forecastR10LandContactHours = Math.max(0, forecastR10LandContactHours - stepSizeHours * 2.0);
    }

    if (metrics.isLand || forecastR10TouchesLand || r7TouchesLand) {
      forecastLandContactHours += stepSizeHours;
      
      let coverage = 0;
      let maxElevation = 0;
      const r12Radius = currentVmax >= 24.5 ? currentVmax * 4.2 + 20 : 35;
      
      if (fastMode) {
        if (metrics.isLand) {
          coverage = 1.0;
          maxElevation = metrics.elevation;
        } else {
          const approxDistKm = distToLandKm;
          if (r10Radius > 0 && approxDistKm < r10Radius) {
            coverage = Math.max(0.05, Math.min(0.95, (1.0 - (approxDistKm / r10Radius)) * 0.4));
            maxElevation = 150;
          }
        }
      } else {
        coverage = metrics.isLand ? 1.0 : (fastMode ? 0 : (forecastR10TouchesLand ? getLandCoverage(currentLat, currentLon, r10Radius, config?.coastlineSource) : getLandCoverage(currentLat, currentLon, baseR7, config?.coastlineSource) * 0.3));
        const terrainSample = fastMode ? { maxElevation: metrics.isLand ? metrics.elevation : 0 } : getMaxElevationInRadius(currentLat, currentLon, baseR7, config?.coastlineSource);
        maxElevation = terrainSample.maxElevation;
      }

      let intensityFactor = 0.6;
      if (currentVmax > 32.7) {
         intensityFactor = 1.2 + 1.8 * Math.pow((currentVmax - 32.7) / 25.0, 0.9);
      } else if (currentVmax > 17.2) {
         // Speed up weakening for 8-9 level tropical storms over land (17.2 - 24.4 m/s)
         const tFactor = (currentVmax - 17.2) / 15.5;
         if (currentVmax <= 24.5) {
            intensityFactor = 1.0 + 0.65 * tFactor;
         } else {
            intensityFactor = 0.6 + 0.8 * tFactor;
         }
      } else {
         intensityFactor = 1.05 + 0.65 * (1.0 - currentVmax / 17.2);
      }
      const deepInlandFactor = 1.0 + Math.min(1.5, forecastLandHours / 18.0);

      // High-elevation terrain impact (Requirement 4: Reduced multipliers - Synchronized)
      let elevationScale = 11000.0;
      let terrainMulti = 0.09;
      let luzonFactor = 1.0;
      if (currentLat >= 12 && currentLat <= 19 && currentLon >= 119 && currentLon <= 123) {
        elevationScale = 42000.0;
        terrainMulti = 0.006;
        luzonFactor = 0.82; // Slightly weaken the rate of intensity decrease on Luzon by 18%
      }
      if (currentLat >= 18 && currentLat <= 20.5 && currentLon >= 108.5 && currentLon <= 111.5) {
        elevationScale = 48000.0;
        terrainMulti = 0.0035;
      }
      if (currentLat >= 21.5 && currentLat <= 25.5 && currentLon >= 119.5 && currentLon <= 122.5) {
        elevationScale = 6200.0; // Synchronized with active simulation
        terrainMulti = 0.48; // Synchronized with active simulation
        if (currentVmax > 30.0) {
          const taiwanShred = 1.0 + Math.pow((currentVmax - 30.0) / 12.0, 1.2) * 0.38; // Synchronized with active simulation
          terrainMulti *= taiwanShred;
        }
      }

      const durationScale = Math.min(1.0, forecastLandContactHours / 24.0);
      const r10DurationFactor = Math.min(1.2, forecastR10LandContactHours / 16.0);
      const elevationEffectMultiplier = (1.0 + 0.6 * Math.pow(durationScale, 1.25)) * (1.0 + r10DurationFactor * 0.5);
      const adjustedTerrainMulti = terrainMulti * elevationEffectMultiplier;

      const elevationFactor = Math.pow(maxElevation / elevationScale, 0.95);
      const r10FrictionMultiplier = 1.0 + 0.4 * Math.min(1.0, forecastR10LandContactHours / 12.0);
      const baseLandDecay = (0.85 + elevationFactor * adjustedTerrainMulti) * intensityFactor * deepInlandFactor * r10FrictionMultiplier * luzonFactor;
      
      let coreSeaCoverage = 1.0;
      if (fastMode) {
        coreSeaCoverage = 1.0 - coverage;
      } else {
        coreSeaCoverage = 1.0 - (forecastR10TouchesLand ? getLandCoverage(currentLat, currentLon, r12Radius, config?.coastlineSource) : 0);
      }
      const seaGainFactor = Math.max(0.4, 1.0 - ((1.0 - coverage) * 0.5 + coreSeaCoverage * 0.35));
      
      let finalLandDecay = baseLandDecay * coverage * seaGainFactor;

      // Moisture reduction supply in forecast (Synchronized with simulation)
      const moistureSupply = Math.max(0.0, Math.min(1.0, (rhVal - 50.0) / 40.0));
      const moistureReduction = 0.25 * moistureSupply;
      finalLandDecay *= (1.0 - moistureReduction);

      if (metrics.isLand) {
        forecastLandHours += stepSizeHours;
        if (metrics.elevation > forecastMaxLandElevationPassed) {
          forecastMaxLandElevationPassed = metrics.elevation;
          if (metrics.elevation > 1500 && currentLat >= 21.5 && currentLat <= 25.5 && currentLon >= 119.5 && currentLon <= 122.5) {
             forecastPassedTaiwan = true;
          }
          if (metrics.elevation > 700 && currentLat >= 12.0 && currentLat <= 19.5 && currentLon >= 119.0 && currentLon <= 124.0) {
             forecastPassedLuzon = true;
          }
        }
        
        const landfallAdjustmentFactor = Math.max(0.01, 1.0 + (config.landfallDecayAdjustment ?? 0.0));
        vmaxDeltaPerHour = -finalLandDecay * landfallAdjustmentFactor;
      } else {
        forecastLandHours = 0;
        const proximityAdjustmentFactor = Math.max(0.01, 1.0 + (config.landProximityDecayAdjustment ?? 0.0));
        const effectiveProximityDecay = finalLandDecay * proximityAdjustmentFactor;
        
        if (config.landDecayEnabled) {
          const envDelta = vmaxDeltaPerHour;
          // Scraping detection
          let scrapingMultiplier = 0.75; 
          if (forecastLandContactHours > 3.0) {
              const scrapeIntensity = Math.min(1.0, (forecastLandContactHours - 3.0) / 6.0);
              scrapingMultiplier = 0.75 + 0.65 * scrapeIntensity; // Up to 1.4x effectiveDecay
          }
          const landDelta = -effectiveProximityDecay * scrapingMultiplier;
          vmaxDeltaPerHour = envDelta < 0 ? (Math.min(envDelta, landDelta) + Math.max(envDelta, landDelta) * 0.2) : (envDelta + landDelta);
          vmaxDeltaPerHour = Math.max(-10.5, vmaxDeltaPerHour);
        }
      }
    } else {
      forecastLandHours = 0;
      forecastLandContactHours = Math.max(0, forecastLandContactHours - stepSizeHours * 2.0);
    }

    // RI dynamic boost
    if (config.rapidIntensifyEnabled && !metrics.isLand && ewrcState === "none") {
      if (forecastRapidIntensifying) {
        const sstBoost = Math.max(0, sstVal - 28.0) * 0.45;
        const shearBoost = Math.max(0, 10.0 - shearVal) * 0.08;
        const ohcBoost = Math.min(1.0, ohcVal / 120.0) * 0.35;
        vmaxDeltaPerHour = Math.max(vmaxDeltaPerHour, 1.5) + (0.5 + sstBoost + shearBoost + ohcBoost);
        if (favScore < 0.1 || currentVmax >= 58.0) forecastRapidIntensifying = false;
      } else if (sstVal >= 28.5 && shearVal < 8.0 && rhVal > 72.0 && currentVmax >= 25.0) {
        forecastRapidIntensifying = true;
      }
    }

    // EWRC simulation along forecast
    if (ewrcState === "forming" || ewrcState === "max_decay") {
      ewrcProgress += stepSizeHours / ewrcDuration;
      // Requirement 3: EWRC rate cap 0.2 m/s per hour and slight weakening trend
      vmaxDeltaPerHour = Math.min(0.2, vmaxDeltaPerHour);
      if (vmaxDeltaPerHour > -0.1) {
        vmaxDeltaPerHour -= 0.15;
      }
      if (ewrcProgress < 0.5) {
        vmaxDeltaPerHour -= ewrcWeakenAmount / (ewrcDuration / 2);
      }
      if (ewrcProgress >= 1.0) {
        ewrcState = "recovering_success";
        ewrcProgress = 0;
        ewrcExtraAdjust = 4.0 / ewrcRecoveryDuration;
      }
    } else if (ewrcState === "recovering_success" || ewrcState === "recovering_failure") {
      ewrcProgress += stepSizeHours / ewrcRecoveryDuration;
      vmaxDeltaPerHour += ewrcExtraAdjust;
      if (ewrcProgress >= 1.0) {
        ewrcState = "none";
        ewrcProgress = 0;
      }
    }

    // Total Energy Concept slowdown
    if (vmaxDeltaPerHour > 0 && typhoon.maxR7Limit && typhoon.maxR7Limit > 400) {
      const slowDownFactor = 1.0 - Math.min(0.5, (typhoon.maxR7Limit - 400) / 300);
      vmaxDeltaPerHour *= slowDownFactor;
    }

    // Westerlies depth decay (Requirement 2)
    if (config.westerliesEnabled && currentLat > config.westerliesLat - 3.0) {
      const depth = Math.min((currentLat - (config.westerliesLat - 3.0)) / 10.0, 1.0);
      let westerliesDecay = 1.8;
      if (currentVmax > 28.4) {
        westerliesDecay = 1.8 + (currentVmax - 28.4) * 0.15;
      } else if (currentVmax >= 13.9) {
        westerliesDecay = 0.15 + (currentVmax - 13.9) * 0.11;
      } else {
        westerliesDecay = 0.05;
      }
      vmaxDeltaPerHour -= depth * westerliesDecay;
    }

    vmaxDeltaPerHour = Math.max(-12.5, Math.min(2.2, vmaxDeltaPerHour));
    if (vmaxDeltaPerHour > 2.2) {
      vmaxDeltaPerHour = 2.2;
    }
    if (config.maxIntensityLimitEnabled && currentVmax >= maxLimit && vmaxDeltaPerHour > 0) {
      vmaxDeltaPerHour = 0;
    }
    const preStepVmax = currentVmax;
    currentVmax += vmaxDeltaPerHour * stepSizeHours;
    currentVmax = Math.max(8.0, currentVmax);
    if (config.maxIntensityLimitEnabled) {
      if (preStepVmax <= maxLimit) {
        currentVmax = Math.min(maxLimit, currentVmax);
      } else {
        currentVmax = Math.min(currentVmax, preStepVmax);
      }
    }

    // Track Super Typhoon land duration
    if (metrics.isLand && currentVmax >= 51.0) {
      if (speedKmh < 30.0) forecastSuperTyLandHours += stepSizeHours;
    } else {
      forecastSuperTyLandHours = 0;
    }
    if (forecastSuperTyLandHours >= 8.0 && currentVmax >= 51.0) {
      currentVmax = 50.8;
    }

    currentPmin = calculatePressure(currentVmax);

    let category = TyphoonCategory.TD;
    if (currentVmax >= 17.2 && currentVmax < 24.5) category = TyphoonCategory.TS;
    else if (currentVmax >= 24.5 && currentVmax < 32.7) category = TyphoonCategory.STS;
    else if (currentVmax >= 32.7 && currentVmax < 41.5) category = TyphoonCategory.TY;
    else if (currentVmax >= 41.5 && currentVmax < 51.0) category = TyphoonCategory.STY;
    else if (currentVmax >= 51.0) category = TyphoonCategory.SuperTY;

    forecast.push({
      lat: currentLat,
      lon: currentLon,
      vmax: currentVmax,
      pmin: currentPmin,
      simHour: h,
      category,
      speed: speedKmh
    });

    // Extratropical Transition (ET) in forecast (Requirement 2) - DELETED
    forecastExtrTransition = 0;

    if (forecastExtrTransition >= 0.9) {
      forecastEtHours += stepSizeHours;
    } else {
      forecastEtHours = 0;
    }

    const reached170E = currentLon >= 170.0;
    const etDissipated = forecastEtHours >= 24.0;
    const generalDissipated = currentVmax < 10.8;
    const isTDOnLandForTooLong = metrics.isLand && currentVmax < 17.2 && forecastLandHours >= 6.0;
    const isOceanWeakenBelow15 = !metrics.isLand && currentVmax < 15.0;

    if (reached170E || etDissipated || generalDissipated || isTDOnLandForTooLong || isOceanWeakenBelow15) {
      break;
    }
  }

  return forecast;
}

export const WEATHER_STATIONS_DATA = [
  // Rank 1: Main regions / capitals (shown at lowest density >= 5%)
  { name: "上海", lat: 31.2304, lon: 121.4737, threshold: 5 },
  { name: "台北", lat: 25.0329, lon: 121.5654, threshold: 5 },
  { name: "东京", lat: 35.6762, lon: 139.6503, threshold: 5 },
  { name: "马尼拉", lat: 14.5995, lon: 120.9842, threshold: 5 },
  { name: "香港", lat: 22.3193, lon: 114.1694, threshold: 5 },
  
  // Rank 2: Key coastal cities (shown at density >= 20%)
  { name: "福州", lat: 26.0745, lon: 119.2965, threshold: 20 },
  { name: "温州", lat: 27.9942, lon: 120.6993, threshold: 20 },
  { name: "广州", lat: 23.1291, lon: 113.2644, threshold: 20 },
  { name: "那霸", lat: 26.2124, lon: 127.6809, threshold: 20 },
  { name: "高雄", lat: 22.6272, lon: 120.3014, threshold: 20 },
  { name: "首尔", lat: 37.5665, lon: 126.9780, threshold: 20 },
  { name: "海口", lat: 20.0319, lon: 110.3311, threshold: 20 },
  
  // Rank 3: Intermediate cities (shown at density >= 40%)
  { name: "宁波", lat: 29.8683, lon: 121.5439, threshold: 40 },
  { name: "厦门", lat: 24.4798, lon: 118.0894, threshold: 40 },
  { name: "汕头", lat: 23.3540, lon: 116.6819, threshold: 40 },
  { name: "湛江", lat: 21.2766, lon: 110.3592, threshold: 40 },
  { name: "三亚", lat: 18.2528, lon: 109.5119, threshold: 40 },
  { name: "鹿儿岛", lat: 31.5966, lon: 130.5571, threshold: 40 },
  { name: "釜山", lat: 35.1796, lon: 129.0756, threshold: 40 },
  { name: "岘港", lat: 16.0544, lon: 108.2022, threshold: 40 },
  { name: "南京", lat: 32.0603, lon: 118.7969, threshold: 40 },
  
  // Rank 4: Extra coastal & inland (shown at density >= 60%)
  { name: "深圳", lat: 22.5431, lon: 114.0579, threshold: 60 },
  { name: "珠海", lat: 22.2707, lon: 113.5767, threshold: 60 },
  { name: "台南", lat: 22.9997, lon: 120.2270, threshold: 60 },
  { name: "济州", lat: 33.4996, lon: 126.5312, threshold: 60 },
  { name: "大阪", lat: 34.6937, lon: 135.5023, threshold: 60 },
  { name: "福冈", lat: 33.5904, lon: 130.4017, threshold: 60 },
  { name: "海防", lat: 20.8449, lon: 106.6881, threshold: 60 },
  { name: "北京", lat: 39.9042, lon: 116.4074, threshold: 60 },
  { name: "武汉", lat: 30.5928, lon: 114.3055, threshold: 60 },
  { name: "长沙", lat: 28.2282, lon: 112.9388, threshold: 60 },
  
  // Rank 5: Detailed coverages (shown at density >= 80%)
  { name: "大连", lat: 38.9140, lon: 121.6147, threshold: 80 },
  { name: "青岛", lat: 36.0671, lon: 120.3826, threshold: 80 },
  { name: "盐城", lat: 33.3473, lon: 120.1636, threshold: 80 },
  { name: "舟山", lat: 29.9855, lon: 122.2072, threshold: 80 },
  { name: "台州", lat: 28.6564, lon: 121.4215, threshold: 80 },
  { name: "阳江", lat: 21.8511, lon: 111.9778, threshold: 80 },
  { name: "茂名", lat: 21.6629, lon: 110.9234, threshold: 80 },
  { name: "北海", lat: 21.4812, lon: 109.1202, threshold: 80 },
  { name: "石垣岛", lat: 24.3444, lon: 124.1572, threshold: 80 },
  { name: "塞班", lat: 15.1909, lon: 145.7183, threshold: 80 },
  { name: "关岛", lat: 13.4443, lon: 144.7937, threshold: 80 },
  { name: "胡志明市", lat: 10.8231, lon: 106.6297, threshold: 80 },
  { name: "南昌", lat: 28.6820, lon: 115.8579, threshold: 80 },
  { name: "杭州", lat: 30.2741, lon: 120.1551, threshold: 80 },
  
  // Rank 6: High density coverages (shown at density >= 95%)
  { name: "连云港", lat: 34.5967, lon: 119.2238, threshold: 95 },
  { name: "泉州", lat: 24.8741, lon: 118.6757, threshold: 95 },
  { name: "漳州", lat: 24.5129, lon: 117.6470, threshold: 95 },
  { name: "防城港", lat: 21.6136, lon: 108.3533, threshold: 95 },
  { name: "三沙", lat: 16.8333, lon: 112.3333, threshold: 95 },
  { name: "宫古岛", lat: 24.8055, lon: 125.2811, threshold: 95 },
  { name: "巴士古", lat: 20.4485, lon: 121.9705, threshold: 95 },
  { name: "宿务", lat: 10.3157, lon: 123.8854, threshold: 95 },
  { name: "达沃", lat: 7.1907, lon: 125.4553, threshold: 95 },
  { name: "芽庄", lat: 12.2388, lon: 109.1967, threshold: 95 },
  { name: "帕劳", lat: 7.3526, lon: 134.4789, threshold: 95 },
  { name: "雅浦", lat: 9.5167, lon: 138.1167, threshold: 95 },
  { name: "澳门", lat: 22.1987, lon: 113.5439, threshold: 95 },
  { name: "惠州", lat: 23.1115, lon: 114.4156, threshold: 95 },
  { name: "中山", lat: 22.5170, lon: 113.3928, threshold: 95 },
  { name: "潮州", lat: 23.6569, lon: 116.6226, threshold: 95 },
  { name: "揭阳", lat: 23.5498, lon: 116.3729, threshold: 95 },
  { name: "宁德", lat: 26.6656, lon: 119.5479, threshold: 95 },
  { name: "莆田", lat: 25.4541, lon: 119.0076, threshold: 95 },
  { name: "龙岩", lat: 25.0916, lon: 117.0179, threshold: 95 },
  { name: "丽水", lat: 28.4676, lon: 119.9230, threshold: 95 },
  { name: "衢州", lat: 28.9358, lon: 118.8758, threshold: 95 },
  { name: "嘉兴", lat: 30.7522, lon: 120.7554, threshold: 95 },
  { name: "湖州", lat: 30.8943, lon: 120.0868, threshold: 95 },
  { name: "南通", lat: 31.9802, lon: 120.8943, threshold: 95 },
  { name: "泰州", lat: 32.4555, lon: 119.9229, threshold: 95 },
  { name: "扬州", lat: 32.3942, lon: 119.4129, threshold: 95 },
  { name: "淮安", lat: 33.6104, lon: 119.0153, threshold: 95 },
  { name: "烟台", lat: 37.4638, lon: 121.4479, threshold: 95 },
  { name: "威海", lat: 37.5131, lon: 122.1204, threshold: 95 },
  { name: "潍坊", lat: 36.7068, lon: 119.1618, threshold: 95 },
  { name: "营口", lat: 40.6670, lon: 122.2354, threshold: 95 },
  { name: "丹东", lat: 40.0007, lon: 124.3541, threshold: 95 },
  { name: "钦州", lat: 21.9664, lon: 108.6242, threshold: 95 },
  { name: "玉林", lat: 22.6363, lon: 110.1652, threshold: 95 },
  { name: "梧州", lat: 23.4770, lon: 111.2791, threshold: 95 },
  { name: "琼海", lat: 19.2435, lon: 110.4668, threshold: 95 },
  { name: "文昌", lat: 19.6129, lon: 110.7540, threshold: 95 },
  { name: "花莲", lat: 23.9871, lon: 121.6015, threshold: 95 },
  { name: "宜兰", lat: 24.7570, lon: 121.7530, threshold: 95 }
];

const STATION_LAND_CACHE = new Map<string, boolean>();
function isStationOnLand(stationName: string, lat: number, lon: number): boolean {
  if (STATION_LAND_CACHE.has(stationName)) {
    return STATION_LAND_CACHE.get(stationName)!;
  }
  const isLand = EAST_ASIA_LAND.some(land => checkPointInPolygon(lat, lon, land.polygon));
  STATION_LAND_CACHE.set(stationName, isLand);
  return isLand;
}

export function calculateStationReadings(
  lat: number,
  lon: number,
  vmax: number,
  pmin: number,
  rmw: number,
  r7?: { ne: number; se: number; sw: number; nw: number },
  r10?: { ne: number; se: number; sw: number; nw: number },
  r12?: { ne: number; se: number; sw: number; nw: number },
  previousReadings?: StationReading[],
  totalCasualties: number = 0
): StationReading[] {
  const targetTotalCasualties = Math.max(0, Math.floor(totalCasualties));

  // 1. First pass: compute meteorological variables and local hazard weights for all stations
  const intermediate = WEATHER_STATIONS_DATA.map(station => {
    const R = 6371;
    const dLatRad = (station.lat - lat) * (Math.PI / 180);
    const dLonRad = (station.lon - lon) * (Math.PI / 180);
    const a = Math.sin(dLatRad / 2) * Math.sin(dLatRad / 2) +
              Math.cos(lat * (Math.PI / 180)) * Math.cos(station.lat * (Math.PI / 180)) *
              Math.sin(dLonRad / 2) * Math.sin(dLonRad / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = R * c;
    
    // Azimuthal Quadrant based on relative station coordinate vectors
    const dLat = station.lat - lat;
    const dLon = (station.lon - lon) * Math.cos((lat * Math.PI) / 180);
    
    let quad: "ne" | "se" | "sw" | "nw" = "ne";
    if (dLat >= 0 && dLon >= 0) {
      quad = "ne";
    } else if (dLat < 0 && dLon >= 0) {
      quad = "se";
    } else if (dLat < 0 && dLon < 0) {
      quad = "sw";
    } else {
      quad = "nw";
    }

    // Retrieve quadrant radii, falling back to symmetric estimate if r7/r10/r12 are undefined
    const qR7 = (r7 && r7[quad] > 0) ? r7[quad] : Math.max(100, vmax * 4);
    const qR10 = (r10 && r10[quad] > 0) ? r10[quad] : (vmax >= 24.5 ? Math.max(50, qR7 * 0.6) : 0);
    const qR12 = (r12 && r12[quad] > 0) ? r12[quad] : (vmax >= 32.7 ? Math.max(30, qR7 * 0.4) : 0);
    
    let windSpeed = 0;
    
    // Requirement 2: Typhoon center low wind speed zone mechanism
    // 1. Center low wind zone diameter 24-50km (radius R_center 12-25km) which is highly realistic.
    const R_center = Math.max(12.0, Math.min(25.0, rmw * 0.65));
    
    // 2. Check if station location is on mainland (大陆) vs island/sea
    let isMainlandStation = false;
    if (station.lat > 18 && station.lat < 45 && station.lon > 105 && station.lon < 123) {
      const isTaiwan = station.lat >= 21.5 && station.lat <= 25.5 && station.lon >= 119.5 && station.lon <= 122.5;
      const isHainan = station.lat >= 18 && station.lat <= 20.5 && station.lon >= 108.5 && station.lon <= 111.5;
      if (!isTaiwan && !isHainan) {
        isMainlandStation = true;
      }
    }

    // 3. Calculate center wind ratio relative to eyewall vmax
    // For Typhoon strength (>= 32.7 m/s), center wind drops SIGNIFICANTLY (down to 8% - 22% of eyewall speed)
    let centerRatio = 0.98;
    if (vmax >= 32.7) {
      centerRatio = Math.max(0.08, 0.22 - 0.14 * Math.min(1.0, (vmax - 32.7) / 30.0));
    } else if (vmax >= 17.2) {
      // For Tropical Storms: moderate drop (down to 35% - 60%)
      const f = (vmax - 17.2) / 15.5; // 0 to 1
      centerRatio = 0.85 - 0.50 * f;
    } else {
      // For Tropical Depressions: very slight drop
      centerRatio = 0.95;
    }

    // 4. If typhoon lands on mainland landmass, central low wind speed zone increases slightly due to terrain friction / turbulence
    if (isMainlandStation && isStationOnLand(station.name, station.lat, station.lon)) {
      centerRatio = Math.min(0.85, centerRatio + 0.15);
    }

    const V_center = vmax * centerRatio;

    if (dist <= rmw) {
      if (dist <= R_center) {
        // Core center low wind zone (diameter <= 20km)
        windSpeed = V_center;
      } else {
        // Transition zone from R_center to rmw (eyewall)
        const ratio = (dist - R_center) / Math.max(1, rmw - R_center);
        const steepness = vmax >= 41.5 ? 2.0 : (1.0 + 0.9 * (vmax / 41.5));
        windSpeed = V_center + (vmax - V_center) * Math.pow(ratio, steepness);
      }
    } else if (qR12 > 0 && dist <= qR12) {
      // RMW to R12 zone: wind speed drops from vmax to 32.7 m/s
      const ratio = (dist - rmw) / Math.max(1, qR12 - rmw);
      windSpeed = vmax - (vmax - 32.7) * ratio;
    } else if (qR10 > 0 && dist <= qR10) {
      // R12 to R10 zone: wind speed drops from 32.7 to 24.5 m/s
      const startWind = qR12 > 0 ? 32.7 : vmax;
      const startDist = qR12 > 0 ? qR12 : rmw;
      const ratio = (dist - startDist) / Math.max(1, qR10 - startDist);
      windSpeed = startWind - (startWind - 24.5) * ratio;
    } else if (qR7 > 0 && dist <= qR7) {
      // R10 to R7 zone: wind speed drops from 24.5 to 13.9 m/s
      const startWind = qR10 > 0 ? 24.5 : (qR12 > 0 ? 32.7 : vmax);
      const startDist = qR10 > 0 ? qR10 : (qR12 > 0 ? qR12 : rmw);
      const ratio = (dist - startDist) / Math.max(1, qR7 - startDist);
      windSpeed = startWind - (startWind - 13.9) * ratio;
    } else {
      // Outside R7 zone: wind speed decays relative to R7 boundary
      const startWind = qR7 > 0 ? 13.9 : (qR10 > 0 ? 24.5 : (qR12 > 0 ? 32.7 : vmax));
      const startDist = qR7 > 0 ? qR7 : (qR10 > 0 ? qR10 : (qR12 > 0 ? qR12 : rmw));
      windSpeed = startWind * Math.exp(-(dist - startDist) / 150.0);
    }
    
    // Ensure windSpeed doesn't exceed vmax
    windSpeed = Math.max(0, Math.min(vmax, windSpeed));
    
    // Requirement 5: Apply simple land friction/attenuation if station is on land (which it is, since it's a city)
    // Reduce wind speed by 10-25% depending on distance to center and intensity, simulating terrain friction
    // But do not do expensive polygon checks. We can assume all WEATHER_STATIONS are on land.
    const frictionFactor = Math.max(0.70, 0.90 - (windSpeed / 100.0) * 0.15 - (dist / Math.max(1, qR7)) * 0.05);
    windSpeed *= frictionFactor;

    // Pressure profile
    const windRatio = vmax > 0 ? Math.min(1.0, windSpeed / vmax) : 0;
    let pressure = 1013 - Math.pow(windRatio, 2) * (1013 - pmin);
    if (dist <= rmw) {
      const ratio = dist / Math.max(1, rmw);
      pressure = pmin + (1013 - pmin) * 0.08 * ratio;
    }
    pressure = Math.max(pmin, Math.min(1013, pressure));
    
    // Precipitation Rate (hourly) - Symmetric Physical Model for Balanced Typhoons (Requirement 2)
    const isLand = isStationOnLand(station.name, station.lat, station.lon);
    const elevation = isLand ? getProceduralElevation(station.lat, station.lon) : 0;
    
    const R_eye = rmw || 35;
    const R_eyewall = R_eye * 1.25;
    
    // Radially symmetric eyewall ring profile (equal before and after eye passage)
    const inEyewall = Math.max(0, 1.0 - Math.abs(dist - R_eyewall) / Math.max(1, R_eyewall * 0.6));
    const eyewallPeakRate = Math.min(80.0, 15.0 + 1.1 * vmax);
    const symmetricEyewallRate = inEyewall * eyewallPeakRate;

    // Spiral band contribution
    const angleToStation = Math.atan2((station.lat - lat) * 111, (station.lon - lon) * 111 * Math.cos((lat * Math.PI) / 180));
    const spiralPhase = angleToStation - 2.8 * Math.log(Math.max(1, dist / 20.0));
    const spiralPulse = Math.pow(Math.cos(3.0 * spiralPhase), 2) * Math.exp(-dist / 320.0);
    const rawRainbandRate = (15.0 + 0.6 * vmax) * spiralPulse;

    // In the core eyewall zone (dist <= 1.8 * R_eyewall), blend out spiral band asymmetry into a symmetric eyewall ring
    const coreWeight = Math.exp(-Math.pow((dist - R_eyewall) / (R_eyewall * 0.75), 2));
    const blendedRainbandRate = rawRainbandRate * (1.0 - 0.75 * coreWeight) + (15.0 + 0.4 * vmax) * 0.75 * coreWeight;

    const envelope = Math.exp(-dist / (vmax * 3.5 + 60));
    const stratiformRate = (6.0 + 0.3 * vmax) * envelope;

    let precRate = Math.max(symmetricEyewallRate, blendedRainbandRate + stratiformRate);

    // Symmetric eye subsidence reduction inside the eye
    if (vmax > 32.7 && dist < R_eye) {
      const eyeFactor = 0.08 + 0.92 * Math.pow(dist / R_eye, 2);
      precRate *= eyeFactor;
    }

    if (isLand) {
      let landBoost = 1.25;
      if (elevation > 100) {
        landBoost += 1.2 * Math.min(1.0, elevation / 1200.0);
      }
      precRate *= landBoost;
    }

    precRate = Math.min(100.0, precRate);
    precRate = Math.round(precRate * 10) / 10;
    
    // Get previous readings for accumulation
    const prev = previousReadings?.find(r => r.name === station.name);
    const prevMaxWind = prev?.maxWindSpeed ?? 0;
    const prevAccumPrecip = prev?.accumPrecip ?? 0;
    const prevCasualties = prev?.casualties ?? 0;
    
    const maxWindSpeed = Math.max(prevMaxWind, windSpeed);
    const accumPrecip = prevAccumPrecip + precRate;
    
    // Warning
    let warning = "无预警";
    if (windSpeed >= 32.7) warning = "台风红色预警";
    else if (windSpeed >= 24.4) warning = "台风橙色预警";
    else if (windSpeed >= 17.2) warning = "台风黄色预警";
    else if (windSpeed >= 10.8) warning = "台风蓝色预警";

    // Compute station impact hazard weight
    const windHazard = Math.max(0, Math.pow(windSpeed / 17.0, 3.0) - 0.2);
    const rainHazard = Math.max(0, Math.pow(precRate / 12.0, 1.8));
    const rawHazard = windHazard + rainHazard;

    let casualtyMultiplier = 1.0;
    if (station.lat > 18 && station.lat < 45 && station.lon > 105 && station.lon < 123) {
      const isTaiwan = station.lat >= 21.5 && station.lat <= 25.5 && station.lon >= 119.5 && station.lon <= 122.5;
      const isHainan = station.lat >= 18 && station.lat <= 20.5 && station.lon >= 108.5 && station.lon <= 111.5;
      if (!isTaiwan && !isHainan) {
        casualtyMultiplier = 0.5;
      }
    }

    const proxWeight = 1.0 / (dist + 50.0);
    const hazardWeight = (rawHazard > 0.05 ? rawHazard : proxWeight * 0.01) * casualtyMultiplier;

    return {
      station,
      windSpeed: Number(windSpeed.toFixed(1)),
      pressure: Number(pressure.toFixed(1)),
      precipitation: Number(precRate.toFixed(1)),
      maxWindSpeed: Number(maxWindSpeed.toFixed(1)),
      accumPrecip: Number(accumPrecip.toFixed(1)),
      warning,
      prevCasualties,
      hazardWeight
    };
  });

  // 2. Distribute casualties among stations so that sum(stationCasualties) === targetTotalCasualties
  const totalWeight = intermediate.reduce((sum, item) => sum + item.hazardWeight, 0);
  const prevSumCasualties = intermediate.reduce((sum, item) => sum + item.prevCasualties, 0);

  let finalCasualties: number[] = [];

  if (targetTotalCasualties === 0) {
    finalCasualties = intermediate.map(() => 0);
  } else if (previousReadings && previousReadings.length > 0 && prevSumCasualties <= targetTotalCasualties) {
    const newCasualtiesTotal = targetTotalCasualties - prevSumCasualties;
    
    if (newCasualtiesTotal === 0) {
      finalCasualties = intermediate.map(item => item.prevCasualties);
    } else {
      const shares = intermediate.map(item => {
        const floatAdd = newCasualtiesTotal * (totalWeight > 0 ? item.hazardWeight / totalWeight : 1 / intermediate.length);
        const floorAdd = Math.floor(floatAdd);
        const remainder = floatAdd - floorAdd;
        return { prev: item.prevCasualties, floorAdd, remainder };
      });

      const allocatedAdd = shares.reduce((s, x) => s + x.floorAdd, 0);
      let diff = newCasualtiesTotal - allocatedAdd;

      const indices = shares.map((_, i) => i).sort((a, b) => shares[b].remainder - shares[a].remainder);
      const bonusSet = new Set(indices.slice(0, diff));

      finalCasualties = shares.map((s, i) => s.prev + s.floorAdd + (bonusSet.has(i) ? 1 : 0));
    }
  } else {
    // Full allocation of targetTotalCasualties
    const shares = intermediate.map(item => {
      const floatVal = targetTotalCasualties * (totalWeight > 0 ? item.hazardWeight / totalWeight : 1 / intermediate.length);
      const floorVal = Math.floor(floatVal);
      const remainder = floatVal - floorVal;
      return { floorVal, remainder };
    });

    const allocated = shares.reduce((s, x) => s + x.floorVal, 0);
    let diff = targetTotalCasualties - allocated;

    const indices = shares.map((_, i) => i).sort((a, b) => shares[b].remainder - shares[a].remainder);
    const bonusSet = new Set(indices.slice(0, diff));

    finalCasualties = shares.map((s, i) => s.floorVal + (bonusSet.has(i) ? 1 : 0));
  }

  // 3. Return final StationReading objects
  return intermediate.map((item, idx) => ({
    name: item.station.name,
    windSpeed: item.windSpeed,
    pressure: item.pressure,
    precipitation: item.precipitation,
    maxWindSpeed: item.maxWindSpeed,
    accumPrecip: item.accumPrecip,
    casualties: finalCasualties[idx],
    warning: item.warning
  }));
}

// Gas Fluid Dynamics Wind Field Engine (Requirement 6 & Structural Symmetry/Patchiness)
export function getFluidDynamicsWindField(
  lat: number,
  lon: number,
  ty: { lat: number; lon: number; vmax: number; rmw?: number; direction?: number; speed?: number; landed?: boolean; isStructureDamaged?: boolean },
  config?: SimulationConfig,
  precomputedIsLand?: boolean
): { speed: number; u: number; v: number; isLand: boolean } {
  const clat = ty.lat;
  const clon = ty.lon;
  const dxKm = (lon - clon) * Math.cos((clat * Math.PI) / 180) * 111.12;
  const dyKm = (lat - clat) * 111.12;
  const distKm = Math.sqrt(dxKm * dxKm + dyKm * dyKm);
  const angleToPt = Math.atan2(dyKm, dxKm);

  const rmw = ty.rmw || Math.max(20, Math.min(60, 35.0));
  const vmax = ty.vmax;
  const isLand = precomputedIsLand !== undefined ? precomputedIsLand : getLandMetrics(lat, lon, config?.coastlineSource, true).isLand;
  const elevation = isLand ? getProceduralElevation(lat, lon) : 0;

  // Structural Organization Factor based on intensity (vmax):
  // Strong typhoons (vmax >= 50m/s): highly symmetrical, round, tight eye, continuous eyewall.
  // Weak typhoons (vmax <= 22m/s): low symmetry, irregular eye, gaps/notches in eyewall ("高风速区有缺口").
  let orgFactor = Math.min(1.0, Math.max(0.0, (vmax - 22.0) / 28.0));
  if (isLand || ty.landed || ty.isStructureDamaged) {
    orgFactor *= 0.25; // Structure degrades significantly over land or when damaged
  }

  // Base Cyclonic Fluid Vortex Profile
  let baseSpeed = 0;
  if (distKm <= rmw) {
    // Sharp calm eye for typhoons: central wind drops down to 8%-22% of vmax for strong typhoons
    const R_center = Math.max(10.0, rmw * 0.45);
    let centerRatio = 0.95;
    if (vmax >= 32.7) {
      centerRatio = Math.max(0.08, 0.22 - 0.14 * Math.min(1.0, (vmax - 32.7) / 30.0));
    } else if (vmax >= 17.2) {
      const f = (vmax - 17.2) / 15.5;
      centerRatio = 0.85 - 0.50 * f;
    }
    const V_center = vmax * centerRatio;

    if (distKm <= R_center) {
      // Core calm eye zone
      baseSpeed = V_center * Math.pow(distKm / Math.max(1, R_center), 1.2);
    } else {
      // Transition zone from calm eye boundary to eyewall peak
      const ratio = (distKm - R_center) / Math.max(1, rmw - R_center);
      const steepness = vmax >= 41.5 ? 2.2 : (1.2 + 0.9 * (vmax / 41.5));
      baseSpeed = V_center + (vmax - V_center) * Math.pow(ratio, steepness);
    }
  } else {
    const dR = distKm - rmw;
    const rCore = 38.0;
    const rOuter = 260.0 + vmax * 2.0;
    const coreDecay = Math.exp(-Math.pow(dR / rCore, 1.35));
    const outerDecay = Math.exp(-Math.pow(dR / rOuter, 0.65));
    baseSpeed = vmax * (0.70 * coreDecay + 0.30 * outerDecay);
  }

  // Fluid Dynamics Asymmetry & Eyewall Gaps / Notches for Weak Typhoons
  const eddy1 = Math.sin(lat * 18.3 + lon * 24.7 + (distKm / 35.0));
  const eddy2 = Math.cos(lat * 42.1 - lon * 37.9 - angleToPt * 2.0);
  const eddy3 = Math.sin(angleToPt * 4.0 - Math.log(Math.max(1, distKm / 15.0)) * 3.5);
  
  // Spiral Rainbands Perturbation
  const spiralPhase = angleToPt * 3.0 + distKm / 45.0;
  const spiralBands = Math.sin(spiralPhase) * Math.sin(spiralPhase * 1.5) * (0.08 + 0.08 * orgFactor);
  
  // Coriolis Effect modification on inflow angle
  const fCoriolis = 2 * 7.2921e-5 * Math.sin((Math.abs(lat) * Math.PI) / 180.0);
  const inflowCoriolisAdjust = Math.min(0.2, fCoriolis * 3000); 

  const fluidTurbulence = 0.88 + (1.0 - orgFactor * 0.4) * 0.26 * (0.5 * eddy1 + 0.35 * eddy2 + 0.15 * eddy3) + spiralBands;

  let eyewallAsymmetry = 1.0;
  if (distKm <= rmw * 2.2) {
    if (orgFactor >= 0.8) {
      // High-intensity typhoon: smooth, highly symmetric circular eyewall ring
      eyewallAsymmetry = 0.96 + 0.08 * Math.abs(Math.sin(angleToPt * 2.0));
    } else {
      // Low-intensity typhoon: irregular eye, gaps/notches in high-wind zone, structural asymmetry
      const weakNotch = Math.sin(angleToPt * 2.0 + 1.2) * 0.35 + Math.cos(angleToPt * 3.0 - 0.7) * 0.25;
      const asymmetryWeight = (1.0 - orgFactor);
      eyewallAsymmetry = 1.0 + asymmetryWeight * weakNotch;
    }
  } else if (vmax > 45.0 && distKm > rmw * 2.5 && distKm < rmw * 4.0 && !isLand) {
    // Secondary Eyewall formation in intense oceanic typhoons
    const secondaryEyewall = Math.exp(-Math.pow((distKm - rmw * 3.2) / 15.0, 2.0)) * 0.12;
    eyewallAsymmetry += secondaryEyewall;
  }

  const headingRad = ((ty.direction ?? 315) * Math.PI) / 180.0;
  const relAngle = angleToPt - headingRad;
  const motionAsymmetry = 1.0 + 0.18 * Math.sin(relAngle) * Math.min(1.0, (ty.speed ?? 18) / 28.0);

  let totalSpeed = baseSpeed * fluidTurbulence * eyewallAsymmetry * motionAsymmetry;

  // Landfall Friction, Elevation Terrain Effect ("低海拔地区风速高，高海拔地区风速低") & Patchy Distribution ("斑块状")
  if (isLand || ty.landed) {
    // Low elevation areas (<100m) maintain higher wind speed, high elevation mountain regions (>300m) experience heavy terrain blocking
    let landFriction = 0.78;
    if (elevation > 50) {
      const terrainBlocking = Math.min(0.60, (elevation / 1800.0) * 0.55);
      landFriction *= (1.0 - terrainBlocking);
    }
    totalSpeed *= landFriction;

    // Multi-scale terrain patch noise creates authentic patchy wind cells ("斑块状")
    const patchNoise = Math.sin(lat * 70.0) * Math.cos(lon * 70.0) + Math.sin(lat * 140.0 + lon * 120.0) * 0.5;
    const patchFactor = 0.68 + 0.64 * (0.5 + 0.5 * patchNoise);
    totalSpeed *= patchFactor;
  }

  // Disruption of Spiral Inflow Flow upon Landfall / Weakening
  // Over land or for weak typhoons, clean spiral inflow breaks down into messy, disorganized wind vector directions
  let inflowRad = (isLand ? 0.58 : 0.31) + inflowCoriolisAdjust;
  if (isLand || orgFactor < 0.5) {
    const spiralDisruption = (1.0 - orgFactor) * 0.35 * Math.sin(lat * 35.0 + lon * 35.0);
    inflowRad += spiralDisruption;
  }
  const windDirRad = angleToPt + Math.PI / 2 - inflowRad;

  const u = -totalSpeed * Math.sin(windDirRad);
  const v = -totalSpeed * Math.cos(windDirRad);

  // Procedural ambient background wind speed (3 - 10 kt, which is 1.54 - 5.14 m/s)
  const latNoise = Math.sin(lat * 0.15 + 2.0) * Math.cos(lon * 0.12 - 1.5);
  const lonNoise = Math.cos(lat * 0.25 - lon * 0.18) * Math.sin(lon * 0.1);
  const baseAmbientMs = 2.5 + 1.4 * (latNoise + lonNoise); // Ranges from ~1.5 to 4.8 m/s (3 to 9.3 kt)

  let ambientMs = baseAmbientMs;
  if (isLand) {
    // Land surface roughness reduces wind speed
    ambientMs *= 0.72;
    // Hills and mountains (elevation) reduce ambient wind speed further
    if (elevation > 50) {
      const terrainFriction = Math.max(0.55, 1.0 - (elevation / 1800) * 0.45);
      ambientMs *= terrainFriction;
    }
  }

  // Prevailing 10m surface ambient wind direction (easterly Trade winds in low lat, light variable surface breeze in high lat)
  const ambientAngle = lat < 22.0 
    ? Math.PI + 0.25 
    : Math.PI * 0.85 + Math.sin(lat * 0.25 + lon * 0.18) * 0.45;
  const u_amb = ambientMs * Math.cos(ambientAngle);
  const v_amb = ambientMs * Math.sin(ambientAngle);

  // Smoothly blend out ambient wind near the center of the typhoon eye to keep the eye calm
  const ambientWeight = Math.min(1.0, Math.max(0.0, (distKm - 18.0) / (rmw * 1.6)));

  const finalU = u + u_amb * ambientWeight;
  const finalV = v + v_amb * ambientWeight;
  const finalSpeed = Math.sqrt(finalU * finalU + finalV * finalV);

  return { speed: finalSpeed, u: finalU, v: finalV, isLand };
}
