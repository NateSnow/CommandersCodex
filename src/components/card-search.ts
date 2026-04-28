/**
 * `<card-search>` Web Component
 *
 * Provides a search interface for finding and adding cards to a Commander deck.
 * Queries the Scryfall API via a ScryfallAdapter, displays results with
 * filter controls, and calls DeckManager.addCard() on selection.
 *
 * Dependencies (set as properties after construction):
 *  - deckManager: DeckManager instance
 *  - scryfallAdapter: ScryfallAdapter instance
 */

import type { Card, Color, ColorIdentity, SearchFilters } from "../models/card.js";
import type { DeckManager } from "../domain/deck-manager.js";
import type { ScryfallAdapter, ScryfallSearchResult } from "../data/scryfall-adapter.js";
import { subscribe } from "../utils/event-bus.js";

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

const ALL_COLORS: Color[] = ["W", "U", "B", "R", "G"];

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
    margin-bottom: 12px;
  }

  input[type="search"],
  input[type="text"],
  input[type="number"] {
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

  input:focus {
    border-color: #7c4dff;
  }

  input::placeholder {
    color: #888;
  }

  /* Filter controls */
  .filters {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 12px;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .filter-group label {
    font-size: 0.75rem;
    color: #aaa;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  select {
    padding: 8px 12px;
    font-size: 0.9rem;
    border: 1px solid #555;
    border-radius: 6px;
    background: #2a2a2a;
    color: #e0e0e0;
    outline: none;
    min-height: 44px;
    cursor: pointer;
  }

  select:focus {
    border-color: #7c4dff;
  }

  .mana-cost-range {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .mana-cost-range input[type="number"] {
    width: 70px;
    padding: 8px;
    font-size: 0.9rem;
    min-height: 44px;
  }

  .mana-cost-range span {
    color: #888;
    font-size: 0.85rem;
  }

  /* Color checkboxes */
  .color-checkboxes {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
  }

  .color-checkbox {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    min-height: 44px;
    min-width: 44px;
    justify-content: center;
  }

  .color-checkbox input[type="checkbox"] {
    width: 20px;
    height: 20px;
    cursor: pointer;
    accent-color: #7c4dff;
  }

  .color-checkbox .color-indicator {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 1px solid #666;
    flex-shrink: 0;
  }

  .keyword-input {
    grid-column: 1 / -1;
  }

  .keyword-input input {
    font-size: 0.9rem;
    padding: 8px 12px;
  }

  /* Loading indicator */
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

  /* Error message */
  .error-message {
    display: none;
    padding: 12px 16px;
    margin-bottom: 12px;
    background: #3d1c1c;
    border: 1px solid #7a2e2e;
    border-radius: 8px;
    color: #f5a5a5;
    font-size: 0.9rem;
  }

  .error-message.visible {
    display: block;
  }

  /* Success feedback */
  .success-message {
    display: none;
    padding: 12px 16px;
    margin-bottom: 12px;
    background: #1e3a1e;
    border: 1px solid #3a7a3a;
    border-radius: 8px;
    color: #a5f5a5;
    font-size: 0.9rem;
  }

  .success-message.visible {
    display: block;
  }

  /* No results */
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

  /* Results list */
  .results-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .card-result {
    display: flex;
    gap: 12px;
    padding: 8px;
    border-radius: 8px;
    background: #2a2a2a;
    border: 2px solid transparent;
    cursor: pointer;
    transition: border-color 0.2s, background 0.15s;
    min-height: 44px;
    align-items: center;
  }

  .card-result:hover,
  .card-result:focus-visible {
    border-color: #7c4dff;
    background: #333;
  }

  .card-result:focus-visible {
    outline: 2px solid #7c4dff;
    outline-offset: 2px;
  }

  .card-result.selected {
    border-color: #7c4dff;
    background: #2d2540;
  }

  .card-result img {
    width: 60px;
    height: 84px;
    object-fit: cover;
    border-radius: 4px;
    flex-shrink: 0;
    background: #1a1a1a;
  }

  .card-result .card-summary {
    flex: 1;
    min-width: 0;
  }

  .card-result .card-name {
    font-size: 0.95rem;
    font-weight: 600;
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-result .card-mana {
    font-size: 0.8rem;
    color: #bbb;
    margin-bottom: 2px;
  }

  .card-result .card-type {
    font-size: 0.8rem;
    color: #999;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .img-placeholder {
    width: 60px;
    height: 84px;
    background: #333;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-size: 0.65rem;
    color: #aaa;
    padding: 4px;
    border-radius: 4px;
    flex-shrink: 0;
  }

  /* Card details panel */
  .card-details {
    display: none;
    padding: 16px;
    margin-bottom: 12px;
    background: #1e1e2e;
    border: 1px solid #444;
    border-radius: 8px;
  }

  .card-details.visible {
    display: block;
  }

  .card-details-header {
    display: flex;
    gap: 16px;
    margin-bottom: 12px;
  }

  .card-details-header img {
    width: 200px;
    border-radius: 8px;
    flex-shrink: 0;
  }

  .card-details-header .img-placeholder-large {
    width: 200px;
    height: 280px;
    background: #333;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-size: 0.9rem;
    color: #aaa;
    padding: 12px;
    border-radius: 8px;
    flex-shrink: 0;
  }

  .card-details-info {
    flex: 1;
    min-width: 0;
  }

  .card-details-info .detail-name {
    font-size: 1.15rem;
    font-weight: 700;
    color: #fff;
    margin-bottom: 4px;
  }

  .card-details-info .detail-type {
    font-size: 0.9rem;
    color: #aaa;
    margin-bottom: 4px;
  }

  .card-details-info .detail-mana {
    font-size: 0.9rem;
    color: #bbb;
    margin-bottom: 8px;
  }

  .card-details-info .detail-oracle {
    font-size: 0.85rem;
    color: #ddd;
    line-height: 1.5;
    margin-bottom: 8px;
    white-space: pre-wrap;
  }

  .card-details-info .detail-pt {
    font-size: 0.9rem;
    color: #ccc;
    margin-bottom: 8px;
  }

  .card-details-info .detail-legality {
    font-size: 0.8rem;
    color: #999;
    margin-bottom: 12px;
  }

  .detail-legality .legal {
    color: #6fbf73;
  }

  .detail-legality .not-legal {
    color: #f5a5a5;
  }

  .btn-add-to-deck {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 20px;
    font-size: 0.95rem;
    font-weight: 600;
    color: #fff;
    background: #7c4dff;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    min-height: 44px;
    min-width: 44px;
    transition: background 0.2s;
  }

  .btn-add-to-deck:hover {
    background: #651fff;
  }

  .btn-add-to-deck:focus-visible {
    outline: 2px solid #7c4dff;
    outline-offset: 2px;
  }

  .btn-add-to-deck:disabled {
    background: #555;
    cursor: not-allowed;
    color: #999;
  }

  .btn-close-details {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 16px;
    font-size: 0.85rem;
    color: #ccc;
    background: #3a3a3a;
    border: 1px solid #555;
    border-radius: 6px;
    cursor: pointer;
    min-height: 44px;
    min-width: 44px;
    margin-left: 8px;
    transition: background 0.2s;
  }

  .btn-close-details:hover {
    background: #4a4a4a;
  }

  .btn-close-details:focus-visible {
    outline: 2px solid #7c4dff;
    outline-offset: 2px;
  }

  .details-actions {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }

  .add-feedback {
    font-size: 0.85rem;
    margin-left: 8px;
  }

  .add-feedback.success {
    color: #6fbf73;
  }

  .add-feedback.error {
    color: #f5a5a5;
  }

  /* Load more button */
  .load-more-wrapper {
    display: none;
    text-align: center;
    padding: 16px 0;
  }

  .load-more-wrapper.visible {
    display: block;
  }

  .btn-load-more {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 24px;
    font-size: 0.9rem;
    font-weight: 600;
    color: #e0e0e0;
    background: #3a3a3a;
    border: 1px solid #555;
    border-radius: 8px;
    cursor: pointer;
    min-height: 44px;
    min-width: 44px;
    transition: background 0.2s;
  }

  .btn-load-more:hover {
    background: #4a4a4a;
  }

  .btn-load-more:focus-visible {
    outline: 2px solid #7c4dff;
    outline-offset: 2px;
  }

  .btn-load-more:disabled {
    background: #333;
    cursor: not-allowed;
    color: #666;
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
    .filters {
      grid-template-columns: 1fr;
    }

    .card-details-header {
      flex-direction: column;
      align-items: center;
    }

    .card-details-header img,
    .card-details-header .img-placeholder-large {
      width: 160px;
      height: auto;
    }

    .card-details-info {
      text-align: center;
    }

    .details-actions {
      justify-content: center;
    }
  }
</style>

<div class="search-container" role="search" aria-label="Card search">
  <h2>Search Cards</h2>

  <div aria-live="polite" id="live-region" class="sr-only"></div>

  <div class="search-input-wrapper">
    <input
      type="search"
      id="search-input"
      placeholder="Search for cards..."
      aria-label="Search for cards"
      autocomplete="off"
    />
  </div>

  <div class="filters" id="filters">
    <div class="filter-group">
      <label for="filter-type">Card Type</label>
      <select id="filter-type" aria-label="Filter by card type">
        <option value="">Any type</option>
        <option value="creature">Creature</option>
        <option value="instant">Instant</option>
        <option value="sorcery">Sorcery</option>
        <option value="artifact">Artifact</option>
        <option value="enchantment">Enchantment</option>
        <option value="planeswalker">Planeswalker</option>
        <option value="land">Land</option>
      </select>
    </div>

    <div class="filter-group">
      <label>Mana Cost</label>
      <div class="mana-cost-range">
        <input type="number" id="filter-min-cmc" min="0" max="20" placeholder="Min" aria-label="Minimum mana cost" />
        <span>to</span>
        <input type="number" id="filter-max-cmc" min="0" max="20" placeholder="Max" aria-label="Maximum mana cost" />
      </div>
    </div>

    <div class="filter-group">
      <label>Colors</label>
      <div class="color-checkboxes" id="color-checkboxes" role="group" aria-label="Filter by color"></div>
    </div>

    <div class="filter-group keyword-input">
      <label for="filter-keyword">Keyword</label>
      <input type="text" id="filter-keyword" placeholder="e.g. flying, trample" aria-label="Filter by keyword ability" />
    </div>
  </div>

  <div class="error-message" id="error-message" role="alert"></div>
  <div class="success-message" id="success-message" role="status"></div>

  <div class="loading-indicator" id="loading-indicator">
    <div class="loading-spinner"></div>
    <div>Searching cards...</div>
  </div>

  <div class="no-results" id="no-results">
    No cards found. Try broadening your search or adjusting filters.
  </div>

  <div class="card-details" id="card-details" aria-label="Card details"></div>

  <div class="results-list" id="results-list" role="list" aria-label="Card search results"></div>

  <div class="load-more-wrapper" id="load-more-wrapper">
    <button class="btn-load-more" id="btn-load-more" aria-label="Load more search results">
      Load More
    </button>
  </div>
</div>
`;


// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export class CardSearch extends HTMLElement {
  private shadow: ShadowRoot;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _deckManager: DeckManager | null = null;
  private _scryfallAdapter: ScryfallAdapter | null = null;
  private _colorIdentity: ColorIdentity = [];
  private _selectedCard: Card | null = null;
  private _nextPageUrl: string | undefined = undefined;
  private _currentResults: Card[] = [];
  private _isLoadingMore = false;
  private _unsubscribeCommander: (() => void) | null = null;
  private _feedbackTimer: ReturnType<typeof setTimeout> | null = null;

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
    // Sync color identity from existing commander
    const commander = dm.getCommander();
    if (commander) {
      this._colorIdentity = [...commander.colorIdentity];
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

    const loadMoreBtn = this.shadow.getElementById("btn-load-more")!;
    loadMoreBtn.addEventListener("click", this.handleLoadMore);

    // Render color checkboxes
    this.renderColorCheckboxes();

    // Subscribe to commander-changed events to update color identity
    this._unsubscribeCommander = subscribe("commander-changed", (event) => {
      this._colorIdentity = [...event.detail.commander.colorIdentity];
    });
  }

  disconnectedCallback(): void {
    const input = this.shadow.getElementById("search-input") as HTMLInputElement;
    input?.removeEventListener("input", this.handleInput);

    const loadMoreBtn = this.shadow.getElementById("btn-load-more");
    loadMoreBtn?.removeEventListener("click", this.handleLoadMore);

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    if (this._feedbackTimer) {
      clearTimeout(this._feedbackTimer);
    }
    if (this._unsubscribeCommander) {
      this._unsubscribeCommander();
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
      this.hideSuccess();
      this.hideLoading();
      this.hideNoResults();
      this.hideDetails();
      this.hideLoadMore();
      return;
    }

    this.debounceTimer = setTimeout(() => {
      this.performSearch(query);
    }, 300);
  };

  private handleLoadMore = async (): Promise<void> => {
    if (!this._scryfallAdapter || !this._nextPageUrl || this._isLoadingMore) {
      return;
    }

    this._isLoadingMore = true;
    const btn = this.shadow.getElementById("btn-load-more") as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = "Loading...";

    try {
      const result = await this._scryfallAdapter.getNextPage(this._nextPageUrl);
      this._currentResults = [...this._currentResults, ...result.cards];
      this._nextPageUrl = result.hasMore ? result.nextPageUrl : undefined;

      this.appendResults(result.cards);

      if (!result.hasMore) {
        this.hideLoadMore();
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load more results. Please try again.";
      this.showError(message);
    } finally {
      this._isLoadingMore = false;
      btn.disabled = false;
      btn.textContent = "Load More";
    }
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
    this.hideSuccess();
    this.hideNoResults();
    this.hideDetails();
    this.hideLoadMore();
    this.clearResults();
    this.showLoading();

    const filters = this.gatherFilters();

    let result: ScryfallSearchResult;
    try {
      result = await this._scryfallAdapter.searchCards(
        query,
        this._colorIdentity,
        filters,
      );
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

    this._currentResults = result.cards;
    this._nextPageUrl = result.hasMore ? result.nextPageUrl : undefined;
    this._selectedCard = null;

    this.renderResults(result.cards);

    if (result.hasMore) {
      this.showLoadMore();
    }
  }

  private gatherFilters(): SearchFilters | undefined {
    const typeSelect = this.shadow.getElementById("filter-type") as HTMLSelectElement;
    const minCmcInput = this.shadow.getElementById("filter-min-cmc") as HTMLInputElement;
    const maxCmcInput = this.shadow.getElementById("filter-max-cmc") as HTMLInputElement;
    const keywordInput = this.shadow.getElementById("filter-keyword") as HTMLInputElement;

    const cardType = typeSelect.value || undefined;
    const minCmc = minCmcInput.value !== "" ? parseInt(minCmcInput.value, 10) : undefined;
    const maxCmc = maxCmcInput.value !== "" ? parseInt(maxCmcInput.value, 10) : undefined;

    // Gather selected color checkboxes
    const colorCheckboxes = this.shadow.querySelectorAll<HTMLInputElement>(
      'input[name="color-filter"]',
    );
    const colors: string[] = [];
    colorCheckboxes.forEach((cb) => {
      if (cb.checked) {
        colors.push(cb.value);
      }
    });

    // Parse keywords (comma-separated)
    const keywordRaw = keywordInput.value.trim();
    const keywords = keywordRaw
      ? keywordRaw.split(",").map((k) => k.trim()).filter((k) => k.length > 0)
      : undefined;

    const hasAnyFilter =
      cardType !== undefined ||
      minCmc !== undefined ||
      maxCmc !== undefined ||
      colors.length > 0 ||
      (keywords && keywords.length > 0);

    if (!hasAnyFilter) {
      return undefined;
    }

    return {
      cardType,
      minCmc,
      maxCmc,
      colors: colors.length > 0 ? colors : undefined,
      keywords,
    };
  }

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------

  private renderColorCheckboxes(): void {
    const container = this.shadow.getElementById("color-checkboxes")!;
    container.innerHTML = "";

    for (const color of ALL_COLORS) {
      const info = COLOR_MAP[color];
      const id = `color-${color}`;

      const label = document.createElement("label");
      label.className = "color-checkbox";
      label.setAttribute("for", id);

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.name = "color-filter";
      checkbox.value = color;
      checkbox.id = id;
      checkbox.setAttribute("aria-label", `Filter by ${info.label}`);

      const indicator = document.createElement("span");
      indicator.className = "color-indicator";
      indicator.style.background = info.cssColor;
      indicator.title = info.label;

      label.appendChild(checkbox);
      label.appendChild(indicator);
      container.appendChild(label);
    }
  }

  private renderResults(cards: Card[]): void {
    const list = this.shadow.getElementById("results-list")!;
    list.innerHTML = "";
    for (const card of cards) {
      list.appendChild(this.createCardResultItem(card));
    }
  }

  private appendResults(cards: Card[]): void {
    const list = this.shadow.getElementById("results-list")!;
    for (const card of cards) {
      list.appendChild(this.createCardResultItem(card));
    }
  }

  private createCardResultItem(card: Card): HTMLElement {
    const item = document.createElement("div");
    item.classList.add("card-result");
    item.setAttribute("role", "listitem");
    item.setAttribute("tabindex", "0");
    item.setAttribute("aria-label", `View details for ${card.name}`);

    const imageUri =
      card.imageUris?.small ?? card.cardFaces?.[0]?.imageUris?.small;

    let imageHtml: string;
    if (imageUri) {
      imageHtml = `<img src="${this.escapeAttr(imageUri)}" alt="${this.escapeAttr(card.name)}" loading="lazy" />`;
    } else {
      imageHtml = `<div class="img-placeholder">${this.escapeHtml(card.name)}</div>`;
    }

    item.innerHTML = `
      ${imageHtml}
      <div class="card-summary">
        <div class="card-name" title="${this.escapeAttr(card.name)}">${this.escapeHtml(card.name)}</div>
        <div class="card-mana">${this.escapeHtml(card.manaCost || "No mana cost")}</div>
        <div class="card-type" title="${this.escapeAttr(card.typeLine)}">${this.escapeHtml(card.typeLine)}</div>
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
    const selectCard = (): void => this.showCardDetails(card);
    item.addEventListener("click", selectCard);
    item.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectCard();
      }
    });

    return item;
  }

  private showCardDetails(card: Card): void {
    this._selectedCard = card;

    // Highlight selected item
    const items = this.shadow.querySelectorAll(".card-result");
    items.forEach((el) => el.classList.remove("selected"));
    // Find the matching item by card name (since items are in order)
    const idx = this._currentResults.findIndex((c) => c.id === card.id);
    if (idx >= 0 && items[idx]) {
      items[idx].classList.add("selected");
    }

    const container = this.shadow.getElementById("card-details")!;

    const imageUri =
      card.imageUris?.normal ?? card.cardFaces?.[0]?.imageUris?.normal;

    let imageHtml: string;
    if (imageUri) {
      imageHtml = `<img src="${this.escapeAttr(imageUri)}" alt="${this.escapeAttr(card.name)}" />`;
    } else {
      imageHtml = `<div class="img-placeholder-large">${this.escapeHtml(card.name)}</div>`;
    }

    // Power/toughness or loyalty
    let ptHtml = "";
    if (card.power !== undefined && card.toughness !== undefined) {
      ptHtml = `<div class="detail-pt">Power/Toughness: ${this.escapeHtml(card.power)}/${this.escapeHtml(card.toughness)}</div>`;
    } else if (card.loyalty !== undefined) {
      ptHtml = `<div class="detail-pt">Loyalty: ${this.escapeHtml(card.loyalty)}</div>`;
    }

    // Legality for Commander
    const commanderLegality = card.legalities["commander"] ?? "unknown";
    const legalityClass = commanderLegality === "legal" ? "legal" : "not-legal";
    const legalityText = commanderLegality === "legal" ? "Legal" : this.escapeHtml(commanderLegality);

    container.innerHTML = `
      <div class="card-details-header">
        ${imageHtml}
        <div class="card-details-info">
          <div class="detail-name">${this.escapeHtml(card.name)}</div>
          <div class="detail-type">${this.escapeHtml(card.typeLine)}</div>
          <div class="detail-mana">${this.escapeHtml(card.manaCost || "No mana cost")}</div>
          <div class="detail-oracle">${this.escapeHtml(card.oracleText || "No oracle text")}</div>
          ${ptHtml}
          <div class="detail-legality">Commander: <span class="${legalityClass}">${legalityText}</span></div>
          <div class="details-actions">
            <button class="btn-add-to-deck" id="btn-add-to-deck" aria-label="Add ${this.escapeAttr(card.name)} to deck">Add to Deck</button>
            <button class="btn-close-details" id="btn-close-details" aria-label="Close card details">Close</button>
            <span class="add-feedback" id="add-feedback" role="status"></span>
          </div>
        </div>
      </div>
    `;

    // Handle broken detail image
    const img = container.querySelector("img");
    if (img) {
      img.addEventListener("error", () => {
        const placeholder = document.createElement("div");
        placeholder.className = "img-placeholder-large";
        placeholder.textContent = card.name;
        img.replaceWith(placeholder);
      });
    }

    // Wire up Add to Deck button
    const addBtn = this.shadow.getElementById("btn-add-to-deck")!;
    addBtn.addEventListener("click", () => this.addCardToDeck(card));

    // Wire up Close button
    const closeBtn = this.shadow.getElementById("btn-close-details")!;
    closeBtn.addEventListener("click", () => {
      this.hideDetails();
      this._selectedCard = null;
      // Remove selected highlight
      const allItems = this.shadow.querySelectorAll(".card-result");
      allItems.forEach((el) => el.classList.remove("selected"));
    });

    container.classList.add("visible");

    // Scroll details into view
    container.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  private addCardToDeck(card: Card): void {
    if (!this._deckManager) {
      this.showAddFeedback("Deck manager not configured.", true);
      return;
    }

    const result = this._deckManager.addCard(card);

    if (!result.ok) {
      this.showAddFeedback(result.error.message, true);
      return;
    }

    this.showAddFeedback(`${card.name} added to deck!`, false);

    // Announce to screen readers
    const liveRegion = this.shadow.getElementById("live-region")!;
    liveRegion.textContent = `${card.name} added to deck.`;
  }

  private showAddFeedback(message: string, isError: boolean): void {
    const feedback = this.shadow.getElementById("add-feedback");
    if (!feedback) return;

    feedback.textContent = message;
    feedback.className = `add-feedback ${isError ? "error" : "success"}`;

    if (this._feedbackTimer) {
      clearTimeout(this._feedbackTimer);
    }

    this._feedbackTimer = setTimeout(() => {
      feedback.textContent = "";
      feedback.className = "add-feedback";
    }, 3000);
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

  private showSuccess(message: string): void {
    const el = this.shadow.getElementById("success-message")!;
    el.textContent = message;
    el.classList.add("visible");
  }

  private hideSuccess(): void {
    const el = this.shadow.getElementById("success-message")!;
    el.textContent = "";
    el.classList.remove("visible");
  }

  private showNoResults(): void {
    this.shadow.getElementById("no-results")!.classList.add("visible");
  }

  private hideNoResults(): void {
    this.shadow.getElementById("no-results")!.classList.remove("visible");
  }

  private showLoadMore(): void {
    this.shadow.getElementById("load-more-wrapper")!.classList.add("visible");
  }

  private hideLoadMore(): void {
    this.shadow.getElementById("load-more-wrapper")!.classList.remove("visible");
  }

  private hideDetails(): void {
    const el = this.shadow.getElementById("card-details")!;
    el.classList.remove("visible");
    el.innerHTML = "";
  }

  private clearResults(): void {
    this.shadow.getElementById("results-list")!.innerHTML = "";
    this._currentResults = [];
    this._nextPageUrl = undefined;
    this._selectedCard = null;
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
