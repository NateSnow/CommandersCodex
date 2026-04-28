import { describe, it, expect } from "vitest";
import { getDefaultTemplate, allocate } from "../category-allocator.js";
import type { Card } from "../../models/card.js";
import type { CategoryTemplate } from "../../models/generation.js";

/** Helper to create a minimal Card object for testing. */
function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: overrides.id ?? `card-${Math.random().toString(36).slice(2, 8)}`,
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

/** Create N cards that will categorize as the given type. */
function makeCardsOfType(
  type: "Ramp" | "Card Draw" | "Removal" | "Threat",
  count: number,
): Card[] {
  const oracleTextMap: Record<string, string> = {
    Ramp: "{T}: Add {G}.",
    "Card Draw": "Draw a card.",
    Removal: "Destroy target creature.",
    Threat: "Flying.",
  };
  return Array.from({ length: count }, (_, i) =>
    makeCard({
      id: `${type.toLowerCase().replace(" ", "-")}-${i}`,
      name: `${type} Card ${i}`,
      oracleText: oracleTextMap[type],
    }),
  );
}

/** A small template for easier testing. */
const smallTemplate: CategoryTemplate = {
  ramp: { min: 2, max: 4 },
  cardDraw: { min: 2, max: 4 },
  removal: { min: 2, max: 4 },
  threats: { min: 3, max: 6 },
};

describe("CategoryAllocator", () => {
  describe("getDefaultTemplate", () => {
    it("returns the default category template with correct ranges", () => {
      const template = getDefaultTemplate();
      expect(template.ramp).toEqual({ min: 8, max: 12 });
      expect(template.cardDraw).toEqual({ min: 8, max: 12 });
      expect(template.removal).toEqual({ min: 8, max: 12 });
      expect(template.threats).toEqual({ min: 25, max: 35 });
    });
  });

  describe("allocate", () => {
    it("fills all categories to min when enough cards are provided", () => {
      const cards = [
        ...makeCardsOfType("Ramp", 3),
        ...makeCardsOfType("Card Draw", 3),
        ...makeCardsOfType("Removal", 3),
        ...makeCardsOfType("Threat", 5),
      ];

      const result = allocate(cards, smallTemplate, []);

      expect(result.ramp.length).toBeGreaterThanOrEqual(smallTemplate.ramp.min);
      expect(result.cardDraw.length).toBeGreaterThanOrEqual(smallTemplate.cardDraw.min);
      expect(result.removal.length).toBeGreaterThanOrEqual(smallTemplate.removal.min);
      expect(result.threats.length).toBeGreaterThanOrEqual(smallTemplate.threats.min);
    });

    it("assigns combo cards to their respective categories", () => {
      const comboRamp = makeCard({
        id: "combo-ramp-1",
        name: "Combo Ramp",
        oracleText: "{T}: Add {G}.",
      });
      const comboRemoval = makeCard({
        id: "combo-removal-1",
        name: "Combo Removal",
        oracleText: "Destroy target creature.",
      });

      const otherCards = [
        ...makeCardsOfType("Ramp", 2),
        ...makeCardsOfType("Removal", 2),
        ...makeCardsOfType("Threat", 4),
      ];

      const result = allocate(
        [comboRamp, comboRemoval, ...otherCards],
        smallTemplate,
        [comboRamp, comboRemoval],
      );

      // Combo cards should be in their respective categories
      const rampIds = result.ramp.map((e) => e.card.id);
      const removalIds = result.removal.map((e) => e.card.id);
      expect(rampIds).toContain("combo-ramp-1");
      expect(removalIds).toContain("combo-removal-1");
    });

    it("puts excess cards into unallocated when categories are full", () => {
      // Provide more cards than max allows
      const cards = makeCardsOfType("Ramp", 10);

      const tinyTemplate: CategoryTemplate = {
        ramp: { min: 2, max: 3 },
        cardDraw: { min: 0, max: 0 },
        removal: { min: 0, max: 0 },
        threats: { min: 0, max: 0 },
      };

      const result = allocate(cards, tinyTemplate, []);

      expect(result.ramp.length).toBe(3); // max
      expect(result.unallocated.length).toBe(7); // 10 - 3
    });

    it("does not exceed category max values", () => {
      const cards = [
        ...makeCardsOfType("Ramp", 10),
        ...makeCardsOfType("Card Draw", 10),
        ...makeCardsOfType("Removal", 10),
        ...makeCardsOfType("Threat", 20),
      ];

      const result = allocate(cards, smallTemplate, []);

      expect(result.ramp.length).toBeLessThanOrEqual(smallTemplate.ramp.max);
      expect(result.cardDraw.length).toBeLessThanOrEqual(smallTemplate.cardDraw.max);
      expect(result.removal.length).toBeLessThanOrEqual(smallTemplate.removal.max);
      expect(result.threats.length).toBeLessThanOrEqual(smallTemplate.threats.max);
    });

    it("handles empty card list gracefully", () => {
      const result = allocate([], smallTemplate, []);

      expect(result.ramp).toEqual([]);
      expect(result.cardDraw).toEqual([]);
      expect(result.removal).toEqual([]);
      expect(result.threats).toEqual([]);
      expect(result.unallocated).toEqual([]);
    });

    it("combo cards count toward category totals for min/max enforcement", () => {
      // Fill ramp min entirely with combo cards
      const comboCards = makeCardsOfType("Ramp", 2).map((c, i) => ({
        ...c,
        id: `combo-ramp-${i}`,
      }));

      const extraRamp = makeCardsOfType("Ramp", 5);

      const tinyTemplate: CategoryTemplate = {
        ramp: { min: 2, max: 3 },
        cardDraw: { min: 0, max: 0 },
        removal: { min: 0, max: 0 },
        threats: { min: 0, max: 0 },
      };

      const result = allocate(
        [...comboCards, ...extraRamp],
        tinyTemplate,
        comboCards,
      );

      // 2 combo cards fill min, 1 more can fit up to max, rest go to unallocated
      expect(result.ramp.length).toBe(3);
      expect(result.unallocated.length).toBe(4);
    });

    it("preserves input order priority (earlier cards are allocated first)", () => {
      const highPriority = makeCard({
        id: "high-priority",
        name: "High Priority Threat",
        oracleText: "Flying.",
      });
      const lowPriority = makeCard({
        id: "low-priority",
        name: "Low Priority Threat",
        oracleText: "Trample.",
      });

      const tinyTemplate: CategoryTemplate = {
        ramp: { min: 0, max: 0 },
        cardDraw: { min: 0, max: 0 },
        removal: { min: 0, max: 0 },
        threats: { min: 1, max: 1 },
      };

      const result = allocate(
        [highPriority, lowPriority],
        tinyTemplate,
        [],
      );

      // High priority card (earlier in array) should be in threats
      expect(result.threats[0].card.id).toBe("high-priority");
      // Low priority card should be unallocated
      expect(result.unallocated[0].card.id).toBe("low-priority");
    });
  });
});
