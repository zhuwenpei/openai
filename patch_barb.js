import fs from 'fs';
let content = fs.readFileSync('src/components/ForecastImageModal.tsx', 'utf8');

// We will replace drawBarb function
const target = `    const drawBarb = (x: number, y: number, speedKt: number, angleDeg: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5 * scale;
      ctx.beginPath();
      // Draw shaft
      const shaftLen = 15 * scale;
      const angleRad = angleDeg * Math.PI / 180;
      // Barb points into the wind, so tail is in the direction wind is coming from.
      // angleDeg is direction wind is blowing TOWARDS.
      // So tail is at (x,y) - shaftLen * (cos, sin)
      const ex = x - Math.cos(angleRad) * shaftLen;
      const ey = y - Math.sin(angleRad) * shaftLen;
      ctx.moveTo(x, y);
      ctx.lineTo(ex, ey);
      
      // Draw flags on tail (at ex, ey). In standard barbs, 50kt is a triangle, 10kt is full line, 5kt is half line.
      let remaining = Math.round(speedKt / 5) * 5;
      let curX = ex; let curY = ey;
      const barbSpacing = 3 * scale;
      const nx = -Math.sin(angleRad); // normal
      const ny = Math.cos(angleRad);
      
      while (remaining >= 50) {
        ctx.moveTo(curX, curY);
        ctx.lineTo(curX + nx * 10 * scale, curY + ny * 10 * scale);
        ctx.lineTo(curX + Math.cos(angleRad) * 2 * scale, curY + Math.sin(angleRad) * 2 * scale);
        ctx.fillStyle = color; ctx.fill();
        curX += Math.cos(angleRad) * barbSpacing; curY += Math.sin(angleRad) * barbSpacing;
        remaining -= 50;
      }
      while (remaining >= 10) {
        ctx.moveTo(curX, curY);
        ctx.lineTo(curX + nx * 10 * scale, curY + ny * 10 * scale);
        curX += Math.cos(angleRad) * barbSpacing; curY += Math.sin(angleRad) * barbSpacing;
        remaining -= 10;
      }
      if (remaining >= 5) {
        ctx.moveTo(curX, curY);
        ctx.lineTo(curX + nx * 5 * scale, curY + ny * 5 * scale);
      }
      ctx.stroke();
    };`;

const replace = `    const drawBarb = (x: number, y: number, speedKt: number, mathAngleRad: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5 * scale;
      ctx.beginPath();
      // Draw shaft
      const shaftLen = 15 * scale;
      
      // mathAngleRad is the direction the wind is BLOWING TOWARDS (0=East, PI/2=North)
      // The tail should be where the wind is COMING FROM (i.e. Math.PI + mathAngleRad)
      // Canvas Y is down, so Math Y = -Canvas Y
      const canvasAngle = -mathAngleRad;
      const tailAngle = canvasAngle + Math.PI;
      
      const ex = x + Math.cos(tailAngle) * shaftLen;
      const ey = y + Math.sin(tailAngle) * shaftLen;
      ctx.moveTo(x, y);
      ctx.lineTo(ex, ey);
      
      let remaining = Math.round(speedKt / 5) * 5;
      let curX = ex; let curY = ey;
      const barbSpacing = 3 * scale;
      
      // The flags should point to the LEFT of the wind vector.
      // Wind vector in canvas is (cos(canvasAngle), sin(canvasAngle))
      // Left normal is (sin(canvasAngle), -cos(canvasAngle))
      const nx = Math.sin(canvasAngle);
      const ny = -Math.cos(canvasAngle);
      
      // We step DOWN the shaft towards the head
      const stepX = Math.cos(canvasAngle) * barbSpacing;
      const stepY = Math.sin(canvasAngle) * barbSpacing;
      
      while (remaining >= 50) {
        ctx.moveTo(curX, curY);
        ctx.lineTo(curX + nx * 10 * scale, curY + ny * 10 * scale);
        ctx.lineTo(curX + stepX * 0.8, curY + stepY * 0.8);
        ctx.fillStyle = color; ctx.fill();
        curX += stepX; curY += stepY;
        remaining -= 50;
      }
      while (remaining >= 10) {
        ctx.moveTo(curX, curY);
        ctx.lineTo(curX + nx * 10 * scale, curY + ny * 10 * scale);
        curX += stepX; curY += stepY;
        remaining -= 10;
      }
      if (remaining >= 5) {
        ctx.moveTo(curX, curY);
        ctx.lineTo(curX + nx * 5 * scale, curY + ny * 5 * scale);
      }
      ctx.stroke();
    };`;

content = content.replace(target, replace);
fs.writeFileSync('src/components/ForecastImageModal.tsx', content);
