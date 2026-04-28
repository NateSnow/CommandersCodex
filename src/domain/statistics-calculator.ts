/**
 * Pure functions for computing deck statistics.
 *
 * All functions are stateless and side-effect-free — they take card/entry
 * data in and return computed statistics out.
 */

import type { Card, Color } from "../models/card.js";
import type { DeckEntry } from "../models/deck.js";
import type {
  ManaCurveData,
  CategoryBreakdown,
  ColorDistribution,
  TypeBreakdown,
} from "../models/statistics.js";

/** The card types tracked in the type breakdown. */
const TRACKED_TYPES: readonly string[] = [
  "Creature",
  "Instant",
  "Sorcery",
  "Artifact",
  "Enchantment",
  "Planeswalker",
  "Land",
] as const;

/** All five Magic colors. */
const ALL_COLORS: readonly Color[] = ["W", "U", "B", "R", "G"] as const;

/**
 * Returns the mana curve — card counts bucketed by converted mana cost,
 * sorted by CMC ascending.
 */
export function getManaCurve(cards: Card[]): ManaCurveData {
  const counts = new Map<number, number>();

  for (const card of cards) {
    counts.set(card.cmc, (counts.get(card.cmc) ?? 0) + 1);
  }

  const buckets = Array.from(counts.entries())
    .map(([cmc, count]) => ({ cmc, count }))
    .sort((a, b) => a.cmc - b.cmc);

  return { buckets };
}

/**
 * Returns the count and percentage of deck entries per category.
 *
 * Only categories that have at least one entry are included.
 */
export function getCategoryBreakdown(entries: DeckEntry[]): CategoryBreakdown {
  const counts = new Map<string, number>();

  for (const entry of entries) {
    counts.set(entry.category, (counts.get(entry.category) ?? 0) + entry.quantity);
  }

  const total = entries.reduce((sum, e) => sum + e.quantity, 0);

  const categories = Array.from(counts.entries()).map(([name, count]) => ({
    name: name as DeckEntry["category"],
    count,
    percentage: total > 0 ? (count / total) * 100 : 0,
  }));

  return { categories };
}

/**
 * Returns the color distribution — count and percentage per color,
 * with a "Colorless" bucket for cards whose color identity is empty.
 */
export function getColorDistribution(cards: Card[]): ColorDistribution {
  const colorCounts = new Map<Color | "Colorless", number>();

  for (const card of cards) {
    if (card.colorIdentity.length === 0) {
      colorCounts.set("Colorless", (colorCounts.get("Colorless") ?? 0) + 1);
    } else {
      for (const color of card.colorIdentity) {
        colorCounts.set(color, (colorCounts.get(color) ?? 0) + 1);
      }
    }
  }

  const total = cards.length;

  const colors = Array.from(colorCounts.entries()).map(([color, count]) => ({
    color,
    count,
    percentage: total > 0 ? (count / total) * 100 : 0,
  }));

  return { colors };
}

/**
 * Returns the average converted mana cost of non-land cards.
 * Returns 0 for an empty list.
 */
export function getAverageCmc(cards: Card[]): number {
  const nonLandCards = cards.filter(
    (card) => !card.typeLine.toLowerCase().includes("land"),
  );

  if (nonLandCards.length === 0) {
    return 0;
  }

  const totalCmc = nonLandCards.reduce((sum, card) => sum + card.cmc, 0);
  return totalCmc / nonLandCards.length;
}

/**
 * Returns the count of cards per type (creature, instant, sorcery,
 * artifact, enchantment, planeswalker, land).
 *
 * A card can appear in multiple type buckets if its type line contains
 * multiple tracked types (e.g., "Artifact Creature").
 */
export function getTypeBreakdown(cards: Card[]): TypeBreakdown {
  const types = TRACKED_TYPES.map((type) => {
    const count = cards.filter((card) =>
      card.typeLine.toLowerCase().includes(type.toLowerCase()),
    ).length;
    return { type, count };
  });

  return { types };
}
