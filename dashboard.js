(() => {
    'use strict';
    const tabs=[...document.querySelectorAll('[data-dashboard-tab]')];
    const panels=[...document.querySelectorAll('[data-dashboard-view]')];
    if(!tabs.length)return;
    const anchors={games:'games',leaderboard:'leaderboard','account-title':'account','themes-title':'themes','rebirth-title':'progress','activity-title':'progress','cheat-title':'progress',save:'account','save-title':'account'};
    function activate(name,updateHash=true,focus=false) {
        if(!tabs.some(tab=>tab.dataset.dashboardTab===name))name='games';
        for(const panel of panels)panel.hidden=panel.dataset.dashboardView!==name;
        for(const tab of tabs){const active=tab.dataset.dashboardTab===name;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;if(active&&focus)tab.focus();}
        if(updateHash) {
            const hash=Object.keys(anchors).find(key=>anchors[key]===name);
            window.history.replaceState(null,'',`#${hash}`);
        }
    }
    tabs.forEach((tab,index)=>{
        tab.addEventListener('click',()=>activate(tab.dataset.dashboardTab));
        tab.addEventListener('keydown',event=>{
            let target;
            if(event.key==='ArrowRight')target=tabs[(index+1)%tabs.length];
            if(event.key==='ArrowLeft')target=tabs[(index-1+tabs.length)%tabs.length];
            if(event.key==='Home')target=tabs[0];if(event.key==='End')target=tabs[tabs.length-1];
            if(target){event.preventDefault();activate(target.dataset.dashboardTab,true,true);}
        });
    });
    document.addEventListener('click',event=>{
        const link=event.target.closest?.('a[href^="#"]');
        const name=link&&anchors[link.getAttribute('href').slice(1)];
        if(name){event.preventDefault();activate(name);}
    });
    window.addEventListener('hashchange',()=>activate(anchors[window.location.hash.slice(1)]||'games',false));
    activate(anchors[window.location.hash.slice(1)]||'games',false);
})();
