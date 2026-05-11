/**
 * AGI Countdown — counts down to the Metaculus median prediction date
 * for the first General AI: mid-2030.
 *
 * Target: 2030-07-01 00:00:00 UTC (Metaculus median).
 * Source: metaculus.com/questions/5121
 */

const AGI_TARGET = new Date('2030-07-01T00:00:00Z').getTime();

interface CountdownElements {
  years: HTMLElement;
  days: HTMLElement;
  hours: HTMLElement;
  minutes: HTMLElement;
  seconds: HTMLElement;
}

export function initAgiCountdown() {
  const root = document.querySelector<HTMLElement>('[data-countdown]');
  if (!root) return;

  const el: CountdownElements = {
    years: root.querySelector('[data-c="y"]')!,
    days: root.querySelector('[data-c="d"]')!,
    hours: root.querySelector('[data-c="h"]')!,
    minutes: root.querySelector('[data-c="m"]')!,
    seconds: root.querySelector('[data-c="s"]')!,
  };

  const update = () => {
    const now = Date.now();
    const diff = Math.max(0, AGI_TARGET - now);

    const secondsMs = 1000;
    const minuteMs = 60 * secondsMs;
    const hourMs = 60 * minuteMs;
    const dayMs = 24 * hourMs;
    const yearMs = 365.25 * dayMs;

    const years = Math.floor(diff / yearMs);
    const daysInYear = Math.floor((diff % yearMs) / dayMs);
    const hours = Math.floor((diff % dayMs) / hourMs);
    const minutes = Math.floor((diff % hourMs) / minuteMs);
    const seconds = Math.floor((diff % minuteMs) / secondsMs);

    // Years/Days ohne Leading-Zeros (natürliche Lesbarkeit).
    // Std/Min/Sek bleiben zweistellig — sonst springt das Layout.
    el.years.textContent = String(years);
    el.days.textContent = String(daysInYear);
    el.hours.textContent = String(hours).padStart(2, '0');
    el.minutes.textContent = String(minutes).padStart(2, '0');
    el.seconds.textContent = String(seconds).padStart(2, '0');
  };

  update();
  setInterval(update, 1000);
}
