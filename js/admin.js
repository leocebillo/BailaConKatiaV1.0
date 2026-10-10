// Editing tools for Katia, her husband and Leo. Nothing here shows up unless a staff account is signed in.
(function () {
  const bck = window.bck;
  if (!bck || !bck.configured) return;
  const { h } = bck;

  const staff = ((window.BCK_CONFIG || {}).adminEmails || []).map(e => e.toLowerCase());
  const MAX_PHOTOS = 12;
  let isStaff = false;

  const LISTS = {
    classes: {
      col: 'siteClasses', flag: 'editedClasses', noun: 'Class',
      fields: [
        { k: 'name', label: 'Class name' },
        { k: 'desc', label: 'Description', type: 'textarea' },
        { k: 'when', label: 'Level and time (example: Beginner · Mon 7:00 pm)' }
      ]
    },
    packages: {
      col: 'sitePackages', flag: 'editedPackages', noun: 'Pass',
      fields: [
        { k: 't', label: 'Name' },
        { k: 'd', label: 'Short description' },
        { k: 'p', label: 'Price in dollars', type: 'number' },
        { k: 'n', label: 'Small note under the price' },
        { k: 'tag', label: 'Badge, like "Most popular" (optional)' }
      ]
    }
  };

  const INFO = {
    address: { label: 'Studio address', type: 'textarea' },
    phone: { label: 'Phone' },
    hours: { label: 'Hours', type: 'textarea' },
    social: { label: 'Social media' },
    bio: { label: 'About Katia', type: 'textarea' },
    years: { label: 'Years teaching (example: 8+)' },
    students: { label: 'Students taught (example: 500+)' },
    styles: { label: 'Dance styles offered' },
    zelle: { label: 'Zelle email or phone' },
    cashapp: { label: 'Cash App name (example: $BailaConKatia)' }
  };

  /* ---------- small helpers ---------- */

  function toast(text, bad) {
    const old = document.querySelector('.toast');
    if (old) old.remove();
    const t = h('div', { class: 'toast' + (bad ? ' bad' : ''), role: 'status' }, text);
    document.body.append(t);
    setTimeout(() => t.remove(), 7000);
  }

  function explain(err) {
    if (err && err.code === 'permission-denied') return 'This account is not allowed to change the site. Check the rules and admin list.';
    return (err && err.message) || 'Something went wrong. Try again.';
  }

  // runs a save, disables the button meanwhile, returns true when it worked
  async function attempt(btn, fn) {
    btn.disabled = true;
    try {
      await fn();
      return true;
    } catch (err) {
      toast(explain(err), true);
      return false;
    } finally {
      btn.disabled = false;
    }
  }

  function openDialog(title, content, actions) {
    const dlg = h('dialog', { class: 'dlg' });
    const close = () => { dlg.close(); dlg.remove(); };
    dlg.append(
      h('h3', {}, title),
      content,
      h('div', { class: 'dlg-actions' }, ...actions.map(a =>
        h('button', {
          type: 'button',
          class: 'btn' + (a.ghost ? ' ghost' : ''),
          onclick: e => a.run(close, e.currentTarget)
        }, a.label))));
    dlg.addEventListener('cancel', () => dlg.remove());
    document.body.append(dlg);
    dlg.showModal();
    return dlg;
  }

  function field(def, value) {
    const input = def.type === 'textarea'
      ? h('textarea', { rows: 3 })
      : h('input', { type: def.type === 'number' ? 'number' : 'text', min: def.type === 'number' ? '0' : null });
    input.value = value == null ? '' : value;
    return {
      wrap: h('label', {}, def.label, input),
      read: () => def.type === 'number' ? Number(input.value) || 0 : input.value.trim()
    };
  }

  const pill = (label, onclick) => h('button', { type: 'button', class: 'adm-pill', onclick }, label);

  function toDataUrl(file, max, quality) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('That file could not be read as a photo.'));
      img.src = url;
    });
  }

  // keeps each photo small enough to live inside a Firestore document (1 MB limit)
  async function shrink(file, max) {
    let quality = 0.78;
    let data = await toDataUrl(file, max, quality);
    while (data.length > 700000 && quality > 0.4) {
      quality -= 0.1;
      data = await toDataUrl(file, max, quality);
    }
    return data;
  }

  function pickFiles(multiple, onPick) {
    const input = h('input', { type: 'file', accept: 'image/*', multiple, hidden: true });
    input.addEventListener('change', () => { if (input.files.length) onPick([...input.files]); input.remove(); });
    document.body.append(input);
    input.click();
  }

  /* ---------- sign in ---------- */

  function openLogin() {
    const email = field({ label: 'Email' }, '');
    const pass = field({ label: 'Password' }, '');
    pass.wrap.querySelector('input').type = 'password';
    email.wrap.querySelector('input').type = 'email';
    const problem = h('p', { class: 'dlg-error', role: 'alert' });

    async function go(close, btn) {
      problem.textContent = '';
      btn.disabled = true;
      try {
        await bck.auth.signInWithEmailAndPassword(email.read(), pass.wrap.querySelector('input').value);
        close();
      } catch (err) {
        problem.textContent = /network/.test(err.code || '') ? 'No connection. Try again.' : 'Wrong email or password.';
      } finally {
        btn.disabled = false;
      }
    }

    const dlg = openDialog('Staff sign in', h('div', {}, email.wrap, pass.wrap, problem), [
      { label: 'Cancel', ghost: true, run: close => close() },
      { label: 'Sign in', run: go }
    ]);
    dlg.addEventListener('keydown', e => {
      if (e.key === 'Enter') dlg.querySelector('.dlg-actions .btn:last-child').click();
    });
  }

  function addStaffLink() {
    const holder = document.querySelector('footer .wrap');
    if (!holder) return;
    holder.append(' · ', h('a', {
      href: '#', class: 'staff-link',
      onclick: e => {
        e.preventDefault();
        if (isStaff) return;
        bck.ready ? openLogin() : toast('Still connecting. Try again in a moment.');
      }
    }, 'Staff'));
  }

  function drawBar(user) {
    document.querySelectorAll('.adm-bar').forEach(el => el.remove());
    if (!isStaff) return;
    document.body.append(h('div', { class: 'adm-bar' },
      h('span', {}, 'Editing as ', user.email),
      h('button', { type: 'button', onclick: () => bck.auth.signOut() }, 'Sign out')));
  }

  /* ---------- editors ---------- */

  function editInfo(keys, title) {
    const cur = bck.current('info');
    const fields = keys.map(k => [k, field(INFO[k], cur[k])]);
    openDialog(title, h('div', {}, fields.map(f => f[1].wrap)), [
      { label: 'Cancel', ghost: true, run: close => close() },
      {
        label: 'Save',
        run: async (close, btn) => {
          const data = {};
          fields.forEach(([k, f]) => { data[k] = f.read(); });
          if (await attempt(btn, () => bck.db.collection('siteInfo').doc('main').set(data, { merge: true }))) {
            close();
            toast('Saved');
          }
        }
      }
    ]);
  }

  function editList(name, title) {
    const def = LISTS[name];
    const original = bck.current(name);
    const rows = original.map(item => ({ id: item.id, vals: Object.assign({}, item) }));
    const box = h('div', { class: 'rows' });

    const sync = () => rows.forEach(r => r.inputs && def.fields.forEach((f, i) => { r.vals[f.k] = r.inputs[i].read(); }));

    function draw() {
      box.replaceChildren(...rows.map((row, i) => {
        row.inputs = def.fields.map(f => field(f, row.vals[f.k]));
        const move = delta => () => {
          sync();
          const j = i + delta;
          if (j < 0 || j >= rows.length) return;
          [rows[i], rows[j]] = [rows[j], rows[i]];
          draw();
        };
        return h('fieldset', { class: 'rowedit' },
          h('div', { class: 'rowtools' },
            h('b', {}, `${def.noun} ${i + 1}`),
            h('button', { type: 'button', onclick: move(-1), 'aria-label': 'Move up' }, '↑'),
            h('button', { type: 'button', onclick: move(1), 'aria-label': 'Move down' }, '↓'),
            h('button', { type: 'button', onclick: () => { sync(); rows.splice(i, 1); draw(); } }, 'Remove')),
          row.inputs.map(x => x.wrap));
      }));
    }
    draw();

    const addRow = h('button', {
      type: 'button', class: 'adm-pill',
      onclick: () => { sync(); rows.push({ vals: {} }); draw(); }
    }, '+ Add another');

    openDialog(title, h('div', {}, box, addRow), [
      { label: 'Cancel', ghost: true, run: close => close() },
      {
        label: 'Save',
        run: async (close, btn) => {
          sync();
          const keep = rows.filter(r => r.vals[def.fields[0].k]);
          const ok = await attempt(btn, () => {
            const col = bck.db.collection(def.col);
            const batch = bck.db.batch();
            const kept = new Set(keep.map(r => r.id));
            original.forEach(o => { if (o.id && !kept.has(o.id)) batch.delete(col.doc(o.id)); });
            keep.forEach((r, i) => {
              const data = { order: i };
              def.fields.forEach(f => { data[f.k] = r.vals[f.k] == null ? '' : r.vals[f.k]; });
              batch.set(r.id ? col.doc(r.id) : col.doc(), data);
            });
            batch.set(bck.db.collection('siteInfo').doc('main'), { [def.flag]: true }, { merge: true });
            return batch.commit();
          });
          if (ok) { close(); toast('Saved'); }
        }
      }
    ]);
  }

  /* ---------- photos ---------- */

  function addPhotos(files) {
    const room = MAX_PHOTOS - bck.state.gallery.length;
    if (room <= 0) return toast(`The gallery holds ${MAX_PHOTOS} photos. Remove one first.`, true);
    (async () => {
      const batch = files.slice(0, room);
      try {
        for (let i = 0; i < batch.length; i++) {
          toast(`Adding photo ${i + 1} of ${batch.length}...`);
          const src = await shrink(batch[i], 1000);
          await bck.db.collection('siteGallery').add({ src, cap: '', order: -Date.now() });
        }
        toast(files.length > room ? `Added ${room}. The gallery holds ${MAX_PHOTOS}.` : 'Photos added');
      } catch (err) {
        toast(explain(err), true);
      }
    })();
  }

  function editCaption(item) {
    const cap = field({ label: 'Caption' }, item.cap);
    openDialog('Photo caption', cap.wrap, [
      { label: 'Cancel', ghost: true, run: close => close() },
      {
        label: 'Save',
        run: async (close, btn) => {
          if (await attempt(btn, () => bck.db.collection('siteGallery').doc(item.id).update({ cap: cap.read() }))) close();
        }
      }
    ]);
  }

  function decorateGallery() {
    document.querySelectorAll('#gal figure[data-id]').forEach(fig => {
      const item = bck.state.gallery.find(g => g.id === fig.dataset.id);
      if (!item) return;
      const run = fn => async () => { try { await fn(); } catch (err) { toast(explain(err), true); } };
      fig.append(h('div', { class: 'adm-tools' },
        h('button', { type: 'button', 'aria-label': 'Edit caption', onclick: () => editCaption(item) }, '✎'),
        h('button', {
          type: 'button', 'aria-label': 'Show first', title: 'Make this the big photo',
          onclick: run(() => bck.db.collection('siteGallery').doc(item.id).update({ order: Math.min(...bck.state.gallery.map(g => g.order)) - 1 }))
        }, '★'),
        h('button', {
          type: 'button', 'aria-label': 'Delete photo',
          onclick: run(async () => { if (confirm('Delete this photo?')) await bck.db.collection('siteGallery').doc(item.id).delete(); })
        }, '×')));
    });
  }

  /* ---------- put the buttons on the page ---------- */

  function decorate() {
    document.querySelectorAll('.edit-slot').forEach(slot => {
      slot.replaceChildren();
      if (!isStaff) return;
      const label = slot.dataset.label;
      const d = slot.dataset;
      if ('editGallery' in d) slot.append(pill(label, () => pickFiles(true, addPhotos)));
      if ('editPortrait' in d) {
        slot.append(pill(label, () => pickFiles(false, async files => {
          try {
            const src = await shrink(files[0], 800);
            await bck.db.collection('siteInfo').doc('main').set({ portrait: src }, { merge: true });
            toast('Photo updated');
          } catch (err) { toast(explain(err), true); }
        })));
      }
      if (d.editList) slot.append(pill(label, () => editList(d.editList, label)));
      if (d.editInfo) slot.append(pill(label, () => editInfo(d.editInfo.split(','), label)));
    });
    document.querySelectorAll('.adm-tools').forEach(el => el.remove());
    if (isStaff) decorateGallery();
  }

  /* ---------- start ---------- */

  addStaffLink();
  document.addEventListener('bck:data', decorate);

  bck.onReady(() => {
    bck.auth.onAuthStateChanged(user => {
      isStaff = !!user && staff.includes((user.email || '').toLowerCase());
      if (user && !isStaff) {
        const sample = staff.some(e => e.endsWith('@example.com'));
        toast(sample
          ? 'The staff list in firebase-config.js still has the sample emails.'
          : `${user.email} is not on the staff list in firebase-config.js.`, true);
        bck.auth.signOut();
        return;
      }
      document.body.classList.toggle('is-admin', isStaff);
      drawBar(user);
      decorate();
    });
  });
})();
