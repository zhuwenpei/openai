
function getTurbulenceJitter(t: number, seed: number = 1.0): number {
  // Use a slow-modulating envelope on top of multiple non-integer frequencies
  // to avoid uniform wave patterns, producing organic, random-looking variations.
  const envelope = 0.5 + 0.5 * Math.sin(t * 0.23 + seed * 1.1);
  const signal = (
    Math.sin(t * 2.1 + seed * 3.7) * 0.40 +
    Math.cos(t * 4.7 - seed * 1.9) * 0.30 +
    Math.sin(t * 11.3 + seed * 5.3) * 0.20 +
    Math.cos(t * 23.7 - seed * 7.1) * 0.10
  );
  return signal * envelope;
}
import React, { useState, useRef, useEffect } from "react";
import { X, Download, Sliders, Sparkles, ExternalLink } from "lucide-react";
import { Typhoon } from "../types";

interface StationReportModalProps {
  station: { id: string; name: string; lat: number; lon: number };
  typhoons: Typhoon[];
  startDate?: Date;
  onClose: () => void;
}

export default function StationReportModal({ station, typhoons, startDate: propStartDate, onClose }: StationReportModalProps) {
  const [showMaxWind, setShowMaxWind] = useState(() => localStorage.getItem("station_showMaxWind") !== "false");
  const [showMaxGust, setShowMaxGust] = useState(() => localStorage.getItem("station_showMaxGust") !== "false");
  const [showMinPressure, setShowMinPressure] = useState(() => localStorage.getItem("station_showMinPressure") !== "false");
  const [showWindCurve, setShowWindCurve] = useState(() => localStorage.getItem("station_showWindCurve") !== "false");
  const [showPressureCurve, setShowPressureCurve] = useState(() => localStorage.getItem("station_showPressureCurve") !== "false");
  const [showPrecipitation, setShowPrecipitation] = useState(() => localStorage.getItem("station_showPrecipitation") !== "false");
  const [showCasualties, setShowCasualties] = useState(() => localStorage.getItem("station_showCasualties") !== "false");
  const [showCityName, setShowCityName] = useState(() => localStorage.getItem("station_showCityName") !== "false");
  const [splitExport, setSplitExport] = useState<"single" | "split">(() => (localStorage.getItem("station_splitExport") as any) || "single");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [resolution, setResolution] = useState<"1080p" | "2K" | "4K">(() => (localStorage.getItem("station_resolution") as any) || "2K");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "4:3" | "1:1" | "9:16">(() => (localStorage.getItem("station_aspectRatio") as any) || "16:9");

  useEffect(() => {
    localStorage.setItem("station_showMaxWind", showMaxWind.toString());
    localStorage.setItem("station_showMaxGust", showMaxGust.toString());
    localStorage.setItem("station_minPressure", showMinPressure.toString());
    localStorage.setItem("station_showWindCurve", showWindCurve.toString());
    localStorage.setItem("station_showPressureCurve", showPressureCurve.toString());
    localStorage.setItem("station_showPrecipitation", showPrecipitation.toString());
    localStorage.setItem("station_showCasualties", showCasualties.toString());
    localStorage.setItem("station_showCityName", showCityName.toString());
    localStorage.setItem("station_splitExport", splitExport);
    localStorage.setItem("station_resolution", resolution);
    localStorage.setItem("station_aspectRatio", aspectRatio);
  }, [showMaxWind, showMaxGust, showMinPressure, showWindCurve, showPressureCurve, showPrecipitation, showCasualties, showCityName, splitExport, resolution, aspectRatio]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const ty = typhoons[0];
  const currentHour = ty?.simHour || 0;

  // Render clean meteorological station report canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let baseW = 2560;
    if (resolution === "1080p") baseW = 1920;
    if (resolution === "4K") baseW = 3840;

    let baseH = Math.round(baseW * (9 / 16));
    if (aspectRatio === "4:3") baseH = Math.round(baseW * (3 / 4));
    if (aspectRatio === "1:1") baseH = baseW;
    if (aspectRatio === "9:16") baseH = Math.round(baseW * (16 / 9));

    canvas.width = baseW;
    canvas.height = baseH;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scale = baseW / 1920;

    // Background - Crisp White Paper
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, baseW, baseH);

    // Outer framing border
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 3 * scale;
    ctx.strokeRect(20 * scale, 20 * scale, baseW - 40 * scale, baseH - 40 * scale);

    // Get current active reading to ensure 100% consistency with station detail view
    const activeState = ty?.history?.find(h => h.simHour === currentHour) || ty?.history?.[ty?.history?.length - 1];
    const currentReading = activeState?.stationReadings?.find(s => s.name === station.name) || ty?.stationReadings?.find(s => s.name === station.name);
    const stationCasualties = currentReading ? currentReading.casualties : 0;

    // Filter history points up to currentHour
    const rawHistory = (ty?.history || []).filter(h => h.simHour <= currentHour);
    const timeSteps = Math.max(12, rawHistory.length);

    const savedStart = localStorage.getItem("typhoon_sim_start_date");
    const startDate = propStartDate || (savedStart ? new Date(savedStart) : new Date("2026-07-21T00:00:00"));

    const dataPoints = Array.from({ length: timeSteps }, (_, i) => {
      const h = rawHistory[i] || rawHistory[rawHistory.length - 1];
      const simH = h ? h.simHour : i;
      const r = h?.stationReadings?.find(s => s.name === station.name) || (i >= rawHistory.length ? currentReading : undefined);

      const baseWind = r ? r.windSpeed : 0;
      const basePressure = r ? r.pressure : 1013;
      const casualties = r ? r.casualties : 0;
      const basePrecip = r ? r.precipitation || 0 : 0;

      const fTy = Math.min(1.0, baseWind / 8.0);

      const ambientWind = 2.1 + Math.sin(simH * 0.35) * 0.7 + Math.cos(simH * 0.85) * 0.5 + Math.sin(simH * 2.3) * 0.3;
      const noiseWind = (Math.sin(simH * 1.7) * 0.25 + Math.cos(simH * 3.3) * 0.20);

      let wind = Math.max(ambientWind * (1 - fTy), baseWind + noiseWind * (1 + fTy));
      if (baseWind < 0.5) {
        wind = Math.min(5.8, wind);
      }

      const gustRatio = 1.18 + 0.22 * Math.min(1.0, wind / 35.0);
      const gustAdd = (0.35 * (1 - fTy)) + (1.0 + 0.12 * wind) * fTy * Math.abs(Math.sin(simH * 1.9));
      let gust = Math.max(wind + 0.8, wind * gustRatio + gustAdd);

      if (baseWind < 0.5) {
        const maxAllowedGust = Math.min(8.0, wind + 2.8);
        gust = Math.min(maxAllowedGust, Math.max(wind + 0.8, gust));
      }

      const ambientPressure = 1012.8 + Math.sin(simH * 0.26) * 2.2 + Math.cos(simH * 0.65) * 0.9;
      const noisePressure = (Math.cos(simH * 2.1) * 0.3 + Math.sin(simH * 4.1) * 0.2);

      const pressure = Math.round((Math.min(ambientPressure, basePressure) + noisePressure) * 10) / 10;
      const dateObj = new Date(startDate.getTime() + simH * 3600 * 1000);

      // Hourly precipitation calculation
      const precip = Math.max(0, basePrecip > 0 ? basePrecip + (Math.sin(simH * 1.4) * 2.0) : (fTy > 0.3 ? Math.abs(Math.sin(simH * 0.8)) * 12.0 * fTy : 0));

      return {
        simHour: simH,
        dateObj,
        wind,
        gust,
        pressure,
        casualties,
        precip: Number(precip.toFixed(1))
      };
    });

    const maxWindSpeed = Math.max(...dataPoints.map(d => d.wind), 0);
    const maxGustSpeed = Math.max(...dataPoints.map(d => d.gust), 0);
    const minPressure = Math.min(...dataPoints.map(d => d.pressure), 1013);

    // --- Header Section ---
    const padX = 90 * scale;
    let curY = 48 * scale;

    ctx.fillStyle = "#0f172a";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    // City / Station Name (Enlarged Font)
    const cityName = showCityName ? station.name : "气象观测站";
    ctx.font = `bold ${Math.round(36 * scale)}px sans-serif`;
    ctx.fillText(`${cityName}气象站 仿真实况分析报告`, padX, curY);

    const initTimeStr = `${startDate.getUTCFullYear()}-${(startDate.getUTCMonth() + 1).toString().padStart(2, "0")}-${startDate.getUTCDate().toString().padStart(2, "0")} 00:00 (UTC)`;
    ctx.save();
    ctx.font = `normal ${Math.round(20 * scale)}px sans-serif`;
    ctx.fillStyle = "#475569";
    ctx.textAlign = "right";
    ctx.fillText(`生成时间：${initTimeStr} | 模式：WRF-Meteo 3.0`, baseW - padX, curY + 12 * scale);
    ctx.restore();

    curY += 56 * scale;

    // Station Location details (Enlarged Font)
    ctx.font = `normal ${Math.round(22 * scale)}px sans-serif`;
    ctx.fillStyle = "#334155";
    ctx.fillText(`站点位置: ${station.lon.toFixed(2)}°E, ${station.lat.toFixed(2)}°N  |  海拔: 16米  |  台风目标: ${ty?.name || "台风模拟"}`, padX, curY);

    curY += 40 * scale;

    // Checked Header Cards / Metrics Banner (Enlarged Font & Padding)
    let bannerX = padX;
    const bannerBoxH = 54 * scale;

    const drawCard = (label: string, value: string, valColor: string) => {
      ctx.font = `normal ${Math.round(20 * scale)}px sans-serif`;
      const labelW = ctx.measureText(label).width;
      ctx.font = `bold ${Math.round(24 * scale)}px sans-serif`;
      const valW = ctx.measureText(value).width;
      const boxW = labelW + valW + 36 * scale;

      if (bannerX + boxW > baseW - padX) {
        bannerX = padX;
        curY += bannerBoxH + 12 * scale;
      }

      ctx.fillStyle = "#f8fafc";
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1.5 * scale;
      ctx.beginPath();
      ctx.roundRect(bannerX, curY, boxW, bannerBoxH, 8 * scale);
      ctx.fill();
      ctx.stroke();

      ctx.save();
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#475569";
      ctx.font = `normal ${Math.round(20 * scale)}px sans-serif`;
      ctx.fillText(label, bannerX + 18 * scale, curY + bannerBoxH / 2);

      ctx.fillStyle = valColor;
      ctx.font = `bold ${Math.round(24 * scale)}px sans-serif`;
      ctx.fillText(value, bannerX + 18 * scale + labelW, curY + bannerBoxH / 2);
      ctx.restore();

      bannerX += boxW + 24 * scale;
    };

    if (showMaxWind) {
      drawCard("最大风速: ", `${maxWindSpeed.toFixed(1)} m/s`, "#7e22ce");
    }
    if (showMaxGust) {
      drawCard("最大阵风: ", `${maxGustSpeed.toFixed(1)} m/s`, "#ef4444");
    }
    if (showMinPressure) {
      drawCard("最低气压: ", `${minPressure.toFixed(1)} hPa`, "#0284c7");
    }
    if (showCasualties) {
      drawCard("伤亡人数: ", `${stationCasualties} 人`, stationCasualties > 0 ? "#dc2626" : "#16a34a");
    }

    curY += bannerBoxH + 36 * scale;

    // --- Subplot Charts Layout ---
    const plotLeft = 140 * scale;
    const plotRight = showCasualties ? baseW - 140 * scale : baseW - 80 * scale;
    const plotWidth = plotRight - plotLeft;
    const plotTop = curY;
    const plotBottom = baseH - 75 * scale;
    const availableH = plotBottom - plotTop;

    const activeCurvesCount = (showWindCurve ? 1 : 0) + (showPressureCurve ? 1 : 0) + (showPrecipitation ? 1 : 0);

    if (activeCurvesCount > 0) {
      const panelGap = 36 * scale;
      const panelH = (availableH - panelGap * (activeCurvesCount - 1)) / activeCurvesCount;
      let curPanelY = plotTop;

      if (showWindCurve) {
        drawWindPanel(ctx, plotLeft, curPanelY, plotWidth, panelH, dataPoints, maxWindSpeed, scale, showCasualties);
        curPanelY += panelH + panelGap;
      }

      if (showPressureCurve) {
        drawPressurePanel(ctx, plotLeft, curPanelY, plotWidth, panelH, dataPoints, minPressure, scale);
        curPanelY += panelH + panelGap;
      }

      if (showPrecipitation) {
        drawPrecipitationPanel(ctx, plotLeft, curPanelY, plotWidth, panelH, dataPoints, scale);
      }
    } else {
      // No curve checked -> render clean summary box
      ctx.fillStyle = "#f8fafc";
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1.5 * scale;
      ctx.beginPath();
      ctx.roundRect(plotLeft, plotTop, plotWidth, availableH, 12 * scale);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#334155";
      ctx.font = `bold ${Math.round(24 * scale)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("气象数据摘要表已生成（未勾选图表曲线）", plotLeft + plotWidth / 2, plotTop + availableH / 2 - 20 * scale);
      ctx.font = `normal ${Math.round(18 * scale)}px sans-serif`;
      ctx.fillText(`观测点：${cityName}  |  极大风速：${maxWindSpeed.toFixed(1)} m/s  |  最低气压：${minPressure.toFixed(1)} hPa`, plotLeft + plotWidth / 2, plotTop + availableH / 2 + 20 * scale);
    }

  }, [showMaxWind, showMaxGust, showMinPressure, showWindCurve, showPressureCurve, showPrecipitation, showCasualties, showCityName, resolution, aspectRatio, station, typhoons, currentHour]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    setPreviewImage(url);
  };

  const handleDownloadActual = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!previewImage) return;
    const a = document.createElement("a");
    a.href = previewImage;
    a.download = `气象报告_${station.name}_${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-[#1E9CFF]" />
            <h2 className="text-lg font-bold text-white tracking-tight">制作气象报告图 ({station.name}站)</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Controls Panel */}
          <div className="space-y-6 bg-slate-950/40 border border-slate-800/80 rounded-xl p-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-3">
                <Sliders className="w-4 h-4 text-[#1E9CFF]" />
                要显示的信息 (按需勾选)
              </h3>
              <div className="space-y-2.5 text-xs text-slate-300">
                <label className="flex items-center gap-2.5 cursor-pointer select-none hover:text-white">
                  <input type="checkbox" checked={showCityName} onChange={e => setShowCityName(e.target.checked)} className="accent-[#1E9CFF] w-4 h-4" />
                  城市/站点名 (Station/City Name)
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer select-none hover:text-white">
                  <input type="checkbox" checked={showMaxWind} onChange={e => setShowMaxWind(e.target.checked)} className="accent-[#1E9CFF] w-4 h-4" />
                  最大风速 (Max Wind Speed)
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer select-none hover:text-white">
                  <input type="checkbox" checked={showMaxGust} onChange={e => setShowMaxGust(e.target.checked)} className="accent-[#1E9CFF] w-4 h-4" />
                  最大阵风 (Max Gust)
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer select-none hover:text-white">
                  <input type="checkbox" checked={showMinPressure} onChange={e => setShowMinPressure(e.target.checked)} className="accent-[#1E9CFF] w-4 h-4" />
                  最低气压 (Min Pressure)
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer select-none hover:text-white">
                  <input type="checkbox" checked={showWindCurve} onChange={e => setShowWindCurve(e.target.checked)} className="accent-[#1E9CFF] w-4 h-4" />
                  风速曲线 (Wind Curve)
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer select-none hover:text-white">
                  <input type="checkbox" checked={showPressureCurve} onChange={e => setShowPressureCurve(e.target.checked)} className="accent-[#1E9CFF] w-4 h-4" />
                  气压曲线 (Pressure Curve)
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer select-none hover:text-white">
                  <input type="checkbox" checked={showPrecipitation} onChange={e => setShowPrecipitation(e.target.checked)} className="accent-[#1E9CFF] w-4 h-4" />
                  叠加降水柱状图 (Hourly Precipitation)
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer select-none hover:text-white">
                  <input type="checkbox" checked={showCasualties} onChange={e => setShowCasualties(e.target.checked)} className="accent-[#1E9CFF] w-4 h-4" />
                  伤亡人数 (Casualties)
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/80">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">多图输出模式 (Multi-Image Generation)</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() => setSplitExport("single")}
                  className={`py-2 rounded-lg font-semibold border transition-all cursor-pointer ${
                    splitExport === "single"
                      ? "bg-[#1E9CFF] border-[#1E9CFF] text-white shadow-lg shadow-[#1E9CFF]/20"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  合成为1张图片
                </button>
                <button
                  onClick={() => setSplitExport("split")}
                  className={`py-2 rounded-lg font-semibold border transition-all cursor-pointer ${
                    splitExport === "split"
                      ? "bg-[#1E9CFF] border-[#1E9CFF] text-white shadow-lg shadow-[#1E9CFF]/20"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  分多张图片生成
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/80">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">图像清晰度 (Resolution)</h3>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {(["1080p", "2K", "4K"] as const).map(res => (
                  <button
                    key={res}
                    onClick={() => setResolution(res)}
                    className={`py-2 rounded-lg font-semibold border transition-all cursor-pointer ${
                      resolution === res
                        ? "bg-[#1E9CFF] border-[#1E9CFF] text-white shadow-lg shadow-[#1E9CFF]/20"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/80">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">图片比例 (Aspect Ratio)</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {(["16:9", "4:3", "1:1", "9:16"] as const).map(ratio => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={`py-2 rounded-lg font-semibold border transition-all cursor-pointer ${
                      aspectRatio === ratio
                        ? "bg-[#1E9CFF] border-[#1E9CFF] text-white shadow-lg shadow-[#1E9CFF]/20"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleDownload}
              className="w-full py-3 bg-[#1E9CFF] hover:bg-[#1E9CFF]/90 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#1E9CFF]/25 transition-all cursor-pointer mt-4"
            >
              <Download className="w-4 h-4" />
              导出高清气象报告图
            </button>
          </div>

          {/* Canvas Preview Area */}
          <div className="lg:col-span-2 bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 flex flex-col items-center justify-center min-h-[400px]">
            <div className="w-full h-full flex items-center justify-center overflow-hidden rounded-lg shadow-2xl border border-slate-800">
              <canvas ref={canvasRef} className="max-w-full max-h-[500px] object-contain rounded" />
            </div>
          </div>

        </div>
      </div>

      {previewImage && (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-slate-950/95 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-4xl flex flex-col gap-4 shadow-2xl relative">
            <button 
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-300 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100">图片原图预览</h3>
            </div>

            <div className="flex-1 overflow-auto bg-slate-950/80 rounded-xl p-4 flex items-center justify-center min-h-[40vh] max-h-[60vh] border border-slate-800/40">
              <img 
                src={previewImage} 
                alt="Image Preview" 
                className="max-w-full max-h-[55vh] object-contain rounded-lg shadow-lg" 
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800/60 pt-4">
              <p className="text-xs text-slate-400 font-medium">提示：在移动设备上，长按图片可唤起浏览器原生保存功能</p>
              <div className="flex gap-3 w-full sm:w-auto text-white">
                <button 
                  onClick={() => setPreviewImage(null)}
                  className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition cursor-pointer"
                >
                  取消
                </button>
                <button 
                  onClick={() => {
                    try {
                      const arr = previewImage.split(",");
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
                      a.href = previewImage;
                      a.target = "_blank";
                      a.click();
                    }
                  }}
                  className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl border border-sky-800/80 bg-sky-950/20 text-blue-400 hover:bg-sky-900/30 font-bold text-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  在新标签页打开原图
                </button>
                <button 
                  onClick={handleDownloadActual}
                  className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold flex items-center justify-center gap-1.5 text-sm transition shadow-md cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  下载原图
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Helper: Draw Wind & Gust Panel with Inner Padding and Bounds Safeguard
function drawWindPanel(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  pw: number,
  ph: number,
  data: any[],
  maxWind: number,
  scale: number,
  showCasualties: boolean = false
) {
  const steps = data.length;
  const stepW = pw / Math.max(1, steps - 1);

  const maxGust = Math.max(...data.map(d => d.gust), maxWind);
  const maxAxis = Math.max(15, Math.ceil((maxGust * 1.25) / 5) * 5); // 25% margin to ensure curves NEVER touch/overflow top border

  const paddingTop = 40 * scale;
  const paddingBottom = 35 * scale;
  const drawH = ph - paddingTop - paddingBottom;

  // Box
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 1.5 * scale;
  ctx.strokeRect(px, py, pw, ph);

  // Horizontal Grid Lines
  ctx.strokeStyle = "#f1f5f9";
  ctx.lineWidth = 1 * scale;
  for (let g = 0; g <= 4; g++) {
    const gy = py + paddingTop + (drawH / 4) * g;
    ctx.beginPath();
    ctx.moveTo(px, gy);
    ctx.lineTo(px + pw, gy);
    ctx.stroke();
  }

  // Left Y-Axis Labels (Wind)
  ctx.fillStyle = "#0f172a";
  ctx.font = `bold ${Math.round(16 * scale)}px sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText("风速 (m/s)", px - 16 * scale, py + paddingTop - 32 * scale);

  ctx.font = `bold ${Math.round(15 * scale)}px sans-serif`;
  ctx.fillStyle = "#334155";
  ctx.fillText(`${maxAxis}`, px - 16 * scale, py + paddingTop);
  ctx.fillText(`${Math.round(maxAxis * 0.75)}`, px - 16 * scale, py + paddingTop + drawH * 0.25);
  ctx.fillText(`${Math.round(maxAxis * 0.5)}`, px - 16 * scale, py + paddingTop + drawH * 0.5);
  ctx.fillText(`${Math.round(maxAxis * 0.25)}`, px - 16 * scale, py + paddingTop + drawH * 0.75);
  ctx.fillText("0", px - 16 * scale, py + paddingTop + drawH);

  // Legend
  ctx.textAlign = "left";
  let legendX = px + pw - 240 * scale;

  ctx.strokeStyle = "#a855f7";
  ctx.lineWidth = 3 * scale;
  ctx.beginPath();
  ctx.moveTo(legendX, py + 22 * scale);
  ctx.lineTo(legendX + 25 * scale, py + 22 * scale);
  ctx.stroke();

  ctx.fillStyle = "#1e293b";
  ctx.font = `bold ${Math.round(16 * scale)}px sans-serif`;
  ctx.fillText("平均风速", legendX + 30 * scale, py + 22 * scale);

  legendX += 120 * scale;
  ctx.strokeStyle = "#ef4444";
  ctx.beginPath();
  ctx.moveTo(legendX, py + 22 * scale);
  ctx.lineTo(legendX + 25 * scale, py + 22 * scale);
  ctx.stroke();
  ctx.fillText("阵风", legendX + 30 * scale, py + 22 * scale);

  // Clip graph rendering so curves NEVER overflow the table border
  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, pw, ph);
  ctx.clip();

  // Key node indices for exact preservation
  const subSteps = 6;
  const gustMaxVal = Math.max(...data.map(d => d.gust));
  const gustMaxIndices = data.map((d, idx) => Math.abs(d.gust - gustMaxVal) < 0.01 ? idx : -1).filter(i => i >= 0);
  gustMaxIndices.push(0, data.length - 1);

  const windMaxVal = Math.max(...data.map(d => d.wind));
  const windMaxIndices = data.map((d, idx) => Math.abs(d.wind - windMaxVal) < 0.01 ? idx : -1).filter(i => i >= 0);
  windMaxIndices.push(0, data.length - 1);

  // Gust Line with Realistic High-Frequency Turbulence Jitter
  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = 2.2 * scale;
  ctx.beginPath();
  data.forEach((d1, i) => {
    if (i === data.length - 1) return;
    const d2 = data[i + 1];
    const x1 = px + i * stepW;
    const x2 = px + (i + 1) * stepW;

    for (let k = 0; k <= subSteps; k++) {
      if (i > 0 && k === 0) continue;
      const frac = k / subSteps;
      const t = i + frac;
      const currX = x1 + (x2 - x1) * frac;
      const baseGust = d1.gust + (d2.gust - d1.gust) * frac;
      const baseWind = d1.wind + (d2.wind - d1.wind) * frac;
      
      let minDGust = Infinity;
      for (const kIdx of gustMaxIndices) {
        const dist = Math.abs(t - kIdx);
        if (dist < minDGust) minDGust = dist;
      }
      const keyFactorGust = Math.min(1.0, Math.pow(minDGust / 0.65, 1.5));
      const noiseGust = getTurbulenceJitter(t, 42) * 1.8 * keyFactorGust;

      let minDWind = Infinity;
      for (const kIdx of windMaxIndices) {
        const dist = Math.abs(t - kIdx);
        if (dist < minDWind) minDWind = dist;
      }
      const keyFactorWind = Math.min(1.0, Math.pow(minDWind / 0.65, 1.5));
      const noiseWind = getTurbulenceJitter(t, 17) * 1.0 * keyFactorWind;

      const jitteredWind = Math.min(windMaxVal, Math.max(0, baseWind + noiseWind));
      const jitteredGust = Math.min(gustMaxVal, Math.max(jitteredWind + 0.6, baseGust + noiseGust));
      const currY = py + paddingTop + drawH - (jitteredGust / maxAxis) * drawH;

      if (i === 0 && k === 0) ctx.moveTo(currX, currY);
      else ctx.lineTo(currX, currY);
    }
  });
  ctx.stroke();

  // Wind Speed Line (Purple) with Realistic High-Frequency Turbulence Jitter
  ctx.strokeStyle = "#a855f7";
  ctx.lineWidth = 3.2 * scale;
  ctx.beginPath();
  data.forEach((d1, i) => {
    if (i === data.length - 1) return;
    const d2 = data[i + 1];
    const x1 = px + i * stepW;
    const x2 = px + (i + 1) * stepW;

    for (let k = 0; k <= subSteps; k++) {
      if (i > 0 && k === 0) continue;
      const frac = k / subSteps;
      const t = i + frac;
      const currX = x1 + (x2 - x1) * frac;
      const baseWind = d1.wind + (d2.wind - d1.wind) * frac;
      
      let minD = Infinity;
      for (const kIdx of windMaxIndices) {
        const dist = Math.abs(t - kIdx);
        if (dist < minD) minD = dist;
      }
      const keyFactor = Math.min(1.0, Math.pow(minD / 0.65, 1.5));
      const noise = getTurbulenceJitter(t, 17) * 1.3 * keyFactor;
      
      const jitteredWind = Math.min(windMaxVal, Math.max(0, baseWind + noise));
      const currY = py + paddingTop + drawH - (jitteredWind / maxAxis) * drawH;

      if (i === 0 && k === 0) ctx.moveTo(currX, currY);
      else ctx.lineTo(currX, currY);
    }
  });
  ctx.stroke();

  // Dots
  data.forEach((d, i) => {
    const x = px + i * stepW;
    const y = py + paddingTop + drawH - (d.wind / maxAxis) * drawH;
    ctx.beginPath();
    ctx.arc(x, y, 4 * scale, 0, Math.PI * 2);
    ctx.fillStyle = "#7e22ce";
    ctx.fill();
  });

  ctx.restore();

  // Timeline ticks at bottom
  drawTimelineTicks(ctx, px, py + paddingTop + drawH, pw, ph, data, stepW, scale);
}

// Helper: Draw Pressure Panel with Inner Padding and Bounds Safeguard
function drawPressurePanel(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  pw: number,
  ph: number,
  data: any[],
  minPressure: number,
  scale: number
) {
  const steps = data.length;
  const stepW = pw / Math.max(1, steps - 1);

  const maxP = Math.max(...data.map(d => d.pressure));
  const minP = Math.min(...data.map(d => d.pressure));

  const maxPAxis = Math.max(1025, Math.ceil((maxP + 3) / 5) * 5);
  const minPAxis = Math.floor((minP - 6) / 5) * 5;
  const rangeP = Math.max(15, maxPAxis - minPAxis);

  const paddingTop = 40 * scale;
  const paddingBottom = 35 * scale;
  const drawH = ph - paddingTop - paddingBottom;

  // Box
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 1.5 * scale;
  ctx.strokeRect(px, py, pw, ph);

  // Horizontal Grid Lines
  ctx.strokeStyle = "#f1f5f9";
  ctx.lineWidth = 1 * scale;
  for (let g = 0; g <= 4; g++) {
    const gy = py + paddingTop + (drawH / 4) * g;
    ctx.beginPath();
    ctx.moveTo(px, gy);
    ctx.lineTo(px + pw, gy);
    ctx.stroke();
  }

  // Y-Axis Labels (Enlarged Fonts)
  ctx.fillStyle = "#0f172a";
  ctx.font = `bold ${Math.round(16 * scale)}px sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText("气压 (hPa)", px - 16 * scale, py + paddingTop - 32 * scale);

  ctx.font = `bold ${Math.round(15 * scale)}px sans-serif`;
  ctx.fillStyle = "#334155";
  ctx.fillText(`${maxPAxis}`, px - 16 * scale, py + paddingTop);
  ctx.fillText(`${Math.round(maxPAxis - rangeP * 0.25)}`, px - 16 * scale, py + paddingTop + drawH * 0.25);
  ctx.fillText(`${Math.round(maxPAxis - rangeP * 0.5)}`, px - 16 * scale, py + paddingTop + drawH * 0.5);
  ctx.fillText(`${Math.round(maxPAxis - rangeP * 0.75)}`, px - 16 * scale, py + paddingTop + drawH * 0.75);
  ctx.fillText(`${minPAxis}`, px - 16 * scale, py + paddingTop + drawH);

  // Legend (Enlarged Fonts)
  ctx.textAlign = "left";
  ctx.strokeStyle = "#0284c7";
  ctx.lineWidth = 3 * scale;
  ctx.beginPath();
  ctx.moveTo(px + pw - 160 * scale, py + 22 * scale);
  ctx.lineTo(px + pw - 135 * scale, py + 22 * scale);
  ctx.stroke();

  ctx.fillStyle = "#1e293b";
  ctx.font = `bold ${Math.round(16 * scale)}px sans-serif`;
  ctx.fillText("海平面气压", px + pw - 130 * scale, py + 22 * scale);

  // Clip graph rendering so curves NEVER overflow the table border
  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, pw, ph);
  ctx.clip();

  // Pressure Line (Blue) with High-Frequency Barometric Micro-Variation Jitter
  const subSteps = 6;
  const pressureMinVal = Math.min(...data.map(d => d.pressure));
  const pressureMinIndices = data.map((d, idx) => Math.abs(d.pressure - pressureMinVal) < 0.01 ? idx : -1).filter(i => i >= 0);
  pressureMinIndices.push(0, data.length - 1);

  ctx.strokeStyle = "#0284c7";
  ctx.lineWidth = 3.2 * scale;
  ctx.beginPath();
  data.forEach((d1, i) => {
    if (i === data.length - 1) return;
    const d2 = data[i + 1];
    const x1 = px + i * stepW;
    const x2 = px + (i + 1) * stepW;

    for (let k = 0; k <= subSteps; k++) {
      if (i > 0 && k === 0) continue;
      const frac = k / subSteps;
      const t = i + frac;
      const currX = x1 + (x2 - x1) * frac;
      const baseP = d1.pressure + (d2.pressure - d1.pressure) * frac;
      
      let minD = Infinity;
      for (const kIdx of pressureMinIndices) {
        const dist = Math.abs(t - kIdx);
        if (dist < minD) minD = dist;
      }
      const keyFactor = Math.min(1.0, Math.pow(minD / 0.75, 1.2));
      const noise = getTurbulenceJitter(t, 31) * 0.35 * keyFactor;
      
      const jitteredP = Math.max(pressureMinVal, Math.min(1030, baseP + noise));
      const currY = py + paddingTop + drawH - ((jitteredP - minPAxis) / rangeP) * drawH;

      if (i === 0 && k === 0) ctx.moveTo(currX, currY);
      else ctx.lineTo(currX, currY);
    }
  });
  ctx.stroke();

  // Dots
  data.forEach((d, i) => {
    const x = px + i * stepW;
    const y = py + paddingTop + drawH - ((d.pressure - minPAxis) / rangeP) * drawH;
    ctx.beginPath();
    ctx.arc(x, y, 4 * scale, 0, Math.PI * 2);
    ctx.fillStyle = "#0369a1";
    ctx.fill();
  });

  ctx.restore();

  // Timeline Ticks
  drawTimelineTicks(ctx, px, py + paddingTop + drawH, pw, ph, data, stepW, scale);
}

// Timeline Ticks Helper
function drawTimelineTicks(
  ctx: CanvasRenderingContext2D,
  px: number,
  axisY: number,
  pw: number,
  ph: number,
  data: any[],
  stepW: number,
  scale: number
) {
  ctx.fillStyle = "#475569";
  ctx.font = `bold ${Math.round(14 * scale)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const stride = Math.max(1, Math.ceil(data.length / 8));

  data.forEach((d, i) => {
    if (i % stride === 0) {
      const x = px + i * stepW;
      const dayStr = (d.dateObj.getUTCDate()).toString().padStart(2, "0") + "日";
      const hourStr = d.dateObj.getUTCHours().toString().padStart(2, "0") + ":00";

      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1.5 * scale;
      ctx.beginPath();
      ctx.moveTo(x, axisY);
      ctx.lineTo(x, axisY + 6 * scale);
      ctx.stroke();

      ctx.fillText(`${dayStr} ${hourStr}`, x, axisY + 8 * scale);
    }
  });
}

function drawPrecipitationPanel(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  pw: number,
  ph: number,
  data: any[],
  scale: number
) {
  const steps = data.length;
  const stepW = pw / Math.max(1, steps - 1);
  const maxPrecip = Math.max(10, Math.ceil(Math.max(...data.map((d: any) => d.precip || 0), 10) * 1.2));

  const paddingTop = 40 * scale;
  const paddingBottom = 35 * scale;
  const drawH = ph - paddingTop - paddingBottom;

  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 1.5 * scale;
  ctx.strokeRect(px, py, pw, ph);

  // Horizontal Grid Lines
  ctx.strokeStyle = "#f1f5f9";
  ctx.lineWidth = 1 * scale;
  for (let g = 0; g <= 4; g++) {
    const gy = py + paddingTop + (drawH / 4) * g;
    ctx.beginPath();
    ctx.moveTo(px, gy);
    ctx.lineTo(px + pw, gy);
    ctx.stroke();
  }

  // Y-Axis Labels
  ctx.fillStyle = "#0f172a";
  ctx.font = `bold ${Math.round(18 * scale)}px sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText("降水 (mm/h)", px - 16 * scale, py + paddingTop - 32 * scale);

  ctx.font = `bold ${Math.round(16 * scale)}px sans-serif`;
  ctx.fillStyle = "#334155";
  ctx.fillText(`${maxPrecip}`, px - 16 * scale, py + paddingTop);
  ctx.fillText(`${Math.round(maxPrecip * 0.5)}`, px - 16 * scale, py + paddingTop + drawH * 0.5);
  ctx.fillText("0", px - 16 * scale, py + paddingTop + drawH);

  // Draw Bars
  const barW = Math.max(3 * scale, stepW * 0.65);
  data.forEach((d: any, i: number) => {
    const precipVal = d.precip || 0;
    if (precipVal <= 0) return;
    const barH = (precipVal / maxPrecip) * drawH;
    const bx = px + i * stepW - barW / 2;
    const by = py + paddingTop + drawH - barH;

    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(bx, by, barW, barH);
    ctx.strokeStyle = "#1d4ed8";
    ctx.lineWidth = 1 * scale;
    ctx.strokeRect(bx, by, barW, barH);
  });

  drawTimelineTicks(ctx, px, py + paddingTop + drawH, pw, ph, data, stepW, scale);
}
