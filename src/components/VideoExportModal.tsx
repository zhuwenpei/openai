/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { X, Video, Download, Play, RefreshCw, Layers, ShieldAlert, Sparkles, Check, CheckCircle2, Film } from "lucide-react";
import { Typhoon } from "../types";
import {
  VideoExportConfig,
  RenderProgress,
  getCanvasDimensions,
  renderVideoFrameOnCanvas,
  renderWindFieldVideoFrameOnCanvas,
  generateTyphoonVideo,
  globalTileCache,
  getMercatorZoom
} from "../utils/VideoRenderEngine";

interface VideoExportModalProps {
  typhoon: Typhoon;
  startDate?: Date;
  onClose: () => void;
}

const DEFAULT_EXPORT_CONFIG: VideoExportConfig = {
  baseMap: "dark",
  forecastHours: 24,
  showCoastline: false,
  rasterResolution: "high",
  showGrid: false,
  showForecast: true,
  showUncertaintyCone: true,
  showWindRadii: true,
  showStations: false,
  stationSizeScale: 0.8,
  fps: 30,
  endAction: "none",
  dotInterval: 3,
  showDataLabel: true,
  labelContent: "all",
  showStatus: true,
  showDateTime: true,
  dateTimeFormat: "relative",
  showCasualties: false,
  labelSize: "medium",
  labelPosition: "top-right",
  centerFollow: true,
  zoomLevel: 3,
  aspectRatio: "16:9",
  videoResolution: "1080p",
  videoCodec: "H.264",
  animSpeed: 2
};

const CONFIG_STORAGE_KEY = "typhoon_video_export_config_v2";

function getSavedExportConfig(): VideoExportConfig {
  try {
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_EXPORT_CONFIG, ...parsed };
    }
  } catch {
    // ignore
  }
  return DEFAULT_EXPORT_CONFIG;
}

