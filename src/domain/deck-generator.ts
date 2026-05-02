/**
 * Deck generation pipeline — EDHREC-first approach.
 *
 * Strategy:
 * 1. Fetch the EDHREC average deck for the commander (aggregated from
 *    thousands of real decks). This gives us a complete 100-card list
 *    with Scryfall IDs.
 * 2. Resolve those IDs to full Card objects via Scryfall batch API.
 * 3. Fetch EDHREC commander page recommendations for additional synergy
 *    cards beyond the average deck.
 * 4. Optionally fetch combos from Commander Spellbook.
 * 5. Build the card pool from average deck + recommendations, shuffle
 *    for variety, then allocate into categories and assemble.
 * 6. Fall back to archetype Scryfall queries only if EDHREC fails.
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
import type { EDHRECAdapter, EDHRECAverageDeck } from "../data/edhrec-adapter.js";
import type { CommanderSpellbookAdapter } from "../data/commander-spellbook-adapter.js";
import { ARCHETYPE_TEMPLATES } from "../models/generation.js";
import { allocate } from "./category-allocator.js";
import { buildManaBase, calculateColorRequirements } from "./mana-base-builder.js";
import { validate } from "./deck-validator.js";
import { isSubsetOfColorIdentity } from "./color-identity.js";
import { isBanned } from "./banned-list.js";
import { dispatch } from "../utils/event-bus.js";
import { buildArchetypeQueries } from "./archetype-queries.js";

const DEFAULT_LAND_COUNT = 37;

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

  async generate(options: GenerationOptions): Promise<GenerationResult> {
    const { commander, archetype, bracketLevel, includeInfiniteCombos } = options;
    const landCount = options.landCount ?? DEFAULT_LAND_COUNT;
    const template = options.categoryTemplate ?? ARCHETYPE_TEMPLATES[archetype];
    const warnings: GenerationWarning[] = [];
    const fallbacksUsed: string[] = [];
    const targetNonCommander = 99;

    try {
      // ---- Phase 1: Fetch EDHREC average deck (20%) ----
      dispatch("generation-progress", { phase: "Fetching average deck from EDHREC", percentComplete: 20 });

      let avgDeck: EDHRECAverageDeck | null = null;
      try {
        avgDeck = await this.edhrecAdapter.getAverageDeck(commander.name);
      } catch {
        // Will fall back to recommendations + Scryfall
      }

      // ---- Phase 2: Fetch EDHREC recommendations (30%) ----
      dispatch("generation-progress", { phase: "Gathering synergy cards", percentComplete: 30 });

      let recommendations: EDHRECRecommendation[] = [];
      try {
        recommendations = await this.edhrecAdapter.getCommanderRecommendations(commander.name);
      } catch {
        // Non-fatal
      }

      if (!avgDeck && recommendations.length === 0) {
        warnings.push({ source: "edhrec", message: "EDHREC data unavailable. Using Scryfall search as fallback." });
        fallbacksUsed.push("edhrec-unavailable");
      }

      // ---- Phase 3: Fetch combos if requested (40%) ----
      let comboCards: Card[] = [];
      const combosIncluded: Combo[] = [];

      if (includeInfiniteCombos) {
        dispatch("generation-progress", { phase: "Finding combos", percentComplete: 40 });
        try {
          const combos = await this.commanderSpellbookAdapter.searchCombos(commander.colorIdentity);
          if (combos.length > 0) {
            const bestCombo = this.selectBestCombo(combos, recommendations);
            if (bestCombo) {
              const resolved = await this.resolveCardNames(bestCombo.cards);
              const valid = resolved.filter(
                (c) => isSubsetOfColorIdentity(c.colorIdentity, commander.colorIdentity) && !isBanned(c.name),
              );
              if (valid.length === bestCombo.cards.length) {
                comboCards = valid;
                combosIncluded.push(bestCombo);
              }
            }
          }
        } catch {
          warnings.push({ source: "commander-spellbook", message: "Commander Spellbook unavailable. Skipping combos." });
          fallbacksUsed.push("no-combos-found");
        }
      } else {
        dispatch("generation-progress", { phase: "Skipping combos", percentComplete: 40 });
      }

      // ---- Phase 4: Build card pool (55%) ----
      dispatch("generation-progress", { phase: "Building card pool", percentComplete: 55 });

      const nonLandPool: Card[] = [];
      const landPool: Card[] = [];
      const seenNames = new Set<string>();
      seenNames.add(commander.name);
      for (const cc of comboCards) seenNames.add(cc.name);

      // 4a: Resolve EDHREC average deck cards via Scryfall batch
      if (avgDeck && avgDeck.cards.length > 0) {
        const nonLandIds = avgDeck.cards
          .filter((c) => c.category !== "lands" && c.category !== "basics")
          .map((c) => c.scryfallId);
        const landIds = avgDeck.cards
          .filter((c) => c.category === "lands" || c.category === "basics")
          .map((c) => c.scryfallId);

        if (nonLandIds.length > 0) {
          try {
            const resolved = await this.scryfallAdapter.fetchCardCollection(nonLandIds);
            for (const card of resolved) {
              if (!seenNames.has(card.name) && !isBanned(card.name)) {
                nonLandPool.push(card);
                seenNames.add(card.name);
              }
            }
          } catch {
            warnings.push({ source: "scryfall", message: "Could not resolve some average deck cards." });
          }
        }

        if (landIds.length > 0) {
          try {
            const resolved = await this.scryfallAdapter.fetchCardCollection(landIds);
            for (const card of resolved) {
              if (!seenNames.has(card.name)) {
                landPool.push(card);
                seenNames.add(card.name);
              }
            }
          } catch {
            // Non-fatal, we have hardcoded mana base fallback
          }
        }
      }

      // 4b: Add EDHREC recommendation cards not already in the pool
      if (recommendations.length > 0) {
        const recIds = recommendations
          .filter((r) => r.scryfallId && !seenNames.has(r.cardName))
          .map((r) => r.scryfallId!);

        // Also resolve by name for recs without IDs
        const recNames = recommendations
          .filter((r) => !r.scryfallId && !seenNames.has(r.cardName))
          .slice(0, 30);

        if (recIds.length > 0) {
          try {
            const resolved = await this.scryfallAdapter.fetchCardCollection(recIds);
            for (const card of resolved) {
              if (!seenNames.has(card.name) && !isBanned(card.name) &&
                  isSubsetOfColorIdentity(card.colorIdentity, commander.colorIdentity) &&
                  !card.typeLine.toLowerCase().includes("land")) {
                nonLandPool.push(card);
                seenNames.add(card.name);
              }
            }
          } catch { /* non-fatal */ }
        }

        for (const rec of recNames) {
          try {
            const result = await this.scryfallAdapter.searchCards(`!"${rec.cardName}"`, commander.colorIdentity);
            if (result.cards.length > 0) {
              const card = result.cards[0];
              if (!seenNames.has(card.name) && !isBanned(card.name) &&
                  !card.typeLine.toLowerCase().includes("land")) {
                nonLandPool.push(card);
                seenNames.add(card.name);
              }
            }
          } catch { /* skip */ }
        }
      }

      // 4c: If EDHREC gave us very few cards, fall back to archetype Scryfall queries
      const nonLandTarget = targetNonCommander - landCount;
      if (nonLandPool.length < nonLandTarget * 0.6) {
        dispatch("generation-progress", { phase: "Supplementing with Scryfall search", percentComplete: 60 });
        const archetypeQueries = buildArchetypeQueries(commander, archetype, bracketLevel);
        for (const aq of archetypeQueries) {
          try {
            const result = await this.scryfallAdapter.searchRaw(aq.query);
            let added = 0;
            for (const card of result.cards) {
              if (added >= aq.targetCount) break;
              if (seenNames.has(card.name) || isBanned(card.name)) continue;
              if (!isSubsetOfColorIdentity(card.colorIdentity, commander.colorIdentity)) continue;
              if (card.typeLine.toLowerCase().includes("land")) continue;
              nonLandPool.push(card);
              seenNames.add(card.name);
              added++;
            }
          } catch {
            warnings.push({ source: "scryfall", message: `Query failed for "${aq.label}".` });
          }
        }
      }

      // ---- Phase 5: Shuffle and allocate (70%) ----
      dispatch("generation-progress", { phase: "Allocating card categories", percentComplete: 70 });

      // Shuffle the pool for variety: keep top 40% stable, shuffle rest
      const keepTop = Math.floor(nonLandPool.length * 0.4);
      const topCards = nonLandPool.slice(0, keepTop);
      const restCards = nonLandPool.slice(keepTop);
      for (let i = restCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [restCards[i], restCards[j]] = [restCards[j], restCards[i]];
      }
      const shuffledPool = [...topCards, ...restCards];

      // Cap pool size
      const cappedPool = shuffledPool.slice(0, Math.max(nonLandTarget + 20, 80));
      const categorized = allocate(cappedPool, template, comboCards);

      // ---- Phase 6: Build mana base (80%) ----
      dispatch("generation-progress", { phase: "Building mana base", percentComplete: 80 });

      const nonLandCards = collectNonLandCards(categorized);
      const colorRequirements = calculateColorRequirements(nonLandCards.map((e) => e.card));

      // Use EDHREC lands if we have them, otherwise fall back to hardcoded
      let manaBase: DeckEntry[];
      if (landPool.length >= 10) {
        // Build mana base from EDHREC's land recommendations
        manaBase = buildManaBaseFromPool(landPool, landCount, commander.colorIdentity);
      } else {
        manaBase = await buildManaBase(commander.colorIdentity, colorRequirements, landCount, this.scryfallAdapter);
      }

      // ---- Phase 7: Assemble (90%) ----
      dispatch("generation-progress", { phase: "Assembling deck", percentComplete: 90 });

      let allEntries = [...nonLandCards, ...manaBase];

      const totalQty = (entries: DeckEntry[]): number =>
        entries.reduce((sum, e) => sum + e.quantity, 0);

      // Fill from unallocated
      if (totalQty(allEntries) < targetNonCommander) {
        const existingNames = new Set(allEntries.map((e) => e.card.name));
        existingNames.add(commander.name);
        for (const entry of categorized.unallocated) {
          if (totalQty(allEntries) >= targetNonCommander) break;
          if (!existingNames.has(entry.card.name)) {
            allEntries.push(entry);
            existingNames.add(entry.card.name);
          }
        }

        // Last resort: Scryfall fill
        if (totalQty(allEntries) < targetNonCommander) {
          try {
            const remaining = targetNonCommander - totalQty(allEntries);
            const fillCards = await this.searchFillCards(commander.colorIdentity, existingNames, remaining);
            allEntries.push(...fillCards);
          } catch {
            dispatch("generation-error", { message: "Card data temporarily unavailable." });
            throw new Error("Card data temporarily unavailable.");
          }
        }
      }

      // Trim to exactly 99
      while (totalQty(allEntries) > targetNonCommander) {
        let removed = false;
        for (let i = allEntries.length - 1; i >= 0; i--) {
          if (allEntries[i].category !== "Land" && allEntries[i].quantity === 1) {
            allEntries.splice(i, 1);
            removed = true;
            break;
          }
        }
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
        dispatch("generation-error", { message: `Could not assemble a complete deck for ${commander.name}.` });
        return {
          deck: buildDeckObject(commander, allEntries), combosIncluded, warnings,
          fallbacksUsed: [...fallbacksUsed, "incomplete-deck"], archetype, bracketLevel,
        };
      }

      // ---- Phase 8: Validate (95%) ----
      dispatch("generation-progress", { phase: "Validating deck", percentComplete: 95 });

      const deck = buildDeckObject(commander, allEntries);
      const validationResult = validate(deck);
      if (!validationResult.isLegal) {
        console.error("Validation failed:", validationResult.violations);
      }

      const result: GenerationResult = {
        deck, combosIncluded, warnings, fallbacksUsed, archetype, bracketLevel,
      };

      dispatch("generation-complete", { result });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unexpected error occurred.";
      dispatch("generation-error", { message });
      throw error;
    }
  }

  // ---- Helpers ----

  private selectBestCombo(combos: Combo[], recommendations: EDHRECRecommendation[]): Combo | null {
    if (combos.length === 0) return null;
    const recNames = new Set(recommendations.map((r) => r.cardName));
    let best: Combo | null = null;
    let bestOverlap = -1;
    for (const combo of combos) {
      const overlap = combo.cards.filter((n) => recNames.has(n)).length;
      if (overlap > bestOverlap) { bestOverlap = overlap; best = combo; }
    }
    return best;
  }

  private async resolveCardNames(cardNames: string[]): Promise<Card[]> {
    const resolved: Card[] = [];
    for (const name of cardNames) {
      try {
        const result = await this.scryfallAdapter.searchCards(`!"${name}"`, []);
        if (result.cards.length > 0) resolved.push(result.cards[0]);
      } catch { /* skip */ }
    }
    return resolved;
  }

  private async searchFillCards(
    colorIdentity: ColorIdentity, existingNames: Set<string>, count: number,
  ): Promise<DeckEntry[]> {
    const ci = colorIdentity.length > 0
      ? `id<=${colorIdentity.map((c) => c.toLowerCase()).join("")}`
      : "id<=c";
    const result = await this.scryfallAdapter.searchRaw(`f:commander ${ci} -t:land`);
    const entries: DeckEntry[] = [];
    for (const card of result.cards) {
      if (entries.length >= count) break;
      if (existingNames.has(card.name) || isBanned(card.name)) continue;
      if (!isSubsetOfColorIdentity(card.colorIdentity, colorIdentity)) continue;
      if (card.typeLine.toLowerCase().includes("land")) continue;
      entries.push({ card, quantity: 1, category: inferCategory(card) });
      existingNames.add(card.name);
    }
    return entries;
  }
}

