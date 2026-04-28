/**
 * Generic Result type and domain error types.
 *
 * The Result<T, E> discriminated union forces callers to handle
 * both success and error cases explicitly.
 */

/** A discriminated union representing either a success or an error. */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

/** Error types that can occur during deck operations. */
export type DeckError =
  | { kind: "NOT_LEGENDARY"; message: string }
  | { kind: "NOT_CREATURE"; message: string }
  | { kind: "INVALID_COMMANDER"; message: string }
  | { kind: "COLOR_IDENTITY_VIOLATION"; message: string }
  | { kind: "SINGLETON_VIOLATION"; message: string }
  | { kind: "BANNED_CARD"; message: string }
  | { kind: "DECK_FULL"; message: string }
  | { kind: "CARD_NOT_FOUND"; message: string }
  | { kind: "LOAD_ERROR"; message: string };
