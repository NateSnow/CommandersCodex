import { describe, it, expect } from "vitest";
import {
  parseManaPips,
  calculateColorRequirements,
  buildManaBase,
} from "../mana-base-builder.js";
import type { Card, Color, ColorIdentity } from "../../models/card.js";
import type { ColorRequirements } from "../../models/generation.js";
import type { ScryfallAdapter } from "../../data/scryfall-adapter.js";

/** Helper to create a minimal Card for testing. */
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

/** Stub ScryfallAdapter — not used by current implementation. */
const stubAdapter = {} as ScryfallAdapter;

/** Count total lands in a DeckEntry array (summing quantities). */
function totalLandCount(entries: { quantity: number }[]): number {
  return entries.reduce((sum, e) => sum + e.quantity, 0);
}

/** Get all land names from entries. */
function landNames(entries: { card: { name: string }; quantity: number }[]): string[] {
  const names: string[] = [];
  for (const e of entries) {
    for (let i = 0; i < e.quantity; i++) {
      names.push(e.card.name);
    }
  }
  return names;
}

describe("parseManaPips", () => {
  it("parses a simple two-color mana cost", () => {
    const result = parseManaPips("{2}{W}{U}{U}");
    expect(result).toEqual({ W: 1, U: 2, B: 0, R: 0, G: 0 });
  });

  it("returns all zeros for a colorless mana cost", () => {
    const result = parseManaPips("{3}");
    expect(result).toEqual({ W: 0, U: 0, B: 0, R: 0, G: 0 });
  });

  it("returns all zeros for an empty string", () => {
    const result = parseManaPips("");
    expect(result).toEqual({ W: 0, U: 0, B: 0, R: 0, G: 0 });
  });

  it("parses a five-color mana cost", () => {
    const result = parseManaPips("{W}{U}{B}{R}{G}");
    expect(result).toEqual({ W: 1, U: 1, B: 1, R: 1, G: 1 });
  });

  it("handles repeated pips of the same color", () => {
    const result = parseManaPips("{B}{B}{B}");
    expect(result).toEqual({ W: 0, U: 0, B: 3, R: 0, G: 0 });
  });

  it("handles generic mana mixed with colored pips", () => {
    const result = parseManaPips("{4}{R}{R}{G}");
    expect(result).toEqual({ W: 0, U: 0, B: 0, R: 2, G: 1 });
  });

  it("handles X costs (ignores non-color symbols)", () => {
    const result = parseManaPips("{X}{R}{R}");
    expect(result).toEqual({ W: 0, U: 0, B: 0, R: 2, G: 0 });
  });

  it("handles lowercase color symbols", () => {
    const result = parseManaPips("{w}{u}");
    expect(result).toEqual({ W: 1, U: 1, B: 0, R: 0, G: 0 });
  });
});

describe("calculateColorRequirements", () => {
  it("aggregates pips across multiple cards", () => {
    const cards = [
      makeCard({ manaCost: "{1}{W}{W}", typeLine: "Creature — Angel" }),
      makeCard({ manaCost: "{2}{U}", typeLine: "Instant" }),
      makeCard({ manaCost: "{W}{U}", typeLine: "Creature — Human Wizard" }),
    ];
    const result = calculateColorRequirements(cards);
    expect(result.pipCounts.W).toBe(3);
    expect(result.pipCounts.U).toBe(2);
    expect(result.totalPips).toBe(5);
  });

  it("skips land cards", () => {
    const cards = [
      makeCard({ manaCost: "{1}{W}", typeLine: "Creature — Human" }),
      makeCard({ manaCost: "{G}", typeLine: "Basic Land — Forest" }),
    ];
    const result = calculateColorRequirements(cards);
    expect(result.pipCounts.W).toBe(1);
    expect(result.pipCounts.G).toBe(0);
    expect(result.totalPips).toBe(1);
  });

  it("returns all zeros for an empty card list", () => {
    const result = calculateColorRequirements([]);
    expect(result.pipCounts).toEqual({ W: 0, U: 0, B: 0, R: 0, G: 0 });
    expect(result.totalPips).toBe(0);
  });

  it("handles cards with no colored pips", () => {
    const cards = [
      makeCard({ manaCost: "{3}", typeLine: "Artifact" }),
    ];
    const result = calculateColorRequirements(cards);
    expect(result.totalPips).toBe(0);
  });
});

