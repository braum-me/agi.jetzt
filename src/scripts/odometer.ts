/**
 * Splitflap/Odometer animated number display.
 * Upgrades tabular-nums numbers with digit-by-digit rolling.
 */

export class Odometer {
  private el: HTMLElement;
  private digits: HTMLElement[] = [];
  private current: number = 0;
  private digitHeight: number;
  private duration: number;

  constructor(
    el: HTMLElement,
    opts: { digitHeight?: number; duration?: number } = {}
  ) {
    this.el = el;
    this.digitHeight = opts.digitHeight || parseFloat(getComputedStyle(el).fontSize);
    this.duration = opts.duration || 1800;
    this.init();
  }

  private init() {
    const initialText = this.el.textContent?.trim() || '0';
    this.el.innerHTML = '';
    this.el.style.display = 'inline-flex';
    this.el.style.lineHeight = `${this.digitHeight}px`;
    this.el.style.overflow = 'hidden';

    const chars = [...initialText];
    chars.forEach((char) => {
      const digit = document.createElement('span');
      digit.className = 'odometer-digit';
      digit.style.cssText = `
        display: inline-block;
        overflow: hidden;
        height: ${this.digitHeight}px;
        position: relative;
        vertical-align: top;
      `;

      if (/\d/.test(char)) {
        const col = document.createElement('span');
        col.className = 'odometer-col';
        col.style.cssText = `
          display: block;
          transition: transform 0.01s linear;
          will-change: transform;
        `;
        // 10 digits stacked
        for (let i = 0; i < 10; i++) {
          const d = document.createElement('span');
          d.textContent = String(i);
          d.style.display = 'block';
          d.style.height = `${this.digitHeight}px`;
          d.style.lineHeight = `${this.digitHeight}px`;
          col.appendChild(d);
        }
        digit.appendChild(col);
        digit.dataset.isDigit = '1';
        digit.dataset.target = char;
        // Initial position = 0
        col.style.transform = `translateY(-${parseInt(char, 10) * this.digitHeight}px)`;
      } else {
        digit.textContent = char;
        digit.style.overflow = 'visible';
      }
      this.el.appendChild(digit);
      this.digits.push(digit);
    });
  }

  setValue(value: string | number) {
    const text = String(value);
    const chars = [...text];

    // Ensure enough digits
    while (this.digits.length < chars.length) {
      const digit = document.createElement('span');
      digit.className = 'odometer-digit';
      digit.style.cssText = `
        display: inline-block;
        overflow: hidden;
        height: ${this.digitHeight}px;
        position: relative;
        vertical-align: top;
      `;
      const col = document.createElement('span');
      col.className = 'odometer-col';
      col.style.cssText = `display: block; will-change: transform;`;
      for (let i = 0; i < 10; i++) {
        const d = document.createElement('span');
        d.textContent = String(i);
        d.style.display = 'block';
        d.style.height = `${this.digitHeight}px`;
        d.style.lineHeight = `${this.digitHeight}px`;
        col.appendChild(d);
      }
      digit.appendChild(col);
      digit.dataset.isDigit = '1';
      digit.dataset.target = '0';
      this.el.appendChild(digit);
      this.digits.push(digit);
    }

    chars.forEach((char, i) => {
      const digitEl = this.digits[i];
      if (!digitEl) return;

      if (/\d/.test(char)) {
        const col = digitEl.querySelector<HTMLElement>('.odometer-col');
        if (!col) {
          // Rebuild digit
          digitEl.innerHTML = '';
          digitEl.style.overflow = 'hidden';
          const newCol = document.createElement('span');
          newCol.className = 'odometer-col';
          newCol.style.cssText = `display: block; will-change: transform;`;
          for (let j = 0; j < 10; j++) {
            const d = document.createElement('span');
            d.textContent = String(j);
            d.style.display = 'block';
            d.style.height = `${this.digitHeight}px`;
            d.style.lineHeight = `${this.digitHeight}px`;
            newCol.appendChild(d);
          }
          digitEl.appendChild(newCol);
          digitEl.dataset.isDigit = '1';
          newCol.style.transform = `translateY(-${parseInt(char, 10) * this.digitHeight}px)`;
          newCol.style.transition = `transform ${this.duration}ms cubic-bezier(0.16, 1, 0.3, 1)`;
        } else {
          col.style.transition = `transform ${this.duration}ms cubic-bezier(0.16, 1, 0.3, 1)`;
          // Small stagger delay per digit position
          col.style.transitionDelay = `${i * 60}ms`;
          requestAnimationFrame(() => {
            col.style.transform = `translateY(-${parseInt(char, 10) * this.digitHeight}px)`;
          });
        }
        digitEl.dataset.target = char;
      } else {
        digitEl.textContent = char;
        digitEl.style.overflow = 'visible';
        delete digitEl.dataset.isDigit;
      }
    });

    // Remove surplus digits
    while (this.digits.length > chars.length) {
      const extra = this.digits.pop();
      extra?.remove();
    }
  }
}

/**
 * Upgrades elements marked with data-odometer to use the rolling animation.
 * Expects data-odometer="initial_value" and will animate to data-target or text content.
 */
export function initOdometers() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.querySelectorAll<HTMLElement>('[data-odometer]').forEach((el) => {
    if (el.dataset.odoBound) return;
    el.dataset.odoBound = '1';

    const initial = el.dataset.odometer || el.textContent?.trim() || '0';
    el.textContent = initial;

    const target = el.dataset.target ? String(el.dataset.target) : el.textContent?.trim() || '0';

    const odo = new Odometer(el, {
      digitHeight: parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize),
      duration: parseInt(el.dataset.odoDuration || '2000', 10),
    });

    // Animate on viewport enter
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setTimeout(() => odo.setValue(target), 150);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.3 }
    );
    io.observe(el);

    // Expose updater
    (el as any).__odo = odo;
  });
}

// Global reference for dynamic updates (e.g., Proximity counter)
export function updateOdometer(el: HTMLElement, value: string | number) {
  const odo = (el as any).__odo as Odometer | undefined;
  if (odo) odo.setValue(value);
  else el.textContent = String(value);
}
