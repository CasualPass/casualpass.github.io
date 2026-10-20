(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.MazeEngine = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const directions = { up: [0,-1], right: [1,0], down: [0,1], left: [-1,0] };
    // Cell values: 0 wall, 1 floor, 2 stop pad (the ball stops on it). Levels 1–24 only use 0/1.
    const FLOOR = 1, STOP = 2;
    const classicLevels = 24, totalLevels = 36;
    const chapters = [
        { id: 'classic', name: 'Klasik', first: 1, last: classicLevels },
        { id: 'stops', name: 'Duraklar', first: classicLevels + 1, last: totalLevels }
    ];
    const open = (level, p) => Number.isInteger(p) && p >= 0 && p < level.cells.length && (level.cells[p] === FLOOR || level.cells[p] === STOP);
    function trace(level, position, direction) {
        const delta = directions[direction];
        if (!delta || !open(level, position)) return [];
        let x = position % level.width, y = Math.floor(position / level.width);
        const path = [];
        while (true) {
            x += delta[0]; y += delta[1];
            if (x < 0 || y < 0 || x >= level.width || y >= level.height || !open(level, y * level.width + x)) break;
            path.push(y * level.width + x);
            if (level.cells[y * level.width + x] === STOP) break;
        }
        return path;
    }
    const openCount = level => level.cells.filter(Boolean).length;
    function initial(level) { return { position: level.start, painted: [level.start] }; }
    function validateState(level, state) {
        return !!state && open(level, state.position) && Array.isArray(state.painted) && state.painted.length > 0 && state.painted.length <= level.cells.length &&
            Array.from(state.painted).every(p => open(level,p)) && new Set(state.painted).size === state.painted.length && state.painted.includes(state.position) && state.painted.includes(level.start);
    }
    function move(level, state, direction) {
        if (!validateState(level,state)) return null;
        const path = trace(level,state.position,direction);
        if (!path.length) return null;
        return { position: path[path.length-1], painted: [...new Set([...state.painted,...path])], path };
    }
    function isSolved(level,state) { return validateState(level,state) && state.painted.length === openCount(level); }
    // Build a finite graph of stopping positions, then require every stop to
    // reach the start. This guarantees we can visit every reachable corridor.
    function solve(level) {
        const graph = new Map(), queue = [level.start], covered = new Set([level.start]);
        for (let i=0; i<queue.length; i++) {
            const p=queue[i], edges=[];
            for (const dir of Object.keys(directions)) {
                const path=trace(level,p,dir); if (!path.length) continue;
                path.forEach(cell=>covered.add(cell));
                const to=path[path.length-1]; edges.push({dir,to,path});
                if (!queue.includes(to)) queue.push(to);
            }
            graph.set(p,edges);
        }
        if (covered.size !== openCount(level)) return null;
        const backwards=new Map(queue.map(p=>[p,[]]));
        for (const [p,edges] of graph) for(const edge of edges) backwards.get(edge.to).push(p);
        const home=new Set([level.start]), pending=[level.start];
        for(let i=0;i<pending.length;i++) for(const p of backwards.get(pending[i])) if(!home.has(p)){ home.add(p); pending.push(p); }
        if(home.size!==graph.size) return null;
        function route(from,to) {
            const q=[{p:from,dirs:[]}], seen=new Set([from]);
            for(let i=0;i<q.length;i++) {
                const item=q[i]; if(item.p===to) return item.dirs;
                for(const edge of graph.get(item.p)) if(!seen.has(edge.to)){seen.add(edge.to);q.push({p:edge.to,dirs:[...item.dirs,edge.dir]});}
            }
            return null;
        }
        let state=initial(level); const solution=[];
        for(const [p,edges] of graph) for(const edge of edges) {
            if(edge.path.every(cell=>state.painted.includes(cell))) continue;
            for(const dir of [...route(state.position,p),edge.dir]) { state=move(level,state,dir); solution.push(dir); }
        }
        return isSolved(level,state) ? solution : null;
    }
    // Search stopping positions for the nearest slide that paints a new cell.
    // The level graph is strongly connected, so every remaining tile is reachable.
    function nextHint(level,state) {
        if(!validateState(level,state)||isSolved(level,state)) return null;
        const seen=new Set([state.position]),queue=[{p:state.position,first:null}];
        for(let i=0;i<queue.length;i++) for(const dir of Object.keys(directions)) {
            const path=trace(level,queue[i].p,dir); if(!path.length)continue;
            const first=queue[i].first||dir;
            if(path.some(p=>!state.painted.includes(p)))return first;
            const p=path[path.length-1];if(!seen.has(p)){seen.add(p);queue.push({p,first});}
        }
        return null;
    }
    const chapterOf = number => chapters.find(c => number >= c.first && number <= c.last);
    const cache = new Map();
    function corridor(number,width,height) {
        // A winding single corridor is a guaranteed solvable bounded fallback.
        const cells=Array(width*height).fill(0);
        for(let y=0;y<height;y+=2) {
            for(let x=0;x<width;x++) cells[y*width+x]=1;
            if(y+1<height) cells[(y+1)*width+(y%4===0?width-1:0)]=1;
        }
        const level={number,width,height,cells,start:0}; return {...level,solution:solve(level)};
    }
    function classicLevel(number) {
        let seed=(number*2654435761)>>>0;
        const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
        const width=number<=6?5:number<=14?6:number<=20?7:8, height=width;
        for(let attempt=0;attempt<4000;attempt++) {
            const cells=Array.from({length:width*height},()=>random()>.35?1:0);
            const start=cells.indexOf(1); if(start<0||cells.filter(Boolean).length<width*2) continue;
            const level={number,width,height,cells,start}, solution=solve(level);
            if(solution && solution.length>=Math.min(4+number,18)) return {...level,solution};
        }
        return corridor(number,width,height);
    }
    function stopLevel(number) {
        let seed=(number*2246822519+374761393)>>>0;
        const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
        const width=number<=30?7:8, height=width, stops=number<=28?2:number<=32?3:4;
        for(let attempt=0;attempt<4000;attempt++) {
            const cells=Array.from({length:width*height},()=>random()>.33?FLOOR:0);
            const start=cells.indexOf(FLOOR); if(start<0||cells.filter(Boolean).length<width*3) continue;
            // Pads sit on corridor cells (two opposite open neighbours) so they interrupt a slide.
            const candidates=cells.map((c,i)=>i).filter(i=>{
                if(cells[i]!==FLOOR||i===start) return false;
                const x=i%width,y=Math.floor(i/width),at=(dx,dy)=>x+dx>=0&&y+dy>=0&&x+dx<width&&y+dy<height&&cells[(y+dy)*width+x+dx]>0;
                return (at(-1,0)&&at(1,0))||(at(0,-1)&&at(0,1));
            });
            if(candidates.length<stops) continue;
            for(let k=0;k<stops;k++) cells[candidates.splice(Math.floor(random()*candidates.length),1)[0]]=STOP;
            const level={number,width,height,cells,start}, solution=solve(level);
            if(solution && solution.length>=14) return {...level,solution};
        }
        return corridor(number,width,height);
    }
    function createLevel(number) {
        if(!Number.isInteger(number)||number<1||number>totalLevels) throw new RangeError('Invalid level');
        if(!cache.has(number)) cache.set(number, number<=classicLevels ? classicLevel(number) : stopLevel(number));
        return JSON.parse(JSON.stringify(cache.get(number)));
    }
    return { totalLevels,classicLevels,chapters,chapterOf,FLOOR,STOP,directions,trace,initial,validateState,move,isSolved,nextHint,createLevel };
});