describe("buildManaBase", () => {
  describe("two-color commander", () => {
    const colorIdentity: ColorIdentity = ["W", "U"];
    const requirements: ColorRequirements = {
      pipCounts: { W: 20, U: 15, B: 0, R: 0, G: 0 },
      totalPips: 35,
    };
    const landCount = 37;

    it("produces the correct total land count", async () => {
      const entries = await buildManaBase(colorIdentity, requirements, landCount, stubAdapter);
      expect(totalLandCount(entries)).toBe(landCount);
    });

    it("includes multi-color utility lands", async () => {
      const entries = await buildManaBase(colorIdentity, requirements, landCount, stubAdapter);
      const names = landNames(entries);
      expect(names).toContain("Command Tower");
      expect(names).toContain("Exotic Orchard");
    });

    it("includes dual lands for the color pair", async () => {
      const entries = await buildManaBase(colorIdentity, requirements, landCount, stubAdapter);
      const names = landNames(entries);
      // UW dual lands
      expect(names).toContain("Hallowed Fountain");
    });

    it("includes basic lands for both colors", async () => {
      const entries = await buildManaBase(colorIdentity, requirements, landCount, stubAdapter);
      const names = landNames(entries);
      expect(names).toContain("Plains");
      expect(names).toContain("Island");
    });

    it("allocates more basics to the color with more pips", async () => {
      const entries = await buildManaBase(colorIdentity, requirements, landCount, stubAdapter);
      let plainsCount = 0;
      let islandCount = 0;
      for (const entry of entries) {
        if (entry.card.name === "Plains") plainsCount += entry.quantity;
        if (entry.card.name === "Island") islandCount += entry.quantity;
      }
      // W has 20 pips vs U has 15 pips, so Plains should be >= Island
      expect(plainsCount).toBeGreaterThanOrEqual(islandCount);
    });

    it("ensures each color has at least 20% of basic land slots", async () => {
      const entries = await buildManaBase(colorIdentity, requirements, landCount, stubAdapter);
      // Count basic lands
      let plainsCount = 0;
      let islandCount = 0;
      let totalBasics = 0;
      for (const entry of entries) {
        if (entry.card.name === "Plains") {
          plainsCount += entry.quantity;
          totalBasics += entry.quantity;
        }
        if (entry.card.name === "Island") {
          islandCount += entry.quantity;
          totalBasics += entry.quantity;
        }
      }
      if (totalBasics > 0) {
        expect(plainsCount / totalBasics).toBeGreaterThanOrEqual(0.19); // slight tolerance for rounding
        expect(islandCount / totalBasics).toBeGreaterThanOrEqual(0.19);
      }
    });
  });

  describe("mono-color commander", () => {
    const colorIdentity: ColorIdentity = ["R"];
    const requirements: ColorRequirements = {
      pipCounts: { W: 0, U: 0, B: 0, R: 30, G: 0 },
      totalPips: 30,
    };
    const landCount = 37;

    it("produces the correct total land count", async () => {
      const entries = await buildManaBase(colorIdentity, requirements, landCount, stubAdapter);
      expect(totalLandCount(entries)).toBe(landCount);
    });

    it("fills primarily with basic lands of that color", async () => {
      const entries = await buildManaBase(colorIdentity, requirements, landCount, stubAdapter);
      let mountainCount = 0;
      for (const entry of entries) {
        if (entry.card.name === "Mountain") mountainCount += entry.quantity;
      }
      // Should be more than 50% basics
      expect(mountainCount / landCount).toBeGreaterThan(0.5);
    });

    it("includes a few colorless utility lands", async () => {
      const entries = await buildManaBase(colorIdentity, requirements, landCount, stubAdapter);
      const names = landNames(entries);
      expect(names).toContain("Reliquary Tower");
    });

    it("does not include multi-color utility lands", async () => {
      const entries = await buildManaBase(colorIdentity, requirements, landCount, stubAdapter);
      const names = landNames(entries);
      expect(names).not.toContain("Command Tower");
      expect(names).not.toContain("City of Brass");
    });
  });

  describe("colorless commander", () => {
    const colorIdentity: ColorIdentity = [];
    const requirements: ColorRequirements = {
      pipCounts: { W: 0, U: 0, B: 0, R: 0, G: 0 },
      totalPips: 0,
    };
    const landCount = 37;

    it("produces the correct total land count", async () => {
      const entries = await buildManaBase(colorIdentity, requirements, landCount, stubAdapter);
      expect(totalLandCount(entries)).toBe(landCount);
    });

    it("includes Wastes", async () => {
      const entries = await buildManaBase(colorIdentity, requirements, landCount, stubAdapter);
      const names = landNames(entries);
      expect(names).toContain("Wastes");
    });

    it("includes colorless utility lands", async () => {
      const entries = await buildManaBase(colorIdentity, requirements, landCount, stubAdapter);
      const names = landNames(entries);
      expect(names).toContain("Reliquary Tower");
      expect(names).toContain("Rogue's Passage");
    });

    it("does not include any colored basic lands", async () => {
      const entries = await buildManaBase(colorIdentity, requirements, landCount, stubAdapter);
      const names = landNames(entries);
      expect(names).not.toContain("Plains");
      expect(names).not.toContain("Island");
      expect(names).not.toContain("Swamp");
      expect(names).not.toContain("Mountain");
      expect(names).not.toContain("Forest");
    });
  });
});
