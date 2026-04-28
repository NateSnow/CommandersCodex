/**
 * Data models for card recommendations and combo discovery.
 */

import type { Color } from "./card.js";

/** A card recommendation from EDHREC. */
export interface EDHRECRecommendation {
  cardName: string;
  scryfallId?: string;
  synergyScore: number;          // EDHREC's synergy/lift score
  inclusionPercentage: number;   // % of decks running this card
  imageUri?: string;
}

/** A card combo from Commander Spellbook. */
export interface Combo {
  id: string;
  name: string;
  cards: string[];               // Card names involved
  colorIdentity: Color[];
  description: string;           // What the combo does
  prerequisites: string;
  steps: string;
  results: string[];             // e.g., ["Infinite mana", "Infinite tokens"]
}
