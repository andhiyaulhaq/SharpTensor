export class RightSidebar extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.render();
  }

  private render() {
    this.innerHTML = `
      <aside class="w-(--sidebar-right-width) bg-(--bg-sidebar) border-l border-(--border) flex flex-col px-4 overflow-y-auto h-full">
        <st-sidebar-section title="Active Task">
          <div class="flex p-1 bg-(--bg-card) rounded-lg border border-(--border) gap-1">
            <button id="task-det" class="flex-1 py-1.5 rounded-md text-[0.75rem] font-bold transition-all active-task-btn disabled:opacity-40 disabled:cursor-not-allowed" disabled>
              Detection
            </button>
            <button id="task-seg" class="flex-1 py-1.5 rounded-md text-[0.75rem] font-bold transition-all text-(--text-muted) hover:text-(--text-primary) disabled:opacity-40 disabled:cursor-not-allowed" disabled>
              Segmentation
            </button>
          </div>
        </st-sidebar-section>

        <st-sidebar-section title="Classes">
          <div class="flex flex-col gap-1 py-1" id="class-list"></div>
          <button id="btn-add-class" class="mt-2 w-full flex items-center justify-center py-1.5 rounded-md bg-(--bg-card) border border-(--border) text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--bg-hover) transition-all disabled:opacity-50" disabled>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span class="ml-2 text-[0.75rem] font-semibold">New Class</span>
          </button>
        </st-sidebar-section>

        <st-sidebar-section title="AI Assistant" badge-id="model-status-badge" badge-text="Idle">
          <div class="flex flex-col gap-2">
            <button id="btn-load-model" class="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-(--bg-card) border border-(--border) text-(--text-primary) text-[0.85rem] font-semibold hover:bg-(--bg-hover) transition-all disabled:opacity-50">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" x2="12" y1="15" y2="3" />
              </svg>
              <span>Load Custom Model</span>
            </button>
            <button id="btn-auto-label-all" class="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-(--accent) text-(--accent-text) text-[0.85rem] font-bold hover:bg-(--accent-light) transition-all shadow-[0_4px_12px_var(--accent-glow)] disabled:opacity-50" disabled>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m12 14 4-4-4-4" />
                <path d="M3 3.41V21h11.81" />
                <path d="m13 15 4-4-4-4" />
                <path d="M3 13h14" />
              </svg>
              <span>Auto-Label Dataset</span>
            </button>
          </div>
        </st-sidebar-section>

        <st-sidebar-section title="AI Inspector">
          <div id="ai-logs" class="bg-black/20 rounded-lg p-2.5 font-mono text-[0.65rem] h-40 overflow-y-auto flex flex-col gap-1.5 border border-(--border) custom-scrollbar">
            <div class="text-(--text-muted) italic">Waiting for AI activity...</div>
          </div>
        </st-sidebar-section>

        <st-sidebar-section title="Annotations" badge-id="box-count" badge-text="0">
          <div id="annotation-list" class="flex flex-col gap-1">
            <div class="text-(--text-muted) text-[0.8rem] italic py-2 text-center">
              No annotations yet
            </div>
          </div>
        </st-sidebar-section>

        <st-hotkeys-guide></st-hotkeys-guide>

        <div class="py-6 mt-auto">
          <button id="btn-clear-all" class="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-[0.85rem] font-semibold hover:bg-red-500/20 transition-all disabled:opacity-50" disabled>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
            </svg>
            <span>Clear All Annotations</span>
          </button>
        </div>
      </aside>
    `;
  }
}

customElements.define('st-right-sidebar', RightSidebar);
