(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.MazeEngine = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const directions = { up: [0,-1], right: [1,0], down: [0,1], left: [-1,0] };
    const totalLevels = 24;
    const open = (level, p) => Number.isInteger(p) && p >= 0 && p < level.cells.length && level.cells[p] === 1;
    function trace(level, position, direction) {
        const delta = directions[direction];
        if (!delta || !open(level, position)) return [];
        let x = position % level.width, y = Math.floor(position / level.width);
        const path = [];
        while (true) {
            x += delta[0]; y += delta[1];
            if (x < 0 || y < 0 || x >= level.width || y >= level.height || !open(level, y * level.width + x)) break;
            path.push(y * level.width + x);
        }
        return path;
    }
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
    function isSolved(level,state) { return validateState(level,state) && state.painted.length === level.cells.filter(Boolean).length; }
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
        if (covered.size !== level.cells.filter(Boolean).length) return null;
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
    const cache = new Map();
    function createLevel(number) {
        if(!Number.isInteger(number)||number<1||number>totalLevels) throw new RangeError('Invalid level');
        if(cache.has(number)) return JSON.parse(JSON.stringify(cache.get(number)));
        let seed=(number*2654435761)>>>0;
        const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
        const width=number<=6?5:number<=14?6:number<=20?7:8, height=width;
        let result;
        for(let attempt=0;attempt<4000;attempt++) {
            const cells=Array.from({length:width*height},()=>random()>.35?1:0);
            const start=cells.indexOf(1); if(start<0||cells.filter(Boolean).length<width*2) continue;
            const level={number,width,height,cells,start}, solution=solve(level);
            if(solution && solution.length>=Math.min(4+number,18)) { result={...level,solution}; break; }
        }
        // A winding single corridor is a guaranteed solvable bounded fallback.
        if(!result) {
            const cells=Array(width*height).fill(0);
            for(let y=0;y<height;y+=2) {
                for(let x=0;x<width;x++) cells[y*width+x]=1;
                if(y+1<height) cells[(y+1)*width+(y%4===0?width-1:0)]=1;
            }
            const level={number,width,height,cells,start:0}; result={...level,solution:solve(level)};
        }
        cache.set(number,result); return JSON.parse(JSON.stringify(result));
    }
    return { totalLevels,directions,trace,initial,validateState,move,isSolved,createLevel };
});
