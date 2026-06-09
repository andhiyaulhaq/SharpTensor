export class AppHeader extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.render();
  }

  private render() {
    this.innerHTML = `
      <header class="h-(--header-height) bg-(--bg-header) border-b border-(--glass-border) flex items-center justify-between z-100 py-2 pl-3 pr-4">
        <div class="flex items-center gap-[10px] h-full">
          <a href="/" style="display: block; height: 100%">
            <img src="/st-logo-horizontal.png" alt="SharpTensor" class="h-full w-auto block object-contain" />
          </a>
        </div>

        <div class="flex items-center gap-2 bg-(--bg-card) p-1 rounded-[10px] border border-(--border)">
          <st-tool-button id="btn-select" title="Select (V)" disabled>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
              <path d="m13 13 6 6" />
            </svg>
          </st-tool-button>
          <st-tool-button id="btn-draw" title="Draw Box / Magic Box (W)" disabled>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M3 9h18" />
              <path d="M9 3v18" />
            </svg>
          </st-tool-button>
          <st-tool-button id="btn-polygon" title="Polygon Tool (P)" disabled>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 2 22 22 22"/>
            </svg>
          </st-tool-button>
          <div class="w-px h-5 bg-(--border) mx-1"></div>
          <st-tool-button id="btn-prev" title="Previous (A)" disabled>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </st-tool-button>
          <span id="image-counter" class="text-(--text-muted) text-[0.75rem] font-mono px-1">0 / 0</span>
          <st-tool-button id="btn-next" title="Next (D)" disabled>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </st-tool-button>
        </div>
        <div class="flex items-center gap-3">
          <a href="https://github.com/andhiyaulhaq/SharpTensor" target="_blank" rel="noopener noreferrer" style="text-decoration: none">
            <button id="btn-github" class="inline-flex items-center justify-center gap-2 px-[18px] py-[10px] rounded-[8px] font-semibold text-[0.875rem] cursor-pointer transition-all duration-200 ease-in-out border border-(--border) leading-none whitespace-nowrap select-none active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale disabled:pointer-events-none bg-(--bg-card) text-(--text-primary) hover:bg-(--bg-hover) hover:border-(--text-muted) hover:text-white" title="View GitHub Repository">
              <span class="flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                  <path d="M9 18c-4.51 2-5-2-7-2" />
                </svg>
              </span>
            </button>
          </a>

          <button id="btn-open" class="inline-flex items-center justify-center gap-2 px-[18px] py-[10px] rounded-[8px] font-semibold text-[0.875rem] cursor-pointer transition-all duration-200 ease-in-out border border-(--border) leading-none whitespace-nowrap select-none active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale disabled:pointer-events-none bg-(--bg-card) text-(--text-primary) hover:bg-(--bg-hover) hover:border-(--text-muted) hover:text-white">
            <span class="flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
              </svg>
            </span>
            <span class="flex items-center justify-center text-center">Open Folder</span>
          </button>
          <div class="relative">
            <button id="btn-export" class="inline-flex items-center justify-center gap-2 px-[18px] py-[10px] rounded-[8px] font-semibold text-[0.875rem] cursor-pointer transition-all duration-200 ease-in-out border border-transparent leading-none whitespace-nowrap select-none active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale disabled:pointer-events-none bg-(--accent) text-(--accent-text) shadow-[0_4px_12px_var(--accent-glow)] hover:bg-(--accent-light) hover:-translate-y-px hover:shadow-[0_6px_16px_var(--accent-glow)]" disabled>
              <span class="flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" x2="12" y1="15" y2="3" />
                </svg>
              </span>
              <span class="flex items-center justify-center text-center">Export</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-(--accent-text)/60">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            <div id="export-menu" class="hidden export-menu">
              <div class="export-option" data-format="yolo">
                <svg class="export-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <div>
                  <div class="export-label">YOLO .txt</div>
                  <div class="export-desc">One .txt per image, normalized coords</div>
                </div>
              </div>
              <div class="export-option" data-format="coco">
                <svg class="export-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="M12 18v-6" />
                  <path d="M9 15h6" />
                </svg>
                <div>
                  <div class="export-label">COCO JSON</div>
                  <div class="export-desc">Single annotations.json, pixel bbox</div>
                </div>
              </div>
              <div class="export-option" data-format="voc">
                <svg class="export-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="M9 15h6" />
                  <path d="M12 12v6" />
                </svg>
                <div>
                  <div class="export-label">Pascal VOC XML</div>
                  <div class="export-desc">One .xml per image, absolute pixels</div>
                </div>
              </div>
              <div class="export-option" data-format="csv">
                <svg class="export-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="8" y1="13" x2="16" y2="13" />
                  <line x1="8" y1="17" x2="16" y2="17" />
                </svg>
                <div>
                  <div class="export-label">CSV</div>
                  <div class="export-desc">Flat table, normalized coords</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
    `;
  }
}

customElements.define('st-app-header', AppHeader);
