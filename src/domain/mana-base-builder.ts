/**
 * Mana base construction for Commander deck generation.
 *
 * Builds the land portion of a deck based on the commander's color identity
 * and the color requirements of the non-land cards. Uses hardcoded lists of
 * well-known multi-color lands to avoid Scryfall rate-limit issues during
 * generation. The ScryfallAdapter parameter is kept for future enhancement.
 */

import type { Card, Color, ColorIdentity } from "../models/card.js";
import type { DeckEntry } from "../models/deck.js";
import type { ColorRequirements } from "../models/generation.js";
import type { ScryfallAdapter } from "../data/scryfall-adapter.js";

// ---------------------------------------------------------------------------
// Constants — well-known lands organized by role
// ---------------------------------------------------------------------------

/** Utility lands that produce any color in the commander's identity. */
const MULTI_COLOR_UTILITY_LANDS: string[] = [
  "Command Tower",
  "Exotic Orchard",
  "City of Brass",
  "Mana Confluence",
  "Reflecting Pool",
];

/** Colorless utility lands suitable for any deck. */
const COLORLESS_UTILITY_LANDS: string[] = [
  "Reliquary Tower",
  "Rogue's Passage",
  "War Room",
  "Myriad Landscape",
  "Ghost Quarter",
];

/** Basic land name for each color. */
const BASIC_LAND_FOR_COLOR: Record<Color, string> = {
  W: "Plains",
  U: "Island",
  B: "Swamp",
  R: "Mountain",
  G: "Forest",
};

/** Well-known dual lands organized by color pair (sorted alphabetically). */
const DUAL_LANDS: Record<string, string[]> = {
  "BG": ["Overgrown Tomb", "Woodland Cemetery", "Blooming Marsh"],
  "BR": ["Blood Crypt", "Dragonskull Summit", "Foreboding Ruins"],
  "BU": ["Watery Grave", "Drowned Catacomb", "Choked Estuary"],
  "BW": ["Godless Shrine", "Isolated Chapel", "Concealed Courtyard"],
  "GR": ["Stomping Ground", "Rootbound Crag", "Game Trail"],
  "GU": ["Breeding Pool", "Hinterland Harbor", "Botanical Sanctum"],
  "GW": ["Temple Garden", "Sunpetal Grove", "Fortified Village"],
  "RU": ["Steam Vents", "Sulfur Falls", "Spirebluff Canal"],
  "RW": ["Sacred Foundry", "Clifftop Retreat", "Inspiring Vantage"],
  "UW": ["Hallowed Fountain", "Glacial Fortress", "Port Town"],
};

// ---------------------------------------------------------------------------
// Mana pip parsing
// ---------------------------------------------------------------------------

/**
 * Extract color pips from a mana cost string like "{2}{W}{U}{U}".
 * Returns a record with counts for each of the five colors.
 */
export function parseManaPips(manaCost: string): Record<Color, number> {
  const pips: Record<Color, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  const matches = manaCost.matchAll(/\{([WUBRG])\}/gi);
  for (const match of matches) {
    const color = match[1].toUpperCase() as Color;
    pips[color] += 1;
  }
  return pips;
}

// ---------------------------------------------------------------------------
// Color requirements calculation
// ---------------------------------------------------------------------------

/**
 * Aggregate pip counts across all non-land cards.
 * Skips cards whose type line contains "Land".
 */
export function calculateColorRequirements(cards: Card[]): ColorRequirements {
  const pipCounts: Record<Color, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  let totalPips = 0;

  for (const card of cards) {
    if (card.typeLine.toLowerCase().includes("land")) continue;

    const pips = parseManaPips(card.manaCost);
    for (const color of Object.keys(pips) as Color[]) {
      pipCounts[color] += pips[color];
      totalPips += pips[color];
    }
  }

  return { pipCounts, totalPips };
}

// ---------------------------------------------------------------------------
// Mana base builder
// ---------------------------------------------------------------------------

/**
 * Build the land portion of a Commander deck.
 *
 * Strategy varies by commander color count:
 * - Multi-color (2+ colors): utility lands → dual lands → basics
 * - Mono-color: mostly basics + a few colorless utility lands
 * - Colorless: Wastes + colorless utility lands
 *
 * The scryfallAdapter parameter is accepted for future use but the current
 * implementation relies on hardcoded land lists.
 */
export async function buildManaBase(
  colorIdentity: ColorIdentity,
  requirements: ColorRequirements,
  landCount: number,
  _scryfallAdapter: ScryfallAdapter,
): Promise<DeckEntry[]> {
  if (colorIdentity.length === 0) {
    return buildColorlessManaBase(landCount);
  }

  if (colorIdentity.length === 1) {
    return buildMonoColorManaBase(colorIdentity[0], landCount);
  }

  return buildMultiColorManaBase(colorIdentity, requirements, landCount);
}

// ---------------------------------------------------------------------------
// Colorless mana base
// ---------------------------------------------------------------------------

