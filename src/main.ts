/**
 * Application entry point for Commander's Codex — Deck Generator.
 *
 * Registers Web Components, instantiates adapters and the generator,
 * wires everything together, and mounts the app.
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
import { StrategyConfig } from "./components/strategy-config.js";
import { DeckView } from "./components/deck-view.js";

// ---------------------------------------------------------------------------
// Domain & data imports
// ---------------------------------------------------------------------------

import { DeckGenerator } from "./domain/deck-generator.js";
import { createScryfallAdapter } from "./data/scryfall-adapter.js";
import { createEDHRECAdapter } from "./data/edhrec-adapter.js";
import { createCommanderSpellbookAdapter } from "./data/commander-spellbook-adapter.js";
import type { Card } from "./models/card.js";
import type { Archetype, BracketLevel } from "./models/generation.js";

// ---------------------------------------------------------------------------
// Register custom elements
// ---------------------------------------------------------------------------

customElements.define("app-shell", AppShell);
customElements.define("commander-search", CommanderSearch);
customElements.define("strategy-config", StrategyConfig);
customElements.define("deck-view", DeckView);

// ---------------------------------------------------------------------------
// Instantiate adapters and generator
// ---------------------------------------------------------------------------

const scryfallAdapter = createScryfallAdapter();
const edhrecAdapter = createEDHRECAdapter();
const commanderSpellbookAdapter = createCommanderSpellbookAdapter();

const deckGenerator = new DeckGenerator({
  scryfallAdapter,
  edhrecAdapter,
  commanderSpellbookAdapter,
});

// ---------------------------------------------------------------------------
// Mount the app
// ---------------------------------------------------------------------------

const app = document.getElementById("app")!;

// Create components
const shell = document.createElement("app-shell");

const commanderSearch = document.createElement("commander-search") as CommanderSearch;
commanderSearch.slot = "commander-search";
commanderSearch.scryfallAdapter = scryfallAdapter;

const strategyConfig = document.createElement("strategy-config") as StrategyConfig;
strategyConfig.slot = "strategy-config";

const deckView = document.createElement("deck-view") as DeckView;
deckView.slot = "deck-view";

// Assemble
shell.appendChild(commanderSearch);
shell.appendChild(strategyConfig);
shell.appendChild(deckView);
app.appendChild(shell);

// ---------------------------------------------------------------------------
// Wire up events
// ---------------------------------------------------------------------------

let selectedCommander: Card | null = null;

// Commander selection
commanderSearch.addEventListener("commander-changed", ((event: CustomEvent) => {
  selectedCommander = event.detail.commander;
}) as EventListener);

// Generate deck
strategyConfig.addEventListener("generate-deck", ((event: Event) => {
  if (!selectedCommander) return;

  const detail = (event as CustomEvent).detail as {
    archetype: Archetype;
    bracketLevel: BracketLevel;
    includeInfiniteCombos: boolean;
    landCount: number;
  };

  deckGenerator.generate({
    commander: selectedCommander,
    archetype: detail.archetype,
    bracketLevel: detail.bracketLevel,
    includeInfiniteCombos: detail.includeInfiniteCombos,
    landCount: detail.landCount,
  }).catch(() => {
    // Error handled by event bus → deck-view shows the error
  });
}) as EventListener);

// Regenerate from deck view
deckView.addEventListener("regenerate-deck", (() => {
  if (!selectedCommander) return;

  // Re-trigger the generate button on the strategy config
  const generateBtn = strategyConfig.shadowRoot?.getElementById("btn-generate");
  if (generateBtn) {
    generateBtn.click();
  }
}) as EventListener);
