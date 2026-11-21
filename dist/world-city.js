/* Real OpenStreetMap 1:1 International City Scenery Streaming Module (v0.70)
 * Streams real building footprints, heights, regional residential pitched roofs,
 * heritage roofs, roads, and suburban settlements across 8 international regions.
 */
function createWorldCity(scene, ground, airports = []) {
  const root = new THREE.Group();
  root.name = 'World real OSM cities';
  scene.add(root);

  const WORLD_BOUNDS = [
    [3.14,101.695,3.17,101.72], // Malaysian pilot district
    [-6.19,106.81,-6.16,106.84], // Indonesian pilot district
    [35.37, 139.54, 35.87, 140.50], // 0: JP_TYO (Tokyo/Haneda/Yokohama/Chiba/Narita)
    [34.32, 135.10, 34.82, 135.68], // 1: JP_KIX (Osaka/Kansai/Kobe)
    [26.05, 127.56, 26.50, 127.94], // 2: JP_OKA (Okinawa Naha/Shuri/Chatan)
    [22.17, 113.83, 22.55, 114.35], // 3: HK_HKG (Hong Kong)
    [37.32, 126.35, 37.69, 127.20], // 4: KR_ICN (Seoul/Incheon/Songdo)
    [1.20, 103.59, 1.49, 104.05],   // 5: SG_SIN (Singapore)
    [14.37, 120.87, 14.77, 121.16], // 6: PH_MNL (Manila/Makati/BGC)
    [13.55, 100.39, 13.95, 100.89]  // 7: TH_BKK (Bangkok/Suvarnabhumi)
  ];

  function inside(lat, lon) {
    for (const b of WORLD_BOUNDS) {
      if (lat >= b[0] && lat <= b[2] && lon >= b[1] && lon <= b[3]) return true;
    }
    return false;
  }

  function makeCanvas(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // Ultra-crisp fillRect-only 256x256 procedural architectural facade & roof textures
  // Note: CanvasTexture flipY=true maps canvas y=0 -> top (v=1) and canvas y=256 -> bottom (v=0)

  // 1. Modern Reflective Glass Curtain-Wall Tower (8 office floors x 32px, 8 bays x 32px)
  const glassTowerTex = makeCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#c8daea';
    g.fillRect(0, 0, w, h);
    for (let fy = 0; fy < h; fy += 32) {
      // Structural floor spandrel panel + crisp aluminum edge trim
      g.fillStyle = '#334354';
      g.fillRect(0, fy, w, 7);
      g.fillStyle = '#60758a';
      g.fillRect(0, fy + 1, w, 2);
      g.fillStyle = '#dde9f4';
      g.fillRect(0, fy + 7, w, 1);
      g.fillStyle = '#253240';
      g.fillRect(0, fy + 31, w, 1);
      for (let bx = 0; bx < w; bx += 32) {
        for (let p = 0; p < 2; p++) {
          const px = bx + p * 16;
          const seed = (bx * 13 + fy * 29 + p * 7) % 19;
          // Glass pane vertical sky/interior gradient bands
          g.fillStyle = seed < 5 ? '#7c99b4' : seed < 12 ? '#98b6cf' : '#adc8de';
          g.fillRect(px + 2, fy + 8, 13, 11);
          g.fillStyle = seed < 4 ? '#c4daec' : seed < 11 ? '#d5e6f4' : '#e4f0fa';
          g.fillRect(px + 2, fy + 19, 13, 12);
          // Interior roller blind / office ceiling strip
          if (seed % 4 === 0) {
            g.fillStyle = 'rgba(240,246,252,0.42)';
            g.fillRect(px + 2, fy + 8, 13, 6);
          } else if (seed % 5 === 0) {
            g.fillStyle = 'rgba(24,38,54,0.34)';
            g.fillRect(px + 2, fy + 9, 13, 10);
          }
        }
        // Primary & secondary vertical mullions with specular lip
        g.fillStyle = '#293746';
        g.fillRect(bx, fy, 2, 32);
        g.fillStyle = '#e5f0f9';
        g.fillRect(bx + 2, fy + 8, 1, 23);
        g.fillStyle = '#485b6e';
        g.fillRect(bx + 16, fy + 7, 1, 24);
      }
    }
    // Diagonal sunlit sky-reflection sheen streaks across curtain wall
    for (let y = 0; y < h; y += 4) {
      const rx1 = (y * 3 + 24) % w;
      const rx2 = (y * 3 + 136) % w;
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.fillRect(rx1, y, 22, 4);
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(rx2, y, 36, 4);
    }
  });
  glassTowerTex.repeat.set(0.036, 0.036);

  const glassTowerEmissiveTex = makeCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#000000';
    g.fillRect(0, 0, w, h);
    for (let fy = 0; fy < h; fy += 32) {
      const floorLit = ((fy * 11 + 7) % 13) < 7;
      for (let bx = 0; bx < w; bx += 32) {
        const bayHash = (bx * 31 + fy * 53) % 23;
        if ((floorLit && bayHash < 15) || bayHash < 6) {
          g.fillStyle = bayHash % 5 === 0 ? '#ffe7bc' : bayHash % 3 === 0 ? '#d8eeff' : '#eef6ff';
          g.fillRect(bx + 3, fy + 9, 12, 20);
          if (bayHash % 4 !== 0) g.fillRect(bx + 18, fy + 9, 12, 20);
        }
      }
    }
  });
  glassTowerEmissiveTex.repeat.set(0.036, 0.036);

  // 2. Modern Multi-Story Apartment Facade with Recessed Balconies, Railings & 1F Storefront Band
  const aptWallTex = makeCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#f2f0ec';
    g.fillRect(0, 0, w, h);
    // Subtle architectural tile seams
    for (let y = 0; y < h; y += 8) {
      g.fillStyle = 'rgba(0,0,0,0.03)';
      g.fillRect(0, y, w, 1);
    }
    for (let fy = 0; fy < h; fy += 32) {
      const isGroundRow = fy === 224;
      // Floor slab ledge & crisp shadow beneath slab
      g.fillStyle = '#fbfaf8';
      g.fillRect(0, fy, w, 3);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(0, fy + 3, w, 2);
      for (let bx = 0; bx < w; bx += 64) {
        // Vertical architectural pilaster / expansion joint
        g.fillStyle = 'rgba(0,0,0,0.07)';
        g.fillRect(bx, fy, 2, 32);
        if (isGroundRow) {
          // 1F Retail storefront band with dark display glass, awning & masonry piers
          g.fillStyle = '#d6d4cf';
          g.fillRect(bx + 2, fy + 5, 62, 27);
          g.fillStyle = '#23303c';
          g.fillRect(bx + 7, fy + 10, 34, 20);
          g.fillStyle = '#6c8aa3';
          g.fillRect(bx + 9, fy + 12, 10, 16);
          g.fillStyle = '#283644';
          g.fillRect(bx + 46, fy + 11, 13, 19);
          // Crisp storefront awning / signboard fascia
          g.fillStyle = (bx % 128 === 0) ? '#b85a48' : '#3c6882';
          g.fillRect(bx + 5, fy + 6, 38, 4);
          g.fillStyle = '#f4f2ec';
          g.fillRect(bx + 5, fy + 10, 38, 1);
        } else {
          // Recessed balcony alcove
          g.fillStyle = '#3b434d';
          g.fillRect(bx + 6, fy + 5, 36, 23);
          g.fillStyle = '#aeb5bc';
          g.fillRect(bx + 8, fy + 6, 32, 14);
          // Double sliding glass patio doors inside balcony
          g.fillStyle = '#202d3a';
          g.fillRect(bx + 10, fy + 7, 22, 16);
          g.fillStyle = '#6f8fa8';
          g.fillRect(bx + 11, fy + 8, 9, 13);
          g.fillStyle = '#d8dee4';
          g.fillRect(bx + 20, fy + 7, 2, 16);
          // Wall-mounted AC condenser unit inside balcony corner
          g.fillStyle = '#e4e6e8';
          g.fillRect(bx + 34, fy + 12, 6, 8);
          g.fillStyle = '#4a535c';
          g.fillRect(bx + 35, fy + 14, 4, 4);
          // Balcony parapet / railing + vertical balusters
          g.fillStyle = '#e7eaee';
          g.fillRect(bx + 5, fy + 19, 38, 2);
          g.fillStyle = 'rgba(218,228,236,0.72)';
          g.fillRect(bx + 6, fy + 21, 36, 8);
          g.fillStyle = '#535f6b';
          for (let rx = bx + 8; rx < bx + 42; rx += 5) {
            g.fillRect(rx, fy + 21, 1, 8);
          }
          g.fillStyle = 'rgba(0,0,0,0.22)';
          g.fillRect(bx + 5, fy + 29, 38, 2);
          // Side bedroom / kitchen window with frame & sill
          g.fillStyle = '#faf9f6';
          g.fillRect(bx + 47, fy + 8, 13, 15);
          g.fillStyle = '#253340';
          g.fillRect(bx + 48, fy + 9, 11, 12);
          g.fillStyle = '#7c9bb5';
          g.fillRect(bx + 49, fy + 10, 4, 10);
          g.fillStyle = '#e2e5e8';
          g.fillRect(bx + 53, fy + 9, 1, 12);
          g.fillStyle = 'rgba(0,0,0,0.20)';
          g.fillRect(bx + 47, fy + 23, 13, 2);
        }
      }
    }
  });
  aptWallTex.repeat.set(0.042, 0.042);

  const aptEmissiveTex = makeCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#000000';
    g.fillRect(0, 0, w, h);
    for (let fy = 0; fy < h; fy += 32) {
      const isGroundRow = fy === 224;
      for (let bx = 0; bx < w; bx += 64) {
        const s = (bx * 19 + fy * 43) % 29;
        if (isGroundRow) {
          if (s < 21) {
            g.fillStyle = s % 3 === 0 ? '#fff1cf' : '#ffda94';
            g.fillRect(bx + 8, fy + 11, 32, 18);
            g.fillRect(bx + 47, fy + 12, 11, 17);
          }
        } else {
          if (s < 13) {
            g.fillStyle = s < 5 ? '#ffe09e' : s < 10 ? '#ffce7d' : '#d2e8ff';
            g.fillRect(bx + 10, fy + 8, 21, 11);
          }
          if ((s * 7) % 23 < 9) {
            g.fillStyle = s % 2 ? '#ffd98e' : '#ffebb8';
            g.fillRect(bx + 48, fy + 10, 10, 10);
          }
        }
      }
    }
  });
  aptEmissiveTex.repeat.set(0.042, 0.042);

  // 3. Warm Running-Bond Brick / Masonry / Shophouse Urban Facade (8 floors x 32px)
  const brickTownTex = makeCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#d6d0c8';
    g.fillRect(0, 0, w, h);
    // Crisp running-bond brick courses (4px tall x 12px wide bricks)
    for (let y = 0; y < h; y += 4) {
      const rowOff = ((y >> 2) & 1) ? 6 : 0;
      for (let x = -6; x < w; x += 12) {
        const v = ((x * 17 + y * 31) & 15);
        g.fillStyle = v < 4 ? '#e7e1d9' : v < 9 ? '#f1ece4' : v < 13 ? '#faf6f0' : '#dfd8cf';
        g.fillRect(x + rowOff, y, 11, 3);
      }
    }
    for (let fy = 0; fy < h; fy += 32) {
      const isGroundRow = fy === 224;
      // Decorative masonry cornice belt-course
      if (fy % 64 === 0 || isGroundRow) {
        g.fillStyle = '#f8f5ef';
        g.fillRect(0, fy, w, 3);
        g.fillStyle = 'rgba(0,0,0,0.20)';
        g.fillRect(0, fy + 3, w, 2);
      }
      for (let bx = 0; bx < w; bx += 32) {
        if (isGroundRow) {
          // Warm ground-floor shophouse window & striped awning
          g.fillStyle = '#25313b';
          g.fillRect(bx + 4, fy + 9, 24, 21);
          g.fillStyle = '#7b94a8';
          g.fillRect(bx + 6, fy + 11, 8, 17);
          g.fillStyle = '#f4efe6';
          g.fillRect(bx + 15, fy + 9, 2, 21);
          // Classic striped awning
          g.fillStyle = '#c45b47';
          g.fillRect(bx + 3, fy + 6, 26, 4);
          g.fillStyle = '#f7f2e8';
          for (let sx = bx + 5; sx < bx + 28; sx += 6) g.fillRect(sx, fy + 6, 3, 4);
        } else {
          // Stone lintel & projecting sill
          g.fillStyle = '#f5f1e8';
          g.fillRect(bx + 7, fy + 6, 18, 3);
          g.fillStyle = 'rgba(0,0,0,0.16)';
          g.fillRect(bx + 8, fy + 9, 16, 1);
          // Framed window with mullions
          g.fillStyle = '#ebe6dc';
          g.fillRect(bx + 8, fy + 9, 16, 17);
          g.fillStyle = '#24313d';
          g.fillRect(bx + 9, fy + 10, 14, 15);
          g.fillStyle = '#738fa6';
          g.fillRect(bx + 10, fy + 11, 5, 6);
          g.fillStyle = '#f2ede4';
          g.fillRect(bx + 15, fy + 10, 2, 15);
          g.fillRect(bx + 9, fy + 17, 14, 2);
          // Projecting window sill + shadow
          g.fillStyle = '#faf7f0';
          g.fillRect(bx + 7, fy + 26, 18, 2);
          g.fillStyle = 'rgba(0,0,0,0.22)';
          g.fillRect(bx + 7, fy + 28, 18, 2);
        }
      }
    }
  });
  brickTownTex.repeat.set(0.045, 0.045);

  const brickTownEmissiveTex = makeCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#000000';
    g.fillRect(0, 0, w, h);
    for (let fy = 0; fy < h; fy += 32) {
      const isGroundRow = fy === 224;
      for (let bx = 0; bx < w; bx += 32) {
        const s = (bx * 23 + fy * 37) % 23;
        if (isGroundRow) {
          if (s < 16) {
            g.fillStyle = s % 3 === 0 ? '#ffe9b8' : '#ffd080';
            g.fillRect(bx + 5, fy + 10, 22, 19);
          }
        } else if (s < 10) {
          g.fillStyle = s < 5 ? '#ffd68a' : s < 8 ? '#ffc26e' : '#fff0c8';
          g.fillRect(bx + 10, fy + 11, 12, 13);
        }
      }
    }
  });
  brickTownEmissiveTex.repeat.set(0.045, 0.045);

  // 4. Residential House Siding / Stucco with Twin Windows, Shutters & Entry Door (4 stories x 64px)
  const houseWallTex = makeCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#f5f2ec';
    g.fillRect(0, 0, w, h);
    // Fine residential horizontal clapboard / stucco courses
    for (let y = 0; y < h; y += 8) {
      g.fillStyle = 'rgba(0,0,0,0.045)';
      g.fillRect(0, y, w, 1);
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.fillRect(0, y + 1, w, 1);
    }
    for (let fy = 0; fy < h; fy += 64) {
      // Crisp eave trim & floor shadow
      g.fillStyle = '#ffffff';
      g.fillRect(0, fy, w, 4);
      g.fillStyle = 'rgba(0,0,0,0.16)';
      g.fillRect(0, fy + 4, w, 3);
      for (let bx = 0; bx < w; bx += 64) {
        const hasDoor = (fy === 192) && ((bx % 128) === 0);
        // Left twin window with side shutters
        g.fillStyle = '#bcc2c8';
        g.fillRect(bx + 6, fy + 16, 4, 26);
        g.fillRect(bx + 28, fy + 16, 4, 26);
        g.fillStyle = '#faf8f4';
        g.fillRect(bx + 10, fy + 15, 18, 28);
        g.fillStyle = '#283644';
        g.fillRect(bx + 12, fy + 17, 14, 24);
        g.fillStyle = '#7b9ab5';
        g.fillRect(bx + 13, fy + 18, 5, 10);
        g.fillStyle = '#f4f1ea';
        g.fillRect(bx + 18, fy + 17, 2, 24);
        g.fillRect(bx + 12, fy + 28, 14, 2);
        g.fillStyle = 'rgba(0,0,0,0.18)';
        g.fillRect(bx + 9, fy + 43, 20, 2);

        if (hasDoor) {
          // Warm timber entryway door + porch canopy
          g.fillStyle = '#ffffff';
          g.fillRect(bx + 39, fy + 19, 20, 45);
          g.fillStyle = '#7d563c';
          g.fillRect(bx + 41, fy + 22, 16, 40);
          g.fillStyle = '#9a6e4f';
          g.fillRect(bx + 43, fy + 24, 12, 15);
          g.fillRect(bx + 43, fy + 42, 12, 16);
          g.fillStyle = '#f2e8cc';
          g.fillRect(bx + 44, fy + 26, 10, 8);
          g.fillStyle = '#485058';
          g.fillRect(bx + 37, fy + 16, 24, 3);
        } else {
          // Second neat residential window
          g.fillStyle = '#faf8f4';
          g.fillRect(bx + 39, fy + 17, 18, 24);
          g.fillStyle = '#263442';
          g.fillRect(bx + 41, fy + 19, 14, 20);
          g.fillStyle = '#7593ad';
          g.fillRect(bx + 42, fy + 20, 5, 9);
          g.fillStyle = '#f4f1ea';
          g.fillRect(bx + 47, fy + 19, 2, 20);
          g.fillRect(bx + 41, fy + 28, 14, 2);
          g.fillStyle = 'rgba(0,0,0,0.18)';
          g.fillRect(bx + 38, fy + 41, 20, 2);
        }
      }
    }
  });
  houseWallTex.repeat.set(0.085, 0.085);

  const houseEmissiveTex = makeCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#000000';
    g.fillRect(0, 0, w, h);
    for (let fy = 0; fy < h; fy += 64) {
      for (let bx = 0; bx < w; bx += 64) {
        const s = (bx * 17 + fy * 31) % 19;
        if (s < 10) {
          g.fillStyle = s < 5 ? '#ffe09e' : '#ffcf7d';
          g.fillRect(bx + 12, fy + 18, 14, 22);
        }
        if ((s * 5 + 3) % 17 < 8) {
          g.fillStyle = '#ffebb8';
          if (fy === 192 && (bx % 128) === 0) g.fillRect(bx + 44, fy + 26, 10, 8);
          else g.fillRect(bx + 41, fy + 20, 14, 18);
        }
      }
    }
  });
  houseEmissiveTex.repeat.set(0.085, 0.085);

  // 5. Ornate Colonial / East-Asian / European Heritage Stone & Plaster Facade (4 stories x 64px)
  const heritageWallTex = makeCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#f2ede3';
    g.fillRect(0, 0, w, h);
    // Dressed stone ashlar courses
    for (let y = 0; y < h; y += 16) {
      g.fillStyle = 'rgba(0,0,0,0.06)';
      g.fillRect(0, y, w, 1);
      const off = ((y >> 4) & 1) ? 16 : 0;
      for (let x = off; x < w; x += 32) {
        g.fillStyle = 'rgba(0,0,0,0.05)';
        g.fillRect(x, y, 1, 16);
      }
    }
    for (let fy = 0; fy < h; fy += 64) {
      // Decorative cornice + dentil stringcourse
      g.fillStyle = '#fcfaf5';
      g.fillRect(0, fy, w, 5);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(0, fy + 5, w, 2);
      for (let dx = 2; dx < w; dx += 8) {
        g.fillStyle = '#ebe4d8';
        g.fillRect(dx, fy + 6, 4, 3);
      }
      for (let bx = 0; bx < w; bx += 64) {
        // Fluted stone pilasters
        g.fillStyle = '#faf6ee';
        g.fillRect(bx, fy + 7, 10, 57);
        g.fillStyle = 'rgba(0,0,0,0.10)';
        g.fillRect(bx + 3, fy + 10, 1, 50);
        g.fillRect(bx + 6, fy + 10, 1, 50);
        g.fillRect(bx + 10, fy + 7, 2, 57);
        // Stepped-arch framed window with louvered dark glass & keystone
        g.fillStyle = '#faf6ee';
        g.fillRect(bx + 20, fy + 16, 28, 36);
        g.fillStyle = '#e5ded0';
        g.fillRect(bx + 32, fy + 13, 4, 5);
        g.fillStyle = '#293540';
        g.fillRect(bx + 26, fy + 17, 16, 3);
        g.fillRect(bx + 23, fy + 20, 22, 3);
        g.fillRect(bx + 22, fy + 23, 24, 27);
        // Window highlight + ornate crossbars
        g.fillStyle = '#738ca1';
        g.fillRect(bx + 24, fy + 24, 8, 12);
        g.fillStyle = '#f4eee2';
        g.fillRect(bx + 33, fy + 18, 2, 32);
        g.fillRect(bx + 22, fy + 34, 24, 2);
        // Balustraded sill apron
        g.fillStyle = '#faf6ee';
        g.fillRect(bx + 18, fy + 51, 32, 3);
        g.fillStyle = 'rgba(0,0,0,0.16)';
        g.fillRect(bx + 18, fy + 54, 32, 2);
      }
    }
  });
  heritageWallTex.repeat.set(0.075, 0.075);

  const heritageEmissiveTex = makeCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#000000';
    g.fillRect(0, 0, w, h);
    for (let fy = 0; fy < h; fy += 64) {
      for (let bx = 0; bx < w; bx += 64) {
        const s = (bx * 13 + fy * 29) % 17;
        if (s < 10) {
          g.fillStyle = s % 2 ? '#ffd588' : '#ffbe68';
          g.fillRect(bx + 23, fy + 22, 22, 26);
        }
      }
    }
  });
  heritageEmissiveTex.repeat.set(0.075, 0.075);

  // 6. Industrial Corrugated Steel with Clerestory Strip Windows & Loading Bays
  const indWallTex = makeCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#dfe5ea';
    g.fillRect(0, 0, w, h);
    // Vertical corrugated metal ribs
    for (let x = 0; x < w; x += 4) {
      g.fillStyle = '#f2f5f8';
      g.fillRect(x, 0, 1, h);
      g.fillStyle = '#c5cfd8';
      g.fillRect(x + 2, 0, 1, h);
      g.fillStyle = '#aeb9c4';
      g.fillRect(x + 3, 0, 1, h);
    }
    // Horizontal steel cladding panel seams
    for (let y = 0; y < h; y += 64) {
      g.fillStyle = '#7e8b98';
      g.fillRect(0, y, w, 3);
      g.fillStyle = '#f5f8fa';
      g.fillRect(0, y + 3, w, 1);
    }
    // Upper clerestory industrial ribbon windows
    for (const wy of [14, 142]) {
      g.fillStyle = '#485562';
      g.fillRect(0, wy - 2, w, 18);
      g.fillStyle = '#273542';
      g.fillRect(0, wy, w, 14);
      g.fillStyle = '#6f8ea6';
      g.fillRect(0, wy + 1, w, 5);
      g.fillStyle = '#cdd6de';
      for (let mx = 0; mx < w; mx += 16) g.fillRect(mx, wy, 2, 14);
    }
    // Ground-level roll-up loading bays
    for (let bx = 16; bx < w; bx += 128) {
      g.fillStyle = '#535e69';
      g.fillRect(bx - 2, 200, 56, 56);
      g.fillStyle = '#cfd6dc';
      g.fillRect(bx, 204, 52, 52);
      for (let ry = 208; ry < 256; ry += 5) {
        g.fillStyle = '#9aa4ae';
        g.fillRect(bx, ry, 52, 1);
      }
      g.fillStyle = '#d4a63a';
      g.fillRect(bx - 3, 240, 3, 16);
      g.fillRect(bx + 52, 240, 3, 16);
    }
  });
  indWallTex.repeat.set(0.055, 0.055);

  const indEmissiveTex = makeCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#000000';
    g.fillRect(0, 0, w, h);
    for (const wy of [14, 142]) {
      for (let mx = 2; mx < w; mx += 16) {
        if (((mx * 7 + wy * 3) % 11) < 6) {
          g.fillStyle = (mx % 32 === 2) ? '#d8eeff' : '#ffd894';
          g.fillRect(mx, wy + 1, 13, 11);
        }
      }
    }
  });
  indEmissiveTex.repeat.set(0.055, 0.055);

  // 7. Detailed Overlapping Clay / Kawara / Slate Pitched Roof Tiles
  const pitchedRoofTex = makeCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#ececec';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) {
      const off = ((y >> 4) & 1) ? 8 : 0;
      for (let x = -8; x < w; x += 16) {
        const shade = ((x * 13 + y * 29) & 7);
        g.fillStyle = shade < 2 ? '#dedede' : shade < 5 ? '#ebebeb' : '#f7f7f7';
        g.fillRect(x + off, y, 16, 16);
        // Barrel / kawara curved rib highlight & trough shadow
        g.fillStyle = 'rgba(255,255,255,0.20)';
        g.fillRect(x + off + 4, y + 2, 4, 11);
        g.fillStyle = 'rgba(0,0,0,0.16)';
        g.fillRect(x + off, y, 2, 16);
        g.fillStyle = 'rgba(0,0,0,0.08)';
        g.fillRect(x + off + 13, y, 2, 16);
      }
      // Crisp horizontal overlapping tile lip shadow & sunlit ridge edge
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.fillRect(0, y + 13, w, 3);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(0, y, w, 2);
    }
  });
  pitchedRoofTex.repeat.set(0.28, 0.28);

  // 8. Detailed Rooftop Waterproofing, Parapets, Mechanical HVAC Units & Skylights
  const flatRoofTex = makeCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#e2e3df';
    g.fillRect(0, 0, w, h);
    // Waterproof membrane expansion grid
    for (let i = 0; i < w; i += 64) {
      g.fillStyle = 'rgba(0,0,0,0.08)';
      g.fillRect(i, 0, 2, h);
      g.fillRect(0, i, w, 2);
    }
    // Gravel / aggregate concrete texture
    for (let i = 0; i < 650; i++) {
      g.fillStyle = i % 2 ? 'rgba(0,0,0,0.055)' : 'rgba(255,255,255,0.08)';
      g.fillRect((i * 53) % w, (i * 97) % h, 3, 3);
    }
    // Parapet trim border
    g.fillStyle = '#cfd2ce';
    g.fillRect(0, 0, w, 6);
    g.fillRect(0, h - 6, w, 6);
    g.fillRect(0, 0, 6, h);
    g.fillRect(w - 6, 0, 6, h);
    g.fillStyle = 'rgba(0,0,0,0.16)';
    g.fillRect(6, 6, w - 12, 2);
    g.fillRect(6, 6, 2, h - 12);
    // Rooftop HVAC chiller units with cast shadows & dark fan grilles
    const drawUnit = (ux, uy, uw, uh) => {
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.fillRect(ux + 4, uy + 4, uw, uh);
      g.fillStyle = '#cfd6dc';
      g.fillRect(ux, uy, uw, uh);
      g.fillStyle = '#eef2f5';
      g.fillRect(ux, uy, uw, 2);
      g.fillStyle = '#3c454e';
      g.fillRect(ux + 4, uy + 5, Math.max(6, uw - 8), Math.max(6, uh - 10));
      g.fillStyle = '#6f7a85';
      g.fillRect(ux + 6, uy + 7, Math.max(2, uw - 12), 2);
    };
    drawUnit(24, 28, 30, 22);
    drawUnit(152, 42, 36, 24);
    drawUnit(44, 164, 28, 28);
    // Skylight panel
    g.fillStyle = '#eef2f5';
    g.fillRect(146, 152, 48, 34);
    g.fillStyle = '#7393ab';
    g.fillRect(150, 156, 40, 26);
    g.fillStyle = '#dce4ea';
    g.fillRect(169, 156, 2, 26);
    g.fillRect(150, 168, 40, 2);
    // Rooftop conduit runs & maintenance hatch
    g.fillStyle = '#aeb6bd';
    g.fillRect(54, 38, 98, 3);
    g.fillRect(72, 176, 74, 3);
    g.fillStyle = '#9aa2a9';
    g.fillRect(102, 98, 22, 18);
    g.fillStyle = '#d8dde0';
    g.fillRect(104, 100, 18, 14);
  });
  flatRoofTex.repeat.set(0.08, 0.08);

  const roadTex = makeCanvas(128, 128, (g, w, h) => {
    g.fillStyle = '#2d3238';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#6c737c';
    g.fillRect(0, 0, 5, h);
    g.fillRect(w - 5, 0, 5, h);
    g.fillStyle = '#e5c158';
    for (let y = 6; y < h; y += 32) g.fillRect(w / 2 - 2, y, 4, 18);
  });

  // High-contrast PBR architectural materials (all 6 wall archetypes have matched night emissive maps)
  const glassTowerMat = new THREE.MeshPhysicalMaterial({
    clearcoat: 0.85, clearcoatRoughness: 0.14, envMapIntensity: 1.05,
    map: glassTowerTex,
    emissiveMap: glassTowerEmissiveTex,
    emissive: new THREE.Color(0xd8ecff),
    emissiveIntensity: 0,
    vertexColors: true,
    roughness: 0.22,
    metalness: 0.60
  });
  const aptMat = new THREE.MeshStandardMaterial({
    map: aptWallTex,
    emissiveMap: aptEmissiveTex,
    emissive: new THREE.Color(0xffd28e),
    emissiveIntensity: 0,
    vertexColors: true,
    roughness: 0.78,
    metalness: 0.06
  });
  const brickTownMat = new THREE.MeshStandardMaterial({
    map: brickTownTex,
    emissiveMap: brickTownEmissiveTex,
    emissive: new THREE.Color(0xffcc7e),
    emissiveIntensity: 0,
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.03
  });
  const houseMat = new THREE.MeshStandardMaterial({
    map: houseWallTex,
    emissiveMap: houseEmissiveTex,
    emissive: new THREE.Color(0xffdca4),
    emissiveIntensity: 0,
    vertexColors: true,
    roughness: 0.84,
    metalness: 0.04
  });
  const heritageMat = new THREE.MeshStandardMaterial({
    map: heritageWallTex,
    emissiveMap: heritageEmissiveTex,
    emissive: new THREE.Color(0xffd48a),
    emissiveIntensity: 0,
    vertexColors: true,
    roughness: 0.80,
    metalness: 0.06
  });
  const indMat = new THREE.MeshStandardMaterial({
    map: indWallTex,
    emissiveMap: indEmissiveTex,
    emissive: new THREE.Color(0xdbeeff),
    emissiveIntensity: 0,
    vertexColors: true,
    roughness: 0.56,
    metalness: 0.34
  });
  const pitchedRoofMat = new THREE.MeshStandardMaterial({
    map: pitchedRoofTex,
    vertexColors: true,
    roughness: 0.68,
    metalness: 0.10
  });
  const heritageRoofMat = new THREE.MeshStandardMaterial({
    map: pitchedRoofTex,
    vertexColors: true,
    roughness: 0.38,
    metalness: 0.34
  });
  const flatRoofMat = new THREE.MeshStandardMaterial({
    map: flatRoofTex,
    vertexColors: true,
    roughness: 0.88,
    metalness: 0.05
  });
  const roadMat = new THREE.MeshStandardMaterial({
    map: roadTex,
    roughness: 0.92,
    metalness: 0.04,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2
  });

  // Rich 12-16 color real-world regional palettes for ALL 10 regions (strictly 10 keys):
  // 0: JP_TYO, 1: JP_KIX, 2: JP_OKA, 3: HK_HKG, 4: KR_ICN, 5: SG_SIN, 6: PH_MNL, 7: TH_BKK, 8: MY_KUL, 9: ID_JKT
  const REG_PALETTES = {
    0: { // Tokyo / Yokohama / Chiba / Narita
      houseWall: [0xf4f2ee, 0xebe3d5, 0xe6dbc9, 0x545960, 0x9aaab8, 0xc9b59d, 0xdfd0ba, 0xc6cfc4, 0xdcb8a2, 0xcfd3d6, 0xefe6c8, 0x8c7564, 0xe2e6ea, 0xe9d2be, 0xc7c6b2, 0xf0ede6],
      houseRoof: [0x2c3138, 0x24344d, 0x3b424b, 0x4d3a31, 0x3c5249, 0x754234, 0x283a56, 0x34383d, 0x463832, 0x344a52, 0x3a473c, 0x26292e, 0x844c3a, 0x32465c],
      aptWall: [0xefede8, 0xe7dfd2, 0xd5dae0, 0xd9a894, 0xdcccb8, 0x9eb0c0, 0xcfdcd6, 0xc9bfb2, 0xe7d9be, 0x6c737c, 0xdfcbc2, 0xc4cfd8, 0xdfd2c0, 0xdadcd9, 0xd0ad96, 0xf2f0ec],
      brickWall: [0xd6967f, 0xb86e54, 0xd4be9e, 0xa95241, 0xcda87a, 0xcab49b, 0xc48778, 0x9b6b54, 0xdecbb3, 0x7a6258, 0xd9c29c, 0xc27f66, 0x9ea3a8, 0xe3d6c1],
      aptRoof: [0x858a90, 0x72787e, 0x9ea2a6, 0x6c8778, 0x999286, 0x6c7c8c, 0xaeb2b5, 0x5c6168, 0x8c8780, 0x6a8082, 0xa39a8a, 0x7d8287],
      glassWall: [0x6b96bd, 0x9db8ce, 0xb8cfe0, 0x6b9e9c, 0x5c6e7e, 0xb5a289, 0x4f78a3, 0x7d9ab3, 0xc4d0d9, 0x4f7d82, 0xb8b09c, 0x88b8d4, 0x667c91, 0x8db5bc],
      indWall: [0xa9b3bc, 0x8899a8, 0xd8dde2, 0x9fb8b4, 0x778694, 0xbeb7ac, 0x8aa8c2, 0x5e6973, 0xb3ada3, 0xb6c7c2, 0x969fa6, 0xb8a68e],
      heritageWall: [0xf3eee4, 0x594c43, 0xc49c73, 0xe8dec8, 0xd9c196, 0xaba9a4, 0xc94f3b, 0xede5d4, 0xbec7ba, 0xdbc7a8, 0xdfc9bc, 0xd2d0ca],
      heritageRoof: [0x426b5c, 0x32383f, 0x6b4f3a, 0x2b3c52, 0x3d5c58, 0x8c392b, 0x3a4d3f, 0x2c3035, 0xa88240, 0x784333, 0x495159, 0x4e3c31]
    },
    1: { // Osaka / Kansai / Kyoto / Kobe
      houseWall: [0xf0e8da, 0xe3d6c2, 0xd8c7b0, 0x5a5652, 0xc9b296, 0xece3d2, 0xc5d0ca, 0xdcb99f, 0xd2d6da, 0x9fa9b3, 0x8a6f59, 0xead7bf, 0xcfc9be, 0xe5c9b3, 0xb8c2b6, 0xf2efe9],
      houseRoof: [0x33373d, 0x4e392f, 0x27364a, 0x3e4247, 0x6e3c2d, 0x2b2e33, 0x45544a, 0x5d4435, 0x324554, 0x7d4936, 0x3b3836, 0x253242, 0x4d5054, 0x643b30],
      aptWall: [0xebe5dc, 0xd8dce0, 0xd8c6b3, 0xdfb29c, 0xe4d9c8, 0xc8d4ce, 0xa6b3be, 0xd2c4b4, 0xe8d9be, 0x747b82, 0xe2cec2, 0xcad3dc, 0xf0ece4, 0xcfb9a4, 0xd4d0c8, 0xdae2e4],
      brickWall: [0xb95b46, 0xd18a70, 0xc69f78, 0xa24c3c, 0xd6bfa2, 0xb67258, 0xc88e7c, 0x8e5c47, 0xdfc9ae, 0xc77e62, 0x9c8b7c, 0xd4b28a, 0x7b5d50, 0xe2d2bc],
      aptRoof: [0x82868b, 0x70757b, 0x9b9e9f, 0x6c8476, 0x948d81, 0x697886, 0xa9adaf, 0x5d6268, 0x8a837b, 0x6b7f82, 0x9d9484, 0x7a7f85],
      glassWall: [0x6e98bc, 0x8fb0c7, 0x5c85a6, 0x689e9a, 0xb0c6d6, 0xa89780, 0x586b7a, 0x7ca2bd, 0xc2cfd8, 0x4e7c84, 0x82b2cc, 0xb5ab96, 0x657b8f, 0x8fb3b8],
      indWall: [0xa4aeb7, 0x8595a3, 0xd4dadf, 0x9cb3b0, 0x758391, 0xbab3a8, 0x86a3bc, 0x5d6872, 0xb0a99f, 0xb2c2bd, 0x929ba3, 0xb4a28b],
      heritageWall: [0xf2ece0, 0x5c4738, 0xb88b5e, 0xe6d7bc, 0xd6bc8e, 0xc84e39, 0xe9e1d0, 0x9a8976, 0xc2cabd, 0xdbc3a0, 0x786252, 0xded8cc],
      heritageRoof: [0x476b58, 0x343a40, 0x753c2c, 0x2c3d50, 0x5f4a37, 0x3b5852, 0x96402e, 0xa68342, 0x2e3237, 0x4d565c, 0x6d3b2d, 0x3f4f42]
    },
    2: { // Okinawa Naha / Shuri / Chatan (coral-sand walls, pastel resorts & iconic Ryukyu terracotta roofs)
      houseWall: [0xf7f2e8, 0xf0e4d0, 0xead8be, 0xf3d8c6, 0xd8ebe4, 0xcde3ef, 0xf5e8be, 0xe9e5dc, 0xf0cbb4, 0xe3dcd0, 0xd5e6dc, 0xf6eedc, 0xe8d0bc, 0xdbe5eb, 0xf2dfc8, 0xeee9e0],
      houseRoof: [0xc4482e, 0xd45a3a, 0xb03c26, 0xde6f46, 0x9a4632, 0xc95234, 0xbc613e, 0x4a6b7a, 0x3f6e5c, 0xb8412b, 0xd97b4c, 0x824c3c, 0x525b63, 0xcf633e],
      aptWall: [0xf3eee4, 0xeae1d2, 0xf2d9c6, 0xd5e8e1, 0xd0e2ed, 0xf0e5c2, 0xe5dfd4, 0xebd0ba, 0xdce6e8, 0xeadbc4, 0xf5f2ea, 0xcfe0d6, 0xe8cbc0, 0xdfd8cb, 0xf0e4ce, 0xdce3ec],
      brickWall: [0xd99b7c, 0xe3ba96, 0xc97b5d, 0xdcc4a2, 0xe8c7ab, 0xb8694e, 0xd4a984, 0xe2d0b4, 0xc7896e, 0xd8b18c, 0xc29c7e, 0xe6d4bc, 0xb3745b, 0xdfbe9c],
      aptRoof: [0xd6d1c8, 0xc4bfb6, 0xb6b9bc, 0x9eb8ae, 0xc9bfa8, 0x8ca2ae, 0xdcd8cf, 0xa8a69e, 0xbfb4a2, 0x95a8a6, 0xcbc7be, 0xb2b5b8],
      glassWall: [0x64a6c4, 0x7cbcd4, 0x5294b4, 0x62b0a8, 0x94c9dc, 0x72a8c2, 0x4a82a6, 0xa8d2e0, 0x82b8b4, 0x6e9db8, 0xb8d8e4, 0x5e9ca8, 0x8abed4, 0x7ca6be],
      indWall: [0xb4bec4, 0x9aa9b2, 0xdce2e6, 0xa8c4be, 0x8da4b4, 0xc8c2b6, 0x92b4c8, 0x798a96, 0xc0b9ae, 0xbad0ca, 0xa2adb4, 0xc2b29c],
      heritageWall: [0xf6efe0, 0xc9422b, 0xead8bc, 0xd99e42, 0xf0e4cf, 0xb83a26, 0xe2cba6, 0xf2e8d4, 0xd48e58, 0xe6dac4, 0xc4563a, 0xede3d2],
      heritageRoof: [0xc9422b, 0xb03420, 0xdc9d34, 0xd45636, 0x9c2e1c, 0xc24c2e, 0xe07842, 0x8f3a28, 0xc88a32, 0xb83c26, 0xd4663c, 0x5c463b]
    },
    3: { // Hong Kong (iconic pastel residential towers + Central emerald/sapphire/gold skyscrapers)
      houseWall: [0xf4dfd0, 0xebe3d2, 0xd4e8dc, 0xf2d1c4, 0xf5e7be, 0xcce0ee, 0xefd5ba, 0xe8e4dc, 0xd9e8e4, 0xf0c9ba, 0xe4d8e8, 0xf3ead8, 0xdce5d4, 0xebd3c2, 0xd6e2ea, 0xf2ece2],
      houseRoof: [0xa84c36, 0x864938, 0x545d66, 0x946344, 0x3b6954, 0xbc5b3e, 0x66564a, 0x436278, 0x7c4536, 0x9e5c3c, 0x4c5852, 0xb05338, 0x6d747c, 0x8c523c],
      aptWall: [0xf2c2b2, 0xc7e2d5, 0xf5e5b4, 0xc0daf0, 0xf2cca8, 0xf2eadc, 0xe2b38c, 0xdad2e6, 0xc4e2df, 0xf2d6c4, 0xe8dfc8, 0xd2dce8, 0xebbc9c, 0xd5e4cc, 0xefdde0, 0xe4e8ec],
      brickWall: [0xd9967a, 0xe4be92, 0xc4725a, 0xd8b498, 0xc98a72, 0xe6cfad, 0xb8664e, 0xd6a682, 0xc59a84, 0xdfc2a2, 0xb47c68, 0xcca07a, 0xdcb09a, 0xe2cfb6],
      aptRoof: [0x7c8187, 0x6c7279, 0x92979c, 0x6b877c, 0x8e867c, 0x70808e, 0xa2a6aa, 0x5f656c, 0x857f78, 0x738682, 0x989082, 0x767c82],
      glassWall: [0x5894be, 0x489c8e, 0xc9b27c, 0xb8ccd8, 0x4679a8, 0x6cb0c8, 0x7e9eb8, 0x3d847c, 0xd4c496, 0x8eb8d6, 0x5e788e, 0x74b8b0, 0xa4b8c8, 0x5088b2],
      indWall: [0x9aa4ae, 0x84919c, 0xcad2d8, 0x92aba8, 0x74828f, 0xb5afa5, 0x829eb4, 0x606b75, 0xa8a299, 0xa8bcb8, 0x8e98a1, 0xb09f8a],
      heritageWall: [0xf4ebd8, 0xedd5b2, 0xd8e6dc, 0xebd0c0, 0xe6c496, 0xc9dce6, 0xf0e0c4, 0xd6b08c, 0xe2d8c8, 0xc6dad0, 0xebc6a8, 0xf2eee4],
      heritageRoof: [0x38704f, 0xc49032, 0x943b2a, 0x2f5e4a, 0xb04832, 0xd4a43e, 0x466b56, 0x7e3c2e, 0x3b5868, 0xa87c34, 0x526458, 0x8a4230]
    },
    4: { // Seoul / Incheon / Songdo (modern ivory/coral/slate Han River 'apart' + brick villas + sleek glass)
      houseWall: [0xeee7de, 0xe0d6ca, 0xd2b7a4, 0xe4e0d8, 0xc9d4dc, 0xe8d5c2, 0xd8dfd6, 0xd6c2b0, 0xeae2ce, 0xc5ccd4, 0xe2c8ba, 0xdbd4c8, 0xced8d4, 0xe8dfd4, 0xcbb8a6, 0xf0ede8],
      houseRoof: [0x5c433a, 0x424d58, 0x824436, 0x384d45, 0x323942, 0x6b4b3c, 0x2d435c, 0x4c545c, 0x754a3a, 0x3f564c, 0x524640, 0x2c3644, 0x8a523e, 0x464e54],
      aptWall: [0xefeef0, 0xe8e2d8, 0xebc7b6, 0xd5dee8, 0xd4dfd6, 0xe4d8c4, 0xdcdce2, 0xeedcc4, 0xcad6e2, 0xe2d2c4, 0xf2efe8, 0xcfdad8, 0xe4ccc0, 0xd8dce0, 0xeae4d2, 0xc8d2dc],
      brickWall: [0xb45542, 0xc87458, 0xa44b3c, 0xd49a7a, 0xbe684e, 0xc9a382, 0x964c3d, 0xd9b898, 0xb87660, 0x8e5645, 0xcca07c, 0xd28568, 0xa8644f, 0xdcc4a8],
      aptRoof: [0x868c92, 0x747b82, 0x9ca1a6, 0x6e8c7e, 0x968f84, 0x708290, 0xacb0b4, 0x626870, 0x8c8780, 0x6e8584, 0xa09888, 0x7c8288],
      glassWall: [0x6e9bc2, 0x96b8d4, 0x5a84ab, 0xb6cde0, 0x629b9c, 0x82a8c6, 0x4d769e, 0xc4d4e0, 0x708da6, 0x5c7286, 0xa69c88, 0x7cb4ce, 0x8ca2b4, 0x588ca8],
      indWall: [0xa2acb6, 0x8896a4, 0xd2d8de, 0x99b2b0, 0x768594, 0xbab4aa, 0x84a0b8, 0x606c78, 0xaea89e, 0xb0c2be, 0x909aa4, 0xb4a48e],
      heritageWall: [0xf2ece2, 0xd8ccb8, 0xc29e76, 0xe6decb, 0x8e725c, 0xc85440, 0xdfd8cc, 0xb8c2b8, 0xd6be9a, 0xece6da, 0xa8927c, 0xd2d0c8],
      heritageRoof: [0x36444a, 0x3b5e4c, 0x4d545c, 0x8c3e32, 0x2c343b, 0x446858, 0x5c483c, 0x354d58, 0x744234, 0x3e484e, 0x2f473e, 0x565c62]
    },
    5: { // Singapore (vibrant pastel HDB blocks + colorful Peranakan shophouses + Marina glass towers)
      houseWall: [0xf6f0e4, 0xf4e4b4, 0xc4e2d6, 0xf4cfc0, 0xc4def0, 0xf2d9b4, 0xe2ece4, 0xf2e2d4, 0xd6e6e8, 0xefd0c6, 0xe4daf0, 0xf5ecd6, 0xcbe4dc, 0xf0d6b8, 0xd8e4ec, 0xf4f2ec],
      houseRoof: [0xb84a32, 0xc9583c, 0x96402e, 0x525a62, 0xd46842, 0x3a6b58, 0x8c4a38, 0x466378, 0xa84530, 0xc2613e, 0x645448, 0x42564e, 0x9c553a, 0xb04832],
      aptWall: [0xf5e29e, 0xbcdaf0, 0xf2c6b2, 0xc4e6d6, 0xf5f2ec, 0xf2d4ac, 0xe2ae98, 0xdfd8ea, 0xc6e4e2, 0xf0e6cc, 0xd4e2ee, 0xf4d2be, 0xd2e6ce, 0xebd8be, 0xe6e8ec, 0xf2e8d4],
      brickWall: [0x6ec2c4, 0xe89c94, 0xeac470, 0x7cc4a0, 0xd8886c, 0x84b4dc, 0xf0d8a0, 0xdf9ea8, 0x6eb49c, 0xc87458, 0xe4b888, 0x98b8d6, 0xd4947a, 0xead4a8],
      aptRoof: [0x82888c, 0x908a80, 0x747c82, 0x6e8c7e, 0xa2a6a8, 0x8c8478, 0x708492, 0x9a968c, 0x687278, 0x7a8e88, 0xa8a49c, 0x7c8286],
      glassWall: [0x4c9c92, 0x5696c2, 0x6cb8c8, 0x3e887e, 0xb8ccd8, 0xc4ae7e, 0x467ea8, 0x76c0b6, 0x88b8d6, 0x5c8ea4, 0xd0c094, 0x62a8b8, 0x9cb8c8, 0x4c8ca6],
      indWall: [0xa0acb4, 0x8898a2, 0xd2dade, 0x96b6b0, 0x768894, 0xbcb6ac, 0x84a6bc, 0x64727c, 0xaea89e, 0xaec4be, 0x929ea6, 0xb6a690],
      heritageWall: [0xf4ecd8, 0x86c8c6, 0xf2b4a8, 0xf4d88c, 0x92cca8, 0xf0d8b6, 0x96c0e0, 0xeebca4, 0xd2e4da, 0xf2e2be, 0xe2b6c0, 0xf6f0e4],
      heritageRoof: [0xbc4c32, 0xcf9c38, 0x2e6e54, 0xa8402a, 0xd8623c, 0x3c7a62, 0xc48a34, 0x963826, 0x426478, 0xb65436, 0x2c5c4a, 0xc85838]
    },
    6: { // Manila / Makati / BGC (tropical cream/ochre/pastels + colorful terracotta/cobalt/emerald/zinc roofs)
      houseWall: [0xf2e2cc, 0xf6ead6, 0xe8d4b8, 0xcce2ee, 0xd2e8dc, 0xf4d2be, 0xf6e6b6, 0xe2dcd2, 0xefd0b4, 0xdce8d6, 0xebd6c4, 0xf0e4c6, 0xd4dfe8, 0xe8c8b6, 0xe0d8c8, 0xf4eee2],
      houseRoof: [0xb44c34, 0x34648c, 0x2e7858, 0xc8643a, 0x72808a, 0x966846, 0x40749c, 0xa43e2c, 0x3a6c52, 0xd27240, 0x64727c, 0x88523c, 0x2c587a, 0xbe5636],
      aptWall: [0xf0e6d6, 0xe4dcd0, 0xd4dfe8, 0xf0d8c2, 0xd6e6dc, 0xf2e4bc, 0xe8d0be, 0xdfe4e8, 0xebd9be, 0xcde0e4, 0xf4efe6, 0xe2d4c4, 0xead2c4, 0xd8e0d4, 0xede0c8, 0xd6dce2],
      brickWall: [0xd48e6e, 0xe2b88c, 0xbe6e52, 0xd8ba98, 0xc88464, 0xe4cca8, 0xb06248, 0xd2a47e, 0xc29276, 0xdec29c, 0xb87658, 0xcaa078, 0xd8ae90, 0xe2d0b4],
      aptRoof: [0x82807a, 0x72787e, 0x969288, 0x6e867c, 0x8c867c, 0x6e7e8c, 0xa4a29c, 0x646a70, 0x8a8278, 0x748486, 0x9a9080, 0x7a7e82],
      glassWall: [0x6898b8, 0x5486a8, 0x86b2cc, 0x5c9e98, 0xb4c8d6, 0xbfa87e, 0x4c789c, 0x74a6be, 0x9ec0d4, 0x508892, 0xc8ba94, 0x7cb0c4, 0x66849c, 0x8eb8c0],
      indWall: [0x9aa4ac, 0x84909a, 0xcfd6dc, 0x94b0ac, 0x74828e, 0xb8b2a6, 0x829eb6, 0x626e78, 0xaaa49a, 0xacbeba, 0x8e98a0, 0xb2a28c],
      heritageWall: [0xf2e6cf, 0xe6cfa8, 0xdcc49c, 0xebd8b8, 0xf4eedc, 0xd6b88e, 0xe2d2b4, 0xe8c8a2, 0xd8d0be, 0xefe2c6, 0xcfb086, 0xeae0cc],
      heritageRoof: [0xb04830, 0x546470, 0xce943a, 0x963c28, 0xc45c38, 0x3a6456, 0x824c38, 0x425e74, 0xb85234, 0xa87c36, 0x6c584a, 0x9e422e]
    },
    7: { // Bangkok / Suvarnabhumi (cream/ochre/pastels + orange/red/emerald/blue Thai roofs + golden Wats)
      houseWall: [0xf4ead6, 0xecdab8, 0xf6efe0, 0xd4e8dc, 0xcce0ee, 0xf4d2c0, 0xf6e6b2, 0xe4d6be, 0xf0cca8, 0xdce6d4, 0xebd8c4, 0xf2e4c2, 0xd6e2ea, 0xeec6bc, 0xe2dac8, 0xf5f0e4],
      houseRoof: [0xd05630, 0x30786c, 0x2c6292, 0xbc422a, 0x2e7d52, 0xdc6e38, 0x7e5842, 0x3a7088, 0xc44c2e, 0x368460, 0x9c4830, 0x2a5480, 0xd47e3c, 0xb23e28],
      aptWall: [0xf2e6d2, 0xe6dcd0, 0xd4dfe8, 0xf0d8be, 0xd4e6da, 0xf4e4b8, 0xecd0be, 0xe2e4e8, 0xebd8b8, 0xcce0e2, 0xf5f0e4, 0xe4d4be, 0xecd4c6, 0xd6e2d2, 0xf0e0c4, 0xd8dce4],
      brickWall: [0xd88e6a, 0xe4b884, 0xc46c4e, 0xdcba94, 0xcc8260, 0xe8cea4, 0xb45e44, 0xd6a47a, 0xc69072, 0xe0c498, 0xbc7454, 0xce9e72, 0xdcae8c, 0xe4d2b2],
      aptRoof: [0x828078, 0x70767c, 0x969286, 0x6c887a, 0x8e8678, 0x6e808e, 0xa4a29a, 0x646a70, 0x8a8276, 0x728684, 0x9c9280, 0x7a7e82],
      glassWall: [0x6a98ba, 0x529694, 0xc4aa78, 0x88b4ce, 0x4c7ea4, 0xb4c8d6, 0x64a8b4, 0xd2be8e, 0x78a4c2, 0x3e847c, 0x9ac0d4, 0x628098, 0x7cb6b0, 0x588ca8],
      indWall: [0x9aa4ac, 0x86929c, 0xd2d8de, 0x96b2ae, 0x768490, 0xbab4a8, 0x84a0b6, 0x64707a, 0xaca69c, 0xaec0bc, 0x909aa2, 0xb4a48e],
      heritageWall: [0xf8f3e6, 0xf2e2be, 0xeed4a0, 0xf4ead4, 0xe8c47c, 0xdce8dc, 0xf6e8c6, 0xe4c694, 0xf2ecd8, 0xd8e2e6, 0xebd09e, 0xf5efe0],
      heritageRoof: [0xe0a224, 0xc43a24, 0x248252, 0xd46228, 0x2a6694, 0xebba34, 0xaa301e, 0x2c9460, 0xc87826, 0x1e6b46, 0xdc4a2a, 0xc2922c]
    },
    8: { // Kuala Lumpur, Malaysia (tropical condos, colonial & Peranakan shophouses, KLCC steel/teal glass)
      houseWall: [0xf4eee2, 0xefe2c6, 0xd2e6dc, 0xf2d2c0, 0xcce0ee, 0xecd6b6, 0xe4ebe4, 0xf0e0ce, 0xd8e6e6, 0xedd0c4, 0xe4dce8, 0xf4ead4, 0xcce2da, 0xeed4b6, 0xd8e2ea, 0xf2efe8],
      houseRoof: [0x9c4e36, 0x665652, 0xb46240, 0x4a525a, 0xc25438, 0x7c4838, 0x3c6454, 0x885640, 0x584c46, 0x425e74, 0xa84a32, 0x70584a, 0x904632, 0x525c64],
      aptWall: [0xf2ece0, 0xe4e8ec, 0xf0dfc2, 0xcce2da, 0xf0cfc0, 0xc8dcf0, 0xeae2d2, 0xdce6de, 0xebd2b8, 0xd6e0ea, 0xf4f0e6, 0xe2d4c8, 0xd2e4e2, 0xeedcc0, 0xe4d8e4, 0xdce2e6],
      brickWall: [0xd6886c, 0x7abec0, 0xe4be78, 0xc46e54, 0x84c0a0, 0xdcb490, 0x88b2d4, 0xe49c90, 0xcaa07a, 0xb86a52, 0xe2cca4, 0x78ae9a, 0xd4967e, 0xe6d2ae],
      aptRoof: [0x80868a, 0x8e887e, 0x727a80, 0x6c887c, 0xa0a4a8, 0x8a8278, 0x6e8290, 0x98948a, 0x667076, 0x788c86, 0xa6a29a, 0x7a8084],
      glassWall: [0x9eb2b8, 0x589a9c, 0x6898ba, 0xbec8cc, 0x4a868c, 0x84a8b8, 0xc6b488, 0x5282a6, 0x70b0b4, 0xaac0ca, 0x627c8e, 0x8eb8c6, 0x467a8a, 0xb0c2c6],
      indWall: [0x9eaab2, 0x8696a0, 0xd0d8dc, 0x94b2ac, 0x748692, 0xbab4aa, 0x82a2b8, 0x62707a, 0xaca69c, 0xacc2bc, 0x909ca4, 0xb4a48e],
      heritageWall: [0xf6efe0, 0xeed8b4, 0x8cc4c2, 0xf0c4b4, 0xf2dc9c, 0x96c8a8, 0xe8d0a8, 0x9ec0dc, 0xecd8c4, 0xd6e4da, 0xf4e4c2, 0xf2ece2],
      heritageRoof: [0xb44c32, 0xc89236, 0x326a54, 0x9c402c, 0x6a5448, 0xd0623c, 0x3e7460, 0x883c2a, 0x446074, 0xb88034, 0x565e64, 0xa64830]
    },
    9: { // Jakarta, Indonesia (sea of warm Javanese genteng terracotta roofs + tropical cream/ochre + Sudirman glass)
      houseWall: [0xf2e4ce, 0xead8bc, 0xf5eee0, 0xd6e6d8, 0xcce0ec, 0xf2d4be, 0xf4e4b4, 0xe2d8c8, 0xecd0b2, 0xdce4d2, 0xe8d4be, 0xf0e2c0, 0xd6e0e8, 0xe6c8b4, 0xded6c6, 0xf4ece0],
      houseRoof: [0xc85832, 0xd66a3c, 0xb54829, 0xdf7b4a, 0x9e4228, 0xbe5230, 0x8c4c38, 0x366e56, 0x345e84, 0xcc6036, 0xa8462c, 0xd07242, 0x78503e, 0xb84e2e],
      aptWall: [0xebe2ce, 0xd8dad6, 0xf0e8d8, 0xd4e2e8, 0xecd4be, 0xd6e4d8, 0xf2e2bc, 0xe4d6c4, 0xdfe2e4, 0xe8d8be, 0xcce0e0, 0xf4efe4, 0xe2d0be, 0xd6ded4, 0xede0c6, 0xd8dce0],
      brickWall: [0xcf7d5c, 0xdeb084, 0xbc6448, 0xd6b490, 0xc67c5c, 0xe2c8a2, 0xa85840, 0xd09e78, 0xbe8a6e, 0xdcbe98, 0xb46e50, 0xc89872, 0xd6a888, 0xe0ccb0],
      aptRoof: [0x848078, 0x72787e, 0x969086, 0x6e867a, 0x8e8478, 0x6e7e8c, 0xa4a098, 0x666c72, 0x8c8276, 0x748484, 0x9c907e, 0x7a7e82],
      glassWall: [0x6696b6, 0x5288a6, 0x84b0c8, 0x569c94, 0xb2c6d4, 0xc0a87c, 0x4a7a9c, 0x72a4bc, 0x9cbec8, 0x4c868e, 0xcab890, 0x7ab0c2, 0x64829a, 0x8cb6be],
      indWall: [0x9aa4ac, 0x84909a, 0xcfd6dc, 0x94b0ac, 0x74828e, 0xb8b2a6, 0x829eb6, 0x626e78, 0xaaa49a, 0xacbeba, 0x8e98a0, 0xb2a28c],
      heritageWall: [0xf4ead4, 0xe8d4b0, 0xdec69e, 0xeddcb8, 0xf6f0e0, 0xd8ba90, 0xe4d4b6, 0xeacaa4, 0xdad2c0, 0xf0e4c8, 0xd2b288, 0xece2ce],
      heritageRoof: [0xc4522e, 0xd26638, 0xa84226, 0xc89036, 0x326a52, 0xb84a2c, 0x8c4a36, 0x406076, 0xd87642, 0x9c3e26, 0x6e5446, 0xbe5634]
    }
  };

  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return x - Math.floor(x);
  }

  function pickColor(arr, tone, fallbackSalt, seed = 0) {
    if (!arr || !arr.length) return new THREE.Color(0xd8d8d8);
    const baseF = Number.isFinite(tone) ? tone : fallbackSalt;
    const mixF = (baseF * 0.62 + hash01(seed * 1.13 + 0.7) * 0.38) % 1;
    const f = Math.max(0, Math.min(0.9999, mixF < 0 ? mixF + 1 : mixF));
    const hex = arr[Math.floor(f * arr.length) % arr.length];
    const c = new THREE.Color(hex);
    const dh = (hash01(seed * 3.17 + baseF * 19.3) - 0.5) * 0.05;  // ±0.025
    const ds = (hash01(seed * 5.41 + baseF * 29.7) - 0.5) * 0.16;  // ±0.08
    const dl = (hash01(seed * 7.83 + baseF * 41.1) - 0.5) * 0.14;  // ±0.07
    c.offsetHSL(dh, ds, dl);
    return c;
  }

  // Known hero monument coords matching taiwan-city.js so OSM footprints don't clip hero towers
  const HERO_MASKS = [
    [35.71006, 139.81070, 95],   // Tokyo Skytree
    [35.65858, 139.74543, 85],   // Tokyo Tower
    [35.78580, 140.31830, 45],   // Narita-san Pagoda
    [22.28520, 114.15810, 95],   // HK Central IFC
    [22.28480, 114.15930, 42],   // HK BOC Hero Prism
    [22.30340, 114.16020, 75],   // HK ICC
    [37.51250, 127.10250, 85],   // Seoul Lotte
    [37.55120, 126.98820, 60],   // N Seoul Tower
    [1.28340, 103.86070, 105],   // Marina Bay Sands
    [1.28160, 103.86360, 70],    // Gardens by the Bay Supertrees
    [26.21450, 127.68400, 65],   // Okinawa Shuri Hero Plaza
    [26.21700, 127.71950, 55],   // Okinawa Shuri Real Site
    [14.53420, 121.00080, 65],   // Manila MOA Eye Ferris Wheel
    [34.68730, 135.52620, 75],   // Osaka Castle
    [34.70550, 135.48960, 70],   // Osaka Umeda Sky Building
    [13.75000, 100.49130, 100],  // Bangkok Grand Palace
    [13.72360, 100.52830, 60]    // Bangkok MahaNakhon
  ].map(([lat, lon, r]) => {
    const p = typeof geoPoint === 'function' ? geoPoint(lat, lon) : { x: 0, z: 0 };
    return { x: p.x, z: p.z, rSq: r * r };
  });

  function inHeroMask(x, z) {
    for (const h of HERO_MASKS) {
      const dx = x - h.x, dz = z - h.z;
      if (dx * dx + dz * dz < h.rSq) return true;
    }
    return false;
  }

  function isInAirportZone(x, z) {
    if (typeof runwayCoordinates !== 'function') return false;
    for (const a of airports) {
      if (!a || !a.length) continue;
      if (Math.abs(x - a.x) > a.length + 500 || Math.abs(z - a.z) > a.length + 500) continue;
      const { along, cross } = runwayCoordinates(x, z, a);
      if (Math.abs(along) <= a.length * 0.5 + 140 && Math.abs(cross) <= a.width * 0.5 + 85) return true;
    }
    return false;
  }

  function safeGround(x, z) {
    const raw = ground(x, z);
    // Reclaimed harbor/canal edges may evaluate right near 0; keep real OSM land buildings visible >= 1.5m
    return raw > 1.2 ? raw : 2.2;
  }

  function buffers() { return { p: [], n: [], uv: [], c: [] }; }

  function pushTri(out, ax, ay, az, bx, by, bz, cx, cy, cz, cr, cg, cb, nx, ny, nz, u0, v0, u1, v1, u2, v2) {
    out.p.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    out.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    out.uv.push(u0, v0, u1, v1, u2, v2);
    out.c.push(cr, cg, cb, cr, cg, cb, cr, cg, cb);
  }

  function pushTriV(out, ax, ay, az, ar, ag, ab, bx, by, bz, br, bg, bb, cx, cy, cz, cr, cg, cb, nx, ny, nz, u0, v0, u1, v1, u2, v2) {
    out.p.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    out.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    out.uv.push(u0, v0, u1, v1, u2, v2);
    out.c.push(ar, ag, ab, br, bg, bb, cr, cg, cb);
  }

  function emitSlopedTri(out, ax, ay, az, bx, by, bz, cx, cy, cz, cr, cg, cb, uvScale = 0.12) {
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    const flipped = ny < 0;
    if (flipped) { nx = -nx; ny = -ny; nz = -nz; }
    // Subtle sun-slope directional shading so pitched roofs pop cleanly in 3D
    const shade = 0.87 + 0.15 * (0.45 + 0.35 * nx + 0.20 * ny + 0.15 * nz);
    const sr = Math.min(1, cr * shade), sg = Math.min(1, cg * shade), sb = Math.min(1, cb * shade);
    if (flipped) {
      pushTri(out, ax, ay, az, cx, cy, cz, bx, by, bz, sr, sg, sb, nx, ny, nz,
        ax * uvScale, az * uvScale, cx * uvScale, cz * uvScale, bx * uvScale, bz * uvScale);
    } else {
      pushTri(out, ax, ay, az, bx, by, bz, cx, cy, cz, sr, sg, sb, nx, ny, nz,
        ax * uvScale, az * uvScale, bx * uvScale, bz * uvScale, cx * uvScale, cz * uvScale);
    }
  }

  function emitUpPoly(out, pts, y, col, uvScale = 0.25) {
    const cr = col.r, cg = col.g, cb = col.b;
    const emit = (p0, p1, p2) => {
      if ((p1[1] - p0[1]) * (p2[0] - p0[0]) - (p1[0] - p0[0]) * (p2[1] - p0[1]) > 0) {
        pushTri(out, p0[0], y, p0[1], p1[0], y, p1[1], p2[0], y, p2[1], cr, cg, cb, 0, 1, 0,
          p0[0] * uvScale, p0[1] * uvScale, p1[0] * uvScale, p1[1] * uvScale, p2[0] * uvScale, p2[1] * uvScale);
      } else {
        pushTri(out, p0[0], y, p0[1], p2[0], y, p2[1], p1[0], y, p1[1], cr, cg, cb, 0, 1, 0,
          p0[0] * uvScale, p0[1] * uvScale, p2[0] * uvScale, p2[1] * uvScale, p1[0] * uvScale, p1[1] * uvScale);
      }
    };
    if (pts.length === 3) { emit(pts[0], pts[1], pts[2]); return; }
    const contour = pts.map(p => new THREE.Vector2(p[0], p[1]));
    for (const ids of THREE.ShapeUtils.triangulateShape(contour, [])) {
      emit(pts[ids[0]], pts[ids[1]], pts[ids[2]]);
    }
  }

  function emitWalls(out, pts, minY, topY, cx, cz, col) {
    const cr = col.r, cg = col.g, cb = col.b;
    const h = topY - minY;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const ex = b[0] - a[0], ez = b[1] - a[1];
      const len = Math.hypot(ex, ez);
      if (len < 0.35) continue;
      let nx = ez / len, nz = -ex / len;
      const mx = (a[0] + b[0]) * 0.5 - cx, mz = (a[1] + b[1]) * 0.5 - cz;
      const flip = mx * nx + mz * nz < 0;
      if (flip) { nx = -nx; nz = -nz; }
      // Directional facade contrast + street-level vertical ambient occlusion
      const dirShade = 0.86 + 0.14 * (0.5 + 0.35 * nx + 0.15 * nz);
      const tr = Math.min(1, cr * dirShade);
      const tg = Math.min(1, cg * dirShade);
      const tb = Math.min(1, cb * dirShade);
      const br = tr * 0.87, bg = tg * 0.87, bb = tb * 0.87;
      if (!flip) {
        pushTriV(out, a[0], minY, a[1], br, bg, bb, b[0], minY, b[1], br, bg, bb, b[0], topY, b[1], tr, tg, tb, nx, 0, nz, 0, 0, len, 0, len, h);
        pushTriV(out, a[0], minY, a[1], br, bg, bb, b[0], topY, b[1], tr, tg, tb, a[0], topY, a[1], tr, tg, tb, nx, 0, nz, 0, 0, len, h, 0, h);
      } else {
        pushTriV(out, a[0], minY, a[1], br, bg, bb, a[0], topY, a[1], tr, tg, tb, b[0], topY, b[1], tr, tg, tb, nx, 0, nz, 0, 0, 0, h, len, h);
        pushTriV(out, a[0], minY, a[1], br, bg, bb, b[0], topY, b[1], tr, tg, tb, b[0], minY, b[1], br, bg, bb, nx, 0, nz, 0, 0, len, h, len, 0);
      }
    }
  }

  function polyArea(pts) {
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      a += p[0] * q[1] - q[0] * p[1];
    }
    return Math.abs(a) * 0.5;
  }

  function isConvexPoly(pts) {
    const n = pts.length;
    if (n < 3 || n > 10) return false;
    let sign = 0;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n], c = pts[(i + 2) % n];
      const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (Math.abs(cross) > 1e-4) {
        const s = cross > 0 ? 1 : -1;
        if (sign === 0) sign = s;
        else if (sign !== s) return false;
      }
    }
    return sign !== 0;
  }

  function insetPoly(pts, cx, cz, frac) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      out.push([cx + (pts[i][0] - cx) * frac, cz + (pts[i][1] - cz) * frac]);
    }
    return out;
  }

  function addRooftopMechanical(wallBuf, roofBuf, cx, cz, spanX, spanZ, topY, h, col, seed) {
    const pw = Math.max(4.2, Math.min(11, spanX * (0.28 + 0.10 * hash01(seed + 1.3))));
    const pd = Math.max(4.2, Math.min(11, spanZ * (0.28 + 0.10 * hash01(seed + 2.7))));
    const ph = Math.min(5.2, Math.max(2.4, 2.2 + h * 0.045));
    const pent = [
      [cx - pw * 0.5, cz - pd * 0.5],
      [cx + pw * 0.5, cz - pd * 0.5],
      [cx + pw * 0.5, cz + pd * 0.5],
      [cx - pw * 0.5, cz + pd * 0.5]
    ];
    const mechCol = col.clone().offsetHSL(0, -0.04, -0.05);
    emitWalls(wallBuf, pent, topY - 0.25, topY + ph, cx, cz, mechCol);
    emitUpPoly(roofBuf, pent, topY + ph, mechCol);
    // Secondary smaller HVAC / elevator stairhead box on wider tall rooftops
    if (spanX > 18 && spanZ > 18 && h >= 28) {
      const sw = pw * 0.46, sd = pd * 0.44, sh = ph * 0.62;
      const ox = cx + (hash01(seed + 4.1) > 0.5 ? pw * 0.42 : -pw * 0.42);
      const oz = cz + (hash01(seed + 6.9) > 0.5 ? pd * 0.36 : -pd * 0.36);
      const sub = [
        [ox - sw * 0.5, oz - sd * 0.5],
        [ox + sw * 0.5, oz - sd * 0.5],
        [ox + sw * 0.5, oz + sd * 0.5],
        [ox - sw * 0.5, oz + sd * 0.5]
      ];
      emitWalls(wallBuf, sub, topY - 0.25, topY + sh, ox, oz, mechCol);
      emitUpPoly(roofBuf, sub, topY + sh, mechCol);
    }
  }

  function emitPitchedRoof(out, pts, cx, cz, eaveY, peakY, col, insetFrac = 0.20) {
    // Orient main ridge along footprint's longest edge
    let bestLen = -1, ux = 1, uz = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const l = dx * dx + dz * dz;
      if (l > bestLen) {
        bestLen = l;
        const d = Math.sqrt(l) || 1;
        ux = dx / d; uz = dz / d;
      }
    }
    const vx = -uz, vz = ux;
    let uMin = 1e9, uMax = -1e9, vMin = 1e9, vMax = -1e9;
    for (const p of pts) {
      const dx = p[0] - cx, dz = p[1] - cz;
      const u = dx * ux + dz * uz;
      const v = dx * vx + dz * vz;
      if (u < uMin) uMin = u;
      if (u > uMax) uMax = u;
      if (v < vMin) vMin = v;
      if (v > vMax) vMax = v;
    }
    const uSpan = uMax - uMin;
    const trim = Math.min(uSpan * insetFrac, Math.max(0.8, (vMax - vMin) * 0.45));
    const uA = uMin + trim, uB = uMax - trim;
    const rx0 = cx + ux * uA, rz0 = cz + uz * uA;
    const rx1 = cx + ux * uB, rz1 = cz + uz * uB;
    const singlePeak = Math.hypot(rx1 - rx0, rz1 - rz0) < 0.8;
    const cr = col.r, cg = col.g, cb = col.b;

    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if (singlePeak) {
        emitSlopedTri(out, a[0], eaveY, a[1], b[0], eaveY, b[1], (rx0 + rx1) * 0.5, peakY, (rz0 + rz1) * 0.5, cr, cg, cb);
        continue;
      }
      const ua = ((a[0] - cx) * ux + (a[1] - cz) * uz) >= (uMin + uMax) * 0.5 ? 1 : 0;
      const ub = ((b[0] - cx) * ux + (b[1] - cz) * uz) >= (uMin + uMax) * 0.5 ? 1 : 0;
      const raX = ua ? rx1 : rx0, raZ = ua ? rz1 : rz0;
      const rbX = ub ? rx1 : rx0, rbZ = ub ? rz1 : rz0;
      if (ua === ub) {
        emitSlopedTri(out, a[0], eaveY, a[1], b[0], eaveY, b[1], raX, peakY, raZ, cr, cg, cb);
      } else {
        emitSlopedTri(out, a[0], eaveY, a[1], b[0], eaveY, b[1], rbX, peakY, rbZ, cr, cg, cb);
        emitSlopedTri(out, a[0], eaveY, a[1], rbX, peakY, rbZ, raX, peakY, raZ, cr, cg, cb);
      }
    }
  }

  function addLayerMesh(group, data, mat, name) {
    if (!data.p.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(data.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(data.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(data.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(data.c, 3));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.name = name;
    m.receiveShadow = true;
    m.castShadow = true;
    group.add(m);
  }

  function* buildTile(key, data, tileRegId) {
    const regId = data.r ?? tileRegId ?? 0;
    const pal = REG_PALETTES[regId] || REG_PALETTES[0];
    const group = new THREE.Group();
    group.name = 'World city tile ' + key;
    group.userData.masks = [];
    group.userData.obstacles = [];

    const glassTowerBuf = buffers();
    const aptBuf = buffers();
    const brickBuf = buffers();
    const houseBuf = buffers();
    const heritageBuf = buffers();
    const indBuf = buffers();
    const pitchedBuf = buffers();
    const heritageRoofBuf = buffers();
    const flatBuf = buffers();

    const list = data.b || [];
    for (let idx = 0; idx < list.length; idx++) {
      const item = list[idx];
      const bx = data.x + item[0], bz = data.z + item[1];
      const h = item[2], tone = item[3], kind = item[4], raw = item[5];
      if (!raw || raw.length < 6) continue;
      if (isInAirportZone(bx, bz) || inHeroMask(bx, bz)) continue;

      const pts = [];
      let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
      let sumX = 0, sumZ = 0;
      for (let i = 0; i < raw.length; i += 2) {
        const px = data.x + raw[i], pz = data.z + raw[i + 1];
        pts.push([px, pz]);
        sumX += px; sumZ += pz;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (pz < minZ) minZ = pz;
        if (pz > maxZ) maxZ = pz;
      }
      if (pts.length < 3) continue;

      const spanX = maxX - minX, spanZ = maxZ - minZ;
      const avgX = sumX / pts.length, avgZ = sumZ / pts.length;
      const area = polyArea(pts);
      const convex = isConvexPoly(pts);

      const gY = safeGround(bx, bz);
      let baseG = gY;
      for (let i = 0; i < pts.length; i++) {
        const gp = safeGround(pts[i][0], pts[i][1]);
        if (gp < baseG) baseG = gp;
      }
      const minY = baseG - 2.6;
      const topY = gY + h;

      if (h >= 10 && typeof BuildingCollision !== 'undefined' && BuildingCollision.add) {
        BuildingCollision.add('wc_' + key, minX, minZ, maxX, maxZ, topY, minY);
      }

      if (group.userData.masks.length < 180) {
        group.userData.masks.push([bx, bz, Math.max(8, Math.max(spanX, spanZ) * 0.55)]);
      }

      const seed = bx * 0.13 + bz * 0.29 + idx * 1.73;
      const archHash = hash01(seed * 2.17 + (Number.isFinite(tone) ? tone : 0.5) * 11.3);

      if (kind === 3) {
        // Real pitched-roof residential house (mix of crisp siding/stucco & warm brick villas)
        const useBrick = (h >= 7.2 && archHash < 0.26) || archHash < 0.16;
        const wCol = useBrick
          ? pickColor(pal.brickWall || pal.houseWall, tone, 0.35, seed)
          : pickColor(pal.houseWall, tone, 0.3, seed);
        const rCol = pickColor(pal.houseRoof, (tone * 1.37) % 1, 0.2, seed + 17.1);
        const eaveH = Math.max(2.6, h - Math.min(3.4, Math.max(1.2, Math.min(spanX, spanZ) * 0.25)));
        const eaveY = gY + eaveH;
        const ridgeInset = 0.14 + 0.12 * hash01(seed + 8.3);
        emitWalls(useBrick ? brickBuf : houseBuf, pts, minY, eaveY, avgX, avgZ, wCol);
        if (pts.length > 5) emitUpPoly(pitchedBuf, pts, eaveY, rCol);
        emitPitchedRoof(pitchedBuf, pts, avgX, avgZ, eaveY, topY, rCol, ridgeInset);
      } else if (kind === 4) {
        // Cultural temple / shrine / heritage landmark with ornate stone/plaster walls & glazed roof
        const wCol = pickColor(pal.heritageWall || pal.houseWall, tone, 0.25, seed);
        const rCol = pickColor(pal.heritageRoof, tone, 0.1, seed + 11.7);
        const eaveY = gY + h * 0.62;
        emitWalls(heritageBuf, pts, minY, eaveY, avgX, avgZ, wCol);
        if (pts.length > 5) emitUpPoly(heritageRoofBuf, pts, eaveY, rCol);
        if (h >= 12 && convex && spanX > 10 && spanZ > 10) {
          // Two-tier traditional / colonial heritage roof crown
          const midY = eaveY + (topY - eaveY) * 0.48;
          emitPitchedRoof(heritageRoofBuf, pts, avgX, avgZ, eaveY, midY + 1.2, rCol, 0.24);
          const upperPts = insetPoly(pts, avgX, avgZ, 0.56);
          emitWalls(heritageBuf, upperPts, midY - 0.3, midY + 1.6, avgX, avgZ, wCol);
          emitPitchedRoof(heritageRoofBuf, upperPts, avgX, avgZ, midY + 1.6, topY + 1.4, rCol, 0.28);
        } else {
          emitPitchedRoof(heritageRoofBuf, pts, avgX, avgZ, eaveY, topY, rCol, 0.26);
        }
      } else if (kind === 2) {
        // Industrial warehouse / hangar / station hall
        const wCol = pickColor(pal.indWall, tone, 0.4, seed);
        const rCol = pickColor(pal.aptRoof, (tone * 1.41) % 1, 0.45, seed + 5.3);
        emitWalls(indBuf, pts, minY, topY - 0.8, avgX, avgZ, wCol);
        emitPitchedRoof(flatBuf, pts, avgX, avgZ, topY - 0.8, topY + 0.7, rCol, 0.08);
        if (spanX > 22 && spanZ > 22) {
          addRooftopMechanical(indBuf, flatBuf, avgX, avgZ, spanX * 0.75, spanZ * 0.75, topY + 0.3, h, rCol, seed);
        }
      } else if (kind === 1 || kind === 5) {
        // Commercial office / skyscraper / downtown mixed-use routed across glass, brick, heritage & modern concrete
        const rCol = pickColor(pal.aptRoof, (tone * 1.63) % 1, 0.35, seed + 19.3);
        let wallBuf = glassTowerBuf;
        let wCol;
        if (h >= 28 || (h >= 15 && archHash < 0.70) || archHash < 0.48) {
          wallBuf = glassTowerBuf;
          wCol = pickColor(pal.glassWall, tone, 0.5, seed);
        } else if (h <= 26 && area > 200 && archHash >= 0.90) {
          wallBuf = heritageBuf;
          wCol = pickColor(pal.heritageWall || pal.aptWall, tone, 0.4, seed);
        } else if (archHash < 0.84) {
          wallBuf = brickBuf;
          wCol = pickColor(pal.brickWall || pal.aptWall, tone, 0.45, seed);
        } else {
          wallBuf = aptBuf;
          wCol = pickColor(pal.aptWall, tone, 0.5, seed);
        }

        // Tall towers (h >= 36m): stepped setback architectural crown + rooftop mechanical penthouse
        if (h >= 36 && spanX > 14 && spanZ > 14) {
          const crownH = Math.min(9.5, Math.max(4.0, h * 0.11));
          const stepY = topY - crownH;
          emitWalls(wallBuf, pts, minY, stepY, avgX, avgZ, wCol);
          emitUpPoly(flatBuf, pts, stepY, rCol);
          const crownPts = convex
            ? insetPoly(pts, avgX, avgZ, 0.76)
            : [
                [avgX - spanX * 0.34, avgZ - spanZ * 0.34],
                [avgX + spanX * 0.34, avgZ - spanZ * 0.34],
                [avgX + spanX * 0.34, avgZ + spanZ * 0.34],
                [avgX - spanX * 0.34, avgZ + spanZ * 0.34]
              ];
          const crownCol = wCol.clone().offsetHSL(0, 0.03, 0.04);
          emitWalls(wallBuf, crownPts, stepY - 0.3, topY, avgX, avgZ, crownCol);
          emitUpPoly(flatBuf, crownPts, topY, rCol);
          addRooftopMechanical(indBuf, flatBuf, avgX, avgZ, spanX * 0.76, spanZ * 0.76, topY, h, rCol, seed);
        } else {
          emitWalls(wallBuf, pts, minY, topY, avgX, avgZ, wCol);
          emitUpPoly(flatBuf, pts, topY, rCol);
          if (h >= 24 && spanX > 11 && spanZ > 11) {
            addRooftopMechanical(indBuf, flatBuf, avgX, avgZ, spanX, spanZ, topY, h, rCol, seed);
          }
        }
      } else {
        // Urban residential / apartment / shophouse (`kind === 0`) routed across 5 authentic architectural styles
        const rCol = pickColor(pal.aptRoof, (tone * 1.7) % 1, 0.3, seed + 23.7);
        if (h <= 9.5 && area < 185 && archHash >= 0.92) {
          // Low-rise residential home with pitched tile roof
          const wCol = pickColor(pal.houseWall, tone, 0.35, seed);
          const prCol = pickColor(pal.houseRoof, (tone * 1.43) % 1, 0.25, seed + 13.1);
          const eaveY = gY + Math.max(2.6, h - Math.min(2.8, Math.max(1.1, Math.min(spanX, spanZ) * 0.22)));
          emitWalls(houseBuf, pts, minY, eaveY, avgX, avgZ, wCol);
          if (pts.length > 5) emitUpPoly(pitchedBuf, pts, eaveY, prCol);
          emitPitchedRoof(pitchedBuf, pts, avgX, avgZ, eaveY, topY, prCol, 0.19);
        } else if (h <= 18 && archHash >= 0.84 && archHash < 0.92) {
          // Historic colonial / traditional shophouse or civic building
          const wCol = pickColor(pal.heritageWall || pal.aptWall, tone, 0.3, seed);
          if (h <= 11 && area < 250) {
            const prCol = pickColor(pal.houseRoof, (tone * 1.29) % 1, 0.3, seed + 9.7);
            const eaveY = gY + Math.max(3.2, h - 2.2);
            emitWalls(heritageBuf, pts, minY, eaveY, avgX, avgZ, wCol);
            emitPitchedRoof(pitchedBuf, pts, avgX, avgZ, eaveY, topY, prCol, 0.22);
          } else {
            emitWalls(heritageBuf, pts, minY, topY, avgX, avgZ, wCol);
            emitUpPoly(flatBuf, pts, topY, rCol);
          }
        } else if (h >= 40 && archHash < 0.36) {
          // Modern high-rise glass residential / mixed-use condo tower with stepped crown
          const wCol = pickColor(pal.glassWall, tone, 0.5, seed);
          if (spanX > 14 && spanZ > 14) {
            const crownH = Math.min(8.5, Math.max(3.6, h * 0.10));
            const stepY = topY - crownH;
            emitWalls(glassTowerBuf, pts, minY, stepY, avgX, avgZ, wCol);
            emitUpPoly(flatBuf, pts, stepY, rCol);
            const crownPts = convex
              ? insetPoly(pts, avgX, avgZ, 0.78)
              : [
                  [avgX - spanX * 0.34, avgZ - spanZ * 0.34],
                  [avgX + spanX * 0.34, avgZ - spanZ * 0.34],
                  [avgX + spanX * 0.34, avgZ + spanZ * 0.34],
                  [avgX - spanX * 0.34, avgZ + spanZ * 0.34]
                ];
            emitWalls(glassTowerBuf, crownPts, stepY - 0.3, topY, avgX, avgZ, wCol.clone().offsetHSL(0, 0.02, 0.04));
            emitUpPoly(flatBuf, crownPts, topY, rCol);
            addRooftopMechanical(indBuf, flatBuf, avgX, avgZ, spanX * 0.78, spanZ * 0.78, topY, h, rCol, seed);
          } else {
            emitWalls(glassTowerBuf, pts, minY, topY, avgX, avgZ, wCol);
            emitUpPoly(flatBuf, pts, topY, rCol);
            if (spanX > 10 && spanZ > 10) addRooftopMechanical(indBuf, flatBuf, avgX, avgZ, spanX, spanZ, topY, h, rCol, seed);
          }
        } else if (h <= 28 && archHash >= 0.54 && archHash < 0.84) {
          // Warm brick / masonry / Peranakan / tiled mid-rise urban block
          const wCol = pickColor(pal.brickWall || pal.aptWall, tone, 0.45, seed);
          emitWalls(brickBuf, pts, minY, topY, avgX, avgZ, wCol);
          emitUpPoly(flatBuf, pts, topY, rCol);
          if (h >= 24 && spanX > 11 && spanZ > 11) {
            addRooftopMechanical(indBuf, flatBuf, avgX, avgZ, spanX, spanZ, topY, h, rCol, seed);
          } else if (h >= 12 && spanX > 10 && spanZ > 10 && hash01(seed + 5.1) < 0.58) {
            const pw = Math.min(7.5, spanX * 0.28), pd = Math.min(7.5, spanZ * 0.28);
            const pent = [[avgX - pw / 2, avgZ - pd / 2], [avgX + pw / 2, avgZ - pd / 2], [avgX + pw / 2, avgZ + pd / 2], [avgX - pw / 2, avgZ + pd / 2]];
            emitWalls(brickBuf, pent, topY - 0.2, topY + 2.5, avgX, avgZ, rCol);
            emitUpPoly(flatBuf, pent, topY + 2.5, rCol);
          }
        } else {
          // Modern multi-story balcony apartment block (vibrant regional pastels / ivory / porcelain)
          const wCol = pickColor(pal.aptWall, tone, 0.5, seed);
          if (h >= 42 && spanX > 14 && spanZ > 14) {
            const crownH = Math.min(7.0, Math.max(3.2, h * 0.09));
            const stepY = topY - crownH;
            emitWalls(aptBuf, pts, minY, stepY, avgX, avgZ, wCol);
            emitUpPoly(flatBuf, pts, stepY, rCol);
            const crownPts = convex
              ? insetPoly(pts, avgX, avgZ, 0.80)
              : [
                  [avgX - spanX * 0.35, avgZ - spanZ * 0.35],
                  [avgX + spanX * 0.35, avgZ - spanZ * 0.35],
                  [avgX + spanX * 0.35, avgZ + spanZ * 0.35],
                  [avgX - spanX * 0.35, avgZ + spanZ * 0.35]
                ];
            emitWalls(aptBuf, crownPts, stepY - 0.3, topY, avgX, avgZ, wCol.clone().offsetHSL(0, 0, 0.03));
            emitUpPoly(flatBuf, crownPts, topY, rCol);
            addRooftopMechanical(indBuf, flatBuf, avgX, avgZ, spanX * 0.80, spanZ * 0.80, topY, h, rCol, seed);
          } else {
            emitWalls(aptBuf, pts, minY, topY, avgX, avgZ, wCol);
            emitUpPoly(flatBuf, pts, topY, rCol);
            if (h >= 24 && spanX > 11 && spanZ > 11) {
              addRooftopMechanical(indBuf, flatBuf, avgX, avgZ, spanX, spanZ, topY, h, rCol, seed);
            } else if (h >= 12 && spanX > 10 && spanZ > 10 && hash01(seed + 5.1) < 0.62) {
              const pw = Math.min(8, spanX * 0.28), pd = Math.min(8, spanZ * 0.28);
              const pent = [[avgX - pw / 2, avgZ - pd / 2], [avgX + pw / 2, avgZ - pd / 2], [avgX + pw / 2, avgZ + pd / 2], [avgX - pw / 2, avgZ + pd / 2]];
              emitWalls(aptBuf, pent, topY - 0.2, topY + 2.6, avgX, avgZ, rCol);
              emitUpPoly(flatBuf, pent, topY + 2.6, rCol);
            }
          }
        }
      }

      if ((idx & 255) === 255) yield;
    }

    addLayerMesh(group, glassTowerBuf, glassTowerMat, 'World glass towers');
    addLayerMesh(group, aptBuf, aptMat, 'World apartments');
    addLayerMesh(group, brickBuf, brickTownMat, 'World brick mid-rises');
    addLayerMesh(group, houseBuf, houseMat, 'World houses');
    addLayerMesh(group, heritageBuf, heritageMat, 'World heritage walls');
    addLayerMesh(group, indBuf, indMat, 'World industrial');
    addLayerMesh(group, pitchedBuf, pitchedRoofMat, 'World pitched roofs');
    addLayerMesh(group, heritageRoofBuf, heritageRoofMat, 'World heritage roofs');
    addLayerMesh(group, flatBuf, flatRoofMat, 'World flat roofs');
    return group;
  }

  function* buildRoadChunk(key, data) {
    const group = new THREE.Group();
    group.name = 'World road tile ' + key;
    const out = buffers();
    for (const [width, pts] of (data.s || [])) {
      const half = width * 0.5;
      for (let i = 0; i < pts.length - 2; i += 2) {
        const ax = data.x + pts[i], az = data.z + pts[i + 1];
        const bx = data.x + pts[i + 2], bz = data.z + pts[i + 3];
        if (isInAirportZone((ax + bx) * 0.5, (az + bz) * 0.5)) continue;
        const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
        if (len < 3) continue;
        const raw0 = ground(ax, az), raw1 = ground(bx, bz);
        if (raw0 < 0.35 && raw1 < 0.35) continue;
        const px = -dz / len * half, pz = dx / len * half;
        const y0 = Math.max(0.5, safeGround(ax, az)) + 0.35;
        const y1 = Math.max(0.5, safeGround(bx, bz)) + 0.35;
        const vEnd = len * 0.08;
        pushTri(out, ax - px, y0, az - pz, ax + px, y0, az + pz, bx + px, y1, bz + pz, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 1, vEnd);
        pushTri(out, ax - px, y0, az - pz, bx + px, y1, bz + pz, bx - px, y1, bz - pz, 1, 1, 1, 0, 1, 0, 0, 0, 1, vEnd, 0, vEnd);
      }
    }
    if (out.p.length) addLayerMesh(group, out, roadMat, 'World roads');
    return group;
  }

  // Pitched-roof residential infill geometry for sparse rural/suburban fringes
  function createPitchedHouseGeo() {
    const pts = [];
    const nrms = [];
    const uvs = [];
    const cols = [];
    const addT = (a, b, c, cr, cg, cb) => {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      pts.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      nrms.push(nx / l, ny / l, nz / l, nx / l, ny / l, nz / l, nx / l, ny / l, nz / l);
      uvs.push(0, 0, 1, 0, 0.5, 1);
      cols.push(cr, cg, cb, cr, cg, cb, cr, cg, cb);
    };
    const q = (a, b, c, d, shade) => { addT(a, b, c, shade, shade, shade); addT(a, c, d, shade, shade, shade); };
    const hw = 0.5, hd = 0.5, eh = 0.68, ph = 1.0;
    // 4 vertical walls (tinted neutral wall base; instance color multiplies)
    q([-hw, 0, hd], [hw, 0, hd], [hw, eh, hd], [-hw, eh, hd], 0.96);
    q([hw, 0, -hd], [-hw, 0, -hd], [-hw, eh, -hd], [hw, eh, -hd], 0.88);
    q([hw, 0, hd], [hw, 0, -hd], [hw, eh, -hd], [hw, eh, hd], 0.92);
    q([-hw, 0, -hd], [-hw, 0, hd], [-hw, eh, hd], [-hw, eh, -hd], 0.84);
    // Hipped roof crest (darker roof contrast via vertex color)
    const r = 0.28;
    q([-hw, eh, hd], [hw, eh, hd], [r, ph, 0], [-r, ph, 0], 0.52);
    q([hw, eh, -hd], [-hw, eh, -hd], [-r, ph, 0], [r, ph, 0], 0.44);
    addT([hw, eh, hd], [hw, eh, -hd], [r, ph, 0], 0.48, 0.48, 0.48);
    addT([-hw, eh, -hd], [-hw, eh, hd], [-r, ph, 0], 0.40, 0.40, 0.40);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrms, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    return geo;
  }

  const MAX_INFILL = 1200;
  const infillGeo = createPitchedHouseGeo();
  const infillMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.82,
    metalness: 0.05
  });
  const infillMesh = new THREE.InstancedMesh(infillGeo, infillMat, MAX_INFILL);
  infillMesh.name = 'World suburban houses infill';
  infillMesh.count = 0;
  infillMesh.frustumCulled = false;
  root.add(infillMesh);

  let tiles = [], roadTiles = [], settlementCells = [];
  let tileSize = 4800, cellSize = 120, ready = false;
  const loaded = new Map(), loading = new Set(), jobs = [];
  const loadedRoads = new Map(), loadingRoads = new Set(), roadJobs = [];
  let lastInfillX = 1e9, lastInfillZ = 1e9;
  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();

  const stats = { ready: false, loadedTiles: 0, totalTiles: 0, maskRevision: 0 };

  function markMaskDirty() { stats.maskRevision++; }

  function addTileMasksToStats(tile) {
    if (tile && tile.userData?.masks?.length) markMaskDirty();
  }

  function refreshInfill(x, z, range) {
    if (!settlementCells.length) { infillMesh.count = 0; return; }
    lastInfillX = x; lastInfillZ = z;
    let count = 0;
    const maxR = Math.min(range, 8500);
    const rSq = maxR * maxR;
    for (let i = 0; i < settlementCells.length && count < MAX_INFILL; i++) {
      const [gx, gz, wgt, rid] = settlementCells[i];
      const cx = (gx + 0.5) * cellSize, cz = (gz + 0.5) * cellSize;
      const dx = cx - x, dz = cz - z;
      if (dx * dx + dz * dz > rSq) continue;
      if (isInAirportZone(cx, cz) || inHeroMask(cx, cz)) continue;
      const pal = REG_PALETTES[rid] || REG_PALETTES[0];
      const houses = 4 + wgt * 3;
      const gy = safeGround(cx, cz);
      for (let k = 0; k < houses && count < MAX_INFILL; k++) {
        const s = ((gx * 73856093) ^ (gz * 19349663) ^ (k * 83492791)) >>> 0;
        const ox = cx + (((s & 255) / 255) - 0.5) * (cellSize * 0.85);
        const oz = cz + ((((s >> 8) & 255) / 255) - 0.5) * (cellSize * 0.85);
        const rot = ((s >> 16) & 63) / 64 * Math.PI * 2;
        const w = 8 + ((s >> 22) & 7);
        const d = 7 + ((s >> 25) & 7);
        const h = wgt > 1 ? 8 + (s % 7) : 5.5 + (s % 4);
        dummy.position.set(ox, gy - 1.0, oz);
        dummy.rotation.set(0, rot, 0);
        dummy.scale.set(w, h, d);
        dummy.updateMatrix();
        infillMesh.setMatrixAt(count, dummy.matrix);
        const wc = pal.houseWall[(s >> 3) % pal.houseWall.length];
        tmpColor.setHex(wc);
        tmpColor.offsetHSL(
          (((s >> 11) & 31) / 31 - 0.5) * 0.05,
          (((s >> 16) & 31) / 31 - 0.5) * 0.14,
          (((s >> 21) & 31) / 31 - 0.5) * 0.12
        );
        infillMesh.setColorAt(count, tmpColor);
        count++;
      }
    }
    infillMesh.count = count;
    infillMesh.instanceMatrix.needsUpdate = true;
    if (infillMesh.instanceColor) infillMesh.instanceColor.needsUpdate = true;
  }

  function blocked(x, z) {
    for (const tile of loaded.values()) {
      for (const [mx, mz, mr] of (tile.userData?.masks || [])) {
        const dx = x - mx, dz = z - mz;
        if (dx * dx + dz * dz < mr * mr) return true;
      }
    }
    return false;
  }

  function releaseTile(map, key) {
    const g = map.get(key);
    if (!g) return;
    if (map === loaded && typeof BuildingCollision !== 'undefined' && BuildingCollision.clearGroup) {
      BuildingCollision.clearGroup('wc_' + key);
    }
    root.remove(g);
    g.traverse(obj => { if (obj.geometry) obj.geometry.dispose(); });
    map.delete(key);
  }

  function update(dt, x, z, quality = 'high', day = 1, wet = false) {
    const night = Math.max(0, Math.min(1, (0.72 - day) * 2.2));
    glassTowerMat.emissiveIntensity = night * 0.98;
    aptMat.emissiveIntensity = night * 0.88;
    brickTownMat.emissiveIntensity = night * 0.82;
    houseMat.emissiveIntensity = night * 0.74;
    heritageMat.emissiveIntensity = night * 0.68;
    indMat.emissiveIntensity = night * 0.52;
    glassTowerMat.roughness = wet ? 0.14 : 0.22;
    roadMat.roughness = wet ? 0.35 : 0.92;

    if (!ready || !tiles.length) return;
    const range = quality === 'low' ? 9500 : quality === 'medium' ? 14500 : 21000;
    const maxTiles = quality === 'low' ? 6 : quality === 'medium' ? 12 : 20;
    const rSq = range * range;

    // Prioritize nearest tiles
    const wanted = [];
    for (const rec of tiles) {
      const dx = rec[1] - x, dz = rec[2] - z;
      const dSq = dx * dx + dz * dz;
      if (dSq <= rSq) wanted.push([dSq, rec]);
    }
    wanted.sort((a, b) => a[0] - b[0]);
    const activeKeys = new Set();
    for (let i = 0; i < wanted.length && i < maxTiles; i++) {
      const rec = wanted[i][1];
      const key = rec[0];
      activeKeys.add(key);
      if (!loaded.has(key) && !loading.has(key) && loading.size < 4) {
        loading.add(key);
        fetch('world-city/' + key + '.json?v=pilot1')
          .then(r => (r.ok ? r.json() : null))
          .then(data => {
            if (data) jobs.push({ key, regId: rec[4], it: buildTile(key, data, rec[4]) });
            else loading.delete(key);
          })
          .catch(() => loading.delete(key));
      }
    }
    for (const key of Array.from(loaded.keys())) {
      if (!activeKeys.has(key)) {
        releaseTile(loaded, key);
        markMaskDirty();
      }
    }

    // Stream matching roads
    const roadWanted = new Set();
    for (const rec of roadTiles) {
      const dx = rec[1] - x, dz = rec[2] - z;
      if (dx * dx + dz * dz <= rSq) {
        const key = rec[0];
        roadWanted.add(key);
        if (!loadedRoads.has(key) && !loadingRoads.has(key) && loadingRoads.size < 3) {
          loadingRoads.add(key);
          fetch('world-city/roads/' + key + '.json?v=pilot1')
            .then(r => (r.ok ? r.json() : null))
            .then(data => {
              if (data) roadJobs.push({ key, it: buildRoadChunk(key, data) });
              else loadingRoads.delete(key);
            })
            .catch(() => loadingRoads.delete(key));
        }
      }
    }
    for (const key of Array.from(loadedRoads.keys())) {
      if (!roadWanted.has(key)) releaseTile(loadedRoads, key);
    }

    // Time-budgeted geometry construction
    const deadline = performance.now() + 3.2;
    while (jobs.length && performance.now() < deadline) {
      const job = jobs[0];
      const step = job.it.next();
      if (step.done) {
        jobs.shift();
        loading.delete(job.key);
        if (step.value) {
          root.add(step.value);
          loaded.set(job.key, step.value);
          addTileMasksToStats(step.value);
        }
      }
    }
    while (roadJobs.length && performance.now() < deadline + 1.2) {
      const job = roadJobs[0];
      const step = job.it.next();
      if (step.done) {
        roadJobs.shift();
        loadingRoads.delete(job.key);
        if (step.value) {
          root.add(step.value);
          loadedRoads.set(job.key, step.value);
        }
      }
    }

    stats.loadedTiles = loaded.size;
    if (Math.hypot(x - lastInfillX, z - lastInfillZ) > 950) refreshInfill(x, z, range);
  }

  Promise.all([
    fetch('world-city/index.json?v=pilot1').then(r => (r.ok ? r.json() : null)).catch(() => null),
    fetch('world-city/roads/index.json?v=pilot1').then(r => (r.ok ? r.json() : null)).catch(() => null),
    fetch('world-city/settlements.json?v=pilot1').then(r => (r.ok ? r.json() : null)).catch(() => null)
  ]).then(([idx, rIdx, sIdx]) => {
    if (idx && Array.isArray(idx.tiles)) {
      tiles = idx.tiles;
      tileSize = idx.tileSize || 4800;
      cellSize = idx.cellSize || 120;
      ready = tiles.length > 0;
      stats.ready = ready;
      stats.totalTiles = tiles.length;
    }
    if (rIdx && Array.isArray(rIdx.tiles)) roadTiles = rIdx.tiles;
    if (sIdx && Array.isArray(sIdx.cells)) settlementCells = sIdx.cells;
  });

  const api = { root, inside, blocked, update, stats, REG_PALETTES };
  if (typeof window !== 'undefined') window.__SKYBOUND_WORLD_CITY = api;
  return api;
}
