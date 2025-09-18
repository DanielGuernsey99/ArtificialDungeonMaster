// 3D Tavern with 3D torches + procedural textures for walls & wood surfaces.
// Requires Three.js (three.min.js) to be loaded first.

(function () {
    const canvas = document.getElementById('tavern3d-canvas');
    if (!canvas || typeof THREE === 'undefined') return;

    // ---------------- Renderer / Scene / Camera ----------------
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const MAX_ANISO = renderer.capabilities.getMaxAnisotropy?.() || 4;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0d0a07, 0.06);

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 1.2, 3.4);
    camera.lookAt(0, 1.0, 0);

    // ---------------- Helpers: Procedural Textures ----------------

    // Simple seeded PRNG
    function rng(seed = 1337) {
        let s = seed >>> 0;
        return () => (s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff;
    }

    // 2D value noise (coarse + bilinear) for organic variation
    function valueNoise(width, height, scale, rnd) {
        const gridX = Math.max(2, Math.floor(width / scale));
        const gridY = Math.max(2, Math.floor(height / scale));
        const grid = [];
        for (let y = 0; y <= gridY; y++) {
            grid[y] = [];
            for (let x = 0; x <= gridX; x++) grid[y][x] = rnd();
        }
        const data = new Float32Array(width * height);
        for (let y = 0; y < height; y++) {
            const gy = (y / scale);
            const y0 = Math.floor(gy), y1 = (y0 + 1);
            const ty = gy - y0;
            for (let x = 0; x < width; x++) {
                const gx = (x / scale);
                const x0 = Math.floor(gx), x1 = (x0 + 1);
                const tx = gx - x0;

                const v00 = grid[y0 % gridY][x0 % gridX];
                const v10 = grid[y0 % gridY][x1 % gridX];
                const v01 = grid[y1 % gridY][x0 % gridX];
                const v11 = grid[y1 % gridY][x1 % gridX];

                const a = v00 + (v10 - v00) * tx;
                const b = v01 + (v11 - v01) * tx;
                data[y * width + x] = a + (b - a) * ty;
            }
        }
        return data;
    }

    // Procedural plaster (aged wall): mottled tone + speckling + grime vignetting
    function makePlasterTexture({ w = 512, h = 512, seed = 42 } = {}) {
        const rnd = rng(seed);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');

        // Base parchmenty tone
        ctx.fillStyle = '#3b2a1b'; // deep base to multiply over
        ctx.fillRect(0, 0, w, h);

        // Light plaster tint with noise modulation
        const n1 = valueNoise(w, h, 60, rnd);
        const n2 = valueNoise(w, h, 24, rnd);

        const img = ctx.getImageData(0, 0, w, h);
        const d = img.data;
        for (let i = 0; i < w * h; i++) {
            const v1 = n1[i]; // broad blotches
            const v2 = n2[i]; // finer texture
            // mix to get a mottled brightness
            const m = 0.45 + 0.35 * v1 + 0.15 * v2; // 0..~1
            // plaster color (warm desaturated)
            let r = 210 * m, g = 196 * m, b = 170 * m;
            // subtle speckles (salt & pepper)
            const sp = (rnd() < 0.002) ? -30 : 0;
            r = Math.max(0, r + sp); g = Math.max(0, g + sp); b = Math.max(0, b + sp);

            const idx = i * 4;
            d[idx + 0] = r;
            d[idx + 1] = g;
            d[idx + 2] = b;
            d[idx + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);

        // grime edges (dark vignette)
        const grd = ctx.createRadialGradient(w * 0.5, h * 0.6, w * 0.15, w * 0.5, h * 0.6, w * 0.7);
        grd.addColorStop(0, 'rgba(0,0,0,0)');
        grd.addColorStop(1, 'rgba(0,0,0,0.15)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);

        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = MAX_ANISO;
        return tex;
    }

    // Procedural wood planks (floor/table/beams)
    // Stripe-like grain + offset planks + endgrain darkening
    function makeWoodTexture({ w = 1024, h = 1024, seed = 99, hue = 28 } = {}) {
        const rnd = rng(seed);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');

        // Base hue/sat/val -> convert to rgb (quick)
        function hsv2rgb(h, s, v) {
            let f = (n, k = (n + h / 60) % 6) => v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
            return [f(5), f(3), f(1)];
        }

        // background
        const [br, bg, bb] = hsv2rgb(hue, 0.55, 0.35); // dark brown
        ctx.fillStyle = `rgb(${(br * 255) | 0},${(bg * 255) | 0},${(bb * 255) | 0})`;
        ctx.fillRect(0, 0, w, h);

        // Plank layout
        const plankH = Math.floor(h / 10);
        const plankCount = Math.ceil(h / plankH);
        const nBroad = valueNoise(w, h, 140, rnd);
        const nFine = valueNoise(w, h, 28, rnd);

        const img = ctx.getImageData(0, 0, w, h);
        const d = img.data;

        for (let py = 0; py < h; py++) {
            const row = Math.floor(py / plankH);
            const offset = (row % 2 === 0) ? 0 : Math.floor(w * 0.15); // stagger joints
            for (let px = 0; px < w; px++) {
                // wood grain: sine stripes warped by noise
                const u = (px + offset) / w;
                const v = py / h;
                const grain = Math.sin((u * 60) + nBroad[py * w + px] * 5) * 0.5 + 0.5; // 0..1
                const detail = nFine[py * w + px]; // 0..1

                // base wood tone
                const [r0, g0, b0] = hsv2rgb(hue, 0.6 - 0.1 * grain, 0.38 + 0.1 * grain);
                let r = r0 * 255, g = g0 * 255, b = b0 * 255;

                // knots (random circular dark spots)
                if (rnd() < 0.0008) {
                    const nx = px + (rnd() * 40 - 20), ny = py + (rnd() * 20 - 10);
                    const dist = Math.hypot(px - nx, py - ny) / 30;
                    const k = Math.max(0, 1 - dist);
                    r *= (1 - 0.4 * k); g *= (1 - 0.4 * k); b *= (1 - 0.4 * k);
                }

                // micro variation
                const m = 0.85 + 0.15 * detail;
                r *= m; g *= m; b *= m;

                // near plank edges darken a bit
                const edgeY = Math.min(py % plankH, plankH - (py % plankH));
                const edgeFactor = 0.92 + 0.08 * Math.min(1, edgeY / 10);
                r *= edgeFactor; g *= edgeFactor; b *= edgeFactor;

                const idx = (py * w + px) * 4;
                d[idx + 0] = Math.max(0, Math.min(255, r));
                d[idx + 1] = Math.max(0, Math.min(255, g));
                d[idx + 2] = Math.max(0, Math.min(255, b));
                d[idx + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);

        // thin seams between planks
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        for (let y = plankH; y < h; y += plankH) ctx.fillRect(0, y - 1, w, 2);

        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = MAX_ANISO;
        return tex;
    }

    // Create textures
    const plasterTex = makePlasterTexture({ w: 512, h: 512, seed: 122 });
    const woodTex = makeWoodTexture({ w: 1024, h: 1024, seed: 909, hue: 28 });

    // ---------------- Lights ----------------
    const ambient = new THREE.AmbientLight(0x3a2a1c, 0.6);
    scene.add(ambient);

    // ---------------- Materials (with textures) ----------------
    const matWall = new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: 0.95, metalness: 0.02, map: plasterTex
    });
    const matFloor = new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: 0.88, metalness: 0.04, map: woodTex
    });
    const matBeam = new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: 0.84, metalness: 0.05, map: woodTex
    });
    const matMetal = new THREE.MeshStandardMaterial({ color: 0x44413d, roughness: 0.5, metalness: 0.8 });
    const matBowl = new THREE.MeshStandardMaterial({ color: 0x5a3a21, roughness: 0.85, metalness: 0.1, map: woodTex });

    // Adjust UV repeats per surface scale
    plasterTex.repeat.set(2.5, 1.6);   // walls
    woodTex.repeat.set(3, 3);          // default (floor)

    // ---------------- Room ----------------
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), matWall);
    backWall.position.set(0, 1.6, -2.2);
    scene.add(backWall);

    const sideL = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), matWall);
    sideL.position.set(-3.2, 1.6, 0);
    sideL.rotation.y = Math.PI / 2.6;
    scene.add(sideL);

    const sideR = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), matWall);
    sideR.position.set(3.2, 1.6, 0);
    sideR.rotation.y = -Math.PI / 2.6;
    scene.add(sideR);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), matFloor);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.0;
    // woodTex repeat already set; floor uses it at default scale
    scene.add(floor);

    // ceiling beams
    const beamGeo = new THREE.BoxGeometry(6.5, 0.12, 0.25);
    for (let i = 0; i < 4; i++) {
        const beam = new THREE.Mesh(beamGeo, matBeam);
        // Slightly different UV scale for beams (narrower)
        beam.material = matBeam.clone();
        beam.material.map = woodTex.clone();
        beam.material.map.repeat.set(5, 0.7);
        beam.position.set(0, 2.6 + 0.05 * Math.sin(i), -1.6 + i * 0.9);
        scene.add(beam);
    }

    // table
    const tableMat = matBeam.clone();
    tableMat.map = woodTex.clone();
    tableMat.map.repeat.set(2.5, 1.6); // different scale for table

    const table = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 1.4), tableMat);
    table.position.set(0, 0.78, 1.0);
    scene.add(table);

    // mugs
    const mugMat = new THREE.MeshStandardMaterial({ color: 0xdbc7a1, roughness: 0.6, metalness: 0.1 });
    for (let i = -1; i <= 1; i++) {
        const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.16, 16), mugMat);
        mug.position.set(i * 0.8 + (i === 0 ? 0.15 : 0), 0.87, 0.65 + 0.15 * (i % 2));
        scene.add(mug);
    }

    // ---------------- Torches (3D) ----------------
    // Procedural radial textures (flame/glow)
    function makeRadialTexture(innerRGB, outerRGB, size = 256) {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const ctx = c.getContext('2d');
        const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        const inner = `rgba(${innerRGB.join(',')},1)`;
        const outer = `rgba(${outerRGB.join(',')},0)`;
        g.addColorStop(0, inner); g.addColorStop(1, outer);
        ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
        const tex = new THREE.CanvasTexture(c);
        tex.anisotropy = MAX_ANISO;
        return tex;
    }
    const texFlame = makeRadialTexture([255, 210, 120], [255, 90, 0], 256);
    const texGlow = makeRadialTexture([255, 160, 60], [255, 140, 0], 256);

    function createTorch({ x, y, z, facing = 'z+' }) {
        const grp = new THREE.Group();
        grp.position.set(x, y, z);
        if (facing === 'x+') grp.rotation.y = -Math.PI / 2.6;
        else if (facing === 'x-') grp.rotation.y = Math.PI / 2.6;

        const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 24), matMetal);
        plate.rotation.z = Math.PI / 2;
        plate.position.set(0, 0, -0.03);
        grp.add(plate);

        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.28), matMetal);
        arm.position.set(0, 0, 0.12);
        grp.add(arm);

        const bowl = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.18, 24, 1, true), matBowl);
        // Give bowl its own wood tiling
        bowl.material = matBowl.clone();
        bowl.material.map = woodTex.clone();
        bowl.material.map.repeat.set(1.2, 0.8);
        bowl.position.set(0, 0.05, 0.26);
        bowl.rotation.x = Math.PI;
        grp.add(bowl);

        const flameMat1 = new THREE.SpriteMaterial({ map: texFlame, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
        const flame1 = new THREE.Sprite(flameMat1);
        flame1.scale.set(0.22, 0.32, 1);
        flame1.position.set(0, 0.15, 0.26);
        grp.add(flame1);

        const flameMat2 = new THREE.SpriteMaterial({ map: texFlame, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
        const flame2 = new THREE.Sprite(flameMat2);
        flame2.scale.set(0.16, 0.24, 1);
        flame2.position.set(0.01, 0.19, 0.27);
        grp.add(flame2);

        const glowMat = new THREE.SpriteMaterial({ map: texGlow, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 });
        const glow = new THREE.Sprite(glowMat);
        glow.scale.set(0.6, 0.6, 1);
        glow.position.set(0, 0.12, 0.22);
        grp.add(glow);

        const light = new THREE.PointLight(0xffa860, 1.1, 6, 2.0);
        light.position.set(0, 0.14, 0.25);
        grp.add(light);

        // Smoke
        const smokeCount = 24;
        const sGeo = new THREE.BufferGeometry();
        const sPos = new Float32Array(smokeCount * 3);
        const sVel = new Float32Array(smokeCount * 2);
        for (let i = 0; i < smokeCount; i++) {
            sPos[i * 3 + 0] = (Math.random() - 0.5) * 0.05;
            sPos[i * 3 + 1] = 0.14 + Math.random() * 0.05;
            sPos[i * 3 + 2] = 0.25 + (Math.random() - 0.5) * 0.05;
            sVel[i * 2 + 0] = 0.06 + Math.random() * 0.06; // vertical
            sVel[i * 2 + 1] = (Math.random() - 0.5) * 0.04; // lateral
        }
        sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
        const smokeMat = new THREE.PointsMaterial({
            map: texGlow, size: 0.05, transparent: true, opacity: 0.25, depthWrite: false, color: 0x888888
        });
        const smoke = new THREE.Points(sGeo, smokeMat);
        grp.add(smoke);

        grp.userData = { flame1, flame2, glow, light, smoke: { geo: sGeo, pos: sPos, vel: sVel } };
        return grp;
    }

    // place torches
    const torchCenterL = createTorch({ x: -1.3, y: 1.6, z: -2.19, facing: 'z+' });
    const torchCenterR = createTorch({ x: 1.3, y: 1.6, z: -2.19, facing: 'z+' });
    const torchSideL = createTorch({ x: -3.1, y: 1.7, z: -0.2, facing: 'x+' });
    const torchSideR = createTorch({ x: 3.1, y: 1.7, z: 0.2, facing: 'x-' });
    scene.add(torchCenterL, torchCenterR, torchSideL, torchSideR);
    const torchGroups = [torchCenterL, torchCenterR, torchSideL, torchSideR];

    // ---------------- Embers (WebGL points) ----------------
    const emberCount = 180;
    const emberGeo = new THREE.BufferGeometry();
    const ePos = new Float32Array(emberCount * 3);
    const eVel = new Float32Array(emberCount);
    for (let i = 0; i < emberCount; i++) {
        ePos[i * 3 + 0] = (Math.random() - 0.5) * 6;
        ePos[i * 3 + 1] = Math.random() * 1.8 + 0.2;
        ePos[i * 3 + 2] = (Math.random() - 0.5) * 4;
        eVel[i] = Math.random() * 0.12 + 0.04;
    }
    emberGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
    emberGeo.setAttribute('speed', new THREE.BufferAttribute(eVel, 1));

    const emberMat = new THREE.PointsMaterial({
        map: texGlow, color: 0xffbb66, size: 0.035, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const embers = new THREE.Points(emberGeo, emberMat);
    scene.add(embers);

    // ---------------- Resize ----------------
    function resize() {
        const rect = canvas.parentElement.getBoundingClientRect();
        const w = rect.width, h = rect.height;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize, { passive: true });
    resize();

    // ---------------- Animate ----------------
    const clock = new THREE.Clock();
    function animate() {
        requestAnimationFrame(animate);
        const dt = clock.getDelta();
        const t = clock.elapsedTime;

        // Torch flicker/smoke
        for (const g of torchGroups) {
            const { flame1, flame2, glow, light, smoke } = g.userData;

            const s1 = 1 + Math.sin(t * 12 + g.id) * 0.05;
            const s2 = 1 + Math.cos(t * 15 + g.id * 2.0) * 0.06;
            flame1.scale.set(0.22 * s1, 0.32 * s2, 1);
            flame2.scale.set(0.16 * s2, 0.24 * s1, 1);

            flame1.position.x = (Math.sin(t * 20 + g.id) * 0.01);
            flame2.position.x = -(Math.cos(t * 17 + g.id) * 0.01);
            glow.scale.setScalar(0.6 + Math.sin(t * 3.7 + g.id) * 0.05 + 0.02);

            const f = (Math.sin(t * 17.0 + g.id) + Math.sin(t * 13.0 + g.id * 0.7)) * 0.08;
            light.intensity = 1.15 + f;
            light.position.x = 0.01 * Math.sin(t * 2.3 + g.id);

            const pos = smoke.geo.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const base = i * 3;
                let y = pos.array[base + 1] + smoke.vel[i * 2 + 0] * dt;
                let x = pos.array[base + 0] + Math.sin((t + i) * 0.8) * smoke.vel[i * 2 + 1] * dt;
                let z = pos.array[base + 2] + Math.cos((t + i) * 0.8) * smoke.vel[i * 2 + 1] * dt;
                if (y > 0.6) {
                    x = (Math.random() - 0.5) * 0.05;
                    y = 0.14 + Math.random() * 0.05;
                    z = 0.25 + (Math.random() - 0.5) * 0.05;
                }
                pos.array[base + 0] = x;
                pos.array[base + 1] = y;
                pos.array[base + 2] = z;
            }
            pos.needsUpdate = true;
        }

        // Embers drift
        const eAttr = embers.geometry.attributes.position;
        for (let i = 0; i < emberCount; i++) {
            const base = i * 3;
            const vy = eVel[i] * dt;
            let y = eAttr.array[base + 1] + vy;
            if (y > 3.2) {
                eAttr.array[base + 0] = (Math.random() - 0.5) * 6;
                y = Math.random() * 0.2 + 0.2;
                eAttr.array[base + 2] = (Math.random() - 0.5) * 4;
            }
            eAttr.array[base + 1] = y;
        }
        eAttr.needsUpdate = true;

        renderer.render(scene, camera);
    }
    animate();
})();
