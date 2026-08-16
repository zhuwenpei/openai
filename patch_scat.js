import fs from 'fs';
let content = fs.readFileSync('src/components/ForecastImageModal.tsx', 'utf8');

const target = `          if (checkPointOnLandGeoJson(glat, glon)) w *= 0.7;`;

const replace = `          if (checkPointOnLandGeoJson(glat, glon)) {
            w *= 0.75;
            const elev = getProceduralElevation(glat, glon);
            if (elev > 100) {
              w *= Math.max(0.4, 1.0 - (elev / 2000));
            }
          }`;

content = content.replace(target, replace);
fs.writeFileSync('src/components/ForecastImageModal.tsx', content);
