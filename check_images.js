const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const regex = /src=["']([^"']+)["']/g;
let match;
const sources = new Set();
while ((match = regex.exec(html)) !== null) {
  sources.add(match[1]);
}
console.log('Referenced assets in HTML:');
let allGood = true;
for (const s of sources) {
  const exists = fs.existsSync(s);
  console.log((exists ? '✓' : '✗ MISSING:') + ' ' + s);
  if (!exists) allGood = false;
}
console.log('All assets verified:', allGood);
