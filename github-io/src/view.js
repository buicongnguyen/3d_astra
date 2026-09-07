import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  DEFINITIONS as D,
  MAP_SIZE,
  HALF,
  GRID,
  ROCKS,
  clamp,
} from "./data.js";

const COLORS = [0x92ebc5, 0xef7660];
const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.88, ...extra });
let seed = 1482;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export class WorldView {
  constructor(container) {
    this.container = container;
    this.lowPower = matchMedia("(pointer: coarse)").matches;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, this.lowPower ? 1 : 1.6),
    );
    this.renderer.shadowMap.enabled = !this.lowPower;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute(
      "aria-label",
      "3D battlefield. Left-click selects; right-click commands.",
    );
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x283630);
    this.scene.fog = new THREE.Fog(0x283630, 105, 190);
    this.camera = new THREE.OrthographicCamera(-40, 40, 30, -30, 0.1, 240);
    this.focus = new THREE.Vector3(
      this.lowPower ? -25 : -20,
      0,
      this.lowPower ? 21 : 19,
    );
    this.defaultZoom = this.lowPower ? 34 : 42;
    this.zoom = this.defaultZoom;
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.models = new Map();
    this.objects = new Map();
    this.resourceObjects = new Map();
    this.effects = [];
    this.teamTemplates = new Map();
    this.fogClock = 0;
    this.gridVisible = false;
    this.scene.add(new THREE.HemisphereLight(0xc1ddd7, 0x736145, 2.0));
    const sun = new THREE.DirectionalLight(0xffe1b0, 3.2);
    sun.position.set(-25, 55, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -65,
      right: 65,
      top: 65,
      bottom: -65,
      near: 0.5,
      far: 150,
    });
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun);
    this.createTerrain();
    this.createFog();
    this.preview = mesh(
      new THREE.CylinderGeometry(1, 1, 0.09, 48),
      new THREE.MeshBasicMaterial({
        color: COLORS[0],
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    );
    this.preview.visible = false;
    this.scene.add(this.preview);
    this.selection = new Set();
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
  }
  setQuality(level) {
    this.lowPower = level === "low";
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, this.lowPower ? 1 : 1.6),
    );
    this.renderer.shadowMap.enabled = !this.lowPower;
    for (const o of this.objects.values())
      o.userData.contactShadow.visible = this.lowPower;
    this.scene.traverse((o) => {
      if (o.isMesh) {
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        materials.forEach((m) => (m.needsUpdate = true));
      }
    });
    this.resize();
  }
  async loadModels() {
    const loader = new GLTFLoader();
    await Promise.all(
      Object.keys(D)
        .filter((k) => k !== "upgrade")
        .map(async (type) => {
          const gltf = await loader.loadAsync(
            `${import.meta.env.BASE_URL}models/${type}.glb`,
          );
          gltf.scene.updateMatrixWorld(true);
          // Merge stationary pieces by material, preserving the two articulated leg pivots.
          const template = new THREE.Group(),
            buckets = new Map(),
            legs = [];
          gltf.scene.traverse((o) => {
            if (o.name.startsWith("leg_")) {
              const leg = o.clone(true);
              o.matrixWorld.decompose(leg.position, leg.quaternion, leg.scale);
              template.add(leg);
              legs.push(leg);
            }
            if (!o.isMesh) return;
            let parent = o.parent;
            while (parent) {
              if (parent.name.startsWith("leg_")) return;
              parent = parent.parent;
            }
            const key = o.material.name;
            if (!buckets.has(key))
              buckets.set(key, { material: o.material, geometries: [] });
            buckets
              .get(key)
              .geometries.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
          });
          for (const { material, geometries } of buckets.values()) {
            const combined = mergeGeometries(geometries, false);
            if (combined) template.add(new THREE.Mesh(combined, material));
            geometries.forEach((g) => g.dispose());
          }
          for (let team = 0; team < 2; team++) {
            const variant = template.clone(true),
              materials = new Map();
            variant.traverse((o) => {
              if (!o.isMesh) return;
              const name = o.material.name;
              if (!materials.has(name)) {
                const m = o.material.clone();
                if (name.startsWith("Team")) {
                  m.color.setHex(COLORS[team]);
                  if (name.startsWith("TeamGlow")) {
                    m.emissive.setHex(COLORS[team]);
                    m.emissiveIntensity = 0.8;
                  }
                }
                materials.set(name, m);
              }
              o.material = materials.get(name);
              o.castShadow = true;
              o.receiveShadow = true;
            });
            this.teamTemplates.set(`${type}-${team}`, variant);
          }
          this.models.set(type, true);
        }),
    );
  }
  createTerrain() {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1024;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#777d58";
    ctx.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 16000; i++) {
      const x = random() * 1024,
        y = random() * 1024,
        r = 1 + random() * 10;
      ctx.fillStyle =
        random() > 0.5
          ? `rgba(209,188,128,${random() * 0.09})`
          : `rgba(31,58,40,${random() * 0.08})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineCap = "round";
    for (const points of [
      [
        [230, 780],
        [370, 610],
        [680, 420],
        [800, 210],
      ],
      [
        [230, 780],
        [130, 480],
        [220, 220],
        [800, 210],
      ],
      [
        [230, 780],
        [790, 800],
        [910, 490],
        [800, 210],
      ],
    ]) {
      for (let w = 90; w > 0; w -= 7) {
        ctx.strokeStyle = "rgba(185,159,105,0.025)";
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(...points[0]);
        ctx.bezierCurveTo(...points[1], ...points[2], ...points[3]);
        ctx.stroke();
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const ground = mesh(
      new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE),
      mat(0xffffff, { map: texture }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.castShadow = false;
    this.scene.add(ground);
    this.scene.add(
      mesh(
        new THREE.BoxGeometry(MAP_SIZE, 2.5, MAP_SIZE),
        mat(0x424634),
        0,
        -1.3,
        0,
      ),
    );
    this.grid = new THREE.GridHelper(MAP_SIZE, 48, 0xd8d8b4, 0xa6b087);
    this.grid.position.y = 0.035;
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.15;
    this.grid.visible = false;
    this.scene.add(this.grid);
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(MAP_SIZE, 0.1, MAP_SIZE)),
      new THREE.LineBasicMaterial({
        color: 0xb7b38a,
        transparent: true,
        opacity: 0.3,
      }),
    );
    this.scene.add(edge);
    const rockMat = mat(0x626957),
      topMat = mat(0x888872);
    for (const [x, z, r] of ROCKS) {
      for (let i = 0; i < 4; i++) {
        const stone = mesh(
          new THREE.DodecahedronGeometry(1, 0),
          i === 0 ? topMat : rockMat,
          x + (random() - 0.5) * r,
          0.6 + random() * r * 0.3,
          z + (random() - 0.5) * r,
        );
        stone.scale.set(
          r * (0.6 + random() * 0.4),
          r * (0.45 + random() * 0.55),
          r * (0.6 + random() * 0.4),
        );
        stone.rotation.set(random() * 0.7, random() * 6, random() * 0.4);
        this.scene.add(stone);
      }
    }
    const pebbles = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(0.22, 0),
      rockMat,
      500,
    );
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 500; i++) {
      dummy.position.set((random() - 0.5) * 95, 0.08, (random() - 0.5) * 95);
      dummy.scale.setScalar(0.5 + random());
      dummy.rotation.set(random(), random() * 6, random());
      dummy.updateMatrix();
      pebbles.setMatrixAt(i, dummy.matrix);
    }
    this.scene.add(pebbles);
    const grass = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.22, 0.6, 3),
      mat(0x515f40),
      850,
    );
    for (let i = 0; i < 850; i++) {
      dummy.position.set((random() - 0.5) * 95, 0.22, (random() - 0.5) * 95);
      dummy.scale.setScalar(0.4 + random() * 0.7);
      dummy.rotation.set(0, random() * 6, 0.15);
      dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix);
    }
    this.scene.add(grass);
    // Subtle starting-base landing pad.
    for (const side of [1, -1]) {
      const pad = mesh(
        new THREE.CylinderGeometry(6.2, 6.2, 0.04, 8),
        mat(0x6a7262),
        -25 * side,
        0.025,
        24 * side,
      );
      pad.rotation.y = Math.PI / 8;
      pad.castShadow = false;
      this.scene.add(pad);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(6.3, 6.38, 64),
        new THREE.MeshBasicMaterial({
          color: 0xdad4af,
          transparent: true,
          opacity: 0.35,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(-25 * side, 0.052, 24 * side);
      this.scene.add(ring);
    }
  }
  createFog() {
    this.fogCanvas = document.createElement("canvas");
    this.fogCanvas.width = this.fogCanvas.height = GRID;
    this.fogContext = this.fogCanvas.getContext("2d");
    this.fogImage = this.fogContext.createImageData(GRID, GRID);
    this.fogTexture = new THREE.CanvasTexture(this.fogCanvas);
    this.fogTexture.magFilter = THREE.LinearFilter;
    const material = new THREE.MeshBasicMaterial({
      map: this.fogTexture,
      transparent: true,
      depthWrite: false,
    });
    this.fogMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE),
      material,
    );
    this.fogMesh.rotation.x = -Math.PI / 2;
    this.fogMesh.position.y = 0.15;
    this.fogMesh.renderOrder = 2;
    this.scene.add(this.fogMesh);
  }
  resize() {
    this.width = Math.max(1, this.container.clientWidth);
    this.height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(this.width, this.height);
    this.updateCamera();
  }
  updateCamera() {
    const aspect = this.width / this.height;
    this.camera.left = (-this.zoom * aspect) / 2;
    this.camera.right = (this.zoom * aspect) / 2;
    this.camera.top = this.zoom / 2;
    this.camera.bottom = -this.zoom / 2;
    this.camera.position.copy(this.focus).add(new THREE.Vector3(22, 56, 38));
    this.camera.lookAt(this.focus);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }
  pan(dx, dz) {
    this.focus.x = clamp(this.focus.x + dx, -42, 42);
    this.focus.z = clamp(this.focus.z + dz, -42, 42);
    this.updateCamera();
  }
  screenPan(dx, dy) {
    const right = new THREE.Vector3().setFromMatrixColumn(
      this.camera.matrixWorld,
      0,
    );
    const up = new THREE.Vector3().setFromMatrixColumn(
      this.camera.matrixWorld,
      1,
    );
    up.y = 0;
    up.normalize();
    this.pan(right.x * dx + up.x * dy, right.z * dx + up.z * dy);
  }
  zoomBy(delta) {
    this.zoom = clamp(this.zoom + delta, 22, 88);
    this.updateCamera();
  }
  focusOn(x, z) {
    this.focus.set(clamp(x, -42, 42), 0, clamp(z, -42, 42));
    this.updateCamera();
  }
  point(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.raycaster.setFromCamera(
      new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        (-(clientY - rect.top) / rect.height) * 2 + 1,
      ),
      this.camera,
    );
    const p = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.plane, p)
      ? { x: clamp(p.x, -47, 47), z: clamp(p.z, -47, 47) }
      : null;
  }
  project(x, z, y = 0) {
    const p = new THREE.Vector3(x, y, z).project(this.camera);
    return {
      x: ((p.x + 1) / 2) * this.width,
      y: ((1 - p.y) / 2) * this.height,
    };
  }
  pick(clientX, clientY, sim, minRadius = 14) {
    const rect = this.renderer.domElement.getBoundingClientRect(),
      x = clientX - rect.left,
      y = clientY - rect.top;
    let best = null,
      score = Infinity;
    for (const e of [...sim.entities, ...sim.resources]) {
      if (!sim.isVisible(e) || e.amount === 0) continue;
      const p = this.project(
        e.x,
        e.z,
        e.kind === "building" ? 1.8 : e.kind === "resource" ? 1 : 0.9,
      );
      const d = Math.hypot(p.x - x, p.y - y),
        radius = Math.max(
          minRadius,
          ((e.radius + 0.6) * this.height) / this.zoom,
        );
      if (d < radius && d / radius < score) {
        best = e;
        score = d / radius;
      }
    }
    return best;
  }
  createEntity(e) {
    const root = new THREE.Group(),
      model = this.teamTemplates.get(`${e.type}-${e.team}`).clone(true);
    root.add(model);
    const contactShadow = new THREE.Mesh(
      new THREE.CircleGeometry(e.radius * 1.25, 20),
      new THREE.MeshBasicMaterial({
        color: 0x13251b,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
      }),
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.07;
    contactShadow.visible = this.lowPower;
    root.add(contactShadow);
    root.userData.contactShadow = contactShadow;
    root.userData.model = model;
    root.userData.legs = [];
    model.traverse((o) => {
      if (o.name.startsWith("leg_"))
        root.userData.legs.push({ node: o, base: o.quaternion.clone() });
    });
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(e.radius + 0.3, e.radius + 0.42, 40),
      new THREE.MeshBasicMaterial({
        color: COLORS[e.team],
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.19;
    ring.visible = false;
    ring.renderOrder = 3;
    root.add(ring);
    root.userData.ring = ring;
    const bar = new THREE.Group(),
      back = new THREE.Mesh(
        new THREE.PlaneGeometry(2.1, 0.16),
        new THREE.MeshBasicMaterial({ color: 0x111a1a, depthTest: false }),
      );
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 0.09),
      new THREE.MeshBasicMaterial({ color: COLORS[e.team], depthTest: false }),
    );
    fill.position.z = 0.01;
    bar.add(back, fill);
    bar.position.y = e.kind === "building" ? 5.2 : 2.9;
    bar.visible = false;
    bar.renderOrder = 10;
    root.add(bar);
    root.userData.bar = bar;
    root.userData.fill = fill;
    this.scene.add(root);
    this.objects.set(e.id, root);
    return root;
  }
  createResource(e) {
    const group = new THREE.Group(),
      color = e.type === "alloy" ? 0xd59d43 : 0x65c9e2;
    const material = mat(color, {
      metalness: 0.2,
      emissive: color,
      emissiveIntensity: 0.15,
    });
    for (let i = 0; i < 7; i++) {
      const crystal = mesh(
        new THREE.CylinderGeometry(
          0,
          0.45 + random() * 0.35,
          1.3 + random() * 1.8,
          5,
        ),
        material,
        (random() - 0.5) * 2.5,
        0.8,
        (random() - 0.5) * 2.5,
      );
      crystal.rotation.set(
        (random() - 0.5) * 0.6,
        random() * 6,
        (random() - 0.5) * 0.6,
      );
      group.add(crystal);
    }
    group.position.set(e.x, 0, e.z);
    this.scene.add(group);
    this.resourceObjects.set(e.id, group);
    return group;
  }
  marker(x, z, color = COLORS[0]) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.85, 32),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.23, z);
    m.renderOrder = 4;
    this.scene.add(m);
    this.effects.push({ mesh: m, life: 0.8, max: 0.8, marker: true });
  }
  event(event, sim) {
    if (
      event.type === "shot" &&
      (sim.isVisible(event) || sim.isVisible({ x: event.tx, z: event.tz }))
    ) {
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(event.x, 1.5, event.z),
          new THREE.Vector3(event.tx, 0.9, event.tz),
        ]),
        new THREE.LineBasicMaterial({
          color: event.heavy ? 0xffc679 : COLORS[event.team],
          transparent: true,
          opacity: 0.9,
        }),
      );
      this.scene.add(line);
      this.effects.push({ mesh: line, life: 0.12, max: 0.12 });
    } else if (event.type === "death" && sim.isVisible(event)) {
      const m = mesh(
        new THREE.IcosahedronGeometry(event.building ? 2 : 0.8, 0),
        new THREE.MeshBasicMaterial({
          color: 0xffcc79,
          transparent: true,
          opacity: 1,
        }),
        event.x,
        1,
        event.z,
      );
      this.scene.add(m);
      this.effects.push({ mesh: m, life: 0.45, max: 0.45, explosion: true });
    }
  }
  update(sim, dt, selected, hover) {
    const alive = new Set();
    for (const e of sim.entities) {
      alive.add(e.id);
      const o = this.objects.get(e.id) || this.createEntity(e);
      o.visible = sim.isVisible(e);
      if (!o.visible) continue;
      o.position.set(e.x, 0, e.z);
      const m = o.userData.model;
      m.rotation.y = e.kind === "unit" ? e.angle : e.team === 0 ? 0 : Math.PI;
      m.position.y =
        e.kind === "unit" && e.moving
          ? Math.sin(sim.time * 13 + e.id) * 0.045
          : 0;
      m.scale.y = e.complete ? 1 : 0.15 + e.progress * 0.85;
      for (let i = 0; i < o.userData.legs.length; i++) {
        const leg = o.userData.legs[i];
        leg.node.quaternion.copy(leg.base);
        if (e.moving)
          leg.node.rotateX(Math.sin(sim.time * 11 + i * Math.PI) * 0.4);
      }
      o.userData.ring.visible = selected.has(e.id) || hover?.id === e.id;
      o.userData.bar.visible =
        selected.has(e.id) || hover?.id === e.id || e.hp < e.maxHp;
      o.userData.bar.quaternion.copy(this.camera.quaternion);
      o.userData.fill.scale.x = Math.max(0, e.hp / e.maxHp);
      o.userData.fill.position.x = -(1 - e.hp / e.maxHp);
    }
    for (const [id, object] of this.objects)
      if (!alive.has(id)) {
        this.disposeEntity(object);
        this.objects.delete(id);
      }
    for (const r of sim.resources) {
      const o = this.resourceObjects.get(r.id) || this.createResource(r);
      if (sim.isVisible(r)) o.userData.lastAmount = r.amount;
      const amount = o.userData.lastAmount || 0;
      o.visible = amount > 0 && sim.isExplored(r);
      o.scale.y = 0.4 + (0.6 * amount) / r.initial;
    }
    this.fogClock -= dt;
    if (this.fogClock <= 0) {
      this.fogClock = 0.25;
      for (let i = 0; i < GRID * GRID; i++) {
        const j = i * 4;
        this.fogImage.data[j] = 14;
        this.fogImage.data[j + 1] = 26;
        this.fogImage.data[j + 2] = 25;
        this.fogImage.data[j + 3] = sim.visible[0][i]
          ? 0
          : sim.explored[0][i]
            ? 145
            : 232;
      }
      this.fogContext.putImageData(this.fogImage, 0, 0);
      this.fogTexture.needsUpdate = true;
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life -= dt;
      e.mesh.material.opacity = Math.max(0, e.life / e.max);
      if (e.marker || e.explosion)
        e.mesh.scale.setScalar(1 + (1 - e.life / e.max) * 2);
      if (e.life <= 0) {
        this.scene.remove(e.mesh);
        e.mesh.geometry.dispose();
        e.mesh.material.dispose();
        this.effects.splice(i, 1);
      }
    }
    this.renderer.render(this.scene, this.camera);
  }
  disposeEntity(o) {
    this.scene.remove(o);
    // Model geometry and materials belong to shared templates; only dispose per-instance UI.
    for (const m of [
      o.userData.ring,
      o.userData.contactShadow,
      ...o.userData.bar.children,
    ]) {
      m.geometry.dispose();
      m.material.dispose();
    }
  }
  reset() {
    for (const o of this.objects.values()) this.disposeEntity(o);
    this.objects.clear();
    for (const o of this.resourceObjects.values()) {
      this.scene.remove(o);
      o.traverse((m) => {
        if (m.isMesh) m.geometry.dispose();
      });
      o.children[0]?.material.dispose();
    }
    this.resourceObjects.clear();
    for (const e of this.effects) {
      this.scene.remove(e.mesh);
      e.mesh.geometry.dispose();
      e.mesh.material.dispose();
    }
    this.effects = [];
    this.focusOn(
      this.defaultZoom === 34 ? -25 : -20,
      this.defaultZoom === 34 ? 21 : 19,
    );
    this.zoom = this.defaultZoom;
    this.updateCamera();
    this.fogClock = 0;
  }
}
