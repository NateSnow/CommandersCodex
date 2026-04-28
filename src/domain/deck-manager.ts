/**
 * Central orchestrator for deck state in Commander format.
 *
 * Enforces Commander format rules on every mutation:
 * - Commander legality (legendary creature or "can be your commander")
 * - Color identity (all cards within commander's color identity)
 * - Singleton rule (no duplicate non-basic-lands)
 * - Banned card list
 * - Deck size (max 100 cards including commander)
 *
 * Dispatches events via the shared event bus so UI components can
 * react to state changes without direct coupling.
 */

import type { Card, ColorIdentity } from "../models/card.js";
import type { CardCategory, Deck, DeckEntry, SavedDeck, SavedDeckEntry } from "../models/deck.js";
import type { DeckError, Result } from "../models/result.js";
import type { LocalStorageAdapter } from "../data/local-storage-adapter.js";
import type { ScryfallAdapter } from "../data/scryfall-adapter.js";
import { canBeCommander } from "./commander-utils.js";
import { isBanned } from "./banned-list.js";
import { isSubsetOfColorIdentity } from "./color-identity.js";
import { dispatch } from "../utils/event-bus.js";

/** Maximum number of cards in a Commander deck (including the commander). */
const MAX_DECK_SIZE = 100;

/** Basic lands exempt from the singleton rule. */
const BASIC_LANDS: Set<string> = new Set([
  "Plains",
  "Island",
  "Swamp",
  "Mountain",
  "Forest",
  "Wastes",
]);

/**
 * Infers a default {@link CardCategory} from a card's type line.
 *
 * Checks for the most specific type first (Planeswalker before
 * Creature, etc.) so that multi-type cards get a reasonable default.
 */
function inferCategory(card: Card): CardCategory {
  const typeLine = card.typeLine.toLowerCase();

  if (typeLine.includes("land")) return "Land";
  if (typeLine.includes("planeswalker")) return "Planeswalker";
  if (typeLine.includes("creature")) return "Creature";
  if (typeLine.includes("instant")) return "Instant";
  if (typeLine.includes("sorcery")) return "Sorcery";
  if (typeLine.includes("artifact")) return "Artifact";
  if (typeLine.includes("enchantment")) return "Enchantment";

  return "Custom";
}

/**
 * Manages the state of a single Commander deck.
 *
 * All mutating methods validate inputs against Commander format rules
 * and return a {@link Result} indicating success or a descriptive
 * {@link DeckError}. Successful mutations dispatch events on the
 * shared event bus.
 */
export class DeckManager {
  private commander: Card | null = null;
  private entries: DeckEntry[] = [];
  private deckId: string = crypto.randomUUID();
  private deckName: string = "";
  private createdAt: string = new Date().toISOString();

  private localStorageAdapter?: LocalStorageAdapter;
  private scryfallAdapter?: ScryfallAdapter;

  /**
   * Creates a new DeckManager.
   *
   * Adapters are optional — persistence methods (`saveDeck`, `loadDeck`)
   * require them but the core deck-building functionality works without.
   */
  constructor(options?: {
    localStorageAdapter?: LocalStorageAdapter;
    scryfallAdapter?: ScryfallAdapter;
  }) {
    if (options?.localStorageAdapter) {
      this.localStorageAdapter = options.localStorageAdapter;
    }
    if (options?.scryfallAdapter) {
      this.scryfallAdapter = options.scryfallAdapter;
    }
  }

  // -------------------------------------------------------------------
  // Commander management
  // -------------------------------------------------------------------

  /**
   * Sets the commander for this deck.
   *
   * Validates that the card is a legal commander, then initialises
   * (or re-initialises) the deck. Existing entries are cleared when
   * the commander changes.
   */
  setCommander(card: Card): Result<void, DeckError> {
    if (!canBeCommander(card)) {
      return {
        ok: false,
        error: {
          kind: "INVALID_COMMANDER",
          message: `${card.name} cannot be used as a commander because it is not a legendary creature and does not have "can be your commander" text.`,
        },
      };
    }

    if (isBanned(card.name)) {
      return {
        ok: false,
        error: {
          kind: "BANNED_CARD",
          message: `${card.name} is banned in Commander format.`,
        },
      };
    }

    this.commander = card;
    this.entries = [];
    this.createdAt = new Date().toISOString();
    this.deckId = crypto.randomUUID();

    dispatch("commander-changed", { commander: card });

    return { ok: true, value: undefined };
  }

  /** Returns the current commander, or `null` if none is set. */
  getCommander(): Card | null {
    return this.commander;
  }

  // -------------------------------------------------------------------
  // Card management
  // -------------------------------------------------------------------

