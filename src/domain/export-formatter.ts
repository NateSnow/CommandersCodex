/**
 * Pure functions for converting a deck to text export formats.
 *
 * All functions are stateless and side-effect-free — they take a Deck
 * in and return a formatted string out.
 */

import type { Deck, DeckEntry, CardCategory } from "../models/deck.js";

/**
 * The order in which categories appear in the text export.
 * Commander is handled separately (always first).
 */
const CATEGORY_ORDER: readonly CardCategory[] = [
  "Creature",
  "Instant",
  "Sorcery",
  "Artifact",
  "Enchantment",
  "Planeswalker",
  "Land",
  "Ramp",
  "Removal",
  "Card Draw",
  "Protection",
  "Custom",
] as const;

/**
 * Exports a deck as a human-readable text list.
 *
 * Format:
 * - Commander section first, labeled "Commander"
 * - Then cards grouped by category with category headers
 * - Each card line: `{quantity} {Card Name}`
 * - Categories separated by blank lines
 *
 * Only categories that have at least one entry are included.
 */
export function toText(deck: Deck): string {
  const lines: string[] = [];

  // Commander section
  lines.push("Commander");
  lines.push(`1 ${deck.commander.name}`);

  // Group non-commander entries by category
  const grouped = groupByCategory(deck.entries);

  for (const category of CATEGORY_ORDER) {
    const entries = grouped.get(category);
    if (!entries || entries.length === 0) {
      continue;
    }

    lines.push(""); // blank line separator
    lines.push(category);
    for (const entry of entries) {
      lines.push(`${entry.quantity} ${entry.card.name}`);
    }
  }

  return lines.join("\n");
}

/**
 * Exports a deck in MTGO-compatible format.
 *
 * Format:
 * - One line per card: `{quantity} {Card Name}`
 * - Commander first, then all other cards
 * - No category grouping or headers
 */
export function toMTGO(deck: Deck): string {
  const lines: string[] = [];

  // Commander first
  lines.push(`1 ${deck.commander.name}`);

  // All other cards
  for (const entry of deck.entries) {
    lines.push(`${entry.quantity} ${entry.card.name}`);
  }

  return lines.join("\n");
}

/**
 * Groups deck entries by their category, preserving insertion order
 * within each group.
 */
function groupByCategory(entries: DeckEntry[]): Map<CardCategory, DeckEntry[]> {
  const grouped = new Map<CardCategory, DeckEntry[]>();

  for (const entry of entries) {
    const list = grouped.get(entry.category);
    if (list) {
      list.push(entry);
    } else {
      grouped.set(entry.category, [entry]);
    }
  }

  return grouped;
}
