(() => {
    'use strict';
    const grid=document.getElementById('game-grid');
    if(!grid || !window.CasualHomeGames) return;
    const status=document.getElementById('home-games-status');
    const previous=document.getElementById('home-page-prev'),next=document.getElementById('home-page-next'),pageLabel=document.getElementById('home-page-label');
    const sizeSelect=document.getElementById('home-page-size');
    let preference=CasualHomeGames.pagePreference();
    if(sizeSelect)sizeSelect.value=String(preference);
    let version=0,page=0,games=[],ids=[],failed=false,unavailable=0;
    function card(game,external=false) {
        const a=document.createElement('a');a.className=`game-card ${game.className || 'dino-card'}`;a.href=game.url;
        if(external){a.target='_blank';a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';}
        const art=document.createElement('span');art.className='game-art home-game-art';
        art.innerHTML=window.CasualGameIcons?CasualGameIcons.svg(external?CasualGameIcons.FALLBACK:game.id):'';
        art.setAttribute('aria-hidden','true');
        const copy=document.createElement('span');copy.className='game-copy';
        const label=document.createElement('small');label.textContent=external?'TOPLULUK':'ANA EKRANINDA';
        const title=document.createElement('strong');title.textContent=game.name;
        const desc=document.createElement('em');desc.textContent=game.description;
        copy.append(label,title,desc);
        const meta=document.createElement('span');meta.className='game-meta';
        const score=document.createElement('span');score.className='game-stat';
        const best=external?0:getHighScore(game.name);score.hidden=!best;score.textContent=`Rekor ${best}`;
        const play=document.createElement('span');play.className='game-play';play.textContent='Oyna';meta.append(score,play);
        a.append(art,copy,meta);return a;
    }
    function draw() {
        const size=CasualHomeGames.pageSize(window.innerWidth||1280,window.innerHeight||720,preference);
        const width=window.innerWidth||1280;
        const columns=Math.min(size,width<=720?(size>6?3:2):(size>=18?6:size>=8?4:size===4?2:3));
        /* Satir sayisi grup boyutuna gore degil ekrandaki gercek oyun sayisina gore hesaplanir;
           boylece 30 slot icin secilmis 13 oyun paneli doldurur, altta bos alan kalmaz. */
        const visible=games.slice(page*size,(page+1)*size);
        const rows=Math.max(1,Math.ceil(Math.min(size,games.length)/columns));
        grid.style.gridTemplateColumns=`repeat(${columns},minmax(0,1fr))`;
        grid.style.gridTemplateRows=`repeat(${rows},minmax(0,1fr))`;
        grid.dataset.dense=String(size>CasualHomeGames.pageSize(window.innerWidth||1280,window.innerHeight||720));
        const pages=Math.max(1,Math.ceil(games.length/size));page=Math.max(0,Math.min(page,pages-1));
        grid.dataset.crowded=String(size>12);
        grid.replaceChildren();
        for(const game of visible)grid.append(card(game,game.external));
        if(previous)previous.disabled=page===0;
        if(next)next.disabled=page>=pages-1;
        if(pageLabel)pageLabel.textContent=`${page+1} / ${pages}`;
        status.textContent=failed?'Topluluk oyunları doğrulanamadı. Bağlantını kontrol ederek sayfayı yenile.':unavailable?'Eklediğin bazı oyunlar artık yayında değil. Market’ten yeni oyun seçebilirsin.':!ids.length?'Ana ekranın boş. Market’te “Oyunu ana ekrana ekle” ile oyun seç.':`${ids.length}/${CasualHomeGames.LIMIT} oyun eklendi · ${size} oyun / sayfa`;
    }
    async function render() {
        const serial=++version;ids=CasualHomeGames.current();
        const externalIds=ids.filter(id=>id.startsWith('community:')).map(id=>id.slice(10));
        let external=[];failed=false;
        if(externalIds.length) {
            status.textContent='Eklediğin topluluk oyunları kontrol ediliyor…';
            try {const result=await CasualCloud.getMarketHomeGames(externalIds);external=Array.isArray(result)?result:[];} catch {failed=true;}
        }
        if(serial!==version)return;
        games=[];unavailable=0;
        for(const id of ids) {
            const builtIn=CasualHomeGames.catalog.find(game=>game.id===id);
            if(builtIn){games.push(builtIn);continue;}
            const game=external.find(game=>`community:${game.id}`===id);
            if(!game || game.status!=='approved'){unavailable++;continue;}
            try {const safe=CasualMarketRules.validateGame(game);games.push({...safe,name:safe.title,external:true});} catch{unavailable++;}
        }
        draw();
    }
    sizeSelect?.addEventListener('change',()=>{preference=CasualHomeGames.setPagePreference(sizeSelect.value);page=0;draw();});
    previous?.addEventListener('click',()=>{page--;draw();});
    next?.addEventListener('click',()=>{page++;draw();});
    window.addEventListener('resize',draw);
    window.addEventListener('casualhomechange',()=>{page=0;render();});
    window.addEventListener('casualprofilechange',render);
    render();
})();
