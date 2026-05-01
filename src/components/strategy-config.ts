/**
 * `<strategy-config>` Web Component — Magical Glowing Theme
 *
 * Configure deck generation: archetype, bracket, combos, land count.
 * Styled with a magical glowing aesthetic.
 */

import type { Archetype, BracketLevel } from "../models/generation.js";
import { ARCHETYPE_INFO, BRACKET_INFO } from "../models/generation.js";
import { subscribe } from "../utils/event-bus.js";

const template = document.createElement("template");
template.innerHTML = `
<style>
  :host {
    display: block;
    font-family: 'Crimson Text', Georgia, serif;
    color: #e8e0f0;
  }

  * { box-sizing: border-box; }

  .config-container { padding: 20px; }

  h2 {
    margin: 0 0 4px 0;
    font-family: 'Cinzel', Georgia, serif;
    font-size: 1.1rem;
    font-weight: 600;
    color: #f0d078;
    letter-spacing: 0.04em;
    text-shadow: 0 1px 3px rgba(0,0,0,0.4);
  }

  .divider {
    text-align: center;
    color: #2a2840;
    font-size: 0.8rem;
    letter-spacing: 0.4em;
    margin: 4px 0 16px;
    user-select: none;
  }

  .section { margin-bottom: 18px; }

  .section-label {
    font-family: 'Cinzel', Georgia, serif;
    font-size: 0.75rem;
    font-weight: 600;
    color: #d4a843;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 8px;
  }

  /* Archetype grid */
  .archetype-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 6px;
  }

  .archetype-option {
    padding: 8px 10px;
    background: rgba(30,28,48,0.5);
    border: 1px solid #2a2840;
    border-radius: 6px;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
    min-height: 44px;
    text-align: center;
  }

  .archetype-option:hover {
    border-color: #3a3860;
    background: rgba(30,28,48,0.7);
  }

  .archetype-option:focus-visible {
    outline: 2px solid #d4a843;
    outline-offset: 2px;
  }

  .archetype-option.selected {
    border-color: #d4a843;
    background: rgba(139,92,246,0.1);
    box-shadow: 0 0 15px rgba(139,92,246,0.15);
  }

  .archetype-name {
    font-family: 'Cinzel', Georgia, serif;
    font-size: 0.8rem;
    font-weight: 600;
    color: #f0d078;
    margin-bottom: 2px;
  }

  .archetype-desc {
    font-size: 0.65rem;
    color: #6b6580;
    line-height: 1.3;
    font-style: italic;
  }

  .archetype-option.selected .archetype-name { color: #f0d078; }
  .archetype-option.selected .archetype-desc { color: #d4a843; }

  /* Bracket selector */
  .bracket-options { display: flex; gap: 6px; flex-wrap: wrap; }

  .bracket-option {
    flex: 1;
    min-width: 100px;
    padding: 8px 10px;
    background: rgba(30,28,48,0.5);
    border: 1px solid #2a2840;
    border-radius: 6px;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    min-height: 44px;
    text-align: center;
  }

  .bracket-option:hover { border-color: #3a3860; background: rgba(30,28,48,0.7); }
  .bracket-option:focus-visible { outline: 2px solid #d4a843; outline-offset: 2px; }

  .bracket-option.selected {
    border-color: #d4a843;
    background: rgba(139,92,246,0.1);
  }

  .bracket-number {
    font-family: 'Cinzel', Georgia, serif;
    font-size: 1.1rem;
    font-weight: 700;
    color: #f0d078;
  }

  .bracket-desc {
    font-size: 0.65rem;
    color: #6b6580;
    margin-top: 2px;
    font-style: italic;
  }

  .bracket-option.selected .bracket-number { color: #f0d078; }
  .bracket-option.selected .bracket-desc { color: #d4a843; }

  /* Toggle */
  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 0;
    gap: 12px;
  }

  .toggle-label-text { font-size: 0.95rem; color: #e8e0f0; }
  .toggle-sublabel { font-size: 0.75rem; color: #6b6580; margin-top: 2px; font-style: italic; }

  .toggle-switch { position: relative; width: 48px; height: 26px; flex-shrink: 0; }
  .toggle-switch input { opacity: 0; width: 0; height: 0; }

  .toggle-slider {
    position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
    background: #2a2840; border-radius: 26px; transition: background 0.3s;
  }

  .toggle-slider::before {
    content: ""; position: absolute; height: 20px; width: 20px; left: 3px; bottom: 3px;
    background: #e8e0f0; border-radius: 50%; transition: transform 0.3s;
  }

  .toggle-switch input:checked + .toggle-slider { background: #8b5cf6; }
  .toggle-switch input:checked + .toggle-slider::before { transform: translateX(22px); }
  .toggle-switch input:focus-visible + .toggle-slider { outline: 2px solid #d4a843; outline-offset: 2px; }

  /* Slider */
  .slider-row { display: flex; align-items: center; gap: 12px; }
  .slider-row input[type="range"] { flex: 1; accent-color: #d4a843; min-height: 44px; }
  .slider-value {
    font-family: 'Cinzel', Georgia, serif;
    font-size: 1rem; font-weight: 700; color: #f0d078; min-width: 30px; text-align: center;
  }

  /* Generate button */
  .btn-generate {
    display: flex; align-items: center; justify-content: center;
    width: 100%; padding: 14px 24px;
    font-family: 'Cinzel', Georgia, serif;
    font-size: 1.05rem; font-weight: 700; letter-spacing: 0.05em;
    color: #fff;
    background: linear-gradient(180deg, #a78bfa 0%, #8b5cf6 100%);
    border: 2px solid #6d28d9;
    border-radius: 8px; cursor: pointer; min-height: 48px;
    transition: background 0.2s, transform 0.1s, box-shadow 0.2s;
    margin-top: 8px;
    text-shadow: 0 0 10px rgba(139,92,246,0.5);
    box-shadow: 0 4px 20px rgba(139,92,246,0.3), 0 0 40px rgba(139,92,246,0.1);
  }

  .btn-generate:hover:not(:disabled) {
    background: linear-gradient(180deg, #c4b5fd 0%, #a78bfa 100%);
    transform: translateY(-1px);
    box-shadow: 0 6px 30px rgba(139,92,246,0.4), 0 0 60px rgba(139,92,246,0.15);
  }

  .btn-generate:active:not(:disabled) { transform: translateY(0); }
  .btn-generate:focus-visible { outline: 2px solid #d4a843; outline-offset: 2px; }

  .btn-generate:disabled {
    background: linear-gradient(180deg, #2a2840 0%, #1e1c30 100%);
    border-color: #2a2840;
    color: #6b6580; cursor: not-allowed; opacity: 0.7; transform: none;
    box-shadow: none; text-shadow: none;
  }

  .btn-generate.generating {
    background: linear-gradient(180deg, #2a2840 0%, #1e1c30 100%);
    border-color: #2a2840; color: #8b5cf6; cursor: wait;
  }

  .no-commander-hint {
    display: none; font-size: 0.85rem; color: #6b6580; text-align: center;
    padding: 8px; font-style: italic;
  }

  .no-commander-hint.visible { display: block; }

  @media (max-width: 767px) {
    .archetype-grid { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); }
    .bracket-options { flex-direction: column; }
    .bracket-option { min-width: unset; }
  }
</style>

<div class="config-container">
  <h2>🔮 Strategy</h2>
  <div class="divider">✦ ✦ ✦</div>

  <div class="section">
    <div class="section-label">Archetype</div>
    <div class="archetype-grid" id="archetype-grid" role="radiogroup" aria-label="Deck archetype"></div>
  </div>

  <div class="section">
    <div class="section-label">Bracket Level</div>
    <div class="bracket-options" id="bracket-options" role="radiogroup" aria-label="Bracket level"></div>
  </div>

  <div class="section">
    <div class="toggle-row">
      <div>
        <div class="toggle-label-text">♾️ Include Infinite Combos</div>
        <div class="toggle-sublabel">Weave a combo package from Commander Spellbook</div>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" id="combo-toggle" aria-label="Include infinite combos" />
        <span class="toggle-slider"></span>
      </label>
    </div>
  </div>

  <div class="section">
    <div class="section-label">Land Count</div>
    <div class="slider-row">
      <input type="range" id="land-slider" min="30" max="42" value="37" aria-label="Number of lands" />
      <span class="slider-value" id="land-value">37</span>
    </div>
  </div>

  <div class="no-commander-hint" id="no-commander-hint">
    Select a commander above to begin
  </div>

  <button class="btn-generate" id="btn-generate" disabled aria-label="Generate Deck">
    ✨ Inscribe the Deck ✨
  </button>
</div>
`;

