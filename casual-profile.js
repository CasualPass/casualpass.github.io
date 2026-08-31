(function () {
    'use strict';

    const PROFILE_COOKIE = 'casualpass_profile_v2';
    const SESSION_COOKIE = 'casualpass_session_v2';
    const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
    const MAX_ACTIVITIES = 5;

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
            dailyBonusDate: '',
            sessionRewardDate: '',
            activities: [],
            woodTurning: { jobs: 0, bestScore: 0, totalEarned: 0, lastReward: 0 },
            createdAt: now,
            updatedAt: now
        };
    }

    function cleanProfile(profile) {
        const safe = profile && typeof profile === 'object' ? profile : {};
        const ownedPaints = Array.isArray(safe.ownedPaints) ? safe.ownedPaints.filter((id) => paints[id]) : ['natural', 'honey'];
        if (!ownedPaints.includes('natural')) ownedPaints.unshift('natural');
        if (!ownedPaints.includes('honey')) ownedPaints.push('honey');
        const ownedThemes = Array.isArray(safe.ownedThemes) ? safe.ownedThemes.filter((id) => themes[id]) : ['liquid'];
        if (!ownedThemes.includes('liquid')) ownedThemes.unshift('liquid');
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
            dailyBonusDate: String(safe.dailyBonusDate || ''),
            sessionRewardDate: String(safe.sessionRewardDate || ''),
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
        writeProfile(profile);
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

    function update(mutator) {
        const active = current();
        if (!active) throw new Error('Bu işlem için önce oturumu başlatmalısın.');
        const draft = cleanProfile(active);
        mutator(draft);
        draft.updatedAt = new Date().toISOString();
        const clean = cleanProfile(draft);
        writeProfile(clean);
        emit(clean);
        return clean;
    }

    function startSession() {
        let profile = current();
        if (!profile) profile = login('CasualOyuncu');
        const granted = profile.sessionRewardDate !== todayKey();
        if (!granted) return { profile, granted: false, reward: 0 };
        const reward = 15;
        profile = update((draft) => {
            draft.balance += reward;
            draft.sessionRewardDate = todayKey();
            addActivity(draft, 'Oturum ödülü', reward);
        });
        return { profile, granted: true, reward };
    }

    function claimDailyBonus() {
        if (!current()) throw new Error('Günlük ödül için önce oturumu başlat.');
        const alreadyClaimed = current().dailyBonusDate === todayKey();
        if (alreadyClaimed) return { profile: current(), granted: false, reward: 0 };
        const reward = 20;
        const profile = update((draft) => {
            draft.balance += reward;
            draft.dailyBonusDate = todayKey();
            addActivity(draft, 'Günlük ödül', reward);
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
        const score = Math.min(100, Math.max(0, Math.round(Number(result?.score) || 0)));
        let reward = 0;
        const profile = update((draft) => {
            reward = rewardForScore(score, draft.officeLevel);
            draft.balance += reward;
            draft.woodTurning.jobs += 1;
            draft.woodTurning.bestScore = Math.max(draft.woodTurning.bestScore, score);
            draft.woodTurning.totalEarned += reward;
            draft.woodTurning.lastReward = reward;
            addActivity(draft, 'Wood Turning ödülü', reward);
        });
        return { profile, reward };
    }

    function buyPaint(paintId) {
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
        if (!paints[paintId]) throw new Error('Boya bulunamadı.');
        return update((draft) => {
            if (!draft.ownedPaints.includes(paintId)) throw new Error('Önce bu boyayı satın almalısın.');
            draft.selectedPaint = paintId;
        });
    }

    function buyTheme(themeId) {
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
        if (!themes[themeId]) throw new Error('Tema bulunamadı.');
        const profile = update((draft) => {
            if (!draft.ownedThemes.includes(themeId)) throw new Error('Önce bu temayı satın almalısın.');
            draft.selectedTheme = themeId;
        });
        applyTheme(themeId);
        return profile;
    }

    function upgradeOffice() {
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

    function formatMoney(value) {
        return new Intl.NumberFormat('tr-TR').format(Math.max(0, Math.floor(Number(value) || 0)));
    }

    window.CasualProfile = Object.freeze({
        paints, themes, offices, current, login, logout, startSession, claimDailyBonus, todayKey,
        validateUsername, rewardForScore, awardWoodTurning, buyPaint, selectPaint, buyTheme, selectTheme,
        upgradeOffice, clearActivities, formatMoney
    });
})();
