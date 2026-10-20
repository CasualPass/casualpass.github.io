document.addEventListener('DOMContentLoaded', () => {
    'use strict';
    const $ = id => document.getElementById(id);
    const cloud = window.CasualCloud;
    const otpMode = window.CASUALPASS_CLOUD?.loginMode === 'otp';
    let busy = false, pendingEmail = '', resendAt = 0, pendingSave = null;
    const buttons = ['account-send', 'account-verify', 'account-upload', 'account-download', 'account-signout', 'account-apply', 'account-change-email'];
    function message(text, error = false) { $('account-status').textContent = text; $('account-status').classList.toggle('account-error', error); }
    function render() {
        const state = cloud.getState();
        $('account-guest').hidden = state.authenticated;
        $('account-member').hidden = !state.authenticated;
        $('account-identity').textContent = state.email;
        $('account-badge').textContent = state.authenticated ? 'Hesap açık' : 'Misafir';
        $('account-email').readOnly = Boolean(pendingEmail);
        $('account-email').disabled = !state.configured || busy;
        $('account-code').disabled = busy;
        $('account-code-form').hidden = !otpMode || !pendingEmail || state.authenticated;
        buttons.forEach(id => { $(id).disabled = busy || !state.configured; });
        $('account-send').disabled ||= Date.now() < resendAt || state.status === 'loading';
        $('account-send').textContent = otpMode ? (pendingEmail ? 'Kodu yeniden gönder' : 'Giriş kodu gönder') : 'Giriş bağlantısı gönder';
        if (state.authenticated && pendingEmail) { pendingEmail = ''; $('account-code').value = ''; }
        if (!state.authenticated) { pendingSave = null; $('account-restore').hidden = true; }
    }
    async function run(action) {
        if (busy) return;
        busy = true; render();
        try { await action(); } catch (error) { message(error.message || 'İşlem tamamlanamadı.', true); }
        finally { busy = false; render(); }
    }
    $('account-email-form').addEventListener('submit', event => {
        event.preventDefault();
        if (Date.now() < resendAt) return;
        run(async () => {
            await cloud.ready;
            const result = await cloud.requestOtp($('account-email').value);
            pendingEmail = otpMode ? result.email : ''; resendAt = Date.now() + 60000;
            render(); message(otpMode ? 'Giriş kodu istendi. Gelen kutunu ve spam klasörünü kontrol et. Yeni kod için bir dakika bekle.' : 'Giriş bağlantısı istendi. E-postandaki bağlantıyı bu tarayıcıda aç. Gelen kutunu ve spam klasörünü kontrol et; yeni bağlantı için bir dakika bekle.');
            setTimeout(render, 60000);
        }).then(() => { if (pendingEmail) $('account-code').focus(); });
    });
    $('account-code-form').addEventListener('submit', event => {
        event.preventDefault();
        run(async () => { await cloud.verifyOtp(pendingEmail, $('account-code').value); $('account-code').value = ''; message(cloud.getState().persistent ? 'Giriş yapıldı. Yerel ilerlemen korunuyor.' : 'Giriş yapıldı. Tarayıcı depolaması kapalı olduğu için sayfa kapanınca yeniden giriş gerekir.'); });
    });
    $('account-change-email').addEventListener('click', () => { pendingEmail = ''; $('account-code').value = ''; render(); $('account-email').focus(); message('Yeni e-posta adresini gir.'); });
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
        message(state.error || (!state.configured ? 'Hesap bağlantısı henüz hazır değil. Misafir olarak oynamaya devam edebilirsin.' : state.authenticated ? 'Hesabın açık. İlerleme aktarımını aşağıdan yönetebilirsin.' : 'E-postanla giriş yapabilir veya misafir olarak devam edebilirsin.'), Boolean(state.error));
    });
    render();
});
