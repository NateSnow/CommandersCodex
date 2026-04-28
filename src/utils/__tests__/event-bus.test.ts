/**
 * Unit tests for the event bus utility.
 */

import { describe, it, expect, vi } from "vitest";
import { dispatch, subscribe } from "../event-bus.js";
import type { Card } from "../../models/card.js";
import type { Deck } from "../../models/deck.js";

/** Minimal card fixture for testing. */
function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: "test-id",
    name: "Test Card",
    manaCost: "{1}{W}",
    cmc: 2,
    typeLine: "Legendary Creature — Human",
    oracleText: "",
    colors: ["W"],
    colorIdentity: ["W"],
    imageUris: { small: "", normal: "", large: "", artCrop: "" },
    legalities: { commander: "legal" },
    keywords: [],
    isLegendary: true,
    isCreature: true,
    canBeCommander: true,
    ...overrides,
  };
}

/** Minimal deck fixture for testing. */
function makeDeck(overrides: Partial<Deck> = {}): Deck {
  return {
    id: "deck-1",
    name: "Test Deck",
    commander: makeCard(),
    entries: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("event-bus", () => {
  describe("dispatch and subscribe", () => {
    it("should deliver deck-changed events to subscribers", () => {
      const handler = vi.fn();
      const unsub = subscribe("deck-changed", handler);

      const deck = makeDeck();
      dispatch("deck-changed", { deck });

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].detail.deck).toBe(deck);

      unsub();
    });

    it("should deliver commander-changed events to subscribers", () => {
      const handler = vi.fn();
      const unsub = subscribe("commander-changed", handler);

      const commander = makeCard({ name: "Atraxa" });
      dispatch("commander-changed", { commander });

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].detail.commander.name).toBe("Atraxa");

      unsub();
    });

    it("should deliver error events to subscribers", () => {
      const handler = vi.fn();
      const unsub = subscribe("error", handler);

      dispatch("error", { message: "Something went wrong", source: "scryfall" });

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].detail.message).toBe("Something went wrong");
      expect(handler.mock.calls[0][0].detail.source).toBe("scryfall");

      unsub();
    });

    it("should support error events without a source", () => {
      const handler = vi.fn();
      const unsub = subscribe("error", handler);

      dispatch("error", { message: "Unknown error" });

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].detail.source).toBeUndefined();

      unsub();
    });
  });

  describe("unsubscribe", () => {
    it("should stop receiving events after unsubscribing", () => {
      const handler = vi.fn();
      const unsub = subscribe("deck-changed", handler);

      dispatch("deck-changed", { deck: makeDeck() });
      expect(handler).toHaveBeenCalledOnce();

      unsub();

      dispatch("deck-changed", { deck: makeDeck() });
      expect(handler).toHaveBeenCalledOnce(); // still 1, not 2
    });
  });

  describe("multiple subscribers", () => {
    it("should deliver events to all subscribers", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const unsub1 = subscribe("deck-changed", handler1);
      const unsub2 = subscribe("deck-changed", handler2);

      dispatch("deck-changed", { deck: makeDeck() });

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();

      unsub1();
      unsub2();
    });

    it("should not cross-deliver between different event types", () => {
      const deckHandler = vi.fn();
      const errorHandler = vi.fn();
      const unsub1 = subscribe("deck-changed", deckHandler);
      const unsub2 = subscribe("error", errorHandler);

      dispatch("deck-changed", { deck: makeDeck() });

      expect(deckHandler).toHaveBeenCalledOnce();
      expect(errorHandler).not.toHaveBeenCalled();

      unsub1();
      unsub2();
    });
  });
});
