/* michael-grigoryan.com — the bit that actually saves.
 *
 * The admin page used to call GitHub directly, which meant whoever was editing
 * had to hold a GitHub token in their browser. This removes that entirely.
 *
 * How it works:
 *   1. Cloudflare Access already stands in front of /admin. Nobody reaches this
 *      Worker without having proved they own one of the allowed email addresses.
 *   2. Access attaches a signed token to every request it lets through. This
 *      Worker verifies that signature against Cloudflare's public keys before
 *      doing anything, so a request that skipped Access is refused.
 *   3. The GitHub token lives here, as a secret, and never leaves the server.
 *
 * The editor never has a credential. Removing someone is deleting their email
 * from the Access policy — no tokens to revoke, nothing to rotate.
 *
 * Secrets and variables it needs:
 *   GITHUB_TOKEN   secret   fine-grained token, this repo only, Contents: R/W
 *   GITHUB_REPO    var      e.g. MikMarie27/michael-grigoryan
 *   GITHUB_BRANCH  var      e.g. main
 *   TEAM_DOMAIN    var      e.g. cool-bird-60f5.cloudflareaccess.com
 *   ACCESS_AUD     var      the Access application's Application Audience tag
 */

import { ADMIN } from './assets.js';

const GITHUB = 'https://api.github.com';

// only these may ever be written, so a bug or a hostile request cannot reach
// workflow files, the Worker itself, or anything else in the repository
const WRITABLE = [
  /^content\.json$/,
  /^images\/(full|thumb)\/[a-z0-9-]+\.jpg$/,
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // The admin page is served from here, not from the public web server, so
    // there is no copy of it on the origin for anyone to fetch directly. Only
    // requests that came through Cloudflare — and therefore through Access —
    // can reach this code at all.
    if (!url.pathname.startsWith('/admin/api')) {
      const name = url.pathname.replace(/^\/admin\/?/, '');
      const asset = ADMIN[name];
      if (!asset) return new Response('Not found', { status: 404 });
      return new Response(asset.body, {
        headers: {
          'Content-Type': asset.type,
          // never cached: a stale copy outlives its session and then looks,
          // to whoever opens it, like a working editor
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'X-Robots-Tag': 'noindex, nofollow',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    const route = url.pathname.replace(/^\/admin\/api\/?/, '');

    let email;
    try {
      email = await identify(request, env);
    } catch (err) {
      return json({ error: err.message }, 401);
    }

    try {
      if (request.method === 'GET' && route === 'session') {
        return json({ email, repo: env.GITHUB_REPO, branch: env.GITHUB_BRANCH });
      }
      if (request.method === 'GET' && route === 'file') {
        return await readFile(url.searchParams.get('path'), env);
      }
      if (request.method === 'PUT' && route === 'file') {
        return await writeFile(await request.json(), email, env);
      }
      return json({ error: 'Not found' }, 404);
    } catch (err) {
      return json({ error: err.message }, err.status || 500);
    }
  },
};

/* ---------- who is asking ---------- */

async function identify(request, env) {
  const jwt =
    request.headers.get('Cf-Access-Jwt-Assertion') ||
    cookie(request, 'CF_Authorization');
  if (!jwt) throw new Error('Not signed in.');

  const [rawHeader, rawPayload, rawSig] = jwt.split('.');
  if (!rawSig) throw new Error('Malformed sign-in token.');

  const header = JSON.parse(text(rawHeader));
  const payload = JSON.parse(text(rawPayload));

  const certs = await fetch(`https://${env.TEAM_DOMAIN}/cdn-cgi/access/certs`)
    .then(r => r.json());
  const jwk = (certs.keys || []).find(k => k.kid === header.kid);
  if (!jwk) throw new Error('Sign-in token was not issued for this site.');

  const key = await crypto.subtle.importKey(
    'jwk', jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['verify']
  );
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', key,
    bytes(rawSig),
    new TextEncoder().encode(`${rawHeader}.${rawPayload}`)
  );
  if (!ok) throw new Error('Sign-in token failed verification.');

  const aud = [].concat(payload.aud || []);
  if (!aud.includes(env.ACCESS_AUD)) throw new Error('Sign-in token is for a different application.');
  if (payload.exp && payload.exp * 1000 < Date.now()) throw new Error('Sign-in has expired — reload the page.');
  if (!payload.email) throw new Error('Sign-in token carried no email address.');

  return payload.email;
}

const cookie = (request, name) => {
  const raw = request.headers.get('Cookie') || '';
  const hit = raw.split(';').map(s => s.trim()).find(s => s.startsWith(name + '='));
  return hit ? hit.slice(name.length + 1) : null;
};

const b64url = s => s.replace(/-/g, '+').replace(/_/g, '/');
const text = s => atob(b64url(s));
const bytes = s => Uint8Array.from(atob(b64url(s)), c => c.charCodeAt(0));

/* ---------- talking to GitHub ---------- */

const ghHeaders = env => ({
  Authorization: 'Bearer ' + env.GITHUB_TOKEN,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'michael-grigoryan-admin',
});

function guard(path) {
  if (!path || !WRITABLE.some(re => re.test(path))) {
    const err = new Error('That file is not editable from the admin panel.');
    err.status = 403;
    throw err;
  }
  return path;
}

async function readFile(path, env) {
  guard(path);
  const r = await fetch(
    `${GITHUB}/repos/${env.GITHUB_REPO}/contents/${path}?ref=${encodeURIComponent(env.GITHUB_BRANCH)}`,
    { headers: ghHeaders(env) }
  );
  if (r.status === 404) return json({ content: null, sha: null });
  if (!r.ok) return json({ error: `GitHub said ${r.status}.` }, 502);
  const body = await r.json();
  return json({ content: body.content, sha: body.sha });
}

async function writeFile(body, email, env) {
  const path = guard(body && body.path);
  if (typeof body.content !== 'string') {
    return json({ error: 'No file contents were sent.' }, 400);
  }

  // attribute the change without publishing anyone's address in a public repo
  const who = String(email).split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '');

  const payload = {
    message: `${body.message || 'Update ' + path} (${who})`,
    content: body.content,
    branch: env.GITHUB_BRANCH,
    author: { name: who, email: `${who}@users.noreply.michael-grigoryan.com` },
  };
  if (body.sha) payload.sha = body.sha;

  const r = await fetch(`${GITHUB}/repos/${env.GITHUB_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: ghHeaders(env),
    body: JSON.stringify(payload),
  });

  if (r.status === 409 || r.status === 422) {
    return json({ error: 'Someone else changed this file. Reload and try again.' }, 409);
  }
  if (!r.ok) {
    return json({ error: `GitHub refused to save ${path} (${r.status}).` }, 502);
  }
  const saved = await r.json();
  return json({ sha: saved.content.sha, by: who });
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
