import * as fs from "fs";
import * as path from "path";
import * as turf from "@turf/turf";

const OUTPUT_LAND_PATH = path.join(process.cwd(), "public", "data", "pacific_land_lite.geojson");
const OUTPUT_COUNTRIES_PATH = path.join(process.cwd(), "public", "data", "pacific_countries_lite.geojson");

const REMOTE_LAND_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_land.geojson";
const REMOTE_COUNTRIES_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson";

// 1. Important island zones bounding boxes
const importantIslandZones = [
  // 1. 舟山群岛及杭州湾外缘
  { name: "Zhoushan & Hangzhou Bay", minLon: 120.5, maxLon: 123.0, minLat: 29.0, maxLat: 31.2 },
  // 2. 长江口和崇明岛
  { name: "Yangtze Estuary & Chongming", minLon: 120.9, maxLon: 122.5, minLat: 31.0, maxLat: 32.0 },
  // 3. 台湾及台湾海峡
  { name: "Taiwan & Taiwan Strait", minLon: 117.5, maxLon: 122.5, minLat: 21.5, maxLat: 25.8 },
  // 4. 澎湖列岛
  { name: "Penghu Islands", minLon: 119.2, maxLon: 119.8, minLat: 23.1, maxLat: 23.8 },
  // 5. 济州岛及朝鲜海峡
  { name: "Jeju & Korea Strait", minLon: 125.8, maxLon: 130.5, minLat: 32.5, maxLat: 35.5 },
  // 6. 琉球群岛
  { name: "Ryukyu Islands", minLon: 122.5, maxLon: 131.0, minLat: 24.0, maxLat: 31.0 },
  // 7. 马六甲海峡和新加坡海峡
  { name: "Malacca & Singapore Strait", minLon: 95.0, maxLon: 105.0, minLat: -2.0, maxLat: 6.0 },
  // 8. 菲律宾主要群岛
  { name: "Philippines", minLon: 116.0, maxLon: 127.0, minLat: 4.5, maxLat: 21.5 },
  // 9. 日本主要岛屿附近
  { name: "Japan Main Islands", minLon: 128.0, maxLon: 146.0, minLat: 30.0, maxLat: 46.0 }
];

// Helper to determine if a polygon centroid or any coordinate falls within an important zone
function isInsideImportantZone(poly: any): boolean {
  if (!poly.geometry || !poly.geometry.coordinates) return false;
  const ring = poly.geometry.coordinates[0];
  if (!ring || ring.length === 0) return false;
  
  for (const coord of ring) {
    const lon = coord[0];
    const lat = coord[1];
    for (const zone of importantIslandZones) {
      if (lon >= zone.minLon && lon <= zone.maxLon && lat >= zone.minLat && lat <= zone.maxLat) {
        return true;
      }
    }
  }
  return false;
}

