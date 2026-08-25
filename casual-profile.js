(function () {
    'use strict';

    const STORE_KEY = 'casualPassEconomyV1';
    const SESSION_KEY = 'casualPassSessionV1';
    const SCHEMA_VERSION = 1;

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

    const offices = [
        { level: 1, name: 'Garaj Tezgâhı', multiplier: 1, upgradeCost: 450 },
        { level: 2, name: 'Usta Atölyesi', multiplier: 1.25, upgradeCost: 1100 },
        { level: 3, name: 'Tasarım Stüdyosu', multiplier: 1.55, upgradeCost: 2400 },
        { level: 4, name: 'CasualWorks Ofisi', multiplier: 1.9, upgradeCost: null }
    ];

    function emptyStore() {
        return { version: SCHEMA_VERSION, profiles: {} };
    }

    function loadStore() {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORE_KEY));
            if (!parsed || typeof parsed !== 'object' || !parsed.profiles) return emptyStore();
            return { version: SCHEMA_VERSION, profiles: parsed.profiles };
        } catch (error) {
            return emptyStore();
        }
    }

    function saveStore(store) {
        localStorage.setItem(STORE_KEY, JSON.stringify(store));
    }

    function canonicalUsername(value) {
        return String(value || '').normalize('NFKC').trim().toLocaleLowerCase('tr-TR');
    }

    function validateUsername(value) {
        const displayName = String(value || '').normalize('NFKC').trim();
        if (displayName.length < 3 || displayName.length > 20) {
            return { valid: false, message: 'Kullanıcı adı 3–20 karakter olmalı.' };
        }
        if (!/^[\p{L}\p{N}._-]+$/u.test(displayName)) {
            return { valid: false, message: 'Yalnızca harf, rakam, nokta, tire ve alt çizgi kullan.' };
        }
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
            woodTurning: {
                jobs: 0,
                bestScore: 0,
                totalEarned: 0,
                lastReward: 0
            },
            createdAt: now,
            updatedAt: now
        };
    }

    function cleanProfile(profile) {
        const safe = profile && typeof profile === 'object' ? profile : {};
        const officeLevel = Math.min(offices.length, Math.max(1, Number(safe.officeLevel) || 1));
        const ownedPaints = Array.isArray(safe.ownedPaints)
            ? safe.ownedPaints.filter((id) => paints[id])
            : ['natural', 'honey'];
        if (!ownedPaints.includes('natural')) ownedPaints.unshift('natural');
        if (!ownedPaints.includes('honey')) ownedPaints.push('honey');

        return {
            ...safe,
            balance: Math.max(0, Math.floor(Number(safe.balance) || 0)),
            officeLevel,
            ownedPaints,
            selectedPaint: ownedPaints.includes(safe.selectedPaint) ? safe.selectedPaint : 'honey',
            woodTurning: {
                jobs: Math.max(0, Math.floor(Number(safe.woodTurning?.jobs) || 0)),
                bestScore: Math.min(100, Math.max(0, Math.floor(Number(safe.woodTurning?.bestScore) || 0))),
                totalEarned: Math.max(0, Math.floor(Number(safe.woodTurning?.totalEarned) || 0)),
                lastReward: Math.max(0, Math.floor(Number(safe.woodTurning?.lastReward) || 0))
            }
        };
    }

    function emit(profile) {
        window.dispatchEvent(new CustomEvent('casualprofilechange', { detail: profile }));
    }

    function current() {
        const id = canonicalUsername(localStorage.getItem(SESSION_KEY));
        if (!id) return null;
        const store = loadStore();
        if (!store.profiles[id]) return null;
        return cleanProfile(store.profiles[id]);
    }

    function login(username) {
        const validation = validateUsername(username);
        if (!validation.valid) throw new Error(validation.message);

        const store = loadStore();
        const existing = store.profiles[validation.id];
        const profile = existing
            ? cleanProfile({ ...existing, displayName: existing.displayName || validation.displayName })
            : makeProfile(validation.displayName, validation.id);

        store.profiles[validation.id] = profile;
        saveStore(store);
        localStorage.setItem(SESSION_KEY, validation.id);
        emit(profile);
        return profile;
    }

    function logout() {
        localStorage.removeItem(SESSION_KEY);
        emit(null);
    }

    function update(mutator) {
        const active = current();
        if (!active) throw new Error('Bu işlem için önce profil açmalısın.');

        const store = loadStore();
        const draft = cleanProfile(store.profiles[active.id]);
        mutator(draft);
        draft.updatedAt = new Date().toISOString();
        store.profiles[active.id] = cleanProfile(draft);
        saveStore(store);
        emit(store.profiles[active.id]);
        return store.profiles[active.id];
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
        });
        return { profile, reward };
    }

    function buyPaint(paintId) {
        const paint = paints[paintId];
        if (!paint) throw new Error('Boya bulunamadı.');

        return update((draft) => {
            if (draft.ownedPaints.includes(paintId)) {
                draft.selectedPaint = paintId;
                return;
            }
            if (draft.balance < paint.price) throw new Error('Bu boya için yeterli CasualMoney yok.');
            draft.balance -= paint.price;
            draft.ownedPaints.push(paintId);
            draft.selectedPaint = paintId;
        });
    }

    function selectPaint(paintId) {
        if (!paints[paintId]) throw new Error('Boya bulunamadı.');
        return update((draft) => {
            if (!draft.ownedPaints.includes(paintId)) throw new Error('Önce bu boyayı satın almalısın.');
            draft.selectedPaint = paintId;
        });
    }

    function upgradeOffice() {
        return update((draft) => {
            const office = offices[draft.officeLevel - 1];
            if (!office || office.upgradeCost === null) throw new Error('Ofisin zaten en yüksek seviyede.');
            if (draft.balance < office.upgradeCost) throw new Error('Ofis geliştirmesi için yeterli CasualMoney yok.');
            draft.balance -= office.upgradeCost;
            draft.officeLevel += 1;
        });
    }

    function formatMoney(value) {
        return new Intl.NumberFormat('tr-TR').format(Math.max(0, Math.floor(Number(value) || 0)));
    }

    window.CasualProfile = Object.freeze({
        paints,
        offices,
        current,
        login,
        logout,
        validateUsername,
        rewardForScore,
        awardWoodTurning,
        buyPaint,
        selectPaint,
        upgradeOffice,
        formatMoney
    });
})();
