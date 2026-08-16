import fs from 'fs';
let content = fs.readFileSync('src/components/ForecastImageModal.tsx', 'utf8');

// For drawRainForecastOnCanvas
const rainTarget = `    // Draw rain blobs
    ctx.globalAlpha = 0.85;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const rain = rainGrid[y * cols + x];
        if (rain >= 25) {
          let color = "";
          if (rain >= 250) color = "#730000"; // 特大暴雨
          else if (rain >= 100) color = "#FA00FA"; // 大暴雨
          else if (rain >= 50) color = "#0000FF"; // 暴雨
          else if (rain >= 25) color = "#61B8FF"; // 大雨
          else if (rain >= 10) color = "#38A800"; // 中雨
          else if (rain >= 0.1) color = "#A6F28F"; // 小雨
            
          if (color) {
            ctx.fillStyle = color;
            const pt1 = latLonToPixel(minLat + y * rainGridSize, minLon + x * rainGridSize);
            const pt2 = latLonToPixel(minLat + (y+1) * rainGridSize, minLon + (x+1) * rainGridSize);
            // Quick fill
            // Ensure overlap to prevent grid lines
            ctx.fillRect(pt1.x - 1, pt2.y - 1, (pt2.x - pt1.x) + 2, (pt1.y - pt2.y) + 2);
          }
        }
      }
    }
    ctx.globalAlpha = 1.0;`;

const rainReplace = `    // Draw rain blobs using offscreen canvas to avoid overlap artifacts
    const offCanvas = document.createElement("canvas");
    offCanvas.width = W; offCanvas.height = H;
    const offCtx = offCanvas.getContext("2d");
    if (offCtx) {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const rain = rainGrid[y * cols + x];
          if (rain >= 25) {
            let color = "";
            if (rain >= 250) color = "#730000"; // 特大暴雨
            else if (rain >= 100) color = "#FA00FA"; // 大暴雨
            else if (rain >= 50) color = "#0000FF"; // 暴雨
            else if (rain >= 25) color = "#61B8FF"; // 大雨
            else if (rain >= 10) color = "#38A800"; // 中雨
            else if (rain >= 0.1) color = "#A6F28F"; // 小雨
              
            if (color) {
              offCtx.fillStyle = color;
              const pt1 = latLonToPixel(minLat + y * rainGridSize, minLon + x * rainGridSize);
              const pt2 = latLonToPixel(minLat + (y+1) * rainGridSize, minLon + (x+1) * rainGridSize);
              offCtx.fillRect(pt1.x - 1, pt2.y - 1, (pt2.x - pt1.x) + 2, (pt1.y - pt2.y) + 2);
            }
          }
        }
      }
      ctx.globalAlpha = 0.85;
      ctx.drawImage(offCanvas, 0, 0);
      ctx.globalAlpha = 1.0;
    }`;
content = content.replace(rainTarget, rainReplace);

// For drawWindForecastOnCanvas
const windTarget = `    ctx.globalAlpha = 0.9;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const w = windGrid[y * cols + x];
        if (w >= 10.8) { // 6级 >= 10.8m/s
          let color = "";
          if (w >= 37.0) color = "#CC0000"; // 13级+
          else if (w >= 32.7) color = "#FF0000"; // 12
          else if (w >= 28.5) color = "#FF6666"; // 11
          else if (w >= 24.5) color = "#FF9900"; // 10
          else if (w >= 20.8) color = "#FFCC00"; // 9
          else if (w >= 17.2) color = "#0000CC"; // 8
          else if (w >= 13.9) color = "#0066FF"; // 7
          else if (w >= 10.8) color = "#00CCFF"; // 6
            
          if (color) {
            ctx.fillStyle = color;
            const pt1 = latLonToPixel(minLat + y * windGridSize, minLon + x * windGridSize);
            const pt2 = latLonToPixel(minLat + (y+1) * windGridSize, minLon + (x+1) * windGridSize);
            ctx.fillRect(pt1.x - 1, pt2.y - 1, (pt2.x - pt1.x) + 2, (pt1.y - pt2.y) + 2);
          }
        }
      }
    }
    ctx.globalAlpha = 1.0;`;

const windReplace = `    const offCanvas = document.createElement("canvas");
    offCanvas.width = W; offCanvas.height = H;
    const offCtx = offCanvas.getContext("2d");
    if (offCtx) {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const w = windGrid[y * cols + x];
          if (w >= 10.8) {
            let color = "";
            if (w >= 37.0) color = "#CC0000"; 
            else if (w >= 32.7) color = "#FF0000"; 
            else if (w >= 28.5) color = "#FF6666"; 
            else if (w >= 24.5) color = "#FF9900"; 
            else if (w >= 20.8) color = "#FFCC00"; 
            else if (w >= 17.2) color = "#0000CC"; 
            else if (w >= 13.9) color = "#0066FF"; 
            else if (w >= 10.8) color = "#00CCFF"; 
              
            if (color) {
              offCtx.fillStyle = color;
              const pt1 = latLonToPixel(minLat + y * windGridSize, minLon + x * windGridSize);
              const pt2 = latLonToPixel(minLat + (y+1) * windGridSize, minLon + (x+1) * windGridSize);
              offCtx.fillRect(pt1.x - 1, pt2.y - 1, (pt2.x - pt1.x) + 2, (pt1.y - pt2.y) + 2);
            }
          }
        }
      }
      ctx.globalAlpha = 0.9;
      ctx.drawImage(offCanvas, 0, 0);
      ctx.globalAlpha = 1.0;
    }`;
content = content.replace(windTarget, windReplace);

fs.writeFileSync('src/components/ForecastImageModal.tsx', content);
