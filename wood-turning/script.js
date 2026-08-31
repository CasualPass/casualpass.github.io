document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    const canvas = document.getElementById('lathe-canvas');
    const ctx = canvas.getContext('2d');
    const targetCanvas = document.getElementById('target-canvas');
    const targetCtx = targetCanvas.getContext('2d');

    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;
    const CENTER_Y = 270;
    const PIECE_START = 135;
    const PIECE_END = 865;
    const SAMPLE_COUNT = 181;
    const MAX_RADIUS = 132;
    const MIN_RADIUS = 18;
    const WOOD_BASE = '#b87437';

    const tools = {
        rough: { radius: 12, strength: .54, edgeLift: 7 },
        detail: { radius: 4, strength: .72, edgeLift: 1 },
        round: { radius: 9, strength: .58, edgeLift: 12 }
    };

    const stageCopy = {
        carve: {
            kicker: 'AŞAMA 01 / 03',
            title: 'Formu ortaya çıkar.',
            description: 'Keskiyi ahşabın kenarına getirip hedef çizgisi boyunca sürükle.',
            next: 'Zımparaya geç',
            hint: 'Ahşabın üstünde basılı tut ve sürükle'
        },
        sand: {
            kicker: 'AŞAMA 02 / 03',
            title: 'Pürüzleri yumuşat.',
            description: 'Zımparayı yüzey boyunca gezdir; keskin geçişleri dengelerken tüm parçayı tara.',
            next: 'Boyamaya geç',
            hint: 'Zımparayı yüzey boyunca gezdir'
        },
        paint: {
            kicker: 'AŞAMA 03 / 03',
            title: 'İmzanı renkle at.',
            description: 'Paletinden bir renk seç ve parçanın yüzeyini tamamen boya.',
            next: 'Siparişi teslim et',
            hint: 'Seçili boyayı yüzeye uygula'
        }
    };

    function gaussian(t, center, width, height) {
        return height * Math.exp(-Math.pow((t - center) / width, 2));
    }

    const jobs = [
        {
            name: 'Nordik Vazo',
            client: 'Mina Kaya',
            initials: 'MK',
            note: 'Dengeli bir gövde ve ince bir boyun istiyorum.',
            profile(t) {
                return 29 + gaussian(t, .09, .11, 72) + gaussian(t, .36, .22, 70) + gaussian(t, .64, .12, 21) + gaussian(t, .9, .075, 30) + gaussian(t, .99, .025, 13);
            }
        },
        {
            name: 'Satranç Şahı',
            client: 'Baran Aksoy',
            initials: 'BA',
            note: 'Güçlü bir taban ve okunaklı bir taç profili olsun.',
            profile(t) {
                return 26 + gaussian(t, .1, .115, 86) + gaussian(t, .31, .095, 39) + gaussian(t, .55, .055, 25) + gaussian(t, .73, .075, 34) + gaussian(t, .91, .09, 45);
            }
        },
        {
            name: 'Masa Şamdanı',
            client: 'Lara Demir',
            initials: 'LD',
            note: 'İnce bir gövde, yumuşak boğumlar ve geniş bir ayak.',
            profile(t) {
                return 23 + gaussian(t, .08, .12, 92) + gaussian(t, .28, .055, 29) + gaussian(t, .48, .05, 21) + gaussian(t, .68, .055, 31) + gaussian(t, .91, .1, 57);
            }
        },
        {
            name: 'Çam Biblo',
            client: 'Efe Can',
            initials: 'EC',
            note: 'Katmanları belirgin, tepesi zarif bir çam ağacı arıyorum.',
            profile(t) {
                const tiers = gaussian(t, .18, .105, 88) + gaussian(t, .4, .09, 70) + gaussian(t, .61, .075, 53) + gaussian(t, .79, .06, 36);
                return 20 + tiers + gaussian(t, .94, .045, 15);
            }
        }
    ];

    const state = {
        stage: 'carve',
        jobIndex: -1,
        job: null,
        target: [],
        current: [],
        sandCoverage: [],
        paintCoverage: [],
        paintColors: [],
        roughness: [],
        particles: [],
        activeTool: 'rough',
        guestPaint: 'honey',
        pointer: { down: false, inside: false, x: 0, y: 0 },
        gestureUsed: false,
        stageSnapshot: null,
        completed: false,
        pendingResult: null,
        returnToResult: false,
        lastTime: performance.now()
    };

    const elements = {
        orderNumber: document.getElementById('order-number'),
        clientAvatar: document.getElementById('client-avatar'),
        clientName: document.getElementById('client-name'),
        targetName: document.getElementById('target-name'),
        targetNote: document.getElementById('target-note'),
        accuracyRing: document.getElementById('accuracy-ring'),
        accuracyValue: document.getElementById('accuracy-value'),
        accuracyLabel: document.getElementById('accuracy-label'),
        stageKicker: document.getElementById('stage-kicker'),
        stageTitle: document.getElementById('stage-title'),
        stageDescription: document.getElementById('stage-description'),
        gestureHint: document.getElementById('gesture-hint'),
        carveTools: document.getElementById('carve-tools'),
        sandTools: document.getElementById('sand-tools'),
        paintTools: document.getElementById('paint-tools'),
        nextStage: document.getElementById('next-stage'),
        resetStage: document.getElementById('reset-stage'),
        sandCoverage: document.getElementById('sand-coverage'),
        paintCoverage: document.getElementById('paint-coverage'),
        paintPalette: document.getElementById('paint-palette'),
        topBalance: document.getElementById('top-balance'),
        walletButton: document.getElementById('wallet-button'),
        compactAvatar: document.getElementById('compact-avatar'),
        compactName: document.getElementById('compact-name'),
        compactStatus: document.getElementById('compact-status'),
        profileAction: document.getElementById('profile-action'),
        officeName: document.getElementById('office-name'),
        officeMultiplier: document.getElementById('office-multiplier'),
        upgradeOffice: document.getElementById('upgrade-office'),
        upgradeCost: document.getElementById('upgrade-cost'),
        paintStoreList: document.getElementById('paint-store-list'),
        paintCount: document.getElementById('paint-count'),
        jobsCount: document.getElementById('jobs-count'),
        bestScore: document.getElementById('best-score'),
        totalEarned: document.getElementById('total-earned'),
        loginModal: document.getElementById('login-modal'),
        resultModal: document.getElementById('result-modal'),
        loginForm: document.getElementById('login-form'),
        loginError: document.getElementById('login-error'),
        username: document.getElementById('game-username'),
        resultScore: document.getElementById('result-score'),
        resultShape: document.getElementById('result-shape'),
        resultSand: document.getElementById('result-sand'),
        resultPaint: document.getElementById('result-paint'),
        rewardValue: document.getElementById('reward-value'),
        rewardMultiplier: document.getElementById('reward-multiplier'),
        guestWarning: document.getElementById('guest-warning'),
        confetti: document.getElementById('confetti'),
        toast: document.getElementById('game-toast')
    };

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function average(values) {
        return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    }

    function mix(a, b, amount) {
        return a + (b - a) * amount;
    }

    function formatMultiplier(value) {
        return `x${Number(value).toFixed(2).replace('.', ',')}`;
    }

    function initials(name) {
        return String(name || '?').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('tr-TR');
    }

    let toastTimer;
    function showToast(message) {
        elements.toast.textContent = message;
        elements.toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => elements.toast.classList.remove('show'), 2400);
    }

    function playSound(name) {
        if (typeof cpSettings === 'undefined' || !cpSettings.sound) return;
        const audio = document.getElementById(name === 'pop' ? 'global-pop-sound' : 'global-click-sound');
        if (!audio) return;
        audio.currentTime = 0;
        audio.volume = name === 'pop' ? .35 : .24;
        audio.play().catch(() => {});
    }

    function openModal(modal) {
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function closeModal(modal) {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        if (!document.querySelector('.modal-overlay.active')) document.body.style.overflow = '';
    }

    function sampleX(index) {
        return PIECE_START + (index / (SAMPLE_COUNT - 1)) * (PIECE_END - PIECE_START);
    }

    function buildTarget(job) {
        return Array.from({ length: SAMPLE_COUNT }, (_, index) => {
            const t = index / (SAMPLE_COUNT - 1);
            const raw = clamp(job.profile(t), MIN_RADIUS + 2, MAX_RADIUS - 8);
            const endTaper = clamp(Math.min(t / .025, (1 - t) / .025), 0, 1);
            return mix(42, raw, endTaper);
        });
    }

    function beginOrder(forceNext = false) {
        let nextIndex = Math.floor(Math.random() * jobs.length);
        if ((forceNext || jobs.length > 1) && nextIndex === state.jobIndex) nextIndex = (nextIndex + 1) % jobs.length;
        state.jobIndex = nextIndex;
        state.job = jobs[nextIndex];
        state.target = buildTarget(state.job);
        state.current = Array.from({ length: SAMPLE_COUNT }, (_, index) => {
            const edge = Math.min(index, SAMPLE_COUNT - 1 - index);
            return edge < 3 ? mix(42, MAX_RADIUS, edge / 3) : MAX_RADIUS;
        });
        state.sandCoverage = Array(SAMPLE_COUNT).fill(0);
        state.paintCoverage = Array(SAMPLE_COUNT).fill(0);
        state.paintColors = Array(SAMPLE_COUNT).fill(WOOD_BASE);
        state.roughness = Array.from({ length: SAMPLE_COUNT }, (_, index) => .45 + .16 * Math.sin(index * 2.37));
        state.particles = [];
        state.stageSnapshot = null;
        state.completed = false;
        state.pendingResult = null;
        state.gestureUsed = false;
        elements.gestureHint.classList.remove('hidden');

        const profile = CasualProfile.current();
        const orderNo = (profile?.woodTurning.jobs || 0) + 1;
        elements.orderNumber.textContent = `#${String(orderNo).padStart(3, '0')}`;
        elements.clientAvatar.textContent = state.job.initials;
        elements.clientName.textContent = state.job.client;
        elements.targetName.textContent = state.job.name;
        elements.targetNote.textContent = state.job.note;
        setStage('carve');
        drawTargetPreview();
        updateMetrics();
    }

    function profilePath(context, values, centerY = CENTER_Y, xStart = PIECE_START, xEnd = PIECE_END, scale = 1) {
        context.beginPath();
        values.forEach((radius, index) => {
            const x = xStart + (index / (values.length - 1)) * (xEnd - xStart);
            const y = centerY - radius * scale;
            if (index === 0) context.moveTo(x, y);
            else context.lineTo(x, y);
        });
        for (let index = values.length - 1; index >= 0; index -= 1) {
            const x = xStart + (index / (values.length - 1)) * (xEnd - xStart);
            context.lineTo(x, centerY + values[index] * scale);
        }
        context.closePath();
    }

    function drawTargetPreview() {
        const w = targetCanvas.width;
        const h = targetCanvas.height;
        targetCtx.clearRect(0, 0, w, h);
        const gradient = targetCtx.createLinearGradient(0, 25, 0, h - 25);
        gradient.addColorStop(0, '#d9e0d4');
        gradient.addColorStop(.48, '#ffffff');
        gradient.addColorStop(1, '#8c9688');
        profilePath(targetCtx, state.target, h / 2, 22, w - 22, .46);
        targetCtx.fillStyle = gradient;
        targetCtx.fill();
        targetCtx.strokeStyle = 'rgba(185,255,102,.8)';
        targetCtx.lineWidth = 2;
        targetCtx.stroke();
        targetCtx.beginPath();
        targetCtx.moveTo(10, h / 2);
        targetCtx.lineTo(w - 10, h / 2);
        targetCtx.strokeStyle = 'rgba(255,255,255,.15)';
        targetCtx.setLineDash([4, 6]);
        targetCtx.stroke();
        targetCtx.setLineDash([]);
    }

    function shapeScore() {
        let absoluteError = 0;
        let overcut = 0;
        for (let index = 0; index < SAMPLE_COUNT; index += 1) {
            const difference = Math.abs(state.current[index] - state.target[index]);
            absoluteError += difference;
            overcut += Math.max(0, state.target[index] - state.current[index]);
        }
        const meanError = absoluteError / SAMPLE_COUNT;
        const meanOvercut = overcut / SAMPLE_COUNT;
        return clamp(Math.round(100 - meanError * .84 - meanOvercut * .72), 0, 100);
    }

    function sandScore() {
        return clamp(Math.round(average(state.sandCoverage) * 100), 0, 100);
    }

    function paintScore() {
        return clamp(Math.round(average(state.paintCoverage) * 100), 0, 100);
    }

    function overallScore() {
        return clamp(Math.round(shapeScore() * .82 + sandScore() * .1 + paintScore() * .08), 0, 100);
    }

    function accuracyCopy(score) {
        if (score >= 96) return 'Usta işi';
        if (score >= 88) return 'Neredeyse kusursuz';
        if (score >= 75) return 'İyi gidiyor';
        if (score >= 58) return 'Form belirginleşiyor';
        return 'Ham kütük';
    }

    function updateMetrics() {
        const shape = shapeScore();
        elements.accuracyValue.textContent = shape;
        elements.accuracyRing.style.setProperty('--score', shape);
        elements.accuracyLabel.textContent = accuracyCopy(shape);
        elements.sandCoverage.textContent = `${sandScore()}%`;
        elements.paintCoverage.textContent = `${paintScore()}%`;
    }

    function setStage(stage) {
        state.stage = stage;
        document.body.dataset.stage = stage;
        const copy = stageCopy[stage];
        elements.stageKicker.textContent = copy.kicker;
        elements.stageTitle.textContent = copy.title;
        elements.stageDescription.textContent = copy.description;
        elements.nextStage.querySelector('span').textContent = copy.next;
        elements.gestureHint.querySelector('p').textContent = copy.hint;
        elements.gestureHint.classList.remove('hidden');
        state.gestureUsed = false;

        elements.carveTools.hidden = stage !== 'carve';
        elements.sandTools.hidden = stage !== 'sand';
        elements.paintTools.hidden = stage !== 'paint';

        const order = ['carve', 'sand', 'paint'];
        const activeIndex = order.indexOf(stage);
        document.querySelectorAll('.stage-list li').forEach((item, index) => {
            item.classList.toggle('active', item.dataset.step === stage);
            item.classList.toggle('done', index < activeIndex);
        });

        renderPaintPalette();
        playSound('click');
    }

    function canvasPoint(event) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: ((event.clientX - rect.left) / rect.width) * WIDTH,
            y: ((event.clientY - rect.top) / rect.height) * HEIGHT
        };
    }

    function nearestIndex(x) {
        return Math.round(((x - PIECE_START) / (PIECE_END - PIECE_START)) * (SAMPLE_COUNT - 1));
    }

    function selectedPaint() {
        const profile = CasualProfile.current();
        const id = profile?.selectedPaint || state.guestPaint;
        return CasualProfile.paints[id] || CasualProfile.paints.honey;
    }

    function useTool(point) {
        const index = nearestIndex(point.x);
        if (index < 0 || index >= SAMPLE_COUNT) return;
        const radial = Math.abs(point.y - CENTER_Y);

        if (state.stage === 'carve') carveAt(index, radial, point);
        if (state.stage === 'sand') sandAt(index, radial, point);
        if (state.stage === 'paint') paintAt(index, radial, point);
    }

    function carveAt(index, radial, point) {
        if (radial > state.current[index] + 28 || radial < MIN_RADIUS) return;
        const tool = tools[state.activeTool];
        let removed = 0;

        for (let offset = -tool.radius; offset <= tool.radius; offset += 1) {
            const sample = index + offset;
            if (sample < 2 || sample >= SAMPLE_COUNT - 2) continue;
            const normalized = Math.abs(offset) / Math.max(1, tool.radius);
            const falloff = Math.cos(normalized * Math.PI * .5);
            const edgeLift = state.activeTool === 'round'
                ? tool.edgeLift * normalized * normalized
                : tool.edgeLift * normalized;
            const desiredRadius = clamp(radial + edgeLift, MIN_RADIUS, state.current[sample]);
            const before = state.current[sample];
            state.current[sample] = Math.min(before, mix(before, desiredRadius, tool.strength * falloff));
            removed += before - state.current[sample];
            state.roughness[sample] = clamp(state.roughness[sample] + .12 * falloff, 0, 1);
        }

        if (removed > .25) {
            addParticles(point, '#dca85e', Math.min(7, 2 + Math.floor(removed / 8)), 3.6);
            markGestureUsed();
            updateMetrics();
        }
    }

    function sandAt(index, radial, point) {
        if (Math.abs(radial - state.current[index]) > 38) return;
        const size = Number(document.getElementById('sander-size').value);
        const radius = Math.max(4, Math.round(size * .55));
        const snapshot = state.current.slice();

        for (let offset = -radius; offset <= radius; offset += 1) {
            const sample = index + offset;
            if (sample < 2 || sample >= SAMPLE_COUNT - 2) continue;
            const normalized = Math.abs(offset) / radius;
            const falloff = Math.cos(normalized * Math.PI * .5);
            const smoothed = (snapshot[sample - 1] + snapshot[sample] * 2 + snapshot[sample + 1]) / 4;
            state.current[sample] = mix(state.current[sample], smoothed, .42 * falloff);
            state.sandCoverage[sample] = clamp(state.sandCoverage[sample] + .07 * falloff, 0, 1);
            state.roughness[sample] = clamp(state.roughness[sample] - .1 * falloff, 0, 1);
        }
        addParticles(point, '#f0d29a', 3, 1.8, true);
        markGestureUsed();
        updateMetrics();
    }

    function paintAt(index, radial, point) {
        if (Math.abs(radial - state.current[index]) > 46) return;
        const paint = selectedPaint();
        const radius = 12;

        for (let offset = -radius; offset <= radius; offset += 1) {
            const sample = index + offset;
            if (sample < 1 || sample >= SAMPLE_COUNT - 1) continue;
            const normalized = Math.abs(offset) / radius;
            const falloff = Math.cos(normalized * Math.PI * .5);
            state.paintCoverage[sample] = clamp(state.paintCoverage[sample] + .12 * falloff, 0, 1);
            state.paintColors[sample] = paint.color;
        }
        addParticles(point, paint.color, 3, 2.2, true);
        markGestureUsed();
        updateMetrics();
    }

    function markGestureUsed() {
        if (state.gestureUsed) return;
        state.gestureUsed = true;
        elements.gestureHint.classList.add('hidden');
    }

    function addParticles(point, color, count, speed, dust = false) {
        if (typeof cpSettings !== 'undefined' && !cpSettings.effects) return;
        for (let index = 0; index < count; index += 1) {
            state.particles.push({
                x: point.x + (Math.random() - .5) * 12,
                y: point.y + (Math.random() - .5) * 12,
                vx: (Math.random() - .5) * speed,
                vy: dust ? (Math.random() - .6) * speed : Math.random() * speed + 1,
                life: 1,
                size: dust ? 2 + Math.random() * 3 : 3 + Math.random() * 6,
                color,
                spin: Math.random() * Math.PI
            });
        }
        if (state.particles.length > 180) state.particles.splice(0, state.particles.length - 180);
    }

    function renderBackground(time) {
        const isPaper = document.body.classList.contains('theme-paper');
        const background = ctx.createLinearGradient(0, 0, 0, HEIGHT);
        background.addColorStop(0, isPaper ? '#dfe4df' : '#171b16');
        background.addColorStop(1, isPaper ? '#bcc4be' : '#0b0e0b');
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        ctx.save();
        ctx.globalAlpha = isPaper ? .15 : .18;
        ctx.strokeStyle = isPaper ? '#526057' : '#778075';
        ctx.lineWidth = 1;
        for (let x = 0; x < WIDTH; x += 42) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, HEIGHT);
            ctx.stroke();
        }
        for (let y = 0; y < HEIGHT; y += 42) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(WIDTH, y);
            ctx.stroke();
        }
        ctx.restore();

        const glow = ctx.createRadialGradient(520, CENTER_Y, 40, 520, CENTER_Y, 390);
        glow.addColorStop(0, 'rgba(185,255,102,.105)');
        glow.addColorStop(1, 'rgba(185,255,102,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        drawLatheHardware(time);
    }

    function drawLatheHardware(time) {
        ctx.fillStyle = '#2d332d';
        ctx.fillRect(60, CENTER_Y + 158, WIDTH - 120, 38);
        ctx.fillStyle = '#171a17';
        ctx.fillRect(98, CENTER_Y + 196, 48, 58);
        ctx.fillRect(WIDTH - 146, CENTER_Y + 196, 48, 58);

        const metal = ctx.createLinearGradient(0, 0, 150, 0);
        metal.addColorStop(0, '#303630');
        metal.addColorStop(.5, '#c9d0c7');
        metal.addColorStop(1, '#3b423b');
        ctx.fillStyle = metal;
        ctx.beginPath();
        ctx.moveTo(62, CENTER_Y - 66);
        ctx.lineTo(PIECE_START - 2, CENTER_Y - 32);
        ctx.lineTo(PIECE_START - 2, CENTER_Y + 32);
        ctx.lineTo(62, CENTER_Y + 66);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(34, CENTER_Y - 84, 42, 168);

        ctx.beginPath();
        ctx.moveTo(WIDTH - 58, CENTER_Y);
        ctx.lineTo(PIECE_END + 2, CENTER_Y - 28);
        ctx.lineTo(PIECE_END + 2, CENTER_Y + 28);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(WIDTH - 57, CENTER_Y - 61, 30, 122);

        ctx.save();
        ctx.translate(55, CENTER_Y);
        ctx.rotate(time * .004);
        ctx.strokeStyle = '#e5ebe3';
        ctx.lineWidth = 4;
        for (let i = 0; i < 3; i += 1) {
            ctx.rotate((Math.PI * 2) / 3);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(32, 0);
            ctx.stroke();
        }
        ctx.restore();
    }

    function renderWood(time) {
        ctx.save();
        profilePath(ctx, state.current);
        const woodGradient = ctx.createLinearGradient(0, CENTER_Y - MAX_RADIUS, 0, CENTER_Y + MAX_RADIUS);
        woodGradient.addColorStop(0, '#f2c77d');
        woodGradient.addColorStop(.28, '#cf8c47');
        woodGradient.addColorStop(.52, '#a8602e');
        woodGradient.addColorStop(.76, '#d89449');
        woodGradient.addColorStop(1, '#6f3d20');
        ctx.fillStyle = woodGradient;
        ctx.fill();
        ctx.clip();

        ctx.globalAlpha = .34;
        ctx.strokeStyle = '#f6d89f';
        ctx.lineWidth = 2;
        const spinOffset = Math.sin(time * .006) * 4;
        for (let index = 4; index < SAMPLE_COUNT; index += 8) {
            const x = sampleX(index) + spinOffset;
            ctx.beginPath();
            ctx.moveTo(x, CENTER_Y - state.current[index]);
            ctx.bezierCurveTo(x + 5, CENTER_Y - state.current[index] * .45, x - 5, CENTER_Y + state.current[index] * .45, x, CENTER_Y + state.current[index]);
            ctx.stroke();
        }

        ctx.globalAlpha = .16;
        ctx.strokeStyle = '#512d18';
        for (let yOffset = -90; yOffset <= 90; yOffset += 18) {
            ctx.beginPath();
            ctx.moveTo(PIECE_START, CENTER_Y + yOffset + Math.sin(time * .008 + yOffset) * 2);
            ctx.lineTo(PIECE_END, CENTER_Y + yOffset);
            ctx.stroke();
        }

        for (let index = 0; index < SAMPLE_COUNT - 1; index += 1) {
            const coverage = state.paintCoverage[index];
            if (coverage <= .01) continue;
            const x1 = sampleX(index);
            const x2 = sampleX(index + 1) + 1;
            ctx.globalAlpha = .18 + coverage * .76;
            ctx.fillStyle = state.paintColors[index];
            ctx.beginPath();
            ctx.moveTo(x1, CENTER_Y - state.current[index]);
            ctx.lineTo(x2, CENTER_Y - state.current[index + 1]);
            ctx.lineTo(x2, CENTER_Y + state.current[index + 1]);
            ctx.lineTo(x1, CENTER_Y + state.current[index]);
            ctx.closePath();
            ctx.fill();
        }

        const highlight = ctx.createLinearGradient(0, CENTER_Y - MAX_RADIUS, 0, CENTER_Y);
        highlight.addColorStop(0, 'rgba(255,255,255,.24)');
        highlight.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = .7;
        ctx.fillStyle = highlight;
        ctx.fillRect(PIECE_START, CENTER_Y - MAX_RADIUS, PIECE_END - PIECE_START, MAX_RADIUS);
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = .9;
        ctx.strokeStyle = '#5a311b';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(PIECE_START + 3, CENTER_Y - state.current[1] + 4);
        ctx.lineTo(PIECE_START + 3, CENTER_Y + state.current[1] - 4);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        profilePath(ctx, state.current);
        ctx.strokeStyle = 'rgba(255,255,255,.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
    }

    function renderTargetOutline() {
        if (state.stage === 'paint') return;
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        state.target.forEach((radius, index) => {
            const x = sampleX(index);
            const y = CENTER_Y - radius;
            if (index === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        for (let index = SAMPLE_COUNT - 1; index >= 0; index -= 1) ctx.lineTo(sampleX(index), CENTER_Y + state.target[index]);

        // A dark halo separates the requested form from both pale wood and the tool.
        ctx.strokeStyle = 'rgba(7, 9, 6, .94)';
        ctx.lineWidth = 7;
        ctx.setLineDash([]);
        ctx.stroke();

        ctx.strokeStyle = '#c8ff71';
        ctx.lineWidth = 3.2;
        ctx.shadowBlur = 11;
        ctx.shadowColor = 'rgba(185, 255, 102, .9)';
        ctx.stroke();
        ctx.restore();
    }

    function renderToolCursor() {
        if (!state.pointer.inside) return;
        const { x, y } = state.pointer;
        ctx.save();
        if (state.stage === 'carve') {
            ctx.translate(x, y);
            // Keep the handle outside the workpiece so the guide remains visible.
            ctx.rotate(y < CENTER_Y ? Math.PI - .22 : .22);
            ctx.fillStyle = '#dce3dc';
            ctx.strokeStyle = '#11140f';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-7, 0);
            ctx.lineTo(7, 0);
            ctx.lineTo(11, 76);
            ctx.lineTo(-11, 76);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#ff795f';
            ctx.fillRect(-16, 70, 32, 72);
            ctx.strokeRect(-16, 70, 32, 72);
        } else {
            const radius = state.stage === 'sand' ? Number(document.getElementById('sander-size').value) : 28;
            ctx.strokeStyle = state.stage === 'paint' ? selectedPaint().color : '#f0d29a';
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    function renderParticles(delta) {
        for (let index = state.particles.length - 1; index >= 0; index -= 1) {
            const particle = state.particles[index];
            particle.x += particle.vx * delta * .06;
            particle.y += particle.vy * delta * .06;
            particle.vy += .05 * delta * .06;
            particle.life -= .018 * delta * .06;
            particle.spin += .08;
            if (particle.life <= 0) {
                state.particles.splice(index, 1);
                continue;
            }
            ctx.save();
            ctx.translate(particle.x, particle.y);
            ctx.rotate(particle.spin);
            ctx.globalAlpha = particle.life;
            ctx.fillStyle = particle.color;
            ctx.fillRect(-particle.size / 2, -particle.size / 4, particle.size, particle.size / 2);
            ctx.restore();
        }
    }

    function render(time) {
        const delta = Math.min(34, time - state.lastTime);
        state.lastTime = time;
        renderBackground(time);
        renderWood(time);
        renderParticles(delta);
        renderToolCursor();
        // The requested profile is the player's primary guide, so it stays on top.
        renderTargetOutline();
        requestAnimationFrame(render);
    }

    function renderPaintPalette() {
        const profile = CasualProfile.current();
        const owned = profile?.ownedPaints || ['natural', 'honey'];
        const active = profile?.selectedPaint || state.guestPaint;
        elements.paintPalette.replaceChildren();
        owned.forEach((paintId) => {
            const paint = CasualProfile.paints[paintId];
            if (!paint) return;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `paint-swatch${paintId === active ? ' active' : ''}`;
            button.style.setProperty('--swatch', paint.color);
            button.title = paint.name;
            button.setAttribute('aria-label', paint.name);
            button.addEventListener('click', () => choosePaint(paintId));
            elements.paintPalette.appendChild(button);
        });
    }

    function choosePaint(paintId) {
        const profile = CasualProfile.current();
        try {
            if (profile) CasualProfile.selectPaint(paintId);
            else state.guestPaint = paintId;
            renderPaintPalette();
            renderProfile();
            showToast(`${CasualProfile.paints[paintId].name} seçildi.`);
            playSound('click');
        } catch (error) {
            showToast(error.message);
        }
    }

    function renderPaintStore(profile) {
        const owned = profile?.ownedPaints || ['natural', 'honey'];
        const active = profile?.selectedPaint || state.guestPaint;
        elements.paintCount.textContent = `${owned.length}/${Object.keys(CasualProfile.paints).length}`;
        elements.paintStoreList.replaceChildren();

        Object.values(CasualProfile.paints).forEach((paint) => {
            const isOwned = owned.includes(paint.id);
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `store-paint${isOwned ? ' owned' : ''}${paint.id === active ? ' active' : ''}`;
            button.style.setProperty('--swatch', paint.color);

            const swatch = document.createElement('i');
            const copy = document.createElement('span');
            const name = document.createElement('strong');
            name.textContent = paint.name;
            const status = document.createElement('small');
            status.textContent = isOwned ? (paint.id === active ? 'Seçili' : 'Koleksiyonda') : 'Kilidi aç';
            copy.append(name, status);
            const price = document.createElement('b');
            price.textContent = isOwned ? '✓' : `${paint.price} CM`;
            button.append(swatch, copy, price);

            button.addEventListener('click', () => {
                const currentProfile = CasualProfile.current();
                if (!currentProfile) {
                    if (isOwned) choosePaint(paint.id);
                    else openLogin();
                    return;
                }
                try {
                    if (currentProfile.ownedPaints.includes(paint.id)) CasualProfile.selectPaint(paint.id);
                    else CasualProfile.buyPaint(paint.id);
                    renderProfile();
                    showToast(currentProfile.ownedPaints.includes(paint.id) ? `${paint.name} seçildi.` : `${paint.name} satın alındı.`);
                    playSound('pop');
                } catch (error) {
                    showToast(error.message);
                }
            });
            elements.paintStoreList.appendChild(button);
        });
    }

    function renderProfile() {
        const profile = CasualProfile.current();
        const office = CasualProfile.offices[(profile?.officeLevel || 1) - 1];
        elements.topBalance.textContent = `${CasualProfile.formatMoney(profile?.balance || 0)} CM`;
        elements.compactAvatar.textContent = profile ? initials(profile.displayName) : '?';
        elements.compactName.textContent = profile ? `@${profile.displayName}` : 'Profil gerekli';
        elements.compactStatus.textContent = profile ? `${office.name} · sadece bu tarayıcı` : 'Kazanç için giriş yap';
        elements.profileAction.textContent = profile ? 'Çık' : 'Aç';
        elements.officeName.textContent = office.name;
        elements.officeMultiplier.textContent = formatMultiplier(office.multiplier);
        elements.upgradeCost.textContent = office.upgradeCost === null ? 'MAKS.' : `${CasualProfile.formatMoney(office.upgradeCost)} CM`;
        elements.upgradeOffice.disabled = office.upgradeCost === null;
        elements.jobsCount.textContent = profile?.woodTurning.jobs || 0;
        elements.bestScore.textContent = `${profile?.woodTurning.bestScore || 0}%`;
        elements.totalEarned.textContent = `${CasualProfile.formatMoney(profile?.woodTurning.totalEarned || 0)} CM`;
        renderPaintStore(profile);
        renderPaintPalette();
    }

    function openLogin() {
        elements.loginError.textContent = '';
        openModal(elements.loginModal);
        setTimeout(() => elements.username.focus(), 40);
    }

    function finishOrder() {
        if (state.completed) return;
        state.completed = true;
        const profile = CasualProfile.current();
        const scores = {
            shape: shapeScore(),
            sand: sandScore(),
            paint: paintScore(),
            overall: overallScore()
        };
        const office = CasualProfile.offices[(profile?.officeLevel || 1) - 1];
        let reward = CasualProfile.rewardForScore(scores.overall, office.level);
        let awarded = false;

        if (profile) {
            const award = CasualProfile.awardWoodTurning({ score: scores.overall });
            reward = award.reward;
            awarded = true;
            if (typeof recordGameResult === 'function') recordGameResult('Wood Turning', { won: scores.overall >= 70, score: scores.overall });
        }

        state.pendingResult = { ...scores, reward, awarded };
        populateResult();
        openModal(elements.resultModal);
        createConfetti(scores.overall);
        playSound('pop');
        renderProfile();
    }

    function populateResult() {
        const result = state.pendingResult;
        if (!result) return;
        const profile = CasualProfile.current();
        const office = CasualProfile.offices[(profile?.officeLevel || 1) - 1];
        elements.resultScore.textContent = result.overall;
        elements.resultShape.textContent = `${result.shape}%`;
        elements.resultSand.textContent = `${result.sand}%`;
        elements.resultPaint.textContent = `${result.paint}%`;
        elements.rewardValue.textContent = CasualProfile.formatMoney(result.reward);
        elements.rewardMultiplier.textContent = `${formatMultiplier(office.multiplier)} ofis çarpanı`;
        elements.guestWarning.hidden = result.awarded;
    }

    function claimPendingReward() {
        if (!state.pendingResult || state.pendingResult.awarded || !CasualProfile.current()) return;
        const award = CasualProfile.awardWoodTurning({ score: state.pendingResult.overall });
        state.pendingResult.reward = award.reward;
        state.pendingResult.awarded = true;
        if (typeof recordGameResult === 'function') recordGameResult('Wood Turning', { won: state.pendingResult.overall >= 70, score: state.pendingResult.overall });
        populateResult();
        renderProfile();
    }

    function createConfetti(score) {
        elements.confetti.replaceChildren();
        if (score < 70 || (typeof cpSettings !== 'undefined' && !cpSettings.effects)) return;
        const colors = ['#b9ff66', '#ff795f', '#7aa7ff', '#f58bd4', '#ffae58'];
        for (let index = 0; index < 34; index += 1) {
            const piece = document.createElement('span');
            piece.style.left = `${Math.random() * 100}%`;
            piece.style.setProperty('--color', colors[index % colors.length]);
            piece.style.setProperty('--delay', `${Math.random() * .45}s`);
            piece.style.setProperty('--drift', `${(Math.random() - .5) * 220}px`);
            elements.confetti.appendChild(piece);
        }
    }

    canvas.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        state.pointer.down = true;
        state.pointer.inside = true;
        Object.assign(state.pointer, canvasPoint(event));
        canvas.setPointerCapture(event.pointerId);
        useTool(state.pointer);
    });

    canvas.addEventListener('pointermove', (event) => {
        Object.assign(state.pointer, canvasPoint(event), { inside: true });
        if (state.pointer.down) useTool(state.pointer);
    });

    canvas.addEventListener('pointerup', (event) => {
        state.pointer.down = false;
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    });

    canvas.addEventListener('pointercancel', () => { state.pointer.down = false; });
    canvas.addEventListener('pointerleave', () => { if (!state.pointer.down) state.pointer.inside = false; });
    canvas.addEventListener('pointerenter', () => { state.pointer.inside = true; });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());

    document.querySelectorAll('[data-tool]').forEach((button) => {
        button.addEventListener('click', () => {
            state.activeTool = button.dataset.tool;
            document.querySelectorAll('[data-tool]').forEach((item) => item.classList.toggle('active', item === button));
            playSound('click');
        });
    });

    elements.nextStage.addEventListener('click', () => {
        if (state.stage === 'carve') {
            state.stageSnapshot = state.current.slice();
            setStage('sand');
        } else if (state.stage === 'sand') {
            state.stageSnapshot = state.current.slice();
            setStage('paint');
        } else {
            finishOrder();
        }
    });

    elements.resetStage.addEventListener('click', () => {
        if (state.stage === 'carve') {
            state.current = Array.from({ length: SAMPLE_COUNT }, (_, index) => {
                const edge = Math.min(index, SAMPLE_COUNT - 1 - index);
                return edge < 3 ? mix(42, MAX_RADIUS, edge / 3) : MAX_RADIUS;
            });
            state.sandCoverage.fill(0);
            state.paintCoverage.fill(0);
        } else if (state.stage === 'sand') {
            if (state.stageSnapshot) state.current = state.stageSnapshot.slice();
            state.sandCoverage.fill(0);
        } else {
            state.paintCoverage.fill(0);
            state.paintColors.fill(WOOD_BASE);
        }
        updateMetrics();
        showToast('Bu aşama sıfırlandı.');
        playSound('click');
    });

    elements.profileAction.addEventListener('click', () => {
        if (CasualProfile.current()) {
            CasualProfile.logout();
            renderProfile();
            showToast('Oturum kapatıldı.');
        } else {
            openLogin();
        }
    });

    elements.walletButton.addEventListener('click', () => {
        if (!CasualProfile.current()) openLogin();
        else document.querySelector('.studio-panel').scrollIntoView({ behavior: cpSettings.effects ? 'smooth' : 'auto', block: 'start' });
    });

    elements.upgradeOffice.addEventListener('click', () => {
        if (!CasualProfile.current()) {
            openLogin();
            return;
        }
        try {
            CasualProfile.upgradeOffice();
            renderProfile();
            showToast('Ofis geliştirildi; kazanç çarpanın yükseldi.');
            playSound('pop');
        } catch (error) {
            showToast(error.message);
        }
    });

    elements.loginForm.addEventListener('submit', (event) => {
        event.preventDefault();
        elements.loginError.textContent = '';
        try {
            const profile = CasualProfile.login(elements.username.value);
            elements.username.value = '';
            claimPendingReward();
            renderProfile();
            closeModal(elements.loginModal);
            showToast(`Hoş geldin, @${profile.displayName}.`);
            if (state.returnToResult && state.pendingResult) {
                state.returnToResult = false;
                populateResult();
                openModal(elements.resultModal);
            }
            playSound('pop');
        } catch (error) {
            elements.loginError.textContent = error.message;
        }
    });

    elements.guestWarning.addEventListener('click', () => {
        state.returnToResult = true;
        closeModal(elements.resultModal);
        openLogin();
    });

    document.querySelectorAll('[data-close]').forEach((button) => {
        button.addEventListener('click', () => closeModal(document.getElementById(button.dataset.close)));
    });

    document.querySelectorAll('.modal-overlay').forEach((overlay) => {
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) closeModal(overlay);
        });
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') document.querySelectorAll('.modal-overlay.active').forEach(closeModal);
    });

    document.getElementById('new-order').addEventListener('click', () => {
        closeModal(elements.resultModal);
        beginOrder(true);
        playSound('click');
    });

    window.addEventListener('casualprofilechange', renderProfile);

    renderProfile();
    beginOrder();
    requestAnimationFrame(render);

    if (!CasualProfile.current()) {
        setTimeout(() => showToast('İstersen misafir oynayabilir, kazanç için profil açabilirsin.'), 700);
    }
});
