/**
 * Utilities for working with Magic: The Gathering color identities.
 */

import type { Color } from "../models/card.js";

/**
 * Checks whether a card's color identity is a subset of the
 * commander's color identity.
 *
 * In Commander, every card in the deck must have a color identity
 * that is a subset of the commander's color identity. For example,
 * if the commander's color identity is ["W", "U"], only cards with
 * color identity containing some combination of W and U (or
 * colorless cards with an empty color identity) are legal.
 *
 * @param cardColors - The color identity of the card to check.
 * @param commanderColors - The color identity of the commander.
 * @returns `true` if every color in `cardColors` is present in
 *          `commanderColors`, `false` otherwise.
 */
export function isSubsetOfColorIdentity(
  cardColors: Color[],
  commanderColors: Color[],
): boolean {
  const commanderSet = new Set(commanderColors);
  return cardColors.every((color) => commanderSet.has(color));
}
