const fs = require('fs');
let code = fs.readFileSync('src/components/MapView.tsx', 'utf-8');

// We need to import CITIES
code = code.replace(
  'import { Typhoon, SimulationConfig, ActiveLayers } from "../types";',
  'import { Typhoon, SimulationConfig, ActiveLayers } from "../types";\nimport { CITIES } from "../utils/stations";'
);

// We need a state for the selected station
code = code.replace(
  'const mapRef = useRef<L.Map | null>(null);',
  'const mapRef = useRef<L.Map | null>(null);\n  const [selectedStation, setSelectedStation] = useState<{id: string, name: string, lat: number, lon: number, wind: number, pressure: number} | null>(null);\n  const [showFullHistory, setShowFullHistory] = useState(false);'
);

// Add StationHistory import
code = code.replace(
  'import "leaflet/dist/leaflet.css";',
  'import "leaflet/dist/leaflet.css";\nimport StationHistory from "./StationHistory";'
);

// We need to render Leaflet markers for stations. 
// Best way is to use a React useEffect to manage L.marker layer group for stations, similar to how path is drawn.
// Let's create a stations group.
code = code.replace(
  'const [layersInitialized, setLayersInitialized] = useState(false);',
  'const [layersInitialized, setLayersInitialized] = useState(false);\n  const stationsGroupRef = useRef<L.FeatureGroup | null>(null);'
);

code = code.replace(
  'pathGroupRef.current = L.featureGroup().addTo(map);',
  'pathGroupRef.current = L.featureGroup().addTo(map);\n      stationsGroupRef.current = L.featureGroup().addTo(map);'
);

// We need a function to get color by wind
const stationHelpers = `
  const getStationColor = (wind: number) => {
    if (wind < 10) return "bg-emerald-500 text-white";
    if (wind < 17) return "bg-green-500 text-white";
    if (wind < 24) return "bg-yellow-500 text-slate-900";
    if (wind < 32) return "bg-orange-500 text-white";
    if (wind < 41) return "bg-red-500 text-white";
    if (wind < 51) return "bg-rose-600 text-white";
    return "bg-purple-600 text-white";
  };
`;
code = code.replace(
  'const drawAsymmetricRadii =',
  stationHelpers + '\n  const drawAsymmetricRadii ='
);

// Add station render logic in the map update effect
const updateStations = `
    // Update Weather Stations
    if (stationsGroupRef.current) {
      stationsGroupRef.current.clearLayers();
      if (activeLayers.weatherStations && activeTyphoons.length > 0) {
         const ty = activeTyphoons[0];
         const density = activeConfig.cityDensity !== undefined ? activeConfig.cityDensity : 50;
         const numCities = Math.max(1, Math.floor((CITIES.length * density) / 100));
         
         // Select cities evenly
         const step = CITIES.length / numCities;
         const selectedCities = [];
         for (let i = 0; i < numCities; i++) {
            selectedCities.push(CITIES[Math.floor(i * step)]);
         }

         const capsuleScale = activeConfig.capsuleSize !== undefined ? activeConfig.capsuleSize / 100 : 1;
         const w = Math.max(20, 40 * capsuleScale);
         const h = Math.max(10, 20 * capsuleScale);
         const fontSize = Math.max(8, 12 * capsuleScale);

         selectedCities.forEach(city => {
            const dLatKm = (city.lat - ty.lat) * 111.12;
            const dLonKm = (city.lon - ty.lon) * 111.12 * Math.cos(ty.lat * Math.PI / 180);
            const dist = Math.sqrt(dLatKm * dLatKm + dLonKm * dLonKm);
            
            const rmw = ty.rmw || 35;
            let wind = 0;
            let pmin = 1013;
            
            if (dist <= rmw) {
               wind = ty.vmax * (dist / rmw);
               pmin = ty.pmin + (1013 - ty.pmin) * Math.pow(dist / rmw, 2) * 0.5;
            } else {
               const envelope = Math.exp(-(dist - rmw) / (ty.vmax * 5.0 + 70));
               wind = ty.vmax * envelope;
               pmin = 1013 - (1013 - ty.pmin) * envelope;
            }

            const colorClass = getStationColor(wind);
            
            const html = \`
              <div class="flex items-center justify-center font-mono rounded-full shadow-md transition-all duration-300 \${colorClass}"
                   style="width: \${w}px; height: \${h}px; font-size: \${fontSize}px; font-weight: 600; border: 1px solid rgba(255,255,255,0.2);">
                \${Math.round(wind)}
              </div>
              \${activeConfig.stationLabels ? \`<div class="text-center text-[10px] text-white mt-1 drop-shadow-md">\${city.name}</div>\` : ''}
            \`;

            const icon = L.divIcon({
              html,
              className: "station-icon",
              iconSize: [w, h],
              iconAnchor: [w/2, h/2]
            });

            const marker = L.marker([city.lat, city.lon], { icon }).addTo(stationsGroupRef.current!);
            
            marker.on('click', () => {
               setSelectedStation({
                  ...city,
                  wind,
                  pressure: pmin
               });
            });
         });
      }
    }
`;

code = code.replace(
  'if (activeLayers.windRadii) {',
  updateStations + '\n      if (activeLayers.windRadii) {'
);

fs.writeFileSync('src/components/MapView.tsx', code);
