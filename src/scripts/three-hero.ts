// Selektive Imports statt `import * as THREE` → ~150 KB Bundle-Ersparnis
// (Vite/Rollup kann den Three.js-Namespace bei Wildcard-Import nicht tree-shaken).
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  LineBasicMaterial,
  LineSegments,
  NormalBlending,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';

/**
 * AI Brain — Living · Story-Driven · Data-Reactive.
 *
 * SYSTEMS:
 *   1. Brain Regions — Particles tagged as frontal/parietal/temporal/cerebellum/stem
 *   2. Scroll States — Brain mood shifts per section (calm, awakening, thinking, reactive, warning)
 *   3. Synaptic Storms — Every 8-12s a brain region lights up (hot zone)
 *   4. Data Pulses — News/events trigger pulses from source nodes
 *   5. Gamma Waves — Subtle 40Hz breathing through all particles
 *   6. Mouse Stimulation — Cursor activates nearby region
 *   7. Color Morphing — Brain tint shifts based on state (burgundy for risks)
 *   8. Regional Activity — Pulses concentrate in active regions
 *
 * EXPORTS:
 *   - initNeuralMesh(canvas) → starts the brain
 *   - window.brainTrigger(type, opts?) → programmatic data pulse triggers
 */

type Region = 'frontal' | 'parietal' | 'temporal' | 'cerebellum' | 'stem';

interface ParticleData {
  ox: number; oy: number; oz: number;
  vx: number; vy: number; vz: number;
  phase: number;
  isHub: boolean;
  region: Region;
  baseColorIdx: number;
  activity: number; // 0-1 — driven by scroll state + storms
}

interface Pulse {
  fromIdx: number;
  toIdx: number;
  progress: number;
  speed: number;
  color: Color;
  size: number;
}

interface Storm {
  region: Region;
  strength: number;   // 0-1, decaying
  startTime: number;
}

/**
 * Point-in-brain-profile tests, with region-tagging.
 */
function brainRegionAt(x: number, y: number): Region | null {
  const X = x / 100;
  const Y = y / 100;

  const frontal = ((X - 0.55) / 0.95) ** 2 + ((Y - 0.05) / 0.85) ** 2 < 1;
  const parietal = ((X + 0.45) / 1.05) ** 2 + ((Y - 0.25) / 0.75) ** 2 < 1;
  const temporal = ((X - 0.1) / 0.85) ** 2 + ((Y + 0.5) / 0.5) ** 2 < 1;
  const cerebellum = ((X + 0.95) / 0.45) ** 2 + ((Y + 0.45) / 0.4) ** 2 < 1;
  const stem =
    X > -1.05 && X < -0.65 &&
    Y < -0.45 && Y > -1.3 &&
    Math.abs(X + 0.85) < 0.2 - (Y + 0.45) * 0.15;

  // Priority order matters for overlaps
  if (stem) return 'stem';
  if (cerebellum) return 'cerebellum';
  if (temporal && Y < -0.2) return 'temporal';
  if (frontal && X > 0.3) return 'frontal';
  if (parietal) return 'parietal';
  if (frontal) return 'frontal';
  if (temporal) return 'temporal';
  return null;
}

