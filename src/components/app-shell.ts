/**
 * `<app-shell>` Web Component — Spellbook Theme
 *
 * Top-level layout styled as an ancient spellbook.
 * Left page: commander search + strategy config.
 * Right page: generated deck view.
 */

const template = document.createElement("template");
template.innerHTML = `
<style>
  :host {
    display: block;
    font-family: 'Crimson Text', Georgia, serif;
    color: #f4e8c1;
    min-height: 100vh;
    background: #1a0f0a;
  }

  * { box-sizing: border-box; }

  /* ---- Header / Book Spine ---- */
  .app-header {
    background: linear-gradient(180deg, #2c1810 0%, #1a0f0a 100%);
    border-bottom: 3px solid #5c4033;
    padding: 12px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    position: sticky;
    top: 0;
    z-index: 100;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  }

  .app-header::after {
    content: '';
    position: absolute;
    bottom: -3px;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, #c9a84c, transparent);
  }

  .app-title {
    margin: 0;
    font-family: 'Cinzel', Georgia, serif;
    font-size: 1.4rem;
    font-weight: 700;
    color: #e8d48b;
    white-space: nowrap;
    letter-spacing: 0.05em;
    text-shadow: 0 2px 4px rgba(0,0,0,0.5);
  }

  .app-title-icon {
    font-size: 1.3rem;
    margin-right: 4px;
  }

  .app-subtitle {
    font-family: 'Crimson Text', Georgia, serif;
    font-size: 0.8rem;
    color: #8b7355;
    font-style: italic;
    margin-left: 8px;
  }

  /* ---- Ornamental divider ---- */
  .ornament {
    text-align: center;
    color: #5c4033;
    font-size: 0.9rem;
    letter-spacing: 0.3em;
    padding: 0;
    line-height: 1;
    user-select: none;
  }

  /* ---- Main layout: the open book ---- */
  .app-layout {
    display: grid;
    gap: 0;
    min-height: calc(100vh - 52px);
    max-width: 2560px;
    margin: 0 auto;
  }

  .page {
    background:
      linear-gradient(135deg, rgba(60,43,31,0.4) 0%, rgba(44,24,16,0.9) 100%);
    min-width: 0;
    position: relative;
  }

  /* Parchment inner glow on pages */
  .page::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(ellipse at 50% 0%, rgba(244,232,193,0.03) 0%, transparent 60%);
  }

  .left-page {
    border-right: 1px solid #3d2b1f;
    overflow-y: auto;
  }

  .right-page {
    overflow-y: auto;
    background:
      linear-gradient(135deg, rgba(44,24,16,0.95) 0%, rgba(26,15,10,1) 100%);
  }

  /* Book spine shadow between pages */
  .left-page::after {
    content: '';
    position: absolute;
    top: 0;
    right: -8px;
    bottom: 0;
    width: 8px;
    background: linear-gradient(90deg, rgba(0,0,0,0.3), transparent);
    pointer-events: none;
    z-index: 1;
  }

  /* ---- Mobile: single column (stacked pages) ---- */
  .app-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto 1fr;
    grid-template-areas:
      "commander"
      "strategy"
      "deck";
  }

  .page-commander { grid-area: commander; }
  .page-strategy  { grid-area: strategy; }
  .page-deck      { grid-area: deck; }

  .left-page {
    position: static;
    max-height: none;
    border-right: none;
    border-bottom: 1px solid #3d2b1f;
  }

  .left-page::after {
    display: none;
  }

  /* ---- Tablet (768px+): two-column book ---- */
  @media (min-width: 768px) {
    .app-layout {
      grid-template-columns: 400px 1fr;
      grid-template-rows: auto 1fr;
      grid-template-areas:
        "commander deck"
        "strategy  deck";
    }

    .left-page {
      position: sticky;
      top: 52px;
      max-height: calc(100vh - 52px);
      border-right: 1px solid #3d2b1f;
      border-bottom: none;
    }

    .left-page::after {
      display: block;
    }
  }

  /* ---- Desktop (1200px+) ---- */
  @media (min-width: 1200px) {
    .app-layout {
      grid-template-columns: 460px 1fr;
    }
  }

  /* ---- Ultra-wide (1800px+) ---- */
  @media (min-width: 1800px) {
    .app-layout {
      grid-template-columns: 520px 1fr;
    }
  }
</style>

<header class="app-header">
  <h1 class="app-title">
    <span class="app-title-icon">📖</span>Commander's Codex
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
`;

export class AppShell extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    shadow.appendChild(template.content.cloneNode(true));
  }
}
