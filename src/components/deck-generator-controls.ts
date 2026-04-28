/**
 * `<deck-generator-controls>` Web Component
 *
 * Provides the UI controls for triggering automatic deck generation.
 * Renders an "Auto-Generate Deck" button, a "Build Around a Card"
 * search section, and a "Regenerate" button (visible after generation).
 *
 * Dependencies (set as properties after construction):
 *  - deckGenerator: DeckGenerator instance
 *  - deckManager: DeckManager instance
 *  - scryfallAdapter: ScryfallAdapter instance
 */

import type { Card } from "../models/card.js";
import type { DeckGenerator } from "../domain/deck-generator.js";
import type { DeckManager } from "../domain/deck-manager.js";
import type { ScryfallAdapter } from "../data/scryfall-adapter.js";
import { subscribe } from "../utils/event-bus.js";

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

const template = document.createElement("template");
template.innerHTML = `
<style>
  :host {
    display: block;
    font-family: system-ui, -apple-system, sans-serif;
    color: #e0e0e0;
  }

  * { box-sizing: border-box; }

  .controls-container {
    padding: 16px;
  }

  h2 {
    margin: 0 0 12px 0;
    font-size: 1.25rem;
    color: #fff;
  }

  .btn-generate,
  .btn-regenerate {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 12px 24px;
    font-size: 1rem;
    font-weight: 600;
    color: #fff;
    background: #7c4dff;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    min-height: 44px;
    min-width: 44px;
    transition: background 0.2s, opacity 0.2s;
    width: 100%;
    margin-bottom: 12px;
  }

  .btn-generate:hover:not(:disabled),
  .btn-regenerate:hover:not(:disabled) {
    background: #651fff;
  }

  .btn-generate:focus-visible,
  .btn-regenerate:focus-visible {
    outline: 2px solid #7c4dff;
    outline-offset: 2px;
  }

  .btn-generate:disabled,
  .btn-regenerate:disabled {
    background: #555;
    cursor: not-allowed;
    color: #999;
    opacity: 0.7;
  }

  .btn-regenerate {
    background: #3a3a3a;
    border: 1px solid #555;
    display: none;
  }

  .btn-regenerate.visible {
    display: inline-flex;
  }

  .btn-regenerate:hover:not(:disabled) {
    background: #4a4a4a;
  }

  /* Build-around section */
  .build-around-section {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #444;
  }

  .build-around-section h3 {
    margin: 0 0 8px 0;
    font-size: 1rem;
    color: #ccc;
  }

  .build-around-section p {
    margin: 0 0 8px 0;
    font-size: 0.85rem;
    color: #999;
  }

  .search-wrapper {
    position: relative;
  }

  .build-around-input {
    width: 100%;
    padding: 12px 16px;
    font-size: 1rem;
    border: 1px solid #555;
    border-radius: 8px;
    background: #2a2a2a;
    color: #e0e0e0;
    outline: none;
    min-height: 44px;
    transition: border-color 0.2s;
  }

  .build-around-input:focus {
    border-color: #7c4dff;
  }

  .build-around-input::placeholder {
    color: #888;
  }

  .build-around-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Autocomplete suggestions */
  .suggestions-list {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 10;
    background: #2a2a2a;
    border: 1px solid #555;
    border-top: none;
    border-radius: 0 0 8px 8px;
    max-height: 200px;
    overflow-y: auto;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .suggestions-list.visible {
    display: block;
  }

  .suggestion-item {
    padding: 10px 16px;
    font-size: 0.9rem;
    cursor: pointer;
    min-height: 44px;
    display: flex;
    align-items: center;
    transition: background 0.15s;
  }

  .suggestion-item:hover,
  .suggestion-item:focus-visible,
  .suggestion-item[aria-selected="true"] {
    background: #3a3a5a;
    color: #fff;
  }

  .suggestion-item:focus-visible {
    outline: 2px solid #7c4dff;
    outline-offset: -2px;
  }

  /* Loading indicator for build-around */
  .build-around-loading {
    display: none;
    padding: 8px 0;
    font-size: 0.85rem;
    color: #aaa;
  }

  .build-around-loading.visible {
    display: block;
  }

  /* Error / status messages */
  .status-message {
    display: none;
    padding: 10px 14px;
    margin-top: 8px;
    border-radius: 8px;
    font-size: 0.85rem;
  }

  .status-message.visible {
    display: block;
  }

  .status-message.error {
    background: #3d1c1c;
    border: 1px solid #7a2e2e;
    color: #f5a5a5;
  }

  .status-message.success {
    background: #1e3a1e;
    border: 1px solid #3a7a3a;
    color: #a5f5a5;
  }

  /* ARIA live region (visually hidden) */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (max-width: 767px) {
    .controls-container {
      padding: 12px;
    }
  }
</style>

<div class="controls-container">
  <h2>Deck Generator</h2>

  <div aria-live="polite" id="live-region" class="sr-only"></div>

  <button
    class="btn-generate"
    id="btn-generate"
    disabled
    aria-label="Auto-Generate Deck"
  >
    Auto-Generate Deck
  </button>

  <button
    class="btn-regenerate"
    id="btn-regenerate"
    aria-label="Regenerate deck with different cards"
  >
    Regenerate
  </button>

  <div class="build-around-section">
    <h3>Build Around a Card</h3>
    <p>Search for a card to build a deck around.</p>

    <div class="search-wrapper">
      <input
        type="text"
        class="build-around-input"
        id="build-around-input"
        placeholder="Search for a card..."
        aria-label="Search for a card to build around"
        autocomplete="off"
        role="combobox"
        aria-expanded="false"
        aria-controls="suggestions-list"
        aria-autocomplete="list"
      />
      <ul
        class="suggestions-list"
        id="suggestions-list"
        role="listbox"
        aria-label="Card name suggestions"
      ></ul>
    </div>

    <div class="build-around-loading" id="build-around-loading">
      Searching...
    </div>
  </div>

  <div class="status-message" id="status-message" role="alert"></div>
</div>
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export class DeckGeneratorControls extends HTMLElement {
  private shadow: ShadowRoot;
  private _deckGenerator: DeckGenerator | null = null;
  private _deckManager: DeckManager | null = null;
  private _scryfallAdapter: ScryfallAdapter | null = null;

  private _commander: Card | null = null;
  private _generating = false;
  private _hasGenerated = false;
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _activeSuggestionIndex = -1;
  private _suggestions: string[] = [];

  private _unsubCommander: (() => void) | null = null;
  private _unsubComplete: (() => void) | null = null;
  private _unsubError: (() => void) | null = null;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: "open" });
    this.shadow.appendChild(template.content.cloneNode(true));
  }

  // -----------------------------------------------------------------------
  // Dependency injection via properties
  // -----------------------------------------------------------------------

  set deckGenerator(dg: DeckGenerator) {
    this._deckGenerator = dg;
  }

  get deckGenerator(): DeckGenerator | null {
    return this._deckGenerator;
  }

  set deckManager(dm: DeckManager) {
    this._deckManager = dm;
    const existing = dm.getCommander();
    if (existing) {
      this._commander = existing;
      this.updateButtonStates();
    }
  }

  get deckManager(): DeckManager | null {
    return this._deckManager;
  }

  set scryfallAdapter(adapter: ScryfallAdapter) {
    this._scryfallAdapter = adapter;
  }

  get scryfallAdapter(): ScryfallAdapter | null {
    return this._scryfallAdapter;
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  connectedCallback(): void {
    const generateBtn = this.shadow.getElementById("btn-generate")!;
    generateBtn.addEventListener("click", this.handleGenerate);
    generateBtn.addEventListener("keydown", this.handleButtonKeydown);

    const regenerateBtn = this.shadow.getElementById("btn-regenerate")!;
    regenerateBtn.addEventListener("click", this.handleRegenerate);
    regenerateBtn.addEventListener("keydown", this.handleButtonKeydown);

    const buildAroundInput = this.shadow.getElementById("build-around-input") as HTMLInputElement;
    buildAroundInput.addEventListener("input", this.handleBuildAroundInput);
    buildAroundInput.addEventListener("keydown", this.handleBuildAroundKeydown);
    buildAroundInput.addEventListener("blur", this.handleBuildAroundBlur);

    // Subscribe to event bus events
    this._unsubCommander = subscribe("commander-changed", (event) => {
      this._commander = event.detail.commander;
      this.updateButtonStates();
    });

    this._unsubComplete = subscribe("generation-complete", () => {
      this._generating = false;
      this._hasGenerated = true;
      this.updateButtonStates();
      this.showStatus("Deck generated successfully!", "success");
      this.announce("Deck generation complete.");
    });

    this._unsubError = subscribe("generation-error", (event) => {
      this._generating = false;
      this.updateButtonStates();
      this.showStatus(event.detail.message, "error");
      this.announce(`Generation error: ${event.detail.message}`);
    });
  }

  disconnectedCallback(): void {
    const generateBtn = this.shadow.getElementById("btn-generate");
    generateBtn?.removeEventListener("click", this.handleGenerate);
    generateBtn?.removeEventListener("keydown", this.handleButtonKeydown);

    const regenerateBtn = this.shadow.getElementById("btn-regenerate");
    regenerateBtn?.removeEventListener("click", this.handleRegenerate);
    regenerateBtn?.removeEventListener("keydown", this.handleButtonKeydown);

    const buildAroundInput = this.shadow.getElementById("build-around-input");
    buildAroundInput?.removeEventListener("input", this.handleBuildAroundInput);
    buildAroundInput?.removeEventListener("keydown", this.handleBuildAroundKeydown);
    buildAroundInput?.removeEventListener("blur", this.handleBuildAroundBlur);

    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._unsubCommander?.();
    this._unsubComplete?.();
    this._unsubError?.();
  }

  // -----------------------------------------------------------------------
  // Generate / Regenerate handlers
  // -----------------------------------------------------------------------

  private handleGenerate = async (): Promise<void> => {
    if (this._generating || !this._commander || !this._deckGenerator) return;

    this._generating = true;
    this.updateButtonStates();
    this.hideStatus();
    this.announce("Generating deck...");

    try {
      await this._deckGenerator.generate({ commander: this._commander });
    } catch {
      // Error is handled by the generation-error event subscription
    }
  };

  private handleRegenerate = async (): Promise<void> => {
    if (this._generating || !this._commander || !this._deckGenerator) return;

    this._generating = true;
    this.updateButtonStates();
    this.hideStatus();
    this.announce("Regenerating deck...");

    try {
      await this._deckGenerator.generate({ commander: this._commander });
    } catch {
      // Error is handled by the generation-error event subscription
    }
  };

  private handleButtonKeydown = (e: KeyboardEvent): void => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      (e.currentTarget as HTMLButtonElement).click();
    }
  };

  // -----------------------------------------------------------------------
  // Build-around autocomplete handlers
  // -----------------------------------------------------------------------

  private handleBuildAroundInput = (): void => {
    if (this._debounceTimer) clearTimeout(this._debounceTimer);

    const input = this.shadow.getElementById("build-around-input") as HTMLInputElement;
    const query = input.value.trim();

    if (query.length < 2) {
      this.hideSuggestions();
      return;
    }

    this._debounceTimer = setTimeout(() => {
      this.fetchSuggestions(query);
    }, 300);
  };

  private handleBuildAroundKeydown = (e: KeyboardEvent): void => {
    const list = this.shadow.getElementById("suggestions-list")!;
    const items = list.querySelectorAll<HTMLLIElement>(".suggestion-item");

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (this._suggestions.length === 0) return;
      this._activeSuggestionIndex = Math.min(
        this._activeSuggestionIndex + 1,
        this._suggestions.length - 1,
      );
      this.updateActiveSuggestion(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (this._suggestions.length === 0) return;
      this._activeSuggestionIndex = Math.max(this._activeSuggestionIndex - 1, 0);
      this.updateActiveSuggestion(items);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (this._activeSuggestionIndex >= 0 && this._activeSuggestionIndex < this._suggestions.length) {
        this.selectSuggestion(this._suggestions[this._activeSuggestionIndex]);
      }
    } else if (e.key === "Escape") {
      this.hideSuggestions();
    }
  };

  private handleBuildAroundBlur = (): void => {
    // Delay hiding so click on suggestion can register
    setTimeout(() => this.hideSuggestions(), 200);
  };

  private async fetchSuggestions(query: string): Promise<void> {
    if (!this._scryfallAdapter) return;

    const loading = this.shadow.getElementById("build-around-loading")!;
    loading.classList.add("visible");

    try {
      const results = await this._scryfallAdapter.autocomplete(query);
      this._suggestions = results.slice(0, 8);
      this._activeSuggestionIndex = -1;
      this.renderSuggestions();
    } catch {
      this._suggestions = [];
      this.hideSuggestions();
    } finally {
      loading.classList.remove("visible");
    }
  }

  private renderSuggestions(): void {
    const list = this.shadow.getElementById("suggestions-list")!;
    const input = this.shadow.getElementById("build-around-input") as HTMLInputElement;
    list.innerHTML = "";

    if (this._suggestions.length === 0) {
      this.hideSuggestions();
      return;
    }

    for (let i = 0; i < this._suggestions.length; i++) {
      const name = this._suggestions[i];
      const li = document.createElement("li");
      li.className = "suggestion-item";
      li.setAttribute("role", "option");
      li.setAttribute("tabindex", "-1");
      li.setAttribute("aria-selected", "false");
      li.textContent = name;

      li.addEventListener("mousedown", (e) => {
        e.preventDefault(); // Prevent blur from firing before click
        this.selectSuggestion(name);
      });

      list.appendChild(li);
    }

    list.classList.add("visible");
    input.setAttribute("aria-expanded", "true");
  }

  private updateActiveSuggestion(items: NodeListOf<HTMLLIElement>): void {
    items.forEach((item, idx) => {
      item.setAttribute("aria-selected", idx === this._activeSuggestionIndex ? "true" : "false");
    });
    if (this._activeSuggestionIndex >= 0 && items[this._activeSuggestionIndex]) {
      items[this._activeSuggestionIndex].scrollIntoView({ block: "nearest" });
    }
  }

  private async selectSuggestion(cardName: string): Promise<void> {
    this.hideSuggestions();

    const input = this.shadow.getElementById("build-around-input") as HTMLInputElement;
    input.value = cardName;

    if (!this._scryfallAdapter || !this._deckGenerator) return;
    if (this._generating) return;

    this._generating = true;
    this.updateButtonStates();
    this.hideStatus();
    this.announce(`Building deck around ${cardName}...`);

    try {
      // Search for the exact card by name
      const searchResult = await this._scryfallAdapter.searchCards(
        `!"${cardName}"`,
        [],
      );

      if (searchResult.cards.length === 0) {
        this._generating = false;
        this.updateButtonStates();
        this.showStatus(`Could not find card "${cardName}".`, "error");
        return;
      }

      const card = searchResult.cards[0];
      await this._deckGenerator.generateBuildAround(card);
    } catch {
      // Error is handled by the generation-error event subscription
    }
  }

  private hideSuggestions(): void {
    const list = this.shadow.getElementById("suggestions-list")!;
    const input = this.shadow.getElementById("build-around-input") as HTMLInputElement;
    list.classList.remove("visible");
    list.innerHTML = "";
    input.setAttribute("aria-expanded", "false");
    this._suggestions = [];
    this._activeSuggestionIndex = -1;
  }

  // -----------------------------------------------------------------------
  // UI state management
  // -----------------------------------------------------------------------

  private updateButtonStates(): void {
    const generateBtn = this.shadow.getElementById("btn-generate") as HTMLButtonElement;
    const regenerateBtn = this.shadow.getElementById("btn-regenerate") as HTMLButtonElement;
    const buildAroundInput = this.shadow.getElementById("build-around-input") as HTMLInputElement;

    const canGenerate = this._commander !== null && !this._generating;

    generateBtn.disabled = !canGenerate;
    regenerateBtn.disabled = this._generating;
    buildAroundInput.disabled = this._generating;

    if (this._hasGenerated && !this._generating) {
      regenerateBtn.classList.add("visible");
    }
  }

  private showStatus(message: string, type: "error" | "success"): void {
    const el = this.shadow.getElementById("status-message")!;
    el.textContent = message;
    el.className = `status-message visible ${type}`;
  }

  private hideStatus(): void {
    const el = this.shadow.getElementById("status-message")!;
    el.textContent = "";
    el.className = "status-message";
  }

  private announce(message: string): void {
    const liveRegion = this.shadow.getElementById("live-region")!;
    liveRegion.textContent = message;
  }
}
