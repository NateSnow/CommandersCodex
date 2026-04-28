/**
 * `<commander-search>` Web Component
 *
 * Provides a search interface for finding and selecting a Commander.
 * Queries the Scryfall API via a ScryfallAdapter, displays results in
 * a card grid, and calls DeckManager.setCommander() on selection.
 *
 * Dependencies (set as properties after construction):
 *  - deckManager: DeckManager instance
 *  - scryfallAdapter: ScryfallAdapter instance
 */

import type { Card, Color } from "../models/card.js";
import type { DeckManager } from "../domain/deck-manager.js";
import type { ScryfallAdapter, ScryfallSearchResult } from "../data/scryfall-adapter.js";

// ---------------------------------------------------------------------------
// Color-to-CSS mapping
// ---------------------------------------------------------------------------

const COLOR_MAP: Record<Color | "Colorless", { label: string; cssColor: string }> = {
  W: { label: "White", cssColor: "#f9faf4" },
  U: { label: "Blue", cssColor: "#0e68ab" },
  B: { label: "Black", cssColor: "#150b00" },
  R: { label: "Red", cssColor: "#d3202a" },
  G: { label: "Green", cssColor: "#00733e" },
  Colorless: { label: "Colorless", cssColor: "#ccc2c0" },
};

// ---------------------------------------------------------------------------
// Component
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

  .search-container {
    padding: 16px;
  }

  h2 {
    margin: 0 0 12px 0;
    font-size: 1.25rem;
    color: #fff;
  }

  .search-input-wrapper {
    position: relative;
    margin-bottom: 16px;
  }

  input[type="search"] {
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

  input[type="search"]:focus {
    border-color: #7c4dff;
  }

  input[type="search"]::placeholder {
    color: #888;
  }

  .loading-indicator {
    display: none;
    text-align: center;
    padding: 24px;
    color: #aaa;
    font-size: 0.95rem;
  }

  .loading-indicator.visible {
    display: block;
  }

  .loading-spinner {
    display: inline-block;
    width: 24px;
    height: 24px;
    border: 3px solid #555;
    border-top-color: #7c4dff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 8px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-message {
    display: none;
    padding: 12px 16px;
    margin-bottom: 16px;
    background: #3d1c1c;
    border: 1px solid #7a2e2e;
    border-radius: 8px;
    color: #f5a5a5;
    font-size: 0.9rem;
  }

  .error-message.visible {
    display: block;
  }

  .results-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 16px;
  }

  .card-result {
    cursor: pointer;
    border-radius: 8px;
    overflow: hidden;
    background: #2a2a2a;
    border: 2px solid transparent;
    transition: border-color 0.2s, transform 0.15s;
    min-height: 44px;
    min-width: 44px;
  }

  .card-result:hover,
  .card-result:focus-visible {
    border-color: #7c4dff;
    transform: translateY(-2px);
  }

  .card-result:focus-visible {
    outline: 2px solid #7c4dff;
    outline-offset: 2px;
  }

  .card-result img {
    width: 100%;
    display: block;
    border-radius: 6px 6px 0 0;
    aspect-ratio: 488 / 680;
    object-fit: cover;
    background: #1a1a1a;
  }

  .card-result .card-info {
    padding: 8px;
  }

  .card-result .card-name {
    font-size: 0.85rem;
    font-weight: 600;
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-result .card-type {
    font-size: 0.75rem;
    color: #999;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .color-pips {
    display: flex;
    gap: 4px;
    margin-top: 4px;
  }

  .color-pip {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 1px solid #666;
    flex-shrink: 0;
  }

  /* Selected commander display */
  .selected-commander {
    display: none;
    padding: 16px;
    margin-bottom: 16px;
    background: #1e2a1e;
    border: 1px solid #3a5a3a;
    border-radius: 8px;
  }

  .selected-commander.visible {
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }

  .selected-commander img {
    width: 120px;
    border-radius: 6px;
    flex-shrink: 0;
  }

  .selected-commander .commander-details {
    flex: 1;
    min-width: 0;
  }

  .selected-commander .commander-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #7c4dff;
    margin-bottom: 4px;
  }

  .selected-commander .commander-name {
    font-size: 1.1rem;
    font-weight: 700;
    color: #fff;
    margin-bottom: 4px;
  }

  .selected-commander .commander-type {
    font-size: 0.85rem;
    color: #aaa;
    margin-bottom: 8px;
  }

  .selected-commander .color-identity-label {
    font-size: 0.75rem;
    color: #aaa;
    margin-bottom: 4px;
  }

  .no-results {
    display: none;
    text-align: center;
    padding: 24px;
    color: #888;
    font-size: 0.9rem;
  }

  .no-results.visible {
    display: block;
  }

  .img-placeholder {
    width: 100%;
    aspect-ratio: 488 / 680;
    background: #333;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-size: 0.8rem;
    color: #aaa;
    padding: 8px;
    border-radius: 6px 6px 0 0;
  }

  @media (max-width: 767px) {
    .results-grid {
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 12px;
    }

    .selected-commander.visible {
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .selected-commander img {
      width: 160px;
    }
  }
</style>

<div class="search-container" role="search" aria-label="Commander search">
  <h2>Select a Commander</h2>

  <div class="selected-commander" id="selected-commander" aria-live="polite">
    <img id="commander-img" src="" alt="" />
    <div class="commander-details">
      <div class="commander-label">Commander</div>
      <div class="commander-name" id="commander-name"></div>
      <div class="commander-type" id="commander-type"></div>
      <div class="color-identity-label">Color Identity</div>
      <div class="color-pips" id="commander-colors"></div>
    </div>
  </div>

  <div class="search-input-wrapper">
    <input
      type="search"
      id="search-input"
      placeholder="Search for a commander..."
      aria-label="Search for a commander"
      autocomplete="off"
    />
  </div>

  <div class="error-message" id="error-message" role="alert"></div>

  <div class="loading-indicator" id="loading-indicator">
    <div class="loading-spinner"></div>
    <div>Searching commanders...</div>
  </div>

  <div class="no-results" id="no-results">
    No commanders found. Try a different search term.
  </div>

  <div class="results-grid" id="results-grid" role="list" aria-label="Commander search results"></div>
</div>
`;

export class CommanderSearch extends HTMLElement {
  private shadow: ShadowRoot;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _deckManager: DeckManager | null = null;
  private _scryfallAdapter: ScryfallAdapter | null = null;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: "open" });
    this.shadow.appendChild(template.content.cloneNode(true));
  }

  // -----------------------------------------------------------------------
  // Dependency injection via properties
  // -----------------------------------------------------------------------

  set deckManager(dm: DeckManager) {
    this._deckManager = dm;
    // If the deck manager already has a commander, show it
    const existing = dm.getCommander();
    if (existing) {
      this.renderSelectedCommander(existing);
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
    const input = this.shadow.getElementById("search-input") as HTMLInputElement;
    input.addEventListener("input", this.handleInput);
  }

  disconnectedCallback(): void {
    const input = this.shadow.getElementById("search-input") as HTMLInputElement;
    input?.removeEventListener("input", this.handleInput);
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }

  // -----------------------------------------------------------------------
  // Event handlers
  // -----------------------------------------------------------------------

  private handleInput = (): void => {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    const input = this.shadow.getElementById("search-input") as HTMLInputElement;
    const query = input.value.trim();

    if (query.length < 2) {
      this.clearResults();
      this.hideError();
      this.hideLoading();
      this.hideNoResults();
      return;
    }

    this.debounceTimer = setTimeout(() => {
      this.performSearch(query);
    }, 300);
  };

  // -----------------------------------------------------------------------
  // Search logic
  // -----------------------------------------------------------------------

  private async performSearch(query: string): Promise<void> {
    if (!this._scryfallAdapter) {
      this.showError("Search is not available. Scryfall adapter not configured.");
      return;
    }

    this.hideError();
    this.hideNoResults();
    this.clearResults();
    this.showLoading();

    let result: ScryfallSearchResult;
    try {
      result = await this._scryfallAdapter.searchCommanders(query);
    } catch (err: unknown) {
      this.hideLoading();
      const message =
        err instanceof Error
          ? err.message
          : "Card search is temporarily unavailable. Please try again in a moment.";
      this.showError(message);
      return;
    }

    this.hideLoading();

    if (result.cards.length === 0) {
      this.showNoResults();
      return;
    }

    this.renderResults(result.cards);
  }

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------

  private renderResults(cards: Card[]): void {
    const grid = this.shadow.getElementById("results-grid")!;
    grid.innerHTML = "";

    for (const card of cards) {
      const item = document.createElement("div");
      item.classList.add("card-result");
      item.setAttribute("role", "listitem");
      item.setAttribute("tabindex", "0");
      item.setAttribute("aria-label", `Select ${card.name} as commander`);

      const imageUri = card.imageUris?.normal ?? card.cardFaces?.[0]?.imageUris?.normal;

      let imageHtml: string;
      if (imageUri) {
        imageHtml = `<img src="${this.escapeAttr(imageUri)}" alt="${this.escapeAttr(card.name)}" loading="lazy" />`;
      } else {
        imageHtml = `<div class="img-placeholder">${this.escapeHtml(card.name)}</div>`;
      }

      const colorPips = this.renderColorPips(card.colorIdentity);

      item.innerHTML = `
        ${imageHtml}
        <div class="card-info">
          <div class="card-name" title="${this.escapeAttr(card.name)}">${this.escapeHtml(card.name)}</div>
          <div class="card-type" title="${this.escapeAttr(card.typeLine)}">${this.escapeHtml(card.typeLine)}</div>
          <div class="color-pips">${colorPips}</div>
        </div>
      `;

      // Handle broken images
      const img = item.querySelector("img");
      if (img) {
        img.addEventListener("error", () => {
          const placeholder = document.createElement("div");
          placeholder.className = "img-placeholder";
          placeholder.textContent = card.name;
          img.replaceWith(placeholder);
        });
      }

      // Selection handlers
      const selectCard = (): void => this.selectCommander(card);
      item.addEventListener("click", selectCard);
      item.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectCard();
        }
      });

      grid.appendChild(item);
    }
  }

  private renderColorPips(colors: Color[]): string {
    if (colors.length === 0) {
      const info = COLOR_MAP.Colorless;
      return `<span class="color-pip" style="background:${info.cssColor}" title="${info.label}" aria-label="${info.label}"></span>`;
    }
    return colors
      .map((c) => {
        const info = COLOR_MAP[c] ?? COLOR_MAP.Colorless;
        return `<span class="color-pip" style="background:${info.cssColor}" title="${info.label}" aria-label="${info.label}"></span>`;
      })
      .join("");
  }

  private renderSelectedCommander(card: Card): void {
    const container = this.shadow.getElementById("selected-commander")!;
    const img = this.shadow.getElementById("commander-img") as HTMLImageElement;
    const nameEl = this.shadow.getElementById("commander-name")!;
    const typeEl = this.shadow.getElementById("commander-type")!;
    const colorsEl = this.shadow.getElementById("commander-colors")!;

    const imageUri = card.imageUris?.normal ?? card.cardFaces?.[0]?.imageUris?.normal ?? "";
    img.src = imageUri;
    img.alt = card.name;

    img.onerror = () => {
      img.style.display = "none";
    };

    nameEl.textContent = card.name;
    typeEl.textContent = card.typeLine;
    colorsEl.innerHTML = this.renderColorPips(card.colorIdentity);

    container.classList.add("visible");
  }

  // -----------------------------------------------------------------------
  // Commander selection
  // -----------------------------------------------------------------------

  private selectCommander(card: Card): void {
    if (!this._deckManager) {
      this.showError("Deck manager not configured.");
      return;
    }

    const result = this._deckManager.setCommander(card);

    if (!result.ok) {
      this.showError(result.error.message);
      return;
    }

    this.renderSelectedCommander(card);
    this.clearResults();
    this.hideNoResults();

    // Clear the search input
    const input = this.shadow.getElementById("search-input") as HTMLInputElement;
    input.value = "";

    // Dispatch commander-changed event on the host element
    this.dispatchEvent(
      new CustomEvent("commander-changed", {
        detail: { commander: card },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // -----------------------------------------------------------------------
  // UI helpers
  // -----------------------------------------------------------------------

  private showLoading(): void {
    this.shadow.getElementById("loading-indicator")!.classList.add("visible");
  }

  private hideLoading(): void {
    this.shadow.getElementById("loading-indicator")!.classList.remove("visible");
  }

  private showError(message: string): void {
    const el = this.shadow.getElementById("error-message")!;
    el.textContent = message;
    el.classList.add("visible");
  }

  private hideError(): void {
    const el = this.shadow.getElementById("error-message")!;
    el.textContent = "";
    el.classList.remove("visible");
  }

  private showNoResults(): void {
    this.shadow.getElementById("no-results")!.classList.add("visible");
  }

  private hideNoResults(): void {
    this.shadow.getElementById("no-results")!.classList.remove("visible");
  }

  private clearResults(): void {
    this.shadow.getElementById("results-grid")!.innerHTML = "";
  }

  // -----------------------------------------------------------------------
  // Escaping utilities
  // -----------------------------------------------------------------------

  private escapeHtml(str: string): string {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  private escapeAttr(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
