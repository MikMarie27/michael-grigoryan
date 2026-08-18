# michael-grigoryan.com

A portfolio site for Michael Grigoryan. Plain HTML, CSS and JavaScript — no build
step, no framework, no dependencies. It will still work in ten years.

```
index.html              the page shell
content.json            everything the site says — works, biography, contact
admin/                  the editor Michael uses to change content.json
assets/styles.css       all styling (light + dark, follows the device setting)
assets/app.js           renders the page from content.json
images/originals/       untouched photographs as received — never edit these
images/thumb/           900px versions used in the grid
images/full/            1800px versions used in the viewer
media/                  the process film and its poster frame
build-single-file.py    bundles everything into one shareable .html
dist/                   output of the above
```

## Run it locally

```bash
python3 -m http.server 4321 --directory .
```

Then open http://localhost:4321.

## Add or change a work

Use the admin panel at `/admin/` — see `ADMIN.md`. It resizes photographs and
writes `content.json` for you.

By hand: put the two sizes in place and add an entry to `works` in
`content.json`.

```bash
sips -Z 900 -s format jpeg -s formatOptions 80 photo.jpg --out images/thumb/slug.jpg && sips -Z 1800 -s format jpeg -s formatOptions 82 photo.jpg --out images/full/slug.jpg
```

The `alt` text matters — it is what a blind visitor hears and what Google reads.
`tw`/`th` and `fw`/`fh` are the pixel sizes of those two files; they reserve the
right space so the page does not jump while images load.

## The process film

`media/mayis-process.mp4` is a time-lapse of «Մայիս» being drawn, and it is the
first thing on the page. It comes from the camera original in
`images/originals/mayis-process.mov` — 2160 × 3096, 25.7 Mbps — encoded at double
speed to 1280 × 894, 30fps, no audio, about 2.9 MB:

```bash
ffmpeg -i images/originals/mayis-process.mov -an -vf "setpts=0.5*PTS,scale=1280:-2:flags=lanczos" -r 30 -c:v libx264 -crf 26 -preset veryslow -pix_fmt yuv420p -movflags +faststart media/mayis-process.mp4
```

The poster frame is the last frame of the original, so the still shows the
finished drawing:

```bash
ffmpeg -sseof -0.2 -i images/originals/mayis-process.mov -frames:v 1 -q:v 2 /tmp/poster.jpg && sips -Z 1400 -s formatOptions 84 /tmp/poster.jpg --out media/mayis-poster.jpg
```

**Keep the camera original safe.** `images/originals/mayis-process.mov` is 52 MB,
so it is deliberately *not* in the repository — it lives on disk only and should
be backed up somewhere. Everything else is derived from it, and a phone-messenger
copy of the same film is far softer: the first version of this site used one and
the line work was mush.

If you change the size, update `hero.w` and `hero.h` in `content.json` to match.

It autoplays muted and loops. If the browser refuses — a background tab, low-power
mode, a data saver — it retries when the page becomes visible, and failing that
shows controls rather than a dead poster. Visitors who ask for reduced motion get
a still with controls and no autoplay.

## Photographing the work

The quality of the photograph is the quality of the website. The first batch
arrived rotated 90° and one was shot through frame glass; both were replaced with
flat reshoots, which are visibly better. `«Մայիս»` and `«Երևան»` were de-skewed
and cropped to the sheet.

- Take the work **out of the frame** — glass reflects.
- Flat on the floor or a table, in even daylight, no direct sun, no flash.
- Phone directly overhead and parallel to the paper, not at an angle.
- Fill the frame, then crop to the paper edge.
- Shoot in the orientation the work hangs in.

## Deploy

Already deployed. `MikMarie27/michael-grigoryan` on GitHub, served by GitHub
Pages from `main`, at **michael-grigoryan.com**. Pushing to `main` republishes
it; so does pressing Publish in the admin panel.

The `CNAME` file is what tells Pages the custom domain — leave it in place.

## One-file version

```bash
python3 build-single-file.py
```

Writes `dist/michael-grigoryan.html`, about 7 MB, with every image embedded. It
opens straight from a USB stick or an email attachment with no server. Useful
for showing the work on someone else's laptop with no internet.

## Before going live

- [ ] Replace `hello@example.com` in `index.html` with a real address.
- [ ] Replace `https://michael-grigoryan.com/` in the `canonical`, `og:url`,
      `og:image` and JSON-LD tags with the real domain.
- [ ] Fill in titles, years and dimensions in `assets/app.js`.
- [ ] See `CONTENT-TO-FILL.md`.
