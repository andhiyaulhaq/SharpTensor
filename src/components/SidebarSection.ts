/**
 * <st-sidebar-section>
 * A reusable container for sidebar modules.
 * Attributes:
 * - title: The section heading
 * - badge-id: (Optional) ID for the counter badge
 * - badge-text: (Optional) Initial badge text
 */
export class SidebarSection extends HTMLElement {
  connectedCallback(): void {
    // Capture existing content
    const content = this.innerHTML;
    const title = this.getAttribute('title') || '';
    const badgeId = this.getAttribute('badge-id');
    const badgeText = this.getAttribute('badge-text') || '';

    const actionId = this.getAttribute('action-id');
    const customClass = this.getAttribute('class') || '';

    // Apply container styles to the host element itself
    this.className = `py-3 border-b border-(--border) flex flex-col last:border-b-0 ${customClass}`;

    this.innerHTML = `
            <div class="flex items-center justify-between mb-3 shrink-0">
                <h3 class="text-[0.85rem] font-bold uppercase tracking-wider text-(--text-muted)">${title}</h3>
                <div class="flex items-center gap-2">
                    ${
                      badgeId
                        ? `
                        <span id="${badgeId}" class="bg-(--bg-card) text-(--text-secondary) px-2 py-0.5 rounded-full text-[0.7rem] border border-(--border)">
                            ${badgeText}
                        </span>
                    `
                        : ''
                    }
                    ${
                      actionId
                        ? `
                        <button id="${actionId}" class="p-1 rounded-md text-(--text-muted) hover:text-(--text-primary) hover:bg-(--bg-hover) transition-all disabled:opacity-50" disabled aria-label="Add">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </button>
                        `
                        : ''
                    }
                </div>
            </div>
            <div class="section-content flex-1 flex flex-col min-h-0 overflow-hidden">
                ${content}
            </div>
        `;
  }
}

customElements.define('st-sidebar-section', SidebarSection);
