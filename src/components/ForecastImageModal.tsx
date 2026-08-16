/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {  X, Download, AlertTriangle, Monitor, Settings, Check, RefreshCw, ExternalLink, Copy , BarChart3, ImagePlus, Camera, Table } from "lucide-react";
import { Typhoon, TyphoonState, TyphoonCategory, SimulationConfig } from "../types";
import { EAST_ASIA_LAND, getWindForceCategory, calculateForecastPath, getDetailedLandName, fetchOsmCityName, getProceduralElevation, getDistanceToLand, getFluidDynamicsWindField, getStandardAverageWindRadii } from "../simulation/Engine";
import {
  landGeoJson,
  countriesGeoJson,
  loadNaturalEarthData,
  subscribeLoaderState,
  checkPointOnLandGeoJson,
  getLandfallCountryGeoJson
} from "../simulation/NaturalEarthLoader";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend, Cell } from "recharts";

interface ForecastImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  typhoon: Typhoon;
  currentHour: number;
  startDate: Date;
  config?: SimulationConfig;
}

// Projection bounds for East Asia to match template coordinates precisely
const MIN_LON = 95.0;
const MAX_LON = 138.0;
const MIN_LAT = 12.0;
const MAX_LAT = 38.0;

const RESOLUTIONS = [
  { id: "1080p", name: "1080p (高清)", width: 1920, height: 1440 },
  { id: "2k", name: "2K (极清)", width: 2560, height: 1920 },
  { id: "4k", name: "4K (超清)", width: 3840, height: 2880 },
  { id: "8k", name: "8K (极高)", width: 7680, height: 5760 }
];

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
  cvmax: number // cvmax here should be exact to 1 decimal place (e.g. from Number((vmax * 1.9438).toFixed(1)))
): number => {
  const exactCvmax = cvmax;

  // Peak reduction at the core center: 5 to 25 kt.
  // Weakest typhoon: ~30 kt (15 m/s) -> 5 kt reduction
  // Strongest typhoon: ~140 kt (72 m/s) -> 25 kt reduction
  let coreReduction = 5 + ((exactCvmax - 30) / (140 - 30)) * 20;
  coreReduction = Math.max(5, Math.min(25, coreReduction));

  // The attenuation is highest at the core and decays to 0 as distance increases.
  const decayScale = rmw_km * 2.2;
  const decayFactor = Math.exp(-Math.pow(distKm / decayScale, 2));

  const reduction = coreReduction * decayFactor;

  let simulated = rawWind - reduction;

  // Keep simulated wind field's lower bound reasonable for active wind zones
  if (rawWind > 15) {
    simulated = Math.max(10, simulated);
  }

  // CRITICAL RULE: "风场kt值只可能比直接把台风强度从m/s换算成kt之后的值低，而不可能更高。"
  // In the core area, the wind speed must be strictly capped below exactCvmax - reduction.
  if (distKm < rmw_km * 4.0) {
    const maxAllowed = exactCvmax - (coreReduction * 0.8 * decayFactor);
    if (simulated > maxAllowed) {
      simulated = maxAllowed;
    }
  }

  return Math.max(1.0, simulated);
};

