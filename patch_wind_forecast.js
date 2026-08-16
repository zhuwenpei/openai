import fs from 'fs';
let content = fs.readFileSync('src/components/ForecastImageModal.tsx', 'utf8');

const target = `              // Decay over land
              if (checkPointOnLandGeoJson(glat, glon)) {
                w *= 0.65;
              }`;

const replace = `              // Decay over land and terrain blocking
              if (checkPointOnLandGeoJson(glat, glon)) {
                w *= 0.7; // Base land decay
                const elev = getProceduralElevation(glat, glon);
                if (elev > 100) {
                  w *= Math.max(0.3, 1.0 - (elev / 1500)); // Mountains block wind heavily
                }
              }`;

content = content.replace(target, replace);
fs.writeFileSync('src/components/ForecastImageModal.tsx', content);
