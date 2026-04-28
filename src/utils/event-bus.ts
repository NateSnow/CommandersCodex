/**
 * Central event bus for inter-component communication.
 *
 * Uses a shared EventTarget as the event emitter. Components dispatch
 * events through this bus and subscribe to events they care about.
 * This keeps components decoupled — they communicate through events
 * rather than direct references.
 */

import type { Card } from "../models/card.js";
import type { Deck } from "../models/deck.js";
import type { GenerationResult } from "../models/generation.js";

// ---------------------------------------------------------------------------
// Event type definitions
// ---------------------------------------------------------------------------

/** Map of event names to their detail payload types. */
export interface EventBusEventMap {
  "deck-changed": { deck: Deck };
  "commander-changed": { commander: Card };
  error: { message: string; source?: string };
  "generation-progress": { phase: string; percentComplete: number };
  "generation-complete": { result: GenerationResult };
  "generation-error": { message: string };
}

/** All valid event names on the bus. */
export type EventBusEventName = keyof EventBusEventMap;

/** A typed CustomEvent whose detail matches the event name. */
export type TypedCustomEvent<K extends EventBusEventName> = CustomEvent<
  EventBusEventMap[K]
>;

/** Handler signature for a given event name. */
export type EventBusHandler<K extends EventBusEventName> = (
  event: TypedCustomEvent<K>,
) => void;

// ---------------------------------------------------------------------------
// Shared event target
// ---------------------------------------------------------------------------

/** The single shared EventTarget used by the entire application. */
const eventTarget = new EventTarget();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Dispatches a typed event on the shared event bus.
 *
 * @param eventName - One of the known event names.
 * @param detail    - The payload for the event.
 */
export function dispatch<K extends EventBusEventName>(
  eventName: K,
  detail: EventBusEventMap[K],
): void {
  const event = new CustomEvent(eventName, { detail });
  eventTarget.dispatchEvent(event);
}

/**
 * Subscribes to a typed event on the shared event bus.
 *
 * @param eventName - One of the known event names.
 * @param handler   - Callback invoked when the event fires.
 * @returns An unsubscribe function that removes the listener.
 */
export function subscribe<K extends EventBusEventName>(
  eventName: K,
  handler: EventBusHandler<K>,
): () => void {
  eventTarget.addEventListener(eventName, handler as EventListener);
  return () => {
    eventTarget.removeEventListener(eventName, handler as EventListener);
  };
}