  /**
   * Adds a card to the deck.
   *
   * Validates:
   * 1. A commander has been set
   * 2. The deck is not full (< 100 total including commander)
   * 3. The card is not banned
   * 4. The card's color identity is within the commander's
   * 5. The singleton rule is not violated (non-basic-lands)
   *
   * If no category is provided, one is inferred from the card's type line.
   */
  addCard(card: Card, category?: CardCategory): Result<void, DeckError> {
    if (!this.commander) {
      return {
        ok: false,
        error: {
          kind: "INVALID_COMMANDER",
          message: "A commander must be selected before adding cards.",
        },
      };
    }

    // Deck size check: commander counts as 1, so entries can hold at most 99
    const currentCount = this.getCardCount();
    if (currentCount >= MAX_DECK_SIZE) {
      return {
        ok: false,
        error: {
          kind: "DECK_FULL",
          message: `Deck is full (${MAX_DECK_SIZE}/${MAX_DECK_SIZE} cards).`,
        },
      };
    }

    // Banned card check
    if (isBanned(card.name)) {
      return {
        ok: false,
        error: {
          kind: "BANNED_CARD",
          message: `${card.name} is banned in Commander format.`,
        },
      };
    }

    // Color identity check
    if (
      !isSubsetOfColorIdentity(card.colorIdentity, this.commander.colorIdentity)
    ) {
      return {
        ok: false,
        error: {
          kind: "COLOR_IDENTITY_VIOLATION",
          message: `${card.name}'s color identity [${card.colorIdentity.join(", ")}] is outside your commander's color identity [${this.commander.colorIdentity.join(", ")}].`,
        },
      };
    }

    // Singleton rule: non-basic-lands may only appear once
    if (!BASIC_LANDS.has(card.name)) {
      // Also check against the commander's name
      if (card.name === this.commander.name) {
        return {
          ok: false,
          error: {
            kind: "SINGLETON_VIOLATION",
            message: `${card.name} is already in your deck as the commander. Commander decks can only have one copy of each non-basic-land card.`,
          },
        };
      }

      const alreadyInDeck = this.entries.some(
        (entry) => entry.card.name === card.name,
      );
      if (alreadyInDeck) {
        return {
          ok: false,
          error: {
            kind: "SINGLETON_VIOLATION",
            message: `${card.name} is already in your deck. Commander decks can only have one copy of each non-basic-land card.`,
          },
        };
      }
    }

    const resolvedCategory = category ?? inferCategory(card);

    this.entries.push({
      card,
      quantity: 1,
      category: resolvedCategory,
    });

    dispatch("deck-changed", { deck: this.toDeck() });

    return { ok: true, value: undefined };
  }

  /**
   * Removes a card from the deck by its Scryfall ID.
   *
   * Returns an error if the card is not found in the entries.
   */
  removeCard(cardId: string): Result<void, DeckError> {
    const index = this.entries.findIndex((entry) => entry.card.id === cardId);

    if (index === -1) {
      return {
        ok: false,
        error: {
          kind: "CARD_NOT_FOUND",
          message: `No card with ID "${cardId}" found in the deck.`,
        },
      };
    }

    this.entries.splice(index, 1);

    dispatch("deck-changed", { deck: this.toDeck() });

    return { ok: true, value: undefined };
  }

  /**
   * Updates the category assignment for a card in the deck.
   */
  setCardCategory(cardId: string, category: CardCategory): void {
    const entry = this.entries.find((e) => e.card.id === cardId);
    if (entry) {
      entry.category = category;
      dispatch("deck-changed", { deck: this.toDeck() });
    }
  }

  // -------------------------------------------------------------------
  // Deck state accessors
  // -------------------------------------------------------------------

  /** Returns all deck entries (excluding the commander). */
  getCards(): DeckEntry[] {
    return [...this.entries];
  }

  /**
   * Returns the total card count including the commander.
   *
   * The commander counts as 1, so a full deck has
   * `1 (commander) + 99 (entries) = 100`.
   */
  getCardCount(): number {
    const entryCount = this.entries.reduce(
      (sum, entry) => sum + entry.quantity,
      0,
    );
    return (this.commander ? 1 : 0) + entryCount;
  }

  /** Returns the commander's color identity, or an empty array if no commander is set. */
  getColorIdentity(): ColorIdentity {
    return this.commander ? [...this.commander.colorIdentity] : [];
  }

  // -------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------

