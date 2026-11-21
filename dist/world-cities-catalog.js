'use strict';
/* ============================================================================
 * World Cities Catalog & LOD2 Distant Horizon Skyline Renderer
 * 471 real-world major cities across all continents with O(1) spatial hash
 * grid lookup and 3-draw-call GPU InstancedMesh distant skyline/sprawl/glow.
 * ============================================================================ */
(function (root) {
  // Compact tuples: [lat, lon, name, region, tier, radiusKm]
  // Regions: europe, mediterranean, north_america, east_asia, middle_east,
  //          latin_america, se_asia, south_asia, oceania, africa
  // Tiers: 1 = Megacity 7M+ (16-24km), 2 = Major Metro 1.8M-7M (9-15km),
  //        3 = Regional City 400k-1.8M (4.5-8.5km)
  const WORLD_CITIES_DATA = [
    // ==================== EAST ASIA (66) ====================
    [35.6762, 139.6503, '東京 Tokyo', 'east_asia', 1, 24],
    [35.4437, 139.6380, '橫濱 Yokohama', 'east_asia', 2, 14],
    [34.6937, 135.5023, '大阪 Osaka', 'east_asia', 1, 20],
    [35.0116, 135.7681, '京都 Kyoto', 'east_asia', 2, 10],
    [35.1815, 136.9066, '名古屋 Nagoya', 'east_asia', 1, 17],
    [43.0618, 141.3545, '札幌 Sapporo', 'east_asia', 2, 11],
    [33.5902, 130.4017, '福岡 Fukuoka', 'east_asia', 2, 11],
    [34.6901, 135.1955, '神戶 Kobe', 'east_asia', 2, 10],
    [34.3853, 132.4553, '廣島 Hiroshima', 'east_asia', 3, 8.0],
    [38.2682, 140.8694, '仙台 Sendai', 'east_asia', 3, 7.5],
    [33.8835, 130.8752, '北九州 Kitakyushu', 'east_asia', 3, 7.0],
    [37.9162, 139.0364, '新潟 Niigata', 'east_asia', 3, 6.5],
    [32.8031, 130.7079, '熊本 Kumamoto', 'east_asia', 3, 6.0],
    [31.5966, 130.5571, '鹿兒島 Kagoshima', 'east_asia', 3, 5.5],
    [26.2124, 127.6809, '那霸 Naha', 'east_asia', 3, 6.5],
    [37.5665, 126.9780, '首爾 Seoul', 'east_asia', 1, 22],
    [35.1796, 129.0756, '釜山 Busan', 'east_asia', 2, 13],
    [37.4563, 126.7052, '仁川 Incheon', 'east_asia', 2, 12],
    [35.8714, 128.6014, '大邱 Daegu', 'east_asia', 2, 10],
    [36.3504, 127.3845, '大田 Daejeon', 'east_asia', 3, 8.0],
    [35.1595, 126.8526, '光州 Gwangju', 'east_asia', 3, 8.0],
    [35.5384, 129.3114, '蔚山 Ulsan', 'east_asia', 3, 7.5],
    [33.4996, 126.5312, '濟州 Jeju', 'east_asia', 3, 5.5],
    [25.0330, 121.5654, '台北 Taipei', 'east_asia', 1, 16],
    [25.0120, 121.4657, '新北 New Taipei', 'east_asia', 2, 13],
    [24.9936, 121.3010, '桃園 Taoyuan', 'east_asia', 2, 11],
    [24.1477, 120.6736, '台中 Taichung', 'east_asia', 2, 12],
    [22.9999, 120.2269, '台南 Tainan', 'east_asia', 2, 10],
    [22.6273, 120.3014, '高雄 Kaohsiung', 'east_asia', 2, 12],
    [24.8138, 120.9675, '新竹 Hsinchu', 'east_asia', 3, 6.5],
    [23.9872, 121.6016, '花蓮 Hualien', 'east_asia', 3, 4.8],
    [22.7583, 121.1444, '台東 Taitung', 'east_asia', 3, 4.5],
    [23.4801, 120.4491, '嘉義 Chiayi', 'east_asia', 3, 5.2],
    [25.1276, 121.7392, '基隆 Keelung', 'east_asia', 3, 5.0],
    [22.3193, 114.1694, '香港 Hong Kong', 'east_asia', 1, 16],
    [22.1987, 113.5439, '澳門 Macau', 'east_asia', 3, 5.0],
    [31.2304, 121.4737, '上海 Shanghai', 'east_asia', 1, 24],
    [39.9042, 116.4074, '北京 Beijing', 'east_asia', 1, 23],
    [22.5431, 114.0579, '深圳 Shenzhen', 'east_asia', 1, 20],
    [23.1291, 113.2644, '廣州 Guangzhou', 'east_asia', 1, 21],
    [30.5728, 104.0668, '成都 Chengdu', 'east_asia', 1, 19],
    [29.5630, 106.5516, '重慶 Chongqing', 'east_asia', 1, 19],
    [30.2741, 120.1551, '杭州 Hangzhou', 'east_asia', 1, 17],
    [32.0603, 118.7969, '南京 Nanjing', 'east_asia', 1, 16],
    [30.5928, 114.3055, '武漢 Wuhan', 'east_asia', 1, 18],
    [34.3416, 108.9398, '西安 Xi\'an', 'east_asia', 1, 17],
    [39.3434, 117.3616, '天津 Tianjin', 'east_asia', 1, 18],
    [31.2989, 120.5853, '蘇州 Suzhou', 'east_asia', 1, 16],
    [24.4798, 118.0894, '廈門 Xiamen', 'east_asia', 2, 12],
    [36.0671, 120.3826, '青島 Qingdao', 'east_asia', 2, 14],
    [38.9140, 121.6147, '大連 Dalian', 'east_asia', 2, 13],
    [45.8038, 126.5350, '哈爾濱 Harbin', 'east_asia', 2, 14],
    [41.8057, 123.4315, '瀋陽 Shenyang', 'east_asia', 1, 16],
    [25.0389, 102.7183, '昆明 Kunming', 'east_asia', 2, 13],
    [28.2282, 112.9388, '長沙 Changsha', 'east_asia', 2, 14],
    [34.7466, 113.6253, '鄭州 Zhengzhou', 'east_asia', 1, 16],
    [26.0745, 119.2965, '福州 Fuzhou', 'east_asia', 2, 12],
    [29.8683, 121.5440, '寧波 Ningbo', 'east_asia', 2, 13],
    [31.8206, 117.2272, '合肥 Hefei', 'east_asia', 2, 13],
    [36.6512, 117.1201, '濟南 Jinan', 'east_asia', 2, 13],
    [22.8170, 108.3665, '南寧 Nanning', 'east_asia', 2, 11],
    [20.0440, 110.1999, '海口 Haikou', 'east_asia', 2, 10],
    [18.2528, 109.5120, '三亞 Sanya', 'east_asia', 3, 6.5],
    [43.8256, 87.6168, '烏魯木齊 Urumqi', 'east_asia', 2, 12],
    [29.6500, 91.1000, '拉薩 Lhasa', 'east_asia', 3, 6.0],
    [47.8864, 106.9057, '烏蘭巴托 Ulaanbaatar', 'east_asia', 3, 8.0],

    // ==================== SOUTHEAST ASIA (34) ====================
    [1.3521, 103.8198, '新加坡 Singapore', 'se_asia', 2, 15],
    [13.7563, 100.5018, '曼谷 Bangkok', 'se_asia', 1, 21],
    [18.7883, 98.9853, '清邁 Chiang Mai', 'se_asia', 3, 7.5],
    [7.8804, 98.3923, '普吉 Phuket', 'se_asia', 3, 6.0],
    [12.9236, 100.8825, '芭達雅 Pattaya', 'se_asia', 3, 6.5],
    [7.0087, 100.4747, '合艾 Hat Yai', 'se_asia', 3, 5.5],
    [10.8231, 106.6297, '胡志明市 Ho Chi Minh City', 'se_asia', 1, 18],
    [21.0278, 105.8342, '河內 Hanoi', 'se_asia', 1, 16],
    [16.0544, 108.2022, '峴港 Da Nang', 'se_asia', 3, 7.5],
    [12.2388, 109.1967, '芽莊 Nha Trang', 'se_asia', 3, 5.5],
    [20.8449, 106.6881, '海防 Hai Phong', 'se_asia', 2, 9.5],
    [3.1390, 101.6869, '吉隆坡 Kuala Lumpur', 'se_asia', 1, 18],
    [5.4141, 100.3288, '檳城 Penang', 'se_asia', 2, 9.5],
    [1.4927, 103.7414, '新山 Johor Bahru', 'se_asia', 2, 10],
    [5.9804, 116.0735, '亞庇 Kota Kinabalu', 'se_asia', 3, 6.5],
    [1.5533, 110.3592, '古晉 Kuching', 'se_asia', 3, 6.5],
    [-6.2088, 106.8456, '雅加達 Jakarta', 'se_asia', 1, 22],
    [-7.2575, 112.7521, '泗水 Surabaya', 'se_asia', 2, 13],
    [-6.9175, 107.6191, '萬隆 Bandung', 'se_asia', 2, 12],
    [-8.6705, 115.2126, '登巴薩(峇里島) Denpasar (Bali)', 'se_asia', 3, 8.0],
    [3.5952, 98.6722, '棉蘭 Medan', 'se_asia', 2, 11],
    [-6.9667, 110.4167, '三寶壟 Semarang', 'se_asia', 2, 10],
    [-5.1477, 119.4327, '望加錫 Makassar', 'se_asia', 3, 8.0],
    [-7.7956, 110.3695, '日惹 Yogyakarta', 'se_asia', 3, 7.5],
    [14.5995, 120.9842, '馬尼拉 Manila', 'se_asia', 1, 19],
    [10.3157, 123.8854, '宿霧 Cebu', 'se_asia', 2, 10],
    [7.1907, 125.4553, '達沃 Davao', 'se_asia', 2, 9.5],
    [10.7202, 122.5621, '怡朗 Iloilo', 'se_asia', 3, 6.0],
    [16.8661, 96.1951, '仰光 Yangon', 'se_asia', 2, 13],
    [21.9588, 96.0891, '曼德勒 Mandalay', 'se_asia', 3, 8.0],
    [11.5564, 104.9282, '金邊 Phnom Penh', 'se_asia', 2, 10],
    [13.3633, 103.8564, '暹粒 Siem Reap', 'se_asia', 3, 5.5],
    [17.9757, 102.6331, '永珍 Vientiane', 'se_asia', 3, 6.5],
    [4.9031, 114.9398, '斯里巴加灣 Bandar Seri Begawan', 'se_asia', 3, 5.0],

    // ==================== SOUTH ASIA (26) ====================
    [19.0760, 72.8777, '孟買 Mumbai', 'south_asia', 1, 22],
    [28.6139, 77.2090, '德里 Delhi', 'south_asia', 1, 24],
    [12.9716, 77.5946, '班加羅爾 Bengaluru', 'south_asia', 1, 19],
    [17.3850, 78.4867, '海得拉巴 Hyderabad', 'south_asia', 1, 18],
    [13.0827, 80.2707, '清奈 Chennai', 'south_asia', 1, 17],
    [22.5726, 88.3639, '加爾各答 Kolkata', 'south_asia', 1, 18],
    [18.5204, 73.8567, '浦那 Pune', 'south_asia', 2, 14],
    [23.0225, 72.5714, '阿默達巴德 Ahmedabad', 'south_asia', 1, 16],
    [26.9124, 75.7873, '齋浦爾 Jaipur', 'south_asia', 2, 12],
    [21.1702, 72.8311, '蘇拉特 Surat', 'south_asia', 2, 13],
    [9.9312, 76.2673, '科契 Kochi', 'south_asia', 2, 10],
    [26.8467, 80.9462, '勒克瑙 Lucknow', 'south_asia', 2, 12],
    [15.4909, 73.8278, '果阿 Goa', 'south_asia', 3, 6.0],
    [30.7333, 76.7794, '昌迪加爾 Chandigarh', 'south_asia', 3, 8.0],
    [26.1445, 91.7362, '古瓦哈提 Guwahati', 'south_asia', 3, 7.5],
    [24.8607, 67.0011, '喀拉蚩 Karachi', 'south_asia', 1, 20],
    [31.5204, 74.3587, '拉合爾 Lahore', 'south_asia', 1, 18],
    [33.6844, 73.0479, '伊斯蘭瑪巴德 Islamabad', 'south_asia', 2, 11],
    [31.4504, 73.1350, '費薩拉巴德 Faisalabad', 'south_asia', 2, 11],
    [34.0151, 71.5249, '白沙瓦 Peshawar', 'south_asia', 2, 10],
    [23.8103, 90.4125, '達卡 Dhaka', 'south_asia', 1, 20],
    [22.3569, 91.7832, '吉大港 Chittagong', 'south_asia', 2, 12],
    [6.9271, 79.8612, '可倫坡 Colombo', 'south_asia', 2, 10],
    [27.7172, 85.3240, '加德滿都 Kathmandu', 'south_asia', 2, 9.5],
    [4.1755, 73.5093, '馬累 Male', 'south_asia', 3, 4.5],
    [27.4728, 89.6390, '廷布 Thimphu', 'south_asia', 3, 4.5],

    // ==================== EUROPE & MEDITERRANEAN (121) ====================
    [51.5074, -0.1278, '倫敦 London', 'europe', 1, 22],
    [53.4808, -2.2426, '曼徹斯特 Manchester', 'europe', 2, 13],
    [52.4862, -1.8904, '伯明罕 Birmingham', 'europe', 2, 13],
    [53.4084, -2.9916, '利物浦 Liverpool', 'europe', 3, 8.5],
    [53.8008, -1.5491, '里茲 Leeds', 'europe', 3, 8.5],
    [51.4545, -2.5879, '布里斯托 Bristol', 'europe', 3, 7.5],
    [55.9533, -3.1883, '愛丁堡 Edinburgh', 'europe', 3, 7.5],
    [55.8642, -4.2518, '格拉斯哥 Glasgow', 'europe', 3, 8.5],
    [54.5973, -5.9301, '貝爾法斯特 Belfast', 'europe', 3, 6.5],
    [53.3498, -6.2603, '都柏林 Dublin', 'europe', 2, 10],
    [51.8985, -8.4756, '科克 Cork', 'europe', 3, 5.5],
    [48.8566, 2.3522, '巴黎 Paris', 'europe', 1, 21],
    [45.7640, 4.8357, '里昂 Lyon', 'europe', 2, 11],
    [43.2965, 5.3698, '馬賽 Marseille', 'mediterranean', 2, 10],
    [43.7102, 7.2620, '尼斯 Nice', 'mediterranean', 3, 7.5],
    [43.6047, 1.4442, '土魯斯 Toulouse', 'europe', 3, 8.0],
    [44.8378, -0.5792, '波爾多 Bordeaux', 'europe', 3, 8.0],
    [47.2184, -1.5536, '南特 Nantes', 'europe', 3, 7.0],
    [48.5734, 7.7521, '史特拉斯堡 Strasbourg', 'europe', 3, 7.0],
    [50.6292, 3.0573, '里爾 Lille', 'europe', 3, 8.5],
    [52.5200, 13.4050, '柏林 Berlin', 'europe', 2, 15],
    [48.1351, 11.5820, '慕尼黑 Munich', 'europe', 2, 12],
    [50.1109, 8.6821, '法蘭克福 Frankfurt', 'europe', 2, 11],
    [53.5511, 9.9937, '漢堡 Hamburg', 'europe', 2, 12],
    [50.9375, 6.9603, '科隆 Cologne', 'europe', 2, 11],
    [48.7758, 9.1829, '斯圖加特 Stuttgart', 'europe', 2, 10],
    [51.2277, 6.7735, '杜塞道夫 Dusseldorf', 'europe', 2, 10],
    [51.3397, 12.3731, '萊比錫 Leipzig', 'europe', 3, 7.5],
    [51.0504, 13.7373, '德勒斯登 Dresden', 'europe', 3, 7.5],
    [49.4521, 11.0767, '紐倫堡 Nuremberg', 'europe', 3, 7.5],
    [52.3676, 4.9041, '阿姆斯特丹 Amsterdam', 'europe', 2, 11],
    [51.9244, 4.4777, '鹿特丹 Rotterdam', 'europe', 2, 10],
    [52.0705, 4.3007, '海牙 The Hague', 'europe', 3, 8.0],
    [52.0907, 5.1214, '烏特勒支 Utrecht', 'europe', 3, 7.0],
    [50.8503, 4.3517, '布魯塞爾 Brussels', 'europe', 2, 11],
    [51.2194, 4.4025, '安特衛普 Antwerp', 'europe', 3, 8.0],
    [51.0543, 3.7174, '根特 Ghent', 'europe', 3, 6.5],
    [47.3769, 8.5417, '蘇黎世 Zurich', 'europe', 3, 8.5],
    [46.2044, 6.1432, '日內瓦 Geneva', 'europe', 3, 7.0],
    [47.5596, 7.5886, '巴塞爾 Basel', 'europe', 3, 6.5],
    [46.9480, 7.4474, '伯恩 Bern', 'europe', 3, 5.5],
    [48.2082, 16.3738, '維也納 Vienna', 'europe', 2, 12],
    [47.8095, 13.0550, '薩爾茲堡 Salzburg', 'europe', 3, 5.5],
    [47.0707, 15.4395, '格拉茲 Graz', 'europe', 3, 6.0],
    [47.2692, 11.4041, '因斯布魯克 Innsbruck', 'europe', 3, 5.0],
    [50.0755, 14.4378, '布拉格 Prague', 'europe', 2, 10],
    [49.1951, 16.6068, '布爾諾 Brno', 'europe', 3, 6.5],
    [52.2297, 21.0122, '華沙 Warsaw', 'europe', 2, 12],
    [50.0647, 19.9450, '克拉科夫 Krakow', 'europe', 3, 8.0],
    [54.3520, 18.6466, '格但斯克 Gdansk', 'europe', 3, 7.5],
    [51.1079, 17.0385, '弗羅茨瓦夫 Wroclaw', 'europe', 3, 7.5],
    [52.4064, 16.9252, '波茲南 Poznan', 'europe', 3, 7.0],
    [47.4979, 19.0402, '布達佩斯 Budapest', 'europe', 2, 12],
    [41.9028, 12.4964, '羅馬 Rome', 'mediterranean', 2, 14],
    [45.4642, 9.1900, '米蘭 Milan', 'europe', 2, 14],
    [40.8518, 14.2681, '拿坡里 Naples', 'mediterranean', 2, 11],
    [45.4408, 12.3155, '威尼斯 Venice', 'mediterranean', 3, 7.0],
    [43.7696, 11.2558, '佛羅倫斯 Florence', 'mediterranean', 3, 7.5],
    [45.0703, 7.6869, '杜林 Turin', 'europe', 2, 10],
    [44.4949, 11.3426, '波隆那 Bologna', 'europe', 3, 7.5],
    [44.4056, 8.9463, '熱那亞 Genoa', 'mediterranean', 3, 7.5],
    [38.1157, 13.3615, '巴勒摩 Palermo', 'mediterranean', 3, 7.5],
    [37.5079, 15.0830, '卡塔尼亞 Catania', 'mediterranean', 3, 6.5],
    [41.1171, 16.8719, '巴里 Bari', 'mediterranean', 3, 6.5],
    [40.4168, -3.7038, '馬德里 Madrid', 'europe', 2, 15],
    [41.3874, 2.1686, '巴塞隆納 Barcelona', 'mediterranean', 2, 14],
    [39.4699, -0.3763, '瓦倫西亞 Valencia', 'mediterranean', 2, 9.5],
    [37.3891, -5.9845, '塞維亞 Seville', 'mediterranean', 3, 8.0],
    [43.2630, -2.9350, '畢爾包 Bilbao', 'europe', 3, 7.0],
    [36.7213, -4.4214, '馬拉加 Malaga', 'mediterranean', 3, 7.5],
    [41.6488, -0.8891, '薩拉戈薩 Zaragoza', 'europe', 3, 7.0],
    [39.5696, 2.6502, '帕爾馬 Palma de Mallorca', 'mediterranean', 3, 6.5],
    [28.1235, -15.4363, '拉斯帕爾馬斯 Las Palmas', 'mediterranean', 3, 6.0],
    [38.7223, -9.1393, '里斯本 Lisbon', 'mediterranean', 2, 11],
    [41.1579, -8.6291, '波多 Porto', 'mediterranean', 3, 8.5],
    [37.0194, -7.9304, '法魯 Faro', 'mediterranean', 3, 4.8],
    [37.9838, 23.7275, '雅典 Athens', 'mediterranean', 2, 13],
    [40.6401, 22.9444, '塞薩洛尼基 Thessaloniki', 'mediterranean', 3, 8.0],
    [35.3387, 25.1442, '伊拉克利翁 Heraklion', 'mediterranean', 3, 5.5],
    [59.3293, 18.0686, '斯德哥爾摩 Stockholm', 'europe', 2, 11],
    [57.7089, 11.9746, '哥德堡 Gothenburg', 'europe', 3, 7.5],
    [55.6050, 13.0038, '馬爾默 Malmo', 'europe', 3, 6.5],
    [59.9139, 10.7522, '奧斯陸 Oslo', 'europe', 3, 8.5],
    [60.3913, 5.3221, '卑爾根 Bergen', 'europe', 3, 5.5],
    [63.4305, 10.3951, '特隆赫姆 Trondheim', 'europe', 3, 5.0],
    [55.6761, 12.5683, '哥本哈根 Copenhagen', 'europe', 2, 10],
    [56.1629, 10.2039, '奧胡斯 Aarhus', 'europe', 3, 6.0],
    [60.1699, 24.9384, '赫爾辛基 Helsinki', 'europe', 3, 8.5],
    [61.4978, 23.7610, '坦佩雷 Tampere', 'europe', 3, 5.5],
    [64.1466, -21.9426, '雷克雅維克 Reykjavik', 'europe', 3, 5.5],
    [41.0082, 28.9784, '伊斯坦堡 Istanbul', 'mediterranean', 1, 21],
    [39.9334, 32.8597, '安卡拉 Ankara', 'europe', 2, 14],
    [38.4237, 27.1428, '伊茲密爾 Izmir', 'mediterranean', 2, 12],
    [36.8969, 30.7133, '安塔利亞 Antalya', 'mediterranean', 3, 8.5],
    [40.1885, 29.0610, '布爾薩 Bursa', 'mediterranean', 2, 10],
    [55.7558, 37.6173, '莫斯科 Moscow', 'europe', 1, 22],
    [59.9311, 30.3609, '聖彼得堡 Saint Petersburg', 'europe', 2, 15],
    [55.7961, 49.1064, '喀山 Kazan', 'europe', 3, 8.5],
    [55.0084, 82.9357, '新西伯利亞 Novosibirsk', 'europe', 3, 8.5],
    [56.8389, 60.6057, '葉卡捷琳堡 Yekaterinburg', 'europe', 3, 8.5],
    [43.5855, 39.7231, '索契 Sochi', 'mediterranean', 3, 6.0],
    [50.4501, 30.5234, '基輔 Kyiv', 'europe', 2, 13],
    [49.8397, 24.0297, '利維夫 Lviv', 'europe', 3, 7.0],
    [46.4825, 30.7233, '敖德薩 Odesa', 'mediterranean', 3, 8.0],
    [44.4268, 26.1025, '布加勒斯特 Bucharest', 'europe', 2, 11],
    [42.6977, 23.3219, '索菲亞 Sofia', 'europe', 3, 8.5],
    [44.7866, 20.4489, '貝爾格勒 Belgrade', 'europe', 3, 8.5],
    [45.8150, 15.9819, '札格瑞布 Zagreb', 'europe', 3, 7.5],
    [43.5081, 16.4402, '史普利特 Split', 'mediterranean', 3, 5.5],
    [42.6507, 18.0944, '杜布羅夫尼克 Dubrovnik', 'mediterranean', 3, 4.5],
    [46.0569, 14.5058, '盧比安納 Ljubljana', 'europe', 3, 5.5],
    [48.1486, 17.1077, '布拉提斯拉瓦 Bratislava', 'europe', 3, 6.5],
    [59.4370, 24.7536, '塔林 Tallinn', 'europe', 3, 6.0],
    [56.9496, 24.1052, '里加 Riga', 'europe', 3, 7.0],
    [54.6872, 25.2797, '維爾紐斯 Vilnius', 'europe', 3, 6.5],
    [49.6116, 6.1319, '盧森堡 Luxembourg', 'europe', 3, 5.0],
    [43.7384, 7.4246, '摩納哥 Monaco', 'mediterranean', 3, 4.5],
    [35.8989, 14.5146, '瓦萊塔 Valletta', 'mediterranean', 3, 5.0],
    [35.1856, 33.3823, '尼古西亞 Nicosia', 'mediterranean', 3, 5.5],
    [41.3275, 19.8187, '地拉那 Tirana', 'mediterranean', 3, 6.0],
    [43.8563, 18.4131, '塞拉耶佛 Sarajevo', 'europe', 3, 6.0],
    [41.9981, 21.4254, '史高比耶 Skopje', 'europe', 3, 6.5],

    // ==================== NORTH & CENTRAL AMERICA (85) ====================
    [40.7128, -74.0060, '紐約 New York', 'north_america', 1, 24],
    [34.0522, -118.2437, '洛杉磯 Los Angeles', 'north_america', 1, 23],
    [41.8781, -87.6298, '芝加哥 Chicago', 'north_america', 1, 19],
    [29.7604, -95.3698, '休士頓 Houston', 'north_america', 1, 18],
    [33.4484, -112.0740, '鳳凰城 Phoenix', 'north_america', 2, 15],
    [39.9526, -75.1652, '費城 Philadelphia', 'north_america', 2, 15],
    [29.4241, -98.4936, '聖安東尼奧 San Antonio', 'north_america', 2, 12],
    [32.7157, -117.1611, '聖地牙哥 San Diego', 'north_america', 2, 13],
    [32.7767, -96.7970, '達拉斯 Dallas', 'north_america', 1, 18],
    [37.3382, -121.8863, '聖荷西 San Jose', 'north_america', 2, 11],
    [37.7749, -122.4194, '舊金山 San Francisco', 'north_america', 2, 14],
    [30.2672, -97.7431, '奧斯汀 Austin', 'north_america', 2, 11],
    [30.3322, -81.6557, '傑克遜維爾 Jacksonville', 'north_america', 3, 8.5],
    [32.7555, -97.3308, '沃斯堡 Fort Worth', 'north_america', 2, 11],
    [39.9612, -82.9988, '哥倫布 Columbus', 'north_america', 2, 10],
    [39.7684, -86.1581, '印第安納波利斯 Indianapolis', 'north_america', 2, 10],
    [35.2271, -80.8431, '夏洛特 Charlotte', 'north_america', 2, 11],
    [47.6062, -122.3321, '西雅圖 Seattle', 'north_america', 2, 14],
    [39.7392, -104.9903, '丹佛 Denver', 'north_america', 2, 13],
    [38.9072, -77.0369, '華盛頓特區 Washington DC', 'north_america', 2, 15],
    [42.3601, -71.0589, '波士頓 Boston', 'north_america', 2, 14],
    [31.7619, -106.4850, '艾爾帕索 El Paso', 'north_america', 3, 7.5],
    [36.1627, -86.7816, '納什維爾 Nashville', 'north_america', 2, 10],
    [42.3314, -83.0458, '底特律 Detroit', 'north_america', 2, 14],
    [35.4676, -97.5164, '奧克拉荷馬市 Oklahoma City', 'north_america', 3, 8.5],
    [45.5152, -122.6784, '波特蘭 Portland', 'north_america', 2, 11],
    [36.1699, -115.1398, '拉斯維加斯 Las Vegas', 'north_america', 2, 12],
    [35.1495, -90.0490, '曼菲斯 Memphis', 'north_america', 3, 8.5],
    [38.2527, -85.7585, '路易維爾 Louisville', 'north_america', 3, 8.0],
    [39.2904, -76.6122, '巴爾的摩 Baltimore', 'north_america', 2, 11],
    [43.0389, -87.9065, '密爾瓦基 Milwaukee', 'north_america', 3, 8.5],
    [35.0844, -106.6504, '阿爾伯克基 Albuquerque', 'north_america', 3, 7.5],
    [32.2226, -110.9747, '土桑 Tucson', 'north_america', 3, 8.0],
    [36.7378, -119.7871, '佛雷斯諾 Fresno', 'north_america', 3, 7.5],
    [38.5816, -121.4944, '沙加緬度 Sacramento', 'north_america', 2, 11],
    [39.0997, -94.5786, '堪薩斯市 Kansas City', 'north_america', 2, 11],
    [33.4152, -111.8315, '梅薩 Mesa', 'north_america', 3, 7.5],
    [33.7490, -84.3880, '亞特蘭大 Atlanta', 'north_america', 2, 15],
    [41.2565, -95.9345, '奧馬哈 Omaha', 'north_america', 3, 7.5],
    [35.7796, -78.6382, '羅里 Raleigh', 'north_america', 3, 8.5],
    [25.7617, -80.1918, '邁阿密 Miami', 'north_america', 2, 15],
    [33.7701, -118.1937, '長灘 Long Beach', 'north_america', 3, 7.5],
    [36.8529, -75.9780, '維吉尼亞海灘 Virginia Beach', 'north_america', 3, 8.5],
    [37.8044, -122.2712, '奧克蘭 Oakland', 'north_america', 3, 8.0],
    [44.9778, -93.2650, '明尼亞波利斯 Minneapolis', 'north_america', 2, 13],
    [27.9506, -82.4572, '坦帕 Tampa', 'north_america', 2, 12],
    [36.1540, -95.9928, '土爾沙 Tulsa', 'north_america', 3, 7.5],
    [29.9511, -90.0715, '紐奧良 New Orleans', 'north_america', 3, 8.5],
    [41.4993, -81.6944, '克里夫蘭 Cleveland', 'north_america', 2, 10],
    [21.3069, -157.8583, '檀香山 Honolulu', 'north_america', 3, 8.0],
    [61.2181, -149.9003, '安克拉治 Anchorage', 'north_america', 3, 6.5],
    [40.4406, -79.9959, '匹茲堡 Pittsburgh', 'north_america', 2, 10],
    [39.1031, -84.5120, '辛辛那提 Cincinnati', 'north_america', 2, 10],
    [38.6270, -90.1994, '聖路易 St. Louis', 'north_america', 2, 11],
    [28.5383, -81.3792, '奧蘭多 Orlando', 'north_america', 2, 11],
    [40.7608, -111.8910, '鹽湖城 Salt Lake City', 'north_america', 3, 8.5],
    [43.6532, -79.3832, '多倫多 Toronto', 'north_america', 2, 15],
    [45.5017, -73.5673, '蒙特婁 Montreal', 'north_america', 2, 14],
    [49.2827, -123.1207, '溫哥華 Vancouver', 'north_america', 2, 12],
    [51.0447, -114.0719, '卡加利 Calgary', 'north_america', 3, 8.5],
    [45.4215, -75.6972, '渥太華 Ottawa', 'north_america', 3, 8.5],
    [53.5461, -113.4938, '愛德蒙頓 Edmonton', 'north_america', 3, 8.5],
    [46.8139, -71.2080, '魁北克市 Quebec City', 'north_america', 3, 7.0],
    [49.8951, -97.1384, '溫尼伯 Winnipeg', 'north_america', 3, 7.5],
    [44.6488, -63.5752, '哈利法克斯 Halifax', 'north_america', 3, 6.0],
    [48.4284, -123.3656, '維多利亞 Victoria', 'north_america', 3, 5.5],
    [19.4326, -99.1332, '墨西哥城 Mexico City', 'latin_america', 1, 22],
    [20.6597, -103.3496, '瓜達拉哈拉 Guadalajara', 'latin_america', 2, 13],
    [25.6866, -100.3161, '蒙特雷 Monterrey', 'latin_america', 2, 13],
    [19.0414, -98.2063, '普埃布拉 Puebla', 'latin_america', 2, 10],
    [32.5149, -117.0382, '蒂華納 Tijuana', 'latin_america', 2, 9.5],
    [21.1221, -101.6826, '萊昂 Leon', 'latin_america', 2, 9.0],
    [31.6904, -106.4245, '華雷斯 Juarez', 'latin_america', 3, 8.0],
    [21.1619, -86.8515, '坎昆 Cancun', 'latin_america', 3, 7.0],
    [20.9674, -89.5926, '梅里達 Merida', 'latin_america', 3, 7.5],
    [19.1738, -96.1342, '韋拉克魯斯 Veracruz', 'latin_america', 3, 6.5],
    [23.1136, -82.3666, '哈瓦那 Havana', 'latin_america', 2, 10],
    [18.4861, -69.9312, '聖多明哥 Santo Domingo', 'latin_america', 2, 11],
    [18.4655, -66.1057, '聖胡安 San Juan', 'latin_america', 2, 9.5],
    [8.9824, -79.5199, '巴拿馬市 Panama City', 'latin_america', 2, 9.5],
    [9.9281, -84.0907, '聖荷西(哥斯大黎加) San Jose (CR)', 'latin_america', 2, 9.0],
    [14.6349, -90.5069, '瓜地馬拉市 Guatemala City', 'latin_america', 2, 10],
    [17.9712, -76.7936, '京斯敦 Kingston', 'latin_america', 3, 7.0],
    [25.0343, -77.3963, '拿索 Nassau', 'latin_america', 3, 5.0],
    [17.5046, -88.1962, '貝里斯市 Belize City', 'latin_america', 3, 4.5],

    // ==================== SOUTH AMERICA (41) ====================
    [-23.5505, -46.6333, '聖保羅 Sao Paulo', 'latin_america', 1, 22],
    [-22.9068, -43.1729, '里約熱內盧 Rio de Janeiro', 'latin_america', 1, 19],
    [-15.7975, -47.8919, '巴西利亞 Brasilia', 'latin_america', 2, 12],
    [-12.9714, -38.5014, '薩爾瓦多 Salvador', 'latin_america', 2, 11],
    [-3.7172, -38.5433, '福塔雷薩 Fortaleza', 'latin_america', 2, 11],
    [-19.9167, -43.9345, '貝洛奧里藏特 Belo Horizonte', 'latin_america', 2, 13],
    [-3.1190, -60.0217, '瑪瑙斯 Manaus', 'latin_america', 2, 10],
    [-25.4284, -49.2733, '庫里奇巴 Curitiba', 'latin_america', 2, 11],
    [-8.0476, -34.8770, '勒西腓 Recife', 'latin_america', 2, 11],
    [-30.0346, -51.2177, '愉港 Porto Alegre', 'latin_america', 2, 11],
    [-1.4558, -48.4902, '貝倫 Belem', 'latin_america', 2, 9.5],
    [-16.6869, -49.2648, '戈亞尼亞 Goiania', 'latin_america', 2, 10],
    [-27.5954, -48.5480, '佛羅安那波里 Florianopolis', 'latin_america', 3, 6.5],
    [-34.6037, -58.3816, '布宜諾斯艾利斯 Buenos Aires', 'latin_america', 1, 21],
    [-31.4201, -64.1888, '哥多華 Cordoba', 'latin_america', 3, 8.5],
    [-32.9442, -60.6505, '羅薩里奧 Rosario', 'latin_america', 3, 8.0],
    [-32.8895, -68.8458, '門多薩 Mendoza', 'latin_america', 3, 7.5],
    [-38.0055, -57.5426, '馬德普拉塔 Mar del Plata', 'latin_america', 3, 6.5],
    [-41.1335, -71.3103, '巴里洛切 Bariloche', 'latin_america', 3, 4.8],
    [-54.8019, -68.3030, '烏斯懷亞 Ushuaia', 'latin_america', 3, 4.5],
    [-33.4489, -70.6693, '聖地牙哥 Santiago', 'latin_america', 2, 15],
    [-33.0472, -71.6127, '瓦爾帕萊索 Valparaiso', 'latin_america', 3, 7.0],
    [-36.8201, -73.0444, '康塞普西翁 Concepcion', 'latin_america', 3, 7.0],
    [-23.6509, -70.3975, '安托法加斯塔 Antofagasta', 'latin_america', 3, 5.5],
    [-12.0464, -77.0428, '利馬 Lima', 'latin_america', 1, 18],
    [-16.4090, -71.5375, '阿雷基帕 Arequipa', 'latin_america', 3, 7.5],
    [-13.5319, -71.9675, '庫斯科 Cusco', 'latin_america', 3, 5.5],
    [4.7110, -74.0721, '波哥大 Bogota', 'latin_america', 1, 17],
    [6.2442, -75.5812, '麥德林 Medellin', 'latin_america', 2, 11],
    [3.4516, -76.5320, '卡利 Cali', 'latin_america', 2, 10],
    [10.9685, -74.7813, '巴蘭基亞 Barranquilla', 'latin_america', 2, 9.5],
    [10.3910, -75.4794, '卡塔赫納 Cartagena', 'latin_america', 3, 7.5],
    [-0.1807, -78.4678, '基多 Quito', 'latin_america', 2, 11],
    [-2.1709, -79.9224, '瓜亞基爾 Guayaquil', 'latin_america', 2, 11],
    [10.4806, -66.9036, '卡拉卡斯 Caracas', 'latin_america', 2, 11],
    [10.6427, -71.6125, '馬拉開波 Maracaibo', 'latin_america', 2, 10],
    [-34.9011, -56.1645, '蒙特維多 Montevideo', 'latin_america', 2, 9.5],
    [-25.2637, -57.5759, '亞松森 Asuncion', 'latin_america', 2, 9.5],
    [-16.4897, -68.1193, '拉巴斯 La Paz', 'latin_america', 2, 9.5],
    [-17.7833, -63.1821, '聖克魯斯 Santa Cruz', 'latin_america', 2, 9.5],
    [-19.0196, -65.2619, '蘇克雷 Sucre', 'latin_america', 3, 5.0],

    // ==================== MIDDLE EAST & CENTRAL ASIA (35) ====================
    [25.2048, 55.2708, '杜拜 Dubai', 'middle_east', 2, 15],
    [24.4539, 54.3773, '阿布達比 Abu Dhabi', 'middle_east', 2, 12],
    [25.3463, 55.4209, '沙迦 Sharjah', 'middle_east', 2, 9.5],
    [25.2854, 51.5310, '杜哈 Doha', 'middle_east', 2, 11],
    [24.7136, 46.6753, '利雅德 Riyadh', 'middle_east', 1, 18],
    [21.4858, 39.1925, '吉達 Jeddah', 'middle_east', 2, 14],
    [21.3891, 39.8579, '麥加 Mecca', 'middle_east', 2, 10],
    [24.5247, 39.5692, '麥地那 Medina', 'middle_east', 3, 8.5],
    [26.4207, 50.0888, '達曼 Dammam', 'middle_east', 2, 10],
    [29.3759, 47.9774, '科威特市 Kuwait City', 'middle_east', 2, 11],
    [26.2285, 50.5860, '麥納瑪 Manama', 'middle_east', 3, 7.5],
    [23.5880, 58.3829, '馬斯喀特 Muscat', 'middle_east', 3, 8.5],
    [17.0151, 54.0924, '塞拉萊 Salalah', 'middle_east', 3, 5.5],
    [31.9454, 35.9284, '安曼 Amman', 'middle_east', 2, 12],
    [31.7683, 35.2137, '耶路撒冷 Jerusalem', 'middle_east', 3, 7.5],
    [32.0853, 34.7818, '特拉維夫 Tel Aviv', 'middle_east', 2, 11],
    [32.7940, 34.9896, '海法 Haifa', 'middle_east', 3, 6.5],
    [33.8938, 35.5018, '貝魯特 Beirut', 'middle_east', 2, 10],
    [33.5138, 36.2765, '大馬士革 Damascus', 'middle_east', 2, 10],
    [33.3152, 44.3661, '巴格達 Baghdad', 'middle_east', 1, 17],
    [30.5085, 47.7804, '巴斯拉 Basra', 'middle_east', 3, 8.0],
    [36.1911, 44.0092, '艾比爾 Erbil', 'middle_east', 3, 7.5],
    [35.6892, 51.3890, '德黑蘭 Tehran', 'middle_east', 1, 19],
    [36.2605, 59.6168, '馬什哈德 Mashhad', 'middle_east', 2, 12],
    [32.6546, 51.6680, '伊斯法罕 Isfahan', 'middle_east', 2, 10],
    [29.5918, 52.5837, '設拉子 Shiraz', 'middle_east', 2, 9.5],
    [40.4093, 49.8671, '巴庫 Baku', 'middle_east', 2, 11],
    [41.7151, 44.8271, '提比里斯 Tbilisi', 'middle_east', 3, 8.0],
    [40.1792, 44.4991, '葉里溫 Yerevan', 'middle_east', 3, 7.5],
    [43.2220, 76.8512, '阿拉木圖 Almaty', 'middle_east', 2, 10],
    [51.1694, 71.4491, '阿斯塔納 Astana', 'middle_east', 3, 8.0],
    [41.2995, 69.2401, '塔什干 Tashkent', 'middle_east', 2, 11],
    [39.6542, 66.9597, '撒馬爾罕 Samarkand', 'middle_east', 3, 6.5],
    [42.8746, 74.5698, '比什凱克 Bishkek', 'middle_east', 3, 7.5],
    [38.5598, 68.7870, '杜尚貝 Dushanbe', 'middle_east', 3, 7.0],

    // ==================== AFRICA (39) ====================
    [30.0444, 31.2357, '開羅 Cairo', 'africa', 1, 21],
    [31.2001, 29.9187, '亞歷山大 Alexandria', 'africa', 2, 13],
    [30.0131, 31.2089, '吉薩 Giza', 'africa', 2, 11],
    [25.6872, 32.6396, '路克索 Luxor', 'africa', 3, 5.5],
    [27.9158, 34.3300, '夏姆錫克 Sharm El Sheikh', 'africa', 3, 5.0],
    [33.5731, -7.5898, '卡薩布蘭卡 Casablanca', 'africa', 2, 12],
    [31.6295, -7.9811, '馬拉喀什 Marrakesh', 'africa', 3, 7.5],
    [34.0209, -6.8416, '拉巴特 Rabat', 'africa', 2, 9.5],
    [35.7595, -5.8340, '丹吉爾 Tangier', 'africa', 3, 7.5],
    [36.8065, 10.1815, '突尼斯 Tunis', 'africa', 2, 10],
    [36.7538, 3.0588, '阿爾及爾 Algiers', 'africa', 2, 11],
    [32.8872, 13.1913, '的黎波里 Tripoli', 'africa', 3, 8.0],
    [6.5244, 3.3792, '拉哥斯 Lagos', 'africa', 1, 20],
    [9.0765, 7.3986, '阿布賈 Abuja', 'africa', 2, 11],
    [12.0022, 8.5920, '卡諾 Kano', 'africa', 2, 11],
    [-1.2921, 36.8219, '奈洛比 Nairobi', 'africa', 2, 13],
    [-4.0435, 39.6682, '蒙巴薩 Mombasa', 'africa', 3, 7.5],
    [9.0320, 38.7469, '阿迪斯阿貝巴 Addis Ababa', 'africa', 2, 12],
    [-26.2041, 28.0473, '約翰尼斯堡 Johannesburg', 'africa', 2, 15],
    [-33.9249, 18.4241, '開普敦 Cape Town', 'africa', 2, 13],
    [-29.8587, 31.0218, '德班 Durban', 'africa', 2, 11],
    [-25.7479, 28.2293, '普勒托利亞 Pretoria', 'africa', 2, 11],
    [-33.9608, 25.6022, '伊莉莎白港 Port Elizabeth', 'africa', 3, 7.5],
    [5.6037, -0.1870, '阿克拉 Accra', 'africa', 2, 11],
    [14.7167, -17.4677, '達卡 Dakar', 'africa', 2, 10],
    [5.3600, -4.0083, '阿必尚 Abidjan', 'africa', 2, 12],
    [-4.4419, 15.2663, '金夏沙 Kinshasa', 'africa', 1, 18],
    [-8.8390, 13.2894, '羅安達 Luanda', 'africa', 1, 16],
    [-6.7924, 39.2083, '三蘭港 Dar es Salaam', 'africa', 1, 16],
    [-6.1659, 39.2026, '尚吉巴 Zanzibar', 'africa', 3, 5.5],
    [0.3476, 32.5825, '坎帕拉 Kampala', 'africa', 2, 11],
    [-1.9441, 30.0619, '吉佳利 Kigali', 'africa', 3, 7.5],
    [-15.3875, 28.3228, '路沙卡 Lusaka', 'africa', 2, 10],
    [-17.8252, 31.0335, '哈拉雷 Harare', 'africa', 2, 10],
    [-25.9692, 32.5732, '馬布多 Maputo', 'africa', 3, 8.0],
    [-22.5609, 17.0658, '溫荷克 Windhoek', 'africa', 3, 6.0],
    [-24.6282, 25.9231, '嘉柏隆里 Gaborone', 'africa', 3, 5.5],
    [-18.8792, 47.5079, '安塔那那利佛 Antananarivo', 'africa', 2, 10],
    [-20.1609, 57.5012, '路易港 Port Louis', 'africa', 3, 5.5],

    // ==================== OCEANIA (24) ====================
    [-33.8688, 151.2093, '雪梨 Sydney', 'oceania', 2, 15],
    [-37.8136, 144.9631, '墨爾本 Melbourne', 'oceania', 2, 15],
    [-27.4698, 153.0251, '布里斯本 Brisbane', 'oceania', 2, 12],
    [-31.9505, 115.8605, '伯斯 Perth', 'oceania', 2, 11],
    [-34.9285, 138.6007, '阿得雷德 Adelaide', 'oceania', 3, 8.5],
    [-28.0167, 153.4000, '黃金海岸 Gold Coast', 'oceania', 3, 8.0],
    [-35.2809, 149.1300, '坎培拉 Canberra', 'oceania', 3, 7.0],
    [-32.9283, 151.7817, '紐卡索 Newcastle', 'oceania', 3, 6.5],
    [-42.8821, 147.3272, '荷巴特 Hobart', 'oceania', 3, 5.5],
    [-12.4634, 130.8456, '達爾文 Darwin', 'oceania', 3, 5.5],
    [-16.9186, 145.7781, '凱恩斯 Cairns', 'oceania', 3, 5.5],
    [-19.2590, 146.8169, '湯斯維爾 Townsville', 'oceania', 3, 5.5],
    [-36.8509, 174.7645, '奧克蘭 Auckland', 'oceania', 3, 8.5],
    [-41.2865, 174.7762, '威靈頓 Wellington', 'oceania', 3, 6.5],
    [-43.5321, 172.6362, '基督城 Christchurch', 'oceania', 3, 6.5],
    [-45.0312, 168.6626, '皇后鎮 Queenstown', 'oceania', 3, 4.5],
    [-45.8788, 170.5028, '但尼丁 Dunedin', 'oceania', 3, 5.0],
    [-18.1416, 178.4419, '蘇瓦 Suva', 'oceania', 3, 5.0],
    [-17.7765, 177.4356, '楠迪 Nadi', 'oceania', 3, 4.5],
    [-22.2758, 166.4580, '努美阿 Noumea', 'oceania', 3, 5.0],
    [-17.5516, -149.5585, '帕皮提 Papeete', 'oceania', 3, 4.8],
    [-9.4438, 147.1803, '莫士比港 Port Moresby', 'oceania', 3, 6.0],
    [13.4757, 144.7489, '阿加尼亞(關島) Hagatna (Guam)', 'oceania', 3, 5.0],
    [15.1833, 145.7500, '塞班 Saipan', 'oceania', 3, 4.5]
  ];

  // Fallback equirectangular projection matching region.js when geoPoint is absent
  const FALLBACK_ORIGIN_LAT = 25 + (4 + 10.535 / 60) / 60;
  const FALLBACK_ORIGIN_LON = 121 + (33 + 9.085 / 60) / 60;
  const FALLBACK_EAST_SCALE = 111319.49 * Math.cos(FALLBACK_ORIGIN_LAT * Math.PI / 180);

  function resolveGeoPoint() {
    if (typeof geoPoint === 'function') return geoPoint;
    if (root && typeof root.geoPoint === 'function') return root.geoPoint;
    return null;
  }

  function projectLatLon(lat, lon, fn) {
    if (fn) return fn(lat, lon);
    return {
      x: (lon - FALLBACK_ORIGIN_LON) * FALLBACK_EAST_SCALE,
      z: (FALLBACK_ORIGIN_LAT - lat) * 110772
    };
  }

  // Deterministic hash in [0, 1)
  function hash01(seed) {
    let x = (seed | 0) ^ 0x9e3779b9;
    x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  }

  // Realistic skyline peak height by tier & architectural region
  const REGION_HEIGHT_MULT = {
    east_asia: 1.24,
    north_america: 1.22,
    middle_east: 1.26,
    se_asia: 1.12,
    oceania: 1.05,
    latin_america: 0.96,
    south_asia: 0.94,
    europe: 0.78,
    mediterranean: 0.72,
    africa: 0.84
  };

  function computeMaxHeight(tier, region, id) {
    const base = tier === 1 ? 255 : tier === 2 ? 145 : 78;
    const spread = tier === 1 ? 95 : tier === 2 ? 55 : 34;
    const mult = REGION_HEIGHT_MULT[region] || 1.0;
    return Math.round((base + hash01(id * 37 + 11) * spread) * mult);
  }

  // ==================== O(1) SPATIAL HASH GRID ====================
  const CELL_SIZE = 120000; // 120 km cells
  const INV_CELL = 1 / CELL_SIZE;
  const KEY_OFFSET = 2048;
  const KEY_STRIDE = 4096;

  let _cities = null;
  let _grid = null;
  let _indexedWithGeoPoint = null;

  function cellKey(cx, cz) {
    return (cx + KEY_OFFSET) * KEY_STRIDE + (cz + KEY_OFFSET);
  }

  function ensureIndexed() {
    const gp = resolveGeoPoint();
    if (_cities !== null && _indexedWithGeoPoint === gp) return;
    _indexedWithGeoPoint = gp;

    const len = WORLD_CITIES_DATA.length;
    const list = new Array(len);
    const grid = new Map();

    for (let i = 0; i < len; i++) {
      const row = WORLD_CITIES_DATA[i];
      const lat = row[0];
      const lon = row[1];
      const pt = projectLatLon(lat, lon, gp);
      const region = row[3];
      const tier = row[4];
      const radiusM = Math.round(row[5] * 1000);
      const city = {
        id: i,
        lat: lat,
        lon: lon,
        x: pt.x,
        z: pt.z,
        name: row[2],
        region: region,
        tier: tier,
        radiusM: radiusM,
        maxH: computeMaxHeight(tier, region, i)
      };
      list[i] = city;

      const cx = Math.floor(pt.x * INV_CELL);
      const cz = Math.floor(pt.z * INV_CELL);
      const key = cellKey(cx, cz);
      let bucket = grid.get(key);
      if (!bucket) {
        bucket = [];
        grid.set(key, bucket);
      }
      bucket.push(city);
    }

    _cities = list;
    _grid = grid;
  }

  function getAll() {
    ensureIndexed();
    return _cities;
  }

  function nearestCity(x, z, maxDist) {
    ensureIndexed();
    const limit = maxDist === undefined ? 140000 : maxDist;
    const limitSq = limit * limit;
    const cx = Math.floor(x * INV_CELL);
    const cz = Math.floor(z * INV_CELL);
    const span = limit <= CELL_SIZE ? 1 : Math.min(4, Math.ceil(limit * INV_CELL));

    let bestCity = null;
    let bestDistSq = limitSq;

    for (let dx = -span; dx <= span; dx++) {
      for (let dz = -span; dz <= span; dz++) {
        const bucket = _grid.get(cellKey(cx + dx, cz + dz));
        if (!bucket) continue;
        for (let i = 0, n = bucket.length; i < n; i++) {
          const c = bucket[i];
          const ex = c.x - x;
          const ez = c.z - z;
          const dSq = ex * ex + ez * ez;
          if (dSq <= bestDistSq) {
            bestDistSq = dSq;
            bestCity = c;
          }
        }
      }
    }

    return bestCity ? { city: bestCity, dist: Math.sqrt(bestDistSq) } : null;
  }

  function citiesWithin(x, z, radius) {
    ensureIndexed();
    const limit = radius === undefined ? 140000 : radius;
    const limitSq = limit * limit;
    const cx = Math.floor(x * INV_CELL);
    const cz = Math.floor(z * INV_CELL);
    const span = limit <= CELL_SIZE ? 1 : Math.min(6, Math.ceil(limit * INV_CELL));
    const results = [];

    for (let dx = -span; dx <= span; dx++) {
      for (let dz = -span; dz <= span; dz++) {
        const bucket = _grid.get(cellKey(cx + dx, cz + dz));
        if (!bucket) continue;
        for (let i = 0, n = bucket.length; i < n; i++) {
          const c = bucket[i];
          const ex = c.x - x;
          const ez = c.z - z;
          const dSq = ex * ex + ez * ez;
          if (dSq <= limitSq) {
            results.push({ city: c, dist: Math.sqrt(dSq) });
          }
        }
      }
    }

    if (results.length > 1) {
      results.sort(function (a, b) { return a.dist - b.dist; });
    }
    return results;
  }

  function isNearAnyCity(x, z, maxDist) {
    ensureIndexed();
    const limit = maxDist === undefined ? 110000 : maxDist;
    const limitSq = limit * limit;
    const cx = Math.floor(x * INV_CELL);
    const cz = Math.floor(z * INV_CELL);
    const span = limit <= CELL_SIZE ? 1 : Math.min(4, Math.ceil(limit * INV_CELL));

    for (let dx = -span; dx <= span; dx++) {
      for (let dz = -span; dz <= span; dz++) {
        const bucket = _grid.get(cellKey(cx + dx, cz + dz));
        if (!bucket) continue;
        for (let i = 0, n = bucket.length; i < n; i++) {
          const c = bucket[i];
          const ex = c.x - x;
          const ez = c.z - z;
          if (ex * ex + ez * ez <= limitSq) return true;
        }
      }
    }
    return false;
  }

  // ==================== REGIONAL ARCHITECTURAL PALETTES ====================
  const REGION_PALETTES = {
    east_asia: {
      skyline: [0x9eb8d0, 0xc8d4df, 0xd8dce0, 0x89a4be, 0xb6c5d4, 0xe2dfd7],
      sprawl:  [0xa8b0b8, 0xc9c6be, 0x8e99a4, 0xd4cfc4, 0x9ca4ac, 0xb8b2a8]
    },
    se_asia: {
      skyline: [0xcfdce6, 0xe8dfd1, 0xb8ccd9, 0xd9d4c7, 0xa2b9cc, 0xede6da],
      sprawl:  [0xc7896a, 0xdacbb8, 0xb8c5c2, 0xc9a382, 0xb8b2a6, 0xd8b498]
    },
    south_asia: {
      skyline: [0xd6c7b2, 0xc4b5a0, 0xb8c6d1, 0xdfd3c0, 0xc9a88a, 0xb5b3ac],
      sprawl:  [0xc99c74, 0xd6b998, 0xb88b68, 0xc8b8a2, 0xa88f78, 0xdac7b0]
    },
    europe: {
      skyline: [0xb4bcc4, 0xc8c1b4, 0x9aa9b8, 0xd4cdc0, 0xa8aeb6, 0xc2b8a8],
      sprawl:  [0xb36c52, 0x7a8088, 0xc49c7e, 0x8f8880, 0xa6634b, 0x9ea2a6]
    },
    mediterranean: {
      skyline: [0xe0d5c3, 0xd8c6ae, 0xcbb99e, 0xe8e0d2, 0xbec5cc, 0xd9c2a6],
      sprawl:  [0xc87450, 0xdecdb4, 0xb86544, 0xd9a87e, 0xe3d8c5, 0xc4825c]
    },
    north_america: {
      skyline: [0x90a8c0, 0xb4c4d4, 0x7e94aa, 0xc8ccd0, 0xa6b2be, 0xd0c8bc],
      sprawl:  [0x9a9c9e, 0xa8927e, 0x868c92, 0xb8aa98, 0x7c8288, 0x9e8c7a]
    },
    latin_america: {
      skyline: [0xd2cabd, 0xb0c2d2, 0xd9bca2, 0xc6c8ca, 0xe0d4c2, 0xa4b4c4],
      sprawl:  [0xc47958, 0xd4a47e, 0xb28c74, 0xc8beb2, 0xba6f4e, 0xd8c2a6]
    },
    middle_east: {
      skyline: [0xded2bc, 0x9ec0d8, 0xe8dec8, 0xc4d4df, 0xd4c2a2, 0xb2ccd9],
      sprawl:  [0xd8c29e, 0xc9b08a, 0xe2d0b0, 0xbda480, 0xd2bd9c, 0xc4aa86]
    },
    africa: {
      skyline: [0xd6c5ad, 0xc4b096, 0xb6c2cc, 0xdfd2be, 0xc99f7e, 0xbcb6aa],
      sprawl:  [0xbf7d58, 0xcfa57e, 0x9e9a94, 0xb88662, 0xc9b296, 0xa67456]
    },
    oceania: {
      skyline: [0xaec4d8, 0xd0d6dc, 0x96b0c8, 0xdcd4c6, 0xbfc8d0, 0xc4b8a6],
      sprawl:  [0x9aa2a8, 0xb87658, 0xc6bfb2, 0x848e96, 0xc29e80, 0xa8a49c]
    }
  };

  // ==================== PROCEDURAL TEXTURE HELPERS ====================
  function makeCanvasTexture(THREE, w, h, drawFn, repeatX, repeatY, clampEdge) {
    if (typeof document === 'undefined' || !document.createElement || !THREE || !THREE.CanvasTexture) {
      return null;
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext && canvas.getContext('2d');
    if (ctx && typeof ctx.fillRect === 'function') {
      drawFn(ctx, w, h);
    }
    const tex = new THREE.CanvasTexture(canvas);
    if (clampEdge && THREE.ClampToEdgeWrapping !== undefined) {
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
    } else if (THREE.RepeatWrapping !== undefined) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
    }
    if (tex.repeat && typeof tex.repeat.set === 'function') {
      tex.repeat.set(repeatX || 1, repeatY || 1);
    }
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function createSkylineTextures(THREE) {
    const dayTex = makeCanvasTexture(THREE, 128, 128, function (g, w, h) {
      g.fillStyle = '#dfe5ec';
      g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) {
        g.fillStyle = 'rgba(42, 54, 68, 0.34)';
        g.fillRect(0, y, w, 4);
        for (let x = 0; x < w; x += 16) {
          const s = (x * 17 + y * 31) % 13;
          g.fillStyle = s < 4 ? 'rgba(65, 88, 112, 0.32)' : s < 9 ? 'rgba(130, 158, 184, 0.24)' : 'rgba(245, 250, 255, 0.22)';
          g.fillRect(x + 2, y + 5, 12, 9);
          g.fillStyle = 'rgba(30, 40, 52, 0.26)';
          g.fillRect(x, y, 2, 16);
        }
      }
    }, 1, 2, false);

    const nightTex = makeCanvasTexture(THREE, 128, 128, function (g, w, h) {
      g.fillStyle = '#000000';
      g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) {
        const floorLit = ((y * 7 + 5) % 11) < 7;
        for (let x = 0; x < w; x += 16) {
          const hVal = (x * 23 + y * 41) % 19;
          if ((floorLit && hVal < 11) || hVal < 4) {
            g.fillStyle = hVal % 4 === 0 ? '#ffd894' : hVal % 3 === 0 ? '#ffe7ba' : '#dbeeff';
            g.fillRect(x + 3, y + 6, 10, 7);
          }
        }
      }
    }, 1, 2, false);

    return { dayTex: dayTex, nightTex: nightTex };
  }

  function createSprawlTextures(THREE) {
    const dayTex = makeCanvasTexture(THREE, 128, 128, function (g, w, h) {
      g.fillStyle = '#d6d2ca';
      g.fillRect(0, 0, w, h);
      // Subtle distant urban street grid & block texture
      for (let y = 0; y < h; y += 16) {
        g.fillStyle = 'rgba(72, 74, 78, 0.24)';
        g.fillRect(0, y, w, 2);
        for (let x = 0; x < w; x += 16) {
          const s = (x * 13 + y * 29) % 17;
          g.fillStyle = s < 5 ? 'rgba(255, 255, 255, 0.14)' : s < 11 ? 'rgba(90, 82, 74, 0.16)' : 'rgba(60, 72, 64, 0.12)';
          g.fillRect(x + 2, y + 2, 12, 12);
        }
      }
      for (let x = 0; x < w; x += 16) {
        g.fillStyle = 'rgba(72, 74, 78, 0.24)';
        g.fillRect(x, 0, 2, h);
      }
    }, 2, 2, false);

    const nightTex = makeCanvasTexture(THREE, 128, 128, function (g, w, h) {
      g.fillStyle = '#000000';
      g.fillRect(0, 0, w, h);
      // Warm sodium-vapor arterial road grid and residential scatter
      for (let y = 0; y < h; y += 16) {
        g.fillStyle = 'rgba(255, 194, 102, 0.42)';
        g.fillRect(0, y, w, 2);
        for (let x = 0; x < w; x += 16) {
          const s = (x * 19 + y * 37) % 13;
          if (s < 7) {
            g.fillStyle = s % 3 === 0 ? 'rgba(255, 214, 138, 0.55)' : 'rgba(255, 182, 92, 0.40)';
            g.fillRect(x + 4, y + 4, 4, 4);
            if (s < 4) g.fillRect(x + 9, y + 9, 4, 3);
          }
        }
      }
      for (let x = 0; x < w; x += 16) {
        g.fillStyle = 'rgba(255, 190, 96, 0.36)';
        g.fillRect(x, 0, 2, h);
      }
    }, 2, 2, false);

    return { dayTex: dayTex, nightTex: nightTex };
  }

  function createNightGlowTexture(THREE) {
    return makeCanvasTexture(THREE, 128, 128, function (g, w, h) {
      const cx = w * 0.5;
      const cy = h * 0.5;
      if (typeof g.createRadialGradient === 'function') {
        const grad = g.createRadialGradient(cx, cy, 0, cx, cy, cx);
        grad.addColorStop(0.0, 'rgba(255, 224, 152, 0.95)');
        grad.addColorStop(0.24, 'rgba(255, 184, 88, 0.65)');
        grad.addColorStop(0.56, 'rgba(248, 136, 46, 0.24)');
        grad.addColorStop(0.84, 'rgba(214, 96, 26, 0.06)');
        grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, w, h);
      } else {
        g.fillStyle = 'rgba(255, 192, 96, 0.5)';
        g.fillRect(0, 0, w, h);
      }
    }, 1, 1, true);
  }

  // ==================== LOD2 DISTANT HORIZON CITY RENDERER ====================
  function createDistantCityHorizonLOD(scene, groundFn) {
    const T = (typeof THREE !== 'undefined' ? THREE : (root && root.THREE)) || null;
    if (!T) {
      throw new Error('WorldCitiesCatalog.createDistantCityHorizonLOD requires THREE');
    }

    ensureIndexed();

    const MIN_CITY_DIST = 9500;
    const FADE_IN_END = 11500;
    const MAX_CITY_DIST = 145000;
    const FADE_OUT_START = 136000;
    const REBUILD_MOVE_THRESH = 3500;
    const REBUILD_MOVE_THRESH_SQ = REBUILD_MOVE_THRESH * REBUILD_MOVE_THRESH;

    const MAX_SKYLINE = 512;
    const MAX_SPRAWL = 640;
    const MAX_GLOW = 64;

    const group = new T.Group();
    group.name = 'World distant city horizon LOD2';

    const skylineTex = createSkylineTextures(T);
    const sprawlTex = createSprawlTextures(T);
    const glowTex = createNightGlowTexture(T);

    // Pre-allocated scratch objects — zero per-frame allocations
    const dummy = new T.Object3D();
    const tmpColor = new T.Color(0xffffff);

    // 1. Distant Downtown Skyline Cluster InstancedMesh (Draw Call #1)
    const skylineGeo = new T.BoxGeometry(1, 1, 1);
    const skylineMat = new T.MeshLambertMaterial({
      color: 0xffffff,
      map: skylineTex.dayTex,
      emissive: new T.Color(0xffd28c),
      emissiveMap: skylineTex.nightTex,
      emissiveIntensity: 0.0,
      fog: true
    });
    const distantSkylineMesh = new T.InstancedMesh(skylineGeo, skylineMat, MAX_SKYLINE);
    distantSkylineMesh.name = 'DistantCitySkylineLOD2';
    distantSkylineMesh.setColorAt(0, tmpColor);
    distantSkylineMesh.count = 0;
    distantSkylineMesh.frustumCulled = false;
    group.add(distantSkylineMesh);

    // 2. Distant Regional Urban Sprawl Patches InstancedMesh (Draw Call #2)
    const sprawlGeo = new T.BoxGeometry(1, 1, 1);
    const sprawlMat = new T.MeshLambertMaterial({
      color: 0xffffff,
      map: sprawlTex.dayTex,
      emissive: new T.Color(0xffb45c),
      emissiveMap: sprawlTex.nightTex,
      emissiveIntensity: 0.0,
      fog: true
    });
    const distantSprawlMesh = new T.InstancedMesh(sprawlGeo, sprawlMat, MAX_SPRAWL);
    distantSprawlMesh.name = 'DistantCitySprawlLOD2';
    distantSprawlMesh.setColorAt(0, tmpColor);
    distantSprawlMesh.count = 0;
    distantSprawlMesh.frustumCulled = false;
    group.add(distantSprawlMesh);

    // 3. Distant Metropolitan Night-Glow Discs InstancedMesh (Draw Call #3)
    const glowGeo = new T.PlaneGeometry(2, 2);
    if (typeof glowGeo.rotateX === 'function') {
      glowGeo.rotateX(-Math.PI * 0.5);
    }
    const glowMat = new T.MeshBasicMaterial({
      color: 0xffc66e,
      map: glowTex,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: T.AdditiveBlending !== undefined ? T.AdditiveBlending : 2,
      side: T.DoubleSide !== undefined ? T.DoubleSide : 2,
      fog: false
    });
    const distantNightGlowMesh = new T.InstancedMesh(glowGeo, glowMat, MAX_GLOW);
    distantNightGlowMesh.name = 'DistantCityNightGlowLOD2';
    distantNightGlowMesh.setColorAt(0, tmpColor);
    distantNightGlowMesh.count = 0;
    distantNightGlowMesh.frustumCulled = false;
    distantNightGlowMesh.visible = false;
    group.add(distantNightGlowMesh);

    if (scene && typeof scene.add === 'function') {
      scene.add(group);
    }

    const hasGroundFn = typeof groundFn === 'function';

    let lastRebuildX = NaN;
    let lastRebuildZ = NaN;
    let activeCities = 0;
    let skylineCount = 0;
    let sprawlCount = 0;
    let glowCount = 0;
    let rebuilds = 0;

    function sampleGround(x, z) {
      if (!hasGroundFn) return 0;
      const y = groundFn(x, z);
      return Number.isFinite(y) ? y : 0;
    }

    function rebuildInstances(px, pz) {
      const nearby = citiesWithin(px, pz, MAX_CITY_DIST);
      let sIdx = 0;
      let pIdx = 0;
      let gIdx = 0;
      let cityCount = 0;

      for (let i = 0, n = nearby.length; i < n; i++) {
        const entry = nearby[i];
        const dist = entry.dist;
        if (dist < MIN_CITY_DIST || dist > MAX_CITY_DIST) continue;

        const city = entry.city;
        const palette = REGION_PALETTES[city.region] || REGION_PALETTES.east_asia;
        const skyColors = palette.skyline;
        const sprColors = palette.sprawl;
        const seedBase = city.id * 997 + 131;

        // Smooth cross-fade near 9.5-11.5km and far 136-145km horizon
        const nearCityFade = dist < FADE_IN_END
          ? (dist - MIN_CITY_DIST) / (FADE_IN_END - MIN_CITY_DIST)
          : 1.0;
        const farCityFade = dist > FADE_OUT_START
          ? Math.max(0.05, 1.0 - (dist - FADE_OUT_START) / (MAX_CITY_DIST - FADE_OUT_START))
          : 1.0;
        const cityScale = nearCityFade * farCityFade;
        if (cityScale <= 0.02) continue;

        cityCount++;
        const coreGround = sampleGround(city.x, city.z);

        // --- 1. Downtown Skyline Cluster (10-26 blocks per city) ---
        const skyBlocks = city.tier === 1
          ? 22 + Math.floor(hash01(seedBase + 1) * 5) // 22-26
          : city.tier === 2
            ? 15 + Math.floor(hash01(seedBase + 2) * 5) // 15-19
            : 10 + Math.floor(hash01(seedBase + 3) * 4); // 10-13
        const cbdRadius = city.radiusM * (city.tier === 1 ? 0.30 : city.tier === 2 ? 0.28 : 0.26);

        for (let b = 0; b < skyBlocks && sIdx < MAX_SKYLINE; b++) {
          const bSeed = seedBase + b * 29 + 17;
          const rNorm = Math.pow(hash01(bSeed), 0.72); // denser toward downtown peak
          const angle = hash01(bSeed + 1) * Math.PI * 2;
          const distFromCore = rNorm * cbdRadius;
          const bx = city.x + Math.cos(angle) * distFromCore;
          const bz = city.z + Math.sin(angle) * distFromCore;

          // Prevent overlap with LOD0/LOD1 close-range buildings inside 9.5km
          const dxP = bx - px;
          const dzP = bz - pz;
          const bDistSq = dxP * dxP + dzP * dzP;
          if (bDistSq < MIN_CITY_DIST * MIN_CITY_DIST) continue;

          const bDist = Math.sqrt(bDistSq);
          const localFade = bDist < 11000 ? (bDist - MIN_CITY_DIST) / 1500 : 1.0;
          const fade = Math.min(cityScale, localFade);
          if (fade <= 0.04) continue;

          // Center towers tallest; outer downtown mid-rises step down naturally
          const heightFactor = (1.0 - rNorm * 0.68) * (0.55 + hash01(bSeed + 2) * 0.55);
          const h = Math.max(26, city.maxH * heightFactor * fade);
          const footprintBase = city.tier === 1 ? 260 : city.tier === 2 ? 210 : 155;
          const w = footprintBase * (0.65 + hash01(bSeed + 3) * 1.05);
          const d = footprintBase * (0.65 + hash01(bSeed + 4) * 1.05);
          const by = sampleGround(bx, bz);

          dummy.position.set(bx, by + h * 0.5 - 6, bz);
          dummy.rotation.set(0, hash01(bSeed + 5) * Math.PI, 0);
          dummy.scale.set(w, h + 12, d);
          dummy.updateMatrix();
          distantSkylineMesh.setMatrixAt(sIdx, dummy.matrix);

          const colHex = skyColors[Math.floor(hash01(bSeed + 6) * skyColors.length)];
          tmpColor.setHex(colHex);
          const tint = 0.88 + hash01(bSeed + 7) * 0.24;
          tmpColor.multiplyScalar(tint);
          distantSkylineMesh.setColorAt(sIdx, tmpColor);
          sIdx++;
        }

        // --- 2. Regional Urban Sprawl Patches (14-32 patches covering 0.35-0.95 radiusM) ---
        const sprBlocks = city.tier === 1
          ? 26 + Math.floor(hash01(seedBase + 4) * 7) // 26-32
          : city.tier === 2
            ? 20 + Math.floor(hash01(seedBase + 5) * 6) // 20-25
            : 14 + Math.floor(hash01(seedBase + 6) * 5); // 14-18

        for (let p = 0; p < sprBlocks && pIdx < MAX_SPRAWL; p++) {
          const pSeed = seedBase + p * 43 + 409;
          const rFrac = 0.35 + hash01(pSeed) * 0.60; // 0.35*radiusM to 0.95*radiusM
          // Golden-angle azimuthal spread with organic jitter for even urban fabric
          const angle = (p * 2.3999632297 + hash01(pSeed + 1) * 0.55) % (Math.PI * 2);
          const bx = city.x + Math.cos(angle) * city.radiusM * rFrac;
          const bz = city.z + Math.sin(angle) * city.radiusM * rFrac;

          // Omit sprawl patches inside 9.5km where LOD0/LOD1 takes over
          const dxP = bx - px;
          const dzP = bz - pz;
          const bDistSq = dxP * dxP + dzP * dzP;
          if (bDistSq < MIN_CITY_DIST * MIN_CITY_DIST) continue;

          const bDist = Math.sqrt(bDistSq);
          const localFade = bDist < 11000 ? (bDist - MIN_CITY_DIST) / 1500 : 1.0;
          const fade = Math.min(cityScale, localFade);
          if (fade <= 0.04) continue;

          const patchScale = city.radiusM * (0.14 + hash01(pSeed + 2) * 0.14);
          const pw = patchScale * (0.8 + hash01(pSeed + 3) * 0.65);
          const pd = patchScale * (0.8 + hash01(pSeed + 4) * 0.65);
          const ph = Math.max(8, (14 + (1.0 - rFrac) * 28 + hash01(pSeed + 5) * 14) * fade);
          const by = sampleGround(bx, bz);

          dummy.position.set(bx, by + ph * 0.5 - 4, bz);
          dummy.rotation.set(0, hash01(pSeed + 6) * Math.PI, 0);
          dummy.scale.set(pw, ph + 8, pd);
          dummy.updateMatrix();
          distantSprawlMesh.setMatrixAt(pIdx, dummy.matrix);

          const colHex = sprColors[Math.floor(hash01(pSeed + 7) * sprColors.length)];
          tmpColor.setHex(colHex);
          const tint = 0.86 + hash01(pSeed + 8) * 0.26;
          tmpColor.multiplyScalar(tint);
          distantSprawlMesh.setColorAt(pIdx, tmpColor);
          pIdx++;
        }

        // --- 3. Metropolitan Night-Glow Disc ---
        if (gIdx < MAX_GLOW) {
          const glowRadius = city.radiusM * (city.tier === 1 ? 1.35 : city.tier === 2 ? 1.25 : 1.15) * Math.max(0.35, farCityFade);
          dummy.position.set(city.x, coreGround + 32 + city.maxH * 0.08, city.z);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(glowRadius, 1, glowRadius);
          dummy.updateMatrix();
          distantNightGlowMesh.setMatrixAt(gIdx, dummy.matrix);

          // Slightly warmer amber for older/historic metros, brighter gold-white for megacities
          const glowHex = city.tier === 1 ? 0xffd588 : city.tier === 2 ? 0xffbf66 : 0xf5a852;
          tmpColor.setHex(glowHex);
          distantNightGlowMesh.setColorAt(gIdx, tmpColor);
          gIdx++;
        }
      }

      distantSkylineMesh.count = sIdx;
      distantSkylineMesh.instanceMatrix.needsUpdate = true;
      if (distantSkylineMesh.instanceColor) distantSkylineMesh.instanceColor.needsUpdate = true;

      distantSprawlMesh.count = pIdx;
      distantSprawlMesh.instanceMatrix.needsUpdate = true;
      if (distantSprawlMesh.instanceColor) distantSprawlMesh.instanceColor.needsUpdate = true;

      distantNightGlowMesh.count = gIdx;
      distantNightGlowMesh.instanceMatrix.needsUpdate = true;
      if (distantNightGlowMesh.instanceColor) distantNightGlowMesh.instanceColor.needsUpdate = true;

      activeCities = cityCount;
      skylineCount = sIdx;
      sprawlCount = pIdx;
      glowCount = gIdx;
      rebuilds++;
      lastRebuildX = px;
      lastRebuildZ = pz;
    }

    function update(px, pz, dayRatio) {
      const dr = dayRatio === undefined ? 1.0 : Math.max(0, Math.min(1, dayRatio));

      // Throttled rebuild: only update instance matrices when player moves > 3,500 m
      const dx = px - lastRebuildX;
      const dz = pz - lastRebuildZ;
      if (Number.isNaN(lastRebuildX) || (dx * dx + dz * dz) > REBUILD_MOVE_THRESH_SQ) {
        rebuildInstances(px, pz);
      }

      // Smooth dusk/night lighting cross-fade (0 CPU matrix work)
      const nightFactor = dr < 0.45 ? Math.min(1, (0.45 - dr) / 0.37) : 0;
      const smoothNight = nightFactor * nightFactor * (3 - 2 * nightFactor);

      skylineMat.emissiveIntensity = smoothNight * 1.15;
      sprawlMat.emissiveIntensity = smoothNight * 0.72;

      const glowOpacity = smoothNight * 0.62;
      glowMat.opacity = glowOpacity;
      distantNightGlowMesh.visible = glowOpacity > 0.004 && glowCount > 0;
    }

    function dispose() {
      if (group.parent && typeof group.parent.remove === 'function') {
        group.parent.remove(group);
      }
      if (skylineGeo.dispose) skylineGeo.dispose();
      if (sprawlGeo.dispose) sprawlGeo.dispose();
      if (glowGeo.dispose) glowGeo.dispose();
      if (skylineMat.dispose) skylineMat.dispose();
      if (sprawlMat.dispose) sprawlMat.dispose();
      if (glowMat.dispose) glowMat.dispose();
      if (skylineTex.dayTex && skylineTex.dayTex.dispose) skylineTex.dayTex.dispose();
      if (skylineTex.nightTex && skylineTex.nightTex.dispose) skylineTex.nightTex.dispose();
      if (sprawlTex.dayTex && sprawlTex.dayTex.dispose) sprawlTex.dayTex.dispose();
      if (sprawlTex.nightTex && sprawlTex.nightTex.dispose) sprawlTex.nightTex.dispose();
      if (glowTex && glowTex.dispose) glowTex.dispose();
    }

    return {
      group: group,
      distantSkylineMesh: distantSkylineMesh,
      distantSprawlMesh: distantSprawlMesh,
      distantNightGlowMesh: distantNightGlowMesh,
      update: update,
      dispose: dispose,
      getStats: function () {
        return {
          activeCities: activeCities,
          skylineCount: skylineCount,
          sprawlCount: sprawlCount,
          glowCount: glowCount,
          rebuilds: rebuilds
        };
      }
    };
  }

  const WorldCitiesCatalog = {
    count: WORLD_CITIES_DATA.length,
    DATA: WORLD_CITIES_DATA,
    CELL_SIZE: CELL_SIZE,
    getAll: getAll,
    nearestCity: nearestCity,
    citiesWithin: citiesWithin,
    isNearAnyCity: isNearAnyCity,
    createDistantCityHorizonLOD: createDistantCityHorizonLOD
  };

  if (root) {
    root.WORLD_CITIES_DATA = WORLD_CITIES_DATA;
    root.WorldCitiesCatalog = WorldCitiesCatalog;
  }
  if (typeof window !== 'undefined') {
    window.WORLD_CITIES_DATA = WORLD_CITIES_DATA;
    window.WorldCitiesCatalog = WorldCitiesCatalog;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      WORLD_CITIES_DATA: WORLD_CITIES_DATA,
      WorldCitiesCatalog: WorldCitiesCatalog
    };
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
