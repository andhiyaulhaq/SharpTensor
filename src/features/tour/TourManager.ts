import { useAppStore } from '../../core/store';

export interface TourManagerConfig {
  dom: {
    btnAutoLabelAll: HTMLButtonElement;
    btnDraw: HTMLButtonElement;
    btnSelect: HTMLButtonElement;
  };
  onStatusUpdate: (msg: string) => void;
}

export class TourManager {
  private tourTooltipEl: HTMLElement | null = null;
  private tourOverlayEl: SVGSVGElement | null = null;
  private dom: TourManagerConfig['dom'];
  private onStatusUpdate: (msg: string) => void;

  constructor(config: TourManagerConfig) {
    this.dom = config.dom;
    this.onStatusUpdate = config.onStatusUpdate;
  }

  startTour(): void {
    useAppStore.getState().set({ tourActive: true, tourStep: 'step1-autolabel' });
    this.dom.btnAutoLabelAll.classList.add('tour-highlight');
    this.renderTourOverlay([this.dom.btnAutoLabelAll]);
    this.renderTourTooltip(
      this.dom.btnAutoLabelAll,
      "Welcome to SharpTensor! Click here to automatically detect objects using the YOLOv8 AI."
    );
    window.addEventListener('resize', this.handleTourResize);
  }

  advanceTour(step: 'step2-interact' | 'complete'): void {
    if (!useAppStore.getState().tourActive) return;

    if (step === 'step2-interact') {
      useAppStore.getState().set({ tourStep: 'step2-interact' });
      this.dom.btnAutoLabelAll.classList.remove('tour-highlight');
      
      this.dom.btnDraw.classList.add('tour-highlight');
      this.dom.btnSelect.classList.add('tour-highlight');

      this.renderTourOverlay([this.dom.btnDraw, this.dom.btnSelect]);
      this.renderTourTooltip(
        this.dom.btnDraw,
        "Awesome! Now select the **Draw Mode (W)** to manually add a box, or **Select Mode (V)** to adjust the generated ones."
      );
    } else if (step === 'complete') {
      useAppStore.getState().set({ tourActive: false, tourStep: 'complete' });
      this.dom.btnAutoLabelAll.classList.remove('tour-highlight');
      this.dom.btnDraw.classList.remove('tour-highlight');
      this.dom.btnSelect.classList.remove('tour-highlight');
      
      if (this.tourTooltipEl) {
        this.tourTooltipEl.remove();
        this.tourTooltipEl = null;
      }
      if (this.tourOverlayEl) {
        this.tourOverlayEl.remove();
        this.tourOverlayEl = null;
      }
      window.removeEventListener('resize', this.handleTourResize);
      this.onStatusUpdate('Tour complete! Feel free to open your own local folder.');
    }
  }

  private handleTourResize = () => {
    if (!useAppStore.getState().tourActive) return;
    if (useAppStore.getState().tourStep === 'step1-autolabel') {
      this.renderTourOverlay([this.dom.btnAutoLabelAll]);
      this.renderTourTooltip(this.dom.btnAutoLabelAll, "Welcome to SharpTensor! Click here to automatically detect objects using the YOLOv8 AI.");
    } else if (useAppStore.getState().tourStep === 'step2-interact') {
      this.renderTourOverlay([this.dom.btnDraw, this.dom.btnSelect]);
      this.renderTourTooltip(this.dom.btnDraw, "Awesome! Now select the **Draw Mode (W)** to manually add a box, or **Select Mode (V)** to adjust the generated ones.");
    }
  };

  private renderTourOverlay(targetEls: HTMLElement[]): void {
    if (!this.tourOverlayEl) {
      this.tourOverlayEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      // Set z-index to 9998 so it covers the z-100 header completely!
      this.tourOverlayEl.setAttribute('style', 'position: fixed; inset: 0; z-index: 9998; pointer-events: none; width: 100vw; height: 100vh;');
      document.body.appendChild(this.tourOverlayEl);
    }

    let rectsHtml = '';
    targetEls.forEach((el) => {
      const rect = el.getBoundingClientRect();
      rectsHtml += `<rect x="${rect.left - 4}" y="${rect.top - 4}" width="${rect.width + 8}" height="${rect.height + 8}" fill="black" rx="8" />`;
    });

    this.tourOverlayEl.innerHTML = `
      <defs>
        <mask id="tour-hole">
          <rect width="100%" height="100%" fill="white" />
          ${rectsHtml}
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#tour-hole)" />
    `;
  }

  private renderTourTooltip(targetEl: HTMLElement, text: string): void {
    if (!this.tourTooltipEl) {
      this.tourTooltipEl = document.createElement('div');
      // Updated to a bright, light theme with z-index 9999 to render above the overlay
      this.tourTooltipEl.className = 'absolute z-[9999] bg-white/95 backdrop-blur-md border border-gray-200 rounded-xl p-4 shadow-2xl text-gray-900 font-medium text-sm w-[300px] transition-opacity duration-300 pointer-events-none';
      document.body.appendChild(this.tourTooltipEl);
    }

    // Parse simple markdown-like bold for **text**
    this.tourTooltipEl.innerHTML = text.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');

    const rect = targetEl.getBoundingClientRect();
    
    // Determine positioning based on where the element is
    let left: number;
    let top: number;

    if (rect.left > window.innerWidth / 2) {
      // Position to the left of the element
      left = rect.left - 320; // 300px width + 20px gap
      top = rect.top + (rect.height / 2) - 30; // Roughly centered vertically
    } else {
      // Elements in header (like btn-draw)
      // Position below the element
      left = rect.left;
      top = rect.bottom + 15;
    }

    this.tourTooltipEl.style.left = `${left}px`;
    this.tourTooltipEl.style.top = `${top}px`;
  }
}