function buildColorlessManaBase(landCount: number): DeckEntry[] {
  const entries: DeckEntry[] = [];
  let remaining = landCount;

  // Add colorless utility lands
  for (const landName of COLORLESS_UTILITY_LANDS) {
    if (remaining <= 0) break;
    entries.push(makeLandEntry(landName));
    remaining--;
  }

  // Fill the rest with Wastes
  if (remaining > 0) {
    entries.push(makeBasicLandEntry("Wastes", remaining));
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Mono-color mana base
// ---------------------------------------------------------------------------

function buildMonoColorManaBase(color: Color, landCount: number): DeckEntry[] {
  const entries: DeckEntry[] = [];
  let remaining = landCount;

  // Add a few colorless utility lands (up to 3)
  const utilityCount = Math.min(3, remaining);
  for (let i = 0; i < utilityCount; i++) {
    if (i < COLORLESS_UTILITY_LANDS.length) {
      entries.push(makeLandEntry(COLORLESS_UTILITY_LANDS[i]));
      remaining--;
    }
  }

  // Fill the rest with basic lands of that color
  const basicName = BASIC_LAND_FOR_COLOR[color];
  if (remaining > 0) {
    entries.push(makeBasicLandEntry(basicName, remaining));
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Multi-color mana base
// ---------------------------------------------------------------------------

function buildMultiColorManaBase(
  colorIdentity: ColorIdentity,
  requirements: ColorRequirements,
  landCount: number,
): DeckEntry[] {
  const entries: DeckEntry[] = [];
  let remaining = landCount;

  // 1. Add multi-color utility lands
  for (const landName of MULTI_COLOR_UTILITY_LANDS) {
    if (remaining <= 0) break;
    entries.push(makeLandEntry(landName));
    remaining--;
  }

  // 2. Add dual lands for each color pair in the commander's identity
  const colorPairs = getColorPairs(colorIdentity);
  for (const pair of colorPairs) {
    const duals = DUAL_LANDS[pair] ?? [];
    for (const dualName of duals) {
      if (remaining <= 0) break;
      entries.push(makeLandEntry(dualName));
      remaining--;
    }
  }

  // 3. Fill remaining slots with basic lands proportional to pip distribution,
  //    enforcing ≥ 20% representation per color.
  if (remaining > 0) {
    const basicAllocation = allocateBasicLands(colorIdentity, requirements, remaining);
    for (const color of colorIdentity) {
      const count = basicAllocation[color];
      if (count > 0) {
        entries.push(makeBasicLandEntry(BASIC_LAND_FOR_COLOR[color], count));
      }
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Basic land allocation with minimum 20% guarantee
// ---------------------------------------------------------------------------

/**
 * Allocate basic lands proportionally to pip counts, ensuring every color
 * in the commander's identity gets at least 20% of the basic land slots.
 */
function allocateBasicLands(
  colorIdentity: ColorIdentity,
  requirements: ColorRequirements,
  totalBasics: number,
): Record<Color, number> {
  const allocation: Record<Color, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  const numColors = colorIdentity.length;

  if (numColors === 0 || totalBasics <= 0) return allocation;

  const minPerColor = Math.max(1, Math.floor(totalBasics * 0.2));

  // Start by giving each color its minimum
  let assigned = 0;
  for (const color of colorIdentity) {
    const amount = Math.min(minPerColor, totalBasics - assigned);
    allocation[color] = amount;
    assigned += amount;
  }

  // Distribute remaining slots proportionally to pip counts
  let remainingSlots = totalBasics - assigned;
  if (remainingSlots > 0) {
    // Only consider pips for colors in the identity
    const identityPips: Record<Color, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    let identityTotalPips = 0;
    for (const color of colorIdentity) {
      identityPips[color] = requirements.pipCounts[color];
      identityTotalPips += requirements.pipCounts[color];
    }

    if (identityTotalPips > 0) {
      // Proportional allocation
      const proportional: Record<Color, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
      let proportionalTotal = 0;
      for (const color of colorIdentity) {
        const share = (identityPips[color] / identityTotalPips) * remainingSlots;
        proportional[color] = Math.floor(share);
        proportionalTotal += proportional[color];
      }

      // Assign proportional amounts
      for (const color of colorIdentity) {
        allocation[color] += proportional[color];
      }
      remainingSlots -= proportionalTotal;

      // Distribute rounding remainders to the color with the most pips
      if (remainingSlots > 0) {
        const sorted = [...colorIdentity].sort(
          (a, b) => requirements.pipCounts[b] - requirements.pipCounts[a],
        );
        for (let i = 0; remainingSlots > 0; i++) {
          allocation[sorted[i % sorted.length]] += 1;
          remainingSlots--;
        }
      }
    } else {
      // No pip data — distribute evenly
      for (let i = 0; remainingSlots > 0; i++) {
        allocation[colorIdentity[i % numColors]] += 1;
        remainingSlots--;
      }
    }
  }

  return allocation;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get sorted color pair keys for looking up dual lands. */
function getColorPairs(colorIdentity: ColorIdentity): string[] {
  const pairs: string[] = [];
  const sorted = [...colorIdentity].sort();
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      pairs.push(`${sorted[i]}${sorted[j]}`);
    }
  }
  return pairs;
}

/** Create a singleton land DeckEntry (non-basic). */
function makeLandEntry(name: string): DeckEntry {
  return {
    card: makeLandCard(name, false),
    quantity: 1,
    category: "Land",
  };
}

/** Create a basic land DeckEntry with the given quantity. */
function makeBasicLandEntry(name: string, quantity: number): DeckEntry {
  return {
    card: makeLandCard(name, true),
    quantity,
    category: "Land",
  };
}

/** Create a minimal Card object representing a land. */
function makeLandCard(name: string, isBasic: boolean): Card {
  const typeLine = isBasic ? `Basic Land — ${name}` : "Land";
  return {
    id: `land-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
    name,
    manaCost: "",
    cmc: 0,
    typeLine,
    oracleText: "",
    colors: [],
    colorIdentity: [],
    power: undefined,
    toughness: undefined,
    loyalty: undefined,
    imageUris: undefined,
    cardFaces: undefined,
    legalities: { commander: "legal" },
    keywords: [],
    isLegendary: false,
    isCreature: false,
    canBeCommander: false,
  };
}
