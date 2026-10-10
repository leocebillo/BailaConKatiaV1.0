// US and Ukraine flags in a straight row across the top, repeating, with a small gap between each.
(function () {
  const FLAG_W = 44, FLAG_H = 30, GAP = 10;

  let stripes = '';
  for (let i = 0; i < 13; i++) {
    stripes += `<rect y="${(i * FLAG_H / 13).toFixed(2)}" width="${FLAG_W}" height="2.31" fill="${i % 2 ? '#fff' : '#b22234'}"/>`;
  }

  const defs = `
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

  function draw() {
    const strip = document.getElementById('flagStrip');
    if (!strip) return;
    const width = window.innerWidth;
    const step = FLAG_W + GAP;
    const count = Math.ceil(width / step) + 1;
    const offset = (width - count * step) / 2;
    let flags = '';
    for (let i = 0; i < count; i++) {
      flags += `<use href="#${i % 2 ? 'ua' : 'us'}" x="${(offset + i * step).toFixed(1)}" y="4" width="${FLAG_W}" height="${FLAG_H}"/>`;
    }
    strip.innerHTML = `<svg width="${width}" height="${FLAG_H + 8}" aria-hidden="true"><defs>${defs}</defs>${flags}</svg>`;
  }

  draw();
  window.addEventListener('resize', draw);
})();
