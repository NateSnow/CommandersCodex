/**
 * `<card-recommendations>` Web Component
 *
 * Displays EDHREC card recommendations and Commander Spellbook combos
 * for the currently selected commander.
 *
 * Subscribes to `commander-changed` events to automatically fetch
 * recommendations when a new commander is selected.
 *
 * Dependencies (set as properties after construction):
 *  - deckManager: DeckManager instance
 *  - edhrecAdapter: EDHRECAdapter instance
 *  - commanderSpellbookAdapter: CommanderSpellbookAdapter instance
 */

import type { Card } from "../models/card.js";
import type { EDHRECRecommendation, Combo } from "../models/recommendation.js";
import type { DeckManager } from "../domain/deck-manager.js";
import type { EDHRECAdapter } from "../data/edhrec-adapter.js";
import type { CommanderSpellbookAdapter } from "../data/commander-spellbook-adapter.js";
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

  .recommendations-container {
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

  .error-message {
    text-align: center;
    padding: 16px;
    color: #f5a5a5;
    font-size: 0.85rem;
    background: #2a1a1a;
    border: 1px solid #5a2a2a;
    border-radius: 8px;
    margin-bottom: 16px;
  }

  .loading {
    text-align: center;
    padding: 24px 16px;
    color: #999;
    font-size: 0.9rem;
  }

  /* Recommendations section */
  .section {
    margin-bottom: 20px;
  }

  /* Recommendation cards grid */
  .rec-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px;
  }

  .rec-card {
    background: #1e1e1e;
    border: 1px solid #333;
    border-radius: 8px;
    overflow: hidden;
    transition: border-color 0.15s;
  }

  .rec-card:hover {
    border-color: #7c4dff;
  }

  .rec-card img {
    width: 100%;
    aspect-ratio: 488 / 680;
    object-fit: cover;
    display: block;
    background: #1a1a1a;
  }

  .rec-card .img-placeholder {
    width: 100%;
    aspect-ratio: 488 / 680;
    background: #333;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-size: 0.75rem;
    color: #aaa;
    padding: 8px;
  }

  .rec-card-info {
    padding: 8px;
  }

  .rec-card-name {
    font-size: 0.8rem;
    font-weight: 600;
    color: #e0e0e0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 4px;
  }

  .rec-card-stats {
    display: flex;
    justify-content: space-between;
    font-size: 0.7rem;
    color: #999;
  }

  .synergy-score {
    color: #7c4dff;
    font-weight: 600;
  }

  .synergy-score.positive {
    color: #6fbf73;
  }

  .synergy-score.negative {
    color: #f5a5a5;
  }

  .inclusion-pct {
    color: #999;
  }

  /* Show Combos button */
  .btn-combos {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 20px;
    min-height: 44px;
    min-width: 44px;
    font-size: 0.9rem;
    font-weight: 600;
    color: #fff;
    background: #7c4dff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s;
    margin-bottom: 12px;
  }

  .btn-combos:hover {
    background: #6a3de8;
  }

  .btn-combos:focus-visible {
    outline: 2px solid #7c4dff;
    outline-offset: 2px;
  }

  .btn-combos:disabled {
    background: #444;
    color: #888;
    cursor: not-allowed;
  }

  /* Combo list */
  .combo-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .combo-item {
    padding: 12px;
    background: #1e1e1e;
    border: 1px solid #333;
    border-radius: 8px;
    margin-bottom: 8px;
  }

  .combo-item + .combo-item {
    margin-top: 8px;
  }

  .combo-name {
    font-size: 0.9rem;
    font-weight: 600;
    color: #e0e0e0;
    margin-bottom: 6px;
  }

  .combo-cards {
    font-size: 0.8rem;
    color: #7c4dff;
    margin-bottom: 6px;
  }

  .combo-cards span {
    display: inline-block;
    background: #2a2040;
    padding: 2px 6px;
    border-radius: 4px;
    margin: 2px 4px 2px 0;
  }

  .combo-description {
    font-size: 0.8rem;
    color: #bbb;
    line-height: 1.4;
  }

  .combo-results {
    margin-top: 6px;
    font-size: 0.75rem;
    color: #6fbf73;
  }

  .combo-results span {
    display: inline-block;
    background: #1e2a1e;
    padding: 2px 6px;
    border-radius: 4px;
    margin: 2px 4px 2px 0;
  }

  @media (max-width: 767px) {
    .rec-grid {
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 8px;
    }

    .rec-card-info {
      padding: 6px;
    }

    .combo-item {
      padding: 10px;
    }
  }
</style>

