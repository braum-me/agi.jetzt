import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function initScrollAnimations() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Hero H1 reveal is handled by split-text enhancement instead

  // ── Generic section header reveal ──
  gsap.utils.toArray<HTMLElement>('section h2').forEach((h2) => {
    gsap.from(h2, {
      scrollTrigger: {
        trigger: h2,
        start: 'top 85%',
        toggleActions: 'play none none reverse',
      },
      y: 40,
      opacity: 0,
      duration: 1,
      ease: 'power3.out',
    });
  });

  // ── Stage cards (AGI definition) ──
  gsap.utils.toArray<HTMLElement>('.stage-card').forEach((card, i) => {
    gsap.from(card, {
      scrollTrigger: {
        trigger: card,
        start: 'top 85%',
        toggleActions: 'play none none reverse',
      },
      y: 60,
      opacity: 0,
      duration: 0.9,
      delay: i * 0.12,
      ease: 'power3.out',
    });
  });

  // ── Proximity cards ──
  gsap.utils.toArray<HTMLElement>('.proximity-card').forEach((card, i) => {
    gsap.from(card, {
      scrollTrigger: {
        trigger: card,
        start: 'top 90%',
        toggleActions: 'play none none reverse',
      },
      y: 40,
      opacity: 0,
      duration: 0.7,
      delay: (i % 2) * 0.1,
      ease: 'power3.out',
    });
  });

  // ── Timeline items ──
  gsap.utils.toArray<HTMLElement>('.timeline-item').forEach((item, i) => {
    const card = item.querySelector('.timeline-card');
    const year = item.querySelector('.timeline-year');
    if (card) {
      gsap.from(card, {
        scrollTrigger: {
          trigger: item,
          start: 'top 80%',
          toggleActions: 'play none none reverse',
        },
        y: 50,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
      });
    }
    if (year) {
      gsap.from(year, {
        scrollTrigger: {
          trigger: item,
          start: 'top 80%',
          toggleActions: 'play none none reverse',
        },
        scale: 0.85,
        opacity: 0,
        duration: 1,
        delay: 0.2,
        ease: 'power3.out',
      });
    }
  });

  // ── News cards ──
  gsap.utils.toArray<HTMLElement>('.news-card').forEach((card, i) => {
    gsap.from(card, {
      scrollTrigger: {
        trigger: card,
        start: 'top 90%',
        toggleActions: 'play none none reverse',
      },
      y: 30,
      opacity: 0,
      duration: 0.6,
      delay: (i % 3) * 0.08,
      ease: 'power3.out',
    });
  });

  // ── Landscape categories ──
  gsap.utils.toArray<HTMLElement>('.landscape-category').forEach((cat) => {
    const cards = cat.querySelectorAll('.landscape-card');
    gsap.from(cards, {
      scrollTrigger: {
        trigger: cat,
        start: 'top 85%',
        toggleActions: 'play none none reverse',
      },
      y: 30,
      opacity: 0,
      scale: 0.96,
      duration: 0.5,
      stagger: 0.06,
      ease: 'power3.out',
    });
  });

  // ── Filter bar reveal ──
  const filterBar = document.getElementById('news-filters');
  if (filterBar) {
    gsap.from(filterBar.children, {
      scrollTrigger: {
        trigger: filterBar,
        start: 'top 90%',
        toggleActions: 'play none none reverse',
      },
      y: 20,
      opacity: 0,
      duration: 0.5,
      stagger: 0.05,
      ease: 'power3.out',
    });
  }
}
