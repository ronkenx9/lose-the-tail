import * as THREE from 'three';
import {
  BloomEffect,
  ChromaticAberrationEffect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  ScanlineEffect,
  VignetteEffect,
  BlendFunction,
} from 'postprocessing';
import type { City, Facing, ScreenSpec, SignSpec } from './city';
import { buildMeshes } from './voxels';
import { createWetStreet } from './wet';

export const FACING_ROT: Record<Facing, number> = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  renderPass: RenderPass;
  chroma: ChromaticAberrationEffect;
  bloom: BloomEffect;
  screens: Record<ScreenSpec['id'], { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; spec: ScreenSpec }>;
  flickers: { mat: THREE.MeshBasicMaterial; base: number; seed: number }[];
  rain: THREE.LineSegments;
  resize(): void;
  render(dt: number): void;
}

export function createStage(canvas: HTMLCanvasElement, city: City): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const fogColor = new THREE.Color(0x0a0b16);
  scene.background = fogColor;
  scene.fog = new THREE.FogExp2(fogColor, 0.028);

  const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 220);
  scene.add(camera);

  // world
  scene.add(buildMeshes(city.world));
  const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
  const wet = createWetStreet(city.world, mobile ? 0.3 : 0.5);
  scene.add(wet.mesh);
  scene.add(skyline());
  scene.add(moon());

  // signs
  const flickers: Stage['flickers'] = [];
  for (const s of city.signs) {
    const m = signMesh(s);
    scene.add(m);
    if (s.flicker) flickers.push({ mat: m.material as THREE.MeshBasicMaterial, base: 1, seed: Math.random() * 100 });
  }

  // decals: shop interiors, posters, hanging banners (Codex concept art)
  const loader = new THREE.TextureLoader();
  for (const d of city.decals) {
    const tex = loader.load(`/art/${d.img}.jpg`);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    if (d.band) {
      tex.repeat.set(1, d.band[0]);
      tex.offset.set(0, d.band[1]);
    }
    const g = d.glow ?? 1;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(d.w, d.h),
      new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(g, g, g), side: d.facing === 'X' || d.facing === 'Z' ? THREE.DoubleSide : THREE.FrontSide }),
    );
    m.position.set(d.x, d.y, d.z);
    m.rotation.y = d.facing === 'X' ? Math.PI / 2 : d.facing === 'Z' ? 0 : FACING_ROT[d.facing];
    scene.add(m);
  }

  // screens
  const screens = {} as Stage['screens'];
  for (const sp of city.screens) {
    const c = document.createElement('canvas');
    c.width = 896;
    c.height = Math.round((896 * sp.h) / sp.w);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(sp.w, sp.h),
      new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.25, 1.25, 1.25), fog: false }),
    );
    mesh.position.set(sp.x, sp.y, sp.z);
    mesh.rotation.y = FACING_ROT[sp.facing];
    scene.add(mesh);
    screens[sp.id] = { canvas: c, tex, spec: sp };
  }

  // lamp glow sprites (cheap fake volumetrics)
  const glowTex = radialTex();
  for (const l of city.lamps) {
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTex, color: 0xffd9a0, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    sp.position.set(l.x + 0.5, l.y + 0.5, l.z + 0.5);
    sp.scale.setScalar(3.2);
    scene.add(sp);
  }

  // steam rising from the alley and manholes
  const steamTex = radialTex();
  const steamPuffs: { sp: THREE.Sprite; base: THREE.Vector3; t: number; life: number }[] = [];
  for (const st of city.steam)
    for (let i = 0; i < 7; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, color: 0x9aa8b8, transparent: true, opacity: 0, depthWrite: false }));
      scene.add(sp);
      steamPuffs.push({ sp, base: new THREE.Vector3(st.x, 1.1, st.z), t: Math.random() * 4, life: 3.5 + Math.random() * 2 });
    }
  const rain = makeRain();
  scene.add(rain);

  // post
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const bloom = new BloomEffect({ intensity: 1.6, luminanceThreshold: 0.62, luminanceSmoothing: 0.2, mipmapBlur: true, radius: 0.72 });
  const chroma = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0006, 0.0006), radialModulation: true, modulationOffset: 0.3 });
  const scan = new ScanlineEffect({ blendFunction: BlendFunction.OVERLAY, density: 1.3 });
  scan.blendMode.opacity.value = 0.12;
  const noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false });
  noise.blendMode.opacity.value = 0.08;
  const vig = new VignetteEffect({ offset: 0.32, darkness: 0.72 });
  composer.addPass(new EffectPass(camera, bloom, chroma));
  composer.addPass(new EffectPass(camera, scan, noise, vig));

  const resize = () => {
    const w = window.innerWidth,
      h = window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = w < h ? 84 : 72;
    camera.updateProjectionMatrix();
    wet.resize();
  };
  resize();
  window.addEventListener('resize', resize);

  let t = 0;
  const render = (dt: number) => {
    t += dt;
    for (const f of flickers) {
      const on = Math.sin(t * 13 + f.seed) > -0.92 && Math.sin(t * 2.3 + f.seed) > -0.97;
      f.mat.opacity = on ? 1 : 0.25;
    }
    updateRain(rain, camera, dt);
    for (const p of steamPuffs) {
      p.t += dt;
      if (p.t > p.life) p.t = 0;
      const k = p.t / p.life;
      p.sp.position.set(p.base.x + Math.sin(p.t * 1.3 + p.life) * 0.3 * k, p.base.y + k * 3.2, p.base.z + Math.cos(p.t + p.life) * 0.25 * k);
      p.sp.scale.setScalar(0.6 + k * 2.4);
      (p.sp.material as THREE.SpriteMaterial).opacity = Math.sin(Math.PI * k) * 0.16;
    }
    wet.update(t);
    composer.render(dt);
  };

  return { renderer, scene, camera, composer, renderPass, chroma, bloom, screens, flickers, rain, resize, render };
}

