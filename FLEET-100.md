# SKYBOUND 0.71 機隊擴充

本次將原本實際登錄的 21 架增為 100 架。79 架新增機型使用原創程序模型與各自的尺寸及飛行設定，並非下載的高精度原廠模型。**100 是登錄且可載入的機型數，不代表 100 架均通過高擬真、獨立座艙或完整專屬機構驗收。** 每架狀態見 FLEET-100.csv。

## 使用方式

首頁 → 自由飛行 → 機型分類；或首頁 → 自由飛行 → 3D 機庫。共有教練／通用 14、渦槳／通勤 10、商務噴射 10、民航客機 25、貨運／運輸 13、戰鬥／訓練 20、直升機 8 架。機庫可預覽尚未解鎖的機型，禁止直接開始飛行。

特殊解鎖：G700 完成 EP.01，Rafale C 完成 EP.02，A400M 完成 EP.03，F-14B 完成 EP.04，F-22A 完成 EP.06，A350-1000 完成 WP.08。至少一星即解鎖。機庫的「前往任務」直接啟動對應既有任務，任務不設前章門檻。既有 campaignProgress.v1 星數直接承認，不重置錢、任務或飛行紀錄。結算顯示本次新解鎖機型。

## 已修正

- F-16 主翼／水平尾翼比例、座艙罩位置與懸空貼片。
- 戰機雙垂尾／單雙噴口、鴨翼、翼弦及尾翼差異；F-22 矩形噴口及較扁的機身，仍是近似模型。
- 商務機後置雙發、Falcon 三發、HondaJet 翼上引擎；貨機三發與四渦槳的可見配置。
- 四發機不再全部產生雙層舷窗，A380 才使用全長雙層窗列。747 保留獨立上層結構。
- 四螺旋槳不再重疊到同一位置；非機鼻裝貨機不再自動套用機鼻貨門。尾部裝載機使用近似坡道。
- 移除部分超出翼面或尾翼的懸空貼膜。大機專用裝飾不再套到小型商務機。
- 螺旋槳偏航按機重正規化，修正 A400M 級總功率引起的異常扭轉。
- 同時保留至多 4 架完整模型；目前飛行機型不被機庫換機淘汰。釋放已淘汰幾何、材質及機型貼膜。

## 驗證及重現

- node verify-fleet100.cjs：100 個唯一 ID、設定有效性、分類、六個鎖定、既有星數解鎖與損壞存檔處理。
- node verify-fleet100-physics.cjs：92 架固定翼的操控、雙向翻滾、方向連續性；這是既有遊戲操控模型測試，不是現實性能校準。
- node verify-fleet100-helicopters.cjs：8 架直升機離地、爬升、空中起始；舊型另驗證懸停、降落、燃油與固定步長。
- python serve-fleet100.py 後執行 python capture-fleet100.py：實際瀏覽器從首頁進機庫，逐架建立與擷取 100 張畫面、檢查有限幾何及快取上限；手機橫向模式進入解鎖任務。
- python verify-fleet100-browser.py --ui：鎖定、舊存檔星數恢復、選機、進入飛行。
- work-qa-fleet100 內保存逐架畫面與 JSON。瀏覽器使用 Windows Edge；手機檢查是 844×390 模擬，尚未實體 iPhone 驗證。

## 資料、授權與仍待補齊

新增模型是本專案程序生成，原創塗裝。尺寸是子型的圓整建模包絡；大量性能、慣性、升阻及引擎參數是遊戲近似值，不是依每架原廠手冊完成的認證資料。

參考入口（僅供比例與後續逐型校對，不授予照片或原廠模型重製權）：
- https://www.boeing.com/commercial/airports/plan-manuals
- https://www.aircraft.airbus.com/en/aircraft/a350/a350-900
- https://www.lockheedmartin.com/content/dam/lockheed-martin/aero/documents/F-16/25-00470_F-16%20Block70_72_Product%20Card_Jan%202025.pdf
- https://www.af.mil/About-Us/Fact-Sheets/Display/Article/104505/f-16-fighting-falcon/

仍待補齊：其餘未精修機型的逐架手冊校準、專用航電與座艙、新增機型專屬聲音、直升機精確外型、逐架完整起降任務、近距離面板與鉚釘精修。新增多數未精修機型仍共用相應類別的座艙與系統，不應當作已完成 100 架高細節飛機交付。

## 本輪實測結果

