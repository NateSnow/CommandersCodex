/**
 * `<credits-page>` Web Component
 *
 * Full-page credits overlay with attribution for all data sources,
 * APIs, and intellectual property used by Commander's Codex.
 */

const template = document.createElement("template");
template.innerHTML = `
<style>
  :host {
    display: block;
    font-family: 'Crimson Text', Georgia, serif;
    color: #e8e0f0;
  }

  * { box-sizing: border-box; }

  .overlay {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 2000;
    background: rgba(0,0,0,0.85);
    overflow-y: auto;
    padding: 20px;
    backdrop-filter: blur(4px);
  }

  .overlay.visible { display: flex; justify-content: center; }

  .credits-content {
    background: #0f0e1a;
    border: 1px solid #2a2840;
    border-radius: 12px;
    padding: 32px;
    max-width: 700px;
    width: 100%;
    margin: 40px 0;
    box-shadow: 0 12px 60px rgba(0,0,0,0.6), 0 0 40px rgba(139,92,246,0.08);
    position: relative;
  }

  .btn-close {
    position: absolute;
    top: 16px;
    right: 16px;
    background: rgba(30,28,48,0.6);
    border: 1px solid #2a2840;
    color: #a09ab0;
    font-size: 1.2rem;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, color 0.2s;
    line-height: 1;
  }

  .btn-close:hover { background: rgba(139,92,246,0.15); color: #e8e0f0; }
  .btn-close:focus-visible { outline: 2px solid #8b5cf6; outline-offset: 2px; }

  h1 {
    font-family: 'Cinzel', Georgia, serif;
    font-size: 1.6rem;
    font-weight: 700;
    color: #f0d078;
    margin: 0 0 8px 0;
    text-shadow: 0 0 20px rgba(212,168,67,0.2);
  }

  .subtitle {
    font-size: 0.95rem;
    color: #6b6580;
    font-style: italic;
    margin-bottom: 28px;
  }

  .divider {
    text-align: center;
    color: #2a2840;
    font-size: 0.8rem;
    letter-spacing: 0.5em;
    margin: 24px 0;
    user-select: none;
  }

  .section {
    margin-bottom: 24px;
  }

  .section h2 {
    font-family: 'Cinzel', Georgia, serif;
    font-size: 1.05rem;
    font-weight: 600;
    color: #a78bfa;
    margin: 0 0 10px 0;
    letter-spacing: 0.03em;
  }

  .credit-card {
    background: rgba(30,28,48,0.4);
    border: 1px solid #2a2840;
    border-radius: 8px;
    padding: 14px 16px;
    margin-bottom: 10px;
    transition: border-color 0.2s;
  }

  .credit-card:hover {
    border-color: #3a3860;
  }

  .credit-name {
    font-family: 'Cinzel', Georgia, serif;
    font-size: 0.95rem;
    font-weight: 600;
    color: #f0d078;
    margin-bottom: 4px;
  }

  .credit-desc {
    font-size: 0.88rem;
    color: #a09ab0;
    line-height: 1.5;
    margin-bottom: 6px;
  }

  .credit-link {
    font-size: 0.82rem;
    color: #8b5cf6;
    text-decoration: none;
    transition: color 0.2s;
  }

  .credit-link:hover { color: #a78bfa; text-decoration: underline; }

  .legal-notice {
    background: rgba(139,92,246,0.05);
    border: 1px solid rgba(139,92,246,0.12);
    border-radius: 8px;
    padding: 16px;
    margin-top: 8px;
  }

  .legal-notice p {
    margin: 0 0 8px 0;
    font-size: 0.85rem;
    color: #a09ab0;
    line-height: 1.6;
  }

  .legal-notice p:last-child { margin-bottom: 0; }

  .legal-notice strong { color: #e8e0f0; }

  .font-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .font-list li {
    padding: 6px 0;
    font-size: 0.88rem;
    color: #a09ab0;
    border-bottom: 1px solid rgba(42,40,64,0.4);
  }

  .font-list li:last-child { border-bottom: none; }

  .font-name { color: #f0d078; font-weight: 600; }

  .built-with {
    text-align: center;
    padding: 16px 0 0;
    font-size: 0.85rem;
    color: #6b6580;
    font-style: italic;
  }

  .built-with a {
    color: #8b5cf6;
    text-decoration: none;
  }

  .built-with a:hover { text-decoration: underline; }

  .support-section {
    text-align: center;
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid #2a2840;
  }

  .btn-support {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 12px 28px;
    font-family: 'Cinzel', Georgia, serif;
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: #fff;
    background: linear-gradient(180deg, #a78bfa 0%, #8b5cf6 100%);
    border: 2px solid #6d28d9;
    border-radius: 10px;
    text-decoration: none;
    cursor: pointer;
    transition: background 0.2s, transform 0.1s, box-shadow 0.2s;
    text-shadow: 0 0 10px rgba(139,92,246,0.4);
    box-shadow: 0 4px 20px rgba(139,92,246,0.25), 0 0 40px rgba(139,92,246,0.08);
  }

  .btn-support:hover {
    background: linear-gradient(180deg, #c4b5fd 0%, #a78bfa 100%);
    transform: translateY(-1px);
    box-shadow: 0 6px 30px rgba(139,92,246,0.35), 0 0 60px rgba(139,92,246,0.12);
  }

  .btn-support:focus-visible { outline: 2px solid #8b5cf6; outline-offset: 2px; }

  .support-sub {
    margin-top: 8px;
    font-size: 0.8rem;
    color: #6b6580;
    font-style: italic;
  }

  @media (max-width: 600px) {
    .credits-content { padding: 24px 16px; }
    h1 { font-size: 1.3rem; }
  }
</style>

<div class="overlay" id="overlay">
  <div class="credits-content">
    <button class="btn-close" id="btn-close" aria-label="Close credits">✕</button>

    <h1>✦ Credits & Attribution</h1>
    <div class="subtitle">Commander's Codex is a fan-made project and is not affiliated with or endorsed by any of the following.</div>

    <div class="section">
      <h2>⚔ Intellectual Property</h2>
      <div class="credit-card">
        <div class="credit-name">Wizards of the Coast</div>
        <div class="credit-desc">
          Magic: The Gathering, including card names, card images, mana symbols, set symbols, and all associated
          intellectual property are trademarks and copyrights of Wizards of the Coast LLC.
          © 1993–2026 Wizards of the Coast. All Rights Reserved.
        </div>
        <div class="legal-notice">
          <p>
            Commander's Codex is not produced by, endorsed by, supported by, or affiliated with
            <strong>Wizards of the Coast</strong>.
          </p>
          <p>
            Card images are provided by Scryfall and are the property of their respective copyright holders.
            This application uses them under Wizards of the Coast's
            <a class="credit-link" href="https://company.wizards.com/en/legal/fancontentpolicy" target="_blank" rel="noopener noreferrer">Fan Content Policy</a>.
          </p>
        </div>
      </div>
    </div>

    <div class="divider">✦ ✦ ✦</div>

    <div class="section">
      <h2>🔮 Data Sources & APIs</h2>

      <div class="credit-card">
        <div class="credit-name">Scryfall</div>
        <div class="credit-desc">
          Card data, search, autocomplete, and card images are provided by the Scryfall API.
          Scryfall is not produced by or endorsed by Wizards of the Coast.
        </div>
        <a class="credit-link" href="https://scryfall.com" target="_blank" rel="noopener noreferrer">scryfall.com</a>
      </div>

      <div class="credit-card">
        <div class="credit-name">EDHREC</div>
        <div class="credit-desc">
          Commander card recommendations and synergy scores are sourced from EDHREC,
          the community-driven resource for EDH/Commander deck building data.
        </div>
        <a class="credit-link" href="https://edhrec.com" target="_blank" rel="noopener noreferrer">edhrec.com</a>
      </div>

      <div class="credit-card">
        <div class="credit-name">Commander Spellbook</div>
        <div class="credit-desc">
          Combo data and infinite combo packages are sourced from Commander Spellbook,
          the community-maintained database of Magic: The Gathering combos.
        </div>
        <a class="credit-link" href="https://commanderspellbook.com" target="_blank" rel="noopener noreferrer">commanderspellbook.com</a>
      </div>
    </div>

    <div class="divider">✦ ✦ ✦</div>

    <div class="section">
      <h2>✒ Typography</h2>
      <div class="credit-card">
        <div class="credit-desc">Fonts served via Google Fonts under the SIL Open Font License.</div>
        <ul class="font-list">
          <li><span class="font-name">Cinzel</span> — designed by Natanael Gama</li>
          <li><span class="font-name">Crimson Text</span> — designed by Sebastian Kosch</li>
          <li><span class="font-name">MedievalSharp</span> — designed by wmk69</li>
        </ul>
      </div>
    </div>

    <div class="divider">✦ ✦ ✦</div>

    <div class="section">
      <h2>🛠 Built With</h2>
      <div class="credit-card">
        <ul class="font-list">
          <li><span class="font-name">TypeScript</span> — strict-mode, vanilla Web Components</li>
          <li><span class="font-name">Vite</span> — build tooling and dev server</li>
          <li><span class="font-name">Vitest</span> — test framework</li>
        </ul>
      </div>
    </div>

    <div class="built-with">
      Made with ✦ for the Commander community
      <br />
      <a href="https://github.com/NateSnow/CommandersCodex" target="_blank" rel="noopener noreferrer">View on GitHub</a>
    </div>

    <div class="support-section">
      <a class="btn-support" href="https://account.venmo.com/u/NateSnow001" target="_blank" rel="noopener noreferrer">
        🪙 Support the Codex
      </a>
      <div class="support-sub">If you enjoy the app, consider tipping to keep the lights on</div>
    </div>
  </div>
</div>
`;

export class CreditsPage extends HTMLElement {
  private shadow: ShadowRoot;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: "open" });
    this.shadow.appendChild(template.content.cloneNode(true));
  }

  connectedCallback(): void {
    this.shadow.getElementById("btn-close")!.addEventListener("click", () => this.hide());
    this.shadow.getElementById("overlay")!.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) this.hide();
    });
    document.addEventListener("keydown", this.handleEscape);
  }

  disconnectedCallback(): void {
    document.removeEventListener("keydown", this.handleEscape);
  }

  show(): void {
    this.shadow.getElementById("overlay")!.classList.add("visible");
    document.body.style.overflow = "hidden";
  }

  hide(): void {
    this.shadow.getElementById("overlay")!.classList.remove("visible");
    document.body.style.overflow = "";
  }

  private handleEscape = (e: KeyboardEvent): void => {
    if (e.key === "Escape") this.hide();
  };
}
