const fs = require('fs');
let code = fs.readFileSync('src/components/ForecastImageModal.tsx', 'utf8');

// 1. Add jitter and missing data probability
code = code.replace(
  `      for (let v = vMin; v <= vMax; v += safeStep) {
        // Convert (u, v) back to lat/lon using rotated coordinate transform`,
  `      for (let v = vMin; v <= vMax; v += safeStep) {
        // Requirement 12: Add natural noise/randomness to scatterometer
        // Introduce small missing data gaps (rain contamination / sensor noise)
        if (Math.random() > 0.94) continue;
        
        // Add spatial jitter to break perfect uniformity
        const jitterU = (Math.random() - 0.5) * safeStep * 0.45;
        const jitterV = (Math.random() - 0.5) * safeStep * 0.45;
        
        // Convert (u, v) back to lat/lon using rotated coordinate transform
        const glat = clat + (u + jitterU) * Math.sin(orbitAngle) + (v + jitterV) * Math.cos(orbitAngle);
        const glon = clon + (u + jitterU) * Math.cos(orbitAngle) - (v + jitterV) * Math.sin(orbitAngle);`
);

// 2. Sort barbs before drawing
code = code.replace(
  `    if (typeof setGenerationProgress === "function") setGenerationProgress(95);

    barbsToDraw.forEach(b => {
      drawBarb(b.x, b.y, b.speed, b.angle, b.color);
    });`,
  `    if (typeof setGenerationProgress === "function") setGenerationProgress(95);

    // Requirement 13: Z-index sorting, highest wind speeds drawn on top
    barbsToDraw.sort((a, b) => a.speed - b.speed);

    barbsToDraw.forEach(b => {
      drawBarb(b.x, b.y, b.speed, b.angle, b.color);
    });`
);

fs.writeFileSync('src/components/ForecastImageModal.tsx', code);