export default function ForecastImageModal({
  isOpen,
  onClose,
  typhoon,
  currentHour,
  startDate,
  config: baseConfigProps
}: ForecastImageModalProps) {
  // Requirement 8: Use historical config snapshot if available
  const activeHistoryState = typhoon.history && typhoon.history.length > 0 ? typhoon.history[Math.min(currentHour, typhoon.history.length - 1)] : null;
  const config = activeHistoryState?.configSnapshot || baseConfigProps;

  // Compass direction conversion helper
  const getCompassDirection = (deg: number): string => {
    const d = (deg % 360 + 360) % 360;
    const directions = [
      { label: "正北", min: 348.75, max: 11.25 },
      { label: "东北偏北", min: 11.25, max: 33.75 },
      { label: "东北", min: 33.75, max: 56.25 },
      { label: "东北偏东", min: 56.25, max: 78.75 },
      { label: "正东", min: 78.75, max: 101.25 },
      { label: "东南偏东", min: 101.25, max: 123.75 },
      { label: "东南", min: 123.75, max: 146.25 },
      { label: "东南偏南", min: 146.25, max: 168.75 },
      { label: "正南", min: 168.75, max: 191.25 },
      { label: "西南偏南", min: 191.25, max: 213.75 },
      { label: "西南", min: 213.75, max: 236.25 },
      { label: "西南偏西", min: 236.25, max: 258.75 },
      { label: "正西", min: 258.75, max: 281.25 },
      { label: "西北偏西", min: 281.25, max: 303.75 },
      { label: "西北", min: 303.75, max: 326.25 },
      { label: "西北偏北", min: 326.25, max: 348.75 }
    ];
    for (const item of directions) {
      if (item.min <= item.max) {
        if (d >= item.min && d < item.max) return item.label;
      } else {
        if (d >= item.min || d < item.max) return item.label;
      }
    }
    return "未知";
  };

  // Local physical status text helper
  const getSnapshotStatusText = (state: any): string => {
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
    if ((state.upwellingHours || 0) >= 6) return "冷水上翻 (自涌衰减)";
    if (state.isCoreDisrupted) return "核心结构破坏";
    if (state.category === TyphoonCategory.SuperTY) return "超强台风维持";
    if (state.vmax >= 45) return "强台风发展";
    if (state.vmax >= 33) return "稳步增强中";
    return "热带气旋发展中";
  };

  // Station ranking calculation helper
  const getStationRankings = (
    history: any[],
    currentHour: number,
    windowHours: number
  ) => {
    if (!history || history.length === 0) return [];
    
    // Clamp currentHour index to valid bounds
    const targetIdx = Math.min(Math.max(0, currentHour), history.length - 1);
    const windowStartIdx = Math.max(0, targetIdx - windowHours + 1);

    // Collect station statistics across the window
    const stationMap = new Map<string, { maxGust: number; maxAvgWind: number; totalPrecip: number }>();

    for (let h = windowStartIdx; h <= targetIdx; h++) {
      const state = history[h];
      if (state && Array.isArray(state.stationReadings)) {
        state.stationReadings.forEach((r: any) => {
          if (!r || !r.name) return;
          const name = r.name;
          const existing = stationMap.get(name) || { maxGust: 0, maxAvgWind: 0, totalPrecip: 0 };
          existing.maxGust = Math.max(existing.maxGust, r.maxWindSpeed || 0, r.windSpeed || 0);
          existing.maxAvgWind = Math.max(existing.maxAvgWind, r.windSpeed || 0);
          existing.totalPrecip += r.precipitation || 0;
          stationMap.set(name, existing);
        });
      }
    }

    // Fallback: If no readings found in window, check whole history
    if (stationMap.size === 0) {
      for (let h = 0; h < history.length; h++) {
        const state = history[h];
        if (state && Array.isArray(state.stationReadings)) {
          state.stationReadings.forEach((r: any) => {
            if (!r || !r.name) return;
            const name = r.name;
            const existing = stationMap.get(name) || { maxGust: 0, maxAvgWind: 0, totalPrecip: 0 };
            existing.maxGust = Math.max(existing.maxGust, r.maxWindSpeed || 0, r.windSpeed || 0);
            existing.maxAvgWind = Math.max(existing.maxAvgWind, r.windSpeed || 0);
            existing.totalPrecip += r.precipitation || 0;
            stationMap.set(name, existing);
          });
        }
      }
    }

    const results: any[] = [];
    stationMap.forEach((val, name) => {
      results.push({
        name,
        gust: Number(val.maxGust.toFixed(1)),
        avgWind: Number(val.maxAvgWind.toFixed(1)),
        precip: Number(val.totalPrecip.toFixed(1))
      });
    });

    return results;
  };


  const [resolutionId, setResolutionId] = useState("2k");
  const [typhoonName, setTyphoonName] = useState(typhoon.name || "无名");
  const [typhoonNumber, setTyphoonNumber] = useState(() => localStorage.getItem("forecast_typhoonNumber") || "2612");
  const [forecastHours, setForecastHours] = useState(() => Number(localStorage.getItem("forecast_forecastHours")) || 120);
  const [historyInterval, setHistoryInterval] = useState<number>(() => Number(localStorage.getItem("forecast_historyInterval")) || 3);
  const [showInfoBoxes, setShowInfoBoxes] = useState(() => localStorage.getItem("forecast_showInfoBoxes") !== "false");
  const [showLandfallBox, setShowLandfallBox] = useState(() => localStorage.getItem("forecast_showLandfallBox") !== "false");
  const [showForecastBox, setShowForecastBox] = useState(() => localStorage.getItem("forecast_showForecastBox") !== "false");
  const [showCenterBox, setShowCenterBox] = useState(() => localStorage.getItem("forecast_showCenterBox") !== "false");
  const [boxDensity, setBoxDensity] = useState(() => Number(localStorage.getItem("forecast_boxDensity")) || 3);
  const [auditNumber, setAuditNumber] = useState(() => localStorage.getItem("forecast_auditNumber") || "GS (2026) 3082号");
  const [showWarning, setShowWarning] = useState(() => localStorage.getItem("forecast_showWarning") !== "false");
  const [showNadirGap, setShowNadirGap] = useState<boolean>(() => localStorage.getItem("forecast_showNadirGap") === "true");
  const [scatterometerLandData, setScatterometerLandData] = useState<boolean>(() => localStorage.getItem("forecast_scatterometerLandData") !== "false");

  // Typhoon Snapshot state
  const [showSnapshot, setShowSnapshot] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedParam, setCopiedParam] = useState<string | null>(null);

  // Station Ranking states
  const [showRankings, setShowRankings] = useState(false);
  const [showChartMaker, setShowChartMaker] = useState(false);
  const [chartMakerConfig, setChartMakerConfig] = useState(() => {
    try {
      const saved = localStorage.getItem("typhoon_chart_maker_config");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      aspectRatio: "16:9",
      resolution: 2,
      chartType: "bar",
      topN: 10,
      showInfo: true,
    };
  });
  const [rankingWindow, setRankingWindow] = useState<1 | 3 | 6 | 12 | 24 | 48 | 72>(() => {
    try {
      const saved = localStorage.getItem("typhoon_ranking_window");
      if (saved) return JSON.parse(saved) as any;
    } catch (e) {}
    return 1;
  });
  const [rankingElement, setRankingElement] = useState<"gust" | "avgWind" | "precip">((): any => {
    try {
      const saved = localStorage.getItem("typhoon_ranking_element");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return "gust";
  });
  const [chartOrientation, setChartOrientation] = useState<"horizontal" | "vertical">("horizontal");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedRanking, setCopiedRanking] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem("typhoon_chart_maker_config", JSON.stringify(chartMakerConfig));
    } catch (e) {}
  }, [chartMakerConfig]);

  useEffect(() => {
    try {
      localStorage.setItem("typhoon_ranking_window", JSON.stringify(rankingWindow));
    } catch (e) {}
  }, [rankingWindow]);

  useEffect(() => {
    try {
      localStorage.setItem("typhoon_ranking_element", JSON.stringify(rankingElement));
    } catch (e) {}
  }, [rankingElement]);

  // Scatterometer adjustable parameters
  const [scatZoomSpan, setScatZoomSpan] = useState<number>(() => {
    const val = localStorage.getItem("forecast_scatZoomSpan");
    return val ? Number(val) : 12.0;
  });
  const [scatBarbSpacing, setScatBarbSpacing] = useState<number>(() => {
    const val = localStorage.getItem("forecast_scatBarbSpacing");
    return val ? Number(val) : 0.05;
  });
  const [scatBarbLength, setScatBarbLength] = useState<number>(() => {
    const val = localStorage.getItem("forecast_scatBarbLength");
    return val ? Number(val) : 10.0;
  });
  const [scatBarbWidth, setScatBarbWidth] = useState<number>(() => {
    const val = localStorage.getItem("forecast_scatBarbWidth");
    return val ? Number(val) : 1.0;
  });
  const [scatOrbitAngle, setScatOrbitAngle] = useState<number>(() => {
    const val = localStorage.getItem("forecast_scatOrbitAngle");
    return val ? Number(val) : 15.0;
  });
  const [scatSwathWidth, setScatSwathWidth] = useState<number>(() => {
    const val = localStorage.getItem("forecast_scatSwathWidth");
    return val ? Number(val) : 12.0;
  });
  const [scatNadirWidth, setScatNadirWidth] = useState<number>(() => {
    const val = localStorage.getItem("forecast_scatNadirWidth");
    return val ? Number(val) : 0.0;
  });
  const [scatBackgroundScale, setScatBackgroundScale] = useState<number>(() => {
    const val = localStorage.getItem("forecast_scatBackgroundScale");
    return val ? Number(val) : 1.0;
  });

  const drawCoastlinesOnTop = (ctx: CanvasRenderingContext2D, latLonToPixel: (lat: number, lon: number) => { x: number; y: number }, scale: number) => {
    if (landGeoJson && landGeoJson.features) {
      ctx.save();
      ctx.strokeStyle = "#1e293b"; // Fine dark slate coastline
      ctx.lineWidth = 1.2 * scale;
      const strokePoly = (coordinates: number[][][]) => {
        for (const ring of coordinates) {
          ctx.beginPath();
          for (let i = 0; i < ring.length; i++) {
            const pt = latLonToPixel(ring[i][1], ring[i][0]);
            if (i === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          }
          ctx.closePath();
          ctx.stroke();
        }
      };
      landGeoJson.features.forEach((feat: any) => {
        if (feat.geometry.type === "Polygon") strokePoly(feat.geometry.coordinates);
        else if (feat.geometry.type === "MultiPolygon") feat.geometry.coordinates.forEach(strokePoly);
      });
      ctx.restore();
    }
  };
  
  // Style and Ensemble states
  const [imageStyle, setImageStyle] = useState<"standard" | "ensemble" | "scatterometer">(() => {
    const stored = localStorage.getItem("forecast_imageStyle");
    if (stored === "standard" || stored === "ensemble" || stored === "scatterometer") {
      return stored as any;
    }
    return "standard";
  });
  const [ensembleSubTab, setEnsembleSubTab] = useState<"track" | "probability">("track");
  const [isCalculatingEnsemble, setIsCalculatingEnsemble] = useState(false);
  const [ensembleProgress, setEnsembleProgress] = useState(0);
  const [ensembleMemberCount, setEnsembleMemberCount] = useState<number>(100);
  const [ensembleOrigin, setEnsembleOrigin] = useState<{lat: number, lon: number} | null>(null);
  const [ensembleMembers, setEnsembleMembers] = useState<Array<{
    id: string;
    maxVmax: number;
    minPmin: number;
    category: string;
    track: Array<{ lat: number; lon: number; vmax: number; pmin: number; simHour: number }>;
  }>>([]);

  const [customPresets, setCustomPresets] = useState<Array<{ name: string; spacing: number; length: number; width: number; angle: number; swath: number; nadir: number; bg: number; gap: boolean; land: boolean }>>(() => {
    try {
      const stored = localStorage.getItem("forecast_custom_scat_presets");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");

  const scatPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (imageStyle !== "scatterometer") return;
    const canvas = scatPreviewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Dark high-tech radar grid background
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = "rgba(249, 115, 22, 0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw central circular radar grid range rings
    const cx = width / 2;
    const cy = height / 2;
    ctx.strokeStyle = "rgba(249, 115, 22, 0.15)";
    [25, 50, 75].forEach(r => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Draw scan swath bounds
    const angleRad = (scatOrbitAngle * Math.PI) / 180;
    const nx = Math.cos(angleRad + Math.PI / 2);
    const ny = Math.sin(angleRad + Math.PI / 2);

    const swathPx = scatSwathWidth * 10; 
    const nadirPx = scatNadirWidth * 10;

    ctx.strokeStyle = "rgba(249, 115, 22, 0.3)";
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.moveTo(cx - nx * swathPx - Math.cos(angleRad) * 200, cy - ny * swathPx - Math.sin(angleRad) * 200);
    ctx.lineTo(cx - nx * swathPx + Math.cos(angleRad) * 200, cy - ny * swathPx + Math.sin(angleRad) * 200);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + nx * swathPx - Math.cos(angleRad) * 200, cy + ny * swathPx - Math.sin(angleRad) * 200);
    ctx.lineTo(cx + nx * swathPx + Math.cos(angleRad) * 200, cy + ny * swathPx + Math.sin(angleRad) * 200);
    ctx.stroke();

    if (showNadirGap && nadirPx > 0) {
      ctx.strokeStyle = "rgba(239, 68, 68, 0.25)";
      ctx.beginPath();
      ctx.moveTo(cx - nx * nadirPx - Math.cos(angleRad) * 200, cy - ny * nadirPx - Math.sin(angleRad) * 200);
      ctx.lineTo(cx - nx * nadirPx + Math.cos(angleRad) * 200, cy - ny * nadirPx + Math.sin(angleRad) * 200);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx + nx * nadirPx - Math.cos(angleRad) * 200, cy + ny * nadirPx - Math.sin(angleRad) * 200);
      ctx.lineTo(cx + nx * nadirPx + Math.cos(angleRad) * 200, cy + ny * nadirPx + Math.sin(angleRad) * 200);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    const gridSpacingPx = Math.max(12, scatBarbSpacing * 250);
    const activeState = typhoon.history?.find(h => h.simHour === currentHour) || typhoon;
    const cvmax = Number(((activeState?.vmax || 35) * 1.9438).toFixed(1)); 

    const previewScale = 0.55; 

    const drawBarbPreview = (bx: number, by: number, speedKt: number, mathAngleRad: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(0.7, scatBarbWidth * previewScale);
      ctx.beginPath();
      
      const shaftLen = scatBarbLength * previewScale;
      const canvasAngle = -mathAngleRad;
      const tailAngle = canvasAngle + Math.PI;
      
      const ex = bx + Math.cos(tailAngle) * shaftLen;
      const ey = by + Math.sin(tailAngle) * shaftLen;
      ctx.moveTo(bx, by);
      ctx.lineTo(ex, ey);
      
      let remaining = Math.round(speedKt / 5) * 5;
      let curX = ex; let curY = ey;
      const barbSpacing = 1.8;
      
      const nx = Math.sin(canvasAngle);
      const ny = -Math.cos(canvasAngle);
      
      const stepX = Math.cos(canvasAngle) * barbSpacing;
      const stepY = Math.sin(canvasAngle) * barbSpacing;
      
      while (remaining >= 50) {
        ctx.moveTo(curX, curY);
        ctx.lineTo(curX + nx * 5, curY + ny * 5);
        ctx.lineTo(curX + stepX * 0.8, curY + stepY * 0.8);
        ctx.fillStyle = color; ctx.fill();
        curX += stepX; curY += stepY;
        remaining -= 50;
      }
      while (remaining >= 10) {
        ctx.moveTo(curX, curY);
        ctx.lineTo(curX + nx * 5, curY + ny * 5);
        curX += stepX; curY += stepY;
        remaining -= 10;
      }
      if (remaining >= 5) {
        ctx.moveTo(curX, curY);
        ctx.lineTo(curX + nx * 2.5, curY + ny * 2.5);
      }
      ctx.stroke();
    };

    const getColorForKt = (kt: number) => {
      if (kt < 5) return "#475569";
      if (kt < 10) return "#06b6d4";
      if (kt < 15) return "#2563eb";
      if (kt < 20) return "#16a34a";
      if (kt < 25) return "#ca8a04";
      if (kt < 30) return "#ea580c";
      if (kt < 35) return "#dc2626";
      return "#d946ef";
    };

    const previewBarbsToDraw: Array<{
      bx: number;
      by: number;
      speed: number;
      angle: number;
      color: string;
      distKm: number;
    }> = [];

    const maxDistPx = Math.sqrt(width * width + height * height);
    const radSnap = {
      r34: (activeState as any)?.r7 || (activeState as any)?.r34 || (typhoon as any)?.r7,
      r50: (activeState as any)?.r10 || (activeState as any)?.r50 || (typhoon as any)?.r10,
      r64: (activeState as any)?.r12 || (activeState as any)?.r64 || (typhoon as any)?.r12,
      ewrcCount: (activeState as any)?.ewrcCount
    };

    // Orbit-aligned grid loop: perfect WISYWIG matching high-res output
    for (let u = -maxDistPx; u <= maxDistPx; u += gridSpacingPx) {
      for (let v = -swathPx; v <= swathPx; v += gridSpacingPx) {
        const bx = cx + u * Math.cos(angleRad) - v * Math.sin(angleRad);
        const by = cy + u * Math.sin(angleRad) + v * Math.cos(angleRad);

        if (bx < -10 || bx > width + 10 || by < -10 || by > height + 10) continue;

        const distToOrbitPx = Math.abs(v);
        const distToOrbitDeg = distToOrbitPx / 10;

        if (showNadirGap && distToOrbitDeg < scatNadirWidth) continue;

        const dxPx = bx - cx;
        const dyPx = by - cy;
        const distPx = Math.sqrt(dxPx * dxPx + dyPx * dyPx);

        // Convert px to km (approx 2.0 km per pixel)
        const distKm = distPx * 2.0;
        const angleToPt = Math.atan2(dyPx, dxPx);

        // Compute asymmetric and scaled wind speed matching the new model
        const { w_ty, rmw_km } = getTyphoonWindSpeed(distKm, angleToPt, cvmax, radSnap, false, (activeState as any).ewrcState || "none", (activeState as any).ewrcProgress || 0);

        const tangAngle = angleToPt + Math.PI / 2 + (15 * Math.PI) / 180; 

        // Background environmental wind strictly capped <= 18kt
        const bgU = Math.min(12, 6 * scatBackgroundScale);
        const bgV = Math.min(8, 3 * scatBackgroundScale);

        let u_ty = Math.cos(tangAngle) * w_ty;
        let v_ty = Math.sin(tangAngle) * w_ty;

        // Apply wind translation asymmetry for scatterometer previewer, fading outside r34
        const headingRad = activeState.direction * Math.PI / 180;
        const relativeAngle = angleToPt - headingRad;
        const r34_eff = Math.max(35, getAngularRadius(radSnap.r34, angleToPt, 220));
        const asymFade = Math.max(0, 1.0 - Math.max(0, distKm - r34_eff) / (r34_eff * 0.5));
        const translationAsymmetry = 1.0 + 0.12 * Math.sin(relativeAngle) * Math.min(1.0, activeState.speed / 28.0) * asymFade;
        u_ty *= translationAsymmetry;
        v_ty *= translationAsymmetry;

        let finalU = u_ty + bgU;
        let finalV = v_ty + bgV;
        const finalSpeedRaw = Math.sqrt(finalU * finalU + finalV * finalV);
        let finalSpeed = getSimulatedScatWind(finalSpeedRaw, distKm, rmw_km, cvmax);

        // Outside 7-level wind circle (r34), enforce total wind to drop below 25kt
        if (distKm > r34_eff) {
          const distRatio = (distKm - r34_eff) / (r34_eff * 0.5);
          const maxAllowedWind = Math.max(20.0, 34.0 - distRatio * 14.0);
          if (finalSpeed > maxAllowedWind) {
            finalSpeed = maxAllowedWind;
          }
        }

        // Apply Wind blocking / attenuation (Requirement 4)
        if (finalSpeed > 5.0) {
          const clat = activeState.lat;
          const clon = activeState.lon;
          const glon = clon + (dxPx * 2.0) / (111.12 * Math.cos((clat * Math.PI) / 180));
          const glat = clat + (dyPx * -2.0) / 111.12;
          
          const isLand = checkPointOnLandGeoJson(glat, glon);
          if (!scatterometerLandData && isLand) {
            continue;
          }
          if (isLand) {
            finalSpeed *= 0.75;
          }
          
          // Trace upstream fetch trajectory
          const scale = 0.65;
          const upLat = glat - (finalV / finalSpeedRaw) * scale;
          const upLon = glon - (finalU / finalSpeedRaw) * scale;
          if (checkPointOnLandGeoJson(upLat, upLon)) {
            finalSpeed *= 0.76;
            
            const upLat2 = glat - (finalV / finalSpeedRaw) * scale * 2.2;
            const upLon2 = glon - (finalU / finalSpeedRaw) * scale * 2.2;
            if (checkPointOnLandGeoJson(upLat2, upLon2)) {
              finalSpeed *= 0.80; // deep decay
            }
          }
        }

        const finalAngle = Math.atan2(finalV, finalU);

        if (finalSpeed < 3) continue;

        previewBarbsToDraw.push({
          bx,
          by,
          speed: finalSpeed,
          angle: finalAngle,
          color: getColorForKt(finalSpeed),
          distKm
        });
      }
    }

    // Sort preview barbs by Y coordinate (by) ascending so row below sits on top of row above
    previewBarbsToDraw.sort((a, b) => a.by - b.by);

    previewBarbsToDraw.forEach(barb => {
      drawBarbPreview(barb.bx, barb.by, barb.speed, barb.angle, barb.color);
    });

    ctx.strokeStyle = "#f87171";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - 6, cy); ctx.lineTo(cx + 6, cy);
    ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy + 6);
    ctx.stroke();

  }, [
    imageStyle,
    scatBarbSpacing,
    scatBarbLength,
    scatBarbWidth,
    scatOrbitAngle,
    scatSwathWidth,
    scatNadirWidth,
    scatBackgroundScale,
    showNadirGap,
    scatterometerLandData
  ]);

  // Synchronize scatterometer custom configurations to localStorage
  useEffect(() => {
    localStorage.setItem("forecast_scatBarbSpacing", String(scatBarbSpacing));
    localStorage.setItem("forecast_scatBarbLength", String(scatBarbLength));
    localStorage.setItem("forecast_scatBarbWidth", String(scatBarbWidth));
    localStorage.setItem("forecast_scatOrbitAngle", String(scatOrbitAngle));
    localStorage.setItem("forecast_scatSwathWidth", String(scatSwathWidth));
    localStorage.setItem("forecast_scatNadirWidth", String(scatNadirWidth));
    localStorage.setItem("forecast_scatBackgroundScale", String(scatBackgroundScale));
    localStorage.setItem("forecast_showNadirGap", String(showNadirGap));
    localStorage.setItem("forecast_scatterometerLandData", String(scatterometerLandData));
  }, [
    scatBarbSpacing,
    scatBarbLength,
    scatBarbWidth,
    scatOrbitAngle,
    scatSwathWidth,
    scatNadirWidth,
    scatBackgroundScale,
    showNadirGap,
    scatterometerLandData
  ]);

  // JMA Style Specific States
  const [jmaWindOpacity, setJmaWindOpacity] = useState<number>(0.35);
  const [jmaShowCone, setJmaShowCone] = useState<boolean>(true);
  const [jmaShowPredictedRings, setJmaShowPredictedRings] = useState<boolean>(true);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem("forecast_typhoonNumber", typhoonNumber);
    localStorage.setItem("forecast_forecastHours", forecastHours.toString());
    localStorage.setItem("forecast_historyInterval", historyInterval.toString());
    localStorage.setItem("forecast_showInfoBoxes", showInfoBoxes.toString());
    localStorage.setItem("forecast_showLandfallBox", showLandfallBox.toString());
    localStorage.setItem("forecast_showForecastBox", showForecastBox.toString());
    localStorage.setItem("forecast_showCenterBox", showCenterBox.toString());
    localStorage.setItem("forecast_boxDensity", boxDensity.toString());
    localStorage.setItem("forecast_auditNumber", auditNumber);
    localStorage.setItem("forecast_showWarning", showWarning.toString());
    localStorage.setItem("forecast_imageStyle", imageStyle);
    localStorage.setItem("forecast_showNadirGap", showNadirGap.toString());
    localStorage.setItem("forecast_scatterometerLandData", scatterometerLandData.toString());
    localStorage.setItem("forecast_scatBarbSpacing", scatBarbSpacing.toString());
    localStorage.setItem("forecast_scatBarbLength", scatBarbLength.toString());
    localStorage.setItem("forecast_scatBarbWidth", scatBarbWidth.toString());
    localStorage.setItem("forecast_scatOrbitAngle", scatOrbitAngle.toString());
    localStorage.setItem("forecast_scatSwathWidth", scatSwathWidth.toString());
    localStorage.setItem("forecast_scatNadirWidth", scatNadirWidth.toString());
    localStorage.setItem("forecast_scatBackgroundScale", scatBackgroundScale.toString());
  }, [
    typhoonNumber,
    forecastHours,
    historyInterval,
    showInfoBoxes,
    showLandfallBox,
    showForecastBox,
    showCenterBox,
    boxDensity,
    auditNumber,
    showWarning,
    imageStyle,
    showNadirGap,
    scatterometerLandData,
    scatBarbSpacing,
    scatBarbLength,
    scatBarbWidth,
    scatOrbitAngle,
    scatSwathWidth,
    scatNadirWidth,
    scatBackgroundScale
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [geoJsonLoaded, setGeoJsonLoaded] = useState(false);
  const [osmNamesMap, setOsmNamesMap] = useState<Record<string, string>>({});
  const fetchedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen || !typhoon) return;
    const activeState = typhoon.history?.find((h) => h.simHour === currentHour) || typhoon;
    const tempTyphoon: Typhoon = {
      ...typhoon,
      lat: activeState.lat,
      lon: activeState.lon,
      vmax: activeState.vmax,
      pmin: activeState.pmin
    };
    const path = typhoon.forecastPath && typhoon.forecastPath.length > 0 
      ? typhoon.forecastPath 
      : calculateForecastPath(tempTyphoon, config, forecastHours);

    let wasLand = checkPointOnLandGeoJson(activeState.lat, activeState.lon);
    for (let i = 0; i < path.length; i++) {
      const pt = path[i];
      const isLand = checkPointOnLandGeoJson(pt.lat, pt.lon);
      
      // 1. Regular track points
      if (!wasLand && isLand) {
        // Transition point (landfall)
        let landfallLat = pt.lat;
        let landfallLon = pt.lon;
        if (i > 0) {
          const prev = path[i-1];
          for (let s = 1; s <= 20; s++) {
            const r = s / 20;
            const ilat = prev.lat + (pt.lat - prev.lat) * r;
            const ilon = prev.lon + (pt.lon - prev.lon) * r;
            if (checkPointOnLandGeoJson(ilat, ilon)) {
              landfallLat = ilat;
              landfallLon = ilon;
              break;
            }
          }
        }
        const key = `${landfallLat.toFixed(3)},${landfallLon.toFixed(3)}`;
        if (!fetchedKeysRef.current.has(key)) {
          fetchedKeysRef.current.add(key);
          fetchOsmCityName(landfallLat, landfallLon).then((osmName) => {
            if (osmName) {
              setOsmNamesMap((prev) => ({ ...prev, [key]: osmName }));
            }
          }).catch(() => {
            fetchedKeysRef.current.delete(key);
          });
        }
      }

      // 2. Sample points for general naming
      if (i % 8 === 0 && isLand) {
        const key = `${pt.lat.toFixed(3)},${pt.lon.toFixed(3)}`;
        if (!fetchedKeysRef.current.has(key)) {
          fetchedKeysRef.current.add(key);
          fetchOsmCityName(pt.lat, pt.lon).then((osmName) => {
            if (osmName) {
              setOsmNamesMap((prev) => ({ ...prev, [key]: osmName }));
            }
          }).catch(() => {
            fetchedKeysRef.current.delete(key);
          });
        }
      }
      wasLand = isLand;
    }
  }, [isOpen, typhoon, currentHour, forecastHours, config]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Meteorological simulation states and refs
  const [modalMode, setModalMode] = useState<"select" | "forecast" | "meteorological">("forecast");
  const [metProduct, setMetProduct] = useState<"olr" | "dbz" | "wv">("olr");
  const [metVws, setMetVws] = useState<number>(8); // m/s
  const [metSst, setMetSst] = useState<number>(29); // °C
  const [metIsGenerating, setMetIsGenerating] = useState(false);
  
  const metCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const landMaskRef = useRef<Uint8ClampedArray | null>(null);

  useEffect(() => {
    if (isOpen) {
      setModalMode("forecast");
    }
  }, [isOpen]);

  useEffect(() => {
    if (modalMode === "meteorological" && metCanvasRef.current && geoJsonLoaded) {
      drawMeteorologicalMapOnCanvas(metCanvasRef.current, metProduct, metVws, metSst);
    }
  }, [modalMode, metProduct, metVws, metSst, currentHour, typhoon, geoJsonLoaded]);

  useEffect(() => {
    loadNaturalEarthData().then(() => {
      setGeoJsonLoaded(true);
    });
    const unsubscribe = subscribeLoaderState((state) => {
      if (state.landLoaded) {
        setGeoJsonLoaded(true);
      }
    });
    return () => unsubscribe();
  }, []);

  const runEnsembleSimulationWithCount = (countOverride?: number) => {
    if (isCalculatingEnsemble) return;
    setIsCalculatingEnsemble(true);
    setEnsembleProgress(0);

    const activeState = typhoon.history?.find((h) => h.simHour === currentHour) || typhoon;
    setEnsembleOrigin({ lat: activeState.lat, lon: activeState.lon });
    setEnsembleMembers([]);
    const baseConfig = activeState.configSnapshot || config || {
      subtropicalHighEnabled: true,
      subtropicalHighStrength: 1.0,
      subtropicalHighLat: 28.0,
      subtropicalHighLon: 135.0,
      subtropicalHighWestExtent: 125.0,
      westerliesEnabled: true,
      westerliesStrength: 1.0,
      westerliesLat: 30.0,
      westerliesTroughLon: 120.0,
      westerliesTroughDepth: 1.0,
      betaDriftEnabled: true,
      betaDriftScale: 1.0,
      monsoonTroughEnabled: false,
      eastWaveEnabled: false,
      shearScale: 1.0,
      humidityScale: 1.0,
      outflowScale: 1.0,
      dryAirEnabled: false,
      randomNoise: 0,
      sstAnomaly: 0,
      ohcScale: 1.0,
      warmPoolEnabled: true,
      coldEddyEnabled: false,
      airSeaCoupling: 1.0,
      ewrcTrigger: "auto",
      rapidIntensifyEnabled: true,
      landDecayEnabled: true,
      terrainDecayEnabled: true,
      landfallDecayAdjustment: 0,
      landProximityDecayAdjustment: 0,
      etEnabled: true,
      fujiwharaEnabled: true,
      seed: "12345",
      joystickSensitivity: 1.0,
      joystickStrength: 1.0,
      joystickDx: 0,
      joystickDy: 0,
      joystickDragging: false,
      soundEnabled: false,
      soundVolume: 0.5,
      followMainTyphoon: false,
      maxIntensityLimitEnabled: false,
      maxIntensityLimit: 70,
      intensificationRate: 1.0,
      coastlineSource: "natural_earth"
    };

    let currentStep = 0;
    const totalMembers = countOverride || ensembleMemberCount;
    const newMembers: any[] = [];

    const runBatch = () => {
      try {
        let batchSize = 25;
        if (totalMembers >= 1000) batchSize = 150;
        else if (totalMembers >= 500) batchSize = 100;
        else if (totalMembers >= 200) batchSize = 50;

        const end = Math.min(totalMembers, currentStep + batchSize);

        for (let i = currentStep; i < end; i++) {
        const seed1 = Math.sin((i + 1) * 17.13);
        const seed2 = Math.cos((i + 1) * 29.37);
        const seed3 = Math.sin((i + 1) * 41.81);
        const seed4 = Math.cos((i + 1) * 53.29);

        // Clustered initial conditions and perturbations mimicking true ensemble forecasting
        let dirOffset = 0;
        let clusterType: "main" | "recurving" | "westward" | "outlier" = "main";

        const pct = (i / totalMembers) * 100;
        if (pct < 50) {
          // Main Cluster (50% of members)
          clusterType = "main";
          dirOffset = seed1 * 1.6; // Increased path dispersion (Requirement 1)
        } else if (pct < 76) {
          // Recurving Cluster (26% of members)
          clusterType = "recurving";
          dirOffset = 1.5 + seed1 * 2.8; // Increased path dispersion (Requirement 1)
        } else if (pct < 90) {
          // Westward Cluster (14% of members)
          clusterType = "westward";
          dirOffset = -1.8 + seed1 * 1.8; // Increased path dispersion (Requirement 1)
        } else {
          // Wide Outlier Cluster (10% of members)
          clusterType = "outlier";
          dirOffset = seed1 * 7.5; // Increased path dispersion (Requirement 1)
        }

        // Perturb initial position slightly to create more diversity near the start
        const latPerturb = seed3 * 0.18; // Increased coordination perturbation (Requirement 1)
        const lonPerturb = seed4 * 0.18;

        // Genesis uncertainty
        let genesisUncertaintyMultiplier = 1.0;
        const isEarlyStage = (typhoon.history?.length ?? 0) < 12 || activeState.vmax < 23.0;
        if (isEarlyStage) {
          genesisUncertaintyMultiplier = 2.2;
        }
        dirOffset *= genesisUncertaintyMultiplier;

        const tempTyphoon: Typhoon = {
          ...typhoon,
          lat: activeState.lat + latPerturb,
          lon: activeState.lon + lonPerturb,
          vmax: activeState.vmax,
          pmin: activeState.pmin,
          speed: activeState.speed,
          direction: (activeState.direction + dirOffset + 360) % 360
        };

        let perturbedConfig: SimulationConfig;

        if (clusterType === "main") {
          perturbedConfig = {
            ...baseConfig,
            maxIntensityLimitEnabled: baseConfig.maxIntensityLimitEnabled,
            subtropicalHighStrength: (baseConfig.subtropicalHighStrength ?? 1.0) * (1.0 + seed2 * 0.12),
            subtropicalHighLat: (baseConfig.subtropicalHighLat ?? 28.0) + seed3 * 1.5,
            subtropicalHighLon: (baseConfig.subtropicalHighLon ?? 135.0) + seed4 * 2.2,
            subtropicalHighWestExtent: (baseConfig.subtropicalHighWestExtent ?? 125.0) + seed2 * 3.5,
            westerliesStrength: (baseConfig.westerliesStrength ?? 1.0) * (1.0 + seed3 * 0.18),
            westerliesLat: (baseConfig.westerliesLat ?? 30.0) + seed1 * 1.5,
            westerliesTroughLon: (baseConfig.westerliesTroughLon ?? 120.0) + seed4 * 3.0,
            betaDriftScale: (baseConfig.betaDriftScale ?? 1.0) * (0.85 + Math.abs(seed2) * 0.3),
            shearScale: (baseConfig.shearScale ?? 1.0) * (0.80 + seed3 * 0.55), // Increased intensity dispersion
            sstAnomaly: (baseConfig.sstAnomaly ?? 0) + seed4 * 1.8, // Wider SST anomaly range
            intensificationRate: (baseConfig.intensificationRate ?? 1.0) * (0.72 + seed1 * 0.48), // Wider rate dispersion
            randomNoise: 0.15 + Math.abs(seed1) * 0.25,
            steeringBiasU: seed1 * 0.55,
            steeringBiasV: seed2 * 0.55
          };
        } else if (clusterType === "recurving") {
          // Weaker, eastward subtropical high forces recurvature northward
          perturbedConfig = {
            ...baseConfig,
            maxIntensityLimitEnabled: baseConfig.maxIntensityLimitEnabled,
            subtropicalHighStrength: (baseConfig.subtropicalHighStrength ?? 1.0) * (0.80 + seed2 * 0.10),
            subtropicalHighLat: (baseConfig.subtropicalHighLat ?? 28.0) + 1.5 + seed3 * 2.2,
            subtropicalHighLon: (baseConfig.subtropicalHighLon ?? 135.0) + 4.0 + seed4 * 3.0,
            subtropicalHighWestExtent: (baseConfig.subtropicalHighWestExtent ?? 125.0) - 7.5 + seed2 * 3.5,
            westerliesStrength: (baseConfig.westerliesStrength ?? 1.0) * (1.25 + seed3 * 0.25),
            westerliesLat: (baseConfig.westerliesLat ?? 30.0) - 2.0 + seed1 * 1.5,
            westerliesTroughLon: (baseConfig.westerliesTroughLon ?? 120.0) - 4.0 + seed4 * 3.0,
            betaDriftScale: (baseConfig.betaDriftScale ?? 1.0) * (1.0 + Math.abs(seed2) * 0.45),
            shearScale: (baseConfig.shearScale ?? 1.0) * (0.60 + seed3 * 0.70), // Increased intensity dispersion
            sstAnomaly: (baseConfig.sstAnomaly ?? 0) + seed4 * 2.2, // Wider SST range
            intensificationRate: (baseConfig.intensificationRate ?? 1.0) * (0.60 + seed1 * 0.60), // Wider rate dispersion
            randomNoise: 0.22 + Math.abs(seed1) * 0.32,
            steeringBiasU: seed3 * 0.9,
            steeringBiasV: seed4 * 0.9
          };
        } else if (clusterType === "westward") {
          // Stronger, westward-extended subtropical high blocks northward turn, forcing westwards
          perturbedConfig = {
            ...baseConfig,
            maxIntensityLimitEnabled: baseConfig.maxIntensityLimitEnabled,
            subtropicalHighStrength: (baseConfig.subtropicalHighStrength ?? 1.0) * (1.18 + seed2 * 0.08),
            subtropicalHighLat: (baseConfig.subtropicalHighLat ?? 28.0) - 1.5 + seed3 * 1.5,
            subtropicalHighLon: (baseConfig.subtropicalHighLon ?? 135.0) - 4.0 + seed4 * 3.0,
            subtropicalHighWestExtent: (baseConfig.subtropicalHighWestExtent ?? 125.0) + 8.5 + seed2 * 3.0,
            westerliesStrength: (baseConfig.westerliesStrength ?? 1.0) * (0.72 + seed3 * 0.15),
            westerliesLat: (baseConfig.westerliesLat ?? 30.0) + 2.0 + seed1 * 1.5,
            westerliesTroughLon: (baseConfig.westerliesTroughLon ?? 120.0) + 4.0 + seed4 * 3.0,
            betaDriftScale: (baseConfig.betaDriftScale ?? 1.0) * (0.75 + Math.abs(seed2) * 0.3),
            shearScale: (baseConfig.shearScale ?? 1.0) * (0.90 + seed3 * 0.55), // Increased intensity dispersion
            sstAnomaly: (baseConfig.sstAnomaly ?? 0) + seed4 * 2.0, // Wider SST range
            intensificationRate: (baseConfig.intensificationRate ?? 1.0) * (0.65 + seed1 * 0.55), // Wider rate dispersion
            randomNoise: 0.18 + Math.abs(seed1) * 0.25,
            steeringBiasU: seed2 * 0.75,
            steeringBiasV: seed1 * 0.75
          };
        } else {
          // Wide Outlier Cluster
          const lastIdx = totalMembers - 1;
          if (i === lastIdx - 2) {
            // Extreme southward outlier: extremely strong Subtropical High, pushed way south and west
            perturbedConfig = {
              ...baseConfig,
              maxIntensityLimitEnabled: baseConfig.maxIntensityLimitEnabled,
              subtropicalHighStrength: (baseConfig.subtropicalHighStrength ?? 1.0) * 1.40,
              subtropicalHighLat: (baseConfig.subtropicalHighLat ?? 28.0) - 4.5,
              subtropicalHighLon: (baseConfig.subtropicalHighLon ?? 135.0) - 8.0,
              subtropicalHighWestExtent: (baseConfig.subtropicalHighWestExtent ?? 125.0) + 12.0,
              westerliesStrength: 0.1,
              westerliesLat: 35.0,
              betaDriftScale: 0.2,
              shearScale: 1.0,
              sstAnomaly: 1.5,
              intensificationRate: 1.1,
              randomNoise: 0.20,
              steeringBiasU: -0.8,
              steeringBiasV: -0.4
            };
          } else if (i === lastIdx - 1) {
            // Extreme immediate recurver: extremely weak Subtropical High, westerlies pushed far south
            perturbedConfig = {
              ...baseConfig,
              maxIntensityLimitEnabled: baseConfig.maxIntensityLimitEnabled,
              subtropicalHighStrength: (baseConfig.subtropicalHighStrength ?? 1.0) * 0.45,
              subtropicalHighLat: (baseConfig.subtropicalHighLat ?? 28.0) + 5.0,
              subtropicalHighWestExtent: (baseConfig.subtropicalHighWestExtent ?? 125.0) - 15.0,
              westerliesStrength: (baseConfig.westerliesStrength ?? 1.0) * 2.0,
              westerliesLat: (baseConfig.westerliesLat ?? 30.0) - 6.0,
              westerliesTroughLon: (baseConfig.westerliesTroughLon ?? 120.0) - 8.0,
              betaDriftScale: 1.5,
              shearScale: 0.5,
              sstAnomaly: 2.0,
              intensificationRate: 0.8,
              randomNoise: 0.25,
              steeringBiasU: 1.2,
              steeringBiasV: 0.8
            };
          } else if (i === lastIdx) {
            // High-noise looping/chaotic outlier
            perturbedConfig = {
              ...baseConfig,
              maxIntensityLimitEnabled: baseConfig.maxIntensityLimitEnabled,
              subtropicalHighStrength: (baseConfig.subtropicalHighStrength ?? 1.0) * 0.75,
              subtropicalHighLat: (baseConfig.subtropicalHighLat ?? 28.0) + 2.0,
              westerliesStrength: (baseConfig.westerliesStrength ?? 1.0) * 0.5,
              betaDriftScale: 0.5,
              shearScale: 1.5,
              sstAnomaly: -1.0,
              intensificationRate: 0.6,
              randomNoise: 0.85,
              steeringBiasU: (seed1 * 1.5),
              steeringBiasV: (seed2 * 1.5)
            };
          } else {
            // Other Outliers: standard highly chaotic steering and parameter variance
            const sign = i % 2 === 0 ? 1 : -1;
            const isWeakOutlier = (i % 4 === 0); // Designate 25% of general outliers as weak/decaying cases (Requirement 1)
            perturbedConfig = {
              ...baseConfig,
              maxIntensityLimitEnabled: baseConfig.maxIntensityLimitEnabled,
              subtropicalHighStrength: (baseConfig.subtropicalHighStrength ?? 1.0) * (1.0 + sign * (0.35 + Math.abs(seed2) * 0.35)),
              subtropicalHighLat: (baseConfig.subtropicalHighLat ?? 28.0) + seed3 * 6.5,
              subtropicalHighLon: (baseConfig.subtropicalHighLon ?? 135.0) + seed4 * 10.0,
              subtropicalHighWestExtent: (baseConfig.subtropicalHighWestExtent ?? 125.0) - sign * 12.0,
              westerliesStrength: (baseConfig.westerliesStrength ?? 1.0) * (1.0 + seed3 * 0.7 - 0.35),
              westerliesTroughLon: (baseConfig.westerliesTroughLon ?? 120.0) + seed4 * 12.0,
              betaDriftScale: (baseConfig.betaDriftScale ?? 1.0) * (0.4 + Math.abs(seed1) * 1.4),
              // Weaker outlier cases: high shear, cold SST pool, low rate of intensification (Requirement 1)
              shearScale: isWeakOutlier ? 2.5 : (baseConfig.shearScale ?? 1.0) * (0.35 + Math.abs(seed2) * 1.5),
              sstAnomaly: isWeakOutlier ? -3.8 : (baseConfig.sstAnomaly ?? 0) + seed3 * 3.5,
              intensificationRate: isWeakOutlier ? 0.15 : (baseConfig.intensificationRate ?? 1.0) * (0.35 + Math.abs(seed4) * 1.25),
              randomNoise: isWeakOutlier ? 0.65 : 0.35 + Math.abs(seed1) * 0.65,
              steeringBiasU: seed3 * 1.4,
              steeringBiasV: seed4 * 1.4
            };
          }
        }

        // Apply genesis uncertainty and unique seed for member-level wiggle variance
        if (isEarlyStage) {
          perturbedConfig.randomNoise = (perturbedConfig.randomNoise ?? 0.3) * 1.5;
        }
        perturbedConfig.seed = `member_${i}`;

        const rawForecast = calculateForecastPath(tempTyphoon, perturbedConfig, 360, true);
        const track = rawForecast.map(f => ({
          lat: f.lat,
          lon: f.lon,
          vmax: f.vmax,
          pmin: f.pmin,
          simHour: currentHour + f.simHour
        }));

        let maxVmax = activeState.vmax;
        let minPmin = activeState.pmin;
        track.forEach(pt => {
          if (pt.vmax > maxVmax) maxVmax = pt.vmax;
          if (pt.pmin < minPmin) minPmin = pt.pmin;
        });

        let catStr = "C1";
        if (maxVmax >= 51.0) catStr = "C5";
        else if (maxVmax >= 41.5) catStr = "C4";
        else if (maxVmax >= 32.7) catStr = "C3";
        else if (maxVmax >= 24.5) catStr = "C2";
        else if (maxVmax >= 17.2) catStr = "TS";

        newMembers.push({
          id: "",
          maxVmax: Math.round(maxVmax * 10) / 10,
          minPmin: Math.round(minPmin),
          category: catStr,
          track
        });
      }

      currentStep = end;
      setEnsembleProgress(Math.round((currentStep / totalMembers) * 100));

      if (currentStep < totalMembers) {
        setTimeout(runBatch, 15);
      } else {
        newMembers.sort((a, b) => b.maxVmax - a.maxVmax);
        newMembers.forEach((m, idx) => {
          const numStr = String(idx + 1).padStart(2, "0");
          m.id = `M${numStr}`;
        });
        setEnsembleMembers(newMembers);
        setIsCalculatingEnsemble(false);
      }
    } catch (err) {
      console.error("Ensemble simulation failed:", err);
      setIsCalculatingEnsemble(false);
    }
    };

    setTimeout(runBatch, 15);
  };

  const runEnsembleSimulation = () => runEnsembleSimulationWithCount();

  // Ensemble is calculated manually by clicking the "开始计算" button

  // Parse simulated dates
  const forecastBaseDate = new Date(startDate.getTime() + currentHour * 60 * 60 * 1000);
  const forecastEndDate = new Date(forecastBaseDate.getTime() + forecastHours * 60 * 60 * 1000);

  const formatChineseDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const h = String(date.getHours()).padStart(2, "0");
    return `${y}年${m}月${d}日${h}时`;
  };

  const formatChineseDateShort = (date: Date) => {
    const d = String(date.getDate()).padStart(2, "0");
    const h = String(date.getHours()).padStart(2, "0");
    return `${d}日${h}时`;
  };

  const selectedRes = RESOLUTIONS.find((r) => r.id === resolutionId) || RESOLUTIONS[1];

  // Helper to draw standard NMC style forecast map
  const drawStandardMapOnCanvas = async (canvas: HTMLCanvasElement | null, isMini: boolean = false) => {
    if (typeof setGenerationProgress === "function") setGenerationProgress(5);
    await new Promise(r => setTimeout(r, 0));
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = isMini ? 400 : selectedRes.width;
    const H = isMini ? 300 : selectedRes.height;
    
    // Set internal resolution
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;

    const scale = W / (isMini ? 400 : 1920);
    const finalScale = scale * (isMini ? 1.0 : 1.0); // Baseline scale

    // 1. Clear background (White frame layout)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    if (!geoJsonLoaded) {
      ctx.fillStyle = "#64748b";
      ctx.font = `${14 * scale}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("正在加载地图数据...", W / 2, H / 2);
      return;
    }

    // 2. Define main map bounding frame
    const mapLeft = isMini ? 10 * scale : 80 * scale;
    const mapRight = isMini ? W - 10 * scale : W - 80 * scale;
    const mapTop = isMini ? 10 * scale : 135 * scale;
    const mapBottom = isMini ? H - 10 * scale : H - 180 * scale; 
    const mapWidth = mapRight - mapLeft;
    const mapHeight = mapBottom - mapTop;


    // Default fallback config if props config is undefined
    const defaultConfig: SimulationConfig = config || {
      subtropicalHighEnabled: true,
      subtropicalHighStrength: 1.0,
      subtropicalHighLat: 28.0,
      subtropicalHighLon: 135.0,
      subtropicalHighWestExtent: 125.0,
      westerliesEnabled: true,
      westerliesStrength: 1.0,
      westerliesLat: 30.0,
      westerliesTroughLon: 120.0,
      westerliesTroughDepth: 1.0,
      betaDriftEnabled: true,
      betaDriftScale: 1.0,
      monsoonTroughEnabled: false,
      eastWaveEnabled: false,
      shearScale: 1.0,
      humidityScale: 1.0,
      outflowScale: 1.0,
      dryAirEnabled: false,
      randomNoise: 0,
      sstAnomaly: 0,
      ohcScale: 1.0,
       warmPoolEnabled: true,
      coldEddyEnabled: false,
      airSeaCoupling: 1.0,
      ewrcTrigger: "auto",
      rapidIntensifyEnabled: true,
      landDecayEnabled: true,
      terrainDecayEnabled: true,
      landfallDecayAdjustment: 0,
      landProximityDecayAdjustment: 0,
      etEnabled: true,
      fujiwharaEnabled: true,
      seed: "12345",
      joystickSensitivity: 1.0,
      joystickStrength: 1.0,
      joystickDx: 0,
      joystickDy: 0,
      joystickDragging: false,
      soundEnabled: false,
      soundVolume: 0.5,
      followMainTyphoon: false,
      maxIntensityLimitEnabled: false,
      maxIntensityLimit: 70,
      intensificationRate: 1.0,
      coastlineSource: "natural_earth"
    };

    const ALLOWED_WIND_TIERS = [
      8, 10, 12, 14, 16, 18, 20, 23, 25, 28, 30,
      33, 35, 38, 40, 42, 45, 48, 50, 52, 55, 58,
      60, 62, 65, 68, 70, 72, 75, 78, 80, 82, 85,
      88, 90, 92, 95, 98, 100, 105
    ];

    const roundToAllowedTiers = (v: number): number => {
      let closest = ALLOWED_WIND_TIERS[0];
      let minDiff = Math.abs(v - closest);
      for (let i = 1; i < ALLOWED_WIND_TIERS.length; i++) {
        const diff = Math.abs(v - ALLOWED_WIND_TIERS[i]);
        if (diff < minDiff) {
          minDiff = diff;
          closest = ALLOWED_WIND_TIERS[i];
        }
      }
      return closest;
    };

    const rawActiveState = typhoon.history?.find((h) => h.simHour === currentHour) || typhoon;
    const activeState = {
      ...rawActiveState,
      vmax: roundToAllowedTiers(rawActiveState.vmax)
    };

    const tempTyphoon: Typhoon = {
      ...typhoon,
      lat: activeState.lat,
      lon: activeState.lon,
      vmax: activeState.vmax,
      pmin: activeState.pmin
    };

    // Always generate forecast dynamically matching selected forecastHours
    const rawForecast = calculateForecastPath(tempTyphoon, defaultConfig, forecastHours);
    let filteredForecast = rawForecast
      .map(f => ({
        lat: f.lat,
        lon: f.lon,
        vmax: roundToAllowedTiers(f.vmax),
        pmin: f.pmin,
        simHour: currentHour + f.simHour
      }))
      .filter((f) => f.simHour > currentHour && f.simHour <= currentHour + forecastHours);

    // Dynamic Bounds Calculation based ONLY on current typhoon center & forecast path / probability cone
    const allBoundsPoints: { lat: number; lon: number }[] = [
      { lat: typhoon.lat, lon: typhoon.lon }
    ];

    filteredForecast.forEach((p) => {
      allBoundsPoints.push({ lat: p.lat, lon: p.lon });
      const dt = Math.max(0, p.simHour - currentHour);
      const radiusDeg = Math.min(3.8, 0.028 * dt + 0.45);
      allBoundsPoints.push({ lat: p.lat + radiusDeg, lon: p.lon + radiusDeg });
      allBoundsPoints.push({ lat: p.lat - radiusDeg, lon: p.lon - radiusDeg });
      allBoundsPoints.push({ lat: p.lat + radiusDeg, lon: p.lon - radiusDeg });
      allBoundsPoints.push({ lat: p.lat - radiusDeg, lon: p.lon + radiusDeg });
    });

    let mapMinLat = Math.min(...allBoundsPoints.map((p) => p.lat)) - 4.5;
    let mapMaxLat = Math.max(...allBoundsPoints.map((p) => p.lat)) + 4.5;
    let mapMinLon = Math.min(...allBoundsPoints.map((p) => p.lon)) - 6.5;
    let mapMaxLon = Math.max(...allBoundsPoints.map((p) => p.lon)) + 6.5;

    let latSpan = mapMaxLat - mapMinLat;
    let lonSpan = mapMaxLon - mapMinLon;

    const minLatSpan = 14.0;
    const minLonSpan = 21.0;

    if (latSpan < minLatSpan) {
      const midLat = (mapMinLat + mapMaxLat) / 2;
      mapMinLat = midLat - minLatSpan / 2;
      mapMaxLat = midLat + minLatSpan / 2;
      latSpan = minLatSpan;
    }

    if (lonSpan < minLonSpan) {
      const midLon = (mapMinLon + mapMaxLon) / 2;
      mapMinLon = midLon - minLonSpan / 2;
      mapMaxLon = midLon + minLonSpan / 2;
      lonSpan = minLonSpan;
    }

    // Adjust aspect ratio to match map frame (mapWidth / mapHeight = 1760 / 1155 ≈ 1.5238)
    const targetAspect = mapWidth / mapHeight;
    const currentAspect = lonSpan / latSpan;

    if (currentAspect < targetAspect) {
      const reqLonSpan = latSpan * targetAspect;
      const midLon = (mapMinLon + mapMaxLon) / 2;
      mapMinLon = midLon - reqLonSpan / 2;
      mapMaxLon = midLon + reqLonSpan / 2;
    } else if (currentAspect > targetAspect) {
      const reqLatSpan = lonSpan / targetAspect;
      const midLat = (mapMinLat + mapMaxLat) / 2;
      mapMinLat = midLat - reqLatSpan / 2;
      mapMaxLat = midLat + reqLatSpan / 2;
    }

    // Dynamic equirectangular projection
    const project = (lat: number, lon: number) => {
      const x = mapLeft + ((lon - mapMinLon) / (mapMaxLon - mapMinLon)) * mapWidth;
      const y = mapBottom - ((lat - mapMinLat) / (mapMaxLat - mapMinLat)) * mapHeight;
      return { x, y };
    };

    // 3. Draw outer header title
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    // Main Title
    ctx.fillStyle = "#0f172a"; // dark slate
    ctx.font = `bold ${32 * scale}px "Microsoft YaHei", sans-serif`;
    ctx.fillText(`今年第${typhoonNumber}号台风“${typhoonName}”未来${forecastHours}小时路径概率预报图`, W / 2, 50 * scale);

    // Sub Title
    ctx.fillStyle = "#334155";
    ctx.font = `${20 * scale}px "Microsoft YaHei", sans-serif`;
    const startStr = formatChineseDate(forecastBaseDate);
    const endStr = formatChineseDate(forecastEndDate);
    ctx.fillText(`${startStr}－${endStr}（北京时）`, W / 2, 92 * scale);

    // Green Custom Logo (TRMC)
    ctx.fillStyle = "#10b981"; // Emerald green
    ctx.font = `bold ${32 * scale}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText("TRMC", mapRight, 55 * scale);

    // 4. Clip map rendering to the map frame boundary
    ctx.save();
    ctx.beginPath();
    ctx.rect(mapLeft, mapTop, mapWidth, mapHeight);
    ctx.clip();

    // Map background - Pastel sky blue ocean
    ctx.fillStyle = "#d8f0fa";
    ctx.fillRect(mapLeft, mapTop, mapWidth, mapHeight);

    // 5. Draw Land Polygons from GeoJSON
    if (landGeoJson && landGeoJson.features) {
      ctx.fillStyle = "#faf1df"; // Warm pale beige
      ctx.strokeStyle = "#8295a5"; // Soft grey-blue coastline
      ctx.lineWidth = 0.8 * scale;

      const drawPolygonCoords = (coordinates: number[][][]) => {
        ctx.beginPath();
        coordinates.forEach((ring) => {
          ring.forEach((pt: number[], idx: number) => {
            const lon = pt[0];
            const lat = pt[1];
            const { x, y } = project(lat, lon);
            if (idx === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          });
          ctx.closePath();
        });
        ctx.fill("evenodd");
        ctx.stroke();
      };

      landGeoJson.features.forEach((feat: any) => {
        const geom = feat.geometry;
        if (!geom) return;
        if (geom.type === "Polygon") {
          drawPolygonCoords(geom.coordinates);
        } else if (geom.type === "MultiPolygon") {
          geom.coordinates.forEach((poly: number[][][]) => {
            drawPolygonCoords(poly);
          });
        }
      });
    }

    // Draw Country & Administrative Border Lines from GeoJSON
    if (countriesGeoJson && countriesGeoJson.features) {
      ctx.strokeStyle = "rgba(120, 140, 160, 0.45)"; // Fine boundary line
      ctx.lineWidth = 0.6 * scale;

      const drawBorderCoords = (coordinates: number[][][]) => {
        ctx.beginPath();
        coordinates.forEach((ring) => {
          ring.forEach((pt: number[], idx: number) => {
            const lon = pt[0];
            const lat = pt[1];
            const { x, y } = project(lat, lon);
            if (idx === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          });
          ctx.closePath();
        });
        ctx.stroke();
      };

      countriesGeoJson.features.forEach((feat: any) => {
        const geom = feat.geometry;
        if (!geom) return;
        if (geom.type === "Polygon") {
          drawBorderCoords(geom.coordinates);
        } else if (geom.type === "MultiPolygon") {
          geom.coordinates.forEach((poly: number[][][]) => {
            drawBorderCoords(poly);
          });
        }
      });
    }

    // Draw Major Cities within dynamic bounds
    const CITIES = [
      { name: "台北", lat: 25.03, lon: 121.56 },
      { name: "广州", lat: 23.13, lon: 113.26 },
      { name: "香港", lat: 22.31, lon: 114.17 },
      { name: "福州", lat: 26.07, lon: 119.30 },
      { name: "海口", lat: 20.02, lon: 110.35 },
      { name: "上海", lat: 31.23, lon: 121.47 },
      { name: "马尼拉", lat: 14.60, lon: 120.98 },
      { name: "那霸", lat: 26.21, lon: 127.68 },
      { name: "首尔", lat: 37.56, lon: 126.97 }
    ];

    CITIES.forEach((city) => {
      if (
        city.lat >= mapMinLat - 1 &&
        city.lat <= mapMaxLat + 1 &&
        city.lon >= mapMinLon - 1 &&
        city.lon <= mapMaxLon + 1
      ) {
        const { x, y } = project(city.lat, city.lon);
        ctx.beginPath();
        ctx.arc(x, y, 2.5 * scale, 0, 2 * Math.PI);
        ctx.fillStyle = "#475569";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 0.8 * scale;
        ctx.stroke();

        ctx.fillStyle = "#334155";
        ctx.font = `bold ${12 * scale}px "Microsoft YaHei", sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2.5 * scale;
        ctx.strokeText(` ${city.name}`, x + 3 * scale, y);
        ctx.fillText(` ${city.name}`, x + 3 * scale, y);
      }
    });


    // 6. Draw Lat/Lon Grid Lines
    ctx.strokeStyle = "rgba(71, 85, 105, 0.22)";
    ctx.lineWidth = 1 * scale;
    ctx.setLineDash([4 * scale, 4 * scale]);

    const gridLonStep = (mapMaxLon - mapMinLon) > 30 ? 5 : 2;
    const startLon = Math.ceil(mapMinLon / gridLonStep) * gridLonStep;

    for (let lon = startLon; lon <= mapMaxLon; lon += gridLonStep) {
      const p1 = project(mapMinLat, lon);
      ctx.beginPath();
      ctx.moveTo(p1.x, mapTop);
      ctx.lineTo(p1.x, mapBottom);
      ctx.stroke();

      ctx.fillStyle = "#64748b";
      ctx.font = `${11 * scale}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`${lon}°E`, p1.x, mapBottom + 14 * scale);
    }

    const gridLatStep = (mapMaxLat - mapMinLat) > 20 ? 5 : 2;
    const startLat = Math.ceil(mapMinLat / gridLatStep) * gridLatStep;

    for (let lat = startLat; lat <= mapMaxLat; lat += gridLatStep) {
      const p1 = project(lat, mapMinLon);
      ctx.beginPath();
      ctx.moveTo(mapLeft, p1.y);
      ctx.lineTo(mapRight, p1.y);
      ctx.stroke();

      ctx.fillStyle = "#64748b";
      ctx.font = `${11 * scale}px sans-serif`;
      ctx.textAlign = "right";
      ctx.fillText(`${lat}°N`, mapLeft - 6 * scale, p1.y + 4 * scale);
    }
    ctx.setLineDash([]); // Reset line dash

    // 7. Render Probability Cone (Future Forecast uncertainty Envelope)
    const rawHistory = typhoon.history.filter((h) => h.simHour <= currentHour);
    const history = rawHistory.map(h => ({
      ...h,
      vmax: roundToAllowedTiers(h.vmax)
    }));

    // 7.5 Pre-calculate Forecast Annotation Points (Path Dots + Info Boxes) to ensure perfect matching
    // Interval requirements (Requirement 3):
    // 0~120 hours: 6 hours interval (0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72, 78, 84, 90, 96, 102, 108, 114, 120)
    const targetOffsets = [6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72, 78, 84, 90, 96, 102, 108, 114, 120];
    const annotationPoints: Array<{ lat: number; lon: number; vmax: number; pmin: number; simHour: number; offset: number }> = [];

    // Always include current position (0h offset)
    annotationPoints.push({
      lat: activeState.lat,
      lon: activeState.lon,
      vmax: activeState.vmax,
      pmin: activeState.pmin,
      simHour: currentHour,
      offset: 0
    });

    // Add matching forecast points based on precise interval rules
    targetOffsets.forEach(offset => {
      const targetHour = currentHour + offset;
      if (offset > forecastHours) return;
      
      let closestPt: any = null;
      let minDiff = Infinity;
      filteredForecast.forEach(pt => {
        const diff = Math.abs(pt.simHour - targetHour);
        if (diff < minDiff) {
          minDiff = diff;
          closestPt = pt;
        }
      });
      
      if (closestPt && minDiff < 1.5) {
        if (!annotationPoints.some(p => p.simHour === closestPt!.simHour)) {
          annotationPoints.push({
            ...closestPt,
            offset
          });
        }
      }
    });

    // Combine active position (0h) with future forecast track
    // Filter out points that are too close to each other to prevent tangent jitter
    const rawConeTrack = [
      { lat: activeState.lat, lon: activeState.lon, simHour: currentHour },
      ...filteredForecast
    ];
    
    const allConeTrack: any[] = [];
    if (rawConeTrack.length > 0) {
      allConeTrack.push(rawConeTrack[0]);
      for (let i = 1; i < rawConeTrack.length; i++) {
        const prev = allConeTrack[allConeTrack.length - 1];
        const curr = rawConeTrack[i];
        const dist = Math.sqrt(Math.pow(curr.lat - prev.lat, 2) + Math.pow(curr.lon - prev.lon, 2));
        if (dist > 0.05 || i === rawConeTrack.length - 1) {
          allConeTrack.push(curr);
        }
      }
    }

    if (allConeTrack.length > 1) {
      // Build smooth boundary points (Left side & Right side) with radius expansion
      const leftPts: { x: number; y: number }[] = [];
      const rightPts: { x: number; y: number }[] = [];
      const radiiPx: number[] = [];
      const centerPts: { x: number; y: number }[] = [];

      for (let i = 0; i < allConeTrack.length; i++) {
        const p = project(allConeTrack[i].lat, allConeTrack[i].lon);
        centerPts.push(p);

        const dt = Math.max(0, allConeTrack[i].simHour - currentHour);
        const radiusDeg = Math.min(4.2, 0.032 * dt + 0.45);
        const radiusPt = project(allConeTrack[i].lat, allConeTrack[i].lon + radiusDeg);
        const rPx = Math.abs(radiusPt.x - p.x);
        radiiPx.push(rPx);

        let vX = 0, vY = 0;
        if (i < allConeTrack.length - 1) {
          const nextP = project(allConeTrack[i + 1].lat, allConeTrack[i + 1].lon);
          vX += nextP.x - p.x;
          vY += nextP.y - p.y;
        }
        if (i > 0) {
          const prevP = project(allConeTrack[i - 1].lat, allConeTrack[i - 1].lon);
          vX += p.x - prevP.x;
          vY += p.y - prevP.y;
        }
        const len = Math.sqrt(vX * vX + vY * vY) || 1;
        const nx = -vY / len;
        const ny = vX / len;

        leftPts.push({ x: p.x + nx * rPx, y: p.y + ny * rPx });
        rightPts.push({ x: p.x - nx * rPx, y: p.y - ny * rPx });
      }

      const n = allConeTrack.length - 1;

      // Single unified closed envelope path for smooth fill (Zero overlapping circles/rings)
      ctx.beginPath();
      ctx.moveTo(leftPts[0].x, leftPts[0].y);

      // Left boundary
      for (let i = 1; i <= n; i++) {
        ctx.lineTo(leftPts[i].x, leftPts[i].y);
      }

      // End cap arc (passing through forward tip)
      const angleEndLeft = Math.atan2(leftPts[n].y - centerPts[n].y, leftPts[n].x - centerPts[n].x);
      const angleEndRight = Math.atan2(rightPts[n].y - centerPts[n].y, rightPts[n].x - centerPts[n].x);
      ctx.arc(centerPts[n].x, centerPts[n].y, radiiPx[n], angleEndLeft, angleEndRight, true);

      // Right boundary (reverse)
      for (let i = n - 1; i >= 0; i--) {
        ctx.lineTo(rightPts[i].x, rightPts[i].y);
      }

      // Start cap arc (passing through rear)
      const angleStartRight = Math.atan2(rightPts[0].y - centerPts[0].y, rightPts[0].x - centerPts[0].x);
      const angleStartLeft = Math.atan2(leftPts[0].y - centerPts[0].y, leftPts[0].x - centerPts[0].x);
      ctx.arc(centerPts[0].x, centerPts[0].y, radiiPx[0], angleStartRight, angleStartLeft, true);

      ctx.closePath();

      // 1. Cone Fill - Single uniform translucent fill
      ctx.fillStyle = "rgba(175, 115, 150, 0.40)";
      ctx.fill();


    }

    // Restore map clip
    ctx.restore();

    // 8. Draw Grid Labels Outside the frame (So they aren't clipped!)
    ctx.fillStyle = "#334155";
    ctx.font = `${13 * scale}px "Courier New", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Longitude labels
    for (let lon = 95; lon <= 135; lon += 5) {
      const p = project(MIN_LAT, lon);
      // Bottom axis
      ctx.fillText(`${lon}° E`, p.x, mapBottom + 16 * scale);
      // Top axis
      ctx.fillText(`${lon}° E`, p.x, mapTop - 12 * scale);
    }

    // Latitude labels
    ctx.textAlign = "right";
    for (let lat = 15; lat <= 35; lat += 5) {
      const p = project(lat, MIN_LON);
      // Left axis
      ctx.fillText(`${lat}° N`, mapLeft - 10 * scale, p.y);
    }

    ctx.textAlign = "left";
    for (let lat = 15; lat <= 35; lat += 5) {
      const p = project(lat, MAX_LON);
      // Right axis
      ctx.fillText(`${lat}° N`, mapRight + 10 * scale, p.y);
    }

    // Clip back into map for path and dots drawing
    ctx.save();
    ctx.beginPath();
    ctx.rect(mapLeft, mapTop, mapWidth, mapHeight);
    ctx.clip();

    // 9. Draw History Path
    if (history.length > 1) {
      ctx.beginPath();
      const pStart = project(history[0].lat, history[0].lon);
      ctx.moveTo(pStart.x, pStart.y);
      for (let i = 1; i < history.length; i++) {
        const p = project(history[i].lat, history[i].lon);
        ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = "#e84393"; // Magenta track line
      ctx.lineWidth = 4 * scale;
      ctx.stroke();
    }

    // 10. Draw Forecast Path line
    const maxDotHour = annotationPoints.length > 0 
      ? Math.max(...annotationPoints.map(p => p.simHour)) 
      : currentHour;

    if (filteredForecast.length > 0) {
      ctx.beginPath();
      const pStart = project(activeState.lat, activeState.lon);
      ctx.moveTo(pStart.x, pStart.y);
      filteredForecast.forEach((f) => {
        if (f.simHour > maxDotHour) return; // Truncate at last forecast dot (Requirement 2)
        const p = project(f.lat, f.lon);
        ctx.lineTo(p.x, p.y);
      });
      ctx.strokeStyle = "#9f1239"; // Deep crimson forecast track
      ctx.lineWidth = 2.5 * scale;
      ctx.setLineDash([2 * scale, 3 * scale]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Helper to get Category Name and Color (Matching reference template)
    const getCatDetails = (vmax: number) => {
      if (vmax < 17.2) return { name: "热带低压", color: "#eab308", border: "#a16207" };
      if (vmax < 24.5) return { name: "热带风暴", color: "#3b82f6", border: "#1d4ed8" };
      if (vmax < 32.7) return { name: "强热带风暴", color: "#22c55e", border: "#15803d" };
      if (vmax < 41.5) return { name: "台风", color: "#f97316", border: "#c2410c" };
      if (vmax < 51.0) return { name: "强台风", color: "#ec4899", border: "#be185d" };
      return { name: "超强台风", color: "#ef4444", border: "#b91c1c" };
    };

    // Draw dots for historical path points based on user selected historyInterval (1h or 3h)
    history.forEach((h, idx) => {
      const showDot = (h.simHour % historyInterval === 0) || idx === history.length - 1;
      if (showDot) {
        const { x, y } = project(h.lat, h.lon);
        const { color } = getCatDetails(h.vmax);

        ctx.beginPath();
        ctx.arc(x, y, 5 * scale, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1 * scale;
        ctx.stroke();
      }
    });

    // Helper to check if landfall is in Greater China (Mainland China, Hong Kong, Macao, Taiwan)
    const isChinaLandfallRegion = (lat: number, lon: number): boolean => {
      const countryInfo = getLandfallCountryGeoJson(lat, lon);
      const country = countryInfo?.country || "";
      const admin = countryInfo?.admin || "";

      // Foreign country keywords to exclude
      const foreignKeywords = [
        "菲律宾", "Philippines",
        "日本", "Japan",
        "越南", "Vietnam", "Viet Nam",
        "韩国", "Korea", "South Korea",
        "朝鲜", "North Korea",
        "老挝", "Laos",
        "柬埔寨", "Cambodia",
        "泰国", "Thailand",
        "马来西亚", "Malaysia",
        "印度尼西亚", "Indonesia",
        "俄罗斯", "Russia"
      ];

      for (const kw of foreignKeywords) {
        if (country.toLowerCase().includes(kw.toLowerCase()) || admin.toLowerCase().includes(kw.toLowerCase())) {
          return false;
        }
      }

      const detailedName = getDetailedLandName(lat, lon, country, admin);
      for (const kw of foreignKeywords) {
        if (detailedName.includes(kw)) {
          return false;
        }
      }

      // Explicit China / HK / Macao / Taiwan check
      if (
        country === "中国" || country === "China" ||
        country === "香港" || country === "Hong Kong" ||
        country === "澳门" || country === "Macau" || country === "Macao" ||
        country === "台湾" || country === "Taiwan" ||
        admin === "中国" || admin === "China" ||
        admin === "香港" || admin === "Hong Kong" ||
        admin === "澳门" || admin === "Macau" || admin === "Macao" ||
        admin === "台湾" || admin === "Taiwan"
      ) {
        return true;
      }

      // Spatial bounding box check for Mainland China, Hainan, Hong Kong, Macao, Taiwan
      // Latitude: 18.0°N to 53.5°N, Longitude: 108.0°E to 123.5°E
      if (lat >= 18.0 && lat <= 53.5 && lon >= 108.0 && lon <= 123.5) {
        if (lat < 20.5 && lon > 120.8) return false; // Philippines Batanes/Luzon
        if (lat < 21.5 && lon < 109.0) return false; // Vietnam coast
        return true;
      }

      return false;
    };

    // Helper to identify landfall location using precision city resolver
    const getMajorLandfallLocation = (lat: number, lon: number): string | null => {
      if (!checkPointOnLandGeoJson(lat, lon)) return null;
      if (!isChinaLandfallRegion(lat, lon)) return null;

      const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
      if (osmNamesMap[key]) {
        return `在${osmNamesMap[key]}沿海登陆`;
      }

      // Fuzzy match for OSM names if exact coordinate key is missing (Requirement: better landfall precision)
      const osmKeys = Object.keys(osmNamesMap);
      let bestKey = null;
      let minDistance = 0.15; // Increased tolerance (~15km) to better catch nearby fetched city names
      for (const k of osmKeys) {
        const [kLat, kLon] = k.split(",").map(Number);
        const dist = Math.sqrt(Math.pow(lat - kLat, 2) + Math.pow(lon - kLon, 2));
        if (dist < minDistance) {
          minDistance = dist;
          bestKey = k;
        }
      }
      if (bestKey) {
        return `在${osmNamesMap[bestKey]}沿海登陆`;
      }

      const detailedCityName = getDetailedLandName(lat, lon, "", "");
      if (detailedCityName) {
        return `在${detailedCityName}沿海登陆`;
      }
      return `在沿海地区登陆 (${lon.toFixed(1)}°E, ${lat.toFixed(1)}°N)`;
    };

    // Detect Landfall Points along forecast path
    const landfallEvents: Array<{
      lat: number;
      lon: number;
      vmax: number;
      simHour: number;
      timeStr: string;
      speedStr: string;
      catStr: string;
    }> = [];

    // Track whether typhoon is currently on land.
    // CRITICAL FIX: If activeState is already on land, wasPrevOnLand is TRUE,
    // so moving along land or exiting to sea will NOT trigger false "landfall".
    let wasPrevOnLand = checkPointOnLandGeoJson(activeState.lat, activeState.lon);

    for (let i = 0; i < filteredForecast.length; i++) {
      const ptRaw = filteredForecast[i];
      const isPtOnLand = checkPointOnLandGeoJson(ptRaw.lat, ptRaw.lon);

      // Landfall occurs strictly when transitioning from SEA (wasPrevOnLand === false) to LAND (isPtOnLand === true)
      if (!wasPrevOnLand && isPtOnLand) {
        // Refine landfall point via interpolation for better visual alignment with coastline
        let landfallLat = ptRaw.lat;
        let landfallLon = ptRaw.lon;
        
        if (i > 0) {
          const prevPt = filteredForecast[i-1];
          // Linear scan for the transition point (40 sub-steps for very high precision)
          for (let s = 1; s <= 40; s++) {
            const ratio = s / 40;
            const interLat = prevPt.lat + (ptRaw.lat - prevPt.lat) * ratio;
            const interLon = prevPt.lon + (ptRaw.lon - prevPt.lon) * ratio;
            if (checkPointOnLandGeoJson(interLat, interLon)) {
              landfallLat = interLat;
              landfallLon = interLon;
              break;
            }
          }
        }

        const chinaLoc = getMajorLandfallLocation(landfallLat, landfallLon);
        if (chinaLoc) {
          const lfDate = new Date(startDate.getTime() + ptRaw.simHour * 60 * 60 * 1000);
          const dayVal = lfDate.getDate();
          const hourVal = lfDate.getHours();

          let timeOfDay = "";
          if (hourVal >= 18 || hourVal <= 2) {
            const nextDay = new Date(lfDate.getTime() + 12 * 60 * 60 * 1000).getDate();
            timeOfDay = `${dayVal}日夜间到${nextDay}日早晨`;
          } else if (hourVal >= 3 && hourVal <= 8) {
            timeOfDay = `${dayVal}日早晨到中午`;
          } else if (hourVal >= 9 && hourVal <= 13) {
            timeOfDay = `${dayVal}日中午前后`;
          } else if (hourVal >= 14 && hourVal <= 17) {
            timeOfDay = `${dayVal}日下午到傍晚`;
          } else {
            timeOfDay = `${dayVal}日${hourVal}时前后`;
          }

          const fullTimeStr = `${timeOfDay}${chinaLoc}`;

          const vmax = roundToAllowedTiers(ptRaw.vmax);
          const vIdx = ALLOWED_WIND_TIERS.indexOf(vmax);
          let vMin = vmax;
          let vMax = vmax;
          if (vIdx !== -1) {
            const candidateMin = ALLOWED_WIND_TIERS[Math.max(0, vIdx - 1)];
            const candidateMax = ALLOWED_WIND_TIERS[Math.min(ALLOWED_WIND_TIERS.length - 1, vIdx + 1)];
            if (candidateMax - candidateMin <= 6) {
              vMin = candidateMin;
              vMax = candidateMax;
            } else {
              vMin = candidateMin;
              vMax = vmax;
              if (vMax - vMin > 6) {
                vMin = vmax;
                vMax = candidateMax;
                if (vMax - vMin > 6) {
                  vMax = vmax;
                }
              }
            }
          }

          const fMin = getWindForceCategory(vMin);
          const fMax = getWindForceCategory(vMax);
          const forceStr = (fMin === fMax) ? `${fMin}级` : `${fMin}-${fMax}级`;

          landfallEvents.push({
            lat: landfallLat,
            lon: landfallLon,
            vmax: ptRaw.vmax,
            simHour: ptRaw.simHour,
            timeStr: `预计${timeOfDay}`,
            speedStr: `在${chinaLoc}沿海登陆`,
            catStr: `${vMin}-${vMax}米/秒 (${forceStr})`
          });
        }
      }

      wasPrevOnLand = isPtOnLand;
    }


    // Draw dots for forecast points (only at pre-calculated target offsets, excluding 0)
    annotationPoints.forEach((f) => {
      if (f.offset === 0) return; // Present position is drawn separately with a larger symbol
      const { x, y } = project(f.lat, f.lon);
      const { color } = getCatDetails(f.vmax);

      ctx.beginPath();
      ctx.arc(x, y, 6 * scale, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1.2 * scale;
      ctx.stroke();
    });

    // 11. Draw Typhoon Symbol at current/present position
    const currentXY = project(activeState.lat, activeState.lon);
    
    // Draw current position highlighted circle
    ctx.beginPath();
    ctx.arc(currentXY.x, currentXY.y, 9 * scale, 0, 2 * Math.PI);
    ctx.fillStyle = getCatDetails(activeState.vmax).color;
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2 * scale;
    ctx.stroke();

    // Draw custom cyclone arms
    ctx.strokeStyle = getCatDetails(activeState.vmax).color;
    ctx.lineWidth = 2.5 * scale;
    ctx.beginPath();
    ctx.arc(currentXY.x, currentXY.y, 14 * scale, Math.PI * 0.15, Math.PI * 0.75);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(currentXY.x, currentXY.y, 14 * scale, Math.PI * 1.15, Math.PI * 1.75);
    ctx.stroke();

    // Add Typhoon Name text in magenta with white background outline
    ctx.font = `bold ${15 * scale}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    
    const textX = currentXY.x + 18 * scale;
    const textY = currentXY.y;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3 * scale;
    ctx.strokeText(`${typhoonName} (${typhoonNumber})`, textX, textY);
    ctx.fillStyle = "#ff00ff";
    ctx.fillText(`${typhoonName} (${typhoonNumber})`, textX, textY);

    // End map clip
    ctx.restore();

    // 12. Draw Callouts / Label Boxes with Pointer Lines
    ctx.save();
    ctx.beginPath();
    ctx.rect(mapLeft, mapTop, mapWidth, mapHeight);
    ctx.clip();

    interface CalloutBox {
      id: string;
      targetX: number;
      targetY: number;
      boxW: number;
      boxH: number;
      isLandfall?: boolean;
      isCurrentCenter?: boolean;
      line1: string;
      line2: string;
      line3: string;
      simHour?: number;
      side?: "left" | "right";
      boxX?: number;
      boxY?: number;
    }

    const calloutBoxes: CalloutBox[] = [];

    // Helper to calculate exact box width based on text line lengths
    const calcBoxWidth = (l1: string, l2: string, l3: string, isLf?: boolean) => {
      ctx.save();
      ctx.font = isLf ? `bold ${18.5 * scale}px "Microsoft YaHei", sans-serif` : `bold ${17.5 * scale}px "Microsoft YaHei", sans-serif`;
      const w1 = ctx.measureText(l1).width;
      ctx.font = isLf ? `bold ${17 * scale}px "Microsoft YaHei", sans-serif` : `${16 * scale}px "Microsoft YaHei", sans-serif`;
      const w2 = ctx.measureText(l2).width;
      const w3 = ctx.measureText(l3).width;
      ctx.restore();
      const maxW = Math.max(w1, w2, w3);
      return Math.ceil(maxW + 32 * scale);
    };

    if (showInfoBoxes) {
      // 1. Current Typhoon Center Info Box ("现状" box)
      if (showCenterBox) {
        const currentVmax = Math.round(activeState.vmax);
        const currentForce = getWindForceCategory(activeState.vmax);
        const { name: currentCatName } = getCatDetails(activeState.vmax);
        const centerLine1 = `${formatChineseDateShort(forecastBaseDate)}`;
        const centerLine2 = `${currentVmax}m/s, ${currentForce}级`;
        const centerLine3 = `${currentCatName}`;
        const centerBoxW = calcBoxWidth(centerLine1, centerLine2, centerLine3, false);

        calloutBoxes.push({
          id: "current_center_box",
          targetX: currentXY.x,
          targetY: currentXY.y,
          boxW: Math.max(145 * scale, centerBoxW),
          boxH: 86 * scale,
          isCurrentCenter: true,
          line1: centerLine1,
          line2: centerLine2,
          line3: centerLine3,
          simHour: currentHour,
          side: "right"
        });
      }

      // 2. Forecast Milestone Points
      if (showForecastBox) {
        let calloutOffsets = [12, 24, 48, 72, 96, 120];
        if (boxDensity === 1) calloutOffsets = [48, 96, 120];
        else if (boxDensity === 2) calloutOffsets = [24, 48, 72, 96, 120];
        else if (boxDensity === 3) calloutOffsets = [12, 24, 48, 72, 96, 120];
        else if (boxDensity === 4) calloutOffsets = [12, 24, 36, 48, 60, 72, 84, 96, 120];
        else if (boxDensity === 5) calloutOffsets = [6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72, 78, 84, 90, 96, 102, 108, 114, 120];
        
        calloutOffsets = calloutOffsets.filter(o => o <= forecastHours);
        const milestonePoints = annotationPoints.filter((pt) => pt.offset > 0 && calloutOffsets.includes(pt.offset));

        milestonePoints.forEach((pt, idx) => {
          const fDate = new Date(startDate.getTime() + pt.simHour * 60 * 60 * 1000);
          const timeStr = formatChineseDateShort(fDate);
          const vmaxMps = Math.round(pt.vmax);
          const forceVal = getWindForceCategory(pt.vmax);
          const { name: catName } = getCatDetails(pt.vmax);

          let catNameSuffix = catName;
          if (catName !== "热带低压" && !catName.endsWith("级")) {
            catNameSuffix = catName + "级";
          }

          const ptXY = project(pt.lat, pt.lon);
          const line1 = timeStr;
          const line2 = `${vmaxMps}m/s, ${forceVal}级`;
          const line3 = `${catNameSuffix}`;
          const calculatedW = calcBoxWidth(line1, line2, line3, false);

          calloutBoxes.push({
            id: `pt_${idx}_${pt.simHour}`,
            targetX: ptXY.x,
            targetY: ptXY.y,
            boxW: Math.max(145 * scale, calculatedW),
            boxH: 86 * scale,
            line1,
            line2,
            line3,
            simHour: pt.simHour
          });
        });
      }

      // 3. Special Landfall Callout Boxes
      if (showLandfallBox) {
        landfallEvents.forEach((lf, idx) => {
          const lfXY = project(lf.lat, lf.lon);
          const line1 = lf.timeStr;
          const line2 = lf.speedStr;
          const line3 = lf.catStr;
          const calculatedW = calcBoxWidth(line1, line2, line3, true);

          calloutBoxes.push({
            id: `landfall_box_${idx}`,
            targetX: lfXY.x,
            targetY: lfXY.y,
            boxW: Math.max(210 * scale, calculatedW),
            boxH: 92 * scale,
            isLandfall: true,
            line1,
            line2,
            line3,
            simHour: lf.simHour
          });
        });
      }
    }

    // Sort boxes along track time
    calloutBoxes.sort((a, b) => (a.simHour || 0) - (b.simHour || 0));

    // Assign sides and calculate initial normal-based positions (Requirement 1)
    calloutBoxes.forEach((box, idx) => {
      // Calculate track heading at this point
      let dx = 0, dy = 0;
      if (idx < calloutBoxes.length - 1) {
        dx = calloutBoxes[idx + 1].targetX - box.targetX;
        dy = calloutBoxes[idx + 1].targetY - box.targetY;
      } else if (idx > 0) {
        dx = box.targetX - calloutBoxes[idx - 1].targetX;
        dy = box.targetY - calloutBoxes[idx - 1].targetY;
      }

      const mag = Math.sqrt(dx * dx + dy * dy) || 1;
      const ux = dx / mag;
      const uy = dy / mag;

      // Normal vector (-uy, ux) points "left" of track
      const nx = -uy;
      const ny = ux;
      
      // Strict alternating sides for balance
      box.side = idx % 2 === 0 ? "right" : "left";
      const sideFactor = box.side === "left" ? 1 : -1;

      // Distance from track
      const offsetDist = (360 + (idx % 2) * 120) * scale;
      
      // Initial placement
      box.boxX = box.targetX + nx * offsetDist * sideFactor - box.boxW / 2;
      box.boxY = box.targetY + ny * (offsetDist * 0.45) * sideFactor - box.boxH / 2;
    });

    // Multi-iteration Spring-Mass Relaxation Loop to resolve all overlaps
    for (let iter = 0; iter < 450; iter++) {
      // 1. Pull each box towards its original preferred target area but with flexibility
      calloutBoxes.forEach((box, idx) => {
        let dx = 0, dy = 0;
        if (idx < calloutBoxes.length - 1) {
          dx = calloutBoxes[idx + 1].targetX - box.targetX;
          dy = calloutBoxes[idx + 1].targetY - box.targetY;
        } else if (idx > 0) {
          dx = box.targetX - calloutBoxes[idx - 1].targetX;
          dy = box.targetY - calloutBoxes[idx - 1].targetY;
        }
        const mag = Math.sqrt(dx * dx + dy * dy) || 1;
        const ux = dx / mag;
        const uy = dy / mag;
        const nx = -uy;
        const ny = ux;
        const sideFactor = box.side === "left" ? 1 : -1;

        const offsetDist = (360 + (idx % 2) * 120) * scale;
        const preferredX = box.targetX + nx * offsetDist * sideFactor - box.boxW / 2;
        const preferredY = box.targetY + ny * (offsetDist * 0.45) * sideFactor - box.boxH / 2;
        
        // Soft pull
        box.boxX = (box.boxX ?? preferredX) + (preferredX - (box.boxX ?? preferredX)) * 0.04;
        box.boxY = (box.boxY ?? preferredY) + (preferredY - (box.boxY ?? preferredY)) * 0.04;
      });

      // 2. Collision and Order constraints
      for (let i = 0; i < calloutBoxes.length; i++) {
        for (let j = 0; j < calloutBoxes.length; j++) {
          if (i === j) continue;
          const boxA = calloutBoxes[i];
          const boxB = calloutBoxes[j];
          
          const gapX = 60 * scale;
          const gapY = 40 * scale;
          
          // Same side vertical order constraint (Prevent line crossing)
          if (boxA.side === boxB.side) {
            // Determine preferred vertical order based on track sequence (simHour)
            // If i < j (A is earlier on track), A should be "before" B in the y-direction of the track movement
            // However, a simpler and more robust way is to just push them apart if they overlap 
            // AND ensure they don't swap relative positions from their initial placement.
            const distY = boxB.boxY - boxA.boxY;
            const minDist = (boxA.boxH / 2 + boxB.boxH / 2 + gapY);
            
            // If they are on the same side, box with smaller simHour should generally be higher or lower depending on track.
            // But strict vertical separation is most important for "tidy" appearance.
            if (Math.abs(distY) < minDist) {
              const push = (minDist - Math.abs(distY)) * 0.65;
              const sign = distY >= 0 ? 1 : -1;
              boxB.boxY += sign * push;
              boxA.boxY -= sign * push;
            }
          }

          // General overlap prevention
          const rectA = { x1: boxA.boxX!, y1: boxA.boxY!, x2: boxA.boxX! + boxA.boxW, y2: boxA.boxY! + boxA.boxH };
          const rectB = { x1: boxB.boxX!, y1: boxB.boxY!, x2: boxB.boxX! + boxB.boxW, y2: boxB.boxY! + boxB.boxH };
          
          if (!(rectA.x2 + gapX < rectB.x1 || rectA.x1 > rectB.x2 + gapX || rectA.y2 + gapY < rectB.y1 || rectA.y1 > rectB.y2 + gapY)) {
            const centerAY = rectA.y1 + boxA.boxH / 2;
            const centerBY = rectB.y1 + boxB.boxH / 2;
            const overlapY = (boxA.boxH + boxB.boxH) / 2 + gapY - Math.abs(centerAY - centerBY);
            const signY = centerAY >= centerBY ? 1 : -1;
            
            const centerAX = rectA.x1 + boxA.boxW / 2;
            const centerBX = rectB.x1 + boxB.boxW / 2;
            const overlapX = (boxA.boxW + boxB.boxW) / 2 + gapX - Math.abs(centerAX - centerBX);
            const signX = centerAX >= centerBX ? 1 : -1;

            if (overlapY < overlapX) {
              boxA.boxY! += signY * overlapY * 0.6;
              boxB.boxY! -= signY * overlapY * 0.6;
            } else {
              boxA.boxX! += signX * overlapX * 0.6;
              boxB.boxX! -= signX * overlapX * 0.6;
            }
          }
        }
      }

      // 3. Keep within map bounds
      calloutBoxes.forEach(box => {
        box.boxX = Math.max(mapLeft + 10 * scale, Math.min(mapRight - box.boxW - 10 * scale, box.boxX!));
        box.boxY = Math.max(mapTop + 10 * scale, Math.min(mapBottom - box.boxH - 10 * scale, box.boxY!));
      });

      // 3. Push away from track line segments (Requirement 1: prevent obscuring path)
      calloutBoxes.forEach(box => {
        const boxCenterX = box.boxX! + box.boxW / 2;
        const boxCenterY = box.boxY! + box.boxH / 2;
        
        for (let i = 0; i < allConeTrack.length - 1; i++) {
          const p1 = project(allConeTrack[i].lat, allConeTrack[i].lon);
          const p2 = project(allConeTrack[i+1].lat, allConeTrack[i+1].lon);
          
          const l2 = Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2);
          if (l2 === 0) continue;
          let t = ((boxCenterX - p1.x) * (p2.x - p1.x) + (boxCenterY - p1.y) * (p2.y - p1.y)) / l2;
          t = Math.max(0, Math.min(1, t));
          const closestX = p1.x + t * (p2.x - p1.x);
          const closestY = p1.y + t * (p2.y - p1.y);
          
          const dx = boxCenterX - closestX;
          const dy = boxCenterY - closestY;
          const distSq = dx * dx + dy * dy;
          const minDist = 200 * scale; // Increased distance from forecast path line
          if (distSq < minDist * minDist) {
            const dist = Math.sqrt(distSq) || 0.1;
            const overlap = minDist - dist;
            box.boxX! += (dx / dist) * overlap * 0.7;
            box.boxY! += (dy / dist) * overlap * 0.7;
          }
        }
      });

      // 4. Constrain to map borders
      calloutBoxes.forEach((box) => {
        if (box.boxY! < mapTop + 25 * scale) box.boxY = mapTop + 25 * scale;
        if (box.boxY! + box.boxH > mapBottom - 25 * scale) box.boxY = mapBottom - 25 * scale - box.boxH;
        if (box.boxX! < mapLeft + 15 * scale) box.boxX = mapLeft + 15 * scale;
        if (box.boxX! + box.boxW > mapRight - 15 * scale) box.boxX = mapRight - 15 * scale - box.boxW;
      });
    }

    // Render the callout boxes and indicator leader lines
    calloutBoxes.forEach((box) => {
      const boxX = box.boxX ?? box.targetX;
      const boxY = box.boxY ?? box.targetY;

      let strokeColor = "#0f172a";
      if (box.isLandfall) {
        strokeColor = "#dc2626";
      } else if (box.isCurrentCenter) {
        strokeColor = "#0284c7";
      }

      // Connect leader line directly from forecast track point to closest box edge center (NO red dot at end)
      const boxCenterX = boxX + box.boxW / 2;
      const boxCenterY = boxY + box.boxH / 2;
      
      let connectorX = boxCenterX;
      let connectorY = boxCenterY;

      if (box.targetY < boxY) {
        connectorY = boxY; // top edge
      } else if (box.targetY > boxY + box.boxH) {
        connectorY = boxY + box.boxH; // bottom edge
      }

      if (box.targetX < boxX) {
        connectorX = boxX; // left edge
      } else if (box.targetX > boxX + box.boxW) {
        connectorX = boxX + box.boxW; // right edge
      }

      ctx.beginPath();
      ctx.moveTo(box.targetX, box.targetY);
      
      // Preferred straight line directly to connector
      // Only use elbow if it avoids self-intersection or is needed for specific styling
      // Here we prioritize straight lines as requested
      ctx.lineTo(connectorX, connectorY);

      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1.2 * scale;
      ctx.setLineDash([]);
      ctx.stroke();

      // Draw Box Container
      ctx.fillStyle = box.isCurrentCenter ? "#f0f9ff" : "#ffffff";
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = (box.isLandfall || box.isCurrentCenter ? 1.6 : 1) * scale;
      ctx.beginPath();
      ctx.rect(boxX, boxY, box.boxW, box.boxH);
      ctx.fill();
      ctx.stroke();

      // Render Text Lines
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const centerX = boxX + box.boxW / 2;

      if (box.isLandfall) {
        // Landfall box text styling
        ctx.fillStyle = "#000000";
        ctx.font = `bold ${18.5 * scale}px "Microsoft YaHei", sans-serif`;
        ctx.fillText(box.line1, centerX, boxY + 24 * scale);

        ctx.font = `bold ${17 * scale}px "Microsoft YaHei", sans-serif`;
        ctx.fillText(box.line2, centerX, boxY + 50 * scale);

        ctx.font = `bold ${17 * scale}px "Microsoft YaHei", sans-serif`;
        ctx.fillText(box.line3, centerX, boxY + 72 * scale);
      } else if (box.isCurrentCenter) {
        // Current center box styling
        ctx.fillStyle = "#000000";
        ctx.font = `bold ${18 * scale}px "Microsoft YaHei", sans-serif`;
        ctx.fillText(box.line1, centerX, boxY + 22 * scale);

        ctx.font = `bold ${16.5 * scale}px "Microsoft YaHei", sans-serif`;
        ctx.fillText(box.line2, centerX, boxY + 47 * scale);

        ctx.font = `bold ${16.5 * scale}px "Microsoft YaHei", sans-serif`;
        ctx.fillText(box.line3, centerX, boxY + 68 * scale);
      } else {
        // Regular box text styling
        ctx.fillStyle = "#000000";
        ctx.font = `bold ${17.5 * scale}px "Microsoft YaHei", sans-serif`;
        ctx.fillText(box.line1, centerX, boxY + 22 * scale);

        ctx.font = `${16 * scale}px "Microsoft YaHei", sans-serif`;
        ctx.fillText(box.line2, centerX, boxY + 47 * scale);

        ctx.font = `${16 * scale}px "Microsoft YaHei", sans-serif`;
        ctx.fillText(box.line3, centerX, boxY + 68 * scale);
      }
    });

    // 13. Draw Top-Right Production Info Badge (气象台制作信息框)
    const badgeW = 185 * scale;
    const badgeH = 65 * scale;
    const badgeX = mapRight - 15 * scale - badgeW;
    const badgeY = mapTop + 15 * scale;

    ctx.fillStyle = "rgba(224, 242, 254, 0.9)"; // Light blue (sky-100) with 90% opacity
    ctx.strokeStyle = "#0284c7"; // blue outline (sky-600)
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 5 * scale);
    } else {
      ctx.rect(badgeX, badgeY, badgeW, badgeH);
    }
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    // Line 1: Station Title
    ctx.fillStyle = "#1e3a8a"; // deep navy blue
    ctx.font = `bold ${13 * scale}px "Microsoft YaHei", sans-serif`;
    ctx.fillText("晚风气象台", badgeX + badgeW / 2, badgeY + 18 * scale);

    // Line 2: Production Date
    const formatProductionDate = (date: Date) => {
      const m = date.getMonth() + 1;
      const d = date.getDate();
      const h = date.getHours();
      return `${m}月${d}日${h}时制作`;
    };
    ctx.fillStyle = "#1e3a8a";
    ctx.font = `bold ${12 * scale}px "Microsoft YaHei", sans-serif`;
    ctx.fillText(formatProductionDate(forecastBaseDate), badgeX + badgeW / 2, badgeY + 45 * scale);

    // 14. Draw Custom Generic Cyclone Badge in top-left corner
    const badgeLeftX = mapLeft + 45 * scale;
    const badgeLeftY = mapTop + 45 * scale;
    ctx.beginPath();
    ctx.arc(badgeLeftX, badgeLeftY, 28 * scale, 0, 2 * Math.PI);
    ctx.fillStyle = "#0369a1"; // deep ocean blue
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2 * scale;
    ctx.stroke();

    // Draw generic visual swirl inside badge
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3.5 * scale;
    ctx.beginPath();
    ctx.arc(badgeLeftX, badgeLeftY, 15 * scale, 0, Math.PI * 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(badgeLeftX, badgeLeftY, 15 * scale, Math.PI, Math.PI * 1.9);
    ctx.stroke();

    ctx.restore();

    // 15. Draw Legend Box at the bottom (Matching Reference Template)
    const legX = mapLeft;
    const legY = H - 160 * scale;
    const legW = mapWidth;
    const legH = 140 * scale;

    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1.8 * scale;
    ctx.strokeRect(legX, legY, legW, legH);
    ctx.fillRect(legX, legY, legW, legH);

    // Right side Audit Section ("审图号" column with vertical dividing line)
    const auditColW = 200 * scale;
    ctx.beginPath();
    ctx.moveTo(legX + legW - auditColW, legY);
    ctx.lineTo(legX + legW - auditColW, legY + legH);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1.5 * scale;
    ctx.stroke();

    ctx.fillStyle = "#0f172a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${16 * scale}px "Microsoft YaHei", sans-serif`;
    ctx.fillText("审图号:", legX + legW - auditColW / 2, legY + 42 * scale);
    ctx.font = `bold ${16 * scale}px "Microsoft YaHei", sans-serif`;
    ctx.fillText(`GS (2019) 3082号`, legX + legW - auditColW / 2, legY + 88 * scale);

    // Left side Legend Title
    ctx.fillStyle = "#0f172a";
    ctx.font = `bold ${22 * scale}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("图例:", legX + 20 * scale, legY + legH / 2);

    // Row 1: Shaded Cone Symbol + Explanation
    const coneLegendX = legX + 110 * scale;
    const coneLegendY = legY + 20 * scale;
    ctx.fillStyle = "rgba(175, 115, 150, 0.45)";
    ctx.fillRect(coneLegendX, coneLegendY, 44 * scale, 22 * scale);


    ctx.fillStyle = "#1e293b";
    ctx.font = `bold ${15 * scale}px "Microsoft YaHei", sans-serif`;
    ctx.fillText(
      "台风中心未来可能经过的区域，并不表示台风大小及影响范围，灾害性天气也可能出现在阴影区以外",
      coneLegendX + 54 * scale,
      coneLegendY + 11 * scale
    );

    // Categories List (Row 2 & Row 3)
    const categoriesList = [
      { name: "热带低压(10.8~17.1m/s)", color: "#eab308" },
      { name: "热带风暴(17.2~24.4m/s)", color: "#3b82f6" },
      { name: "强热带风暴(24.5~32.6m/s)", color: "#22c55e" },
      { name: "台风(32.7~41.4m/s)", color: "#f97316" },
      { name: "强台风(41.5~50.9m/s)", color: "#ec4899" },
      { name: "超强台风(≥51m/s)", color: "#ef4444" }
    ];

    ctx.font = `bold ${15 * scale}px "Microsoft YaHei", sans-serif`;
    categoriesList.forEach((cat, index) => {
      const colIdx = index % 3;
      const rowIdx = Math.floor(index / 3);

      const itemX = legX + 110 * scale + colIdx * 320 * scale;
      const itemY = legY + 68 * scale + rowIdx * 38 * scale;

      // Draw dot
      ctx.beginPath();
      ctx.arc(itemX, itemY, 7.5 * scale, 0, 2 * Math.PI);
      ctx.fillStyle = cat.color;
      ctx.fill();
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1.2 * scale;
      ctx.stroke();

      // Draw label
      ctx.fillStyle = "#0f172a";
      ctx.fillText(cat.name, itemX + 15 * scale, itemY);
    });

    // Audit and Legal info
    ctx.fillStyle = "#64748b";
    ctx.font = `${11 * scale}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(`审图号: ${auditNumber}`, legX + legW - 15 * scale, legY + 12 * scale);
  };

  // Pre-generate a 1167x667 land mask array for instant O(1) grid land-checks during meteorological simulation
  const createLandMask = (landGeoJson: any) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1167;
    canvas.height = 667;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#000000"; // Sea is black
    ctx.fillRect(0, 0, 1167, 667);

    if (landGeoJson && landGeoJson.features) {
      ctx.fillStyle = "#ffffff"; // Land is white
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;

      const project = (lon: number, lat: number) => {
        const x = ((lon - 110.0) / (145.0 - 110.0)) * 1167;
        const y = ((30.0 - lat) / (30.0 - 10.0)) * 667;
        return { x, y };
      };

      const drawPoly = (coordinates: number[][][]) => {
        ctx.beginPath();
        coordinates.forEach((ring) => {
          ring.forEach((pt, idx) => {
            const { x, y } = project(pt[0], pt[1]);
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
        });
        ctx.fill();
        ctx.stroke();
      };

      landGeoJson.features.forEach((feat: any) => {
        if (!feat.geometry) return;
        if (feat.geometry.type === "Polygon") drawPoly(feat.geometry.coordinates);
        else if (feat.geometry.type === "MultiPolygon") {
          feat.geometry.coordinates.forEach((p: any) => drawPoly(p));
        }
      });
    }
    return ctx.getImageData(0, 0, 1167, 667).data;
  };

  const drawMeteorologicalMapOnCanvas = (
    canvas: HTMLCanvasElement | null,
    product: "olr" | "dbz" | "wv",
    vws: number,
    sst: number
  ) => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 1167;
    const H = 667;
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;

    // Clear background
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, W, H);

    // Initialize ImageData
    const imgData = ctx.createImageData(W, H);
    const data = imgData.data;

    // Cache or build land mask
    if (!landMaskRef.current && landGeoJson) {
      landMaskRef.current = createLandMask(landGeoJson);
    }
    const landMask = landMaskRef.current;

    // Typhoon state
    const activeState = typhoon.history?.find((h) => h.simHour === currentHour) || typhoon;
    const tyLat = activeState.lat;
    const tyLon = activeState.lon;
    const vmax = activeState.vmax || 35;
    const pmin = activeState.pmin || 970;
    const RMW = Math.max(15, 55 - (vmax - 17) * 0.65); // Core Eye / RMW range: 15km - 55km

    const dir = activeState.direction !== undefined ? activeState.direction : 290;
    const dir_rad = ((90 - dir) * Math.PI) / 180;

    const isEwrc = activeState.ewrcState && activeState.ewrcState !== "none";

    // VWS convection boost
    let VWS_gain = 0;
    if (vws >= 6) {
      VWS_gain = 0.25 * Math.min(1.0, (vws - 3) / 6.0);
    }

    // Grid Loop
    for (let r = 0; r < H; r++) {
      const lat = 30.0 - r * 0.03;
      const cosLat = Math.cos((lat * Math.PI) / 180);
      const dy = (lat - tyLat) * 111.12;

      for (let c = 0; c < W; c++) {
        const lon = 110.0 + c * 0.03;
        const dx = (lon - tyLon) * 111.12 * cosLat;

        // Radial distance r in km
        const d_km = Math.sqrt(dx * dx + dy * dy);

        // Check land
        const isLandPoint = landMask ? landMask[(r * W + c) * 4] > 127 : false;
        const elevation = isLandPoint ? getProceduralElevation(lat, lon) : 0;

        // Willoughby wind profile
        let b = 1.6;
        if (vmax >= 50) b = 1.2;
        else if (vmax >= 42) b = 1.4;
        else if (vmax >= 32) b = 1.6;
        else b = 1.8;

        const x_rmw = d_km / RMW;
        const V_raw = vmax * x_rmw * Math.exp(-(1 / b) * (Math.pow(x_rmw, b) - 1));

        // Asymmetry
        const angle_grid = Math.atan2(dy, dx);
        const gain_factor = Math.max(0, Math.cos(angle_grid - (dir_rad + Math.PI / 2)));
        const asymmetry = 1.0 + gain_factor * VWS_gain;
        let V_gradient = V_raw * asymmetry;

        if (isLandPoint) {
          V_gradient *= 0.65 * Math.exp(-elevation / 3000.0);
        }

        // Upward velocity omega calculation
        let omega = 0;

        if (isEwrc) {
          // Double eyewall
          const innerRing = Math.exp(-Math.pow((d_km - RMW) / (RMW * 0.35), 2)) * 6.5;
          const outerRing = Math.exp(-Math.pow((d_km - RMW * 2.4) / (RMW * 0.3), 2)) * 5.0;
          let eyeSubs = 0;
          if (d_km < RMW * 0.6) {
            eyeSubs = -3.0 * (1.0 - d_km / (RMW * 0.6));
          } else if (d_km > RMW * 1.3 && d_km < RMW * 2.0) {
            const moatCenter = RMW * 1.65;
            eyeSubs = -2.5 * (1.0 - Math.abs(d_km - moatCenter) / (RMW * 0.35));
          }
          omega = innerRing + outerRing + eyeSubs;
        } else {
          // Single eyewall
          const eyewallRing = Math.exp(-Math.pow((d_km - RMW) / (RMW * 0.45), 2)) * 8.5;
          let eyeSubs = 0;
          if (d_km < RMW * 0.7) {
            eyeSubs = -4.0 * (1.0 - d_km / (RMW * 0.7));
          }
          omega = eyewallRing + eyeSubs;
        }

        // Spiral Rainbands (Logarithmic spiral)
        const spiralPhase = angle_grid - Math.log(Math.max(0.1, d_km / RMW)) * 2.3;
        const band1 = Math.sin(spiralPhase * 3.0);
        const band2 = Math.sin(spiralPhase * 1.2 - 2.0);
        const noiseVal = Math.sin(lon * 4.5) * Math.cos(lat * 4.5) * 0.35 + Math.sin(lon * 23.0) * Math.cos(lat * 23.0) * 0.15;
        const bandVal = Math.max(0, band1 * 0.55 + band2 * 0.45 + noiseVal);

        const spiralOmega = bandVal * 4.5 * Math.exp(-d_km / 380.0) * (d_km > RMW * 0.7 ? 1.0 : 0.0);
        omega += spiralOmega;

        if (omega > 0) {
          omega *= asymmetry;
        }

        // NE Quadrant Outflow cirrus canopy
        const isOutflowSector = angle_grid >= 0 && angle_grid <= Math.PI * 0.75;
        const outflowCanopy = isOutflowSector
          ? Math.max(0, Math.sin(angle_grid)) * 2.5 * Math.exp(-d_km / 600.0)
          : 0;

        // Mountain orographic forced lifting
        let omega_oro = 0;
        if (isLandPoint && elevation > 50) {
          const wind_angle = angle_grid + Math.PI / 2 + 0.25;
          const u = V_gradient * Math.cos(wind_angle);
          const v = V_gradient * Math.sin(wind_angle);

          const el_east = getProceduralElevation(lat, lon + 0.04);
          const el_north = getProceduralElevation(lat + 0.04, lon);
          const dedx = (el_east - elevation) / 4.4;
          const dedy = (el_north - elevation) / 4.4;

          omega_oro = (u * dedx + v * dedy) * 0.015;
          if (omega_oro > 0) {
            omega += Math.min(6.0, omega_oro);
          }
        }

        // Convection constraints (SST and Land cutoff)
        let convectionLimit = 1.0;
        if (sst < 26.5) {
          convectionLimit = Math.max(0.1, (sst - 20.0) / 6.5);
        }
        if (isLandPoint) {
          convectionLimit *= 0.5;
        }
        omega *= convectionLimit;

        const pixelIdx = (r * W + c) * 4;

        if (product === "olr") {
          let t_olr = 270.0;
          if (omega > 0) {
            t_olr -= omega * 11.5;
          } else {
            t_olr -= omega * 3.5;
          }
          t_olr -= outflowCanopy * 8.0;
          t_olr = Math.max(180, Math.min(285, t_olr));
          t_olr += (Math.random() - 0.5) * 1.5;

          let rgb = [0, 0, 48];
          if (t_olr < 193) rgb = [208, 0, 192];
          else if (t_olr < 203) rgb = [75, 0, 130];
          else if (t_olr < 213) rgb = [0, 0, 139];
          else if (t_olr < 223) rgb = [0, 0, 255];
          else if (t_olr < 233) rgb = [65, 105, 225];
          else if (t_olr < 243) rgb = [0, 255, 255];
          else if (t_olr < 253) rgb = [173, 216, 230];
          else if (t_olr < 263) rgb = [169, 169, 169];
          else if (t_olr < 273) rgb = [85, 85, 85];
          else {
            if (isLandPoint) {
              const elFactor = Math.min(1.0, elevation / 3000.0);
              rgb = [
                Math.round(45 + elFactor * 30),
                Math.round(75 - elFactor * 20),
                Math.round(40 - elFactor * 15)
              ];
            } else {
              rgb = [20, 24, 48];
            }
          }

          data[pixelIdx] = rgb[0];
          data[pixelIdx + 1] = rgb[1];
          data[pixelIdx + 2] = rgb[2];
          data[pixelIdx + 3] = 255;

        } else if (product === "dbz") {
          let dbz = 0;
          if (omega > 0.05) {
            dbz = 12.0 + omega * 6.8 + (V_gradient / vmax) * 6.0;
          }
          if (d_km < RMW * 0.7) {
            dbz *= (d_km / (RMW * 0.7));
          }
          dbz = Math.max(0, Math.min(75, dbz));

          let rgb = [5, 8, 12];
          if (dbz >= 10 && dbz < 15) rgb = [153, 255, 255];
          else if (dbz >= 15 && dbz < 20) rgb = [0, 225, 225];
          else if (dbz >= 20 && dbz < 25) rgb = [0, 160, 0];
          else if (dbz >= 25 && dbz < 30) rgb = [0, 216, 0];
          else if (dbz >= 30 && dbz < 35) rgb = [0, 144, 0];
          else if (dbz >= 35 && dbz < 40) rgb = [255, 255, 0];
          else if (dbz >= 40 && dbz < 45) rgb = [231, 192, 0];
          else if (dbz >= 45 && dbz < 50) rgb = [255, 144, 0];
          else if (dbz >= 50 && dbz < 55) rgb = [255, 0, 0];
          else if (dbz >= 55 && dbz < 60) rgb = [208, 0, 0];
          else if (dbz >= 60 && dbz < 65) rgb = [255, 0, 255];
          else if (dbz >= 65 && dbz < 70) rgb = [144, 0, 208];
          else if (dbz >= 70) rgb = [255, 255, 255];

          data[pixelIdx] = rgb[0];
          data[pixelIdx + 1] = rgb[1];
          data[pixelIdx + 2] = rgb[2];
          data[pixelIdx + 3] = 255;

        } else if (product === "wv") {
          let humidity = 65.0;
          if (dx < 0 && dy < 0) {
            humidity += 20.0 * Math.max(0, 1.0 - Math.abs(dy - dx) / 500.0);
          }
          if (dx > 0 && Math.abs(dy) < 300) {
            humidity += 15.0 * Math.exp(-Math.abs(dy) / 200.0);
          }
          humidity += omega * 4.5;
          if (d_km < RMW * 0.7) {
            humidity -= 35.0 * (1.0 - d_km / (RMW * 0.7));
          }
          humidity = Math.max(20, Math.min(100, humidity));

          let rgb = [139, 69, 19];
          if (humidity > 90) rgb = [0, 0, 139];
          else if (humidity > 80) rgb = [0, 128, 255];
          else if (humidity > 70) rgb = [0, 200, 200];
          else if (humidity > 60) rgb = [144, 238, 144];
          else if (humidity > 50) rgb = [240, 230, 140];
          else if (humidity > 40) rgb = [255, 165, 0];
          else rgb = [160, 82, 45];

          data[pixelIdx] = rgb[0];
          data[pixelIdx + 1] = rgb[1];
          data[pixelIdx + 2] = rgb[2];
          data[pixelIdx + 3] = 255;
        }
      }
    }

    // Put image pixels on canvas
    ctx.putImageData(imgData, 0, 0);

    // Coastlines Overlay
    ctx.save();
    if (landGeoJson && landGeoJson.features) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
      ctx.lineWidth = 1.2;

      const project = (lon: number, lat: number) => {
        const x = ((lon - 110.0) / (145.0 - 110.0)) * W;
        const y = ((30.0 - lat) / (30.0 - 10.0)) * H;
        return { x, y };
      };

      const drawPoly = (coordinates: number[][][]) => {
        ctx.beginPath();
        coordinates.forEach((ring) => {
          ring.forEach((pt, idx) => {
            const { x, y } = project(pt[0], pt[1]);
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
        });
        ctx.stroke();
      };

      landGeoJson.features.forEach((feat: any) => {
        if (!feat.geometry) return;
        if (feat.geometry.type === "Polygon") drawPoly(feat.geometry.coordinates);
        else if (feat.geometry.type === "MultiPolygon") {
          feat.geometry.coordinates.forEach((p: any) => drawPoly(p));
        }
      });
    }

    // Grid Overlays
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 0.8;
    ctx.font = `11px sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";

    for (let lon = 110; lon <= 145; lon += 5) {
      const x = ((lon - 110.0) / (145.0 - 110.0)) * W;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
      ctx.fillText(`${lon}°E`, x + 5, H - 10);
    }

    for (let lat = 10; lat <= 30; lat += 5) {
      const y = ((30.0 - lat) / (30.0 - 10.0)) * H;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.fillText(`${lat}°N`, 10, y - 5);
    }

    // Label Board
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(15, 15, 340, 115);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(15, 15, 340, 115);

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold 14px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = "left";
    let prodName = "";
    if (product === "olr") prodName = "向外长波辐射 (OLR) 红外模拟云图";
    else if (product === "dbz") prodName = "组合反射率 (DBZ) 模拟雷达拼图";
    else if (product === "wv") prodName = "850hPa 底层水汽输送场扫描图";
    ctx.fillText(prodName, 25, 38);

    ctx.font = `12px "Microsoft YaHei", sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.fillText(`台风: ${typhoonName} (${typhoonNumber || "----"})`, 25, 60);
    ctx.fillText(`中心位置: ${tyLat.toFixed(2)}°N, ${tyLon.toFixed(2)}°E`, 25, 78);
    ctx.fillText(`核心强度: ${Math.round(pmin)} hPa, ${Math.round(vmax)} m/s`, 25, 96);
    ctx.fillText(`物理调节: VWS=${vws}m/s, SST=${sst}°C`, 25, 114);

    // Color Bar Legend
    const barX = W - 220;
    const barY = H - 45;
    const barW = 200;
    const barH = 15;

    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(barX - 10, barY - 20, barW + 20, barH + 35);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.strokeRect(barX, barY, barW, barH);

    const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);

    if (product === "olr") {
      ctx.fillStyle = "#ffffff";
      ctx.font = `10px sans-serif`;
      ctx.fillText("强对流 (180K)", barX, barY - 6);
      ctx.fillText("晴空 (285K)", barX + barW - 65, barY - 6);

      grad.addColorStop(0, "#d000c0");
      grad.addColorStop(0.12, "#4b0082");
      grad.addColorStop(0.25, "#0000ff");
      grad.addColorStop(0.38, "#00ffff");
      grad.addColorStop(0.5, "#add8e6");
      grad.addColorStop(0.65, "#a9a9a9");
      grad.addColorStop(0.8, "#555555");
      grad.addColorStop(1.0, "#141830");
    } else if (product === "dbz") {
      ctx.fillStyle = "#ffffff";
      ctx.font = `10px sans-serif`;
      ctx.fillText("10 dBZ", barX, barY - 6);
      ctx.fillText("70 dBZ", barX + barW - 35, barY - 6);

      grad.addColorStop(0, "#99ffff");
      grad.addColorStop(0.15, "#00e1e1");
      grad.addColorStop(0.3, "#00d800");
      grad.addColorStop(0.45, "#ffff00");
      grad.addColorStop(0.6, "#ff9000");
      grad.addColorStop(0.75, "#ff0000");
      grad.addColorStop(0.9, "#ff00ff");
      grad.addColorStop(1.0, "#ffffff");
    } else if (product === "wv") {
      ctx.fillStyle = "#ffffff";
      ctx.font = `10px sans-serif`;
      ctx.fillText("干燥 (20%)", barX, barY - 6);
      ctx.fillText("湿润 (100%)", barX + barW - 60, barY - 6);

      grad.addColorStop(0, "#8b4513");
      grad.addColorStop(0.2, "#ffa500");
      grad.addColorStop(0.4, "#f0e68c");
      grad.addColorStop(0.6, "#90ee90");
      grad.addColorStop(0.8, "#00ffff");
      grad.addColorStop(1.0, "#00008b");
    }

    ctx.fillStyle = grad;
    ctx.fillRect(barX, barY, barW, barH);

    ctx.restore();
  };

  // Helper to draw JMA Style (Black Map)
  const drawJmaMapOnCanvas = (canvas: HTMLCanvasElement | null, isMini: boolean = false) => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = isMini ? 400 : selectedRes.width;
    const H = isMini ? 300 : selectedRes.height;

    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;

    const scale = W / (isMini ? 400 : 1920);

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, W, H);

    if (!geoJsonLoaded) {
      ctx.fillStyle = "#ffffff";
      ctx.font = `${14 * scale}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("JMA 图像生成中：正在加载地图数据...", W / 2, H / 2);
      return;
    }

    const mapLeft = isMini ? 10 * scale : 60 * scale;
    const mapRight = isMini ? W - 10 * scale : W - 60 * scale;
    const mapTop = isMini ? 10 * scale : 60 * scale;
    const mapBottom = isMini ? H - 10 * scale : H - 60 * scale;
    const mapWidth = mapRight - mapLeft;
    const mapHeight = mapBottom - mapTop;

    const activeState = typhoon.history?.find((h) => h.simHour === currentHour) || typhoon;
    const tempTyphoon: Typhoon = {
      ...typhoon,
      lat: activeState.lat,
      lon: activeState.lon,
      vmax: activeState.vmax,
      pmin: activeState.pmin
    };

    const defaultConfig: SimulationConfig = activeState.configSnapshot || config || {
      subtropicalHighEnabled: true,
      subtropicalHighStrength: 1.0,
      subtropicalHighLat: 28.0,
      subtropicalHighLon: 135.0,
      subtropicalHighWestExtent: 125.0,
      westerliesEnabled: true,
      westerliesStrength: 1.0,
      westerliesLat: 30.0,
      westerliesTroughLon: 120.0,
      westerliesTroughDepth: 1.0,
      betaDriftEnabled: true,
      betaDriftScale: 1.0,
      monsoonTroughEnabled: false,
      eastWaveEnabled: false,
      shearScale: 1.0,
      humidityScale: 1.0,
      outflowScale: 1.0,
      dryAirEnabled: false,
      randomNoise: 0,
      sstAnomaly: 0,
      ohcScale: 1.0,
      warmPoolEnabled: true,
      coldEddyEnabled: false,
      airSeaCoupling: 1.0,
      ewrcTrigger: "auto",
      rapidIntensifyEnabled: true,
      landDecayEnabled: true,
      terrainDecayEnabled: true,
      landfallDecayAdjustment: 0,
      landProximityDecayAdjustment: 0,
      etEnabled: true,
      fujiwharaEnabled: true,
      seed: "12345",
      joystickSensitivity: 1.0,
      joystickStrength: 1.0,
      joystickDx: 0,
      joystickDy: 0,
      joystickDragging: false,
      soundEnabled: false,
      soundVolume: 0.5,
      followMainTyphoon: false,
      maxIntensityLimitEnabled: false,
      maxIntensityLimit: 70,
      intensificationRate: 1.0,
      coastlineSource: "natural_earth"
    };

    const rawForecast = calculateForecastPath(tempTyphoon, defaultConfig, forecastHours);
    const filteredForecast = rawForecast
      .map(f => ({
        lat: f.lat,
        lon: f.lon,
        vmax: f.vmax,
        pmin: f.pmin,
        simHour: currentHour + f.simHour
      }))
      .filter((f) => f.simHour > currentHour && f.simHour <= currentHour + forecastHours);

    const allBoundsPoints: { lat: number; lon: number }[] = [
      { lat: activeState.lat, lon: activeState.lon }
    ];

    filteredForecast.forEach((p) => {
      allBoundsPoints.push({ lat: p.lat, lon: p.lon });
      const dt = Math.max(0, p.simHour - currentHour);
      const radiusDeg = Math.min(3.8, 0.028 * dt + 0.45);
      allBoundsPoints.push({ lat: p.lat + radiusDeg, lon: p.lon + radiusDeg });
      allBoundsPoints.push({ lat: p.lat - radiusDeg, lon: p.lon - radiusDeg });
      allBoundsPoints.push({ lat: p.lat + radiusDeg, lon: p.lon - radiusDeg });
      allBoundsPoints.push({ lat: p.lat - radiusDeg, lon: p.lon + radiusDeg });
    });

    let mapMinLat = Math.min(...allBoundsPoints.map((p) => p.lat)) - 4.5;
    let mapMaxLat = Math.max(...allBoundsPoints.map((p) => p.lat)) + 4.5;
    let mapMinLon = Math.min(...allBoundsPoints.map((p) => p.lon)) - 6.5;
    let mapMaxLon = Math.max(...allBoundsPoints.map((p) => p.lon)) + 6.5;

    // Requirement 6: Clamp mapMinLon for ensemble to prevent extreme westward member ballooning
    const minAllowedLon = activeState.lon - 15.0;
    if (mapMinLon < minAllowedLon) {
      mapMinLon = minAllowedLon;
    }

    let latSpan = mapMaxLat - mapMinLat;
    let lonSpan = mapMaxLon - mapMinLon;

    const minLatSpan = 14.0;
    const minLonSpan = 21.0;

    if (latSpan < minLatSpan) {
      const midLat = (mapMinLat + mapMaxLat) / 2;
      mapMinLat = midLat - minLatSpan / 2;
      mapMaxLat = midLat + minLatSpan / 2;
      latSpan = minLatSpan;
    }

    if (lonSpan < minLonSpan) {
      const midLon = (mapMinLon + mapMaxLon) / 2;
      mapMinLon = midLon - minLonSpan / 2;
      mapMaxLon = midLon + minLonSpan / 2;
      lonSpan = minLonSpan;
    }

    const targetAspect = mapWidth / mapHeight;
    const currentAspect = lonSpan / latSpan;

    if (currentAspect < targetAspect) {
      const reqLonSpan = latSpan * targetAspect;
      const midLon = (mapMinLon + mapMaxLon) / 2;
      mapMinLon = midLon - reqLonSpan / 2;
      mapMaxLon = midLon + reqLonSpan / 2;
    } else if (currentAspect > targetAspect) {
      const reqLatSpan = lonSpan / targetAspect;
      const midLat = (mapMinLat + mapMaxLat) / 2;
      mapMinLat = midLat - reqLatSpan / 2;
      mapMaxLat = midLat + reqLatSpan / 2;
    }

    const project = (lat: number, lon: number) => {
      const x = mapLeft + ((lon - mapMinLon) / (mapMaxLon - mapMinLon)) * mapWidth;
      const y = mapBottom - ((lat - mapMinLat) / (mapMaxLat - mapMinLat)) * mapHeight;
      return { x, y };
    };

    ctx.save();
    ctx.beginPath();
    ctx.rect(mapLeft, mapTop, mapWidth, mapHeight);
    ctx.clip();

    // 1. Coastlines
    if (landGeoJson && landGeoJson.features) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = 1.0 * scale;

      const drawPoly = (coordinates: number[][][]) => {
        ctx.beginPath();
        coordinates.forEach((ring) => {
          ring.forEach((pt, idx) => {
            const { x, y } = project(pt[1], pt[0]);
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
        });
        ctx.stroke();
      };

      landGeoJson.features.forEach((feat: any) => {
        if (!feat.geometry) return;
        if (feat.geometry.type === "Polygon") drawPoly(feat.geometry.coordinates);
        else if (feat.geometry.type === "MultiPolygon") {
          feat.geometry.coordinates.forEach((p: any) => drawPoly(p));
        }
      });
    }

    // 2. Grids
    ctx.strokeStyle = "rgba(255, 255, 255, 0.30)";
    ctx.lineWidth = 0.8 * scale;
    ctx.font = `${11 * scale}px sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.70)";

    const lonStep = (mapMaxLon - mapMinLon) > 25 ? 10 : 5;
    for (let lon = Math.ceil(mapMinLon / lonStep) * lonStep; lon <= mapMaxLon; lon += lonStep) {
      const p1 = project(mapMinLat, lon);
      ctx.beginPath();
      ctx.moveTo(p1.x, mapTop);
      ctx.lineTo(p1.x, mapBottom);
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.fillText(`${lon}°`, p1.x, mapBottom + 16 * scale);
    }

    const latStep = (mapMaxLat - mapMinLat) > 20 ? 10 : 5;
    for (let lat = Math.ceil(mapMinLat / latStep) * latStep; lat <= mapMaxLat; lat += latStep) {
      const p1 = project(lat, mapMinLon);
      ctx.beginPath();
      ctx.moveTo(mapLeft, p1.y);
      ctx.lineTo(mapRight, p1.y);
      ctx.stroke();
      ctx.textAlign = "right";
      ctx.fillText(`${lat}°`, mapLeft - 8 * scale, p1.y + 4 * scale);
    }

    // 3. Past Track
    const history = (typhoon.history || []).filter(h => h.simHour <= currentHour);
    if (history.length > 1) {
      ctx.strokeStyle = "#00cc44";
      ctx.lineWidth = 2.0 * scale;
      ctx.beginPath();
      history.forEach((h, idx) => {
        const { x, y } = project(h.lat, h.lon);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      history.forEach((h) => {
        const { x, y } = project(h.lat, h.lon);
        ctx.beginPath();
        ctx.arc(x, y, 3.0 * scale, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = "#00cc44";
        ctx.lineWidth = 1.2 * scale;
        ctx.stroke();
      });
    }

    // 4. Forecast track, 予報円 (Probability Circles) & 包絡線 (Envelope Lines)
    const pxPerKm = mapWidth / ((mapMaxLon - mapMinLon) * 111.12);

    const currP = project(activeState.lat, activeState.lon);
    const forecastCircles: Array<{ x: number; y: number; r7Px: number; r10Px: number; day: number; hour: number }> = [];

    // Current position circles (for envelope start point)
    let currR7Km = 0;
    if (activeState.r7) {
      currR7Km = (activeState.r7.ne + activeState.r7.se + activeState.r7.sw + activeState.r7.nw) / 4;
    } else {
      currR7Km = activeState.vmax >= 17.2 ? (activeState.vmax * 5.2 + 60) : 120;
    }

    let currR10Km = 0;
    if (activeState.r10) {
      currR10Km = (activeState.r10.ne + activeState.r10.se + activeState.r10.sw + activeState.r10.nw) / 4;
    } else {
      currR10Km = activeState.vmax >= 24.5 ? (activeState.vmax * 3.8 + 20) : 0;
    }

    const currR7Px = Math.max(12 * scale, currR7Km * pxPerKm);
    const currR10Px = currR10Km > 0 ? Math.max(6 * scale, currR10Km * pxPerKm) : 0;
    forecastCircles.push({ x: currP.x, y: currP.y, r7Px: currR7Px, r10Px: currR10Px, day: forecastBaseDate.getDate(), hour: forecastBaseDate.getHours() });

    if (filteredForecast.length > 0) {
      // Forecast center track line (cyan)
      ctx.strokeStyle = "#00cccc";
      ctx.lineWidth = 2.0 * scale;
      ctx.setLineDash([4 * scale, 3 * scale]);
      ctx.beginPath();
      ctx.moveTo(currP.x, currP.y);

      filteredForecast.forEach((f) => {
        const { x, y } = project(f.lat, f.lon);
        ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);

      const intervals = [24, 48, 72, 96, 120, 144];
      intervals.forEach(dt => {
        const targetH = currentHour + dt;
        const pt = filteredForecast.find(f => Math.abs(f.simHour - targetH) < 3.5);
        if (pt) {
          const { x, y } = project(pt.lat, pt.lon);
          const fR7Km = pt.vmax >= 17.2 ? (pt.vmax * 5.2 + 60) : 120;
          const fR10Km = pt.vmax >= 24.5 ? (pt.vmax * 3.8 + 20) : 0;
          const pxPerDeg = mapWidth / (mapMaxLon - mapMinLon);
          const r7Px = Math.max(16 * scale, (fR7Km / 111.12) * pxPerDeg);
          const r10Px = fR10Km > 0 ? Math.max(8 * scale, (fR10Km / 111.12) * pxPerDeg) : 0;

          const targetDate = new Date(forecastBaseDate.getTime() + dt * 3600000);
          forecastCircles.push({
            x,
            y,
            r7Px,
            r10Px,
            day: targetDate.getDate(),
            hour: targetDate.getHours()
          });
        }
      });

      // Draw Tangent Envelope Lines (包絡線) connecting outer edges (7级风圈) of consecutive forecast circles
      if (forecastCircles.length >= 2 && jmaShowCone) {
        ctx.strokeStyle = "#00cccc";
        ctx.lineWidth = 1.8 * scale;

        // Top tangent curve
        ctx.beginPath();
        for (let i = 0; i < forecastCircles.length - 1; i++) {
          const c1 = forecastCircles[i];
          const c2 = forecastCircles[i + 1];
          const dx = c2.x - c1.x;
          const dy = c2.y - c1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            const angle = Math.atan2(dy, dx);
            const dr = (c2.r7Px - c1.r7Px) / dist;
            const alpha = Math.asin(Math.max(-1, Math.min(1, dr)));

            const tx1 = c1.x + c1.r7Px * Math.cos(angle + Math.PI / 2 + alpha);
            const ty1 = c1.y + c1.r7Px * Math.sin(angle + Math.PI / 2 + alpha);
            const tx2 = c2.x + c2.r7Px * Math.cos(angle + Math.PI / 2 + alpha);
            const ty2 = c2.y + c2.r7Px * Math.sin(angle + Math.PI / 2 + alpha);

            if (i === 0) ctx.moveTo(tx1, ty1);
            ctx.lineTo(tx2, ty2);
          }
        }
        ctx.stroke();

        // Bottom tangent curve
        ctx.beginPath();
        for (let i = 0; i < forecastCircles.length - 1; i++) {
          const c1 = forecastCircles[i];
          const c2 = forecastCircles[i + 1];
          const dx = c2.x - c1.x;
          const dy = c2.y - c1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            const angle = Math.atan2(dy, dx);
            const dr = (c2.r7Px - c1.r7Px) / dist;
            const alpha = Math.asin(Math.max(-1, Math.min(1, dr)));

            const bx1 = c1.x + c1.r7Px * Math.cos(angle - Math.PI / 2 - alpha);
            const by1 = c1.y + c1.r7Px * Math.sin(angle - Math.PI / 2 - alpha);
            const bx2 = c2.x + c2.r7Px * Math.cos(angle - Math.PI / 2 - alpha);
            const by2 = c2.y + c2.r7Px * Math.sin(angle - Math.PI / 2 - alpha);

            if (i === 0) ctx.moveTo(bx1, by1);
            ctx.lineTo(bx2, by2);
          }
        }
        ctx.stroke();
      }

      // Draw Double White Circles for each forecast point (Outer 7-level and Inner 10-level forecast wind rings)
      for (let i = 1; i < forecastCircles.length; i++) {
        const fc = forecastCircles[i];

        // Outer white circle (7级强风域 / 予報円)
        ctx.beginPath();
        ctx.arc(fc.x, fc.y, fc.r7Px, 0, Math.PI * 2);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.6 * scale;
        ctx.stroke();

        // Inner white circle (10级暴風域)
        ctx.beginPath();
        ctx.arc(fc.x, fc.y, fc.r10Px, 0, Math.PI * 2);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.2 * scale;
        ctx.stroke();

        ctx.fillStyle = "#00ffff";
        ctx.font = `bold ${12 * scale}px "Microsoft YaHei", sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(`${fc.day}日${fc.hour}時`, fc.x, fc.y + 4 * scale);
      }
    }

    // 5. Current Position Wind Circles & Label
    const currPt = project(activeState.lat, activeState.lon);

    const r7Px = Math.max(15 * scale, currR7Km * pxPerKm);
    const r10Px = currR10Km > 0 ? Math.max(8 * scale, currR10Km * pxPerKm) : 0;

    const op = jmaWindOpacity ?? 0.35;

    // Draw 15m/s (7-level) Orange Wind Circle
    ctx.beginPath();
    ctx.arc(currPt.x, currPt.y, r7Px, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(229, 129, 0, ${op})`;
    ctx.fill();
    ctx.strokeStyle = "#e58100";
    ctx.lineWidth = 1.6 * scale;
    ctx.stroke();

    // Draw 25m/s (10-level) Red Wind Circle
    if (r10Px > 0) {
      ctx.beginPath();
      ctx.arc(currPt.x, currPt.y, Math.min(r7Px - 3 * scale, r10Px), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(204, 0, 0, ${op + 0.1})`;
      ctx.fill();
      ctx.strokeStyle = "#cc0000";
      ctx.lineWidth = 1.6 * scale;
      ctx.stroke();
    }

    // Center Red/White Dot
    ctx.beginPath();
    ctx.arc(currPt.x, currPt.y, 4 * scale, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    const m = forecastBaseDate.getMonth() + 1;
    const d = forecastBaseDate.getDate();
    const h = String(forecastBaseDate.getHours()).padStart(2, "0");
    const jmaTag = `${typhoonNumber}号 ${m}/${d} ${h}:00 ${Math.round(activeState.pmin)}hPa ${Math.round(activeState.vmax)}m/s`;

    ctx.fillStyle = "#00ffff";
    ctx.font = `bold ${13 * scale}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(jmaTag, currPt.x + 12 * scale, currPt.y + 4 * scale);

    ctx.restore(); // Restore clip

    // 6. JMA Top-Left Official Map Legend (1:1 from Screenshot_20260801_165749.jpg)
    const legX = mapLeft + 15 * scale;
    const legY = mapTop + 15 * scale;

    // Outer Orange circle (15m/s) & Inner Red circle (25m/s)
    ctx.beginPath();
    ctx.arc(legX + 18 * scale, legY + 22 * scale, 12 * scale, 0, Math.PI * 2);
    ctx.fillStyle = "#e58100";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(legX + 18 * scale, legY + 22 * scale, 6 * scale, 0, Math.PI * 2);
    ctx.fillStyle = "#cc0000";
    ctx.fill();

    // Legend Text
    ctx.textAlign = "left";
    ctx.font = `bold ${13 * scale}px "Microsoft YaHei", sans-serif`;

    ctx.fillStyle = "#e58100";
    ctx.fillText("風速15m/s以上の強風域", legX + 38 * scale, legY + 16 * scale);

    ctx.fillStyle = "#cc0000";
    ctx.fillText("風速25m/s以上の暴風域", legX + 38 * scale, legY + 32 * scale);
  };

  // =========================================================================================
  // RAIN FORECAST
  // =========================================================================================
  const drawRainForecastOnCanvas = async (canvas: HTMLCanvasElement | null, isMini: boolean = false) => {
    if (!canvas || !geoJsonLoaded) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = isMini ? 400 : selectedRes.width;
    const H = isMini ? 300 : selectedRes.height;
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;

    const scale = W / 1920;
    
    // Fill white
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // Map bounds
    const mapLeft = 80 * scale;
    const mapRight = W - 80 * scale;
    const mapTop = 160 * scale;
    const mapBottom = H - 80 * scale;
    const mapWidth = mapRight - mapLeft;
    const mapHeight = mapBottom - mapTop;

    // Draw Title
    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.font = `${36 * scale}px sans-serif`;
    const fHours = forecastHours; // Use user selected hours
    ctx.fillText(`今年第${typhoonNumber}号台风 “${typhoonName}” 未来${fHours}小时降水预报图`, W / 2, 70 * scale);
    
    // Time
    const activeState = typhoon.history?.find((h) => h.simHour === currentHour) || typhoon;
    const startTime = new Date(startDate.getTime() + currentHour * 3600000);
    const endTime = new Date(startTime.getTime() + fHours * 3600000);
    
    const formatTime = (d: Date) => `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日${d.getHours().toString().padStart(2, '0')}时`;
    const formatTimeEnd = (d: Date) => `${d.getDate()}日${d.getHours().toString().padStart(2, '0')}时`;
    
    ctx.font = `${26 * scale}px sans-serif`;
    ctx.fillText(`${formatTime(startTime)}—${formatTimeEnd(endTime)} (北京时)`, W / 2, 115 * scale);

    const baseConfig = activeState.configSnapshot || config || {
      subtropicalHighEnabled: true, subtropicalHighStrength: 1.0, subtropicalHighLat: 28.0,
      subtropicalHighLon: 135.0, subtropicalHighWestExtent: 125.0, westerliesEnabled: true,
      westerliesStrength: 1.0, westerliesLat: 30.0, westerliesTroughLon: 120.0, westerliesTroughDepth: 1.0,
      betaDriftEnabled: true, betaDriftScale: 1.0, monsoonTroughEnabled: false, eastWaveEnabled: false,
      shearScale: 1.0, humidityScale: 1.0, outflowScale: 1.0, dryAirEnabled: true, randomNoise: 0,
      sstAnomaly: 0, sstNorthSouthGradient: 1.0, ohcScale: 1.0, warmPoolEnabled: true, coldEddyEnabled: false,
      airSeaCoupling: 0.5, ewrcTrigger: "auto", rapidIntensifyEnabled: true, landDecayEnabled: true,
      terrainDecayEnabled: true, landfallDecayAdjustment: 0, landProximityDecayAdjustment: 0,
      landTdDissipateMode: "6h", intensificationRate: 1.0, etEnabled: true, fujiwharaEnabled: true,
      seed: "default", joystickSensitivity: 1.0, joystickStrength: 1.0, joystickDx: 0, joystickDy: 0,
      soundEnabled: false, soundVolume: 0, followMainTyphoon: false
    };

    const tempTyphoon = { ...typhoon, lat: activeState.lat, lon: activeState.lon, vmax: activeState.vmax, pmin: activeState.pmin };
    const path = typhoon.forecastPath && typhoon.forecastPath.length > 0 ? typhoon.forecastPath : calculateForecastPath(tempTyphoon, baseConfig, fHours);
    const path24h = path.filter(p => p.simHour <= currentHour + fHours);
    
    // Auto-frame map bounds around typhoon path with proper geographic extent
    let pMinLon = activeState.lon, pMaxLon = activeState.lon;
    let pMinLat = activeState.lat, pMaxLat = activeState.lat;
    for (const pt of path24h) {
      if (pt.lon < pMinLon) pMinLon = pt.lon;
      if (pt.lon > pMaxLon) pMaxLon = pt.lon;
      if (pt.lat < pMinLat) pMinLat = pt.lat;
      if (pt.lat > pMaxLat) pMaxLat = pt.lat;
    }

    let minLon = pMinLon - 5.5;
    let maxLon = pMaxLon + 5.5;
    let minLat = pMinLat - 4.5;
    let maxLat = pMaxLat + 4.5;

    // Guarantee minimum geographic frame
    if (maxLon - minLon < 16.0) {
      const midLon = (minLon + maxLon) / 2;
      minLon = midLon - 8.0; maxLon = midLon + 8.0;
    }
    if (maxLat - minLat < 13.0) {
      const midLat = (minLat + maxLat) / 2;
      minLat = midLat - 6.5; maxLat = midLat + 6.5;
    }

    const mapAspect = mapWidth / mapHeight;
    const dataAspect = (maxLon - minLon) / (maxLat - minLat);
    if (dataAspect > mapAspect) {
      const extraLat = ((maxLon - minLon) / mapAspect) - (maxLat - minLat);
      minLat -= extraLat / 2; maxLat += extraLat / 2;
    } else {
      const extraLon = ((maxLat - minLat) * mapAspect) - (maxLon - minLon);
      minLon -= extraLon / 2; maxLon += extraLon / 2;
    }

    const latLonToPixel = (lat: number, lon: number) => {
      const x = mapLeft + ((lon - minLon) / (maxLon - minLon)) * mapWidth;
      const y = mapBottom - ((lat - minLat) / (maxLat - minLat)) * mapHeight;
      return { x, y };
    };

    // Draw Map Background
    ctx.save();
    ctx.beginPath();
    ctx.rect(mapLeft, mapTop, mapWidth, mapHeight);
    ctx.clip();
    
    // Sea
    ctx.fillStyle = "#EAF4FE";
    ctx.fillRect(mapLeft, mapTop, mapWidth, mapHeight);
    
    // Land
    ctx.fillStyle = "#F8EBD6";
    const drawPoly = (coordinates: number[][][]) => {
      for (const ring of coordinates) {
        ctx.beginPath();
        for (let i = 0; i < ring.length; i++) {
          const pt = latLonToPixel(ring[i][1], ring[i][0]);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    };
    ctx.strokeStyle = "#C0A880";
    ctx.lineWidth = 1;
    if (landGeoJson && landGeoJson.features) {
      landGeoJson.features.forEach((feat: any) => {
        if (feat.geometry.type === "Polygon") drawPoly(feat.geometry.coordinates);
        else if (feat.geometry.type === "MultiPolygon") feat.geometry.coordinates.forEach(drawPoly);
      });
    }

    // Grid lines (lat/lon)
    ctx.strokeStyle = "#888888";
    ctx.lineWidth = 0.5;
    for (let l = Math.floor(minLat); l <= Math.ceil(maxLat); l++) {
      if (l % 5 === 0) {
        const pt = latLonToPixel(l, minLon);
        ctx.beginPath(); ctx.moveTo(mapLeft, pt.y); ctx.lineTo(mapRight, pt.y); ctx.stroke();
        ctx.fillStyle = "#000"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
        ctx.font = `${12 * scale}px sans-serif`;
        ctx.fillText(l + "°N", mapRight + 30 * scale, pt.y);
      }
    }
    for (let l = Math.floor(minLon); l <= Math.ceil(maxLon); l++) {
      if (l % 5 === 0) {
        const pt = latLonToPixel(minLat, l);
        ctx.beginPath(); ctx.moveTo(pt.x, mapTop); ctx.lineTo(pt.x, mapBottom); ctx.stroke();
        ctx.fillStyle = "#000"; ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.font = `${12 * scale}px sans-serif`;
        ctx.fillText(l + "°E", pt.x, mapBottom + 10 * scale);
      }
    }

    if (typeof setGenerationProgress === "function") setGenerationProgress(5);
    await new Promise(r => setTimeout(r, 0));

    // High calculation precision grid (0.04 degrees)
    const rainGridSize = 0.04;
    const cols = Math.ceil((maxLon - minLon) / rainGridSize);
    const rows = Math.ceil((maxLat - minLat) / rainGridSize);
    const rainGrid = new Float32Array(cols * rows);
    
    const steps = path24h.length;
    let maxAccuRain = 0;

    for (let i = 0; i < steps; i++) {
      if (typeof setGenerationProgress === "function") {
        setGenerationProgress(10 + Math.floor((i / Math.max(1, steps)) * 50));
      }
      if (i % 2 === 0) await new Promise(r => setTimeout(r, 0));
      
      const pt = path24h[i];
      const prev = i > 0 ? path24h[i-1] : {lat: activeState.lat, lon: activeState.lon, vmax: activeState.vmax, simHour: activeState.simHour};
      
      const interps = 10;
      for (let j = 1; j <= interps; j++) {
        const r = j / interps;
        const clat = prev.lat + (pt.lat - prev.lat) * r;
        const clon = prev.lon + (pt.lon - prev.lon) * r;
        const cvmax = prev.vmax + (pt.vmax - prev.vmax) * r;
        
        // Calibrated 24h accumulated rainfall physics (mm/h rate during storm passage)
        // Eyewall convective core rainfall rate: tightly focused so Grade 14 typhoon produces ~250-320mm compact landfall core
        const coreRate = Math.pow(Math.max(15, cvmax) / 10, 1.30) * 5.2;
        const innerRate = Math.pow(Math.max(15, cvmax) / 10, 1.05) * 3.2;
        const outerRate = 1.8;
        
        const infl = 4.2; // ~460km outer rainfall influence
        const minG_lat = Math.max(0, Math.floor((clat - infl - minLat) / rainGridSize));
        const maxG_lat = Math.min(rows - 1, Math.ceil((clat + infl - minLat) / rainGridSize));
        const minG_lon = Math.max(0, Math.floor((clon - infl - minLon) / rainGridSize));
        const maxG_lon = Math.min(cols - 1, Math.ceil((clon + infl - minLon) / rainGridSize));

        const dtSubHours = 24.0 / (Math.max(1, steps) * interps);
        
        for (let y = minG_lat; y <= maxG_lat; y++) {
          const glat = minLat + y * rainGridSize;
          for (let x = minG_lon; x <= maxG_lon; x++) {
            const glon = minLon + x * rainGridSize;
            
            const dx = (glon - clon) * Math.cos(clat * Math.PI / 180) * 111;
            const dy = (glat - clat) * 111;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist < infl * 111) {
              // Compact eyewall core profile (radius ~22km) so >=250mm 特大暴雨 is tightly focused around landfall core
              let coreR = coreRate * Math.exp(-(dist*dist)/(22 * 22));
              let innerR = innerRate * Math.exp(-(dist*dist)/(100 * 100));
              let outerR = outerRate * Math.exp(-(dist*dist)/(300 * 300));
              
              // Logarithmic spiral rainband modulation (螺旋雨带)
              const azimuth = Math.atan2(dy, dx);
              const spiralPhase = azimuth - 2.8 * Math.log(Math.max(1, dist / 20.0));
              const spiralPulse = 0.85 + 0.30 * Math.pow(Math.cos(3.0 * spiralPhase), 2);

              let rainRate = (coreR + innerR + outerR) * spiralPulse;
              
              // Continuous front-right quadrant convective asymmetry
              rainRate *= (1.0 + 0.15 * Math.sin(azimuth - Math.PI / 4));
              
              // Orographic lifting over land terrain (降水陆地抬升)
              const elev = getProceduralElevation(glat, glon);
              if (elev > 40) {
                 rainRate *= (1.0 + Math.min(elev / 450, 1.25));
              }
              
              const gIdx = y * cols + x;
              rainGrid[gIdx] += rainRate * dtSubHours;
              if (rainGrid[gIdx] > maxAccuRain) {
                maxAccuRain = rainGrid[gIdx];
              }
            }
          }
        }
      }
    }

    if (typeof setGenerationProgress === "function") setGenerationProgress(65);

    // Double 3x3 Spatial Gaussian Blur Pass over rainGrid to eliminate pixelation and create silky smooth, natural contour boundaries
    let currentRain = rainGrid;
    for (let pass = 0; pass < 2; pass++) {
      const smoothedRainPass = new Float32Array(cols * rows);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          let sum = 0;
          let wSum = 0;
          for (let dy = -1; dy <= 1; dy++) {
            const ny = y + dy;
            if (ny < 0 || ny >= rows) continue;
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx;
              if (nx < 0 || nx >= cols) continue;
              const weight = (dx === 0 && dy === 0) ? 4 : (dx === 0 || dy === 0 ? 2 : 1);
              sum += currentRain[ny * cols + nx] * weight;
              wSum += weight;
            }
          }
          smoothedRainPass[y * cols + x] = sum / wSum;
        }
      }
      currentRain = smoothedRainPass;
    }
    const smoothedRain = currentRain;

    // High performance ImageData rendering
    const gridCanvas = document.createElement("canvas");
    gridCanvas.width = cols;
    gridCanvas.height = rows;
    const gridCtx = gridCanvas.getContext("2d");

    if (gridCtx) {
      if (typeof setGenerationProgress === "function") setGenerationProgress(80);
      await new Promise(r => setTimeout(r, 0));

      const imgData = gridCtx.createImageData(cols, rows);
      const data = imgData.data;

      const hasExtreme400 = maxAccuRain >= 380;

      for (let y = 0; y < rows; y++) {
        const imgY = rows - 1 - y;
        for (let x = 0; x < cols; x++) {
          const rain = smoothedRain[y * cols + x];
          if (rain >= 0.1) {
            let r = 0, g = 0, b = 0, a = 210;
            if (rain >= 400)      { r = 230; g = 145; b = 0; }   // 400mm+ 极强中心 #E69100
            else if (rain >= 250) { r = 115; g = 0;   b = 38; }  // 特大暴雨 #730026
            else if (rain >= 100) { r = 250; g = 0;   b = 250; } // 大暴雨 #FA00FA
            else if (rain >= 50)  { r = 0;   g = 0;   b = 255; } // 暴雨 #0000FF
            else if (rain >= 25)  { r = 97;  g = 184; b = 255; } // 大雨 #61B8FF
            else if (rain >= 10)  { r = 56;  g = 168; b = 0; }   // 中雨 #38A800
            else if (rain >= 0.1) { r = 166; g = 242; b = 143; } // 小雨 #A6F28F

            const idx = (imgY * cols + x) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = a;
          }
        }
      }

      gridCtx.putImageData(imgData, 0, 0);

      ctx.save();
      ctx.globalAlpha = 0.90;
      ctx.imageSmoothingEnabled = false;

      // PRECISION LAND MASK CLIPPING: Rain forecast ONLY renders on land polygons!
      if (landGeoJson && landGeoJson.features) {
        ctx.beginPath();
        const clipPoly = (coordinates: number[][][]) => {
          for (const ring of coordinates) {
            for (let i = 0; i < ring.length; i++) {
              const pt = latLonToPixel(ring[i][1], ring[i][0]);
              if (i === 0) ctx.moveTo(pt.x, pt.y);
              else ctx.lineTo(pt.x, pt.y);
            }
            ctx.closePath();
          }
        };
        landGeoJson.features.forEach((feat: any) => {
          if (feat.geometry.type === "Polygon") clipPoly(feat.geometry.coordinates);
          else if (feat.geometry.type === "MultiPolygon") feat.geometry.coordinates.forEach(clipPoly);
        });
        ctx.clip("evenodd");
      }

      ctx.drawImage(gridCanvas, mapLeft, mapTop, mapWidth, mapHeight);
      ctx.restore();

      // Superimpose fine coastlines on top of rainfall blocks
      drawCoastlinesOnTop(ctx, latLonToPixel, scale);
    }

    ctx.restore(); // map clip

    // Draw CMA logo & Maker info
    ctx.fillStyle = "#000080"; // Navy blue text
    ctx.textAlign = "right";
    ctx.font = `bold ${24 * scale}px sans-serif`;
    ctx.fillText("晚风气象台", mapRight - 20 * scale, mapTop + 40 * scale);
    ctx.font = `bold ${20 * scale}px sans-serif`;
    ctx.fillText(`${forecastBaseDate.getMonth()+1}月${forecastBaseDate.getDate()}日${forecastBaseDate.getHours().toString().padStart(2, '0')}时制作`, mapRight - 20 * scale, mapTop + 70 * scale);

    // Draw outer map border
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2 * scale;
    ctx.strokeRect(mapLeft, mapTop, mapWidth, mapHeight);

    // Legend - Sized to comfortably fit all items without overflow
    const hasExtreme400 = maxAccuRain >= 380;
    const legX = mapLeft + 20 * scale;
    const legY = mapBottom - (hasExtreme400 ? 360 : 320) * scale;
    const legW = 340 * scale;
    const legH = (hasExtreme400 ? 340 : 300) * scale;
    
    ctx.fillStyle = "#F8F9FA";
    ctx.fillRect(legX, legY, legW, legH);
    ctx.strokeRect(legX, legY, legW, legH);
    
    ctx.fillStyle = "#000";
    ctx.textAlign = "left";
    ctx.font = `bold ${20 * scale}px sans-serif`;
    ctx.fillText("图例", legX + 20 * scale, legY + 30 * scale);
    
    const items = [
      { c: "#A6F28F", l: "小雨 (0.1-9.9毫米)" },
      { c: "#38A800", l: "中雨 (10-24.9毫米)" },
      { c: "#61B8FF", l: "大雨 (25-49.9毫米)" },
      { c: "#0000FF", l: "暴雨 (50-99.9毫米)" },
      { c: "#FA00FA", l: "大暴雨 (100-249.9毫米)" },
      { c: "#730026", l: hasExtreme400 ? "特大暴雨 (250-399.9毫米)" : "特大暴雨 (≥250毫米)" }
    ];
    if (hasExtreme400) {
      items.push({ c: "#E69100", l: "特大暴雨 (≥400毫米)" });
    }
    
    items.forEach((item, idx) => {
      ctx.fillStyle = item.c;
      ctx.fillRect(legX + 20 * scale, legY + 48 * scale + idx * 40 * scale, 45 * scale, 22 * scale);
      ctx.strokeRect(legX + 20 * scale, legY + 48 * scale + idx * 40 * scale, 45 * scale, 22 * scale);
      ctx.fillStyle = "#000";
      ctx.font = `${16 * scale}px sans-serif`;
      ctx.fillText(item.l, legX + 75 * scale, legY + 65 * scale + idx * 40 * scale);
    });

    if (typeof setGenerationProgress === 'function') setGenerationProgress(100);
  };

  // =========================================================================================
  // WIND FORECAST
  // =========================================================================================
  const drawWindForecastOnCanvas = async (canvas: HTMLCanvasElement | null, isMini: boolean = false) => {
    if (!canvas || !geoJsonLoaded) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (typeof setGenerationProgress === "function") setGenerationProgress(5);
    await new Promise(r => setTimeout(r, 0));

    const W = isMini ? 400 : selectedRes.width;
    const H = isMini ? 300 : selectedRes.height;
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    const scale = W / 1920;
    
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    const mapLeft = 80 * scale; const mapRight = W - 80 * scale;
    const mapTop = 160 * scale; const mapBottom = H - 80 * scale;
    const mapWidth = mapRight - mapLeft; const mapHeight = mapBottom - mapTop;

    ctx.fillStyle = "#000000"; ctx.textAlign = "center"; ctx.font = `${36 * scale}px sans-serif`;
    const fHours = forecastHours; 
    ctx.fillText(`今年第${typhoonNumber}号台风 “${typhoonName}” 未来${fHours}小时大风预报图`, W / 2, 70 * scale);
    
    const activeState = typhoon.history?.find((h) => h.simHour === currentHour) || typhoon;
    const startTime = new Date(startDate.getTime() + currentHour * 3600000);
    const endTime = new Date(startTime.getTime() + fHours * 3600000);
    const formatTime = (d: Date) => `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日${d.getHours().toString().padStart(2, '0')}时`;
    const formatTimeEnd = (d: Date) => `${d.getDate()}日${d.getHours().toString().padStart(2, '0')}时`;
    ctx.font = `${26 * scale}px sans-serif`;
    ctx.fillText(`${formatTime(startTime)}—${formatTimeEnd(endTime)} (北京时)`, W / 2, 115 * scale);

    const baseConfig = activeState.configSnapshot || config;
    const tempTyphoon = { ...typhoon, lat: activeState.lat, lon: activeState.lon, vmax: activeState.vmax, pmin: activeState.pmin };
    const path = typhoon.forecastPath && typhoon.forecastPath.length > 0 ? typhoon.forecastPath : calculateForecastPath(tempTyphoon, baseConfig, fHours);
    const path24h = path.filter(p => p.simHour <= currentHour + fHours);

    // Auto-adjust zoom level and bounding box for wind map to fit track & broad gale envelope
    let pMinLon = activeState.lon, pMaxLon = activeState.lon;
    let pMinLat = activeState.lat, pMaxLat = activeState.lat;
    for (const pt of path24h) {
      if (pt.lon < pMinLon) pMinLon = pt.lon;
      if (pt.lon > pMaxLon) pMaxLon = pt.lon;
      if (pt.lat < pMinLat) pMinLat = pt.lat;
      if (pt.lat > pMaxLat) pMaxLat = pt.lat;
    }

    let minLon = pMinLon - 7.5;
    let maxLon = pMaxLon + 7.5;
    let minLat = pMinLat - 6.5;
    let maxLat = pMaxLat + 6.5;

    // Guarantee minimum geographic frame so East China, Taiwan & surrounding seas look spacious
    if (maxLon - minLon < 20.0) {
      const midLon = (minLon + maxLon) / 2;
      minLon = midLon - 10.0; maxLon = midLon + 10.0;
    }
    if (maxLat - minLat < 15.0) {
      const midLat = (minLat + maxLat) / 2;
      minLat = midLat - 7.5; maxLat = midLat + 7.5;
    }

    const mapAspect = mapWidth / mapHeight;
    const dataAspect = (maxLon - minLon) / (maxLat - minLat);
    if (dataAspect > mapAspect) {
      const extraLat = ((maxLon - minLon) / mapAspect) - (maxLat - minLat);
      minLat -= extraLat / 2; maxLat += extraLat / 2;
    } else {
      const extraLon = ((maxLat - minLat) * mapAspect) - (maxLon - minLon);
      minLon -= extraLon / 2; maxLon += extraLon / 2;
    }

    const latLonToPixel = (lat: number, lon: number) => {
      return { x: mapLeft + ((lon - minLon) / (maxLon - minLon)) * mapWidth, y: mapBottom - ((lat - minLat) / (maxLat - minLat)) * mapHeight };
    };

    ctx.save(); ctx.beginPath(); ctx.rect(mapLeft, mapTop, mapWidth, mapHeight); ctx.clip();
    ctx.fillStyle = "#EAF4FE"; ctx.fillRect(mapLeft, mapTop, mapWidth, mapHeight);
    
    ctx.fillStyle = "#F8EBD6"; ctx.strokeStyle = "#C0A880"; ctx.lineWidth = 1;
    const drawPoly = (coordinates: number[][][]) => {
      for (const ring of coordinates) {
        ctx.beginPath();
        for (let i = 0; i < ring.length; i++) {
          const pt = latLonToPixel(ring[i][1], ring[i][0]);
          if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    };
    if (landGeoJson && landGeoJson.features) {
      landGeoJson.features.forEach((feat: any) => {
        if (feat.geometry.type === "Polygon") drawPoly(feat.geometry.coordinates);
        else if (feat.geometry.type === "MultiPolygon") feat.geometry.coordinates.forEach(drawPoly);
      });
    }

    for (let l = Math.floor(minLat); l <= Math.ceil(maxLat); l++) {
      if (l % 5 === 0) {
        const pt = latLonToPixel(l, minLon);
        ctx.beginPath(); ctx.moveTo(mapLeft, pt.y); ctx.lineTo(mapRight, pt.y); ctx.strokeStyle="#888"; ctx.stroke();
        ctx.fillStyle = "#000"; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.font = `${12 * scale}px sans-serif`;
        ctx.fillText(l + "°N", mapRight + 30 * scale, pt.y);
      }
    }
    for (let l = Math.floor(minLon); l <= Math.ceil(maxLon); l++) {
      if (l % 5 === 0) {
        const pt = latLonToPixel(minLat, l);
        ctx.beginPath(); ctx.moveTo(pt.x, mapTop); ctx.lineTo(pt.x, mapBottom); ctx.strokeStyle="#888"; ctx.stroke();
        ctx.fillStyle = "#000"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.font = `${12 * scale}px sans-serif`;
        ctx.fillText(l + "°E", pt.x, mapBottom + 10 * scale);
      }
    }

    // High resolution grid (0.035 deg) for sharp-edged solid color blocks without wave ripples
    const windGridSize = 0.035;
    const cols = Math.ceil((maxLon - minLon) / windGridSize);
    const rows = Math.ceil((maxLat - minLat) / windGridSize);
    const windGrid = new Float32Array(cols * rows);

    // Precalculate land mask on grid for land friction wind decay (风力上岸衰减)
    const isLandGrid = new Uint8Array(cols * rows);
    for (let y = 0; y < rows; y++) {
      const glat = minLat + y * windGridSize;
      for (let x = 0; x < cols; x++) {
        const glon = minLon + x * windGridSize;
        if (checkPointOnLandGeoJson(glat, glon)) {
          isLandGrid[y * cols + x] = 1;
        }
      }
    }
    
    // 1. Build dense sub-sampled trajectory track points with continuous heading angle along path
    const trackPoints: { lat: number; lon: number; vmax: number; headingRad: number }[] = [];
    const denseSteps = Math.max(220, path24h.length * 25);
    
    for (let i = 0; i < denseSteps; i++) {
      const frac = i / (denseSteps - 1);
      const pathIdx = frac * (path24h.length - 1);
      const idx0 = Math.floor(pathIdx);
      const idx1 = Math.min(path24h.length - 1, idx0 + 1);
      const r = pathIdx - idx0;
      
      const p0 = path24h[idx0] || { lat: activeState.lat, lon: activeState.lon, vmax: activeState.vmax };
      const p1 = path24h[idx1] || p0;
      
      const clat = p0.lat + (p1.lat - p0.lat) * r;
      const clon = p0.lon + (p1.lon - p0.lon) * r;
      const cvmax = p0.vmax + (p1.vmax - p0.vmax) * r;
      
      let headingRad = 0;
      if (idx1 > idx0) {
        const dLat = (p1.lat - p0.lat) * 111.0;
        const dLon = (p1.lon - p0.lon) * Math.cos(clat * Math.PI / 180) * 111.0;
        headingRad = Math.atan2(dLat, dLon);
      } else if (i > 0) {
        headingRad = trackPoints[i - 1].headingRad;
      }
      
      trackPoints.push({ lat: clat, lon: clon, vmax: cvmax, headingRad });
    }

    // 2. Iterate dense track points and integrate wind speed envelope continuously across grid
    const numTrackPts = trackPoints.length;
    for (let i = 0; i < numTrackPts; i++) {
      if (i % 20 === 0 && typeof setGenerationProgress === 'function') {
        setGenerationProgress(10 + Math.floor((i / numTrackPts) * 65));
        await new Promise(r => setTimeout(r, 0));
      }

      const pt = trackPoints[i];
      const cvmax = pt.vmax;
      const clat = pt.lat;
      const clon = pt.lon;
      const heading = pt.headingRad;
      const cosLat = Math.cos(clat * Math.PI / 180);

      // Realistic NMC standard wind radii for intensity cvmax (in km)
      const stdR = getStandardAverageWindRadii(cvmax);
      const r12 = stdR.r12; // ~50-100km
      const r10 = stdR.r10; // ~70-165km
      const r7  = stdR.r7;  // ~180-380km
      const r13 = Math.max(20, r12 * 0.72);
      const r11 = r12 > 0 ? (r12 + (r10 - r12) * 0.5) : Math.max(35, r10 * 0.7);
      const r9  = r10 > 0 ? (r10 + (r7 - r10) * 0.3) : Math.max(50, r7 * 0.5);
      const r8  = r10 > 0 ? (r10 + (r7 - r10) * 0.6) : Math.max(90, r7 * 0.75);
      const r6  = Math.max(220, r7 * 1.28); // ~230-480km outer 6-level wind circle

      const maxInflKm = r6 * 1.22;
      const inflLatDeg = maxInflKm / 111.0;
      const inflLonDeg = maxInflKm / (cosLat * 111.0);

      const minG_lat = Math.max(0, Math.floor((clat - inflLatDeg - minLat) / windGridSize));
      const maxG_lat = Math.min(rows - 1, Math.ceil((clat + inflLatDeg - minLat) / windGridSize));
      const minG_lon = Math.max(0, Math.floor((clon - inflLonDeg - minLon) / windGridSize));
      const maxG_lon = Math.min(cols - 1, Math.ceil((clon + inflLonDeg - minLon) / windGridSize));

      for (let y = minG_lat; y <= maxG_lat; y++) {
        const glat = minLat + y * windGridSize;
        const dY = (glat - clat) * 111.0;

        for (let x = minG_lon; x <= maxG_lon; x++) {
          const glon = minLon + x * windGridSize;
          const dX = (glon - clon) * cosLat * 111.0;
          const dist = Math.sqrt(dX * dX + dY * dY);

          if (dist > maxInflKm) continue;

          // Continuous front-right quadrant asymmetry factor relative to instantaneous storm heading
          const azimuth = Math.atan2(dY, dX);
          const angleDiff = azimuth - heading;
          const asymFactor = 1.0 + 0.16 * Math.sin(angleDiff); // smooth right-side enhancement (1.16 starboard, 0.84 port)

          const effR13 = r13 * asymFactor;
          const effR12 = r12 * asymFactor;
          const effR11 = r11 * asymFactor;
          const effR10 = r10 * asymFactor;
          const effR9  = r9  * asymFactor;
          const effR8  = r8  * asymFactor;
          const effR7  = r7  * asymFactor;
          const effR6  = r6  * asymFactor;

          let wSea = 0;
          if (dist <= effR13) {
            wSea = cvmax;
          } else if (dist <= effR12) {
            const f = (dist - effR13) / Math.max(1, effR12 - effR13);
            wSea = cvmax * (1.0 - f) + 32.7 * f;
          } else if (dist <= effR11) {
            const f = (dist - effR12) / Math.max(1, effR11 - effR12);
            wSea = 32.7 * (1.0 - f) + 28.5 * f;
          } else if (dist <= effR10) {
            const f = (dist - effR11) / Math.max(1, effR10 - effR11);
            wSea = 28.5 * (1.0 - f) + 24.5 * f;
          } else if (dist <= effR9) {
            const f = (dist - effR10) / Math.max(1, effR9 - effR10);
            wSea = 24.5 * (1.0 - f) + 20.8 * f;
          } else if (dist <= effR8) {
            const f = (dist - effR9) / Math.max(1, effR8 - effR9);
            wSea = 20.8 * (1.0 - f) + 17.2 * f;
          } else if (dist <= effR7) {
            const f = (dist - effR8) / Math.max(1, effR7 - effR8);
            wSea = 17.2 * (1.0 - f) + 13.9 * f;
          } else if (dist <= effR6) {
            const f = (dist - effR7) / Math.max(1, effR6 - effR7);
            wSea = 13.9 * (1.0 - f) + 10.8 * f;
          } else {
            const decayScale = 80.0;
            wSea = 10.8 * Math.exp(-(dist - effR6) / decayScale);
          }

          // Land friction decay (风力上岸衰减)
          const gIdx = y * cols + x;
          if (isLandGrid[gIdx]) {
            wSea *= 0.72;
          }

          if (wSea > windGrid[gIdx]) {
            windGrid[gIdx] = wSea;
          }
        }
      }
    }

    if (typeof setGenerationProgress === 'function') setGenerationProgress(75);
    await new Promise(r => setTimeout(r, 0));

    // Double 3x3 Spatial Gaussian Blur Pass over windGrid to guarantee silky-smooth, 100% seam-free solid color blocks
    let currentWind = windGrid;
    for (let pass = 0; pass < 2; pass++) {
      const smoothedWindPass = new Float32Array(cols * rows);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          let sum = 0;
          let wSum = 0;
          for (let dy = -1; dy <= 1; dy++) {
            const ny = y + dy;
            if (ny < 0 || ny >= rows) continue;
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx;
              if (nx < 0 || nx >= cols) continue;
              const weight = (dx === 0 && dy === 0) ? 4 : (dx === 0 || dy === 0 ? 2 : 1);
              sum += currentWind[ny * cols + nx] * weight;
              wSum += weight;
            }
          }
          smoothedWindPass[y * cols + x] = sum / wSum;
        }
      }
      currentWind = smoothedWindPass;
    }
    const smoothedWind = currentWind;

    // ImageData rendering for crisp, sharp-edged solid color blocks without ripples
    const gridCanvas = document.createElement("canvas");
    gridCanvas.width = cols;
    gridCanvas.height = rows;
    const gridCtx = gridCanvas.getContext("2d");

    if (gridCtx) {
      if (typeof setGenerationProgress === "function") setGenerationProgress(85);
      await new Promise(r => setTimeout(r, 0));

      const imgData = gridCtx.createImageData(cols, rows);
      const data = imgData.data;

      for (let y = 0; y < rows; y++) {
        const imgY = rows - 1 - y;
        for (let x = 0; x < cols; x++) {
          const w = smoothedWind[y * cols + x];
          if (w >= 10.8) { // 6级 >= 10.8m/s
            let r = 0, g = 0, b = 0, a = 215;
            if (w >= 37.0)      { r = 204; g = 0;   b = 0; }   // 13级+ #CC0000
            else if (w >= 32.7) { r = 255; g = 0;   b = 0; }   // 12级 #FF0000
            else if (w >= 28.5) { r = 255; g = 102; b = 102; } // 11级 #FF6666
            else if (w >= 24.5) { r = 255; g = 153; b = 0; }   // 10级 #FF9900
            else if (w >= 20.8) { r = 255; g = 204; b = 0; }   // 9级  #FFCC00
            else if (w >= 17.2) { r = 0;   g = 0;   b = 204; } // 8级  #0000CC
            else if (w >= 13.9) { r = 0;   g = 102; b = 255; } // 7级  #0066FF
            else if (w >= 10.8) { r = 0;   g = 204; b = 255; } // 6级  #00CCFF
            
            const idx = (imgY * cols + x) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = a;
          }
        }
      }

      gridCtx.putImageData(imgData, 0, 0);

      ctx.save();
      ctx.globalAlpha = 0.88;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(gridCanvas, mapLeft, mapTop, mapWidth, mapHeight);
      ctx.restore();

      // Superimpose fine coastlines on top of wind blocks
      drawCoastlinesOnTop(ctx, latLonToPixel, scale);
    }

    ctx.restore();

    ctx.fillStyle = "#000080"; ctx.textAlign = "right"; ctx.font = `bold ${24 * scale}px sans-serif`;
    ctx.fillText("晚风气象台", mapRight - 20 * scale, mapTop + 40 * scale);
    ctx.font = `bold ${20 * scale}px sans-serif`;
    ctx.fillText(`${forecastBaseDate.getMonth()+1}月${forecastBaseDate.getDate()}日${forecastBaseDate.getHours().toString().padStart(2, '0')}时制作`, mapRight - 20 * scale, mapTop + 70 * scale);

    ctx.strokeStyle = "#000"; ctx.lineWidth = 2 * scale; ctx.strokeRect(mapLeft, mapTop, mapWidth, mapHeight);

    // Legend
    const legX = mapLeft + 20 * scale; const legY = mapBottom - 360 * scale;
    const legW = 220 * scale; const legH = 340 * scale;
    ctx.fillStyle = "#F8F9FA"; ctx.fillRect(legX, legY, legW, legH); ctx.strokeRect(legX, legY, legW, legH);
    ctx.fillStyle = "#000"; ctx.textAlign = "left"; ctx.font = `${22 * scale}px sans-serif`;
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
      ctx.fillStyle = "#000"; ctx.font = `${18 * scale}px sans-serif`;
      ctx.fillText(item.l, legX + 70 * scale, legY + 66 * scale + idx * 35 * scale);
    });

    if (typeof setGenerationProgress === 'function') setGenerationProgress(100);
  };

  // =========================================================================================
  // SCATTEROMETER
  // =========================================================================================
  const drawScatterometerOnCanvas = async (canvas: HTMLCanvasElement | null, isMini: boolean = false) => {
    if (!canvas || !geoJsonLoaded) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (typeof setGenerationProgress === "function") setGenerationProgress(5);
    await new Promise(r => setTimeout(r, 0));

    const W = isMini ? 400 : selectedRes.width;
    const H = isMini ? 300 : selectedRes.height;
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    const scale = W / 1920;
    
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    const mapLeft = 80 * scale; const mapRight = W - 150 * scale;
    const mapTop = 100 * scale; const mapBottom = H - 80 * scale;
    const mapWidth = mapRight - mapLeft; const mapHeight = mapBottom - mapTop;

    ctx.fillStyle = "#000000"; ctx.textAlign = "left"; ctx.font = `${26 * scale}px sans-serif`;
    ctx.fillText(`Simulated wind field diagra`, mapLeft, 40 * scale);
    const pad2 = (n: number) => String(n).padStart(2, "0");
    const yearStr = forecastBaseDate.getUTCFullYear();
    const monthStr = pad2(forecastBaseDate.getUTCMonth() + 1);
    const dayStr = pad2(forecastBaseDate.getUTCDate());
    const hourStr = pad2(forecastBaseDate.getUTCHours());
    const validTimeStr = `${yearStr}/${monthStr}/${dayStr} ${hourStr}00Z`;
    ctx.font = `${20 * scale}px sans-serif`;
    ctx.fillText(`Last Updated: ${validTimeStr} / Valid Time: ${validTimeStr}`, mapLeft, 70 * scale);

    const activeState = typhoon.history?.find((h) => h.simHour === currentHour) || typhoon;
    const centerLat = activeState.lat;
    const cosLat = Math.cos(centerLat * Math.PI / 180);

    // Correct aspect ratio so 1km N-S equals 1km E-W on screen (fixes N-S flattening)
    const baseLonSpan = scatZoomSpan;
    const baseLatSpan = (baseLonSpan * cosLat) * (mapHeight / mapWidth);

    const minLon = activeState.lon - baseLonSpan / 2;
    const maxLon = activeState.lon + baseLonSpan / 2;
    const minLat = activeState.lat - baseLatSpan / 2;
    const maxLat = activeState.lat + baseLatSpan / 2;

    const latLonToPixel = (lat: number, lon: number) => {
      return { x: mapLeft + ((lon - minLon) / (maxLon - minLon)) * mapWidth, y: mapBottom - ((lat - minLat) / (maxLat - minLat)) * mapHeight };
    };

    ctx.save(); ctx.beginPath(); ctx.rect(mapLeft, mapTop, mapWidth, mapHeight); ctx.clip();
    
    // Draw Coastlines ONLY (black lines)
    ctx.strokeStyle = "#000000"; ctx.lineWidth = 1 * scale;
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

    // Grid lines dotted
    ctx.strokeStyle = "#000"; ctx.lineWidth = 2 * scale; ctx.setLineDash([4 * scale, 6 * scale]);
    for (let l = Math.floor(minLat); l <= Math.ceil(maxLat); l++) {
      if (l % 5 === 0) {
        const pt = latLonToPixel(l, minLon);
        ctx.beginPath(); ctx.moveTo(mapLeft, pt.y); ctx.lineTo(mapRight, pt.y); ctx.stroke();
        ctx.fillStyle = "#000"; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.font = `${16 * scale}px sans-serif`;
        ctx.fillText(l + "°N", mapLeft - 10 * scale, pt.y);
      }
    }
    for (let l = Math.floor(minLon); l <= Math.ceil(maxLon); l++) {
      if (l % 5 === 0) {
        const pt = latLonToPixel(minLat, l);
        ctx.beginPath(); ctx.moveTo(pt.x, mapTop); ctx.lineTo(pt.x, mapBottom); ctx.stroke();
        ctx.fillStyle = "#000"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.font = `${16 * scale}px sans-serif`;
        ctx.fillText(l + "°E", pt.x, mapBottom + 10 * scale);
      }
    }
    ctx.setLineDash([]);

    // Scatterometer Swath Math
    // Scatterometers have two swaths with a nadir gap in the middle.
    // Let's create an inclined orbit track passing near the center.
    const orbitAngle = (scatOrbitAngle * Math.PI) / 180; // tilted slightly
    
    // Grid for wind barbs
    const barbGridSize = scatBarbSpacing; // user adjustable density
    let maxKt = 0;
    
    // Draw wind barbs
    const drawBarb = (x: number, y: number, speedKt: number, mathAngleRad: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = scatBarbWidth * scale;
      ctx.beginPath();
      // Draw shaft
      const shaftLen = scatBarbLength * scale;
      
      // mathAngleRad is the direction the wind is BLOWING TOWARDS (0=East, PI/2=North)
      // The tail should be where the wind is COMING FROM (i.e. Math.PI + mathAngleRad)
      // Canvas Y is down, so Math Y = -Canvas Y
      const canvasAngle = -mathAngleRad;
      const tailAngle = canvasAngle + Math.PI;
      
      const ex = x + Math.cos(tailAngle) * shaftLen;
      const ey = y + Math.sin(tailAngle) * shaftLen;
      ctx.moveTo(x, y);
      ctx.lineTo(ex, ey);
      
      let remaining = Math.round(speedKt / 5) * 5;
      let curX = ex; let curY = ey;
      const barbSpacing = 3 * scale;
      
      // The flags should point to the LEFT of the wind vector.
      // Wind vector in canvas is (cos(canvasAngle), sin(canvasAngle))
      // Left normal is (sin(canvasAngle), -cos(canvasAngle))
      const nx = Math.sin(canvasAngle);
      const ny = -Math.cos(canvasAngle);
      
      // We step DOWN the shaft towards the head
      const stepX = Math.cos(canvasAngle) * barbSpacing;
      const stepY = Math.sin(canvasAngle) * barbSpacing;
      
      while (remaining >= 50) {
        ctx.moveTo(curX, curY);
        ctx.lineTo(curX + nx * 10 * scale, curY + ny * 10 * scale);
        ctx.lineTo(curX + stepX * 0.8, curY + stepY * 0.8);
        ctx.fillStyle = color; ctx.fill();
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
      if (kt < 5) return "#000000";   // 0-5
      if (kt < 10) return "#00CCFF";  // 5-10 Cyan
      if (kt < 15) return "#0033FF";  // 10-15 Blue
      if (kt < 20) return "#00CC00";  // 15-20 Green
      if (kt < 25) return "#FFFF00";  // 20-25 Yellow
      if (kt < 30) return "#FF8080";  // 25-30 Light Coral / Salmon
      if (kt < 35) return "#FF0000";  // 30-35 Red
      if (kt < 40) return "#B07040";  // 35-40 Tan / Brown
      if (kt < 45) return "#FF00FF";  // 40-45 Magenta
      if (kt < 50) return "#800080";  // 45-50 Dark Purple
      if (kt < 55) return "#8B0000";  // 50-55 Dark Red
      if (kt < 60) return "#730000";  // 55-60 Crimson
      return "#FF8C00";              // 60-65+ Orange
    };

    const clat = activeState.lat;
    const clon = activeState.lon;
    const cvmax = Number((activeState.vmax * 1.9438).toFixed(1)); // m/s to knots exact to 1 decimal

    // Active typhoon wind radii profile (in km)
    const radSnap = {
      r34: (activeState as any)?.r7 || (activeState as any)?.r34 || (typhoon as any)?.r7,
      r50: (activeState as any)?.r10 || (activeState as any)?.r50 || (typhoon as any)?.r10,
      r64: (activeState as any)?.r12 || (activeState as any)?.r64 || (typhoon as any)?.r12,
      ewrcCount: (activeState as any)?.ewrcCount
    };
    let r34_km = 220;
    let r50_km = 110;
    let r64_km = 45;
    if (radSnap.r34) {
      r34_km = (radSnap.r34.ne + radSnap.r34.se + radSnap.r34.sw + radSnap.r34.nw) / 4;
    }
    if (radSnap.r50) {
      r50_km = (radSnap.r50.ne + radSnap.r50.se + radSnap.r50.sw + radSnap.r50.nw) / 4;
    }
    if (radSnap.r64) {
      r64_km = (radSnap.r64.ne + radSnap.r64.se + radSnap.r64.sw + radSnap.r64.nw) / 4;
    }
    const rmw_km = Math.max(25, Math.min(60, r64_km * 0.7));

    // Diagonal maximum distance of the map in degrees
    const dLat = maxLat - minLat;
    const dLon = maxLon - minLon;
    const maxDist = Math.sqrt(dLat * dLat + dLon * dLon);

    const safeStep = Math.max(0.01, barbGridSize);
    let renderedCount = 0;
    
    const barbsToDraw: Array<{
      x: number;
      y: number;
      speed: number;
      angle: number;
      color: string;
      distKm: number;
    }> = [];

    // Safe coverage ranges for orbit-aligned grid coordinates
    const uMin = -maxDist * 1.5;
    const uMax = maxDist * 1.5;
    const vMin = -scatSwathWidth;
    const vMax = scatSwathWidth;

    const totalStepsU = Math.ceil((uMax - uMin) / safeStep);

    for (let i = 0; i <= totalStepsU; i++) {
      const u = uMin + i * safeStep;

      if (i % 20 === 0) {
        if (typeof setGenerationProgress === "function") {
          setGenerationProgress(10 + Math.floor((i / totalStepsU) * 80));
        }
        await new Promise(r => setTimeout(r, 0));
      }

      for (let v = vMin; v <= vMax; v += safeStep) {
        // Requirement 12: Add natural noise/randomness to scatterometer
        // Introduce small missing data gaps (rain contamination / sensor noise)
        if (Math.random() > 0.94) continue;
        
        // Add spatial jitter to break perfect uniformity
        const jitterU = (Math.random() - 0.5) * safeStep * 0.45;
        const jitterV = (Math.random() - 0.5) * safeStep * 0.45;
        
        // Convert (u, v) back to lat/lon using rotated coordinate transform
        const glat = clat + (u + jitterU) * Math.sin(orbitAngle) + (v + jitterV) * Math.cos(orbitAngle);
        const glon = clon + (u + jitterU) * Math.cos(orbitAngle) - (v + jitterV) * Math.sin(orbitAngle);

        // Keep points strictly within visual map bounds plus a tiny outer buffer
        if (glat < minLat - 0.25 || glat > maxLat + 0.25 || glon < minLon - 0.25 || glon > maxLon + 0.25) {
          continue;
        }

        // Nadir gap check
        const distToOrbit = Math.abs(v);
        if (showNadirGap && distToOrbit < scatNadirWidth) continue;

        // Distance in km from typhoon center
        const dxKm = (glon - clon) * Math.cos(clat * Math.PI / 180) * 111;
        const dyKm = (glat - clat) * 111;
        const distKm = Math.sqrt(dxKm * dxKm + dyKm * dyKm);

        if (distKm < 1200) {
          const isLand = checkPointOnLandGeoJson(glat, glon);

          // If land data is turned OFF, skip points on land
          if (!scatterometerLandData && isLand) {
            continue;
          }

          const elev = isLand ? getProceduralElevation(glat, glon) : 0;
          // Compute asymmetric, intensity-scaled typhoon wind speed & RMW
          const { w_ty, rmw_km } = getTyphoonWindSpeed(distKm, Math.atan2(dyKm, dxKm), cvmax, radSnap, isLand, (activeState as any).ewrcState || "none", (activeState as any).ewrcProgress || 0);

          let eff_w_ty = w_ty;
          if (isLand) {
            // Low elevation (<100m) maintains higher wind speed, high elevation mountain regions (>300m) suffer heavy terrain blocking
            let landFriction = 0.78;
            if (elev > 50) {
              const terrainBlocking = Math.min(0.60, (elev / 1800.0) * 0.55);
              landFriction *= (1.0 - terrainBlocking);
            }
            eff_w_ty *= landFriction;

            // Multi-scale terrain patch noise creates authentic patchy wind cells ("斑块状")
            const patchNoise = Math.sin(glat * 70.0) * Math.cos(glon * 70.0) + Math.sin(glat * 140.0 + glon * 120.0) * 0.5;
            const patchFactor = 0.68 + 0.64 * (0.5 + 0.5 * patchNoise);
            eff_w_ty *= patchFactor;
          }

          // Typhoon Cyclonic Vector with inflow angle
          const angleToPt = Math.atan2(dyKm, dxKm);
          let orgFactor = Math.min(1.0, Math.max(0.0, (cvmax - 42.0) / 50.0));
          if (isLand) orgFactor *= 0.25;

          // Disruption of Spiral Inflow Flow upon Landfall / Weakening
          let inflowRad = isLand ? 0.58 : 0.31;
          if (isLand || orgFactor < 0.5) {
            const spiralDisruption = (1.0 - orgFactor) * 0.35 * Math.sin(glat * 35.0 + glon * 35.0);
            inflowRad += spiralDisruption;
          }
          const tyWindDir = angleToPt + Math.PI / 2 - inflowRad;

          // Translation-induced asymmetry (danger vs navigable semicircle)
          const headingRad = activeState.direction * Math.PI / 180;
          const relativeAngle = angleToPt - headingRad;
          const r34_eff = Math.max(35, getAngularRadius(radSnap.r34, angleToPt, 220));
          const asymFade = Math.max(0, 1.0 - Math.max(0, distKm - r34_eff) / (r34_eff * 0.5));
          const translationAsymmetry = 1.0 + 0.12 * Math.sin(relativeAngle) * Math.min(1.0, activeState.speed / 28.0) * asymFade;

          const u_ty = eff_w_ty * Math.cos(tyWindDir) * translationAsymmetry;
          const v_ty = eff_w_ty * Math.sin(tyWindDir) * translationAsymmetry;

          // Background synoptic environmental wind vector
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

          // Monsoon Surge: South & Southwest of typhoon center
          if (glat < clat + 1 && glon < clon + 3) {
            const mDist = Math.hypot(glon - (clon - 4), glat - (clat - 4));
            const mWeight = Math.max(0, 1 - mDist / 8);
            u_env += mWeight * 4;
            v_env += mWeight * 3;
          }

          // Subtropical High Periphery: East & Northeast of typhoon center
          if (glon > clon + 2 && glat < 32) {
            const eWeight = Math.min(1.0, (glon - clon) / 6);
            u_env -= eWeight * 2;
            v_env += eWeight * 2;
          }

          // Cap background synoptic environmental wind magnitude strictly <= 18kt (ensures background wind is <= 25kt everywhere)
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

          // Vector superposition with background scale
          let u_total = u_ty + u_env * scatBackgroundScale;
          let v_total = v_ty + v_env * scatBackgroundScale;

          const noiseFactor = 0.88 + Math.random() * 0.24;
          u_total *= noiseFactor;
          v_total *= noiseFactor;

          const w_total_raw = Math.sqrt(u_total * u_total + v_total * v_total);
          let w_total = getSimulatedScatWind(w_total_raw, distKm, rmw_km, cvmax);

          // Outside 7-level wind radius (r34), enforce total wind to drop below 25kt
          if (distKm > r34_eff) {
            const distRatio = (distKm - r34_eff) / (r34_eff * 0.5);
            const maxAllowedWind = Math.max(18.0, 34.0 - distRatio * 16.0);
            if (w_total > maxAllowedWind) {
              w_total = maxAllowedWind;
            }
          }

          // Apply Wind blocking / attenuation (Requirement 4)
          if (w_total > 5.0) {
            // Trace upstream fetch trajectory
            const scale = 0.65;
            const upLat = glat - (v_total / w_total_raw) * scale;
            const upLon = glon - (u_total / w_total_raw) * scale;
            if (checkPointOnLandGeoJson(upLat, upLon)) {
              w_total *= 0.76;
              
              const upLat2 = glat - (v_total / w_total_raw) * scale * 2.2;
              const upLon2 = glon - (u_total / w_total_raw) * scale * 2.2;
              if (checkPointOnLandGeoJson(upLat2, upLon2)) {
                w_total *= 0.80; // deep decay
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
          renderedCount++;
        }
      }
    }

    // Sort barbs by Y coordinate ascending so lower rows sit on top of upper rows
    barbsToDraw.sort((a, b) => a.y - b.y);

    // Draw all sorted barbs
    barbsToDraw.forEach(barb => {
      drawBarb(barb.x, barb.y, barb.speed, barb.angle, barb.color);
    });

    ctx.restore();

    ctx.fillStyle = "#000"; ctx.textAlign = "right"; ctx.font = `${18 * scale}px sans-serif`;
    ctx.fillText(`Max. Wind: ${maxKt.toFixed(1)}kt`, mapRight, 70 * scale);

    // Colorbar on the right
    const cbLeft = mapRight + 20 * scale;
    const cbTop = mapTop;
    const cbWidth = 25 * scale;
    const cbHeight = mapHeight;
    const levels = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65];
    const segmentHeight = cbHeight / (levels.length - 1);
    
    for (let i = 0; i < levels.length - 1; i++) {
      ctx.fillStyle = getColorForKt(levels[i] + 0.1); // get color above the threshold
      const y = cbTop + cbHeight - (i+1) * segmentHeight;
      
      // Triangle at top/bottom
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
      
      ctx.fillStyle = "#000";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = `${16 * scale}px sans-serif`;
      ctx.fillText(levels[i].toString(), cbLeft + cbWidth + 10 * scale, cbTop + cbHeight - i * segmentHeight);
    }
    ctx.fillText("65", cbLeft + cbWidth + 10 * scale, cbTop);
    
    if (typeof setGenerationProgress === 'function') setGenerationProgress(100);
  };

  const drawEnsembleMapOnCanvas = async (canvas: HTMLCanvasElement | null, isMini: boolean = false) => {
    if (typeof setGenerationProgress === "function") setGenerationProgress(5);
    await new Promise(r => setTimeout(r, 0));
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = isMini ? 400 : selectedRes.width;
    const H = isMini ? 300 : selectedRes.height;

    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;

    const scale = W / (isMini ? 400 : 1920);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    const titleText = ensembleSubTab === "track" 
      ? `模拟集系预报图 台风${typhoonName} 集合预报路径` 
      : `模拟集系预报图 台风${typhoonName} 袭击概率`;

    ctx.fillStyle = "#000088";
    ctx.font = `bold ${28 * scale}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(titleText, 80 * scale, 45 * scale);

    const dateStr = `${forecastBaseDate.getFullYear()}${String(forecastBaseDate.getMonth()+1).padStart(2, "0")}${String(forecastBaseDate.getDate()).padStart(2, "0")}${String(forecastBaseDate.getHours()).padStart(2, "0")}`;
    ctx.fillStyle = "#333333";
    ctx.font = `${18 * scale}px "Microsoft YaHei", sans-serif`;
    ctx.fillText(`${dateStr}(+360h) BJT`, 80 * scale, 75 * scale);

    ctx.fillStyle = "#10b981";
    ctx.font = `bold ${32 * scale}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText("TRMC", W - 80 * scale, 55 * scale);

    const mapLeft = isMini ? 10 * scale : 80 * scale;
    const sidebarWidth = ensembleSubTab === "track" ? 280 * scale : 200 * scale;
    const mapRight = isMini ? W - 10 * scale : W - 80 * scale - sidebarWidth;
    const mapTop = isMini ? 10 * scale : 95 * scale;
    const mapBottom = isMini ? H - 10 * scale : H - 50 * scale;
    const mapWidth = mapRight - mapLeft;
    const mapHeight = mapBottom - mapTop;

    const activeState = typhoon.history?.find((h) => h.simHour === currentHour) || typhoon;

    const candidatePoints: { lat: number; lon: number }[] = [
      { lat: activeState.lat, lon: activeState.lon }
    ];

    ensembleMembers.forEach(m => {
      m.track.forEach(pt => {
        // Exclude distant easterly tail points induced by westerly belt recurvature
        const isFarWesterlyTail = (pt.lon > activeState.lon + 14.0) || (pt.lat > 32.0 && pt.lon > activeState.lon + 9.0);
        if (!isFarWesterlyTail) {
          candidatePoints.push({ lat: pt.lat, lon: pt.lon });
        }
      });
    });

    const lats = candidatePoints.map((p) => p.lat).sort((a, b) => a - b);
    const lons = candidatePoints.map((p) => p.lon).sort((a, b) => a - b);

    // Percentile trimming (8th to 92nd percentile) to focus map selection on normal bundle & ignore extreme outliers
    const pLowLat = Math.floor(lats.length * 0.08);
    const pHighLat = Math.min(lats.length - 1, Math.ceil(lats.length * 0.92) - 1);
    const pLowLon = Math.floor(lons.length * 0.08);
    const pHighLon = Math.min(lons.length - 1, Math.ceil(lons.length * 0.92) - 1);

    let mapMinLat = Math.min(activeState.lat - 1.5, lats[pLowLat]) - 3.5;
    let mapMaxLat = Math.max(activeState.lat + 1.5, lats[pHighLat]) + 3.5;
    let mapMinLon = Math.min(activeState.lon - 2.5, lons[pLowLon]) - 4.5;
    let mapMaxLon = Math.max(activeState.lon + 2.5, lons[pHighLon]) + 4.5;

    let latSpan = mapMaxLat - mapMinLat;
    let lonSpan = mapMaxLon - mapMinLon;

    const minLatSpan = 14.0;
    const minLonSpan = 21.0;

    if (latSpan < minLatSpan) {
      const midLat = (mapMinLat + mapMaxLat) / 2;
      mapMinLat = midLat - minLatSpan / 2;
      mapMaxLat = midLat + minLatSpan / 2;
      latSpan = minLatSpan;
    }

    if (lonSpan < minLonSpan) {
      const midLon = (mapMinLon + mapMaxLon) / 2;
      mapMinLon = midLon - minLonSpan / 2;
      mapMaxLon = midLon + minLonSpan / 2;
      lonSpan = minLonSpan;
    }

    const ensAspect = mapWidth / mapHeight;
    const ensCurrAspect = lonSpan / latSpan;

    if (ensCurrAspect < ensAspect) {
      const reqLonSpan = latSpan * ensAspect;
      const midLon = (mapMinLon + mapMaxLon) / 2;
      mapMinLon = midLon - reqLonSpan / 2;
      mapMaxLon = midLon + reqLonSpan / 2;
    } else if (ensCurrAspect > ensAspect) {
      const reqLatSpan = lonSpan / ensAspect;
      const midLat = (mapMinLat + mapMaxLat) / 2;
      mapMinLat = midLat - reqLatSpan / 2;
      mapMaxLat = midLat + reqLatSpan / 2;
    }

    const project = (lat: number, lon: number) => {
      const x = mapLeft + ((lon - mapMinLon) / (mapMaxLon - mapMinLon)) * mapWidth;
      const y = mapBottom - ((lat - mapMinLat) / (mapMaxLat - mapMinLat)) * mapHeight;
      return { x, y };
    };

    ctx.save();
    ctx.beginPath();
    ctx.rect(mapLeft, mapTop, mapWidth, mapHeight);
    ctx.clip();

    ctx.fillStyle = "#a6d5fa";
    ctx.fillRect(mapLeft, mapTop, mapWidth, mapHeight);

    if (landGeoJson && landGeoJson.features) {
      ctx.fillStyle = "#f2f4f8";
      ctx.strokeStyle = "#8295a5";
      ctx.lineWidth = 0.8 * scale;

      const drawPoly = (coordinates: number[][][]) => {
        ctx.beginPath();
        coordinates.forEach((ring) => {
          ring.forEach((pt, idx) => {
            const { x, y } = project(pt[1], pt[0]);
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
        });
        ctx.fill("evenodd");
        ctx.stroke();
      };

      landGeoJson.features.forEach((feat: any) => {
        if (!feat.geometry) return;
        if (feat.geometry.type === "Polygon") drawPoly(feat.geometry.coordinates);
        else if (feat.geometry.type === "MultiPolygon") feat.geometry.coordinates.forEach((p: any) => drawPoly(p));
      });
    }

    if (countriesGeoJson && countriesGeoJson.features) {
      ctx.strokeStyle = "rgba(100, 110, 120, 0.45)";
      ctx.lineWidth = 0.6 * scale;

      const drawBorder = (coordinates: number[][][]) => {
        ctx.beginPath();
        coordinates.forEach((ring) => {
          ring.forEach((pt, idx) => {
            const { x, y } = project(pt[1], pt[0]);
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
        });
        ctx.stroke();
      };

      countriesGeoJson.features.forEach((feat: any) => {
        if (!feat.geometry) return;
        if (feat.geometry.type === "Polygon") drawBorder(feat.geometry.coordinates);
        else if (feat.geometry.type === "MultiPolygon") feat.geometry.coordinates.forEach((p: any) => drawBorder(p));
      });
    }

    ctx.strokeStyle = "rgba(180, 190, 200, 0.60)";
    ctx.lineWidth = 0.7 * scale;
    ctx.setLineDash([3 * scale, 3 * scale]);

    for (let lon = 110; lon <= 155; lon += 5) {
      const p1 = project(mapMinLat, lon);
      ctx.beginPath();
      ctx.moveTo(p1.x, mapTop);
      ctx.lineTo(p1.x, mapBottom);
      ctx.stroke();

      ctx.fillStyle = "#444444";
      ctx.font = `${10 * scale}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`${lon}°E`, p1.x, mapBottom - 6 * scale);
    }

    for (let lat = 15; lat <= 50; lat += 5) {
      const p1 = project(lat, mapMinLon);
      ctx.beginPath();
      ctx.moveTo(mapLeft, p1.y);
      ctx.lineTo(mapRight, p1.y);
      ctx.stroke();

      ctx.fillStyle = "#444444";
      ctx.font = `${10 * scale}px sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText(`${lat}°N`, mapLeft + 6 * scale, p1.y + 3 * scale);
    }
    ctx.setLineDash([]);

    if (ensembleSubTab === "track") {
      ensembleMembers.forEach((member) => {
        const track = member.track;
        if (track.length < 2) return;

        for (let i = 0; i < track.length - 1; i++) {
          const p1 = project(track[i].lat, track[i].lon);
          const p2 = project(track[i + 1].lat, track[i + 1].lon);

          let strokeColor = "#00aa22";
          const vm = track[i].vmax;
          if (vm >= 51.0) strokeColor = "#7a0088";
          else if (vm >= 41.5) strokeColor = "#ff00ff";
          else if (vm >= 32.7) strokeColor = "#ff0000";
          else if (vm >= 24.5) strokeColor = "#ff9900";
          else if (vm >= 17.2) strokeColor = "#0044cc";

          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 1.2 * scale;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      });

      const labelHours = [24, 48, 72, 96, 120, 144, 168, 192, 216, 240, 264, 288, 312, 336, 360];
      if (ensembleMembers[0]) {
        const primaryTrack = ensembleMembers[0].track;
        labelHours.forEach(h => {
          const pt = primaryTrack.find(t => Math.abs((t.simHour - currentHour) - h) < 3);
          if (pt) {
            const { x, y } = project(pt.lat, pt.lon);
            ctx.fillStyle = "#000088";
            ctx.font = `bold ${10 * scale}px sans-serif`;
            ctx.fillText(`${h}`, x + 4 * scale, y - 4 * scale);
          }
        });
      }
    } else {
      // Requirement 3: Smooth anti-aliased probability heatmap without blocky mosaic artifacts
      const gw = 160;
      const gh = 120;
      const probGrid: number[][] = Array.from({ length: gh }, () => new Float32Array(gw) as any);

      // 1. Calculate continuous Gaussian radial distance weights on high-res grid
      const totalCount = ensembleMembers.length || 50;
      for (let r = 0; r < gh; r++) {
        if (r % 15 === 0) {
          if (typeof setGenerationProgress === "function") setGenerationProgress(10 + Math.floor((r / gh) * 70));
          await new Promise(r => setTimeout(r, 0));
        }
        const cellLat = mapMaxLat - (r + 0.5) * ((mapMaxLat - mapMinLat) / gh);
        const cosLat = Math.cos((cellLat * Math.PI) / 180);

        for (let c = 0; c < gw; c++) {
          const cellLon = mapMinLon + (c + 0.5) * ((mapMaxLon - mapMinLon) / gw);
          let sumWeight = 0;

          ensembleMembers.forEach((m) => {
            let minDistSq = 999;
            for (let k = 0; k < m.track.length; k++) {
              const dLat = m.track[k].lat - cellLat;
              const dLon = (m.track[k].lon - cellLon) * cosLat;
              const dSq = dLat * dLat + dLon * dLon;
              if (dSq < minDistSq) minDistSq = dSq;
            }
            if (minDistSq <= 1.56) {
              const dist = Math.sqrt(minDistSq);
              const w = Math.pow(1 - dist / 1.25, 2);
              sumWeight += w;
            }
          });

          probGrid[r][c] = Math.min(100, (sumWeight / totalCount) * 115);
        }
      }

      // 2. Spatial 2D Gaussian Kernel Smoothing
      const smoothGrid: number[][] = Array.from({ length: gh }, () => new Float32Array(gw) as any);
      for (let r = 0; r < gh; r++) {
        for (let c = 0; c < gw; c++) {
          let valSum = 0;
          let wSum = 0;
          for (let dr = -2; dr <= 2; dr++) {
            const nr = r + dr;
            if (nr < 0 || nr >= gh) continue;
            for (let dc = -2; dc <= 2; dc++) {
              const nc = c + dc;
              if (nc < 0 || nc >= gw) continue;
              const gWeight = Math.exp(-(dr * dr + dc * dc) / 2.5);
              valSum += probGrid[nr][nc] * gWeight;
              wSum += gWeight;
            }
          }
          smoothGrid[r][c] = valSum / wSum;
        }
      }

      // 3. Render onto offscreen canvas and draw with bilinear filtering
      const offCanvas = document.createElement("canvas");
      offCanvas.width = gw;
      offCanvas.height = gh;
      const offCtx = offCanvas.getContext("2d");
      if (offCtx) {
        const imgData = offCtx.createImageData(gw, gh);
        const data = imgData.data;

        for (let r = 0; r < gh; r++) {
          for (let c = 0; c < gw; c++) {
            const prob = smoothGrid[r][c];
            const idx = (r * gw + c) * 4;

            if (prob < 4) {
              data[idx] = 0;
              data[idx + 1] = 0;
              data[idx + 2] = 0;
              data[idx + 3] = 0;
            } else if (prob < 15) {
              const t = (prob - 4) / 11;
              data[idx] = Math.round(96 + t * 64);
              data[idx + 1] = Math.round(224 + t * 16);
              data[idx + 2] = Math.round(96 - t * 64);
              data[idx + 3] = Math.round((0.35 + t * 0.15) * 255);
            } else if (prob < 30) {
              const t = (prob - 15) / 15;
              data[idx] = Math.round(160 + t * 88);
              data[idx + 1] = Math.round(240 - t * 16);
              data[idx + 2] = 32;
              data[idx + 3] = Math.round((0.50 + t * 0.15) * 255);
            } else if (prob < 50) {
              const t = (prob - 30) / 20;
              data[idx] = 248;
              data[idx + 1] = Math.round(224 - t * 84);
              data[idx + 2] = Math.round(32 - t * 16);
              data[idx + 3] = Math.round((0.65 + t * 0.10) * 255);
            } else if (prob < 70) {
              const t = (prob - 50) / 20;
              data[idx] = Math.round(248 - t * 24);
              data[idx + 1] = Math.round(140 - t * 124);
              data[idx + 2] = Math.round(16 + t * 16);
              data[idx + 3] = Math.round((0.75 + t * 0.10) * 255);
            } else if (prob < 88) {
              const t = (prob - 70) / 18;
              data[idx] = Math.round(224 - t * 32);
              data[idx + 1] = Math.round(16 - t * 16);
              data[idx + 2] = Math.round(32 + t * 128);
              data[idx + 3] = Math.round((0.85 + t * 0.05) * 255);
            } else {
              const t = Math.min(1, (prob - 88) / 12);
              data[idx] = Math.round(192 - t * 48);
              data[idx + 1] = 0;
              data[idx + 2] = Math.round(160 + t * 48);
              data[idx + 3] = Math.round((0.90 + t * 0.05) * 255);
            }
          }
        }

        offCtx.putImageData(imgData, 0, 0);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(offCanvas, mapLeft, mapTop, mapWidth, mapHeight);
      }

      ensembleMembers.forEach((member) => {
        ctx.strokeStyle = "rgba(80, 80, 80, 0.15)";
        ctx.lineWidth = 0.8 * scale;
        ctx.beginPath();
        
        // Start from the origin where the ensemble was calculated to ensure all paths meet at one point
        const originLat = ensembleOrigin?.lat ?? activeState.lat;
        const originLon = ensembleOrigin?.lon ?? activeState.lon;
        const startPt = project(originLat, originLon);
        ctx.moveTo(startPt.x, startPt.y);
        
        member.track.forEach((t) => {
          const { x, y } = project(t.lat, t.lon);
          ctx.lineTo(x, y);
        });
        ctx.stroke();
      });
    }

    // Control Path
    const tempTyphoon: Typhoon = {
      ...typhoon,
      lat: activeState.lat,
      lon: activeState.lon,
      vmax: activeState.vmax,
      pmin: activeState.pmin
    };
    const baseConfig: SimulationConfig = config || {
      subtropicalHighEnabled: true,
      subtropicalHighStrength: 1.0,
      subtropicalHighLat: 28.0,
      subtropicalHighLon: 135.0,
      subtropicalHighWestExtent: 125.0,
      westerliesEnabled: true,
      westerliesStrength: 1.0,
      westerliesLat: 30.0,
      westerliesTroughLon: 120.0,
      westerliesTroughDepth: 1.0,
      betaDriftEnabled: true,
      betaDriftScale: 1.0,
      monsoonTroughEnabled: false,
      eastWaveEnabled: false,
      shearScale: 1.0,
      humidityScale: 1.0,
      outflowScale: 1.0,
      dryAirEnabled: false,
      randomNoise: 0,
      sstAnomaly: 0,
      ohcScale: 1.0,
      warmPoolEnabled: true,
      coldEddyEnabled: false,
      airSeaCoupling: 1.0,
      ewrcTrigger: "auto",
      rapidIntensifyEnabled: true,
      landDecayEnabled: true,
      terrainDecayEnabled: true,
      landfallDecayAdjustment: 0,
      landProximityDecayAdjustment: 0,
      etEnabled: true,
      fujiwharaEnabled: true,
      seed: "12345",
      joystickSensitivity: 1.0,
      joystickStrength: 1.0,
      joystickDx: 0,
      joystickDy: 0,
      joystickDragging: false,
      soundEnabled: false,
      soundVolume: 0.5,
      followMainTyphoon: false,
      maxIntensityLimitEnabled: false,
      maxIntensityLimit: 70,
      intensificationRate: 1.0,
      coastlineSource: "natural_earth"
    };
    const controlForecast = calculateForecastPath(tempTyphoon, baseConfig, 360);

    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3.2 * scale;
    ctx.beginPath();

    const p0 = project(activeState.lat, activeState.lon);
    ctx.moveTo(p0.x, p0.y);

    controlForecast.forEach((f) => {
      const { x, y } = project(f.lat, f.lon);
      ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = "#000000";
    controlForecast.forEach((f) => {
      const { x, y } = project(f.lat, f.lon);
      ctx.beginPath();
      ctx.arc(x, y, 2.5 * scale, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore(); // Restore clip

    ctx.fillStyle = "#444444";
    ctx.font = `${11 * scale}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("https://jm.typhoon.vip", mapLeft + 10 * scale, mapBottom - 10 * scale);

    ctx.textAlign = "right";
    ctx.fillText(`审图号：${auditNumber}`, mapRight - 10 * scale, mapBottom - 10 * scale);

    const sbX = mapRight + 15 * scale;
    const sbY = mapTop;
    const sbW = W - mapRight - 95 * scale;
    const sbH = mapHeight;

    if (ensembleSubTab === "track") {
      const lgX = mapLeft + 15 * scale;
      const lgY = mapTop + 15 * scale;
      ctx.fillStyle = "rgba(255, 255, 255, 0.90)";
      ctx.fillRect(lgX, lgY, 110 * scale, 140 * scale);
      ctx.strokeStyle = "#cccccc";
      ctx.lineWidth = 1 * scale;
      ctx.strokeRect(lgX, lgY, 110 * scale, 140 * scale);

      const levels = [
        { label: "≥16级", color: "#7a0088" },
        { label: "≥14级", color: "#ff00ff" },
        { label: "≥12级", color: "#ff0000" },
        { label: "≥10级", color: "#ff9900" },
        { label: "≥8级",  color: "#0044cc" },
        { label: "≤7级",  color: "#00aa22" }
      ];

      ctx.font = `${11 * scale}px "Microsoft YaHei", sans-serif`;
      ctx.textAlign = "left";

      levels.forEach((lvl, idx) => {
        const itemY = lgY + 18 * scale + idx * 20 * scale;
        ctx.fillStyle = lvl.color;
        ctx.fillRect(lgX + 10 * scale, itemY - 8 * scale, 16 * scale, 8 * scale);
        ctx.fillStyle = "#111111";
        ctx.fillText(lvl.label, lgX + 32 * scale, itemY);
      });

      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(sbX, sbY, sbW, sbH);
      ctx.strokeStyle = "#cbd5e1";
      ctx.strokeRect(sbX, sbY, sbW, sbH);

      ctx.fillStyle = "#0f172a";
      ctx.font = `bold ${13 * scale}px "Microsoft YaHei", sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("成员最大风速排名", sbX + sbW / 2, sbY + 22 * scale);

      ctx.strokeStyle = "#e2e8f0";
      ctx.beginPath();
      ctx.moveTo(sbX, sbY + 32 * scale);
      ctx.lineTo(sbX + sbW, sbY + 32 * scale);
      ctx.stroke();

      ctx.font = `${9.5 * scale}px font-mono, sans-serif`;
      ctx.textAlign = "left";

      const maxShow = Math.floor((sbH - 40 * scale) / (14 * scale));
      for (let i = 0; i < maxShow && i < ensembleMembers.length; i++) {
        const m = ensembleMembers[i];
        const lineY = sbY + 46 * scale + i * 14 * scale;

        let rankColor = "#16a34a"; // <=7级 (Green)
        if (m.maxVmax >= 51.0) rankColor = "#7a0088"; // >=16级 (Purple)
        else if (m.maxVmax >= 41.5) rankColor = "#c026d3"; // >=14级 (Magenta)
        else if (m.maxVmax >= 32.7) rankColor = "#dc2626"; // >=12级 (Red)
        else if (m.maxVmax >= 24.5) rankColor = "#ea580c"; // >=10级 (Orange)
        else if (m.maxVmax >= 17.2) rankColor = "#0284c7"; // >=8级 (Blue)

        ctx.fillStyle = rankColor;
        ctx.fillText(`${m.id} : ${m.maxVmax}m/s ${m.minPmin}hPa`, sbX + 8 * scale, lineY);
      }
    } else {
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(sbX, sbY, sbW, sbH);
      ctx.strokeStyle = "#cbd5e1";
      ctx.strokeRect(sbX, sbY, sbW, sbH);

      ctx.fillStyle = "#0f172a";
      ctx.font = `bold ${12 * scale}px "Microsoft YaHei", sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("中心经过120km", sbX + sbW / 2, sbY + 22 * scale);
      ctx.fillText("范围内的概率", sbX + sbW / 2, sbY + 38 * scale);

      const barX = sbX + 25 * scale;
      const barY = sbY + 60 * scale;
      const barW = 20 * scale;
      const barH = sbH - 85 * scale;

      const grad = ctx.createLinearGradient(0, barY + barH, 0, barY);
      grad.addColorStop(0.0, "rgba(184, 248, 184, 0.4)");
      grad.addColorStop(0.1, "#60e060");
      grad.addColorStop(0.2, "#a0f020");
      grad.addColorStop(0.3, "#f8e020");
      grad.addColorStop(0.4, "#f8a020");
      grad.addColorStop(0.5, "#f86010");
      grad.addColorStop(0.6, "#f82010");
      grad.addColorStop(0.7, "#e00020");
      grad.addColorStop(0.85, "#d000a0");
      grad.addColorStop(1.0, "#9000d0");

      ctx.fillStyle = grad;
      ctx.fillRect(barX, barY, barW, barH);
      ctx.strokeStyle = "#666666";
      ctx.strokeRect(barX, barY, barW, barH);

      ctx.fillStyle = "#333333";
      ctx.font = `${10 * scale}px sans-serif`;
      ctx.textAlign = "left";

      for (let p = 0; p <= 100; p += 10) {
        const tickY = barY + barH - (p / 100) * barH;
        ctx.beginPath();
        ctx.moveTo(barX + barW, tickY);
        ctx.lineTo(barX + barW + 4 * scale, tickY);
        ctx.stroke();
        ctx.fillText(`${p}%`, barX + barW + 7 * scale, tickY + 3 * scale);
      }
    }
  };

  // Dispatcher for drawMapOnCanvas
  const drawMapOnCanvas = async (canvas: HTMLCanvasElement | null, isMini: boolean = false) => {
    if (!canvas) return;
    if (imageStyle === "scatterometer") {
      await drawScatterometerOnCanvas(canvas, isMini);
    } else if (imageStyle === "ensemble") {
      drawEnsembleMapOnCanvas(canvas, isMini);
    } else {
      drawStandardMapOnCanvas(canvas, isMini);
    }
  };

  useEffect(() => {
    if (!showWarning && isOpen) {
      // Trigger canvas drawing when parameters change
      const timer = setTimeout(() => {
        if (canvasRef.current) {
          drawMapOnCanvas(canvasRef.current);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [
    showWarning, 
    isOpen, 
    resolutionId, 
    typhoonName, 
    typhoonNumber, 
    forecastHours, 
    auditNumber, 
    geoJsonLoaded,
    historyInterval,
    showInfoBoxes,
    showLandfallBox,
    showForecastBox,
    showCenterBox,
    boxDensity,
    imageStyle,
    ensembleSubTab,
    ensembleMembers
  ]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsGenerating(true);
    setGenerationProgress(0);
    try {
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 60)));
      
      await drawMapOnCanvas(canvas);
      
      setGenerationProgress(100);
      
      const dataUrl = canvas.toDataURL("image/png");
      setPreviewDataUrl(dataUrl);
    } catch (err) {
      console.error("Generating image failed:", err);
    } finally {
      setIsGenerating(false);
    }
  };
  
  
  const handleGenerateChart = () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Parse aspect ratio
    const [wRatio, hRatio] = chartMakerConfig.aspectRatio.split(":").map(Number);
    const baseWidth = 1200;
    const baseHeight = Math.round((baseWidth / wRatio) * hRatio);
    
    const scale = chartMakerConfig.resolution;
    canvas.width = baseWidth * scale;
    canvas.height = baseHeight * scale;
    
    ctx.scale(scale, scale);
    
    // Background - Crisp Light Paper (Professional Report Style)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, baseWidth, baseHeight);

    // Subtle Outer Frame Line
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, baseWidth - 32, baseHeight - 32);

    // Grid & Layout
    const padding = 50;
    let drawX = padding;
    let drawY = padding;
    let drawW = baseWidth - padding * 2;
    let drawH = baseHeight - padding * 2;
    
    const getElementUnit = () => rankingElement === "precip" ? "mm" : "m/s";
    const getElementName = () => {
      if (rankingElement === "gust") return "极大风速";
      if (rankingElement === "avgWind") return "平均风速";
      return "最大降水量";
    };

    if (chartMakerConfig.showInfo) {
      // Header Banner
      ctx.fillStyle = "#0f172a";
      ctx.font = `bold ${28}px sans-serif`;
      ctx.fillText(`${typhoon.name || "无名"}台风实测${getElementName()}排行报告`, drawX, drawY + 28);
      
      ctx.fillStyle = "#475569";
      ctx.font = `500 ${15}px sans-serif`;
      const simTime = new Date(startDate.getTime() + currentHour * 3600000);
      const y = simTime.getFullYear();
      const m = String(simTime.getMonth() + 1).padStart(2, "0");
      const d = String(simTime.getDate()).padStart(2, "0");
      const hh = String(simTime.getHours()).padStart(2, "0");
      const timeStr = `${y}-${m}-${d} ${hh}:00`;
      ctx.fillText(`统计窗口: 过去 ${rankingWindow} 小时  |  模拟起报时间: ${timeStr}  |  数据来源: 气象站网实测`, drawX, drawY + 58);
      
      // Header Divider
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(drawX, drawY + 72);
      ctx.lineTo(drawX + drawW, drawY + 72);
      ctx.stroke();

      drawY += 90;
      drawH -= 90;
    }
    
    const rawRankings = getStationRankings(typhoon.history || [], currentHour, rankingWindow);
    const sorted = [...rawRankings].sort((a, b) => b[rankingElement] - a[rankingElement]);
    const topData = sorted.slice(0, chartMakerConfig.topN);
    
    const maxVal = Math.max(...topData.map(d => d[rankingElement]), 10);

    // Draw horizontal grid lines behind chart
    const gridCount = 5;
    ctx.strokeStyle = "#f1f5f9";
    ctx.lineWidth = 1;
    for (let g = 0; g <= gridCount; g++) {
      const gy = drawY + (drawH - 40) * (g / gridCount);
      ctx.beginPath();
      ctx.moveTo(drawX, gy);
      ctx.lineTo(drawX + drawW, gy);
      ctx.stroke();
    }
    
    // Bar Colors: Professional Navy/Teal
    const isPrecip = rankingElement === "precip";
    const colorStart = isPrecip ? "#0f766e" : "#1e3a8a";
    const colorEnd = isPrecip ? "#14b8a6" : "#2563eb";

    if (chartMakerConfig.chartType === "column") {
      // Column (Vertical bars)
      const stepW = drawW / topData.length;
      const barW = Math.max(12, stepW * 0.55);
      
      topData.forEach((d, i) => {
        const val = d[rankingElement];
        const barH = (val / maxVal) * (drawH - 60);
        const bx = drawX + i * stepW + (stepW - barW) / 2;
        const by = drawY + drawH - barH - 35;
        
        // Bar Gradient
        const grad = ctx.createLinearGradient(0, by, 0, by + barH);
        grad.addColorStop(0, colorEnd);
        grad.addColorStop(1, colorStart);
        ctx.fillStyle = grad;
        
        ctx.beginPath();
        ctx.roundRect(bx, by, barW, barH, [4, 4, 0, 0]);
        ctx.fill();
        
        // Value Text
        ctx.fillStyle = "#0f172a";
        ctx.font = `bold ${14}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(`${val.toFixed(1)}`, bx + barW / 2, by - 8);
        
        // Name Text
        ctx.fillStyle = "#334155";
        ctx.font = `500 ${13}px sans-serif`;
        ctx.fillText(d.name, bx + barW / 2, drawY + drawH - 10);
      });
    } else {
      // Bar (Horizontal bars)
      const stepH = (drawH - 30) / topData.length;
      const barH = Math.max(10, stepH * 0.55);
      
      topData.forEach((d, i) => {
        const val = d[rankingElement];
        const labelW = 100;
        const barW = (val / maxVal) * (drawW - labelW - 70);
        const bx = drawX + labelW;
        const by = drawY + i * stepH + (stepH - barH) / 2;
        
        // Bar Gradient
        const grad = ctx.createLinearGradient(bx, 0, bx + barW, 0);
        grad.addColorStop(0, colorStart);
        grad.addColorStop(1, colorEnd);
        ctx.fillStyle = grad;
        
        ctx.beginPath();
        ctx.roundRect(bx, by, barW, barH, [0, 4, 4, 0]);
        ctx.fill();
        
        // Name Text (Left side)
        ctx.fillStyle = "#1e293b";
        ctx.font = `bold ${14}px sans-serif`;
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(d.name, bx - 12, by + barH / 2);
        
        // Value Text (Right side)
        ctx.fillStyle = "#0f172a";
        ctx.font = `bold ${14}px sans-serif`;
        ctx.textAlign = "left";
        ctx.fillText(`${val.toFixed(1)} ${getElementUnit()}`, bx + barW + 10, by + barH / 2);
      });
    }

    // Footer Agency Stamp / Note
    ctx.fillStyle = "#94a3b8";
    ctx.font = `12px sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("国家与地方气象自动站网 实测数据监控平台", drawX + drawW, baseHeight - 22);

    // Download
    const link = document.createElement("a");
    link.download = `${typhoon.name || "无名"}台风实测${getElementName()}排行报告.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handleDownloadActual = () => {
    if (!previewDataUrl) return;
    const link = document.createElement("a");
    link.download = `${typhoonName}_${forecastHours}h_${imageStyle}_预报图.png`;
    link.href = previewDataUrl;
    link.click();
    setPreviewDataUrl(null);
  };

  // Render Station Rankings full-screen page
    const renderRankingsPopup = () => {
    if (!showRankings) return null;

    const rawRankings = getStationRankings(typhoon.history || [], currentHour, rankingWindow);
    const sortedRankings = [...rawRankings].sort((a, b) => b[rankingElement] - a[rankingElement]);
    const filteredRankings = sortedRankings.filter((item) =>
      item.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
    );

    const getElementUnit = () => rankingElement === "precip" ? "mm" : "m/s";
    const getElementName = () => {
      if (rankingElement === "gust") return "极大风速";
      if (rankingElement === "avgWind") return "平均风速";
      return "最大降水量";
    };

    const handleCopyRankings = () => {
      const header = `气象站实测排行报告 (前30名)\n--------------------------------------\n台风名称: ${typhoon.name || "无名"}\n时间窗口: ${rankingWindow}小时\n气象要素: ${getElementName()}\n\n排名 | 站点名称 | 数值 (${getElementUnit()})\n--------------------------------------\n`;
      const rows = sortedRankings
        .slice(0, 30)
        .map((item, i) => `${String(i + 1).padStart(2, " ")}   | ${item.name.padEnd(8, "　")} | ${item[rankingElement].toFixed(1)} ${getElementUnit()}`)
        .join("\n");
      navigator.clipboard.writeText(header + rows).then(() => {
        setCopiedRanking(true);
        setTimeout(() => setCopiedRanking(false), 2000);
      });
    };

    return (
      <div className="fixed inset-0 z-[7500] bg-slate-950/95 flex flex-col text-slate-100 animate-fade-in overflow-hidden font-sans backdrop-blur-xl">
        {/* Full screen header */}
        <div className="bg-slate-900/50 border-b border-slate-800 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
              <Table className="w-5 h-5" />
            </span>
            <span className="text-xs bg-blue-500/20 border border-blue-500/30 text-blue-400 font-bold px-2.5 py-1 rounded-full">
              {typhoon.name || "无名"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowChartMaker(true)}
              title="生成分析图表"
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/50 transition cursor-pointer flex items-center justify-center"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              onClick={handleCopyRankings}
              title="导出数据"
              className={`p-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                copiedRanking ? "bg-teal-600 text-white" : "bg-slate-800 hover:bg-slate-700 text-slate-300"
              }`}
            >
              {copiedRanking ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setShowRankings(false)}
              title="关闭"
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Chart Maker Modal */}
        {showChartMaker && (
          <div className="fixed inset-0 z-[7600] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-slate-900 w-full max-w-lg rounded-2xl flex flex-col border border-slate-700 shadow-2xl overflow-hidden animate-scale-up">
              <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-800/50">
                <h2 className="text-white font-bold flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-400" />
                  制作气象实测图表
                </h2>
                <button onClick={() => setShowChartMaker(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/80 cursor-pointer">
                  <X className="w-5 h-5"/>
                </button>
              </div>
              
              <div className="flex flex-col p-6 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-bold block">图表方向</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setChartMakerConfig(p => ({...p, chartType: "bar"}))} className={`py-2 rounded-lg text-xs font-bold transition cursor-pointer border ${chartMakerConfig.chartType === "bar" ? "bg-indigo-600/20 border-indigo-500 text-indigo-400" : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600"}`}>条形图 (横向)</button>
                      <button onClick={() => setChartMakerConfig(p => ({...p, chartType: "column"}))} className={`py-2 rounded-lg text-xs font-bold transition cursor-pointer border ${chartMakerConfig.chartType === "column" ? "bg-indigo-600/20 border-indigo-500 text-indigo-400" : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600"}`}>柱状图 (纵向)</button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs text-slate-400 font-bold block">画面比例</label>
                      <select value={chartMakerConfig.aspectRatio} onChange={(e) => setChartMakerConfig(p => ({...p, aspectRatio: e.target.value}))} className="w-full bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer">
                        <option value="16:9">16:9 (宽屏)</option>
                        <option value="4:3">4:3 (标准)</option>
                        <option value="1:1">1:1 (方形)</option>
                        <option value="9:16">9:16 (竖屏)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-slate-400 font-bold block">清晰度</label>
                      <select value={chartMakerConfig.resolution} onChange={(e) => setChartMakerConfig(p => ({...p, resolution: Number(e.target.value)}))} className="w-full bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer">
                        <option value="1">1X (标准)</option>
                        <option value="2">2X (高清)</option>
                        <option value="3">3X (超清)</option>
                        <option value="4">4X (4K级)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-bold flex justify-between">
                      <span>展示前 N 名</span>
                      <span className="text-indigo-400">Top {chartMakerConfig.topN}</span>
                    </label>
                    <input type="range" min="5" max="30" step="5" value={chartMakerConfig.topN} onChange={(e) => setChartMakerConfig(p => ({...p, topN: Number(e.target.value)}))} className="w-full accent-indigo-500" />
                  </div>
                </div>
                
                <button onClick={handleGenerateChart} className="w-full py-3 mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-indigo-900/50">
                  <Download className="w-4 h-4" />
                  生成并下载高清图表
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filters Bar */}
        <div className="bg-slate-900/30 border-b border-slate-800/80 px-6 py-3 flex flex-wrap items-center gap-6 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-bold">时间窗口:</span>
            <div className="flex bg-slate-800/50 p-1 rounded-lg border border-slate-700/50">
              {([1, 3, 6, 12, 24, 48, 72] as const).map((w) => (
                <button
                  key={w}
                  onClick={() => setRankingWindow(w)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                    rankingWindow === w ? "bg-slate-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                  }`}
                >
                  {w}h
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-bold">排行要素:</span>
            <div className="flex bg-slate-800/50 p-1 rounded-lg border border-slate-700/50">
              {(["gust", "avgWind", "precip"] as const).map((elem) => (
                <button
                  key={elem}
                  onClick={() => setRankingElement(elem)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                    rankingElement === elem ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                  }`}
                >
                  {elem === "gust" ? "阵风" : elem === "avgWind" ? "平均风" : "降水"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="搜索站点名称..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700 text-slate-200 text-sm px-4 py-1.5 rounded-lg focus:outline-none focus:border-blue-500 placeholder-slate-500 transition"
            />
          </div>
        </div>

        {/* Content area: Clean Table */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 bg-slate-950">
          <div className="w-full max-w-5xl mx-auto h-full flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden min-h-0">
            <div className="overflow-x-auto overflow-y-auto h-full scrollbar-thin">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-800/80 sticky top-0 z-10 backdrop-blur-md shadow-sm">
                  <tr>
                    <th className="py-4 px-6 text-xs font-bold text-slate-400 w-24">排名</th>
                    <th className="py-4 px-6 text-xs font-bold text-slate-400">气象站名称</th>
                    <th className="py-4 px-6 text-xs font-bold text-slate-400 text-right">{getElementName()} ({getElementUnit()})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filteredRankings.slice(0, 30).map((item, idx) => {
                    const isTop3 = idx < 3;
                    return (
                      <tr key={item.name} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-6">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold ${
                            idx === 0 ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                            idx === 1 ? "bg-slate-300/20 text-slate-300 border border-slate-400/30" :
                            idx === 2 ? "bg-orange-700/20 text-orange-400 border border-orange-700/30" :
                            "text-slate-500"
                          }`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-3 px-6 font-medium text-slate-300">{item.name}</td>
                        <td className={`py-3 px-6 text-right font-mono text-sm font-bold ${
                          rankingElement === "precip" ? "text-teal-400" :
                          rankingElement === "gust" ? "text-red-400" : "text-blue-400"
                        }`}>
                          {item[rankingElement].toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredRankings.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-12 text-center text-slate-500 text-sm">暂无符合条件的实测数据</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };
;

  // Render Snapshot overlay
  const renderSnapshotPopup = () => {
    if (!showSnapshot) return null;

    const formatCoordinate = (lat: number, lon: number) => {
      const latDeg = Math.floor(Math.abs(lat));
      const latMin = ((Math.abs(lat) - latDeg) * 60).toFixed(2);
      const latDir = lat >= 0 ? "N" : "S";
      const latStr = `${latDeg}°${latMin}′${latDir}`;

      const lonDeg = Math.floor(Math.abs(lon));
      const lonMin = ((Math.abs(lon) - lonDeg) * 60).toFixed(2);
      const lonDir = lon >= 0 ? "E" : "W";
      const lonStr = `${lonDeg}°${lonMin}′${lonDir}`;

      return { latStr, lonStr };
    };

    const activeState = typhoon.history?.find((h) => h.simHour === currentHour) || typhoon;
    const { latStr, lonStr } = formatCoordinate(activeState.lat, activeState.lon);

    // Calculate intensification rate
    let speedTrend = 0;
    if (typhoon.history && typhoon.history.length > 0) {
      const idx = typhoon.history.findIndex((h) => h.simHour === currentHour);
      if (idx > 0) {
        speedTrend = activeState.vmax - typhoon.history[idx - 1].vmax;
      } else if (idx === 0) {
        speedTrend = activeState.vmax - typhoon.vmax;
      }
    }
    const trendStr = speedTrend >= 0 ? `+${speedTrend.toFixed(1)} m/s/h` : `${speedTrend.toFixed(1)} m/s/h`;

    const statusStr = getSnapshotStatusText(activeState);
    const dirText = getCompassDirection(activeState.direction);
    const dirStr = `${dirText} (${activeState.direction}°)`;
    const moveSpeedStr = `${activeState.speed} km/h`;

    const r7 = activeState.r7 || { ne: 0, se: 0, sw: 0, nw: 0 };
    const r10 = activeState.r10 || { ne: 0, se: 0, sw: 0, nw: 0 };
    const r12 = activeState.r12 || { ne: 0, se: 0, sw: 0, nw: 0 };

    const getFormattedDate = (hour: number) => {
      const timeMs = startDate.getTime() + hour * 60 * 60 * 1000;
      const currentSimTime = new Date(timeMs);
      const mm = String(currentSimTime.getMonth() + 1).padStart(2, "0");
      const dd = String(currentSimTime.getDate()).padStart(2, "0");
      const hh = String(currentSimTime.getHours()).padStart(2, "0");
      return `${currentSimTime.getFullYear()}-${mm}-${dd} ${hh}:00`;
    };

    const copyText = `台风快照数据信息报告
--------------------------------------
台风名称: ${typhoon.name || "无名"} (编号: ${typhoonNumber})
当前时间: UTC+8 ${getFormattedDate(currentHour)}
当前位置: 纬度 ${latStr}, 经度 ${lonStr}
台风气压: ${activeState.pmin} hPa
台风强度: ${activeState.vmax.toFixed(1)} m/s (${getWindForceCategory(activeState.vmax)}级, ${activeState.category})
增强速度: ${trendStr}
物理状态: ${statusStr}
移动方向: ${dirStr}
移动速度: ${moveSpeedStr}

风圈半径数据:
7级风圈半径:
  东北象限: ${r7.ne}公里, 东南象限: ${r7.se}公里, 西南象限: ${r7.sw}公里, 西北象限: ${r7.nw}公里
10级风圈半径:
  东北象限: ${r10.ne}公里, 东南象限: ${r10.se}公里, 西南象限: ${r10.sw}公里, 西北象限: ${r10.nw}公里
12级风圈半径:
  东北象限: ${r12.ne}公里, 东南象限: ${r12.se}公里, 西南象限: ${r12.sw}公里, 西北象限: ${r12.nw}公里
--------------------------------------
本报告数据基于台风模拟预报引擎实时测算生成`;

    const handleCopy = () => {
      navigator.clipboard.writeText(copyText).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    };

    const CopyButton = ({ text, paramId }: { text: string; paramId: string }) => {
      const isCopied = copiedParam === paramId;
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(text).then(() => {
              setCopiedParam(paramId);
              setTimeout(() => setCopiedParam(null), 1500);
            });
          }}
          className="p-1 hover:bg-slate-800 rounded transition text-slate-500 hover:text-white cursor-pointer ml-1 inline-flex items-center flex-shrink-0"
          title="复制此项参数"
        >
          {isCopied ? (
            <Check className="w-3 h-3 text-teal-400" />
          ) : (
            <Copy className="w-3 h-3 text-slate-400 hover:text-slate-200" />
          )}
        </button>
      );
    };

    return (
      <div className="fixed inset-0 z-[7000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl flex flex-col text-slate-100 relative">
          <button
            type="button"
            onClick={() => setShowSnapshot(false)}
            className="absolute top-4 right-4 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
            title="关闭弹窗"
          >
            <X className="w-4 h-4" />
          </button>

          <h3 className="text-base font-bold text-slate-200 mb-4 pb-2 border-b border-slate-800 flex items-center gap-2">
            🌀 {typhoon.name || "无名"} 台风实时物理快照
          </h3>

          <div className="flex-1 overflow-y-auto max-h-[60vh] space-y-4 font-sans text-sm pr-1">
            <div className="grid grid-cols-2 gap-y-3 gap-x-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800/60">
              <div className="flex justify-between items-start group">
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-slate-500 block">台风名 (编号)</span>
                  <span className="font-semibold text-slate-200 block truncate">{typhoon.name || "无名"} (${typhoonNumber})</span>
                </div>
                <CopyButton text={`${typhoon.name || "无名"} (${typhoonNumber})`} paramId="name" />
              </div>
              <div className="flex justify-between items-start group">
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-slate-500 block">当前时间 (UTC+8)</span>
                  <span className="font-semibold text-slate-200 block truncate">{getFormattedDate(currentHour)}</span>
                </div>
                <CopyButton text={getFormattedDate(currentHour)} paramId="time" />
              </div>
              <div className="flex justify-between items-start group">
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-slate-500 block">当前坐标 (经纬度)</span>
                  <span className="font-semibold text-teal-400 font-mono block truncate">{latStr}, {lonStr}</span>
                </div>
                <CopyButton text={`${latStr}, ${lonStr}`} paramId="coord" />
              </div>
              <div className="flex justify-between items-start group">
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-slate-500 block">中心最低气压</span>
                  <span className="font-semibold text-blue-400 font-mono block truncate">{activeState.pmin} hPa</span>
                </div>
                <CopyButton text={`${activeState.pmin} hPa`} paramId="pmin" />
              </div>
              <div className="flex justify-between items-start group">
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-slate-500 block">当前最大风速 (强度)</span>
                  <span className="font-semibold text-orange-400 font-mono block truncate">
                    {activeState.vmax.toFixed(1)} m/s ({getWindForceCategory(activeState.vmax)}级, {activeState.category})
                  </span>
                </div>
                <CopyButton text={`${activeState.vmax.toFixed(1)} m/s (${getWindForceCategory(activeState.vmax)}级, ${activeState.category})`} paramId="vmax" />
              </div>
              <div className="flex justify-between items-start group">
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-slate-500 block">强度变化率 (增强速度)</span>
                  <span className={`font-semibold font-mono block truncate ${speedTrend > 0 ? "text-rose-400" : speedTrend < 0 ? "text-blue-400" : "text-slate-400"}`}>
                    {trendStr}
                  </span>
                </div>
                <CopyButton text={trendStr} paramId="trend" />
              </div>
              <div className="flex justify-between items-start group">
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-slate-500 block">移动方向 (方位角)</span>
                  <span className="font-semibold text-indigo-400 font-mono block truncate">{dirStr}</span>
                </div>
                <CopyButton text={dirStr} paramId="dir" />
              </div>
              <div className="flex justify-between items-start group">
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-slate-500 block">移动速度</span>
                  <span className="font-semibold text-violet-400 font-mono block truncate">{moveSpeedStr}</span>
                </div>
                <CopyButton text={moveSpeedStr} paramId="speed" />
              </div>
              <div className="col-span-2 border-t border-slate-800/50 pt-2 mt-1 flex justify-between items-start group">
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-slate-500 block">当前物理状态</span>
                  <span className="font-bold text-orange-500 block truncate">{statusStr}</span>
                </div>
                <CopyButton text={statusStr} paramId="status" />
              </div>
            </div>

            <div className="space-y-2 bg-slate-950/40 p-4 rounded-xl border border-slate-800/40 font-mono text-xs">
              <span className="text-xs text-slate-400 font-bold block mb-2 border-b border-slate-800/80 pb-1">各级风圈半径 (东北/东南/西南/西北)</span>
              <div className="grid grid-cols-1 gap-2 text-slate-300">
                <div className="flex justify-between items-center bg-slate-900/40 px-2 py-1 rounded group">
                  <span className="text-[#1E9CFF] font-semibold">7级风圈半径:</span>
                  <div className="flex items-center">
                    <span className="text-slate-200">{r7.ne} / {r7.se} / {r7.sw} / {r7.nw} (公里)</span>
                    <CopyButton text={`7级风圈半径: 东北:${r7.ne}公里, 东南:${r7.se}公里, 西南:${r7.sw}公里, 西北:${r7.nw}公里`} paramId="r7" />
                  </div>
                </div>
                <div className="flex justify-between items-center bg-slate-900/40 px-2 py-1 rounded group">
                  <span className="text-orange-500 font-semibold">10级风圈半径:</span>
                  <div className="flex items-center">
                    <span className="text-slate-200">{r10.ne} / {r10.se} / {r10.sw} / {r10.nw} (公里)</span>
                    <CopyButton text={`10级风圈半径: 东北:${r10.ne}公里, 东南:${r10.se}公里, 西南:${r10.sw}公里, 西北:${r10.nw}公里`} paramId="r10" />
                  </div>
                </div>
                <div className="flex justify-between items-center bg-slate-900/40 px-2 py-1 rounded group">
                  <span className="text-red-500 font-semibold">12级风圈半径:</span>
                  <div className="flex items-center">
                    <span className="text-slate-200">{r12.ne} / {r12.se} / {r12.sw} / {r12.nw} (公里)</span>
                    <CopyButton text={`12级风圈半径: 东北:${r12.ne}公里, 东南:${r12.se}公里, 西南:${r12.sw}公里, 西北:${r12.nw}公里`} paramId="r12" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowSnapshot(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition cursor-pointer"
            >
              关闭
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className={`px-4 py-2 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer ${
                copied ? "bg-emerald-600 text-white" : "bg-sky-500 hover:bg-sky-600 text-slate-950"
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "已复制" : "复制全部内容"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      id="forecast-modal-overlay"
      className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 text-white overflow-hidden"
    >
      {showWarning ? (
        // 1. Disclaimer Warning Dialog
        <div
          id="disclaimer-dialog"
          className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl flex flex-col gap-5 text-center animate-in zoom-in-95 duration-200"
        >
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-orange-500">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-bold text-slate-100">预报图生成服务条款</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              “生成的预报图仅供娱乐自用 请勿散播”
            </p>
            <p className="text-xs text-red-400/90 leading-relaxed bg-red-950/20 border border-red-900/30 rounded-lg p-2.5 mt-2">
              本工具生成的台风概率预报图属于虚拟模拟产物，严禁作为真实气象预测信息在公开社交媒体传播，避免引起公众恐慌或混淆。
            </p>
          </div>

          <div className="flex gap-3 mt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition cursor-pointer text-sm"
            >
              取消
            </button>
            <button
              onClick={() => setShowWarning(false)}
              className="flex-1 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition cursor-pointer text-sm"
            >
              我已知晓并同意
            </button>
          </div>
        </div>
      ) : (
        // 2. Full Parameter Settings and Preview Page
        <div
          id="forecast-editor-main"
          className="w-full max-w-2xl max-h-[90vh] rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-98 duration-300 relative"
        >
          {/* Offscreen Canvas for high-res map rendering */}
          <canvas
            ref={canvasRef}
            width={selectedRes.width}
            height={selectedRes.height}
            className="hidden"
          />

          {/* Controls Settings */}
          <div className="w-full bg-slate-900 p-6 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-400" />
                  <h3 className="text-lg font-bold text-slate-100">参数调整</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSnapshot(true);
                      setCopied(false);
                    }}
                    className="p-1.5 rounded-lg bg-emerald-500/10 border border-teal-500/30 text-teal-400 hover:bg-teal-500/20 hover:text-white transition cursor-pointer flex items-center justify-center"
                    title="台风物理状态快照"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRankings(true);
                      setCopiedRanking(false);
                    }}
                    className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 hover:text-white transition cursor-pointer flex items-center justify-center"
                    title="气象站实测排行"
                  >
                    <Table className="w-4 h-4" />
                  </button>
                  <button
                    onClick={onClose}
                    className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Mini Preview Box */}
              <div className="mb-6 space-y-2">
                {/* Preview box removed as requested */}
              </div>

              {/* Typhoon Basic Fields */}
              <div className="space-y-4">
                {/* Image Style Selector */}
                <div className="space-y-2">
                  <label className="text-xs text-slate-400 block font-medium">预报图风格选择</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setImageStyle("standard")}
                      className={`px-2 py-2 rounded-xl text-xs font-bold transition flex flex-col items-center gap-1 border cursor-pointer ${
                        imageStyle === "standard"
                          ? "bg-blue-500/20 border-sky-500 text-sky-300"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <span>官方标准</span>
                      <span className="text-[9px] text-slate-500 font-normal">NMC 标准图</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setImageStyle("ensemble")}
                      className={`px-2 py-2 rounded-xl text-xs font-bold transition flex flex-col items-center gap-1 border cursor-pointer ${
                        imageStyle === "ensemble"
                          ? "bg-indigo-500/20 border-purple-500 text-purple-300"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <span>集合与概率</span>
                      <span className="text-[9px] text-slate-500 font-normal">{ensembleMemberCount} 组模式</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setImageStyle("scatterometer")}
                      className={`px-2 py-2 rounded-xl text-xs font-bold transition flex flex-col items-center gap-1 border cursor-pointer ${
                        imageStyle === "scatterometer"
                          ? "bg-orange-500/20 border-orange-500 text-orange-300"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <span>风场实况扫描</span>
                      <span className="text-[9px] text-slate-500 font-normal">HY-2C HSCAT</span>
                    </button>
                  </div>
                </div>

                {/* Ensemble Controls Sub-panel */}
                {imageStyle === "ensemble" && (
                  <div className="space-y-3 bg-purple-950/30 p-3 rounded-xl border border-purple-800/40">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-300">{ensembleMemberCount} 组模式集合推演</span>
                      {ensembleMembers.length > 0 && (
                        <span className="text-[10px] bg-indigo-500/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/40 font-mono">
                          {ensembleMembers.length} 已完成
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-indigo-400 block font-bold tracking-wider uppercase">集合成员数量</label>
                      <select
                        value={ensembleMemberCount}
                        onChange={(e) => {
                          const count = Number(e.target.value);
                          setEnsembleMemberCount(count);
                          setEnsembleMembers([]); 
                          // Requirement 4: Auto-restart calculation when count changes for immediate feedback
                          if (!isCalculatingEnsemble) {
                            setTimeout(() => {
                              runEnsembleSimulationWithCount(count);
                            }, 50);
                          }
                        }}
                        disabled={isCalculatingEnsemble}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-purple-500/80 transition cursor-pointer"
                      >
                        <option value={50}>50 成员 (精简/极速)</option>
                        <option value={100}>100 成员 (平衡/默认)</option>
                        <option value={200}>200 成员 (高精度)</option>
                        <option value={500}>500 成员 (专业模式)</option>
                        <option value={1000}>1000 成员 (超级机群模式)</option>
                      </select>
                    </div>

                    {isCalculatingEnsemble ? (
                      <div className="space-y-2 py-1">
                        <div className="flex justify-between text-xs text-purple-300 font-mono">
                          <span>推演 {ensembleMemberCount} 组物理路径...</span>
                          <span>{ensembleProgress}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-purple-800/60">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-150"
                            style={{ width: `${ensembleProgress}%` }}
                          />
                        </div>
                      </div>
                    ) : ensembleMembers.length === 0 ? (
                      <button
                        type="button"
                        onClick={runEnsembleSimulation}
                        className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-600/30"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        开始计算 {ensembleMemberCount} 组成员路径及概率
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setEnsembleSubTab("track")}
                            className={`py-2 text-xs font-bold rounded-lg border transition cursor-pointer ${
                              ensembleSubTab === "track"
                                ? "bg-purple-500 text-white border-purple-400"
                                : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                            }`}
                          >
                            图一：集合路径
                          </button>
                          <button
                            type="button"
                            onClick={() => setEnsembleSubTab("probability")}
                            className={`py-2 text-xs font-bold rounded-lg border transition cursor-pointer ${
                              ensembleSubTab === "probability"
                                ? "bg-purple-500 text-white border-purple-400"
                                : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                            }`}
                          >
                            图二：袭击概率
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={runEnsembleSimulation}
                          className="w-full py-1 text-[11px] text-purple-300 hover:text-white transition flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" /> 重新推演 {ensembleMemberCount} 组成员
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {/* Style-Specific Parameter Panels */}
                {imageStyle === "standard" && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400 block font-medium">台风名称</label>
                      <input
                        type="text"
                        value={typhoonName}
                        onChange={(e) => setTyphoonName(e.target.value)}
                        maxLength={10}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500/80 transition"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400 block font-medium">台风编号</label>
                      <input
                        type="text"
                        value={typhoonNumber}
                        onChange={(e) => setTyphoonNumber(e.target.value)}
                        maxLength={6}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500/80 transition font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400 block font-medium">预报时效 (未来)</label>
                      <select
                        value={forecastHours}
                        onChange={(e) => setForecastHours(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500/80 transition"
                      >
                        <option value={24}>24 小时</option>
                        <option value={48}>48 小时</option>
                        <option value={72}>72 小时</option>
                        <option value={96}>96 小时</option>
                        <option value={120}>120 小时</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400 block font-medium">历史路径打点频率</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setHistoryInterval(3)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                            historyInterval === 3
                              ? "bg-blue-500/20 border-cyan-500 text-cyan-300"
                              : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                          }`}
                        >
                          3 小时 / 点
                        </button>
                        <button
                          type="button"
                          onClick={() => setHistoryInterval(1)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                            historyInterval === 1
                              ? "bg-blue-500/20 border-cyan-500 text-cyan-300"
                              : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                          }`}
                        >
                          1 小时 / 点
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 border-t border-slate-800/40 pt-4">
                      <label className="text-xs text-slate-400 block font-medium">信息框显示选项</label>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-300">显示预报信息框</span>
                        <button
                          onClick={() => setShowInfoBoxes(!showInfoBoxes)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                            showInfoBoxes ? "bg-cyan-500" : "bg-slate-700"
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                              showInfoBoxes ? "translate-x-5" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      </div>

                      {showInfoBoxes && (
                        <div className="space-y-4 pl-3 border-l-2 border-slate-800/60 mt-3 mb-2">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">标注分布密度</label>
                              <span className="text-[10px] bg-slate-800 text-blue-400 px-1.5 py-0.5 rounded font-mono">Lv.{boxDensity}</span>
                            </div>
                            <input
                              type="range"
                              min="1"
                              max="5"
                              step="1"
                              value={boxDensity}
                              onChange={(e) => setBoxDensity(Number(e.target.value))}
                              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                            />
                            <div className="flex justify-between text-[9px] text-slate-600 px-0.5">
                              <span>稀疏</span>
                              <span>默认</span>
                              <span>密集</span>
                            </div>
                          </div>

                          <div className="space-y-2.5">
                            <div className="flex items-center gap-3 group" onClick={() => setShowCenterBox(!showCenterBox)}>
                              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${showCenterBox ? "bg-cyan-500 border-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.3)]" : "border-slate-700 bg-slate-950"}`}>
                                {showCenterBox && <Check className="w-2.5 h-2.5 text-slate-950 stroke-[3]" />}
                              </div>
                              <span className={`text-xs transition-colors ${showCenterBox ? "text-slate-200" : "text-slate-500"} cursor-pointer`}>现状位置框 (Present)</span>
                            </div>

                            <div className="flex items-center gap-3 group" onClick={() => setShowForecastBox(!showForecastBox)}>
                              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${showForecastBox ? "bg-cyan-500 border-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.3)]" : "border-slate-700 bg-slate-950"}`}>
                                {showForecastBox && <Check className="w-2.5 h-2.5 text-slate-950 stroke-[3]" />}
                              </div>
                              <span className={`text-xs transition-colors ${showForecastBox ? "text-slate-200" : "text-slate-500"} cursor-pointer`}>预报节点框 (Forecast)</span>
                            </div>

                            <div className="flex items-center gap-3 group" onClick={() => setShowLandfallBox(!showLandfallBox)}>
                              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${showLandfallBox ? "bg-cyan-500 border-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.3)]" : "border-slate-700 bg-slate-950"}`}>
                                {showLandfallBox && <Check className="w-2.5 h-2.5 text-slate-950 stroke-[3]" />}
                              </div>
                              <span className={`text-xs transition-colors ${showLandfallBox ? "text-slate-200" : "text-slate-500"} cursor-pointer`}>登陆预报框 (Landfall)</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {imageStyle === "scatterometer" && (
                  <div className="space-y-4 bg-orange-950/20 p-4 rounded-xl border border-orange-800/40">
                    <div className="flex items-center justify-between border-b border-orange-800/30 pb-2">
                      <span className="text-xs font-bold text-orange-300">实况风场扫描图高阶参数调节</span>
                      <button
                        type="button"
                        onClick={() => {
                          setScatBarbSpacing(0.07);
                          setScatBarbLength(11.0);
                          setScatBarbWidth(1.0);
                          setScatOrbitAngle(15.0);
                          setScatSwathWidth(7.0);
                          setScatNadirWidth(1.0);
                          setScatBackgroundScale(1.0);
                          setShowNadirGap(true);
                          setScatterometerLandData(false);
                        }}
                        className="text-[10px] bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 px-2 py-1 rounded border border-orange-500/30 cursor-pointer transition font-medium"
                      >
                        恢复默认值
                      </button>
                    </div>

                    {/* Map Zoom Level */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-300 font-medium">地图视角范围 (缩放等级)</span>
                        <span className="text-orange-400 font-mono font-bold">
                          {scatZoomSpan.toFixed(1)}° (视角越小放大倍数越高)
                        </span>
                      </div>
                      <input
                        type="range"
                        min="6.0"
                        max="30.0"
                        step="1.0"
                        value={scatZoomSpan}
                        onChange={(e) => setScatZoomSpan(Number(e.target.value))}
                        className="w-full accent-orange-500 h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer border border-slate-800"
                      />
                    </div>

                    {/* Barb Spacing (Density) */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-300 font-medium">风标采样格点间距 (密度)</span>
                        <span className="text-orange-400 font-mono font-bold">
                          {scatBarbSpacing === 0.07 ? "0.07° (约 7km, 极密)" : `${scatBarbSpacing.toFixed(2)}° (约 ${(scatBarbSpacing * 100).toFixed(0)}km)`}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.05"
                        max="0.40"
                        step="0.01"
                        value={scatBarbSpacing}
                        onChange={(e) => setScatBarbSpacing(Number(e.target.value))}
                        className="w-full accent-orange-500 h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer border border-slate-800"
                      />
                    </div>

                    {/* Barb Length */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-300 font-medium">风标轴线段长度</span>
                        <span className="text-orange-400 font-mono font-bold">{scatBarbLength.toFixed(1)} px</span>
                      </div>
                      <input
                        type="range"
                        min="5.0"
                        max="25.0"
                        step="0.5"
                        value={scatBarbLength}
                        onChange={(e) => setScatBarbLength(Number(e.target.value))}
                        className="w-full accent-orange-500 h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer border border-slate-800"
                      />
                    </div>

                    {/* Barb Line Width */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-300 font-medium">风标线段粗细 (线宽)</span>
                        <span className="text-orange-400 font-mono font-bold">{scatBarbWidth.toFixed(1)} px</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="3.0"
                        step="0.1"
                        value={scatBarbWidth}
                        onChange={(e) => setScatBarbWidth(Number(e.target.value))}
                        className="w-full accent-orange-500 h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer border border-slate-800"
                      />
                    </div>

                    {/* Orbit Angle */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-300 font-medium">卫星测风轨道切向角</span>
                        <span className="text-orange-400 font-mono font-bold">{scatOrbitAngle.toFixed(0)}°</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="60"
                        step="1"
                        value={scatOrbitAngle}
                        onChange={(e) => setScatOrbitAngle(Number(e.target.value))}
                        className="w-full accent-orange-500 h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer border border-slate-800"
                      />
                    </div>

                    {/* Swath Width */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-300 font-medium">传感器有效条带宽度</span>
                        <span className="text-orange-400 font-mono font-bold">±{scatSwathWidth.toFixed(1)}° (经纬度)</span>
                      </div>
                      <input
                        type="range"
                        min="3.0"
                        max="12.0"
                        step="0.5"
                        value={scatSwathWidth}
                        onChange={(e) => setScatSwathWidth(Number(e.target.value))}
                        className="w-full accent-orange-500 h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer border border-slate-800"
                      />
                    </div>

                    {/* Nadir Gap Width */}
                    <div className={`space-y-1 transition-opacity ${showNadirGap ? "opacity-100" : "opacity-40"}`}>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-300 font-medium">星下点雷达盲区宽度 (Nadir)</span>
                        <span className="text-orange-400 font-mono font-bold">
                          {showNadirGap ? `±${scatNadirWidth.toFixed(1)}°` : "已禁用"}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.2"
                        max="3.0"
                        step="0.1"
                        disabled={!showNadirGap}
                        value={scatNadirWidth}
                        onChange={(e) => setScatNadirWidth(Number(e.target.value))}
                        className="w-full accent-orange-500 h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer border border-slate-800 disabled:cursor-not-allowed"
                      />
                    </div>

                    {/* Background Scale */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-300 font-medium">环境风场叠合权重</span>
                        <span className="text-orange-400 font-mono font-bold">{(scatBackgroundScale * 100).toFixed(0)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="2.0"
                        step="0.1"
                        value={scatBackgroundScale}
                        onChange={(e) => setScatBackgroundScale(Number(e.target.value))}
                        className="w-full accent-orange-500 h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer border border-slate-800"
                      />
                    </div>

                    {/* Toggles */}
                    <div className="flex items-center justify-between pt-2 border-t border-orange-800/20 text-[11px]">
                      <span className="text-slate-300">保留卫星星下点盲区 (Nadir Gap)</span>
                      <button
                        type="button"
                        onClick={() => setShowNadirGap(!showNadirGap)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                          showNadirGap ? "bg-orange-500" : "bg-slate-700"
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            showNadirGap ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-orange-800/20 text-[11px]">
                      <div className="flex flex-col">
                        <span className="text-slate-300">陆地上是否有数据 (Land Data)</span>
                        <span className="text-[10px] text-slate-400">关闭时屏蔽陆地，更贴合卫星扫描实况</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setScatterometerLandData(!scatterometerLandData)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                          scatterometerLandData ? "bg-orange-500" : "bg-slate-700"
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            scatterometerLandData ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Presets Manager Section */}
                    <div className="space-y-1.5 pt-2 border-t border-orange-800/20">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-300 font-medium">应用快速参数预设</span>
                        {!isSavingPreset ? (
                          <button
                            type="button"
                            onClick={() => {
                              setNewPresetName(`自定义预设 ${customPresets.length + 1}`);
                              setIsSavingPreset(true);
                            }}
                            className="text-[10px] text-blue-400 hover:text-cyan-300 cursor-pointer font-bold transition flex items-center gap-1"
                          >
                            + 保存当前设置
                          </button>
                        ) : null}
                      </div>

                      {/* Inline saving form */}
                      {isSavingPreset && (
                        <div className="bg-slate-900 border border-orange-850/50 p-2 rounded flex flex-col gap-2 mb-2">
                          <div className="text-[10px] text-slate-400 font-medium">输入自定义预设名称：</div>
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={newPresetName}
                              onChange={(e) => setNewPresetName(e.target.value)}
                              placeholder="预设名称"
                              className="flex-1 text-[11px] px-2 py-1 bg-slate-950 border border-slate-800 text-slate-100 rounded focus:outline-none focus:border-orange-500"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const trimmed = newPresetName.trim();
                                if (trimmed) {
                                  const newPreset = {
                                    name: trimmed,
                                    spacing: scatBarbSpacing,
                                    length: scatBarbLength,
                                    width: scatBarbWidth,
                                    angle: scatOrbitAngle,
                                    swath: scatSwathWidth,
                                    nadir: scatNadirWidth,
                                    bg: scatBackgroundScale,
                                    gap: showNadirGap,
                                    land: scatterometerLandData
                                  };
                                  const updated = [...customPresets, newPreset];
                                  setCustomPresets(updated);
                                  localStorage.setItem("forecast_custom_scat_presets", JSON.stringify(updated));
                                  setIsSavingPreset(false);
                                  setNewPresetName("");
                                }
                              }}
                              className="bg-orange-600 hover:bg-orange-500 text-white px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition"
                            >
                              保存
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsSavingPreset(false);
                                setNewPresetName("");
                              }}
                              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded text-[10px] font-medium cursor-pointer transition"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setScatBarbSpacing(0.05);
                            setScatBarbLength(10.0);
                            setScatBarbWidth(1.0);
                            setScatOrbitAngle(15.0);
                            setScatSwathWidth(12.0);
                            setScatNadirWidth(0.0);
                            setScatBackgroundScale(1.0);
                            setShowNadirGap(false);
                            setScatterometerLandData(false);
                          }}
                          className="text-[10px] bg-orange-950/40 hover:bg-orange-900/40 text-orange-300 px-2 py-0.5 rounded border border-orange-800/30 cursor-pointer transition"
                        >
                          默认标准
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setScatBarbSpacing(0.04);
                            setScatBarbLength(9.0);
                            setScatBarbWidth(0.8);
                            setScatOrbitAngle(20.0);
                            setScatSwathWidth(12.0);
                            setScatNadirWidth(0.0);
                            setScatBackgroundScale(0.8);
                            setShowNadirGap(false);
                            setScatterometerLandData(false);
                          }}
                          className="text-[10px] bg-orange-950/40 hover:bg-orange-900/40 text-orange-300 px-2 py-0.5 rounded border border-orange-800/30 cursor-pointer transition"
                        >
                          极密细节
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setScatBarbSpacing(0.1);
                            setScatBarbLength(12.0);
                            setScatBarbWidth(1.2);
                            setScatOrbitAngle(15.0);
                            setScatSwathWidth(9.0);
                            setScatNadirWidth(1.2);
                            setScatBackgroundScale(1.2);
                            setShowNadirGap(true);
                            setScatterometerLandData(true);
                          }}
                          className="text-[10px] bg-orange-950/40 hover:bg-orange-900/40 text-orange-300 px-2 py-0.5 rounded border border-orange-800/30 cursor-pointer transition"
                        >
                          宽幅 ASCAT
                        </button>

                        {customPresets.map((preset, idx) => (
                          <div key={idx} className="inline-flex items-center bg-cyan-950/40 hover:bg-cyan-900/40 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800/30 text-[10px] transition">
                            <button
                              type="button"
                              onClick={() => {
                                setScatBarbSpacing(preset.spacing);
                                setScatBarbLength(preset.length);
                                setScatBarbWidth(preset.width);
                                setScatOrbitAngle(preset.angle);
                                setScatSwathWidth(preset.swath);
                                setScatNadirWidth(preset.nadir);
                                setScatBackgroundScale(preset.bg);
                                setShowNadirGap(preset.gap);
                                setScatterometerLandData(preset.land);
                              }}
                              className="font-medium cursor-pointer"
                            >
                              {preset.name}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const updated = customPresets.filter((_, i) => i !== idx);
                                setCustomPresets(updated);
                                localStorage.setItem("forecast_custom_scat_presets", JSON.stringify(updated));
                              }}
                              className="text-red-400 hover:text-red-300 ml-1 font-bold cursor-pointer transition"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                </div>

              {/* Resolution selection */}
              <div className="space-y-2.5">
                <label className="text-xs text-slate-400 block font-medium">输出清晰度 (最高 8K)</label>
                <div className="grid grid-cols-2 gap-2">
                  {RESOLUTIONS.map((res) => {
                    const isSelected = resolutionId === res.id;
                    return (
                      <button
                        key={res.id}
                        onClick={() => setResolutionId(res.id)}
                        className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition cursor-pointer ${
                          isSelected
                            ? "bg-blue-500/10 border-sky-500 text-blue-400"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <span className="text-xs font-bold font-mono">{res.name}</span>
                        <span className="text-[10px] text-slate-500 mt-0.5">
                          {res.width}x{res.height}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Download & Close buttons */}
            <div className="space-y-3 pt-6 border-t border-slate-800/60 mt-6">
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800/50 text-slate-200 border border-slate-700/80 font-bold text-sm transition cursor-pointer shadow-md"
              >
                {isGenerating ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                生成图片 {isGenerating && generationProgress > 0 ? ` (${Math.round(generationProgress)}%)` : ""}
              </button>
              
              <button
                onClick={onClose}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
              >
                返回主控台
              </button>
            </div>
          </div>
        </div>
      )}

      {previewDataUrl && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-black/90 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 max-w-7xl max-h-full flex flex-col shadow-2xl relative">
            <button 
              onClick={() => setPreviewDataUrl(null)}
              className="absolute top-2 right-2 p-2 bg-slate-800 rounded-full text-slate-300 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex-1 overflow-auto bg-black/50 rounded-lg p-2 min-h-0 flex items-center justify-center">
              <img src={previewDataUrl} alt="Preview" className="max-w-full max-h-[80vh] object-contain rounded" />
            </div>
            <div className="mt-4 flex flex-wrap gap-3 justify-end items-center">
              <p className="text-sm text-slate-400 self-center mr-auto">提示：长按图片也可保存到相册</p>
              <button 
                onClick={() => setPreviewDataUrl(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm transition"
              >
                取消
              </button>
              <button 
                onClick={() => {
                  if (!previewDataUrl) return;
                  try {
                    const arr = previewDataUrl.split(",");
                    const mime = arr[0].match(/:(.*?);/)?.[1] || "image/png";
                    const bstr = atob(arr[1]);
                    let n = bstr.length;
                    const u8arr = new Uint8Array(n);
                    while (n--) {
                      u8arr[n] = bstr.charCodeAt(n);
                    }
                    const blob = new Blob([u8arr], { type: mime });
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = blobUrl;
                    a.target = "_blank";
                    a.rel = "noopener noreferrer";
                    a.click();
                  } catch (e) {
                    console.error(e);
                    const a = document.createElement("a");
                    a.href = previewDataUrl;
                    a.target = "_blank";
                    a.click();
                  }
                }}
                className="px-5 py-2 rounded-xl border border-sky-800/80 bg-sky-950/20 text-blue-400 hover:bg-sky-900/30 font-bold text-sm transition flex items-center gap-1.5"
              >
                <ExternalLink className="w-4 h-4" />
                在新标签页打开原图
              </button>
              <button 
                onClick={handleDownloadActual}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold flex items-center gap-1.5 text-sm transition shadow-md"
              >
                <Download className="w-4 h-4" />
                下载原图
              </button>
            </div>
          </div>
        </div>
      )}
      {renderRankingsPopup()}
      {renderSnapshotPopup()}
    </div>
  );
}
