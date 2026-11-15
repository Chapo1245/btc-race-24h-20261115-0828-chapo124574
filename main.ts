// Deep-dip capitulation-bounce bot for btc-race-24h-20261115-0828.
//
// Idea: on this market, money is made in a handful of deep capitulation
// events. A sharp sell-off of ~2% or more off the recent high is usually
// followed, within minutes, by a fast V-shaped recovery that runs for one
// to two hours. Shallow dips keep falling, so the bot ignores them: it
// only buys once the price has already turned (risen off its recent low)
// after a deep dip, then holds the bounce for a fixed window and exits.
// One position, long only, full size, at most a couple of trades a day.
//
// All comparisons are integer (bigint) math on the raw close units, so two
// runs on the same data produce identical orders.
//
// Entry (all three must hold on the closing bar):
//   - close at least 180 bps below the highest close of the last 60 bars
//   - close at least 50 bps below the close 15 bars ago (the fall was fast)
//   - close at least 40 bps above the lowest close of the last 30 bars
//     (the turn has started; we do not catch falling knives)
// Exit: sell the whole position 120 bars after the buy was decided.
// No take-profit, no stop-loss, no trailing stop: the recovery is choppy,
// and tight exits were measured to cut winners into losers on the dev
// window, while a fixed 120-bar hold keeps the bulk of the bounce.

import { runBars } from './vendor/makefun-bars.ts';
import type { BarsState, Batch, OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const BPS = 10_000n;

// Strategy parameters (basis points / bars).
const DIP_BPS = 180n; // min fall from the 60-bar high
const DROP_BPS = 50n; // min fall over the last 15 bars
const RISE_BPS = 40n; // min rise off the 30-bar low (turn confirmation)
const HOLD_BARS = 120; // fixed holding window after the buy decision
const MAX_SLIP_BPS = 100; // max slippage the harness may apply to a fill

const HIGH_BARS = 60; // lookback for the reference high
const LOW_BARS = 30; // lookback for the recent low
const DROP_BARS = 15; // lookback for the fast-fall check

const closes: bigint[] = [];
let barsSeen = 0;
let entryBar = -1;

function maxOf(xs: readonly bigint[]): bigint {
  let m = xs[0]!;
  for (const x of xs) if (x > m) m = x;
  return m;
}

function minOf(xs: readonly bigint[]): bigint {
  let m = xs[0]!;
  for (const x of xs) if (x < m) m = x;
  return m;
}

await runBars({
  onBatch(state: BarsState, _batch: Batch): OrderInput[] {
    if (state.warmingUp) return [];
    const close = state.close(SYMBOL);
    if (close === null) return [];
    closes.push(close);
    barsSeen += 1;

    const held = state.positions.get(SYMBOL);
    const qty = held?.qty ?? 0n;

    // Holding: exit exactly HOLD_BARS bars after the buy decision.
    if (qty > 0n) {
      if (entryBar >= 0 && barsSeen - entryBar >= HOLD_BARS) {
        entryBar = -1;
        return [{ side: 'sell', symbol: SYMBOL, qty, max_slippage_bps: MAX_SLIP_BPS }];
      }
      return [];
    }
    entryBar = -1;

    // Flat: need enough history for every lookback, and cash to spend.
    if (closes.length < HIGH_BARS || state.cash <= 0n) return [];
    const last = closes[closes.length - 1]!;
    const high = maxOf(closes.slice(-HIGH_BARS));
    const low = minOf(closes.slice(-LOW_BARS));
    const ago = closes[closes.length - 1 - DROP_BARS]!;

    const deepEnough = last * BPS <= high * (BPS - DIP_BPS);
    const fellFast = ago * (BPS - DROP_BPS) >= last * BPS;
    const turnedUp = last * BPS >= low * (BPS + RISE_BPS);
    if (!deepEnough || !fellFast || !turnedUp) return [];

    const room = state.weightRoom(SYMBOL);
    const spend = state.cash < room ? state.cash : room;
    if (spend <= 0n) return [];
    entryBar = barsSeen;
    return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: spend, max_slippage_bps: MAX_SLIP_BPS }];
  },
});
