// Small DOM helper plus the Firebase loader. Firebase only loads once the config has been filled in,
// so the site still works (with its default content) before that.
(function () {
  const cfg = window.BCK_CONFIG || {};
  const fb = cfg.firebase || {};
  const configured = !!fb.apiKey && !/^PASTE/.test(fb.apiKey);
  const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
  const waiting = [];

  function h(tag, props, ...kids) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (k === 'class') node.className = v;
      else if (k === 'value') node.value = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (v === true) node.setAttribute(k, '');
      else if (v !== false && v != null) node.setAttribute(k, v);
    }
    node.append(...kids.flat().filter(x => x != null && x !== false));
    return node;
  }

  const bck = window.bck = {
    configured,
    ready: false,
    db: null,
    auth: null,
    h,
    onReady(fn) { bck.ready ? fn() : waiting.push(fn); }
  };

  function load(file) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SDK + file;
      s.onload = resolve;
      s.onerror = reject;
      document.head.append(s);
    });
  }

  if (configured) {
    load('firebase-app-compat.js')
      .then(() => Promise.all([load('firebase-auth-compat.js'), load('firebase-firestore-compat.js')]))
      .then(() => {
        firebase.initializeApp(fb);
        bck.db = firebase.firestore();
        bck.auth = firebase.auth();
        bck.ready = true;
        waiting.splice(0).forEach(fn => fn());
      })
      .catch(() => console.warn('Could not reach Firebase, showing the saved content.'));
  }
})();
