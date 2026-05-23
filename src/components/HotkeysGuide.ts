export class HotkeysGuide extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.render();
  }

  private render() {
    this.innerHTML = `
      <div class="py-4 border-b border-(--border) flex flex-col bg-(--bg-card)/30 -mx-4 px-4 my-2">
        <h3 class="text-[0.85rem] font-bold uppercase tracking-wider text-(--text-muted) mb-3">
          Hotkeys
        </h3>
        <ul class="flex flex-col gap-2.5">
          <li class="flex justify-between items-center text-[0.8rem] text-(--text-secondary)">
            <span>Draw Mode</span>
            <kbd class="bg-(--bg-card) px-1.5 py-0.5 rounded border border-(--border) text-(--text-primary) font-mono">W</kbd>
          </li>
          <li class="flex justify-between items-center text-[0.8rem] text-(--text-secondary)">
            <span>Select Mode</span>
            <kbd class="bg-(--bg-card) px-1.5 py-0.5 rounded border border-(--border) text-(--text-primary) font-mono">V</kbd>
          </li>
          <li class="flex justify-between items-center text-[0.8rem] text-(--text-secondary)">
            <span>Next Image</span>
            <kbd class="bg-(--bg-card) px-1.5 py-0.5 rounded border border-(--border) text-(--text-primary) font-mono">D</kbd>
          </li>
          <li class="flex justify-between items-center text-[0.8rem] text-(--text-secondary)">
            <span>Prev Image</span>
            <kbd class="bg-(--bg-card) px-1.5 py-0.5 rounded border border-(--border) text-(--text-primary) font-mono">A</kbd>
          </li>
          <li class="flex justify-between items-center text-[0.8rem] text-(--text-secondary)">
            <span>Delete Box</span>
            <kbd class="bg-(--bg-card) px-1.5 py-0.5 rounded border border-(--border) text-(--text-primary) font-mono text-[0.7rem]">Del</kbd>
          </li>
          <li class="flex justify-between items-center text-[0.8rem] text-(--text-secondary)">
            <span>Pan View</span>
            <kbd class="bg-(--bg-card) px-1.5 py-0.5 rounded border border-(--border) text-(--text-primary) font-mono text-[0.7rem]">Space</kbd>
          </li>
          <li class="flex justify-between items-center text-[0.8rem] text-(--text-secondary)">
            <span>Zoom In / Out</span>
            <div class="flex items-center gap-1">
              <kbd class="bg-(--bg-card) px-1.5 py-0.5 rounded border border-(--border) text-(--text-primary) font-mono text-[0.7rem]">Ctrl</kbd><span>+</span><kbd class="bg-(--bg-card) px-1.5 py-0.5 rounded border border-(--border) text-(--text-primary) font-mono text-[0.7rem]">Scroll</kbd>
            </div>
          </li>
          <li class="flex justify-between items-center text-[0.8rem] text-(--text-secondary)">
            <span>Switch Task</span>
            <kbd class="bg-(--bg-card) px-1.5 py-0.5 rounded border border-(--border) text-(--text-primary) font-mono text-[0.7rem]">T</kbd>
          </li>
        </ul>
      </div>
    `;
  }
}

customElements.define('st-hotkeys-guide', HotkeysGuide);
