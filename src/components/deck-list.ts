/**
 * `<deck-list>` Web Component
 *
 * Displays the current Commander deck contents grouped by CardCategory.
 * Shows card count out of 100, provides remove buttons and category
 * reassignment dropdowns per card, and announces changes via ARIA live region.
 *
 * Dependencies (set as properties after construction):
 *  - deckManager: DeckManager instance
 */

import type { Card } from "../models/card.js";
import type { CardCategory, DeckEntry } from "../models/deck.js";
import type { DeckManager } from "../domain/deck-manager.js";
import { subscribe } from "../utils/event-bus.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_CATEGORIES: CardCategory[] = [
  "Creature",
  "Instant",
  "Sorcery",
  "Artifact",
  "Enchantment",
  "Planeswalker",
  "Land",
  "Ramp",
  "Removal",
  "Card Draw",
  "Protection",
  "Custom",
];

const MAX_DECK_SIZE = 100;

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

  .deck-list-container {
    padding: 16px;
  }

  .deck-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  h2 {
    margin: 0;
    font-size: 1.25rem;
    color: #fff;
  }

  .card-count {
    font-size: 1rem;
    font-weight: 600;
    color: #7c4dff;
    white-space: nowrap;
  }

  .card-count.full {
    color: #6fbf73;
  }

  .card-count.over {
    color: #f5a5a5;
  }

  /* Commander section */
  .commander-section {
    display: none;
    padding: 12px;
    margin-bottom: 16px;
    background: #1e2a1e;
    border: 1px solid #3a5a3a;
    border-radius: 8px;
  }

  .commander-section.visible {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .commander-section img {
    width: 50px;
    height: 70px;
    object-fit: cover;
    border-radius: 4px;
    flex-shrink: 0;
    background: #1a1a1a;
  }

  .commander-section .img-placeholder {
    width: 50px;
    height: 70px;
    background: #333;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-size: 0.55rem;
    color: #aaa;
    padding: 4px;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .commander-info {
    flex: 1;
    min-width: 0;
  }

  .commander-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #7c4dff;
    margin-bottom: 2px;
  }

  .commander-name {
    font-size: 0.95rem;
    font-weight: 700;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Empty state */
  .empty-state {
    text-align: center;
    padding: 32px 16px;
    color: #888;
    font-size: 0.9rem;
  }

  /* Category groups */
  .category-group {
    margin-bottom: 16px;
  }

  .category-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid #444;
    margin-bottom: 8px;
    cursor: pointer;
    user-select: none;
  }

  .category-header:focus-visible {
    outline: 2px solid #7c4dff;
    outline-offset: 2px;
    border-radius: 4px;
  }

  .category-name {
    font-size: 0.9rem;
    font-weight: 600;
    color: #ccc;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .category-count {
    font-size: 0.8rem;
    color: #999;
  }

  /* Card entries */
  .card-entry {
    display: flex;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    align-items: center;
    transition: background 0.15s;
  }

  .card-entry:hover {
    background: #2a2a2a;
  }

  .card-entry img {
    width: 36px;
    height: 50px;
    object-fit: cover;
    border-radius: 3px;
    flex-shrink: 0;
    background: #1a1a1a;
  }

  .card-entry .img-placeholder-sm {
    width: 36px;
    height: 50px;
    background: #333;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-size: 0.45rem;
    color: #aaa;
    padding: 2px;
    border-radius: 3px;
    flex-shrink: 0;
  }

  .card-entry-info {
    flex: 1;
    min-width: 0;
  }

  .card-entry-name {
    font-size: 0.85rem;
    font-weight: 500;
    color: #e0e0e0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-entry-type {
    font-size: 0.7rem;
    color: #888;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Category dropdown */
  .category-select {
    padding: 4px 6px;
    font-size: 0.75rem;
    border: 1px solid #555;
    border-radius: 4px;
    background: #2a2a2a;
    color: #e0e0e0;
    outline: none;
    min-height: 44px;
    min-width: 44px;
    cursor: pointer;
    flex-shrink: 0;
  }

  .category-select:focus {
    border-color: #7c4dff;
  }

  /* Remove button */
  .btn-remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    font-size: 1.1rem;
    color: #f5a5a5;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s, border-color 0.15s;
  }

  .btn-remove:hover {
    background: #3d1c1c;
    border-color: #7a2e2e;
  }

  .btn-remove:focus-visible {
    outline: 2px solid #7c4dff;
    outline-offset: 2px;
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
    .card-entry {
      padding: 8px;
    }

    .category-select {
      font-size: 0.7rem;
      padding: 4px;
    }
  }
</style>

<div class="deck-list-container" role="region" aria-label="Deck list">
  <div class="deck-header">
    <h2>Deck List</h2>
    <span class="card-count" id="card-count" aria-live="polite">0 / ${MAX_DECK_SIZE}</span>
  </div>

  <div aria-live="polite" id="live-region" class="sr-only"></div>

  <div class="commander-section" id="commander-section">
    <img id="commander-img" src="" alt="" />
    <div class="commander-info">
      <div class="commander-label">Commander</div>
      <div class="commander-name" id="commander-name"></div>
    </div>
  </div>

  <div class="empty-state" id="empty-state">
    Select a commander and add cards to start building your deck.
  </div>

  <div id="categories-container" role="list" aria-label="Deck cards grouped by category"></div>
</div>
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export class DeckList extends HTMLElement {
  private shadow: ShadowRoot;
  private _deckManager: DeckManager | null = null;
  private _unsubscribeDeck: (() => void) | null = null;
  private _unsubscribeCommander: (() => void) | null = null;
  private _previousCount = 0;

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

    // Render initial state
    const commander = dm.getCommander();
    if (commander) {
      this.renderCommander(commander);
    }
    this.renderDeck();
  }

  get deckManager(): DeckManager | null {
    return this._deckManager;
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  connectedCallback(): void {
    this._unsubscribeDeck = subscribe("deck-changed", () => {
      this.renderDeck();
    });

    this._unsubscribeCommander = subscribe("commander-changed", (event) => {
      this.renderCommander(event.detail.commander);
      this.renderDeck();
    });
  }

  disconnectedCallback(): void {
    if (this._unsubscribeDeck) {
      this._unsubscribeDeck();
    }
    if (this._unsubscribeCommander) {
      this._unsubscribeCommander();
    }
  }

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------

  private renderCommander(card: Card): void {
    const section = this.shadow.getElementById("commander-section")!;
    const img = this.shadow.getElementById("commander-img") as HTMLImageElement;
    const nameEl = this.shadow.getElementById("commander-name")!;

    const imageUri =
      card.imageUris?.small ?? card.cardFaces?.[0]?.imageUris?.small;

    if (imageUri) {
      img.src = imageUri;
      img.alt = card.name;
      img.style.display = "";
      img.onerror = () => {
        const placeholder = document.createElement("div");
        placeholder.className = "img-placeholder";
        placeholder.textContent = card.name;
        img.replaceWith(placeholder);
      };
    } else {
      // Replace img with placeholder
      const existing = section.querySelector("img, .img-placeholder");
      if (existing) {
        const placeholder = document.createElement("div");
        placeholder.className = "img-placeholder";
        placeholder.textContent = card.name;
        existing.replaceWith(placeholder);
      }
    }

    nameEl.textContent = card.name;
    section.classList.add("visible");
  }

  private renderDeck(): void {
    if (!this._deckManager) return;

    const entries = this._deckManager.getCards();
    const cardCount = this._deckManager.getCardCount();
    const commander = this._deckManager.getCommander();

    // Update card count display
    this.updateCardCount(cardCount);

    // Announce changes via ARIA live region
    this.announceChange(cardCount);

    const emptyState = this.shadow.getElementById("empty-state")!;
    const container = this.shadow.getElementById("categories-container")!;

    if (entries.length === 0 && !commander) {
      emptyState.style.display = "";
      container.innerHTML = "";
      return;
    }

    emptyState.style.display = "none";

    // Group entries by category
    const grouped = this.groupByCategory(entries);

    container.innerHTML = "";

    for (const [category, categoryEntries] of grouped) {
      const group = this.createCategoryGroup(category, categoryEntries);
      container.appendChild(group);
    }
  }

  private updateCardCount(count: number): void {
    const el = this.shadow.getElementById("card-count")!;
    el.textContent = `${count} / ${MAX_DECK_SIZE}`;
    el.classList.remove("full", "over");

    if (count === MAX_DECK_SIZE) {
      el.classList.add("full");
    } else if (count > MAX_DECK_SIZE) {
      el.classList.add("over");
    }
  }

  private announceChange(currentCount: number): void {
    const liveRegion = this.shadow.getElementById("live-region")!;

    if (this._previousCount === 0 && currentCount === 0) {
      // No change to announce on initial render
      this._previousCount = currentCount;
      return;
    }

    if (currentCount > this._previousCount) {
      liveRegion.textContent = `Card added. Deck now has ${currentCount} of ${MAX_DECK_SIZE} cards.`;
    } else if (currentCount < this._previousCount) {
      liveRegion.textContent = `Card removed. Deck now has ${currentCount} of ${MAX_DECK_SIZE} cards.`;
    } else {
      liveRegion.textContent = `Deck updated. ${currentCount} of ${MAX_DECK_SIZE} cards.`;
    }

    this._previousCount = currentCount;
  }

  private groupByCategory(entries: DeckEntry[]): Map<CardCategory, DeckEntry[]> {
    const grouped = new Map<CardCategory, DeckEntry[]>();

    // Use a stable ordering based on ALL_CATEGORIES
    for (const entry of entries) {
      const list = grouped.get(entry.category);
      if (list) {
        list.push(entry);
      } else {
        grouped.set(entry.category, [entry]);
      }
    }

    // Sort by the predefined category order
    const sorted = new Map<CardCategory, DeckEntry[]>();
    for (const cat of ALL_CATEGORIES) {
      const list = grouped.get(cat);
      if (list && list.length > 0) {
        // Sort cards within category alphabetically
        list.sort((a, b) => a.card.name.localeCompare(b.card.name));
        sorted.set(cat, list);
      }
    }

    return sorted;
  }

  private createCategoryGroup(
    category: CardCategory,
    entries: DeckEntry[],
  ): HTMLElement {
    const group = document.createElement("div");
    group.className = "category-group";
    group.setAttribute("role", "listitem");

    // Category header
    const header = document.createElement("div");
    header.className = "category-header";
    header.setAttribute("tabindex", "0");
    header.setAttribute("aria-label", `${category}: ${entries.length} card${entries.length !== 1 ? "s" : ""}`);

    const nameSpan = document.createElement("span");
    nameSpan.className = "category-name";
    nameSpan.textContent = category;

    const countSpan = document.createElement("span");
    countSpan.className = "category-count";
    countSpan.textContent = `(${entries.length})`;

    header.appendChild(nameSpan);
    header.appendChild(countSpan);
    group.appendChild(header);

    // Card entries
    for (const entry of entries) {
      group.appendChild(this.createCardEntry(entry));
    }

    return group;
  }

  private createCardEntry(entry: DeckEntry): HTMLElement {
    const row = document.createElement("div");
    row.className = "card-entry";

    // Card image
    const imageUri =
      entry.card.imageUris?.small ?? entry.card.cardFaces?.[0]?.imageUris?.small;

    if (imageUri) {
      const img = document.createElement("img");
      img.src = imageUri;
      img.alt = entry.card.name;
      img.loading = "lazy";
      img.addEventListener("error", () => {
        const placeholder = document.createElement("div");
        placeholder.className = "img-placeholder-sm";
        placeholder.textContent = entry.card.name;
        img.replaceWith(placeholder);
      });
      row.appendChild(img);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "img-placeholder-sm";
      placeholder.textContent = entry.card.name;
      row.appendChild(placeholder);
    }

    // Card info
    const info = document.createElement("div");
    info.className = "card-entry-info";

    const nameEl = document.createElement("div");
    nameEl.className = "card-entry-name";
    nameEl.textContent = entry.card.name;
    nameEl.title = entry.card.name;

    const typeEl = document.createElement("div");
    typeEl.className = "card-entry-type";
    typeEl.textContent = entry.card.typeLine;
    typeEl.title = entry.card.typeLine;

    info.appendChild(nameEl);
    info.appendChild(typeEl);
    row.appendChild(info);

    // Category dropdown
    const select = document.createElement("select");
    select.className = "category-select";
    select.setAttribute("aria-label", `Category for ${entry.card.name}`);

    for (const cat of ALL_CATEGORIES) {
      const option = document.createElement("option");
      option.value = cat;
      option.textContent = cat;
      if (cat === entry.category) {
        option.selected = true;
      }
      select.appendChild(option);
    }

    select.addEventListener("change", () => {
      if (this._deckManager) {
        this._deckManager.setCardCategory(
          entry.card.id,
          select.value as CardCategory,
        );
      }
    });

    row.appendChild(select);

    // Remove button
    const removeBtn = document.createElement("button");
    removeBtn.className = "btn-remove";
    removeBtn.setAttribute("aria-label", `Remove ${entry.card.name} from deck`);
    removeBtn.title = `Remove ${entry.card.name}`;
    removeBtn.textContent = "✕";

    removeBtn.addEventListener("click", () => {
      if (this._deckManager) {
        this._deckManager.removeCard(entry.card.id);
      }
    });

    row.appendChild(removeBtn);

    return row;
  }
}
