"""
The gate between a fetch and a publish. Fails closed: if anything here looks
wrong, the candidate is thrown away and the live page keeps yesterday's numbers.

    python src/validate.py

A page showing yesterday's prices with yesterday's date on it is fine. A page
showing a price that came from a parsing accident is not, and no automation is
allowed to make that decision for itself.

Exit code 0 means the candidate was promoted to data/counters.json.
Any other exit code means nothing was changed.
"""
import json
import os
import sys
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# ── the rules
MIN_MATCHED = 40          # of 57 counters
MAX_DAILY_MOVE = 25.0     # per cent, single counter, single day
MAX_BIG_MOVERS = 6        # how many counters may move more than that at once
MAX_MISSING_PRICE = 0     # a counter with no price at all


def path(*p):
    return os.path.join(ROOT, *p)


def load(p):
    with open(path(p), encoding="utf-8") as f:
        return json.load(f)


def fail(msg):
    print(f"REJECTED  {msg}")
    print("The live data was not changed. The published page keeps its previous "
          "numbers and its previous date stamp.")
    sys.exit(1)


def main():
    cand_path = path("data/counters.candidate.json")
    if not os.path.exists(cand_path):
        print("no candidate to validate — nothing to do.")
        return 0

    live = {c["tk"]: c for c in load("data/counters.json")}
    cand = load("data/counters.candidate.json")
    log = load("data/refresh_log.json")
    macro = load("data/macro.json")

    checks = []

    if len(cand) != len(live):
        fail(f"the candidate has {len(cand)} counters, the live data has {len(live)}. "
             f"A counter cannot appear or vanish in a price refresh.")
    checks.append(f"counter count unchanged at {len(cand)}")

    if log["matched"] < MIN_MATCHED:
        fail(f"only {log['matched']} counters were found on the source page, "
             f"below the floor of {MIN_MATCHED}. Either the page changed shape or "
             f"the market did not trade.")
    checks.append(f"{log['matched']} counters matched on the source page")

    no_price = [c["tk"] for c in cand if not c.get("price") or c["price"] <= 0]
    if len(no_price) > MAX_MISSING_PRICE:
        fail(f"counters with no usable price: {', '.join(no_price)}")
    checks.append("every counter has a positive price")

    big = [m for m in log["moves"] if abs(m["pct"]) > MAX_DAILY_MOVE]
    if len(big) > MAX_BIG_MOVERS:
        detail = ", ".join(f"{m['tk']} {m['pct']:+.0f}%" for m in big[:8])
        fail(f"{len(big)} counters moved more than {MAX_DAILY_MOVE}% in one day "
             f"({detail}). The exchange has daily price limits, so this is far more "
             f"likely to be a parsing error than a market event.")
    if big:
        checks.append(f"{len(big)} counter(s) moved more than {MAX_DAILY_MOVE}% — "
                      f"within tolerance, but look at them: "
                      + ", ".join(f"{m['tk']} {m['pct']:+.0f}%" for m in big))
    else:
        checks.append(f"no counter moved more than {MAX_DAILY_MOVE}%")

    back = [c["tk"] for c in cand
            if c.get("price_asof") and live[c["tk"]].get("price_asof")
            and c["price_asof"] < live[c["tk"]]["price_asof"]]
    if back:
        fail(f"these counters would go backwards in time: {', '.join(back)}. "
             f"A price is only replaced by one with a later date on it.")
    checks.append("no counter's price date moved backwards")

    turnover = sum((c.get("price") or 0) * (c.get("vol") or 0) for c in cand)
    if turnover <= 0:
        fail("total turnover across all counters came out as zero.")
    checks.append(f"total turnover {turnover/1e6:,.1f}m shillings")

    # Fundamentals must be untouched. The refresh has no business editing them.
    for c in cand:
        l = live[c["tk"]]
        for k in ("eps", "dps", "epsg", "payout", "flag", "note", "name", "sec",
                  "shares_out", "rsi", "rat", "sentiment_asof"):
            if c.get(k) != l.get(k):
                fail(f"{c['tk']}: the refresh changed '{k}', which it must never do. "
                     f"Company facts and editorial only change by hand.")
    checks.append("no company fact or note was altered")

    for line in checks:
        print(f"  ok   {line}")

    # ── promote
    json.dump(cand, open(path("data/counters.json"), "w"), indent=1, ensure_ascii=False)
    os.remove(cand_path)

    if log.get("source_date"):
        macro["last_source_date"] = log["source_date"]
        macro["stamp_close"] = log["source_date"] + "T17:00:00+03:00"
    macro["last_refresh"] = date.today().isoformat()
    json.dump(macro, open(path("data/macro.json"), "w"), indent=1, ensure_ascii=False)

    print(f"\nACCEPTED  prices dated {log.get('source_date') or 'unknown'} are now live.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
