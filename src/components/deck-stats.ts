/**
 * `<deck-stats>` Web Component
 *
 * Displays deck statistics: mana curve bar chart, category breakdown,
 * color distribution, average CMC, and type breakdown.
 *
 * Subscribes to `deck-changed` events to recalculate and re-render
 * whenever the deck is modified.
 *
 * Dependencies (set as properties after construction):
 *  - deckManager: DeckManager instance
 */

import type { DeckManager } from "../domain/deck-manager.js";
import {
  getManaCurve,
  getCategoryBreakdown,
  getColorDistribution,
  getAverageCmc,
  getTypeBreakdown,
} from "../domain/statistics-calculator.js";
import { subscribe } from "../utils/event-bus.js";

// ---------------------------------------------------------------------------
// Color map for mana colors
// ---------------------------------------------------------------------------

const COLOR_MAP: Record<string, { label: string; hex: string }> = {
  W: { label: "White", hex: "#f9faf4" },
  U: { label: "Blue", hex: "#0e68ab" },
  B: { label: "Black", hex: "#150b00" },
  R: { label: "Red", hex: "#d3202a" },
  G: { label: "Green", hex: "#00733e" },
  Colorless: { label: "Colorless", hex: "#9e9e9e" },
};

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

  .stats-container {
    padding: 16px;
  }

  h2 {
    margin: 0 0 16px 0;
    font-size: 1.25rem;
    color: #fff;
  }

  h3 {
    margin: 0 0 8px 0;
    font-size: 0.95rem;
    color: #ccc;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .empty-state {
    text-align: center;
    padding: 32px 16px;
    color: #888;
    font-size: 0.9rem;
  }

  /* Sections */
  .stats-section {
    margin-bottom: 20px;
  }

  /* Average CMC */
  .avg-cmc {
    font-size: 1.5rem;
    font-weight: 700;
    color: #7c4dff;
    margin-bottom: 4px;
  }

  .avg-cmc-label {
    font-size: 0.8rem;
    color: #999;
  }

  /* Mana curve bar chart */
  .mana-curve {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    height: 120px;
    padding: 0 4px;
  }

  .mana-curve-bar-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    min-width: 0;
  }

  .mana-curve-bar-track {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  .mana-curve-bar {
    width: 100%;
    max-width: 32px;
    background: #7c4dff;
    border-radius: 3px 3px 0 0;
    min-height: 0;
    transition: height 0.2s ease;
  }

  .mana-curve-count {
    font-size: 0.7rem;
    color: #ccc;
    margin-bottom: 2px;
    text-align: center;
  }

  .mana-curve-label {
    font-size: 0.7rem;
    color: #999;
    margin-top: 4px;
    text-align: center;
  }

  /* Breakdown lists */
  .breakdown-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .breakdown-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    font-size: 0.85rem;
  }

  .breakdown-item + .breakdown-item {
    border-top: 1px solid #333;
  }

  .breakdown-name {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .breakdown-count {
    font-weight: 600;
    color: #fff;
    min-width: 24px;
    text-align: right;
  }

  .breakdown-pct {
    font-size: 0.75rem;
    color: #999;
    min-width: 42px;
    text-align: right;
  }

  /* Color indicator dot */
  .color-dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    flex-shrink: 0;
    border: 1px solid #555;
  }

  /* Type breakdown bar */
  .type-bar-track {
    flex: 1;
    height: 8px;
    background: #2a2a2a;
    border-radius: 4px;
    overflow: hidden;
    min-width: 40px;
  }

  .type-bar-fill {
    height: 100%;
    background: #7c4dff;
    border-radius: 4px;
    transition: width 0.2s ease;
  }

  @media (max-width: 767px) {
    .mana-curve {
      height: 80px;
    }

    .stats-section {
      margin-bottom: 16px;
    }
  }
</style>

