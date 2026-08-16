/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getLoaderState, subscribeLoaderState, GeoJsonLoaderState } from "../simulation/NaturalEarthLoader";

export default function GeoJsonStatusBadge() {
  const [state, setState] = useState<GeoJsonLoaderState>(getLoaderState());

  useEffect(() => {
    return subscribeLoaderState(setState);
  }, []);

  if (state.status === "idle" || state.status === "success") {
    return null;
  }

  return (
    <div
      id="geojson-status-badge"
      className={`fixed top-14 left-1/2 -translate-x-1/2 z-[990] flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium backdrop-blur-md shadow-lg border transition-all duration-300 pointer-events-none ${
        state.status === "loading"
          ? "bg-[#081220]/80 text-cyan-300 border-cyan-500/40"
          : "bg-amber-950/80 text-amber-300 border-amber-500/40"
      }`}
    >
      {state.status === "loading" ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
          <span>{state.message || "正在加载海岸线数据..."}</span>
        </>
      ) : (
        <>
          <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          <span>{state.message || "海岸线数据加载失败，登陆检测暂不可用"}</span>
        </>
      )}
    </div>
  );
}
