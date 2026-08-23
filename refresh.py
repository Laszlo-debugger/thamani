"""
The daily job. Fetches one page — the all-counter table for the Nairobi exchange —
and writes a CANDIDATE copy of the counter data. It never touches the live data.

    python src/refresh.py              # write data/counters.candidate.json
    python src/refresh.py --dry-run    # print what would change, write nothing

What it updates:  price, change on the day, shares traded, and relative volume
                  (computed from this repo's own accumulated volume history).
What it never touches:  earnings per share, dividends, payout ratios, flags,
                  notes, news, the legal book — anything that needs a judgement.
                  Those change when a company reports, and a scraper cannot read
                  a results announcement.

Momentum and analyst ratings are deliberately NOT refreshed. They come from a
screener that needs a real browser session. Each counter carries the date its
reading was captured and derive.py stops counting it after ten days, so the page
degrades into honesty rather than into fiction.

Nothing here decides anything. validate.py decides whether the candidate is
allowed to become the live data.
"""
import argparse
import json
import os
import re
import sys
from datetime import date, datetime
from io import StringIO

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

SOURCE = "https://afx.kwayisi.org/nse/"
UA = ("Mozilla/5.0 (compatible; ThamaniBuild/1.0; +static site build, "
      "one request per day)")
VOL_HISTORY_DAYS = 20


def path(*p):
    return os.path.join(ROOT, *p)


