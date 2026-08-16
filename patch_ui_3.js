import fs from 'fs';
let content = fs.readFileSync('src/components/ForecastImageModal.tsx', 'utf8');

const target = `                {imageStyle === "wind" && (
                  <div className="space-y-1.5 mt-4">
                    <label className="text-xs text-slate-400 block font-medium">预报时效 (未来)</label>`;

const replace = `                {(imageStyle === "wind" || imageStyle === "rain") && (
                  <div className="space-y-1.5 mt-4">
                    <label className="text-xs text-slate-400 block font-medium">预报时效 (未来)</label>`;

content = content.replace(target, replace);
fs.writeFileSync('src/components/ForecastImageModal.tsx', content);
