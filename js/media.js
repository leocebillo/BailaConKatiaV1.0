// Video link parsing and the full-screen viewer used by the photo grid, the videos and the schedule flyers.
(function () {
  const bck = window.bck;
  if (!bck) return;
  const { h } = bck;

  /* ---------- video links ---------- */

  // returns { kind, id | url } for a YouTube, Vimeo or direct video file link, otherwise null
  bck.parseVideo = function (link) {
    let url;
    try { url = new URL(String(link || '').trim()); } catch (err) { return null; }
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.replace(/^www\.|^m\./, '');

    if (host === 'youtu.be') {
      const id = url.pathname.slice(1).split('/')[0];
      return /^[\w-]{11}$/.test(id) ? { kind: 'youtube', id } : null;
    }
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/);
      const id = m ? m[1] : url.searchParams.get('v');
      return id && /^[\w-]{11}$/.test(id) ? { kind: 'youtube', id } : null;
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const m = url.pathname.match(/(\d{6,})/);
      return m ? { kind: 'vimeo', id: m[1] } : null;
    }
    if (/\.(mp4|webm|mov)$/i.test(url.pathname)) return { kind: 'file', url: url.href };
    return null;
  };

  bck.videoThumb = v => v.kind === 'youtube' ? `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg` : '';

  /* ---------- viewer ---------- */

  let box, stage, caption, prev, next, closeBtn;
  let list = [];
  let at = 0;
  let opener = null;
  let startX = 0;

  function build() {
    closeBtn = h('button', { type: 'button', class: 'lb-btn lb-close', 'aria-label': 'Close', onclick: close }, '×');
    prev = h('button', { type: 'button', class: 'lb-btn lb-prev', 'aria-label': 'Previous', onclick: () => go(-1) }, '‹');
    next = h('button', { type: 'button', class: 'lb-btn lb-next', 'aria-label': 'Next', onclick: () => go(1) }, '›');
    stage = h('div', { class: 'lb-stage' });
    caption = h('p', { class: 'lb-cap' });
    box = h('div', { class: 'lb', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Viewer' }, stage, caption, closeBtn, prev, next);

    // tapping the dark area closes it; tapping the picture itself does not
    box.addEventListener('click', e => { if (e.target === box || e.target === stage) close(); });
    box.addEventListener('touchstart', e => { startX = e.changedTouches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
    }, { passive: true });
    box.addEventListener('keydown', e => {
      if (e.key === 'Escape') return close();
      if (e.key === 'ArrowLeft') return go(-1);
      if (e.key === 'ArrowRight') return go(1);
      if (e.key !== 'Tab') return;
      // keep keyboard focus inside the viewer
      const stops = [...box.querySelectorAll('button')].filter(b => !b.hidden);
      const first = stops[0], last = stops[stops.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    document.body.append(box);
  }

  function embed(item) {
    if (item.kind === 'youtube') {
      return h('div', { class: 'lb-video' }, h('iframe', {
        src: `https://www.youtube-nocookie.com/embed/${item.id}?autoplay=1&rel=0`,
        title: item.cap || 'Video',
        allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
        allowfullscreen: true
      }));
    }
    if (item.kind === 'vimeo') {
      return h('div', { class: 'lb-video' }, h('iframe', {
        src: `https://player.vimeo.com/video/${item.id}?autoplay=1`,
        title: item.cap || 'Video',
        allow: 'autoplay; fullscreen; picture-in-picture',
        allowfullscreen: true
      }));
    }
    return h('div', { class: 'lb-video' }, h('video', { src: item.url, controls: true, autoplay: true, playsinline: true }));
  }

  function show() {
    const item = list[at];
    stage.replaceChildren();
    if (item.type === 'video') {
      stage.append(embed(item));
    } else {
      const img = h('img', { src: item.src, alt: item.cap || '' });
      stage.append(img);
      // photos keep a small copy on the page and fetch the large one only when opened
      if (item.loadFull) {
        const shown = item;
        item.loadFull().then(big => { if (big && list[at] === shown && img.isConnected) img.src = big; }).catch(() => {});
      }
    }
    caption.textContent = item.cap || '';
    prev.hidden = next.hidden = list.length < 2;
  }

  function go(step) {
    at = (at + step + list.length) % list.length;
    show();
  }

  function close() {
    if (!box || box.hidden) return;
    box.hidden = true;
    stage.replaceChildren();   // stops any playing video
    document.body.style.overflow = '';
    if (opener && opener.isConnected) opener.focus();
  }

  bck.openLightbox = function (items, start, from) {
    if (!items.length) return;
    if (!box) build();
    list = items;
    at = Math.max(0, start);
    opener = from || null;
    box.hidden = false;
    document.body.style.overflow = 'hidden';
    show();
    closeBtn.focus();
  };

  // any button marked .tile-open opens every tile of its group, starting with the one tapped
  document.addEventListener('click', e => {
    const btn = e.target.closest('.tile-open');
    if (!btn || !btn._lb) return;
    const group = [...document.querySelectorAll('.tile-open')].filter(b => b.dataset.lbGroup === btn.dataset.lbGroup && b._lb);
    bck.openLightbox(group.map(b => b._lb), group.indexOf(btn), btn);
  });
})();
