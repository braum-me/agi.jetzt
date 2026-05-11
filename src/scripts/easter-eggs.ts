/**
 * Easter Eggs for share-ability and joy.
 *
 * 1. Console message — for devs who open DevTools
 * 2. Konami Code → unlocks "godmode" with rainbow particles
 * 3. Triple-click on logo → secret message
 * 4. Page focus/blur → personality (welcome back / see you soon)
 */

export function initConsoleMessage() {
  const styleH = 'color: #a78bfa; font-family: "JetBrains Mono", monospace; font-size: 16px; font-weight: bold;';
  const styleP = 'color: #71717a; font-family: "Outfit", sans-serif; font-size: 13px; line-height: 1.6;';
  const styleA = 'color: #e879f9; font-family: "JetBrains Mono", monospace; font-size: 13px;';

  console.log('%c✦ agi.jetzt', styleH);
  console.log(
    '%cDu bist Entwickler:in?%c\nQuellcode: github.com/braum-me/agi.jetzt\nAuf der Suche nach jemandem, der mit KI Dinge baut?\n%clinkedin.com/in/stefanbraum · braum.consulting',
    styleP,
    styleP,
    styleA
  );
  console.log('%c↳ Konami Code probieren. Du wirst es spüren.', 'color: #52525b; font-style: italic; font-size: 11px;');
}

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

export function initKonamiCode() {
  let pos = 0;

  document.addEventListener('keydown', (e) => {
    const expected = KONAMI[pos];
    if (e.key === expected || e.key.toLowerCase() === expected) {
      pos++;
      if (pos === KONAMI.length) {
        triggerKonami();
        pos = 0;
      }
    } else {
      pos = 0;
    }
  });
}

function triggerKonami() {
  // Visual celebration: rainbow flash + emoji rain
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 9999;
    pointer-events: none;
    background: radial-gradient(circle at center, rgba(167, 139, 250, 0.3), transparent 70%);
    animation: konami-flash 0.6s ease-out;
  `;
  document.body.appendChild(overlay);

  const style = document.createElement('style');
  style.textContent = `
    @keyframes konami-flash {
      0% { opacity: 0; transform: scale(0.5); }
      50% { opacity: 1; transform: scale(1.2); }
      100% { opacity: 0; transform: scale(2); }
    }
    @keyframes konami-emoji {
      0% { transform: translateY(-50px) rotate(0); opacity: 0; }
      10% { opacity: 1; }
      100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
    }
  `;
  document.head.appendChild(style);

  // Emoji rain
  const emojis = ['🤖', '🧠', '⚡', '✨', '🚀', '💎', '🌟', '🔮'];
  for (let i = 0; i < 50; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      el.style.cssText = `
        position: fixed;
        top: 0;
        left: ${Math.random() * 100}vw;
        font-size: ${20 + Math.random() * 30}px;
        z-index: 9998;
        pointer-events: none;
        animation: konami-emoji ${3 + Math.random() * 2}s linear forwards;
      `;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 5500);
    }, i * 80);
  }

  // Cleanup overlay
  setTimeout(() => overlay.remove(), 700);

  // Bonus: log message
  console.log('%c⚡ KONAMI MODE ENTBLÖSST ⚡', 'color: #e879f9; font-size: 24px; font-weight: bold; text-shadow: 0 0 20px #a78bfa;');
}

export function initLogoSecret() {
  const logo = document.querySelector<HTMLElement>('nav a[href="#hero"]');
  if (!logo) return;

  let clicks = 0;
  let timer: number;

  logo.addEventListener('click', (e) => {
    clicks++;
    clearTimeout(timer);
    timer = window.setTimeout(() => (clicks = 0), 800);

    if (clicks >= 3) {
      e.preventDefault();
      clicks = 0;
      const msg = document.createElement('div');
      msg.textContent = 'Du bist neugierig. Das gefällt mir.';
      msg.style.cssText = `
        position: fixed;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(15, 15, 24, 0.95);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(167, 139, 250, 0.4);
        color: #f4f4f6;
        font-family: 'Fraunces', serif;
        font-style: italic;
        font-size: 24px;
        padding: 32px 48px;
        border-radius: 24px;
        z-index: 9999;
        box-shadow: 0 20px 80px rgba(167, 139, 250, 0.3);
        animation: secret-msg 3s ease-out forwards;
      `;
      const style = document.createElement('style');
      style.textContent = `
        @keyframes secret-msg {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
          15%, 85% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1.05); }
        }
      `;
      document.head.appendChild(style);
      document.body.appendChild(msg);
      setTimeout(() => msg.remove(), 3100);
    }
  });
}

export function initFocusBlur() {
  let originalTitle = document.title;
  let blurred = false;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !blurred) {
      blurred = true;
      originalTitle = document.title;
      document.title = '👋 Bis später!';
    } else if (!document.hidden && blurred) {
      blurred = false;
      document.title = '✦ Schön, dass du da bist';
      setTimeout(() => (document.title = originalTitle), 2000);
    }
  });
}