<div class="stats-container" role="region" aria-label="Deck statistics">
  <h2>Statistics</h2>

  <div class="empty-state" id="empty-state">
    Add cards to your deck to see statistics.
  </div>

  <div id="stats-content" style="display:none;">
    <!-- Average CMC -->
    <div class="stats-section" id="avg-cmc-section" aria-label="Average converted mana cost">
      <h3>Average CMC</h3>
      <div class="avg-cmc" id="avg-cmc-value">0.00</div>
      <div class="avg-cmc-label">of non-land cards</div>
    </div>

    <!-- Mana Curve -->
    <div class="stats-section" aria-label="Mana curve">
      <h3>Mana Curve</h3>
      <div class="mana-curve" id="mana-curve" role="img" aria-label="Mana curve bar chart"></div>
    </div>

    <!-- Type Breakdown -->
    <div class="stats-section" aria-label="Type breakdown">
      <h3>Type Breakdown</h3>
      <ul class="breakdown-list" id="type-breakdown" role="list"></ul>
    </div>

    <!-- Category Breakdown -->
    <div class="stats-section" aria-label="Category breakdown">
      <h3>Category Breakdown</h3>
      <ul class="breakdown-list" id="category-breakdown" role="list"></ul>
    </div>

    <!-- Color Distribution -->
    <div class="stats-section" aria-label="Color distribution">
      <h3>Color Distribution</h3>
      <ul class="breakdown-list" id="color-distribution" role="list"></ul>
    </div>
  </div>
