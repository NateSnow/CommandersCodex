/**
 * LocalStorage adapter for persisting Commander decks.
 *
 * All deck entries are stored under keys prefixed with `mtg-deck-`.
 * Only card IDs and names are persisted — full card data is re-fetched
 * from Scryfall when a deck is loaded.
 */

import type { DeckSummary, SavedDeck } from "../models/deck.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KEY_PREFIX = "mtg-deck-";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface LocalStorageAdapter {
  saveDeck(deck: SavedDeck): void;
  loadDeck(deckId: string): SavedDeck | null;
  listDecks(): DeckSummary[];
  deleteDeck(deckId: string): void;
  exportAllDecks(): string;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Creates a `LocalStorageAdapter` backed by the provided `Storage` instance.
 * Defaults to `window.localStorage` when no argument is given, but accepts
 * any `Storage`-compatible object for testing.
 */
export function createLocalStorageAdapter(
  storage: Storage = window.localStorage,
): LocalStorageAdapter {
  function keyFor(deckId: string): string {
    return `${KEY_PREFIX}${deckId}`;
  }

  return {
    saveDeck(deck: SavedDeck): void {
      const json = JSON.stringify(deck);
      storage.setItem(keyFor(deck.id), json);
    },

    loadDeck(deckId: string): SavedDeck | null {
      const raw = storage.getItem(keyFor(deckId));
      if (raw === null) return null;

      try {
        return JSON.parse(raw) as SavedDeck;
      } catch {
        // Corrupted data — return null so callers can handle gracefully
        return null;
      }
    },

    listDecks(): DeckSummary[] {
      const summaries: DeckSummary[] = [];

      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key === null || !key.startsWith(KEY_PREFIX)) continue;

        const raw = storage.getItem(key);
        if (raw === null) continue;

        try {
          const deck = JSON.parse(raw) as SavedDeck;
          summaries.push({
            id: deck.id,
            name: deck.name,
            commanderName: deck.commanderName,
            cardCount: deck.entries.length,
            updatedAt: deck.updatedAt,
          });
        } catch {
          // Skip corrupted entries silently
        }
      }

      return summaries;
    },

    deleteDeck(deckId: string): void {
      storage.removeItem(keyFor(deckId));
    },

    exportAllDecks(): string {
      const decks: SavedDeck[] = [];

      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key === null || !key.startsWith(KEY_PREFIX)) continue;

        const raw = storage.getItem(key);
        if (raw === null) continue;

        try {
          decks.push(JSON.parse(raw) as SavedDeck);
        } catch {
          // Skip corrupted entries
        }
      }

      return JSON.stringify(decks);
    },
  };
}
