(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const originals = [...document.querySelectorAll('#official-games .game-card')];
    const form = $('market-form');
    const dialog = $('submit-dialog');
    let community = [], offset = 0, more = false, requestId = 0, submitting = false;
    const filters = () => ({ search: $('market-search').value.trim(), category: $('market-category').value, mine: $('market-source').value === 'mine' });
    const isSignedIn = () => Boolean(window.CasualCloud?.getState().authenticated);
    function authUI() {
        $('market-account').textContent = isSignedIn() ? `@${CasualCloud.getState().username || 'Oyuncu'}` : 'Giriş yap';
        $('market-auth-note').hidden = isSignedIn();
        $('market-submit').disabled = submitting || !isSignedIn();
    }
    function official() {
        const f = filters(), source = $('market-source').value;
        let count = 0;
        for (const card of originals) {
            const match = !['community', 'mine'].includes(source) && (f.category === 'all' || card.dataset.tags.split(' ').includes(f.category)) && card.textContent.toLocaleLowerCase('tr').includes(f.search.toLocaleLowerCase('tr'));
            card.hidden = !match;
            if (card.parentElement?.classList.contains('market-game')) card.parentElement.hidden=!match;
            if (match) count++;
        }
        $('official-section').hidden = count === 0;
        $('official-count').textContent = `${count} oyun`;
        return count;
    }
    function render() {
        const officialCount = official();
        $('community-games').replaceChildren();
        const source = $('market-source').value;
        $('community-section').hidden = source === 'official';
        for (const game of community) {
            if(game.status!=='approved' && !(filters().mine && game.is_owner))continue;
            let valid;
            try { valid = CasualMarketRules.validateGame(game); } catch { continue; }
            const card = document.createElement('article');
            card.className = 'community-card';
            const link = document.createElement('a');
            link.href = valid.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.referrerPolicy = 'no-referrer';
            const icon = document.createElement('span'); icon.className = 'community-icon'; icon.innerHTML = window.CasualGameIcons ? CasualGameIcons.svg(CasualGameIcons.FALLBACK) : ''; icon.setAttribute('aria-hidden','true');
            const badge = document.createElement('small'); badge.textContent = `TOPLULUK · ${CasualMarketRules.categories[valid.category]}`;
            const name = document.createElement('h3'); name.textContent = valid.title;
            const description = document.createElement('p'); description.textContent = valid.description;
            const author = document.createElement('span'); author.className = 'community-author'; author.textContent = `@${game.author} · ${new URL(valid.url).hostname}`;
            link.append(icon, badge, name, description, author);
            link.setAttribute('aria-label', `${valid.title} — ${new URL(valid.url).hostname} sitesinde oyna, yeni sekmede açılır`);
            card.append(link);
            const stateLabel=document.createElement('p');stateLabel.className='review-state';
            stateLabel.textContent=game.status==='approved'?'Onaylandı':game.status==='rejected'?`Reddedildi${game.review_note ? ': '+game.review_note : ''}`:'Onay bekliyor';card.append(stateLabel);
            if(game.status==='approved') {
                const pin=document.createElement('button');pin.type='button';pin.className='home-pin-button';pin.dataset.homeId=`community:${game.id}`;card.append(pin);bindPin(pin);
            }
            if (game.is_owner) {
                const button = document.createElement('button'); button.type='button'; button.className='text-button'; button.textContent=game.status==='approved'?'Yayından kaldır':'Başvuruyu geri çek';
                button.addEventListener('click', async () => {
                    button.disabled=true;
                    try { await CasualCloud.unpublishMarketGame(game.id); await load(); }
                    catch { $('community-status').textContent='İlan kaldırılamadı. Bağlantını ve hesabını kontrol et.'; button.disabled=false; }
                });
                card.append(button);
            }
            $('community-games').append(card);
        }
        $('market-empty').hidden = officialCount > 0 || $('community-games').children.length > 0;
        $('market-more').hidden = !more || source === 'official';
        $('community-count').textContent = `${$('community-games').children.length} oyun`;
    }
    async function load(append = false) {
        const version = ++requestId;
        if (!append) { community=[]; offset=0; more=false; }
        render();
        if ($('market-source').value === 'official') { $('community-status').textContent=''; return; }
        if (filters().mine && !isSignedIn()) { $('community-status').textContent='Kendi ilanlarını görmek için hesabına giriş yap.'; return; }
        $('community-status').textContent='Topluluk oyunları yükleniyor…';
        $('market-more').disabled=true;
        try {
            const result = await CasualCloud.listMarketGames({ ...filters(), offset });
            if (version !== requestId) return;
            const batch = Array.isArray(result) ? result : [];
            community = append ? community.concat(batch) : batch;
            offset += batch.length; more=batch.length===24;
            $('community-status').textContent=community.length ? 'Topluluk oyunları geliştiricilerinin sitelerinde, yeni sekmede açılır.' : 'Henüz eşleşen topluluk oyunu yok. Kendi oyununu ekleyebilirsin!';
        } catch (error) {
            if (version !== requestId) return;
            $('community-status').textContent=error.status===404 ? 'Topluluk paylaşımı henüz kullanıma açılmadı. CasualPass oyunlarını hemen oynayabilirsin.' : 'Topluluk oyunları yüklenemedi. Yenile ile tekrar deneyebilirsin.';
        } finally {
            if (version === requestId) { $('market-more').disabled=false; render(); }
        }
    }
    function updatePins() {
        const ids=CasualHomeGames.current();
        document.querySelectorAll('[data-home-id]').forEach(button=>{
            const added=ids.includes(button.dataset.homeId);button.textContent=added?'Ana ekrandan kaldır':'Oyunu ana ekrana ekle';button.setAttribute('aria-pressed',String(added));
        });
    }
    function bindPin(button) {
        const added=CasualHomeGames.current().includes(button.dataset.homeId);button.textContent=added?'Ana ekrandan kaldır':'Oyunu ana ekrana ekle';button.setAttribute('aria-pressed',String(added));
        button.addEventListener('click',()=>{
            try {CasualHomeGames.change(button.dataset.homeId);$('home-pin-status').textContent=`Ana ekranın güncellendi · ${CasualHomeGames.current().length}/${CasualHomeGames.LIMIT} oyun.`;}
            catch(error){$('home-pin-status').textContent=error.message;}
            updatePins();
        });updatePins();
    }
    document.querySelectorAll('#official-games [data-home-id]').forEach(bindPin);
    window.addEventListener('casualhomechange',updatePins);
    window.addEventListener('casualmarketchange',()=>load());
    let debounce;
    $('market-search').addEventListener('input', () => {
        // Invalidate old requests immediately, before the debounced network request.
        requestId++; community=[]; more=false; render();
        clearTimeout(debounce); debounce=setTimeout(() => load(),250);
    });
    ['market-category','market-source'].forEach(id => $(id).addEventListener('change', () => { clearTimeout(debounce); load(); }));
    $('market-more').addEventListener('click', () => load(true));
    $('market-refresh').addEventListener('click', () => load());
    $('open-submit').addEventListener('click', () => { authUI(); dialog.showModal(); });
    $('close-submit').addEventListener('click', () => dialog.close());
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (submitting || !form.reportValidity()) return;
        $('submit-status').textContent='';
        let input;
        try { input=CasualMarketRules.validateGame(Object.fromEntries(new FormData(form))); }
        catch(error) { $('submit-status').textContent=error.message; return; }
        submitting=true; authUI();
        try {
            await CasualCloud.publishMarketGame(input);
            form.reset(); dialog.close();
            $('market-search').value=''; $('market-category').value='all'; $('market-source').value='mine';
            await load();
            $('community-status').textContent='Oyunun onaya gönderildi. Yönetici onayından sonra herkes görebilir.';
        } catch(error) {
            $('submit-status').textContent=error.status===404 ? 'Topluluk paylaşımı henüz açılmadı. Formundaki bilgiler korunuyor.' : 'Oyun eklenemedi. Hesabını, bağlantını ve en fazla 10 aktif ilan sınırını kontrol et.';
        } finally { submitting=false; authUI(); }
    });
    window.addEventListener('casualcloudchange', () => { authUI(); Promise.resolve(CasualCloud.ready).then(() => load()); });
    authUI(); render();
    Promise.resolve(CasualCloud.ready).then(() => load());
})();
