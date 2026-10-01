// The 3D world: builds maps, keeps a view object per server entity,
// interpolates between snapshots, plays events as effects and drives the
// Warcraft III-style camera (56° angle of attack, following your hero).

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import * as M from './models.js';
import { LITE, FX_DENSITY } from '../device.js';
import { Effects, fxTexture } from './effects.js';
import { blendedGround } from './terrain.js';
import { bakeStatic, bakeModel } from './batch.js';
import { VIEWS, SKINS, EVENTS, THEMES_EXTRA, MAP_BUILDERS } from './registry.js';
import './basics.js';
import { play } from '../audio.js';

// How far behind the newest snapshot we render: one snapshot interval plus
// the arrival jitter, measured (the host's own page gets 30 Hz snapshots with
// almost no jitter, about 45 ms; a remote player at 15 Hz, about 90-130 ms).
const DELAY_MIN = 0.04;
const DELAY_MAX = 0.25;
const CAM_PITCH = (56 * Math.PI) / 180;

// ------------------------------------------------------------ textures

function noiseTexture(base, vary, { size = 256, speckle = 0.5, tiles = false, cracks = false, blades = false } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const b = new THREE.Color(base);
  g.fillStyle = `#${b.getHexString()}`;
  g.fillRect(0, 0, size, size);
  const img = g.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * vary;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n * 0.8));
  }
  g.putImageData(img, 0, 0);
  // Soft blotches for large-scale variation.
  for (let i = 0; i < 40 * speckle; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 8 + Math.random() * 30;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const k = Math.random() < 0.5 ? 0.85 : 1.12;
    const cc = b.clone().multiplyScalar(k);
    grd.addColorStop(0, `rgba(${cc.r * 255 | 0},${cc.g * 255 | 0},${cc.b * 255 | 0},0.5)`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  if (blades) {
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const cc = b.clone().multiplyScalar(0.7 + Math.random() * 0.7);
      g.strokeStyle = `#${cc.getHexString()}`;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (Math.random() - 0.5) * 3, y - 3 - Math.random() * 3);
      g.stroke();
    }
  }
  if (tiles) {
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 2;
    const n = 4;
    for (let r = 0; r < n; r++) {
      const off = r % 2 ? size / n / 2 : 0;
      g.beginPath();
      g.moveTo(0, (r * size) / n);
      g.lineTo(size, (r * size) / n);
      g.stroke();
      for (let col = 0; col <= n; col++) {
        const x = (col * size) / n + off;
        g.beginPath();
        g.moveTo(x, (r * size) / n);
        g.lineTo(x, ((r + 1) * size) / n);
        g.stroke();
      }
    }
  }
  if (cracks) {
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 14; i++) {
      let x = Math.random() * size;
      let y = Math.random() * size;
      g.beginPath();
      g.moveTo(x, y);
      for (let j = 0; j < 5; j++) {
        x += (Math.random() - 0.5) * 50;
        y += (Math.random() - 0.5) * 50;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Hand-painted WC3-style ground tiles (client/public/fx/), one repeat per this many units.
const TILE_UNITS = 8;
const painted = new Map();

// Puts a painted tile on `material` once it has loaded; the procedural
// texture stays as the fallback until then (or if the file is missing).
function paint(material, file, units = TILE_UNITS) {
  const fallback = material.map;
  const apply = (tex) => {
    const t = tex.clone();
    t.userData = {}; // this copy belongs to the material (freed with its map)
    t.repeat.set(fallback.repeat.x * (fallback.userData.units || 1) / units, fallback.repeat.y * (fallback.userData.units || 1) / units);
    t.needsUpdate = true;
    material.map = t;
    material.needsUpdate = true;
  };
  if (painted.has(file)) {
    const tex = painted.get(file);
    if (tex.image) apply(tex);
    else tex.userData.waiting.push(apply);
    return;
  }
  const tex = fxTexture(file, (t) => {
    for (const fn of t.userData.waiting) fn(t);
    t.userData.waiting = [];
  }, { repeat: true });
  tex.userData.waiting = [apply];
  painted.set(file, tex);
}

// Ground layers for blended arenas: the arena tile, the worn band at its
// border, and the surrounding tile (see terrain.js).
const GROUNDS = {
  grass: { floor: { tex: 'tex_grass.webp', color: '#4f7a34' }, edge: { tex: 'tex_dirt.webp', tint: '#a89c84', color: '#6a5a40' }, outer: { tex: 'tex_grass.webp', tint: '#8c9c80', color: '#3a5a26' }, edgeWidth: 0.85 },
  dirt: { floor: { tex: 'tex_dirt.webp', color: '#8a6a48' }, edge: { tex: 'tex_dirt.webp', tint: '#8a7c6c', color: '#5e4a34', units: 5 }, outer: { tex: 'tex_grass.webp', tint: '#a0a488', color: '#46663a' }, edgeWidth: 1.4 },
  stone: { floor: { tex: 'tex_stone.webp', color: '#8e8a80' }, edge: { tex: 'tex_dirt.webp', tint: '#a09888', color: '#7a6040' }, outer: { tex: 'tex_grass.webp', tint: '#9aa890', color: '#46663a' } },
  night: { floor: { tex: 'tex_dirt.webp', tint: '#b8c4e4', color: '#5a6478' }, edge: { tex: 'tex_dirt.webp', tint: '#7a86a4', color: '#3a4050', units: 5 }, outer: { tex: 'tex_nightgrass.webp', tint: '#7c84a0', color: '#1c3028' }, edgeWidth: 1.3 },
};

const THEMES = {
  lava: { sky: '#1a0806', fog: '#2a0c06', floor: ['#6f6259', 40, { tiles: true }], sun: '#ffd0a0', hemi: ['#ffb080', '#401008'] },
  grass: { sky: '#88aacc', fog: '#9fb8c8', floor: ['#4f7a34', 40, { blades: true }], outer: ['#3a5a26', 30, { blades: true }], sun: '#fff2d8', hemi: ['#cfe6ff', '#3a4a20'], tex: 'tex_grass.webp', outerTex: 'tex_grass.webp', outerTint: '#9aa890' },
  dirt: { sky: '#8c7a66', fog: '#9a8670', floor: ['#8a6a48', 45, {}], outer: ['#5e4a34', 35, {}], sun: '#ffe2b8', hemi: ['#ffe8cc', '#4a3a28'], tex: 'tex_dirt.webp', outerTex: 'tex_dirt.webp', outerTint: '#a89a88' },
  stone: { sky: '#8aa0b8', fog: '#98a8b8', floor: ['#8e8a80', 35, { tiles: true }], outer: ['#46663a', 30, { blades: true }], sun: '#fff0dc', hemi: ['#dde8ff', '#404838'], tex: 'tex_stone.webp', outerTex: 'tex_grass.webp', outerTint: '#9aa890' },
  night: { sky: '#0c1428', fog: '#101a30', floor: ['#2c4a3a', 35, { blades: true }], outer: ['#1c3028', 30, { blades: true }], sun: '#9fb8ff', hemi: ['#5870b0', '#101810'], sunI: 1.4, tex: 'tex_nightgrass.webp', outerTex: 'tex_nightgrass.webp', outerTint: '#8890a0' },
  ice: { sky: '#aac8e0', fog: '#b8d4e8', floor: ['#cfe6f2', 25, { cracks: true }], sun: '#ffffff', hemi: ['#e0f0ff', '#406080'], tex: 'tex_snow.webp' },
};

// Animated lava / water surface.
function liquidMaterial(kind) {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vWorld;
      void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
    `,
    fragmentShader: /* glsl */ `
      uniform float time; varying vec3 vWorld;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
      void main() {
        vec2 p = vWorld.xz * 0.12;
        ${kind === 'lava'
          ? `float n = fbm(p + vec2(time*0.05, time*0.03) + fbm(p*1.7 - time*0.04));
             float veins = smoothstep(0.45, 0.75, n);
             vec3 col = mix(vec3(0.35,0.03,0.0), vec3(1.0,0.35,0.02), veins);
             col = mix(col, vec3(1.0,0.85,0.35), smoothstep(0.72, 0.9, n));
             gl_FragColor = vec4(col * 1.6, 1.0);`
          : `float n = fbm(p*1.5 + vec2(time*0.04, -time*0.03) + fbm(p*2.0 + time*0.05));
             vec3 col = mix(vec3(0.02,0.12,0.25), vec3(0.15,0.45,0.65), n);
             col += smoothstep(0.7, 0.85, n) * 0.35;
             gl_FragColor = vec4(col, 1.0);`}
      }
    `,
  });
}

// ------------------------------------------------------------ world

export class World {
  constructor(canvas, overlay) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !LITE, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, LITE ? 1.25 : 2));
    this.renderer.shadowMap.enabled = true;
    // Phones redraw the shadow map every other frame (render()): half the
    // shadow cost, and at 60 fps the lag is invisible.
    this.renderer.shadowMap.autoUpdate = !LITE;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoft is gone in r186 (it fell back to this)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    // A soft studio environment so metal and glossy surfaces have something
    // to reflect (plate, silver hammers, gold trim); otherwise they read as grey.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.45;
    pmrem.dispose();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.5, 400);
    this.hemi = new THREE.HemisphereLight('#fff', '#333', 1.2);
    this.sun = new THREE.DirectionalLight('#fff', 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(LITE ? 1024 : 2048, LITE ? 1024 : 2048);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.mapGroup = new THREE.Group();
    this.entGroup = new THREE.Group();
    this.scene.add(this.mapGroup, this.entGroup);
    this.fx = new Effects(this.scene, overlay, this.camera);

    this.views = new Map();
    this.snaps = [];
    this.delay = 0.11; // interpolation delay (s), adapted in pushSnapshot
    // Functions (camera, dt, world) run after the camera is placed each frame,
    // for effects like WC3's camera noise. Views add and delete their own.
    this.cameraFx = new Set();
    this.pendingEvents = [];
    this.offset = null;
    this.colors = {}; // owner id -> hex
    this.spellColors = {}; // spell id -> hex, provided by the game
    this.names = {};
    this.myId = null;
    this.myUnit = null;
    this.focus = new THREE.Vector3();
    this.zoom = 28;
    this.follow = true;
    this.time = 0;
    this.liquids = [];
    this.animated = [];
    this.floorMesh = null;
    this.linkBeams = [];
    this.onMessage = () => {};

    this.selGeo = new THREE.RingGeometry(0.72, 0.86, 40);
    this.selGeo.userData.shared = true;
    // Kodos stream in and out all game; removed ones are reused (built and
    // merged models cost ~10 ms each). Emptied at every map change.
    this.kodoPool = [];
    this.selGeo.rotateX(-Math.PI / 2);
    this.rangeRing = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false }));
    this.rangeRing.position.y = 0.06;
    this.rangeRing.visible = false;
    this.scene.add(this.rangeRing);
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.fx.setScale(h * this.renderer.getPixelRatio());
    this.width = w;
    this.height = h;
  }

  // -------------------------------------------------------------- map

  setMap(map) {
    this.map = map;
    for (const v of this.views.values()) this.removeView(v);
    this.views.clear();
    this.snaps = [];
    this.pendingEvents = [];
    this.fx.clear();
    disposeTree(this.mapGroup);
    this.mapGroup.clear();
    for (const o of this.kodoPool) disposeTree(o);
    this.kodoPool.length = 0;
    this.liquids = [];
    this.animated = [];
    this.floorMesh = null;
    const extra = THEMES_EXTRA.get(map.theme);
    const theme = extra?.theme || THEMES[map.theme] || THEMES.grass;
    const groundLayers = GROUNDS[map.theme] || extra?.ground;
    this.scene.background = new THREE.Color(theme.sky);
    this.scene.fog = new THREE.Fog(theme.fog, 45, 110);
    this.hemi.color.set(theme.hemi[0]);
    this.hemi.groundColor.set(theme.hemi[1]);
    this.sun.color.set(theme.sun);
    this.sun.intensity = theme.sunI ?? 2.4;
    const B = map.bounds || 25;
    // The sun follows the camera focus, so its shadow box only has to cover
    // the view (sharper shadows on big maps), or the map if that is smaller.
    const cam = this.sun.shadow.camera;
    const S = Math.min(B + 4, (map.zoom ?? this.zoom) * 1.1 + 4);
    cam.left = -S;
    cam.right = S;
    cam.top = S;
    cam.bottom = -S;
    cam.far = 150;
    cam.updateProjectionMatrix();

    const f = map.floor;
    // Built only by the floors below that paint it (256x256 on the CPU).
    const floorTex = map.theme === 'lava' || map.theme === 'ice' || !groundLayers ? noiseTexture(...(theme.floor || ['#6a7a4a', 30, {}])) : null;

    if (map.theme === 'lava' || map.theme === 'ice') {
      const liquid = new THREE.Mesh(new THREE.PlaneGeometry(260, 260).rotateX(-Math.PI / 2), liquidMaterial(map.theme === 'lava' ? 'lava' : 'water'));
      liquid.position.y = -0.35;
      this.mapGroup.add(liquid);
      this.liquids.push(liquid.material);
      // The platform is a unit disc scaled by the live arena radius.
      const geo = new THREE.CylinderGeometry(1, 1.04, 1, 128, 1);
      floorTex.repeat.set(f.r / 2.5, f.r / 2.5);
      floorTex.userData.units = 5; // UVs span the diameter
      const side = M.mat(map.theme === 'lava' ? '#3a302a' : '#9cc4dc');
      const top = new THREE.MeshStandardMaterial({ map: floorTex, roughness: map.theme === 'ice' ? 0.25 : 0.9, metalness: map.theme === 'ice' ? 0.1 : 0 });
      if (theme.tex) paint(top, theme.tex);
      const disc = new THREE.Mesh(geo, [side, top, side]);
      disc.position.y = -0.5;
      disc.receiveShadow = true;
      disc.scale.set(f.r, 1, f.r);
      this.mapGroup.add(disc);
      this.floorMesh = disc;
      if (map.theme === 'lava') {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 6, 128).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff7a20', toneMapped: false }));
        rim.position.y = -0.25;
        rim.scale.set(f.r, 1, f.r);
        disc.userData.rim = rim;
        this.mapGroup.add(rim);
        // Volcanic rocks jutting out of the lava sea.
        for (let i = 0; i < 26; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = f.r + 6 + Math.random() * 16;
          const rock = M.lavaRock(1 + Math.random() * 2.5);
          rock.position.set(Math.cos(a) * r, -0.6, Math.sin(a) * r);
          this.mapGroup.add(rock);
        }
        const glow = new THREE.PointLight('#ff5a10', 30, 60, 1.2);
        glow.position.set(0, -2, 0);
        glow.visible = !LITE;
        this.mapGroup.add(glow);
      } else {
        for (let i = 0; i < 18; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = f.r + 8 + Math.random() * 14;
          const berg = M.rock(1.5 + Math.random() * 2);
          berg.children[0].material = M.mat('#e8f4ff');
          berg.position.set(Math.cos(a) * r, -0.8, Math.sin(a) * r);
          this.mapGroup.add(berg);
        }
      }
    } else if (groundLayers) {
      const ground = blendedGround(groundLayers, f, B + 34);
      ground.position.y = 0.01;
      this.mapGroup.add(ground);
    } else {
      const outerTex = noiseTexture(theme.outer[0], theme.outer[1], theme.outer[2]);
      outerTex.repeat.set(30, 30);
      outerTex.userData.units = 8;
      const outerMat = new THREE.MeshStandardMaterial({ map: outerTex, roughness: 1 });
      if (theme.outerTex) {
        paint(outerMat, theme.outerTex, 11);
        outerMat.color.set(theme.outerTint);
      }
      const outer = new THREE.Mesh(new THREE.PlaneGeometry(240, 240).rotateX(-Math.PI / 2), outerMat);
      outer.position.y = -0.02;
      outer.receiveShadow = true;
      this.mapGroup.add(outer);
      let floor;
      if (f.shape === 'rect') {
        floorTex.repeat.set(f.w / 5, f.h / 5);
        floorTex.userData.units = 5;
        floor = new THREE.Mesh(new THREE.PlaneGeometry(f.w, f.h).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95 }));
        // Stone curb along the border.
        const curb = M.mat('#77726a');
        const t = 0.35;
        for (const [w, h, x, z] of [[f.w + t * 2, t, 0, -f.h / 2 - t / 2], [f.w + t * 2, t, 0, f.h / 2 + t / 2], [t, f.h, -f.w / 2 - t / 2, 0], [t, f.h, f.w / 2 + t / 2, 0]]) {
          const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, h), curb);
          m.position.set(x, 0.15, z);
          m.castShadow = m.receiveShadow = true;
          this.mapGroup.add(m);
        }
      } else {
        floorTex.repeat.set(f.r / 3, f.r / 3);
        floorTex.userData.units = 6; // UVs span the diameter
        floor = new THREE.Mesh(new THREE.CircleGeometry(f.r, 96).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95 }));
        const curb = new THREE.Mesh(new THREE.TorusGeometry(f.r + 0.15, 0.22, 6, 96).rotateX(Math.PI / 2), M.mat('#77726a'));
        curb.position.y = 0.05;
        curb.castShadow = curb.receiveShadow = true;
        this.mapGroup.add(curb);
      }
      if (theme.tex) paint(floor.material, theme.tex);
      floor.position.y = 0.01;
      floor.receiveShadow = true;
      this.mapGroup.add(floor);
    }

    // Props the fixed camera can never see are skipped: the camera centre is
    // clamped to ±bounds and shows about zoom x 0.95 either side and a bit
    // more up-screen (-z) than down. The rest are merged into a few draw calls.
    this.propGroup = new THREE.Group();
    this.mapGroup.add(this.propGroup);
    const zoom = map.zoom ?? this.zoom;
    const reachX = B + zoom * 0.95 + 3;
    for (const p of map.props || []) {
      if (p.t !== 'line' && (Math.abs(p.x) > reachX || p.y < -(B + zoom * 0.8 + 3) || p.y > B + zoom * 0.5 + 3)) continue;
      this.addProp(p, map.theme);
    }
    bakeStatic(this.propGroup, { castShadow: !LITE });
    for (const name of map.build || []) MAP_BUILDERS.get(name)?.(map, this);
    this.camera.far = zoom * 2 + 120;
    this.camera.updateProjectionMatrix();
  }

  addProp(p, theme) {
    let obj;
    switch (p.t) {
      case 'tree': obj = theme === 'ice' ? M.snowTree(p.s) : M.tree(p.s); break;
      case 'rock': obj = M.rock(p.s); break;
      case 'bush': obj = M.bush(p.s); break;
      case 'pillar': obj = M.pillar(p.s); break;
      case 'torch':
        obj = M.torch();
        this.animated.push({ type: 'torch', obj });
        obj.position.set(p.x, obj.position.y, p.y);
        this.mapGroup.add(obj);
        return;
      case 'moonwell': obj = M.moonwell(); break;
      case 'goldmine': obj = M.goldmine(); break;
      case 'flag': obj = M.flag(); break;
      case 'line': {
        const len = Math.hypot(p.x2 - p.x1, p.y2 - p.y1);
        obj = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.35).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: p.c, transparent: true, opacity: 0.85 }));
        obj.rotation.y = -Math.atan2(p.y2 - p.y1, p.x2 - p.x1);
        obj.position.set((p.x1 + p.x2) / 2, 0.03, (p.y1 + p.y2) / 2);
        this.mapGroup.add(obj);
        return;
      }
      default: return;
    }
    obj.position.set(p.x, obj.position.y, p.y);
    this.propGroup.add(obj);
  }

  // -------------------------------------------------------- snapshots

  pushSnapshot(snap) {
    const now = performance.now() / 1000;
    const t = snap.tk / 30;
    const sample = now - t;
    let last = this.snaps[this.snaps.length - 1];
    if (last && (t < last.t || t > last.t + 5)) {
      // Another timeline (joined a different room, or the host restarted): start over.
      this.snaps.length = 0;
      this.offset = this.step = this.jitter = this.lastRt = null;
      last = null;
    }
    this.offset = this.offset == null ? sample : Math.min(sample, this.offset + 0.002);
    // Lateness of this snapshot against the best seen; its recent peak is the jitter.
    const step = last ? Math.min(0.2, Math.max(1 / 30, t - last.t)) : 1 / 15;
    this.step = this.step == null ? step : this.step + (step - this.step) * 0.1;
    this.jitter = Math.max(sample - this.offset, (this.jitter ?? 0.03) * 0.97);
    this.delayTarget = Math.min(DELAY_MAX, Math.max(DELAY_MIN, this.step + this.jitter + 0.008));
    const ents = new Map();
    for (const e of snap.ents) ents.set(e.id, e);
    this.snaps.push({ t, ents, links: snap.links || [], snap });
    if (this.snaps.length > 30) this.snaps.shift();
    for (const e of snap.ev || []) {
      if (e.k === 'msg') this.onMessage(e);
      else this.pendingEvents.push({ t, e });
    }
    this.myUnit = snap.me?.uid ?? null;
  }

  // Once per frame. The delay eases towards its target in real time: up by
  // at most 25 % of a second per second (the world runs briefly slower rather
  // than jumping back), down by 5 %. Render time never goes backwards.
  renderTime(dt) {
    const d = (this.delayTarget ?? this.delay) - this.delay;
    this.delay += Math.max(-0.05 * dt, Math.min(0.25 * dt, d));
    const rt = performance.now() / 1000 - (this.offset ?? 0) - this.delay;
    this.lastRt = this.lastRt == null ? rt : Math.max(this.lastRt, rt);
    return this.lastRt;
  }

  // Finds the pair of snapshots around render time.
  bracket(rt) {
    const s = this.snaps;
    if (!s.length) return null;
    if (rt <= s[0].t) return [s[0], s[0], 0];
    for (let i = s.length - 1; i >= 0; i--) {
      if (s[i].t <= rt) {
        if (i === s.length - 1 && i > 0) {
          // Past the newest snapshot (a late packet): keep moving along the last
          // step for up to 0.15 s rather than freezing, then hold.
          const a = s[i - 1];
          const b = s[i];
          const span = b.t - a.t || 1 / 15;
          return [a, b, Math.min(1 + 0.15 / span, (rt - a.t) / span)];
        }
        const a = s[i];
        const b = s[i + 1] || a;
        const k = b === a ? 0 : (rt - a.t) / (b.t - a.t);
        return [a, b, Math.min(1, k)];
      }
    }
    return [s[0], s[0], 0];
  }

  // -------------------------------------------------------------- views

  makeView(e) {
    const color = this.colors[e.o] || '#cccccc';
    let obj;
    const v = { id: e.id, k: e.k, owner: e.o, deadT: 0 };
    switch (e.k) {
      case 'warlock': obj = bakeModel(M.warlock(color)); break;
      case 'paladin':
        v.sk = e.sk;
        obj = bakeModel(e.sk && SKINS.has(e.sk) ? SKINS.get(e.sk)(color) : M.paladin(color));
        break;
      case 'kodo':
        obj = this.kodoPool.pop() || bakeModel(M.kodo());
        setOpacity(obj, 1);
        break;
      case 'golem': obj = bakeModel(M.golem()); break;
      case 'coin': obj = M.coin(); break;
      case 'goldbag': obj = M.goldbag(); break;
      case 'meteor': {
        obj = new THREE.Group();
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff5020', transparent: true, opacity: 0.8, depthWrite: false }));
        const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff3010', transparent: true, opacity: 0.25, depthWrite: false }));
        ring.scale.setScalar(e.r);
        ring.position.y = fill.position.y = 0.07;
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 0), new THREE.MeshStandardMaterial({ color: '#3a2010', emissive: '#ff4010', emissiveIntensity: 1.5, flatShading: true }));
        obj.add(ring, fill, rock);
        v.parts = { fill, rock, r: e.r };
        break;
      }
      case 'warn': {
        obj = new THREE.Group();
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff2020', transparent: true, opacity: 0.9, depthWrite: false }));
        const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff2020', transparent: true, opacity: 0.3, depthWrite: false }));
        ring.scale.setScalar(e.r);
        ring.position.y = fill.position.y = 0.05;
        const shell = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), M.mat('#222'));
        obj.add(ring, fill, shell);
        v.parts = { fill, rock: shell, r: e.r };
        break;
      }
      case 'wisparm': {
        const n = Math.ceil((e.r1 - e.r0) / 0.85);
        const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshBasicMaterial({ color: '#bff4ff', toneMapped: false }), n);
        inst.frustumCulled = false;
        obj = new THREE.Group();
        obj.add(inst);
        v.parts = { inst, n };
        break;
      }
      case 'catapult': obj = bakeModel(M.catapult(!!e.demo)); break;
      case 'beastmaster': obj = bakeModel(M.beastmaster()); break;
      case 'lob': {
        // A lobbed boulder, like WC3's catapult missile: it flies from the
        // siege engine to a fixed point. On the ground its shadow darkens as
        // it comes down, and a faint ring marks the 40 % splash tier.
        obj = new THREE.Group();
        const c = e.oil ? '#ffa040' : '#ffe0b0';
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.0, depthWrite: false }));
        const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.0, depthWrite: false }));
        ring.scale.setScalar(e.r);
        ring.position.y = 0.06;
        shadow.position.y = 0.05;
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3, 1), M.boulderMat());
        rock.castShadow = true;
        this.entGroup.add(rock);
        obj.add(shadow, ring);
        v.parts = { ring, shadow, rock, r: e.r };
        break;
      }
      case 'oil': {
        obj = new THREE.Group();
        // Burning oil: a ground glow under WC3-style fire.
        const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 36).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff5a10', transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
        fill.position.y = 0.07;
        fill.scale.setScalar(e.r);
        obj.add(fill);
        this.fx.scorch(e.x, e.y, e.r * 1.1, 6);
        v.parts = { fill, r: e.r };
        break;
      }
      case 'firewheel': {
        // Uther Party's Wheel of Fire: a fire at the centre plus four spokes of five.
        // Each fire is WC3's TownBurningFire: flames from the fire flipbook
        // over a glowing ember, with a ground glow the size of the kill radius.
        const n = 1 + 4 * e.rs.length;
        const core = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffd080', toneMapped: false }), n);
        const disc = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.6, 2.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff6a20', map: fxTexture('fx_flare.webp'), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), n);
        for (const m of [core, disc]) m.frustumCulled = false;
        obj = new THREE.Group();
        obj.add(disc, core);
        const light = this.fx.borrowLight('#ff8a30', 18, 14, 1.6, obj, 1.5);
        v.light = light;
        v.parts = { core, disc, n, light };
        break;
      }
      case 'hill': {
        obj = new THREE.Group();
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd24a', transparent: true, opacity: 0.9, depthWrite: false }));
        const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd24a', transparent: true, opacity: 0.18, depthWrite: false }));
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 8, 32, 1, true), new THREE.MeshBasicMaterial({ color: '#ffd24a', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
        ring.position.y = fill.position.y = 0.05;
        beam.position.y = 4;
        obj.add(ring, fill, beam);
        obj.scale.set(e.r, 1, e.r);
        v.parts = { ring, fill, beam };
        break;
      }
      case 'floor':
        obj = new THREE.Group();
        break;
      case 'obstacle': {
        obj = M.rock(e.r * 1.1);
        obj.children[0].scale.y = 1.6;
        obj.children[0].material = M.mat('#4a3c34');
        this.fx.burst(e.x, 0.5, e.y, '#6a5040', { n: 20, speed: 3, size: 1, life: 0.8, additive: false });
        break;
      }
      default:
        if (VIEWS.has(e.k)) {
          v.def = VIEWS.get(e.k);
          obj = v.def.make(e, this, v);
          // Opt-in: merge the static parts per material (see registry.js).
          if (v.def.bake) obj = bakeModel(obj, { flat: v.def.bake === 'flat' });
        } else if (e.k.startsWith('p_')) {
          const spell = e.k.slice(2);
          const c = this.spellColors[spell] || '#fff';
          obj = new THREE.Group();
          const size = spell === 'gravity' ? 0.55 : 0.32;
          const core = new THREE.Mesh(new THREE.SphereGeometry(size, 12, 10), new THREE.MeshBasicMaterial({ color: spell === 'gravity' ? '#140022' : c, toneMapped: false }));
          obj.add(core);
          if (spell === 'boomerang') {
            const blade = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.08, 6, 12, Math.PI * 1.2), new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));
            blade.rotation.x = Math.PI / 2;
            obj.add(blade);
            core.scale.setScalar(0.4);
            v.parts = { spin: blade };
          }
          v.light = this.fx.borrowLight(c, 6, 6, 2, obj);
          obj.position.y = 1;
          v.color = c;
          v.spell = spell;
        } else {
          obj = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), M.mat('#f0f'));
        }
    }
    // Models are drawn larger than their collision size, as in WC3.
    if (e.k === 'warlock' || (e.k === 'paladin' && !v.sk)) obj.userData.body.scale.setScalar(1.45);
    v.obj = obj;
    this.entGroup.add(obj);

    if (e.k === 'warlock' || e.k === 'paladin') {
      const isMe = e.o === this.myId;
      const sel = new THREE.Mesh(this.selGeo, new THREE.MeshBasicMaterial({ color: isMe ? '#30ff30' : color, transparent: true, opacity: isMe ? 0.95 : 0.55, depthWrite: false }));
      sel.position.y = 0.05;
      obj.add(sel);
      v.sel = sel;
      const bar = document.createElement('div');
      bar.className = 'unitbar' + (isMe ? ' me' : '');
      bar.innerHTML = `<div class="uname" style="color:${color}">${escapeHtml(this.names[e.o] || '')}</div>${e.mhp ? '<div class="hpbar"><div class="hpfill"></div></div>' : ''}`;
      this.overlay.appendChild(bar);
      v.bar = bar;
      v.hpFill = bar.querySelector('.hpfill');
      const shield = new THREE.Mesh(new THREE.SphereGeometry(1.05, 20, 14), new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending }));
      shield.position.y = 0.9;
      shield.visible = false;
      obj.add(shield);
      v.shield = shield;
      const bomb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), M.mat('#222', { metalness: 0.4 }));
      bomb.position.set(0, 3.0, 0);
      bomb.visible = false;
      obj.add(bomb);
      v.bomb = bomb;
    }
    return v;
  }

  removeView(v) {
    this.entGroup.remove(v.obj);
    v.bar?.remove();
    this.fx.returnLight(v.light);
    v.def?.remove?.(v, this);
    if (v.k === 'lob') {
      this.entGroup.remove(v.parts.rock);
      disposeTree(v.parts.rock, false);
    }
    if (v.k === 'kodo' && this.kodoPool.length < 24) this.kodoPool.push(v.obj);
    else disposeTree(v.obj, false);
  }

  // -------------------------------------------------------------- frame

  render(dt) {
    this.pred = this.predictor && this.offset != null ? this.predictor.frame(performance.now() / 1000 - this.offset, dt) : null;
    this.time += dt;
    for (const m of this.liquids) m.uniforms.time.value = this.time;
    const rt = this.renderTime(dt);
    const br = this.bracket(rt);

    // Fire events whose time has come.
    if (this.pendingEvents.length) {
      const due = [];
      this.pendingEvents = this.pendingEvents.filter((p) => {
        if (p.t <= rt + 0.02) {
          due.push(p.e);
          return false;
        }
        return true;
      });
      for (const e of due) this.handleEvent(e);
    }

    if (br) {
      const [a, b, k] = br;
      const latest = this.snaps[this.snaps.length - 1];
      // Remove views for entities that no longer exist.
      for (const [id, v] of this.views) {
        if (!b.ents.has(id) && !latest.ents.has(id)) {
          this.removeView(v);
          this.views.delete(id);
        }
      }
      for (const [id, eb] of b.ents) {
        const ea = a.ents.get(id) || eb;
        let v = this.views.get(id);
        // A hero whose look changed (polymorphed, transformed) gets a new model.
        if (v && v.k === 'paladin' && (eb.sk || undefined) !== (v.sk || undefined)) {
          this.removeView(v);
          v = null;
        }
        if (!v) {
          v = this.makeView(eb);
          this.views.set(id, v);
        }
        this.updateView(v, ea, eb, k, dt);
      }
      // Hide views that exist only in newer snapshots.
      for (const [id, v] of this.views) if (!b.ents.has(id)) v.obj.visible = false;
      this.updateLinks(b, a, k);
      const snap = b.snap;
      if (this.floorMesh && snap.arena) this.setFloorRadius(lerp(a.snap.arena?.r ?? snap.arena.r, snap.arena.r, k));
      if (this.floorMesh) {
        for (const e of b.ents.values()) {
          if (e.k !== 'floor') continue;
          this.setFloorRadius(e.r);
          break;
        }
      }
    }

    for (const a of this.animated) {
      if (a.type === 'torch') {
        a.obj.userData.flame.scale.setScalar(0.8 + Math.random() * 0.4);
        for (let n = emit(a, 'fire', 18, dt); n > 0; n--) this.fx.flame(a.obj.position.x, 1.55, a.obj.position.z, 0.5, 0.45, 0.04);
      }
    }

    if (this.lab) this.updateLab(dt);
    this.updateCamera(dt);
    this.fx.update(dt, this.width, this.height);
    if (LITE) this.renderer.shadowMap.needsUpdate = (this.frameNo = (this.frameNo || 0) + 1) % 2 === 1;
    this.renderer.render(this.scene, this.camera);
    this.positionBars();
  }

  // Movement Lab (F8): breadcrumb trail of your hero's path plus a facing
  // arrow and live readouts, for comparing turning arcs with real WC3.
  toggleLab() {
    this.lab = !this.lab;
    if (!this.labObj) {
      const n = 240;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const trail = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#30ff30', size: 0.18, depthWrite: false }));
      trail.frustumCulled = false;
      const arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 2.2, '#ffffff', 0.5, 0.3);
      this.labObj = { trail, arrow, n, i: 0, acc: 0, last: null };
      this.scene.add(trail, arrow);
    }
    this.labObj.trail.visible = this.labObj.arrow.visible = this.lab;
    document.getElementById('labinfo').hidden = !this.lab;
  }

  updateLab(dt) {
    const me = this.myView();
    const L = this.labObj;
    if (!me) return;
    const p = me.obj.position;
    L.arrow.position.set(p.x, 0.15, p.z);
    const f = -me.obj.rotation.y;
    L.arrow.setDirection(new THREE.Vector3(Math.cos(f), 0, Math.sin(f)));
    L.acc += dt;
    if (L.acc >= 0.03) {
      const pos = L.trail.geometry.attributes.position;
      pos.setXYZ(L.i % L.n, p.x, 0.08, p.z);
      pos.needsUpdate = true;
      L.i++;
      const now = performance.now() / 1000;
      if (L.last) {
        const dtt = now - L.last.t;
        const speed = Math.hypot(p.x - L.last.x, p.z - L.last.z) / dtt;
        let df = f - L.last.f;
        while (df > Math.PI) df -= Math.PI * 2;
        while (df < -Math.PI) df += Math.PI * 2;
        const turn = Math.abs(df) / dtt;
        L.speed = (L.speed ?? speed) * 0.7 + speed * 0.3;
        L.turn = (L.turn ?? turn) * 0.7 + turn * 0.3;
        document.getElementById('labinfo').textContent =
          `Movement Lab (F8)  facing ${Math.round((((f * 180) / Math.PI) % 360 + 360) % 360)}°  turn ${Math.round((L.turn * 180) / Math.PI)}°/s  speed ${L.speed.toFixed(2)} m/s`;
      }
      L.last = { x: p.x, z: p.z, f, t: now };
      L.acc = 0;
    }
  }

  setFloorRadius(r) {
    r = Math.max(0.01, r);
    this.floorMesh.scale.set(r, 1, r);
    const rim = this.floorMesh.userData.rim;
    if (rim) rim.scale.set(r, 1, r);
    this.floorR = r;
  }

  updateView(v, a, b, k, dt) {
    const o = v.obj;
    o.visible = true;
    let x = lerp(a.x, b.x, k);
    let z = lerp(a.y, b.y, k);
    let f = lerpAngle(a.f ?? 0, b.f ?? 0, k);
    // The player's own hero is drawn where the prediction puts it (it
    // reacts to orders at once), everyone else from the snapshot timeline.
    const P = v.id === this.myUnit && !b.dead ? this.pred : null;
    if (P) {
      x = P.x;
      z = P.y;
      f = P.f;
    }
    v.x = x;
    v.z = z;
    const fx = b.fx || [];
    switch (v.k) {
      case 'warlock':
      case 'paladin': {
        o.position.x = x;
        o.position.z = z;
        o.rotation.y = -f;
        const body = o.userData.body;
        const moving = (P ? P.moving : b.mv) && !b.dead;
        const turning = (P ? P.turning : b.tn) && !b.dead; // shuffling round on the spot
        v.walk = (v.walk || 0) + dt * (moving ? 12 : turning ? 9 : 0);
        body.position.y = moving ? Math.abs(Math.sin(v.walk)) * 0.08 : 0;
        const legAmp = moving ? 0.5 : turning ? 0.2 : 0;
        if (o.userData.legL) {
          o.userData.legL.rotation.z = Math.sin(v.walk) * legAmp;
          o.userData.legR.rotation.z = -Math.sin(v.walk) * legAmp;
        }
        // Cast animation: wind up during the cast point, release on the effect.
        const windup = fx.includes('casting');
        v.raise = Math.max(0, Math.min(1, (v.raise || 0) + dt * (windup ? 8 : -5)));
        if (v.castT > 0) v.castT -= dt;
        const swing = v.castT > 0 ? Math.sin((v.castT / 0.3) * Math.PI) : 0;
        if (o.userData.staff) o.userData.staff.rotation.x = -(v.raise * 0.9 + swing * 0.6);
        // Sinks a little when standing in lava.
        const inLava = fx.includes('burn');
        const targetY = inLava ? -0.3 : 0;
        o.position.y += (targetY - o.position.y) * Math.min(1, dt * 8);
        if (inLava && Math.random() < 0.6) this.fx.trail(x + (Math.random() - 0.5) * 0.8, 0.3 + Math.random(), z + (Math.random() - 0.5) * 0.8, Math.random() < 0.5 ? '#ff6a10' : '#ffb030', 0.6, 0.6, 0.2);
        v.shield.visible = fx.includes('shield') || fx.includes('rush') || fx.includes('invuln');
        if (v.shield.visible) {
          const shieldR = fx.includes('shield') ? b.sr || 1 : 1;
          v.shield.scale.setScalar(shieldR);
          v.shield.position.y = shieldR > 1.5 ? 0 : 0.9;
          v.shield.material.color.set(fx.includes('shield') ? '#ffe066' : fx.includes('rush') ? '#7fe0ff' : '#ffffff');
          v.shield.material.opacity = (fx.includes('shield') ? 0.2 : 0.14) + Math.sin(this.time * 20) * 0.05;
        }
        if (fx.includes('slow') && Math.random() < 0.3) this.fx.trail(x, 0.4, z, '#d0102a', 0.4, 0.5, 0.6);
        v.bomb.visible = fx.includes('bomb');
        if (v.bomb.visible && Math.random() < 0.5) this.fx.trail(x, 3.35, z, '#ffcc40', 0.3, 0.3, 0.05);
        const invis = fx.includes('invis');
        setOpacity(o, invis ? 0.3 : 1);
        if (fx.includes('dash')) this.fx.trail(x, 0.8, z, '#ffe8a8', 0.8, 0.3, 0.4);
        if (fx.includes('finished') && !v.cheered) {
          v.cheered = true;
          this.fx.burst(x, 1.5, z, '#ffd700', { n: 30, speed: 4 });
        }
        if (b.dead) {
          v.deadT += dt;
          body.rotation.z = Math.min(Math.PI / 2, v.deadT * 4);
          o.position.y = -Math.min(1.5, Math.max(0, v.deadT - 0.8) * 0.8);
          v.sel.visible = false;
        } else {
          v.deadT = 0;
          body.rotation.z = 0;
          v.sel.visible = true;
        }
        if (v.hpFill && b.mhp) {
          // DOM writes only when the value changes: style writes every frame
          // make the browser restyle, which adds up on phones.
          const frac = Math.round(Math.max(0, b.hp / b.mhp) * 200) / 200;
          if (frac !== v.hpFrac) {
            v.hpFrac = frac;
            v.hpFill.style.width = `${frac * 100}%`;
            v.hpFill.style.background = frac > 0.6 ? '#2fdc2f' : frac > 0.3 ? '#e8d020' : '#e82020';
          }
        }
        v.visibleBar = !b.dead && !(invis && b.o !== this.myId);
        // Skins may animate themselves (wakes, roll, sinking...).
        o.userData.tick?.(dt, v, b, this);
        break;
      }
      case 'kodo':
      case 'golem': {
        o.position.set(x, 0, z);
        o.rotation.y = -f;
        v.walk = (v.walk || 0) + dt * 10;
        o.userData.body.position.y = Math.abs(Math.sin(v.walk)) * 0.15;
        // A galloping gait: diagonal pairs of legs swing together.
        o.userData.legs?.forEach((l, i) => (l.rotation.z = Math.sin(v.walk + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.55));
        if (v.k === 'kodo' && emit(v, 'dust', 14, dt)) this.fx.smokePuff(x - Math.cos(f) * 1.2, 0.2, z - Math.sin(f) * 1.2, '#8a7a60', 1.1, 0.9, 0.35);
        break;
      }
      case 'catapult': {
        o.position.set(x, 0, z);
        o.rotation.y = -f;
        // Swing the arm when it fires, then winch it back.
        if (b.fire && !v.fired) v.swing = 1;
        v.fired = !!b.fire;
        v.swing = Math.max(0, (v.swing || 0) - dt * 2.5);
        o.userData.arm.rotation.z = -0.5 + Math.sin(v.swing * Math.PI) * 1.6;
        break;
      }
      case 'beastmaster': {
        o.position.set(x, 0, z);
        o.rotation.y = -f;
        const U = o.userData;
        const pump = b.on ? Math.sin(this.time * 6) : 0;
        U.body.position.y = b.on ? Math.abs(pump) * 0.06 : 0;
        // Axes pump toward the lane in time with the drumming.
        U.arms.forEach((a, i) => (a.rotation.z = 0.35 + (b.on ? Math.sin(this.time * 6 + i * Math.PI) * 0.25 : -0.3)));
        U.wings.forEach((w, i) => (w.rotation.x = (i ? -1 : 1) * (0.4 + (b.on ? Math.abs(Math.sin(this.time * 14)) * 0.9 : 0))));
        // The chevrons light up in sequence, running down his lane.
        v.chan = Math.max(0, Math.min(1, (v.chan || 0) + dt * (b.on ? 3 : -3)));
        U.chev.children.forEach((c, i) => {
          const phase = (this.time * 1.6 - i * 0.25) % 1;
          c.material.opacity = v.chan * (0.25 + 0.6 * Math.max(0, 1 - Math.abs(phase - 0.5) * 3));
        });
        U.ring.material.opacity = v.chan * (0.35 + Math.sin(this.time * 6) * 0.15);
        if (b.on && emit(v, 'chan', 6, dt)) this.fx.trail(x + Math.cos(f) * 0.9, 2.3, z + Math.sin(f) * 0.9, '#9be07a', 0.5, 0.5, 0.3);
        break;
      }
      case 'lob': {
        // Progress is linear in time, so interpolating (and briefly
        // extrapolating) it gives exact, smooth flight every frame.
        const t = Math.min(1, Math.max(0, lerp(a.t ?? 0, b.t ?? 0, k)));
        const p = v.parts;
        o.position.set(x, 0, z);
        p.shadow.scale.setScalar(0.25 + 0.35 * t);
        p.shadow.material.opacity = 0.45 * t * t;
        p.ring.material.opacity = 0.35 * Math.min(1, t * 1.5);
        // Parabolic arc from the launcher (launch height 1.4) to the target point.
        const sx = b.sx ?? x;
        const sz = b.sy ?? z;
        const d = Math.hypot(x - sx, z - sz);
        const apex = Math.max(3, d * 0.45);
        const ry = 1.4 * (1 - t) + 4 * t * (1 - t) * apex + 0.3 * t;
        p.rock.visible = o.visible;
        p.rock.position.set(lerp(sx, x, t), ry, lerp(sz, z, t));
        p.rock.rotation.set(t * 9, t * 7, 0);
        if (b.oil) {
          // Demolisher: a burning boulder trailing flame and black smoke.
          for (let n = emit(v, 'fire', 40, dt); n > 0; n--) this.fx.flame(p.rock.position.x, ry - 0.15, p.rock.position.z, 0.9, 0.35, 0.1);
          if (emit(v, 'smoke', 14, dt)) this.fx.smokePuff(p.rock.position.x, ry, p.rock.position.z, '#221c1a', 0.7, 1.1, 0.5);
        } else if (emit(v, 'dust', 16, dt)) this.fx.smokePuff(p.rock.position.x, ry, p.rock.position.z, '#b8a890', 0.45, 0.6, 0.35);
        break;
      }
      case 'oil': {
        o.position.set(x, 0, z);
        const burn = Math.min(1, b.t * 2);
        v.parts.fill.material.opacity = (0.14 + Math.sin(this.time * 11) * 0.04) * burn;
        for (let n = emit(v, 'fire', 45 * burn, dt); n > 0; n--) {
          const ang = Math.random() * Math.PI * 2;
          const rr = Math.sqrt(Math.random()) * v.parts.r * 0.9;
          this.fx.flame(x + Math.cos(ang) * rr, 0.1, z + Math.sin(ang) * rr, 0.9, 0.55, 0);
        }
        if (emit(v, 'smoke', 5 * burn, dt)) this.fx.smokePuff(x, 1.2, z, '#241e1c', 1.2, 1.6, 0.35);
        break;
      }
      case 'firewheel': {
        const ang = lerpAngle(a.a, b.a, k);
        const p = v.parts;
        // Fire positions (x, z pairs), kept between frames.
        const pts = (p.pts ??= new Float32Array(p.n * 2));
        let np = 1;
        pts[0] = pts[1] = 0;
        for (let s = 0; s < 4; s++) {
          const sa = ang + (s * Math.PI) / 2;
          for (const r of b.rs) {
            if (np >= p.n) break;
            pts[np * 2] = Math.cos(sa) * r;
            pts[np * 2 + 1] = Math.sin(sa) * r;
            np++;
          }
        }
        for (let i = 0; i < np; i++) {
          const px = pts[i * 2];
          const pz = pts[i * 2 + 1];
          const flick = 1 + Math.sin(this.time * 13 + i * 1.7) * 0.15;
          DUMMY.position.set(px, 0.06, pz);
          DUMMY.scale.setScalar(b.fr * 0.85 * flick);
          DUMMY.updateMatrix();
          p.disc.setMatrixAt(i, DUMMY.matrix);
          DUMMY.position.set(px, 0.35, pz);
          DUMMY.scale.setScalar(b.fr * 0.22 * flick);
          DUMMY.updateMatrix();
          p.core.setMatrixAt(i, DUMMY.matrix);
        }
        // Spread this frame's flames over the fires; they rise off the moving spokes.
        for (let n = emit(v, 'fire', 30 * p.n, dt); n > 0; n--) {
          const q = Math.floor(Math.random() * np) * 2;
          const px = pts[q];
          const pz = pts[q + 1];
          this.fx.flame(px, 0.15, pz, b.fr * 2.6, 0.7, b.fr * 0.3);
          if (Math.random() < 0.08) this.fx.smokePuff(px, 1.6, pz, '#2a2422', 0.9, 1.2, 0.3);
        }
        if (p.light) p.light.intensity = 16 + Math.sin(this.time * 9) * 3;
        p.core.instanceMatrix.needsUpdate = true;
        p.disc.instanceMatrix.needsUpdate = true;
        break;
      }
      case 'coin':
      case 'goldbag':
        o.position.set(x, Math.sin(this.time * 3 + v.id) * 0.1, z);
        o.rotation.y = this.time * 2.5;
        if (Math.random() < 0.05) this.fx.trail(x, 0.9, z, '#fff3a0', 0.3, 0.5, 0.5);
        break;
      case 'meteor':
      case 'warn': {
        o.position.set(x, 0, z);
        const t = b.t ?? 0;
        const p = v.parts;
        p.fill.scale.setScalar(Math.max(0.01, p.r * t));
        const fall = v.k === 'meteor' ? t : Math.max(0, (t - 0.6) / 0.4);
        p.rock.visible = fall > 0;
        p.rock.position.set(-(1 - fall) * 6, 0.5 + (1 - fall) * 22, (1 - fall) * 4);
        if (v.k === 'meteor' && fall > 0) this.fx.trail(o.position.x + p.rock.position.x, p.rock.position.y + 0.5, o.position.z + p.rock.position.z, '#ff7020', 1.1, 0.4, 0.5);
        break;
      }
      case 'wisparm': {
        const ang = lerp(a.a, b.a, k);
        const g = lerp(a.g, b.g, k);
        const p = v.parts;
        const dummy = new THREE.Object3D();
        let i = 0;
        for (let r = b.r0 + 0.4; r < b.r1 && i < p.n; r += 0.85) {
          if (Math.abs(r - g) < b.gw / 2) {
            dummy.scale.setScalar(0.0001);
          } else {
            dummy.scale.setScalar(1 + Math.sin(this.time * 8 + r) * 0.12);
          }
          dummy.position.set(Math.cos(ang) * r, 1 + Math.sin(this.time * 4 + r * 2) * 0.15, Math.sin(ang) * r);
          dummy.updateMatrix();
          p.inst.setMatrixAt(i++, dummy.matrix);
          if (Math.random() < 0.08 && dummy.scale.x > 0.5) this.fx.trail(dummy.position.x, dummy.position.y, dummy.position.z, '#9fe8ff', 0.7, 0.5, 0.2);
        }
        for (; i < p.n; i++) {
          dummy.scale.setScalar(0.0001);
          dummy.updateMatrix();
          p.inst.setMatrixAt(i, dummy.matrix);
        }
        p.inst.instanceMatrix.needsUpdate = true;
        break;
      }
      case 'hill': {
        o.position.x += (x - o.position.x) * Math.min(1, dt * 10);
        o.position.z += (z - o.position.z) * Math.min(1, dt * 10);
        const c = b.o != null ? this.colors[b.o] : '#ffd24a';
        v.parts.ring.material.color.set(c);
        v.parts.fill.material.color.set(c);
        v.parts.beam.material.color.set(c);
        v.parts.beam.material.opacity = 0.1 + Math.sin(this.time * 4) * 0.04;
        break;
      }
      case 'floor':
        break;
      case 'obstacle':
        o.position.set(x, 0, z);
        break;
      default:
        if (v.def) {
          v.f = f;
          o.position.x = x;
          o.position.z = z;
          o.rotation.y = -f;
          v.def.update?.(v, a, b, k, dt, this);
          break;
        }
        if (v.spell) {
          o.position.x = x;
          o.position.z = z;
          if (v.spell === 'gravity') {
            for (let i = 0; i < 3; i++) {
              const ang = Math.random() * Math.PI * 2;
              const rr = 1 + Math.random() * 3;
              this.fx.add.spawn(x + Math.cos(ang) * rr, 0.6 + Math.random(), z + Math.sin(ang) * rr, -Math.cos(ang) * rr * 2, 0, -Math.sin(ang) * rr * 2, new THREE.Color('#b36bff'), 0.5, 0.45, 0, 0);
            }
          } else {
            this.fx.trail(x, 1, z, v.color, v.spell === 'fireball' ? 0.9 : 0.6, 0.35, 0.2);
            if (v.spell === 'fireball') this.fx.trail(x, 1, z, '#ffd080', 0.5, 0.2, 0.1);
          }
          if (v.parts?.spin) v.parts.spin.rotation.z += dt * 20;
        }
    }
  }

  updateLinks(b) {
    const links = b.links || [];
    while (this.linkBeams.length < links.length) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 6, 1, true), new THREE.MeshBasicMaterial({ color: '#8affd8', toneMapped: false, transparent: true, opacity: 0.9 }));
      this.scene.add(m);
      this.linkBeams.push(m);
    }
    this.linkBeams.forEach((m, i) => {
      const l = links[i];
      const va = l && this.views.get(l[0]);
      const vb = l && this.views.get(l[1]);
      if (!va || !vb) {
        m.visible = false;
        return;
      }
      m.visible = true;
      const p1 = new THREE.Vector3(va.x, 1.1, va.z);
      const p2 = new THREE.Vector3(vb.x, 1.1, vb.z);
      m.position.copy(p1).add(p2).multiplyScalar(0.5);
      m.scale.set(1, p1.distanceTo(p2), 1);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p2.clone().sub(p1).normalize());
      if (Math.random() < 0.5) {
        const t = Math.random();
        this.fx.trail(p1.x + (p2.x - p1.x) * t, 1.1, p1.z + (p2.z - p1.z) * t, '#8affd8', 0.4, 0.3, 0.1);
      }
    });
  }

  positionBars() {
    const v3 = new THREE.Vector3();
    for (const v of this.views.values()) {
      if (!v.bar) continue;
      const show = v.visibleBar && v.obj.visible;
      if (show !== v.barShown) {
        v.barShown = show;
        v.bar.style.display = show ? '' : 'none';
      }
      if (!show) continue;
      v3.set(v.obj.position.x, v.obj.position.y + 3.1, v.obj.position.z);
      v3.project(this.camera);
      const x = Math.round(((v3.x + 1) / 2) * this.width * 2) / 2;
      const y = Math.round(((1 - v3.y) / 2) * this.height * 2) / 2;
      if (x !== v.barX || y !== v.barY) {
        v.barX = x;
        v.barY = y;
        v.bar.style.transform = `translate(-50%, -100%) translate(${x}px, ${y}px)`;
      }
    }
  }

  // ------------------------------------------------------------- camera

  myView() {
    return this.myUnit != null ? this.views.get(this.myUnit) : null;
  }

  updateCamera(dt) {
    const me = this.myView();
    if (this.follow && me && !(me.deadT > 1.5)) {
      this.focus.x += (me.obj.position.x - this.focus.x) * Math.min(1, dt * 6);
      this.focus.z += (me.obj.position.z - this.focus.z) * Math.min(1, dt * 6);
    } else if (this.pan) {
      this.focus.x += this.pan.x * dt * this.zoom * 0.9;
      this.focus.z += this.pan.z * dt * this.zoom * 0.9;
    }
    const B = this.map?.bounds ?? 25;
    this.focus.x = Math.max(-B, Math.min(B, this.focus.x));
    this.focus.z = Math.max(-B, Math.min(B, this.focus.z));
    this.camera.position.set(this.focus.x, this.focus.y + Math.sin(CAM_PITCH) * this.zoom, this.focus.z + Math.cos(CAM_PITCH) * this.zoom);
    this.camera.lookAt(this.focus);
    // A short camera quake for big explosions (WC3 maps used CameraSetEQNoise).
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const q = this.shake * 0.6;
      this.camera.position.x += (Math.random() - 0.5) * q;
      this.camera.position.y += (Math.random() - 0.5) * q;
    }
    for (const fn of this.cameraFx) fn(this.camera, dt, this);
    if (this.scene.fog) {
      this.scene.fog.near = this.zoom + 20;
      this.scene.fog.far = this.zoom + 95;
    }
    this.sun.position.set(this.focus.x + 15, 35, this.focus.z + 10);
    this.sun.target.position.copy(this.focus);
  }

  centerOnMe() {
    const me = this.myView();
    if (me) this.focus.set(me.obj.position.x, 0, me.obj.position.z);
  }

  screenToGround(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, p)) return null;
    return { x: p.x, y: p.z };
  }

  showRange(r) {
    const me = this.myView();
    if (!r || !me) {
      this.rangeRing.visible = false;
      return;
    }
    this.rangeRing.visible = true;
    this.rangeRing.position.x = me.obj.position.x;
    this.rangeRing.position.z = me.obj.position.z;
    this.rangeRing.scale.set(r, 1, r);
  }

  moveMarker(x, z) {
    this.fx.ring(x, z, 0.9, '#30ff30', 0.4);
    this.fx.burst(x, 0.2, z, '#30ff30', { n: 6, speed: 1.5, size: 0.35, life: 0.3, up: 0.8, grav: 2 });
  }

  // ------------------------------------------------------------- events

  // Impacts in the style of their WC3 missiles:
  //  rock - a catapult boulder: dust cloud, flying debris, a shockwave and a small crater
  //  fire - a demolisher firebomb: a fireball explosion that scorches the ground
  //  kodo - an exploding stampede beast: a smaller blast of fire and dust
  impact(e) {
    const fx = this.fx;
    const r = e.r || 1.5;
    if (e.s === 'rock') {
      fx.dustCloud(e.x, e.y, r * 0.45, '#a08a6c', 12);
      fx.debrisBurst(e.x, e.y, 10, 5);
      fx.shockwave(e.x, e.y, r * 0.7, '#ffe8c0', 0.4);
      fx.scorch(e.x, e.y, r * 0.35, 8);
      fx.sparks(e.x, 0.4, e.y, 6, 4, '#ffe0a0');
    } else if (e.s === 'fire') {
      fx.explosion(e.x, e.y, r * 0.55);
      fx.debrisBurst(e.x, e.y, 6, 5);
      fx.shockwave(e.x, e.y, r * 0.8, '#ffb070', 0.45);
      fx.flash(e.x, e.y, r, '#ff9040', 0.3);
    } else {
      fx.explosion(e.x, e.y, r * 0.75, { scorch: false });
      fx.dustCloud(e.x, e.y, r * 0.5, '#8a7a60', 8);
      fx.scorch(e.x, e.y, r * 0.5, 5);
    }
    if (e.big) this.shake = 0.3;
    play(e.big ? 'bigboom' : e.s === 'rock' ? 'hit' : 'boom');
  }

  handleEvent(e) {
    const fx = this.fx;
    switch (e.k) {
      case 'cast': {
        const v = this.views.get(e.u);
        if (v) v.castT = 0.3;
        fx.burst(e.x, 1.2, e.y, this.spellColors[e.s] || '#fff', { n: 8, speed: 2, size: 0.4, life: 0.3 });
        play(e.s);
        break;
      }
      case 'boom':
        if (e.s) {
          this.impact(e);
          break;
        }
        fx.burst(e.x, 0.8, e.y, e.c || '#ff8040', { n: e.big ? 70 : 24, speed: e.big ? 9 : 5, size: e.big ? 1.1 : 0.7, life: e.big ? 0.9 : 0.5 });
        fx.ring(e.x, e.y, e.r || 1, e.c || '#ff8040', e.big ? 0.6 : 0.35);
        if (e.big) {
          fx.flash(e.x, e.y, e.r || 2, e.c || '#ff8040', 0.4);
          for (let i = 0; i < 12; i++) fx.smoke(e.x, 0.5, e.y, '#3a3230', 2, 1.4);
          this.shake = 0.35;
        }
        play(e.big ? 'bigboom' : 'hit');
        break;
      case 'fizzle':
        fx.burst(e.x, 1, e.y, e.c || '#fff', { n: 8, speed: 2, size: 0.4, life: 0.3 });
        break;
      case 'bolt':
        fx.bolt(e.x1, e.y1, e.x2, e.y2);
        fx.flash(e.x2, e.y2, 2, '#9fd4ff', 0.2);
        break;
      case 'tele':
        fx.burst(e.x1, 1, e.y1, '#d9f3ff', { n: 24, speed: 3, size: 0.5, life: 0.5 });
        fx.burst(e.x2, 1, e.y2, '#d9f3ff', { n: 24, speed: 3, size: 0.5, life: 0.5 });
        break;
      case 'dmg':
        fx.text(e.x, 2.2, e.y, String(e.n), '#ff5a5a');
        break;
      case 'txt':
        fx.text(e.x, 2.4, e.y, e.s, e.c || '#fff', true);
        break;
      case 'reflect':
        fx.ring(e.x, e.y, 1.2, '#ffe066', 0.3);
        play('reflect');
        break;
      case 'death':
        fx.burst(e.x, 1, e.y, '#ff5020', { n: 24, speed: 5, size: 0.7, life: 0.7 });
        fx.dustCloud(e.x, e.y, 0.8, '#6a5a4a', 6);
        for (let i = 0; i < 4; i++) fx.smokePuff(e.x, 0.5, e.y, '#302a28', 1.3, 1.5, 0.5);
        play('death');
        break;
      case 'purge': {
        // WC3 Purge: a flash on the caster and a spinning buff on the target while it is slowed.
        fx.glow(e.x1, 1.2, e.y1, '#9fe8ff', 2, 0.3);
        fx.sparks(e.x2, 1, e.y2, 14, 4, '#bff4ff');
        const v = this.views.get(e.u);
        fx.purgeSwirl(() => (v ? { x: v.x, z: v.z } : null), e.d || 2);
        play('zap');
        break;
      }
      case 'zap':
        fx.burst(e.x, 1, e.y, '#9fe8ff', { n: 40, speed: 5, size: 0.6, life: 0.6 });
        fx.flash(e.x, e.y, 2, '#9fe8ff');
        play('zap');
        break;
      case 'burn':
        for (let i = 0; i < 18; i++) fx.flame(e.x, 0.2, e.y, 1.3, 0.8, 0.4);
        fx.sparks(e.x, 1, e.y, 12, 4);
        for (let i = 0; i < 5; i++) fx.smokePuff(e.x, 0.8, e.y, '#2a2220', 1.3, 1.6, 0.5);
        fx.scorch(e.x, e.y, 0.9, 6);
        play('death');
        break;
      case 'squish':
        fx.dustCloud(e.x, e.y, 0.9, '#8a7a60', 10);
        fx.debrisBurst(e.x, e.y, 6, 3);
        play('squish');
        break;
      case 'splash':
        fx.burst(e.x, 0, e.y, '#bfe8ff', { n: 40, speed: 6, size: 0.6, life: 0.8, up: 1.6, grav: 12, additive: false });
        fx.ring(e.x, e.y, 2, '#ffffff', 0.6, -0.3);
        play('splash');
        break;
      case 'shove':
        fx.ring(e.x, e.y, e.r, '#ffe7a0', 0.3);
        fx.burst(e.x, 0.4, e.y, '#ffe7a0', { n: 16, speed: 6, size: 0.5, life: 0.3, up: 0.2 });
        play('shove');
        break;
      case 'sfx':
        play(e.s);
        break;
      default:
        EVENTS.get(e.k)?.(e, this);
    }
  }
}

// Fixed-rate particle emission: returns how many particles `rate` per second
// owes this frame, carrying the fraction over (frame-rate independent).
function emit(v, key, rate, dt) {
  const acc = (v.emit ??= {});
  acc[key] = (acc[key] || 0) + rate * FX_DENSITY * dt;
  const n = Math.floor(acc[key]);
  acc[key] -= n;
  return n;
}

function lerp(a, b, k) {
  return a + (b - a) * k;
}

function lerpAngle(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

// Frees what a map or a view owns on the GPU: its geometries and the textures
// that are not shared (cached materials and fxTexture textures are marked
// userData.shared). A shared geometry or texture freed here is simply
// uploaded again if something still draws it. Materials are only freed with
// a whole map: a view file may share one material between all its entities,
// and freeing it with each entity could force a shader recompile mid-game.
function disposeTree(root, materials = true) {
  root.traverse((o) => {
    if (o.isInstancedMesh) o.dispose();
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    if (!o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (m.userData.shared) continue;
      for (const k in m) if (m[k]?.isTexture && !m[k].userData.shared) m[k].dispose();
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value?.isTexture && !u.value.userData.shared) u.value.dispose();
      if (!materials) continue;
      m.userData.dispose?.();
      m.dispose();
    }
  });
}

const DUMMY = new THREE.Object3D(); // scratch transform for instance matrices

function setOpacity(obj, op) {
  if ((obj.userData.opacity ?? 1) === op) return;
  obj.userData.opacity = op;
  obj.traverse((o) => {
    if (!o.isMesh || !o.material || o === obj.userData.shieldMesh) return;
    if (!o.userData.ownMat) {
      // A private copy to fade (freed with the view). clone() drops the
      // shader hooks of the procedural materials, so carry them over.
      const src = o.material;
      o.material = src.clone();
      o.material.onBeforeCompile = src.onBeforeCompile;
      o.material.customProgramCacheKey = src.customProgramCacheKey;
      o.material.userData = {};
      o.userData.ownMat = true;
    }
    o.material.transparent = op < 1 || o.material.blending === THREE.AdditiveBlending || o.material.opacity < 1;
    if (!o.userData.baseOpacity) o.userData.baseOpacity = o.material.opacity;
    o.material.opacity = o.userData.baseOpacity * op;
  });
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
