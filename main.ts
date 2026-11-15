// Deep-dip capitulation bounce — btc-race-24h-20261115-0828.
//
// Idea: in this dev window BTC falls ~400 bps with one giant V-recovery.
// Shallow dips keep falling (every shallow-dip leg tested loses money here),
// so the bot waits for a *deep* dip that has already started to turn, buys
// it once, full size, and holds it a fixed 120 bars. No take-profit, no
// stop-loss, no trailing stop: the exit is a clock, not a price.
//
// Entry — all three must hold on the closing bar:
//   1. close is at least 180 bps below the highest close of the last 60 bars
//      (a real capitulation, not a wobble),
//   2. close is at least 50 bps below the close 15 bars ago
//      (the fall was fast),
//   3. close is at least 40 bps above the lowest close of the last 30 bars
//      (the turn has started — a dip still making fresh lows is not bought).
//
// Exit: sell the whole position 120 bars after the buy was decided.
//
// All comparisons are integer (bigint) arithmetic, so two runs on the same
// data produce byte-identical orders. The parameters sit in the middle of a
// wide plateau (dip 170-180 x rise 35-45 x hold 120 all score the same on
// the dev window), not on a tuned peak.

import { runBars } from './vendor/makefun-bars.ts';
import type { BarsState, Batch } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const BPS = 10_000n;

// Entry thresholds (basis points) and hold length (bars).
const DIP_BPS = 180n; // how far below the 60-bar high the close must be
const DROP_BPS = 50n; // how far below the close 15 bars ago it must be
const RISE_BPS = 40n; // how far above the 30-bar low it must be
const HOLD_BARS = 120; // fixed hold after the buy is decided

// Lookback lengths (bars, including the closing bar).
const HIGH_BARS = 60;
const DROP_BARS = 15;
const LOW_BARS = 30;

// Slippage allowance for fills, in bps from the latest close. A full-size
// fill here costs ~9 bps (2 bps modelled slippage + ~7 bps price impact),
// so 100 bps is a wide safety margin, not a trading signal.
const MAX_SLIPPAGE_BPS = 100;

// Closing prices seen so far, oldest first.
const closes: bigint[] = [];
// Seq of the batch on which the current position's buy was decided (-1 flat).
let buyDecidedSeq = -1;

function maxOf(values: readonly bigint[]): bigint {
  let best = values[0]!;
  for (const v of values) if (v > best) best = v;
  return best;
}

function minOf(values: readonly bigint[]): bigint {
  let best = values[0]!;
  for (const v of values) if (v < best) best = v;
  return best;
}

await runBars({
  onBatch(state: BarsState, _batch: Batch) {
    const bar = state.latest.get(SYMBOL);
    if (bar === undefined) return [];
    const close = BigInt(bar.c);
    closes.push(close);

    const held = state.positions.get(SYMBOL);
    const qty = held === undefined ? 0n : held.qty;

    // Holding: sell everything once the fixed hold has elapsed.
    if (qty > 0n) {
      if (buyDecidedSeq >= 0 && state.seq - buyDecidedSeq >= HOLD_BARS) {
        buyDecidedSeq = -1;
        return [{ side: 'sell', symbol: SYMBOL, qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      return [];
    }

    // Flat: no trading during warm-up, and not before the lookbacks exist.
    if (state.warmingUp) return [];
    if (closes.length < HIGH_BARS) return [];
    if (state.cash <= 0n) return [];

    const last = close;
    const high = maxOf(closes.slice(-HIGH_BARS));
    const ago = closes[closes.length - 1 - DROP_BARS]!;
    const low = minOf(closes.slice(-LOW_BARS));

    // All three conditions, in integer math (no division, no floats).
    const deepEnough = last * BPS <= high * (BPS - DIP_BPS);
    const fellFast = ago * (BPS - DROP_BPS) >= last * BPS;
    const turningUp = last * BPS >= low * (BPS + RISE_BPS);

    if (deepEnough && fellFast && turningUp) {
      buyDecidedSeq = state.seq;
      return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    // No entry this bar: a buy decided on an earlier batch must have been
    // rejected (a filled buy shows up as a position on the next batch), so
    // its seq is stale — clear it instead of letting it linger.
    buyDecidedSeq = -1;
    return [];
  },
});
