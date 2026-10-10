// Pass picker and the demo checkout on the pricing page.
(function () {
  const bck = window.bck;
  const { h } = bck;
  const $ = id => document.getElementById(id);
  if (!$('pkgs')) return;

  let picked = 1;
  let method = 'Card';

  const methods = () => {
    const info = bck.current('info');
    return {
      'Card': '',
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
      btn.addEventListener('click', () => { picked = i; drawPackages(); });
      return btn;
    }));
    $('tot').textContent = '$' + (list[picked] ? list[picked].p : 0);
  }

  function drawMethods() {
    const all = methods();
    $('tabs').replaceChildren(...Object.keys(all).map(name => {
      const btn = h('button', { type: 'button', 'aria-pressed': name === method }, name);
      btn.addEventListener('click', () => { method = name; drawMethods(); });
      return btn;
    }));
    $('card').hidden = method !== 'Card';
    $('alt').hidden = method === 'Card';
    $('alt').textContent = all[method];
  }

  $('f').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('n').value.trim();
    const email = $('e').value.trim();
    const msg = $('done');
    msg.hidden = false;
    if (!name || !email.includes('@')) {
      msg.className = 'err';
      msg.textContent = 'Add your name and a valid email to continue.';
      return;
    }
    const pkg = bck.current('packages')[picked];
    msg.className = 'ok';
    msg.textContent = `You are in, ${name.split(' ')[0]}! ${pkg.t} reserved ($${pkg.p}, ${method}). A confirmation is on its way to ${email}.`;
  });

  const redraw = () => { drawPackages(); drawMethods(); };
  redraw();
  document.addEventListener('bck:data', redraw);
})();
