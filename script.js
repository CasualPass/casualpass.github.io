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
    const cloudUi = {
        status: document.getElementById('cloud-status-text'),
        badge: document.getElementById('cloud-badge'),
        setup: document.getElementById('cloud-setup-note'),
        form: document.getElementById('cloud-auth-form'),
        username: document.getElementById('cloud-username'),
        email: document.getElementById('cloud-email'),
        otp: document.getElementById('cloud-otp'),
        otpStep: document.getElementById('otp-step'),
        sendOtp: document.getElementById('send-otp-btn'),
        error: document.getElementById('cloud-error'),
        connected: document.getElementById('cloud-connected'),
        emailLabel: document.getElementById('cloud-email-label'),
        lastSync: document.getElementById('cloud-last-sync'),
        syncNow: document.getElementById('sync-now-btn'),
        signOut: document.getElementById('cloud-signout-btn')
    };
    let toastTimer;
    let otpRequested = false;

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
        const cloud = typeof CasualCloud !== 'undefined' ? CasualCloud.getState() : { authenticated: false };

        document.getElementById('nav-balance').textContent = CasualProfile.formatMoney(profile?.balance || 0);
        document.getElementById('profile-button-label').textContent = profile ? `@${profile.displayName}` : 'Profil aç';
        profileBtn.classList.toggle('is-online', Boolean(profile));
        signedOutPanel.hidden = Boolean(profile);
        signedInPanel.hidden = !profile;
        document.getElementById('logout-btn').hidden = Boolean(cloud.authenticated);

        if (profile) {
            document.getElementById('profile-avatar').textContent = initials(profile.displayName);
            document.getElementById('profile-name').textContent = `@${profile.displayName}`;
            document.getElementById('profile-office').textContent = `${office.name} · x${office.multiplier.toFixed(2).replace('.', ',')}`;
            document.getElementById('profile-balance').textContent = CasualProfile.formatMoney(profile.balance);
            document.getElementById('profile-best').textContent = `${profile.woodTurning.bestScore}%`;
            if (cloudUi.username && !cloudUi.username.value) cloudUi.username.value = profile.displayName;
        }
    }

    function formatSyncTime(value) {
        if (!value) return 'Henüz eşitlenmedi';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Senkron tamamlandı';
        return `Son senkron: ${new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(date)}`;
    }

    function renderCloud() {
        if (typeof CasualCloud === 'undefined') return;
        const cloud = CasualCloud.getState();
        const statusCopy = {
            'local-only': 'Yalnızca bu cihazda saklanıyor',
            starting: 'Bulut bağlantısı hazırlanıyor…',
            ready: 'E-posta OTP ile bağlanmaya hazır',
            'sending-otp': 'OTP gönderiliyor…',
            'otp-sent': 'Kod e-postana gönderildi',
            verifying: 'Kod doğrulanıyor…',
            syncing: 'İlerleme eşitleniyor…',
            synced: 'Tüm cihazlarla güncel',
            error: cloud.error || 'Bulut bağlantısında sorun var'
        };

        cloudUi.status.textContent = statusCopy[cloud.status] || 'Bulut durumu kontrol ediliyor…';
        cloudUi.badge.textContent = cloud.authenticated ? 'SENKRON' : (cloud.configured ? 'HAZIR' : 'YEREL');
        cloudUi.badge.classList.toggle('is-online', cloud.authenticated);
        cloudUi.setup.hidden = cloud.configured;
        cloudUi.form.hidden = !cloud.configured || cloud.authenticated;
        cloudUi.connected.hidden = !cloud.authenticated;
        cloudUi.otpStep.hidden = !otpRequested || cloud.authenticated;
        cloudUi.sendOtp.disabled = ['sending-otp', 'verifying'].includes(cloud.status);
        cloudUi.syncNow.disabled = cloud.status === 'syncing';
        cloudUi.error.textContent = cloud.status === 'error' ? cloud.error : '';

        if (cloud.authenticated) {
            otpRequested = false;
            cloudUi.emailLabel.textContent = cloud.email || 'Bağlı hesap';
            cloudUi.lastSync.textContent = formatSyncTime(cloud.lastSyncedAt);
        }
        renderProfile();
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
    window.addEventListener('casualcloudchange', renderCloud);
    renderProfile();

    cloudUi.sendOtp?.addEventListener('click', async () => {
        cloudUi.error.textContent = '';
        const validation = CasualProfile.validateUsername(cloudUi.username.value);
        if (!validation.valid) {
            cloudUi.error.textContent = validation.message;
            cloudUi.username.focus();
            return;
        }
        try {
            await CasualCloud.requestOtp(cloudUi.email.value);
            otpRequested = true;
            renderCloud();
            cloudUi.otp.focus();
            showToast('OTP kodu e-posta adresine gönderildi.');
        } catch (error) {
            cloudUi.error.textContent = error.message;
            renderCloud();
        }
    });

    cloudUi.form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        cloudUi.error.textContent = '';
        try {
            await CasualCloud.verifyOtp(cloudUi.email.value, cloudUi.otp.value, cloudUi.username.value);
            cloudUi.otp.value = '';
            otpRequested = false;
            renderCloud();
            renderProfile();
            showToast('Profilin buluta bağlandı ve eşitlendi.');
            if (typeof playPopSound === 'function') playPopSound();
        } catch (error) {
            otpRequested = true;
            cloudUi.error.textContent = error.message;
            renderCloud();
        }
    });

    cloudUi.syncNow?.addEventListener('click', async () => {
        try {
            await CasualCloud.syncNow();
            renderCloud();
            showToast('İlerleme tüm cihazlarla eşitlendi.');
        } catch (error) {
            showToast(error.message);
        }
    });

    cloudUi.signOut?.addEventListener('click', async () => {
        try {
            await CasualCloud.signOut();
            renderCloud();
            renderProfile();
            showToast('Bulut oturumu kapatıldı; yerel profil bu cihazda kaldı.');
        } catch (error) {
            showToast(error.message);
        }
    });

    CasualCloud.ready.then(renderCloud);

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
