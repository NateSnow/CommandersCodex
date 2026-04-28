/**
 * `<deck-generator-progress>` Web Component
 *
 * Displays a progress indicator during deck generation. Shows the
 * current phase name and a progress bar. Auto-dismisses on completion
 * or error. Displays error messages with `role="alert"` for screen
 * reader announcement.
 *
 * Subscribes to event bus events:
 *  - generation-progress: updates phase and progress bar
 *  - generation-complete: auto-dismisses the indicator
 *  - generation-error: shows error message, then auto-dismisses
 */

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

  .progress-container {
    display: none;
    padding: 16px;
    background: #1e1e2e;
    border: 1px solid #444;
    border-radius: 8px;
    margin: 12px 0;
  }

  .progress-container.visible {
    display: block;
  }

  .phase-label {
    font-size: 0.95rem;
    font-weight: 600;
    color: #fff;
    margin-bottom: 8px;
  }

  .progress-bar-track {
    width: 100%;
    height: 12px;
    background: #333;
    border-radius: 6px;
    overflow: hidden;
    margin-bottom: 4px;
  }

  .progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #7c4dff, #b388ff);
    border-radius: 6px;
    transition: width 0.4s ease;
    width: 0%;
  }

  .progress-percent {
    font-size: 0.8rem;
    color: #aaa;
    text-align: right;
  }

  .error-container {
    display: none;
    padding: 12px 16px;
    margin-top: 8px;
    background: #3d1c1c;
    border: 1px solid #7a2e2e;
    border-radius: 8px;
    color: #f5a5a5;
    font-size: 0.9rem;
  }

  .error-container.visible {
    display: block;
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
    .progress-container {
      margin: 8px 0;
      padding: 12px;
    }
  }
</style>

<div class="progress-container" id="progress-container">
  <div class="phase-label" id="phase-label">Initializing...</div>

  <div class="progress-bar-track">
    <div
      class="progress-bar-fill"
      id="progress-bar-fill"
      role="progressbar"
      aria-valuenow="0"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuetext="0% complete"
      aria-label="Deck generation progress"
    ></div>
  </div>

  <div class="progress-percent" id="progress-percent">0%</div>
</div>

<div class="error-container" id="error-container" role="alert"></div>

<div aria-live="polite" id="live-region" class="sr-only"></div>
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export class DeckGeneratorProgress extends HTMLElement {
  private shadow: ShadowRoot;
  private _dismissTimer: ReturnType<typeof setTimeout> | null = null;

  private _unsubProgress: (() => void) | null = null;
  private _unsubComplete: (() => void) | null = null;
  private _unsubError: (() => void) | null = null;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: "open" });
    this.shadow.appendChild(template.content.cloneNode(true));
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  connectedCallback(): void {
    this._unsubProgress = subscribe("generation-progress", (event) => {
      const { phase, percentComplete } = event.detail;
      this.showProgress(phase, percentComplete);
    });

    this._unsubComplete = subscribe("generation-complete", () => {
      this.updateProgress("Complete!", 100);
      this.announce("Deck generation complete.");
      this.scheduleDismiss(1500);
    });

    this._unsubError = subscribe("generation-error", (event) => {
      this.showError(event.detail.message);
      this.announce(`Generation error: ${event.detail.message}`);
      this.scheduleDismiss(5000);
    });
  }

  disconnectedCallback(): void {
    this._unsubProgress?.();
    this._unsubComplete?.();
    this._unsubError?.();
    if (this._dismissTimer) clearTimeout(this._dismissTimer);
  }

  // -----------------------------------------------------------------------
  // Progress display
  // -----------------------------------------------------------------------

  private showProgress(phase: string, percent: number): void {
    this.clearDismissTimer();
    this.hideError();

    const container = this.shadow.getElementById("progress-container")!;
    container.classList.add("visible");

    this.updateProgress(phase, percent);
    this.announce(`${phase}: ${percent}% complete`);
  }

  private updateProgress(phase: string, percent: number): void {
    const clamped = Math.max(0, Math.min(100, percent));

    const phaseLabel = this.shadow.getElementById("phase-label")!;
    phaseLabel.textContent = phase;

    const fill = this.shadow.getElementById("progress-bar-fill")!;
    fill.style.width = `${clamped}%`;
    fill.setAttribute("aria-valuenow", String(clamped));
    fill.setAttribute("aria-valuetext", `${clamped}% complete — ${phase}`);

    const percentLabel = this.shadow.getElementById("progress-percent")!;
    percentLabel.textContent = `${clamped}%`;
  }

  // -----------------------------------------------------------------------
  // Error display
  // -----------------------------------------------------------------------

  private showError(message: string): void {
    const errorContainer = this.shadow.getElementById("error-container")!;
    errorContainer.textContent = message;
    errorContainer.classList.add("visible");

    // Hide the progress bar when showing an error
    const container = this.shadow.getElementById("progress-container")!;
    container.classList.remove("visible");
  }

  private hideError(): void {
    const errorContainer = this.shadow.getElementById("error-container")!;
    errorContainer.textContent = "";
    errorContainer.classList.remove("visible");
  }

  // -----------------------------------------------------------------------
  // Dismiss logic
  // -----------------------------------------------------------------------

  private scheduleDismiss(delayMs: number): void {
    this.clearDismissTimer();
    this._dismissTimer = setTimeout(() => {
      this.dismiss();
    }, delayMs);
  }

  private clearDismissTimer(): void {
    if (this._dismissTimer) {
      clearTimeout(this._dismissTimer);
      this._dismissTimer = null;
    }
  }

  private dismiss(): void {
    const container = this.shadow.getElementById("progress-container")!;
    container.classList.remove("visible");
    this.hideError();

    // Reset progress bar
    this.updateProgress("Initializing...", 0);
  }

  // -----------------------------------------------------------------------
  // Accessibility
  // -----------------------------------------------------------------------

  private announce(message: string): void {
    const liveRegion = this.shadow.getElementById("live-region")!;
    liveRegion.textContent = message;
  }
}
