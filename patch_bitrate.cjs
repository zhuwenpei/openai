const fs = require('fs');
let code = fs.readFileSync('src/utils/VideoRenderEngine.ts', 'utf-8');

const targetStr = `  let bitRate = 12000000; // 12 Mbps for 1080p
  if (exportConfig.videoResolution === "720p") bitRate = 6000000;
  else if (exportConfig.videoResolution === "4K") bitRate = 28000000; // 28 Mbps for 4K`;

code = code.replace(targetStr, ""); // remove it from below

const insertPoint = `  if (typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined") {`;
code = code.replace(insertPoint, targetStr + "\n" + insertPoint);

fs.writeFileSync('src/utils/VideoRenderEngine.ts', code);
