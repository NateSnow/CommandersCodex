/**
 * `<app-shell>` Web Component
 *
 * Top-level layout shell that arranges all panels in a responsive
 * CSS Grid layout. Desktop (≥768px) uses a multi-column layout with
 * search/recommendations on the left and deck list/stats on the right.
 * Mobile (<768px) uses a stacked single-column layout.
 *
 * Supports screen widths from 320px to 2560px.
 *
 * Child components are slotted by name so the shell controls layout
 * without owning the component instances.
 */

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
    min-height: 100vh;
    background: #121212;
  }

  * { box-sizing: border-box; }

  /* Header */
  .app-header {
    background: #1a1a2e;
    border-bottom: 1px solid #333;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .app-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: #fff;
    white-space: nowrap;
  }

  .app-title-accent {
    color: #7c4dff;
  }

  /* Main layout container */
  .app-layout {
    display: grid;
    gap: 16px;
    padding: 16px;
    min-height: calc(100vh - 52px);
    max-width: 2560px;
    margin: 0 auto;
  }

  /* Panel wrappers */
  .panel {
    background: #1e1e1e;
    border: 1px solid #333;
    border-radius: 8px;
    overflow: hidden;
    min-width: 0;
  }

  /* ---------------------------------------------------------------
     Mobile layout (<768px): single column, stacked
     --------------------------------------------------------------- */
  .app-layout {
    grid-template-columns: 1fr;
    grid-template-areas:
      "commander"
      "generator"
      "generator-progress"
      "search"
      "deck"
      "stats"
      "validation"
      "recommendations"
      "export"
      "saved";
  }

  .panel-commander    { grid-area: commander; }
  .panel-generator    { grid-area: generator; }
  .panel-generator-progress { grid-area: generator-progress; }
  .panel-search       { grid-area: search; }
  .panel-deck         { grid-area: deck; }
  .panel-stats        { grid-area: stats; }
  .panel-validation   { grid-area: validation; }
  .panel-recommendations { grid-area: recommendations; }
  .panel-export       { grid-area: export; }
  .panel-saved        { grid-area: saved; }

  /* ---------------------------------------------------------------
     Tablet / Desktop layout (≥768px): two columns
     --------------------------------------------------------------- */
  @media (min-width: 768px) {
    .app-layout {
      grid-template-columns: 1fr 1fr;
      grid-template-areas:
        "commander    deck"
        "generator    deck"
        "generator-progress deck"
        "search       deck"
        "search       stats"
        "recommendations validation"
        "recommendations export"
        "saved        saved";
    }
  }

  /* ---------------------------------------------------------------
     Wide desktop (≥1200px): three columns
     --------------------------------------------------------------- */
  @media (min-width: 1200px) {
    .app-layout {
      grid-template-columns: 1fr 1fr 1fr;
      grid-template-areas:
        "commander    deck       stats"
        "generator    deck       stats"
        "generator-progress deck  validation"
        "search       deck       validation"
        "recommendations export  saved";
    }
  }

  /* ---------------------------------------------------------------
     Ultra-wide (≥1800px): wider with more breathing room
     --------------------------------------------------------------- */
  @media (min-width: 1800px) {
    .app-layout {
      grid-template-columns: 1.2fr 1fr 1fr 0.8fr;
      grid-template-areas:
        "commander    deck       stats      validation"
        "generator    deck       stats      export"
        "generator-progress deck recommendations saved"
        "search       deck       recommendations saved";
      gap: 20px;
      padding: 20px;
    }
  }

  /* Ensure touch targets on mobile */
  @media (max-width: 767px) {
    .app-layout {
      padding: 8px;
      gap: 8px;
    }

    .app-header {
      padding: 10px 12px;
    }

    .app-title {
      font-size: 1.1rem;
    }
  }

  /* Slots — ensure slotted content fills the panel */
  ::slotted(*) {
    display: block;
    width: 100%;
  }
</style>

<header class="app-header" role="banner">
  <h1 class="app-title">
    <span class="app-title-accent">MTG</span> Commander Deckbuilder
  </h1>
</header>

<main class="app-layout" role="main">
  <section class="panel panel-commander" role="region" aria-label="Commander selection">
    <slot name="commander-search"></slot>
  </section>

  <section class="panel panel-generator" role="region" aria-label="Deck generator">
    <slot name="deck-generator-controls"></slot>
  </section>

  <section class="panel panel-generator-progress" role="region" aria-label="Generation progress">
    <slot name="deck-generator-progress"></slot>
  </section>

  <section class="panel panel-search" role="search" aria-label="Card search">
    <slot name="card-search"></slot>
  </section>

  <section class="panel panel-deck" role="region" aria-label="Deck list">
    <slot name="deck-list"></slot>
  </section>

  <section class="panel panel-stats" role="region" aria-label="Deck statistics">
    <slot name="deck-stats"></slot>
  </section>

  <section class="panel panel-validation" role="region" aria-label="Deck validation">
    <slot name="deck-validation"></slot>
  </section>

  <section class="panel panel-recommendations" role="complementary" aria-label="Card recommendations">
    <slot name="card-recommendations"></slot>
  </section>

  <section class="panel panel-export" role="region" aria-label="Deck export">
    <slot name="deck-export"></slot>
  </section>

  <section class="panel panel-saved" role="region" aria-label="Saved decks">
    <slot name="saved-decks"></slot>
  </section>
</main>
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export class AppShell extends HTMLElement {
  private shadow: ShadowRoot;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: "open" });
    this.shadow.appendChild(template.content.cloneNode(true));
  }
}
