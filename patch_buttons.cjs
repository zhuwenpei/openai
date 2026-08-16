const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// The user wants buttons to be icons, aligned, and neat, removing text where possible.
// E.g., the right panel bottom buttons. "清除轨迹" -> Trash/Eraser. "预报信息" -> Info/List.
// We will look for <button> containing these texts.

code = code.replace(/>\s*清除轨迹\s*<\/button>/, ' title="清除轨迹" />\n                </button>');
code = code.replace(/<Trash2 className="w-4 h-4 mr-1\.5" \/>/, '<Trash2 className="w-5 h-5"');

code = code.replace(/>\s*清除所有台风\s*<\/button>/, ' title="清除所有台风" />\n                </button>');
code = code.replace(/<Trash2 className="w-4 h-4 mr-2" \/>/, '<Trash2 className="w-5 h-5"');

code = code.replace(/>\s*导出台风数据\s*<\/button>/, ' title="导出数据" />\n              </button>');
code = code.replace(/<Download className="w-4 h-4 mr-2" \/>/, '<Download className="w-5 h-5"');

// Wait, the original code might have different icon names or structures.
// Let's just use string replacements on the button texts if they exist.

fs.writeFileSync('src/App.tsx', code);