  /**
   * Saves the current deck to local storage.
   *
   * Converts the in-memory deck state to a {@link SavedDeck} that stores
   * only card IDs and names (not full card objects) to keep storage size
   * manageable. Requires a `LocalStorageAdapter` to be injected.
   */
  saveDeck(name: string): Result<void, DeckError> {
    if (!this.localStorageAdapter) {
      return {
        ok: false,
        error: {
          kind: "LOAD_ERROR",
          message: "No storage adapter configured. Cannot save deck.",
        },
      };
    }

    if (!this.commander) {
      return {
        ok: false,
        error: {
          kind: "INVALID_COMMANDER",
          message: "A commander must be selected before saving a deck.",
        },
      };
    }

    this.deckName = name;

    const savedEntries: SavedDeckEntry[] = this.entries.map((entry) => ({
      cardId: entry.card.id,
      cardName: entry.card.name,
      quantity: entry.quantity,
      category: entry.category,
    }));

    const savedDeck: SavedDeck = {
      id: this.deckId,
      name,
      commanderId: this.commander.id,
      commanderName: this.commander.name,
      entries: savedEntries,
      createdAt: this.createdAt,
      updatedAt: new Date().toISOString(),
    };

    this.localStorageAdapter.saveDeck(savedDeck);

    return { ok: true, value: undefined };
  }

  /**
   * Loads a deck from local storage and restores its state.
   *
   * Fetches full card data from Scryfall's `/cards/collection` endpoint
   * using the stored card IDs. Cards that Scryfall fails to return are
   * marked as "missing" with a placeholder card containing the stored
   * card name, allowing the user to remove or replace them.
   *
   * Requires both `LocalStorageAdapter` and `ScryfallAdapter` to be
   * injected.
   */
  async loadDeck(deckId: string): Promise<Result<void, DeckError>> {
    if (!this.localStorageAdapter) {
      return {
        ok: false,
        error: {
          kind: "LOAD_ERROR",
          message: "No storage adapter configured. Cannot load deck.",
        },
      };
    }

    if (!this.scryfallAdapter) {
      return {
        ok: false,
        error: {
          kind: "LOAD_ERROR",
          message: "No Scryfall adapter configured. Cannot load deck.",
        },
      };
    }

    const savedDeck = this.localStorageAdapter.loadDeck(deckId);
    if (!savedDeck) {
      return {
        ok: false,
        error: {
          kind: "LOAD_ERROR",
          message: `Deck "${deckId}" not found or data is corrupted.`,
        },
      };
    }

    // Collect all card IDs to fetch (commander + entries)
    const allIds = [savedDeck.commanderId, ...savedDeck.entries.map((e) => e.cardId)];

    let fetchedCards: Card[];
    try {
      fetchedCards = await this.scryfallAdapter.fetchCardCollection(allIds);
    } catch {
      return {
        ok: false,
        error: {
          kind: "LOAD_ERROR",
          message: "Failed to fetch card data from Scryfall. Please try again later.",
        },
      };
    }

    // Build a lookup map from fetched cards
    const cardMap = new Map<string, Card>();
    for (const card of fetchedCards) {
      cardMap.set(card.id, card);
    }

    // Restore commander
    const commanderCard = cardMap.get(savedDeck.commanderId);
    if (!commanderCard) {
      return {
        ok: false,
        error: {
          kind: "LOAD_ERROR",
          message: `Commander "${savedDeck.commanderName}" could not be fetched from Scryfall.`,
        },
      };
    }

    // Restore deck state
    this.commander = commanderCard;
    this.deckId = savedDeck.id;
    this.deckName = savedDeck.name;
    this.createdAt = savedDeck.createdAt;

    // Restore entries, marking missing cards with placeholders
    this.entries = savedDeck.entries.map((savedEntry) => {
      const card = cardMap.get(savedEntry.cardId);
      if (card) {
        return {
          card,
          quantity: savedEntry.quantity,
          category: savedEntry.category,
        };
      }

      // Card not found — create a placeholder "missing" card
      const missingCard: Card = {
        id: savedEntry.cardId,
        name: `${savedEntry.cardName} (missing)`,
        manaCost: "",
        cmc: 0,
        typeLine: "Unknown",
        oracleText: "This card could not be loaded from Scryfall.",
        colors: [],
        colorIdentity: [],
        legalities: {},
        keywords: [],
        isLegendary: false,
        isCreature: false,
        canBeCommander: false,
      };

      return {
        card: missingCard,
        quantity: savedEntry.quantity,
        category: savedEntry.category,
      };
    });

    dispatch("commander-changed", { commander: commanderCard });
    dispatch("deck-changed", { deck: this.toDeck() });

    return { ok: true, value: undefined };
  }

  // -------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------

  /** Builds a {@link Deck} snapshot from the current state. */
  private toDeck(): Deck {
    return {
      id: this.deckId,
      name: this.deckName,
      commander: this.commander!,
      entries: [...this.entries],
      createdAt: this.createdAt,
      updatedAt: new Date().toISOString(),
    };
  }
}
