#!/usr/bin/env python3
"""Bundle the site into one self-contained .html file.

CSS, JS and every image are inlined, so the result works from a USB stick,
an email attachment, or any host that only accepts a single file.

    python3 build-single-file.py            ->  dist/michael-grigoryan.html
"""
import base64
import pathlib
import re

ROOT = pathlib.Path(__file__).parent
OUT = ROOT / "dist" / "michael-grigoryan.html"


MIMES = {".svg": "image/svg+xml", ".mp4": "video/mp4", ".jpg": "image/jpeg"}


def data_uri(path: pathlib.Path) -> str:
    mime = MIMES.get(path.suffix, "image/jpeg")
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


def main() -> None:
    html = (ROOT / "index.html").read_text()
    css = (ROOT / "assets" / "styles.css").read_text()
    js = (ROOT / "assets" / "app.js").read_text()

    assets = {
        f"{d}/{p.stem}": data_uri(p)
        for d in ("full", "thumb")
        for p in sorted((ROOT / "images" / d).glob("*.jpg"))
    }

    # The script builds image paths by string concatenation; point it at a lookup
    # table of data URIs instead, and drop srcset (one resolution is all we have).
    js = js.replace(
        "img.src = 'images/thumb/' + w.slug + '.jpg';",
        "img.src = ASSETS['thumb/' + w.slug];",
    )
    js = js.replace(
        "    v.src = h.video;", "    v.src = ASSETS['video'];"
    ).replace(
        "    if (h.poster) v.poster = h.poster;", "    v.poster = ASSETS['poster'];"
    )
    js = re.sub(
        r"img\.srcset = 'images/thumb/'.*?w\.fw \+ 'w';",
        "img.srcset = '';",
        js,
        flags=re.S,
    )
    js = js.replace(
        "img.sizes = '(min-width: 76rem) 30vw, (min-width: 46rem) 45vw, 92vw';",
        "",
    )
    js = js.replace(
        "lbImg.src = 'images/full/' + w.slug + '.jpg';",
        "lbImg.src = ASSETS['full/' + w.slug];",
    )
    assets["video"] = data_uri(ROOT / "media" / "mayis-process.mp4")
    assets["poster"] = data_uri(ROOT / "media" / "mayis-poster.jpg")
    lookup = (
        "const ASSETS = {\n"
        + ",\n".join(f"  {k!r}: {v!r}" for k, v in assets.items())
        + "\n};\n"
    )

    # Inline styles, script and favicon; drop things a single file cannot use.
    html = html.replace(
        '<link rel="stylesheet" href="assets/styles.css">', f"<style>\n{css}\n</style>"
    )
    # the page normally fetches content.json; a single file cannot, so bake it in
    content = (ROOT / "content.json").read_text()
    html = html.replace(
        '<script src="assets/app.js"></script>',
        f"<script>\nwindow.SITE_CONTENT = {content};\n{lookup}{js}\n</script>",
    )
    html = html.replace(
        '<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">',
        f'<link rel="icon" href="{data_uri(ROOT / "assets" / "favicon.svg")}" type="image/svg+xml">',
    )
    html = html.replace('<link rel="manifest" href="site.webmanifest">', "")
    html = re.sub(r'\s*<link rel="preload"[^>]*>', "", html)
    html = html.replace('href="media/mayis-poster.jpg"', f'href="{assets["poster"]}"')

    # Absolute og:image URLs are left alone so link previews still work when hosted.

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(html)

    leftover = re.findall(r'(?<!/)(?<!\.art/)images/(?:full|thumb)/[\w-]+\.jpg', html)
    if leftover:
        print("WARNING: un-inlined image references remain:", set(leftover))
    print(f"{OUT}  ({OUT.stat().st_size / 1_048_576:.1f} MB)")


if __name__ == "__main__":
    main()
