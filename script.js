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
    const toast = document.getElementById('toast');
    let toastTimer;

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
        return Number(profile?.woodTurning?.totalEarned || 0);
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
            time.textContent = activity.time;
            copy.append(label, time);
            const amount = document.createElement('span');
            amount.className = `activity-amount${activity.amount < 0 ? ' spend' : ''}`;
            amount.textContent = `${activity.amount > 0 ? '+' : ''}${CasualProfile.formatMoney(activity.amount)} CM`;
            item.append(copy, amount);
            activityList.append(item);
        });
    }

    function renderThemes(profile) {
        themeGrid.replaceChildren();
        Object.values(CasualProfile.themes).forEach((theme) => {
            const card = themeTemplate.content.firstElementChild.cloneNode(true);
            const preview = card.querySelector('.theme-preview');
            preview.style.setProperty('--preview-bg', theme.preview[0]);
            preview.style.setProperty('--preview-accent', theme.preview[1]);
            card.querySelector('.theme-name').textContent = theme.name;
            const owned = Boolean(profile?.ownedThemes?.includes(theme.id));
            const active = profile?.selectedTheme === theme.id || (!profile && theme.id === 'liquid');
            card.querySelector('.theme-description').textContent = owned || theme.price === 0 ? theme.description : `${CasualProfile.formatMoney(theme.price)} CM ile aç`;
            const action = card.querySelector('.theme-action');
            if (active) {
                card.classList.add('active');
                action.textContent = 'Seçili';
                action.disabled = true;
            } else if (owned) {
                action.textContent = 'Uygula';
                action.addEventListener('click', () => {
                    CasualProfile.selectTheme(theme.id);
                    showToast(`${theme.name} teması uygulandı.`);
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
        const theme = CasualProfile.themes[profile?.selectedTheme || 'liquid'];
        const balance = profile?.balance || 0;
        sessionAvatar.textContent = profile ? initials(profile.displayName) : '?';
        sessionLabel.textContent = profile ? 'Oturum açık' : 'Oturumu başlat';
        balanceValue.textContent = CasualProfile.formatMoney(balance);
        themeBalanceValue.textContent = CasualProfile.formatMoney(balance);
        document.getElementById('earned-value').textContent = `${CasualProfile.formatMoney(totalEarned(profile))} CM`;
        document.getElementById('plays-value').textContent = CasualProfile.formatMoney(totalPlays());
        document.getElementById('active-theme-value').textContent = theme.name;
        dailyBonusButton.disabled = profile?.dailyBonusDate === CasualProfile.todayKey();
        dailyBonusButton.textContent = profile?.dailyBonusDate === CasualProfile.todayKey() ? 'Alındı' : 'Günlük ödül';
        renderThemes(profile);
        renderActivity(profile);
    }

    sessionButton.addEventListener('click', () => {
        const result = CasualProfile.startSession();
        showToast(result.granted ? `Oturum açıldı, +${result.reward} CM kazandın.` : 'Oturumun zaten açık.');
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
        if (!CasualProfile.current()?.activities?.length) return;
        CasualProfile.clearActivities();
        showToast('Hareketler temizlendi.');
    });

    window.addEventListener('casualprofilechange', render);
    render();
});