// ---- Pure helpers ----

function collectNonLandCards(categorized: CategorizedCards): DeckEntry[] {
  return [...categorized.ramp, ...categorized.cardDraw, ...categorized.removal, ...categorized.threats];
}

function buildDeckObject(commander: Card, entries: DeckEntry[]): Deck {
  return {
    id: crypto.randomUUID(),
    name: `${commander.name} Deck`,
    commander, entries,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function inferCategory(card: Card): DeckEntry["category"] {
  const t = card.typeLine.toLowerCase();
  if (t.includes("land")) return "Land";
  if (t.includes("planeswalker")) return "Planeswalker";
  if (t.includes("creature")) return "Creature";
  if (t.includes("instant")) return "Instant";
  if (t.includes("sorcery")) return "Sorcery";
  if (t.includes("artifact")) return "Artifact";
  if (t.includes("enchantment")) return "Enchantment";
  return "Custom";
}

/**
 * Build a mana base from EDHREC's recommended lands.
 * Uses the actual lands from the average deck, supplemented with
 * basics to reach the target land count.
 */
function buildManaBaseFromPool(
  landPool: Card[],
  landCount: number,
  colorIdentity: ColorIdentity,
): DeckEntry[] {
  const entries: DeckEntry[] = [];
  let remaining = landCount;
  const usedNames = new Set<string>();

  // Basic land names
  const BASICS = new Set(["Plains", "Island", "Swamp", "Mountain", "Forest", "Wastes"]);
  const BASIC_FOR_COLOR: Record<string, string> = { W: "Plains", U: "Island", B: "Swamp", R: "Mountain", G: "Forest" };

  // Add non-basic lands from the pool first
  for (const land of landPool) {
    if (remaining <= 0) break;
    if (BASICS.has(land.name)) continue; // Handle basics separately
    if (usedNames.has(land.name)) continue;
    entries.push({ card: land, quantity: 1, category: "Land" });
    usedNames.add(land.name);
    remaining--;
  }

  // Fill remaining with basics proportional to color identity
  if (remaining > 0 && colorIdentity.length > 0) {
    const perColor = Math.floor(remaining / colorIdentity.length);
    let leftover = remaining - perColor * colorIdentity.length;
    for (const color of colorIdentity) {
      const basicName = BASIC_FOR_COLOR[color];
      if (!basicName) continue;
      const qty = perColor + (leftover > 0 ? 1 : 0);
      if (leftover > 0) leftover--;
      if (qty > 0) {
        entries.push({
          card: makeLandCard(basicName, true),
          quantity: qty,
          category: "Land",
        });
      }
    }
  } else if (remaining > 0) {
    entries.push({ card: makeLandCard("Wastes", true), quantity: remaining, category: "Land" });
  }

  return entries;
}

function makeLandCard(name: string, isBasic: boolean): Card {
  return {
    id: `land-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
    name, manaCost: "", cmc: 0,
    typeLine: isBasic ? `Basic Land — ${name}` : "Land",
    oracleText: "", colors: [], colorIdentity: [],
    legalities: { commander: "legal" }, keywords: [],
    isLegendary: false, isCreature: false, canBeCommander: false,
  };
}
