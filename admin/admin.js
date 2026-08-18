/* Admin panel for michaelgrigoryan.art
 *
 * Reads content.json, lets you edit it, and writes it back to GitHub. GitHub
 * does the authenticating: every request carries a fine-grained access token
 * scoped to this one repository, and GitHub rejects it if it is wrong, expired
 * or revoked. There is no password check in this file to bypass — the token is
 * the credential, and it never leaves the browser except to api.github.com.
 *
 * Uploaded photographs are resized here, in a canvas, into the same two sizes
 * the site expects: 1800px for the viewer and 900px for the grid.
 */
(function () {
  'use strict';

  const API = 'https://api.github.com';
  const KEY = 'mg-admin';
  const FULL = 1800, THUMB = 900, Q_FULL = 0.82, Q_THUMB = 0.8;

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  let auth = null;      // { repo, branch, token } — null in offline mode
  let content = null;   // the working copy
  let shas = {};        // path -> blob sha, needed to update a file
  let pending = {};     // path -> base64 payload for images not yet published
  let dirty = false;

  /* ---------------- boot ---------------- */

  try { auth = JSON.parse(sessionStorage.getItem(KEY) || localStorage.getItem(KEY)); } catch (e) { auth = null; }
  auth && auth.token ? start() : showGate();

  function showGate() {
    $('#gate').hidden = false;
    $('#app').hidden = true;
  }

  $('#signin').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('#gate-err');
    err.hidden = true;
    const repo = $('#repo').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
    const cand = { repo, branch: $('#branch').value.trim() || 'main', token: $('#token').value.trim() };
    if (!/^[\w.-]+\/[\w.-]+$/.test(cand.repo)) return fail(err, 'That does not look like owner/repository.');

    const btn = e.target.querySelector('button');
    btn.disabled = true; btn.textContent = 'Checking…';
    try {
      const r = await fetch(`${API}/repos/${cand.repo}`, { headers: headers(cand) });
      if (r.status === 401) throw new Error('GitHub did not accept that token.');
      if (r.status === 404) throw new Error('No such repository, or the token cannot see it.');
      if (!r.ok) throw new Error('GitHub said ' + r.status + '.');
      const repoInfo = await r.json();
      if (!repoInfo.permissions || !repoInfo.permissions.push) {
        throw new Error('That token can read this repository but not write to it. It needs Contents: Read and write.');
      }
      auth = cand;
      localStorage.setItem(KEY, JSON.stringify(auth));
      start();
    } catch (ex) {
      fail(err, ex.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Sign in';
    }
  });

  function fail(node, msg) { node.textContent = msg; node.hidden = false; }

  $('#offline').addEventListener('click', () => { auth = null; start(); });

  $('#signout').addEventListener('click', () => {
    if (dirty && !confirm('There are unpublished changes. Sign out anyway?')) return;
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
    location.reload();
  });

  async function start() {
    $('#gate').hidden = true;
    $('#app').hidden = false;
    $('#save').textContent = auth ? 'Publish' : 'Download';
    try {
      content = await loadContent();
    } catch (ex) {
      toast(ex.message, 'bad');
      return;
    }
    fill();
    mark(false);
  }

  async function loadContent() {
    if (auth) {
      const r = await fetch(path('content.json') + '?ref=' + encodeURIComponent(auth.branch), { headers: headers(auth) });
      if (r.ok) {
        const j = await r.json();
        shas['content.json'] = j.sha;
        return JSON.parse(decodeURIComponent(escape(atob(j.content.replace(/\n/g, '')))));
      }
      if (r.status !== 404) throw new Error('Could not read content.json (' + r.status + ').');
    }
    const r2 = await fetch('../content.json', { cache: 'no-cache' });
    if (!r2.ok) throw new Error('Could not read content.json.');
    return r2.json();
  }

  const headers = a => ({
    Authorization: 'Bearer ' + a.token,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  });
  const path = p => `${API}/repos/${auth.repo}/contents/${p}`;

  /* ---------------- tabs ---------------- */

  $('#tabs').addEventListener('click', e => {
    const b = e.target.closest('button[data-tab]');
    if (!b) return;
    $$('#tabs button').forEach(x => x.classList.toggle('on', x === b));
    $$('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== b.dataset.tab; });
  });

  /* ---------------- filling the form ---------------- */

  function fill() {
    const s = content.site || (content.site = {});
    const h = content.hero || (content.hero = {});
    set('#s-name', s.name); set('#s-lede', s.lede); set('#s-meta', s.meta); set('#s-cta', s.cta);
    set('#h-caption', h.caption); set('#h-alt', h.alt);

    const a = content.about || (content.about = {});
    set('#a-opening', a.opening);
    set('#a-paras', (a.paragraphs || []).join('\n\n'));
    facts();

    const c = content.contact || (content.contact = {});
    set('#c-line', c.line); set('#c-email', c.email);
    links();

    works();
    bindSimple();
  }

  const set = (sel, v) => { const n = $(sel); if (n) n.value = v || ''; };

  function bindSimple() {
    const map = {
      '#s-name': ['site', 'name'], '#s-lede': ['site', 'lede'],
      '#s-meta': ['site', 'meta'], '#s-cta': ['site', 'cta'],
      '#h-caption': ['hero', 'caption'], '#h-alt': ['hero', 'alt'],
      '#a-opening': ['about', 'opening'],
      '#c-line': ['contact', 'line'], '#c-email': ['contact', 'email']
    };
    Object.entries(map).forEach(([sel, [a, b]]) => {
      const n = $(sel);
      n.oninput = () => { content[a][b] = n.value; mark(true); };
    });
    $('#a-paras').oninput = () => {
      content.about.paragraphs = $('#a-paras').value.split(/\n\s*\n/).map(t => t.trim()).filter(Boolean);
      mark(true);
    };
  }

  /* ---------------- facts + links ---------------- */

  function pairs(host, list, aKey, bKey, aLabel, bLabel, placeholder) {
    host.textContent = '';
    list.forEach((item, i) => {
      const row = document.createElement('div');
      row.className = 'pair';
      row.innerHTML =
        `<label>${aLabel}<input type="text"></label>` +
        `<label>${bLabel}<input type="text" placeholder="${placeholder || ''}"></label>` +
        `<button class="ghost icon" type="button" aria-label="Remove">✕</button>`;
      const [ia, ib] = row.querySelectorAll('input');
      ia.value = item[aKey] || ''; ib.value = item[bKey] || '';
      ia.oninput = () => { item[aKey] = ia.value; mark(true); };
      ib.oninput = () => { item[bKey] = ib.value; mark(true); };
      row.querySelector('button').onclick = () => { list.splice(i, 1); mark(true); rerender(); };
      host.append(row);
    });
  }

  const facts = () => pairs($('#facts'), content.about.facts || (content.about.facts = []), 'label', 'value', 'Label', 'Value');
  const links = () => pairs($('#links'), content.contact.links || (content.contact.links = []), 'label', 'url', 'Name', 'Address', 'https://');

  function rerender() { facts(); links(); }

  $('#add-fact').onclick = () => { content.about.facts.push({ label: '', value: '' }); mark(true); facts(); };
  $('#add-link').onclick = () => { content.contact.links.push({ label: '', url: '' }); mark(true); links(); };

  /* ---------------- works ---------------- */

  function works() {
    const host = $('#works');
    host.textContent = '';
    (content.works || (content.works = [])).forEach((w, i) => host.append(workRow(w, i)));
  }

  function workRow(w, i) {
    const node = $('#work-tpl').content.firstElementChild.cloneNode(true);
    const q = sel => node.querySelector(sel);

    const thumb = q('.work-thumb');
    thumb.src = pending['images/thumb/' + w.slug + '.jpg']
      ? 'data:image/jpeg;base64,' + pending['images/thumb/' + w.slug + '.jpg']
      : '../images/thumb/' + w.slug + '.jpg';
    thumb.alt = '';
    thumb.onerror = () => { thumb.removeAttribute('src'); };

    const head = () => {
      q('[data-role=heading]').textContent = w.title || 'Untitled';
      q('[data-role=sub]').textContent = [w.titleEn, w.year].filter(Boolean).join(' · ');
      q('[data-role=slug]').textContent = 'images/…/' + w.slug + '.jpg';
    };
    head();

    node.querySelectorAll('[data-f]').forEach(inp => {
      inp.value = w[inp.dataset.f] || '';
      inp.oninput = () => { w[inp.dataset.f] = inp.value; head(); mark(true); };
    });

    q('[data-act=toggle]').onclick = () => {
      const body = q('.work-body');
      body.hidden = !body.hidden;
      q('[data-act=toggle]').textContent = body.hidden ? 'Edit' : 'Close';
    };
    q('[data-act=up]').onclick = () => move(i, -1);
    q('[data-act=down]').onclick = () => move(i, 1);
    q('[data-act=delete]').onclick = () => {
      if (!confirm('Delete “' + (w.title || 'this work') + '” from the site?\n\nThe image files stay in the repository.')) return;
      content.works.splice(i, 1); mark(true); works();
    };
    q('[data-act=file]').onchange = e => {
      const f = e.target.files && e.target.files[0];
      if (f) intake(f, w).then(() => { works(); toast('Photograph ready — press ' + (auth ? 'Publish' : 'Download') + '.', 'good'); });
    };
    return node;
  }

  function move(i, d) {
    const j = i + d;
    if (j < 0 || j >= content.works.length) return;
    const [x] = content.works.splice(i, 1);
    content.works.splice(j, 0, x);
    mark(true); works();
  }

  $('#add').onclick = () => {
    const title = prompt('Title of the work (Armenian is fine):');
    if (title === null) return;
    const slug = prompt('Short name for the image file — lowercase, no spaces:', slugify(title));
    if (!slug) return;
    content.works.unshift({
      slug: slugify(slug), title: title.trim(), titleEn: '', year: String(new Date().getFullYear()),
      size: '', medium: 'Ink, marker and gouache on paper', alt: '',
      tw: THUMB, th: THUMB, fw: FULL, fh: FULL
    });
    mark(true); works();
    toast('Now open it and add the photograph.', 'good');
  };

  const slugify = t => (t || 'work').toLowerCase()
    .replace(/[«»"'']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'work';

  /* ---------------- images ---------------- */

  async function intake(file, w) {
    toast('Resizing…');
    const img = await bitmap(file);
    const full = await squash(img, FULL, Q_FULL);
    const thumb = await squash(img, THUMB, Q_THUMB);
    pending['images/full/' + w.slug + '.jpg'] = full.b64;
    pending['images/thumb/' + w.slug + '.jpg'] = thumb.b64;
    w.fw = full.w; w.fh = full.h;
    w.tw = thumb.w; w.th = thumb.h;
    mark(true);
  }

  function bitmap(file) {
    if (window.createImageBitmap) return createImageBitmap(file);
    return new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('That file is not an image this browser can read.'));
      i.src = URL.createObjectURL(file);
    });
  }

  function squash(img, edge, quality) {
    const scale = Math.min(1, edge / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d', { alpha: false }).drawImage(img, 0, 0, w, h);
    return new Promise(res => {
      c.toBlob(async blob => {
        const buf = new Uint8Array(await blob.arrayBuffer());
        let bin = '';
        for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
        res({ w, h, b64: btoa(bin) });
      }, 'image/jpeg', quality);
    });
  }

  /* ---------------- saving ---------------- */

  function mark(d) {
    dirty = d;
    $('#state').textContent = d ? 'Unpublished changes' : (auth ? 'Up to date' : 'Offline');
    $('#state').classList.toggle('dirty', d);
  }

  window.addEventListener('beforeunload', e => {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  $('#save').onclick = async () => {
    const btn = $('#save');
    const json = JSON.stringify(content, null, 2) + '\n';

    if (!auth) {
      download('content.json', json);
      if (Object.keys(pending).length) {
        toast('content.json downloaded. New photographs cannot be downloaded offline — sign in to publish them.', 'bad');
      } else {
        toast('content.json downloaded. Put it in the site folder.', 'good');
      }
      return;
    }

    btn.disabled = true;
    const files = Object.entries(pending).concat([['content.json', b64(json)]]);
    try {
      for (let i = 0; i < files.length; i++) {
        const [p, data] = files[i];
        btn.textContent = `Publishing ${i + 1}/${files.length}…`;
        await put(p, data);
      }
      pending = {};
      mark(false);
      toast('Published. The site rebuilds in a minute or so.', 'good');
    } catch (ex) {
      toast(ex.message, 'bad');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Publish';
    }
  };

  async function put(p, base64) {
    if (!(p in shas)) {
      const head = await fetch(path(p) + '?ref=' + encodeURIComponent(auth.branch), { headers: headers(auth) });
      if (head.ok) shas[p] = (await head.json()).sha;
    }
    const body = {
      message: 'Update ' + p + ' from the admin panel',
      content: base64,
      branch: auth.branch
    };
    if (shas[p]) body.sha = shas[p];

    const r = await fetch(path(p), { method: 'PUT', headers: headers(auth), body: JSON.stringify(body) });
    if (r.status === 409 || r.status === 422) {
      delete shas[p];
      throw new Error('Someone else changed ' + p + ' in the meantime. Reload the page and try again.');
    }
    if (!r.ok) throw new Error('GitHub refused to save ' + p + ' (' + r.status + ').');
    shas[p] = (await r.json()).content.sha;
  }

  const b64 = str => btoa(unescape(encodeURIComponent(str)));

  function download(name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  /* ---------------- toast ---------------- */

  let toastTimer;
  function toast(msg, kind) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, kind === 'bad' ? 8000 : 4000);
  }
})();
