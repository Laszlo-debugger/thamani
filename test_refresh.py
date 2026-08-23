"""
Tests for the parts that run unattended. Run them before trusting a change:

    python src/test_refresh.py

These use captured page shapes rather than the live internet, so they pass in a
sandbox with no network and they keep passing when the market is closed.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import refresh          # noqa: E402
import derive           # noqa: E402

# The real closes for 20 Nov 2024, as printed on the source page that day.
SNAP = {"SCOM": (14.90, 1.2, 3_400_000), "EQTY": (47.00, -0.5, 2_100_000),
        "KCB": (37.55, 0.8, 1_800_000), "COOP": (14.55, 0.0, 900_000),
        "EABL": (180.00, -1.1, 40_000), "KPLC": (4.22, 2.4, 5_600_000),
        "KEGN": (4.00, -0.7, 3_100_000), "ABSA": (15.30, 1.0, 700_000),
        "SCBK": (236.00, 0.4, 30_000), "BAT": (351.00, -0.3, 8_000),
        "NCBA": (44.00, 0.6, 600_000), "DTK": (53.00, 0.0, 20_000),
        "SBIC": (127.00, -0.8, 15_000), "JUB": (167.75, 0.0, 3_000),
        "CGEN": (23.00, 0.0, 5_000), "NSE": (5.86, 1.7, 250_000),
        "KQ": (4.66, 0.0, 100_000), "TOTL": (18.00, 0.0, 40_000),
        "CRWN": (38.00, 0.0, 12_000), "BOC": (78.00, 0.0, 1_000),
        "UNGA": (14.00, 0.0, 2_000), "SASN": (18.00, 0.0, 3_000),
        "BRIT": (5.00, 0.0, 400_000), "KNRE": (1.80, 0.0, 800_000),
        "CARB": (11.00, 0.0, 60_000), "TPSE": (13.00, 0.0, 5_000),
        "LBTY": (4.00, 0.0, 90_000), "IMH": (17.00, 0.0, 500_000),
        "HFCB": (4.00, 0.0, 300_000), "SGL": (17.00, 0.0, 30_000),
        "WTK": (200.00, 0.0, 500), "KAPC": (90.00, 0.0, 400),
        "XPRS": (0.40, 0.0, 100_000), "EVRD": (1.00, 0.0, 50_000),
        "KUKZ": (300.00, 0.0, 200), "NMG": (16.00, 0.0, 20_000),
        "PORT": (5.00, 0.0, 10_000), "SMER": (3.00, 0.0, 5_000),
        "SCAN": (12.00, 0.0, 4_000), "UCHM": (0.30, 0.0, 200_000),
        "CIC": (2.00, 0.0, 600_000), "SLAM": (6.00, 0.0, 40_000)}

AFX_PAGE = """<html><body>
<h1>NSE TRADING SUMMARY FOR WEDNESDAY, NOVEMBER 20, 2024</h1>
<table><tr><th>Ticker</th><th>Name</th><th>Volume</th><th>Price</th><th>Change</th></tr>
{rows}
</table></body></html>""".format(rows="\n".join(
    f"<tr><td>{tk}</td><td>{tk} Ltd</td><td>{v:,}</td><td>{p:.2f}</td>"
    f"<td>{c:+.2f}</td></tr>" for tk, (p, c, v) in SNAP.items()))

# Same market, a different vendor: columns in another order, headings renamed,
# and a decoy summary table above the real one.
RICH_PAGE = """<html><body><p>Trading Day: 25 Oct 2021</p>
<table><tr><th>Index</th><th>Level</th></tr><tr><td>NASI</td><td>238.13</td></tr></table>
<table><tr><th>Code</th><th>Company</th><th>Now</th><th>Change</th><th>Volume</th></tr>
{rows}
</table></body></html>""".format(rows="\n".join(
    f"<tr><td>{tk}</td><td>{tk} Ltd.</td><td>{p:.2f}</td><td>{c:+.2f}</td>"
    f"<td>{v:,}</td></tr>" for tk, (p, c, v) in SNAP.items()))

FAILS = 0


def _refuses(fn, *a):
    """True when the function exits rather than returning a guess."""
    try:
        fn(*a)
    except SystemExit:
        return True
    except Exception:
        return True
    return False


def check(name, cond, detail=""):
    global FAILS
    print(("  ok   " if cond else "  FAIL ") + name + (f"  {detail}" if detail else ""))
    if not cond:
        FAILS += 1


def main():
    known = {c["tk"] for c in json.load(open(os.path.join(ROOT, "data/counters.json")))}

    print("source date recognition")
    check("afx heading", refresh.source_date(AFX_PAGE) == "2024-11-20",
          refresh.source_date(AFX_PAGE) or "none")
    check("rich.co.ke heading", refresh.source_date(RICH_PAGE) == "2021-10-25",
          refresh.source_date(RICH_PAGE) or "none")
    check("no date present", refresh.source_date("<html>nothing</html>") is None)

    print("\ncolumn identification, without being told the headings")
    quotes, mapping = refresh.parse_table(AFX_PAGE, known)
    check("found the ticker column", mapping["ticker"].lower().startswith("ticker"),
          mapping["ticker"])
    check("price column is Price", mapping["price"] == "Price", mapping["price"])
    check("volume column is Volume", mapping["volume"] == "Volume", mapping["volume"])
    check("change column is Change", mapping["change"] == "Change", str(mapping["change"]))
    check("Safaricom price", quotes.get("SCOM", {}).get("price") == 14.90,
          str(quotes.get("SCOM")))
    check("Kenya Power price", quotes.get("KPLC", {}).get("price") == 4.22)
    check("BAT price not confused with volume",
          quotes.get("BAT", {}).get("price") == 351.00, str(quotes.get("BAT")))
    check("volume read as an integer", quotes["SCOM"]["vol"] == 3_400_000)

    print("\ncolumn identification on a differently ordered page")
    q2, m2 = refresh.parse_table(RICH_PAGE, known)
    check("skipped the decoy table", m2["matched"] > 30, str(m2["matched"]))
    check("price still found under a renamed heading",
          q2.get("SCOM", {}).get("price") == 14.90, str(q2.get("SCOM")))
    check("volume still found when it is the last column",
          q2.get("SCOM", {}).get("vol") == 3_400_000, str(q2.get("SCOM")))
    check("a too-small table is refused rather than guessed",
          _refuses(refresh.parse_table, "<table><tr><td>SCOM</td><td>1</td></tr></table>",
                   known))

    print("\nrelative volume from our own history")
    hist = [{"SCOM": 1_000_000} for _ in range(10)]
    check("2x the average reads as 2.0",
          refresh.relative_volume("SCOM", 2_000_000, hist) == 2.0)
    check("too little history returns nothing, not a guess",
          refresh.relative_volume("SCOM", 2_000_000, hist[:3]) is None)

    print("\nmomentum ages out instead of lying")
    macro = json.load(open(os.path.join(ROOT, "data/macro.json")))
    c = {"tk": "X", "name": "X", "sec": "X", "price": 100.0, "chg": 0, "vol": 10_000_000,
         "eps": 10.0, "dps": 5.0, "epsg": 5.0, "payout": 50.0, "shares_out": 1_000_000_000,
         "rsi": 85.0, "rat": "Strong buy", "sentiment_asof": "2026-08-20",
         "flag": None, "note": ""}
    from datetime import date as D
    fresh = derive.derive(c, macro, today=D(2026, 8, 23))
    stale = derive.derive(c, macro, today=D(2026, 12, 1))
    check("fresh reading is kept", fresh["rsi"] == 85.0 and fresh["rsiu"] is False)
    check("stale reading is dropped", stale["rsi"] is None and stale["rsiu"] is True)
    check("an overbought counter fails the timing gate", fresh["g"][4] is False)
    check("an UNKNOWN counter also fails the timing gate", stale["g"][4] is False,
          "unknown must never read as calm")

    print("\nprice-driven fields are recomputed, never carried")
    c2 = dict(c, price=200.0)
    d2 = derive.derive(c2, macro, today=D(2026, 8, 23))
    check("P/E doubles when the price doubles", d2["pe"] == 20.0, str(d2["pe"]))
    check("yield halves when the price doubles", d2["dy"] == 2.5, str(d2["dy"]))
    check("market cap follows the price", d2["mcap"] == 200.0, str(d2["mcap"]))

    print("\nvalidate.py refuses a bad candidate")
    tmp = tempfile.mkdtemp()
    try:
        shutil.copytree(os.path.join(ROOT, "data"), os.path.join(tmp, "data"))
        shutil.copytree(os.path.join(ROOT, "src"), os.path.join(tmp, "src"))
        live = json.load(open(os.path.join(tmp, "data/counters.json")))
        # a parsing accident: two thirds of the market "moves" 80%
        bad = [dict(x, price=round(x["price"] * 1.8, 2)) for x in live]
        json.dump(bad, open(os.path.join(tmp, "data/counters.candidate.json"), "w"))
        json.dump({"matched": 57, "missing": [], "source_date": "2026-08-24",
                   "columns": {},
                   "moves": [{"tk": x["tk"], "from": 1, "to": 1.8, "pct": 80.0}
                             for x in live]},
                  open(os.path.join(tmp, "data/refresh_log.json"), "w"))
        r = subprocess.run([sys.executable, "src/validate.py"], cwd=tmp,
                           capture_output=True, text=True)
        check("rejected the mass move", r.returncode != 0, r.stdout.strip().split("\n")[0])
        after = json.load(open(os.path.join(tmp, "data/counters.json")))
        check("live data left untouched after a rejection",
              after[0]["price"] == live[0]["price"])

        # an edit where it has no business editing
        sneaky = [dict(x) for x in live]
        sneaky[0]["note"] = "rewritten by a scraper"
        json.dump(sneaky, open(os.path.join(tmp, "data/counters.candidate.json"), "w"))
        json.dump({"matched": 57, "missing": [], "source_date": "2026-08-24",
                   "columns": {}, "moves": []},
                  open(os.path.join(tmp, "data/refresh_log.json"), "w"))
        r = subprocess.run([sys.executable, "src/validate.py"], cwd=tmp,
                           capture_output=True, text=True)
        check("rejected an edited note", r.returncode != 0,
              r.stdout.strip().split("\n")[0])

        # a clean day should be accepted
        good = [dict(x, price=round(x["price"] * 1.01, 2)) for x in live]
        json.dump(good, open(os.path.join(tmp, "data/counters.candidate.json"), "w"))
        json.dump({"matched": 57, "missing": [], "source_date": "2026-08-24",
                   "columns": {},
                   "moves": [{"tk": x["tk"], "from": 1, "to": 1.01, "pct": 1.0}
                             for x in live]},
                  open(os.path.join(tmp, "data/refresh_log.json"), "w"))
        r = subprocess.run([sys.executable, "src/validate.py"], cwd=tmp,
                           capture_output=True, text=True)
        check("accepted a normal day", r.returncode == 0,
              r.stdout.strip().split("\n")[-1])
        promoted = json.load(open(os.path.join(tmp, "data/counters.json")))
        check("promoted the new prices",
              promoted[0]["price"] == good[0]["price"])
        m = json.load(open(os.path.join(tmp, "data/macro.json")))
        check("stamped the page with the source's own date",
              m["stamp_close"].startswith("2026-08-24"), m["stamp_close"])
    finally:
        shutil.rmtree(tmp)

    print(f"\n{'ALL PASS' if not FAILS else str(FAILS) + ' FAILED'}")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
