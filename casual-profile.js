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
            dailyBonusDate: '',
            sessionRewardDate: '',
            rebirths: 0,
            lifetimeEarned: 0,
            activities: [],
            woodTurning: { jobs: 0, bestScore: 0, totalEarned: 0, lastReward: 0 },
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

    function cleanProfile(profile) {
        const safe = profile && typeof profile === 'object' ? profile : {};
        const ownedPaints = Array.isArray(safe.ownedPaints) ? safe.ownedPaints.filter((id) => paints[id]) : ['natural', 'honey'];
        if (!ownedPaints.includes('natural')) ownedPaints.unshift('natural');
        if (!ownedPaints.includes('honey')) ownedPaints.push('honey');
        const ownedThemes = Array.isArray(safe.ownedThemes) ? safe.ownedThemes.filter((id) => themes[id]) : ['liquid'];
        if (!ownedThemes.includes('liquid')) ownedThemes.unshift('liquid');
        const ownedOwls = Array.isArray(safe.ownedOwls) ? safe.ownedOwls.filter((id) => owls[id]) : ['minerva'];
        if (!ownedOwls.includes('minerva')) ownedOwls.unshift('minerva');
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
            dailyBonusDate: String(safe.dailyBonusDate || ''),
            sessionRewardDate: String(safe.sessionRewardDate || ''),
            rebirths: Math.min(MAX_REBIRTHS, Math.max(0, Math.floor(Number(safe.rebirths) || 0))),
            lifetimeEarned: lifetimeEarnedOf(safe),
            activities,
            woodTurning: {
                jobs: Math.max(0, Math.floor(Number(safe.woodTurning?.jobs) || 0)),
                bestScore: Math.min(100, Math.max(0, Math.floor(Number(safe.woodTurning?.bestScore) || 0))),
                totalEarned: Math.max(0, Math.floor(Number(safe.woodTurning?.totalEarned) || 0)),
                lastReward: Math.max(0, Math.floor(Number(safe.woodTurning?.lastReward) || 0))
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

    function awardWoodTurning(result) {
        if (cheatsActive()) return { profile: current(), reward: 0 };
        const score = Math.min(100, Math.max(0, Math.round(Number(result?.score) || 0)));
        let reward = 0;
        const profile = update((draft) => {
            reward = grant(draft, rewardForScore(score, draft.officeLevel), 'Wood Turning ödülü');
            draft.woodTurning.jobs += 1;
            draft.woodTurning.bestScore = Math.max(draft.woodTurning.bestScore, score);
            draft.woodTurning.totalEarned += reward;
            draft.woodTurning.lastReward = reward;
        });
        return { profile, reward };
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
            draft.officeLevel = offices.length;
            draft.selectedPaint = draft.selectedPaint || 'honey';
        });
    }

    function formatMoney(value) {
        return new Intl.NumberFormat('tr-TR').format(Math.max(0, Math.floor(Number(value) || 0)));
    }

    window.CasualProfile = Object.freeze({
        paints, themes, owls, offices, current, login, logout, startSession, claimDailyBonus, todayKey,
        validateUsername, rewardForScore, awardWoodTurning, buyPaint, selectPaint, buyTheme, selectTheme,
        upgradeOffice, clearActivities, spend, unlockAll, formatMoney, rebirthStatus, rebirth, earnMultiplier,
        buyOwl, selectOwl, owlRewardForScore, awardOwlFlight,
        SESSION_REWARD, DAILY_REWARD, REBIRTH_BASE, MAX_REBIRTHS, OWL_REWARD_CAP
    });
})();