export class StrategyConfig extends HTMLElement {
  private shadow: ShadowRoot;
  private _selectedArchetype: Archetype = "balanced";
  private _selectedBracket: BracketLevel = 2;
  private _hasCommander = false;
  private _generating = false;
  private _unsubCommander: (() => void) | null = null;
  private _unsubComplete: (() => void) | null = null;
  private _unsubError: (() => void) | null = null;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: "open" });
    this.shadow.appendChild(template.content.cloneNode(true));
  }

  connectedCallback(): void {
    this.renderArchetypes();
    this.renderBrackets();
    this.shadow.getElementById("land-slider")!.addEventListener("input", (e) => {
      this.shadow.getElementById("land-value")!.textContent = (e.target as HTMLInputElement).value;
    });
    this.shadow.getElementById("btn-generate")!.addEventListener("click", this.handleGenerate);
    this._unsubCommander = subscribe("commander-changed", () => { this._hasCommander = true; this.updateBtn(); });
    this._unsubComplete = subscribe("generation-complete", () => { this._generating = false; this.updateBtn(); });
    this._unsubError = subscribe("generation-error", () => { this._generating = false; this.updateBtn(); });
  }

  disconnectedCallback(): void { this._unsubCommander?.(); this._unsubComplete?.(); this._unsubError?.(); }

  private renderArchetypes(): void {
    const grid = this.shadow.getElementById("archetype-grid")!;
    for (const [key, info] of Object.entries(ARCHETYPE_INFO) as [Archetype, { label: string; description: string }][]) {
      const el = document.createElement("div");
      el.className = `archetype-option${key === this._selectedArchetype ? " selected" : ""}`;
      el.setAttribute("role", "radio"); el.setAttribute("aria-checked", key === this._selectedArchetype ? "true" : "false");
      el.setAttribute("tabindex", "0"); el.dataset.archetype = key;
      el.innerHTML = `<div class="archetype-name">${info.label}</div><div class="archetype-desc">${info.description}</div>`;
      el.addEventListener("click", () => this.selectArchetype(key));
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.selectArchetype(key); } });
      grid.appendChild(el);
    }
  }

  private renderBrackets(): void {
    const container = this.shadow.getElementById("bracket-options")!;
    for (const [key, info] of Object.entries(BRACKET_INFO) as [string, { label: string; description: string }][]) {
      const level = Number(key) as BracketLevel;
      const el = document.createElement("div");
      el.className = `bracket-option${level === this._selectedBracket ? " selected" : ""}`;
      el.setAttribute("role", "radio"); el.setAttribute("aria-checked", level === this._selectedBracket ? "true" : "false");
      el.setAttribute("tabindex", "0"); el.dataset.bracket = key;
      el.innerHTML = `<div class="bracket-number">${key}</div><div class="bracket-desc">${info.description}</div>`;
      el.addEventListener("click", () => this.selectBracket(level));
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.selectBracket(level); } });
      container.appendChild(el);
    }
  }

  private selectArchetype(a: Archetype): void {
    this._selectedArchetype = a;
    for (const el of this.shadow.getElementById("archetype-grid")!.querySelectorAll<HTMLElement>(".archetype-option")) {
      const s = el.dataset.archetype === a; el.classList.toggle("selected", s); el.setAttribute("aria-checked", s ? "true" : "false");
    }
  }

  private selectBracket(l: BracketLevel): void {
    this._selectedBracket = l;
    for (const el of this.shadow.getElementById("bracket-options")!.querySelectorAll<HTMLElement>(".bracket-option")) {
      const s = el.dataset.bracket === String(l); el.classList.toggle("selected", s); el.setAttribute("aria-checked", s ? "true" : "false");
    }
  }

  private handleGenerate = (): void => {
    if (!this._hasCommander || this._generating) return;
    this._generating = true; this.updateBtn();
    this.dispatchEvent(new CustomEvent("generate-deck", {
      detail: {
        archetype: this._selectedArchetype,
        bracketLevel: this._selectedBracket,
        includeInfiniteCombos: (this.shadow.getElementById("combo-toggle") as HTMLInputElement).checked,
        landCount: Number((this.shadow.getElementById("land-slider") as HTMLInputElement).value),
      },
      bubbles: true, composed: true,
    }));
  };

  private updateBtn(): void {
    const btn = this.shadow.getElementById("btn-generate") as HTMLButtonElement;
    const hint = this.shadow.getElementById("no-commander-hint")!;
    if (!this._hasCommander) { btn.disabled = true; btn.textContent = "✨ Inscribe the Deck ✨"; hint.classList.add("visible"); return; }
    hint.classList.remove("visible");
    if (this._generating) { btn.disabled = true; btn.textContent = "⏳ Inscribing..."; btn.classList.add("generating"); }
    else { btn.disabled = false; btn.textContent = "✨ Inscribe the Deck ✨"; btn.classList.remove("generating"); }
  }
}
