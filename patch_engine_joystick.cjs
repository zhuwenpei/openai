const fs = require('fs');
let code = fs.readFileSync('src/simulation/Engine.ts', 'utf8');

code = code.replace(/const westVec = getWesterliesSteeringVector\(ty\.lat, ty\.lon, config\);\n\s*u_agg = joyU \+ westVec\.u;\n\s*v_agg = joyV \+ westVec\.v;/g,
  `const westVec = getWesterliesSteeringVector(ty.lat, ty.lon, config);
        u_agg = joyU + westVec.u;
        v_agg = joyV + westVec.v;
        if (westVec.u > 0 && joyV > 0 && joyU <= 0.1) {
            // Requirement 3: If user steers North in Westerlies, force East-North-East movement
            u_agg += joyV * 0.5 + westVec.u * 0.5; 
        }`);

fs.writeFileSync('src/simulation/Engine.ts', code);
