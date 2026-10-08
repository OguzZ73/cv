/* Portfolyo — main.js (vanilla, IIFE, defer) */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js');

  var doc = document;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var isTouch = !finePointer || ('ontouchstart' in window && !window.matchMedia('(hover: hover)').matches);

  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ---------- Hero kelimeleri: kademeli giriş ---------- */
  $$('.hero__title .word').forEach(function (w, i) {
    w.style.setProperty('--wi', i);
    if (!w.style.transitionDelay && !reduced) w.style.transitionDelay = (0.15 + i * 0.09) + 's';
  });
  function startHero() {
    var t = $('.hero__title');
    if (t) t.classList.add('is-in');
    $$('.hero__title .word').forEach(function (w) { w.classList.add('is-in'); });
  }
  if (reduced) { startHero(); } else { requestAnimationFrame(function () { requestAnimationFrame(startHero); }); }

  /* ---------- Reveal ---------- */
  var reveals = $$('[data-reveal]');
  if (reduced || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var rio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); rio.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    reveals.forEach(function (el) { rio.observe(el); });
  }

  /* ---------- Sayaç ---------- */
  function runCount(el) {
    var target = parseFloat(el.getAttribute('data-count')) || 0;
    var suffix = el.getAttribute('data-suffix') || '';
    if (reduced) { el.textContent = target + suffix; return; }
    var dur = 1400, t0 = null;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = clamp((ts - t0) / dur, 0, 1);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * e) + suffix;
      if (p < 1) requestAnimationFrame(step); else el.textContent = target + suffix;
    }
    requestAnimationFrame(step);
  }
  var counters = $$('[data-count]');
  if (reduced || !('IntersectionObserver' in window)) {
    counters.forEach(runCount);
  } else {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { runCount(e.target); cio.unobserve(e.target); }
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { el.textContent = '0' + (el.getAttribute('data-suffix') || ''); cio.observe(el); });
  }

  /* ---------- Nav ---------- */
  var nav = $('.nav');
  var navLinks = $$('.nav a[href^="#"]');
  var sections = navLinks.map(function (a) {
    var id = a.getAttribute('href').slice(1);
    return id ? doc.getElementById(id) : null;
  });
  function navOffset() { return nav ? nav.offsetHeight + 8 : 72; }

  navLinks.forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href').slice(1);
      var target = id ? doc.getElementById(id) : null;
      if (!target) return;
      e.preventDefault();
      var y = id === 'hero' ? 0 : target.getBoundingClientRect().top + window.pageYOffset - navOffset() + 1;
      if (target.classList.contains('skills--pin')) y = target.offsetTop + (target.offsetHeight - window.innerHeight) * 0.22;
      window.scrollTo({ top: Math.max(0, y), behavior: reduced ? 'auto' : 'smooth' });
      if (history.replaceState) history.replaceState(null, '', '#' + id);
    });
  });
  // Diğer sayfa içi bağlantılar (hero CTA vb.)
  $$('a[href^="#"]').forEach(function (a) {
    if (navLinks.indexOf(a) !== -1) return;
    var h = a.getAttribute('href');
    if (h.length < 2) return;
    a.addEventListener('click', function (e) {
      var target = doc.getElementById(h.slice(1));
      if (!target) return;
      e.preventDefault();
      var y = target.getBoundingClientRect().top + window.pageYOffset - navOffset() + 1;
      window.scrollTo({ top: Math.max(0, y), behavior: reduced ? 'auto' : 'smooth' });
    });
  });

  function updateNav(sy) {
    if (nav) nav.classList.toggle('is-scrolled', sy > 24);
    var probe = sy + window.innerHeight * 0.35;
    var active = -1;
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i];
      if (s && s.offsetTop <= probe) active = i;
    }
    navLinks.forEach(function (a, i) {
      var on = i === active;
      if (a.classList.contains('is-active') !== on) {
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      }
    });
  }

  /* ---------- Scroll durumu ---------- */
  var progress = $('#progress');
  var stackItems = $$('.stack__item');
  var parallax = $$('[data-parallax]');
  var scrollY = window.pageYOffset;
  var vh = window.innerHeight;
  var scrollNorm = 0;
  var ticking = false;

  var heroStage = $('.hero__stage');

  /* ---------- Beceriler: kaydırmaya bağlı kart sahnesi ---------- */
  var skillsSec = $('#skills');
  var skillCards = skillsSec ? $$('.skill-card', skillsSec) : [];
  var skillsMeter = skillsSec ? $('.skills__meter-bar', skillsSec) : null;
  var skillsOn = !!skillsSec && skillCards.length > 0 && !reduced;
  if (skillsOn) { skillsSec.classList.add('skills--pin'); root.classList.add('skills-on'); }
  function easeOutBack(t) { var c1 = 1.25, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function updateSkills() {
    var total = skillsSec.offsetHeight - vh;
    if (total <= 0) return;
    var rect = skillsSec.getBoundingClientRect();
    var P = clamp(-rect.top / total, 0, 1);
    var n = skillCards.length;
    var step = 0.7 / n, dur = 0.3;
    for (var i = 0; i < n; i++) {
      var t = clamp((P * 0.97 - i * step * 0.95) / dur, 0, 1);
      var e = t <= 0 ? 0 : (t >= 1 ? 1 : easeOutBack(t));
      var el = skillCards[i];
      el.style.setProperty('--p', e.toFixed(4));
      var landed = t >= 1;
      if (el.classList.contains('is-landed') !== landed) el.classList.toggle('is-landed', landed);
    }
    if (skillsMeter) skillsMeter.parentNode.style.setProperty('--sp', P.toFixed(4));
    skillsMeter && (skillsMeter.style.setProperty('--sp', P.toFixed(4)));
  }

  function applyScroll() {
    ticking = false;
    var sy = window.pageYOffset;
    scrollY = sy;
    var max = Math.max(1, doc.documentElement.scrollHeight - vh);
    scrollNorm = clamp(sy / max, 0, 1);
    root.style.setProperty('--scroll', scrollNorm.toFixed(4));
    if (progress) {
      progress.style.transform = 'scaleX(' + scrollNorm.toFixed(4) + ')';
      progress.style.width = '100%';
      progress.style.transformOrigin = '0 50%';
    }
    updateNav(sy);

    if (heroStage) heroStage.classList.toggle('is-scrolled', sy > 40);
    if (skillsOn) updateSkills();

    if (!reduced) {
      // Sticky yığın
      var n = stackItems.length;
      for (var i = 0; i < n; i++) {
        var el = stackItems[i];
        var next = stackItems[i + 1];
        var scale = 1, dim = 0, ty = 0;
        if (next) {
          var r = next.getBoundingClientRect();
          // sonraki kart bu kartın üstüne yaklaştıkça ilerleme
          var idx = i + 1;
          var stickTop = 90 + idx * 24;
          var start = vh * 0.9;
          var p = clamp((start - r.top) / Math.max(1, start - stickTop), 0, 1);
          scale = 1 - 0.08 * p;
          dim = 0.5 * p;
          ty = -12 * p;
        }
        el.style.setProperty('--scale', scale.toFixed(4));
        el.style.setProperty('--dim', dim.toFixed(4));
        el.style.setProperty('--ty', ty.toFixed(2) + 'px');
      }
      // Parallax
      for (var j = 0; j < parallax.length; j++) {
        var pe = parallax[j];
        var sp = parseFloat(pe.getAttribute('data-parallax')) || 0;
        var rect = pe.parentElement ? pe.parentElement.getBoundingClientRect() : pe.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > vh + 200) continue;
        var center = rect.top + rect.height / 2 - vh / 2;
        pe.style.setProperty('--py', (-center * sp).toFixed(1) + 'px');
      }
    }
  }
  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(applyScroll); }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { vh = window.innerHeight; onScroll(); });
  applyScroll();

  /* ---------- 3D tilt ---------- */
  var tiltOn = !reduced && !isTouch;
  if (tiltOn) {
    $$('.card3d').forEach(function (card) {
      var maxTilt = card.classList.contains('stack__item') ? 6 : 10;
      var cur = { rx: 0, ry: 0, mx: 50, my: 50, lift: 0 };
      var tgt = { rx: 0, ry: 0, mx: 50, my: 50, lift: 0 };
      var raf = 0;

      function write() {
        card.style.setProperty('--rx', cur.rx.toFixed(2) + 'deg');
        card.style.setProperty('--ry', cur.ry.toFixed(2) + 'deg');
        card.style.setProperty('--mx', cur.mx.toFixed(1) + '%');
        card.style.setProperty('--my', cur.my.toFixed(1) + '%');
        card.style.setProperty('--lift', cur.lift.toFixed(1) + 'px');
      }
      function loop() {
        var k = 0.14;
        cur.rx = lerp(cur.rx, tgt.rx, k);
        cur.ry = lerp(cur.ry, tgt.ry, k);
        cur.mx = lerp(cur.mx, tgt.mx, k);
        cur.my = lerp(cur.my, tgt.my, k);
        cur.lift = lerp(cur.lift, tgt.lift, k);
        write();
        var d = Math.abs(cur.rx - tgt.rx) + Math.abs(cur.ry - tgt.ry) +
                Math.abs(cur.mx - tgt.mx) * 0.05 + Math.abs(cur.my - tgt.my) * 0.05 +
                Math.abs(cur.lift - tgt.lift);
        if (d > 0.02) { raf = requestAnimationFrame(loop); }
        else { raf = 0; }
      }
      function kick() { if (!raf) raf = requestAnimationFrame(loop); }

      card.addEventListener('pointermove', function (e) {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        var r = card.getBoundingClientRect();
        var px = clamp((e.clientX - r.left) / r.width, 0, 1);
        var py = clamp((e.clientY - r.top) / r.height, 0, 1);
        tgt.ry = (px - 0.5) * 2 * maxTilt;
        tgt.rx = -(py - 0.5) * 2 * maxTilt;
        tgt.mx = px * 100;
        tgt.my = py * 100;
        tgt.lift = 18;
        kick();
      });
      card.addEventListener('pointerleave', function () {
        tgt.rx = 0; tgt.ry = 0; tgt.mx = 50; tgt.my = 50; tgt.lift = 0;
        kick();
      });
    });
  }

  /* ---------- Imleç ışığı ---------- */
  /* ---------- Arka plan: 3D yıldız alanı ---------- */
  var canvas = $('#bg');
  if (canvas && canvas.getContext) {
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, dpr = 1;
    var stars = [];
    var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    var running = false, frame = 0, last = 0;
    var palette = [[167, 139, 250], [34, 211, 238], [244, 114, 182], [226, 232, 240]];
    var DEPTH = 1000;
    var scrollSmooth = 0;

    function makeStar(initial) {
      var c = palette[(Math.random() * palette.length) | 0];
      return {
        x: (Math.random() - 0.5) * W * 2.2,
        y: (Math.random() - 0.5) * H * 2.2,
        z: initial ? Math.random() * DEPTH : DEPTH,
        s: 0.6 + Math.random() * 1.4,
        c: c,
        tw: Math.random() * Math.PI * 2
      };
    }
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = clamp(Math.round((W * H) / 9000), 50, 220);
      if (W < 760) count = Math.min(count, 90);
      while (stars.length < count) stars.push(makeStar(true));
      if (stars.length > count) stars.length = count;
      if (reduced || !running) draw(0);
    }
    function draw(dt) {
      ctx.clearRect(0, 0, W, H);
      mouse.x = lerp(mouse.x, mouse.tx, 0.05);
      mouse.y = lerp(mouse.y, mouse.ty, 0.05);
      scrollSmooth = lerp(scrollSmooth, scrollNorm, 0.06);
      var cx = W / 2, cy = H / 2;
      var fov = Math.min(W, H) * 0.9 + 200;
      var speed = reduced ? 0 : (14 + Math.abs(scrollNorm - scrollSmooth) * 4000) * dt;
      var camX = mouse.x * 60;
      var camY = mouse.y * 40 + scrollSmooth * 400;
      var t = frame * 0.002;
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        s.z -= speed;
        if (s.z < 1) { stars[i] = s = makeStar(false); }
        var k = fov / (s.z + 200);
        // derinliğe bağlı paralaks: yakın yıldızlar daha çok kayar
        var par = (1 - s.z / DEPTH);
        var px = cx + (s.x - camX * (0.4 + par)) * k * 0.5;
        var py = cy + (((s.y - camY * (0.4 + par)) % (H * 2.2)) * k * 0.5);
        if (px < -10 || px > W + 10 || py < -10 || py > H + 10) continue;
        var r = Math.max(0.3, s.s * k * 0.5);
        var a = clamp(par * 1.2, 0.08, 0.95) * (0.75 + 0.25 * Math.sin(t * 40 + s.tw));
        ctx.fillStyle = 'rgba(' + s.c[0] + ',' + s.c[1] + ',' + s.c[2] + ',' + a.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(px, py, r, 0, 6.2832);
        ctx.fill();
      }
    }
    function tick(ts) {
      if (!running) return;
      var dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
      last = ts;
      frame++;
      draw(dt * 60 / 60);
      requestAnimationFrame(tick);
    }
    function start() {
      if (running || reduced) return;
      running = true; last = performance.now();
      requestAnimationFrame(tick);
    }
    function stop() { running = false; }

    window.addEventListener('resize', resize);
    if (!reduced && !isTouch) {
      window.addEventListener('pointermove', function (e) {
        mouse.tx = (e.clientX / W - 0.5) * 2;
        mouse.ty = (e.clientY / H - 0.5) * 2;
      }, { passive: true });
    }
    doc.addEventListener('visibilitychange', function () {
      if (doc.hidden) stop(); else start();
    });
    resize();
    start();
  }
  /* ---------- Canlı site önizlemesi (proje kartlarındaki tarayıcı çerçevesi) ---------- */
  // "Canlı önizle"ye basınca siteyi küçük ekranda, sayfadan ayrılmadan kullanılabilir şekilde açar.
  // Site 1100 px genişlikte çizilip kutuya sığacak kadar küçültülür; iframe sandbox içinde çalışır.
  (function () {
    var VIRTUAL_W = 1100;
    var cards = $$('.stack__item').filter(function (c) { return !!$('.mock--browser[data-live-src]', c); });
    if (!cards.length) return;

    function fit(card) {
      var live = $('.live', card), frame = $('.live__frame', card);
      if (!live || !frame || live.hidden) return;
      var w = live.clientWidth, h = live.clientHeight;
      if (!w || !h) return;
      var s = w / VIRTUAL_W;
      frame.style.width = VIRTUAL_W + 'px';
      frame.style.height = Math.round(h / s) + 'px';
      frame.style.transform = 'scale(' + s.toFixed(4) + ')';
    }
    function setOpen(card, open) {
      var live = $('.live', card), frame = $('.live__frame', card);
      if (!live || !frame) return;
      live.hidden = !open;
      card.classList.toggle('is-live', open);
      $$('[data-live-close],[data-live-extra]', card).forEach(function (el) { el.hidden = !open; });
      $$('[data-live-open][aria-expanded]', card).forEach(function (b) { b.setAttribute('aria-expanded', open ? 'true' : 'false'); });
      var status = $('.live__status', card);
      clearTimeout(frame._liveTimer);
      if (open) {
        fit(card);
        if (status) { status.hidden = false; status.textContent = 'Site yükleniyor…'; }
        frame.onload = function () { clearTimeout(frame._liveTimer); if (status) status.hidden = true; };
        frame.setAttribute('src', frame.getAttribute('data-src'));
        // Site belirli bir sürede yüklenmezse (engellenmiş veya yavaş), kullanıcıyı bilgilendir.
        frame._liveTimer = setTimeout(function () {
          if (status && !status.hidden) status.textContent = 'Önizleme yüklenemedi. Sağ üstteki ↗ ile siteyi yeni sekmede açabilirsiniz.';
        }, 12000);
        frame.focus({ preventScroll: true });
      } else {
        frame.onload = null;
        if (status) status.hidden = true;
        frame.setAttribute('src', 'about:blank');   // WebGL/ses vb. çalışmayı durdur
      }
    }
    function closeAll(except) { cards.forEach(function (c) { if (c !== except && c.classList.contains('is-live')) setOpen(c, false); }); }

    cards.forEach(function (card) {
      $$('[data-live-open]', card).forEach(function (el) {
        el.addEventListener('click', function () {
          var open = !card.classList.contains('is-live') || el.classList.contains('live__cover');
          if (el.matches('button.btn')) open = !card.classList.contains('is-live'); // düğme aç/kapat gibi çalışır
          closeAll(card);
          setOpen(card, open);
        });
      });
      var closeBtn = $('[data-live-close]', card);
      if (closeBtn) closeBtn.addEventListener('click', function () { setOpen(card, false); });
      if ('ResizeObserver' in window) {
        var live = $('.live', card);
        if (live) new ResizeObserver(function () { fit(card); }).observe(live);
      }
    });
    window.addEventListener('resize', function () { cards.forEach(fit); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(null); });
  })();

})();
