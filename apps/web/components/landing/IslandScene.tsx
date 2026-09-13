"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";

/** A small illustrative diorama using the actual harbor atlas, not a fake live feed. */
export default function IslandScene({
  night,
  focus,
  journey,
  motion,
  onReady,
  onUnavailable,
}: {
  night: boolean;
  focus: number;
  journey?: { current: number };
  motion: boolean;
  onReady: (ready: boolean) => void;
  onUnavailable: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const wake = useRef<() => void>(() => {});
  const state = useRef({ night, focus, journey, motion, onReady, onUnavailable });
  state.current = { night, focus, journey, motion, onReady, onUnavailable };
  useEffect(() => wake.current(), [night, focus, motion]);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch {
      state.current.onUnavailable();
      return;
    }
    let disposed = false,
      inView = true,
      frame = 0,
      previous = 0,
      time = 0,
      darkness = 0;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setClearColor(0, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.opacity = "0";
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-5, 5, 3.5, -3.5, 0.1, 50);
    camera.position.set(0, 8, 11);
    camera.lookAt(0, 0.15, 0);
    const ambient = new THREE.AmbientLight(0xffffff, 2.4);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffe5bd, 2);
    sun.position.set(-3, 8, 5);
    scene.add(sun);
    const island = new THREE.Group();
    scene.add(island);
    const resources: Array<{ dispose: () => void }> = [];
    function ground(
      radius: number,
      depth: number,
      color: number,
      height: number,
    ) {
      const shape = new THREE.Shape();
      for (let i = 0; i <= 80; i++) {
        const a = (i / 80) * Math.PI * 2,
          r = radius * (1 + 0.05 * Math.sin(a * 3) + 0.035 * Math.cos(a * 5));
        const x = Math.cos(a) * r,
          y = Math.sin(a) * r * 0.65;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      }
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.08,
        bevelThickness: 0.07,
      });
      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 1,
        flatShading: true,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = height;
      island.add(mesh);
      resources.push(geometry, material);
      return material;
    }
    const sand = ground(3.5, 0.22, 0xd6c5a0, -0.24);
    const grass = ground(3.15, 0.1, 0xaaaf88, 0.02);
    // Soft water rings fade into the page instead of putting the island in a boxed viewport.
    const waterGeo = new THREE.PlaneGeometry(11, 8);
    const waterMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 }, uNight: { value: 0 } },
      vertexShader:
        "varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader:
        "varying vec2 vUv; uniform float uTime; uniform float uNight; void main(){vec2 p=(vUv-.5)*2.; float r=length(p);float edge=1.-smoothstep(.55,1.,r);float wave=sin(r*70.-uTime*1.7+sin(p.x*12.)*.5);float stripe=smoothstep(.9,1.,wave)*.14;vec3 color=mix(vec3(.53,.69,.66),vec3(.22,.38,.43),uNight);gl_FragColor=vec4(color,edge*(.28+stripe));}",
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.36;
    scene.add(water);
    resources.push(waterGeo, waterMat);
    const loader = new THREE.TextureLoader();
    const sprites: THREE.SpriteMaterial[] = [];
    const litMaps: {
      material: THREE.SpriteMaterial;
      day: THREE.Texture;
      night: THREE.Texture;
    }[] = [];
    const objects: [string, number, number, number][] = [
      ["tree-large", -1.9, -0.85, 1.5],
      ["cypress", -0.8, -1.3, 1.4],
      ["tree-large", 0.9, -1.1, 1.5],
      ["lighthouse", 2.3, -0.8, 1.7],
      ["chapel", -0.5, -0.55, 1.8],
      ["house", 1.35, -0.2, 1.4],
      ["inn", -0.9, 0.35, 2.1],
      ["bakery", 0.8, 0.75, 1.45],
      ["tree-small", -2.45, 0.3, 1.15],
      ["harbor-office", -2.05, 0.95, 1.3],
      ["stall", -0.1, 1.35, 0.78],
      ["well", 1.6, 1.15, 0.65],
      ["tree-large", 2.15, 0.45, 1.25],
      ["tree-small", 0.3, -1.65, 0.85],
      ["pier", -2.75, 1.35, 0.95],
      ["planter", -0.15, 0.68, 0.38],
    ];
    let loaded = 0;
    for (const [name, x, z, height] of objects) {
      loader.load(
        `/harbor/${name}.png`,
        (texture) => {
          if (disposed) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = 2;
          const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.06,
            color: 0xffffff,
          });
          const sprite = new THREE.Sprite(material);
          const ratio = texture.image.width / texture.image.height;
          sprite.scale.set(height * ratio, height, 1);
          sprite.center.set(0.5, 0.04);
          sprite.position.set(x, 0.17, z);
          island.add(sprite);
          sprites.push(material);
          resources.push(texture, material);
          if (["inn", "house", "bakery", "harbor-office"].includes(name))
            loader.load(`/harbor/${name}-lit.png`, (lit) => {
              if (disposed) {
                lit.dispose();
                return;
              }
              lit.colorSpace = THREE.SRGBColorSpace;
              resources.push(lit);
              litMaps.push({ material, day: texture, night: lit });
              wake.current();
            });
          loaded++;
          if (loaded === objects.length) {
            renderer.domElement.style.opacity = "1";
            state.current.onReady(true);
          }
          wake.current();
        },
        undefined,
        () => {
          if (!disposed) state.current.onUnavailable();
        },
      );
    }
    const beamGeometry = new THREE.ConeGeometry(.85, 5, 24, 1, true);
    beamGeometry.translate(0, -2.5, 0);
    beamGeometry.rotateZ(Math.PI / 2);
    const beamMaterial = new THREE.MeshBasicMaterial({ color: 0xffe8b2, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(beamGeometry, beamMaterial);
    beam.position.set(2.3, 1.65, -.8);
    island.add(beam);
    resources.push(beamGeometry, beamMaterial);
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(60 * 3);
    for (let i = 0; i < 60; i++) {
      starPositions[i * 3] = Math.sin(i * 127.1);
      starPositions[i * 3 + 1] = .4 + (Math.sin(i * 311.7) * .5 + .5) * .58;
      starPositions[i * 3 + 2] = .99;
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.ShaderMaterial({
      uniforms: { uNight: { value: 0 } }, transparent: true, depthWrite: false,
      vertexShader: "void main(){gl_Position=vec4(position,1.);gl_PointSize=2.;}",
      fragmentShader: "uniform float uNight;void main(){float a=1.-smoothstep(.1,.5,length(gl_PointCoord-.5));gl_FragColor=vec4(.96,.91,.8,a*uNight*.6);}",
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    stars.frustumCulled = false;
    scene.add(stars);
    resources.push(starGeometry, starMaterial);
    const target = new THREE.Vector2();
    const pointer = (event: PointerEvent) => {
      const box = el.getBoundingClientRect();
      target.set(
        ((event.clientX - box.left) / box.width - 0.5) * 0.45,
        ((event.clientY - box.top) / box.height - 0.5) * 0.2,
      );
      wake.current();
    };
    const leave = () => target.set(0, 0);
    el.addEventListener("pointermove", pointer);
    el.addEventListener("pointerleave", leave);
    const resize = () => {
      const w = el.clientWidth,
        h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      // Keep the full shoreline in frame on narrow phones.
      const view = Math.max(6.3, 9.5 * h / w);
      camera.left = (-view * w) / h / 2;
      camera.right = (view * w) / h / 2;
      camera.top = view / 2;
      camera.bottom = -view / 2;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    const dayGrass = new THREE.Color(0xaaaf88),
      nightGrass = new THREE.Color(0x586868),
      daySand = new THREE.Color(0xd6c5a0),
      nightSand = new THREE.Color(0x697d84);
    function render(now: number) {
      frame = 0;
      if (disposed) return;
      if (!inView || document.hidden) return;
      if (now - previous < 32) {
        frame = requestAnimationFrame(render);
        return;
      }
      const dt = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      if (state.current.motion) time += dt;
      const travel = state.current.journey?.current ?? 0;
      const goal = state.current.journey ? THREE.MathUtils.smoothstep(travel, .48, .85) : state.current.night ? 1 : 0;
      darkness = state.current.motion
        ? THREE.MathUtils.lerp(darkness, goal, 0.08)
        : goal;
      beamMaterial.opacity = darkness * .045;
      beam.rotation.y = time * .18;
      starMaterial.uniforms.uNight!.value = darkness;
      waterMat.uniforms.uTime!.value = time;
      waterMat.uniforms.uNight!.value = darkness;
      ambient.intensity = 2.4 - darkness * .7;
      sun.color.setRGB(1 - darkness * .45, .9 - darkness * .22, .74 + darkness * .26);
      sun.intensity = 2 - darkness * .9;
      grass.color.copy(dayGrass).lerp(nightGrass, darkness);
      sand.color.copy(daySand).lerp(nightSand, darkness);
      sprites.forEach((mat) =>
        mat.color.setRGB(
          1 - darkness * 0.35,
          1 - darkness * 0.24,
          1 - darkness * 0.12,
        ),
      );
      litMaps.forEach(({ material, day, night: lit }) => {
        material.map = darkness > 0.5 ? lit : day;
      });
      island.rotation.y = THREE.MathUtils.lerp(
        island.rotation.y,
        state.current.journey ? -.12 + travel * .55 + (state.current.motion ? target.x * .3 : 0) : state.current.motion ? target.x : 0,
        0.04,
      );
      camera.position.y = THREE.MathUtils.lerp(
        camera.position.y,
        8 - travel * 1.2 + (state.current.motion ? target.y : 0),
        0.05,
      );
      const stops = [[0, 0, 1], [-2.05, .95, 1.35], [.8, .75, 1.4], [2.3, -.8, 1.35]];
      const [x, z, zoom] = state.current.journey
        ? [Math.sin(travel * Math.PI) * .7, -.25 + travel * .7, 1 + Math.sin(travel * Math.PI) * .32]
        : stops[state.current.focus] ?? stops[0]!;
      const easing = state.current.motion ? .065 : 1;
      island.position.x = THREE.MathUtils.lerp(island.position.x, -x! * .6, easing);
      island.position.z = THREE.MathUtils.lerp(island.position.z, -z! * .6, easing);
      camera.zoom = THREE.MathUtils.lerp(camera.zoom, zoom!, easing);
      camera.updateProjectionMatrix();
      camera.lookAt(0, 0.15, 0);
      renderer.render(scene, camera);
      if (state.current.motion || Math.abs(darkness - goal) > 0.001)
        frame = requestAnimationFrame(render);
    }
    wake.current = () => {
      if (!disposed && !frame && inView && !document.hidden)
        frame = requestAnimationFrame(render);
    };
    const io = new IntersectionObserver(([entry]) => {
      inView = !!entry?.isIntersecting;
      if (inView) wake.current();
      else {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    });
    io.observe(el);
    const visibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else wake.current();
    };
    document.addEventListener("visibilitychange", visibility);
    wake.current();
    const lost = () => {
      renderer.domElement.style.opacity = "0";
      state.current.onReady(false);
      state.current.onUnavailable();
    };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    return () => {
      disposed = true;
      wake.current = () => {};
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      el.removeEventListener("pointermove", pointer);
      el.removeEventListener("pointerleave", leave);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      resources.forEach((r) => r.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return (
    <div
      ref={host}
      style={{ position: "absolute", inset: 0 }}
      aria-hidden="true"
    />
  );
}
