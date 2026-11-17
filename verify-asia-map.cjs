// Sanity checks for the Asia 2D map data: sea is sea, land is land, lakes/roads exist, files are wired into the pages.
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync('dist/asia-map-data.js', 'utf8');
const data = new Function(src + ';return asiaMapData;')();
const U = data.u;
const decode = list => list.map(a => { const pts = []; let x = a[0], y = a[1]; pts.push([x / U, y / U]); for (let i = 2; i < a.length; i += 2) { x += a[i]; y += a[i + 1]; pts.push([x / U, y / U]); } return pts; });
const inside = (pt, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c; } return c; };
const land = decode(data.land), lakes = decode(data.lakes);
const onLand = (lon, lat) => land.some(r => inside([lon, lat], r)) && !lakes.some(r => inside([lon, lat], r));
for (const [name, lon, lat] of [['Taipei', 121.56, 25.03], ['Tokyo', 139.7, 35.7], ['Bangkok', 100.5, 13.75], ['Beijing', 116.4, 39.9], ['Delhi', 77.2, 28.6], ['Singapore main island', 103.82, 1.35], ['Hokkaido', 142.8, 43.3], ['Denver', -105, 39.7], ['Moscow', 37.6, 55.75], ['Sao Paulo', -46.6, -23.5], ['Johannesburg', 28, -26.2], ['Alice Springs', 133.9, -23.7]])
  assert(onLand(lon, lat), name + ' should be land');
for (const [name, lon, lat] of [['South China Sea', 114, 12], ['Philippine Sea', 135, 18], ['Bay of Bengal', 88, 14], ['Taiwan Strait', 119.5, 24], ['Sea of Japan', 134, 40], ['Lake Baikal', 108.5, 53.5], ['mid Atlantic', -35, 30], ['mid Pacific', -150, 10]])
  assert(!onLand(lon, lat), name + ' should be water');
assert(data.roadsMajor.length > 1000, 'major roads present');
assert(data.rivers.length > 100 && data.borders.length > 100, 'rivers and borders present');
assert(data.countries.some(c => c[0].includes('日本')) && data.countries.some(c => c[0].includes('印度')), 'country labels');
assert(src.length < 500 * 1024, 'data stays compact');
assert(data.bbox[0] === -180 && data.bbox[2] === 180, 'world coverage');
for (const page of ['dist/index.html', 'dist/iphone.html']) {
  const html = fs.readFileSync(page, 'utf8');
  assert(html.includes('id="openAsiaMap"') && html.includes('asia-map-data.js') && html.includes('asia-map.js') && html.includes('world-launcher.js'), page + ' wired');
}
const launcher = fs.readFileSync('dist/world-launcher.js', 'utf8'), story = fs.readFileSync('dist/campaign-story.js', 'utf8');
assert(story.includes('skyLauncher?.enhance'), 'free-flight tab hands the stage to the world launcher');
for (const id of ['hubFfDeparture', 'hubFfDestination', 'hubFfTime']) assert(launcher.includes(id), 'launcher uses ' + id);
assert(!/hubFreeFlyBtn/.test(launcher), 'launcher never replaces the existing take-off handler');
console.log('asia map OK');
