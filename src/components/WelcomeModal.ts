export class WelcomeModal extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.render();
    this.initEventListeners();
    this.animateEntry();
  }

  private render() {
    this.innerHTML = `
      <div class="welcome-overlay" id="welcome-modal-internal">
        <div class="welcome-card">
          <div class="welcome-logo-container">
            <img src="/st-logo-horizontal.png" alt="SharpTensor" class="welcome-logo" />
          </div>
          <p class="welcome-subtitle">
            The ultimate high-performance AI annotation suite. Accelerate your computer vision
            workflow with sub-pixel precision.
          </p>

          <div class="cta-grid">
            <div class="cta-item" id="welcome-github">
              <div class="cta-icon">
                <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                  <path d="M9 18c-4.51 2-5-2-7-2" />
                </svg>
              </div>
              <div class="cta-label">Open Source</div>
              <p class="cta-desc">Explore the architecture and contribute to the core engine.</p>
            </div>

            <div class="cta-item" id="welcome-demo">
              <div class="cta-icon">✨</div>
              <div class="cta-label">Quick Demo</div>
              <p class="cta-desc">Instantly test YOLOv8 with our high-fidelity sample image.</p>
            </div>

            <div class="cta-item primary" id="welcome-open">
              <div class="cta-icon">📂</div>
              <div class="cta-label">Open Project</div>
              <p class="cta-desc">Initialize your workspace using the local file system.</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private initEventListeners() {
    const githubBtn = this.querySelector('#welcome-github');
    if (githubBtn) {
      (githubBtn as HTMLElement).onclick = () => {
        this.dispatchEvent(new CustomEvent('action', { detail: 'github' }));
      };
    }

    const openBtn = this.querySelector('#welcome-open');
    if (openBtn) {
      (openBtn as HTMLElement).onclick = () => {
        this.hide();
        this.dispatchEvent(new CustomEvent('action', { detail: 'open' }));
      };
    }

    const demoBtn = this.querySelector('#welcome-demo');
    if (demoBtn) {
      (demoBtn as HTMLElement).onclick = () => {
        this.hide();
        this.dispatchEvent(new CustomEvent('action', { detail: 'demo' }));
      };
    }
  }

  private animateEntry() {
    const card = this.querySelector('.welcome-card');
    if (card) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => card.classList.add('visible'));
      });
    }

    const app = document.getElementById('app');
    if (app) {
      app.style.visibility = 'visible';
      app.style.transition = 'opacity 2.5s ease-out';
      requestAnimationFrame(() => (app.style.opacity = '1'));
    }
  }

  public hide() {
    this.remove();
  }
}

customElements.define('st-welcome-modal', WelcomeModal);
