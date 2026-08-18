# Editing the site without touching code

There is an admin panel at **https://mikmarie27.github.io/michael-grigoryan/admin/**. Michael can use it from
a laptop or a phone to add works, reorder them, replace photographs, rewrite the
biography and change the contact details. It writes to `content.json`, which is
what the site reads.

It cannot work from the Claude artifact link — that link is a single frozen file
with no network access. **The admin only works on the deployed site.**

---

## It is already set up

- **Repository:** `MikMarie27/michael-grigoryan`
- **Host:** GitHub Pages, serving the `main` branch
- **Live at:** https://mikmarie27.github.io/michael-grigoryan/
- **Domain:** michael-grigoryan.com — bought (order 4165950630) but still being
  provisioned by GoDaddy. Run `./go-live.sh` once it resolves.

Every save from the admin panel commits to that repository, and GitHub Pages
rebuilds the site within about a minute. Nothing else has to be run.

## Making Michael a token

This is his key to the site. It takes two minutes and he should do it himself,
on his own GitHub account, so it belongs to him.

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens**
2. **Generate new token.** Name it something like "site admin". Set an expiry —
   90 days is sensible; he can make a new one when it lapses.
3. **Repository access → Only select repositories** → pick `michael-grigoryan`.
4. **Permissions → Repository permissions → Contents → Read and write.**
   Leave everything else on "No access".
5. Generate, and copy it. GitHub shows it once.

Then open https://mikmarie27.github.io/michael-grigoryan/admin/ and enter:

- **Repository:** `MikMarie27/michael-grigoryan`
- **Branch:** `main`
- **Access token:** the one just generated

That is the whole sign-in. 
## How the login actually works

There is no password check in the JavaScript — that kind of check is decoration,
because anyone can read the code and skip past it. Instead **GitHub does the
authenticating.** Every save is an API call carrying the token, and GitHub
refuses it if the token is wrong, expired, revoked, or not allowed to write to
this repository. Deleting the code cannot get anyone in.

What this does mean:

- **The token is stored in this browser's `localStorage`.** Anyone who can use
  that unlocked device can publish to the site. Treat it like being left signed
  into email. **Sign out** clears it.
- **Only put it on devices Michael controls.** Not a shared or public computer.
- **Scope it to one repository, Contents only.** A token with wider access would
  be a much bigger problem if it leaked.
- **Set an expiry**, so a forgotten token stops working on its own.
- If a token is ever exposed, revoke it on GitHub and make a new one. Nothing
  else needs changing.

If you would rather he signed in with an email address and password, the usual
answer is [Decap CMS](https://decapcms.org) with Netlify Identity — that adds a
real login server, at the cost of tying the site to Netlify. The panel here was
chosen because it needs no server at all.

## Using it

**Works** — reorder with ↑ ↓, open one with **Edit**, change any field, or
replace its photograph. New photographs are resized in the browser to the two
sizes the site uses (1800px for the viewer, 900px for the grid), so a 4000px
phone photo is fine to upload directly. **Add a work** asks for a title and a
short file name, then you add the picture.

**About** — the opening sentence and then the body, one paragraph per blank line.
The facts list underneath is label-and-value pairs.

**Contact** — the line, the email address, and the links.

**Front page** — the name, the line under it, the button, and the caption on the
film.

Press **Publish**. It commits each changed file, and the host rebuilds in about a
minute. The button says **Download** instead if you chose "edit without signing
in" — that gives you a `content.json` to hand over.

## Things it deliberately does not do

- **Replace the film.** Put a new `.mp4` and poster in `media/` and edit the
  `hero` block of `content.json` by hand. See `README.md` for the ffmpeg
  commands.
- **Delete image files.** Removing a work takes it off the site but leaves the
  `.jpg`s in the repository, so a mistake is always recoverable.
- **Edit the page title, description or social-card text.** Those live in
  `index.html` and change rarely.

## If something goes wrong

Every save is an ordinary Git commit, so nothing is ever lost. To undo, open the
repository on GitHub, go to **History** on `content.json`, and restore an earlier
version.

If the panel says someone else changed a file in the meantime, reload the page —
it will pick up the newer version and you can reapply your edit.
