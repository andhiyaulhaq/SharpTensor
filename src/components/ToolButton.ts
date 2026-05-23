/**
 * <st-tool-button>
 * Encapsulates a toolbar button with premium hover/active states.
 * Attributes:
 * - id: Button ID
 * - title: Tooltip text
 * - icon: SVG content
 * - disabled: Boolean
 */
export class ToolButton extends HTMLElement {
  private _initialized = false;
  private _originalIcon = '';

  static get observedAttributes(): string[] {
    return ['disabled', 'title', 'class'];
  }

  get disabled(): boolean {
    return this.hasAttribute('disabled');
  }
  set disabled(val: boolean) {
    if (val) this.setAttribute('disabled', '');
    else this.removeAttribute('disabled');
  }

  connectedCallback(): void {
    if (this._initialized) return;
    this.renderInitial();
    this._initialized = true;
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (!this._initialized) return;
    this.syncState();
  }

  renderInitial(): void {
    const title = this.getAttribute('title') || '';
    const disabled = this.hasAttribute('disabled');

    this._originalIcon = this.innerHTML;

    this.innerHTML = `
            <button class="tool-inner w-9 h-9 border-none bg-transparent text-(--text-secondary) rounded-[6px] cursor-pointer flex items-center justify-center transition-all duration-200 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] hover:bg-(--bg-hover) hover:text-(--text-primary) hover:translate-y-[-2px] active:bg-(--accent) active:text-(--accent-text) active:shadow-[0_0_15px_var(--accent-glow)] active:translate-y-0 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale disabled:pointer-events-none"
                ${disabled ? 'disabled' : ''} 
                title="${title}">
                <span class="flex items-center justify-center shrink-0">
                    ${this._originalIcon}
                </span>
            </button>
        `;
    this.syncState();
  }

  syncState(): void {
    const btn = this.querySelector('.tool-inner') as HTMLButtonElement | null;
    if (!btn) return;

    btn.disabled = this.hasAttribute('disabled');

    if (this.hasAttribute('title')) {
      const titleAttr = this.getAttribute('title');
      if (titleAttr !== null) {
        btn.title = titleAttr;
      }
    }
  }
}

customElements.define('st-tool-button', ToolButton);
