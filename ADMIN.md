# Editing the site

**https://michael-grigoryan.com/admin/**

Add works, reorder them, replace photographs, rewrite the biography, change the
contact details. Works on a laptop or a phone. No code, no GitHub account, no
password to remember.

## Signing in

1. Open the address above.
2. Type your email address.
3. Cloudflare emails you a six-digit code. Type that in.
4. You are in for a week.

Only two addresses are allowed — Marie's and Michael's. Anyone else is stopped
before the page even loads.

## Using it

**Works** — reorder with ↑ ↓, open one with **Edit** to change any field, or
replace its photograph. Photographs are resized in your browser to the two sizes
the site uses, so a full-size phone photo is fine to upload. **Add a work** asks
for a title and a short file name, then you add the picture.

**About** — the opening sentence, then the body with a blank line between
paragraphs. Start a paragraph with `>` and a space to set it as Michael
speaking; it appears as a quotation in his own voice. The facts list underneath
is label-and-value pairs.

**Contact** — the line, the email address, and the links.

**Front page** — the name, the line under it, the button, and the caption on the
film.

Then press **Publish**. The site rebuilds in about a minute.

## Photographing the work

The photograph is the website. Take the work out of any frame, lay it flat in
daylight — no direct sun, no flash — hold the phone directly overhead and
parallel to the paper, and fill the frame. Shoot it the way it hangs.

## How the security works

There is no password anywhere, and no token in the browser. Three separate
things have to line up:

1. **Cloudflare Access** stands in front of `/admin`. It checks you own one of
   the two allowed email addresses before the page loads at all.
2. **A Cloudflare Worker** does the saving. It re-checks Access's signature
   itself — a request that skipped the login is refused even if it somehow
   reached the Worker.
3. **The GitHub token lives on Cloudflare's servers**, never in anyone's
   browser. Editors have no credential to lose.

The real gate is your Gmail account, since the six-digit code goes there. **Turn
on Google's own two-factor authentication for both accounts** — that is what
actually protects the site.

The Worker will only ever write `content.json` and the two image folders.
Anything else is refused, so a mistake in the admin page cannot reach the rest
of the repository.

### Adding or removing an editor

Cloudflare dashboard → **Zero Trust → Access controls → Applications →
Michael Grigoryan — site admin → the "Marie and Michael" policy**, then add or
remove an email address. That is the whole thing. No tokens to issue or revoke.

Each change is committed under the name of whoever made it, so the history in
GitHub shows who did what.

## If something goes wrong

Every save is an ordinary Git commit, so nothing is ever lost. To undo, open
`MikMarie27/michael-grigoryan` on GitHub, go to **History** on `content.json`,
and restore an earlier version.

If it says someone else changed the file in the meantime, reload the page — it
picks up the newer version and you can reapply your edit.

If the panel says it cannot reach the server, you can still edit and press
**Download** to get a `content.json` to hand over. Nothing is lost.

## For whoever maintains this

- **Site:** GitHub Pages from `MikMarie27/michael-grigoryan`, branch `main`
- **Domain + proxy + login:** Cloudflare (`michael-grigoryan.com`)
- **Saving:** the `mg-admin-api` Worker, source in `worker/worker.js`

Redeploy the Worker after editing it:

```bash
npx wrangler deploy
```

Its settings live in `wrangler.toml`. The GitHub token is a secret and is not in
the repository:

```bash
npx wrangler secret put GITHUB_TOKEN
```

Watch it work, live:

```bash
npx wrangler tail
```

### Things the admin deliberately cannot do

- **Replace the film.** Put a new `.mp4` and poster in `media/` and edit the
  `hero` block of `content.json` by hand. `README.md` has the ffmpeg commands.
- **Delete image files.** Removing a work takes it off the site but leaves the
  `.jpg`s in the repository, so a mistake is always recoverable.
- **Edit the page title, description or social-card text.** Those live in
  `index.html` and change rarely.
