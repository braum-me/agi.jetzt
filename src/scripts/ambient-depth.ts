import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
} from 'three';

export function initAmbientDepth(canvas: HTMLCanvasElement): () => void {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return () => {};

  const mobile = window.matchMedia('(max-width: 767px)').matches;
  const count = mobile ? 180 : 420;
  const scene = new Scene();
  const camera = new PerspectiveCamera(46, 1, 1, 900);
  camera.position.set(0, 0, 420);

  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.3 : 1.8));

  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const palette = [
    new Color(0x5b3aa3),
    new Color(0x8b2c4d),
    new Color(0xb8721c),
    new Color(0x2d5a3f),
  ];

  for (let i = 0; i < count; i++) {
    const layer = Math.random();
    const radius = 120 + Math.random() * (mobile ? 260 : 430);
    const angle = Math.random() * Math.PI * 2;
    const drift = (Math.random() - 0.5) * 90;
    positions[i * 3] = Math.cos(angle) * radius + drift;
    positions[i * 3 + 1] = Math.sin(angle) * radius * 0.54 + (Math.random() - 0.5) * 260;
    positions[i * 3 + 2] = -220 + layer * 360;
    sizes[i] = 1.4 + layer * (mobile ? 3 : 5) + Math.random() * 1.5;
    phases[i] = Math.random() * Math.PI * 2;

    const c = palette[Math.floor(Math.random() * palette.length)];
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
  geometry.setAttribute('aColor', new BufferAttribute(colors, 3));
  geometry.setAttribute('aPhase', new BufferAttribute(phases, 1));

  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uPointer: { value: new Vector2(0, 0) },
      uOpacity: { value: mobile ? 0.32 : 0.46 },
    },
    vertexShader: `
      attribute float aSize;
      attribute vec3 aColor;
      attribute float aPhase;
      uniform float uTime;
      uniform float uScroll;
      uniform vec2 uPointer;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec3 p = position;
        float wave = sin(uTime * 0.32 + aPhase + position.z * 0.012);
        p.x += wave * 10.0 + uPointer.x * (18.0 + position.z * 0.02);
        p.y += cos(uTime * 0.26 + aPhase) * 7.0 + uPointer.y * (14.0 + position.z * 0.018);
        p.z += sin(uTime * 0.16 + aPhase) * 16.0 + uScroll * 95.0;
        vColor = aColor;
        vAlpha = 0.3 + smoothstep(-240.0, 160.0, p.z) * 0.7;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = aSize * (420.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        float core = smoothstep(0.5, 0.02, d);
        float halo = smoothstep(0.5, 0.18, d) * 0.45;
        gl_FragColor = vec4(vColor, (core + halo) * vAlpha * uOpacity);
      }
    `,
  });

  const points = new Points(geometry, material);
  scene.add(points);

  let width = 0;
  let height = 0;
  let raf = 0;
  let pointerX = 0;
  let pointerY = 0;
  let targetPointerX = 0;
  let targetPointerY = 0;
  let scrollTarget = 0;
  let scrollValue = 0;

  const resize = () => {
    const nextWidth = Math.max(1, canvas.clientWidth || window.innerWidth);
    const nextHeight = Math.max(1, canvas.clientHeight || window.innerHeight);
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth;
    height = nextHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const updateScroll = () => {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    scrollTarget = Math.min(1, Math.max(0, window.scrollY / max));
  };

  const onPointer = (event: PointerEvent) => {
    targetPointerX = (event.clientX / window.innerWidth - 0.5) * 2;
    targetPointerY = -(event.clientY / window.innerHeight - 0.5) * 2;
  };

  const tick = (time: number) => {
    resize();
    pointerX += (targetPointerX - pointerX) * 0.045;
    pointerY += (targetPointerY - pointerY) * 0.045;
    scrollValue += (scrollTarget - scrollValue) * 0.035;

    material.uniforms.uTime.value = time * 0.001;
    material.uniforms.uScroll.value = scrollValue;
    material.uniforms.uPointer.value.set(pointerX, pointerY);
    points.rotation.z = Math.sin(time * 0.00008) * 0.04;
    points.rotation.y = pointerX * 0.035;
    points.rotation.x = -pointerY * 0.025;

    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('scroll', updateScroll, { passive: true });
  window.addEventListener('pointermove', onPointer, { passive: true });
  updateScroll();
  resize();
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    window.removeEventListener('scroll', updateScroll);
    window.removeEventListener('pointermove', onPointer);
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  };
}
