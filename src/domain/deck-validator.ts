/**
 * Deck validation logic for Commander format rules.
 *
 * Validates decks against:
 * - Exactly 100 cards (including commander)
 * - Singleton rule (no duplicate non-basic-lands)
 * - Color identity (all cards within commander's color identity)
 * - Banned card list
 * - Commander present
 */

import type { Card } from "../models/card.js";
import type { Deck } from "../models/deck.js";
import type {
  CardLegalityResult,
  ValidationResult,
  Violation,
} from "../models/validation.js";
import { isBanned } from "../domain/banned-list.js";
import { isSubsetOfColorIdentity } from "../domain/color-identity.js";

/** Basic lands exempt from the singleton rule. */
const BASIC_LANDS: Set<string> = new Set([
  "Plains",
  "Island",
  "Swamp",
  "Mountain",
  "Forest",
  "Wastes",
]);

/**
 * Checks whether a card is a basic land exempt from the singleton rule.
 */
function isBasicLand(card: Card): boolean {
  return BASIC_LANDS.has(card.name);
}

/**
 * Validates a complete deck against all Commander format rules.
 *
 * Checks:
 * 1. Commander is present
 * 2. Deck contains exactly 100 cards (including commander)
 * 3. No non-basic-land duplicates (singleton rule)
 * 4. All cards are within the commander's color identity
 * 5. No banned cards
 */
export function validate(deck: Deck): ValidationResult {
  const violations: Violation[] = [];

  // Check commander is present
  if (!deck.commander) {
    violations.push({
      rule: "MISSING_COMMANDER",
      cardName: "",
      description: "Deck must have a commander.",
    });
  }

  // Count total cards: commander + all entries
  const totalCards =
    (deck.commander ? 1 : 0) +
    deck.entries.reduce((sum, entry) => sum + entry.quantity, 0);

  if (totalCards !== 100) {
    violations.push({
      rule: "DECK_SIZE",
      cardName: "",
      description: `Deck must contain exactly 100 cards (including commander), but has ${totalCards}.`,
    });
  }

  // Track card names for singleton check
  const seenNames = new Map<string, number>();

  // Include commander in singleton and banned checks
  if (deck.commander) {
    seenNames.set(deck.commander.name, 1);

    if (isBanned(deck.commander.name)) {
      violations.push({
        rule: "BANNED_CARD",
        cardName: deck.commander.name,
        description: `${deck.commander.name} is banned in Commander format.`,
      });
    }
  }

  for (const entry of deck.entries) {
    const card = entry.card;

    // Singleton rule: non-basic-lands may only appear once
    if (!isBasicLand(card)) {
      const count = (seenNames.get(card.name) ?? 0) + entry.quantity;
      seenNames.set(card.name, count);

      if (count > 1) {
        violations.push({
          rule: "SINGLETON",
          cardName: card.name,
          description: `${card.name} appears more than once. Commander decks can only have one copy of each non-basic-land card.`,
        });
      }
    }

    // Color identity check
    if (
      deck.commander &&
      !isSubsetOfColorIdentity(card.colorIdentity, deck.commander.colorIdentity)
    ) {
      violations.push({
        rule: "COLOR_IDENTITY",
        cardName: card.name,
        description: `${card.name}'s color identity [${card.colorIdentity.join(", ")}] is not within the commander's color identity [${deck.commander.colorIdentity.join(", ")}].`,
      });
    }

    // Banned card check
    if (isBanned(card.name)) {
      violations.push({
        rule: "BANNED_CARD",
        cardName: card.name,
        description: `${card.name} is banned in Commander format.`,
      });
    }
  }

  return {
    isLegal: violations.length === 0,
    violations,
  };
}

/**
 * Checks a single card's legality against Commander format rules
 * for a given commander.
 *
 * Checks:
 * - Color identity is within the commander's color identity
 * - Card is not on the banned list
 * - Card is not a duplicate non-basic-land already in the deck
 *   (when existingCardNames is provided)
 */
export function checkCardLegality(
  card: Card,
  commander: Card,
  existingCardNames?: Set<string>,
): CardLegalityResult {
  const violations: Violation[] = [];

  // Color identity check
  if (!isSubsetOfColorIdentity(card.colorIdentity, commander.colorIdentity)) {
    violations.push({
      rule: "COLOR_IDENTITY",
      cardName: card.name,
      description: `${card.name}'s color identity [${card.colorIdentity.join(", ")}] is outside the commander's color identity [${commander.colorIdentity.join(", ")}].`,
    });
  }

  // Banned card check
  if (isBanned(card.name)) {
    violations.push({
      rule: "BANNED_CARD",
      cardName: card.name,
      description: `${card.name} is banned in Commander format.`,
    });
  }

  // Singleton check against existing deck
  if (existingCardNames && !isBasicLand(card) && existingCardNames.has(card.name)) {
    violations.push({
      rule: "SINGLETON",
      cardName: card.name,
      description: `${card.name} is already in the deck. Commander decks can only have one copy of each non-basic-land card.`,
    });
  }

  return {
    isLegal: violations.length === 0,
    violations,
  };
}
