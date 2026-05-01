/**
 * `<commander-search>` Web Component — Magical Glowing Theme
 *
 * Search for and select a Commander. Styled with a magical glowing aesthetic.
 */

import type { Card, Color } from "../models/card.js";
import type { ScryfallAdapter, ScryfallSearchResult } from "../data/scryfall-adapter.js";
import { dispatch } from "../utils/event-bus.js";

const COLOR_MAP: Record<Color | "Colorless", { label: string; cssColor: string }> = {
  W: { label: "White", cssColor: "var(--color-mana-white, #f9faf4)" },
  U: { label: "Blue", cssColor: "var(--color-mana-blue, #0e68ab)" },
  B: { label: "Black", cssColor: "var(--color-mana-black, #150b00)" },
  R: { label: "Red", cssColor: "var(--color-mana-red, #d3202a)" },
  G: { label: "Green", cssColor: "var(--color-mana-green, #00733e)" },
  Colorless: { label: "Colorless", cssColor: "var(--color-mana-colorless, #ccc2c0)" },
};

const template = document.createElement("template");
template.innerHTML = `
<style>
  :host {
    display: block;
    font-family: 'Crimson Text', Georgia, serif;
    color: #e8e0f0;
  }

  * { box-sizing: border-box; }

  .search-container { padding: 20px; }

  h2 {
    margin: 0 0 14px 0;
    font-family: 'Cinzel', Georgia, serif;
    font-size: 1.1rem;
    font-weight: 600;
    color: #f0d078;
    letter-spacing: 0.04em;
    text-shadow: 0 1px 3px rgba(0,0,0,0.4);
  }

  /* Ornamental divider */
  .divider {
    text-align: center;
    color: #2a2840;
    font-size: 0.8rem;
    letter-spacing: 0.4em;
    margin: 4px 0 14px;
    user-select: none;
  }

  /* Search input */
  input[type="search"] {
    width: 100%;
    padding: 12px 16px;
    font-family: 'Crimson Text', Georgia, serif;
    font-size: 1rem;
    border: 1px solid #2a2840;
    border-radius: 6px;
    background: rgba(15,14,26,0.7);
    color: #e8e0f0;
    outline: none;
    min-height: 44px;
    transition: border-color 0.3s, box-shadow 0.3s;
  }

  input[type="search"]:focus {
    border-color: #d4a843;
    box-shadow: 0 0 12px rgba(139,92,246,0.15);
  }

  input[type="search"]::placeholder {
    color: #6b6580;
    font-style: italic;
  }

  .search-input-wrapper { margin-bottom: 16px; }

  /* Loading */
  .loading-indicator {
    display: none;
    text-align: center;
    padding: 24px;
    color: #a09ab0;
    font-style: italic;
  }

  .loading-indicator.visible { display: block; }

  .loading-spinner {
    display: inline-block;
    width: 24px;
    height: 24px;
    border: 3px solid #2a2840;
    border-top-color: #d4a843;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 8px;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* Error */
  .error-message {
    display: none;
    padding: 12px 16px;
    margin-bottom: 16px;
    background: rgba(249,115,22,0.1);
    border: 1px solid #4a2020;
    border-radius: 6px;
    color: #fca5a5;
    font-size: 0.9rem;
  }

  .error-message.visible { display: block; }

  /* Results grid */
  .results-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 10px;
  }

  .card-result {
    cursor: pointer;
    border-radius: 8px;
    overflow: hidden;
    background: rgba(30,28,48,0.5);
    border: 2px solid transparent;
    transition: border-color 0.2s, transform 0.15s, box-shadow 0.2s;
    min-height: 44px;
  }

  .card-result:hover,
  .card-result:focus-visible {
    border-color: #d4a843;
    transform: translateY(-3px);
    box-shadow: 0 6px 20px rgba(139,92,246,0.12);
  }

  .card-result img {
    width: 100%;
    display: block;
    border-radius: 6px 6px 0 0;
    aspect-ratio: 488 / 680;
    object-fit: cover;
    background: #0f0e1a;
  }

  .card-result .card-info { padding: 6px 8px; }

  .card-result .card-name {
    font-family: 'Cinzel', Georgia, serif;
    font-size: 0.7rem;
    font-weight: 600;
    color: #f0d078;
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-result .card-type {
    font-size: 0.65rem;
    color: #6b6580;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-style: italic;
  }

  .color-pips { display: flex; gap: 3px; margin-top: 3px; }

  .color-pip {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 1px solid #2a2840;
    flex-shrink: 0;
  }

  /* Selected commander */
  .selected-commander {
    display: none;
    padding: 14px;
    margin-bottom: 14px;
    background: rgba(139,92,246,0.08);
    border: 1px solid #2a2840;
    border-radius: 8px;
    position: relative;
  }

  .selected-commander::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 8px;
    border: 1px solid rgba(139,92,246,0.12);
    pointer-events: none;
  }

  .selected-commander.visible {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }

  .selected-commander img {
    width: 100px;
    border-radius: 6px;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  }

  .selected-commander .commander-details { flex: 1; min-width: 0; }

  .selected-commander .commander-label {
    font-family: 'Cinzel', Georgia, serif;
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #d4a843;
    margin-bottom: 2px;
  }

  .selected-commander .commander-name {
    font-family: 'Cinzel', Georgia, serif;
    font-size: 1rem;
    font-weight: 700;
    color: #f0d078;
    margin-bottom: 2px;
  }

  .selected-commander .commander-type {
    font-size: 0.85rem;
    color: #a09ab0;
    font-style: italic;
    margin-bottom: 6px;
  }

  .selected-commander .color-identity-label {
    font-size: 0.7rem;
    color: #6b6580;
    margin-bottom: 3px;
  }

  .btn-change {
    margin-top: 8px;
    padding: 6px 14px;
    font-family: 'Crimson Text', Georgia, serif;
    font-size: 0.8rem;
    background: rgba(42,40,64,0.5);
    border: 1px solid #2a2840;
    border-radius: 6px;
    color: #a09ab0;
    cursor: pointer;
    min-height: 32px;
    transition: background 0.2s, border-color 0.2s;
  }

  .btn-change:hover {
    background: rgba(42,40,64,0.8);
    border-color: #d4a843;
  }

  .no-results {
    display: none;
    text-align: center;
    padding: 24px;
    color: #6b6580;
    font-style: italic;
  }

  .no-results.visible { display: block; }

  .img-placeholder {
    width: 100%;
    aspect-ratio: 488 / 680;
    background: #151422;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-size: 0.7rem;
    color: #6b6580;
    padding: 8px;
    border-radius: 6px 6px 0 0;
  }

  @media (max-width: 767px) {
    .results-grid {
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    }

    .selected-commander.visible {
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .selected-commander img { width: 140px; }
  }
</style>

<div class="search-container" role="search" aria-label="Commander search">
  <h2>⚔ Choose Your Commander</h2>
  <div class="divider">✦ ✦ ✦</div>

  <div class="selected-commander" id="selected-commander" aria-live="polite">
    <img id="commander-img" src="" alt="" />
    <div class="commander-details">
      <div class="commander-label">Commander</div>
      <div class="commander-name" id="commander-name"></div>
      <div class="commander-type" id="commander-type"></div>
      <div class="color-identity-label">Color Identity</div>
      <div class="color-pips" id="commander-colors"></div>
      <button class="btn-change" id="btn-change">Change Commander</button>
    </div>
  </div>

  <div class="search-input-wrapper" id="search-wrapper">
    <input type="search" id="search-input"
      placeholder="Search for a legendary creature..."
      aria-label="Search for a commander" autocomplete="off" />
  </div>

  <div class="error-message" id="error-message" role="alert"></div>

  <div class="loading-indicator" id="loading-indicator">
    <div class="loading-spinner"></div>
    <div>Consulting the archives...</div>
  </div>

  <div class="no-results" id="no-results">
    No commanders found in the archives. Try a different name.
  </div>

  <div class="results-grid" id="results-grid" role="list" aria-label="Commander search results"></div>
</div>
`;