<div class="recommendations-container" role="region" aria-label="Card recommendations">
  <h2>Recommendations</h2>

  <div class="empty-state" id="empty-state">
    Select a commander to see card recommendations.
  </div>

  <div id="content" style="display:none;">
    <!-- EDHREC Recommendations -->
    <div class="section" id="rec-section" aria-label="EDHREC recommendations">
      <h3>Popular Cards</h3>
      <div id="rec-loading" class="loading" style="display:none;">Loading recommendations…</div>
      <div id="rec-error" class="error-message" style="display:none;"></div>
      <div id="rec-grid" class="rec-grid" role="list" aria-label="Recommended cards"></div>
    </div>

    <!-- Combos -->
    <div class="section" id="combo-section" aria-label="Combo suggestions">
      <h3>Combos</h3>
      <button class="btn-combos" id="btn-show-combos" aria-label="Show combo suggestions">
        Show Combos
      </button>
      <div id="combo-loading" class="loading" style="display:none;">Loading combos…</div>
      <div id="combo-error" class="error-message" style="display:none;"></div>
      <ul id="combo-list" class="combo-list" role="list" aria-label="Card combos"></ul>
    </div>
  </div>
</div>
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export class CardRecommendations extends HTMLElement {
  private shadow: ShadowRoot;
  private _deckManager: DeckManager | null = null;
  private _edhrecAdapter: EDHRECAdapter | null = null;
  private _commanderSpellbookAdapter: CommanderSpellbookAdapter | null = null;
  private _unsubscribeCommander: (() => void) | null = null;
  private _currentCommander: Card | null = null;

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
  }

  get deckManager(): DeckManager | null {
    return this._deckManager;
  }

  set edhrecAdapter(adapter: EDHRECAdapter) {
    this._edhrecAdapter = adapter;
  }

  get edhrecAdapter(): EDHRECAdapter | null {
    return this._edhrecAdapter;
  }

  set commanderSpellbookAdapter(adapter: CommanderSpellbookAdapter) {
    this._commanderSpellbookAdapter = adapter;
  }

  get commanderSpellbookAdapter(): CommanderSpellbookAdapter | null {
    return this._commanderSpellbookAdapter;
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  connectedCallback(): void {
    this._unsubscribeCommander = subscribe("commander-changed", (event) => {
      this._currentCommander = event.detail.commander;
      this.onCommanderChanged(event.detail.commander);
    });

    // Wire up the Show Combos button
    const combosBtn = this.shadow.getElementById("btn-show-combos")!;
    combosBtn.addEventListener("click", () => {
      this.fetchCombos();
    });
  }

  disconnectedCallback(): void {
    if (this._unsubscribeCommander) {
      this._unsubscribeCommander();
    }
  }

  // -----------------------------------------------------------------------
  // Event handlers
  // -----------------------------------------------------------------------

  private async onCommanderChanged(commander: Card): Promise<void> {
    const emptyState = this.shadow.getElementById("empty-state")!;
    const content = this.shadow.getElementById("content")!;

    emptyState.style.display = "none";
    content.style.display = "";

    // Reset combos section
    this.resetCombos();

    // Fetch recommendations
    await this.fetchRecommendations(commander);
  }

  // -----------------------------------------------------------------------
  // EDHREC Recommendations
  // -----------------------------------------------------------------------

  private async fetchRecommendations(commander: Card): Promise<void> {
    const loading = this.shadow.getElementById("rec-loading")!;
    const errorEl = this.shadow.getElementById("rec-error")!;
    const grid = this.shadow.getElementById("rec-grid")!;

    // Show loading, hide error and grid
    loading.style.display = "";
    errorEl.style.display = "none";
    grid.innerHTML = "";

    if (!this._edhrecAdapter) {
      loading.style.display = "none";
      errorEl.textContent = "Recommendations are temporarily unavailable.";
      errorEl.style.display = "";
      return;
    }

    try {
      const recommendations =
        await this._edhrecAdapter.getCommanderRecommendations(commander.name);

      loading.style.display = "none";

      if (recommendations.length === 0) {
        errorEl.textContent =
          "No recommendations found for this commander. Try a different commander or check back later.";
        errorEl.style.display = "";
        return;
      }

      this.renderRecommendations(recommendations);
    } catch {
      loading.style.display = "none";
      errorEl.textContent = "Recommendations are temporarily unavailable.";
      errorEl.style.display = "";
    }
  }

  private renderRecommendations(recommendations: EDHRECRecommendation[]): void {
    const grid = this.shadow.getElementById("rec-grid")!;
    grid.innerHTML = "";

    for (const rec of recommendations) {
      const card = document.createElement("div");
      card.className = "rec-card";
      card.setAttribute("role", "listitem");

      // Card image
      if (rec.imageUri) {
        const img = document.createElement("img");
        img.src = rec.imageUri;
        img.alt = rec.cardName;
        img.loading = "lazy";
        img.addEventListener("error", () => {
          const placeholder = document.createElement("div");
          placeholder.className = "img-placeholder";
          placeholder.textContent = rec.cardName;
          img.replaceWith(placeholder);
        });
        card.appendChild(img);
      } else {
        const placeholder = document.createElement("div");
        placeholder.className = "img-placeholder";
        placeholder.textContent = rec.cardName;
        card.appendChild(placeholder);
      }

      // Card info
      const info = document.createElement("div");
      info.className = "rec-card-info";

      const nameEl = document.createElement("div");
      nameEl.className = "rec-card-name";
      nameEl.textContent = rec.cardName;
      nameEl.title = rec.cardName;

      const statsEl = document.createElement("div");
      statsEl.className = "rec-card-stats";

      // Synergy score
      const synergyEl = document.createElement("span");
      synergyEl.className = "synergy-score";
      const synergyValue = rec.synergyScore;
      const synergySign = synergyValue >= 0 ? "+" : "";
      synergyEl.textContent = `${synergySign}${(synergyValue * 100).toFixed(0)}% synergy`;
      if (synergyValue > 0) {
        synergyEl.classList.add("positive");
      } else if (synergyValue < 0) {
        synergyEl.classList.add("negative");
      }

      // Inclusion percentage
      const inclEl = document.createElement("span");
      inclEl.className = "inclusion-pct";
      inclEl.textContent = `${rec.inclusionPercentage}% of decks`;

      statsEl.appendChild(synergyEl);
      statsEl.appendChild(inclEl);

      info.appendChild(nameEl);
      info.appendChild(statsEl);
      card.appendChild(info);

      grid.appendChild(card);
    }
  }

  // -----------------------------------------------------------------------
  // Commander Spellbook Combos
  // -----------------------------------------------------------------------

  private resetCombos(): void {
    const btn = this.shadow.getElementById("btn-show-combos") as HTMLButtonElement;
    const loading = this.shadow.getElementById("combo-loading")!;
    const errorEl = this.shadow.getElementById("combo-error")!;
    const list = this.shadow.getElementById("combo-list")!;

    btn.disabled = false;
    btn.style.display = "";
    loading.style.display = "none";
    errorEl.style.display = "none";
    list.innerHTML = "";
  }

  private async fetchCombos(): Promise<void> {
    const btn = this.shadow.getElementById("btn-show-combos") as HTMLButtonElement;
    const loading = this.shadow.getElementById("combo-loading")!;
    const errorEl = this.shadow.getElementById("combo-error")!;
    const list = this.shadow.getElementById("combo-list")!;

    if (!this._currentCommander) return;

    btn.disabled = true;
    loading.style.display = "";
    errorEl.style.display = "none";
    list.innerHTML = "";

    if (!this._commanderSpellbookAdapter) {
      loading.style.display = "none";
      btn.style.display = "none";
      errorEl.textContent = "Combo suggestions are temporarily unavailable.";
      errorEl.style.display = "";
      return;
    }

    try {
      const combos = await this._commanderSpellbookAdapter.searchCombos(
        this._currentCommander.colorIdentity,
      );

      loading.style.display = "none";
      btn.style.display = "none";

      if (combos.length === 0) {
        errorEl.textContent =
          "No combos found for this color identity. Try a different commander.";
        errorEl.style.display = "";
        return;
      }

      this.renderCombos(combos);
    } catch {
      loading.style.display = "none";
      btn.style.display = "none";
      errorEl.textContent = "Combo suggestions are temporarily unavailable.";
      errorEl.style.display = "";
    }
  }

  private renderCombos(combos: Combo[]): void {
    const list = this.shadow.getElementById("combo-list")!;
    list.innerHTML = "";

    for (const combo of combos) {
      const li = document.createElement("li");
      li.className = "combo-item";
      li.setAttribute("role", "listitem");

      // Combo name
      const nameEl = document.createElement("div");
      nameEl.className = "combo-name";
      nameEl.textContent = combo.name;

      // Involved cards
      const cardsEl = document.createElement("div");
      cardsEl.className = "combo-cards";
      for (const cardName of combo.cards) {
        const span = document.createElement("span");
        span.textContent = cardName;
        cardsEl.appendChild(span);
      }

      // Description
      const descEl = document.createElement("div");
      descEl.className = "combo-description";
      descEl.textContent = combo.description;

      li.appendChild(nameEl);
      li.appendChild(cardsEl);
      li.appendChild(descEl);

      // Results (if any)
      if (combo.results.length > 0) {
        const resultsEl = document.createElement("div");
        resultsEl.className = "combo-results";
        for (const result of combo.results) {
          const span = document.createElement("span");
          span.textContent = result;
          resultsEl.appendChild(span);
        }
        li.appendChild(resultsEl);
      }

      list.appendChild(li);
    }
  }
}
