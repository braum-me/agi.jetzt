/**
 * Global cursor glow + scroll progress + subtle interactions.
 * Attached once at app boot.
 */

export function initCursorEffects() {
  if (window.matchMedia('(hover: none)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // ── Cursor Glow ──
  const glow = document.createElement('div');
  glow.className = 'cursor-glow';
  glow.style.opacity = '0';
  document.body.appendChild(glow);

  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let currentX = targetX;
  let currentY = targetY;

  const onMove = (e: MouseEvent) => {
    targetX = e.clientX;
    targetY = e.clientY;
    glow.style.opacity = '1';
  };

  const onLeave = () => {
    glow.style.opacity = '0';
  };

  const loop = () => {
    // Smooth lerp for butter-soft movement
    currentX += (targetX - currentX) * 0.12;
    currentY += (targetY - currentY) * 0.12;
    glow.style.transform = `translate(${currentX}px, ${currentY}px) translate(-50%, -50%)`;
    requestAnimationFrame(loop);
  };

  window.addEventListener('mousemove', onMove, { passive: true });
  document.addEventListener('mouseleave', onLeave);
  requestAnimationFrame(loop);

  // Hide glow over interactive elements to prevent "double" feel
  document.querySelectorAll('a, button, input, textarea, [role="button"]').forEach((el) => {
    el.addEventListener('mouseenter', () => (glow.style.opacity = '0.3'));
    el.addEventListener('mouseleave', () => (glow.style.opacity = '1'));
  });
}

export function initScrollProgress() {
  const bar = document.createElement('div');
  bar.className = 'scroll-progress';
  document.body.appendChild(bar);

  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max > 0 ? window.scrollY / max : 0;
    bar.style.transform = `scaleX(${progress})`;
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/**
 * Magnetic effect for .magnetic elements.
 * Hovered element shifts slightly toward cursor.
 */
export function initMagneticButtons() {
  if (window.matchMedia('(hover: none)').matches) return;

  document.querySelectorAll<HTMLElement>('.magnetic').forEach((el) => {
    const strength = parseFloat(el.dataset.magnetic || '0.3');

    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
    });

    el.addEventListener('mouseleave', () => {
      el.style.transform = '';
    });
  });
}

/**
 * Text scramble effect — reveals final text via random chars.
 * Trigger with [data-scramble] attribute and .scramble-trigger on parent.
 */
const SCRAMBLE_CHARS = '!<>-_\\/[]{}—=+*^?#________';

export class TextScramble {
  private el: HTMLElement;
  private chars: string;
  private queue: Array<{ from: string; to: string; start: number; end: number; char?: string }> = [];
  private frameRequest = 0;
  private frame = 0;
  private resolve: () => void = () => {};

  constructor(el: HTMLElement, chars: string = SCRAMBLE_CHARS) {
    this.el = el;
    this.chars = chars;
  }

  setText(newText: string): Promise<void> {
    const oldText = this.el.innerText;
    const length = Math.max(oldText.length, newText.length);
    const promise = new Promise<void>((resolve) => (this.resolve = resolve));
    this.queue = [];

    for (let i = 0; i < length; i++) {
      const from = oldText[i] || '';
      const to = newText[i] || '';
      const start = Math.floor(Math.random() * 40);
      const end = start + Math.floor(Math.random() * 40);
      this.queue.push({ from, to, start, end });
    }

    cancelAnimationFrame(this.frameRequest);
    this.frame = 0;
    this.update();
    return promise;
  }

  private update = () => {
    let output = '';
    let complete = 0;

    for (let i = 0, n = this.queue.length; i < n; i++) {
      const item = this.queue[i];
      const { from, to, start, end } = item;
      let { char } = item;

      if (this.frame >= end) {
        complete++;
        output += to;
      } else if (this.frame >= start) {
        if (!char || Math.random() < 0.28) {
          char = this.chars[Math.floor(Math.random() * this.chars.length)];
          item.char = char;
        }
        output += `<span style="color: var(--color-accent);">${char}</span>`;
      } else {
        output += from;
      }
    }

    this.el.innerHTML = output;

    if (complete === this.queue.length) {
      this.resolve();
    } else {
      this.frameRequest = requestAnimationFrame(this.update);
      this.frame++;
    }
  };
}

export function initTextScramble() {
  document.querySelectorAll<HTMLElement>('[data-scramble]').forEach((el) => {
    const finalText = el.dataset.scramble || el.innerText;
    const scrambler = new TextScramble(el);

    // Trigger on viewport entry
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            scrambler.setText(finalText);
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
  });
}
