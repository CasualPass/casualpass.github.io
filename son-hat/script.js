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

    // ---------- Persistent progress (first-party cookie) ----------
    // Compact save so the cookie stays well under 4 KB:
    // { st: stage, r: [gold, iron, food], k: kills, b: [[type, tile, level, collectedAt]], h: [hero levels], tm: [team hero indexes] }
    const SAVE_KEY = 'cp_sonhat_v2';
    const OLD_KEY = 'cp_sonhat_v1';
    const SAVE_LIMIT = 3000;
    const MAX_STAGE = 99;
    const MAX_LEVEL = 15;
    const MAX_HERO = 10;
    const GRID = 5;
    const HQ_TILE = 12;
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
    const defaults = () => ({ st: 1, r: [60, 10, 20], k: 0, b: [[B.hq, HQ_TILE, 1, now()], [B.goldmine, 7, 1, now()]], h: [1, 0, 0, 0, 0, 0, 0, 0, 0], tm: [0] });
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
            if (old) d.r[0] += int(old.coin, 0, 1e6);
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
        return d;
    }
    const save$ = load();
    function persist() {
        if (cheatsOn()) return;
        const value = encodeURIComponent(JSON.stringify(save$));
        if (value.length > SAVE_LIMIT) return; // Never write a cookie the browser could drop.
        const secure = location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `${SAVE_KEY}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
        if (readCookie(OLD_KEY)) document.cookie = `${OLD_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
    }

    // ---------- Base helpers ----------
    const levelOf = id => save$.b.filter(b => b[0] === B[id]).reduce((m, b) => Math.max(m, b[2]), 0);
    const hqLevel = () => levelOf('hq');
    const slotLimit = () => Math.min(GRID * GRID, 4 + hqLevel());
    const countOf = type => save$.b.filter(b => b[0] === type).length;
    const storageMinutes = () => 60 + levelOf('depot') * 30;
    function pending(b) {
        const def = BUILDINGS[b[0]];
        if (def.prod == null) return 0;
        const minutes = Math.min(storageMinutes(), Math.max(0, now() - b[3]) / 60);
        return Math.floor(minutes * def.rate * b[2]);
    }
    const canAfford = cost => cost.every((c, i) => save$.r[i] >= c);
    const pay = cost => cost.forEach((c, i) => { save$.r[i] -= c; });
    const costHtml = cost => cost.map((c, i) => c ? `<span class="cost ${RES[i].id}"><i aria-hidden="true"></i>${fmt(c)}</span>` : '').join('');
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

    // ---------- View / projection ----------
    // Road spans x ∈ [-1, 1]; z grows forward. Depth d = z - camera z.
    const view = { w: 480, h: 800, dpr: 1, cx: 240, half: 180, baseY: 620, topY: -40 };
    const K = .05;
    const scaleAt = d => 1 / (1 + Math.max(-12, d) * K);
    const sy = d => view.topY + (view.baseY - view.topY) * scaleAt(d);
    const sx = (x, d) => view.cx + x * view.half * scaleAt(d);
    function resize() {
        const w = window.innerWidth, h = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
        view.w = w; view.h = h; view.dpr = dpr; view.cx = w / 2;
        view.half = Math.min(w * .42, h * .3);
        view.baseY = h * .74;
        view.topY = -h * .08;
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
        if (mode !== 'run') drawScene(performance.now() / 1000);
    }

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
        const stage = buildStage(n);
        run = {
            n, L: stage.L, ents: stage.ents, boss: stage.boss,
            z: 0, x: 0, tx: 0, soldiers: startSoldiers(), peak: startSoldiers(),
            weapon: 0, rateBonus: 1, dmgBonus: 1, heli: levelOf('hangar') > 0 ? 1 : 0,
            bullets: [], fx: [], texts: [], rockets: [],
            fireT: 0, heliT: 0, contactT: 0, minionT: 0,
            shield: save$.tm.filter(i => HEROES[i].branch === 0).reduce((sum, i) => sum + shieldOf(i, save$.h[i]), 0),
            skills: save$.tm.filter(i => HEROES[i].branch > 0).map((i, k) => ({ i, l: save$.h[i], t: 1.5 + k })),
            coins: 0, iron: 0, food: 0, kills: 0, arena: false, over: false, endT: 0, won: false, t: 0, shake: 0
        };
        mode = 'run';
        app.dataset.mode = 'run';
        hideOverlays();
        $('run-title').textContent = `Bölüm ${n}`;
        $('run-weapon').textContent = WEAPONS[0].name;
        hint(window.matchMedia('(hover: none)').matches ? 'Sağa sola kaydır · kapıları seç' : 'Fareyle sürükle ya da ← → · kapıları seç', 3.2);
        lastT = performance.now();
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(loop);
    }

    let hintTimer = 0;
    function hint(text, secs) { $('run-hint').textContent = text; clearTimeout(hintTimer); hintTimer = setTimeout(() => { $('run-hint').textContent = ''; }, secs * 1000); }

    const squadRadius = () => Math.min(.5, .07 + .034 * Math.sqrt(Math.max(1, run.soldiers)));
    const visibleTarget = e => e.hp > 0 && (e.kind === 'zombie' || e.kind === 'brute' || (e.kind === 'boss' && run.arena));

    function addText(x, z, text, color, size = 1) {
        // Stack labels that pop at the same moment so they don't overlap.
        const fresh = run.texts.filter(t => t.t < .35).length;
        run.texts.push({ x, z: z + fresh * 1.6, text, color, size, t: 0 });
    }
    function burst(x, z, color, count = 6, spread = .12) {
        for (let i = 0; i < count; i++) run.fx.push({ x, z, vx: (Math.random() * 2 - 1) * spread * 4, vz: (Math.random() * 2 - 1) * 2, h: .05 + Math.random() * .15, vh: 1 + Math.random() * 2, color, t: 0, life: .45 + Math.random() * .3 });
    }

    function loseSoldiers(k, x, z) {
        if (k <= 0) return;
        if (run.shield > 0) { run.shield -= 1; addText(x, z, 'KALKAN', '#9fd4ff', .8); return; }
        run.soldiers -= k;
        burst(run.x, run.z, '#2f8cff', Math.min(10, 3 + k));
        addText(run.x, run.z + .5, `−${k}`, '#ff6b6b', 1);
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
        burst(e.x, e.z, e.kind === 'zombie' ? '#7bbf4a' : '#ff7a7a', e.kind === 'zombie' ? 5 : 16, e.hw);
        if (e.kind !== 'zombie') addText(e.x, e.z, `+${coins}`, '#ffd34d', 1.1);
        if (e.kind === 'boss') {
            run.iron += 10 + run.n * 2;
            run.food += 5 + run.n;
            for (const o of run.ents) if (o.hp > 0 && (o.kind === 'zombie' || o.kind === 'brute')) { o.hp = 0; burst(o.x, o.z, '#7bbf4a', 4); }
            run.shake = .5;
            finish(true);
        }
    }

    function damage(e, amount) {
        if (e.hp <= 0) return;
        if (e.kind === 'crate') {
            e.hp -= amount;
            if (e.hp <= 0) breakCrate(e, true);
            return;
        }
        e.hp -= amount;
        e.flash = .08;
        if (e.hp <= 0) kill(e);
    }

    function breakCrate(c, earned) {
        c.hp = 0;
        burst(c.x, c.z, '#c58b3a', 14, .3);
        if (!earned) return;
        run.coins += 3;
        run.iron += 2 + Math.floor(run.n / 2);
        for (const loot of c.loot) grantLoot(loot, c.x, c.z);
    }

    function grantLoot(loot, x, z) {
        if (loot === 'weapon') {
            if (run.weapon < WEAPONS.length - 1) { run.weapon += 1; addText(x, z, WEAPONS[run.weapon].name.toUpperCase() + '!', '#ffe14d', 1.3); }
            else { run.dmgBonus += .25; addText(x, z, 'HASAR +%25', '#ffe14d', 1.2); }
            $('run-weapon').textContent = WEAPONS[run.weapon].name;
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
        const before = run.soldiers;
        const v = Math.round(g.v);
        if (g.op === '+') run.soldiers += v;
        else if (g.op === '−') run.soldiers -= v;
        else if (g.op === '×') run.soldiers *= v;
        run.soldiers = Math.min(400, run.soldiers);
        run.peak = Math.max(run.peak, run.soldiers);
        const diff = run.soldiers - before;
        if (!g.stream || diff !== 1) addText(run.x, run.z + 1, diff >= 0 ? `+${diff}` : `${diff}`, diff >= 0 ? '#7df2ff' : '#ff6b6b', 1.2);
        if (run.soldiers <= 0) {
            if (immortal()) run.soldiers = 1;
            else { run.soldiers = 0; finish(false); }
        }
    }

    function finish(won) {
        if (run.over) return;
        run.over = true; run.won = won; run.endT = 0;
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
        burst(x, z, color, 12, radius);
        run.shake = Math.max(run.shake, .15);
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

        if (run.over) {
            run.endT += dt;
            stepEffects(dt);
            if (run.endT > (run.won ? 1.4 : 1.1)) endRun();
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
                    breakCrate(e, false);
                    loseSoldiers(cost, e.x, e.z);
                    hint('Sandığı vurmadan çarptın: ödül yok!', 1.6);
                }
            }
            if (run.z >= arenaZ && !run.arena) { run.arena = true; hint(run.boss.big ? 'DEV BOSS geliyor!' : 'Boss geliyor, hattı tut!', 2); }
        }
        if (run.over) return;

        // Enemies walk in
        const r = squadRadius();
        for (const e of run.ents) {
            if (!visibleTarget(e)) continue;
            if (e.flash) e.flash = Math.max(0, e.flash - dt);
            const d = e.z - run.z;
            if (e.kind === 'boss') {
                if (!run.arena) continue;
                if (d > .7) e.z -= e.speed * (e.big ? .85 : 1) * dt;
                else {
                    run.contactT -= dt;
                    if (run.contactT <= 0) { run.contactT = .45; loseSoldiers(1 + Math.floor(run.soldiers * .08), e.x, e.z); run.shake = .2; }
                }
                continue;
            }
            if (d > 32) continue;
            e.z -= e.speed * dt;
            e.wob += dt * 8;
            if (d < 6) e.x += Math.sign(run.x - e.x) * Math.min(Math.abs(run.x - e.x), .28 * dt);
            if (d < .35 && d > -.6 && Math.abs(e.x - run.x) < r + e.hw) {
                e.hp = 0;
                burst(e.x, e.z, '#7bbf4a', 4);
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
            run.bullets.push({ x: run.x + off, z: run.z + .3, vx, dmg: perShot, color: w.color, life: 0 });
        }

        // Helicopter escort
        if (run.heli > 0) {
            run.heliT -= dt;
            if (run.heliT <= 0) {
                run.heliT = .7;
                const t = nearestTarget(24, run.x + .6);
                if (t) run.rockets.push({ x: run.x + .55, z: run.z + .5, h: .5, target: t, dmg: 5 * (1 + run.n * .3) * run.heli * dmgMult() * (1 + Math.max(0, levelOf('hangar') - 1) * .2), radius: .3, color: '#8fe9ff', speed: 26 });
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
                if (t) run.rockets.push({ x: run.x, z: run.z, h: .2, target: t, dmg: (5 + sk.l * 3) * power, radius: .32, color: '#ff9a5a', speed: 20 });
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
                    if (hit.op === '−') { hit.v -= gain; if (hit.v <= 0) { hit.op = '+'; hit.v = -hit.v; } }
                    else hit.v = Math.min(hit.cap, hit.v + gain);
                } else damage(hit, b.dmg);
                if (Math.random() < .3) run.fx.push({ x: b.x, z: hitZ, vx: 0, vz: 0, h: .1, vh: 0, color: '#fff3b0', t: 0, life: .12, spark: true });
            }
        }
        run.bullets = run.bullets.filter(b => !b.dead);

        // Rockets
        for (const k of run.rockets) {
            const t = k.target;
            if (t.hp <= 0) { const n = nearestTarget(26, k.x); if (n) k.target = n; else { k.dead = true; continue; } }
            const dx = k.target.x - k.x, dz = k.target.z - k.z;
            const dist = Math.hypot(dx * 6, dz);
            if (dist < .5) { k.dead = true; explode(k.target.x, k.target.z, k.radius, k.dmg, k.color); continue; }
            k.x += dx / dist * 6 * k.speed * dt / 6; k.z += dz / dist * k.speed * dt; k.h = Math.max(.1, k.h - dt * .3);
        }
        run.rockets = run.rockets.filter(k => !k.dead);

        stepEffects(dt);
        run.ents = run.ents.filter(e => e.kind === 'boss' || (e.kind === 'gate' ? e.z > run.z - 4 : e.hp > 0 || false));
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
        for (const p of run.fx) { p.t += dt; p.x += p.vx * dt; p.z += p.vz * dt; p.h = Math.max(0, p.h + p.vh * dt); p.vh -= 6 * dt; }
        run.fx = run.fx.filter(p => p.t < p.life);
        for (const t of run.texts) t.t += dt;
        run.texts = run.texts.filter(t => t.t < 1.1);
        run.shake = Math.max(0, run.shake - dt);
    }

    // ---------- Drawing ----------
    function shade(hex, f) {
        const n = parseInt(hex.slice(1), 16);
        const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))));
        return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
    function outlined(text, x, y, size, fill, stroke = '#10324a') {
        ctx.font = `900 ${size}px Outfit, system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size * .18); ctx.strokeStyle = stroke;
        ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y);
    }

    function drawWorld(camZ, time) {
        const { w, h } = view;
        // Water
        const sea = ctx.createLinearGradient(0, 0, 0, h);
        sea.addColorStop(0, '#0f6f86'); sea.addColorStop(1, '#1b8ea0');
        ctx.fillStyle = sea; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 2;
        for (let i = 0; i < 22; i++) {
            const d = ((i * 7.3 - camZ) % 154 + 154) % 154 - 8;
            const y = sy(d), s = scaleAt(d);
            const off = ((i * 97) % 13) / 13;
            ctx.beginPath(); ctx.moveTo(w * off * .4, y); ctx.lineTo(w * off * .4 + 50 * s, y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(w - w * off * .4, y + 8 * s); ctx.lineTo(w - w * off * .4 - 50 * s, y + 8 * s); ctx.stroke();
        }
        const near = -10, far = 150;
        const quad = (x0, x1, d0, d1, fill) => {
            ctx.fillStyle = fill; ctx.beginPath();
            ctx.moveTo(sx(x0, d0), sy(d0)); ctx.lineTo(sx(x1, d0), sy(d0)); ctx.lineTo(sx(x1, d1), sy(d1)); ctx.lineTo(sx(x0, d1), sy(d1)); ctx.closePath(); ctx.fill();
        };
        // Bridge shadow, curb and deck
        quad(-1.25, 1.25, near, far, 'rgba(0,30,40,.28)');
        quad(-1.16, 1.16, near, far, '#6f7b85');
        quad(-1.06, 1.06, near, far, '#c9ced3');
        // Lane paint
        for (let k = Math.floor((camZ + near) / 4); k * 4 < camZ + far; k++) {
            const d0 = k * 4 - camZ, d1 = d0 + 2;
            quad(-.012, .012, d0, d1, 'rgba(255,255,255,.85)');
        }
        quad(-.93, -.9, near, far, 'rgba(255,255,255,.6)');
        quad(.9, .93, near, far, 'rgba(255,255,255,.6)');
        // Rails and pillars
        for (const side of [-1, 1]) {
            ctx.strokeStyle = '#4b5862'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(sx(side * 1.12, near), sy(near) - 14 * scaleAt(near)); ctx.lineTo(sx(side * 1.12, far), sy(far) - 14 * scaleAt(far)); ctx.stroke();
            for (let k = Math.ceil((camZ + near) / 18); k * 18 < camZ + far; k++) {
                const d = k * 18 - camZ, s = scaleAt(d);
                const x = sx(side * 1.16, d), y = sy(d);
                const pw = 34 * s * view.half / 180, ph = 30 * s * view.half / 180;
                ctx.fillStyle = '#9aa3aa'; ctx.fillRect(x - pw / 2, y - ph, pw, ph);
                ctx.fillStyle = '#c7ccd0'; ctx.fillRect(x - pw / 2, y - ph - 6 * s, pw, 8 * s);
            }
        }
    }

    function unitPx(d) { return view.half * scaleAt(d); }

    function drawPerson(x, d, size, body, helmet, skin, bob, flash) {
        const s = unitPx(d) * size;
        const px = sx(x, d), py = sy(d) - bob * s;
        ctx.fillStyle = 'rgba(0,0,0,.22)';
        ctx.beginPath(); ctx.ellipse(px, sy(d), s * .5, s * .18, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = flash ? shade(body, .45) : body;
        ctx.beginPath(); ctx.ellipse(px, py - s * .55, s * .38, s * .45, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = flash ? shade(skin, .45) : skin;
        ctx.beginPath(); ctx.arc(px, py - s * 1.05, s * .3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = helmet;
        ctx.beginPath(); ctx.arc(px, py - s * 1.12, s * .33, Math.PI, 0); ctx.fill();
    }

    function drawGate(g, d) {
        const s = scaleAt(d);
        const x0 = sx(g.x - g.hw, d), x1 = sx(g.x + g.hw, d), y = sy(d);
        const hgt = unitPx(d) * (g.stream ? .26 : .42);
        const positive = g.op !== '−';
        const used = g.used;
        ctx.globalAlpha = used ? .25 : .92;
        const grad = ctx.createLinearGradient(0, y - hgt, 0, y);
        grad.addColorStop(0, positive ? 'rgba(120,190,255,.95)' : 'rgba(255,120,120,.95)');
        grad.addColorStop(1, positive ? 'rgba(30,110,230,.95)' : 'rgba(200,30,40,.95)');
        ctx.fillStyle = grad;
        ctx.fillRect(x0, y - hgt, x1 - x0, hgt);
        ctx.strokeStyle = positive ? '#cfe6ff' : '#ffd0d0'; ctx.lineWidth = Math.max(1.5, 3 * s);
        ctx.strokeRect(x0, y - hgt, x1 - x0, hgt);
        if (s > .18) outlined(`${g.op}${Math.max(0, Math.round(g.v))}`, (x0 + x1) / 2, y - hgt * .52, Math.max(11, hgt * (g.stream ? .78 : .62)), '#fff');
        ctx.globalAlpha = 1;
    }

    function drawCrate(c, d) {
        const dFar = d + c.len;
        const xl = c.x - c.hw, xr = c.x + c.hw;
        const hN = unitPx(d) * .5, hF = unitPx(dFar) * .5;
        // top
        ctx.fillStyle = '#d9a24a';
        ctx.beginPath();
        ctx.moveTo(sx(xl, d), sy(d) - hN); ctx.lineTo(sx(xr, d), sy(d) - hN); ctx.lineTo(sx(xr, dFar), sy(dFar) - hF); ctx.lineTo(sx(xl, dFar), sy(dFar) - hF); ctx.closePath(); ctx.fill();
        // front
        const fx0 = sx(xl, d), fx1 = sx(xr, d), fy = sy(d);
        ctx.fillStyle = '#b97a2a'; ctx.fillRect(fx0, fy - hN, fx1 - fx0, hN);
        ctx.strokeStyle = 'rgba(80,45,10,.45)'; ctx.lineWidth = Math.max(1, 2 * scaleAt(d));
        for (let i = 1; i < 7; i++) { const x = fx0 + (fx1 - fx0) * i / 7; ctx.beginPath(); ctx.moveTo(x, fy - hN); ctx.lineTo(x, fy); ctx.stroke(); }
        ctx.strokeRect(fx0, fy - hN, fx1 - fx0, hN);
        outlined(fmt(Math.ceil(c.hp)), (fx0 + fx1) / 2, fy - hN * .5, Math.max(12, hN * .55), '#fff');
        // loot on top
        c.loot.forEach((loot, i) => {
            const ld = d + c.len * (.35 + i * .4);
            const lx = sx(c.x, ld), ly = sy(ld) - unitPx(ld) * .5;
            const u = unitPx(ld);
            ctx.fillStyle = 'rgba(120,220,255,.35)';
            ctx.beginPath(); ctx.ellipse(lx, ly, u * .3, u * .1, 0, 0, Math.PI * 2); ctx.fill();
            drawLootIcon(loot, lx, ly - u * .16, u * .5);
        });
    }

    function drawLootIcon(loot, x, y, u) {
        ctx.save(); ctx.translate(x, y);
        if (loot === 'heli') {
            ctx.fillStyle = '#4aa8ff'; ctx.beginPath(); ctx.ellipse(0, 0, u * .5, u * .26, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillRect(u * .3, -u * .06, u * .55, u * .1);
            ctx.fillStyle = '#d8f1ff'; ctx.beginPath(); ctx.ellipse(-u * .2, -u * .05, u * .18, u * .13, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#1d3d5a'; ctx.lineWidth = Math.max(1.5, u * .06);
            const a = performance.now() / 60;
            ctx.beginPath(); ctx.moveTo(-Math.cos(a) * u * .7, -u * .32); ctx.lineTo(Math.cos(a) * u * .7, -u * .32); ctx.stroke();
        } else if (loot === 'weapon') {
            ctx.fillStyle = '#3b6fae'; ctx.fillRect(-u * .55, -u * .12, u * 1.1, u * .24);
            ctx.fillStyle = '#7fb2ec'; for (let i = 0; i < 3; i++) ctx.fillRect(u * .1, -u * .2 + i * u * .14, u * .6, u * .07);
            ctx.fillStyle = '#25466f'; ctx.fillRect(-u * .4, u * .1, u * .18, u * .3);
        } else if (loot === 'troops') {
            outlined('+ASKER', 0, 0, Math.max(10, u * .45), '#7df29a');
        } else {
            outlined('ATEŞ+', 0, 0, Math.max(10, u * .45), '#ffb36b');
        }
        ctx.restore();
    }

    function hpBar(x, y, wpx, frac, label, big) {
        const hgt = big ? 16 : 6;
        ctx.fillStyle = 'rgba(16,50,74,.8)'; ctx.fillRect(x - wpx / 2 - 2, y - 2, wpx + 4, hgt + 4);
        ctx.fillStyle = '#ff5a3c'; ctx.fillRect(x - wpx / 2, y, wpx * Math.max(0, frac), hgt);
        if (label) outlined(label, x, y - (big ? 14 : 8), big ? 26 : 13, '#fff');
    }

    function drawZombie(e, d, time) {
        if (e.kind === 'boss') {
            const u = unitPx(d) * (e.big ? 1.25 : 1);
            const px = sx(e.x, d), py = sy(d);
            ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(px, py, u * .45, u * .12, 0, 0, Math.PI * 2); ctx.fill();
            const step = Math.sin(time * 4) * u * .03;
            ctx.fillStyle = '#7a2b2b'; ctx.fillRect(px - u * .22, py - u * .45 + step, u * .16, u * .45); ctx.fillRect(px + u * .06, py - u * .45 - step, u * .16, u * .45);
            ctx.fillStyle = e.flash ? '#f7cdca' : '#e9a3a0';
            ctx.beginPath(); ctx.ellipse(px, py - u * .78, u * .38, u * .4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(px - u * .42, py - u * .78, u * .12, u * .26, .3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(px + u * .42, py - u * .78, u * .12, u * .26, -.3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#b5413c'; ctx.beginPath(); ctx.ellipse(px + u * .05, py - u * .7, u * .12, u * .08, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = e.flash ? '#f7cdca' : '#e39b97'; ctx.beginPath(); ctx.arc(px, py - u * 1.22, u * .18, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#3a0d0d'; ctx.fillRect(px - u * .09, py - u * 1.25, u * .05, u * .04); ctx.fillRect(px + u * .04, py - u * 1.25, u * .05, u * .04);
            if (run && run.arena) hpBar(px, py - u * 1.62, Math.max(120, u * 1.2), e.hp / e.max, fmt(Math.ceil(e.hp)), true);
            return;
        }
        const big = e.kind === 'brute';
        const bob = Math.abs(Math.sin(e.wob)) * .08;
        drawPerson(e.x, d, big ? .5 : .16, '#c9393b', '#a62323', big ? '#e9a3a0' : '#8fc76a', bob, e.flash > 0);
        if (big) hpBar(sx(e.x, d), sy(d) - unitPx(d) * .72, unitPx(d) * .5, e.hp / e.max, fmt(Math.ceil(e.hp)), false);
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

    function drawSquad(camZ, time, idle) {
        const n = idle ? startSoldiers() : run.soldiers;
        const x = idle ? 0 : run.x, z = idle ? camZ : run.z;
        const shown = Math.min(n, 80);
        const r = idle ? .1 : squadRadius();
        const spacing = shown > 1 ? r / Math.max(1, Math.ceil(Math.sqrt(shown / 3))) : 0;
        const list = [];
        for (let i = 0; i < shown; i++) {
            const [fx, fz] = formation[i];
            list.push({ x: x + fx * spacing, z: z + fz * spacing * 6 - (i === 0 ? 0 : 0), lead: i === 0 });
        }
        list.sort((a, b) => b.z - a.z);
        const hero = BRANCHES[HEROES[save$.tm[0] ?? 0].branch];
        for (const p of list) {
            const d = p.z - camZ;
            const bob = idle ? 0 : Math.abs(Math.sin(time * 12 + p.x * 40 + p.z * 3)) * .06;
            drawPerson(p.x, d, p.lead ? .2 : .15, '#f1d7a8', p.lead ? hero.color : '#2f8cff', '#f2c79a', bob, false);
        }
        if (!idle && run.shield > 0) {
            const d = 0, u = unitPx(d);
            ctx.strokeStyle = 'rgba(140,200,255,.7)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.ellipse(sx(x, d), sy(d) - u * .1, u * (r + .12), u * (r + .12) * .4, 0, 0, Math.PI * 2); ctx.stroke();
        }
        // Count bubble
        const bx = sx(x, z - camZ - 1.2), by = sy(z - camZ - 1.2) + 26;
        ctx.fillStyle = '#2f8cff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
        const label = fmt(n);
        ctx.font = '900 20px Outfit, system-ui, sans-serif';
        const tw = ctx.measureText(label).width + 22;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx - tw / 2, by - 15, tw, 30, 10) : ctx.rect(bx - tw / 2, by - 15, tw, 30); ctx.fill(); ctx.stroke();
        outlined(label, bx, by + 1, 20, '#fff');
        // Helicopter escort
        if (!idle && run.heli > 0) {
            const d = 1.5 + Math.sin(time * 2) * .3;
            const u = unitPx(d);
            const hx = sx(x + .55, d), hy = sy(d) - u * .9;
            ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(sx(x + .55, d), sy(d), u * .2, u * .06, 0, 0, Math.PI * 2); ctx.fill();
            drawLootIcon('heli', hx, hy, u * .4);
            if (run.heli > 1) outlined(`x${run.heli}`, hx + u * .35, hy - u * .3, 14, '#8fe9ff');
        }
    }

    function drawScene(time) {
        ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
        const camZ = run ? run.z : (time * 2) % 1000;
        let shakeX = 0, shakeY = 0;
        if (run && run.shake > 0 && !run.paused) { shakeX = (Math.random() - .5) * 10 * run.shake; shakeY = (Math.random() - .5) * 10 * run.shake; }
        ctx.save(); ctx.translate(shakeX, shakeY);
        drawWorld(camZ, time);
        if (!run) {
            // Idle backdrop: a horde far ahead and the squad waiting.
            for (let i = 0; i < 40; i++) {
                const x = ((i * 37) % 17) / 17 * 1.6 - .8, d = 26 + ((i * 53) % 23) / 23 * 10;
                drawPerson(x, d, .16, '#c9393b', '#a62323', '#8fc76a', Math.abs(Math.sin(time * 6 + i)) * .06, false);
            }
            drawSquad(camZ, time, true);
            ctx.restore();
            return;
        }
        const items = [];
        for (const e of run.ents) {
            const d = e.z - camZ;
            if (d < (e.kind === 'crate' ? -1 : -6) || d > 70) continue;
            if (e.kind !== 'gate' && e.hp <= 0) continue;
            items.push({ d, e });
        }
        items.sort((a, b) => b.d - a.d);
        let squadDrawn = false;
        for (const it of items) {
            if (!squadDrawn && it.d < 0) { drawSquad(camZ, time, false); squadDrawn = true; }
            const e = it.e;
            if (e.kind === 'gate') drawGate(e, it.d);
            else if (e.kind === 'crate') drawCrate(e, it.d);
            else drawZombie(e, it.d, time);
        }
        if (!squadDrawn) drawSquad(camZ, time, false);
        // Bullets
        for (const b of run.bullets) {
            const d = b.z - camZ;
            const x = sx(b.x, d), y = sy(d) - unitPx(d) * .12;
            const y2 = sy(d - .8) - unitPx(d - .8) * .12;
            ctx.strokeStyle = b.color; ctx.lineWidth = Math.max(1.5, 4 * scaleAt(d)); ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(sx(b.x - b.vx * .02, d - .8), y2); ctx.stroke();
        }
        for (const k of run.rockets) {
            const d = k.z - camZ, u = unitPx(d);
            ctx.fillStyle = k.color; ctx.beginPath(); ctx.arc(sx(k.x, d), sy(d) - u * k.h, Math.max(3, u * .05), 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,220,150,.6)'; ctx.beginPath(); ctx.arc(sx(k.x, d - .5), sy(d - .5) - u * k.h, Math.max(2, u * .035), 0, Math.PI * 2); ctx.fill();
        }
        for (const p of run.fx) {
            const d = p.z - camZ, u = unitPx(d);
            ctx.globalAlpha = 1 - p.t / p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(sx(p.x, d), sy(d) - u * p.h, Math.max(1.5, u * (p.spark ? .05 : .03)), 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        for (const t of run.texts) {
            const d = t.z - camZ;
            ctx.globalAlpha = Math.min(1, 2 - t.t * 1.8);
            outlined(t.text, sx(t.x, d), sy(d) - unitPx(d) * .6 - t.t * 40, 22 * t.size, t.color);
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    // ---------- Loop ----------
    let hudT = 0;
    function loop(now) {
        rafId = requestAnimationFrame(loop);
        const time = now / 1000;
        if (mode !== 'run') { drawScene(time); return; }
        let dt = Math.min(.05, (now - lastT) / 1000);
        lastT = now;
        if (!run.paused) {
            // Fixed sub-steps keep collisions stable at low FPS.
            while (dt > 0 && mode === 'run') { const h = Math.min(1 / 90, dt); step(h); dt -= h; }
        }
        if (mode !== 'run') return;
        drawScene(time);
        hudT -= 1;
        if (hudT <= 0) {
            hudT = 6;
            $('run-fill').style.width = `${Math.min(100, run.z / (run.L - 13) * 100)}%`;
            $('res-gold').textContent = fmt(save$.r[0] + run.coins * lootMult());
        }
    }

    function endRun() {
        const won = run.won;
        run.shake = 0;
        const n = run.n;
        const gold = Math.round(run.coins * lootMult() + (won ? 20 + n * 6 : 0));
        const iron = Math.round(run.iron * lootMult());
        const food = Math.round(run.food * lootMult());
        let cmText = '0';
        let note = '';
        if (cheatsOn()) note = 'Hile açıkken ilerleme ve ödül kaydedilmez.';
        else {
            save$.r[0] += gold; save$.r[1] += iron; save$.r[2] += food;
            save$.k += run.kills;
            if (won && n === save$.st && save$.st < MAX_STAGE) save$.st += 1;
            persist();
            try {
                const res = Profile?.awardSonHatRun?.({ coins: gold, won });
                if (res?.reward) cmText = `+${fmt(res.reward)}`;
                else if (!Profile?.current?.()) note = 'CasualMoney kazanmak için ana sayfada oturum başlat.';
            } catch (_) {}
            if (typeof recordGameResult === 'function') recordGameResult('Son Hat', { won, score: n });
        }
        if (!note) note = won
            ? (isBossStage(n + 1) ? 'Sıradaki bölümde dev boss var. Üssünü ve kahramanlarını güçlendir!' : 'Ganimetle üssünü geliştir, madenlerini toplamayı unutma.')
            : 'Kırmızı kapıları vurup maviye çevir, sandıkları vurmadan geçme. Üs yükseltmeleri de güç katar.';
        mode = 'result';
        playStage = won ? Math.min(save$.st, n + 1) : n;
        const sheet = $('result').querySelector('.sheet');
        sheet.classList.toggle('lose', !won);
        $('result-eyebrow').textContent = `BÖLÜM ${n} · ${fmt(run.kills)} ZOMBİ`;
        $('result-title').textContent = won ? 'Zafer!' : 'Birlik düştü';
        $('result-gold').textContent = `+${fmt(gold)}`;
        $('result-iron').textContent = `+${fmt(iron)}`;
        $('result-food').textContent = `+${fmt(food)}`;
        $('result-cm').textContent = cmText;
        $('result-note').textContent = note;
        $('next-btn').querySelector('span').textContent = won ? 'SONRAKİ' : 'TEKRAR';
        $('result').classList.remove('hidden');
        $('next-btn').focus();
        renderMenus();
    }

    function hideOverlays() { $('pause').classList.add('hidden'); $('result').classList.add('hidden'); }

    function toMenu(tab = 'map') {
        mode = 'menu'; run = null;
        app.dataset.mode = 'menu';
        hideOverlays();
        showTab(tab);
        renderMenus();
    }

    function pause() {
        if (mode !== 'run' || run.over || run.paused) return;
        run.paused = true; $('pause').classList.remove('hidden'); $('resume-btn').focus();
    }
    function resume() {
        if (mode !== 'run') return;
        run.paused = false; lastT = performance.now(); $('pause').classList.add('hidden');
    }

    // ---------- Menus ----------
    let toastT = 0;
    function toast(text) { const el = $('toast'); el.textContent = text; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 1900); }
    let tab = 'map';
    let selectedTile = HQ_TILE;

    function showTab(next) {
        tab = next;
        for (const id of ['map', 'base', 'heroes']) $(`screen-${id}`).classList.toggle('hidden', id !== tab);
        for (const b of document.querySelectorAll('#tabbar button')) {
            b.classList.toggle('active', b.dataset.tab === tab);
            b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false');
        }
        renderMenus();
    }

    function guardCheats(text) {
        if (!cheatsOn()) return false;
        toast(text || 'Hile açıkken üs ve kahraman ilerlemesi kaydedilmez.');
        return true;
    }

    function el(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }

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
        const top = Math.min(MAX_STAGE, save$.st + 6);
        const path = $('map-path');
        path.innerHTML = '';
        for (let i = 1; i <= top; i++) {
            if (i % 10 === 1) {
                const r = Math.min(REGIONS.length - 1, Math.floor((i - 1) / 10));
                path.appendChild(el('li', 'region-banner', `<span>Bölge ${r + 1} · ${REGIONS[r]}</span>`));
            }
            const li = el('li', 'node-row');
            const b = el('button', 'node' + (i < save$.st ? ' done' : i === save$.st ? ' current' : '') + (isBossStage(i) ? ' boss' : '') + (i === playStage ? ' selected' : ''));
            b.type = 'button';
            b.textContent = String(i);
            b.disabled = i > save$.st;
            b.setAttribute('aria-label', `Bölüm ${i}${isBossStage(i) ? ', dev boss' : ''}${i < save$.st ? ', geçildi' : i > save$.st ? ', kilitli' : ''}`);
            b.setAttribute('aria-pressed', String(i === playStage));
            b.addEventListener('click', () => { playStage = i; renderMap(); });
            li.appendChild(b);
            path.appendChild(li);
        }
        $('play-sub').textContent = `Bölüm ${playStage}${isBossStage(playStage) ? ' · Dev boss' : ''}`;
        requestAnimationFrame(() => {
            const sel = path.querySelector('.selected');
            if (sel) path.scrollTop = sel.offsetTop - path.clientHeight / 2 + sel.offsetHeight / 2;
        });
    }

    function buildingAt(tile) { return save$.b.find(b => b[1] === tile); }

    function renderBase() {
        const used = save$.b.length, limit = slotLimit();
        $('base-slots').textContent = `${used}/${limit} bina · Karargâh Sv ${hqLevel()}`;
        const ready = [0, 0, 0];
        for (const b of save$.b) { const def = BUILDINGS[b[0]]; if (def.prod != null) ready[def.prod] += pending(b); }
        const total = ready[0] + ready[1] + ready[2];
        const collect = $('collect-btn');
        collect.disabled = total < 1;
        collect.innerHTML = total < 1 ? 'Üretim sürüyor' : `Topla ${costHtml(ready)}`;
        const plot = $('plot');
        plot.innerHTML = '';
        for (let t = 0; t < GRID * GRID; t++) {
            const b = buildingAt(t);
            const tileBtn = el('button', 'tile' + (b ? ' built' : '') + (t === selectedTile ? ' selected' : ''));
            tileBtn.type = 'button';
            if (b) {
                const def = BUILDINGS[b[0]];
                const p = pending(b);
                tileBtn.innerHTML = `<span class="tile-ico" aria-hidden="true">${def.icon}</span><span class="tile-lv">${b[2]}</span>${p >= 1 ? `<span class="tile-ready ${RES[def.prod].id}" aria-hidden="true"></span>` : ''}`;
                tileBtn.setAttribute('aria-label', `${def.name}, seviye ${b[2]}${p >= 1 ? `, ${fmt(p)} ${RES[def.prod].name.toLowerCase()} hazır` : ''}`);
            } else {
                tileBtn.innerHTML = used < limit ? '<span class="tile-plus" aria-hidden="true">+</span>' : '';
                tileBtn.setAttribute('aria-label', used < limit ? 'Boş arsa, bina kur' : 'Boş arsa, Karargâh’ı yükselterek yer aç');
            }
            tileBtn.addEventListener('click', () => {
                if (b && BUILDINGS[b[0]].prod != null && pending(b) >= 1) collectOne(b);
                selectedTile = t; renderBase();
            });
            plot.appendChild(tileBtn);
        }
        renderTilePanel();
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
        renderTop();
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
            panel.appendChild(el('div', 'tp-head', `<span class="card-ico" aria-hidden="true">${def.icon}</span><div><h3>${def.name}</h3><span class="lvl">Seviye ${lvl}</span></div>`));
            panel.appendChild(el('p', '', def.desc(lvl)));
            if (def.prod != null) panel.appendChild(el('p', 'muted', `Depoda ${fmt(pending(b))} ${RES[def.prod].name.toLowerCase()} · en fazla ${storageMinutes()} dakikalık üretim`));
            panel.appendChild(el('p', 'next', maxed ? (def.id === 'hq' ? 'En üst seviye.' : 'Önce Karargâh’ı yükselt.') : `Sonraki seviye: ${def.desc(lvl + 1)}`));
            if (!maxed) {
                const up = el('button', 'buy', `Yükselt ${costHtml(cost)}`);
                up.type = 'button';
                up.disabled = !canAfford(cost);
                up.setAttribute('aria-label', `${def.name} yükselt: ${costText(cost)}`);
                up.addEventListener('click', () => {
                    if (guardCheats() || !canAfford(cost)) return;
                    // Bank finished production before the level changes the rate.
                    if (def.prod != null) { const p = pending(b); save$.r[def.prod] += p; b[3] = now(); }
                    pay(cost); b[2] += 1; persist();
                    toast(`${def.name} seviye ${b[2]}!`);
                    renderBase();
                });
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
            const btn = el('button', 'buy', locked || full ? (locked ? 'Kilitli' : 'Dolu') : `Kur ${costHtml(cost)}`);
            btn.type = 'button';
            btn.disabled = locked || full || !canAfford(cost);
            btn.setAttribute('aria-label', locked || full ? `${def.name}: ${locked ? 'kilitli' : 'sınırda'}` : `${def.name} kur: ${costText(cost)}`);
            btn.addEventListener('click', () => {
                if (guardCheats() || btn.disabled) return;
                pay(cost);
                save$.b.push([idx, selectedTile, 1, now()]);
                persist();
                toast(`${def.name} kuruldu!`);
                renderBase();
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
        got.forEach((v, i) => { save$.r[i] += v; });
        persist();
        toast(`Toplandı: ${costText(got)}`);
        renderBase();
    }

    function heroCard(i, compact) {
        const h = HEROES[i], lvl = save$.h[i];
        const br = BRANCHES[h.branch], rar = RARITY[h.rarity];
        const owned = lvl > 0;
        const card = el('article', 'hero-card' + (owned ? '' : ' locked') + (save$.tm.includes(i) ? ' in-team' : ''));
        card.style.setProperty('--rar', rar.color);
        card.innerHTML = `<div class="hero-face" aria-hidden="true" style="--br:${br.color}"><span>${owned ? br.icon : '?'}</span></div>
            <div class="hero-info"><h3>${owned ? h.name : '???'}</h3><span class="lvl">${rar.name} · ${br.name}${owned ? ` · Sv ${lvl}` : ''}</span>${compact ? '' : `<p>${owned ? heroSkill(i, lvl) : 'Kahraman çağırarak bulunur.'}</p>`}</div>`;
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
        rec.innerHTML = `Kahraman çağır <span class="cost gold"><i aria-hidden="true"></i>${fmt(RECRUIT_COST)}</span>`;
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
                const t = el('button', 'buy blue', inTeam ? 'Takımdan çıkar' : 'Takıma al');
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
                const up = el('button', 'buy', maxed ? 'En üst seviye' : `Eğit ${costHtml(cost)}`);
                up.type = 'button';
                up.disabled = maxed || !canAfford(cost);
                up.setAttribute('aria-label', maxed ? `${h.name} en üst seviyede` : `${h.name} eğit: ${costText(cost)}`);
                up.addEventListener('click', () => {
                    if (guardCheats() || maxed || !canAfford(cost)) return;
                    pay(cost); save$.h[i] += 1; persist(); toast(`${h.name} seviye ${save$.h[i]}!`); renderHeroes();
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
        renderBase();
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
    window.addEventListener('keydown', e => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        if (keyMap[e.key] && mode === 'run') { keys.add(keyMap[e.key]); e.preventDefault(); }
        if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && mode === 'run') { run.paused ? resume() : pause(); e.preventDefault(); }
    });
    window.addEventListener('keyup', e => { if (keyMap[e.key]) keys.delete(keyMap[e.key]); });
    window.addEventListener('blur', () => { keys.clear(); pause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

    for (const b of document.querySelectorAll('#tabbar button')) b.addEventListener('click', () => showTab(b.dataset.tab));
    $('play-btn').addEventListener('click', () => startRun(playStage));
    $('pause-btn').addEventListener('click', pause);
    $('resume-btn').addEventListener('click', resume);
    $('quit-btn').addEventListener('click', () => {
        if (run && !run.over) { run.won = false; run.over = true; endRun(); return; }
        toMenu('map');
    });
    $('next-btn').addEventListener('click', () => startRun(playStage));
    $('base-btn').addEventListener('click', () => toMenu('base'));
    $('collect-btn').addEventListener('click', collectAll);
    $('recruit-btn').addEventListener('click', recruit);
    $('reveal-ok').addEventListener('click', () => { $('reveal').classList.add('hidden'); $('recruit-btn').focus(); });
    $('result').addEventListener('click', e => { if (e.target === $('result')) toMenu('map'); });

    window.addEventListener('resize', resize);
    resize();
    renderMenus();
    rafId = requestAnimationFrame(loop);
    // Exposed for automated checks; not part of gameplay.
    window.__sonHat = { state: () => run, save: () => save$, start: startRun };
})();