export function initNeuralMesh(canvas: HTMLCanvasElement): () => void {
  const isMobile = window.innerWidth < 768;
  // MAX values — always allocated. Active-count scroll-driven.
  const particleCount = isMobile ? 900 : 2000;
  const maxConnectionDistance = isMobile ? 36 : 40;
  const maxConnections = isMobile ? 3500 : 10000;

  // Starting values (Hero = baby brain, full scroll = evolved brain)
  const MIN_ACTIVE_FRACTION = 0.35;  // start with 35% of particles visible
  const MIN_CONNECTION_DIST = isMobile ? 24 : 22;  // start with shorter reach

  // ── Scene Setup ──
  const scene = new Scene();
  const camera = new PerspectiveCamera(
    50, canvas.clientWidth / canvas.clientHeight, 1, 1000
  );
  camera.position.set(0, 0, 380);

  // Passt FOV so an, dass das gesamte Gehirn (Breite ~320) auch auf Portrait-
  // Screens (schmales Aspect-Ratio) vollständig sichtbar ist. Auf Desktop
  // landscape greift das nicht.
  const fitBrainToCanvas = () => {
    const aspect = Math.max(0.01, canvas.clientWidth / canvas.clientHeight);
    const brainWidth = 360; // Brain + etwas Padding
    const z = camera.position.z;
    const requiredHalfFovTan = brainWidth / 2 / (z * aspect);
    const requiredFovDeg = 2 * Math.atan(requiredHalfFovTan) * (180 / Math.PI);
    camera.fov = Math.max(50, Math.min(95, requiredFovDeg));
    camera.updateProjectionMatrix();
  };
  fitBrainToCanvas();

  const renderer = new WebGLRenderer({
    canvas, antialias: !isMobile, alpha: true, powerPreference: 'high-performance',
  });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  // ── Particle Generation with Region Tagging ──
  const positions = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  const colors = new Float32Array(particleCount * 3);
  const activities = new Float32Array(particleCount); // per-particle activity for shader
  const dataArr: ParticleData[] = [];

  // Palette: regular + burgundy-shift (for risk state) pre-interpolated
  const palette = [
    new Color(0x5b3aa3),
    new Color(0x3d2670),
    new Color(0x7a55cc),
    new Color(0x8b2c4d),
  ];

  // Track regional particle index lists
  const regionIndices: Record<Region, number[]> = {
    frontal: [], parietal: [], temporal: [], cerebellum: [], stem: [],
  };

  let placed = 0;
  let attempts = 0;
  const maxAttempts = particleCount * 80;

  while (placed < particleCount && attempts < maxAttempts) {
    attempts++;
    const x = (Math.random() - 0.5) * 320;
    const y = (Math.random() - 0.5) * 240;
    const region = brainRegionAt(x, y);
    if (!region) continue;

    const distFromCenter = Math.sqrt(x * x + y * y);
    const isEdge = distFromCenter > 80;
    if (!isEdge && Math.random() > 0.25) continue;

    const z = (Math.random() - 0.5) * 25;
    positions[placed * 3] = x;
    positions[placed * 3 + 1] = y;
    positions[placed * 3 + 2] = z;

    const isHub = Math.random() < 0.08;
    sizes[placed] = isHub ? 3.5 + Math.random() * 1.8 : 1.6 + Math.random() * 1.0;

    const colorIdx = isHub
      ? Math.random() < 0.65 ? 0 : 3
      : Math.random() < 0.5 ? 0 : 1;
    const c = palette[colorIdx];
    colors[placed * 3] = c.r;
    colors[placed * 3 + 1] = c.g;
    colors[placed * 3 + 2] = c.b;
    activities[placed] = 0.4;

    regionIndices[region].push(placed);

    dataArr.push({
      ox: x, oy: y, oz: z,
      vx: 0, vy: 0, vz: 0,
      phase: Math.random() * Math.PI * 2,
      isHub, region, baseColorIdx: colorIdx,
      activity: 0.4,
    });

    placed++;
  }

  console.log(`[brain] ${placed}/${particleCount} particles`);
  console.log(`[brain] regions: frontal=${regionIndices.frontal.length}, parietal=${regionIndices.parietal.length}, temporal=${regionIndices.temporal.length}, cerebellum=${regionIndices.cerebellum.length}, stem=${regionIndices.stem.length}`);

  // ── Shader with activity-driven glow ──
  const particleGeometry = new BufferGeometry();
  particleGeometry.setAttribute('position', new BufferAttribute(positions, 3));
  particleGeometry.setAttribute('size', new BufferAttribute(sizes, 1));
  particleGeometry.setAttribute('aColor', new BufferAttribute(colors, 3));
  particleGeometry.setAttribute('aActivity', new BufferAttribute(activities, 1));

  const particleMaterial = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uGamma: { value: 0 },      // 40Hz gamma wave
      uGlobalTint: { value: new Color(1, 1, 1) }, // color shift
    },
    vertexShader: `
      attribute float size;
      attribute vec3 aColor;
      attribute float aActivity;
      varying float vDepth;
      varying vec3 vColor;
      varying float vActivity;
      uniform float uGamma;
      void main() {
        vColor = aColor;
        vActivity = aActivity;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vDepth = clamp(-mvPosition.z / 400.0, 0.0, 1.0);
        // Gamma pulse: subtle size modulation at 40hz
        float gammaBoost = 1.0 + uGamma * 0.15 * aActivity;
        gl_PointSize = size * gammaBoost * (320.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying float vDepth;
      varying vec3 vColor;
      varying float vActivity;
      uniform vec3 uGlobalTint;
      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float dist = length(uv);
        if (dist > 0.5) discard;
        // Activity < 0.05 = invisible (scroll-evolution inactive)
        if (vActivity < 0.05) discard;
        float core = smoothstep(0.5, 0.0, dist);
        float alpha = pow(core, 1.4) * (0.85 + 0.15 * vActivity);
        alpha *= 0.7 + 0.3 * (1.0 - vDepth);
        // Fade-in for newly activated particles
        alpha *= smoothstep(0.05, 0.3, vActivity);
        vec3 finalColor = mix(vColor, vColor * uGlobalTint, 0.5);
        finalColor += vec3(0.2, 0.1, 0.3) * vActivity * core;
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
  });

  const particles = new Points(particleGeometry, particleMaterial);
  scene.add(particles);

  // ── Connections (dynamic, rebuilt each frame) ──
  const lineGeometry = new BufferGeometry();
  const linePositions = new Float32Array(maxConnections * 6);
  const lineColorsArr = new Float32Array(maxConnections * 6);
  lineGeometry.setAttribute('position', new BufferAttribute(linePositions, 3));
  lineGeometry.setAttribute('color', new BufferAttribute(lineColorsArr, 3));

  const lineMaterial = new LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.5,
    blending: NormalBlending,
    depthWrite: false,
  });
  const lines = new LineSegments(lineGeometry, lineMaterial);
  scene.add(lines);

  // ── Pulses System ──
  const maxPulses = isMobile ? 30 : 60;
  const pulseGeo = new BufferGeometry();
  const pulsePositions = new Float32Array(maxPulses * 3);
  const pulseColors = new Float32Array(maxPulses * 3);
  const pulseSizes = new Float32Array(maxPulses);
  pulseGeo.setAttribute('position', new BufferAttribute(pulsePositions, 3));
  pulseGeo.setAttribute('color', new BufferAttribute(pulseColors, 3));
  pulseGeo.setAttribute('size', new BufferAttribute(pulseSizes, 1));

  const pulseMat = new ShaderMaterial({
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (320.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float dist = length(uv);
        if (dist > 0.5) discard;
        float core = smoothstep(0.5, 0.0, dist);
        gl_FragColor = vec4(vColor, pow(core, 1.5));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
  });

  const pulseObj = new Points(pulseGeo, pulseMat);
  scene.add(pulseObj);

  const pulses: Pulse[] = [];
  let activePairs: Array<[number, number]> = [];

  const palettePulse = {
    standard: new Color(0x8b2c4d),
    news: new Color(0x7a55cc),
    warning: new Color(0xc93458),
  };

  const spawnPulse = (color: Color = palettePulse.standard, size = 7, region?: Region) => {
    if (pulses.length >= maxPulses) return;
    let pairs = activePairs;
    if (region) {
      const rIdx = new Set(regionIndices[region]);
      pairs = activePairs.filter(([a, b]) => rIdx.has(a) || rIdx.has(b));
    }
    if (pairs.length === 0) return;
    const [a, b] = pairs[Math.floor(Math.random() * pairs.length)];
    pulses.push({
      fromIdx: a, toIdx: b,
      progress: 0,
      speed: 0.008 + Math.random() * 0.012,
      color: color.clone(),
      size,
    });
  };

  // ── Storm System (A) ──
  const storms: Storm[] = [];
  const regions: Region[] = ['frontal', 'parietal', 'temporal', 'cerebellum'];

  const triggerStorm = (region?: Region) => {
    const r = region || regions[Math.floor(Math.random() * regions.length)];
    storms.push({ region: r, strength: 1.0, startTime: performance.now() });

    // Burst of pulses in that region
    const burstCount = 8 + Math.floor(Math.random() * 6);
    for (let i = 0; i < burstCount; i++) {
      setTimeout(() => spawnPulse(palettePulse.standard, 8, r), i * 40);
    }
  };

  // Storm at random intervals 5-7s — häufiger für mehr "Leben"
  const stormInterval = setInterval(() => {
    triggerStorm();
  }, 5000 + Math.random() * 2000);

  // ── Scroll Evolution: Brain wächst beim Scrollen ──
  let scrollProgress = 0;  // 0 at top, 1 at bottom
  let activeParticles = Math.floor(placed * MIN_ACTIVE_FRACTION);
  let currentConnectionDist = MIN_CONNECTION_DIST;
  let brainScale = 1.0;

  const updateScrollEvolution = () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    scrollProgress = scrollable > 0 ? Math.min(1, window.scrollY / scrollable) : 0;

    // Particles grow from 35% → 100%
    const targetFraction = MIN_ACTIVE_FRACTION + (1 - MIN_ACTIVE_FRACTION) * scrollProgress;
    activeParticles = Math.floor(placed * targetFraction);

    // Connection distance grows with scroll
    currentConnectionDist = MIN_CONNECTION_DIST + (maxConnectionDistance - MIN_CONNECTION_DIST) * scrollProgress;

    // Brain grows visually
    brainScale = 1.0 + scrollProgress * 0.3;
  };
  window.addEventListener('scroll', updateScrollEvolution, { passive: true });
  updateScrollEvolution();

  // Regular pulse spawning (calm baseline)
  const pulseInterval = setInterval(() => {
    spawnPulse();
  }, 180);

  // ── Scroll State (B) ──
  type BrainState = 'calm' | 'awakening' | 'thinking' | 'reactive' | 'warning' | 'fade';
  let currentState: BrainState = 'calm';
  let globalTintTarget = new Color(1, 1, 1);
  let globalTintCurrent = new Color(1, 1, 1);
  let baselineActivity = 0.4;

  const sectionStates: Array<{ id: string; state: BrainState }> = [
    { id: 'hero', state: 'calm' },
    { id: 'stages', state: 'awakening' },
    { id: 'proximity', state: 'thinking' },
    { id: 'timeline', state: 'awakening' },
    { id: 'watchlist', state: 'thinking' },
    { id: 'news', state: 'reactive' },
    { id: 'landscape', state: 'thinking' },
    { id: 'risks', state: 'warning' },
    { id: 'about', state: 'fade' },
  ];

  const applyState = (s: BrainState) => {
    if (s === currentState) return;
    currentState = s;
    console.log('[brain] state:', s);
    switch (s) {
      case 'calm':
        globalTintTarget.setRGB(1, 1, 1);
        baselineActivity = 0.4;
        break;
      case 'awakening':
        globalTintTarget.setRGB(1.3, 1.0, 1.8);  // deep purple
        baselineActivity = 0.7;
        break;
      case 'thinking':
        globalTintTarget.setRGB(0.6, 1.4, 2.0);  // cyan/blue shift
        baselineActivity = 0.9;
        break;
      case 'reactive':
        globalTintTarget.setRGB(1.8, 1.2, 0.6);  // amber/golden
        baselineActivity = 0.85;
        triggerStorm('frontal');
        break;
      case 'warning':
        globalTintTarget.setRGB(2.5, 0.3, 0.6);  // DRAMATIC burgundy-red
        baselineActivity = 1.0;
        triggerStorm('frontal');
        setTimeout(() => triggerStorm('temporal'), 300);
        setTimeout(() => triggerStorm('parietal'), 600);
        break;
      case 'fade':
        globalTintTarget.setRGB(0.7, 0.8, 1.2);  // cool blue
        baselineActivity = 0.35;
        break;
    }
  };

  const updateStateFromScroll = () => {
    const vpMid = window.innerHeight / 2;
    let closest = { state: 'calm' as BrainState, dist: Infinity };
    for (const s of sectionStates) {
      const el = document.getElementById(s.id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const elMid = rect.top + rect.height / 2;
      const dist = Math.abs(elMid - vpMid);
      if (dist < closest.dist) {
        closest = { state: s.state, dist };
      }
    }
    applyState(closest.state);
  };
  window.addEventListener('scroll', updateStateFromScroll, { passive: true });
  updateStateFromScroll();

  // ── Public API: brainTrigger (D) ──
  // Exposes global trigger function for data-driven pulses
  (window as any).brainTrigger = (type: 'news' | 'warning' | 'thinking' = 'news', opts: { region?: Region; count?: number } = {}) => {
    const color = type === 'warning' ? palettePulse.warning : type === 'news' ? palettePulse.news : palettePulse.standard;
    const count = opts.count || 5;
    for (let i = 0; i < count; i++) {
      setTimeout(() => spawnPulse(color, 8, opts.region), i * 60);
    }
  };

  // Trigger news pulse on news-feed viewport intersection
  const newsSection = document.getElementById('news');
  if (newsSection) {
    const newsIO = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        for (let i = 0; i < 5; i++) {
          setTimeout(() => spawnPulse(palettePulse.news, 7, 'frontal'), i * 200);
        }
      }
    }, { threshold: 0.3 });
    newsIO.observe(newsSection);
  }

  // ── Mouse Stimulation (A) ──
  const mouseScreen = new Vector2(10000, 10000);
  const mouseWorld = new Vector3(10000, 10000, 0);

  // Cache canvas-rect — nur bei resize invalidieren (forced-reflow-Killer)
  let cachedRect: DOMRect = canvas.getBoundingClientRect();
  const invalidateRect = () => { cachedRect = canvas.getBoundingClientRect(); };

  const updateMouseWorld = () => {
    const r = cachedRect;
    const ndcX = ((mouseScreen.x - r.left) / r.width) * 2 - 1;
    const ndcY = -((mouseScreen.y - r.top) / r.height) * 2 + 1;
    const vec = new Vector3(ndcX, ndcY, 0.5);
    vec.unproject(camera);
    const dir = vec.sub(camera.position).normalize();
    const distance = -camera.position.z / dir.z;
    mouseWorld.copy(camera.position).add(dir.multiplyScalar(distance));
  };

  const onMouseMove = (e: MouseEvent) => {
    mouseScreen.set(e.clientX, e.clientY);
    updateMouseWorld();
  };

  if (!isMobile) {
    window.addEventListener('mousemove', onMouseMove, { passive: true });
  }
  // Scroll invalidates cached rect (canvas is fixed but layout may shift under it)
  window.addEventListener('scroll', invalidateRect, { passive: true });

  // ── Resize (read layout values once, then batch writes) ──
  const onResize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    camera.aspect = w / h;
    fitBrainToCanvas();
    renderer.setSize(w, h, false); // false: avoid setting canvas.style (already handled via CSS)
    invalidateRect();
  };
  window.addEventListener('resize', onResize);

  // ── Animation Loop ──
  let animationId: number;
  let time = 0;
  let connectionFrameSkip = 0;
  let lastTime = performance.now();

  const SPRING_K = 0.04;
  const DAMPING = 0.85;
  const MOUSE_RADIUS = 90;
  const MOUSE_FORCE = 2.5;

  const animate = () => {
    animationId = requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    time += 0.003;

    // Gamma wave (40Hz ~ 0.04s period)
    const gamma = Math.sin(time * 25) * 0.5 + 0.5;

    particleMaterial.uniforms.uTime.value = time;
    particleMaterial.uniforms.uGamma.value = gamma;

    // Smooth global tint — schneller für sichtbarere Transitions
    globalTintCurrent.r += (globalTintTarget.r - globalTintCurrent.r) * 0.1;
    globalTintCurrent.g += (globalTintTarget.g - globalTintCurrent.g) * 0.1;
    globalTintCurrent.b += (globalTintTarget.b - globalTintCurrent.b) * 0.1;
    particleMaterial.uniforms.uGlobalTint.value.copy(globalTintCurrent);

    // Decay storms
    for (let s = storms.length - 1; s >= 0; s--) {
      const storm = storms[s];
      const age = (now - storm.startTime) / 1000;
      storm.strength = Math.max(0, 1.0 - age / 3.5);
      if (storm.strength <= 0) storms.splice(s, 1);
    }

    // Update particles
    const pos = particleGeometry.attributes.position as BufferAttribute;
    const posArr = pos.array as Float32Array;
    const act = particleGeometry.attributes.aActivity as BufferAttribute;
    const actArr = act.array as Float32Array;

    for (let i = 0; i < placed; i++) {
      const i3 = i * 3;
      const d = dataArr[i];

      // Particles outside scroll-evolution active count fade OUT activity
      // (shader reads activity to determine alpha — 0 = invisible)
      const isActive = i < activeParticles;

      // Compute region-based activity boost
      let regionBoost = 0;
      for (const s of storms) {
        if (s.region === d.region) regionBoost += s.strength;
      }

      // Mouse stimulation boost
      let mouseBoost = 0;
      if (!isMobile) {
        const mdx = posArr[i3] - mouseWorld.x;
        const mdy = posArr[i3 + 1] - mouseWorld.y;
        const distSq = mdx * mdx + mdy * mdy;
        if (distSq < MOUSE_RADIUS * MOUSE_RADIUS && distSq > 0.01) {
          const dist = Math.sqrt(distSq);
          mouseBoost = (1 - dist / MOUSE_RADIUS) * 0.8;
          const force = (1 - dist / MOUSE_RADIUS) * MOUSE_FORCE;
          d.vx += (mdx / dist) * force;
          d.vy += (mdy / dist) * force;
        }
      }

      // Target activity
      const targetActivity = isActive
        ? Math.min(1, baselineActivity + regionBoost + mouseBoost)
        : 0;
      d.activity += (targetActivity - d.activity) * 0.08;
      actArr[i] = d.activity;

      // Breathing
      const breathX = Math.sin(time + d.phase) * (0.8 + regionBoost * 1.5);
      const breathY = Math.cos(time + d.phase * 1.3) * (0.6 + regionBoost * 1.2);

      // Spring to origin
      const targetX = d.ox + breathX;
      const targetY = d.oy + breathY;
      d.vx += (targetX - posArr[i3]) * SPRING_K;
      d.vy += (targetY - posArr[i3 + 1]) * SPRING_K;
      d.vz += (d.oz - posArr[i3 + 2]) * SPRING_K;

      d.vx *= DAMPING;
      d.vy *= DAMPING;
      d.vz *= DAMPING;

      posArr[i3] += d.vx;
      posArr[i3 + 1] += d.vy;
      posArr[i3 + 2] += d.vz;
    }

    pos.needsUpdate = true;
    act.needsUpdate = true;

    // Update connections every 2nd frame
    if (connectionFrameSkip++ % 2 === 0) {
      let lineIdx = 0;
      activePairs = [];
      const lp = lineGeometry.attributes.position as BufferAttribute;
      const lc = lineGeometry.attributes.color as BufferAttribute;
      const lpArr = lp.array as Float32Array;
      const lcArr = lc.array as Float32Array;

      for (let i = 0; i < activeParticles && lineIdx < maxConnections; i++) {
        const iIsHub = dataArr[i].isHub;
        const iMaxNeighbors = iIsHub ? 22 : 8;
        let neighbors = 0;

        for (let j = i + 1; j < activeParticles && lineIdx < maxConnections && neighbors < iMaxNeighbors; j++) {
          const dx = posArr[i * 3] - posArr[j * 3];
          const dy = posArr[i * 3 + 1] - posArr[j * 3 + 1];
          const dz = posArr[i * 3 + 2] - posArr[j * 3 + 2];
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < currentConnectionDist) {
            const idx = lineIdx * 6;
            lpArr[idx] = posArr[i * 3];
            lpArr[idx + 1] = posArr[i * 3 + 1];
            lpArr[idx + 2] = posArr[i * 3 + 2];
            lpArr[idx + 3] = posArr[j * 3];
            lpArr[idx + 4] = posArr[j * 3 + 1];
            lpArr[idx + 5] = posArr[j * 3 + 2];

            const strength = 1.0 - dist / currentConnectionDist;
            // Blend with global tint
            const r = 0.36 * strength * globalTintCurrent.r;
            const g = 0.23 * strength * globalTintCurrent.g;
            const b = 0.64 * strength * globalTintCurrent.b;
            lcArr[idx] = r; lcArr[idx + 1] = g; lcArr[idx + 2] = b;
            lcArr[idx + 3] = r; lcArr[idx + 4] = g; lcArr[idx + 5] = b;

            activePairs.push([i, j]);
            lineIdx++;
            neighbors++;
          }
        }
      }

      for (let k = lineIdx * 6; k < maxConnections * 6; k++) lpArr[k] = 0;

      lp.needsUpdate = true;
      lc.needsUpdate = true;
      lineGeometry.setDrawRange(0, lineIdx * 2);
    }

    // Update pulses
    const pp = pulseGeo.attributes.position as BufferAttribute;
    const pc = pulseGeo.attributes.color as BufferAttribute;
    const ps = pulseGeo.attributes.size as BufferAttribute;
    const ppArr = pp.array as Float32Array;
    const pcArr = pc.array as Float32Array;
    const psArr = ps.array as Float32Array;

    for (let p = pulses.length - 1; p >= 0; p--) {
      const pulse = pulses[p];
      pulse.progress += pulse.speed;
      if (pulse.progress >= 1) {
        pulses.splice(p, 1);
        continue;
      }
      const fx = posArr[pulse.fromIdx * 3];
      const fy = posArr[pulse.fromIdx * 3 + 1];
      const fz = posArr[pulse.fromIdx * 3 + 2];
      const tx = posArr[pulse.toIdx * 3];
      const ty = posArr[pulse.toIdx * 3 + 1];
      const tz = posArr[pulse.toIdx * 3 + 2];
      const t = pulse.progress;
      const i3 = p * 3;
      ppArr[i3] = fx + (tx - fx) * t;
      ppArr[i3 + 1] = fy + (ty - fy) * t;
      ppArr[i3 + 2] = fz + (tz - fz) * t;
      pcArr[i3] = pulse.color.r;
      pcArr[i3 + 1] = pulse.color.g;
      pcArr[i3 + 2] = pulse.color.b;
      psArr[p] = pulse.size;
    }
    for (let p = pulses.length; p < maxPulses; p++) {
      const i3 = p * 3;
      ppArr[i3] = 99999;
      ppArr[i3 + 1] = 99999;
      ppArr[i3 + 2] = 99999;
      psArr[p] = 0;
    }
    pp.needsUpdate = true;
    pc.needsUpdate = true;
    ps.needsUpdate = true;

    // Camera drift
    camera.position.x = Math.sin(time * 0.12) * 6;
    camera.position.y = Math.cos(time * 0.09) * 4;
    // Brain grows visually: camera z closer as user scrolls (380 → 280)
    const targetZ = 380 - 100 * scrollProgress;
    camera.position.z += (targetZ - camera.position.z) * 0.05;
    camera.lookAt(0, 0, 0);
    // Auf Portrait-Screens FOV mitziehen, damit Brain voll sichtbar bleibt
    if (canvas.clientWidth / canvas.clientHeight < 1.2) {
      fitBrainToCanvas();
    }

    renderer.render(scene, camera);
  };

  animate();

  return () => {
    cancelAnimationFrame(animationId);
    clearInterval(pulseInterval);
    clearInterval(stormInterval);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('scroll', updateStateFromScroll);
    particleGeometry.dispose();
    particleMaterial.dispose();
    lineGeometry.dispose();
    lineMaterial.dispose();
    pulseGeo.dispose();
    pulseMat.dispose();
    renderer.dispose();
  };
}
