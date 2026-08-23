# Putting this on your own domain

Everything here is one HTML file. There is no server, no database and nothing to
maintain, which is why this can run for years for nothing.

Two of these steps only you can do, because they need an account and a password:
**creating the GitHub account** and **changing your DNS**. Nobody should do those
for you, and no tool should be handed your password. Everything else is already
done in this repo.

---

## What you are setting up

```
your laptop / Claude          GitHub                        the internet
─────────────────────         ──────────────────────        ─────────────────
edit data/ or src/     ──►    repo                    ──►   thamani.yourdomain
                              every weekday 18:30 EAT
                              a robot fetches prices,
                              checks them, rebuilds
                              docs/index.html
```

The daily price refresh runs **on GitHub, not on your machine**. Your laptop can
be off. It needs no API key and costs nothing.

---

## Step 1 — a GitHub account

Go to github.com and sign up. Free is enough. Use an email you actually read,
because this is where failure notices arrive.

## Step 2 — a repository

New repository → name it `thamani` → **Public** (a private repo cannot use free
Pages hosting) → Create.

Then: **Add file → Upload files**, and drag in everything from this folder. Keep
the folder structure. Commit.

If you would rather do it from a terminal:

```bash
git init
git add .
git commit -m "Thamani"
git branch -M main
git remote add origin https://github.com/YOURNAME/thamani.git
git push -u origin main
```

## Step 3 — turn on hosting

Repo → **Settings → Pages**.

- Source: **Deploy from a branch**
- Branch: **main**, folder: **/docs**
- Save.

Wait two or three minutes and your page is live at
`https://YOURNAME.github.io/thamani/`. Open it. If it works there, it will work
on your domain.

## Step 4 — allow the robot to commit

Repo → **Settings → Actions → General** → scroll to *Workflow permissions* →
select **Read and write permissions** → Save.

Without this the daily job can fetch and check prices but cannot save them.

## Step 5 — your domain

Decide the address. A subdomain is easier and safer than the root, because it
leaves your main site alone:

    thamani.napendatech.com

**At your domain registrar or DNS provider**, add one record:

| Type | Name | Value |
|---|---|---|
| CNAME | `thamani` | `YOURNAME.github.io` |

If you insist on the bare domain instead, that needs four A records pointing at
GitHub's addresses rather than a CNAME — look them up in GitHub's own Pages
documentation on the day, because those addresses do change.

Then edit **`docs/CNAME`** in the repo so it contains exactly your chosen
address and nothing else:

    thamani.napendatech.com

Back in **Settings → Pages**, put the same address in *Custom domain*, save, and
once it verifies tick **Enforce HTTPS**. DNS can take anywhere from ten minutes
to a few hours to propagate. If it says "domain not verified", wait and refresh
rather than changing things.

## Step 6 — check the robot

Repo → **Actions** tab → *Daily price refresh* → **Run workflow**. This runs it
immediately instead of waiting for the evening.

Read the log. You want to see:

```
matched   57 of 57 counters
ok  no counter moved more than 25.0%
ACCEPTED  prices dated ... are now live
```

If instead you see **REJECTED**, that is the system working. It means the numbers
it fetched did not look believable, so it threw them away and left the live page
alone. The log says which check failed.

The commonest first-run problem is that the source page has changed its layout
since this was built, in which case the log will say it could not match enough
tickers. That needs a person to look — which is the point of it stopping rather
than publishing a guess.

---

## Changing anything by hand

```bash
pip install requests pandas lxml       # once
python src/test_refresh.py             # the maths and the parser still work?
python src/build.py                    # rebuild docs/index.html
```

Then open `docs/index.html` in a browser to check it, and commit.

- **A company reported** → edit its `eps`, `dps`, `epsg`, `payout` and `note` in
  `data/counters.json`, and add the story to `news` in `data/editorial.json`.
- **New momentum readings** → update `rsi`, `rat` and `sentiment_asof` for the
  counters you re-checked. Anything you do not update ages out by itself after
  ten days and shows as *not verified*, which is correct.
- **Rates moved** → `data/macro.json`. The Central Bank Rate, inflation and the
  364-day Treasury bill drive every comparison on the page.
- **Never** hand-edit `docs/index.html`. It is generated, and the next build
  overwrites it.

Read `METHOD.md` before changing anything in `data/`. It carries the reasoning
and the mistakes already paid for.

---

## Two things worth sorting out before you publicise it

**Where the data comes from.** The prices are read from third-party pages, and
market data for the exchange is licensed. Naming your sources — the page already
does, on the Method screen — is the decent minimum. If this ever becomes
something you charge for, or promote widely, get a straight answer about
redistribution first.

**What the page says it is.** It prints buy, hold and avoid labels. The Capital
Markets Authority licenses investment advisers in Kenya, and a public page
issuing those labels under a company name sits closer to that activity than a
private spreadsheet does. The disclaimer now appears on the first screen anyone
sees and again under every page. That is a reasonable position, not a legal
opinion — one conversation with a Kenyan lawyer before you put the company name
on it is cheap insurance.
