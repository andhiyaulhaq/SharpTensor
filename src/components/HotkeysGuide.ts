export class HotkeysGuide extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.render();
  }

  private render() {
    this.innerHTML = `
      <div class="absolute top-4 right-4 z-[100] group">
        <!-- Floating Toggle Button -->
        <button class="flex items-center justify-center w-10 h-10 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 text-white/70 hover:text-white hover:bg-black/60 transition-all cursor-help shadow-lg" aria-label="Keyboard Shortcuts">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
            <line x1="6" y1="8" x2="6.01" y2="8"></line>
            <line x1="10" y1="8" x2="10.01" y2="8"></line>
            <line x1="14" y1="8" x2="14.01" y2="8"></line>
            <line x1="18" y1="8" x2="18.01" y2="8"></line>
            <line x1="6" y1="12" x2="6.01" y2="12"></line>
            <line x1="10" y1="12" x2="10.01" y2="12"></line>
            <line x1="14" y1="12" x2="14.01" y2="12"></line>
            <line x1="18" y1="12" x2="18.01" y2="12"></line>
            <line x1="7" y1="16" x2="17" y2="16"></line>
          </svg>
        </button>

        <!-- Hover Tooltip Panel -->
        <div class="absolute top-full right-0 mt-3 w-64 bg-[#1a1f22]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-4 transition-all duration-200 origin-top-right opacity-0 pointer-events-none scale-95 group-hover:opacity-100 group-hover:pointer-events-auto group-hover:scale-100">
          <h3 class="text-[0.85rem] font-bold uppercase tracking-wider text-white/60 mb-4 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.9 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
            Shortcuts
          </h3>
          <ul class="flex flex-col gap-3">
            <li class="flex justify-between items-center text-[0.8rem] text-white/80">
              <span>Draw Mode</span>
              <kbd class="bg-black/50 px-1.5 py-0.5 rounded border border-white/10 text-white font-mono shadow-sm">W</kbd>
            </li>
            <li class="flex justify-between items-center text-[0.8rem] text-white/80">
              <span>Select Mode</span>
              <kbd class="bg-black/50 px-1.5 py-0.5 rounded border border-white/10 text-white font-mono shadow-sm">V</kbd>
            </li>
            <li class="flex justify-between items-center text-[0.8rem] text-white/80">
              <span>Next Image</span>
              <kbd class="bg-black/50 px-1.5 py-0.5 rounded border border-white/10 text-white font-mono shadow-sm">D</kbd>
            </li>
            <li class="flex justify-between items-center text-[0.8rem] text-white/80">
              <span>Prev Image</span>
              <kbd class="bg-black/50 px-1.5 py-0.5 rounded border border-white/10 text-white font-mono shadow-sm">A</kbd>
            </li>
            <li class="flex justify-between items-center text-[0.8rem] text-white/80">
              <span>Delete Box</span>
              <kbd class="bg-black/50 px-1.5 py-0.5 rounded border border-white/10 text-white font-mono text-[0.7rem] shadow-sm">Del</kbd>
            </li>
            <li class="flex justify-between items-center text-[0.8rem] text-white/80">
              <span>Pan View</span>
              <kbd class="bg-black/50 px-1.5 py-0.5 rounded border border-white/10 text-white font-mono text-[0.7rem] shadow-sm">Space</kbd>
            </li>
            <li class="flex justify-between items-center text-[0.8rem] text-white/80">
              <span>Zoom In / Out</span>
              <div class="flex items-center gap-1">
                <kbd class="bg-black/50 px-1.5 py-0.5 rounded border border-white/10 text-white font-mono text-[0.7rem] shadow-sm">Ctrl</kbd><span class="text-white/40">+</span><kbd class="bg-black/50 px-1.5 py-0.5 rounded border border-white/10 text-white font-mono text-[0.7rem] shadow-sm">Scroll</kbd>
              </div>
            </li>
            <li class="flex justify-between items-center text-[0.8rem] text-white/80">
              <span>Switch Task</span>
              <kbd class="bg-black/50 px-1.5 py-0.5 rounded border border-white/10 text-white font-mono text-[0.7rem] shadow-sm">T</kbd>
            </li>
          </ul>
        </div>
      </div>
    `;
  }
}

customElements.define('st-hotkeys-guide', HotkeysGuide);
