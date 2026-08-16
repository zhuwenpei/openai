/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Wind, Compass, MapPin, Thermometer, ShieldAlert, Waves } from "lucide-react";
import { Typhoon, TyphoonCategory, SimulationConfig } from "../types";
import { getCategoryColor, getWindForceCategory } from "../simulation/Engine";

interface CardProps {
  typhoon: Typhoon | null;
  config: SimulationConfig;
  onShowReport?: () => void;
  isPlaying?: boolean;
  isReplay?: boolean;
  currentHour?: number;
  maxHour?: number;
}

export default function TyphoonStatusCard({ typhoon, config, onShowReport, isPlaying, isReplay, currentHour, maxHour }: CardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isPortrait, setIsPortrait] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerHeight > window.innerWidth;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!typhoon) {
    return (
      <div 
        id="typhoon-status-card-empty"
        className="fixed top-4 left-4 z-[1000] w-[320px] rounded-2xl bg-[#08121f]/95 border border-slate-800/80 p-4 shadow-xl backdrop-blur-md"
      >
        <div className="flex items-center space-x-3 text-slate-400">
          <Wind className="w-6 h-6 animate-pulse" />
          <span className="text-sm">未生成主台风，请在控制面板中生成。</span>
        </div>
      </div>
    );
  }

  const showReportBtn = typhoon.dissipated || (!isPlaying && maxHour !== undefined && maxHour > 0 && currentHour === maxHour);

  if (showReportBtn) {
    return (
      <div 
        id="compact-report-bar"
        className="fixed top-2.5 left-1/2 -translate-x-1/2 z-[1000] flex items-center justify-center pointer-events-auto"
      >
        <button
          onClick={onShowReport}
          className="px-4 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white border border-orange-500/30 rounded-full text-xs font-bold transition-all cursor-pointer shadow-lg active:scale-95 duration-150"
        >
          查看台风报告
        </button>
      </div>
    );
  }

  const color = getCategoryColor(typhoon.category, config);
  const force = getWindForceCategory(typhoon.vmax);

  // Status Indicator Dot class
  const getStatusDot = () => {
    if (typhoon.dissipated) return "bg-slate-500 shadow-[0_0_8px_#8c9ba5]";
    if (typhoon.landed) return "bg-red-500 shadow-[0_0_8px_#FF4D4F] animate-ping";
    if (typhoon.category === TyphoonCategory.ET) return "bg-slate-400 shadow-[0_0_8px_#7E7E7E]";
    if (typhoon.ewrcState !== "none") return "bg-[#FF8C3A] shadow-[0_0_8px_#FF8C3A] animate-pulse";
    return "bg-emerald-500 shadow-[0_0_8px_#45D483] animate-pulse";
  };

  const getStatusText = () => {
    if (typhoon.dissipated) return "已消散";
    if (typhoon.isStructureDamaged) return "中心结构修复中";
    if (typhoon.landed) return "已登陆";
    if (typhoon.category === TyphoonCategory.ET) return "温带化变性中";
    if (typhoon.ewrcState !== "none") return "置换中";
    if (isReplay && !isPlaying) return "历史回放中";
    return isPlaying ? "实时模拟中" : "模拟已暂停";
  };

  // 1. Portrait compact view
  if (isPortrait) {
    return (
      <div
        id={`typhoon-card-portrait-${typhoon.id}`}
        className="fixed top-4 left-4 right-16 z-[1000] rounded-2xl bg-[#08121f]/94 border border-slate-700/40 p-3 shadow-xl backdrop-blur-md text-white select-none transition-all duration-200"
      >
        {/* Compact Bar showing only: pressure, wind speed (value + category) and speed */}
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {/* Wind Speed (value and category in one line) */}
            <div className="flex items-center space-x-1">
              <span className="text-slate-400">风速:</span>
              <span className="font-bold text-blue-400">{typhoon.vmax.toFixed(1)} m/s ({force}级)</span>
            </div>
            
            {/* Central Pressure */}
            <div className="flex items-center space-x-1 border-l border-slate-800 pl-3">
              <span className="text-slate-400">气压:</span>
              <span className="font-bold text-teal-400">{typhoon.pmin} hPa</span>
            </div>

            {/* Movement Speed */}
            <div className="flex items-center space-x-1 border-l border-slate-800 pl-3">
              <span className="text-slate-400">移动:</span>
              <span className="font-bold text-slate-200">{typhoon.speed} km/h</span>
            </div>
          </div>

          {/* Right side container with vertically stacked status and button */}
          <div className="flex flex-col items-end justify-center shrink-0 ml-2 select-none">
            {!expanded && (
              <span className="text-[10px] font-bold text-indigo-400 mb-1 leading-none">
                {getStatusText()}
              </span>
            )}
            <button
              id="btn-portrait-expand"
              onClick={() => setExpanded(!expanded)}
              className="flex items-center space-x-1 bg-slate-900 hover:bg-slate-800 border border-slate-800/80 px-2 py-0.5 rounded text-[10px] text-slate-300 transition cursor-pointer leading-none"
            >
              <span>{expanded ? "收起" : "展开"}</span>
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Expanded details container */}
        {expanded && (
          <div id="typhoon-expanded-details" className="mt-3 bg-slate-950/40 border border-slate-900 p-3 rounded-xl space-y-2.5 text-[11px] animate-[slideDown_0.2s_ease-out] overflow-y-auto max-h-[220px] scrollbar-thin">
            {/* Name */}
            <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Wind className="w-3.5 h-3.5 text-slate-500 animate-spin" style={{ animationDuration: typhoon.dissipated ? "12s" : `${Math.max(1, 8 - typhoon.vmax/8)}s` }} />
                台风名称
              </span>
              <span className="font-bold text-slate-100">{typhoon.name}</span>
            </div>

            {/* Status */}
            <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className={`w-2 h-2 rounded-full ${getStatusDot()}`}></span>
                当前状态
              </span>
              <span className="font-mono text-slate-100" style={{ color }}>
                {getStatusText()} ({typhoon.category})
              </span>
            </div>

            <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center gap-1.5 text-slate-400">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                中心位置
              </span>
              <span className="font-mono text-slate-100">
                {typhoon.lat.toFixed(2)}°N, {typhoon.lon.toFixed(2)}°E
              </span>
            </div>

            <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Compass className="w-3.5 h-3.5 text-slate-500" />
                移动方向
              </span>
              <span className="font-mono text-slate-100">
                {typhoon.direction}° (西北偏北)
              </span>
            </div>

          <div className="flex justify-between items-center text-slate-300">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-3.5 h-3.5 text-slate-500 font-bold flex items-center justify-center">⚠</span>
              总伤亡人数估算
            </span>
            <span className="font-mono text-rose-400 font-bold">
              {Math.floor(typhoon.casualties || 0).toLocaleString()} <span className="text-[9px] text-slate-500 font-normal ml-1">估算值</span>
            </span>
          </div>


             <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center gap-1.5 text-slate-400">
                <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
                垂直风切变 (VWS)
              </span>
              <span className="font-mono text-slate-100">
                {Math.max(2, Math.round(5 + typhoon.lat * 0.4))} m/s
              </span>
            </div>

            <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Waves className="w-3.5 h-3.5 text-slate-500" />
                最大风速半径 (RMW)
              </span>
              <span className="font-mono text-slate-100">
                {Math.round(typhoon.rmw)} km
              </span>
            </div>

            {/* Wind Radii Table */}
            <div className="border-t border-slate-900 pt-2 mt-1">
              <div className="text-[10px] text-slate-400 font-medium mb-1">七级风圈半径 (东北/东南/西南/西北)</div>
              <div className="grid grid-cols-4 gap-1 text-center font-mono text-[10px] text-slate-300 bg-slate-950/60 py-1 rounded">
                <div>{typhoon.r7.ne} <span className="text-[8px] text-slate-500">km</span></div>
                <div>{typhoon.r7.se} <span className="text-[8px] text-slate-500">km</span></div>
                <div>{typhoon.r7.sw} <span className="text-[8px] text-slate-500">km</span></div>
                <div>{typhoon.r7.nw} <span className="text-[8px] text-slate-500">km</span></div>
              </div>
            </div>

            {typhoon.vmax >= 24.5 && (
              <div>
                <div className="text-[10px] text-slate-400 font-medium mb-1">十级风圈半径 (东北/东南/西南/西北)</div>
                <div className="grid grid-cols-4 gap-1 text-center font-mono text-[10px] text-slate-300 bg-slate-950/60 py-1 rounded">
                  <div>{typhoon.r10.ne} <span className="text-[8px] text-slate-500">km</span></div>
                  <div>{typhoon.r10.se} <span className="text-[8px] text-slate-500">km</span></div>
                  <div>{typhoon.r10.sw} <span className="text-[8px] text-slate-500">km</span></div>
                  <div>{typhoon.r10.nw} <span className="text-[8px] text-slate-500">km</span></div>
                </div>
              </div>
            )}

            {typhoon.ewrcState !== "none" && (
              <div className="bg-[#FF8C3A]/10 border border-[#FF8C3A]/30 p-2 rounded-lg text-[#FF8C3A]">
                <strong>眼墙置换进行中 ({Math.round(typhoon.ewrcProgress * 100)}%)</strong>
              </div>
            )}

            {typhoon.rapidIntensifying && (
              <div className="bg-red-500/10 border border-red-500/30 p-2 rounded-lg text-red-400 animate-pulse">
                <strong>处于爆发性增强状态</strong>
              </div>
            )}
          </div>
        )}

        {showReportBtn && onShowReport && (
          <button
            onClick={onShowReport}
            className="w-full mt-2 py-2 flex items-center justify-center space-x-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg text-[11px] font-bold transition cursor-pointer shadow-md"
          >
            <span>查看台风报告</span>
          </button>
        )}
      </div>
    );
  }

  // 1. Collapsed compact view
  if (isCollapsed) {
    return (
      <div
        id={`typhoon-card-collapsed-${typhoon.id}`}
        className="fixed top-4 left-4 z-[1000] rounded-xl bg-[#08121f]/94 border border-slate-700/40 p-2.5 shadow-xl backdrop-blur-md text-white select-none transition-all duration-200 flex items-center space-x-3 text-xs"
      >
        {/* Typhoon status badge */}
        <div className="flex items-center space-x-1.5 bg-slate-900/60 px-2 py-0.5 rounded-full border border-slate-800">
          <span className={`w-2 h-2 rounded-full ${getStatusDot()}`}></span>
          <span className="text-[10px] text-slate-300 font-semibold" style={{ color }}>{typhoon.category}</span>
          <span className="text-[10px] text-slate-400 font-normal">({getStatusText()})</span>
        </div>

        {/* Wind Speed */}
        <div className="font-mono text-slate-300">
          <span className="text-[9px] text-slate-500 mr-1">风速:</span>
          <span className="font-bold text-blue-400">{typhoon.vmax.toFixed(1)} m/s</span>
        </div>

        {/* Central Pressure */}
        <div className="font-mono text-slate-300 border-l border-slate-800/80 pl-3">
          <span className="text-[9px] text-slate-500 mr-1">气压:</span>
          <span className="font-bold text-teal-400">{typhoon.pmin} hPa</span>
        </div>

        {/* Expand button (no title here) */}
        <button
          id="btn-expand-status-card"
          onClick={() => setIsCollapsed(false)}
          className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          title="展开面板"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // 2. Normal full view
  return (
    <div
      id={`typhoon-card-${typhoon.id}`}
      className="fixed top-4 left-4 z-[1000] w-[320px] sm:w-[350px] md:w-[380px] max-w-[420px] rounded-2xl bg-[#08121f]/94 border border-slate-700/40 p-4 shadow-2xl backdrop-blur-md text-white select-none transition-all duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-lg bg-[#1E9CFF]/10 text-[#1E9CFF]">
            <Wind className="w-5 h-5 animate-spin" style={{ animationDuration: typhoon.dissipated ? "12s" : `${Math.max(1, 8 - typhoon.vmax/8)}s` }} />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-wide font-sans flex items-center gap-1.5">
              台风模拟器
            </h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">Northwest Pacific Basin</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2 bg-slate-900/60 px-2.5 py-1 rounded-full border border-slate-800">
            <span className={`w-2 h-2 rounded-full ${getStatusDot()}`}></span>
            <span className="text-[11px] text-slate-300 font-medium">{getStatusText()}</span>
          </div>
          <button
            id="btn-collapse-status-card"
            onClick={() => setIsCollapsed(true)}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition cursor-pointer"
            title="收起面板"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Basic Metrics Rows */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-slate-900/40 border border-slate-800/40 p-2.5 rounded-xl">
          <div className="text-[10px] text-slate-400 mb-0.5">主台风名称</div>
          <div className="text-base font-bold text-slate-100 flex items-baseline gap-1.5 font-sans">
            {typhoon.name}
            <span className="text-[10px] font-mono font-normal text-slate-400">SIM-001</span>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800/40 p-2.5 rounded-xl">
          <div className="text-[10px] text-slate-400 mb-0.5">风力等级 & 强度</div>
          <div className="text-sm font-bold flex items-center space-x-1.5" style={{ color }}>
            <span>{typhoon.category}</span>
            <span className="text-slate-300 font-mono text-xs">({force}级)</span>
          </div>
        </div>
      </div>

      {/* Secondary Quick Metrics bar */}
      <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-800/40 mb-3 text-center">
        <div>
          <div className="text-[9px] text-slate-500 uppercase tracking-wider">最大风速</div>
          <div className="text-xs font-semibold font-mono text-slate-200 mt-0.5">{typhoon.vmax.toFixed(1)} m/s</div>
        </div>
        <div>
          <div className="text-[9px] text-slate-500 uppercase tracking-wider">中心气压</div>
          <div className="text-xs font-semibold font-mono text-slate-200 mt-0.5">{typhoon.pmin} hPa</div>
        </div>
        <div>
          <div className="text-[9px] text-slate-500 uppercase tracking-wider">移动速度</div>
          <div className="text-xs font-semibold font-mono text-slate-200 mt-0.5">{typhoon.speed} km/h</div>
        </div>
      </div>

      {/* Action Button: Toggle Details */}
      <button
        id="btn-toggle-details"
        onClick={() => setExpanded(!expanded)}
        className="w-full py-1.5 flex items-center justify-center space-x-1 bg-slate-900 hover:bg-slate-800 active:bg-slate-950/80 border border-slate-800/80 rounded-xl text-xs text-slate-300 hover:text-white transition cursor-pointer"
      >
        <span>{expanded ? "收起详细参数" : "展开"}</span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {/* Expanded details container */}
      {expanded && (
        <div id="typhoon-expanded-details" className="mt-3 bg-slate-950/40 border border-slate-900 p-3 rounded-xl space-y-2.5 text-[11px] animate-[slideDown_0.2s_ease-out] overflow-y-auto max-h-[190px] scrollbar-thin">
          <div className="flex justify-between items-center text-slate-300">
            <span className="flex items-center gap-1.5 text-slate-400">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              中心位置
            </span>
            <span className="font-mono text-slate-100">
              {typhoon.lat.toFixed(2)}°N, {typhoon.lon.toFixed(2)}°E
            </span>
          </div>

          <div className="flex justify-between items-center text-slate-300">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Compass className="w-3.5 h-3.5 text-slate-500" />
              移动方向
            </span>
            <span className="font-mono text-slate-100">
              {typhoon.direction}° (西北偏北)
            </span>
          </div>

           <div className="flex justify-between items-center text-slate-300">
            <span className="flex items-center gap-1.5 text-slate-400">
              <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
              垂直风切变 (VWS)
            </span>
            <span className="font-mono text-slate-100">
              {Math.max(2, Math.round(5 + typhoon.lat * 0.4))} m/s (中等)
            </span>
          </div>

          <div className="flex justify-between items-center text-slate-300">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-3.5 h-3.5 text-slate-500 font-bold flex items-center justify-center">⚠</span>
              总伤亡人数估算
            </span>
            <span className="font-mono text-rose-400 font-bold">
              {Math.floor(typhoon.casualties || 0).toLocaleString()} <span className="text-[9px] text-slate-500 font-normal ml-1">估算值</span>
            </span>
          </div>


          <div className="flex justify-between items-center text-slate-300">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Waves className="w-3.5 h-3.5 text-slate-500" />
              最大风速半径 (RMW)
            </span>
            <span className="font-mono text-slate-100">
              {Math.round(typhoon.rmw)} km
            </span>
          </div>

          {/* Wind Radii Table */}
          <div className="border-t border-slate-900 pt-2 mt-1">
            <div className="text-[10px] text-slate-400 font-medium mb-1">七级风圈半径 (东北/东南/西南/西北)</div>
            <div className="grid grid-cols-4 gap-1 text-center font-mono text-[10px] text-slate-300 bg-slate-950/60 py-1 rounded">
              <div>{typhoon.r7.ne} <span className="text-[8px] text-slate-500">km</span></div>
              <div>{typhoon.r7.se} <span className="text-[8px] text-slate-500">km</span></div>
              <div>{typhoon.r7.sw} <span className="text-[8px] text-slate-500">km</span></div>
              <div>{typhoon.r7.nw} <span className="text-[8px] text-slate-500">km</span></div>
            </div>
          </div>

          {typhoon.vmax >= 24.5 && (
            <div>
              <div className="text-[10px] text-slate-400 font-medium mb-1">十级风圈半径 (东北/东南/西南/西北)</div>
              <div className="grid grid-cols-4 gap-1 text-center font-mono text-[10px] text-slate-300 bg-slate-950/60 py-1 rounded">
                <div>{typhoon.r10.ne} <span className="text-[8px] text-slate-500">km</span></div>
                <div>{typhoon.r10.se} <span className="text-[8px] text-slate-500">km</span></div>
                <div>{typhoon.r10.sw} <span className="text-[8px] text-slate-500">km</span></div>
                <div>{typhoon.r10.nw} <span className="text-[8px] text-slate-500">km</span></div>
              </div>
            </div>
          )}

          {typhoon.ewrcState !== "none" && (
            <div className="bg-[#FF8C3A]/10 border border-[#FF8C3A]/30 p-2 rounded-lg text-[#FF8C3A]">
              <strong>眼墙置换进行中 ({Math.round(typhoon.ewrcProgress * 100)}%)</strong>
              <div className="text-[10px] text-slate-400 mt-0.5">次级风眼正在吞噬内侧风眼，强度略微走低</div>
            </div>
          )}

          {typhoon.rapidIntensifying && (
            <div className="bg-red-500/10 border border-red-500/30 p-2 rounded-lg text-red-400 animate-pulse">
              <strong>处于爆发性增强状态</strong>
              <div className="text-[10px] text-slate-400 mt-0.5">台风正在摄入巨量海表能量，风眼极速开洞</div>
            </div>
          )}
        </div>
      )}

      {showReportBtn && onShowReport && (
        <button
          onClick={onShowReport}
          className="w-full mt-3 py-2 flex items-center justify-center space-x-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-lg animate-pulse"
        >
          <span>查看台风报告</span>
        </button>
      )}
    </div>
  );
}
