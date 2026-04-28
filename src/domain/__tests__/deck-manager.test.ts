import { describe, it, expect, beforeEach } from "vitest";
import { DeckManager } from "../deck-manager.js";
import type { Card } from "../../models/card.js";

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

/** Helper to create a legal commander card. */
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

describe("DeckManager", () => {
  let manager: DeckManager;

  beforeEach(() => {
    manager = new DeckManager();
  });

  // -----------------------------------------------------------------
  // setCommander
  // -----------------------------------------------------------------
  describe("setCommander", () => {
    it("accepts a legal legendary creature as commander", () => {
      const commander = makeCommander();
      const result = manager.setCommander(commander);

      expect(result.ok).toBe(true);
      expect(manager.getCommander()).toBe(commander);
    });

    it("rejects a non-legendary, non-creature card", () => {
      const card = makeCard({
        typeLine: "Enchantment",
        oracleText: "Some effect",
      });
      const result = manager.setCommander(card);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe("INVALID_COMMANDER");
      }
      expect(manager.getCommander()).toBeNull();
    });

    it("accepts a card with 'can be your commander' text", () => {
      const card = makeCard({
        typeLine: "Planeswalker — Nahiri",
        oracleText: "Nahiri can be your commander.",
      });
      const result = manager.setCommander(card);

      expect(result.ok).toBe(true);
      expect(manager.getCommander()?.name).toBe("Test Card");
    });

    it("rejects a banned card as commander", () => {
      const card = makeCommander({ name: "Golos, Tireless Pilgrim" });
      const result = manager.setCommander(card);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe("BANNED_CARD");
      }
    });

    it("clears existing entries when commander changes", () => {
      const commander1 = makeCommander({ id: "cmd-1", name: "Commander A" });
      const commander2 = makeCommander({
        id: "cmd-2",
        name: "Commander B",
        colorIdentity: ["W", "U"],
      });

      manager.setCommander(commander1);
      manager.addCard(makeCard({ id: "card-1", name: "Card A", colorIdentity: ["W"] }));
      expect(manager.getCardCount()).toBe(2); // commander + 1 card

      manager.setCommander(commander2);
      expect(manager.getCardCount()).toBe(1); // only new commander
      expect(manager.getCards()).toHaveLength(0);
    });

    it("initializes color identity from the commander", () => {
      const commander = makeCommander({ colorIdentity: ["W", "U", "B"] });
      manager.setCommander(commander);

      expect(manager.getColorIdentity()).toEqual(["W", "U", "B"]);
    });
  });

  // -----------------------------------------------------------------
  // addCard
  // -----------------------------------------------------------------
  describe("addCard", () => {
    beforeEach(() => {
      manager.setCommander(makeCommander({ colorIdentity: ["W", "U"] }));
    });

    it("adds a valid card and increases deck count by 1", () => {
      const card = makeCard({ id: "card-1", name: "Swords to Plowshares", colorIdentity: ["W"] });
      const countBefore = manager.getCardCount();
      const result = manager.addCard(card);

      expect(result.ok).toBe(true);
      expect(manager.getCardCount()).toBe(countBefore + 1);
    });

    it("returns error when no commander is set", () => {
      const freshManager = new DeckManager();
      const card = makeCard();
      const result = freshManager.addCard(card);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe("INVALID_COMMANDER");
      }
    });

    it("rejects a banned card", () => {
      const card = makeCard({ name: "Black Lotus", colorIdentity: [] });
      const result = manager.addCard(card);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe("BANNED_CARD");
      }
    });

    it("rejects a card outside the commander's color identity", () => {
      const card = makeCard({ name: "Lightning Bolt", colorIdentity: ["R"] });
      const result = manager.addCard(card);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe("COLOR_IDENTITY_VIOLATION");
      }
    });

    it("rejects a duplicate non-basic-land card", () => {
      const card1 = makeCard({ id: "sol-1", name: "Sol Ring", colorIdentity: [] });
      const card2 = makeCard({ id: "sol-2", name: "Sol Ring", colorIdentity: [] });

      manager.addCard(card1);
      const result = manager.addCard(card2);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe("SINGLETON_VIOLATION");
      }
    });

    it("allows multiple copies of basic lands", () => {
      const plains1 = makeCard({ id: "plains-1", name: "Plains", colorIdentity: [] });
      const plains2 = makeCard({ id: "plains-2", name: "Plains", colorIdentity: [] });

      const r1 = manager.addCard(plains1);
      const r2 = manager.addCard(plains2);

      expect(r1.ok).toBe(true);
      expect(r2.ok).toBe(true);
    });

    it("rejects adding a card with the same name as the commander", () => {
      const card = makeCard({ id: "dup-cmd", name: "Test Commander", colorIdentity: ["W"] });
      const result = manager.addCard(card);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe("SINGLETON_VIOLATION");
      }
    });

    it("rejects adding when deck is full (100 cards)", () => {
      // Add 99 cards to fill the deck (commander is 1)
      for (let i = 0; i < 99; i++) {
        manager.addCard(
          makeCard({ id: `fill-${i}`, name: `Filler ${i}`, colorIdentity: ["W"] }),
        );
      }
      expect(manager.getCardCount()).toBe(100);

      const result = manager.addCard(
        makeCard({ id: "overflow", name: "Overflow Card", colorIdentity: ["W"] }),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe("DECK_FULL");
      }
    });

    it("auto-assigns category based on type line when none provided", () => {
      const instant = makeCard({
        id: "instant-1",
        name: "Counterspell",
        typeLine: "Instant",
        colorIdentity: ["U"],
      });
      manager.addCard(instant);

      const entries = manager.getCards();
      expect(entries[0].category).toBe("Instant");
    });

    it("uses the provided category when specified", () => {
      const card = makeCard({ id: "card-1", name: "Sol Ring", colorIdentity: [] });
      manager.addCard(card, "Ramp");

      const entries = manager.getCards();
      expect(entries[0].category).toBe("Ramp");
    });

    it("infers Land category for land cards", () => {
      const land = makeCard({
        id: "land-1",
        name: "Hallowed Fountain",
        typeLine: "Land — Plains Island",
        colorIdentity: ["W", "U"],
      });
      manager.addCard(land);

      expect(manager.getCards()[0].category).toBe("Land");
    });

    it("infers Artifact category for artifact cards", () => {
      const artifact = makeCard({
        id: "art-1",
        name: "Sol Ring",
        typeLine: "Artifact",
        colorIdentity: [],
      });
      manager.addCard(artifact);

      expect(manager.getCards()[0].category).toBe("Artifact");
    });
  });

  // -----------------------------------------------------------------
  // removeCard
  // -----------------------------------------------------------------
  describe("removeCard", () => {
    beforeEach(() => {
      manager.setCommander(makeCommander({ colorIdentity: ["W", "U"] }));
    });

    it("removes a card and decreases deck count by 1", () => {
      const card = makeCard({ id: "card-1", name: "Card A", colorIdentity: ["W"] });
      manager.addCard(card);
      const countBefore = manager.getCardCount();

      const result = manager.removeCard("card-1");

      expect(result.ok).toBe(true);
      expect(manager.getCardCount()).toBe(countBefore - 1);
    });

    it("returns error when card is not found", () => {
      const result = manager.removeCard("nonexistent-id");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe("CARD_NOT_FOUND");
      }
    });

    it("card is no longer in entries after removal", () => {
      const card = makeCard({ id: "card-1", name: "Card A", colorIdentity: ["W"] });
      manager.addCard(card);
      manager.removeCard("card-1");

      const entries = manager.getCards();
      expect(entries.find((e) => e.card.id === "card-1")).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------
  // setCardCategory
  // -----------------------------------------------------------------
  describe("setCardCategory", () => {
    beforeEach(() => {
      manager.setCommander(makeCommander({ colorIdentity: ["W", "U"] }));
    });

    it("updates the category of an existing card", () => {
      const card = makeCard({ id: "card-1", name: "Card A", colorIdentity: ["W"] });
      manager.addCard(card);

      manager.setCardCategory("card-1", "Removal");

      const entries = manager.getCards();
      expect(entries[0].category).toBe("Removal");
    });

    it("does nothing for a nonexistent card ID", () => {
      // Should not throw
      manager.setCardCategory("nonexistent", "Ramp");
      expect(manager.getCards()).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------
  // Accessors
  // -----------------------------------------------------------------
  describe("accessors", () => {
    it("getCards returns a copy of entries", () => {
      manager.setCommander(makeCommander({ colorIdentity: ["W", "U"] }));
      manager.addCard(makeCard({ id: "c1", name: "Card 1", colorIdentity: ["W"] }));

      const cards = manager.getCards();
      cards.push({
        card: makeCard({ id: "c2", name: "Injected" }),
        quantity: 1,
        category: "Custom",
      });

      // Original should be unaffected
      expect(manager.getCards()).toHaveLength(1);
    });

    it("getCardCount includes the commander", () => {
      manager.setCommander(makeCommander());
      expect(manager.getCardCount()).toBe(1);

      manager.addCard(makeCard({ id: "c1", name: "Card 1", colorIdentity: ["W"] }));
      expect(manager.getCardCount()).toBe(2);
    });

    it("getColorIdentity returns empty array when no commander is set", () => {
      expect(manager.getColorIdentity()).toEqual([]);
    });

    it("getColorIdentity returns a copy", () => {
      manager.setCommander(makeCommander({ colorIdentity: ["W", "U"] }));
      const identity = manager.getColorIdentity();
      identity.push("B");

      expect(manager.getColorIdentity()).toEqual(["W", "U"]);
    });
  });
});
