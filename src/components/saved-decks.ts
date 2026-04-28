/**
 * `<saved-decks>` Web Component
 *
 * Displays a list of saved decks with name, commander name, card count,
 * and last updated date. Provides Load, Delete, and Save Current Deck
 * functionality.
 *
 * Dependencies (set as properties after construction):
 *  - deckManager: DeckManager instance
 *  - localStorageAdapter: LocalStorageAdapter instance
 */

import type { DeckSummary } from "../models/deck.js";
import type { DeckManager } from "../domain/deck-manager.js";
import type { LocalStorageAdapter } from "../data/local-storage-adapter.js";

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

  .saved-decks-container {
    padding: 16px;
  }

  h2 {
    margin: 0 0 16px 0;
    font-size: 1.25rem;
    color: #fff;
  }

  /* Save current deck section */
  .save-section {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    align-items: stretch;
  }

  .save-input {
    flex: 1;
    padding: 8px 12px;
    min-height: 44px;
    font-size: 0.9rem;
    color: #e0e0e0;
    background: #1a1a1a;
    border: 1px solid #444;
    border-radius: 6px;
    outline: none;
  }

  .save-input::placeholder {
    color: #777;
  }

  .save-input:focus {
    border-color: #7c4dff;
  }

  .btn-save {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 16px;
    min-height: 44px;
    min-width: 44px;
    font-size: 0.85rem;
    font-weight: 600;
    color: #fff;
    background: #7c4dff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s;
  }

  .btn-save:hover {
    background: #6a3de8;
  }

  .btn-save:focus-visible {
    outline: 2px solid #7c4dff;
    outline-offset: 2px;
  }

  .btn-save:disabled {
    background: #444;
    color: #888;
    cursor: not-allowed;
  }

  /* Status messages */
  .status-message {
    display: none;
    padding: 8px 12px;
    margin-bottom: 12px;
    font-size: 0.85rem;
    border-radius: 6px;
  }

  .status-message.visible {
    display: block;
  }

  .status-message.success {
    color: #6fbf73;
    background: #1e2a1e;
    border: 1px solid #3a5a3a;
  }

  .status-message.error {
    color: #f5a5a5;
    background: #2a1a1a;
    border: 1px solid #5a2a2a;
  }

  /* Empty state */
  .empty-state {
    text-align: center;
    padding: 32px 16px;
    color: #888;
    font-size: 0.9rem;
  }

  /* Deck list */
  .deck-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .deck-item {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 12px;
    background: #1e1e1e;
    border: 1px solid #333;
    border-radius: 8px;
    margin-bottom: 8px;
    transition: border-color 0.15s;
  }

  .deck-item:hover {
    border-color: #555;
  }

  .deck-item-info {
    flex: 1;
    min-width: 0;
  }

  .deck-item-name {
    font-size: 0.95rem;
    font-weight: 600;
    color: #e0e0e0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 2px;
  }

  .deck-item-meta {
    font-size: 0.75rem;
    color: #999;
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .deck-item-meta span {
    white-space: nowrap;
  }

  .deck-item-actions {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }

  .btn-load,
  .btn-delete {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 12px;
    min-height: 44px;
    min-width: 44px;
    font-size: 0.8rem;
    font-weight: 600;
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }

  .btn-load {
    color: #7c4dff;
    background: #2a2040;
    border-color: #3a3060;
  }

  .btn-load:hover {
    background: #3a2a60;
    border-color: #5a4a80;
  }

  .btn-load:focus-visible {
    outline: 2px solid #7c4dff;
    outline-offset: 2px;
  }

  .btn-delete {
    color: #f5a5a5;
    background: transparent;
    border-color: transparent;
  }

  .btn-delete:hover {
    background: #3d1c1c;
    border-color: #7a2e2e;
  }

  .btn-delete:focus-visible {
    outline: 2px solid #7c4dff;
    outline-offset: 2px;
  }

  @media (max-width: 767px) {
    .deck-item {
      flex-direction: column;
      align-items: stretch;
    }

    .deck-item-actions {
      justify-content: flex-end;
    }

    .save-section {
      flex-direction: column;
    }
  }
</style>

<div class="saved-decks-container" role="region" aria-label="Saved decks">
  <h2>Saved Decks</h2>

  <div class="save-section">
    <input
      type="text"
      class="save-input"
      id="save-name-input"
      placeholder="Enter deck name…"
      aria-label="Deck name"
    />
    <button class="btn-save" id="btn-save" aria-label="Save current deck">
      Save Current Deck
    </button>
  </div>

  <div class="status-message" id="status-message" role="status" aria-live="polite"></div>

  <div class="empty-state" id="empty-state">
    No saved decks yet. Build a deck and save it above.
  </div>

  <ul class="deck-list" id="deck-list" role="list" aria-label="Saved deck list"></ul>
</div>
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export class SavedDecks extends HTMLElement {
  private shadow: ShadowRoot;
  private _deckManager: DeckManager | null = null;
  private _localStorageAdapter: LocalStorageAdapter | null = null;
  private _statusTimeout: ReturnType<typeof setTimeout> | null = null;

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

  set localStorageAdapter(adapter: LocalStorageAdapter) {
    this._localStorageAdapter = adapter;
    this.renderDeckList();
  }

  get localStorageAdapter(): LocalStorageAdapter | null {
    return this._localStorageAdapter;
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  connectedCallback(): void {
    // Save button
    const btnSave = this.shadow.getElementById("btn-save")!;
    btnSave.addEventListener("click", () => this.saveDeck());

    // Allow Enter key in the input to trigger save
    const input = this.shadow.getElementById("save-name-input") as HTMLInputElement;
    input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        this.saveDeck();
      }
    });

    this.renderDeckList();
  }

  disconnectedCallback(): void {
    if (this._statusTimeout !== null) {
      clearTimeout(this._statusTimeout);
    }
  }

  // -----------------------------------------------------------------------
  // Save deck
  // -----------------------------------------------------------------------

  private saveDeck(): void {
    const input = this.shadow.getElementById("save-name-input") as HTMLInputElement;
    const name = input.value.trim();

    if (!name) {
      this.showStatus("Please enter a deck name.", "error");
      return;
    }

    if (!this._deckManager) {
      this.showStatus("Deck manager not available.", "error");
      return;
    }

    if (!this._deckManager.getCommander()) {
      this.showStatus("Select a commander before saving.", "error");
      return;
    }

    const result = this._deckManager.saveDeck(name);

    if (result.ok) {
      this.showStatus(`Deck "${name}" saved successfully.`, "success");
      input.value = "";
      this.renderDeckList();
    } else {
      this.showStatus(result.error.message, "error");
    }
  }

  // -----------------------------------------------------------------------
  // Load deck
  // -----------------------------------------------------------------------

  private async loadDeck(deckId: string): Promise<void> {
    if (!this._deckManager) {
      this.showStatus("Deck manager not available.", "error");
      return;
    }

    this.showStatus("Loading deck…", "success");

    const result = await this._deckManager.loadDeck(deckId);

    if (result.ok) {
      this.showStatus("Deck loaded successfully.", "success");
    } else {
      this.showStatus(result.error.message, "error");
    }
  }

  // -----------------------------------------------------------------------
  // Delete deck
  // -----------------------------------------------------------------------

  private deleteDeck(deckId: string, deckName: string): void {
    if (!this._localStorageAdapter) {
      this.showStatus("Storage adapter not available.", "error");
      return;
    }

    try {
      this._localStorageAdapter.deleteDeck(deckId);
      this.showStatus(`Deck "${deckName}" deleted.`, "success");
      this.renderDeckList();
    } catch {
      this.showStatus("Failed to delete deck. Data may be corrupted.", "error");
    }
  }

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------

  private renderDeckList(): void {
    const emptyState = this.shadow.getElementById("empty-state")!;
    const listEl = this.shadow.getElementById("deck-list")!;

    if (!this._localStorageAdapter) {
      emptyState.style.display = "";
      listEl.innerHTML = "";
      return;
    }

    let decks: DeckSummary[];
    try {
      decks = this._localStorageAdapter.listDecks();
    } catch {
      emptyState.style.display = "none";
      listEl.innerHTML = "";
      this.showStatus(
        "Could not load saved decks. Data may be corrupted. You can start a new deck.",
        "error",
      );
      return;
    }

    if (decks.length === 0) {
      emptyState.style.display = "";
      listEl.innerHTML = "";
      return;
    }

    emptyState.style.display = "none";
    listEl.innerHTML = "";

    // Sort by most recently updated
    const sorted = [...decks].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    for (const deck of sorted) {
      listEl.appendChild(this.createDeckItem(deck));
    }
  }

  private createDeckItem(deck: DeckSummary): HTMLElement {
    const li = document.createElement("li");
    li.className = "deck-item";
    li.setAttribute("role", "listitem");

    // Info section
    const info = document.createElement("div");
    info.className = "deck-item-info";

    const nameEl = document.createElement("div");
    nameEl.className = "deck-item-name";
    nameEl.textContent = deck.name;
    nameEl.title = deck.name;

    const meta = document.createElement("div");
    meta.className = "deck-item-meta";

    const commanderSpan = document.createElement("span");
    commanderSpan.textContent = deck.commanderName;

    const countSpan = document.createElement("span");
    countSpan.textContent = `${deck.cardCount} cards`;

    const dateSpan = document.createElement("span");
    dateSpan.textContent = this.formatDate(deck.updatedAt);

    meta.appendChild(commanderSpan);
    meta.appendChild(countSpan);
    meta.appendChild(dateSpan);

    info.appendChild(nameEl);
    info.appendChild(meta);

    // Actions
    const actions = document.createElement("div");
    actions.className = "deck-item-actions";

    const loadBtn = document.createElement("button");
    loadBtn.className = "btn-load";
    loadBtn.textContent = "Load";
    loadBtn.setAttribute("aria-label", `Load deck ${deck.name}`);
    loadBtn.addEventListener("click", () => this.loadDeck(deck.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-delete";
    deleteBtn.textContent = "Delete";
    deleteBtn.setAttribute("aria-label", `Delete deck ${deck.name}`);
    deleteBtn.addEventListener("click", () => this.deleteDeck(deck.id, deck.name));

    actions.appendChild(loadBtn);
    actions.appendChild(deleteBtn);

    li.appendChild(info);
    li.appendChild(actions);

    return li;
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private formatDate(isoString: string): string {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return isoString;
    }
  }

  private showStatus(message: string, type: "success" | "error"): void {
    const el = this.shadow.getElementById("status-message")!;
    el.textContent = message;
    el.classList.remove("success", "error");
    el.classList.add(type, "visible");

    if (this._statusTimeout !== null) {
      clearTimeout(this._statusTimeout);
    }

    this._statusTimeout = setTimeout(() => {
      el.classList.remove("visible");
      this._statusTimeout = null;
    }, 4000);
  }
}
