(() => {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const canvas = $('board');
    const ctx = canvas.getContext('2d');
    const stage = $('stage');

    const W = 540;
    const H = 780;
    const N = 9;
    const CELL = 56;
    const BX = (W - CELL * N) / 2;
    const BY = 22;
    const BOARD = CELL * N;
    const TRAY_Y = BY + BOARD + 24;
    const TRAY_H = H - TRAY_Y - 18;
    const SLOT_W = W / 3;
    const TRAY_CELL = 32;
    const TOUCH_LIFT = 46;
    const CLEAR_POINTS = 18;
    const STREAK_GRACE = 3;
    const BEST_COOKIE = 'cp_blocks_best';

    /* Visual palettes live with the renderer; names and prices come from CasualProfile.woods. */
    const palettes = {
        pine: { light: '#f6d9a4', base: '#e0b06c', dark: '#b07a3a', edge: '#8c5c27', grain: 'rgba(140, 86, 34, .28)' },
        walnut: { light: '#b98458', base: '#8a5a36', dark: '#5c3820', edge: '#432614', grain: 'rgba(40, 20, 8, .32)' },
        cherry: { light: '#e48f6f', base: '#bb5638', dark: '#843220', edge: '#5f2214', grain: 'rgba(80, 22, 10, .3)' },
        ebony: { light: '#6a5d56', base: '#3d3431', dark: '#231d1b', edge: '#c9a25a', grain: 'rgba(201, 162, 90, .22)' }
    };

    /* Shape families: each orientation of a family shares its weight. */
    const families = [
        { weight: 2, rows: ['#'] },
        { weight: 3, rows: ['##'] },
        { weight: 3, rows: ['###'] },
        { weight: 2, rows: ['####'] },
        { weight: 1.4, rows: ['#####'] },
        { weight: 2.6, rows: ['##', '##'] },
        { weight: 3, rows: ['##', '#.'] },
        { weight: 2, rows: ['#.', '#.', '##'] },
        { weight: 2, rows: ['.#', '.#', '##'] },
        { weight: 2, rows: ['###', '.#.'] },
        { weight: 1.4, rows: ['.##', '##.'] },
        { weight: 1.4, rows: ['##.', '.##'] },
        { weight: 1.5, rows: ['#..', '#..', '###'] },
        { weight: .8, rows: ['.#.', '###', '.#.'] },
        { weight: 1, rows: ['#.#', '###'] },
        { weight: 1, rows: ['#.', '.#'] },
        { weight: .6, rows: ['#..', '.#.', '..#'] },
        { weight: .8, rows: ['##', '##', '##'] },
        { weight: .45, rows: ['###', '###', '###'] }
    ];

    function normalize(cells) {
        const minR = Math.min(...cells.map(([r]) => r));
        const minC = Math.min(...cells.map(([, c]) => c));
        return cells.map(([r, c]) => [r - minR, c - minC]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    }

    function makeShape(cells) {
        const norm = normalize(cells);
        return { cells: norm, h: Math.max(...norm.map(([r]) => r)) + 1, w: Math.max(...norm.map(([, c]) => c)) + 1 };
    }

    const shapeFamilies = families.map((family) => {
        let cells = [];
        family.rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') cells.push([r, c]); }));
        const seen = new Map();
        for (let i = 0; i < 4; i += 1) {
            const key = JSON.stringify(normalize(cells));
            if (!seen.has(key)) seen.set(key, makeShape(cells));
            cells = cells.map(([r, c]) => [c, -r]);
        }
        return { weight: family.weight, shapes: [...seen.values()] };
    });
    const totalWeight = shapeFamilies.reduce((sum, family) => sum + family.weight, 0);

    let mode = 'menu';
    let grid = emptyGrid();
    let tray = [null, null, null];
    let score = 0;
    let best = Number(getCookieValue(BEST_COOKIE)) || 0;
    let streak = 0;
    let grace = 0;
    let drag = null;
    let keyPick = null;
    let clearing = [];
    let pops = [];
    let floaters = [];
    let overTimer = 0;
    let overAt = 0;
    let previewWood = null;
    let currentWood = 'pine';
    let toastTimer = 0;
    let audio = null;

    function emptyGrid() { return Array.from({ length: N }, () => new Array(N).fill(0)); }
    function cheats() { return window.CasualCheats; }
    function cheatOn(name) { const c = cheats(); return Boolean(c && typeof c[name] === 'function' && c[name]()); }

    function toast(message) {
        const el = $('toast');
        el.textContent = message;
        el.classList.add('show');
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => el.classList.remove('show'), 2400);
    }

    function sound(freq, duration = .08, type = 'sine', slide = 0) {
        if (window.CasualSettings && !CasualSettings.get().sound) return;
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            audio ||= new Ctx();
            if (audio.state === 'suspended') audio.resume();
            const osc = audio.createOscillator();
            const gain = audio.createGain();
            const now = audio.currentTime;
            osc.type = type;
            osc.frequency.setValueAtTime(freq, now);
            if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), now + duration);
            gain.gain.setValueAtTime(.06, now);
            gain.gain.exponentialRampToValueAtTime(.001, now + duration);
            osc.connect(gain);
            gain.connect(audio.destination);
            osc.start(now);
            osc.stop(now + duration);
        } catch (_) { /* audio is optional */ }
    }

    /* ---------- Woods ---------- */

    function catalog() { return Object.values(CasualProfile.woods); }
    function allOpen() { return cheatOn('features'); }

    function ownedIds(profile) {
        if (allOpen()) return catalog().map((wood) => wood.id);
        return profile?.ownedWoods || ['pine'];
    }

    function resolveWood(profile) {
        const id = previewWood || profile?.selectedWood || 'pine';
        currentWood = palettes[id] ? id : 'pine';
        return currentWood;
    }

    function renderSession(profile) {
        const line = $('session-line');
        line.replaceChildren();
        const text = document.createElement('span');
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
        text.textContent = 'Oturum kapalı · CM kazanmak ve ahşap almak için aç.';
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Oturumu başlat';
        button.addEventListener('click', () => {
            const result = CasualProfile.startSession();
            toast(result.granted ? `Oturum açıldı, +${result.reward} CM kazandın.` : 'Oturumun açık.');
        });
        line.append(text, button);
    }

    function renderWoods() {
        const profile = CasualProfile.current();
        const owned = ownedIds(profile);
        const selected = resolveWood(profile);
        const balance = profile?.balance || 0;
        const list = $('wood-grid');
        list.replaceChildren();
        catalog().forEach((wood) => {
            const isOwned = owned.includes(wood.id);
            const card = document.createElement('article');
            card.className = `wood-card${wood.id === selected ? ' active' : ''}${isOwned ? '' : ' locked'}${!isOwned && balance < wood.price ? ' poor' : ''}`;
            const preview = document.createElement('canvas');
            drawPreview(preview, wood.id);
            const name = document.createElement('strong');
            name.textContent = wood.name;
            const description = document.createElement('small');
            description.textContent = wood.description;
            const button = document.createElement('button');
            button.type = 'button';
            if (wood.id === selected) {
                button.textContent = 'Seçili';
                button.disabled = true;
            } else if (isOwned) {
                button.textContent = allOpen() ? 'Önizle' : 'Seç';
                button.setAttribute('aria-label', `${wood.name} ahşabını seç`);
                button.addEventListener('click', () => chooseWood(wood));
            } else {
                button.textContent = `${CasualProfile.formatMoney(wood.price)} CM`;
                button.setAttribute('aria-label', `${wood.name} ahşabını ${CasualProfile.formatMoney(wood.price)} CasualMoney karşılığında aç`);
                button.addEventListener('click', () => purchaseWood(wood));
            }
            card.append(preview, name, description, button);
            list.append(card);
        });
        $('wood-count').textContent = `${owned.length} / ${catalog().length}`;
        $('balance').textContent = CasualProfile.formatMoney(balance);
        renderSession(profile);
    }

    function chooseWood(wood) {
        if (allOpen()) {
            previewWood = wood.id;
            toast(`${wood.name} önizlemesi · kaydedilmez.`);
            renderWoods();
            return;
        }
        try {
            CasualProfile.selectWood(wood.id);
            toast(`${wood.name} seçildi.`);
        } catch (error) { toast(error.message); }
    }

    function purchaseWood(wood) {
        if (!CasualProfile.current()) { toast('Ahşap almak için önce oturumu başlat.'); return; }
        try {
            CasualProfile.buyWood(wood.id);
            sound(660, .18, 'triangle', 440);
            toast(`${wood.name} açıldı ve seçildi.`);
        } catch (error) { toast(error.message); }
    }

    /* ---------- Drawing ---------- */

    function roundRect(c, x, y, w, h, r) {
        c.beginPath();
        c.moveTo(x + r, y);
        c.arcTo(x + w, y, x + w, y + h, r);
        c.arcTo(x + w, y + h, x, y + h, r);
        c.arcTo(x, y + h, x, y, r);
        c.arcTo(x, y, x + w, y, r);
        c.closePath();
    }

    /* Grain is seeded by the block position so it does not shimmer between frames. */
    function drawBlock(c, x, y, size, woodId, alpha = 1, seed = 0) {
        const p = palettes[woodId] || palettes.pine;
        const pad = Math.max(1, size * .045);
        const s = size - pad * 2;
        const r = Math.max(2, s * .14);
        const left = x + pad;
        const top = y + pad;
        c.save();
        c.globalAlpha = alpha;
        const fill = c.createLinearGradient(left, top, left + s, top + s);
        fill.addColorStop(0, p.light);
        fill.addColorStop(.45, p.base);
        fill.addColorStop(1, p.dark);
        roundRect(c, left, top, s, s, r);
        c.fillStyle = fill;
        c.fill();
        c.clip();
        c.strokeStyle = p.grain;
        c.lineWidth = Math.max(1, s * .035);
        for (let i = 0; i < 3; i += 1) {
            const offset = ((seed * 37 + i * 53) % 100) / 100;
            const gy = top + s * (.2 + i * .3) + (offset - .5) * s * .12;
            c.beginPath();
            c.moveTo(left - 2, gy);
            c.bezierCurveTo(left + s * .3, gy - s * .1 * (offset + .4), left + s * .65, gy + s * .1, left + s + 2, gy - s * .03);
            c.stroke();
        }
        c.restore();
        c.save();
        c.globalAlpha = alpha;
        roundRect(c, left + .5, top + .5, s - 1, s - 1, r);
        c.lineWidth = Math.max(1, s * .04);
        c.strokeStyle = p.edge;
        c.stroke();
        c.beginPath();
        c.moveTo(left + r, top + s * .09);
        c.lineTo(left + s - r, top + s * .09);
        c.strokeStyle = 'rgba(255, 255, 255, .28)';
        c.stroke();
        c.restore();
    }

    function drawPreview(target, woodId) {
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        target.width = Math.round(56 * ratio);
        target.height = Math.round(56 * ratio);
        const c = target.getContext('2d');
        c.setTransform(ratio, 0, 0, ratio, 0, 0);
        [[0, 0], [0, 1], [1, 0], [1, 1]].forEach(([r, col], i) => drawBlock(c, 4 + col * 24, 4 + r * 24, 24, woodId, 1, i + 3));
    }

    function drawBoard() {
        roundRect(ctx, BX - 8, BY - 8, BOARD + 16, BOARD + 16, 16);
        ctx.fillStyle = '#5a3a22';
        ctx.fill();
        for (let br = 0; br < 3; br += 1) {
            for (let bc = 0; bc < 3; bc += 1) {
                ctx.fillStyle = (br + bc) % 2 ? '#e9d3ab' : '#f3e3c3';
                ctx.fillRect(BX + bc * CELL * 3, BY + br * CELL * 3, CELL * 3, CELL * 3);
            }
        }
        ctx.strokeStyle = 'rgba(120, 82, 44, .22)';
        ctx.lineWidth = 1;
        for (let i = 1; i < N; i += 1) {
            if (i % 3 === 0) continue;
            ctx.beginPath();
            ctx.moveTo(BX + i * CELL + .5, BY);
            ctx.lineTo(BX + i * CELL + .5, BY + BOARD);
            ctx.moveTo(BX, BY + i * CELL + .5);
            ctx.lineTo(BX + BOARD, BY + i * CELL + .5);
            ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(90, 58, 34, .55)';
        ctx.lineWidth = 2;
        for (let i = 3; i < N; i += 3) {
            ctx.beginPath();
            ctx.moveTo(BX + i * CELL, BY);
            ctx.lineTo(BX + i * CELL, BY + BOARD);
            ctx.moveTo(BX, BY + i * CELL);
            ctx.lineTo(BX + BOARD, BY + i * CELL);
            ctx.stroke();
        }
    }

    function cellSeed(r, c) { return r * 9 + c * 4 + 1; }

    function drawCells(now) {
        for (let r = 0; r < N; r += 1) {
            for (let c = 0; c < N; c += 1) {
                if (!grid[r][c]) continue;
                const pop = pops.find((item) => item.r === r && item.c === c);
                let scale = 1;
                if (pop) scale = .82 + .18 * Math.min(1, (now - pop.at) / 140);
                const size = CELL * scale;
                const off = (CELL - size) / 2;
                drawBlock(ctx, BX + c * CELL + off, BY + r * CELL + off, size, currentWood, 1, cellSeed(r, c));
            }
        }
        clearing.forEach((item) => {
            const t = Math.min(1, (now - item.at - item.delay) / 260);
            if (t < 0) {
                drawBlock(ctx, BX + item.c * CELL, BY + item.r * CELL, CELL, currentWood, 1, cellSeed(item.r, item.c));
                return;
            }
            const size = CELL * (1 - t * .7);
            const off = (CELL - size) / 2;
            drawBlock(ctx, BX + item.c * CELL + off, BY + item.r * CELL + off, size, currentWood, 1 - t, cellSeed(item.r, item.c));
        });
    }

    function placementPreview() {
        if (drag && drag.target) return { piece: tray[drag.slot], ...drag.target };
        if (keyPick && tray[keyPick.slot]) {
            const piece = tray[keyPick.slot];
            return { piece, r: keyPick.r, c: keyPick.c, valid: canPlace(piece, keyPick.r, keyPick.c), keyboard: true };
        }
        return null;
    }

    function drawGhost() {
        const preview = placementPreview();
        if (!preview) return;
        const { piece, r, c, valid } = preview;
        if (valid) {
            const lines = completedGroups(piece, r, c);
            ctx.fillStyle = 'rgba(255, 214, 102, .38)';
            lines.cells.forEach((key) => {
                const [lr, lc] = key.split(',').map(Number);
                ctx.fillRect(BX + lc * CELL, BY + lr * CELL, CELL, CELL);
            });
            piece.cells.forEach(([dr, dc]) => drawBlock(ctx, BX + (c + dc) * CELL, BY + (r + dr) * CELL, CELL, currentWood, .45, cellSeed(r + dr, c + dc)));
        } else if (preview.keyboard) {
            piece.cells.forEach(([dr, dc]) => {
                const rr = r + dr;
                const cc = c + dc;
                if (rr < 0 || cc < 0 || rr >= N || cc >= N) return;
                ctx.fillStyle = 'rgba(214, 64, 52, .35)';
                ctx.fillRect(BX + cc * CELL, BY + rr * CELL, CELL, CELL);
            });
        }
    }

    function slotCenter(slot) {
        return { x: SLOT_W * slot + SLOT_W / 2, y: TRAY_Y + TRAY_H / 2 };
    }

    function drawTray() {
        roundRect(ctx, 10, TRAY_Y - 6, W - 20, TRAY_H + 6, 18);
        ctx.fillStyle = 'rgba(255, 236, 205, .07)';
        ctx.fill();
        tray.forEach((piece, slot) => {
            if (!piece) return;
            if (drag && drag.slot === slot) return;
            const center = slotCenter(slot);
            const fits = pieceFitsAnywhere(piece);
            const selected = keyPick && keyPick.slot === slot;
            if (selected) {
                roundRect(ctx, SLOT_W * slot + 14, TRAY_Y + 2, SLOT_W - 28, TRAY_H - 10, 14);
                ctx.strokeStyle = 'rgba(255, 214, 102, .85)';
                ctx.lineWidth = 3;
                ctx.stroke();
            }
            const x0 = center.x - piece.w * TRAY_CELL / 2;
            const y0 = center.y - piece.h * TRAY_CELL / 2;
            piece.cells.forEach(([r, c]) => drawBlock(ctx, x0 + c * TRAY_CELL, y0 + r * TRAY_CELL, TRAY_CELL, currentWood, fits ? 1 : .32, cellSeed(r, c) + slot));
            ctx.fillStyle = 'rgba(255, 236, 205, .35)';
            ctx.font = '700 13px Outfit, system-ui, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(String(slot + 1), SLOT_W * slot + 22, TRAY_Y + 8);
        });
    }

    function drawDragged() {
        if (!drag) return;
        const piece = tray[drag.slot];
        const size = drag.size;
        const x0 = drag.x - piece.w * size / 2;
        const y0 = drag.y - piece.h * size / 2;
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, .35)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 8;
        piece.cells.forEach(([r, c]) => drawBlock(ctx, x0 + c * size, y0 + r * size, size, currentWood, 1, cellSeed(r, c)));
        ctx.restore();
    }

    function drawFloaters(now) {
        floaters = floaters.filter((item) => now - item.at < 1100);
        floaters.forEach((item) => {
            const t = (now - item.at) / 1100;
            ctx.save();
            ctx.globalAlpha = 1 - t * t;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `800 ${item.size}px Outfit, system-ui, sans-serif`;
            ctx.lineWidth = 5;
            ctx.strokeStyle = 'rgba(58, 32, 12, .85)';
            const y = item.y - t * 46;
            ctx.strokeText(item.text, item.x, y);
            ctx.fillStyle = item.color;
            ctx.fillText(item.text, item.x, y);
            ctx.restore();
        });
    }

    function render(now) {
        ctx.clearRect(0, 0, W, H);
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#4a2f1c');
        bg.addColorStop(1, '#2e1c10');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);
        drawBoard();
        drawCells(now);
        drawGhost();
        drawTray();
        drawDragged();
        drawFloaters(now);
    }

    /* ---------- Rules ---------- */

    function canPlace(piece, r, c) {
        if (!piece) return false;
        return piece.cells.every(([dr, dc]) => {
            const rr = r + dr;
            const cc = c + dc;
            return rr >= 0 && cc >= 0 && rr < N && cc < N && !grid[rr][cc];
        });
    }

    function pieceFitsAnywhere(piece) {
        for (let r = 0; r <= N - piece.h; r += 1) {
            for (let c = 0; c <= N - piece.w; c += 1) {
                if (canPlace(piece, r, c)) return true;
            }
        }
        return false;
    }

    /* Rows, columns and 3x3 boxes that would be full after placing (or already are). */
    function fullGroups(cells) {
        const filled = (r, c) => grid[r][c] || cells.has(`${r},${c}`);
        const groups = [];
        for (let i = 0; i < N; i += 1) {
            const row = [];
            const col = [];
            for (let j = 0; j < N; j += 1) { row.push([i, j]); col.push([j, i]); }
            if (row.every(([r, c]) => filled(r, c))) groups.push(row);
            if (col.every(([r, c]) => filled(r, c))) groups.push(col);
        }
        for (let br = 0; br < 3; br += 1) {
            for (let bc = 0; bc < 3; bc += 1) {
                const box = [];
                for (let r = 0; r < 3; r += 1) for (let c = 0; c < 3; c += 1) box.push([br * 3 + r, bc * 3 + c]);
                if (box.every(([r, c]) => filled(r, c))) groups.push(box);
            }
        }
        const all = new Set();
        groups.forEach((group) => group.forEach(([r, c]) => all.add(`${r},${c}`)));
        return { count: groups.length, cells: all };
    }

    function completedGroups(piece, r, c) {
        return fullGroups(new Set(piece.cells.map(([dr, dc]) => `${r + dr},${c + dc}`)));
    }

    function randomPiece() {
        let roll = Math.random() * totalWeight;
        let family = shapeFamilies[shapeFamilies.length - 1];
        for (const item of shapeFamilies) {
            roll -= item.weight;
            if (roll <= 0) { family = item; break; }
        }
        return family.shapes[Math.floor(Math.random() * family.shapes.length)];
    }

    /* A fresh hand is re-rolled a few times so at least one piece fits when that is possible. */
    function dealTray(forceFit) {
        let hand = [];
        for (let attempt = 0; attempt < (forceFit ? 200 : 25); attempt += 1) {
            hand = [randomPiece(), randomPiece(), randomPiece()];
            // A single block always fits: a board with no empty cell would already have cleared.
            if (forceFit && attempt > 100) hand[0] = shapeFamilies[0].shapes[0];
            if (hand.some(pieceFitsAnywhere)) break;
        }
        tray = hand;
    }

    function addScore(points, x, y, text, color = '#ffe08a', size = 26) {
        score += points;
        floaters.push({ text: text || `+${points}`, x, y, at: performance.now(), color, size });
        updateHud();
    }

    function place(slot, r, c) {
        const piece = tray[slot];
        if (!canPlace(piece, r, c)) return false;
        const now = performance.now();
        const groups = completedGroups(piece, r, c);
        piece.cells.forEach(([dr, dc]) => {
            grid[r + dr][c + dc] = 1;
            pops.push({ r: r + dr, c: c + dc, at: now });
        });
        tray[slot] = null;
        if (keyPick && keyPick.slot === slot) keyPick = null;
        let gained = piece.cells.length;
        const centerX = BX + (c + piece.w / 2) * CELL;
        const centerY = BY + (r + piece.h / 2) * CELL;
        if (groups.count) {
            streak += 1;
            grace = STREAK_GRACE;
            const base = CLEAR_POINTS * groups.count + 10 * groups.count * (groups.count - 1);
            const bonus = Math.floor(base * (1 + (streak - 1) * .5));
            gained += bonus;
            let order = 0;
            groups.cells.forEach((key) => {
                const [cr, cc] = key.split(',').map(Number);
                grid[cr][cc] = 0;
                clearing.push({ r: cr, c: cc, at: now, delay: (order += 1) * 6 });
            });
            const label = groups.count > 1 ? `Kombo x${groups.count}` : 'Temiz!';
            addScore(gained, centerX, centerY, `+${gained}`, '#ffe08a', 30);
            floaters.push({ text: streak > 1 ? `${label} · Seri ${streak}` : label, x: W / 2, y: BY + BOARD / 2, at: now, color: '#fff3d6', size: 34 });
            sound(520 + Math.min(groups.count, 4) * 90, .22, 'triangle', 380);
        } else {
            if (grace > 0) grace -= 1;
            if (grace === 0) streak = 0;
            addScore(gained, centerX, centerY, `+${gained}`, '#fff3d6', 20);
            sound(300, .06, 'square', -60);
        }
        if (tray.every((item) => !item)) dealTray(false);
        checkStuck();
        return true;
    }

    function checkStuck() {
        const left = tray.filter(Boolean);
        if (left.some(pieceFitsAnywhere)) return;
        if (cheatOn('immortal')) {
            dealTray(true);
            toast('Ölümsüzlük · parçalar yenilendi.');
            return;
        }
        mode = 'ending';
        keyPick = null;
        window.clearTimeout(overTimer);
        overTimer = window.setTimeout(finish, 700);
    }

    /* ---------- Flow ---------- */

    function formatScore(value) {
        return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2))).replace('.', ',');
    }

    function updateHud() {
        $('score').textContent = formatScore(score);
        $('best').textContent = String(best);
    }

    function resetRun() {
        window.clearTimeout(overTimer);
        grid = emptyGrid();
        score = 0;
        streak = 0;
        grace = 0;
        drag = null;
        keyPick = null;
        clearing = [];
        pops = [];
        floaters = [];
        dealTray(false);
        updateHud();
    }

    function showMenu() {
        mode = 'menu';
        resetRun();
        $('over').classList.add('hidden');
        $('stage-hint').classList.add('hidden');
        $('menu').classList.remove('hidden');
        renderWoods();
    }

    function startRun() {
        resetRun();
        mode = 'playing';
        $('menu').classList.add('hidden');
        $('over').classList.add('hidden');
        const hint = $('stage-hint');
        hint.classList.remove('hidden');
        hint.style.animation = 'none';
        void hint.offsetWidth;
        hint.style.animation = '';
        stage.focus({ preventScroll: true });
    }

    function finish() {
        mode = 'over';
        overAt = performance.now();
        const cheating = cheatOn('active');
        const finalScore = Math.floor(score);
        let reward = 0;
        let note = '';
        if (!cheating && finalScore > best) {
            best = finalScore;
            setCookieValue(BEST_COOKIE, String(best));
            note = 'Yeni rekor! ';
        }
        if (cheating) {
            note += 'Hile açık · skor ve CM kaydedilmedi.';
        } else if (!CasualProfile.current()) {
            note += 'Oturum kapalı · CM kazanmak için menüden oturumu başlat.';
        } else {
            reward = CasualProfile.awardBlocksGame({ score: finalScore }).reward;
            if (!reward) note += `CM için en az ${CasualProfile.BLOCKS_POINTS_PER_CM} puan topla.`;
            else if (CasualProfile.blocksRewardForScore(finalScore) >= CasualProfile.BLOCKS_REWARD_CAP) note += 'Oyun başına ödül sınırına ulaştın.';
            else note += 'Kazanç profiline eklendi.';
        }
        if (typeof recordGameResult === 'function') recordGameResult('Wood Blocks', { won: finalScore >= 1000, score: finalScore });
        $('over-score').textContent = formatScore(score);
        $('over-best').textContent = String(best);
        $('over-reward').textContent = `+${CasualProfile.formatMoney(reward)} CM`;
        $('over-note').textContent = note.trim();
        $('stage-hint').classList.add('hidden');
        $('over').classList.remove('hidden');
        updateHud();
        renderWoods();
        $('retry-btn').focus({ preventScroll: true });
    }

    function frame(now) {
        clearing = clearing.filter((item) => now - item.at - item.delay < 260);
        pops = pops.filter((item) => now - item.at < 140);
        render(now);
        requestAnimationFrame(frame);
    }

    function fitCanvas() {
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        const width = Math.round(W * ratio);
        if (canvas.width !== width) {
            canvas.width = width;
            canvas.height = Math.round(H * ratio);
        }
        ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    }

    /* ---------- Input ---------- */

    function toLogical(event) {
        const rect = canvas.getBoundingClientRect();
        return { x: (event.clientX - rect.left) * W / rect.width, y: (event.clientY - rect.top) * H / rect.height };
    }

    function dragTarget() {
        const piece = tray[drag.slot];
        const left = drag.x - piece.w * CELL / 2;
        const top = drag.y - piece.h * CELL / 2;
        const c = Math.round((left - BX) / CELL);
        const r = Math.round((top - BY) / CELL);
        drag.target = canPlace(piece, r, c) ? { r, c, valid: true } : null;
    }

    function moveDrag(point) {
        drag.x = point.x + drag.dx;
        drag.y = point.y + drag.dy - drag.lift;
        dragTarget();
    }

    canvas.addEventListener('pointerdown', (event) => {
        if (mode !== 'playing' || drag) return;
        if (event.button !== undefined && event.button > 0) return;
        const point = toLogical(event);
        if (point.y < TRAY_Y - 10) return;
        const slot = Math.min(2, Math.max(0, Math.floor(point.x / SLOT_W)));
        if (!tray[slot]) return;
        event.preventDefault();
        canvas.setPointerCapture(event.pointerId);
        keyPick = null;
        const center = slotCenter(slot);
        const touch = event.pointerType !== 'mouse';
        drag = { slot, pointerId: event.pointerId, x: center.x, y: center.y, size: CELL, lift: touch ? TOUCH_LIFT + tray[slot].h * CELL / 2 : 0, dx: 0, dy: 0, target: null };
        // Mouse keeps the grab point under the cursor; touch lifts the piece above the finger.
        if (!touch) { drag.dx = (center.x - point.x) * CELL / TRAY_CELL; drag.dy = (center.y - point.y) * CELL / TRAY_CELL; }
        moveDrag(point);
        sound(420, .04, 'sine');
    });

    canvas.addEventListener('pointermove', (event) => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        event.preventDefault();
        moveDrag(toLogical(event));
    });

    function endDrag(event, cancelled) {
        if (!drag || event.pointerId !== drag.pointerId) return;
        const { slot, target } = drag;
        drag = null;
        if (!cancelled && target && mode === 'playing') place(slot, target.r, target.c);
    }

    canvas.addEventListener('pointerup', (event) => endDrag(event, false));
    canvas.addEventListener('pointercancel', (event) => endDrag(event, true));
    canvas.addEventListener('lostpointercapture', (event) => endDrag(event, true));

    function pickSlot(slot) {
        if (!tray[slot]) return;
        const piece = tray[slot];
        let r = Math.floor((N - piece.h) / 2);
        let c = Math.floor((N - piece.w) / 2);
        if (keyPick) { r = Math.min(keyPick.r, N - piece.h); c = Math.min(keyPick.c, N - piece.w); }
        keyPick = { slot, r, c };
    }

    window.addEventListener('keydown', (event) => {
        const target = event.target;
        if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
        if (mode === 'over') {
            if (target instanceof HTMLButtonElement) return;
            if (event.key === 'Enter' || event.code === 'Space') {
                event.preventDefault();
                if (performance.now() - overAt > 500) startRun();
            }
            return;
        }
        if (mode !== 'playing' || drag) return;
        if (/^Digit[123]$/.test(event.code) || /^Numpad[123]$/.test(event.code)) {
            event.preventDefault();
            pickSlot(Number(event.code.slice(-1)) - 1);
            return;
        }
        if (!keyPick) {
            if (event.key.startsWith('Arrow')) {
                const first = tray.findIndex(Boolean);
                if (first >= 0) { event.preventDefault(); pickSlot(first); }
            }
            return;
        }
        const piece = tray[keyPick.slot];
        const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
        if (moves[event.key]) {
            event.preventDefault();
            const [dr, dc] = moves[event.key];
            keyPick.r = Math.min(N - piece.h, Math.max(0, keyPick.r + dr));
            keyPick.c = Math.min(N - piece.w, Math.max(0, keyPick.c + dc));
        } else if (event.key === 'Enter' || event.code === 'Space') {
            if (target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement) return;
            event.preventDefault();
            if (!place(keyPick.slot, keyPick.r, keyPick.c)) { sound(160, .12, 'sawtooth'); return; }
            const next = tray.findIndex(Boolean);
            if (mode === 'playing' && next >= 0) pickSlot(next);
        } else if (event.key === 'Escape') {
            keyPick = null;
        } else if (event.key === 'Tab') {
            keyPick = null;
        }
    });

    $('start-btn').addEventListener('click', startRun);
    $('retry-btn').addEventListener('click', startRun);
    $('menu-btn').addEventListener('click', showMenu);

    window.addEventListener('casualprofilechange', () => {
        if (!allOpen()) previewWood = null;
        renderWoods();
    });
    window.addEventListener('casual-cheat', () => {
        if (!allOpen()) previewWood = null;
        renderWoods();
    });
    window.addEventListener('casual-cheat-set', (event) => {
        if (mode !== 'playing') return;
        score = Number(event.detail.n) || 0;
        updateHud();
    });
    window.setInterval(() => {
        if (mode !== 'playing' || !cheats()) return;
        const gain = cheats().tick();
        if (!gain) return;
        score = Number((score + gain).toFixed(3));
        updateHud();
    }, 1000);
    window.addEventListener('resize', fitCanvas);

    fitCanvas();
    showMenu();
    requestAnimationFrame(frame);

    window.WoodBlocksView = Object.freeze({
        state: () => ({ mode, score, streak, grid: grid.map((row) => row.slice()), tray: tray.map((p) => p && p.cells.map((cell) => cell.slice())) }),
        layout: { W, H, CELL, BX, BY, TRAY_Y, TRAY_H, SLOT_W }
    });
})();
