/**
 * Data models for deck statistics and analysis.
 */

import type { CardCategory } from "./deck.js";
import type { Color } from "./card.js";

/** Mana curve distribution — card counts bucketed by converted mana cost. */
export interface ManaCurveData {
  buckets: { cmc: number; count: number }[];
}

/** Breakdown of cards by category with counts and percentages. */
export interface CategoryBreakdown {
  categories: { name: CardCategory; count: number; percentage: number }[];
}

/** Distribution of cards by mana color, including a Colorless bucket. */
export interface ColorDistribution {
  colors: { color: Color | "Colorless"; count: number; percentage: number }[];
}

/** Breakdown of cards by type (creature, instant, sorcery, etc.). */
export interface TypeBreakdown {
  types: { type: string; count: number }[];
}
