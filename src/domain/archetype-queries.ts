/**
 * Archetype-aware Scryfall query builder.
 *
 * Translates archetype + bracket level into targeted Scryfall search
 * queries that bias card selection toward the desired strategy.
 *
 * Scryfall query syntax notes:
 *  - Boolean OR is lowercase: `o:"draw" or o:"scry"`
 *  - Parentheses group terms: `(o:"draw" or o:"scry")`
 *  - Oracle text search: `o:"exact phrase"`
 *  - Type filter: `t:creature`
 *  - Color identity: `id<=wub`
 *  - Format legality: `f:commander`
 *  - CMC: `cmc<=5`
 *  - Power: `pow>=4`
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
 */
export function detectCreatureType(commander: Card): string | null {
  const typeLine = commander.typeLine;
  const dashIndex = typeLine.indexOf("—");
  if (dashIndex === -1) return null;

  const subtypes = typeLine
    .slice(dashIndex + 1)
    .trim()
    .split(/\s+/);

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
 */
function cmcCeiling(bracket: BracketLevel): string {
  switch (bracket) {
    case 1: return "cmc<=5";
    case 2: return "cmc<=6";
    case 3: return "cmc<=7";
    case 4: return "";
  }
}

/**
 * Generate the set of Scryfall queries for a given archetype, commander,
 * and bracket level.
 */
export function buildArchetypeQueries(
  commander: Card,
  archetype: Archetype,
  bracket: BracketLevel,
): ArchetypeQuery[] {
  const ci = colorFilter(commander.colorIdentity);
  const cmc = cmcCeiling(bracket);
  const cmcF = cmc ? ` ${cmc}` : "";
  // Base: legal in commander + within color identity
  const b = `f:commander ${ci}`;

  switch (archetype) {
    case "balanced":
      return [
        { label: "Creatures",  query: `${b} t:creature${cmcF}`, targetCount: 25 },
        { label: "Ramp",       query: `${b} (o:"add" o:"mana" or o:"search your library for" t:land)${cmcF}`, targetCount: 10 },
        { label: "Card draw",  query: `${b} (o:"draw a card" or o:"draw cards")${cmcF}`, targetCount: 10 },
        { label: "Removal",    query: `${b} (o:"destroy target" or o:"exile target" or o:"counter target")${cmcF}`, targetCount: 10 },
      ];

    case "typal": {
      const ct = detectCreatureType(commander);
      const tf = ct ? ` t:${ct}` : "";
      return [
        { label: "Tribal creatures", query: `${b} t:creature${tf}${cmcF}`, targetCount: 30 },
        { label: "Tribal synergy",   query: ct ? `${b} (o:"${ct}" or t:${ct})${cmcF}` : `${b} t:creature${cmcF}`, targetCount: 10 },
        { label: "Ramp",             query: `${b} (o:"add" o:"mana" or o:"search your library for" t:land)${cmcF}`, targetCount: 8 },
        { label: "Card draw",        query: `${b} (o:"draw a card" or o:"draw cards")${cmcF}`, targetCount: 7 },
        { label: "Removal",          query: `${b} (o:"destroy target" or o:"exile target")${cmcF}`, targetCount: 6 },
      ];
    }

    case "stompy":
      return [
        { label: "Big creatures",  query: `${b} t:creature cmc>=4 pow>=4`, targetCount: 20 },
        { label: "Creatures",      query: `${b} t:creature${cmcF}`, targetCount: 12 },
        { label: "Ramp",           query: `${b} (o:"add" o:"mana" or o:"search your library for" t:land)${cmcF}`, targetCount: 12 },
        { label: "Card draw",      query: `${b} (o:"draw a card" or o:"draw cards")${cmcF}`, targetCount: 8 },
        { label: "Removal",        query: `${b} (o:"destroy target" or o:"exile target")${cmcF}`, targetCount: 5 },
      ];

    case "spellslinger":
      return [
        { label: "Instants",      query: `${b} t:instant${cmcF}`, targetCount: 18 },
        { label: "Sorceries",     query: `${b} t:sorcery${cmcF}`, targetCount: 14 },
        { label: "Spell synergy", query: `${b} (o:"magecraft" or o:"cast a noncreature" or o:"instant or sorcery")${cmcF}`, targetCount: 10 },
        { label: "Ramp",          query: `${b} (o:"add" o:"mana" or o:"search your library for" t:land)${cmcF}`, targetCount: 10 },
        { label: "Creatures",     query: `${b} t:creature${cmcF}`, targetCount: 8 },
      ];

    case "combo":
      return [
        { label: "Tutors",    query: `${b} o:"search your library"${cmcF}`, targetCount: 8 },
        { label: "Card draw", query: `${b} (o:"draw a card" or o:"draw cards")${cmcF}`, targetCount: 14 },
        { label: "Creatures", query: `${b} t:creature${cmcF}`, targetCount: 15 },
        { label: "Ramp",      query: `${b} (o:"add" o:"mana" or o:"search your library for" t:land)${cmcF}`, targetCount: 10 },
        { label: "Removal",   query: `${b} (o:"destroy target" or o:"exile target" or o:"counter target")${cmcF}`, targetCount: 8 },
      ];

    case "voltron":
      return [
        { label: "Equipment",  query: `${b} t:equipment${cmcF}`, targetCount: 14 },
        { label: "Auras",      query: `${b} t:aura${cmcF}`, targetCount: 10 },
        { label: "Protection", query: `${b} (o:"hexproof" or o:"indestructible" or o:"protection from")${cmcF}`, targetCount: 8 },
        { label: "Ramp",       query: `${b} (o:"add" o:"mana" or o:"search your library for" t:land)${cmcF}`, targetCount: 10 },
        { label: "Card draw",  query: `${b} (o:"draw a card" or o:"draw cards")${cmcF}`, targetCount: 8 },
        { label: "Removal",    query: `${b} (o:"destroy target" or o:"exile target")${cmcF}`, targetCount: 6 },
      ];

    case "aristocrats":
      return [
        { label: "Sacrifice outlets", query: `${b} o:"sacrifice a creature"${cmcF}`, targetCount: 10 },
        { label: "Death triggers",    query: `${b} (o:"when" o:"dies" or o:"leaves the battlefield")${cmcF}`, targetCount: 12 },
        { label: "Recursion",         query: `${b} (o:"return" o:"from your graveyard")${cmcF}`, targetCount: 8 },
        { label: "Token producers",   query: `${b} o:"create" o:"token"${cmcF}`, targetCount: 8 },
        { label: "Ramp",              query: `${b} (o:"add" o:"mana" or o:"search your library for" t:land)${cmcF}`, targetCount: 8 },
        { label: "Card draw",         query: `${b} (o:"draw a card" or o:"draw cards")${cmcF}`, targetCount: 8 },
      ];

    case "control":
      return [
        { label: "Counterspells", query: `${b} o:"counter target"${cmcF}`, targetCount: 10 },
        { label: "Board wipes",   query: `${b} (o:"destroy all" or o:"exile all")${cmcF}`, targetCount: 6 },
        { label: "Spot removal",  query: `${b} (o:"destroy target" or o:"exile target")${cmcF}`, targetCount: 8 },
        { label: "Card draw",     query: `${b} (o:"draw a card" or o:"draw cards")${cmcF}`, targetCount: 12 },
        { label: "Ramp",          query: `${b} (o:"add" o:"mana" or o:"search your library for" t:land)${cmcF}`, targetCount: 10 },
        { label: "Win conditions", query: `${b} t:creature cmc>=4${cmcF}`, targetCount: 8 },
      ];

    case "tokens":
      return [
        { label: "Token generators", query: `${b} o:"create" o:"token"${cmcF}`, targetCount: 18 },
        { label: "Token synergy",    query: `${b} (o:"each creature you control" or o:"number of creatures" or o:"tokens you control")${cmcF}`, targetCount: 10 },
        { label: "Ramp",             query: `${b} (o:"add" o:"mana" or o:"search your library for" t:land)${cmcF}`, targetCount: 10 },
        { label: "Card draw",        query: `${b} (o:"draw a card" or o:"draw cards")${cmcF}`, targetCount: 8 },
        { label: "Removal",          query: `${b} (o:"destroy target" or o:"exile target")${cmcF}`, targetCount: 6 },
      ];
  }
}
