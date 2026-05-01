/**
 * `<deck-view>` Web Component — Moxfield-style list + Spellbook Theme
 *
 * Displays the generated deck in a Moxfield-inspired layout:
 * - Commander card image with deck info header
 * - Cards grouped by type in collapsible text-list sections
 * - Each card row: quantity, name, mana cost — with hover image preview
 * - Stats bar: type distribution, avg CMC, mana curve
 * - Export options
 *
 * Spellbook-themed with parchment tones, ornate typography, and warm accents.
 */

import type { Card, Color } from "../models/card.js";
import type { Deck, DeckEntry, CardCategory } from "../models/deck.js";
import type { GenerationResult } from "../models/generation.js";
import { ARCHETYPE_INFO, BRACKET_INFO } from "../models/generation.js";
import { toText, toMTGO } from "../domain/export-formatter.js";
import { getAverageCmc, getManaCurve } from "../domain/statistics-calculator.js";
import { subscribe } from "../utils/event-bus.js";

const CATEGORY_ORDER: readonly CardCategory[] = [
  "Commander", "Planeswalker", "Creature", "Instant", "Sorcery",
  "Artifact", "Enchantment", "Ramp", "Removal", "Card Draw",
  "Protection", "Land", "Custom",
] as const;

const MANA_SYMBOLS: Record<string, string> = {
  W: "⚪", U: "🔵", B: "⚫", R: "🔴", G: "🟢",
};

const template = document.createElement("template");

