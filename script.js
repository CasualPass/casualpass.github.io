document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    const sessionButton = document.getElementById('session-button');
    const sessionLabel = document.getElementById('session-button-label');
    const sessionAvatar = document.getElementById('session-avatar');
    const balanceValue = document.getElementById('balance-value');
    const themeBalanceValue = document.getElementById('theme-balance-value');
    const dailyBonusButton = document.getElementById('daily-bonus-button');
    const themeGrid = document.getElementById('theme-grid');
    const themeTemplate = document.getElementById('theme-template');
    const activityList = document.getElementById('activity-list');
    const sessionRewardValue = document.getElementById('session-reward-value');
    const toast = document.getElementById('toast');
    let toastTimer;
    let previewTheme = null;
    let rebirthArmed = false;
    let rebirthArmTimer;

    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('show');
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2900);
    }

    function initials(name) {
        return String(name || 'CP').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toLocaleUpperCase('tr-TR');
    }

    function totalPlays() {
        return Object.values(getGameStats()).reduce((sum, game) => sum + (Number(game?.played) || 0), 0);
    }

    function totalEarned(profile) {
        return Number(profile?.lifetimeEarned || 0);
    }

    function signedMoney(amount) {
        const value = Math.trunc(Number(amount) || 0);
        const sign = value > 0 ? '+' : value < 0 ? '-' : '';
        return `${sign}${CasualProfile.formatMoney(Math.abs(value))} CM`;
    }

    function renderActivity(profile) {
        activityList.replaceChildren();
        const activities = profile?.activities || [];
        if (!activities.length) {
            const item = document.createElement('li');
            item.className = 'empty-activity';
            item.textContent = 'İlk ödülün burada görünecek.';
            activityList.append(item);
            return;
        }
        activities.forEach((activity) => {
            const item = document.createElement('li');
            item.className = 'activity-item';
            const copy = document.createElement('div');
            const label = document.createElement('strong');
            label.textContent = activity.label;
            const time = document.createElement('small');
            time.textContent = String(activity.time || '');
            copy.append(label, time);
            item.append(copy);
            if (activity.amount) {
                const amount = document.createElement('span');
                amount.className = `activity-amount${activity.amount < 0 ? ' spend' : ''}`;
                amount.textContent = signedMoney(activity.amount);
                item.append(amount);
            }
            activityList.append(item);
        });
    }

    function renderThemes(profile) {
        themeGrid.replaceChildren();
        const allOpen = Boolean(window.CasualCheats?.features());
        Object.values(CasualProfile.themes).forEach((theme) => {
            const card = themeTemplate.content.firstElementChild.cloneNode(true);
            const preview = card.querySelector('.theme-preview');
            preview.style.setProperty('--preview-bg', theme.preview[0]);
            preview.style.setProperty('--preview-accent', theme.preview[1]);
            card.querySelector('.theme-name').textContent = theme.name;
            const owned = allOpen || Boolean(profile?.ownedThemes?.includes(theme.id));
            const active = (previewTheme || profile?.selectedTheme || 'liquid') === theme.id;
            card.querySelector('.theme-description').textContent = owned || theme.price === 0 ? theme.description : `${CasualProfile.formatMoney(theme.price)} CM ile aç`;
            const action = card.querySelector('.theme-action');
            if (active) {
                card.classList.add('active');
                action.textContent = 'Seçili';
                action.disabled = true;
            } else if (owned) {
                action.textContent = allOpen ? 'Önizle' : 'Uygula';
                action.addEventListener('click', () => {
                    if (allOpen) {
                        previewTheme = theme.id;
                        document.body.classList.remove('theme-liquid', 'theme-paper', 'theme-neon', 'theme-retro');
                        document.body.classList.add(`theme-${theme.id}`);
                        render();
                        showToast(`${theme.name} önizlemesi · kaydedilmez.`);
                    } else {
                        try {
                            CasualProfile.selectTheme(theme.id);
                            showToast(`${theme.name} teması uygulandı.`);
                        } catch (error) { showToast(error.message); }
                    }
                });
            } else {
                action.textContent = `${theme.price} CM`;
                action.addEventListener('click', () => {
                    if (!CasualProfile.current()) {
                        showToast('Tema almak için önce oturumu başlat.');
                        return;
                    }
                    try {
                        CasualProfile.buyTheme(theme.id);
                        showToast(`${theme.name} teması açıldı.`);
                    } catch (error) {
                        showToast(error.message);
                    }
                });
            }
            themeGrid.append(card);
        });
    }

    function render() {
        const profile = CasualProfile.current();
        if (!window.CasualCheats?.features()) previewTheme = null;
        const theme = CasualProfile.themes[previewTheme || profile?.selectedTheme || 'liquid'];
        const balance = profile?.balance || 0;
        sessionAvatar.textContent = profile ? initials(profile.displayName) : '?';
        sessionLabel.textContent = profile ? 'Oturum açık' : 'Oturumu başlat';
        balanceValue.textContent = CasualProfile.formatMoney(balance);
        themeBalanceValue.textContent = CasualProfile.formatMoney(balance);
        const rebirth = CasualProfile.rebirthStatus(profile);
        sessionRewardValue.textContent = `+${CasualProfile.formatMoney(CasualProfile.SESSION_REWARD * rebirth.multiplier)} CM`;
        document.getElementById('earned-value').textContent = `${CasualProfile.formatMoney(totalEarned(profile))} CM`;
        document.getElementById('plays-value').textContent = CasualProfile.formatMoney(totalPlays());
        document.getElementById('active-theme-value').textContent = theme.name;
        dailyBonusButton.disabled = CasualCheats.active() || profile?.dailyBonusDate === CasualProfile.todayKey();
        dailyBonusButton.textContent = CasualCheats.active() ? 'Hile açık' : profile?.dailyBonusDate === CasualProfile.todayKey() ? 'Alındı' : 'Günlük ödül';
        renderThemes(profile);
        renderActivity(profile);
        renderCheats();
        renderRebirth(profile, rebirth);
    }

    function renderRebirth(profile, status) {
        const ready = Boolean(profile) && !CasualCheats.active() && status.ready;
        if (!ready) {
            rebirthArmed = false;
            window.clearTimeout(rebirthArmTimer);
        }
        const button = document.getElementById('rebirth-button');
        const note = document.getElementById('rebirth-note');
        const fill = Math.min(100, status.required ? (status.balance / status.required) * 100 : 0);
        document.getElementById('rebirth-multiplier').textContent = `x${status.multiplier}`;
        document.getElementById('rebirth-progress').textContent = status.maxed ? 'Sınır' : `${CasualProfile.formatMoney(Math.min(status.balance, status.required))} / ${CasualProfile.formatMoney(status.required)} CM`;
        document.getElementById('rebirth-fill').style.width = `${status.maxed ? 100 : fill}%`;
        const track = document.getElementById('rebirth-track');
        track.setAttribute('aria-valuemax', String(status.required));
        track.setAttribute('aria-valuenow', String(Math.min(status.balance, status.required)));
        button.classList.toggle('is-armed', rebirthArmed);
        button.disabled = !ready;
        if (!profile) {
            button.textContent = 'Önce oturum';
            note.textContent = 'Oturumu aç, 500 CM biriktir. İstersen kasayı sıfırla; sonraki kazançlar iki kat olur.';
        } else if (CasualCheats.active()) {
            button.textContent = 'Hile açık';
            note.textContent = 'Yeniden doğmak için önce tüm hileleri kapat.';
        } else if (status.maxed) {
            button.textContent = 'Sınırdasın';
            note.textContent = `Kazanç x${status.multiplier}. Daha fazla yeniden doğuş yok.`;
        } else if (rebirthArmed) {
            button.textContent = 'Kasayı sıfırla';
            note.textContent = `Kasadaki ${CasualProfile.formatMoney(profile.balance)} CM silinir. Tema, ofis ve kodlar kalır.`;
        } else if (status.ready) {
            button.textContent = 'Yeniden doğ';
            note.textContent = `Hazır. Kasa sıfırlanır, kazanç x${status.nextMultiplier} olur. Eşyaların kalır.`;
        } else {
            button.textContent = 'Henüz erken';
            note.textContent = `${CasualProfile.formatMoney(status.required)} CM biriktirince sıfırlayabilirsin. Sonraki kazanç x${status.nextMultiplier} olur.`;
        }
    }

    function renderCheats() {
        const grid = document.getElementById('cheat-grid');
        if (!grid || !window.CasualCheats) return;
        document.getElementById('cheat-session').hidden = !CasualCheats.active();
        grid.replaceChildren();
        CasualCheats.catalog().forEach((item) => {
            const card = document.createElement('article');
            card.className = `cheat-card${item.owned ? ' is-owned' : ''}`;
            const title = document.createElement('strong');
            title.className = 'cheat-name';
            title.textContent = item.name;
            const hint = document.createElement('small');
            hint.className = 'cheat-hint';
            hint.textContent = item.hint;
            const code = document.createElement('code');
            code.className = 'cheat-code';
            code.textContent = item.owned ? item.code : '••••';
            code.setAttribute('aria-label', item.owned ? `Kod: ${item.code}` : 'Kod kilitli');
            const details = document.createElement('div');
            details.className = 'cheat-details';
            const status = document.createElement('span');
            status.className = `cheat-status${item.owned ? ' owned' : ''}`;
            status.textContent = item.owned ? 'Koleksiyonunda' : 'Kilitli';
            const price = document.createElement('span');
            price.className = 'cheat-price';
            price.textContent = item.owned ? 'Açıldı' : `${CasualProfile.formatMoney(item.price)} CM`;
            const button = document.createElement('button');
            button.className = 'cheat-action';
            button.type = 'button';
            button.textContent = item.owned ? 'Açıldı' : 'Kodu aç';
            button.disabled = item.owned;
            button.setAttribute('aria-label', item.owned ? `${item.name} kodu açık` : `${item.name} kodunu ${CasualProfile.formatMoney(item.price)} CasualMoney karşılığında aç`);
            button.addEventListener('click', () => {
                const result = CasualCheats.buy(item.id);
                showToast(result.message);
                render();
            });
            details.append(status, price);
            card.append(title, hint, code, details, button);
            grid.append(card);
        });
    }

    sessionButton.addEventListener('click', () => {
        if (CasualCheats.active()) { showToast('CM kazanmak için önce tüm hileleri kapat.'); return; }
        const result = CasualProfile.startSession();
        showToast(result.granted ? `Oturum açıldı, +${result.reward} CM kazandın.` : 'Oturumun zaten açık.');
    });

    document.getElementById('rebirth-button').addEventListener('click', () => {
        if (!rebirthArmed) {
            rebirthArmed = true;
            window.clearTimeout(rebirthArmTimer);
            rebirthArmTimer = window.setTimeout(() => {
                rebirthArmed = false;
                render();
            }, 6000);
            render();
            return;
        }
        rebirthArmed = false;
        window.clearTimeout(rebirthArmTimer);
        try {
            const next = CasualProfile.rebirthStatus().nextMultiplier;
            CasualProfile.rebirth();
            showToast(`Yeniden doğdun. Kazanç artık x${next}.`);
        } catch (error) {
            showToast(error.message);
            render();
        }
    });

    dailyBonusButton.addEventListener('click', () => {
        try {
            const result = CasualProfile.claimDailyBonus();
            showToast(result.granted ? `Günlük ödül: +${result.reward} CM.` : 'Günlük ödülünü bugün zaten aldın.');
        } catch (error) {
            showToast(error.message);
        }
    });

    document.getElementById('clear-activity-button').addEventListener('click', () => {
        if (CasualCheats.active()) { showToast('Hile açıkken ilerleme kaydedilmez.'); return; }
        if (!CasualProfile.current()?.activities?.length) return;
        CasualProfile.clearActivities();
        showToast('Hareketler temizlendi.');
    });

    window.addEventListener('casualprofilechange', render);
    window.addEventListener('casual-cheat', render);
    document.getElementById('cheat-disable-all').addEventListener('click', () => CasualCheats.disableAll());
    render();
});
