'use strict';
// Complete Global World Atlas: Natural Earth 1:50m World Landmasses, Lakes, Rivers, Borders, Roads,
// 72 Regional Biomes, World Mountain Ranges & Viewport-Clipped Google Maps Satellite Tile Pyramid.
const WorldAtlas = (() => {
  const COUNTRIES = [
    // East & Southeast Asia
    { code: 'TW', zh: '台灣', biome: 'temperate', base: 28, hill: 420, poly: [[120.02,21.88],[120.88,21.88],[121.65,22.75],[122.02,25.05],[121.52,25.32],[120.88,24.85],[120.12,23.62],[120.00,22.65]] },
    { code: 'JP', zh: '日本 本州', biome: 'temperate', base: 34, hill: 560, poly: [[130.7,33.9],[132.4,33.8],[135.2,33.4],[136.9,34.3],[139.8,34.9],[140.9,35.6],[142.1,39.6],[141.5,41.5],[140.2,41.3],[139.5,38.2],[136.6,36.8],[133.1,35.5],[130.8,34.4]] },
    { code: 'JP_KYU', zh: '日本 九州', biome: 'temperate', base: 30, hill: 440, poly: [[129.5,31.2],[131.5,31.3],[131.9,33.4],[130.9,33.95],[129.6,33.5]] },
    { code: 'JP_SHK', zh: '日本 四國', biome: 'temperate', base: 32, hill: 460, poly: [[132.0,32.7],[134.8,33.2],[134.7,34.4],[132.4,34.1]] },
    { code: 'JP_HKD', zh: '日本 北海道', biome: 'boreal', base: 42, hill: 480, poly: [[139.7,41.4],[143.5,41.9],[145.8,43.4],[144.3,45.4],[141.6,45.5],[140.9,43.3],[139.7,42.4]] },
    { code: 'KR', zh: '韓國', biome: 'temperate', base: 26, hill: 320, poly: [[126.0,34.2],[129.2,34.8],[129.6,36.6],[128.6,38.5],[126.1,38.0],[126.1,36.2]] },
    { code: 'KR_CJU', zh: '濟州島', biome: 'temperate', base: 24, hill: 380, poly: [[126.1,33.15],[126.98,33.2],[126.98,33.62],[126.1,33.58]] },
    { code: 'KP', zh: '北韓', biome: 'temperate', base: 58, hill: 520, poly: [[124.2,37.8],[128.6,38.3],[130.7,42.3],[129.5,42.9],[126.5,41.8],[124.1,39.8]] },
    { code: 'CN', zh: '中國', biome: 'temperate', base: 65, hill: 620, poly: [[74,38],[82,46],[95,49.5],[116,49.8],[122,53.5],[135,48.5],[131,42.5],[124.2,39.8],[121.5,38.8],[122.8,37.2],[119.5,35.0],[122.2,31.2],[122.2,29.5],[120.6,27.2],[117.2,23.5],[114.4,22.2],[113.1,21.9],[109.5,20.2],[108.0,21.5],[103,22.5],[97.5,24.2],[92,27.8],[84,28.5],[78,32.5]] },
    { code: 'CN_HN', zh: '海南島', biome: 'tropical', base: 24, hill: 340, poly: [[108.6,18.1],[111.1,18.4],[111.0,20.2],[108.8,20.0]] },
    { code: 'MN', zh: '蒙古高原', biome: 'arid', base: 420, hill: 680, poly: [[87.8,45.5],[95.0,50.5],[115.5,50.2],[119.8,46.8],[111.5,42.5],[96.0,42.5]] },
    { code: 'PH', zh: '菲律賓 呂宋', biome: 'tropical', base: 22, hill: 340, poly: [[119.6,12.8],[124.2,12.6],[122.6,18.6],[120.0,18.5]] },
    { code: 'PH_S', zh: '菲律賓 中南部', biome: 'tropical', base: 24, hill: 300, poly: [[121.6,5.5],[126.6,5.5],[126.6,12.5],[121.8,12.2]] },
    { code: 'SEA', zh: '中南半島 (越泰寮柬)', biome: 'tropical', base: 24, hill: 260, poly: [[96.2,16.5],[98.5,21.5],[104.8,22.9],[108.5,21.6],[109.5,12.8],[106.8,8.6],[104.4,10.2],[101.2,12.5],[100.1,13.4],[98.2,8.0],[99.6,13.8],[97.2,15.5]] },
    { code: 'BD_MM', zh: '緬甸／孟加拉', biome: 'tropical', base: 34, hill: 420, poly: [[88.0,21.5],[88.5,26.8],[97.8,28.2],[98.8,21.2],[96.2,16.0],[94.2,16.0],[91.5,22.0]] },
    { code: 'MY', zh: '馬來西亞／新加坡', biome: 'tropical', base: 18, hill: 190, poly: [[99.6,6.8],[102.5,6.3],[104.4,1.18],[103.3,1.15],[101.1,2.8],[99.8,5.4]] },
    { code: 'ID_B', zh: '婆羅洲', biome: 'tropical', base: 24, hill: 340, poly: [[108.8,-3.5],[117.8,-4.2],[119.2,5.8],[115.2,7.1],[109.2,1.6]] },
    { code: 'ID_S', zh: '蘇門答臘', biome: 'tropical', base: 22, hill: 380, poly: [[95.1,5.8],[99.8,3.6],[106.1,-6.0],[103.5,-5.8],[97.0,1.0]] },
    { code: 'ID_J', zh: '爪哇島／峇里島', biome: 'tropical', base: 26, hill: 350, poly: [[105.1,-5.8],[115.8,-8.8],[115.8,-7.4],[106.0,-5.7]] },
    { code: 'ID_SUL', zh: '蘇拉威西／摩鹿加', biome: 'tropical', base: 35, hill: 460, poly: [[118.8,-5.6],[125.4,-5.4],[125.6,1.8],[119.5,1.4]] },
    { code: 'PG', zh: '新幾內亞', biome: 'tropical', base: 48, hill: 820, poly: [[131.0,-4.5],[141.0,-9.2],[150.8,-10.5],[148.0,-5.5],[141.0,-2.5],[132.0,-1.0]] },
    { code: 'IN', zh: '印度', biome: 'tropical', base: 48, hill: 360, poly: [[68.1,23.5],[71.2,31.8],[78.8,33.2],[88.5,27.2],[92.0,22.4],[85.5,19.3],[80.3,12.8],[77.5,7.9],[74.8,13.0],[72.5,19.1],[68.8,22.2]] },
    { code: 'LK', zh: '斯里蘭卡', biome: 'tropical', base: 26, hill: 320, poly: [[79.6,5.9],[81.9,6.2],[81.8,9.8],[79.7,9.6]] },
    { code: 'PK_AF', zh: '巴基斯坦／阿富汗', biome: 'arid', base: 180, hill: 920, poly: [[60.8,25.2],[61.2,36.8],[71.5,37.5],[75.5,35.8],[71.5,31.2],[68.2,23.8]] },
    { code: 'KZ_CA', zh: '哈薩克／中亞', biome: 'arid', base: 140, hill: 480, poly: [[46.5,45.0],[52.0,54.5],[78.0,54.0],[86.5,48.5],[75.0,38.0],[61.0,36.5],[52.0,38.5]] },
    { code: 'RU_SIB', zh: '俄羅斯西伯利亞', biome: 'boreal', base: 95, hill: 440, poly: [[64.5,54.0],[64.5,72.5],[135.0,73.5],[135.0,49.0],[116.0,49.5],[86.0,49.0]] },
    { code: 'RU_FE', zh: '俄羅斯遠東／堪察加', biome: 'boreal', base: 85, hill: 540, poly: [[134.5,43.0],[134.5,71.0],[179.5,68.5],[178.0,62.0],[160.0,51.0],[142.0,53.0],[135.5,45.0]] },
    // Middle East & Turkey
    { code: 'TR', zh: '土耳其', biome: 'mediterranean', base: 140, hill: 540, poly: [[26.0,40.0],[28.2,41.9],[41.8,41.8],[44.8,39.5],[43.5,37.0],[35.8,36.0],[27.0,36.5]] },
    { code: 'IL_JO', zh: '黎凡特／地中海東岸', biome: 'arid', base: 85, hill: 340, poly: [[34.2,29.5],[35.6,37.0],[42.5,37.2],[42.0,32.0],[35.0,29.5]] },
    { code: 'AE', zh: '阿拉伯半島／阿聯／卡達', biome: 'arid', base: 24, hill: 180, poly: [[34.8,29.5],[39.5,32.5],[48.5,30.2],[51.6,26.3],[56.6,26.4],[59.9,22.5],[54.0,16.5],[43.2,12.5],[39.0,21.0],[34.8,28.0]] },
    { code: 'IR', zh: '伊朗／美索不達米亞', biome: 'arid', base: 180, hill: 640, poly: [[42.0,37.2],[48.8,39.5],[61.2,36.8],[61.5,25.2],[56.2,26.8],[48.2,30.0],[42.0,33.0]] },
    // Europe (Complete Continental & Island Coverage)
    { code: 'GB', zh: '英國', biome: 'temperate', base: 22, hill: 180, poly: [[-5.8,49.9],[1.9,51.1],[1.6,53.5],[-1.6,58.7],[-6.4,58.5],[-5.2,54.0]] },
    { code: 'IE', zh: '愛爾蘭', biome: 'temperate', base: 22, hill: 140, poly: [[-10.5,51.4],[-5.9,52.1],[-5.8,55.4],[-10.1,54.5]] },
    { code: 'FR', zh: '法國', biome: 'temperate', base: 44, hill: 290, poly: [[-4.9,48.5],[2.6,51.2],[8.2,49.0],[7.6,47.5],[7.6,43.7],[5.2,43.2],[3.1,42.4],[-1.9,43.3],[-1.6,46.8]] },
    { code: 'ES', zh: '西班牙／葡萄牙', biome: 'mediterranean', base: 120, hill: 480, poly: [[-9.6,36.8],[-9.4,43.8],[-1.7,43.5],[3.4,42.4],[0.6,40.6],[-0.5,37.6],[-5.6,36.0]] },
    { code: 'DE', zh: '德國／荷比盧／丹麥', biome: 'temperate', base: 42, hill: 310, poly: [[2.5,51.0],[4.6,53.5],[8.2,57.6],[11.0,57.5],[14.8,54.2],[15.1,50.8],[13.6,47.5],[7.5,47.5],[5.8,49.5]] },
    { code: 'CH', zh: '瑞士／奧地利／阿爾卑斯', biome: 'alpine', base: 360, hill: 1650, poly: [[5.8,45.8],[7.5,47.8],[17.2,48.9],[17.2,46.4],[13.5,45.6],[7.0,45.5]] },
    { code: 'IT', zh: '義大利半島', biome: 'mediterranean', base: 38, hill: 520, poly: [[6.8,45.9],[13.9,46.6],[14.0,44.5],[18.6,40.1],[15.6,37.9],[12.1,41.6],[9.8,44.1],[7.5,43.8]] },
    { code: 'MED_IS', zh: '西西里／撒丁尼亞／科西嘉', biome: 'mediterranean', base: 32, hill: 380, poly: [[8.1,38.8],[9.9,38.9],[9.7,43.0],[8.4,42.8]] },
    { code: 'PL_CE', zh: '波蘭／捷克／匈牙利', biome: 'temperate', base: 72, hill: 340, poly: [[14.0,50.5],[14.2,54.8],[24.0,54.5],[24.5,47.5],[16.8,46.5],[12.2,50.2]] },
    { code: 'GR_BK', zh: '希臘／巴爾幹半島', biome: 'mediterranean', base: 68, hill: 540, poly: [[13.6,45.6],[20.5,46.2],[29.0,44.5],[28.2,41.2],[26.2,40.5],[24.2,37.8],[22.0,36.4],[19.2,39.8],[15.5,43.8]] },
    { code: 'RO_UA', zh: '羅馬尼亞／烏克蘭', biome: 'temperate', base: 78, hill: 320, poly: [[22.0,44.2],[23.5,52.0],[40.2,52.0],[40.0,46.5],[30.5,46.0],[28.5,43.8]] },
    { code: 'FI_BA', zh: '芬蘭／波羅的海三國', biome: 'boreal', base: 46, hill: 220, poly: [[20.8,54.5],[21.0,60.5],[20.5,69.5],[31.0,70.0],[31.5,59.5],[27.5,54.5]] },
    { code: 'SC', zh: '挪威／瑞典斯堪地那維亞', biome: 'boreal', base: 85, hill: 640, poly: [[4.8,58.2],[11.5,57.5],[19.0,59.2],[24.5,65.8],[30.8,71.0],[18.0,70.5],[11.5,65.5],[4.8,61.0]] },
    { code: 'EE', zh: '俄羅斯歐洲區／東歐平原', biome: 'temperate', base: 85, hill: 220, poly: [[27.0,52.0],[30.0,69.5],[65.0,69.5],[65.0,45.0],[44.5,39.5],[37.5,44.5],[32.0,46.5]] },
    // Africa
    { code: 'EG', zh: '埃及／蘇丹與東北非', biome: 'arid', base: 42, hill: 240, poly: [[24.5,31.8],[34.8,31.5],[35.2,29.5],[43.5,11.5],[51.4,11.9],[45.0,1.5],[33.5,3.5],[24.5,14.0]] },
    { code: 'MA_DZ', zh: '摩洛哥／阿爾及利亞／突尼西亞', biome: 'arid', base: 95, hill: 480, poly: [[-13.5,27.5],[-9.8,35.8],[11.2,37.4],[11.8,32.5],[10.0,22.0],[-13.5,21.0]] },
    { code: 'LY', zh: '利比亞／撒哈拉中部', biome: 'arid', base: 85, hill: 280, poly: [[10.0,33.2],[25.0,32.0],[25.0,15.0],[10.0,15.0]] },
    { code: 'NA_AF', zh: '西非與薩赫勒', biome: 'arid', base: 75, hill: 290, poly: [[-17.6,14.5],[-16.8,21.5],[15.0,21.5],[15.0,4.2],[2.5,6.0],[-8.2,4.3],[-16.6,11.0]] },
    { code: 'KE_EA', zh: '肯亞／坦尚尼亞／東非高原', biome: 'tropical', base: 280, hill: 780, poly: [[29.0,4.5],[45.5,2.5],[40.8,-11.5],[29.5,-11.5]] },
    { code: 'ZA', zh: '南非與中南非洲', biome: 'temperate', base: 260, hill: 680, poly: [[11.5,4.2],[33.5,4.0],[41.0,-10.5],[40.6,-15.5],[35.5,-24.2],[28.5,-34.2],[18.0,-34.9],[14.2,-22.5],[11.6,-6.0]] },
    { code: 'MG', zh: '馬達加斯加', biome: 'tropical', base: 65, hill: 320, poly: [[43.2,-25.6],[47.5,-25.2],[50.5,-15.2],[49.3,-11.9],[44.8,-16.0],[43.1,-22.0]] },
    // North America & Caribbean
    { code: 'US', zh: '美國本土', biome: 'temperate', base: 68, hill: 560, poly: [[-124.8,48.9],[-110.0,49.0],[-95.0,49.0],[-82.5,46.0],[-74.5,45.2],[-66.9,45.0],[-69.8,41.5],[-73.5,40.5],[-75.5,38.5],[-75.5,35.2],[-81.2,31.0],[-80.0,25.1],[-82.8,27.8],[-84.5,29.8],[-89.2,29.0],[-97.2,25.9],[-106.5,31.8],[-117.2,32.5],[-120.6,34.5],[-122.6,37.8],[-124.6,42.5]] },
    { code: 'AK', zh: '阿拉斯加', biome: 'boreal', base: 44, hill: 620, poly: [[-168.2,65.8],[-156.5,71.4],[-141.0,69.8],[-141.0,59.5],[-130.5,54.8],[-151.5,59.2],[-166.5,53.8],[-165.0,62.2]] },
    { code: 'CA', zh: '加拿大', biome: 'boreal', base: 92, hill: 540, poly: [[-141.0,69.8],[-122.0,70.5],[-95.0,69.5],[-78.0,63.0],[-64.0,60.5],[-52.6,47.5],[-60.0,45.5],[-66.9,45.0],[-75.0,45.0],[-83.0,46.0],[-95.0,49.0],[-123.5,49.0],[-131.0,54.5],[-141.0,60.0]] },
    { code: 'MX', zh: '墨西哥／中美洲', biome: 'arid', base: 180, hill: 720, poly: [[-117.2,32.5],[-106.5,31.8],[-97.2,26.0],[-96.0,19.2],[-86.8,21.5],[-83.2,15.0],[-77.2,7.5],[-83.5,8.5],[-92.5,14.5],[-105.5,19.8],[-110.5,23.5],[-115.5,30.0]] },
    { code: 'CU_CB', zh: '古巴／加勒比海群島', biome: 'tropical', base: 24, hill: 280, poly: [[-85.0,21.5],[-74.0,20.0],[-68.3,18.0],[-78.0,17.8],[-84.8,22.8]] },
    { code: 'GL', zh: '格陵蘭', biome: 'alpine', base: 380, hill: 850, poly: [[-52,60],[-43,60],[-34,68],[-20,74],[-18,82],[-32,83.5],[-50,82.5],[-68,77],[-58,70],[-53,64]] },
    { code: 'HI', zh: '夏威夷群島', biome: 'tropical', base: 18, hill: 320, poly: [[-160.3,22.3],[-157.5,21.6],[-154.8,19.5],[-155.8,18.9],[-158.3,21.2],[-159.8,21.8]] },
    // South America
    { code: 'CO', zh: '哥倫比亞／委內瑞拉／安地斯北麓', biome: 'tropical', base: 180, hill: 980, poly: [[-78.0,8.8],[-71.5,12.4],[-60.0,10.5],[-52.0,4.5],[-68.0,1.5],[-70.0,-6.0],[-79.5,-5.0],[-81.2,-4.5],[-79.2,2.2]] },
    { code: 'PE_BO', zh: '秘魯／玻利維亞／厄瓜多', biome: 'alpine', base: 240, hill: 1450, poly: [[-81.4,-4.2],[-70.0,-4.0],[-57.8,-18.0],[-68.0,-22.5],[-71.5,-18.2],[-77.5,-12.0]] },
    { code: 'BR', zh: '巴西', biome: 'tropical', base: 110, hill: 340, poly: [[-70.0,-4.2],[-51.5,4.2],[-48.5,-0.5],[-34.7,-6.8],[-38.2,-13.5],[-40.5,-22.8],[-48.5,-28.0],[-53.5,-33.8],[-58.2,-27.5],[-60.0,-16.0],[-70.0,-9.5]] },
    { code: 'AR', zh: '智利／阿根廷／烏拉圭', biome: 'alpine', base: 180, hill: 1350, poly: [[-71.5,-18.0],[-57.5,-20.0],[-53.2,-33.5],[-57.0,-38.0],[-65.0,-43.0],[-67.5,-55.2],[-75.5,-52.0],[-74.0,-41.5],[-71.8,-33.0]] },
    // Oceania
    { code: 'AU', zh: '澳洲大陸', biome: 'arid', base: 65, hill: 280, poly: [[113.5,-22.0],[122.2,-17.0],[131.0,-11.8],[137.0,-12.2],[142.5,-10.7],[146.5,-18.2],[153.7,-27.5],[151.4,-34.2],[150.0,-37.6],[144.6,-38.5],[138.0,-35.6],[132.0,-32.0],[122.0,-34.2],[115.0,-34.4],[113.2,-26.0]] },
    { code: 'AU_TAS', zh: '塔斯馬尼亞', biome: 'temperate', base: 45, hill: 380, poly: [[144.5,-40.6],[148.4,-40.8],[148.2,-43.6],[145.0,-43.5]] },
    { code: 'NZ', zh: '紐西蘭南北島', biome: 'temperate', base: 36, hill: 620, poly: [[172.5,-34.3],[178.6,-37.6],[175.4,-41.6],[172.6,-43.8],[166.4,-46.4],[167.2,-44.0],[173.6,-38.8],[174.4,-36.5]] }
  ];

  const COUNTRY_BBOX = COUNTRIES.map(c => {
    let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
    for (const [lon, lat] of c.poly) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    return { ...c, minLon, maxLon, minLat, maxLat };
  });

  const LANDMASSES = COUNTRIES.map(c => c.poly);

  // Major World Mountain Ranges for realistic 3D continental topography
  const MAJOR_MOUNTAIN_RANGES = [
    { name: 'Alps', lat: 46.5, lon: 9.8, rLat: 1.4, rLon: 3.6, peak: 2250 },
    { name: 'Pyrenees', lat: 42.6, lon: 0.5, rLat: 0.65, rLon: 2.1, peak: 1450 },
    { name: 'Apennines', lat: 42.4, lon: 13.4, rLat: 1.8, rLon: 1.2, peak: 980 },
    { name: 'Carpathians', lat: 47.2, lon: 24.5, rLat: 1.6, rLon: 2.5, peak: 1150 },
    { name: 'Scandinavian', lat: 62.5, lon: 8.5, rLat: 3.5, rLon: 2.2, peak: 1180 },
    { name: 'Caucasus', lat: 42.8, lon: 44.5, rLat: 0.9, rLon: 3.2, peak: 2400 },
    { name: 'Himalayas', lat: 28.8, lon: 85.5, rLat: 2.4, rLon: 7.5, peak: 3800 },
    { name: 'TibetanPlateau', lat: 33.2, lon: 88.0, rLat: 3.8, rLon: 8.5, peak: 2600 },
    { name: 'JapaneseAlps', lat: 36.2, lon: 137.6, rLat: 1.1, rLon: 0.9, peak: 1450 },
    { name: 'RockiesNorth', lat: 51.5, lon: -116.5, rLat: 3.5, rLon: 2.8, peak: 1950 },
    { name: 'RockiesUS', lat: 39.8, lon: -106.5, rLat: 4.5, rLon: 3.2, peak: 2150 },
    { name: 'SierraNevada', lat: 37.2, lon: -119.2, rLat: 2.2, rLon: 1.2, peak: 1750 },
    { name: 'Cascades', lat: 46.8, lon: -121.6, rLat: 2.4, rLon: 1.1, peak: 1650 },
    { name: 'SierraMadre', lat: 23.5, lon: -104.5, rLat: 3.5, rLon: 2.6, peak: 1450 },
    { name: 'AndesNorth', lat: -6.5, lon: -77.5, rLat: 6.5, rLon: 2.2, peak: 2450 },
    { name: 'AndesCentral', lat: -21.0, lon: -67.5, rLat: 6.5, rLon: 2.4, peak: 2650 },
    { name: 'AndesSouth', lat: -34.5, lon: -70.0, rLat: 6.5, rLon: 1.6, peak: 2350 },
    { name: 'AtlasMountains', lat: 31.8, lon: -5.5, rLat: 1.6, rLon: 4.5, peak: 1550 },
    { name: 'EthiopianHighlands', lat: 9.5, lon: 38.8, rLat: 2.8, rLon: 2.8, peak: 1650 },
    { name: 'GreatDividingRange', lat: -35.8, lon: 148.5, rLat: 3.2, rLon: 1.6, peak: 980 },
    { name: 'SouthernAlpsNZ', lat: -43.6, lon: 170.2, rLat: 1.6, rLon: 1.2, peak: 1650 }
  ];

  const REGION_LABELS = [
    { name: 'NORTH AMERICA · 北美洲', lon: -102, lat: 45 },
    { name: 'SOUTH AMERICA · 南美洲', lon: -58, lat: -14 },
    { name: 'EUROPE · 歐洲', lon: 14, lat: 51 },
    { name: 'AFRICA · 非洲', lon: 20, lat: 5 },
    { name: 'ASIA · 亞洲', lon: 94, lat: 42 },
    { name: 'OCEANIA · 大洋洲', lon: 134, lat: -25 },
    { name: 'PACIFIC OCEAN · 太平洋', lon: -160, lat: 8, ocean: true },
    { name: 'ATLANTIC OCEAN · 大西洋', lon: -36, lat: 24, ocean: true },
    { name: 'INDIAN OCEAN · 印度洋', lon: 78, lat: -15, ocean: true }
  ];

  // Natural Earth 1:50m decoded world geometry + spatial grid index
  let neDecoded = null;
  const neLandCache = new Map();

  function decodeNEList(list, u) {
    if (!Array.isArray(list)) return [];
    return list.map(a => {
      const n = a.length >> 1;
      const ring = new Array(n);
      let x = a[0], y = a[1];
      let minLon = x / u, maxLon = minLon, minLat = y / u, maxLat = minLat;
      ring[0] = [minLon, minLat];
      for (let i = 1; i < n; i++) {
        x += a[i * 2];
        y += a[i * 2 + 1];
        const lon = x / u, lat = y / u;
        ring[i] = [lon, lat];
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
      return { ring, minLon, maxLon, minLat, maxLat };
    });
  }

  function ensureNaturalEarth() {
    if (neDecoded) return neDecoded;
    let srcData = typeof asiaMapData !== 'undefined' ? asiaMapData : (typeof globalThis !== 'undefined' ? globalThis.asiaMapData : null);
    if (!srcData && typeof require === 'function') {
      try {
        const fs = require('fs'), path = require('path');
        const p = path.join(__dirname, 'asia-map-data.js');
        if (fs.existsSync(p)) {
          srcData = new Function(fs.readFileSync(p, 'utf8') + ';return asiaMapData;')();
          if (typeof globalThis !== 'undefined') globalThis.asiaMapData = srcData;
        }
      } catch {}
    }
    if (!srcData || !Array.isArray(srcData.land)) return null;
    const u = srcData.u || 50;
    const land = decodeNEList(srcData.land, u);
    const lakes = decodeNEList(srcData.lakes, u);
    const rivers = decodeNEList(srcData.rivers, u);
    const borders = decodeNEList(srcData.borders, u);
    const roadsMajor = decodeNEList(srcData.roadsMajor, u);
    const countries = Array.isArray(srcData.countries) ? srcData.countries : [];

    // Build 4° x 4° spatial bucket index for sub-microsecond 3D terrain point-in-polygon queries
    const grid = new Map();
    for (let idx = 0; idx < land.length; idx++) {
      const p = land[idx];
      const gx0 = Math.floor((p.minLon + 180) / 4), gx1 = Math.floor((p.maxLon + 180) / 4);
      const gy0 = Math.floor((p.minLat + 90) / 4), gy1 = Math.floor((p.maxLat + 90) / 4);
      for (let gy = gy0; gy <= gy1; gy++) {
        for (let gx = gx0; gx <= gx1; gx++) {
          const k = (gy << 8) | (gx & 255);
          let cell = grid.get(k);
          if (!cell) { cell = []; grid.set(k, cell); }
          cell.push(p);
        }
      }
    }
    neDecoded = { land, lakes, rivers, borders, roadsMajor, countries, grid };
    return neDecoded;
  }

  function wrapLon(lon) {
    const v = ((lon + 180) % 360 + 360) % 360 - 180;
    return v === -180 && lon > 0 ? 180 : v;
  }

  function pointInRing(lon, lat, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1];
      const xj = poly[j][0], yj = poly[j][1];
      const hit = ((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-12) + xi);
      if (hit) inside = !inside;
    }
    return inside;
  }

  function isNaturalEarthLand(lon, lat) {
    const ne = ensureNaturalEarth();
    if (!ne) return false;
    const wLon = wrapLon(lon);
    if (lat < -62 || lat > 84) return false;
    const qKey = `${Math.round(wLon * 250)}:${Math.round(lat * 250)}`;
    const cached = neLandCache.get(qKey);
    if (cached !== undefined) return cached;

    const gx = Math.floor((wLon + 180) / 4), gy = Math.floor((lat + 90) / 4);
    const cell = ne.grid.get((gy << 8) | (gx & 255));
    let onLand = false;
    if (cell) {
      for (let i = 0; i < cell.length; i++) {
        const p = cell[i];
        if (wLon < p.minLon || wLon > p.maxLon || lat < p.minLat || lat > p.maxLat) continue;
        if (pointInRing(wLon, lat, p.ring)) { onLand = true; break; }
      }
    }
    if (onLand) {
      for (let i = 0; i < ne.lakes.length; i++) {
        const lk = ne.lakes[i];
        if (wLon < lk.minLon || wLon > lk.maxLon || lat < lk.minLat || lat > lk.maxLat) continue;
        if (pointInRing(wLon, lat, lk.ring)) { onLand = false; break; }
      }
    }
    if (neLandCache.size > 45000) neLandCache.clear();
    neLandCache.set(qKey, onLand);
    return onLand;
  }

  function inferFallbackCountry(lon, lat) {
    const absLat = Math.abs(lat);
    const biome = absLat > 56 ? 'boreal' : absLat < 23.5 ? 'tropical' : (lat >= 24 && lat <= 41 && lon >= -12 && lon <= 62) ? 'arid' : 'temperate';
    return { code: 'GLOBAL_LAND', zh: '全球大陸領地', biome, base: 36, hill: 340 };
  }

  function countryAt(lon, lat) {
    const wLon = wrapLon(lon);
    let exact = null;
    for (let i = 0; i < COUNTRY_BBOX.length; i++) {
      const c = COUNTRY_BBOX[i];
      if (wLon < c.minLon || wLon > c.maxLon || lat < c.minLat || lat > c.maxLat) continue;
      if (pointInRing(wLon, lat, c.poly)) { exact = c; break; }
    }
    const ne = ensureNaturalEarth();
    if (ne) {
      // When Natural Earth 1:50m is available, respect real coastlines & islands while using COUNTRIES for regional biome/elevation
      if (isNaturalEarthLand(wLon, lat)) {
        if (exact) return exact;
        // Find nearest country bbox for biome inheritance
        let best = null, bestD = 900;
        for (let i = 0; i < COUNTRY_BBOX.length; i++) {
          const c = COUNTRY_BBOX[i];
          const clat = (c.minLat + c.maxLat) * 0.5, clon = (c.minLon + c.maxLon) * 0.5;
          const d = Math.hypot(wLon - clon, lat - clat);
          if (d < bestD) { bestD = d; best = c; }
        }
        return best || inferFallbackCountry(wLon, lat);
      }
      // Guarantee land peninsula within ~14 km of all non-carrier international airports so coastal airports never sit in water
      if (typeof allAirports !== 'undefined' && Array.isArray(allAirports)) {
        for (let i = 0; i < allAirports.length; i++) {
          const ap = allAirports[i];
          if (ap.carrier || ap.region === 'tw') continue;
          if (Math.abs(lat - ap.lat) < 0.14 && Math.abs(wLon - ap.lon) < 0.16) {
            const dKm = Math.hypot((lat - ap.lat) * 111, (wLon - ap.lon) * 111 * Math.cos(lat * Math.PI / 180));
            if (dKm < 14.5) return exact || inferFallbackCountry(wLon, lat);
          }
        }
      }
      return exact;
    }
    return exact;
  }

  // Real-World Global 30m SRTM Digital Elevation Model (AWS Mapzen Terrarium z=10 RGB PNGs, CORS-enabled)
  const demCache = new Map();
  const demListeners = new Set();
  let demLoading = 0;
  let demCanvas = null, demCtx = null;

  function onDemLoad(fn) {
    if (typeof fn === 'function') demListeners.add(fn);
  }
  function notifyDemListeners() {
    for (const fn of demListeners) { try { fn(); } catch {} }
  }
  function demLonLatToTileFrac(lon, lat, z = 10) {
    const n = 1 << z;
    const wLon = wrapLon(lon);
    const clampedLat = Math.max(-84.5, Math.min(84.5, lat)) * Math.PI / 180;
    const fx = ((wLon + 180) / 360) * n;
    const fy = (1 - Math.log(Math.tan(clampedLat) + 1 / Math.cos(clampedLat)) / Math.PI) * 0.5 * n;
    const tx = ((Math.floor(fx) % n) + n) % n;
    const ty = Math.max(0, Math.min(n - 1, Math.floor(fy)));
    return { tx, ty, u: fx - Math.floor(fx), v: fy - Math.floor(fy) };
  }
  function requestDEMTile(tx, ty) {
    if (typeof Image === 'undefined' || typeof document === 'undefined' || !document.createElement) return;
    const key = `10:${tx}:${ty}`;
    if (demCache.has(key) || demLoading >= 6) return;
    demCache.set(key, { state: 'loading', data: null });
    demLoading++;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      demLoading = Math.max(0, demLoading - 1);
      try {
        if (!demCanvas) {
          demCanvas = document.createElement('canvas');
          demCanvas.width = 256; demCanvas.height = 256;
          demCtx = demCanvas.getContext('2d', { willReadFrequently: true });
        }
        if (demCtx && typeof demCtx.getImageData === 'function') {
          demCtx.clearRect(0, 0, 256, 256);
          demCtx.drawImage(img, 0, 0, 256, 256);
          const rgba = demCtx.getImageData(0, 0, 256, 256).data;
          const elev = new Float32Array(256 * 256);
          for (let i = 0, p = 0; i < 65536; i++, p += 4) {
            const h = (rgba[p] * 256 + rgba[p + 1] + rgba[p + 2] / 256) - 32768;
            elev[i] = h > 0.2 ? h : 0;
          }
          demCache.set(key, { state: 'ready', data: elev });
          while (demCache.size > 72) {
            const oldest = demCache.keys().next().value;
            demCache.delete(oldest);
          }
          notifyDemListeners();
          return;
        }
      } catch {}
      demCache.set(key, { state: 'error', data: null });
    };
    img.onerror = () => {
      demLoading = Math.max(0, demLoading - 1);
      demCache.set(key, { state: 'error', data: null });
    };
    img.src = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/10/${tx}/${ty}.png`;
  }
  function prefetchDEM(lon, lat) {
    const { tx, ty } = demLonLatToTileFrac(lon, lat, 10);
    const n = 1024;
    for (let dy = -1; dy <= 1; dy++) {
      const ny = ty + dy;
      if (ny < 0 || ny >= n) continue;
      for (let dx = -1; dx <= 1; dx++) {
        requestDEMTile(((tx + dx) % n + n) % n, ny);
      }
    }
  }
  function sampleRealDEM(lon, lat) {
    if (typeof Image === 'undefined') return null;
    const { tx, ty, u, v } = demLonLatToTileFrac(lon, lat, 10);
    const key = `10:${tx}:${ty}`;
    const entry = demCache.get(key);
    if (!entry) {
      requestDEMTile(tx, ty);
      return null;
    }
    if (entry.state !== 'ready' || !entry.data) return null;
    const px = Math.max(0, Math.min(254.999, u * 255));
    const py = Math.max(0, Math.min(254.999, v * 255));
    const x0 = px | 0, y0 = py | 0;
    const fx = px - x0, fy = py - y0;
    const d = entry.data;
    const h00 = d[y0 * 256 + x0], h10 = d[y0 * 256 + x0 + 1];
    const h01 = d[(y0 + 1) * 256 + x0], h11 = d[(y0 + 1) * 256 + x0 + 1];
    return (h00 * (1 - fx) + h10 * fx) * (1 - fy) + (h01 * (1 - fx) + h11 * fx) * fy;
  }

  function globalLandElevation(lon, lat, x = 0, z = 0) {
    const realH = sampleRealDEM(lon, lat);
    if (realH !== null) return realH;
    const c = countryAt(lon, lat);
    if (!c) return 0;
    const wLon = wrapLon(lon);
    const w1 = Math.sin(x * 0.000085 + wLon * 0.6) * Math.cos(z * 0.000085 - lat * 0.5);
    const w2 = Math.sin(x * 0.00031 - z * 0.00024) * 0.5 + 0.5;
    const w3 = Math.sin(x * 0.000024 + z * 0.000019) * 0.5 + 0.5;
    const ridge = Math.pow(Math.max(0, w1 * 0.55 + w2 * 0.25 + w3 * 0.20), 1.38);
    const fine = Math.sin(x * 0.0012) * Math.cos(z * 0.0011) * 4.5;
    let mtnBoost = 0;
    for (let i = 0; i < MAJOR_MOUNTAIN_RANGES.length; i++) {
      const m = MAJOR_MOUNTAIN_RANGES[i];
      const dLat = (lat - m.lat) / m.rLat, dLon = (wLon - m.lon) / m.rLon;
      const d2 = dLat * dLat + dLon * dLon;
      if (d2 < 2.2) {
        const env = Math.exp(-d2 * 1.35) * (0.65 + 0.35 * Math.sin(x * 0.00017 + z * 0.00013));
        if (m.peak * env > mtnBoost) mtnBoost = m.peak * env;
      }
    }
    return Math.max(2.4, c.base + ridge * c.hill + mtnBoost + fine);
  }

  function greatCircleGeoPoints(from, to, steps = 20) {
    if (!from || !to) return [];
    const r = Math.PI / 180;
    const lat1 = from.lat * r, lon1 = from.lon * r;
    const lat2 = to.lat * r, lon2 = to.lon * r;
    const p1 = [Math.cos(lat1) * Math.cos(lon1), Math.cos(lat1) * Math.sin(lon1), Math.sin(lat1)];
    const p2 = [Math.cos(lat2) * Math.cos(lon2), Math.cos(lat2) * Math.sin(lon2), Math.sin(lat2)];
    const dot = Math.max(-1, Math.min(1, p1[0] * p2[0] + p1[1] * p2[1] + p1[2] * p2[2]));
    const omega = Math.acos(dot);
    if (omega < 1e-5) return [{ lat: from.lat, lon: from.lon }, { lat: to.lat, lon: to.lon }];
    const sinO = Math.sin(omega);
    const out = [];
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const a = Math.sin((1 - f) * omega) / sinO;
      const b = Math.sin(f * omega) / sinO;
      const x = a * p1[0] + b * p2[0];
      const y = a * p1[1] + b * p2[1];
      const z = a * p1[2] + b * p2[2];
      out.push({ lat: Math.atan2(z, Math.hypot(x, y)) / r, lon: Math.atan2(y, x) / r });
    }
    return out;
  }

  const BIOME_COLORS = {
    temperate: '#2d5230',
    tropical: '#1f4926',
    arid: '#7c6b4b',
    mediterranean: '#4b663b',
    boreal: '#394f43',
    alpine: '#646e6a'
  };

  // Shared Google Maps Satellite tile cache for WorldAtlas (2D projections & in-flight radar)
  const satCache = new Map();
  let basePrewarmed = false;

  function getSatTile(lyrs, z, x, y, onReady) {
    if (!lyrs || typeof Image === 'undefined') return null;
    const n = 1 << z;
    if (y < 0 || y >= n) return null;
    const tx = ((x % n) + n) % n;
    const key = `${lyrs}:${z}:${tx}:${y}`;
    let e = satCache.get(key);
    if (e) {
      if (e.state === 'loading' && onReady) e.waiters.add(onReady);
      return e;
    }
    const img = new Image();
    e = { img, state: 'loading', waiters: new Set(onReady ? [onReady] : []) };
    satCache.set(key, e);
    const done = st => {
      e.state = st;
      for (const fn of e.waiters) { try { fn(); } catch {} }
      e.waiters.clear();
    };
    img.onload = () => done('ready');
    img.onerror = () => {
      if (!e.fallback) {
        e.fallback = true;
        img.src = `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${tx}`;
      } else {
        done('error');
      }
    };
    img.referrerPolicy = 'no-referrer';
    img.src = `https://mt${(tx + y) & 3}.google.com/vt/lyrs=${lyrs}&hl=zh-TW&x=${tx}&y=${y}&z=${z}`;
    while (satCache.size > 520) {
      const firstKey = satCache.keys().next().value;
      satCache.delete(firstKey);
    }
    return e;
  }

  function findAncestorSatTile(lyrs, z, x, y) {
    const n = 1 << z;
    const tx = ((x % n) + n) % n;
    for (let pz = z - 1; pz >= 1; pz--) {
      const shift = z - pz;
      const pEntry = satCache.get(`${lyrs}:${pz}:${tx >> shift}:${y >> shift}`);
      if (pEntry && pEntry.state === 'ready') {
        const sc = 1 << shift, sub = 256 / sc;
        return {
          img: pEntry.img,
          sx: (tx & (sc - 1)) * sub,
          sy: (y & (sc - 1)) * sub,
          sw: sub,
          sh: sub
        };
      }
    }
    return null;
  }

  function tileLon(tx, n) { return (tx / n) * 360 - 180; }
  function tileLat(ty, n) {
    const u = Math.PI - (2 * Math.PI * ty) / n;
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(u) - Math.exp(-u)));
  }
  function lonToTileX(lon, n) { return Math.floor(((lon + 180) / 360) * n); }
  function latToTileY(lat, n) {
    const clamped = Math.max(-85, Math.min(85, lat)) * Math.PI / 180;
    const merc = Math.log(Math.tan(Math.PI / 4 + clamped / 2));
    return Math.max(0, Math.min(n - 1, Math.floor(((1 - merc / Math.PI) * 0.5) * n)));
  }

  function drawVectorWorld(ctx, projectLonLat, w, h, opts = {}) {
    const {
      oceanTop = '#051526',
      oceanBot = '#0a2b46',
      landStroke = 'rgba(130, 224, 192, 0.58)',
      gridStep = 30,
      showLabels = true,
      satMode = 'y',
      tileZoom = null,
      boundsLonLat = null,
      onTileLoad = null
    } = opts;

    const minLon = boundsLonLat ? Math.max(-180, boundsLonLat.minLon - 2) : -180;
    const maxLon = boundsLonLat ? Math.min(180, boundsLonLat.maxLon + 2) : 180;
    const minLat = boundsLonLat ? Math.max(-84, boundsLonLat.minLat - 2) : -75;
    const maxLat = boundsLonLat ? Math.min(84, boundsLonLat.maxLat + 2) : 84;
    const lonSpan = Math.max(0.05, maxLon - minLon);

    // 1. Deep Ocean Bathymetry Base
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, oceanTop);
    grad.addColorStop(0.5, '#0b3152');
    grad.addColorStop(1, oceanBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const ne = ensureNaturalEarth();

    // 2. Shaded-Relief Natural Earth 1:50m + Regional Landmasses Base (zero-latency offline & under-tile relief)
    if (ne && ne.land.length) {
      const landGrad = ctx.createLinearGradient(0, 0, 0, h);
      landGrad.addColorStop(0, '#3d5949');
      landGrad.addColorStop(0.35, '#2f5736');
      landGrad.addColorStop(0.68, '#4a5c3d');
      landGrad.addColorStop(1, '#315239');
      ctx.fillStyle = landGrad;
      ctx.strokeStyle = 'rgba(34, 152, 195, 0.36)';
      ctx.lineWidth = lonSpan < 25 ? 3.5 : 2.2;
      ctx.beginPath();
      for (let i = 0; i < ne.land.length; i++) {
        const p = ne.land[i];
        if (p.maxLon < minLon || p.minLon > maxLon || p.maxLat < minLat || p.minLat > maxLat) continue;
        const ring = p.ring;
        let prevLon = null;
        for (let j = 0; j < ring.length; j++) {
          const [lon, lat] = ring[j];
          const [px, py] = projectLonLat(lon, lat);
          if (j === 0 || (prevLon !== null && Math.abs(lon - prevLon) > 180)) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
          prevLon = lon;
        }
        ctx.closePath();
      }
      ctx.stroke();
      ctx.fill();
      ctx.strokeStyle = landStroke;
      ctx.lineWidth = lonSpan < 20 ? 1.3 : 0.85;
      ctx.stroke();

      // Carve Natural Earth lakes
      if (ne.lakes.length) {
        ctx.fillStyle = '#092944';
        ctx.strokeStyle = 'rgba(110, 205, 240, 0.35)';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        for (let i = 0; i < ne.lakes.length; i++) {
          const lk = ne.lakes[i];
          if (lk.maxLon < minLon || lk.minLon > maxLon || lk.maxLat < minLat || lk.minLat > maxLat) continue;
          const ring = lk.ring;
          for (let j = 0; j < ring.length; j++) {
            const [px, py] = projectLonLat(ring[j][0], ring[j][1]);
            if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.closePath();
        }
        ctx.fill();
        ctx.stroke();
      }
    } else {
      for (const c of COUNTRY_BBOX) {
        if (c.maxLon < minLon || c.minLon > maxLon || c.maxLat < minLat || c.minLat > maxLat) continue;
        ctx.fillStyle = BIOME_COLORS[c.biome] || '#2b4d2c';
        ctx.strokeStyle = 'rgba(26, 118, 152, 0.34)';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        let prevLon = null;
        for (let i = 0; i < c.poly.length; i++) {
          const [lon, lat] = c.poly[i];
          const [px, py] = projectLonLat(lon, lat);
          if (i === 0 || (prevLon !== null && Math.abs(lon - prevLon) > 180)) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
          prevLon = lon;
        }
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
        ctx.strokeStyle = landStroke;
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }
    }

    // 3. Google Maps Satellite / Hybrid / Terrain / Street Web Mercator Tiles (100% edge-to-edge coverage at z=2..16!)
    let satDrawn = 0;
    const notify = onTileLoad || (ctx.canvas && ctx.canvas._onSatelliteTileLoad) || null;
    if (satMode && typeof Image !== 'undefined' && typeof ctx.drawImage === 'function') {
      if (!basePrewarmed) {
        basePrewarmed = true;
        for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) getSatTile(satMode, 1, tx, ty, notify);
        for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 4; tx++) getSatTile(satMode, 2, tx, ty, notify);
      }
      const satMinLon = boundsLonLat ? Math.max(-180, boundsLonLat.minLon) : -180;
      const satMaxLon = boundsLonLat ? Math.min(180, boundsLonLat.maxLon) : 180;
      const satMinLat = boundsLonLat ? Math.max(-84, boundsLonLat.minLat) : -75;
      const satMaxLat = boundsLonLat ? Math.min(84, boundsLonLat.maxLat) : 84;
      const satLonSpan = Math.max(0.004, satMaxLon - satMinLon);
      const [pWest] = projectLonLat(satMinLon, (satMinLat + satMaxLat) * 0.5);
      const [pEast] = projectLonLat(satMaxLon, (satMinLat + satMaxLat) * 0.5);
      const spanPx = Math.max(128, Math.abs(pEast - pWest));
      const worldSpanPx = spanPx * (360 / satLonSpan);
      let tz = tileZoom || Math.max(2, Math.min(16, Math.round(Math.log2(worldSpanPx / 256))));
      let n = 1 << tz;
      let tx0 = boundsLonLat ? lonToTileX(satMinLon, n) : 0;
      let tx1 = boundsLonLat ? lonToTileX(satMaxLon, n) : n - 1;
      let ty0 = boundsLonLat ? latToTileY(satMaxLat, n) : 0;
      let ty1 = boundsLonLat ? latToTileY(satMinLat, n) : n - 1;
      // Step zoom down instead of clipping edges so satellite tiles always cover 100% of the canvas
      while (tz > 2 && ((tx1 - tx0 + 1) > 8 || (ty1 - ty0 + 1) > 8)) {
        tz--;
        n = 1 << tz;
        tx0 = boundsLonLat ? lonToTileX(satMinLon, n) : 0;
        tx1 = boundsLonLat ? lonToTileX(satMaxLon, n) : n - 1;
        ty0 = boundsLonLat ? latToTileY(satMaxLat, n) : 0;
        ty1 = boundsLonLat ? latToTileY(satMinLat, n) : n - 1;
      }

      ctx.imageSmoothingEnabled = true;
      try { ctx.imageSmoothingQuality = 'high'; } catch {}
      for (let ty = ty0; ty <= ty1; ty++) {
        if (ty < 0 || ty >= n) continue;
        const latTop = Math.max(-84, Math.min(84, tileLat(ty, n)));
        const latBot = Math.max(-84, Math.min(84, tileLat(ty + 1, n)));
        for (let tx = tx0; tx <= tx1; tx++) {
          const lonL = tileLon(tx, n);
          const lonR = tileLon(tx + 1, n);
          const [x0, y0] = projectLonLat(lonL, latTop);
          const [x1, y1] = projectLonLat(lonR, latBot);
          if (x1 < x0) continue;
          const py = Math.min(y0, y1), ph = Math.abs(y1 - y0), pw = x1 - x0;
          if (x1 < -2 || x0 > w + 2 || py + ph < -2 || py > h + 2 || pw < 1.5 || ph < 1.5) continue;
          const entry = getSatTile(satMode, tz, tx, ty, notify);
          if (entry && entry.state === 'ready') {
            ctx.drawImage(entry.img, x0, py, pw + 0.75, ph + 0.75);
            satDrawn++;
          } else {
            const anc = findAncestorSatTile(satMode, tz, tx, ty);
            if (anc) {
              ctx.drawImage(anc.img, anc.sx, anc.sy, anc.sw, anc.sh, x0, py, pw + 0.75, ph + 0.75);
              satDrawn++;
            }
          }
        }
      }
      // Subtle 1-tile perimeter prefetch when zoomed in for smoother panning
      if (tz >= 4 && tz <= 14 && boundsLonLat) {
        const midX = (tx0 + tx1) >> 1, midY = (ty0 + ty1) >> 1;
        const ring = [[tx0 - 1, midY], [tx1 + 1, midY], [midX, ty0 - 1], [midX, ty1 + 1]];
        for (const [px, py] of ring) {
          if (py >= 0 && py < n) getSatTile(satMode, tz, px, py, null);
        }
      }
    }

    // 4. Crisp Natural Earth Coastline, River, Road & Country Border Overlay (keeps geography sharp at all zoom levels)
    if (ne) {
      if (satDrawn > 0) {
        ctx.strokeStyle = 'rgba(130, 232, 206, 0.42)';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        for (let i = 0; i < ne.land.length; i++) {
          const p = ne.land[i];
          if (p.maxLon < minLon || p.minLon > maxLon || p.maxLat < minLat || p.minLat > maxLat) continue;
          const ring = p.ring;
          let prevLon = null;
          for (let j = 0; j < ring.length; j++) {
            const [lon, lat] = ring[j];
            const [px, py] = projectLonLat(lon, lat);
            if (j === 0 || (prevLon !== null && Math.abs(lon - prevLon) > 180)) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
            prevLon = lon;
          }
          ctx.closePath();
        }
        ctx.stroke();
      }
      if (lonSpan < 85 && ne.rivers.length) {
        ctx.strokeStyle = 'rgba(72, 196, 246, 0.58)';
        ctx.lineWidth = lonSpan < 20 ? 1.35 : 0.85;
        ctx.beginPath();
        for (let i = 0; i < ne.rivers.length; i++) {
          const rv = ne.rivers[i];
          if (rv.maxLon < minLon || rv.minLon > maxLon || rv.maxLat < minLat || rv.minLat > maxLat) continue;
          const ring = rv.ring;
          for (let j = 0; j < ring.length; j++) {
            const [px, py] = projectLonLat(ring[j][0], ring[j][1]);
            if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
        }
        ctx.stroke();
      }
      if (lonSpan < 45 && ne.roadsMajor.length) {
        ctx.strokeStyle = 'rgba(255, 198, 105, 0.34)';
        ctx.lineWidth = lonSpan < 12 ? 1.15 : 0.75;
        ctx.beginPath();
        for (let i = 0; i < ne.roadsMajor.length; i++) {
          const rd = ne.roadsMajor[i];
          if (rd.maxLon < minLon || rd.minLon > maxLon || rd.maxLat < minLat || rd.minLat > maxLat) continue;
          const ring = rd.ring;
          for (let j = 0; j < ring.length; j++) {
            const [px, py] = projectLonLat(ring[j][0], ring[j][1]);
            if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
        }
        ctx.stroke();
      }
      if (ne.borders.length) {
        ctx.strokeStyle = 'rgba(255, 224, 150, 0.38)';
        ctx.lineWidth = 0.85;
        ctx.beginPath();
        for (let i = 0; i < ne.borders.length; i++) {
          const bd = ne.borders[i];
          if (bd.maxLon < minLon || bd.minLon > maxLon || bd.maxLat < minLat || bd.minLat > maxLat) continue;
          const ring = bd.ring;
          for (let j = 0; j < ring.length; j++) {
            const [px, py] = projectLonLat(ring[j][0], ring[j][1]);
            if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
        }
        ctx.stroke();
      }
    }

    // 5. Subtle Graticule Grid
    const effStep = lonSpan < 20 ? 5 : lonSpan < 60 ? 10 : gridStep;
    for (let lon = -180; lon <= 180; lon += effStep) {
      if (lon < minLon - effStep || lon > maxLon + effStep) continue;
      const [x0, y0] = projectLonLat(lon, Math.min(82, maxLat));
      const [x1, y1] = projectLonLat(lon, Math.max(-72, minLat));
      ctx.strokeStyle = lon === 0 ? 'rgba(120, 210, 245, 0.22)' : 'rgba(100, 185, 230, 0.09)';
      ctx.lineWidth = lon === 0 ? 1.1 : 0.8;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    for (let lat = -60; lat <= 75; lat += effStep) {
      if (lat < minLat - effStep || lat > maxLat + effStep) continue;
      const [x0, y0] = projectLonLat(Math.max(-180, minLon), lat);
      const [x1, y1] = projectLonLat(Math.min(180, maxLon), lat);
      ctx.strokeStyle = lat === 0 ? 'rgba(120, 210, 245, 0.24)' : 'rgba(100, 185, 230, 0.09)';
      ctx.lineWidth = lat === 0 ? 1.1 : 0.8;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }

    // 6. Country & Continent Labels
    if (showLabels) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (lonSpan > 95 && satDrawn === 0) {
        for (const lbl of REGION_LABELS) {
          const [cx, cy] = projectLonLat(lbl.lon, lbl.lat);
          if (cx > 30 && cx < w - 30 && cy > 18 && cy < h - 18) {
            ctx.font = lbl.ocean ? 'italic 9px system-ui, sans-serif' : 'bold 10px system-ui, sans-serif';
            ctx.fillStyle = lbl.ocean ? 'rgba(125, 195, 235, 0.34)' : 'rgba(220, 244, 255, 0.65)';
            ctx.fillText(lbl.name, cx, cy);
          }
        }
      }
      if (ne && Array.isArray(ne.countries) && lonSpan < 140) {
        ctx.font = '600 10.5px system-ui, "Noto Sans TC", sans-serif';
        for (let i = 0; i < ne.countries.length; i++) {
          const [name, clon, clat, tier] = ne.countries[i];
          if (tier === 1 && lonSpan > 42) continue;
          if (clon < minLon || clon > maxLon || clat < minLat || clat > maxLat) continue;
          const [cx, cy] = projectLonLat(clon, clat);
          if (cx < 24 || cx > w - 24 || cy < 16 || cy > h - 16) continue;
          ctx.strokeStyle = 'rgba(4, 15, 26, 0.82)';
          ctx.lineWidth = 2.6;
          ctx.strokeText(name, cx, cy);
          ctx.fillStyle = 'rgba(218, 240, 252, 0.78)';
          ctx.fillText(name, cx, cy);
        }
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();
  }

  return {
    COUNTRIES,
    LANDMASSES,
    MAJOR_MOUNTAIN_RANGES,
    wrapLon,
    isNaturalEarthLand,
    countryAt,
    globalLandElevation,
    sampleRealDEM,
    prefetchDEM,
    onDemLoad,
    greatCircleGeoPoints,
    drawVectorWorld
  };
})();
if (typeof module !== 'undefined') Object.assign(globalThis, { WorldAtlas });
