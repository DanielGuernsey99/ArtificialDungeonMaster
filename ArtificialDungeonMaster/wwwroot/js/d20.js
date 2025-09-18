// wwwroot/js/d20.js
(function () {
    // ----- DOM + guards -----
    const holder = document.querySelector('.d20-3d');
    const canvas = document.getElementById('d20-canvas');
    if (!holder || !canvas) { console.warn('[d20] Missing holder/canvas'); return; }
    if (!('THREE' in window)) { console.warn('[d20] Three.js not loaded'); return; }

    // ----- Renderer / Scene / Camera -----
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    if (THREE.ACESFilmicToneMapping) renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    camera.position.set(0, 0, 6);
    scene.add(camera);

    // ----- Soft warm environment (PMREM from a small canvas) -----
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envCanvas = document.createElement('canvas');
    envCanvas.width = 512; envCanvas.height = 256;
    const ectx = envCanvas.getContext('2d');
    const g1 = ectx.createLinearGradient(0, 0, 0, envCanvas.height);
    g1.addColorStop(0, '#1a1410'); g1.addColorStop(1, '#0a0807');
    ectx.fillStyle = g1; ectx.fillRect(0, 0, envCanvas.width, envCanvas.height);
    const rg = ectx.createRadialGradient(380, 80, 10, 380, 80, 160);
    rg.addColorStop(0, 'rgba(255,210,140,0.75)'); rg.addColorStop(1, 'rgba(255,210,140,0)');
    ectx.fillStyle = rg; ectx.beginPath(); ectx.arc(380, 80, 160, 0, Math.PI * 2); ectx.fill();
    const envTex = new THREE.CanvasTexture(envCanvas);
    envTex.mapping = THREE.EquirectangularReflectionMapping;
    if (THREE.SRGBColorSpace) envTex.colorSpace = THREE.SRGBColorSpace;
    const envRT = pmrem.fromEquirectangular(envTex);
    scene.environment = envRT.texture;
    envTex.dispose();

    // ----- D20 geometry (icosahedron, non-indexed) with per-face UVs into a 5x4 atlas -----
    const radius = 1.25;
    const geo = new THREE.IcosahedronGeometry(radius, 0).toNonIndexed();

    const COLS = 5, ROWS = 4;          // 20 faces -> 5 x 4 grid
    const triUV = [                    // upright triangle within a cell
        new THREE.Vector2(0.50, 0.06),   // tip
        new THREE.Vector2(0.06, 0.94),   // base-left
        new THREE.Vector2(0.94, 0.94)    // base-right
    ];

    // Apply atlas UVs
    (function setPerFaceUVs() {
        const uv = new Float32Array(geo.attributes.position.count * 2);
        for (let f = 0; f < geo.attributes.position.count / 3; f++) {
            const col = f % COLS, row = Math.floor(f / COLS);
            const u0 = col / COLS, v0 = row / ROWS, us = 1 / COLS, vs = 1 / ROWS;
            for (let k = 0; k < 3; k++) {
                uv[(f * 3 + k) * 2 + 0] = u0 + triUV[k].x * us;
                uv[(f * 3 + k) * 2 + 1] = v0 + triUV[k].y * vs;
            }
        }
        geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    })();

    // ----- Atlas helpers -----
    // Center at triangle centroid in atlas pixels; biasY lets you nudge up/down if desired.
    function faceCentroid(col, row, cellW, cellH, biasY = 0) {
        const u = (triUV[0].x + triUV[1].x + triUV[2].x) / 3;
        const v = (triUV[0].y + triUV[1].y + triUV[2].y) / 3;
        return { x: (col + u) * cellW, y: (row + v) * cellH + biasY * cellH };
    }

    // Draw text centered by actual glyph bounds (ink box), not em-box
    function drawTextCentered(g, text, cx, cy, fillStyle, strokeStyle, lineWidth) {
        g.textAlign = 'center';
        g.textBaseline = 'alphabetic';
        const m = g.measureText(text);
        const ascent = m.actualBoundingBoxAscent || 0;
        const descent = m.actualBoundingBoxDescent || 0;
        const y = cy + (ascent - (ascent + descent) / 2);
        if (strokeStyle && lineWidth) {
            g.strokeStyle = strokeStyle;
            g.lineWidth = lineWidth;
            g.strokeText(text, cx, y);
        }
        if (fillStyle) {
            g.fillStyle = fillStyle;
            g.fillText(text, cx, y);
        }
    }

    // ----- Build atlases (color, bump, metalness, roughness, emissive) -----
    function makeAtlases() {
        const size = 2048; // plenty for crisp digits
        const cellW = size / COLS, cellH = size / ROWS;

        const c = document.createElement('canvas'); c.width = c.height = size;  // color
        const b = document.createElement('canvas'); b.width = b.height = size;  // bump (height)
        const m = document.createElement('canvas'); m.width = m.height = size;  // metalness
        const r = document.createElement('canvas'); r.width = r.height = size;  // roughness
        const e = document.createElement('canvas'); e.width = e.height = size;  // emissive

        const ctx = c.getContext('2d');
        const btx = b.getContext('2d');
        const mtx = m.getContext('2d');
        const rtx = r.getContext('2d');
        const etx = e.getContext('2d');

        // --- Base: black marble texture ---
        ctx.fillStyle = '#0c0c0e'; ctx.fillRect(0, 0, size, size);
        ctx.globalAlpha = 0.18;
        for (let i = 0; i < 140; i++) {
            const y = Math.random() * size;
            const thick = 1 + Math.random() * 3;
            ctx.strokeStyle = (i % 3 === 0) ? '#666a72' : '#2b2e35';
            ctx.lineWidth = thick;
            ctx.beginPath();
            for (let x = 0; x <= size; x += 8) {
                const off = Math.sin((x * 0.006) + (i * 0.7)) * 8 + Math.sin((x * 0.018) - (i * 0.3)) * 3;
                const yy = y + off;
                if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
            }
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Neutral defaults for PBR maps
        btx.fillStyle = '#808080'; btx.fillRect(0, 0, size, size); // 0.5 height
        mtx.fillStyle = '#000000'; mtx.fillRect(0, 0, size, size); // 0 metal
        rtx.fillStyle = '#e0e0e0'; rtx.fillRect(0, 0, size, size); // high roughness
        etx.fillStyle = '#000000'; etx.fillRect(0, 0, size, size); // off

        // Utility: path of the triangle cell
        const triPath = (g, col, row) => {
            const x0 = col * cellW, y0 = row * cellH;
            g.beginPath();
            g.moveTo(x0 + cellW * 0.50, y0 + cellH * 0.06);
            g.lineTo(x0 + cellW * 0.06, y0 + cellH * 0.94);
            g.lineTo(x0 + cellW * 0.94, y0 + cellH * 0.94);
            g.closePath();
        };

        function getFittedFontPx(text) {
            const maxW = cellW * 0.32;
            const maxH = cellH * 0.25;
            let px = cellW * (text.length === 1 ? 0.28 : 0.24);
            for (let i = 0; i < 80; i++) {
                ctx.font = `900 ${Math.floor(px)}px Cinzel, Caudex, serif`;
                const w = ctx.measureText(text).width;
                if (w <= maxW && px <= maxH) break;
                px -= Math.max(1, px * 0.05);
                if (px < 10) break;
            }
            return Math.floor(px);
        }

        // Draw all faces
        for (let i = 0; i < 20; i++) {
            const col = i % COLS, row = Math.floor(i / COLS);
            const x0 = col * cellW, y0 = row * cellH;
            const { x: cx, y: cy } = faceCentroid(col, row, cellW, cellH, /*biasY*/ 0.00);
            const text = String(i + 1); // 1..20
            const fontPx = getFittedFontPx(text);
            const outline = Math.max(2, Math.floor(fontPx * 0.08));

            // ---- COLOR (gold digits + subtle halo, clipped to triangle) ----
            ctx.save(); triPath(ctx, col, row); ctx.clip();
            const halo = ctx.createRadialGradient(cx, cy, fontPx * 0.22, cx, cy, fontPx * 0.85);
            halo.addColorStop(0, 'rgba(255,220,90,0.16)');
            halo.addColorStop(1, 'rgba(255,220,90,0.00)');
            ctx.fillStyle = halo; ctx.fillRect(x0, y0, cellW, cellH);

            ctx.font = `900 ${fontPx}px Cinzel, Caudex, serif`;
            // Stroke slightly darker than marble to fake edge shadow
            drawTextCentered(ctx, text, cx, cy, /*fill*/ null, 'rgba(10,7,4,0.95)', outline);
            // Gold fill gradient
            const gg = ctx.createLinearGradient(x0, y0, x0 + cellW, y0 + cellH);
            gg.addColorStop(0.00, '#fff9d1');
            gg.addColorStop(0.30, '#ffe27a');
            gg.addColorStop(0.65, '#f5b52f');
            gg.addColorStop(1.00, '#9a5a00');
            drawTextCentered(ctx, text, cx, cy, gg, null, 0);
            ctx.restore();

            // ---- BUMP (engraving) ----
            // Lower the numbers by making them darker than 0.5 in the bump/height map
            btx.save(); triPath(btx, col, row); btx.clip();
            btx.font = `900 ${fontPx}px Cinzel, Caudex, serif`;
            drawTextCentered(btx, text, cx, cy, '#5a5a5a', null, 0); // < 0x808080 = recessed
            btx.restore();

            // ---- METALNESS (shiny edges inside the cut) ----
            mtx.save(); triPath(mtx, col, row); mtx.clip();
            mtx.font = `900 ${fontPx}px Cinzel, Caudex, serif`;
            drawTextCentered(mtx, text, cx, cy, '#ffffff', null, 0); // digits are a bit metallic
            mtx.restore();

            // ---- ROUGHNESS (smoother inside the cut) ----
            rtx.save(); triPath(rtx, col, row); rtx.clip();
            rtx.font = `900 ${fontPx}px Cinzel, Caudex, serif`;
            drawTextCentered(rtx, text, cx, cy, '#2a2a2a', null, 0); // darker = smoother
            rtx.restore();

            // ---- EMISSIVE (very subtle warm lift, optional) ----
            etx.save(); triPath(etx, col, row); etx.clip();
            etx.font = `900 ${fontPx}px Cinzel, Caudex, serif`;
            drawTextCentered(etx, text, cx, cy, '#6f5010', null, 0);
            etx.restore();
        }

        // Canvas -> Three textures
        function mkTex(cnv, useSRGB = false) {
            const t = new THREE.CanvasTexture(cnv);
            if (useSRGB && THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
            t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy?.() || 1);
            t.generateMipmaps = true; t.needsUpdate = true;
            return t;
        }

        applyMaterial(
            mkTex(c, true),
            mkTex(b, false),
            mkTex(m, false),
            mkTex(r, false),
            mkTex(e, true)
        );
    }

    // ----- Apply material, add mesh, lights, and animate -----
    function applyMaterial(map, bumpMap, metalnessMap, roughnessMap, emissiveMap) {
        const mat = new THREE.MeshStandardMaterial({
            map,
            bumpMap, bumpScale: -0.08,      // negative = recessed (engraved)
            metalness: 0.0, metalnessMap,
            roughness: 0.9, roughnessMap,
            emissive: new THREE.Color('#8f6a1b'),
            emissiveIntensity: 0.35,
            emissiveMap,
            color: 0xffffff,
            envMapIntensity: 1.2,

            transparent: true,
            opacity: 0.05
        });

        const mesh = new THREE.Mesh(geo, mat);
        scene.add(mesh);

        const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(geo),
            new THREE.LineBasicMaterial({ color: 0x101010 })
        );
        mesh.add(edges);

        // Lights
        const key = new THREE.PointLight(0xffe0b0, 1.35); key.position.set(3, 2.2, 3); scene.add(key);
        const fill = new THREE.PointLight(0xffb36b, 0.7); fill.position.set(-2.3, -1.8, 3); scene.add(fill);
        const rim = new THREE.PointLight(0xffffff, 0.35); rim.position.set(0, 0, -3); scene.add(rim);

        // Fit renderer to container
        function fit() {
            const rect = holder.getBoundingClientRect();
            const size = Math.max(1, Math.min(rect.width, rect.height));
            renderer.setSize(size, size, false);
            camera.aspect = 1; camera.updateProjectionMatrix();
        }
        fit(); new ResizeObserver(fit).observe(holder);

        // Animate
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let raf, last = 0;
        function frame(t) {
            const dt = (t - last) * 0.001; last = t;
            if (!reduceMotion) { mesh.rotation.y += dt * 0.7; mesh.rotation.x += dt * 0.35; }
            renderer.render(scene, camera);
            raf = requestAnimationFrame(frame);
        }
        raf = requestAnimationFrame(frame);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) cancelAnimationFrame(raf); else raf = requestAnimationFrame(frame);
        });
    }

    // Kick off
    makeAtlases();
})();
