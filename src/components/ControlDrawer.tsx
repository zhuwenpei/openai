/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import {
  X, Settings, Wind, Compass, Shield, Map, Download, Scroll, HelpCircle,
  Play, Pause, Trash2, Globe, Volume2, Waves, Zap, RefreshCw, Layers, Save, FolderOpen, Info
} from "lucide-react";
import PresetManager from "./PresetManager";
import { Typhoon, SimulationConfig, ActiveLayers, EventLog, TyphoonCategory } from "../types";
import { getCategoryColor } from "../simulation/Engine";
import { playSndSliderTick, playSndClick } from "../utils/audio";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  typhoons: Typhoon[];
  config: SimulationConfig;
  onConfigChange: (newConfig: Partial<SimulationConfig>) => void;
  onRenameTyphoon: (index: number, name: string) => void;
  layers: ActiveLayers;
  onLayersChange: (newLayers: Partial<ActiveLayers>) => void;
  onDeployTyphoon: (mode: "main" | "second" | "genesis" | "none") => void;
  onDeleteSecondTyphoon: () => void;
  onGenerateEnvironment: () => void;
  onResetSimulation: () => void;
  onClearTrack: () => void;
  eventLogs: EventLog[];
  onClearLogs: () => void;
  onSeekHour: (hour: number) => void;
  genesisPos: { lat: number; lon: number };
}

