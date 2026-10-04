import * as THREE from 'three';

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const frag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uAlpha;
  varying vec2 vUv;
  void main() {
    float fade = pow(1.0 - vUv.y, 1.6);
    float base = smoothstep(0.0, 0.03, vUv.y);
    float shimmer = 0.7 + 0.3 * sin(uTime * 5.0 - vUv.y * 60.0);
    float edge = 0.55 + 0.45 * pow(abs(sin(vUv.x * 3.14159 * 2.0)), 0.5);
    gl_FragColor = vec4(uColor * shimmer * edge, fade * base * uAlpha);
  }`;

export interface Beacon {
  group: THREE.Group;
  /** 0..1 beam width/brightness (animate to collapse) */
  set(k: number): void;
  update(t: number): void;
}

/**
 * A column of light rising out of someone: the gang wear red ones so you can always see them coming;
 * your unshielded money puts a giant gold one on you.
 */
export function makeBeacon(color: THREE.Color, opts: { radius: number; height: number; base: number; seeThrough?: boolean; marker?: boolean }): Beacon {
  const group = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: { uColor: { value: color }, uTime: { value: 0 }, uAlpha: { value: 1 } },
    transparent: true,
    depthWrite: false,
    depthTest: !opts.seeThrough,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });
  const geo = new THREE.CylinderGeometry(opts.radius, opts.radius, opts.height, 20, 1, true);
  geo.translate(0, opts.height / 2, 0);
  const beam = new THREE.Mesh(geo, mat);
  beam.position.y = opts.base;
  beam.renderOrder = 10;
  beam.frustumCulled = false;
  group.add(beam);
  let marker: THREE.Mesh | null = null;
  if (opts.marker) {
    marker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16),
      new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(1.6), depthTest: !opts.seeThrough, transparent: true, fog: false }),
    );
    marker.scale.y = 1.5;
    marker.position.y = opts.base - 0.2;
    marker.renderOrder = 11;
    group.add(marker);
  }
  let k = 1;
  return {
    group,
    set(v: number) {
      k = v;
      beam.scale.set(Math.max(0.001, v), 1, Math.max(0.001, v));
      mat.uniforms.uAlpha.value = Math.min(1, v * 1.2);
      beam.visible = v > 0.01;
      if (marker) marker.visible = v > 0.01;
    },
    update(t: number) {
      mat.uniforms.uTime.value = t;
      if (marker) {
        marker.rotation.y = t * 2.4;
        marker.position.y = opts.base - 0.2 + Math.sin(t * 3) * 0.06;
      }
      void k;
    },
  };
}
