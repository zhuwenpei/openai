/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { X, Calendar, Wind, ShieldAlert, Compass, Filter } from "lucide-react";
import { HistoricalTyphoonData, HISTORICAL_TYPHOONS } from "../data/historicalTyphoons";

interface HistoricalTyphoonDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTyphoon: (typhoon: HistoricalTyphoonData) => void;
}

export default function HistoricalTyphoonDialog({
  isOpen,
  onClose,
  onSelectTyphoon
}: HistoricalTyphoonDialogProps) {
  const [selectedYear, setSelectedYear] = useState<string>("ALL");

  const availableYears = useMemo(() => {
    const years = Array.from(new Set(HISTORICAL_TYPHOONS.map((t) => t.year)));
    years.sort((a, b) => b - a);
    return years;
  }, []);

  const filteredTyphoons = useMemo(() => {
    if (selectedYear === "ALL") return HISTORICAL_TYPHOONS;
    const yNum = parseInt(selectedYear, 10);
    return HISTORICAL_TYPHOONS.filter((t) => t.year === yNum);
  }, [selectedYear]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1050] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-3xl rounded-2xl bg-[#0c1626]/98 border border-slate-700/80 p-6 shadow-2xl backdrop-blur-xl text-white select-none transition-all duration-300 max-h-[88vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                2000年至今历史经典台风库
                <span className="text-xs font-normal text-blue-400 bg-cyan-950/60 px-2 py-0.5 rounded-full border border-blue-500/30">
                  每3小时精准打点
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">列出2000-2025年每年代表性台风，导入真实路径与风场，支持任意节点切换与分支模拟</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Year Filter Bar */}
        <div className="my-3 flex items-center justify-between gap-3 bg-slate-900/60 p-2 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-300 font-bold shrink-0">
            <Filter className="w-4 h-4 text-blue-400" />
            <span>选择年份:</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin scrollbar-thumb-slate-800 w-full">
            <button
              onClick={() => setSelectedYear("ALL")}
              className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
                selectedYear === "ALL"
                  ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/30"
                  : "bg-slate-800/80 text-slate-300 hover:bg-slate-700/80"
              }`}
            >
              全部 (2000-2025)
            </button>
            {availableYears.map((y) => (
              <button
                key={y}
                onClick={() => setSelectedYear(y.toString())}
                className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
                  selectedYear === y.toString()
                    ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/30"
                    : "bg-slate-800/80 text-slate-300 hover:bg-slate-700/80"
                }`}
              >
                {y}年
              </button>
            ))}
          </div>
        </div>

        {/* Info Box */}
        <div className="mb-3 p-3 bg-cyan-950/30 border border-cyan-500/20 rounded-xl text-xs text-cyan-200 leading-relaxed flex gap-2">
          <ShieldAlert className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <strong>操作指南：</strong>导入历史台风后，将以<strong>3小时一次</strong>的打点密度完整呈现历史轨迹。
            点击轨迹上的任意打点，可时光穿梭回溯历史时刻；在回溯节点操作摇杆，可直接<strong>切断后续历史，开启全新分支演化模拟</strong>！
          </div>
        </div>

        {/* Typhoon List Scrollable */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3 scrollbar-thin scrollbar-thumb-slate-800">
          {filteredTyphoons.map((ty) => {
            const peakVmax = Math.max(...ty.points.map((p) => p.vmax));
            const minPmin = Math.min(...ty.points.filter((p) => p.pmin !== undefined).map((p) => p.pmin || 1000));
            
            const getCategoryChinese = (v: number) => {
              if (v >= 51.0) return "超强台风 (Super TY)";
              if (v >= 41.5) return "强台风 (STY)";
              if (v >= 32.7) return "台风 (TY)";
              if (v >= 24.5) return "强热带风暴 (STS)";
              return "热带风暴 (TS)";
            };

            return (
              <div 
                key={`${ty.year}_${ty.name}`}
                className="p-4 rounded-xl bg-slate-900/50 hover:bg-slate-800/40 border border-slate-800/80 hover:border-blue-500/30 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 group"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-cyan-950 text-cyan-300 rounded border border-cyan-800/60">
                      {ty.year}年
                    </span>
                    <h4 className="text-sm font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">
                      {ty.name}
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed max-w-lg">
                    {ty.description}
                  </p>
                  
                  {/* Stats Badges */}
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <span className="flex items-center gap-1 text-[10px] text-orange-400">
                      <Wind className="w-3.5 h-3.5" />
                      巅峰风速: {peakVmax} m/s ({getCategoryChinese(peakVmax)})
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="flex items-center gap-1 text-[10px] text-blue-400">
                      <Compass className="w-3.5 h-3.5" />
                      最低气压: {minPmin} hPa
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-[10px] text-slate-400">
                      观测点数: {ty.points.length}个 (打点间隔: 3小时)
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => onSelectTyphoon(ty)}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-slate-100 font-bold text-xs rounded-xl transition-all shadow-md active:scale-95 whitespace-nowrap cursor-pointer hover:shadow-cyan-500/20"
                >
                  加载此台风
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-3 mt-4 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-500">
          <span>展示 2000-2025 年共 {filteredTyphoons.length} 个历史代表性台风</span>
          <span>西太平洋台风开源数据集 • CMA历史最佳路径标准</span>
        </div>
      </div>
    </div>
  );
}
