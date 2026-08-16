/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from "react";
import { Info, CheckCircle2, AlertTriangle, AlertOctagon, X } from "lucide-react";

export interface ToastMessage {
  id: string;
  message: string;
  type: "info" | "success" | "warning" | "danger";
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export default function Toast({ toasts, onDismiss }: ToastProps) {
  useEffect(() => {
    if (toasts.length > 0) {
      const lastToast = toasts[toasts.length - 1];
      const timer = setTimeout(() => {
        onDismiss(lastToast.id);
      }, 3500); // 3.5 seconds
      return () => clearTimeout(timer);
    }
  }, [toasts, onDismiss]);

  if (toasts.length === 0) return null;

  // Render top 2 toasts to avoid screen clutter
  const visibleToasts = toasts.slice(-2);

  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-[#45D483] shrink-0" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-[#F6D34A] shrink-0" />;
      case "danger":
        return <AlertOctagon className="w-4 h-4 text-[#FF4D4F] shrink-0" />;
      case "info":
      default:
        return <Info className="w-4 h-4 text-[#1E9CFF] shrink-0" />;
    }
  };

  const getBorderColor = (type: string) => {
    switch (type) {
      case "success":
        return "border-[#45D483]/20 shadow-[0_4px_20px_rgba(69,212,131,0.15)]";
      case "warning":
        return "border-[#F6D34A]/20 shadow-[0_4px_20px_rgba(246,211,74,0.15)]";
      case "danger":
        return "border-[#FF4D4F]/20 shadow-[0_4px_20px_rgba(255,77,79,0.15)]";
      case "info":
      default:
        return "border-[#1E9CFF]/25 shadow-[0_4px_20px_rgba(30,156,255,0.15)]";
    }
  };

  return (
    <div
      id="toast-stack"
      className="fixed bottom-[110px] md:bottom-[115px] left-1/2 -translate-x-1/2 z-[2000] flex flex-col gap-2 w-[90%] max-w-[500px] pointer-events-none"
    >
      {visibleToasts.map((t) => (
        <div
          key={t.id}
          id={`toast-${t.id}`}
          className={`pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-full bg-[#08121f]/96 border backdrop-blur-md text-slate-100 text-xs font-medium animate-[fadeSlideIn_0.22s_ease-out] ${getBorderColor(
            t.type
          )}`}
        >
          {getIcon(t.type)}
          <div className="flex-1 text-left leading-relaxed">{t.message}</div>
          <button
            id={`btn-dismiss-toast-${t.id}`}
            onClick={() => onDismiss(t.id)}
            className="text-slate-500 hover:text-slate-300 transition cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
