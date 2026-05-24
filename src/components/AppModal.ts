/**
 * <st-modal>
 * Handles the double-wrapper logic and basic modal structure.
 * Attributes:
 * - id: Modal ID
 * - title: Modal title text
 */
export class AppModal extends HTMLElement {
  private _initialized = false;

  static get observedAttributes(): string[] {
    return ['title', 'hidden', 'class'];
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
    const title = this.getAttribute('title') || 'Alert';
    // Default to hidden if neither attribute nor class is present
    const isHidden =
      this.hasAttribute('hidden') || this.classList.contains('hidden') || !this._initialized;

    this.innerHTML = `
            <div class="modal-root absolute inset-0 z-1000 ${isHidden ? 'hidden' : ''}">
                <div class="w-full h-full bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div class="modal-card bg-(--bg-sidebar) border-t border-white/20 rounded-[20px] w-full max-w-[440px] shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_0_0_1px_rgba(255,255,255,0.05)] p-8 animate-[modal-in_0.3s_cubic-bezier(0.34,1.56,0.64,1)]">
                        <h2 class="modal-title font-(--font-heading) text-[1.5rem] mb-3 text-(--text-primary)">${title}</h2>
                        <div class="mb-6">
                            <p class="modal-message text-(--text-secondary) leading-[1.6] text-[1rem]">Modal message goes here.</p>
                            <input type="text" class="modal-input w-full bg-[#242C2E]/50 border border-(--border) px-4 py-3 rounded-[8px] text-white text-[1rem] mt-4 mb-6 outline-none transition-all duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] focus:border-(--accent) focus:bg-[#242C2E]/80 focus:ring-4 focus:ring-(--accent-glow) hidden" placeholder="">
                            
                            <div class="modal-progress-container hidden mt-6">
                                <div class="w-full bg-black/30 h-2 rounded-full overflow-hidden border border-white/5">
                                    <div class="modal-progress-fill h-full bg-(--accent) shadow-[0_0_8px_var(--accent-glow)] transition-all duration-75" style="width: 0%"></div>
                                </div>
                                <p class="modal-progress-text text-[0.75rem] text-(--text-muted) mt-3 font-mono text-center">0 / 0 images</p>
                            </div>

                            <div class="modal-checkbox-container hidden mt-6 p-3 bg-black/20 rounded-xl border border-white/5 items-center justify-between gap-4 cursor-pointer group hover:border-white/10 transition-all">
                                <span class="modal-checkbox-label text-[0.9rem] text-(--text-secondary) group-hover:text-(--text-primary) transition-all">Toggle option</span>
                                <div class="relative w-11 h-6 bg-black/40 rounded-full border border-white/10 transition-all">
                                    <input type="checkbox" class="modal-checkbox sr-only peer">
                                    <div class="absolute left-1 top-1 w-4 h-4 bg-white/20 rounded-full transition-all peer-checked:translate-x-5 peer-checked:bg-(--accent) peer-checked:shadow-[0_0_10px_var(--accent-glow)]"></div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-actions flex justify-end gap-3">
                            <button class="modal-cancel inline-flex items-center justify-center px-4 py-2 rounded-lg font-semibold bg-(--bg-card) border border-(--border) hover:bg-(--bg-hover) transition-all">Cancel</button>
                            <button class="modal-confirm inline-flex items-center justify-center px-4 py-2 rounded-lg font-semibold bg-(--accent) text-(--accent-text) hover:bg-(--accent-light) shadow-[0_4px_12px_var(--accent-glow)] transition-all">Confirm</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
  }

  show(params: {
    message: string;
    inputPlaceholder?: string;
    confirmText?: string;
    cancelText?: string;
    checkboxLabel?: string;
    onConfirm?: (val: string, checked: boolean) => void;
    onCancel?: () => void;
  }): void {
    if (!this._initialized) this.renderInitial();
    
    this.classList.remove('hidden');
    this.removeAttribute('hidden');
    this.syncState();

    const msgEl = this.querySelector('.modal-message');
    const inputEl = this.querySelector('.modal-input') as HTMLInputElement;
    const checkboxContainer = this.querySelector('.modal-checkbox-container') as HTMLElement;
    const checkboxEl = this.querySelector('.modal-checkbox') as HTMLInputElement;
    const checkboxLabelEl = this.querySelector('.modal-checkbox-label');
    const confirmBtn = this.querySelector('.modal-confirm') as HTMLButtonElement;
    const cancelBtn = this.querySelector('.modal-cancel') as HTMLButtonElement;
    const progressContainer = this.querySelector('.modal-progress-container') as HTMLElement;

    if (msgEl) msgEl.textContent = params.message;
    if (progressContainer) progressContainer.classList.add('hidden');
    
    if (inputEl) {
      if (params.inputPlaceholder !== undefined && params.inputPlaceholder !== '') {
        inputEl.placeholder = params.inputPlaceholder;
        inputEl.classList.remove('hidden');
        inputEl.value = '';
        setTimeout(() => inputEl.focus(), 100);
      } else {
        inputEl.classList.add('hidden');
      }
    }

    if (checkboxContainer && checkboxEl && checkboxLabelEl) {
      if (params.checkboxLabel) {
        checkboxLabelEl.textContent = params.checkboxLabel;
        checkboxContainer.classList.remove('hidden');
        checkboxContainer.classList.add('flex');
        checkboxEl.checked = false;
        
        checkboxContainer.onclick = (e: Event) => {
          if (e.target !== checkboxEl) {
             checkboxEl.checked = !checkboxEl.checked;
          }
        };
      } else {
        checkboxContainer.classList.add('hidden');
        checkboxContainer.classList.remove('flex');
        checkboxContainer.onclick = null;
      }
    }

    const cleanup = () => {
      window.removeEventListener('keydown', handleKeydown);
    };

    if (confirmBtn) {
      confirmBtn.textContent = params.confirmText || 'Confirm';
      confirmBtn.onclick = () => {
        this.hide();
        cleanup();
        if (params.onConfirm) {
          params.onConfirm(inputEl ? inputEl.value : '', checkboxEl ? checkboxEl.checked : false);
        }
      };
    }

    if (cancelBtn) {
      cancelBtn.textContent = params.cancelText || 'Cancel';
      cancelBtn.onclick = () => {
        this.hide();
        cleanup();
        if (params.onCancel) params.onCancel();
      };
    }
    
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !this.classList.contains('hidden')) {
        e.preventDefault();
        confirmBtn?.click();
      } else if (e.key === 'Escape' && !this.classList.contains('hidden')) {
        e.preventDefault();
        cancelBtn?.click();
      }
    };
    window.addEventListener('keydown', handleKeydown);
  }

  hide(): void {
    this.classList.add('hidden');
    this.setAttribute('hidden', '');
    this.syncState();
  }

  syncState(): void {
    const root = this.querySelector('.modal-root');
    if (!root) return;

    const isHidden = this.hasAttribute('hidden') || this.classList.contains('hidden');
    root.classList.toggle('hidden', isHidden);

    const titleEl = this.querySelector('.modal-title');
    if (titleEl && this.hasAttribute('title')) {
      const titleAttr = this.getAttribute('title');
      if (titleAttr !== null) {
        titleEl.textContent = titleAttr;
      }
    }
  }
}

customElements.define('st-modal', AppModal);
