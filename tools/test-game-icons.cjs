const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const icons=require('../game-icons.js');
const home=require('../home-games.js');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const emoji=/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}]/u;

test('her oyun ve topluluk karti tek simge setinden beslenir',()=>{
    const expected=home.catalog.map(game=>game.id).concat([icons.FALLBACK]).sort();
    assert.deepEqual([...icons.ids].sort(),expected);
    for(const game of home.catalog)assert.ok(icons.has(game.id),`${game.id} ikonu yok`);
    assert.ok(icons.has(icons.FALLBACK));
    assert.equal(icons.ids.length,home.catalog.length+1);
});

test('simge seti tek cizgi stilinde: 24x24 viewBox, currentColor kontur, ASCII',()=>{
    for(const id of icons.ids){
        const svg=icons.svg(id);
        assert.ok(svg.startsWith(icons.ROOT),`${id} ortak svg kokune baslamali`);
        assert.ok(svg.endsWith('</svg>'),`${id} kapanmali`);
        assert.match(svg,/viewBox="0 0 24 24"/,id);
        assert.match(svg,/fill="none"/,id);
        assert.match(svg,/stroke="currentColor"/,id);
        assert.match(svg,/stroke-width="1\.6"/,id);
        assert.match(svg,/stroke-linecap="round"/,id);
        assert.match(svg,/aria-hidden="true"/,id);
        assert.match(svg,/<(path|circle|rect|ellipse|line|polyline|polygon)\b/,`${id} bir cizim elemani icermeli`);
        assert.match(svg,/^[\x20-\x7E]+$/,`${id} sadece ASCII icermeli`);
        assert.doesNotMatch(svg,/<text\b|font-family/,`${id} metin/karakter kullanmamali`);
        assert.doesNotMatch(svg,emoji,`${id} emoji icermemeli`);
    }
});

test('bilinmeyen oyun topluluk simgesine duser',()=>{
    assert.equal(icons.svg('olmayan-oyun'),icons.svg(icons.FALLBACK));
    assert.equal(icons.svg(undefined),icons.svg(icons.FALLBACK));
});

test('ana ekran ve Market kartlari modulle ayni satir ici svg icerir',()=>{
    for(const file of ['index.html','market.html']){
        const html=read(file);
        assert.match(html,/game-icons\.js\?v=\d+/,`${file} game-icons.js yuklemeli`);
        const cards=[...html.matchAll(/<a class="game-card[^"]*"[^>]*href="([^"]+)"[\s\S]*?<\/a>/g)];
        assert.ok(cards.length>0,`${file} oyun karti bulamadi`);
        for(const card of cards){
            const id=card[1].split('/')[0];
            const art=/<span class="game-art [^"]*" aria-hidden="true">([\s\S]*?)<\/span><span class="game-copy">/.exec(card[0]);
            assert.ok(art,`${file}: ${id} sanat alani yok`);
            assert.equal(art[1],icons.svg(id),`${file}: ${id} sanati setle ayni degil`);
            assert.doesNotMatch(art[1],emoji,`${file}: ${id} hala emoji`);
            assert.doesNotMatch(art[1],/<i>|<b>/,`${file}: ${id} hala css sekli`);
        }
    }
});

test('calisma zamani kartlari da ayni setten ciziyor',()=>{
    const screen=read('home-screen.js');
    assert.match(screen,/CasualGameIcons\.svg\(/);
    assert.match(screen,/CasualGameIcons\.FALLBACK/);
    assert.doesNotMatch(screen,/textContent\s*=\s*game\.icon/);
    assert.doesNotMatch(read('home-games.js'),emoji,'katalog emoji taşimamali');
    assert.doesNotMatch(read('home-games.js'),/\bicon\s*:/);
    const market=read('market.js');
    assert.match(market,/CasualGameIcons\.svg\(CasualGameIcons\.FALLBACK\)/);
    assert.doesNotMatch(market,/textContent\s*=\s*'↗'/);
});

test('kart stilleri svg icin boyutlanir, emoji font hileleri kaldirilmistir',()=>{
    const style=read('style.css'),dash=read('dashboard.css'),market=read('market.css');
    assert.match(style,/\.game-art > svg \{/);
    assert.match(dash,/\.dashboard-app \.game-art > svg \{/);
    assert.match(market,/\.community-icon > svg \{/);
    assert.doesNotMatch(dash,/home-game-art \{ font-size/,'kartiya ozgu font hilesi kalmamali');
    assert.doesNotMatch(style,/\.chess-art \{|\.dino-art \{|\.nuts-art \{|\.maze-art \{|\.line-art \{|\.owl-art \{|\.blocks-art \{|\.arena-art \{|\.vektor-art \{|\.xox-art \{|\.tile-art \{|\.snake-art \{|\.wood-art \{/,'css ile cizilen eski sanat kurallari kaldirilmali');
});
