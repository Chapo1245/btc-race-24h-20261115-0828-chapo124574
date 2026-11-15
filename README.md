# btc-race-24h-20261115-0828 — deep-dip bounce bot

A cbBTC trading bot for the make.fun 24-hour BTC race. Long only, one
position, full size, a couple of trades a day at most.

## Strategy

Money in this market comes in a handful of deep capitulation events: a
sharp sell-off of ~2% or more off the recent high, followed within minutes
by a fast V-shaped recovery that runs for one to two hours. Shallow dips
keep falling, so the bot ignores them and only buys once the turn has
started.

**Entry** — all three on the closing bar:

- close at least 180 bps below the highest close of the last 60 bars
- close at least 50 bps below the close 15 bars ago (the fall was fast)
- close at least 40 bps above the lowest close of the last 30 bars (the
  turn has started; no catching falling knives)

**Exit** — sell the whole position 120 bars after the buy was decided.
No take-profit, no stop-loss, no trailing stop: the recovery is choppy,
and tight exits were measured to cut winners into losers on the dev
window, while a fixed 120-bar hold keeps the bulk of the bounce.

## Dev-window result (official grade-local)

- Net PnL **+$41.19** on the dev window (2 round trips, both wins,
  max drawdown 1.96%, fees ~$1.63)
- Net PnL at 2x fees: **+$38.70**
- The same parameters score +$41.19 across dip 170–180, rise 35–45 and
  timeout 120, and +$34–37 for timeout 110–130: the pick is the middle
  of a wide gate-passing region, not a tuned peak.
- The previous race's winning shape (a shallower dip bot) scores −$94.13
  on this window: this window is far more volatile (12.0 bps/min vs 7.9),
  and shallow-dip entries catch falling knives 13 times with zero wins.
- Cross-check: the bot makes no trades on the two older dev windows
  (their deep-dip events never confirm a turn). That is accepted: every
  shallower second leg tested either lost money on this window or fired
  on false dips. If the race window has no deep-dip event the bot makes
  no trade and fails the guardrail; if it has one, the bot rides it.

## How it runs

Node 22, standard library only plus the vendored kit SDK
(`vendor/makefun-bars.ts`, byte-identical to the kit). All decisions are
integer (bigint) math on raw close units: no clock, no network, no
randomness, deterministic — two runs on the same data give identical
orders.
