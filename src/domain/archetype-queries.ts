/**
 * Archetype-aware Scryfall query builder.
 *
 * Translates archetype + bracket level into targeted Scryfall search
 * queries that bias card selection toward the desired strategy.
 */

import type { Card, ColorIdentity } from "../models/card.js";
import type { Archetype, BracketLevel } from "../models/generation.js";

/** A single Scryfall query with a label describing what it fetches. */
export interface ArchetypeQuery {
  label: string;
  query: string;
  /** How many cards to try to pull from this query bucket. */
  targetCount: number;
}

/**
 * Detect the most likely creature type from a commander's type line.
 *
 * Strips "Legendary Creature — " prefix and returns the first subtype.
 * Falls back to the full subtype string if parsing fails.
 */
export function detectCreatureType(commander: Card): string | null {
  const typeLine = commander.typeLine;
  const dashIndex = typeLine.indexOf("—");
  if (dashIndex === -1) return null;

  const subtypes = typeLine
    .slice(dashIndex + 1)
    .trim()
    .split(/\s+/);

  // Common non-creature subtypes to skip
  const skip = new Set(["Aura", "Equipment", "Vehicle", "Saga", "God"]);

  for (const subtype of subtypes) {
    if (!skip.has(subtype) && subtype.length > 0) {
      return subtype;
    }
  }

  return subtypes[0] || null;
}

/**
 * Build the color identity filter fragment for Scryfall queries.
 */
function colorFilter(colorIdentity: ColorIdentity): string {
  if (colorIdentity.length === 0) return "id<=c";
  return `id<=${colorIdentity.map((c) => c.toLowerCase()).join("")}`;
}

/**
 * Build a CMC constraint based on bracket level.
 *
 * Lower brackets favor cheaper curves; higher brackets allow more expensive cards.
 */
function cmcCeiling(bracket: BracketLevel): string {
  switch (bracket) {
    case 1: return "cmc<=5";
    case 2: return "cmc<=6";
    case 3: return "cmc<=7";
    case 4: return ""; // No ceiling for competitive
  }
}

/**
 * Generate the set of Scryfall queries for a given archetype, commander,
 * and bracket level. Each query targets a specific slice of the deck.
 */
