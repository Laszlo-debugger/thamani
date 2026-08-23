# Thamani

The Nairobi Securities Exchange, every counter measured against what the
government pays you risk-free.

It asks two questions before it shows you anything — what the money is for, and
how much of it there is — because the answer genuinely changes. At 100,000
shillings, 28 of the 57 counters are buyable. At 5 million, five are.

One HTML file. No server, no database, no tracking, no analytics, and no requests
off the page except a font stylesheet.

## What is here

```
data/counters.json      the 57 counters: prices, and the company facts
data/macro.json         rates, taxes, inflation, the calendar
data/editorial.json     news, the legal book, the debt book, the teaching,
                        the news reads, the verified price history
src/derive.py           the maths: gates, yields, scores. One source of truth.
src/build.py            data + assets -> docs/index.html
src/refresh.py          the daily price fetch. Writes a candidate, never live data.
src/validate.py         the gate. Fails closed.
src/test_refresh.py     tests for everything that runs unattended
docs/index.html         the built page. Generated — never edit it by hand.
METHOD.md               why it works this way, and the mistakes already paid for
DEPLOY.md               how to get it onto your own domain
```

## Running it

```bash
pip install -r requirements.txt
python src/test_refresh.py     # 30 checks, no network needed
python src/build.py            # rebuilds docs/index.html
```

## How it updates itself

A GitHub Actions job runs **every 15 minutes while the market is open** (09:00-15:00
East Africa Time, weekdays) plus once after the close. It fetches one page,
updates prices, volumes and its own relative-volume history, recomputes P/E,
yields and market caps from the new prices, and rebuilds the page.

Be clear about what that cadence buys. The source publishes one table per trading
day, so polling more often does not produce intraday prices — no free source of
those exists. What it buys is latency: the new close reaches the page within 15
minutes of being published instead of hours later. Cost is near zero, because
`refresh.py` reads the trading date the source prints on itself and exits at once
when it has not changed. Of about 28 runs a day, one does any work.

**A price is only ever replaced by one with a later date on it.** Sources update
at their own pace and some lag by days; overwriting Thursday's close with
Tuesday's is worse than not fetching at all. Each counter carries its own
`price_asof`, so the page no longer pretends all 57 share one date.

It cannot touch earnings, dividends, flags, notes or news. Those need someone to
read a results announcement, and a scraper cannot do that.

Momentum and analyst ratings cannot be refreshed without a browser session, so
they carry the date they were captured and stop counting after ten days — they
then show as **not verified** rather than as calm. A page that ages into silence
is honest. A page that ages into confidence is not.

Every refresh has to get past `validate.py`, which throws the day away on: fewer
than 40 counters matched, any missing price, more than six counters moving over
25% at once, zero turnover, or any edit to a company fact. When it refuses, the
published page keeps its old numbers **and its old date stamp**.

## When a score is blank

A blank score is a measurement failure, and the page says which one. A missing
earnings-growth figure is an **unknown**, not a zero — treating it as zero
quietly marks a company down for its reporting calendar rather than its results.
KenGen's year ends in June and it reports on 30 October, which is the whole
reason it has no growth figure; scoring that as no growth was a bug, not a view.

## Not investment advice

Nobody behind this page is a licensed investment adviser and nothing here takes
account of anyone's circumstances. The buy, hold and avoid labels are the output
of the rule set described on the Method screen, applied to figures whose dates
are printed beside them. See DEPLOY.md before publicising it.
