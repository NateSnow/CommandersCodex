/**
 * `<deck-export>` Web Component
 *
 * Provides deck export functionality with format selection (Text, MTGO),
 * a text preview of the exported deck, and a "Copy to Clipboard" button.
 *
 * Subscribes to `deck-changed` events to keep the preview in sync
 * with the current deck state.
 *
 * Dependencies (set as properties after construction):
 *  - deckManager: DeckManager instance
 */

import type { Deck } from "../models/deck.js";
import type { DeckManager } from "../domain/deck-manager.js";
import { toText, toMTGO } from "../domain/export-formatter.js";
import { subscribe } from "../utils/event-bus.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExportFormat = "text" | "mtgo";

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

  .export-container {
    padding: 16px;
  }

  h2 {
    margin: 0 0 16px 0;
    font-size: 1.25rem;
    color: #fff;
  }

  .empty-state {
    text-align: center;
    padding: 32px 16px;
    color: #888;
    font-size: 0.9rem;
  }

  /* Format selector */
  .format-selector {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .format-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 16px;
    min-height: 44px;
    min-width: 44px;
    font-size: 0.85rem;
    font-weight: 600;
    color: #ccc;
    background: #2a2a2a;
    border: 1px solid #444;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }

  .format-btn:hover {
    background: #333;
    border-color: #666;
  }

  .format-btn:focus-visible {
    outline: 2px solid #7c4dff;
    outline-offset: 2px;
  }

  .format-btn.active {
    background: #7c4dff;
    border-color: #7c4dff;
    color: #fff;
  }

  /* Preview area */
  .preview {
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 12px;
    max-height: 300px;
    overflow-y: auto;
    font-family: "Courier New", Courier, monospace;
    font-size: 0.8rem;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
    color: #ccc;
  }

  /* Copy button */
  .btn-copy {
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
  }

  .btn-copy:hover {
    background: #6a3de8;
  }

  .btn-copy:focus-visible {
    outline: 2px solid #7c4dff;
    outline-offset: 2px;
  }

  .btn-copy:disabled {
    background: #444;
    color: #888;
    cursor: not-allowed;
  }

  /* Confirmation message */
  .copy-confirmation {
    display: none;
    margin-top: 8px;
    padding: 8px 12px;
    font-size: 0.85rem;
    color: #6fbf73;
    background: #1e2a1e;
    border: 1px solid #3a5a3a;
    border-radius: 6px;
  }

  .copy-confirmation.visible {
    display: block;
  }

  @media (max-width: 767px) {
    .preview {
      max-height: 200px;
      font-size: 0.75rem;
    }
  }
</style>

<div class="export-container" role="region" aria-label="Deck export">
  <h2>Export Deck</h2>

  <div class="empty-state" id="empty-state">
    Build a deck to export it.
  </div>

  <div id="content" style="display:none;">
    <div class="format-selector" role="radiogroup" aria-label="Export format">
      <button class="format-btn active" id="btn-text" role="radio" aria-checked="true" aria-label="Text format">Text</button>
      <button class="format-btn" id="btn-mtgo" role="radio" aria-checked="false" aria-label="MTGO format">MTGO</button>
    </div>

    <div class="preview" id="preview" role="textbox" aria-readonly="true" aria-label="Export preview" tabindex="0"></div>

    <button class="btn-copy" id="btn-copy" aria-label="Copy deck list to clipboard">
      Copy to Clipboard
    </button>

    <div class="copy-confirmation" id="copy-confirmation" role="status" aria-live="polite">
      Copied to clipboard!
    </div>
  </div>
</div>
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export class DeckExport extends HTMLElement {
  private shadow: ShadowRoot;
  private _deckManager: DeckManager | null = null;
  private _unsubscribeDeck: (() => void) | null = null;
  private _currentFormat: ExportFormat = "text";
  private _currentExportText = "";
  private _confirmationTimeout: ReturnType<typeof setTimeout> | null = null;

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
    this.renderPreview();
  }

  get deckManager(): DeckManager | null {
    return this._deckManager;
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  connectedCallback(): void {
    this._unsubscribeDeck = subscribe("deck-changed", () => {
      this.renderPreview();
    });

    // Format buttons
    const btnText = this.shadow.getElementById("btn-text")!;
    const btnMtgo = this.shadow.getElementById("btn-mtgo")!;

    btnText.addEventListener("click", () => this.setFormat("text"));
    btnMtgo.addEventListener("click", () => this.setFormat("mtgo"));

    // Copy button
    const btnCopy = this.shadow.getElementById("btn-copy")!;
    btnCopy.addEventListener("click", () => this.copyToClipboard());
  }

  disconnectedCallback(): void {
    if (this._unsubscribeDeck) {
      this._unsubscribeDeck();
    }
    if (this._confirmationTimeout !== null) {
      clearTimeout(this._confirmationTimeout);
    }
  }

  // -----------------------------------------------------------------------
  // Format selection
  // -----------------------------------------------------------------------

  private setFormat(format: ExportFormat): void {
    this._currentFormat = format;

    const btnText = this.shadow.getElementById("btn-text")!;
    const btnMtgo = this.shadow.getElementById("btn-mtgo")!;

    btnText.classList.toggle("active", format === "text");
    btnText.setAttribute("aria-checked", String(format === "text"));

    btnMtgo.classList.toggle("active", format === "mtgo");
    btnMtgo.setAttribute("aria-checked", String(format === "mtgo"));

    this.renderPreview();
  }

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------

  private renderPreview(): void {
    if (!this._deckManager) return;

    const commander = this._deckManager.getCommander();
    const entries = this._deckManager.getCards();

    const emptyState = this.shadow.getElementById("empty-state")!;
    const content = this.shadow.getElementById("content")!;

    if (!commander || entries.length === 0) {
      emptyState.style.display = "";
      content.style.display = "none";
      this._currentExportText = "";
      return;
    }

    emptyState.style.display = "none";
    content.style.display = "";

    // Build a Deck object for the formatter
    const deck: Deck = {
      id: "",
      name: "",
      commander,
      entries,
      createdAt: "",
      updatedAt: "",
    };

    this._currentExportText =
      this._currentFormat === "text" ? toText(deck) : toMTGO(deck);

    const preview = this.shadow.getElementById("preview")!;
    preview.textContent = this._currentExportText;
  }

  // -----------------------------------------------------------------------
  // Clipboard
  // -----------------------------------------------------------------------

  private async copyToClipboard(): Promise<void> {
    if (!this._currentExportText) return;

    try {
      await navigator.clipboard.writeText(this._currentExportText);
      this.showConfirmation();
    } catch {
      // Fallback: select the preview text so the user can copy manually
      const preview = this.shadow.getElementById("preview")!;
      const range = document.createRange();
      range.selectNodeContents(preview);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }

  private showConfirmation(): void {
    const el = this.shadow.getElementById("copy-confirmation")!;
    el.classList.add("visible");

    if (this._confirmationTimeout !== null) {
      clearTimeout(this._confirmationTimeout);
    }

    this._confirmationTimeout = setTimeout(() => {
      el.classList.remove("visible");
      this._confirmationTimeout = null;
    }, 2000);
  }
}
