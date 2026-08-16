/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Menu, Settings, Info, RefreshCw, Layers, Maximize, Minimize, Compass, Images, Sparkles, X, Wind, History } from "lucide-react";
import { Typhoon, SimulationConfig, ActiveLayers, EventLog, TyphoonCategory, ToastMessage } from "./types";
import { TyphoonEngine, getSST, getOHC, getWindForceCategory, fetchOsmCityName } from "./simulation/Engine";
import { convertToSimulationTyphoon } from "./data/historicalTyphoons";
import OrientationGuard from "./components/OrientationGuard";
import MapView from "./components/MapView";
import TyphoonStatusCard from "./components/TyphoonStatusCard";
import TyphoonReport from "./components/TyphoonReport";
import TyphoonReportModal from "./components/TyphoonReportModal";
import VideoExportModal from "./components/VideoExportModal";
import ForecastImageModal from "./components/ForecastImageModal";
import VirtualJoystick from "./components/VirtualJoystick";
import ControlDrawer from "./components/ControlDrawer";
import Timeline from "./components/Timeline";
import Toast from "./components/Toast";
import GeoJsonStatusBadge from "./components/GeoJsonStatusBadge";
import { loadNaturalEarthData } from "./simulation/NaturalEarthLoader";
import {
  playSndClick,
  playSndUpgrade,
  playSndRapid,
  playSndLand,
  playSndEWRC,
  playSndET,
  playSndDissipate,
  playSndSpawn,
  playSndSliderTick
} from "./utils/audio";

// Starting default configs
const DEFAULT_CONFIG: SimulationConfig = {
  subtropicalHighEnabled: true,
  subtropicalHighStrength: 1.1, // 110%
  subtropicalHighLat: 24.5,
  subtropicalHighLon: 135.0,
  subtropicalHighWestExtent: 118.0,
  subtropicalHighNSSize: 1.0,
  westerliesEnabled: true,
  westerliesStrength: 1.0,
  westerliesLat: 31.0,
  westerliesTroughLon: 122.0,
  westerliesTroughDepth: 0.9,
  betaDriftEnabled: true,
  betaDriftScale: 1.0,
  monsoonTroughEnabled: false,
  eastWaveEnabled: true,
  shearPreset: 'global_low',
  shearScale: 1.0,
  humidityScale: 1.0,
  outflowScale: 1.0,
  dryAirEnabled: true,
  randomNoise: 0.25,
   sstAnomaly: 0.5, // slightly warmer water default
  sstNorthSouthGradient: 1.0,
  ohcScale: 1.0,
  warmPoolEnabled: true,
  coldEddyEnabled: false,
  airSeaCoupling: 0.5,
  ewrcTrigger: "auto",
  rapidIntensifyEnabled: true,
  landDecayEnabled: true,
  terrainDecayEnabled: true,
  landfallDecayAdjustment: 0.20,
  landProximityDecayAdjustment: 1.00,
  landTdDissipateMode: "6h",
  intensificationRate: 0.5,
  upwellingFactor: -5,
  etEnabled: true,
  fujiwharaEnabled: true,
  seed: "Yelan-718",
  joystickSensitivity: 1.0,
  joystickStrength: 2.0,
  joystickDx: 0,
  joystickDy: 0,
  soundEnabled: true,
  soundVolume: 0.4,
  followMainTyphoon: true
};

const DEFAULT_LAYERS: ActiveLayers = {
  baseMap: "satellite",
  border: true,
  coastline: true,
  sst: false,
  ohc: false,
    shear: false,
  windShear: false,
  strongDryAir: false,
  strongWindShear: false,
  pressure: false,
  height500: false,
  subHigh: true,
  westerlies: true,
  wind850: false,
  wind500: true,
  wind200: false,
  steering: false,
  track: true,
   windRadii: true,
  forecast: true,
  forecastCone: false,
  radar: false,
  clouds: false,
  precipitation: false,
  precipitationAccumulated: false,
  maxWindSpeedAccumulated: false,
  weatherStations: false,
  cursor: false,
  rasterResolution: 6
};

// Helper to handle cross-browser fullscreen requests
const requestFullScreen = (element: HTMLElement) => {
  try {
    if (element.requestFullscreen) {
      element.requestFullscreen().catch(() => {});
    } else if ((element as any).webkitRequestFullscreen) {
      (element as any).webkitRequestFullscreen();
    } else if ((element as any).mozRequestFullScreen) {
      (element as any).mozRequestFullScreen();
    } else if ((element as any).msRequestFullscreen) {
      (element as any).msRequestFullscreen();
    }
  } catch (err) {
    console.warn("Fullscreen request failed:", err);
  }
};

const exitFullScreen = () => {
  try {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen();
    } else if ((document as any).mozCancelFullScreen) {
      (document as any).mozCancelFullScreen();
    } else if ((document as any).msExitFullscreen) {
      (document as any).msExitFullscreen();
    }
  } catch (err) {
    console.warn("Exit fullscreen failed:", err);
  }
};

const isFullScreen = () => {
  return !!(
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement
  );
};

