/**
 * Data models for automatic deck generation.
 */

import type { Card, Color } from "./card.js";
import type { Deck, DeckEntry } from "./deck.js";
import type { Combo } from "./recommendation.js";

/** Functional categories for classifying non-land cards in a generated deck. */
export type FunctionalCategory = "Ramp" | "Card Draw" | "Removal" | "Threat";

/** Options for configuring deck generation. */
export interface GenerationOptions {
  commander: Card;
  buildAroundCard?: Card;
  landCount?: number;              // Default: 37
  categoryTemplate?: CategoryTemplate;
}

/** A warning produced during generation when a data source is unavailable or degraded. */
export interface GenerationWarning {
  source: "edhrec" | "commander-spellbook" | "scryfall";
  message: string;
}

/** The result of a deck generation run. */
export interface GenerationResult {
  deck: Deck;
  combosIncluded: Combo[];
  warnings: GenerationWarning[];
  fallbacksUsed: string[];
}

/** Min/max ranges for each functional category in a generated deck. */
export interface CategoryTemplate {
  ramp: { min: number; max: number };
  cardDraw: { min: number; max: number };
  removal: { min: number; max: number };
  threats: { min: number; max: number };
}

/** Default category distribution for a balanced Commander deck. */
export const DEFAULT_CATEGORY_TEMPLATE: CategoryTemplate = {
  ramp: { min: 8, max: 12 },
  cardDraw: { min: 8, max: 12 },
  removal: { min: 8, max: 12 },
  threats: { min: 25, max: 35 },
};

/** Aggregated color pip requirements derived from non-land cards' mana costs. */
export interface ColorRequirements {
  pipCounts: Record<Color, number>;
  totalPips: number;
}

/** Non-land cards distributed across functional categories. */
export interface CategorizedCards {
  ramp: DeckEntry[];
  cardDraw: DeckEntry[];
  removal: DeckEntry[];
  threats: DeckEntry[];
  unallocated: DeckEntry[];
}