template.innerHTML = `
<style>
  :host {
    display: block;
    font-family: 'Crimson Text', Georgia, serif;
    color: #f4e8c1;
  }

  * { box-sizing: border-box; }

  .deck-view { padding: 20px; position: relative; }

  /* ---- Empty state ---- */
  .empty-state {
    text-align: center;
    padding: 80px 20px;
    color: #5c4033;
  }

  .empty-state .icon { font-size: 4rem; margin-bottom: 16px; opacity: 0.6; }

  .empty-state h3 {
    margin: 0 0 8px 0;
    font-family: 'Cinzel', Georgia, serif;
    color: #8b7355;
    font-size: 1.2rem;
  }

  .empty-state p { margin: 0; font-size: 0.95rem; font-style: italic; color: #5c4033; }

  /* ---- Progress ---- */
  .progress-section {
    display: none;
    padding: 40px 24px;
    text-align: center;
  }

  .progress-section.visible { display: block; }

  .progress-phase {
    font-family: 'Cinzel', Georgia, serif;
    font-size: 1rem;
    font-weight: 600;
    color: #e8d48b;
    margin-bottom: 14px;
  }

  .progress-bar-track {
    width: 100%;
    max-width: 400px;
    height: 8px;
    background: #3d2b1f;
    border-radius: 4px;
    overflow: hidden;
    margin: 0 auto 8px;
    border: 1px solid #5c4033;
  }

  .progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #8b6914, #c9a84c, #e8d48b);
    border-radius: 4px;
    transition: width 0.4s ease;
    width: 0%;
  }

  .progress-percent { font-size: 0.8rem; color: #8b7355; }

  /* ---- Error ---- */
  .error-section {
    display: none;
    padding: 16px;
    background: rgba(196,77,42,0.1);
    border: 1px solid #6a2a2a;
    border-radius: 8px;
    margin-bottom: 16px;
  }

  .error-section.visible { display: block; }
  .error-section p { margin: 0; color: #e8a090; font-size: 0.9rem; }

  /* ---- Deck header ---- */
  .deck-header { display: none; margin-bottom: 20px; }
  .deck-header.visible { display: block; }

  .deck-meta {
    display: flex;
    gap: 20px;
    align-items: flex-start;
    margin-bottom: 16px;
  }

  .commander-image {
    width: 200px;
    flex-shrink: 0;
  }

  .commander-image img {
    width: 100%;
    border-radius: 10px;
    display: block;
    box-shadow: 0 6px 24px rgba(0,0,0,0.5), 0 0 30px rgba(201,168,76,0.08);
  }

  .deck-info { flex: 1; min-width: 0; }

  .deck-name {
    font-family: 'Cinzel', Georgia, serif;
    font-size: 1.4rem;
    font-weight: 700;
    color: #e8d48b;
    margin: 0 0 6px 0;
    text-shadow: 0 2px 4px rgba(0,0,0,0.4);
  }

  .deck-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }

  .tag {
    padding: 3px 10px;
    border-radius: 4px;
    font-family: 'Cinzel', Georgia, serif;
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    background: rgba(201,168,76,0.1);
    color: #c9a84c;
    border: 1px solid rgba(201,168,76,0.3);
  }

  /* Stats bar — Moxfield style */
  .stats-bar {
    display: flex;
    gap: 2px;
    margin-bottom: 14px;
    border-radius: 6px;
    overflow: hidden;
    height: 28px;
    background: #2c1810;
    border: 1px solid #5c4033;
  }

  .stats-bar-segment {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 600;
    color: #1a0f0a;
    min-width: 24px;
    transition: flex 0.3s;
    position: relative;
  }

  .stats-bar-segment .seg-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 0 4px;
    font-size: 0.65rem;
  }

  .stats-numbers {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }

  .stat { text-align: center; }

  .stat-value {
    font-family: 'Cinzel', Georgia, serif;
    font-size: 1.1rem;
    font-weight: 700;
    color: #e8d48b;
  }

  .stat-label {
    font-size: 0.65rem;
    color: #8b7355;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Mana curve mini chart */
  .mana-curve {
    display: flex;
    align-items: flex-end;
    gap: 3px;
    height: 50px;
    margin-bottom: 14px;
    padding: 4px 0;
  }

  .curve-bar-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
  }

  .curve-bar {
    width: 100%;
    max-width: 24px;
    background: linear-gradient(180deg, #c9a84c, #8b6914);
    border-radius: 2px 2px 0 0;
    min-height: 2px;
    margin-top: auto;
    transition: height 0.3s;
  }

  .curve-label {
    font-size: 0.55rem;
    color: #8b7355;
    margin-top: 2px;
  }

  .curve-count {
    font-size: 0.55rem;
    color: #c9a84c;
    margin-bottom: 2px;
  }

  /* Combo info */
  .combo-info {
    display: none;
    padding: 12px;
    background: rgba(107,62,35,0.15);
    border: 1px solid #5c4033;
    border-radius: 6px;
    margin-bottom: 14px;
  }

  .combo-info.visible { display: block; }

  .combo-info h4 {
    margin: 0 0 4px 0;
    font-family: 'Cinzel', Georgia, serif;
    font-size: 0.85rem;
    color: #c9a84c;
  }

  .combo-info p { margin: 0; font-size: 0.8rem; color: #c4a882; font-style: italic; }
  .combo-cards { font-size: 0.85rem; color: #e8d48b; margin-top: 4px; }

  /* Warnings */
  .warnings { display: none; margin-bottom: 14px; }
  .warnings.visible { display: block; }

  .warning-item {
    padding: 6px 10px;
    background: rgba(201,168,76,0.08);
    border: 1px solid rgba(201,168,76,0.2);
    border-radius: 4px;
    font-size: 0.8rem;
    color: #c9a84c;
    margin-bottom: 4px;
    font-style: italic;
  }

  /* Action buttons */
  .actions { display: none; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
  .actions.visible { display: flex; }

  .btn {
    padding: 8px 16px;
    font-family: 'Crimson Text', Georgia, serif;
    font-size: 0.85rem;
    font-weight: 600;
    border: 1px solid #5c4033;
    border-radius: 6px;
    cursor: pointer;
    min-height: 40px;
    transition: background 0.2s, border-color 0.2s;
    background: rgba(61,43,31,0.5);
    color: #c4a882;
  }

  .btn:hover { background: rgba(61,43,31,0.8); border-color: #7a6652; }
  .btn:focus-visible { outline: 2px solid #c9a84c; outline-offset: 2px; }

  .btn-primary {
    background: linear-gradient(180deg, #e8d48b 0%, #c9a84c 100%);
    border-color: #8b6914;
    color: #1a0f0a;
    font-family: 'Cinzel', Georgia, serif;
    text-shadow: 0 1px 0 rgba(255,255,255,0.2);
  }

  .btn-primary:hover { background: linear-gradient(180deg, #f0dc9b 0%, #d4b45c 100%); }

  .copy-feedback {
    font-size: 0.8rem;
    color: #6b8e23;
    align-self: center;
    display: none;
    font-style: italic;
  }

  .copy-feedback.visible { display: inline; }

  /* ---- Moxfield-style card list sections ---- */
  .category-section { margin-bottom: 4px; }

  .category-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    cursor: pointer;
    user-select: none;
    border-radius: 4px;
    transition: background 0.15s;
  }

  .category-header:hover { background: rgba(92,64,51,0.3); }
  .category-header:focus-visible { outline: 2px solid #c9a84c; outline-offset: 2px; }

  .collapse-arrow {
    font-size: 0.6rem;
    color: #8b7355;
    transition: transform 0.2s;
    width: 12px;
    text-align: center;
  }

  .category-header.collapsed .collapse-arrow { transform: rotate(-90deg); }

  .category-name {
    font-family: 'Cinzel', Georgia, serif;
    font-size: 0.85rem;
    font-weight: 600;
    color: #e8d48b;
  }

  .category-count {
    font-size: 0.75rem;
    color: #8b7355;
  }

  /* Card rows — Moxfield text list style */
  .card-list { padding: 0 0 4px 0; }
  .card-list.collapsed { display: none; }

  .card-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 8px 3px 20px;
    border-radius: 3px;
    transition: background 0.1s;
    cursor: default;
    position: relative;
    font-size: 0.9rem;
  }

  .card-row:hover {
    background: rgba(201,168,76,0.06);
  }

  .card-qty {
    font-weight: 600;
    color: #c4a882;
    min-width: 20px;
    text-align: right;
    font-size: 0.85rem;
  }

  .card-name-text {
    flex: 1;
    color: #f4e8c1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-mana-cost {
    font-size: 0.75rem;
    color: #c4a882;
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* Hover card image preview */
  .card-preview {
    display: none;
    position: fixed;
    z-index: 1000;
    pointer-events: none;
    width: 250px;
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 0 40px rgba(201,168,76,0.1);
  }

  .card-preview.visible { display: block; }

  .card-preview img {
    width: 100%;
    border-radius: 10px;
    display: block;
  }

  /* ---- Export modal ---- */
  .export-modal {
    display: none;
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    z-index: 1000;
    background: rgba(0,0,0,0.75);
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .export-modal.visible { display: flex; }

  .export-modal-content {
    background: #2c1810;
    border: 2px solid #5c4033;
    border-radius: 10px;
    padding: 20px;
    max-width: 600px;
    width: 100%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 12px 40px rgba(0,0,0,0.6);
  }

  .export-modal-content h3 {
    margin: 0 0 12px 0;
    font-family: 'Cinzel', Georgia, serif;
    color: #e8d48b;
  }

  .export-modal-content textarea {
    width: 100%;
    min-height: 300px;
    background: rgba(26,15,10,0.8);
    color: #f4e8c1;
    border: 1px solid #5c4033;
    border-radius: 6px;
    padding: 12px;
    font-family: 'Courier New', monospace;
    font-size: 0.85rem;
    resize: vertical;
  }

  .export-modal-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    justify-content: flex-end;
  }

  /* ---- Ornamental section divider ---- */
  .section-divider {
    text-align: center;
    color: #3d2b1f;
    font-size: 0.7rem;
    letter-spacing: 0.5em;
    padding: 8px 0;
    user-select: none;
  }

  @media (max-width: 767px) {
    .deck-meta {
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .commander-image { width: 180px; }
    .stats-numbers { justify-content: center; }
    .mana-curve { justify-content: center; }
  }
</style>

<div class="deck-view">
  <div class="empty-state" id="empty-state">
    <div class="icon">📜</div>
    <h3>The pages await your inscription</h3>
    <p>Choose a commander and strategy, then inscribe your deck</p>
  </div>

  <div class="progress-section" id="progress-section" aria-live="polite">
    <div class="progress-phase" id="progress-phase">Consulting the archives...</div>
    <div class="progress-bar-track">
      <div class="progress-bar-fill" id="progress-fill" role="progressbar"
           aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
    </div>
    <div class="progress-percent" id="progress-percent">0%</div>
  </div>

  <div class="error-section" id="error-section" role="alert">
    <p id="error-message"></p>
  </div>

  <div class="deck-header" id="deck-header">
    <div class="deck-meta">
      <div class="commander-image" id="commander-image"></div>
      <div class="deck-info">
        <h2 class="deck-name" id="deck-name"></h2>
        <div class="deck-tags" id="deck-tags"></div>
        <div class="stats-numbers" id="stats-numbers"></div>
        <div class="mana-curve" id="mana-curve"></div>
        <div class="stats-bar" id="stats-bar"></div>
      </div>
    </div>

    <div class="combo-info" id="combo-info">
      <h4>♾️ Combo Package</h4>
      <div class="combo-cards" id="combo-cards"></div>
      <p id="combo-desc"></p>
    </div>

    <div class="warnings" id="warnings"></div>

    <div class="actions" id="actions">
      <button class="btn btn-primary" id="btn-regenerate" aria-label="Regenerate deck">⟳ Regenerate</button>
      <button class="btn" id="btn-export-text" aria-label="Export as text">Export Text</button>
      <button class="btn" id="btn-export-mtgo" aria-label="Export for MTGO">Export MTGO</button>
      <button class="btn" id="btn-copy" aria-label="Copy deck list">📋 Copy</button>
      <span class="copy-feedback" id="copy-feedback">Copied!</span>
    </div>

    <div class="section-divider">— ✦ DECK LIST ✦ —</div>
  </div>

  <div id="card-sections"></div>

  <!-- Hover preview -->
  <div class="card-preview" id="card-preview">
    <img id="preview-img" src="" alt="" />
  </div>

  <!-- Export modal -->
  <div class="export-modal" id="export-modal">
    <div class="export-modal-content">
      <h3 id="export-modal-title">Export</h3>
      <textarea id="export-textarea" readonly></textarea>
      <div class="export-modal-actions">
        <button class="btn" id="btn-modal-copy">Copy</button>
        <button class="btn" id="btn-modal-close">Close</button>
      </div>
    </div>
  </div>
</div>
`;

