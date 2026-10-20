(() => {
    'use strict';
    const E=window.MazeEngine, $=id=>document.getElementById(id);
    let hintedDirection=null;
    let number=1, level, state, moves=0, completed=[], history=[], tainted=false, resetting=false, pointer=null;
    const copy=s=>({position:s.position,painted:s.painted.slice()});
    function say(text){$('message').textContent=text;}
    function save(){tainted ||= cheatsActive();if(!tainted)setCookieValue('cp_maze_v1',JSON.stringify({number,state:copy(state),moves,completed}));}
    let previousPosition = null;
    function render(path=[]) {
        const board=$('board');board.classList.toggle('stop-chapter',number>E.classicLevels);board.style.setProperty('--size',level.width);
        board.replaceChildren();
        level.cells.forEach((open,index)=>{
            const tile=document.createElement('span');tile.className='tile'+(!open?' wall':state.painted.includes(index)?' painted':'');
            if(open===E.STOP)tile.classList.add('stop-pad');
            const step=path.indexOf(index);if(step>=0){tile.classList.add('fresh');tile.style.setProperty('--delay',`${step*25}ms`);}
            tile.setAttribute('aria-hidden','true');board.append(tile);
        });
        const player=document.createElement('span');player.className='player';player.setAttribute('aria-hidden','true');
        const transform=p=>`translate(${p%level.width*100}%,${Math.floor(p/level.width)*100}%)`;
        player.style.transform=transform(state.position);board.append(player);
        if(path.length && previousPosition!==null && player.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches && !document.body.classList.contains('disable-effects')) {
            const frames=[previousPosition,...path].map(p=>({transform:transform(p)}));
            player.animate(frames,{duration:Math.min(300,path.length*55),easing:'linear'});
        }
        previousPosition=state.position;
        const count=level.cells.filter(Boolean).length;
        board.setAttribute('aria-label',`Labirent ${level.width}×${level.height}. Top satır ${Math.floor(state.position/level.width)+1}, sütun ${state.position%level.width+1}. ${state.painted.length}/${count} kare boyalı. Ok tuşlarıyla hareket et.`);
        $('coverage').textContent=`${state.painted.length} / ${count}`;$('fill').style.width=`${state.painted.length/count*100}%`;
        $('level-title').textContent=String(number).padStart(2,'0')+' · '+E.chapterOf(number).name;$('progress').textContent=`${number} / ${E.totalLevels}`;
        $('moves').textContent=moves;$('completed').textContent=`${completed.length} / ${E.totalLevels} bölüm tamamlandı`;$('level').value=String(number);
        $('hint').disabled=E.isSolved(level,state);
        document.querySelectorAll('[data-dir]').forEach(button=>{button.classList.toggle('hinted',button.dataset.dir===hintedDirection);});
        $('undo').disabled=!history.length;$('next').hidden=!E.isSolved(level,state)||number===E.totalLevels;
        $('restart').textContent=resetting?'Sıfırlamak için tekrar bas':'↻ Yeniden başla';
    }
    function start(n){hintedDirection=null;number=n;level=E.createLevel(n);state=E.initial(level);moves=0;history=[];resetting=false;pointer=null;tainted=cheatsActive();save();render();say('Kaydır veya yön düğmelerini kullan. Top duvara kadar gider.');}
    function play(direction){
        hintedDirection=null;
        if(E.isSolved(level,state))return;
        const next=E.move(level,state,direction);resetting=false;
        if(!next){if(typeof playHaptic==='function')playHaptic('tap');say('Bu yönde duvar var. Başka bir yön dene.');return;}
        history.push({state:copy(state),moves});if(history.length>300)history.shift();
        state=copy(next);moves++;if(typeof playHaptic==='function')playHaptic(E.isSolved(level,state)?'win':'move');tainted ||= cheatsActive();
        if(E.isSolved(level,state)){
            if(!tainted&&!completed.includes(number)){completed.push(number);recordGameResult('Maze Paint',{won:true,score:number});}
            say(number===E.totalLevels?'Bütün kareler boyalı! Son bölümü de tamamladın.':`Tamamı boyandı! ${moves} hamlede bitirdin.`);
        }else say(`${level.cells.filter(Boolean).length-state.painted.length} kare kaldı. Boyalı yoldan tekrar geçebilirsin.`);
        save();render(next.path);
    }
    function restore(){
        try{
            const saved=JSON.parse(getCookieValue('cp_maze_v1')||'null');
            if(!saved||!Number.isInteger(saved.number)||saved.number<1||saved.number>E.totalLevels)return false;
            const candidate=E.createLevel(saved.number);if(!E.validateState(candidate,saved.state))return false;
            number=saved.number;level=candidate;state=copy(saved.state);moves=Number.isSafeInteger(saved.moves)&&saved.moves>=0&&saved.moves<=999999?saved.moves:0;
            completed=Array.isArray(saved.completed)?[...new Set(saved.completed.filter(n=>Number.isInteger(n)&&n>=1&&n<=E.totalLevels))]:[];return true;
        }catch{return false;}
    }
    for(let i=1;i<=E.totalLevels;i++){const option=document.createElement('option');option.value=i;option.textContent=`Bölüm ${i}`;$('level').append(option);}
    $('hint').addEventListener('click',()=>{
        hintedDirection=E.nextHint(level,state);render();
        const names={up:'Yukarı ↑',right:'Sağa →',down:'Aşağı ↓',left:'Sola ←'};
        say(hintedDirection?`Sıradaki yön: ${names[hintedDirection]}. Yeni karelere giden yolu izle.`:'Bütün kareler boyalı.');
    });
    $('level').addEventListener('change',()=>start(Number($('level').value)));
    document.querySelectorAll('[data-dir]').forEach(button=>button.addEventListener('click',()=>play(button.dataset.dir)));
    $('next').addEventListener('click',()=>{if(E.isSolved(level,state)&&number<E.totalLevels)start(number+1);});
    $('undo').addEventListener('click',()=>{const old=history.pop();if(!old)return;state=old.state;moves=old.moves;resetting=false;save();render();say('Son kaydırış geri alındı.');});
    $('restart').addEventListener('click',()=>{if(moves&&!resetting&&!E.isSolved(level,state)){resetting=true;render();say('Yeniden başlatmak için düğmeye tekrar bas.');return;}start(number);});
    const keys={ArrowUp:'up',ArrowRight:'right',ArrowDown:'down',ArrowLeft:'left',w:'up',d:'right',s:'down',a:'left'};
    document.addEventListener('keydown',event=>{if(event.target?.closest('input,select,textarea')||event.ctrlKey||event.metaKey||event.altKey)return;const dir=keys[event.key]||keys[event.key.toLowerCase()];if(dir){event.preventDefault();if(!event.repeat)play(dir);}});
    const board=$('board');
    board.addEventListener('pointerdown',event=>{if(event.isPrimary===false||event.button!==0)return;pointer={id:event.pointerId,x:event.clientX,y:event.clientY};board.setPointerCapture?.(event.pointerId);board.focus({preventScroll:true});});
    board.addEventListener('pointerup',event=>{if(!pointer||pointer.id!==event.pointerId)return;const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;pointer=null;if(Math.max(Math.abs(dx),Math.abs(dy))<18)return;play(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');});
    board.addEventListener('pointercancel',()=>{pointer=null;});board.addEventListener('lostpointercapture',()=>{pointer=null;});
    window.addEventListener('blur',()=>{pointer=null;});window.addEventListener('casual-cheat',()=>{tainted=true;say('Hile oturumunda ilerleme kaydedilmez.');});
    if(!restore())start(1);else{tainted=cheatsActive();render();if(E.isSolved(level,state))say('Bu bölüm tamamlandı. Bir sonrakine geçebilirsin.');}
})();
