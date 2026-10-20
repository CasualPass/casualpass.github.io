document.addEventListener('DOMContentLoaded', () => {
    'use strict';
    const $ = id => document.getElementById(id);
    const cloud = window.CasualCloud;
    let busy = false, registering = false, pendingSave = null;
    const buttons = ['account-login', 'account-register-toggle', 'account-setup-submit', 'account-upload', 'account-download', 'account-signout', 'account-apply'];
    function message(text, error = false) { $('account-status').textContent = text; $('account-status').classList.toggle('account-error', error); }
    function render() {
        const state = cloud.getState();
        $('account-guest').hidden = state.authenticated;
        $('account-member').hidden = !state.authenticated;
        $('account-identity').textContent = state.username || state.email;
        $('account-badge').textContent = state.authenticated ? 'Hesap açık' : 'Misafir';
        $('account-setup-form').hidden = !state.authenticated || Boolean(state.username);
        $('account-confirm-row').hidden = !registering;
        $('account-password-confirm').required = registering;
        $('account-password').autocomplete = registering ? 'new-password' : 'current-password';
        $('account-login').textContent = registering ? 'Hesap oluştur' : 'Giriş yap';
        $('account-register-toggle').textContent = registering ? 'Zaten hesabım var' : 'Yeni hesap oluştur';
        buttons.forEach(id => { $(id).disabled = busy || !state.configured || state.status === 'loading'; });
        for (const id of ['account-username', 'account-password', 'account-password-confirm', 'account-setup-username', 'account-setup-password', 'account-setup-confirm']) $(id).disabled = busy || !state.configured;
        if (!state.authenticated) { pendingSave = null; $('account-restore').hidden = true; }
    }
    async function run(action) {
        if (busy) return;
        busy = true; render();
        try { await action(); } catch (error) { message(error.message || 'İşlem tamamlanamadı.', true); }
        finally { busy = false; render(); }
    }
    $('account-register-toggle').addEventListener('click', () => { registering = !registering; $('account-password').value = ''; $('account-password-confirm').value = ''; render(); });
    $('account-login-form').addEventListener('submit', event => {
        event.preventDefault();
        run(async () => {
            await cloud.ready;
            const password = $('account-password').value;
            try {
                if (registering && password !== $('account-password-confirm').value) throw new Error('Şifreler eşleşmiyor.');
                await cloud[registering ? 'signUp' : 'signIn']($('account-username').value, password);
                message('Giriş yapıldı. Yerel ilerlemen korunuyor.');
            } finally { $('account-password').value = ''; $('account-password-confirm').value = ''; }
        });
    });
    $('account-setup-form').addEventListener('submit', event => {
        event.preventDefault();
        run(async () => {
            const password = $('account-setup-password').value;
            try {
                if (password !== $('account-setup-confirm').value) throw new Error('Şifreler eşleşmiyor.');
                await cloud.setupCredentials($('account-setup-username').value, password);
                message('Kullanıcı adı ve şifren tanımlandı. Mevcut hesabın ve bulut kaydın korundu.');
            } finally { $('account-setup-password').value = ''; $('account-setup-confirm').value = ''; }
        });
    });
    $('account-signout').addEventListener('click', () => run(async () => { pendingSave = null; const state = await cloud.signOut(); message(state.error || 'Hesaptan çıkış yapıldı. Yerel ilerlemen bu cihazda duruyor.', Boolean(state.error)); }));
    $('account-upload').addEventListener('click', () => {
        if (!confirm('Bu tarayıcıdaki oyun ilerlemen Supabase hesabına gönderilecek ve varsa önceki bulut kaydının yerini alacak. Devam edilsin mi?')) return;
        run(async () => { await cloud.uploadSave(); message('İlerlemen buluta kaydedildi.'); });
    });
    $('account-download').addEventListener('click', () => run(async () => {
        pendingSave = null; $('account-restore').hidden = true;
        const result = await cloud.downloadSave();
        if (!result.ok) throw new Error('Bulut kaydı doğrulanamadı. Yerel ilerlemen değiştirilmedi.');
        pendingSave = result;
        const date = new Date(result.created);
        $('account-restore-detail').textContent = `${Number.isNaN(date.getTime()) ? 'Tarihi bilinmeyen' : date.toLocaleString('tr-TR')} bulut kaydı · ${result.count} kayıt alanı.`;
        $('account-restore').hidden = false; message('Bulut kaydı hazır. Yüklemeden önce aşağıdaki bilgileri kontrol et.');
    }));
    $('account-apply').addEventListener('click', () => run(async () => { if (!pendingSave) return; cloud.applySave(pendingSave); pendingSave = null; location.reload(); }));
    $('account-cancel-restore').addEventListener('click', () => { pendingSave = null; $('account-restore').hidden = true; message('Yükleme iptal edildi.'); });
    window.addEventListener('casualcloudchange', () => { pendingSave = null; $('account-restore').hidden = true; render(); });
    cloud.ready.then(state => {
        render();
        message(state.error || (!state.configured ? 'Hesap bağlantısı henüz hazır değil. Misafir olarak oynamaya devam edebilirsin.' : state.authenticated ? 'Hesabın açık. İlerleme aktarımını aşağıdan yönetebilirsin.' : 'Kullanıcı adı ve şifrenle giriş yapabilir veya hesap oluşturabilirsin.'), Boolean(state.error));
    });
    render();
});