45 項不同回歸檢查全部通過。Windows Edge 逐架渲染 100 架與模型快取上限通過；844×390 手機模式的鎖定機型、固定操作列與前往任務按鈕通過。並未實測所有機型完整起降、實體 iPhone 或真實性能。

## 品質基準進展（依序實作，未替其餘未精修機型貼標）

### 1. Boeing 777-300ER（`b773`）— 已完成品質基準驗收
- **外觀與機構**（`dist/b773-highdef.js`、`dist/aircraft-skins.js`）：實機 73.86 m 機長／64.80 m 翼展圓截面廓型（6.20 m 直徑）、刀片型尾錐與偏置鈦合金 APU 排氣錐、6 片式前風擋與雨刷、貼合機翼上反角的鋁合金擾流板、翼根整流與 4 對襟翼滑軌整流罩、雙發 3.76 m GE90-115B 短艙與平移式反推罩、雙前輪轉向與 2 組 3 軸 6 輪獨立外收式主起落架（14 輪精準接地 `-4.50 m`），風扇慣性減速停轉。
- **座艙與客艙**：專屬 Boeing 777-300ER 6 螢幕航電面板（雙 PFD、雙 ND、GE90 上下 EICAS／系統頁）、MCP 窗、FMC CDU、雙操縱桿、連動油門／襟翼／擾流板／起落架撥桿、可點擊開關感應區與夜間可調背光／遮光板暖色泛光；3-4-3 雙走道 360 座客艙（含椅背 IFE、行李艙、夜間安全帶燈與連動開啟之 L1 艙門）。
- **實測結果**：`verify-no-clipping.cjs`（100/100 機隊+空中加油機通過）與 `verify-b773-benchmark.cjs`（RCTP→RCKH 航線、196 KTAS 巡航、360 人登離機結算淨利 62562）通過；瀏覽器實測 `127.0.0.1:4173`（1280×800 及 844×390）完成機庫日間／夜間／客艙、RCTP 空橋對接 L1 開門登機（75→173→285→360/360）及冷艙黑屏／鍵盤控制驗證，控制台 0 筆 uncaught pageerror／TypeError；實體 iPhone 裝置與高畫質長時間記憶體曲線仍待實機測試。

### 2. Boeing 747-8F（`sf748`）— 已完成品質基準驗收
- **外觀與機構**（`dist/b748f-highdef.js`、`dist/aircraft-skins.js`、`dist/flight.js`）：實機 76.49 m 機長 × 68.88 m 翼展 × 19.38 m 機高之短上層貨機廓型、流線貼合 6 片式上層風擋、L1/R1 艙門、貼體 APU 尾錐、斜削翼尖、4 具 GEnx-2B67 短艙（帶鋸齒排氣與平移反推罩）、18 輪起落架（雙前輪轉向 + 16 輪主/機腹轉向架精準接地與依地速滾轉）、可上掀機鼻貨門（`maxZ = -31.79 m`，開啟不穿模風擋與裝載平台）、側貨門與貨艙 PDU 滾輪／ULD 貨盤裝載動畫及實時 CG 偏移。
- **專屬座艙**：專屬上層雙人 6 螢幕 747-8F 航電面板（雙 PFD、雙 ND、GEnx 上 EICAS、機門／貨重／CG 下 EICAS 系統頁）、MCP 遮光板、FMC CDU、4 發推力桿、減速板／襟翼桿、電氣開關面板、冷艙斷電防護、預設最高畫質（`ultra` + `#rtLighting` 開啟）與可調背光／暖色泛光燈（實測 40%）。
- **實測結果**：`run-all-tests.cjs` 全部 48 項通過（含 `verify-no-clipping.cjs` 100/100 機隊+加油機、`verify-sf748-benchmark.cjs` 84 t 載重 RCKH→RCTP 以 `85.3 m/s` 離地爬升至 `1348 m`、`verify-heavy-cargo.cjs` 與 `verify-voyage.cjs`）；瀏覽器實測 `127.0.0.1:4173`（1280×800 及 844×390）完成機庫 3D 檢視、機鼻開啟／貨艙滾輪 ULD、日間／夜間 `BACKLIGHT 40%` 上層座艙、機坪貨運裝載實況（`88,000 kg · CG 0.15 m`）與即時座艙，控制台 0 筆錯誤；實體 iPhone 裝置測試仍待進行。

