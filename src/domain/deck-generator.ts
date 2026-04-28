/**
 * Top-level orchestrator for automatic Commander deck generation.
 *
 * Coordinates the full generation pipeline: fetching recommendations,
 * selecting combos, allocating card categories, building the mana base,
 * filling remaining slots, validating, and loading into DeckManager.
 *
 * Supports two modes:
 * - Commander-based: generate a deck for a given commander
 * - Build-around: find a compatible commander for a given card, then generate
 */

import type { Card, Color, ColorIdentity } from "../models/card.js";
import type { Deck, DeckEntry } from "../models/deck.js";
import type {
  CategoryTemplate,
  CategorizedCards,
  ColorRequirements,
  GenerationOptions,
  GenerationResult,
  GenerationWarning,
} from "../models/generation.js";
import type { Combo, EDHRECRecommendation } from "../models/recommendation.js";
import type { ScryfallAdapter } from "../data/scryfall-adapter.js";
import type { EDHRECAdapter } from "../data/edhrec-adapter.js";
import type { CommanderSpellbookAdapter } from "../data/commander-spellbook-adapter.js";
import type { DeckManager } from "./deck-manager.js";
import { DEFAULT_CATEGORY_TEMPLATE } from "../models/generation.js";
import { allocate } from "./category-allocator.js";
import { buildManaBase, calculateColorRequirements } from "./mana-base-builder.js";
import { validate } from "./deck-validator.js";
import { isSubsetOfColorIdentity } from "./color-identity.js";
import { isBanned } from "./banned-list.js";
import { dispatch } from "../utils/event-bus.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default number of lands in a generated deck. */
const DEFAULT_LAND_COUNT = 37;

/** Synergy score tolerance for shuffling equally-ranked cards. */
const SYNERGY_SHUFFLE_TOLERANCE = 0.05;

// ---------------------------------------------------------------------------
// DeckGenerator class
// ---------------------------------------------------------------------------

export class DeckGenerator {
  private scryfallAdapter: ScryfallAdapter;
  private edhrecAdapter: EDHRECAdapter;
  private commanderSpellbookAdapter: CommanderSpellbookAdapter;
  private deckManager: DeckManager;

  constructor(deps: {
    scryfallAdapter: ScryfallAdapter;
    edhrecAdapter: EDHRECAdapter;
    commanderSpellbookAdapter: CommanderSpellbookAdapter;
    deckManager: DeckManager;
  }) {
    this.scryfallAdapter = deps.scryfallAdapter;
    this.edhrecAdapter = deps.edhrecAdapter;
    this.commanderSpellbookAdapter = deps.commanderSpellbookAdapter;
    this.deckManager = deps.deckManager;
  }

  // -----------------------------------------------------------------------
  // generate — full pipeline
  // -----------------------------------------------------------------------

