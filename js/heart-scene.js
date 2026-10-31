/* The 3D heart: geometry, materials, beating, blood flow, valves, electricity and picking.
   Classic script: THREE and its addons are handed in by the module bootstrap at the bottom of index.html.
   Coordinates are an anterior view: x = patient's left (viewer's right), y = up, z = toward the viewer. */
window.createHeartScene = function (lib, container) {
  const { THREE, OrbitControls, RoomEnvironment, mergeVertices } = lib;
  const { parts: PARTS, journey: JOURNEY } = window.HEART;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const listeners = { select: [], rideStep: [], rideEnd: [], rideDone: [] };
  const emit = (name, arg) => listeners[name].forEach((cb) => cb(arg));

  // ---------- renderer, camera, lights ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  const TARGET = V(0.05, 0.42, -0.1);
  const HOME = V(1.6, 1.0, 8.3);
  camera.position.copy(HOME);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(TARGET);
  controls.enableDamping = true;
  controls.enablePan = false;
  // Pinch zooms on touch screens; the mouse wheel is left to scroll the page (desktop has zoom buttons).
  controls.enableZoom = true;
  container.addEventListener('wheel', (e) => e.stopPropagation(), { capture: true });
  // Sideways swipes spin the heart, up/down swipes scroll the page, so phones never get stuck on the viewer.
  renderer.domElement.style.touchAction = 'pan-y';
  controls.minDistance = 3.2;
  controls.maxDistance = 11;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.5;
  controls.addEventListener('start', () => {
    controls.autoRotate = false;
    camTween = null;
  });

  scene.add(new THREE.HemisphereLight(0xffe8e8, 0x1b1030, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x7a96ff, 2.0);
  rim.position.set(-4, 1.5, -4);
  scene.add(rim);
  const under = new THREE.DirectionalLight(0xff6680, 0.8);
  under.position.set(1, -4, 2);
  scene.add(under);

  const heart = new THREE.Group();
  heart.rotation.set(0.05, -0.3, -0.04);
  scene.add(heart);

  // ---------- materials (one per part, so each part can glow on its own) ----------
  const COLORS = {
    ventricle: 0xb0263a,
    atrium: 0xa3283f,
    artery: 0xd0343c,
    vein: 0x3c5fd8,
    coronary: 0xe24a4a,
    valve: 0xf4e6cc,
  };
  const materials = {};
  const meshesByPart = {};
  const pickables = [];

  function partMaterial(key, color, flowOpacity, extra = {}) {
    if (!materials[key]) {
      materials[key] = new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.42,
        clearcoat: 0.7,
        clearcoatRoughness: 0.32,
        sheen: 0.6,
        sheenColor: new THREE.Color(0xff9c9c),
        sheenRoughness: 0.5,
        transparent: true,
        ...extra,
      });
      materials[key].userData.flowOpacity = flowOpacity;
    }
    return materials[key];
  }

  function register(mesh, key) {
    mesh.userData.part = key;
    (meshesByPart[key] ||= []).push(mesh);
    pickables.push(mesh);
    return mesh;
  }

  // Positions a mesh using heart coordinates even when it lives inside a sub-group.
  function place(group, mesh, x, y, z) {
    mesh.position.set(x, y, z).sub(group.position);
    group.add(mesh);
    return mesh;
  }

  // A sphere squashed into an organic chamber shape, optionally narrowing toward the bottom (apex).
  function blob({ scale, taper = 0, seed = 0 }) {
    let g = new THREE.SphereGeometry(1, 80, 60);
    g.deleteAttribute('normal');
    g.deleteAttribute('uv');
    g = mergeVertices(g);
    const pos = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (v.y < 0 && taper) {
        const k = 1 - taper * Math.pow(-v.y, 1.6);
        v.x *= k;
        v.z *= k;
      }
      const n = 0.02 * Math.sin(5.1 * v.x + seed) * Math.sin(4.3 * v.y + seed * 2) * Math.sin(6.7 * v.z + seed * 3);
      v.multiplyScalar(1 + n).multiply(scale);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }

  // ---------- chambers ----------
  // The ventricles scale around a pivot at their base, so the apex lifts on each squeeze.
  const ventricles = new THREE.Group();
  ventricles.position.set(0.05, 0.35, 0.05);
  heart.add(ventricles);

  const lv = place(ventricles, register(new THREE.Mesh(blob({ scale: V(0.75, 1.1, 0.75), taper: 0.62, seed: 1 }), partMaterial('leftVentricle', COLORS.ventricle, 0.2)), 'leftVentricle'), 0.35, -0.35, -0.05);
  lv.rotation.set(-0.25, 0, 0.45);

  const rv = place(ventricles, register(new THREE.Mesh(blob({ scale: V(0.7, 0.95, 0.55), taper: 0.55, seed: 2 }), partMaterial('rightVentricle', COLORS.ventricle, 0.2)), 'rightVentricle'), -0.25, -0.25, 0.28);
  rv.rotation.set(-0.15, 0, 0.3);

  const ra = place(heart, register(new THREE.Mesh(blob({ scale: V(0.52, 0.56, 0.5), seed: 3 }), partMaterial('rightAtrium', COLORS.atrium, 0.2)), 'rightAtrium'), -0.78, 0.5, 0.05);
  const raEar = register(new THREE.Mesh(blob({ scale: V(0.3, 0.17, 0.2), seed: 4 }), materials.rightAtrium), 'rightAtrium');
  raEar.position.set(0.3, 0.22, 0.34);
  raEar.rotation.z = -0.4;
  ra.add(raEar);

  const la = place(heart, register(new THREE.Mesh(blob({ scale: V(0.56, 0.42, 0.5), seed: 5 }), partMaterial('leftAtrium', COLORS.atrium, 0.2)), 'leftAtrium'), 0.42, 0.52, -0.42);
  const laEar = register(new THREE.Mesh(blob({ scale: V(0.3, 0.16, 0.2), seed: 6 }), materials.leftAtrium), 'leftAtrium');
  laEar.position.set(0.4, 0.02, 0.4);
  laEar.rotation.z = 0.5;
  la.add(laEar);

  // ---------- blood vessels ----------
  function vessel(key, pts, radius, color) {
    const mat = partMaterial(key, color, 0.3);
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => V(...p)));
    heart.add(register(new THREE.Mesh(new THREE.TubeGeometry(curve, 90, radius, 28, false), mat), key));
    for (const end of [curve.getPoint(0), curve.getPoint(1)]) {
      const cap = register(new THREE.Mesh(new THREE.SphereGeometry(radius, 28, 16), mat), key);
      cap.position.copy(end);
      heart.add(cap);
    }
  }

  vessel('aorta', [[0.1, 0.3, 0], [0.02, 0.8, 0.05], [0.0, 1.25, 0.05], [0.08, 1.6, -0.1], [0.4, 1.75, -0.45], [0.6, 1.5, -0.9], [0.55, 0.9, -1.05], [0.5, -0.7, -1.05]], 0.17, COLORS.artery);
  vessel('aorta', [[0.06, 1.58, -0.12], [-0.05, 1.95, -0.1], [-0.1, 2.2, -0.1]], 0.075, COLORS.artery);
  vessel('aorta', [[0.28, 1.68, -0.33], [0.3, 2.2, -0.35]], 0.06, COLORS.artery);
  vessel('aorta', [[0.5, 1.6, -0.62], [0.62, 2.12, -0.66]], 0.06, COLORS.artery);

  vessel('pulmonaryArtery', [[-0.12, 0.3, 0.36], [-0.08, 0.5, 0.38], [0.06, 0.95, 0.4], [0.25, 1.2, 0.15]], 0.15, COLORS.vein);
  vessel('pulmonaryArtery', [[0.25, 1.2, 0.15], [0.7, 1.25, -0.1], [1.45, 1.2, -0.2]], 0.1, COLORS.vein);
  vessel('pulmonaryArtery', [[0.25, 1.2, 0.15], [-0.1, 1.22, -0.25], [-0.8, 1.15, -0.32], [-1.45, 1.1, -0.32]], 0.1, COLORS.vein);

  vessel('superiorVenaCava', [[-0.8, 1.95, 0.02], [-0.8, 1.2, 0.02], [-0.78, 0.75, 0.04]], 0.13, COLORS.vein);
  vessel('inferiorVenaCava', [[-0.72, -1.1, -0.3], [-0.73, -0.4, -0.2], [-0.76, 0.2, -0.02]], 0.14, COLORS.vein);

  vessel('pulmonaryVeins', [[1.45, 0.75, -0.4], [0.85, 0.6, -0.42]], 0.07, COLORS.artery);
  vessel('pulmonaryVeins', [[1.45, 0.4, -0.5], [0.85, 0.45, -0.45]], 0.07, COLORS.artery);
  vessel('pulmonaryVeins', [[-0.6, 0.8, -0.75], [0.05, 0.6, -0.5]], 0.07, COLORS.artery);
  vessel('pulmonaryVeins', [[-0.6, 0.45, -0.8], [0.05, 0.45, -0.5]], 0.07, COLORS.artery);

  // ---------- coronary arteries, draped onto the ventricle surface ----------
  heart.updateMatrixWorld(true);
  const coronaryMat = partMaterial('coronary', COLORS.coronary, 0.45);

  function coronary(dirs, radius) {
    const center = V(0.1, -0.3, 0.15);
    const ray = new THREE.Raycaster();
    const guide = new THREE.CatmullRomCurve3(dirs.map((d) => V(...d).normalize()));
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const dir = guide.getPoint(i / 40).normalize();
      const origin = heart.localToWorld(center.clone().addScaledVector(dir, 4));
      const inward = dir.clone().transformDirection(heart.matrixWorld).negate();
      ray.set(origin, inward);
      const hit = ray.intersectObjects([lv, rv], false)[0];
      if (hit) pts.push(ventricles.worldToLocal(hit.point.addScaledVector(inward, -0.012)));
    }
    if (pts.length < 4) return;
    const curve = new THREE.CatmullRomCurve3(pts);
    ventricles.add(register(new THREE.Mesh(new THREE.TubeGeometry(curve, 140, radius, 10, false), coronaryMat), 'coronary'));
  }

  coronary([[0.15, 0.85, 0.5], [0.25, 0.3, 0.92], [0.35, -0.35, 0.85], [0.5, -0.8, 0.35]], 0.026);
  coronary([[0.28, 0.3, 0.9], [0.55, 0.0, 0.8], [0.8, -0.35, 0.5]], 0.016);
  coronary([[-0.35, 0.75, 0.55], [-0.75, 0.5, 0.45], [-0.95, 0.15, 0.0], [-0.7, -0.2, -0.65]], 0.024);
  coronary([[0.5, 0.75, 0.4], [0.9, 0.5, 0.0], [0.7, 0.35, -0.6]], 0.022);
  coronary([[-0.2, 0.5, 0.85], [-0.3, -0.1, 0.9], [-0.15, -0.6, 0.75]], 0.014);

  // ---------- valves ----------
  const valves = [];

  function valve(key, pos, dir, cusps, radius, kind) {
    const mat = partMaterial(key, COLORS.valve, 0.95, { side: THREE.DoubleSide, roughness: 0.6, sheen: 0, clearcoat: 0.3 });
    const group = new THREE.Group();
    group.position.set(...pos);
    group.quaternion.setFromUnitVectors(V(0, 0, 1), V(...dir).normalize());
    heart.add(group);
    group.add(register(new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.13, 10, 48), mat), key));

    const leaflets = [];
    for (let i = 0; i < cusps; i++) {
      const a0 = (i / cusps) * Math.PI * 2;
      const a1 = ((i + 1) / cusps) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const hinge = V(Math.cos(am) * radius, Math.sin(am) * radius, 0);
      const tip = V(Math.cos(am), Math.sin(am), 0).multiplyScalar(radius * 0.04);
      const verts = [];
      const rimPts = [];
      for (let k = 0; k <= 8; k++) {
        const a = a0 + ((a1 - a0) * k) / 8;
        rimPts.push(V(Math.cos(a) * radius * 0.96, Math.sin(a) * radius * 0.96, 0));
      }
      for (let k = 0; k < 8; k++) {
        for (const p of [tip, rimPts[k], rimPts[k + 1]]) verts.push(p.x - hinge.x, p.y - hinge.y, p.z);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.computeVertexNormals();
      const pivot = new THREE.Group();
      pivot.position.copy(hinge);
      group.add(pivot);
      pivot.add(register(new THREE.Mesh(geo, mat), key));
      const axis = V(-Math.sin(am), Math.cos(am), 0);
      const inward = tip.clone().sub(hinge);
      const sign = Math.sign(axis.clone().cross(inward).z) || 1;
      leaflets.push({ pivot, axis, sign });
    }
    valves.push({ group, leaflets, kind, open: 0, mat });
  }

  const VALVE_POS = {
    tricuspidValve: [-0.6, 0.15, 0.2],
    pulmonaryValve: [-0.1, 0.42, 0.37],
    mitralValve: [0.4, 0.2, -0.2],
    aorticValve: [0.08, 0.42, 0.01],
  };
  valve('tricuspidValve', VALVE_POS.tricuspidValve, [0.35, -0.85, 0.3], 3, 0.15, 'av');
  valve('pulmonaryValve', VALVE_POS.pulmonaryValve, [0.15, 1, 0.02], 3, 0.12, 'sl');
  valve('mitralValve', VALVE_POS.mitralValve, [0.05, -1, 0.35], 2, 0.15, 'av');
  valve('aorticValve', VALVE_POS.aorticValve, [-0.1, 1, 0.05], 3, 0.13, 'sl');

  // ---------- blood flow particles ----------
  const POOR = 0x5b8cff;
  const RICH = 0xff4057;
  const RV_ROUTE = [[-0.6, 0.15, 0.2], [-0.35, -0.5, 0.3], [-0.15, -0.1, 0.38], [-0.08, 0.4, 0.37], [0.06, 0.95, 0.4], [0.25, 1.2, 0.15]];
  const LV_ROUTE = [[0.42, 0.52, -0.42], [0.4, 0.2, -0.2], [0.55, -0.6, -0.05], [0.3, -0.2, 0.0], [0.08, 0.4, 0.01], [0.02, 0.8, 0.05], [0.0, 1.25, 0.05]];
  const FLOWS = {
    svc: { color: POOR, pts: [[-0.8, 2.05, 0.02], [-0.8, 1.2, 0.02], [-0.78, 0.6, 0.05], ...RV_ROUTE, [0.7, 1.25, -0.1], [1.5, 1.2, -0.2]] },
    ivc: { color: POOR, pts: [[-0.72, -1.2, -0.3], [-0.73, -0.4, -0.2], [-0.76, 0.25, 0.0], ...RV_ROUTE, [-0.1, 1.22, -0.25], [-0.8, 1.15, -0.32], [-1.5, 1.1, -0.32]] },
    rpv: { color: RICH, pts: [[-0.65, 0.8, -0.75], [0.05, 0.6, -0.5], ...LV_ROUTE, [0.08, 1.6, -0.1], [0.4, 1.75, -0.45], [0.6, 1.5, -0.9], [0.55, 0.9, -1.05], [0.5, -0.8, -1.05]] },
    lpv: { color: RICH, pts: [[1.5, 0.75, -0.4], [0.85, 0.6, -0.42], ...LV_ROUTE, [0.06, 1.62, -0.12], [-0.05, 1.95, -0.1], [-0.1, 2.3, -0.1]] },
  };

  const bloodMat = new THREE.ShaderMaterial({
    uniforms: { uSize: { value: 30 * renderer.getPixelRatio() }, uOpacity: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float alpha;
      attribute vec3 tint;
      varying float vAlpha;
      varying vec3 vTint;
      uniform float uSize;
      void main() {
        vAlpha = alpha;
        vTint = tint;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      varying vec3 vTint;
      uniform float uOpacity;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.08, d);
        gl_FragColor = vec4(vTint * (1.35 - d), a * vAlpha * uOpacity);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const flows = {};
  for (const [name, def] of Object.entries(FLOWS)) {
    const curve = new THREE.CatmullRomCurve3(def.pts.map((p) => V(...p)));
    const table = curve.getSpacedPoints(500);
    const count = 150;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const tints = new Float32Array(count * 3);
    const alphas = new Float32Array(count);
    const offsets = new Float32Array(count);
    const jitter = [];
    const c = new THREE.Color(def.color);
    for (let i = 0; i < count; i++) {
      offsets[i] = Math.random();
      jitter.push(V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.1));
      const shade = 0.75 + Math.random() * 0.35;
      tints.set([c.r * shade, c.g * shade, c.b * shade], i * 3);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('tint', new THREE.BufferAttribute(tints, 3));
    geo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
    const points = new THREE.Points(geo, bloodMat);
    points.frustumCulled = false;
    heart.add(points);
    flows[name] = { curve, table, length: curve.getLength(), count, offsets, jitter, positions, alphas, geo, points, progress: 0, color: def.color };
  }

  function pointOnTable(table, u, out) {
    const f = Math.min(0.99999, Math.max(0, u)) * (table.length - 1);
    const i = Math.floor(f);
    return out.copy(table[i]).lerp(table[i + 1], f - i);
  }

  function uNear(flow, p) {
    const target = V(...p);
    let best = 0;
    let bestD = Infinity;
    flow.table.forEach((q, i) => {
      const d = q.distanceToSquared(target);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best / (flow.table.length - 1);
  }

  // ---------- glow sprites: the electrical spark and the "follow a blood cell" rider ----------
  function glowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.18)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  const glow = glowTexture();
  const spriteMat = (color) =>
    new THREE.SpriteMaterial({ map: glow, color, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true });

  const spark = new THREE.Sprite(spriteMat(0xffe36b));
  spark.scale.setScalar(0.5);
  spark.visible = false;
  heart.add(spark);
  const SA = V(-0.72, 0.9, 0.32);
  const AV = V(-0.32, 0.2, 0.25);
  const APEX = V(0.4, -1.0, 0.5);

  const rider = new THREE.Sprite(spriteMat(0xffffff));
  rider.scale.setScalar(0.65);
  rider.visible = false;
  heart.add(rider);
  const riderLight = new THREE.PointLight(0xffffff, 0, 2.5, 2);
  heart.add(riderLight);

  // A short glowing trail behind the tour's blood cell.
  const TRAIL = 30;
  const trailPos = new Float32Array(TRAIL * 3);
  const trailTint = new Float32Array(TRAIL * 3);
  const trailAlpha = new Float32Array(TRAIL);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute('tint', new THREE.BufferAttribute(trailTint, 3));
  trailGeo.setAttribute('alpha', new THREE.BufferAttribute(trailAlpha, 1));
  const trailMat = bloodMat.clone();
  trailMat.uniforms.uSize.value *= 1.8;
  const trail = new THREE.Points(trailGeo, trailMat);
  trail.frustumCulled = false;
  trail.visible = false;
  heart.add(trail);

  // The tour is one trip, not a loop: in through the vena cava, out to the lungs (where the cell turns red),
  // back through the left side, then out of the aorta to the body, where it ends.
  const RIDE = [
    { flow: 'svc', first: 0, marks: [[[-0.8, 0.95, 0.02], 1], [VALVE_POS.tricuspidValve, 2], [VALVE_POS.pulmonaryValve, 3]] },
    { gap: 4, duration: 3.5, at: 'svc', from: POOR, to: RICH },
    { flow: 'lpv', first: 5, marks: [[VALVE_POS.mitralValve, 6], [VALVE_POS.aorticValve, 7]] },
    { gap: 8, duration: 3.5, at: 'lpv', from: RICH, to: POOR },
  ];
  RIDE.forEach((seg) => {
    if (seg.flow) seg.marks = seg.marks.map(([p, step]) => ({ u: uNear(flows[seg.flow], p), step }));
  });
  const ride = { active: false, seg: 0, u: 0, t: 0, step: -1 };
  let rideParts = new Set();
  let rideFade = 0;
  const riderColor = new THREE.Color();
  const tmpColor = new THREE.Color();

  // ---------- picking ----------
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hovered = null;
  let selected = null;
  let down = null;

  function visibleDeep(o) {
    for (; o; o = o.parent) if (!o.visible) return false;
    return true;
  }

  function pick(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickables, false).filter((h) => visibleDeep(h.object));
    if (!hits.length) return null;
    if (flowTarget === 1) {
      const v = hits.find((h) => PARTS[h.object.userData.part].kind === 'valve');
      if (v) return v.object.userData.part;
    }
    return hits[0].object.userData.part;
  }

  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
  canvas.addEventListener('pointerup', (e) => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) select(pick(e));
    down = null;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.buttons) return;
    hovered = pick(e);
    canvas.style.cursor = hovered ? 'pointer' : 'grab';
  });
  canvas.addEventListener('pointerleave', () => (hovered = null));

  function select(key) {
    selected = key || null;
    emit('select', selected);
  }

  // ---------- camera moves ----------
  let camTween = null;

  function tweenCamera(toOffset) {
    camTween = { from: camera.position.clone().sub(controls.target), to: toOffset, t: 0 };
    controls.autoRotate = false;
  }

  function focus(key) {
    const meshes = meshesByPart[key];
    if (!meshes) return;
    const box = new THREE.Box3();
    meshes.forEach((m) => box.expandByObject(m));
    const dir = box.getCenter(V()).sub(controls.target);
    dir.y = 0;
    if (dir.length() < 0.3) dir.copy(camera.position).sub(controls.target).setY(0);
    dir.normalize();
    if (dir.z > -0.4) dir.add(V(0, 0, 0.8)).normalize();
    dir.y = 0.22;
    tweenCamera(dir.normalize().multiplyScalar(camera.position.distanceTo(controls.target)));
  }

  function zoom(factor) {
    const offset = camera.position.clone().sub(controls.target);
    const len = THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance);
    tweenCamera(offset.setLength(len));
  }

  // ---------- state ----------
  let flowTarget = 1;
  let flowAmt = 1;
  let electric = false;

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    // Fit the heart to whatever space the viewer has: leave room for the overlay panels on a tall
    // viewer, and fill a short one (on phones the panels move out of the way when a card is open).
    const dist = HOME.distanceTo(TARGET);
    const fitHeight = h < 480 ? 4.3 : 5.3;
    const fitWidth = 3.6;
    const vFov = 2 * Math.atan(fitHeight / 2 / dist);
    const wFov = 2 * Math.atan(fitWidth / 2 / dist / camera.aspect);
    camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(Math.max(vFov, wFov)), 20, 62);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  const tmp = V(0, 0, 0);

  function update(dt, cyc, clock) {
    const t = performance.now() / 1000;
    const run = clock.playing ? dt : 0;
    const rate = clock.bpm / 72;
    flowAmt += (flowTarget - flowAmt) * Math.min(1, dt * 5);

    // Beating: atria first, then the ventricles (with a slight wringing twist).
    const a = cyc.atria;
    const v = cyc.ventricles;
    ventricles.scale.set(1 - 0.07 * v, 1 - 0.1 * v, 1 - 0.07 * v);
    ventricles.rotation.y = 0.05 * v;
    ra.scale.setScalar(1 - 0.12 * a);
    la.scale.setScalar(1 - 0.12 * a);

    for (const mat of Object.values(materials)) {
      const isValve = valves.some((vv) => vv.mat === mat);
      mat.opacity = isValve ? flowAmt * mat.userData.flowOpacity : THREE.MathUtils.lerp(1, mat.userData.flowOpacity, flowAmt);
      mat.depthWrite = mat.opacity > 0.97;
    }

    for (const vv of valves) {
      vv.group.visible = flowAmt > 0.03;
      vv.open += ((vv.kind === 'av' ? cyc.avOpen : cyc.slOpen) - vv.open) * Math.min(1, dt * 18);
      for (const l of vv.leaflets) l.pivot.quaternion.setFromAxisAngle(l.axis, l.sign * vv.open * 1.25);
    }

    // Blood surges when the chambers squeeze and trickles while they refill.
    const speed = (0.3 + 1.5 * v + 0.45 * a) * rate;
    // During the tour the general flow fades out so only the one blood cell is moving.
    rideFade += ((ride.active ? 1 : 0) - rideFade) * Math.min(1, dt * 4);
    const ambient = flowAmt * (1 - rideFade);
    bloodMat.uniforms.uOpacity.value = ambient;
    for (const f of Object.values(flows)) {
      f.points.visible = ambient > 0.02;
      f.progress = (f.progress + (speed * run) / f.length) % 1;
      for (let i = 0; i < f.count; i++) {
        const u = (f.offsets[i] + f.progress) % 1;
        pointOnTable(f.table, u, tmp).add(f.jitter[i]);
        f.positions[i * 3] = tmp.x;
        f.positions[i * 3 + 1] = tmp.y;
        f.positions[i * 3 + 2] = tmp.z;
        f.alphas[i] = THREE.MathUtils.smoothstep(u, 0, 0.05) * (1 - THREE.MathUtils.smoothstep(u, 0.93, 1));
      }
      f.geo.attributes.position.needsUpdate = true;
      f.geo.attributes.alpha.needsUpdate = true;
    }

    // Electrical signal: SA node → AV node (short pause) → down the septum to the apex.
    const p = cyc.p;
    let eAtria = 0;
    let eVent = 0;
    spark.visible = electric && p < 0.26;
    if (spark.visible) {
      if (p < 0.1) spark.position.lerpVectors(SA, AV, p / 0.1);
      else if (p < 0.13) spark.position.copy(AV);
      else spark.position.lerpVectors(AV, APEX, Math.min(1, (p - 0.13) / 0.07));
      spark.material.opacity = p > 0.2 ? 1 - (p - 0.2) / 0.06 : 1;
      spark.scale.setScalar(p >= 0.1 && p < 0.13 ? 0.38 + 0.12 * Math.sin(t * 40) : 0.5);
      eAtria = p < 0.12 ? Math.sin((Math.PI * p) / 0.12) : 0;
      eVent = p > 0.13 && p < 0.26 ? Math.sin((Math.PI * (p - 0.13)) / 0.13) : 0;
    }

    updateRide(run, cyc, rate);

    // Highlights: selected part pulses, ride parts glow, hover tints; electricity flashes yellow.
    for (const [key, mat] of Object.entries(materials)) {
      let h = 0;
      if (key === selected) h = 0.45 + 0.15 * Math.sin(t * 5);
      else if (rideParts.has(key)) h = 0.38 + 0.12 * Math.sin(t * 5);
      else if (key === hovered) h = 0.22;
      let e = 0;
      if (key === 'rightAtrium' || key === 'leftAtrium') e = eAtria;
      if (key === 'rightVentricle' || key === 'leftVentricle') e = eVent;
      e *= 0.55;
      mat.emissive.setRGB(0.6 * h + e, 0.36 * h + 0.8 * e, 0.24 * h + 0.1 * e);
    }

    if (camTween) {
      camTween.t = Math.min(1, camTween.t + dt / 1.1);
      const k = camTween.t * camTween.t * (3 - 2 * camTween.t);
      const off = camTween.from.clone().lerp(camTween.to, k);
      off.setLength(THREE.MathUtils.lerp(camTween.from.length(), camTween.to.length(), k));
      camera.position.copy(controls.target).add(off);
      if (camTween.t >= 1) camTween = null;
    }
    controls.update();
    heart.updateMatrixWorld();
    renderer.render(scene, camera);
  }

  function updateRide(run, cyc, rate) {
    rider.visible = false;
    trail.visible = false;
    riderLight.intensity = 0;
    if (!ride.active) return;
    const seg = RIDE[ride.seg];
    let step;
    if (seg.flow) {
      const f = flows[seg.flow];
      // Slow and steady, with a small push on every squeeze, so it is easy to follow.
      ride.u += ((0.25 + 0.5 * cyc.ventricles + 0.15 * cyc.atria) * rate * run) / f.length;
      if (ride.u >= 1) return nextSegment();
      step = seg.first;
      for (const m of seg.marks) if (ride.u >= m.u) step = m.step;
      pointOnTable(f.table, ride.u, rider.position);
      riderColor.setHex(f.color);
      drawTrail(f, ride.u);
    } else {
      ride.t += run;
      if (ride.t >= seg.duration) return nextSegment();
      step = seg.gap;
      // Waits at the edge of the picture while it visits the lungs or body, changing colour as it swaps gases.
      pointOnTable(flows[seg.at].table, 0.96, rider.position);
      riderColor.setHex(seg.from).lerp(tmpColor.setHex(seg.to), THREE.MathUtils.smoothstep(ride.t / seg.duration, 0.2, 0.8));
    }
    rider.visible = true;
    rider.material.color.copy(riderColor);
    rider.scale.setScalar(0.65 + 0.12 * cyc.ventricles);
    riderLight.position.copy(rider.position);
    riderLight.color.copy(riderColor);
    riderLight.intensity = 5;
    if (step !== ride.step) {
      ride.step = step;
      rideParts = new Set(JOURNEY[step].parts);
      emit('rideStep', step);
    }
  }

  function drawTrail(f, u) {
    trail.visible = true;
    for (let i = 0; i < TRAIL; i++) {
      const tu = u - i * 0.004;
      pointOnTable(f.table, Math.max(0, tu), tmp);
      trailPos.set([tmp.x, tmp.y, tmp.z], i * 3);
      trailTint.set([riderColor.r, riderColor.g, riderColor.b], i * 3);
      trailAlpha[i] = tu < 0 ? 0 : 1 - i / TRAIL;
    }
    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.attributes.tint.needsUpdate = true;
    trailGeo.attributes.alpha.needsUpdate = true;
  }

  function nextSegment() {
    if (ride.seg === RIDE.length - 1) {
      endRide();
      emit('rideDone');
      return;
    }
    ride.seg++;
    ride.u = 0;
    ride.t = 0;
  }

  function endRide() {
    ride.active = false;
    ride.step = -1;
    rideParts = new Set();
  }

  return {
    update,
    on: (name, cb) => listeners[name].push(cb),
    select,
    focus,
    zoom,
    resetView: () => tweenCamera(HOME.clone().sub(controls.target)),
    setMode: (mode) => (flowTarget = mode === 'flow' ? 1 : 0),
    setElectric: (on) => (electric = on),
    highlight: (keys) => (rideParts = new Set(keys)),
    startRide() {
      Object.assign(ride, { active: true, seg: 0, u: 0, t: 0, step: -1 });
      flowTarget = 1;
      tweenCamera(HOME.clone().sub(controls.target)); // start from the familiar front view
    },
    stopRide() {
      endRide();
      emit('rideEnd');
    },
    get riding() {
      return ride.active;
    },
  };
};
