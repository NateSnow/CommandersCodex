/**
 * `<deck-validation>` Web Component
 *
 * Provides a "Validate Deck" button that runs the DeckValidator against
 * the current deck and displays the results. On success, shows a
 * confirmation message. On failure, lists each violation with card name
 * and rule description.
 *
 * Dependencies (set as properties after construction):
 *  - deckManager: DeckManager instance
 */

import type { Deck } from "../models/deck.js";
import type { Violation } from "../models/validation.js";
import type { DeckManager } from "../domain/deck-manager.js";
import { validate } from "../domain/deck-validator.js";
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

  .validation-container {
    padding: 16px;
  }

  h2 {
    margin: 0 0 16px 0;
    font-size: 1.25rem;
    color: #fff;
  }

  /* Validate button */
  .btn-validate {
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

  .btn-validate:hover {
    background: #6a3de8;
  }

  .btn-validate:focus-visible {
    outline: 2px solid #7c4dff;
    outline-offset: 2px;
  }

  .btn-validate:disabled {
    background: #444;
    color: #888;
    cursor: not-allowed;
  }

  /* Results area */
  .results {
    display: none;
  }

  .results.visible {
    display: block;
  }

  /* Success message */
  .result-success {
    display: none;
    padding: 12px 16px;
    font-size: 0.9rem;
    color: #6fbf73;
    background: #1e2a1e;
    border: 1px solid #3a5a3a;
    border-radius: 8px;
  }

  .result-success.visible {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .result-success-icon {
    font-size: 1.2rem;
    flex-shrink: 0;
  }

  /* Failure section */
  .result-failure {
    display: none;
  }

  .result-failure.visible {
    display: block;
  }

  .result-failure-header {
    padding: 10px 16px;
    font-size: 0.9rem;
    font-weight: 600;
    color: #f5a5a5;
    background: #2a1a1a;
    border: 1px solid #5a2a2a;
    border-radius: 8px 8px 0 0;
  }

  /* Violation list */
  .violation-list {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid #5a2a2a;
    border-top: none;
    border-radius: 0 0 8px 8px;
    overflow: hidden;
  }

  .violation-item {
    display: flex;
    gap: 10px;
    padding: 10px 16px;
    font-size: 0.85rem;
    border-bottom: 1px solid #3a2020;
    align-items: flex-start;
  }

  .violation-item:last-child {
    border-bottom: none;
  }

  .violation-rule {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #f5a5a5;
    background: #3d1c1c;
    padding: 2px 6px;
    border-radius: 4px;
    white-space: nowrap;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .violation-detail {
    flex: 1;
    min-width: 0;
  }

  .violation-card-name {
    font-weight: 600;
    color: #e0e0e0;
  }

  .violation-description {
    color: #bbb;
    margin-top: 2px;
    line-height: 1.4;
  }

  /* Empty state hint */
  .hint {
    font-size: 0.8rem;
    color: #888;
    margin-bottom: 12px;
  }

  @media (max-width: 767px) {
    .violation-item {
      flex-direction: column;
      gap: 4px;
    }
  }
</style>

<div class="validation-container" role="region" aria-label="Deck validation">
  <h2>Validate Deck</h2>

  <p class="hint" id="hint">Check if your deck is legal for Commander format.</p>

  <button class="btn-validate" id="btn-validate" aria-label="Validate deck against Commander format rules">
    Validate Deck
  </button>

  <div class="results" id="results" aria-live="polite">
    <div class="result-success" id="result-success" role="status">
      <span class="result-success-icon" aria-hidden="true">✓</span>
      <span>Deck is legal for Commander format!</span>
    </div>

    <div class="result-failure" id="result-failure">
      <div class="result-failure-header" id="result-failure-header" role="alert"></div>
      <ul class="violation-list" id="violation-list" role="list" aria-label="Validation violations"></ul>
    </div>
  </div>
</div>
`;

// ---------------------------------------------------------------------------
// Friendly rule labels
// ---------------------------------------------------------------------------

const RULE_LABELS: Record<string, string> = {
  DECK_SIZE: "Deck Size",
  SINGLETON: "Singleton",
  COLOR_IDENTITY: "Color Identity",
  BANNED_CARD: "Banned",
  MISSING_COMMANDER: "Commander",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export class DeckValidation extends HTMLElement {
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
    this.updateButtonState();
  }

  get deckManager(): DeckManager | null {
    return this._deckManager;
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  connectedCallback(): void {
    const btn = this.shadow.getElementById("btn-validate")!;
    btn.addEventListener("click", () => this.validateDeck());

    this._unsubscribeDeck = subscribe("deck-changed", () => {
      // Hide previous results when deck changes
      this.hideResults();
      this.updateButtonState();
    });
  }

  disconnectedCallback(): void {
    if (this._unsubscribeDeck) {
      this._unsubscribeDeck();
    }
  }

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  private validateDeck(): void {
    if (!this._deckManager) return;

    const commander = this._deckManager.getCommander();
    if (!commander) {
      this.showFailure([
        {
          rule: "MISSING_COMMANDER",
          cardName: "",
          description: "Select a commander before validating.",
        },
      ]);
      return;
    }

    const entries = this._deckManager.getCards();

    // Build a Deck object for the validator
    const deck: Deck = {
      id: "",
      name: "",
      commander,
      entries,
      createdAt: "",
      updatedAt: "",
    };

    const result = validate(deck);

    if (result.isLegal) {
      this.showSuccess();
    } else {
      this.showFailure(result.violations);
    }
  }

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------

  private updateButtonState(): void {
    const btn = this.shadow.getElementById("btn-validate") as HTMLButtonElement;
    if (!this._deckManager || !this._deckManager.getCommander()) {
      btn.disabled = true;
    } else {
      btn.disabled = false;
    }
  }

  private hideResults(): void {
    const results = this.shadow.getElementById("results")!;
    const success = this.shadow.getElementById("result-success")!;
    const failure = this.shadow.getElementById("result-failure")!;

    results.classList.remove("visible");
    success.classList.remove("visible");
    failure.classList.remove("visible");
  }

  private showSuccess(): void {
    const results = this.shadow.getElementById("results")!;
    const success = this.shadow.getElementById("result-success")!;
    const failure = this.shadow.getElementById("result-failure")!;

    results.classList.add("visible");
    success.classList.add("visible");
    failure.classList.remove("visible");
  }

  private showFailure(violations: Violation[]): void {
    const results = this.shadow.getElementById("results")!;
    const success = this.shadow.getElementById("result-success")!;
    const failure = this.shadow.getElementById("result-failure")!;
    const header = this.shadow.getElementById("result-failure-header")!;
    const list = this.shadow.getElementById("violation-list")!;

    results.classList.add("visible");
    success.classList.remove("visible");
    failure.classList.add("visible");

    header.textContent = `Deck is not legal — ${violations.length} violation${violations.length !== 1 ? "s" : ""} found`;

    list.innerHTML = "";

    for (const violation of violations) {
      const li = document.createElement("li");
      li.className = "violation-item";
      li.setAttribute("role", "listitem");

      // Rule badge
      const ruleBadge = document.createElement("span");
      ruleBadge.className = "violation-rule";
      ruleBadge.textContent = RULE_LABELS[violation.rule] ?? violation.rule;

      // Detail section
      const detail = document.createElement("div");
      detail.className = "violation-detail";

      if (violation.cardName) {
        const cardNameEl = document.createElement("div");
        cardNameEl.className = "violation-card-name";
        cardNameEl.textContent = violation.cardName;
        detail.appendChild(cardNameEl);
      }

      const descEl = document.createElement("div");
      descEl.className = "violation-description";
      descEl.textContent = violation.description;
      detail.appendChild(descEl);

      li.appendChild(ruleBadge);
      li.appendChild(detail);
      list.appendChild(li);
    }
  }
}
