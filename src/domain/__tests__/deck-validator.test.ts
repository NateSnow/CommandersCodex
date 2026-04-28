import { describe, it, expect } from "vitest";
import { validate, checkCardLegality } from "../deck-validator.js";
import type { Card } from "../../models/card.js";
import type { Deck, DeckEntry } from "../../models/deck.js";

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
function makeCommander(overrides: Partial<Card> = {}): Card {
  return makeCard({
    id: "commander-id",
    name: "Test Commander",
    typeLine: "Legendary Creature — Human Wizard",
    colorIdentity: ["W", "U"],
    isLegendary: true,
    isCreature: true,
    canBeCommander: true,
    ...overrides,
  });
}

/** Helper to create a deck entry. */
function makeEntry(card: Card, quantity = 1): DeckEntry {
  return { card, quantity, category: "Creature" };
}

/** Helper to build a deck with N filler cards. */
function makeDeck(
  commander: Card,
  entries: DeckEntry[],
  overrides: Partial<Deck> = {},
): Deck {
  return {
    id: "deck-1",
    name: "Test Deck",
    commander,
    entries,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/** Generate N unique filler cards within the commander's color identity. */
function fillerCards(count: number, colorIdentity: Card["colorIdentity"] = ["W"]): DeckEntry[] {
  return Array.from({ length: count }, (_, i) =>
    makeEntry(
      makeCard({
        id: `filler-${i}`,
        name: `Filler Card ${i}`,
        colorIdentity,
      }),
    ),
  );
}

describe("DeckValidator", () => {
  describe("validate", () => {
    it("returns isLegal true for a valid 100-card deck", () => {
      const commander = makeCommander();
      const entries = fillerCards(99, ["W"]);
      const deck = makeDeck(commander, entries);

      const result = validate(deck);

      expect(result.isLegal).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("reports DECK_SIZE violation when deck has fewer than 100 cards", () => {
      const commander = makeCommander();
      const entries = fillerCards(50, ["W"]);
      const deck = makeDeck(commander, entries);

      const result = validate(deck);

      expect(result.isLegal).toBe(false);
      expect(result.violations.some((v) => v.rule === "DECK_SIZE")).toBe(true);
    });

    it("reports DECK_SIZE violation when deck has more than 100 cards", () => {
      const commander = makeCommander();
      const entries = fillerCards(100, ["W"]);
      const deck = makeDeck(commander, entries);

      const result = validate(deck);

      expect(result.isLegal).toBe(false);
      expect(result.violations.some((v) => v.rule === "DECK_SIZE")).toBe(true);
    });

    it("reports MISSING_COMMANDER when commander is null", () => {
      const entries = fillerCards(100, ["W"]);
      const deck = makeDeck(null as unknown as Card, entries);

      const result = validate(deck);

      expect(result.isLegal).toBe(false);
      expect(result.violations.some((v) => v.rule === "MISSING_COMMANDER")).toBe(true);
    });

    it("reports SINGLETON violation for duplicate non-basic-land cards", () => {
      const commander = makeCommander();
      const duplicate = makeCard({ id: "dup-1", name: "Sol Ring", colorIdentity: [] });
      const entries = [
        makeEntry(duplicate),
        makeEntry(makeCard({ id: "dup-2", name: "Sol Ring", colorIdentity: [] })),
        ...fillerCards(97, ["W"]),
      ];
      const deck = makeDeck(commander, entries);

      const result = validate(deck);

      expect(result.isLegal).toBe(false);
      expect(result.violations.some((v) => v.rule === "SINGLETON" && v.cardName === "Sol Ring")).toBe(true);
    });

    it("allows multiple copies of basic lands", () => {
      const commander = makeCommander();
      const plains1 = makeCard({ id: "plains-1", name: "Plains", colorIdentity: [] });
      const plains2 = makeCard({ id: "plains-2", name: "Plains", colorIdentity: [] });
      const entries = [
        makeEntry(plains1),
        makeEntry(plains2),
        ...fillerCards(97, ["W"]),
      ];
      const deck = makeDeck(commander, entries);

      const result = validate(deck);

      expect(result.violations.some((v) => v.rule === "SINGLETON")).toBe(false);
    });

    it("allows Wastes as a basic land exempt from singleton rule", () => {
      const commander = makeCommander();
      const wastes1 = makeCard({ id: "wastes-1", name: "Wastes", colorIdentity: [] });
      const wastes2 = makeCard({ id: "wastes-2", name: "Wastes", colorIdentity: [] });
      const entries = [
        makeEntry(wastes1),
        makeEntry(wastes2),
        ...fillerCards(97, ["W"]),
      ];
      const deck = makeDeck(commander, entries);

      const result = validate(deck);

      expect(result.violations.some((v) => v.rule === "SINGLETON")).toBe(false);
    });

    it("reports COLOR_IDENTITY violation for cards outside commander's colors", () => {
      const commander = makeCommander({ colorIdentity: ["W", "U"] });
      const offColorCard = makeCard({
        id: "off-color",
        name: "Lightning Bolt",
        colorIdentity: ["R"],
      });
      const entries = [makeEntry(offColorCard), ...fillerCards(98, ["W"])];
      const deck = makeDeck(commander, entries);

      const result = validate(deck);

      expect(result.isLegal).toBe(false);
      expect(
        result.violations.some(
          (v) => v.rule === "COLOR_IDENTITY" && v.cardName === "Lightning Bolt",
        ),
      ).toBe(true);
    });

    it("reports BANNED_CARD violation for banned cards", () => {
      const commander = makeCommander({ colorIdentity: ["W", "U", "B", "R", "G"] });
      const bannedCard = makeCard({
        id: "banned",
        name: "Black Lotus",
        colorIdentity: [],
      });
      const entries = [makeEntry(bannedCard), ...fillerCards(98, ["W"])];
      const deck = makeDeck(commander, entries);

      const result = validate(deck);

      expect(result.isLegal).toBe(false);
      expect(
        result.violations.some(
          (v) => v.rule === "BANNED_CARD" && v.cardName === "Black Lotus",
        ),
      ).toBe(true);
    });

    it("reports BANNED_CARD violation when the commander itself is banned", () => {
      const commander = makeCommander({
        name: "Golos, Tireless Pilgrim",
        colorIdentity: ["W", "U", "B", "R", "G"],
      });
      const entries = fillerCards(99, ["W"]);
      const deck = makeDeck(commander, entries);

      const result = validate(deck);

      expect(result.isLegal).toBe(false);
      expect(
        result.violations.some(
          (v) => v.rule === "BANNED_CARD" && v.cardName === "Golos, Tireless Pilgrim",
        ),
      ).toBe(true);
    });

    it("reports multiple violations at once", () => {
      const commander = makeCommander({ colorIdentity: ["W"] });
      const bannedOffColor = makeCard({
        id: "bad-card",
        name: "Ancestral Recall",
        colorIdentity: ["U"],
      });
      const entries = [makeEntry(bannedOffColor), ...fillerCards(50, ["W"])];
      const deck = makeDeck(commander, entries);

      const result = validate(deck);

      expect(result.isLegal).toBe(false);
      // Should have at least DECK_SIZE, COLOR_IDENTITY, and BANNED_CARD
      const rules = result.violations.map((v) => v.rule);
      expect(rules).toContain("DECK_SIZE");
      expect(rules).toContain("COLOR_IDENTITY");
      expect(rules).toContain("BANNED_CARD");
    });
  });

  describe("checkCardLegality", () => {
    it("returns isLegal true for a valid card", () => {
      const commander = makeCommander({ colorIdentity: ["W", "U"] });
      const card = makeCard({ name: "Swords to Plowshares", colorIdentity: ["W"] });

      const result = checkCardLegality(card, commander);

      expect(result.isLegal).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("rejects a card outside the commander's color identity", () => {
      const commander = makeCommander({ colorIdentity: ["W", "U"] });
      const card = makeCard({ name: "Lightning Bolt", colorIdentity: ["R"] });

      const result = checkCardLegality(card, commander);

      expect(result.isLegal).toBe(false);
      expect(result.violations.some((v) => v.rule === "COLOR_IDENTITY")).toBe(true);
    });

    it("rejects a banned card", () => {
      const commander = makeCommander({ colorIdentity: ["W", "U", "B", "R", "G"] });
      const card = makeCard({ name: "Black Lotus", colorIdentity: [] });

      const result = checkCardLegality(card, commander);

      expect(result.isLegal).toBe(false);
      expect(result.violations.some((v) => v.rule === "BANNED_CARD")).toBe(true);
    });

    it("rejects a duplicate non-basic-land when existingCardNames is provided", () => {
      const commander = makeCommander({ colorIdentity: ["W", "U"] });
      const card = makeCard({ name: "Sol Ring", colorIdentity: [] });
      const existing = new Set(["Sol Ring"]);

      const result = checkCardLegality(card, commander, existing);

      expect(result.isLegal).toBe(false);
      expect(result.violations.some((v) => v.rule === "SINGLETON")).toBe(true);
    });

    it("allows duplicate basic lands even when in existingCardNames", () => {
      const commander = makeCommander({ colorIdentity: ["W", "U"] });
      const card = makeCard({ name: "Plains", colorIdentity: [] });
      const existing = new Set(["Plains"]);

      const result = checkCardLegality(card, commander, existing);

      expect(result.isLegal).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("allows colorless cards with any commander", () => {
      const commander = makeCommander({ colorIdentity: ["W"] });
      const card = makeCard({ name: "Sol Ring", colorIdentity: [] });

      const result = checkCardLegality(card, commander);

      expect(result.isLegal).toBe(true);
    });

    it("reports multiple violations for a card that is both banned and off-color", () => {
      const commander = makeCommander({ colorIdentity: ["W"] });
      const card = makeCard({ name: "Ancestral Recall", colorIdentity: ["U"] });

      const result = checkCardLegality(card, commander);

      expect(result.isLegal).toBe(false);
      const rules = result.violations.map((v) => v.rule);
      expect(rules).toContain("COLOR_IDENTITY");
      expect(rules).toContain("BANNED_CARD");
    });
  });
});
