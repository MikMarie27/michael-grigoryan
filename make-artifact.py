#!/usr/bin/env python3
"""Strip the html/head/body wrapper off dist/michael-grigoryan.html so the page
can be published as a Claude Artifact (which supplies its own wrapper)."""
import re, pathlib, sys

src = pathlib.Path(__file__).parent / "dist" / "michael-grigoryan.html"
dest = pathlib.Path(sys.argv[1])

html = src.read_text()
head = html.split("</head>")[0]
body = html.split("<body>")[1].rsplit("</body>")[0]
style = re.search(r"<style>.*?</style>", head, re.S).group(0)

out = f"<title>Michael Grigoryan</title>\n{style}\n{body.strip()}\n"
assert not re.search(r"<(html|head|body)\b|<!doctype", out, re.I)
dest.write_text(out)
print(dest, f"{dest.stat().st_size/1_048_576:.1f} MB")
