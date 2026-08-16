/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from "react";
import L from "leaflet";

(L.TileLayer as any).Bing = L.TileLayer.extend({
  getTileUrl: function (coords: any) {
    var quadkey = '';
    for (var i = coords.z; i > 0; i--) {
      var digit = 0;
      var mask = 1 << (i - 1);
      if ((coords.x & mask) !== 0) digit += 1;
      if ((coords.y & mask) !== 0) digit += 2;
      quadkey += digit;
    }
    return `https://ecn.t0.tiles.virtualearth.net/tiles/a${quadkey}.jpeg?g=129&mkt=en-US`;
  }
});
import "leaflet/dist/leaflet.css";
import StationHistory from "./StationHistory";
import { Typhoon, ActiveLayers, SimulationConfig, TyphoonCategory } from "../types";
import { CITIES } from "../utils/stations";
import { getSST, getOHC, getShear, getRH700, getEnvironmentalWind, EAST_ASIA_LAND, checkPointInPolygon, getCategoryColor, getWindForceCategory, calculateForecastPath, getLandMetrics, getDistanceToLand, WEATHER_STATIONS_DATA, getFilteredLandMasses } from "../simulation/Engine";
import { landGeoJson, subscribeLoaderState, getLoaderState } from "../simulation/NaturalEarthLoader";
import { MapPin, Info, X } from "lucide-react";
import { renderToString } from "react-dom/server";

