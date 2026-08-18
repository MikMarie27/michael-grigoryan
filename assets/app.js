/* Michael Grigoryan — the site reads everything from content.json.
 *
 * Nothing here needs editing to change the site. Titles, years, the biography,
 * the contact details and the order of the works all live in content.json,
 * which the admin panel at /admin/ writes for you.
 *
 * The single-file build injects window.SITE_CONTENT so the page also works
 * from a USB stick, where fetching a local file is blocked.
 */
(function () {
  'use strict';

  const $ = sel => document.querySelector(sel);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  const load = window.SITE_CONTENT
    ? Promise.resolve(window.SITE_CONTENT)
    : fetch('content.json', { cache: 'no-cache' }).then(r => {
        if (!r.ok) throw new Error('content.json ' + r.status);
        return r.json();
      });

  load.then(render).catch(err => {
    console.error(err);
    const g = $('#grid');
    if (g) g.append(el('li', 'load-error', 'The works could not be loaded.'));
  });

  function render(c) {
    renderHero(c);
    renderWorks(c.works || []);
    renderAbout(c.about || {});
    renderContact(c.contact || {});
    const y = $('#year');
    if (y) y.textContent = String(new Date().getFullYear());
    lightbox(c.works || []);
    reveal();
    stickyHeader();
  }

  /* ---------- hero ---------- */

  function renderHero(c) {
    const s = c.site || {}, h = c.hero || {};
    const set = (sel, text) => { const n = $(sel); if (n && text) n.textContent = text; };
    set('#name', s.name);
    set('#lede', s.lede);
    set('#hero-meta', s.meta);
    set('#cta', s.cta);

    const fig = $('.hero-figure');
    if (!fig || !h.video) return;
    const v = el('video');
    v.src = h.video;
    if (h.poster) v.poster = h.poster;
    if (h.w) v.width = h.w;
    if (h.h) v.height = h.h;
    v.muted = true; v.loop = true; v.autoplay = true;
    v.playsInline = true; v.preload = 'metadata';
    if (h.alt) v.setAttribute('aria-label', h.alt);
    fig.prepend(v);

    if (h.caption) {
      const cap = el('figcaption', null, h.caption);
      cap.lang = 'hy';
      fig.append(cap);
    }
    film(v);
  }

  function film(v) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      v.autoplay = false; v.loop = false; v.controls = true; v.pause();
      return;
    }
    // A background tab, low-power mode or a data saver will refuse autoplay.
    // Retry when the page is actually looked at; only then fall back to controls.
    const start = () => {
      const p = v.play();
      if (p && p.catch) p.catch(() => { v.controls = true; });
    };
    start();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && v.paused && !v.controls) start();
    });
  }

  /* ---------- works ---------- */

  const detail = w => [w.year, w.medium, w.size].filter(Boolean).join(' · ');

  function title(w) {
    const t = el('span', 't');
    t.lang = 'hy';
    t.textContent = w.title || 'Untitled';
    if (w.titleEn) {
      const en = el('span', 'en', w.titleEn);
      en.lang = 'en';
      t.append(en);
    }
    return t;
  }

  function renderWorks(works) {
    const grid = $('#grid');
    if (!grid) return;
    grid.textContent = '';

    works.forEach((w, i) => {
      const li = el('li', 'card');
      const fig = el('figure');

      const btn = el('button', 'card-btn');
      btn.type = 'button';
      btn.setAttribute('aria-label', 'View ' + (w.title || 'work') + ' larger');

      const img = el('img');
      img.src = 'images/thumb/' + w.slug + '.jpg';
      img.srcset = 'images/thumb/' + w.slug + '.jpg ' + w.tw + 'w, ' +
                   'images/full/' + w.slug + '.jpg ' + w.fw + 'w';
      img.sizes = '(min-width: 76rem) 30vw, (min-width: 46rem) 45vw, 92vw';
      img.width = w.tw; img.height = w.th;
      img.alt = w.alt || '';
      img.loading = i === 0 ? 'eager' : 'lazy';
      img.decoding = 'async';
      btn.append(img);

      const cap = el('figcaption');
      cap.append(title(w));
      const d = detail(w);
      if (d) cap.append(el('span', 'm', d));

      fig.append(btn, cap);
      li.append(fig);
      grid.append(li);
      btn.addEventListener('click', () => open(i));
    });
  }

  /* ---------- about + contact ---------- */

  function renderAbout(a) {
    const prose = $('#about-prose');
    if (prose) {
      prose.textContent = '';
      if (a.opening) prose.append(el('p', 'big', a.opening));
      // a paragraph beginning "> " is Michael speaking, and is set as a quotation
      (a.paragraphs || []).forEach(t => {
        if (/^>\s/.test(t)) {
          const q = el('blockquote', 'said');
          q.append(el('p', null, t.replace(/^>\s*/, '')));
          prose.append(q);
        } else {
          prose.append(el('p', null, t));
        }
      });
    }
    const facts = $('#facts');
    if (facts) {
      facts.textContent = '';
      (a.facts || []).forEach(f => {
        const wrap = el('div');
        wrap.append(el('dt', null, f.label), el('dd', null, f.value));
        facts.append(wrap);
      });
    }
  }

  function renderContact(c) {
    const line = $('#contact-line');
    if (line && c.line) line.textContent = c.line;

    const mail = $('#contact-email');
    if (mail && c.email) {
      mail.textContent = '';
      const a = el('a', null, c.email);
      a.href = 'mailto:' + c.email;
      mail.append(a);
    }
    const list = $('#elsewhere');
    if (list) {
      list.textContent = '';
      (c.links || []).forEach(l => {
        const li = el('li');
        const a = el('a', null, l.label);
        a.href = l.url; a.rel = 'me noopener'; a.target = '_blank';
        li.append(a);
        list.append(li);
      });
    }
  }

  /* ---------- viewer ---------- */

  let works = [], index = 0, dlg, lbImg, lbCap;

  function open(i) {
    show(i);
    if (!dlg.open) dlg.showModal();
    document.body.style.overflow = 'hidden';
  }

  function show(i) {
    index = (i + works.length) % works.length;
    const w = works[index];
    lbImg.src = 'images/full/' + w.slug + '.jpg';
    lbImg.alt = w.alt || '';
    // never bigger than the scan, and never bigger than the screen —
    // both caps have to survive being set as an inline style
    lbImg.style.maxWidth = 'min(100%, ' + w.fw + 'px)';
    lbImg.style.maxHeight = 'min(100%, ' + w.fh + 'px)';
    lbCap.textContent = '';
    lbCap.append(title(w));
    const d = detail(w);
    if (d) lbCap.append(document.createTextNode(d));
  }

  function lightbox(list) {
    works = list;
    dlg = $('#lightbox'); lbImg = $('#lb-img'); lbCap = $('#lb-cap');
    if (!dlg) return;

    dlg.addEventListener('close', () => { document.body.style.overflow = ''; });

    dlg.addEventListener('click', e => {
      const act = e.target.closest('[data-lb]');
      if (act) {
        const a = act.dataset.lb;
        if (a === 'close') dlg.close();
        if (a === 'prev') show(index - 1);
        if (a === 'next') show(index + 1);
        return;
      }
      if (e.target === dlg || e.target.classList.contains('lb-figure')) dlg.close();
    });

    let touchX = null, touchY = null;
    dlg.addEventListener('touchstart', e => {
      touchX = e.changedTouches[0].clientX;
      touchY = e.changedTouches[0].clientY;
    }, { passive: true });
    dlg.addEventListener('touchend', e => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      const dy = e.changedTouches[0].clientY - touchY;
      touchX = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(index + (dx < 0 ? 1 : -1));
    }, { passive: true });

    dlg.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
    });
  }

  /* ---------- motion ---------- */

  function reveal() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cards = [...document.querySelectorAll('.card')];
    const on = c => { c.classList.remove('waiting'); c.classList.add('here'); };

    // Only hide what is below the fold — a work must never be able to end up
    // permanently invisible if the observer does not fire.
    const below = cards.filter(c => c.getBoundingClientRect().top > innerHeight * 0.9);
    below.forEach(c => c.classList.add('waiting'));

    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        on(e.target);
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    below.forEach(c => io.observe(c));

    setTimeout(() => cards.forEach(on), 6000);   // backstop
  }

  function stickyHeader() {
    const head = $('.site-head');
    if (!head) return;
    const mark = el('div');
    mark.setAttribute('aria-hidden', 'true');
    document.body.prepend(mark);
    new IntersectionObserver(([e]) => {
      head.classList.toggle('is-stuck', !e.isIntersecting);
    }).observe(mark);
  }
})();