function signMesh(s: SignSpec) {
  const scale = 128;
  const c = document.createElement('canvas');
  c.width = Math.round(s.w * scale);
  c.height = Math.round(s.h * scale);
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(6,6,10,0.88)';
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = s.color;
  g.lineWidth = 6;
  g.shadowColor = s.color;
  g.shadowBlur = 18;
  g.strokeRect(6, 6, c.width - 12, c.height - 12);
  const main = s.sub ? c.height * 0.5 : c.height * 0.62;
  g.font = `700 ${Math.round(main * 0.82)}px "JetBrains Mono", ui-monospace, monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#fff';
  g.shadowBlur = 26;
  fitText(g, s.text, c.width * 0.9);
  g.fillText(s.text, c.width / 2, s.sub ? c.height * 0.4 : c.height / 2);
  g.fillStyle = s.color;
  g.shadowBlur = 8;
  g.fillText(s.text, c.width / 2, s.sub ? c.height * 0.4 : c.height / 2);
  if (s.sub) {
    g.font = `400 ${Math.round(c.height * 0.2)}px "JetBrains Mono", monospace`;
    g.fillStyle = s.color;
    g.globalAlpha = 0.85;
    g.fillText(s.sub, c.width / 2, c.height * 0.76);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(s.w, s.h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: new THREE.Color(1.5, 1.5, 1.5), fog: false }),
  );
  m.position.set(s.x, s.y, s.z);
  m.rotation.y = FACING_ROT[s.facing];
  return m;
}

function fitText(g: CanvasRenderingContext2D, text: string, maxW: number) {
  let size = parseInt(g.font.match(/(\d+)px/)![1]);
  while (g.measureText(text).width > maxW && size > 8) {
    size -= 2;
    g.font = g.font.replace(/\d+px/, `${size}px`);
  }
}

function radialTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** ring of distant towers beyond the walls */
function skyline() {
  const group = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#07070d';
  g.fillRect(0, 0, 64, 256);
  for (let y = 4; y < 256; y += 6)
    for (let x = 3; x < 64; x += 5)
      if (Math.random() < 0.28) {
        g.fillStyle = Math.random() < 0.7 ? '#e8b46a' : '#6fb0ff';
        g.globalAlpha = 0.5 + Math.random() * 0.5;
        g.fillRect(x, y, 2, 3);
      }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  const cx = 48,
    cz = 48;
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2 + Math.random() * 0.05;
    const r = 85 + Math.random() * 45;
    const h = 25 + Math.random() * 70;
    const wdt = 8 + Math.random() * 14;
    const t = tex.clone();
    t.repeat.set(wdt / 12, h / 50);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.BoxGeometry(wdt, h, wdt), new THREE.MeshBasicMaterial({ map: t, fog: true }));
    m.position.set(cx + Math.cos(a) * r, h / 2, cz + Math.sin(a) * r);
    m.rotation.y = -a;
    group.add(m);
  }
  return group;
}

function moon() {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex(), color: 0xc8ffdc, fog: false, transparent: true, opacity: 0.9, depthWrite: false }));
  sp.position.set(-40, 120, -90);
  sp.scale.setScalar(26);
  const core = new THREE.Mesh(new THREE.BoxGeometry(7, 7, 7), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.6, 1.45), fog: false }));
  core.position.copy(sp.position);
  core.rotation.set(0.4, 0.6, 0);
  const g = new THREE.Group();
  g.add(sp, core);
  return g;
}

const RAIN_N = 2600;
const RAIN_BOX = 26;
function makeRain() {
  const pos = new Float32Array(RAIN_N * 6);
  for (let i = 0; i < RAIN_N; i++) {
    const x = (Math.random() - 0.5) * RAIN_BOX * 2,
      y = Math.random() * 30,
      z = (Math.random() - 0.5) * RAIN_BOX * 2;
    pos.set([x, y, z, x + 0.03, y + 0.55, z + 0.02], i * 6);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.LineBasicMaterial({ color: 0x8fa4d8, transparent: true, opacity: 0.35, fog: true, depthWrite: false });
  const l = new THREE.LineSegments(g, m);
  l.frustumCulled = false;
  return l;
}
function updateRain(rain: THREE.LineSegments, cam: THREE.Camera, dt: number) {
  const a = rain.geometry.getAttribute('position') as THREE.BufferAttribute;
  const p = a.array as Float32Array;
  const fall = dt * 22;
  for (let i = 0; i < RAIN_N; i++) {
    const o = i * 6;
    p[o + 1] -= fall;
    p[o + 4] -= fall;
    if (p[o + 1] < 0) {
      const x = cam.position.x + (Math.random() - 0.5) * RAIN_BOX * 2;
      const z = cam.position.z + (Math.random() - 0.5) * RAIN_BOX * 2;
      const y = 22 + Math.random() * 8;
      p[o] = x;
      p[o + 1] = y;
      p[o + 2] = z;
      p[o + 3] = x + 0.03;
      p[o + 4] = y + 0.55;
      p[o + 5] = z + 0.02;
    }
  }
  a.needsUpdate = true;
}
