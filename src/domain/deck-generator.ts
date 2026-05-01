/**
 * Top-level orchestrator for automatic Commander deck generation.
 *
 * Coordinates the full generation pipeline: fetching EDHREC recommendations,
 * running archetype-specific Scryfall queries, selecting combos (optional),
 * allocating card categories, building the mana base, and assembling the
 * final 100-card deck.
 */

import type { Card, ColorIdentity } from "../models/card.js";
import type { Deck, DeckEntry } from "../models/deck.js";
import type {
  Archetype,
  BracketLevel,
  CategoryTemplate,
  CategorizedCards,
  GenerationOptions,
  GenerationResult,
  GenerationWarning,
} from "../models/generation.js";
import type { Combo, EDHRECRecommendation } from "../models/recommendation.js";
import type { ScryfallAdapter } from "../data/scryfall-adapter.js";
import type { EDHRECAdapter } from "../data/edhrec-adapter.js";
import type { CommanderSpellbookAdapter } from "../data/commander-spellbook-adapter.js";
import { ARCHETYPE_TEMPLATES } from "../models/generation.js";
import { allocate } from "./category-allocator.js";
import { buildManaBase, calculateColorRequirements } from "./mana-base-builder.js";
import { validate } from "./deck-validator.js";
import { isSubsetOfColorIdentity } from "./color-identity.js";
import { isBanned } from "./banned-list.js";
import { dispatch } from "../utils/event-bus.js";
import { buildArchetypeQueries } from "./archetype-queries.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_LAND_COUNT = 37;
const SYNERGY_SHUFFLE_TOLERANCE = 0.05;

// ---------------------------------------------------------------------------
// DeckGenerator class
// ---------------------------------------------------------------------------

export class DeckGenerator {
  private scryfallAdapter: ScryfallAdapter;
  private edhrecAdapter: EDHRECAdapter;
  private commanderSpellbookAdapter: CommanderSpellbookAdapter;

  constructor(deps: {
    scryfallAdapter: ScryfallAdapter;
    edhrecAdapter: EDHRECAdapter;
    commanderSpellbookAdapter: CommanderSpellbookAdapter;
  }) {
    this.scryfallAdapter = deps.scryfallAdapter;
    this.edhrecAdapter = deps.edhrecAdapter;
    this.commanderSpellbookAdapter = deps.commanderSpellbookAdapter;
  }

  // -----------------------------------------------------------------------
  // generate — full pipeline
  // -----------------------------------------------------------------------