### 3. F-16C Block 50 / F-16V Block 70（`sf16` / `f16v`）— 已完成品質基準驗收
- **子型獨立外觀與機構**（`dist/f16-highdef.js`、`dist/aircraft-skins.js`、`dist/flight.js`）：依子型區分 `sf16` Block 50（潔淨無 CFT 機體與低背脊）與 `f16v` Block 70（左右肩部保形油箱 CFT、增高航電背脊含 UHF 天線/GPS 圓頂、機鼻 4 片式 APX-113 IFF 刀鋒天線、右進氣道側邊 AN/AAQ-33 Sniper ATP 標定莢艙及垂尾基部延伸減速傘/ECM 莢艙）；共通具備前緣延伸邊條融合（LERX）、MCID 腹下大進氣道與內部轉動壓縮風扇、前緣機動襟翼（LEF）／襟副翼、差動全動平尾、沿垂尾鉸鏈軸掃掠方向舵與雙斜腹鰭、上下開合減速瓣、15 片 F110 可變收斂擴散噴口與馬赫環後燃器火焰、對稱翼尖 AIM-120C 與翼下 AIM-9X 掛載，以及三點式前向／內收起落架。
- **專屬座艙**：全氣泡透明艙罩前方無遮擋框架；平行校準 HUD、ICP／DED、ALR-56M RWR 顯示與夜間 `BACKLIGHT 40%` 翠綠背光；`sf16` 配備 Block 50 雙綠單色 MFD 與中央類比備用姿態儀（`f16cCenterCluster`），`f16v` 配備雙全彩戰術 MFD 與中央大型 `Viper CPD` 彩色多功能顯示器，並連動線性油門桿、側操縱桿（HOTAS）與起落架撥桿。
- **實測結果**：`verify-f16-benchmark.cjs` 與 `verify-no-clipping.cjs` 通過（`sf16` 實測 `15.02 m × 9.84 m × 4.99 m`，RCMQ 爬升 `962 m @ 179.5 m/s`；`f16v` 實測 `15.23 m × 9.49 m × 4.99 m`，RCMQ 爬升 `959 m @ 182.1 m/s`；左右主翼／平尾對稱、內收收輪及電氣開關位置皆通過）；瀏覽器實測 `127.0.0.1:4173`（1280×800 及 844×390 `iphone.html`）完成 F-16C／F-16V 機庫多角度、日間與夜間 `40%` 背光座艙、RCMQ 跑道起飛後燃爬升、收輪追蹤視角（`GEAR UP` 無輪外露）及手機版無水平溢位（`scrollWidth === 844`），控制台 0 筆錯誤；實體 iPhone 實機與長時程戰術包線效能仍待實機測試。

### 4. Antonov An-124-100 Ruslan（`an124`）— 已完成品質基準驗收
- **外觀與機構**（`dist/an124-highdef.js`、`dist/aircraft-skins.js`、`dist/flight.js`）：實機基準包絡 `70.48 m × 73.81 m × 20.82 m` 之高翼下反（翼根 `3.98 m` 降至翼尖 `1.59 m`）巨型運輸機廓型，四具 Lotarev D-18T 短艙與反推罩、無穿模流線駕艙風擋與機鼻雙條紋、右／左舷單面可讀塗裝字樣、24 輪多軸獨立支柱轉向起落架（雙前 4 輪 + 雙十輪主起落架全數接地 `-4.48 m` 並緊貼整流罩收起）、前機身雙液壓跪降（`kneel = -0.025 rad`）、上掀機鼻罩、兩段式折疊滾輪裝載坡道（`ramp minY = -4.501 m` 貼齊停機坪）與拱頂貨艙雙黃色高架天車／地面滾輪。
- **專屬座艙與任務聯動**：專屬俄系翠綠雙人座艙（6 螢幕航電面板、雙 PFD/HSI、4 發引擎簇、機鼻／跪降／24 輪狀態頁、`RUSLAN LOAD & NAV` 中央 CDU、4 具油門桿、連動襟翼／擾流板／起落架撥桿、雙 Antonov 操縱盤、夜間 `BACKLIGHT 40%` 可調背光與暖色泛光燈），飛行座艙自動隱藏貨艙拱頂以免視角重疊，並於預設最高畫質（`ultra` + `#rtLighting`）完成 RCKH→RCTP `74,000 kg` 前艙坡道裝貨／平衡（`CG -0.01 m`）、起飛（`76.9 m/s`）與爬升（`1109 m`）任務聯動；同步修復 `dist/atmospheric-sky.js` 雲層片段著色器缺少 `uniform float twilight` 宣告造成的夜航著色器編譯錯誤。
- **實測結果**：`run-all-tests.cjs` 全部 50 項通過（含 `verify-no-clipping.cjs` 100/100 機隊+加油機、`verify-an124-benchmark.cjs` 與既有回歸）；`verify-benchmarks.cjs` 在客貨機基準 `b773`（RCTP→RCKH 360 客、`result: 任務完成`）、`sf748`（RCKH→RCTP 35t/84t `result: 任務完成`）與 `an124`（RCKH→RCTP 35t/84t `result: 任務完成`）通過（註：舊版通用區域腳本 `verify-benchmarks.cjs` 不適用於戰機 `sf15`/`sf16` 五邊降落邏輯，戰機由 `verify-f16-benchmark.cjs`、`verify-fighter-controls.cjs` 與 `verify-supermaneuver-gforce.cjs` 驗收）；瀏覽器實測 `127.0.0.1:4173`（Desktop `1440×900` `?v=85`/`?v=86`/`?v=87` 及 Mobile `844×390` `iphone.html?v=85`）完成機庫 3D 檢視、日／夜間 `BACKLIGHT 40%` 座艙、貨運裝載實況、RCKH 起飛收輪、黃昏與夜航飛行座艙，`pageerror` 與 `console.error` 皆為 `0`。

