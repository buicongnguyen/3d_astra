import * as THREE from "three";

// A blade-length crescent with a bright lip, a translucent inner fan and two
// branching filaments. All three share one mesh and the army's instance batch.
function makeWaveGeometry() {
  const positions = [], colors = [], indices = [];
  const steps = 24;
  function strip(start, end, profile) {
    const base = positions.length / 3;
    let stride;
    for (let i = 0; i <= steps; i++) {
      const t = start + (end - start) * i / steps;
      const angle = 1.38 * t;
      const bands = profile(t);
      stride = bands.length;
      for (const [radius, r, g, b, alpha] of bands) {
        positions.push(radius * Math.sin(angle), 0.20 * t, radius * Math.cos(angle) - 1);
        colors.push(r, g, b, alpha * (1 - t * t));
      }
    }
    for (let i = 0; i < steps; i++) {
      for (let j = 0; j < stride - 1; j++) {
        const a = base + i * stride + j;
        indices.push(a, a + stride, a + 1, a + 1, a + stride, a + stride + 1);
      }
    }
  }
  strip(0, 1, t => {
    const tail = t * t;
    return [
      [0.50 + 0.44 * tail, 0, 0.12, 0.48, 0],
      [0.65 + 0.30 * tail, 0.005, 0.26, 1, 0.28],
      [0.87 + 0.09 * tail, 0.01, 0.62, 1, 0.72],
      [0.966, 0.35, 0.98, 1, 0.98],
      [0.99, 0.90, 1, 1, 1],
      [1.014, 0.025, 0.52, 0.96, 0.83],
      [1.04, 0.015, 0.22, 0.74, 0],
    ];
  });
  // Angular knots give the filaments a broken lightning silhouette; their
  // brightness tapers into the fan. Fixed geometry keeps the arc steady in motion.
  function filament(start, end, knots) {
    strip(start, end, t => {
      const phase = (t - start) / (end - start);
      const at = phase * (knots.length - 1), i = Math.min(Math.floor(at), knots.length - 2);
      const radius = THREE.MathUtils.lerp(knots[i], knots[i + 1], at - i);
      const width = 0.011 * (1 - phase);
      return [[radius - width, 0.40, 0.92, 1, 0.75], [radius + width, 0.76, 1, 1, 0.98]];
    });
  }
  filament(0.02, 0.86, [0.84, 0.79, 0.89, 0.82, 0.92, 0.86, 0.96]);
  filament(0.22, 0.58, [0.85, 0.74, 0.78, 0.69]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
  g.setIndex(indices);
  return g;
}

// Install before the loader bakes metal finishes. The point is read from the authored
// blade, so resizing it in Blender also moves the wave. Geometry lives with the template.
export function addVanguardWave(arm) {
  const blade = arm.getObjectByName("Sword_blade");
  if (!blade) return;
  const vertices = blade.geometry.getAttribute("position");
  let point = 0;
  for (let i = 1; i < vertices.count; i++) if (vertices.getZ(i) > vertices.getZ(point)) point = i;
  blade.geometry.computeBoundingBox();
  const material = new THREE.MeshBasicMaterial({
    name: "VanguardWave", vertexColors: true, transparent: true, depthWrite: false,
    side: THREE.DoubleSide, forceSinglePass: true, toneMapped: false,
  });
  const wave = new THREE.Mesh(makeWaveGeometry(), material);
  wave.name = "SwordWave";
  wave.position.fromBufferAttribute(vertices, point).applyMatrix4(blade.matrix);
  wave.userData.length = vertices.getZ(point) - blade.geometry.boundingBox.min.z;
  wave.scale.setScalar(0);
  wave.visible = false;
  wave.renderOrder = 2;
  blade.parent.add(wave);
}
