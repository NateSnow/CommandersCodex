/**
 * Data models for deck validation against Commander format rules.
 */

/** The specific Commander format rule that was violated. */
export type ValidationRule =
  | "DECK_SIZE"
  | "SINGLETON"
  | "COLOR_IDENTITY"
  | "BANNED_CARD"
  | "MISSING_COMMANDER";

/** A single rule violation found during deck validation. */
export interface Violation {
  rule: ValidationRule;
  cardName: string;
  description: string;
}

/** The result of validating a deck against Commander format rules. */
export interface ValidationResult {
  isLegal: boolean;
  violations: Violation[];
}

/** The result of checking a single card's legality for a given commander. */
export interface CardLegalityResult {
  isLegal: boolean;
  violations: Violation[];
}
