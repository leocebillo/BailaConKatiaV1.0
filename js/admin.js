// Editing tools for Katia, her husband and Leo. Nothing here shows up unless a staff account is signed in.
(function () {
  const bck = window.bck;

  // If something needed for editing is missing, say so instead of failing silently.
  const problem = !bck ? 'js/db.js did not load'
    : !window.BCK_CONFIG ? 'js/firebase-config.js was not found'
    : !bck.configured ? 'js/firebase-config.js still has the placeholder Firebase keys'
    : !(bck.v >= 4 && bck.currentList && bck.openLightbox && bck.safeLink && bck.state && bck.state.text && bck.defaults && bck.defaults.lists)
      ? 'some files in the js folder are older copies (db.js, defaults.js, media.js or site.js)'
      : '';
  if (problem) return addSetupLink(problem);

  const { h } = bck;

  const staff = ((window.BCK_CONFIG || {}).adminEmails || []).map(e => e.toLowerCase());
  const MAX_PHOTOS = 12;
  let isStaff = false;
  let editing = true;   // staff can switch to a clean preview with the button in the gold bar

  // lists stored one document per item
  const LISTS = {
    classes: {
      col: 'siteClasses', flag: 'editedClasses', noun: 'Lesson',
      fields: [
        { k: 'name', label: 'Lesson name' },
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
        { k: 'tag', label: 'Badge, like "Most popular" (optional)' },
        { k: 'link', label: 'Payment link for this pass (optional, the shared link is used if empty)' }
      ],
      validate: items => items.some(i => i.link && !bck.safeLink(i.link)) ? 'Payment links must start with https://' : ''
    }
  };

  // short lists stored together in one document (siteInfo/lists)
  const DOC_LISTS = {
    faq: {
      noun: 'Question',
      fields: [{ k: 'q', label: 'Question' }, { k: 'a', label: 'Answer', type: 'textarea' }]
    },
    steps: {
      noun: 'Step',
      fields: [{ k: 't', label: 'Step name (example: Warm-up.)' }, { k: 'd', label: 'What happens', type: 'textarea' }]
    },
    perks: {
      noun: 'Perk',
      fields: [{ k: 't', label: 'Perk' }]
    },
    videos: {
      noun: 'Video',
      max: 3,
      hint: 'Paste a YouTube or Vimeo link (on YouTube, tap Share, then Copy link). Up to 3 videos.',
      fields: [{ k: 'url', label: 'Video link' }, { k: 'cap', label: 'Caption (optional)' }],
      validate: items => {
        const bad = items.find(i => !bck.parseVideo(i.url));
        return bad ? 'That is not a YouTube or Vimeo link: ' + bad.url : '';
      }
    }
  };

  const INFO = {
    address: { label: 'Studio address', type: 'textarea' },
    phone: { label: 'Phone' },
    hours: { label: 'Hours', type: 'textarea' },
    social: { label: 'Social media handle (example: @bailaconkatia)' },
    instagram: { label: 'Instagram link (https://...)' },
    facebook: { label: 'Facebook link (https://...)' },
    tiktok: { label: 'TikTok link (https://...)' },
    bio: { label: 'About Katia', type: 'textarea' },
    years: { label: 'Years teaching (example: 8+)' },
    students: { label: 'Students taught (example: 500+)' },
    styles: { label: 'Dance styles offered' },
    zelle: { label: 'Zelle email or phone' },
    cashapp: { label: 'Cash App name (example: $BailaConKatia)' },
    paylink: { label: 'Online payment link (paste the full https:// link from Deluxe)' }
  };

  const CONTACT_KEYS = ['address', 'phone', 'hours', 'social', 'instagram', 'facebook', 'tiktok'];
  const LINK_KEYS = ['paylink', 'instagram', 'facebook', 'tiktok'];
  const ABOUT_KEYS = ['bio', 'years', 'students', 'styles'];

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
  const siteDoc = id => bck.db.collection('siteInfo').doc(id);
  const removeField = () => firebase.firestore.FieldValue.delete();

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

  // shrinks a picture until its data fits under `limit` characters (Firestore documents hold 1 MB)
  async function shrink(file, max, limit = 700000) {
    let size = max;
    let quality = 0.8;
    let data = await toDataUrl(file, size, quality);
    while (data.length > limit && (quality > 0.5 || size > 500)) {
      if (quality > 0.5) quality -= 0.1;
      else size = Math.round(size * 0.85);
      data = await toDataUrl(file, size, quality);
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

  function applyMode() {
    document.body.classList.toggle('is-admin', isStaff);
    document.body.classList.toggle('editing', isStaff && editing);
  }

  function drawBar(user) {
    document.querySelectorAll('.adm-bar').forEach(el => el.remove());
    if (!isStaff) return;
    const toggle = h('button', { type: 'button', class: 'adm-toggle' }, editing ? 'Preview' : 'Edit');
    toggle.addEventListener('click', () => {
      editing = !editing;
      toggle.textContent = editing ? 'Preview' : 'Edit';
      applyMode();
    });
    document.body.append(h('div', { class: 'adm-bar' },
      h('span', {}, user.email),
      toggle,
      h('button', { type: 'button', onclick: () => bck.auth.signOut() }, 'Sign out')));
  }

  /* ---------- editors ---------- */

  // one text on the page: tap it, change it, save it. Empty text puts the original back.
  function editText(el) {
    const key = el.dataset.t;
    const saved = bck.state.text[key];
    const input = h('textarea', { rows: Math.min(8, Math.max(2, Math.ceil(el.textContent.length / 40))) });
    input.value = el.textContent;

    const actions = [{ label: 'Cancel', ghost: true, run: close => close() }];
    if (typeof saved === 'string' && saved) {
      actions.push({
        label: 'Reset',
        ghost: true,
        run: async (close, btn) => {
          if (await attempt(btn, () => siteDoc('text').set({ [key]: removeField() }, { merge: true }))) {
            close();
            toast('Back to the original text');
          }
        }
      });
    }
    actions.push({
      label: 'Save',
      run: async (close, btn) => {
        const value = input.value.trim();
        if (await attempt(btn, () => siteDoc('text').set({ [key]: value || removeField() }, { merge: true }))) {
          close();
          toast('Saved');
        }
      }
    });
    openDialog('Edit text', h('label', {}, 'Text on the site', input), actions);
    input.focus();
  }

  function editInfo(keys, title) {
    const cur = bck.current('info');
    const fields = keys.map(k => [k, field(INFO[k], cur[k])]);
    const problem = h('p', { class: 'dlg-error', role: 'alert' });
    openDialog(title, h('div', {}, fields.map(f => f[1].wrap), problem), [
      { label: 'Cancel', ghost: true, run: close => close() },
      {
        label: 'Save',
        run: async (close, btn) => {
          const data = {};
          fields.forEach(([k, f]) => { data[k] = f.read(); });
          if (LINK_KEYS.some(k => data[k] && !bck.safeLink(data[k]))) {
            problem.textContent = 'Links must start with https://';
            return;
          }
          if (await attempt(btn, () => siteDoc('main').set(data, { merge: true }))) {
            close();
            toast('Saved');
          }
        }
      }
    ]);
  }

  // rows you can edit, reorder, remove and add; shared by every list on the site
  function rowEditor(def, items) {
    const rows = items.map(item => ({ id: item.id, vals: Object.assign({}, item) }));
    if (!rows.length) rows.push({ vals: {} });
    const box = h('div', { class: 'rows' });
    const sync = () => rows.forEach(r => r.inputs && def.fields.forEach((f, i) => { r.vals[f.k] = r.inputs[i].read(); }));

    const add = h('button', {
      type: 'button', class: 'adm-pill',
      onclick: () => { sync(); rows.push({ vals: {} }); draw(); }
    }, '+ Add another');

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
      add.disabled = rows.length >= (def.max || Infinity);
    }
    draw();

    return {
      el: h('div', {}, def.hint ? h('p', { class: 'dlg-hint' }, def.hint) : null, box, add),
      // rows that were filled in, in their current order
      collect() {
        sync();
        return rows.filter(r => r.vals[def.fields[0].k]);
      }
    };
  }

  function editList(name, title) {
    const def = LISTS[name];
    const original = bck.current(name);
    const ed = rowEditor(def, original);
    const problem = h('p', { class: 'dlg-error', role: 'alert' });

    openDialog(title, h('div', {}, ed.el, problem), [
      { label: 'Cancel', ghost: true, run: close => close() },
      {
        label: 'Save',
        run: async (close, btn) => {
          const keep = ed.collect();
          const why = def.validate ? def.validate(keep.map(r => r.vals)) : '';
          problem.textContent = why;
          if (why) return;
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
            batch.set(siteDoc('main'), { [def.flag]: true }, { merge: true });
            return batch.commit();
          });
          if (ok) { close(); toast('Saved'); }
        }
      }
    ]);
  }

  function editDocList(name, title) {
    const def = DOC_LISTS[name];
    const ed = rowEditor(def, bck.currentList(name));
    const problem = h('p', { class: 'dlg-error', role: 'alert' });

    openDialog(title, h('div', {}, ed.el, problem), [
      { label: 'Cancel', ghost: true, run: close => close() },
      {
        label: 'Save',
        run: async (close, btn) => {
          const items = ed.collect().map(r => {
            const item = {};
            def.fields.forEach(f => { item[f.k] = r.vals[f.k] == null ? '' : r.vals[f.k]; });
            return item;
          });
          const why = def.validate ? def.validate(items) : '';
          problem.textContent = why;
          if (why) return;
          if (await attempt(btn, () => siteDoc('lists').set({ [name]: items }, { merge: true }))) {
            close();
            toast('Saved');
          }
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
          // the grid uses a small copy; the large one is only fetched when someone opens the photo
          const thumb = await shrink(batch[i], 520, 120000);
          const full = await shrink(batch[i], 1600, 850000);
          const ref = bck.db.collection('siteGallery').doc();
          const write = bck.db.batch();
          write.set(ref, { src: thumb, cap: '', order: -Date.now(), full: true });
          write.set(siteDoc('full_' + ref.id), { src: full });
          await write.commit();
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
          onclick: run(async () => {
            if (!confirm('Delete this photo?')) return;
            const gone = bck.db.batch();
            gone.delete(bck.db.collection('siteGallery').doc(item.id));
            gone.delete(siteDoc('full_' + item.id));
            await gone.commit();
          })
        }, '×')));
    });
  }

  /* ---------- put the buttons on the page ---------- */

  function decorate() {
    document.querySelectorAll('.edit-slot').forEach(slot => {
      slot.replaceChildren();
      if (!isStaff) return;
      const d = slot.dataset;
      const label = d.label;
      if ('editGallery' in d) slot.append(pill(label, () => pickFiles(true, addPhotos)));
      if ('editPortrait' in d) {
        slot.append(pill(label, () => pickFiles(false, async files => {
          try {
            const src = await shrink(files[0], 800);
            await siteDoc('main').set({ portrait: src }, { merge: true });
            toast('Photo updated');
          } catch (err) { toast(explain(err), true); }
        })));
      }
      if (d.editFlyer) {
        const n = d.editFlyer;
        const has = bck.state['flyer' + n] && bck.state['flyer' + n].src;
        slot.append(pill(has ? 'Replace flyer ' + n : 'Add flyer ' + n, () => pickFiles(false, async files => {
          try {
            await siteDoc('flyer' + n).set({ src: await shrink(files[0], 1800, 900000) });
            toast('Flyer saved');
          } catch (err) { toast(explain(err), true); }
        })));
        if (has) {
          slot.append(pill('Remove', async () => {
            if (!confirm('Remove this flyer?')) return;
            try { await siteDoc('flyer' + n).delete(); toast('Flyer removed'); } catch (err) { toast(explain(err), true); }
          }));
        }
      }
      if (d.editList) slot.append(pill(label, () => editList(d.editList, label)));
      if (d.editDocList) slot.append(pill(label, () => editDocList(d.editDocList, label)));
      if (d.editInfo) slot.append(pill(label, () => editInfo(d.editInfo.split(','), label)));
    });
    document.querySelectorAll('.adm-tools').forEach(el => el.remove());
    if (isStaff) decorateGallery();
  }

  // while editing, tapping any marked part of the page opens its editor instead of following links
  document.addEventListener('click', e => {
    if (!isStaff || !editing) return;
    if (e.target.closest('dialog, .adm-bar, .adm-tools, .edit-slot')) return;
    const hit = e.target.closest('[data-t], [data-info], [data-list-editor], [data-doc-list-editor]');
    if (!hit) return;
    e.preventDefault();
    e.stopPropagation();

    try {
      if (hit.dataset.t) return editText(hit);
      if (hit.dataset.info) {
        return CONTACT_KEYS.includes(hit.dataset.info)
          ? editInfo(CONTACT_KEYS, 'Edit contact info')
          : editInfo(ABOUT_KEYS, 'Edit bio and numbers');
      }
      if (hit.dataset.listEditor) return editList(hit.dataset.listEditor, hit.dataset.listEditor === 'classes' ? 'Edit lessons' : 'Edit passes');
      const titles = { faq: 'Edit questions', steps: 'Edit steps', perks: 'Edit perks' };
      editDocList(hit.dataset.docListEditor, titles[hit.dataset.docListEditor]);
    } catch (err) {
      console.error(err);
      toast('Could not open the editor: ' + err.message, true);
    }
  }, true);

  // staff should see a script problem instead of a page that quietly does nothing
  window.addEventListener('error', e => {
    if (isStaff) toast('Something broke on this page: ' + e.message, true);
  });

  /* ---------- start ---------- */

  addStaffLink();
  document.addEventListener('bck:data', decorate);

  bck.onReady(() => {
    bck.auth.onAuthStateChanged(user => {
      const was = isStaff;
      isStaff = !!user && staff.includes((user.email || '').toLowerCase());
      if (user && !isStaff) {
        const sample = staff.some(e => e.endsWith('@example.com'));
        toast(sample
          ? 'The staff list in firebase-config.js still has the sample emails.'
          : `${user.email} is not on the staff list in firebase-config.js.`, true);
        bck.auth.signOut();
        return;
      }
      applyMode();
      drawBar(user);
      decorate();
      if (isStaff && !was) toast('Tap any text with a dotted outline to change it.');
    });
  });

  // plain DOM on purpose: this runs when the normal helpers may be missing
  function addSetupLink(why) {
    console.warn('Staff editing is off: ' + why);
    const holder = document.querySelector('footer .wrap');
    if (!holder) return;
    const link = document.createElement('a');
    link.href = '#';
    link.className = 'staff-link';
    link.textContent = 'Staff';
    link.addEventListener('click', e => {
      e.preventDefault();
      const old = document.querySelector('.toast');
      if (old) old.remove();
      const note = document.createElement('div');
      note.className = 'toast bad';
      note.setAttribute('role', 'status');
      note.textContent = "Editing can't start: " + why + '. Upload every file from the update, then refresh.';
      document.body.append(note);
      setTimeout(() => note.remove(), 12000);
    });
    holder.append(' · ', link);
  }
})();