export class CommanderSearch extends HTMLElement {
  private shadow: ShadowRoot;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _scryfallAdapter: ScryfallAdapter | null = null;
  private _selectedCommander: Card | null = null;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: "open" });
    this.shadow.appendChild(template.content.cloneNode(true));
  }

  set scryfallAdapter(adapter: ScryfallAdapter) { this._scryfallAdapter = adapter; }
  get scryfallAdapter(): ScryfallAdapter | null { return this._scryfallAdapter; }

  connectedCallback(): void {
    this.shadow.getElementById("search-input")!.addEventListener("input", this.handleInput);
    this.shadow.getElementById("btn-change")!.addEventListener("click", () => {
      this._selectedCommander = null;
      this.shadow.getElementById("selected-commander")!.classList.remove("visible");
      this.shadow.getElementById("search-wrapper")!.style.display = "";
      const input = this.shadow.getElementById("search-input") as HTMLInputElement;
      input.value = "";
      input.focus();
    });
  }

  disconnectedCallback(): void {
    this.shadow.getElementById("search-input")?.removeEventListener("input", this.handleInput);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  private handleInput = (): void => {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    const input = this.shadow.getElementById("search-input") as HTMLInputElement;
    const query = input.value.trim();
    if (query.length < 2) { this.clearResults(); this.hideError(); this.hideLoading(); this.hideNoResults(); return; }
    this.debounceTimer = setTimeout(() => this.performSearch(query), 300);
  };

  private async performSearch(query: string): Promise<void> {
    if (!this._scryfallAdapter) { this.showError("Search is not available."); return; }
    this.hideError(); this.hideNoResults(); this.clearResults(); this.showLoading();
    let result: ScryfallSearchResult;
    try { result = await this._scryfallAdapter.searchCommanders(query); }
    catch (err: unknown) { this.hideLoading(); this.showError(err instanceof Error ? err.message : "Search temporarily unavailable."); return; }
    this.hideLoading();
    if (result.cards.length === 0) { this.showNoResults(); return; }
    this.renderResults(result.cards);
  }

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
      const imageHtml = imageUri
        ? `<img src="${this.esc(imageUri)}" alt="${this.esc(card.name)}" loading="lazy" />`
        : `<div class="img-placeholder">${this.escHtml(card.name)}</div>`;
      item.innerHTML = `${imageHtml}<div class="card-info"><div class="card-name" title="${this.esc(card.name)}">${this.escHtml(card.name)}</div><div class="card-type" title="${this.esc(card.typeLine)}">${this.escHtml(card.typeLine)}</div><div class="color-pips">${this.renderColorPips(card.colorIdentity)}</div></div>`;
      const img = item.querySelector("img");
      if (img) img.addEventListener("error", () => { const p = document.createElement("div"); p.className = "img-placeholder"; p.textContent = card.name; img.replaceWith(p); });
      const select = (): void => this.selectCommander(card);
      item.addEventListener("click", select);
      item.addEventListener("keydown", (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(); } });
      grid.appendChild(item);
    }
  }

  private renderColorPips(colors: Color[]): string {
    if (colors.length === 0) { const i = COLOR_MAP.Colorless; return `<span class="color-pip" style="background:${i.cssColor}" title="${i.label}" aria-label="${i.label}"></span>`; }
    return colors.map((c) => { const i = COLOR_MAP[c] ?? COLOR_MAP.Colorless; return `<span class="color-pip" style="background:${i.cssColor}" title="${i.label}" aria-label="${i.label}"></span>`; }).join("");
  }

  private renderSelectedCommander(card: Card): void {
    const container = this.shadow.getElementById("selected-commander")!;
    const img = this.shadow.getElementById("commander-img") as HTMLImageElement;
    img.src = card.imageUris?.normal ?? card.cardFaces?.[0]?.imageUris?.normal ?? "";
    img.alt = card.name;
    img.onerror = () => { img.style.display = "none"; };
    this.shadow.getElementById("commander-name")!.textContent = card.name;
    this.shadow.getElementById("commander-type")!.textContent = card.typeLine;
    this.shadow.getElementById("commander-colors")!.innerHTML = this.renderColorPips(card.colorIdentity);
    container.classList.add("visible");
    this.shadow.getElementById("search-wrapper")!.style.display = "none";
    this.clearResults(); this.hideNoResults();
  }

  private selectCommander(card: Card): void {
    this._selectedCommander = card;
    this.renderSelectedCommander(card);
    dispatch("commander-changed", { commander: card });
    this.dispatchEvent(new CustomEvent("commander-changed", { detail: { commander: card }, bubbles: true, composed: true }));
  }

  private showLoading(): void { this.shadow.getElementById("loading-indicator")!.classList.add("visible"); }
  private hideLoading(): void { this.shadow.getElementById("loading-indicator")!.classList.remove("visible"); }
  private showError(msg: string): void { const el = this.shadow.getElementById("error-message")!; el.textContent = msg; el.classList.add("visible"); }
  private hideError(): void { const el = this.shadow.getElementById("error-message")!; el.textContent = ""; el.classList.remove("visible"); }
  private showNoResults(): void { this.shadow.getElementById("no-results")!.classList.add("visible"); }
  private hideNoResults(): void { this.shadow.getElementById("no-results")!.classList.remove("visible"); }
  private clearResults(): void { this.shadow.getElementById("results-grid")!.innerHTML = ""; }
  private escHtml(s: string): string { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }
  private esc(s: string): string { return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
}
