/**
 * `<app-shell>` — Magical Glowing Spellbook layout.
 */

const template = document.createElement("template");
template.innerHTML = `
<style>
  :host {
    display: block;
    font-family: 'Crimson Text', Georgia, serif;
    color: #e8e0f0;
    min-height: 100vh;
    background: #0a0a12;
  }

  * { box-sizing: border-box; }

  .app-header {
    background: linear-gradient(180deg, #151422 0%, #0f0e1a 100%);
    border-bottom: 1px solid #2a2840;
    padding: 12px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    position: sticky;
    top: 0;
    z-index: 100;
    box-shadow: 0 4px 30px rgba(0,0,0,0.5), 0 1px 0 rgba(139,92,246,0.1);
  }

  /* Glowing bottom edge */
  .app-header::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent 5%, rgba(139,92,246,0.4) 30%, rgba(212,168,67,0.5) 50%, rgba(139,92,246,0.4) 70%, transparent 95%);
    filter: blur(0.5px);
  }

  .app-title {
    margin: 0;
    font-family: 'Cinzel', Georgia, serif;
    font-size: 1.4rem;
    font-weight: 700;
    color: #f0d078;
    white-space: nowrap;
    letter-spacing: 0.06em;
    text-shadow: 0 0 20px rgba(212,168,67,0.3), 0 2px 4px rgba(0,0,0,0.5);
  }

  .app-title-icon {
    font-size: 1.3rem;
    margin-right: 4px;
    filter: drop-shadow(0 0 6px rgba(139,92,246,0.5));
  }

  .app-subtitle {
    font-family: 'Crimson Text', Georgia, serif;
    font-size: 0.8rem;
    color: #8b5cf6;
    font-style: italic;
    margin-left: 8px;
    text-shadow: 0 0 10px rgba(139,92,246,0.3);
  }

  .app-layout {
    display: grid;
    gap: 0;
    min-height: calc(100vh - 52px);
    max-width: 2560px;
    margin: 0 auto;
  }

  .page {
    background: rgba(15,14,26,0.95);
    min-width: 0;
    position: relative;
  }

  .left-page {
    border-right: 1px solid #2a2840;
    overflow-y: auto;
  }

  /* Magical glow on the spine */
  .left-page::after {
    content: '';
    position: absolute;
    top: 0; right: -6px; bottom: 0;
    width: 12px;
    background: linear-gradient(90deg, rgba(139,92,246,0.05), transparent);
    pointer-events: none;
    z-index: 1;
  }

  .right-page {
    overflow-y: auto;
    background: rgba(10,10,18,0.98);
  }

  /* Mobile */
  .app-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto 1fr;
    grid-template-areas: "commander" "strategy" "deck";
  }

  .page-commander { grid-area: commander; }
  .page-strategy  { grid-area: strategy; }
  .page-deck      { grid-area: deck; }

  .left-page {
    position: static;
    max-height: none;
    border-right: none;
    border-bottom: 1px solid #2a2840;
  }

  .left-page::after { display: none; }

  @media (min-width: 768px) {
    .app-layout {
      grid-template-columns: 400px 1fr;
      grid-template-rows: auto 1fr;
      grid-template-areas: "commander deck" "strategy deck";
    }
    .left-page {
      position: sticky; top: 52px;
      max-height: calc(100vh - 52px);
      border-right: 1px solid #2a2840;
      border-bottom: none;
    }
    .left-page::after { display: block; }
  }

  @media (min-width: 1200px) {
    .app-layout { grid-template-columns: 460px 1fr; }
  }

  @media (min-width: 1800px) {
    .app-layout { grid-template-columns: 520px 1fr; }
  }

  /* Footer */
  .app-footer {
    background: #0a0a12;
    border-top: 1px solid #2a2840;
    padding: 14px 20px;
    text-align: center;
    font-size: 0.8rem;
    color: #6b6580;
    position: relative;
  }

  .app-footer::before {
    content: '';
    position: absolute;
    top: -1px;
    left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent 10%, rgba(139,92,246,0.2) 50%, transparent 90%);
  }

  .footer-content {
    max-width: 2560px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .footer-sep { color: #2a2840; }

  .footer-link {
    color: #8b5cf6;
    text-decoration: none;
    cursor: pointer;
    transition: color 0.2s;
    background: none;
    border: none;
    font-family: inherit;
    font-size: inherit;
    padding: 0;
  }

  .footer-link:hover { color: #a78bfa; text-decoration: underline; }
  .footer-link:focus-visible { outline: 2px solid #8b5cf6; outline-offset: 2px; }
</style>

<header class="app-header">
  <h1 class="app-title">
    <span class="app-title-icon">✦</span>Commander's Codex
    <span class="app-subtitle">~ Deck Generator ~</span>
  </h1>
</header>

<main class="app-layout">
  <section class="page left-page page-commander" aria-label="Commander selection">
    <slot name="commander-search"></slot>
  </section>
  <section class="page left-page page-strategy" aria-label="Strategy configuration">
    <slot name="strategy-config"></slot>
  </section>
  <section class="page right-page page-deck" aria-label="Generated deck">
    <slot name="deck-view"></slot>
  </section>
</main>

<footer class="app-footer">
  <div class="footer-content">
    <span>Commander's Codex is unofficial fan content.</span>
    <span class="footer-sep">·</span>
    <span>Not affiliated with Wizards of the Coast.</span>
    <span class="footer-sep">·</span>
    <button class="footer-link" id="credits-link" aria-label="View credits and attribution">Credits & Attribution</button>
    <span class="footer-sep">·</span>
    <a class="footer-link" href="https://account.venmo.com/u/NateSnow001" target="_blank" rel="noopener noreferrer">🪙 Spare Some Coin</a>
    <span class="footer-sep">·</span>
    <a class="footer-link" href="https://github.com/NateSnow/CommandersCodex" target="_blank" rel="noopener noreferrer">GitHub</a>
  </div>
</footer>

<slot name="credits-page"></slot>
`;

export class AppShell extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    shadow.appendChild(template.content.cloneNode(true));
  }

  connectedCallback(): void {
    this.shadowRoot!.getElementById("credits-link")!.addEventListener("click", () => {
      this.dispatchEvent(new CustomEvent("open-credits", { bubbles: true, composed: true }));
    });
  }
}
