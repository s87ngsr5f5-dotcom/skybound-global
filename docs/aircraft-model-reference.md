# Skybound Global 蒼穹守望者 — 100 架飛機 3D 特色建模設計提示詞規範 (Markdown Spec)

本文件針對 [Skybound Global 蒼穹守望者](https://skybound-air.pages.dev/) 機庫中的 **100 架飛機**，依 7 大機型分類逐一定義 **3D 幾何特徵、機身比例、機翼構型、動力艙段、尾翼結構與專屬辨識細節** 的建模設計提示詞（Prompts）。可直接複製單一機型或分類區塊作為 AI 3D 建模／Three.js 參數化幾何生成（Procedural Mesh Generation）的開發規格輸入。

## 通用 WebGL / Three.js 參數化建模基準提示詞 (Global Base Prompt)

> **系統全域建模提示詞（可前置於任意機型提示詞之前）：**
> 請為網頁版飛行模擬器（Three.js / WebGL）建立具高度辨識度的低多邊形至中多邊形（Low-to-Mid Poly, 1,500–4,500 triangles）程序化 3D 飛機模型。所有元件須以群組節點（`THREE.Group`）階層化組織，並嚴格對齊以下動態軸心與特色幾何：
> 1. **主結構比例**：依據真實飛機長寬比（Fuselage Fineness Ratio）與翼展比例建模，避免所有飛機共用同一套通用圓柱機身。
> 2. **機翼與翼端特徵**：明確區分高單翼（High-wing）、低單翼（Low-wing）、中單翼（Mid-wing）、後掠角（Sweep Angle）、上反角／下反角（Dihedral / Anhedral），並實作專屬翼端帆（Sharklets、Split Scimitar Winglets、Raked Wingtips 或翼尖副油箱）。
> 3. **尾翼構型**：精確區分傳統尾翼、T 型尾翼（T-Tail）、十字尾翼（Cruciform Tail）、V 型尾翼（V-Tail）、雙垂直尾翼（Twin Cant Tail）與鴨翼三角翼（Canard Delta）。
> 4. **可動控制面與動畫節點**：獨立拆分副翼（Ailerons）、升降舵（Elevators）、方向舵（Rudder）、襟翼（Flaps）、起落架（Landing Gear 收放結構）與螺旋槳／渦輪扇葉／旋翼（Propeller / Fan Blades / Rotor Disc）旋轉節點。

---

## 一、教練／通用飛機（14 架：#001 – #014）

### #001 Cessna 172S Skyhawk
- **機型定位**：單引擎高單翼四座初級教練機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Cessna 172S Skyhawk** 3D 模型：採用經典矩形截面金屬機身與「高單翼（High-wing）＋單支撐斜撐桿（Single Wing Strut）」結構；機頭為平緩下傾的 Lycoming 水平對臥活塞引擎罩，前端配置雙葉定距螺旋槳與圓錐整流罩；座艙具備全景前風擋與後方 360 度環視後窗（Omni-Vision Rear Window）；起落架為前三點固定式（Fixed Tricycle Gear），主起落架為外八字管狀彈簧鋼腿並附流線型輪罩（Wheel Pants）；垂直尾翼具明顯前緣背鰭延伸（Dorsal Fin）與傳統平尾。

### #002 Tecnam P2006T
- **機型定位**：雙引擎高單翼輕型通用教練機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Tecnam P2006T** 3D 模型：流線型複合材料橢圓截面機身，搭配無斜撐懸臂式高單翼（Cantilever High-wing）；雙具 Rotax 引擎短艙懸掛於高單翼前緣上方，各配雙葉恆速螺旋槳；主起落架設計於機腹兩側鼓包（Belly Sponsons）內並具收放結構；機鼻修長圓潤無引擎開口，尾翼為具細長後掠垂直安定面的傳統平尾構型。

### #003 Cessna 152
- **機型定位**：雙座輕型高單翼初級教練機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Cessna 152** 3D 模型：比 Cessna 172S 更短小緊湊的雙座機身，高單翼帶翼下單斜撐桿；機身後半段收束明顯，座艙僅左右各一扇側窗；固定式前三點管狀起落架；最具辨識度為寬大且帶明顯後掠角的垂直尾翼與圓弧過渡背鰭。

### #004 Piper PA-28 Archer
- **機型定位**：單引擎低單翼四座通用飛機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Piper PA-28 Archer** 3D 模型：採用懸臂式低單翼（Low-wing）具明顯上反角（Dihedral），機翼外段呈半梯形漸縮（Semi-tapered Wing）；機頭配置雙葉螺旋槳與兩側對稱冷卻進氣口；座艙為四面側窗設計（每側兩面窗），固定式前三點起落架直接固定於主翼下方與機頭；尾翼配備全動式水平安定面（Stabilator）與後掠垂直尾翼。

### #005 Diamond DA40 NG
- **機型定位**：單引擎複合材料低單翼現代教練機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Diamond DA40 NG** 3D 模型：全複合材料純白流線型滑翔機式機身，機尾極度細長收束；低單翼具大展弦比（High Aspect Ratio）與上翹翼端帆（Winglets）；座艙採大型前掀式全景泡泡艙罩（Bubble Canopy）；機頭搭載 Austro 柴油引擎罩與三葉複合材料螺旋槳；尾翼為經典 **T 型尾翼（T-Tail）**，配備固定式前三點起落架與流線輪罩。

### #006 Diamond DA42 Twin Star
- **機型定位**：雙引擎複合材料低單翼中高級教練機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Diamond DA42 Twin Star** 3D 模型：延續鑽石家族修長蝌蚪狀複合材料機身與 T 型尾翼；大展弦比低單翼末端具大型高聳折角翼端帆；主翼雙側安裝扁平流線型柴油引擎短艙與三葉螺旋槳；機鼻修長尖銳並於前緣配置雙鴨翼狀小邊條（Nose Strakes）；具可收放式前三點起落架。

### #007 Beechcraft Baron G58
- **機型定位**：雙引擎低單翼六座高性能活塞飛機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Beechcraft Baron G58** 3D 模型：修長方圓過渡金屬機身，每側具備三扇大型獨立客艙窗；低單翼上配置兩具大型六缸水平對臥活塞引擎短艙，短艙延伸至主翼後緣並帶三葉螺旋槳；傳統後掠垂直尾翼與微上反水平尾翼，配備可收放式前三點起落架。

### #008 Cirrus SR22
- **機型定位**：單引擎複合材料高性能低單翼私人飛機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Cirrus SR22** 3D 模型：流線圓潤的全複合材料機身，座艙兩側為鷗翼式上掀艙門與大面積曲面窗；低單翼具平滑圓弧翼端小翼與翼前緣折階（Leading-edge Cuff）；機頭配備三葉螺旋槳與下顎雙進氣口；固定式懸臂主起落架搭配大型水滴狀輪罩，機背後半段標示 CAPS 整機降落傘艙蓋細節。

### #009 Cessna 182T Skylane
- **機型定位**：單引擎高單翼四座中重型通用飛機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Cessna 182T Skylane** 3D 模型：較 172S 更寬厚飽滿的機頭與機身，容納六缸引擎並配置三葉恆速螺旋槳；高單翼附單斜撐桿，翼端微微下垂；固定式前三點起落架附輪罩，垂直尾翼較高且背鰭延伸段更長。

### #010 Cessna 206H Stationair
- **機型定位**：單引擎高單翼六座多用途重載通用機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Cessna 206H Stationair** 3D 模型：長機身六座配置，機身每側具三扇窗戶且右側後方具雙開大型貨艙門；高單翼帶斜撐桿；機腹線條平坦，機頭配備三葉螺旋槳；固定式粗壯前三點起落架，水平尾翼面積較大以平衡載重。

### #011 Beechcraft Bonanza G36
- **機型定位**：單引擎低單翼六座經典商務通用機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Beechcraft Bonanza G36** 3D 模型：修長六座低單翼機身，每側三扇大尺寸圓角方窗；機頭為長方形引擎罩與三葉螺旋槳；懸臂式低單翼搭配翼端航行燈莢艙，傳統後掠垂直尾翼與可收放式前三點起落架。

### #012 Diamond DA20 Eclipse
- **機型定位**：單引擎雙座複合材料輕型初級教練機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Diamond DA20 Eclipse** 3D 模型：極致輕巧的雙座滑翔機化機身，後機身如細管般連接 **T 型尾翼**，且機尾下方設有一片腹鰭（Ventral Fin）；大展弦比低單翼具上翹翼尖；單片式全景泡泡座艙罩、雙葉螺旋槳與固定式前三點起落架。

### #013 Extra 330SC
- **機型定位**：單座中單翼極限特技飛機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Extra 330SC** 3D 模型：專為極限特技設計的對稱翼型**中單翼（Mid-wing）**，無上反角（Zero Dihedral），配備全翼展大型副翼與翼尖碳纖維定風翼（Wingtip Spades）；粗壯圓筒形引擎罩配備三葉寬弦特技螺旋槳；單座水滴形泡泡艙罩位於機身中後段；採用**後三點固定式起落架（Taildragger）**。

### #014 Pilatus PC-21
- **機型定位**：單引擎低單翼高階渦輪螺旋槳軍用教練機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Pilatus PC-21** 3D 模型：具備噴射戰機外型的流線渦槳教練機；修長尖銳機鼻搭載五葉彎刀式石墨螺旋槳（Five-blade Scimitar Propeller）與兩側排氣管；縱列雙座階梯式水滴泡泡座艙罩；低單翼帶後掠角與上反角，機尾具前伸背鰭、後掠垂直尾翼與腹鰭，配備可收放前三點起落架。

---

## 二、渦槳／通勤飛機（10 架：#015 – #024）

### #015 Daher TBM 930
- **機型定位**：單引擎高速加壓艙商務渦槳機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Daher TBM 930** 3D 模型：超修長機鼻（內藏 PT6 渦槳引擎），前端配置五葉複合材料螺旋槳與兩側顯眼鍍鉻排氣口；圓形加壓機身每側具四扇圓角客艙窗；低單翼末端配備向上彎折的翼端帆（Winglets）；傳統尾翼帶長背鰭與腹鰭，可收放式前三點起落架。

### #016 Pilatus PC-12 NGX
- **機型定位**：單引擎大型商務／多用途渦槳機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Pilatus PC-12 NGX** 3D 模型：大型單引擎渦槳機身，機頭修長並配備五葉螺旋槳；低單翼末端具有角度鮮明的垂直翼端小翼；機尾採用高聳的 **T 型尾翼（T-Tail）** 搭配大型背鰭與機腹雙腹鰭；機身左後方具大型向上掀開的貨艙門。

### #017 Beechcraft King Air 350
- **機型定位**：雙引擎低單翼經典商務渦槳機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Beechcraft King Air 350** 3D 模型：方圓截面加壓機身搭配圓形客艙舷窗；低單翼兩側安裝突出於翼前緣甚遠的 PT6A 渦槳引擎短艙與四葉螺旋槳，翼尖具向上傾斜的翼端帆；機尾採用標誌性的 **T 型尾翼（T-Tail）** 與機腹雙腹鰭。

### #018 ATR 72-600
- **機型定位**：雙引擎高單翼 70 座級支線渦槳客機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **ATR 72-600** 3D 模型：修長圓筒形支線客機機身，採用懸臂式**高單翼（High-wing）**，翼下懸掛兩具渦槳引擎與六葉黑色彎刀形螺旋槳（Six-blade Propeller）；主起落架收納於機身下方兩側突出的整流鼓包（Fuselage Fairing Pods）內；機尾採用高聳的 **T 型尾翼** 與長階梯式背鰭。

### #019 ATR 42-600
- **機型定位**：雙引擎高單翼 48 座級短程支線渦槳客機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **ATR 42-600** 3D 模型：與 ATR 72 相同的高單翼、六葉彎刀螺旋槳、機腹起落架鼓包與 **T 型尾翼** 結構，但機身明顯縮短（長寬比更緊湊），使垂直尾翼與背鰭在視覺比例上顯得格外高大。

### #020 De Havilland Dash 8-400 (Q400)
- **機型定位**：雙引擎高單翼高速支線渦槳客機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **De Havilland Dash 8-400 (Q400)** 3D 模型：極為修長纖細的鉛筆狀機身與尖銳機鼻；高單翼下方懸掛兩具特別修長（延伸至主翼後緣後方）的引擎短艙，配備六葉螺旋槳，且主起落架直接從引擎短艙後段向下收放（非機腹鼓包）；機尾為高聳的 **T 型尾翼**。

### #021 DHC-6 Twin Otter
- **機型定位**：雙引擎高單翼短場起降（STOL）通用運輸渦槳機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **DHC-6 Twin Otter** 3D 模型：方正硬朗的箱型機身與長尖機鼻；平直高單翼附翼下雙斜撐桿，翼上配置兩具渦槳引擎與三葉螺旋槳；固定式前三點起落架，主起落架由機身下方向外延伸三角形支架支撐；尾翼為粗壯後掠垂直尾翼與十字偏下水平尾翼。

### #022 Dornier 228
- **機型定位**：雙引擎高單翼方型機身多用途渦槳機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **DHC-6 之外最具稜角特色的 Dornier 228** 3D 模型：橫截面完全呈**長方形箱型（Box-section Fuselage）**的機身，搭配扁長楔形機鼻；高單翼無斜撐，翼尖向後削切呈三角幾何翼端；翼下懸掛方形渦槳引擎短艙與四葉螺旋槳；機腹兩側具方形起落架整流罩。

### #023 Saab 340B
- **機型定位**：雙引擎低單翼 34 座級支線渦槳客機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Saab 340B** 3D 模型：區別於高單翼支線機，採用**懸臂式低單翼（Low-wing）**具明顯上反角；雙渦槳引擎短艙安裝於低單翼上方並配四葉螺旋槳；圓潤機鼻與六片式駕駛艙風擋，傳統後掠垂直尾翼與帶上反角的水平尾翼。

### #024 Cessna 208B Grand Caravan
- **機型定位**：單引擎高單翼多用途客貨兩用渦槳機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Cessna 208B Grand Caravan** 3D 模型：加長型高單翼單發渦槳機，機頭配三葉螺旋槳；高單翼具翼下單斜撐桿；**機腹下方掛載大型流線型貨艙莢艙（Belly Cargo Pod）** 為最關鍵視覺特徵；固定式前三點起落架。

---

## 三、商務噴射機（10 架：#025 – #034）

### #025 Cessna Citation CJ4
- **機型定位**：雙引擎低單翼輕型商務噴射機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Cessna Citation CJ4** 3D 模型：輕巧流線型商務機身，機頭錐平滑；低單翼具適度後掠角（無翼端小翼或僅微幅弧形翼尖）；機身後段兩側短柱懸掛兩具 Williams 渦扇引擎；機尾採用 **T 型尾翼（T-Tail）** 與修長背鰭。

### #026 Embraer Phenom 300E
- **機型定位**：雙引擎低單翼暢銷輕型商務噴射機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Embraer Phenom 300E** 3D 模型：流線型鵝卵石截面機身，每側具五扇寬大圓角長方窗；低單翼帶後掠角與流線翼端帆（Winglets）；機尾兩側吊掛雙渦扇引擎，搭配高聳的 **T 型尾翼**。

### #027 Gulfstream G650ER
- **機型定位**：雙引擎超長程旗艦商務噴射機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Gulfstream G650ER** 3D 模型：極度修長優雅的機身，機身兩側各排列 **8 扇灣流標誌性的超大橫向橢圓形全景舷窗（Large Oval Panoramic Windows）**；大後掠角低單翼搭配弧形高聳翼端帆；機尾兩側配置兩具巨型 Rolls-Royce BR725 渦扇引擎，搭配高聳後掠 **T 型尾翼**。

### #028 Gulfstream G700（🔒 任務解鎖）
- **機型定位**：雙引擎超大型五艙段旗艦商務噴射機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Gulfstream G700** 3D 模型：比 G650ER 更修長的機身，每側排列 **10 扇標誌性大型橢圓形全景舷窗**；機鼻與全景駕駛艙弧線平滑，大後掠角超臨界機翼搭配向外微傾的流線翼端帆；機尾兩側雙具 Pearl 700 大型渦扇引擎與 **T 型尾翼**。

### #029 Bombardier Global 7500
- **機型定位**：雙引擎四艙段超長程旗艦商務噴射機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Bombardier Global 7500** 3D 模型：超長圆筒形商務機身，每側配置 **14 扇接近方形的圓角大尺寸舷窗**；大後掠高速機翼具修長向上彎折的翼端帆；機尾兩側搭載 GE Passport 渦扇引擎，搭配高聳 **T 型尾翼** 與機尾背鰭冷卻進氣口。

### #030 Bombardier Challenger 350
- **機型定位**：雙引擎超中型商務噴射機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Bombardier Challenger 350** 3D 模型：寬體短機身比例（機艙截面較寬、機身長度緊湊），每側五扇方形圓角窗；低單翼末端具備**向外斜傾的折角翼端帆（Cant-angled Winglets）**；機尾兩側渦扇引擎與 **T 型尾翼**。

### #031 Dassault Falcon 7X
- **機型定位**：三引擎長程商務噴射機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Dassault Falcon 7X** 3D 模型：最具辨識度的**三具渦扇引擎（Tri-jet）**構型——機尾兩側各一具引擎，第三具引擎位於垂直尾翼根部並配備流線型 **S 型進氣道（S-Duct Intake）**；大後掠超臨界低單翼附融合式翼端帆，水平尾翼位於垂直尾翼中段的**十字型尾翼（Cruciform Tail）**。

### #032 Dassault Falcon 8X
- **機型定位**：三引擎超長程旗艦商務噴射機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Dassault Falcon 8X** 3D 模型：Falcon 7X 的加長機身升級版，保留標誌性**三引擎（機尾雙發＋垂直尾翼根部 S 型進氣道中置引擎）**與十字型尾翼；機身加長並配備每側約 14–16 扇圓角窗，機翼末端升級為更高聳修長的弧形超臨界翼端帆。

### #033 HondaJet Elite II
- **機型定位**：雙引擎翼上引擎構型輕型商務噴射機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **HondaJet Elite II** 3D 模型：最具辨識度的 **OTWEM 翼上引擎支架構型（Over-The-Wing Engine Mount）**——兩具渦扇引擎透過垂直流線支柱立於低單翼上方（而非掛在機尾或翼下）；修長尖銳海豚狀層流機鼻、大型翼端帆與 **T 型尾翼**。

### #034 Learjet 75
- **機型定位**：雙引擎高速輕型商務噴射機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Learjet 75** 3D 模型：戰鬥機般纖細修長的鉛筆狀機身與尖銳機鼻；低單翼末端具有高聳外傾的「Cant-angled Winglets」翼端帆；機尾兩側吊掛渦扇引擎、**T 型尾翼**，以及機尾下方標誌性的雙三角形腹鰭（Delta Fins）。

---

## 四、民航客機（25 架：#035 – #059）

### #035 Airbus A380-800
- **機型定位**：四引擎全雙層超大型廣體客機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Airbus A380-800** 3D 模型：全機身從頭到尾貫穿的**雙層客艙（Full-length Double-deck Fuselage）**與高聳飽滿的額頭曲線，駕駛艙位於上下兩層之間（偏低位置）；巨大後掠低單翼懸掛 **4 具大型渦扇引擎**，翼尖配置空巴經典上下雙向小翼（Wingtip Fences）；高聳巨大的垂直尾翼與雙主起落架＋雙機腹起落架（共 20 輪主起落架）。

### #036 Airbus A220-300
- **機型定位**：雙發支線／窄體噴射客機（機長 38.7 m · 翼展 35.1 m） ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Airbus A220-300** 3D 模型：修長窄體機身搭配流線下傾機鼻與四片式大面積曲面擋風玻璃；低單翼下方懸掛兩具相較於機身顯得極為粗壯的 Pratt & Whitney GTF 高旁通比渦扇引擎；翼端配備平滑上折的融合式翼端帆，傳統尾翼。

### #037 Airbus A320neo
- **機型定位**：雙引擎主流單走道窄體客機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Airbus A320neo** 3D 模型：標準單走道圓截面機身（機長約 37.6 m），空巴家族圓潤機鼻與側窗水平截角駕駛艙風擋；低單翼末端配備 **2.4 公尺高大型鯊魚鰭翼端帆（Sharklets）**；翼下懸掛兩具大直徑高旁通比渦扇引擎（CFM LEAP-1A / PW1100G），傳統尾翼。

### #038 Boeing 737 MAX 8
- **機型定位**：雙引擎新世代單走道窄體客機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Boeing 737 MAX 8** 3D 模型：波音 737 家族尖銳機鼻與「V 字形上揚下緣」六片式駕駛艙風擋，起落架較短使機身貼近地面；翼下懸掛兩具平底進氣口且**後緣具鋸齒狀消音噴嘴（Chevrons）**的 LEAP-1B 引擎；翼端配備極具辨識度的**上下雙叉彎刀式翼端帆（Split Scimitar / AT Winglets）**，垂直尾翼根部具長折角背鰭。

### #039 Boeing 767-300ER
- **機型定位**：雙引擎中型雙走道廣體客機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Boeing 767-300ER** 3D 模型：中大型廣體圓潤機身，四片式曲面駕駛艙風擋；後掠低單翼下懸掛兩具渦扇引擎，翼端可配置高聳融合式翼端帆或斜削式翼尖（Raked Wingtips）；配備前傾式四輪轉向架主起落架與傳統高聳尾翼。

### #040 Boeing 777-300ER
- **機型定位**：雙引擎超長程大型廣體客機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Boeing 777-300ER** 3D 模型：極為修長雄偉的廣體圓形機身，機尾收束成**扁平刀刃狀尾椎（Blade-shaped Tailcone）**；大展弦比後掠低單翼末端採用**大後掠斜削式翼尖（Raked Wingtips，無垂直折起小翼）**；翼下懸掛兩具世界最大直徑級的 GE90-115B 巨型渦扇引擎；主起落架為標誌性的**六輪三軸轉向架（Six-wheel Bogie）**。

### #041 Boeing 747-400
- **機型定位**：四引擎經典鵝頭半雙層巨無霸廣體客機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Boeing 747-400** 3D 模型：最具代表性的**前段雙層駝峰鵝頭（Upper Deck Hump）**機身，駕駛艙位於上層前端；大後掠低單翼下懸掛 **4 具渦扇引擎**，翼端配備向外斜折的垂直翼端小翼（Cant-angled Winglets，區別於 747-8 的斜削翼尖）；機腹具備四組四輪主起落架（共 16 主輪）。

### #042 Airbus A318-100
- **機型定位**：雙引擎超短機身單走道支線客機（Baby Bus） ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Airbus A318-100** 3D 模型：A320 家族中機身最短小精悍的衍生型（長寬比短粗可愛），翼端配備經典空巴小翼（Wingtip Fences）；為補償短機身的偏航力矩，**垂直尾翼比標準 A320 顯著加高**，在視覺上形成「短機身、超大高聳尾翼」的鮮明特徵。

### #043 Airbus A319-100
- **機型定位**：雙引擎短機身單走道中短程客機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Airbus A319-100** 3D 模型：機身長度介於 A318 與 A320 之間（機長約 33.8 m），保留標準空巴圓潤機鼻、翼下雙渦扇引擎與翼尖上下雙向小翼（Wingtip Fences），機翼上方每側設有一至兩扇逃生窗。

### #044 Airbus A321neo
- **機型定位**：雙引擎加長型單走道中長程窄體客機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Airbus A321neo** 3D 模型：A320 家族中最修長的鉛筆狀單走道機身（機長 44.5 m），機身前後段顯著加長並配置多組艙門／逃生門；翼下懸掛兩具大直徑高旁通比渦扇引擎，翼端配備高聳鯊魚鰭翼端帆（Sharklets）。

### #045 Airbus A330-300
- **機型定位**：雙引擎中長程雙走道廣體客機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Airbus A330-300** 3D 模型：修長廣體機身搭配空巴家族機鼻；大展弦比後掠低單翼下懸掛兩具渦扇引擎，翼尖配備**向外斜傾的梯形翼端帆（Cant-angled Winglets）**；主起落架為後傾式四輪轉向架，機身在地面停放時具微幅前傾姿態。

### #046 Airbus A330-900 (A330neo)
- **機型定位**：雙引擎新世代雙走道廣體客機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Airbus A330-900 (A330neo)** 3D 模型：基於 A330-300 修長廣體機身，駕駛艙風擋外框加入**黑色眼罩塗裝（Black Mask Windshield）**；機翼展弦比進一步拉長，翼尖改為類似 A350 的**平滑上揚弧形融合式翼端帆（Curved Blended Sharklets）**，翼下懸掛大直徑 Rolls-Royce Trent 7000 渦扇引擎。

### #047 Airbus A340-300
- **機型定位**：四引擎長程雙走道廣體客機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Airbus A340-300** 3D 模型：與 A330-300 共用修長廣體機身與外傾梯形翼端帆，但主翼下方懸掛 **4 具較細長小直徑的 CFM56 渦扇引擎（Hairdryer Engines）**，且機腹中央多出一組雙輪中線主起落架（Centerline Gear）。

### #048 Airbus A340-600
- **機型定位**：四引擎超長機身雙走道廣體客機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Airbus A340-600** 3D 模型：極度修長如雪茄般的超長廣體機身（長達 75.36 m，長寬比極高）；大展弦比機翼下懸掛 **4 具大型 Rolls-Royce Trent 500 渦扇引擎**（明顯比 A340-300 引擎粗壯），機腹中央配備四輪中線起落架。

### #049 Airbus A350-900
- **機型定位**：雙引擎新世代複合材料長程廣體客機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Airbus A350-900** 3D 模型：流線型機鼻搭配最具辨識度的**六片式黑色眼罩風擋（Zorro Black Mask Cockpit Windows）**；海鷗式弧形碳纖維機翼末端配備**優雅向上彎曲如武士刀般的弧形翼端帆（Curved Saber-like Winglets）**；翼下懸掛兩具大直徑 Trent XWB 渦扇引擎，主起落架為四輪轉向架。

### #050 Airbus A350-1000（🔒 任務解鎖）
- **機型定位**：雙引擎加長型超長程旗艦廣體客機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Airbus A350-1000** 3D 模型：A350-900 的加長旗艦版（機長 73.79 m），保留黑色眼罩駕駛艙風擋、雙具 Trent XWB 巨型渦扇引擎與弧形武士刀翼端帆；關鍵結構差異為**主起落架升級為六輪三軸轉向架（Six-wheel Bogie）**。

### #051 Boeing 737-800
- **機型定位**：雙引擎經典次世代（NG）單走道窄體客機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Boeing 737-800** 3D 模型：經典 737 NG 機身比例，尖銳機鼻與六片式折角風擋；翼下懸掛兩具進氣口呈「底部扁平倉鼠嘴狀（Flat-bottomed Nacelle）」的 CFM56 渦扇引擎（後緣為平滑圓形噴口，無鋸齒）；翼尖配備高聳的**單片向上彎折融合式翼端帆（Blended Winglets）**。

### #052 Boeing 737-900ER
- **機型定位**：雙引擎加長型單走道窄體客機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Boeing 737-900ER** 3D 模型：737 NG 家族最修長機身版本，保留扁平底部 CFM56 引擎短艙與單片向上彎折融合式翼端帆（或 Split Scimitar Winglets），機翼後方機身段增設一對額外緊急逃生門。

### #053 Boeing 757-200
- **機型定位**：雙引擎修長高腳中長程單走道客機（Flying Pencil） ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Boeing 757-200** 3D 模型：外號「空中鉛筆」的修長單走道機身，機頭下頷線條微向下收束；配備**格外修長高挑的主起落架（Tall Landing Gear）**使機腹離地很高；後掠低單翼下懸掛兩具大型 Rolls-Royce RB211 渦扇引擎與高聳融合式翼端帆。

### #054 Boeing 777-200ER
- **機型定位**：雙引擎中長程大型廣體客機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Boeing 777-200ER** 3D 模型：比 777-300ER 短截緊湊的標準 777 廣體圓截面機身，保留標誌性的**刀刃狀扁平尾椎**與**六輪三軸主起落架**；機翼末端為標準梯形削切翼尖（無 Raked Wingtips 亦無垂直小翼），翼下懸掛兩具大直徑渦扇引擎。

### #055 Boeing 787-8 Dreamliner
- **機型定位**：雙引擎複合材料中長程廣體客機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Boeing 787-8 Dreamliner** 3D 模型：787 家族最短機身型號，流線鯊魚鼻頭錐直接平滑過渡至**四片式大面積曲面駕駛艙風擋**；碳纖維超臨界機翼具極為顯著的**向上彎曲弧度（High Wing Flex）與後掠斜削式翼尖（Raked Wingtips）**；翼下兩具渦扇引擎短艙後緣具備標誌性的**鋸齒狀消音邊緣（Engine Nacelle Chevrons）**，配備四輪主起落架。

### #056 Boeing 787-9 Dreamliner
- **機型定位**：雙引擎複合材料主流長程廣體客機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Boeing 787-9 Dreamliner** 3D 模型：機身比 787-8 加長 6.1 公尺，長寬比例最為勻稱修長；具備流線機鼻、四片式曲面風擋、大上反弧度高展弦比機翼、斜削翼尖與引擎短艙後緣**鋸齒狀消音噴嘴（Chevrons）**。

### #057 Boeing 787-10 Dreamliner
- **機型定位**：雙引擎複合材料超長機身廣體客機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Boeing 787-10 Dreamliner** 3D 模型：787 家族最修長型號（機長 68.28 m），保留流線鯊魚鼻、四片式風擋、高弧度上翹機翼與鋸齒狀引擎短艙後緣，超長機身搭配大型客艙窗列呈現極佳修長感。

### #058 Embraer E190-E2
- **機型定位**：雙引擎新世代高展弦比支線噴射客機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Embraer E190-E2** 3D 模型：雙氣泡截面（Double-bubble）修長支線機身與尖銳機鼻；採用超高展弦比低單翼與**大後掠斜削式翼尖（Raked Wingtips，取代舊世代垂直小翼）**，翼下懸掛兩具大直徑 PW1900G 齒輪渦扇引擎。

### #059 Embraer E195-E2
- **機型定位**：雙引擎加長型新世代支線噴射客機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Embraer E195-E2** 3D 模型：E-Jets E2 家族最修長機型（機長 41.5 m），保留高展弦比大後掠斜削翼尖機翼與翼下兩具碩大的 PW1900G 渦扇引擎，機翼上方每側配置兩扇逃生窗。

---

## 五、貨運／運輸機（13 架：#060 – #072）

### #060 Boeing 767-300F
- **機型定位**：雙引擎中長程廣體全貨機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Boeing 767-300F** 3D 模型：基於 767-300ER 廣體機身，**完全移除兩側客艙舷窗（Windowless Freighter Fuselage）**，並於機身左前側標出大型上掀式主貨艙門輪廓；翼下懸掛兩具渦扇引擎，翼端配置高聳融合式翼端帆（Blended Winglets）。

### #061 Boeing 747-8F · Atlas
- **機型定位**：四引擎新世代超大型廣體全貨機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Boeing 747-8F · Atlas** 3D 模型：具備**較短的前上層鵝頭駝峰（Short Upper Deck Hump，貨機專屬特徵）**與無客艙窗的超長全貨機身（機長 76.3 m），機鼻具備可向上掀開的掀鼻式貨艙門分割線（Nose Cargo Door）；大後掠機翼配備**斜削式翼尖（Raked Wingtips）**，翼下懸掛 **4 具後緣帶鋸齒狀消音噴嘴（Chevrons）的 GEnx 渦扇引擎**，搭配 Atlas Air 深藍機尾與金色地球標誌塗裝風格。

### #062 Antonov An-124-100 Ruslan
- **機型定位**：四引擎超重型戰略運輸機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Antonov An-124-100 Ruslan** 3D 模型：極為寬大厚實的梨形截面重型機身，具備可上掀的寬大機鼻貨艙門與機尾斜坡艙門；採用**下反角高單翼（Anhedral High-wing）**，翼下懸掛 **4 具巨型 Lotarev D-18T 渦扇引擎**；機腹兩側鼓包內排列**多達 10 對（20 輪）並列式主起落架**，搭配高聳厚實的傳統單垂直尾翼。

### #063 Boeing 777F
- **機型定位**：雙引擎長程大型廣體全貨機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Boeing 777F** 3D 模型：採用 777-200LR 緊湊廣體機身搭配**無客艙舷窗的全貨機身**與左後側大型貨艙門；機翼結合 777-300ER 的**大後掠斜削式翼尖（Raked Wingtips）**與翼下兩具巨型 GE90-110B1 渦扇引擎，配備六輪主起落架與刀刃狀尾椎。

### #064 Boeing 737-800BCF
- **機型定位**：雙引擎客改貨單走道窄體貨機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Boeing 737-800BCF** 3D 模型：基於 737-800 窄體機身，封閉兩側客艙窗（呈現平滑無窗機身）並於左前側繪製大型主貨艙門框線；保留底部扁平進氣口的 CFM56 雙引擎與高聳融合式翼端帆。

### #065 Boeing 757-200PF
- **機型定位**：雙引擎修長高腳單走道包裹全貨機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Boeing 757-200PF** 3D 模型：延續 757-200 修長鉛筆狀機身、下沉式機鼻與修長高腳起落架，**全面移除機身兩側客艙窗與乘客逃生門**，僅保留前段組員艙門與左前大型貨艙門；翼下懸掛兩具大型渦扇引擎與融合式翼端帆。

### #066 Airbus A300-600F
- **機型定位**：雙引擎中短程雙走道廣體全貨機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Airbus A300-600F** 3D 模型：比 A330 短粗緊湊的廣體無窗全貨機身，保留空巴經典機鼻與四輪主起落架；後掠低單翼下懸掛兩具渦扇引擎，翼尖配備小型上下雙向翼尖小翼（Wingtip Fences）。

### #067 Airbus A330-200F
- **機型定位**：雙引擎長程雙走道廣體全貨機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Airbus A330-200F** 3D 模型：採用較短的 A330-200 無窗廣體貨機機身與外傾梯形翼端帆；最具辨識度的專屬建模特徵為**前起落架艙下方突出的流線型「下巴鼓包整流罩（Blister Fairing under Nose Gear）」**（用以抬高前起落架使貨艙地板保持水平）。

### #068 McDonnell Douglas MD-11F
- **機型定位**：三引擎長程廣體全貨機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **McDonnell Douglas MD-11F** 3D 模型：經典**三引擎廣體全貨機（Tri-jet Freighter）**——兩具渦扇引擎懸掛於低單翼下，**第三具引擎直接貫穿安裝於垂直尾翼根部（Straight-through Tail Engine）**；無窗修長廣體機身，翼端配備**上下分叉式翼端小翼（Split Winglets）**，機腹中央具雙輪中線起落架。

### #069 McDonnell Douglas DC-10-30F
- **機型定位**：三引擎經典雙走道廣體全貨機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **McDonnell Douglas DC-10-30F** 3D 模型：與 MD-11F 同為**翼下雙發＋垂直尾翼根部直通式第三引擎**的三發無窗廣體貨機，但機身較 MD-11F 短，且**機翼末端為平直削切翼尖（無翼端帆 Winglets）**，水平尾翼面積較大。

### #070 Lockheed Martin C-130J Super Hercules
- **機型定位**：四引擎高單翼戰術渦槳運輸機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Lockheed Martin C-130J Super Hercules** 3D 模型：粗壯圓筒形戰術運輸機身，機頭具多片式觀察窗（含下方視野窗）與小巧突出的機鼻雷達罩，機尾下方斜切並具後開式跳板貨艙門；平直**高單翼**下懸掛 **4 具渦槳引擎與六葉彎刀形螺旋槳**；主起落架縱列收納於機腹兩側鼓包內，搭配高大後掠單垂直尾翼。

### #071 Airbus A400M Atlas（🔒 任務解鎖）
- **機型定位**：四引擎高單翼重型戰術／戰略渦槳運輸機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Airbus A400M Atlas** 3D 模型：寬厚方圓截面軍用運輸機身，機背上方連接具明顯**下反角的高單翼（Anhedral Swept High-wing）**；翼下懸掛 **4 具大型渦槳引擎與八葉彎刀形對轉螺旋槳（Eight-blade Scimitar Propellers）**；機尾採用高聳的 **T 型尾翼（T-Tail）**，機腹兩側大型鼓包內收納 12 輪主起落架。

### #072 Boeing C-17 Globemaster III
- **機型定位**：四引擎高單翼重型戰略噴射運輸機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Boeing C-17 Globemaster III** 3D 模型：極為粗壯渾圓的重型戰略運輸機身與高聳的 **T 型尾翼**；採用**下反角後掠高單翼**，末端具備**高聳垂直翼端帆（Winglets）**，翼下懸掛 **4 具大型 F117 渦扇引擎**；機尾上揚並具大型空投斜坡艙門與機腹起落架整流鼓包。

---

## 六、戰鬥／訓練機（20 架：#073 – #092）

### #073 F-15 Eagle
- **機型定位**：雙引擎雙垂尾重型制空戰鬥機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **F-15 Eagle** 3D 模型：機身兩側具備大型**矩形斜切可調式二元進氣道（Rectangular Ramp Air Intakes）**；切角三角高單翼（Cropped Delta High-wing，無翼尖掛架）；機尾配置**兩片完全垂直（90 度直立無外傾）的高聳雙垂直尾翼（Twin Vertical Stabilizers）**、全動後掠水平尾翼與並列雙發尾噴管；大型水滴形單座泡泡座艙罩。

### #074 F-16C Fighting Falcon
- **機型定位**：單引擎單垂尾多用途輕型戰鬥機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **F-16C Fighting Falcon** 3D 模型：翼身融合體（Blended Wing-Body）流線造型，**機腹下方單一微笑形橢圓進氣口（Ventral Chin Intake）**；完全無隔框的全景水滴形泡泡座艙罩（Frameless Bubble Canopy）；大面積前緣延伸翼根（LERX）連接切角三角中單翼，**左右翼尖各掛載一枚 AIM-120 / AIM-9 飛彈滑軌**；高聳單垂直尾翼、全動下反水平尾翼、機腹雙腹鰭與單具大型圓形尾噴管。

### #075 Northrop F-5E Tiger II
- **機型定位**：雙引擎輕型超音速戰術戰鬥機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Northrop F-5E Tiger II** 3D 模型：極為纖細修長、具蜂腰面積律收束的機身，搭配扁平鯊魚鼻頭錐（Shark Nose Radome）；座艙兩側為小巧半圓形進氣口；低單翼具梯形輪廓與鋸齒形前緣延伸邊條（LERX），翼尖配置飛彈滑軌；單垂直尾翼、全動平尾與機尾並列雙小型尾噴口。

### #076 F-16V 戰隼 (Viper Block 70/72)
- **機型定位**：單引擎四代半升級型多用途戰鬥機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **F-16V 戰隼** 3D 模型：在 F-16C 的機腹單進氣口、無框泡泡艙罩與單垂尾基礎上，於**機背主翼上方兩側加入突出的適形油箱（Conformal Fuel Tanks, CFTs）**，以及延伸至尾翼根部的加長型電子戰背脊（Extended Dorsal Spine），搭配低視度空優灰塗裝與翼尖飛彈滑軌。

### #077 F-CK-1 經國號 (AIDC Ching-Kuo IDF)
- **機型定位**：雙引擎單垂尾輕型防空戰鬥機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **F-CK-1 經國號（IDF）** 3D 模型：融合 F-16 與 F/A-18 特徵的翼身融合體，扁平橢圓機鼻、水滴形座艙罩；機身兩側翼根下方配置**貼合機身的腎形雙進氣口（Twin Side-mounted Kidney Intakes）**；大片前緣延伸邊條（LERX）連接中單翼與翼尖天劍一型飛彈滑軌；單垂直尾翼與**緊密並列的雙小型渦扇引擎尾噴管**。

### #078 幻象 2000-5 · Mirage
- **機型定位**：單引擎無尾三角翼多用途戰鬥機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Dassault Mirage 2000-5（幻象 2000-5）** 3D 模型：最具辨識度的**純無尾大後掠三角翼構型（Tailless Delta Wing，無水平尾翼）**；機身兩側半圓形進氣口中央設有標誌性的**可動圓錐形激波錐（Shock Cones / Mice）**，進氣道上方具小型固定邊條；修長機鼻附空速管、高聳後掠單垂直尾翼與單具大型圓形尾噴管。

### #079 F-15C Eagle
- **機型定位**：雙引擎全天候制空優勢戰鬥機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **F-15C Eagle** 3D 模型：強調重型制空戰機細節，具備兩側大型斜切矩形進氣口、大型單座泡泡艙罩、切角三角高單翼、兩片直立高聳雙垂直尾翼（頂端左側具粗圓平衡配重莢艙、右側為細天線），以及機身兩側選配的平滑適形油箱（FAST Pack CFTs）與雙發無外罩裸露收斂擴張噴管。

### #080 F/A-18C Hornet
- **機型定位**：雙引擎雙外傾垂尾艦載多用途戰鬥攻擊機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **F/A-18C Hornet** 3D 模型：修長機鼻搭配延伸至座艙前方的大面積弧形前緣邊條（Large LERX）；翼根下方配置**圓形雙進氣口**；低後掠梯形中單翼附翼尖飛彈滑軌；機尾具備**兩片向外傾斜 20 度的雙垂直尾翼（Outward-canted Twin Tails，安裝於水平尾翼前方偏前位置）**、雙發尾噴管與粗壯雙輪前起落架。

### #081 F-14B Tomcat（🔒 任務解鎖）
- **機型定位**：雙引擎可變後掠翼重型艦載戰鬥機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **F-14B Tomcat** 3D 模型：最具代表性的**可變後掠翼（Variable-sweep Wing，可支援展開與大後掠高速模式）**與寬大扁平的「網球拍式」升力體機身；機腹兩側相距甚遠的斜切矩形進氣道與寬間距雙發尾噴管（間距中間形成隧道）；縱列雙座長水滴艙罩与微向外傾的雙垂直尾翼。

### #082 F-22A Raptor（🔒 任務解鎖）
- **機型定位**：雙引擎第五代匿蹤制空戰鬥機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **F-22A Raptor** 3D 模型：全機採用平行折線邊緣與**菱形截面匿蹤機身（Chined Stealth Fuselage）**；兩側平行斜切加萊特進氣口（Caret Intakes）、無框金色鍍膜水滴形單座艙罩；鑽石形切角梯形主翼、**向外大幅傾斜 28 度的雙垂直尾翼**、切角水平尾翼與標誌性的**扁平二元向量推力尾噴口（2D Thrust Vectoring Nozzles）**。

### #083 F-35A Lightning II
- **機型定位**：單引擎第五代多用途匿蹤戰鬥機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **F-35A Lightning II** 3D 模型：比 F-22 更飽滿厚實的單發匿蹤機身，機鼻具菱形折線，座艙兩側為無附面層隔道超音速進氣口（DSI 鼓包進氣道）；前掀式單座艙罩與飽滿隆起的機背曲線；切角梯形主翼、向外傾斜的雙垂直尾翼、全動平尾與**單具巨型鋸齒邊緣圓形尾噴管**。

### #084 Dassault Rafale C（🔒 任務解鎖）
- **機型定位**：雙引擎鴨翼三角翼多用途戰鬥機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Dassault Rafale C（飆風戰機）** 3D 模型：極具辨識度的**近距耦合全動鴨翼＋大三角翼構型（Close-coupled Canard Delta Wing）**；座艙兩側下方為貼合機身的半埋式腎形雙進氣口，機鼻右前方具固定式空中加油管；高聳後掠單垂直尾翼、翼尖飛彈滑軌與緊密並列的雙發尾噴管。

### #085 Eurofighter Typhoon
- **機型定位**：雙引擎遠距鴨翼三角翼制空／多用途戰鬥機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Eurofighter Typhoon（颱風戰機）** 3D 模型：採用**機鼻前段遠距全動鴨翼（Foreplane Canards placed near the nose）＋無尾大三角翼**構型；最顯著特徵為**機腹正下方並列雙矩形笑口進氣道（Chin-mounted Twin Rectangular Intakes）**；高聳單垂直尾翼與雙發尾噴管。

### #086 Sukhoi Su-27 Flanker
- **機型定位**：雙引擎重型長程制空戰鬥機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Sukhoi Su-27 Flanker** 3D 模型：極為修長優美的**鶴首下垂機鼻（Drooped Crane-like Nose）**與水滴形單座艙罩；完美翼身融合體搭配大前緣邊條與後掠中單翼；機腹下方兩具獨立懸吊的長方形進氣道與寬間距雙發尾噴管，雙發中間向後伸出長長的**尾椎（Tail Sting）**，搭配兩片直立高聳雙垂直尾翼。

### #087 Mikoyan MiG-29 Fulcrum
- **機型定位**：雙引擎中型前線制空戰鬥機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Mikoyan MiG-29 Fulcrum** 3D 模型：外型與 Su-27 相似但尺寸緊湊且無長尾椎；水滴形座艙罩後方連接厚實隆起的駝背機脊（Humped Dorsal Spine）；大片圓弧前緣邊條下方為兩具楔形機腹進氣道，機尾配備略向外傾且前緣向前延伸的雙垂直尾翼與雙發尾噴管。

### #088 F-104G Starfighter
- **機型定位**：單引擎高空高速截擊戰鬥機（有人駕駛飛彈） ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **F-104G Starfighter** 3D 模型：極端細長的**鉛筆狀圓筒機身與針尖般銳利的長機鼻**；座艙兩側為帶半圓形激波錐的進氣口；機身中段安裝一對**面積極小、極薄且明顯下垂（Anhedral）的剃刀形短梯形機翼**，翼尖通常掛載雪茄形副油箱；機尾為高聳短寬的 **T 型尾翼（T-Tail）** 與單發尾噴口。

### #089 Saab JAS 39C Gripen
- **機型定位**：單引擎輕型鴨翼三角翼多用途戰鬥機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Saab JAS 39C Gripen（獅鷲戰機）** 3D 模型：緊湊輕巧的**單引擎近距耦合鴨翼＋切角三角翼（Canard Delta）**構型；座艙兩側配置矩形進氣口，緊接著進氣口上方外侧即為大型全動式三角鴨翼；翼尖具飛彈掛架，搭配單垂直尾翼與單具圓形尾噴管。

### #090 KAI T-50 Golden Eagle
- **機型定位**：單引擎超音速高級噴射教練／輕型攻擊機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **KAI T-50 Golden Eagle** 3D 模型：外型神似縮小版 F-16 的翼身融合體與大面積前緣邊條（LERX）、切角梯形中單翼與翼尖掛架、單垂尾與全動平尾；但關鍵差異為**縱列雙座大型水滴艙罩**與**座艙兩側翼根下方的雙橢圓進氣口（取代 F-16 的機腹單進氣口）**，後段匯流為單發尾噴管。

### #091 BAE Hawk T2
- **機型定位**：單引擎低單翼高級噴射教練機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **BAE Hawk T2** 3D 模型：緊湊流線的次音速高級教練機，下傾尖銳機鼻與階梯式高視野**縱列雙座大型座艙罩**；座艙兩側為小型圓潤進氣口；低單翼具適度後掠角，搭配後掠單垂直尾翼、微下垂水平尾翼與單發尾噴口。

### #092 AIDC AT-3 自強號
- **機型定位**：雙引擎低單翼高級噴射教練／輕攻擊機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **AIDC AT-3 自強號** 3D 模型：台灣漢翔研製經典高教機，修長平順機鼻與階梯式**縱列雙座長座艙罩**；座艙兩側下方為貼合機身的半圓形雙進氣道，機尾並列兩具小型渦扇引擎噴口；採用**超臨界平直低單翼（Low-wing with minimal sweep）**、高聳後掠單垂直尾翼與中低置水平尾翼，搭配紅白藍三色塗裝視覺特徵。

---

## 七、直升機（8 架：#093 – #100）

### #093 SKYBOUND H6 · 巡遊直升機
- **機型定位**：Skybound 原創輕型高機動巡遊／偵察直升機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **SKYBOUND H6 · 巡遊直升機** 3D 模型：以經典「小鳥（MH-6 / MD 500）」蛋形流線座艙為靈感的原創巡遊直升機；圓潤的全景玻璃蛋形機頭（Egg-shaped Bubble Cockpit）、頂部配置五葉主旋翼（Five-blade Main Rotor）；細長圓管狀尾桁連接 **T 型尾翼與雙葉尾槳**，底部配備輕量化雙滑撬起落架（Landing Skids）與 Skybound 專屬科技塗裝。

### #094 AW101 Merlin · 搜救巡邏直升機
- **機型定位**：三引擎重型遠程搜救／巡邏直升機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **AW101 Merlin · 搜救巡邏直升機** 3D 模型：寬大厚實的箱型搜救機艙，機鼻下方配備大型圓盤狀海事搜索雷達罩，機身兩側具大型浮筒／起落架整流鼓包（Sponsons）與機尾斜坡艙門；機頂粗壯的引擎艙內藏**三具渦軸引擎（三排氣口）**，驅動**五葉複合材料主旋翼（槳尖具特殊後掠槳葉 BERP 造型）**與四葉尾槳。

### #095 UH-60M 黑鷹直升機 · 戰術搜救
- **機型定位**：雙引擎中型通用／戰術搜救直升機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **UH-60M 黑鷹直升機（Black Hawk）** 3D 模型：低矮修長、抗墜毀設計的扁寬戰術機身，兩側具大型滑動艙門；機頂兩側配置雙渦軸引擎艙與四葉寬弦主旋翼；採用**後三點固定式輪式起落架（Tailwheel Landing Gear）**；尾桁末端為斜置四葉尾槳，且垂直尾翼根部下方配備一片**大型平直水平安定面（Large Stabilator）**。

### #096 AH-64E 阿帕契守護者 · 重型攻擊直升機
- **機型定位**：雙引擎縱列雙座重型武裝攻擊直升機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **AH-64E 阿帕契守護者（Apache Guardian）** 3D 模型：稜角分明的窄機身**縱列階梯式雙座裝甲座艙（Tandem Stepped Armored Cockpit）**；機鼻前端配置 TADS 光電轉塔，機腹正下方懸掛 **30mm M230 鏈砲**；機身兩側短翼（Stub Wings）各具兩處武器掛架（掛載地獄火飛彈與火箭莢艙），短翼上方為大型雙引擎艙；四葉主旋翼頂端正中央安裝標誌性的**圓餅狀長弓毫米波雷達（Longbow Radar Dome）**，尾槳為 X 形雙組四葉交錯抗噪構型。

### #097 Robinson R44 Raven II
- **機型定位**：單引擎四座輕型活塞通用直升機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Robinson R44 Raven II** 3D 模型：最具辨識度的輕型直升機輪廓——圓潤的水滴形四座全透明前座艙，後方連接裸露散熱格柵的活塞引擎段；座艙頂部向上伸出**極為修長高挑的主旋翼桅杆（Tall Rotor Mast）**並帶**雙葉蹺蹺板式主旋翼（Two-blade Teetering Rotor）**；細長圓錐形尾桁搭配雙葉尾槳，底部為輕型雙管滑撬起落架（Skids）。

### #098 Bell 206B JetRanger
- **機型定位**：單引擎五座經典輕型渦軸直升機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Bell 206B JetRanger** 3D 模型：經典水滴流線型五座機身（比 R44 更為一體化），機頂流線型渦軸引擎整流罩無長桅杆外露，直接驅動**雙葉寬弦主旋翼（Two-blade Main Rotor）**；修長尾桁中段設有帶端板的水平安定面，末端為上下延伸的垂直尾翼與雙葉尾槳，底部為高腳管狀滑撬起落架。

### #099 Airbus H145
- **機型定位**：雙引擎輕中型多用途／醫療救援直升機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Airbus H145** 3D 模型：圓潤現代化的流線玻璃座艙與寬敞後艙（機尾下方具蚌殼式對開後艙門），配備五葉無軸承主旋翼与雙滑撬起落架；尾桁末端採用最具辨識度的**涵道式尾槳（Fenestron Shrouded Tail Rotor）**搭配兩側具垂直端板的 H 型水平尾翼。

### #100 Sikorsky S-92A
- **機型定位**：雙引擎大型遠程運輸／搜救直升機 ([Skybound Global](https://skybound-air.pages.dev/))
- **建模設計提示詞**：
  > 建立 **Sikorsky S-92A** 3D 模型：大型寬體客艙式機身，機身兩側具備**向左右外伸的寬大翼狀浮筒整流鼓包（Large Sponsons，內收雙輪主起落架）**，機尾具後開斜坡艙門；機頂雙渦軸引擎艙驅動四葉後掠尖端主旋翼，尾桁末端為高聳後掠垂直尾翼、四葉尾槳與單側水平安定面。
