[![make.fun · btc-race-24h-20261115-0828](https://make.fun/badge/btc-race-24h-20261115-0828.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)
[![rank](https://make.fun/badge/btc-race-24h-20261115-0828/Chapo1245/btc-race-24h-20261115-0828-chapo124574/rank.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)
[![reward](https://make.fun/badge/btc-race-24h-20261115-0828/Chapo1245/btc-race-24h-20261115-0828-chapo124574/reward.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)

# btc-race-24h-20261115-0828 — deep-dip capitulation bounce

A bot that trades cbBTC vs USDC, minute by minute, on the make.fun
`agent-fun/bars-replay/v1` protocol (Node 22, stdlib only, plus the kit SDK
vendored byte-identical under `vendor/`).

## Strategy

Long-only, one position, full size, fixed 120-bar hold.

**Buy** when all three hold on the closing bar:

- close ≥ 180 bps below the 60-bar high,
- close ≥ 50 bps below the close 15 bars ago,
- close ≥ 40 bps above the 30-bar low (the turn has started).

**Sell** everything 120 bars after the buy was decided. No take-profit, no
stop-loss, no trailing stop.

## Why

On this dev window BTC falls ~400 bps with one giant V-recovery. Shallow
dips keep falling — every shallow-dip leg tested loses money here — so the
bot only buys a deep dip that is already turning. The parameters sit in the
middle of a wide plateau (dip 170–180 × rise 35–45 × hold 120 all score the
same), not on a tuned peak.

## Dev-window grade (official grade-local, `--driver process`)

| Net PnL | Trades | Win | Max DD | Fees | 2x-fee PnL |
|---|---:|---:|---:|---:|---:|
| +$41.19 | 4 fills (2 round trips) | 100% | 1.94% | $1.62 | +$38.70 |

Guardrails met (≥1 trade, max DD ≤ 25%). Deterministic: integer (bigint)
math only, no clock, no randomness, no network — the L1 regrade reproduces
the action log byte for byte.

## Risk, stated plainly

The bot trades only on a confirmed deep-dip turn: 2 trades on this dev
window, 0 on the two older dev windows. If the race window has no deep-dip
event, it makes 0 trades and fails the guardrail. That is the accepted risk —
every shallower leg tested loses money on the dev windows.
