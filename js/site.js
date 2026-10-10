// Fills the pages with content: defaults first, then whatever has been saved in Firestore.
(function () {
  const bck = window.bck;
  const { h } = bck;
  const $ = id => document.getElementById(id);

  const state = bck.state = { gallery: [], classes: [], packages: [], info: {} };

  // a list falls back to the defaults until someone saves it for the first time
  bck.current = function (name) {
    if (name === 'info') return Object.assign({}, bck.defaults.info, state.info);
    const edited = name === 'classes' ? state.info.editedClasses : state.info.editedPackages;
    return state[name].length || edited ? state[name] : bck.defaults[name];
  };

  function drawGallery() {
    const grid = $('gal');
    if (!grid) return;
    const items = state.gallery;
    if (!items.length) {
      grid.replaceChildren(...bck.defaults.galleryCaptions.map(cap =>
        h('figure', {}, h('div', { class: 'ph' }, 'Class photo', h('br'), 'goes here'), h('figcaption', {}, cap))));
      return;
    }
    grid.replaceChildren(...items.map(item =>
      h('figure', { 'data-id': item.id },
        h('img', { src: item.src, alt: item.cap || 'Class photo', loading: 'lazy' }),
        item.cap ? h('figcaption', {}, item.cap) : null)));
  }

  function drawClasses() {
    const list = $('classList');
    if (!list) return;
    list.replaceChildren(...bck.current('classes').map(c =>
      h('div', { class: 'row' }, h('h3', {}, c.name), h('span', {}, c.desc), h('em', {}, c.when))));
  }

  function drawInfo() {
    const info = bck.current('info');
    document.querySelectorAll('[data-info]').forEach(el => {
      el.textContent = info[el.dataset.info] || '';
    });
    const portrait = document.querySelector('[data-portrait]');
    if (portrait && state.info.portrait) {
      portrait.replaceChildren(h('img', { src: state.info.portrait, alt: 'Katia' }));
      portrait.classList.add('has-photo');
    }
  }

  function drawAll() {
    drawGallery();
    drawClasses();
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

    watch('gallery', db.collection('siteGallery').orderBy('order').limit(12));
    watch('classes', db.collection('siteClasses').orderBy('order'));
    watch('packages', db.collection('sitePackages').orderBy('order'));
    db.collection('siteInfo').doc('main').onSnapshot(doc => {
      state.info = doc.exists ? doc.data() : {};
      changed();
    }, warn);
  });
})();
