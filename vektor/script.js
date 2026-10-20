/*
 * VEKTÖR — CasualPass
 * 5'e 5 taktik kahraman nişancı: saldırı/savunma, çekirdek kurma ve çözme, satın alma evresi,
 * ekonomi, ajan yetenekleri (C/Q/E/X), raunt sistemi ve devre arası taraf değişimi.
 * Three.js sahnesi; çevrimiçi odalar PeerJS/WebRTC ile host merkezli (yıldız) çalışır.
 *
 * AĞ PROTOKOLÜ
 *   Konum kaydı 13 bayt: nid u16 · x,y,z i16 (cm) · yaw u16 · pitch i8 · bayrak u8 · silah u8
 *     bayrak: [0-1 duruş][2 canlı][3 şarjör][4-5 atış sayacı][6 yürüyor][7 kurma/çözme]
 *     silah:  [0-3 silah sırası][4 çekirdek taşıyor]
 *   Paket = 1 bayt tip + N kayıt; host herkesi tek pakette toplar, en fazla 15 Hz.
 *   Olaylar (JSON, güvenilir kanal): hi, s (kadro/skor), rs (raunt başı), ph (evre), re (raunt sonu),
 *   h (isabet), k (ölüm), ab/abx (yetenek), sp (çekirdek durumu), pl (kurma), df (çözme), e, b, p/q, err.
 *   İsabeti atan bildirir, hasarı (kalkan dahil) hedefin sahibi uygular; botların ve raundun sahibi host'tur.
 *   Herkes kendi kredisini raunt sonucu ve öldürme olaylarından aynı kurallarla hesaplar.
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
    const CELL = 2;
    const COLS = 40;
    const ROWS = 56;
    const HALF_X = (COLS * CELL) / 2;
    const HALF_Z = (ROWS * CELL) / 2;
    const WALL_H = 6;
    const R = 0.35;
    const EYE_STAND = 1.62;
    const EYE_CROUCH = 1.12;
    const STANCE_SCALE = [1, 0.74];
    const GRAVITY = -20;
    const JUMP = 7.2;
    const SPEED = { run: 6.75, walk: 3.6, crouch: 2.6 };
    const TIMES = { buy: 25000, round: 100000, spike: 45000, post: 6000, plant: 4000, defuse: 7000, defuseHalf: 3500 };
    const ECON = { start: 800, win: 3000, loss: [1900, 2400, 2900], kill: 200, plant: 300, max: 9000 };
    const ULT_COST = 6;
    const BOT_BASE = 65100;
    const MAX_HUMANS = 10;
    const RECORD = 13;
    const NET_STEP_MS = 66;
    const INTERP_MS = 100;
    const SNAPSHOT_MS = 3000;
    const ROOM_PREFIX = 'casualvektor-';
    const PREFS_COOKIE = 'cp_vektor_prefs';
    const BEST_COOKIE = 'cp_vektor_best';
    const ATK = 0;
    const DEF = 1;
    const SIDE_NAMES = ['Saldırı', 'Savunma'];
    const BOT_NAMES = ['Demir', 'Rüya', 'Tuna', 'Ece', 'Bulut', 'Deniz', 'Kuzey', 'Ada', 'Arda', 'Selin'];

    const DIFFICULTY = {
        easy: { label: 'Kolay', react: 0.75, aimErr: 0.06, turn: 3.2, head: 0.08, dmg: 0.75, burst: [2, 4], pause: [0.45, 0.8] },
        normal: { label: 'Normal', react: 0.45, aimErr: 0.035, turn: 5.5, head: 0.18, dmg: 0.9, burst: [3, 5], pause: [0.3, 0.55] },
        hard: { label: 'Zor', react: 0.26, aimErr: 0.02, turn: 9, head: 0.32, dmg: 1, burst: [3, 6], pause: [0.2, 0.4] }
    };

    // The order is the network weapon index (4 bits). range: [full damage until, min damage from, min multiplier].
    // spread: first-shot error while standing still; move: extra error at full running speed.
    const WEAPONS = [
        { id: 'knife', name: 'Bıçak', slot: 3, price: 0, melee: true, dmg: 50, heavy: 75, delay: 420, speed: 1.07 },
        { id: 'pim', name: 'Pim', type: 'Tabanca', slot: 2, price: 0, dmg: 26, head: 3, delay: 150, mag: 12, reserve: 36, auto: false, spread: 0.004, move: 0.035, reload: 1750, kick: 0.012, range: [30, 50, 0.85], speed: 1, pattern: 'pistol' },
        { id: 'olcu', name: 'Ölçü', type: 'Tabanca', slot: 2, price: 800, dmg: 55, head: 2.9, delay: 420, mag: 6, reserve: 24, auto: false, spread: 0.003, move: 0.06, reload: 2250, kick: 0.035, range: [30, 50, 0.85], speed: 1, pattern: 'pistol' },
        { id: 'ari', name: 'Arı', type: 'Hafif makineli', slot: 1, price: 1600, dmg: 26, head: 2.5, delay: 75, mag: 30, reserve: 60, auto: true, spread: 0.011, move: 0.02, reload: 2250, kick: 0.006, range: [20, 50, 0.8], speed: 1, pattern: 'smg' },
        { id: 'sacma', name: 'Saçma', type: 'Pompalı', slot: 1, price: 1850, dmg: 17, pellets: 12, head: 1.5, delay: 900, mag: 6, reserve: 18, auto: false, spread: 0.055, move: 0.02, reload: 2500, kick: 0.05, range: [8, 15, 0.35], speed: 0.98, pattern: 'pistol' },
        { id: 'kartal', name: 'Kartal', type: 'Tüfek', slot: 1, price: 2900, dmg: 40, head: 4, delay: 103, mag: 25, reserve: 50, auto: true, spread: 0.0025, move: 0.08, reload: 2500, kick: 0.009, range: [999, 999, 1], speed: 0.95, pattern: 'rifle', note: 'Mesafeden bağımsız tek kafa' },
        { id: 'sahin', name: 'Şahin', type: 'Tüfek', slot: 1, price: 2900, dmg: 39, head: 4, delay: 91, mag: 30, reserve: 60, auto: true, spread: 0.0018, move: 0.075, reload: 2500, kick: 0.007, range: [15, 30, 0.88], speed: 0.95, pattern: 'rifle', silent: true, note: 'Susturuculu, iz bırakmaz' },
        { id: 'yayla', name: 'Yayla', type: 'Keskin', slot: 1, price: 4700, dmg: 150, head: 1.7, delay: 1500, mag: 5, reserve: 10, auto: false, spread: 0.06, scoped: 0.0004, move: 0.1, reload: 3700, kick: 0.08, zoom: 4.5, range: [999, 999, 1], speed: 0.9, pattern: 'pistol', note: 'Gövdeye tek atış' },
        { id: 'spike', name: 'Çekirdek', slot: 4, price: 0, speed: 1 },
        { id: 'blades', name: 'Fırtına Bıçakları', type: 'Nihai', slot: 5, price: 0, dmg: 50, head: 3, delay: 330, mag: 5, reserve: 0, auto: false, spread: 0.0015, move: 0.004, reload: 1, kick: 0.012, range: [999, 999, 1], speed: 1.05, pattern: 'pistol', note: 'Öldürünce dolar' }
    ];
    const W = Object.fromEntries(WEAPONS.map((w, i) => [w.id, i]));
    const SHIELDS = [
        { id: 'light', name: 'Hafif Kalkan', price: 400, armor: 25 },
        { id: 'heavy', name: 'Ağır Kalkan', price: 1000, armor: 50 }
    ];

    // Ability kinds the effect system knows; agents just pick four of them.
    const AGENTS = {
        kor: {
            name: 'Kor', role: 'Düellocu', color: '#ff7a3d', hex: 0xff7a3d, desc: 'Alevle köşeleri temizler, atılıp savaşın içine dalar.',
            abilities: {
                c: { kind: 'molotov', name: 'Alev Topu', price: 200, max: 1, desc: 'Düştüğü yeri 7 sn yakar.' },
                q: { kind: 'flash', name: 'Kör Edici', price: 250, max: 2, desc: 'Havada patlar, bakanları kör eder.' },
                e: { kind: 'dash', name: 'Atılım', free: 1, max: 1, desc: 'Baktığın yöne hızla atıl.' },
                x: { kind: 'blaze', name: 'Cehennem', desc: 'Canın dolar; 10 sn hızlı ve sert vurursun.' }
            }
        },
        sis: {
            name: 'Sis', role: 'Kontrolcü', color: '#9b7bff', hex: 0x9b7bff, desc: 'Dumanla görüşü keser, alanı yavaşlatır.',
            abilities: {
                c: { kind: 'slow', name: 'Bataklık', price: 150, max: 2, desc: 'Düştüğü alanda düşmanlar yavaşlar.' },
                q: { kind: 'dark', name: 'Gölge', price: 250, max: 1, desc: 'Çarptığı yerdeki düşmanların görüşünü karartır.' },
                e: { kind: 'smoke', name: 'Duman', free: 2, max: 3, desc: 'Nişan aldığın yere 15 sn duman.' },
                x: { kind: 'smokewall', name: 'Gece Perdesi', desc: 'Önüne uzun bir duman perdesi çeker.' }
            }
        },
        ok: {
            name: 'Ok', role: 'Öncü', color: '#3fd17a', hex: 0x3fd17a, desc: 'Ok ile düşmanı bulur, şokla yerinden çıkarır.',
            abilities: {
                c: { kind: 'shock', name: 'Şok Oku', price: 200, max: 1, desc: 'Çarptığı yerde 75 hasar.' },
                q: { kind: 'flash', name: 'Parlama', price: 250, max: 2, desc: 'Havada patlar, bakanları kör eder.' },
                e: { kind: 'recon', name: 'Keşif Oku', free: 1, max: 1, desc: 'Saplandığı yerden düşmanları iki kez gösterir.' },
                x: { kind: 'hunt', name: 'Av', desc: 'Tüm düşmanlar üç kez haritada görünür.' }
            }
        },
        kale: {
            name: 'Kale', role: 'Gözcü', color: '#4aa3ff', hex: 0x4aa3ff, desc: 'Teller ve duvarlarla bölgeyi tutar.',
            abilities: {
                c: { kind: 'trip', name: 'Tuzak Teli', price: 200, max: 1, desc: 'Geçen düşmanı yavaşlatır ve gösterir.' },
                q: { kind: 'wall', name: 'Kalkan Duvarı', price: 300, max: 1, desc: '20 sn boyunca mermi geçirmeyen duvar.' },
                e: { kind: 'heal', name: 'Onarım', free: 1, max: 1, desc: '3 sn içinde 60 can.' },
                x: { kind: 'lock', name: 'Kilit', desc: 'Çevrendeki düşmanları 8 sn yavaşlatır ve gösterir.' }
            }
        },
        ruzgar: {
            name: 'Rüzgâr', role: 'Düellocu', color: '#c6f36b', hex: 0xc6f36b, desc: 'Havalanır, süzülür; nihaisinde isabetli fırlatma bıçaklarıyla avlanır.',
            abilities: {
                c: { kind: 'updraft', name: 'Yükseliş', price: 150, max: 2, desc: 'Seni havaya fırlatır.' },
                q: { kind: 'cloud', name: 'Bulut', price: 200, max: 2, desc: 'Nişan aldığın yere 7 sn küçük duman.' },
                e: { kind: 'dash', name: 'Süzülüş', free: 1, max: 1, desc: 'Baktığın yöne hızla atıl.' },
                x: { kind: 'blades', name: 'Fırtına Bıçakları', desc: '15 sn boyunca 5 isabetli bıçak; öldürünce dolar.' }
            }
        },
        ayaz: {
            name: 'Ayaz', role: 'Kontrolcü', color: '#8de8ff', hex: 0x8de8ff, desc: 'Buzla yolu keser, kırağıyla yavaşlatır, tipiyle bölgeyi boğar.',
            abilities: {
                c: { kind: 'icewall', name: 'Buz Duvarı', price: 300, max: 1, desc: '15 sn mermi geçirmeyen geniş buz duvarı.' },
                q: { kind: 'frost', name: 'Kırağı', price: 150, max: 2, desc: 'Düştüğü yerde düşmanlar yavaşlar.' },
                e: { kind: 'icesmoke', name: 'Kar Küresi', free: 2, max: 3, desc: 'Nişan aldığın yere 15 sn duman.' },
                x: { kind: 'blizzard', name: 'Tipi', desc: 'Nişan aldığın alanda 8 sn yavaşlatan, yakan kar fırtınası.' }
            }
        },
        fay: {
            name: 'Fay', role: 'Öncü', color: '#e0a35c', hex: 0xe0a35c, desc: 'Yeri sarsar: sarsılan düşman yavaşlar ve iyi nişan alamaz.',
            abilities: {
                c: { kind: 'stun', name: 'Sarsıntı Bombası', price: 200, max: 1, desc: 'Patladığı yerde düşmanları 3 sn sarsar.' },
                q: { kind: 'quake', name: 'Fay Hattı', price: 250, max: 2, desc: 'Önünde uzanan bir şeridi duvarların ardına kadar sarsar.' },
                e: { kind: 'pulse', name: 'Yer Dinleme', free: 1, max: 1, desc: '18 m içindeki düşmanları duvar ardından gösterir.' },
                x: { kind: 'rupture', name: 'Büyük Kırılma', desc: 'Geniş ve uzun bir şeridi 4 sn sarsar ve gösterir.' }
            }
        },
        nobet: {
            name: 'Nöbet', role: 'Gözcü', color: '#e4e9f2', hex: 0xe4e9f2, desc: 'Taret ve alarmla bölgeyi tek başına tutar, takımına kalkan dağıtır.',
            abilities: {
                c: { kind: 'alarm', name: 'Alarm', price: 200, max: 1, desc: 'Yaklaşan düşmanı yavaşlatır ve gösterir.' },
                q: { kind: 'shieldup', name: 'Kalkan Takviyesi', price: 300, max: 1, desc: 'Yakındaki takımına +25 kalkan (en çok 50).' },
                e: { kind: 'turret', name: 'Taret', free: 1, max: 1, desc: 'Gördüğü düşmana ateş eden taret; vurulunca bozulur.' },
                x: { kind: 'beacon', name: 'Fener', desc: '12 sn boyunca çevrendeki düşmanları sürekli gösterir.' }
            }
        }
    };
    const AGENT_IDS = Object.keys(AGENTS);
    const SLOTS = ['c', 'q', 'e', 'x'];

    // Weapon camos are the shared CasualPass catalogue (bought in Arena FPS).
    const CAMO_PATTERNS = {
        desert: ['#c9b48a', '#b59a6a', '#8a7350', '#6b5a3e'],
        forest: ['#55703f', '#2c3a24', '#6b5a32', '#82955c'],
        arctic: ['#e9eef2', '#c4ced6', '#9aa7b3', '#ffffff'],
        crimson: ['#8e2230', '#5a1a1f', '#3a0d14', '#b8434c']
    };
    const CAMO_BASE = {
        standard: { metal: 0x2b2f36, dark: 0x15181d, wood: 0x3a3d44, acc: 0x8a8f98 },
        golden: { metal: 0xd9a62e, dark: 0x8a6414, wood: 0x6b3b10, acc: 0xffe08a, shiny: true }
    };

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const rand = (a, b) => a + Math.random() * (b - a);
    const randInt = ([a, b]) => a + Math.floor(Math.random() * (b - a + 1));
    const angleDiff = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
    const round2 = (v) => Math.round(v * 100) / 100;
    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    function mulberry32(seed) {
        let a = seed;
        return () => {
            a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    const cellX = (c) => (c - COLS / 2) * CELL + CELL / 2;
    const cellZ = (r) => (r - ROWS / 2) * CELL + CELL / 2;

    /* ---------- Tercihler (çerez) ---------- */

    const touchDevice = window.matchMedia('(pointer: coarse)').matches;
    const ROUND_CHOICES = [5, 7, 13];
    const SIZE_CHOICES = [3, 5];
    const MAP_NAMES = ['liman', 'kumsaray', 'ucyol', 'buzul']; // MAPS anahtarları; tercihler haritalardan önce okunur
    const CROSS_COLORS = { cyan: '#5ff5e1', green: '#7dff6b', yellow: '#ffe14d', white: '#ffffff', pink: '#ff6bd6' };
    const prefs = loadPrefs();

    function loadPrefs() {
        const base = { sens: 1, fov: 71, vol: 80, q: touchDevice ? 'low' : 'mid', cross: 'cyan', agent: 'kor', rounds: 7, size: 5, diff: 'normal', fill: true, map: 'random' };
        let saved = {};
        try { saved = JSON.parse(getCookieValue(PREFS_COOKIE) || '{}') || {}; } catch { saved = {}; }
        const num = (v, d) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
        return {
            sens: clamp(num(saved.sens, base.sens), 0.2, 3),
            fov: clamp(num(saved.fov, base.fov), 60, 85),
            vol: clamp(num(saved.vol, base.vol), 0, 100),
            q: ['low', 'mid', 'high'].includes(saved.q) ? saved.q : base.q,
            cross: CROSS_COLORS[saved.cross] ? saved.cross : base.cross,
            agent: AGENTS[saved.agent] ? saved.agent : base.agent,
            rounds: ROUND_CHOICES.includes(saved.rounds) ? saved.rounds : base.rounds,
            size: SIZE_CHOICES.includes(saved.size) ? saved.size : base.size,
            diff: DIFFICULTY[saved.diff] ? saved.diff : base.diff,
            fill: saved.fill === undefined ? base.fill : Boolean(saved.fill),
            map: saved.map === 'random' || MAP_NAMES.includes(saved.map) ? saved.map : base.map
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
    const SKY_HORIZON = 0xf3dcc0;
    const SKY_TOP = 0x5f9ad6;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SKY_HORIZON);
    scene.fog = new THREE.Fog(SKY_HORIZON, 60, 170);
    const camera = new THREE.PerspectiveCamera(prefs.fov, innerWidth / innerHeight, 0.05, 420);
    camera.rotation.order = 'YXZ';
    scene.add(camera);
    const hemi = new THREE.HemisphereLight(0xfff4e6, 0x6b5a48, 0.78);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe2b8, 0.95);
    sun.position.set(-45, 85, 30);
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 220 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0006;
    scene.add(sun, sun.target);
    // Lights stay in the scene at zero intensity so the light count, and the compiled shaders, never change.
    const muzzleLight = new THREE.PointLight(0xffc46b, 0, 9, 2);
    const boomLight = new THREE.PointLight(0xff9a3c, 0, 30, 2);
    scene.add(muzzleLight, boomLight);

    const skyDome = (function buildSky() {
        const geo = new THREE.SphereGeometry(300, 24, 12);
        const pos = geo.attributes.position;
        const top = new THREE.Color(SKY_TOP);
        const horizon = new THREE.Color(SKY_HORIZON);
        const c = new THREE.Color();
        const colors = [];
        for (let i = 0; i < pos.count; i++) {
            c.copy(horizon).lerp(top, Math.pow(Math.max(0, pos.getY(i) / 300), 0.5));
            colors.push(c.r, c.g, c.b);
        }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        const sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
        sky.renderOrder = -1;
        camera.add(sky);
        return sky;
    })();

    // The first-person weapon is drawn in its own scene so it never clips into walls.
    const vmScene = new THREE.Scene();
    const vmCamera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.01, 10);
    vmScene.add(new THREE.HemisphereLight(0xfff4e6, 0x6b5a48, 0.95));
    const vmSun = new THREE.DirectionalLight(0xffe2b8, 0.7);
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
    const gray = (v, a = 1) => `rgba(${v},${v},${v},${a})`;

    // Light-grey surfaces tinted by material colour; scale = metres per tile, box = keep box UVs.
    const SURFACES = {
        pavers: { paint(g, S, k) {
            g.fillStyle = '#e6dccb';
            g.fillRect(0, 0, S, S);
            const n = 8;
            const t = S / n;
            for (let r = 0; r < n; r++) {
                const off = (r % 2) * (t / 2);
                for (let c = -1; c <= n; c++) {
                    const x = c * t + off;
                    const y = r * t;
                    g.fillStyle = gray(Math.round(rand(200, 245)));
                    g.fillRect(x + 1.5 * k, y + 1.5 * k, t - 3 * k, t - 3 * k);
                }
            }
            g.strokeStyle = 'rgba(70,60,50,.45)';
            g.lineWidth = 2.5 * k;
            for (let r = 0; r <= n; r++) {
                g.beginPath(); g.moveTo(0, r * t); g.lineTo(S, r * t); g.stroke();
                const off = (r % 2) * (t / 2);
                for (let c = 0; c <= n; c++) { g.beginPath(); g.moveTo(c * t + off, r * t); g.lineTo(c * t + off, r * t + t); g.stroke(); }
            }
            overlay(g, S, NOISE_LO, 1, 0.22);
            overlay(g, S, NOISE_HI, 3, 0.18);
            dots(g, S, 1500 * k * k, 1.5 * k, ['rgba(60,50,40,.25)', 'rgba(255,255,255,.35)']);
        } },
        plaster: { scale: 4, paint(g, S, k) {
            g.fillStyle = '#f2ece2';
            g.fillRect(0, 0, S, S);
            overlay(g, S, NOISE_LO, 1, 0.12);
            overlay(g, S, NOISE_HI, 3, 0.09);
            for (let i = 0; i < 26 * k; i++) {
                const x = Math.random() * S;
                const grd = g.createLinearGradient(0, 0, 0, S);
                grd.addColorStop(0, 'rgba(90,70,50,.08)');
                grd.addColorStop(1, 'rgba(90,70,50,0)');
                g.fillStyle = grd;
                g.fillRect(x, 0, rand(2, 7) * k, S);
            }
            dots(g, S, 1800 * k * k, 1.3 * k, ['rgba(90,80,70,.2)', 'rgba(255,255,255,.4)']);
            // painted stone blocks peeking through, the stylised look of a sunny harbour town
            for (let i = 0; i < 3; i++) {
                const x = Math.random() * S;
                const y = Math.random() * S;
                g.strokeStyle = 'rgba(110,90,70,.18)';
                g.lineWidth = 2 * k;
                for (let b = 0; b < 4; b++) wrapped(S, x + (b % 2) * 26 * k, y + Math.floor(b / 2) * 14 * k, 30 * k, (px, py) => g.strokeRect(px, py, 24 * k, 12 * k));
            }
        } },
        trim: { scale: 2, paint(g, S, k) {
            g.fillStyle = '#d9d2c6';
            g.fillRect(0, 0, S, S);
            overlay(g, S, NOISE_HI, 2, 0.3);
            g.fillStyle = 'rgba(0,0,0,.18)';
            for (let i = 0; i < 4; i++) g.fillRect(0, (i * S) / 4, S, 2 * k);
        } },
        concrete: { scale: 4, paint(g, S, k) {
            g.fillStyle = '#e2e2de';
            g.fillRect(0, 0, S, S);
            overlay(g, S, NOISE_LO, 1, 0.32);
            overlay(g, S, NOISE_HI, 3, 0.24);
            dots(g, S, 1600 * k * k, 1.6 * k, ['rgba(40,40,40,.25)', 'rgba(255,255,255,.35)']);
            g.strokeStyle = 'rgba(40,40,40,.4)';
            g.lineWidth = 3 * k;
            for (const v of [1.5 * k, S / 2]) {
                g.beginPath(); g.moveTo(v, 0); g.lineTo(v, S); g.stroke();
                g.beginPath(); g.moveTo(0, v); g.lineTo(S, v); g.stroke();
            }
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
            overlay(g, S, NOISE_HI, 2, 0.16);
        } },
        metal: { scale: 2.4, paint(g, S, k) {
            const ribs = 12;
            for (let x = 0; x < S; x++) {
                const v = 0.74 + 0.26 * (0.5 + 0.5 * Math.cos((x / S) * ribs * TAU));
                g.fillStyle = gray(Math.round(v * 245));
                g.fillRect(x, 0, 1, S);
            }
            overlay(g, S, NOISE_LO, 1, 0.2);
            overlay(g, S, NOISE_HI, 2, 0.18);
            for (let i = 0; i < 30 * k * k; i++) blob(g, S, Math.random() * S, Math.random() * S, rand(2, 10) * k, 'rgba(120,60,25,.14)');
        } },
        tile: { scale: 3, paint(g, S, k) {
            // terracotta roof tiles for awnings
            g.fillStyle = '#e0e0e0';
            g.fillRect(0, 0, S, S);
            const rows = 8;
            const h = S / rows;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < 8; c++) {
                    const x = c * (S / 8);
                    const grd = g.createLinearGradient(x, 0, x + S / 8, 0);
                    grd.addColorStop(0, gray(170));
                    grd.addColorStop(0.5, gray(245));
                    grd.addColorStop(1, gray(170));
                    g.fillStyle = grd;
                    g.fillRect(x, r * h, S / 8, h - 2 * k);
                }
                g.fillStyle = 'rgba(0,0,0,.3)';
                g.fillRect(0, r * h + h - 3 * k, S, 3 * k);
            }
            overlay(g, S, NOISE_HI, 2, 0.2);
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
        } },
        sandstone: { scale: 4, paint(g, S, k) {
            // coursed sandstone blocks with soft, sand-worn joints
            g.fillStyle = '#ece4d6';
            g.fillRect(0, 0, S, S);
            const rows = 6;
            const h = S / rows;
            for (let r = 0; r < rows; r++) {
                const n = 3;
                const off = (r % 2) * (S / n / 2);
                for (let c = -1; c <= n; c++) {
                    g.fillStyle = gray(Math.round(rand(214, 246)));
                    g.fillRect(c * (S / n) + off + 2 * k, r * h + 2 * k, S / n - 4 * k, h - 4 * k);
                }
                g.fillStyle = 'rgba(120,95,60,.35)';
                g.fillRect(0, r * h, S, 2.5 * k);
                for (let c = 0; c <= n; c++) g.fillRect(c * (S / n) + off - 1.2 * k, r * h, 2.5 * k, h);
            }
            overlay(g, S, NOISE_LO, 1, 0.2);
            overlay(g, S, NOISE_HI, 3, 0.2);
            dots(g, S, 2400 * k * k, 1.4 * k, ['rgba(110,80,40,.22)', 'rgba(255,255,255,.4)']);
        } },
        flagstone: { big: true, paint(g, S, k) {
            // irregular stone slabs set in sand
            g.fillStyle = '#c9b89a';
            g.fillRect(0, 0, S, S);
            const n = 6;
            const t = S / n;
            for (let r = 0; r < n; r++) {
                for (let c = 0; c < n; c++) {
                    const w = t * rand(0.78, 0.92);
                    const hh = t * rand(0.78, 0.92);
                    g.fillStyle = gray(Math.round(rand(212, 244)));
                    g.beginPath();
                    const x = c * t + (t - w) / 2;
                    const y = r * t + (t - hh) / 2;
                    const j = () => rand(-3, 3) * k;
                    g.moveTo(x + j(), y + j()); g.lineTo(x + w + j(), y + j()); g.lineTo(x + w + j(), y + hh + j()); g.lineTo(x + j(), y + hh + j());
                    g.closePath();
                    g.fill();
                }
            }
            overlay(g, S, NOISE_LO, 1, 0.25);
            overlay(g, S, NOISE_HI, 3, 0.2);
            dots(g, S, 2600 * k * k, 1.4 * k, ['rgba(100,80,50,.25)', 'rgba(255,255,255,.35)']);
        } },
        snow: { big: true, scale: 6, paint(g, S, k) {
            // packed snow with footprints and wind ripples
            g.fillStyle = '#f4f6f8';
            g.fillRect(0, 0, S, S);
            overlay(g, S, NOISE_LO, 1, 0.18);
            g.strokeStyle = 'rgba(150,170,190,.18)';
            g.lineWidth = 3 * k;
            for (let i = 0; i < 18; i++) {
                const y0 = rand(0, S);
                const ph = rand(0, TAU);
                g.beginPath();
                for (let x = 0; x <= S; x += 6 * k) g.lineTo(x, y0 + Math.sin(x / (60 * k) + ph) * 8 * k);
                g.stroke();
            }
            for (let i = 0; i < 40 * k * k; i++) blob(g, S, rand(0, S), rand(0, S), rand(3, 6) * k, 'rgba(140,160,185,.16)');
            dots(g, S, 2000 * k * k, 1.2 * k, ['rgba(255,255,255,.9)', 'rgba(150,170,190,.2)']);
        } },
        panel: { big: true, paint(g, S, k) {
            // large floor plates with seams and a few inset light strips
            g.fillStyle = '#e4e6e8';
            g.fillRect(0, 0, S, S);
            overlay(g, S, NOISE_LO, 1, 0.16);
            overlay(g, S, NOISE_HI, 3, 0.12);
            g.strokeStyle = 'rgba(60,70,80,.45)';
            g.lineWidth = 2.5 * k;
            const n = 4;
            for (let i = 0; i <= n; i++) {
                g.beginPath(); g.moveTo((i * S) / n, 0); g.lineTo((i * S) / n, S); g.stroke();
                g.beginPath(); g.moveTo(0, (i * S) / n); g.lineTo(S, (i * S) / n); g.stroke();
            }
            g.fillStyle = 'rgba(255,255,255,.55)';
            g.fillRect(S / 8, S / 2 - 3 * k, S / 4, 6 * k);
            dots(g, S, 900 * k * k, 1.3 * k, ['rgba(60,60,60,.18)', 'rgba(255,255,255,.4)']);
        } },
        glass: { scale: 6, paint(g, S, k) {
            // curtain-wall towers: window bands and mullions
            g.fillStyle = '#d8dde2';
            g.fillRect(0, 0, S, S);
            const rows = 4;
            for (let r = 0; r < rows; r++) {
                const y = (r * S) / rows;
                const grd = g.createLinearGradient(0, y, 0, y + S / rows);
                grd.addColorStop(0, gray(150));
                grd.addColorStop(1, gray(205));
                g.fillStyle = grd;
                g.fillRect(0, y + 8 * k, S, S / rows - 16 * k);
                g.fillStyle = 'rgba(255,255,255,.75)';
                for (let c = 0; c < 6; c++) g.fillRect((c * S) / 6, y, 3 * k, S / rows);
            }
            overlay(g, S, NOISE_LO, 1, 0.12);
        } }
    };
    SURFACES.pavers.big = SURFACES.plaster.big = true;

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
    function paintSurfaces(size) {
        if (size === surfaceSize) return;
        surfaceSize = size;
        for (const spec of Object.values(SURFACES)) {
            const S = spec.big ? size : Math.min(size, 512);
            const c = document.createElement('canvas');
            c.width = c.height = S;
            spec.paint(c.getContext('2d'), S, S / 512);
            spec.tex.image = c;
            spec.tex.needsUpdate = true;
        }
    }
    const textureSize = () => ({ low: 256, mid: 512, high: 1024 }[prefs.q]);
    paintSurfaces(textureSize());

    function applyQuality() {
        const ratio = { low: 0.75, mid: 1.15, high: 1.6 }[prefs.q];
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ratio));
        const shadows = prefs.q !== 'low';
        if (renderer.shadowMap.enabled !== shadows) {
            renderer.shadowMap.enabled = shadows;
            sun.castShadow = shadows;
            scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
        }
        sun.shadow.mapSize.set(prefs.q === 'high' ? 2048 : 1024, prefs.q === 'high' ? 2048 : 1024);
        if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
        const aniso = prefs.q === 'low' ? 1 : Math.min(prefs.q === 'high' ? 8 : 4, renderer.capabilities.getMaxAnisotropy());
        textureAniso = aniso;
        allTextures.forEach((t) => { if (t.anisotropy !== aniso) { t.anisotropy = aniso; t.needsUpdate = true; } });
        paintSurfaces(textureSize());
        resize();
    }

    const matCache = {};
    function lam(color, surface = null) {
        const key = surface ? `${color}:${surface}` : color;
        if (!matCache[key]) {
            const m = new THREE.MeshLambertMaterial({ color: new THREE.Color(color).multiplyScalar(surface ? 1.1 : 1), map: surface ? SURFACES[surface].tex : null });
            m.userData.surface = surface;
            matCache[key] = m;
        }
        return matCache[key];
    }

    /* ---------- Haritalar (2 m hücreli ızgara; her harita bir karakter planı) ---------- */

    // # duvar · . zemin · k sandık · K üst üste sandık · M konteyner (2×2 hücre) · h alçak duvar · o sütun · p saksı/süs
    // Koordinatlar hücre: [sütun, satır]; bölge ve doğuş alanları [s0, r0, s1, r1].
    const MAPS = {
        liman: {
            name: 'Liman', tag: 'Akdeniz limanı · A/B', desc: 'Renkli sıva sokaklar, iki boğaz ve geniş bir orta alan.',
            grid: [
            '########################################',
            '##############............##############',
            '##############............##############',
            '####................................####',
            '####................................####',
            '####................................####',
            '####................................####',
            '####.....#########....#########.....####',
            '####.....#########....#########.....####',
            '####.....#########....#########.....####',
            '##............####k...####............##',
            '##..........K.####....####.K..........##',
            '##............####....####............##',
            '##......M.....####....####....M.......##',
            '##............##........##............##',
            '##............##........##............##',
            '##....................................##',
            '##.........k................k.........##',
            '##....................k...............##',
            '##..k.........##........##.........k..##',
            '##............##..####..##............##',
            '##............##........##............##',
            '###...########............########...###',
            '###...########..........k.########...###',
            '###.....######.....M......######.....###',
            '###.....######............######.....###',
            '###.....######.k..........######.....###',
            '###.....######............######.....###',
            '###K....######............######....K###',
            '###.....########........########.....###',
            '###..................................###',
            '###..............k...................###',
            '###.....########........########.....###',
            '###...k.########........########.k...###',
            '###.....########........########.....###',
            '###.....##########....##########.....###',
            '###.....##########....##########.....###',
            '###.....##########....##########.....###',
            '###.....##########....##########.....###',
            '###.....##########....##########.....###',
            '###..........#####....#####..........###',
            '###..........#####....#####..........###',
            '###......k...#####....#####...k......###',
            '###..........#####....#####..........###',
            '###..........#####....#####..........###',
            '###..........#####....#####..........###',
            '##########....................##########',
            '##########.p................p.##########',
            '##########....................##########',
            '##########....................##########',
            '##########....................##########',
            '##########....................##########',
            '##########....................##########',
            '##########....................##########',
            '##########....................##########',
            '########################################'
            ],
            sites: { A: [5, 12, 11, 18], B: [28, 12, 34, 18] },
            spawns: [[10, 46, 29, 54], [14, 1, 25, 6]],
            spawnPoints: [
                [[14, 50], [17, 51], [20, 50], [23, 51], [26, 50], [12, 52], [27, 52], [19, 53], [15, 53], [24, 53]],
                [[15, 3], [18, 4], [21, 3], [24, 4], [16, 5], [23, 5], [19, 2], [20, 5], [17, 2], [22, 2]]
            ],
            tactic: {
                A: { hold: [[5, 13], [12, 14], [9, 19], [6, 11]], watch: [[4, 22], [14, 17]], stage: [[5, 38], [5, 32]], entry: [4, 22], plant: [[7, 16], [10, 15], [6, 17]] },
                B: { hold: [[34, 13], [27, 14], [30, 19], [33, 11]], watch: [[35, 22], [25, 17]], stage: [[34, 38], [34, 32]], entry: [35, 22], plant: [[32, 16], [29, 15], [33, 17]] },
                mid: { hold: [[19, 17], [20, 21]], watch: [[19, 30]], stage: [[19, 38], [19, 32]] }
            },
            look: {
                sky: [0xf3dcc0, 0x5f9ad6], fog: [60, 170], sun: [0xffe2b8, 0.95], hemi: [0xfff4e6, 0x6b5a48, 0.78],
                floor: ['pavers', 0xf2e8d8, 16, 22], wall: 'plaster', cap: 0xf4eee4, low: 0xd8c9b2, pillar: 0xe8dccb,
                containers: [0xd9773f, 0x3f9aa0, 0x4a6fb5], mini: 'rgba(205,212,218,.8)',
                wallColor(x, z, outer) {
                    if (outer) return 0xb3a493;
                    if (z < -40) return 0xd6d0c4;
                    if (z > 34) return 0xe0c4a6;
                    if (x < -13) return 0xeed2a4;
                    if (x > 13) return 0xbcd3d6;
                    return 0xe8a684;
                }
            }
        },
        kumsaray: {
            name: 'Kumsaray', tag: 'Çöl kalesi · A/B', desc: 'Kumtaşı kale: uzun A koridoru, kapılı B ve ortada büyük bir avlu.',
            grid: [
            '########################################',
            '###############..........###############',
            '####...............................#####',
            '####...............................#####',
            '####...............................#####',
            '####...............................#####',
            '####.....#########....#########....#####',
            '####.....#########....#########....#####',
            '####.....#########....#####...........##',
            '####.....#########....#####.........K.##',
            '####.....#########....#####...........##',
            '####.....#########....#####....M......##',
            '##..........##............#...........##',
            '##.K........##.....p....K.#...........##',
            '##..........##........................##',
            '##...M......##...................hhh..##',
            '##..........##..hh..........k.........##',
            '##........k.##....####....#.......k...##',
            '##..........##....####....#...........##',
            '##.............M..........#######....###',
            '##.......k................#######....###',
            '##....................hh..#######....###',
            '##.....hhh..##.k..........#######....###',
            '##..........##......p.....#######....###',
            '##....########............#######....###',
            '##....############....###########..k.###',
            '##....############....###########....###',
            '##....############....###########....###',
            '##....############....###########....###',
            '##....############....#####..........###',
            '##........########..k.#####..........###',
            '##........########....#####..........###',
            '##........########....#####..........###',
            '##..k.############....#####..........###',
            '##....................######....########',
            '##....................######....########',
            '##....................######....########',
            '##....############..............########',
            '##.K..############...........k..########',
            '##....############..............########',
            '##....############....######....########',
            '##...........#####....######....########',
            '##...........#####....######....########',
            '##.....k.....#####....######....########',
            '##...........#####....######....########',
            '##########....................##########',
            '##########.p................p.##########',
            '##########....................##########',
            '##########....................##########',
            '##########....................##########',
            '##########....................##########',
            '##########....................##########',
            '##########....................##########',
            '##########....................##########',
            '##########....................##########',
            '########################################'
            ],
            sites: { A: [3, 13, 10, 21], B: [28, 9, 36, 17] },
            spawns: [[10, 45, 29, 54], [15, 1, 24, 5]],
            spawnPoints: [
                [[14, 49], [17, 50], [20, 49], [23, 50], [26, 49], [12, 51], [27, 51], [19, 52], [15, 52], [24, 52]],
                [[16, 2], [18, 3], [21, 2], [23, 3], [17, 4], [22, 4], [19, 1], [20, 4], [16, 5], [23, 5]]
            ],
            tactic: {
                A: { hold: [[4, 14], [10, 14], [8, 21], [3, 18]], watch: [[3, 24], [11, 20]], stage: [[3, 36], [3, 30]], entry: [3, 24], plant: [[6, 17], [8, 15], [5, 19]] },
                B: { hold: [[29, 10], [36, 12], [30, 17], [35, 16]], watch: [[34, 19], [27, 15]], stage: [[34, 26], [30, 31]], entry: [34, 19], plant: [[32, 14], [29, 12], [34, 13]] },
                mid: { hold: [[19, 14], [20, 20]], watch: [[19, 25]], stage: [[19, 40], [19, 32]] }
            },
            look: {
                sky: [0xf6d9a8, 0x6aa6d8], fog: [70, 180], sun: [0xffd7a0, 1.05], hemi: [0xfff0d8, 0x8a6a44, 0.72],
                floor: ['flagstone', 0xf0d9b0, 14, 20], wall: 'sandstone', cap: 0xf2dfbd, low: 0xc29a66, pillar: 0xe2c595,
                containers: [0x2f8f9d, 0xc0583a, 0x8a5fb0], mini: 'rgba(226,210,180,.82)',
                wallColor(x, z, outer) {
                    if (outer) return 0xc49a68;
                    if (z < -40) return 0xe9cfa3;
                    if (z > 32) return 0xdcb582;
                    if (x < -14) return 0xe8c48f;
                    if (x > 12) return 0xf0d6ae;
                    return 0xe3b57c;
                }
            }
        },
        ucyol: {
            name: 'Üçyol', tag: 'Teknopark · A/B/C', desc: 'Üç kurma bölgesi: savunma her yeri tutamaz, rotasyon her şeydir.',
            grid: [
            '########################################',
            '##############............##############',
            '###..................................###',
            '###..................................###',
            '###..................................###',
            '###..................................###',
            '###....###########....###########....###',
            '###....###########....###########....###',
            '###....###########....###########....###',
            '###....###########....###########....###',
            '##..........######....######..........##',
            '##.K........######....######........K.##',
            '##........k.###..........###..........##',
            '##...M......###........k.###....M.....##',
            '##..........###.hh.......###..........##',
            '##..........###...M......###..........##',
            '##.....hh...###..........###...hh.....##',
            '##..........###..........###..........##',
            '##.......k..###..........###.k........##',
            '##..........###.k.....K..###.......k..##',
            '##..........###..........###..........##',
            '##....##....###..........#########....##',
            '##....##....######....############....##',
            '##....##....######....############....##',
            '##....##....................######....##',
            '##....##.....hh.............######....##',
            '##....##...........k..................##',
            '##....##.......o........o.............##',
            '##....######..........................##',
            '##....######.............hh.######....##',
            '##..k.######................######....##',
            '##....########....################....##',
            '##....########....################....##',
            '##....########..k.################..K.##',
            '##....########....################....##',
            '##....########............########....##',
            '##....########............########....##',
            '##....########............########....##',
            '##....################....########....##',
            '##....################....########....##',
            '##..........##########....##..........##',
            '##..........##########.k..##..........##',
            '##....k.....##########....##.....k....##',
            '##..........##########....##..........##',
            '##..........##########....##..........##',
            '##########....................##########',
            '##########.p................p.##########',
            '##########....................##########',
            '##########....................##########',
            '##########....................##########',
            '##########....................##########',
            '##########....................##########',
            '##########....................##########',
            '##########....................##########',
            '##########....................##########',
            '########################################'
            ],
            sites: { A: [3, 11, 10, 19], B: [16, 13, 23, 20], C: [29, 11, 36, 19] },
            spawns: [[10, 45, 29, 54], [14, 1, 25, 5]],
            spawnPoints: [
                [[14, 49], [17, 50], [20, 49], [23, 50], [26, 49], [12, 51], [27, 51], [19, 52], [15, 52], [24, 52]],
                [[15, 2], [18, 3], [21, 2], [24, 3], [16, 4], [23, 4], [19, 1], [20, 4], [17, 5], [22, 5]]
            ],
            tactic: {
                A: { hold: [[4, 12], [10, 13], [9, 19], [3, 16]], watch: [[3, 21], [9, 21]], stage: [[3, 36], [3, 30]], entry: [3, 21], plant: [[6, 15], [8, 13], [5, 17]] },
                B: { hold: [[16, 13], [23, 14], [17, 20], [22, 17]], watch: [[19, 22], [19, 11]], stage: [[15, 32], [20, 28]], entry: [19, 22], plant: [[20, 17], [21, 15], [17, 18]] },
                C: { hold: [[29, 12], [35, 13], [30, 19], [36, 16]], watch: [[36, 21], [30, 27]], stage: [[35, 36], [36, 28]], entry: [36, 21], plant: [[31, 15], [34, 14], [33, 18]] },
                mid: { hold: [[19, 25], [20, 29]], watch: [[15, 33]], stage: [[24, 42], [15, 32]] }
            },
            look: {
                sky: [0xdfe8f0, 0x4f86c6], fog: [70, 190], sun: [0xfff4e4, 0.9], hemi: [0xeef4ff, 0x56606a, 0.8],
                floor: ['panel', 0xdde2e6, 14, 20], wall: 'concrete', cap: 0xf5f7f8, low: 0xb9c2c9, pillar: 0xd9dee2,
                containers: [0xf08a3c, 0x3cb7a8, 0x6a5acd], mini: 'rgba(214,222,230,.82)',
                wallColor(x, z, outer) {
                    if (outer) return 0x8f99a3;
                    if (z < -40) return 0xd5dbe0;
                    if (z > 30) return 0xc4ccd3;
                    if (x < -16) return 0xf2c49b;
                    if (x > 14) return 0xa8d8d2;
                    return 0xeef0f2;
                }
            }
        },
        buzul: {
            name: 'Buzul', tag: 'Kutup üssü · A/B', desc: 'A savunmaya, B saldırıya yakın; ortada sütunlu bir kubbe salonu.',
            grid: [
            '########################################',
            '###############..........###############',
            '#########............................###',
            '#########............................###',
            '#########............................###',
            '#########...###..........########....###',
            '#########...######....###########....###',
            '##............####....###########....###',
            '##.K..........####....###########....###',
            '##..........k.####....###########....###',
            '##...M........##.........########....###',
            '##............##..........#######....###',
            '##............##..........#######....###',
            '##....................................##',
            '##....hhh.........o...o..#..........K.##',
            '##........k..............#............##',
            '##............##..####...#....M.......##',
            '##............##.........#............##',
            '##....##########.........#............##',
            '##....##########..o...o..#............##',
            '##....##########.........#.......hhh..##',
            '##....##########.........#............##',
            '##....##########.........#.k..........##',
            '##....##########........##........k...##',
            '##.......#######.hh.....##............##',
            '##.......#######........########.....###',
            '##.......#######........########.....###',
            '##....############....##########.....###',
            '##....############....##########.....###',
            '##..k.############....##########..k..###',
            '##....############....##########.....###',
            '##....############.k..##########.....###',
            '##....############....####...........###',
            '##....###.............####...........###',
            '##....###.............####...........###',
            '##....###.............####...........###',
            '##.K..############....####....##########',
            '##....############....####....##########',
            '##....############....####....##########',
            '##....############....####....##########',
            '##..........######....####....##########',
            '##..........######....####.k..##########',
            '##..........######....####....##########',
            '##..........######....####....##########',
            '##..........######....####....##########',
            '##########....................##########',
            '##########.p................p.##########',
            '##########....................##########',
            '##########....................##########',
            '##########....................##########',
            '##########....................##########',
            '##########....................##########',
            '##########....................##########',
            '##########....................##########',
            '##########....................##########',
            '########################################'
            ],
            sites: { A: [3, 8, 12, 16], B: [27, 14, 36, 23] },
            spawns: [[10, 45, 29, 54], [15, 1, 24, 5]],
            spawnPoints: [
                [[14, 49], [17, 50], [20, 49], [23, 50], [26, 49], [12, 51], [27, 51], [19, 52], [15, 52], [24, 52]],
                [[16, 2], [18, 3], [21, 2], [23, 3], [17, 4], [22, 4], [19, 1], [20, 4], [16, 5], [23, 5]]
            ],
            tactic: {
                A: { hold: [[4, 9], [12, 10], [10, 16], [3, 13]], watch: [[3, 18], [14, 14]], stage: [[3, 34], [3, 28]], entry: [3, 18], plant: [[7, 11], [9, 12], [5, 13]] },
                B: { hold: [[28, 14], [36, 16], [29, 23], [35, 22]], watch: [[34, 25], [25, 12]], stage: [[34, 30], [28, 34]], entry: [34, 25], plant: [[32, 18], [29, 19], [33, 17]] },
                mid: { hold: [[20, 12], [20, 21]], watch: [[20, 26]], stage: [[20, 40], [20, 33]] }
            },
            look: {
                sky: [0xe6eef5, 0x8fb3d9], fog: [45, 150], sun: [0xf2f6ff, 0.85], hemi: [0xf4f8ff, 0x6a7a8c, 0.9],
                floor: ['snow', 0xf6f9fc, 12, 18], wall: 'concrete', cap: 0xffffff, low: 0xc6d2dc, pillar: 0xd0dae3,
                containers: [0xe0703a, 0x3a7bd5, 0xd8b23a], mini: 'rgba(225,234,242,.85)', snow: true,
                wallColor(x, z, outer) {
                    if (outer) return 0x9aa9b6;
                    if (z < -40) return 0xd8e2ea;
                    if (z > 30) return 0xc2ced8;
                    if (x < -14) return 0xbfd0de;
                    if (x > 12) return 0xd6dde4;
                    return 0xe7c9b0;
                }
            }
        }
    };
    const MAP_IDS = Object.keys(MAPS);

    const solids = []; // çarpışma kutuları; off = kapalı, barrier = yalnızca yürümeyi keser
    const occluders = []; // oyuncu mermisinin durduğu meshler
    const cellGrid = Array.from({ length: ROWS }, () => new Array(COLS).fill(1));
    const SITES = {};
    const SPAWN_AREAS = [null, null];
    const barriers = [];
    const SPAWN_POINTS = [[], []];
    const TACTIC = {};
    let mapId = '';
    let mapLook = MAPS.liman.look;
    let mapGroup = null;
    const mapStatics = []; // birleştirilmeden önceki meshler (ışın testleri için sahne dışında tutulur)
    const mapOwned = []; // haritaya özel malzeme ve dokular
    const siteNames = () => Object.keys(SITES);
    const inSite = (x, z) => Object.values(SITES).find((s) => x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1) || null;
    const inSpawn = (side, x, z) => { const a = SPAWN_AREAS[side]; return Boolean(a) && x > a.x0 && x < a.x1 && z > a.z0 && z < a.z1; };
    const cellRect = ([c0, r0, c1, r1]) => ({ x0: cellX(c0) - CELL / 2, x1: cellX(c1) + CELL / 2, z0: cellZ(r0) - CELL / 2, z1: cellZ(r1) + CELL / 2 });
    const P = (c, r) => ({ x: cellX(c), z: cellZ(r) });

    function addSolid(x0, x1, z0, z1, y0, y1, extra) {
        const s = { x0, x1, z0, z1, y0, y1, ...extra };
        solids.push(s);
        return s;
    }
    function box(cx, y0, cz, w, h, d, material, opts = {}) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
        m.position.set(cx, y0 + h / 2, cz);
        if (opts.ry) m.rotation.y = opts.ry;
        m.userData.static = true;
        mapGroup.add(m);
        if (!opts.deco) {
            occluders.push(m);
            addSolid(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, y0, y0 + h);
        }
        return m;
    }
    // Any other static shape (domes, trunks, mountains); decorative unless given a collision box.
    function deco(geo, material, x, y, z, rot) {
        const m = new THREE.Mesh(geo, material);
        m.position.set(x, y, z);
        if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
        m.userData.static = true;
        mapGroup.add(m);
        return m;
    }

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(COLS * CELL, ROWS * CELL), new THREE.MeshLambertMaterial({ map: SURFACES.pavers.tex, color: 0xf2e8d8 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    function decalTexture(draw, w = 512, h = 512) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        draw(c.getContext('2d'), w, h);
        const tex = new THREE.CanvasTexture(c);
        tex.anisotropy = 4;
        return tex;
    }
    function plane(w, h, tex, x, y, z, rx, ry) {
        const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
        mapOwned.push(mat, tex);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
        m.position.set(x, y, z);
        m.rotation.set(rx || 0, ry || 0, 0);
        m.receiveShadow = true;
        mapGroup.add(m);
        return m;
    }

    // Spawn barriers stand during the buy phase; they stop movement, not sight.
    const barrierMat = new THREE.MeshBasicMaterial({
        map: decalTexture((g, w, h) => {
            g.fillStyle = 'rgba(255,255,255,.12)';
            g.fillRect(0, 0, w, h);
            g.strokeStyle = 'rgba(255,255,255,.6)';
            g.lineWidth = 2;
            const s = 32;
            for (let y = 0; y < h + s; y += s * 0.86) {
                for (let x = (Math.round(y / (s * 0.86)) % 2) * s / 2; x < w + s; x += s) {
                    g.beginPath();
                    for (let k = 0; k < 6; k++) g.lineTo(x + Math.cos(k * Math.PI / 3) * s * 0.5, y + Math.sin(k * Math.PI / 3) * s * 0.5);
                    g.closePath();
                    g.stroke();
                }
            }
        }, 256, 256),
        color: 0xffa36b, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false
    });
    barrierMat.map.wrapS = barrierMat.map.wrapT = THREE.RepeatWrapping;
    let barriersUp = false;
    function setBarriers(up) {
        barriersUp = up;
        for (const b of barriers) { b.mesh.visible = up; b.solid.off = !up; }
    }

    // The sky dome's vertex colours, fog, sun and fill light follow the map.
    function applyLook(look) {
        mapLook = look;
        const [horizon, top] = look.sky;
        scene.background.setHex(horizon);
        scene.fog.color.setHex(horizon);
        [scene.fog.near, scene.fog.far] = look.fog;
        sun.color.setHex(look.sun[0]);
        sun.intensity = look.sun[1];
        hemi.color.setHex(look.hemi[0]);
        hemi.groundColor.setHex(look.hemi[1]);
        hemi.intensity = look.hemi[2];
        const pos = skyDome.geometry.attributes.position;
        const col = skyDome.geometry.attributes.color;
        const t = new THREE.Color(top);
        const h = new THREE.Color(horizon);
        const c = new THREE.Color();
        for (let i = 0; i < pos.count; i++) {
            c.copy(h).lerp(t, Math.pow(Math.max(0, pos.getY(i) / 300), 0.5));
            col.setXYZ(i, c.r, c.g, c.b);
        }
        col.needsUpdate = true;
        const [surface, color, rx, rz] = look.floor;
        floor.material.map = SURFACES[surface].tex;
        floor.material.color.setHex(color);
        floor.material.needsUpdate = true;
        SURFACES[surface].tex.repeat.set(rx, rz);
    }

    function clearMap() {
        if (mapGroup) {
            scene.remove(mapGroup);
            mapGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
        }
        for (const m of mapStatics) m.geometry.dispose();
        for (const o of mapOwned) o.dispose();
        mapStatics.length = 0;
        mapOwned.length = 0;
        solids.length = 0;
        occluders.length = 0;
        barriers.length = 0;
        for (const k of Object.keys(SITES)) delete SITES[k];
        for (const k of Object.keys(TACTIC)) delete TACTIC[k];
        snowField = null;
        mapGroup = new THREE.Group();
        scene.add(mapGroup);
    }

    const charAt = (def, c, r) => (r >= 0 && r < ROWS && c >= 0 && c < COLS ? def.grid[r][c] : '#');
    const isOpen = (ch) => ch !== '#' && ch !== 'o';

    function buildMap(id) {
        const def = MAPS[id] || MAPS.liman;
        if (mapId === id) return;
        mapId = MAPS[id] ? id : 'liman';
        clearMap();
        const look = def.look;
        applyLook(look);
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) cellGrid[r][c] = def.grid[r][c] === '#' ? 1 : 0;

        for (const [k, rect] of Object.entries(def.sites)) SITES[k] = { name: k, ...cellRect(rect), cells: rect };
        def.spawns.forEach((rect, side) => { SPAWN_AREAS[side] = cellRect(rect); });
        def.spawnPoints.forEach((list, side) => { SPAWN_POINTS[side] = list.map(([c, r]) => P(c, r)); });
        const pts = (list) => list.map(([c, r]) => P(c, r));
        for (const [k, t] of Object.entries(def.tactic)) {
            TACTIC[k] = { hold: pts(t.hold), watch: pts(t.watch), stage: pts(t.stage) };
            if (t.entry) TACTIC[k].entry = P(t.entry[0], t.entry[1]);
            if (t.plant) TACTIC[k].plant = pts(t.plant);
        }

        // Walls: greedy rectangles over wall cells, coloured by area so every lane reads differently.
        const used = cellGrid.map((row) => row.map(() => false));
        const wallAt = (c, r) => r >= 0 && r < ROWS && c >= 0 && c < COLS && cellGrid[r][c] === 1 && !used[r][c];
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (!wallAt(c, r)) continue;
                let w = 1;
                while (wallAt(c + w, r)) w++;
                let h = 1;
                while (r + h < ROWS && Array.from({ length: w }, (_, i) => wallAt(c + i, r + h)).every(Boolean)) h++;
                for (let rr = r; rr < r + h; rr++) for (let cc = c; cc < c + w; cc++) used[rr][cc] = true;
                const x = (c - COLS / 2) * CELL + (w * CELL) / 2;
                const z = (r - ROWS / 2) * CELL + (h * CELL) / 2;
                const outer = c === 0 || r === 0 || c + w === COLS || r + h === ROWS;
                const color = look.wallColor(x, z, outer);
                const height = outer ? WALL_H + 2 : WALL_H;
                box(x, 0, z, w * CELL, height, h * CELL, lam(color, look.wall));
                box(x, 0, z, w * CELL + 0.12, 0.55, h * CELL + 0.12, lam(new THREE.Color(color).multiplyScalar(0.62).getHex(), 'trim'), { deco: true });
                box(x, height, z, w * CELL + 0.3, 0.3, h * CELL + 0.3, lam(look.cap, 'trim'), { deco: true });
            }
        }

        // Cover and props from the plan's letters.
        const crateMat = lam(0xc49a62, 'crate');
        let container = 0;
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const ch = def.grid[r][c];
                const x = cellX(c);
                const z = cellZ(r);
                if (ch === 'k') box(x, 0, z, 1.6, 1.2, 1.6, crateMat);
                else if (ch === 'K') { box(x, 0, z, 1.7, 1.25, 1.7, crateMat); box(x + 0.05, 1.25, z - 0.05, 1.5, 1.2, 1.5, crateMat); }
                else if (ch === 'M') box(x + 1, 0, z + 1, 3.6, 2.6, 3.6, lam(look.containers[container++ % look.containers.length], 'metal'));
                else if (ch === 'h') { box(x, 0, z, CELL, 1.05, CELL, lam(look.low, look.wall)); box(x, 1.05, z, CELL + 0.16, 0.12, CELL + 0.16, lam(look.cap, 'trim'), { deco: true }); }
                else if (ch === 'o') { box(x, 0, z, 0.9, WALL_H, 0.9, lam(look.pillar, 'concrete')); box(x, 0, z, 1.2, 0.4, 1.2, lam(look.cap, 'trim'), { deco: true }); }
                else if (ch === 'p') SCENERY[mapId].prop(x, z);
            }
        }

        // Painted plant zones and a big letter on the nearest wall above each site.
        for (const site of Object.values(SITES)) {
            const w = site.x1 - site.x0;
            const d = site.z1 - site.z0;
            const tex = decalTexture((g, W2, H2) => {
                g.fillStyle = 'rgba(255,90,70,.07)';
                g.fillRect(0, 0, W2, H2);
                g.strokeStyle = 'rgba(255,92,72,.85)';
                g.lineWidth = 10;
                g.setLineDash([34, 18]);
                g.strokeRect(8, 8, W2 - 16, H2 - 16);
                g.setLineDash([]);
                g.font = '900 230px Teko, Impact, sans-serif';
                g.textAlign = 'center';
                g.textBaseline = 'middle';
                g.fillStyle = 'rgba(255,92,72,.16)';
                g.fillText(site.name, W2 / 2, H2 / 2 + 10);
            });
            plane(w, d, tex, (site.x0 + site.x1) / 2, 0.025, (site.z0 + site.z1) / 2, -Math.PI / 2);
            const spot = letterSpot(def, site.cells);
            if (spot) {
                const letter = decalTexture((g, W2, H2) => {
                    g.font = '900 420px Teko, Impact, sans-serif';
                    g.textAlign = 'center';
                    g.textBaseline = 'middle';
                    g.fillStyle = 'rgba(30,30,40,.18)';
                    g.fillText(site.name, W2 / 2 + 10, H2 / 2 + 30);
                    g.fillStyle = '#ff5a48';
                    g.fillText(site.name, W2 / 2, H2 / 2 + 20);
                    overlay(g, W2, NOISE_HI, 3, 0.35, 'destination-out');
                });
                plane(3.6, 3.6, letter, spot.x, 3.4, spot.z, 0, spot.ry);
            }
        }

        // Barriers close every opening on the edge of each spawn rectangle.
        def.spawns.forEach(([c0, r0, c1, r1], side) => {
            const runs = [];
            const scan = (cells, outside, make) => {
                let start = null;
                cells.forEach((cell, i) => {
                    const open = isOpen(charAt(def, cell[0], cell[1])) && isOpen(charAt(def, outside(cell)[0], outside(cell)[1]));
                    if (open && start === null) start = i;
                    if ((!open || i === cells.length - 1) && start !== null) { runs.push(make(cells[start], cells[open ? i : i - 1])); start = null; }
                });
            };
            const span = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
            scan(span(c0, c1).map((c) => [c, r0]), ([c, r]) => [c, r - 1], (a, b) => [cellX(a[0]) - 1, cellX(b[0]) + 1, cellZ(r0) - 1, cellZ(r0) - 1]);
            scan(span(c0, c1).map((c) => [c, r1]), ([c, r]) => [c, r + 1], (a, b) => [cellX(a[0]) - 1, cellX(b[0]) + 1, cellZ(r1) + 1, cellZ(r1) + 1]);
            scan(span(r0, r1).map((r) => [c0, r]), ([c, r]) => [c - 1, r], (a, b) => [cellX(c0) - 1, cellX(c0) - 1, cellZ(a[1]) - 1, cellZ(b[1]) + 1]);
            scan(span(r0, r1).map((r) => [c1, r]), ([c, r]) => [c + 1, r], (a, b) => [cellX(c1) + 1, cellX(c1) + 1, cellZ(a[1]) - 1, cellZ(b[1]) + 1]);
            for (const [x0, x1, z0, z1] of runs) {
                const len = Math.max(x1 - x0, z1 - z0);
                const mesh = new THREE.Mesh(new THREE.PlaneGeometry(len, WALL_H), barrierMat);
                mesh.position.set((x0 + x1) / 2, WALL_H / 2, (z0 + z1) / 2);
                if (x0 === x1) mesh.rotation.y = Math.PI / 2;
                mapGroup.add(mesh);
                const solid = addSolid(x0 - 0.15, x1 + 0.15, z0 - 0.15, z1 + 0.15, 0, WALL_H, { barrier: true });
                barriers.push({ side, mesh, solid });
            }
        });
        setBarriers(barriersUp);

        SCENERY[mapId].skyline(mulberry32(77 + mapId.length));
        mergeStatic();
        buildNav();
        drawMiniBase();
    }

    // The closest wall face above (or below) the site, wide enough for a 3.6 m letter.
    function letterSpot(def, [c0, r0, c1, r1]) {
        const mid = Math.round((c0 + c1) / 2);
        const wall = (c, r) => charAt(def, c, r) === '#';
        let best = null;
        for (const dc of [0, 1, -1, 2, -2, 3, -3]) {
            const c = mid + dc;
            for (let r = r0 - 1; r >= Math.max(0, r0 - 7); r--) {
                if (!wall(c, r)) continue;
                const dist = r0 - r + Math.abs(dc) * 0.5;
                if (wall(c - 1, r) && wall(c + 1, r) && isOpen(charAt(def, c, r + 1)) && (!best || dist < best.dist)) best = { dist, x: cellX(c), z: cellZ(r) + CELL / 2 + 0.03, ry: 0 };
                break;
            }
            for (let r = r1 + 1; r <= Math.min(ROWS - 1, r1 + 7); r++) {
                if (!wall(c, r)) continue;
                const dist = r - r1 + Math.abs(dc) * 0.5 + 0.25;
                if (wall(c - 1, r) && wall(c + 1, r) && isOpen(charAt(def, c, r - 1)) && (!best || dist < best.dist)) best = { dist, x: cellX(c), z: cellZ(r) - CELL / 2 - 0.03, ry: Math.PI };
                break;
            }
        }
        return best;
    }

    /* ---------- Harita görünümleri: dış manzara ve süs eşyaları ---------- */

    const bushGeo = new THREE.SphereGeometry(0.75, 8, 6);
    let snowField = null;
    const SCENERY = {
        liman: {
            // Rooftops and a bell tower make the skyline of a harbour town.
            skyline(r) {
                const roof = lam(0xc8643c, 'tile');
                ring(r, 46, (x, z) => {
                    const w = 6 + r() * 8;
                    const d = 6 + r() * 8;
                    const h = 8 + r() * 12;
                    const color = [0xf0dcc0, 0xe8c9a4, 0xdfe6e4, 0xf2e2cf, 0xe6b894][Math.floor(r() * 5)];
                    box(x, 0, z, w, h, d, lam(color, 'plaster'), { deco: true });
                    box(x, h, z, w + 0.8, 0.5, d + 0.8, roof, { deco: true });
                });
                box(-HALF_X - 14, 0, -10, 6, 30, 6, lam(0xead5b4, 'plaster'), { deco: true });
                box(-HALF_X - 14, 30, -10, 7, 1, 7, lam(0xf4eee4, 'trim'), { deco: true });
                box(-HALF_X - 14, 31, -10, 4, 5, 4, roof, { deco: true });
                const awning = lam(0xd6603c, 'tile');
                const awning2 = lam(0x3f9aa0, 'tile');
                [[cellX(5), cellZ(30), 0], [cellX(34), cellZ(30), 1], [cellX(19.5), cellZ(46) - 1, 0], [cellX(19.5), cellZ(2), 1]].forEach(([x, z, alt]) => {
                    box(x, 3.4, z, 6, 0.25, 2.2, alt ? awning2 : awning, { deco: true });
                });
            },
            prop(x, z) {
                box(x, 0, z, 1.1, 0.7, 1.1, lam(0xb5643e, 'trim'));
                deco(bushGeo, lam(0x4f8a3c, 'leaves'), x, 1.15, z);
            }
        },
        kumsaray: {
            // Sandstone houses, white domes and two watchtowers behind the citadel walls.
            skyline(r) {
                const dome = new THREE.SphereGeometry(1, 16, 8, 0, TAU, 0, Math.PI / 2);
                ring(r, 40, (x, z) => {
                    const w = 7 + r() * 9;
                    const d = 7 + r() * 9;
                    const h = 6 + r() * 10;
                    const color = [0xe9cfa3, 0xdcb582, 0xf0dcc0, 0xd8a96e][Math.floor(r() * 4)];
                    box(x, 0, z, w, h, d, lam(color, 'sandstone'), { deco: true });
                    box(x, h, z, w + 0.4, 0.4, d + 0.4, lam(0xf2dfbd, 'trim'), { deco: true });
                    if (r() < 0.35) {
                        const s = Math.min(w, d) * 0.38;
                        const m = deco(dome, lam(r() < 0.5 ? 0xf6f1e6 : 0x3aa6a0, 'plaster'), x, h + 0.4, z);
                        m.scale.set(s, s * 0.9, s);
                    }
                });
                for (const [x, z] of [[-HALF_X - 12, 18], [HALF_X + 12, -24]]) {
                    box(x, 0, z, 5, 26, 5, lam(0xe3c08a, 'sandstone'), { deco: true });
                    box(x, 26, z, 6.4, 1, 6.4, lam(0xf2dfbd, 'trim'), { deco: true });
                    for (const [dx, dz] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) box(x + dx, 27, z + dz, 1.2, 1.4, 1.2, lam(0xe3c08a, 'sandstone'), { deco: true });
                }
                // Striped cloth shades over the courtyard.
                const cloth = [lam(0xc0583a, 'tile'), lam(0x2f8f9d, 'tile')];
                [[cellX(16), cellZ(18)], [cellX(23), cellZ(14)], [cellX(3), cellZ(31)], [cellX(34), cellZ(31)]].forEach(([x, z], i) => box(x, 3.6, z, 5, 0.18, 2.6, cloth[i % 2], { deco: true }));
            },
            // Palm in a stone pot.
            prop(x, z) {
                box(x, 0, z, 1.2, 0.8, 1.2, lam(0xd9b27c, 'sandstone'));
                deco(new THREE.CylinderGeometry(0.14, 0.2, 4.2, 6), lam(0x8a6a44, 'crate'), x, 2.9, z);
                const frond = new THREE.BoxGeometry(2.4, 0.06, 0.55);
                frond.translate(1.2, 0, 0);
                for (let i = 0; i < 7; i++) deco(frond, lam(0x5c8f3a, 'leaves'), x, 5, z, [0, (i / 7) * TAU, -0.35]);
            }
        },
        ucyol: {
            // Glass towers and a skybridge: a modern technology campus.
            skyline(r) {
                ring(r, 30, (x, z) => {
                    const w = 8 + r() * 8;
                    const d = 8 + r() * 8;
                    const h = 18 + r() * 30;
                    box(x, 0, z, w, h, d, lam([0x9fb4c8, 0xb8c7d4, 0x7f97ad, 0xc9d3dc][Math.floor(r() * 4)], 'glass'), { deco: true });
                    box(x, h, z, w + 0.5, 0.6, d + 0.5, lam(0xe9edf0, 'trim'), { deco: true });
                });
                box(0, 14, -HALF_Z - 9, 30, 3, 4, lam(0xe9edf0, 'concrete'), { deco: true });
                // Coloured stripes mark which site a lane leads to.
                const stripe = (x, z, w, d, color) => box(x, 2.6, z, w, 0.4, d, lam(color, 'trim'), { deco: true });
                stripe(cellX(1) + 1.05, cellZ(30), 0.1, 24, 0xf08a3c);
                stripe(cellX(38) - 1.05, cellZ(30), 0.1, 24, 0x3cb7a8);
            },
            // Concrete planter with a round tree.
            prop(x, z) {
                box(x, 0, z, 1.4, 0.6, 1.4, lam(0xc4ccd3, 'concrete'));
                deco(new THREE.CylinderGeometry(0.08, 0.1, 1.6, 6), lam(0x6b5a48, 'crate'), x, 1.4, z);
                deco(bushGeo, lam(0x5aa04a, 'leaves'), x, 2.4, z);
            }
        },
        buzul: {
            // Snowy peaks, radio masts and a dish around the research base.
            skyline(r) {
                const peak = new THREE.ConeGeometry(1, 1, 7);
                ring(r, 22, (x, z) => {
                    const s = 14 + r() * 18;
                    const m = deco(peak, lam(r() < 0.5 ? 0xf2f6fa : 0xdde6ee, 'snow'), x * 1.25, s * 0.5, z * 1.15, [0, r() * TAU, 0]);
                    m.scale.set(s, s * (0.9 + r() * 0.8), s);
                });
                const mast = lam(0xe0703a, 'metal');
                for (const [x, z] of [[-HALF_X - 8, -30], [HALF_X + 8, 10], [-HALF_X - 8, 40]]) {
                    deco(new THREE.CylinderGeometry(0.25, 0.4, 22, 6), mast, x, 11, z);
                    box(x, 22, z, 2, 0.3, 2, lam(0xffffff, 'trim'), { deco: true });
                }
                const dish = deco(new THREE.SphereGeometry(5, 16, 8, 0, TAU, 0, Math.PI / 3), lam(0xf4f6f8, 'metal'), HALF_X + 14, 9, -HALF_Z + 10, [-0.9, -0.6, 0]);
                dish.scale.set(1, 0.5, 1);
                box(HALF_X + 14, 0, -HALF_Z + 10, 1.5, 8, 1.5, lam(0xb0bcc8, 'metal'), { deco: true });
                // Orange hazard bands on the base walls.
                for (const [x, z, w, d] of [[cellX(19.5), cellZ(44) + 1.06, 8, 0.1], [cellX(19.5), cellZ(6) - 1.06, 8, 0.1]]) box(x, 1.4, z, w, 0.5, d, lam(0xe0703a, 'trim'), { deco: true });
                snowField = makeSnow();
                mapGroup.add(snowField);
            },
            // Two fuel barrels.
            prop(x, z) {
                const barrel = new THREE.CylinderGeometry(0.42, 0.42, 1.2, 10);
                deco(barrel, lam(0xe0703a, 'metal'), x - 0.35, 0.6, z);
                deco(barrel, lam(0x3a7bd5, 'metal'), x + 0.4, 0.6, z + 0.2);
                addSolid(x - 0.8, x + 0.85, z - 0.45, z + 0.65, 0, 1.2);
            }
        }
    };

    // Places `count` scenery pieces in a ring just outside the outer wall.
    function ring(r, count, place) {
        for (let i = 0; i < count; i++) {
            const side = i % 4;
            const t = r() * 2 - 1;
            let x = 0;
            let z = 0;
            if (side === 0) { x = t * (HALF_X + 10); z = -HALF_Z - 6 - r() * 10; }
            if (side === 1) { x = t * (HALF_X + 10); z = HALF_Z + 6 + r() * 10; }
            if (side === 2) { z = t * (HALF_Z + 10); x = -HALF_X - 6 - r() * 10; }
            if (side === 3) { z = t * (HALF_Z + 10); x = HALF_X + 6 + r() * 10; }
            place(x, z);
        }
    }

    // Falling snow on Buzul: one draw call, wrapped around the camera each frame.
    function makeSnow() {
        const n = 1400;
        const pos = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { pos[i * 3] = rand(-30, 30); pos[i * 3 + 1] = rand(0, 18); pos[i * 3 + 2] = rand(-30, 30); }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, opacity: 0.85, depthWrite: false });
        mapOwned.push(mat);
        const pts = new THREE.Points(geo, mat);
        pts.frustumCulled = false;
        pts.raycast = () => {};
        return pts;
    }
    function tickMap(dt, now) {
        if (!snowField) return;
        const pos = snowField.geometry.attributes.position;
        const cx = camera.position.x;
        const cz = camera.position.z;
        for (let i = 0; i < pos.count; i++) {
            let y = pos.getY(i) - dt * 1.6;
            let x = pos.getX(i) + Math.sin(now / 1500 + i) * dt * 0.4;
            let z = pos.getZ(i);
            if (y < 0) y += 18;
            if (x - cx > 30) x -= 60; else if (x - cx < -30) x += 60;
            if (z - cz > 30) z -= 60; else if (z - cz < -30) z += 60;
            pos.setXYZ(i, x, y, z);
        }
        pos.needsUpdate = true;
    }

    // ~1000 static meshes become one draw call per material; the originals leave the scene with
    // frozen matrices so the player's bullets can still raycast against them.
    function mergeStatic() {
        const byMaterial = new Map();
        for (const m of [...mapGroup.children]) {
            if (!m.isMesh || !m.userData.static) continue;
            m.updateMatrixWorld(true);
            if (!byMaterial.has(m.material)) byMaterial.set(m.material, []);
            byMaterial.get(m.material).push(m);
            mapGroup.remove(m);
            mapStatics.push(m);
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
                pos.set(g.attributes.position.array, o * 3);
                nor.set(g.attributes.normal.array, o * 3);
                if (spec && spec.box && g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
                o += g.attributes.position.count;
                g.dispose();
            }
            if (spec && !spec.box) {
                for (let i = 0; i < count; i++) {
                    const ax = Math.abs(nor[i * 3]);
                    const ay = Math.abs(nor[i * 3 + 1]);
                    const az = Math.abs(nor[i * 3 + 2]);
                    const x = pos[i * 3];
                    const y = pos[i * 3 + 1];
                    const z = pos[i * 3 + 2];
                    const [u, v] = ay >= ax && ay >= az ? [x, z] : ax >= az ? [z, y] : [x, y];
                    uv[i * 2] = u / (spec.scale || 2);
                    uv[i * 2 + 1] = v / (spec.scale || 2);
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
            mapGroup.add(mesh);
        }
    }

    /* ---------- Çarpışma ve ışın testleri ---------- */

    function blocked(x, z, fy) {
        for (const s of solids) {
            if (s.off) continue;
            if (x + R > s.x0 && x - R < s.x1 && z + R > s.z0 && z - R < s.z1 && s.y1 > fy + 0.45 && s.y0 < fy + 1.6) return true;
        }
        return false;
    }
    function groundAt(x, z, fy) {
        let g = 0;
        for (const s of solids) {
            if (s.off || s.barrier) continue;
            if (x + R * 0.8 > s.x0 && x - R * 0.8 < s.x1 && z + R * 0.8 > s.z0 && z - R * 0.8 < s.z1 && s.y1 <= fy + 0.5 && s.y1 > g) g = s.y1;
        }
        return g;
    }
    function ceilingAt(x, z, fy, h) {
        for (const s of solids) {
            if (s.off || s.barrier) continue;
            if (x + R * 0.8 > s.x0 && x - R * 0.8 < s.x1 && z + R * 0.8 > s.z0 && z - R * 0.8 < s.z1 && s.y0 >= fy + 1 && s.y0 < fy + h + 0.2) return s.y0;
        }
        return null;
    }
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
            if (s.off || s.barrier) continue;
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
    // Smokes hide whoever is inside or behind them (bullets still pass, as in the genre).
    function smokeBlocks(ax, ay, az, bx, by, bz) {
        for (const z of zones) {
            if (z.kind !== 'smoke') continue;
            const dx = bx - ax;
            const dy = by - ay;
            const dz = bz - az;
            const len2 = dx * dx + dy * dy + dz * dz || 1;
            const t = clamp(((z.x - ax) * dx + (z.y - ay) * dy + (z.z - az) * dz) / len2, 0, 1);
            const px = ax + dx * t - z.x;
            const py = ay + dy * t - z.y;
            const pz = az + dz * t - z.z;
            if (px * px + py * py + pz * pz < z.r * z.r * 0.8) return true;
        }
        return false;
    }
    const canSee = (ax, ay, az, bx, by, bz) => !segmentBlocked(ax, ay, az, bx, by, bz) && !smokeBlocks(ax, ay, az, bx, by, bz);

    /* ---------- Bot gezinme ızgarası (1 m hücre, A*) ---------- */

    const GW = COLS * CELL;
    const GH = ROWS * CELL;
    const nav = new Uint8Array(GW * GH);
    function buildNav() {
        nav.fill(0);
        for (const s of solids) {
            if (s.barrier || s.y0 > 1.5 || s.y1 < 0.45) continue;
            const m = R + 0.12;
            for (let cx = Math.max(0, Math.floor(s.x0 - m + HALF_X)); cx <= Math.min(GW - 1, Math.floor(s.x1 + m + HALF_X)); cx++) {
                for (let cz = Math.max(0, Math.floor(s.z0 - m + HALF_Z)); cz <= Math.min(GH - 1, Math.floor(s.z1 + m + HALF_Z)); cz++) {
                    const x = cx - HALF_X + 0.5;
                    const z = cz - HALF_Z + 0.5;
                    if (x > s.x0 - m && x < s.x1 + m && z > s.z0 - m && z < s.z1 + m) nav[cz * GW + cx] = 1;
                }
            }
        }
    }
    const navIndex = (x, z) => clamp(Math.floor(z + HALF_Z), 0, GH - 1) * GW + clamp(Math.floor(x + HALF_X), 0, GW - 1);
    const navCenter = (i) => ({ x: (i % GW) - HALF_X + 0.5, z: Math.floor(i / GW) - HALF_Z + 0.5 });
    const gScore = new Float32Array(GW * GH);
    const cameFrom = new Int32Array(GW * GH);
    const stamp = new Int32Array(GW * GH);
    const closedStamp = new Int32Array(GW * GH);
    let searchId = 0;

    function nearestFree(i) {
        if (!nav[i]) return i;
        const cx = i % GW;
        const cz = Math.floor(i / GW);
        for (let r = 1; r < 6; r++) {
            for (let dz = -r; dz <= r; dz++) {
                for (let dx = -r; dx <= r; dx++) {
                    const x = cx + dx;
                    const z = cz + dz;
                    if (x >= 0 && z >= 0 && x < GW && z < GH && !nav[z * GW + x]) return z * GW + x;
                }
            }
        }
        return -1;
    }
    function lineWalkable(ax, az, bx, bz) {
        const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.4);
        for (let k = 1; k <= steps; k++) if (nav[navIndex(lerp(ax, bx, k / steps), lerp(az, bz, k / steps))]) return false;
        return true;
    }
    function findPath(sx, sz, gx, gz) {
        const start = nearestFree(navIndex(sx, sz));
        const goal = nearestFree(navIndex(gx, gz));
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
        const gxC = goal % GW;
        const gzC = Math.floor(goal / GW);
        const h = (i) => {
            const dx = Math.abs((i % GW) - gxC);
            const dz = Math.abs(Math.floor(i / GW) - gzC);
            return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
        };
        stamp[start] = searchId;
        gScore[start] = 0;
        cameFrom[start] = -1;
        push(h(start), start);
        let expanded = 0;
        while (heap.length && expanded < 9000) {
            const [, cur] = pop();
            if (closedStamp[cur] === searchId) continue;
            closedStamp[cur] = searchId;
            if (cur === goal) break;
            expanded++;
            const cx = cur % GW;
            const cz = Math.floor(cur / GW);
            for (let dz = -1; dz <= 1; dz++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (!dx && !dz) continue;
                    const nx = cx + dx;
                    const nz = cz + dz;
                    if (nx < 0 || nz < 0 || nx >= GW || nz >= GH) continue;
                    const n = nz * GW + nx;
                    if (nav[n] || closedStamp[n] === searchId) continue;
                    if (dx && dz && (nav[cz * GW + nx] || nav[nz * GW + cx])) continue;
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
        const pts = cells.map(navCenter);
        const out = [];
        let anchor = { x: sx, z: sz };
        let i = 0;
        while (i < pts.length) {
            let j = Math.min(pts.length - 1, i + 10);
            while (j > i && !lineWalkable(anchor.x, anchor.z, pts[j].x, pts[j].z)) j--;
            out.push(pts[j]);
            anchor = pts[j];
            i = j + 1;
        }
        return out;
    }

    /* ---------- Silahlar ve modeller ---------- */

    const weaponTex = {};
    function weaponTexture(kind) {
        if (weaponTex[kind]) return weaponTex[kind];
        const S = 256;
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
        } else {
            g.fillStyle = gray(226);
            g.fillRect(0, 0, S, S);
            for (let i = 0; i < 900; i++) {
                g.fillStyle = gray(Math.round(rand(150, 255)), rand(0.08, 0.18));
                g.fillRect(Math.random() * S - S / 2, Math.random() * S, S * rand(0.2, 1), 1);
            }
            overlay(g, S, NOISE_HI, 2, 0.15);
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
        const base = CAMO_BASE[id] || CAMO_BASE.standard;
        const make = (color, map) => (base.shiny
            ? new THREE.MeshPhongMaterial({ color: new THREE.Color(color).multiplyScalar(1.1), map, shininess: 90, specular: 0xfff0b0 })
            : new THREE.MeshLambertMaterial({ color: new THREE.Color(color).multiplyScalar(1.1), map }));
        const brushed = weaponTexture('brushed');
        const glass = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
        if (CAMO_PATTERNS[id]) {
            const t = weaponTexture(id);
            camoMats[id] = { metal: make(0xf2f2f2, t), wood: make(0xd6d6d6, t), acc: make(0xb4b4b4, t), dark: make(0x1d2026, brushed), glass };
        } else {
            camoMats[id] = { metal: make(base.metal, brushed), dark: make(base.dark, brushed), wood: make(base.wood, brushed), acc: make(base.acc, brushed), glass };
        }
        return camoMats[id];
    }
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffcc66, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xff5a48 });
    const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const CYL = (r, l, seg = 8) => { const g = new THREE.CylinderGeometry(r, r, l, seg); g.rotateX(Math.PI / 2); return g; };
    function mk(g, m, x, y, z, rx) {
        const o = new THREE.Mesh(g, m);
        o.position.set(x, y, z);
        if (rx) o.rotation.x = rx;
        return o;
    }

    function makeWeapon(id, camoId) {
        const m = camoMaterials(camoId);
        const g = new THREE.Group();
        let mz = null;
        switch (id) {
            case 'knife':
                g.add(mk(BOX(0.012, 0.045, 0.26), m.acc, 0, 0.01, -0.2));
                g.add(mk(BOX(0.035, 0.05, 0.12), m.dark, 0, 0, -0.02));
                g.add(mk(BOX(0.05, 0.07, 0.015), m.metal, 0, 0.005, -0.075));
                break;
            case 'pim':
                g.add(mk(BOX(0.045, 0.06, 0.22), m.metal, 0, 0, -0.09));
                g.add(mk(BOX(0.04, 0.12, 0.055), m.dark, 0, -0.09, 0, 0.25));
                g.add(mk(BOX(0.018, 0.018, 0.03), m.acc, 0, 0.04, -0.19));
                mz = -0.22;
                break;
            case 'olcu':
                g.add(mk(CYL(0.016, 0.2), m.metal, 0, 0.01, -0.17));
                g.add(mk(CYL(0.034, 0.06, 6), m.acc, 0, 0, -0.04));
                g.add(mk(BOX(0.04, 0.05, 0.1), m.metal, 0, 0.005, 0.01));
                g.add(mk(BOX(0.04, 0.12, 0.05), m.wood, 0, -0.085, 0.05, 0.35));
                mz = -0.28;
                break;
            case 'ari':
                g.add(mk(BOX(0.06, 0.085, 0.3), m.metal, 0, 0, -0.08));
                g.add(mk(CYL(0.016, 0.16), m.dark, 0, 0.01, -0.3));
                g.add(mk(BOX(0.035, 0.2, 0.05), m.dark, 0, -0.13, -0.08));
                g.add(mk(BOX(0.04, 0.1, 0.05), m.dark, 0, -0.09, 0.05, -0.3));
                g.add(mk(BOX(0.02, 0.07, 0.2), m.acc, 0, -0.01, 0.16));
                g.add(mk(BOX(0.03, 0.03, 0.1), m.acc, 0, 0.06, -0.1));
                mz = -0.4;
                break;
            case 'sacma':
                g.add(mk(BOX(0.065, 0.09, 0.3), m.metal, 0, 0, -0.05));
                g.add(mk(CYL(0.026, 0.56), m.dark, 0, 0.02, -0.46));
                g.add(mk(CYL(0.022, 0.42), m.acc, 0, -0.03, -0.4));
                g.add(mk(BOX(0.07, 0.055, 0.2), m.wood, 0, -0.045, -0.38));
                g.add(mk(BOX(0.055, 0.11, 0.3), m.wood, 0, -0.03, 0.24));
                g.add(mk(BOX(0.04, 0.09, 0.05), m.dark, 0, -0.09, 0.05, -0.3));
                mz = -0.76;
                break;
            case 'kartal':
                g.add(mk(BOX(0.062, 0.1, 0.44), m.metal, 0, 0, -0.08));
                g.add(mk(BOX(0.05, 0.06, 0.2), m.acc, 0, -0.01, -0.36));
                g.add(mk(CYL(0.016, 0.24), m.dark, 0, 0.012, -0.55));
                g.add(mk(BOX(0.038, 0.2, 0.07), m.dark, 0, -0.13, -0.06, 0.32));
                g.add(mk(BOX(0.04, 0.1, 0.05), m.dark, 0, -0.09, 0.08, -0.3));
                g.add(mk(BOX(0.05, 0.11, 0.24), m.wood, 0, -0.02, 0.24));
                g.add(mk(BOX(0.03, 0.035, 0.16), m.acc, 0, 0.07, -0.08));
                mz = -0.68;
                break;
            case 'sahin':
                g.add(mk(BOX(0.058, 0.09, 0.42), m.metal, 0, 0, -0.08));
                g.add(mk(CYL(0.03, 0.26), m.dark, 0, 0.012, -0.44));
                g.add(mk(CYL(0.034, 0.2), m.acc, 0, 0.012, -0.66));
                g.add(mk(BOX(0.036, 0.19, 0.06), m.dark, 0, -0.13, -0.07, 0.1));
                g.add(mk(BOX(0.04, 0.1, 0.05), m.dark, 0, -0.09, 0.08, -0.3));
                g.add(mk(BOX(0.03, 0.1, 0.26), m.acc, 0, -0.01, 0.24));
                g.add(mk(BOX(0.04, 0.04, 0.12), m.dark, 0, 0.075, -0.06));
                mz = -0.78;
                break;
            case 'yayla':
                g.add(mk(BOX(0.06, 0.09, 0.48), m.metal, 0, 0, -0.05));
                g.add(mk(CYL(0.018, 0.66), m.dark, 0, 0.01, -0.6));
                g.add(mk(BOX(0.06, 0.13, 0.36), m.wood, 0, -0.03, 0.27));
                g.add(mk(CYL(0.034, 0.3), m.dark, 0, 0.09, -0.08));
                g.add(mk(CYL(0.04, 0.03), m.glass, 0, 0.09, -0.24));
                g.add(mk(BOX(0.035, 0.12, 0.06), m.dark, 0, -0.1, 0.07, -0.3));
                mz = -0.95;
                break;
            case 'blades':
                // a fan of three throwing knives
                for (const [x, ry] of [[-0.03, 0.18], [0, 0], [0.03, -0.18]]) {
                    const k = mk(BOX(0.01, 0.035, 0.2), lam(0xd7f7a4), x, 0.01, -0.12);
                    k.rotation.y = ry;
                    g.add(k);
                }
                g.add(mk(BOX(0.05, 0.03, 0.06), m.dark, 0, -0.005, 0.0));
                mz = -0.24;
                break;
            case 'spike': {
                g.add(mk(BOX(0.18, 0.12, 0.22), m.dark, 0, 0, -0.05));
                const core = mk(CYL(0.045, 0.24, 10), coreMat, 0, 0.03, -0.05);
                g.add(core);
                g.add(mk(BOX(0.1, 0.02, 0.08), m.glass, 0, 0.07, 0.0));
                break;
            }
            default:
        }
        if (mz !== null) {
            const f = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), flashMat);
            f.position.set(0, 0.012, mz - 0.03);
            f.visible = false;
            g.add(f);
            g.userData.flash = f;
        }
        g.userData.muzzle = mz ?? -0.3;
        return g;
    }

    function disposeTree(obj) {
        obj.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    }

    // First-person models: the weapon plus gloved hands and sleeves in the agent's colour.
    let vmModels = {};
    let vmKey = '';
    function buildViewmodels(camoId, agentId) {
        const key = `${camoId}|${agentId}`;
        if (vmKey === key) return;
        Object.values(vmModels).forEach((m) => { vmRoot.remove(m); disposeTree(m); });
        vmModels = {};
        const sleeve = new THREE.MeshLambertMaterial({ color: AGENTS[agentId].hex });
        const glove = lam(0x22252b);
        for (const w of WEAPONS) {
            const m = makeWeapon(w.id, camoId);
            const twoHands = ['ari', 'sacma', 'kartal', 'sahin', 'yayla'].includes(w.id);
            m.add(mk(BOX(0.06, 0.07, 0.08), glove, 0.005, -0.08, 0.03));
            m.add(mk(BOX(0.09, 0.09, 0.4), sleeve, 0.06, -0.14, 0.25, -0.35));
            if (twoHands) {
                m.add(mk(BOX(0.06, 0.06, 0.08), glove, -0.02, -0.05, -0.32));
                const arm = mk(BOX(0.085, 0.085, 0.42), sleeve, -0.16, -0.14, -0.08, -0.2);
                arm.rotation.y = -0.55;
                m.add(arm);
            } else if (w.id !== 'knife') {
                m.add(mk(BOX(0.055, 0.06, 0.07), glove, -0.04, -0.09, 0.02));
                const arm = mk(BOX(0.085, 0.085, 0.4), sleeve, -0.12, -0.15, 0.24, -0.35);
                arm.rotation.y = -0.3;
                m.add(arm);
            }
            m.visible = false;
            vmRoot.add(m);
            vmModels[w.id] = m;
        }
        vmKey = key;
    }

    // White silhouettes rendered from the real models, for the buy menu and the HUD.
    const thumbCache = {};
    function weaponThumb(id) {
        if (thumbCache[id]) return thumbCache[id];
        const Wt = 256;
        const Ht = 96;
        const rt = new THREE.WebGLRenderTarget(Wt, Ht);
        const tScene = new THREE.Scene();
        tScene.overrideMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const model = makeWeapon(id, 'standard');
        if (model.userData.flash) model.remove(model.userData.flash);
        model.rotation.y = -Math.PI / 2;
        tScene.add(model);
        const bb = new THREE.Box3().setFromObject(model);
        const size = bb.getSize(new THREE.Vector3());
        const center = bb.getCenter(new THREE.Vector3());
        const half = Math.max(size.x / 2 / (Wt / Ht), size.y / 2) * 1.12;
        const cam = new THREE.OrthographicCamera(-half * (Wt / Ht), half * (Wt / Ht), half, -half, 0.01, 10);
        cam.position.set(center.x, center.y, 3);
        cam.lookAt(center.x, center.y, 0);
        renderer.setRenderTarget(rt);
        renderer.setClearColor(0x000000, 0);
        renderer.clear();
        renderer.render(tScene, cam);
        const px = new Uint8Array(Wt * Ht * 4);
        renderer.readRenderTargetPixels(rt, 0, 0, Wt, Ht, px);
        renderer.setRenderTarget(null);
        rt.dispose();
        disposeTree(model);
        const c = document.createElement('canvas');
        c.width = Wt;
        c.height = Ht;
        const g = c.getContext('2d');
        const img = g.createImageData(Wt, Ht);
        for (let y = 0; y < Ht; y++) img.data.set(px.subarray((Ht - 1 - y) * Wt * 4, (Ht - y) * Wt * 4), y * Wt * 4);
        g.putImageData(img, 0, 0);
        thumbCache[id] = c.toDataURL();
        return thumbCache[id];
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
    function tone(freq, dur, type = 'sine', vol = 0.08, slide = 0, pan = 0, delay = 0) {
        const a = ac();
        if (!a || vol <= 0.005) return;
        const o = a.createOscillator();
        const g = a.createGain();
        const t0 = a.currentTime + delay;
        o.type = type;
        o.frequency.setValueAtTime(freq, t0);
        if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
        g.gain.setValueAtTime(0.0001, a.currentTime);
        g.gain.setValueAtTime(vol, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        o.connect(g);
        g.connect(outNode(pan));
        o.start(a.currentTime);
        o.stop(t0 + dur);
    }
    const SHOT_SOUND = {
        pim: [0.1, 3200, 0.4, 130], olcu: [0.22, 1600, 0.75, 80], ari: [0.09, 3000, 0.4, 120], sacma: [0.3, 1400, 0.85, 70],
        kartal: [0.14, 2100, 0.6, 85], sahin: [0.1, 1300, 0.28, 140], yayla: [0.45, 1000, 0.95, 55], blades: [0.12, 4200, 0.3, 300]
    };
    function shotSound(id, vol = 1, pan = 0) {
        const s = SHOT_SOUND[id];
        if (!s) return;
        noise(s[0], s[1], vol * s[2], pan);
        tone(s[3], 0.12, 'triangle', vol * 0.18, -30, pan);
    }
    function spatial(x, z, range = 90) {
        const dx = x - player.x;
        const dz = z - player.z;
        const dist = Math.hypot(dx, dz) || 1;
        const pan = (dx * Math.cos(player.yaw) - dz * Math.sin(player.yaw)) / dist;
        return { vol: Math.pow(clamp(1 - dist / range, 0, 1), 1.5), pan: pan * 0.8, dist };
    }
    function chord(freqs, dur, type, vol, gap = 0.09) {
        freqs.forEach((f, i) => tone(f, dur, type, vol, 0, 0, i * gap));
    }

    /* ---------- Efektler (kalıcı havuzlar: shader'lar yeniden derlenmez) ---------- */

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
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.7 }));
        line.frustumCulled = false;
        return line;
    });
    const takeFire = makePool(6, () => new THREE.Mesh(fireGeo, new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })));
    const takeSmoke = makePool(32, () => new THREE.Mesh(smokeGeo, new THREE.MeshLambertMaterial({ color: 0x6e6a64, transparent: true, opacity: 0.7, depthWrite: false })));
    const pools = [takePuff, takeTracer, takeFire, takeSmoke];

    function addEffect(obj, life, update) {
        if (obj.userData.fx) obj.userData.fx.dead = true;
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
        addEffect(line, 0.07, (o, k) => { o.material.opacity = 0.7 * (1 - k); });
    }
    function burstFx(x, y, z, color, size = 4.5, smoke = 7) {
        const fire = takeFire();
        fire.position.set(x, y + 0.3, z);
        fire.material.color.setHex(color);
        addEffect(fire, 0.4, (o, k) => { o.scale.setScalar(0.4 + k * size); o.material.opacity = 0.9 * (1 - k); });
        for (let i = 0; i < smoke; i++) {
            const s = takeSmoke();
            const vx = rand(-1.4, 1.4);
            const vz = rand(-1.4, 1.4);
            s.position.set(x + vx * 0.4, y + 0.6, z + vz * 0.4);
            addEffect(s, rand(1.2, 1.8), (o, k, dt) => {
                o.position.x += vx * dt;
                o.position.z += vz * dt;
                o.position.y += 1.3 * dt;
                o.scale.setScalar(1 + k * 2.4);
                o.material.opacity = 0.6 * (1 - k);
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
    function warmShaders() {
        const shown = pools.map((take) => take.items[0]);
        shown.forEach((o) => { o.visible = true; });
        try { renderer.compile(scene, camera); } catch { /* compiling early is only an optimisation */ }
        shown.forEach((o) => { o.visible = false; });
    }

    /* ---------- Durum ---------- */

    function newNid() { return 1 + Math.floor(Math.random() * 65000); }

    const player = {
        nid: newNid(), team: 0, agent: prefs.agent,
        x: 0, y: 0, z: 0, velY: 0, yaw: 0, pitch: 0, eye: EYE_STAND, onGround: true, stance: 0, walking: false, speedNow: 0,
        hp: 100, armor: 0, alive: false, credits: ECON.start,
        primary: -1, secondary: W.pim, slot: W.pim, ammo: {}, charges: { c: 0, q: 0, e: 0 }, ult: 0,
        reloading: false, reloadStart: 0, nextShot: 0, fireSeq: 0, spray: 0, lastShotAt: -1e9, ads: false,
        kickYaw: 0, kickPitch: 0, tagUntil: 0, blindUntil: 0, blindTotal: 1, darkUntil: 0,
        dashUntil: 0, dashX: 0, dashZ: 0, buffUntil: 0, healLeft: 0, stunUntil: 0, bladesUntil: 0,
        action: null, actionStart: 0, hasSpike: false, killer: 0, spectate: 0, lastHurt: 0, stepT: 0, revealedUntil: 0, zoneSlow: 1, boughtThisRound: {}
    };

    const match = {
        phase: 'menu', mode: 'solo', paused: false, timer: 0, round: 0, half: 0, score: [0, 0], winTarget: 7,
        lossStreak: [0, 0], diff: 'normal', size: 5, fill: true, rewarded: false, syncAt: 0, roundStats: null, mvp: 0
    };
    const roster = new Map(); // nid -> { name, team, agent, camo, bot, kills, deaths, assists }
    const actors = new Map(); // uzak oyuncular ve botlar
    const spike = { state: 'none', carrier: 0, x: 0, y: 0, z: 0, site: '', timer: 0, defuser: 0, beepAt: 0 };
    let roomCode = '';
    let previewCamo = null;

    const isOnline = () => match.mode !== 'solo';
    const isAuthority = () => match.mode !== 'client';
    const inMatch = () => ['buy', 'round', 'planted', 'post'].includes(match.phase);
    const combatPhase = () => match.phase === 'round' || match.phase === 'planted';
    const sideOf = (team) => (team + match.half) % 2;
    const teamOf = (nid) => (nid === player.nid ? player.team : roster.get(nid)?.team ?? -1);
    const mySide = () => sideOf(player.team);
    const canAct = () => inMatch() && !match.paused && player.alive && !overlayOpen() && !buyOpen;

    function myName() {
        const profile = CasualProfile.current();
        return profile ? profile.displayName : `Misafir${player.nid % 1000}`;
    }
    function myCamo() {
        const id = previewCamo || CasualProfile.current()?.selectedCamo || 'standard';
        return CamoValid(id) ? id : 'standard';
    }
    const CamoValid = (id) => Boolean(CAMO_PATTERNS[id] || CAMO_BASE[id]);
    function cleanName(value) {
        return String(value || '').normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f<>]/g, '').trim().slice(0, 20) || 'Oyuncu';
    }
    function nameOf(nid) {
        if (nid === player.nid) return 'Sen';
        return roster.get(nid)?.name || actors.get(nid)?.name || 'Oyuncu';
    }
    const agentOf = (nid) => (nid === player.nid ? player.agent : roster.get(nid)?.agent || 'kor');

    /* ---------- Ajan modelleri ---------- */

    const outlineMat = new THREE.MeshBasicMaterial({ color: 0xff3a4c, side: THREE.BackSide });
    const outlineXray = new THREE.MeshBasicMaterial({ color: 0xff3a4c, side: THREE.BackSide, depthTest: false, transparent: true, opacity: 0.85 });
    function markerSprite() {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const g = c.getContext('2d');
        g.translate(32, 32);
        g.rotate(Math.PI / 4);
        g.fillStyle = '#5ff5e1';
        g.fillRect(-12, -12, 24, 24);
        g.strokeStyle = '#0f1923';
        g.lineWidth = 4;
        g.strokeRect(-12, -12, 24, 24);
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
        s.scale.set(0.35, 0.35, 1);
        s.renderOrder = 10;
        s.raycast = () => {};
        return s;
    }
    function makeNameTag(text, color) {
        const c = document.createElement('canvas');
        c.width = 256;
        c.height = 64;
        const g = c.getContext('2d');
        g.font = '600 30px Outfit, system-ui, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineWidth = 6;
        g.strokeStyle = 'rgba(10,15,20,.85)';
        g.strokeText(text, 128, 34);
        g.fillStyle = color;
        g.fillText(text, 128, 34);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
        sprite.scale.set(1.5, 0.375, 1);
        sprite.renderOrder = 10;
        sprite.raycast = () => {};
        sprite.visible = false;
        return sprite;
    }

    function buildBody(a) {
        const ag = AGENTS[a.agent] || AGENTS.kor;
        const body = new THREE.Group();
        const jacket = new THREE.MeshLambertMaterial({ color: ag.hex });
        const dark = lam(0x272b33);
        const skin = lam(0xe2b48f);
        const plate = lam(0x3b4250);
        const parts = [];
        const add = (mesh) => { body.add(mesh); parts.push(mesh); return mesh; };
        const leg = (x) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.82, 0);
            const thigh = mk(BOX(0.19, 0.82, 0.22), dark, 0, -0.41, 0);
            const boot = mk(BOX(0.2, 0.12, 0.3), plate, 0, -0.76, -0.03);
            pivot.add(thigh, boot);
            parts.push(thigh, boot);
            body.add(pivot);
            return pivot;
        };
        a.legL = leg(-0.11);
        a.legR = leg(0.11);
        add(mk(BOX(0.5, 0.62, 0.3), jacket, 0, 1.13, 0));
        add(mk(BOX(0.36, 0.3, 0.08), plate, 0, 1.18, -0.16));
        add(mk(BOX(0.16, 0.12, 0.24), plate, -0.32, 1.38, 0));
        add(mk(BOX(0.16, 0.12, 0.24), plate, 0.32, 1.38, 0));
        add(mk(BOX(0.13, 0.5, 0.15), jacket, -0.33, 1.1, -0.05));
        add(mk(BOX(0.3, 0.38, 0.14), dark, 0, 1.15, 0.2));
        const head = add(mk(new THREE.SphereGeometry(0.19, 12, 10), skin, 0, 1.6, 0));
        head.userData.head = true;
        const accent = new THREE.MeshLambertMaterial({ color: new THREE.Color(ag.hex).multiplyScalar(0.8) });
        if (a.agent === 'kor') { for (let i = -1; i <= 1; i++) { const h = add(mk(new THREE.ConeGeometry(0.06, 0.22, 5), accent, i * 0.08, 1.8, 0.02)); h.rotation.z = -i * 0.4; h.userData.head = true; } }
        if (a.agent === 'sis') { const hood = add(mk(new THREE.SphereGeometry(0.23, 12, 8, 0, TAU, 0, Math.PI * 0.6), accent, 0, 1.62, 0.03)); hood.userData.head = true; }
        if (a.agent === 'ok') { const band = add(mk(BOX(0.4, 0.06, 0.4), accent, 0, 1.67, 0)); band.userData.head = true; add(mk(BOX(0.06, 0.5, 0.06), lam(0x8a6a44), 0.12, 1.2, 0.22)).rotation.z = 0.3; }
        if (a.agent === 'kale') { const helm = add(mk(new THREE.SphereGeometry(0.215, 12, 8, 0, TAU, 0, Math.PI * 0.5), accent, 0, 1.63, 0)); helm.userData.head = true; }
        if (a.agent === 'ruzgar') { add(mk(BOX(0.34, 0.08, 0.34), accent, 0, 1.43, 0)); add(mk(BOX(0.08, 0.04, 0.42), accent, 0.06, 1.42, 0.3)).rotation.x = -0.5; }
        if (a.agent === 'ayaz') { const crown = add(mk(new THREE.ConeGeometry(0.2, 0.18, 6), accent, 0, 1.86, 0)); crown.userData.head = true; }
        if (a.agent === 'fay') { const brim = add(mk(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 12), accent, 0, 1.76, 0)); brim.userData.head = true; }
        if (a.agent === 'nobet') { const visor = add(mk(BOX(0.36, 0.1, 0.12), accent, 0, 1.65, -0.17)); visor.userData.head = true; }
        add(mk(BOX(0.24, 0.06, 0.04), lam(0x101418), 0, 1.62, -0.18)).userData.head = true;
        const hand = new THREE.Group();
        hand.position.set(0.28, 1.2, -0.12);
        body.add(hand);
        a.hand = hand;
        // Inverted-hull outline: a slightly larger, inside-out copy of every part, only shown for enemies.
        for (const p of parts) {
            const o = new THREE.Mesh(p.geometry, outlineMat);
            o.raycast = () => {};
            p.updateMatrix();
            o.matrixAutoUpdate = false;
            const s = new THREE.Vector3();
            const q = new THREE.Quaternion();
            const t = new THREE.Vector3();
            p.matrix.decompose(t, q, s);
            o.matrix.compose(t, q, s.multiplyScalar(1.09));
            (p.parent === body ? body : p.parent).add(o);
            a.outlines.push(o);
        }
        a.jacket = jacket;
        body.traverse((o) => { if (o.isMesh && o.material !== outlineMat) o.castShadow = true; });
        return body;
    }

    function ensureActor(nid) {
        let a = actors.get(nid);
        if (a) return a;
        const group = new THREE.Group();
        group.rotation.order = 'YXZ';
        group.userData.nid = nid;
        group.visible = false;
        scene.add(group);
        a = {
            nid, group, body: null, legL: null, legR: null, hand: null, jacket: null, outlines: [], tag: null, tagText: '', marker: markerSprite(),
            name: `Oyuncu ${nid % 1000}`, bot: nid >= BOT_BASE, team: -1, agent: '', camo: 'standard',
            weapon: -1, wCamo: '', wModel: null, buf: [], hasSpike: false, action: 0, walking: false,
            x: 0, y: 0, z: 0, yaw: 0, pitch: 0, stance: 0, alive: false, reloading: false, fireSeq: 0,
            flashUntil: 0, lastPacket: 0, lastShotAt: -1e9, deadAt: -1e9, deadLock: 0, hitUntil: 0,
            walk: 0, px: 0, pz: 0, losAt: 0, los: false, stepAt: 0, sim: null, xray: false
        };
        a.marker.visible = false;
        scene.add(a.marker);
        actors.set(nid, a);
        return a;
    }

    function setActorInfo(a, info) {
        const name = cleanName(info.name);
        const agent = AGENTS[info.agent] ? info.agent : 'kor';
        const camo = CamoValid(info.camo) ? info.camo : 'standard';
        const team = info.team === 1 ? 1 : 0;
        if (agent !== a.agent) {
            if (a.body) { a.group.remove(a.body); disposeTree(a.body); a.jacket.dispose(); }
            a.agent = agent;
            a.outlines = [];
            a.body = buildBody(a);
            a.group.add(a.body);
            a.wModel = null;
            a.weapon = -1;
        }
        a.bot = Boolean(info.bot);
        a.team = team;
        if (camo !== a.camo) { a.camo = camo; a.wCamo = ''; }
        if (a.weapon >= 0 || !a.wModel) setActorWeapon(a, Math.max(1, a.weapon), true);
        const ally = team === player.team;
        const key = `${name}|${ally}`;
        if (a.tagText !== key) {
            if (a.tag) { scene.remove(a.tag); a.tag.material.map.dispose(); a.tag.material.dispose(); }
            a.tag = makeNameTag(name, ally ? '#5ff5e1' : '#ff6b78');
            a.tagText = key;
            scene.add(a.tag);
        }
        a.name = name;
    }

    function setActorWeapon(a, w, force) {
        if (!a.hand) return;
        if (!force && a.weapon === w && a.wCamo === a.camo) return;
        if (a.wModel) { a.hand.remove(a.wModel); disposeTree(a.wModel); }
        a.wModel = makeWeapon(WEAPONS[w]?.id || 'pim', a.camo);
        a.wModel.scale.setScalar(0.9);
        a.hand.add(a.wModel);
        a.weapon = w;
        a.wCamo = a.camo;
    }

    function removeActor(nid) {
        const a = actors.get(nid);
        if (!a) return;
        scene.remove(a.group, a.marker);
        if (a.body) { disposeTree(a.group); a.jacket.dispose(); }
        a.marker.material.map.dispose();
        a.marker.material.dispose();
        if (a.tag) { scene.remove(a.tag); a.tag.material.map.dispose(); a.tag.material.dispose(); }
        actors.delete(nid);
    }
    function clearActors() { [...actors.keys()].forEach(removeActor); }

    function setAlive(a, alive, now) {
        if (a.alive && !alive) a.deadAt = now;
        if (!a.alive && alive) { a.group.rotation.x = 0; a.buf.length = 0; }
        a.alive = alive;
    }

    // Combatants for bot perception, bot bullets and ability effects.
    const fighters = [];
    function refreshFighters() {
        fighters.length = 0;
        if (inMatch()) {
            fighters.push({ nid: player.nid, team: player.team, x: player.x, y: player.y, z: player.z, stance: player.stance, alive: player.alive, lastShotAt: player.lastShotAt, loud: player.speedNow > 4.5 && player.onGround, hasSpike: player.hasSpike });
        }
        for (const a of actors.values()) {
            if (!a.sim && !a.lastPacket) continue;
            fighters.push({ nid: a.nid, team: a.team, x: a.x, y: a.y, z: a.z, stance: a.stance, alive: a.alive, lastShotAt: a.lastShotAt, loud: a.moving && !a.walking, hasSpike: a.hasSpike });
        }
    }
    const fighterById = (nid) => fighters.find((f) => f.nid === nid) || null;

    // Analytic hit test used for bot bullets: legs, body and a head sphere.
    function hitFighter(f, ox, oy, oz, dx, dy, dz) {
        const s = STANCE_SCALE[f.stance] || 1;
        const hx = f.x - ox;
        const hy = f.y + 1.6 * s - oy;
        const hz = f.z - oz;
        const tc = hx * dx + hy * dy + hz * dz;
        let best = null;
        if (tc > 0) {
            const d2 = hx * hx + hy * hy + hz * hz - tc * tc;
            const r2 = 0.2 * 0.2;
            if (d2 < r2) best = { t: tc - Math.sqrt(r2 - d2), part: 'head' };
        }
        const tb = rayBox(ox, oy, oz, dx, dy, dz, f.x - 0.27, f.y + 0.8 * s, f.z - 0.27, f.x + 0.27, f.y + 1.42 * s, f.z + 0.27, 300);
        if (tb < Infinity && (!best || tb < best.t)) best = { t: tb, part: 'body' };
        const tl = rayBox(ox, oy, oz, dx, dy, dz, f.x - 0.22, f.y, f.z - 0.2, f.x + 0.22, f.y + 0.8 * s, f.z + 0.2, 300);
        if (tl < Infinity && (!best || tl < best.t)) best = { t: tl, part: 'leg' };
        return best;
    }
    function weaponDamage(w, part, dist) {
        const [near, far, minMul] = w.range;
        const fall = dist <= near ? 1 : dist >= far ? minMul : lerp(1, minMul, (dist - near) / (far - near));
        const mul = part === 'head' ? w.head : part === 'leg' ? 0.85 : 1;
        return w.dmg * mul * fall;
    }

    /* ---------- Yetenekler ---------- */

    const zones = []; // duman, ateş, yavaşlatma, kilit, duvar, tel, keşif
    const projectiles = new Map();
    const reveals = new Map(); // nid -> gösterilme bitişi (yerel oyuncunun düşmanları)
    const teamIntel = [new Map(), new Map()]; // botların takım bilgisi: nid -> { x, z, at }
    let abilitySeq = 0;
    const ABILITY_W = 20; // ölüm akışında "yetenek" silah kodu
    const THROWN = {
        molotov: { speed: 16, up: 3, grav: 1, color: 0xff7a3d, onLand: true },
        flash: { speed: 18, up: 2.5, grav: 0.6, color: 0xfff6c8, fuse: 0.55 },
        slow: { speed: 16, up: 3, grav: 1, color: 0x9b7bff, onLand: true },
        dark: { speed: 26, up: 0.5, grav: 0.25, color: 0x3b2a6b, onHit: true },
        shock: { speed: 24, up: 1.5, grav: 0.45, color: 0x3fd17a, onHit: true },
        recon: { speed: 28, up: 1, grav: 0.35, color: 0x7dffb0, onHit: true },
        frost: { speed: 16, up: 3, grav: 1, color: 0x8de8ff, onLand: true },
        stun: { speed: 17, up: 3, grav: 1, color: 0xe0a35c, onLand: true }
    };
    // Placed abilities: how far ahead they can go (aim point) for the local player.
    const PLACED = { smoke: 38, icesmoke: 38, cloud: 22, wall: 10, icewall: 10, turret: 10, alarm: 12, blizzard: 40 };
    const QUAKES = { quake: { len: 22, width: 4.5, delay: 900, stun: 2500, reveal: 0 }, rupture: { len: 42, width: 10, delay: 1200, stun: 4000, reveal: 3000 } };

    const smokeTex = (() => {
        const t = new THREE.CanvasTexture(NOISE_LO);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(3, 2);
        return t;
    })();
    const smokeSphere = new THREE.SphereGeometry(1, 20, 14);
    const discGeo = new THREE.CircleGeometry(1, 32);
    discGeo.rotateX(-Math.PI / 2);
    const projGeo = new THREE.SphereGeometry(0.1, 10, 8);

    function addZone(z) {
        zones.push(z);
        return z;
    }
    function removeZone(z) {
        const i = zones.indexOf(z);
        if (i >= 0) zones.splice(i, 1);
        if (z.mesh) { scene.remove(z.mesh); z.mesh.traverse((o) => { if (o.geometry && o.geometry !== smokeSphere && o.geometry !== discGeo) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
        if (z.solid) { const k = solids.indexOf(z.solid); if (k >= 0) solids.splice(k, 1); }
        if (z.occluder) { const k = occluders.indexOf(z.occluder); if (k >= 0) occluders.splice(k, 1); }
    }
    function clearAbilities() {
        [...zones].forEach(removeZone);
        for (const p of projectiles.values()) scene.remove(p.mesh);
        projectiles.clear();
        reveals.clear();
        teamIntel.forEach((m) => m.clear());
    }

    function smokeZone(x, z, r, until, team, owner, tint = 0x8f86b8) {
        const mat = new THREE.MeshLambertMaterial({ color: tint, map: smokeTex, side: THREE.DoubleSide, transparent: true, opacity: 0.97 });
        const mesh = new THREE.Mesh(smokeSphere, mat);
        mesh.position.set(x, r * 0.55, z);
        mesh.scale.setScalar(0.1);
        mesh.raycast = () => {};
        scene.add(mesh);
        return addZone({ kind: 'smoke', x, y: r * 0.55, z, r, until, team, owner, mesh, born: performance.now() });
    }
    function discZone(kind, x, z, r, until, team, owner, color, opacity) {
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: kind === 'fire' ? THREE.AdditiveBlending : THREE.NormalBlending });
        const mesh = new THREE.Mesh(discGeo, mat);
        mesh.position.set(x, groundAt(x, z, 5) + 0.05, z);
        mesh.scale.set(r, 1, r);
        mesh.raycast = () => {};
        scene.add(mesh);
        return addZone({ kind, x, y: mesh.position.y, z, r, until, team, owner, mesh, born: performance.now() });
    }

    // Aim point for placed abilities: first wall or floor along the view ray, pulled back from walls.
    function aimPoint(maxDist) {
        const cp = Math.cos(player.pitch);
        const dx = -Math.sin(player.yaw) * cp;
        const dy = Math.sin(player.pitch);
        const dz = -Math.cos(player.yaw) * cp;
        const ey = player.y + player.eye;
        const t = Math.min(maxDist, rayDistance(player.x, ey, player.z, dx, dy, dz, maxDist));
        const back = Math.max(0, t - 0.8);
        return { x: clamp(player.x + dx * back, -HALF_X + 1, HALF_X - 1), z: clamp(player.z + dz * back, -HALF_Z + 1, HALF_Z - 1), dx, dz };
    }

    // Validates and executes an ability event for anyone (local caster, remote event, bot).
    function applyAbility(d, now) {
        const team = teamOf(d.f);
        const until = now + (d.ms || 0);
        switch (d.k) {
            case 'molotov': case 'flash': case 'slow': case 'dark': case 'shock': case 'recon': case 'frost': case 'stun':
                spawnProjectile(d, team, now);
                break;
            case 'smoke': case 'icesmoke': case 'cloud': {
                const [r, ms, tint] = d.k === 'cloud' ? [3.2, 7000, 0xc9d9b8] : d.k === 'icesmoke' ? [4.2, 15000, 0xd4e9f4] : [4.2, 15000, 0x8f86b8];
                smokeZone(d.p[0], d.p[2], r, now + ms, team, d.f, tint);
                noise(0.8, 600, 0.12 * spatial(d.p[0], d.p[2]).vol, 0, 'highpass');
                break;
            }
            case 'updraft':
                if (d.f === player.nid) { player.velY = 11.5; player.onGround = false; }
                noise(0.4, 900, 0.16 * spatial(d.p[0], d.p[2]).vol, 0, 'bandpass');
                puff(d.p[0], d.p[1] + 0.2, d.p[2], 0xe8ffd0);
                break;
            case 'blades':
                if (d.f === player.nid) {
                    player.bladesUntil = now + 15000;
                    player.ammo[W.blades] = [WEAPONS[W.blades].mag, 0];
                    player.slot = W.blades;
                    vmSwap = 1;
                } else {
                    const a = actors.get(d.f);
                    if (a && a.sim) { a.sim.bladesUntil = now + 15000; a.sim.ammo[W.blades] = [WEAPONS[W.blades].mag, 0]; a.sim.slot = W.blades; setActorWeapon(a, W.blades); }
                }
                chord([880, 1320, 1760], 0.2, 'triangle', 0.06 * spatial(d.p[0], d.p[2]).vol, 0.05);
                break;
            case 'quake': case 'rupture':
                quakeLine(d, team, now);
                break;
            case 'pulse': {
                burstFx(d.p[0], 0.3, d.p[2], 0xe0a35c, 6, 0);
                tone(140, 0.5, 'sine', 0.12 * spatial(d.p[0], d.p[2]).vol, -60);
                if (!combatPhase()) break;
                refreshFighters();
                for (const f of fighters) if (f.alive && f.team !== team && Math.hypot(f.x - d.p[0], f.z - d.p[2]) < 18) revealTo(team, f.nid, f.x, f.z, 2500, now);
                break;
            }
            case 'blizzard': {
                const zn = discZone('blizzard', d.p[0], d.p[2], 8, now + 8000, team, d.f, 0xe8f6ff, 0.3);
                zn.flames = true;
                noise(1.5, 700, 0.2 * spatial(d.p[0], d.p[2]).vol, 0, 'lowpass');
                break;
            }
            case 'shieldup': {
                burstFx(d.p[0], 0.4, d.p[2], 0x9fd8ff, 7, 0);
                chord([520, 780], 0.3, 'triangle', 0.06 * spatial(d.p[0], d.p[2]).vol);
                if (player.alive && team === player.team && Math.hypot(player.x - d.p[0], player.z - d.p[2]) < 8) { player.armor = Math.min(50, player.armor + 25); updateHud(); }
                if (isAuthority()) for (const a of actors.values()) if (a.sim && a.sim.alive && a.team === team && Math.hypot(a.x - d.p[0], a.z - d.p[2]) < 8) a.sim.armor = Math.min(50, a.sim.armor + 25);
                break;
            }
            case 'turret': {
                const [x, , z] = d.p;
                const g = new THREE.Group();
                const body = new THREE.MeshLambertMaterial({ color: team === player.team ? 0xd8e0ea : 0xd8b0b0 });
                g.add(mk(new THREE.CylinderGeometry(0.05, 0.25, 0.9, 6), body, 0, 0.45, 0));
                const head = new THREE.Group();
                head.add(mk(BOX(0.36, 0.26, 0.42), body, 0, 0, 0));
                head.add(mk(BOX(0.08, 0.08, 0.36), new THREE.MeshBasicMaterial({ color: team === player.team ? 0x5ff5e1 : 0xff4655 }), 0, 0.02, -0.3));
                head.position.y = 1.0;
                g.add(head);
                g.position.set(x, groundAt(x, z, 5), z);
                g.rotation.y = Math.atan2(-d.v[0], -d.v[2]);
                g.traverse((o) => { o.userData.zoneId = d.id; });
                scene.add(g);
                g.updateMatrixWorld(true);
                occluders.push(g);
                const gy = g.position.y;
                // The collision box stops below the head so the turret's own sight line starts outside it.
                const solid = addSolid(x - 0.3, x + 0.3, z - 0.3, z + 0.3, gy, gy + 0.85);
                addZone({ kind: 'turret', id: d.id, x, y: gy + 1, z, r: 26, until: now + 60000, team, owner: d.f, mesh: g, head, occluder: g, solid, hp: 70, shots: new Map() });
                tone(320, 0.2, 'square', 0.05 * spatial(x, z).vol, 200);
                break;
            }
            case 'alarm': {
                const [x, , z] = d.p;
                const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.12, 10), new THREE.MeshBasicMaterial({ color: team === player.team ? 0x5ff5e1 : 0xff4655, transparent: true, opacity: team === player.team ? 0.9 : 0.55 }));
                mesh.position.set(x, groundAt(x, z, 5) + 0.06, z);
                mesh.raycast = () => {};
                scene.add(mesh);
                addZone({ kind: 'alarm', x, y: mesh.position.y, z, r: 5.5, until: now + 600000, team, owner: d.f, mesh });
                break;
            }
            case 'beacon': {
                const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 14, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xe4e9f2, transparent: true, opacity: 0.35, depthWrite: false }));
                mesh.position.set(d.p[0], 7, d.p[2]);
                mesh.raycast = () => {};
                scene.add(mesh);
                addZone({ kind: 'beacon', x: d.p[0], y: 1, z: d.p[2], r: 30, until: now + 12000, team, owner: d.f, mesh, pulseAt: now });
                chord([392, 523, 659], 0.4, 'sine', 0.07 * spatial(d.p[0], d.p[2]).vol);
                break;
            }
            case 'smokewall': {
                const [x, , z] = d.p;
                const [dx, , dz] = d.v;
                for (let i = 0; i < 8; i++) {
                    const px = clamp(x + dx * (4 + i * 4.2), -HALF_X + 1, HALF_X - 1);
                    const pz = clamp(z + dz * (4 + i * 4.2), -HALF_Z + 1, HALF_Z - 1);
                    if (segmentBlocked(x, 1.5, z, px, 1.5, pz)) break;
                    smokeZone(px, pz, 2.8, now + 14000, team, d.f, 0x5d4f8a);
                }
                break;
            }
            case 'wall': case 'icewall': {
                const [x, , z] = d.p;
                const ice = d.k === 'icewall';
                const len = ice ? 10 : 7;
                const h = ice ? 3.6 : 3.2;
                const alongX = Math.abs(d.v[2]) > Math.abs(d.v[0]);
                const w = alongX ? len : 0.5;
                const dpt = alongX ? 0.5 : len;
                const mat = new THREE.MeshLambertMaterial({ color: ice ? 0xdaf6ff : 0x8fd3ff, transparent: true, opacity: 0.82, emissive: ice ? 0x2a5f78 : 0x1b4f7a });
                const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, dpt), mat);
                mesh.position.set(x, h / 2, z);
                scene.add(mesh);
                mesh.updateMatrixWorld(true);
                occluders.push(mesh);
                const solid = addSolid(x - w / 2, x + w / 2, z - dpt / 2, z + dpt / 2, 0, h);
                addZone({ kind: 'wall', x, y: h / 2, z, r: len / 2, until: now + (ice ? 15000 : 20000), team, owner: d.f, mesh, solid, occluder: mesh });
                if (ice) noise(0.5, 3500, 0.15 * spatial(x, z).vol, 0, 'highpass');
                else tone(220, 0.4, 'square', 0.05 * spatial(x, z).vol, 200);
                break;
            }
            case 'trip': {
                const [ax, , az, bx, , bz] = d.p;
                const len = Math.hypot(bx - ax, bz - az) || 1;
                const mat = new THREE.MeshBasicMaterial({ color: team === player.team ? 0x5ff5e1 : 0xff3a4c, transparent: true, opacity: 0.85 });
                const g = new THREE.CylinderGeometry(0.02, 0.02, len, 6);
                g.rotateZ(Math.PI / 2);
                const mesh = new THREE.Mesh(g, mat);
                mesh.position.set((ax + bx) / 2, 0.4, (az + bz) / 2);
                mesh.rotation.y = -Math.atan2(bz - az, bx - ax);
                mesh.raycast = () => {};
                scene.add(mesh);
                addZone({ kind: 'trip', x: (ax + bx) / 2, y: 0.4, z: (az + bz) / 2, ax, az, bx, bz, r: len / 2, until: now + 600000, team, owner: d.f, mesh, sides: new Map() });
                break;
            }
            case 'heal':
                if (d.f === player.nid) player.healLeft = 60;
                else { const a = actors.get(d.f); if (a && a.sim) a.sim.healLeft = 60; }
                chord([660, 880, 1100], 0.25, 'sine', 0.05 * spatial(d.p[0], d.p[2]).vol);
                break;
            case 'dash':
                noise(0.3, 1800, 0.18 * spatial(d.p[0], d.p[2]).vol, 0, 'bandpass');
                break;
            case 'blaze':
                if (d.f === player.nid) { player.hp = 100; player.buffUntil = now + 10000; }
                else { const a = actors.get(d.f); if (a && a.sim) { a.sim.hp = 100; a.sim.buffUntil = now + 10000; } }
                chord([300, 450, 600], 0.4, 'sawtooth', 0.06 * spatial(d.p[0], d.p[2]).vol);
                break;
            case 'hunt':
                for (let i = 0; i < 3; i++) window.setTimeout(() => huntPulse(team), i * 2000);
                if (team !== player.team) banner('Düşman avlanıyor', 'Yerin görünüyor', 'enemy');
                break;
            case 'lock': {
                discZone('lock', d.p[0], d.p[2], 14, now + 8000, team, d.f, 0x4aa3ff, 0.22);
                chord([200, 160], 0.6, 'square', 0.06 * spatial(d.p[0], d.p[2]).vol);
                break;
            }
            default:
        }
        void until;
    }

    function spawnProjectile(d, team, now) {
        const spec = THROWN[d.k];
        if (!spec || projectiles.has(d.id)) return;
        const mesh = new THREE.Mesh(projGeo, new THREE.MeshBasicMaterial({ color: spec.color }));
        mesh.position.set(d.p[0], d.p[1], d.p[2]);
        mesh.raycast = () => {};
        scene.add(mesh);
        projectiles.set(d.id, { id: d.id, k: d.k, f: d.f, team, mesh, x: d.p[0], y: d.p[1], z: d.p[2], vx: d.v[0], vy: d.v[1], vz: d.v[2], t: 0, local: d.f === player.nid || (isAuthority() && actors.get(d.f)?.sim), spec, born: now });
        noise(0.18, 2400, 0.1 * spatial(d.p[0], d.p[2]).vol, 0, 'bandpass');
    }

    function stepProjectiles(dt, now) {
        for (const p of [...projectiles.values()]) {
            p.t += dt;
            let landed = false;
            const h = 1 / 120;
            for (let left = dt; left > 1e-6 && !landed; left -= h) {
                const step = Math.min(h, left);
                p.vy += GRAVITY * p.spec.grav * step;
                const nx = p.x + p.vx * step;
                const ny = p.y + p.vy * step;
                const nz = p.z + p.vz * step;
                const wall = solids.find((s) => !s.off && !s.barrier && nx > s.x0 - 0.08 && nx < s.x1 + 0.08 && ny > s.y0 - 0.08 && ny < s.y1 + 0.08 && nz > s.z0 - 0.08 && nz < s.z1 + 0.08);
                if (!wall && ny >= 0.08) {
                    p.x = nx; p.y = ny; p.z = nz;
                } else if (p.spec.onHit) {
                    landed = true;
                } else if (!wall) {
                    // floor
                    if (p.spec.onLand) landed = true;
                    p.y = 0.08;
                    p.vy = Math.abs(p.vy) * 0.35;
                    p.vx *= 0.6;
                    p.vz *= 0.6;
                } else if (p.x <= wall.x0 - 0.08 || p.x >= wall.x1 + 0.08) {
                    p.vx *= -0.4;
                } else if (p.z <= wall.z0 - 0.08 || p.z >= wall.z1 + 0.08) {
                    p.vz *= -0.4;
                } else {
                    // top of a crate or wall
                    if (p.spec.onLand) landed = true;
                    p.vy = Math.abs(p.vy) * 0.3;
                }
                if (p.spec.fuse && p.t >= p.spec.fuse) landed = true;
            }
            p.mesh.position.set(p.x, Math.max(0.08, p.y), p.z);
            if (landed && p.local) {
                const pos = [round2(p.x), round2(Math.max(0.1, p.y)), round2(p.z)];
                removeProjectile(p.id);
                sendEvent({ t: 'abx', id: p.id, k: p.k, f: p.f, p: pos });
                landAbility(p.k, p.f, pos, now);
            } else if (!p.local && p.t > 6) removeProjectile(p.id);
        }
    }
    function removeProjectile(id) {
        const p = projectiles.get(id);
        if (!p) return;
        scene.remove(p.mesh);
        p.mesh.material.dispose();
        projectiles.delete(id);
    }

    function landAbility(k, f, pos, now) {
        const team = teamOf(f);
        const [x, y, z] = pos;
        const sp = spatial(x, z);
        switch (k) {
            case 'molotov': {
                const zn = discZone('fire', x, z, 3.4, now + 7000, team, f, 0xff6a20, 0.55);
                zn.flames = true;
                noise(0.9, 900, 0.3 * sp.vol, sp.pan);
                break;
            }
            case 'slow':
                discZone('slow', x, z, 4, now + 7000, team, f, 0x9b7bff, 0.35);
                noise(0.5, 500, 0.15 * sp.vol, sp.pan);
                break;
            case 'frost':
                discZone('slow', x, z, 4.5, now + 6000, team, f, 0x8de8ff, 0.35);
                noise(0.5, 2500, 0.15 * sp.vol, sp.pan, 'highpass');
                break;
            case 'stun': {
                burstFx(x, y, z, 0xe0a35c, 5, 4);
                noise(0.5, 300, 0.4 * sp.vol, sp.pan);
                if (!combatPhase()) break;
                const hits = (fx, fy, fz) => Math.hypot(fx - x, fz - z) < 6 && !segmentBlocked(x, y + 0.3, z, fx, fy + 1, fz);
                if (player.alive && team !== player.team && hits(player.x, player.y, player.z)) stunPlayer(now + 3000);
                if (isAuthority()) for (const a of actors.values()) if (a.sim && a.sim.alive && a.team !== team && hits(a.x, a.y, a.z)) a.sim.stunUntil = now + 3000;
                break;
            }
            case 'flash':
                flashBurst(x, y, z, team, now, false);
                break;
            case 'dark':
                flashBurst(x, y, z, team, now, true);
                break;
            case 'shock': {
                burstFx(x, y, z, 0x3fd17a, 3.5, 2);
                noise(0.4, 3000, 0.4 * sp.vol, sp.pan, 'highpass');
                if (!combatPhase()) break;
                if (player.alive && team !== player.team) {
                    const d = Math.hypot(player.x - x, player.y + 1 - y, player.z - z);
                    if (d < 4.5 && !segmentBlocked(x, y + 0.3, z, player.x, player.y + 1, player.z)) takeDamage(Math.round(75 * (1 - d / 6)), f, ABILITY_W, false, now, x, z);
                }
                if (isAuthority()) {
                    for (const a of actors.values()) {
                        if (!a.sim || !a.sim.alive || a.team === team) continue;
                        const d = Math.hypot(a.x - x, a.y + 1 - y, a.z - z);
                        if (d < 4.5 && !segmentBlocked(x, y + 0.3, z, a.x, a.y + 1, a.z)) botDamage(a, Math.round(75 * (1 - d / 6)), f, ABILITY_W, false, now);
                    }
                }
                break;
            }
            case 'recon': {
                const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.4, 6), new THREE.MeshBasicMaterial({ color: 0x7dffb0 }));
                mesh.position.set(x, y, z);
                scene.add(mesh);
                const zn = addZone({ kind: 'recon', x, y, z, r: 24, until: now + 3600, team, owner: f, mesh, pulses: [now + 300, now + 2300] });
                void zn;
                break;
            }
            default:
        }
    }

    // A flash pops: everyone facing it with a clear line is blinded, longer the more directly they look.
    function flashBurst(x, y, z, team, now, dark) {
        const sp = spatial(x, z);
        if (!dark) {
            burstFx(x, y, z, 0xffffff, 2, 0);
            tone(2400, 0.25, 'sine', 0.12 * sp.vol, -1200, sp.pan);
        } else {
            burstFx(x, y, z, 0x3b2a6b, 4, 3);
            noise(0.5, 400, 0.2 * sp.vol, sp.pan);
        }
        const affect = (fx, fy, fz, yaw, pitch, apply) => {
            const dx = x - fx;
            const dy = y - fy;
            const dz = z - fz;
            const dist = Math.hypot(dx, dy, dz) || 0.01;
            if (dark) { if (dist < 7) apply(3200, true); return; }
            if (dist > 45 || segmentBlocked(fx, fy, fz, x, y, z)) return;
            const cp = Math.cos(pitch);
            const facing = (-Math.sin(yaw) * cp * dx + Math.sin(pitch) * dy - Math.cos(yaw) * cp * dz) / dist;
            const ms = facing > 0.5 ? 2000 : facing > 0 ? 900 : 300;
            apply(ms * (dist > 25 ? 0.7 : 1), false);
        };
        if (player.alive && team !== player.team) {
            affect(player.x, player.y + player.eye, player.z, player.yaw, player.pitch, (ms, isDark) => {
                if (isDark) player.darkUntil = Math.max(player.darkUntil, now + ms);
                else { player.blindUntil = Math.max(player.blindUntil, now + ms); player.blindTotal = ms; }
            });
        }
        if (isAuthority()) {
            for (const a of actors.values()) {
                if (!a.sim || !a.sim.alive || a.team === team) continue;
                affect(a.x, a.y + 1.6, a.z, a.yaw, a.pitch, (ms) => { a.sim.blindUntil = Math.max(a.sim.blindUntil || 0, now + ms); });
            }
        }
    }

    function stunPlayer(until) {
        if (until > player.stunUntil + 500) banner('Sarsıldın', 'Yavaşladın, nişanın titriyor', 'enemy');
        player.stunUntil = Math.max(player.stunUntil, until);
    }

    // A fault line: dust runs along a strip, then everyone on it (walls do not stop it) is stunned.
    function quakeLine(d, team, now) {
        const q = QUAKES[d.k];
        const [x, , z] = d.p;
        const len = Math.hypot(d.v[0], d.v[2]) || 1;
        const ux = d.v[0] / len;
        const uz = d.v[2] / len;
        const steps = Math.round(q.len / 2);
        for (let i = 1; i <= steps; i++) {
            window.setTimeout(() => {
                const t = (i / steps) * q.len;
                for (const side of [-0.5, 0, 0.5]) puff(x + ux * t - uz * side * q.width, 0.2, z + uz * t + ux * side * q.width, 0xc8a070);
            }, (i / steps) * q.delay);
        }
        noise(q.delay / 1000 + 0.3, 180, 0.3 * spatial(x, z).vol, 0, 'lowpass');
        window.setTimeout(() => {
            if (!combatPhase()) return;
            const at = performance.now();
            const onStrip = (fx, fz) => {
                const t = (fx - x) * ux + (fz - z) * uz;
                const side = Math.abs(-(fx - x) * uz + (fz - z) * ux);
                return t > 0 && t < q.len && side < q.width / 2;
            };
            shake = Math.max(shake, Math.hypot(player.x - x, player.z - z) < q.len + 10 ? 0.6 : 0);
            if (player.alive && team !== player.team && onStrip(player.x, player.z)) {
                stunPlayer(at + q.stun);
                if (q.reveal) revealTo(team, player.nid, player.x, player.z, q.reveal, at);
            }
            if (isAuthority()) for (const a of actors.values()) if (a.sim && a.sim.alive && a.team !== team && onStrip(a.x, a.z)) a.sim.stunUntil = at + q.stun;
            if (q.reveal) {
                refreshFighters();
                for (const f of fighters) if (f.alive && f.team !== team && onStrip(f.x, f.z)) revealTo(team, f.nid, f.x, f.z, q.reveal, at);
            }
        }, q.delay);
    }

    function revealTo(team, nid, x, z, ms, now) {
        if (team === player.team && nid !== player.nid) reveals.set(nid, now + ms);
        teamIntel[team].set(nid, { x, z, at: now });
        if (team !== player.team && nid === player.nid) player.revealedUntil = Math.max(player.revealedUntil, now + ms);
    }
    function huntPulse(team) {
        if (!combatPhase()) return;
        const now = performance.now();
        refreshFighters();
        for (const f of fighters) if (f.alive && f.team !== team) revealTo(team, f.nid, f.x, f.z, 1500, now);
        if (team === player.team) tone(520, 0.3, 'triangle', 0.06, 300);
    }

    function updateZones(dt, now) {
        let slow = 1;
        for (const z of [...zones]) {
            if (now > z.until) { removeZone(z); continue; }
            const age = (now - z.born) / 1000;
            const left = (z.until - now) / 1000;
            if (z.kind === 'smoke') {
                const s = z.r * Math.min(1, age * 3) * Math.min(1, left * 2 + 0.2);
                z.mesh.scale.set(s, s * 0.85, s);
                z.mesh.rotation.y += dt * 0.05;
            } else if (z.kind === 'fire' || z.kind === 'slow' || z.kind === 'lock' || z.kind === 'blizzard') {
                z.mesh.material.opacity = (z.kind === 'fire' ? 0.45 + Math.sin(now / 60) * 0.12 : z.kind === 'slow' ? 0.32 : z.kind === 'blizzard' ? 0.3 + Math.sin(now / 200) * 0.05 : 0.2) * Math.min(1, left);
                if (z.kind === 'fire' && Math.random() < dt * 30) puff(z.x + rand(-z.r, z.r) * 0.7, z.y + rand(0.1, 1.2), z.z + rand(-z.r, z.r) * 0.7, Math.random() < 0.5 ? 0xff8a30 : 0xffd060);
                if (z.kind === 'blizzard' && Math.random() < dt * 45) puff(z.x + rand(-z.r, z.r) * 0.8, z.y + rand(0.3, 3.5), z.z + rand(-z.r, z.r) * 0.8, 0xf4fbff);
            } else if (z.kind === 'beacon') {
                z.mesh.material.opacity = 0.35 * Math.min(1, left) * (0.7 + 0.3 * Math.sin(now / 150));
                if (now >= z.pulseAt) {
                    z.pulseAt = now + 1500;
                    burstFx(z.x, 0.3, z.z, 0xe4e9f2, 3, 0);
                    refreshFighters();
                    if (combatPhase()) for (const f of fighters) if (f.alive && f.team !== z.team && Math.hypot(f.x - z.x, f.z - z.z) < z.r) revealTo(z.team, f.nid, f.x, f.z, 1700, now);
                }
            } else if (z.kind === 'turret') {
                updateTurret(z, now);
            } else if (z.kind === 'alarm') {
                z.mesh.material.opacity = (z.team === player.team ? 0.9 : 0.55) * (Math.sin(now / 250) > 0 ? 1 : 0.4);
                if (combatPhase()) checkAlarm(z, now);
            } else if (z.kind === 'wall') {
                z.mesh.material.opacity = 0.82 * Math.min(1, left);
            } else if (z.kind === 'recon') {
                while (z.pulses.length && now >= z.pulses[0]) {
                    z.pulses.shift();
                    tone(1200, 0.15, 'sine', 0.08 * spatial(z.x, z.z).vol);
                    burstFx(z.x, z.y, z.z, 0x7dffb0, 1.2, 0);
                    refreshFighters();
                    for (const f of fighters) {
                        if (!f.alive || f.team === z.team) continue;
                        if (Math.hypot(f.x - z.x, f.z - z.z) < z.r && canSee(z.x, z.y + 0.3, z.z, f.x, f.y + 1.2, f.z)) revealTo(z.team, f.nid, f.x, f.z, 2500, now);
                    }
                }
            }
            if (!combatPhase()) continue;
            // Effects on the local player (victim side) and on bots (host side).
            const hits = (x, y, zz) => Math.hypot(x - z.x, zz - z.z) < z.r && Math.abs(y - z.y) < 2;
            if (player.alive && z.team !== player.team && hits(player.x, player.y, player.z)) {
                if (z.kind === 'fire') takeDamage(40 * dt, z.owner, ABILITY_W, false, now, z.x, z.z, true);
                if (z.kind === 'blizzard') { takeDamage(12 * dt, z.owner, ABILITY_W, false, now, z.x, z.z, true); slow = Math.min(slow, 0.6); }
                if (z.kind === 'slow' || z.kind === 'lock') slow = Math.min(slow, 0.5);
                if (z.kind === 'lock' && (!z.seen || now > z.seen)) { z.seen = now + 1000; revealTo(z.team, player.nid, player.x, player.z, 1200, now); }
            }
            if (isAuthority()) {
                for (const a of actors.values()) {
                    if (!a.sim || !a.sim.alive || a.team === z.team || !hits(a.x, a.y, a.z)) continue;
                    if (z.kind === 'fire') botDamage(a, 40 * dt, z.owner, ABILITY_W, false, now);
                    if (z.kind === 'blizzard') { botDamage(a, 12 * dt, z.owner, ABILITY_W, false, now); a.sim.slowUntil = now + 150; }
                    if (z.kind === 'slow' || z.kind === 'lock') a.sim.slowUntil = now + 150;
                    if (z.kind === 'lock') revealTo(z.team, a.nid, a.x, a.z, 1200, now);
                }
            }
            if (z.kind === 'lock') {
                for (const a of actors.values()) if (a.alive && a.team !== z.team && hits(a.x, a.y, a.z)) revealTo(z.team, a.nid, a.x, a.z, 1200, now);
            }
            if (z.kind === 'trip') checkTrip(z, now);
        }
        player.zoneSlow = slow;
    }

    // A turret shoots the nearest enemy it can see: the victim's side applies its own damage,
    // the host does it for bots. Everyone turns the head for the look.
    function updateTurret(z, now) {
        if (!combatPhase()) return;
        let best = null;
        for (const f of fighters) {
            if (!f.alive || f.team === z.team) continue;
            const dist = Math.hypot(f.x - z.x, f.z - z.z);
            if (dist > z.r || (best && dist > best.dist)) continue;
            if (!canSee(z.x, z.y, z.z, f.x, f.y + 1.2 * (STANCE_SCALE[f.stance] || 1), f.z)) continue;
            best = { f, dist };
        }
        if (!best) return;
        const { f } = best;
        z.head.parent.rotation.y += angleDiff(z.head.parent.rotation.y, Math.atan2(-(f.x - z.x), -(f.z - z.z))) * 0.25;
        const last = z.shots.get(f.nid) || 0;
        if (now - last < 320) return;
        z.shots.set(f.nid, now);
        const sp = spatial(z.x, z.z);
        tone(1400, 0.04, 'square', 0.05 * sp.vol, -400, sp.pan);
        if (sp.dist < 60) tracer(z.x, z.y + 0.05, z.z, f.x, f.y + 1.1, f.z);
        if (now - last > 3000) revealTo(z.team, f.nid, f.x, f.z, 1500, now);
        if (f.nid === player.nid) takeDamage(8, z.owner, ABILITY_W, false, now, z.x, z.z);
        else if (isAuthority()) { const a = actors.get(f.nid); if (a && a.sim) botDamage(a, 8, z.owner, ABILITY_W, false, now); }
    }
    function damageTurret(id, dmg) {
        const z = zones.find((q) => q.kind === 'turret' && q.id === id);
        if (!z || z.team === player.team) return;
        z.hp -= dmg;
        if (z.hp > 0) return;
        destroyTurret(id);
        sendEvent({ t: 'zd', id });
    }
    function destroyTurret(id) {
        const z = zones.find((q) => q.kind === 'turret' && q.id === id);
        if (!z) return;
        burstFx(z.x, z.y, z.z, 0xffffff, 2, 3);
        noise(0.3, 1500, 0.2 * spatial(z.x, z.z).vol);
        removeZone(z);
    }

    // An alarm trips once: the first enemy close enough and in sight is slowed and shown.
    function checkAlarm(z, now) {
        for (const f of fighters) {
            if (!f.alive || f.team === z.team || Math.hypot(f.x - z.x, f.z - z.z) > z.r || !canSee(z.x, z.y + 0.3, z.z, f.x, f.y + 1, f.z)) continue;
            revealTo(z.team, f.nid, f.x, f.z, 4000, now);
            if (f.nid === player.nid) { player.tagUntil = now + 2000; banner('Alarm', 'Yavaşladın ve yerin görünüyor', 'enemy'); }
            const a = actors.get(f.nid);
            if (a && a.sim) a.sim.slowUntil = now + 2000;
            tone(1000, 0.4, 'square', 0.08 * spatial(z.x, z.z).vol, 300);
            removeZone(z);
            return;
        }
    }

    // Crossing a tripwire flips which side of the line you are on.
    function checkTrip(z, now) {
        const side = (x, zz) => Math.sign((z.bx - z.ax) * (zz - z.az) - (z.bz - z.az) * (x - z.ax));
        for (const f of fighters) {
            if (!f.alive || f.team === z.team) continue;
            const along = ((f.x - z.ax) * (z.bx - z.ax) + (f.z - z.az) * (z.bz - z.az)) / ((z.r * 2) ** 2 || 1);
            const s = side(f.x, f.z);
            const prev = z.sides.get(f.nid);
            z.sides.set(f.nid, s);
            if (prev === undefined || prev === s || along < -0.05 || along > 1.05 || f.y > 1.2) continue;
            revealTo(z.team, f.nid, f.x, f.z, 4000, now);
            if (f.nid === player.nid) { player.tagUntil = now + 2000; banner('Tuzak teli', 'Yavaşladın ve yerin görünüyor', 'enemy'); }
            const a = actors.get(f.nid);
            if (a && a.sim) a.sim.slowUntil = now + 2000;
            tone(900, 0.3, 'square', 0.08 * spatial(z.x, z.z).vol, -500);
            removeZone(z);
            return;
        }
    }

    const BUY_PHASE_KINDS = ['smoke', 'icesmoke', 'cloud', 'wall', 'icewall', 'trip', 'heal', 'turret', 'alarm', 'updraft', 'shieldup'];
    // Local player uses an ability slot (c, q, e, x).
    function useAbility(slot, now) {
        if (slot === 'x' && player.alive && now < player.bladesUntil) { equip(W.blades); return; }
        if (!canAct() || match.phase === 'buy' && !BUY_PHASE_KINDS.includes(AGENTS[player.agent].abilities[slot].kind)) {
            if (match.phase === 'buy') toast('Satın alma evresinde bu yetenek kullanılamaz.');
            return;
        }
        const ab = AGENTS[player.agent].abilities[slot];
        if (slot === 'x') {
            if (player.ult < ULT_COST) { toast(`Nihai yetenek için ${ULT_COST - player.ult} puan daha gerek.`); return; }
        } else if (player.charges[slot] <= 0) { toast(`${ab.name} kalmadı.`); return; }
        const ev = castAbility(player.nid, ab.kind, player, now);
        if (!ev) return;
        if (slot === 'x') player.ult = 0; else player.charges[slot]--;
        updateAbilityHud();
    }

    // Builds the event for a caster (the local player or a bot) and runs it everywhere.
    function castAbility(f, kind, c, now) {
        const ey = c.y + (c.eye || 1.6);
        const cp = Math.cos(c.pitch);
        const dx = -Math.sin(c.yaw) * cp;
        const dy = Math.sin(c.pitch);
        const dz = -Math.cos(c.yaw) * cp;
        const p = [round2(c.x + dx * 0.6), round2(ey + dy * 0.6 - 0.1), round2(c.z + dz * 0.6)];
        let d = null;
        if (THROWN[kind]) {
            const spec = THROWN[kind];
            d = { k: kind, p, v: [round2(dx * spec.speed), round2(dy * spec.speed + spec.up), round2(dz * spec.speed)], id: (f * 64) + (abilitySeq++ & 63) };
        } else if (kind === 'smoke' || kind === 'icesmoke' || kind === 'cloud' || kind === 'blizzard' || kind === 'alarm') {
            const a = c === player ? aimPoint(PLACED[kind]) : c.aim;
            if (!a) return null;
            d = { k: kind, p: [round2(a.x), 1.8, round2(a.z)] };
        } else if (kind === 'turret') {
            const a = c === player ? aimPoint(PLACED[kind]) : c.aim;
            if (!a) return null;
            d = { k: kind, p: [round2(a.x), 0, round2(a.z)], v: [round2(dx), 0, round2(dz)], id: (f * 64) + (abilitySeq++ & 63) };
        } else if (kind === 'quake' || kind === 'rupture') {
            const len = Math.hypot(dx, dz) || 1;
            d = { k: kind, p: [round2(c.x), 0, round2(c.z)], v: [round2(dx / len), 0, round2(dz / len)] };
        } else if (kind === 'smokewall') {
            const len = Math.hypot(dx, dz) || 1;
            d = { k: kind, p: [round2(c.x), 0, round2(c.z)], v: [round2(dx / len), 0, round2(dz / len)] };
        } else if (kind === 'wall' || kind === 'icewall') {
            const a = c === player ? aimPoint(PLACED[kind]) : c.aim;
            if (!a) return null;
            d = { k: kind, p: [round2(a.x), 0, round2(a.z)], v: [round2(dx), 0, round2(dz)] };
        } else if (kind === 'trip') {
            const a = c === player ? aimPoint(12) : c.aim;
            if (!a) return null;
            const alongX = Math.abs(dz) > Math.abs(dx);
            const ux = alongX ? 1 : 0;
            const uz = alongX ? 0 : 1;
            const ta = Math.min(10, rayDistance(a.x, 0.4, a.z, -ux, 0, -uz, 10));
            const tb = Math.min(10, rayDistance(a.x, 0.4, a.z, ux, 0, uz, 10));
            if (ta + tb < 1.5) { if (c === player) toast('Tel için iki duvar arasına nişan al.'); return null; }
            d = { k: kind, p: [round2(a.x - ux * ta), 0, round2(a.z - uz * ta), round2(a.x + ux * tb), 0, round2(a.z + uz * tb)] };
        } else if (kind === 'dash') {
            const len = Math.hypot(dx, dz) || 1;
            if (c === player) { player.dashUntil = now + 220; player.dashX = dx / len; player.dashZ = dz / len; }
            else if (c.sim) { c.sim.dashUntil = now + 220; c.sim.dashX = dx / len; c.sim.dashZ = dz / len; }
            d = { k: kind, p: [round2(c.x), 0, round2(c.z)] };
        } else {
            d = { k: kind, p: [round2(c.x), round2(c.y), round2(c.z)] };
        }
        d.t = 'ab';
        d.f = f;
        sendEvent(d);
        applyAbility(d, now);
        return d;
    }

    /* ---------- Oyuncu: hareket, nişan, ateş ---------- */

    let pointerLocked = false;
    let mouseDown = false;
    let touchMode = false;
    let buyOpen = false;
    const keys = {};
    const touch = { moveId: null, lookId: null, mx: 0, my: 0, lx: 0, ly: 0, fire: false, crouch: false, walk: false, jumpUntil: 0, use: false };
    const vel = { x: 0, z: 0 };

    function readInput(now) {
        let fwd = 0;
        let side = 0;
        if (keys.KeyW || keys.ArrowUp) fwd += 1;
        if (keys.KeyS || keys.ArrowDown) fwd -= 1;
        if (keys.KeyA || keys.ArrowLeft) side -= 1;
        if (keys.KeyD || keys.ArrowRight) side += 1;
        if (touch.moveId !== null) { fwd -= touch.my; side += touch.mx; }
        return {
            fwd, side,
            walk: Boolean(keys.ShiftLeft || keys.ShiftRight) || touch.walk,
            // Ctrl+W closes the tab and pages cannot stop it, so crouch is Z.
            crouch: Boolean(keys.KeyZ) || touch.crouch,
            jump: Boolean(keys.Space) || now < touch.jumpUntil,
            use: Boolean(keys.KeyF) || touch.use
        };
    }

    function weaponOf() { return WEAPONS[player.slot]; }
    function moveSpeedCap(input) {
        const w = weaponOf();
        let sp = SPEED.run * (w.speed || 1);
        if (player.stance === 1) sp = SPEED.crouch;
        else if (input.walk) sp = SPEED.walk;
        if (player.ads && w.id === 'yayla') sp *= 0.55;
        else if (player.ads) sp *= 0.8;
        if (performance.now() < player.buffUntil) sp *= 1.15;
        if (performance.now() < player.tagUntil) sp *= 0.72;
        if (performance.now() < player.stunUntil) sp *= 0.65;
        return sp * (player.zoneSlow || 1);
    }

    function updatePlayer(dt, now) {
        const input = readInput(now);
        player.walking = input.walk;
        player.stance = input.crouch || (player.stance === 1 && ceilingAt(player.x, player.z, player.y, EYE_STAND) !== null) ? 1 : 0;
        const sy = Math.sin(player.yaw);
        const cy = Math.cos(player.yaw);
        let ix = -sy * input.fwd + cy * input.side;
        let iz = -cy * input.fwd - sy * input.side;
        const il = Math.hypot(ix, iz);
        if (il > 1) { ix /= il; iz /= il; }
        // Planting and defusing root you in place; any movement cancels them.
        if (player.action) {
            if (il > 0.2 || !input.use) cancelAction();
            else { ix = 0; iz = 0; }
        }
        const cap = moveSpeedCap(input);
        const tx = ix * cap;
        const tz = iz * cap;
        // Fast acceleration and even faster braking: counter-strafing stops you almost at once.
        const accel = il > 0.1 ? 14 : 22;
        vel.x += (tx - vel.x) * Math.min(1, dt * accel);
        vel.z += (tz - vel.z) * Math.min(1, dt * accel);
        if (!player.onGround) { vel.x = lerp(vel.x, tx, Math.min(1, dt * 2)); vel.z = lerp(vel.z, tz, Math.min(1, dt * 2)); }
        let vx = vel.x;
        let vz = vel.z;
        if (now < player.dashUntil) { vx = player.dashX * 19; vz = player.dashZ * 19; }
        const nx = player.x + vx * dt;
        const nz = player.z + vz * dt;
        let moved = false;
        if (!blocked(nx, player.z, player.y)) { player.x = nx; moved = true; } else vel.x = 0;
        if (!blocked(player.x, nz, player.y)) { player.z = nz; moved = true; } else vel.z = 0;
        player.speedNow = moved ? Math.hypot(vx, vz) : 0;
        player.x = clamp(player.x, -HALF_X + 1, HALF_X - 1);
        player.z = clamp(player.z, -HALF_Z + 1, HALF_Z - 1);

        if (input.jump && player.onGround && !player.action) {
            player.velY = JUMP;
            player.onGround = false;
            touch.jumpUntil = 0;
            noise(0.08, 500, 0.05);
        }
        player.velY += GRAVITY * dt;
        player.y += player.velY * dt;
        if (player.velY > 0) {
            const c = ceilingAt(player.x, player.z, player.y, EYE_STAND + 0.1);
            if (c !== null) { player.y = c - EYE_STAND - 0.1; player.velY = 0; }
        }
        const gy = groundAt(player.x, player.z, player.y);
        if (player.y <= gy && player.velY <= 0) {
            if (!player.onGround && player.velY < -6) noise(0.12, 500, 0.14);
            player.y = gy;
            player.velY = 0;
            player.onGround = true;
        } else player.onGround = false;

        const eyeT = player.stance === 1 ? EYE_CROUCH : EYE_STAND;
        player.eye += (eyeT - player.eye) * Math.min(1, dt * 14);

        // Running is loud; walking (Shift) and crouching are silent.
        if (player.onGround && player.speedNow > 4.5) {
            player.stepT += dt * player.speedNow;
            if (player.stepT > 2.4) { player.stepT = 0; noise(0.07, 650, 0.045); }
        }
        if (player.healLeft > 0) {
            const h = Math.min(player.healLeft, 20 * dt);
            player.healLeft -= h;
            player.hp = Math.min(100, player.hp + h);
        }
        if (player.slot === W.blades && (now > player.bladesUntil || ammoOf(W.blades)[0] <= 0) && now >= player.nextShot) {
            player.bladesUntil = 0;
            equip(player.primary >= 0 ? player.primary : player.secondary);
        }
        updateAction(input, now);
    }

    /* ---- Silah ---- */

    function ammoOf(idx) {
        if (!player.ammo[idx]) player.ammo[idx] = [WEAPONS[idx].mag || 0, WEAPONS[idx].reserve || 0];
        return player.ammo[idx];
    }
    function equip(idx) {
        if (idx === player.slot || !player.alive || player.action) return;
        if (idx === player.primary || idx === player.secondary || idx === W.knife || (idx === W.spike && player.hasSpike) || (idx === W.blades && performance.now() < player.bladesUntil)) {
            player.slot = idx;
            player.reloading = false;
            player.ads = false;
            player.spray = 0;
            player.nextShot = Math.max(player.nextShot, performance.now() + (WEAPONS[idx].melee ? 150 : 400));
            vmSwap = 1;
            tone(500, 0.04, 'square', 0.03);
            updateHud();
        }
    }
    function equipSlot(n) {
        if (n === 1 && player.primary >= 0) equip(player.primary);
        if (n === 2) equip(player.secondary);
        if (n === 3) equip(W.knife);
        if (n === 4 && player.hasSpike) equip(W.spike);
    }
    function startReload() {
        const w = weaponOf();
        if (!w.mag || player.reloading || !player.alive) return;
        const am = ammoOf(player.slot);
        if (am[0] >= w.mag || am[1] <= 0) return;
        player.reloading = true;
        player.reloadStart = performance.now();
        player.ads = false;
        tone(300, 0.05, 'square', 0.03);
        updateHud();
    }
    function finishReload() {
        const w = weaponOf();
        const am = ammoOf(player.slot);
        const take = Math.min(w.mag - am[0], am[1]);
        am[0] += take;
        am[1] -= take;
        player.reloading = false;
        tone(420, 0.05, 'square', 0.03);
        updateHud();
    }

    function currentSpread(w) {
        if (w.melee || !w.spread) return 0;
        const moveFrac = clamp((player.speedNow - 0.6) / (SPEED.run - 0.6), 0, 1);
        let s = (w.id === 'yayla' && player.ads ? w.scoped : w.spread) + w.move * Math.pow(moveFrac, 1.15);
        if (!player.onGround) s += 0.14;
        if (performance.now() < player.stunUntil) s += 0.05;
        if (player.stance === 1) s *= 0.85;
        if (player.ads && w.id !== 'yayla') s *= 0.8;
        if (w.pattern === 'rifle') s += Math.max(0, player.spray - 3) * 0.0032;
        else if (w.pattern === 'smg') s += player.spray * 0.0018;
        else s += Math.min(player.spray, 6) * 0.004;
        return s;
    }
    // Deterministic spray: up first, then a left-right sway, like the genre's rifles.
    function recoilOffset(w, i) {
        if (w.pattern === 'rifle') return [i > 8 ? Math.sin((i - 8) * 0.85) * 0.022 : 0, i < 3 ? i * 0.004 : Math.min(0.012 + (i - 3) * 0.0075, 0.075)];
        if (w.pattern === 'smg') return [Math.sin(i * 1.3) * 0.01 * Math.min(1, i / 5), Math.min(i * 0.005, 0.045)];
        return [0, Math.min(i * 0.01, 0.035)];
    }

    const raycaster = new THREE.Raycaster();
    const muzzlePos = new THREE.Vector3();
    const tmpDir = new THREE.Vector3();
    let vmKick = 0;
    let vmSwap = 0;
    let bobT = 0;
    let flashUntil = 0;

    function tryShoot(now, heavy) {
        const w = weaponOf();
        if (!canAct() || match.phase === 'buy' || player.reloading || player.action || now < player.nextShot || w.id === 'spike') return;
        if (w.melee) { knifeAttack(now, heavy); return; }
        const am = ammoOf(player.slot);
        if (am[0] <= 0) { if (w.reserve) startReload(); tone(180, 0.05, 'square', 0.03); return; }
        am[0]--;
        if (now - player.lastShotAt > w.delay + 260) player.spray = 0;
        const [ry, rp] = recoilOffset(w, player.spray);
        const spread = currentSpread(w);
        player.spray++;
        player.nextShot = now + w.delay * (now < player.buffUntil ? 0.85 : 1);
        player.fireSeq = (player.fireSeq + 1) & 3;
        player.lastShotAt = now;
        flashUntil = now + 55;
        vmKick = 1;
        muzzleLight.intensity = w.silent ? 0.6 : 2.2;
        shotSound(w.id, 1);
        // The view climbs a little; most of the recoil only moves the bullets.
        player.kickPitch += w.kick * 0.35 * (now < player.buffUntil ? 0.6 : 1);
        if (w.id === 'yayla' && player.ads) window.setTimeout(() => { player.ads = false; }, 120);
        camera.rotation.set(player.pitch + player.kickPitch, player.yaw, 0);
        camera.updateMatrixWorld(true);
        muzzlePos.set(0.16, -0.14, -0.9);
        camera.localToWorld(muzzlePos);

        const targets = [];
        for (const a of actors.values()) if (a.alive && a.body && a.team !== player.team && (a.sim || a.lastPacket)) targets.push(a.group);
        for (const o of occluders) targets.push(o);
        raycaster.far = 300;
        const dmgBy = {};
        const headBy = {};
        for (let p = 0; p < (w.pellets || 1); p++) {
            const yaw = player.yaw + ry * (p ? 0 : 1) + (Math.random() * 2 - 1) * spread;
            const pitch = player.pitch + player.kickPitch + rp + (Math.random() * 2 - 1) * spread;
            tmpDir.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
            raycaster.set(camera.position, tmpDir);
            const hits = raycaster.intersectObjects(targets, true);
            const end = hits.length ? hits[0].point : raycaster.ray.at(150, new THREE.Vector3());
            if (p < 2 && !w.silent) tracer(muzzlePos.x, muzzlePos.y, muzzlePos.z, end.x, end.y, end.z);
            if (!hits.length) continue;
            const h = hits[0];
            let o = h.object;
            let nid = null;
            while (o) { if (o.userData && o.userData.nid) { nid = o.userData.nid; break; } o = o.parent; }
            if (h.object.userData.zoneId !== undefined) damageTurret(h.object.userData.zoneId, weaponDamage(w, 'body', h.distance));
            if (nid) {
                const a = actors.get(nid);
                const part = h.object.userData.head ? 'head' : h.point.y < a.y + 0.8 * (STANCE_SCALE[a.stance] || 1) ? 'leg' : 'body';
                if (part === 'head') headBy[nid] = true;
                dmgBy[nid] = (dmgBy[nid] || 0) + weaponDamage(w, part, h.distance);
                puff(h.point.x, h.point.y, h.point.z, 0xff3a4c);
            } else puff(h.point.x, h.point.y, h.point.z);
        }
        for (const nid in dmgBy) {
            const target = Number(nid);
            const a = actors.get(target);
            if (a) a.hitUntil = now + 90;
            deliverHit(player.nid, target, Math.round(dmgBy[nid]), player.slot, Boolean(headBy[nid]), now);
            if (headBy[nid]) tone(2600, 0.06, 'sine', 0.07);
        }
        if (am[0] === 0 && w.reserve) window.setTimeout(startReload, 220);
        updateHud();
    }

    function knifeAttack(now, heavy) {
        const w = WEAPONS[W.knife];
        player.nextShot = now + (heavy ? 1000 : w.delay);
        vmKick = 1;
        noise(0.12, 2600, 0.12, 0, 'bandpass');
        refreshFighters();
        const fx = -Math.sin(player.yaw);
        const fz = -Math.cos(player.yaw);
        let best = null;
        for (const f of fighters) {
            if (f.nid === player.nid || !f.alive || f.team === player.team) continue;
            const dx = f.x - player.x;
            const dz = f.z - player.z;
            const d = Math.hypot(dx, dz);
            if (d < 2.4 && (dx * fx + dz * fz) / (d || 1) > 0.6 && (!best || d < best.d)) best = { f, d };
        }
        if (best) {
            deliverHit(player.nid, best.f.nid, heavy ? w.heavy : w.dmg, W.knife, false, now);
            tone(160, 0.08, 'square', 0.06);
        }
    }

    /* ---------- Hasar, ölüm, ekonomi ---------- */

    function deliverHit(from, to, d, w, hs, now) {
        if (to === player.nid) { const f = fighterById(from); takeDamage(d, from, w, hs, now, f?.x, f?.z); return; }
        const a = actors.get(to);
        if (a && a.sim) { botDamage(a, d, from, w, hs, now); return; }
        const msg = { t: 'h', f: from, to, d, w, hs: hs ? 1 : 0 };
        if (match.mode === 'client') sendTo(conns[0], msg);
        else if (match.mode === 'host') sendTo(conns.find((c) => c.nid === to), msg);
    }

    function absorb(target, d) {
        const a = Math.min(target.armor, d);
        target.armor -= a;
        target.hp -= d - a;
    }

    function takeDamage(d, from, w, hs, now, sx, sz, silent) {
        if (!player.alive || !combatPhase() || d <= 0) return;
        if (teamOf(from) === player.team && from !== player.nid) return;
        absorb(player, d);
        if (player.hp <= 0 && match.mode === 'solo' && cheatOn('immortal')) player.hp = 1;
        player.hp = Math.max(0, player.hp);
        player.lastHurt = now;
        if (!silent) {
            player.tagUntil = now + 260;
            const flash = $('dmgflash');
            flash.style.setProperty('--flash', String(clamp(d / 50, 0.3, 1)));
            flash.classList.remove('on');
            void flash.offsetWidth;
            flash.classList.add('on');
            if (Number.isFinite(sx) && from !== player.nid) damageIndicator(sx, sz);
            tone(170, 0.1, 'sawtooth', 0.05, -60);
        }
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
        player.reloading = false;
        player.ads = false;
        mouseDown = false;
        touch.fire = false;
        cancelAction();
        player.killer = from;
        player.bladesUntil = 0;
        player.stunUntil = 0;
        player.spectate = 0;
        player.spectateAt = now + 2500; // death cam on the killer first, then follow a teammate
        player.primary = -1;
        player.secondary = W.pim;
        player.armor = 0;
        const msg = { t: 'k', k: from, v: player.nid, w, hs: hs ? 1 : 0, p: [round2(player.x), round2(player.y), round2(player.z)] };
        sendEvent(msg);
        applyKill(from, player.nid, w, hs, now, msg.p);
        $('death-by').textContent = from === player.nid ? 'Kendi yeteneğin' : `${nameOf(from)} · ${weaponLabel(w, from)}${hs ? ' · kafadan' : ''}`;
        $('death').classList.remove('hidden');
    }

    function weaponLabel(w, from) {
        if (w === ABILITY_W) return 'yetenek';
        void from;
        return WEAPONS[w]?.name || '?';
    }

    function botDamage(a, d, from, w, hs, now) {
        const s = a.sim;
        if (!s.alive || !combatPhase() || d <= 0 || teamOf(from) === a.team) return;
        absorb(s, d);
        s.hurtBy = from;
        s.hurtAt = now;
        s.tagUntil = now + 260;
        a.hitUntil = now + 90;
        if (s.hp > 0) return;
        s.alive = false;
        setAlive(a, false, now);
        const msg = { t: 'k', k: from, v: a.nid, w, hs: hs ? 1 : 0, p: [round2(a.x), round2(a.y), round2(a.z)] };
        if (match.mode === 'host') broadcast(msg);
        applyKill(from, a.nid, w, hs, now, msg.p);
    }

    // Everyone runs this for every death: score, killfeed, credits, ult points and the spike drop.
    function applyKill(k, v, w, hs, now, pos) {
        const ks = roster.get(k);
        const vs = roster.get(v);
        if (vs) vs.deaths++;
        if (ks && k !== v && ks.team !== vs?.team) ks.kills++;
        const a = actors.get(v);
        if (a) { setAlive(a, false, now); a.deadLock = now + 1500; }
        if (match.roundStats) match.roundStats.kills[k] = (match.roundStats.kills[k] || 0) + 1;
        const killerTeam = teamOf(k);
        feed(k, v, w, hs, killerTeam === player.team);
        if (k === player.nid && v !== player.nid) {
            if (w === W.blades && now < player.bladesUntil) player.ammo[W.blades] = [WEAPONS[W.blades].mag, 0];
            player.credits = Math.min(ECON.max, player.credits + ECON.kill);
            player.ult = Math.min(ULT_COST, player.ult + 1);
            const n = match.roundStats ? match.roundStats.kills[player.nid] : 1;
            killBanner(n, hs);
            updateAbilityHud();
        }
        if (v === player.nid) player.ult = Math.min(ULT_COST, player.ult + 1);
        if (isAuthority()) {
            for (const b of actors.values()) {
                if (!b.sim) continue;
                if (b.nid === k && k !== v) {
                    b.sim.credits = Math.min(ECON.max, b.sim.credits + ECON.kill);
                    b.sim.ult = Math.min(ULT_COST, b.sim.ult + 1);
                    if (w === W.blades && now < b.sim.bladesUntil) b.sim.ammo[W.blades] = [WEAPONS[W.blades].mag, 0];
                }
                if (b.nid === v) b.sim.ult = Math.min(ULT_COST, b.sim.ult + 1);
            }
            if (spike.state === 'carried' && spike.carrier === v && pos) dropSpike(pos, now);
            checkElimination(now);
        }
        updateTeamHud();
    }

    /* ---- Çekirdek: kurma ve çözme (yerel oyuncu) ---- */

    function cancelAction() {
        if (!player.action) return;
        player.action = null;
        $('action').classList.add('hidden');
    }
    function updateAction(input, now) {
        if (!input.use || !combatPhase()) { cancelAction(); return; }
        if (!player.action) {
            if (player.hasSpike && match.phase === 'round' && mySide() === ATK && inSite(player.x, player.z) && player.onGround) {
                player.action = 'plant';
                player.actionStart = now;
                equip(W.spike);
                tone(500, 0.1, 'square', 0.05);
            } else if (match.phase === 'planted' && mySide() === DEF && Math.hypot(player.x - spike.x, player.z - spike.z) < 1.8) {
                player.action = 'defuse';
                player.actionStart = now - (spike.halfBy?.[player.nid] ? TIMES.defuseHalf : 0);
                tone(700, 0.1, 'square', 0.05);
            } else return;
            vel.x = 0;
            vel.z = 0;
        }
        const total = player.action === 'plant' ? TIMES.plant : TIMES.defuse;
        const done = now - player.actionStart;
        $('action').classList.remove('hidden');
        $('action-label').textContent = player.action === 'plant' ? 'ÇEKİRDEK KURULUYOR' : 'ÇEKİRDEK ÇÖZÜLÜYOR';
        $('action-fill').style.width = `${clamp(done / total, 0, 1) * 100}%`;
        if (player.action === 'defuse' && done >= TIMES.defuseHalf) { spike.halfBy = spike.halfBy || {}; spike.halfBy[player.nid] = true; }
        if (done < total) return;
        const what = player.action;
        cancelAction();
        if (what === 'plant') {
            const p = [round2(player.x), round2(player.y), round2(player.z)];
            if (isAuthority()) plantSpike(player.nid, p, now);
            else sendTo(conns[0], { t: 'pl', f: player.nid, p });
            equip(player.primary >= 0 ? player.primary : player.secondary);
        } else if (isAuthority()) defuseSpike(player.nid, now);
        else sendTo(conns[0], { t: 'df', f: player.nid });
    }

    /* ---------- Raunt ve maç akışı ---------- */

    const halfRounds = () => match.winTarget - 1;
    const spikeMesh = (() => {
        const g = makeWeapon('spike', 'standard');
        g.scale.setScalar(2.2);
        g.visible = false;
        scene.add(g);
        return g;
    })();
    const spikeLight = new THREE.PointLight(0xff4a3c, 0, 6, 2);
    scene.add(spikeLight);

    function resetLoadout(full) {
        player.primary = -1;
        player.secondary = W.pim;
        player.slot = W.pim;
        player.armor = 0;
        player.ammo = {};
        if (full) {
            player.credits = ECON.start;
            player.charges = { c: 0, q: 0, e: 0 };
            player.ult = 0;
        }
    }

    // Everyone runs this when a round starts (authority first, clients from the 'rs' event).
    function beginRoundLocal(d, now) {
        const swapped = d.half !== match.half;
        match.round = d.rn;
        match.half = d.half;
        match.score = d.sc.slice();
        match.phase = 'buy';
        match.timer = d.tm;
        match.roundStats = { kills: {}, plantedBy: 0 };
        if (d.rn === 1 || swapped) {
            resetLoadout(true);
            match.lossStreak = [0, 0];
            if (swapped && d.rn > 1) banner('Devre arası', `Taraflar değişti · artık ${SIDE_NAMES[mySide()]}`, 'neutral');
        }
        if (!player.alive) resetLoadout(false);
        const ab = AGENTS[player.agent].abilities;
        player.charges.e = Math.max(player.charges.e, ab.e.free || 0);
        for (const [idx] of Object.entries(player.ammo)) player.ammo[idx] = [WEAPONS[idx].mag, WEAPONS[idx].reserve];
        player.boughtThisRound = {};
        clearAbilities();
        clearEffects();
        setBarriers(true);
        spike.state = 'carried';
        spike.carrier = d.carrier || 0;
        spike.site = '';
        spike.halfBy = {};
        player.hasSpike = spike.carrier === player.nid;
        for (const a of actors.values()) a.hasSpike = spike.carrier === a.nid;
        spikeMesh.visible = false;
        spikeLight.intensity = 0;
        respawnLocal(d.slot?.[player.nid] ?? 0);
        $('revealed').classList.add('hidden');
        $('death').classList.add('hidden');
        $('over').classList.add('hidden');
        showRoundBanner(`RAUNT ${d.rn}`, `${d.rn === 1 ? `${MAPS[mapId].name} · ` : ''}${SIDE_NAMES[mySide()]} · Satın alma evresi`, 'neutral');
        if (player.hasSpike) toast('Çekirdek sende. Bir bölgeye götürüp F tuşunu basılı tutarak kur.');
        updateHud();
        updateAbilityHud();
        updateTeamHud();
        void now;
    }

    function respawnLocal(index) {
        const pts = SPAWN_POINTS[mySide()];
        const sp = pts[index % pts.length];
        Object.assign(player, {
            x: sp.x + rand(-0.4, 0.4), z: sp.z + rand(-0.4, 0.4), y: 0, velY: 0, pitch: 0, stance: 0, eye: EYE_STAND,
            yaw: mySide() === ATK ? 0 : Math.PI, hp: 100, alive: true, reloading: false, action: null, kickPitch: 0,
            blindUntil: 0, darkUntil: 0, tagUntil: 0, buffUntil: 0, healLeft: 0, dashUntil: 0, spray: 0, stunUntil: 0, bladesUntil: 0
        });
        vel.x = 0;
        vel.z = 0;
        player.slot = player.primary >= 0 ? player.primary : player.secondary;
        document.querySelectorAll('.tbtn.on').forEach((b) => b.classList.remove('on'));
    }

    // ---- Authority side (solo or host) ----

    function startRound(now) {
        const nextRound = match.round + 1;
        const half = nextRound > halfRounds() ? 1 : 0;
        const prevHalf = match.half;
        match.half = half;
        const atkList = [...roster].filter(([, r]) => (r.team + half) % 2 === ATK).map(([nid]) => nid);
        match.half = prevHalf;
        const carrier = atkList.length ? pick(atkList) : 0;
        const slot = {};
        const counters = [0, 0];
        for (const [nid, r] of roster) { const side = (r.team + half) % 2; slot[nid] = counters[side]++; }
        for (const team of [0, 1]) teamPlan[team] = { site: pick(siteNames()), lurker: match.size >= 5 ? 4 : -1, go: false };
        const d = { t: 'rs', rn: nextRound, half, sc: match.score, tm: TIMES.buy, carrier, slot };
        if (match.mode === 'host') broadcast(d);
        beginRoundLocal(d, now);
        for (const a of actors.values()) if (a.sim) botRoundStart(a, slot[a.nid], half !== prevHalf || nextRound === 1, now);
        match.syncAt = 0;
    }

    function setPhase(phase, timer) {
        match.phase = phase;
        match.timer = timer;
        if (phase === 'round') { setBarriers(false); showRoundBanner('RAUNT BAŞLADI', mySide() === ATK ? 'Çekirdeği kur' : 'Bölgeleri savun', 'neutral'); buyOpen && toggleBuy(false); }
        if (match.mode === 'host') broadcast({ t: 'ph', ph: phase, tm: Math.round(timer) });
    }

    function aliveOnSide(side) {
        let n = 0;
        if (player.alive && mySide() === side && inMatch()) n++;
        for (const a of actors.values()) if (a.alive && sideOf(a.team) === side) n++;
        return n;
    }
    function checkElimination(now) {
        if (!combatPhase()) return;
        const atk = aliveOnSide(ATK);
        const def = aliveOnSide(DEF);
        const teamOfSide = (side) => (side - match.half + 2) % 2;
        if (def === 0) endRound(teamOfSide(ATK), 'elim', now);
        else if (atk === 0 && match.phase === 'round') endRound(teamOfSide(DEF), 'elim', now);
    }

    function endRound(winnerTeam, why, now) {
        if (!combatPhase() && match.phase !== 'buy') return;
        match.score[winnerTeam]++;
        const d = { t: 're', w: winnerTeam, why, sc: match.score };
        if (match.mode === 'host') broadcast(d);
        applyRoundEnd(d, now);
        match.phase = 'post';
        match.timer = TIMES.post;
    }

    // Everyone: economy and banners at the end of a round.
    function applyRoundEnd(d, now) {
        match.score = d.sc.slice();
        match.phase = 'post';
        match.timer = TIMES.post;
        cancelAction();
        const reward = (team) => {
            if (team === d.w) { match.lossStreak[team] = 0; return ECON.win; }
            match.lossStreak[team] = Math.min(3, match.lossStreak[team] + 1);
            return ECON.loss[match.lossStreak[team] - 1];
        };
        const gains = [reward(0), reward(1)];
        player.credits = Math.min(ECON.max, player.credits + gains[player.team]);
        if (isAuthority()) for (const a of actors.values()) if (a.sim) a.sim.credits = Math.min(ECON.max, a.sim.credits + gains[a.team]);
        const won = d.w === player.team;
        const why = { elim: won ? 'Düşman takım temizlendi' : 'Takımın temizlendi', boom: 'Çekirdek patladı', defuse: 'Çekirdek çözüldü', time: 'Süre doldu' }[d.why] || '';
        showRoundBanner(won ? 'RAUNT KAZANILDI' : 'RAUNT KAYBEDİLDİ', why, won ? 'win' : 'loss');
        if (won) chord([523, 659, 784, 1046], 0.35, 'triangle', 0.07); else chord([392, 330, 262], 0.4, 'triangle', 0.06);
        if (d.why === 'boom') { burstFx(spike.x, spike.y + 1, spike.z, 0xff8a3c, 18, 7); shake = Math.max(shake, clamp(1 - spatial(spike.x, spike.z).dist / 60, 0, 1)); noise(1.6, 300, 1.2 * spatial(spike.x, spike.z, 160).vol); }
        updateTeamHud();
        void now;
    }

    function plantSpike(nid, p, now) {
        if (match.phase !== 'round' || spike.carrier !== nid) return;
        const site = inSite(p[0], p[2]);
        if (!site) return;
        const d = { t: 'sp', st: 'planted', c: nid, p, site: site.name, tm: TIMES.spike };
        if (match.mode === 'host') broadcast(d);
        applySpike(d, now);
        match.phase = 'planted';
        match.timer = TIMES.spike;
        if (match.mode === 'host') broadcast({ t: 'ph', ph: 'planted', tm: TIMES.spike });
        for (const a of actors.values()) if (a.sim && sideOf(a.team) === ATK) a.sim.credits = Math.min(ECON.max, a.sim.credits + ECON.plant);
        const pa = actors.get(nid);
        if (pa && pa.sim) pa.sim.ult = Math.min(ULT_COST, pa.sim.ult + 1);
    }
    function defuseSpike(nid, now) {
        if (match.phase !== 'planted') return;
        const f = fighterById(nid);
        if (f && Math.hypot(f.x - spike.x, f.z - spike.z) > 2.5) return;
        const d = { t: 'sp', st: 'defused', c: nid, p: [spike.x, spike.y, spike.z], site: spike.site, tm: 0 };
        if (match.mode === 'host') broadcast(d);
        applySpike(d, now);
        endRound(teamOf(nid), 'defuse', now);
    }
    function dropSpike(pos, now) {
        const d = { t: 'sp', st: 'dropped', c: 0, p: pos, site: '', tm: 0 };
        if (match.mode === 'host') broadcast(d);
        applySpike(d, now);
    }
    function giveSpike(nid, now) {
        const d = { t: 'sp', st: 'carried', c: nid, p: [0, 0, 0], site: '', tm: 0 };
        if (match.mode === 'host') broadcast(d);
        applySpike(d, now);
    }

    // Everyone: new spike state.
    function applySpike(d, now) {
        const was = spike.state;
        spike.state = d.st;
        spike.carrier = d.c || 0;
        [spike.x, spike.y, spike.z] = d.p;
        spike.site = d.site;
        player.hasSpike = spike.state === 'carried' && spike.carrier === player.nid;
        for (const a of actors.values()) a.hasSpike = spike.state === 'carried' && spike.carrier === a.nid;
        if (!player.hasSpike && player.slot === W.spike) equip(player.primary >= 0 ? player.primary : player.secondary);
        spikeMesh.visible = d.st === 'dropped' || d.st === 'planted' || d.st === 'defused';
        spikeMesh.position.set(spike.x, spike.y + 0.15, spike.z);
        if (d.st === 'planted') {
            match.phase = 'planted';
            match.timer = d.tm;
            spike.beepAt = now;
            if (mySide() === ATK) player.credits = Math.min(ECON.max, player.credits + ECON.plant);
            if (d.c === player.nid) player.ult = Math.min(ULT_COST, player.ult + 1);
            showRoundBanner('ÇEKİRDEK KURULDU', `${d.site} bölgesi · 45 sn`, mySide() === ATK ? 'win' : 'loss');
            tone(880, 0.4, 'square', 0.08);
        }
        if (d.st === 'defused') {
            spikeLight.intensity = 0;
            if (d.c === player.nid) player.ult = Math.min(ULT_COST, player.ult + 1);
        }
        if (d.st === 'dropped' && was === 'carried') feedText('Çekirdek düştü', mySide() === ATK);
        if (d.st === 'carried' && was === 'dropped' && d.c === player.nid) toast('Çekirdeği aldın.');
        updateHud();
    }

    function tickAuthority(dt, now) {
        if (match.paused) return;
        match.timer -= dt * 1000;
        if (match.phase === 'buy' && match.timer <= 0) setPhase('round', TIMES.round);
        else if (match.phase === 'round' && match.timer <= 0) endRound((DEF - match.half + 2) % 2, 'time', now);
        else if (match.phase === 'planted' && match.timer <= 0) {
            const d = { t: 'sp', st: 'exploded', c: 0, p: [spike.x, spike.y, spike.z], site: spike.site, tm: 0 };
            if (match.mode === 'host') broadcast(d);
            applySpike(d, now);
            endRound((ATK - match.half + 2) % 2, 'boom', now);
        } else if (match.phase === 'post' && match.timer <= 0) {
            if (Math.max(...match.score) >= match.winTarget) endMatch(now);
            else startRound(now);
        }
        // Dropped spike: the first attacker to walk over it picks it up.
        if (spike.state === 'dropped' && combatPhase()) {
            for (const f of fighters) {
                if (f.alive && sideOf(f.team) === ATK && Math.hypot(f.x - spike.x, f.z - spike.z) < 1.3) { giveSpike(f.nid, now); break; }
            }
        }
        if (match.mode === 'host' && now > match.syncAt) {
            match.syncAt = now + SNAPSHOT_MS;
            broadcast({ t: 'ph', ph: match.phase, tm: Math.round(match.timer) });
        }
    }

    function endMatch(now) {
        const d = { t: 'e', sc: match.score };
        if (match.mode === 'host') { broadcast(snapshot()); broadcast(d); }
        finishMatch(d, now);
    }

    /* ---------- Satın alma ---------- */

    function canBuy() {
        return match.phase === 'buy' && player.alive && inSpawn(mySide(), player.x, player.z);
    }
    function buyItem(kind, id) {
        if (!canBuy()) { toast('Yalnızca satın alma evresinde, doğuş alanında alışveriş yapılır.'); return; }
        const bought = player.boughtThisRound || (player.boughtThisRound = {});
        if (kind === 'weapon') {
            const idx = W[id];
            const w = WEAPONS[idx];
            const slotKey = w.slot === 1 ? 'primary' : 'secondary';
            if (player[slotKey] === idx) {
                // Selling back a weapon bought this round refunds it.
                if (bought[id]) { player.credits += w.price; delete bought[id]; player[slotKey] = slotKey === 'secondary' ? W.pim : -1; delete player.ammo[idx]; equip(player.secondary); }
                updateBuyMenu();
                return;
            }
            if (player.credits < w.price) { toast('Kredin yetmiyor.'); tone(160, 0.12, 'square', 0.05); return; }
            const old = player[slotKey];
            if (old >= 0 && bought[WEAPONS[old].id]) { player.credits += WEAPONS[old].price; delete bought[WEAPONS[old].id]; }
            player.credits -= w.price;
            player[slotKey] = idx;
            player.ammo[idx] = [w.mag, w.reserve];
            bought[id] = true;
            player.slot = idx;
            player.reloading = false;
        } else if (kind === 'shield') {
            const s = SHIELDS.find((x) => x.id === id);
            if (bought[id]) { player.credits += s.price; player.armor = bought.prevArmor || 0; delete bought[id]; updateBuyMenu(); return; }
            if (player.armor >= s.armor) { toast('Bu kalkan zaten sende.'); return; }
            const refund = SHIELDS.filter((x) => bought[x.id]).reduce((n, x) => n + x.price, 0);
            if (player.credits + refund < s.price) { toast('Kredin yetmiyor.'); return; }
            SHIELDS.forEach((x) => { if (bought[x.id]) { player.credits += x.price; delete bought[x.id]; } });
            bought.prevArmor = bought.prevArmor ?? player.armor;
            player.credits -= s.price;
            player.armor = s.armor;
            bought[id] = true;
        } else if (kind === 'ability') {
            const ab = AGENTS[player.agent].abilities[id];
            if (player.charges[id] >= ab.max) { toast('En fazla sayıda var.'); return; }
            if (player.credits < ab.price) { toast('Kredin yetmiyor.'); return; }
            player.credits -= ab.price;
            player.charges[id]++;
        }
        tone(880, 0.06, 'triangle', 0.06);
        updateBuyMenu();
        updateHud();
        updateAbilityHud();
    }

    /* ---------- Botlar (yalnızca host / tek oyunculu) ---------- */

    const teamPlan = [{}, {}];

    function setupBots(teams, now) {
        let n = 0;
        const usedAgents = [new Set(), new Set()];
        for (const r of roster.values()) usedAgents[r.team].add(r.agent);
        for (const team of [0, 1]) {
            for (let i = 0; i < teams[team]; i++) {
                const nid = BOT_BASE + n;
                const free = AGENT_IDS.filter((id) => !usedAgents[team].has(id));
                const agent = free.length ? pick(free) : pick(AGENT_IDS);
                usedAgents[team].add(agent);
                const name = `${BOT_NAMES[n % BOT_NAMES.length]}`;
                roster.set(nid, { name, team, agent, camo: pick(['standard', 'desert', 'forest', 'arctic', 'crimson']), bot: true, kills: 0, deaths: 0 });
                const a = ensureActor(nid);
                setActorInfo(a, { ...roster.get(nid) });
                a.sim = { alive: false, hp: 100, armor: 0, credits: ECON.start, primary: -1, secondary: W.pim, slot: W.pim, ammo: {}, charges: { c: 0, q: 0, e: 0 }, ult: 0, agent };
                n++;
            }
        }
        void now;
    }

    function botRoundStart(a, slotIndex, reset, now) {
        const s = a.sim;
        if (reset) Object.assign(s, { credits: ECON.start, primary: -1, secondary: W.pim, armor: 0, charges: { c: 0, q: 0, e: 0 }, ult: 0 });
        if (!s.alive) { s.primary = -1; s.secondary = W.pim; s.armor = 0; }
        const side = sideOf(a.team);
        const sp = SPAWN_POINTS[side][slotIndex % SPAWN_POINTS[side].length];
        Object.assign(s, {
            alive: true, hp: 100, reloadEnd: 0, nextShot: 0, burst: 0, pauseUntil: 0, target: 0, targetSince: 0, reactAt: 0,
            lastSeen: null, lastSeenAt: -1e9, perceiveAt: 0, path: null, pathI: 0, goal: null, goalKey: '', strafe: 1, strafeAt: 0,
            stopUntil: 0, stuckAt: now + 1500, stuckX: sp.x, stuckZ: sp.z, hurtBy: 0, hurtAt: -1e9, velY: 0, crouchUntil: 0,
            blindUntil: 0, slowUntil: 0, tagUntil: 0, buffUntil: 0, healLeft: 0, dashUntil: 0, stunUntil: 0, bladesUntil: 0, action: null, actionStart: 0,
            buyAt: now + rand(1500, 6000), bought: false, usedRoundStart: false, execUtil: false, castAt: 0, waitUntil: 0, role: slotIndex
        });
        s.charges.e = Math.max(s.charges.e, AGENTS[s.agent].abilities.e.free || 0);
        s.ammo = {};
        a.x = sp.x;
        a.z = sp.z;
        a.y = 0;
        a.yaw = side === ATK ? 0 : Math.PI;
        a.pitch = 0;
        a.stance = 0;
        a.hasSpike = false;
        s.slot = s.primary >= 0 ? s.primary : s.secondary;
        setActorWeapon(a, s.slot);
        setAlive(a, true, now);
    }

    function botBuy(a) {
        const s = a.sim;
        const pistolRound = match.round === 1 || match.round === halfRounds() + 1;
        const buyW = (id) => { const w = WEAPONS[W[id]]; if (s.credits >= w.price) { s.credits -= w.price; if (w.slot === 1) s.primary = W[id]; else s.secondary = W[id]; return true; } return false; };
        const buyS = (armor, price) => { if (s.armor < armor && s.credits >= price) { s.credits -= price; s.armor = armor; } };
        if (pistolRound) {
            if (Math.random() < 0.5) buyS(25, 400); else buyW('olcu');
        } else if (s.primary >= 0) {
            buyS(50, 1000);
        } else if (s.credits >= 3900) {
            if (s.credits >= 5700 && ['kale', 'ok', 'nobet'].includes(s.agent) && Math.random() < 0.3) buyW('yayla');
            else buyW(Math.random() < 0.5 ? 'kartal' : 'sahin');
            buyS(50, 1000);
        } else if (s.credits >= 3300) {
            buyW(Math.random() < 0.5 ? 'kartal' : 'sahin');
            buyS(25, 400);
        } else if (s.credits >= 2400 && match.lossStreak[a.team] >= 2) {
            buyW(Math.random() < 0.6 ? 'ari' : 'sacma');
            buyS(25, 400);
        } else if (s.credits >= 1200) {
            buyW('olcu');
        }
        const abil = AGENTS[s.agent].abilities;
        for (const k of ['c', 'q']) while (s.charges[k] < abil[k].max && s.credits >= abil[k].price + 200) { s.credits -= abil[k].price; s.charges[k]++; }
        s.slot = s.primary >= 0 ? s.primary : s.secondary;
        setActorWeapon(a, s.slot);
    }

    function botPerceive(a, s, now, diff) {
        s.perceiveAt = now + rand(140, 240);
        if (now < s.blindUntil) { s.target = 0; return; }
        const ey = a.y + 1.55 * STANCE_SCALE[a.stance];
        const fx = -Math.sin(a.yaw);
        const fz = -Math.cos(a.yaw);
        let best = null;
        let bestScore = Infinity;
        for (const f of fighters) {
            if (f.team === a.team || !f.alive) continue;
            const dx = f.x - a.x;
            const dz = f.z - a.z;
            const dist = Math.hypot(dx, dz) || 0.01;
            if (dist > 120) continue;
            const hurtByIt = f.nid === s.hurtBy && now - s.hurtAt < 3000;
            const facing = (dx * fx + dz * fz) / dist;
            if (!hurtByIt && dist > 6 && facing < 0.3) {
                // Out of view: running footsteps or gunfire still give them away.
                if ((f.loud && dist < 24) || (now - f.lastShotAt < 1200 && dist < 50)) teamIntel[a.team].set(f.nid, { x: f.x, z: f.z, at: now });
                continue;
            }
            const fs = STANCE_SCALE[f.stance] || 1;
            if (!canSee(a.x, ey, a.z, f.x, f.y + 1.1 * fs, f.z) && !canSee(a.x, ey, a.z, f.x, f.y + 1.55 * fs, f.z)) continue;
            let score = dist;
            if (f.nid === s.target) score *= 0.6;
            if (hurtByIt) score *= 0.5;
            if (score < bestScore) { bestScore = score; best = f; }
        }
        if (best) {
            if (s.target !== best.nid) {
                s.target = best.nid;
                s.targetSince = now;
                s.reactAt = now + diff.react * 1000 * rand(0.8, 1.25);
                s.stopUntil = 0;
            }
            s.lastSeen = { x: best.x, z: best.z };
            s.lastSeenAt = now;
            teamIntel[a.team].set(best.nid, { x: best.x, z: best.z, at: now });
        } else if (s.target) {
            s.target = 0;
        }
    }

    // Where this bot wants to stand right now, by side and round state.
    function botGoal(a, s, now) {
        const side = sideOf(a.team);
        const plan = teamPlan[a.team] || {};
        if (side === ATK) {
            if (match.phase === 'planted') {
                const t = TACTIC[spike.site];
                return { key: `post${s.role}`, ...t.hold[s.role % t.hold.length], wait: true };
            }
            if (spike.state === 'dropped' && Math.hypot(a.x - spike.x, a.z - spike.z) < 45) return { key: 'getspike', x: spike.x, z: spike.z };
            const siteName = TACTIC[plan.site] ? plan.site : siteNames()[0];
            const t = TACTIC[siteName];
            if (s.role === plan.lurker) return { key: 'lurk', ...TACTIC.mid.watch[0], wait: true };
            if (match.phase === 'round' && match.timer < TIMES.round - 22000 || plan.go) {
                plan.go = true;
                if (a.hasSpike) return { key: 'plant', ...t.plant[0] };
                return { key: `exec${s.role}`, ...t.hold[s.role % t.hold.length], wait: true };
            }
            return { key: `stage${s.role}`, ...t.stage[s.role % t.stage.length], wait: true };
        }
        if (match.phase === 'planted') {
            const t = TACTIC[spike.site];
            const nearest = [...actors.values()].filter((b) => b.sim && b.alive && b.team === a.team).sort((b1, b2) => Math.hypot(b1.x - spike.x, b1.z - spike.z) - Math.hypot(b2.x - spike.x, b2.z - spike.z))[0];
            if (nearest === a) return { key: 'defuse', x: spike.x, z: spike.z };
            return { key: `retake${s.role}`, ...t.hold[s.role % t.hold.length], wait: true };
        }
        // One defender per site first, then mid, then a second player on each site.
        const names = siteNames();
        const posts = [...names.map((n) => TACTIC[n].hold[0]), TACTIC.mid.hold[0], ...names.map((n) => TACTIC[n].hold[1])];
        return { key: `hold${s.role}`, ...posts[s.role % posts.length], wait: true };
    }

    const siteWatch = (role) => { const names = siteNames(); return TACTIC[names[role % names.length]].watch[0]; };

    function botFacePoint(a, x, z) {
        a.yaw = Math.atan2(-(x - a.x), -(z - a.z));
        a.pitch = 0;
    }

    function botAbilities(a, s, tgt, now) {
        if (now < s.castAt || !combatPhase() && match.phase !== 'buy') return;
        const ab = AGENTS[s.agent].abilities;
        const side = sideOf(a.team);
        const cast = (slot, prep) => {
            const kind = ab[slot].kind;
            if (slot === 'x' ? s.ult < ULT_COST : s.charges[slot] <= 0) return false;
            if (prep) prep();
            a.eye = 1.6;
            castAbility(a.nid, kind, a, now);
            if (slot === 'x') s.ult = 0; else s.charges[slot]--;
            s.castAt = now + rand(2500, 5000);
            return true;
        };
        const plan = teamPlan[a.team] || {};
        // Round-start utility: sentinels wire the choke, controllers and initiators prepare.
        if (!s.usedRoundStart && match.phase === 'round') {
            s.usedRoundStart = true;
            if (side === DEF && s.agent === 'kale') {
                const t = siteWatch(s.role);
                if (cast('c', () => { a.aim = { x: t.x, z: t.z }; botFacePoint(a, t.x, t.z); })) return;
            }
            if (side === DEF && s.agent === 'nobet') {
                const names = siteNames();
                const t = TACTIC[names[s.role % names.length]];
                cast('c', () => { a.aim = { x: t.watch[0].x, z: t.watch[0].z }; });
                s.castAt = 0;
                if (cast('e', () => { a.aim = { x: t.hold[1].x, z: t.hold[1].z }; botFacePoint(a, t.watch[0].x, t.watch[0].z); })) return;
            }
        }
        if (tgt) {
            if (s.agent === 'kor' && s.hp < 50 && cast('x')) return;
            if (s.agent === 'kale' && s.ult >= ULT_COST && Math.hypot(tgt.x - a.x, tgt.z - a.z) < 12 && cast('x')) return;
            if (Math.random() < 0.012) {
                if (ab.q.kind === 'flash' && cast('q', () => botFacePoint(a, tgt.x, tgt.z))) return;
                if (ab.c.kind === 'molotov' && cast('c', () => { botFacePoint(a, tgt.x, tgt.z); a.pitch = 0.25; })) return;
                if (ab.c.kind === 'shock' && cast('c', () => { botFacePoint(a, tgt.x, tgt.z); a.pitch = 0.1; })) return;
                if (ab.q.kind === 'dark' && cast('q', () => botFacePoint(a, tgt.x, tgt.z))) return;
                const lob = clamp((Math.hypot(tgt.x - a.x, tgt.z - a.z) - 10) / 30, -0.15, 0.45);
                if (ab.c.kind === 'stun' && cast('c', () => { botFacePoint(a, tgt.x, tgt.z); a.pitch = lob; })) return;
                if (ab.q.kind === 'frost' && cast('q', () => { botFacePoint(a, tgt.x, tgt.z); a.pitch = lob; })) return;
                if (ab.q.kind === 'quake' && Math.hypot(tgt.x - a.x, tgt.z - a.z) < 20 && cast('q', () => botFacePoint(a, tgt.x, tgt.z))) return;
            }
            const tdist = Math.hypot(tgt.x - a.x, tgt.z - a.z);
            if (ab.x.kind === 'blades' && cast('x')) return;
            if (ab.x.kind === 'rupture' && tdist < 35 && cast('x', () => botFacePoint(a, tgt.x, tgt.z))) return;
            if (ab.x.kind === 'blizzard' && tdist < 35 && cast('x', () => { a.aim = { x: tgt.x, z: tgt.z }; })) return;
            return;
        }
        if (s.agent === 'kale' && s.hp < 60 && cast('e')) return;
        if (side === ATK && plan.go && !s.execUtil) {
            const t = TACTIC[plan.site] || TACTIC[siteNames()[0]];
            const d = Math.hypot(a.x - t.entry.x, a.z - t.entry.z);
            if (d < 14) {
                s.execUtil = true;
                const watch = t.hold[1];
                if (s.agent === 'sis') { cast('e', () => { a.aim = { x: t.watch[1].x, z: t.watch[1].z }; }); return; }
                if (s.agent === 'ok') { cast('e', () => { botFacePoint(a, watch.x, watch.z); a.pitch = 0.15; }); return; }
                if (s.agent === 'kor') { cast('q', () => { botFacePoint(a, watch.x, watch.z); a.pitch = 0.2; }); return; }
                if (s.agent === 'ayaz') { cast('e', () => { a.aim = { x: t.watch[1].x, z: t.watch[1].z }; }); return; }
                if (s.agent === 'ruzgar') { cast('q', () => { a.aim = { x: t.watch[1].x, z: t.watch[1].z }; }); return; }
                if (s.agent === 'fay') { if (!cast('q', () => botFacePoint(a, watch.x, watch.z))) cast('e'); return; }
                if (s.agent === 'nobet') { cast('q'); if (s.ult >= ULT_COST) { s.castAt = 0; cast('x'); } return; }
            }
        }
        if (s.agent === 'fay' && match.phase === 'round' && Math.random() < 0.004) cast('e');
        if (side === DEF && match.phase === 'planted' && s.agent === 'nobet' && Math.hypot(a.x - spike.x, a.z - spike.z) < 25 && cast('x')) return;
        if (side === DEF && match.phase === 'planted' && s.agent === 'ayaz' && Math.hypot(a.x - spike.x, a.z - spike.z) < 22) cast('e', () => { a.aim = { x: spike.x, z: spike.z }; });
        if (s.agent === 'ok' && match.phase === 'round' && match.timer < TIMES.round - 40000 && cast('x')) return;
        if (side === DEF && match.phase === 'planted' && s.agent === 'sis' && Math.hypot(a.x - spike.x, a.z - spike.z) < 20) cast('e', () => { a.aim = { x: spike.x, z: spike.z }; });
    }

    let botsFrozen = false; // yalnızca ?debug testleri
    function updateBot(a, dt, now) {
        const s = a.sim;
        if (!s.alive || botsFrozen) return;
        const diff = DIFFICULTY[match.diff];
        const w = WEAPONS[s.slot];
        // Buy during the buy phase, or on the way out if the phase ended first.
        if (!s.bought && ((match.phase === 'buy' && now > s.buyAt) || match.phase === 'round')) { s.bought = true; botBuy(a); }
        const active = combatPhase();
        if (active && now >= s.perceiveAt) botPerceive(a, s, now, diff);
        let tgt = active && s.target ? fighterById(s.target) : null;
        if (tgt && !tgt.alive) { s.target = 0; tgt = null; }
        if (now < s.blindUntil) tgt = null;
        if (active) botAbilities(a, s, tgt, now);

        if (s.slot === W.blades && (now > s.bladesUntil || (s.ammo[W.blades]?.[0] ?? 0) <= 0)) {
            s.bladesUntil = 0;
            s.slot = s.primary >= 0 ? s.primary : s.secondary;
            setActorWeapon(a, s.slot);
            return;
        }
        const am = s.ammo[s.slot] || (s.ammo[s.slot] = [w.mag || 0, w.reserve || 0]);
        if (s.reloadEnd && now >= s.reloadEnd) { const take = Math.min(w.mag - am[0], am[1]); am[0] += take; am[1] -= take; s.reloadEnd = 0; }
        if (!s.reloadEnd && w.mag && (am[0] <= 0 || (!tgt && am[0] < w.mag * 0.5)) && am[1] > 0) s.reloadEnd = now + w.reload;
        a.reloading = Boolean(s.reloadEnd);

        // Planting / defusing in progress.
        if (s.action) {
            if (tgt || !combatPhase()) s.action = null;
            else {
                const total = s.action === 'plant' ? TIMES.plant : TIMES.defuse;
                if (now - s.actionStart >= total) {
                    const what = s.action;
                    s.action = null;
                    if (what === 'plant') plantSpike(a.nid, [round2(a.x), round2(a.y), round2(a.z)], now);
                    else defuseSpike(a.nid, now);
                }
                a.action = 1;
                return;
            }
        }
        a.action = 0;

        let mx = 0;
        let mz = 0;
        let speed = SPEED.run * (w.speed || 1);
        let wantShoot = false;
        if (tgt) {
            const dx = tgt.x - a.x;
            const dz = tgt.z - a.z;
            const dist = Math.hypot(dx, dz) || 1;
            // Stop to shoot (accurate), then strafe a little between bursts.
            if (now >= s.stopUntil && now >= s.strafeAt) {
                s.strafe = Math.random() < 0.5 ? -1 : 1;
                s.strafeAt = now + rand(250, 500);
                s.stopUntil = s.strafeAt + rand(500, 1100);
            }
            if (now < s.strafeAt) { mx = (-dz / dist) * s.strafe; mz = (dx / dist) * s.strafe; }
            else wantShoot = true;
            if (w.id === 'sacma' && dist > 9) { mx += dx / dist; mz += dz / dist; wantShoot = dist < 14; }
        } else if (active || match.phase === 'buy') {
            const goal = botGoal(a, s, now);
            if (goal.key !== s.goalKey || !s.path || (s.pathI >= s.path.length && Math.hypot(a.x - goal.x, a.z - goal.z) > 2.5)) {
                if (now > s.waitUntil) {
                    s.goalKey = goal.key;
                    s.goal = goal;
                    s.path = findPath(a.x, a.z, goal.x, goal.z);
                    s.pathI = 0;
                    s.waitUntil = now + 900;
                }
            }
            if (s.path && s.pathI < s.path.length) {
                const p = s.path[s.pathI];
                const dx = p.x - a.x;
                const dz = p.z - a.z;
                const d = Math.hypot(dx, dz);
                if (d < 0.7) s.pathI++;
                else { mx = dx / d; mz = dz / d; }
            } else if (s.goal) {
                // Arrived: plant, defuse, pick up or hold an angle.
                if (s.goalKey === 'plant' && a.hasSpike && match.phase === 'round' && inSite(a.x, a.z) && now - s.lastSeenAt > 1500) { s.action = 'plant'; s.actionStart = now; }
                if (s.goalKey === 'defuse' && match.phase === 'planted' && Math.hypot(a.x - spike.x, a.z - spike.z) < 1.8 && now - s.lastSeenAt > 1500) { s.action = 'defuse'; s.actionStart = now; }
                const intel = [...teamIntel[a.team].values()].filter((i) => now - i.at < 4000).sort((i1, i2) => Math.hypot(i1.x - a.x, i1.z - a.z) - Math.hypot(i2.x - a.x, i2.z - a.z))[0];
                const watch = intel || (sideOf(a.team) === DEF ? siteWatch(s.role) : null);
                if (watch) a.yaw += angleDiff(a.yaw, Math.atan2(-(watch.x - a.x), -(watch.z - a.z))) * Math.min(1, dt * 3);
            }
            if (sideOf(a.team) === ATK && !teamPlan[a.team].go && match.phase === 'round') speed = SPEED.walk + 1;
        }
        if (now < s.slowUntil) speed *= 0.5;
        if (now < s.stunUntil) speed *= 0.65;
        if (now < s.tagUntil) speed *= 0.72;
        if (now < s.buffUntil) speed *= 1.15;
        const ml = Math.hypot(mx, mz);
        let movedSpeed = 0;
        if (now < s.dashUntil) { mx = s.dashX; mz = s.dashZ; speed = 19; }
        if (ml > 0.01 || now < s.dashUntil) {
            const k = (speed * dt) / Math.max(1, Math.hypot(mx, mz));
            const nx = clamp(a.x + mx * k, -HALF_X + 1, HALF_X - 1);
            const nz = clamp(a.z + mz * k, -HALF_Z + 1, HALF_Z - 1);
            const ox = a.x;
            const oz = a.z;
            if (!blocked(nx, a.z, a.y)) a.x = nx; else s.strafe = -s.strafe;
            if (!blocked(a.x, nz, a.y)) a.z = nz; else s.strafe = -s.strafe;
            movedSpeed = Math.hypot(a.x - ox, a.z - oz) / dt;
        }
        a.moving = movedSpeed > 0.5;
        a.walking = movedSpeed < SPEED.walk + 1.2;
        if (now > s.stuckAt) {
            if (ml > 0.1 && Math.hypot(a.x - s.stuckX, a.z - s.stuckZ) < 0.5) { s.path = null; s.goalKey = ''; s.waitUntil = 0; }
            s.stuckX = a.x;
            s.stuckZ = a.z;
            s.stuckAt = now + 1300;
        }
        s.velY += GRAVITY * dt;
        a.y += s.velY * dt;
        const gy = groundAt(a.x, a.z, a.y);
        if (a.y <= gy) { a.y = gy; s.velY = 0; }
        if (s.healLeft > 0) { const h = Math.min(s.healLeft, 20 * dt); s.healLeft -= h; s.hp = Math.min(100, s.hp + h); }

        // Aim and fire.
        const ey = a.y + 1.55 * STANCE_SCALE[a.stance];
        let wantYaw = a.yaw;
        let wantPitch = 0;
        if (tgt) {
            const ty = tgt.y + 1.15 * (STANCE_SCALE[tgt.stance] || 1);
            wantYaw = Math.atan2(-(tgt.x - a.x), -(tgt.z - a.z));
            wantPitch = Math.atan2(ty - ey, Math.hypot(tgt.x - a.x, tgt.z - a.z));
        } else if (ml > 0.1) wantYaw = Math.atan2(-mx, -mz);
        else if (!s.goal) wantYaw = a.yaw;
        const turn = (tgt ? diff.turn : 5) * dt;
        a.yaw += clamp(angleDiff(a.yaw, wantYaw), -turn, turn);
        a.pitch += clamp(wantPitch - a.pitch, -turn, turn);
        if (tgt && wantShoot && !s.reloadEnd && w.mag && am[0] > 0 && now >= s.reactAt && now >= s.nextShot && now >= s.pauseUntil) {
            const err = Math.abs(angleDiff(a.yaw, wantYaw)) + Math.abs(wantPitch - a.pitch);
            if (err < 0.06 + (w.spread || 0) * 2 && (w.id !== 'yayla' || now - s.targetSince > 800)) botFire(a, s, tgt, ey, now, diff, movedSpeed, am);
        }
        if (tgt && w.melee) { s.slot = s.primary >= 0 ? s.primary : s.secondary; setActorWeapon(a, s.slot); }
    }

    function botFire(a, s, tgt, ey, now, diff, movedSpeed, am) {
        const w = WEAPONS[s.slot];
        am[0]--;
        a.fireSeq = (a.fireSeq + 1) & 3;
        s.nextShot = now + w.delay * (w.auto ? 1 : rand(1.3, 1.8)) * (now < s.buffUntil ? 0.85 : 1);
        if (w.auto && --s.burst <= 0) {
            s.burst = randInt(diff.burst);
            s.pauseUntil = now + rand(...diff.pause) * 1000;
        }
        const settle = clamp((now - s.targetSince) / 2000, 0, 1);
        const moveErr = (w.move || 0) * clamp(movedSpeed / SPEED.run, 0, 1);
        const err = diff.aimErr * (1.4 - settle) + (w.id === 'yayla' ? w.scoped : w.spread || 0) + moveErr + (now < s.stunUntil ? 0.07 : 0);
        const ts = STANCE_SCALE[tgt.stance] || 1;
        const aimY = tgt.y + (Math.random() < diff.head ? 1.6 : 1.1) * ts;
        let dx = tgt.x - a.x;
        let dy = aimY - ey;
        let dz = tgt.z - a.z;
        const len = Math.hypot(dx, dy, dz) || 1;
        dx /= len; dy /= len; dz /= len;
        const dmgBy = {};
        const headBy = {};
        let tracerEnd = null;
        for (let p = 0; p < (w.pellets || 1); p++) {
            let px = dx + rand(-err, err);
            let py = dy + rand(-err, err);
            let pz = dz + rand(-err, err);
            const pl = Math.hypot(px, py, pz);
            px /= pl; py /= pl; pz /= pl;
            const wall = rayDistance(a.x, ey, a.z, px, py, pz, 250);
            let hit = null;
            for (const f of fighters) {
                if (f.team === a.team || !f.alive) continue;
                const hh = hitFighter(f, a.x, ey, a.z, px, py, pz);
                if (hh && hh.t < wall && (!hit || hh.t < hit.t)) hit = { ...hh, nid: f.nid };
            }
            const t = hit ? hit.t : Math.min(wall, 120);
            if (!tracerEnd) tracerEnd = [a.x + px * t, ey + py * t, a.z + pz * t];
            if (hit) {
                dmgBy[hit.nid] = (dmgBy[hit.nid] || 0) + weaponDamage(w, hit.part, hit.t) * diff.dmg;
                if (hit.part === 'head') headBy[hit.nid] = true;
            } else if (wall < 120) puff(a.x + px * wall, ey + py * wall, a.z + pz * wall);
        }
        actorShotFx(a, now, tracerEnd);
        for (const nid in dmgBy) deliverHit(a.nid, Number(nid), Math.round(dmgBy[nid]), s.slot, Boolean(headBy[nid]), now);
    }

    function actorShotFx(a, now, end) {
        a.flashUntil = now + 55;
        a.lastShotAt = now;
        const w = WEAPONS[Math.max(0, a.weapon)];
        const sp = spatial(a.x, a.z);
        shotSound(w.id, sp.vol, sp.pan);
        if (w.silent) return;
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

    const outbox = new Map();
    const recBuf = new ArrayBuffer(RECORD);
    const recView = new DataView(recBuf);
    const recBytes = new Uint8Array(recBuf);
    let lastNetTick = 0;

    function writeRecord(nid, x, y, z, yaw, pitch, flags, weapon) {
        recView.setUint16(0, nid);
        recView.setInt16(2, clamp(Math.round(x * 100), -32000, 32000));
        recView.setInt16(4, clamp(Math.round(y * 100), -32000, 32000));
        recView.setInt16(6, clamp(Math.round(z * 100), -32000, 32000));
        recView.setUint16(8, Math.round((((yaw % TAU) + TAU) % TAU) / TAU * 65535));
        recView.setInt8(10, clamp(Math.round(pitch / (Math.PI / 2) * 127), -127, 127));
        recView.setUint8(11, flags);
        recView.setUint8(12, weapon);
    }
    const flagsOf = (stance, alive, reloading, fireSeq, walking, action) => (stance & 3) | (alive ? 4 : 0) | (reloading ? 8 : 0) | ((fireSeq & 3) << 4) | (walking ? 64 : 0) | (action ? 128 : 0);
    const weaponByte = (w, spikeOn) => (Math.max(0, w) & 15) | (spikeOn ? 16 : 0);

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
        if (inMatch()) {
            writeRecord(player.nid, player.x, player.y, player.z, player.yaw, player.pitch, flagsOf(player.stance, player.alive, player.reloading, player.fireSeq, player.walking || player.speedNow < 4.5, player.action), weaponByte(player.slot, player.hasSpike));
            stage(player.nid, recBytes, false);
        }
        if (match.mode === 'host') {
            for (const a of actors.values()) {
                if (!a.sim) continue;
                writeRecord(a.nid, a.x, a.y, a.z, a.yaw, a.pitch, flagsOf(a.stance, a.alive, a.reloading, a.fireSeq, a.walking, a.action), weaponByte(a.weapon, a.hasSpike));
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
                if (!conn.nid || nid !== conn.nid) continue;
                stage(nid, new Uint8Array(ab, off, RECORD), true);
            }
            applyRecord(dv, off, now);
        }
    }

    function applyRecord(dv, off, now) {
        const nid = dv.getUint16(off);
        if (nid === player.nid || !inMatch() && match.phase !== 'over') return;
        const a = actors.get(nid);
        if (!a || a.sim) return;
        const x = dv.getInt16(off + 2) / 100;
        const y = dv.getInt16(off + 4) / 100;
        const z = dv.getInt16(off + 6) / 100;
        const yaw = dv.getUint16(off + 8) / 65535 * TAU;
        const pitch = dv.getInt8(off + 10) / 127 * (Math.PI / 2);
        const fl = dv.getUint8(off + 11);
        const wb = dv.getUint8(off + 12);
        let alive = Boolean(fl & 4);
        if (alive && now < a.deadLock) alive = false;
        setAlive(a, alive, now);
        const last = a.buf[a.buf.length - 1];
        if (last && Math.hypot(x - last.x, z - last.z) > 6) a.buf.length = 0;
        else if (last && now - last.t > 200) a.buf.push({ ...last, t: now - NET_STEP_MS });
        a.buf.push({ t: now, x, y, z, yaw, pitch });
        if (a.buf.length > 12) a.buf.splice(0, a.buf.length - 12);
        a.stance = fl & 3;
        a.reloading = Boolean(fl & 8);
        a.walking = Boolean(fl & 64);
        a.action = fl & 128 ? 1 : 0;
        a.hasSpike = Boolean(wb & 16);
        const w = clamp(wb & 15, 0, WEAPONS.length - 1);
        setActorWeapon(a, w);
        const seq = (fl >> 4) & 3;
        const first = !a.lastPacket;
        a.lastPacket = now;
        if (!first && seq !== a.fireSeq && alive) actorShotFx(a, now, null);
        a.fireSeq = seq;
        if (first) { a.x = x; a.y = y; a.z = z; a.yaw = yaw; a.pitch = pitch; }
    }

    const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
    const vec = (v, n) => (Array.isArray(v) && v.length === n && v.every((x) => Number.isFinite(num(x))) ? v.map((x) => clamp(x, -400, 400)) : null);

    function snapshot() {
        return {
            t: 's',
            p: [...roster].map(([nid, r]) => [nid, r.name, r.team, r.agent, r.camo, r.bot ? 1 : 0, r.kills, r.deaths]),
            m: { ph: match.phase, tm: Math.round(match.timer), rn: match.round, half: match.half, sc: match.score, wt: match.winTarget, size: match.size, diff: match.diff, map: mapId },
            sp: { st: spike.state, c: spike.carrier, p: [spike.x, spike.y, spike.z], site: spike.site, tm: Math.round(match.timer) }
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
            const info = { name: cleanName(row[1]), team: row[2] === 1 ? 1 : 0, agent: AGENTS[row[3]] ? row[3] : 'kor', camo: CamoValid(row[4]) ? row[4] : 'standard', bot: Boolean(row[5]), kills: Math.max(0, Math.floor(num(row[6]) || 0)), deaths: Math.max(0, Math.floor(num(row[7]) || 0)) };
            if (nid === player.nid) {
                player.team = info.team;
                roster.set(nid, { ...info, name: myName(), agent: player.agent });
                continue;
            }
            roster.set(nid, info);
            setActorInfo(ensureActor(nid), info);
        }
        for (const nid of [...roster.keys()]) if (!seen.has(nid)) { roster.delete(nid); removeActor(nid); }
        for (const nid of [...actors.keys()]) if (!seen.has(nid)) removeActor(nid);
        if (d.m) {
            if (ROUND_CHOICES.includes(d.m.wt)) match.winTarget = d.m.wt;
            if (Array.isArray(d.m.sc)) match.score = d.m.sc.map((v) => Math.max(0, Math.floor(num(v) || 0))).slice(0, 2);
            if (Number.isFinite(num(d.m.half))) match.half = d.m.half ? 1 : 0;
            if (Number.isFinite(num(d.m.rn))) match.round = Math.max(0, Math.floor(d.m.rn));
            if (SIZE_CHOICES.includes(d.m.size)) match.size = d.m.size;
        }
        // Allies and enemies may have changed sides: refresh their tags.
        for (const [nid, r] of roster) { const a = actors.get(nid); if (a) setActorInfo(a, r); }
        updateTeamHud();
    }

    // Host: put a joining human on the team with fewer humans, replacing a bot there if the team is full.
    function admitPlayer(conn, d) {
        const nid = Math.floor(num(d.n));
        const humans = [...roster.values()].filter((r) => !r.bot).length;
        if (d.v !== PROTO) return 'Sürümler farklı. İki taraf da sayfayı yenilesin.';
        if (!(nid > 0 && nid < BOT_BASE) || roster.has(nid)) return 'Kimlik çakıştı, yeniden katıl.';
        if (humans >= MAX_HUMANS) return `Oda dolu (en fazla ${MAX_HUMANS} oyuncu).`;
        const count = (team, bot) => [...roster.values()].filter((r) => r.team === team && r.bot === bot).length;
        const team = count(0, false) <= count(1, false) ? 0 : 1;
        if (count(team, false) + count(team, true) >= match.size) {
            const bot = [...roster].find(([, r]) => r.team === team && r.bot);
            if (bot) { roster.delete(bot[0]); removeActor(bot[0]); broadcast({ t: 'b', n: bot[0] }); }
        }
        conn.nid = nid;
        const agent = AGENTS[d.ag] ? d.ag : 'kor';
        const info = { name: cleanName(d.nm), team, agent, camo: CamoValid(d.c) ? d.c : 'standard', bot: false, kills: 0, deaths: 0 };
        roster.set(nid, info);
        const a = ensureActor(nid);
        setActorInfo(a, info);
        broadcast(snapshot());
        feedText(`${info.name} katıldı · ${team === player.team ? 'takımında' : 'rakip takımda'}`, team === player.team);
        tone(660, 0.12, 'triangle', 0.05, 220);
        return null;
    }

    function onEvent(d, conn) {
        const now = performance.now();
        const host = match.mode === 'host';
        const fromClient = host && conn.nid;
        const f = Math.floor(num(d.f));
        switch (d.t) {
            case 'hi': {
                if (!host) return;
                const err = admitPlayer(conn, d);
                if (err) { sendTo(conn, { t: 'err', m: err }); window.setTimeout(() => conn.close(), 300); }
                return;
            }
            case 's':
                if (host) return;
                if (joinPending) { const code = joinPending; joinPending = null; startMatch('client', d, code); return; }
                applySnapshot(d);
                return;
            case 'rs':
                if (host || !Number.isFinite(num(d.rn)) || !Array.isArray(d.sc)) return;
                beginRoundLocal({ rn: d.rn, half: d.half ? 1 : 0, sc: d.sc, tm: clamp(num(d.tm) || TIMES.buy, 0, 60000), carrier: Math.floor(num(d.carrier)) || 0, slot: d.slot && typeof d.slot === 'object' ? d.slot : {} }, now);
                return;
            case 'ph': {
                if (host) return;
                const ph = ['buy', 'round', 'planted', 'post'].includes(d.ph) ? d.ph : null;
                if (!ph) return;
                if (ph === 'round' && match.phase === 'buy') { setBarriers(false); showRoundBanner('RAUNT BAŞLADI', mySide() === ATK ? 'Çekirdeği kur' : 'Bölgeleri savun', 'neutral'); if (buyOpen) toggleBuy(false); }
                if (ph !== 'post' || match.phase === 'post') { match.phase = ph; }
                match.timer = clamp(num(d.tm) || 0, 0, 200000);
                return;
            }
            case 're':
                if (host || (d.w !== 0 && d.w !== 1) || !Array.isArray(d.sc)) return;
                applyRoundEnd({ w: d.w, why: String(d.why), sc: d.sc }, now);
                return;
            case 'sp': {
                if (host) return;
                const p = vec(d.p, 3);
                if (!p || !['carried', 'dropped', 'planted', 'defused', 'exploded'].includes(d.st)) return;
                applySpike({ st: d.st, c: Math.floor(num(d.c)) || 0, p, site: SITES[d.site] ? d.site : '', tm: clamp(num(d.tm) || 0, 0, 60000) }, now);
                return;
            }
            case 'h': {
                const to = Math.floor(num(d.to));
                const dmg = clamp(num(d.d) || 0, 0, 260);
                const w = clamp(Math.floor(num(d.w)) || 0, 0, ABILITY_W);
                if (!dmg || (host && f !== conn.nid)) return;
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
                if ((host && v !== conn.nid) || v === player.nid) return;
                if (fromClient) broadcast(d, conn);
                applyKill(k, v, clamp(Math.floor(num(d.w)) || 0, 0, ABILITY_W), Boolean(d.hs), now, vec(d.p, 3));
                return;
            }
            case 'ab': {
                if ((host && f !== conn.nid) || f === player.nid || typeof d.k !== 'string') return;
                const needs = { trip: 6 }[d.k] || 3;
                const p = vec(d.p, needs);
                if (!p) return;
                const v = d.v ? vec(d.v, 3) : null;
                if (fromClient) broadcast(d, conn);
                applyAbility({ t: 'ab', f, k: d.k, p, v: v || [0, 0, 0], id: Math.floor(num(d.id)) || 0 }, now);
                return;
            }
            case 'zd': {
                if (fromClient) broadcast(d, conn);
                destroyTurret(Math.floor(num(d.id)));
                return;
            }
            case 'abx': {
                const p = vec(d.p, 3);
                if (!p || (host && f !== conn.nid) || f === player.nid) return;
                if (fromClient) broadcast(d, conn);
                removeProjectile(Math.floor(num(d.id)));
                landAbility(String(d.k), f, p, now);
                return;
            }
            case 'pl':
                if (host && f === conn.nid) { const p = vec(d.p, 3); if (p) plantSpike(f, p, now); }
                return;
            case 'df':
                if (host && f === conn.nid) defuseSpike(f, now);
                return;
            case 'e':
                if (!host) finishMatch({ sc: Array.isArray(d.sc) ? d.sc : match.score }, now);
                return;
            case 'r':
                if (!host) $('over').classList.add('hidden');
                return;
            case 'b': {
                if (host) return;
                const n = Math.floor(num(d.n));
                const name = roster.get(n)?.name;
                roster.delete(n);
                removeActor(n);
                if (name && n < BOT_BASE) feedText(`${name} ayrıldı`, false);
                updateTeamHud();
                return;
            }
            case 'p':
                if (host) sendTo(conn, { t: 'q', s: d.s });
                return;
            case 'q':
                if (!host && Number.isFinite(num(d.s))) pingMs = Math.round(now - d.s);
                return;
            case 'err':
                if (!host) leaveMatch(String(d.m || '').replace(/[\u0000-\u001f\u007f-\u009f<>]/g, '').slice(0, 120) || 'Bağlantı reddedildi.');
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
                    const r = roster.get(c.nid);
                    roster.delete(c.nid);
                    removeActor(c.nid);
                    outbox.delete(c.nid);
                    broadcast({ t: 'b', n: c.nid });
                    // Keep the teams full: a bot takes the empty seat.
                    if (r && match.fill) {
                        const used = new Set([...roster.keys()].filter((n) => n >= BOT_BASE));
                        let n = BOT_BASE;
                        while (used.has(n)) n++;
                        const agent = pick(AGENT_IDS);
                        roster.set(n, { name: BOT_NAMES[(n - BOT_BASE) % BOT_NAMES.length], team: r.team, agent, camo: 'standard', bot: true, kills: 0, deaths: 0 });
                        const a = ensureActor(n);
                        setActorInfo(a, roster.get(n));
                        a.sim = { alive: false, hp: 100, armor: 0, credits: ECON.start, primary: -1, secondary: W.pim, slot: W.pim, ammo: {}, charges: { c: 0, q: 0, e: 0 }, ult: 0, agent };
                    }
                    broadcast(snapshot());
                    if (r) feedText(`${r.name} ayrıldı`, r.team === player.team);
                    checkElimination(performance.now());
                    updateTeamHud();
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
                sendTo(c, { t: 'hi', n: player.nid, nm: myName(), ag: player.agent, c: myCamo(), v: PROTO });
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
        el.textContent = `↑ ${(txBytes / 1024).toFixed(1)} ↓ ${(rxBytes / 1024).toFixed(1)} KB/s · ${match.mode === 'host' ? 'host' : `${pingMs} ms`}`;
        txBytes = 0;
        rxBytes = 0;
    }, 1000);
    window.setInterval(() => {
        if (match.mode === 'client' && conns[0] && conns[0].open) sendTo(conns[0], { t: 'p', s: performance.now() });
    }, 2000);
    window.addEventListener('beforeunload', () => { if (isOnline()) sendEvent({ t: 'b', n: player.nid }); });

    /* ---------- Maç başlat / bitir ---------- */

    function startMatch(mode, snap, code) {
        const now = performance.now();
        match.mode = mode;
        match.paused = false;
        match.rewarded = false;
        clearActors();
        clearAbilities();
        clearEffects();
        roster.clear();
        outbox.clear();
        player.agent = prefs.agent;
        player.alive = false;
        buildViewmodels(myCamo(), player.agent);
        roster.set(player.nid, { name: myName(), team: 0, agent: player.agent, camo: myCamo(), bot: false, kills: 0, deaths: 0 });
        if (mode === 'client') {
            roomCode = code || '';
            buildMap(MAPS[snap.m?.map] ? snap.m.map : 'liman');
            applySnapshot(snap);
            const m = snap.m || {};
            match.phase = ['buy', 'round', 'planted', 'post'].includes(m.ph) ? m.ph : 'post';
            match.timer = clamp(num(m.tm) || 0, 0, 200000);
            resetLoadout(true);
            if (snap.sp && vec(snap.sp.p, 3)) applySpike({ st: snap.sp.st === 'none' ? 'carried' : snap.sp.st, c: snap.sp.c || 0, p: vec(snap.sp.p, 3), site: snap.sp.site || '', tm: snap.sp.tm || 0 }, now);
            setBarriers(match.phase === 'buy');
            if (match.phase === 'buy') respawnLocal(Math.floor(Math.random() * 5));
            else { player.alive = false; spectateNext(); }
            match.roundStats = { kills: {}, plantedBy: 0 };
            enterGame();
            if (!player.alive) showRoundBanner('Maç sürüyor', 'Bir sonraki raunda katılacaksın', 'neutral');
            return;
        }
        buildMap(prefs.map === 'random' ? pick(MAP_IDS) : prefs.map);
        match.winTarget = prefs.rounds;
        match.size = prefs.size;
        match.diff = prefs.diff;
        match.fill = mode === 'solo' ? true : prefs.fill;
        match.round = 0;
        match.half = 0;
        match.score = [0, 0];
        match.lossStreak = [0, 0];
        player.team = 0;
        if (match.fill) setupBots([match.size - 1, match.size], now);
        enterGame();
        startRound(now);
    }

    function restartMatch() {
        if (!isAuthority()) return;
        const now = performance.now();
        for (const r of roster.values()) { r.kills = 0; r.deaths = 0; }
        match.round = 0;
        match.half = 0;
        match.score = [0, 0];
        match.rewarded = false;
        $('over').classList.add('hidden');
        if (match.mode === 'host') { broadcast({ t: 'r' }); broadcast(snapshot()); }
        startRound(now);
        lockPointer();
    }

    function finishMatch(d, now) {
        match.phase = 'over';
        match.score = d.sc.slice();
        cancelAction();
        mouseDown = false;
        touch.fire = false;
        showScoreboard(false);
        unlockPointer();
        const mine = roster.get(player.nid) || { kills: 0, deaths: 0 };
        const myScore = match.score[player.team];
        const theirs = match.score[1 - player.team];
        const won = myScore > theirs;
        let reward = 0;
        let note = '';
        const cheating = cheatOn('active');
        let best = Number(getCookieValue(BEST_COOKIE)) || 0;
        if (!match.rewarded) {
            match.rewarded = true;
            if (!cheating && mine.kills > best) { best = mine.kills; setCookieValue(BEST_COOKIE, String(best)); note = 'Yeni rekor! '; }
            if (cheating) note += 'Hile açık · skor ve CM kaydedilmedi.';
            else if (!CasualProfile.current()) note += 'Oturum kapalı · CM kazanmak için menüden oturumu başlat.';
            else {
                reward = CasualProfile.awardVektorMatch({ kills: mine.kills, rounds: myScore, won }).reward;
                note += reward ? 'Kazanç profiline eklendi.' : '';
            }
            if (typeof recordGameResult === 'function') recordGameResult('Vektör', { won, score: mine.kills });
        }
        $('over-title').textContent = won ? 'ZAFER' : myScore === theirs ? 'BERABERE' : 'YENİLGİ';
        $('over-title').className = won ? 'win' : 'loss';
        $('over-score').textContent = `${myScore} – ${theirs}`;
        $('over-kills').textContent = String(mine.kills);
        $('over-deaths').textContent = String(mine.deaths);
        $('over-best').textContent = String(best);
        $('over-reward').textContent = !cheating && CasualProfile.current() ? `+${CasualProfile.formatMoney(reward)} CM` : '—';
        $('over-note').textContent = `${note}${match.mode === 'client' ? ' Yeni maçı host başlatır.' : ''}`.trim();
        renderScoreTables($('over-tables'));
        const again = $('again-btn');
        again.disabled = match.mode === 'client';
        again.textContent = match.mode === 'client' ? 'Host bekleniyor' : 'Yeni maç';
        $('over').classList.remove('hidden');
        if (won) chord([523, 659, 784, 1046, 1318], 0.5, 'triangle', 0.07, 0.12);
        void now;
    }

    function leaveMatch(reason) {
        if (isOnline()) { try { sendEvent({ t: 'b', n: player.nid }); } catch { /* ignore */ } }
        closePeer();
        clearActors();
        clearAbilities();
        clearEffects();
        roster.clear();
        match.phase = 'menu';
        match.mode = 'solo';
        match.paused = false;
        player.alive = false;
        spikeMesh.visible = false;
        setBarriers(true);
        unlockPointer();
        showMenu();
        if (reason) { setStatus(reason, 'err'); toast(reason); }
    }

    /* ---------- HUD ---------- */

    let toastTimer = 0;
    let scoreboardOpen = false;
    let hudState = '';
    function setText(id, text) { const e = $(id); if (e.textContent !== text) e.textContent = text; }
    function setStyle(id, prop, value) { const e = $(id); if (e.style.getPropertyValue(prop) !== value) e.style.setProperty(prop, value); }
    function el(tag, cls, text) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text !== undefined) e.textContent = text;
        return e;
    }
    function toast(message) {
        const t = $('toast');
        t.textContent = message;
        t.classList.add('show');
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => t.classList.remove('show'), 2600);
    }
    function setStatus(message, kind = '') {
        const s = $('status-line');
        s.textContent = message;
        s.className = `status${kind ? ` ${kind}` : ''}`;
    }

    function feed(k, v, w, hs, allyKill) {
        const d = el('div', allyKill ? 'ally' : 'enemy');
        if (k === player.nid || v === player.nid) d.classList.add('me');
        const killer = el('span', 'who', k === v ? '' : nameOf(k));
        killer.style.setProperty('--agent', AGENTS[agentOf(k)]?.color || '#fff');
        const weapon = el('span', 'gun');
        if (w === ABILITY_W) weapon.textContent = '✦';
        else if (WEAPONS[w] && !WEAPONS[w].melee && WEAPONS[w].id !== 'spike') { const img = el('img'); img.src = weaponThumb(WEAPONS[w].id); img.alt = WEAPONS[w].name; weapon.append(img); }
        else weapon.textContent = WEAPONS[w]?.name || '';
        const victim = el('span', 'who victim', nameOf(v));
        victim.style.setProperty('--agent', AGENTS[agentOf(v)]?.color || '#fff');
        d.append(killer, weapon);
        if (hs) d.append(el('span', 'hs', '◎'));
        d.append(victim);
        const box = $('killfeed');
        box.prepend(d);
        while (box.children.length > 6) box.lastChild.remove();
        window.setTimeout(() => d.remove(), 7000);
    }
    function feedText(text, ally) {
        const d = el('div', ally ? 'ally note' : 'enemy note', text);
        const box = $('killfeed');
        box.prepend(d);
        window.setTimeout(() => d.remove(), 5000);
    }
    function banner(title, sub, kind) {
        const b = $('notice');
        b.replaceChildren(el('b', '', title), el('small', '', sub || ''));
        b.className = `show ${kind || ''}`;
        window.clearTimeout(banner.t);
        banner.t = window.setTimeout(() => { b.className = ''; }, 2400);
    }
    function showRoundBanner(title, sub, kind) {
        const b = $('roundbanner');
        b.replaceChildren(el('strong', '', title), el('span', '', sub || ''));
        b.className = `show ${kind}`;
        window.clearTimeout(showRoundBanner.t);
        showRoundBanner.t = window.setTimeout(() => { b.className = ''; }, 2800);
    }
    function killBanner(n, hs) {
        const b = $('killbanner');
        b.replaceChildren();
        for (let i = 1; i <= Math.min(5, n); i++) b.append(el('i', i === n ? 'new' : ''));
        if (hs) b.append(el('em', '', 'KAFADAN'));
        b.className = 'show';
        tone(500 + n * 140, 0.14, 'triangle', 0.08);
        tone(1000 + n * 200, 0.18, 'sine', 0.05, 0, 0, 0.08);
        window.clearTimeout(killBanner.t);
        killBanner.t = window.setTimeout(() => { b.className = ''; }, 2200);
    }

    function updateHud() {
        const w = weaponOf();
        const am = w.mag ? ammoOf(player.slot) : null;
        const state = [Math.ceil(player.hp), player.armor, player.slot, am && am.join('/'), player.reloading, player.credits, player.hasSpike, match.phase].join('|');
        if (state === hudState) return;
        hudState = state;
        setText('hp-num', String(Math.max(0, Math.ceil(player.hp))));
        setStyle('hp-fill', 'width', `${clamp(player.hp, 0, 100)}%`);
        setText('armor-num', player.armor ? String(Math.ceil(player.armor)) : '');
        $('armor').classList.toggle('hidden', !player.armor);
        setText('ammo-mag', am ? String(am[0]) : '–');
        setText('ammo-res', am ? String(am[1]) : '');
        $('ammo-mag').classList.toggle('low', Boolean(am && am[0] <= Math.ceil(w.mag * 0.25)));
        setText('weapon-name', w.name + (player.reloading ? ' · şarjör' : ''));
        setText('credits', `¤ ${player.credits}`);
        $('credits').classList.toggle('hidden', match.phase !== 'buy');
        $('spike-carry').classList.toggle('hidden', !player.hasSpike);
        updateBuyMenu();
    }

    function updateAbilityHud() {
        const ab = AGENTS[player.agent].abilities;
        for (const slot of SLOTS) {
            const box = document.querySelector(`.ability[data-slot="${slot}"]`);
            if (!box) continue;
            box.querySelector('.ab-name').textContent = ab[slot].name;
            const pips = box.querySelector('.ab-pips');
            pips.replaceChildren();
            if (slot === 'x') {
                for (let i = 0; i < ULT_COST; i++) pips.append(el('i', i < player.ult ? 'on' : ''));
                box.classList.toggle('ready', player.ult >= ULT_COST);
                box.classList.toggle('empty', player.ult < ULT_COST);
            } else {
                for (let i = 0; i < ab[slot].max; i++) pips.append(el('i', i < player.charges[slot] ? 'on' : ''));
                box.classList.toggle('empty', player.charges[slot] <= 0);
            }
            box.style.setProperty('--agent', AGENTS[player.agent].color);
        }
    }

    function teamList(team) {
        return [...roster].filter(([, r]) => r.team === team).map(([nid, r]) => ({ nid, ...r }));
    }
    function isAlive(nid) {
        if (nid === player.nid) return player.alive;
        return Boolean(actors.get(nid)?.alive);
    }
    function updateTeamHud() {
        for (const [boxId, team] of [['team-ally', player.team], ['team-enemy', 1 - player.team]]) {
            const box = $(boxId);
            box.replaceChildren();
            for (const r of teamList(team)) {
                const chip = el('span', `chip${isAlive(r.nid) ? '' : ' dead'}`, AGENTS[r.agent]?.name[0] || '?');
                chip.style.setProperty('--agent', AGENTS[r.agent]?.color || '#888');
                chip.title = r.name;
                if (team === player.team && spike.state === 'carried' && spike.carrier === r.nid) chip.classList.add('spike');
                box.append(chip);
            }
        }
        setText('score-ally', String(match.score[player.team] || 0));
        setText('score-enemy', String(match.score[1 - player.team] || 0));
        setText('side-label', match.phase === 'menu' ? '' : SIDE_NAMES[mySide()]);
        setText('round-label', `RAUNT ${match.round}`);
    }

    function updateTopTimer() {
        const planted = match.phase === 'planted';
        $('spike-timer').classList.toggle('hidden', !planted);
        $('timer').classList.toggle('hidden', planted);
        const sec = Math.max(0, Math.ceil(match.timer / 1000));
        setText('timer', `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);
        $('timer').classList.toggle('urgent', sec <= 10 && match.phase === 'round');
        $('timer').classList.toggle('buy', match.phase === 'buy');
    }

    function renderScoreTables(box) {
        box.replaceChildren();
        for (const team of [player.team, 1 - player.team]) {
            const table = el('table', team === player.team ? 'ally' : 'enemy');
            const head = el('tr');
            ['', team === player.team ? 'TAKIMIN' : 'RAKİP', 'Ö', 'Ö', team === player.team ? 'KREDİ' : ''].forEach((t, i) => {
                const th = el('th', '', i === 2 ? 'Öldürme' : i === 3 ? 'Ölüm' : t);
                head.append(th);
            });
            const thead = el('thead');
            thead.append(head);
            const tbody = el('tbody');
            teamList(team).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths).forEach((r) => {
                const tr = el('tr', `${r.nid === player.nid ? 'me' : ''}${isAlive(r.nid) ? '' : ' dead'}`);
                const chip = el('span', 'chip', AGENTS[r.agent]?.name[0] || '?');
                chip.style.setProperty('--agent', AGENTS[r.agent]?.color || '#888');
                const c0 = el('td');
                c0.append(chip);
                const c1 = el('td', '', r.nid === player.nid ? `${r.name} (sen)` : r.name);
                if (r.bot) c1.append(el('span', 'bot-tag', 'BOT'));
                const credits = r.nid === player.nid ? player.credits : r.bot && isAuthority() && team === player.team ? actors.get(r.nid)?.sim?.credits ?? '' : '';
                tr.append(c0, c1, el('td', '', String(r.kills)), el('td', '', String(r.deaths)), el('td', '', team === player.team ? String(credits) : ''));
                tbody.append(tr);
            });
            table.append(thead, tbody);
            box.append(table);
        }
    }
    function showScoreboard(open) {
        scoreboardOpen = open;
        $('scoreboard').classList.toggle('hidden', !open);
        if (open) renderScoreTables($('score-tables'));
    }

    /* ---------- Mini harita ---------- */

    const MM = 2.6; // px per metre
    const miniBase = document.createElement('canvas');
    miniBase.width = COLS * CELL * MM;
    miniBase.height = ROWS * CELL * MM;
    function drawMiniBase() {
        const g = miniBase.getContext('2d');
        g.fillStyle = 'rgba(15,25,35,.55)';
        g.fillRect(0, 0, miniBase.width, miniBase.height);
        const cs = CELL * MM;
        g.clearRect(0, 0, miniBase.width, miniBase.height);
        g.fillStyle = mapLook.mini;
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (!cellGrid[r][c]) g.fillRect(c * cs, r * cs, cs + 0.5, cs + 0.5);
        g.fillStyle = 'rgba(70,82,94,.9)';
        for (const s of solids) {
            if (s.barrier || s.y1 > WALL_H - 0.1) continue;
            g.fillRect((s.x0 + HALF_X) * MM, (s.z0 + HALF_Z) * MM, (s.x1 - s.x0) * MM, (s.z1 - s.z0) * MM);
        }
        for (const site of Object.values(SITES)) {
            g.fillStyle = 'rgba(255,90,72,.18)';
            g.fillRect((site.x0 + HALF_X) * MM, (site.z0 + HALF_Z) * MM, (site.x1 - site.x0) * MM, (site.z1 - site.z0) * MM);
            g.fillStyle = '#ff5a48';
            g.font = '700 26px Teko, Impact, sans-serif';
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.fillText(site.name, ((site.x0 + site.x1) / 2 + HALF_X) * MM, ((site.z0 + site.z1) / 2 + HALF_Z) * MM);
        }
    }
    let miniAt = 0;
    function drawMinimap(now) {
        if (now - miniAt < 80) return;
        miniAt = now;
        const c = $('minimap');
        const g = c.getContext('2d');
        // Attackers see their spawn at the bottom; defenders get the map turned around.
        const flip = mySide() === DEF;
        g.save();
        g.clearRect(0, 0, c.width, c.height);
        g.scale(c.width / miniBase.width, c.height / miniBase.height);
        if (flip) { g.translate(miniBase.width, miniBase.height); g.rotate(Math.PI); }
        g.drawImage(miniBase, 0, 0);
        const P2 = (x, z) => [(x + HALF_X) * MM, (z + HALF_Z) * MM];
        for (const z of zones) {
            const [px, pz] = P2(z.x, z.z);
            if ((z.kind === 'turret' || z.kind === 'alarm') && z.team === player.team) {
                g.fillStyle = '#5ff5e1';
                g.fillRect(px - 5, pz - 5, 10, 10);
                continue;
            }
            if (z.kind !== 'smoke' && z.kind !== 'fire' && z.kind !== 'slow' && z.kind !== 'blizzard') continue;
            g.fillStyle = z.kind === 'smoke' ? 'rgba(155,123,255,.55)' : z.kind === 'fire' ? 'rgba(255,122,61,.45)' : z.kind === 'blizzard' ? 'rgba(232,246,255,.45)' : 'rgba(155,123,255,.3)';
            g.beginPath(); g.arc(px, pz, z.r * MM, 0, TAU); g.fill();
        }
        const dot = (x, z, color, yaw, big) => {
            const [px, pz] = P2(x, z);
            if (yaw !== undefined) {
                g.fillStyle = color.replace(')', ',.25)').replace('rgb', 'rgba');
                g.beginPath(); g.moveTo(px, pz); g.arc(px, pz, 26, -yaw - Math.PI / 2 - 0.5, -yaw - Math.PI / 2 + 0.5); g.closePath(); g.fill();
            }
            g.fillStyle = color;
            g.beginPath(); g.arc(px, pz, big ? 7 : 6, 0, TAU); g.fill();
            g.strokeStyle = 'rgba(10,15,20,.8)';
            g.lineWidth = 2;
            g.stroke();
        };
        for (const a of actors.values()) {
            if (!a.alive || !(a.sim || a.lastPacket)) continue;
            if (a.team === player.team) dot(a.x, a.z, 'rgb(95,245,225)', a.yaw);
            else if (a.los || now < (reveals.get(a.nid) || 0) || now - a.lastShotAt < 1500 && Math.hypot(a.x - player.x, a.z - player.z) < 30) dot(a.x, a.z, 'rgb(255,70,85)');
        }
        if (spike.state === 'planted' || (spike.state === 'dropped' && mySide() === ATK)) {
            const [px, pz] = P2(spike.x, spike.z);
            g.fillStyle = '#ff4a3c';
            g.fillRect(px - 6, pz - 6, 12, 12);
        }
        if (player.alive) dot(player.x, player.z, 'rgb(255,230,90)', player.yaw, true);
        g.restore();
    }

    /* ---------- Satın alma menüsü ---------- */

    function toggleBuy(open) {
        buyOpen = open && match.phase === 'buy' && player.alive;
        $('buy').classList.toggle('hidden', !buyOpen);
        if (buyOpen) { unlockPointer(); updateBuyMenu(true); }
        else if (inMatch() && !overlayOpen()) lockPointer();
    }
    let buyBuilt = false;
    function updateBuyMenu(force) {
        if (!buyOpen && !force) return;
        const grid = $('buy-grid');
        if (!buyBuilt) {
            buyBuilt = true;
            const cats = [
                ['TABANCALAR', ['pim', 'olcu']], ['HAFİF', ['ari', 'sacma']], ['TÜFEKLER', ['kartal', 'sahin']], ['KESKİN', ['yayla']]
            ];
            for (const [title, ids] of cats) {
                const col = el('section', 'buy-col');
                col.append(el('h3', '', title));
                for (const id of ids) {
                    const w = WEAPONS[W[id]];
                    const card = el('button', 'buy-card');
                    card.type = 'button';
                    card.dataset.kind = 'weapon';
                    card.dataset.id = id;
                    const img = el('img');
                    img.src = weaponThumb(id);
                    img.alt = '';
                    const info = el('div', 'buy-info');
                    info.append(el('b', '', w.name), el('span', 'price', w.price ? `¤ ${w.price}` : 'ÜCRETSİZ'));
                    const stats = el('small', '', `${Math.round(w.dmg * w.head)} kafa · ${Math.round(w.dmg)} gövde · ${Math.round(1000 / w.delay * 10) / 10}/sn · ${w.mag} mermi${w.note ? ` · ${w.note}` : ''}`);
                    card.append(img, info, stats);
                    card.addEventListener('click', () => buyItem('weapon', id));
                    col.append(card);
                }
                grid.append(col);
            }
            const col = el('section', 'buy-col');
            col.append(el('h3', '', 'KALKANLAR'));
            for (const s of SHIELDS) {
                const card = el('button', 'buy-card shield');
                card.type = 'button';
                card.dataset.kind = 'shield';
                card.dataset.id = s.id;
                const info = el('div', 'buy-info');
                info.append(el('b', '', s.name), el('span', 'price', `¤ ${s.price}`));
                card.append(el('i', `shield-icon ${s.id}`), info, el('small', '', `+${s.armor} kalkan`));
                card.addEventListener('click', () => buyItem('shield', s.id));
                col.append(card);
            }
            col.append(el('h3', '', 'YETENEKLER'));
            const abBox = el('div', 'buy-abilities');
            abBox.id = 'buy-abilities';
            col.append(abBox);
            grid.append(col);
        }
        const abBox = $('buy-abilities');
        abBox.replaceChildren();
        const ag = AGENTS[player.agent];
        for (const slot of ['c', 'q', 'e']) {
            const ab = ag.abilities[slot];
            const card = el('button', 'buy-card ability-card');
            card.type = 'button';
            card.disabled = !ab.price;
            const key = el('kbd', '', slot.toUpperCase());
            const info = el('div', 'buy-info');
            info.append(el('b', '', ab.name), el('span', 'price', ab.price ? `¤ ${ab.price}` : 'Her raunt ücretsiz'));
            card.append(key, info, el('small', '', `${player.charges[slot]} / ${ab.max} · ${ab.desc}`));
            card.style.setProperty('--agent', ag.color);
            if (ab.price) card.addEventListener('click', () => buyItem('ability', slot));
            abBox.append(card);
        }
        const bought = player.boughtThisRound || {};
        grid.querySelectorAll('.buy-card[data-kind]').forEach((card) => {
            const { kind, id } = card.dataset;
            let owned = false;
            let price = 0;
            if (kind === 'weapon') { owned = player.primary === W[id] || player.secondary === W[id]; price = WEAPONS[W[id]].price; }
            else { const s = SHIELDS.find((x) => x.id === id); owned = player.armor >= s.armor; price = s.price; }
            card.classList.toggle('owned', owned);
            card.classList.toggle('refund', Boolean(bought[id]));
            card.classList.toggle('poor', !owned && price > player.credits);
        });
        setText('buy-credits', `¤ ${player.credits}`);
        setText('buy-hint', canBuy() ? 'Satın almak için tıkla · bu raunt aldığına tekrar tıklarsan geri satarsın' : 'Doğuş alanının dışındasın');
    }

    /* ---------- Menü ---------- */

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
            const host = box.dataset.scope === 'host';
            box.replaceChildren();
            const groups = [
                ['size', 'Takım', SIZE_CHOICES.map((n) => [n, `${n}v${n}`])],
                ['diff', 'Bot zorluğu', Object.entries(DIFFICULTY).map(([id, d]) => [id, d.label])],
                ['rounds', 'Kazanmak için', ROUND_CHOICES.map((n) => [n, `${n} raunt`])]
            ];
            if (host) groups.push(['fill', 'Boş yerler', [[true, 'Botlarla doldur'], [false, 'Yalnızca oyuncular']]]);
            groups.unshift(['map', 'Harita', [...MAP_IDS.map((id) => [id, MAPS[id].name]), ['random', 'Rastgele']]]);
            for (const [key, label, choices] of groups) {
                const wrap = el('div', 'opt');
                wrap.append(el('div', 'field-label', label), segmented(label, choices, prefs[key], (value) => { prefs[key] = value; savePrefs(); renderOptions(); }));
                if (key === 'map') wrap.append(mapPreview(prefs.map));
                box.append(wrap);
            }
        });
    }
    function mapPreview(id) {
        const card = el('div', 'map-preview');
        const thumb = document.createElement('canvas');
        thumb.width = COLS * 3;
        thumb.height = ROWS * 3;
        thumb.setAttribute('aria-hidden', 'true');
        const info = el('div', 'map-info');
        if (MAPS[id]) {
            drawMapThumb(thumb, MAPS[id]);
            info.append(el('b', '', MAPS[id].name), el('small', '', MAPS[id].tag), el('p', '', MAPS[id].desc));
        } else {
            const g = thumb.getContext('2d');
            g.fillStyle = 'rgba(236,232,225,.08)';
            g.fillRect(0, 0, thumb.width, thumb.height);
            g.fillStyle = '#ff4655';
            g.font = '700 90px Teko, Impact, sans-serif';
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.fillText('?', thumb.width / 2, thumb.height / 2 + 8);
            info.append(el('b', '', 'Rastgele'), el('small', '', `${MAP_IDS.length} harita`), el('p', '', MAP_IDS.map((m) => MAPS[m].name).join(' · ')));
        }
        card.append(thumb, info);
        return card;
    }
    // Plan view: floor, walls, sites (red) and spawns (attackers at the bottom).
    function drawMapThumb(c, def) {
        const g = c.getContext('2d');
        const k = c.width / COLS;
        g.fillStyle = '#16222d';
        g.fillRect(0, 0, c.width, c.height);
        for (let r = 0; r < ROWS; r++) {
            for (let col = 0; col < COLS; col++) {
                const ch = def.grid[r][col];
                if (ch === '#') continue;
                g.fillStyle = ch === '.' ? def.look.mini : 'rgba(120,132,144,.9)';
                g.fillRect(col * k, r * k, k + 0.3, k + 0.3);
            }
        }
        const rect = ([c0, r0, c1, r1], color) => { g.fillStyle = color; g.fillRect(c0 * k, r0 * k, (c1 - c0 + 1) * k, (r1 - r0 + 1) * k); };
        rect(def.spawns[0], 'rgba(255,70,85,.28)');
        rect(def.spawns[1], 'rgba(95,245,225,.28)');
        g.font = `700 ${Math.round(k * 5)}px Teko, Impact, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        for (const [name, cells] of Object.entries(def.sites)) {
            rect(cells, 'rgba(255,70,85,.35)');
            g.fillStyle = '#ff4655';
            g.fillText(name, ((cells[0] + cells[2] + 1) / 2) * k, ((cells[1] + cells[3] + 1) / 2) * k + k * 0.4);
        }
    }
    function renderAgents() {
        const grid = $('agent-grid');
        grid.replaceChildren();
        for (const id of AGENT_IDS) {
            const ag = AGENTS[id];
            const card = el('button', `agent-card${prefs.agent === id ? ' active' : ''}`);
            card.type = 'button';
            card.style.setProperty('--agent', ag.color);
            card.setAttribute('aria-pressed', String(prefs.agent === id));
            const portrait = el('span', 'portrait', ag.name[0]);
            const meta = el('span', 'agent-meta');
            meta.append(el('b', '', ag.name), el('small', '', ag.role));
            card.append(portrait, meta);
            card.addEventListener('click', () => { prefs.agent = id; savePrefs(); renderAgents(); tone(700, 0.08, 'triangle', 0.06); });
            grid.append(card);
        }
        const ag = AGENTS[prefs.agent];
        const detail = $('agent-detail');
        detail.style.setProperty('--agent', ag.color);
        detail.replaceChildren(el('h3', '', `${ag.name} · ${ag.role}`), el('p', '', ag.desc));
        const list = el('ul', 'ability-list');
        for (const slot of SLOTS) {
            const ab = ag.abilities[slot];
            const li = el('li');
            li.append(el('kbd', '', slot.toUpperCase()), el('b', '', ab.name), el('span', '', `${ab.desc}${ab.price ? ` · ¤${ab.price}` : slot === 'x' ? ` · ${ULT_COST} puan` : ' · ücretsiz'}`));
            list.append(li);
        }
        detail.append(list);
    }
    function renderSession(profile) {
        const line = $('session-line');
        line.replaceChildren();
        const text = el('span');
        if (cheatOn('active')) { text.textContent = 'Hile açık · CM kazanımı duraklatıldı.'; line.append(text); return; }
        if (profile) { text.textContent = `@${profile.displayName} · ${CasualProfile.formatMoney(profile.balance)} CM · Kaplama: ${CasualProfile.camos[myCamo()]?.name || 'Standart'}`; line.append(text); return; }
        text.textContent = 'Oturum kapalı · CM için başlat.';
        const button = el('button', '', 'Oturumu başlat');
        button.type = 'button';
        button.addEventListener('click', () => {
            const result = CasualProfile.startSession();
            toast(result.granted ? `Oturum açıldı, +${result.reward} CM kazandın.` : 'Oturumun açık.');
        });
        line.append(text, button);
    }

    function showMenu() {
        match.phase = 'menu';
        document.body.classList.remove('in-match');
        $('hud').classList.add('hidden');
        ['pause', 'settings', 'over', 'buy'].forEach((id) => $(id).classList.add('hidden'));
        buyOpen = false;
        $('menu').classList.remove('hidden');
        $('host-btn').disabled = false;
        $('join-btn').disabled = false;
        showScoreboard(false);
        renderAgents();
        renderSession(CasualProfile.current());
    }
    function enterGame() {
        $('menu').classList.add('hidden');
        $('hud').classList.remove('hidden');
        document.body.classList.add('in-match');
        if (touchDevice) enableTouch();
        setStatus('');
        updateHud();
        updateAbilityHud();
        updateTeamHud();
        warmShaders();
        ac();
        lockPointer();
        updateClickHint();
    }
    function overlayOpen() {
        return ['menu', 'pause', 'settings', 'over'].some((id) => !$(id).classList.contains('hidden'));
    }
    function openPause() {
        if (!inMatch() || overlayOpen()) return;
        if (buyOpen) { toggleBuy(false); return; }
        match.paused = match.mode === 'solo';
        mouseDown = false;
        touch.fire = false;
        Object.keys(keys).forEach((k) => { keys[k] = false; });
        showScoreboard(false);
        $('pause-eyebrow').textContent = match.paused ? 'DURAKLATILDI' : 'MAÇ SÜRÜYOR';
        $('pause-note').textContent = match.paused ? 'Botlar ve süre bekliyor.' : 'Çevrimiçi maç durmaz.';
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
        document.querySelectorAll('#cross-colors button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.c === prefs.cross)));
        document.documentElement.style.setProperty('--cross', CROSS_COLORS[prefs.cross]);
    }
    function copyCode(code) {
        if (!code) return;
        const done = () => toast(`Oda kodu ${code} kopyalandı.`);
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code).then(done, () => toast(`Oda kodu: ${code}`));
        else toast(`Oda kodu: ${code}`);
    }

    /* ---------- Girdi ---------- */

    function lockPointer() {
        if (touchMode || !inMatch() || overlayOpen() || buyOpen) return;
        try {
            const p = canvas.requestPointerLock();
            if (p && typeof p.catch === 'function') p.catch(() => updateClickHint());
        } catch { updateClickHint(); }
    }
    function unlockPointer() {
        if (document.pointerLockElement) { try { document.exitPointerLock(); } catch { /* ignore */ } }
    }
    function updateClickHint() {
        $('clickhint').classList.toggle('hidden', touchMode || pointerLocked || !inMatch() || overlayOpen() || buyOpen);
    }
    document.addEventListener('pointerlockchange', () => {
        pointerLocked = document.pointerLockElement === canvas;
        if (!pointerLocked) {
            mouseDown = false;
            player.ads = false;
            Object.keys(keys).forEach((k) => { keys[k] = false; });
            if (inMatch() && !overlayOpen() && !buyOpen) openPause();
        }
        updateClickHint();
    });
    canvas.addEventListener('click', () => {
        if (!inMatch() || overlayOpen()) return;
        if (buyOpen) { toggleBuy(false); return; }
        if (!pointerLocked) lockPointer();
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    function spectateNext() {
        const allies = [...actors.values()].filter((a) => a.team === player.team && a.alive);
        if (!allies.length) { player.spectate = 0; return; }
        const i = allies.findIndex((a) => a.nid === player.spectate);
        player.spectate = allies[(i + 1) % allies.length].nid;
    }

    const typing = (e) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    window.addEventListener('keydown', (e) => {
        if (typing(e)) return;
        if (e.code === 'Tab' && inMatch()) { e.preventDefault(); if (!overlayOpen()) showScoreboard(true); return; }
        if (e.code === 'KeyB' && inMatch() && !overlayOpen()) { e.preventDefault(); toggleBuy(!buyOpen); return; }
        if (e.code === 'Escape' && inMatch()) {
            if (buyOpen) { toggleBuy(false); return; }
            if (!$('settings').classList.contains('hidden')) { closeSettings(); return; }
            if (!$('pause').classList.contains('hidden')) { if (touchMode) resume(); return; }
            if (touchMode) openPause();
            return;
        }
        if (!inMatch() || overlayOpen() || buyOpen || (!pointerLocked && !touchMode)) return;
        keys[e.code] = true;
        if (['Space', 'KeyF', 'KeyZ'].includes(e.code)) e.preventDefault();
        const now = performance.now();
        if (!player.alive) { if (e.code === 'Space') spectateNext(); return; }
        if (e.code === 'KeyR') startReload();
        const digit = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
        if (digit >= 0) equipSlot(digit + 1);
        const slot = { KeyC: 'c', KeyQ: 'q', KeyE: 'e', KeyX: 'x' }[e.code];
        if (slot && !e.repeat) useAbility(slot, now);
    });
    window.addEventListener('keyup', (e) => {
        keys[e.code] = false;
        if (e.code === 'Tab') showScoreboard(false);
    });
    window.addEventListener('blur', () => { Object.keys(keys).forEach((k) => { keys[k] = false; }); mouseDown = false; showScoreboard(false); });
    window.addEventListener('wheel', (e) => {
        if (!pointerLocked || !canAct()) return;
        const order = [player.primary, player.secondary, W.knife].filter((i) => i >= 0);
        const i = order.indexOf(player.slot);
        equip(order[(i + (e.deltaY > 0 ? 1 : order.length - 1)) % order.length]);
    }, { passive: true });
    document.addEventListener('mousemove', (e) => {
        if (!pointerLocked || !inMatch() || overlayOpen()) return;
        if (!player.alive) return;
        const w = weaponOf();
        const zoom = player.ads ? (w.zoom || 1.15) : 1;
        const sens = 0.0022 * prefs.sens / zoom;
        player.yaw -= e.movementX * sens;
        player.pitch = clamp(player.pitch - e.movementY * sens, -1.5, 1.5);
    });
    document.addEventListener('mousedown', (e) => {
        if (!pointerLocked) return;
        const now = performance.now();
        if (!player.alive) { if (e.button === 0) spectateNext(); return; }
        if (e.button === 0) { mouseDown = true; if (!weaponOf().auto) tryShoot(now); }
        if (e.button === 2) {
            if (weaponOf().melee) tryShoot(now, true);
            else if (weaponOf().id === 'yayla') player.ads = !player.ads;
            else if (weaponOf().mag) player.ads = true;
        }
    });
    document.addEventListener('mouseup', (e) => {
        if (e.button === 0) mouseDown = false;
        if (e.button === 2 && weaponOf().id !== 'yayla') player.ads = false;
    });

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
        touch.walk = Math.hypot(dx, dy) < 0.6;
        $('stick-knob').style.transform = `translate(${dx * rad * 0.6}px, ${dy * rad * 0.6}px)`;
    }
    canvas.addEventListener('touchstart', (e) => {
        if (!inMatch() || overlayOpen()) return;
        e.preventDefault();
        enableTouch();
        if (!player.alive) { spectateNext(); return; }
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
                    const zoom = player.ads ? (weaponOf().zoom || 1.15) : 1;
                    const sens = 0.0048 * prefs.sens / zoom;
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
            if (t.identifier === touch.moveId) { touch.moveId = null; touch.mx = 0; touch.my = 0; touch.walk = false; $('stick-knob').style.transform = ''; }
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
            if (act === 'fire') { touch.fire = true; if (!weaponOf().auto) tryShoot(now); }
            else if (act === 'ads') { player.ads = !player.ads; b.classList.toggle('on', player.ads); }
            else if (act === 'jump') touch.jumpUntil = now + 160;
            else if (act === 'crouch') touch.crouch = true;
            else if (act === 'reload') startReload();
            else if (act === 'swap') { const order = [player.primary, player.secondary, W.knife].filter((i) => i >= 0); equip(order[(order.indexOf(player.slot) + 1) % order.length]); }
            else if (act === 'use') touch.use = true;
            else if (act === 'buy') toggleBuy(!buyOpen);
            else if (SLOTS.includes(act)) useAbility(act, now);
        });
        const up = () => {
            if (act === 'fire') touch.fire = false;
            if (act === 'crouch') touch.crouch = false;
            if (act === 'use') touch.use = false;
        };
        b.addEventListener('pointerup', up);
        b.addEventListener('pointercancel', up);
        b.addEventListener('pointerleave', up);
        b.addEventListener('contextmenu', (e) => e.preventDefault());
    });

    /* ---------- Menü olayları ---------- */

    const menuTabs = [...document.querySelectorAll('.tab')];
    menuTabs.forEach((tab, index) => {
        tab.tabIndex = tab.classList.contains('active') ? 0 : -1;
        tab.addEventListener('keydown', (e) => {
            let next;
            if (e.key === 'ArrowRight') next = (index + 1) % menuTabs.length;
            else if (e.key === 'ArrowLeft') next = (index + menuTabs.length - 1) % menuTabs.length;
            else if (e.key === 'Home') next = 0;
            else if (e.key === 'End') next = menuTabs.length - 1;
            else return;
            e.preventDefault();
            menuTabs[next].click();
            menuTabs[next].focus();
        });
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach((t) => {
                const on = t === tab;
                t.classList.toggle('active', on);
                t.setAttribute('aria-selected', String(on));
                t.tabIndex = on ? 0 : -1;
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
    $('pause-copy').addEventListener('click', () => copyCode(roomCode));
    $('resume-btn').addEventListener('click', resume);
    $('leave-btn').addEventListener('click', () => leaveMatch(''));
    $('pause-btn').addEventListener('click', () => { if (inMatch()) openPause(); });
    $('pause-settings-btn').addEventListener('click', () => openSettings('pause'));
    $('menu-settings-btn').addEventListener('click', () => openSettings('menu'));
    $('settings-done').addEventListener('click', closeSettings);
    $('again-btn').addEventListener('click', restartMatch);
    $('over-menu-btn').addEventListener('click', () => leaveMatch(''));
    $('buy-close').addEventListener('click', () => toggleBuy(false));
    $('score-pill').addEventListener('click', () => showScoreboard(!scoreboardOpen));
    $('sens').addEventListener('input', (e) => { prefs.sens = clamp(Number(e.target.value), 0.2, 3); renderSettings(); savePrefs(); });
    $('fov').addEventListener('input', (e) => { prefs.fov = clamp(Number(e.target.value), 60, 85); renderSettings(); savePrefs(); });
    $('vol').addEventListener('input', (e) => { prefs.vol = clamp(Number(e.target.value), 0, 100); renderSettings(); savePrefs(); if (master) master.gain.value = prefs.vol / 100; });
    document.querySelectorAll('#quality button').forEach((b) => b.addEventListener('click', () => { prefs.q = b.dataset.q; savePrefs(); applyQuality(); renderSettings(); }));
    document.querySelectorAll('#cross-colors button').forEach((b) => b.addEventListener('click', () => { prefs.cross = b.dataset.c; savePrefs(); renderSettings(); }));
    window.addEventListener('casualprofilechange', () => { if (!cheatOn('features')) previewCamo = null; renderSession(CasualProfile.current()); });
    window.addEventListener('casual-cheat', () => renderSession(CasualProfile.current()));
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && match.mode === 'solo' && inMatch()) { unlockPointer(); openPause(); }
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
            const moved = Math.hypot(s.x - a.x, s.z - a.z);
            a.moving = moved > 0.02;
            a.x = s.x; a.y = s.y; a.z = s.z; a.yaw = s.yaw; a.pitch = s.pitch;
        }
    }

    function poseActors(now, dt) {
        const camX = camera.position.x;
        const camY = camera.position.y;
        const camZ = camera.position.z;
        for (const a of actors.values()) {
            const g = a.group;
            const active = a.body && (a.sim || (a.lastPacket && now - a.lastPacket < 5000));
            if (!active) { g.visible = false; if (a.tag) a.tag.visible = false; a.marker.visible = false; continue; }
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
            g.rotation.x = a.alive ? 0 : Math.min(1, deadFor / 380) * Math.PI / 2 * 0.92;
            // The teammate being spectated is seen from their own eyes, so their model is hidden.
            const watched = !player.alive && a.nid === player.spectate && now > (player.spectateAt || 0);
            g.visible = (a.alive || deadFor < 3000) && !watched;
            a.jacket.emissive.setHex(now < a.hitUntil ? 0x661a10 : 0x000000);
            if (a.wModel && a.wModel.userData.flash) a.wModel.userData.flash.visible = now < a.flashUntil;
            const enemy = a.team !== player.team;
            if (now > a.losAt) {
                a.losAt = now + 120 + Math.random() * 60;
                a.los = a.alive && canSee(camX, camY, camZ, a.x, a.y + 1.5 * scale, a.z) || (a.alive && canSee(camX, camY, camZ, a.x, a.y + 0.9 * scale, a.z));
            }
            const revealed = enemy && a.alive && now < (reveals.get(a.nid) || 0);
            const showOutline = enemy && a.alive && (a.los || revealed);
            const xray = revealed && !a.los;
            if (xray !== a.xray) { a.xray = xray; a.outlines.forEach((o) => { o.material = xray ? outlineXray : outlineMat; o.renderOrder = xray ? 5 : 0; }); }
            a.outlines.forEach((o) => { o.visible = showOutline; });
            if (xray) g.visible = true;
            // Footsteps: running enemies can be heard through walls.
            if (a.alive && moved > 4.5 && !a.walking) {
                a.stepAt += dt * moved;
                if (a.stepAt > 2.4) {
                    a.stepAt = 0;
                    const sp = spatial(a.x, a.z, 32);
                    if (sp.vol > 0.01) noise(0.07, enemy ? 750 : 600, 0.09 * sp.vol, sp.pan);
                }
            }
            const ally = !enemy;
            a.marker.visible = ally && a.alive && inMatch();
            a.marker.position.set(a.x, a.y + 2.15 * scale, a.z);
            if (a.tag) {
                a.tag.visible = ally && a.alive && inMatch() && Math.hypot(a.x - player.x, a.z - player.z) < 45;
                a.tag.position.set(a.x, a.y + 2.45 * scale, a.z);
            }
        }
    }

    let lastFrame = performance.now();
    function frame(now) {
        requestAnimationFrame(frame);
        const dt = Math.min(0.05, (now - lastFrame) / 1000);
        lastFrame = now;
        if (inMatch() || match.phase === 'over') {
            interpolateActors(now);
            refreshFighters();
            if (!match.paused) {
                if (player.alive && inMatch()) updatePlayer(dt, now);
                const w = weaponOf();
                if (player.reloading && now - player.reloadStart >= w.reload) finishReload();
                if ((mouseDown || touch.fire) && w.auto) tryShoot(now);
                if (isAuthority()) {
                    if (inMatch()) tickAuthority(dt, now);
                    for (const a of actors.values()) if (a.sim) updateBot(a, dt, now);
                } else match.timer = Math.max(0, match.timer - dt * 1000);
                stepProjectiles(dt, now);
                updateZones(dt, now);
                tickMap(dt, now);
                if (match.phase === 'planted') {
                    const left = match.timer / TIMES.spike;
                    const gap = lerp(120, 1000, clamp(left, 0, 1));
                    if (now - spike.beepAt > gap) {
                        spike.beepAt = now;
                        const sp = spatial(spike.x, spike.z, 80);
                        tone(2100, 0.06, 'sine', 0.05 + 0.08 * sp.vol, 0, sp.pan);
                        spikeLight.intensity = 3;
                    }
                    spikeLight.position.set(spike.x, spike.y + 0.8, spike.z);
                    spikeLight.intensity = Math.max(0, spikeLight.intensity - dt * 10);
                    coreMat.color.setHex(now - spike.beepAt < 100 ? 0xffffff : 0xff5a48);
                }
            }
            poseActors(now, dt);
            netTick(now);
            updateHud();
            updateTopTimer();
            drawMinimap(now);
            if (now - (frame.teamAt || 0) > 500) { frame.teamAt = now; updateTeamHud(); if (scoreboardOpen) renderScoreTables($('score-tables')); }
            const blind = player.blindUntil - now;
            setStyle('flash', 'display', blind > 0 ? 'block' : 'none');
            if (blind > 0) setStyle('flash', 'opacity', String(clamp(blind / 450, 0, 1)));
            const dark = player.darkUntil - now;
            setStyle('dark', 'display', dark > 0 ? 'block' : 'none');
            if (dark > 0) setStyle('dark', 'opacity', String(clamp(dark / 600, 0, 1)));
            if (!player.alive && inMatch()) {
                if (now > (player.spectateAt || 0) && !actors.get(player.spectate)?.alive) spectateNext();
                const s = actors.get(player.spectate);
                setText('spectating', s && s.alive && s.team === player.team ? `İZLENİYOR: ${s.name} · Boşluk/tık: sıradaki` : '');
                if (s && !s.alive && s.team === player.team) spectateNext();
            } else setText('spectating', '');
            $('revealed').classList.toggle('hidden', !(player.alive && combatPhase() && now < player.revealedUntil));
        }
        updateEffects(dt);
        renderFrame(now, dt);
    }

    function renderFrame(now, dt) {
        const w = weaponOf();
        if (match.phase === 'menu') {
            const t = now * 0.00003;
            camera.position.set(Math.sin(t) * 50, 34, Math.cos(t) * 64);
            camera.lookAt(0, 0, 0);
            if (Math.abs(camera.fov - prefs.fov) > 0.05) { camera.fov = prefs.fov; camera.updateProjectionMatrix(); }
            Object.values(vmModels).forEach((m) => { m.visible = false; });
        } else {
            player.kickPitch -= player.kickPitch * Math.min(1, dt * 8);
            let yaw = player.yaw;
            let pitch = player.pitch + player.kickPitch;
            let cx = player.x;
            let cy = player.y + player.eye;
            let cz = player.z;
            const spec = !player.alive && inMatch() && now > (player.spectateAt || 0) ? actors.get(player.spectate) : null;
            if (spec && spec.alive && spec.team === player.team) {
                cx = spec.x; cy = spec.y + 1.55 * (STANCE_SCALE[spec.stance] || 1); cz = spec.z; yaw = spec.yaw; pitch = spec.pitch;
            } else if (!player.alive && inMatch()) {
                const f = fighterById(player.killer);
                cy = player.y + 3;
                if (f) { yaw = Math.atan2(-(f.x - player.x), -(f.z - player.z)); pitch = Math.atan2(f.y + 1.2 - cy, Math.hypot(f.x - player.x, f.z - player.z)); } else pitch = -0.6;
            }
            camera.position.set(cx, cy, cz);
            if (shake > 0) camera.position.add(new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(shake * 0.12));
            if (player.alive && now < player.stunUntil) { yaw += Math.sin(now / 90) * 0.012; pitch += Math.sin(now / 130) * 0.01; }
            camera.rotation.set(pitch, yaw, 0);
            const zoom = player.ads && player.alive ? (w.zoom || 1.15) : 1;
            const fovT = prefs.fov / zoom;
            if (Math.abs(camera.fov - fovT) > 0.05) { camera.fov += (fovT - camera.fov) * Math.min(1, dt * 16); camera.updateProjectionMatrix(); }
            const scoped = player.ads && w.id === 'yayla' && player.alive && camera.fov < prefs.fov / 2;
            setStyle('scope', 'display', scoped ? 'block' : 'none');
            setStyle('crosshair', 'display', scoped || !player.alive || !inMatch() ? 'none' : 'block');
            const spread = currentSpread(w);
            setStyle('crosshair', '--gap', `${Math.round(3 + spread * 300)}px`);
            muzzleLight.position.copy(camera.position);
            let reloadP = 0;
            if (player.reloading) reloadP = (now - player.reloadStart) / w.reload;
            const curId = w.id;
            Object.entries(vmModels).forEach(([id, m]) => { m.visible = id === curId && player.alive && !scoped && inMatch(); });
            const cur = vmModels[curId];
            vmKick = Math.max(0, vmKick - dt * 9);
            vmSwap = Math.max(0, vmSwap - dt * 4);
            const walking = player.onGround && player.speedNow > 1;
            if (walking) bobT += dt * player.speedNow * 1.5;
            const tx = player.ads && w.id !== 'knife' ? 0 : 0.2;
            const ty = player.ads && w.id !== 'knife' ? -0.12 : -0.2;
            const tz = player.ads && w.id !== 'knife' ? -0.32 : -0.42;
            const k = Math.min(1, dt * 16);
            vmRoot.position.x += (tx - vmRoot.position.x) * k;
            vmRoot.position.y += (ty - vmRoot.position.y) * k;
            vmRoot.position.z += (tz - vmRoot.position.z) * k;
            const rp = Math.sin(clamp(reloadP, 0, 1) * Math.PI);
            if (cur) {
                const stab = w.melee ? vmKick * 0.18 : 0;
                cur.position.set(walking ? Math.cos(bobT) * 0.006 : 0, (walking ? Math.abs(Math.sin(bobT)) * 0.01 : 0) - vmSwap * 0.3 - rp * 0.14 - (player.action ? 0.2 : 0), vmKick * (w.melee ? -0.25 : 0.06) + stab);
                cur.rotation.set(vmKick * (w.melee ? -0.4 : 0.1) + rp * 0.7 + vmSwap * 0.5, w.melee ? 0.3 : 0, rp * 0.25);
                if (cur.userData.flash) {
                    cur.userData.flash.visible = now < flashUntil && !w.silent;
                    if (cur.userData.flash.visible) cur.userData.flash.scale.setScalar(0.8 + Math.random() * 0.8);
                }
            }
            vmFlashLight.intensity = now < flashUntil ? 1.6 : 0;
        }
        renderer.setClearColor(mapLook.sky[0], 1);
        renderer.clear();
        renderer.render(scene, camera);
        if (match.phase !== 'menu' && player.alive) {
            renderer.clearDepth();
            renderer.render(vmScene, vmCamera);
        }
    }

    /* ---------- Başlat ---------- */

    if (new URLSearchParams(location.search).has('debug')) {
        // Yalnızca ?debug ile: tarayıcı testleri için durum ve birkaç kısayol.
        window.VektorDebug = {
            three: { scene, renderer, camera },
            state: () => ({
                phase: match.phase, mode: match.mode, timer: match.timer, round: match.round, half: match.half, score: match.score.slice(),
                player: { nid: player.nid, team: player.team, side: mySide(), x: player.x, z: player.z, hp: player.hp, armor: player.armor, alive: player.alive, credits: player.credits, slot: player.slot, primary: player.primary, ammo: player.slot >= 0 && WEAPONS[player.slot].mag ? ammoOf(player.slot).slice() : null, charges: { ...player.charges }, ult: player.ult, hasSpike: player.hasSpike },
                spike: { state: spike.state, carrier: spike.carrier, site: spike.site },
                roster: [...roster].map(([nid, r]) => ({ nid, ...r, alive: isAlive(nid), x: nid === player.nid ? player.x : actors.get(nid)?.x, z: nid === player.nid ? player.z : actors.get(nid)?.z, credits: actors.get(nid)?.sim?.credits, primary: actors.get(nid)?.sim?.primary })),
                zones: zones.map((z) => z.kind), projectiles: projectiles.size, conns: conns.length
            }),
            place(x, z, yaw) { player.x = x; player.z = z; player.y = 0; if (yaw !== undefined) player.yaw = yaw; },
            look(pitch) { player.pitch = clamp(pitch, -1.5, 1.5); },
            aimAt(nid) {
                const a = actors.get(nid);
                if (!a) return false;
                const ey = player.y + player.eye;
                player.yaw = Math.atan2(-(a.x - player.x), -(a.z - player.z));
                player.pitch = Math.atan2(a.y + 1.15 - ey, Math.hypot(a.x - player.x, a.z - player.z));
                return true;
            },
            skipPhase() { match.timer = 1; },
            near(nid, dist = 6) {
                const a = actors.get(nid);
                if (!a) return false;
                for (let i = 0; i < 24; i++) {
                    const ang = (i / 24) * TAU;
                    const x = a.x + Math.cos(ang) * dist;
                    const z = a.z + Math.sin(ang) * dist;
                    if (!blocked(x, z, 0) && canSee(x, 1.6, z, a.x, a.y + 1.2, a.z)) { player.x = x; player.z = z; player.y = 0; return true; }
                }
                return false;
            },
            giveSpike() { giveSpike(player.nid, performance.now()); },
            half(h) { match.half = h; },
            plantFor(nid, site) {
                const s = SITES[site];
                spike.carrier = nid;
                spike.state = 'carried';
                plantSpike(nid, [(s.x0 + s.x1) / 2, 0, (s.z0 + s.z1) / 2], performance.now());
            },
            credits(n) { player.credits = n; },
            freeze(on) { botsFrozen = Boolean(on); },
            sim(nid) {
                const a = actors.get(nid);
                if (!a || !a.sim) return null;
                const now = performance.now();
                return { hp: a.sim.hp, armor: a.sim.armor, alive: a.sim.alive, stun: Math.max(0, a.sim.stunUntil - now), slow: Math.max(0, a.sim.slowUntil - now), slot: a.sim.slot, x: a.x, z: a.z, team: a.team };
            },
            setSim(nid, v) { const a = actors.get(nid); if (a && a.sim) Object.assign(a.sim, v); if (a && v.x !== undefined) { a.x = v.x; a.z = v.z; } },
            revealed: (nid) => Math.max(0, (reveals.get(nid) || 0) - performance.now()),
            slotName: () => WEAPONS[player.slot].id,
            ult() { player.ult = ULT_COST; updateAbilityHud(); },
            sites: SITES,
            map: (id) => { if (id) buildMap(id); return mapId; },
            zoneList: () => zones.map((z) => ({ kind: z.kind, x: z.x, y: z.y, z: z.z, r: z.r, team: z.team })),
            mapCheck() {
                // Every tactical and spawn point must stand on free nav cells and be reachable from both spawns.
                const bad = [];
                const all = [...SPAWN_POINTS[0], ...SPAWN_POINTS[1]];
                for (const [k, t] of Object.entries(TACTIC)) for (const list of [t.hold, t.watch, t.stage, t.plant || [], t.entry ? [t.entry] : []]) for (const q of list) all.push({ ...q, k });
                for (const q of all) {
                    if (nav[navIndex(q.x, q.z)]) bad.push(['blocked', q]);
                    for (const side of [0, 1]) { const s0 = SPAWN_POINTS[side][0]; if (!findPath(s0.x, s0.z, q.x, q.z)) bad.push(['unreachable', side, q]); }
                }
                for (const [k, t] of Object.entries(TACTIC)) if (t.plant) for (const q of t.plant) if (inSite(q.x, q.z)?.name !== k) bad.push(['plant-outside', k, q]);
                return { map: mapId, solids: solids.length, barriers: barriers.length, sites: Object.keys(SITES), bad };
            }
        };
    }

    buildMap(prefs.map === 'random' ? 'liman' : prefs.map);
    applyQuality();
    renderOptions();
    renderSettings();
    buildViewmodels(myCamo(), prefs.agent);
    showMenu();
    requestAnimationFrame((t) => { lastFrame = t; frame(t); });
})();
