import fs from 'fs';
let content = fs.readFileSync('src/components/VirtualJoystick.tsx', 'utf8');

const targetPointerEvents = `        onPointerDown={(e) => {
          if (!enabled) return;
          if (e.button !== 0 && e.pointerType === "mouse") return; // Left click only for mouse
          
          // Prevent browser gestures (like back/forward swipe or pull-to-refresh)
          if (e.cancelable) e.preventDefault();
          
          e.currentTarget.setPointerCapture(e.pointerId);
          setIsDragging(true);
          setActivePointerId(e.pointerId);
          updatePosition(e.clientX, e.clientY);
          e.stopPropagation();
        }}
        onPointerMove={(e) => {
          if (isDragging && e.pointerId === activePointerId) {
            if (e.cancelable) e.preventDefault();
            updatePosition(e.clientX, e.clientY);
            e.stopPropagation();
          }
        }}
        onPointerUp={(e) => {
          if (e.pointerId === activePointerId) {
            setIsDragging(false);
            setActivePointerId(null);
            e.stopPropagation();
          }
        }}
        onPointerCancel={(e) => {
          if (e.pointerId === activePointerId) {
            setIsDragging(false);
            setActivePointerId(null);
            e.stopPropagation();
          }
        }}`;

const replacePointerEvents = `        onTouchStart={(e) => {
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
        }}`;

content = content.replace(targetPointerEvents, replacePointerEvents);
fs.writeFileSync('src/components/VirtualJoystick.tsx', content);
