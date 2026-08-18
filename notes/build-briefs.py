#!/usr/bin/env python3
"""Build the Tigran brief in both languages: artifact fragments + print-ready docs."""
import pathlib, re

HERE = pathlib.Path(__file__).parent
EN = HERE / "tigran-brief.html"          # artifact fragment: <title> + <style> + body

src = EN.read_text()
style = re.search(r"<style>.*?</style>", src, re.S).group(0)
en_body = src.split("</style>", 1)[1].strip()
hy_body = (HERE / "brief-hy-body.html").read_text().strip()

HY_FONTS = """
:root{
  --serif: Mshtakan, "Noto Serif Armenian", Sylfaen, ui-serif, Georgia, serif;
  --sans: -apple-system, "SF Armenian", "Noto Sans Armenian", Sylfaen,
    BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
h1,h2,h3{ letter-spacing:0; }
.eyebrow{ letter-spacing:.08em; }
"""

PRINT = """
@page { size: A4; margin: 18mm 15mm 16mm; }

@media print {
  :root{
    --paper:#fff; --card:#fff; --ink:#111; --ink-2:#333; --ink-3:#666;
    --rule:#c9c4cd; --accent:#a3134c; --accent-soft:#fbeef3;
    --flag:#7a4e00; --flag-soft:#fdf3e0; --shadow:none;
  }
  html,body{ background:#fff !important; color:#111 !important;
    font-size:10.5pt; line-height:1.5;
    -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .wrap{ max-width:none; margin:0; padding:0; }

  h1{ font-size:24pt; }
  .standfirst{ font-size:11.5pt; margin-bottom:14pt; max-width:none; }
  h2{ font-size:14pt; }
  h3{ font-size:10.5pt; }
  .pull{ font-size:11.5pt; }

  /* the section number sits inline when there is no margin to hang it in */
  h2 .n{ position:static !important; }

  section{ margin-top:14pt; padding-top:11pt; break-before:auto; }
  h1,h2,h3{ break-after:avoid; page-break-after:avoid; }
  .card,.no,.pull,.qs li,.check li,figure{ break-inside:avoid; page-break-inside:avoid; }
  .card{ box-shadow:none; border:1px solid var(--rule); }

  /* empty boxes to tick with a pen */
  .check input{ border:1.2px solid #555 !important; background:#fff !important; }

  a{ color:#111; text-decoration:underline; }
  .foot{ font-size:8.5pt; }
}
"""


def doc(lang: str, title: str, body: str, extra: str) -> str:
    return (
        "<!doctype html>\n"
        f'<html lang="{lang}">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        f"<title>{title}</title>\n"
        f"{style}\n<style>{extra}{PRINT}</style>\n</head>\n<body>\n{body}\n</body>\n</html>\n"
    )


(HERE / "print-en.html").write_text(doc("en", "Meeting Tigran Tsitoghdzyan", en_body, ""))
(HERE / "print-hy.html").write_text(doc("hy", "Հանդիպում Տիգրան Ցիտողձյանի հետ", hy_body, HY_FONTS))

# artifact fragment for the Armenian page
(HERE / "tigran-brief-hy.html").write_text(
    "<title>Հանդիպում Տիգրանի հետ</title>\n"
    + style + f"\n<style>{HY_FONTS}{PRINT}</style>\n" + hy_body + "\n"
)
print("built print-en.html, print-hy.html, tigran-brief-hy.html")
