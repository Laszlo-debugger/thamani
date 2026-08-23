"""
Build the single deployable file: site/index.html

Reads data/counters.json, data/macro.json, data/editorial.json, runs the maths in
derive.py, and writes one self-contained HTML file with the data baked in. No
server, no database, no runtime requests except the Google Fonts stylesheet.

    python src/build.py

Exits non-zero if anything is missing, so a broken build never overwrites a
working page.
"""
import argparse
import json
import os
import sys
from datetime import date, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

from derive import derive_all, macro_block          # noqa: E402


def read(path):
    with open(os.path.join(ROOT, path), encoding="utf-8") as f:
        return f.read()


def read_json(path):
    return json.loads(read(path))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--today", help="YYYY-MM-DD; overrides the system date when ageing "
                                    "momentum readings. Use it to reproduce an old build.")
    args = ap.parse_args()
    today = datetime.strptime(args.today, "%Y-%m-%d").date() if args.today else date.today()

    counters = read_json("data/counters.json")
    macro = read_json("data/macro.json")
    ed = read_json("data/editorial.json")

    if len(counters) < 40:
        sys.exit(f"build refused: only {len(counters)} counters in data/counters.json")

    payload = dict(
        counters=derive_all(counters, macro, today=today),
        macro=macro["table"],
        cal=macro["calendar"],
        macroK=macro_block(macro),
        **ed,
    )

    fonts = read("src/fonts.txt").strip()
    css = read("src/css.txt")
    app = read("src/app.js")
    icons = read_json("src/icons.json")

    body = (
        "<title>Thamani &mdash; the Nairobi exchange, read honestly</title>\n" + fonts + "\n"
        "<style>\n" + css + "\n</style>\n"
        '<div id="app"></div>\n'
        "<script>window.__D=" + json.dumps(payload, separators=(",", ":"))
        + ";window.__ICO=" + json.dumps(icons, separators=(",", ":")) + ";</script>\n"
        "<script>\n" + app + "\n</script>\n"
    )

    # The page for your own domain needs to be a complete HTML document.
    page = (
        "<!doctype html>\n<html lang=\"en\">\n<head>\n"
        "<meta charset=\"utf-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n"
        "<meta name=\"description\" content=\"Every counter on the Nairobi Securities "
        "Exchange, measured against what the government pays risk-free. Not investment advice.\">\n"
        "<meta name=\"robots\" content=\"index,follow\">\n"
        "<meta property=\"og:title\" content=\"Thamani\">\n"
        "<meta property=\"og:description\" content=\"The Nairobi exchange, read against "
        "the risk-free rate. Enter your goal and your amount.\">\n"
        "</head>\n<body>\n" + body + "</body>\n</html>\n"
    )

    site = os.path.join(ROOT, "docs")
    os.makedirs(site, exist_ok=True)
    open(os.path.join(site, ".nojekyll"), "w").close()
    with open(os.path.join(site, "index.html"), "w", encoding="utf-8") as f:
        f.write(page)
    # ...and the bare fragment, for publishing as a Claude artifact.
    with open(os.path.join(site, "artifact.html"), "w", encoding="utf-8") as f:
        f.write(body)

    liquid = sum(1 for c in payload["counters"] if c["g"][0])
    print(f"built docs/index.html  {len(page):,} bytes")
    print(f"counters {len(counters)}  liquid at the default order {liquid}")
    print(f"momentum aged against {today}")
    print(f"close stamp {macro['stamp_close']}  news stamp {macro['stamp_news']}")


if __name__ == "__main__":
    main()
