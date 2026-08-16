import fs from 'fs';
let content = fs.readFileSync('src/components/ForecastImageModal.tsx', 'utf8');

content = content.replace(
  'drawBarb(pt.x, pt.y, w, (windDirRad * 180 / Math.PI + 360) % 360, getColorForKt(w));',
  'drawBarb(pt.x, pt.y, w, windDirRad, getColorForKt(w));'
);

// We should also replace CMA precipitation colors in drawRainForecastOnCanvas
const oldColors = `          if (rain >= 400) color = "#FFA500";
          else if (rain >= 250) color = "#800000";
          else if (rain >= 100) color = "#FF00FF";
          else if (rain >= 50) color = "#0000FF";
          else if (rain >= 25) color = "#87CEEB";`;

const newColors = `          if (rain >= 250) color = "#730000"; // 特大暴雨
          else if (rain >= 100) color = "#FA00FA"; // 大暴雨
          else if (rain >= 50) color = "#0000FF"; // 暴雨
          else if (rain >= 25) color = "#61B8FF"; // 大雨
          else if (rain >= 10) color = "#38A800"; // 中雨
          else if (rain >= 0.1) color = "#A6F28F"; // 小雨`;

content = content.replace(oldColors, newColors);

const oldLegend = `    const items = [
      { c: "#87CEEB", l: "大雨 (25-49.9毫米)" },
      { c: "#0000FF", l: "暴雨 (50-99.9毫米)" },
      { c: "#FF00FF", l: "大暴雨 (100-249.9毫米)" },
      { c: "#800000", l: "特大暴雨 (250-399.9毫米)" },
      { c: "#FFA500", l: "特大暴雨 (400-450毫米)" }
    ];`;

const newLegend = `    const items = [
      { c: "#A6F28F", l: "小雨 (0.1-9.9毫米)" },
      { c: "#38A800", l: "中雨 (10-24.9毫米)" },
      { c: "#61B8FF", l: "大雨 (25-49.9毫米)" },
      { c: "#0000FF", l: "暴雨 (50-99.9毫米)" },
      { c: "#FA00FA", l: "大暴雨 (100-249.9毫米)" },
      { c: "#730000", l: "特大暴雨 (≥250毫米)" }
    ];`;

content = content.replace(oldLegend, newLegend);

// Let's modify handleGenerate to fix the UI freeze. We can use requestAnimationFrame to yield if it's taking long?
// Actually wait. drawMapOnCanvas calls drawRainForecastOnCanvas which is async!
// But there is no await in its internal loops, so it's a synchronous block that returns a Promise.
// We should add `await new Promise(r => setTimeout(r, 0))` inside loops that take a long time!
content = content.replace(
  '        if (renderedCount % 1000 === 0) {\n             if (typeof setGenerationProgress === \'function\') setGenerationProgress(50 + (renderedCount / (cols*rows*0.5))*50);\n          }',
  '        if (renderedCount % 1000 === 0) {\n             if (typeof setGenerationProgress === \'function\') setGenerationProgress(50 + (renderedCount / (cols*rows*0.5))*50);\n             await new Promise(r => setTimeout(r, 0));\n          }'
);

content = content.replace(
  '    if (typeof setGenerationProgress === \'function\') setGenerationProgress(70);\n\n    // Draw rain blobs',
  '    if (typeof setGenerationProgress === \'function\') setGenerationProgress(70);\n    await new Promise(r => setTimeout(r, 0));\n\n    // Draw rain blobs'
);

fs.writeFileSync('src/components/ForecastImageModal.tsx', content);
