import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { B, type VoxelWorld } from './voxels';

/**
 * Wet street: a planar reflection of the whole city just above the ground,
 * added on top of the voxels so neon and lit windows bleed into the asphalt.
 * Wetness per cell comes from the ground block type (asphalt/puddles wettest).
 */
export function createWetStreet(world: VoxelWorld, scale: number) {
  const W = world.sx,
    D = world.sz;
  // wetness mask, one texel per block
  const data = new Uint8Array(W * D * 4);
  for (let z = 0; z < D; z++)
    for (let x = 0; x < W; x++) {
      const b = world.get(x, 0, z);
      const covered = world.get(x, 1, z) !== 0 || !world.sky[world.idx(x, 1, z)];
      let w = 0;
      if (!covered)
        w =
          b === B.PUDDLE ? 1 : b === B.ASPHALT ? 0.8 : b === B.LINE ? 0.55 : b === B.TILE ? 0.6 : b === B.SIDEWALK ? 0.45 : b === B.CURB ? 0.3 : 0.35;
      const o = (x + z * W) * 4;
      data[o] = data[o + 1] = data[o + 2] = Math.round(w * 255);
      data[o + 3] = 255;
    }
  const mask = new THREE.DataTexture(data, W, D);
  mask.magFilter = THREE.LinearFilter;
  mask.minFilter = THREE.LinearFilter;
  mask.needsUpdate = true;

  const shader = {
    name: 'WetStreet',
    uniforms: {
      color: { value: new THREE.Color(1, 1, 1) },
      tDiffuse: { value: null },
      textureMatrix: { value: null },
      uMask: { value: mask },
      uTime: { value: 0 },
      uSize: { value: new THREE.Vector2(W, D) },
      uStrength: { value: 1.1 },
    },
    vertexShader: /* glsl */ `
      uniform mat4 textureMatrix;
      varying vec4 vUv;
      varying vec3 vWorld;
      varying vec3 vView;
      void main() {
        vUv = textureMatrix * vec4(position, 1.0);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vView = cameraPosition - wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform sampler2D uMask;
      uniform float uTime;
      uniform vec2 uSize;
      uniform float uStrength;
      varying vec4 vUv;
      varying vec3 vWorld;
      varying vec3 vView;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      // expanding raindrop rings
      float ripples(vec2 p, float t) {
        vec2 cell = floor(p);
        vec2 f = fract(p) - 0.5;
        float h = hash(cell);
        float ph = fract(t * (0.6 + h * 0.5) + h * 7.0);
        vec2 off = vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5;
        float d = length(f - off * 0.5);
        float ring = smoothstep(0.04, 0.0, abs(d - ph * 0.45)) * (1.0 - ph);
        return ring;
      }
      void main() {
        vec2 cellUv = vWorld.xz / uSize;
        float wet = texture2D(uMask, cellUv).r;
        float n = noise(vWorld.xz * 0.35) * 0.6 + noise(vWorld.xz * 1.7) * 0.4;
        wet *= smoothstep(0.15, 0.75, n + wet * 0.35);
        float rip = ripples(vWorld.xz * 1.3, uTime) * 0.7;
        vec2 distort = vec2(noise(vWorld.xz * 4.0 + uTime * 0.4), noise(vWorld.zx * 4.0 - uTime * 0.3)) - 0.5;
        distort = distort * 0.012 + vec2(rip) * 0.006;
        vec4 uv = vUv;
        uv.xy += distort * uv.w;
        vec3 refl = texture2DProj(tDiffuse, uv).rgb;
        // stretch bright highlights a little (anisotropic streak feel)
        vec4 uv2 = uv; uv2.y += 0.012 * uv.w;
        refl = max(refl, texture2DProj(tDiffuse, uv2).rgb * 0.8);
        vec3 V = normalize(vView);
        float fres = 0.25 + 0.75 * pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);
        float lum = dot(refl, vec3(0.299, 0.587, 0.114));
        // only bright things (neon, windows, lamps) read as reflections
        vec3 col = refl * smoothstep(0.03, 0.35, lum) * wet * fres * uStrength;
        col += vec3(0.5, 0.6, 0.8) * rip * wet * 0.012;
        gl_FragColor = vec4(col, 1.0);
      }`,
  };

  const geo = new THREE.PlaneGeometry(W, D);
  const ref = new Reflector(geo, {
    textureWidth: Math.round(innerWidth * scale),
    textureHeight: Math.round(innerHeight * scale),
    clipBias: 0.003,
    shader,
  });
  ref.rotation.x = -Math.PI / 2;
  ref.position.set(W / 2, 1.004, D / 2);
  const mat = ref.material as THREE.ShaderMaterial;
  mat.transparent = true;
  mat.blending = THREE.AdditiveBlending;
  mat.depthWrite = false;
  ref.renderOrder = 1;
  return {
    mesh: ref,
    update(t: number) {
      mat.uniforms.uTime.value = t;
    },
    resize() {
      ref.getRenderTarget().setSize(Math.round(innerWidth * scale), Math.round(innerHeight * scale));
    },
  };
}
