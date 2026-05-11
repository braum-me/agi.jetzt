/**
 * Premium UI enhancements:
 * - Split-Text reveal on scroll
 * - 3D tilt + spotlight on cards
 * - Enhanced magnetic pull on buttons
 * - Parallax watermarks
 */

/* ═══════════════════════════════════════════════════════════════════
   Split Text Reveal
═══════════════════════════════════════════════════════════════════ */

export function initSplitTextReveal() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Only h2 headlines — h1 has too many edge cases (italic em, scramble, etc.)
  const headlines = document.querySelectorAll<HTMLElement>('h2:not([data-no-split])');

  headlines.forEach((el) => {
    // Skip if already split, or contains interactive elements
    if (el.dataset.split) return;
    if (el.querySelector('button, a, input')) return;
    el.dataset.split = '1';

    // Split by words to preserve semantic spacing, then by chars within words
    const original = el.innerHTML;
    // Replace text nodes (not existing tags) with span-wrapped chars
    const walk = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        return text
          .split(' ')
          .map((word) => {
            if (!word) return '';
            const chars = [...word]
              .map(
                (char) =>
                  `<span class="split-char" style="display: inline-block; opacity: 0; transform: translateY(0.5em) rotateX(-40deg); filter: blur(4px); transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1), filter 0.8s;">${char}</span>`
              )
              .join('');
            return `<span class="split-word" style="display: inline-block; white-space: nowrap;">${chars}</span>`;
          })
          .join(' ');
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const elem = node as HTMLElement;
        const tag = elem.tagName.toLowerCase();
        // Don't split inside gradient-text — inline-block spans break
        // background-clip:text. Keep the element as-is.
        if (elem.classList.contains('gradient-text')) {
          return elem.outerHTML;
        }
        const attrs = [...elem.attributes]
          .map((a) => `${a.name}="${a.value}"`)
          .join(' ');
        const childHtml = [...elem.childNodes].map(walk).join('');
        return `<${tag}${attrs ? ' ' + attrs : ''}>${childHtml}</${tag}>`;
      }
      return '';
    };

    const split = [...el.childNodes].map(walk).join('');
    el.innerHTML = split;
    el.style.perspective = '1000px';

    // IntersectionObserver: reveal chars in stagger
    const chars = el.querySelectorAll<HTMLElement>('.split-char');
    let revealed = false;

    const reveal = () => {
      if (revealed) return;
      revealed = true;
      chars.forEach((c, i) => {
        setTimeout(() => {
          c.style.opacity = '1';
          c.style.transform = 'translateY(0) rotateX(0)';
          c.style.filter = 'blur(0)';
        }, i * 18);
      });
    };

    // If already in viewport on page load, reveal immediately
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setTimeout(reveal, 100);
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            reveal();
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    io.observe(el);

    // Safety fallback: force visible after 4s regardless
    setTimeout(() => {
      if (!revealed) {
        chars.forEach((c) => {
          c.style.opacity = '1';
          c.style.transform = 'translateY(0) rotateX(0)';
          c.style.filter = 'blur(0)';
        });
      }
    }, 4000);
  });
}

/* ═══════════════════════════════════════════════════════════════════
   3D Tilt + Spotlight Cards
═══════════════════════════════════════════════════════════════════ */

export function init3DTilt() {
  if (window.matchMedia('(hover: none)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const selectors = [
    '.news-card',
    '.landscape-card',
    '.proximity-card',
    '.stage-card',
    '.landscape-category article',
    '.paper-elevated',
  ];

  const cards = document.querySelectorAll<HTMLElement>(selectors.join(', '));
  const processed = new WeakSet<HTMLElement>();

  cards.forEach((card) => {
    if (processed.has(card)) return;
    processed.add(card);

    // Skip nested cards (only outer)
    const parent = card.parentElement;
    if (parent && cards && [...cards].some((c) => c !== card && c.contains(card))) return;

    card.style.transformStyle = 'preserve-3d';
    card.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';

    // Add spotlight overlay
    const spotlight = document.createElement('div');
    spotlight.className = 'card-spotlight';
    spotlight.style.cssText = `
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s;
      background: radial-gradient(circle 200px at var(--mx, 50%) var(--my, 50%), rgba(167, 139, 250, 0.15), transparent 60%);
      z-index: 1;
    `;
    // Make sure card has position
    if (getComputedStyle(card).position === 'static') {
      card.style.position = 'relative';
    }
    card.appendChild(spotlight);

    const onMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const rotateY = ((x - cx) / cx) * 3;
      const rotateX = -((y - cy) / cy) * 3;

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(0)`;

      // Spotlight position
      spotlight.style.setProperty('--mx', `${x}px`);
      spotlight.style.setProperty('--my', `${y}px`);
      spotlight.style.opacity = '1';
    };

    const onLeave = () => {
      card.style.transform = '';
      spotlight.style.opacity = '0';
    };

    card.addEventListener('mousemove', onMove);
    card.addEventListener('mouseleave', onLeave);
  });
}

/* ═══════════════════════════════════════════════════════════════════
   Enhanced Magnetic Pull
═══════════════════════════════════════════════════════════════════ */

export function initMagneticEnhanced() {
  if (window.matchMedia('(hover: none)').matches) return;

  // Auto-apply to primary buttons + CTAs
  const targets = document.querySelectorAll<HTMLElement>(
    '.btn-primary, .btn-secondary, [data-magnetic]'
  );

  targets.forEach((el) => {
    if (el.dataset.magBound) return;
    el.dataset.magBound = '1';
    el.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
    const strength = parseFloat(el.dataset.magnetic || '0.3');
    const range = 100; // px within which magnetic pull kicks in

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > range) {
        el.style.transform = '';
        return;
      }

      const pull = (1 - dist / range) * 20 * strength;
      const px = (dx / dist) * pull;
      const py = (dy / dist) * pull;
      el.style.transform = `translate(${px}px, ${py}px)`;
    };

    const onLeave = () => {
      el.style.transform = '';
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    el.addEventListener('mouseleave', onLeave);
  });
}

/* ═══════════════════════════════════════════════════════════════════
   Parallax Watermarks
═══════════════════════════════════════════════════════════════════ */

export function initParallaxWatermarks() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const watermarks = document.querySelectorAll<HTMLElement>('[data-parallax]');

  const onScroll = () => {
    watermarks.forEach((el) => {
      const speed = parseFloat(el.dataset.parallax || '0.3');
      const rect = el.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const offset = (window.innerHeight / 2 - mid) * speed;
      el.style.transform = `translateY(${offset}px)`;
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ═══════════════════════════════════════════════════════════════════
   Scroll Progress Indicator in Cursor Ring (context aware)
═══════════════════════════════════════════════════════════════════ */

export function initScrollSnap() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // Smooth scroll snap for section anchors — deferred natively via scroll-behavior: smooth
}
