/**
 * Unit tests for LocalStorageAdapter.
 *
 * Uses the jsdom environment (configured in vitest) which provides a
 * working `localStorage` implementation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createLocalStorageAdapter, type LocalStorageAdapter } from "../local-storage-adapter.js";
import type { SavedDeck, SavedDeckEntry } from "../../models/deck.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSavedDeck(overrides: Partial<SavedDeck> = {}): SavedDeck {
  return {
    id: "deck-1",
    name: "Test Deck",
    commanderId: "cmd-001",
    commanderName: "Atraxa, Praetors' Voice",
    entries: [
      {
        cardId: "card-001",
        cardName: "Sol Ring",
        quantity: 1,
        category: "Artifact",
      } as SavedDeckEntry,
      {
        cardId: "card-002",
        cardName: "Command Tower",
        quantity: 1,
        category: "Land",
      } as SavedDeckEntry,
    ],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-02T00:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LocalStorageAdapter", () => {
  let adapter: LocalStorageAdapter;

  beforeEach(() => {
    localStorage.clear();
    adapter = createLocalStorageAdapter(localStorage);
  });

  // -----------------------------------------------------------------------
  // saveDeck / loadDeck
  // -----------------------------------------------------------------------

  describe("saveDeck and loadDeck", () => {
    it("saves and loads a deck round-trip", () => {
      const deck = makeSavedDeck();
      adapter.saveDeck(deck);

      const loaded = adapter.loadDeck("deck-1");
      expect(loaded).toEqual(deck);
    });

    it("overwrites an existing deck with the same id", () => {
      const original = makeSavedDeck({ name: "Original" });
      adapter.saveDeck(original);

      const updated = makeSavedDeck({ name: "Updated" });
      adapter.saveDeck(updated);

      const loaded = adapter.loadDeck("deck-1");
      expect(loaded?.name).toBe("Updated");
    });

    it("returns null for a non-existent deck", () => {
      expect(adapter.loadDeck("no-such-deck")).toBeNull();
    });

    it("returns null for corrupted JSON data", () => {
      localStorage.setItem("mtg-deck-corrupt", "{{not valid json");
      const loaded = adapter.loadDeck("corrupt");
      expect(loaded).toBeNull();
    });

    it("preserves all SavedDeck fields", () => {
      const deck = makeSavedDeck({
        id: "full-deck",
        name: "Full Fields",
        commanderId: "cmd-999",
        commanderName: "Kenrith, the Returned King",
        entries: [
          {
            cardId: "c1",
            cardName: "Lightning Bolt",
            quantity: 1,
            category: "Removal",
          } as SavedDeckEntry,
        ],
        createdAt: "2024-06-01T12:00:00.000Z",
        updatedAt: "2024-06-15T18:30:00.000Z",
      });

      adapter.saveDeck(deck);
      const loaded = adapter.loadDeck("full-deck");

      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe("full-deck");
      expect(loaded!.name).toBe("Full Fields");
      expect(loaded!.commanderId).toBe("cmd-999");
      expect(loaded!.commanderName).toBe("Kenrith, the Returned King");
      expect(loaded!.entries).toHaveLength(1);
      expect(loaded!.entries[0].cardName).toBe("Lightning Bolt");
      expect(loaded!.entries[0].category).toBe("Removal");
      expect(loaded!.createdAt).toBe("2024-06-01T12:00:00.000Z");
      expect(loaded!.updatedAt).toBe("2024-06-15T18:30:00.000Z");
    });
  });

  // -----------------------------------------------------------------------
  // listDecks
  // -----------------------------------------------------------------------

  describe("listDecks", () => {
    it("returns an empty array when no decks are saved", () => {
      expect(adapter.listDecks()).toEqual([]);
    });

    it("returns summaries for all saved decks", () => {
      adapter.saveDeck(makeSavedDeck({ id: "d1", name: "Deck A", commanderName: "Cmdr A" }));
      adapter.saveDeck(makeSavedDeck({ id: "d2", name: "Deck B", commanderName: "Cmdr B" }));

      const summaries = adapter.listDecks();
      expect(summaries).toHaveLength(2);

      const names = summaries.map((s) => s.name).sort();
      expect(names).toEqual(["Deck A", "Deck B"]);
    });

    it("includes correct card count in summaries", () => {
      const deck = makeSavedDeck({ id: "d1" });
      adapter.saveDeck(deck);

      const summaries = adapter.listDecks();
      expect(summaries[0].cardCount).toBe(deck.entries.length);
    });

    it("skips corrupted entries", () => {
      adapter.saveDeck(makeSavedDeck({ id: "good" }));
      localStorage.setItem("mtg-deck-bad", "not-json!!!");

      const summaries = adapter.listDecks();
      expect(summaries).toHaveLength(1);
      expect(summaries[0].id).toBe("good");
    });

    it("ignores non-deck localStorage keys", () => {
      localStorage.setItem("other-key", "some value");
      adapter.saveDeck(makeSavedDeck({ id: "d1" }));

      const summaries = adapter.listDecks();
      expect(summaries).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // deleteDeck
  // -----------------------------------------------------------------------

  describe("deleteDeck", () => {
    it("removes a saved deck", () => {
      adapter.saveDeck(makeSavedDeck({ id: "to-delete" }));
      expect(adapter.loadDeck("to-delete")).not.toBeNull();

      adapter.deleteDeck("to-delete");
      expect(adapter.loadDeck("to-delete")).toBeNull();
    });

    it("does not throw when deleting a non-existent deck", () => {
      expect(() => adapter.deleteDeck("no-such-deck")).not.toThrow();
    });

    it("removes deck from listDecks results", () => {
      adapter.saveDeck(makeSavedDeck({ id: "d1" }));
      adapter.saveDeck(makeSavedDeck({ id: "d2" }));

      adapter.deleteDeck("d1");

      const summaries = adapter.listDecks();
      expect(summaries).toHaveLength(1);
      expect(summaries[0].id).toBe("d2");
    });
  });

  // -----------------------------------------------------------------------
  // exportAllDecks
  // -----------------------------------------------------------------------

  describe("exportAllDecks", () => {
    it("returns an empty JSON array when no decks exist", () => {
      const exported = adapter.exportAllDecks();
      expect(JSON.parse(exported)).toEqual([]);
    });

    it("exports all saved decks as a JSON string", () => {
      const deck1 = makeSavedDeck({ id: "d1", name: "Deck One" });
      const deck2 = makeSavedDeck({ id: "d2", name: "Deck Two" });
      adapter.saveDeck(deck1);
      adapter.saveDeck(deck2);

      const exported = adapter.exportAllDecks();
      const parsed = JSON.parse(exported) as SavedDeck[];

      expect(parsed).toHaveLength(2);
      const names = parsed.map((d) => d.name).sort();
      expect(names).toEqual(["Deck One", "Deck Two"]);
    });

    it("skips corrupted entries in export", () => {
      adapter.saveDeck(makeSavedDeck({ id: "good", name: "Good Deck" }));
      localStorage.setItem("mtg-deck-corrupt", "{broken json");

      const exported = adapter.exportAllDecks();
      const parsed = JSON.parse(exported) as SavedDeck[];

      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe("Good Deck");
    });

    it("ignores non-deck localStorage keys in export", () => {
      localStorage.setItem("unrelated", "data");
      adapter.saveDeck(makeSavedDeck({ id: "d1" }));

      const parsed = JSON.parse(adapter.exportAllDecks()) as SavedDeck[];
      expect(parsed).toHaveLength(1);
    });
  });
});