  async generate(options: GenerationOptions): Promise<GenerationResult> {
    const { commander, buildAroundCard } = options;
    const landCount = options.landCount ?? DEFAULT_LAND_COUNT;
    const template = options.categoryTemplate ?? DEFAULT_CATEGORY_TEMPLATE;
    const warnings: GenerationWarning[] = [];
    const fallbacksUsed: string[] = [];

    try {
      // --- Phase 1: Fetch recommendations (20%) ---
      dispatch("generation-progress", {
        phase: "Fetching recommendations",
        percentComplete: 20,
      });

      let recommendations: EDHRECRecommendation[] = [];
      try {
        recommendations =
          await this.edhrecAdapter.getCommanderRecommendations(commander.name);
        if (recommendations.length === 0) {
          throw new Error("Empty EDHREC response");
        }
      } catch {
        // EDHREC failure → fall back to Scryfall search
        warnings.push({
          source: "edhrec",
          message:
            "EDHREC recommendations unavailable. Falling back to Scryfall search.",
        });
        fallbacksUsed.push("edhrec-unavailable");
        recommendations = await this.fetchScryfallFallbackRecommendations(
          commander.colorIdentity,
        );
      }

      // --- Phase 2: Fetch combos (40%) ---
      dispatch("generation-progress", {
        phase: "Selecting combos",
        percentComplete: 40,
      });

      let combos: Combo[] = [];
      try {
        combos = await this.commanderSpellbookAdapter.searchCombos(
          commander.colorIdentity,
        );
      } catch {
        warnings.push({
          source: "commander-spellbook",
          message:
            "Commander Spellbook unavailable. Skipping combo inclusion.",
        });
        fallbacksUsed.push("no-combos-found");
      }

      // --- Phase 3: Resolve card names → Card objects (60%) ---
      dispatch("generation-progress", {
        phase: "Allocating card categories",
        percentComplete: 60,
      });

      // Shuffle recommendations with similar synergy scores for regeneration variety
      const shuffledRecs = shuffleSimilarSynergyCards(recommendations);

      // Resolve recommendation card names to full Card objects via Scryfall
      const resolvedCards = await this.resolveRecommendations(
        shuffledRecs,
        commander.colorIdentity,
      );

      // --- Phase 4: Select combo cards ---
      const bestCombo = selectBestCombo(combos, recommendations);
      let comboCards: Card[] = [];
      const combosIncluded: Combo[] = [];

      if (bestCombo) {
        comboCards = await this.resolveCardNames(bestCombo.cards);
        // Filter combo cards to those within color identity
        comboCards = comboCards.filter(
          (c) =>
            isSubsetOfColorIdentity(c.colorIdentity, commander.colorIdentity) &&
            !isBanned(c.name),
        );
        if (comboCards.length === bestCombo.cards.length) {
          combosIncluded.push(bestCombo);
        } else {
          // Couldn't resolve all combo cards — skip this combo
          comboCards = [];
        }
      }

      // Ensure build-around card is in the resolved cards pool
      if (buildAroundCard) {
        const alreadyIncluded = resolvedCards.some(
          (c) => c.name === buildAroundCard.name,
        );
        if (!alreadyIncluded) {
          resolvedCards.unshift(buildAroundCard);
        }
      }

      // --- Phase 5: Allocate categories ---
      const categorized = allocate(resolvedCards, template, comboCards);

      // --- Phase 6: Build mana base (80%) ---
      dispatch("generation-progress", {
        phase: "Building mana base",
        percentComplete: 80,
      });

      const nonLandCards = collectNonLandCards(categorized);
      const colorRequirements = calculateColorRequirements(
        nonLandCards.map((e) => e.card),
      );
      const manaBase = await buildManaBase(
        commander.colorIdentity,
        colorRequirements,
        landCount,
        this.scryfallAdapter,
      );

      // --- Phase 7: Assemble deck and fill remaining slots ---
      let allEntries = [...nonLandCards, ...manaBase];

      // Target: 99 cards (excluding commander)
      const targetNonCommander = 99;
      if (allEntries.length < targetNonCommander) {
        const slotsToFill = targetNonCommander - allEntries.length;
        const existingNames = new Set(allEntries.map((e) => e.card.name));
        existingNames.add(commander.name);

        // Try unallocated cards first
        const unallocated = categorized.unallocated.filter(
          (e) => !existingNames.has(e.card.name),
        );
        for (const entry of unallocated) {
          if (allEntries.length >= targetNonCommander) break;
          allEntries.push(entry);
          existingNames.add(entry.card.name);
        }

        // If still short, search Scryfall for more cards
        if (allEntries.length < targetNonCommander) {
          try {
            const remaining = targetNonCommander - allEntries.length;
            const fillCards = await this.searchFillCards(
              commander.colorIdentity,
              existingNames,
              remaining,
            );
            allEntries.push(...fillCards);
          } catch {
            // Scryfall failure during fill — abort
            dispatch("generation-error", {
              message: "Card data is temporarily unavailable. Please try again later.",
            });
            throw new Error(
              "Card data is temporarily unavailable. Please try again later.",
            );
          }
        }
      }

      // Trim to exactly 99 if we somehow have more
      if (allEntries.length > targetNonCommander) {
        allEntries = allEntries.slice(0, targetNonCommander);
      }

      // Check if we have enough cards
      if (allEntries.length < targetNonCommander) {
        const errorMsg = `Could not assemble a complete deck for ${commander.name}. Try a different commander with more available cards.`;
        dispatch("generation-error", { message: errorMsg });
        return {
          deck: buildDeckObject(commander, allEntries),
          combosIncluded,
          warnings,
          fallbacksUsed: [...fallbacksUsed, "incomplete-deck"],
        };
      }

      // --- Phase 8: Finalize (95%) ---
      dispatch("generation-progress", {
        phase: "Finalizing deck",
        percentComplete: 95,
      });

      const deck = buildDeckObject(commander, allEntries);

      // Validate
      const validationResult = validate(deck);
      if (!validationResult.isLegal) {
        console.error(
          "Generated deck failed validation:",
          validationResult.violations,
        );
        dispatch("generation-error", {
          message:
            "An unexpected error occurred during deck generation. Please try again.",
        });
        return {
          deck,
          combosIncluded,
          warnings,
          fallbacksUsed,
        };
      }

      // Load into DeckManager
      this.deckManager.setCommander(commander);
      for (const entry of allEntries) {
        this.deckManager.addCard(entry.card, entry.category);
      }

      // Emit completion
      const result: GenerationResult = {
        deck,
        combosIncluded,
        warnings,
        fallbacksUsed,
      };

      dispatch("generation-complete", { result });

      return result;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred during deck generation.";
      dispatch("generation-error", { message });
      throw error;
    }
  }

