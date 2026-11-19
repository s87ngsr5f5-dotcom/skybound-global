# SKYBOUND GLOBAL — Blender Python (`bpy`) 一鍵批次 3D 建模與 `.glb` 匯出管線

本資料夾包含完整的 **方案二（Blender Python 自動化建模管線）**，將先前 8 位子代理撰寫的全部 **100 架飛機、50 座世界著名地標、62 座全球與台灣機場** 的設計規格與提示詞直接轉化為可執行的 Blender `bpy` 程式化建模腳本，並自動匯出符合 `SKYBOUND GLOBAL` Three.js 引擎規範的無壓縮 `.glb`（`+Y Up`、`1 unit = 1m`、含 `Landing_Gear` / `Fan_Blades` / `Terminal_Glass_Emissive` / `Obstacle_Beacons` 節點）。

---

## 📁 腳本清單

| 檔案 | 功能與涵蓋範圍 | 匯出路徑 |
| :--- | :--- | :--- |
| `run_all_blender_exports.py` | **一鍵總控腳本**：依序執行以下三個產生器，並自動生成 `dist/models/glb-manifest.json` 供遊戲引擎自動偵測載入 | `dist/models/glb-manifest.json` |
| `build_all_airports_glb.py` | **全部 62 座機場**（台灣 11 座 + 亞洲 24 座 + 中東/歐/美/大洋洲/非 27 座）航廈、塔台、空橋 `.glb` | `dist/models/airports/<ICAO>.glb` |
| `build_all_landmarks_glb.py` | **全球 50 座著名地標**（台北 101、高雄 85、金門大橋、晴空塔、上海中心 120° 螺旋、哈里發塔等）`.glb` | `dist/models/landmarks/<id>.glb` |
| `build_all_aircraft_glb.py` | **全機隊 100 架飛機與直昇機**（含 NACA 機翼、`Landing_Gear`、`Tires`、`Fan_Blades`/`Main_Rotor_Hub`）`.glb` | `dist/models/aircraft/<id>.glb` |

---

## 🚀 快速執行方式（支援 Blender 3.6 / 4.0 / 4.1 / 4.2 / 4.3）

### 方式 A：命令列背景一鍵批次匯出（最快、推薦）
在 Windows PowerShell 執行（將 `blender` 換成你的 Blender 安裝路徑，例如 `& "C:\Program Files\Blender Foundation\Blender 4.2\blender.exe"`）：

```powershell
# 1. 一次產出 62 座機場 + 50 座地標 + 16 架主力旗艦飛機（預設快速模式，約 15~30 秒）
blender --background --python .\blender-pipeline\run_all_blender_exports.py

# 2. 若要一次把「全部 100 架飛機 + 62 座機場 + 50 座地標（共 212 個 GLB）」全部匯出：
$env:SKYBOUND_AIRCRAFT="ALL"
blender --background --python .\blender-pipeline\run_all_blender_exports.py

# 3. 若只想先匯出特定幾座台灣與國際機場測試：
$env:SKYBOUND_TARGETS="airports"
$env:SKYBOUND_AIRPORTS="RCTP,RCSS,RCKH,WSSS,KJFK,KLAX,KSFO,RJTT,VHHH,EGLL,OMDB"
blender --background --python .\blender-pipeline\run_all_blender_exports.py
```

### 方式 B：Blender 圖形介面一鍵執行
1. 開啟 Blender -> 點擊頂部 **Scripting** 工作區。
2. 點擊 **Open** 開啟 `run_all_blender_exports.py`（或單獨開啟任一 `build_all_*.py`）。
3. 按下右上角 **▶ Run Script** 按鈕，即自動將所有 `.glb` 匯出至 `dist/models/` 並生成 `glb-manifest.json`。

---

## 🔗 遊戲自動掛載機制
遊戲啟動時（`dist/global-scenery.js` 與 `dist/airport-surroundings.js`）會自動讀取 `dist/models/glb-manifest.json`：
- 只要對應的 `dist/models/airports/<ICAO>.glb` 或 `dist/models/landmarks/<id>.glb` 存在於 manifest 中，遊戲即會自動用 `THREE.GLTFLoader` 載入您的 Blender 精細模型並同步日夜發光；
- 尚未匯出 `.glb` 的機場與地標，則自動以遊戲內建的高精度程序化 3D 幾何渲染，保證零 404 錯誤且流暢不閃退。
