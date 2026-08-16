const fs = require('fs');
const content = fs.readFileSync('src/components/ForecastImageModal.tsx', 'utf8');

let tags = [];
const regex = /<\/?([a-zA-Z]+)(?=[>\s/])/g;
let match;
while ((match = regex.exec(content)) !== null) {
  if (['div', 'span', 'button', 'svg', 'canvas', 'img', 'p', 'label', 'input', 'select', 'option', 'h3'].includes(match[1].toLowerCase())) {
     if (match[0].startsWith('</')) tags.pop();
     else tags.push(match[1].toLowerCase());
  }
}
console.log(tags.join(', '));
