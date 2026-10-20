/* Original low-poly art, rendered with the Three.js copy already shipped by CasualPass. */
(() => {
    'use strict';
    const T = window.THREE;
    if (!T) return;
    window.createSonHatBattleView = canvas => {
        let renderer;
        try { renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); }
        catch { canvas.hidden = true; return null; }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
        renderer.outputEncoding = T.sRGBEncoding;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = T.PCFSoftShadowMap;
        const scene = new T.Scene();
        scene.background = new T.Color('#126d7d');
        scene.fog = new T.Fog('#7eb5bc', 58, 108);
        const camera = new T.PerspectiveCamera(43, 1, .1, 150);
        camera.position.set(0, 19, 20);
        camera.lookAt(0, 0, -9);
        scene.add(new T.HemisphereLight('#dcf5ff', '#516779', .75));
        const sun = new T.DirectionalLight('#fff0d4', .85);
        sun.position.set(-12, 28, 14); sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 36, bottom: -18, far: 75 });
        sun.shadow.bias = -.001;
        sun.shadow.camera.updateProjectionMatrix();
        scene.add(sun);
        const materials = new Map();
        const mat = color => {
            if (!materials.has(color)) materials.set(color, new T.MeshStandardMaterial({ color, roughness: .7, metalness: .08 }));
            return materials.get(color);
        };
        const boxGeo = new T.BoxGeometry(1, 1, 1);
        const sphereGeo = new T.SphereGeometry(1, 10, 7);
        function box(parent, x, y, z, w, h, d, color) {
            const m = new T.Mesh(boxGeo, mat(color)); m.position.set(x, y, z); m.scale.set(w, h, d);
            m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
        }
        function orb(parent, x, y, z, size, color) {
            const m = new T.Mesh(sphereGeo, mat(color)); m.position.set(x, y, z); m.scale.setScalar(size); m.castShadow = true; parent.add(m); return m;
        }
        box(scene, 0, -.58, -28, 180, .2, 200, '#0a596b');
        box(scene, 0, -.3, -28, 15.6, .6, 160, '#4c6576');
        box(scene, 0, .02, -28, 14, .12, 160, '#929b9f');
        for (const side of [-1, 1]) {
            box(scene, side * 7.35, .28, -28, .55, .7, 160, '#e2d9be');
            box(scene, side * 7.48, .88, -28, .14, .15, 160, '#50666f');
            box(scene, side * 6.7, .1, -28, .12, .015, 160, '#eef1df');
        }
        const roadMarks = new T.Group(); scene.add(roadMarks);
        for (let i = 0; i < 28; i++) box(roadMarks, 0, .1, -i * 4, .12, .015, 1.7, '#edf0de');
        const railPosts = new T.Group(); scene.add(railPosts);
        for (let i = 0; i < 22; i++) for (const side of [-1, 1]) {
            box(railPosts, side * 7.45, .48, -i * 5, .7, 1, .7, '#bac5bd');
            box(railPosts, side * 7.45, 1.02, -i * 5, .85, .12, .85, '#f1e8d0');
        }
        // Low islands, docks and shipping stacks make the route feel like a place.
        for (let i = 0; i < 14; i++) {
            const side = i % 2 ? -1 : 1, z = -15 - i * 7;
            box(scene, side * (13 + i % 3 * 2), -.25, z, 5, .65, 5, '#b6aa7d');
            box(scene, side * (13 + i % 3 * 2), .3, z, 4.4, .5, 4.4, '#75a16a');
            box(scene, side * (13 + i % 3 * 2), 1.4, z, 2.5, 1.8, 3, i % 3 ? '#eaa453' : '#689da7');
        }
        const waves = new T.Group(); scene.add(waves);
        for (let i = 0; i < 60; i++) box(waves, (i % 2 ? -1 : 1) * (9 + i * 13 % 24), -.43, -(i * 7 % 100), 1.8, .012, .08, '#60b6b8');

        const dummy = new T.Object3D();
        function instances(geometry, color, count) {
            const m = new T.InstancedMesh(geometry, mat(color), count); m.instanceMatrix.setUsage(T.DynamicDrawUsage); m.castShadow = true;
            m.frustumCulled = false; scene.add(m); return m;
        }
        function army(team, cap) {
            const blue = team === 'blue';
            return { cap, parts: [
                { mesh: instances(boxGeo, blue ? '#2d87df' : '#c64039', cap), pos: [0, .6, 0], scale: [.46, .57, .34] },
                { mesh: instances(sphereGeo, blue ? '#f1bf8c' : '#8fa75a', cap), pos: [0, 1.05, 0], scale: [.24, .25, .23] },
                { mesh: instances(sphereGeo, blue ? '#1775ce' : '#6b783f', cap), pos: [0, 1.22, .015], scale: [.29, .17, .28] },
                { mesh: instances(boxGeo, blue ? '#244b76' : '#534c43', cap), pos: [-.14, .16, 0], scale: [.17, .4, .22], leg: -1 },
                { mesh: instances(boxGeo, blue ? '#244b76' : '#534c43', cap), pos: [.14, .16, 0], scale: [.17, .4, .22], leg: 1 },
                { mesh: instances(boxGeo, blue ? '#efbb86' : '#8fa75a', cap), pos: [-.31, .64, blue ? -.14 : .2], scale: [.14, .38, .16], arm: true },
                { mesh: instances(boxGeo, blue ? '#efbb86' : '#8fa75a', cap), pos: [.31, .64, blue ? -.14 : .2], scale: [.14, .38, .16], arm: true },
                { mesh: instances(boxGeo, blue ? '#263b45' : '#6e3430', cap), pos: [.23, .79, blue ? -.39 : .08], scale: blue ? [.13, .12, .7] : [.34, .35, .12] }
            ] };
        }
        const friends = army('blue', 100), enemies = army('red', 600);
        function drawArmy(pool, units, time, paused) {
            units.slice(0, pool.cap).forEach((u, i) => {
                const size = u.size || 1, gait = Math.sin(time * 11 + i * 1.7) * (paused ? 0 : 1);
                for (const p of pool.parts) {
                    dummy.position.set(u.x + p.pos[0] * size, (p.pos[1] + Math.abs(gait) * .035) * size, u.z + p.pos[2] * size);
                    dummy.rotation.set(p.leg ? gait * .4 * p.leg : p.arm ? -.5 : 0, 0, 0);
                    dummy.scale.set(p.scale[0] * size, p.scale[1] * size, p.scale[2] * size); dummy.updateMatrix(); p.mesh.setMatrixAt(i, dummy.matrix);
                }
            });
            for (const p of pool.parts) { p.mesh.count = Math.min(pool.cap, units.length); p.mesh.instanceMatrix.needsUpdate = true; }
        }
        function label(group, width = 4.8, height = 1.8) {
            const image = document.createElement('canvas'); image.width = 512; image.height = 192;
            const texture = new T.CanvasTexture(image); texture.encoding = T.sRGBEncoding;
            const sprite = new T.Sprite(new T.SpriteMaterial({ map: texture, depthTest: true })); sprite.scale.set(width, height, 1); group.add(sprite);
            return { sprite, texture, image, text: null };
        }
        function write(l, text, color = '#ffffff', background = null) {
            if (l.text === text + color + background) return;
            l.text = text + color + background;
            const c = l.image.getContext('2d'); c.clearRect(0, 0, 512, 192);
            if (background) { c.fillStyle = background; c.fillRect(0, 12, 512, 168); }
            c.font = '900 108px system-ui';
            const fontSize = Math.min(108, 108 * 470 / Math.max(1, c.measureText(text).width));
            c.font = `900 ${fontSize}px system-ui`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.lineWidth = 14; c.strokeStyle = '#142d42';
            c.strokeText(text, 256, 100); c.fillStyle = color; c.fillText(text, 256, 100); l.texture.needsUpdate = true;
        }
        function heli(parent) {
            const g = new T.Group(); parent.add(g);
            const body = orb(g, 0, 0, 0, .7, '#297dc0'); body.scale.set(.55, .5, .9);
            box(g, 0, 0, .9, .15, .15, 1.6, '#3277a7'); orb(g, 0, .04, -.48, .33, '#a7f0ff');
            const rotor = box(g, 0, .5, 0, 2.9, .045, .14, '#223d50');
            for (const x of [-.5, .5]) box(g, x, -.5, 0, .06, .06, 1.5, '#213b45');
            return { group: g, rotor };
        }
        const objects = new Map();
        function makeEntity(e) {
            const group = new T.Group(); scene.add(group); const item = { group, labels: [], e };
            if (e.kind === 'gate') {
                item.panel = box(group, 0, .9, 0, e.hw * 14, 1.8, .2, '#258dec');
                for (const side of [-1, 1]) { box(group, side * e.hw * 7, 1, 0, .2, 2.1, .5, '#d7e9ec'); box(group, side * e.hw * 7, .1, 0, .65, .15, .8, '#4b7196'); }
                item.label = label(group, e.hw * 11, 1.5); item.label.sprite.position.set(0, 1.05, .18); item.labels.push(item.label);
            } else if (e.kind === 'crate') {
                const depth = e.len;
                box(group, 0, 1.2, -depth / 2, e.hw * 14, 2.4, depth, '#d99c37');
                for (let i = -3; i <= 3; i++) box(group, i * e.hw * 1.9, 1.2, .04, .08, 2.35, .12, '#f4c361');
                for (const y of [.12, 2.3]) box(group, 0, y, .1, e.hw * 14, .16, .15, '#76522b');
                item.label = label(group, 4.4, 1.6); item.label.sprite.position.set(0, 1.25, .2); item.labels.push(item.label);
                const loot = e.loot[0];
                if (loot === 'heli') { item.heli = heli(group); item.heli.group.position.set(0, 3, -depth / 2); }
                else {
                    const turret = new T.Group(); group.add(turret); turret.position.set(0, 2.8, -depth / 2);
                    box(turret, 0, 0, 0, 1.7, .6, 1.1, '#2a8fce'); box(turret, 0, .28, -.65, .4, .35, 1.5, '#b7edfa');
                    const l = label(group, 3.8, 1.15); l.sprite.position.set(0, 4.1, -depth / 2); write(l, loot === 'weapon' ? 'SİLAH ↑' : loot === 'troops' ? '+ASKER' : 'HIZ ↑', '#fff4b0'); item.labels.push(l);
                }
            } else if (e.kind === 'boss' || e.kind === 'brute') {
                const scale = e.kind === 'boss' ? e.big ? 5.5 : 4 : 2;
                box(group, 0, .8, 0, .8, 1.3, .6, '#623b42');
                const body = orb(group, 0, 1.75, 0, .85, '#ad7771'); body.scale.set(.9, 1, .62);
                orb(group, 0, 2.8, -.05, .47, '#bd9480');
                for (const side of [-1, 1]) { box(group, side * .9, 1.7, -.1, .4, 1.3, .48, '#ad7771'); box(group, side * .34, .28, 0, .38, .6, .5, '#433f44'); box(group, side * .18, 2.9, -.48, .13, .1, .06, '#ffe14b'); }
                group.scale.setScalar(scale);
            }
            objects.set(e, item); return item;
        }
        function disposeEntity(item) {
            scene.remove(item.group);
            for (const l of item.labels) { l.texture.dispose(); l.sprite.material.dispose(); }
        }
        const squadLabel = label(scene, 2.8, 1.1);
        const escort = heli(scene);
        const bulletMesh = instances(boxGeo, '#ffdf62', 200);
        bulletMesh.material = new T.MeshBasicMaterial({ color: '#ffe273' });
        const particles = instances(sphereGeo, '#ffbd52', 250);
        particles.castShadow = false;
        const floating = Array.from({ length: 10 }, () => label(scene, 4, 1.25));
        const danger = new T.Mesh(new T.PlaneGeometry(6.4, 6), new T.MeshBasicMaterial({ color: '#ff372c', transparent: true, opacity: .4, side: T.DoubleSide }));
        danger.rotation.x = -Math.PI / 2; danger.position.y = .13; scene.add(danger);
        let width = 0, height = 0;
        function render(run, time, idleSoldiers) {
            const w = canvas.clientWidth, h = canvas.clientHeight;
            if (w !== width || h !== height) { width = w; height = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
            const camZ = run?.z || time * 2, paused = !run || run.paused || run.over;
            roadMarks.position.z = camZ % 4; railPosts.position.z = camZ % 5; waves.position.z = (time * .4) % 7;
            const blue = [], red = [], live = new Set();
            const soldiers = run ? run.soldiers : idleSoldiers;
            const count = Math.min(100, soldiers), cols = Math.max(1, Math.ceil(Math.sqrt(count)));
            for (let i = 0; i < count; i++) blue.push({ x: (run?.x || 0) * 7 + ((i % cols) - (Math.min(cols, count - Math.floor(i / cols) * cols) - 1) / 2) * .58, z: Math.floor(i / cols) * .56, size: count < 4 ? 1.15 : .9 });
            if (run) for (const e of run.ents) {
                const d = e.z - run.z;
                if (d < -4 || d > 76 || (e.kind === 'gate' ? e.used : e.hp <= 0)) continue;
                if (e.kind === 'zombie') { red.push({ x: e.x * 7, z: -d, size: 1 }); continue; }
                live.add(e); const item = objects.get(e) || makeEntity(e);
                item.group.position.set(e.x * 7, 0, -d);
                if (item.label) {
                    if (e.kind === 'gate') { item.panel.material = mat(e.op === '−' ? '#e95347' : '#258dec'); write(item.label, e.op + Math.max(0, Math.round(e.v))); }
                    else write(item.label, String(Math.max(0, Math.ceil(e.hp))));
                }
                if (item.heli) item.heli.rotor.rotation.y = time * 35;
                if (e.kind === 'boss' || e.kind === 'brute') item.group.rotation.z = Math.sin(time * 4) * .025;
            }
            if (!run) for (let i = 0; i < 120; i++) red.push({ x: (i % 12 - 5.5) * .65, z: -19 - Math.floor(i / 12) * .6, size: 1 });
            for (const [e, item] of objects) if (!live.has(e)) { disposeEntity(item); objects.delete(e); }
            drawArmy(friends, blue, time, paused); drawArmy(enemies, red, time, paused);
            write(squadLabel, String(soldiers), '#fff', '#1265bc'); squadLabel.sprite.position.set((run?.x || 0) * 7, 2.1, Math.ceil(count / cols) * .56 + .8);
            const bullets = [...(run?.bullets || []), ...(run?.rockets || [])].slice(0, 200);
            for (let i = 0; i < bullets.length; i++) { const b = bullets[i]; dummy.position.set(b.x * 7, .9, -(b.z - run.z)); dummy.rotation.set(0, 0, 0); dummy.scale.set(.09, .09, .9); dummy.updateMatrix(); bulletMesh.setMatrixAt(i, dummy.matrix); }
            const effects = (run?.fx || []).slice(0, 250);
            effects.forEach((p, i) => { dummy.position.set(p.x * 7, .2 + p.h * 7, -(p.z - run.z)); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar((1 - p.t / p.life) * (p.spark ? .22 : .12)); dummy.updateMatrix(); particles.setMatrixAt(i, dummy.matrix); });
            particles.count = effects.length; particles.instanceMatrix.needsUpdate = true;
            floating.forEach((l, i) => {
                const t = run?.texts[i]; l.sprite.visible = Boolean(t);
                if (t) { write(l, t.text, t.color); l.sprite.position.set(t.x * 7, 3 + t.t * 3, -(t.z - run.z)); l.sprite.material.opacity = Math.max(0, 1 - t.t / 1.1); }
            });
            bulletMesh.count = bullets.length; bulletMesh.instanceMatrix.needsUpdate = true;
            escort.group.visible = Boolean(run?.heli); escort.group.position.set((run?.x || 0) * 7 + 2.2, 4 + Math.sin(time * 2) * .2, 1); escort.rotor.rotation.y = time * 35;
            danger.visible = Boolean(run?.danger); if (run?.danger) { danger.position.x = run.danger.x * 7; danger.position.z = 0; danger.material.opacity = .2 + Math.sin(time * 20) * .15; }
            const shake = run && !paused ? run.shake : 0;
            camera.position.x = (run?.x || 0) * .65 + Math.sin(time * 70) * shake * .3;
            renderer.render(scene, camera);
        }
        canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); canvas.hidden = true; });
        canvas.addEventListener('webglcontextrestored', () => { canvas.hidden = false; });
        return { render };
    };
})();
