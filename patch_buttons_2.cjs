const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Replace standard buttons with just icons and tooltips
// We want to make sure they are aligned, and have the same size.
// Look for ControlDrawer triggers or bottom right buttons

// We already removed text from some bottom buttons, but let's check what's there.
// For example, in the bottom right panel:
// <button onClick={...} className="px-4 py-2 ...">
//   <Settings className="..." /> 系统设置
// </button>

code = code.replace(/>\s*系统设置\s*<\/button>/, ' title="系统设置" />\n              </button>');
code = code.replace(/<Settings className="w-4 h-4 mr-2" \/>/, '<Settings className="w-5 h-5"');

code = code.replace(/>\s*复盘视频生成\s*<\/button>/, ' title="复盘视频生成" />\n              </button>');
code = code.replace(/<Video className="w-4 h-4 mr-2" \/>/, '<Video className="w-5 h-5"');

code = code.replace(/>\s*站点气象排行\s*<\/button>/, ' title="站点气象排行" />\n              </button>');
code = code.replace(/<BarChart3 className="w-4 h-4 mr-2" \/>/, '<BarChart3 className="w-5 h-5"');
code = code.replace(/<Monitor className="w-4 h-4 mr-2" \/>/, '<Monitor className="w-5 h-5"'); // In case it was a monitor

// Also make the padding symmetrical since they don't have text anymore
code = code.replace(/px-4 py-2/g, 'p-2.5');

fs.writeFileSync('src/App.tsx', code);
