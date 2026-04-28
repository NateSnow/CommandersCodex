/**
 * Utilities for determining whether a card can serve as a commander.
 */

import type { Card } from "../models/card.js";

/**
 * Determines whether a card is eligible to be used as a commander.
 *
 * A card can be a commander if:
 * 1. Its type line contains both "Legendary" and "Creature", OR
 * 2. Its oracle text contains a phrase indicating it can be used as
 *    a commander (e.g., "can be your commander").
 *
 * This covers legendary creatures as well as special cases like
 * planeswalkers or other card types that explicitly state they can
 * serve as a commander.
 */
export function canBeCommander(card: Card): boolean {
  const typeLine = card.typeLine.toLowerCase();
  const isLegendaryCreature =
    typeLine.includes("legendary") && typeLine.includes("creature");

  const oracleText = card.oracleText.toLowerCase();
  const hasCommanderText = oracleText.includes("can be your commander");

  return isLegendaryCreature || hasCommanderText;
}