// Type distribution colors for the stats bar
const TYPE_COLORS: Record<string, string> = {
  Creature: "#6b8e23",
  Instant: "#0e68ab",
  Sorcery: "#d3202a",
  Artifact: "#8b8b8b",
  Enchantment: "#9b59b6",
  Planeswalker: "#e8a040",
  Land: "#8b6914",
  Ramp: "#2e8b57",
  Removal: "#c0392b",
  "Card Draw": "#2980b9",
  Protection: "#f39c12",
  Custom: "#7f8c8d",
};

export class DeckView extends HTMLElement {
  private shadow: ShadowRoot;
  private _deck: Deck | null = null;
  private _result: GenerationResult | null = null;

  private _unsubProgress: (() => void) | null = null;
  private _unsubComplete: (() => void) | null = null;
  private _unsubError: (() => void) | null = null;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: "open" });
    this.shadow.appendChild(template.content.cloneNode(true));
  }

  connectedCallback(): void {
    this._unsubProgress = subscribe("generation-progress", (event) => {
      this.showProgress(event.detail.phase, event.detail.percentComplete);
    });

    this._unsubComplete = subscribe("generation-complete", (event) => {
      this._result = event.detail.result;
      this._deck = event.detail.result.deck;
      this.hideProgress();
      this.hideError();
      this.renderDeck();
    });

    this._unsubError = subscribe("generation-error", (event) => {
      this.hideProgress();
      this.showError(event.detail.message);
    });

    this.shadow.getElementById("btn-export-text")!.addEventListener("click", () => this.showExport("text"));
    this.shadow.getElementById("btn-export-mtgo")!.addEventListener("click", () => this.showExport("mtgo"));
    this.shadow.getElementById("btn-copy")!.addEventListener("click", () => this.copyToClipboard());
    this.shadow.getElementById("btn-modal-copy")!.addEventListener("click", () => this.copyModalText());
    this.shadow.getElementById("btn-modal-close")!.addEventListener("click", () => this.hideExportModal());
    this.shadow.getElementById("export-modal")!.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) this.hideExportModal();
    });
    this.shadow.getElementById("btn-regenerate")!.addEventListener("click", () => {
      this.dispatchEvent(new CustomEvent("regenerate-deck", { bubbles: true, composed: true }));
    });
  }

  disconnectedCallback(): void {
    this._unsubProgress?.();
    this._unsubComplete?.();
    this._unsubError?.();
  }

  // ---- Progress ----
  private showProgress(phase: string, percent: number): void {
    this.shadow.getElementById("empty-state")!.style.display = "none";
    this.shadow.getElementById("deck-header")!.classList.remove("visible");
    this.shadow.getElementById("actions")!.classList.remove("visible");
    this.shadow.getElementById("card-sections")!.innerHTML = "";
    const section = this.shadow.getElementById("progress-section")!;
    section.classList.add("visible");
    this.shadow.getElementById("progress-phase")!.textContent = phase;
    const fill = this.shadow.getElementById("progress-fill")!;
    fill.style.width = `${percent}%`;
    fill.setAttribute("aria-valuenow", String(percent));
    this.shadow.getElementById("progress-percent")!.textContent = `${percent}%`;
  }

  private hideProgress(): void {
    this.shadow.getElementById("progress-section")!.classList.remove("visible");
  }

  // ---- Error ----
  private showError(message: string): void {
    this.shadow.getElementById("error-message")!.textContent = message;
    this.shadow.getElementById("error-section")!.classList.add("visible");
  }

  private hideError(): void {
    this.shadow.getElementById("error-section")!.classList.remove("visible");
  }

  // ---- Render deck ----
  private renderDeck(): void {
    if (!this._deck || !this._result) return;
    const deck = this._deck;
    const result = this._result;

    this.shadow.getElementById("empty-state")!.style.display = "none";
    this.shadow.getElementById("deck-header")!.classList.add("visible");
    this.shadow.getElementById("actions")!.classList.add("visible");

    // Commander image
    const imgContainer = this.shadow.getElementById("commander-image")!;
    const imageUri = deck.commander.imageUris?.normal ?? deck.commander.cardFaces?.[0]?.imageUris?.normal;
    imgContainer.innerHTML = imageUri
      ? `<img src="${this.esc(imageUri)}" alt="${this.esc(deck.commander.name)}" />`
      : `<div style="width:100%;aspect-ratio:488/680;background:#2c1810;display:flex;align-items:center;justify-content:center;border-radius:10px;color:#8b7355;font-style:italic;">${this.esc(deck.commander.name)}</div>`;

    // Deck name
    this.shadow.getElementById("deck-name")!.textContent = deck.name;

    // Tags
    const archetypeLabel = ARCHETYPE_INFO[result.archetype]?.label ?? result.archetype;
    this.shadow.getElementById("deck-tags")!.innerHTML = `
      <span class="tag">${archetypeLabel}</span>
      <span class="tag">Bracket ${result.bracketLevel}</span>
      ${result.combosIncluded.length > 0 ? '<span class="tag">♾️ Combos</span>' : ""}
    `;

    // Stats numbers
    const nonLandCards = deck.entries.filter((e) => e.category !== "Land").map((e) => e.card);
    const avgCmc = getAverageCmc(nonLandCards);
    const totalCards = 1 + deck.entries.reduce((sum, e) => sum + e.quantity, 0);
    const landCount = deck.entries.filter((e) => e.category === "Land").reduce((sum, e) => sum + e.quantity, 0);
    const creatureCount = deck.entries.filter((e) => e.card.typeLine.toLowerCase().includes("creature")).reduce((sum, e) => sum + e.quantity, 0);

    this.shadow.getElementById("stats-numbers")!.innerHTML = `
      <div class="stat"><div class="stat-value">${totalCards}</div><div class="stat-label">Cards</div></div>
      <div class="stat"><div class="stat-value">${avgCmc.toFixed(1)}</div><div class="stat-label">Avg CMC</div></div>
      <div class="stat"><div class="stat-value">${landCount}</div><div class="stat-label">Lands</div></div>
      <div class="stat"><div class="stat-value">${creatureCount}</div><div class="stat-label">Creatures</div></div>
    `;

    // Mana curve
    this.renderManaCurve(nonLandCards);

    // Stats bar (type distribution)
    this.renderStatsBar(deck);

    // Combos
    const comboInfo = this.shadow.getElementById("combo-info")!;
    if (result.combosIncluded.length > 0) {
      const combo = result.combosIncluded[0];
      this.shadow.getElementById("combo-cards")!.textContent = combo.cards.join(" + ");
      this.shadow.getElementById("combo-desc")!.textContent =
        combo.results.length > 0 ? combo.results.join(", ") : combo.description;
      comboInfo.classList.add("visible");
    } else {
      comboInfo.classList.remove("visible");
    }

    // Warnings
    const warningsEl = this.shadow.getElementById("warnings")!;
    if (result.warnings.length > 0) {
      warningsEl.innerHTML = result.warnings.map((w) => `<div class="warning-item">⚠ ${this.esc(w.message)}</div>`).join("");
      warningsEl.classList.add("visible");
    } else {
      warningsEl.classList.remove("visible");
    }

    // Card sections (Moxfield-style text list)
    this.renderCardSections(deck);
  }

  private renderManaCurve(cards: Card[]): void {
    const curveData = getManaCurve(cards);
    const container = this.shadow.getElementById("mana-curve")!;
    container.innerHTML = "";

    if (curveData.buckets.length === 0) return;

    const maxCount = Math.max(...curveData.buckets.map((b) => b.count), 1);

    for (const bucket of curveData.buckets) {
      if (bucket.cmc > 10) continue; // Cap display at 10
      const height = Math.max(4, (bucket.count / maxCount) * 40);
      const wrapper = document.createElement("div");
      wrapper.className = "curve-bar-wrapper";
      wrapper.innerHTML = `
        <span class="curve-count">${bucket.count}</span>
        <div class="curve-bar" style="height:${height}px"></div>
        <span class="curve-label">${bucket.cmc}${bucket.cmc >= 10 ? "+" : ""}</span>
      `;
      container.appendChild(wrapper);
    }
  }

  private renderStatsBar(deck: Deck): void {
    const bar = this.shadow.getElementById("stats-bar")!;
    bar.innerHTML = "";

    // Count by broad type
    const typeCounts = new Map<string, number>();
    for (const entry of deck.entries) {
      const type = this.broadType(entry);
      typeCounts.set(type, (typeCounts.get(type) ?? 0) + entry.quantity);
    }

    const total = deck.entries.reduce((sum, e) => sum + e.quantity, 0);
    if (total === 0) return;

    const typeOrder = ["Creature", "Instant", "Sorcery", "Artifact", "Enchantment", "Planeswalker", "Land"];
    for (const type of typeOrder) {
      const count = typeCounts.get(type);
      if (!count) continue;
      const pct = (count / total) * 100;
      const seg = document.createElement("div");
      seg.className = "stats-bar-segment";
      seg.style.flex = String(pct);
      seg.style.background = TYPE_COLORS[type] ?? "#5c4033";
      seg.title = `${type}: ${count}`;
      seg.innerHTML = `<span class="seg-label">${count}</span>`;
      bar.appendChild(seg);
    }
  }

  private broadType(entry: DeckEntry): string {
    const t = entry.card.typeLine.toLowerCase();
    if (t.includes("land")) return "Land";
    if (t.includes("planeswalker")) return "Planeswalker";
    if (t.includes("creature")) return "Creature";
    if (t.includes("instant")) return "Instant";
    if (t.includes("sorcery")) return "Sorcery";
    if (t.includes("artifact")) return "Artifact";
    if (t.includes("enchantment")) return "Enchantment";
    return entry.category;
  }

  private renderCardSections(deck: Deck): void {
    const container = this.shadow.getElementById("card-sections")!;
    container.innerHTML = "";

    // Group entries by category
    const grouped = new Map<CardCategory, DeckEntry[]>();

    // Add commander as its own group
    grouped.set("Commander", [{
      card: deck.commander,
      quantity: 1,
      category: "Commander",
    }]);

    for (const entry of deck.entries) {
      const list = grouped.get(entry.category) ?? [];
      list.push(entry);
      grouped.set(entry.category, list);
    }

    for (const category of CATEGORY_ORDER) {
      const entries = grouped.get(category);
      if (!entries || entries.length === 0) continue;

      const totalInCategory = entries.reduce((sum, e) => sum + e.quantity, 0);

      const section = document.createElement("div");
      section.className = "category-section";

      // Header
      const header = document.createElement("div");
      header.className = "category-header";
      header.setAttribute("tabindex", "0");
      header.setAttribute("role", "button");
      header.setAttribute("aria-expanded", "true");
      header.innerHTML = `
        <span class="collapse-arrow">▼</span>
        <span class="category-name">${category}</span>
        <span class="category-count">(${totalInCategory})</span>
      `;

      // Card list
      const cardList = document.createElement("div");
      cardList.className = "card-list";

      // Sort entries alphabetically within category
      const sorted = [...entries].sort((a, b) => a.card.name.localeCompare(b.card.name));

      for (const entry of sorted) {
        const row = document.createElement("div");
        row.className = "card-row";

        const manaCostHtml = this.renderManaCost(entry.card.manaCost);

        row.innerHTML = `
          <span class="card-qty">${entry.quantity}</span>
          <span class="card-name-text">${this.esc(entry.card.name)}</span>
          <span class="card-mana-cost">${manaCostHtml}</span>
        `;

        // Hover preview
        const imageUri = entry.card.imageUris?.normal ?? entry.card.cardFaces?.[0]?.imageUris?.normal;
        if (imageUri) {
          row.addEventListener("mouseenter", (e) => this.showPreview(imageUri, e as MouseEvent));
          row.addEventListener("mousemove", (e) => this.movePreview(e as MouseEvent));
          row.addEventListener("mouseleave", () => this.hidePreview());
        }

        cardList.appendChild(row);
      }

      // Toggle collapse
      header.addEventListener("click", () => {
        const collapsed = header.classList.toggle("collapsed");
        cardList.classList.toggle("collapsed", collapsed);
        header.setAttribute("aria-expanded", collapsed ? "false" : "true");
      });
      header.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); header.click(); }
      });

      section.appendChild(header);
      section.appendChild(cardList);
      container.appendChild(section);
    }
  }

  private renderManaCost(manaCost: string): string {
    if (!manaCost) return "";
    return manaCost.replace(/\{([^}]+)\}/g, (_, symbol: string) => {
      const upper = symbol.toUpperCase();
      if (MANA_SYMBOLS[upper]) return MANA_SYMBOLS[upper];
      if (upper === "C") return "◇";
      if (upper === "X") return "X";
      return symbol; // Generic mana (numbers)
    });
  }

  // ---- Hover preview ----
  private showPreview(imageUri: string, e: MouseEvent): void {
    const preview = this.shadow.getElementById("card-preview")!;
    const img = this.shadow.getElementById("preview-img") as HTMLImageElement;
    img.src = imageUri;
    img.alt = "Card preview";
    preview.classList.add("visible");
    this.movePreview(e);
  }

  private movePreview(e: MouseEvent): void {
    const preview = this.shadow.getElementById("card-preview")!;
    const x = e.clientX + 20;
    const y = Math.min(e.clientY - 50, window.innerHeight - 370);
    preview.style.left = `${Math.min(x, window.innerWidth - 270)}px`;
    preview.style.top = `${Math.max(y, 10)}px`;
  }

  private hidePreview(): void {
    this.shadow.getElementById("card-preview")!.classList.remove("visible");
  }

  // ---- Export ----
  private showExport(format: "text" | "mtgo"): void {
    if (!this._deck) return;
    const modal = this.shadow.getElementById("export-modal")!;
    const title = this.shadow.getElementById("export-modal-title")!;
    const textarea = this.shadow.getElementById("export-textarea") as HTMLTextAreaElement;
    title.textContent = format === "text" ? "Export — Text List" : "Export — MTGO Format";
    textarea.value = format === "text" ? toText(this._deck) : toMTGO(this._deck);
    modal.classList.add("visible");
    textarea.select();
  }

  private hideExportModal(): void {
    this.shadow.getElementById("export-modal")!.classList.remove("visible");
  }

  private async copyToClipboard(): Promise<void> {
    if (!this._deck) return;
    try {
      await navigator.clipboard.writeText(toText(this._deck));
      const fb = this.shadow.getElementById("copy-feedback")!;
      fb.classList.add("visible");
      setTimeout(() => fb.classList.remove("visible"), 2000);
    } catch { this.showExport("text"); }
  }

  private async copyModalText(): Promise<void> {
    const ta = this.shadow.getElementById("export-textarea") as HTMLTextAreaElement;
    try { await navigator.clipboard.writeText(ta.value); } catch { ta.select(); }
  }

  private esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}
