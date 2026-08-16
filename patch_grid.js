import fs from 'fs';
let content = fs.readFileSync('src/components/ForecastImageModal.tsx', 'utf8');

// Disable auto-render in useEffect
const targetUseEffect = `  useEffect(() => {
    if (!showWarning && isOpen) {
      // Trigger canvas drawing when parameters change
      const timer = setTimeout(() => {
        drawMapOnCanvas(canvasRef.current);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [`;

const replaceUseEffect = `  useEffect(() => {
    if (!showWarning && isOpen) {
      // Trigger canvas drawing when parameters change
      // const timer = setTimeout(() => {
      //   drawMapOnCanvas(canvasRef.current);
      // }, 50);
      // return () => clearTimeout(timer);
    }
  }, [`;

content = content.replace(targetUseEffect, replaceUseEffect);

// Wind Grid Size
content = content.replace('const windGridSize = 0.08;', 'const windGridSize = 0.04;');
// Rain Grid Size
content = content.replace('const rainGridSize = 0.08;', 'const rainGridSize = 0.04;');

fs.writeFileSync('src/components/ForecastImageModal.tsx', content);
