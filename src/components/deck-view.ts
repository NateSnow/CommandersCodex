/**
 * `<deck-view>` — Moxfield-style list + Magical Glowing Theme
 *
 * Features a dramatic spell-casting animation during generation,
 * with floating runes, pulsing glow, and a reveal animation when
 * the deck appears.
 */

import type { Card, Color } from "../models/card.js";
import type { Deck, DeckEntry, CardCategory } from "../models/deck.js";
import type { GenerationResult } from "../models/generation.js";
import { ARCHETYPE_INFO } from "../models/generation.js";
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

const TYPE_COLORS: Record<string, string> = {
  Creature: "#22c55e", Instant: "#3b82f6", Sorcery: "#ef4444",
  Artifact: "#94a3b8", Enchantment: "#a855f7", Planeswalker: "#f59e0b",
  Land: "#a07820", Ramp: "#10b981", Removal: "#dc2626",
  "Card Draw": "#2563eb", Protection: "#eab308", Custom: "#6b7280",
};

const RUNES = ["ᚠ","ᚢ","ᚦ","ᚨ","ᚱ","ᚲ","ᚷ","ᚹ","ᚺ","ᚾ","ᛁ","ᛃ","ᛇ","ᛈ","ᛉ","ᛊ","ᛏ","ᛒ","ᛖ","ᛗ","ᛚ","ᛜ","ᛞ","ᛟ"];

const template = document.createElement("template");

