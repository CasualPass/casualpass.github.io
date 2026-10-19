/*
 * Arena FPS — CasualPass
 * Three.js sahnesi + PeerJS/WebRTC ile host merkezli (yıldız) çok oyunculu nişancı.
 *
 * AĞ PROTOKOLÜ (veri tasarruflu)
 *   Konum kaydı 12 bayt: nid u16 · x,y,z i16 (cm) · yaw u16 · pitch i8 · bayrak u8
 *     bayrak: [0-1 duruş][2-3 silah][4 canlı][5 şarjör][6-7 atış sayacı]
 *   Paket = 1 bayt tip + N kayıt. İstemci yalnızca kendini yollar (13 bayt); host kendi kaydını,
 *   botları ve diğer oyuncuları tek pakette toplar. En fazla 15 Hz, değişmeyen kayıt saniyede bir.
 *   Konum paketleri güvenilmez/sırasız "fast" kanaldan gider; ateş etme ayrı paket değil, sayaçtır.
 *   Olaylar (JSON, güvenilir kanal): hi, s (skor/maç), h (isabet), k (ölüm), g/x (bomba),
 *   e/r (maç sonu/yeniden), b (ayrıldı), p/q (ping), err.
 *   İsabeti atan bildirir, hasarı hedefin sahibi uygular; botların sahibi host'tur.
 */
