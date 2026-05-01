/**
 * Data models for automatic deck generation with archetype support.
 */

import type { Card, Color } from "./card.js";
import type { Deck, DeckEntry } from "./deck.js";
import type { Combo } from "./recommendation.js";

/** Functional categories for classifying non-land cards in a generated deck. */
export type FunctionalCategory = "Ramp" | "Card Draw" | "Removal" | "Threat";

/**
 * Strategy archetypes that influence card selection during generation.
 *
 * Each archetype biases the Scryfall queries and category distribution
 * toward a particular play style.
 */
export type Archetype =
  | "balanced"
  | "typal"
  | "stompy"
  | "spellslinger"
  | "combo"
  | "voltron"
  | "aristocrats"
  | "control"
  | "tokens";

/** Human-readable labels and descriptions for each archetype. */
export const ARCHETYPE_INFO: Record<Archetype, { label: string; description: string }> = {
  balanced:     { label: "Balanced",      description: "Even mix of creatures, removal, ramp, and card draw" },
  typal:        { label: "Typal",         description: "Focus on a creature type that matches your commander" },
  stompy:       { label: "Stompy",        description: "Big creatures and combat-focused strategy" },
  spellslinger: { label: "Spell-slinger", description: "Instants, sorceries, and spell synergies" },
  combo:        { label: "Combo",         description: "Tutors, card draw, and combo finishers" },
  voltron:      { label: "Voltron",       description: "Equipment, auras, and commander damage" },
  aristocrats:  { label: "Aristocrats",   description: "Sacrifice outlets, death triggers, and recursion" },
  control:      { label: "Control",       description: "Counterspells, board wipes, and card advantage" },
  tokens:       { label: "Tokens",        description: "Token generation and go-wide strategies" },
};

/**
 * Commander Rules Committee bracket levels (1-4).
 *
 * Bracket 1: Casual / precon-level
 * Bracket 2: Focused / upgraded precon
 * Bracket 3: Optimized / high synergy
 * Bracket 4: Competitive / cEDH-adjacent
 */
export type BracketLevel = 1 | 2 | 3 | 4;

/** Human-readable labels for bracket levels. */
export const BRACKET_INFO: Record<BracketLevel, { label: string; description: string }> = {
  1: { label: "Bracket 1 — Casual",     description: "Precon-level, no fast mana, relaxed" },
  2: { label: "Bracket 2 — Focused",    description: "Upgraded precon, some tutors, solid synergy" },
  3: { label: "Bracket 3 — Optimized",  description: "High synergy, efficient answers, strong combos" },
  4: { label: "Bracket 4 — Competitive", description: "cEDH-adjacent, fast mana, efficient win conditions" },
};

/** Options for configuring deck generation. */
export interface GenerationOptions {
  commander: Card;
  archetype: Archetype;
  bracketLevel: BracketLevel;
  includeInfiniteCombos: boolean;
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
  archetype: Archetype;
  bracketLevel: BracketLevel;
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

/**
 * Category templates tuned per archetype.
 * Archetypes that lean heavily into one axis get more slots there.
 */
export const ARCHETYPE_TEMPLATES: Record<Archetype, CategoryTemplate> = {
  balanced: {
    ramp: { min: 8, max: 12 },
    cardDraw: { min: 8, max: 12 },
    removal: { min: 8, max: 12 },
    threats: { min: 25, max: 35 },
  },
  typal: {
    ramp: { min: 6, max: 10 },
    cardDraw: { min: 6, max: 10 },
    removal: { min: 5, max: 8 },
    threats: { min: 32, max: 42 },
  },
  stompy: {
    ramp: { min: 10, max: 14 },
    cardDraw: { min: 6, max: 10 },
    removal: { min: 4, max: 7 },
    threats: { min: 30, max: 40 },
  },
  spellslinger: {
    ramp: { min: 8, max: 12 },
    cardDraw: { min: 10, max: 15 },
    removal: { min: 10, max: 14 },
    threats: { min: 18, max: 28 },
  },
  combo: {
    ramp: { min: 8, max: 12 },
    cardDraw: { min: 12, max: 16 },
    removal: { min: 6, max: 10 },
    threats: { min: 22, max: 32 },
  },
  voltron: {
    ramp: { min: 8, max: 12 },
    cardDraw: { min: 6, max: 10 },
    removal: { min: 6, max: 10 },
    threats: { min: 28, max: 38 },
  },
  aristocrats: {
    ramp: { min: 6, max: 10 },
    cardDraw: { min: 8, max: 12 },
    removal: { min: 6, max: 10 },
    threats: { min: 28, max: 38 },
  },
  control: {
    ramp: { min: 8, max: 12 },
    cardDraw: { min: 10, max: 14 },
    removal: { min: 12, max: 16 },
    threats: { min: 18, max: 26 },
  },
  tokens: {
    ramp: { min: 8, max: 12 },
    cardDraw: { min: 8, max: 12 },
    removal: { min: 6, max: 10 },
    threats: { min: 28, max: 38 },
  },
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
