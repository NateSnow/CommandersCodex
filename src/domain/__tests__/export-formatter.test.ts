import { describe, it, expect } from "vitest";
import { toText, toMTGO } from "../export-formatter.js";
import type { Card } from "../../models/card.js";
import type { Deck, DeckEntry, CardCategory } from "../../models/deck.js";

/** Helper to create a minimal Card object for testing. */
function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: overrides.id ?? "test-id",
    name: overrides.name ?? "Test Card",
    manaCost: overrides.manaCost ?? "{1}{W}",
    cmc: overrides.cmc ?? 2,
    typeLine: overrides.typeLine ?? "Creature — Human",
    oracleText: overrides.oracleText ?? "",
    colors: overrides.colors ?? ["W"],
    colorIdentity: overrides.colorIdentity ?? ["W"],
    power: overrides.power,
    toughness: overrides.toughness,
    loyalty: overrides.loyalty,
    imageUris: overrides.imageUris,
    cardFaces: overrides.cardFaces,
    legalities: overrides.legalities ?? {},
    keywords: overrides.keywords ?? [],
    isLegendary: overrides.isLegendary ?? false,
    isCreature: overrides.isCreature ?? true,
    canBeCommander: overrides.canBeCommander ?? false,
  };
}

/** Helper to create a commander card. */
function makeCommander(name = "Atraxa, Praetors' Voice"): Card {
  return makeCard({
    id: "commander-id",
    name,
    typeLine: "Legendary Creature — Phyrexian Angel Horror",
    isLegendary: true,
    isCreature: true,
    canBeCommander: true,
    colorIdentity: ["W", "U", "B", "G"],
  });
}

/** Helper to create a deck entry. */
function makeEntry(
  name: string,
  category: CardCategory,
  quantity = 1,
): DeckEntry {
  return {
    card: makeCard({ id: `id-${name}`, name }),
    quantity,
    category,
  };
}

/** Helper to create a Deck with given entries. */
function makeDeck(
  entries: DeckEntry[],
  commanderName = "Atraxa, Praetors' Voice",
): Deck {
  return {
    id: "deck-1",
    name: "Test Deck",
    commander: makeCommander(commanderName),
    entries,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };
}