def load(p, default=None):
    try:
        with open(path(p), encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        if default is None:
            raise
        return default


def fetch(url):
    import requests
    try:
        r = requests.get(url, headers={"User-Agent": UA}, timeout=45)
        r.raise_for_status()
    except Exception as e:
        sys.exit(f"refresh refused: could not reach {url}\n  {type(e).__name__}: {e}\n"
                 f"  Nothing was written. The published page keeps its previous prices\n"
                 f"  and its previous date stamp, which is the intended behaviour.\n"
                 f"  If this keeps happening the source may have moved or be blocking\n"
                 f"  automated requests — a person needs to look.")
    return r.text


def source_date(html):
    """The page prints its own trading date. That date is what dates the figures."""
    pats = [
        r"(?:SUMMARY FOR|Trading Day:?|as at)[\s:]*[A-Za-z]*,?\s*"
        r"([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})",
        r"(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})",
    ]
    for p in pats:
        m = re.search(p, html, re.IGNORECASE)
        if m:
            raw = re.sub(r"\s+", " ", m.group(1)).replace(",", "").strip().title()
            for fmt in ("%B %d %Y", "%d %b %Y", "%b %d %Y"):
                try:
                    return datetime.strptime(raw, fmt).date().isoformat()
                except ValueError:
                    continue
    return None


def num(v):
    if v is None:
        return None
    s = str(v).replace(",", "").replace("%", "").strip()
    if s in ("", "-", "—", "n/a", "N/A"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def parse_table(html, known, min_hits=30):
    """
    Find the quote table and identify its columns by what they contain rather than
    by what they are called, because column headings on these pages change without
    notice. Returns {ticker: {price, chg, vol}}.
    """
    import pandas as pd
    tables = pd.read_html(StringIO(html))
    best, best_hits = None, 0
    for t in tables:
        flat = t.astype(str)
        for col in flat.columns:
            hits = sum(1 for v in flat[col] if v.strip().upper() in known)
            if hits > best_hits:
                best, best_hits, tick_col = t, hits, col
    if best is None or best_hits < min_hits:
        sys.exit(f"refresh refused: no table on {SOURCE} matched at least "
                 f"{min_hits} known tickers (best was {best_hits}). The page layout has "
                 f"changed — a human needs to look before anything is published.")

    numeric = {}
    for col in best.columns:
        if col == tick_col:
            continue
        vals = [num(v) for v in best[col]]
        good = [v for v in vals if v is not None]
        if len(good) < best_hits * 0.6:
            continue
        numeric[col] = vals

    if len(numeric) < 2:
        sys.exit("refresh refused: fewer than two numeric columns found.")

    # Volume is the column with by far the largest typical value.
    # Price is the largest of what remains. Change is the one that goes negative.
    def med(col):
        g = sorted(v for v in numeric[col] if v is not None)
        return g[len(g) // 2] if g else 0

    cols = sorted(numeric, key=med, reverse=True)
    vol_col = cols[0]
    rest = cols[1:]
    chg_col = None
    for c in rest:
        neg = sum(1 for v in numeric[c] if v is not None and v < 0)
        if neg >= 3 and abs(med(c)) < 25:
            chg_col = c
            break
    price_col = next((c for c in rest if c != chg_col), None)
    if price_col is None:
        sys.exit("refresh refused: could not identify a price column.")

    out = {}
    ticks = [str(v).strip().upper() for v in best[tick_col]]
    for i, tk in enumerate(ticks):
        if tk not in known:
            continue
        price = numeric[price_col][i]
        if price is None or price <= 0:
            continue
        out[tk] = {
            "price": price,
            "chg": numeric[chg_col][i] if chg_col else None,
            "vol": int(numeric[vol_col][i] or 0),
        }
    return out, {"ticker": str(tick_col), "price": str(price_col),
                 "change": str(chg_col), "volume": str(vol_col),
                 "matched": len(out)}


def relative_volume(tk, vol, history):
    """Today's volume against this repo's own average. Honest and self-sufficient."""
    past = [d[tk] for d in history if tk in d and d[tk] > 0]
    past = past[-VOL_HISTORY_DAYS:]
    if len(past) < 5 or not vol:
        return None            # not enough of our own history yet — say so
    avg = sum(past) / len(past)
    return round(vol / avg, 2) if avg else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--source", default=SOURCE)
    ap.add_argument("--allow-same-date", action="store_true",
                    help="proceed even if the source shows the same trading date as "
                         "the last successful refresh")
    args = ap.parse_args()

    counters = load("data/counters.json")
    macro = load("data/macro.json")
    hist = load("data/volume_history.json", [])
    known = {c["tk"] for c in counters}

    html = fetch(args.source)
    quotes, mapping = parse_table(html, known)
    src_date = source_date(html)

    last = macro.get("last_source_date")
    if src_date and last and src_date == last and not args.allow_same_date:
        print(f"nothing to do: source still shows {src_date}, same as the last "
              f"successful refresh. Exiting without writing.")
        return 0

    today = date.today().isoformat()
    day_vols = {tk: q["vol"] for tk, q in quotes.items()}

    changes, missing, stale_src = [], [], []
    new = []
    for c in counters:
        c = dict(c)
        q = quotes.get(c["tk"])
        if not q:
            missing.append(c["tk"])
            new.append(c)
            continue
        # A price is only ever replaced by one with a LATER date on it. Sources
        # update at their own pace and some are days behind; overwriting Thursday
        # with Tuesday is worse than not fetching at all.
        if src_date and c.get("price_asof") and src_date <= c["price_asof"]:
            stale_src.append(c["tk"])
            new.append(c)
            continue
        old_price = c["price"]
        c["price"] = q["price"]
        if q["chg"] is not None:
            c["chg"] = q["chg"]
        c["vol"] = q["vol"]
        if src_date:
            c["price_asof"] = src_date
        rv = relative_volume(c["tk"], q["vol"], hist)
        c["relvol"] = rv if rv is not None else c.get("relvol")
        if old_price != q["price"]:
            pct = (q["price"] / old_price - 1) * 100 if old_price else 0
            changes.append((c["tk"], old_price, q["price"], pct))
        new.append(c)

    changes.sort(key=lambda x: -abs(x[3]))
    print(f"source            {args.source}")
    print(f"source date       {src_date or 'not found on the page'}")
    print(f"columns           {json.dumps(mapping)}")
    print(f"matched           {len(quotes)} of {len(counters)} counters")
    if missing:
        print(f"not on the page   {', '.join(missing)}")
    if stale_src:
        print(f"source older      {len(stale_src)} counters already held a later close — left alone")
    print(f"prices moved      {len(changes)}")
    for tk, a, b, pct in changes[:12]:
        print(f"   {tk:6} {a:>9.2f} -> {b:>9.2f}  {pct:+.1f}%")

    if args.dry_run:
        print("\ndry run: nothing written.")
        return 0

    json.dump(new, open(path("data/counters.candidate.json"), "w"),
              indent=1, ensure_ascii=False)
    hist = (hist + [day_vols])[-60:]
    json.dump(hist, open(path("data/volume_history.json"), "w"), indent=1)
    json.dump({"date": today, "source": args.source, "source_date": src_date,
               "matched": len(quotes), "missing": missing, "columns": mapping,
               "moves": [{"tk": t, "from": a, "to": b, "pct": round(p, 2)}
                         for t, a, b, p in changes]},
              open(path("data/refresh_log.json"), "w"), indent=1)
    print("\nwrote data/counters.candidate.json — run validate.py before it goes live.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