export default function ControlDrawer({
  isOpen,
  onClose,
  typhoons,
  config,
  onConfigChange: parentOnConfigChange,
  onRenameTyphoon,
  layers,
  onLayersChange,
  onDeployTyphoon,
  onDeleteSecondTyphoon,
  onGenerateEnvironment,
  onResetSimulation,
  onClearTrack,
  eventLogs,
  onClearLogs,
  onSeekHour,
  genesisPos
}: DrawerProps) {
  const [activeTab, setActiveTab] = useState<string>("simulation");
  const [activeTooltip, setActiveTooltip] = useState<{ title: string; content: string } | null>(null);

  const onConfigChange = (newConfig: Partial<SimulationConfig>) => {
    // Play a lovely satisfying slider tick sound if any slider values are changed!
    const sliderKeys = [
      "sst", "sstAnomaly", "shear", "rh700", "ohc", "soundVolume",
      "subtropicalHighStrength", "subtropicalHighLat", "subtropicalHighLon", "subtropicalHighWestExtent", "dryAirStrength",
      "westerliesStrength", "westerliesLat", "westerliesTroughLon", "westerliesTroughDepth",
      "betaDriftScale", "monsoonTroughStrength", "joystickStrength", "joystickSensitivity",
      "landfallDecayAdjustment", "landProximityDecayAdjustment", "cityDensity", "capsuleSize"
    ];
    const hasSliderKey = Object.keys(newConfig).some(k => sliderKeys.includes(k));
    if (hasSliderKey) {
      playSndSliderTick(config.soundVolume, config.soundEnabled);
    }
    parentOnConfigChange(newConfig);
  };

  // Parameter explanations tooltips
  const showTooltip = (title: string, content: string) => {
    setActiveTooltip({ title, content });
  };

  const hasSecondTyphoon = typhoons.some(t => t.id === "second");

  // Format GeoJSON for exporting
  const exportGeoJSON = () => {
    const mainTy = typhoons[0];
    if (!mainTy) return;

    const features = [];

    // LineString trajectory
    const coordinates = mainTy.history.map(h => [h.lon, h.lat]);
    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates
      },
      properties: {
        name: `${mainTy.name} 移动轨迹`,
        simSeed: config.seed
      }
    });

    // Points at nodes
    mainTy.history.forEach((h) => {
      features.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [h.lon, h.lat]
        },
        properties: {
          simHour: h.simHour,
          category: h.category,
          vmax_ms: h.vmax,
          pmin_hpa: h.pmin,
          direction: h.direction,
          speed_kmh: h.speed
        }
      });
    });

    const geojson = {
      type: "FeatureCollection",
      features
    };

    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Typhoon_${mainTy.name}_simulation.geojson`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Format CSV for exporting
  const exportCSV = () => {
    const mainTy = typhoons[0];
    if (!mainTy) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "simHour,lat,lon,vmax_ms,pmin_hpa,category,direction_deg,speed_kmh,rmw_km,r7_ne,r7_se,r7_sw,r7_nw\n";

    mainTy.history.forEach((h) => {
      csvContent += `${h.simHour},${h.lat.toFixed(4)},${h.lon.toFixed(4)},${h.vmax},${h.pmin},${h.category},${h.direction},${h.speed},${h.rmw},${h.r7.ne},${h.r7.se},${h.r7.sw},${h.r7.nw}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.href = encodedUri;
    link.download = `Typhoon_${mainTy.name}_nodes.csv`;
    link.click();
  };

  // Copy current JSON config
  const copyCurrentConfig = () => {
    const configStr = JSON.stringify({ config, activeLayers: layers }, null, 2);
    navigator.clipboard.writeText(configStr);
  };

  // Sound play mockup for interaction testing
  const testClick = () => {
    playSndClick(config.soundVolume, config.soundEnabled, config.soundMode || "mouse");
  };

  return (
    <div
      id="control-drawer-sidebar"
      className={`fixed top-0 right-0 bottom-0 z-[1500] w-[92%] sm:w-[380px] md:w-[440px] bg-[#18181b]/98 border-l border-zinc-800 shadow-2xl backdrop-blur-md text-white flex flex-col transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)"
      }}
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between border-b border-slate-800 p-4">
        <div className="flex items-center space-x-2">
          <Settings className="w-5 h-5 text-[#1E9CFF] animate-spin" style={{ animationDuration: "12s" }} />
          <h2 className="text-sm font-bold tracking-wider font-sans uppercase">台风物理控制台</h2>
        </div>
        <button
          id="btn-close-drawer"
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Accordion Tabs selectors */}
      <div className="flex bg-slate-950/60 border-b border-slate-900 overflow-x-auto scrollbar-none text-xs text-slate-400">
        {[
          { id: "simulation", label: "模拟", icon: Play },
          { id: "typhoon", label: "台风", icon: Wind },
          { id: "environment", label: "大气", icon: Compass },
          { id: "ocean", label: "海洋", icon: Waves },
          { id: "layers", label: "图层", icon: Layers, Save, FolderOpen },
          { id: "info", label: "信息", icon: Info },
          { id: "news", label: "快报", icon: Globe },
          { id: "export", label: "导出", icon: Download }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              id={`tab-select-${tab.id}`}
              onClick={() => {
                setActiveTab(tab.id);
                testClick();
              }}
              className={`flex-1 min-w-[58px] py-2.5 flex flex-col items-center justify-center gap-1 transition select-none border-b-2 cursor-pointer ${
                activeTab === tab.id
                  ? "border-[#1E9CFF] text-[#1E9CFF] font-semibold bg-slate-900/40"
                  : "border-transparent hover:text-slate-200 hover:bg-slate-900/20"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Tab Panel Content (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        
        {/* --- A. SIMULATION CONTROLS --- */}
        {activeTab === "simulation" && (
          <div className="space-y-4" id="panel-simulation">
            <PresetManager 
              category="global"
              currentConfig={config}
              onApply={onConfigChange}
              keysToSave={Object.keys(config) as any}
              defaultPresets={[
                { name: "全局默认 (Global Default)", config: config },
                { name: "硬核真实 (Hardcore Realism)", config: { landDecayEnabled: true, terrainDecayEnabled: true, rapidIntensifyEnabled: true, ewrcTrigger: "auto", maxIntensityLimitEnabled: true, maxIntensityLimit: 75, intensificationRate: 1.0 } },
                { name: "娱乐爽局 (Arcade Power)", config: { landDecayEnabled: false, terrainDecayEnabled: false, rapidIntensifyEnabled: true, intensificationRate: 2.0, maxIntensityLimitEnabled: false, ewrcTrigger: "off" } },
                { name: "超高海温 (Hyper Warm Sea)", config: { sstAnomaly: 2.0, warmPoolEnabled: true, ohcScale: 1.8 } },
                { name: "强引导环境 (Strong Steering)", config: { subtropicalHighStrength: 1.5, westerliesStrength: 1.5, shearScale: 1.2 } }
              ]}
            />
            
            <div className="bg-slate-900/30 p-3 rounded-xl border border-slate-800/40 space-y-3">
              <h3 className="text-xs font-bold text-[#1E9CFF] tracking-wider mb-1">全局模拟开关</h3>
              
              <div className="flex gap-2.5">
                <button
                  id="drawer-btn-reset"
                  onClick={onResetSimulation}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 text-xs font-semibold cursor-pointer"
                >
                  重置模拟
                </button>
                <button
                  id="drawer-btn-clear-track"
                  onClick={onClearTrack}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 text-xs font-semibold text-red-400 cursor-pointer"
                >
                  清空已存轨迹
                </button>
              </div>

              <button
                id="drawer-btn-regen-env"
                onClick={onGenerateEnvironment}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>重新生成气象背景场</span>
              </button>
            </div>

            <div className="bg-slate-900/30 p-3 rounded-xl border border-slate-800/40 space-y-3.5">
              <h3 className="text-xs font-bold text-[#1E9CFF] tracking-wider mb-1">声效 & 视觉</h3>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300">声学音效系统</span>
                <input
                  id="toggle-sound-effect"
                  type="checkbox"
                  checked={config.soundEnabled}
                  onChange={(e) => onConfigChange({ soundEnabled: e.target.checked })}
                  className="w-4 h-4 text-[#1E9CFF] accent-[#1E9CFF]"
                />
              </div>

              {config.soundEnabled && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>音效声量</span>
                    <span className="font-mono">{Math.round(config.soundVolume * 100)}%</span>
                  </div>
                  <input
                    id="slider-sound-volume"
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={config.soundVolume}
                    onChange={(e) => onConfigChange({ soundVolume: Number(e.target.value) })}
                    className="w-full h-1 bg-slate-950 rounded-lg appearance-none accent-[#1E9CFF]"
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300">自动跟随主台风中心</span>
                <input
                  id="toggle-follow-typhoon"
                  type="checkbox"
                  checked={config.followMainTyphoon}
                  onChange={(e) => onConfigChange({ followMainTyphoon: e.target.checked })}
                  className="w-4 h-4 text-[#1E9CFF] accent-[#1E9CFF]"
                />
              </div>
            </div>

            <div className="bg-slate-900/30 p-3 rounded-xl border border-slate-800/40 space-y-2">
              <h3 className="text-xs font-bold text-[#1E9CFF] tracking-wider mb-1">物理模拟可重复种子</h3>
              <div className="flex gap-2">
                <input
                  id="input-sim-seed"
                  type="text"
                  value={config.seed}
                  onChange={(e) => onConfigChange({ seed: e.target.value })}
                  placeholder="随机物理种子"
                  className="flex-1 bg-slate-950 text-slate-100 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono focus:border-[#1E9CFF] focus:outline-none"
                />
                <button
                  id="btn-seed-apply"
                  onClick={onGenerateEnvironment}
                  className="px-3 py-1 bg-[#1E9CFF] hover:bg-[#1589e6] active:bg-[#1E9CFF] text-xs font-semibold rounded-lg transition cursor-pointer"
                >
                  应用
                </button>
              </div>
              <p className="text-[10px] text-slate-500 leading-normal">输入相同种子，大尺度的空气流场、海洋海温、以及台风的历史轨迹节点将完全一致。</p>
            </div>
          </div>
        )}

        {/* --- B. TYPHOON ATTRIBUTES --- */}
        {activeTab === "typhoon" && (
          <div className="space-y-4" id="panel-typhoon">
            {/* Main Typhoon Card renaming */}
            <div className="bg-slate-900/30 p-3 rounded-xl border border-slate-800/40 space-y-3.5">
              <h3 className="text-xs font-bold text-[#1E9CFF] tracking-wider">主台风一设置</h3>
              
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">自定义台风命名</label>
                <input
                  id="input-typhoon-name"
                  type="text"
                  value={typhoons[0]?.name || ""}
                  onChange={(e) => {
                    onRenameTyphoon(0, e.target.value);
                  }}
                  className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:border-[#1E9CFF] focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <button
                  id="btn-deploy-genesis"
                  onClick={() => onDeployTyphoon("genesis")}
                  className="w-full py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-xs font-semibold rounded-xl text-teal-400 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  手动选择台风生成点 (点击地图)
                </button>
                
                <div className="text-[10px] text-slate-400 font-mono text-center bg-slate-950/40 py-1 rounded border border-slate-900">
                  当前生成源地: <b>{genesisPos.lat.toFixed(2)}°N, {genesisPos.lon.toFixed(2)}°E</b>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    id="btn-deploy-main"
                    onClick={() => onDeployTyphoon("main")}
                    className="py-2 bg-[#1E9CFF]/10 hover:bg-[#1E9CFF]/25 border border-[#1E9CFF]/30 hover:border-[#1E9CFF]/50 text-xs font-semibold rounded-xl text-[#1E9CFF] transition cursor-pointer"
                  >
                    强制平移当前中心
                  </button>
                  <button
                    id="btn-reset-main-pos"
                    onClick={onResetSimulation}
                    className="py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    重置回生成源地
                  </button>
                </div>
              </div>
            </div>

            {/* Binary / Second Typhoon Setup */}
            <div className="bg-slate-900/30 p-3 rounded-xl border border-slate-800/40 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-[#1E9CFF] tracking-wider">双台风二设置</h3>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${hasSecondTyphoon ? "bg-emerald-500/10 text-teal-400 border border-emerald-500/20" : "bg-slate-950 text-slate-500 border border-slate-900"}`}>
                  {hasSecondTyphoon ? "激活" : "未生成"}
                </span>
              </div>

              {hasSecondTyphoon ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs text-slate-300">
                    <span>第二台风: <b>匿影 (SIM-002)</b></span>
                    <button
                      id="btn-delete-second"
                      onClick={onDeleteSecondTyphoon}
                      className="p-1 hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-transparent hover:border-red-500/20 rounded-lg transition cursor-pointer"
                      title="删除第二台风"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    id="btn-deploy-second"
                    onClick={() => onDeployTyphoon("second")}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold rounded-xl text-slate-200 transition cursor-pointer"
                  >
                    点击地图移动其中心位置
                  </button>
                </div>
              ) : (
                <button
                  id="btn-create-second"
                  onClick={() => onDeployTyphoon("second")}
                  className="w-full py-2 bg-[#45D483]/15 hover:bg-[#45D483]/30 border border-[#45D483]/30 hover:border-[#45D483]/50 text-xs font-semibold rounded-xl text-[#45D483] transition cursor-pointer"
                >
                  建立副气旋（触发藤原效应）
                </button>
              )}
            </div>

            {/* Manual Steering parameters */}
            <div className="bg-slate-900/30 p-3 rounded-xl border border-slate-800/40 space-y-3.5">
              <h3 className="text-xs font-bold text-[#1E9CFF] tracking-wider flex items-center justify-between">
                <span>虚拟摇杆微调设置</span>
                <HelpCircle className="w-4 h-4 text-slate-500 cursor-pointer hover:text-slate-300" onClick={() => showTooltip("摇杆引导", "左下角的虚拟摇杆并非强制瞬移台风中心，而是产生一束叠加的环境引导物理风速，进而实现对路径趋势的手动偏航。松开手后，偏航风场会随着惯性回缩到零。")} />
              </h3>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>手动引导推力强度</span>
                  <span className="font-mono">{config.joystickStrength}级</span>
                </div>
                <input
                  id="slider-joy-strength"
                  type="range"
                  min={0.1}
                  max={2.0}
                  step={0.1}
                  value={config.joystickStrength}
                  onChange={(e) => onConfigChange({ joystickStrength: Number(e.target.value) })}
                  className="w-full h-1 bg-slate-950 rounded-lg appearance-none accent-[#1E9CFF]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>摇杆位移灵敏度</span>
                  <span className="font-mono">{Math.round(config.joystickSensitivity * 100)}%</span>
                </div>
                <input
                  id="slider-joy-sensitivity"
                  type="range"
                  min={0.2}
                  max={1.8}
                  step={0.1}
                  value={config.joystickSensitivity}
                  onChange={(e) => onConfigChange({ joystickSensitivity: Number(e.target.value) })}
                  className="w-full h-1 bg-slate-950 rounded-lg appearance-none accent-[#1E9CFF]"
                />
              </div>
            </div>

            {/* Land Decay Parameters Fine-tuning */}
            <div className="bg-slate-900/30 p-3 rounded-xl border border-slate-800/40 space-y-3.5">
              <h3 className="text-xs font-bold text-[#1E9CFF] tracking-wider">
                陆地物理摩擦与衰减微调
              </h3>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>登陆后中心强度减弱速率</span>
                  <span className="font-mono text-[#1E9CFF]">{config.landfallDecayAdjustment >= 0 ? "+" : ""}{Math.round(config.landfallDecayAdjustment * 100)}%</span>
                </div>
                <input
                  id="slider-landfall-decay"
                  type="range"
                  min={-1.0}
                  max={1.0}
                  step={0.1}
                  value={config.landfallDecayAdjustment ?? 0.0}
                  onChange={(e) => onConfigChange({ landfallDecayAdjustment: Number(e.target.value) })}
                  className="w-full h-1 bg-slate-950 rounded-lg appearance-none accent-[#1E9CFF]"
                />
                <p className="text-[9px] text-slate-500 leading-snug">以调弱后的新算法为基准(0%)。调节台风中心登陆陆地后的整体减弱幅度和衰变速度。</p>
              </div>

              <div className="space-y-1 border-t border-slate-800/40 pt-2.5">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>外围大风圈贴地粗糙摩擦</span>
                  <span className="font-mono text-[#1E9CFF]">{config.landProximityDecayAdjustment >= 0 ? "+" : ""}{Math.round(config.landProximityDecayAdjustment * 100)}%</span>
                </div>
                <input
                  id="slider-proximity-decay"
                  type="range"
                  min={-1.0}
                  max={1.0}
                  step={0.1}
                  value={config.landProximityDecayAdjustment ?? 0.0}
                  onChange={(e) => onConfigChange({ landProximityDecayAdjustment: Number(e.target.value) })}
                  className="w-full h-1 bg-slate-950 rounded-lg appearance-none accent-[#1E9CFF]"
                />
                <p className="text-[9px] text-slate-500 leading-snug">以调弱后的新算法为基准(0%)。控制外围七级/十级大风圈扫过陆地时的摩擦能量损耗速度。</p>
              </div>

              {/* Landfall TD Dissipation Mode Setting */}
              <div className="space-y-2 border-t border-slate-800/40 pt-2.5">
                <span className="text-[11px] font-semibold text-slate-300 block">登陆减弱为热带低压停编设置</span>
                <div className="space-y-1.5 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                    <input
                      type="radio"
                      name="landTdDissipateMode"
                      value="6h"
                      checked={(config.landTdDissipateMode || "6h") === "6h"}
                      onChange={() => onConfigChange({ landTdDissipateMode: "6h" })}
                      className="accent-[#1E9CFF] w-3.5 h-3.5"
                    />
                    <span>登陆后减弱为热带低压 6 小时后停编</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                    <input
                      type="radio"
                      name="landTdDissipateMode"
                      value="never"
                      checked={config.landTdDissipateMode === "never"}
                      onChange={() => onConfigChange({ landTdDissipateMode: "never" })}
                      className="accent-[#1E9CFF] w-3.5 h-3.5"
                    />
                    <span>登陆后变为热带低压不停编（只手动停编）</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Environment Physics Limiters */}
            <div className="bg-slate-900/30 p-3 rounded-xl border border-slate-800/40 space-y-3.5">
              <h3 className="text-xs font-bold text-[#1E9CFF] tracking-wider">
                物理反馈与强度上限
              </h3>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>台风发展增强速度</span>
                  <span className="font-mono text-[#1E9CFF]">{Math.round((config.intensificationRate ?? 1.0) * 100)}%</span>
                </div>
                <input
                  id="slider-intensification-rate"
                  type="range"
                  min={0.0}
                  max={2.0}
                  step={0.1}
                  value={config.intensificationRate ?? 1.0}
                  onChange={(e) => onConfigChange({ intensificationRate: Number(e.target.value) })}
                  className="w-full h-1 bg-slate-950 rounded-lg appearance-none accent-[#1E9CFF]"
                />
                <p className="text-[9px] text-slate-500 leading-snug">全局调控台风在海洋上的发展增强速度。</p>
              </div>

              <div className="space-y-1 border-t border-slate-800/40 pt-2.5">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>冷水上翻自毁减弱速率</span>
                  <span className="font-mono text-[#1E9CFF]">{config.upwellingFactor && config.upwellingFactor >= 0 ? "+" : ""}{Math.round(config.upwellingFactor || 0)}%</span>
                </div>
                <input
                  id="slider-upwelling-factor"
                  type="range"
                  min={-100}
                  max={100}
                  step={5}
                  value={config.upwellingFactor || 0}
                  onChange={(e) => onConfigChange({ upwellingFactor: Number(e.target.value) })}
                  className="w-full h-1 bg-slate-950 rounded-lg appearance-none accent-[#1E9CFF]"
                />
                <p className="text-[9px] text-slate-500 leading-snug">以1/3的减弱算法为基准(0%)。调节台风移动缓慢或打转时抽吸深层冷水导致的衰弱速度。</p>
              </div>

              <div className="space-y-2 border-t border-slate-800/40 pt-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">启用目标强度控制</span>
                  <input
                    id="toggle-intensity-limit"
                    type="checkbox"
                    checked={config.maxIntensityLimitEnabled || false}
                    onChange={(e) => onConfigChange({ maxIntensityLimitEnabled: e.target.checked })}
                    className="w-4 h-4 text-[#1E9CFF] accent-[#1E9CFF]"
                  />
                </div>
                {config.maxIntensityLimitEnabled && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>目标强度</span>
                      <span className="font-mono text-[#1E9CFF]">{config.maxIntensityLimit || 70} m/s</span>
                    </div>
                    <input
                      id="slider-intensity-limit"
                      type="range"
                      min={18}
                      max={105}
                      step={1}
                      value={config.maxIntensityLimit || 70}
                      onChange={(e) => onConfigChange({ maxIntensityLimit: Number(e.target.value) })}
                      className="w-full h-1 bg-slate-950 rounded-lg appearance-none accent-[#1E9CFF]"
                    />
                    <p className="text-[9px] text-slate-500 leading-snug">台风强度逼近或超过设定值时，将平滑调整至目标强度。</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- C. ATMOSPHERIC SYSTEMS --- */}
        {activeTab === "environment" && (
          <div className="space-y-4" id="panel-atmosphere">

            
            <div className="bg-slate-900/30 p-3 rounded-xl border border-slate-800/40 space-y-2">
              <h3 className="text-xs font-bold text-[#1E9CFF] tracking-wider mb-2">气候预设 (Atmospheric Presets)</h3>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { name: "1月", cfg: { shearPreset: "january", subtropicalHighStrength: 0.8, subtropicalHighLat: 15, subtropicalHighWestExtent: 140, westerliesLat: 25, westerliesStrength: 1.5, shearScale: 1.1, dryAirStrength: 1.0 } },
                  { name: "2月", cfg: { shearPreset: "february", subtropicalHighStrength: 0.8, subtropicalHighLat: 15, subtropicalHighWestExtent: 142, westerliesLat: 26, westerliesStrength: 1.4, shearScale: 1.1, dryAirStrength: 1.0 } },
                  { name: "3月", cfg: { shearPreset: "march", subtropicalHighStrength: 0.9, subtropicalHighLat: 16, subtropicalHighWestExtent: 135, westerliesLat: 28, westerliesStrength: 1.3, shearScale: 1.0, dryAirStrength: 0.8 } },
                  { name: "4月", cfg: { shearPreset: "april", subtropicalHighStrength: 1.0, subtropicalHighLat: 18, subtropicalHighWestExtent: 130, westerliesLat: 30, westerliesStrength: 1.2, shearScale: 0.9, dryAirStrength: 0.6 } },
                  { name: "5月", cfg: { shearPreset: "may", subtropicalHighStrength: 1.1, subtropicalHighLat: 22, subtropicalHighWestExtent: 125, westerliesLat: 35, westerliesStrength: 1.0, shearScale: 0.8, dryAirStrength: 0.4 } },
                  { name: "6月", cfg: { shearPreset: "june", subtropicalHighStrength: 1.2, subtropicalHighLat: 26, subtropicalHighWestExtent: 118, westerliesLat: 39, westerliesStrength: 0.9, shearScale: 0.8, dryAirStrength: 0.3 } },
                  { name: "7月", cfg: { shearPreset: "july", subtropicalHighStrength: 1.3, subtropicalHighLat: 34, subtropicalHighWestExtent: 115, westerliesLat: 45, westerliesStrength: 0.8, shearScale: 0.8, dryAirStrength: 0.2 } },
                  { name: "8月", cfg: { shearPreset: "august", subtropicalHighStrength: 1.4, subtropicalHighLat: 36, subtropicalHighWestExtent: 110, westerliesLat: 47, westerliesStrength: 0.7, shearScale: 0.8, dryAirStrength: 0.1 } },
                  { name: "9月", cfg: { shearPreset: "september", subtropicalHighStrength: 1.2, subtropicalHighLat: 31, subtropicalHighWestExtent: 120, westerliesLat: 41, westerliesStrength: 0.9, shearScale: 0.8, dryAirStrength: 0.2 } },
                  { name: "10月", cfg: { shearPreset: "october", subtropicalHighStrength: 1.1, subtropicalHighLat: 25, subtropicalHighWestExtent: 125, westerliesLat: 35, westerliesStrength: 1.1, shearScale: 0.9, dryAirStrength: 0.5 } },
                  { name: "11月", cfg: { shearPreset: "november", subtropicalHighStrength: 0.9, subtropicalHighLat: 18, subtropicalHighWestExtent: 135, westerliesLat: 28, westerliesStrength: 1.3, shearScale: 1.0, dryAirStrength: 0.8 } },
                  { name: "12月", cfg: { shearPreset: "december", subtropicalHighStrength: 0.8, subtropicalHighLat: 16, subtropicalHighWestExtent: 140, westerliesLat: 26, westerliesStrength: 1.4, shearScale: 1.1, dryAirStrength: 1.0 } },
                  { name: "无", cfg: { shearPreset: "global_low", subtropicalHighStrength: 0, westerliesStrength: 0, shearScale: 0.5, dryAirStrength: 0 } }
                ].map(p => (
                  <button key={p.name} className="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[10px] text-slate-300 transition-colors" onClick={() => onConfigChange(p.cfg)}>
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <span className="text-[10px] text-slate-400 mt-1">追加模式:</span>
                {[
                  { name: "良好", mod: { shear: Math.max(0, (config.shear || 8) - 5), dryAirStrength: Math.max(0, (config.dryAirStrength || 0) - 0.5) } },
                  { name: "默认", mod: {} },
                  { name: "恶劣", mod: { shear: (config.shear || 8) + 8, dryAirStrength: (config.dryAirStrength || 0) + 0.8 } }
                ].map(m => (
                  <button key={m.name} className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 rounded text-[10px] text-teal-400 transition-colors" onClick={() => onConfigChange(m.mod)}>
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
            {/* Subtropical High config */}
            <div className="bg-slate-900/30 p-3 rounded-xl border border-slate-800/40 space-y-3.5">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-[#1E9CFF] tracking-wider flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-[#1E9CFF]" />
                  <span>副热带高压系统</span>
                </h3>
                <input
                  id="toggle-subhigh"
                  type="checkbox"
                  checked={config.subtropicalHighEnabled}
                  onChange={(e) => onConfigChange({ subtropicalHighEnabled: e.target.checked })}
                  className="w-4 h-4 text-[#1E9CFF] accent-[#1E9CFF]"
                />
              </div>

              {config.subtropicalHighEnabled && (
                <div className="space-y-3 pt-2 border-t border-slate-900">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        副高环流强度
                        <HelpCircle className="w-3.5 h-3.5 text-slate-600 hover:text-slate-400 cursor-pointer" onClick={() => showTooltip("副热带高压", "副高是西北太平洋台风最核心的引导气流源。强度越强，其南侧的偏东风分量越大，台风总体在低纬度向西偏西方向急速移动。")} />
                      </span>
                      <span className="font-mono text-[#1E9CFF]">{Math.round(config.subtropicalHighStrength * 100)}%</span>
                    </div>
                    <input
                      id="slider-subhigh-strength"
                      type="range"
                      min={0.0}
                      max={2.0}
                      step={0.1}
                      value={config.subtropicalHighStrength}
                      onChange={(e) => onConfigChange({ subtropicalHighStrength: Number(e.target.value) })}
                      className="w-full h-1 bg-slate-950 rounded-lg appearance-none accent-[#1E9CFF]"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>副高脊线平均纬度</span>
                      <span className="font-mono text-[#1E9CFF]">{config.subtropicalHighLat}°N</span>
                    </div>
                    <input
                      id="slider-subhigh-lat"
                      type="range"
                      min={18}
                      max={45}
                      step={0.5}
                      value={config.subtropicalHighLat}
                      onChange={(e) => onConfigChange({ subtropicalHighLat: Number(e.target.value) })}
                      className="w-full h-1 bg-slate-950 rounded-lg appearance-none accent-[#1E9CFF]"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>副高西伸脊点经度</span>
                      <span className="font-mono text-[#1E9CFF]">{config.subtropicalHighWestExtent}°E</span>
                    </div>
                    <input
                      id="slider-subhigh-west"
                      type="range"
                      min={105}
                      max={142}
                      step={1.0}
                      value={config.subtropicalHighWestExtent}
                      onChange={(e) => onConfigChange({ subtropicalHighWestExtent: Number(e.target.value) })}
                      className="w-full h-1 bg-slate-950 rounded-lg appearance-none accent-[#1E9CFF]"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>副高南北跨度 (N-S Extent)</span>
                      <span className="font-mono text-[#1E9CFF]">{((config.subtropicalHighNSSize !== undefined ? config.subtropicalHighNSSize : 1.0) * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      id="slider-subhigh-ns"
                      type="range"
                      min={0.5}
                      max={2.0}
                      step={0.1}
                      value={config.subtropicalHighNSSize !== undefined ? config.subtropicalHighNSSize : 1.0}
                      onChange={(e) => onConfigChange({ subtropicalHighNSSize: Number(e.target.value) })}
                      className="w-full h-1 bg-slate-950 rounded-lg appearance-none accent-[#1E9CFF]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Westerlies config */}
            <div className="bg-slate-900/30 p-3 rounded-xl border border-slate-800/40 space-y-3.5">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-[#1E9CFF] tracking-wider flex items-center gap-1.5">
                  <Wind className="w-4 h-4 text-[#1E9CFF]" />
                  <span>中纬度西风带与急流</span>
                </h3>
                <input
                  id="toggle-westerlies"
                  type="checkbox"
                  checked={config.westerliesEnabled}
                  onChange={(e) => onConfigChange({ westerliesEnabled: e.target.checked })}
                  className="w-4 h-4 text-[#1E9CFF] accent-[#1E9CFF]"
                />
              </div>

              {config.westerliesEnabled && (
                <div className="space-y-3 pt-2 border-t border-slate-900">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        西风带引导流强度
                        <HelpCircle className="w-3.5 h-3.5 text-slate-600 hover:text-slate-400 cursor-pointer" onClick={() => showTooltip("中纬度西风带", "中高纬度的极地急流和深槽会产生强大的偏西引导风速。一旦台风越过副高脊线，被吸入西风槽前，它会猛烈转向东北方向加速移动，最终完成温带气旋变性。")} />
                      </span>
                      <span className="font-mono text-[#1E9CFF]">{Math.round(config.westerliesStrength * 100)}%</span>
                    </div>
                    <input
                      id="slider-westerlies-strength"
                      type="range"
                      min={0.0}
                      max={2.0}
                      step={0.1}
                      value={config.westerliesStrength}
                      onChange={(e) => onConfigChange({ westerliesStrength: Number(e.target.value) })}
                      className="w-full h-1 bg-slate-950 rounded-lg appearance-none accent-[#1E9CFF]"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>西风急流轴纬度位置</span>
                      <span className="font-mono text-[#1E9CFF]">{config.westerliesLat}°N</span>
                    </div>
                    <input
                      id="slider-westerlies-lat"
                      type="range"
                      min={26}
                      max={45}
                      step={0.5}
                      value={config.westerliesLat}
                      onChange={(e) => onConfigChange({ westerliesLat: Number(e.target.value) })}
                      className="w-full h-1 bg-slate-950 rounded-lg appearance-none accent-[#1E9CFF]"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>西风槽槽前经度</span>
                      <span className="font-mono text-[#1E9CFF]">{config.westerliesTroughLon}°E</span>
                    </div>
                    <input
                      id="slider-westerlies-trough-lon"
                      type="range"
                      min={112}
                      max={145}
                      step={1.0}
                      value={config.westerliesTroughLon}
                      onChange={(e) => onConfigChange({ westerliesTroughLon: Number(e.target.value) })}
                      className="w-full h-1 bg-slate-950 rounded-lg appearance-none accent-[#1E9CFF]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Environmental Limiters (Shear & Humidity) */}
            <div className="bg-slate-900/30 p-3 rounded-xl border border-slate-800/40 space-y-3.5">
              <h3 className="text-xs font-bold text-[#1E9CFF] tracking-wider">大气垂直物理切变</h3>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>月份气候场预设</span>
                </div>
                <select
                  value={config.shearPreset || 'global_low'}
                  onChange={(e) => onConfigChange({ shearPreset: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700/50 rounded text-slate-300 text-xs py-1 px-2 focus:outline-none focus:border-[#1E9CFF]"
                >
                  <option value="global_low">全局低风切 (Global Low)</option>
                  <option value="january">1月 (January)</option>
                  <option value="february">2月 (February)</option>
                  <option value="march">3月 (March)</option>
                  <option value="april">4月 (April)</option>
                  <option value="may">5月 (May)</option>
                  <option value="june">6月 (June)</option>
                  <option value="july">7月 (July)</option>
                  <option value="august">8月 (August)</option>
                  <option value="september">9月 (September)</option>
                  <option value="october">10月 (October)</option>
                  <option value="november">11月 (November)</option>
                  <option value="december">12月 (December)</option>
                </select>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    垂直风切变倍率 (Shear)
                    <HelpCircle className="w-3.5 h-3.5 text-slate-600 hover:text-slate-400 cursor-pointer" onClick={() => showTooltip("垂直风切变", "高低空风向和风速的差。切变极低时，台风高低空暖心易于重合，爆发性增强；切变极高时（如靠近西风带），台风结构被拦腰斩断，对流歪斜，导致快速衰退。")} />
                  </span>
                  <span className="font-mono text-[#1E9CFF]">{Math.round(config.shearScale * 100)}%</span>
                </div>
                <input
                  id="slider-shear-scale"
                  type="range"
                  min={0.2}
                  max={2.0}
                  step={0.1}
                  value={config.shearScale}
                  onChange={(e) => onConfigChange({ shearScale: Number(e.target.value) })}
                  className="w-full h-1 bg-slate-950 rounded-lg appearance-none accent-[#1E9CFF]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>中层700hPa湿度倍率</span>
                  <span className="font-mono text-[#1E9CFF]">{Math.round(config.humidityScale * 100)}%</span>
                </div>
                <input
                  id="slider-humidity-scale"
                  type="range"
                  min={0.3}
                  max={1.5}
                  step={0.1}
                  value={config.humidityScale}
                  onChange={(e) => onConfigChange({ humidityScale: Number(e.target.value) })}
                  className="w-full h-1 bg-slate-950 rounded-lg appearance-none accent-[#1E9CFF]"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300">干空气主动侵入机制</span>
                <input
                  id="toggle-dry-air"
                  type="checkbox"
                  checked={config.dryAirEnabled}
                  onChange={(e) => onConfigChange({ dryAirEnabled: e.target.checked })}
                  className="w-4 h-4 text-[#1E9CFF] accent-[#1E9CFF]"
                />
              </div>
            </div>
          </div>
        )}

        {/* --- D. OCEANIC SYSTEMS --- */}
        {activeTab === "ocean" && (
          <div className="space-y-4" id="panel-ocean">

            <div className="bg-slate-900/30 p-3 rounded-xl border border-slate-800/40 space-y-2">
              <h3 className="text-xs font-bold text-[#1E9CFF] tracking-wider mb-2">海洋预设 (Oceanic Presets)</h3>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { name: "1月", cfg: { sstBase: 27.8, sstPivotLat: 18, sstAnomaly: -1.2, sstNorthSouthGradient: 1.8 } },
                  { name: "2月", cfg: { sstBase: 27.5, sstPivotLat: 16, sstAnomaly: -1.5, sstNorthSouthGradient: 1.9 } },
                  { name: "3月", cfg: { sstBase: 28.1, sstPivotLat: 19, sstAnomaly: -1.0, sstNorthSouthGradient: 1.6 } },
                  { name: "4月", cfg: { sstBase: 28.6, sstPivotLat: 22, sstAnomaly: -0.5, sstNorthSouthGradient: 1.3 } },
                  { name: "5月", cfg: { sstBase: 29.1, sstPivotLat: 25, sstAnomaly: 0.2, sstNorthSouthGradient: 1.1 } },
                  { name: "6月", cfg: { sstBase: 29.5, sstPivotLat: 27, sstAnomaly: 0.8, sstNorthSouthGradient: 0.9 } },
                  { name: "7月", cfg: { sstBase: 29.8, sstPivotLat: 29, sstAnomaly: 1.2, sstNorthSouthGradient: 0.8 } },
                  { name: "8月", cfg: { sstBase: 30.0, sstPivotLat: 31, sstAnomaly: 1.5, sstNorthSouthGradient: 0.7 } },
                  { name: "9月", cfg: { sstBase: 29.7, sstPivotLat: 29.3, sstAnomaly: 1.3, sstNorthSouthGradient: 0.8 } },
                  { name: "10月", cfg: { sstBase: 29.3, sstPivotLat: 26, sstAnomaly: 0.8, sstNorthSouthGradient: 1.0 } },
                  { name: "11月", cfg: { sstBase: 28.5, sstPivotLat: 22, sstAnomaly: 0.0, sstNorthSouthGradient: 1.4 } },
                  { name: "12月", cfg: { sstBase: 28.0, sstPivotLat: 20, sstAnomaly: -0.8, sstNorthSouthGradient: 1.6 } },
                  { name: "拉尼娜", cfg: { sstAnomaly: 0.8, warmPoolEnabled: true, ohcScale: 1.4 } },
                  { name: "厄尔尼诺", cfg: { sstAnomaly: -0.5, warmPoolEnabled: false, ohcScale: 0.8 } }
                ].map(p => (
                  <button key={p.name} className="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[10px] text-slate-300 transition-colors" onClick={() => onConfigChange(p.cfg)}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-slate-900/30 p-3 rounded-xl border border-slate-800/40 space-y-3.5">
              <h3 className="text-xs font-bold text-[#1E9CFF] tracking-wider">海表热容量与异常场</h3>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    海表温度整体偏差 (SST)
                    <HelpCircle className="w-3.5 h-3.5 text-slate-600 hover:text-slate-400 cursor-pointer" onClick={() => showTooltip("海表温度", "海温是热带气旋的燃料箱。SST高于26.5℃是产生台风的前提，SST > 28.5℃配合极低的垂直切变极易促发巨型台风诞生。")} />
                  </span>
                  <span className="font-mono text-[#1E9CFF]">{config.sstAnomaly >= 0 ? "+" : ""}{config.sstAnomaly.toFixed(1)} ℃</span>
                </div>
                <input
                  id="slider-sst-anomaly"
                  type="range"
                  min={-3.0}
                  max={3.0}
                  step={0.1}
                  value={config.sstAnomaly}
                  onChange={(e) => onConfigChange({ sstAnomaly: Number(e.target.value) })}
                  className="w-full h-1 bg-slate-950 rounded-lg appearance-none accent-[#1E9CFF]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    海温南北衰减梯度 (SST Gradient)
                    <HelpCircle className="w-3.5 h-3.5 text-slate-600 hover:text-slate-400 cursor-pointer" onClick={() => showTooltip("南北梯度", "控制北向海温衰减的剧烈程度。0% 为不衰减（南北海温一致），100% 为标准衰减。")} />
                  </span>
                  <span className="font-mono text-[#1E9CFF]">{((config.sstNorthSouthGradient !== undefined ? config.sstNorthSouthGradient : 1.0) * 100).toFixed(0)}%</span>
                </div>
                <input
                  id="slider-sst-gradient"
                  type="range"
                  min={0.0}
                  max={1.0}
                  step={0.01}
                  value={config.sstNorthSouthGradient !== undefined ? config.sstNorthSouthGradient : 1.0}
                  onChange={(e) => onConfigChange({ sstNorthSouthGradient: Number(e.target.value) })}
                  className="w-full h-1 bg-slate-950 rounded-lg appearance-none accent-[#1E9CFF]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>海洋热含量倍率 (OHC)</span>
                  <span className="font-mono text-[#1E9CFF]">{Math.round(config.ohcScale * 100)}%</span>
                </div>
                <input
                  id="slider-ohc-scale"
                  type="range"
                  min={0.0}
                  max={2.0}
                  step={0.1}
                  value={config.ohcScale}
                  onChange={(e) => onConfigChange({ ohcScale: Number(e.target.value) })}
                  className="w-full h-1 bg-slate-950 rounded-lg appearance-none accent-[#1E9CFF]"
                />
              </div>
            </div>

            <div className="bg-slate-900/30 p-3 rounded-xl border border-slate-800/40 space-y-3">
              <h3 className="text-xs font-bold text-[#1E9CFF] tracking-wider">洋流与热力异常区</h3>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300">菲律宾以东“暖池”增强</span>
                <input
                  id="toggle-warmpool"
                  type="checkbox"
                  checked={config.warmPoolEnabled}
                  onChange={(e) => onConfigChange({ warmPoolEnabled: e.target.checked })}
                  className="w-4 h-4 text-[#1E9CFF] accent-[#1E9CFF]"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300">台湾东南部“冷涡”负异常</span>
                <input
                  id="toggle-coldeddy"
                  type="checkbox"
                  checked={config.coldEddyEnabled}
                  onChange={(e) => onConfigChange({ coldEddyEnabled: e.target.checked })}
                  className="w-4 h-4 text-[#1E9CFF] accent-[#1E9CFF]"
                />
              </div>
              
              <div className="space-y-1 border-t border-slate-800/40 pt-2.5">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>强海气耦合系数 (Coupling)</span>
                  <span className="font-mono text-[#1E9CFF]">{Math.round(config.airSeaCoupling * 100)}%</span>
                </div>
                <input
                  id="slider-air-sea-coupling"
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={config.airSeaCoupling}
                  onChange={(e) => onConfigChange({ airSeaCoupling: Number(e.target.value) })}
                  className="w-full h-1 bg-slate-950 rounded-lg appearance-none accent-[#1E9CFF]"
                />
              </div>
            </div>
          </div>
        )}

        {/* --- E. GIS LAYERS --- */}
        {activeTab === "layers" && (
          <div className="space-y-4" id="panel-layers">
            {/* Basemap radios */}
            <div className="bg-slate-900/30 p-3 rounded-xl border border-slate-800/40 space-y-2.5">
              <h3 className="text-xs font-bold text-[#1E9CFF] tracking-wider flex items-center gap-1">
                <Map className="w-4 h-4 text-[#1E9CFF]" />
                <span>电子底图源选择 (单选)</span>
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { id: "dark", label: "深色雷达控制台" },
                  { id: "satellite", label: "高精真彩卫星" },
                  { id: "terrain", label: "海底与地形" },
                  { id: "light", label: "简洁行政纸张" },
                  { id: "googleSatellite", label: "谷歌地球卫星" },
                  { id: "googleStreet", label: "谷歌地图街道" },
                  { id: "blueMarble", label: "Blue Marble 2004" },
                  { id: "bingSatellite", label: "Bing 卫星图" },
                  { id: "none", label: "空白无地图" }
                ].map((base) => (
                  <label
                    key={base.id}
                    id={`label-base-${base.id}`}
                    className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition ${
                      layers.baseMap === base.id
                        ? "bg-[#1E9CFF]/10 border-[#1E9CFF] text-[#1E9CFF]"
                        : "bg-slate-950/40 border-slate-800 text-slate-300 hover:text-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="basemap-group"
                      checked={layers.baseMap === base.id}
                      onChange={() => onLayersChange({ baseMap: base.id as any })}
                      className="hidden"
                    />
                    <span>{base.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Overlay Layers, Save, FolderOpen lists */}
            <div className="bg-slate-900/30 p-3 rounded-xl border border-slate-800/40 space-y-3">
              <h3 className="text-xs font-bold text-[#1E9CFF] tracking-wider">叠加气象观测图层 (多选)</h3>

              <div className="space-y-2.5 text-xs">
                {[
                  { key: "sst", label: "SST 海表温度全域彩虹栅格" },
                  { key: "ohc", label: "OHC 海洋热容量热力分布" },
                  { key: "strongDryAir", label: "强干空气侵入分布 (700hPa RH < 50%)" },
                  { key: "strongWindShear", label: "强垂直风切变区 (200-850hPa > 18 kt)" },
                  { key: "subHigh", label: "5880 gpm 副热带高压山脊圈" },
                  { key: "westerlies", label: "西风槽与急流方向轴线" },
                  { key: "coastline", label: "高分辨率防灾海岸线掩膜" },
                  { key: "border", label: "省界与国界雷达边缘线" },
                  { key: "track", label: "台风移动历史强度轨迹" },
                  { key: "windRadii", label: "七/十/十二级非对称风圈" },
                  { key: "forecast", label: "120h台风预报路径 (大气引导推算)" },
                  { key: "forecastCone", label: "120h预报路径概率不确定性锥 (精细锥体)" },
                  { key: "weatherStations", label: "沿岸气象站点监控 (实时参数与预警)" },
                  { key: "cursor", label: "页面中央十字测量光标 (实时检测参数)" }
                ].map((ov) => (
                  <label
                    key={ov.key}
                    id={`label-layer-${ov.key}`}
                    className="flex items-center justify-between py-1 text-slate-300 hover:text-white cursor-pointer"
                  >
                    <span>{ov.label}</span>
                    <input
                      id={`checkbox-layer-${ov.key}`}
                      type="checkbox"
                      checked={(layers as any)[ov.key]}
                      onChange={(e) => onLayersChange({ [ov.key]: e.target.checked })}
                      className="w-4 h-4 text-[#1E9CFF] accent-[#1E9CFF]"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Raster Layer Resolution Adjustment Slider */}
            <div className="bg-slate-900/30 p-3 rounded-xl border border-slate-800/40 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#1E9CFF] tracking-wider">栅格图层分辨率调节</h3>
                <span className="text-[10px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-300 font-mono">
                  {layers.rasterResolution || 6} 像素
                </span>
              </div>
              <div className="space-y-1">
                <input
                  id="slider-raster-resolution"
                  type="range"
                  min="2"
                  max="32"
                  step="1"
                  value={layers.rasterResolution || 6}
                  onChange={(e) => {
                    onLayersChange({ rasterResolution: parseInt(e.target.value) });
                  }}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#1E9CFF]"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-sans">
                  <span>极清 (2px)</span>
                  <span className="text-slate-400 font-semibold">
                    {(layers.rasterResolution || 6) <= 4
                      ? "极致画质 (可能影响帧率)"
                      : (layers.rasterResolution || 6) <= 8
                      ? "均衡性能"
                      : "流畅运行"}
                  </span>
                  <span>标清 (32px)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- F. INTEGRATED INFORMATION PANEL --- */}
        {activeTab === "info" && (
          <div className="space-y-4 fade-in" id="panel-info">
            {/* 拟物解压音效设置 */}
            <div className="space-y-2">
              <h2 className="text-[11px] font-bold text-[#1E9CFF] tracking-wider uppercase">拟物解压音效设置</h2>
              <div className="bg-slate-900 rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-300">开启点击解压音效</span>
                  <input
                    type="checkbox"
                    checked={config.soundEnabled}
                    onChange={(e) => onConfigChange({ soundEnabled: e.target.checked })}
                    className="w-4 h-4 text-[#1E9CFF] accent-[#1E9CFF]"
                  />
                </div>

                {config.soundEnabled && (
                  <>
                    <div className="space-y-1.5 pt-1 border-t border-slate-800">
                      <span className="text-[11px] text-slate-400 block">选择音效反馈类型</span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onConfigChange({ soundMode: "mahjong" });
                            playSndClick(config.soundVolume, true, "mahjong");
                          }}
                          className={`py-1.5 px-2 rounded text-[11px] font-semibold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                            config.soundMode === "mahjong"
                              ? "bg-amber-500/20 border-amber-500 text-amber-300"
                              : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                          }`}
                        >
                          🀄 麻将音 (骨质碰撞)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onConfigChange({ soundMode: "mouse" });
                            playSndClick(config.soundVolume, true, "mouse");
                          }}
                          className={`py-1.5 px-2 rounded text-[11px] font-semibold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                            config.soundMode !== "mahjong"
                              ? "bg-sky-500/20 border-sky-500 text-sky-300"
                              : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                          }`}
                        >
                          🖱️ 鼠标点击音 (微动脆响)
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>音效声量</span>
                        <span className="font-mono">{Math.round(config.soundVolume * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.1}
                        value={config.soundVolume}
                        onChange={(e) => onConfigChange({ soundVolume: parseFloat(e.target.value) })}
                        className="w-full h-1 bg-slate-950 rounded-lg appearance-none accent-[#1E9CFF]"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 页面显示设置 */}
            <div className="space-y-4">
              <h2 className="text-[11px] font-bold text-[#1E9CFF] tracking-wider uppercase">页面显示设置</h2>
              <div className="bg-slate-900 rounded-lg p-3 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-300">全局 UI 风格</span>
                  <select
                    className="bg-slate-950 text-slate-300 border border-slate-700 rounded px-2 py-1 text-xs"
                    value={config.uiStyle || "default"}
                    onChange={(e) => onConfigChange({ uiStyle: e.target.value as any })}
                  >
                    <option value="default">默认风格</option>
                    <option value="professional">专业风格</option>
                    <option value="ios">iOS 拟物玻璃风格</option>
                    <option value="light">高雅浅色风格</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-300">气象站点显隐</span>
                  <input type="checkbox" checked={layers.weatherStations || false} onChange={(e) => onLayersChange({ weatherStations: e.target.checked })} className="w-4 h-4 text-[#1E9CFF] accent-[#1E9CFF]" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-300">气象站点城市名称</span>
                  <input type="checkbox" checked={config.stationLabels || false} onChange={(e) => onConfigChange({ stationLabels: e.target.checked })} className="w-4 h-4 text-[#1E9CFF] accent-[#1E9CFF]" />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>城市密度</span>
                    <span>{config.cityDensity !== undefined ? config.cityDensity : 50}%</span>
                  </div>
                  <input type="range" min="5" max="100" step="5" value={config.cityDensity !== undefined ? config.cityDensity : 50} onChange={(e) => onConfigChange({ cityDensity: Number(e.target.value) })} className="w-full h-1 bg-slate-950 rounded-lg appearance-none accent-[#1E9CFF]" />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>胶囊尺寸</span>
                    <span>{config.capsuleSize !== undefined ? config.capsuleSize : 100}%</span>
                  </div>
                  <input type="range" min="50" max="200" step="10" value={config.capsuleSize !== undefined ? config.capsuleSize : 100} onChange={(e) => onConfigChange({ capsuleSize: Number(e.target.value) })} className="w-full h-1 bg-slate-950 rounded-lg appearance-none accent-[#1E9CFF]" />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-300">顶部信息栏</span>
                  <input type="checkbox" checked={config.showTopBar !== false} onChange={(e) => onConfigChange({ showTopBar: e.target.checked })} className="w-4 h-4 text-[#1E9CFF] accent-[#1E9CFF]" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-300">光标参数面板</span>
                  <input type="checkbox" checked={layers.cursor !== false} onChange={(e) => onLayersChange({ cursor: e.target.checked })} className="w-4 h-4 text-[#1E9CFF] accent-[#1E9CFF]" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-300">独立台风中心点</span>
                  <input type="checkbox" checked={layers.showCenterPoint !== false} onChange={(e) => onLayersChange({ showCenterPoint: e.target.checked })} className="w-4 h-4 text-[#1E9CFF] accent-[#1E9CFF]" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-300">路径点</span>
                  <input type="checkbox" checked={layers.track !== false} onChange={(e) => onLayersChange({ track: e.target.checked })} className="w-4 h-4 text-[#1E9CFF] accent-[#1E9CFF]" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-300">风圈</span>
                  <input type="checkbox" checked={layers.windRadii !== false} onChange={(e) => onLayersChange({ windRadii: e.target.checked })} className="w-4 h-4 text-[#1E9CFF] accent-[#1E9CFF]" />
                </div>
              </div>
              
              <div className="bg-slate-900 rounded-lg p-3 space-y-3 mt-4">
                <h3 className="text-[11px] font-semibold text-slate-300">图例颜色自定义</h3>
                {[
                  { cat: TyphoonCategory.TD, label: "热带低压 TD", default: "#F9D332" },
                  { cat: TyphoonCategory.TS, label: "热带风暴 TS", default: "#2056C6" },
                  { cat: TyphoonCategory.STS, label: "强热带风暴 STS", default: "#1F8838" },
                  { cat: TyphoonCategory.TY, label: "台风 TY", default: "#F07920" },
                  { cat: TyphoonCategory.STY, label: "强台风 STY", default: "#D829BC" },
                  { cat: TyphoonCategory.SuperTY, label: "超强台风 SuperTY", default: "#D62020" },
                  { cat: TyphoonCategory.ET, label: "温带气旋 ET", default: "#949297" },
                ].map(item => (
                  <div key={item.cat} className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">{item.label}</span>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={config.categoryColors?.[item.cat] || item.default}
                        onChange={(e) => {
                          onConfigChange({
                            categoryColors: {
                              ...(config.categoryColors || {}),
                              [item.cat]: e.target.value
                            }
                          });
                        }}
                        className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0"
                      />
                      <input
                        type="text"
                        value={config.categoryColors?.[item.cat] || item.default}
                        onChange={(e) => {
                          onConfigChange({
                            categoryColors: {
                              ...(config.categoryColors || {}),
                              [item.cat]: e.target.value
                            }
                          });
                        }}
                        className="w-16 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-slate-300 uppercase"
                      />
                    </div>
                  </div>
                ))}
                <div className="pt-2">
                   <button onClick={() => onConfigChange({ categoryColors: {} })} className="w-full py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition cursor-pointer">恢复默认颜色</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "news" && (
          <div className="space-y-4 fade-in">
            <h2 className="text-[13px] font-semibold text-slate-200">气象快报</h2>
            <div className="bg-slate-900 rounded-lg p-3 space-y-2 max-h-[300px] overflow-y-auto">
              {eventLogs.length === 0 && <div className="text-xs text-slate-500 text-center py-4">暂无快报</div>}
              {eventLogs.map((log) => (
                <div key={log.id} className="border-b border-slate-800 pb-2 mb-2 last:border-0">
                  <div className="text-[10px] text-slate-500 mb-1">模拟第 {log.simHour} 小时</div>
                  <div className="text-[11px] text-slate-300">{log.message}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "export" && (
          <div className="space-y-4" id="panel-export">
            <div className="bg-slate-900/30 p-3 rounded-xl border border-slate-800/40 space-y-3">
              <h3 className="text-xs font-bold text-[#1E9CFF] tracking-wider mb-1">地理与文本导出</h3>

              <button
                id="btn-export-geojson"
                onClick={exportGeoJSON}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition"
              >
                <Download className="w-4 h-4 text-[#1E9CFF]" />
                <span>导出 GeoJSON (全航线与风圈)</span>
              </button>

              <button
                id="btn-export-csv"
                onClick={exportCSV}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition"
              >
                <Download className="w-4 h-4 text-[#45D483]" />
                <span>导出 3小时节点轨迹 CSV</span>
              </button>

              <button
                id="btn-export-json-config"
                onClick={copyCurrentConfig}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition"
              >
                <Settings className="w-4 h-4 text-orange-400" />
                <span>复制模拟器设置参数 JSON</span>
              </button>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-900 text-[10px] text-slate-500 leading-normal space-y-1.5">
              <div><strong>支持气象GIS软件：</strong></div>
              <div>GeoJSON 格式能够完美导入 ArcGIS, QGIS, 以及 Leaflet/Openlayers 做二次开发和渲染。</div>
              <div>CSV 包含每3小时的经纬度、最低气压、七级/十级风圈四象限等完整时空结构。</div>
            </div>
          </div>
        )}
      </div>

      {/* Embedded Parameters Explanations Alert Tooltip */}
      {activeTooltip && (
        <div className="absolute inset-0 z-[2000] bg-slate-950/90 flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-[#08121f] border border-slate-700/60 rounded-2xl p-4 max-w-sm w-full shadow-2xl relative">
            <h4 className="text-[#1E9CFF] font-bold text-sm mb-2 font-sans flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-[#1E9CFF]" />
              {activeTooltip.title}
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed mb-4">{activeTooltip.content}</p>
            <button
              id="btn-close-tooltip"
              onClick={() => setActiveTooltip(null)}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-xs font-semibold cursor-pointer text-slate-200 transition"
            >
              我知道了
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
