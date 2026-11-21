'use strict';
// SKYBOUND GLOBAL — Expanded Story Campaign & Fun Missions Pack (SP.16 – SP.25)
// Zero-dependency, browser & Node.js compatible UMD-style module.
(function (root) {
  const OFFICERS = {
    LIN: '林嵐少校 · 戰術指揮官',
    CHOU: '周振華教官 · 總飛行教官',
    REX: '雷克斯 · 雷虎王牌僚機',
    CHEN: '陳語彤 · 國際塔台主任',
    SU: '蘇博士 · 氣象與特勤科學官',
    BRUCE: '布魯斯艦長 · 福特號艦長'
  };

  const EXTRA_CHAPTERS = [
    {
      id: 16,
      code: 'SP.16',
      title: '金門大橋超低空穿橋秀',
      subtitle: '舊金山灣夕陽特技 · F/A-18C 低空高速通場',
      image: 'assets/campaign/ch4.jpg',
      aircraft: 'fa18c',
      departure: 'KSFO',
      destination: 'KSFO',
      lesson: 'free',
      startType: 'runway',
      weather: '0',
      time: '17:40',
      objectiveDistM: 10500,
      parTimeS: 135,
      rewardMoney: 22000,
      rewardXp: 520,
      maxSafeG: 7.5,
      targetText: '① 舊金山起飛高速爬升 ② 俯衝掠海低空 (300–1,400 ft) 衝刺 5.2 km ③ 拉升迴轉完成 10.5 km 艦隊週公演',
      story: '舊金山艦隊週（Fleet Week）夕陽壓軸登場！十萬名觀眾齊聚漁人碼頭與金門大橋畔，你與王牌僚機雷克斯將駕駛 F/A-18C 大黃蜂從 KSFO 騰空而起，在金色晚霞中完成震撼全場的超低空海灣通場秀！',
      introBeats: [
        { speaker: OFFICERS.LIN, text: '「艦隊週全球轉播已經開機！舊金山灣空域全面淨空，本次通場必須兼顧視覺張力與絕對安全。」' },
        { speaker: OFFICERS.REX, text: '「哈哈！我等這天很久了！待會掠過金門大橋主塔時，看誰的尾流拉得最漂亮——別眨眼，長機！」' },
        { speaker: OFFICERS.LIN, text: '「雷克斯收斂一點！保持編隊間距，海面高度注意防撞。全機就位，准許起飛！」' }
      ],
      radio: [
        { delay: 1.4, speaker: OFFICERS.REX, text: '「二號機就位！後燃器點火，讓我們把舊金山灣的天空點燃吧！」' }
      ],
      stages: [
        {
          label: '階段 1/3 · KSFO 離地加速爬升 (> 500 ft · 160+ kt)',
          check: f => !f.ended && !f.ground && f.y >= 152 && f.speed >= 82,
          radio: { speaker: OFFICERS.LIN, text: '「漂亮離地！轉向海灣方向，壓低高度準備進入金門大橋低空展示走廊！」' }
        },
        {
          label: '階段 2/3 · 低空高速海灣通場 (90–430m · 200+ kt · 5.2 km)',
          check: (f, st) => !f.ended && !f.ground && f.y >= 90 && f.y <= 430 && f.speed >= 102 && st.flownM >= 5200,
          radio: { speaker: OFFICERS.REX, text: '「太帥了！橋上觀眾全在揮手！拉起機頭做個金色夕陽大迴轉收尾！」' }
        },
        {
          label: '階段 3/3 · 拉升至 1,200+ ft 完成 10.5 km 壓軸謝幕',
          check: (f, st) => !f.ended && !f.ground && f.y >= 365 && st.flownM >= 10500,
          radio: { speaker: OFFICERS.LIN, text: '「滿分演出！全場掌聲雷動，Skybound 戰隊再次寫下傳奇！」' }
        }
      ],
      winCondition: (f, st) => !f.ended && !f.ground && st.flownM >= 10500 && f.y >= 365
    },
    {
      id: 17,
      code: 'SP.17',
      title: '東京灣夜影：彩虹大橋與晴空塔',
      subtitle: '羽田暮色緊急巡航 · F-16V 都會夜航攔截演訓',
      image: 'assets/campaign/ch2.jpg',
      aircraft: 'f16v',
      departure: 'RJTT',
      destination: 'RJAA',
      lesson: 'free',
      startType: 'runway',
      weather: 'clouds',
      time: '18:20',
      objectiveDistM: 12000,
      parTimeS: 145,
      rewardMoney: 24000,
      rewardXp: 560,
      maxSafeG: 8.0,
      targetText: '① 羽田暮色離地爬升 ② 高速巡弋東京灣 (> 1,000 ft · 6.0 km) ③ 越過晴空塔高度 (> 2,200 ft) 完成 12 km 轉場',
      story: '傍晚六點二十分，東京灣霓虹初上，彩虹大橋與晴空塔在紫紅暮色中閃耀。一枚未報備的高空無人偵察氣球正漂向首都圈空域，你受命駕駛 F-16V 從羽田緊急升空，沿東京灣走廊實施識別與高空驅離！',
      introBeats: [
        { speaker: OFFICERS.CHEN, text: '「羽田塔台緊急通告：首都圈東側出現不明雷達回波，所有民航進場航班已暫時引導避讓。」' },
        { speaker: OFFICERS.LIN, text: '「這是一次實戰級聯合演訓。駕駛 F-16V 避開東京市區摩天樓與晴空塔，高速爬升至目標高度層完成掃描。」' }
      ],
      radio: [
        { delay: 1.5, speaker: OFFICERS.CHEN, text: '「Viper-Tokyo，羽田跑道淨空，允許優先起飛！離場後右轉沿東京灣北上。」' }
      ],
      stages: [
        {
          label: '階段 1/3 · 羽田離地收輪爬升 (> 600 ft)',
          check: f => !f.ended && !f.ground && f.y >= 183,
          radio: { speaker: OFFICERS.LIN, text: '「已脫離跑道！前方彩虹大橋燈火就在腳下，加速至 220 節以上沿灣區推進。」' }
        },
        {
          label: '階段 2/3 · 東京灣高速巡弋 (> 1,000 ft · 220+ kt · 6.0 km)',
          check: (f, st) => !f.ended && !f.ground && f.y >= 305 && f.speed >= 113 && st.flownM >= 6000,
          radio: { speaker: OFFICERS.CHEN, text: '「雷達鎖定目標在晴空塔東北方！請拉升至 2,200 ft 以上完成高空識別並朝成田方向推進。」' }
        },
        {
          label: '階段 3/3 · 越過晴空塔高度 (> 2,200 ft) 達成 12 km 任務',
          check: (f, st) => !f.ended && !f.ground && f.y >= 670 && st.flownM >= 12000,
          radio: { speaker: OFFICERS.LIN, text: '「目標確認為失控氣象氣球並已安全偏離航道！東京夜空恢復平靜，幹得好！」' }
        }
      ],
      winCondition: (f, st) => !f.ended && !f.ground && st.flownM >= 12000 && f.y >= 670
    },
    {
      id: 18,
      code: 'SP.18',
      title: '維多利亞港：青馬大橋特勤快遞',
      subtitle: '赤鱲角晨曦專機 · A350-900 醫療救援急件',
      image: 'assets/campaign/ch1.jpg',
      aircraft: 'a359',
      departure: 'VHHH',
      destination: 'VMMC',
      lesson: 'free',
      startType: 'runway',
      weather: '0',
      time: '07:30',
      objectiveDistM: 11500,
      parTimeS: 160,
      rewardMoney: 25000,
      rewardXp: 580,
      maxSafeG: 3.2,
      targetText: '① 赤鱲角平穩離地 ② 越過青馬大橋與維港走廊 (> 1,200 ft · 5.5 km) ③ 保持客艙平穩完成 11.5 km 專機航段',
      story: '清晨七點半，香港國際機場接獲緊急生命接力任務：一組罕見移植醫療團隊與冷鏈器官箱必須火速跨海送往澳門。你將駕駛旗艦寬體機 A350-900，在晨光中掠過青馬大橋與珠江口，精準平穩地完成這趟與時間賽跑的使命。',
      introBeats: [
        { speaker: OFFICERS.CHOU, text: '「機上載著正在倒數計時的醫療冷鏈艙，這次不只是快，更要穩！操作桿動作務必柔順，別讓過載飆高。」' },
        { speaker: OFFICERS.CHEN, text: '「香港與澳門塔台已開啟『生命綠色走廊』優先權，沿途無須盤旋等待，起飛後直飛珠江口航道！」' }
      ],
      radio: [
        { delay: 1.5, speaker: OFFICERS.CHEN, text: '「Lifeline-350，赤鱲角南跑道允許起飛，願你們一路順風！」' }
      ],
      stages: [
        {
          label: '階段 1/3 · A350-900 柔順離地爬升 (> 600 ft)',
          check: f => !f.ended && !f.ground && f.y >= 183,
          radio: { speaker: OFFICERS.CHOU, text: '「離地姿態非常漂亮！收起落架，保持柔和爬升率越過青馬大橋空域。」' }
        },
        {
          label: '階段 2/3 · 穩定爬升越過維港走廊 (> 1,200 ft · 5.5 km)',
          check: (f, st) => !f.ended && !f.ground && f.y >= 366 && st.flownM >= 5500,
          radio: { speaker: OFFICERS.CHEN, text: '「澳門進場台已接手雷達導引，醫院救護車已在機坪待命，請繼續平穩巡航！」' }
        },
        {
          label: '階段 3/3 · 維持 1,500+ ft 完成 11.5 km 生命快遞航段',
          check: (f, st) => !f.ended && !f.ground && f.y >= 457 && st.flownM >= 11500,
          radio: { speaker: OFFICERS.CHOU, text: '「醫療團隊回報冷鏈狀態完美！這就是專業民航機長的價值！」' }
        }
      ],
      winCondition: (f, st) => !f.ended && !f.ground && st.flownM >= 11500 && f.y >= 457
    },
    {
      id: 19,
      code: 'SP.19',
      title: '星耀樟宜：熱帶雷暴大迫降',
      subtitle: '赤道強烈颮線 · 787-9 夢想客機穿雲突圍',
      image: 'assets/campaign/ch3.jpg',
      aircraft: 'b789',
      departure: 'WSSS',
      destination: 'WMKK',
      lesson: 'free',
      startType: 'runway',
      weather: 'storm',
      time: '16:10',
      objectiveDistM: 10000,
      parTimeS: 155,
      rewardMoney: 26500,
      rewardXp: 610,
      maxSafeG: 3.4,
      targetText: '① 雷雨中頂風離地 (> 600 ft) ② 穿透赤道雷暴雲層 (> 1,800 ft · 4.8 km) ③ 穩住 787-9 完成 10 km 突圍（或安全迫降）',
      story: '新加坡樟宜機場上空突襲強烈赤道颮線，暴雨傾盆、閃電交織！你駕駛的 787-9 夢想客機必須在風切加劇前果斷升空，聽從蘇博士的氣象雷達指引，切出風暴核心飛往吉隆坡安全空域！',
      introBeats: [
        { speaker: OFFICERS.SU, text: '「氣象雷達顯示強烈對流胞正在麻六甲海峽成形！低空側風與微下衝氣流極強，離地後必須果斷爬升到 1,800 ft 以上！」' },
        { speaker: OFFICERS.CHEN, text: '「樟宜塔台確認跑道積水仍在安全範圍，但窗口只剩三分鐘！Dreamliner-789，現在就是最佳突圍時機！」' }
      ],
      radio: [
        { delay: 1.5, speaker: OFFICERS.SU, text: '「注意空速表！進入雨幕時別猛拉機頭，保持穩定推力穿過去！」' }
      ],
      stages: [
        {
          label: '階段 1/3 · 暴雨側風中穩健離地 (> 600 ft)',
          check: f => !f.ended && !f.ground && f.y >= 183,
          radio: { speaker: OFFICERS.CHEN, text: '「已離地！前方 3 公里有強雷暴核心，請持續爬升脫離低空風切帶！」' }
        },
        {
          label: '階段 2/3 · 突破赤道雷暴層 (> 1,800 ft · 4.8 km)',
          check: (f, st) => !f.ended && !f.ground && f.y >= 548 && st.flownM >= 4800,
          radio: { speaker: OFFICERS.SU, text: '「太好了！氣壓梯度開始趨緩，你成功衝出最危險的對流區了！繼續穩定北上！」' }
        },
        {
          label: '階段 3/3 · 完成 10 km 風暴突圍或安全落地',
          check: (f, st) => !f.ended && ((f.finished && f.landed) || (!f.ground && st.flownM >= 10000 && f.y >= 548)),
          radio: { speaker: OFFICERS.CHEN, text: '「吉隆坡區管已接手！在這種惡劣天象下仍能穩如泰山，令人敬佩！」' }
        }
      ],
      winCondition: (f, st) => !f.ended && ((f.finished && f.landed) || (!f.ground && st.flownM >= 10000 && f.y >= 548))
    },
    {
      id: 20,
      code: 'SP.20',
      title: '哈里發塔：杜拜黃金沙暴突圍',
      subtitle: '波斯灣暮色隱形巡航 · F-22A 猛禽超音速衝刺',
      image: 'assets/campaign/ch6.jpg',
      aircraft: 'f22a',
      departure: 'OMDB',
      destination: 'OTHH',
      lesson: 'free',
      startType: 'runway',
      weather: 'clouds',
      time: '17:15',
      objectiveDistM: 14000,
      parTimeS: 130,
      rewardMoney: 28000,
      rewardXp: 650,
      maxSafeG: 8.5,
      targetText: '① 杜拜高速離地爬升 ② 越過哈里發塔天際線 (> 3,000 ft · 280+ kt · 6.5 km) ③ 高速巡弋波斯灣達 14 km',
      story: '金色沙塵正從阿拉伯沙漠席捲杜拜天際線，世界第一高樓哈里發塔矗立在橘紅霞光中。你與雷克斯駕駛 F-22A 猛禽戰機從杜拜國際機場緊急升空，必須在能見度歸零前拉升越過高樓雲海，高速跨越波斯灣前往杜哈！',
      introBeats: [
        { speaker: OFFICERS.LIN, text: '「沙漠鋒面推進速度超出預期！哈里發塔高度超過 2,700 ft，起飛後務必開啟高推力迅速爬升至 3,000 ft 以上！」' },
        { speaker: OFFICERS.REX, text: '「F-22A 的推重比就是為了這種時刻而生的！沙塵暴追不上我們，全後燃器衝破雲層吧！」' }
      ],
      radio: [
        { delay: 1.2, speaker: OFFICERS.REX, text: '「Raptor 編隊起飛！跟著我的尾焰，直接拉高越過哈里發塔塔尖！」' }
      ],
      stages: [
        {
          label: '階段 1/3 · OMDB 猛禽全推力升空 (> 1,000 ft)',
          check: f => !f.ended && !f.ground && f.y >= 305,
          radio: { speaker: OFFICERS.LIN, text: '「爬升率驚人！繼續加速至 280 節以上，拉升突破 3,000 ft 淨空哈里發塔！」' }
        },
        {
          label: '階段 2/3 · 越過哈里發塔高速衝刺 (> 3,000 ft · 280+ kt · 6.5 km)',
          check: (f, st) => !f.ended && !f.ground && f.y >= 914 && f.speed >= 144 && st.flownM >= 6500,
          radio: { speaker: OFFICERS.REX, text: '「沙暴全被甩在腳下了！波斯灣夕陽美得不像話，全速衝向 14 公里檢查點！」' }
        },
        {
          label: '階段 3/3 · 維持高空高速巡航完成 14 km 突圍',
          check: (f, st) => !f.ended && !f.ground && f.y >= 914 && st.flownM >= 14000,
          radio: { speaker: OFFICERS.LIN, text: '「已安全進入波斯灣高空航路！猛禽編隊完美完成沙暴突圍！」' }
        }
      ],
      winCondition: (f, st) => !f.ended && !f.ground && st.flownM >= 14000 && f.y >= 914
    },
    {
      id: 21,
      code: 'SP.21',
      title: '泰晤士河巡禮：倫敦眼與溫布利之夜',
      subtitle: '希斯洛夜航啟程 · A320neo 歐陸跨海峽專班',
      image: 'assets/campaign/ch2.jpg',
      aircraft: 'a320neo',
      departure: 'EGLL',
      destination: 'LFPG',
      lesson: 'free',
      startType: 'runway',
      weather: 'clouds',
      time: '19:30',
      objectiveDistM: 12500,
      parTimeS: 170,
      rewardMoney: 26000,
      rewardXp: 620,
      maxSafeG: 3.3,
      targetText: '① 希斯洛夜航離地 ② 沿泰晤士河夜景爬升 (> 1,400 ft · 6.0 km) ③ 穩定巡航英吉利海峽方向達 12.5 km',
      story: '華燈初上的倫敦夜色迷人，溫布利球場與泰晤士河畔的倫敦眼燈火輝煌。你執飛 A320neo 夜間跨海峽旗艦航班，從全球最繁忙的希斯洛機場起飛，在密集的歐洲空域中精準遵守高度指令，優雅飛向巴黎戴高樂！',
      introBeats: [
        { speaker: OFFICERS.CHEN, text: '「希斯洛晚間尖峰時段流量極大！我們為你爭取到黃金離場槽位，起飛後請嚴格按照高度層指令爬升。」' },
        { speaker: OFFICERS.CHOU, text: '「夜航最考驗儀表判讀與姿態穩定。別只盯著窗外的倫敦夜景，把速度與仰角控制得像教科書一樣漂亮！」' }
      ],
      radio: [
        { delay: 1.5, speaker: OFFICERS.CHEN, text: '「EuroStar-320，希斯洛 27R 跑道允許起飛，離場後保持穩定爬升！」' }
      ],
      stages: [
        {
          label: '階段 1/3 · 希斯洛夜航離地爬升 (> 600 ft)',
          check: f => !f.ended && !f.ground && f.y >= 183,
          radio: { speaker: OFFICERS.CHOU, text: '「夜航離地乾淨俐落！左側能看到倫敦眼與泰晤士河倒影，持續爬升至 1,400 ft。」' }
        },
        {
          label: '階段 2/3 · 倫敦都會夜空巡航 (> 1,400 ft · 6.0 km)',
          check: (f, st) => !f.ended && !f.ground && f.y >= 426 && st.flownM >= 6000,
          radio: { speaker: OFFICERS.CHEN, text: '「倫敦離場台雷達識別完成！准許爬升至 2,000 ft 以上，直飛英吉利海峽航點。」' }
        },
        {
          label: '階段 3/3 · 穩定 2,000+ ft 完成 12.5 km 跨海航段',
          check: (f, st) => !f.ended && !f.ground && f.y >= 610 && st.flownM >= 12500,
          radio: { speaker: OFFICERS.CHOU, text: '「儀表掌控無懈可擊，客艙服務已順利展開。巴黎戴高樂見！」' }
        }
      ],
      winCondition: (f, st) => !f.ended && !f.ground && st.flownM >= 12500 && f.y >= 610
    },
    {
      id: 22,
      code: 'SP.22',
      title: '巴黎鐵塔：塞納河日落護航',
      subtitle: '戴高樂黃金時刻 · 飆風 Rafale C 國慶閱兵演練',
      image: 'assets/campaign/ch7.jpg',
      aircraft: 'rafalec',
      departure: 'LFPG',
      destination: 'EDDF',
      lesson: 'free',
      startType: 'runway',
      weather: '0',
      time: '17:45',
      objectiveDistM: 13000,
      parTimeS: 140,
      rewardMoney: 29000,
      rewardXp: 680,
      maxSafeG: 8.2,
      targetText: '① 戴高樂高速升空 ② 黃金日落高速通場 (> 1,000 ft · 240+ kt · 6.2 km) ③ 拉升巡航完成 13 km 歐陸護航',
      story: '黃金時刻的陽光灑滿塞納河與艾菲爾鐵塔，歐洲航空展邀請 Skybound 王牌編隊與法國飆風戰機（Rafale C）進行聯合日落護航公演！你將駕駛靈巧的三角翼飆風戰機，以精準的節奏劃過花都天際線。',
      introBeats: [
        { speaker: OFFICERS.REX, text: '「飆風戰機的三角翼手感簡直像藝術品！待會我們在巴黎黃金夕陽下高速通場，一定要讓法蘭克福那邊也聽見我們的引擎聲！」' },
        { speaker: OFFICERS.LIN, text: '「這是高規格外交航空展演，速度與高度曲線必須精準到位。檢查飛控系統，準備點火升空！」' }
      ],
      radio: [
        { delay: 1.4, speaker: OFFICERS.LIN, text: '「Rafale-01，巴黎空域已為你們敞開，展現最優雅的三角翼爬升吧！」' }
      ],
      stages: [
        {
          label: '階段 1/3 · LFPG 三角翼疾速離地 (> 600 ft)',
          check: f => !f.ended && !f.ground && f.y >= 183,
          radio: { speaker: OFFICERS.REX, text: '「推進力太猛了！拉到 240 節以上，讓夕陽照在機翼上！」' }
        },
        {
          label: '階段 2/3 · 塞納河日落高速巡弋 (> 1,000 ft · 240+ kt · 6.2 km)',
          check: (f, st) => !f.ended && !f.ground && f.y >= 305 && f.speed >= 123 && st.flownM >= 6200,
          radio: { speaker: OFFICERS.LIN, text: '「航展攝影機捕捉到了完美畫面！現在爬升至 2,200 ft 以上，轉向法蘭克福航道完成護航。」' }
        },
        {
          label: '階段 3/3 · 高空巡航 (> 2,200 ft) 達成 13 km 護航任務',
          check: (f, st) => !f.ended && !f.ground && f.y >= 670 && st.flownM >= 13000,
          radio: { speaker: OFFICERS.REX, text: '「Voilà！這絕對是今年歐洲最帥的一場日落飛行！」' }
        }
      ],
      winCondition: (f, st) => !f.ended && !f.ground && st.flownM >= 13000 && f.y >= 670
    },
    {
      id: 23,
      code: 'SP.23',
      title: '紐約天際線：哈德遜河奇蹟演練',
      subtitle: '甘迺迪特勤複訓 · A320neo 都會河谷低空安全驗證',
      image: 'assets/campaign/ch5.jpg',
      aircraft: 'a320neo',
      departure: 'KJFK',
      destination: 'KJFK',
      lesson: 'free',
      startType: 'runway',
      weather: 'clouds',
      time: '15:20',
      objectiveDistM: 11000,
      parTimeS: 165,
      rewardMoney: 27500,
      rewardXp: 640,
      maxSafeG: 3.2,
      targetText: '① KJFK 離地爬升 ② 模擬鳥擊警戒巡航 (> 1,500 ft · 5.5 km) ③ 穩健轉向完成 11 km 哈德遜安全演練',
      story: '為了向航空史上最著名的「哈德遜河奇蹟」致敬，國際民航安全局在紐約舉行實機模擬複訓。你將駕駛 A320neo 從甘迺迪機場起飛，在周教官與蘇博士的監測下，於紐約多雲天際線間驗證高難度能源管理與安全返航路線！',
      introBeats: [
        { speaker: OFFICERS.CHOU, text: '「今天的科目是紐約都會區緊急處置複訓。記住：真正的王牌不是飛得多瘋狂，而是危機來臨時比誰都冷靜。」' },
        { speaker: OFFICERS.SU, text: '「我已把曼哈頓周邊的候鳥遷徙熱區與風向模型同步到你的儀表，離地後請保持充裕高度餘裕！」' },
        { speaker: OFFICERS.CHEN, text: '「紐約進場台全程待命！JFK 跑道淨空，隨時可以開始演練。」' }
      ],
      radio: [
        { delay: 1.5, speaker: OFFICERS.CHEN, text: '「Cactus-Demo，KJFK 允許起飛！離地後爬升並保持空速穩定。」' }
      ],
      stages: [
        {
          label: '階段 1/3 · KJFK 穩健起飛爬升 (> 700 ft)',
          check: f => !f.ended && !f.ground && f.y >= 213,
          radio: { speaker: OFFICERS.SU, text: '「模擬警報觸發：前方 1,200 ft 偵測候鳥群！請迅速爬升至 1,500 ft 以上安全層！」' }
        },
        {
          label: '階段 2/3 · 避開候鳥高度層穩定巡航 (> 1,500 ft · 5.5 km)',
          check: (f, st) => !f.ended && !f.ground && f.y >= 457 && st.flownM >= 5500,
          radio: { speaker: OFFICERS.CHOU, text: '「反應迅速且毫不慌亂！保持目前高度與姿態，完成最後一段返場驗證航程。」' }
        },
        {
          label: '階段 3/3 · 維持 1,500+ ft 完成 11 km 安全複訓（或安全返降）',
          check: (f, st) => !f.ended && ((f.finished && f.landed) || (!f.ground && st.flownM >= 11000 && f.y >= 457)),
          radio: { speaker: OFFICERS.CHEN, text: '「演練評分 S 級！紐約所有航管員為你的冷靜操作鼓掌！」' }
        }
      ],
      winCondition: (f, st) => !f.ended && ((f.finished && f.landed) || (!f.ground && st.flownM >= 11000 && f.y >= 457))
    },
    {
      id: 24,
      code: 'SP.24',
      title: '台灣海峽風電搜救：黑鷹緊急出動',
      subtitle: '清泉崗跨海搜救 · UH-60 黑鷹低空海象救援',
      image: 'assets/campaign/ch3.jpg',
      aircraft: 'uh60',
      departure: 'RCMQ',
      destination: 'RCBS',
      lesson: 'free',
      startType: 'runway',
      weather: 'clouds',
      time: '08:15',
      objectiveDistM: 7500,
      parTimeS: 185,
      rewardMoney: 30000,
      rewardXp: 700,
      maxSafeG: 3.5,
      targetText: '① 清泉崗黑鷹升空 (> 300 ft) ② 掠海穿越海峽搜救走廊 (300–1,600 ft · 3.6 km) ③ 護送傷患飛往金門達 7.5 km',
      story: '台灣海峽離岸風電場清晨傳出作業船機組員受傷求救！海面陣風強勁、雲底低垂，你駕駛 UH-60 黑鷹搜救直升機從台中清泉崗緊急升空，在蘇博士與福特號布魯斯艦長的海上雷達中繼協助下，低空掠海馳援金門方向！',
      introBeats: [
        { speaker: OFFICERS.SU, text: '「離岸風機群周邊海風紊流較大，黑鷹出動後請維持 300 到 1,600 ft 的目視搜救高度，方便鎖定求救信標！」' },
        { speaker: OFFICERS.BRUCE, text: '「這裡是福特號指揮橋，我艦長程雷達已為你標定海峽安全走廊。黑鷹英雄，把人平安帶回來！」' }
      ],
      radio: [
        { delay: 1.5, speaker: OFFICERS.SU, text: '「Rescue-60，信標訊號已鎖定！旋翼全速起飛，向海峽西岸挺進！」' }
      ],
      stages: [
        {
          label: '階段 1/3 · 清泉崗黑鷹離地爬升 (> 300 ft)',
          check: f => !f.ended && !f.ground && f.y >= 91,
          radio: { speaker: OFFICERS.BRUCE, text: '「海上雷達已捕捉到你的訊號！保持 300 至 1,600 ft 搜救高度層，朝風電區前進。」' }
        },
        {
          label: '階段 2/3 · 海峽低空搜救走廊巡航 (91–490m · 3.6 km)',
          check: (f, st) => !f.ended && !f.ground && f.y >= 91 && f.y <= 490 && st.flownM >= 3600,
          radio: { speaker: OFFICERS.SU, text: '「目視確認作業船與吊掛點！模擬吊掛完成，現在拉穩高度護送傷患前往金門尚義！」' }
        },
        {
          label: '階段 3/3 · 穩定 400+ ft 完成 7.5 km 跨海救援航段',
          check: (f, st) => !f.ended && !f.ground && f.y >= 122 && st.flownM >= 7500,
          radio: { speaker: OFFICERS.BRUCE, text: '「任務圓滿成功！台灣海峽因你們的守護而更加安全，向搜救英雄致敬！」' }
        }
      ],
      winCondition: (f, st) => !f.ended && !f.ground && st.flownM >= 7500 && f.y >= 122
    },
    {
      id: 25,
      code: 'SP.25',
      title: '雪梨歌劇院：南半球超音速壓軸公演',
      subtitle: '雪梨港夕陽傳奇 · F-14B 雄貓可變翼榮耀謝幕',
      image: 'assets/campaign/ch7.jpg',
      aircraft: 'f14b',
      departure: 'YSSY',
      destination: 'YMML',
      lesson: 'free',
      startType: 'runway',
      weather: '0',
      time: '17:50',
      objectiveDistM: 15000,
      parTimeS: 145,
      rewardMoney: 38000,
      rewardXp: 900,
      maxSafeG: 8.5,
      targetText: '① 雪梨後燃器騰空 ② 港灣極速通場 (> 800 ft · 280+ kt · 7.0 km) ③ 躍升 2,500+ ft 完成 15 km 全球巡演大結局',
      story: '環球特勤巡演最終章來到南半球明珠——雪梨港！金色夕陽映照在雪梨歌劇院白帆與港灣大橋之上，你將駕駛傳奇經典 F-14B 超級雄貓戰機，與雷克斯、布魯斯艦長及林嵐少校共同呈現這場載入史冊的壓軸飛行大秀！',
      introBeats: [
        { speaker: OFFICERS.BRUCE, text: '「從太平洋航艦到全球各大都會，你已經證明了自己是無可取代的頂尖飛官。這場壓軸秀，雄貓戰機交給你領飛！」' },
        { speaker: OFFICERS.REX, text: '「F-14B 後掠翼展開的瞬間就是永遠的經典！待會掠過雪梨港時，把速度拉滿，給全世界的觀眾一場最震撼的音爆秀！」' },
        { speaker: OFFICERS.LIN, text: '「全體官兵致敬！SKYBOUND GLOBAL 壓軸公演正式啟動——長機，點燃後燃器，飛向傳奇吧！」' }
      ],
      radio: [
        { delay: 1.3, speaker: OFFICERS.REX, text: '「Tomcat 編隊全後燃器！雪梨港，我們來了！」' }
      ],
      stages: [
        {
          label: '階段 1/3 · 雪梨起飛高速爬升 (> 600 ft · 180+ kt)',
          check: f => !f.ended && !f.ground && f.y >= 183 && f.speed >= 92,
          radio: { speaker: OFFICERS.BRUCE, text: '「漂亮離地！轉向雪梨港灣，把速度推上 280 節以上，展現雄貓戰機的真正實力！」' }
        },
        {
          label: '階段 2/3 · 雪梨港灣極速通場 (> 800 ft · 280+ kt · 7.0 km)',
          check: (f, st) => !f.ended && !f.ground && f.y >= 244 && f.speed >= 144 && st.flownM >= 7000,
          radio: { speaker: OFFICERS.REX, text: '「歌劇院就在右下方！全場歡呼聲快蓋過無線電了！拉高到 2,500 ft 做個傳奇大爬升！」' }
        },
        {
          label: '階段 3/3 · 躍升 2,500+ ft 完成 15 km 蒼穹傳奇大結局',
          check: (f, st) => !f.ended && !f.ground && f.y >= 762 && st.flownM >= 15000,
          radio: { speaker: OFFICERS.LIN, text: '「恭喜通關全部特別戰役！無論天空多麼遼闊，你永遠是 SKYBOUND GLOBAL 最耀眼的蒼穹傳奇！」' }
        }
      ],
      winCondition: (f, st) => !f.ended && !f.ground && st.flownM >= 15000 && f.y >= 762
    }
  ];

  if (typeof window !== 'undefined') {
    window.SKYBOUND_EXTRA_CHAPTERS = EXTRA_CHAPTERS;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.SKYBOUND_EXTRA_CHAPTERS = EXTRA_CHAPTERS;
  }
  if (root && typeof root === 'object') {
    root.SKYBOUND_EXTRA_CHAPTERS = EXTRA_CHAPTERS;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = EXTRA_CHAPTERS;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
