/**
 * Power level calculator for Commander decks.
 *
 * Inspired by edhpowerlevel.com's data-driven approach:
 * - Impact per card = f(Price) + f(Popularity/EDHREC rank)
 * - Score = Total Impact × Efficiency modifier
 * - Power Level = Score mapped to a curve (1-10)
 *
 * Uses TCGplayer USD prices (via Scryfall) and EDHREC rank data.
 */

import type { Card } from "../models/card.js";
import type { Deck, DeckEntry } from "../models/deck.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PowerLevelResult {
  /** Overall power level 1-10 (data-driven, curved) */
  powerLevel: number;
  /** Raw score 0-1000 */
  score: number;
  /** Total impact of all cards */
  totalImpact: number;
  /** Efficiency rating 1-10 */
  efficiency: number;
  /** Tipping point — CMC where 65% of impact lives */
  tippingPoint: number;
  /** Average CMC of non-land cards */
  avgCmc: number;
  /** Average playability (% of cards with high impact) */
  avgPlayability: number;
  /** Estimated bracket 1-4 */
  bracket: number;
  /** Total deck market value USD */
  totalValue: number;
  /** Breakdown by category */
  breakdown: ImpactBreakdown;
}

export interface ImpactBreakdown {
  creatures: number;
  instants: number;
  sorceries: number;
  artifacts: number;
  enchantments: number;
  planeswalkers: number;
  lands: number;
}

// ---------------------------------------------------------------------------
// Price curve — emphasizes lower prices where price correlates with power
// Cap at $100 (beyond that it's supply, not demand)
// ---------------------------------------------------------------------------

function priceRating(priceUsd: number | undefined): number {
  if (!priceUsd || priceUsd <= 0) return 0;
  const capped = Math.min(priceUsd, 100);
  // Curve: sqrt-ish to emphasize lower prices
  // $0.25 → ~1, $1 → ~2, $5 → ~4.5, $20 → ~7, $50 → ~8.5, $100 → ~10
  return Math.min(10, Math.sqrt(capped) * 1.0);
}

// ---------------------------------------------------------------------------
// Popularity curve — based on EDHREC rank (lower rank = more popular)
// Rank 1 = most popular (Command Tower), ~27000 = least
// ---------------------------------------------------------------------------

function popularityRating(edhrecRank: number | undefined): number {
  if (!edhrecRank || edhrecRank <= 0) return 0;
  if (edhrecRank > 27000) return 0;
  // Inverse curve: rank 1 → 10, rank 100 → ~7, rank 1000 → ~4, rank 5000 → ~2
  const normalized = 1 - (Math.log(edhrecRank) / Math.log(27000));
  return Math.max(0, Math.min(10, normalized * 10));
}

// ---------------------------------------------------------------------------
// Card Impact = (Price Rating + Popularity Rating) / 2, scaled to 0-20
// ---------------------------------------------------------------------------

function cardImpact(card: Card): number {
  const price = priceRating(card.priceUsd);
  const popularity = popularityRating(card.edhrecRank);

  // If we have both, average them. If only one, use that one.
  if (price > 0 && popularity > 0) {
    return price + popularity; // 0-20 scale
  } else if (price > 0) {
    return price * 2; // Scale up to 0-20
  } else if (popularity > 0) {
    return popularity * 2;
  }
  // No data — give a baseline of 2 (every legal card has some value)
  return 2;
}

// ---------------------------------------------------------------------------
// Efficiency — based on avg CMC and tipping point
// Lower CMC = more efficient = higher score
// ---------------------------------------------------------------------------

function calculateEfficiency(avgCmc: number, tippingPoint: number): number {
  // avgCmc contribution: 1.5 → 10, 2.5 → 7, 3.5 → 5, 5.0 → 2
  const cmcScore = Math.max(1, Math.min(10, 13 - avgCmc * 2.5));

  // Tipping point contribution: 2 → 10, 3 → 8, 4 → 6, 5 → 4, 7+ → 2
  const tpScore = Math.max(1, Math.min(10, 14 - tippingPoint * 2));

  // Combine: 60% CMC, 40% tipping point
  return cmcScore * 0.6 + tpScore * 0.4;
}

// ---------------------------------------------------------------------------
// Tipping Point — the CMC at which 65% of the deck's impact is accessible
// ---------------------------------------------------------------------------

