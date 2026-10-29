// Pass picker and payment options on the pricing page.
(function () {
  const bck = window.bck;
  const { h } = bck;
  const $ = id => document.getElementById(id);
  if (!$('pkgs')) return;

  let picked = 1;
  let method = 'Pay online';

  const methods = () => {
    const info = bck.current('info');
    return {
      'Pay online': '',
      'Zelle': 'Send to ' + info.zelle,
      'Cash App': 'Send to ' + info.cashapp,
      'At the studio': 'Pay when you arrive. We hold your spot for 48 hours.'
    };
  };

  function drawPackages() {
    const list = bck.current('packages');
    if (picked >= list.length) picked = Math.max(0, list.length - 1);
    $('pkgs').replaceChildren(...list.map((pkg, i) => {
      const btn = h('button', { type: 'button', class: 'pkg', 'aria-pressed': i === picked },
        pkg.tag ? h('span', { class: 'tag' }, pkg.tag) : null,
        h('span', {}, h('strong', {}, pkg.t), h('small', {}, pkg.d)),
        h('span', {}, h('span', { class: 'pr' }, h('sup', {}, '$'), String(pkg.p)), h('em', {}, pkg.n)));
      btn.addEventListener('click', () => { picked = i; drawAll(); });
      return btn;
    }));
  }

  function drawMethods() {
    const all = methods();
    $('tabs').replaceChildren(...Object.keys(all).map(name => {
      const btn = h('button', { type: 'button', 'aria-pressed': name === method }, name);
      btn.addEventListener('click', () => { method = name; drawAll(); });
      return btn;
    }));
    $('online').hidden = method !== 'Pay online';
    $('alt').hidden = method === 'Pay online';
    $('alt').textContent = all[method];
  }

  // a pass can have its own payment link; otherwise the shared one is used
  function drawPay() {
    const pkg = bck.current('packages')[picked];
    $('pick').textContent = pkg ? pkg.t : '';
    $('tot').textContent = '$' + (pkg ? pkg.p : 0);
    const url = bck.safeLink(pkg && pkg.link) || bck.safeLink(bck.current('info').paylink);
    const link = $('payLink');
    link.hidden = !url;
    $('noLink').hidden = !!url;
    if (url) {
      link.href = url;
      link.textContent = `Pay $${pkg.p} online`;
    }
  }

  function drawAll() {
    drawPackages();
    drawMethods();
    drawPay();
  }

  drawAll();
  document.addEventListener('bck:data', drawAll);
})();
