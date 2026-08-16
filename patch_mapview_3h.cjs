const fs = require('fs');
let code = fs.readFileSync('src/components/MapView.tsx', 'utf8');

code = code.replace(
  `          forecastPoints.forEach((state) => {
            if (state && !isNaN(state.lat) && !isNaN(state.lon) && state.simHour > 0) {
              const radiusMeters`,
  `          forecastPoints.forEach((state) => {
            if (state.simHour % 3 !== 0) return;
            if (state && !isNaN(state.lat) && !isNaN(state.lon) && state.simHour > 0) {
              const radiusMeters`
);

code = code.replace(
  `          forecastPoints.forEach((state) => {
            const markerColor = getCategoryColor(state.category, config);`,
  `          forecastPoints.forEach((state) => {
            if (state.simHour % 3 !== 0) return;
            const markerColor = getCategoryColor(state.category, config);`
);

fs.writeFileSync('src/components/MapView.tsx', code);
