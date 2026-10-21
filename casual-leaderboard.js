(() => {
    'use strict';
    const body = document.getElementById('leaderboard-body');
    if (!body) return;
    const message = document.getElementById('leaderboard-status');
    const publish = document.getElementById('leaderboard-publish');
    const sort = document.getElementById('leaderboard-sort');
    let busy = false;
    let rows = [];
    let cloudNotice = '';
    const number = value => new Intl.NumberFormat('tr-TR').format(Math.max(0, Math.floor(Number(value) || 0)));
    function duration(seconds) {
        seconds = Math.max(0, Math.floor(Number(seconds) || 0));
        const hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds % 3600 / 60);
        return hours ? `${number(hours)} sa ${minutes} dk` : minutes ? `${minutes} dk ${seconds % 60} sn` : `${seconds} sn`;
    }
    function render() {
        const totals = window.CasualActivity?.totals() || { active_seconds: 0, total_points: 0, played: 0, wins: 0 };
        const state = window.CasualCloud?.getState();
        const username = state?.username;
        const localName = username || window.CasualProfile?.current()?.displayName || 'Misafir';
        document.getElementById('your-active-time').textContent = duration(totals.active_seconds);
        document.getElementById('your-total-points').textContent = number(totals.total_points);
        body.replaceChildren();
        function row(values, local = false) {
            const tr = document.createElement('tr');
            if (local) tr.className = 'leaderboard-local';
            for (const value of values) {
                const td = document.createElement('td');
                td.textContent = value;
                tr.append(td);
            }
            body.append(tr);
        }
        rows.forEach((entry, index) => row([String(index + 1), entry.username, number(entry.total_points), duration(entry.active_seconds), number(entry.played), number(entry.wins)]));
        row(['—', `${localName} · bu tarayıcı`, number(totals.total_points), duration(totals.active_seconds), number(totals.played), number(totals.wins)], true);
        publish.disabled = busy || !state?.authenticated || Boolean(window.CasualCheats?.active());
        document.getElementById('leaderboard-refresh').disabled = busy;
        sort.disabled = busy;
        message.textContent = cloudNotice || (!state?.authenticated ? 'Genel tabloya katılmak için hesabına giriş yap. Yerel istatistiklerin aşağıda.' : 'Katıl / güncelle ile kullanıcı adını, toplam puanını ve süreni genel tabloda paylaş.');
    }
    async function refresh() {
        if (busy) return;
        busy = true; render();
        try {
            const result = await CasualCloud.listLeaderboard(sort.value);
            rows = Array.isArray(result) ? result : [];
            cloudNotice = rows.length ? `İlk ${rows.length} oyuncu · ${sort.options[sort.selectedIndex].text}. Yerel satırın sıralamaya dahil değildir.` : 'Genel tablo henüz boş. İlk katılan sen olabilirsin!';
        } catch (error) {
            rows = [];
            cloudNotice = error.status === 404 ? 'Genel tablo henüz kullanıma açılmadı. Şimdilik yerel istatistiklerin gösteriliyor.' : 'Genel tabloya ulaşılamadı. Yerel istatistiklerin korunuyor; Yenile ile tekrar deneyebilirsin.';
        } finally { busy = false; render(); }
    }
    publish.addEventListener('click', async () => {
        if (busy) return;
        busy = true; render();
        try {
            CasualActivity.flush();
            await CasualCloud.publishLeaderboard(CasualActivity.totals());
            cloudNotice = 'İstatistiklerin genel tabloya kaydedildi.';
        } catch (error) {
            cloudNotice = error.status === 404 ? 'Genel tablo henüz kullanıma açılmadı. Yerel istatistiklerin korunuyor.' : error.message;
        } finally { busy = false; render(); }
        if (cloudNotice === 'İstatistiklerin genel tabloya kaydedildi.') await refresh();
    });
    sort.addEventListener('change', refresh);
    document.getElementById('leaderboard-refresh').addEventListener('click', refresh);
    ['casualactivitychange', 'casualprofilechange', 'casualcloudchange', 'casual-cheat'].forEach(name => window.addEventListener(name, render));
    render();
    Promise.resolve(window.CasualCloud?.ready).then(refresh);
})();
