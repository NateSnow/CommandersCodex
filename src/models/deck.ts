/**
 * Deck data models for Commander format deck construction and persistence.
 */

import type { Card } from "./card.js";

/** Categories for organizing cards within a deck. */
export type CardCategory =
  | "Commander"
  | "Creature"
  | "Instant"
  | "Sorcery"
  | "Artifact"
  | "Enchantment"
  | "Planeswalker"
  | "Land"
  | "Ramp"
  | "Removal"
  | "Card Draw"
  | "Protection"
  | "Custom";

/** A single entry in a deck — a card with its quantity and category. */
export interface DeckEntry {
  card: Card;
  quantity: number;              // Always 1 except for basic lands
  category: CardCategory;
}

/** A complete Commander deck. */
export interface Deck {
  id: string;
  name: string;
  commander: Card;
  entries: DeckEntry[];
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
}

/**
 * A single entry in a saved deck — stores only card ID and name
 * to keep localStorage size manageable. Full card data is re-fetched
 * from Scryfall when the deck is loaded.
 */
export interface SavedDeckEntry {
  cardId: string;                // Scryfall UUID — card data re-fetched on load
  cardName: string;              // Stored for display before re-fetch
  quantity: number;
  category: CardCategory;
}

/** A deck as persisted to localStorage. */
export interface SavedDeck {
  id: string;
  name: string;
  commanderId: string;
  commanderName: string;
  entries: SavedDeckEntry[];
  createdAt: string;
  updatedAt: string;
}

/** A lightweight summary of a saved deck for listing purposes. */
export interface DeckSummary {
  id: string;
  name: string;
  commanderName: string;
  cardCount: number;
  updatedAt: string;
}
