'use strict';
function makeFlightAudio(){
  let context, master, compressor, noiseBuffer, pinkNoiseBuffer;
  let fan, fanDetune, fanHarmonic, core, whine, n2Whine, subBass, tailRotor, stall;
  let roar, jetWash, abRoar, air, groundRoll;
  let roarFilter, washFilter, abFilter, windFilter, buzzFilter, rollFilter;
  let rotorPulse, rotorDepth, syncLfo, syncDepth;
  let level=.85, speaking=false, wasAfterburner=false, wasSupersonic=false, wasRunning=0, currentProfileId='';
  let spoolN1=0, lastUpdateTime=0;

  const ACOUSTIC_PROFILES={
    // 1. Lycoming IO-360 4-Cylinder Boxer Piston Prop (Cessna 172S)
    c172s:{
      kind:'piston',
      baseHz:36, rangeHz:78,
      harmonicRatio:2.0, harmonicType:'sawtooth', harmonicGain:0.095,
      coreRatio:1.5, coreGain:0.032,
      whineHz:0, whineGain:0,
      subRatio:0.5, subGain:0.11,
      pulseRateBase:14, pulseRateRange:34, pulseDepth:0.055,
      roarBaseHz:220, roarRangeHz:520, roarGain:0.16,
      buzzCenterHz:190, buzzQ:2.2
    },
    // 2. Turboshaft Helicopters (H6, UH-60M Black Hawk, AH-64E Apache, AW101 Merlin)
    sh6:{
      kind:'heli', blades:4,
      baseHz:24, rangeHz:48,
      harmonicRatio:2.0, harmonicType:'triangle', harmonicGain:0.055,
      coreRatio:3.2, coreGain:0.028,
      whineHz:1680, whineGain:0.022,
      subRatio:0.5, subGain:0.075,
      pulseRateBase:22, pulseRateRange:8, pulseDepth:0.075,
      tailRatio:4.6, tailGain:0.026,
      roarBaseHz:260, roarRangeHz:420, roarGain:0.18,
      buzzCenterHz:320, buzzQ:1.5
    },
    uh60:{
      kind:'heli', blades:4,
      baseHz:19, rangeHz:42,
      harmonicRatio:2.0, harmonicType:'sawtooth', harmonicGain:0.072,
      coreRatio:3.5, coreGain:0.034,
      whineHz:1480, whineGain:0.028,
      subRatio:0.5, subGain:0.115,
      pulseRateBase:17.2, pulseRateRange:5.5, pulseDepth:0.095,
      tailRatio:4.8, tailGain:0.034,
      roarBaseHz:210, roarRangeHz:390, roarGain:0.22,
      buzzCenterHz:280, buzzQ:1.8
    },
    ah64:{
      kind:'heli', blades:4,
      baseHz:20, rangeHz:44,
      harmonicRatio:2.0, harmonicType:'sawtooth', harmonicGain:0.078,
      coreRatio:3.8, coreGain:0.036,
      whineHz:1620, whineGain:0.032,
      subRatio:0.5, subGain:0.11,
      pulseRateBase:18.5, pulseRateRange:6.0, pulseDepth:0.092,
      tailRatio:5.1, tailGain:0.038,
      roarBaseHz:230, roarRangeHz:430, roarGain:0.23,
      buzzCenterHz:310, buzzQ:1.9
    },
    aw101:{
      kind:'heli', blades:5,
      baseHz:16, rangeHz:36,
      harmonicRatio:2.0, harmonicType:'triangle', harmonicGain:0.068,
      coreRatio:3.1, coreGain:0.035,
      whineHz:1320, whineGain:0.026,
      subRatio:0.5, subGain:0.135,
      pulseRateBase:15.2, pulseRateRange:4.8, pulseDepth:0.088,
      tailRatio:4.4, tailGain:0.028,
      roarBaseHz:185, roarRangeHz:350, roarGain:0.25,
      buzzCenterHz:250, buzzQ:1.6
    },
    // 3. Airbus A220-300 (PW1500G Geared Turbofan with signature "whale song" spool resonance)
    a223:{
      kind:'gtf',
      baseHz:96, rangeHz:195,
      harmonicRatio:1.5, harmonicType:'sawtooth', harmonicGain:0.065,
      coreRatio:2.45, coreGain:0.038,
      whineHz:340, whineGain:0.065,
      subRatio:0.5, subGain:0.065,
      roarBaseHz:380, roarRangeHz:820, roarGain:0.32,
      buzzCenterHz:420, buzzQ:3.2
    },
    // 4. Narrowbody CFM LEAP Turbofans (A320neo / 737 MAX 8)
    a320neo:{
      kind:'narrowbody',
      baseHz:104, rangeHz:210,
      harmonicRatio:1.5, harmonicType:'sawtooth', harmonicGain:0.072,
      coreRatio:2.62, coreGain:0.040,
      whineHz:1180, whineGain:0.018,
      subRatio:0.5, subGain:0.075,
      roarBaseHz:410, roarRangeHz:890, roarGain:0.35,
      buzzCenterHz:460, buzzQ:3.5
    },
    b38m:{
      kind:'narrowbody',
      baseHz:100, rangeHz:204,
      harmonicRatio:1.5, harmonicType:'sawtooth', harmonicGain:0.076,
      coreRatio:2.55, coreGain:0.042,
      whineHz:1120, whineGain:0.019,
      subRatio:0.5, subGain:0.080,
      roarBaseHz:395, roarRangeHz:870, roarGain:0.36,
      buzzCenterHz:445, buzzQ:3.6
    },
    // 5. Heavy Twin Widebody (777-300ER GE90-115B / 767-300ER CF6)
    b773:{
      kind:'widebody',
      baseHz:68, rangeHz:148,
      harmonicRatio:1.5, harmonicType:'sawtooth', harmonicGain:0.092,
      coreRatio:2.12, coreGain:0.045,
      whineHz:890, whineGain:0.016,
      subRatio:0.5, subGain:0.145,
      roarBaseHz:290, roarRangeHz:780, roarGain:0.44,
      buzzCenterHz:330, buzzQ:4.0
    },
    b763er:{
      kind:'widebody',
      baseHz:78, rangeHz:164,
      harmonicRatio:1.5, harmonicType:'sawtooth', harmonicGain:0.082,
      coreRatio:2.28, coreGain:0.042,
      whineHz:980, whineGain:0.020,
      subRatio:0.5, subGain:0.115,
      roarBaseHz:330, roarRangeHz:820, roarGain:0.39,
      buzzCenterHz:375, buzzQ:3.6
    },
    b763f:{
      kind:'widebody',
      baseHz:78, rangeHz:164,
      harmonicRatio:1.5, harmonicType:'sawtooth', harmonicGain:0.084,
      coreRatio:2.28, coreGain:0.042,
      whineHz:980, whineGain:0.020,
      subRatio:0.5, subGain:0.118,
      roarBaseHz:330, roarRangeHz:820, roarGain:0.40,
      buzzCenterHz:375, buzzQ:3.6
    },
    // 6. Quad-Engine Heavy Transports (747-8F GEnx / 747-400 / A380 / An-124)
    sf748:{
      kind:'quad',
      baseHz:72, rangeHz:154,
      harmonicRatio:1.5, harmonicType:'sawtooth', harmonicGain:0.088,
      coreRatio:2.18, coreGain:0.046,
      whineHz:920, whineGain:0.018,
      subRatio:0.5, subGain:0.150,
      roarBaseHz:280, roarRangeHz:760, roarGain:0.46,
      buzzCenterHz:345, buzzQ:3.8
    },
    b744:{
      kind:'quad',
      baseHz:75, rangeHz:160,
      harmonicRatio:1.5, harmonicType:'sawtooth', harmonicGain:0.090,
      coreRatio:2.24, coreGain:0.048,
      whineHz:960, whineGain:0.021,
      subRatio:0.5, subGain:0.145,
      roarBaseHz:295, roarRangeHz:790, roarGain:0.46,
      buzzCenterHz:360, buzzQ:3.8
    },
    sa380:{
      kind:'quad',
      baseHz:64, rangeHz:138,
      harmonicRatio:1.5, harmonicType:'triangle', harmonicGain:0.075,
      coreRatio:2.05, coreGain:0.040,
      whineHz:840, whineGain:0.015,
      subRatio:0.5, subGain:0.155,
      roarBaseHz:265, roarRangeHz:710, roarGain:0.44,
      buzzCenterHz:315, buzzQ:3.2
    },
    an124:{
      kind:'quad',
      baseHz:70, rangeHz:152,
      harmonicRatio:1.5, harmonicType:'sawtooth', harmonicGain:0.098,
      coreRatio:2.32, coreGain:0.052,
      whineHz:1060, whineGain:0.028,
      subRatio:0.5, subGain:0.160,
      roarBaseHz:275, roarRangeHz:810, roarGain:0.48,
      buzzCenterHz:340, buzzQ:4.1
    },
    // 7. Supersonic Fighters (F-16V / SF-16, Mirage 2000-5, F-CK-1 IDF, F-5E, SF-15)
    f16v:{
      kind:'fighter',
      baseHz:132, rangeHz:285,
      harmonicRatio:1.8, harmonicType:'sawtooth', harmonicGain:0.088,
      coreRatio:2.85, coreGain:0.058,
      whineHz:1420, whineGain:0.036,
      subRatio:0.5, subGain:0.125,
      roarBaseHz:520, roarRangeHz:1380, roarGain:0.48,
      buzzCenterHz:680, buzzQ:2.8
    },
    sf16:{
      kind:'fighter',
      baseHz:130, rangeHz:280,
      harmonicRatio:1.8, harmonicType:'sawtooth', harmonicGain:0.085,
      coreRatio:2.82, coreGain:0.056,
      whineHz:1390, whineGain:0.034,
      subRatio:0.5, subGain:0.120,
      roarBaseHz:510, roarRangeHz:1350, roarGain:0.46,
      buzzCenterHz:660, buzzQ:2.8
    },
    m2000:{
      kind:'fighter',
      baseHz:148, rangeHz:320,
      harmonicRatio:2.1, harmonicType:'sawtooth', harmonicGain:0.092,
      coreRatio:3.15, coreGain:0.064,
      whineHz:1760, whineGain:0.044,
      subRatio:0.5, subGain:0.115,
      roarBaseHz:590, roarRangeHz:1520, roarGain:0.47,
      buzzCenterHz:790, buzzQ:3.4
    },
    fck1:{
      kind:'fighter',
      baseHz:142, rangeHz:305,
      harmonicRatio:1.95, harmonicType:'sawtooth', harmonicGain:0.086,
      coreRatio:3.0, coreGain:0.060,
      whineHz:1640, whineGain:0.040,
      subRatio:0.5, subGain:0.112,
      roarBaseHz:560, roarRangeHz:1440, roarGain:0.45,
      buzzCenterHz:740, buzzQ:3.1
    },
    f5e:{
      kind:'fighter',
      baseHz:156, rangeHz:340,
      harmonicRatio:2.2, harmonicType:'sawtooth', harmonicGain:0.090,
      coreRatio:3.25, coreGain:0.062,
      whineHz:1890, whineGain:0.045,
      subRatio:0.5, subGain:0.105,
      roarBaseHz:610, roarRangeHz:1560, roarGain:0.44,
      buzzCenterHz:820, buzzQ:3.5
    },
    sf15:{
      kind:'fighter',
      baseHz:118, rangeHz:260,
      harmonicRatio:1.75, harmonicType:'sawtooth', harmonicGain:0.096,
      coreRatio:2.68, coreGain:0.058,
      whineHz:1280, whineGain:0.032,
      subRatio:0.5, subGain:0.150,
      roarBaseHz:460, roarRangeHz:1320, roarGain:0.52,
      buzzCenterHz:610, buzzQ:2.9
    },
    // 8. Twin-Engine Navy/Stealth Fighters (F/A-18C F404, F-14B F110, F-22 F119, F-35 F135, Su-57)
    fa18c:{
      kind:'fighter',
      baseHz:128, rangeHz:295,
      harmonicRatio:1.85, harmonicType:'sawtooth', harmonicGain:0.098,
      coreRatio:2.92, coreGain:0.064,
      whineHz:1540, whineGain:0.042,
      subRatio:0.5, subGain:0.145,
      roarBaseHz:490, roarRangeHz:1480, roarGain:0.54,
      buzzCenterHz:670, buzzQ:3.0
    },
    f14b:{
      kind:'fighter',
      baseHz:112, rangeHz:255,
      harmonicRatio:1.72, harmonicType:'sawtooth', harmonicGain:0.102,
      coreRatio:2.60, coreGain:0.060,
      whineHz:1240, whineGain:0.034,
      subRatio:0.5, subGain:0.165,
      roarBaseHz:430, roarRangeHz:1360, roarGain:0.56,
      buzzCenterHz:570, buzzQ:2.8
    },
    f22:{
      kind:'fighter',
      baseHz:122, rangeHz:290,
      harmonicRatio:1.82, harmonicType:'sawtooth', harmonicGain:0.095,
      coreRatio:2.88, coreGain:0.062,
      whineHz:1460, whineGain:0.038,
      subRatio:0.5, subGain:0.160,
      roarBaseHz:470, roarRangeHz:1500, roarGain:0.55,
      buzzCenterHz:640, buzzQ:3.1
    },
    // 9. Modern Composite Widebodies & Turboprops (A350 Trent XWB, 787 GEnx, ATR/C-130 Turboprop)
    a359:{
      kind:'widebody',
      baseHz:74, rangeHz:158,
      harmonicRatio:1.5, harmonicType:'sawtooth', harmonicGain:0.088,
      coreRatio:2.22, coreGain:0.042,
      whineHz:940, whineGain:0.018,
      subRatio:0.5, subGain:0.138,
      roarBaseHz:305, roarRangeHz:790, roarGain:0.43,
      buzzCenterHz:355, buzzQ:3.9
    },
    turboprop:{
      kind:'turboprop',
      baseHz:46, rangeHz:84,
      harmonicRatio:2.0, harmonicType:'sawtooth', harmonicGain:0.088,
      coreRatio:3.4, coreGain:0.036,
      whineHz:1860, whineGain:0.034,
      subRatio:0.5, subGain:0.120,
      pulseRateBase:19, pulseRateRange:28, pulseDepth:0.068,
      roarBaseHz:250, roarRangeHz:580, roarGain:0.24,
      buzzCenterHz:240, buzzQ:2.5
    }
  };

  function getProfile(f){
    const id=f?.aircraft?.id||'c172s';
    if(ACOUSTIC_PROFILES[id]) return ACOUSTIC_PROFILES[id];
    if(f?.aircraft?.helicopter) return ACOUSTIC_PROFILES.uh60;
    if(f?.aircraft?.role==='fighter') return (f?.aircraft?.geometry?.[4]===2)?ACOUSTIC_PROFILES.fa18c:ACOUSTIC_PROFILES.f16v;
    if(f?.aircraft?.role==='cargo') return (f?.aircraft?.jet===false)?ACOUSTIC_PROFILES.turboprop:ACOUSTIC_PROFILES.sf748;
    if(f?.aircraft?.jet&&(f?.aircraft?.geometry?.[4]===4)) return ACOUSTIC_PROFILES.b744;
    if(f?.aircraft?.jet&&(f?.aircraft?.geometry?.[1]||0)>2.2) return ACOUSTIC_PROFILES.b773;
    if(f?.aircraft?.jet) return ACOUSTIC_PROFILES.a320neo;
    if((f?.aircraft?.geometry?.[4]||1)>=2) return ACOUSTIC_PROFILES.turboprop;
    return ACOUSTIC_PROFILES.c172s;
  }

  function layer(source,filter){
    const gain=context.createGain();
    gain.gain.value=0;
    if(filter) source.connect(filter).connect(gain);
    else source.connect(gain);
    gain.connect(master);
    source.start();
    return gain.gain;
  }
  function tone(type,filter){
    const node=context.createOscillator();
    node.type=type;
    return {node,frequency:node.frequency,gain:layer(node,filter)};
  }
  function triggerAfterburnerIgnition(){
    if(!context||context.state!=='running') return;
    const now=context.currentTime;
    const thump=context.createOscillator(),tGain=context.createGain();
    thump.type='sine';
    thump.frequency.setValueAtTime(128,now);
    thump.frequency.exponentialRampToValueAtTime(32,now+0.30);
    tGain.gain.setValueAtTime(Math.min(0.72,0.54*level),now);
    tGain.gain.exponentialRampToValueAtTime(0.0001,now+0.36);
    thump.connect(tGain).connect(master);
    thump.start(now);thump.stop(now+0.38);
    if(pinkNoiseBuffer||noiseBuffer){
      const whoosh=context.createBufferSource(),wFilter=context.createBiquadFilter(),wGain=context.createGain();
      whoosh.buffer=pinkNoiseBuffer||noiseBuffer;
      wFilter.type='bandpass';
      wFilter.frequency.setValueAtTime(980,now);
      wFilter.frequency.exponentialRampToValueAtTime(320,now+0.38);
      wFilter.Q.value=1.0;
      wGain.gain.setValueAtTime(Math.min(0.62,0.44*level),now);
      wGain.gain.exponentialRampToValueAtTime(0.0001,now+0.42);
      whoosh.connect(wFilter).connect(wGain).connect(master);
      whoosh.start(now);whoosh.stop(now+0.44);
    }
  }
  function triggerSonicBoom(){
    if(!context||context.state!=='running') return;
    const now=context.currentTime;
    // Double N-wave pressure shock thump + crack
    for(const offset of [0, 0.085]){
      const boom=context.createOscillator(),bGain=context.createGain();
      boom.type='sine';
      boom.frequency.setValueAtTime(110,now+offset);
      boom.frequency.exponentialRampToValueAtTime(24,now+offset+0.42);
      bGain.gain.setValueAtTime(Math.min(0.85,0.68*level),now+offset);
      bGain.gain.exponentialRampToValueAtTime(0.0001,now+offset+0.48);
      boom.connect(bGain).connect(master);
      boom.start(now+offset);boom.stop(now+offset+0.50);
    }
    if(pinkNoiseBuffer||noiseBuffer){
      const crack=context.createBufferSource(),cFilt=context.createBiquadFilter(),cGain=context.createGain();
      crack.buffer=pinkNoiseBuffer||noiseBuffer;
      cFilt.type='lowpass';
      cFilt.frequency.setValueAtTime(1900,now);
      cFilt.frequency.exponentialRampToValueAtTime(110,now+0.55);
      cGain.gain.setValueAtTime(Math.min(0.75,0.58*level),now);
      cGain.gain.exponentialRampToValueAtTime(0.0001,now+0.60);
      crack.connect(cFilt).connect(cGain).connect(master);
      crack.start(now);crack.stop(now+0.62);
    }
  }
  function triggerEngineStart(isJet){
    if(!context||context.state!=='running') return;
    const now=context.currentTime;
    const spool=context.createOscillator(),sGain=context.createGain();
    spool.type=isJet?'sine':'sawtooth';
    spool.frequency.setValueAtTime(isJet?180:42,now);
    spool.frequency.exponentialRampToValueAtTime(isJet?1420:108,now+(isJet?1.6:0.7));
    sGain.gain.setValueAtTime(0.001,now);
    sGain.gain.linearRampToValueAtTime(Math.min(0.18,0.12*level),now+(isJet?0.75:0.25));
    sGain.gain.exponentialRampToValueAtTime(0.0001,now+(isJet?1.85:0.85));
    spool.connect(sGain).connect(master);
    spool.start(now);spool.stop(now+(isJet?1.9:0.9));
  }
  function start(){
    if(!context){
      const Audio=window.AudioContext||window.webkitAudioContext;
      if(!Audio) return false;
      try{context=new Audio();}catch{return false;}
      master=context.createGain();
      master.gain.value=level;
      if(typeof context.createDynamicsCompressor==='function'){
        compressor=context.createDynamicsCompressor();
        compressor.threshold.value=-14;
        compressor.knee.value=18;
        compressor.ratio.value=4.5;
        compressor.attack.value=0.004;
        compressor.release.value=0.16;
        master.connect(compressor).connect(context.destination);
      }else{
        master.connect(context.destination);
      }

      buzzFilter=context.createBiquadFilter();
      buzzFilter.type='bandpass';
      buzzFilter.frequency.value=420;
      buzzFilter.Q.value=3.0;

      fan=tone('triangle');
      fanDetune=tone('triangle');
      fanHarmonic=tone('sawtooth',buzzFilter);
      core=tone('sine');
      whine=tone('sine');
      n2Whine=tone('sine');
      subBass=tone('sine');
      tailRotor=tone('sawtooth');

      rotorPulse=context.createOscillator();
      rotorPulse.frequency.value=22;
      rotorDepth=context.createGain();
      rotorDepth.gain.value=0;
      rotorPulse.connect(rotorDepth).connect(fan.gain);
      rotorPulse.start();

      syncLfo=context.createOscillator();
      syncLfo.frequency.value=1.8;
      syncDepth=context.createGain();
      syncDepth.gain.value=0;
      syncLfo.connect(syncDepth).connect(fanHarmonic.gain);
      syncLfo.start();

      stall=tone('triangle');
      stall.frequency.value=830;

      const len=context.sampleRate*2;
      const buffer=context.createBuffer(1,len,context.sampleRate);
      noiseBuffer=buffer;
      const sample=buffer.getChannelData(0);
      for(let i=0;i<len;i++) sample[i]=Math.random()*2-1;

      // Paul Kellet warm pink-weighted noise for visceral deep jet exhaust & afterburner roar
      const pBuf=context.createBuffer(1,len,context.sampleRate);
      pinkNoiseBuffer=pBuf;
      const ps=pBuf.getChannelData(0);
      let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
      for(let i=0;i<len;i++){
        const w=sample[i];
        b0=0.99886*b0+w*0.0555179;
        b1=0.99332*b1+w*0.0750759;
        b2=0.96900*b2+w*0.1538520;
        b3=0.86650*b3+w*0.3104856;
        b4=0.55000*b4+w*0.5329522;
        b5=-0.7616*b5-w*0.0168980;
        ps[i]=Math.max(-1,Math.min(1,(b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.14));
        b6=w*0.115926;
      }

      function noise(buf,filter,offset){
        const source=context.createBufferSource();
        source.buffer=buf;source.loop=true;
        source.loopStart=offset;
        return layer(source,filter);
      }
      roarFilter=context.createBiquadFilter();
      roarFilter.type='lowpass';
      roarFilter.Q.value=.85;
      roar=noise(pinkNoiseBuffer,roarFilter,0);

      washFilter=context.createBiquadFilter();
      washFilter.type='bandpass';
      washFilter.frequency.value=180;
      washFilter.Q.value=.75;
      jetWash=noise(pinkNoiseBuffer,washFilter,.41);

      abFilter=context.createBiquadFilter();
      abFilter.type='bandpass';
      abFilter.frequency.value=640;
      abFilter.Q.value=.80;
      abRoar=noise(pinkNoiseBuffer,abFilter,.19);

      windFilter=context.createBiquadFilter();
      windFilter.type='bandpass';
      windFilter.Q.value=.65;
      air=noise(noiseBuffer,windFilter,.37);

      rollFilter=context.createBiquadFilter();
      rollFilter.type='lowpass';
      rollFilter.frequency.value=135;
      rollFilter.Q.value=1.4;
      groundRoll=noise(pinkNoiseBuffer,rollFilter,.63);
    }
    if(context.state!=='running') context.resume().catch(()=>{});
    return true;
  }
  function update(f,cockpit,enabled){
    if(!enabled) stopSpeech();
    if(!context) return;
    const engines=f?.engines??[];
    const runningCount=engines.filter(Boolean).length;
    const running=engines.length?runningCount/engines.length:0;
    const rawPower=f?.power||0;
    const t=context.currentTime;
    const dt=lastUpdateTime?Math.min(0.25,Math.max(0.008,t-lastUpdateTime)):0.033;
    lastUpdateTime=t;
    const prof=getProfile(f);
    const acId=f?.aircraft?.id||'c172s';
    if(acId!==currentProfileId){
      currentProfileId=acId;
      spoolN1=rawPower;
      wasRunning=runningCount;
      wasSupersonic=false;
      try{fanHarmonic.node.type=prof.harmonicType||'sawtooth';}catch{}
    }
    const helicopter=prof.kind==='heli'||Boolean(f?.aircraft?.helicopter);
    const piston=prof.kind==='piston';
    const turboprop=prof.kind==='turboprop';
    const fighter=prof.kind==='fighter';
    const gtf=prof.kind==='gtf';
    const quad=prof.kind==='quad';
    const multiEngine=(engines.length||f?.aircraft?.geometry?.[4]||1)>=2;

    if(runningCount>wasRunning&&enabled){
      triggerEngineStart(Boolean(f?.aircraft?.jet||fighter||turboprop));
    }
    wasRunning=runningCount;

    // Asymmetric turbine N1 spool inertia (realistic spool-up lag vs fighter quick snap)
    const targetN1=running>0?rawPower:0;
    const spoolRate=fighter?2.6:(piston||helicopter)?3.4:(quad||prof.kind==='widebody')?0.95:1.45;
    spoolN1+=(targetN1-spoolN1)*Math.min(1,dt*(targetN1>spoolN1?spoolRate:spoolRate*0.72));
    const power=Math.max(0,Math.min(1,spoolN1));

    const afterburner=Boolean((f?.boost||fighter)&&rawPower>.88&&running>0);
    if(afterburner&&!wasAfterburner&&enabled){
      triggerAfterburnerIgnition();
    }
    wasAfterburner=afterburner;

    const supersonic=Boolean(!f?.ground&&((f?.speed||0)>342));
    if(supersonic&&!wasSupersonic&&enabled&&fighter){
      triggerSonicBoom();
    }
    wasSupersonic=supersonic;

    const cockpitAtten=cockpit?0.56:1.0;
    const strength=enabled&&f?.fuel!==0?Math.sqrt(running)*cockpitAtten:0;
    const rpmFactor=helicopter?Math.max(0.05,f?.rotorRPM??1):power;

    // 1. Primary Fan / Prop Blade-Pass Frequency + Detuned Multi-Engine Acoustic Beating
    const fanHz=prof.baseHz+prof.rangeHz*rpmFactor;
    fan.frequency.setTargetAtTime(fanHz,t,.18);
    fan.gain.setTargetAtTime(strength*(helicopter?.18:(piston||turboprop)?.11+.09*power:.068+.092*power),t,.18);
    if(multiEngine&&!helicopter){
      const detuneOffset=quad?1.75:fighter?3.1:2.15;
      fanDetune.frequency.setTargetAtTime(fanHz+detuneOffset,t,.20);
      fanDetune.gain.setTargetAtTime(strength*(.038+.048*power),t,.20);
    }else{
      fanDetune.gain.setTargetAtTime(0,t,.20);
    }

    // 2. Harmonic Layer (Turbofan Supersonic Buzz-Saw / Piston Exhaust Bark / Rotor Slap Harmonic)
    const buzzSpool=(piston||turboprop)?(.38+.62*power):helicopter?(.3+.7*rpmFactor):Math.pow(Math.max(0,(power-.46)/.54),1.25);
    buzzFilter.frequency.setTargetAtTime(prof.buzzCenterHz*(0.75+0.72*power),t,.18);
    buzzFilter.Q.setTargetAtTime(prof.buzzQ||2.8,t,.22);
    fanHarmonic.frequency.setTargetAtTime(fanHz*(prof.harmonicRatio||1.5),t,.18);
    fanHarmonic.gain.setTargetAtTime(strength*(prof.harmonicGain||.075)*buzzSpool*1.15,t,.18);

    // 3. Core Compressor & Characteristic Whine (A220 Whale Song / Fighter Intake Scream / N2 Ramp Turbine Whine)
    core.frequency.setTargetAtTime(fanHz*(prof.coreRatio||2.5),t,.24);
    core.gain.setTargetAtTime(strength*(cockpit?.48:1)*((prof.coreGain||.038)*(.28+.72*power)),t,.22);

    if(!piston&&!helicopter){
      const n2Hz=(fighter?2250:1880)+power*(fighter?1650:1280);
      const n2Env=(0.45+0.55*Math.exp(-Math.pow((power-0.35)/0.38,2)));
      n2Whine.frequency.setTargetAtTime(n2Hz,t,.20);
      n2Whine.gain.setTargetAtTime(strength*(cockpit?.28:.75)*(fighter?0.022:0.014)*n2Env,t,.22);
    }else{
      n2Whine.gain.setTargetAtTime(0,t,.20);
    }

    if(gtf){
      // Famous A220 PW1500G hollow whale-song howl peaking between 25% and 68% throttle
      const whaleBell=Math.exp(-Math.pow((power-0.47)/0.16,2));
      whine.frequency.setTargetAtTime(275+165*power,t,.18);
      whine.gain.setTargetAtTime(strength*0.082*whaleBell,t,.18);
    }else if(prof.whineGain>0){
      const wHz=prof.whineHz*(0.68+0.55*rpmFactor);
      whine.frequency.setTargetAtTime(wHz,t,.22);
      whine.gain.setTargetAtTime(strength*(cockpit?.45:1)*prof.whineGain*(0.25+0.75*rpmFactor),t,.22);
    }else{
      whine.gain.setTargetAtTime(0,t,.20);
    }

    // 4. Sub-Bass Chest Rumble (Heavy Widebody GE90/GEnx, Twin F404/F110 Afterburner Sub-Thrum)
    const subHz=Math.max(26,fanHz*(prof.subRatio||0.5));
    subBass.frequency.setTargetAtTime(subHz,t,.22);
    const abSubBoost=afterburner?1.75:1.0;
    subBass.gain.setTargetAtTime(strength*(prof.subGain||.09)*(0.24+0.76*power)*abSubBoost,t,.20);

    // 5. Rotor Blade-Slap (Helicopter BVI load) / Prop Cylinder Pulse / Quad Engine Synchrophasing
    if(helicopter){
      const bankLoad=1+Math.min(1.2,Math.abs(f?.bank||0)*1.4+Math.abs(f?.pitch||0)*0.9);
      const pulseHz=Math.max(2,(prof.pulseRateBase||18)+(prof.pulseRateRange||6)*(f?.rotorRPM??1));
      rotorPulse.frequency.setTargetAtTime(pulseHz,t,.15);
      rotorDepth.gain.setTargetAtTime(strength*(prof.pulseDepth||.08)*bankLoad,t,.15);
      tailRotor.frequency.setTargetAtTime(fanHz*(prof.tailRatio||4.7),t,.18);
      tailRotor.gain.setTargetAtTime(strength*(prof.tailGain||.03)*(0.4+0.6*Math.abs(f?.yawRate||0)*3+0.5*rpmFactor),t,.18);
    }else if(piston||turboprop){
      const cylHz=Math.max(8,(prof.pulseRateBase||14)+(prof.pulseRateRange||34)*power);
      rotorPulse.frequency.setTargetAtTime(cylHz,t,.15);
      rotorDepth.gain.setTargetAtTime(strength*(prof.pulseDepth||.058),t,.15);
      tailRotor.gain.setTargetAtTime(0,t,.15);
    }else{
      rotorDepth.gain.setTargetAtTime(0,t,.20);
      tailRotor.gain.setTargetAtTime(0,t,.20);
    }
    syncLfo.frequency.setTargetAtTime(quad?1.75:fighter&&multiEngine?2.6:1.2,t,.28);
    syncDepth.gain.setTargetAtTime(strength*(quad?.024:multiEngine?.012:0),t,.24);

    // 6. Dual-Band Pink Jet Exhaust Roar + Deep Exhaust Wash + Afterburner / Reverse Thrust Tear
    const reverseActive=Boolean(f?.reverse||(f?.ground&&f?.aircraft?.reverse&&f?.manualControls?.brake&&(f?.speed||0)>18));
    const roarCutoff=(cockpit?prof.roarBaseHz*.68:prof.roarBaseHz)+power*(afterburner?prof.roarRangeHz*1.62:prof.roarRangeHz);
    roarFilter.frequency.setTargetAtTime(roarCutoff,t,.20);
    roar.setTargetAtTime(strength*((prof.roarGain||.38)*(.18+.82*power)*(afterburner?1.45:1)),t,.20);

    // Deep jet exhaust wash (chest-thumping 110..360Hz turbulent jet core)
    washFilter.frequency.setTargetAtTime((fighter?195:135)+power*(afterburner?240:155),t,.22);
    jetWash.setTargetAtTime(strength*(piston?0.06:helicopter?0.12:(fighter?0.36:0.30)*(.12+.88*power)*(afterburner?1.42:1)),t,.22);

    if(afterburner||reverseActive){
      const abIntensity=afterburner?Math.min(1,(rawPower-.86)/.14):0.72;
      abFilter.frequency.setTargetAtTime(afterburner?640+460*abIntensity:320,t,.14);
      abRoar.setTargetAtTime(strength*(afterburner?0.48*abIntensity:0.36),t,.14);
    }else{
      abRoar.setTargetAtTime(0,t,.18);
    }

    // 7. Dynamic Airframe Boundary-Layer Wind, Spoiler/Gear Buffet & High-G Buffet
    const gLoad=Math.max(0,Math.abs(f?.gForce||1)-1.35);
    const spd=f?.speed||0;
    const speedRatio=Math.min(1.5,spd/180);
    const dragBuffet=(!f?.ground&&spd>45)?((f?.spoilers||f?.airBrake?0.042:0)+(f?.gear?0.022:0))*Math.min(1,spd/120):0;
    windFilter.frequency.setTargetAtTime((cockpit?390:720)+speedRatio*360+gLoad*150-(f?.spoilers?180:0),t,.16);
    air.setTargetAtTime(enabled&&f?(cockpit?.54:1)*Math.min(.16,spd*.00055+gLoad*.022+dragBuffet):0,t,.16);

    // 8. Runway Ground-Roll Vibration
    const rollSpeed=f?.ground&&enabled?Math.min(1,spd/65):0;
    rollFilter.frequency.setTargetAtTime(85+rollSpeed*140,t,.12);
    groundRoll.setTargetAtTime(rollSpeed>0.04?(cockpit?.78:.52)*rollSpeed*0.18:0,t,.12);

    // 9. Stall Warning Horn
    const warning=enabled&&f?.stall&&!f.ground&&!f.ended;
    stall.gain.setTargetAtTime(warning&&Math.floor(t*6)%2===0?.095:0,t,.025);
  }
  function effect(frequency,volume){
    if(!context) return;
    const source=context.createOscillator(), gain=context.createGain();
    const now=context.currentTime;
    source.type='triangle';
    source.frequency.setValueAtTime(frequency,now);
    source.frequency.exponentialRampToValueAtTime(frequency*.53,now+.27);
    gain.gain.setValueAtTime(volume,now);
    gain.gain.exponentialRampToValueAtTime(.0001,now+.33);
    source.connect(gain).connect(master);
    source.start(now);source.stop(now+.34);
  }
  function radarTone(phase){
    if(context?.state!=='running') return;
    const beep=(frequency,delay)=>{
      const source=context.createOscillator(),gain=context.createGain();
      const at=context.currentTime+delay;
      source.type='sine';
      source.frequency.value=frequency;
      gain.gain.setValueAtTime(.0001,at);
      gain.gain.exponentialRampToValueAtTime(.10,at+.009);
      gain.gain.exponentialRampToValueAtTime(.0001,at+.105);
      source.connect(gain).connect(master);
      source.start(at);source.stop(at+.11);
    };
    if(phase==='lock'){
      beep(1200,0);beep(1480,.14);
    }else beep(phase==='acquire'?940:660,0);
  }
  function volume(value){
    level=value;
    if(master) master.gain.setTargetAtTime(value,context.currentTime,.03);
    if(!value) stopSpeech();
  }
  function gateChime(){
    effect(680,.095);
    effect(1019,.075);
  }
  function touchdown(sink){
    if(context?.state!=='running') return;
    const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
    const time=context.currentTime;
    source.buffer=noiseBuffer;
    filter.type='bandpass';
    filter.frequency.setValueAtTime(730,time);
    filter.frequency.exponentialRampToValueAtTime(220,time+.26);
    gain.gain.setValueAtTime(Math.min(.24,.095+Math.abs(sink)*.027),time);
    gain.gain.exponentialRampToValueAtTime(.001,time+.30);
    source.connect(filter).connect(gain).connect(master);
    source.start(time);source.stop(time+.31);
  }
  function crashExplosion(){
    if(!context||context.state!=='running') return;
    const now=context.currentTime;
    const sub=context.createOscillator(),subGain=context.createGain();
    sub.type='sine';
    sub.frequency.setValueAtTime(195,now);
    sub.frequency.exponentialRampToValueAtTime(22,now+.95);
    subGain.gain.setValueAtTime(Math.min(1,.95*level),now);
    subGain.gain.exponentialRampToValueAtTime(.0001,now+1.65);
    sub.connect(subGain).connect(master);
    sub.start(now);sub.stop(now+1.7);
    const crunch=context.createOscillator(),cGain=context.createGain();
    crunch.type='sawtooth';
    crunch.frequency.setValueAtTime(92,now);
    crunch.frequency.exponentialRampToValueAtTime(28,now+.45);
    cGain.gain.setValueAtTime(Math.min(1,.55*level),now);
    cGain.gain.exponentialRampToValueAtTime(.0001,now+.48);
    crunch.connect(cGain).connect(master);
    crunch.start(now);crunch.stop(now+.5);
    if(noiseBuffer){
      const snap=context.createBufferSource(),sFilter=context.createBiquadFilter(),sGain=context.createGain();
      snap.buffer=noiseBuffer;
      sFilter.type='bandpass';
      sFilter.frequency.setValueAtTime(1850,now);
      sFilter.Q.value=0.9;
      sGain.gain.setValueAtTime(Math.min(1,.85*level),now);
      sGain.gain.exponentialRampToValueAtTime(.0001,now+.35);
      snap.connect(sFilter).connect(sGain).connect(master);
      snap.start(now);snap.stop(now+.38);
      const blast=context.createBufferSource(),bFilter=context.createBiquadFilter(),bGain=context.createGain();
      blast.buffer=noiseBuffer;
      bFilter.type='lowpass';
      bFilter.frequency.setValueAtTime(2100,now);
      bFilter.frequency.exponentialRampToValueAtTime(68,now+2.8);
      bGain.gain.setValueAtTime(Math.min(1,1.0*level),now);
      bGain.gain.exponentialRampToValueAtTime(.0001,now+3.1);
      blast.connect(bFilter).connect(bGain).connect(master);
      blast.start(now);blast.stop(now+3.2);
    }
  }
  function callout(message,urgent=false){
    if(!window.speechSynthesis||!window.SpeechSynthesisUtterance||!level) return;
    if(speaking&&!urgent) return;
    if(speaking) stopSpeech();
    const phrase=new SpeechSynthesisUtterance(message);
    phrase.lang='en-US';phrase.rate=1.12;phrase.volume=level;
    phrase.onend=phrase.onerror=()=>{speaking=false;};
    speaking=true;
    window.speechSynthesis.speak(phrase);
  }
  function stopSpeech(){
    if(speaking){speaking=false;window.speechSynthesis.cancel();}
  }
  return {start,update,effect,radarTone,volume,gateChime,touchdown,crashExplosion,callout,stopSpeech,getProfile};
}