export default function App() {
  const engineRef = useRef<TyphoonEngine>(new TyphoonEngine(DEFAULT_CONFIG.seed));

  // Automatic fullscreen logic removed as per user request to use button instead.
  // We keep the touch-action fix for gestures.
  useEffect(() => {
    // Prevent default touch gestures (swipe to go back/forward)
    const preventGestures = (e: TouchEvent) => {
      // Leaflet handles its own touches, but we block others to prevent browser-level gestures
      if (e.touches.length > 1 && e.cancelable) {
        // Optional: e.preventDefault();
      }
    };

    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    
    // Some browsers use specific gestures for navigation
    document.addEventListener("touchstart", preventGestures, { passive: false });
    document.addEventListener("contextmenu", preventContextMenu);
    
    return () => {
      document.removeEventListener("touchstart", preventGestures);
      document.removeEventListener("contextmenu", preventContextMenu);
    };
  }, []);

  // State managers
  const [config, setConfig] = useState<SimulationConfig>(() => {
    const saved = localStorage.getItem("typhoon_sim_config");
    return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : DEFAULT_CONFIG;
  });

  const [layers, setLayers] = useState<ActiveLayers>(() => {
    const saved = localStorage.getItem("typhoon_sim_layers");
    return saved ? { ...DEFAULT_LAYERS, ...JSON.parse(saved) } : DEFAULT_LAYERS;
  });

   const [typhoons, setTyphoons] = useState<Typhoon[]>([]);
  const [currentHour, setCurrentHour] = useState(0);
  const [maxHour, setMaxHour] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.0); // play speed default
  const [eventLogs, setEventLogs] = useState<EventLog[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [placementMode, setPlacementMode] = useState<"main" | "second" | "genesis" | "none">("none");
  const [genesisPos, setGenesisPos] = useState<{ lat: number; lon: number }>({ lat: 12.5, lon: 145.0 });
  const [showReport, setShowReport] = useState(false);
  const [videoExportTyphoon, setVideoExportTyphoon] = useState<Typhoon | null>(null);
  const [reportModalTyphoon, setReportModalTyphoon] = useState<Typhoon | null>(null);
  const [forecastModalOpen, setForecastModalOpen] = useState(false);
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);

  const [isInfluenceModalOpen, setIsInfluenceModalOpen] = useState(false);
  const [activeInfluenceCategory, setActiveInfluenceCategory] = useState<"main" | "ewrc" | "dry_air" | "shear">("main");

  const handleApplyInfluence = (type: "ewrc" | "dry_air" | "shear" | "rapid_intensify", option: string) => {
    updateTyphoons(prev => {
      if (prev.length === 0) return prev;
      
      // If applying influence while in the past, branch simulation cleanly
      let baseHour = currentHour;
      if (currentHour < maxHour) {
        setMaxHour(currentHour);
        totalSimMinutesRef.current = currentHour * 60;
        engineRef.current.syncPrngToHour(currentHour);
      }

      const updated = prev.map((ty, idx) => {
        if (idx === 0) { // apply to the active/first typhoon
          const nextTy = { ...ty };
          
          if (currentHour < maxHour) {
            const restoredState = ty.history.find((h) => h.simHour === currentHour);
            Object.assign(nextTy, {
              forcedEWRC: restoredState?.forcedEWRC,
              forcedDryAir: restoredState?.forcedDryAir,
              forcedShear: restoredState?.forcedShear,
              forcedRapidIntensification: restoredState?.forcedRapidIntensification,
              manualForcedDecay: restoredState?.manualForcedDecay,
              forcedDecayStartVmax: restoredState?.forcedDecayStartVmax,
              forcedDecayTargetVmax: restoredState?.forcedDecayTargetVmax,
              forcedDecayElapsedHours: restoredState?.forcedDecayElapsedHours,
              forcedDecayDuration: restoredState?.forcedDecayDuration,
              forcedDecayIsContinuous: restoredState?.forcedDecayIsContinuous,
              dryAirPenaltyHours: restoredState?.dryAirPenaltyHours,
              dryAirPenaltyTotalHours: restoredState?.dryAirPenaltyTotalHours,
              shearPenaltyHours: restoredState?.shearPenaltyHours,
              shearPenaltyTotalHours: restoredState?.shearPenaltyTotalHours,
              ewrcFailurePenaltyHours: restoredState?.ewrcFailurePenaltyHours,
              ewrcPenaltyTotalHours: restoredState?.ewrcPenaltyTotalHours,
              cloggedRecoveryHours: restoredState?.cloggedRecoveryHours,
              cloggedRecoveryTotalHours: restoredState?.cloggedRecoveryTotalHours,
              isEyeClogged: restoredState?.isEyeClogged || false,
              isStructureDamaged: restoredState?.isStructureDamaged || false,
              upwellingHours: restoredState?.upwellingHours || 0,
              consecutiveUpwellingHours: restoredState?.consecutiveUpwellingHours || 0,
              upwellingPersistentPenaltyHours: restoredState?.upwellingPersistentPenaltyHours || 0,
              structuralDamageHours: restoredState?.structuralDamageHours || 0,
              tdHours: restoredState?.tdHours || 0,
              landTdHours: restoredState?.landTdHours || 0,
              superTyLandHours: restoredState?.superTyLandHours || 0,
              landHours: restoredState?.landHours || 0,
              landContactHours: restoredState?.landContactHours || 0,
              r10LandContactHours: restoredState?.r10LandContactHours || 0,
              vmax6Hours: restoredState?.vmax6Hours || 0,
              etHours: restoredState?.etHours || 0,
              warmWaterHoursAfterSea: restoredState?.warmWaterHoursAfterSea || 0,
              ewrcCooldownHours: restoredState?.ewrcCooldownHours || 0,
              ewrcCount: restoredState?.ewrcCount || 0,
              ewrcState: restoredState?.ewrcState || "none",
              ewrcProgress: restoredState?.ewrcProgress || 0,
              ewrcIsFailure: restoredState?.ewrcIsFailure || false,
              ...(restoredState ? restoredState : {}),
              active: restoredState ? !restoredState.dissipated : ty.active,
              history: ty.history.filter((h) => h.simHour <= currentHour)
            });
          }

          if (type === "ewrc") {
            const isCurrentlyActive = (option === "success" && (nextTy.forcedEWRC === "success" || nextTy.ewrcState === "recovering_success")) ||
                                     (option === "failure" && (nextTy.forcedEWRC === "failure" || nextTy.ewrcState === "penalty_failure" || nextTy.ewrcState === "recovering_failure"));
            if (isCurrentlyActive) {
              delete nextTy.forcedEWRC;
              nextTy.ewrcState = "none";
              nextTy.ewrcProgress = 0;
              nextTy.ewrcFailurePenaltyHours = 0;
              nextTy.ewrcPenaltyTotalHours = 0;
              nextTy.ewrcIsFailure = false;
              // Core destruction inertia applies: 28h recovery
              nextTy.cloggedRecoveryTotalHours = 28.0;
              nextTy.cloggedRecoveryHours = 0.0;
              showToast(`已打断眼墙置换影响，核心开始缓慢重塑恢复！`, "success");
            } else {
              nextTy.forcedEWRC = option as "success" | "failure";
              nextTy.ewrcIsFailure = option === "failure";
              nextTy.ewrcState = "none";
              nextTy.ewrcCooldownHours = 0;
              nextTy.ewrcProgress = 0;
              nextTy.ewrcFailurePenaltyHours = 0;
              nextTy.ewrcPenaltyTotalHours = 0;
              delete nextTy.cloggedRecoveryHours;
              delete nextTy.cloggedRecoveryTotalHours;
              showToast(`已切换眼墙置换状态：${option === "success" ? "置换成功" : "置换失败"}！`, "success");
            }
          } else if (type === "dry_air") {
            if (nextTy.forcedDryAir === option) {
              const wasCore = nextTy.forcedDryAir === "core";
              delete nextTy.forcedDryAir;
              delete nextTy.dryAirPenaltyHours;
              delete nextTy.dryAirPenaltyTotalHours;
              if (wasCore) {
                // Core destruction inertia applies: 28h recovery
                nextTy.cloggedRecoveryTotalHours = 28.0;
                nextTy.cloggedRecoveryHours = 0.0;
              } else {
                nextTy.cloggedRecoveryTotalHours = 12.0;
                nextTy.cloggedRecoveryHours = 0.0;
              }
              showToast(`已打断干空气入侵，干空气逐渐散去，核心结构缓慢重塑！`, "success");
            } else {
              nextTy.forcedDryAir = option as "core" | "periphery";
              nextTy.dryAirPenaltyHours = undefined; // Force recalculation in engine
              nextTy.dryAirPenaltyTotalHours = undefined;
              // Dry air suppresses RI
              delete nextTy.forcedRapidIntensification;
              delete (nextTy as any).forcedRapidIntensificationDuration;
              showToast(`已施加干空气影响：${option === "core" ? "干空气侵入核心" : "外围卷入干空气"}！`, "warning");
            }
          } else if (type === "shear") {
            const val = parseFloat(option);
            if (nextTy.forcedShear === val) {
              delete nextTy.forcedShear;
              delete nextTy.shearPenaltyHours;
              delete nextTy.shearPenaltyTotalHours;
              // Core destruction inertia applies: 28h recovery
              nextTy.cloggedRecoveryTotalHours = 28.0;
              nextTy.cloggedRecoveryHours = 0.0;
              showToast(`已打断强风切变影响，风切变平息，核心结构缓慢重塑！`, "success");
            } else {
              nextTy.forcedShear = val;
              nextTy.shearPenaltyHours = undefined; // Force recalculation in engine
              nextTy.shearPenaltyTotalHours = undefined;
              // Shear suppresses RI
              delete nextTy.forcedRapidIntensification;
              delete (nextTy as any).forcedRapidIntensificationDuration;
              showToast(`已施加垂直风切变影响：${val} kt！`, "warning");
            }
          } else if (type === "rapid_intensify") {
            if (nextTy.forcedRapidIntensification) {
              delete nextTy.forcedRapidIntensification;
              delete (nextTy as any).forcedRapidIntensificationDuration;
              showToast(`已中断爆发增强！`, "info");
            } else {
              // Force enable rapid intensification and clear conflicting suppression states
              delete nextTy.forcedDryAir;
              delete nextTy.dryAirPenaltyHours;
              delete nextTy.dryAirPenaltyTotalHours;
              delete nextTy.forcedShear;
              delete nextTy.shearPenaltyHours;
              delete nextTy.shearPenaltyTotalHours;
              nextTy.ewrcIsFailure = false;
              nextTy.ewrcState = "none";
              nextTy.ewrcCooldownHours = 0;
              nextTy.ewrcFailurePenaltyHours = 0;
              nextTy.ewrcProgress = 0;
              delete nextTy.cloggedRecoveryHours;
              delete nextTy.cloggedRecoveryTotalHours;
              nextTy.isEyeClogged = false;
              nextTy.isStructureDamaged = false;
              nextTy.forcedRapidIntensification = true;
              (nextTy as any).forcedRapidIntensificationDuration = 18.0;
              showToast(`已强制开启爆发增强！结构将迅速增强。`, "success");
            }
          }
          return nextTy;
        }
        return ty;
      });
      return updated;
    });
  };

  const [startDate, setStartDate] = useState<Date>(() => {
    const saved = localStorage.getItem("typhoon_sim_start_date");
    return saved ? new Date(saved) : new Date("2026-07-21T00:00:00");
  });

  const handleStartDateChange = (newDate: Date) => {
    setStartDate(newDate);
    localStorage.setItem("typhoon_sim_start_date", newDate.toISOString());
    showToast(`台风生成起算时间调整为: ${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')} ${String(newDate.getHours()).padStart(2, '0')}:00`, "success");
  };

  // Ref trackers for the continuous simulation minute accumulator
  const simMinutesBufferRef = useRef(0);
  const lastTimeRef = useRef<number>(0);
  const totalSimMinutesRef = useRef<number>(0);
  const animationFrameIdRef = useRef<number | null>(null);

   // Keep state synced to refs to avoid tearing down requestAnimationFrame on every state update
  const typhoonsRef = useRef(typhoons);
  const configRef = useRef(config);

   useEffect(() => {
    typhoonsRef.current = typhoons;
  }, [typhoons]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Global decompression tactile click sound
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (!config.soundEnabled) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.closest("button") ||
          target.closest("a") ||
          target.closest("input") ||
          target.closest("select") ||
          target.getAttribute("role") === "button" ||
          target.classList.contains("cursor-pointer"))
      ) {
        playSndClick(config.soundVolume, config.soundEnabled, config.soundMode || "mouse");
      }
    };
    window.addEventListener("click", handleGlobalClick, true);
    return () => window.removeEventListener("click", handleGlobalClick, true);
  }, [config.soundEnabled, config.soundVolume, config.soundMode]);

   const updateTyphoons = (newTy: Typhoon[] | ((prev: Typhoon[]) => Typhoon[])) => {
    if (typeof newTy === "function") {
      setTyphoons((prev) => {
        const res = newTy(prev);
        typhoonsRef.current = res;
        return res;
      });
    } else {
      typhoonsRef.current = newTy;
      setTyphoons(newTy);
    }
  };

  // Load state from localStorage on startup!
  const loadSavedSimulationState = () => {
    try {
      const savedTyphoons = localStorage.getItem("typhoon_sim_state_typhoons");
      const savedLogs = localStorage.getItem("typhoon_sim_state_logs");
      const savedHour = localStorage.getItem("typhoon_sim_state_current_hour");
      const savedMaxHour = localStorage.getItem("typhoon_sim_state_max_hour");
      const savedMins = localStorage.getItem("typhoon_sim_state_mins");
      
      if (savedTyphoons) {
        const loadedTy = JSON.parse(savedTyphoons);
        if (Array.isArray(loadedTy) && loadedTy.length > 0) {
          setTyphoons(loadedTy);
          typhoonsRef.current = loadedTy;
          
          if (savedLogs) {
            setEventLogs(JSON.parse(savedLogs));
          }
          if (savedHour) {
            setCurrentHour(parseInt(savedHour, 10));
          }
          if (savedMaxHour) {
            setMaxHour(parseInt(savedMaxHour, 10));
          }
          if (savedMins) {
            totalSimMinutesRef.current = parseFloat(savedMins);
          }
          return true;
        }
      }
    } catch (e) {
      console.error("Failed to restore saved simulation state", e);
    }
    return false;
  };

  // Initialize main typhoon on mount, restoring saved simulation state if available
  useEffect(() => {
    loadNaturalEarthData();
    const loaded = loadSavedSimulationState();
    if (!loaded) {
      resetSimulation();
    }
  }, []);

  // Save configurations to localStorage on change safely
  useEffect(() => {
    try {
      localStorage.setItem("typhoon_sim_config", JSON.stringify(config));
    } catch (e) {
      console.warn("localStorage config save error:", e);
    }
  }, [config]);

  useEffect(() => {
    try {
      localStorage.setItem("typhoon_sim_layers", JSON.stringify(layers));
    } catch (e) {
      console.warn("localStorage layers save error:", e);
    }
  }, [layers]);

  // Save simulation state to localStorage on state changes with debouncing & safety
   useEffect(() => {
    if (typhoons.length === 0) return;

    const saveTimer = setTimeout(() => {
      try {
        localStorage.setItem("typhoon_sim_state_typhoons", JSON.stringify(typhoons));
        localStorage.setItem("typhoon_sim_state_logs", JSON.stringify(eventLogs));
        localStorage.setItem("typhoon_sim_state_current_hour", currentHour.toString());
        localStorage.setItem("typhoon_sim_state_max_hour", maxHour.toString());
        localStorage.setItem("typhoon_sim_state_mins", totalSimMinutesRef.current.toString());
      } catch (e) {
        console.warn("Could not save simulation state to localStorage:", e);
      }
    }, isPlaying ? 2000 : 200);

    return () => clearTimeout(saveTimer);
  }, [typhoons, eventLogs, currentHour, maxHour, isPlaying]);

  // Tab visibility & focus handler to prevent frame pileups or crashes when returning from background
  useEffect(() => {
    const handleVisibilityChange = () => {
      simMinutesBufferRef.current = 0;
      lastTimeRef.current = performance.now();
      window.dispatchEvent(new Event("app-foreground-restored"));
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, []);

  // Handle PRNG seed updates
  useEffect(() => {
    engineRef.current = new TyphoonEngine(config.seed);
  }, [config.seed]);

  // Master reset logic: Blank canvas by default!
   const resetSimulation = () => {
    simMinutesBufferRef.current = 0;
    totalSimMinutesRef.current = 0;
    engineRef.current.syncPrngToHour(0);
    
    setTyphoons([]); // Empty array for direct genesis on click!
    setCurrentHour(0);
    setMaxHour(0);
    setIsPlaying(false);
    
    const initLog: EventLog = {
      id: "init-0",
      time: new Date(),
      simHour: 0,
      type: "info",
      message: `🌱 模拟器就绪（纯白纸模式）：请点击海图上任意位置，直接催生初始风力 8 级 (18m/s) 的热带风暴【夜澜】。`
    };
    setEventLogs([initLog]);
    
    // No toast message shown on reset as requested

    // Clear saved states on explicit manual reset to prevent reloading previous session on fresh starts
    localStorage.removeItem("typhoon_sim_state_typhoons");
    localStorage.removeItem("typhoon_sim_state_coldwakes");
    localStorage.removeItem("typhoon_sim_state_logs");
    localStorage.removeItem("typhoon_sim_state_current_hour");
    localStorage.removeItem("typhoon_sim_state_max_hour");
    localStorage.removeItem("typhoon_sim_state_mins");
  };

  // Re-generate environment random profiles
  const regenerateEnvironment = () => {
    simMinutesBufferRef.current = 0;
    totalSimMinutesRef.current = 0;
    // Modify seed slightly and trigger reload
    const rng = Math.floor(Math.random() * 9000 + 1000);
    const nextSeed = `Yelan-${rng}`;
    setConfig(c => ({ ...c, seed: nextSeed }));
    
     // reset typhoon to reflect seed change
    const defaultMain = engineRef.current.createDefaultTyphoon(
      "main",
      typhoons[0]?.name || "夜澜",
      genesisPos.lat,
      genesisPos.lon,
      config
    );
    setTyphoons([defaultMain]);
    setCurrentHour(0);
    setMaxHour(0);
    setIsPlaying(false);
    
    setEventLogs([
      {
        id: `regen-${rng}`,
        time: new Date(),
        simHour: 0,
        type: "success",
        message: `🔄 气象环境重构：成功采用新随机物理种子 【${nextSeed}】，全域海温异常、西风槽深度 and 切变场已重新编译。`
      }
    ]);
    
    showToast("气象流场背景重构完成", "success");
  };

  // Clear track
  const clearTrack = () => {
    simMinutesBufferRef.current = 0;
    totalSimMinutesRef.current = 0;
    engineRef.current.syncPrngToHour(0);
    setTyphoons((prev) =>
      prev.map((ty) => ({
        ...ty,
        history: [
          {
            ...ty.history[ty.history.length - 1],
            simHour: 0
          }
        ]
      }))
    );
    setCurrentHour(0);
    setMaxHour(0);
    showToast("历史路径轨迹已清空", "info");
  };

  // Toast adder
  const showToast = (message: string, type: "info" | "success" | "warning" | "danger") => {
    setToasts((prev) => [
      ...prev,
      {
        id: `toast-${Date.now()}-${Math.random()}`,
        message,
        type
      }
    ]);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleManualDissipate = () => {
    if (typhoons.length === 0) return;
    const updated = typhoons.map((t) => {
      // Truncate history to current hour and mark as dissipated at the end
      const newHistory = t.history.filter(h => h.simHour <= currentHour);
      if (newHistory.length > 0) {
        newHistory[newHistory.length - 1].dissipated = true;
      }
      return {
        ...t,
        dissipated: true,
        active: false,
        vmax: 8.0,
        forecastPath: [],
        history: newHistory,
        category: TyphoonCategory.DS
      };
    });
    updateTyphoons(updated);
    // Sync maxHour to currentHour so timeline is updated
    setMaxHour(currentHour);
    setIsPlaying(false);
    simMinutesBufferRef.current = 0;
    if (animationFrameIdRef.current !== null) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    showToast("手动强制停编：中央气象台已对台风停止编号！", "info");
    setShowReport(true);
  };

   // Master delta-time animation tick loop ---
  useEffect(() => {
    // Cleanly reset buffer when toggling play state or changing playback speeds to avoid stutter
    simMinutesBufferRef.current = 0;

    if (!isPlaying) {
      lastTimeRef.current = 0;
      return;
    }

    // Branch simulation reset if playing from a past hour
    if (currentHour < maxHour) {
      engineRef.current.syncPrngToHour(currentHour);
      setMaxHour(currentHour);
      totalSimMinutesRef.current = currentHour * 60;
      const branched = typhoonsRef.current.map((ty) => {
        const restoredState = ty.history.find((h) => h.simHour === currentHour);
        // Preserve user active forced intervention flags set while paused
        const activeForcedEWRC = ty.forcedEWRC;
        const activeForcedDryAir = ty.forcedDryAir;
        const activeForcedShear = ty.forcedShear;
        const activeForcedRapid = ty.forcedRapidIntensification;
        const activeManualDecay = ty.manualForcedDecay;

        const nextTy = {
          ...ty,
          forcedEWRC: restoredState?.forcedEWRC,
          forcedDryAir: restoredState?.forcedDryAir,
          forcedShear: restoredState?.forcedShear,
          forcedRapidIntensification: restoredState?.forcedRapidIntensification,
          manualForcedDecay: restoredState?.manualForcedDecay,
          forcedDecayStartVmax: restoredState?.forcedDecayStartVmax,
          forcedDecayTargetVmax: restoredState?.forcedDecayTargetVmax,
          forcedDecayElapsedHours: restoredState?.forcedDecayElapsedHours,
          forcedDecayDuration: restoredState?.forcedDecayDuration,
          forcedDecayIsContinuous: restoredState?.forcedDecayIsContinuous,
          dryAirPenaltyHours: restoredState?.dryAirPenaltyHours,
          dryAirPenaltyTotalHours: restoredState?.dryAirPenaltyTotalHours,
          shearPenaltyHours: restoredState?.shearPenaltyHours,
          shearPenaltyTotalHours: restoredState?.shearPenaltyTotalHours,
          ewrcFailurePenaltyHours: restoredState?.ewrcFailurePenaltyHours,
          ewrcPenaltyTotalHours: restoredState?.ewrcPenaltyTotalHours,
          cloggedRecoveryHours: restoredState?.cloggedRecoveryHours,
          cloggedRecoveryTotalHours: restoredState?.cloggedRecoveryTotalHours,
          isEyeClogged: restoredState?.isEyeClogged || false,
          isStructureDamaged: restoredState?.isStructureDamaged || false,
          upwellingHours: restoredState?.upwellingHours || 0,
          consecutiveUpwellingHours: restoredState?.consecutiveUpwellingHours || 0,
          upwellingPersistentPenaltyHours: restoredState?.upwellingPersistentPenaltyHours || 0,
          structuralDamageHours: restoredState?.structuralDamageHours || 0,
          tdHours: restoredState?.tdHours || 0,
          landTdHours: restoredState?.landTdHours || 0,
          superTyLandHours: restoredState?.superTyLandHours || 0,
          landHours: restoredState?.landHours || 0,
          landContactHours: restoredState?.landContactHours || 0,
          r10LandContactHours: restoredState?.r10LandContactHours || 0,
          vmax6Hours: restoredState?.vmax6Hours || 0,
          etHours: restoredState?.etHours || 0,
          warmWaterHoursAfterSea: restoredState?.warmWaterHoursAfterSea || 0,
          ewrcCooldownHours: restoredState?.ewrcCooldownHours || 0,
          ewrcCount: restoredState?.ewrcCount || 0,
          ewrcState: restoredState?.ewrcState || "none",
          ewrcProgress: restoredState?.ewrcProgress || 0,
          ewrcIsFailure: restoredState?.ewrcIsFailure || false,
          ...(restoredState ? restoredState : {}),
          active: restoredState ? !restoredState.dissipated : ty.active,
          history: ty.history.filter((h) => h.simHour <= currentHour)
        };

        if (activeForcedEWRC !== undefined) nextTy.forcedEWRC = activeForcedEWRC;
        if (activeForcedDryAir !== undefined) nextTy.forcedDryAir = activeForcedDryAir;
        if (activeForcedShear !== undefined) nextTy.forcedShear = activeForcedShear;
        if (activeForcedRapid !== undefined) nextTy.forcedRapidIntensification = activeForcedRapid;
        if (activeManualDecay !== undefined) nextTy.manualForcedDecay = activeManualDecay;

        return nextTy;
      });
      typhoonsRef.current = branched;
      updateTyphoons(branched);
    }

    lastTimeRef.current = performance.now();

    const tick = (now: number) => {
      if (typhoonsRef.current.length === 0 || typhoonsRef.current.every((t) => !t.active || t.dissipated)) {
        setIsPlaying(false);
        return;
      }

      const deltaMs = Math.min(100, now - lastTimeRef.current); // Clamp deltaMs to 100ms max to prevent stutter on tab switch
      lastTimeRef.current = now;

      // At 1x speed, 1 simulation hour = 1000ms.
      // Therefore, delta sim hours = (deltaMs / 1000) * speed.
      // delta sim minutes = delta sim hours * 60.
      const elapsedSimMins = (deltaMs / 1000.0) * speed * 60.0;
      simMinutesBufferRef.current += elapsedSimMins;

      // Cap accumulated buffer to prevent extreme freezes during high-speed play
      if (simMinutesBufferRef.current > 120.0) {
        simMinutesBufferRef.current = 120.0;
      }

      // Loop to consume buffer in steps of 10 simulation minutes (our calculation step)
      let stateUpdated = false;
      let newTyphoons = [...typhoonsRef.current];
      let newLogs: EventLog[] = [];
      let stepsRun = 0;
      // Dynamic max steps based on speed. Cap at 6 to prevent main thread blocking/crashes at high speed.
      const maxStepsPerFrame = speed > 30 ? 6 : 8;
      const currentConfig = configRef.current;

      while (simMinutesBufferRef.current >= 10.0 && stepsRun < maxStepsPerFrame) {
        try {
          simMinutesBufferRef.current -= 10.0;
          totalSimMinutesRef.current += 10.0;
          stepsRun++;

          const currentHourFloat = totalSimMinutesRef.current / 60.0;

          // Run calculation step
          const result = engineRef.current.stepSimulation(
            newTyphoons,
            { ...currentConfig, speed },
            currentHourFloat,
            startDate
          );
          newTyphoons = result.updatedTyphoons;
          
          // Throttled logging for high speed simulation to prevent memory exhaustion & crash
          if (speed <= 15) {
            newLogs = [...newLogs, ...result.logs];
          } else {
            const criticalKeywords = ["登陆", "停编", "消散"];
            const criticalLogs = result.logs.filter(l => 
              criticalKeywords.some(k => l.message.includes(k)) && l.type === "danger"
            );
            newLogs = [...newLogs, ...criticalLogs];
          }
          stateUpdated = true;
        } catch (err) {
          console.error("Simulation step failed:", err);
          setIsPlaying(false);
          simMinutesBufferRef.current = 0;
          break;
        }
      }

      if (stateUpdated) {
        updateTyphoons(newTyphoons);

        // Update the maxHour and currentHour strictly based on totalSimMinutesRef.current
        const nextHour = Math.floor(totalSimMinutesRef.current / 60.0);
        setMaxHour(nextHour);
        setCurrentHour(nextHour);

        // Process audio cues and toasts for events with strict rate limiting at high speed
        if (newLogs.length > 0) {
          setEventLogs((prev) => {
            const combined = [...prev, ...newLogs];
            return combined.slice(-100); // Limit logs to prevent browser slowdown/crash
          });
          
          // Only show toasts and play sounds when playing at normal/moderate speed (<= 15x)
          if (speed <= 15) {
            newLogs.slice(0, 1).forEach((log) => {
              showToast(log.message, log.type);

              if (log.message.includes("已登陆") || log.message.includes("登陆")) {
                playSndLand(currentConfig.soundVolume, currentConfig.soundEnabled);
              } else if (log.message.includes("爆发性增强")) {
                playSndRapid(currentConfig.soundVolume, currentConfig.soundEnabled);
              } else if (log.message.includes("眼墙置换")) {
                playSndEWRC(currentConfig.soundVolume, currentConfig.soundEnabled);
              } else if (log.message.includes("变性")) {
                playSndET(currentConfig.soundVolume, currentConfig.soundEnabled);
              } else if (log.message.includes("消散") || log.message.includes("停止编号")) {
                playSndDissipate(currentConfig.soundVolume, currentConfig.soundEnabled);
              } else if (log.message.includes("增强为") || log.message.includes("升级")) {
                playSndUpgrade(currentConfig.soundVolume, currentConfig.soundEnabled);
              }
            });
          }
        }

        // Stop simulation if all typhoons have dissipated
        const allDissipated = newTyphoons.length > 0 && newTyphoons.every((t) => !t.active || t.dissipated);
        if (allDissipated) {
          setIsPlaying(false);
          showToast("全部台风已消散，模拟停止。", "info");
          setShowReport(true);
          return;
        }
      }

      animationFrameIdRef.current = requestAnimationFrame(tick);
    };

    animationFrameIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [isPlaying, speed]);

  // Seeker Jump-To-Time tracking
  const handleSeek = (hour: number) => {
    if (hour > maxHour || hour < 0) return;
    setCurrentHour(hour);
    setIsPlaying(false); // Requirement 2: Auto pause simulation when dragging timeline
    totalSimMinutesRef.current = hour * 60; // Sync simulation timer reference

    // Rollback the typhoons parameters to match history point
    updateTyphoons((prev) =>
      prev.map((ty) => {
        const hState = ty.history.find((h) => h.simHour === hour);
        if (hState) {
          return {
            ...ty,
            // Explicitly clear/overwrite forced statuses & counters to match history point cleanly
            forcedEWRC: hState.forcedEWRC,
            forcedDryAir: hState.forcedDryAir,
            forcedShear: hState.forcedShear,
            forcedRapidIntensification: hState.forcedRapidIntensification,
            manualForcedDecay: hState.manualForcedDecay,
            forcedDecayStartVmax: hState.forcedDecayStartVmax,
            forcedDecayTargetVmax: hState.forcedDecayTargetVmax,
            forcedDecayElapsedHours: hState.forcedDecayElapsedHours,
            forcedDecayDuration: hState.forcedDecayDuration,
            forcedDecayIsContinuous: hState.forcedDecayIsContinuous,
            dryAirPenaltyHours: hState.dryAirPenaltyHours,
            dryAirPenaltyTotalHours: hState.dryAirPenaltyTotalHours,
            shearPenaltyHours: hState.shearPenaltyHours,
            shearPenaltyTotalHours: hState.shearPenaltyTotalHours,
            ewrcFailurePenaltyHours: hState.ewrcFailurePenaltyHours,
            ewrcPenaltyTotalHours: hState.ewrcPenaltyTotalHours,
            cloggedRecoveryHours: hState.cloggedRecoveryHours,
            cloggedRecoveryTotalHours: hState.cloggedRecoveryTotalHours,
            isEyeClogged: hState.isEyeClogged || false,
            isStructureDamaged: hState.isStructureDamaged || false,
            upwellingHours: hState.upwellingHours || 0,
            consecutiveUpwellingHours: hState.consecutiveUpwellingHours || 0,
            upwellingPersistentPenaltyHours: hState.upwellingPersistentPenaltyHours || 0,
            structuralDamageHours: hState.structuralDamageHours || 0,
            tdHours: hState.tdHours || 0,
            landTdHours: hState.landTdHours || 0,
            superTyLandHours: hState.superTyLandHours || 0,
            landHours: hState.landHours || 0,
            landContactHours: hState.landContactHours || 0,
            r10LandContactHours: hState.r10LandContactHours || 0,
            vmax6Hours: hState.vmax6Hours || 0,
            etHours: hState.etHours || 0,
            warmWaterHoursAfterSea: hState.warmWaterHoursAfterSea || 0,
            ewrcCooldownHours: hState.ewrcCooldownHours || 0,
            ewrcCount: hState.ewrcCount || 0,
            ewrcState: hState.ewrcState || "none",
            ewrcProgress: hState.ewrcProgress || 0,
            ewrcIsFailure: hState.ewrcIsFailure || false,
            ...hState, // Restore full state
            active: !hState.dissipated
          };
        }
        return ty;
      })
    );
    
    // If we reached the absolute end and simulation was finished, show report
    if (hour === maxHour && maxHour > 0) {
      const allDissipated = typhoons.every((ty) => {
        const hState = ty.history.find((h) => h.simHour === hour);
        return hState ? hState.dissipated : true;
      });
      if (allDissipated && typhoons.length > 0) {
        setShowReport(true);
      }
    }
    
    playSndClick(config.soundVolume, config.soundEnabled);
    showToast(`时光穿梭：切换到模拟第 ${hour} 小时`, "info");
  };

  const handleSelectTrackPoint = (hour: number) => {
    if (hour <= maxHour && hour >= 0) {
      handleSeek(hour);
      setIsPlaying(false);
    }
  };

  // Manual step forward
  // Manual step forward to next time point (either existing track point or simulates next hour)
  const handleStepForward = () => {
    // Collect all history hours across all typhoons
    const historyHours = typhoons.flatMap((ty) => (ty.history || []).map((h) => h.simHour));
    const uniqueSortedHours = Array.from(new Set(historyHours)).sort((a, b) => a - b);
    
    // Find the first hour that is strictly greater than currentHour
    const nextHour = uniqueSortedHours.find((h) => h > currentHour);
    
    if (nextHour !== undefined) {
      handleSeek(nextHour);
      playSndClick(config.soundVolume, config.soundEnabled);
    } else {
      let baseTyphoons = [...typhoons];
      if (currentHour < maxHour) {
         engineRef.current.syncPrngToHour(currentHour);
         // Truncate history manually because we stepped from past
         baseTyphoons = typhoons.map((ty) => {
           const restoredState = ty.history.find((h) => h.simHour === currentHour);
           return {
             ...ty,
             forcedEWRC: restoredState?.forcedEWRC,
             forcedDryAir: restoredState?.forcedDryAir,
             forcedShear: restoredState?.forcedShear,
             forcedRapidIntensification: restoredState?.forcedRapidIntensification,
             manualForcedDecay: restoredState?.manualForcedDecay,
             forcedDecayStartVmax: restoredState?.forcedDecayStartVmax,
             forcedDecayTargetVmax: restoredState?.forcedDecayTargetVmax,
             forcedDecayElapsedHours: restoredState?.forcedDecayElapsedHours,
             forcedDecayDuration: restoredState?.forcedDecayDuration,
             forcedDecayIsContinuous: restoredState?.forcedDecayIsContinuous,
             dryAirPenaltyHours: restoredState?.dryAirPenaltyHours,
             dryAirPenaltyTotalHours: restoredState?.dryAirPenaltyTotalHours,
             shearPenaltyHours: restoredState?.shearPenaltyHours,
             shearPenaltyTotalHours: restoredState?.shearPenaltyTotalHours,
             ewrcFailurePenaltyHours: restoredState?.ewrcFailurePenaltyHours,
             ewrcPenaltyTotalHours: restoredState?.ewrcPenaltyTotalHours,
             cloggedRecoveryHours: restoredState?.cloggedRecoveryHours,
             cloggedRecoveryTotalHours: restoredState?.cloggedRecoveryTotalHours,
             isEyeClogged: restoredState?.isEyeClogged || false,
             isStructureDamaged: restoredState?.isStructureDamaged || false,
             upwellingHours: restoredState?.upwellingHours || 0,
             consecutiveUpwellingHours: restoredState?.consecutiveUpwellingHours || 0,
             upwellingPersistentPenaltyHours: restoredState?.upwellingPersistentPenaltyHours || 0,
             structuralDamageHours: restoredState?.structuralDamageHours || 0,
             tdHours: restoredState?.tdHours || 0,
             landTdHours: restoredState?.landTdHours || 0,
             superTyLandHours: restoredState?.superTyLandHours || 0,
             landHours: restoredState?.landHours || 0,
             landContactHours: restoredState?.landContactHours || 0,
             r10LandContactHours: restoredState?.r10LandContactHours || 0,
             vmax6Hours: restoredState?.vmax6Hours || 0,
             etHours: restoredState?.etHours || 0,
             warmWaterHoursAfterSea: restoredState?.warmWaterHoursAfterSea || 0,
             ewrcCooldownHours: restoredState?.ewrcCooldownHours || 0,
             ewrcCount: restoredState?.ewrcCount || 0,
             ewrcState: restoredState?.ewrcState || "none",
             ewrcProgress: restoredState?.ewrcProgress || 0,
             ewrcIsFailure: restoredState?.ewrcIsFailure || false,
             ...(restoredState ? restoredState : {}),
             active: restoredState ? !restoredState.dissipated : ty.active,
             history: ty.history.filter((h) => h.simHour <= currentHour)
           };
         });
         updateTyphoons(baseTyphoons);
      }
      const targetHour = currentHour + 1;
      let currentTyphoons = baseTyphoons;
      let accumulatedLogs: EventLog[] = [];

      // Advance 1 full simulation hour by running 6 sub-steps of 10 simulation minutes (matching live loop)
      for (let step = 1; step <= 6; step++) {
        const stepHour = currentHour + (step / 6.0);
        const result = engineRef.current.stepSimulation(currentTyphoons, config, stepHour, startDate);
        currentTyphoons = result.updatedTyphoons;
        if (result.logs.length > 0) {
          accumulatedLogs.push(...result.logs);
        }
      }

      updateTyphoons(currentTyphoons);
      setMaxHour(targetHour);
      setCurrentHour(targetHour);
      totalSimMinutesRef.current = targetHour * 60;
      simMinutesBufferRef.current = 0;

      if (accumulatedLogs.length > 0) {
        setEventLogs((prev) => [...prev, ...accumulatedLogs]);
        accumulatedLogs.forEach((l) => showToast(l.message, l.type));
      }

      playSndClick(config.soundVolume, config.soundEnabled);
    }
  };

  // Manual step backward to previous existing time point
  const handleStepBackward = () => {
    // Collect all history hours across all typhoons
    const historyHours = typhoons.flatMap((ty) => (ty.history || []).map((h) => h.simHour));
    historyHours.push(0);
    const uniqueSortedHours = Array.from(new Set(historyHours)).sort((a, b) => b - a);
    
    // Find the first hour that is strictly less than currentHour
    const prevHour = uniqueSortedHours.find((h) => h < currentHour);
    
    if (prevHour !== undefined) {
      handleSeek(prevHour);
    } else {
      if (currentHour > 0) {
        handleSeek(Math.max(0, Math.floor(currentHour - 1)));
      }
    }
    playSndClick(config.soundVolume, config.soundEnabled);
  };

  // Joystick steer adjustments callback
  const handleJoystickChange = useCallback((dx: number, dy: number, dragging?: boolean) => {
    setConfig((prev) => ({
      ...prev,
      joystickDx: dx,
      joystickDy: dy,
      joystickDragging: dragging !== undefined ? dragging : prev.joystickDragging
    }));
  }, []);

  // Map click deployment handler
   const handleMapClickPlacement = (lat: number, lon: number) => {
    // If placementMode is "none" and we already have typhoons on the map, ignore accidental map clicks
    if (placementMode === "none" && typhoons.length > 0) {
      return;
    }

    if (typhoons.length === 0) {
      simMinutesBufferRef.current = 0;
      totalSimMinutesRef.current = 0;
      engineRef.current.syncPrngToHour(0);
      const defaultMain = engineRef.current.createDefaultTyphoon(
        "main",
        "夜澜",
        lat,
        lon,
        config
      );
      setTyphoons([defaultMain]);
      setCurrentHour(0);
      setMaxHour(0);
      setIsPlaying(false);
      
      setEventLogs([
        {
          id: `init-genesis-direct-${Date.now()}`,
          time: new Date(),
          simHour: 0,
          type: "success",
          message: `🌱 手动生成：成功在点击点 (${lat.toFixed(1)}°N, ${lon.toFixed(1)}°E) 生成初始风力 8 级 (18m/s) 的热带风暴【夜澜】。`
        }
      ]);
      playSndSpawn(config.soundVolume, config.soundEnabled);
      showToast("成功催生初始风力 8 级 (18m/s) 的台风【夜澜】！", "success");
      return;
    }

   if (placementMode === "genesis") {
      setGenesisPos({ lat, lon });
      setPlacementMode("none");
      simMinutesBufferRef.current = 0;
      totalSimMinutesRef.current = 0;
      engineRef.current.syncPrngToHour(0);
      
      const defaultMain = engineRef.current.createDefaultTyphoon(
        "main",
        typhoons[0]?.name || "夜澜",
        lat,
        lon,
        config
      );
      setTyphoons([defaultMain]);
      setCurrentHour(0);
      setMaxHour(0);
      setIsPlaying(false);
      
      setEventLogs([
        {
          id: `init-genesis-${Date.now()}`,
          time: new Date(),
          simHour: 0,
          type: "success",
          message: `🌱 手动生成：成功在选定生成点 (${lat.toFixed(1)}°N, ${lon.toFixed(1)}°E) 催生 14 级主气旋【${typhoons[0]?.name || "夜澜"}】。`
        }
      ]);
      playSndSpawn(config.soundVolume, config.soundEnabled);
    } else if (placementMode === "main") {
      setTyphoons((prev) => {
        const copy = [...prev];
        const main = copy[0];
        if (main) {
          main.lat = lat;
          main.lon = lon;
          main.history = [
            {
              lat,
              lon,
              vmax: main.vmax,
              pmin: main.pmin,
              direction: main.direction,
              speed: main.speed,
              rmw: main.rmw,
              r7: main.r7,
              r10: main.r10,
              r12: main.r12,
              category: main.category,
              simHour: currentHour,
              landed: false,
              dissipated: false,
              extrTransition: 0,
               ewrcState: "none",
              ewrcProgress: 0,
              rapidIntensifying: false
            }
          ];
        }
        return copy;
      });
      setPlacementMode("none");
      setMaxHour(currentHour);
      totalSimMinutesRef.current = currentHour * 60;
      simMinutesBufferRef.current = 0;
      engineRef.current.syncPrngToHour(currentHour);
      
      showToast(`主台风中心已部署于北纬 ${lat.toFixed(2)}°, 东经 ${lon.toFixed(2)}°`, "success");
      playSndClick(config.soundVolume, config.soundEnabled);
    } else if (placementMode === "second") {
      // Spawn second typhoon
      const sizeFactor = 0.8;
      const secondR7Limit = Math.round(330 + Math.random() * 220); // distinct r7 max limit [330, 550] km
      const secondTy: Typhoon = {
        id: "second",
        name: "匿影",
        lat,
        lon,
        vmax: 15.0, // weak depression
        pmin: 1002,
        direction: 270,
        speed: 12,
        rmw: 16.0,
        r7: { ne: 120, se: 120, sw: 100, nw: 100 },
        r10: { ne: 0, se: 0, sw: 0, nw: 0 },
        r12: { ne: 0, se: 0, sw: 0, nw: 0 },
        active: true,
        category: TyphoonCategory.TD,
        landed: false,
        dissipated: false,
        extrTransition: 0,
        ewrcState: "none",
        ewrcProgress: 0,
        rapidIntensifying: false,
        maxR7Limit: secondR7Limit,
        upwellingHours: 0,
        history: [
          {
            lat,
            lon,
            vmax: 15.0,
            pmin: 1002,
            direction: 270,
            speed: 12,
            rmw: 16.0,
            r7: { ne: 120, se: 120, sw: 100, nw: 100 },
            r10: { ne: 0, se: 0, sw: 0, nw: 0 },
            r12: { ne: 0, se: 0, sw: 0, nw: 0 },
            category: TyphoonCategory.TD,
            simHour: currentHour,
            landed: false,
            dissipated: false,
            extrTransition: 0,
             ewrcState: "none",
            ewrcProgress: 0,
            rapidIntensifying: false,
            maxR7Limit: secondR7Limit,
            upwellingHours: 0
          }
        ]
      };

      setTyphoons((prev) => {
        // filter out existing second if any
        const filtered = prev.filter((t) => t.id !== "second");
        return [...filtered, secondTy];
      });

      setPlacementMode("none");
      setMaxHour(currentHour);
      totalSimMinutesRef.current = currentHour * 60;
      simMinutesBufferRef.current = 0;
      engineRef.current.syncPrngToHour(currentHour);
      
      showToast(`第二气旋【匿影】已生成于北纬 ${lat.toFixed(2)}°, 东经 ${lon.toFixed(2)}°`, "success");
      
      setEventLogs((prev) => [
        ...prev,
        {
          id: `fuji-spawn-${Date.now()}`,
          time: new Date(),
          simHour: currentHour,
          type: "warning",
          message: `🌀 建立副中心：成功在 (${lat.toFixed(1)}°N, ${lon.toFixed(1)}°E) 催生伴生扰动【匿影】。双系统开始进入藤原效应流场。`
        }
      ]);
      playSndUpgrade(config.soundVolume, config.soundEnabled);
    }
  };

  const deleteSecondTyphoon = () => {
    setTyphoons((prev) => prev.filter((t) => t.id !== "second"));
    showToast("第二伴生气旋已被删除", "info");
    playSndClick(config.soundVolume, config.soundEnabled);
  };

  const getThemeClass = () => {
    if (config.uiStyle === "ios") return "theme-ios";
    if (config.uiStyle === "professional") return "theme-professional";
    if (config.uiStyle === "light") return "theme-light";
    return "theme-default";
  };

  useEffect(() => {
    const themeClass = getThemeClass();
    document.documentElement.classList.remove("theme-default", "theme-professional", "theme-ios", "theme-light");
    document.documentElement.classList.add(themeClass);
    if (config.uiStyle === "light") {
      document.documentElement.style.colorScheme = "light";
    } else {
      document.documentElement.style.colorScheme = "dark";
    }
  }, [config.uiStyle]);

  return (
    <OrientationGuard>
      <div id="typhoon-app-container" className={`relative w-screen h-screen overflow-hidden ${config.uiStyle === "light" ? "bg-slate-100 text-slate-900" : "bg-[#07111F] text-slate-100"} font-sans ${getThemeClass()}`}>
        
        {/* Non-blocking GeoJSON status indicator */}
        <GeoJsonStatusBadge />

   {/* 1. Map View viewport */}
        <MapView
          typhoons={typhoons}
          layers={layers}
          config={config}
          speed={speed}
          startDate={startDate}
          onMapClickPlacement={handleMapClickPlacement}
          placementMode={placementMode}
          onDeployTyphoon={setPlacementMode}
          onSelectTrackPoint={handleSelectTrackPoint}
        />

        {/* 2. Top-Left Status Dashboard */}
        <TyphoonStatusCard 
          typhoon={typhoons[0] || null} 
          config={config} 
          onShowReport={() => setShowReport(true)} 
          isPlaying={isPlaying}
          isReplay={maxHour > 0 && !isPlaying}
          currentHour={currentHour}
          maxHour={maxHour}
        />

        {showReport && typhoons[0] && (
          <TyphoonReport 
            typhoon={typhoons[0]} 
            startDate={startDate}
            onClose={() => setShowReport(false)} 
            onOpenVideoExport={(t) => {
              setShowReport(false);
              setVideoExportTyphoon(t);
            }}
            onOpenReportModal={(t) => {
              setShowReport(false);
              setReportModalTyphoon(t);
            }}
          />
        )}

        {videoExportTyphoon && (
          <VideoExportModal
            typhoon={videoExportTyphoon}
            startDate={startDate}
            onClose={() => setVideoExportTyphoon(null)}
          />
        )}

        {reportModalTyphoon && (
          <TyphoonReportModal
            typhoon={reportModalTyphoon}
            startDate={startDate}
            onClose={() => setReportModalTyphoon(null)}
          />
        )}

        {isInfluenceModalOpen && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className={`relative w-80 max-w-full rounded-2xl p-6 border shadow-2xl transition-all duration-200 ${
              config.uiStyle === "light"
                ? "bg-white border-slate-200 text-slate-900"
                : "bg-[#0b1726]/98 border-slate-700/60 text-slate-100"
            }`}>
              
              {/* Main Categories Menu */}
              {activeInfluenceCategory === "main" && (() => {
                const activeTy = typhoons[0];
                const hasEwrc = activeTy && (activeTy.forcedEWRC || (activeTy.ewrcState && activeTy.ewrcState !== "none"));
                const hasDryAir = activeTy && activeTy.forcedDryAir;
                const hasShear = activeTy && activeTy.forcedShear !== undefined;
                const hasRI = activeTy && activeTy.forcedRapidIntensification;
                const isRISuppressed = activeTy && (!!activeTy.forcedDryAir || (activeTy.forcedShear !== undefined && activeTy.forcedShear > 15.0) || activeTy.ewrcState === "penalty_failure" || activeTy.ewrcIsFailure);

                return (
                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={() => {
                      setActiveInfluenceCategory("ewrc");
                      playSndClick(config.soundVolume, config.soundEnabled);
                    }}
                    className={`w-full py-3.5 px-4 rounded-xl font-medium text-sm flex items-center justify-between border transition-all ${
                      hasEwrc
                        ? "border-2 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)] bg-emerald-950/30 text-emerald-300"
                        : config.uiStyle === "light"
                        ? "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800"
                        : "bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/80 text-slate-200"
                    }`}
                  >
                    <span>🌀 开启眼墙置换 (EWRC) {hasEwrc && <span className="text-xs text-emerald-400 font-bold ml-1.5">[已开启/惩罚中]</span>}</span>
                    <span className="text-xs opacity-60">❯</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveInfluenceCategory("dry_air");
                      playSndClick(config.soundVolume, config.soundEnabled);
                    }}
                    className={`w-full py-3.5 px-4 rounded-xl font-medium text-sm flex items-center justify-between border transition-all ${
                      hasDryAir
                        ? "border-2 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)] bg-emerald-950/30 text-emerald-300"
                        : config.uiStyle === "light"
                        ? "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800"
                        : "bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/80 text-slate-200"
                    }`}
                  >
                    <span>🍂 干空气卷入 (Dry Air) {hasDryAir && <span className="text-xs text-emerald-400 font-bold ml-1.5">[惩罚中 - 点击打断]</span>}</span>
                    <span className="text-xs opacity-60">❯</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveInfluenceCategory("shear");
                      playSndClick(config.soundVolume, config.soundEnabled);
                    }}
                    className={`w-full py-3.5 px-4 rounded-xl font-medium text-sm flex items-center justify-between border transition-all ${
                      hasShear
                        ? "border-2 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)] bg-emerald-950/30 text-emerald-300"
                        : config.uiStyle === "light"
                        ? "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800"
                        : "bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/80 text-slate-200"
                    }`}
                  >
                    <span>⚡ 强风切变 (Wind Shear) {hasShear && <span className="text-xs text-emerald-400 font-bold ml-1.5">[惩罚中 - 点击打断]</span>}</span>
                    <span className="text-xs opacity-60">❯</span>
                  </button>

                  <button
                    onClick={() => {
                      if (typhoons.length === 0) {
                        showToast("当前没有活跃台风，无法施加影响", "warning");
                        return;
                      }
                      if (isRISuppressed) {
                        showToast("当前处于干空气/强风切/置换失败压制状态，禁止开启爆发增强！", "warning");
                        return;
                      }
                      handleApplyInfluence("rapid_intensify", "true");
                      setIsInfluenceModalOpen(false);
                      playSndClick(config.soundVolume, config.soundEnabled);
                    }}
                    className={`w-full py-3.5 px-4 rounded-xl font-medium text-sm flex items-center justify-between border transition-all ${
                      hasRI
                        ? "border-2 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)] bg-emerald-950/30 text-emerald-300"
                        : isRISuppressed
                        ? "opacity-50 cursor-not-allowed bg-slate-800/30 border-slate-700/40 text-slate-400"
                        : config.uiStyle === "light"
                        ? "bg-red-50/40 border-red-200 hover:bg-red-100/40 text-red-800"
                        : "bg-red-950/20 border-red-900/30 hover:bg-red-900/50 text-red-300"
                    }`}
                  >
                    <span>🔥 爆发增强 (Rapid Intensify) {hasRI && <span className="text-xs text-emerald-400 font-bold ml-1">[已注入 - 点击打断]</span>} {isRISuppressed && <span className="text-[10px] text-amber-400 font-normal ml-1">(被压制禁用)</span>}</span>
                    <span className="text-xs opacity-60">★</span>
                  </button>

                  {/* Target Intensity Control Slider */}
                  <div className={`p-3.5 rounded-xl border space-y-2 mt-1 ${
                    config.uiStyle === "light" ? "bg-blue-50/50 border-blue-200" : "bg-slate-800/40 border-slate-700/50"
                  }`}>
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="flex items-center gap-1.5 text-blue-400">
                        <span>🎯 目标强度</span>
                      </span>
                      <span className="font-mono text-blue-400 font-bold">{config.maxIntensityLimit || 70} m/s</span>
                    </div>
                    <input
                      type="range"
                      min={18}
                      max={105}
                      step={1}
                      value={config.maxIntensityLimit || 70}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setConfig((prev) => ({ ...prev, maxIntensityLimitEnabled: true, maxIntensityLimit: val }));
                      }}
                      className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none accent-blue-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>18 m/s (热带风暴)</span>
                      <span>105 m/s (超强台风)</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setIsInfluenceModalOpen(false);
                      playSndClick(config.soundVolume, config.soundEnabled);
                    }}
                    className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-sm transition-all border border-transparent text-red-500 hover:bg-red-500/10 text-center cursor-pointer"
                  >
                    关闭
                  </button>
                </div>
                );
              })()}

              {/* EWRC Sub Menu */}
              {activeInfluenceCategory === "ewrc" && (() => {
                const activeTy = typhoons[0];
                const isSuccessActive = activeTy && (activeTy.forcedEWRC === "success" || activeTy.ewrcState === "recovering_success");
                const isFailureActive = activeTy && (activeTy.forcedEWRC === "failure" || activeTy.ewrcState === "penalty_failure" || activeTy.ewrcState === "recovering_failure");

                return (
                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={() => {
                      if (typhoons.length > 0) {
                        handleApplyInfluence("ewrc", "success");
                      } else {
                        showToast("当前没有活跃台风，无法施加影响", "warning");
                      }
                      setIsInfluenceModalOpen(false);
                      playSndClick(config.soundVolume, config.soundEnabled);
                    }}
                    className={`w-full py-3.5 px-4 rounded-xl font-medium text-sm text-left border transition-all cursor-pointer ${
                      isSuccessActive
                        ? "border-2 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)] bg-emerald-950/30 text-emerald-300"
                        : config.uiStyle === "light"
                        ? "bg-emerald-50/50 border-emerald-200 hover:bg-emerald-100/50 text-emerald-800"
                        : "bg-emerald-950/20 border-emerald-800/30 hover:bg-emerald-900/30 text-emerald-300"
                    }`}
                  >
                    🚀 置换成功 (Success EWRC) {isSuccessActive && <span className="text-xs text-emerald-400 font-bold ml-1.5">[运行中 - 点击打断]</span>}
                  </button>

                  <button
                    onClick={() => {
                      if (typhoons.length > 0) {
                        handleApplyInfluence("ewrc", "failure");
                      } else {
                        showToast("当前没有活跃台风，无法施加影响", "warning");
                      }
                      setIsInfluenceModalOpen(false);
                      playSndClick(config.soundVolume, config.soundEnabled);
                    }}
                    className={`w-full py-3.5 px-4 rounded-xl font-medium text-sm text-left border transition-all cursor-pointer ${
                      isFailureActive
                        ? "border-2 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)] bg-emerald-950/30 text-emerald-300"
                        : config.uiStyle === "light"
                        ? "bg-amber-50/50 border-amber-200 hover:bg-amber-100/50 text-amber-800"
                        : "bg-amber-950/20 border-amber-800/30 hover:bg-amber-900/30 text-amber-300"
                    }`}
                  >
                    💥 置换失败 (Failure EWRC) {isFailureActive && <span className="text-xs text-emerald-400 font-bold ml-1.5">[惩罚中 - 点击打断]</span>}
                  </button>

                  <button
                    onClick={() => {
                      setActiveInfluenceCategory("main");
                      playSndClick(config.soundVolume, config.soundEnabled);
                    }}
                    className={`w-full py-3 px-4 rounded-xl font-medium text-sm border transition-all text-center cursor-pointer ${
                      config.uiStyle === "light"
                        ? "bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700"
                        : "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300"
                    }`}
                  >
                    返回上一级
                  </button>
                </div>
                );
              })()}

              {/* Dry Air Sub Menu */}
              {activeInfluenceCategory === "dry_air" && (() => {
                const activeTy = typhoons[0];
                const isCoreActive = activeTy && activeTy.forcedDryAir === "core";
                const isPeripheryActive = activeTy && activeTy.forcedDryAir === "periphery";

                return (
                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={() => {
                      if (typhoons.length > 0) {
                        handleApplyInfluence("dry_air", "core");
                      } else {
                        showToast("当前没有活跃台风，无法施加影响", "warning");
                      }
                      setIsInfluenceModalOpen(false);
                      playSndClick(config.soundVolume, config.soundEnabled);
                    }}
                    className={`w-full py-3.5 px-4 rounded-xl font-medium text-sm text-left border transition-all cursor-pointer ${
                      isCoreActive
                        ? "border-2 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)] bg-emerald-950/30 text-emerald-300"
                        : config.uiStyle === "light"
                        ? "bg-red-50/50 border-red-200 hover:bg-red-100/50 text-red-800"
                        : "bg-red-950/20 border-red-800/30 hover:bg-red-900/30 text-red-300"
                    }`}
                  >
                    💀 卷入核心 (Severe Core Damage) {isCoreActive && <span className="text-xs text-emerald-400 font-bold ml-1.5">[惩罚中 - 点击打断]</span>}
                  </button>

                  <button
                    onClick={() => {
                      if (typhoons.length > 0) {
                        handleApplyInfluence("dry_air", "periphery");
                      } else {
                        showToast("当前没有活跃台风，无法施加影响", "warning");
                      }
                      setIsInfluenceModalOpen(false);
                      playSndClick(config.soundVolume, config.soundEnabled);
                    }}
                    className={`w-full py-3.5 px-4 rounded-xl font-medium text-sm text-left border transition-all cursor-pointer ${
                      isPeripheryActive
                        ? "border-2 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)] bg-emerald-950/30 text-emerald-300"
                        : config.uiStyle === "light"
                        ? "bg-amber-50/50 border-amber-200 hover:bg-amber-100/50 text-amber-800"
                        : "bg-amber-950/20 border-amber-800/30 hover:bg-amber-900/30 text-amber-300"
                    }`}
                  >
                    🍂 卷入外围 (Peripheral Erosion) {isPeripheryActive && <span className="text-xs text-emerald-400 font-bold ml-1.5">[惩罚中 - 点击打断]</span>}
                  </button>

                  <button
                    onClick={() => {
                      setActiveInfluenceCategory("main");
                      playSndClick(config.soundVolume, config.soundEnabled);
                    }}
                    className={`w-full py-3 px-4 rounded-xl font-medium text-sm border transition-all text-center cursor-pointer ${
                      config.uiStyle === "light"
                        ? "bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700"
                        : "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300"
                    }`}
                  >
                    返回上一级
                  </button>
                </div>
                );
              })()}

              {/* Shear Sub Menu */}
              {activeInfluenceCategory === "shear" && (() => {
                const activeTy = typhoons[0];
                const is35Active = activeTy && activeTy.forcedShear === 35;
                const is22Active = activeTy && activeTy.forcedShear === 22;

                return (
                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={() => {
                      if (typhoons.length > 0) {
                        handleApplyInfluence("shear", "35.0");
                      } else {
                        showToast("当前没有活跃台风，无法施加影响", "warning");
                      }
                      setIsInfluenceModalOpen(false);
                      playSndClick(config.soundVolume, config.soundEnabled);
                    }}
                    className={`w-full py-3.5 px-4 rounded-xl font-medium text-sm text-left border transition-all cursor-pointer ${
                      is35Active
                        ? "border-2 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)] bg-emerald-950/30 text-emerald-300"
                        : config.uiStyle === "light"
                        ? "bg-red-50/50 border-red-200 hover:bg-red-100/50 text-red-800"
                        : "bg-red-950/20 border-red-800/30 hover:bg-red-900/30 text-red-300"
                    }`}
                  >
                    ⚡ 35节极强风切变 (35kt Extreme) {is35Active && <span className="text-xs text-emerald-400 font-bold ml-1.5">[惩罚中 - 点击打断]</span>}
                  </button>

                  <button
                    onClick={() => {
                      if (typhoons.length > 0) {
                        handleApplyInfluence("shear", "22.0");
                      } else {
                        showToast("当前没有活跃台风，无法施加影响", "warning");
                      }
                      setIsInfluenceModalOpen(false);
                      playSndClick(config.soundVolume, config.soundEnabled);
                    }}
                    className={`w-full py-3.5 px-4 rounded-xl font-medium text-sm text-left border transition-all cursor-pointer ${
                      is22Active
                        ? "border-2 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)] bg-emerald-950/30 text-emerald-300"
                        : config.uiStyle === "light"
                        ? "bg-amber-50/50 border-amber-200 hover:bg-amber-100/50 text-amber-800"
                        : "bg-amber-950/20 border-amber-800/30 hover:bg-amber-900/30 text-amber-300"
                    }`}
                  >
                    ⚡ 22节中强风切变 (22kt Moderate) {is22Active && <span className="text-xs text-emerald-400 font-bold ml-1.5">[惩罚中 - 点击打断]</span>}
                  </button>

                  <button
                    onClick={() => {
                      setActiveInfluenceCategory("main");
                      playSndClick(config.soundVolume, config.soundEnabled);
                    }}
                    className={`w-full py-3 px-4 rounded-xl font-medium text-sm border transition-all text-center cursor-pointer ${
                      config.uiStyle === "light"
                        ? "bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700"
                        : "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300"
                    }`}
                  >
                    返回上一级
                  </button>
                </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* 3. Top-Right UI Controls */}
        <div className="fixed top-2.5 right-2.5 z-[1000] flex flex-col gap-2">
          {/* Typhoon Status / Influence Trigger */}
          <button
            onClick={() => {
              setIsPlaying(false); // clicked button, auto pause!
              setIsInfluenceModalOpen(true);
              setActiveInfluenceCategory("main");
              playSndClick(config.soundVolume, config.soundEnabled);
            }}
            className="w-10 h-10 rounded-xl flex items-center justify-center border backdrop-blur-md bg-[#08121f]/94 border-slate-700/40 text-[#1E9CFF] hover:text-white hover:bg-slate-800/80 hover:border-[#1E9CFF]/50 transition-all duration-200 select-none cursor-pointer"
            title="台风状态与环境干预"
          >
            <Sparkles className="w-5 h-5 text-[#1E9CFF]" />
          </button>

          {/* Menu Toggle */}
          <button
            id="btn-toggle-menu"
            onClick={() => {
              setDrawerOpen(!drawerOpen);
              playSndClick(config.soundVolume, config.soundEnabled);
            }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center border backdrop-blur-md opacity-50 hover:opacity-100 transition-all duration-200 select-none cursor-pointer ${
              drawerOpen
                ? "bg-[#1E9CFF]/20 border-[#1E9CFF] text-[#1E9CFF] opacity-90"
                : "bg-[#08121f]/94 border-slate-700/40 text-slate-200 hover:text-white"
            }`}
            style={{
              marginRight: "env(safe-area-inset-right, 0px)",
              marginTop: "env(safe-area-inset-top, 0px)"
            }}
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* 4. Bottom-Left Virtual Steering Joystick */}
        <div
          id="joystick-wrapper"
          className="fixed bottom-20 left-10 z-[1000] opacity-50 hover:opacity-100 transition-opacity duration-200"
          style={{
            marginLeft: "env(safe-area-inset-left, 0px)"
          }}
        >
          <VirtualJoystick
            dx={config.joystickDx}
            dy={config.joystickDy}
            onChange={handleJoystickChange}
            strength={config.joystickStrength}
            enabled={typhoons[0] ? (!typhoons[0].dissipated && typhoons[0].active) : false}
          />
        </div>

        {/* 5. Bottom Controls Timeline bar */}
        <Timeline
          currentHour={currentHour}
          maxHour={maxHour}
          isPlaying={isPlaying}
          onManualDissipate={handleManualDissipate}
          collapsed={timelineCollapsed}
          onCollapseChange={setTimelineCollapsed}
          onPlayToggle={() => {
            const nextPlaying = !isPlaying;
            if (!nextPlaying) {
              // Reset joystick input configuration on pausing to guarantee smooth resume velocity preservation
              setConfig((prev) => ({
                ...prev,
                joystickDx: 0,
                joystickDy: 0,
                joystickDragging: false
              }));
            }
            if (nextPlaying && currentHour < maxHour) {
              // Truncate history
              updateTyphoons((prev) =>
                prev.map((ty) => {
                  const restoredState = ty.history.find((h) => h.simHour === currentHour);
                  return {
                    ...ty,
                    forcedEWRC: restoredState?.forcedEWRC,
                    forcedDryAir: restoredState?.forcedDryAir,
                    forcedShear: restoredState?.forcedShear,
                    forcedRapidIntensification: restoredState?.forcedRapidIntensification,
                    dryAirPenaltyHours: restoredState?.dryAirPenaltyHours,
                    dryAirPenaltyTotalHours: restoredState?.dryAirPenaltyTotalHours,
                    shearPenaltyHours: restoredState?.shearPenaltyHours,
                    shearPenaltyTotalHours: restoredState?.shearPenaltyTotalHours,
                    ewrcFailurePenaltyHours: restoredState?.ewrcFailurePenaltyHours,
                    ewrcPenaltyTotalHours: restoredState?.ewrcPenaltyTotalHours,
                    cloggedRecoveryHours: restoredState?.cloggedRecoveryHours,
                    cloggedRecoveryTotalHours: restoredState?.cloggedRecoveryTotalHours,
                    ...(restoredState ? restoredState : {}),
                    active: restoredState ? !restoredState.dissipated : ty.active,
                    history: ty.history.filter((h) => h.simHour <= currentHour)
                  };
                })
              );
              setMaxHour(currentHour);
              totalSimMinutesRef.current = currentHour * 60;
              simMinutesBufferRef.current = 0;
              engineRef.current.syncPrngToHour(currentHour);
            }
            setIsPlaying(nextPlaying);
            playSndClick(config.soundVolume, config.soundEnabled);
          }}
          onStepForward={handleStepForward}
          onStepBackward={handleStepBackward}
          onReset={resetSimulation}
          onSeek={handleSeek}
          speed={speed}
          onSpeedChange={(s) => {
            setSpeed(s);
            playSndClick(config.soundVolume, config.soundEnabled);
          }}
          startDate={startDate}
          onStartDateChange={handleStartDateChange}
        />

        {!isPlaying && timelineCollapsed && (
          <div
            className="fixed z-[1000] flex flex-col items-end gap-2 transition-all duration-200"
            style={{
              bottom: "16px",
              right: "16px",
              marginRight: "env(safe-area-inset-right, 16px)",
              marginBottom: "env(safe-area-inset-bottom, 16px)"
            }}
          >
            {/* The "More" Trigger Button -> Opens Style Selector Modal */}
            <button
              id="btn-more-options"
              onClick={() => {
                if (typhoons.length === 0) {
                  showToast("请先生成或创建一个台风", "warning");
                  return;
                }
                setForecastModalOpen(true);
                playSndClick(config.soundVolume, config.soundEnabled);
              }}
              className="w-10 h-10 rounded-xl flex items-center justify-center border backdrop-blur-md bg-[#08121f]/94 border-cyan-500/40 text-cyan-300 hover:text-white hover:bg-cyan-900/40 shadow-2xl transition-all duration-200 cursor-pointer active:scale-95 font-bold"
              title="生成及调整模拟预报图"
            >
              <Compass className="w-5 h-5 text-emerald-400" />
            </button>
          </div>
        )}

        {forecastModalOpen && typhoons[0] && (
          <ForecastImageModal
            isOpen={forecastModalOpen}
            onClose={() => setForecastModalOpen(false)}
            typhoon={typhoons[0]}
            currentHour={currentHour}
            startDate={startDate}
            config={config}
          />
        )}

        {/* 7. Slideout Config Side drawer Panel */}
        <ControlDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          typhoons={typhoons}
          config={config}
          onConfigChange={(p) => setConfig((prev) => ({ ...prev, ...p }))}
          onRenameTyphoon={(index, name) => {
            setTyphoons((prev) => {
              const newTys = [...prev];
              if (newTys[index]) {
                newTys[index] = { ...newTys[index], name };
              }
              return newTys;
            });
          }}
          layers={layers}
          onLayersChange={(l) => setLayers((prev) => ({ ...prev, ...l }))}
          onDeployTyphoon={setPlacementMode}
          onDeleteSecondTyphoon={deleteSecondTyphoon}
          onGenerateEnvironment={regenerateEnvironment}
          onResetSimulation={resetSimulation}
          onClearTrack={clearTrack}
          eventLogs={eventLogs}
          onClearLogs={() => setEventLogs([])}
          onSeekHour={handleSeek}
          genesisPos={genesisPos}
        />
      </div>
    </OrientationGuard>
  );
}