export function buildArchetypeQueries(
  commander: Card,
  archetype: Archetype,
  bracket: BracketLevel,
): ArchetypeQuery[] {
  const ci = colorFilter(commander.colorIdentity);
  const cmc = cmcCeiling(bracket);
  const cmcFilter = cmc ? ` ${cmc}` : "";
  const base = `f:commander ${ci}`;

  switch (archetype) {
    case "balanced":
      return [
        { label: "Creatures",     query: `${base} t:creature${cmcFilter}`,     targetCount: 25 },
        { label: "Ramp",          query: `${base} (o:"add {" OR o:"search your library for a" t:land)${cmcFilter}`, targetCount: 10 },
        { label: "Card draw",     query: `${base} (o:"draw a card" OR o:"draw cards")${cmcFilter}`, targetCount: 10 },
        { label: "Removal",       query: `${base} (o:"destroy target" OR o:"exile target" OR o:"counter target")${cmcFilter}`, targetCount: 10 },
      ];

    case "typal": {
      const creatureType = detectCreatureType(commander);
      const typeFilter = creatureType ? ` t:${creatureType}` : "";
      return [
        { label: "Tribal creatures", query: `${base} t:creature${typeFilter}${cmcFilter}`, targetCount: 30 },
        { label: "Tribal synergy",   query: `${base}${typeFilter ? ` (o:"${creatureType}" OR t:${creatureType})` : ""}${cmcFilter}`, targetCount: 10 },
        { label: "Ramp",             query: `${base} (o:"add {" OR o:"search your library for a" t:land)${cmcFilter}`, targetCount: 8 },
        { label: "Card draw",        query: `${base} (o:"draw a card" OR o:"draw cards")${cmcFilter}`, targetCount: 7 },
        { label: "Removal",          query: `${base} (o:"destroy target" OR o:"exile target")${cmcFilter}`, targetCount: 6 },
      ];
    }

    case "stompy":
      return [
        { label: "Big creatures",  query: `${base} t:creature cmc>=4 power>=4`,  targetCount: 20 },
        { label: "Creatures",      query: `${base} t:creature${cmcFilter}`,       targetCount: 12 },
        { label: "Ramp",           query: `${base} (o:"add {" OR o:"search your library for a" t:land)${cmcFilter}`, targetCount: 12 },
        { label: "Card draw",      query: `${base} (o:"draw a card" OR o:"draw cards")${cmcFilter}`, targetCount: 8 },
        { label: "Removal",        query: `${base} (o:"destroy target" OR o:"exile target")${cmcFilter}`, targetCount: 5 },
      ];

    case "spellslinger":
      return [
        { label: "Instants",       query: `${base} t:instant${cmcFilter}`,       targetCount: 18 },
        { label: "Sorceries",      query: `${base} t:sorcery${cmcFilter}`,       targetCount: 14 },
        { label: "Spell synergy",  query: `${base} (o:"instant" OR o:"sorcery" OR o:"magecraft" OR o:"cast a noncreature")${cmcFilter}`, targetCount: 10 },
        { label: "Ramp",           query: `${base} (o:"add {" OR o:"search your library for a" t:land)${cmcFilter}`, targetCount: 10 },
        { label: "Creatures",      query: `${base} t:creature${cmcFilter}`,       targetCount: 8 },
      ];

    case "combo":
      return [
        { label: "Tutors",         query: `${base} o:"search your library"${cmcFilter}`, targetCount: 8 },
        { label: "Card draw",      query: `${base} (o:"draw a card" OR o:"draw cards" OR o:"draw X")${cmcFilter}`, targetCount: 14 },
        { label: "Creatures",      query: `${base} t:creature${cmcFilter}`,       targetCount: 15 },
        { label: "Ramp",           query: `${base} (o:"add {" OR o:"search your library for a" t:land)${cmcFilter}`, targetCount: 10 },
        { label: "Removal",        query: `${base} (o:"destroy target" OR o:"exile target" OR o:"counter target")${cmcFilter}`, targetCount: 8 },
      ];

    case "voltron":
      return [
        { label: "Equipment",      query: `${base} t:equipment${cmcFilter}`,     targetCount: 14 },
        { label: "Auras",          query: `${base} t:aura${cmcFilter}`,          targetCount: 10 },
        { label: "Protection",     query: `${base} (o:"hexproof" OR o:"indestructible" OR o:"protection from")${cmcFilter}`, targetCount: 8 },
        { label: "Ramp",           query: `${base} (o:"add {" OR o:"search your library for a" t:land)${cmcFilter}`, targetCount: 10 },
        { label: "Card draw",      query: `${base} (o:"draw a card" OR o:"draw cards")${cmcFilter}`, targetCount: 8 },
        { label: "Removal",        query: `${base} (o:"destroy target" OR o:"exile target")${cmcFilter}`, targetCount: 6 },
      ];

    case "aristocrats":
      return [
        { label: "Sacrifice outlets", query: `${base} o:"sacrifice a creature"${cmcFilter}`, targetCount: 10 },
        { label: "Death triggers",    query: `${base} (o:"when" o:"dies" OR o:"leaves the battlefield")${cmcFilter}`, targetCount: 12 },
        { label: "Recursion",         query: `${base} (o:"return" o:"from your graveyard" OR o:"reanimate")${cmcFilter}`, targetCount: 8 },
        { label: "Token producers",   query: `${base} o:"create" o:"token"${cmcFilter}`, targetCount: 8 },
        { label: "Ramp",              query: `${base} (o:"add {" OR o:"search your library for a" t:land)${cmcFilter}`, targetCount: 8 },
        { label: "Card draw",         query: `${base} (o:"draw a card" OR o:"draw cards")${cmcFilter}`, targetCount: 8 },
      ];

    case "control":
      return [
        { label: "Counterspells",  query: `${base} o:"counter target"${cmcFilter}`, targetCount: 10 },
        { label: "Board wipes",    query: `${base} (o:"destroy all" OR o:"exile all" OR o:"-X/-X")${cmcFilter}`, targetCount: 6 },
        { label: "Spot removal",   query: `${base} (o:"destroy target" OR o:"exile target")${cmcFilter}`, targetCount: 8 },
        { label: "Card draw",      query: `${base} (o:"draw a card" OR o:"draw cards" OR o:"draw X")${cmcFilter}`, targetCount: 12 },
        { label: "Ramp",           query: `${base} (o:"add {" OR o:"search your library for a" t:land)${cmcFilter}`, targetCount: 10 },
        { label: "Win conditions",  query: `${base} t:creature cmc>=4${cmcFilter}`, targetCount: 8 },
      ];

    case "tokens":
      return [
        { label: "Token generators", query: `${base} o:"create" o:"token"${cmcFilter}`, targetCount: 18 },
        { label: "Token synergy",    query: `${base} (o:"each creature you control" OR o:"number of creatures" OR o:"tokens you control")${cmcFilter}`, targetCount: 10 },
        { label: "Ramp",             query: `${base} (o:"add {" OR o:"search your library for a" t:land)${cmcFilter}`, targetCount: 10 },
        { label: "Card draw",        query: `${base} (o:"draw a card" OR o:"draw cards")${cmcFilter}`, targetCount: 8 },
        { label: "Removal",          query: `${base} (o:"destroy target" OR o:"exile target")${cmcFilter}`, targetCount: 6 },
      ];
  }
}