  // -----------------------------------------------------------------------
  // generateBuildAround — build-around mode
  // -----------------------------------------------------------------------

  async generateBuildAround(card: Card): Promise<GenerationResult> {
    // If the card can be a commander, return a special result indicating
    // the user should choose whether to use it as commander
    if (card.canBeCommander) {
      return {
        deck: buildDeckObject(card, []),
        combosIncluded: [],
        warnings: [
          {
            source: "scryfall",
            message: `${card.name} can be used as a commander. You may want to use it as your commander instead.`,
          },
        ],
        fallbacksUsed: ["build-around-is-commander"],
      };
    }

    // Search Scryfall for commanders whose color identity includes the card's colors
    const colorQuery =
      card.colorIdentity.length > 0
        ? card.colorIdentity.map((c) => c.toLowerCase()).join("")
        : "c";

    let commanderCard: Card | undefined;
    try {
      const searchResult = await this.scryfallAdapter.searchCards(
        `is:commander`,
        card.colorIdentity,
      );
      // Pick the first result as the best commander
      commanderCard = searchResult.cards.find(
        (c) =>
          c.canBeCommander &&
          isSubsetOfColorIdentity(card.colorIdentity, c.colorIdentity),
      );
    } catch {
      // Scryfall failure
    }

    if (!commanderCard) {
      const errorMsg = `No suitable commander was found for ${card.name}. Try selecting a commander manually.`;
      dispatch("generation-error", { message: errorMsg });
      return {
        deck: buildDeckObject(
          {
            ...card,
            // Use the card as a placeholder commander for the error result
          } as Card,
          [],
        ),
        combosIncluded: [],
        warnings: [
          {
            source: "scryfall",
            message: errorMsg,
          },
        ],
        fallbacksUsed: ["no-compatible-commander"],
      };
    }

    // Generate with the selected commander and the build-around card
    const result = await this.generate({
      commander: commanderCard,
      buildAroundCard: card,
    });

    // Ensure the build-around card is in the deck
    const buildAroundInDeck = result.deck.entries.some(
      (e) => e.card.name === card.name,
    );
    if (!buildAroundInDeck) {
      // Replace the last non-land, non-combo entry with the build-around card
      const replaceIndex = result.deck.entries.findIndex(
        (e) =>
          e.category !== "Land" &&
          !result.combosIncluded.some((combo) =>
            combo.cards.includes(e.card.name),
          ),
      );
      if (replaceIndex >= 0) {
        result.deck.entries[replaceIndex] = {
          card,
          quantity: 1,
          category: "Creature",
        };
      }
    }

    return result;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Fall back to Scryfall search when EDHREC is unavailable.
   * Returns pseudo-recommendations from Scryfall card search.
   */
  private async fetchScryfallFallbackRecommendations(
    colorIdentity: ColorIdentity,
  ): Promise<EDHRECRecommendation[]> {
    const result = await this.scryfallAdapter.searchCards(
      "f:commander",
      colorIdentity,
    );
    return result.cards.map((card, index) => ({
      cardName: card.name,
      scryfallId: card.id,
      synergyScore: 1 - index * 0.01, // Decreasing score by position
      inclusionPercentage: 50,
    }));
  }

  /**
   * Resolve a list of EDHRECRecommendation card names to full Card objects
   * via Scryfall's fetchCardCollection. Filters out banned cards and cards
   * outside the commander's color identity.
   */
  private async resolveRecommendations(
    recommendations: EDHRECRecommendation[],
    commanderColors: ColorIdentity,
  ): Promise<Card[]> {
    // If recommendations have scryfallIds, use those; otherwise search by name
    const idsToFetch = recommendations
      .filter((r) => r.scryfallId)
      .map((r) => r.scryfallId!);

    let cards: Card[] = [];

    if (idsToFetch.length > 0) {
      // Batch fetch by ID
      cards = await this.scryfallAdapter.fetchCardCollection(idsToFetch);
    }

    // For recommendations without IDs, we need to search by name
    const resolvedNames = new Set(cards.map((c) => c.name));
    const unresolvedRecs = recommendations.filter(
      (r) => !r.scryfallId && !resolvedNames.has(r.cardName),
    );

    if (unresolvedRecs.length > 0) {
      // Search for unresolved cards in batches
      for (const rec of unresolvedRecs.slice(0, 50)) {
        try {
          const searchResult = await this.scryfallAdapter.searchCards(
            `!"${rec.cardName}"`,
            commanderColors,
          );
          if (searchResult.cards.length > 0) {
            cards.push(searchResult.cards[0]);
          }
        } catch {
          // Skip cards that can't be found
        }
      }
    }

    // Filter out banned cards and cards outside color identity
    return cards.filter(
      (card) =>
        !isBanned(card.name) &&
        isSubsetOfColorIdentity(card.colorIdentity, commanderColors) &&
        !card.typeLine.toLowerCase().includes("land"),
    );
  }

  /**
   * Resolve an array of card names to full Card objects via Scryfall search.
   */
  private async resolveCardNames(cardNames: string[]): Promise<Card[]> {
    const resolved: Card[] = [];
    for (const name of cardNames) {
      try {
        const searchResult = await this.scryfallAdapter.searchCards(
          `!"${name}"`,
          [],
        );
        if (searchResult.cards.length > 0) {
          resolved.push(searchResult.cards[0]);
        }
      } catch {
        // Skip cards that can't be found
      }
    }
    return resolved;
  }

  /**
   * Search Scryfall for additional cards to fill remaining deck slots.
   */
  private async searchFillCards(
    colorIdentity: ColorIdentity,
    existingNames: Set<string>,
    count: number,
  ): Promise<DeckEntry[]> {
    const result = await this.scryfallAdapter.searchCards(
      "f:commander",
      colorIdentity,
    );

    const entries: DeckEntry[] = [];
    for (const card of result.cards) {
      if (entries.length >= count) break;
      if (existingNames.has(card.name)) continue;
      if (isBanned(card.name)) continue;
      if (!isSubsetOfColorIdentity(card.colorIdentity, colorIdentity)) continue;
      if (card.typeLine.toLowerCase().includes("land")) continue;

      entries.push({
        card,
        quantity: 1,
        category: inferCategory(card),
      });
      existingNames.add(card.name);
    }

    return entries;
  }
}

// ---------------------------------------------------------------------------
// Pure helper functions
// ---------------------------------------------------------------------------

/**
 * Shuffle cards with similar synergy scores (within tolerance) to ensure
 * regeneration produces different decks.
 */
function shuffleSimilarSynergyCards(
  recommendations: EDHRECRecommendation[],
): EDHRECRecommendation[] {
  if (recommendations.length === 0) return [];

  // Sort by synergy score descending first
  const sorted = [...recommendations].sort(
    (a, b) => b.synergyScore - a.synergyScore,
  );

  // Group cards with similar synergy scores and shuffle within groups
  const result: EDHRECRecommendation[] = [];
  let groupStart = 0;

  while (groupStart < sorted.length) {
    const baseScore = sorted[groupStart].synergyScore;
    let groupEnd = groupStart + 1;

    while (
      groupEnd < sorted.length &&
      Math.abs(sorted[groupEnd].synergyScore - baseScore) <=
        SYNERGY_SHUFFLE_TOLERANCE
    ) {
      groupEnd++;
    }

    // Shuffle the group using Fisher-Yates
    const group = sorted.slice(groupStart, groupEnd);
    for (let i = group.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [group[i], group[j]] = [group[j], group[i]];
    }

    result.push(...group);
    groupStart = groupEnd;
  }

  return result;
}

/**
 * Select the best combo package. Prefers combos whose cards overlap
 * with EDHREC recommendations.
 */
function selectBestCombo(
  combos: Combo[],
  recommendations: EDHRECRecommendation[],
): Combo | null {
  if (combos.length === 0) return null;

  const recNames = new Set(recommendations.map((r) => r.cardName));

  // Score each combo by how many of its cards appear in recommendations
  let bestCombo: Combo | null = null;
  let bestOverlap = -1;

  for (const combo of combos) {
    const overlap = combo.cards.filter((name) => recNames.has(name)).length;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestCombo = combo;
    }
  }

  return bestCombo;
}

/**
 * Collect all non-land DeckEntry items from categorized cards.
 */
function collectNonLandCards(categorized: CategorizedCards): DeckEntry[] {
  return [
    ...categorized.ramp,
    ...categorized.cardDraw,
    ...categorized.removal,
    ...categorized.threats,
  ];
}

/**
 * Build a Deck object from a commander and entries.
 */
function buildDeckObject(commander: Card, entries: DeckEntry[]): Deck {
  return {
    id: crypto.randomUUID(),
    name: `${commander.name} Deck`,
    commander,
    entries,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Infer a CardCategory from a card's type line.
 */
function inferCategory(card: Card): DeckEntry["category"] {
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
