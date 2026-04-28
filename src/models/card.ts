/**
 * Card data models sourced from Scryfall API.
 */

/** The five colors of Magic mana. */
export type Color = "W" | "U" | "B" | "R" | "G";

/** A card's color identity — a subset of the five colors. */
export type ColorIdentity = Color[];

/** One face of a double-faced card. */
export interface CardFace {
  name: string;
  manaCost: string;
  typeLine: string;
  oracleText: string;
  colors: Color[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  imageUris?: {
    small: string;
    normal: string;
    large: string;
    artCrop: string;
  };
}

/** A Magic: The Gathering card as represented in the application. */
export interface Card {
  id: string;                    // Scryfall UUID
  name: string;
  manaCost: string;              // e.g., "{2}{W}{U}"
  cmc: number;                   // Converted mana cost
  typeLine: string;              // e.g., "Legendary Creature — Human Wizard"
  oracleText: string;
  colors: Color[];
  colorIdentity: Color[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  imageUris?: {
    small: string;
    normal: string;
    large: string;
    artCrop: string;
  };
  cardFaces?: CardFace[];        // For double-faced cards
  legalities: Record<string, string>;
  keywords: string[];
  isLegendary: boolean;          // Derived from typeLine
  isCreature: boolean;           // Derived from typeLine
  canBeCommander: boolean;       // Derived: legendary creature OR has "can be your commander" text
}

/** Filters for card search queries. */
export interface SearchFilters {
  cardType?: string;
  maxCmc?: number;
  minCmc?: number;
  colors?: string[];
  keywords?: string[];
}
