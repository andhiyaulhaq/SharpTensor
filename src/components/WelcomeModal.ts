/**
 * SharpTensor Welcome Modal
 * A premium onboarding experience with demo and repository links.
 */
export interface WelcomeModalCallbacks {
  onOpenFolder: () => void;
  onTryDemo: () => void;
  onGitHub: () => void;
}

export class WelcomeModal {
  private callbacks: WelcomeModalCallbacks;
  private dom: HTMLElement | null = null;

  constructor(callbacks: WelcomeModalCallbacks) {
    this.callbacks = callbacks;
    this.dom = null;
  }

  render(): void {
    const overlay = document.getElementById('welcome-modal');
    if (!overlay) return;

    const githubBtn = overlay.querySelector('#welcome-github');
    if (githubBtn) {
      (githubBtn as HTMLElement).onclick = () => this.callbacks.onGitHub();
    }

    const openBtn = overlay.querySelector('#welcome-open');
    if (openBtn) {
      (openBtn as HTMLElement).onclick = () => {
        this.hide();
        this.callbacks.onOpenFolder();
      };
    }

    const demoBtn = overlay.querySelector('#welcome-demo');
    if (demoBtn) {
      (demoBtn as HTMLElement).onclick = () => {
        this.hide();
        this.callbacks.onTryDemo();
      };
    }

    this.dom = overlay;

    // Trigger the entry animation in the next frame to ensure it plays reliably
    const card = overlay.querySelector('.welcome-card');
    if (card) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => card.classList.add('visible'));
      });
    }

    // The "Release": Now that the shield is active, show the app UI as a hint
    const app = document.getElementById('app');
    if (app) {
      app.style.visibility = 'visible';
      app.style.transition = 'opacity 2.5s ease-out';
      requestAnimationFrame(() => (app.style.opacity = '1'));
    }
  }

  hide(): void {
    if (this.dom) {
      this.dom.remove();
      this.dom = null;
    }
  }
}