// Function to download data in memory
async function downloadGeoJson(url: string, label: string): Promise<any> {
  console.log(`[Preprocessor] Downloading remote ${label} data from ${url}...`);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP status ${res.status}`);
    }
    const data = await res.json();
    console.log(`[Preprocessor] Downloaded ${label} data successfully. Size = ${(JSON.stringify(data).length / 1e6).toFixed(2)} MB`);
    return data;
  } catch (e) {
    console.error(`[Preprocessor] Failed to download ${label} from remote. Trying to load local fallback if present.`);
    // Fallback to local raw if available
    const localRawPath = path.join(process.cwd(), "public", "data", `${label}.geojson`);
    if (fs.existsSync(localRawPath)) {
      const rawData = fs.readFileSync(localRawPath, "utf-8");
      return JSON.parse(rawData);
    }
    throw e;
  }
}

// Function to split MultiPolygons and filter/simplify
function processGeoJson(geojson: any, outputPath: string, isCountries: boolean) {
  console.log(`[Preprocessor] Starting optimization pipeline for ${isCountries ? "Countries" : "Land"}`);

  // Region Bounding Box (West Pacific and Southeast Asia region)
  const clipBbox = [90, -15, 180, 65];

  const processedFeatures: any[] = [];
  let totalInputPolygons = 0;
  let deletedSmallIslands = 0;
  let totalInputCoordinates = 0;
  let totalOutputCoordinates = 0;

  geojson.features.forEach((feature: any, featIdx: number) => {
    if (!feature || !feature.geometry) return;

    // Convert feature to individual Polygons
    const polygons: any[] = [];
    const geomType = feature.geometry.type;

    if (geomType === "Polygon") {
      polygons.push(turf.helpers.feature(feature.geometry, feature.properties));
    } else if (geomType === "MultiPolygon") {
      feature.geometry.coordinates.forEach((coords: any) => {
        polygons.push(turf.helpers.feature(turf.helpers.polygon(coords).geometry, feature.properties));
      });
    }

    totalInputPolygons += polygons.length;

    // Process each polygon
    polygons.forEach((poly: any) => {
      // Calculate coordinates before
      const countCoords = (arr: any): number => {
        let count = 0;
        const traverse = (item: any) => {
          if (typeof item[0] === "number" && typeof item[1] === "number") {
            count++;
          } else if (Array.isArray(item)) {
            item.forEach(traverse);
          }
        };
        traverse(arr);
        return count;
      };
      totalInputCoordinates += countCoords(poly.geometry.coordinates);

      // 1. Clip to Northwest Pacific region
      let clipped: any = null;
      try {
        clipped = turf.bboxClip(poly, clipBbox as [number, number, number, number]);
      } catch (e) {
        return;
      }

      if (!clipped || !clipped.geometry || clipped.geometry.coordinates.length === 0) {
        return;
      }

      // Handle possible MultiPolygon returned by clip
      const clippedPolys: any[] = [];
      if (clipped.geometry.type === "Polygon") {
        clippedPolys.push(clipped);
      } else if (clipped.geometry.type === "MultiPolygon") {
        clipped.geometry.coordinates.forEach((coords: any) => {
          clippedPolys.push(turf.helpers.feature(turf.helpers.polygon(coords).geometry, poly.properties));
        });
      }

      clippedPolys.forEach((cPoly: any) => {
        if (!cPoly.geometry.coordinates[0] || cPoly.geometry.coordinates[0].length < 4) {
          return;
        }

        // 2. Calculate Area
        let areaKm2 = 0;
        try {
          areaKm2 = turf.area(cPoly) / 1e6;
        } catch (e) {
          return;
        }

        if (areaKm2 <= 0) return;

        // 3. Determine if important
        const insideImp = isInsideImportantZone(cPoly);
        const isProtectedMajor = areaKm2 >= 100; // Major islands/regions
        const isImportant = insideImp || isProtectedMajor;

        // 4. Area thresholds: 8 km² general, 2 km² inside important island zones
        const minArea = insideImp ? 2 : 8;

        if (!isCountries && areaKm2 < minArea) {
          // Rule: If it touches boundary, keep it (e.g. continental boundaries)
          const bbox = turf.bbox(cPoly);
          const touchesBoundary = bbox[0] <= 90.01 || bbox[2] >= 179.99 || bbox[1] <= -14.99 || bbox[3] >= 64.99;
          
          if (!touchesBoundary) {
            deletedSmallIslands++;
            return;
          }
        }

        // 5. Douglas-Peucker Simplification (meters to degrees: 111.12 km per degree)
        // 500m -> 0.00449 deg, 250m -> 0.00225 deg
        const tolerance = isImportant ? 0.00225 : 0.00449;
        let simplified: any = null;
        try {
          simplified = turf.simplify(cPoly, { tolerance, highQuality: true, mutate: false });
        } catch (e) {
          simplified = cPoly;
        }

        if (!simplified || !simplified.geometry || simplified.geometry.coordinates.length === 0) {
          return;
        }

        // 6. Fix Geometry and winding order using rewind
        let rewound: any = null;
        try {
          rewound = turf.rewind(simplified, { reverse: true, mutate: false });
        } catch (e) {
          rewound = simplified;
        }

        // 7. Calculate final bbox for spatial index
        let finalBbox: any = null;
        try {
          finalBbox = turf.bbox(rewound);
        } catch (e) {
          return;
        }

        // Check validity again
        if (rewound.geometry.coordinates[0] && rewound.geometry.coordinates[0].length >= 4) {
          const finalFeat = {
            type: "Feature",
            properties: {
              ...poly.properties,
              AREA_KM2: areaKm2,
              IS_IMPORTANT: isImportant,
              BBOX: finalBbox
            },
            geometry: rewound.geometry
          };
          processedFeatures.push(finalFeat);
          totalOutputCoordinates += countCoords(rewound.geometry.coordinates);
        }
      });
    });
  });

  // Write optimized output
  const outputGeoJson = {
    type: "FeatureCollection",
    features: processedFeatures
  };

  fs.writeFileSync(outputPath, JSON.stringify(outputGeoJson), "utf-8");

  console.log(`[Preprocessor] Completed: ${outputPath}`);
  console.log(`- Polygons: Input = ${totalInputPolygons}, Output = ${processedFeatures.length}`);
  console.log(`- Coordinates: Input = ${totalInputCoordinates}, Output = ${totalOutputCoordinates}`);
  console.log(`- Deleted minor islands = ${deletedSmallIslands}`);
  console.log(`- Output File size = ${(fs.statSync(outputPath).size / 1e3).toFixed(2)} KB\n`);

  return {
    inputPolygons: totalInputPolygons,
    outputPolygons: processedFeatures.length,
    inputCoords: totalInputCoordinates,
    outputCoords: totalOutputCoordinates,
    deletedIslands: deletedSmallIslands,
    outputSize: fs.statSync(outputPath).size
  };
}

// Run preprocessor for both land and countries
async function run() {
  console.log("=== STARTING REAL-WORLD GEOSPATIAL DATA PREPROCESSING ===");
  try {
    const rawLandData = await downloadGeoJson(REMOTE_LAND_URL, "ne_10m_land");
    processGeoJson(rawLandData, OUTPUT_LAND_PATH, false);

    const rawCountriesData = await downloadGeoJson(REMOTE_COUNTRIES_URL, "ne_10m_admin_0_countries");
    processGeoJson(rawCountriesData, OUTPUT_COUNTRIES_PATH, true);

    console.log("=== PREPROCESSING COMPLETED SUCCESSFULY ===");
  } catch (err) {
    console.error("Critical error in preprocessing:", err);
    process.exit(1);
  }
}

run();
