(() => {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  if (toggle && nav) {
    document.documentElement.classList.add('nav-enhanced');
    const close = (focus = false) => {
      toggle.setAttribute('aria-expanded', 'false');
      nav.classList.remove('is-open');
      if (focus) toggle.focus();
    };
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') close(true);
    });
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.site-header')) close();
    });
    nav.addEventListener('click', (event) => { if (event.target.closest('a')) close(); });
    nav.addEventListener('focusout', () => {
      requestAnimationFrame(() => {
        if (!nav.contains(document.activeElement) && document.activeElement !== toggle) close();
      });
    });
    matchMedia('(min-width: 900px)').addEventListener('change', () => close());
  }

  document.querySelectorAll('[data-tabs]').forEach((box) => {
    const tabs = [...box.querySelectorAll('[role="tab"]')];
    const select = (tab, focus = false, updateHash = false) => {
      tabs.forEach((item) => {
        const active = item === tab;
        item.setAttribute('aria-selected', String(active));
        item.tabIndex = active ? 0 : -1;
        document.getElementById(item.getAttribute('aria-controls')).hidden = !active;
      });
      if (focus) tab.focus();
      if (updateHash) history.replaceState(null, '', '#' + tab.getAttribute('aria-controls'));
    };
    const fromHash = () => tabs.find((tab) => '#' + tab.getAttribute('aria-controls') === location.hash);
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab, false, true));
      tab.addEventListener('keydown', (event) => {
        const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        select(tabs[(next + tabs.length) % tabs.length], true, true);
      });
    });
    box.classList.add('is-enhanced');
    select(fromHash() || tabs[0]);
    if (fromHash()) requestAnimationFrame(() => box.scrollIntoView({ block: 'start' }));
    window.addEventListener('hashchange', () => { if (fromHash()) select(fromHash()); });
    box.querySelectorAll('.tab-panel').forEach((panel) => {
      const preview = panel.querySelector('.tab-finish > img');
      const finish = panel.querySelector('h3').textContent;
      panel.querySelectorAll('[data-sample]').forEach((button) => {
        button.addEventListener('click', () => {
          panel.querySelectorAll('[data-sample]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
          preview.src = button.dataset.sample;
          preview.alt = finish + ' aluminium sample';
        });
      });
    });
  });

  const video = document.getElementById('hero-video');
  const btn = document.querySelector('.video-toggle');
  if (video && btn) {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let userPaused = motion.matches;
    video.controls = false;
    btn.hidden = false;
    const label = () => {
      btn.textContent = video.paused ? 'Play video' : 'Pause video';
      btn.setAttribute('aria-pressed', String(!video.paused));
    };
    const play = () => video.play().catch(() => { video.controls = true; label(); });
    btn.addEventListener('click', () => {
      if (video.paused) { userPaused = false; play(); }
      else { userPaused = true; video.pause(); }
    });
    video.addEventListener('play', label);
    video.addEventListener('pause', label);
    video.addEventListener('error', () => { btn.hidden = true; video.controls = true; });
    motion.addEventListener('change', (event) => {
      if (event.matches) { userPaused = true; video.pause(); }
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && !userPaused) play();
        else if (!entry.isIntersecting) video.pause();
      }, { threshold: 0.25 }).observe(video);
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) video.pause(); });
    label();
  }
})();