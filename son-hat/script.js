(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const app = $('app');
    const canvas = $('field');
    const ctx = canvas.getContext('2d');
    const Profile = window.CasualProfile;
    const cheats = () => window.CasualCheats;
    const cheatsOn = () => Boolean(cheats()?.active?.());
    const immortal = () => Boolean(cheats()?.immortal?.());
    const fmt = n => Math.max(0, Math.floor(n)).toLocaleString('tr-TR');
    const reduceMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    const calm = () => reduceMQ.matches || document.body.classList.contains('disable-effects');
    const coarse = window.matchMedia ? window.matchMedia('(hover: none)').matches : false;

    // ---------- Persistent progress (first-party cookie) ----------
    // Compact save so the cookie stays well under 4 KB:
    // { st: stage, r: [gold, iron, food], k: kills, b: [[type, tile, level, collectedAt]], h: [hero levels], tm: [team hero indexes],
    //   s: "3210…" best stars per stage (optional), tu: tutorial done (optional), o: option bits (optional, 1 = no screen shake) }
    const SAVE_KEY = 'cp_sonhat_v2';
    const OLD_KEY = 'cp_sonhat_v1';
    const SAVE_LIMIT = 3000;
    const MAX_STAGE = 99;
    const MAX_LEVEL = 15;
    const MAX_HERO = 10;
    const GRID = 5;
    const HQ_TILE = 12;
    const OPT_NO_SHAKE = 1;
    const RES = [
        { id: 'gold', name: 'Altın' },
        { id: 'iron', name: 'Demir' },
        { id: 'food', name: 'Yiyecek' }
    ];
    const REGIONS = ['Köprü', 'Liman', 'Sanayi', 'Şehir Merkezi', 'Son Kale'];
    // cost: [gold, iron, food] at level 0→1; each level multiplies by 1.55.
    const BUILDINGS = [
        { id: 'hq', icon: '🏰', name: 'Karargâh', cost: [70, 20, 0], unlock: 0, max: () => 1, desc: l => `Diğer binalar en fazla Sv ${l} · ${4 + l} bina yeri · ganimet +%${l * 5}` },
        { id: 'barracks', icon: '⛺', name: 'Kışla', cost: [40, 0, 20], unlock: 1, max: () => 1, desc: l => `Savaşa ${1 + l} askerle başla` },
        { id: 'armory', icon: '🔧', name: 'Silah Atölyesi', cost: [50, 15, 0], unlock: 1, max: () => 1, desc: l => `Mermi hasarı +%${l * 15}` },
        { id: 'range', icon: '🎯', name: 'Atış Poligonu', cost: [50, 15, 0], unlock: 1, max: () => 1, desc: l => `Ateş hızı +%${l * 8}` },
        { id: 'goldmine', icon: '💰', name: 'Altın Madeni', cost: [30, 0, 0], unlock: 1, max: hq => Math.min(3, 1 + Math.floor(hq / 3)), prod: 0, rate: 1.5, desc: l => `Dakikada ${fmt1(1.5 * l)} altın` },
        { id: 'farm', icon: '🌾', name: 'Çiftlik', cost: [35, 0, 0], unlock: 1, max: hq => Math.min(3, 1 + Math.floor(hq / 3)), prod: 2, rate: 1.2, desc: l => `Dakikada ${fmt1(1.2 * l)} yiyecek` },
        { id: 'ironmine', icon: '⛏️', name: 'Demir Madeni', cost: [45, 0, 10], unlock: 2, max: hq => Math.min(3, 1 + Math.floor(hq / 4)), prod: 1, rate: 1, desc: l => `Dakikada ${fmt1(l)} demir` },
        { id: 'depot', icon: '📦', name: 'Depo', cost: [60, 20, 0], unlock: 2, max: () => 1, desc: l => `Madenler ${60 + l * 30} dakikalık üretim biriktirir` },
        { id: 'hangar', icon: '🚁', name: 'Hangar', cost: [120, 40, 20], unlock: 3, max: () => 1, desc: l => l ? `Savaşa helikopterle başla · helikopter hasarı +%${(l - 1) * 20}` : 'Savaşa helikopterle başla' }
    ];
    const B = Object.fromEntries(BUILDINGS.map((b, i) => [b.id, i]));
    const fmt1 = v => (Math.round(v * 10) / 10).toLocaleString('tr-TR');
    const levelCost = (b, level) => b.cost.map(c => Math.round(c * Math.pow(1.55, level)));

    const RARITY = [
        { name: 'Nadir', color: '#3b8cff', mult: 1, odds: .7 },
        { name: 'Destansı', color: '#a24bff', mult: 1.5, odds: .25 },
        { name: 'Efsanevi', color: '#ffb000', mult: 2.2, odds: .05 }
    ];
    const BRANCHES = [
        { id: 'tank', name: 'Tank', icon: '🛡️', color: '#3b7be0' },
        { id: 'air', name: 'Uçak', icon: '✈️', color: '#22b7c9' },
        { id: 'missile', name: 'Füze', icon: '🚀', color: '#e0663b' }
    ];
    const HEROES = [
        { name: 'Demir', branch: 0, rarity: 0 }, { name: 'Kaya', branch: 0, rarity: 1 }, { name: 'Tuğra', branch: 0, rarity: 2 },
        { name: 'Şahin', branch: 1, rarity: 0 }, { name: 'Doğan', branch: 1, rarity: 1 }, { name: 'Atmaca', branch: 1, rarity: 2 },
        { name: 'Ece', branch: 2, rarity: 0 }, { name: 'Yıldırım', branch: 2, rarity: 1 }, { name: 'Kıvılcım', branch: 2, rarity: 2 }
    ];
    const RECRUIT_COST = 150;
    const TEAM_SIZE = 3;
    const heroMult = i => RARITY[HEROES[i].rarity].mult;
    const shieldOf = (i, l) => Math.round((1 + l) * heroMult(i));
    const airEvery = (i, l) => Math.max(3.5, 11 - l * .6 - HEROES[i].rarity * 1.5);
    const missileEvery = (i, l) => Math.max(1, 3.4 - l * .2 - HEROES[i].rarity * .5);
    function heroSkill(i, l) {
        const b = HEROES[i].branch;
        if (b === 0) return `Kalkan ilk ${shieldOf(i, l)} zombi darbesini emer.`;
        if (b === 1) return `${fmt1(airEvery(i, l))} sn'de bir en kalabalık sürüye hava saldırısı.`;
        return `${fmt1(missileEvery(i, l))} sn'de bir hedef arayan füze.`;
    }
    const heroLevelCost = l => [Math.round(30 * Math.pow(1.6, l - 1)), 0, Math.round(40 * Math.pow(1.6, l - 1))];

    const now = () => Math.floor(Date.now() / 1000);
    const defaults = () => ({ st: 1, r: [60, 10, 20], k: 0, b: [[B.hq, HQ_TILE, 1, now()], [B.goldmine, 7, 1, now()]], h: [1, 0, 0, 0, 0, 0, 0, 0, 0], tm: [0], s: '', tu: 0, o: 0 });
    function readCookie(name) {
        const row = document.cookie.split('; ').find(v => v.startsWith(name + '='));
        if (!row) return null;
        try { return JSON.parse(decodeURIComponent(row.slice(name.length + 1))); } catch (_) { return null; }
    }
    const int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(Number(v) || 0)));
    function load() {
        const d = defaults();
        const raw = readCookie(SAVE_KEY);
        if (!raw || typeof raw !== 'object') {
            const old = readCookie(OLD_KEY);
            if (old) { d.r[0] += int(old.coin, 0, 1e6); d.tu = 1; }
            return d;
        }
        d.st = int(raw.st, 1, MAX_STAGE);
        d.k = int(raw.k, 0, 1e9);
        d.r = [0, 1, 2].map(i => int(raw.r?.[i], 0, 1e9));
        const tiles = new Set();
        const list = [];
        for (const row of Array.isArray(raw.b) ? raw.b : []) {
            const type = int(row?.[0], 0, BUILDINGS.length - 1), tile = int(row?.[1], 0, GRID * GRID - 1);
            if (tiles.has(tile) || (type === B.hq) !== (tile === HQ_TILE)) continue;
            tiles.add(tile);
            list.push([type, tile, int(row?.[2], 1, MAX_LEVEL), int(row?.[3], 0, now())]);
        }
        if (!list.some(b => b[0] === B.hq)) list.unshift([B.hq, HQ_TILE, 1, now()]);
        d.b = list;
        d.h = HEROES.map((_, i) => int(raw.h?.[i], 0, MAX_HERO));
        if (!d.h.some(Boolean)) d.h[0] = 1;
        d.tm = [...new Set((Array.isArray(raw.tm) ? raw.tm : []).map(v => int(v, 0, HEROES.length - 1)))].filter(i => d.h[i] > 0).slice(0, TEAM_SIZE);
        if (!d.tm.length) d.tm = [d.h.findIndex(Boolean)];
        // New optional fields; older v2 saves simply lack them.
        d.s = typeof raw.s === 'string' ? raw.s.replace(/[^0-3]/g, '').slice(0, MAX_STAGE) : '';
        d.tu = raw.tu || d.st > 1 || d.k > 0 ? 1 : 0;
        d.o = int(raw.o, 0, 255);
        return d;
    }
    const save$ = load();
    function persist() {
        if (cheatsOn()) return;
        const data = { ...save$ };
        if (!data.s) delete data.s;
        if (!data.o) delete data.o;
        const value = encodeURIComponent(JSON.stringify(data));
        if (value.length > SAVE_LIMIT) return; // Never write a cookie the browser could drop.
        const secure = location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `${SAVE_KEY}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
        if (readCookie(OLD_KEY)) document.cookie = `${OLD_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
    }
    const starsOf = n => Math.max(Number(save$.s[n - 1] || 0), n < save$.st ? 1 : 0);
    function setStars(n, v) {
        if (v <= Number(save$.s[n - 1] || 0)) return;
        const s = save$.s.padEnd(n, '0');
        save$.s = s.slice(0, n - 1) + v + s.slice(n);
    }
    const shakeOn = () => !(save$.o & OPT_NO_SHAKE) && !calm();

    // ---------- Base helpers ----------
    const levelOf = id => save$.b.filter(b => b[0] === B[id]).reduce((m, b) => Math.max(m, b[2]), 0);
    const hqLevel = () => levelOf('hq');
    const slotLimit = () => Math.min(GRID * GRID, 4 + hqLevel());
    const countOf = type => save$.b.filter(b => b[0] === type).length;
    const storageMinutes = () => 60 + levelOf('depot') * 30;
    const storedMinutes = b => Math.min(storageMinutes(), Math.max(0, now() - b[3]) / 60);
    function pending(b) {
        const def = BUILDINGS[b[0]];
        if (def.prod == null) return 0;
        return Math.floor(storedMinutes(b) * def.rate * b[2]);
    }
    const canAfford = cost => cost.every((c, i) => save$.r[i] >= c);
    const pay = cost => cost.forEach((c, i) => { save$.r[i] -= c; });
    const costHtml = cost => cost.map((c, i) => c ? `<span class="cost ${RES[i].id}${save$.r[i] < c ? ' short' : ''}"><i aria-hidden="true"></i>${fmt(c)}</span>` : '').join('');
    const costText = cost => cost.map((c, i) => c ? `${fmt(c)} ${RES[i].name.toLowerCase()}` : '').filter(Boolean).join(', ');

    // ---------- Squad stats ----------
    const WEAPONS = [
        { name: 'Tabanca', rate: 2, dmg: 1, pellets: 1, color: '#ffd25a' },
        { name: 'Makineli', rate: 5, dmg: .9, pellets: 1, color: '#ffb02e' },
        { name: 'Pompalı', rate: 2.2, dmg: 1.1, pellets: 3, color: '#ff8a3d' },
        { name: 'Lazer', rate: 4, dmg: 2.4, pellets: 1, color: '#5fe1ff' }
    ];
    function branchBonus() {
        const counts = [0, 0, 0];
        for (const i of save$.tm) counts[HEROES[i].branch] += 1;
        const top = Math.max(...counts);
        return top >= 3 ? .15 : top === 2 ? .05 : 0;
    }
    const dmgMult = () => (1 + levelOf('armory') * .15) * (1 + branchBonus());
    const rateMult = () => 1 + levelOf('range') * .08;
    const lootMult = () => 1 + hqLevel() * .05;
    const startSoldiers = () => 1 + levelOf('barracks');
    const powerScore = () => Math.round(startSoldiers() * 2 * dmgMult() * rateMult() * 10 * (1 + levelOf('hangar') * .1)
        + save$.tm.reduce((s, i) => s + save$.h[i] * 25 * heroMult(i), 0));
    const recommendedPower = n => Math.round(30 + (n - 1) * 8 + (n - 1) * (n - 1) * 1.1);

    // ---------- Theme palettes (canvas) ----------
    const PALETTES = {
        liquid: { sea: ['#0d6a80', '#1b8ea0'], wave: 'rgba(255,255,255,.08)', shadow: 'rgba(0,30,40,.28)', curb: '#6f7b85', deck: '#c9ced3', deck2: '#c1c7cd', lane: 'rgba(255,255,255,.9)', edge: 'rgba(255,255,255,.65)', rail: '#4b5862', pillar: '#9aa3aa', pillarTop: '#c7ccd0', ink: '#10324a', blood: '#3d6b2a' },
        paper: { sea: ['#bfe1ec', '#9fd2e2'], wave: 'rgba(255,255,255,.45)', shadow: 'rgba(60,50,30,.16)', curb: '#a99f8e', deck: '#f1ebdf', deck2: '#e9e2d3', lane: 'rgba(120,108,88,.55)', edge: 'rgba(120,108,88,.4)', rail: '#8a8172', pillar: '#cfc6b4', pillarTop: '#e3dccb', ink: '#2c3e50', blood: '#6f8f4a' },
        neon: { sea: ['#03040c', '#0b1032'], wave: 'rgba(0,242,254,.12)', shadow: 'rgba(0,0,0,.55)', curb: '#1d2238', deck: '#141a2c', deck2: '#111626', lane: 'rgba(0,242,254,.95)', edge: 'rgba(254,0,161,.9)', rail: '#fe00a1', pillar: '#232a45', pillarTop: '#36406a', ink: '#05060f', blood: '#00b386', glow: true },
        retro: { sea: ['#29366f', '#3b5dc9'], wave: 'rgba(65,166,246,.4)', shadow: 'rgba(26,28,44,.45)', curb: '#333c57', deck: '#5d7290', deck2: '#566a87', lane: 'rgba(244,244,244,.95)', edge: 'rgba(255,205,117,.95)', rail: '#1a1c2c', pillar: '#94b0c2', pillarTop: '#f4f4f4', ink: '#1a1c2c', blood: '#38b764', pixel: true }
    };
    let themeId = 'liquid';
    let pal = PALETTES.liquid;
    function readTheme() {
        themeId = ['paper', 'neon', 'retro'].find(t => document.body.classList.contains('theme-' + t)) || 'liquid';
        pal = PALETTES[themeId];
        seaCache = null;
    }

    // ---------- View / projection ----------
    // Road spans x ∈ [-1, 1]; z grows forward. Depth d = z - camera z.
    const view = { w: 480, h: 800, dpr: 1, dprCap: coarse ? 1.5 : 2, cx: 240, half: 180, baseY: 620, topY: -40 };
    const cam = { x: 0 };
    const K = .05;
    const scaleAt = d => 1 / (1 + Math.max(-12, d) * K);
    const sy = d => view.topY + (view.baseY - view.topY) * scaleAt(d);
    const sx = (x, d) => view.cx + (x - cam.x) * view.half * scaleAt(d);
    const unitPx = d => view.half * scaleAt(d);
    let seaCache = null;
    function resize() {
        const w = window.innerWidth, h = window.innerHeight;
        // Retro renders at a low resolution and is scaled up with crisp pixels.
        const dpr = pal.pixel ? .5 : Math.min(view.dprCap, window.devicePixelRatio || 1);
        view.w = w; view.h = h; view.dpr = dpr; view.cx = w / 2;
        view.half = Math.min(w * .42, h * .3);
        view.baseY = h * .74;
        view.topY = -h * .08;
        canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr));
        seaCache = null;
        if (mode !== 'run') drawScene(performance.now() / 1000);
    }

    // ---------- Pools (no per-frame garbage for bullets, particles, labels) ----------
    const fxPool = [], textPool = [], bulletPool = [];
    const take = pool => pool.pop() || {};
    function sweep(list, pool, dead) {
        let j = 0;
        for (let i = 0; i < list.length; i++) {
            const o = list[i];
            if (dead(o)) { if (pool) pool.push(o); } else list[j++] = o;
        }
        list.length = j;
    }
    const FX_CAP = () => calm() ? 140 : 320;

    // ---------- Run state ----------
    let mode = 'menu';
    let run = null;
    let playStage = save$.st;
    let lastT = 0, rafId = 0;
    const keys = new Set();
    let drag = null;

    function rng(seed) {
        let a = seed >>> 0;
        return () => {
            a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    const zombieHp = n => 1 + (n - 1) * .34;
    const isBossStage = n => n % 5 === 0;
    const ZSKIN = ['#8fc76a', '#7fb85c', '#a3cf7d', '#93b86a'];
    const ZSHIRT = ['#c9393b', '#6b5bd1', '#d18a2b', '#3f8f8f', '#8a5a3c'];
    function buildStage(n) {
        const r = rng(n * 7919 + 13);
        const L = Math.min(250, 140 + n * 4);
        const ents = [];
        const zhp = zombieHp(n);
        const gate = (x, z, op, v, shootable, stream) => ents.push({ kind: 'gate', x, z, op, v, cap: v + 20, shootable: shootable && op !== '×', stream, hw: .44, used: false });
        const horde = (cx, spread, z, count, hp) => {
            for (let i = 0; i < count; i++) {
                ents.push({ kind: 'zombie', x: Math.max(-.92, Math.min(.92, cx + (r() * 2 - 1) * spread)), z: z + r() * 3.2, hp, max: hp, hw: .07, speed: 1.1 + r() * .5, power: 1, wob: r() * 6 });
            }
        };
        const crateHp = () => Math.round(12 * (1 + (n - 1) * .5) * (.8 + r() * .6));
        const rewardsQueue = ['weapon', 'heli', 'troops', 'weapon', 'rate', 'troops', 'weapon', 'rate', 'heli'];
        let rewardIdx = Math.floor(r() * 2);
        const nextReward = () => rewardsQueue[(rewardIdx++) % rewardsQueue.length];
        const crate = (x, z) => {
            const hp = crateHp();
            const loot = [nextReward()];
            if (r() < .35) loot.push(nextReward());
            ents.push({ kind: 'crate', x, z, hp, max: hp, loot, hw: .42, len: 3.2 });
        };
        let z = 14;
        let first = true;
        while (z < L - 26) {
            const roll = r();
            const lane = r() < .5 ? -1 : 1;
            if (first || roll < .26) {
                const len = 6 + Math.floor(r() * 5);
                for (let i = 0; i < len; i++) gate(lane * .5, z + i * 1.4, '+', 1, false, true);
                if (first || r() < .55) crate(-lane * .5, z + 1);
                else horde(-lane * .5, .32, z + len * .9, 4 + Math.floor(n * .6), zhp);
                z += len * 1.4 + 9;
                first = false;
            } else if (roll < .52) {
                const good = r() < .22 ? { op: '×', v: 2 } : { op: '+', v: 3 + Math.floor(n / 3) + Math.floor(r() * 4) };
                const bad = r() < .5 ? { op: '−', v: 2 + Math.floor(n / 2) + Math.floor(r() * 4) } : { op: '+', v: 1 };
                const left = r() < .5;
                gate(-.5, z, (left ? good : bad).op, (left ? good : bad).v, true, false);
                gate(.5, z, (left ? bad : good).op, (left ? bad : good).v, true, false);
                z += 11;
            } else if (roll < .72) {
                crate(lane * .5, z);
                horde(-lane * .5, .3, z, 5 + Math.floor(n * .7), zhp);
                z += 13;
            } else if (roll < .93) {
                horde(0, .85, z, Math.min(48, 7 + Math.floor(n * 1.1) + Math.floor(r() * 4)), zhp);
                z += 12;
            } else {
                const hp = Math.round(30 * (1 + (n - 1) * .45));
                ents.push({ kind: 'brute', x: (r() * 2 - 1) * .5, z: z + 2, hp, max: hp, hw: .2, speed: .9, power: 5, wob: 0 });
                z += 11;
            }
        }
        const bossHp = Math.round(220 * (1 + (n - 1) * .55) * (isBossStage(n) ? 1.7 : 1));
        const boss = { kind: 'boss', x: 0, z: L, hp: bossHp, max: bossHp, hw: .42, speed: .75, power: 0, wob: 0, big: isBossStage(n) };
        ents.push(boss);
        return { L, ents, boss };
    }

    function startRun(n) {
        if (run) recycleRun();
        const stage = buildStage(n);
        run = {
            n, L: stage.L, ents: stage.ents, boss: stage.boss,
            z: 0, x: 0, tx: 0, soldiers: startSoldiers(), peak: startSoldiers(), start: startSoldiers(),
            weapon: 0, rateBonus: 1, dmgBonus: 1, heli: levelOf('hangar') > 0 ? 1 : 0,
            bullets: [], fx: [], texts: [], rockets: [], decals: [],
            fireT: 0, heliT: 0, contactT: 0, minionT: 0,
            shield: save$.tm.filter(i => HEROES[i].branch === 0).reduce((sum, i) => sum + shieldOf(i, save$.h[i]), 0),
            skills: save$.tm.filter(i => HEROES[i].branch > 0).map((i, k) => ({ i, l: save$.h[i], t: 1.5 + k })),
            coins: 0, iron: 0, food: 0, kills: 0, crates: 0, rammed: 0, arena: false, over: false, endT: 0, won: false, t: 0, shake: 0,
            hurtT: 0, tut: !save$.tu, seen: new Set(), lastHud: ''
        };
        cam.x = 0;
        mode = 'run';
        app.dataset.mode = 'run';
        hideOverlays();
        $('run-title').textContent = `Bölüm ${n}`;
        $('run-weapon').textContent = WEAPONS[0].name;
        $('boss-bar').classList.add('hidden');
        $('boss-name').textContent = stage.boss.big ? 'DEV BOSS' : 'BOSS';
        if (run.tut) coach('drag', coarse ? 'Parmağını sağa sola kaydırıp şerit seç' : 'Fareyle sürükle ya da ← → / A D ile şerit seç', 3.6);
        else hint(coarse ? 'Sağa sola kaydır · kapıları seç' : 'Sürükle ya da ← → · kapıları seç', 2.6);
        lastT = performance.now();
        frameEma = 16;
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(loop);
    }
    function recycleRun() {
        for (const b of run.bullets) bulletPool.push(b);
        for (const p of run.fx) fxPool.push(p);
        for (const t of run.texts) textPool.push(t);
        run.bullets.length = run.fx.length = run.texts.length = 0;
    }

    let hintTimer = 0;
    function hint(text, secs, tut) {
        const el = $('run-hint');
        el.textContent = text;
        el.classList.toggle('tut', Boolean(tut));
        clearTimeout(hintTimer);
        hintTimer = setTimeout(() => { el.textContent = ''; el.classList.remove('tut'); }, secs * 1000);
    }
    function coach(id, text, secs = 3) {
        if (!run || !run.tut || run.seen.has(id)) return;
        run.seen.add(id);
        hint(text, secs, true);
    }

    const squadRadius = () => Math.min(.5, .07 + .034 * Math.sqrt(Math.max(1, run.soldiers)));
    const visibleTarget = e => e.hp > 0 && (e.kind === 'zombie' || e.kind === 'brute' || (e.kind === 'boss' && run.arena));

    function addText(x, z, text, color, size = 1, kind = 'pop') {
        if (run.texts.length > 40) return;
        // Stack labels that pop at the same moment so they don't overlap.
        const fresh = kind === 'pop' ? run.texts.filter(t => t.kind === 'pop' && t.t < .35).length : 0;
        const t = take(textPool);
        t.x = x + (kind === 'dmg' ? (Math.random() * 2 - 1) * .08 : 0); t.z = z + fresh * 1.6; t.text = text; t.color = color; t.size = size; t.t = 0; t.kind = kind;
        t.life = kind === 'dmg' ? .6 : 1.1;
        run.texts.push(t);
    }
    function fx(type, x, z, h, vx, vz, vh, color, life, size = 1, g = 6) {
        if (run.fx.length >= FX_CAP()) return;
        const p = take(fxPool);
        p.type = type; p.x = x; p.z = z; p.h = h; p.vx = vx; p.vz = vz; p.vh = vh; p.color = color; p.t = 0; p.life = life; p.size = size; p.g = g; p.rot = Math.random() * 6;
        run.fx.push(p);
    }
    function burst(x, z, color, count = 6, spread = .12, type = 'dot') {
        if (calm()) count = Math.ceil(count / 2);
        for (let i = 0; i < count; i++) fx(type, x, z, .05 + Math.random() * .15, (Math.random() * 2 - 1) * spread * 4, (Math.random() * 2 - 1) * 2, 1 + Math.random() * 2, color, .45 + Math.random() * .3, 1);
    }
    function decal(x, z, r, color) {
        if (run.decals.length > 36) run.decals.shift();
        run.decals.push({ x, z, r, color, rot: Math.random() * 3 });
    }
    function shake(v) { if (shakeOn()) run.shake = Math.max(run.shake, v); }

    function loseSoldiers(k, x, z) {
        if (k <= 0) return;
        if (run.shield > 0) { run.shield -= 1; addText(x, z, 'KALKAN', '#9fd4ff', .8); fx('ring', run.x, run.z, .1, 0, 0, 0, '#9fd4ff', .35, .5, 0); return; }
        run.soldiers -= k;
        run.hurtT = .35;
        burst(run.x, run.z, '#2f8cff', Math.min(10, 3 + k));
        addText(run.x, run.z + .5, `−${k}`, '#ff6b6b', 1);
        shake(.12);
        if (run.soldiers <= 0) {
            if (immortal()) run.soldiers = 1;
            else { run.soldiers = 0; finish(false); }
        }
    }

    function kill(e) {
        e.hp = 0;
        run.kills += e.kind === 'zombie' ? 1 : 0;
        const coins = e.kind === 'boss' ? 40 + run.n * 4 : e.kind === 'brute' ? 8 : 1;
        run.coins += coins;
        if (e.kind === 'zombie') {
            burst(e.x, e.z, ZSKIN[Math.floor(e.wob * 10) % ZSKIN.length], 4, .1, 'chunk');
            burst(e.x, e.z, pal.blood, 2, .08);
            fx('coin', e.x, e.z, .3, 0, 0, 2.6, '#ffd34d', .55, 1, 7);
            decal(e.x, e.z, .1, pal.blood);
        } else {
            burst(e.x, e.z, '#ff7a7a', 14, e.hw, 'chunk');
            burst(e.x, e.z, pal.blood, 8, e.hw);
            fx('ring', e.x, e.z, .1, 0, 0, 0, '#ffe08a', .45, e.kind === 'boss' ? 1.4 : .6, 0);
            decal(e.x, e.z, e.kind === 'boss' ? .45 : .22, pal.blood);
            addText(e.x, e.z, `+${coins}`, '#ffd34d', 1.1);
            shake(e.kind === 'boss' ? .5 : .15);
        }
        if (e.kind === 'boss') {
            run.iron += 10 + run.n * 2;
            run.food += 5 + run.n;
            for (let i = 0; i < 3; i++) fx('ring', e.x + (Math.random() - .5) * .4, e.z + Math.random(), .3, 0, 0, 0, i ? '#ff9a5a' : '#fff3b0', .6 + i * .15, 1.2 + i * .4, 0);
            for (const o of run.ents) if (o.hp > 0 && (o.kind === 'zombie' || o.kind === 'brute')) { o.hp = 0; burst(o.x, o.z, ZSKIN[0], 3, .1, 'chunk'); }
            finish(true);
        }
    }

    function damage(e, amount) {
        if (e.hp <= 0) return;
        e.hp -= amount;
        e.flash = .08;
        if (e.kind !== 'zombie') e.acc = (e.acc || 0) + amount;
        if (e.kind === 'crate') { if (e.hp <= 0) breakCrate(e, true); return; }
        if (e.hp <= 0) kill(e);
    }

    function breakCrate(c, earned) {
        c.hp = 0;
        burst(c.x, c.z, '#c58b3a', 16, .3, 'chunk');
        fx('ring', c.x, c.z, .2, 0, 0, 0, earned ? '#ffe14d' : '#ff6b6b', .4, .8, 0);
        if (!earned) return;
        run.crates += 1;
        run.coins += 3;
        run.iron += 2 + Math.floor(run.n / 2);
        shake(.1);
        for (const loot of c.loot) grantLoot(loot, c.x, c.z);
    }

    function grantLoot(loot, x, z) {
        if (loot === 'weapon') {
            if (run.weapon < WEAPONS.length - 1) { run.weapon += 1; addText(x, z, WEAPONS[run.weapon].name.toUpperCase() + '!', '#ffe14d', 1.3); }
            else { run.dmgBonus += .25; addText(x, z, 'HASAR +%25', '#ffe14d', 1.2); }
            $('run-weapon').textContent = WEAPONS[run.weapon].name;
            $('run-weapon').classList.remove('bump'); void $('run-weapon').offsetWidth; $('run-weapon').classList.add('bump');
        } else if (loot === 'heli') {
            run.heli += 1; addText(x, z, run.heli > 1 ? 'HELİKOPTER +1' : 'HELİKOPTER!', '#8fe9ff', 1.3);
        } else if (loot === 'troops') {
            const k = 5 + Math.floor(run.n / 3); run.soldiers += k; run.peak = Math.max(run.peak, run.soldiers); addText(x, z, `+${k} ASKER`, '#7df29a', 1.2);
        } else if (loot === 'rate') {
            run.rateBonus += .25; addText(x, z, 'ATEŞ HIZI +%25', '#ffb36b', 1.2);
        }
    }

    function applyGate(g) {
        g.used = true;
        g.lit = .5;
        const before = run.soldiers;
        const v = Math.round(g.v);
        if (g.op === '+') run.soldiers += v;
        else if (g.op === '−') run.soldiers -= v;
        else if (g.op === '×') run.soldiers *= v;
        run.soldiers = Math.min(400, run.soldiers);
        run.peak = Math.max(run.peak, run.soldiers);
        const diff = run.soldiers - before;
        if (!g.stream || diff !== 1) addText(run.x, run.z + 1, diff >= 0 ? `+${diff}` : `${diff}`, diff >= 0 ? '#7df2ff' : '#ff6b6b', 1.2);
        if (diff > 0 && !g.stream) fx('ring', run.x, run.z, .1, 0, 0, 0, '#7df2ff', .4, .7, 0);
        if (diff < 0) { run.hurtT = .35; shake(.1); }
        if (run.soldiers <= 0) {
            if (immortal()) run.soldiers = 1;
            else { run.soldiers = 0; finish(false); }
        }
    }

    function finish(won) {
        if (run.over) return;
        run.over = true; run.won = won; run.endT = 0;
        $('boss-bar').classList.add('hidden');
    }

    function weaponStats() {
        const w = WEAPONS[run.weapon];
        return { w, rate: w.rate * rateMult() * run.rateBonus, dmg: w.dmg * dmgMult() * run.dmgBonus };
    }

    function nearestTarget(maxAhead, x = run.x) {
        let best = null, bestScore = Infinity;
        for (const e of run.ents) {
            if (!visibleTarget(e)) continue;
            const d = e.z - run.z;
            if (d < 0 || d > maxAhead) continue;
            const s = d + Math.abs(e.x - x) * 6;
            if (s < bestScore) { bestScore = s; best = e; }
        }
        return best;
    }

    function explode(x, z, radius, dmg, color) {
        for (const e of run.ents) {
            if (!visibleTarget(e)) continue;
            if (Math.abs(e.x - x) < radius + e.hw && Math.abs(e.z - z) < radius * 5) damage(e, dmg);
        }
        burst(x, z, color, 12, radius, 'spark');
        fx('ring', x, z, .1, 0, 0, 0, color, .4, radius * 2.4, 0);
        fx('smoke', x, z, .2, 0, .3, .6, 'rgba(70,70,80,.5)', .9, radius * 2, 0);
        shake(.15);
    }

    // ---------- Simulation ----------
    function step(dt) {
        run.t += dt;
        // Steering
        const dir = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
        if (dir) run.tx += dir * 2.4 * dt;
        const lim = .96 - squadRadius() * .6;
        run.tx = Math.max(-lim, Math.min(lim, run.tx));
        run.x += (run.tx - run.x) * Math.min(1, dt * 14);
        // Camera trails the squad a little so the bridge sways with the steering.
        cam.x += (run.x * .32 - cam.x) * Math.min(1, dt * 4);
        run.hurtT = Math.max(0, run.hurtT - dt);

        if (run.over) {
            run.endT += dt;
            stepEffects(dt);
            if (run.endT > (run.won ? 1.5 : 1.15)) endRun();
            return;
        }

        // Advance until the boss arena
        const arenaZ = run.L - 13;
        const speed = 6.5;
        if (run.z < arenaZ) {
            const prev = run.z;
            run.z = Math.min(arenaZ, run.z + speed * dt);
            for (const e of run.ents) {
                if (e.kind === 'gate' && !e.used && prev < e.z && run.z >= e.z && Math.abs(run.x - e.x) < e.hw + .02) applyGate(e);
                if (e.kind === 'gate' && !e.used && run.z > e.z) e.used = true;
                if (e.kind === 'crate' && e.hp > 0 && run.z + .3 >= e.z && run.z <= e.z + e.len && Math.abs(run.x - e.x) < e.hw + squadRadius() * .5) {
                    const cost = Math.max(1, Math.ceil(e.hp / (6 + run.n)));
                    run.rammed += 1;
                    breakCrate(e, false);
                    loseSoldiers(cost, e.x, e.z);
                    hint('Sandığı vurmadan çarptın: ödül yok!', 1.6);
                }
                if (run.tut) {
                    const d = e.z - run.z;
                    if (e.kind === 'gate' && e.stream && !e.used && d > 0 && d < 9) coach('stream', 'Mavi şeritten geç: her kapı +1 asker!', 2.6);
                    else if (e.kind === 'gate' && e.shootable && !e.used && d > 0 && d < 12) coach('gate', 'Büyük sayılı mavi kapıyı seç. Kırmızı kapıyı vurursan maviye döner!', 3.4);
                    else if (e.kind === 'crate' && e.hp > 0 && d > 0 && d < 12) coach('crate', 'Sandığı vurarak kır: içindeki ödül senin. Çarparsan asker kaybedersin!', 3.4);
                    else if (e.kind === 'brute' && e.hp > 0 && d > 0 && d < 16) coach('brute', 'İri zombi! 5 asker götürür, uzaktan vur.', 2.6);
                }
            }
            if (run.z >= arenaZ && !run.arena) {
                run.arena = true;
                $('boss-bar').classList.remove('hidden');
                if (run.tut) coach('boss', 'Boss geldi! Ateş etmeye devam et, boss’u durdur.', 3);
                else hint(run.boss.big ? 'DEV BOSS geliyor!' : 'Boss geliyor, hattı tut!', 2);
            }
        }
        if (run.over) return;

        // Enemies walk in
        const r = squadRadius();
        for (const e of run.ents) {
            if (e.flash) e.flash = Math.max(0, e.flash - dt);
            if (e.lit) e.lit = Math.max(0, e.lit - dt);
            if (e.acc > 0) {
                e.accT = (e.accT || 0) - dt;
                if (e.accT <= 0) { addText(e.x, e.z, fmt(Math.max(1, Math.round(e.acc))), e.kind === 'crate' ? '#fff3c4' : '#ffffff', .62, 'dmg'); e.acc = 0; e.accT = .22; }
            }
            if (!visibleTarget(e)) continue;
            const d = e.z - run.z;
            if (e.kind === 'boss') {
                if (!run.arena) continue;
                e.wob += dt * 3;
                if (d > .7) e.z -= e.speed * (e.big ? .85 : 1) * dt;
                else {
                    run.contactT -= dt;
                    if (run.contactT <= 0) { run.contactT = .45; loseSoldiers(1 + Math.floor(run.soldiers * .08), e.x, e.z); shake(.2); e.slam = .25; }
                }
                if (e.slam) e.slam = Math.max(0, e.slam - dt);
                continue;
            }
            if (d > 32) continue;
            e.z -= e.speed * dt;
            e.wob += dt * 8;
            if (d < 6) e.x += Math.sign(run.x - e.x) * Math.min(Math.abs(run.x - e.x), .28 * dt);
            if (d < .35 && d > -.6 && Math.abs(e.x - run.x) < r + e.hw) {
                e.hp = 0;
                burst(e.x, e.z, ZSKIN[0], 4, .1, 'chunk');
                loseSoldiers(e.power, e.x, e.z);
                if (run.over) return;
            } else if (d < -2) e.hp = 0; // slipped past the squad
        }

        // Boss minions
        if (run.arena && run.boss.hp > 0) {
            run.minionT -= dt;
            if (run.minionT <= 0) {
                run.minionT = Math.max(.55, 1.6 - run.n * .03);
                const hp = zombieHp(run.n);
                for (let i = 0; i < (run.boss.big ? 2 : 1); i++) run.ents.push({ kind: 'zombie', x: (Math.random() * 2 - 1) * .85, z: run.boss.z + .5, hp, max: hp, hw: .07, speed: 1.3, power: 1, wob: Math.random() * 6 });
            }
        }

        // Squad fire
        const { w, rate, dmg } = weaponStats();
        const shotsPerSec = run.soldiers * rate * w.pellets;
        const visualRate = Math.min(36, shotsPerSec);
        const perShot = dmg * shotsPerSec / visualRate;
        run.fireT += dt * visualRate;
        while (run.fireT >= 1) {
            run.fireT -= 1;
            const off = (Math.random() * 2 - 1) * r * .9;
            const vx = w.pellets > 1 ? (Math.random() * 2 - 1) * .5 : 0;
            const b = take(bulletPool);
            b.x = run.x + off; b.z = run.z + .3; b.vx = vx; b.dmg = perShot; b.color = w.color; b.life = 0; b.dead = false;
            run.bullets.push(b);
            if (Math.random() < .5) fx('flash', b.x, b.z - .1, .2, 0, 0, 0, w.color, .06, 1, 0);
        }

        // Helicopter escort
        if (run.heli > 0) {
            run.heliT -= dt;
            if (run.heliT <= 0) {
                run.heliT = .7;
                const t = nearestTarget(24, run.x + .6);
                if (t) run.rockets.push({ x: run.x + .55, z: run.z + .5, h: .9, target: t, dmg: 5 * (1 + run.n * .3) * run.heli * dmgMult() * (1 + Math.max(0, levelOf('hangar') - 1) * .2), radius: .3, color: '#8fe9ff', speed: 26, trail: 0 });
            }
        }

        // Hero skills (uçak: hava saldırısı, füze: hedef arayan füze)
        for (const sk of run.skills) {
            sk.t -= dt;
            if (sk.t > 0) continue;
            const power = heroMult(sk.i) * (1 + run.n * .35) * dmgMult();
            if (HEROES[sk.i].branch === 1) {
                sk.t = airEvery(sk.i, sk.l);
                const t = densest();
                if (t) { explode(t.x, t.z, .45, (10 + sk.l * 6) * power, '#ffef9a'); addText(t.x, t.z, 'HAVA SALDIRISI', '#ffef9a', 1); }
                else sk.t = .5;
            } else {
                sk.t = missileEvery(sk.i, sk.l);
                const t = nearestTarget(26);
                if (t) run.rockets.push({ x: run.x, z: run.z, h: .2, target: t, dmg: (5 + sk.l * 3) * power, radius: .32, color: '#ff9a5a', speed: 20, trail: 0 });
                else sk.t = .4;
            }
        }

        // Bullets
        const range = 26;
        for (const b of run.bullets) {
            const pz = b.z;
            b.z += 42 * dt; b.x += b.vx * dt; b.life += dt;
            if (b.z - run.z > range || Math.abs(b.x) > 1.05) { b.dead = true; continue; }
            let hit = null, hitZ = Infinity;
            for (const e of run.ents) {
                if (e.kind === 'gate') { if (!e.shootable || e.used) continue; }
                else if (e.hp <= 0 || (e.kind === 'boss' && !run.arena)) continue;
                const ez = e.z;
                if (ez < pz - .2 || ez > b.z + .2) continue;
                if (Math.abs(e.x - b.x) > e.hw) continue;
                if (ez < hitZ) { hitZ = ez; hit = e; }
            }
            if (hit) {
                b.dead = true;
                if (hit.kind === 'gate') {
                    // Shooting a gate is worth it: blue gates grow, red ones drain and turn blue.
                    const gain = .12 * Math.max(1, Math.min(3, b.dmg));
                    hit.flash = .08;
                    if (hit.op === '−') { hit.v -= gain; if (hit.v <= 0) { hit.op = '+'; hit.v = -hit.v; hit.lit = .4; addText(hit.x, hit.z, 'MAVİ!', '#7df2ff', 1); } }
                    else hit.v = Math.min(hit.cap, hit.v + gain);
                } else damage(hit, b.dmg);
                if (Math.random() < .35) fx('spark', b.x, hitZ, .12, (Math.random() - .5) * .6, -.5, 1.2, '#fff3b0', .16, 1);
            }
        }
        sweep(run.bullets, bulletPool, b => b.dead);

        // Rockets
        for (const k of run.rockets) {
            const t = k.target;
            if (t.hp <= 0) { const n = nearestTarget(26, k.x); if (n) k.target = n; else { k.dead = true; continue; } }
            const dx = k.target.x - k.x, dz = k.target.z - k.z;
            const dist = Math.hypot(dx * 6, dz);
            if (dist < .5) { k.dead = true; explode(k.target.x, k.target.z, k.radius, k.dmg, k.color); continue; }
            k.x += dx / dist * 6 * k.speed * dt / 6; k.z += dz / dist * k.speed * dt; k.h = Math.max(.1, k.h - dt * .5);
            k.trail -= dt;
            if (k.trail <= 0) { k.trail = .03; fx('smoke', k.x, k.z - .2, k.h, 0, 0, .2, 'rgba(230,230,240,.55)', .4, .18, 0); }
        }
        sweep(run.rockets, null, k => k.dead);

        stepEffects(dt);
        sweep(run.ents, null, e => e.kind === 'boss' ? false : e.kind === 'gate' ? e.z <= run.z - 4 : e.hp <= 0 && !(e.acc > 0));
        sweep(run.decals, null, dc => dc.z < run.z - 12);
    }

    function densest() {
        let best = null, bestN = 0;
        for (const e of run.ents) {
            if (!visibleTarget(e) || e.z - run.z > 24 || e.z < run.z) continue;
            let n = 0;
            for (const o of run.ents) if (visibleTarget(o) && Math.abs(o.x - e.x) < .45 && Math.abs(o.z - e.z) < 2.2) n += o.kind === 'boss' ? 6 : 1;
            if (n > bestN) { bestN = n; best = e; }
        }
        return best;
    }

    function stepEffects(dt) {
        for (const p of run.fx) { p.t += dt; p.x += p.vx * dt; p.z += p.vz * dt; p.h = Math.max(0, p.h + p.vh * dt); p.vh -= p.g * dt; p.rot += dt * 9; }
        sweep(run.fx, fxPool, p => p.t >= p.life);
        for (const t of run.texts) t.t += dt;
        sweep(run.texts, textPool, t => t.t >= t.life);
        run.shake = Math.max(0, run.shake - dt);
    }

    // ---------- Drawing ----------
    const TAU = Math.PI * 2;
    function shade(hex, f) {
        const n = parseInt(hex.slice(1), 16);
        const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))));
        return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
    const shadeCache = new Map();
    const tint = (hex, f) => { const k = hex + f; let v = shadeCache.get(k); if (!v) { v = shade(hex, f); shadeCache.set(k, v); } return v; };
    function outlined(text, x, y, size, fill, stroke = pal.ink) {
        ctx.font = `900 ${Math.round(size)}px Outfit, system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size * .18); ctx.strokeStyle = stroke;
        ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y);
    }
    function rr(x, y, w, h, r) {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
        else ctx.rect(x, y, w, h);
    }
    function ellipse(x, y, rx, ry, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, TAU); ctx.fill(); }
    function circle(x, y, r, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, Math.max(.1, r), 0, TAU); ctx.fill(); }
    const quad = (x0, x1, d0, d1, fill) => {
        ctx.fillStyle = fill; ctx.beginPath();
        ctx.moveTo(sx(x0, d0), sy(d0)); ctx.lineTo(sx(x1, d0), sy(d0)); ctx.lineTo(sx(x1, d1), sy(d1)); ctx.lineTo(sx(x0, d1), sy(d1)); ctx.closePath(); ctx.fill();
    };

    function drawWorld(camZ) {
        const { w, h } = view;
        if (!seaCache) {
            seaCache = ctx.createLinearGradient(0, 0, 0, h);
            seaCache.addColorStop(0, pal.sea[0]); seaCache.addColorStop(1, pal.sea[1]);
        }
        ctx.fillStyle = seaCache; ctx.fillRect(-20, -20, w + 40, h + 40);
        ctx.strokeStyle = pal.wave; ctx.lineWidth = 2;
        for (let i = 0; i < 22; i++) {
            const d = ((i * 7.3 - camZ) % 154 + 154) % 154 - 8;
            const y = sy(d), s = scaleAt(d);
            const off = ((i * 97) % 13) / 13;
            ctx.beginPath(); ctx.moveTo(w * off * .4, y); ctx.lineTo(w * off * .4 + 50 * s, y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(w - w * off * .4, y + 8 * s); ctx.lineTo(w - w * off * .4 - 50 * s, y + 8 * s); ctx.stroke();
        }
        const near = -10, far = 150;
        // Bridge shadow, curb and deck
        quad(-1.3, 1.3, near, far, pal.shadow);
        quad(-1.16, 1.16, near, far, pal.curb);
        quad(-1.06, 1.06, near, far, pal.deck);
        // Alternating deck slabs give a sense of speed.
        for (let k = Math.floor((camZ + near) / 8); k * 8 < camZ + far; k++) {
            if (k % 2) continue;
            const d0 = Math.max(near, k * 8 - camZ), d1 = k * 8 + 4 - camZ;
            if (d1 > d0) quad(-1.06, 1.06, d0, d1, pal.deck2);
        }
        // Lane paint
        for (let k = Math.floor((camZ + near) / 4); k * 4 < camZ + far; k++) {
            const d0 = k * 4 - camZ, d1 = d0 + 2;
            quad(-.012, .012, d0, d1, pal.lane);
        }
        quad(-.93, -.9, near, far, pal.edge);
        quad(.9, .93, near, far, pal.edge);
        if (pal.glow) {
            ctx.globalAlpha = .25;
            quad(-.96, -.87, near, far, pal.edge);
            quad(.87, .96, near, far, pal.edge);
            ctx.globalAlpha = 1;
        }
        // Rails and pillars
        for (const side of [-1, 1]) {
            ctx.strokeStyle = pal.rail; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(sx(side * 1.12, near), sy(near) - 14 * scaleAt(near)); ctx.lineTo(sx(side * 1.12, far), sy(far) - 14 * scaleAt(far)); ctx.stroke();
            for (let k = Math.ceil((camZ + near) / 18); k * 18 < camZ + far; k++) {
                const d = k * 18 - camZ, s = scaleAt(d);
                const x = sx(side * 1.16, d), y = sy(d);
                const pw = 34 * s * view.half / 180, ph = 30 * s * view.half / 180;
                ctx.fillStyle = pal.pillar; ctx.fillRect(x - pw / 2, y - ph, pw, ph);
                ctx.fillStyle = pal.pillarTop; ctx.fillRect(x - pw / 2, y - ph - 6 * s, pw, 8 * s);
                if (pal.glow) { ctx.fillStyle = 'rgba(0,242,254,.8)'; ctx.fillRect(x - pw / 2, y - ph - 7 * s, pw, 2 * s + 1); }
            }
        }
    }

    function drawDecals(camZ) {
        for (const dc of run.decals) {
            const d = dc.z - camZ;
            if (d < -6 || d > 60) continue;
            const u = unitPx(d);
            ctx.globalAlpha = .35;
            ellipse(sx(dc.x, d), sy(d), dc.r * u, dc.r * u * .32, dc.color);
            ellipse(sx(dc.x + dc.r * .6 * Math.cos(dc.rot), d), sy(d) + 2, dc.r * u * .35, dc.r * u * .12, dc.color);
        }
        ctx.globalAlpha = 1;
    }

    // Soldier seen from behind: legs, torso, backpack, rifle, helmet.
    function drawSoldier(px, gy, s, body, helmet, phase, muzzle, lead) {
        ellipse(px, gy, s * .42, s * .13, 'rgba(0,0,0,.24)');
        if (s < 5) { circle(px, gy - s * .6, s * .4, body); circle(px, gy - s * 1.05, s * .28, helmet); return; }
        const st = Math.sin(phase) * s * .07;
        ctx.fillStyle = '#2b3a4f';
        ctx.fillRect(px - s * .2, gy - s * .44 + st, s * .16, s * .44 - st);
        ctx.fillRect(px + s * .04, gy - s * .44 - st, s * .16, s * .44 + st);
        rr(px - s * .31, gy - s * .98, s * .62, s * .6, s * .14); ctx.fillStyle = body; ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(px - s * .31, gy - s * .5, s * .62, s * .08);
        rr(px - s * .2, gy - s * .92, s * .4, s * .36, s * .08); ctx.fillStyle = tint(body, -.28); ctx.fill();
        // rifle pointing forward (up the screen)
        ctx.fillStyle = '#20262e';
        ctx.fillRect(px + s * .2, gy - s * 1.2, s * .1, s * .62);
        if (muzzle) {
            const mx = px + s * .25, my = gy - s * 1.26;
            circle(mx, my, s * .16, 'rgba(255,220,120,.55)');
            circle(mx, my, s * .08, '#fff6c8');
        }
        circle(px, gy - s * 1.08, s * .2, '#f2c79a');
        ctx.fillStyle = helmet;
        ctx.beginPath(); ctx.arc(px, gy - s * 1.1, s * .25, Math.PI, 0); ctx.closePath(); ctx.fill();
        ctx.fillRect(px - s * .28, gy - s * 1.12, s * .56, s * .06);
        if (lead) {
            ctx.fillStyle = '#fff'; ctx.fillRect(px - s * .02, gy - s * 1.75, s * .04, s * .45);
            ctx.fillStyle = helmet; ctx.beginPath(); ctx.moveTo(px + s * .02, gy - s * 1.75); ctx.lineTo(px + s * .34, gy - s * 1.64); ctx.lineTo(px + s * .02, gy - s * 1.53); ctx.closePath(); ctx.fill();
        }
    }

    // Zombie seen from the front: torn shirt, reaching arms, glowing eyes.
    function drawZombieFigure(px, gy, s, skin, shirt, phase, flash) {
        ellipse(px, gy, s * .45, s * .14, 'rgba(0,0,0,.24)');
        const sk = flash ? '#ffffff' : skin, sh = flash ? '#ffe9e9' : shirt;
        if (s < 5) { circle(px, gy - s * .6, s * .4, sh); circle(px, gy - s * 1.05, s * .28, sk); return; }
        const st = Math.sin(phase) * s * .08, sway = Math.sin(phase * .5) * s * .05;
        ctx.fillStyle = '#3a3346';
        ctx.fillRect(px - s * .22, gy - s * .44 + st, s * .17, s * .44 - st);
        ctx.fillRect(px + s * .05, gy - s * .44 - st, s * .17, s * .44 + st);
        // torso with ragged hem
        ctx.fillStyle = sh;
        ctx.beginPath();
        ctx.moveTo(px - s * .32, gy - s * .98); ctx.lineTo(px + s * .32, gy - s * .98);
        ctx.lineTo(px + s * .3, gy - s * .42); ctx.lineTo(px + s * .16, gy - s * .5); ctx.lineTo(px + s * .04, gy - s * .4);
        ctx.lineTo(px - s * .1, gy - s * .5); ctx.lineTo(px - s * .22, gy - s * .41); ctx.lineTo(px - s * .3, gy - s * .48);
        ctx.closePath(); ctx.fill();
        // arms reaching toward the camera
        ctx.fillStyle = sk;
        rr(px - s * .44 + sway, gy - s * .92, s * .14, s * .5, s * .06); ctx.fill();
        rr(px + s * .3 - sway, gy - s * .92, s * .14, s * .5, s * .06); ctx.fill();
        circle(px, gy - s * 1.12, s * .25, sk);
        ctx.fillStyle = flash ? '#ff9a9a' : '#ff3b30';
        ctx.fillRect(px - s * .13, gy - s * 1.17, s * .08, s * .07);
        ctx.fillRect(px + s * .05, gy - s * 1.17, s * .08, s * .07);
        ctx.fillStyle = 'rgba(40,10,10,.75)'; ctx.fillRect(px - s * .08, gy - s * 1.03, s * .16, s * .05);
    }

    function drawGate(g, d) {
        const s = scaleAt(d), u = unitPx(d);
        const positive = g.op !== '−';
        const mult = g.op === '×';
        const base = mult ? '#a24bff' : positive ? '#2f8cff' : '#e53935';
        const light = mult ? '#d6b0ff' : positive ? '#9fd0ff' : '#ff9e9e';
        const label = `${g.op}${Math.max(0, Math.round(g.v))}`;
        if (g.stream) {
            // Flat floor pad with chevrons.
            const d0 = d - .55, d1 = d + .55;
            if (d0 < -9) return;
            ctx.globalAlpha = g.used ? (g.lit ? .5 + g.lit : .18) : .85;
            quad(g.x - g.hw, g.x + g.hw, d0, d1, g.lit ? light : base);
            ctx.globalAlpha *= .6;
            quad(g.x - g.hw * .55, g.x + g.hw * .55, d - .2, d + .05, light);
            ctx.globalAlpha = g.used ? .3 : 1;
            if (s > .2) {
                const cy = sy(d);
                ctx.save(); ctx.translate(sx(g.x, d), cy); ctx.scale(1, .55);
                outlined(label, 0, 0, Math.max(12, u * .26), '#fff', tint(base, -.5));
                ctx.restore();
            }
            ctx.globalAlpha = 1;
            return;
        }
        const x0 = sx(g.x - g.hw, d), x1 = sx(g.x + g.hw, d), y = sy(d);
        const H = u * .62, pw = Math.max(2, u * .05);
        ctx.globalAlpha = g.used ? .22 : 1;
        // panel
        const grad = ctx.createLinearGradient(0, y - H, 0, y);
        grad.addColorStop(0, g.flash ? '#ffffff' : light); grad.addColorStop(1, base);
        ctx.globalAlpha *= .78;
        ctx.fillStyle = grad; ctx.fillRect(x0, y - H, x1 - x0, H);
        ctx.globalAlpha = g.used ? .22 : 1;
        // shine stripes
        ctx.fillStyle = 'rgba(255,255,255,.18)';
        ctx.beginPath(); ctx.moveTo(x0 + (x1 - x0) * .1, y); ctx.lineTo(x0 + (x1 - x0) * .3, y - H); ctx.lineTo(x0 + (x1 - x0) * .4, y - H); ctx.lineTo(x0 + (x1 - x0) * .2, y); ctx.fill();
        // posts and beam
        ctx.fillStyle = tint(base, -.35);
        ctx.fillRect(x0 - pw, y - H, pw, H); ctx.fillRect(x1, y - H, pw, H);
        rr(x0 - pw * 1.5, y - H - pw * 1.8, x1 - x0 + pw * 3, pw * 2, pw * .6); ctx.fill();
        if (pal.glow) { ctx.strokeStyle = light; ctx.lineWidth = Math.max(1, 2 * s); ctx.strokeRect(x0, y - H, x1 - x0, H); }
        if (s > .14) {
            const pop = g.flash ? 1.08 : 1;
            outlined(label, (x0 + x1) / 2, y - H * .5, Math.max(12, H * .5 * pop), '#fff', tint(base, -.55));
            if (g.shootable && !g.used && s > .25) {
                // tiny target marker = "you can shoot me"
                const tx = x1 - (x1 - x0) * .12, ty = y - H * .82, tr = Math.max(3, H * .07);
                ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = Math.max(1, tr * .35);
                ctx.beginPath(); ctx.arc(tx, ty, tr, 0, TAU); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(tx - tr * 1.6, ty); ctx.lineTo(tx + tr * 1.6, ty); ctx.moveTo(tx, ty - tr * 1.6); ctx.lineTo(tx, ty + tr * 1.6); ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;
    }

    function drawCrate(c, d) {
        const dFar = d + c.len;
        const xl = c.x - c.hw, xr = c.x + c.hw;
        const hN = unitPx(d) * .5, hF = unitPx(dFar) * .5;
        const shakeX = c.flash ? (Math.random() - .5) * 3 : 0;
        ctx.save(); ctx.translate(shakeX, 0);
        ellipse(sx(c.x, d + c.len / 2), sy(d + c.len / 2) + 2, unitPx(d + c.len / 2) * c.hw * 1.1, unitPx(d) * .08, 'rgba(0,0,0,.2)');
        // visible side face (toward the road centre)
        const sideX = c.x > cam.x ? xl : xr;
        ctx.fillStyle = '#9a6420';
        ctx.beginPath();
        ctx.moveTo(sx(sideX, d), sy(d)); ctx.lineTo(sx(sideX, d), sy(d) - hN); ctx.lineTo(sx(sideX, dFar), sy(dFar) - hF); ctx.lineTo(sx(sideX, dFar), sy(dFar)); ctx.closePath(); ctx.fill();
        // top
        ctx.fillStyle = c.flash ? '#ffe3a8' : '#e0ab55';
        ctx.beginPath();
        ctx.moveTo(sx(xl, d), sy(d) - hN); ctx.lineTo(sx(xr, d), sy(d) - hN); ctx.lineTo(sx(xr, dFar), sy(dFar) - hF); ctx.lineTo(sx(xl, dFar), sy(dFar) - hF); ctx.closePath(); ctx.fill();
        // front
        const fx0 = sx(xl, d), fx1 = sx(xr, d), fy = sy(d), fw = fx1 - fx0;
        ctx.fillStyle = c.flash ? '#e8b46a' : '#bf7f2c'; ctx.fillRect(fx0, fy - hN, fw, hN);
        ctx.strokeStyle = 'rgba(80,45,10,.4)'; ctx.lineWidth = Math.max(1, 2 * scaleAt(d));
        for (let i = 1; i < 6; i++) { const y = fy - hN + hN * i / 6; ctx.beginPath(); ctx.moveTo(fx0, y); ctx.lineTo(fx1, y); ctx.stroke(); }
        // metal frame
        const m = Math.max(2, fw * .06);
        ctx.fillStyle = '#5b6470';
        ctx.fillRect(fx0, fy - hN, m, hN); ctx.fillRect(fx1 - m, fy - hN, m, hN);
        ctx.fillRect(fx0, fy - hN, fw, m * .8); ctx.fillRect(fx0, fy - m * .8, fw, m * .8);
        ctx.fillStyle = '#c9d1da';
        for (const [x, y] of [[fx0 + m / 2, fy - hN + m / 2], [fx1 - m / 2, fy - hN + m / 2], [fx0 + m / 2, fy - m / 2], [fx1 - m / 2, fy - m / 2]]) circle(x, y, m * .3, '#c9d1da');
        // hp bar + number
        const frac = Math.max(0, c.hp / c.max);
        const bw = fw * .7, bh = Math.max(4, hN * .1), bx = fx0 + (fw - bw) / 2, by = fy - hN * .2;
        ctx.fillStyle = 'rgba(16,30,40,.7)'; ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
        ctx.fillStyle = '#ffd34d'; ctx.fillRect(bx, by, bw * frac, bh);
        outlined(fmt(Math.ceil(c.hp)), (fx0 + fx1) / 2, fy - hN * .55, Math.max(12, hN * .5), '#fff');
        ctx.restore();
        // loot floating above
        const bob = calm() ? 0 : Math.sin(performance.now() / 300 + c.z) * .06;
        c.loot.forEach((loot, i) => {
            const ld = d + c.len * (.3 + i * .4);
            const u = unitPx(ld);
            const lx = sx(c.x, ld), ly = sy(ld) - u * (.72 + bob);
            ctx.globalAlpha = .35; circle(lx, ly, u * .3, '#fff6b0'); ctx.globalAlpha = 1;
            drawLootIcon(loot, lx, ly, u * .48);
            if (u > 40) {
                const tag = LOOT_TAG[loot];
                ctx.font = `900 ${Math.round(Math.max(10, u * .1))}px Outfit, system-ui, sans-serif`;
                const tw = ctx.measureText(tag).width + 10;
                rr(lx - tw / 2, ly + u * .2, tw, Math.max(14, u * .14), 6); ctx.fillStyle = 'rgba(16,40,60,.85)'; ctx.fill();
                ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(tag, lx, ly + u * .2 + Math.max(14, u * .14) / 2);
            }
        });
    }
    const LOOT_TAG = { weapon: 'SİLAH', heli: 'HELİKOPTER', troops: 'ASKER', rate: 'ATEŞ HIZI' };

    function drawLootIcon(loot, x, y, u) {
        ctx.save(); ctx.translate(x, y);
        if (loot === 'heli') {
            ellipse(0, 0, u * .5, u * .26, '#4aa8ff');
            ctx.fillStyle = '#4aa8ff'; ctx.fillRect(u * .3, -u * .06, u * .55, u * .1);
            ctx.fillRect(u * .78, -u * .2, u * .07, u * .26);
            ellipse(-u * .2, -u * .05, u * .18, u * .13, '#d8f1ff');
            ctx.fillStyle = '#1d3d5a'; ctx.fillRect(-u * .3, u * .24, u * .6, u * .05);
            ctx.globalAlpha *= .55;
            ellipse(0, -u * .34, u * .72, u * .06, '#1d3d5a');
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#1d3d5a'; ctx.fillRect(-u * .03, -u * .34, u * .06, u * .1);
        } else if (loot === 'weapon') {
            ctx.rotate(-.25);
            ctx.fillStyle = '#2d4f7c'; rr(-u * .6, -u * .12, u * 1.15, u * .24, u * .05); ctx.fill();
            ctx.fillStyle = '#7fb2ec'; ctx.fillRect(u * .05, -u * .18, u * .5, u * .06);
            ctx.fillStyle = '#1c3352'; ctx.fillRect(-u * .38, u * .08, u * .17, u * .34); ctx.fillRect(u * .05, u * .08, u * .1, u * .22);
            ctx.fillStyle = '#ffd34d'; ctx.fillRect(u * .55, -u * .07, u * .12, u * .14);
        } else if (loot === 'troops') {
            circle(0, -u * .22, u * .2, '#f2c79a');
            ctx.fillStyle = '#2f8cff'; ctx.beginPath(); ctx.arc(0, -u * .25, u * .22, Math.PI, 0); ctx.fill();
            rr(-u * .28, -u * .02, u * .56, u * .4, u * .12); ctx.fill();
            circle(u * .38, -u * .3, u * .17, '#3ccf62');
            ctx.fillStyle = '#fff'; ctx.fillRect(u * .38 - u * .1, -u * .32, u * .2, u * .045); ctx.fillRect(u * .38 - u * .022, -u * .4, u * .045, u * .2);
        } else {
            ctx.fillStyle = '#ffb33b';
            ctx.beginPath(); ctx.moveTo(u * .1, -u * .5); ctx.lineTo(-u * .3, u * .06); ctx.lineTo(-u * .02, u * .06); ctx.lineTo(-u * .12, u * .5); ctx.lineTo(u * .32, -u * .1); ctx.lineTo(u * .04, -u * .1); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#9a4d00'; ctx.lineWidth = Math.max(1, u * .05); ctx.stroke();
        }
        ctx.restore();
    }

    function hpBar(x, y, wpx, frac) {
        ctx.fillStyle = 'rgba(16,50,74,.8)'; ctx.fillRect(x - wpx / 2 - 2, y - 2, wpx + 4, 10);
        ctx.fillStyle = '#ff5a3c'; ctx.fillRect(x - wpx / 2, y, wpx * Math.max(0, frac), 6);
    }

    function drawBoss(e, d, time) {
        const u = unitPx(d) * (e.big ? 1.25 : 1);
        const px = sx(e.x, d), py = sy(d);
        const fl = e.flash > 0;
        const skin = fl ? '#ffe2e0' : e.big ? '#8e3b9e' : '#b5524a';
        const dark = fl ? '#ffd0cc' : e.big ? '#5c2068' : '#7a2b2b';
        ellipse(px, py, u * .5, u * .13, 'rgba(0,0,0,.3)');
        if (e.big && !calm()) { ctx.globalAlpha = .18 + Math.sin(time * 4) * .06; circle(px, py - u * .8, u * .85, '#c04bff'); ctx.globalAlpha = 1; }
        const step = Math.sin(e.wob * 1.4) * u * .04;
        ctx.fillStyle = dark;
        rr(px - u * .26, py - u * .5 + step, u * .2, u * .5 - step, u * .06); ctx.fill();
        rr(px + u * .06, py - u * .5 - step, u * .2, u * .5 + step, u * .06); ctx.fill();
        // torso
        ellipse(px, py - u * .82, u * .42, u * .44, skin);
        ellipse(px, py - u * .62, u * .34, u * .2, dark);
        // shoulder spikes
        ctx.fillStyle = '#e8e2d6';
        for (const sgn of [-1, 1]) {
            ctx.beginPath(); ctx.moveTo(px + sgn * u * .3, py - u * 1.1); ctx.lineTo(px + sgn * u * .42, py - u * 1.32); ctx.lineTo(px + sgn * u * .46, py - u * 1.06); ctx.closePath(); ctx.fill();
        }
        // swinging arms with fists
        const swing = Math.sin(e.wob) * u * .08 - (e.slam ? u * .15 : 0);
        for (const sgn of [-1, 1]) {
            const ax = px + sgn * u * .48, ay = py - u * 1.0;
            ctx.strokeStyle = skin; ctx.lineWidth = u * .16; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + sgn * u * .1, py - u * .35 + sgn * swing); ctx.stroke();
            circle(ax + sgn * u * .1, py - u * .3 + sgn * swing, u * .13, dark);
        }
        // head with glowing eyes
        circle(px, py - u * 1.25, u * .2, skin);
        ctx.globalAlpha = .45; circle(px - u * .07, py - u * 1.28, u * .07, '#ffef5a'); circle(px + u * .07, py - u * 1.28, u * .07, '#ffef5a'); ctx.globalAlpha = 1;
        circle(px - u * .07, py - u * 1.28, u * .035, '#fff7b0'); circle(px + u * .07, py - u * 1.28, u * .035, '#fff7b0');
        ctx.fillStyle = '#2a0808'; ctx.fillRect(px - u * .08, py - u * 1.16, u * .16, u * .04);
        if (e.big) {
            ctx.fillStyle = '#ffcf3d';
            ctx.beginPath(); ctx.moveTo(px - u * .17, py - u * 1.38);
            for (let i = 0; i <= 4; i++) { ctx.lineTo(px - u * .17 + i * u * .085, py - u * (i % 2 ? 1.42 : 1.58)); }
            ctx.lineTo(px + u * .17, py - u * 1.38); ctx.closePath(); ctx.fill();
        }
        if (!run.arena && unitPx(d) > 12) outlined(e.big ? 'DEV BOSS' : 'BOSS', px, py - u * 1.75, Math.max(12, u * .2), '#ff8a8a');
    }

    function drawEnemy(e, d, time) {
        if (e.kind === 'boss') { drawBoss(e, d, time); return; }
        const big = e.kind === 'brute';
        const s = unitPx(d) * (big ? .5 : .17);
        const px = sx(e.x, d), gy = sy(d) - Math.abs(Math.sin(e.wob)) * s * .06;
        const v = Math.floor(e.wob * 7) & 7;
        drawZombieFigure(px, gy, s, big ? '#5f8f4a' : ZSKIN[v % ZSKIN.length], big ? '#4a3a5c' : ZSHIRT[v % ZSHIRT.length], e.wob, e.flash > 0);
        if (big) hpBar(px, gy - s * 1.55, s * 1.1, e.hp / e.max);
    }

    const formation = (() => {
        const pts = [];
        for (let ring = 0; pts.length < 80; ring++) {
            if (ring === 0) { pts.push([0, 0]); continue; }
            const n = ring * 6;
            for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pts.push([Math.cos(a) * ring, Math.sin(a) * ring]); }
        }
        return pts;
    })();
    const squadPts = Array.from({ length: 80 }, () => ({ x: 0, z: 0, i: 0 }));
    const squadOrder = [];

    function drawSquad(camZ, time, idle) {
        const n = idle ? startSoldiers() : run.soldiers;
        const x = idle ? 0 : run.x, z = idle ? camZ : run.z;
        const shown = Math.min(n, 80);
        const r = idle ? .1 : squadRadius();
        const spacing = shown > 1 ? r / Math.max(1, Math.ceil(Math.sqrt(shown / 3))) : 0;
        squadOrder.length = 0;
        for (let i = 0; i < shown; i++) {
            const [fx0, fz0] = formation[i];
            const p = squadPts[i];
            p.x = x + fx0 * spacing; p.z = z + fz0 * spacing * 6; p.i = i;
            squadOrder.push(p);
        }
        squadOrder.sort((a, b) => b.z - a.z);
        const hero = BRANCHES[HEROES[save$.tm[0] ?? 0].branch];
        const firing = !idle && run.bullets.length > 0 && !run.over;
        const hurt = !idle && run.hurtT > 0;
        for (const p of squadOrder) {
            const d = p.z - camZ;
            const lead = p.i === 0;
            const phase = idle ? 0 : time * 14 + p.i * 1.7;
            const muzzle = firing && ((Math.floor(time * 18) + p.i * 3) % 5 === 0);
            const body = hurt && p.i % 2 ? '#ff8a8a' : lead ? hero.color : '#2f8cff';
            drawSoldier(sx(p.x, d), sy(d) - (idle ? 0 : Math.abs(Math.sin(phase * .5)) * unitPx(d) * .01), unitPx(d) * (lead ? .19 : .155), body, lead ? tint(hero.color, -.3) : '#1d5fb8', phase, muzzle, lead);
        }
        if (!idle && run.shield > 0) {
            const u = unitPx(0);
            ctx.globalAlpha = .18; ellipse(sx(x, 0), sy(0) - u * .12, u * (r + .14), u * (r + .14) * .45, '#8cc8ff'); ctx.globalAlpha = 1;
            ctx.strokeStyle = 'rgba(160,215,255,.85)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.ellipse(sx(x, 0), sy(0) - u * .12, u * (r + .14), u * (r + .14) * .45, 0, 0, TAU); ctx.stroke();
        }
        // Count bubble
        const bx = sx(x, z - camZ - 1.2), by = sy(z - camZ - 1.2) + 26;
        const label = fmt(n);
        ctx.font = '900 20px Outfit, system-ui, sans-serif';
        const tw = ctx.measureText(label).width + 34;
        rr(bx - tw / 2, by - 16, tw, 32, 12);
        ctx.fillStyle = hurt ? '#e53935' : '#2f8cff'; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
        circle(bx - tw / 2 + 14, by - 3, 4.5, '#fff');
        ctx.fillStyle = '#fff'; ctx.fillRect(bx - tw / 2 + 8.5, by + 2, 11, 6);
        outlined(label, bx + 8, by + 1, 20, '#fff', '#0d3a7a');
        // Helicopter escort
        if (!idle && run.heli > 0) {
            const d = 1.5 + (calm() ? 0 : Math.sin(time * 2) * .3);
            const u = unitPx(d);
            const hx = sx(x + .55, d), hy = sy(d) - u * .9;
            ellipse(sx(x + .55, d), sy(d), u * .2, u * .06, 'rgba(0,0,0,.18)');
            drawLootIcon('heli', hx, hy, u * .4);
            if (run.heli > 1) outlined(`x${run.heli}`, hx + u * .35, hy - u * .3, 14, '#8fe9ff');
        }
    }

    function drawFx(camZ) {
        for (const p of run.fx) {
            const d = p.z - camZ;
            if (d < -9) continue;
            const u = unitPx(d), k = p.t / p.life;
            const x = sx(p.x, d), y = sy(d) - u * p.h;
            ctx.globalAlpha = Math.max(0, 1 - k);
            switch (p.type) {
                case 'chunk': {
                    const r = Math.max(1.5, u * .035 * p.size);
                    ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot); ctx.fillStyle = p.color; ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore();
                    break;
                }
                case 'coin':
                    circle(x, y, Math.max(2, u * .04), '#e0a200');
                    circle(x - u * .008, y - u * .008, Math.max(1.2, u * .028), p.color);
                    break;
                case 'flash':
                    ctx.globalAlpha = .9;
                    circle(x, y, Math.max(2, u * .05), p.color);
                    circle(x, y, Math.max(1, u * .025), '#fffbe0');
                    break;
                case 'ring': {
                    ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1.5, u * .03 * (1 - k));
                    const rad = u * p.size * (.2 + k * .8);
                    ctx.beginPath(); ctx.ellipse(sx(p.x, d), sy(d) - u * .05, rad, rad * .38, 0, 0, TAU); ctx.stroke();
                    break;
                }
                case 'smoke':
                    ctx.globalAlpha = Math.max(0, .6 * (1 - k));
                    circle(x, y, Math.max(2, u * p.size * (.4 + k)), p.color);
                    break;
                default:
                    circle(x, y, Math.max(1.5, u * (p.type === 'spark' ? .045 : .03)), p.color);
            }
        }
        ctx.globalAlpha = 1;
    }

    const drawList = [];
    function drawScene(time) {
        ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
        ctx.imageSmoothingEnabled = !pal.pixel;
        const camZ = run ? run.z : (calm() ? 0 : (time * 2) % 1000);
        let shakeX = 0, shakeY = 0;
        if (run && run.shake > 0 && !run.paused) { shakeX = (Math.random() - .5) * 14 * run.shake; shakeY = (Math.random() - .5) * 14 * run.shake; }
        ctx.save(); ctx.translate(shakeX, shakeY);
        if (!run) cam.x = 0;
        drawWorld(camZ);
        if (!run) {
            // Idle backdrop: a horde far ahead and the squad waiting.
            for (let i = 0; i < 40; i++) {
                const x = ((i * 37) % 17) / 17 * 1.6 - .8, d = 26 + ((i * 53) % 23) / 23 * 10;
                drawZombieFigure(sx(x, d), sy(d), unitPx(d) * .17, ZSKIN[i % 4], ZSHIRT[i % 5], calm() ? 0 : time * 6 + i, false);
            }
            drawSquad(camZ, time, true);
            ctx.restore();
            return;
        }
        drawDecals(camZ);
        drawList.length = 0;
        for (const e of run.ents) {
            const d = e.z - camZ;
            if (d < (e.kind === 'crate' ? -1 : -6) || d > 70) continue;
            if (e.kind !== 'gate' && e.hp <= 0) continue;
            e._d = d;
            drawList.push(e);
        }
        drawList.sort((a, b) => b._d - a._d);
        let squadDrawn = false;
        for (const e of drawList) {
            if (!squadDrawn && e._d < 0) { drawSquad(camZ, time, false); squadDrawn = true; }
            if (e.kind === 'gate') drawGate(e, e._d);
            else if (e.kind === 'crate') drawCrate(e, e._d);
            else drawEnemy(e, e._d, time);
        }
        if (!squadDrawn) drawSquad(camZ, time, false);
        // Tutorial pointer above the better gate
        if (run.tut && !run.over) drawCoachArrow(camZ, time);
        // Bullets
        ctx.lineCap = 'round';
        for (const b of run.bullets) {
            const d = b.z - camZ;
            const x = sx(b.x, d), y = sy(d) - unitPx(d) * .17;
            const y2 = sy(d - .9) - unitPx(d - .9) * .17;
            ctx.strokeStyle = b.color; ctx.lineWidth = Math.max(1.5, 4 * scaleAt(d));
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(sx(b.x - b.vx * .02, d - .9), y2); ctx.stroke();
        }
        for (const k of run.rockets) {
            const d = k.z - camZ, u = unitPx(d);
            circle(sx(k.x, d), sy(d) - u * k.h, Math.max(3, u * .05), k.color);
            circle(sx(k.x, d - .4), sy(d - .4) - u * k.h, Math.max(2, u * .035), 'rgba(255,220,150,.8)');
        }
        drawFx(camZ);
        for (const t of run.texts) {
            const d = t.z - camZ;
            const k = t.t / t.life;
            ctx.globalAlpha = Math.min(1, 2 - k * 2);
            const rise = calm() ? 10 : (t.kind === 'dmg' ? 30 : 44) * k;
            const pop = t.kind === 'pop' && !calm() ? 1 + Math.max(0, .25 - t.t) * 1.6 : 1;
            outlined(t.text, sx(t.x, d), sy(d) - unitPx(d) * (t.kind === 'dmg' ? .9 : .6) - rise, 22 * t.size * pop, t.color);
        }
        ctx.globalAlpha = 1;
        ctx.restore();
        if (run.hurtT > 0 && !calm()) {
            const g = ctx.createRadialGradient(view.w / 2, view.h / 2, view.h * .3, view.w / 2, view.h / 2, view.h * .75);
            g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(255,30,30,${(run.hurtT / .35 * .35).toFixed(3)})`);
            ctx.fillStyle = g; ctx.fillRect(0, 0, view.w, view.h);
        }
    }

    function drawCoachArrow(camZ, time) {
        let target = null;
        for (const e of run.ents) {
            const d = e.z - camZ;
            if (d < 1 || d > 13) continue;
            if (e.kind === 'gate' && !e.stream && !e.used) {
                const other = run.ents.find(o => o !== e && o.kind === 'gate' && !o.stream && Math.abs(o.z - e.z) < .1);
                const val = g => g.op === '×' ? run.soldiers * (g.v - 1) : g.op === '−' ? -g.v : g.v;
                if (!other || val(e) >= val(other)) { target = e; break; }
            }
            if (e.kind === 'crate' && e.hp > 0) { target = e; break; }
        }
        if (!target) return;
        const d = target.z - camZ, u = unitPx(d);
        const x = sx(target.x, d), y = sy(d) - u * (target.kind === 'crate' ? 1.25 : .9) - (calm() ? 0 : Math.abs(Math.sin(time * 5)) * 10);
        const s = Math.max(10, u * .12);
        ctx.fillStyle = '#ffe14d'; ctx.strokeStyle = pal.ink; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x, y + s); ctx.lineTo(x - s, y - s * .2); ctx.lineTo(x - s * .4, y - s * .2); ctx.lineTo(x - s * .4, y - s); ctx.lineTo(x + s * .4, y - s); ctx.lineTo(x + s * .4, y - s * .2); ctx.lineTo(x + s, y - s * .2); ctx.closePath();
        ctx.stroke(); ctx.fill();
        outlined(target.kind === 'crate' ? 'VUR!' : 'GEÇ!', x, y - s * 1.7, Math.max(13, s * .9), '#ffe14d');
    }

    // ---------- Loop ----------
    let hudT = 0, frameEma = 16, slowFrames = 0;
    function loop(nowMs) {
        rafId = requestAnimationFrame(loop);
        const time = nowMs / 1000;
        if (mode !== 'run') {
            // Menus only need a slow backdrop.
            if (calm()) { if (!loop.drawn) { drawScene(time); loop.drawn = true; } return; }
            drawScene(time); return;
        }
        loop.drawn = false;
        const raw = nowMs - lastT;
        let dt = Math.min(.05, raw / 1000);
        lastT = nowMs;
        if (!run.paused) {
            // Fixed sub-steps keep collisions stable at low FPS.
            while (dt > 0 && mode === 'run') { const h = Math.min(1 / 90, dt); step(h); dt -= h; }
            adaptQuality(raw);
        }
        if (mode !== 'run') return;
        drawScene(time);
        hudT -= 1;
        if (hudT <= 0) { hudT = 6; updateHud(); }
    }
    // Phones that can't keep up drop to 1× pixel ratio once.
    function adaptQuality(ms) {
        if (ms <= 0 || ms > 200) return;
        frameEma += (ms - frameEma) * .05;
        if (frameEma > 26 && view.dprCap > 1 && !pal.pixel) {
            if (++slowFrames > 90) { view.dprCap = 1; slowFrames = 0; resize(); }
        } else slowFrames = 0;
    }
    function updateHud() {
        $('run-fill').style.width = `${Math.min(100, run.z / (run.L - 13) * 100)}%`;
        $('run-coins').textContent = fmt(run.coins * lootMult());
        $('run-kills').textContent = fmt(run.kills);
        if (run.arena) {
            const f = Math.max(0, run.boss.hp / run.boss.max);
            $('boss-fill').style.width = `${f * 100}%`;
            $('boss-hp').textContent = fmt(Math.ceil(Math.max(0, run.boss.hp)));
        }
    }

    function countUp(node, value, prefix = '+') {
        if (calm() || value <= 0) { node.textContent = `${prefix}${fmt(value)}`; return; }
        const t0 = performance.now();
        const tick = t => {
            const k = Math.min(1, (t - t0) / 700);
            node.textContent = `${prefix}${fmt(value * (1 - Math.pow(1 - k, 3)))}`;
            if (k < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    function endRun(opts = {}) {
        const won = run.won;
        run.shake = 0;
        const n = run.n;
        const gold = Math.round(run.coins * lootMult() + (won ? 20 + n * 6 : 0));
        const iron = Math.round(run.iron * lootMult());
        const food = Math.round(run.food * lootMult());
        const goals = [
            { text: 'Boss’u yen', ok: won },
            { text: 'Hiçbir sandığa çarpma', ok: run.rammed === 0 },
            { text: 'Birliğin en az yarısı ayakta kalsın', ok: won && run.soldiers * 2 >= run.peak }
        ];
        const stars = won ? goals.filter(g => g.ok).length : 0;
        const prevBest = starsOf(n);
        let cm = 0;
        let note = '';
        if (cheatsOn()) note = 'Hile açıkken ilerleme ve ödül kaydedilmez.';
        else {
            save$.r[0] += gold; save$.r[1] += iron; save$.r[2] += food;
            save$.k += run.kills;
            save$.tu = 1;
            if (won && n === save$.st && save$.st < MAX_STAGE) save$.st += 1;
            if (won) setStars(n, stars);
            persist();
            try {
                const res = Profile?.awardSonHatRun?.({ coins: gold, won });
                if (res?.reward) cm = res.reward;
                else if (!Profile?.current?.()) note = 'CasualMoney kazanmak için ana sayfada oturum başlat.';
            } catch (_) {}
            if (typeof recordGameResult === 'function') recordGameResult('Son Hat', { won, score: n });
        }
        if (opts.restart) { startRun(n); return; }
        if (!note) note = won
            ? (stars < 3 ? 'Üç yıldız için tüm hedefleri tamamla.' : isBossStage(n + 1) ? 'Sıradaki bölümde dev boss var. Üssünü ve kahramanlarını güçlendir!' : 'Ganimetle üssünü geliştir, madenlerini toplamayı unutma.')
            : 'Kırmızı kapıları vurup maviye çevir, sandıkları vurmadan geçme. Üs yükseltmeleri de güç katar.';
        mode = 'result';
        playStage = won ? Math.min(save$.st, n + 1) : n;
        const sheet = $('result').querySelector('.sheet');
        sheet.classList.toggle('lose', !won);
        $('result-eyebrow').textContent = `BÖLÜM ${n}${isBossStage(n) ? ' · DEV BOSS' : ''}`;
        $('result-title').textContent = won ? 'Zafer!' : 'Birlik düştü';
        const starEls = $('result-stars').children;
        for (let i = 0; i < 3; i++) { starEls[i].classList.toggle('on', i < stars); starEls[i].style.animationDelay = `${.2 + i * .22}s`; }
        $('result-stars').setAttribute('aria-label', `${stars} / 3 yıldız`);
        $('result-best').textContent = won && stars > prevBest && prevBest > 0 ? 'Yeni rekor!' : prevBest ? `En iyi: ${Math.max(prevBest, stars)} yıldız` : '';
        const ul = $('result-goals');
        ul.innerHTML = '';
        for (const g of goals) { const li = el('li', g.ok ? 'ok' : ''); li.textContent = g.text; li.setAttribute('aria-label', `${g.text}: ${g.ok ? 'tamamlandı' : 'tamamlanmadı'}`); ul.appendChild(li); }
        $('result-kills').textContent = fmt(run.kills);
        $('result-peak').textContent = fmt(run.peak);
        $('result-weapon').textContent = WEAPONS[run.weapon].name;
        countUp($('result-gold'), gold);
        countUp($('result-iron'), iron);
        countUp($('result-food'), food);
        $('result-cm').textContent = cm ? `+${fmt(cm)}` : '0';
        $('result-cm').parentElement.classList.toggle('earned', cm > 0);
        $('result-note').textContent = note;
        $('next-btn').querySelector('span').textContent = won ? (n < MAX_STAGE ? 'SONRAKİ' : 'TEKRAR') : 'TEKRAR';
        $('next-btn').querySelector('small').textContent = `Bölüm ${playStage}`;
        $('result').classList.remove('hidden');
        $('next-btn').focus();
        renderMenus();
    }

    function hideOverlays() { $('pause').classList.add('hidden'); $('result').classList.add('hidden'); }

    function toMenu(next = 'map') {
        if (run) recycleRun();
        mode = 'menu'; run = null;
        app.dataset.mode = 'menu';
        hideOverlays();
        showTab(next);
        renderMenus();
    }

    function pause() {
        if (mode !== 'run' || run.over || run.paused) return;
        run.paused = true;
        $('ps-progress').textContent = `%${Math.min(100, Math.round(run.z / (run.L - 13) * 100))}`;
        $('ps-soldiers').textContent = fmt(run.soldiers);
        $('ps-weapon').textContent = WEAPONS[run.weapon].name;
        $('ps-gold').textContent = fmt(run.coins * lootMult());
        $('pause-eyebrow').textContent = `BÖLÜM ${run.n} · DURAKLATILDI`;
        $('opt-shake').checked = !(save$.o & OPT_NO_SHAKE);
        $('pause').classList.remove('hidden'); $('resume-btn').focus();
    }
    function resume() {
        if (mode !== 'run') return;
        run.paused = false; lastT = performance.now(); $('pause').classList.add('hidden');
    }

    // ---------- Menus ----------
    let toastT = 0;
    function toast(text) { const t = $('toast'); t.textContent = text; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1900); }
    let tab = 'map';
    let selectedTile = HQ_TILE;

    function showTab(next) {
        tab = next;
        for (const id of ['map', 'base', 'heroes']) $(`screen-${id}`).classList.toggle('hidden', id !== tab);
        for (const b of document.querySelectorAll('#tabbar button')) {
            b.classList.toggle('active', b.dataset.tab === tab);
            if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
        }
        renderMenus();
    }

    function guardCheats(text) {
        if (!cheatsOn()) return false;
        toast(text || 'Hile açıkken üs ve kahraman ilerlemesi kaydedilmez.');
        return true;
    }

    function el(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
    const starHtml = (k, cls = 'mini-stars') => `<span class="${cls}" aria-hidden="true">${[0, 1, 2].map(i => `<i class="${i < k ? 'on' : ''}"></i>`).join('')}</span>`;

    function renderTop() {
        $('res-gold').textContent = fmt(save$.r[0]);
        $('res-iron').textContent = fmt(save$.r[1]);
        $('res-food').textContent = fmt(save$.r[2]);
        $('cm').textContent = Profile?.current?.() ? fmt(Profile.current().balance) : '0';
        const ready = save$.b.reduce((sum, b) => sum + pending(b), 0);
        $('base-dot').classList.toggle('hidden', ready < 10);
    }

    function renderMenus() {
        renderTop();
        if (mode === 'run') return;
        if (tab === 'map') renderMap();
        else if (tab === 'base') renderBase();
        else renderHeroes();
    }

    function renderMap() {
        const region = Math.min(REGIONS.length - 1, Math.floor((playStage - 1) / 10));
        $('region-name').textContent = `BÖLGE ${region + 1} · ${REGIONS[region].toUpperCase()}`;
        const power = powerScore(), rec = recommendedPower(playStage);
        $('map-power').innerHTML = `<span>Gücün <b>${fmt(power)}</b></span><span class="${power >= rec ? 'ok' : 'low'}">Önerilen <b>${fmt(rec)}</b></span>`;
        const totalStars = Array.from({ length: save$.st }, (_, i) => starsOf(i + 1)).reduce((a, b) => a + b, 0);
        $('map-stars').textContent = `${fmt(totalStars)} / ${fmt(Math.max(1, save$.st - (save$.st < MAX_STAGE ? 1 : 0)) * 3)}`;
        const top = Math.min(MAX_STAGE, save$.st + 6);
        const path = $('map-path');
        path.innerHTML = '';
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'map-line'); svg.setAttribute('aria-hidden', 'true');
        path.appendChild(svg);
        for (let i = top; i >= 1; i--) {
            const li = el('li', 'node-row');
            li.style.setProperty('--x', `${50 + Math.sin(i * 1.15) * 26}%`);
            const st = starsOf(i);
            const b = el('button', 'node' + (i < save$.st ? ' done' : i === save$.st ? ' current' : ' locked') + (isBossStage(i) ? ' boss' : '') + (i === playStage ? ' selected' : ''));
            b.type = 'button';
            b.dataset.stage = String(i);
            b.innerHTML = `<span class="node-num">${i}</span>${i < save$.st || st ? starHtml(st, 'node-stars') : ''}`;
            b.disabled = i > save$.st;
            b.setAttribute('aria-label', `Bölüm ${i}${isBossStage(i) ? ', dev boss' : ''}${i < save$.st ? `, geçildi, ${st} yıldız` : i > save$.st ? ', kilitli' : ', sıradaki'}`);
            b.setAttribute('aria-pressed', String(i === playStage));
            b.addEventListener('click', () => { playStage = i; renderMap(); $('play-btn').focus({ preventScroll: true }); });
            li.appendChild(b);
            path.appendChild(li);
            if (i % 10 === 1) {
                const r = Math.min(REGIONS.length - 1, Math.floor((i - 1) / 10));
                path.appendChild(el('li', 'region-banner', `<span>Bölge ${r + 1} · ${REGIONS[r]}</span>`));
            }
        }
        const best = starsOf(playStage);
        $('play-sub').innerHTML = `Bölüm ${playStage}${isBossStage(playStage) ? ' · Dev boss' : ''}${best ? ' · ' + starHtml(best) : ''}`;
        requestAnimationFrame(() => {
            drawMapLine(path, svg);
            const sel = path.querySelector('.selected');
            if (sel) path.scrollTop = sel.offsetTop - path.clientHeight / 2 + sel.offsetHeight / 2;
        });
    }
    function drawMapLine(path, svg) {
        const nodes = [...path.querySelectorAll('.node')];
        if (nodes.length < 2) return;
        const w = path.clientWidth, h = path.scrollHeight;
        svg.setAttribute('width', w); svg.setAttribute('height', h); svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        const pts = nodes.map(n => ({ x: n.offsetLeft + n.offsetWidth / 2, y: n.offsetTop + n.offsetHeight / 2, stage: Number(n.dataset.stage) })).reverse();
        const seg = (a, b) => `M${a.x},${a.y} C${a.x},${(a.y + b.y) / 2} ${b.x},${(a.y + b.y) / 2} ${b.x},${b.y}`;
        let done = '', todo = '';
        for (let i = 1; i < pts.length; i++) { if (pts[i].stage <= save$.st) done += seg(pts[i - 1], pts[i]); else todo += seg(pts[i - 1], pts[i]); }
        svg.innerHTML = `<path class="todo" d="${todo}"/><path class="done-shadow" d="${done}"/><path class="done" d="${done}"/>`;
    }

    function buildingAt(tile) { return save$.b.find(b => b[1] === tile); }

    function prodTimer(b) {
        const mins = storedMinutes(b), cap = storageMinutes();
        const left = Math.max(0, Math.ceil(cap - mins));
        return { frac: mins / cap, full: left <= 0, text: left <= 0 ? 'Depo dolu, topla!' : left >= 60 ? `Dolmasına ${Math.floor(left / 60)} sa ${left % 60} dk` : `Dolmasına ${left} dk` };
    }

    function renderBase() {
        const used = save$.b.length, limit = slotLimit();
        $('base-slots').textContent = `${used}/${limit} yer · Karargâh Sv ${hqLevel()}`;
        const ready = [0, 0, 0], rate = [0, 0, 0];
        for (const b of save$.b) { const def = BUILDINGS[b[0]]; if (def.prod != null) { ready[def.prod] += pending(b); rate[def.prod] += def.rate * b[2]; } }
        const total = ready[0] + ready[1] + ready[2];
        $('prod-rates').innerHTML = RES.map((res, i) => `<span class="rate ${res.id}"><i aria-hidden="true"></i><b>${fmt(ready[i])}</b><small>${fmt1(rate[i] * 60)}/sa</small><span class="sr">${res.name}: ${fmt(ready[i])} hazır, saatte ${fmt1(rate[i] * 60)}</span></span>`).join('');
        const collect = $('collect-btn');
        collect.disabled = total < 1;
        collect.innerHTML = total < 1 ? 'Üretim sürüyor' : 'Hepsini topla';
        const soonest = save$.b.filter(b => BUILDINGS[b[0]].prod != null).map(prodTimer).sort((a, b) => b.frac - a.frac)[0];
        $('prod-note').textContent = soonest ? (soonest.full ? 'Depolar dolu: topla ki üretim boşa gitmesin.' : `Depolar ${storageMinutes()} dakikalık üretim tutar · ${soonest.text.toLowerCase()}`) : 'Altın Madeni, Çiftlik ya da Demir Madeni kur.';
        const plot = $('plot');
        plot.innerHTML = '';
        for (let t = 0; t < GRID * GRID; t++) {
            const b = buildingAt(t);
            const tileBtn = el('button', 'tile' + (b ? ' built' : '') + (t === selectedTile ? ' selected' : '') + (b && b[0] === B.hq ? ' hq' : ''));
            tileBtn.type = 'button';
            if (b) {
                const def = BUILDINGS[b[0]];
                const p = pending(b);
                const timer = def.prod != null ? prodTimer(b) : null;
                tileBtn.innerHTML = `<span class="tile-ico" aria-hidden="true">${def.icon}</span><span class="tile-lv">${b[2]}</span>${timer ? `<span class="tile-fill" style="--f:${timer.frac.toFixed(3)}" aria-hidden="true"></span>` : ''}${p >= 1 ? `<span class="tile-ready ${RES[def.prod].id}" aria-hidden="true">${p > 999 ? '999+' : fmt(p)}</span>` : ''}`;
                tileBtn.setAttribute('aria-label', `${def.name}, seviye ${b[2]}${p >= 1 ? `, ${fmt(p)} ${RES[def.prod].name.toLowerCase()} hazır, toplamak için dokun` : ''}`);
            } else {
                const free = used < limit;
                tileBtn.classList.add(free ? 'free' : 'locked');
                tileBtn.innerHTML = free ? '<span class="tile-plus" aria-hidden="true">+</span>' : '<span class="tile-lock" aria-hidden="true"></span>';
                tileBtn.setAttribute('aria-label', free ? 'Boş arsa, bina kur' : 'Boş arsa, Karargâh’ı yükselterek yer aç');
            }
            tileBtn.addEventListener('click', () => {
                if (b && BUILDINGS[b[0]].prod != null && pending(b) >= 1) collectOne(b);
                selectedTile = t; renderBase();
                $('plot').children[t]?.focus();
            });
            plot.appendChild(tileBtn);
        }
        renderTilePanel();
        renderBuildingList();
    }

    function upgrade(b) {
        const def = BUILDINGS[b[0]];
        const cost = levelCost(def, b[2]);
        const cap = def.id === 'hq' ? MAX_LEVEL : hqLevel();
        if (guardCheats() || b[2] >= cap || !canAfford(cost)) return;
        // Bank finished production before the level changes the rate.
        if (def.prod != null) { const p = pending(b); save$.r[def.prod] += p; b[3] = now(); }
        pay(cost); b[2] += 1; persist();
        toast(`${def.name} seviye ${b[2]}!`);
        renderBase(); renderTop();
        const tileEl = $('plot').children[b[1]];
        if (tileEl) tileEl.classList.add('pop');
    }

    function renderBuildingList() {
        const list = $('b-list');
        list.innerHTML = '';
        const hq = hqLevel();
        const sorted = [...save$.b].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        for (const b of sorted) {
            const def = BUILDINGS[b[0]];
            const lvl = b[2];
            const cap = def.id === 'hq' ? MAX_LEVEL : hq;
            const maxed = lvl >= cap;
            const cost = levelCost(def, lvl);
            const timer = def.prod != null ? prodTimer(b) : null;
            const p = pending(b);
            const card = el('article', 'b-card' + (b[1] === selectedTile ? ' selected' : '') + (timer?.full ? ' full' : ''));
            const main = el('button', 'b-main');
            main.type = 'button';
            main.innerHTML = `<span class="card-ico" aria-hidden="true">${def.icon}</span><span class="b-text"><strong>${def.name} <em>Sv ${lvl}</em></strong><small>${def.desc(lvl)}</small>${timer ? `<span class="b-timer"><span class="bar"><i style="width:${(timer.frac * 100).toFixed(1)}%"></i></span><span>${p >= 1 ? `${fmt(p)} hazır · ` : ''}${timer.text}</span></span>` : ''}</span>`;
            main.setAttribute('aria-label', `${def.name}, seviye ${lvl}. ${def.desc(lvl)}${timer ? `. ${p >= 1 ? `${fmt(p)} hazır. ` : ''}${timer.text}` : ''}. Arsada göster`);
            main.addEventListener('click', () => { selectedTile = b[1]; renderBase(); $('tile-panel').scrollIntoView({ block: 'nearest', behavior: calm() ? 'auto' : 'smooth' }); });
            card.appendChild(main);
            const up = el('button', 'buy small', maxed ? (def.id === 'hq' ? 'En üst' : 'Karargâh sınırı') : `<span>Yükselt</span> ${costHtml(cost)}`);
            up.type = 'button';
            up.disabled = maxed || !canAfford(cost);
            up.setAttribute('aria-label', maxed ? `${def.name}: ${def.id === 'hq' ? 'en üst seviye' : 'önce Karargâh’ı yükselt'}` : `${def.name} yükselt: ${costText(cost)}`);
            up.addEventListener('click', () => upgrade(b));
            card.appendChild(up);
            list.appendChild(card);
        }
    }

    function collectOne(b) {
        if (guardCheats()) return;
        const def = BUILDINGS[b[0]];
        const p = pending(b);
        if (p < 1) return;
        save$.r[def.prod] += p;
        b[3] = now();
        persist();
        toast(`+${fmt(p)} ${RES[def.prod].name.toLowerCase()}`);
        flyPill(RES[def.prod].id);
        renderTop();
    }
    function flyPill(id) {
        const pill = document.querySelector(`.pill.${id}`);
        if (!pill || calm()) return;
        pill.classList.remove('gain'); void pill.offsetWidth; pill.classList.add('gain');
    }

    function renderTilePanel() {
        const panel = $('tile-panel');
        panel.innerHTML = '';
        const b = buildingAt(selectedTile);
        const hq = hqLevel();
        if (b) {
            const def = BUILDINGS[b[0]];
            const lvl = b[2];
            const cap = def.id === 'hq' ? MAX_LEVEL : hq;
            const maxed = lvl >= cap;
            const cost = levelCost(def, lvl);
            panel.appendChild(el('div', 'tp-head', `<span class="card-ico" aria-hidden="true">${def.icon}</span><div><h3>${def.name}</h3><span class="lvl">Seviye ${lvl}${def.id !== 'hq' ? ` / ${cap}` : ''}</span></div>`));
            panel.appendChild(el('p', '', def.desc(lvl)));
            if (def.prod != null) {
                const timer = prodTimer(b);
                panel.appendChild(el('div', 'b-timer wide', `<span class="bar"><i style="width:${(timer.frac * 100).toFixed(1)}%"></i></span><span>Depoda ${fmt(pending(b))} ${RES[def.prod].name.toLowerCase()} · ${timer.text}</span>`));
            }
            panel.appendChild(el('p', 'next', maxed ? (def.id === 'hq' ? 'En üst seviye.' : 'Önce Karargâh’ı yükselt.') : `Sonraki seviye: ${def.desc(lvl + 1)}`));
            if (!maxed) {
                const up = el('button', 'buy', `Yükselt ${costHtml(cost)}`);
                up.type = 'button';
                up.disabled = !canAfford(cost);
                up.setAttribute('aria-label', `${def.name} yükselt: ${costText(cost)}`);
                up.addEventListener('click', () => upgrade(b));
                panel.appendChild(up);
            }
            return;
        }
        if (save$.b.length >= slotLimit()) {
            panel.appendChild(el('p', 'muted', `Bina yeri doldu. Karargâh’ı yükselttikçe yeni yer açılır (şu an ${slotLimit()}).`));
            return;
        }
        panel.appendChild(el('h3', 'tp-title', 'Bu arsaya ne kurulsun?'));
        const list = el('div', 'build-list');
        for (const def of BUILDINGS) {
            if (def.id === 'hq') continue;
            const idx = B[def.id];
            const have = countOf(idx), max = def.max(hq);
            const locked = hq < def.unlock;
            const full = have >= max;
            const cost = levelCost(def, 0);
            const row = el('div', 'build-row' + (locked || full ? ' off' : ''));
            row.innerHTML = `<span class="card-ico" aria-hidden="true">${def.icon}</span><div><strong>${def.name}</strong><small>${locked ? `Karargâh Sv ${def.unlock} gerekir` : full ? `Sınırda (${have}/${max})` : def.desc(1)}</small></div>`;
            const btn = el('button', 'buy small', locked || full ? (locked ? 'Kilitli' : 'Dolu') : `Kur ${costHtml(cost)}`);
            btn.type = 'button';
            btn.disabled = locked || full || !canAfford(cost);
            btn.setAttribute('aria-label', locked || full ? `${def.name}: ${locked ? 'kilitli' : 'sınırda'}` : `${def.name} kur: ${costText(cost)}`);
            btn.addEventListener('click', () => {
                if (guardCheats() || btn.disabled) return;
                pay(cost);
                save$.b.push([idx, selectedTile, 1, now()]);
                persist();
                toast(`${def.name} kuruldu!`);
                renderBase(); renderTop();
                const tileEl = $('plot').children[selectedTile];
                if (tileEl) tileEl.classList.add('pop');
            });
            row.appendChild(btn);
            list.appendChild(row);
        }
        panel.appendChild(list);
    }

    function collectAll() {
        if (guardCheats()) return;
        const got = [0, 0, 0];
        for (const b of save$.b) {
            const def = BUILDINGS[b[0]];
            if (def.prod == null) continue;
            const p = pending(b);
            if (p < 1) continue;
            got[def.prod] += p;
            b[3] = now();
        }
        got.forEach((v, i) => { save$.r[i] += v; if (v) flyPill(RES[i].id); });
        persist();
        toast(`Toplandı: ${costText(got)}`);
        renderBase(); renderTop();
    }

    function heroCard(i, compact) {
        const h = HEROES[i], lvl = save$.h[i];
        const br = BRANCHES[h.branch], rar = RARITY[h.rarity];
        const owned = lvl > 0;
        const card = el('article', `hero-card r${h.rarity}` + (owned ? '' : ' locked') + (save$.tm.includes(i) ? ' in-team' : '') + (compact ? ' compact' : ''));
        card.style.setProperty('--rar', rar.color);
        card.style.setProperty('--br', br.color);
        card.innerHTML = `<div class="hero-face" aria-hidden="true"><span>${owned ? br.icon : '?'}</span>${owned ? `<em>Sv ${lvl}</em>` : ''}</div>
            <div class="hero-info"><span class="rar-chip">${rar.name}</span><h3>${owned ? h.name : '???'}</h3><span class="lvl">${br.name}${owned ? ` · Sv ${lvl}` : ''}</span>${owned ? `<span class="lv-bar" aria-hidden="true"><i style="width:${lvl / MAX_HERO * 100}%"></i></span>` : ''}${compact ? '' : `<p>${owned ? heroSkill(i, lvl) : 'Kahraman çağırarak bulunur.'}</p>`}</div>`;
        if (save$.tm.includes(i) && !compact) card.insertAdjacentHTML('afterbegin', '<span class="team-tag">TAKIMDA</span>');
        return card;
    }

    function renderHeroes() {
        const team = $('team');
        team.innerHTML = '';
        for (let k = 0; k < TEAM_SIZE; k++) {
            const i = save$.tm[k];
            if (i == null) { team.appendChild(el('div', 'team-slot empty', '<span>Boş yer</span>')); continue; }
            const slot = heroCard(i, true);
            slot.classList.add('team-slot');
            team.appendChild(slot);
        }
        const bonus = branchBonus();
        $('team-bonus').textContent = bonus ? `Aynı sınıf bonusu: hasar +%${Math.round(bonus * 100)}` : 'Aynı sınıftan 2 kahraman +%5, 3 kahraman +%15 hasar verir.';
        const rec = $('recruit-btn');
        rec.innerHTML = `<span>Kahraman çağır</span> <span class="cost gold"><i aria-hidden="true"></i>${fmt(RECRUIT_COST)}</span>`;
        rec.disabled = save$.r[0] < RECRUIT_COST;
        const grid = $('hero-grid');
        grid.innerHTML = '';
        $('hero-count').textContent = `${save$.h.filter(Boolean).length}/${HEROES.length}`;
        HEROES.forEach((h, i) => {
            const card = heroCard(i, false);
            const lvl = save$.h[i];
            if (lvl > 0) {
                const actions = el('div', 'hero-actions');
                const inTeam = save$.tm.includes(i);
                const t = el('button', 'buy blue small', inTeam ? 'Takımdan çıkar' : 'Takıma al');
                t.type = 'button';
                t.disabled = (inTeam && save$.tm.length <= 1) || (!inTeam && save$.tm.length >= TEAM_SIZE);
                if (!inTeam && save$.tm.length >= TEAM_SIZE) t.textContent = 'Takım dolu';
                t.addEventListener('click', () => {
                    if (inTeam) save$.tm = save$.tm.filter(v => v !== i);
                    else if (save$.tm.length < TEAM_SIZE) save$.tm.push(i);
                    persist(); renderHeroes(); renderTop();
                });
                actions.appendChild(t);
                const cost = heroLevelCost(lvl);
                const maxed = lvl >= MAX_HERO;
                const up = el('button', 'buy small', maxed ? 'En üst seviye' : `Eğit ${costHtml(cost)}`);
                up.type = 'button';
                up.disabled = maxed || !canAfford(cost);
                up.setAttribute('aria-label', maxed ? `${h.name} en üst seviyede` : `${h.name} eğit: ${costText(cost)}`);
                up.addEventListener('click', () => {
                    if (guardCheats() || maxed || !canAfford(cost)) return;
                    pay(cost); save$.h[i] += 1; persist(); toast(`${h.name} seviye ${save$.h[i]}!`); renderHeroes(); renderTop();
                });
                actions.appendChild(up);
                card.appendChild(actions);
            }
            grid.appendChild(card);
        });
    }

    function recruit() {
        if (guardCheats() || save$.r[0] < RECRUIT_COST) return;
        save$.r[0] -= RECRUIT_COST;
        const roll = Math.random();
        const rarity = roll < RARITY[2].odds ? 2 : roll < RARITY[2].odds + RARITY[1].odds ? 1 : 0;
        const pool = HEROES.map((h, i) => i).filter(i => HEROES[i].rarity === rarity);
        const i = pool[Math.floor(Math.random() * pool.length)];
        const h = HEROES[i];
        let line;
        if (!save$.h[i]) {
            save$.h[i] = 1;
            if (save$.tm.length < TEAM_SIZE) save$.tm.push(i);
            line = 'Yeni kahraman birliğe katıldı!';
        } else if (save$.h[i] < MAX_HERO) {
            save$.h[i] += 1;
            line = `Tekrar geldi: seviye ${save$.h[i]} oldu.`;
        } else {
            save$.r[0] += Math.round(RECRUIT_COST / 2);
            line = `Zaten en üst seviyede: ${fmt(RECRUIT_COST / 2)} altın geri verildi.`;
        }
        persist();
        const sheet = $('reveal').querySelector('.sheet');
        sheet.style.setProperty('--rar', RARITY[h.rarity].color);
        sheet.className = `sheet reveal r${h.rarity}`;
        $('reveal-rarity').textContent = `${RARITY[h.rarity].name.toUpperCase()} · ${BRANCHES[h.branch].name.toUpperCase()}`;
        $('reveal-icon').textContent = BRANCHES[h.branch].icon;
        $('reveal-name').textContent = h.name;
        $('reveal-note').textContent = `${line} ${heroSkill(i, save$.h[i])}`;
        $('reveal').classList.remove('hidden');
        $('reveal-ok').focus();
        renderHeroes(); renderTop();
    }

    // Production keeps ticking while a menu is open.
    setInterval(() => { if (mode !== 'run') { renderTop(); if (tab === 'base' && !document.hidden) renderBaseLight(); } }, 5000);
    function renderBaseLight() {
        // Re-render only when nothing is focused inside the base screen, so keyboard users don't lose their place.
        if ($('screen-base').contains(document.activeElement) && document.activeElement !== document.body) return;
        const scroller = $('screen-base');
        const top = scroller.scrollTop;
        renderBase();
        scroller.scrollTop = top;
    }

    // ---------- Input ----------
    canvas.addEventListener('pointerdown', e => {
        if (mode !== 'run' || run.paused) return;
        drag = { id: e.pointerId, x0: e.clientX, tx0: run.tx };
        try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    });
    canvas.addEventListener('pointermove', e => {
        if (!drag || drag.id !== e.pointerId || !run) return;
        run.tx = drag.tx0 + (e.clientX - drag.x0) / view.half * 1.2;
    });
    const endDrag = () => { drag = null; };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    const keyMap = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
    const typing = t => (t instanceof HTMLInputElement && !['checkbox', 'radio', 'button'].includes(t.type)) || t instanceof HTMLTextAreaElement || t?.isContentEditable;
    window.addEventListener('keydown', e => {
        if (typing(e.target)) return;
        if (keyMap[e.key] && mode === 'run' && !run.paused) { keys.add(keyMap[e.key]); e.preventDefault(); }
        if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && mode === 'run') { run.paused ? resume() : pause(); e.preventDefault(); }
        else if (e.key === 'Escape' && !$('reveal').classList.contains('hidden')) { $('reveal').classList.add('hidden'); $('recruit-btn').focus(); }
    });
    window.addEventListener('keyup', e => { if (keyMap[e.key]) keys.delete(keyMap[e.key]); });
    window.addEventListener('blur', () => { keys.clear(); pause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

    for (const b of document.querySelectorAll('#tabbar button')) b.addEventListener('click', () => showTab(b.dataset.tab));
    $('play-btn').addEventListener('click', () => startRun(playStage));
    $('pause-btn').addEventListener('click', pause);
    $('resume-btn').addEventListener('click', resume);
    $('restart-btn').addEventListener('click', () => {
        if (!run || run.over) return;
        run.won = false; run.over = true; endRun({ restart: true });
    });
    $('quit-btn').addEventListener('click', () => {
        if (run && !run.over) { run.won = false; run.over = true; endRun(); return; }
        toMenu('map');
    });
    $('opt-shake').addEventListener('change', e => {
        save$.o = e.target.checked ? save$.o & ~OPT_NO_SHAKE : save$.o | OPT_NO_SHAKE;
        persist();
    });
    $('next-btn').addEventListener('click', () => startRun(playStage));
    $('base-btn').addEventListener('click', () => toMenu('base'));
    $('map-btn').addEventListener('click', () => toMenu('map'));
    $('collect-btn').addEventListener('click', collectAll);
    $('recruit-btn').addEventListener('click', recruit);
    $('reveal-ok').addEventListener('click', () => { $('reveal').classList.add('hidden'); $('recruit-btn').focus(); });
    $('result').addEventListener('click', e => { if (e.target === $('result')) toMenu('map'); });

    readTheme();
    new MutationObserver(() => { const before = themeId; readTheme(); if (before !== themeId) resize(); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', resize);
    resize();
    renderMenus();
    rafId = requestAnimationFrame(loop);
    // Exposed for automated checks; not part of gameplay.
    window.__sonHat = { state: () => run, save: () => save$, start: startRun, view: () => ({ ...view }) };
})();
