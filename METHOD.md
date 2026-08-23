# The method

Read this before changing anything in `data/` or `src/`. It exists because a
future session — a person, or a model with no memory of how this was built —
will otherwise reinvent decisions that were made for reasons, and repeat
mistakes that were already paid for once.

---

## The one idea

Everything on this page is measured against **what the government pays you for
taking no company risk at all**. In August 2026 the 364-day Treasury bill paid
9.037%, and interest on government paper under ten years is taxed at 15%, so the
honest comparison figure is **7.68% after tax, with no stockbroker involved**.

A share paying less than that, after its own 5% dividend tax, is asking you to
take company risk for free. It may still be worth owning — but only on a belief
the price will rise, and that belief should be stated out loud rather than hidden
inside a yield that looks respectable.

Inflation was 6.49% in July 2026. Any return below that is a slow loss, however
positive the number looks.

---

## The five gates, in this order

The order is the whole point. Most screens start at valuation, which is the
fourth question, not the first.

1. **Access.** Can you buy it at your size and get out again? Your order must
   stay under 10% of a day's trading, so a day must be worth at least ten times
   your order. At 1.3 million shillings, only 15 of 57 counters pass. This gate
   eliminates more "bargains" than every other gate combined, and almost nobody
   applies it. A price you cannot transact at is not a price.
2. **Earnings quality.** Is the profit repeatable? A currency gain on dollar
   debt, a property revaluation, or a share of an unaudited associate's profit
   looks identical to trading profit in a P/E ratio and is worth far less.
3. **Dividend cover.** Is the dividend earned? Payout above 90% of earnings is
   funded by borrowing or by selling something. Above 100% it is a countdown.
4. **Hurdle.** Does the after-tax yield beat the after-tax Treasury bill?
5. **Timing.** Are you early or late? Momentum above 70 does not mean the price
   will fall. It means the easy part already happened.

Gate 5 has three states, not two: a reading, calm, or **not verified**. Momentum
comes from a screener that needs a real browser session, so it cannot be
refreshed by the daily job. Each counter carries `sentiment_asof` and
`derive.py` stops counting a reading after ten days. **An unverified reading must
never render as calm.** That single rule is the difference between a page that
ages honestly and one that quietly starts lying.

---

## Kenyan tax, which changes which option wins

| Instrument | Withholding tax |
|---|---|
| Dividends on listed shares | 5% |
| Interest on government paper under 10 years | 15% |
| Interest on government paper 10 years and over | 10% |
| **Infrastructure bonds** | **exempt** |

The exemption is why infrastructure bonds are massively oversubscribed and why
they can beat a listed dividend outright. Almost nobody adjusts for tax when
comparing, and the comparison reverses when they do.

---

## Earnings-quality flags

Set `flag` on a counter when the printed profit is not what it appears to be.
The flag then disqualifies the counter from the earnings gate and from any
growth score, because the growth is not the company's own.

| Flag | Means |
|---|---|
| `QUALITY` | Profit driven by something that will not repeat — FX gains, revaluations, one-off disposals |
| `TRAP` | Cheap for a reason that is visible in the accounts |
| `PAYOUT` | Paying out more than it earns |
| `MOMENTUM` | The move has already happened |
| `DIVUP` | Raised its dividend while profit fell — see below |

**`DIVUP` is the most useful pattern found in this whole exercise.** In one week
of August 2026, three listed companies raised interim dividends while profit
fell — Standard Chartered (profit −17%, dividend +6.25%), Absa (−10%, +150%) and
BOC (−39.8%, +60%). Every dividend yield on every screen anywhere is a
**trailing** number. When a board raises the payout into falling earnings, the
screens keep showing an attractive yield right up until the cut.

---

## The checks that actually catch things

- **Profit next to operating cash flow, always.** Crown Paints posted a record
  half-year profit while operating cash flow fell 40.9% and current liabilities
  rose. Profit on paper, money not arriving. This one comparison takes a minute
  and separates a real recovery from a receivables problem.