(() => {
    'use strict';

    const $ = (id) => document.getElementById(id);
    if (!window.THREE) {
        $('boot-error').classList.remove('hidden');
        $('menu').classList.add('hidden');
        return;
    }

    /* ---------- Sabitler ---------- */

    const TAU = Math.PI * 2;
    const PROTO = 1;
    const MAP = 70;
    const R = 0.35;
    const EYE_STAND = 1.7;
    const EYE_CROUCH = 1.15;
    const EYE_SLIDE = 0.8;
    const STANCE_SCALE = [1, 0.72, 0.5];
    const GRAVITY = -22;
    const JUMP = 7.8;
    const BEST_COOKIE = 'cp_arena_best';
    const PREFS_COOKIE = 'cp_arena_prefs';
    const ROOM_PREFIX = 'casualarena-';
    const MAX_HUMANS = 8;
    const BOT_BASE = 65100;
    const RESPAWN_MS = 3000;
    const SHIELD_MS = 2000;
    const REGEN_DELAY_MS = 4500;
    const REGEN_RATE = 20;
    const NADE_FUSE = 2.2;
    const NADE_RADIUS = 7;
    const NADE_DAMAGE = 120;
    const NADES_PER_LIFE = 2;
    const NADE_WEAPON = 4;
    const NET_STEP_MS = 66;
    const INTERP_MS = 100;
    const RECORD = 12;
    const SNAPSHOT_MS = 5000;
    const AUTO_RESTART_MS = 25000;
    const BOT_NAMES = ['Kaya', 'Poyraz', 'Atlas', 'Bora', 'Çınar', 'Toprak', 'Alaz'];
    const SOLO_BOTS = [1, 3, 5, 7];
    const HOST_BOTS = [0, 2, 4, 6];
    const TIME_CHOICES = [3, 5, 10];
    const KILL_CHOICES = [10, 20, 30];

    const DIFFICULTY = {
        easy: { label: 'Kolay', react: 0.8, aimErr: 0.07, turn: 3, spread: 2.4, burst: [2, 4], pause: [0.6, 1], dmg: 0.55, head: 0.05 },
        normal: { label: 'Normal', react: 0.5, aimErr: 0.045, turn: 5, spread: 1.6, burst: [3, 5], pause: [0.4, 0.7], dmg: 0.75, head: 0.12 },
        hard: { label: 'Zor', react: 0.28, aimErr: 0.025, turn: 8, spread: 1.1, burst: [4, 7], pause: [0.25, 0.45], dmg: 0.95, head: 0.22 }
    };

    // range: [tam hasarın bittiği, en düşük hasara indiği] metre; botRange: botun tercih ettiği mesafe.
    const WEAPONS = [
        { name: 'Tüfek', dmg: 18, delay: 100, mag: 30, auto: true, spread: 0.006, pellets: 1, reload: 1600, kick: 0.012, zoom: 1.35, head: 2, range: [30, 80], minMul: 0.6, botRange: 20, botWeight: 0.5 },
        { name: 'Tabanca', dmg: 24, delay: 240, mag: 12, auto: false, spread: 0.004, pellets: 1, reload: 1100, kick: 0.014, zoom: 1.2, head: 2, range: [20, 60], minMul: 0.55, botRange: 14, botWeight: 0.15 },
        { name: 'Pompalı', dmg: 10, delay: 850, mag: 6, auto: false, spread: 0.05, pellets: 8, reload: 2300, kick: 0.05, zoom: 1.1, head: 1.3, range: [8, 26], minMul: 0.25, botRange: 6, botWeight: 0.2 },
        { name: 'Keskin Nişancı', dmg: 90, delay: 1300, mag: 5, auto: false, spread: 0.0004, pellets: 1, reload: 2400, kick: 0.07, zoom: 4, head: 2, range: [250, 250], minMul: 1, botRange: 40, botWeight: 0.15 }
    ];
    const WEAPON_NAMES = [...WEAPONS.map((w) => w.name), 'El bombası'];

    /* Visual camo palettes live with the renderer; names and prices come from CasualProfile.camos. */
    const CAMO_STYLES = {
        standard: { metal: 0x2b2f36, dark: 0x15181d, wood: 0x7a5230, acc: 0x8a8f98, swatch: 'linear-gradient(135deg,#2b2f36 0 45%,#7a5230 45% 70%,#8a8f98 70%)' },
        desert: { metal: 0xb59a6a, dark: 0x6b5a3e, wood: 0xc9b48a, acc: 0x8a7a5a, swatch: 'repeating-linear-gradient(135deg,#c9b48a 0 9px,#b59a6a 9px 16px,#6b5a3e 16px 21px)' },
        forest: { metal: 0x4c6a3a, dark: 0x2c3a24, wood: 0x6b5a32, acc: 0x7d8f5a, swatch: 'repeating-linear-gradient(120deg,#4c6a3a 0 10px,#2c3a24 10px 17px,#6b5a32 17px 23px)' },
        arctic: { metal: 0xdfe6ec, dark: 0x9aa7b3, wood: 0xf4f7fa, acc: 0x7d8e9c, swatch: 'repeating-linear-gradient(135deg,#f4f7fa 0 10px,#dfe6ec 10px 16px,#9aa7b3 16px 20px)' },
        crimson: { metal: 0x8e2230, dark: 0x3a0d14, wood: 0x5a1a1f, acc: 0xd04a4a, swatch: 'linear-gradient(135deg,#3a0d14,#8e2230 55%,#d04a4a)' },
        golden: { metal: 0xd9a62e, dark: 0x8a6414, wood: 0x6b3b10, acc: 0xffe08a, shiny: true, swatch: 'linear-gradient(135deg,#8a6414,#d9a62e 45%,#ffe08a 60%,#d9a62e)' }
    };

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const rand = (a, b) => a + Math.random() * (b - a);
    const randInt = ([a, b]) => a + Math.floor(Math.random() * (b - a + 1));
    const angleDiff = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
    const round2 = (v) => Math.round(v * 100) / 100;
    function mulberry32(seed) {
        let a = seed;
        return () => {
            a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    const rnd = mulberry32(20241018); // sabit tohum: herkes AYNI haritayı görür

    /* ---------- Tercihler (çerez) ---------- */

    const touchDevice = window.matchMedia('(pointer: coarse)').matches;
    const prefs = loadPrefs();

    function cleanOpts(o, d, botChoices) {
        return {
            bots: botChoices.includes(o?.bots) ? o.bots : d.bots,
            diff: DIFFICULTY[o?.diff] ? o.diff : d.diff,
            time: TIME_CHOICES.includes(o?.time) ? o.time : d.time,
            kills: KILL_CHOICES.includes(o?.kills) ? o.kills : d.kills
        };
    }

    function loadPrefs() {
        const base = {
            sens: 1, fov: 75, vol: 80, q: touchDevice ? 'low' : 'mid',
            solo: { bots: 3, diff: 'normal', time: 5, kills: 20 },
            host: { bots: 2, diff: 'normal', time: 5, kills: 20 }
        };
        let saved = {};
        try { saved = JSON.parse(getCookieValue(PREFS_COOKIE) || '{}') || {}; } catch { saved = {}; }
        const num = (v, d) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
        return {
            sens: clamp(num(saved.sens, base.sens), 0.3, 3),
            fov: clamp(num(saved.fov, base.fov), 65, 100),
            vol: clamp(num(saved.vol, base.vol), 0, 100),
            q: ['low', 'mid', 'high'].includes(saved.q) ? saved.q : base.q,
            solo: cleanOpts(saved.solo, base.solo, SOLO_BOTS),
            host: cleanOpts(saved.host, base.host, HOST_BOTS)
        };
    }

    function savePrefs() { setCookieValue(PREFS_COOKIE, JSON.stringify(prefs)); }

    function cheatOn(name) {
        const c = window.CasualCheats;
        return Boolean(c && typeof c[name] === 'function' && c[name]());
    }

    /* ---------- Sahne ---------- */

    const canvas = $('game-canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.autoClear = false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const SKY_HORIZON = 0xc4dcec;
    const SKY_TOP = 0x4f86c2;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SKY_HORIZON);
    scene.fog = new THREE.Fog(SKY_HORIZON, 45, 150);
    const camera = new THREE.PerspectiveCamera(prefs.fov, innerWidth / innerHeight, 0.05, 420);
    camera.rotation.order = 'YXZ';
    scene.add(camera);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x556655, 0.85));
    const sun = new THREE.DirectionalLight(0xfff2d8, 0.8);
    sun.position.set(55, 90, 30);
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -85, right: 85, top: 85, bottom: -85, near: 10, far: 220 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0006;
    scene.add(sun, sun.target);
    // Lights stay in the scene at zero intensity so the light count, and the compiled shaders, never change.
    const muzzleLight = new THREE.PointLight(0xffc46b, 0, 9, 2);
    const boomLight = new THREE.PointLight(0xff9a3c, 0, 26, 2);
    scene.add(muzzleLight, boomLight);

    (function buildSky() {
        const geo = new THREE.SphereGeometry(300, 24, 12);
        const pos = geo.attributes.position;
        const top = new THREE.Color(SKY_TOP);
        const horizon = new THREE.Color(SKY_HORIZON);
        const c = new THREE.Color();
        const colors = [];
        for (let i = 0; i < pos.count; i++) {
            c.copy(horizon).lerp(top, Math.pow(Math.max(0, pos.getY(i) / 300), 0.6));
            colors.push(c.r, c.g, c.b);
        }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        const sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
        sky.renderOrder = -1;
        camera.add(sky);
    })();

    // Silah modeli ayrı sahnede çizilir; böylece duvara yaklaşınca duvarın içine girmez.
    const vmScene = new THREE.Scene();
    const vmCamera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.01, 10);
    vmScene.add(new THREE.HemisphereLight(0xffffff, 0x556655, 0.95));
    const vmSun = new THREE.DirectionalLight(0xfff2d8, 0.7);
    vmSun.position.set(1, 2, 1);
    const vmFlashLight = new THREE.PointLight(0xffc46b, 0, 3, 2);
    vmFlashLight.position.set(0.2, -0.1, -1);
    vmScene.add(vmSun, vmFlashLight);
    const vmRoot = new THREE.Group();
    vmRoot.position.set(0.2, -0.2, -0.42);
    vmScene.add(vmRoot);

    function resize() {
        renderer.setSize(innerWidth, innerHeight, false);
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        vmCamera.aspect = camera.aspect;
        vmCamera.updateProjectionMatrix();
    }

    function applyQuality() {
        const ratio = { low: 0.75, mid: 1.15, high: 1.6 }[prefs.q];
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ratio));
        const shadows = prefs.q === 'high';
        if (renderer.shadowMap.enabled !== shadows) {
            renderer.shadowMap.enabled = shadows;
            sun.castShadow = shadows;
            scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
        }
        scene.fog.far = prefs.q === 'low' ? 115 : 150;
        const aniso = prefs.q === 'low' ? 1 : Math.min(prefs.q === 'high' ? 8 : 4, renderer.capabilities.getMaxAnisotropy());
        textureAniso = aniso;
        allTextures.forEach((t) => { if (t.anisotropy !== aniso) { t.anisotropy = aniso; t.needsUpdate = true; } });
        paintSurfaces(textureSize());
        resize();
    }

    /* ---------- Harita ---------- */

    /* ---------- Dokular (prosedürel, dosya indirmeden) ---------- */

    const smooth = (t) => t * t * (3 - 2 * t);

    // Tileable fractal value noise: every octave's lattice wraps, so tiles join without seams.
    function noiseCanvas(n, cells, octaves, seed) {
        const r = mulberry32(seed);
        const acc = new Float32Array(n * n);
        let amp = 1;
        for (let o = 0; o < octaves; o++) {
            const c = cells << o;
            const lat = new Float32Array(c * c).map(() => r());
            for (let y = 0; y < n; y++) {
                const fy = (y / n) * c;
                const y0 = Math.floor(fy);
                const y1 = (y0 + 1) % c;
                const ty = smooth(fy - y0);
                for (let x = 0; x < n; x++) {
                    const fx = (x / n) * c;
                    const x0 = Math.floor(fx);
                    const x1 = (x0 + 1) % c;
                    const tx = smooth(fx - x0);
                    const top = lerp(lat[y0 * c + x0], lat[y0 * c + x1], tx);
                    const bottom = lerp(lat[y1 * c + x0], lat[y1 * c + x1], tx);
                    acc[y * n + x] += lerp(top, bottom, ty) * amp;
                }
            }
            amp *= 0.5;
        }
        let lo = Infinity;
        let hi = -Infinity;
        for (const v of acc) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
        const c = document.createElement('canvas');
        c.width = c.height = n;
        const g = c.getContext('2d');
        const img = g.createImageData(n, n);
        for (let i = 0; i < acc.length; i++) {
            const v = Math.round(((acc[i] - lo) / (hi - lo || 1)) * 255);
            img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
            img.data[i * 4 + 3] = 255;
        }
        g.putImageData(img, 0, 0);
        return c;
    }
    const NOISE_LO = noiseCanvas(128, 4, 5, 11);
    const NOISE_HI = noiseCanvas(128, 16, 3, 23);

    // Lay a noise tile over the whole texture `reps` times per side with a blend mode.
    function overlay(g, S, img, reps, alpha, op = 'multiply') {
        g.save();
        g.globalAlpha = alpha;
        g.globalCompositeOperation = op;
        const t = S / reps;
        for (let i = 0; i < reps; i++) for (let j = 0; j < reps; j++) g.drawImage(img, i * t, j * t, t, t);
        g.restore();
    }
    // Draw a shape and its copies across the edges so the texture still tiles.
    function wrapped(S, x, y, r, draw) {
        for (const dx of [-S, 0, S]) {
            for (const dy of [-S, 0, S]) {
                const px = x + dx;
                const py = y + dy;
                if (px > -r && px < S + r && py > -r && py < S + r) draw(px, py);
            }
        }
    }
    function blob(g, S, x, y, r, color) {
        g.fillStyle = color;
        wrapped(S, x, y, r, (px, py) => { g.beginPath(); g.arc(px, py, r, 0, TAU); g.fill(); });
    }
    function dots(g, S, count, size, colors) {
        for (let i = 0; i < count; i++) {
            g.fillStyle = colors[i % colors.length];
            const w = size * (0.5 + Math.random());
            g.fillRect(Math.random() * S, Math.random() * S, w, w);
        }
    }
    function crackLines(g, S, count, color, width) {
        g.strokeStyle = color;
        g.lineWidth = width;
        g.lineCap = 'round';
        for (let i = 0; i < count; i++) {
            let x = Math.random() * S;
            let y = Math.random() * S;
            let a = Math.random() * TAU;
            g.beginPath();
            g.moveTo(x, y);
            for (let k = 0; k < 9; k++) {
                a += rand(-0.7, 0.7);
                x += Math.cos(a) * S * 0.035;
                y += Math.sin(a) * S * 0.035;
                g.lineTo(x, y);
            }
            g.stroke();
        }
    }
    const gray = (v, a = 1) => `rgba(${v},${v},${v},${a})`;

    // Surface textures are mostly light greys; the material colour tints them, so one texture
    // serves every building or container colour. scale = metres per tile (world-space UVs),
    // box = keep the box's own 0..1 UVs (a crate face shows one whole crate side).
    const SURFACES = {
        grass: { paint(g, S, k) {
            g.fillStyle = '#557a43';
            g.fillRect(0, 0, S, S);
            overlay(g, S, NOISE_LO, 1, 0.5);
            overlay(g, S, NOISE_HI, 2, 0.28, 'overlay');
            for (let i = 0; i < 7; i++) {
                const x = Math.random() * S;
                const y = Math.random() * S;
                const r = S * rand(0.08, 0.18);
                wrapped(S, x, y, r, (px, py) => {
                    const grd = g.createRadialGradient(px, py, 0, px, py, r);
                    grd.addColorStop(0, 'rgba(170,160,80,.22)');
                    grd.addColorStop(1, 'rgba(170,160,80,0)');
                    g.fillStyle = grd;
                    g.fillRect(px - r, py - r, r * 2, r * 2);
                });
            }
            const greens = ['#3c612f', '#6a9550', '#4f7a3d', '#86a85d', '#355a2a', '#7a9a4c'];
            g.lineCap = 'round';
            for (let i = 0; i < 9000 * k * k; i++) {
                const x = Math.random() * S;
                const y = Math.random() * S;
                const len = rand(3, 9) * k;
                const a = rand(-0.35, 0.35);
                g.strokeStyle = greens[i % greens.length];
                g.globalAlpha = rand(0.35, 0.75);
                g.lineWidth = Math.max(1, k * rand(0.8, 1.6));
                wrapped(S, x, y, len, (px, py) => {
                    g.beginPath();
                    g.moveTo(px, py);
                    g.lineTo(px + Math.sin(a) * len, py - Math.cos(a) * len);
                    g.stroke();
                });
            }
            g.globalAlpha = 1;
            dots(g, S, 500 * k * k, 2 * k, ['rgba(110,90,60,.45)', 'rgba(230,225,160,.5)']);
        } },
        asphalt: { paint(g, S, k) {
            g.fillStyle = '#62605a';
            g.fillRect(0, 0, S, S);
            overlay(g, S, NOISE_LO, 1, 0.45);
            overlay(g, S, NOISE_HI, 3, 0.35);
            dots(g, S, 7000 * k * k, 1.6 * k, ['rgba(150,146,138,.55)', 'rgba(30,30,30,.45)', 'rgba(110,106,98,.5)']);
            for (let i = 0; i < 4; i++) blob(g, S, Math.random() * S, S * rand(0.2, 0.8), S * rand(0.03, 0.07), 'rgba(20,20,20,.12)');
            crackLines(g, S, 5, 'rgba(25,25,25,.5)', 1.4 * k);
            const line = S * 0.022;
            g.fillStyle = 'rgba(232,230,216,.9)';
            g.fillRect(0, S * 0.04, S, line);
            g.fillRect(0, S * 0.94 - line, S, line);
            g.fillStyle = 'rgba(236,212,120,.92)';
            g.fillRect(S * 0.05, S * 0.5 - line / 2, S * 0.5, line);
            overlay(g, S, NOISE_HI, 4, 0.3); // aşınmış boya
        } },
        plaster: { scale: 3, paint(g, S, k) {
            g.fillStyle = '#efe9df';
            g.fillRect(0, 0, S, S);
            overlay(g, S, NOISE_LO, 1, 0.12);
            overlay(g, S, NOISE_HI, 3, 0.1);
            for (let i = 0; i < 40 * k; i++) {
                const x = Math.random() * S;
                const w = rand(2, 7) * k;
                const grd = g.createLinearGradient(0, 0, 0, S);
                grd.addColorStop(0, 'rgba(70,60,50,.09)');
                grd.addColorStop(1, 'rgba(70,60,50,0)');
                g.fillStyle = grd;
                g.fillRect(x, 0, w, S);
            }
            dots(g, S, 2600 * k * k, 1.4 * k, ['rgba(90,80,70,.25)', 'rgba(255,255,255,.4)']);
            crackLines(g, S, 2, 'rgba(80,70,60,.3)', 1 * k);
        } },
        concrete: { scale: 4, paint(g, S, k) {
            g.fillStyle = '#e0e0dc';
            g.fillRect(0, 0, S, S);
            overlay(g, S, NOISE_LO, 1, 0.38);
            overlay(g, S, NOISE_HI, 3, 0.28);
            dots(g, S, 1800 * k * k, 1.6 * k, ['rgba(40,40,40,.28)', 'rgba(255,255,255,.35)']);
            g.strokeStyle = 'rgba(40,40,40,.45)';
            g.lineWidth = 3 * k;
            for (const v of [1.5 * k, S / 2]) {
                g.beginPath(); g.moveTo(v, 0); g.lineTo(v, S); g.stroke();
                g.beginPath(); g.moveTo(0, v); g.lineTo(S, v); g.stroke();
            }
            for (const x of [S / 4, (3 * S) / 4]) {
                for (const y of [S / 4, (3 * S) / 4]) {
                    const grd = g.createLinearGradient(0, y, 0, y + S * 0.2);
                    grd.addColorStop(0, 'rgba(60,55,50,.12)');
                    grd.addColorStop(1, 'rgba(60,55,50,0)');
                    g.fillStyle = grd;
                    g.fillRect(x - 3 * k, y, 6 * k, S * 0.2);
                    blob(g, S, x, y, 4.5 * k, 'rgba(255,255,255,.35)');
                    blob(g, S, x, y, 3 * k, 'rgba(30,30,30,.55)');
                }
            }
        } },
        roof: { scale: 2.5, paint(g, S, k) {
            g.fillStyle = '#d8d8d8';
            g.fillRect(0, 0, S, S);
            overlay(g, S, NOISE_LO, 1, 0.38);
            dots(g, S, 5000 * k * k, 1.6 * k, ['rgba(40,40,40,.3)', 'rgba(255,255,255,.4)', 'rgba(120,120,120,.35)']);
            for (let i = 0; i < 4; i++) {
                const y = (i * S) / 4;
                g.fillStyle = 'rgba(255,255,255,.18)';
                g.fillRect(0, y, S, 5 * k);
                g.fillStyle = 'rgba(0,0,0,.22)';
                g.fillRect(0, y + 5 * k, S, 2 * k);
            }
            overlay(g, S, NOISE_HI, 2, 0.25);
        } },
        crate: { box: true, paint(g, S, k) {
            const planks = 5;
            const h = S / planks;
            for (let i = 0; i < planks; i++) {
                g.fillStyle = gray(Math.round(rand(205, 240)));
                g.fillRect(0, i * h, S, h);
                g.strokeStyle = 'rgba(110,80,50,.22)';
                g.lineWidth = Math.max(1, 1.2 * k);
                for (let l = 0; l < 12; l++) {
                    const y0 = i * h + rand(4, h - 4);
                    const ph = rand(0, TAU);
                    g.beginPath();
                    for (let x = 0; x <= S; x += 8 * k) g.lineTo(x, y0 + Math.sin(x / (40 * k) + ph) * 2.5 * k);
                    g.stroke();
                }
                if (Math.random() < 0.6) {
                    g.fillStyle = 'rgba(90,60,35,.4)';
                    g.beginPath();
                    g.ellipse(rand(0.2, 0.8) * S, i * h + h / 2, 7 * k, 3.5 * k, 0, 0, TAU);
                    g.fill();
                }
                g.fillStyle = 'rgba(40,25,10,.6)';
                g.fillRect(0, i * h, S, 3 * k);
            }
            const bw = S * 0.11;
            g.save();
            g.translate(S / 2, S / 2);
            g.rotate(Math.PI / 4);
            g.fillStyle = gray(222);
            g.fillRect(-S * 0.75, -bw / 2, S * 1.5, bw);
            g.strokeStyle = 'rgba(40,25,10,.55)';
            g.lineWidth = 3 * k;
            g.strokeRect(-S * 0.75, -bw / 2, S * 1.5, bw);
            g.restore();
            g.fillStyle = gray(228);
            for (const [x, y, w, hh] of [[0, 0, S, bw], [0, S - bw, S, bw], [0, 0, bw, S], [S - bw, 0, bw, S]]) g.fillRect(x, y, w, hh);
            g.strokeStyle = 'rgba(40,25,10,.6)';
            g.lineWidth = 3 * k;
            g.strokeRect(bw, bw, S - 2 * bw, S - 2 * bw);
            g.strokeRect(1.5 * k, 1.5 * k, S - 3 * k, S - 3 * k);
            for (const x of [bw / 2, S - bw / 2]) for (const y of [bw / 2, S - bw / 2]) blob(g, S, x, y, 3 * k, 'rgba(50,50,50,.8)');
            overlay(g, S, NOISE_HI, 2, 0.16);
            overlay(g, S, NOISE_LO, 1, 0.14);
        } },
        metal: { scale: 2.4, paint(g, S, k) {
            const ribs = 12;
            for (let x = 0; x < S; x++) {
                const v = 0.72 + 0.28 * (0.5 + 0.5 * Math.cos((x / S) * ribs * TAU));
                g.fillStyle = gray(Math.round(v * 245));
                g.fillRect(x, 0, 1, S);
            }
            overlay(g, S, NOISE_LO, 1, 0.22);
            overlay(g, S, NOISE_HI, 2, 0.2);
            for (let i = 0; i < 40 * k * k; i++) blob(g, S, Math.random() * S, Math.random() * S, rand(2, 11) * k, 'rgba(120,60,25,.16)');
            g.strokeStyle = 'rgba(255,255,255,.22)';
            g.lineWidth = Math.max(1, k);
            for (let i = 0; i < 60 * k; i++) {
                const x = Math.random() * S;
                const y = Math.random() * S;
                g.beginPath(); g.moveTo(x, y); g.lineTo(x + rand(-14, 14) * k, y + rand(-4, 4) * k); g.stroke();
            }
        } },
        sandbag: { scale: 1.8, paint(g, S, k) {
            g.fillStyle = '#5e5440';
            g.fillRect(0, 0, S, S);
            const bh = S / 4;
            const bwid = S / 2;
            for (let row = 0; row < 4; row++) {
                const off = (row % 2) * (bwid / 2);
                for (let i = -1; i <= 2; i++) {
                    const x = i * bwid + off + 3 * k;
                    const y = row * bh + 3 * k;
                    const w = bwid - 6 * k;
                    const hh = bh - 6 * k;
                    const grd = g.createRadialGradient(x + w / 2, y + hh * 0.4, hh * 0.1, x + w / 2, y + hh / 2, w * 0.6);
                    grd.addColorStop(0, '#f1e8cf');
                    grd.addColorStop(1, '#a3957a');
                    g.fillStyle = grd;
                    g.beginPath();
                    if (g.roundRect) g.roundRect(x, y, w, hh, hh * 0.45); else g.rect(x, y, w, hh);
                    g.fill();
                }
            }
            g.strokeStyle = 'rgba(60,50,30,.07)';
            g.lineWidth = 1;
            for (let v = 0; v < S; v += 3 * k) {
                g.beginPath(); g.moveTo(v, 0); g.lineTo(v, S); g.stroke();
                g.beginPath(); g.moveTo(0, v); g.lineTo(S, v); g.stroke();
            }
            overlay(g, S, NOISE_HI, 2, 0.2);
        } },
        rock: { scale: 2.2, paint(g, S, k) {
            g.fillStyle = '#d6d6d3';
            g.fillRect(0, 0, S, S);
            overlay(g, S, NOISE_LO, 1, 0.6);
            overlay(g, S, NOISE_HI, 2, 0.42);
            crackLines(g, S, 3, 'rgba(255,255,255,.2)', 2 * k);
            crackLines(g, S, 7, 'rgba(30,30,30,.4)', 1.4 * k);
            for (let i = 0; i < 26 * k * k; i++) blob(g, S, Math.random() * S, Math.random() * S, rand(3, 12) * k, 'rgba(110,125,70,.22)');
            dots(g, S, 2400 * k * k, 1.6 * k, ['rgba(0,0,0,.25)', 'rgba(255,255,255,.3)']);
        } },
        bark: { scale: 1.4, paint(g, S, k) {
            g.fillStyle = '#dcd6cd';
            g.fillRect(0, 0, S, S);
            overlay(g, S, NOISE_HI, 2, 0.3);
            g.lineCap = 'round';
            for (let i = 0; i < 70 * k; i++) {
                const x0 = Math.random() * S;
                const ph = rand(0, TAU);
                g.strokeStyle = `rgba(40,28,18,${rand(0.3, 0.6)})`;
                g.lineWidth = rand(2, 5) * k;
                for (const dx of [-S, 0, S]) {
                    g.beginPath();
                    for (let y = -10; y <= S + 10; y += 8 * k) g.lineTo(x0 + dx + Math.sin(y / (30 * k) + ph) * 4 * k, y);
                    g.stroke();
                }
            }
            overlay(g, S, NOISE_LO, 1, 0.25);
        } },
        leaves: { scale: 2.2, paint(g, S, k) {
            g.fillStyle = '#a8a8a8';
            g.fillRect(0, 0, S, S);
            for (let i = 0; i < 2600 * k * k; i++) {
                const x = Math.random() * S;
                const y = Math.random() * S;
                const a = rand(0, TAU);
                const w = rand(3, 7) * k;
                g.fillStyle = gray(Math.round(rand(110, 255)));
                wrapped(S, x, y, w, (px, py) => { g.beginPath(); g.ellipse(px, py, w, w * 0.45, a, 0, TAU); g.fill(); });
            }
            overlay(g, S, NOISE_LO, 1, 0.35);
        } }
    };

    const allTextures = [];
    let textureAniso = 1;
    function makeCanvasTexture() {
        const c = document.createElement('canvas');
        c.width = c.height = 4;
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = textureAniso;
        allTextures.push(tex);
        return tex;
    }
    Object.values(SURFACES).forEach((spec) => { spec.tex = makeCanvasTexture(); });
    let surfaceSize = 0;
    // Big ground-covering textures go to 1024 px on "Yüksek"; the rest stop at 512 px.
    function paintSurfaces(size) {
        if (size === surfaceSize) return;
        surfaceSize = size;
        for (const [name, spec] of Object.entries(SURFACES)) {
            const S = name === 'grass' || name === 'asphalt' ? size : Math.min(size, 512);
            const c = document.createElement('canvas');
            c.width = c.height = S;
            spec.paint(c.getContext('2d'), S, S / 512);
            spec.tex.image = c;
            spec.tex.needsUpdate = true;
        }
    }
    const textureSize = () => ({ low: 256, mid: 512, high: 1024 }[prefs.q]);
    paintSurfaces(textureSize());
    const grassTex = SURFACES.grass.tex;
    const roadTex = SURFACES.asphalt.tex;
    grassTex.repeat.set(45, 45);
    roadTex.repeat.set(35, 1);

    const solids = []; // çarpışma kutuları (AABB)
    const occluders = []; // oyuncu mermisinin durduğu meshler
    const noSpawn = []; // ağaç/çalı konmayacak alanlar
    const bushZones = []; // çalılık bölgeleri
    const treeSpots = [];
    const SPAWNS = [[0, 10], [-50, -8], [50, 8], [0, -52], [0, 55], [-52, 50], [52, -50], [-20, 0], [24, 0], [0, -36], [36, -48], [-36, 44]];
    const matCache = {};
    const SURFACE_OF_COLOR = {
        0x9a8671: 'plaster', 0x6f7a86: 'plaster', 0xa06c4d: 'plaster', 0x7d8c6c: 'plaster', 0xb09a80: 'plaster', 0x8a7a9a: 'plaster',
        0x4a4f58: 'roof', 0x3a3f4d: 'concrete', 0x5d6470: 'concrete', 0x6c7380: 'concrete', 0x444a55: 'concrete', 0x9b9b9b: 'concrete',
        0x8b6a3e: 'crate', 0x9a7a4a: 'crate', 0x7a5a30: 'crate',
        0xb5493f: 'metal', 0x3f6ab5: 'metal', 0x3fa05a: 'metal', 0xd89a2b: 'metal',
        0x8d7d5a: 'sandbag', 0x7d7f84: 'rock', 0x6b4a2b: 'bark'
    };
    function lam(color, surface = SURFACE_OF_COLOR[color]) {
        const key = surface ? `${color}:${surface}` : color;
        if (!matCache[key]) {
            // Textures average a little under white, so textured colours get a small lift.
            const m = new THREE.MeshLambertMaterial({ color: new THREE.Color(color).multiplyScalar(surface ? 1.12 : 1), map: surface ? SURFACES[surface].tex : null });
            m.userData.surface = surface || null;
            matCache[key] = m;
        }
        return matCache[key];
    }

    // Large, slow colour patches across the ground hide the grass texture's repetition.
    function groundGeometry() {
        const size = MAP * 2 + 40;
        const geo = new THREE.PlaneGeometry(size, size, 60, 60);
        const pos = geo.attributes.position;
        const hash = (x, z) => { const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return h - Math.floor(h); };
        const vnoise = (x, z) => {
            const x0 = Math.floor(x);
            const z0 = Math.floor(z);
            const tx = smooth(x - x0);
            const tz = smooth(z - z0);
            return lerp(lerp(hash(x0, z0), hash(x0 + 1, z0), tx), lerp(hash(x0, z0 + 1), hash(x0 + 1, z0 + 1), tx), tz);
        };
        const colors = [];
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = -pos.getY(i);
            const light = 0.84 + 0.26 * (0.65 * vnoise(x / 22, z / 22) + 0.35 * vnoise(x / 7 + 40, z / 7));
            const dry = smooth(clamp((vnoise(x / 30 + 90, z / 30) - 0.55) * 3, 0, 1));
            colors.push(light * (1 + 0.1 * dry), light * (1 - 0.02 * dry), light * (1 - 0.18 * dry));
        }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        return geo;
    }

    const ground = new THREE.Mesh(groundGeometry(), new THREE.MeshLambertMaterial({ map: grassTex, vertexColors: true }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(MAP * 2, 6), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.02;
    road.receiveShadow = true;
    const road2 = new THREE.Mesh(new THREE.PlaneGeometry(MAP * 2, 5), roadMat);
    road2.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    road2.position.y = 0.025;
    road2.receiveShadow = true;
    scene.add(road, road2);

    function box(cx, y0, cz, w, h, d, color) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(color));
        m.position.set(cx, y0 + h / 2, cz);
        m.userData.static = true;
        scene.add(m);
        occluders.push(m);
        solids.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, y0, y1: y0 + h });
        return m;
    }

    function building(cx, cz, w, d, h, color, doors) {
        const t = 0.4;
        const dw = 3;
        const dh = 2.7;
        function wallX(z, key) {
            const gaps = (doors[key] || []).map((o) => cx + o).sort((a, b) => a - b);
            let x = cx - w / 2;
            const xe = cx + w / 2;
            for (const g of gaps) {
                const g0 = g - dw / 2;
                if (g0 > x) box((x + g0) / 2, 0, z, g0 - x, h, t, color);
                box(g, dh, z, dw, h - dh, t, color);
                x = g + dw / 2;
            }
            if (xe > x) box((x + xe) / 2, 0, z, xe - x, h, t, color);
        }
        function wallZ(x, key) {
            const gaps = (doors[key] || []).map((o) => cz + o).sort((a, b) => a - b);
            let z = cz - d / 2;
            const ze = cz + d / 2;
            for (const g of gaps) {
                const g0 = g - dw / 2;
                if (g0 > z) box(x, 0, (z + g0) / 2, t, h, g0 - z, color);
                box(x, dh, g, t, h - dh, dw, color);
                z = g + dw / 2;
            }
            if (ze > z) box(x, 0, (z + ze) / 2, t, h, ze - z, color);
        }
        wallX(cz - d / 2, 'n');
        wallX(cz + d / 2, 's');
        wallZ(cx - w / 2, 'w');
        wallZ(cx + w / 2, 'e');
        box(cx, h, cz, w + 0.6, 0.3, d + 0.6, 0x4a4f58);
        noSpawn.push({ x0: cx - w / 2 - 2.5, x1: cx + w / 2 + 2.5, z0: cz - d / 2 - 2.5, z1: cz + d / 2 + 2.5 });
    }

    // Keskin nişancı kulesi: basamaklardan zıplayarak çıkılır. dir: basamakların yönü (+1 doğu, -1 batı).
    function tower(x, z, dir) {
        box(x, 0, z, 5, 4.8, 5, 0x5d6470);
        box(x + 3.5 * dir, 0, z, 2, 3.6, 2.2, 0x6c7380);
        box(x + 5.5 * dir, 0, z, 2, 2.4, 2.2, 0x6c7380);
        box(x + 7.5 * dir, 0, z, 2, 1.2, 2.2, 0x6c7380);
        box(x, 4.8, z - 2.4, 5, 1, 0.2, 0x444a55);
        box(x, 4.8, z + 2.4, 5, 1, 0.2, 0x444a55);
        box(x - 2.4 * dir, 4.8, z, 0.2, 1, 5, 0x444a55);
        noSpawn.push({ x0: Math.min(x - 3, x + 9 * dir), x1: Math.max(x + 3, x + 9 * dir), z0: z - 4, z1: z + 4 });
    }

    // çevre duvarı
    box(0, 0, -MAP, MAP * 2 + 2, 5, 1, 0x3a3f4d);
    box(0, 0, MAP, MAP * 2 + 2, 5, 1, 0x3a3f4d);
    box(-MAP, 0, 0, 1, 5, MAP * 2 + 2, 0x3a3f4d);
    box(MAP, 0, 0, 1, 5, MAP * 2 + 2, 0x3a3f4d);

    // binalar
    building(-25, -20, 14, 10, 3.6, 0x9a8671, { s: [-3], e: [0] });
    building(28, -26, 20, 12, 5, 0x6f7a86, { w: [0], n: [-5, 5], s: [0] });
    building(-30, 28, 8, 8, 3.2, 0xa06c4d, { s: [0] });
    building(32, 30, 18, 8, 3.6, 0x7d8c6c, { w: [0], e: [0], n: [-4] });
    building(-8, -46, 10, 8, 3.4, 0xb09a80, { s: [2], n: [-2] });
    building(-55, -20, 9, 7, 3.2, 0x8a7a9a, { e: [0] });
    // iç sandıklar
    box(-27, 0, -22, 1.2, 1.2, 1.2, 0x8b6a3e); box(-23, 0, -18, 1.2, 1.2, 1.2, 0x8b6a3e);
    box(24, 0, -28, 1.2, 1.2, 1.2, 0x8b6a3e); box(24, 1.2, -28, 1.2, 1.2, 1.2, 0x9a7a4a); box(33, 0, -23, 2, 1, 1.2, 0x7a5a30);
    box(30, 0, 32, 1.2, 1.2, 1.2, 0x8b6a3e); box(36, 0, 28, 1.2, 1.2, 1.2, 0x8b6a3e);

    tower(-50, -40, 1);
    tower(50, 40, -1);

    // konteynerler
    box(-6, 0, 15, 6, 2.6, 2.4, 0xb5493f); box(2, 0, 15, 6, 2.6, 2.4, 0x3f6ab5); box(-2, 0, 19, 2.4, 2.6, 6, 0x3fa05a);
    box(20, 0, 6, 6, 2.6, 2.4, 0xd89a2b); box(-40, 0, 10, 2.4, 2.6, 6, 0x3f6ab5); box(45, 0, -10, 6, 2.6, 2.4, 0xb5493f);
    box(10, 0, -45, 2.4, 2.6, 6, 0x3fa05a); box(-15, 0, 40, 6, 2.6, 2.4, 0xd89a2b);
    noSpawn.push({ x0: -10, x1: 6, z0: 12, z1: 23 });

    // sandık kümeleri
    function crates(x, z) {
        box(x, 0, z, 1.2, 1.2, 1.2, 0x8b6a3e); box(x + 1.3, 0, z + 0.2, 1.2, 1.2, 1.2, 0x9a7a4a);
        box(x + 0.5, 0, z + 1.4, 1.2, 1.2, 1.2, 0x7a5a30); box(x + 0.6, 1.2, z + 0.4, 1.2, 1.2, 1.2, 0x8b6a3e);
    }
    [[10, -8], [-15, 8], [15, 18], [-20, -42], [40, 2], [-45, 16], [5, -30], [-35, -8], [25, 50], [-10, 50], [50, -35], [-60, 5]].forEach((p) => crates(p[0], p[1]));
    // beton bariyerler ve kum torbaları
    [[-14, 2.5], [-6, -2.5], [8, 2.5], [16, -2.5], [-30, -2.5], [34, 2.5], [46, -2.5]].forEach((p) => box(p[0], 0, p[1], 3, 1, 0.6, 0x9b9b9b));
    [[0, -14], [2.5, -24], [-2.5, 28], [2, 40]].forEach((p) => box(p[0], 0, p[1], 0.6, 1, 3, 0x9b9b9b));
    [[-12, -10, 4, 0.9], [12, 26, 0.9, 4], [-42, -30, 4, 0.9], [42, 18, 0.9, 4], [18, -42, 4, 0.9], [-24, 52, 0.9, 4]].forEach((p) => box(p[0], 0, p[1], p[2], 1.1, p[3], 0x8d7d5a));

    SPAWNS.forEach((s) => noSpawn.push({ x0: s[0] - 4, x1: s[0] + 4, z0: s[1] - 4, z1: s[1] + 4 }));
    function freeSpot(x, z, margin) {
        for (const r of noSpawn) if (x > r.x0 - margin && x < r.x1 + margin && z > r.z0 - margin && z < r.z1 + margin) return false;
        for (const s of solids) if (x > s.x0 - margin && x < s.x1 + margin && z > s.z0 - margin && z < s.z1 + margin) return false;
        return true;
    }

    // ağaçlar
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.3, 3, 6);
    const coneGeo1 = new THREE.ConeGeometry(1.7, 3.2, 7);
    const coneGeo2 = new THREE.ConeGeometry(1.2, 2.6, 7);
    let placed = 0;
    for (let i = 0; i < 400 && placed < 55; i++) {
        const x = (rnd() * 2 - 1) * (MAP - 4);
        const z = (rnd() * 2 - 1) * (MAP - 4);
        if (Math.abs(z) < 4.5 || Math.abs(x) < 4) continue;
        if (!freeSpot(x, z, 1.5)) continue;
        const g = 0x2e5e34 + Math.floor(rnd() * 3) * 0x0a0800;
        const trunk = new THREE.Mesh(trunkGeo, lam(0x6b4a2b));
        trunk.position.set(x, 1.5, z);
        const c1 = new THREE.Mesh(coneGeo1, lam(g, 'leaves'));
        c1.position.set(x, 4.2, z);
        const c2 = new THREE.Mesh(coneGeo2, lam(g + 0x050500, 'leaves'));
        c2.position.set(x, 5.9, z);
        [trunk, c1, c2].forEach((m) => { m.userData.static = true; scene.add(m); });
        occluders.push(trunk);
        solids.push({ x0: x - 0.3, x1: x + 0.3, z0: z - 0.3, z1: z + 0.3, y0: 0, y1: 3, tree: true });
        treeSpots.push([x, z]);
        placed++;
    }
    // kayalar
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    placed = 0;
    for (let i = 0; i < 300 && placed < 16; i++) {
        const x = (rnd() * 2 - 1) * (MAP - 5);
        const z = (rnd() * 2 - 1) * (MAP - 5);
        if (Math.abs(z) < 4 || !freeSpot(x, z, 2)) continue;
        const r = 0.8 + rnd() * 1.1;
        const m = new THREE.Mesh(rockGeo, lam(0x7d7f84));
        m.scale.set(r, r * 0.75, r);
        m.position.set(x, r * 0.55, z);
        m.rotation.y = rnd() * 6;
        m.userData.static = true;
        scene.add(m);
        occluders.push(m);
        solids.push({ x0: x - r * 0.75, x1: x + r * 0.75, z0: z - r * 0.75, z1: z + r * 0.75, y0: 0, y1: r * 1.1 });
        placed++;
    }
    // ÇALILIKLAR (çarpışma yok, içinde saklanılır)
    const bushGeo = new THREE.SphereGeometry(1, 7, 6);
    placed = 0;
    for (let i = 0; i < 500 && placed < 48; i++) {
        const x = (rnd() * 2 - 1) * (MAP - 4);
        const z = (rnd() * 2 - 1) * (MAP - 4);
        if (!freeSpot(x, z, 1.2)) continue;
        const gcol = [0x2f6b3a, 0x3a7a3f, 0x2a5c33][Math.floor(rnd() * 3)];
        for (let k = 0; k < 4; k++) {
            const b = new THREE.Mesh(bushGeo, lam(gcol, 'leaves'));
            const s = 0.9 + rnd() * 0.5;
            b.scale.set(s, s * 0.85, s);
            b.position.set(x + (rnd() - 0.5) * 1.8, 0.6, z + (rnd() - 0.5) * 1.8);
            b.userData.static = true;
            scene.add(b);
        }
        bushZones.push({ x, z, r: 1.9 });
        placed++;
    }
    // ~800 static meshes become one draw call per material. The originals stay out of the scene
    // with frozen world matrices so the player's bullets can still raycast against them.
    (function mergeStatic() {
        const byMaterial = new Map();
        for (const m of [...scene.children]) {
            if (!m.isMesh || !m.userData.static) continue;
            m.updateMatrixWorld(true);
            if (!byMaterial.has(m.material)) byMaterial.set(m.material, []);
            byMaterial.get(m.material).push(m);
            scene.remove(m);
        }
        for (const [material, list] of byMaterial) {
            const parts = list.map((m) => {
                const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
                g.applyMatrix4(m.matrixWorld);
                return g;
            });
            const count = parts.reduce((n, g) => n + g.attributes.position.count, 0);
            const pos = new Float32Array(count * 3);
            const nor = new Float32Array(count * 3);
            const uv = new Float32Array(count * 2);
            const spec = SURFACES[material.userData.surface];
            let o = 0;
            for (const g of parts) {
                const n = g.attributes.position.count;
                pos.set(g.attributes.position.array, o * 3);
                nor.set(g.attributes.normal.array, o * 3);
                if (spec && spec.box && g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
                o += n;
                g.dispose();
            }
            if (spec && !spec.box) {
                // World-space box mapping: every face gets the same texel density, whatever the box size.
                for (let i = 0; i < count; i++) {
                    const ax = Math.abs(nor[i * 3]);
                    const ay = Math.abs(nor[i * 3 + 1]);
                    const az = Math.abs(nor[i * 3 + 2]);
                    const x = pos[i * 3];
                    const y = pos[i * 3 + 1];
                    const z = pos[i * 3 + 2];
                    const [u, v] = ay >= ax && ay >= az ? [x, z] : ax >= az ? [z, y] : [x, y];
                    uv[i * 2] = u / spec.scale;
                    uv[i * 2 + 1] = v / spec.scale;
                }
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
            if (spec) geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
            geo.computeBoundingSphere();
            const mesh = new THREE.Mesh(geo, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
        }
    })();

    function inBush(x, z) {
        for (const b of bushZones) {
            const dx = x - b.x;
            const dz = z - b.z;
            if (dx * dx + dz * dz < b.r * b.r) return true;
        }
        return false;
    }

    /* ---------- Çarpışma ve ışın testleri ---------- */

    function blocked(x, z, fy) {
        for (const s of solids) {
            if (x + R > s.x0 && x - R < s.x1 && z + R > s.z0 && z - R < s.z1 && s.y1 > fy + 0.45 && s.y0 < fy + 1.6) return true;
        }
        return false;
    }
    function groundAt(x, z, fy) {
        let g = 0;
        for (const s of solids) {
            if (x + R * 0.8 > s.x0 && x - R * 0.8 < s.x1 && z + R * 0.8 > s.z0 && z - R * 0.8 < s.z1 && s.y1 <= fy + 0.5 && s.y1 > g) g = s.y1;
        }
        return g;
    }
    function ceilingAt(x, z, fy, h) {
        for (const s of solids) {
            if (x + R * 0.8 > s.x0 && x - R * 0.8 < s.x1 && z + R * 0.8 > s.z0 && z - R * 0.8 < s.z1 && s.y0 >= fy + 1 && s.y0 < fy + h + 0.2) return s.y0;
        }
        return null;
    }

    // Slab test against one AABB; returns the entry distance or Infinity.
    function rayBox(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1, maxT) {
        let tmin = 0;
        let tmax = maxT;
        const axes = [[ox, dx, x0, x1], [oy, dy, y0, y1], [oz, dz, z0, z1]];
        for (const [o, d, lo, hi] of axes) {
            if (Math.abs(d) < 1e-9) {
                if (o < lo || o > hi) return Infinity;
            } else {
                let t1 = (lo - o) / d;
                let t2 = (hi - o) / d;
                if (t1 > t2) [t1, t2] = [t2, t1];
                if (t1 > tmin) tmin = t1;
                if (t2 < tmax) tmax = t2;
                if (tmin > tmax) return Infinity;
            }
        }
        return tmin;
    }
    function rayDistance(ox, oy, oz, dx, dy, dz, maxT) {
        let best = maxT;
        for (const s of solids) {
            const t = rayBox(ox, oy, oz, dx, dy, dz, s.x0, s.y0, s.z0, s.x1, s.y1, s.z1, best);
            if (t < best) best = t;
        }
        if (dy < 0) { const tg = -oy / dy; if (tg < best) best = tg; }
        return best;
    }
    function segmentBlocked(ax, ay, az, bx, by, bz) {
        const dx = bx - ax;
        const dy = by - ay;
        const dz = bz - az;
        const len = Math.hypot(dx, dy, dz) || 1;
        return rayDistance(ax, ay, az, dx / len, dy / len, dz / len, len) < len - 0.05;
    }

    /* ---------- Bot gezinme ızgarası (1 m hücre, A*) ---------- */

    const GN = MAP * 2;
    const grid = new Uint8Array(GN * GN);
    for (const s of solids) {
        if (s.y0 > 1.5 || s.y1 < 0.45) continue;
        const m = R + 0.12;
        for (let cx = Math.max(0, Math.floor(s.x0 - m + MAP)); cx <= Math.min(GN - 1, Math.floor(s.x1 + m + MAP)); cx++) {
            for (let cz = Math.max(0, Math.floor(s.z0 - m + MAP)); cz <= Math.min(GN - 1, Math.floor(s.z1 + m + MAP)); cz++) {
                const x = cx - MAP + 0.5;
                const z = cz - MAP + 0.5;
                if (x > s.x0 - m && x < s.x1 + m && z > s.z0 - m && z < s.z1 + m) grid[cz * GN + cx] = 1;
            }
        }
    }
    const cellIndex = (x, z) => clamp(Math.floor(z + MAP), 0, GN - 1) * GN + clamp(Math.floor(x + MAP), 0, GN - 1);
    const cellCenter = (i) => ({ x: (i % GN) - MAP + 0.5, z: Math.floor(i / GN) - MAP + 0.5 });
    const SPAWN_POINTS = SPAWNS.filter((s) => !grid[cellIndex(s[0], s[1])] && !blocked(s[0], s[1], 0));
    const walkable = [];
    for (let i = 0; i < grid.length; i++) if (!grid[i]) walkable.push(i);

    const gScore = new Float32Array(GN * GN);
    const cameFrom = new Int32Array(GN * GN);
    const stamp = new Int32Array(GN * GN);
    const closedStamp = new Int32Array(GN * GN);
    let searchId = 0;

    function nearestFree(i) {
        if (!grid[i]) return i;
        const cx = i % GN;
        const cz = Math.floor(i / GN);
        for (let r = 1; r < 6; r++) {
            for (let dz = -r; dz <= r; dz++) {
                for (let dx = -r; dx <= r; dx++) {
                    const x = cx + dx;
                    const z = cz + dz;
                    if (x >= 0 && z >= 0 && x < GN && z < GN && !grid[z * GN + x]) return z * GN + x;
                }
            }
        }
        return -1;
    }

    function lineWalkable(ax, az, bx, bz) {
        const len = Math.hypot(bx - ax, bz - az);
        const steps = Math.ceil(len / 0.4);
        for (let k = 1; k <= steps; k++) {
            const t = k / steps;
            if (grid[cellIndex(lerp(ax, bx, t), lerp(az, bz, t))]) return false;
        }
        return true;
    }

    function findPath(sx, sz, gx, gz) {
        const start = nearestFree(cellIndex(sx, sz));
        const goal = nearestFree(cellIndex(gx, gz));
        if (start < 0 || goal < 0) return null;
        searchId++;
        const heap = [];
        const push = (f, i) => {
            heap.push([f, i]);
            let n = heap.length - 1;
            while (n > 0) {
                const p = (n - 1) >> 1;
                if (heap[p][0] <= heap[n][0]) break;
                [heap[p], heap[n]] = [heap[n], heap[p]];
                n = p;
            }
        };
        const pop = () => {
            const top = heap[0];
            const last = heap.pop();
            if (heap.length) {
                heap[0] = last;
                let n = 0;
                for (;;) {
                    const l = n * 2 + 1;
                    const r = l + 1;
                    let m = n;
                    if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
                    if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
                    if (m === n) break;
                    [heap[m], heap[n]] = [heap[n], heap[m]];
                    n = m;
                }
            }
            return top;
        };
        const gxC = goal % GN;
        const gzC = Math.floor(goal / GN);
        const h = (i) => {
            const dx = Math.abs((i % GN) - gxC);
            const dz = Math.abs(Math.floor(i / GN) - gzC);
            return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
        };
        stamp[start] = searchId;
        gScore[start] = 0;
        cameFrom[start] = -1;
        push(h(start), start);
        let expanded = 0;
        while (heap.length && expanded < 6000) {
            const [, cur] = pop();
            if (closedStamp[cur] === searchId) continue;
            closedStamp[cur] = searchId;
            if (cur === goal) break;
            expanded++;
            const cx = cur % GN;
            const cz = Math.floor(cur / GN);
            for (let dz = -1; dz <= 1; dz++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (!dx && !dz) continue;
                    const nx = cx + dx;
                    const nz = cz + dz;
                    if (nx < 0 || nz < 0 || nx >= GN || nz >= GN) continue;
                    const n = nz * GN + nx;
                    if (grid[n] || closedStamp[n] === searchId) continue;
                    if (dx && dz && (grid[cz * GN + nx] || grid[nz * GN + cx])) continue;
                    const g = gScore[cur] + (dx && dz ? 1.414 : 1);
                    if (stamp[n] !== searchId || g < gScore[n]) {
                        stamp[n] = searchId;
                        gScore[n] = g;
                        cameFrom[n] = cur;
                        push(g + h(n), n);
                    }
                }
            }
        }
        if (closedStamp[goal] !== searchId) return null;
        const cells = [];
        for (let i = goal; i !== -1; i = cameFrom[i]) cells.push(i);
        cells.reverse();
        // String pulling: keep only the waypoints a straight walk cannot skip.
        const pts = cells.map(cellCenter);
        const out = [];
        let anchor = { x: sx, z: sz };
        let i = 0;
        while (i < pts.length) {
            let j = Math.min(pts.length - 1, i + 8);
            while (j > i && !lineWalkable(anchor.x, anchor.z, pts[j].x, pts[j].z)) j--;
            out.push(pts[j]);
            anchor = pts[j];
            i = j + 1;
        }
        return out;
    }

    /* ---------- Silahlar ve modeller ---------- */

    // Patterned camos paint the whole gun except its dark parts; the plain ones get brushed metal and wood grain.
    const CAMO_PATTERNS = {
        desert: ['#c9b48a', '#b59a6a', '#8a7350', '#6b5a3e'],
        forest: ['#55703f', '#2c3a24', '#6b5a32', '#82955c'],
        arctic: ['#e9eef2', '#c4ced6', '#9aa7b3', '#ffffff'],
        crimson: ['#8e2230', '#5a1a1f', '#3a0d14', '#b8434c']
    };
    const weaponTex = {};
    function weaponTexture(kind) {
        if (weaponTex[kind]) return weaponTex[kind];
        const S = 256;
        const k = S / 512;
        const c = document.createElement('canvas');
        c.width = c.height = S;
        const g = c.getContext('2d');
        const pattern = CAMO_PATTERNS[kind];
        if (pattern) {
            g.fillStyle = pattern[0];
            g.fillRect(0, 0, S, S);
            pattern.slice(1).forEach((color) => {
                for (let i = 0; i < 16; i++) {
                    const cx = Math.random() * S;
                    const cy = Math.random() * S;
                    for (let j = 0; j < 5; j++) blob(g, S, cx + rand(-18, 18), cy + rand(-10, 10), rand(8, 20), color);
                }
            });
            overlay(g, S, NOISE_HI, 2, 0.12);
        } else if (kind === 'grain') {
            g.fillStyle = gray(228);
            g.fillRect(0, 0, S, S);
            g.strokeStyle = 'rgba(90,60,35,.28)';
            for (let l = 0; l < 40; l++) {
                const y0 = Math.random() * S;
                const ph = rand(0, TAU);
                g.lineWidth = rand(0.6, 1.6);
                g.beginPath();
                for (let x = 0; x <= S; x += 4) g.lineTo(x, y0 + Math.sin(x / 26 + ph) * 3);
                g.stroke();
            }
            overlay(g, S, NOISE_LO, 1, 0.15);
        } else {
            g.fillStyle = gray(226);
            g.fillRect(0, 0, S, S);
            for (let i = 0; i < 900; i++) {
                g.fillStyle = gray(Math.round(rand(150, 255)), rand(0.08, 0.18));
                g.fillRect(Math.random() * S - S / 2, Math.random() * S, S * rand(0.2, 1), 1);
            }
            overlay(g, S, NOISE_HI, 2, 0.15);
            dots(g, S, 120, 2 * k, ['rgba(0,0,0,.25)']);
        }
        const tex = makeCanvasTexture();
        tex.image = c;
        tex.needsUpdate = true;
        weaponTex[kind] = tex;
        return tex;
    }

    const camoMats = {};
    function camoMaterials(id) {
        if (camoMats[id]) return camoMats[id];
        const style = CAMO_STYLES[id] || CAMO_STYLES.standard;
        const make = (color, map) => {
            const c = new THREE.Color(color).multiplyScalar(1.1);
            return style.shiny
                ? new THREE.MeshPhongMaterial({ color: c, map, shininess: 90, specular: 0xfff0b0 })
                : new THREE.MeshLambertMaterial({ color: c, map });
        };
        const glass = lam(0x335577);
        if (CAMO_PATTERNS[id]) {
            const t = weaponTexture(id);
            camoMats[id] = { metal: make(0xf2f2f2, t), wood: make(0xd6d6d6, t), acc: make(0xb4b4b4, t), dark: make(style.dark, weaponTexture('brushed')), glass };
        } else {
            const brushed = weaponTexture('brushed');
            camoMats[id] = { metal: make(style.metal, brushed), dark: make(style.dark, brushed), wood: make(style.wood, weaponTexture('grain')), acc: make(style.acc, brushed), glass };
        }
        return camoMats[id];
    }
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffcc66, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const CYL = (r, l) => { const g = new THREE.CylinderGeometry(r, r, l, 8); g.rotateX(Math.PI / 2); return g; };
    function mk(g, m, x, y, z, rx) {
        const o = new THREE.Mesh(g, m);
        o.position.set(x, y, z);
        if (rx) o.rotation.x = rx;
        return o;
    }

    function makeWeapon(i, camoId) {
        const m = camoMaterials(camoId);
        const g = new THREE.Group();
        let mz;
        if (i === 0) { // tüfek
            g.add(mk(BOX(0.06, 0.09, 0.42), m.metal, 0, 0, -0.08));
            g.add(mk(CYL(0.018, 0.36), m.dark, 0, 0.015, -0.45));
            g.add(mk(BOX(0.07, 0.065, 0.26), m.wood, 0, -0.005, -0.3));
            g.add(mk(BOX(0.055, 0.1, 0.26), m.wood, 0, -0.03, 0.2));
            g.add(mk(BOX(0.04, 0.17, 0.07), m.dark, 0, -0.12, -0.04, 0.2));
            g.add(mk(BOX(0.04, 0.1, 0.05), m.dark, 0, -0.09, 0.07, -0.3));
            g.add(mk(BOX(0.03, 0.035, 0.12), m.acc, 0, 0.065, -0.1));
            mz = -0.66;
        } else if (i === 1) { // tabanca
            g.add(mk(BOX(0.05, 0.065, 0.24), m.metal, 0, 0, -0.1));
            g.add(mk(BOX(0.045, 0.13, 0.06), m.dark, 0, -0.095, 0, 0.25));
            g.add(mk(CYL(0.014, 0.06), m.dark, 0, 0.005, -0.24));
            g.add(mk(BOX(0.02, 0.02, 0.03), m.acc, 0, 0.04, -0.2));
            mz = -0.27;
        } else if (i === 2) { // pompalı
            g.add(mk(BOX(0.065, 0.09, 0.3), m.metal, 0, 0, -0.05));
            g.add(mk(CYL(0.026, 0.62), m.dark, 0, 0.02, -0.5));
            g.add(mk(CYL(0.022, 0.5), m.acc, 0, -0.03, -0.45));
            g.add(mk(BOX(0.07, 0.055, 0.2), m.wood, 0, -0.045, -0.4));
            g.add(mk(BOX(0.055, 0.11, 0.3), m.wood, 0, -0.03, 0.24));
            g.add(mk(BOX(0.04, 0.09, 0.05), m.dark, 0, -0.09, 0.05, -0.3));
            mz = -0.84;
        } else { // keskin nişancı
            g.add(mk(BOX(0.055, 0.085, 0.45), m.metal, 0, 0, -0.05));
            g.add(mk(CYL(0.016, 0.62), m.dark, 0, 0.01, -0.58));
            g.add(mk(BOX(0.055, 0.12, 0.34), m.wood, 0, -0.03, 0.26));
            g.add(mk(CYL(0.03, 0.26), m.dark, 0, 0.085, -0.08));
            g.add(mk(CYL(0.034, 0.03), m.glass, 0, 0.085, -0.215));
            g.add(mk(BOX(0.02, 0.04, 0.03), m.dark, 0, 0.055, -0.08));
            g.add(mk(BOX(0.04, 0.1, 0.05), m.dark, 0, -0.09, 0.07, -0.3));
            mz = -0.9;
        }
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), flashMat);
        f.position.set(0, 0.012, mz - 0.03);
        f.visible = false;
        g.add(f);
        g.userData.flash = f;
        g.userData.muzzle = mz;
        return g;
    }

    function disposeTree(obj) {
        obj.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    }

    let vmModels = [];
    let vmCamo = '';
    function buildViewmodels(camoId) {
        if (vmCamo === camoId) return;
        vmModels.forEach((m) => { vmRoot.remove(m); disposeTree(m); });
        vmModels = WEAPONS.map((_, i) => {
            const m = makeWeapon(i, camoId);
            m.visible = false;
            vmRoot.add(m);
            return m;
        });
        vmCamo = camoId;
    }

    /* ---------- Ses (dosyasız, Web Audio) ---------- */

    let audio = null;
    let master = null;
    let noiseBuf = null;
    function ac() {
        if (window.CasualSettings && !CasualSettings.get().sound) return null;
        try {
            if (!audio) {
                const Ctx = window.AudioContext || window.webkitAudioContext;
                if (!Ctx) return null;
                audio = new Ctx();
                master = audio.createGain();
                master.connect(audio.destination);
                noiseBuf = audio.createBuffer(1, Math.floor(audio.sampleRate * 1.2), audio.sampleRate);
                const d = noiseBuf.getChannelData(0);
                for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            }
            if (audio.state === 'suspended') audio.resume();
            master.gain.value = prefs.vol / 100;
            return audio;
        } catch { return null; }
    }
    function outNode(pan) {
        if (!pan || !audio.createStereoPanner) return master;
        const p = audio.createStereoPanner();
        p.pan.value = clamp(pan, -1, 1);
        p.connect(master);
        return p;
    }
    function noise(dur, freq, vol, pan = 0, type = 'lowpass') {
        const a = ac();
        if (!a || vol <= 0.01) return;
        const s = a.createBufferSource();
        s.buffer = noiseBuf;
        const f = a.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        const g = a.createGain();
        g.gain.setValueAtTime(vol, a.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
        s.connect(f);
        f.connect(g);
        g.connect(outNode(pan));
        s.start();
        s.stop(a.currentTime + dur);
    }
    function tone(freq, dur, type = 'sine', vol = 0.08, slide = 0, pan = 0) {
        const a = ac();
        if (!a || vol <= 0.005) return;
        const o = a.createOscillator();
        const g = a.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, a.currentTime);
        if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), a.currentTime + dur);
        g.gain.setValueAtTime(vol, a.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
        o.connect(g);
        g.connect(outNode(pan));
        o.start();
        o.stop(a.currentTime + dur);
    }
    function shotSound(w, vol = 1, pan = 0) {
        noise([0.12, 0.1, 0.28, 0.4][w], [2600, 3200, 1500, 1100][w], vol * [0.5, 0.4, 0.8, 0.9][w], pan);
        tone([90, 120, 70, 60][w], 0.12, 'triangle', vol * 0.18, -40, pan);
    }
    // Sound level and stereo pan of a world point relative to the listener.
    function spatial(x, z, range = 90) {
        const dx = x - player.x;
        const dz = z - player.z;
        const dist = Math.hypot(dx, dz) || 1;
        const pan = (dx * Math.cos(player.yaw) - dz * Math.sin(player.yaw)) / dist;
        return { vol: Math.pow(clamp(1 - dist / range, 0, 1), 1.5), pan: pan * 0.8, dist };
    }

    /* ---------- Oyuncu ---------- */

    const player = {
        nid: newNid(), x: 0, y: 0, z: 0, velY: 0, yaw: 0, pitch: 0, recoil: 0,
        eye: EYE_STAND, onGround: true, stance: 0,
        slideSpeed: 0, slideDx: 0, slideDz: 0, speedNow: 0, cPrev: false,
        hp: 100, alive: false, weapon: 0, ammo: WEAPONS.map((w) => w.mag), nades: NADES_PER_LIFE, nextNade: 0,
        reloading: false, reloadStart: 0, nextShot: 0, fireSeq: 0, ads: false, lastShotAt: -1e9,
        shieldUntil: 0, lastHurt: 0, respawnAt: 0, streak: 0, killer: 0, killerWeapon: 0, killerHead: false, bloom: 0
    };

    function newNid() { return 1 + Math.floor(Math.random() * 65000); }

    const match = {
        phase: 'menu', mode: 'solo', paused: false, remaining: 0, killLimit: 20, timeMs: 300000, diff: 'normal',
        rewarded: false, syncAt: 0, autoRestartAt: 0
    };
    const scores = new Map(); // nid -> { name, camo, kills, deaths, bot }
    const actors = new Map(); // nid -> uzak oyuncu ya da bot
    let previewCamo = null;
    let roomCode = '';

    const isOnline = () => match.mode !== 'solo';
    const isAuthority = () => match.mode !== 'client';
    const inPlay = () => match.phase === 'play';
    const canAct = () => inPlay() && !match.paused && player.alive && !overlayOpen();

    function myName() {
        const profile = CasualProfile.current();
        return profile ? profile.displayName : `Misafir${player.nid % 1000}`;
    }
    function ownedCamos(profile) {
        if (cheatOn('features')) return Object.keys(CasualProfile.camos);
        return profile?.ownedCamos || ['standard'];
    }
    function myCamo() {
        const id = previewCamo || CasualProfile.current()?.selectedCamo || 'standard';
        return CAMO_STYLES[id] ? id : 'standard';
    }
    function cleanName(value) {
        return String(value || '').normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f<>]/g, '').trim().slice(0, 20) || 'Oyuncu';
    }
    function nameOf(nid) {
        if (nid === player.nid) return 'Sen';
        return scores.get(nid)?.name || actors.get(nid)?.name || 'Oyuncu';
    }

    /* ---------- Uzak oyuncular ve botlar ---------- */

    function colorFor(nid) { return new THREE.Color().setHSL((nid * 0.618) % 1, 0.55, 0.5); }

    function makeNameTag(text, bot) {
        const c = document.createElement('canvas');
        c.width = 256;
        c.height = 64;
        const g = c.getContext('2d');
        g.font = '700 30px Outfit, system-ui, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        const w = Math.min(250, g.measureText(text).width + 30);
        g.fillStyle = 'rgba(8,14,12,.6)';
        g.beginPath();
        if (g.roundRect) g.roundRect(128 - w / 2, 10, w, 46, 14); else g.rect(128 - w / 2, 10, w, 46);
        g.fill();
        g.fillStyle = bot ? '#ffd9a0' : '#ffffff';
        g.fillText(text, 128, 34);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
        sprite.scale.set(1.6, 0.4, 1);
        sprite.raycast = () => {};
        sprite.visible = false;
        return sprite;
    }

    function ensureActor(nid) {
        let a = actors.get(nid);
        if (a) return a;
        const group = new THREE.Group();
        group.rotation.order = 'YXZ';
        group.userData.nid = nid;
        group.visible = false;
        const shirt = new THREE.MeshLambertMaterial({ color: colorFor(nid) });
        const pants = lam(0x2a2d35);
        const skin = lam(0xf0c8a0);
        const body = new THREE.Group();
        group.add(body);
        const leg = (x) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.8, 0);
            pivot.add(mk(BOX(0.2, 0.8, 0.22), pants, 0, -0.4, 0));
            body.add(pivot);
            return pivot;
        };
        const legL = leg(-0.12);
        const legR = leg(0.12);
        body.add(mk(BOX(0.52, 0.62, 0.3), shirt, 0, 1.1, 0));
        body.add(mk(BOX(0.14, 0.55, 0.16), shirt, -0.34, 1.12, 0));
        const head = mk(new THREE.SphereGeometry(0.2, 10, 8), skin, 0, 1.58, 0);
        head.userData.head = true;
        body.add(head);
        body.add(mk(BOX(0.3, 0.07, 0.05), lam(0x1b1d22), 0, 1.62, -0.18));
        const hand = new THREE.Group();
        hand.position.set(0.3, 1.2, -0.1);
        body.add(hand);
        group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        scene.add(group);
        a = {
            nid, group, body, legL, legR, hand, shirt, tag: null, tagText: '',
            name: `Oyuncu ${nid % 1000}`, bot: nid >= BOT_BASE, camo: 'standard',
            weapon: -1, wCamo: '', wModel: null, buf: [],
            x: 0, y: 0, z: 0, yaw: 0, pitch: 0, stance: 0, alive: false, reloading: false, fireSeq: 0,
            flashUntil: 0, lastPacket: 0, lastShotAt: -1e9, deadAt: -1e9, deadLock: 0, hitUntil: 0,
            walk: 0, px: 0, pz: 0, losAt: 0, los: false, sim: null
        };
        actors.set(nid, a);
        return a;
    }

    function setActorInfo(a, name, bot, camo) {
        a.name = cleanName(name);
        a.bot = Boolean(bot);
        if (CAMO_STYLES[camo] && camo !== a.camo) { a.camo = camo; setActorWeapon(a, Math.max(0, a.weapon), true); }
        if (a.tagText !== a.name + a.bot) {
            if (a.tag) { scene.remove(a.tag); a.tag.material.map.dispose(); a.tag.material.dispose(); }
            a.tag = makeNameTag(a.name, a.bot);
            a.tagText = a.name + a.bot;
            scene.add(a.tag);
        }
    }

    function setActorWeapon(a, w, force) {
        if (!force && a.weapon === w && a.wCamo === a.camo) return;
        if (a.wModel) { a.hand.remove(a.wModel); disposeTree(a.wModel); }
        a.wModel = makeWeapon(w, a.camo);
        a.wModel.scale.setScalar(0.9);
        a.hand.add(a.wModel);
        a.weapon = w;
        a.wCamo = a.camo;
    }

    function removeActor(nid) {
        const a = actors.get(nid);
        if (!a) return;
        scene.remove(a.group);
        disposeTree(a.group);
        a.shirt.dispose();
        if (a.tag) { scene.remove(a.tag); a.tag.material.map.dispose(); a.tag.material.dispose(); }
        actors.delete(nid);
    }

    function clearActors() { [...actors.keys()].forEach(removeActor); }

    function setAlive(a, alive, now) {
        if (a.alive && !alive) a.deadAt = now;
        if (!a.alive && alive) { a.group.rotation.x = 0; a.buf.length = 0; }
        a.alive = alive;
    }

    // Combatant snapshot shared by bot perception and bot bullets.
    const fighters = [];
    function refreshFighters() {
        fighters.length = 0;
        if (match.phase !== 'menu') {
            fighters.push({ nid: player.nid, x: player.x, y: player.y, z: player.z, stance: player.stance, alive: player.alive, lastShotAt: player.lastShotAt });
        }
        for (const a of actors.values()) {
            if (!a.sim && !a.lastPacket) continue;
            fighters.push({ nid: a.nid, x: a.x, y: a.y, z: a.z, stance: a.stance, alive: a.alive, lastShotAt: a.lastShotAt });
        }
    }
    const fighterById = (nid) => fighters.find((f) => f.nid === nid) || null;

    function hitFighter(f, ox, oy, oz, dx, dy, dz) {
        const s = STANCE_SCALE[f.stance] || 1;
        // Head sphere
        const hx = f.x - ox;
        const hy = f.y + 1.58 * s - oy;
        const hz = f.z - oz;
        const tc = hx * dx + hy * dy + hz * dz;
        let best = null;
        if (tc > 0) {
            const d2 = hx * hx + hy * hy + hz * hz - tc * tc;
            const r2 = 0.21 * 0.21;
            if (d2 < r2) best = { t: tc - Math.sqrt(r2 - d2), head: true };
        }
        const tb = rayBox(ox, oy, oz, dx, dy, dz, f.x - 0.28, f.y, f.z - 0.28, f.x + 0.28, f.y + 1.4 * s, f.z + 0.28, 300);
        if (tb < Infinity && (!best || tb < best.t)) best = { t: tb, head: false };
        return best;
    }

    function damageFalloff(w, dist) {
        const [near, far] = w.range;
        if (dist <= near) return 1;
        if (dist >= far) return w.minMul;
        return lerp(1, w.minMul, (dist - near) / (far - near));
    }

    /* ---------- Efektler ---------- */

    // Effects come from fixed pools whose materials are never disposed: disposing the last material
    // that uses a shader makes three.js delete the program, and the next shot would recompile it.
    const effects = [];
    let shake = 0;

    function makePool(size, create) {
        const items = [];
        for (let i = 0; i < size; i++) {
            const o = create();
            o.visible = false;
            scene.add(o);
            items.push(o);
        }
        let next = 0;
        const take = () => { const o = items[next]; next = (next + 1) % size; return o; };
        take.items = items;
        return take;
    }
    const puffGeo = new THREE.SphereGeometry(0.06, 6, 5);
    const smokeGeo = new THREE.SphereGeometry(0.7, 8, 6);
    const fireGeo = new THREE.SphereGeometry(1, 14, 10);
    const takePuff = makePool(48, () => new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color: 0xddddcc, transparent: true, opacity: 0.9, depthWrite: false })));
    const takeTracer = makePool(32, () => {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.75 }));
        line.frustumCulled = false;
        return line;
    });
    const takeFire = makePool(4, () => new THREE.Mesh(fireGeo, new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })));
    const takeSmoke = makePool(32, () => new THREE.Mesh(smokeGeo, new THREE.MeshLambertMaterial({ color: 0x6e6a64, transparent: true, opacity: 0.7, depthWrite: false })));
    const pools = [takePuff, takeTracer, takeFire, takeSmoke];

    function addEffect(obj, life, update) {
        if (obj.userData.fx) obj.userData.fx.dead = true; // pooled object reused before it finished
        const entry = { obj, t: 0, life, update, dead: false };
        obj.userData.fx = entry;
        obj.visible = true;
        obj.scale.setScalar(1);
        effects.push(entry);
        update(obj, 0, 0);
    }
    function puff(x, y, z, color = 0xddddcc) {
        const m = takePuff();
        m.position.set(x, y, z);
        m.material.color.setHex(color);
        addEffect(m, 0.25, (o, k) => { o.scale.setScalar(1 + k * 2); o.material.opacity = 0.9 * (1 - k); });
    }
    function tracer(ax, ay, az, bx, by, bz) {
        const line = takeTracer();
        const pos = line.geometry.attributes.position;
        pos.setXYZ(0, ax, ay, az);
        pos.setXYZ(1, bx, by, bz);
        pos.needsUpdate = true;
        addEffect(line, 0.07, (o, k) => { o.material.opacity = 0.75 * (1 - k); });
    }
    function explosionFx(x, y, z) {
        const fire = takeFire();
        fire.position.set(x, y + 0.4, z);
        addEffect(fire, 0.4, (o, k) => { o.scale.setScalar(0.5 + k * 4.5); o.material.opacity = 0.9 * (1 - k); });
        for (let i = 0; i < 7; i++) {
            const smoke = takeSmoke();
            const vx = rand(-1.4, 1.4);
            const vz = rand(-1.4, 1.4);
            smoke.position.set(x + vx * 0.4, y + 0.6, z + vz * 0.4);
            addEffect(smoke, rand(1.3, 2), (o, k, dt) => {
                o.position.x += vx * dt;
                o.position.z += vz * dt;
                o.position.y += 1.3 * dt;
                o.scale.setScalar(1 + k * 2.4);
                o.material.opacity = 0.7 * (1 - k);
            });
        }
        boomLight.position.set(x, y + 1.5, z);
        boomLight.intensity = 4;
    }
    function updateEffects(dt) {
        for (let i = effects.length - 1; i >= 0; i--) {
            const e = effects[i];
            if (e.dead) { effects.splice(i, 1); continue; }
            e.t += dt;
            const k = Math.min(1, e.t / e.life);
            e.update(e.obj, k, dt);
            if (k >= 1) {
                e.obj.visible = false;
                e.obj.userData.fx = null;
                effects.splice(i, 1);
            }
        }
        boomLight.intensity = Math.max(0, boomLight.intensity - dt * 12);
        muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 40);
        shake = Math.max(0, shake - dt * 2.5);
    }
    function clearEffects() {
        effects.forEach((e) => { e.obj.visible = false; e.obj.userData.fx = null; });
        effects.length = 0;
    }
    // Compile every effect shader up front so the first shot or explosion does not hitch.
    function warmShaders() {
        const shown = pools.map((take) => take.items[0]);
        shown.forEach((o) => { o.visible = true; });
        try { renderer.compile(scene, camera); } catch { /* compiling early is only an optimisation */ }
        shown.forEach((o) => { o.visible = false; });
    }

    /* ---------- El bombaları ---------- */

    const grenades = new Map();
    const nadeGeo = new THREE.SphereGeometry(0.09, 10, 8);
    const nadeMat = lam(0x3d4a2a);
    let nadeSeq = 0;

    function spawnGrenade(id, owner, p, v, local) {
        if (grenades.has(id)) return;
        const mesh = new THREE.Mesh(nadeGeo, nadeMat);
        mesh.position.set(p[0], p[1], p[2]);
        scene.add(mesh);
        grenades.set(id, { id, owner, mesh, x: p[0], y: p[1], z: p[2], vx: v[0], vy: v[1], vz: v[2], t: 0, local, bounceAt: 0 });
    }

    function stepGrenade(g, dt, now) {
        const h = 1 / 120;
        for (let left = dt; left > 1e-6; left -= h) {
            const step = Math.min(h, left);
            g.vy += GRAVITY * 0.8 * step;
            const nx = g.x + g.vx * step;
            const ny = g.y + g.vy * step;
            const nz = g.z + g.vz * step;
            let bounced = false;
            for (const s of solids) {
                if (nx > s.x0 - 0.09 && nx < s.x1 + 0.09 && ny > s.y0 - 0.09 && ny < s.y1 + 0.09 && nz > s.z0 - 0.09 && nz < s.z1 + 0.09) {
                    if (g.x <= s.x0 - 0.09 || g.x >= s.x1 + 0.09) g.vx *= -0.45;
                    else if (g.z <= s.z0 - 0.09 || g.z >= s.z1 + 0.09) g.vz *= -0.45;
                    else { g.vy *= -0.4; g.vx *= 0.7; g.vz *= 0.7; }
                    bounced = true;
                    break;
                }
            }
            if (!bounced) { g.x = nx; g.y = ny; g.z = nz; }
            if (g.y < 0.09) {
                g.y = 0.09;
                if (Math.abs(g.vy) > 1.5) bounced = true;
                g.vy = Math.abs(g.vy) * 0.4;
                if (g.vy < 0.6) g.vy = 0;
                g.vx *= 0.75;
                g.vz *= 0.75;
            }
            g.x = clamp(g.x, -MAP + 0.6, MAP - 0.6);
            g.z = clamp(g.z, -MAP + 0.6, MAP - 0.6);
            if (bounced && now - g.bounceAt > 120) {
                g.bounceAt = now;
                const sp = spatial(g.x, g.z, 40);
                tone(1400, 0.05, 'square', 0.04 * sp.vol, -300, sp.pan);
            }
        }
        g.mesh.position.set(g.x, g.y, g.z);
        g.mesh.rotation.x += dt * 8;
    }

    function updateGrenades(dt, now) {
        for (const g of [...grenades.values()]) {
            g.t += dt;
            stepGrenade(g, dt, now);
            if (g.local && g.t >= NADE_FUSE) {
                const p = [round2(g.x), round2(g.y), round2(g.z)];
                removeGrenade(g.id);
                sendEvent({ t: 'x', f: g.owner, id: g.id, p });
                explodeAt(p[0], p[1], p[2], g.owner, now);
            } else if (!g.local && g.t > NADE_FUSE + 2) {
                removeGrenade(g.id);
            }
        }
    }

    function removeGrenade(id) {
        const g = grenades.get(id);
        if (!g) return;
        scene.remove(g.mesh);
        grenades.delete(id);
    }

    function clearGrenades() { [...grenades.keys()].forEach(removeGrenade); }

    function blastDamage(x, y, z, tx, ty, tz) {
        const d = Math.hypot(tx - x, ty - y, tz - z);
        if (d >= NADE_RADIUS || segmentBlocked(x, y + 0.25, z, tx, ty, tz)) return 0;
        return Math.round(NADE_DAMAGE * (1 - d / NADE_RADIUS));
    }

    function explodeAt(x, y, z, owner, now) {
        explosionFx(x, y, z);
        const sp = spatial(x, z, 120);
        noise(1.1, 420, 1.1 * sp.vol, sp.pan);
        tone(55, 0.6, 'sine', 0.35 * sp.vol, -25, sp.pan);
        shake = Math.max(shake, clamp(1 - sp.dist / 22, 0, 1) * 0.6);
        if (!inPlay()) return;
        if (player.alive) {
            const d = blastDamage(x, y, z, player.x, player.y + 1, player.z);
            if (d > 0) takeDamage(d, owner, NADE_WEAPON, false, now, x, z);
        }
        if (isAuthority()) {
            for (const a of actors.values()) {
                if (!a.sim || !a.sim.alive) continue;
                const d = blastDamage(x, y, z, a.x, a.y + 1, a.z);
                if (d > 0) botDamage(a, d, owner, NADE_WEAPON, false, now);
            }
        }
    }

    function throwGrenade(now) {
        if (!canAct() || player.nades <= 0 || now < player.nextNade) return;
        player.nades--;
        player.nextNade = now + 900;
        player.shieldUntil = 0;
        camera.updateMatrixWorld(true);
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const p = camera.position.clone().addScaledVector(dir, 0.5);
        const v = dir.multiplyScalar(17);
        v.y += 3.5;
        const id = player.nid * 16 + (nadeSeq++ & 15);
        const pos = [round2(p.x), round2(p.y), round2(p.z)];
        const vel = [round2(v.x), round2(v.y), round2(v.z)];
        spawnGrenade(id, player.nid, pos, vel, true);
        sendEvent({ t: 'g', f: player.nid, id, p: pos, v: vel });
        tone(340, 0.12, 'triangle', 0.06, 200);
        vmSwap = 0.7;
        updateHud();
    }

    /* ---------- Hasar ve ölüm ---------- */

    function deliverHit(from, to, d, w, hs, now) {
        if (to === player.nid) { const f = fighterById(from); takeDamage(d, from, w, hs, now, f?.x, f?.z); return; }
        const a = actors.get(to);
        if (a && a.sim) { botDamage(a, d, from, w, hs, now); return; }
        const msg = { t: 'h', f: from, to, d, w, hs: hs ? 1 : 0 };
        if (match.mode === 'client') sendTo(conns[0], msg);
        else if (match.mode === 'host') sendTo(conns.find((c) => c.nid === to), msg);
    }

    function takeDamage(d, from, w, hs, now, sx, sz) {
        if (!player.alive || !inPlay() || now < player.shieldUntil) return;
        let hp = player.hp - d;
        if (hp <= 0 && match.mode === 'solo' && cheatOn('immortal')) hp = 1;
        player.hp = Math.max(0, hp);
        player.lastHurt = now;
        const flash = $('dmgflash');
        flash.style.setProperty('--flash', String(clamp(d / 50, 0.35, 1)));
        flash.classList.remove('on');
        void flash.offsetWidth; // restart the fade
        flash.classList.add('on');
        if (Number.isFinite(sx) && from !== player.nid) damageIndicator(sx, sz);
        tone(180, 0.12, 'sawtooth', 0.05, -60);
        if (player.hp <= 0) killPlayer(from, w, hs, now);
        updateHud();
    }

    function damageIndicator(sx, sz) {
        const dx = sx - player.x;
        const dz = sz - player.z;
        const fwd = -dx * Math.sin(player.yaw) - dz * Math.cos(player.yaw);
        const right = dx * Math.cos(player.yaw) - dz * Math.sin(player.yaw);
        const arc = document.createElement('i');
        arc.style.transform = `rotate(${Math.atan2(right, fwd)}rad)`;
        $('dmgdir').append(arc);
        window.setTimeout(() => arc.remove(), 1100);
    }

    function killPlayer(from, w, hs, now) {
        player.alive = false;
        player.respawnAt = now + RESPAWN_MS;
        player.reloading = false;
        player.ads = false;
        mouseDown = false;
        touch.fire = false;
        player.killer = from;
        player.killerWeapon = w;
        player.killerHead = hs;
        const msg = { t: 'k', k: from, v: player.nid, w, hs: hs ? 1 : 0 };
        sendEvent(msg);
        applyKill(from, player.nid, w, hs, now);
        $('death-by').textContent = from === player.nid ? 'Kendi bomban' : `${nameOf(from)} · ${WEAPON_NAMES[w] || ''}${hs ? ' · kafadan' : ''}`;
        $('death').classList.remove('hidden');
    }

    function botDamage(a, d, from, w, hs, now) {
        const s = a.sim;
        if (!s.alive || now < s.shieldUntil || !inPlay()) return;
        s.hp -= d;
        s.hurtBy = from;
        s.hurtAt = now;
        a.hitUntil = now + 90;
        if (s.hp > 0) return;
        s.alive = false;
        s.respawnAt = now + RESPAWN_MS;
        setAlive(a, false, now);
        const msg = { t: 'k', k: from, v: a.nid, w, hs: hs ? 1 : 0 };
        if (match.mode === 'host') broadcast(msg);
        applyKill(from, a.nid, w, hs, now);
    }

    function applyKill(k, v, w, hs, now) {
        const ks = scores.get(k);
        const vs = scores.get(v);
        if (vs) vs.deaths++;
        if (ks && k !== v) ks.kills++;
        const a = actors.get(v);
        if (a) { setAlive(a, false, now); a.deadLock = now + 1200; }
        const cls = k === player.nid && v !== player.nid ? 'mine' : v === player.nid ? 'me' : '';
        if (k === v) feed([nameOf(v), ' kendini havaya uçurdu'], cls);
        else feed([nameOf(k), ` [${WEAPON_NAMES[w] || '?'}] `, nameOf(v), hs ? { cls: 'hs', text: ' · kafadan' } : ''], cls);
        if (k === player.nid && v !== player.nid) {
            player.streak++;
            const streakText = { 3: 'Üç öldürme serisi!', 5: 'Durdurulamaz!', 8: 'Efsane!', 12: 'Arena senin!' }[player.streak];
            banner(`Öldürdün: ${nameOf(v)}`, [hs ? 'Kafadan vuruş' : '', streakText || ''].filter(Boolean).join(' · '));
            hitmarker('kill');
            tone(880, 0.09, 'sine', 0.08);
            window.setTimeout(() => tone(1320, 0.12, 'sine', 0.07), 70);
        }
        if (v === player.nid) player.streak = 0;
        updateMatchHud(true);
        if (isAuthority() && ks && k !== v && ks.kills >= match.killLimit && inPlay()) endMatch();
    }

    /* ---------- Oyuncu: doğuş, hareket, ateş ---------- */

    function pickSpawn(selfNid) {
        let best = SPAWN_POINTS[0];
        let bestScore = -1;
        for (const sp of SPAWN_POINTS) {
            let d = 200;
            for (const f of fighters) if (f.nid !== selfNid && f.alive) d = Math.min(d, Math.hypot(f.x - sp[0], f.z - sp[1]));
            const score = d + Math.random() * 12;
            if (score > bestScore) { bestScore = score; best = sp; }
        }
        let x = best[0] + rand(-1.5, 1.5);
        let z = best[1] + rand(-1.5, 1.5);
        if (blocked(x, z, 0)) { x = best[0]; z = best[1]; }
        return { x, z, yaw: Math.atan2(x, z) + rand(-0.6, 0.6) };
    }

    function respawnPlayer(now) {
        refreshFighters();
        const sp = pickSpawn(player.nid);
        Object.assign(player, {
            x: sp.x, z: sp.z, y: 0, velY: 0, yaw: sp.yaw, pitch: 0, recoil: 0, stance: 0, eye: EYE_STAND,
            hp: 100, alive: true, reloading: false, ammo: WEAPONS.map((w) => w.mag), nades: NADES_PER_LIFE,
            shieldUntil: now + SHIELD_MS, lastHurt: 0, slideSpeed: 0
        });
        $('death').classList.add('hidden');
        document.querySelector('.tbtn[data-act="ads"]').classList.remove('on');
        updateHud();
    }

    let pointerLocked = false;
    let mouseDown = false;
    let touchMode = false;
    const keys = {};
    const touch = { moveId: null, lookId: null, mx: 0, my: 0, lx: 0, ly: 0, fire: false, crouch: false, jumpUntil: 0 };

    function readInput(now) {
        let fwd = 0;
        let side = 0;
        if (keys.KeyW || keys.ArrowUp) fwd += 1;
        if (keys.KeyS || keys.ArrowDown) fwd -= 1;
        if (keys.KeyA || keys.ArrowLeft) side -= 1;
        if (keys.KeyD || keys.ArrowRight) side += 1;
        let sprint = Boolean(keys.ShiftLeft || keys.ShiftRight);
        if (touch.moveId !== null) {
            fwd -= touch.my;
            side += touch.mx;
            if (-touch.my > 0.9) sprint = true;
        }
        return { fwd, side, sprint, jump: Boolean(keys.Space) || now < touch.jumpUntil, crouch: Boolean(keys.KeyC || keys.ControlLeft) || touch.crouch };
    }

    function updatePlayer(dt, now) {
        const input = readInput(now);
        const sy = Math.sin(player.yaw);
        const cy = Math.cos(player.yaw);
        let ix = -sy * input.fwd + cy * input.side;
        let iz = -cy * input.fwd - sy * input.side;
        const il = Math.hypot(ix, iz);
        if (il > 1) { ix /= il; iz /= il; }

        // C: kay / çömel
        const cDown = input.crouch;
        if (cDown && !player.cPrev) {
            if (player.onGround && il > 0.3 && player.speedNow > 4.8) {
                player.stance = 2;
                player.slideDx = ix / (il || 1);
                player.slideDz = iz / (il || 1);
                player.slideSpeed = Math.max(11, player.speedNow + 3);
                noise(0.35, 900, 0.12);
            } else player.stance = 1;
        }
        if (cDown && player.stance === 0) player.stance = 1;
        if (!cDown) {
            // Kalkmaya yer yoksa (alçak tavan) çömelik kal.
            player.stance = ceilingAt(player.x, player.z, player.y, EYE_STAND) !== null && player.stance ? 1 : 0;
        }
        player.cPrev = cDown;

        let vx = 0;
        let vz = 0;
        if (player.stance === 2) {
            player.slideSpeed -= 11 * dt;
            if (!player.onGround) player.slideSpeed = Math.max(player.slideSpeed, 4);
            if (player.slideSpeed <= 3.2) player.stance = 1;
            else { vx = player.slideDx * player.slideSpeed; vz = player.slideDz * player.slideSpeed; }
        }
        if (player.stance !== 2) {
            let sp = 6.2;
            if (player.stance === 1) sp = 3.2;
            else if (input.sprint && input.fwd > 0 && !player.ads) sp = 9.5;
            if (player.ads) sp *= 0.6;
            vx = ix * sp;
            vz = iz * sp;
        }
        const nx = player.x + vx * dt;
        const nz = player.z + vz * dt;
        let moved = false;
        if (!blocked(nx, player.z, player.y)) { player.x = nx; moved = true; } else if (player.stance === 2) player.slideSpeed = 0;
        if (!blocked(player.x, nz, player.y)) { player.z = nz; moved = true; } else if (player.stance === 2) player.slideSpeed = 0;
        player.speedNow = moved ? Math.hypot(vx, vz) : 0;
        player.x = clamp(player.x, -MAP + 1.2, MAP - 1.2);
        player.z = clamp(player.z, -MAP + 1.2, MAP - 1.2);

        // zıplama / yerçekimi
        if (input.jump && player.onGround && player.stance !== 2) {
            player.velY = JUMP;
            player.onGround = false;
            touch.jumpUntil = 0;
        }
        player.velY += GRAVITY * dt;
        player.y += player.velY * dt;
        if (player.velY > 0) {
            const c = ceilingAt(player.x, player.z, player.y, EYE_STAND + 0.1);
            if (c !== null) { player.y = c - EYE_STAND - 0.1; player.velY = 0; }
        }
        const gy = groundAt(player.x, player.z, player.y);
        if (player.y <= gy && player.velY <= 0) {
            if (!player.onGround && player.velY < -6) noise(0.12, 500, 0.12);
            player.y = gy;
            player.velY = 0;
            player.onGround = true;
        } else player.onGround = false;

        const eyeT = player.stance === 2 ? EYE_SLIDE : player.stance === 1 ? EYE_CROUCH : EYE_STAND;
        player.eye += (eyeT - player.eye) * Math.min(1, dt * 14);

        // can yenilenmesi
        if (player.hp < 100 && now - player.lastHurt > REGEN_DELAY_MS) {
            player.hp = Math.min(100, player.hp + REGEN_RATE * dt);
            updateHud();
        }
    }

    function switchWeapon(i) {
        if (i === player.weapon || !player.alive) return;
        player.weapon = i;
        player.reloading = false;
        player.nextShot = Math.max(player.nextShot, performance.now() + 250);
        vmSwap = 1;
        tone(500, 0.04, 'square', 0.03);
        updateHud();
    }

    function startReload() {
        const w = WEAPONS[player.weapon];
        if (player.reloading || player.ammo[player.weapon] >= w.mag || !player.alive) return;
        player.reloading = true;
        player.reloadStart = performance.now();
        tone(300, 0.05, 'square', 0.03);
        updateHud();
    }

    const raycaster = new THREE.Raycaster();
    const muzzlePos = new THREE.Vector3();
    let vmKick = 0;
    let vmSwap = 0;
    let bobT = 0;
    let camRoll = 0;
    let flashUntil = 0;

    function tryShoot(now) {
        const w = WEAPONS[player.weapon];
        if (!canAct() || player.reloading || now < player.nextShot) return;
        if (player.ammo[player.weapon] <= 0) { startReload(); return; }
        player.ammo[player.weapon]--;
        player.nextShot = now + w.delay;
        player.fireSeq = (player.fireSeq + 1) & 3;
        player.lastShotAt = now;
        player.shieldUntil = 0;
        flashUntil = now + 55;
        vmKick = 1;
        muzzleLight.intensity = 2.2;
        shotSound(player.weapon, 1);
        const kick = w.kick * (player.ads ? 0.5 : 1) * (player.stance === 1 ? 0.75 : 1);
        const k = kick * (0.6 + Math.random() * 0.6);
        player.pitch = clamp(player.pitch + k, -1.5, 1.5);
        player.recoil += k;
        player.yaw += (Math.random() - 0.5) * kick * 0.6;
        player.bloom = Math.min(1, player.bloom + 0.25);
        camera.rotation.set(player.pitch, player.yaw, camera.rotation.z);
        camera.updateMatrixWorld(true);
        muzzlePos.set(0.16, -0.14, -0.9);
        camera.localToWorld(muzzlePos);

        const targets = [];
        for (const a of actors.values()) if (a.alive && (a.sim || a.lastPacket)) targets.push(a.group);
        for (const o of occluders) targets.push(o);
        raycaster.far = 250;
        const moving = player.speedNow > 1;
        const sp = w.spread * (player.ads ? 0.4 : 1) * (moving ? 1.6 : 1) * (player.onGround ? 1 : 2.5) * (player.stance === 1 ? 0.8 : 1) * (1 + player.bloom * 0.6);
        const dmgBy = {};
        const headBy = {};
        for (let p = 0; p < w.pellets; p++) {
            raycaster.setFromCamera({ x: (Math.random() * 2 - 1) * sp, y: (Math.random() * 2 - 1) * sp }, camera);
            const hits = raycaster.intersectObjects(targets, true);
            const end = hits.length ? hits[0].point : raycaster.ray.at(120, new THREE.Vector3());
            if (p < 2) tracer(muzzlePos.x, muzzlePos.y, muzzlePos.z, end.x, end.y, end.z);
            if (!hits.length) continue;
            const h = hits[0];
            let o = h.object;
            let nid = null;
            while (o) { if (o.userData && o.userData.nid) { nid = o.userData.nid; break; } o = o.parent; }
            if (nid) {
                const isHead = Boolean(h.object.userData.head);
                if (isHead) headBy[nid] = true;
                dmgBy[nid] = (dmgBy[nid] || 0) + w.dmg * damageFalloff(w, h.distance) * (isHead ? w.head : 1);
                puff(h.point.x, h.point.y, h.point.z, 0xb3261e);
            } else puff(h.point.x, h.point.y, h.point.z);
        }
        let anyHead = false;
        for (const nid in dmgBy) {
            const target = Number(nid);
            const a = actors.get(target);
            if (a) a.hitUntil = now + 90;
            anyHead ||= Boolean(headBy[nid]);
            deliverHit(player.nid, target, Math.round(dmgBy[nid]), player.weapon, Boolean(headBy[nid]), now);
        }
        if (Object.keys(dmgBy).length) {
            hitmarker(anyHead ? 'head' : '');
            tone(anyHead ? 1500 : 1100, 0.05, 'square', 0.035);
        }
        updateHud();
    }

    /* ---------- Botlar (yalnızca host / tek oyunculu) ---------- */

    function pickBotWeapon() {
        let r = Math.random();
        for (let i = 0; i < WEAPONS.length; i++) { r -= WEAPONS[i].botWeight; if (r <= 0) return i; }
        return 0;
    }

    function setupBots(count, now) {
        const camoIds = Object.keys(CAMO_STYLES);
        for (let i = 0; i < count; i++) {
            const nid = BOT_BASE + i;
            const a = ensureActor(nid);
            const camo = camoIds[Math.floor(Math.random() * camoIds.length)];
            setActorInfo(a, `Bot ${BOT_NAMES[i % BOT_NAMES.length]}`, true, camo);
            a.sim = { hp: 100, alive: false, respawnAt: now + 300 + i * 150 };
            scores.set(nid, { name: a.name, camo, kills: 0, deaths: 0, bot: true });
        }
    }

    function respawnBot(a, now) {
        refreshFighters(); // several bots can respawn in one frame
        const sp = pickSpawn(a.nid);
        const weapon = pickBotWeapon();
        a.sim = {
            hp: 100, alive: true, weapon, ammo: WEAPONS[weapon].mag, reloadEnd: 0, nextShot: 0, burst: randInt(DIFFICULTY[match.diff].burst), pauseUntil: 0,
            target: 0, targetSince: 0, reactAt: 0, lastSeen: null, lastSeenAt: -1e9, perceiveAt: 0,
            path: null, pathI: 0, goalAt: 0, strafe: 1, strafeAt: 0, stuckAt: now + 1200, stuckX: sp.x, stuckZ: sp.z,
            hurtBy: 0, hurtAt: -1e9, respawnAt: 0, shieldUntil: now + SHIELD_MS, velY: 0, crouchUntil: 0
        };
        a.x = sp.x;
        a.z = sp.z;
        a.y = 0;
        a.yaw = sp.yaw;
        a.pitch = 0;
        a.stance = 0;
        a.reloading = false;
        setActorWeapon(a, weapon);
        setAlive(a, true, now);
    }

    function botPerceive(a, s, now) {
        s.perceiveAt = now + rand(150, 260);
        const ey = a.y + 1.55 * STANCE_SCALE[a.stance];
        const fx = -Math.sin(a.yaw);
        const fz = -Math.cos(a.yaw);
        let best = null;
        let bestScore = Infinity;
        for (const f of fighters) {
            if (f.nid === a.nid || !f.alive) continue;
            const dx = f.x - a.x;
            const dz = f.z - a.z;
            const dist = Math.hypot(dx, dz) || 0.01;
            if (dist > 110) continue;
            const hurtByIt = f.nid === s.hurtBy && now - s.hurtAt < 3000;
            const heard = now - f.lastShotAt < 1500 && dist < 45;
            if (!hurtByIt && !heard && dist > 7 && (dx * fx + dz * fz) / dist < 0.25) continue;
            if (inBush(f.x, f.z) && dist > 7) continue;
            const fs = STANCE_SCALE[f.stance] || 1;
            if (segmentBlocked(a.x, ey, a.z, f.x, f.y + 1.1 * fs, f.z) && segmentBlocked(a.x, ey, a.z, f.x, f.y + 1.55 * fs, f.z)) continue;
            let score = dist;
            if (f.nid === s.target) score *= 0.6;
            if (hurtByIt) score *= 0.5;
            if (score < bestScore) { bestScore = score; best = f; }
        }
        if (best) {
            if (s.target !== best.nid) {
                const diff = DIFFICULTY[match.diff];
                s.target = best.nid;
                s.targetSince = now;
                s.reactAt = now + diff.react * 1000 * rand(0.8, 1.25);
                if (Math.random() < (s.weapon === 3 ? 0.7 : 0.25)) s.crouchUntil = now + rand(1000, 3000);
            }
            s.lastSeen = { x: best.x, z: best.z };
            s.lastSeenAt = now;
            s.path = null;
        } else if (s.target) {
            s.target = 0;
            if (s.lastSeen) {
                s.path = findPath(a.x, a.z, s.lastSeen.x, s.lastSeen.z);
                s.pathI = 0;
                s.goalAt = s.path ? now + 6000 : 0;
            }
        } else if (s.hurtBy && now - s.hurtAt < 600) {
            // Görmediği yerden vuruldu: o tarafa dön.
            const f = fighterById(s.hurtBy);
            if (f) a.yaw += angleDiff(a.yaw, Math.atan2(-(f.x - a.x), -(f.z - a.z))) * 0.6;
        }
    }

    function planRoute(a, s, now) {
        for (let tries = 0; tries < 3; tries++) {
            const ang = rand(0, TAU);
            const dist = rand(12, 45);
            const gx = clamp(a.x + Math.cos(ang) * dist, -MAP + 2, MAP - 2);
            const gz = clamp(a.z + Math.sin(ang) * dist, -MAP + 2, MAP - 2);
            const path = findPath(a.x, a.z, gx, gz);
            if (path && path.length) { s.path = path; s.pathI = 0; s.goalAt = now + 25000; return; }
        }
        // A failed search is the expensive case; wait before trying again.
        s.path = null;
        s.goalAt = now + 1000;
    }

    function updateBot(a, dt, now) {
        const s = a.sim;
        if (!s.alive) {
            if (now >= s.respawnAt && inPlay()) respawnBot(a, now);
            return;
        }
        const diff = DIFFICULTY[match.diff];
        const w = WEAPONS[s.weapon];
        const active = inPlay();
        if (active && now >= s.perceiveAt) botPerceive(a, s, now);
        let tgt = active && s.target ? fighterById(s.target) : null;
        if (tgt && !tgt.alive) { s.target = 0; tgt = null; }

        if (s.reloadEnd && now >= s.reloadEnd) { s.ammo = w.mag; s.reloadEnd = 0; }
        if (!s.reloadEnd && (s.ammo <= 0 || (!tgt && s.ammo < w.mag * 0.5))) s.reloadEnd = now + w.reload * 1.1;
        a.reloading = Boolean(s.reloadEnd);

        let mx = 0;
        let mz = 0;
        let speed = 5;
        if (tgt) {
            const dx = tgt.x - a.x;
            const dz = tgt.z - a.z;
            const dist = Math.hypot(dx, dz) || 1;
            const ux = dx / dist;
            const uz = dz / dist;
            const radial = dist > w.botRange * 1.25 ? 1 : dist < w.botRange * 0.6 ? -0.8 : 0;
            if (now > s.strafeAt) {
                s.strafe = Math.random() < 0.2 ? 0 : Math.random() < 0.5 ? -1 : 1;
                s.strafeAt = now + rand(600, 1600);
            }
            mx = ux * radial - uz * s.strafe * 0.85;
            mz = uz * radial + ux * s.strafe * 0.85;
            if (s.weapon === 3 && dist > 20) { mx *= 0.25; mz *= 0.25; }
        } else if (active) {
            if (now > s.goalAt || (s.path && s.pathI >= s.path.length)) planRoute(a, s, now);
            if (s.path && s.pathI < s.path.length) {
                const p = s.path[s.pathI];
                const dx = p.x - a.x;
                const dz = p.z - a.z;
                const d = Math.hypot(dx, dz);
                if (d < 0.7) s.pathI++;
                else { mx = dx / d; mz = dz / d; }
                speed = now - s.lastSeenAt < 6000 ? 6 : 4.6;
            }
        }
        if (a.stance === 1) speed = Math.min(speed, 3.2);
        const ml = Math.hypot(mx, mz);
        if (ml > 0.01) {
            const k = (speed * dt) / Math.max(1, ml);
            const nx = clamp(a.x + mx * k, -MAP + 1.2, MAP - 1.2);
            const nz = clamp(a.z + mz * k, -MAP + 1.2, MAP - 1.2);
            if (!blocked(nx, a.z, a.y)) a.x = nx; else s.strafe = -s.strafe;
            if (!blocked(a.x, nz, a.y)) a.z = nz; else s.strafe = -s.strafe;
        }
        if (now > s.stuckAt) {
            if (ml > 0.1 && Math.hypot(a.x - s.stuckX, a.z - s.stuckZ) < 0.5) { s.path = null; s.goalAt = 0; s.strafe = -s.strafe; }
            s.stuckX = a.x;
            s.stuckZ = a.z;
            s.stuckAt = now + 1200;
        }
        s.velY += GRAVITY * dt;
        a.y += s.velY * dt;
        const gy = groundAt(a.x, a.z, a.y);
        if (a.y <= gy) { a.y = gy; s.velY = 0; }
        a.stance = tgt && now < s.crouchUntil ? 1 : 0;

        // nişan
        let wantYaw = a.yaw;
        let wantPitch = 0;
        const ey = a.y + 1.55 * STANCE_SCALE[a.stance];
        if (tgt) {
            const ty = tgt.y + 1.1 * (STANCE_SCALE[tgt.stance] || 1);
            wantYaw = Math.atan2(-(tgt.x - a.x), -(tgt.z - a.z));
            wantPitch = Math.atan2(ty - ey, Math.hypot(tgt.x - a.x, tgt.z - a.z));
        } else if (ml > 0.1) wantYaw = Math.atan2(-mx, -mz);
        const turn = (tgt ? diff.turn : 4) * dt;
        a.yaw += clamp(angleDiff(a.yaw, wantYaw), -turn, turn);
        a.pitch += clamp(wantPitch - a.pitch, -turn, turn);

        if (tgt && !s.reloadEnd && now >= s.reactAt && now >= s.nextShot && now >= s.pauseUntil) {
            const err = Math.abs(angleDiff(a.yaw, wantYaw)) + Math.abs(wantPitch - a.pitch);
            const settled = s.weapon !== 3 || now - s.targetSince > 700;
            if (err < 0.07 + w.spread * 2 && settled) botFire(a, s, tgt, ey, now, diff);
        }
    }

    function botFire(a, s, tgt, ey, now, diff) {
        const w = WEAPONS[s.weapon];
        s.ammo--;
        a.fireSeq = (a.fireSeq + 1) & 3;
        s.nextShot = now + w.delay * (w.auto ? 1 : rand(1.3, 1.8));
        if (w.auto && --s.burst <= 0) {
            s.burst = randInt(diff.burst);
            s.pauseUntil = now + rand(...diff.pause) * 1000;
        }
        const settle = clamp((now - s.targetSince) / 2500, 0, 1);
        const err = diff.aimErr * (1.4 - settle) + w.spread * diff.spread;
        const ts = STANCE_SCALE[tgt.stance] || 1;
        const aimY = tgt.y + (Math.random() < diff.head ? 1.58 : 1.05) * ts;
        let dx = tgt.x - a.x;
        let dy = aimY - ey;
        let dz = tgt.z - a.z;
        const len = Math.hypot(dx, dy, dz) || 1;
        dx /= len; dy /= len; dz /= len;
        const dmgBy = {};
        const headBy = {};
        let tracerEnd = null;
        for (let p = 0; p < w.pellets; p++) {
            let px = dx + rand(-err, err);
            let py = dy + rand(-err, err);
            let pz = dz + rand(-err, err);
            const pl = Math.hypot(px, py, pz);
            px /= pl; py /= pl; pz /= pl;
            const wall = rayDistance(a.x, ey, a.z, px, py, pz, 250);
            let hit = null;
            for (const f of fighters) {
                if (f.nid === a.nid || !f.alive) continue;
                const hh = hitFighter(f, a.x, ey, a.z, px, py, pz);
                if (hh && hh.t < wall && (!hit || hh.t < hit.t)) hit = { ...hh, nid: f.nid };
            }
            const t = hit ? hit.t : Math.min(wall, 120);
            if (!tracerEnd) tracerEnd = [a.x + px * t, ey + py * t, a.z + pz * t];
            if (hit) {
                dmgBy[hit.nid] = (dmgBy[hit.nid] || 0) + w.dmg * damageFalloff(w, hit.t) * (hit.head ? w.head : 1) * diff.dmg;
                if (hit.head) headBy[hit.nid] = true;
            } else if (wall < 120) puff(a.x + px * wall, ey + py * wall, a.z + pz * wall);
        }
        actorShotFx(a, now, tracerEnd);
        for (const nid in dmgBy) deliverHit(a.nid, Number(nid), Math.round(dmgBy[nid]), s.weapon, Boolean(headBy[nid]), now);
    }

    // Muzzle flash, sound, tracer and radar ping for another combatant's shot.
    function actorShotFx(a, now, end) {
        a.flashUntil = now + 55;
        a.lastShotAt = now;
        const w = Math.max(0, a.weapon);
        const sp = spatial(a.x, a.z);
        shotSound(w, sp.vol, sp.pan);
        const s = STANCE_SCALE[a.stance] || 1;
        const ox = a.x - Math.sin(a.yaw) * 0.6 + Math.cos(a.yaw) * 0.27;
        const oz = a.z - Math.cos(a.yaw) * 0.6 - Math.sin(a.yaw) * 0.27;
        const oy = a.y + 1.2 * s;
        let target = end;
        if (!target) {
            const cp = Math.cos(a.pitch);
            const dx = -Math.sin(a.yaw) * cp;
            const dy = Math.sin(a.pitch);
            const dz = -Math.cos(a.yaw) * cp;
            const t = Math.min(80, rayDistance(ox, oy, oz, dx, dy, dz, 80));
            target = [ox + dx * t, oy + dy * t, oz + dz * t];
        }
        if (sp.dist < 120) tracer(ox, oy, oz, target[0], target[1], target[2]);
    }

    /* ---------- Ağ ---------- */

    let peer = null;
    const conns = [];
    let txBytes = 0;
    let rxBytes = 0;
    let pingMs = 0;
    let joinPending = null;

    function sendTo(c, obj) {
        if (!c || !c.open) return;
        try { c.send(obj); txBytes += JSON.stringify(obj).length; } catch { /* kanal kapanıyor */ }
    }
    function broadcast(obj, except) { for (const c of conns) if (c !== except && c.nid) sendTo(c, obj); }
    function sendEvent(obj) {
        if (match.mode === 'client') sendTo(conns[0], obj);
        else if (match.mode === 'host') broadcast(obj);
    }
    function sendBinary(c, buf) {
        if (!c.open) return;
        try {
            if (c.fast && c.fast.readyState === 'open') c.fast.send(buf);
            else c.send(buf);
            txBytes += buf.byteLength;
        } catch { /* kanal kapanıyor */ }
    }
    function attachFast(c) {
        try {
            const dc = c.peerConnection.createDataChannel('fast', { negotiated: true, id: 7, ordered: false, maxRetransmits: 0 });
            dc.binaryType = 'arraybuffer';
            dc.onmessage = (e) => onBinary(e.data, c);
            c.fast = dc;
        } catch { c.fast = null; }
    }

    // Outgoing position records: own, bots (host) and relayed clients (host).
    const outbox = new Map(); // nid -> { bytes, sentAt, dirty, relay }
    const recBuf = new ArrayBuffer(RECORD);
    const recView = new DataView(recBuf);
    const recBytes = new Uint8Array(recBuf);
    let lastNetTick = 0;

    function writeRecord(nid, x, y, z, yaw, pitch, flags) {
        recView.setUint16(0, nid);
        recView.setInt16(2, clamp(Math.round(x * 100), -32000, 32000));
        recView.setInt16(4, clamp(Math.round(y * 100), -32000, 32000));
        recView.setInt16(6, clamp(Math.round(z * 100), -32000, 32000));
        recView.setUint16(8, Math.round((((yaw % TAU) + TAU) % TAU) / TAU * 65535));
        recView.setInt8(10, clamp(Math.round(pitch / (Math.PI / 2) * 127), -127, 127));
        recView.setUint8(11, flags);
    }
    const flagsOf = (stance, weapon, alive, reloading, fireSeq) => (stance & 3) | ((weapon & 3) << 2) | (alive ? 16 : 0) | (reloading ? 32 : 0) | ((fireSeq & 3) << 6);

    function stage(nid, src, relay) {
        let e = outbox.get(nid);
        if (!e) { e = { bytes: new Uint8Array(RECORD), sentAt: 0, dirty: true, relay }; outbox.set(nid, e); e.bytes.set(src); return; }
        for (let i = 0; i < RECORD; i++) {
            if (e.bytes[i] !== src[i]) { e.bytes.set(src); e.dirty = true; break; }
        }
        if (relay) e.dirty = true;
    }

    function netTick(now) {
        if (!isOnline() || !conns.length || now - lastNetTick < NET_STEP_MS) return;
        lastNetTick = now;
        if (match.phase !== 'menu') {
            writeRecord(player.nid, player.x, player.y, player.z, player.yaw, player.pitch, flagsOf(player.stance, player.weapon, player.alive, player.reloading, player.fireSeq));
            stage(player.nid, recBytes, false);
        }
        if (match.mode === 'host') {
            for (const a of actors.values()) {
                if (!a.sim) continue;
                writeRecord(a.nid, a.x, a.y, a.z, a.yaw, a.pitch, flagsOf(a.stance, Math.max(0, a.weapon), a.alive, a.reloading, a.fireSeq));
                stage(a.nid, recBytes, false);
            }
        }
        const due = [];
        for (const [nid, e] of outbox) if (e.dirty || (!e.relay && now - e.sentAt > 1000)) due.push([nid, e]);
        if (!due.length) return;
        if (match.mode === 'client') {
            const own = due.find(([nid]) => nid === player.nid);
            if (own) sendBinary(conns[0], packRecords([own]));
        } else {
            for (const c of conns) {
                if (!c.nid) continue;
                const list = due.filter(([nid]) => nid !== c.nid);
                if (list.length) sendBinary(c, packRecords(list));
            }
        }
        for (const [, e] of due) { e.dirty = false; e.sentAt = now; }
    }

    function packRecords(list) {
        const out = new Uint8Array(1 + list.length * RECORD);
        out[0] = 1;
        list.forEach(([, e], i) => out.set(e.bytes, 1 + i * RECORD));
        return out.buffer;
    }

    function onBinary(data, conn) {
        let ab = data;
        if (!(ab instanceof ArrayBuffer)) {
            if (ab && ab.buffer) ab = ab.buffer.slice(ab.byteOffset, ab.byteOffset + ab.byteLength);
            else return;
        }
        rxBytes += ab.byteLength;
        if (ab.byteLength < 1 + RECORD || (ab.byteLength - 1) % RECORD) return;
        const dv = new DataView(ab);
        if (dv.getUint8(0) !== 1) return;
        const now = performance.now();
        for (let off = 1; off < ab.byteLength; off += RECORD) {
            const nid = dv.getUint16(off);
            if (match.mode === 'host') {
                // Bir istemci yalnızca kendi konumunu bildirebilir.
                if (!conn.nid || nid !== conn.nid) continue;
                stage(nid, new Uint8Array(ab, off, RECORD), true);
            }
            applyRecord(dv, off, now);
        }
    }

    function applyRecord(dv, off, now) {
        const nid = dv.getUint16(off);
        if (nid === player.nid || match.phase === 'menu') return;
        const a = ensureActor(nid);
        if (a.sim) return;
        const x = dv.getInt16(off + 2) / 100;
        const y = dv.getInt16(off + 4) / 100;
        const z = dv.getInt16(off + 6) / 100;
        const yaw = dv.getUint16(off + 8) / 65535 * TAU;
        const pitch = dv.getInt8(off + 10) / 127 * (Math.PI / 2);
        const fl = dv.getUint8(off + 11);
        let alive = Boolean(fl & 16);
        if (alive && now < a.deadLock) alive = false;
        setAlive(a, alive, now);
        const last = a.buf[a.buf.length - 1];
        if (last && Math.hypot(x - last.x, z - last.z) > 6) a.buf.length = 0;
        else if (last && now - last.t > 200) a.buf.push({ ...last, t: now - NET_STEP_MS });
        a.buf.push({ t: now, x, y, z, yaw, pitch });
        if (a.buf.length > 12) a.buf.splice(0, a.buf.length - 12);
        a.stance = fl & 3;
        a.reloading = Boolean(fl & 32);
        setActorWeapon(a, (fl >> 2) & 3);
        const seq = (fl >> 6) & 3;
        const first = !a.lastPacket;
        a.lastPacket = now;
        if (!first && seq !== a.fireSeq && alive) actorShotFx(a, now, null);
        a.fireSeq = seq;
        if (first) { a.x = x; a.y = y; a.z = z; a.yaw = yaw; a.pitch = pitch; }
    }

    const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
    const vec3 = (v) => (Array.isArray(v) && v.length === 3 && v.every((n) => Number.isFinite(num(n))) ? v.map((n) => clamp(n, -200, 200)) : null);

    function snapshot() {
        return {
            t: 's',
            p: [...scores].map(([nid, s]) => [nid, s.name, s.camo, s.kills, s.deaths, s.bot ? 1 : 0]),
            e: Math.max(0, Math.round(match.remaining)),
            kl: match.killLimit,
            ph: match.phase === 'end' ? 1 : 0
        };
    }

    function applySnapshot(d) {
        if (!Array.isArray(d.p)) return;
        const seen = new Set([player.nid]);
        for (const row of d.p) {
            if (!Array.isArray(row)) continue;
            const nid = Math.floor(num(row[0]));
            if (!(nid > 0 && nid < 65536)) continue;
            seen.add(nid);
            const entry = { name: cleanName(row[1]), camo: CAMO_STYLES[row[2]] ? row[2] : 'standard', kills: Math.max(0, num(row[3]) || 0), deaths: Math.max(0, Math.floor(num(row[4]) || 0)), bot: Boolean(row[5]) };
            if (nid === player.nid) {
                const mine = scores.get(nid);
                if (mine) { mine.kills = entry.kills; mine.deaths = entry.deaths; }
                continue;
            }
            scores.set(nid, entry);
            setActorInfo(ensureActor(nid), entry.name, entry.bot, entry.camo);
        }
        for (const nid of [...scores.keys()]) if (!seen.has(nid)) { scores.delete(nid); removeActor(nid); }
        for (const nid of [...actors.keys()]) if (!seen.has(nid)) removeActor(nid);
        if (Number.isFinite(num(d.e))) match.remaining = clamp(d.e, 0, 3600000);
        if (KILL_CHOICES.includes(d.kl)) match.killLimit = d.kl;
        updateMatchHud(true);
    }

    function onEvent(d, conn) {
        const now = performance.now();
        const host = match.mode === 'host';
        const fromClient = host && conn.nid;
        switch (d.t) {
            case 'hi': {
                if (!host) return;
                if (d.v !== PROTO) { sendTo(conn, { t: 'err', m: 'Sürümler farklı. İki taraf da sayfayı yenilesin.' }); window.setTimeout(() => conn.close(), 300); return; }
                const nid = Math.floor(num(d.n));
                const humans = conns.filter((c) => c.nid).length + 1;
                if (!(nid > 0 && nid < BOT_BASE) || scores.has(nid)) { sendTo(conn, { t: 'err', m: 'Kimlik çakıştı, yeniden katıl.' }); window.setTimeout(() => conn.close(), 300); return; }
                if (humans >= MAX_HUMANS) { sendTo(conn, { t: 'err', m: `Oda dolu (en fazla ${MAX_HUMANS} oyuncu).` }); window.setTimeout(() => conn.close(), 300); return; }
                conn.nid = nid;
                const camo = CAMO_STYLES[d.c] ? d.c : 'standard';
                const name = cleanName(d.nm);
                scores.set(nid, { name, camo, kills: 0, deaths: 0, bot: false });
                setActorInfo(ensureActor(nid), name, false, camo);
                broadcast(snapshot());
                feed([name, ' arenaya katıldı']);
                tone(660, 0.12, 'triangle', 0.05, 220);
                return;
            }
            case 's':
                if (host) return;
                if (joinPending) { const pending = joinPending; joinPending = null; startMatch('client', d, pending); return; }
                applySnapshot(d);
                return;
            case 'h': {
                const to = Math.floor(num(d.to));
                const f = Math.floor(num(d.f));
                const dmg = clamp(num(d.d) || 0, 0, 250);
                const w = clamp(Math.floor(num(d.w)) || 0, 0, NADE_WEAPON);
                if (!dmg) return;
                if (host && f !== conn.nid) return;
                if (to === player.nid) { const fr = fighterById(f); takeDamage(dmg, f, w, Boolean(d.hs), now, fr?.x, fr?.z); return; }
                if (!host) return;
                const a = actors.get(to);
                if (a && a.sim) botDamage(a, dmg, f, w, Boolean(d.hs), now);
                else sendTo(conns.find((c) => c.nid === to), { t: 'h', f, to, d: dmg, w, hs: d.hs ? 1 : 0 });
                return;
            }
            case 'k': {
                const k = Math.floor(num(d.k));
                const v = Math.floor(num(d.v));
                if (host && v !== conn.nid) return;
                if (v === player.nid) return;
                if (fromClient) broadcast(d, conn);
                applyKill(k, v, clamp(Math.floor(num(d.w)) || 0, 0, NADE_WEAPON), Boolean(d.hs), now);
                return;
            }
            case 'g': {
                const p = vec3(d.p);
                const v = vec3(d.v);
                const f = Math.floor(num(d.f));
                if (!p || !v || (host && f !== conn.nid) || f === player.nid) return;
                if (fromClient) broadcast(d, conn);
                spawnGrenade(Math.floor(num(d.id)), f, p, v, false);
                return;
            }
            case 'x': {
                const p = vec3(d.p);
                const f = Math.floor(num(d.f));
                if (!p || (host && f !== conn.nid) || f === player.nid) return;
                if (fromClient) broadcast(d, conn);
                removeGrenade(Math.floor(num(d.id)));
                explodeAt(p[0], p[1], p[2], f, now);
                return;
            }
            case 'e':
                if (!host && inPlay()) finishMatch();
                return;
            case 'r':
                if (!host) beginRound(now);
                return;
            case 'b': {
                if (host) return;
                const n = Math.floor(num(d.n));
                const name = scores.get(n)?.name;
                scores.delete(n);
                removeActor(n);
                if (name) feed([name, ' ayrıldı']);
                updateMatchHud(true);
                return;
            }
            case 'p':
                if (host) sendTo(conn, { t: 'q', s: d.s });
                return;
            case 'q':
                if (!host && Number.isFinite(num(d.s))) pingMs = Math.round(now - d.s);
                return;
            case 'err':
                if (host) return;
                leaveMatch(String(d.m || '').replace(/[\u0000-\u001f\u007f-\u009f<>]/g, '').slice(0, 120) || 'Bağlantı reddedildi.');
                return;
            default:
        }
    }

    function setupConn(c) {
        c.on('data', (d) => {
            if (d instanceof ArrayBuffer || ArrayBuffer.isView(d)) { onBinary(d, c); return; }
            if (d && typeof d === 'object' && typeof d.t === 'string') {
                try { rxBytes += JSON.stringify(d).length; } catch { /* ignore */ }
                onEvent(d, c);
            }
        });
        const gone = () => {
            const i = conns.indexOf(c);
            if (i < 0) return;
            conns.splice(i, 1);
            if (match.mode === 'host') {
                if (c.nid) {
                    const name = scores.get(c.nid)?.name || 'Bir oyuncu';
                    scores.delete(c.nid);
                    removeActor(c.nid);
                    outbox.delete(c.nid);
                    broadcast({ t: 'b', n: c.nid });
                    broadcast(snapshot());
                    feed([name, ' ayrıldı']);
                    updateMatchHud(true);
                }
            } else if (match.mode === 'client' && match.phase !== 'menu') {
                leaveMatch('Host ile bağlantı koptu.');
            }
        };
        c.on('close', gone);
        c.on('error', gone);
    }

    function peerOptions(config) {
        const opts = { config, debug: 1 };
        // ?signal=sunucu:port ile kendi PeerJS sinyal sunucunu kullanabilirsin.
        const signal = new URLSearchParams(location.search).get('signal');
        const m = signal && signal.match(/^([\w.-]+):(\d{2,5})$/);
        if (m) Object.assign(opts, { host: m[1], port: Number(m[2]), path: '/', secure: location.protocol === 'https:' });
        return opts;
    }

    function iceConfig() {
        const base = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
        const text = $('turn-json').value.trim();
        if (!text) return { iceServers: base };
        try {
            let list = JSON.parse(text);
            if (list && !Array.isArray(list) && Array.isArray(list.iceServers)) list = list.iceServers;
            const clean = Array.isArray(list) ? list.filter((s) => s && (typeof s.urls === 'string' || Array.isArray(s.urls))) : [];
            if (!clean.length) throw new Error('liste boş');
            const hasStun = clean.some((s) => [].concat(s.urls).some((u) => String(u).startsWith('stun:')));
            return { iceServers: hasStun ? clean : [base[0], ...clean] };
        } catch (error) {
            setStatus(`TURN listesi okunamadı (${error.message}); varsayılan sunucular kullanılıyor.`, 'err');
            return { iceServers: base };
        }
    }

    function closePeer() {
        conns.splice(0).forEach((c) => { try { c.close(); } catch { /* ignore */ } });
        if (peer) { try { peer.destroy(); } catch { /* ignore */ } }
        peer = null;
        outbox.clear();
        joinPending = null;
        roomCode = '';
        pingMs = 0;
    }

    function hostRoom() {
        if (!window.Peer) { setStatus('Bağlantı kütüphanesi yüklenemedi; sayfayı yenile.', 'err'); return; }
        closePeer();
        $('host-btn').disabled = true;
        setStatus('Oda oluşturuluyor…');
        tryCreateRoom(0);
    }

    function tryCreateRoom(attempt) {
        if (attempt > 6) { setStatus('Oda kodu alınamadı, tekrar dene.', 'err'); $('host-btn').disabled = false; return; }
        const code = String(Math.floor(100000 + Math.random() * 900000));
        const p = new Peer(ROOM_PREFIX + code, peerOptions(iceConfig()));
        let opened = false;
        const timer = window.setTimeout(() => {
            if (opened) return;
            p.destroy();
            setStatus('Sinyal sunucusuna ulaşılamadı. İnternetini kontrol edip tekrar dene.', 'err');
            $('host-btn').disabled = false;
        }, 15000);
        p.on('open', () => {
            opened = true;
            window.clearTimeout(timer);
            peer = p;
            roomCode = code;
            $('host-btn').disabled = false;
            startMatch('host');
            toast(`Oda ${code} hazır. Kodu Esc menüsünden kopyalayabilirsin.`);
        });
        p.on('connection', (c) => {
            setupConn(c);
            c.on('open', () => { conns.push(c); attachFast(c); });
        });
        p.on('disconnected', () => {
            if (peer === p && !p.destroyed) window.setTimeout(() => { try { if (!p.destroyed) p.reconnect(); } catch { /* ignore */ } }, 1500);
        });
        p.on('error', (err) => {
            if (!opened && err.type === 'unavailable-id') { window.clearTimeout(timer); p.destroy(); tryCreateRoom(attempt + 1); return; }
            if (!opened) {
                window.clearTimeout(timer);
                p.destroy();
                setStatus(`Sunucu hatası: ${err.type}. İnternetini kontrol et.`, 'err');
                $('host-btn').disabled = false;
                return;
            }
            if (peer === p && err.type !== 'peer-unavailable') toast(`Sinyal sunucusu: ${err.type}. Yeni oyuncular katılamayabilir.`);
        });
    }

    function joinRoom() {
        const code = $('join-input').value.trim();
        if (!/^\d{6}$/.test(code)) { setStatus('6 haneli sayısal kod gir.', 'err'); return; }
        if (!window.Peer) { setStatus('Bağlantı kütüphanesi yüklenemedi; sayfayı yenile.', 'err'); return; }
        closePeer();
        player.nid = newNid();
        const btn = $('join-btn');
        btn.disabled = true;
        setStatus('Odaya bağlanılıyor…');
        const p = new Peer(undefined, peerOptions(iceConfig()));
        peer = p;
        let done = false;
        let stageText = 'Sinyal sunucusuna bağlanılıyor';
        const fail = (message) => {
            if (done) return;
            done = true;
            btn.disabled = false;
            setStatus(message, 'err');
            if (peer === p) closePeer();
        };
        const timer = window.setTimeout(() => fail(`Zaman aşımı. Takıldığı aşama: "${stageText}". Doğrudan bağlantı kurulamıyorsa Gelişmiş bağlantıya TURN listesi ekle.`), 30000);
        p.on('disconnected', () => { if (!p.destroyed && match.phase !== 'menu') window.setTimeout(() => { try { if (!p.destroyed) p.reconnect(); } catch { /* ignore */ } }, 1500); });
        p.on('open', () => {
            stageText = 'Host yanıtı bekleniyor';
            setStatus(`${stageText}…`);
            const c = p.connect(ROOM_PREFIX + code, { reliable: true });
            const watch = window.setInterval(() => {
                const pc = c.peerConnection;
                if (!pc || done) { if (done) window.clearInterval(watch); return; }
                stageText = `Ağ bağlantısı kuruluyor (ICE: ${pc.iceConnectionState})`;
                setStatus(`${stageText}…`);
                if (pc.iceConnectionState === 'failed') { window.clearInterval(watch); fail('Ağ bağlantısı kurulamadı (ICE failed). Gelişmiş bağlantıya TURN listesi eklemeyi dene.'); }
            }, 500);
            setupConn(c);
            c.on('open', () => {
                done = true;
                window.clearTimeout(timer);
                window.clearInterval(watch);
                btn.disabled = false;
                conns.push(c);
                attachFast(c);
                match.mode = 'client';
                joinPending = code;
                sendTo(c, { t: 'hi', n: player.nid, nm: myName(), c: myCamo(), v: PROTO });
                setStatus('Bağlandı, maç bilgisi bekleniyor…', 'ok');
                window.setTimeout(() => {
                    if (joinPending !== code) return;
                    closePeer();
                    match.mode = 'solo';
                    setStatus('Host yanıt vermedi. Kodu kontrol edip tekrar dene.', 'err');
                }, 10000);
            });
        });
        p.on('error', (err) => {
            window.clearTimeout(timer);
            if (err.type === 'peer-unavailable') fail('Bu kodla açık bir oda yok. Kodu ve host sayfasının açık olduğunu kontrol et.');
            else if (match.phase === 'menu') fail(`Bağlantı hatası: ${err.type}`);
        });
    }

    window.setInterval(() => {
        const el = $('netstats');
        if (!isOnline() || match.phase === 'menu') { el.textContent = ''; txBytes = 0; rxBytes = 0; return; }
        const players = [...scores.values()].filter((s) => !s.bot).length;
        el.textContent = `↑ ${(txBytes / 1024).toFixed(2)} KB/s ↓ ${(rxBytes / 1024).toFixed(2)} KB/s\n${match.mode === 'host' ? 'host' : `ping ${pingMs} ms`} · ${players} oyuncu`;
        txBytes = 0;
        rxBytes = 0;
    }, 1000);
    window.setInterval(() => {
        if (match.mode === 'client' && conns[0] && conns[0].open) sendTo(conns[0], { t: 'p', s: performance.now() });
    }, 2000);
    window.addEventListener('beforeunload', () => { if (isOnline()) sendEvent({ t: 'b', n: player.nid }); });

    /* ---------- Maç akışı ---------- */

    function startMatch(mode, snap, code) {
        const now = performance.now();
        match.mode = mode;
        clearActors();
        clearGrenades();
        clearEffects();
        scores.clear();
        outbox.clear();
        scores.set(player.nid, { name: myName(), camo: myCamo(), kills: 0, deaths: 0, bot: false });
        if (mode === 'client') {
            roomCode = code || '';
            applySnapshot(snap);
            match.killLimit = KILL_CHOICES.includes(snap.kl) ? snap.kl : 20;
        } else {
            const o = prefs[mode === 'solo' ? 'solo' : 'host'];
            match.killLimit = o.kills;
            match.timeMs = o.time * 60000;
            match.remaining = match.timeMs;
            match.diff = o.diff;
            setupBots(o.bots, now);
        }
        buildViewmodels(myCamo());
        $('killfeed').replaceChildren();
        match.syncAt = now + SNAPSHOT_MS;
        enterGame();
        if (mode === 'client' && snap.ph === 1) {
            match.phase = 'end';
            match.rewarded = true;
            player.alive = false;
            showOver(true);
            return;
        }
        beginRound(now, true);
    }

    function beginRound(now, fresh) {
        if (!fresh) for (const s of scores.values()) { s.kills = 0; s.deaths = 0; }
        match.phase = 'play';
        match.paused = false;
        match.rewarded = false;
        match.autoRestartAt = 0;
        if (isAuthority()) {
            match.remaining = match.timeMs;
            for (const a of actors.values()) if (a.sim) { a.sim.alive = false; a.sim.respawnAt = now + 200; setAlive(a, false, now); a.group.visible = false; }
        }
        player.streak = 0;
        player.weapon = 0;
        respawnPlayer(now);
        $('over').classList.add('hidden');
        $('pause').classList.add('hidden');
        $('settings').classList.add('hidden');
        if (!fresh) $('killfeed').replaceChildren();
        updateMatchHud(true);
        lockPointer();
        updateClickHint();
    }

    function restartMatch() {
        if (!isAuthority()) return;
        const now = performance.now();
        beginRound(now, false);
        if (match.mode === 'host') { broadcast({ t: 'r' }); broadcast(snapshot()); }
    }

    function endMatch() {
        if (!inPlay()) return;
        const now = performance.now();
        if (match.mode === 'host') {
            broadcast(snapshot());
            broadcast({ t: 'e' });
            match.autoRestartAt = conns.some((c) => c.nid) ? now + AUTO_RESTART_MS : 0;
        }
        finishMatch();
    }

    function standings() {
        return [...scores].map(([nid, s]) => ({ nid, ...s, kills: Math.floor(s.kills) })).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    }

    function finishMatch() {
        match.phase = 'end';
        match.paused = false;
        mouseDown = false;
        touch.fire = false;
        player.ads = false;
        $('death').classList.add('hidden');
        showScoreboard(false);
        showOver(false);
    }

    function showOver(spectating) {
        unlockPointer();
        const list = standings();
        const mine = scores.get(player.nid) || { kills: 0, deaths: 0 };
        const kills = Math.floor(mine.kills);
        const rank = list.findIndex((s) => s.nid === player.nid) + 1;
        const top = list[0]?.kills || 0;
        const won = kills > 0 && kills >= top;
        const cheating = cheatOn('active');
        let reward = 0;
        let note = '';
        let best = Number(getCookieValue(BEST_COOKIE)) || 0;
        if (!match.rewarded && !spectating) {
            match.rewarded = true;
            if (!cheating && kills > best) { best = kills; setCookieValue(BEST_COOKIE, String(best)); note = 'Yeni rekor! '; }
            if (cheating) note += 'Hile açık · skor ve CM kaydedilmedi.';
            else if (!CasualProfile.current()) note += 'Oturum kapalı · CM kazanmak için menüden oturumu başlat.';
            else {
                reward = CasualProfile.awardArenaMatch({ kills, won }).reward;
                if (!reward) note += 'CM için en az bir rakibi etkisiz hâle getir.';
                else if (CasualProfile.arenaRewardForMatch({ kills, won }) >= CasualProfile.ARENA_REWARD_CAP) note += 'Maç başına ödül sınırına ulaştın.';
                else note += 'Kazanç profiline eklendi.';
            }
            if (typeof recordGameResult === 'function') recordGameResult('Arena FPS', { won, score: kills });
        }
        if (spectating) note = 'Maç bitmişken katıldın; host yeni maçı başlatınca oyuna gireceksin.';
        else if (match.mode === 'client') note += ' Yeni maçı host başlatır.';
        else if (match.autoRestartAt) note += ' Yeni maç 25 saniye içinde kendiliğinden başlar.';
        $('over-title').textContent = spectating ? 'Maç arası' : won ? 'Birincisin!' : `${rank}. oldun`;
        $('over-kills').textContent = String(kills);
        $('over-deaths').textContent = String(mine.deaths);
        $('over-best').textContent = String(best);
        const canEarn = !cheating && Boolean(CasualProfile.current()) && !spectating;
        $('over-reward').textContent = canEarn ? `+${CasualProfile.formatMoney(reward)} CM` : '—';
        $('over-note').textContent = note.trim();
        renderRows($('over-rows'), list);
        const again = $('again-btn');
        again.disabled = match.mode === 'client';
        again.textContent = match.mode === 'client' ? 'Host bekleniyor' : 'Yeni maç';
        $('over').classList.remove('hidden');
        renderCamos();
    }

    function leaveMatch(reason) {
        if (isOnline()) { try { sendEvent({ t: 'b', n: player.nid }); } catch { /* ignore */ } }
        closePeer();
        clearActors();
        clearGrenades();
        clearEffects();
        scores.clear();
        match.phase = 'menu';
        match.mode = 'solo';
        match.paused = false;
        player.alive = false;
        unlockPointer();
        showMenu();
        if (reason) { setStatus(reason, 'err'); toast(reason); }
    }

    /* ---------- HUD ---------- */

    let toastTimer = 0;
    let scoreboardOpen = false;
    let hudState = '';

    // Per-frame HUD writes only touch the DOM when the value changes.
    function setText(id, text) {
        const e = $(id);
        if (e.textContent !== text) e.textContent = text;
    }
    function setStyle(id, prop, value) {
        const e = $(id);
        if (e.style.getPropertyValue(prop) !== value) e.style.setProperty(prop, value);
    }

    function toast(message) {
        const el = $('toast');
        el.textContent = message;
        el.classList.add('show');
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => el.classList.remove('show'), 2800);
    }

    function setStatus(message, kind = '') {
        const el = $('status-line');
        el.textContent = message;
        el.className = `status${kind ? ` ${kind}` : ''}`;
    }

    function feed(parts, cls) {
        const d = document.createElement('div');
        if (cls) d.className = cls;
        for (const p of parts) {
            if (!p) continue;
            if (typeof p === 'string') d.append(p);
            else { const s = document.createElement('span'); s.className = p.cls; s.textContent = p.text; d.append(s); }
        }
        const box = $('killfeed');
        box.prepend(d);
        while (box.children.length > 5) box.lastChild.remove();
        window.setTimeout(() => d.remove(), 6000);
    }

    function banner(text, sub) {
        const box = $('banner');
        box.replaceChildren();
        const d = document.createElement('div');
        d.textContent = text;
        if (sub) { const s = document.createElement('small'); s.textContent = sub; d.append(s); }
        box.append(d);
    }

    function hitmarker(kind) {
        const h = $('hitmarker');
        h.className = kind;
        h.style.opacity = '1';
        window.clearTimeout(hitmarker.timer);
        hitmarker.timer = window.setTimeout(() => { h.style.opacity = '0'; }, kind === 'kill' ? 260 : 120);
    }

    (function buildSlots() {
        const box = $('wslots');
        WEAPONS.forEach((w, i) => {
            const d = document.createElement('div');
            d.className = 'slot';
            d.textContent = `${i + 1} ${w.name}`;
            box.append(d);
        });
    })();

    function updateHud() {
        const w = WEAPONS[player.weapon];
        const hp = Math.ceil(player.hp);
        const ammo = player.ammo[player.weapon];
        const state = [hp, player.weapon, ammo, player.reloading, player.nades].join('|');
        if (state === hudState) return;
        hudState = state;
        $('hp-val').textContent = String(hp);
        const fill = $('hpfill');
        fill.style.width = `${hp}%`;
        fill.classList.toggle('ok', hp > 50);
        $('wname').textContent = w.name + (player.reloading ? ' · şarjör değişiyor' : '');
        const ammoEl = $('wammo');
        ammoEl.textContent = `${ammo} / ${w.mag}`;
        ammoEl.classList.toggle('low', ammo <= Math.ceil(w.mag * 0.25));
        $('nade-count').textContent = String(player.nades);
        document.querySelectorAll('.slot').forEach((s, i) => s.classList.toggle('on', i === player.weapon));
    }

    let matchHudAt = 0;
    function updateMatchHud(force) {
        const now = performance.now();
        if (!force && now - matchHudAt < 250) return;
        matchHudAt = now;
        const sec = Math.max(0, Math.ceil(match.remaining / 1000));
        setText('timer', `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);
        $('match-pill').classList.toggle('urgent', sec <= 30 && inPlay());
        const mine = Math.floor(scores.get(player.nid)?.kills || 0);
        let leader = null;
        for (const [nid, s] of scores) if (nid !== player.nid && (!leader || s.kills > leader.kills)) leader = s;
        const lk = Math.floor(leader?.kills || 0);
        setText('lead-line', !leader || mine > lk ? `Liderdesin ${mine} / ${match.killLimit}` : `Sen ${mine} · Lider ${lk} / ${match.killLimit}`);
        setText('roomtag', isOnline() && roomCode ? `Oda ${roomCode}` : '');
        if (scoreboardOpen) renderScoreboard();
    }

    function renderRows(tbody, list) {
        tbody.replaceChildren();
        list.forEach((s, i) => {
            const tr = document.createElement('tr');
            if (s.nid === player.nid) tr.className = 'me';
            const cells = [String(i + 1), null, String(s.kills), String(s.deaths)];
            cells.forEach((text, c) => {
                const td = document.createElement('td');
                if (c === 1) {
                    td.textContent = s.nid === player.nid ? `${s.name} (sen)` : s.name;
                    if (s.bot) { const tag = document.createElement('span'); tag.className = 'bot-tag'; tag.textContent = 'BOT'; td.append(tag); }
                } else td.textContent = text;
                tr.append(td);
            });
            tbody.append(tr);
        });
    }

    function renderScoreboard() { renderRows($('score-rows'), standings()); }

    function showScoreboard(open) {
        scoreboardOpen = open;
        $('scoreboard').classList.toggle('hidden', !open);
        if (open) renderScoreboard();
    }

    function updateCrosshair() {
        const w = WEAPONS[player.weapon];
        const moving = player.speedNow > 1 ? 1.6 : 1;
        const air = player.onGround ? 1 : 2.5;
        const spread = w.spread * (player.ads ? 0.4 : 1) * moving * air * (1 + player.bloom * 0.6);
        setStyle('crosshair', '--gap', `${Math.round(4 + spread * 420 + (w.pellets > 1 ? 4 : 0))}px`);
    }

    /* ---------- Radar ---------- */

    const MINI_PX = 4;
    const miniBase = document.createElement('canvas');
    miniBase.width = miniBase.height = MAP * 2 * MINI_PX;
    (function drawMiniBase() {
        const g = miniBase.getContext('2d');
        const P = MINI_PX;
        g.fillStyle = '#2f4a2a';
        g.fillRect(0, 0, miniBase.width, miniBase.height);
        g.fillStyle = '#5a5850';
        g.fillRect(0, (MAP - 3) * P, MAP * 2 * P, 6 * P);
        g.fillRect((MAP - 2.5) * P, 0, 5 * P, MAP * 2 * P);
        g.fillStyle = '#244a2a';
        for (const [x, z] of treeSpots) { g.beginPath(); g.arc((x + MAP) * P, (z + MAP) * P, 1.6 * P, 0, TAU); g.fill(); }
        for (const s of solids) {
            if (s.y0 > 2.2 || s.tree) continue;
            g.fillStyle = s.y1 > 2.4 ? '#c9d1d6' : '#a8916a';
            g.fillRect((s.x0 + MAP) * P, (s.z0 + MAP) * P, Math.max(1, (s.x1 - s.x0) * P), Math.max(1, (s.z1 - s.z0) * P));
        }
    })();
    let miniAt = 0;
    function drawMinimap(now) {
        if (now - miniAt < 90) return;
        miniAt = now;
        const c = $('minimap');
        const g = c.getContext('2d');
        const S = c.width;
        const half = S / 2;
        const k = half / 42; // px per metre
        g.clearRect(0, 0, S, S);
        g.save();
        g.beginPath();
        g.arc(half, half, half - 1, 0, TAU);
        g.clip();
        g.translate(half, half);
        g.rotate(player.yaw);
        g.scale(k / MINI_PX, k / MINI_PX);
        g.translate(-(player.x + MAP) * MINI_PX, -(player.z + MAP) * MINI_PX);
        g.globalAlpha = 0.85;
        g.drawImage(miniBase, 0, 0);
        g.globalAlpha = 1;
        const dot = (4 * MINI_PX) / k;
        for (const a of actors.values()) {
            if (!a.alive || now - a.lastShotAt > 2000) continue;
            g.fillStyle = '#ff5a48';
            g.beginPath();
            g.arc((a.x + MAP) * MINI_PX, (a.z + MAP) * MINI_PX, dot, 0, TAU);
            g.fill();
        }
        g.restore();
        g.fillStyle = '#8cf0a4';
        g.beginPath();
        g.moveTo(half, half - 8);
        g.lineTo(half - 6, half + 6);
        g.lineTo(half + 6, half + 6);
        g.closePath();
        g.fill();
    }

    /* ---------- Menü, mağaza, ayarlar ---------- */

    function el(tag, cls, text) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text !== undefined) e.textContent = text;
        return e;
    }

    function segmented(label, choices, current, onPick) {
        const seg = el('div', 'segmented');
        seg.setAttribute('role', 'radiogroup');
        seg.setAttribute('aria-label', label);
        for (const [value, text] of choices) {
            const b = el('button', '', text);
            b.type = 'button';
            b.setAttribute('role', 'radio');
            b.setAttribute('aria-checked', String(value === current));
            b.addEventListener('click', () => onPick(value));
            seg.append(b);
        }
        return seg;
    }

    function renderOptions() {
        document.querySelectorAll('.match-options').forEach((box) => {
            const scope = box.dataset.scope;
            const o = prefs[scope];
            box.replaceChildren();
            const groups = [
                ['bots', 'Bot sayısı', (scope === 'solo' ? SOLO_BOTS : HOST_BOTS).map((n) => [n, String(n)])],
                ['diff', 'Bot zorluğu', Object.entries(DIFFICULTY).map(([id, d]) => [id, d.label])],
                ['time', 'Süre', TIME_CHOICES.map((n) => [n, `${n} dk`])],
                ['kills', 'Öldürme hedefi', KILL_CHOICES.map((n) => [n, String(n)])]
            ];
            for (const [key, label, choices] of groups) {
                const wrap = el('div', 'opt');
                wrap.append(el('div', 'field-label', label), segmented(label, choices, o[key], (value) => {
                    o[key] = value;
                    savePrefs();
                    renderOptions();
                }));
                box.append(wrap);
            }
        });
    }

    function renderSession(profile) {
        const line = $('session-line');
        line.replaceChildren();
        const text = el('span');
        if (cheatOn('active')) {
            text.textContent = 'Hile açık · CM kazanımı ve satın alma duraklatıldı.';
            line.append(text);
            return;
        }
        if (profile) {
            text.textContent = `@${profile.displayName} · ${CasualProfile.formatMoney(profile.balance)} CM`;
            line.append(text);
            return;
        }
        text.textContent = 'Oturum kapalı · CM ve kaplamalar için başlat.';
        const button = el('button', '', 'Oturumu başlat');
        button.type = 'button';
        button.addEventListener('click', () => {
            const result = CasualProfile.startSession();
            toast(result.granted ? `Oturum açıldı, +${result.reward} CM kazandın.` : 'Oturumun açık.');
        });
        line.append(text, button);
    }

    function renderCamos() {
        const profile = CasualProfile.current();
        const owned = ownedCamos(profile);
        const selected = myCamo();
        const balance = profile?.balance || 0;
        const grid = $('camo-grid');
        grid.replaceChildren();
        const allOpen = cheatOn('features');
        Object.values(CasualProfile.camos).forEach((camo) => {
            const isOwned = owned.includes(camo.id);
            const card = el('article', `camo-card${camo.id === selected ? ' active' : ''}${isOwned ? '' : ' locked'}${!isOwned && balance < camo.price ? ' poor' : ''}`);
            const swatch = el('span', 'camo-swatch');
            swatch.style.setProperty('--swatch', CAMO_STYLES[camo.id]?.swatch || '#555');
            const button = el('button');
            button.type = 'button';
            if (camo.id === selected) {
                button.textContent = 'Seçili';
                button.disabled = true;
            } else if (isOwned) {
                button.textContent = allOpen ? 'Önizle' : 'Seç';
                button.setAttribute('aria-label', `${camo.name} kaplamasını seç`);
                button.addEventListener('click', () => chooseCamo(camo));
            } else {
                button.textContent = `${CasualProfile.formatMoney(camo.price)} CM`;
                button.setAttribute('aria-label', `${camo.name} kaplamasını ${CasualProfile.formatMoney(camo.price)} CasualMoney karşılığında aç`);
                button.addEventListener('click', () => purchaseCamo(camo));
            }
            card.append(swatch, el('strong', '', camo.name), el('small', '', camo.description), button);
            grid.append(card);
        });
        $('camo-count').textContent = `${owned.length} / ${Object.keys(CasualProfile.camos).length}`;
        renderSession(profile);
        if (match.phase === 'menu') buildViewmodels(selected);
    }

    function chooseCamo(camo) {
        if (cheatOn('features')) {
            previewCamo = camo.id;
            toast(`${camo.name} önizlemesi · kaydedilmez.`);
            renderCamos();
            return;
        }
        try {
            CasualProfile.selectCamo(camo.id);
            toast(`${camo.name} kaplaması seçildi.`);
        } catch (error) { toast(error.message); }
    }

    function purchaseCamo(camo) {
        if (!CasualProfile.current()) { toast('Kaplama almak için önce oturumu başlat.'); return; }
        try {
            CasualProfile.buyCamo(camo.id);
            tone(660, 0.18, 'triangle', 0.06, 440);
            toast(`${camo.name} kaplaması açıldı ve seçildi.`);
        } catch (error) { toast(error.message); }
    }

    function showMenu() {
        match.phase = 'menu';
        document.body.classList.remove('in-match');
        $('hud').classList.add('hidden');
        ['pause', 'settings', 'over'].forEach((id) => $(id).classList.add('hidden'));
        $('menu').classList.remove('hidden');
        $('host-btn').disabled = false;
        $('join-btn').disabled = false;
        showScoreboard(false);
        renderCamos();
    }

    function enterGame() {
        $('menu').classList.add('hidden');
        $('hud').classList.remove('hidden');
        document.body.classList.add('in-match');
        if (touchDevice) enableTouch();
        setStatus('');
        updateHud();
        updateMatchHud(true);
        warmShaders();
        ac();
    }

    function overlayOpen() {
        return ['menu', 'pause', 'settings', 'over'].some((id) => !$(id).classList.contains('hidden'));
    }

    function openPause() {
        if (!inPlay() || overlayOpen()) return;
        match.paused = match.mode === 'solo';
        mouseDown = false;
        touch.fire = false;
        Object.keys(keys).forEach((k) => { keys[k] = false; });
        showScoreboard(false);
        $('pause-eyebrow').textContent = match.paused ? 'DURAKLATILDI' : 'MAÇ SÜRÜYOR';
        $('pause-title').textContent = match.paused ? 'Mola' : 'Menü';
        $('pause-note').textContent = match.paused ? 'Botlar ve süre bekliyor.' : 'Çevrimiçi maç durmaz; bu sırada vurulabilirsin.';
        $('pause-room').classList.toggle('hidden', !roomCode);
        $('pause-code').textContent = roomCode;
        $('pause').classList.remove('hidden');
        $('resume-btn').focus({ preventScroll: true });
    }

    function resume() {
        $('pause').classList.add('hidden');
        match.paused = false;
        lockPointer();
        updateClickHint();
    }

    let settingsReturn = 'menu';
    function openSettings(from) {
        settingsReturn = from;
        $(from).classList.add('hidden');
        renderSettings();
        $('settings').classList.remove('hidden');
        $('settings-done').focus({ preventScroll: true });
    }
    function closeSettings() {
        $('settings').classList.add('hidden');
        $(settingsReturn).classList.remove('hidden');
    }

    function renderSettings() {
        $('sens').value = String(prefs.sens);
        $('fov').value = String(prefs.fov);
        $('vol').value = String(prefs.vol);
        $('sens-val').textContent = `${prefs.sens.toFixed(2)}×`;
        $('fov-val').textContent = `${prefs.fov}°`;
        $('vol-val').textContent = `%${prefs.vol}`;
        document.querySelectorAll('#quality button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.q === prefs.q)));
    }

    function copyCode(code) {
        if (!code) return;
        const done = () => toast(`Oda kodu ${code} kopyalandı.`);
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code).then(done, () => toast(`Oda kodu: ${code}`));
        else toast(`Oda kodu: ${code}`);
    }

    /* ---------- Girdi ---------- */

    function lockPointer() {
        if (touchMode || !inPlay() || overlayOpen()) return;
        try {
            const p = canvas.requestPointerLock();
            if (p && typeof p.catch === 'function') p.catch(() => updateClickHint());
        } catch { updateClickHint(); }
    }
    function unlockPointer() {
        if (document.pointerLockElement) { try { document.exitPointerLock(); } catch { /* ignore */ } }
    }
    function updateClickHint() {
        $('clickhint').classList.toggle('hidden', touchMode || pointerLocked || !inPlay() || overlayOpen());
    }

    document.addEventListener('pointerlockchange', () => {
        pointerLocked = document.pointerLockElement === canvas;
        if (!pointerLocked) {
            mouseDown = false;
            player.ads = false;
            Object.keys(keys).forEach((k) => { keys[k] = false; });
            if (inPlay() && !overlayOpen()) openPause();
        }
        updateClickHint();
    });

    $('dmgflash').addEventListener('animationend', (e) => e.currentTarget.classList.remove('on'));
    canvas.addEventListener('click', () => { if (inPlay() && !pointerLocked && !overlayOpen()) lockPointer(); });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    const typing = (e) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    window.addEventListener('keydown', (e) => {
        if (typing(e)) return;
        if (e.code === 'Tab' && match.phase !== 'menu') { e.preventDefault(); if (!overlayOpen()) showScoreboard(true); return; }
        if (e.code === 'Escape' && inPlay()) {
            if (!$('settings').classList.contains('hidden')) { closeSettings(); return; }
            if (!$('pause').classList.contains('hidden')) { if (touchMode) resume(); return; }
            if (touchMode) openPause();
            return;
        }
        if (!inPlay() || overlayOpen() || (!pointerLocked && !touchMode)) return;
        keys[e.code] = true;
        if (e.code === 'Space') e.preventDefault();
        if (e.code === 'KeyR') startReload();
        if (e.code === 'KeyG') throwGrenade(performance.now());
        const digit = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
        if (digit >= 0) switchWeapon(digit);
    });
    window.addEventListener('keyup', (e) => {
        keys[e.code] = false;
        if (e.code === 'Tab') showScoreboard(false);
    });
    window.addEventListener('blur', () => { Object.keys(keys).forEach((k) => { keys[k] = false; }); mouseDown = false; showScoreboard(false); });
    window.addEventListener('wheel', (e) => {
        if (!pointerLocked || !canAct()) return;
        switchWeapon((player.weapon + (e.deltaY > 0 ? 1 : 3)) % 4);
    }, { passive: true });
    document.addEventListener('mousemove', (e) => {
        if (!pointerLocked || !canAct()) return;
        const w = WEAPONS[player.weapon];
        const sens = 0.0022 * prefs.sens * (player.ads ? 1 / Math.sqrt(w.zoom) : 1);
        player.yaw -= e.movementX * sens;
        player.pitch = clamp(player.pitch - e.movementY * sens, -1.5, 1.5);
    });
    document.addEventListener('mousedown', (e) => {
        if (!pointerLocked) return;
        if (e.button === 0) { mouseDown = true; if (!WEAPONS[player.weapon].auto) tryShoot(performance.now()); }
        if (e.button === 2) player.ads = true;
    });
    document.addEventListener('mouseup', (e) => {
        if (e.button === 0) mouseDown = false;
        if (e.button === 2) player.ads = false;
    });

    // Dokunmatik: sol taraf sanal çubuk, sağ taraf bakış, düğmeler eylemler.
    function enableTouch() {
        if (touchMode) return;
        touchMode = true;
        document.body.classList.add('touch-mode');
        $('touch').classList.remove('hidden');
        unlockPointer();
        updateClickHint();
    }

    function updateStick(t) {
        const r = $('stick').getBoundingClientRect();
        const rad = r.width / 2;
        let dx = (t.clientX - (r.left + rad)) / rad;
        let dy = (t.clientY - (r.top + rad)) / rad;
        const m = Math.hypot(dx, dy);
        if (m > 1) { dx /= m; dy /= m; }
        touch.mx = dx;
        touch.my = dy;
        $('stick-knob').style.transform = `translate(${dx * rad * 0.6}px, ${dy * rad * 0.6}px)`;
    }

    canvas.addEventListener('touchstart', (e) => {
        if (!inPlay() || overlayOpen()) return;
        e.preventDefault();
        enableTouch();
        for (const t of e.changedTouches) {
            if (t.clientX < innerWidth * 0.42 && touch.moveId === null) { touch.moveId = t.identifier; updateStick(t); }
            else if (touch.lookId === null) { touch.lookId = t.identifier; touch.lx = t.clientX; touch.ly = t.clientY; }
        }
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) {
            if (t.identifier === touch.moveId) updateStick(t);
            else if (t.identifier === touch.lookId) {
                if (canAct()) {
                    const w = WEAPONS[player.weapon];
                    const sens = 0.0048 * prefs.sens * (player.ads ? 1 / Math.sqrt(w.zoom) : 1);
                    player.yaw -= (t.clientX - touch.lx) * sens;
                    player.pitch = clamp(player.pitch - (t.clientY - touch.ly) * sens, -1.5, 1.5);
                }
                touch.lx = t.clientX;
                touch.ly = t.clientY;
            }
        }
    }, { passive: false });
    const endTouch = (e) => {
        for (const t of e.changedTouches) {
            if (t.identifier === touch.moveId) { touch.moveId = null; touch.mx = 0; touch.my = 0; $('stick-knob').style.transform = ''; }
            if (t.identifier === touch.lookId) touch.lookId = null;
        }
    };
    canvas.addEventListener('touchend', endTouch);
    canvas.addEventListener('touchcancel', endTouch);

    document.querySelectorAll('.tbtn').forEach((b) => {
        const act = b.dataset.act;
        b.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            const now = performance.now();
            if (act === 'fire') { touch.fire = true; if (!WEAPONS[player.weapon].auto) tryShoot(now); }
            else if (act === 'ads') { player.ads = !player.ads; b.classList.toggle('on', player.ads); }
            else if (act === 'jump') touch.jumpUntil = now + 160;
            else if (act === 'crouch') touch.crouch = true;
            else if (act === 'reload') startReload();
            else if (act === 'swap') switchWeapon((player.weapon + 1) % 4);
            else if (act === 'nade') throwGrenade(now);
        });
        const up = () => {
            if (act === 'fire') touch.fire = false;
            if (act === 'crouch') touch.crouch = false;
        };
        b.addEventListener('pointerup', up);
        b.addEventListener('pointercancel', up);
        b.addEventListener('pointerleave', up);
        b.addEventListener('contextmenu', (e) => e.preventDefault());
    });

    /* ---------- Menü olayları ---------- */

    document.querySelectorAll('.tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach((t) => {
                const on = t === tab;
                t.classList.toggle('active', on);
                t.setAttribute('aria-selected', String(on));
                $(`tab-${t.dataset.tab}`).classList.toggle('hidden', !on);
            });
            setStatus('');
        });
    });
    $('join-input').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); });
    $('join-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom(); });
    $('solo-btn').addEventListener('click', () => { closePeer(); startMatch('solo'); });
    $('host-btn').addEventListener('click', hostRoom);
    $('join-btn').addEventListener('click', joinRoom);
    $('copy-btn').addEventListener('click', () => copyCode(roomCode));
    $('pause-copy').addEventListener('click', () => copyCode(roomCode));
    $('resume-btn').addEventListener('click', resume);
    $('leave-btn').addEventListener('click', () => leaveMatch(''));
    $('pause-btn').addEventListener('click', () => { if (inPlay()) openPause(); });
    $('pause-settings-btn').addEventListener('click', () => openSettings('pause'));
    $('menu-settings-btn').addEventListener('click', () => openSettings('menu'));
    $('settings-done').addEventListener('click', closeSettings);
    $('again-btn').addEventListener('click', restartMatch);
    $('over-menu-btn').addEventListener('click', () => leaveMatch(''));
    $('match-pill').addEventListener('click', () => showScoreboard(!scoreboardOpen));
    $('sens').addEventListener('input', (e) => { prefs.sens = clamp(Number(e.target.value), 0.3, 3); renderSettings(); savePrefs(); });
    $('fov').addEventListener('input', (e) => { prefs.fov = clamp(Number(e.target.value), 65, 100); renderSettings(); savePrefs(); });
    $('vol').addEventListener('input', (e) => { prefs.vol = clamp(Number(e.target.value), 0, 100); renderSettings(); savePrefs(); if (master) master.gain.value = prefs.vol / 100; });
    $('vol').addEventListener('change', () => tone(660, 0.1, 'triangle', 0.08));
    document.querySelectorAll('#quality button').forEach((b) => b.addEventListener('click', () => {
        prefs.q = b.dataset.q;
        savePrefs();
        applyQuality();
        renderSettings();
    }));

    window.addEventListener('casualprofilechange', () => {
        if (!cheatOn('features')) previewCamo = null;
        renderCamos();
    });
    window.addEventListener('casual-cheat', () => {
        if (!cheatOn('features')) previewCamo = null;
        renderCamos();
    });
    window.addEventListener('casual-cheat-set', (event) => {
        const mine = scores.get(player.nid);
        if (match.mode !== 'solo' || !inPlay() || !mine) return;
        mine.kills = Number(event.detail.n) || 0;
        updateMatchHud(true);
        if (mine.kills >= match.killLimit) endMatch();
    });
    window.setInterval(() => {
        const mine = scores.get(player.nid);
        if (match.mode !== 'solo' || !inPlay() || match.paused || !mine || !window.CasualCheats) return;
        const gain = CasualCheats.tick();
        if (!gain) return;
        mine.kills = Number((mine.kills + gain).toFixed(3));
        updateMatchHud(true);
        if (mine.kills >= match.killLimit) endMatch();
    }, 1000);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && match.mode === 'solo' && inPlay()) { unlockPointer(); openPause(); }
    });
    window.addEventListener('resize', resize);

    /* ---------- Ana döngü ---------- */

    const sampleOut = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
    function sampleBuffer(b, rt) {
        if (!b.length) return null;
        if (rt <= b[0].t) return b[0];
        for (let i = b.length - 1; i >= 0; i--) {
            if (b[i].t > rt) continue;
            const s0 = b[i];
            const s1 = b[i + 1];
            if (!s1) return s0;
            const k = (rt - s0.t) / (s1.t - s0.t || 1);
            sampleOut.x = lerp(s0.x, s1.x, k);
            sampleOut.y = lerp(s0.y, s1.y, k);
            sampleOut.z = lerp(s0.z, s1.z, k);
            sampleOut.yaw = s0.yaw + angleDiff(s0.yaw, s1.yaw) * k;
            sampleOut.pitch = lerp(s0.pitch, s1.pitch, k);
            return sampleOut;
        }
        return b[0];
    }

    function interpolateActors(now) {
        const rt = now - INTERP_MS;
        for (const a of actors.values()) {
            if (a.sim) continue;
            const s = sampleBuffer(a.buf, rt);
            if (!s) continue;
            a.x = s.x; a.y = s.y; a.z = s.z; a.yaw = s.yaw; a.pitch = s.pitch;
        }
    }

    function poseActors(now, dt) {
        for (const a of actors.values()) {
            const g = a.group;
            // Paket gelmeyen (donmuş) oyuncu gizlenir; bağlantı kapanınca zaten silinir.
            const active = a.sim || (a.lastPacket && now - a.lastPacket < 5000);
            if (!active) { g.visible = false; if (a.tag) a.tag.visible = false; continue; }
            const moved = Math.hypot(a.x - a.px, a.z - a.pz) / Math.max(dt, 1e-3);
            a.px = a.x;
            a.pz = a.z;
            g.position.set(a.x, a.y, a.z);
            g.rotation.y = a.yaw;
            const scale = STANCE_SCALE[a.stance] || 1;
            a.body.scale.y = lerp(a.body.scale.y, scale, Math.min(1, dt * 12));
            if (a.alive && moved > 0.5) a.walk += dt * Math.min(moved, 9) * 1.3;
            const swing = a.alive ? Math.sin(a.walk) * Math.min(0.7, moved * 0.1) : 0;
            a.legL.rotation.x = swing;
            a.legR.rotation.x = -swing;
            a.hand.rotation.x = a.pitch;
            const deadFor = now - a.deadAt;
            if (!a.alive) {
                const k = Math.min(1, deadFor / 380);
                g.rotation.x = k * Math.PI / 2 * 0.92;
            } else g.rotation.x = 0;
            const dist = Math.hypot(a.x - player.x, a.z - player.z);
            g.visible = (a.alive || deadFor < 2600) && !(a.alive && inBush(a.x, a.z) && dist > 7);
            a.shirt.emissive.setHex(now < a.hitUntil ? 0x661a10 : 0x000000);
            if (a.wModel) a.wModel.userData.flash.visible = now < a.flashUntil;
            if (now > a.losAt) {
                a.losAt = now + 220 + Math.random() * 80;
                a.los = dist < 45 && !segmentBlocked(camera.position.x, camera.position.y, camera.position.z, a.x, a.y + 1.6 * scale, a.z);
            }
            if (a.tag) {
                a.tag.visible = g.visible && a.alive && a.los && match.phase !== 'menu';
                a.tag.position.set(a.x, a.y + 2.05 * scale + 0.1, a.z);
            }
        }
    }

    let lastFrame = performance.now();
    let footT = 0;
    function frame(now) {
        requestAnimationFrame(frame);
        const dt = Math.min(0.05, (now - lastFrame) / 1000);
        lastFrame = now;

        if (match.phase !== 'menu') {
            interpolateActors(now);
            refreshFighters();
            const running = !match.paused;
            if (running) {
                if (inPlay()) {
                    if (player.alive) updatePlayer(dt, now);
                    else if (now >= player.respawnAt) respawnPlayer(now);
                    const w = WEAPONS[player.weapon];
                    if (player.reloading && now - player.reloadStart >= w.reload) {
                        player.reloading = false;
                        player.ammo[player.weapon] = w.mag;
                        tone(420, 0.05, 'square', 0.03);
                        updateHud();
                    }
                    if ((mouseDown || touch.fire) && w.auto) tryShoot(now);
                    if (isAuthority()) {
                        match.remaining -= dt * 1000;
                        if (match.remaining <= 0) { match.remaining = 0; endMatch(); }
                    } else match.remaining = Math.max(0, match.remaining - dt * 1000);
                }
                if (isAuthority()) for (const a of actors.values()) if (a.sim) updateBot(a, dt, now);
                updateGrenades(dt, now);
            }
            if (match.mode === 'host' && now > match.syncAt) { match.syncAt = now + SNAPSHOT_MS; broadcast(snapshot()); }
            if (match.autoRestartAt && now > match.autoRestartAt && match.phase === 'end') restartMatch();
            poseActors(now, dt);
            netTick(now);
            if (!player.alive && inPlay()) setText('death-timer', `${Math.max(1, Math.ceil((player.respawnAt - now) / 1000))} sn içinde yeniden doğacaksın`);
            $('spawnshield').classList.toggle('hidden', !(player.alive && now < player.shieldUntil));
            $('bushmsg').classList.toggle('hidden', !(inPlay() && player.alive && inBush(player.x, player.z)));
            setText('stance', player.stance === 2 ? 'Kayıyor' : player.stance === 1 ? 'Çömeldin' : '');
            player.bloom = Math.max(0, player.bloom - dt * 2.2);
            updateMatchHud(false);
            updateCrosshair();
            drawMinimap(now);
        }
        updateEffects(dt);
        renderFrame(now, dt);
    }

    function renderFrame(now, dt) {
        const w = WEAPONS[player.weapon];
        if (match.phase === 'menu') {
            const t = now * 0.00004;
            camera.position.set(Math.sin(t) * 62, 26, Math.cos(t) * 62);
            camera.lookAt(0, 0, 0);
            if (Math.abs(camera.fov - prefs.fov) > 0.05) { camera.fov = prefs.fov; camera.updateProjectionMatrix(); }
            vmModels.forEach((m) => { m.visible = false; });
        } else {
            // recoil recovery
            const rec = player.recoil * Math.min(1, dt * 7);
            player.recoil -= rec;
            if (player.alive) player.pitch = clamp(player.pitch - rec * 0.65, -1.5, 1.5);
            let yaw = player.yaw;
            let pitch = player.pitch;
            let camY = player.y + player.eye;
            if (!player.alive && inPlay()) {
                // Ölüm kamerası: yukarı kalk ve seni vurana bak.
                const f = fighterById(player.killer);
                camY = player.y + 3.2;
                if (f && player.killer !== player.nid) {
                    yaw = Math.atan2(-(f.x - player.x), -(f.z - player.z));
                    pitch = Math.atan2(f.y + 1.2 - camY, Math.hypot(f.x - player.x, f.z - player.z));
                } else pitch = -0.6;
            }
            camera.position.set(player.x, camY, player.z);
            if (shake > 0) camera.position.add(new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(shake * 0.12));
            camera.rotation.y = yaw;
            camera.rotation.x = pitch;
            camRoll += ((player.stance === 2 ? 0.07 : 0) - camRoll) * Math.min(1, dt * 10);
            camera.rotation.z = camRoll;
            const scopedNow = player.ads && player.weapon === 3 && player.alive;
            const fovT = player.ads && player.alive ? prefs.fov / w.zoom : prefs.fov;
            if (Math.abs(camera.fov - fovT) > 0.05) { camera.fov += (fovT - camera.fov) * Math.min(1, dt * 14); camera.updateProjectionMatrix(); }
            const scoped = scopedNow && camera.fov < 35;
            setStyle('scope', 'display', scoped ? 'block' : 'none');
            setStyle('crosshair', 'display', scoped || !player.alive || match.phase !== 'play' ? 'none' : 'block');
            muzzleLight.position.copy(camera.position);

            let reloadP = 0;
            if (player.reloading) reloadP = (now - player.reloadStart) / w.reload;
            vmModels.forEach((m, i) => { m.visible = i === player.weapon && player.alive && !scoped && match.phase === 'play'; });
            const cur = vmModels[player.weapon];
            vmKick = Math.max(0, vmKick - dt * 9);
            vmSwap = Math.max(0, vmSwap - dt * 4);
            const walking = player.onGround && player.speedNow > 1 && player.stance !== 2;
            if (walking) {
                bobT += dt * player.speedNow * 1.6;
                footT += dt * player.speedNow;
                if (footT > 2.6) { footT = 0; noise(0.07, player.speedNow > 8 ? 700 : 450, player.speedNow > 8 ? 0.07 : 0.035); }
            }
            const tx = player.ads ? 0 : 0.2;
            const ty = player.ads ? -0.115 : -0.2;
            const tz = player.ads ? -0.32 : -0.42;
            const k = Math.min(1, dt * 16);
            vmRoot.position.x += (tx - vmRoot.position.x) * k;
            vmRoot.position.y += (ty - vmRoot.position.y) * k;
            vmRoot.position.z += (tz - vmRoot.position.z) * k;
            const rp = Math.sin(clamp(reloadP, 0, 1) * Math.PI);
            if (cur) {
                cur.position.set(
                    walking ? Math.cos(bobT) * 0.006 : 0,
                    (walking ? Math.abs(Math.sin(bobT)) * 0.01 : 0) - vmSwap * 0.3 - rp * 0.14 + (player.stance === 2 ? -0.04 : 0),
                    vmKick * 0.07
                );
                cur.rotation.set(vmKick * 0.12 + rp * 0.7 + vmSwap * 0.5, 0, rp * 0.25 + (player.stance === 2 ? 0.2 : 0));
                cur.userData.flash.visible = now < flashUntil;
                if (cur.userData.flash.visible) cur.userData.flash.scale.setScalar(0.8 + Math.random() * 0.8);
            }
            vmFlashLight.intensity = now < flashUntil ? 1.6 : 0;
        }
        renderer.clear();
        renderer.render(scene, camera);
        if (match.phase !== 'menu' && player.alive) {
            renderer.clearDepth();
            renderer.render(vmScene, vmCamera);
        }
    }

    /* ---------- Başlat ---------- */

    if (new URLSearchParams(location.search).has('debug')) {
        // Yalnızca ?debug ile: tarayıcı testleri için salt-okunur durum.
        window.ArenaDebug = {
            three: { scene, renderer, camera },
            state: () => ({
                phase: match.phase, mode: match.mode, paused: match.paused, remaining: match.remaining,
                player: { nid: player.nid, x: player.x, y: player.y, z: player.z, hp: player.hp, alive: player.alive, weapon: player.weapon, ammo: player.ammo.slice(), nades: player.nades },
                actors: [...actors.values()].map((a) => ({ nid: a.nid, name: a.name, bot: a.bot, x: a.x, z: a.z, alive: a.alive, sim: Boolean(a.sim), hp: a.sim?.hp })),
                scores: standings(), conns: conns.length, grenades: grenades.size
            }),
            end: () => endMatch(),
            look(pitch) { player.pitch = clamp(pitch, -1.5, 1.5); },
            place(x, z, yaw) { player.x = x; player.z = z; player.y = 0; player.yaw = yaw; },
            near(nid) {
                const a = actors.get(nid);
                if (!a) return false;
                for (let i = 0; i < 16; i++) {
                    const ang = (i / 16) * TAU;
                    const x = a.x + Math.cos(ang) * 5;
                    const z = a.z + Math.sin(ang) * 5;
                    if (!blocked(x, z, 0) && !segmentBlocked(x, 1.6, z, a.x, a.y + 1.2, a.z)) { player.x = x; player.z = z; player.y = 0; return true; }
                }
                return false;
            },
            aimAt(nid) {
                const a = actors.get(nid);
                if (!a) return false;
                const ey = player.y + player.eye;
                player.yaw = Math.atan2(-(a.x - player.x), -(a.z - player.z));
                player.pitch = Math.atan2(a.y + 1.1 * (STANCE_SCALE[a.stance] || 1) - ey, Math.hypot(a.x - player.x, a.z - player.z));
                return true;
            }
        };
    }

    applyQuality();
    renderOptions();
    renderSettings();
    showMenu();
    requestAnimationFrame((t) => { lastFrame = t; frame(t); });
})();