function calculateTippingPoint(cards: Card[]): number {
  const nonLand = cards.filter((c) => !c.typeLine.toLowerCase().includes("land"));
  if (nonLand.length === 0) return 0;

  // Sort by CMC
  const sorted = [...nonLand].sort((a, b) => a.cmc - b.cmc);
  const totalImpact = sorted.reduce((sum, c) => sum + cardImpact(c), 0);
  const threshold = totalImpact * 0.65;

  let cumulative = 0;
  for (const card of sorted) {
    cumulative += cardImpact(card);
    if (cumulative >= threshold) {
      return card.cmc;
    }
  }

  return sorted[sorted.length - 1]?.cmc ?? 0;
}

// ---------------------------------------------------------------------------
// Score → Power Level curve
// Designed to match traditional perception:
// - Score 0-50 → PL 1-2 (jank)
// - Score 50-150 → PL 2-4 (casual)
// - Score 150-350 → PL 4-6 (focused)
// - Score 350-550 → PL 6-8 (optimized)
// - Score 550-750 → PL 8-9 (high power)
// - Score 750-1000 → PL 9-10 (cEDH)
// ---------------------------------------------------------------------------

function scoreToPowerLevel(score: number): number {
  const capped = Math.max(0, Math.min(1000, score));

  // Piecewise linear curve
  if (capped <= 50) return 1 + (capped / 50);
  if (capped <= 150) return 2 + ((capped - 50) / 100) * 2;
  if (capped <= 350) return 4 + ((capped - 150) / 200) * 2;
  if (capped <= 550) return 6 + ((capped - 350) / 200) * 2;
  if (capped <= 750) return 8 + ((capped - 550) / 200);
  return 9 + ((capped - 750) / 250);
}

// ---------------------------------------------------------------------------
// Main calculator
// ---------------------------------------------------------------------------

export function calculatePowerLevel(deck: Deck): PowerLevelResult {
  const allCards = [deck.commander, ...deck.entries.map((e) => e.card)];
  const nonLandCards = allCards.filter((c) => !c.typeLine.toLowerCase().includes("land"));

  // Calculate impact for each card
  const impacts = allCards.map((c) => ({ card: c, impact: cardImpact(c) }));
  const totalImpact = impacts.reduce((sum, i) => sum + i.impact, 0);

  // Average CMC (non-land)
  const avgCmc = nonLandCards.length > 0
    ? nonLandCards.reduce((sum, c) => sum + c.cmc, 0) / nonLandCards.length
    : 0;

  // Tipping point
  const tippingPoint = calculateTippingPoint(allCards);

  // Efficiency
  const efficiency = calculateEfficiency(avgCmc, tippingPoint);

  // Score = Total Impact × (Efficiency / 10) — normalized to 0-1000 range
  // Max theoretical impact: 100 cards × 20 max impact = 2000
  // With efficiency modifier: 2000 × 1.0 = 2000, scale to 1000
  const rawScore = totalImpact * (efficiency / 10);
  const score = Math.min(1000, rawScore * 0.5); // Scale factor

  // Power Level from curve
  const powerLevel = scoreToPowerLevel(score);

  // Average playability (% of cards with impact > 8)
  const highImpactCards = impacts.filter((i) => i.impact > 8).length;
  const avgPlayability = allCards.length > 0 ? (highImpactCards / allCards.length) * 100 : 0;

  // Total market value
  const totalValue = allCards.reduce((sum, c) => sum + (c.priceUsd ?? 0), 0);

  // Bracket estimation from power level
  let bracket: number;
  if (powerLevel >= 8) bracket = 4;
  else if (powerLevel >= 6) bracket = 3;
  else if (powerLevel >= 4) bracket = 2;
  else bracket = 1;

  // Impact breakdown by type
  const breakdown: ImpactBreakdown = {
    creatures: 0, instants: 0, sorceries: 0,
    artifacts: 0, enchantments: 0, planeswalkers: 0, lands: 0,
  };

  for (const { card, impact } of impacts) {
    const t = card.typeLine.toLowerCase();
    if (t.includes("land")) breakdown.lands += impact;
    else if (t.includes("planeswalker")) breakdown.planeswalkers += impact;
    else if (t.includes("creature")) breakdown.creatures += impact;
    else if (t.includes("instant")) breakdown.instants += impact;
    else if (t.includes("sorcery")) breakdown.sorceries += impact;
    else if (t.includes("artifact")) breakdown.artifacts += impact;
    else if (t.includes("enchantment")) breakdown.enchantments += impact;
  }

  return {
    powerLevel: Math.round(powerLevel * 10) / 10,
    score: Math.round(score),
    totalImpact: Math.round(totalImpact),
    efficiency: Math.round(efficiency * 10) / 10,
    tippingPoint,
    avgCmc: Math.round(avgCmc * 100) / 100,
    avgPlayability: Math.round(avgPlayability * 10) / 10,
    bracket,
    totalValue: Math.round(totalValue * 100) / 100,
    breakdown,
  };
}