- **Attributable, not group.** A group profit figure includes slices belonging to
  minority holders in other countries. Diamond Trust and Equity both need this
  distinction.
- **Where the profit came from.** Family Bank's profit rose 62%, but government
  securities grew 55% while loans grew 10%, with bad loans at 16.3%. That is a
  Treasury-bill carry trade wearing a bank's clothing, and it reverses when rates
  fall — exactly what cut Absa's profit by 10%.
- **Book closure and T+3.** To receive a dividend you must be on the register
  before the book-closure date, and a trade takes three working days to settle.
  So the last realistic day to buy is about three working days earlier. Miss it
  by a day and you wait a year.

---

## Mistakes already made, so they are not made again

- **Reading a unit as a single item.** A purchase order priced "8 @ 186,000" for
  toner was read as eight cartridges, giving an apparent ten-times markup. The
  unit was a **four-colour set**: 60 cartridges, not 15, and the real markup was
  about 2.8x. The lesson is not about toner. **Find out what one unit is before
  dividing by it**, and when someone with domain instinct says a number feels
  wrong, check the arithmetic before defending the conclusion.
- **Quoting a yield without checking cover.** TotalEnergies was called "the
  overlooked one — 8% dividend, earnings up 46%". Its payout ratio is 104%. The
  dividend was not earned. Never surface a yield without the payout beside it.
- **Trusting a data vendor's blank as a fact.** A screener showed no EPS for
  KenGen, which was read as "no published figure". It publishes: EPS 1.5894, P/E
  7.05, payout 56.6%. A gap in one vendor is a gap in that vendor.
- **Trusting a cached page.** A fetch of one data site returned a market cap and
  a one-year return that were roughly a year old, with no indication of staleness.
  Prefer a page that prints its own trading date, and treat that printed date as
  the date of the figures.
- **Believing an "estimated earnings date" field.** Two banks reported on 19
  August against a screener's estimate of the 20th and 25th, and one had already
  reported when its page still showed an estimate. **Only a company's own
  announcement is a date.**
- **Letting one outlier flatten a chart.** Umeme's 393.65% is returned capital,
  not income, and it compressed every other bar to nothing. Exclude with a
  visible note rather than silently.
- **Charts:** never a dual axis. Small multiples with individual scales instead
  of more than four categorical series. Value labels need their own gutter or
  they collide with names near a zero line.

---

## What may be automated and what may not

| Layer | Refresh | Who |
|---|---|---|
| Price, change on the day, shares traded | Daily, unattended | `src/refresh.py` |
| Relative volume | Daily, from this repo's own accumulated history | `src/refresh.py` |
| P/E, dividend yield, market cap | Recomputed every build from the price | `src/derive.py` |
| Earnings, dividends per share, payout | When a company reports | By hand |
| Momentum, analyst ratings | Needs a browser session; ages out after 10 days | By hand |
| Flags, notes, news reads, the legal book, the debt book | Never automatically | By hand |

`refresh.py` writes a **candidate**. `validate.py` decides whether it may become
live, and refuses on: fewer than 40 counters matched, any counter without a
positive price, more than six counters moving over 25% in a day, zero total
turnover, or any edit to a company fact or a note. On refusal the published page
keeps its previous numbers **and its previous date stamp** — a page that is
visibly three days old is fine, a page showing a number that came from a parsing
accident is not.

---

## Rules for the writing

- Every figure carries a date, and the date is the source's own printed date.
- Never draw a line between points that were not measured. Where five years of
  daily history is not obtainable, show the verified points and say what is
  missing. A smooth curve for all 57 counters would be generated, not observed.
- State the other side. Every news read has a "and the other side" paragraph,
  because a one-sided read is a pitch.
- No links off the page. Sources are named as text.
- No suspended or delisted counters.
- Never fabricate correspondence from a bank or anyone else, however
  convenient — including "imagine you are the bank". An independent assessment
  with its own name on it does the same job honestly.
