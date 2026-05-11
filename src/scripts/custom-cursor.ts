/**
 * Context-aware custom cursor.
 * Small dot + ring, morphs based on hover target.
 */

export function initCustomCursor() {
  if (window.matchMedia('(hover: none)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Hide native cursor on html (can be overridden locally)
  document.documentElement.style.cursor = 'none';
  const style = document.createElement('style');
  style.textContent = `
    *:not(input):not(textarea) { cursor: none !important; }
    input, textarea { cursor: text !important; }
    @media (hover: none) { * { cursor: auto !important; } }
  `;
  document.head.appendChild(style);

  const dot = document.createElement('div');
  dot.className = 'cursor-dot';
  dot.style.cssText = `
    position: fixed;
    top: 0; left: 0;
    width: 6px; height: 6px;
    background: #0f0d0a;
    border-radius: 50%;
    pointer-events: none;
    z-index: 9999;
    transform: translate(-50%, -50%);
    transition: width 0.2s, height 0.2s, background 0.2s;
    will-change: transform;
    mix-blend-mode: difference;
  `;

  const ring = document.createElement('div');
  ring.className = 'cursor-ring';
  ring.style.cssText = `
    position: fixed;
    top: 0; left: 0;
    width: 32px; height: 32px;
    border: 1.5px solid rgba(15, 13, 10, 0.3);
    border-radius: 50%;
    pointer-events: none;
    z-index: 9998;
    transform: translate(-50%, -50%);
    transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1),
                height 0.3s cubic-bezier(0.16, 1, 0.3, 1),
                border-color 0.3s,
                background 0.3s;
    will-change: transform;
  `;

  const label = document.createElement('span');
  label.className = 'cursor-label';
  label.style.cssText = `
    position: fixed;
    top: 0; left: 0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #faf6ed;
    background: #0f0d0a;
    padding: 4px 10px;
    border-radius: 20px;
    pointer-events: none;
    z-index: 9999;
    opacity: 0;
    transform: translate(20px, 20px);
    transition: opacity 0.2s;
    white-space: nowrap;
  `;

  document.body.appendChild(dot);
  document.body.appendChild(ring);
  document.body.appendChild(label);

  let mx = window.innerWidth / 2;
  let my = window.innerHeight / 2;
  let rx = mx, ry = my;
  let dx = mx, dy = my;

  const onMove = (e: MouseEvent) => {
    mx = e.clientX;
    my = e.clientY;
  };

  const loop = () => {
    // Smooth lerp for ring (delayed)
    rx += (mx - rx) * 0.18;
    ry += (my - ry) * 0.18;
    // Dot follows 1:1 quickly
    dx += (mx - dx) * 0.55;
    dy += (my - dy) * 0.55;

    dot.style.transform = `translate(${dx}px, ${dy}px) translate(-50%, -50%)`;
    ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
    label.style.transform = `translate(${mx}px, ${my}px) translate(20px, 20px)`;

    requestAnimationFrame(loop);
  };

  window.addEventListener('mousemove', onMove, { passive: true });
  requestAnimationFrame(loop);

  const setState = (state: 'default' | 'hover' | 'link' | 'read' | 'interactive' | 'text', text?: string) => {
    switch (state) {
      case 'hover':
        ring.style.width = '48px';
        ring.style.height = '48px';
        ring.style.borderColor = 'rgba(91, 58, 163, 0.5)';
        ring.style.background = 'rgba(91, 58, 163, 0.05)';
        dot.style.width = '4px';
        dot.style.height = '4px';
        label.style.opacity = '0';
        break;
      case 'link':
        ring.style.width = '56px';
        ring.style.height = '56px';
        ring.style.borderColor = 'rgba(15, 13, 10, 0.6)';
        ring.style.background = 'rgba(15, 13, 10, 0.95)';
        dot.style.width = '0px';
        dot.style.height = '0px';
        label.textContent = text || 'Öffnen →';
        label.style.opacity = '1';
        label.style.background = '#faf6ed';
        label.style.color = '#0f0d0a';
        break;
      case 'read':
        ring.style.width = '80px';
        ring.style.height = '80px';
        ring.style.borderColor = 'rgba(91, 58, 163, 0.4)';
        ring.style.background = 'rgba(91, 58, 163, 0.08)';
        dot.style.width = '4px';
        dot.style.height = '4px';
        dot.style.background = '#5b3aa3';
        label.textContent = text || 'Weiterlesen';
        label.style.opacity = '1';
        label.style.background = '#5b3aa3';
        label.style.color = '#faf6ed';
        break;
      case 'interactive':
        ring.style.width = '64px';
        ring.style.height = '64px';
        ring.style.borderColor = 'rgba(139, 44, 77, 0.5)';
        ring.style.background = 'rgba(139, 44, 77, 0.08)';
        dot.style.width = '6px';
        dot.style.height = '6px';
        dot.style.background = '#8b2c4d';
        label.textContent = text || '✦ Interagieren';
        label.style.opacity = '1';
        label.style.background = '#8b2c4d';
        label.style.color = '#faf6ed';
        break;
      case 'text':
        ring.style.width = '4px';
        ring.style.height = '32px';
        ring.style.borderRadius = '2px';
        ring.style.borderColor = '#0f0d0a';
        ring.style.background = '#0f0d0a';
        dot.style.width = '0px';
        dot.style.height = '0px';
        label.style.opacity = '0';
        break;
      default:
        ring.style.width = '32px';
        ring.style.height = '32px';
        ring.style.borderRadius = '50%';
        ring.style.borderColor = 'rgba(15, 13, 10, 0.3)';
        ring.style.background = 'transparent';
        dot.style.width = '6px';
        dot.style.height = '6px';
        dot.style.background = '#0f0d0a';
        label.style.opacity = '0';
    }
  };

  // Selector-based state detection
  const watchTargets = () => {
    // Links with href (excluding nav/footer minor links)
    document.querySelectorAll<HTMLElement>('a[href]:not(nav a):not(footer a)').forEach((el) => {
      if (el.dataset.cursorBound) return;
      el.dataset.cursorBound = '1';

      const isCard = el.closest('.news-card, .landscape-card, .proximity-card, .timeline-slide, article');
      el.addEventListener('mouseenter', () => {
        if (isCard) {
          setState('read', 'Weiterlesen');
        } else {
          setState('link', el.textContent?.includes('→') ? 'Öffnen' : 'Öffnen →');
        }
      });
      el.addEventListener('mouseleave', () => setState('default'));
    });

    // Buttons
    document.querySelectorAll<HTMLElement>('button:not([data-cursor-bound])').forEach((el) => {
      el.dataset.cursorBound = '1';
      el.addEventListener('mouseenter', () => {
        setState('hover', 'Klick');
      });
      el.addEventListener('mouseleave', () => setState('default'));
    });

    // Interactive articles without direct href (clickable cards)
    document.querySelectorAll<HTMLElement>('.proximity-card:not([data-cursor-bound]), .stage-card:not([data-cursor-bound])').forEach((el) => {
      el.dataset.cursorBound = '1';
      el.addEventListener('mouseenter', () => setState('hover'));
      el.addEventListener('mouseleave', () => setState('default'));
    });

    // Three.js hero container
    document.querySelectorAll<HTMLElement>('#three-container:not([data-cursor-bound])').forEach((el) => {
      el.dataset.cursorBound = '1';
      el.addEventListener('mouseenter', () => setState('interactive', '✦ Neurons'));
      el.addEventListener('mouseleave', () => setState('default'));
    });
  };

  watchTargets();
  // Re-scan periodically for dynamic content
  const mo = new MutationObserver(() => watchTargets());
  mo.observe(document.body, { childList: true, subtree: true });

  // Click ripple effect
  document.addEventListener('click', (e) => {
    const ripple = document.createElement('div');
    ripple.style.cssText = `
      position: fixed;
      top: ${e.clientY}px; left: ${e.clientX}px;
      width: 20px; height: 20px;
      border-radius: 50%;
      background: transparent;
      border: 2px solid #5b3aa3;
      pointer-events: none;
      z-index: 9997;
      transform: translate(-50%, -50%) scale(0);
      animation: cursor-ripple 0.6s ease-out forwards;
    `;
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  });

  const rippleStyle = document.createElement('style');
  rippleStyle.textContent = `
    @keyframes cursor-ripple {
      0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
      100% { transform: translate(-50%, -50%) scale(5); opacity: 0; }
    }
  `;
  document.head.appendChild(rippleStyle);

  // Hide when leaving window
  document.addEventListener('mouseleave', () => {
    dot.style.opacity = '0';
    ring.style.opacity = '0';
  });
  document.addEventListener('mouseenter', () => {
    dot.style.opacity = '1';
    ring.style.opacity = '1';
  });
}
