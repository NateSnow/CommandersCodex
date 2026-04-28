/**
 * Distributes non-land cards across functional categories according to a CategoryTemplate.
 *
 * The allocator categorizes each card using the CardCategorizer heuristics, then fills
 * categories in priority order: combo cards first, then fill to minimums, then distribute
 * remaining high-priority cards up to maximums. Cards that don't fit go to unallocated.
 */

import type { Card } from "../models/card.js";
import type { DeckEntry } from "../models/deck.js";
import type {
  CategoryTemplate,
  CategorizedCards,
} from "../models/generation.js";
import { DEFAULT_CATEGORY_TEMPLATE } from "../models/generation.js";
import { categorize } from "./card-categorizer.js";
import type { FunctionalCategory } from "../models/generation.js";

/** Returns the default category template with standard min/max ranges. */
export function getDefaultTemplate(): CategoryTemplate {
  return DEFAULT_CATEGORY_TEMPLATE;
}

/** Map a FunctionalCategory to the corresponding key in CategorizedCards / CategoryTemplate. */
function categoryKey(
  cat: FunctionalCategory,
): "ramp" | "cardDraw" | "removal" | "threats" {
  switch (cat) {
    case "Ramp":
      return "ramp";
    case "Card Draw":
      return "cardDraw";
    case "Removal":
      return "removal";
    case "Threat":
      return "threats";
  }
}

/** Map a FunctionalCategory to a valid CardCategory for DeckEntry. */
function toCardCategory(cat: FunctionalCategory): DeckEntry["category"] {
  switch (cat) {
    case "Ramp":
      return "Ramp";
    case "Card Draw":
      return "Card Draw";
    case "Removal":
      return "Removal";
    case "Threat":
      return "Creature";
  }
}

/** Create a DeckEntry from a Card, using its FunctionalCategory as the deck category. */
function toDeckEntry(card: Card): DeckEntry {
  return {
    card,
    quantity: 1,
    category: toCardCategory(categorize(card)),
  };
}

/**
 * Distribute non-land cards across functional categories.
 *
 * Algorithm:
 * 1. Categorize each card using CardCategorizer
 * 2. Assign combo cards first (they count toward their respective categories)
 * 3. Sort remaining cards by input-array position (earlier = higher priority,
 *    since EDHREC recommendations come sorted by synergy)
 * 4. Fill each category up to its `min` from the sorted pool
 * 5. Distribute remaining high-priority cards to categories that haven't hit `max`
 * 6. Any leftover cards go into `unallocated`
 */
export function allocate(
  cards: Card[],
  template: CategoryTemplate,
  comboCards: Card[],
): CategorizedCards {
  const result: CategorizedCards = {
    ramp: [],
    cardDraw: [],
    removal: [],
    threats: [],
    unallocated: [],
  };

  // Build a set of combo card IDs for fast lookup
  const comboCardIds = new Set(comboCards.map((c) => c.id));

  // Buckets: cards grouped by their functional category, preserving input order
  const buckets: Record<"ramp" | "cardDraw" | "removal" | "threats", Card[]> = {
    ramp: [],
    cardDraw: [],
    removal: [],
    threats: [],
  };

  // Step 1 & 2: Categorize all cards; assign combo cards immediately
  for (const card of cards) {
    const cat = categorize(card);
    const key = categoryKey(cat);

    if (comboCardIds.has(card.id)) {
      // Combo cards go directly into their category
      result[key].push(toDeckEntry(card));
    } else {
      // Non-combo cards go into the bucket for later allocation
      buckets[key].push(card);
    }
  }

  // Step 3: Buckets already preserve input-array order (earlier = higher priority)

  // Step 4: Fill each category up to its min from the sorted pool
  const keys = ["ramp", "cardDraw", "removal", "threats"] as const;
  for (const key of keys) {
    const min = template[key].min;
    const needed = Math.max(0, min - result[key].length);
    const taken = buckets[key].splice(0, needed);
    for (const card of taken) {
      result[key].push(toDeckEntry(card));
    }
  }

  // Step 5: Distribute remaining cards to categories that haven't hit max
  for (const key of keys) {
    const max = template[key].max;
    const remaining = buckets[key].splice(0);
    for (const card of remaining) {
      if (result[key].length < max) {
        result[key].push(toDeckEntry(card));
      } else {
        result.unallocated.push(toDeckEntry(card));
      }
    }
  }

  return result;
}
