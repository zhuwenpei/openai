const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Fix handleSeek to spread the entire hState to avoid losing properties
code = code.replace(
  /const hState = ty\.history\.find\(\(h\) => h\.simHour === hour\);\s+if \(hState\) \{\s+return \{\s+\.\.\.ty,\s+lat: hState\.lat,[\s\S]*?maxR7Limit: hState\.maxR7Limit \|\| ty\.maxR7Limit\s+\};\s+\}/,
  `const hState = ty.history.find((h) => h.simHour === hour);
        if (hState) {
          return {
            ...ty,
            ...hState, // Restore full state (upwellingHours, tdHours, etc.)
            maxR7Limit: hState.maxR7Limit || ty.maxR7Limit
          };
        }`
);

// 2. Fix onPlayToggle to sync PRNG and clear future cold wakes
code = code.replace(
  `simMinutesBufferRef.current = 0;\n            }`,
  `simMinutesBufferRef.current = 0;\n              engineRef.current.syncPrngToHour(currentHour);\n              setColdWakes([]); // Clear cold wakes to avoid pollution from the alternate future\n            }`
);

// 3. We also need to sync PRNG if we step forward manually after a seek.
code = code.replace(
  /const handleStepForward = \(\) => {/g,
  `const handleStepForward = () => {\n    if (currentHour < maxHour) {\n       engineRef.current.syncPrngToHour(currentHour);\n       setColdWakes([]);\n       // Truncate history manually because we stepped from past\n       setTyphoons((prev) => prev.map((ty) => ({ ...ty, history: ty.history.filter((h) => h.simHour <= currentHour) })));\n    }`
);

fs.writeFileSync('src/App.tsx', code);