describe("ExportFormatter", () => {
  // ─── toText ─────────────────────────────────────────────────────

  describe("toText", () => {
    it("starts with the commander labeled as 'Commander'", () => {
      const deck = makeDeck([]);
      const text = toText(deck);
      const lines = text.split("\n");

      expect(lines[0]).toBe("Commander");
      expect(lines[1]).toBe("1 Atraxa, Praetors' Voice");
    });

    it("groups cards by category with headers", () => {
      const entries = [
        makeEntry("Sol Ring", "Artifact"),
        makeEntry("Swords to Plowshares", "Instant"),
        makeEntry("Llanowar Elves", "Creature"),
      ];
      const deck = makeDeck(entries);
      const text = toText(deck);

      expect(text).toContain("Creature\n1 Llanowar Elves");
      expect(text).toContain("Instant\n1 Swords to Plowshares");
      expect(text).toContain("Artifact\n1 Sol Ring");
    });

    it("separates categories with blank lines", () => {
      const entries = [
        makeEntry("Llanowar Elves", "Creature"),
        makeEntry("Sol Ring", "Artifact"),
      ];
      const deck = makeDeck(entries);
      const text = toText(deck);
      const lines = text.split("\n");

      // After commander section, there should be a blank line before first category
      // And between categories
      const creatureIdx = lines.indexOf("Creature");
      const artifactIdx = lines.indexOf("Artifact");

      expect(creatureIdx).toBeGreaterThan(1);
      expect(lines[creatureIdx - 1]).toBe(""); // blank line before Creature
      expect(lines[artifactIdx - 1]).toBe(""); // blank line before Artifact
    });

    it("formats each card line as quantity followed by name", () => {
      const entries = [
        makeEntry("Plains", "Land", 5),
      ];
      const deck = makeDeck(entries);
      const text = toText(deck);

      expect(text).toContain("5 Plains");
    });

    it("includes every card exactly once in the output", () => {
      const entries = [
        makeEntry("Sol Ring", "Artifact"),
        makeEntry("Counterspell", "Instant"),
        makeEntry("Forest", "Land"),
      ];
      const deck = makeDeck(entries);
      const text = toText(deck);

      expect(text).toContain("1 Sol Ring");
      expect(text).toContain("1 Counterspell");
      expect(text).toContain("1 Forest");
    });

    it("omits categories with no entries", () => {
      const entries = [
        makeEntry("Sol Ring", "Artifact"),
      ];
      const deck = makeDeck(entries);
      const text = toText(deck);

      expect(text).not.toContain("Creature\n");
      expect(text).not.toContain("Instant\n");
      expect(text).not.toContain("Land\n");
    });

    it("handles a deck with no entries (commander only)", () => {
      const deck = makeDeck([]);
      const text = toText(deck);

      expect(text).toBe("Commander\n1 Atraxa, Praetors' Voice");
    });

    it("orders categories in the expected order", () => {
      const entries = [
        makeEntry("Forest", "Land"),
        makeEntry("Sol Ring", "Ramp"),
        makeEntry("Swords to Plowshares", "Removal"),
        makeEntry("Llanowar Elves", "Creature"),
        makeEntry("Counterspell", "Instant"),
      ];
      const deck = makeDeck(entries);
      const text = toText(deck);
      const lines = text.split("\n");

      const creatureIdx = lines.indexOf("Creature");
      const instantIdx = lines.indexOf("Instant");
      const landIdx = lines.indexOf("Land");
      const rampIdx = lines.indexOf("Ramp");
      const removalIdx = lines.indexOf("Removal");

      expect(creatureIdx).toBeLessThan(instantIdx);
      expect(instantIdx).toBeLessThan(landIdx);
      expect(landIdx).toBeLessThan(rampIdx);
      expect(rampIdx).toBeLessThan(removalIdx);
    });

    it("handles multiple cards in the same category", () => {
      const entries = [
        makeEntry("Llanowar Elves", "Creature"),
        makeEntry("Birds of Paradise", "Creature"),
        makeEntry("Elvish Mystic", "Creature"),
      ];
      const deck = makeDeck(entries);
      const text = toText(deck);
      const lines = text.split("\n");

      const creatureIdx = lines.indexOf("Creature");
      expect(lines[creatureIdx + 1]).toBe("1 Llanowar Elves");
      expect(lines[creatureIdx + 2]).toBe("1 Birds of Paradise");
      expect(lines[creatureIdx + 3]).toBe("1 Elvish Mystic");
    });
  });

  // ─── toMTGO ─────────────────────────────────────────────────────

  describe("toMTGO", () => {
    it("starts with the commander", () => {
      const deck = makeDeck([]);
      const text = toMTGO(deck);
      const lines = text.split("\n");

      expect(lines[0]).toBe("1 Atraxa, Praetors' Voice");
    });

    it("formats each line as quantity followed by card name", () => {
      const entries = [
        makeEntry("Sol Ring", "Artifact"),
        makeEntry("Plains", "Land", 5),
      ];
      const deck = makeDeck(entries);
      const text = toMTGO(deck);

      expect(text).toContain("1 Sol Ring");
      expect(text).toContain("5 Plains");
    });

    it("does not include category headers", () => {
      const entries = [
        makeEntry("Sol Ring", "Artifact"),
        makeEntry("Llanowar Elves", "Creature"),
      ];
      const deck = makeDeck(entries);
      const text = toMTGO(deck);

      expect(text).not.toContain("Artifact");
      expect(text).not.toContain("Creature");
    });

    it("does not include blank separator lines", () => {
      const entries = [
        makeEntry("Sol Ring", "Artifact"),
        makeEntry("Llanowar Elves", "Creature"),
        makeEntry("Forest", "Land"),
      ];
      const deck = makeDeck(entries);
      const text = toMTGO(deck);
      const lines = text.split("\n");

      for (const line of lines) {
        expect(line.trim()).not.toBe("");
      }
    });

    it("includes every card exactly once", () => {
      const entries = [
        makeEntry("Sol Ring", "Artifact"),
        makeEntry("Counterspell", "Instant"),
        makeEntry("Forest", "Land"),
      ];
      const deck = makeDeck(entries);
      const text = toMTGO(deck);

      expect(text).toContain("1 Sol Ring");
      expect(text).toContain("1 Counterspell");
      expect(text).toContain("1 Forest");
    });

    it("handles a deck with no entries (commander only)", () => {
      const deck = makeDeck([]);
      const text = toMTGO(deck);

      expect(text).toBe("1 Atraxa, Praetors' Voice");
    });

    it("quantity sum equals total card count", () => {
      const entries = [
        makeEntry("Sol Ring", "Artifact"),
        makeEntry("Plains", "Land", 3),
        makeEntry("Counterspell", "Instant"),
      ];
      const deck = makeDeck(entries);
      const text = toMTGO(deck);
      const lines = text.split("\n");

      const totalQuantity = lines.reduce((sum, line) => {
        const match = line.match(/^(\d+)\s/);
        return sum + (match ? parseInt(match[1], 10) : 0);
      }, 0);

      // Commander (1) + Sol Ring (1) + Plains (3) + Counterspell (1) = 6
      expect(totalQuantity).toBe(6);
    });
  });
});
