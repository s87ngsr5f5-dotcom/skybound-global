(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.MissionCinematics = api;
  }
  if (typeof window !== 'undefined') {
    window.MissionCinematics = api;
  } else if (root) {
    root.MissionCinematics = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function makeSvg(accent, inner) {
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96" aria-hidden="true">`,
      `<defs>`,
      `<radialGradient id="bg_${accent.slice(1)}" cx="50%" cy="42%" r="58%">`,
      `<stop offset="0%" stop-color="${accent}" stop-opacity="0.28"/>`,
      `<stop offset="70%" stop-color="#0b1322" stop-opacity="0.96"/>`,
      `<stop offset="100%" stop-color="#050912" stop-opacity="1"/>`,
      `</radialGradient>`,
      `</defs>`,
      `<rect x="2" y="2" width="92" height="92" rx="14" fill="url(#bg_${accent.slice(1)})" stroke="${accent}" stroke-opacity="0.65" stroke-width="2"/>`,
      `<circle cx="48" cy="48" r="36" fill="none" stroke="${accent}" stroke-opacity="0.18" stroke-width="1" stroke-dasharray="3 4"/>`,
      `<line x1="10" y1="48" x2="86" y2="48" stroke="${accent}" stroke-opacity="0.12" stroke-width="1"/>`,
      `<line x1="48" y1="10" x2="48" y2="86" stroke="${accent}" stroke-opacity="0.12" stroke-width="1"/>`,
      inner,
      `</svg>`
    ].join('');
  }

  const OFFICERS = {
    chou: {
      id: 'chou',
      name: '周振華教官',
      role: 'CAPT. CHOU · 總飛行教官',
      callsign: 'CHOU-01',
      accentColor: '#f5c25b',
      avatarSvg: makeSvg('#f5c25b', [
        `<path d="M22 86 C24 67 34 61 48 61 C62 61 72 67 74 86 Z" fill="#1b2638" stroke="#f5c25b" stroke-width="1.5"/>`,
        `<path d="M38 62 L48 73 L58 62" fill="none" stroke="#f5c25b" stroke-width="1.8"/>`,
        `<rect x="26" y="72" width="9" height="4" rx="1" fill="#f5c25b"/>`,
        `<rect x="61" y="72" width="9" height="4" rx="1" fill="#f5c25b"/>`,
        `<circle cx="48" cy="41" r="15" fill="#e6be98"/>`,
        `<path d="M31 32 C34 21 62 21 65 32 L68 35 L28 35 Z" fill="#182233" stroke="#f5c25b" stroke-width="1.4"/>`,
        `<rect x="42" y="25" width="12" height="4" rx="2" fill="#f5c25b"/>`,
        `<rect x="35" y="37" width="11" height="7" rx="3" fill="#0d1520" stroke="#f5c25b" stroke-width="1.2"/>`,
        `<rect x="50" y="37" width="11" height="7" rx="3" fill="#0d1520" stroke="#f5c25b" stroke-width="1.2"/>`,
        `<line x1="46" y1="40" x2="50" y2="40" stroke="#f5c25b" stroke-width="1.2"/>`,
        `<path d="M32 39 L30 48 L43 52" fill="none" stroke="#f5c25b" stroke-width="1.8" stroke-linecap="round"/>`,
        `<circle cx="44" cy="52" r="2.2" fill="#f5c25b"/>`
      ].join(''))
    },
    lin: {
      id: 'lin',
      name: '林嵐少校',
      role: 'MAJ. LIN · 戰術指揮官 AWACS',
      callsign: 'OVERLORD',
      accentColor: '#38bdf8',
      avatarSvg: makeSvg('#38bdf8', [
        `<path d="M22 86 C25 68 35 62 48 62 C61 62 71 68 74 86 Z" fill="#13263a" stroke="#38bdf8" stroke-width="1.5"/>`,
        `<path d="M40 62 L48 74 L56 62" fill="none" stroke="#38bdf8" stroke-width="1.6"/>`,
        `<circle cx="48" cy="42" r="14.5" fill="#f0cbb0"/>`,
        `<path d="M32 42 C32 27 40 22 48 22 C58 22 64 28 64 42 C62 34 56 30 48 30 C40 30 35 34 32 42 Z" fill="#162030"/>`,
        `<path d="M30 40 C30 25 66 25 66 40" fill="none" stroke="#38bdf8" stroke-width="2.4"/>`,
        `<rect x="27" y="37" width="6" height="12" rx="3" fill="#0e1b2a" stroke="#38bdf8" stroke-width="1.4"/>`,
        `<rect x="63" y="37" width="6" height="12" rx="3" fill="#0e1b2a" stroke="#38bdf8" stroke-width="1.4"/>`,
        `<rect x="49" y="36" width="13" height="8" rx="2.5" fill="#38bdf8" fill-opacity="0.28" stroke="#38bdf8" stroke-width="1.3"/>`,
        `<circle cx="42" cy="40" r="1.7" fill="#0f172a"/>`,
        `<path d="M31 46 L42 52" fill="none" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round"/>`,
        `<circle cx="43" cy="52" r="2" fill="#38bdf8"/>`
      ].join(''))
    },
    chen: {
      id: 'chen',
      name: '陳語彤',
      role: 'ATC CHIEF · 國際塔台管制主任',
      callsign: 'TOWER-01',
      accentColor: '#34d399',
      avatarSvg: makeSvg('#34d399', [
        `<path d="M23 86 C26 68 35 63 48 63 C61 63 70 68 73 86 Z" fill="#142d2b" stroke="#34d399" stroke-width="1.5"/>`,
        `<path d="M41 63 L48 73 L55 63" fill="#e2f8f0" fill-opacity="0.16" stroke="#34d399" stroke-width="1.4"/>`,
        `<circle cx="48" cy="42" r="14" fill="#f3d0b6"/>`,
        `<path d="M33 44 C33 27 40 22 48 22 C57 22 63 27 63 45 C61 36 55 31 48 31 C40 31 35 36 33 44 Z" fill="#1e293b"/>`,
        `<path d="M62 36 C65 36 67 40 66 46" fill="none" stroke="#34d399" stroke-width="2.2"/>`,
        `<rect x="61" y="37" width="6" height="11" rx="3" fill="#0d1f1d" stroke="#34d399" stroke-width="1.4"/>`,
        `<path d="M63 46 L52 52" fill="none" stroke="#34d399" stroke-width="1.7" stroke-linecap="round"/>`,
        `<circle cx="51" cy="52" r="2" fill="#34d399"/>`,
        `<circle cx="43" cy="41" r="1.7" fill="#0f172a"/>`,
        `<circle cx="53" cy="41" r="1.7" fill="#0f172a"/>`,
        `<path d="M44 48 Q48 51 52 48" fill="none" stroke="#0f172a" stroke-width="1.4" stroke-linecap="round"/>`
      ].join(''))
    },
    rex: {
      id: 'rex',
      name: '雷克斯',
      role: 'CALLSIGN REX · 雷虎王牌僚機',
      callsign: 'VIPER-2',
      accentColor: '#fb923c',
      avatarSvg: makeSvg('#fb923c', [
        `<path d="M21 86 C24 67 34 61 48 61 C62 61 72 67 75 86 Z" fill="#2a1f1b" stroke="#fb923c" stroke-width="1.5"/>`,
        `<path d="M30 43 C30 25 38 19 48 19 C58 19 66 25 66 43 C66 54 58 60 48 60 C38 60 30 54 30 43 Z" fill="#1e2430" stroke="#fb923c" stroke-width="1.8"/>`,
        `<path d="M33 35 C38 30 58 30 63 35 L61 46 C55 48 41 48 35 46 Z" fill="#fb923c" fill-opacity="0.72" stroke="#fed7aa" stroke-width="1.2"/>`,
        `<path d="M39 49 L48 59 L57 49 L54 45 L42 45 Z" fill="#0f172a" stroke="#fb923c" stroke-width="1.4"/>`,
        `<line x1="48" y1="59" x2="48" y2="71" stroke="#fb923c" stroke-width="3" stroke-linecap="round"/>`,
        `<path d="M44 23 L48 17 L52 23" fill="none" stroke="#fb923c" stroke-width="1.6"/>`
      ].join(''))
    },
    su: {
      id: 'su',
      name: '蘇博士',
      role: 'DR. SU · 氣象與特勤科學官',
      callsign: 'METEO-LAB',
      accentColor: '#c084fc',
      avatarSvg: makeSvg('#c084fc', [
        `<path d="M22 86 C25 68 35 62 48 62 C61 62 71 68 74 86 Z" fill="#241935" stroke="#c084fc" stroke-width="1.5"/>`,
        `<path d="M39 62 L48 76 L57 62" fill="none" stroke="#e9d5ff" stroke-width="1.8"/>`,
        `<circle cx="48" cy="42" r="14" fill="#efd0ba"/>`,
        `<path d="M34 38 C34 25 41 21 48 21 C56 21 62 26 62 38 C59 31 54 29 48 29 C41 29 37 32 34 38 Z" fill="#1f1b2e"/>`,
        `<rect x="35" y="37" width="11" height="7" rx="2.5" fill="#c084fc" fill-opacity="0.24" stroke="#c084fc" stroke-width="1.5"/>`,
        `<rect x="50" y="37" width="11" height="7" rx="2.5" fill="#c084fc" fill-opacity="0.24" stroke="#c084fc" stroke-width="1.5"/>`,
        `<line x1="46" y1="40" x2="50" y2="40" stroke="#c084fc" stroke-width="1.4"/>`,
        `<circle cx="40.5" cy="40.5" r="1.3" fill="#0f172a"/>`,
        `<circle cx="55.5" cy="40.5" r="1.3" fill="#0f172a"/>`,
        `<path d="M44 49 Q48 51.5 52 49" fill="none" stroke="#0f172a" stroke-width="1.3" stroke-linecap="round"/>`
      ].join(''))
    },
    bruce: {
      id: 'bruce',
      name: '布魯斯艦長',
      role: 'CAPT. BRUCE · 福特號航艦艦長',
      callsign: 'CVN-78',
      accentColor: '#60a5fa',
      avatarSvg: makeSvg('#60a5fa', [
        `<path d="M21 86 C24 67 34 61 48 61 C62 61 72 67 75 86 Z" fill="#102038" stroke="#60a5fa" stroke-width="1.5"/>`,
        `<rect x="25" y="71" width="10" height="4" rx="1" fill="#f5c25b"/>`,
        `<rect x="61" y="71" width="10" height="4" rx="1" fill="#f5c25b"/>`,
        `<circle cx="48" cy="43" r="14.5" fill="#e4bc99"/>`,
        `<path d="M29 33 L35 21 L61 21 L67 33 Z" fill="#172a46" stroke="#60a5fa" stroke-width="1.5"/>`,
        `<rect x="27" y="32" width="42" height="4.5" rx="2" fill="#0b1526" stroke="#f5c25b" stroke-width="1"/>`,
        `<circle cx="48" cy="27" r="3" fill="#f5c25b"/>`,
        `<circle cx="42.5" cy="42" r="1.7" fill="#0f172a"/>`,
        `<circle cx="53.5" cy="42" r="1.7" fill="#0f172a"/>`,
        `<path d="M43 50 L53 50" stroke="#0f172a" stroke-width="1.6" stroke-linecap="round"/>`,
        `<path d="M63 41 L66 47 L55 52" fill="none" stroke="#60a5fa" stroke-width="1.7" stroke-linecap="round"/>`,
        `<circle cx="54" cy="52" r="2" fill="#60a5fa"/>`
      ].join(''))
    }
  };

  function matchOfficer(speakerStr) {
    const raw = String(speakerStr || '').trim();
    const s = raw.toLowerCase();
    if (!s) return OFFICERS.chou;
    if (OFFICERS[s]) return OFFICERS[s];

    if (/布魯斯|航艦|福特|艦長|甲板|cvn|carrier|bruce|lso|海軍/.test(s)) {
      return OFFICERS.bruce;
    }
    if (/蘇博士|氣象|科學|特勤|dr\.?\s*su|meteo|research|衛星|火山|風暴研究/.test(s)) {
      return OFFICERS.su;
    }
    if (/雷克斯|僚機|雷虎|王牌|rex|viper|wingman|編隊|長機/.test(s)) {
      return OFFICERS.rex;
    }
    if (/林嵐|少校|awacs|戰術|指揮|overlord|攔截|預警|maj\.?\s*lin/.test(s)) {
      return OFFICERS.lin;
    }
    if (/陳語彤|塔台|管制|進場|離場|區管|atc|tower|approach|center|ground|chen/.test(s)) {
      return OFFICERS.chen;
    }
    if (/周振華|周教官|教官|機長|副駕駛|chou|capt|instructor|copilot/.test(s)) {
      return OFFICERS.chou;
    }
    return OFFICERS.chou;
  }

  let sharedAudioCtx = null;

  function playRadioBeep(tone) {
    try {
      if (typeof window === 'undefined') return false;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      if (!sharedAudioCtx) {
        sharedAudioCtx = new AudioCtx();
      }
      if (sharedAudioCtx.state === 'suspended') {
        sharedAudioCtx.resume().catch(() => {});
      }
      const ctx = sharedAudioCtx;
      const now = ctx.currentTime;

      const baseFreq = tone === 'alert' ? 1180 : tone === 'soft' ? 780 : 940;

      // Short filtered radio squelch burst
      const bufferSize = Math.floor(ctx.sampleRate * 0.045);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) * 0.14;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(1900, now);
      bandpass.Q.setValueAtTime(1.6, now);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.08, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
      noise.connect(bandpass);
      bandpass.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(now);

      // Crisp double-beep
      [0.035, 0.105].forEach((offset, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(idx === 0 ? baseFreq : baseFreq * 1.18, now + offset);
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.linearRampToValueAtTime(0.045, now + offset + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.055);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.06);
      });
      return true;
    } catch (_err) {
      return false;
    }
  }

  function ensureStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('missionCinematicsStyle')) return;
    const style = document.createElement('style');
    style.id = 'missionCinematicsStyle';
    style.textContent = `
      #missionCinemaOverlay {
        position: fixed;
        inset: 0;
        z-index: 99990;
        background: #04070f;
        color: #f8fafc;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        overflow: hidden;
        opacity: 0;
        transition: opacity 0.45s ease;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      #missionCinemaOverlay.mc-visible {
        opacity: 1;
      }
      #missionCinemaOverlay.mc-closing {
        opacity: 0;
        pointer-events: none;
      }
      .mc-bg-wrap {
        position: absolute;
        inset: 0;
        overflow: hidden;
        z-index: 0;
      }
      .mc-bg-img {
        position: absolute;
        inset: -6%;
        width: 112%;
        height: 112%;
        object-fit: cover;
        filter: brightness(0.46) contrast(1.12) saturate(1.1);
        animation: mcKenBurns 14s ease-in-out infinite alternate;
      }
      .mc-bg-vignette {
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at 50% 42%, rgba(8, 15, 30, 0.18), rgba(3, 6, 14, 0.88) 78%),
          linear-gradient(180deg, rgba(2, 6, 14, 0.85), rgba(2, 6, 14, 0.25) 35%, rgba(2, 6, 14, 0.92));
      }
      .mc-scanline {
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(180deg, transparent 0%, rgba(56, 189, 248, 0.14) 50%, transparent 100%);
        height: 22%;
        animation: mcRadarScan 4.2s linear infinite;
      }
      .mc-bar {
        position: relative;
        z-index: 2;
        height: 11vh;
        min-height: 62px;
        max-height: 108px;
        background: rgba(4, 7, 15, 0.94);
        border-color: rgba(148, 163, 184, 0.22);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 28px;
        box-sizing: border-box;
        transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .mc-bar-top {
        border-bottom: 1px solid rgba(148, 163, 184, 0.22);
        transform: translateY(-100%);
      }
      .mc-bar-bottom {
        border-top: 1px solid rgba(148, 163, 184, 0.22);
        transform: translateY(100%);
      }
      #missionCinemaOverlay.mc-visible .mc-bar-top,
      #missionCinemaOverlay.mc-visible .mc-bar-bottom {
        transform: translateY(0);
      }
      .mc-op-meta {
        display: flex;
        align-items: center;
        gap: 14px;
        min-width: 0;
      }
      .mc-code-badge {
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.14em;
        padding: 5px 10px;
        border-radius: 6px;
        background: rgba(56, 189, 248, 0.16);
        border: 1px solid rgba(56, 189, 248, 0.55);
        color: #7dd3fc;
        white-space: nowrap;
      }
      .mc-op-title {
        font-size: clamp(16px, 2.2vw, 24px);
        font-weight: 800;
        letter-spacing: 0.04em;
        color: #f8fafc;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .mc-telemetry {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 12px;
        letter-spacing: 0.08em;
        color: #94a3b8;
        text-align: right;
        white-space: nowrap;
      }
      .mc-stage {
        position: relative;
        z-index: 2;
        flex: 1;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        padding: 24px 28px 34px;
        box-sizing: border-box;
      }
      .mc-brief-card {
        width: min(860px, 100%);
        background: rgba(8, 14, 28, 0.86);
        border: 1px solid rgba(148, 163, 184, 0.28);
        border-left: 4px solid var(--mc-accent, #38bdf8);
        border-radius: 16px;
        padding: 20px 24px;
        display: flex;
        align-items: center;
        gap: 20px;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55);
        backdrop-filter: blur(12px);
        animation: mcSlideIn 0.42s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .mc-avatar {
        width: 86px;
        height: 86px;
        flex: 0 0 86px;
        border-radius: 14px;
        overflow: hidden;
        box-shadow: 0 0 24px rgba(0, 0, 0, 0.45);
      }
      .mc-avatar svg {
        width: 100%;
        height: 100%;
        display: block;
      }
      .mc-dialogue-col {
        flex: 1;
        min-width: 0;
      }
      .mc-officer-head {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 8px;
      }
      .mc-officer-name {
        font-size: 18px;
        font-weight: 800;
        color: var(--mc-accent, #38bdf8);
      }
      .mc-officer-role {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        color: #cbd5e1;
        background: rgba(255, 255, 255, 0.07);
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 999px;
        padding: 3px 10px;
      }
      .mc-wave {
        display: inline-flex;
        align-items: flex-end;
        gap: 3px;
        height: 16px;
        margin-left: auto;
      }
      .mc-wave span {
        width: 3px;
        height: 5px;
        border-radius: 2px;
        background: var(--mc-accent, #38bdf8);
        animation: mcWaveBar 0.9s ease-in-out infinite;
      }
      .mc-wave span:nth-child(2) { animation-delay: 0.14s; }
      .mc-wave span:nth-child(3) { animation-delay: 0.28s; }
      .mc-wave span:nth-child(4) { animation-delay: 0.42s; }
      .mc-wave span:nth-child(5) { animation-delay: 0.56s; }
      .mc-subtitle {
        font-size: clamp(15px, 1.7vw, 18px);
        line-height: 1.6;
        color: #f1f5f9;
        min-height: 2.9em;
      }
      .mc-beat-dots {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: #94a3b8;
      }
      .mc-dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: rgba(148, 163, 184, 0.35);
        transition: all 0.25s ease;
      }
      .mc-dot.active {
        width: 24px;
        background: var(--mc-accent, #38bdf8);
      }
      .mc-actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .mc-btn {
        border: 1px solid rgba(148, 163, 184, 0.35);
        background: rgba(15, 23, 42, 0.9);
        color: #f8fafc;
        font-size: 13px;
        font-weight: 700;
        padding: 10px 16px;
        border-radius: 10px;
        cursor: pointer;
        transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease;
      }
      .mc-btn:hover {
        transform: translateY(-1px);
        background: rgba(30, 41, 59, 0.96);
        border-color: rgba(148, 163, 184, 0.65);
      }
      .mc-btn-primary {
        background: linear-gradient(135deg, #0284c7, #2563eb);
        border-color: rgba(125, 211, 252, 0.65);
      }
      .mc-btn-primary:hover {
        background: linear-gradient(135deg, #0ea5e9, #3b82f6);
      }
      .mc-radio-enhanced {
        display: flex !important;
        align-items: center;
        gap: 12px;
        border-left: 3px solid var(--mc-accent, #38bdf8) !important;
      }
      .mc-radio-avatar {
        width: 48px;
        height: 48px;
        flex: 0 0 48px;
        border-radius: 10px;
        overflow: hidden;
      }
      .mc-radio-avatar svg {
        width: 100%;
        height: 100%;
        display: block;
      }
      .mc-radio-body {
        flex: 1;
        min-width: 0;
      }
      .mc-radio-top {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 3px;
      }
      .mc-radio-name {
        font-size: 13px;
        font-weight: 800;
        color: var(--mc-accent, #38bdf8);
      }
      .mc-radio-role {
        font-size: 10px;
        font-weight: 700;
        color: #cbd5e1;
        background: rgba(255, 255, 255, 0.08);
        padding: 1px 7px;
        border-radius: 999px;
      }
      .mc-radio-text {
        font-size: 13px;
        line-height: 1.45;
        color: #f8fafc;
      }
      @keyframes mcKenBurns {
        0% { transform: scale(1.02) translate3d(-1.5%, -1%, 0); }
        100% { transform: scale(1.12) translate3d(1.5%, 1%, 0); }
      }
      @keyframes mcRadarScan {
        0% { transform: translateY(-120%); }
        100% { transform: translateY(520%); }
      }
      @keyframes mcSlideIn {
        0% { opacity: 0; transform: translateY(18px) scale(0.985); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes mcWaveBar {
        0%, 100% { height: 4px; opacity: 0.45; }
        50% { height: 15px; opacity: 1; }
      }
      @media (max-width: 640px) {
        .mc-bar { padding: 0 14px; }
        .mc-telemetry { display: none; }
        .mc-brief-card { padding: 14px; gap: 12px; }
        .mc-avatar { width: 62px; height: 62px; flex-basis: 62px; }
        .mc-btn { padding: 8px 12px; font-size: 12px; }
      }
    `;
    document.head.appendChild(style);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildBeats(chapter) {
    if (chapter && Array.isArray(chapter.introBeats) && chapter.introBeats.length > 0) {
      return chapter.introBeats.map((b) => ({
        speaker: b.speaker || b.officer || '周教官',
        text: String(b.text || b.line || '').trim()
      })).filter((b) => b.text);
    }

    const beats = [];
    const story = chapter && (chapter.story || chapter.briefing || chapter.description);
    if (story) {
      beats.push({
        speaker: (chapter && (chapter.briefingOfficer || chapter.officer)) || '林嵐少校',
        text: String(story).trim()
      });
    }
    const firstRadio = chapter && Array.isArray(chapter.radio) && chapter.radio[0];
    if (firstRadio) {
      if (typeof firstRadio === 'string') {
        beats.push({ speaker: '周教官', text: firstRadio });
      } else if (firstRadio.text) {
        beats.push({
          speaker: firstRadio.speaker || '周教官',
          text: String(firstRadio.text).trim()
        });
      }
    }
    if (beats.length === 0) {
      beats.push({
        speaker: '周教官',
        text: `歡迎登機，準備執行「${(chapter && chapter.title) || '天空任務'}」。檢查儀表，準備起飛！`
      });
    }
    return beats;
  }

  function playIntro(chapter, onComplete) {
    const done = typeof onComplete === 'function' ? onComplete : function () {};
    if (typeof document === 'undefined' || !document.body) {
      done();
      return;
    }

    ensureStyles();

    const existing = document.getElementById('missionCinemaOverlay');
    if (existing) existing.remove();

    const ch = chapter || {};
    const beats = buildBeats(ch);
    const code = ch.code || (ch.id ? String(ch.id).toUpperCase() : 'EP.01');
    const title = ch.title || 'SKYBOUND OPERATION';
    const aircraft = ch.aircraft || ch.plane || 'TACTICAL JET';
    const route = ch.route || (ch.from && ch.to ? `${ch.from} → ${ch.to}` : 'GLOBAL AIRSPACE');
    const bgSrc = ch.image || 'assets/campaign/title-bg.jpg';

    const overlay = document.createElement('div');
    overlay.id = 'missionCinemaOverlay';
    overlay.innerHTML = `
      <div class="mc-bg-wrap">
        <img class="mc-bg-img" src="${escapeHtml(bgSrc)}" alt="" onerror="this.style.display='none'"/>
        <div class="mc-bg-vignette"></div>
        <div class="mc-scanline"></div>
      </div>
      <div class="mc-bar mc-bar-top">
        <div class="mc-op-meta">
          <span class="mc-code-badge">${escapeHtml(code)}</span>
          <div class="mc-op-title">${escapeHtml(title)}</div>
        </div>
        <div class="mc-telemetry">${escapeHtml(aircraft)} &nbsp;|&nbsp; ${escapeHtml(route)}</div>
      </div>
      <div class="mc-stage">
        <div class="mc-brief-card" id="mcBriefCard">
          <div class="mc-avatar" id="mcAvatar"></div>
          <div class="mc-dialogue-col">
            <div class="mc-officer-head">
              <span class="mc-officer-name" id="mcOfficerName"></span>
              <span class="mc-officer-role" id="mcOfficerRole"></span>
              <span class="mc-wave" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></span>
            </div>
            <div class="mc-subtitle" id="mcSubtitle"></div>
          </div>
        </div>
      </div>
      <div class="mc-bar mc-bar-bottom">
        <div class="mc-beat-dots" id="mcBeatDots"></div>
        <div class="mc-actions">
          <button type="button" class="mc-btn" id="mcNextBtn">▶ 下一句 (NEXT)</button>
          <button type="button" class="mc-btn mc-btn-primary" id="mcSkipBtn">🚀 立即升空 / 跳過動畫 (SKIP)</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    let beatIndex = 0;
    let typeTimer = null;
    let autoTimer = null;
    let closed = false;

    const cardEl = overlay.querySelector('#mcBriefCard');
    const avatarEl = overlay.querySelector('#mcAvatar');
    const nameEl = overlay.querySelector('#mcOfficerName');
    const roleEl = overlay.querySelector('#mcOfficerRole');
    const subEl = overlay.querySelector('#mcSubtitle');
    const dotsEl = overlay.querySelector('#mcBeatDots');
    const nextBtn = overlay.querySelector('#mcNextBtn');
    const skipBtn = overlay.querySelector('#mcSkipBtn');

    function clearTimers() {
      if (typeTimer) {
        clearInterval(typeTimer);
        typeTimer = null;
      }
      if (autoTimer) {
        clearTimeout(autoTimer);
        autoTimer = null;
      }
    }

    function finish() {
      if (closed) return;
      closed = true;
      clearTimers();
      overlay.classList.add('mc-closing');
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        done();
      }, 420);
    }

    function renderBeat(idx) {
      if (closed) return;
      if (idx >= beats.length) {
        finish();
        return;
      }
      clearTimers();
      beatIndex = idx;
      const beat = beats[idx];
      const officer = matchOfficer(beat.speaker);

      overlay.style.setProperty('--mc-accent', officer.accentColor);
      cardEl.style.animation = 'none';
      void cardEl.offsetWidth;
      cardEl.style.animation = '';

      avatarEl.innerHTML = officer.avatarSvg;
      nameEl.textContent = officer.name;
      roleEl.textContent = officer.role;
      subEl.textContent = '';

      dotsEl.innerHTML = beats.map((_, i) =>
        `<span class="mc-dot${i === idx ? ' active' : ''}"></span>`
      ).join('') + `<span>${idx + 1} / ${beats.length}</span>`;

      nextBtn.textContent = idx === beats.length - 1 ? '▶ 開始任務 (START)' : '▶ 下一句 (NEXT)';

      playRadioBeep(idx === 0 ? 'normal' : 'soft');

      const fullText = beat.text;
      let cursor = 0;
      const stepMs = Math.max(16, Math.min(34, Math.floor(1500 / Math.max(fullText.length, 1))));
      typeTimer = setInterval(() => {
        cursor += 1;
        subEl.textContent = fullText.slice(0, cursor);
        if (cursor >= fullText.length) {
          clearInterval(typeTimer);
          typeTimer = null;
        }
      }, stepMs);

      autoTimer = setTimeout(() => {
        renderBeat(beatIndex + 1);
      }, 3800);
    }

    nextBtn.addEventListener('click', () => renderBeat(beatIndex + 1));
    skipBtn.addEventListener('click', finish);

    requestAnimationFrame(() => {
      overlay.classList.add('mc-visible');
      renderBeat(0);
    });
  }

  function enhanceRadioBar(barEl, speaker, text) {
    if (typeof document === 'undefined' || !barEl) return;
    ensureStyles();

    const officer = matchOfficer(speaker);
    barEl.classList.add('mc-radio-enhanced');
    barEl.style.setProperty('--mc-accent', officer.accentColor);

    if (barEl._mcTypeTimer) {
      clearInterval(barEl._mcTypeTimer);
      barEl._mcTypeTimer = null;
    }

    barEl.innerHTML = `
      <div class="mc-radio-avatar">${officer.avatarSvg}</div>
      <div class="mc-radio-body">
        <div class="mc-radio-top">
          <span class="mc-radio-name">${escapeHtml(officer.name)}</span>
          <span class="mc-radio-role">${escapeHtml(officer.role)}</span>
          <span class="mc-wave" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></span>
        </div>
        <div class="mc-radio-text"></div>
      </div>
    `;

    const textEl = barEl.querySelector('.mc-radio-text');
    const fullText = String(text || '');
    playRadioBeep('soft');

    let i = 0;
    const stepMs = Math.max(14, Math.min(28, Math.floor(1100 / Math.max(fullText.length, 1))));
    barEl._mcTypeTimer = setInterval(() => {
      i += 1;
      textEl.textContent = fullText.slice(0, i);
      if (i >= fullText.length) {
        clearInterval(barEl._mcTypeTimer);
        barEl._mcTypeTimer = null;
      }
    }, stepMs);
  }

  return {
    OFFICERS,
    matchOfficer,
    playRadioBeep,
    playIntro,
    enhanceRadioBar
  };
});
