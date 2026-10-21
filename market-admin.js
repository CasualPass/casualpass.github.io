(() => {
    'use strict';
    const $=id=>document.getElementById(id),panel=$('market-admin');
    let roleVersion=0,queryVersion=0,offset=0;
    const signedIn=()=>Boolean(CasualCloud.getState().authenticated);
    function renderRows(rows,append=false) {
        const container=$('review-games');if(!append)container.replaceChildren();
        for(const game of rows) {
            let safe;try{safe=CasualMarketRules.validateGame(game);}catch{continue;}
            const item=document.createElement('article');item.className='review-card';
            const title=document.createElement('h3');title.textContent=safe.title;
            const author=document.createElement('p');author.textContent=`@${game.author} · ${game.status} · sürüm ${game.revision}`;
            const desc=document.createElement('p');desc.textContent=safe.description;
            const link=document.createElement('a');link.href=safe.url;link.target='_blank';link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';link.textContent=safe.url;
            const label=document.createElement('label');label.textContent='İnceleme notu (isteğe bağlı)';
            const note=document.createElement('textarea');note.maxLength=280;note.value=game.review_note||'';label.append(note);
            const controls=document.createElement('div');controls.className='market-dialog-actions';
            const buttons=[];
            for(const [decision,text] of [['approved','Onayla'],['rejected','Reddet']]) {
                if(game.status===decision)continue;
                const button=document.createElement('button');button.type='button';button.className='save-button';button.textContent=text;buttons.push(button);
                button.addEventListener('click',async()=>{
                    buttons.forEach(b=>b.disabled=true);
                    try {
                        await CasualCloud.reviewMarketGame(game.id,decision,game.revision,note.value);
                        await load();window.dispatchEvent(new CustomEvent('casualmarketchange'));
                    } catch {$('review-status').textContent='İşlem tamamlanamadı. İlan değişmiş veya yetkin kaldırılmış olabilir; listeyi yenile.';buttons.forEach(b=>b.disabled=false);}
                });controls.append(button);
            }
            item.append(title,author,desc,link,label,controls);container.append(item);
        }
    }
    async function load(append=false) {
        if(panel.hidden || !signedIn())return;
        const serial=++queryVersion;if(!append)offset=0;
        $('review-more').disabled=true;$('review-status').textContent='İnceleme listesi yükleniyor…';
        try {
            const rows=await CasualCloud.listMarketReview($('review-filter').value,offset);
            if(serial!==queryVersion)return;
            renderRows(rows,append);offset+=rows.length;$('review-more').hidden=rows.length<24;
            $('review-status').textContent=rows.length?'Onaylanan oyunlar Market’te görünür. Değiştirilen ilanlar yeniden onaya gider.':'Bu durumda bekleyen ilan yok.';
        } catch {if(serial===queryVersion)$('review-status').textContent='Yönetici listesi alınamadı. Hesabını ve sunucu kurulumunu kontrol et.';}
        finally{if(serial===queryVersion)$('review-more').disabled=false;}
    }
    async function refreshRole() {
        const serial=++roleVersion;++queryVersion;panel.hidden=true;$('review-games').replaceChildren();
        if(!signedIn())return;
        try {
            const isAdmin=await CasualCloud.isMarketAdmin();
            if(serial!==roleVersion || !signedIn() || !isAdmin)return;
            panel.hidden=false;await load();
        } catch { /* No client-side name fallback; stay closed on missing/failed role RPC. */ }
    }
    $('review-filter').addEventListener('change',()=>load());
    $('review-refresh').addEventListener('click',()=>load());
    $('review-more').addEventListener('click',()=>load(true));
    window.addEventListener('casualcloudchange',refreshRole);
    Promise.resolve(CasualCloud.ready).then(refreshRole);
})();
