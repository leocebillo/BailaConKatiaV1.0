const $ = id => document.getElementById(id);

/* ---------- flag strip ---------- */
// one US flag, one Ukraine flag, repeating, with a small gap between each
const FLAG_W = 44, FLAG_H = 30, FLAG_GAP = 10;

let stripes = '';
for (let i = 0; i < 13; i++) {
  stripes += `<rect y="${(i * FLAG_H / 13).toFixed(2)}" width="${FLAG_W}" height="2.31" fill="${i % 2 ? '#fff' : '#b22234'}"/>`;
}

const flagDefs = `
  <linearGradient id="fold" x1="0" x2="1">
    <stop offset="0" stop-color="#000" stop-opacity=".2"/>
    <stop offset=".3" stop-color="#fff" stop-opacity=".1"/>
    <stop offset=".6" stop-color="#000" stop-opacity=".12"/>
    <stop offset="1" stop-color="#fff" stop-opacity=".06"/>
  </linearGradient>
  <pattern id="stars" width="3.2" height="3.2" patternUnits="userSpaceOnUse">
    <circle cx="1.6" cy="1.6" r=".55" fill="#fff"/>
  </pattern>
  <symbol id="ua" viewBox="0 0 ${FLAG_W} ${FLAG_H}">
    <rect width="${FLAG_W}" height="15" fill="#0057b7"/>
    <rect y="15" width="${FLAG_W}" height="15" fill="#ffd700"/>
    <rect width="${FLAG_W}" height="${FLAG_H}" fill="url(#fold)"/>
  </symbol>
  <symbol id="us" viewBox="0 0 ${FLAG_W} ${FLAG_H}">
    ${stripes}
    <rect width="17.6" height="16.2" fill="#3c3b6e"/>
    <rect width="17.6" height="16.2" fill="url(#stars)"/>
    <rect width="${FLAG_W}" height="${FLAG_H}" fill="url(#fold)"/>
  </symbol>`;

function drawFlags() {
  const strip = $('flagStrip');
  if (!strip) return;

  const width = window.innerWidth;
  const step = FLAG_W + FLAG_GAP;
  const count = Math.ceil(width / step) + 1;
  const offset = (width - count * step) / 2; // keeps the row centered

  let flags = '';
  for (let i = 0; i < count; i++) {
    const id = i % 2 ? 'ua' : 'us';
    flags += `<use href="#${id}" x="${(offset + i * step).toFixed(1)}" y="4" width="${FLAG_W}" height="${FLAG_H}"/>`;
  }

  strip.innerHTML = `<svg width="${width}" height="${FLAG_H + 8}" aria-hidden="true"><defs>${flagDefs}</defs>${flags}</svg>`;
}

drawFlags();
window.addEventListener('resize', drawFlags);

/* ---------- pricing page ---------- */
if ($('pkgs')) {
  const packages = [
    { t: 'Placeholder', d: 'Placeholder', p: 15, n: 'Placeholder' },
    { t: 'Placeholder', d: 'Placeholder', p: 52, n: 'Placeholder', tag: 'Most popular' },
    { t: 'Placeholder', d: 'Placeholder', p: 99, n: 'Placeholder' },
    { t: 'Placeholder', d: 'Placeholder', p: 60, n: 'Placeholder' }
  ];
  const methods = [
    ['Card', ''],
    ['Zelle', 'Send to pay@bailaconkatia.com'],
    ['Cash App', 'Send to $BailaConKatia'],
    ['At the studio', 'Pay when you arrive. We hold your spot for 48 hours.']
  ];
  let selected = packages[1];
  let method = 'Card';

  function drawPackages() {
    $('pkgs').innerHTML = '';
    packages.forEach(pkg => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pkg';
      btn.setAttribute('aria-pressed', pkg === selected);
      btn.innerHTML =
        (pkg.tag ? `<span class="tag">${pkg.tag}</span>` : '') +
        `<span><strong>${pkg.t}</strong><small>${pkg.d}</small></span>` +
        `<span><span class="pr"><sup>$</sup>${pkg.p}</span><em>${pkg.n}</em></span>`;
      btn.addEventListener('click', () => { selected = pkg; drawPackages(); });
      $('pkgs').appendChild(btn);
    });
    $('tot').textContent = '$' + selected.p;
  }

  function drawMethods() {
    $('tabs').innerHTML = '';
    methods.forEach(([name]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = name;
      btn.setAttribute('aria-pressed', name === method);
      btn.addEventListener('click', () => { method = name; drawMethods(); });
      $('tabs').appendChild(btn);
    });
    const info = methods.find(m => m[0] === method)[1];
    $('card').hidden = method !== 'Card';
    $('alt').hidden = method === 'Card';
    $('alt').textContent = info;
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
    msg.className = 'ok';
    msg.textContent = `You are in, ${name.split(' ')[0]}! ${selected.t} reserved ($${selected.p}, ${method}). A confirmation is on its way to ${email}.`;
  });

  drawPackages();
  drawMethods();
}

/* ---------- home page gallery ---------- */
if ($('gal')) {
  // add class photos here: { src: 'images/salsa.jpg', cap: 'Salsa night' }
  const photos = [];
  const captions = ['Placeholder', 'Placeholder', 'Placeholder', 'Placeholder', 'Placeholder', 'Placeholder'];

  $('gal').innerHTML = captions.map((fallback, i) => {
    const photo = photos[i];
    const cap = (photo && photo.cap) || fallback;
    const media = photo
      ? `<img src="${photo.src}" alt="${cap}" loading="lazy">`
      : '<div class="ph">Class photo<br>goes here</div>';
    return `<figure>${media}<figcaption>${cap}</figcaption></figure>`;
  }).join('');
}
