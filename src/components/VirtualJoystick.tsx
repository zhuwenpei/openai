/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from "react";
import { Move } from "lucide-react";

interface JoystickProps {
  dx: number;
  dy: number;
  onChange: (dx: number, dy: number, dragging?: boolean) => void;
  strength: number;
  enabled: boolean;
}

export default function VirtualJoystick({ dx, dy, onChange, strength, enabled }: JoystickProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activePointerId, setActivePointerId] = useState<number | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  // Joystick dimensions
  const diameter = 110;
  const radius = diameter / 2;
  const knobRadius = 20;
  const maxDistance = radius - knobRadius;

  const updatePosition = (clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const centerX = rect.left + radius;
    const centerY = rect.top + radius;

    let deltaX = clientX - centerX;
    let deltaY = clientY - centerY;

    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance > maxDistance) {
      const angle = Math.atan2(deltaY, deltaX);
      deltaX = Math.cos(angle) * maxDistance;
      deltaY = Math.sin(angle) * maxDistance;
    }

    setPos({ x: deltaX, y: deltaY });

    // Normalize coordinates to -1.0 to +1.0
    const normalizedDx = deltaX / maxDistance;
    const normalizedDy = -deltaY / maxDistance; // Invert Y so up is positive in geo direction
    onChange(normalizedDx, normalizedDy, true);
  };

  // Re-center on release (with smooth easing)
  useEffect(() => {
    if (!isDragging) {
      if (pos.x === 0 && pos.y === 0) return;

      let animFrame: number;
      const snapBack = () => {
        setPos((current) => {
          const snapRatio = 0.18; // snap speed
          const nextX = current.x * (1 - snapRatio);
          const nextY = current.y * (1 - snapRatio);

          if (Math.abs(nextX) < 0.5 && Math.abs(nextY) < 0.5) {
            return { x: 0, y: 0 };
          }
          return { x: nextX, y: nextY };
        });
        animFrame = requestAnimationFrame(snapBack);
      };

      animFrame = requestAnimationFrame(snapBack);
      return () => cancelAnimationFrame(animFrame);
    }
  }, [isDragging]);

  // Propagate position changes to parent
  useEffect(() => {
    const threshold = 0.005;
    const normalizedDx = pos.x / maxDistance;
    const normalizedDy = -pos.y / maxDistance;

    const isNearZero = Math.abs(normalizedDx) < threshold && Math.abs(normalizedDy) < threshold;

    if (isNearZero && !isDragging) {
      if (dx !== 0 || dy !== 0) {
        onChange(0, 0, false);
      }
      return;
    }
    
    // Only update if change is significant or we are dragging
    const currentMag = Math.sqrt(dx * dx + dy * dy);
    const newMag = Math.sqrt(normalizedDx * normalizedDx + normalizedDy * normalizedDy);
    const diff = Math.abs(currentMag - newMag);

    if (isDragging || diff > 0.002 || isNearZero) {
      onChange(normalizedDx, normalizedDy, isDragging);
    }
  }, [pos, isDragging, dx, dy, maxDistance]);

  return (
    <div className="relative">
      <div
        id="joystick-container"
        ref={containerRef}
        className={`relative rounded-full flex items-center justify-center select-none transition-all duration-200 border ${
          enabled
            ? "bg-slate-950/80 border-slate-800/80"
            : "bg-slate-950/40 border-slate-800/60 opacity-30 cursor-not-allowed"
        }`}
        style={{
          width: `${diameter}px`,
          height: `${diameter}px`,
          touchAction: "none", // Prevent standard browser scroll/gesture on the joystick
        }}
        onTouchStart={(e) => {
          if (!enabled) return;
          if (activePointerId !== null) return; // Already tracking a touch
          const touch = e.changedTouches[0];
          setIsDragging(true);
          setActivePointerId(touch.identifier);
          updatePosition(touch.clientX, touch.clientY);
          e.stopPropagation();
        }}
        onTouchMove={(e) => {
          if (!isDragging || activePointerId === null) return;
          for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === activePointerId) {
              if (e.cancelable) e.preventDefault();
              updatePosition(touch.clientX, touch.clientY);
              e.stopPropagation();
              break;
            }
          }
        }}
        onTouchEnd={(e) => {
          if (activePointerId === null) return;
          for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === activePointerId) {
              setIsDragging(false);
              setActivePointerId(null);
              e.stopPropagation();
              break;
            }
          }
        }}
        onTouchCancel={(e) => {
          if (activePointerId === null) return;
          for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === activePointerId) {
              setIsDragging(false);
              setActivePointerId(null);
              e.stopPropagation();
              break;
            }
          }
        }}
        onMouseDown={(e) => {
          if (!enabled) return;
          if (e.button !== 0) return;
          setIsDragging(true);
          setActivePointerId(-1); // Use -1 for mouse
          updatePosition(e.clientX, e.clientY);
          e.stopPropagation();
        }}
        onMouseMove={(e) => {
          if (isDragging && activePointerId === -1) {
            updatePosition(e.clientX, e.clientY);
            e.stopPropagation();
          }
        }}
        onMouseUp={(e) => {
          if (activePointerId === -1) {
            setIsDragging(false);
            setActivePointerId(null);
            e.stopPropagation();
          }
        }}
        onMouseLeave={(e) => {
          if (activePointerId === -1) {
            setIsDragging(false);
            setActivePointerId(null);
            e.stopPropagation();
          }
        }}
      >
        {/* Target Crosshairs */}
        <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
          <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-slate-800/60 -translate-x-1/2"></div>
          <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-slate-800/60 -translate-y-1/2"></div>
          {/* concentric rings */}
          <div className="absolute top-1/2 left-1/2 w-2/3 h-2/3 border border-slate-900/50 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute top-1/2 left-1/2 w-1/3 h-1/3 border border-slate-900/50 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
        </div>

        {/* Actual Joystick Drag Handle */}
        <div
          id="joystick-handle"
          className={`absolute rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg transition-shadow duration-150 pointer-events-none ${
            isDragging
              ? "bg-[#1E9CFF] shadow-[0_0_12px_rgba(30,156,255,0.6)] text-white"
              : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
          }`}
          style={{
            width: `${knobRadius * 2}px`,
            height: `${knobRadius * 2}px`,
            transform: `translate(${pos.x}px, ${pos.y}px)`,
          }}
        >
          <Move className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
