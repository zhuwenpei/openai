const fs = require('fs');
let code = fs.readFileSync('src/components/ForecastImageModal.tsx', 'utf8');

const generateChartFn = `
  const handleGenerateChart = () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Parse aspect ratio
    const [wRatio, hRatio] = chartMakerConfig.aspectRatio.split(":").map(Number);
    const baseWidth = 1200;
    const baseHeight = (baseWidth / wRatio) * hRatio;
    
    const scale = chartMakerConfig.resolution;
    canvas.width = baseWidth * scale;
    canvas.height = baseHeight * scale;
    
    ctx.scale(scale, scale);
    
    // Background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, baseWidth, baseHeight);
    
    // Grid & Layout
    const padding = 60;
    let drawX = padding;
    let drawY = padding;
    let drawW = baseWidth - padding * 2;
    let drawH = baseHeight - padding * 2;
    
    const getElementUnit = () => rankingElement === "precip" ? "mm" : "m/s";
    const getElementName = () => {
      if (rankingElement === "gust") return "极大风速";
      if (rankingElement === "avgWind") return "平均风速";
      return "最大降水量";
    };

    if (chartMakerConfig.showInfo) {
      ctx.fillStyle = "#38bdf8";
      ctx.font = \`bold \${32}px sans-serif\`;
      ctx.fillText(\`\${typhoon.name || "无名"}台风实测\${getElementName()}排行\`, drawX, drawY + 30);
      
      ctx.fillStyle = "#94a3b8";
      ctx.font = \`bold \${20}px sans-serif\`;
      ctx.fillText(\`统计窗口: \${rankingWindow}小时 | 截止: \${new Date().toLocaleString()}\`, drawX, drawY + 65);
      
      drawY += 100;
      drawH -= 100;
    }
    
    const rawRankings = getStationRankings(typhoon.history || [], currentHour, rankingWindow);
    const sorted = [...rawRankings].sort((a, b) => b[rankingElement] - a[rankingElement]);
    const topData = sorted.slice(0, chartMakerConfig.topN);
    
    const maxVal = Math.max(...topData.map(d => d[rankingElement]), 10);
    
    // Drawing Bars
    ctx.fillStyle = "#38bdf8";
    if (chartMakerConfig.chartType === "column") {
      // Column (Vertical bars)
      const stepW = drawW / topData.length;
      const barW = stepW * 0.6;
      
      topData.forEach((d, i) => {
        const val = d[rankingElement];
        const barH = (val / maxVal) * (drawH - 50); // leave 50px for labels
        const bx = drawX + i * stepW + (stepW - barW) / 2;
        const by = drawY + drawH - barH - 40; // 40 for text
        
        // Bar
        const grad = ctx.createLinearGradient(0, by, 0, by + barH);
        grad.addColorStop(0, "#38bdf8");
        grad.addColorStop(1, "#0284c7");
        ctx.fillStyle = grad;
        
        ctx.beginPath();
        ctx.roundRect(bx, by, barW, barH, [8, 8, 0, 0]);
        ctx.fill();
        
        // Value Text
        ctx.fillStyle = "#f8fafc";
        ctx.font = \`bold \${16}px sans-serif\`;
        ctx.textAlign = "center";
        ctx.fillText(\`\${val.toFixed(1)}\`, bx + barW/2, by - 10);
        
        // Name Text
        ctx.fillStyle = "#94a3b8";
        ctx.font = \`bold \${16}px sans-serif\`;
        ctx.fillText(d.name, bx + barW/2, drawY + drawH - 10);
      });
    } else {
      // Bar (Horizontal bars)
      const stepH = drawH / topData.length;
      const barH = stepH * 0.6;
      
      topData.forEach((d, i) => {
        const val = d[rankingElement];
        const barW = (val / maxVal) * (drawW - 100);
        const bx = drawX + 80;
        const by = drawY + i * stepH + (stepH - barH) / 2;
        
        // Bar
        const grad = ctx.createLinearGradient(bx, 0, bx + barW, 0);
        grad.addColorStop(0, "#0284c7");
        grad.addColorStop(1, "#38bdf8");
        ctx.fillStyle = grad;
        
        ctx.beginPath();
        ctx.roundRect(bx, by, barW, barH, [0, 8, 8, 0]);
        ctx.fill();
        
        // Name Text
        ctx.fillStyle = "#94a3b8";
        ctx.font = \`bold \${16}px sans-serif\`;
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(d.name, bx - 10, by + barH/2);
        
        // Value Text
        ctx.fillStyle = "#f8fafc";
        ctx.textAlign = "left";
        ctx.fillText(\`\${val.toFixed(1)} \${getElementUnit()}\`, bx + barW + 10, by + barH/2);
      });
    }
    
    // Download
    const link = document.createElement("a");
    link.download = \`\${typhoon.name || "无名"}台风实测\${getElementName()}排行.png\`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };
`;

code = code.replace(/alert\("图表生成功能已挂载，实际绘图逻辑可使用Canvas实现。"\);/, `handleGenerateChart();`);

// Insert function
const injectTarget = 'const handleDownloadActual = () => {';
code = code.replace(injectTarget, generateChartFn + '\n  ' + injectTarget);

fs.writeFileSync('src/components/ForecastImageModal.tsx', code);
