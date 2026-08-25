document.addEventListener('DOMContentLoaded', () => {
    const profileModal = document.getElementById('profile-modal');
    const settingsModal = document.getElementById('settings-modal');
    const profileForm = document.getElementById('profile-form');
    const usernameInput = document.getElementById('username-input');
    const profileError = document.getElementById('profile-error');
    const signedOutPanel = document.getElementById('signed-out-panel');
    const signedInPanel = document.getElementById('signed-in-panel');
    const profileBtn = document.getElementById('profile-btn');
    const toast = document.getElementById('toast');
    let toastTimer;

    function showToast(message) {
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('show');
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2600);
    }

    function openModal(modal) {
        if (!modal) return;
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        window.setTimeout(() => {
            const target = modal.querySelector('input:not([type="checkbox"]), button');
            target?.focus();
        }, 50);
        if (typeof playClickSound === 'function') playClickSound();
    }

    function closeModal(modal) {
        if (!modal) return;
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    function initials(name) {
        return String(name || 'CP')
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0])
            .join('')
            .toLocaleUpperCase('tr-TR');
    }

    function renderProfile() {
        const profile = CasualProfile.current();
        const office = profile ? CasualProfile.offices[profile.officeLevel - 1] : null;

        document.getElementById('nav-balance').textContent = CasualProfile.formatMoney(profile?.balance || 0);
        document.getElementById('profile-button-label').textContent = profile ? `@${profile.displayName}` : 'Profil aç';
        profileBtn.classList.toggle('is-online', Boolean(profile));
        signedOutPanel.hidden = Boolean(profile);
        signedInPanel.hidden = !profile;

        if (profile) {
            document.getElementById('profile-avatar').textContent = initials(profile.displayName);
            document.getElementById('profile-name').textContent = `@${profile.displayName}`;
            document.getElementById('profile-office').textContent = `${office.name} · x${office.multiplier.toFixed(2).replace('.', ',')}`;
            document.getElementById('profile-balance').textContent = CasualProfile.formatMoney(profile.balance);
            document.getElementById('profile-best').textContent = `${profile.woodTurning.bestScore}%`;
        }
    }

    [profileBtn, document.getElementById('money-chip'), document.getElementById('hero-profile-btn')].forEach((button) => {
        button?.addEventListener('click', () => openModal(profileModal));
    });

    document.getElementById('settings-btn')?.addEventListener('click', () => openModal(settingsModal));

    document.querySelectorAll('[data-close-modal]').forEach((button) => {
        button.addEventListener('click', () => closeModal(document.getElementById(button.dataset.closeModal)));
    });

    document.querySelectorAll('.modal-overlay').forEach((overlay) => {
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) closeModal(overlay);
        });
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        document.querySelectorAll('.modal-overlay.active').forEach(closeModal);
    });

    profileForm?.addEventListener('submit', (event) => {
        event.preventDefault();
        profileError.textContent = '';
        try {
            const profile = CasualProfile.login(usernameInput.value);
            usernameInput.value = '';
            renderProfile();
            showToast(`Hoş geldin, @${profile.displayName}.`);
            if (typeof playPopSound === 'function') playPopSound();
        } catch (error) {
            profileError.textContent = error.message;
            usernameInput.focus();
        }
    });

    document.getElementById('logout-btn')?.addEventListener('click', () => {
        CasualProfile.logout();
        renderProfile();
        showToast('Bu cihazdaki oturum kapatıldı.');
    });

    window.addEventListener('casualprofilechange', renderProfile);
    renderProfile();

    const soundToggle = document.getElementById('setting-sound');
    const effectsToggle = document.getElementById('setting-effects');
    const themeOptions = document.querySelectorAll('.theme-option');

    soundToggle.checked = cpSettings.sound;
    effectsToggle.checked = cpSettings.effects;

    function renderThemeSelection() {
        themeOptions.forEach((option) => {
            const isSelected = option.dataset.theme === cpSettings.theme;
            option.classList.toggle('selected', isSelected);
            option.setAttribute('aria-pressed', String(isSelected));
        });
    }

    soundToggle.addEventListener('change', (event) => {
        cpSettings.sound = event.target.checked;
        saveSettings();
        if (event.target.checked && typeof playClickSound === 'function') playClickSound();
    });

    effectsToggle.addEventListener('change', (event) => {
        cpSettings.effects = event.target.checked;
        saveSettings();
        applySettings();
    });

    themeOptions.forEach((option) => {
        option.addEventListener('click', () => {
            cpSettings.theme = option.dataset.theme;
            saveSettings();
            applySettings();
            renderThemeSelection();
            if (typeof playClickSound === 'function') playClickSound();
        });
    });
    renderThemeSelection();

    function renderStats() {
        const statsGrid = document.getElementById('stats-grid');
        if (!statsGrid) return;
        const stats = typeof getGameStats === 'function' ? getGameStats() : {};
        const entries = Object.entries(stats);

        statsGrid.replaceChildren();
        if (!entries.length) {
            const empty = document.createElement('p');
            empty.className = 'stats-empty';
            empty.textContent = 'Henüz oyun kaydı yok. İlk skorunu bırakmak için bir oyun seç.';
            statsGrid.appendChild(empty);
            return;
        }

        entries.forEach(([name, game]) => {
            const card = document.createElement('article');
            card.className = 'stat-card';
            const title = document.createElement('h3');
            title.textContent = name;
            card.appendChild(title);

            const rows = [
                ['Oynanan', game.played || 0],
                ['Kazanılan', game.won || 0],
                ['Başarı', `${game.played ? Math.round(((game.won || 0) / game.played) * 100) : 0}%`]
            ];
            if (Number(game.highScore) > 0) rows.push(['En iyi', game.highScore]);

            rows.forEach(([label, value]) => {
                const row = document.createElement('div');
                row.className = 'stat-row';
                const labelEl = document.createElement('span');
                labelEl.textContent = label;
                const valueEl = document.createElement('span');
                valueEl.className = 'stat-value';
                valueEl.textContent = value;
                row.append(labelEl, valueEl);
                card.appendChild(row);
            });
            statsGrid.appendChild(card);
        });
    }
    renderStats();

    const revealElements = document.querySelectorAll('.reveal');
    if (!cpSettings.effects || !('IntersectionObserver' in window)) {
        revealElements.forEach((element) => element.classList.add('is-visible'));
    } else {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.12 });
        revealElements.forEach((element) => observer.observe(element));
    }
});