</div>
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export class DeckStats extends HTMLElement {
  private shadow: ShadowRoot;
  private _deckManager: DeckManager | null = null;
  private _unsubscribeDeck: (() => void) | null = null;

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
    this.renderStats();
  }

  get deckManager(): DeckManager | null {
    return this._deckManager;
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  connectedCallback(): void {
    this._unsubscribeDeck = subscribe("deck-changed", () => {
      this.renderStats();
    });
  }

  disconnectedCallback(): void {
    if (this._unsubscribeDeck) {
      this._unsubscribeDeck();
    }
  }

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------

  private renderStats(): void {
    if (!this._deckManager) return;

    const entries = this._deckManager.getCards();
    const cards = entries.map((e) => e.card);

    const emptyState = this.shadow.getElementById("empty-state")!;
    const statsContent = this.shadow.getElementById("stats-content")!;

    if (cards.length === 0) {
      emptyState.style.display = "";
      statsContent.style.display = "none";
      return;
    }

    emptyState.style.display = "none";
    statsContent.style.display = "";

    this.renderAverageCmc(cards);
    this.renderManaCurve(cards);
    this.renderTypeBreakdown(cards);
    this.renderCategoryBreakdown(entries);
    this.renderColorDistribution(cards);
  }

  private renderAverageCmc(cards: Parameters<typeof getAverageCmc>[0]): void {
    const avgCmc = getAverageCmc(cards);
    const el = this.shadow.getElementById("avg-cmc-value")!;
    el.textContent = avgCmc.toFixed(2);
  }

  private renderManaCurve(cards: Parameters<typeof getManaCurve>[0]): void {
    const { buckets } = getManaCurve(cards);
    const container = this.shadow.getElementById("mana-curve")!;
    container.innerHTML = "";

    if (buckets.length === 0) return;

    const maxCount = Math.max(...buckets.map((b) => b.count), 1);

    for (const bucket of buckets) {
      const wrapper = document.createElement("div");
      wrapper.className = "mana-curve-bar-wrapper";

      // Count label above bar
      const countLabel = document.createElement("div");
      countLabel.className = "mana-curve-count";
      countLabel.textContent = String(bucket.count);

      // Bar track (fills from bottom)
      const track = document.createElement("div");
      track.className = "mana-curve-bar-track";

      const bar = document.createElement("div");
      bar.className = "mana-curve-bar";
      const heightPct = (bucket.count / maxCount) * 100;
      bar.style.height = `${heightPct}%`;
      bar.setAttribute(
        "aria-label",
        `CMC ${bucket.cmc}: ${bucket.count} card${bucket.count !== 1 ? "s" : ""}`,
      );

      track.appendChild(bar);

      // CMC label below bar
      const cmcLabel = document.createElement("div");
      cmcLabel.className = "mana-curve-label";
      cmcLabel.textContent = bucket.cmc >= 7 ? "7+" : String(bucket.cmc);

      wrapper.appendChild(countLabel);
      wrapper.appendChild(track);
      wrapper.appendChild(cmcLabel);
      container.appendChild(wrapper);
    }

    // Update the aria-label with a text summary
    const summary = buckets
      .map((b) => `CMC ${b.cmc}: ${b.count}`)
      .join(", ");
    container.setAttribute("aria-label", `Mana curve: ${summary}`);
  }

  private renderTypeBreakdown(
    cards: Parameters<typeof getTypeBreakdown>[0],
  ): void {
    const { types } = getTypeBreakdown(cards);
    const container = this.shadow.getElementById("type-breakdown")!;
    container.innerHTML = "";

    const maxCount = Math.max(...types.map((t) => t.count), 1);

    for (const entry of types) {
      const li = document.createElement("li");
      li.className = "breakdown-item";
      li.setAttribute("role", "listitem");

      const name = document.createElement("span");
      name.className = "breakdown-name";
      name.textContent = entry.type;

      const count = document.createElement("span");
      count.className = "breakdown-count";
      count.textContent = String(entry.count);

      const barTrack = document.createElement("div");
      barTrack.className = "type-bar-track";

      const barFill = document.createElement("div");
      barFill.className = "type-bar-fill";
      const widthPct = (entry.count / maxCount) * 100;
      barFill.style.width = `${widthPct}%`;

      barTrack.appendChild(barFill);

      li.appendChild(name);
      li.appendChild(barTrack);
      li.appendChild(count);
      container.appendChild(li);
    }
  }

  private renderCategoryBreakdown(
    entries: Parameters<typeof getCategoryBreakdown>[0],
  ): void {
    const { categories } = getCategoryBreakdown(entries);
    const container = this.shadow.getElementById("category-breakdown")!;
    container.innerHTML = "";

    // Sort by count descending
    const sorted = [...categories].sort((a, b) => b.count - a.count);

    for (const cat of sorted) {
      const li = document.createElement("li");
      li.className = "breakdown-item";
      li.setAttribute("role", "listitem");

      const name = document.createElement("span");
      name.className = "breakdown-name";
      name.textContent = cat.name;

      const count = document.createElement("span");
      count.className = "breakdown-count";
      count.textContent = String(cat.count);

      const pct = document.createElement("span");
      pct.className = "breakdown-pct";
      pct.textContent = `${cat.percentage.toFixed(1)}%`;

      li.appendChild(name);
      li.appendChild(count);
      li.appendChild(pct);
      container.appendChild(li);
    }
  }

  private renderColorDistribution(
    cards: Parameters<typeof getColorDistribution>[0],
  ): void {
    const { colors } = getColorDistribution(cards);
    const container = this.shadow.getElementById("color-distribution")!;
    container.innerHTML = "";

    // Sort by count descending
    const sorted = [...colors].sort((a, b) => b.count - a.count);

    for (const entry of sorted) {
      const li = document.createElement("li");
      li.className = "breakdown-item";
      li.setAttribute("role", "listitem");

      // Color indicator dot
      const dot = document.createElement("span");
      dot.className = "color-dot";
      const colorInfo = COLOR_MAP[entry.color] ?? {
        label: entry.color,
        hex: "#888",
      };
      dot.style.backgroundColor = colorInfo.hex;
      dot.setAttribute("aria-hidden", "true");

      const name = document.createElement("span");
      name.className = "breakdown-name";
      name.textContent = colorInfo.label;

      const count = document.createElement("span");
      count.className = "breakdown-count";
      count.textContent = String(entry.count);

      const pct = document.createElement("span");
      pct.className = "breakdown-pct";
      pct.textContent = `${entry.percentage.toFixed(1)}%`;

      li.appendChild(dot);
      li.appendChild(name);
      li.appendChild(count);
      li.appendChild(pct);
      container.appendChild(li);
    }
  }
}
