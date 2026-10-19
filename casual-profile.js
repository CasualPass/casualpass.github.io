(function () {
    'use strict';

    const PROFILE_COOKIE = 'casualpass_profile_v2';
    const SESSION_COOKIE = 'casualpass_session_v2';
    const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
    const MAX_ACTIVITIES = 5;
    const SESSION_REWARD = 15;
    const DAILY_REWARD = 20;
    const REBIRTH_BASE = 500;
    const MAX_REBIRTHS = 8;
    const OWL_REWARD_CAP = 40;
    const BLOCKS_REWARD_CAP = 40;
    const BLOCKS_POINTS_PER_CM = 50;
    const SONHAT_REWARD_CAP = 40;
    const SONHAT_COINS_PER_CM = 8;
    const ARENA_REWARD_CAP = 40;
    const ARENA_CM_PER_KILL = 2;
    const ARENA_WIN_BONUS = 6;
    const VEKTOR_REWARD_CAP = 40;
    const VEKTOR_WIN_BONUS = 10;
    const TURN_SHELF_SIZE = 12;
    const TURN_MAX_LEVEL = 999;

    const paints = {
        natural: { id: 'natural', name: 'Doğal Ahşap', color: '#c98a4a', price: 0 },
        honey: { id: 'honey', name: 'Bal Cilası', color: '#e5a63c', price: 0 },
        cherry: { id: 'cherry', name: 'Kiraz Kırmızısı', color: '#d9574f', price: 140 },
        moss: { id: 'moss', name: 'Yosun Yeşili', color: '#5f8f68', price: 240 },
        ocean: { id: 'ocean', name: 'Okyanus Mavisi', color: '#3d78b8', price: 360 },
        violet: { id: 'violet', name: 'Gece Menekşesi', color: '#7656a8', price: 480 },
        charcoal: { id: 'charcoal', name: 'Kömür Siyahı', color: '#34363d', price: 650 },
        pearl: { id: 'pearl', name: 'İnci Beyazı', color: '#e9dfcd', price: 900 }
    };

    const themes = {
        liquid: { id: 'liquid', name: 'Liquid', description: 'Canlı ve akışkan', price: 0, preview: ['#1b1f36', '#00ffcc'] },
        paper: { id: 'paper', name: 'Paper', description: 'Açık ve temiz', price: 30, preview: ['#f1f3f5', '#2980b9'] },
        neon: { id: 'neon', name: 'Neon', description: 'Gece ışıkları', price: 180, preview: ['#111111', '#00f2fe'] },
        retro: { id: 'retro', name: 'Retro', description: 'Piksel nostaljisi', price: 300, preview: ['#1a1c2c', '#ffcd75'] }
    };

    const owls = {
        minerva: { id: 'minerva', name: 'Minerva', description: 'Bilgeliğin baykuşu', price: 0 },
        snowy: { id: 'snowy', name: 'Kar Baykuşu', description: 'Kuzeyden sessiz kanat', price: 80 },
        barn: { id: 'barn', name: 'Peçeli Baykuş', description: 'Kalp yüzlü avcı', price: 150 },
        eagle: { id: 'eagle', name: 'Puhu', description: 'Kulaklı gece devi', price: 260 },
        cosmic: { id: 'cosmic', name: 'Gece Baykuşu', description: 'Yıldız tozu bırakır', price: 420 },
        golden: { id: 'golden', name: 'Altın Baykuş', description: 'Altın iz bırakır', price: 750 }
    };

    const woods = {
        pine: { id: 'pine', name: 'Çam', description: 'Açık ve sıcak', price: 0 },
        walnut: { id: 'walnut', name: 'Ceviz', description: 'Koyu damarlı', price: 90 },
        cherry: { id: 'cherry', name: 'Kiraz', description: 'Kızıl tonlu', price: 180 },
        ebony: { id: 'ebony', name: 'Abanoz', description: 'Gece siyahı', price: 360 }
    };

    // Wood Turning lathe stock (cosmetic) and chisels (cut speed).
    const logs = {
        beech: { id: 'beech', name: 'Kayın', description: 'Açık ve sade', price: 0 },
        oak: { id: 'oak', name: 'Meşe', description: 'Belirgin halkalar', price: 120 },
        walnut: { id: 'walnut', name: 'Ceviz', description: 'Koyu ve sıcak', price: 260 },
        cherry: { id: 'cherry', name: 'Kiraz', description: 'Kızıl tonlu', price: 420 },
        zebrano: { id: 'zebrano', name: 'Zebrano', description: 'Çizgili egzotik', price: 700 },
        ebony: { id: 'ebony', name: 'Abanoz', description: 'Gece siyahı', price: 1100 }
    };

    const chisels = {
        steel: { id: 'steel', name: 'Çelik Keski', description: 'Standart kesim', price: 0, speed: 1 },
        carbide: { id: 'carbide', name: 'Karbür Keski', description: '%35 daha hızlı', price: 150, speed: 1.35 },
        damascus: { id: 'damascus', name: 'Şam Çeliği', description: '%70 daha hızlı', price: 400, speed: 1.7 },
        diamond: { id: 'diamond', name: 'Elmas Keski', description: '2 kat hızlı', price: 900, speed: 2.1 }
    };

    const camos = {
        standard: { id: 'standard', name: 'Standart', description: 'Mat çelik', price: 0 },
        desert: { id: 'desert', name: 'Çöl', description: 'Kum ve kahve', price: 100 },
        forest: { id: 'forest', name: 'Orman', description: 'Yaprak yeşili', price: 180 },
        arctic: { id: 'arctic', name: 'Kutup', description: 'Buz beyazı', price: 260 },
        crimson: { id: 'crimson', name: 'Kızıl', description: 'Koyu kırmızı', price: 420 },
        golden: { id: 'golden', name: 'Altın', description: 'Parlak altın', price: 800 }
    };

    const offices = [
        { level: 1, name: 'Garaj Tezgâhı', multiplier: 1, upgradeCost: 450 },
        { level: 2, name: 'Usta Atölyesi', multiplier: 1.25, upgradeCost: 1100 },
        { level: 3, name: 'Tasarım Stüdyosu', multiplier: 1.55, upgradeCost: 2400 },
        { level: 4, name: 'CasualWorks Ofisi', multiplier: 1.9, upgradeCost: null }
    ];

    function getCookie(name) {
        const prefix = `${encodeURIComponent(name)}=`;
        const item = document.cookie.split('; ').find((cookie) => cookie.startsWith(prefix));
        if (!item) return '';
        try { return decodeURIComponent(item.slice(prefix.length)); } catch { return ''; }
    }

    function setCookie(name, value, maxAge = COOKIE_MAX_AGE) {
        const secure = window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
    }

    function cheatsActive() {
        const cheats = window.CasualCheats;
        return Boolean(cheats && typeof cheats.active === 'function' && cheats.active());
    }

    function readProfile() {
        const value = getCookie(PROFILE_COOKIE);
        if (!value) return null;
        try { return cleanProfile(JSON.parse(value)); } catch { return null; }
    }

    function writeProfile(profile) {
        setCookie(PROFILE_COOKIE, JSON.stringify(cleanProfile(profile)));
    }

    function canonicalUsername(value) {
        return String(value || '').normalize('NFKC').trim().toLocaleLowerCase('tr-TR');
    }

    function todayKey() {
        const date = new Date();
        return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
    }

    function timeLabel() {
        return new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(new Date());
    }

    function validateUsername(value) {
        const displayName = String(value || '').normalize('NFKC').trim();
        if (displayName.length < 3 || displayName.length > 20) return { valid: false, message: 'Kullanıcı adı 3–20 karakter olmalı.' };
        if (!/^[\p{L}\p{N}._-]+$/u.test(displayName)) return { valid: false, message: 'Yalnızca harf, rakam, nokta, tire ve alt çizgi kullan.' };
        return { valid: true, displayName, id: canonicalUsername(displayName) };
    }

    function makeProfile(displayName, id) {
        const now = new Date().toISOString();
        return {
            id,
            displayName,
            balance: 0,
            officeLevel: 1,
            ownedPaints: ['natural', 'honey'],
            selectedPaint: 'honey',
            ownedThemes: ['liquid'],
            selectedTheme: 'liquid',
            ownedOwls: ['minerva'],
            selectedOwl: 'minerva',
            ownedWoods: ['pine'],
            selectedWood: 'pine',
            ownedCamos: ['standard'],
            selectedCamo: 'standard',
            ownedLogs: ['beech'],
            selectedLog: 'beech',
            ownedChisels: ['steel'],
            selectedChisel: 'steel',
            dailyBonusDate: '',
            sessionRewardDate: '',
            rebirths: 0,
            lifetimeEarned: 0,
            activities: [],
            woodTurning: { jobs: 0, bestScore: 0, totalEarned: 0, lastReward: 0, level: 1, stars: 0, shelf: [] },
            createdAt: now,
            updatedAt: now
        };
    }

    function lifetimeEarnedOf(safe) {
        if (safe.lifetimeEarned == null || safe.lifetimeEarned === '') {
            return Math.max(0, Math.floor(Number(safe.woodTurning?.totalEarned) || 0));
        }
        return Math.max(0, Math.floor(Number(safe.lifetimeEarned) || 0));
    }

    function rebirthCountOf(profile) {
        return Math.min(MAX_REBIRTHS, Math.max(0, Math.floor(Number(profile?.rebirths) || 0)));
    }

    function earnMultiplier(profile) {
        return 2 ** rebirthCountOf(profile);
    }

    // Shelf entries are [level, score]; the piece is redrawn from its level.
    function cleanShelf(value) {
        if (!Array.isArray(value)) return [];
        return value.filter((item) => Array.isArray(item)).slice(0, TURN_SHELF_SIZE).map((item) => [
            Math.min(TURN_MAX_LEVEL, Math.max(1, Math.floor(Number(item[0]) || 1))),
            Math.min(100, Math.max(0, Math.floor(Number(item[1]) || 0)))
        ]);
    }

    function turnStars(score) {
        const safe = Number(score) || 0;
        if (safe >= 95) return 3;
        if (safe >= 85) return 2;
        if (safe >= 70) return 1;
        return 0;
    }

    function cleanProfile(profile) {
        const safe = profile && typeof profile === 'object' ? profile : {};
        const ownedPaints = Array.isArray(safe.ownedPaints) ? safe.ownedPaints.filter((id) => paints[id]) : ['natural', 'honey'];
        if (!ownedPaints.includes('natural')) ownedPaints.unshift('natural');
        if (!ownedPaints.includes('honey')) ownedPaints.push('honey');
        const ownedThemes = Array.isArray(safe.ownedThemes) ? safe.ownedThemes.filter((id) => themes[id]) : ['liquid'];
        if (!ownedThemes.includes('liquid')) ownedThemes.unshift('liquid');
        const ownedOwls = Array.isArray(safe.ownedOwls) ? safe.ownedOwls.filter((id) => owls[id]) : ['minerva'];
        if (!ownedOwls.includes('minerva')) ownedOwls.unshift('minerva');
        const ownedWoods = Array.isArray(safe.ownedWoods) ? safe.ownedWoods.filter((id) => woods[id]) : ['pine'];
        if (!ownedWoods.includes('pine')) ownedWoods.unshift('pine');
        const ownedCamos = Array.isArray(safe.ownedCamos) ? safe.ownedCamos.filter((id) => camos[id]) : ['standard'];
        if (!ownedCamos.includes('standard')) ownedCamos.unshift('standard');
        const ownedLogs = Array.isArray(safe.ownedLogs) ? safe.ownedLogs.filter((id) => logs[id]) : ['beech'];
        if (!ownedLogs.includes('beech')) ownedLogs.unshift('beech');
        const ownedChisels = Array.isArray(safe.ownedChisels) ? safe.ownedChisels.filter((id) => chisels[id]) : ['steel'];
        if (!ownedChisels.includes('steel')) ownedChisels.unshift('steel');
        const activities = Array.isArray(safe.activities) ? safe.activities.slice(0, MAX_ACTIVITIES).filter((item) => item && typeof item.label === 'string') : [];
        return {
            id: canonicalUsername(safe.id),
            displayName: String(safe.displayName || safe.id || ''),
            balance: Math.max(0, Math.floor(Number(safe.balance) || 0)),
            officeLevel: Math.min(offices.length, Math.max(1, Math.floor(Number(safe.officeLevel) || 1))),
            ownedPaints,
            selectedPaint: ownedPaints.includes(safe.selectedPaint) ? safe.selectedPaint : 'honey',
            ownedThemes,
            selectedTheme: ownedThemes.includes(safe.selectedTheme) ? safe.selectedTheme : 'liquid',
            ownedOwls,
            selectedOwl: ownedOwls.includes(safe.selectedOwl) ? safe.selectedOwl : 'minerva',
            ownedWoods,
            selectedWood: ownedWoods.includes(safe.selectedWood) ? safe.selectedWood : 'pine',
            ownedCamos,
            selectedCamo: ownedCamos.includes(safe.selectedCamo) ? safe.selectedCamo : 'standard',
            ownedLogs,
            selectedLog: ownedLogs.includes(safe.selectedLog) ? safe.selectedLog : 'beech',
            ownedChisels,
            selectedChisel: ownedChisels.includes(safe.selectedChisel) ? safe.selectedChisel : 'steel',
            dailyBonusDate: String(safe.dailyBonusDate || ''),
            sessionRewardDate: String(safe.sessionRewardDate || ''),
            rebirths: Math.min(MAX_REBIRTHS, Math.max(0, Math.floor(Number(safe.rebirths) || 0))),
            lifetimeEarned: lifetimeEarnedOf(safe),
            activities,
            woodTurning: {
                jobs: Math.max(0, Math.floor(Number(safe.woodTurning?.jobs) || 0)),
                bestScore: Math.min(100, Math.max(0, Math.floor(Number(safe.woodTurning?.bestScore) || 0))),
                totalEarned: Math.max(0, Math.floor(Number(safe.woodTurning?.totalEarned) || 0)),
                lastReward: Math.max(0, Math.floor(Number(safe.woodTurning?.lastReward) || 0)),
                level: Math.min(TURN_MAX_LEVEL, Math.max(1, Math.floor(Number(safe.woodTurning?.level) || 1))),
                stars: Math.max(0, Math.floor(Number(safe.woodTurning?.stars) || 0)),
                shelf: cleanShelf(safe.woodTurning?.shelf)
            },
            createdAt: safe.createdAt || new Date().toISOString(),
            updatedAt: safe.updatedAt || new Date().toISOString()
        };
    }

    function emit(profile) {
        window.dispatchEvent(new CustomEvent('casualprofilechange', { detail: profile }));
    }

    function applyTheme(themeId) {
        if (window.CasualSettings?.setTheme) window.CasualSettings.setTheme(themeId);
    }

    function current() {
        const profile = readProfile();
        const sessionId = canonicalUsername(getCookie(SESSION_COOKIE));
        return profile && sessionId && profile.id === sessionId ? profile : null;
    }

    function login(username) {
        const validation = validateUsername(username);
        if (!validation.valid) throw new Error(validation.message);
        const stored = readProfile();
        const profile = stored?.id === validation.id ? cleanProfile(stored) : makeProfile(validation.displayName, validation.id);
        profile.displayName = profile.displayName || validation.displayName;
        profile.updatedAt = new Date().toISOString();
        if (!cheatsActive()) writeProfile(profile);
        setCookie(SESSION_COOKIE, profile.id);
        applyTheme(profile.selectedTheme);
        emit(profile);
        return profile;
    }

    function logout() {
        setCookie(SESSION_COOKIE, '', 0);
        emit(null);
    }

    function addActivity(profile, label, amount) {
        profile.activities.unshift({ label, amount: Math.trunc(amount) || 0, time: timeLabel() });
        profile.activities = profile.activities.slice(0, MAX_ACTIVITIES);
    }

    function grant(draft, baseAmount, label) {
        const reward = Math.max(0, Math.floor(Number(baseAmount) || 0)) * earnMultiplier(draft);
        if (!reward) return 0;
        draft.balance += reward;
        draft.lifetimeEarned += reward;
        addActivity(draft, label, reward);
        return reward;
    }

    function update(mutator, options) {
        const active = current();
        if (!active) throw new Error('Bu işlem için önce oturumu başlatmalısın.');
        if (cheatsActive() && !(options && options.alwaysPersist)) return active;
        const draft = cleanProfile(active);
        mutator(draft);
        draft.updatedAt = new Date().toISOString();
        const clean = cleanProfile(draft);
        writeProfile(clean);
        emit(clean);
        return clean;
    }

    function startSession() {
        if (cheatsActive()) return { profile: current(), granted: false, reward: 0 };
        let profile = current();
        if (!profile) profile = login('CasualOyuncu');
        const granted = profile.sessionRewardDate !== todayKey();
        if (!granted) return { profile, granted: false, reward: 0 };
        let reward = 0;
        profile = update((draft) => {
            reward = grant(draft, SESSION_REWARD, 'Oturum ödülü');
            draft.sessionRewardDate = todayKey();
        });
        return { profile, granted: true, reward };
    }

    function claimDailyBonus() {
        if (cheatsActive()) return { profile: current(), granted: false, reward: 0 };
        if (!current()) throw new Error('Günlük ödül için önce oturumu başlat.');
        const alreadyClaimed = current().dailyBonusDate === todayKey();
        if (alreadyClaimed) return { profile: current(), granted: false, reward: 0 };
        let reward = 0;
        const profile = update((draft) => {
            reward = grant(draft, DAILY_REWARD, 'Günlük ödül');
            draft.dailyBonusDate = todayKey();
        });
        return { profile, granted: true, reward };
    }

    function rewardForScore(score, officeLevel) {
        const safeScore = Math.min(100, Math.max(0, Number(score) || 0));
        const office = offices[Math.min(offices.length, Math.max(1, officeLevel)) - 1];
        const base = Math.max(4, Math.round(200 * Math.pow(safeScore / 100, 2.65)));
        return Math.round(base * office.multiplier);
    }

    // result.level is the level that was played; a starred piece advances to the next level
    // and lands on the shelf. Free design levels pay 1.5x.
    function awardWoodTurning(result) {
        if (cheatsActive()) return { profile: current(), reward: 0, stars: 0, advanced: false };
        const score = Math.min(100, Math.max(0, Math.round(Number(result?.score) || 0)));
        const stars = turnStars(score);
        const bonus = result?.freeDesign ? 1.5 : 1;
        let reward = 0;
        let advanced = false;
        const profile = update((draft) => {
            const turn = draft.woodTurning;
            const level = Math.max(1, Math.floor(Number(result?.level) || turn.level));
            reward = grant(draft, Math.round(rewardForScore(score, draft.officeLevel) * bonus), `Wood Turning · Seviye ${level}`);
            turn.jobs += 1;
            turn.bestScore = Math.max(turn.bestScore, score);
            turn.totalEarned += reward;
            turn.lastReward = reward;
            if (stars > 0) {
                turn.stars += stars;
                turn.shelf = [[level, score], ...turn.shelf].slice(0, TURN_SHELF_SIZE);
                if (level === turn.level) {
                    turn.level = Math.min(TURN_MAX_LEVEL, turn.level + 1);
                    advanced = true;
                }
            }
        });
        return { profile, reward, stars, advanced };
    }

    function buyLog(logId) {
        if (cheatsActive()) throw new Error('Hileleri kapatana kadar mağaza alışverişi duraklatıldı.');
        const log = logs[logId];
        if (!log) throw new Error('Ahşap bulunamadı.');
        return update((draft) => {
            if (!draft.ownedLogs.includes(logId)) {
                if (draft.balance < log.price) throw new Error('Bu ahşap için yeterli CasualMoney yok.');
                draft.balance -= log.price;
                draft.ownedLogs.push(logId);
                addActivity(draft, `${log.name} kütüğü`, -log.price);
            }
            draft.selectedLog = logId;
        });
    }

    function selectLog(logId) {
        if (cheatsActive()) throw new Error('Hileleri kapatana kadar seçimler kaydedilmez.');
        if (!logs[logId]) throw new Error('Ahşap bulunamadı.');
        return update((draft) => {
            if (!draft.ownedLogs.includes(logId)) throw new Error('Önce bu ahşabı satın almalısın.');
            draft.selectedLog = logId;
        });
    }

    function buyChisel(chiselId) {
        if (cheatsActive()) throw new Error('Hileleri kapatana kadar mağaza alışverişi duraklatıldı.');
        const chisel = chisels[chiselId];
        if (!chisel) throw new Error('Keski bulunamadı.');
        return update((draft) => {
            if (!draft.ownedChisels.includes(chiselId)) {
                if (draft.balance < chisel.price) throw new Error('Bu keski için yeterli CasualMoney yok.');
                draft.balance -= chisel.price;
                draft.ownedChisels.push(chiselId);
                addActivity(draft, chisel.name, -chisel.price);
            }
            draft.selectedChisel = chiselId;
        });
    }

    function selectChisel(chiselId) {
        if (cheatsActive()) throw new Error('Hileleri kapatana kadar seçimler kaydedilmez.');
        if (!chisels[chiselId]) throw new Error('Keski bulunamadı.');
        return update((draft) => {
            if (!draft.ownedChisels.includes(chiselId)) throw new Error('Önce bu keskiyi satın almalısın.');
            draft.selectedChisel = chiselId;
        });
    }

    function owlRewardForScore(score) {
        return Math.min(OWL_REWARD_CAP, Math.floor(Math.max(0, Number(score) || 0) / 2));
    }

    function awardOwlFlight(result) {
        if (cheatsActive() || !current()) return { profile: current(), reward: 0 };
        const base = owlRewardForScore(result?.score);
        if (!base) return { profile: current(), reward: 0 };
        let reward = 0;
        const profile = update((draft) => {
            reward = grant(draft, base, 'Minerva Owl uçuşu');
        });
        return { profile, reward };
    }

    function buyPaint(paintId) {
        if (cheatsActive()) throw new Error('Hileleri kapatana kadar mağaza alışverişi duraklatıldı.');
        const paint = paints[paintId];
        if (!paint) throw new Error('Boya bulunamadı.');
        return update((draft) => {
            if (draft.ownedPaints.includes(paintId)) { draft.selectedPaint = paintId; return; }
            if (draft.balance < paint.price) throw new Error('Bu boya için yeterli CasualMoney yok.');
            draft.balance -= paint.price;
            draft.ownedPaints.push(paintId);
            draft.selectedPaint = paintId;
            addActivity(draft, `${paint.name} boyası`, -paint.price);
        });
    }

    function selectPaint(paintId) {
        if (cheatsActive()) throw new Error('Hileleri kapatana kadar seçimler kaydedilmez.');
        if (!paints[paintId]) throw new Error('Boya bulunamadı.');
        return update((draft) => {
            if (!draft.ownedPaints.includes(paintId)) throw new Error('Önce bu boyayı satın almalısın.');
            draft.selectedPaint = paintId;
        });
    }

    function buyTheme(themeId) {
        if (cheatsActive()) throw new Error('Hileleri kapatana kadar mağaza alışverişi duraklatıldı.');
        const theme = themes[themeId];
        if (!theme) throw new Error('Tema bulunamadı.');
        const profile = update((draft) => {
            if (!draft.ownedThemes.includes(themeId)) {
                if (draft.balance < theme.price) throw new Error('Bu tema için yeterli CasualMoney yok.');
                draft.balance -= theme.price;
                draft.ownedThemes.push(themeId);
                addActivity(draft, `${theme.name} teması`, -theme.price);
            }
            draft.selectedTheme = themeId;
        });
        applyTheme(themeId);
        return profile;
    }

    function selectTheme(themeId) {
        if (cheatsActive()) throw new Error('Hileleri kapatana kadar seçimler kaydedilmez.');
        if (!themes[themeId]) throw new Error('Tema bulunamadı.');
        const profile = update((draft) => {
            if (!draft.ownedThemes.includes(themeId)) throw new Error('Önce bu temayı satın almalısın.');
            draft.selectedTheme = themeId;
        });
        applyTheme(themeId);
        return profile;
    }

    function buyOwl(owlId) {
        if (cheatsActive()) throw new Error('Hileleri kapatana kadar mağaza alışverişi duraklatıldı.');
        const owl = owls[owlId];
        if (!owl) throw new Error('Baykuş bulunamadı.');
        return update((draft) => {
            if (!draft.ownedOwls.includes(owlId)) {
                if (draft.balance < owl.price) throw new Error('Bu baykuş için yeterli CasualMoney yok.');
                draft.balance -= owl.price;
                draft.ownedOwls.push(owlId);
                addActivity(draft, `${owl.name} açıldı`, -owl.price);
            }
            draft.selectedOwl = owlId;
        });
    }

    function selectOwl(owlId) {
        if (cheatsActive()) throw new Error('Hileleri kapatana kadar seçimler kaydedilmez.');
        if (!owls[owlId]) throw new Error('Baykuş bulunamadı.');
        return update((draft) => {
            if (!draft.ownedOwls.includes(owlId)) throw new Error('Önce bu baykuşu satın almalısın.');
            draft.selectedOwl = owlId;
        });
    }

    function blocksRewardForScore(score) {
        return Math.min(BLOCKS_REWARD_CAP, Math.floor(Math.max(0, Number(score) || 0) / BLOCKS_POINTS_PER_CM));
    }

    function awardBlocksGame(result) {
        if (cheatsActive() || !current()) return { profile: current(), reward: 0 };
        const base = blocksRewardForScore(result?.score);
        if (!base) return { profile: current(), reward: 0 };
        let reward = 0;
        const profile = update((draft) => {
            reward = grant(draft, base, 'Wood Blocks oyunu');
        });
        return { profile, reward };
    }

    function sonHatRewardForCoins(coins) {
        return Math.min(SONHAT_REWARD_CAP, Math.floor(Math.max(0, Number(coins) || 0) / SONHAT_COINS_PER_CM));
    }

    function awardSonHatRun(result) {
        if (cheatsActive() || !current()) return { profile: current(), reward: 0 };
        const base = sonHatRewardForCoins(result?.coins);
        if (!base) return { profile: current(), reward: 0 };
        let reward = 0;
        const profile = update((draft) => {
            reward = grant(draft, base, result?.won ? 'Son Hat zaferi' : 'Son Hat savaşı');
        });
        return { profile, reward };
    }

    function buyWood(woodId) {
        if (cheatsActive()) throw new Error('Hileleri kapatana kadar mağaza alışverişi duraklatıldı.');
        const wood = woods[woodId];
        if (!wood) throw new Error('Ahşap bulunamadı.');
        return update((draft) => {
            if (!draft.ownedWoods.includes(woodId)) {
                if (draft.balance < wood.price) throw new Error('Bu ahşap için yeterli CasualMoney yok.');
                draft.balance -= wood.price;
                draft.ownedWoods.push(woodId);
                addActivity(draft, `${wood.name} blokları açıldı`, -wood.price);
            }
            draft.selectedWood = woodId;
        });
    }

    function selectWood(woodId) {
        if (cheatsActive()) throw new Error('Hileleri kapatana kadar seçimler kaydedilmez.');
        if (!woods[woodId]) throw new Error('Ahşap bulunamadı.');
        return update((draft) => {
            if (!draft.ownedWoods.includes(woodId)) throw new Error('Önce bu ahşabı satın almalısın.');
            draft.selectedWood = woodId;
        });
    }

    function arenaRewardForMatch(result) {
        const kills = Math.max(0, Math.floor(Number(result?.kills) || 0));
        return Math.min(ARENA_REWARD_CAP, kills * ARENA_CM_PER_KILL + (result?.won ? ARENA_WIN_BONUS : 0));
    }

    function awardArenaMatch(result) {
        if (cheatsActive() || !current()) return { profile: current(), reward: 0 };
        const base = arenaRewardForMatch(result);
        if (!base) return { profile: current(), reward: 0 };
        let reward = 0;
        const profile = update((draft) => {
            reward = grant(draft, base, result?.won ? 'Arena FPS birinciliği' : 'Arena FPS maçı');
        });
        return { profile, reward };
    }

    function vektorRewardForMatch(result) {
        const kills = Math.max(0, Math.floor(Number(result?.kills) || 0));
        const rounds = Math.max(0, Math.floor(Number(result?.rounds) || 0));
        return Math.min(VEKTOR_REWARD_CAP, kills + rounds + (result?.won ? VEKTOR_WIN_BONUS : 0));
    }

    function awardVektorMatch(result) {
        if (cheatsActive() || !current()) return { profile: current(), reward: 0 };
        const base = vektorRewardForMatch(result);
        if (!base) return { profile: current(), reward: 0 };
        let reward = 0;
        const profile = update((draft) => {
            reward = grant(draft, base, result?.won ? 'Vektör zaferi' : 'Vektör maçı');
        });
        return { profile, reward };
    }

    function buyCamo(camoId) {
        if (cheatsActive()) throw new Error('Hileleri kapatana kadar mağaza alışverişi duraklatıldı.');
        const camo = camos[camoId];
        if (!camo) throw new Error('Kaplama bulunamadı.');
        return update((draft) => {
            if (!draft.ownedCamos.includes(camoId)) {
                if (draft.balance < camo.price) throw new Error('Bu kaplama için yeterli CasualMoney yok.');
                draft.balance -= camo.price;
                draft.ownedCamos.push(camoId);
                addActivity(draft, `${camo.name} silah kaplaması`, -camo.price);
            }
            draft.selectedCamo = camoId;
        });
    }

    function selectCamo(camoId) {
        if (cheatsActive()) throw new Error('Hileleri kapatana kadar seçimler kaydedilmez.');
        if (!camos[camoId]) throw new Error('Kaplama bulunamadı.');
        return update((draft) => {
            if (!draft.ownedCamos.includes(camoId)) throw new Error('Önce bu kaplamayı satın almalısın.');
            draft.selectedCamo = camoId;
        });
    }

    function upgradeOffice() {
        if (cheatsActive()) throw new Error('Hileleri kapatana kadar ilerleme kaydedilmez.');
        return update((draft) => {
            const office = offices[draft.officeLevel - 1];
            if (!office || office.upgradeCost === null) throw new Error('Ofisin zaten en yüksek seviyede.');
            if (draft.balance < office.upgradeCost) throw new Error('Ofis geliştirmesi için yeterli CasualMoney yok.');
            draft.balance -= office.upgradeCost;
            draft.officeLevel += 1;
            addActivity(draft, 'Ofis geliştirildi', -office.upgradeCost);
        });
    }

    function clearActivities() {
        return update((draft) => { draft.activities = []; });
    }

    function rebirthStatus(profile) {
        const source = profile || current();
        const rebirths = rebirthCountOf(source);
        const balance = Math.max(0, Math.floor(Number(source?.balance) || 0));
        const multiplier = 2 ** rebirths;
        const required = REBIRTH_BASE * multiplier;
        const maxed = rebirths >= MAX_REBIRTHS;
        return {
            rebirths,
            multiplier,
            nextMultiplier: maxed ? multiplier : multiplier * 2,
            balance,
            required,
            ready: !maxed && balance >= required,
            maxed
        };
    }

    function rebirth() {
        if (cheatsActive()) throw new Error('Hile açıkken yeniden doğuş kaydedilmez.');
        if (!current()) throw new Error('Yeniden doğmak için önce oturumu başlat.');
        const status = rebirthStatus(current());
        if (status.maxed) throw new Error('Yeniden doğuş sınırına ulaştın.');
        if (!status.ready) throw new Error(`Yeniden doğmak için kasada ${formatMoney(status.required)} CM olmalı.`);
        const profile = update((draft) => {
            draft.rebirths += 1;
            draft.balance = 0;
            draft.activities = [];
            addActivity(draft, `Yeniden doğuş · kazanç x${earnMultiplier(draft)}`, 0);
        });
        return profile;
    }

    function spend(amount, label) {
        const cost = Math.max(0, Math.floor(Number(amount) || 0));
        if (!current()) login('CasualOyuncu');
        // Cheat code purchases always persist, even when cheats are already active.
        return update((draft) => {
            if (draft.balance < cost) throw new Error('Yeterli CasualMoney yok.');
            draft.balance -= cost;
            addActivity(draft, label, -cost);
        }, { alwaysPersist: true });
    }

    function unlockAll() {
        if (!current()) login('CasualOyuncu');
        return update((draft) => {
            draft.ownedPaints = Object.keys(paints);
            draft.ownedThemes = Object.keys(themes);
            draft.ownedOwls = Object.keys(owls);
            draft.ownedWoods = Object.keys(woods);
            draft.ownedCamos = Object.keys(camos);
            draft.ownedLogs = Object.keys(logs);
            draft.ownedChisels = Object.keys(chisels);
            draft.officeLevel = offices.length;
            draft.selectedPaint = draft.selectedPaint || 'honey';
        });
    }

    function formatMoney(value) {
        return new Intl.NumberFormat('tr-TR').format(Math.max(0, Math.floor(Number(value) || 0)));
    }

    window.CasualProfile = Object.freeze({
        paints, themes, owls, woods, camos, logs, chisels, offices, current, login, logout, startSession, claimDailyBonus, todayKey,
        validateUsername, rewardForScore, awardWoodTurning, buyPaint, selectPaint, buyTheme, selectTheme,
        upgradeOffice, clearActivities, spend, unlockAll, formatMoney, rebirthStatus, rebirth, earnMultiplier,
        buyOwl, selectOwl, owlRewardForScore, awardOwlFlight,
        buyWood, selectWood, blocksRewardForScore, awardBlocksGame,
        sonHatRewardForCoins, awardSonHatRun,
        buyLog, selectLog, buyChisel, selectChisel, turnStars,
        buyCamo, selectCamo, arenaRewardForMatch, awardArenaMatch, vektorRewardForMatch, awardVektorMatch,
        SESSION_REWARD, DAILY_REWARD, REBIRTH_BASE, MAX_REBIRTHS, OWL_REWARD_CAP, BLOCKS_REWARD_CAP, BLOCKS_POINTS_PER_CM,
        SONHAT_REWARD_CAP, SONHAT_COINS_PER_CM, ARENA_REWARD_CAP, ARENA_CM_PER_KILL, ARENA_WIN_BONUS, VEKTOR_REWARD_CAP, VEKTOR_WIN_BONUS, TURN_SHELF_SIZE
    });
})();
