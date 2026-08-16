/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { Play, Pause, SkipBack, SkipForward, RotateCcw, ChevronUp, ChevronDown, Calendar } from "lucide-react";

interface TimelineProps {
  currentHour: number;
  maxHour: number;
  isPlaying: boolean;
  onPlayToggle: () => void;
  onManualDissipate?: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  onReset: () => void;
  onSeek: (hour: number) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  startDate: Date;
  onStartDateChange?: (newDate: Date) => void;
  collapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
}

const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 4, 8, 16, 32];

export default function Timeline({
  currentHour,
  maxHour,
  isPlaying,
  onPlayToggle,
  onManualDissipate,
  onStepForward,
  onStepBackward,
  onReset,
  onSeek,
  speed,
  onSpeedChange,
  startDate,
  onStartDateChange,
  collapsed,
  onCollapseChange
}: TimelineProps) {
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const isCollapsed = collapsed !== undefined ? collapsed : localCollapsed;
  const setIsCollapsed = (val: boolean) => {
    if (onCollapseChange) {
      onCollapseChange(val);
    } else {
      setLocalCollapsed(val);
    }
  };

  const [showDatePicker, setShowDatePicker] = useState(false);
  const clickTimeoutRef = useRef<any>(null);

  const handlePlayPauseClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      onManualDissipate?.();
    } else {
      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = null;
        onPlayToggle();
      }, 250);
    }
  };

  // Format current simulation date based on elapsed hours
  const getSimulatedDateString = (elapsedHours: number) => {
    const timeMs = startDate.getTime() + elapsedHours * 60 * 60 * 1000;
    const currentSimTime = new Date(timeMs);
    const mm = String(currentSimTime.getMonth() + 1).padStart(2, "0");
    const dd = String(currentSimTime.getDate()).padStart(2, "0");
    const hh = String(currentSimTime.getHours()).padStart(2, "0");
    return `${currentSimTime.getFullYear()}-${mm}-${dd} ${hh}:00`;
  };

  const formatForDateTimeInput = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:00`;
  };

  if (isCollapsed) {
    return (
      <div
        id="simulation-timeline-collapsed"
        className="fixed bottom-4 left-4 z-[1000] rounded-xl bg-[#08121f]/94 border border-slate-700/40 p-2 shadow-xl backdrop-blur-md text-white select-none transition-all duration-200 flex items-center space-x-3 text-xs"
        style={{
          marginLeft: "env(safe-area-inset-left, 16px)",
          marginBottom: "env(safe-area-inset-bottom, 16px)"
        }}
      >
        {/* Play Pause Button */}
        <button
          id="btn-play-pause-collapsed"
          onClick={onPlayToggle}
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onManualDissipate?.();
          }}
          className={`p-1.5 rounded-lg border transition cursor-pointer ${
            isPlaying
              ? "bg-[#1E9CFF]/15 border-[#1E9CFF]/50 text-[#1E9CFF] hover:bg-[#1E9CFF]/25"
              : "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200"
          }`}
          title={isPlaying ? "单击暂停 (双击手动停编)" : "单击启动 (双击手动停编)"}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
        </button>

        {/* Current Date/Time without title */}
        <div className="font-mono text-slate-300">
          <span className="font-bold text-[#1E9CFF]">{getSimulatedDateString(currentHour)}</span>
          <span className="text-slate-500 ml-2">({currentHour}h)</span>
        </div>

        {/* Expand Button */}
        <button
          id="btn-expand-timeline"
          onClick={() => setIsCollapsed(false)}
          className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer border border-transparent hover:border-slate-800"
          title="展开时间面板"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      id="simulation-timeline"
      className="fixed bottom-4 left-4 right-4 md:left-[16px] md:right-auto md:w-[62%] lg:w-[50%] xl:w-[45%] z-[1000] rounded-2xl bg-[#08121f]/94 border border-slate-700/40 p-3 sm:p-4 shadow-2xl backdrop-blur-md text-white select-none transition-all duration-200 flex flex-col md:flex-row items-stretch md:items-center gap-3"
      style={{
        marginLeft: "env(safe-area-inset-left, 16px)",
        marginBottom: "env(safe-area-inset-bottom, 16px)"
      }}
    >
      {/* 1. Date details / clock */}
      <div className="flex flex-col justify-center min-w-[145px] border-r border-slate-800/80 pr-3 relative">
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-slate-500 uppercase tracking-widest">模拟时间 (UTC+8)</span>
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="p-0.5 rounded text-slate-400 hover:text-[#1E9CFF] transition cursor-pointer"
            title="自定义台风生成/模拟起算日期"
          >
            <Calendar className="w-3 h-3" />
          </button>
        </div>

        {showDatePicker ? (
          <input
            type="datetime-local"
            value={formatForDateTimeInput(startDate)}
            onChange={(e) => {
              if (e.target.value) {
                const d = new Date(e.target.value);
                if (!isNaN(d.getTime())) {
                  onStartDateChange?.(d);
                }
              }
              setShowDatePicker(false);
            }}
            onBlur={() => setShowDatePicker(false)}
            autoFocus
            className="text-xs font-mono bg-slate-900 border border-[#1E9CFF]/60 text-[#1E9CFF] rounded px-1 py-0.5 mt-0.5 focus:outline-none"
          />
        ) : (
          <button
            onClick={() => setShowDatePicker(true)}
            className="text-left group text-sm font-bold font-mono text-[#1E9CFF] mt-0.5 whitespace-nowrap hover:underline flex items-center gap-1 cursor-pointer"
            title="点击修改台风生成日期"
          >
            {getSimulatedDateString(currentHour)}
          </button>
        )}

        <span className="text-[10px] text-slate-400 mt-0.5">
          累计时长: <strong className="font-mono">{maxHour}</strong> 小时
        </span>
      </div>

      {/* 2. Interactive Seeker & Ticks */}
      <div className="flex-1 flex flex-col justify-center px-1">
        <div className="relative flex items-center mb-1">
          <input
            id="timeline-slider"
            type="range"
            min={0}
            max={Math.max(1, maxHour)}
            value={currentHour}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-[#1E9CFF] focus:outline-none"
            style={{
              background: `linear-gradient(to right, #1E9CFF ${
                (currentHour / Math.max(1, maxHour)) * 100
              }%, #0f1c2d ${(currentHour / Math.max(1, maxHour)) * 100}%)`
            }}
          />
        </div>

        {/* Hour markers/ticks */}
        <div className="flex justify-between text-[8px] text-slate-500 font-mono px-0.5">
          <span>0h</span>
          <span>12h</span>
          <span>24h</span>
          <span>36h</span>
          <span>48h</span>
          <span>60h</span>
          <span>{Math.max(72, maxHour)}h</span>
        </div>
      </div>

      {/* 3. Transport Controls */}
      <div className="flex items-center justify-between sm:justify-start gap-2 border-t md:border-t-0 md:border-l border-slate-800/80 pt-2.5 md:pt-0 md:pl-3">
        <div className="flex items-center gap-1.5">
          <button
            id="btn-step-backward"
            onClick={onStepBackward}
            disabled={currentHour === 0}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700 disabled:opacity-20 disabled:hover:bg-transparent transition cursor-pointer"
            title="切换到上一个时间点"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          <button
            id="btn-play-pause"
            onClick={handlePlayPauseClick}
            className={`p-2 rounded-xl border transition cursor-pointer ${
              isPlaying
                ? "bg-[#1E9CFF]/15 border-[#1E9CFF]/50 text-[#1E9CFF] hover:bg-[#1E9CFF]/25 animate-pulse"
                : "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200"
            }`}
            title={isPlaying ? "单击暂停 (双击手动停编)" : "单击启动 (双击手动停编)"}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
          </button>

          <button
            id="btn-step-forward"
            onClick={onStepForward}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700 transition cursor-pointer"
            title="切换到下一个时间点"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          <button
            id="btn-reset-simulation"
            onClick={onReset}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-red-400 border border-slate-800 hover:border-red-900/30 transition cursor-pointer"
            title="重置模拟"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Speed Selector */}
        <div className="flex items-center gap-1 bg-slate-900/80 border border-slate-800 rounded-lg p-0.5">
          <select
            id="playback-speed-select"
            value={speed}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
            className="bg-transparent text-[10px] font-mono text-slate-300 font-semibold focus:outline-none px-1.5 py-1 cursor-pointer"
            title="播放倍速"
          >
            {PLAYBACK_SPEEDS.map((sp) => (
              <option key={sp} value={sp} className="bg-[#08121f] text-slate-300 text-xs">
                {sp}x
              </option>
            ))}
          </select>
        </div>

        {/* Collapse Button */}
        <button
          id="btn-collapse-timeline"
          onClick={() => setIsCollapsed(true)}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700 transition cursor-pointer ml-1"
          title="收起时间面板"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