export default function VideoExportModal({ typhoon, startDate, onClose }: VideoExportModalProps) {
  const [config, setConfig] = useState<VideoExportConfig>(getSavedExportConfig);
  const effectiveStartDate = startDate || (localStorage.getItem("typhoon_sim_start_date") ? new Date(localStorage.getItem("typhoon_sim_start_date")!) : new Date("2026-07-21T00:00:00"));
  
  // Automatically save export parameters whenever config changes
  useEffect(() => {
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch {
      // ignore
    }
  }, [config]);
  
  // Timeline slider for live previewing a frame
  const history = typhoon.history || [];
  const minHour = history.length > 0 ? history[0].simHour : 0;
  const maxHour = history.length > 0 ? history[history.length - 1].simHour : 0;
  const peakHour = history.length > 0
    ? history.reduce((prev, curr) => (curr.vmax > prev.vmax ? curr : prev), history[0]).simHour
    : 0;

  const [previewHour, setPreviewHour] = useState<number>(peakHour);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Generation state
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState<RenderProgress | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Re-render live preview frame whenever parameters or previewHour change
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Use exact canvas dimensions matching config.videoResolution so zoom and framing are identical
    const { width, height } = getCanvasDimensions(config.aspectRatio, config.videoResolution);
    canvas.width = width;
    canvas.height = height;

    if (config.mode === "windfield") {
      renderWindFieldVideoFrameOnCanvas(ctx, width, height, typhoon, previewHour, config);
    } else {
      renderVideoFrameOnCanvas(ctx, width, height, typhoon, previewHour, config);
    }
  }, [config, previewHour, typhoon]);

  // Preload base map tiles when baseMap or zoomLevel changes for instant live preview
  useEffect(() => {
    if (config.baseMap === "none") return;
    const { width } = getCanvasDimensions(config.aspectRatio, config.videoResolution);
    const zoom = getMercatorZoom(config.zoomLevel, width);
    const tileZoom = Math.floor(zoom);

    let sumLat = 0;
    let sumLon = 0;
    history.forEach((h) => {
      sumLat += h.lat;
      sumLon += h.lon;
    });
    const avgLat = sumLat / Math.max(1, history.length);
    const avgLon = sumLon / Math.max(1, history.length);

    const worldSize = 256 * Math.pow(2, tileZoom);
    const cx = ((avgLon + 180) / 360) * worldSize;
    const centerLatRad = (avgLat * Math.PI) / 180;
    const cy = (1 - Math.log(Math.tan(centerLatRad) + 1 / Math.cos(centerLatRad)) / Math.PI) * (worldSize / 2);

    for (let tx = Math.floor(cx / 256) - 2; tx <= Math.ceil(cx / 256) + 2; tx++) {
      for (let ty = Math.floor(cy / 256) - 2; ty <= Math.ceil(cy / 256) + 2; ty++) {
        const url = globalTileCache.getTileUrl(config.baseMap, tileZoom, tx, ty);
        globalTileCache.loadTile(url).catch(() => {});
      }
    }
  }, [config.baseMap, config.zoomLevel]);

  // Handle video generation
  const handleStartRender = async () => {
    setIsRendering(true);
    setErrorMessage(null);
    setRenderProgress({
      percentage: 0,
      currentFrame: 0,
      totalFrames: 100,
      statusText: "准备渲染器..."
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const blob = await generateTyphoonVideo(
        typhoon,
        { ...config, startDate: effectiveStartDate },
        (prog) => setRenderProgress(prog),
        controller.signal
      );

      const url = URL.createObjectURL(blob);
      setGeneratedVideoUrl(url);
      setIsRendering(false);
    } catch (err: any) {
      if (err.message !== "Video rendering cancelled by user") {
        setErrorMessage(err.message || "视频生成过程中发生异常，请重试");
      }
      setIsRendering(false);
    }
  };

  const handleCancelRender = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsRendering(false);
    setRenderProgress(null);
  };

  const isWindFieldMode = config.mode === "windfield";
  const showPreview = !isWindFieldMode || !!generatedVideoUrl;

  return (
    <div className="fixed inset-0 z-[100000] bg-slate-950/98 text-slate-100 flex flex-col overflow-hidden animate-[fadeIn_0.2s_ease-out]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              台风模拟视频渲染与导出
              <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-blue-500/20 text-sky-300 border border-blue-500/30">
                {typhoon.name} ({maxHour}小时轨迹)
              </span>
            </h2>
            <p className="text-xs text-slate-400">配置视频导出参数，自定义动画时长、帧率、底图及图层效果。</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
        >
          <X size={20} />
        </button>
      </div>

      {/* Mode Selector Tabs */}
      <div className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 border-b border-slate-800 shrink-0 overflow-x-auto">
        <button
          onClick={() => setConfig({ ...config, mode: "trajectory" })}
          className={`px-4 py-2 shrink-0 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            (config.mode || "trajectory") === "trajectory"
              ? "bg-[#1E9CFF] text-white shadow-lg shadow-[#1E9CFF]/20"
              : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-white"
          }`}
        >
          <Video className="w-4 h-4" />
          台风轨迹复盘视频
        </button>

        <button
          onClick={() => setConfig({ ...config, mode: "windfield" })}
          className={`px-4 py-2 shrink-0 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            config.mode === "windfield"
              ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
              : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-white"
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-200" />
          卫星风场图 (HSCAT) 动态复盘视频
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        
        {/* Left Column: Live Preview & Canvas Screen */}
        {showPreview && (
          <div className="lg:col-span-8 bg-slate-950 p-4 sm:p-6 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800/80 overflow-y-auto">
            
            <div className="flex flex-col h-full justify-center items-center">
              <div className="w-full max-w-4xl flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Film className="w-4 h-4 text-blue-400" />
                  实时画面预览 (支持拉动进度轴切帧)
                </span>
                <span className="text-xs font-mono text-blue-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
                  比例 {config.aspectRatio} | 缩放 档位{config.zoomLevel} | 第 {Math.round(previewHour)} 小时
                </span>
              </div>

              {/* Video Player or Live Preview Canvas */}
              <div className="flex-1 w-full flex items-center justify-center min-h-0 p-2">
                <div 
                  className="relative bg-[#07111F] rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex items-center justify-center transition-all duration-200"
                  style={{
                    aspectRatio: config.aspectRatio.replace(":", "/"),
                    height: "100%",
                    maxHeight: "calc(85vh - 200px)",
                    width: "auto"
                  }}
                >
                  {generatedVideoUrl ? (
                    <video
                      src={generatedVideoUrl}
                      controls
                      autoPlay
                      loop
                      className="h-full w-auto object-contain"
                    />
                  ) : (
                    <canvas
                      ref={previewCanvasRef}
                      className="h-full w-auto object-contain"
                    />
                  )}

                  {/* Status Badge inside Canvas */}
                  {!generatedVideoUrl && (
                    <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/70 backdrop-blur-md rounded-md border border-slate-700/60 text-[10px] font-mono text-slate-300 z-10">
                      实时效果预览
                    </div>
                  )}
                </div>
              </div>

              {/* Preview Frame Scrubbing Slider */}
              {!generatedVideoUrl && (
                <div className="w-full max-w-4xl mt-3 bg-slate-900/80 border border-slate-800 p-3 rounded-xl flex items-center gap-4">
                  <span className="text-xs font-semibold text-slate-400 shrink-0">预览时间轴:</span>
                  <input
                    type="range"
                    min={minHour}
                    max={maxHour}
                    step={1}
                    value={previewHour}
                    onChange={(e) => setPreviewHour(Number(e.target.value))}
                    className="flex-1 accent-sky-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                  />
                  <span className="text-xs font-mono text-white shrink-0 font-bold">{Math.round(previewHour)} h</span>
                </div>
              )}
            </div>

          </div>
        )}

        {/* Right Column: Detailed Parameter Options */}
        <div className={`${showPreview ? "lg:col-span-4" : "lg:col-span-12 max-w-3xl mx-auto w-full"} p-5 sm:p-6 overflow-y-auto space-y-6 bg-slate-900/60`}>
          
          {config.mode === "windfield" ? (
            /* Wind Field (HSCAT) Parameter Panel */
            <div className="space-y-5">
              <h3 className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
                <Sparkles className="w-4 h-4 text-amber-300" />
                卫星风场图 (HSCAT) 参数配置
              </h3>

              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1">
                <p className="font-semibold">参数已自动同步</p>
                <p className="leading-relaxed opacity-85">
                  单帧风场图制作参数已全部同步“风场实况扫描图图片制作”中的最新调节，不允许单独修改。
                </p>
              </div>

              {/* 5. 画面比例 */}
              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">画面比例</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {["16:9", "4:3", "3:4", "1:1", "9:16"].map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => setConfig({ ...config, aspectRatio: ratio as any })}
                      className={`py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                        config.aspectRatio === ratio
                          ? "bg-orange-500/20 border-amber-400 text-amber-300 shadow-md"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              {/* 6. 画质 */}
              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">画质分辨率</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: "720p", label: "720p (高清)" },
                    { id: "1080p", label: "1080p (全高清)" },
                    { id: "2K", label: "2K (2.5K 极清)" },
                    { id: "4K", label: "4K (超清全尺寸)" }
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setConfig({
                          ...config,
                          videoResolution: item.id as any
                        });
                      }}
                      className={`py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                        config.videoResolution === item.id
                          ? "bg-orange-500/20 border-amber-400 text-amber-300 shadow-md"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="mt-3">
                  <label className="text-xs text-slate-400 block mb-1.5 font-medium">视频编码格式 (HEVC / AVC)</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: "H.264", label: "H.264 (兼容/AVC)" },
                      { id: "H.265", label: "H.265 (高效/HEVC)" }
                    ].map((codecItem) => (
                      <button
                        key={codecItem.id}
                        onClick={() => setConfig({ ...config, videoCodec: codecItem.id as any })}
                        className={`py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                          (config.videoCodec || "H.264") === codecItem.id
                            ? "bg-orange-500/20 border-amber-400 text-amber-300 shadow-md"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {codecItem.label}
                      </button>
                    ))}
                  </div>
                  {config.videoResolution === "4K" && config.videoCodec === "H.264" && (
                    <p className="text-[10px] text-orange-400 mt-1.5 flex items-start gap-1 animate-[fadeIn_0.15s_ease-out] bg-amber-500/5 p-1.5 rounded-lg border border-amber-500/20">
                      <ShieldAlert className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>4K 模式使用 H.264 时，将自动启用 Level 5.2 规范并微调尺寸以确保硬件编码兼容性。</span>
                    </p>
                  )}
                </div>

                {/* 视频码率 */}
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-300">
                    <span>视频码率 (Bitrate)</span>
                    <span className="text-orange-400 font-mono font-bold">
                      {config.bitrate ? (config.bitrate / 1000000).toFixed(1) : "自动"} Mbps
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={120000000}
                    step={2000000}
                    value={config.bitrate || 0}
                    onChange={(e) => setConfig({ ...config, bitrate: Number(e.target.value) || undefined })}
                    className="w-full accent-amber-400 h-1.5 bg-slate-950 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono px-1">
                    <span>自动</span>
                    <span>60M</span>
                    <span>120M</span>
                  </div>
                </div>
              </div>

              {/* 7. 动画时长 (2-30秒) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium text-slate-300">
                  <span>动画时长 (2 - 30 秒)</span>
                  <span className="text-orange-400 font-mono font-bold">{config.durationSec || 10} 秒</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={30}
                  step={1}
                  value={config.durationSec || 10}
                  onChange={(e) => setConfig({ ...config, durationSec: Number(e.target.value) })}
                  className="w-full accent-amber-400 h-1.5 bg-slate-950 rounded-lg cursor-pointer"
                />
              </div>

              {/* 8. 帧率 (1-60fps) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium text-slate-300">
                  <span>动画帧率 (1 - 60 FPS)</span>
                  <span className="text-orange-400 font-mono font-bold">{config.fps || 30} FPS</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={60}
                  step={1}
                  value={config.fps || 30}
                  onChange={(e) => setConfig({ ...config, fps: Number(e.target.value) })}
                  className="w-full accent-amber-400 h-1.5 bg-slate-950 rounded-lg cursor-pointer"
                />
              </div>

              {/* 9. 日期显示位置 */}
              <div>
                <label className="text-xs text-slate-400 block mb-1 font-medium">日期显示位置</label>
                <select
                  value={config.dateTimePosition || "inside"}
                  onChange={(e) => setConfig({ ...config, dateTimePosition: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 cursor-pointer font-medium"
                >
                  <option value="inside">在信息框内部显示</option>
                  <option value="top-left">四个角: 画面左上角</option>
                  <option value="top-right">四个角: 画面右上角</option>
                  <option value="bottom-left">四个角: 画面左下角</option>
                  <option value="bottom-right">四个角: 画面右下角</option>
                </select>
              </div>
            </div>
          ) : (
            <>
              {/* Section 1: 地图与视角 */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <Layers className="w-4 h-4" />
              地图样式与视角配置
            </h3>

            {/* 底图样式 */}
            <div>
              <label className="text-xs text-slate-400 block mb-1.5 font-medium">底图风格</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: "dark", label: "暗黑" },
                  { id: "satellite", label: "卫星" },
                  { id: "terrain", label: "地形" },
                  { id: "light", label: "高亮" },
                  { id: "googleSatellite", label: "谷歌卫星" },
                  { id: "googleStreet", label: "谷歌街道" },
                  { id: "blueMarble", label: "蓝色弹珠" },
                  { id: "none", label: "无" }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setConfig({ ...config, baseMap: item.id as any })}
                    className={`py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      config.baseMap === item.id
                        ? "bg-blue-500/20 border-sky-400 text-sky-300 shadow-md"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 地图缩放档位 */}
            <div>
              <label className="text-xs text-slate-400 block mb-1.5 font-medium">固定地图缩放档位 (5个档位)</label>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { level: 1, label: "1 (远景)" },
                  { level: 2, label: "2 (区域)" },
                  { level: 3, label: "3 (标准)" },
                  { level: 4, label: "4 (细节)" },
                  { level: 5, label: "5 (特写)" }
                ].map((item) => (
                  <button
                    key={item.level}
                    onClick={() => setConfig({ ...config, zoomLevel: item.level })}
                    className={`py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      config.zoomLevel === item.level
                        ? "bg-blue-500/20 border-sky-400 text-sky-300 shadow-md"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 海岸线叠加 & 中心跟随 & 经纬度网格 */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <label className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <span className="text-[11px] font-medium text-slate-300">海岸线叠加</span>
                <input
                  type="checkbox"
                  checked={config.showCoastline}
                  onChange={(e) => setConfig({ ...config, showCoastline: e.target.checked })}
                  className="w-3.5 h-3.5 accent-sky-400 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <span className="text-[11px] font-medium text-slate-300">中心跟随</span>
                <input
                  type="checkbox"
                  checked={config.centerFollow}
                  onChange={(e) => setConfig({ ...config, centerFollow: e.target.checked })}
                  className="w-3.5 h-3.5 accent-sky-400 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <span className="text-[11px] font-medium text-slate-300">经纬网格</span>
                <input
                  type="checkbox"
                  checked={config.showGrid}
                  onChange={(e) => setConfig({ ...config, showGrid: e.target.checked })}
                  className="w-3.5 h-3.5 accent-sky-400 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Section 2: 气象图层与路径打点 */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <Sparkles className="w-4 h-4" />
              气象数据与图层叠加
            </h3>

            {/* 预报路线 & 不确定性锥 & 风圈 */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                  <span className="text-xs font-medium text-slate-300">预测路线图层</span>
                  <input
                    type="checkbox"
                    checked={config.showForecast}
                    onChange={(e) => setConfig({ ...config, showForecast: e.target.checked })}
                    className="w-4 h-4 accent-sky-400 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                  <span className="text-xs font-medium text-slate-300">3层4象限风圈</span>
                  <input
                    type="checkbox"
                    checked={config.showWindRadii}
                    onChange={(e) => setConfig({ ...config, showWindRadii: e.target.checked })}
                    className="w-4 h-4 accent-sky-400 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                  <span className="text-xs font-medium text-slate-300">叠加气象站点</span>
                  <input
                    type="checkbox"
                    checked={config.showStations}
                    onChange={(e) => setConfig({ ...config, showStations: e.target.checked })}
                    className="w-4 h-4 accent-sky-400 cursor-pointer"
                  />
                </label>
              </div>

              {/* 帧率与站点大小 */}
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 uppercase tracking-wider ml-1">
                    <span>视频帧率</span>
                    <span className="text-blue-400 font-mono font-bold text-xs">{config.fps || 30} FPS</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={60}
                    step={1}
                    value={config.fps || 30}
                    onChange={(e) => setConfig({ ...config, fps: Number(e.target.value) })}
                    className="w-full accent-sky-400 h-1.5 bg-slate-950 rounded-lg cursor-pointer mt-2"
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider ml-1">站点大小 ({config.stationSizeScale?.toFixed(1)})</span>
                  <input
                    type="range"
                    min="0.3"
                    max="1.5"
                    step="0.1"
                    value={config.stationSizeScale}
                    onChange={(e) => setConfig({ ...config, stationSizeScale: parseFloat(e.target.value) })}
                    className="w-full accent-sky-400 mt-2"
                  />
                </div>
              </div>

              {/* 结束后动作 */}
              <div className="space-y-1.5 mt-3">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider ml-1">结束后动作 (2秒)</span>
                <div className="flex gap-2">
                  {(["none", "pause", "report"] as const).map((action) => (
                    <button
                      key={action}
                      onClick={() => setConfig({ ...config, endAction: action })}
                      className={`flex-1 py-2 text-[10px] font-medium rounded-lg border transition-all ${
                        config.endAction === action
                          ? "bg-blue-500/10 border-sky-500/50 text-blue-400"
                          : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700"
                      }`}
                    >
                      {action === "none" ? "无停顿" : action === "pause" ? "末帧停顿" : "显示报告"}
                    </button>
                  ))}
                </div>
              </div>

              {/* 可选叠加不确定性锥 (概率圈) */}
              {config.showForecast && (
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 cursor-pointer animate-[fadeIn_0.15s_ease-out]">
                  <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    叠加预测不确定性锥 (概率圆/概率圈)
                  </span>
                  <input
                    type="checkbox"
                    checked={config.showUncertaintyCone}
                    onChange={(e) => setConfig({ ...config, showUncertaintyCone: e.target.checked })}
                    className="w-4 h-4 accent-amber-400 cursor-pointer"
                  />
                </label>
              )}
            </div>

            {/* 路径打点间隔 */}
            <div>
              <label className="text-xs text-slate-400 block mb-1.5 font-medium">路径打点间隔</label>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { interval: 1, label: "1小时" },
                  { interval: 3, label: "3小时" },
                  { interval: 6, label: "6小时" },
                  { interval: 12, label: "12小时" },
                  { interval: 0, label: "不显示" }
                ].map((item) => (
                  <button
                    key={item.interval}
                    onClick={() => setConfig({ ...config, dotInterval: item.interval })}
                    className={`py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      config.dotInterval === item.interval
                        ? "bg-orange-500/20 border-amber-400 text-amber-300 shadow-md"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 数据标注配置 */}
            <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">数据标注 HUD</span>
                <input
                  type="checkbox"
                  checked={config.showDataLabel}
                  onChange={(e) => setConfig({ ...config, showDataLabel: e.target.checked })}
                  className="w-4 h-4 accent-sky-400 cursor-pointer"
                />
              </div>

              {config.showDataLabel && (
                <div className="space-y-2 pt-1 border-t border-slate-800/80">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">标注内容</label>
                      <select
                        value={config.labelContent}
                        onChange={(e) => setConfig({ ...config, labelContent: e.target.value as any })}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-slate-200 cursor-pointer"
                      >
                        <option value="all">气压与风力 (全部)</option>
                        <option value="pressure">仅气压 (hPa)</option>
                        <option value="windSpeed">仅风力 (m/s)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">标注位置</label>
                      <select
                        value={config.labelPosition}
                        onChange={(e) => setConfig({ ...config, labelPosition: e.target.value as any })}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-slate-200 cursor-pointer"
                      >
                        <option value="top-right">右上角</option>
                        <option value="top-left">左上角</option>
                        <option value="bottom-right">右下角</option>
                        <option value="bottom-left">左下角</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                    <span className="text-[11px] font-medium text-purple-300 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                      显示台风物理状态 (如眼墙置换/爆发增强/冷水上翻/已登陆等)
                    </span>
                    <input
                      type="checkbox"
                      checked={config.showStatus}
                      onChange={(e) => setConfig({ ...config, showStatus: e.target.checked })}
                      className="w-3.5 h-3.5 accent-purple-400 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                    <span className="text-[11px] font-medium text-rose-300 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                      显示估计伤亡人数信息
                    </span>
                    <input
                      type="checkbox"
                      checked={config.showCasualties}
                      onChange={(e) => setConfig({ ...config, showCasualties: e.target.checked })}
                      className="w-3.5 h-3.5 accent-rose-400 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                    <span className="text-[11px] font-medium text-sky-300 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                      显示时间与日期标注 (h)
                    </span>
                    <input
                      type="checkbox"
                      checked={config.showDateTime}
                      onChange={(e) => setConfig({ ...config, showDateTime: e.target.checked })}
                      className="w-3.5 h-3.5 accent-sky-400 cursor-pointer"
                    />
                  </div>

                  {config.showDateTime && (
                    <div className="space-y-1.5 pt-1 border-t border-slate-800/40 pl-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfig({ ...config, dateTimeFormat: "relative" })}
                          className={`flex-1 py-1 text-[10px] font-semibold rounded border transition-all ${
                            config.dateTimeFormat === "relative" 
                              ? "bg-blue-500/20 border-sky-400 text-sky-300" 
                              : "bg-slate-900 border-slate-800 text-slate-400"
                          }`}
                        >
                          相对小时
                        </button>
                        <button
                          onClick={() => setConfig({ ...config, dateTimeFormat: "calendar" })}
                          className={`flex-1 py-1 text-[10px] font-semibold rounded border transition-all ${
                            config.dateTimeFormat === "calendar" 
                              ? "bg-blue-500/20 border-sky-400 text-sky-300" 
                              : "bg-slate-900 border-slate-800 text-slate-400"
                          }`}
                        >
                          真实日期
                        </button>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1 font-medium">日期显示位置</label>
                        <select
                          value={config.dateTimePosition || "inside"}
                          onChange={(e) => setConfig({ ...config, dateTimePosition: e.target.value as any })}
                          className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-slate-200 cursor-pointer font-medium"
                        >
                          <option value="inside">在信息框内部显示</option>
                          <option value="top-left">四个角: 画面左上角</option>
                          <option value="top-right">四个角: 画面右上角</option>
                          <option value="bottom-left">四个角: 画面左下角</option>
                          <option value="bottom-right">四个角: 画面右下角</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">数据显示大小 (实时预览)</label>
                    <div className="grid grid-cols-4 gap-1">
                      {[
                        { id: "small", label: "小" },
                        { id: "medium", label: "中" },
                        { id: "large", label: "大" },
                        { id: "extraLarge", label: "特大" }
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setConfig({ ...config, labelSize: item.id as any })}
                          className={`py-1 text-xs font-semibold rounded border transition-all cursor-pointer ${
                            config.labelSize === item.id
                              ? "bg-blue-500/20 border-sky-400 text-sky-300 shadow-sm"
                              : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: 画质、比例与倍速 */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <Film className="w-4 h-4" />
              视频参数与倍速设置
            </h3>

            {/* 画面比例 */}
            <div>
              <label className="text-xs text-slate-400 block mb-1.5 font-medium">画面比例</label>
              <div className="grid grid-cols-5 gap-1.5">
                {["16:9", "4:3", "3:4", "1:1", "9:16"].map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setConfig({ ...config, aspectRatio: ratio as any })}
                    className={`py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      config.aspectRatio === ratio
                        ? "bg-teal-500/20 border-emerald-400 text-emerald-300 shadow-md"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            {/* 画质分辨率 */}
            <div>
              <label className="text-xs text-slate-400 block mb-1.5 font-medium">画质分辨率</label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: "720p", label: "720p (高清)" },
                  { id: "1080p", label: "1080p (全高清)" },
                  { id: "2K", label: "2K (2.5K 极清)" },
                  { id: "4K", label: "4K (超清全尺寸)" }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setConfig({
                        ...config,
                        videoResolution: item.id as any
                      });
                    }}
                    className={`py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      config.videoResolution === item.id
                        ? "bg-teal-500/20 border-emerald-400 text-emerald-300 shadow-md"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="mt-3">
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">视频编码格式 (HEVC / AVC)</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: "H.264", label: "H.264 (兼容/AVC)" },
                    { id: "H.265", label: "H.265 (高效/HEVC)" }
                  ].map((codecItem) => (
                    <button
                      key={codecItem.id}
                      onClick={() => setConfig({ ...config, videoCodec: codecItem.id as any })}
                      className={`py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                        (config.videoCodec || "H.264") === codecItem.id
                          ? "bg-teal-500/20 border-emerald-400 text-emerald-300 shadow-md"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
                      }`}
                    >
                      {codecItem.label}
                    </button>
                  ))}
                </div>
                {config.videoResolution === "4K" && config.videoCodec === "H.264" && (
                  <p className="text-[10px] text-teal-400 mt-1.5 flex items-start gap-1 animate-[fadeIn_0.15s_ease-out] bg-emerald-500/5 p-1.5 rounded-lg border border-emerald-500/20">
                    <ShieldAlert className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>4K 模式使用 H.264 时，将自动启用 Level 5.2 规范并微调尺寸以确保硬件编码兼容性。</span>
                  </p>
                )}
              </div>

              {/* 视频码率 */}
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium text-slate-300">
                  <span>视频码率 (Bitrate)</span>
                  <span className="text-teal-400 font-mono font-bold">
                    {config.bitrate ? (config.bitrate / 1000000).toFixed(1) : "自动"} Mbps
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={120000000}
                  step={2000000}
                  value={config.bitrate || 0}
                  onChange={(e) => setConfig({ ...config, bitrate: Number(e.target.value) || undefined })}
                  className="w-full accent-emerald-500 h-1.5 bg-slate-950 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-slate-500 font-mono px-1">
                  <span>自动</span>
                  <span>60M</span>
                  <span>120M</span>
                </div>
              </div>
            </div>

            {/* 动画时长 (2-30秒) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium text-slate-300">
                <span>动画时长 (2 - 30 秒)</span>
                <span className="text-teal-400 font-mono font-bold">{config.durationSec || 10} 秒</span>
              </div>
              <input
                type="range"
                min={2}
                max={30}
                step={1}
                value={config.durationSec || 10}
                onChange={(e) => setConfig({ ...config, durationSec: Number(e.target.value) })}
                className="w-full accent-emerald-500 h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer border border-slate-800"
              />
            </div>

            {/* 动画帧率 (1-60fps) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium text-slate-300">
                <span>动画帧率 (1 - 60 FPS)</span>
                <span className="text-teal-400 font-mono font-bold">{config.fps || 30} FPS</span>
              </div>
              <input
                type="range"
                min={1}
                max={60}
                step={1}
                value={config.fps || 30}
                onChange={(e) => setConfig({ ...config, fps: Number(e.target.value) })}
                className="w-full accent-emerald-500 h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer border border-slate-800"
              />
            </div>
          </div>
          </>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              取消
            </button>

            {generatedVideoUrl ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setGeneratedVideoUrl(null)}
                  className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  重新配置
                </button>
                <a
                  href={generatedVideoUrl}
                  download={`台风_${typhoon.name}_模拟动画视频.mp4`}
                  className="px-5 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg transition-all cursor-pointer shadow-lg flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  下载视频文件
                </a>
              </div>
            ) : (
              <button
                onClick={handleStartRender}
                disabled={isRendering}
                className="px-6 py-2.5 text-xs font-bold bg-[#1E9CFF] hover:bg-[#1E9CFF]/85 text-white rounded-lg transition-all cursor-pointer shadow-lg shadow-sky-500/20 flex items-center gap-2 disabled:opacity-50"
              >
                <Video className="w-4 h-4" />
                开始生成视频
              </button>
            )}
          </div>

        </div>

      </div>

      {/* Rendering Progress Modal Overlay */}
      {isRendering && renderProgress && (
        <div className="fixed inset-0 z-[110000] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-2xl w-full max-w-md shadow-2xl flex flex-col items-center text-center space-y-5 animate-[scaleUp_0.2s_ease-out]">
            
            <div className="relative flex items-center justify-center">
              {/* Outer pulsing ring */}
              <div className="w-20 h-20 rounded-full border-4 border-sky-500/20 border-t-sky-400 animate-spin" />
              <Film className="w-8 h-8 text-blue-400 absolute" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white mb-1">正在生成台风模拟动画视频</h3>
              <p className="text-xs text-slate-400 font-mono">{renderProgress.statusText}</p>
            </div>

            {/* Progress Bar */}
            <div className="w-full space-y-2">
              <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 rounded-full transition-all duration-150"
                  style={{ width: `${renderProgress.percentage}%` }}
                />
              </div>

              <div className="flex justify-between text-xs font-mono text-slate-400">
                <span>{renderProgress.currentFrame} / {renderProgress.totalFrames} 帧</span>
                <span className="text-blue-400 font-bold">{renderProgress.percentage}%</span>
              </div>
            </div>

            {/* Cancel Button */}
            <button
              onClick={handleCancelRender}
              className="px-5 py-2 text-xs font-semibold text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-slate-800 cursor-pointer"
            >
              中断并取消生成
            </button>

          </div>
        </div>
      )}

    </div>
  );
}
