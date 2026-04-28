import { describe, it, expect } from "vitest";
import { categorize } from "../card-categorizer.js";
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

describe("CardCategorizer", () => {
  describe("Removal", () => {
    it('classifies cards with "destroy target" as Removal', () => {
      const card = makeCard({
        name: "Murder",
        oracleText: "Destroy target creature.",
      });
      expect(categorize(card)).toBe("Removal");
    });

    it('classifies cards with "destroy all" as Removal', () => {
      const card = makeCard({
        name: "Wrath of God",
        oracleText: "Destroy all creatures. They can't be regenerated.",
      });
      expect(categorize(card)).toBe("Removal");
    });

    it('classifies cards with "exile target" as Removal', () => {
      const card = makeCard({
        name: "Swords to Plowshares",
        oracleText: "Exile target creature. Its controller gains life equal to its power.",
      });
      expect(categorize(card)).toBe("Removal");
    });

    it('classifies cards with "exile all" as Removal', () => {
      const card = makeCard({
        name: "Farewell",
        oracleText: "Choose one or more — Exile all artifacts; exile all creatures; exile all enchantments; exile all graveyards.",
      });
      expect(categorize(card)).toBe("Removal");
    });

    it('classifies cards with "return to hand" as Removal', () => {
      const card = makeCard({
        name: "Unsummon",
        oracleText: "Return target creature to its owner's hand.",
      });
      expect(categorize(card)).toBe("Removal");
    });

    it('classifies cards with "counter target" as Removal', () => {
      const card = makeCard({
        name: "Counterspell",
        oracleText: "Counter target spell.",
      });
      expect(categorize(card)).toBe("Removal");
    });

    it('classifies cards with "-X/-X" as Removal', () => {
      const card = makeCard({
        name: "Toxic Deluge",
        oracleText: "As an additional cost to cast this spell, pay X life. All creatures get -X/-X until end of turn.",
      });
      expect(categorize(card)).toBe("Removal");
    });

    it('classifies cards with "deals damage to target" as Removal', () => {
      const card = makeCard({
        name: "Lightning Bolt",
        oracleText: "Lightning Bolt deals 3 damage to target creature or player.",
      });
      expect(categorize(card)).toBe("Removal");
    });

    it('classifies cards with "deals damage to each" as Removal', () => {
      const card = makeCard({
        name: "Blasphemous Act",
        oracleText: "This spell costs {1} less to cast for each creature on the battlefield. Blasphemous Act deals 13 damage to each creature.",
      });
      expect(categorize(card)).toBe("Removal");
    });
  });

  describe("Card Draw", () => {
    it('classifies cards with "draw a card" as Card Draw', () => {
      const card = makeCard({
        name: "Opt",
        oracleText: "Scry 1. Draw a card.",
      });
      expect(categorize(card)).toBe("Card Draw");
    });

    it('classifies cards with "draw cards" as Card Draw', () => {
      const card = makeCard({
        name: "Harmonize",
        oracleText: "Draw three cards.",
      });
      expect(categorize(card)).toBe("Card Draw");
    });

    it('classifies cards with "draws X cards" as Card Draw', () => {
      const card = makeCard({
        name: "Blue Sun's Zenith",
        oracleText: "Target player draws X cards. Shuffle Blue Sun's Zenith into its owner's library.",
      });
      expect(categorize(card)).toBe("Card Draw");
    });

    it('classifies cards with "draw X" as Card Draw', () => {
      const card = makeCard({
        name: "Sphinx's Revelation",
        oracleText: "You gain X life and draw X cards.",
      });
      expect(categorize(card)).toBe("Card Draw");
    });

    it('classifies cards with "draws a card" as Card Draw', () => {
      const card = makeCard({
        name: "Howling Mine",
        oracleText: "At the beginning of each player's draw step, if Howling Mine is untapped, that player draws a card.",
      });
      expect(categorize(card)).toBe("Card Draw");
    });

    it('classifies cards with "scry" as Card Draw', () => {
      const card = makeCard({
        name: "Preordain",
        oracleText: "Scry 2, then draw a card.",
      });
      expect(categorize(card)).toBe("Card Draw");
    });
  });

  describe("Ramp", () => {
    it('classifies cards with "add {W}" as Ramp', () => {
      const card = makeCard({
        name: "Llanowar Elves",
        oracleText: "{T}: Add {G}.",
        typeLine: "Creature — Elf Druid",
      });
      expect(categorize(card)).toBe("Ramp");
    });

    it('classifies cards with "add {" for multi-mana as Ramp', () => {
      const card = makeCard({
        name: "Sol Ring",
        oracleText: "{T}: Add {C}{C}.",
        typeLine: "Artifact",
      });
      expect(categorize(card)).toBe("Ramp");
    });

    it('classifies cards with "add one mana" as Ramp', () => {
      const card = makeCard({
        name: "Arcane Signet",
        oracleText: "{T}: Add one mana of any color in your commander's color identity.",
        typeLine: "Artifact",
      });
      expect(categorize(card)).toBe("Ramp");
    });

    it('classifies cards with "search your library for a land" as Ramp', () => {
      const card = makeCard({
        name: "Rampant Growth",
        oracleText: "Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.",
        typeLine: "Sorcery",
      });
      expect(categorize(card)).toBe("Ramp");
    });

    it('classifies cards with "put land onto the battlefield" as Ramp', () => {
      const card = makeCard({
        name: "Exploration",
        oracleText: "You may put an additional land onto the battlefield on each of your turns.",
        typeLine: "Enchantment",
      });
      expect(categorize(card)).toBe("Ramp");
    });

    it("classifies non-basic lands with abilities as Ramp", () => {
      const card = makeCard({
        name: "Command Tower",
        typeLine: "Land",
        oracleText: "{T}: Add one mana of any color in your commander's color identity.",
      });
      expect(categorize(card)).toBe("Ramp");
    });
  });

  describe("Threat", () => {
    it("classifies creatures with no special text as Threat", () => {
      const card = makeCard({
        name: "Grizzly Bears",
        typeLine: "Creature — Bear",
        oracleText: "",
        isCreature: true,
      });
      expect(categorize(card)).toBe("Threat");
    });

    it("classifies planeswalkers with no matching keywords as Threat", () => {
      const card = makeCard({
        name: "Jace, the Mind Sculptor",
        typeLine: "Legendary Planeswalker — Jace",
        oracleText: "+2: Look at the top card of target player's library. You may put that card on the bottom of that player's library.",
      });
      expect(categorize(card)).toBe("Threat");
    });

    it("classifies enchantments with no matching keywords as Threat", () => {
      const card = makeCard({
        name: "Doubling Season",
        typeLine: "Enchantment",
        oracleText: "If an effect would create one or more tokens under your control, it creates twice that many of those tokens instead.",
      });
      expect(categorize(card)).toBe("Threat");
    });

    it("classifies artifacts with no matching keywords as Threat", () => {
      const card = makeCard({
        name: "Lightning Greaves",
        typeLine: "Artifact — Equipment",
        oracleText: "Equipped creature has haste and shroud. Equip {0}",
      });
      expect(categorize(card)).toBe("Threat");
    });
  });

  describe("Multi-category priority", () => {
    it("classifies a card with both removal and card draw text as Removal (highest priority)", () => {
      const card = makeCard({
        name: "Ravenous Chupacabra Variant",
        oracleText: "When this creature enters the battlefield, destroy target creature an opponent controls. Draw a card.",
      });
      expect(categorize(card)).toBe("Removal");
    });

    it("classifies a card with both card draw and ramp text as Card Draw (higher priority than Ramp)", () => {
      const card = makeCard({
        name: "Growth Spiral",
        oracleText: "Draw a card. You may put a land card from your hand onto the battlefield.",
      });
      expect(categorize(card)).toBe("Card Draw");
    });

    it("classifies a card with both removal and ramp text as Removal", () => {
      const card = makeCard({
        name: "Beast Within Variant",
        oracleText: "Destroy target permanent. Its controller searches their library for a basic land card and puts it onto the battlefield.",
      });
      expect(categorize(card)).toBe("Removal");
    });
  });

  describe("Double-faced cards", () => {
    it("considers oracle text from both faces", () => {
      const card = makeCard({
        name: "Delver of Secrets",
        oracleText: "",
        cardFaces: [
          {
            name: "Delver of Secrets",
            manaCost: "{U}",
            typeLine: "Creature — Human Wizard",
            oracleText: "At the beginning of your upkeep, look at the top card of your library. You may reveal that card. If an instant or sorcery card is revealed this way, transform Delver of Secrets.",
            colors: ["U"],
          },
          {
            name: "Insectile Aberration",
            manaCost: "",
            typeLine: "Creature — Human Insect",
            oracleText: "Flying. When this creature transforms, draw a card.",
            colors: ["U"],
          },
        ],
      });
      // The back face has "draw a card" so it should be Card Draw
      expect(categorize(card)).toBe("Card Draw");
    });

    it("classifies a double-faced card with removal text on back face as Removal", () => {
      const card = makeCard({
        name: "Brutal Cathar",
        oracleText: "",
        cardFaces: [
          {
            name: "Brutal Cathar",
            manaCost: "{2}{W}",
            typeLine: "Creature — Human Soldier Werewolf",
            oracleText: "When this creature enters the battlefield or transforms into Brutal Cathar, exile target creature an opponent controls until this creature leaves the battlefield.",
            colors: ["W"],
          },
          {
            name: "Moonrage Brute",
            manaCost: "",
            typeLine: "Creature — Werewolf",
            oracleText: "First strike, ward—Pay 3 life.",
            colors: ["W"],
          },
        ],
      });
      expect(categorize(card)).toBe("Removal");
    });
  });
});
