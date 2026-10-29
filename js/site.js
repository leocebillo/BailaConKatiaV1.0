// Fills the pages with content: defaults first, then whatever has been saved in Firestore.
(function () {
  const bck = window.bck;
  const { h } = bck;
  const $ = id => document.getElementById(id);

  const state = bck.state = { gallery: [], classes: [], packages: [], info: {}, text: {}, lists: {}, flyer1: null, flyer2: null };
  const fullPhotos = {};   // large photos already fetched, by photo id

  // a list falls back to the defaults until someone saves it for the first time
  bck.current = function (name) {
    if (name === 'info') return Object.assign({}, bck.defaults.info, state.info);
    const edited = name === 'classes' ? state.info.editedClasses : state.info.editedPackages;
    return state[name].length || edited ? state[name] : bck.defaults[name];
  };

  bck.currentList = name => Array.isArray(state.lists[name]) ? state.lists[name] : bck.defaults.lists[name];

  // only https links are ever used as a payment or video link
  bck.safeLink = link => /^https:\/\/[^\s]+$/i.test(String(link || '').trim()) ? String(link).trim() : '';

  function placeholderTile(text) {
    return h('figure', {}, h('div', { class: 'ph' }, text));
  }

  function drawGallery() {
    const grid = $('gal');
    if (!grid) return;
    const items = state.gallery;
    if (!items.length) {
      grid.replaceChildren(...bck.defaults.galleryCaptions.map(() => placeholderTile('Photo goes here')));
      return;
    }
    grid.replaceChildren(...items.map(item => {
      const open = h('button', {
        type: 'button', class: 'tile-open', 'data-lb-group': 'photos',
        'aria-label': 'View photo' + (item.cap ? ': ' + item.cap : '')
      }, h('img', { src: item.src, alt: item.cap || 'Lesson photo', loading: 'lazy' }));
      open._lb = {
        type: 'image', src: item.src, cap: item.cap,
        loadFull: item.full ? () => fetchFull(item.id) : null
      };
      return h('figure', { 'data-id': item.id }, open, item.cap ? h('figcaption', {}, item.cap) : null);
    }));
  }

  function fetchFull(id) {
    if (fullPhotos[id]) return Promise.resolve(fullPhotos[id]);
    return bck.db.collection('siteInfo').doc('full_' + id).get().then(doc => {
      if (doc.exists) fullPhotos[id] = doc.data().src;
      return fullPhotos[id] || null;
    });
  }

  function drawVideos() {
    const grid = $('vidGal');
    if (!grid) return;
    const videos = bck.currentList('videos').map(v => Object.assign({}, v, { parsed: bck.parseVideo(v.url) })).filter(v => v.parsed);
    $('videosSection').classList.toggle('is-empty', !videos.length);
    if (!videos.length) {
      grid.replaceChildren(placeholderTile('Videos you add show up here'));
      return;
    }
    grid.replaceChildren(...videos.map(v => {
      const thumb = bck.videoThumb(v.parsed);
      const open = h('button', {
        type: 'button', class: 'tile-open', 'data-lb-group': 'videos',
        'aria-label': 'Play video' + (v.cap ? ': ' + v.cap : '')
      }, thumb ? h('img', { src: thumb, alt: '', loading: 'lazy' }) : null, h('span', { class: 'play', 'aria-hidden': 'true' }));
      open._lb = Object.assign({ type: 'video', cap: v.cap }, v.parsed);
      return h('figure', { class: 'vtile' }, open, v.cap ? h('figcaption', {}, v.cap) : null);
    }));
  }

  function drawFlyers() {
    if (!$('flyer1')) return;
    let any = false;
    [1, 2].forEach(n => {
      const flyer = state['flyer' + n];
      const has = !!(flyer && flyer.src);
      any = any || has;
      $('flyer' + n).classList.toggle('is-empty', !has);
      const cap = $('flyer' + n).querySelector('[data-t]').textContent;
      if (!has) {
        $('flyerBox' + n).replaceChildren(h('div', { class: 'flyer-ph' }, 'Flyer goes here'));
        return;
      }
      const open = h('button', {
        type: 'button', class: 'tile-open', 'data-lb-group': 'flyers',
        'aria-label': 'View ' + cap + ' full size'
      }, h('img', { src: flyer.src, alt: cap }));
      open._lb = { type: 'image', src: flyer.src, cap };
      $('flyerBox' + n).replaceChildren(open);
    });
    $('scheduleSoon').hidden = any;
  }

  function drawClasses() {
    const list = $('classList');
    if (!list) return;
    list.replaceChildren(...bck.current('classes').map(c =>
      h('div', { class: 'row' }, h('h3', {}, c.name), h('span', {}, c.desc), h('em', {}, c.when))));
  }

  function drawLists() {
    const faq = $('faqList');
    if (faq) faq.replaceChildren(...bck.currentList('faq').map(i =>
      h('details', {}, h('summary', {}, i.q), h('p', {}, i.a))));
    const steps = $('stepsList');
    if (steps) steps.replaceChildren(...bck.currentList('steps').map(i =>
      h('li', {}, h('strong', {}, i.t), ' ' + i.d)));
    const perks = $('perksList');
    if (perks) perks.replaceChildren(...bck.currentList('perks').map(i => h('li', {}, i.t)));
  }

  // any element marked data-t can be reworded; the text written in the page is the original
  function drawText() {
    document.querySelectorAll('[data-t]').forEach(el => {
      if (el.dataset.orig === undefined) el.dataset.orig = el.textContent.replace(/\s+/g, ' ').trim();
      const saved = state.text[el.dataset.t];
      el.textContent = typeof saved === 'string' && saved ? saved : el.dataset.orig;
    });
  }

  function drawInfo() {
    const info = bck.current('info');
    document.querySelectorAll('[data-info]').forEach(el => {
      el.textContent = info[el.dataset.info] || '';
    });
    const links = document.getElementById('socialLinks');
    if (links) {
      const nets = [['instagram', 'Instagram'], ['facebook', 'Facebook'], ['tiktok', 'TikTok']];
      links.replaceChildren(...nets.filter(([k]) => bck.safeLink(info[k])).map(([k, name]) =>
        h('a', { class: 'social', href: bck.safeLink(info[k]), target: '_blank', rel: 'noopener noreferrer' }, name)));
    }
    const portrait = document.querySelector('[data-portrait]');
    if (portrait && state.info.portrait) {
      portrait.replaceChildren(h('img', { src: state.info.portrait, alt: 'Katia' }));
      portrait.classList.add('has-photo');
    }
  }

  function drawAll() {
    drawText();
    drawGallery();
    drawVideos();
    drawFlyers();
    drawClasses();
    drawLists();
    drawInfo();
  }

  function changed() {
    drawAll();
    document.dispatchEvent(new Event('bck:data'));
  }

  drawAll();

  bck.onReady(() => {
    const db = bck.db;
    const warn = err => console.warn('Could not load site content:', err.message);
    const watch = (name, query) => query.onSnapshot(snap => {
      state[name] = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
      changed();
    }, warn);
    const watchDoc = (id, key) => db.collection('siteInfo').doc(id).onSnapshot(doc => {
      state[key] = doc.exists ? doc.data() : (key.startsWith('flyer') ? null : {});
      changed();
    }, warn);

    // each page only listens to what it shows, so big images are not downloaded everywhere
    if ($('gal')) watch('gallery', db.collection('siteGallery').orderBy('order').limit(12));
    if ($('classList')) watch('classes', db.collection('siteClasses').orderBy('order'));
    if ($('pkgs')) watch('packages', db.collection('sitePackages').orderBy('order'));
    if ($('flyer1')) { watchDoc('flyer1', 'flyer1'); watchDoc('flyer2', 'flyer2'); }
    watchDoc('main', 'info');
    watchDoc('text', 'text');
    watchDoc('lists', 'lists');
  });
})();