template.innerHTML = `
<style>
  :host { display: block; font-family: 'Crimson Text', Georgia, serif; color: #e8e0f0; }
  * { box-sizing: border-box; }
  .deck-view { padding: 20px; position: relative; }

  /* ---- Empty state ---- */
  .empty-state { text-align: center; padding: 80px 20px; }
  .empty-state .icon {
    font-size: 4rem; margin-bottom: 16px; opacity: 0.4;
    filter: drop-shadow(0 0 15px rgba(139,92,246,0.3));
  }
  .empty-state h3 {
    margin: 0 0 8px 0; font-family: 'Cinzel', Georgia, serif;
    color: #6b6580; font-size: 1.2rem;
  }
  .empty-state p { margin: 0; font-size: 0.95rem; font-style: italic; color: #3a3860; }

  /* ---- MAGICAL GENERATION ANIMATION ---- */
  .progress-section {
    display: none; padding: 60px 24px; text-align: center;
    position: relative; overflow: hidden;
  }
  .progress-section.visible { display: block; }

  /* Spell circle */
  .spell-circle {
    width: 200px; height: 200px; margin: 0 auto 24px;
    position: relative;
    animation: spellPulse 2s ease-in-out infinite;
  }

  .spell-ring {
    position: absolute; inset: 0;
    border: 2px solid rgba(139,92,246,0.3);
    border-radius: 50%;
    animation: ringRotate 8s linear infinite;
  }

  .spell-ring::before {
    content: ''; position: absolute; inset: -4px;
    border: 1px solid rgba(212,168,67,0.2);
    border-radius: 50%;
    animation: ringRotate 12s linear infinite reverse;
  }

  .spell-ring::after {
    content: ''; position: absolute; inset: 8px;
    border: 1px dashed rgba(45,212,191,0.2);
    border-radius: 50%;
    animation: ringRotate 6s linear infinite;
  }

  .spell-glow {
    position: absolute; inset: 20%;
    background: radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%);
    border-radius: 50%;
    animation: glowPulse 1.5s ease-in-out infinite alternate;
  }

  .spell-runes {
    position: absolute; inset: 0;
    animation: ringRotate 15s linear infinite;
  }

  .spell-rune {
    position: absolute;
    font-size: 1.2rem;
    color: rgba(212,168,67,0.5);
    text-shadow: 0 0 8px rgba(212,168,67,0.3);
    animation: runeFlicker 3s ease-in-out infinite;
  }

  /* Floating particles during generation */
  .gen-particles {
    position: absolute; inset: 0; pointer-events: none; overflow: hidden;
  }

  .gen-particle {
    position: absolute;
    width: 3px; height: 3px;
    border-radius: 50%;
    animation: particleFloat 3s ease-in-out infinite;
  }

  @keyframes spellPulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.03); }
  }

  @keyframes ringRotate {
    to { transform: rotate(360deg); }
  }

  @keyframes glowPulse {
    0% { opacity: 0.5; transform: scale(0.9); }
    100% { opacity: 1; transform: scale(1.1); }
  }

  @keyframes runeFlicker {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 0.8; }
  }

  @keyframes particleFloat {
    0% { transform: translateY(100%) translateX(0); opacity: 0; }
    20% { opacity: 1; }
    80% { opacity: 1; }
    100% { transform: translateY(-100vh) translateX(30px); opacity: 0; }
  }

  .progress-phase {
    font-family: 'Cinzel', Georgia, serif;
    font-size: 1.1rem; font-weight: 600;
    color: #a78bfa; margin-bottom: 16px;
    text-shadow: 0 0 15px rgba(139,92,246,0.4);
    animation: textGlow 2s ease-in-out infinite alternate;
  }

  @keyframes textGlow {
    0% { text-shadow: 0 0 10px rgba(139,92,246,0.3); }
    100% { text-shadow: 0 0 25px rgba(139,92,246,0.6), 0 0 50px rgba(139,92,246,0.2); }
  }

  .progress-bar-track {
    width: 100%; max-width: 350px; height: 6px;
    background: #1e1c30; border-radius: 3px;
    overflow: hidden; margin: 0 auto 8px;
    border: 1px solid #2a2840;
    box-shadow: 0 0 10px rgba(139,92,246,0.1);
  }

  .progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #8b5cf6, #a78bfa, #d4a843);
    border-radius: 3px;
    transition: width 0.4s ease;
    width: 0%;
    box-shadow: 0 0 10px rgba(139,92,246,0.5);
  }

  .progress-percent { font-size: 0.8rem; color: #6b6580; }

  /* ---- DECK REVEAL ANIMATION ---- */
  .deck-header {
    display: none; margin-bottom: 20px;
  }
  .deck-header.visible {
    display: block;
    animation: deckReveal 0.8s ease-out;
  }

  @keyframes deckReveal {
    0% { opacity: 0; transform: translateY(20px); filter: blur(4px); }
    60% { filter: blur(0); }
    100% { opacity: 1; transform: translateY(0); }
  }

  /* ---- Error ---- */
  .error-section {
    display: none; padding: 16px;
    background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
    border-radius: 8px; margin-bottom: 16px;
  }
  .error-section.visible { display: block; }
  .error-section p { margin: 0; color: #fca5a5; font-size: 0.9rem; }

  /* ---- Deck meta ---- */
  .deck-meta { display: flex; gap: 20px; align-items: flex-start; margin-bottom: 16px; }

  .commander-image { width: 200px; flex-shrink: 0; }
  .commander-image img {
    width: 100%; border-radius: 10px; display: block;
    box-shadow: 0 6px 24px rgba(0,0,0,0.5), 0 0 40px rgba(139,92,246,0.1);
    transition: box-shadow 0.3s;
  }
  .commander-image img:hover {
    box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 0 60px rgba(139,92,246,0.2);
  }

  .deck-info { flex: 1; min-width: 0; }

  .deck-name {
    font-family: 'Cinzel', Georgia, serif;
    font-size: 1.4rem; font-weight: 700; color: #f0d078;
    margin: 0 0 6px 0;
    text-shadow: 0 0 20px rgba(212,168,67,0.2), 0 2px 4px rgba(0,0,0,0.5);
  }

  .deck-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
  .tag {
    padding: 3px 10px; border-radius: 4px;
    font-family: 'Cinzel', Georgia, serif;
    font-size: 0.65rem; font-weight: 600; letter-spacing: 0.04em;
    background: rgba(139,92,246,0.1); color: #a78bfa;
    border: 1px solid rgba(139,92,246,0.2);
  }

  /* Stats bar */
  .stats-bar {
    display: flex; gap: 1px; margin-bottom: 14px;
    border-radius: 6px; overflow: hidden; height: 24px;
    background: #0f0e1a; border: 1px solid #2a2840;
  }
  .stats-bar-segment {
    display: flex; align-items: center; justify-content: center;
    font-size: 0.65rem; font-weight: 600; color: #fff;
    min-width: 20px; transition: flex 0.3s;
  }
  .stats-bar-segment .seg-label { padding: 0 3px; font-size: 0.6rem; }

  .stats-numbers { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 14px; }
  .stat { text-align: center; }
  .stat-value {
    font-family: 'Cinzel', Georgia, serif;
    font-size: 1.1rem; font-weight: 700; color: #f0d078;
  }
  .stat-label { font-size: 0.65rem; color: #6b6580; text-transform: uppercase; letter-spacing: 0.05em; }

  /* Mana curve */
  .mana-curve { display: flex; align-items: flex-end; gap: 3px; height: 50px; margin-bottom: 14px; padding: 4px 0; }
  .curve-bar-wrapper { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
  .curve-bar {
    width: 100%; max-width: 24px;
    background: linear-gradient(180deg, #a78bfa, #6d28d9);
    border-radius: 2px 2px 0 0; min-height: 2px; margin-top: auto;
    transition: height 0.3s;
    box-shadow: 0 0 6px rgba(139,92,246,0.3);
  }
  .curve-label { font-size: 0.55rem; color: #6b6580; margin-top: 2px; }
  .curve-count { font-size: 0.55rem; color: #a78bfa; margin-bottom: 2px; }

  /* Combo / warnings */
  .combo-info {
    display: none; padding: 12px;
    background: rgba(139,92,246,0.06); border: 1px solid rgba(139,92,246,0.15);
    border-radius: 6px; margin-bottom: 14px;
  }
  .combo-info.visible { display: block; }
  .combo-info h4 { margin: 0 0 4px 0; font-family: 'Cinzel', Georgia, serif; font-size: 0.85rem; color: #a78bfa; }
  .combo-info p { margin: 0; font-size: 0.8rem; color: #a09ab0; font-style: italic; }
  .combo-cards { font-size: 0.85rem; color: #f0d078; margin-top: 4px; }

  .warnings { display: none; margin-bottom: 14px; }
  .warnings.visible { display: block; }
  .warning-item {
    padding: 6px 10px; background: rgba(234,179,8,0.06);
    border: 1px solid rgba(234,179,8,0.15); border-radius: 4px;
    font-size: 0.8rem; color: #eab308; margin-bottom: 4px; font-style: italic;
  }

  /* Actions */
  .actions { display: none; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
  .actions.visible { display: flex; }
  .btn {
    padding: 8px 16px; font-family: 'Crimson Text', Georgia, serif;
    font-size: 0.85rem; font-weight: 600;
    border: 1px solid #2a2840; border-radius: 6px;
    cursor: pointer; min-height: 40px;
    transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
    background: rgba(30,28,48,0.6); color: #a09ab0;
  }
  .btn:hover { background: rgba(30,28,48,0.9); border-color: #3a3860; box-shadow: 0 0 10px rgba(139,92,246,0.1); }
  .btn:focus-visible { outline: 2px solid #8b5cf6; outline-offset: 2px; }
  .btn-primary {
    background: linear-gradient(180deg, #a78bfa 0%, #8b5cf6 100%);
    border-color: #6d28d9; color: #fff;
    font-family: 'Cinzel', Georgia, serif;
    text-shadow: 0 0 8px rgba(139,92,246,0.4);
    box-shadow: 0 2px 12px rgba(139,92,246,0.2);
  }
  .btn-primary:hover { background: linear-gradient(180deg, #c4b5fd 0%, #a78bfa 100%); box-shadow: 0 4px 20px rgba(139,92,246,0.3); }
  .copy-feedback { font-size: 0.8rem; color: #2dd4bf; align-self: center; display: none; font-style: italic; }
  .copy-feedback.visible { display: inline; }

  /* ---- Card list sections ---- */
  .category-section { margin-bottom: 4px; }
  .category-header {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 8px; cursor: pointer; user-select: none;
    border-radius: 4px; transition: background 0.15s;
  }
  .category-header:hover { background: rgba(139,92,246,0.06); }
  .collapse-arrow { font-size: 0.6rem; color: #6b6580; transition: transform 0.2s; width: 12px; text-align: center; }
  .category-header.collapsed .collapse-arrow { transform: rotate(-90deg); }
  .category-name { font-family: 'Cinzel', Georgia, serif; font-size: 0.85rem; font-weight: 600; color: #f0d078; }
  .category-count { font-size: 0.75rem; color: #6b6580; }

  .card-list { padding: 0 0 4px 0; }
  .card-list.collapsed { display: none; }

  .card-row {
    display: flex; align-items: center; gap: 8px;
    padding: 3px 8px 3px 20px; border-radius: 3px;
    transition: background 0.1s; cursor: default; font-size: 0.9rem;
  }
  .card-row:hover { background: rgba(139,92,246,0.05); }
  .card-qty { font-weight: 600; color: #a09ab0; min-width: 20px; text-align: right; font-size: 0.85rem; }
  .card-name-text { flex: 1; color: #e8e0f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .card-mana-cost { font-size: 0.75rem; color: #a09ab0; white-space: nowrap; flex-shrink: 0; }

  /* Hover preview */
  .card-preview {
    display: none; position: fixed; z-index: 1000; pointer-events: none;
    width: 250px; border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.7), 0 0 50px rgba(139,92,246,0.15);
  }
  .card-preview.visible { display: block; }
  .card-preview img { width: 100%; border-radius: 10px; display: block; }

  /* Export modal */
  .export-modal {
    display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    z-index: 1000; background: rgba(0,0,0,0.8);
    align-items: center; justify-content: center; padding: 20px;
  }
  .export-modal.visible { display: flex; }
  .export-modal-content {
    background: #151422; border: 1px solid #2a2840; border-radius: 10px;
    padding: 20px; max-width: 600px; width: 100%; max-height: 80vh; overflow-y: auto;
    box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 0 30px rgba(139,92,246,0.1);
  }
  .export-modal-content h3 { margin: 0 0 12px 0; font-family: 'Cinzel', Georgia, serif; color: #f0d078; }
  .export-modal-content textarea {
    width: 100%; min-height: 300px; background: #0f0e1a; color: #e8e0f0;
    border: 1px solid #2a2840; border-radius: 6px; padding: 12px;
    font-family: 'Courier New', monospace; font-size: 0.85rem; resize: vertical;
  }
  .export-modal-actions { display: flex; gap: 8px; margin-top: 12px; justify-content: flex-end; }

  .section-divider {
    text-align: center; color: #2a2840; font-size: 0.7rem;
    letter-spacing: 0.5em; padding: 8px 0; user-select: none;
  }

  @media (max-width: 767px) {
    .deck-meta { flex-direction: column; align-items: center; text-align: center; }
    .commander-image { width: 180px; }
    .stats-numbers { justify-content: center; }
  }
</style>

<div class="deck-view">
  <div class="empty-state" id="empty-state">
    <div class="icon">✦</div>
    <h3>The pages await your inscription</h3>
    <p>Choose a commander and strategy, then inscribe your deck</p>
  </div>

  <div class="progress-section" id="progress-section" aria-live="polite">
    <div class="gen-particles" id="gen-particles"></div>
    <div class="spell-circle">
      <div class="spell-ring"></div>
      <div class="spell-glow"></div>
      <div class="spell-runes" id="spell-runes"></div>
    </div>
    <div class="progress-phase" id="progress-phase">Channeling mana...</div>
    <div class="progress-bar-track">
      <div class="progress-bar-fill" id="progress-fill" role="progressbar"
           aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
    </div>
    <div class="progress-percent" id="progress-percent">0%</div>
  </div>

  <div class="error-section" id="error-section" role="alert"><p id="error-message"></p></div>

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
      <button class="btn btn-primary" id="btn-regenerate">⟳ Regenerate</button>
      <button class="btn" id="btn-export-text">Export Text</button>
      <button class="btn" id="btn-export-mtgo">Export MTGO</button>
      <button class="btn" id="btn-copy">📋 Copy</button>
      <span class="copy-feedback" id="copy-feedback">Copied!</span>
    </div>
    <div class="section-divider">— ✦ DECK LIST ✦ —</div>
  </div>

  <div id="card-sections"></div>
  <div class="card-preview" id="card-preview"><img id="preview-img" src="" alt="" /></div>

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

export class DeckView extends HTMLElement {
  private shadow: ShadowRoot;
  private _deck: Deck | null = null;
  private _result: GenerationResult | null = null;
  private _unsubProgress: (() => void) | null = null;
  private _unsubComplete: (() => void) | null = null;
  private _unsubError: (() => void) | null = null;
  private _particleInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: "open" });
    this.shadow.appendChild(template.content.cloneNode(true));
  }

  connectedCallback(): void {
    this._unsubProgress = subscribe("generation-progress", (e) => this.showProgress(e.detail.phase, e.detail.percentComplete));
    this._unsubComplete = subscribe("generation-complete", (e) => {
      this._result = e.detail.result; this._deck = e.detail.result.deck;
      this.hideProgress(); this.hideError(); this.renderDeck();
    });
    this._unsubError = subscribe("generation-error", (e) => { this.hideProgress(); this.showError(e.detail.message); });
    this.shadow.getElementById("btn-export-text")!.addEventListener("click", () => this.showExport("text"));
    this.shadow.getElementById("btn-export-mtgo")!.addEventListener("click", () => this.showExport("mtgo"));
    this.shadow.getElementById("btn-copy")!.addEventListener("click", () => this.copyToClipboard());
    this.shadow.getElementById("btn-modal-copy")!.addEventListener("click", () => this.copyModalText());
    this.shadow.getElementById("btn-modal-close")!.addEventListener("click", () => this.hideExportModal());
    this.shadow.getElementById("export-modal")!.addEventListener("click", (e) => { if (e.target === e.currentTarget) this.hideExportModal(); });
    this.shadow.getElementById("btn-regenerate")!.addEventListener("click", () => {
      this.dispatchEvent(new CustomEvent("regenerate-deck", { bubbles: true, composed: true }));
    });
  }

  disconnectedCallback(): void {
    this._unsubProgress?.(); this._unsubComplete?.(); this._unsubError?.();
    this.stopParticles();
  }

  // ---- Spell animation ----
  private initSpellAnimation(): void {
    // Place runes around the circle
    const runesEl = this.shadow.getElementById("spell-runes")!;
    runesEl.innerHTML = "";
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * 360;
      const rad = (angle * Math.PI) / 180;
      const x = 50 + 42 * Math.cos(rad);
      const y = 50 + 42 * Math.sin(rad);
      const rune = document.createElement("span");
      rune.className = "spell-rune";
      rune.textContent = RUNES[Math.floor(Math.random() * RUNES.length)];
      rune.style.left = `${x}%`;
      rune.style.top = `${y}%`;
      rune.style.transform = "translate(-50%, -50%)";
      rune.style.animationDelay = `${i * 0.4}s`;
      runesEl.appendChild(rune);
    }
    this.startParticles();
  }

  private startParticles(): void {
    this.stopParticles();
    const container = this.shadow.getElementById("gen-particles")!;
    container.innerHTML = "";
    const colors = ["rgba(139,92,246,0.6)", "rgba(212,168,67,0.5)", "rgba(45,212,191,0.4)", "rgba(249,115,22,0.4)"];
    this._particleInterval = setInterval(() => {
      if (container.children.length > 30) {
        container.removeChild(container.children[0]);
      }
      const p = document.createElement("div");
      p.className = "gen-particle";
      p.style.left = `${10 + Math.random() * 80}%`;
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
      p.style.width = p.style.height = `${2 + Math.random() * 3}px`;
      p.style.animationDuration = `${2 + Math.random() * 3}s`;
      p.style.boxShadow = `0 0 6px ${p.style.background}`;
      container.appendChild(p);
      setTimeout(() => p.remove(), 5000);
    }, 150);
  }

  private stopParticles(): void {
    if (this._particleInterval) { clearInterval(this._particleInterval); this._particleInterval = null; }
  }

  // ---- Progress ----
  private showProgress(phase: string, percent: number): void {
    this.shadow.getElementById("empty-state")!.style.display = "none";
    this.shadow.getElementById("deck-header")!.classList.remove("visible");
    this.shadow.getElementById("actions")!.classList.remove("visible");
    this.shadow.getElementById("card-sections")!.innerHTML = "";
    const section = this.shadow.getElementById("progress-section")!;
    if (!section.classList.contains("visible")) {
      section.classList.add("visible");
      this.initSpellAnimation();
    }
    this.shadow.getElementById("progress-phase")!.textContent = phase;
    const fill = this.shadow.getElementById("progress-fill")!;
    fill.style.width = `${percent}%`;
    fill.setAttribute("aria-valuenow", String(percent));
    this.shadow.getElementById("progress-percent")!.textContent = `${percent}%`;
  }

  private hideProgress(): void {
    this.shadow.getElementById("progress-section")!.classList.remove("visible");
    this.stopParticles();
  }

  private showError(msg: string): void {
    this.shadow.getElementById("error-message")!.textContent = msg;
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

    const imgContainer = this.shadow.getElementById("commander-image")!;
    const imageUri = deck.commander.imageUris?.normal ?? deck.commander.cardFaces?.[0]?.imageUris?.normal;
    imgContainer.innerHTML = imageUri
      ? `<img src="${this.esc(imageUri)}" alt="${this.esc(deck.commander.name)}" />`
      : `<div style="width:100%;aspect-ratio:488/680;background:#151422;display:flex;align-items:center;justify-content:center;border-radius:10px;color:#6b6580;">${this.esc(deck.commander.name)}</div>`;

    this.shadow.getElementById("deck-name")!.textContent = deck.name;

    const archetypeLabel = ARCHETYPE_INFO[result.archetype]?.label ?? result.archetype;
    this.shadow.getElementById("deck-tags")!.innerHTML = `
      <span class="tag">${archetypeLabel}</span>
      <span class="tag">Bracket ${result.bracketLevel}</span>
      ${result.combosIncluded.length > 0 ? '<span class="tag">♾️ Combos</span>' : ""}
    `;

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

    this.renderManaCurve(nonLandCards);
    this.renderStatsBar(deck);

    const comboInfo = this.shadow.getElementById("combo-info")!;
    if (result.combosIncluded.length > 0) {
      const combo = result.combosIncluded[0];
      this.shadow.getElementById("combo-cards")!.textContent = combo.cards.join(" + ");
      this.shadow.getElementById("combo-desc")!.textContent = combo.results.length > 0 ? combo.results.join(", ") : combo.description;
      comboInfo.classList.add("visible");
    } else { comboInfo.classList.remove("visible"); }

    const warningsEl = this.shadow.getElementById("warnings")!;
    if (result.warnings.length > 0) {
      warningsEl.innerHTML = result.warnings.map((w) => `<div class="warning-item">⚠ ${this.esc(w.message)}</div>`).join("");
      warningsEl.classList.add("visible");
    } else { warningsEl.classList.remove("visible"); }

    this.renderCardSections(deck);
  }

  private renderManaCurve(cards: Card[]): void {
    const curveData = getManaCurve(cards);
    const container = this.shadow.getElementById("mana-curve")!;
    container.innerHTML = "";
    if (curveData.buckets.length === 0) return;
    const maxCount = Math.max(...curveData.buckets.map((b) => b.count), 1);
    for (const bucket of curveData.buckets) {
      if (bucket.cmc > 10) continue;
      const height = Math.max(4, (bucket.count / maxCount) * 40);
      const w = document.createElement("div");
      w.className = "curve-bar-wrapper";
      w.innerHTML = `<span class="curve-count">${bucket.count}</span><div class="curve-bar" style="height:${height}px"></div><span class="curve-label">${bucket.cmc}${bucket.cmc >= 10 ? "+" : ""}</span>`;
      container.appendChild(w);
    }
  }

  private renderStatsBar(deck: Deck): void {
    const bar = this.shadow.getElementById("stats-bar")!;
    bar.innerHTML = "";
    const typeCounts = new Map<string, number>();
    for (const entry of deck.entries) { const t = this.broadType(entry); typeCounts.set(t, (typeCounts.get(t) ?? 0) + entry.quantity); }
    const total = deck.entries.reduce((sum, e) => sum + e.quantity, 0);
    if (total === 0) return;
    for (const type of ["Creature", "Instant", "Sorcery", "Artifact", "Enchantment", "Planeswalker", "Land"]) {
      const count = typeCounts.get(type);
      if (!count) continue;
      const seg = document.createElement("div");
      seg.className = "stats-bar-segment";
      seg.style.flex = String((count / total) * 100);
      seg.style.background = TYPE_COLORS[type] ?? "#2a2840";
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
    const grouped = new Map<CardCategory, DeckEntry[]>();
    grouped.set("Commander", [{ card: deck.commander, quantity: 1, category: "Commander" }]);
    for (const entry of deck.entries) { const list = grouped.get(entry.category) ?? []; list.push(entry); grouped.set(entry.category, list); }

    let sectionDelay = 0;
    for (const category of CATEGORY_ORDER) {
      const entries = grouped.get(category);
      if (!entries || entries.length === 0) continue;
      const totalInCategory = entries.reduce((sum, e) => sum + e.quantity, 0);
      const section = document.createElement("div");
      section.className = "category-section";
      section.style.animation = `deckReveal 0.5s ease-out ${sectionDelay}s both`;
      sectionDelay += 0.05;

      const header = document.createElement("div");
      header.className = "category-header";
      header.setAttribute("tabindex", "0");
      header.setAttribute("role", "button");
      header.setAttribute("aria-expanded", "true");
      header.innerHTML = `<span class="collapse-arrow">▼</span><span class="category-name">${category}</span><span class="category-count">(${totalInCategory})</span>`;

      const cardList = document.createElement("div");
      cardList.className = "card-list";
      const sorted = [...entries].sort((a, b) => a.card.name.localeCompare(b.card.name));
      for (const entry of sorted) {
        const row = document.createElement("div");
        row.className = "card-row";
        row.innerHTML = `<span class="card-qty">${entry.quantity}</span><span class="card-name-text">${this.esc(entry.card.name)}</span><span class="card-mana-cost">${this.renderManaCost(entry.card.manaCost)}</span>`;
        const imageUri = entry.card.imageUris?.normal ?? entry.card.cardFaces?.[0]?.imageUris?.normal;
        if (imageUri) {
          row.addEventListener("mouseenter", (e) => this.showPreview(imageUri, e as MouseEvent));
          row.addEventListener("mousemove", (e) => this.movePreview(e as MouseEvent));
          row.addEventListener("mouseleave", () => this.hidePreview());
        }
        cardList.appendChild(row);
      }

      header.addEventListener("click", () => { const c = header.classList.toggle("collapsed"); cardList.classList.toggle("collapsed", c); header.setAttribute("aria-expanded", c ? "false" : "true"); });
      header.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); header.click(); } });
      section.appendChild(header);
      section.appendChild(cardList);
      container.appendChild(section);
    }
  }

  private renderManaCost(manaCost: string): string {
    if (!manaCost) return "";
    return manaCost.replace(/\{([^}]+)\}/g, (_, s: string) => {
      const u = s.toUpperCase();
      if (MANA_SYMBOLS[u]) return MANA_SYMBOLS[u];
      if (u === "C") return "◇";
      if (u === "X") return "X";
      return s;
    });
  }

  private showPreview(uri: string, e: MouseEvent): void {
    const p = this.shadow.getElementById("card-preview")!;
    (this.shadow.getElementById("preview-img") as HTMLImageElement).src = uri;
    p.classList.add("visible");
    this.movePreview(e);
  }

  private movePreview(e: MouseEvent): void {
    const p = this.shadow.getElementById("card-preview")!;
    p.style.left = `${Math.min(e.clientX + 20, window.innerWidth - 270)}px`;
    p.style.top = `${Math.max(Math.min(e.clientY - 50, window.innerHeight - 370), 10)}px`;
  }

  private hidePreview(): void { this.shadow.getElementById("card-preview")!.classList.remove("visible"); }

  private showExport(fmt: "text" | "mtgo"): void {
    if (!this._deck) return;
    const m = this.shadow.getElementById("export-modal")!;
    this.shadow.getElementById("export-modal-title")!.textContent = fmt === "text" ? "Export — Text List" : "Export — MTGO Format";
    const ta = this.shadow.getElementById("export-textarea") as HTMLTextAreaElement;
    ta.value = fmt === "text" ? toText(this._deck) : toMTGO(this._deck);
    m.classList.add("visible"); ta.select();
  }

  private hideExportModal(): void { this.shadow.getElementById("export-modal")!.classList.remove("visible"); }

  private async copyToClipboard(): Promise<void> {
    if (!this._deck) return;
    try { await navigator.clipboard.writeText(toText(this._deck)); const f = this.shadow.getElementById("copy-feedback")!; f.classList.add("visible"); setTimeout(() => f.classList.remove("visible"), 2000); }
    catch { this.showExport("text"); }
  }

  private async copyModalText(): Promise<void> {
    const ta = this.shadow.getElementById("export-textarea") as HTMLTextAreaElement;
    try { await navigator.clipboard.writeText(ta.value); } catch { ta.select(); }
  }

  private esc(s: string): string { return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
}
