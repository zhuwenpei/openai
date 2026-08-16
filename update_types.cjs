const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf-8');

if (!code.includes('sstNorthSouthGradient')) {
    code = code.replace(
        /sstAnomaly: number; \/\//, 
        "sstAnomaly: number; //\n  sstNorthSouthGradient?: number;"
    );
}
if (!code.includes('cityDensity')) {
    code = code.replace(
        /particleDensity:/, 
        "cityDensity?: number; // 0 to 100\n  particleDensity:"
    );
}
if (!code.includes('capsuleSize')) {
    code = code.replace(
        /weatherStations\?: boolean;/, 
        "weatherStations?: boolean;\n  capsuleSize?: number;\n  stationLabels?: boolean;"
    );
}
if (!code.includes('showTopBar')) {
    code = code.replace(
        /cursor\?: boolean;/, 
        "cursor?: boolean;\n  showTopBar?: boolean;\n  showCenterPoint?: boolean;\n  showNews?: boolean;"
    );
}

fs.writeFileSync('src/types.ts', code);