### 5. Grumman F-14B Tomcat（`f14b`）— 已完成品質基準驗收
- **外觀與機構**（`dist/f14-highdef.js`、`dist/aircraft-skins.js`、`dist/flight.js`）：實機包絡 `19.57 m` 機長 × `19.71 m`（20° 展翼）／`10.17 m`（75° 停機超後掠）翼展，雙座 Tomcat 氣泡座艙罩與機首進氣平底隧道、雙 F110-GE-400 短艙與矩形可變進氣口／轉動壓縮風扇／後燃噴口、機腹雙腹鰭與 AIM-54/AIM-9 掛載、**連續可變後掠翼**（低速 20° → 隨馬赫數連續後掠至 68° → 停機 75° 超後掠；機庫支援「專屬機構展示」）、差動全動平尾、艦載雙前輪彈射牽引桿與可動攔阻尾鉤（`f.tailhook`）。
- **專屬座艙與實測**：專屬 Tomcat 雙人前座（VDI 垂直顯示器、HSD/TID 戰術顯示、機翼後掠角指示器、平行校準 HUD、HOTAS 操縱桿與尾鉤撥桿、8 個可點擊電氣／機構開關與可調夜間背光）；`verify-f14-benchmark.cjs` 與 `verify-no-clipping.cjs` 通過（RCMQ 起飛後燃爬升至 `1013 m @ 155.1 m/s`）。

### 6. McDonnell Douglas F/A-18C Hornet（`fa18c`）— 已完成品質基準驗收
- **外觀與機構**（`dist/fa18-highdef.js`、`dist/aircraft-skins.js`、`dist/flight.js`）：實機包絡 `17.32 m` 機長 × `11.84 m`（展開）／`7.68 m`（摺疊）翼展，尖銳雷達罩與前緣延伸邊條（LEX）含導流片、雙側圓弧進氣道與轉動 F404 風扇、外傾 20° 雙垂尾、雙 F404 噴口與後燃火焰、**艦載外翼向上摺疊機構**（停機斷電或機庫「專屬機構展示」自動向上摺疊至 `92°`）、**可動艦載攔阻尾鉤**（`f.tailhook`）與雙前輪彈射牽引桿。
- **專屬座艙與實測**：專屬 Hornet 三具方形多功能顯示器（Left DDI / Center MPCD / Right DDI）、UFC 前端控制器、寬視角 HUD、HOTAS 操縱桿／雙推力桿／尾鉤撥桿、8 個可點擊開關與可調夜間背光；`verify-fa18-benchmark.cjs` 與 `verify-no-clipping.cjs` 通過（RCMQ 起飛後燃爬升至 `984 m @ 169.4 m/s`）。

- **後續基準擴展狀態與誠實限制**：以上 6 架品質基準（`b773`、`sf748`、`sf16`/`f16v`、`an124`、`f14b`、`fa18c`）均已完成外觀、專屬座艙、機構動畫與代表任務驗收。其餘機型在未逐型精修前，仍依 `FLEET-100.csv` 與 `dist/fleet-expansion.js` 維持「程序模型／近似模型」與「共用座艙」誠實標示，不一次替 100 架貼上高精細完成標籤；此外 iPhone 版僅於視窗模擬（`844×390`）驗證，實體 iPhone／iOS Safari WebKit 實機仍待實測。
