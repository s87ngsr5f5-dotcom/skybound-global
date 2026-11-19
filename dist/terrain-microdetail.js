/*
 * SKYBOUND GLOBAL — Terrain Micro-PBR Texture & Shader System
 * Standalone, zero-dependency browser / Node-safe module.
 *
 * Synthesizes 4 seamless tileable 512x512 procedural PBR micro-detail textures
 * (grass, asphalt, rock, forest) in <40ms and injects a distance-adaptive,
 * anti-tiling, biome-classified micro-PBR + analytic finite-difference sun
 * micro-bump shader into Three.js MeshStandardMaterial terrain shaders.
 *
 * 100% WebGL 1 / WebGL 2 / iOS Safari / Desktop Chrome compatible (zero derivative extensions).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.TerrainMicroDetail = api;
  } else if (root && typeof root === 'object') {
    root.TerrainMicroDetail = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var TEX_SIZE = 512;
  var TEX_MASK = TEX_SIZE - 1;
  var PIXEL_COUNT = TEX_SIZE * TEX_SIZE;
  var TARGET_SRGB_MEAN = 136; // ~0.533 sRGB -> ~0.25 linear -> sqrt() == 0.500 exact neutral!

  // Little-endian check for fast 32-bit ABGR pixel writes
  var IS_LITTLE_ENDIAN = (function () {
    var b = new ArrayBuffer(4);
    new Uint32Array(b)[0] = 0x0a0b0c0d;
    return new Uint8Array(b)[0] === 0x0d;
  })();

  // Deterministic Mulberry32 PRNG (used for sparse toroidal strokes & flecks)
  function createRng(seed) {
    var s = seed >>> 0;
    return function next() {
      s = (s + 0x6d2b79f5) >>> 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) * 2.3283064365386963e-10;
    };
  }

  // Build a smooth seamless 256x256 periodic value-noise tile (0..255) from a gridSize x gridSize lattice.
  // Takes ~0.6ms and lets 512x512 generators sample arbitrary octaves & anisotropic scales in 1 lookup!
  function buildPeriodicTile256(gridSize, seed) {
    var s = seed | 0;
    var grid = new Int32Array(gridSize * gridSize);
    for (var i = 0; i < grid.length; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) | 0;
      grid[i] = (s >>> 24) & 255;
    }
    var step = 256 / gridSize;
    var mask = gridSize - 1;
    var curve = new Int32Array(step);
    for (var c = 0; c < step; c++) {
      var t = c / step;
      curve[c] = Math.round((t * t * (3.0 - 2.0 * t)) * 256);
    }

    var tile = new Uint8Array(65536);
    for (var gy = 0; gy < gridSize; gy++) {
      var row0 = gy * gridSize;
      var row1 = ((gy + 1) & mask) * gridSize;
      for (var dy = 0; dy < step; dy++) {
        var fy = curve[dy];
        var outRow = (gy * step + dy) << 8;
        var vCur = grid[row0] + (((grid[row1] - grid[row0]) * fy) >> 8);
        for (var gx = 0; gx < gridSize; gx++) {
          var nx = (gx + 1) & mask;
          var vNext = grid[row0 + nx] + (((grid[row1 + nx] - grid[row0 + nx]) * fy) >> 8);
          var diff = vNext - vCur;
          var baseX = outRow + gx * step;
          for (var dx = 0; dx < step; dx++) {
            tile[baseX + dx] = vCur + ((diff * curve[dx]) >> 8);
          }
          vCur = vNext;
        }
      }
    }
    return tile;
  }

  // Lazily built shared seamless noise bank (built once in ~1.5ms)
  var noiseBank = null;
  function getNoiseBank() {
    if (!noiseBank) {
      noiseBank = {
        t8: buildPeriodicTile256(8, 1013),
        t16: buildPeriodicTile256(16, 2027),
        t32: buildPeriodicTile256(32, 3037),
        t64: buildPeriodicTile256(64, 4049)
      };
    }
    return noiseBank;
  }

  function blendPixel(rgba, x, y, r, g, b, alpha256) {
    var idx = (((y & TEX_MASK) << 9) | (x & TEX_MASK)) << 2;
    var inv = 256 - alpha256;
    rgba[idx] = (rgba[idx] * inv + r * alpha256) >> 8;
    rgba[idx + 1] = (rgba[idx + 1] * inv + g * alpha256) >> 8;
    rgba[idx + 2] = (rgba[idx + 2] * inv + b * alpha256) >> 8;
  }

  // Fast stride check & mean shift only if drift > 3
  function calibrateMean(rgba, targetMean) {
    var sum = 0;
    var count = 0;
    for (var i = 0; i < rgba.length; i += 64) {
      sum += (rgba[i] * 77 + rgba[i + 1] * 150 + rgba[i + 2] * 29) >> 8;
      count++;
    }
    var shift = Math.round(targetMean - sum / count);
    if (shift >= -3 && shift <= 3) return;
    for (var j = 0; j < rgba.length; j += 4) {
      rgba[j] += shift;
      rgba[j + 1] += shift;
      rgba[j + 2] += shift;
    }
  }

  var ALPHA_PACK = (255 << 24);

  // Swap bytes in-place for big-endian hosts (rare; keeps inner loops branch-free)
  function fixEndianIfNeeded(rgba) {
    if (IS_LITTLE_ENDIAN) return;
    for (var i = 0; i < rgba.length; i += 4) {
      var r = rgba[i + 3], g = rgba[i + 2], b = rgba[i + 1];
      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
    }
  }

  // 1. GRASS: Multi-layered grass blades, turf fibers, tiny clover/soil flecks, natural organic grain
  function generateGrassPixels(nb) {
    var t8 = nb.t8, t32 = nb.t32, t64 = nb.t64;
    var rgba = new Uint8ClampedArray(PIXEL_COUNT * 4);
    var u32 = new Uint32Array(rgba.buffer);
    var lcg = 0x13579bdf | 0;

    for (var y = 0; y < TEX_SIZE; y++) {
      var rA = (y & 255) << 8;
      var rB = ((y + 73) & 255) << 8;
      var rV = ((y >> 1) & 255) << 8;
      var rH = (((y << 1) + 41) & 255) << 8;
      var rowPix = y << 9;

      for (var x = 0; x < TEX_SIZE; x++) {
        lcg = (Math.imul(lcg, 1664525) + 1013904223) | 0;
        var grain = (lcg >>> 24) & 255;

        var nMacro = t8[rA | (x & 255)];
        var nClump = t32[rB | ((x + 119) & 255)];
        var nV = t64[rV | (((x << 1) + 17) & 255)];
        var nH = t64[rH | (((x >> 1) + 91) & 255)];
        var blade = nV > nH ? ((nV * 5 + nH * 3) >> 3) : ((nH * 5 + nV * 3) >> 3);

        var h = (nMacro * 72 + nClump * 66 + blade * 66 + grain * 52) >> 8;
        var base = 136 + (((h - 128) * 212) >> 8);
        var soil = nClump < 74 ? ((74 - nClump) * 3) >> 3 : 0;
        var tip = h > 150 ? ((h - 150) >> 2) : 0;

        var r = base - 8 + tip + (soil >> 1);
        var g = base + 10 + (tip >> 1) - (soil >> 1);
        var b = base - 19 - soil;
        r = r < 0 ? 0 : (r > 255 ? 255 : r);
        g = g < 0 ? 0 : (g > 255 ? 255 : g);
        b = b < 0 ? 0 : (b > 255 ? 255 : b);

        u32[rowPix + x] = ALPHA_PACK | (b << 16) | (g << 8) | r;
      }
    }
    fixEndianIfNeeded(rgba);

    // Toroidal crisp grass blade strokes & clover/soil flecks
    var rng = createRng(119);
    for (var k = 0; k < 4200; k++) {
      var bx = (rng() * TEX_SIZE) | 0;
      var by = (rng() * TEX_SIZE) | 0;
      var len = 2 + ((rng() * 5) | 0);
      var dx = rng() < 0.55 ? (rng() < 0.5 ? -1 : 1) : 0;
      var dy = rng() < 0.72 ? (rng() < 0.5 ? -1 : 1) : 0;
      if (dx === 0 && dy === 0) dy = 1;
      var tone = rng();
      var br, bg, bb, ba;
      if (tone > 0.56) {
        br = (198 + rng() * 38) | 0; bg = (218 + rng() * 34) | 0; bb = (148 + rng() * 28) | 0; ba = 142;
      } else if (tone > 0.18) {
        br = (38 + rng() * 24) | 0; bg = (58 + rng() * 28) | 0; bb = (30 + rng() * 18) | 0; ba = 148;
      } else {
        br = (110 + rng() * 28) | 0; bg = (92 + rng() * 22) | 0; bb = (58 + rng() * 18) | 0; ba = 128;
      }
      for (var s = 0; s < len; s++) {
        blendPixel(rgba, bx + dx * s, by + dy * s, br, bg, bb, ((ba * (len - s)) / (len + 1)) | 0);
      }
    }

    calibrateMean(rgba, TARGET_SRGB_MEAN);
    return rgba;
  }

  // 2. ASPHALT: Crisp mineral asphalt aggregate, subtle concrete slab joint lines, fine tarmac speckle, micro-paver grain
  function generateAsphaltPixels(nb) {
    var t8 = nb.t8, t32 = nb.t32, t64 = nb.t64;
    var rgba = new Uint8ClampedArray(PIXEL_COUNT * 4);
    var u32 = new Uint32Array(rgba.buffer);
    var lcg = 0x2468ace1 | 0;

    for (var y = 0; y < TEX_SIZE; y++) {
      var rA = ((y + 37) & 255) << 8;
      var rB = ((y + 151) & 255) << 8;
      var rC = (((y << 1) + 89) & 255) << 8;
      var dyJoint = y & 255;
      if (dyJoint > 128) dyJoint = 256 - dyJoint;
      var subY = y & 127;
      var rowPix = y << 9;

      for (var x = 0; x < TEX_SIZE; x++) {
        lcg = (Math.imul(lcg, 1664525) + 1013904223) | 0;
        var g1 = (lcg >>> 24) & 255;
        var g2 = (lcg >>> 16) & 255;

        var nA = t8[rA | ((x + 61) & 255)];
        var nB = t32[rB | ((x + 193) & 255)];
        var nC = t64[rC | (((x << 1) + 29) & 255)];

        var sparkle = g1 > 222 ? 54 : (g1 < 34 ? -52 : 0);
        var h = (nA * 62 + nB * 62 + nC * 56 + ((g1 * 5 + g2 * 3) >> 3) * 76) >> 8;
        var val = 132 + (((h - 128) * 166) >> 8) + sparkle;

        var dxJoint = x & 255;
        if (dxJoint > 128) dxJoint = 256 - dxJoint;
        var jd = dxJoint < dyJoint ? dxJoint : dyJoint;
        if (jd === 0) val -= 46 + (g1 >> 4);
        else if (jd === 1) val -= 16;
        else if (jd === 2) val += 12;
        if (subY === 0 || (x & 127) === 0) val -= 11;

        var tint = (g2 - 128) >> 4;
        var r = val + tint;
        var g = val;
        var b = val - tint;
        r = r < 0 ? 0 : (r > 255 ? 255 : r);
        g = g < 0 ? 0 : (g > 255 ? 255 : g);
        b = b < 0 ? 0 : (b > 255 ? 255 : b);

        u32[rowPix + x] = ALPHA_PACK | (b << 16) | (g << 8) | r;
      }
    }
    fixEndianIfNeeded(rgba);

    var rng = createRng(219);
    for (var k = 0; k < 2200; k++) {
      var px = (rng() * TEX_SIZE) | 0;
      var py = (rng() * TEX_SIZE) | 0;
      var v = (rng() > 0.45 ? (194 + rng() * 52) : (42 + rng() * 34)) | 0;
      blendPixel(rgba, px, py, v + 3, v, v - 3, 166);
    }
    for (var f = 0; f < 16; f++) {
      var fx = (rng() * TEX_SIZE) | 0;
      var fy = (rng() * TEX_SIZE) | 0;
      var steps = 20 + ((rng() * 34) | 0);
      var dirX = rng() < 0.5 ? 1 : -1;
      for (var s = 0; s < steps; s++) {
        blendPixel(rgba, fx, fy, 38, 38, 40, 140);
        blendPixel(rgba, fx, fy + 1, 174, 172, 168, 52);
        fx += dirX;
        if (rng() < 0.35) fy += rng() < 0.5 ? -1 : 1;
      }
    }

    calibrateMean(rgba, TARGET_SRGB_MEAN);
    return rgba;
  }

  // 3. ROCK: Stratified fractured granite ridges, rocky gravel scree, dark crevices, mineral grit
  function generateRockPixels(nb) {
    var t8 = nb.t8, t16 = nb.t16, t32 = nb.t32, t64 = nb.t64;
    var rgba = new Uint8ClampedArray(PIXEL_COUNT * 4);
    var u32 = new Uint32Array(rgba.buffer);
    var lcg = 0x369cf258 | 0;

    for (var y = 0; y < TEX_SIZE; y++) {
      var rWarp = ((y + 109) & 255) << 8;
      var rRidge = ((y + 43) & 255) << 8;
      var rScree = (((y << 1) + 17) & 255) << 8;
      var rowPix = y << 9;

      for (var x = 0; x < TEX_SIZE; x++) {
        lcg = (Math.imul(lcg, 1664525) + 1013904223) | 0;
        var grain = (lcg >>> 24) & 255;

        // Geological folded strata (warped y index, compressed vertically for layered rock beds)
        var nw = t8[rWarp | ((x + 13) & 255)];
        var wy = (((y << 1) + (((nw - 128) * 44) >> 8)) & 255) << 8;
        var ns = t32[wy | (((x >> 1) + 67) & 255)];

        // Sharp fractured granite ridges
        var nrDiff = t16[rRidge | ((x + 173) & 255)] - 128;
        var nrLin = 255 - ((nrDiff < 0 ? -nrDiff : nrDiff) << 1);
        var nr = (nrLin * nrLin) >> 8;

        var nScree = t64[rScree | (((x << 1) + 131) & 255)];
        var crevice = nr < 62 ? (((62 - nr) * 195) >> 8) : 0;
        var h = (ns * 88 + nr * 82 + nScree * 50 + grain * 36) >> 8;
        var val = 136 + (((h - 128) * 218) >> 8) - crevice;

        var warm = (ns - 128) >> 3;
        var quartz = grain > 232 ? 46 : 0;
        var r = val + warm + quartz;
        var g = val + (warm >> 1) + quartz;
        var b = val - warm + quartz;
        r = r < 0 ? 0 : (r > 255 ? 255 : r);
        g = g < 0 ? 0 : (g > 255 ? 255 : g);
        b = b < 0 ? 0 : (b > 255 ? 255 : b);

        u32[rowPix + x] = ALPHA_PACK | (b << 16) | (g << 8) | r;
      }
    }
    fixEndianIfNeeded(rgba);

    var rng = createRng(319);
    for (var k = 0; k < 1800; k++) {
      var sx = (rng() * TEX_SIZE) | 0;
      var sy = (rng() * TEX_SIZE) | 0;
      var v = (rng() > 0.42 ? (184 + rng() * 54) : (32 + rng() * 34)) | 0;
      blendPixel(rgba, sx, sy, v + 4, v + 1, v - 4, 158);
      blendPixel(rgba, sx + 1, sy, v + 2, v, v - 3, 102);
      blendPixel(rgba, sx, sy + 1, v - 18, v - 18, v - 15, 92);
    }

    calibrateMean(rgba, TARGET_SRGB_MEAN);
    return rgba;
  }

  // 4. FOREST: Rich mottled canopy leaf clusters, mossy forest floor, pine needle texture, dappled shadow contrast
  function generateForestPixels(nb) {
    var t16 = nb.t16, t32 = nb.t32, t64 = nb.t64;
    var rgba = new Uint8ClampedArray(PIXEL_COUNT * 4);
    var u32 = new Uint32Array(rgba.buffer);
    var lcg = 0x5a5a5a5b | 0;

    for (var y = 0; y < TEX_SIZE; y++) {
      var rC1 = ((y + 191) & 255) << 8;
      var rC2 = ((y + 83) & 255) << 8;
      var rL1 = (((y << 1) + 59) & 255) << 8;
      var rowPix = y << 9;

      for (var x = 0; x < TEX_SIZE; x++) {
        lcg = (Math.imul(lcg, 1664525) + 1013904223) | 0;
        var grain = (lcg >>> 24) & 255;

        // Transpose x/y on one octave so forest crowns never correlate with grass/rock
        var nC1 = t16[rC1 | ((x + 211) & 255)];
        var nC2 = t32[(((x + 47) & 255) << 8) | ((y + 83) & 255)];
        var nLeaf = t64[rL1 | (((x << 1) + 107) & 255)];
        var nMoss = t32[rC2 | ((x + 139) & 255)];

        var crown = (nC1 + nC2) >> 1;
        var shadowGap = crown < 104 ? (((104 - crown) * 168) >> 8) : 0;
        var sunlitTop = crown > 152 ? (((crown - 152) * 148) >> 8) : 0;

        var h = (crown * 108 + nMoss * 62 + nLeaf * 50 + grain * 36) >> 8;
        var val = 136 + (((h - 128) * 198) >> 8) - shadowGap + sunlitTop;

        var r = val - 13 + (sunlitTop >> 2);
        var g = val + 15 + (sunlitTop >> 3);
        var b = val - 19 - (shadowGap >> 3);
        r = r < 0 ? 0 : (r > 255 ? 255 : r);
        g = g < 0 ? 0 : (g > 255 ? 255 : g);
        b = b < 0 ? 0 : (b > 255 ? 255 : b);

        u32[rowPix + x] = ALPHA_PACK | (b << 16) | (g << 8) | r;
      }
    }
    fixEndianIfNeeded(rgba);

    var rng = createRng(419);
    for (var k = 0; k < 3400; k++) {
      var lx = (rng() * TEX_SIZE) | 0;
      var ly = (rng() * TEX_SIZE) | 0;
      var t = rng();
      var lr, lg, lb, la;
      if (t > 0.60) {
        lr = (176 + rng() * 40) | 0; lg = (208 + rng() * 36) | 0; lb = (132 + rng() * 24) | 0; la = 134;
      } else if (t > 0.22) {
        lr = (28 + rng() * 20) | 0; lg = (48 + rng() * 26) | 0; lb = (24 + rng() * 18) | 0; la = 144;
      } else {
        lr = (104 + rng() * 26) | 0; lg = (92 + rng() * 22) | 0; lb = (58 + rng() * 18) | 0; la = 112;
      }
      blendPixel(rgba, lx, ly, lr, lg, lb, la);
      blendPixel(rgba, lx + 1, ly, lr, lg, lb, la >> 1);
      blendPixel(rgba, lx, ly + 1, lr, lg, lb, la >> 1);
    }

    calibrateMean(rgba, TARGET_SRGB_MEAN);
    return rgba;
  }

  // Wrap RGBA Uint8ClampedArray into a configured THREE.CanvasTexture (browser)
  // or THREE.DataTexture / descriptor fallback (headless Node).
  function buildThreeTexture(THREE, renderer, rgba) {
    var maxAniso = 4;
    if (renderer && renderer.capabilities && typeof renderer.capabilities.getMaxAnisotropy === 'function') {
      maxAniso = renderer.capabilities.getMaxAnisotropy();
    }
    var anisotropy = Math.min(16, Math.max(1, maxAniso | 0));
    var tex = null;

    if (typeof document !== 'undefined' && document && typeof document.createElement === 'function') {
      var canvas = document.createElement('canvas');
      canvas.width = TEX_SIZE;
      canvas.height = TEX_SIZE;
      var ctx = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
      if (ctx && typeof ctx.createImageData === 'function' && typeof ctx.putImageData === 'function') {
        var imgData = ctx.createImageData(TEX_SIZE, TEX_SIZE);
        imgData.data.set(rgba);
        ctx.putImageData(imgData, 0, 0);
        if (THREE && typeof THREE.CanvasTexture === 'function') {
          tex = new THREE.CanvasTexture(canvas);
        } else {
          tex = { isTexture: true, isCanvasTexture: true, image: canvas };
        }
      }
    }

    if (!tex) {
      var bytes = new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength);
      if (THREE && typeof THREE.DataTexture === 'function') {
        tex = new THREE.DataTexture(bytes, TEX_SIZE, TEX_SIZE, THREE.RGBAFormat);
      } else {
        tex = {
          isTexture: true,
          image: { width: TEX_SIZE, height: TEX_SIZE, data: bytes }
        };
      }
    }

    if (THREE) {
      if (THREE.RepeatWrapping !== undefined) {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
      }
      if (THREE.SRGBColorSpace !== undefined) {
        tex.colorSpace = THREE.SRGBColorSpace;
      }
      if (THREE.LinearMipmapLinearFilter !== undefined) {
        tex.minFilter = THREE.LinearMipmapLinearFilter;
      }
      if (THREE.LinearFilter !== undefined) {
        tex.magFilter = THREE.LinearFilter;
      }
    }
    tex.anisotropy = anisotropy;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
  }

  /**
   * Generates 4 seamless tileable 512x512 procedural PBR micro-detail textures:
   * { grass, asphalt, rock, forest }
   */
  function createTextures(THREE, renderer) {
    var nb = getNoiseBank();
    return {
      grass: buildThreeTexture(THREE, renderer, generateGrassPixels(nb)),
      asphalt: buildThreeTexture(THREE, renderer, generateAsphaltPixels(nb)),
      rock: buildThreeTexture(THREE, renderer, generateRockPixels(nb)),
      forest: buildThreeTexture(THREE, renderer, generateForestPixels(nb))
    };
  }

  /**
   * Pure GLSL fragment snippet for distance-adaptive, biome-classified micro-PBR
   * surface synthesis + analytic finite-difference directional sun micro-bump.
   * Uses ZERO #extension derivative calls (100% WebGL1/WebGL2/iOS/Desktop safe).
   *
   * Declares `tmdRoughnessTarget` and `tmdRoughnessMix` in enclosing scope so
   * `applyRoughnessGLSL()` can modulate `roughnessFactor` per biome.
   */
  function applyMicroDetailGLSL() {
    return [
      '/* TerrainMicroDetail_v1 */',
      'float tmdRoughnessTarget = 0.90;',
      'float tmdRoughnessMix = 0.0;',
      '{',
      '  float tmdCamDist = length(vViewPosition);',
      '  float tmdMidW = 1.0 - smoothstep(550.0, 3800.0, tmdCamDist);',
      '  float tmdIsWater = smoothstep(1.22, 1.48, diffuseColor.b / max(0.05, diffuseColor.r)) * smoothstep(0.18, 0.35, diffuseColor.b);',
      '  float tmdLandMask = 1.0 - tmdIsWater;',
      '  if (tmdMidW > 0.004 && tmdLandMask > 0.004) {',
      '    float tmdNearW = 1.0 - smoothstep(45.0, 520.0, tmdCamDist);',
      '    float tmdMicroW = 1.0 - smoothstep(10.0, 140.0, tmdCamDist);',
      '    vec3 tmdSat = diffuseColor.rgb;',
      '    vec3 tmdWorldN = normalize(vTerrainWorldNormal + vec3(0.0, 0.0001, 0.0));',
      '    float tmdSlope = 1.0 - clamp(tmdWorldN.y, 0.0, 1.0);',
      '    float tmdGreenness = tmdSat.g - max(tmdSat.r, tmdSat.b);',
      '    float tmdLum = dot(tmdSat, vec3(0.299, 0.587, 0.114));',
      '    float tmdSlopeRock = smoothstep(0.14, 0.38, tmdSlope);',
      '    float tmdElevRock = smoothstep(680.0, 1400.0, terrainWorldPos.y);',
      '    float tmdWRock = clamp(max(tmdSlopeRock, tmdElevRock * 0.85), 0.0, 1.0);',
      '    float tmdWForest = smoothstep(0.015, 0.09, tmdGreenness) * (1.0 - smoothstep(0.18, 0.42, tmdLum));',
      '    float tmdWGrass = smoothstep(0.01, 0.075, tmdGreenness) * smoothstep(0.16, 0.38, tmdLum);',
      '    float tmdWSand = smoothstep(0.03, 0.12, tmdSat.r - tmdSat.b) * smoothstep(0.32, 0.58, tmdLum) * (1.0 - smoothstep(0.02, 0.08, tmdGreenness));',
      '    float tmdNonRockScale = 1.0 - tmdWRock * 0.85;',
      '    tmdWForest *= tmdNonRockScale;',
      '    tmdWGrass *= tmdNonRockScale;',
      '    tmdWSand *= tmdNonRockScale;',
      '    float tmdWUrban = clamp(1.0 - (tmdWRock + tmdWForest + tmdWGrass + tmdWSand), 0.0, 1.0);',
      '    float tmdWSum = max(0.0001, tmdWRock + tmdWForest + tmdWGrass + tmdWSand + tmdWUrban);',
      '    tmdWRock /= tmdWSum;',
      '    tmdWForest /= tmdWSum;',
      '    tmdWGrass /= tmdWSum;',
      '    tmdWSand /= tmdWSum;',
      '    tmdWUrban /= tmdWSum;',
      '    mat2 tmdRotNear = mat2(0.8, -0.6, 0.6, 0.8);',
      '    mat2 tmdRotMicro = mat2(0.6, 0.8, -0.8, 0.6);',
      '    vec2 tmdUvMid = terrainXZ * 0.028;',
      '    vec2 tmdUvNear = tmdRotNear * (terrainXZ * 0.18) + vec2(0.37, 0.71);',
      '    vec2 tmdUvMicro = tmdRotMicro * (terrainXZ * 0.65) + vec2(0.19, 0.53);',
      '    float tmdCliffBlend = smoothstep(0.24, 0.62, tmdSlope) * 0.55;',
      '    vec2 tmdRockUvMid = mix(tmdUvMid, vec2((terrainXZ.x + terrainXZ.y) * 0.020, terrainWorldPos.y * 0.032), tmdCliffBlend);',
      '    vec2 tmdRockUvNear = mix(tmdUvNear, vec2((terrainXZ.x - terrainXZ.y) * 0.13, terrainWorldPos.y * 0.21) + vec2(0.37, 0.71), tmdCliffBlend);',
      '    vec2 tmdRockUvMicro = mix(tmdUvMicro, vec2((terrainXZ.x + terrainXZ.y) * 0.45, terrainWorldPos.y * 0.72) + vec2(0.19, 0.53), tmdCliffBlend);',
      '    vec3 tmdGMid = sqrt(max(texture2D(microGrassTex, tmdUvMid).rgb, vec3(0.0004)));',
      '    vec3 tmdAMid = sqrt(max(texture2D(microAsphaltTex, tmdUvMid).rgb, vec3(0.0004)));',
      '    vec3 tmdRMid = sqrt(max(texture2D(microRockTex, tmdRockUvMid).rgb, vec3(0.0004)));',
      '    vec3 tmdFMid = sqrt(max(texture2D(microForestTex, tmdUvMid).rgb, vec3(0.0004)));',
      '    vec3 tmdSMid = mix(tmdAMid, tmdRMid, 0.42);',
      '    vec3 tmdDetail = tmdGMid * tmdWGrass + tmdAMid * tmdWUrban + tmdRMid * tmdWRock + tmdFMid * tmdWForest + tmdSMid * tmdWSand;',
      '    float tmdHeightCenter = dot(tmdDetail, vec3(0.299, 0.587, 0.114));',
      '    float tmdMicroRelief = 0.0;',
      '    float tmdMicroGrain = tmdHeightCenter;',
      '    if (tmdNearW > 0.004) {',
      '      vec3 tmdGNear = sqrt(max(texture2D(microGrassTex, tmdUvNear).rgb, vec3(0.0004)));',
      '      vec3 tmdANear = sqrt(max(texture2D(microAsphaltTex, tmdUvNear).rgb, vec3(0.0004)));',
      '      vec3 tmdRNear = sqrt(max(texture2D(microRockTex, tmdRockUvNear).rgb, vec3(0.0004)));',
      '      vec3 tmdFNear = sqrt(max(texture2D(microForestTex, tmdUvNear).rgb, vec3(0.0004)));',
      '      vec3 tmdSNear = mix(tmdANear, tmdRNear, 0.35);',
      '      vec3 tmdNearCol = tmdGNear * tmdWGrass + tmdANear * tmdWUrban + tmdRNear * tmdWRock + tmdFNear * tmdWForest + tmdSNear * tmdWSand;',
      '      float tmdNearH = dot(tmdNearCol, vec3(0.299, 0.587, 0.114));',
      '      tmdDetail = clamp(tmdDetail + (tmdNearCol - vec3(0.5)) * (0.95 * tmdNearW), 0.04, 0.98);',
      '      tmdHeightCenter = mix(tmdHeightCenter, tmdNearH, 0.65 * tmdNearW);',
      '      tmdMicroGrain = tmdNearH;',
      '      vec3 tmdSunN = normalize(seaSunDir + vec3(0.0001, 0.0001, 0.0));',
      '      vec2 tmdSunXZ = normalize(tmdSunN.xz + vec2(0.0001, 0.0));',
      '      vec2 tmdBumpOffNear = (tmdRotNear * tmdSunXZ) * 0.0075;',
      '      vec2 tmdBumpOffRock = mix(tmdBumpOffNear, vec2((tmdSunXZ.x - tmdSunXZ.y) * 0.0065, tmdSunN.y * 0.009), tmdCliffBlend);',
      '      float tmdHGN = dot(sqrt(max(texture2D(microGrassTex, tmdUvNear + tmdBumpOffNear).rgb, vec3(0.0004))), vec3(0.299, 0.587, 0.114));',
      '      float tmdHAN = dot(sqrt(max(texture2D(microAsphaltTex, tmdUvNear + tmdBumpOffNear).rgb, vec3(0.0004))), vec3(0.299, 0.587, 0.114));',
      '      float tmdHRN = dot(sqrt(max(texture2D(microRockTex, tmdRockUvNear + tmdBumpOffRock).rgb, vec3(0.0004))), vec3(0.299, 0.587, 0.114));',
      '      float tmdHFN = dot(sqrt(max(texture2D(microForestTex, tmdUvNear + tmdBumpOffNear).rgb, vec3(0.0004))), vec3(0.299, 0.587, 0.114));',
      '      float tmdHSN = mix(tmdHAN, tmdHRN, 0.35);',
      '      float tmdNearHStep = tmdHGN * tmdWGrass + tmdHAN * tmdWUrban + tmdHRN * tmdWRock + tmdHFN * tmdWForest + tmdHSN * tmdWSand;',
      '      float tmdSunElev = clamp(tmdSunN.y * 2.4 + 0.22, 0.0, 1.0);',
      '      float tmdGrazing = mix(1.35, 0.78, clamp(tmdSunN.y, 0.0, 1.0));',
      '      float tmdBiomeBumpGain = tmdWGrass * 1.45 + tmdWUrban * 1.05 + tmdWRock * 2.15 + tmdWForest * 1.85 + tmdWSand * 1.15;',
      '      tmdMicroRelief += (tmdNearH - tmdNearHStep) * tmdBiomeBumpGain * tmdSunElev * tmdGrazing * tmdNearW;',
      '    }',
      '    if (tmdMicroW > 0.004) {',
      '      vec3 tmdGMicro = sqrt(max(texture2D(microGrassTex, tmdUvMicro).rgb, vec3(0.0004)));',
      '      vec3 tmdAMicro = sqrt(max(texture2D(microAsphaltTex, tmdUvMicro).rgb, vec3(0.0004)));',
      '      vec3 tmdRMicro = sqrt(max(texture2D(microRockTex, tmdRockUvMicro).rgb, vec3(0.0004)));',
      '      vec3 tmdFMicro = sqrt(max(texture2D(microForestTex, tmdUvMicro).rgb, vec3(0.0004)));',
      '      vec3 tmdSMicro = mix(tmdAMicro, tmdRMicro, 0.30);',
      '      vec3 tmdMicroCol = tmdGMicro * tmdWGrass + tmdAMicro * tmdWUrban + tmdRMicro * tmdWRock + tmdFMicro * tmdWForest + tmdSMicro * tmdWSand;',
      '      float tmdMicroH = dot(tmdMicroCol, vec3(0.299, 0.587, 0.114));',
      '      tmdDetail = clamp(tmdDetail + (tmdMicroCol - vec3(0.5)) * (0.85 * tmdMicroW), 0.02, 0.99);',
      '      tmdHeightCenter = mix(tmdHeightCenter, tmdMicroH, 0.50 * tmdMicroW);',
      '      tmdMicroGrain = mix(tmdMicroGrain, tmdMicroH, 0.65 * tmdMicroW);',
      '      vec3 tmdSunN2 = normalize(seaSunDir + vec3(0.0001, 0.0001, 0.0));',
      '      vec2 tmdSunXZ2 = normalize(tmdSunN2.xz + vec2(0.0001, 0.0));',
      '      vec2 tmdBumpOffMicro = (tmdRotMicro * tmdSunXZ2) * 0.0045;',
      '      vec2 tmdBumpOffRockM = mix(tmdBumpOffMicro, vec2((tmdSunXZ2.x + tmdSunXZ2.y) * 0.004, tmdSunN2.y * 0.0055), tmdCliffBlend);',
      '      float tmdHGM = dot(sqrt(max(texture2D(microGrassTex, tmdUvMicro + tmdBumpOffMicro).rgb, vec3(0.0004))), vec3(0.299, 0.587, 0.114));',
      '      float tmdHAM = dot(sqrt(max(texture2D(microAsphaltTex, tmdUvMicro + tmdBumpOffMicro).rgb, vec3(0.0004))), vec3(0.299, 0.587, 0.114));',
      '      float tmdHRM = dot(sqrt(max(texture2D(microRockTex, tmdRockUvMicro + tmdBumpOffRockM).rgb, vec3(0.0004))), vec3(0.299, 0.587, 0.114));',
      '      float tmdHFM = dot(sqrt(max(texture2D(microForestTex, tmdUvMicro + tmdBumpOffMicro).rgb, vec3(0.0004))), vec3(0.299, 0.587, 0.114));',
      '      float tmdHSM = mix(tmdHAM, tmdHRM, 0.30);',
      '      float tmdMicroHStep = tmdHGM * tmdWGrass + tmdHAM * tmdWUrban + tmdHRM * tmdWRock + tmdHFM * tmdWForest + tmdHSM * tmdWSand;',
      '      float tmdSunElev2 = clamp(tmdSunN2.y * 2.4 + 0.22, 0.0, 1.0);',
      '      tmdMicroRelief += (tmdMicroH - tmdMicroHStep) * 1.75 * tmdSunElev2 * tmdMicroW;',
      '    }',
      '    vec3 tmdPalGrass = vec3(0.11, 0.20, 0.055);',
      '    vec3 tmdPalForest = vec3(0.045, 0.105, 0.032);',
      '    vec3 tmdPalRock = vec3(0.18, 0.175, 0.165);',
      '    vec3 tmdPalSand = vec3(0.46, 0.39, 0.26);',
      '    vec3 tmdPalUrban = vec3(0.22, 0.22, 0.215);',
      '    vec3 tmdBiomeBase = tmdPalGrass * tmdWGrass + tmdPalForest * tmdWForest + tmdPalRock * tmdWRock + tmdPalSand * tmdWSand + tmdPalUrban * tmdWUrban;',
      '    float tmdPalLum = max(0.04, dot(tmdBiomeBase, vec3(0.299, 0.587, 0.114)));',
      '    float tmdLumRatio = clamp(tmdLum / tmdPalLum, 0.42, 2.20);',
      '    vec3 tmdBiomeTinted = mix(tmdSat, tmdBiomeBase * tmdLumRatio, 0.40);',
      '    float tmdDetailStrength = tmdMidW * 0.42 + tmdNearW * 0.58 + tmdMicroW * 0.48;',
      '    vec3 tmdDetailGain = clamp(vec3(1.0) + (tmdDetail - vec3(0.5)) * (1.85 * tmdDetailStrength), vec3(0.24), vec3(2.15));',
      '    float tmdCavityAO = mix(1.0, clamp(0.68 + tmdHeightCenter * 0.66, 0.48, 1.24), clamp(tmdNearW * 0.52 + tmdMicroW * 0.38, 0.0, 0.85));',
      '    float tmdBumpShade = clamp(1.0 + tmdMicroRelief * 1.45, 0.58, 1.55);',
      '    float tmdCloseReplace = clamp(tmdNearW * 0.45 + tmdMicroW * 0.40, 0.0, 0.78);',
      '    vec3 tmdBaseCol = mix(tmdSat, tmdBiomeTinted, tmdCloseReplace);',
      '    vec3 tmdFinalCol = clamp(tmdBaseCol * tmdDetailGain * tmdCavityAO * tmdBumpShade, 0.0, 1.0);',
      '    diffuseColor.rgb = mix(tmdSat, tmdFinalCol, tmdLandMask * clamp(tmdMidW, 0.0, 1.0));',
      '    float tmdBaseRough = tmdWUrban * 0.72 + tmdWSand * 0.82 + tmdWRock * 0.86 + tmdWGrass * 0.94 + tmdWForest * 0.95;',
      '    float tmdRoughVar = (0.5 - tmdMicroGrain) * (tmdWUrban * 0.16 + tmdWRock * 0.12 + 0.06);',
      '    tmdRoughnessTarget = clamp(tmdBaseRough + tmdRoughVar, 0.56, 0.99);',
      '    tmdRoughnessMix = tmdLandMask * clamp(tmdMidW * 0.55 + tmdNearW * 0.45, 0.0, 1.0);',
      '  }',
      '}'
    ].join('\n');
  }

  /**
   * Pure GLSL snippet injected immediately after `#include <roughnessmap_fragment>`.
   */
  function applyRoughnessGLSL() {
    return '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, tmdRoughnessTarget, tmdRoughnessMix);';
  }

  // Regex matching the legacy weak closeFade block in dist/flight.js
  var LEGACY_CLOSE_FADE_RE = /float\s+closeFade\s*=\s*1\.0\s*-\s*smoothstep\([\s\S]*?diffuseColor\.rgb\s*=\s*clamp\(\s*diffuseColor\.rgb\s*\*\s*detailGain\s*,\s*0\.0\s*,\s*1\.0\s*\)\s*;\s*\}/;

  /**
   * Injects micro-PBR detail textures, world-normal varying, biome micro-detail shader,
   * and per-biome roughness modulation into a Three.js MeshStandardMaterial shader.
   *
   * Idempotent and safe whether called at the end of `terrainPhoto(shader, tile)` in
   * `dist/flight.js` or on a standalone MeshStandardMaterial shader.
   */
  function inject(shader, textures, seaSunDirUniform) {
    if (!shader || !textures) return shader;

    var fallbackTex = textures.grass || textures.asphalt || textures.rock || textures.forest || null;
    if (!shader.uniforms) shader.uniforms = {};
    shader.uniforms.microGrassTex = { value: textures.grass || fallbackTex };
    shader.uniforms.microAsphaltTex = { value: textures.asphalt || fallbackTex };
    shader.uniforms.microRockTex = { value: textures.rock || fallbackTex };
    shader.uniforms.microForestTex = { value: textures.forest || fallbackTex };

    if (seaSunDirUniform) {
      if (typeof seaSunDirUniform === 'object' && 'value' in seaSunDirUniform) {
        shader.uniforms.seaSunDir = seaSunDirUniform;
      } else {
        shader.uniforms.seaSunDir = { value: seaSunDirUniform };
      }
    } else if (!shader.uniforms.seaSunDir) {
      shader.uniforms.seaSunDir = { value: { x: 0.45, y: 0.78, z: 0.43 } };
    }

    // --- Vertex Shader ---
    if (typeof shader.vertexShader === 'string' && shader.vertexShader.indexOf('vTerrainWorldNormal') === -1) {
      var vsHeader = 'varying vec3 vTerrainWorldNormal;\n';
      var needsWorldPos = shader.vertexShader.indexOf('terrainWorldPos') === -1;
      var needsXZ = shader.vertexShader.indexOf('terrainXZ') === -1;
      if (needsWorldPos) vsHeader += 'varying vec3 terrainWorldPos;\n';
      if (needsXZ) vsHeader += 'varying vec2 terrainXZ;\n';

      var vs = vsHeader + shader.vertexShader;
      if (vs.indexOf('#include <beginnormal_vertex>') !== -1) {
        vs = vs.replace(
          '#include <beginnormal_vertex>',
          '#include <beginnormal_vertex>\n  vTerrainWorldNormal = normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz + vec3(0.0, 0.00001, 0.0));'
        );
      }
      if ((needsWorldPos || needsXZ) && vs.indexOf('#include <begin_vertex>') !== -1) {
        var extraBegin = '#include <begin_vertex>\n';
        if (needsWorldPos) extraBegin += '  terrainWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\n';
        if (needsXZ) extraBegin += '  terrainXZ = (modelMatrix * vec4(transformed, 1.0)).xz;\n';
        vs = vs.replace('#include <begin_vertex>', extraBegin);
      }
      shader.vertexShader = vs;
    }

    // --- Fragment Shader ---
    if (typeof shader.fragmentShader === 'string' && shader.fragmentShader.indexOf('TerrainMicroDetail_v1') === -1) {
      var fsHeader = '';
      if (shader.fragmentShader.indexOf('vTerrainWorldNormal') === -1) {
        fsHeader += 'varying vec3 vTerrainWorldNormal;\n';
      }
      if (shader.fragmentShader.indexOf('terrainWorldPos') === -1) {
        fsHeader += 'varying vec3 terrainWorldPos;\n';
      }
      if (shader.fragmentShader.indexOf('terrainXZ') === -1) {
        fsHeader += 'varying vec2 terrainXZ;\n';
      }
      if (shader.fragmentShader.indexOf('microGrassTex') === -1) {
        fsHeader += 'uniform sampler2D microGrassTex, microAsphaltTex, microRockTex, microForestTex;\n';
      }
      if (shader.fragmentShader.indexOf('seaSunDir') === -1) {
        fsHeader += 'uniform vec3 seaSunDir;\n';
      }

      var fs = fsHeader + shader.fragmentShader;
      var microBlock = applyMicroDetailGLSL();

      if (LEGACY_CLOSE_FADE_RE.test(fs)) {
        // Replace dist/flight.js's weak sine-wave closeFade block in-place
        fs = fs.replace(LEGACY_CLOSE_FADE_RE, microBlock);
      } else if (fs.indexOf('/*__TERRAIN_MICRO_DETAIL__*/') !== -1) {
        fs = fs.replace('/*__TERRAIN_MICRO_DETAIL__*/', microBlock);
      } else if (fs.indexOf('#include <alphamap_fragment>') !== -1) {
        // Runs right after all #include <color_fragment> satellite blending
        fs = fs.replace('#include <alphamap_fragment>', microBlock + '\n#include <alphamap_fragment>');
      } else if (fs.indexOf('#include <color_fragment>') !== -1) {
        fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\n' + microBlock);
      }

      if (fs.indexOf('#include <roughnessmap_fragment>') !== -1 && fs.indexOf('tmdRoughnessMix') !== -1) {
        fs = fs.replace('#include <roughnessmap_fragment>', applyRoughnessGLSL());
      }

      shader.fragmentShader = fs;
    }

    return shader;
  }

  return {
    VERSION: '1.0.0',
    TEX_SIZE: TEX_SIZE,
    createTextures: createTextures,
    inject: inject,
    applyMicroDetailGLSL: applyMicroDetailGLSL,
    applyRoughnessGLSL: applyRoughnessGLSL
  };
});
