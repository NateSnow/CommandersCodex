/**
 * Official Commander format banned cards list.
 *
 * This list includes all individually named cards banned in Commander.
 * It does not include the categorical bans (Conspiracy-type cards,
 * ante cards, and culturally offensive cards), which are handled
 * separately by card type or Scryfall legality data.
 *
 * Source: https://magic.wizards.com/en/banned-restricted-list
 *
 * Note: Lutri, the Spellchaser is only banned as a companion,
 * not as a card in the deck or as a commander. It is included
 * here for simplicity since the deckbuilder does not model the
 * companion mechanic separately.
 */

export const BANNED_CARDS: Set<string> = new Set([
  // Power 9 (minus Timetwister)
  "Ancestral Recall",
  "Black Lotus",
  "Mox Emerald",
  "Mox Jet",
  "Mox Pearl",
  "Mox Ruby",
  "Mox Sapphire",
  "Time Walk",

  // Fast mana
  "Channel",
  "Dockside Extortionist",
  "Fastbond",
  "Jeweled Lotus",
  "Mana Crypt",
  "Rofellos, Llanowar Emissary",
  "Tolarian Academy",

  // Combo pieces
  "Flash",
  "Paradox Engine",
  "Primeval Titan",
  "Recurring Nightmare",
  "Time Vault",
  "Tinker",
  "Upheaval",

  // Stax pieces
  "Balance",
  "Erayo, Soratami Ascendant",
  "Iona, Shield of Emeria",
  "Limited Resources",
  "Sundering Titan",

  // Ubiquitous / format-warping
  "Emrakul, the Aeons Torn",
  "Golos, Tireless Pilgrim",
  "Library of Alexandria",
  "Lutri, the Spellchaser",
  "Nadu, Winged Wisdom",

  // 40-life matters
  "Biorhythm",
  "Griselbrand",
  "Yawgmoth's Bargain",

  // Miscellaneous
  "Coalition Victory",
  "Hullbreacher",
  "Karakas",
  "Leovold, Emissary of Trest",
  "Panoptic Mirror",
  "Prophet of Kruphix",
  "Sway of the Stars",
  "Sylvan Primordial",
  "Trade Secrets",
  "Worldfire",

  // Dexterity cards and Shahrazad
  "Chaos Orb",
  "Falling Star",
  "Shahrazad",

  // Ante cards
  "Amulet of Quoz",
  "Bronze Tablet",
  "Contract from Below",
  "Darkpact",
  "Demonic Attorney",
  "Jeweled Bird",
  "Rebirth",
  "Tempest Efreet",
  "Timmerian Fiends",
]);

/**
 * Check whether a card name is on the Commander banned list.
 */
export function isBanned(cardName: string): boolean {
  return BANNED_CARDS.has(cardName);
}
