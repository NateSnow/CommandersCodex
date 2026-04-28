import { describe, it, expect } from "vitest";
import {
  getManaCurve,
  getCategoryBreakdown,
  getColorDistribution,
  getAverageCmc,
  getTypeBreakdown,
} from "../statistics-calculator.js";
import type { Card } from "../../models/card.js";
import type { DeckEntry, CardCategory } from "../../models/deck.js";

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

/** Helper to create a deck entry. */
function makeEntry(
  card: Card,
  category: CardCategory = "Creature",
  quantity = 1,
): DeckEntry {
  return { card, quantity, category };
}

describe("StatisticsCalculator", () => {
  // ─── getManaCurve ───────────────────────────────────────────────

  describe("getManaCurve", () => {
    it("returns empty buckets for an empty card list", () => {
      const result = getManaCurve([]);
      expect(result.buckets).toEqual([]);
    });

    it("returns a single bucket for cards with the same CMC", () => {
      const cards = [
        makeCard({ cmc: 3 }),
        makeCard({ cmc: 3 }),
        makeCard({ cmc: 3 }),
      ];
      const result = getManaCurve(cards);
      expect(result.buckets).toEqual([{ cmc: 3, count: 3 }]);
    });

    it("returns buckets sorted by CMC ascending", () => {
      const cards = [
        makeCard({ cmc: 5 }),
        makeCard({ cmc: 1 }),
        makeCard({ cmc: 3 }),
        makeCard({ cmc: 1 }),
      ];
      const result = getManaCurve(cards);
      expect(result.buckets).toEqual([
        { cmc: 1, count: 2 },
        { cmc: 3, count: 1 },
        { cmc: 5, count: 1 },
      ]);
    });

    it("includes CMC 0 cards", () => {
      const cards = [
        makeCard({ cmc: 0 }),
        makeCard({ cmc: 2 }),
      ];
      const result = getManaCurve(cards);
      expect(result.buckets[0]).toEqual({ cmc: 0, count: 1 });
    });

    it("bucket counts sum to total number of cards", () => {
      const cards = [
        makeCard({ cmc: 1 }),
        makeCard({ cmc: 2 }),
        makeCard({ cmc: 2 }),
        makeCard({ cmc: 4 }),
        makeCard({ cmc: 7 }),
      ];
      const result = getManaCurve(cards);
      const total = result.buckets.reduce((sum, b) => sum + b.count, 0);
      expect(total).toBe(cards.length);
    });
  });

  // ─── getCategoryBreakdown ───────────────────────────────────────

  describe("getCategoryBreakdown", () => {
    it("returns empty categories for an empty entry list", () => {
      const result = getCategoryBreakdown([]);
      expect(result.categories).toEqual([]);
    });

    it("returns correct count and percentage for a single category", () => {
      const entries = [
        makeEntry(makeCard(), "Creature"),
        makeEntry(makeCard(), "Creature"),
        makeEntry(makeCard(), "Creature"),
      ];
      const result = getCategoryBreakdown(entries);
      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].name).toBe("Creature");
      expect(result.categories[0].count).toBe(3);
      expect(result.categories[0].percentage).toBe(100);
    });

    it("returns correct breakdown for multiple categories", () => {
      const entries = [
        makeEntry(makeCard(), "Creature"),
        makeEntry(makeCard(), "Creature"),
        makeEntry(makeCard(), "Instant"),
        makeEntry(makeCard(), "Land"),
      ];
      const result = getCategoryBreakdown(entries);

      const creature = result.categories.find((c) => c.name === "Creature");
      const instant = result.categories.find((c) => c.name === "Instant");
      const land = result.categories.find((c) => c.name === "Land");

      expect(creature?.count).toBe(2);
      expect(creature?.percentage).toBe(50);
      expect(instant?.count).toBe(1);
      expect(instant?.percentage).toBe(25);
      expect(land?.count).toBe(1);
      expect(land?.percentage).toBe(25);
    });

    it("accounts for entry quantity in counts", () => {
      const entries: DeckEntry[] = [
        { card: makeCard(), quantity: 3, category: "Land" },
        { card: makeCard(), quantity: 1, category: "Creature" },
      ];
      const result = getCategoryBreakdown(entries);

      const land = result.categories.find((c) => c.name === "Land");
      const creature = result.categories.find((c) => c.name === "Creature");

      expect(land?.count).toBe(3);
      expect(land?.percentage).toBe(75);
      expect(creature?.count).toBe(1);
      expect(creature?.percentage).toBe(25);
    });
  });

  // ─── getColorDistribution ──────────────────────────────────────

  describe("getColorDistribution", () => {
    it("returns empty colors for an empty card list", () => {
      const result = getColorDistribution([]);
      expect(result.colors).toEqual([]);
    });

    it("counts colorless cards in the Colorless bucket", () => {
      const cards = [
        makeCard({ colorIdentity: [] }),
        makeCard({ colorIdentity: [] }),
      ];
      const result = getColorDistribution(cards);
      expect(result.colors).toHaveLength(1);
      expect(result.colors[0].color).toBe("Colorless");
      expect(result.colors[0].count).toBe(2);
      expect(result.colors[0].percentage).toBe(100);
    });

    it("counts each color a card contributes to", () => {
      const cards = [
        makeCard({ colorIdentity: ["W", "U"] }),
      ];
      const result = getColorDistribution(cards);

      const white = result.colors.find((c) => c.color === "W");
      const blue = result.colors.find((c) => c.color === "U");

      expect(white?.count).toBe(1);
      expect(blue?.count).toBe(1);
    });

    it("returns correct distribution for mixed cards", () => {
      const cards = [
        makeCard({ colorIdentity: ["W"] }),
        makeCard({ colorIdentity: ["W", "U"] }),
        makeCard({ colorIdentity: ["R"] }),
        makeCard({ colorIdentity: [] }),
      ];
      const result = getColorDistribution(cards);

      const white = result.colors.find((c) => c.color === "W");
      const blue = result.colors.find((c) => c.color === "U");
      const red = result.colors.find((c) => c.color === "R");
      const colorless = result.colors.find((c) => c.color === "Colorless");

      expect(white?.count).toBe(2);
      expect(white?.percentage).toBe(50);
      expect(blue?.count).toBe(1);
      expect(blue?.percentage).toBe(25);
      expect(red?.count).toBe(1);
      expect(red?.percentage).toBe(25);
      expect(colorless?.count).toBe(1);
      expect(colorless?.percentage).toBe(25);
    });

    it("does not include Colorless bucket when all cards have colors", () => {
      const cards = [
        makeCard({ colorIdentity: ["W"] }),
        makeCard({ colorIdentity: ["U"] }),
      ];
      const result = getColorDistribution(cards);
      const colorless = result.colors.find((c) => c.color === "Colorless");
      expect(colorless).toBeUndefined();
    });
  });

  // ─── getAverageCmc ─────────────────────────────────────────────

  describe("getAverageCmc", () => {
    it("returns 0 for an empty card list", () => {
      expect(getAverageCmc([])).toBe(0);
    });

    it("returns 0 when all cards are lands", () => {
      const cards = [
        makeCard({ typeLine: "Basic Land — Plains", cmc: 0 }),
        makeCard({ typeLine: "Land", cmc: 0 }),
      ];
      expect(getAverageCmc(cards)).toBe(0);
    });

    it("returns the CMC of a single non-land card", () => {
      const cards = [makeCard({ cmc: 4, typeLine: "Creature — Angel" })];
      expect(getAverageCmc(cards)).toBe(4);
    });

    it("returns the average CMC of non-land cards", () => {
      const cards = [
        makeCard({ cmc: 2, typeLine: "Creature — Human" }),
        makeCard({ cmc: 4, typeLine: "Instant" }),
        makeCard({ cmc: 6, typeLine: "Sorcery" }),
      ];
      expect(getAverageCmc(cards)).toBe(4);
    });

    it("excludes land cards from the average", () => {
      const cards = [
        makeCard({ cmc: 3, typeLine: "Creature — Elf" }),
        makeCard({ cmc: 0, typeLine: "Land" }),
        makeCard({ cmc: 5, typeLine: "Enchantment" }),
      ];
      // Average of 3 and 5 = 4
      expect(getAverageCmc(cards)).toBe(4);
    });

    it("handles fractional averages", () => {
      const cards = [
        makeCard({ cmc: 1, typeLine: "Instant" }),
        makeCard({ cmc: 2, typeLine: "Sorcery" }),
      ];
      expect(getAverageCmc(cards)).toBe(1.5);
    });
  });

  // ─── getTypeBreakdown ──────────────────────────────────────────

  describe("getTypeBreakdown", () => {
    it("returns all zero counts for an empty card list", () => {
      const result = getTypeBreakdown([]);
      for (const entry of result.types) {
        expect(entry.count).toBe(0);
      }
      expect(result.types.map((t) => t.type)).toEqual([
        "Creature",
        "Instant",
        "Sorcery",
        "Artifact",
        "Enchantment",
        "Planeswalker",
        "Land",
      ]);
    });

    it("counts cards by their type line", () => {
      const cards = [
        makeCard({ typeLine: "Creature — Human" }),
        makeCard({ typeLine: "Creature — Elf" }),
        makeCard({ typeLine: "Instant" }),
        makeCard({ typeLine: "Land" }),
      ];
      const result = getTypeBreakdown(cards);

      const creature = result.types.find((t) => t.type === "Creature");
      const instant = result.types.find((t) => t.type === "Instant");
      const land = result.types.find((t) => t.type === "Land");
      const sorcery = result.types.find((t) => t.type === "Sorcery");

      expect(creature?.count).toBe(2);
      expect(instant?.count).toBe(1);
      expect(land?.count).toBe(1);
      expect(sorcery?.count).toBe(0);
    });

    it("counts artifact creatures in both Artifact and Creature buckets", () => {
      const cards = [
        makeCard({ typeLine: "Artifact Creature — Golem" }),
      ];
      const result = getTypeBreakdown(cards);

      const artifact = result.types.find((t) => t.type === "Artifact");
      const creature = result.types.find((t) => t.type === "Creature");

      expect(artifact?.count).toBe(1);
      expect(creature?.count).toBe(1);
    });

    it("counts enchantment creatures in both buckets", () => {
      const cards = [
        makeCard({ typeLine: "Enchantment Creature — God" }),
      ];
      const result = getTypeBreakdown(cards);

      const enchantment = result.types.find((t) => t.type === "Enchantment");
      const creature = result.types.find((t) => t.type === "Creature");

      expect(enchantment?.count).toBe(1);
      expect(creature?.count).toBe(1);
    });

    it("handles planeswalker type", () => {
      const cards = [
        makeCard({ typeLine: "Legendary Planeswalker — Jace" }),
      ];
      const result = getTypeBreakdown(cards);

      const planeswalker = result.types.find((t) => t.type === "Planeswalker");
      expect(planeswalker?.count).toBe(1);
    });

    it("is case-insensitive for type matching", () => {
      const cards = [
        makeCard({ typeLine: "CREATURE — Dragon" }),
        makeCard({ typeLine: "artifact" }),
      ];
      const result = getTypeBreakdown(cards);

      const creature = result.types.find((t) => t.type === "Creature");
      const artifact = result.types.find((t) => t.type === "Artifact");

      expect(creature?.count).toBe(1);
      expect(artifact?.count).toBe(1);
    });
  });
});
