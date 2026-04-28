/**
 * Application entry point for MTG Commander Deckbuilder.
 *
 * Registers all Web Components, instantiates domain services and data
 * adapters, wires dependencies into components, and mounts the app shell.
 */

// ---------------------------------------------------------------------------
// Global styles
// ---------------------------------------------------------------------------

import "./styles/global.css";

// ---------------------------------------------------------------------------
// Web Component imports
// ---------------------------------------------------------------------------

import { AppShell } from "./components/app-shell.js";
import { CommanderSearch } from "./components/commander-search.js";
import { CardSearch } from "./components/card-search.js";
import { DeckList } from "./components/deck-list.js";
import { DeckStats } from "./components/deck-stats.js";
import { CardRecommendations } from "./components/card-recommendations.js";
import { DeckExport } from "./components/deck-export.js";
import { SavedDecks } from "./components/saved-decks.js";
import { DeckValidation } from "./components/deck-validation.js";

// ---------------------------------------------------------------------------
// Domain & data imports
// ---------------------------------------------------------------------------

import { DeckManager } from "./domain/deck-manager.js";
import { createScryfallAdapter } from "./data/scryfall-adapter.js";
import { createEDHRECAdapter } from "./data/edhrec-adapter.js";
import { createCommanderSpellbookAdapter } from "./data/commander-spellbook-adapter.js";
import { createLocalStorageAdapter } from "./data/local-storage-adapter.js";

// ---------------------------------------------------------------------------
// Register custom elements
// ---------------------------------------------------------------------------

customElements.define("app-shell", AppShell);
customElements.define("commander-search", CommanderSearch);
customElements.define("card-search", CardSearch);
customElements.define("deck-list", DeckList);
customElements.define("deck-stats", DeckStats);
customElements.define("card-recommendations", CardRecommendations);
customElements.define("deck-export", DeckExport);
customElements.define("saved-decks", SavedDecks);
customElements.define("deck-validation", DeckValidation);


// ---------------------------------------------------------------------------
// Instantiate adapters
// ---------------------------------------------------------------------------

const localStorageAdapter = createLocalStorageAdapter();
const scryfallAdapter = createScryfallAdapter();
const edhrecAdapter = createEDHRECAdapter();
const commanderSpellbookAdapter = createCommanderSpellbookAdapter();

// ---------------------------------------------------------------------------
// Instantiate domain services
// ---------------------------------------------------------------------------

const deckManager = new DeckManager({
  localStorageAdapter,
  scryfallAdapter,
});

// ---------------------------------------------------------------------------
// Build the UI
// ---------------------------------------------------------------------------

function mountApp(): void {
  const appContainer = document.getElementById("app");
  if (!appContainer) {
    console.error("Could not find #app container element.");
    return;
  }

  // Create the app shell
  const shell = document.createElement("app-shell") as AppShell;

  // Create and wire commander search
  const commanderSearch = document.createElement("commander-search") as CommanderSearch;
  commanderSearch.slot = "commander-search";
  commanderSearch.deckManager = deckManager;
  commanderSearch.scryfallAdapter = scryfallAdapter;

  // Create and wire card search
  const cardSearch = document.createElement("card-search") as CardSearch;
  cardSearch.slot = "card-search";
  cardSearch.deckManager = deckManager;
  cardSearch.scryfallAdapter = scryfallAdapter;

  // Create and wire deck list
  const deckList = document.createElement("deck-list") as DeckList;
  deckList.slot = "deck-list";
  deckList.deckManager = deckManager;

  // Create and wire deck stats
  const deckStats = document.createElement("deck-stats") as DeckStats;
  deckStats.slot = "deck-stats";
  deckStats.deckManager = deckManager;

  // Create and wire card recommendations
  const cardRecs = document.createElement("card-recommendations") as CardRecommendations;
  cardRecs.slot = "card-recommendations";
  cardRecs.deckManager = deckManager;
  cardRecs.edhrecAdapter = edhrecAdapter;
  cardRecs.commanderSpellbookAdapter = commanderSpellbookAdapter;

  // Create and wire deck export
  const deckExport = document.createElement("deck-export") as DeckExport;
  deckExport.slot = "deck-export";
  deckExport.deckManager = deckManager;

  // Create and wire saved decks
  const savedDecks = document.createElement("saved-decks") as SavedDecks;
  savedDecks.slot = "saved-decks";
  savedDecks.deckManager = deckManager;
  savedDecks.localStorageAdapter = localStorageAdapter;

  // Create and wire deck validation
  const deckValidation = document.createElement("deck-validation") as DeckValidation;
  deckValidation.slot = "deck-validation";
  deckValidation.deckManager = deckManager;

  // Append all components to the shell
  shell.appendChild(commanderSearch);
  shell.appendChild(cardSearch);
  shell.appendChild(deckList);
  shell.appendChild(deckStats);
  shell.appendChild(cardRecs);
  shell.appendChild(deckExport);
  shell.appendChild(savedDecks);
  shell.appendChild(deckValidation);

  // Mount the shell into the DOM
  appContainer.appendChild(shell);
}

// ---------------------------------------------------------------------------
// Global error handling
// ---------------------------------------------------------------------------

window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
  console.error("Unhandled promise rejection:", event.reason);
  // Prevent the default browser error logging for handled rejections
  event.preventDefault();
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

mountApp();
