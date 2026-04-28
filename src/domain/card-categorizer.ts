/**
 * Pure function module that classifies cards into functional categories
 * based on type line and oracle text heuristics.
 *
 * Priority order for multi-category cards: Removal > Card Draw > Ramp > Threat
 */

import type { Card } from "../models/card.js";
import type { FunctionalCategory } from "../models/generation.js";

/** Regex patterns for Removal heuristics. */
const REMOVAL_PATTERNS: RegExp[] = [
  /destroy target/i,
  /destroy all/i,
  /exile target/i,
  /exile all/i,
  /return.*to.*hand/i,
  /counter target/i,
  /-\d+\/-\d+/i,
  /-X\/-X/i,
  /deals.*damage to target/i,
  /deals.*damage to each/i,
];

/** Regex patterns for Card Draw heuristics. */
const CARD_DRAW_PATTERNS: RegExp[] = [
  /draw a card/i,
  /draw cards/i,
  /draw X/i,
  /draws a card/i,
  /draws?\s+\w+\s+cards?/i,
  /scry/i,
];

/** Regex patterns for Ramp heuristics (oracle text). */
const RAMP_ORACLE_PATTERNS: RegExp[] = [
  /add \{/i,
  /add one mana/i,
  /search your library for a.*land/i,
  /put.*land.*onto the battlefield/i,
];

/**
 * Categorize a card into a functional category using type line and oracle text heuristics.
 *
 * Priority order: Removal > Card Draw > Ramp > Threat
 */
export function categorize(card: Card): FunctionalCategory {
  const oracleText = getOracleText(card);

  if (isRemoval(oracleText)) return "Removal";
  if (isCardDraw(oracleText)) return "Card Draw";
  if (isRamp(card, oracleText)) return "Ramp";

  return "Threat";
}

/** Collect oracle text from the card, including both faces for double-faced cards. */
function getOracleText(card: Card): string {
  let text = card.oracleText ?? "";
  if (card.cardFaces) {
    text += " " + card.cardFaces.map((f) => f.oracleText).join(" ");
  }
  return text;
}

/** Check if oracle text matches any Removal pattern. */
function isRemoval(oracleText: string): boolean {
  return REMOVAL_PATTERNS.some((pattern) => pattern.test(oracleText));
}

/** Check if oracle text matches any Card Draw pattern. */
function isCardDraw(oracleText: string): boolean {
  return CARD_DRAW_PATTERNS.some((pattern) => pattern.test(oracleText));
}

/** Check if the card qualifies as Ramp via oracle text or type line heuristics. */
function isRamp(card: Card, oracleText: string): boolean {
  // Check oracle text patterns
  if (RAMP_ORACLE_PATTERNS.some((pattern) => pattern.test(oracleText))) {
    return true;
  }

  // Check for non-basic lands with abilities (type line contains "Land" but not just a basic)
  const typeLine = card.typeLine ?? "";
  if (/\bLand\b/i.test(typeLine) && !/^Basic Land/i.test(typeLine) && oracleText.trim().length > 0) {
    return true;
  }

  return false;
}
