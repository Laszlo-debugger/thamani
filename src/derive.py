"""
The maths. One place, so the daily refresh and the full rebuild can never disagree.

Nothing in this file fetches anything or decides anything editorial. It takes the
per-counter facts and the macro numbers and works out, for each counter:

  price-driven      P/E, dividend yield and market capitalisation are RECOMPUTED
                    from the price every build, never carried forward. A yield
                    quoted against last month's price is the commonest lie in
                    market data and this is where it gets prevented.
  turnover          price x shares traded  =  what one day of trading is worth
  net yield         the dividend after Kenya's 5% withholding tax on listed shares
  real yield        the same, less inflation, because that is the only honest version
  five gates        access, earnings quality, dividend cover, hurdle rate, timing
  goal scores       income / growth / safety, or None where the goal cannot be served

The gates are ordered deliberately. Access comes first because a share you cannot
buy at your size is not an opportunity, however cheap it looks.

Momentum and analyst ratings cannot be refreshed without a browser session, so
they carry the date they were captured. Once stale they are treated as UNKNOWN,
not as calm. An unknown is not a pass.
"""
from datetime import date, datetime

# Flags meaning "the printed profit is not repeatable" — these disqualify a
# counter from the earnings gate and from any growth score.
QUALITY_FLAGS = {"QUALITY", "TRAP"}

# How long a momentum reading is allowed to stand before it stops counting.
SENTIMENT_MAX_AGE_DAYS = 10


def gate_amount(order):
    """Your order must stay under 10% of a day's trading, so a day must be 10x it."""
    return order * 10


def _age_days(asof, today=None):
    if not asof:
        return 10_000
    today = today or date.today()
    try:
        d = datetime.strptime(asof, "%Y-%m-%d").date()
    except ValueError:
        return 10_000
    return (today - d).days


def derive(c, macro, order=None, today=None):
    """Return the counter with every computed field attached."""
    infl = macro["inflation"]
    divt = macro["div_tax"]
    intt = macro["int_tax"]
    tbn = macro["tbill_364"] * (1 - intt)          # risk-free, after tax
    order = order or macro["default_order"]

    price = c["price"]
    vol = c.get("vol") or 0
    eps = c.get("eps")
    dps = c.get("dps")
    eps_growth = c.get("epsg")
    payout = c.get("payout")
    flag = c.get("flag")

    # ── recomputed from the price, every single build
    pe = round(price / eps, 2) if (eps and eps > 0 and price) else None
    dy = round(dps / price * 100, 2) if (dps and price) else None
    mcap = round(c["shares_out"] * price / 1e9, 2) if c.get("shares_out") else None

    # ── momentum and rating, only if still fresh enough to mean anything
    stale = _age_days(c.get("sentiment_asof"), today) > SENTIMENT_MAX_AGE_DAYS
    rsi = None if stale else c.get("rsi")
    rating = None if stale else c.get("rat")

    turnover = price * vol
    net = round((dy or 0) * (1 - divt), 2)

    g1 = turnover >= gate_amount(order)                             # can you buy it
    g2 = pe is not None and pe > 0 and flag not in QUALITY_FLAGS     # is the profit real
    g3 = payout is not None and payout < 90 and (dy or 0) > 0        # is the dividend earned
    g4 = net > tbn                                                  # does it beat doing nothing
    g5 = (not stale) and rsi is None                                # are you early or late
    #    ^ an unverified momentum reading is not a pass. Unknown is unknown.

    # ── why a score is blank matters as much as the score. A beginner's first
    #    question about an empty cell is "what does that mean", and "we could not
    #    measure it" is a different answer from "it scored badly".
    why = {"income": None, "growth": None, "safety": None}

    income = None
    if not g1:
        why["income"] = "you cannot buy it at this size"
    elif not g3:
        why["income"] = ("pays no dividend" if not (dy or 0)
                         else "the dividend is not covered by earnings")
    elif flag in ("PAYOUT", "TRAP"):
        why["income"] = "flagged: the dividend is paid out of something other than profit"
    if g1 and g3 and flag not in ("PAYOUT", "TRAP"):
        income = net * 10
        if payout and payout > 80:
            income -= 15          # a payout that high is a countdown, not a yield
        if rsi:
            income -= 8           # you are arriving after the move
        if rating == "Sell":
            income -= 10

    growth = None
    if not g1:
        why["growth"] = "you cannot buy it at this size"
    elif not (pe and pe > 0):
        why["growth"] = "no positive earnings, so there is nothing to grow from"
    elif eps_growth is None:
        # This is the honest fix. Treating a missing figure as zero growth quietly
        # marks a company down for its reporting calendar rather than its results.
        why["growth"] = ("no published earnings-growth figure — not a zero, "
                         "an unknown. Nothing can be scored from it")
    if g1 and pe and pe > 0 and eps_growth is not None:
        growth = min(eps_growth, 80) * 0.5 + max(0, 15 - pe) * 1.5
        if pe > 20:
            growth -= 30          # already priced in
        if flag in ("QUALITY", "TRAP", "PAYOUT"):
            growth -= 40          # the growth is not the company's own
        if rsi:
            growth -= 12
        if rating == "Sell":
            growth -= 25

    safety = None
    if not g1:
        why["safety"] = "you cannot buy it at this size, which is the opposite of safe"
    elif not g2:
        why["safety"] = ("the printed profit is not repeatable" if flag in QUALITY_FLAGS
                         else "no positive earnings")
    elif not g3:
        why["safety"] = ("pays no dividend" if not (dy or 0)
                         else "the dividend is not covered by earnings")
    if g1 and g2 and g3:
        safety = 30.0 - (payout or 0) * 0.30
        if rsi:
            safety -= 25          # buying into a run is not safety
        safety += min(turnover / 1e7, 15)   # being able to get out again is safety
        if eps_growth is not None and eps_growth < 0:
            safety -= 25
        if rating == "Sell":
            safety -= 20
        if net < infl:
            safety -= 10          # losing to inflation slowly is still losing

    out = dict(c)
    out.update(
        pe=pe, dy=dy, mcap=mcap,
        rsi=rsi, rat=rating or "—", rsiu=stale, scwhy=why,
        to=round(turnover),
        net=net,
        real=round(net - infl, 2),
        g=[g1, g2, g3, g4, g5],
        pct=round(order / turnover * 100, 1) if turnover else None,
        sc=dict(
            income=round(income, 1) if income is not None else None,
            growth=round(growth, 1) if growth is not None else None,
            safety=round(safety, 1) if safety is not None else None,
        ),
    )
    return out


def derive_all(counters, macro, order=None, today=None):
    out = [derive(c, macro, order, today) for c in counters]
    # liquid counters first, then cheapest on trailing earnings
    out.sort(key=lambda x: (0 if x["g"][0] else 1,
                            x["pe"] if x["pe"] is not None else 9e9))
    return out


def macro_block(macro):
    """The scalars the page itself needs at runtime."""
    tbn = macro["tbill_364"] * (1 - macro["int_tax"])
    return dict(
        infl=macro["inflation"], cbr=macro["cbr"], t364=macro["tbill_364"],
        tbn=round(tbn, 2), order=macro["default_order"],
        gate=gate_amount(macro["default_order"]),
        divt=macro["div_tax"], intt=macro["int_tax"],
        stamp=macro["stamp_close"], news=macro["stamp_news"],
    )