function getContinuousStationColor(wind: number): string {
  const anchors = [
    [0, 16, 185, 129],    // emerald-500: #10b981 (weak wind, soft green)
    [10, 34, 197, 94],   // green-500: #22c55e
    [17, 234, 179, 8],   // yellow-500: #eab308
    [24, 249, 115, 22],  // orange-500: #f97316
    [32, 239, 68, 68],   // red-500: #ef4444
    [41, 220, 38, 38],   // red-700: #dc2626
    [51, 168, 85, 247]   // purple-500: #a855f7 (hurricane-force/extreme wind)
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

 interface MapViewProps {
  typhoons: Typhoon[];
  layers: ActiveLayers;
  config: SimulationConfig;
  speed: number;
  startDate?: Date;
  onMapClickPlacement: (lat: number, lon: number) => void;
  placementMode: "main" | "second" | "genesis" | "none";
  onDeployTyphoon?: (mode: "main" | "second" | "genesis" | "none") => void;
  onSelectTrackPoint?: (hour: number) => void;
}



 export default function MapView({
  typhoons,
  layers,
  config,
  speed,
  startDate,
  onMapClickPlacement,
  placementMode,
  onDeployTyphoon,
  onSelectTrackPoint
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const rasterCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rasterCacheKeyRef = useRef<string>("");
  const [selectedStation, setSelectedStation] = useState<{id: string, name: string, lat: number, lon: number, wind: number, pressure: number} | null>(null);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const pathGroupRef = useRef<L.FeatureGroup | null>(null);
  const radiiGroupRef = useRef<L.FeatureGroup | null>(null);
  const landGroupRef = useRef<L.FeatureGroup | null>(null);
  const stationsGroupRef = useRef<L.FeatureGroup | null>(null);
  const stationMarkersRef = useRef<{ [key: string]: L.Marker }>({});

  const [mapZoom, setMapZoom] = useState(4);
  const [radarActive, setRadarActive] = useState(false);
  const [radarMetrics, setRadarMetrics] = useState<{ lat: number; lon: number; sst: number; ohc: number; shear: number; isLand: boolean; windSpeed: number } | null>(null);
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [cursorExpanded, setCursorExpanded] = useState(false);
  const [openStationName, setOpenStationName] = useState<string | null>(null);
  const [activeHistoryStation, setActiveHistoryStation] = useState<{ id: string; name: string; lat: number; lon: number } | null>(null);
  const [mapInitialized, setMapInitialized] = useState(false);

  const [geoJsonState, setGeoJsonState] = useState(() => getLoaderState());
  useEffect(() => {
    return subscribeLoaderState(setGeoJsonState);
  }, []);

  useEffect(() => {
    (window as any).showStationHistory = (name: string, lat: number, lon: number) => {
      setActiveHistoryStation({ id: name, name, lat, lon });
    };
    return () => {
      delete (window as any).showStationHistory;
    };
  }, []);

  // Sync props to refs to avoid stale closure issues in Leaflet listeners and canvas render loops
  const placementModeRef = useRef(placementMode);
  const onMapClickPlacementRef = useRef(onMapClickPlacement);
   const onSelectTrackPointRef = useRef(onSelectTrackPoint);
  const configRef = useRef(config);
  const radarActiveRef = useRef(radarActive);
  const typhoonsRef = useRef(typhoons);
  const layersRef = useRef(layers);
  const mapZoomRef = useRef(mapZoom);

  useEffect(() => {
    onSelectTrackPointRef.current = onSelectTrackPoint;
  }, [onSelectTrackPoint]);

  useEffect(() => {
    placementModeRef.current = placementMode;
  }, [placementMode]);

  useEffect(() => {
    onMapClickPlacementRef.current = onMapClickPlacement;
  }, [onMapClickPlacement]);

   useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    radarActiveRef.current = radarActive;
  }, [radarActive]);

  useEffect(() => {
    typhoonsRef.current = typhoons;
  }, [typhoons]);

  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  useEffect(() => {
    mapZoomRef.current = mapZoom;
  }, [mapZoom]);

  const animationFrameRef = useRef<number | null>(null);

  // --- 1. Map Initialization ---
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Bulletproof reset of Leaflet container to prevent "Map container is already initialized" error
    if ((mapContainerRef.current as any)._leaflet_id !== undefined) {
      (mapContainerRef.current as any)._leaflet_id = null;
    }
    mapContainerRef.current.innerHTML = "";

    // Default center at 21°N, 134°E (covering NW Pacific)
    const map = L.map(mapContainerRef.current, {
      center: [20.0, 134.0],
      zoom: 4,
      minZoom: 3,
      maxZoom: 9,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true
    });

    mapRef.current = map;
    setMapZoom(map.getZoom());

    // Custom Leaflet Map Panes for touch priority: Stations (600) > Path Points (500) > Wind Radii (400)
    if (!map.getPane("radiiPane")) {
      map.createPane("radiiPane");
      map.getPane("radiiPane")!.style.zIndex = "400";
    }
    if (!map.getPane("pathPane")) {
      map.createPane("pathPane");
      map.getPane("pathPane")!.style.zIndex = "500";
    }
    if (!map.getPane("stationsPane")) {
      map.createPane("stationsPane");
      map.getPane("stationsPane")!.style.zIndex = "600";
    }

    // Feature Groups assigned to respective zIndex panes
    const canvasRenderer = L.canvas({ padding: 0.5 });
    landGroupRef.current = L.featureGroup().addTo(map);
    radiiGroupRef.current = L.featureGroup([], { pane: "radiiPane" }).addTo(map);
    pathGroupRef.current = L.featureGroup([], { pane: "pathPane" }).addTo(map);
    stationsGroupRef.current = L.featureGroup([], { pane: "stationsPane" }).addTo(map);

    (map as any)._canvasRenderer = canvasRenderer; // store for easy access

    // Event listeners
    map.on("zoomend", () => setMapZoom(map.getZoom()));

    const getIntegratedWindAtCoord = (lat: number, lon: number): { u: number; v: number } => {
      let u_env = 0;
      let v_env = 0;
      const envWind = getEnvironmentalWind(850, lat, lon, configRef.current);
      u_env += envWind.u;
      v_env += envWind.v;

      typhoonsRef.current.forEach((ty) => {
        if (!ty.active || ty.dissipated) return;
        const dLat = lat - ty.lat;
        const dLon = (lon - ty.lon) * Math.cos((ty.lat * Math.PI) / 180);
        const r_km = Math.sqrt(dLat*dLat + dLon*dLon) * 111.12;
        if (r_km < 1200 && r_km > 2) {
          let v_theta = 0;
          if (r_km <= ty.rmw) {
            v_theta = ty.vmax * (r_km / ty.rmw);
          } else {
            v_theta = ty.vmax * Math.pow(ty.rmw / r_km, 0.45);
          }
          const angle = Math.atan2(dLat, dLon);

          // Translation-induced asymmetry (danger vs navigable semicircle) (Requirement 3)
          const headingRad = ty.direction * Math.PI / 180;
          const relativeAngle = angle - headingRad; // angle of point relative to motion
          const translationAsymmetry = 1.0 + 0.16 * Math.sin(relativeAngle) * Math.min(1.0, ty.speed / 28.0);
          v_theta *= translationAsymmetry;

          const tangU = -Math.sin(angle) * v_theta;
          const tangV = Math.cos(angle) * v_theta;

          let inflowMultiplier = 1.0;
          if (r_km < 160) {
            inflowMultiplier = 1.0 + (160 - r_km) / 50.0;
          }
          const inflowAngle = Math.min(65, 18 * inflowMultiplier) * Math.PI / 180;
          const radialU = -Math.cos(angle) * v_theta * Math.sin(inflowAngle);
          const radialV = -Math.sin(angle) * v_theta * Math.sin(inflowAngle);

          u_env += tangU + radialU;
          v_env += tangV + radialV;
        }
      });

      const finalWindSpeed = Math.sqrt(u_env * u_env + v_env * v_env);
      if (finalWindSpeed > 5.0) {
        // Wind blocking mechanism (Requirement 4): Trace upstream back-trajectory of the wind.
        const scale = 0.65;
        const upLat1 = lat - (v_env / finalWindSpeed) * scale;
        const upLon1 = lon - (u_env / finalWindSpeed) * scale;
        const isUp1Land = getLandMetrics(upLat1, upLon1, configRef.current?.coastlineSource).isLand;
        if (isUp1Land) {
          let decay = 0.76;
          const upLat2 = lat - (v_env / finalWindSpeed) * scale * 2.2;
          const upLon2 = lon - (u_env / finalWindSpeed) * scale * 2.2;
          const isUp2Land = getLandMetrics(upLat2, upLon2, configRef.current?.coastlineSource).isLand;
          if (isUp2Land) {
            decay = 0.60;
          }
          u_env *= decay;
          v_env *= decay;
        }
      }

      return { u: u_env, v: v_env };
    };

     const updateRadarMetricsAt = (lat: number, lon: number) => {
      if (lat >= 0 && lat <= 55 && lon >= 95 && lon <= 180) {
        const sst = getSST(lat, lon, configRef.current);
        const ohc = getOHC(lat, lon, configRef.current);
        const shear = Math.max(2, Math.round(5 + lat * 0.4));
        const isLand = getLandMetrics(lat, lon, configRef.current?.coastlineSource).isLand;
        const wind = getIntegratedWindAtCoord(lat, lon);
        const windSpeed = Math.sqrt(wind.u*wind.u + wind.v*wind.v);
        setRadarMetrics({ lat, lon, sst, ohc, shear, isLand, windSpeed });
      } else {
        setRadarMetrics(null);
      }
    };

    let longPressTimer: NodeJS.Timeout | null = null;

    const startPress = (latlng: L.LatLng) => {
      if (longPressTimer) clearTimeout(longPressTimer);
      longPressTimer = setTimeout(() => {
        setRadarActive(true);
        updateRadarMetricsAt(latlng.lat, latlng.lng);
      }, 500); // 500ms long press threshold
    };

    const cancelPress = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };

    map.on("mousedown", (e: L.LeafletMouseEvent) => {
      if (e.latlng && placementModeRef.current === "none") {
        startPress(e.latlng);
      }
    });

    map.on("mouseup", () => cancelPress());
    map.on("movestart", () => {
      cancelPress();
    });
    map.on("dragstart", () => cancelPress());
    map.on("zoomstart", () => {
      cancelPress();
    });

    map.on("touchstart", (e: L.LeafletMouseEvent) => {
      if (e.latlng && placementModeRef.current === "none") {
        startPress(e.latlng);
      }
    });
    map.on("touchend", () => cancelPress());

    const handleMapMove = () => {
      const center = map.getCenter();
      setCursorCoords({ lat: center.lat, lon: center.lng });
      if (radarActiveRef.current) {
        updateRadarMetricsAt(center.lat, center.lng);
      }
    };
    map.on("move", handleMapMove);
    
    // Set initial center
    setCursorCoords({ lat: map.getCenter().lat, lon: map.getCenter().lng });

    map.on("click", (e: L.LeafletMouseEvent) => {
      if (radarActiveRef.current) {
        setRadarActive(false);
        setRadarMetrics(null);
      } else if (e.latlng && placementModeRef.current !== "none") {
        onMapClickPlacementRef.current(e.latlng.lat, e.latlng.lng);
      }
    });

    map.on("popupclose", () => {
      setOpenStationName(null);
    });

    setMapInitialized(true);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Handle tab focus/visibility change to prevent map canvas clipping & lost typhoon info
  useEffect(() => {
    const handleRestore = () => {
      const map = mapRef.current;
      if (map) {
        requestAnimationFrame(() => {
          map.invalidateSize();
        });
      }
    };

    document.addEventListener("visibilitychange", handleRestore);
    window.addEventListener("focus", handleRestore);
    window.addEventListener("resize", handleRestore);
    window.addEventListener("app-foreground-restored", handleRestore);

    return () => {
      document.removeEventListener("visibilitychange", handleRestore);
      window.removeEventListener("focus", handleRestore);
      window.removeEventListener("resize", handleRestore);
      window.removeEventListener("app-foreground-restored", handleRestore);
    };
  }, []);

  // Sync Placement Mode Cursor style
  useEffect(() => {
    const mapContainer = mapContainerRef.current;
    if (!mapContainer) return;
    if (placementMode !== "none") {
      mapContainer.style.cursor = "crosshair";
    } else {
      mapContainer.style.cursor = "";
    }
  }, [placementMode]);

  // Handle ESC key to cancel placement mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && placementMode !== "none") {
        onDeployTyphoon?.("none");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [placementMode, onDeployTyphoon]);

  // --- 2. Base map Tile Updating ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    let url = "";
    switch (layers.baseMap) {
      case "dark":
        url = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
        break;
      case "satellite":
        url = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
        break;
      case "terrain":
        url = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}";
        break;
      case "light":
        url = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
        break;
      case "googleSatellite":
        url = "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}";
        break;
      case "googleStreet":
        url = "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";
        break;
            case "blueMarble":
        url = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg";
        break;
      case "bingSatellite":
        url = "bing";
        break;
      case "none":
      default:
        break;
    }

    if (url) {
      if (url === "bing") {
        tileLayerRef.current = new (L.TileLayer as any).Bing("", { maxZoom: 18 }).addTo(map);
      } else if (layers.baseMap === "blueMarble") {
        tileLayerRef.current = L.tileLayer(url, {
          maxNativeZoom: 8,
          maxZoom: 18,
          bounds: [[-85.05112878, -180], [85.05112878, 180]],
          errorTileUrl: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          attribution: 'NASA GIBS Blue Marble'
        }).addTo(map);
      } else {
        tileLayerRef.current = L.tileLayer(url, { maxZoom: 18 }).addTo(map);
      }
    } else {
      tileLayerRef.current = null;
    }
  }, [layers.baseMap]);

  // --- 3. Render Land Boundary Polygons (with radar styling) ---
  useEffect(() => {
    const map = mapRef.current;
    const group = landGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    if (layers.coastline || layers.border) {
      if (landGeoJson) {
        L.geoJSON(landGeoJson, {
          style: {
            color: layers.border ? "rgba(30,156,255,0.75)" : "rgba(165,180,200,0.4)",
            weight: layers.border ? 1.5 : 0.8,
            fillColor: "rgba(10,25,47,0.3)",
            fill: layers.coastline,
          },
          interactive: false
        }).addTo(group);
      }
    }
  }, [layers.coastline, layers.border, geoJsonState.landLoaded]);

  // --- 4. Follow Typhoon center ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !config.followMainTyphoon || typhoons.length === 0) return;

    const mainTy = typhoons[0];
    if (mainTy && mainTy.active && !mainTy.dissipated) {
      const currentCenter = map.getCenter();
      const dist = Math.sqrt(Math.pow(currentCenter.lat - mainTy.lat, 2) + Math.pow(currentCenter.lng - mainTy.lon, 2));
      
      // Improve tracking logic: disable animations at high speeds to prevent layer stuttering/offsets
      if (dist > 0.15) {
        const shouldAnimate = speed < 30 && dist < 1.5;
        if (shouldAnimate) {
          map.panTo([mainTy.lat, mainTy.lon], { animate: true, duration: 0.15, easeLinearity: 0.5 });
        } else {
          map.setView([mainTy.lat, mainTy.lon], map.getZoom(), { animate: false });
        }
      }
    }
  }, [typhoons, config.followMainTyphoon]);

  // --- 5. Draw Typhoon Tracks, Center Rings, and Radii ---
  // Throttle map updates during high-speed simulation to prevent DOM/Canvas exhaustion
  const lastMapUpdateTimeRef = useRef<number>(0);
  
  useEffect(() => {
    const map = mapRef.current;
    const pathGroup = pathGroupRef.current;
    const radiiGroup = radiiGroupRef.current;
    if (!map || !pathGroup || !radiiGroup) return;

    // Limit map updates to at most ~10fps during active playback to save CPU/Memory on mobile
    const now = Date.now();
    const isHighSpeed = speed > 20;
    const throttleTime = isHighSpeed ? 100 : 32; // 10fps at high speed, ~30fps otherwise
    
    if (now - lastMapUpdateTimeRef.current < throttleTime) {
      return;
    }
    lastMapUpdateTimeRef.current = now;

    pathGroup.clearLayers();
    radiiGroup.clearLayers();

    typhoons.forEach((ty) => {
      if (!ty.active && !ty.dissipated && ty.history.length === 0) return;

      // Draw historical track path line grouped by category to minimize Leaflet DOM layer count
      if (ty.history.length > 1 && layers.track) {
        let currentGroup: [number, number][] = [[ty.history[0].lat, ty.history[0].lon]];
        let currentCat = ty.history[0].category;
        let currentDiss = ty.history[0].dissipated;

        for (let i = 1; i < ty.history.length; i++) {
          const h = ty.history[i];
          currentGroup.push([h.lat, h.lon]);

          const catChanged = h.category !== currentCat;
          const dissChanged = h.dissipated !== currentDiss;
          const isEnd = i === ty.history.length - 1;

          if (catChanged || dissChanged || isEnd) {
            const col = getCategoryColor(currentCat, config);
            L.polyline(currentGroup, {
              color: col,
              weight: 3.5,
              opacity: 0.9,
              dashArray: currentDiss ? "5, 5" : undefined,
              interactive: false,
              renderer: (map as any)._canvasRenderer
            }).addTo(pathGroup);

            currentCat = h.category;
            currentDiss = h.dissipated;
            currentGroup = [[h.lat, h.lon]];
          }
        }
      }

      // Track nodes (drawn at 3-hour intervals only, plus final point if dissipated)
      if (layers.track) {
        // Optimization: Reduce track node density at high speeds to save memory
        const nodeInterval = speed > 100 ? 12 : (speed > 40 ? 6 : 3);
        
        ty.history.forEach((state, stepIndex) => {
          const isLast = stepIndex === ty.history.length - 1;
          const showDot = state.simHour % nodeInterval === 0 || (isLast && ty.dissipated);
          if (!showDot) return;
          
          const markerColor = (isLast && ty.dissipated) ? "#9ca3af" : getCategoryColor(state.category, config);

          // 1. Transparent hit area circle with 44px touch target (radius = 22px)
          const hitArea = L.circleMarker([state.lat, state.lon], {
            radius: 22,
            color: "transparent",
            weight: 0,
            fillColor: "transparent",
            fillOpacity: 0,
            interactive: true,
            zIndexOffset: 1000,
            renderer: (map as any)._canvasRenderer
          } as any).addTo(pathGroup);

          // 2. Visible circle marker
          L.circleMarker([state.lat, state.lon], {
            radius: 4,
            color: "#FFFFFF",
            weight: 1,
            fillColor: markerColor,
            fillOpacity: 1.0,
            interactive: false,
            zIndexOffset: 100,
            renderer: (map as any)._canvasRenderer
          } as any).addTo(pathGroup);

          // Bind click popup with rich weather metadata details
          const force = getWindForceCategory(state.vmax);
          const popupHtml = `
            <div class="p-3 text-white bg-[#08121f] rounded-xl border border-slate-700/60 font-sans text-xs min-w-[200px] select-none shadow-xl">
              <div class="font-bold border-b border-slate-800 pb-1.5 mb-1.5 text-sm flex justify-between items-center">
                <span>${ty.name} (${state.simHour}h)</span>
                <span style="color: ${markerColor}">${state.category}</span>
              </div>
              <div class="space-y-1 font-mono text-[11px] text-slate-300">
                <div>坐标: <b>${state.lat.toFixed(2)}°N, ${state.lon.toFixed(2)}°E</b></div>
                 <div>风速: <b style="color: #F7FAFF">${state.vmax.toFixed(1)} m/s</b> (${force}级)</div>
                <div>气压: <b style="color: #1E9CFF">${state.pmin} hPa</b></div>
                <div>航向: <b>${state.direction}°</b> | ${state.speed} km/h</div>
                ${state.landed ? '<div class="text-red-400 font-bold">处于登陆状态</div>' : ""}
                ${state.rapidIntensifying ? '<div class="text-yellow-400 font-bold">爆发性增强</div>' : ""}
              </div>
            </div>
          `;
          hitArea.bindPopup(popupHtml, { className: "custom-leaflet-popup" });
          hitArea.on("click", (e: L.LeafletMouseEvent) => {
            if (e.originalEvent) {
              L.DomEvent.stop(e.originalEvent);
            }
            if (onSelectTrackPointRef.current) {
              onSelectTrackPointRef.current(state.simHour);
            }
          });
        });
      }

      // Draw Forecast Uncertainty Cone (Continuous Shaded Corridor & Reference Circles)
      if (layers.forecastCone) {
        let forecastPoints = ty.forecastPath || [];
        if ((!forecastPoints || forecastPoints.length === 0) && !ty.dissipated && ty.vmax > 8.0) {
          forecastPoints = calculateForecastPath(ty, config, 120);
        }
        if (forecastPoints.length > 0) {
          const rawConeTrack = [
            { lat: ty.lat, lon: ty.lon, simHour: 0 },
            ...forecastPoints
          ];
          const allConeTrack = rawConeTrack.filter((_, idx) => idx % 3 === 0 || idx === rawConeTrack.length - 1);
          
            if (allConeTrack.length >= 2) {
              // 1. Draw segment corridor quads & disk fills to ensure zero self-intersection artifacts
              for (let i = 0; i < allConeTrack.length - 1; i++) {
                const pt1 = allConeTrack[i];
                const pt2 = allConeTrack[i + 1];
                if (!pt1 || !pt2) continue;

                const cos1 = Math.max(0.01, Math.cos((pt1.lat * Math.PI) / 180));
                const cos2 = Math.max(0.01, Math.cos((pt2.lat * Math.PI) / 180));
                
                const dLat = pt2.lat - pt1.lat;
                const dLon = (pt2.lon - pt1.lon) * cos1;
                const angle = Math.atan2(dLat, dLon);

                const r1 = (pt1.simHour * 3.1) / 111.12 + 0.45;
                const r2 = (pt2.simHour * 3.1) / 111.12 + 0.45;

                const p1L: [number, number] = [pt1.lat + r1 * Math.sin(angle + Math.PI / 2), pt1.lon + (r1 * Math.cos(angle + Math.PI / 2)) / cos1];
                const p1R: [number, number] = [pt1.lat + r1 * Math.sin(angle - Math.PI / 2), pt1.lon + (r1 * Math.cos(angle - Math.PI / 2)) / cos1];
                const p2L: [number, number] = [pt2.lat + r2 * Math.sin(angle + Math.PI / 2), pt2.lon + (r2 * Math.cos(angle + Math.PI / 2)) / cos2];
                const p2R: [number, number] = [pt2.lat + r2 * Math.sin(angle - Math.PI / 2), pt2.lon + (r2 * Math.cos(angle - Math.PI / 2)) / cos2];

                L.polygon([p1L, p2L, p2R, p1R], {
                  color: "rgba(135, 65, 110, 0.15)",
                  weight: 0,
                  fillColor: "rgba(175, 115, 150, 0.18)",
                  fillOpacity: 1.0,
                  interactive: false,
                  renderer: (map as any)._canvasRenderer
                }).addTo(pathGroup);
              }

              // 2. Draw smooth boundary polylines (Left boundary & Right boundary)
              const leftLine: [number, number][] = [];
              const rightLine: [number, number][] = [];

              for (let i = 0; i < allConeTrack.length; i++) {
                const curr = allConeTrack[i];
                let dLat = 0, dLon = 0;
                if (i < allConeTrack.length - 1) {
                  dLat += allConeTrack[i + 1].lat - curr.lat;
                  dLon += allConeTrack[i + 1].lon - curr.lon;
                }
                if (i > 0) {
                  dLat += curr.lat - allConeTrack[i - 1].lat;
                  dLon += curr.lon - allConeTrack[i - 1].lon;
                }
                const cosLat = Math.max(0.01, Math.cos((curr.lat * Math.PI) / 180));
                const angle = Math.atan2(dLat, dLon * cosLat);
                const r = (curr.simHour * 3.1) / 111.12 + 0.45;

                leftLine.push([curr.lat + r * Math.sin(angle + Math.PI / 2), curr.lon + (r * Math.cos(angle + Math.PI / 2)) / cosLat]);
                rightLine.push([curr.lat + r * Math.sin(angle - Math.PI / 2), curr.lon + (r * Math.cos(angle - Math.PI / 2)) / cosLat]);
              }

              L.polyline(leftLine, {
                color: "rgba(135, 65, 110, 0.65)",
                weight: 1.2,
                dashArray: "3, 5",
                interactive: false,
                renderer: (map as any)._canvasRenderer
              }).addTo(pathGroup);

              L.polyline(rightLine, {
                color: "rgba(135, 65, 110, 0.65)",
                weight: 1.2,
                dashArray: "3, 5",
                interactive: false,
                renderer: (map as any)._canvasRenderer
              }).addTo(pathGroup);
            }

          // Draw discrete circles at 3h forecast intervals
          forecastPoints.forEach((state) => {
            if (state.simHour % 3 !== 0) return;
            if (state && !isNaN(state.lat) && !isNaN(state.lon) && state.simHour > 0) {
              const radiusMeters = ((state.simHour * 3.1) / 111.12 + 0.45) * 111120;
              L.circle([state.lat, state.lon], {
                radius: radiusMeters,
                color: "rgba(135, 65, 110, 0.25)",
                weight: 0.8,
                dashArray: "2, 4",
                fillColor: "rgba(175, 115, 150, 0.02)",
                fillOpacity: 1.0,
                interactive: false,
                renderer: (map as any)._canvasRenderer
              }).addTo(pathGroup);
            }
          });
        }
      }

      // Draw Forecast Track (72h, dashed lines, dots every 3 hours)
      if (layers.forecast) {
        const forecastPoints = ty.forecastPath || [];
        if (forecastPoints.length > 0) {
          // Draw dashed forecast line segments colored by forecasted intensity
          for (let i = 0; i < forecastPoints.length; i++) {
            const ptStart = i === 0 ? { lat: ty.lat, lon: ty.lon, category: ty.category } : forecastPoints[i - 1];
            const ptEnd = forecastPoints[i];
            const col = getCategoryColor(ptEnd.category, config);
            
            L.polyline([[ptStart.lat, ptStart.lon], [ptEnd.lat, ptEnd.lon]], {
              color: col,
              weight: 2.5,
              opacity: 0.85,
              dashArray: "6, 6",
              interactive: false,
              renderer: (map as any)._canvasRenderer
            }).addTo(pathGroup);
          }
          
          // Draw circles for forecast dots every 3 hours
          forecastPoints.forEach((state, idx) => {
            // Skip idx === 0 (0h forecast) because it sits directly at the current typhoon position
            if (idx === 0 || state.simHour % 3 !== 0) return;
            const markerColor = getCategoryColor(state.category, config);
            
            // 1. Transparent hit area circle with 44px touch target (radius = 22px)
            const hitArea = L.circleMarker([state.lat, state.lon], {
              radius: 22,
              color: "transparent",
              weight: 0,
              fillColor: "transparent",
              fillOpacity: 0,
              interactive: true,
              zIndexOffset: 1000,
              renderer: (map as any)._canvasRenderer
            } as any).addTo(pathGroup);

            // 2. Visible circle marker
            L.circleMarker([state.lat, state.lon], {
              radius: 4,
              color: "#FFFFFF",
              weight: 1,
              fillColor: markerColor,
              fillOpacity: 0.85,
              interactive: false,
              zIndexOffset: 100,
              renderer: (map as any)._canvasRenderer
            } as any).addTo(pathGroup);
            
            const currentSimH = ty.history?.length ? ty.history[ty.history.length - 1].simHour : 0;
            const targetAbsHour = currentSimH + state.simHour;
            const force = getWindForceCategory(state.vmax);
            const popupHtml = `
              <div class="p-3 text-white bg-[#08121f] rounded-xl border border-slate-700/60 font-sans text-xs min-w-[200px] select-none shadow-xl">
                <div class="font-bold border-b border-slate-800 pb-1.5 mb-1.5 text-sm flex justify-between items-center">
                  <span>🔮 预报路径 (+${state.simHour}h / ${targetAbsHour}h)</span>
                  <span style="color: ${markerColor}">${state.category}</span>
                </div>
                <div class="space-y-1 font-mono text-[11px] text-slate-300">
                  <div>预计坐标: <b>${state.lat.toFixed(2)}°N, ${state.lon.toFixed(2)}°E</b></div>
                  <div>预计移速: <b style="color: #60a5fa">${state.speed} km/h</b></div>
                  <div>预计风速: <b style="color: #F7FAFF">${state.vmax.toFixed(1)} m/s</b> (${force}级)</div>
                  <div>预计气压: <b style="color: #1E9CFF">${state.pmin} hPa</b></div>
                </div>
              </div>
            `;
            hitArea.bindPopup(popupHtml, { className: "custom-leaflet-popup" });
            hitArea.on("click", (e: L.LeafletMouseEvent) => {
              if (e.originalEvent) {
                L.DomEvent.stop(e.originalEvent);
              }
              if (onSelectTrackPointRef.current) {
                onSelectTrackPointRef.current(targetAbsHour);
              }
            });
          });
        }
      }

      // Draw Center Icon and Asymmetric Wind circles if active
      if (!ty.dissipated) {
        const centerColor = getCategoryColor(ty.category, config);

        if (layers.showCenterPoint !== false) {
          // Real-time center point styled larger than path track nodes
          L.circleMarker([ty.lat, ty.lon], {
            radius: 5.2,
            color: "#FFFFFF",
            weight: 1.5,
            fillColor: centerColor,
            fillOpacity: 1.0,
            zIndexOffset: 5000,
            renderer: (map as any)._canvasRenderer
          } as any).addTo(pathGroup);
        }

        // Draw Asymmetric wind circles (R7, R10, R12)
        if (layers.windRadii) {
          drawAsymmetricRadii(ty, radiiGroup);
        }
      }
    });
  }, [typhoons, layers.track, layers.windRadii]);

  // Function to compute and draw multi-quadrant wind circles on the map
  
  const getStationColor = (wind: number) => {
    if (wind < 10) return "bg-emerald-500 text-white";
    if (wind < 17) return "bg-green-500 text-white";
    if (wind < 24) return "bg-yellow-500 text-slate-900";
    if (wind < 32) return "bg-orange-500 text-white";
    if (wind < 41) return "bg-red-500 text-white";
    if (wind < 51) return "bg-rose-600 text-white";
    return "bg-purple-600 text-white";
  };

  const drawAsymmetricRadii = (ty: Typhoon, group: L.FeatureGroup) => {
    // Hide wind circles after landfall as requested
    if (ty.landed) return;

    // Directly use the current calculated quadrant radii for smooth real-time display
    let displayR7 = ty.r7;
    let displayR10 = ty.r10;
    let displayR12 = ty.r12;

    const levels = [
      { radius: displayR7, color: "#f39c12", name: "七级风圈" },
      { radius: displayR10, color: "#d35400", name: "十级风圈" },
      { radius: displayR12, color: "#c0392b", name: "十二级风圈" }
    ];

    levels.forEach((lvl) => {
      // If quadrant radii are not defined or 0, skip
      if (lvl.radius.ne === 0) return;

      const points: L.LatLng[] = [];

      // NE quadrant: 0 to 90 degrees
      for (let deg = 0; deg <= 90; deg += 3) {
        const angleRad = (deg * Math.PI) / 180;
        const dLat = (lvl.radius.ne * Math.cos(angleRad)) / 111.12;
        const dLon = (lvl.radius.ne * Math.sin(angleRad)) / (111.12 * Math.cos((ty.lat * Math.PI) / 180));
        points.push(L.latLng(ty.lat + dLat, ty.lon + dLon));
      }

      // SE quadrant: 90 to 180 degrees
      for (let deg = 90; deg <= 180; deg += 3) {
        const angleRad = (deg * Math.PI) / 180;
        const dLat = (lvl.radius.se * Math.cos(angleRad)) / 111.12;
        const dLon = (lvl.radius.se * Math.sin(angleRad)) / (111.12 * Math.cos((ty.lat * Math.PI) / 180));
        points.push(L.latLng(ty.lat + dLat, ty.lon + dLon));
      }

      // SW quadrant: 180 to 270 degrees
      for (let deg = 180; deg <= 270; deg += 3) {
        const angleRad = (deg * Math.PI) / 180;
        const dLat = (lvl.radius.sw * Math.cos(angleRad)) / 111.12;
        const dLon = (lvl.radius.sw * Math.sin(angleRad)) / (111.12 * Math.cos((ty.lat * Math.PI) / 180));
        points.push(L.latLng(ty.lat + dLat, ty.lon + dLon));
      }

      // NW quadrant: 270 to 360 degrees
      for (let deg = 270; deg <= 360; deg += 3) {
        const angleRad = (deg * Math.PI) / 180;
        const dLat = (lvl.radius.nw * Math.cos(angleRad)) / 111.12;
        const dLon = (lvl.radius.nw * Math.sin(angleRad)) / (111.12 * Math.cos((ty.lat * Math.PI) / 180));
        points.push(L.latLng(ty.lat + dLat, ty.lon + dLon));
      }

      // Draw asymmetric polygon
      L.polygon(points, {
        color: lvl.color,
        weight: 1.5,
        opacity: 0.85,
        fillColor: lvl.color,
        fillOpacity: 0.11,
        interactive: false,
        className: "leaflet-wind-radii-circle",
        renderer: (mapRef.current as any)._canvasRenderer
      }).addTo(group);
    });
  };

  const lastStationUpdateRef = useRef<number>(0);

  // --- Weather Stations ---
  useEffect(() => {
    const group = stationsGroupRef.current;
    if (!group) return;

    if (!layers.weatherStations) {
      group.clearLayers();
      return;
    }

    const now = Date.now();
    if (now - lastStationUpdateRef.current < 200) {
      return;
    }
    lastStationUpdateRef.current = now;

    group.clearLayers();

    const mainTy = typhoons[0];

    WEATHER_STATIONS_DATA.forEach(station => {
      let windSpeed = 0;
      let pressure = 1013;
      
      if (mainTy && mainTy.active) {
         // Calculate real-time dynamic readings based on current exact typhoon location on every frame
         const R = 6371;
         const dLatRad = (station.lat - mainTy.lat) * (Math.PI / 180);
         const dLonRad = (station.lon - mainTy.lon) * (Math.PI / 180);
         const a = Math.sin(dLatRad / 2) * Math.sin(dLatRad / 2) +
                   Math.cos(mainTy.lat * (Math.PI / 180)) * Math.cos(station.lat * (Math.PI / 180)) *
                   Math.sin(dLonRad / 2) * Math.sin(dLonRad / 2);
         const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
         const dist = R * c;

         const dLat = station.lat - mainTy.lat;
         const dLon = (station.lon - mainTy.lon) * Math.cos((mainTy.lat * Math.PI) / 180);

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

         const r7 = mainTy.r7;
         const r10 = mainTy.r10;
         const r12 = mainTy.r12;
         const vmax = mainTy.vmax;
         const rmw = mainTy.rmw;

         const qR7 = (r7 && r7[quad] > 0) ? r7[quad] : Math.max(100, vmax * 4);
         const qR10 = (r10 && r10[quad] > 0) ? r10[quad] : (vmax >= 24.5 ? Math.max(50, qR7 * 0.6) : 0);
         const qR12 = (r12 && r12[quad] > 0) ? r12[quad] : (vmax >= 32.7 ? Math.max(30, qR7 * 0.4) : 0);

         // Center low wind zone diameter 24-50km (radius R_center 12-25km)
         const R_center = Math.max(12.0, Math.min(25.0, rmw * 0.65));

         let isMainlandStation = false;
         if (station.lat > 18 && station.lat < 45 && station.lon > 105 && station.lon < 123) {
           const isTaiwan = station.lat >= 21.5 && station.lat <= 25.5 && station.lon >= 119.5 && station.lon <= 122.5;
           const isHainan = station.lat >= 18 && station.lat <= 20.5 && station.lon >= 108.5 && station.lon <= 111.5;
           if (!isTaiwan && !isHainan) {
             isMainlandStation = true;
           }
         }

         let centerRatio = 0.98;
         if (vmax >= 32.7) {
           centerRatio = Math.max(0.08, 0.22 - 0.14 * Math.min(1.0, (vmax - 32.7) / 30.0));
         } else if (vmax >= 17.2) {
           const f = (vmax - 17.2) / 15.5;
           centerRatio = 0.85 - 0.50 * f;
         } else {
           centerRatio = 0.95;
         }

         const onLandList = ["厦门", "温州", "福州", "汕头", "台州", "宁波", "上海", "深圳", "广州", "海口", "湛江", "阳江", "茂名", "防城港", "北海", "钦州", "南宁", "桂林", "长沙", "南昌", "杭州", "合肥", "南京", "武汉"];
         const isStationOnLandMap = onLandList.includes(station.name);

         if (isMainlandStation && isStationOnLandMap) {
           centerRatio = Math.min(0.85, centerRatio + 0.15);
         }

         const V_center = vmax * centerRatio;

         if (dist <= rmw) {
           if (dist <= R_center) {
             windSpeed = V_center;
           } else {
             const ratio = (dist - R_center) / Math.max(1, rmw - R_center);
             const steepness = vmax >= 41.5 ? 2.0 : (1.0 + 0.9 * (vmax / 41.5));
             windSpeed = V_center + (vmax - V_center) * Math.pow(ratio, steepness);
           }
         } else if (qR12 > 0 && dist <= qR12) {
           const ratio = (dist - rmw) / Math.max(1, qR12 - rmw);
           windSpeed = vmax - (vmax - 32.7) * ratio;
         } else if (qR10 > 0 && dist <= qR10) {
           const startWind = qR12 > 0 ? 32.7 : vmax;
           const startDist = qR12 > 0 ? qR12 : rmw;
           const ratio = (dist - startDist) / Math.max(1, qR10 - startDist);
           windSpeed = startWind - (startWind - 24.5) * ratio;
         } else if (qR7 > 0 && dist <= qR7) {
           const startWind = qR10 > 0 ? 24.5 : (qR12 > 0 ? 32.7 : vmax);
           const startDist = qR10 > 0 ? qR10 : (qR12 > 0 ? qR12 : rmw);
           const ratio = (dist - startDist) / Math.max(1, qR7 - startDist);
           windSpeed = startWind - (startWind - 13.9) * ratio;
         } else {
           const startWind = qR7 > 0 ? 13.9 : (qR10 > 0 ? 24.5 : (qR12 > 0 ? 32.7 : vmax));
           const startDist = qR7 > 0 ? qR7 : (qR10 > 0 ? qR10 : (qR12 > 0 ? qR12 : rmw));
           windSpeed = startWind * Math.exp(-(dist - startDist) / 150.0);
         }

         windSpeed = Math.max(0, Math.min(vmax, windSpeed));

         const frictionFactor = Math.max(0.70, 0.90 - (windSpeed / 100.0) * 0.15 - (dist / Math.max(1, qR7)) * 0.05);
         windSpeed *= frictionFactor;

         const windRatio = vmax > 0 ? Math.min(1.0, windSpeed / vmax) : 0;
         pressure = 1013 - Math.pow(windRatio, 2) * (1013 - mainTy.pmin);
         if (dist <= rmw) {
           const ratio = dist / Math.max(1, rmw);
           pressure = mainTy.pmin + (1013 - mainTy.pmin) * 0.08 * ratio;
         }
         pressure = Math.max(mainTy.pmin, Math.min(1013, pressure));

         windSpeed = Number(windSpeed.toFixed(1));
         pressure = Math.round(pressure);
      } else {
         const reading = mainTy?.stationReadings?.find(r => r.name === station.name);
         if (reading) {
           windSpeed = reading.windSpeed;
           pressure = reading.pressure;
         } else if (mainTy) {
           const R = 6371;
           const dLat = (station.lat - mainTy.lat) * (Math.PI / 180);
           const dLon = (station.lon - mainTy.lon) * (Math.PI / 180);
           const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                     Math.cos(mainTy.lat * (Math.PI / 180)) * Math.cos(station.lat * (Math.PI / 180)) *
                     Math.sin(dLon / 2) * Math.sin(dLon / 2);
           const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
           const dist = R * c;
           
           if (dist > 0) {
             if (mainTy.vmax > 48.0 && dist < mainTy.rmw) {
               windSpeed = mainTy.vmax * (0.15 + 0.85 * (dist / mainTy.rmw));
             } else {
               windSpeed = Math.max(0, Math.min(mainTy.vmax, (mainTy.vmax * mainTy.rmw) / dist));
             }
           } else {
             windSpeed = mainTy.vmax > 48.0 ? mainTy.vmax * 0.15 : mainTy.vmax;
           }
           pressure = Math.min(1013, mainTy.pmin + (1013 - mainTy.pmin) * Math.min(1, dist / 800));
         }
      }
      
      const force = getWindForceCategory(windSpeed);
      const sizeScale = (config.capsuleSize ?? 100) / 100;
      
      const width = 42 * sizeScale;
      const height = 18 * sizeScale;
      const fontSize = 10 * sizeScale;
      const borderRadius = 9 * sizeScale;
      
      const iconHtml = `
        <div onclick="if(window.showStationHistory) window.showStationHistory('${station.name}', ${station.lat}, ${station.lon})" class="flex flex-col items-center justify-center transform -translate-x-1/2 -translate-y-1/2 cursor-pointer select-none">
          <div class="flex items-center justify-center transition-all shadow-md border border-white/40 font-mono font-bold text-white whitespace-nowrap overflow-hidden" 
               style="
                 background-color: ${getStationGradientColor(windSpeed)}; 
                 width: ${width}px; 
                 height: ${height}px; 
                 border-radius: ${borderRadius}px;
                 font-size: ${fontSize}px;
               ">
              ${windSpeed.toFixed(1)}
          </div>
        </div>
      `;

      const marker = L.marker([station.lat, station.lon], {
        icon: L.divIcon({ html: iconHtml, className: "", iconSize: [0,0] })
      });

      marker.on("click", (e: L.LeafletMouseEvent) => {
        if (e.originalEvent) {
          L.DomEvent.stop(e.originalEvent);
        }
        setActiveHistoryStation({ id: station.name, name: station.name, lat: station.lat, lon: station.lon });
      });

      marker.on("popupopen", () => {
        setOpenStationName(station.name);
      });
      
      marker.bindPopup(`
        <div class="p-3 text-white bg-[#08121f]/95 rounded-xl border border-slate-700/60 font-sans text-xs min-w-[160px] shadow-2xl">
          <div class="font-bold border-b border-slate-800 pb-1.5 mb-1.5 text-sm text-[#1E9CFF]">
            ${station.name}气象站
          </div>
          <div class="space-y-1 font-mono text-[11px] text-slate-300">
            <div>实时风速: <b class="text-white">${windSpeed.toFixed(1)} m/s</b> (${force}级)</div>
            <div>实时气压: <b class="text-[#1E9CFF]">${pressure.toFixed(1)} hPa</b></div>
          </div>
          <div class="mt-2.5 pt-2 border-t border-slate-800/60 flex justify-end">
            <button onclick="window.showStationHistory('${station.name}', ${station.lat}, ${station.lon})" class="px-2.5 py-1 text-[10px] font-semibold bg-[#1E9CFF] hover:bg-[#1E9CFF]/80 text-white rounded transition-all cursor-pointer shadow-md">
              更多
            </button>
          </div>
        </div>
      `, { className: "custom-leaflet-popup" });
      
      marker.addTo(group);
    });
  }, [layers.weatherStations, typhoons, openStationName, config.capsuleSize]);

  // --- 7. Canvas Animation Loop (SST/OHC) ---
  useEffect(() => {
    if (!mapInitialized) return;

    const canvas = canvasRef.current;
    const map = mapRef.current;
    if (!canvas || !map) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drawLoop = () => {
      if (!canvas || !map || !ctx) return;

      const activeLayers = layersRef.current;
      const activeZoom = mapZoomRef.current;

    // Sync canvas dimensions with sub-pixel safety
    const size = map.getSize();
    const roundedX = Math.round(size.x);
    const roundedY = Math.round(size.y);
    if (canvas.width !== roundedX || canvas.height !== roundedY) {
      canvas.width = roundedX;
      canvas.height = roundedY;
    }

      // A. Clear background with fade trail (to create movement streaks)
      // If we are overlaying SST or OHC, we don't want trail smear, we draw solid and then draw transparent particles
      const hasRaster = activeLayers.sst || activeLayers.ohc || activeLayers.shear || activeLayers.strongDryAir || activeLayers.strongWindShear;
      if (hasRaster) {
        ctx.globalCompositeOperation = "source-over";
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawRasterData(ctx, map);
      } else {
        // Use destination-out to fade existing drawings on the canvas while keeping the background transparent!
        // This ensures base maps (such as satellite/terrain) and Leaflet overlays (coastline/tracks/wind circles) are fully visible underneath.
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = "rgba(0, 0, 0, 0.22)"; // fade rate
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = "source-over";
      }

      // B. Draw Subtropical High / Westerlies annotations if toggled
      if (activeLayers.subHigh) drawSubtropicalRidge(ctx, map);
      if (activeLayers.westerlies) drawWesterliesRidge(ctx, map);



      // Draw Coordinates grid directly on canvas if enabled
      if ((activeLayers as any).grid) drawGridGrid(ctx, map);

      animationFrameRef.current = requestAnimationFrame(drawLoop);
    };

    animationFrameRef.current = requestAnimationFrame(drawLoop);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [mapInitialized]);



  // --- 8. Render Raster Data (SST / OHC / Radar / Clouds / Precipitation Grid overlay) ---

  const drawRasterData = (ctx: CanvasRenderingContext2D, map: L.Map) => {
    const size = map.getSize();
    const activeLayers = layersRef.current;
    const activeConfig = configRef.current;

    const nw = map.containerPointToLatLng([0, 0]);
    const se = map.containerPointToLatLng([size.x, size.y]);

    // Build unique cache key to avoid recalculating thousands of grid blocks every frame
    const layerFlags = `${activeLayers.sst ? 1 : 0}_${activeLayers.ohc ? 1 : 0}_${activeLayers.shear ? 1 : 0}_${activeLayers.strongDryAir ? 1 : 0}_${activeLayers.strongWindShear ? 1 : 0}_${activeLayers.rasterResolution || 8}`;
    const cacheKey = `${size.x}_${size.y}_${nw.lat.toFixed(3)}_${nw.lng.toFixed(3)}_${se.lat.toFixed(3)}_${se.lng.toFixed(3)}_${layerFlags}_${activeConfig?.coastlineSource || 'default'}`;

    if (!rasterCanvasRef.current) {
      rasterCanvasRef.current = document.createElement("canvas");
    }
    const rasterCanvas = rasterCanvasRef.current;

    if (rasterCanvas.width !== Math.round(size.x) || rasterCanvas.height !== Math.round(size.y)) {
      rasterCanvas.width = Math.round(size.x);
      rasterCanvas.height = Math.round(size.y);
      rasterCacheKeyRef.current = ""; // Invalidate cache on resize
    }

    if (rasterCacheKeyRef.current !== cacheKey) {
      const offCtx = rasterCanvas.getContext("2d");
      if (offCtx) {
        offCtx.clearRect(0, 0, rasterCanvas.width, rasterCanvas.height);
        const gridSpacing = Math.max(8, activeLayers.rasterResolution || 8);
        offCtx.globalAlpha = 0.5;

        const latSpan = se.lat - nw.lat;
        const lonSpan = se.lng - nw.lng;

        for (let x = 0; x < size.x; x += gridSpacing) {
          const lon = nw.lng + ((x + gridSpacing / 2) / size.x) * lonSpan;
          if (lon < 95 || lon > 180) continue;

          for (let y = 0; y < size.y; y += gridSpacing) {
            const lat = nw.lat + ((y + gridSpacing / 2) / size.y) * latSpan;
            if (lat < 0 || lat > 55) continue;

            const isLand = getLandMetrics(lat, lon, activeConfig?.coastlineSource).isLand;

            if (activeLayers.strongDryAir) {
              const rhVal = getRH700(lat, lon, activeConfig);
              if (rhVal < 50) {
                if (rhVal < 30) offCtx.fillStyle = "rgba(217, 119, 6, 0.65)";
                else if (rhVal < 40) offCtx.fillStyle = "rgba(234, 179, 8, 0.55)";
                else offCtx.fillStyle = "rgba(250, 204, 21, 0.38)";
                offCtx.fillRect(x, y, gridSpacing, gridSpacing);
                if (gridSpacing >= 12 && rhVal < 40) {
                  offCtx.fillStyle = "rgba(255, 255, 255, 0.75)";
                  offCtx.font = "8px sans-serif";
                  offCtx.fillText(`${Math.round(rhVal)}%`, x + 2, y + 8);
                }
              }
            } else if (activeLayers.strongWindShear) {
              const shearVal = getShear(lat, lon, activeConfig);
              if (shearVal > 18) {
                if (shearVal >= 32) offCtx.fillStyle = "rgba(225, 29, 72, 0.7)";
                else if (shearVal >= 25) offCtx.fillStyle = "rgba(239, 68, 68, 0.55)";
                else offCtx.fillStyle = "rgba(249, 115, 22, 0.42)";
                offCtx.fillRect(x, y, gridSpacing, gridSpacing);
                if (gridSpacing >= 12) {
                  offCtx.fillStyle = "rgba(255, 255, 255, 0.8)";
                  offCtx.font = "8px sans-serif";
                  offCtx.fillText(`${Math.round(shearVal)}kt`, x + 2, y + 8);
                }
              }
            } else if (activeLayers.shear) {
              const shearVal = getShear(lat, lon, activeConfig);
              if (shearVal < 10) offCtx.fillStyle = "rgba(43, 156, 91, 0.4)";
              else if (shearVal < 20) offCtx.fillStyle = "rgba(246, 211, 74, 0.4)";
              else if (shearVal < 30) offCtx.fillStyle = "rgba(246, 120, 74, 0.5)";
              else offCtx.fillStyle = "rgba(200, 40, 40, 0.6)";
              offCtx.fillRect(x, y, gridSpacing, gridSpacing);
              if (gridSpacing >= 10) {
                 offCtx.fillStyle = "rgba(255, 255, 255, 0.5)";
                 offCtx.font = "8px sans-serif";
                 offCtx.fillText(Math.round(shearVal).toString(), x + 2, y + 8);
              }
            } else if (activeLayers.sst) {
              if (isLand) continue;
              const sst = getSST(lat, lon, activeConfig);
              offCtx.fillStyle = getSSTColor(sst);
              offCtx.fillRect(x, y, gridSpacing, gridSpacing);
            } else if (activeLayers.ohc) {
              if (isLand) continue;
              const ohc = getOHC(lat, lon, activeConfig);
              if (ohc > 5) {
                offCtx.fillStyle = getOHCColor(ohc);
                offCtx.fillRect(x, y, gridSpacing, gridSpacing);
              }
            }
          }
        }
        offCtx.globalAlpha = 1.0;
        rasterCacheKeyRef.current = cacheKey;
      }
    }

    ctx.drawImage(rasterCanvas, 0, 0);
  };

  const getRadarColor = (dbz: number): string => {
    if (dbz < 12) return "transparent";
    if (dbz < 22) return "rgba(0, 160, 255, 0.25)";  // light blue drizzle
    if (dbz < 30) return "rgba(0, 200, 80, 0.4)";    // green rain
    if (dbz < 38) return "rgba(230, 220, 0, 0.55)";   // yellow heavy rain
    if (dbz < 46) return "rgba(255, 140, 0, 0.7)";    // orange thunderstorm
    if (dbz < 52) return "rgba(255, 0, 0, 0.8)";      // red torrential downpour
    if (dbz < 58) return "rgba(255, 0, 180, 0.9)";    // purple core
    return "rgba(140, 0, 220, 0.95)";                 // violent hail/microburst
  };

  const getCloudColor = (density: number): string => {
    if (density < 0.1) return "transparent";
    if (density < 0.35) {
      const alpha = (density - 0.1) / 0.25;
      return `rgba(220, 225, 235, ${alpha * 0.25})`;
    }
    if (density < 0.65) {
      const alpha = (density - 0.35) / 0.3;
      return `rgba(240, 245, 255, ${0.25 + alpha * 0.4})`;
    }
    if (density < 0.8) {
      const alpha = (density - 0.65) / 0.15;
      return `rgba(255, 255, 255, ${0.65 + alpha * 0.25})`;
    }
    if (density < 0.92) {
      return "rgba(0, 230, 220, 0.8)"; // Cyan IR clouds
    }
    return "rgba(230, 0, 180, 0.9)"; // Cold pink deep towers
  };

  const getPrecipitationColor = (rate: number): string => {
    if (rate < 0.5) return "transparent";
    if (rate < 2.0) return "rgba(50, 150, 255, 0.35)";    // Light rain
    if (rate < 8.0) return "rgba(0, 100, 230, 0.5)";     // Moderate rain
    if (rate < 20.0) return "rgba(60, 220, 100, 0.65)";   // Heavy rain
    if (rate < 40.0) return "rgba(240, 220, 0, 0.78)";    // Violent rain
    if (rate < 70.0) return "rgba(255, 70, 0, 0.85)";     // Torrential rain
    return "rgba(200, 0, 180, 0.95)";                    // Extreme rain
  };

  const getSSTColor = (sst: number): string => {
    if (sst < 20) return "rgba(43, 91, 156, 0.35)";
    if (sst < 26) return "rgba(30, 156, 255, 0.45)";
    if (sst < 28) return "rgba(69, 212, 131, 0.55)"; // 26-28 ideal for typhoons
    if (sst < 30) return "rgba(246, 211, 74, 0.65)"; // warm pool
    return "rgba(255, 77, 79, 0.75)"; // deep tropics heat
  };

  const getOHCColor = (ohc: number): string => {
    if (ohc < 30) return "rgba(30, 156, 255, 0.25)";
    if (ohc < 60) return "rgba(69, 212, 131, 0.45)";
    if (ohc < 100) return "rgba(255, 140, 58, 0.6)";
    return "rgba(255, 77, 79, 0.75)";
  };

  const getPrecipAccumColor = (precip: number): string => {
    if (precip < 10) return "transparent";
    if (precip < 50) return "rgba(56, 189, 248, 0.8)";
    if (precip < 100) return "rgba(59, 130, 246, 0.85)";
    if (precip < 250) return "rgba(234, 179, 8, 0.9)";
    if (precip < 400) return "rgba(239, 68, 68, 0.9)";
    return "rgba(168, 85, 247, 0.95)";
  };

  const getMaxWindColor = (wind: number): string => {
    if (wind < 12) return "transparent";
    if (wind < 17.2) return "rgba(16, 185, 129, 0.8)";
    if (wind < 24.4) return "rgba(56, 189, 248, 0.8)";
    if (wind < 32.7) return "rgba(234, 179, 8, 0.85)";
    if (wind < 41.5) return "rgba(249, 115, 22, 0.9)";
    if (wind < 51.0) return "rgba(239, 68, 68, 0.9)";
    return "rgba(168, 85, 247, 0.95)";
  };

  const getStationGradientColor = (windSpeed: number): string => {
    if (windSpeed < 10) return "#10B981"; // green
    if (windSpeed < 17.2) return "#3B82F6"; // blue
    if (windSpeed < 24.5) return "#EAB308"; // yellow
    if (windSpeed < 32.7) return "#F97316"; // orange
    if (windSpeed < 41.5) return "#EF4444"; // red
    return "#A855F7"; // purple (super typhoon)
  };

  const getAccumulatedPrecipAt = (lat: number, lon: number): number => {
    const mainTy = typhoons[0];
    if (!mainTy || !mainTy.history) return 0;
    const isLand = getLandMetrics(lat, lon, configRef.current?.coastlineSource).isLand;
    let accumulatedPrecip = 0;
    mainTy.history.forEach((h) => {
      const dLatKm = (lat - h.lat) * 111.12;
      const dLonKm = (lon - h.lon) * 111.12 * Math.cos((h.lat * Math.PI) / 180);
      const dist = Math.sqrt(dLatKm * dLatKm + dLonKm * dLonKm);
      if (dist > 600) return;

      const R_eye = h.rmw || 16;
      const R_eyewall = R_eye * 1.25;
      const inEyewall = Math.max(0, 1.0 - Math.abs(dist - R_eyewall) / (R_eyewall * 0.5));
      const envelope = Math.exp(-dist / (h.vmax * 4.0 + 50));
      
      const baseInt = Math.min(1.0, h.vmax / 52.0);
      let precRate = baseInt * (inEyewall * 25.0 + envelope * 12.0) * 5.0;
      if (h.vmax > 48.0 && dist < R_eye) {
        precRate *= 0.1 + 0.9 * Math.pow(dist / R_eye, 2);
      }
      if (isLand) {
        precRate *= 1.3;
      }
      accumulatedPrecip += precRate * 0.1;
    });
    return accumulatedPrecip;
  };

  const getMaxWindAccumulatedAt = (lat: number, lon: number): number => {
    const mainTy = typhoons[0];
    if (!mainTy || !mainTy.history) return 0;
    let maxWind = 0;
    mainTy.history.forEach((h) => {
      const dLatKm = (lat - h.lat) * 111.12;
      const dLonKm = (lon - h.lon) * 111.12 * Math.cos((h.lat * Math.PI) / 180);
      const dist = Math.sqrt(dLatKm * dLatKm + dLonKm * dLonKm);
      if (dist > 800) return;

      const rmw = h.rmw || 35;
      let wind = 0;
      if (dist <= rmw) {
        wind = h.vmax * (dist / rmw);
      } else {
        wind = h.vmax * Math.exp(-(dist - rmw) / (h.vmax * 3.5 + 80));
      }
      if (wind > maxWind) maxWind = wind;
    });
    return maxWind;
  };

  // --- 9. Drawing Subtropical Ridge 5880 gpm Contour ---
  const drawSubtropicalRidge = (ctx: CanvasRenderingContext2D, map: L.Map) => {
    const activeConfig = configRef.current;
    // We draw an analytical elliptical glowing ring around the Subtropical High parameters
    if (!activeConfig.subtropicalHighEnabled) return;

    // Convert center coordinate to screen
    const centerPt = map.latLngToContainerPoint([activeConfig.subtropicalHighLat, activeConfig.subtropicalHighLon]);
    const westPt = map.latLngToContainerPoint([activeConfig.subtropicalHighLat, activeConfig.subtropicalHighWestExtent]);

    // Draw a pill shape indicating ridge high pressure
    ctx.strokeStyle = "rgba(30, 156, 255, 0.75)";
    ctx.fillStyle = "rgba(30, 156, 255, 0.06)";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 6]);

    const radiusY = Math.abs(map.latLngToContainerPoint([activeConfig.subtropicalHighLat + 3.5, activeConfig.subtropicalHighLon]).y - centerPt.y);
    const radiusX = Math.abs(centerPt.x - westPt.x) + radiusY * 1.5;

    ctx.beginPath();
    ctx.ellipse(
      (centerPt.x + westPt.x) / 2,
      centerPt.y,
      radiusX,
      radiusY,
      0,
      0,
      2 * Math.PI
    );
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]); // reset

    // Label
    ctx.fillStyle = "#1E9CFF";
    ctx.font = "bold 10px font-mono";
    ctx.fillText("5880 gpm (副热带高压脊)", westPt.x - 20, centerPt.y - radiusY - 8);
  };

  // --- 10. Drawing Westerlies Jet arrow ribbon ---
  const drawWesterliesRidge = (ctx: CanvasRenderingContext2D, map: L.Map) => {
    const activeConfig = configRef.current;
    if (!activeConfig.westerliesEnabled) return;

    // Draw flowing broad translucent arrow vectors at westerliesLat across the map
    const wLat = activeConfig.westerliesLat;
    const pt1 = map.latLngToContainerPoint([wLat, 95]);
    const pt2 = map.latLngToContainerPoint([wLat, 180]);

    ctx.fillStyle = "rgba(255, 255, 255, 0.02)";
    ctx.fillRect(0, pt1.y - 30, canvasRef.current?.width || 1200, 60);

    ctx.strokeStyle = "rgba(255, 140, 58, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 8]);
    ctx.beginPath();
    ctx.moveTo(0, pt1.y);
    ctx.lineTo(canvasRef.current?.width || 1200, pt1.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw 3 wave arrowheads across the width
    ctx.fillStyle = "rgba(255, 140, 58, 0.5)";
    ctx.font = "italic 9px font-sans";
    const segmentWidth = (canvasRef.current?.width || 1000) / 4;
    for (let i = 1; i <= 3; i++) {
      const x = i * segmentWidth;
      ctx.beginPath();
      ctx.moveTo(x, pt1.y);
      ctx.lineTo(x - 12, pt1.y - 6);
      ctx.lineTo(x - 12, pt1.y + 6);
      ctx.fill();

      ctx.fillText("西风急流轴 (Westerlies Jet)", x - 80, pt1.y - 12);
    }
  };

  // --- 12. Draw Map Lat/Lon Coordinates Grid overlay ---
  const drawGridGrid = (ctx: CanvasRenderingContext2D, map: L.Map) => {
    // Draws lines every 10 degrees
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 0.8;
    ctx.font = "9px font-mono";
    ctx.fillStyle = "rgba(155, 171, 189, 0.45)";

    const step = 10;
    // Latitudes: 0 to 50
    for (let lat = 0; lat <= 50; lat += step) {
      const pLeft = map.latLngToContainerPoint([lat, 95]);
      ctx.beginPath();
      ctx.moveTo(0, pLeft.y);
      ctx.lineTo(canvasRef.current?.width || 1200, pLeft.y);
      ctx.stroke();
      ctx.fillText(`${lat}°N`, 10, pLeft.y - 4);
    }

    // Longitudes: 100 to 180
    for (let lon = 100; lon <= 180; lon += step) {
      const pBottom = map.latLngToContainerPoint([0, lon]);
      ctx.beginPath();
      ctx.moveTo(pBottom.x, 0);
      ctx.lineTo(pBottom.x, canvasRef.current?.height || 800);
      ctx.stroke();
      ctx.fillText(`${lon}°E`, pBottom.x + 4, (canvasRef.current?.height || 750) - 10);
    }
  };

  let cursorWind = 0;
  let cursorPressure = 1013;
  let cursorPrecipAccum = 0;
  let cursorMaxWindAccum = 0;
  
  if (layers.cursor && cursorCoords) {
    if (typhoons[0]?.active) {
      const mainTy = typhoons[0];
      const R = 6371;
      const dLat = (cursorCoords.lat - mainTy.lat) * (Math.PI / 180);
      const dLon = (cursorCoords.lon - mainTy.lon) * (Math.PI / 180);
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(mainTy.lat * (Math.PI / 180)) * Math.cos(cursorCoords.lat * (Math.PI / 180)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const dist = R * c;
      
      if (dist > 0) {
        if (mainTy.vmax > 48.0 && dist < mainTy.rmw) {
          cursorWind = mainTy.vmax * (0.15 + 0.85 * (dist / mainTy.rmw));
        } else {
          cursorWind = Math.max(0, Math.min(mainTy.vmax, (mainTy.vmax * mainTy.rmw) / dist));
        }
      } else {
        cursorWind = mainTy.vmax > 48.0 ? mainTy.vmax * 0.15 : mainTy.vmax;
      }
      cursorPressure = Math.min(1013, mainTy.pmin + (1013 - mainTy.pmin) * Math.min(1, dist / 800));
    }
    cursorPrecipAccum = getAccumulatedPrecipAt(cursorCoords.lat, cursorCoords.lon);
    cursorMaxWindAccum = getMaxWindAccumulatedAt(cursorCoords.lat, cursorCoords.lon);
  }

  const getCursorPrimaryText = () => {
    return `风速: ${cursorWind.toFixed(1)} m/s`;
  };

  useEffect(() => {
    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    };
    window.addEventListener("resize", handleResize);
    // Also invalidate after short delay to ensure DOM has settled
    const timer = setTimeout(handleResize, 100);
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timer);
    };
  }, [mapInitialized]);

  return (
    <div className="relative w-full h-full select-none" id="typhoon-gis-viewport">
      {/* 1. Fullscreen Leaflet container */}
      <div ref={mapContainerRef} className={`absolute inset-0 z-0 transition-colors duration-300 ${layers.baseMap === "none" ? "bg-white [&_.leaflet-container]:!bg-white" : "bg-[#07111F]"}`} />

      {/* 2. Top-level synced Canvas for fluid particle rendering */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-[1] pointer-events-none"
      />



      {/* 4. Centered crosshair radar indicator */}
      {radarActive && radarMetrics && (
        <div className="absolute inset-0 z-[1000] pointer-events-none flex items-center justify-center">
          {/* Main crosshair */}
          <div className="relative flex items-center justify-center">
            {/* Horizontal crosshair line */}
            <div className="absolute w-24 h-[1px] bg-sky-400/80 shadow-[0_0_8px_rgba(30,156,255,0.8)]" />
            {/* Vertical crosshair line */}
            <div className="absolute h-24 w-[1px] bg-sky-400/80 shadow-[0_0_8px_rgba(30,156,255,0.8)]" />
            {/* Center rings */}
            <div className="absolute w-8 h-8 rounded-full border border-sky-400/50 animate-pulse" />
            <div className="absolute w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_4px_#1E9CFF]" />

            {/* Radar parameters HUD overlay next to crosshair */}
            <div className="absolute left-8 -top-24 bg-[#08121f]/95 border border-sky-400/50 p-3 rounded-xl shadow-2xl backdrop-blur-md text-xs font-mono text-slate-300 min-w-[215px] flex flex-col gap-1.5 select-none animate-[fadeIn_0.2s_ease-out]">
              <div className="flex justify-between items-center text-[#1E9CFF] font-semibold border-b border-sky-400/20 pb-1.5 mb-1">
                <span className="flex items-center gap-1">环流中心雷达检测</span>
                <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-[10px] text-sky-300">{radarMetrics.isLand ? "陆地" : "海洋"}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">经纬度:</span>
                <span className="text-slate-100 font-medium">{radarMetrics.lat.toFixed(2)}°N, {radarMetrics.lon.toFixed(2)}°E</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">海表温度 (SST):</span>
                <span className="text-teal-400 font-bold">{radarMetrics.sst.toFixed(1)} ℃</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">海洋热含量 (OHC):</span>
                <span className="text-orange-400 font-medium">{Math.round(radarMetrics.ohc)} kJ/cm²</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">环境风切 (Shear):</span>
                <span className="text-rose-400 font-medium">{radarMetrics.shear} kts</span>
              </div>
              <div className="flex justify-between text-[11px] border-t border-slate-800/60 pt-1.5 mt-0.5">
                <span className="text-slate-400 font-semibold">综合风力:</span>
                <span className="text-blue-400 font-bold">{radarMetrics.windSpeed.toFixed(1)} m/s (约 {getWindForceCategory(radarMetrics.windSpeed)} 级)</span>
              </div>
              <div className="text-[9px] text-[#1E9CFF]/60 text-right mt-1">
                点击地图任意处关闭雷达
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cursor Layer */}
      {layers.cursor && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none">
          {/* Crosshair */}
          <div className="relative flex items-center justify-center">
            <div className="absolute w-6 h-[1px] bg-white mix-blend-difference"></div>
            <div className="absolute h-6 w-[1px] bg-white mix-blend-difference"></div>
            
            {/* Data Capsule */}
            <div className="absolute bottom-6 pointer-events-auto cursor-pointer" onClick={() => setCursorExpanded(!cursorExpanded)}>
              <div className="px-3 py-1 bg-black/80 backdrop-blur-sm rounded-full border border-slate-600 shadow-xl whitespace-nowrap flex items-center gap-2 hover:bg-black/90 transition-colors">
                <span className="text-[10px] font-bold text-white">
                  {getCursorPrimaryText()}
                </span>
                {!cursorExpanded && <span className="text-[8px] text-slate-500">点击展开</span>}
              </div>
              
              {/* Expanded Data Panel */}
              {cursorExpanded && (
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-[#08121f]/95 border border-slate-700/60 p-2.5 rounded-lg shadow-2xl backdrop-blur-md text-[11px] font-mono text-slate-300 min-w-[150px] flex flex-col gap-1">
                  <div className="flex justify-between border-b border-slate-700/60 pb-1 mb-1 font-sans text-xs font-bold text-white">
                    光标位置参数
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">经纬度:</span>
                    <span className="text-white">{cursorCoords?.lat.toFixed(2)}°N, {cursorCoords?.lon.toFixed(2)}°E</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">实时气压:</span>
                    <span className="text-[#1E9CFF] font-bold">{cursorPressure.toFixed(1)} hPa</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">实时风级:</span>
                    <span className="text-orange-400">{getWindForceCategory(cursorWind)} 级</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Warning Disclaimer Box */}
      {placementMode !== "none" && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-amber-500/90 text-slate-950 font-bold px-4 py-2 rounded-full shadow-2xl flex items-center gap-3 backdrop-blur-md animate-pulse text-xs">
          <span>
            📍 {placementMode === "genesis" ? "点击海图选择生成点" : placementMode === "main" ? "点击海图重新部署主台风" : "点击海图放置伴生台风"}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeployTyphoon?.("none");
            }}
            className="bg-slate-900 text-white hover:bg-slate-800 text-[11px] px-2.5 py-0.5 rounded-full cursor-pointer transition-colors"
          >
            取消
          </button>
        </div>
      )}

      <div className="absolute top-4 right-[75px] z-[1000] max-w-[280px] p-2.5 rounded-xl bg-[#08121f]/90 border border-red-500/20 text-slate-300 text-[10px] leading-relaxed backdrop-blur-md hidden sm:block">
        <span className="text-red-400 font-bold flex items-center gap-1 mb-0.5">
          <Info className="w-3.5 h-3.5" /> 气象教育免责声明:
        </span>
        本产品仅用于气象模拟与娱乐展示，不构成真实天气预报或防灾决策依据。
      </div>

      {activeHistoryStation && (
        <StationHistory
          station={activeHistoryStation}
          typhoons={typhoons}
          startDate={startDate}
          onClose={() => setActiveHistoryStation(null)}
        />
      )}
    </div>
  );
}