  async generate(options: GenerationOptions): Promise<GenerationResult> {
    const { commander, archetype, bracketLevel, includeInfiniteCombos } = options;
    const landCount = options.landCount ?? DEFAULT_LAND_COUNT;
    const template = options.categoryTemplate ?? ARCHETYPE_TEMPLATES[archetype];
    const warnings: GenerationWarning[] = [];
    const fallbacksUsed: string[] = [];

    try {
      // --- Phase 1: Fetch EDHREC recommendations (15%) ---
      dispatch("generation-progress", {
        phase: "Fetching recommendations",
        percentComplete: 15,
      });

      let recommendations: EDHRECRecommendation[] = [];
      try {
        recommendations =
          await this.edhrecAdapter.getCommanderRecommendations(commander.name);
        if (recommendations.length === 0) {
          throw new Error("Empty EDHREC response");
        }
      } catch {
        warnings.push({
          source: "edhrec",
          message: "EDHREC recommendations unavailable. Using Scryfall search only.",
        });
        fallbacksUsed.push("edhrec-unavailable");
      }

      // --- Phase 2: Fetch combos if requested (30%) ---
      let combos: Combo[] = [];
      let comboCards: Card[] = [];
      const combosIncluded: Combo[] = [];

      if (includeInfiniteCombos) {
        dispatch("generation-progress", {
          phase: "Finding combos",
          percentComplete: 30,
        });

        try {
          combos = await this.commanderSpellbookAdapter.searchCombos(
            commander.colorIdentity,
          );

          if (combos.length > 0) {
            const bestCombo = selectBestCombo(combos, recommendations);
            if (bestCombo) {
              const resolved = await this.resolveCardNames(bestCombo.cards);
              const valid = resolved.filter(
                (c) =>
                  isSubsetOfColorIdentity(c.colorIdentity, commander.colorIdentity) &&
                  !isBanned(c.name),
              );
              if (valid.length === bestCombo.cards.length) {
                comboCards = valid;
                combosIncluded.push(bestCombo);
              }
            }
          }
        } catch {
          warnings.push({
            source: "commander-spellbook",
            message: "Commander Spellbook unavailable. Skipping combo inclusion.",
          });
          fallbacksUsed.push("no-combos-found");
        }
      } else {
        dispatch("generation-progress", {
          phase: "Skipping combos (not requested)",
          percentComplete: 30,
        });
      }

      // --- Phase 3: Run archetype-specific Scryfall queries (50%) ---
      dispatch("generation-progress", {
        phase: `Building ${archetype} card pool`,
        percentComplete: 50,
      });

      const archetypeQueries = buildArchetypeQueries(commander, archetype, bracketLevel);
      const cardPool: Card[] = [];
      const seenNames = new Set<string>();
      seenNames.add(commander.name);

      // Add combo cards to the seen set so they don't get duplicated
      for (const cc of comboCards) {
        seenNames.add(cc.name);
      }

      // Resolve EDHREC recommendations first (they have synergy data)
      if (recommendations.length > 0) {
        const shuffled = shuffleSimilarSynergyCards(recommendations);
        const resolved = await this.resolveRecommendations(
          shuffled,
          commander.colorIdentity,
        );
        for (const card of resolved) {
          if (!seenNames.has(card.name)) {
            cardPool.push(card);
            seenNames.add(card.name);
          }
        }
      }

      // Run archetype queries to fill gaps
      for (const aq of archetypeQueries) {
        try {
          const result = await this.scryfallAdapter.searchRaw(aq.query);

          let added = 0;
          for (const card of result.cards) {
            if (added >= aq.targetCount) break;
            if (seenNames.has(card.name)) continue;
            if (isBanned(card.name)) continue;
            if (!isSubsetOfColorIdentity(card.colorIdentity, commander.colorIdentity)) continue;
            if (card.typeLine.toLowerCase().includes("land")) continue;

            cardPool.push(card);
            seenNames.add(card.name);
            added++;
          }
        } catch {
          warnings.push({
            source: "scryfall",
            message: `Scryfall query failed for "${aq.label}". Some cards may be missing.`,
          });
        }
      }

      // --- Phase 4: Allocate categories (65%) ---
      dispatch("generation-progress", {
        phase: "Allocating card categories",
        percentComplete: 65,
      });

      // Cap the card pool — we only need ~62 non-land cards (99 - landCount)
      const targetNonCommander = 99;
      const nonLandTarget = targetNonCommander - landCount;
      const cappedPool = cardPool.slice(0, Math.max(nonLandTarget + 20, 80));

      const categorized = allocate(cappedPool, template, comboCards);

      // --- Phase 5: Build mana base (80%) ---
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

      // --- Phase 6: Assemble and fill (90%) ---
      dispatch("generation-progress", {
        phase: "Assembling deck",
        percentComplete: 90,
      });

      let allEntries = [...nonLandCards, ...manaBase];

      /** Count total cards respecting quantity on each entry. */
      const totalQty = (entries: DeckEntry[]): number =>
        entries.reduce((sum, e) => sum + e.quantity, 0);

      // Fill remaining slots from unallocated cards
      if (totalQty(allEntries) < targetNonCommander) {
        const existingNames = new Set(allEntries.map((e) => e.card.name));
        existingNames.add(commander.name);

        const unallocated = categorized.unallocated.filter(
          (e) => !existingNames.has(e.card.name),
        );
        for (const entry of unallocated) {
          if (totalQty(allEntries) >= targetNonCommander) break;
          allEntries.push(entry);
          existingNames.add(entry.card.name);
        }

        // If still short, do a generic Scryfall fill
        if (totalQty(allEntries) < targetNonCommander) {
          try {
            const remaining = targetNonCommander - totalQty(allEntries);
            const fillCards = await this.searchFillCards(
              commander.colorIdentity,
              existingNames,
              remaining,
            );
            allEntries.push(...fillCards);
          } catch {
            dispatch("generation-error", {
              message: "Card data is temporarily unavailable. Please try again later.",
            });
            throw new Error("Card data is temporarily unavailable.");
          }
        }
      }

      // Trim to exactly 99 total cards (respecting quantity)
      while (totalQty(allEntries) > targetNonCommander) {
        // Remove non-land singleton entries from the end first
        let removed = false;
        for (let i = allEntries.length - 1; i >= 0; i--) {
          if (allEntries[i].category !== "Land" && allEntries[i].quantity === 1) {
            allEntries.splice(i, 1);
            removed = true;
            break;
          }
        }
        // If only lands remain over budget, reduce a basic land quantity
        if (!removed) {
          for (let i = allEntries.length - 1; i >= 0; i--) {
            if (allEntries[i].quantity > 1) {
              allEntries[i].quantity--;
              if (allEntries[i].quantity === 0) allEntries.splice(i, 1);
              break;
            }
          }
        }
      }

      if (totalQty(allEntries) < targetNonCommander) {
        const errorMsg = `Could not assemble a complete deck for ${commander.name}. Try a different commander or archetype.`;
        dispatch("generation-error", { message: errorMsg });
        return {
          deck: buildDeckObject(commander, allEntries),
          combosIncluded,
          warnings,
          fallbacksUsed: [...fallbacksUsed, "incomplete-deck"],
          archetype,
          bracketLevel,
        };
      }

      // --- Phase 7: Finalize (95%) ---
      dispatch("generation-progress", {
        phase: "Validating deck",
        percentComplete: 95,
      });

      const deck = buildDeckObject(commander, allEntries);
      const validationResult = validate(deck);

      if (!validationResult.isLegal) {
        console.error("Generated deck failed validation:", validationResult.violations);
      }

      const result: GenerationResult = {
        deck,
        combosIncluded,
        warnings,
        fallbacksUsed,
        archetype,
        bracketLevel,
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
  // Private helpers
  // -----------------------------------------------------------------------

  private async resolveRecommendations(
    recommendations: EDHRECRecommendation[],
    commanderColors: ColorIdentity,
  ): Promise<Card[]> {
    const idsToFetch = recommendations
      .filter((r) => r.scryfallId)
      .map((r) => r.scryfallId!);

    let cards: Card[] = [];

    if (idsToFetch.length > 0) {
      cards = await this.scryfallAdapter.fetchCardCollection(idsToFetch);
    }

    const resolvedNames = new Set(cards.map((c) => c.name));
    const unresolvedRecs = recommendations.filter(
      (r) => !r.scryfallId && !resolvedNames.has(r.cardName),
    );

    if (unresolvedRecs.length > 0) {
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

    return cards.filter(
      (card) =>
        !isBanned(card.name) &&
        isSubsetOfColorIdentity(card.colorIdentity, commanderColors) &&
        !card.typeLine.toLowerCase().includes("land"),
    );
  }

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

function shuffleSimilarSynergyCards(
  recommendations: EDHRECRecommendation[],
): EDHRECRecommendation[] {
  if (recommendations.length === 0) return [];

  const sorted = [...recommendations].sort(
    (a, b) => b.synergyScore - a.synergyScore,
  );

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

function selectBestCombo(
  combos: Combo[],
  recommendations: EDHRECRecommendation[],
): Combo | null {
  if (combos.length === 0) return null;

  const recNames = new Set(recommendations.map((r) => r.cardName));
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

function collectNonLandCards(categorized: CategorizedCards): DeckEntry[] {
  return [
    ...categorized.ramp,
    ...categorized.cardDraw,
    ...categorized.removal,
    ...categorized.threats,
  ];
}

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
