
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
import { getLandMetrics } from "../simulation/Engine";

const cleanLandName = (rawName: string) => {
  return rawName
    .replace(/\s*\(OSM Geofabrik Asia 提取\)/g, "")
    .replace(/\s*\(精细气象观测掩膜\)/g, "")
    .replace(/\s*\(西太平洋.*\)/g, "")
    .replace(/\s*\(大湾区.*\)/g, "")
    .replace(/\s*\(东海.*\)/g, "")
    .replace(/\s*\(长江.*\)/g, "")
    .replace(/\s*\(高纬度.*\)/g, "")
    .replace(/\s*\(菲律宾\)/g, "")
    .replace(/\s*\(.*\)/g, "")
    .trim();
};

interface TyphoonReportModalProps {
  typhoon: Typhoon;
  startDate?: Date;
  onClose: () => void;
}

export default function TyphoonReportModal({ typhoon, startDate, onClose }: TyphoonReportModalProps) {
  const simStartDate = startDate || (localStorage.getItem("typhoon_sim_start_date") ? new Date(localStorage.getItem("typhoon_sim_start_date")!) : new Date("2026-07-21T00:00:00"));
  const [showMaxWind, setShowMaxWind] = useState(() => localStorage.getItem("report_showMaxWind") !== "false");
  const [showMinPressure, setShowMinPressure] = useState(() => localStorage.getItem("report_showMinPressure") !== "false");
  const [showDuration, setShowDuration] = useState(() => localStorage.getItem("report_showDuration") !== "false");
  const [showCasualtiesDisplay, setShowCasualtiesDisplay] = useState(() => localStorage.getItem("report_showCasualtiesDisplay") !== "false");
  const [showLandfallInfo, setShowLandfallInfo] = useState(() => localStorage.getItem("report_showLandfallInfo") !== "false");
  const [showWindCurve, setShowWindCurve] = useState(() => localStorage.getItem("report_showWindCurve") !== "false");
  const [showPressureCurve, setShowPressureCurve] = useState(() => localStorage.getItem("report_showPressureCurve") !== "false");
  const [splitExport, setSplitExport] = useState<"single" | "split">(() => (localStorage.getItem("report_splitExport") as any) || "single");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [resolution, setResolution] = useState<"1080p" | "2K" | "4K">(() => (localStorage.getItem("report_resolution") as any) || "2K");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "4:3" | "3:4" | "1:1">(() => (localStorage.getItem("report_aspectRatio") as any) || "16:9");

  useEffect(() => {
    localStorage.setItem("report_showMaxWind", showMaxWind.toString());
    localStorage.setItem("report_showMinPressure", showMinPressure.toString());
    localStorage.setItem("report_showDuration", showDuration.toString());
    localStorage.setItem("report_showCasualtiesDisplay", showCasualtiesDisplay.toString());
    localStorage.setItem("report_showLandfallInfo", showLandfallInfo.toString());
    localStorage.setItem("report_showWindCurve", showWindCurve.toString());
    localStorage.setItem("report_showPressureCurve", showPressureCurve.toString());
    localStorage.setItem("report_splitExport", splitExport);
    localStorage.setItem("report_resolution", resolution);
    localStorage.setItem("report_aspectRatio", aspectRatio);
  }, [showMaxWind, showMinPressure, showDuration, showCasualtiesDisplay, showLandfallInfo, showWindCurve, showPressureCurve, splitExport, resolution, aspectRatio]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  let maxWind = 0;
  let minPressure = 1013;
  const rawHistory: any[] = [];

  typhoon.history.forEach((h) => {
    if (h.vmax > maxWind) maxWind = h.vmax;
    if (h.pmin < minPressure) minPressure = h.pmin;
    rawHistory.push({
      time: h.simHour,
      wind: h.vmax,
      pressure: h.pmin,
      casualties: Math.floor(h.casualties || 0)
    });
  });

  const maxWindIndices: number[] = [];
  const minPressureIndices: number[] = [];
  rawHistory.forEach((d, idx) => {
    if (Math.abs(d.wind - maxWind) < 0.05) maxWindIndices.push(idx);
    if (Math.abs(d.pressure - minPressure) < 0.1) minPressureIndices.push(idx);
  });

  const historyData = rawHistory.map((d, i) => {
    if (i === 0 || i === rawHistory.length - 1) {
      return {
        time: d.time,
        wind: Number(d.wind.toFixed(1)),
        pressure: Number(d.pressure.toFixed(1)),
        casualties: d.casualties
      };
    }

    const minDistMaxWind = Math.min(...maxWindIndices.map(idx => Math.abs(idx - i)));
    const minDistMinPressure = Math.min(...minPressureIndices.map(idx => Math.abs(idx - i)));

    const wWindKey = Math.min(1.0, Math.pow(minDistMaxWind / 3.0, 1.2));
    const wPressKey = Math.min(1.0, Math.pow(minDistMinPressure / 3.0, 1.2));

    const windJitter = getTurbulenceJitter(d.time, 1.7) * 1.1 * wWindKey;
    const pressJitter = getTurbulenceJitter(d.time, 3.1) * 0.8 * wPressKey;

    let finalWind = d.wind + windJitter;
    let finalPressure = d.pressure + pressJitter;

    finalWind = Math.min(maxWind, Math.max(0, finalWind));
    finalPressure = Math.max(minPressure, finalPressure);

    if (minDistMaxWind === 0) finalWind = maxWind;
    if (minDistMinPressure === 0) finalPressure = minPressure;

    return {
      time: d.time,
      wind: Number(finalWind.toFixed(1)),
      pressure: Number(finalPressure.toFixed(1)),
      casualties: d.casualties
    };
  });

  const lifeCycleHours = typhoon.history.length > 0 
    ? typhoon.history[typhoon.history.length - 1].simHour 
    : 0;
  const totalCasualties = Math.floor(typhoon.casualties || 0);

  // Calculate Landfalls (Request 5)
  const landfalls: { lat: number; lon: number; wind: number; time: number; region: string }[] = [];
  if (typhoon.landfallRecords && typhoon.landfallRecords.length > 0) {
    typhoon.landfallRecords.forEach((r) => {
      landfalls.push({
        lat: r.lat,
        lon: r.lon,
        wind: r.vmax,
        time: r.simHour,
        region: r.region
      });
    });
  } else {
    let wasLanded = false;
    typhoon.history.forEach((h) => {
      if (h.landed && !wasLanded) {
        const metrics = getLandMetrics(h.lat, h.lon);
        const region = metrics.landName || "沿海地区";

        landfalls.push({
          lat: h.lat,
          lon: h.lon,
          wind: h.vmax,
          time: h.simHour,
          region
        });
      }
      wasLanded = h.landed;
    });
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let baseW = 2560;
    if (resolution === "1080p") baseW = 1920;
    if (resolution === "4K") baseW = 3840;

    let baseH = Math.round(baseW * (9 / 16));
    if (aspectRatio === "4:3") baseH = Math.round(baseW * (3 / 4));
    if (aspectRatio === "3:4") baseH = Math.round(baseW * (4 / 3));
    if (aspectRatio === "1:1") baseH = baseW;

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

    const padX = 90 * scale;
    let curY = 48 * scale;

    // Header Title
    ctx.fillStyle = "#0f172a";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = `bold ${Math.round(38 * scale)}px sans-serif`;
    ctx.fillText(`台风 “${typhoon.name}” 生命周期综合分析报告`, padX, curY);

    const initTimeStr = `${simStartDate.getFullYear()}-${String(simStartDate.getMonth() + 1).padStart(2, '0')}-${String(simStartDate.getDate()).padStart(2, '0')} ${String(simStartDate.getHours()).padStart(2, '0')}:00`;
    ctx.save();
    ctx.font = `normal ${Math.round(20 * scale)}px sans-serif`;
    ctx.fillStyle = "#475569";
    ctx.textAlign = "right";
    ctx.fillText(`起算时间：${initTimeStr} | 模式：WRF-Typhoon 3.0 Simulation`, baseW - padX, curY + 12 * scale);
    ctx.restore();

    curY += 54 * scale;

    ctx.font = `normal ${Math.round(22 * scale)}px sans-serif`;
    ctx.fillStyle = "#334155";
    ctx.fillText(`台风编号: ${typhoon.name}  |  演变总步数: ${historyData.length} 步  |  气象模拟引擎授权`, padX, curY);

    curY += 40 * scale;

    // Banner cards
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
      drawCard("生命史极值风速: ", `${maxWind.toFixed(1)} m/s`, "#e11d48");
    }
    if (showMinPressure) {
      drawCard("生命史最低气压: ", `${minPressure.toFixed(1)} hPa`, "#0284c7");
    }
    if (showDuration) {
      drawCard("持续时间: ", `${lifeCycleHours} 小时`, "#1E9CFF");
    }
    if (showCasualtiesDisplay) {
      drawCard("总伤亡估算: ", `${totalCasualties.toLocaleString()} 人`, totalCasualties > 0 ? "#dc2626" : "#16a34a");
    }

    curY += bannerBoxH + 32 * scale;

    // Optional Landfall info block (Request 5)
    if (showLandfallInfo && landfalls.length > 0) {
      ctx.fillStyle = "#fffbeb";
      ctx.strokeStyle = "#fef3c7";
      ctx.lineWidth = 1.5 * scale;
      ctx.beginPath();
      const landBoxW = baseW - padX * 2;
      const landBoxH = (32 + landfalls.length * 28) * scale;
      ctx.roundRect(padX, curY, landBoxW, landBoxH, 8 * scale);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#b45309";
      ctx.font = `bold ${Math.round(15 * scale)}px sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("⚠️ 陆地登陆记录 (Landfall Events):", padX + 16 * scale, curY + 12 * scale);

      landfalls.forEach((land, idx) => {
        ctx.fillStyle = "#1e293b";
        ctx.font = `normal ${Math.round(14 * scale)}px sans-serif`;
        const lfDate = new Date(simStartDate.getTime() + land.time * 3600000);
        const lfDateStr = `${lfDate.getFullYear()}-${String(lfDate.getMonth() + 1).padStart(2, '0')}-${String(lfDate.getDate()).padStart(2, '0')} ${String(lfDate.getHours()).padStart(2, '0')}:00`;
        const text = `登陆 #${idx + 1}: 在第 ${land.time} 小时 (${lfDateStr}) 于 [${cleanLandName(land.region)}] 登陆，中心风速 ${land.wind.toFixed(1)} m/s (${land.lat.toFixed(1)}°N, ${land.lon.toFixed(1)}°E)`;
        ctx.fillText(text, padX + 16 * scale, curY + (38 + idx * 26) * scale);
      });

      curY += landBoxH + 20 * scale;
    }

    // Subplot Charts Layout
    const plotLeft = 130 * scale;
    const plotRight = baseW - 140 * scale;
    const plotWidth = plotRight - plotLeft;
    const plotTop = curY;
    const plotBottom = baseH - 75 * scale;
    const availableH = plotBottom - plotTop;

    const activePanels: string[] = [];
    if (showWindCurve) activePanels.push("wind");
    if (showPressureCurve) activePanels.push("pressure");

    const count = activePanels.length;
    if (count > 0) {
      const panelGap = 35 * scale;
      const panelH = (availableH - panelGap * (count - 1)) / count;

      let currentTop = plotTop;
      activePanels.forEach((panelType) => {
        if (panelType === "wind") {
          drawCanvasWindPanel(ctx, plotLeft, currentTop, plotWidth, panelH, historyData, maxWind, scale);
        } else if (panelType === "pressure") {
          drawCanvasPressurePanel(ctx, plotLeft, currentTop, plotWidth, panelH, historyData, minPressure, scale);
        }
        currentTop += panelH + panelGap;
      });
    } else {
      ctx.fillStyle = "#f8fafc";
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1.5 * scale;
      ctx.beginPath();
      ctx.roundRect(plotLeft, plotTop, plotWidth, availableH, 12 * scale);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#334155";
      ctx.font = `bold ${Math.round(22 * scale)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("台风生命史数据摘要生成完毕（未勾选图表曲线）", plotLeft + plotWidth / 2, plotTop + availableH / 2);
    }

  }, [showMaxWind, showMinPressure, showDuration, showCasualtiesDisplay, showLandfallInfo, showWindCurve, showPressureCurve, resolution, aspectRatio, typhoon, landfalls]);

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
    a.download = `台风综合报告_${typhoon.name}_${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-yellow-400" />
            <h2 className="text-lg font-bold text-white tracking-tight">制作台风综合报告图 ({typhoon.name})</h2>
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
                <Sliders className="w-4 h-4 text-yellow-400" />
                显示参数勾选
              </h3>
              <div className="space-y-2.5 text-xs text-slate-300">
                <label className="flex items-center gap-2.5 cursor-pointer select-none hover:text-white">
                  <input type="checkbox" checked={showMaxWind} onChange={e => setShowMaxWind(e.target.checked)} className="accent-yellow-400 w-4 h-4" />
                  最大风速显示 (Max Wind)
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer select-none hover:text-white">
                  <input type="checkbox" checked={showMinPressure} onChange={e => setShowMinPressure(e.target.checked)} className="accent-yellow-400 w-4 h-4" />
                  最低气压显示 (Min Pressure)
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer select-none hover:text-white">
                  <input type="checkbox" checked={showDuration} onChange={e => setShowDuration(e.target.checked)} className="accent-yellow-400 w-4 h-4" />
                  持续时间 (Duration)
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer select-none hover:text-white">
                  <input type="checkbox" checked={showCasualtiesDisplay} onChange={e => setShowCasualtiesDisplay(e.target.checked)} className="accent-yellow-400 w-4 h-4" />
                  伤亡人数显示 (Casualties)
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer select-none hover:text-white">
                  <input type="checkbox" checked={showLandfallInfo} onChange={e => setShowLandfallInfo(e.target.checked)} className="accent-yellow-400 w-4 h-4" />
                  显示登陆记录 (Show Landfalls)
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer select-none hover:text-white">
                  <input type="checkbox" checked={showWindCurve} onChange={e => setShowWindCurve(e.target.checked)} className="accent-yellow-400 w-4 h-4" />
                  风速曲线 (Wind Curve)
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer select-none hover:text-white">
                  <input type="checkbox" checked={showPressureCurve} onChange={e => setShowPressureCurve(e.target.checked)} className="accent-yellow-400 w-4 h-4" />
                  气压曲线 (Pressure Curve)
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
                      ? "bg-yellow-500 border-yellow-500 text-slate-950 font-bold shadow-lg shadow-yellow-500/20"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  合成为1张图片
                </button>
                <button
                  onClick={() => setSplitExport("split")}
                  className={`py-2 rounded-lg font-semibold border transition-all cursor-pointer ${
                    splitExport === "split"
                      ? "bg-yellow-500 border-yellow-500 text-slate-950 font-bold shadow-lg shadow-yellow-500/20"
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
                        ? "bg-yellow-500 border-yellow-500 text-slate-950 font-bold shadow-lg shadow-yellow-500/20"
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
                {(["16:9", "4:3", "3:4", "1:1"] as const).map(ratio => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={`py-2 rounded-lg font-semibold border transition-all cursor-pointer ${
                      aspectRatio === ratio
                        ? "bg-yellow-500 border-yellow-500 text-slate-950 font-bold shadow-lg shadow-yellow-500/20"
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
              className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-extrabold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/25 transition-all cursor-pointer mt-4"
            >
              <Download className="w-4 h-4" />
              导出高清台风报告图
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

// Helper Canvas Panel Drawers for Typhoon Report
function drawCanvasWindPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, data: any[], maxW: number, scale: number) {
  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10 * scale);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#0f172a";
  ctx.font = `bold ${Math.round(18 * scale)}px sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("中心最大风速演变 (m/s)", x + 20 * scale, y + 16 * scale);

  const paddingTop = 50 * scale;
  const paddingBottom = 35 * scale;
  const paddingLeft = 60 * scale;
  const paddingRight = 30 * scale;

  const drawW = w - paddingLeft - paddingRight;
  const drawH = h - paddingTop - paddingBottom;
  const py = y + paddingTop;
  const px = x + paddingLeft;

  // Grid lines
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1 * scale;
  for (let i = 0; i <= 4; i++) {
    const gy = py + (drawH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(px, gy);
    ctx.lineTo(px + drawW, gy);
    ctx.stroke();

    const val = maxW - (maxW / 4) * i;
    ctx.fillStyle = "#64748b";
    ctx.font = `normal ${Math.round(13 * scale)}px sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`${val.toFixed(0)}`, px - 10 * scale, gy);
  }

  if (data.length < 2) return;

  const maxTime = data[data.length - 1].time || 1;

  ctx.strokeStyle = "#06b6d4";
  ctx.lineWidth = 3 * scale;
  ctx.beginPath();

  const subSteps = 4;
  let first = true;

  data.forEach((d1, i) => {
    if (i === data.length - 1) return;
    const d2 = data[i + 1];

    for (let k = 0; k <= subSteps; k++) {
      if (i > 0 && k === 0) continue;
      const frac = k / subSteps;
      const currTime = d1.time + (d2.time - d1.time) * frac;
      const baseWind = d1.wind + (d2.wind - d1.wind) * frac;

      const edgeFactor = Math.min(1.0, currTime / 3.0) * Math.min(1.0, (maxTime - currTime) / 3.0);
      const distToMaxWind = Math.abs(baseWind - maxW);
      const peakDampening = Math.min(1.0, Math.pow(distToMaxWind / 2.5, 1.2));
      const noise = getTurbulenceJitter(currTime * 0.25, 19) * 1.2 * edgeFactor * peakDampening;
      const jitteredWind = Math.min(maxW, Math.max(0, baseWind + noise));

      const cx = px + (currTime / maxTime) * drawW;
      const cy = py + drawH - (jitteredWind / Math.max(1, maxW * 1.1)) * drawH;

      if (first) {
        ctx.moveTo(cx, cy);
        first = false;
      } else {
        ctx.lineTo(cx, cy);
      }
    }
  });
  ctx.stroke();
}

function drawCanvasPressurePanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, data: any[], minP: number, scale: number) {
  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10 * scale);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#0f172a";
  ctx.font = `bold ${Math.round(18 * scale)}px sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("最低中心气压演变 (hPa)", x + 20 * scale, y + 16 * scale);

  const paddingTop = 50 * scale;
  const paddingBottom = 35 * scale;
  const paddingLeft = 60 * scale;
  const paddingRight = 30 * scale;

  const drawW = w - paddingLeft - paddingRight;
  const drawH = h - paddingTop - paddingBottom;
  const py = y + paddingTop;
  const px = x + paddingLeft;

  const maxP = Math.max(...data.map(d => d.pressure), 1013);
  const minPres = Math.min(...data.map(d => d.pressure), 920);

  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1 * scale;
  for (let i = 0; i <= 4; i++) {
    const gy = py + (drawH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(px, gy);
    ctx.lineTo(px + drawW, gy);
    ctx.stroke();

    const val = maxP - ((maxP - minPres) / 4) * i;
    ctx.fillStyle = "#64748b";
    ctx.font = `normal ${Math.round(13 * scale)}px sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`${val.toFixed(0)}`, px - 10 * scale, gy);
  }

  if (data.length < 2) return;
  const maxTime = data[data.length - 1].time || 1;
  const pRange = Math.max(1, maxP - minPres);

  ctx.strokeStyle = "#a855f7";
  ctx.lineWidth = 3 * scale;
  ctx.beginPath();

  const subSteps = 4;
  let first = true;

  data.forEach((d1, i) => {
    if (i === data.length - 1) return;
    const d2 = data[i + 1];

    for (let k = 0; k <= subSteps; k++) {
      if (i > 0 && k === 0) continue;
      const frac = k / subSteps;
      const currTime = d1.time + (d2.time - d1.time) * frac;
      const baseP = d1.pressure + (d2.pressure - d1.pressure) * frac;

      const edgeFactor = Math.min(1.0, currTime / 3.0) * Math.min(1.0, (maxTime - currTime) / 3.0);
      const distToMinPres = Math.abs(baseP - minPres);
      const troughDampening = Math.min(1.0, Math.pow(distToMinPres / 3.0, 1.2));
      const noise = getTurbulenceJitter(currTime * 0.25, 93) * 0.8 * edgeFactor * troughDampening;
      const jitteredP = Math.max(minPres, Math.min(1030, baseP + noise));

      const cx = px + (currTime / maxTime) * drawW;
      const cy = py + drawH - ((jitteredP - minPres) / pRange) * drawH;

      if (first) {
        ctx.moveTo(cx, cy);
        first = false;
      } else {
        ctx.lineTo(cx, cy);
      }
    }
  });
  ctx.stroke();
}
