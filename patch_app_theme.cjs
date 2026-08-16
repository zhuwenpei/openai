const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes('const getThemeClass')) {
    code = code.replace(/return \(\n\s*<OrientationGuard>/,
      `const getThemeClass = () => {
    if (config.uiStyle === "ios") return "theme-ios";
    if (config.uiStyle === "professional") return "theme-professional";
    return "theme-default";
  };

  return (
    <OrientationGuard>`);

    code = code.replace(/<div id="typhoon-app-container" className="relative w-screen h-screen overflow-hidden bg-\[\#07111F\] font-sans">/,
      `<div id="typhoon-app-container" className={\`relative w-screen h-screen overflow-hidden bg-[#07111F] font-sans \${getThemeClass()}\`}>`);
      
    fs.writeFileSync('src/App.tsx', code);
}
