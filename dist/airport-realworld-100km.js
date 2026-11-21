'use strict';
// SKYBOUND GLOBAL — Real-World 100 km Airport Corridor Macro-Features Engine
// Standalone, zero-dependency browser & Node-safe module.
// Streams GPS-accurate iconic bridges, mega container ports, spinning offshore wind farms,
// mega stadiums, and signature coastal/desert landmarks within 105 km of aircraft position.

(function (globalScope) {
  const FALLBACK_ORIGIN_LAT = 25 + (4 + 10.535 / 60) / 60;
  const FALLBACK_ORIGIN_LON = 121 + (33 + 9.085 / 60) / 60;
  const FALLBACK_EAST_SCALE = 111319.49 * Math.cos(FALLBACK_ORIGIN_LAT * Math.PI / 180);

  const STREAM_IN_RADIUS = 105000;   // 105 km stream-in radius
  const STREAM_OUT_RADIUS = 130000;  // 130 km stream-out & clean disposal radius
  const STREAM_IN_SQ = STREAM_IN_RADIUS * STREAM_IN_RADIUS;
  const STREAM_OUT_SQ = STREAM_OUT_RADIUS * STREAM_OUT_RADIUS;

  // Comprehensive GPS-verified Real-World 100 km Corridor Catalog (106 macro-features across all global regions)
  const REAL_100KM_CORRIDORS = [
    // =========================================================================
    // 1. ICONIC SUSPENSION & CABLE-STAYED BRIDGES (30 bridges)
    // =========================================================================
    { id: 'tw_danjiang_bridge', name: '淡江大橋 Danjiang Bridge', country: 'TW', region: 'tw', airport: 'RCSS/RCTP', type: 'cable_bridge', lat: 25.1765, lon: 121.4290, headingDeg: 18, span: 920, towerH: 211, deckH: 38, deckW: 34, pylons: 1, color: 0xe6eaef },
    { id: 'tw_guandu_bridge', name: '關渡大橋 Guandu Arch Bridge', country: 'TW', region: 'tw', airport: 'RCSS/RCTP', type: 'cable_bridge', style: 'arch', lat: 25.1260, lon: 121.4590, headingDeg: 72, span: 540, towerH: 72, deckH: 24, deckW: 22, color: 0xc22e24 },
    { id: 'tw_kaohsiung_harbor_bridge', name: '高雄跨港大橋 Kaohsiung Cross-Harbor', country: 'TW', region: 'tw', airport: 'RCKH', type: 'cable_bridge', lat: 22.5810, lon: 120.2920, headingDeg: 132, span: 680, towerH: 128, deckH: 34, deckW: 24, pylons: 2, color: 0xeef2f6 },
    { id: 'tw_kinmen_bridge', name: '金門大橋 Kinmen Bridge', country: 'TW', region: 'tw', airport: 'RCBS', type: 'cable_bridge', lat: 24.4440, lon: 118.2880, headingDeg: 78, span: 1320, towerH: 118, deckH: 32, deckW: 20, pylons: 3, color: 0xe8ecf0 },
    { id: 'tw_penghu_bridge', name: '澎湖跨海大橋 Penghu Great Bridge', country: 'TW', region: 'tw', airport: 'RCQC', type: 'cable_bridge', style: 'arch', lat: 23.6505, lon: 119.5565, headingDeg: 15, span: 1420, towerH: 58, deckH: 22, deckW: 18, color: 0xe2e6ea },

    { id: 'jp_tokyo_rainbow', name: '東京灣彩虹大橋 Rainbow Bridge', country: 'JP', region: 'ea', airport: 'RJTT/RJAA', type: 'suspension_bridge', lat: 35.6366, lon: 139.7631, headingDeg: 118, span: 798, towerH: 126, deckH: 52, deckW: 28, color: 0xedf1f6 },
    { id: 'jp_yokohama_bay', name: '橫濱海灣大橋 Yokohama Bay Bridge', country: 'JP', region: 'ea', airport: 'RJTT', type: 'cable_bridge', lat: 35.4545, lon: 139.6744, headingDeg: 42, span: 860, towerH: 172, deckH: 55, deckW: 32, pylons: 2, color: 0xe8edf2 },
    { id: 'jp_akashi_kaikyo', name: '明石海峽大橋 Akashi Kaikyo Bridge', country: 'JP', region: 'ea', airport: 'RJBB/RJOO', type: 'suspension_bridge', lat: 34.6175, lon: 135.0217, headingDeg: 160, span: 1991, towerH: 298, deckH: 65, deckW: 35, color: 0x99ada8 },
    { id: 'jp_kansai_skygate', name: '關西機場聯絡橋 Sky Gate Bridge R', country: 'JP', region: 'ea', airport: 'RJBB', type: 'cable_bridge', lat: 34.4165, lon: 135.2845, headingDeg: 128, span: 1560, towerH: 112, deckH: 34, deckW: 30, pylons: 2, color: 0xc8d2dc },
    { id: 'kr_incheon_grand', name: '仁川大橋 Incheon Grand Bridge', country: 'KR', region: 'ea', airport: 'RKSI', type: 'cable_bridge', lat: 37.4139, lon: 126.5661, headingDeg: 64, span: 1480, towerH: 238, deckH: 74, deckW: 34, pylons: 2, color: 0xdbe2ea },

    { id: 'hk_tsing_ma', name: '青馬大橋 Tsing Ma Bridge', country: 'HK', region: 'ea', airport: 'VHHH', type: 'suspension_bridge', lat: 22.3514, lon: 114.0740, headingDeg: 68, span: 1377, towerH: 206, deckH: 62, deckW: 40, color: 0xb8c2cc },
    { id: 'hk_stonecutters', name: '昂船洲大橋 Stonecutters Bridge', country: 'HK', region: 'ea', airport: 'VHHH', type: 'cable_bridge', lat: 22.3210, lon: 114.1297, headingDeg: 112, span: 1018, towerH: 298, deckH: 73, deckW: 36, pylons: 2, color: 0xcad4de },
    { id: 'hk_hzmb_tower', name: '港珠澳大橋青州航道橋 HZMB', country: 'HK', region: 'ea', airport: 'VHHH/VMMC/ZGSZ', type: 'cable_bridge', lat: 22.2830, lon: 113.7820, headingDeg: 82, span: 1150, towerH: 163, deckH: 48, deckW: 34, pylons: 2, color: 0xeef2f7 },
    { id: 'cn_shanghai_yangpu', name: '上海楊浦大橋 Yangpu Bridge', country: 'CN', region: 'ea', airport: 'ZSPD', type: 'cable_bridge', lat: 31.2090, lon: 121.5000, headingDeg: 145, span: 1170, towerH: 208, deckH: 48, deckW: 30, pylons: 2, color: 0xd4dbe2 },
    { id: 'cn_humen_bridge', name: '廣深虎門大橋 Humen Pearl Bridge', country: 'CN', region: 'ea', airport: 'ZGSZ/ZGGG', type: 'suspension_bridge', lat: 22.7925, lon: 113.6145, headingDeg: 76, span: 888, towerH: 150, deckH: 60, deckW: 32, color: 0xd8dfe6 },

    { id: 'th_bhumibol_bridge', name: '曼谷蒲美蓬斜張橋 Bhumibol Bridge', country: 'TH', region: 'sea', airport: 'VTBS', type: 'cable_bridge', lat: 13.6611, lon: 100.5388, headingDeg: 122, span: 702, towerH: 173, deckH: 50, deckW: 30, pylons: 2, color: 0xebe6d8 },
    { id: 'vn_nhat_tan_bridge', name: '河內日新斜張橋 Nhat Tan Bridge', country: 'VN', region: 'sea', airport: 'VVNB', type: 'cable_bridge', lat: 21.0935, lon: 105.8215, headingDeg: 16, span: 1200, towerH: 110, deckH: 32, deckW: 30, pylons: 5, color: 0xe6ebf0 },
    { id: 'in_bandra_worli', name: '孟買班德拉跨海大橋 Bandra-Worli', country: 'IN', region: 'sea', airport: 'VABB', type: 'cable_bridge', lat: 19.0368, lon: 72.8172, headingDeg: 165, span: 900, towerH: 126, deckH: 36, deckW: 30, pylons: 2, color: 0xe4e8ec },

    { id: 'tr_bosphorus_bridge', name: '伊斯坦堡博斯普魯斯大橋 Bosphorus', country: 'TR', region: 'me', airport: 'LTFM', type: 'suspension_bridge', lat: 41.0451, lon: 29.0341, headingDeg: 108, span: 1074, towerH: 165, deckH: 64, deckW: 33, color: 0xe2e8ee },
    { id: 'uk_dartford_qe2', name: '倫敦達特福德女王二世大橋 QE2', country: 'UK', region: 'eu', airport: 'EGLL', type: 'cable_bridge', lat: 51.4648, lon: 0.2585, headingDeg: 6, span: 812, towerH: 137, deckH: 58, deckW: 28, pylons: 2, color: 0xd0d8e0 },
    { id: 'nl_erasmus_bridge', name: '鹿特丹伊拉斯姆斯橋 Erasmus Bridge', country: 'NL', region: 'eu', airport: 'EHAM', type: 'cable_bridge', lat: 51.9090, lon: 4.4870, headingDeg: 162, span: 802, towerH: 139, deckH: 34, deckW: 28, pylons: 1, color: 0xeaf2fa },

    { id: 'us_sf_bay_bridge', name: '舊金山海灣大橋 SF-Oakland Bay', country: 'US', region: 'na', airport: 'KSFO', type: 'suspension_bridge', lat: 37.7983, lon: -122.3778, headingDeg: 52, span: 1400, towerH: 160, deckH: 66, deckW: 32, color: 0xcfd6de },
    { id: 'us_ny_verrazzano', name: '紐約韋拉札諾大橋 Verrazzano-Narrows', country: 'US', region: 'na', airport: 'KJFK', type: 'suspension_bridge', lat: 40.6066, lon: -74.0447, headingDeg: 84, span: 1298, towerH: 211, deckH: 69, deckW: 34, color: 0x9aa4ae },
    { id: 'us_ny_brooklyn', name: '紐約布魯克林大橋 Brooklyn Bridge', country: 'US', region: 'na', airport: 'KJFK', type: 'suspension_bridge', lat: 40.7061, lon: -73.9969, headingDeg: 126, span: 486, towerH: 84, deckH: 41, deckW: 26, color: 0xc2b6a0 },
    { id: 'us_ny_gwb', name: '紐約喬治華盛頓大橋 George Washington', country: 'US', region: 'na', airport: 'KJFK', type: 'suspension_bridge', lat: 40.8517, lon: -73.9527, headingDeg: 118, span: 1067, towerH: 184, deckH: 65, deckW: 36, color: 0xadb6be },
    { id: 'ca_vancouver_lionsgate', name: '溫哥華獅門大橋 Lions Gate Bridge', country: 'CA', region: 'na', airport: 'CYVR', type: 'suspension_bridge', lat: 49.3150, lon: -123.1380, headingDeg: 24, span: 472, towerH: 111, deckH: 61, deckW: 20, color: 0x6c9c88 },
    { id: 'us_seattle_tacoma', name: '西雅圖塔科馬海峽大橋 Tacoma Narrows', country: 'US', region: 'na', airport: 'KSEA', type: 'suspension_bridge', lat: 47.2690, lon: -122.5517, headingDeg: 114, span: 853, towerH: 155, deckH: 58, deckW: 26, color: 0x8ea4a0 },

    { id: 'au_sydney_anzac', name: '雪梨澳紐軍團大橋 Anzac Bridge', country: 'AU', region: 'oc', airport: 'YSSY', type: 'cable_bridge', lat: -33.8690, lon: 151.1860, headingDeg: 92, span: 805, towerH: 120, deckH: 38, deckW: 32, pylons: 2, color: 0xdce2e8 },
    { id: 'nz_auckland_harbour', name: '奧克蘭海灣大橋 Auckland Harbour', country: 'NZ', region: 'oc', airport: 'NZAA', type: 'cable_bridge', style: 'arch', lat: -36.8280, lon: 174.7458, headingDeg: 18, span: 1020, towerH: 92, deckH: 43, deckW: 28, color: 0x9aa6b0 },
    { id: 'br_rio_niteroi', name: '里約-尼泰羅伊大橋 Rio-Niteroi', country: 'BR', region: 'sa', airport: 'SBGR', type: 'cable_bridge', lat: -22.8710, lon: -43.1530, headingDeg: 72, span: 1400, towerH: 98, deckH: 52, deckW: 28, pylons: 2, color: 0xcdd4dc },

    // =========================================================================
    // 2. MEGA SHIPPING CONTAINER PORTS & STS GANTRY CRANES (26 ports)
    // =========================================================================
    { id: 'port_kaohsiung', name: '高雄港貨櫃中心 Port of Kaohsiung', country: 'TW', region: 'tw', airport: 'RCKH', type: 'container_port', lat: 22.5650, lon: 120.3080, headingDeg: 145, cranes: 10, craneColor: 0xc9352b },
    { id: 'port_keelung', name: '基隆港貨櫃碼頭 Port of Keelung', country: 'TW', region: 'tw', airport: 'RCSS', type: 'container_port', lat: 25.1480, lon: 121.7480, headingDeg: 35, cranes: 8, craneColor: 0xd44628 },
    { id: 'port_taipei', name: '臺北港貨櫃碼頭 Taipei Port', country: 'TW', region: 'tw', airport: 'RCTP/RCSS', type: 'container_port', lat: 25.1540, lon: 121.3750, headingDeg: 42, cranes: 8, craneColor: 0x2268a8 },
    { id: 'port_taichung', name: '臺中港貨櫃碼頭 Port of Taichung', country: 'TW', region: 'tw', airport: 'RCMQ', type: 'container_port', lat: 24.2850, lon: 120.5180, headingDeg: 20, cranes: 8, craneColor: 0xc9352b },

    { id: 'port_tokyo_odaiba', name: '東京港大井碼頭 Port of Tokyo', country: 'JP', region: 'ea', airport: 'RJTT', type: 'container_port', lat: 35.6120, lon: 139.7950, headingDeg: 12, cranes: 10, craneColor: 0xd4382c },
    { id: 'port_osaka_nanko', name: '大阪南港貨櫃碼頭 Port of Osaka', country: 'JP', region: 'ea', airport: 'RJBB/RJOO', type: 'container_port', lat: 34.6220, lon: 135.4080, headingDeg: 15, cranes: 8, craneColor: 0xc83a2e },
    { id: 'port_hk_kwai_tsing', name: '香港葵青貨櫃碼頭 Kwai Tsing', country: 'HK', region: 'ea', airport: 'VHHH', type: 'container_port', lat: 22.3370, lon: 114.1180, headingDeg: 145, cranes: 10, craneColor: 0x2a6fb4 },
    { id: 'port_shanghai_wgq', name: '上海外高橋港 Port of Shanghai', country: 'CN', region: 'ea', airport: 'ZSPD', type: 'container_port', lat: 31.3650, lon: 121.6150, headingDeg: 118, cranes: 10, craneColor: 0x2b72b8 },
    { id: 'port_shenzhen_shekou', name: '深圳蛇口貨櫃港 Port of Shenzhen', country: 'CN', region: 'ea', airport: 'ZGSZ/VHHH', type: 'container_port', lat: 22.4780, lon: 113.8950, headingDeg: 65, cranes: 8, craneColor: 0xc8352b },
    { id: 'port_incheon', name: '仁川港貨櫃碼頭 Port of Incheon', country: 'KR', region: 'ea', airport: 'RKSI', type: 'container_port', lat: 37.4520, lon: 126.6050, headingDeg: 90, cranes: 8, craneColor: 0x2665a4 },

    { id: 'port_singapore_pp', name: '新加坡巴西班讓港 Port of Singapore', country: 'SG', region: 'sea', airport: 'WSSS', type: 'container_port', lat: 1.2720, lon: 103.7820, headingDeg: 120, cranes: 10, craneColor: 0x246aa8 },
    { id: 'port_klang', name: '吉隆坡巴生西港 Port Klang', country: 'MY', region: 'sea', airport: 'WMKK', type: 'container_port', lat: 2.9480, lon: 101.2980, headingDeg: 25, cranes: 8, craneColor: 0xc9352b },
    { id: 'port_manila', name: '馬尼拉貨櫃港 Port of Manila', country: 'PH', region: 'sea', airport: 'RPLL', type: 'container_port', lat: 14.6020, lon: 120.9550, headingDeg: 165, cranes: 8, craneColor: 0xd45b22 },
    { id: 'port_jakarta', name: '雅加達丹戎不碌港 Tanjung Priok', country: 'ID', region: 'sea', airport: 'WIII', type: 'container_port', lat: -6.1020, lon: 106.8850, headingDeg: 88, cranes: 8, craneColor: 0x246aa8 },

    { id: 'port_jebel_ali', name: '杜拜傑貝阿里港 Port of Jebel Ali', country: 'AE', region: 'me', airport: 'OMDB', type: 'container_port', lat: 25.0120, lon: 55.0600, headingDeg: 45, cranes: 10, craneColor: 0x2462a6 },
    { id: 'port_hamad_doha', name: '杜哈哈馬德港 Hamad Port', country: 'QA', region: 'me', airport: 'OTHH', type: 'container_port', lat: 25.0350, lon: 51.6150, headingDeg: 10, cranes: 8, craneColor: 0x2a6ca8 },

    { id: 'port_rotterdam', name: '鹿特丹歐羅巴港 Port of Rotterdam', country: 'NL', region: 'eu', airport: 'EHAM', type: 'container_port', lat: 51.9480, lon: 4.1380, headingDeg: 102, cranes: 10, craneColor: 0x2268a8 },
    { id: 'port_la_longbeach', name: '洛杉磯長灘港 Port of LA/Long Beach', country: 'US', region: 'na', airport: 'KLAX', type: 'container_port', lat: 33.7420, lon: -118.2550, headingDeg: 82, cranes: 10, craneColor: 0xc9352b },
    { id: 'port_oakland', name: '奧克蘭貨櫃港 Port of Oakland', country: 'US', region: 'na', airport: 'KSFO', type: 'container_port', lat: 37.7950, lon: -122.3180, headingDeg: 110, cranes: 8, craneColor: 0x2b6cb0 },
    { id: 'port_ny_newark', name: '紐約紐華克港 Port of NY/NJ Newark', country: 'US', region: 'na', airport: 'KJFK', type: 'container_port', lat: 40.6840, lon: -74.1420, headingDeg: 14, cranes: 10, craneColor: 0xc8382c },
    { id: 'port_seattle', name: '西雅圖貨櫃港 Port of Seattle', country: 'US', region: 'na', airport: 'KSEA', type: 'container_port', lat: 47.5840, lon: -122.3520, headingDeg: 0, cranes: 8, craneColor: 0x246ca8 },
    { id: 'port_vancouver', name: '溫哥華貨櫃港 Port of Vancouver', country: 'CA', region: 'na', airport: 'CYVR', type: 'container_port', lat: 49.2890, lon: -123.0650, headingDeg: 86, cranes: 8, craneColor: 0xc83a2e },
    { id: 'port_honolulu', name: '檀香山貨櫃港 Honolulu Harbor', country: 'US', region: 'na', airport: 'PHNL', type: 'container_port', lat: 21.3090, lon: -157.8780, headingDeg: 100, cranes: 6, craneColor: 0x286ca8 },

    { id: 'port_sydney_botany', name: '雪梨波塔尼港 Port Botany Sydney', country: 'AU', region: 'oc', airport: 'YSSY', type: 'container_port', lat: -33.9720, lon: 151.2160, headingDeg: 135, cranes: 8, craneColor: 0xc8382c },
    { id: 'port_melbourne', name: '墨爾本貨櫃港 Port of Melbourne', country: 'AU', region: 'oc', airport: 'YMML', type: 'container_port', lat: -37.8350, lon: 144.9100, headingDeg: 12, cranes: 8, craneColor: 0x246aa8 },
    { id: 'port_rio_santos', name: '里約貨櫃港 Port of Rio/Santos', country: 'BR', region: 'sa', airport: 'SBGR', type: 'container_port', lat: -22.8950, lon: -43.2100, headingDeg: 95, cranes: 8, craneColor: 0xc83a2e },

    // =========================================================================
    // 3. REAL-WORLD SPINNING OFFSHORE & COASTAL WIND FARMS (14 wind farms)
    // =========================================================================
    { id: 'wind_tw_miaoli', name: '苗栗海洋離岸風場 Miaoli Offshore Wind', country: 'TW', region: 'tw', airport: 'RCTP/RCMQ', type: 'offshore_windfarm', lat: 24.6850, lon: 120.7850, headingDeg: 25, turbines: 16, hubH: 118, bladeLen: 56 },
    { id: 'wind_tw_changhua', name: '彰化離岸風力發電場 Changhua Offshore', country: 'TW', region: 'tw', airport: 'RCMQ/RCQC', type: 'offshore_windfarm', lat: 24.0850, lon: 120.2200, headingDeg: 20, turbines: 18, hubH: 124, bladeLen: 58 },
    { id: 'wind_jp_choshi', name: '東京灣銚子離岸風場 Choshi Wind Farm', country: 'JP', region: 'ea', airport: 'RJAA', type: 'offshore_windfarm', lat: 35.7020, lon: 140.8500, headingDeg: 45, turbines: 14, hubH: 115, bladeLen: 54 },
    { id: 'wind_jp_hibikinada', name: '九州響灘離岸風場 Hibikinada Wind', country: 'JP', region: 'ea', airport: 'RJFF', type: 'offshore_windfarm', lat: 33.9450, lon: 130.7800, headingDeg: 30, turbines: 14, hubH: 116, bladeLen: 54 },
    { id: 'wind_kr_jeju', name: '濟州耽羅離岸風場 Jeju Offshore Wind', country: 'KR', region: 'ea', airport: 'RKPC', type: 'offshore_windfarm', lat: 33.5450, lon: 126.3500, headingDeg: 320, turbines: 14, hubH: 112, bladeLen: 52 },
    { id: 'wind_cn_donghai', name: '上海東海大橋離岸風場 Donghai Wind', country: 'CN', region: 'ea', airport: 'ZSPD', type: 'offshore_windfarm', lat: 30.8200, lon: 121.9500, headingDeg: 110, turbines: 16, hubH: 116, bladeLen: 55 },
    { id: 'wind_nl_ijmuiden', name: '北海荷蘭離岸風場 North Sea IJmuiden', country: 'NL', region: 'eu', airport: 'EHAM', type: 'offshore_windfarm', lat: 52.5200, lon: 4.3200, headingDeg: 245, turbines: 18, hubH: 126, bladeLen: 60 },
    { id: 'wind_uk_london_array', name: '泰晤士河口倫敦陣列 London Array', country: 'UK', region: 'eu', airport: 'EGLL', type: 'offshore_windfarm', lat: 51.6250, lon: 1.3500, headingDeg: 235, turbines: 18, hubH: 122, bladeLen: 58 },
    { id: 'wind_de_taunus', name: '法蘭克福陶努斯風場 Taunus Wind Park', country: 'DE', region: 'eu', airport: 'EDDF', type: 'offshore_windfarm', lat: 50.2850, lon: 8.3200, headingDeg: 260, turbines: 12, hubH: 110, bladeLen: 50 },
    { id: 'wind_us_altamont', name: '加州阿爾塔蒙特風場 Altamont Pass', country: 'US', region: 'na', airport: 'KSFO', type: 'offshore_windfarm', lat: 37.7300, lon: -121.6500, headingDeg: 280, turbines: 16, hubH: 105, bladeLen: 48 },
    { id: 'wind_us_palmsprings', name: '加州棕櫚泉風電走廊 Palm Springs Wind', country: 'US', region: 'na', airport: 'KLAX', type: 'offshore_windfarm', lat: 33.9150, lon: -116.5900, headingDeg: 275, turbines: 16, hubH: 108, bladeLen: 50 },
    { id: 'wind_au_sydney', name: '雪梨伊拉瓦拉海岸風場 Illawarra Wind', country: 'AU', region: 'oc', airport: 'YSSY', type: 'offshore_windfarm', lat: -34.3200, lon: 151.1200, headingDeg: 180, turbines: 14, hubH: 118, bladeLen: 55 },
    { id: 'wind_au_melbourne', name: '墨爾本巴斯海峽風場 Bass Strait Wind', country: 'AU', region: 'oc', airport: 'YMML', type: 'offshore_windfarm', lat: -38.2800, lon: 145.3200, headingDeg: 215, turbines: 14, hubH: 116, bladeLen: 54 },
    { id: 'wind_za_highveld', name: '南非高原風場 Highveld Wind Corridor', country: 'ZA', region: 'sa', airport: 'FAOR', type: 'offshore_windfarm', lat: -26.3500, lon: 28.6200, headingDeg: 310, turbines: 12, hubH: 110, bladeLen: 50 },

    // =========================================================================
    // 4. REAL-WORLD ICONIC MEGA STADIUMS & ARENAS (26 stadiums)
    // =========================================================================
    { id: 'stad_taipei_dome', name: '臺北大巨蛋 Taipei Dome', country: 'TW', region: 'tw', airport: 'RCSS', type: 'stadium', style: 'dome', lat: 25.0422, lon: 121.5600, headingDeg: 15, rx: 125, rz: 102, wallH: 52, roofColor: 0xdce4ec },
    { id: 'stad_taoyuan_baseball', name: '桃園國際棒球場 Taoyuan Stadium', country: 'TW', region: 'tw', airport: 'RCTP', type: 'stadium', style: 'open', lat: 25.0005, lon: 121.2005, headingDeg: 40, rx: 112, rz: 104, wallH: 34, roofColor: 0xe2e8ee },
    { id: 'stad_kaohsiung_national', name: '高雄國家體育場 Kaohsiung National', country: 'TW', region: 'tw', airport: 'RCKH', type: 'stadium', style: 'spiral', lat: 22.7025, lon: 120.2950, headingDeg: 120, rx: 138, rz: 112, wallH: 42, roofColor: 0x3b6088 },

    { id: 'stad_tokyo_national', name: '東京國立競技場 Tokyo National', country: 'JP', region: 'ea', airport: 'RJTT', type: 'stadium', style: 'open', lat: 35.6779, lon: 139.7145, headingDeg: 10, rx: 142, rz: 114, wallH: 47, roofColor: 0xd8c9b0 },
    { id: 'stad_seoul_worldcup', name: '首爾世界盃競技場 Seoul World Cup', country: 'KR', region: 'ea', airport: 'RKSI', type: 'stadium', style: 'kite', lat: 37.5683, lon: 126.8973, headingDeg: 28, rx: 144, rz: 118, wallH: 50, roofColor: 0xeef3f8 },
    { id: 'stad_beijing_birdsnest', name: '北京國家體育場鳥巢 Bird\'s Nest', country: 'CN', region: 'ea', airport: 'ZBAA', type: 'stadium', style: 'nest', lat: 39.9929, lon: 116.3965, headingDeg: 0, rx: 165, rz: 142, wallH: 68, roofColor: 0x5c646c },
    { id: 'stad_singapore_national', name: '新加坡國家體育場 Singapore National', country: 'SG', region: 'sea', airport: 'WSSS', type: 'stadium', style: 'dome', lat: 1.3042, lon: 103.8742, headingDeg: 45, rx: 155, rz: 132, wallH: 64, roofColor: 0xe2e8ee },
    { id: 'stad_kl_bukit_jalil', name: '吉隆坡武吉加里爾體育場 Bukit Jalil', country: 'MY', region: 'sea', airport: 'WMKK', type: 'stadium', style: 'open', lat: 3.0547, lon: 101.6914, headingDeg: 22, rx: 145, rz: 118, wallH: 48, roofColor: 0xe4eaef },
    { id: 'stad_doha_lusail', name: '杜哈盧賽爾體育場 Lusail Stadium', country: 'QA', region: 'me', airport: 'OTHH', type: 'stadium', style: 'golden_bowl', lat: 25.4209, lon: 51.4904, headingDeg: 0, rx: 156, rz: 136, wallH: 62, roofColor: 0xd8b158 },

    { id: 'stad_london_wembley', name: '倫敦溫布利球場 Wembley Stadium', country: 'UK', region: 'eu', airport: 'EGLL', type: 'stadium', style: 'wembley', lat: 51.5560, lon: -0.2796, headingDeg: 88, rx: 152, rz: 124, wallH: 52, roofColor: 0xe8edf2 },
    { id: 'stad_paris_sdf', name: '巴黎法蘭西體育場 Stade de France', country: 'FR', region: 'eu', airport: 'LFPG', type: 'stadium', style: 'halo', lat: 48.9245, lon: 2.3602, headingDeg: 18, rx: 150, rz: 122, wallH: 46, roofColor: 0xecf1f6 },
    { id: 'stad_madrid_bernabeu', name: '馬德里伯納烏球場 Santiago Bernabeu', country: 'ES', region: 'eu', airport: 'LEMD', type: 'stadium', style: 'silver_wrap', lat: 40.4531, lon: -3.6883, headingDeg: 5, rx: 136, rz: 112, wallH: 58, roofColor: 0xd2dae2 },
    { id: 'stad_rome_olimpico', name: '羅馬奧林匹克體育場 Stadio Olimpico', country: 'IT', region: 'eu', airport: 'LIRF', type: 'stadium', style: 'open', lat: 41.9341, lon: 12.4547, headingDeg: 12, rx: 148, rz: 116, wallH: 42, roofColor: 0xedf0f4 },
    { id: 'stad_amsterdam_arena', name: '阿姆斯特丹約翰克魯伊夫球場', country: 'NL', region: 'eu', airport: 'EHAM', type: 'stadium', style: 'dome', lat: 52.3144, lon: 4.9419, headingDeg: 8, rx: 132, rz: 108, wallH: 52, roofColor: 0xcfd7df },
    { id: 'stad_frankfurt_park', name: '法蘭克福森林體育場 Deutsche Bank Park', country: 'DE', region: 'eu', airport: 'EDDF', type: 'stadium', style: 'open', lat: 50.0686, lon: 8.6455, headingDeg: 32, rx: 130, rz: 106, wallH: 42, roofColor: 0xe8edf2 },

    { id: 'stad_ny_metlife', name: '紐約大都會人壽體育場 MetLife Stadium', country: 'US', region: 'na', airport: 'KJFK', type: 'stadium', style: 'silver_wrap', lat: 40.8135, lon: -74.0745, headingDeg: 34, rx: 150, rz: 122, wallH: 52, roofColor: 0xc2ccd6 },
    { id: 'stad_la_sofi', name: '洛杉磯 SoFi 體育場 SoFi Stadium', country: 'US', region: 'na', airport: 'KLAX', type: 'stadium', style: 'sofi', lat: 33.9535, lon: -118.3392, headingDeg: 8, rx: 175, rz: 132, wallH: 54, roofColor: 0xf0f4f8 },
    { id: 'stad_sf_levis', name: '舊金山李維斯體育場 Levi\'s Stadium', country: 'US', region: 'na', airport: 'KSFO', type: 'stadium', style: 'open', lat: 37.4033, lon: -121.9698, headingDeg: 350, rx: 144, rz: 114, wallH: 46, roofColor: 0xd8dee4 },
    { id: 'stad_chicago_soldier', name: '芝加哥軍人球場 Soldier Field', country: 'US', region: 'na', airport: 'KORD', type: 'stadium', style: 'open', lat: 41.8623, lon: -87.6167, headingDeg: 0, rx: 140, rz: 112, wallH: 46, roofColor: 0xd6d2c8 },
    { id: 'stad_toronto_rogers', name: '多倫多羅傑斯中心 Rogers Centre', country: 'CA', region: 'na', airport: 'CYYZ', type: 'stadium', style: 'dome', lat: 43.6414, lon: -79.3894, headingDeg: 18, rx: 130, rz: 118, wallH: 64, roofColor: 0xe6ebf0 },

    { id: 'stad_melbourne_mcg', name: '墨爾本板球場 Melbourne Cricket Ground', country: 'AU', region: 'oc', airport: 'YMML', type: 'stadium', style: 'mcg', lat: -37.8200, lon: 144.9834, headingDeg: 80, rx: 158, rz: 140, wallH: 46, roofColor: 0xdce2e8 },
    { id: 'stad_saopaulo_morumbi', name: '聖保羅莫倫比體育場 Estadio Morumbi', country: 'BR', region: 'sa', airport: 'SBGR', type: 'stadium', style: 'open', lat: -23.6001, lon: -46.7201, headingDeg: 36, rx: 148, rz: 120, wallH: 42, roofColor: 0xd8dce0 },
    { id: 'stad_mexico_azteca', name: '墨西哥城阿茲特克球場 Estadio Azteca', country: 'MX', region: 'sa', airport: 'MMMX', type: 'stadium', style: 'open', lat: 19.3029, lon: -99.1505, headingDeg: 12, rx: 152, rz: 126, wallH: 50, roofColor: 0xcfc8bc },
    { id: 'stad_santiago_nacional', name: '聖地牙哥國家體育場 Estadio Nacional', country: 'CL', region: 'sa', airport: 'SCEL', type: 'stadium', style: 'open', lat: -33.4646, lon: -70.6106, headingDeg: 0, rx: 142, rz: 114, wallH: 38, roofColor: 0xdce0e4 },
    { id: 'stad_cairo_intl', name: '開羅國際體育場 Cairo International', country: 'EG', region: 'sa', airport: 'HECA', type: 'stadium', style: 'open', lat: 30.0691, lon: 31.3123, headingDeg: 25, rx: 150, rz: 124, wallH: 42, roofColor: 0xded4c0 },
    { id: 'stad_joburg_fnb', name: '約翰尼斯堡足球城體育場 FNB Stadium', country: 'ZA', region: 'sa', airport: 'FAOR', type: 'stadium', style: 'golden_bowl', lat: -26.2348, lon: 27.9826, headingDeg: 14, rx: 154, rz: 132, wallH: 54, roofColor: 0xc97b42 },

    // =========================================================================
    // 5. SIGNATURE MACRO GEOGRAPHY: COASTAL ISLANDS & SOLAR/DESERT LANDMARKS (10 features)
    // =========================================================================
    { id: 'geo_dubai_palm_atlantis', name: '杜拜朱美拉棕櫚島與亞特蘭提斯 Palm Jumeirah', country: 'AE', region: 'me', airport: 'OMDB', type: 'coastal_island', variant: 'palm_atlantis', lat: 25.1304, lon: 55.1171, headingDeg: 325 },
    { id: 'geo_sf_alcatraz', name: '舊金山惡魔島燈塔 Alcatraz Island', country: 'US', region: 'na', airport: 'KSFO', type: 'coastal_island', variant: 'alcatraz', lat: 37.8270, lon: -122.4230, headingDeg: 130 },
    { id: 'geo_hk_victoria_peak', name: '香港太平山頂凌霄閣 Victoria Peak Tower', country: 'HK', region: 'ea', airport: 'VHHH', type: 'coastal_island', variant: 'peak_tower', lat: 22.2711, lon: 114.1490, headingDeg: 20 },
    { id: 'geo_jp_fuji_summit', name: '富士山山頂氣象站與鳥居 Mt. Fuji Summit', country: 'JP', region: 'ea', airport: 'RJTT', type: 'solar_desert_landmark', variant: 'fuji_summit', lat: 35.3606, lon: 138.7274, headingDeg: 0 },
    { id: 'geo_tw_shihmen_dam', name: '桃園石門水庫大壩 Shihmen Reservoir Dam', country: 'TW', region: 'tw', airport: 'RCTP/RCSS', type: 'solar_desert_landmark', variant: 'dam', lat: 24.8110, lon: 121.2450, headingDeg: 148 },
    { id: 'geo_za_table_mountain', name: '開普敦桌山纜車站 Table Mountain', country: 'ZA', region: 'sa', airport: 'FAOR', type: 'coastal_island', variant: 'table_mountain', lat: -33.9573, lon: 18.4031, headingDeg: 350 },
    { id: 'geo_dubai_solar_park', name: '杜拜沙漠太陽能聚光塔 MBR Solar Park', country: 'AE', region: 'me', airport: 'OMDB', type: 'solar_desert_landmark', variant: 'solar_tower', lat: 24.7560, lon: 55.3650, headingDeg: 0 },
    { id: 'geo_ch_uetliberg_tower', name: '蘇黎世玉特利山觀景塔 Uetliberg Tower', country: 'CH', region: 'eu', airport: 'LSZH', type: 'solar_desert_landmark', variant: 'alpine_tower', lat: 47.3496, lon: 8.4919, headingDeg: 0 },
    { id: 'geo_us_diamond_head', name: '夏威夷鑽石頭火山口燈塔 Diamond Head', country: 'US', region: 'na', airport: 'PHNL', type: 'coastal_island', variant: 'alcatraz', lat: 21.2619, lon: -157.8059, headingDeg: 165 },
    { id: 'geo_jp_okinawa_kouri', name: '沖繩古宇利跨海景觀塔 Kouri Ocean Tower', country: 'JP', region: 'ea', airport: 'ROAH', type: 'coastal_island', variant: 'peak_tower', lat: 26.6960, lon: 128.0240, headingDeg: 180 }
  ];

  function toWorldCoords(lat, lon) {
    if (typeof geoPoint === 'function') {
      const p = geoPoint(lat, lon);
      if (p && Number.isFinite(p.x) && Number.isFinite(p.z)) return p;
    }
    return {
      x: (lon - FALLBACK_ORIGIN_LON) * FALLBACK_EAST_SCALE,
      z: (FALLBACK_ORIGIN_LAT - lat) * 110772
    };
  }

  function createRealWorld100kmCorridors(scene, ground, airports) {
    const T = (typeof THREE !== 'undefined' && THREE) || (globalScope && globalScope.THREE);
    if (!T) {
      throw new Error('createRealWorld100kmCorridors requires THREE to be available globally.');
    }

    const root = new T.Group();
    root.name = 'RealWorld100kmCorridors';
    if (scene && typeof scene.add === 'function') scene.add(root);

    function sampleGround(x, z) {
      if (typeof ground === 'function') {
        const v = ground(x, z);
        return Number.isFinite(v) ? v : 0;
      }
      if (ground && typeof ground.heightAt === 'function') {
        const v = ground.heightAt(x, z);
        return Number.isFinite(v) ? v : 0;
      }
      if (ground && typeof ground.getHeight === 'function') {
        const v = ground.getHeight(x, z);
        return Number.isFinite(v) ? v : 0;
      }
      return 0;
    }

    // -------------------------------------------------------------------------
    // Procedural PBR Canvas Textures (Node-safe: gracefully returns null headless)
    // -------------------------------------------------------------------------
    function makeCanvasTexture(w, h, drawFn, rx, ry) {
      if (typeof document === 'undefined' || !document.createElement || !T.CanvasTexture) return null;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext && canvas.getContext('2d');
      if (ctx && typeof ctx.fillRect === 'function') drawFn(ctx, w, h);
      const tex = new T.CanvasTexture(canvas);
      tex.wrapS = tex.wrapT = T.RepeatWrapping || 1000;
      if (tex.repeat && typeof tex.repeat.set === 'function') tex.repeat.set(rx || 1, ry || 1);
      if (T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
      return tex;
    }

    const concreteTex = makeCanvasTexture(128, 128, (g, w, h) => {
      g.fillStyle = '#cfd4da';
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(30,40,52,0.08)';
      for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 2);
      for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 2, h);
    }, 2, 2);

    const containerTex = makeCanvasTexture(128, 64, (g, w, h) => {
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,0.14)';
      for (let x = 0; x < w; x += 6) g.fillRect(x, 2, 2, h - 4);
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.fillRect(0, 0, w, 3);
      g.fillRect(0, h - 3, w, 3);
    }, 1, 1);

    const turfTex = makeCanvasTexture(256, 256, (g, w, h) => {
      for (let i = 0; i < 16; i++) {
        g.fillStyle = i % 2 === 0 ? '#2f8a3c' : '#3a9b47';
        g.fillRect(0, (i * h) / 16, w, h / 16 + 1);
      }
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.lineWidth = 3;
      g.strokeRect(20, 20, w - 40, h - 40);
      g.beginPath();
      g.moveTo(20, h * 0.5);
      g.lineTo(w - 20, h * 0.5);
      g.stroke();
      g.beginPath();
      g.arc(w * 0.5, h * 0.5, 28, 0, Math.PI * 2);
      g.stroke();
    }, 1, 1);

    // -------------------------------------------------------------------------
    // Shared Base Geometries (NEVER disposed on feature unload)
    // -------------------------------------------------------------------------
    const unitBoxGeo = new T.BoxGeometry(1, 1, 1);
    const unitCylGeo = new T.CylinderGeometry(0.5, 0.5, 1, 10);
    const unitSphereGeo = new T.SphereGeometry(1, 8, 6);
    const sharedGeos = new Set([unitBoxGeo, unitCylGeo, unitSphereGeo]);

    // -------------------------------------------------------------------------
    // Shared PBR Materials across the entire module
    // -------------------------------------------------------------------------
    const matOpts = (base) => Object.assign({ roughness: 0.65, metalness: 0.15 }, base);

    const bridgeStructMat = new T.MeshStandardMaterial(matOpts({ color: 0xffffff, map: concreteTex, roughness: 0.56, metalness: 0.28 }));
    const bridgeCableMat = new T.MeshStandardMaterial(matOpts({ color: 0xd0d8e0, roughness: 0.42, metalness: 0.62 }));
    const portQuayMat = new T.MeshStandardMaterial(matOpts({ color: 0xffffff, map: concreteTex, roughness: 0.78, metalness: 0.12 }));
    const craneInstMat = new T.MeshStandardMaterial(matOpts({ color: 0xffffff, roughness: 0.46, metalness: 0.44 }));
    const containerInstMat = new T.MeshStandardMaterial(matOpts({ color: 0xffffff, map: containerTex, roughness: 0.52, metalness: 0.34 }));
    const shipHullMat = new T.MeshStandardMaterial(matOpts({ color: 0xffffff, roughness: 0.48, metalness: 0.38 }));
    const turbineWhiteMat = new T.MeshStandardMaterial(matOpts({ color: 0xffffff, roughness: 0.38, metalness: 0.22 }));
    const stadiumShellMat = new T.MeshStandardMaterial(matOpts({ color: 0xffffff, map: concreteTex, roughness: 0.44, metalness: 0.32 }));
    const stadiumTurfMat = new T.MeshStandardMaterial(matOpts({ color: turfTex ? 0xffffff : 0x359643, map: turfTex, roughness: 0.88, metalness: 0.02 }));
    const macroGeoMat = new T.MeshStandardMaterial(matOpts({ color: 0xffffff, map: concreteTex, roughness: 0.62, metalness: 0.18 }));

    // Night-synchronized emissive materials
    const beaconRedMat = new T.MeshStandardMaterial({
      color: 0xff2b1a,
      emissive: 0xff1e10,
      emissiveIntensity: 0.65,
      roughness: 0.25,
      metalness: 0.05
    });
    const deckGlowMat = new T.MeshStandardMaterial({
      color: 0xffe4aa,
      emissive: 0xffc864,
      emissiveIntensity: 0.15,
      roughness: 0.3,
      metalness: 0.1
    });
    const stadiumFloodMat = new T.MeshStandardMaterial({
      color: 0xf4fbff,
      emissive: 0xdaf2ff,
      emissiveIntensity: 0.15,
      roughness: 0.2,
      metalness: 0.1
    });
    const carHeadlightMat = new T.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffd98a,
      emissiveIntensity: 0.35,
      roughness: 0.25,
      metalness: 0.2
    });
    const lighthouseBeamMat = new T.MeshStandardMaterial({
      color: 0xfff3cc,
      emissive: 0xffe28a,
      emissiveIntensity: 0.6,
      roughness: 0.15,
      metalness: 0.05
    });

    // Reusable scratch transform objects (zero GC churn!)
    const dummy = new T.Object3D();
    const tmpColor = new T.Color();
    const tmpV1 = new T.Vector3();
    const tmpV2 = new T.Vector3();
    const tmpMid = new T.Vector3();
    const tmpDir = new T.Vector3();
    const upAxis = new T.Vector3(0, 1, 0);
    const tmpQuat = new T.Quaternion();

    function buildInstanced(geo, mat, items, castShadow) {
      if (!items || !items.length) return null;
      const mesh = new T.InstancedMesh(geo, mat, items.length);
      mesh.frustumCulled = false;
      mesh.castShadow = Boolean(castShadow);
      mesh.receiveShadow = true;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        dummy.position.set(it.x || 0, it.y || 0, it.z || 0);
        if (it.quat) {
          dummy.quaternion.copy(it.quat);
        } else {
          dummy.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
        }
        dummy.scale.set(it.sx != null ? it.sx : 1, it.sy != null ? it.sy : 1, it.sz != null ? it.sz : 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        if (it.color != null && typeof mesh.setColorAt === 'function') {
          tmpColor.setHex(it.color);
          mesh.setColorAt(i, tmpColor);
        }
      }
      if (mesh.instanceMatrix) mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      return mesh;
    }

    function pushSegment(list, x1, y1, z1, x2, y2, z2, radius, color) {
      tmpV1.set(x1, y1, z1);
      tmpV2.set(x2, y2, z2);
      tmpDir.subVectors(tmpV2, tmpV1);
      const len = tmpDir.length();
      if (len < 0.05) return;
      tmpMid.addVectors(tmpV1, tmpV2).multiplyScalar(0.5);
      tmpDir.divideScalar(len);
      const q = new T.Quaternion();
      if (typeof q.setFromUnitVectors === 'function') {
        q.setFromUnitVectors(upAxis, tmpDir);
      }
      list.push({ x: tmpMid.x, y: tmpMid.y, z: tmpMid.z, sx: radius * 2, sy: len, sz: radius * 2, quat: q, color });
    }

    function hashSeed(str) {
      let h = 2166136261;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return (h >>> 0) / 4294967295;
    }

    // =========================================================================
    // BUILDER 1: SUSPENSION & CABLE-STAYED BRIDGES (5 draw calls!)
    // =========================================================================
    function buildBridge(item, wx, wz) {
      const g = new T.Group();
      g.name = 'CorridorBridge_' + item.id;
      const gy = sampleGround(wx, wz);
      const baseY = gy > 2.5 ? gy : 0;
      g.position.set(wx, baseY, wz);
      g.rotation.y = -((item.headingDeg || 0) * Math.PI) / 180;

      const span = item.span || 900;
      const halfSpan = span * 0.5;
      const totalLen = span * 1.52;
      const deckY = item.deckH || 45;
      const towerH = item.towerH || 160;
      const deckW = item.deckW || 28;
      const primaryColor = item.color || 0xdce2e8;
      const concreteColor = 0xa8aeb4;
      const deckAsphaltColor = 0x3a4048;

      const structs = [];
      const cables = [];
      const glows = [];
      const beacons = [];

      // 1. Main roadway deck + side parapets + approach piers
      structs.push({ x: 0, y: deckY, z: 0, sx: deckW, sy: 3.4, sz: totalLen, color: deckAsphaltColor });
      structs.push({ x: -deckW * 0.48, y: deckY + 1.8, z: 0, sx: 1.4, sy: 1.8, sz: totalLen, color: primaryColor });
      structs.push({ x: deckW * 0.48, y: deckY + 1.8, z: 0, sx: 1.4, sy: 1.8, sz: totalLen, color: primaryColor });

      // Approach viaduct concrete piers on both ends
      const pierCount = 4;
      for (const side of [-1, 1]) {
        for (let p = 1; p <= pierCount; p++) {
          const pz = side * (halfSpan * 0.72 + p * (totalLen * 0.14 / pierCount));
          const pierH = deckY + 14;
          structs.push({ x: -deckW * 0.3, y: pierH * 0.5 - 12, z: pz, sx: 4.2, sy: pierH, sz: 5.5, color: concreteColor });
          structs.push({ x: deckW * 0.3, y: pierH * 0.5 - 12, z: pz, sx: 4.2, sy: pierH, sz: 5.5, color: concreteColor });
          structs.push({ x: 0, y: deckY - 3.6, z: pz, sx: deckW * 0.85, sy: 3.2, sz: 5.8, color: concreteColor });
        }
      }

      if (item.style === 'arch') {
        // Iconic Steel Arch Bridge (Guandu Red Arch, Auckland Harbour, Penghu)
        const archSegs = 22;
        const archHalf = halfSpan * 0.78;
        const archRise = Math.max(36, towerH - deckY + 18);
        for (const sx of [-deckW * 0.45, deckW * 0.45]) {
          for (let i = 0; i < archSegs; i++) {
            const t1 = -1 + (2 * i) / archSegs;
            const t2 = -1 + (2 * (i + 1)) / archSegs;
            const z1 = t1 * archHalf, z2 = t2 * archHalf;
            const y1 = deckY - 8 + archRise * (1 - t1 * t1);
            const y2 = deckY - 8 + archRise * (1 - t2 * t2);
            pushSegment(cables, sx, y1, z1, sx, y2, z2, 2.2, primaryColor);
            if (i % 2 === 1 && y1 > deckY + 4) {
              pushSegment(cables, sx, y1, z1, sx, deckY, z1, 0.45, 0xd8dfe6);
            }
          }
        }
        // Lateral arch cross-bracing & crown beacons
        for (let i = 3; i < archSegs - 2; i += 3) {
          const t = -1 + (2 * i) / archSegs;
          const z = t * archHalf;
          const y = deckY - 8 + archRise * (1 - t * t);
          structs.push({ x: 0, y, z, sx: deckW * 0.92, sy: 2.2, sz: 2.2, color: primaryColor });
        }
        // Main arch abutments
        for (const side of [-1, 1]) {
          structs.push({ x: 0, y: (deckY + 10) * 0.5 - 12, z: side * archHalf, sx: deckW + 10, sy: deckY + 10, sz: 18, color: concreteColor });
        }
        beacons.push({ x: -deckW * 0.45, y: deckY - 6 + archRise, z: 0, sx: 2.4, sy: 2.4, sz: 2.4 });
        beacons.push({ x: deckW * 0.45, y: deckY - 6 + archRise, z: 0, sx: 2.4, sy: 2.4, sz: 2.4 });
      } else if (item.type === 'suspension_bridge') {
        // Monumental Twin-Tower Suspension Bridge (Akashi Kaikyo, Tsing Ma, SF Bay, Verrazzano, Bosphorus, Rainbow, Brooklyn, GWB, Lions Gate, Tacoma)
        const towerZ = halfSpan * 0.56;
        const legOffX = deckW * 0.5 + 3.2;
        for (const side of [-1, 1]) {
          const tz = side * towerZ;
          // Deep concrete caisson foundation
          structs.push({ x: 0, y: -2, z: tz, sx: deckW + 22, sy: 22, sz: 22, color: concreteColor });
          // Twin main tower legs
          for (const lx of [-legOffX, legOffX]) {
            structs.push({ x: lx, y: towerH * 0.5, z: tz, sx: 6.2, sy: towerH, sz: 8.5, color: primaryColor });
            beacons.push({ x: lx, y: towerH + 3.0, z: tz, sx: 2.6, sy: 2.6, sz: 2.6 });
          }
          // 3 portal cross-beams (below deck, mid-tower, crown)
          structs.push({ x: 0, y: deckY - 4.5, z: tz, sx: legOffX * 2 + 4, sy: 5.5, sz: 7.5, color: primaryColor });
          structs.push({ x: 0, y: deckY + (towerH - deckY) * 0.52, z: tz, sx: legOffX * 2 + 2, sy: 5.0, sz: 6.2, color: primaryColor });
          structs.push({ x: 0, y: towerH - 5.5, z: tz, sx: legOffX * 2 + 2, sy: 6.0, sz: 6.8, color: primaryColor });
          // Cable anchorage blocks
          structs.push({ x: 0, y: deckY * 0.45, z: side * (totalLen * 0.48), sx: deckW + 14, sy: deckY + 12, sz: 26, color: concreteColor });
        }

        // Twin parabolic catenary main cables + vertical suspender hangers
        const mainSegs = 20;
        const cableDip = (towerH - deckY) * 0.78;
        for (const lx of [-legOffX, legOffX]) {
          // Center span catenary
          for (let i = 0; i < mainSegs; i++) {
            const u1 = -1 + (2 * i) / mainSegs;
            const u2 = -1 + (2 * (i + 1)) / mainSegs;
            const z1 = u1 * towerZ, z2 = u2 * towerZ;
            const y1 = towerH - cableDip * (1 - u1 * u1);
            const y2 = towerH - cableDip * (1 - u2 * u2);
            pushSegment(cables, lx, y1, z1, lx, y2, z2, 1.35, primaryColor);
            if (i > 0 && i < mainSegs && i % 2 === 0) {
              pushSegment(cables, lx, y1, z1, lx, deckY + 1.2, z1, 0.32, 0xdbe3ea);
            }
          }
          // Side span backstays down to anchorages
          for (const side of [-1, 1]) {
            const zStart = side * towerZ;
            const zEnd = side * (totalLen * 0.47);
            const sideSegs = 8;
            for (let i = 0; i < sideSegs; i++) {
              const t1 = i / sideSegs, t2 = (i + 1) / sideSegs;
              const z1 = zStart + (zEnd - zStart) * t1;
              const z2 = zStart + (zEnd - zStart) * t2;
              const y1 = towerH - (towerH - deckY - 2) * Math.pow(t1, 0.88);
              const y2 = towerH - (towerH - deckY - 2) * Math.pow(t2, 0.88);
              pushSegment(cables, lx, y1, z1, lx, y2, z2, 1.25, primaryColor);
              if (i > 0 && i < sideSegs - 1 && i % 2 === 0) {
                pushSegment(cables, lx, y1, z1, lx, deckY + 1.2, z1, 0.30, 0xdbe3ea);
              }
            }
          }
        }
      } else {
        // Cable-Stayed Bridge (1, 2, 3, or 5 pylons: Danjiang, Incheon, Stonecutters, HZMB, Yangpu, QE2, Erasmus, Anzac, Bhumibol, Nhat Tan)
        const pylonCount = item.pylons || 2;
        const pylonZs = [];
        if (pylonCount === 1) {
          pylonZs.push(0);
        } else {
          const usable = span * 0.72;
          for (let i = 0; i < pylonCount; i++) {
            pylonZs.push(-usable * 0.5 + (usable * i) / (pylonCount - 1));
          }
        }
        const fanReach = pylonCount === 1 ? span * 0.46 : (span * 0.44) / Math.max(1, pylonCount - 0.35);
        const staysPerSide = pylonCount >= 3 ? 5 : 9;

        for (let p = 0; p < pylonZs.length; p++) {
          const pz = pylonZs[p];
          const legOffX = deckW * 0.5 + 2.8;
          // Deep caisson pier
          structs.push({ x: 0, y: -2, z: pz, sx: deckW + 18, sy: 22, sz: 18, color: concreteColor });
          if (pylonCount === 1) {
            // Sculpted dramatic single A-pylon (Danjiang / Erasmus swan silhouette)
            const tilt = item.id === 'nl_erasmus_bridge' ? 0.16 : 0.0;
            structs.push({ x: 0, y: towerH * 0.5, z: pz - tilt * towerH * 0.25, sx: 7.5, sy: towerH, sz: 11.0, rx: tilt, color: primaryColor });
            structs.push({ x: -legOffX * 0.6, y: deckY * 0.5, z: pz, sx: 5.0, sy: deckY + 8, sz: 8.5, rz: -0.14, color: primaryColor });
            structs.push({ x: legOffX * 0.6, y: deckY * 0.5, z: pz, sx: 5.0, sy: deckY + 8, sz: 8.5, rz: 0.14, color: primaryColor });
            beacons.push({ x: 0, y: towerH + 3.0, z: pz - tilt * towerH * 0.48, sx: 2.8, sy: 2.8, sz: 2.8 });
            // Fan stay cables radiating from upper single pylon to both sides of deck
            for (const dir of [-1, 1]) {
              for (let k = 1; k <= staysPerSide; k++) {
                const frac = k / staysPerSide;
                const anchorY = deckY + (towerH - deckY) * (0.42 + 0.54 * frac);
                const deckZ = pz + dir * (fanReach * (0.14 + 0.86 * frac));
                pushSegment(cables, 0, anchorY, pz - tilt * anchorY * 0.3, -deckW * 0.44, deckY + 1.5, deckZ, 0.36, 0xe8eff5);
                pushSegment(cables, 0, anchorY, pz - tilt * anchorY * 0.3, deckW * 0.44, deckY + 1.5, deckZ, 0.36, 0xe8eff5);
              }
            }
          } else {
            // Twin-leg H/A/Diamond tower pylons
            for (const lx of [-legOffX, legOffX]) {
              structs.push({ x: lx, y: towerH * 0.5, z: pz, sx: 5.4, sy: towerH, sz: 7.5, color: primaryColor });
              beacons.push({ x: lx, y: towerH + 2.8, z: pz, sx: 2.5, sy: 2.5, sz: 2.5 });
            }
            structs.push({ x: 0, y: deckY - 4.0, z: pz, sx: legOffX * 2 + 4, sy: 4.8, sz: 6.8, color: primaryColor });
            structs.push({ x: 0, y: towerH * 0.72, z: pz, sx: legOffX * 2 + 2, sy: 4.5, sz: 5.5, color: primaryColor });
            structs.push({ x: 0, y: towerH - 5.0, z: pz, sx: legOffX * 2 + 2, sy: 5.2, sz: 6.2, color: primaryColor });

            for (const dir of [-1, 1]) {
              for (let k = 1; k <= staysPerSide; k++) {
                const frac = k / staysPerSide;
                const anchorY = deckY + (towerH - deckY) * (0.46 + 0.50 * frac);
                const deckZ = pz + dir * (fanReach * (0.16 + 0.84 * frac));
                pushSegment(cables, -legOffX, anchorY, pz, -deckW * 0.45, deckY + 1.5, deckZ, 0.34, 0xe6edf4);
                pushSegment(cables, legOffX, anchorY, pz, deckW * 0.45, deckY + 1.5, deckZ, 0.34, 0xe6edf4);
              }
            }
          }
        }
      }

      // Deck streetlamp glow strips along both bridge parapets
      const lampCount = Math.min(28, Math.max(12, Math.floor(totalLen / 70)));
      for (let i = 0; i < lampCount; i++) {
        const lz = -totalLen * 0.47 + (totalLen * 0.94 * i) / (lampCount - 1);
        glows.push({ x: -deckW * 0.47, y: deckY + 5.8, z: lz, sx: 1.2, sy: 0.7, sz: 3.6 });
        glows.push({ x: deckW * 0.47, y: deckY + 5.8, z: lz, sx: 1.2, sy: 0.7, sz: 3.6 });
      }

      // Build batched InstancedMeshes (5 draw calls total!)
      let drawCalls = 0;
      const mStruct = buildInstanced(unitBoxGeo, bridgeStructMat, structs, true);
      if (mStruct) { g.add(mStruct); drawCalls++; }
      const mCables = buildInstanced(unitCylGeo, bridgeCableMat, cables, false);
      if (mCables) { g.add(mCables); drawCalls++; }
      const mGlows = buildInstanced(unitBoxGeo, deckGlowMat, glows, false);
      if (mGlows) { g.add(mGlows); drawCalls++; }
      const mBeacons = buildInstanced(unitSphereGeo, beaconRedMat, beacons, false);
      if (mBeacons) { g.add(mBeacons); drawCalls++; }

      // Animated illuminated bridge vehicles (Draw call #5)
      const carCount = 20;
      const carData = [];
      const carItems = [];
      const seed = hashSeed(item.id);
      for (let c = 0; c < carCount; c++) {
        const dir = c % 2 === 0 ? 1 : -1;
        const laneX = dir * (deckW * 0.22 + ((c >> 1) % 2) * (deckW * 0.12));
        const posZ = -totalLen * 0.48 + (((c / carCount) + seed) % 1) * (totalLen * 0.96);
        const speed = 24 + (c % 5) * 3.5;
        carData.push({ laneX, posZ, dir, speed });
        carItems.push({ x: laneX, y: deckY + 2.6, z: posZ, sx: 2.3, sy: 1.6, sz: 5.2, color: dir > 0 ? 0xfff0c2 : 0xff5a42 });
      }
      const mCars = buildInstanced(unitBoxGeo, carHeadlightMat, carItems, false);
      if (mCars) { g.add(mCars); drawCalls++; }

      const halfRun = totalLen * 0.48;
      const animate = (dt) => {
        if (!mCars || dt <= 0) return;
        for (let c = 0; c < carData.length; c++) {
          const cd = carData[c];
          cd.posZ += cd.dir * cd.speed * dt;
          if (cd.posZ > halfRun) cd.posZ -= halfRun * 2;
          else if (cd.posZ < -halfRun) cd.posZ += halfRun * 2;
          dummy.position.set(cd.laneX, deckY + 2.6, cd.posZ);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(2.3, 1.6, 5.2);
          dummy.updateMatrix();
          mCars.setMatrixAt(c, dummy.matrix);
        }
        if (mCars.instanceMatrix) mCars.instanceMatrix.needsUpdate = true;
      };

      return { group: g, drawCalls, animate };
    }

    // =========================================================================
    // BUILDER 2: MEGA SHIPPING CONTAINER PORTS & STS CRANES (5 draw calls!)
    // =========================================================================
    const CONTAINER_COLORS = [0x1c68a8, 0x1d7a48, 0xd85a1c, 0xc22c28, 0xd8a822, 0xe8edf2, 0xa8286c, 0x3b4e62];

    function buildContainerPort(item, wx, wz) {
      const g = new T.Group();
      g.name = 'CorridorPort_' + item.id;
      const gy = sampleGround(wx, wz);
      const baseY = gy > 2.5 ? gy : 0;
      g.position.set(wx, baseY, wz);
      g.rotation.y = -((item.headingDeg || 0) * Math.PI) / 180;

      const cranes = Math.max(6, Math.min(10, item.cranes || 8));
      const quayLen = cranes * 84 + 140;
      const quayDepth = 240;
      const craneColor = item.craneColor || 0xc8352b;
      const seed = hashSeed(item.id);

      const quayAndShips = [];
      const craneParts = [];
      const containers = [];
      const beacons = [];

      // 1. Concrete quay slab + seawall apron + logistics sheds
      quayAndShips.push({ x: -quayDepth * 0.5, y: -3.0, z: 0, sx: quayDepth, sy: 12.0, sz: quayLen, color: 0x9ea5ac });
      quayAndShips.push({ x: -10, y: 3.4, z: 0, sx: 22, sy: 0.9, sz: quayLen, color: 0xb8bec4 });
      for (let w = 0; w < 3; w++) {
        const wzPos = -quayLen * 0.34 + w * (quayLen * 0.34);
        quayAndShips.push({ x: -quayDepth + 38, y: 11.0, z: wzPos, sx: 46, sy: 16, sz: 115, color: 0xd8dfe6 });
      }

      // 2. Two Berthed 240m Mega Container Ships moored right along the quay edge (x = +32)
      for (let s = 0; s < 2; s++) {
        const sz = (s === 0 ? -1 : 1) * (quayLen * 0.25);
        const shipLen = 240;
        const shipBeam = 38;
        // Dark steel hull + red waterline + white multi-deck aft accommodation superstructure
        quayAndShips.push({ x: 34, y: 5.5, z: sz, sx: shipBeam, sy: 16, sz: shipLen, color: 0x1d2938 });
        quayAndShips.push({ x: 34, y: -1.5, z: sz, sx: shipBeam - 1.5, sy: 5, sz: shipLen - 8, color: 0x8e2420 });
        quayAndShips.push({ x: 34, y: 26.0, z: sz - shipLen * 0.30, sx: shipBeam - 4, sy: 26, sz: 24, color: 0xf0f4f8 });
        quayAndShips.push({ x: 34, y: 39.0, z: sz - shipLen * 0.30, sx: shipBeam + 6, sy: 5.5, sz: 8, color: 0xdfe8f0 });
        beacons.push({ x: 34, y: 44.0, z: sz - shipLen * 0.30, sx: 2.0, sy: 2.0, sz: 2.0 });

        // Stacked containers aboard the berthed mega container ship
        for (let bay = -3; bay <= 4; bay++) {
          if (bay === -2) continue; // clear around superstructure
          const cz = sz + bay * 22;
          for (let col = -1; col <= 1; col++) {
            const tiers = 2 + ((bay + col + s + 10) % 3);
            const cColor = CONTAINER_COLORS[Math.abs(bay * 7 + col * 3 + s * 5 + Math.floor(seed * 20)) % CONTAINER_COLORS.length];
            containers.push({ x: 34 + col * 10.5, y: 13.5 + tiers * 2.1, z: cz, sx: 9.2, sy: tiers * 4.2, sz: 19.5, color: cColor });
          }
        }
      }

      // 3. Towering 62m Ship-to-Shore (STS) Gantry Cranes along quay apron (x = -12)
      for (let c = 0; c < cranes; c++) {
        const cz = -quayLen * 0.42 + (quayLen * 0.84 * c) / Math.max(1, cranes - 1);
        const cx = -12;
        const accentWhite = 0xedf2f7;
        // 4 portal legs
        for (const ox of [-9, 9]) for (const oz of [-7, 7]) {
          craneParts.push({ x: cx + ox, y: 24, z: cz + oz, sx: 2.6, sy: 44, sz: 2.6, color: craneColor });
        }
        // Horizontal portal sill & machinery house
        craneParts.push({ x: cx, y: 18, z: cz, sx: 22, sy: 3.4, sz: 17, color: accentWhite });
        craneParts.push({ x: cx - 2, y: 45, z: cz, sx: 20, sy: 7.5, sz: 12, color: accentWhite });
        // Tall A-frame apex mast (64m)
        craneParts.push({ x: cx, y: 54, z: cz, sx: 5.5, sy: 22, sz: 9.5, color: craneColor });
        // Long horizontal waterside cantilevered outreach boom (+52m over container ships!) + landside backreach
        craneParts.push({ x: cx + 22, y: 42, z: cz, sx: 86, sy: 3.2, sz: 5.5, color: craneColor });
        // Diagonal forestay & backstay boom arms
        craneParts.push({ x: cx + 26, y: 52, z: cz, sx: 54, sy: 1.8, sz: 2.2, rz: -0.34, color: accentWhite });
        craneParts.push({ x: cx - 12, y: 52, z: cz, sx: 28, sy: 1.8, sz: 2.2, rz: 0.42, color: accentWhite });
        beacons.push({ x: cx, y: 66.5, z: cz, sx: 2.2, sy: 2.2, sz: 2.2 });
      }

      // 4. Dense Colorful Stacked Shipping Container Yard Blocks
      const yardCols = 4;
      const yardRows = Math.min(12, cranes + 3);
      for (let col = 0; col < yardCols; col++) {
        const bx = -58 - col * 36;
        for (let row = 0; row < yardRows; row++) {
          const bz = -quayLen * 0.42 + (quayLen * 0.84 * row) / Math.max(1, yardRows - 1);
          const tiers = 2 + ((col * 3 + row * 5 + Math.floor(seed * 17)) % 3);
          const cColor = CONTAINER_COLORS[(col * 5 + row * 3 + Math.floor(seed * 31)) % CONTAINER_COLORS.length];
          containers.push({ x: bx, y: 3.0 + tiers * 2.2, z: bz, sx: 24, sy: tiers * 4.4, sz: 44, color: cColor });
        }
      }

      let drawCalls = 0;
      const mQuay = buildInstanced(unitBoxGeo, portQuayMat, quayAndShips, true);
      if (mQuay) { g.add(mQuay); drawCalls++; }
      const mCranes = buildInstanced(unitBoxGeo, craneInstMat, craneParts, true);
      if (mCranes) { g.add(mCranes); drawCalls++; }
      const mContainers = buildInstanced(unitBoxGeo, containerInstMat, containers, true);
      if (mContainers) { g.add(mContainers); drawCalls++; }
      const mBeacons = buildInstanced(unitSphereGeo, beaconRedMat, beacons, false);
      if (mBeacons) { g.add(mBeacons); drawCalls++; }

      // 5. Moving Coastal Cargo Ships gliding through the harbor channel (Draw call #5!)
      const shipCount = 2;
      const shipTrackHalf = quayLen * 0.95;
      const movingShips = [];
      const shipParts = [];
      for (let s = 0; s < shipCount; s++) {
        const dir = s === 0 ? 1 : -1;
        const laneX = 165 + s * 115;
        const posZ = (s === 0 ? -0.35 : 0.35) * shipTrackHalf;
        const speed = 11 + s * 3.5;
        movingShips.push({ laneX, posZ, dir, speed });
        // 3 instances per moving ship: hull, container stack, white bridgehouse
        shipParts.push({ x: laneX, y: 4.5, z: posZ, sx: 28, sy: 12, sz: 170, color: 0x223040 });
        shipParts.push({ x: laneX, y: 14.5, z: posZ + dir * 16, sx: 22, sy: 10, sz: 110, color: CONTAINER_COLORS[(s * 3 + Math.floor(seed * 9)) % CONTAINER_COLORS.length] });
        shipParts.push({ x: laneX, y: 20.0, z: posZ - dir * 52, sx: 24, sy: 20, sz: 20, color: 0xf0f5fa });
      }
      const mMovingShips = buildInstanced(unitBoxGeo, shipHullMat, shipParts, false);
      if (mMovingShips) { g.add(mMovingShips); drawCalls++; }

      const animate = (dt) => {
        if (!mMovingShips || dt <= 0) return;
        for (let s = 0; s < movingShips.length; s++) {
          const ms = movingShips[s];
          ms.posZ += ms.dir * ms.speed * dt;
          if (ms.posZ > shipTrackHalf) ms.posZ -= shipTrackHalf * 2;
          else if (ms.posZ < -shipTrackHalf) ms.posZ += shipTrackHalf * 2;
          const idx = s * 3;
          // Hull
          dummy.position.set(ms.laneX, 4.5, ms.posZ);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(28, 12, 170);
          dummy.updateMatrix();
          mMovingShips.setMatrixAt(idx, dummy.matrix);
          // Deck container block
          dummy.position.set(ms.laneX, 14.5, ms.posZ + ms.dir * 16);
          dummy.scale.set(22, 10, 110);
          dummy.updateMatrix();
          mMovingShips.setMatrixAt(idx + 1, dummy.matrix);
          // Aft bridge superstructure
          dummy.position.set(ms.laneX, 20.0, ms.posZ - ms.dir * 52);
          dummy.scale.set(24, 20, 20);
          dummy.updateMatrix();
          mMovingShips.setMatrixAt(idx + 2, dummy.matrix);
        }
        if (mMovingShips.instanceMatrix) mMovingShips.instanceMatrix.needsUpdate = true;
      };

      return { group: g, drawCalls, animate };
    }

    // =========================================================================
    // BUILDER 3: SPINNING OFFSHORE & COASTAL WIND FARMS (3 draw calls!)
    // =========================================================================
    function buildWindFarm(item, wx, wz) {
      const g = new T.Group();
      g.name = 'CorridorWindFarm_' + item.id;
      g.position.set(wx, 0, wz);

      const count = Math.max(12, Math.min(18, item.turbines || 14));
      const hubH = item.hubH || 118;
      const bladeLen = item.bladeLen || 56;
      const yawRad = -((item.headingDeg || 0) * Math.PI) / 180;
      const cols = Math.ceil(Math.sqrt(count * 1.3));
      const rows = Math.ceil(count / cols);
      const spacingX = 460;
      const spacingZ = 520;
      const seed = hashSeed(item.id);

      const towers = [];
      const beacons = [];
      const turbines = [];
      const bladeItems = [];

      let placed = 0;
      for (let r = 0; r < rows && placed < count; r++) {
        for (let c = 0; c < cols && placed < count; c++) {
          const lx = (c - (cols - 1) * 0.5) * spacingX + (r % 2) * (spacingX * 0.42);
          const lz = (r - (rows - 1) * 0.5) * spacingZ;
          const tGy = sampleGround(wx + lx, wz + lz);
          const baseY = tGy > 2.0 ? tGy : 0;

          // Yellow monopile transition base + white steel tower + horizontal nacelle pod
          towers.push({ x: lx, y: baseY + 5, z: lz, sx: 7.4, sy: 26, sz: 7.4, color: 0xe8a818 });
          towers.push({ x: lx, y: baseY + hubH * 0.5 + 6, z: lz, sx: 5.2, sy: hubH - 8, sz: 5.2, color: 0xf4f7fa });
          // Nacelle rotated along wind heading
          const nacQuat = new T.Quaternion();
          const nacEuler = new T.Euler(Math.PI * 0.5, yawRad, 0, 'YXZ');
          if (typeof nacQuat.setFromEuler === 'function') nacQuat.setFromEuler(nacEuler);
          towers.push({ x: lx, y: baseY + hubH, z: lz, sx: 6.8, sy: 18.0, sz: 6.8, quat: nacQuat, color: 0xeef3f8 });

          // Red blinking aviation nacelle light
          beacons.push({ x: lx, y: baseY + hubH + 5.6, z: lz, sx: 2.4, sy: 2.4, sz: 2.4 });

          // Hub forward offset along wind direction
          const fwdX = Math.sin(yawRad);
          const fwdZ = Math.cos(yawRad);
          const rightX = Math.cos(yawRad);
          const rightZ = -Math.sin(yawRad);
          const hubX = lx + fwdX * 10.0;
          const hubY = baseY + hubH;
          const hubZ = lz + fwdZ * 10.0;
          const phase = (placed * 1.13 + seed * 6.28) % (Math.PI * 2);
          const speed = 1.18 + (placed % 4) * 0.11;

          turbines.push({ hubX, hubY, hubZ, rightX, rightZ, yawRad, phase, speed });

          for (let b = 0; b < 3; b++) {
            bladeItems.push({ x: hubX, y: hubY, z: hubZ, sx: 2.8, sy: bladeLen, sz: 1.1, color: 0xf8fafc });
          }
          placed++;
        }
      }

      let drawCalls = 0;
      const mTowers = buildInstanced(unitCylGeo, turbineWhiteMat, towers, true);
      if (mTowers) { g.add(mTowers); drawCalls++; }
      const mBlades = buildInstanced(unitBoxGeo, turbineWhiteMat, bladeItems, true);
      if (mBlades) { g.add(mBlades); drawCalls++; }
      const mBeacons = buildInstanced(unitSphereGeo, beaconRedMat, beacons, false);
      if (mBeacons) { g.add(mBeacons); drawCalls++; }

      const updateBladeMatrices = (dt) => {
        if (!mBlades) return;
        const halfBlade = bladeLen * 0.5;
        let idx = 0;
        for (let t = 0; t < turbines.length; t++) {
          const tb = turbines[t];
          tb.phase = (tb.phase + tb.speed * dt) % (Math.PI * 2);
          for (let b = 0; b < 3; b++) {
            const ang = tb.phase + (b * Math.PI * 2) / 3;
            const sinA = Math.sin(ang);
            const cosA = Math.cos(ang);
            const bx = tb.hubX + tb.rightX * (sinA * halfBlade);
            const by = tb.hubY + cosA * halfBlade;
            const bz = tb.hubZ + tb.rightZ * (sinA * halfBlade);
            dummy.position.set(bx, by, bz);
            dummy.rotation.order = 'YXZ';
            dummy.rotation.set(0, tb.yawRad, -ang);
            dummy.scale.set(2.8, bladeLen, 1.1);
            dummy.updateMatrix();
            mBlades.setMatrixAt(idx++, dummy.matrix);
          }
        }
        if (mBlades.instanceMatrix) mBlades.instanceMatrix.needsUpdate = true;
      };
      // Initialize blades cleanly at t = 0
      updateBladeMatrices(0);

      return {
        group: g,
        drawCalls,
        animate: (dt) => { if (dt > 0) updateBladeMatrices(dt); }
      };
    }

    // =========================================================================
    // BUILDER 4: ICONIC MEGA STADIUMS & ARENAS (4 draw calls!)
    // =========================================================================
    function buildStadium(item, wx, wz) {
      const g = new T.Group();
      g.name = 'CorridorStadium_' + item.id;
      const gy = Math.max(0.5, sampleGround(wx, wz));
      g.position.set(wx, gy, wz);
      g.rotation.y = -((item.headingDeg || 0) * Math.PI) / 180;

      const rx = item.rx || 142;
      const rz = item.rz || 116;
      const wallH = item.wallH || 46;
      const style = item.style || 'open';
      const roofColor = item.roofColor || 0xe8edf2;

      const shells = [];
      const floods = [];
      const beacons = [];

      const segs = 28;
      const isNest = style === 'nest';
      const isGold = style === 'golden_bowl';
      const isDome = style === 'dome';
      const isSofi = style === 'sofi';
      const isSilver = style === 'silver_wrap';

      for (let i = 0; i < segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        const cosA = Math.cos(a), sinA = Math.sin(a);
        const px = cosA * rx;
        const pz = sinA * rz;
        // Tangent angle around ellipse
        const tx = -sinA * rx, tz = cosA * rz;
        const tangentY = Math.atan2(tx, tz);
        const segLen = (Math.hypot(tx, tz) * (Math.PI * 2)) / segs + 3.5;

        // Outer architectural bowl wall (stepped tiered concrete / metallic louvers / golden lattice)
        const wallColor = isGold ? roofColor : isNest ? 0x525a62 : isSilver ? 0xc2ccd6 : 0xc8ced4;
        shells.push({ x: px, y: wallH * 0.45, z: pz, sx: 16, sy: wallH * 0.9, sz: segLen, ry: tangentY, color: wallColor });

        // Glazed concourse facade band
        const facadeColor = isNest ? 0xa82a24 : isGold ? 0x7c5c22 : 0x45657e;
        shells.push({ x: px * 1.02, y: wallH * 0.58, z: pz * 1.02, sx: 17.5, sy: wallH * 0.24, sz: segLen * 0.96, ry: tangentY, color: facadeColor });

        // Inner seating tier bowl sloping downward toward turf
        shells.push({ x: px * 0.78, y: wallH * 0.28, z: pz * 0.78, sx: 26, sy: wallH * 0.56, sz: segLen * 0.86, ry: tangentY, color: 0x8e969e });

        // Roof canopy geometry by architectural style
        if (isDome) {
          // Geodesic enclosed dome arches rising to center crown
          shells.push({ x: px * 0.62, y: wallH + 10, z: pz * 0.62, sx: rx * 0.68, sy: 6.5, sz: segLen * 0.78, ry: tangentY, color: roofColor });
          shells.push({ x: px * 0.28, y: wallH + 18, z: pz * 0.28, sx: rx * 0.36, sy: 6.0, sz: segLen * 0.48, ry: tangentY, color: roofColor });
        } else if (style === 'spiral') {
          // Kaohsiung National Stadium open C-spiral solar canopy
          if (i < segs - 4) {
            shells.push({ x: px * 0.92, y: wallH + 3.5, z: pz * 0.92, sx: 36, sy: 4.5, sz: segLen * 1.04, ry: tangentY, color: roofColor });
          }
        } else if (isSofi) {
          // Sweeping oversized translucent white boomerang canopy
          shells.push({ x: px * 0.94, y: wallH + 6.5, z: pz * 0.94, sx: 58, sy: 4.2, sz: segLen * 1.15, ry: tangentY, color: roofColor });
        } else {
          // Swooping cantilevered canopy ring over seating bowl
          shells.push({ x: px * 0.88, y: wallH + 2.5, z: pz * 0.88, sx: 38, sy: 4.5, sz: segLen * 1.02, ry: tangentY, color: roofColor });
        }

        // Night stadium floodlight ring inside upper canopy
        if (i % 2 === 0) {
          floods.push({ x: px * 0.74, y: wallH + 0.5, z: pz * 0.74, sx: 6.5, sy: 3.2, sz: segLen * 0.8, ry: tangentY });
        }
      }

      // Bespoke iconic stadium landmarks!
      if (style === 'wembley') {
        // Iconic 133m tall Wembley Arch spanning 315m across the stadium!
        const archPts = 22;
        const archSpanHalf = rx * 1.08;
        const archHeight = 133;
        for (let k = 0; k < archPts; k++) {
          const t1 = -1 + (2 * k) / archPts;
          const t2 = -1 + (2 * (k + 1)) / archPts;
          const x1 = t1 * archSpanHalf, x2 = t2 * archSpanHalf;
          const y1 = 10 + (archHeight - 10) * (1 - t1 * t1);
          const y2 = 10 + (archHeight - 10) * (1 - t2 * t2);
          const tiltZ = -24 * (1 - t1 * t1);
          const mx = (x1 + x2) * 0.5, my = (y1 + y2) * 0.5;
          const angZ = Math.atan2(y2 - y1, x2 - x1);
          const segL = Math.hypot(x2 - x1, y2 - y1) + 2;
          shells.push({ x: mx, y: my, z: tiltZ, sx: segL, sy: 7.2, sz: 7.2, rz: angZ, color: 0xf4f8fc });
          if (k % 2 === 0) {
            floods.push({ x: mx, y: my + 3.8, z: tiltZ, sx: segL * 0.8, sy: 2.2, sz: 4.5, rz: angZ });
          }
        }
        beacons.push({ x: 0, y: archHeight + 4.5, z: -24, sx: 2.8, sy: 2.8, sz: 2.8 });
      } else if (style === 'mcg') {
        // Melbourne Cricket Ground 6 iconic 75m floodlight towers!
        for (let t = 0; t < 6; t++) {
          const a = (t / 6) * Math.PI * 2 + 0.25;
          const tx = Math.cos(a) * (rx + 10);
          const tz = Math.sin(a) * (rz + 10);
          shells.push({ x: tx, y: 40, z: tz, sx: 4.5, sy: 80, sz: 4.5, color: 0xd0d8e0 });
          floods.push({ x: tx, y: 80, z: tz, sx: 14, sy: 8, sz: 6, ry: -a });
          beacons.push({ x: tx, y: 86, z: tz, sx: 2.2, sy: 2.2, sz: 2.2 });
        }
      } else if (isDome) {
        // Central dome cap + apex beacon
        shells.push({ x: 0, y: wallH + 22, z: 0, sx: rx * 0.55, sy: 7, sz: rz * 0.55, color: roofColor });
        beacons.push({ x: 0, y: wallH + 28, z: 0, sx: 2.4, sy: 2.4, sz: 2.4 });
      } else {
        // Standard cardinal roof aviation warning beacons
        beacons.push({ x: rx * 0.92, y: wallH + 7, z: 0, sx: 2.2, sy: 2.2, sz: 2.2 });
        beacons.push({ x: -rx * 0.92, y: wallH + 7, z: 0, sx: 2.2, sy: 2.2, sz: 2.2 });
      }

      let drawCalls = 0;
      const mShell = buildInstanced(unitBoxGeo, stadiumShellMat, shells, true);
      if (mShell) { g.add(mShell); drawCalls++; }

      // Bright green turf pitch nestled inside the elliptical bowl (Draw call #2)
      const turfMesh = new T.Mesh(unitCylGeo, stadiumTurfMat);
      turfMesh.position.set(0, 2.2, 0);
      turfMesh.scale.set(rx * 1.24, 1.4, rz * 1.18);
      turfMesh.receiveShadow = true;
      g.add(turfMesh);
      drawCalls++;

      const mFlood = buildInstanced(unitBoxGeo, stadiumFloodMat, floods, false);
      if (mFlood) { g.add(mFlood); drawCalls++; }
      const mBeacons = buildInstanced(unitSphereGeo, beaconRedMat, beacons, false);
      if (mBeacons) { g.add(mBeacons); drawCalls++; }

      return { group: g, drawCalls, animate: null };
    }

    // =========================================================================
    // BUILDER 5: MACRO GEOGRAPHY — COASTAL ISLANDS & SOLAR/DESERT LANDMARKS (3-4 draw calls!)
    // =========================================================================
    function buildMacroGeography(item, wx, wz) {
      const g = new T.Group();
      g.name = 'CorridorGeo_' + item.id;
      const gy = sampleGround(wx, wz);
      const isSea = item.variant === 'palm_atlantis' || item.variant === 'alcatraz';
      const baseY = isSea ? (gy > 3 ? gy : 0) : Math.max(0.5, gy);
      g.position.set(wx, baseY, wz);
      g.rotation.y = -((item.headingDeg || 0) * Math.PI) / 180;

      const boxes = [];
      const cyls = [];
      const glows = [];
      const beacons = [];
      let rotators = null;

      if (item.variant === 'palm_atlantis') {
        // Dubai Palm Jumeirah sweeping golden crescent + palm fronds + Coral Atlantis Twin-Tower Arch Hotel!
        const sandGold = 0xdec494;
        const coralPink = 0xe49d88;
        const turquoise = 0x1ea8b8;
        const crescentR = 780;
        const segs = 24;
        for (let i = 0; i < segs; i++) {
          const a = -Math.PI * 0.72 + (Math.PI * 1.44 * i) / (segs - 1);
          const cx = Math.sin(a) * crescentR;
          const cz = -Math.cos(a) * crescentR;
          boxes.push({ x: cx, y: 1.8, z: cz, sx: 118, sy: 9.0, sz: 78, ry: -a, color: sandGold });
          if (i % 2 === 0) {
            glows.push({ x: cx * 0.96, y: 7.2, z: cz * 0.96, sx: 65, sy: 1.6, sz: 4.5, ry: -a });
          }
        }
        // Central Palm Trunk + 10 iconic radiating sand fronds
        boxes.push({ x: 0, y: 1.6, z: 180, sx: 95, sy: 8.0, sz: 920, color: sandGold });
        for (let f = 0; f < 5; f++) {
          const fz = -240 + f * 145;
          const frondLen = 460 - Math.abs(f - 2) * 55;
          boxes.push({ x: -frondLen * 0.5 - 30, y: 1.5, z: fz, sx: frondLen, sy: 7.0, sz: 46, ry: 0.14, color: sandGold });
          boxes.push({ x: frondLen * 0.5 + 30, y: 1.5, z: fz, sx: frondLen, sy: 7.0, sz: 46, ry: -0.14, color: sandGold });
        }
        // Iconic Atlantis The Palm Hotel at apex of crescent (z = -crescentR)
        const az = -crescentR;
        boxes.push({ x: -78, y: 48, z: az, sx: 68, sy: 92, sz: 38, color: coralPink });
        boxes.push({ x: 78, y: 48, z: az, sx: 68, sy: 92, sz: 38, color: coralPink });
        // Grand central bridge & Arabian arch crown
        boxes.push({ x: 0, y: 78, z: az, sx: 120, sy: 34, sz: 34, color: coralPink });
        boxes.push({ x: -125, y: 30, z: az + 10, sx: 55, sy: 56, sz: 32, color: coralPink });
        boxes.push({ x: 125, y: 30, z: az + 10, sx: 55, sy: 56, sz: 32, color: coralPink });
        cyls.push({ x: -78, y: 102, z: az, sx: 22, sy: 24, sz: 22, color: turquoise });
        cyls.push({ x: 78, y: 102, z: az, sx: 22, sy: 24, sz: 22, color: turquoise });
        glows.push({ x: 0, y: 66, z: az + 18, sx: 76, sy: 4.5, sz: 3.5 });
        beacons.push({ x: -78, y: 116, z: az, sx: 2.6, sy: 2.6, sz: 2.6 });
        beacons.push({ x: 78, y: 116, z: az, sx: 2.6, sy: 2.6, sz: 2.6 });
      } else if (item.variant === 'alcatraz') {
        // Alcatraz Island / Diamond Head coastal rock island + cellhouse + rotating lighthouse
        boxes.push({ x: 0, y: 10, z: 0, sx: 240, sy: 34, sz: 135, color: 0x7c7b72 });
        boxes.push({ x: 12, y: 24, z: -6, sx: 175, sy: 20, sz: 92, color: 0x6c7465 });
        // Historic concrete cellhouse block & dock
        boxes.push({ x: 18, y: 42, z: -8, sx: 112, sy: 22, sz: 34, color: 0xd2cec4 });
        boxes.push({ x: -78, y: 14, z: 48, sx: 46, sy: 12, sz: 24, color: 0xb6b2a8 });
        // Iconic white cylindrical lighthouse + water tower
        cyls.push({ x: -34, y: 52, z: 4, sx: 11, sy: 54, sz: 11, color: 0xf4f6f8 });
        cyls.push({ x: 64, y: 48, z: -22, sx: 14, sy: 22, sz: 14, color: 0x8ea4b2 });
        beacons.push({ x: -34, y: 82, z: 4, sx: 2.2, sy: 2.2, sz: 2.2 });
        // Rotating twin lighthouse light beams!
        glows.push({ x: -34, y: 78, z: 4, sx: 6.5, sy: 6.5, sz: 145 });
        rotators = { idx: 0, x: -34, y: 78, z: 4, sx: 5.5, sy: 5.5, sz: 150, angle: 0, speed: 0.95 };
      } else if (item.variant === 'peak_tower') {
        // Hong Kong Victoria Peak Tower (iconic inverted-wok cantilevered summit deck) / Kouri Ocean Tower
        boxes.push({ x: 0, y: 14, z: 0, sx: 92, sy: 28, sz: 62, color: 0x9aa2aa });
        boxes.push({ x: 0, y: 38, z: 0, sx: 115, sy: 18, sz: 54, color: 0xe6e0d2 });
        // Swooping upturned cantilevered wok wings
        boxes.push({ x: -58, y: 48, z: 0, sx: 48, sy: 14, sz: 56, rz: -0.34, color: 0xf2ece0 });
        boxes.push({ x: 58, y: 48, z: 0, sx: 48, sy: 14, sz: 56, rz: 0.34, color: 0xf2ece0 });
        glows.push({ x: 0, y: 48, z: 28, sx: 130, sy: 4.2, sz: 2.4 });
        beacons.push({ x: -78, y: 59, z: 0, sx: 2.2, sy: 2.2, sz: 2.2 });
        beacons.push({ x: 78, y: 59, z: 0, sx: 2.2, sy: 2.2, sz: 2.2 });
      } else if (item.variant === 'fuji_summit') {
        // Mt. Fuji Summit Crater Snow Rim + White Geodesic Weather Radome + Crimson Summit Torii
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          boxes.push({ x: Math.cos(a) * 160, y: 12, z: Math.sin(a) * 160, sx: 88, sy: 28, sz: 56, ry: -a, color: 0xf2f6fa });
        }
        // White observatory building & geodesic radome
        boxes.push({ x: -145, y: 32, z: -20, sx: 36, sy: 22, sz: 24, color: 0xe8edf2 });
        cyls.push({ x: -145, y: 52, z: -20, sx: 22, sy: 22, sz: 22, color: 0xfafcff });
        // Crimson summit Torii gate
        boxes.push({ x: 140, y: 34, z: 0, sx: 4.5, sy: 28, sz: 4.5, color: 0xc82b20 });
        boxes.push({ x: 140, y: 34, z: 22, sx: 4.5, sy: 28, sz: 4.5, color: 0xc82b20 });
        boxes.push({ x: 140, y: 48, z: 11, sx: 5.5, sy: 4.5, sz: 34, color: 0xc82b20 });
        beacons.push({ x: -145, y: 66, z: -20, sx: 2.6, sy: 2.6, sz: 2.6 });
      } else if (item.variant === 'dam') {
        // Shihmen Reservoir Concrete Embankment Dam + Spillway Chutes + Turquoise Reservoir Surface
        for (let i = -5; i <= 5; i++) {
          const zCurve = Math.abs(i) * Math.abs(i) * 2.2;
          boxes.push({ x: i * 36, y: 34, z: zCurve, sx: 40, sy: 84, sz: 44, ry: -i * 0.05, color: 0xbac0c6 });
        }
        // Stepped concrete spillway chutes + foaming white discharge apron
        boxes.push({ x: 0, y: 32, z: 42, sx: 110, sy: 62, sz: 48, rx: 0.42, color: 0xd8e0e6 });
        boxes.push({ x: 0, y: 4, z: 95, sx: 135, sy: 6, sz: 75, color: 0xe4f2f8 });
        // Turquoise upstream reservoir basin behind dam
        boxes.push({ x: 0, y: 66, z: -240, sx: 420, sy: 4, sz: 440, color: 0x1c788a });
        cyls.push({ x: -95, y: 74, z: -32, sx: 16, sy: 34, sz: 16, color: 0xdce2e8 });
        glows.push({ x: 0, y: 78, z: 2, sx: 340, sy: 2.4, sz: 3.0 });
        beacons.push({ x: -95, y: 94, z: -32, sx: 2.4, sy: 2.4, sz: 2.4 });
      } else if (item.variant === 'solar_tower') {
        // Dubai MBR Concentrated Solar Park: 3 concentric shimmering heliostat mirror rings + 260m blazing receiver tower!
        for (let ring = 1; ring <= 3; ring++) {
          const rad = 140 + ring * 115;
          const cnt = 14 + ring * 6;
          for (let k = 0; k < cnt; k++) {
            const a = (k / cnt) * Math.PI * 2;
            boxes.push({ x: Math.cos(a) * rad, y: 6, z: Math.sin(a) * rad, sx: 42, sy: 3.5, sz: 24, rx: 0.25, ry: -a, color: 0x9ec4e2 });
          }
        }
        // Central 260m solar tower
        cyls.push({ x: 0, y: 120, z: 0, sx: 24, sy: 240, sz: 24, color: 0xe6e4dc });
        glows.push({ x: 0, y: 244, z: 0, sx: 24, sy: 36, sz: 24 });
        beacons.push({ x: 0, y: 268, z: 0, sx: 3.2, sy: 3.2, sz: 3.2 });
      } else if (item.variant === 'alpine_tower') {
        // Zurich Uetliberg Panoramic Broadcast Tower
        cyls.push({ x: 0, y: 65, z: 0, sx: 12, sy: 130, sz: 12, color: 0xdce2e8 });
        cyls.push({ x: 0, y: 112, z: 0, sx: 30, sy: 14, sz: 30, color: 0x486e8a });
        cyls.push({ x: 0, y: 158, z: 0, sx: 3.6, sy: 58, sz: 3.6, color: 0xd43828 });
        glows.push({ x: 0, y: 112, z: 0, sx: 31, sy: 4.5, sz: 31 });
        beacons.push({ x: 0, y: 190, z: 0, sx: 2.8, sy: 2.8, sz: 2.8 });
      } else {
        // Table Mountain Flat Sandstone Cliff & Cableway Upper Station
        boxes.push({ x: 0, y: 18, z: 0, sx: 260, sy: 42, sz: 120, color: 0x988e7e });
        boxes.push({ x: 0, y: 45, z: 18, sx: 78, sy: 16, sz: 42, color: 0xe6e0d4 });
        cyls.push({ x: -48, y: 52, z: 42, sx: 6, sy: 26, sz: 6, color: 0xd2d8de });
        cyls.push({ x: 48, y: 52, z: 42, sx: 6, sy: 26, sz: 6, color: 0xd2d8de });
        glows.push({ x: 0, y: 54, z: 36, sx: 74, sy: 2.8, sz: 2.8 });
        beacons.push({ x: 0, y: 64, z: 18, sx: 2.6, sy: 2.6, sz: 2.6 });
      }

      let drawCalls = 0;
      const mBoxes = buildInstanced(unitBoxGeo, macroGeoMat, boxes, true);
      if (mBoxes) { g.add(mBoxes); drawCalls++; }
      const mCyls = buildInstanced(unitCylGeo, macroGeoMat, cyls, true);
      if (mCyls) { g.add(mCyls); drawCalls++; }
      const mGlows = buildInstanced(unitBoxGeo, lighthouseBeamMat, glows, false);
      if (mGlows) { g.add(mGlows); drawCalls++; }
      const mBeacons = buildInstanced(unitSphereGeo, beaconRedMat, beacons, false);
      if (mBeacons) { g.add(mBeacons); drawCalls++; }

      const animate = rotators && mGlows ? (dt) => {
        if (dt <= 0) return;
        rotators.angle = (rotators.angle + rotators.speed * dt) % (Math.PI * 2);
        dummy.position.set(rotators.x, rotators.y, rotators.z);
        dummy.rotation.set(0, rotators.angle, 0);
        dummy.scale.set(rotators.sx, rotators.sy, rotators.sz);
        dummy.updateMatrix();
        mGlows.setMatrixAt(rotators.idx, dummy.matrix);
        if (mGlows.instanceMatrix) mGlows.instanceMatrix.needsUpdate = true;
      } : null;

      return { group: g, drawCalls, animate };
    }

    function buildFeature(item, wx, wz) {
      if (item.type === 'suspension_bridge' || item.type === 'cable_bridge') {
        return buildBridge(item, wx, wz);
      }
      if (item.type === 'container_port') {
        return buildContainerPort(item, wx, wz);
      }
      if (item.type === 'offshore_windfarm') {
        return buildWindFarm(item, wx, wz);
      }
      if (item.type === 'stadium') {
        return buildStadium(item, wx, wz);
      }
      return buildMacroGeography(item, wx, wz);
    }

    // Precompute world coordinates for fast streaming distance queries
    const catalogEntries = REAL_100KM_CORRIDORS.map((item) => {
      const pt = toWorldCoords(item.lat, item.lon);
      return Object.assign({}, item, { wx: pt.x, wz: pt.z });
    });

    const stats = {
      catalogCount: catalogEntries.length,
      activeCount: 0,
      totalBuilt: 0,
      totalDisposed: 0,
      drawCallsActive: 0,
      streamInKm: STREAM_IN_RADIUS / 1000,
      streamOutKm: STREAM_OUT_RADIUS / 1000,
      airportCount: Array.isArray(airports) ? airports.length : 0,
      byType: {
        suspension_bridge: 0,
        cable_bridge: 0,
        container_port: 0,
        offshore_windfarm: 0,
        stadium: 0,
        solar_desert_landmark: 0,
        coastal_island: 0
      },
      activeIds: []
    };

    for (let i = 0; i < catalogEntries.length; i++) {
      const t = catalogEntries[i].type;
      stats.byType[t] = (stats.byType[t] || 0) + 1;
    }

    const activeMap = new Map();
    let elapsed = 0;

    function disposeEntry(entry) {
      if (!entry || !entry.group) return;
      if (typeof root.remove === 'function') root.remove(entry.group);
      if (typeof entry.group.traverse === 'function') {
        entry.group.traverse((obj) => {
          if (obj && obj.isInstancedMesh && typeof obj.dispose === 'function') {
            obj.dispose();
          } else if (obj && obj.geometry && !sharedGeos.has(obj.geometry) && typeof obj.geometry.dispose === 'function') {
            obj.geometry.dispose();
          }
        });
      }
    }

    function update(px, pz, dt = 0.016, dayRatio = 1, quality = 'high') {
      const safeDt = Number.isFinite(dt) ? Math.max(0, Math.min(0.25, dt)) : 0.016;
      const safeDay = Number.isFinite(dayRatio) ? dayRatio : 1;
      elapsed += safeDt;

      // Sync night emissives when dayRatio < 0.45
      const nightFactor = safeDay < 0.45 ? Math.min(1, (0.45 - safeDay) / 0.35) : 0;
      const blink = 0.5 + 0.5 * Math.sin(elapsed * 3.8);
      beaconRedMat.emissiveIntensity = (0.35 + nightFactor * 1.65) * (0.35 + 0.65 * blink);
      deckGlowMat.emissiveIntensity = 0.08 + nightFactor * 1.45;
      stadiumFloodMat.emissiveIntensity = 0.12 + nightFactor * 1.85;
      carHeadlightMat.emissiveIntensity = 0.25 + nightFactor * 1.55;
      lighthouseBeamMat.emissiveIntensity = 0.45 + nightFactor * 1.95;

      // Stream out features beyond 130 km cleanly
      let changed = false;
      for (const [id, entry] of activeMap) {
        const dx = entry.item.wx - px;
        const dz = entry.item.wz - pz;
        if (dx * dx + dz * dz > STREAM_OUT_SQ) {
          disposeEntry(entry);
          activeMap.delete(id);
          stats.totalDisposed++;
          changed = true;
        }
      }

      // Stream in features within 105 km
      const maxBuildPerFrame = activeMap.size === 0 ? 28 : 8;
      let builtThisFrame = 0;
      for (let i = 0; i < catalogEntries.length && builtThisFrame < maxBuildPerFrame; i++) {
        const item = catalogEntries[i];
        if (activeMap.has(item.id)) continue;
        const dx = item.wx - px;
        const dz = item.wz - pz;
        if (dx * dx + dz * dz <= STREAM_IN_SQ) {
          const built = buildFeature(item, item.wx, item.wz);
          if (built && built.group) {
            root.add(built.group);
            activeMap.set(item.id, { item, group: built.group, drawCalls: built.drawCalls || 0, animate: built.animate });
            stats.totalBuilt++;
            builtThisFrame++;
            changed = true;
          }
        }
      }

      if (changed) {
        let dc = 0;
        const ids = [];
        for (const [id, entry] of activeMap) {
          dc += entry.drawCalls;
          ids.push(id);
        }
        stats.activeCount = activeMap.size;
        stats.drawCallsActive = dc;
        stats.activeIds = ids;
      }

      // Animate wind turbines, bridge traffic, coastal container ships, and lighthouses
      const animScale = quality === 'low' ? 0.5 : 1.0;
      for (const entry of activeMap.values()) {
        if (entry.animate) entry.animate(safeDt * animScale, elapsed, nightFactor);
      }
    }

    return {
      root,
      update,
      stats,
      catalog: REAL_100KM_CORRIDORS
    };
  }

  createRealWorld100kmCorridors.createRealWorld100kmCorridors = createRealWorld100kmCorridors;
  createRealWorld100kmCorridors.REAL_100KM_CORRIDORS = REAL_100KM_CORRIDORS;

  if (typeof window !== 'undefined') {
    window.createRealWorld100kmCorridors = createRealWorld100kmCorridors;
    window.REAL_100KM_CORRIDORS = REAL_100KM_CORRIDORS;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.createRealWorld100kmCorridors = createRealWorld100kmCorridors;
    globalThis.REAL_100KM_CORRIDORS = REAL_100KM_CORRIDORS;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = createRealWorld100kmCorridors;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
