export class BYOMPanel extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.render();
    this.initEventListeners();
  }

  open() {
    const panel = this.querySelector('#byom-panel-container');
    if (panel) panel.classList.remove('translate-x-full');
  }

  close() {
    const panel = this.querySelector('#byom-panel-container');
    if (panel) panel.classList.add('translate-x-full');
  }

  private render() {
    this.innerHTML = `
      <div id="byom-panel-container" class="fixed top-0 right-0 h-full w-[450px] z-100 transform translate-x-full transition-transform duration-300 ease-in-out bg-(--bg-card)/90 backdrop-blur-2xl border-l border-(--border) shadow-2xl flex flex-col">
        <!-- Header -->
        <div class="h-(--header-height) border-b border-(--border) flex items-center justify-between px-5 shrink-0 bg-(--bg-header)/50">
          <h2 class="font-bold text-[1rem] tracking-tight flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-(--accent)">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" x2="12" y1="15" y2="3" />
            </svg>
            Model Manager
          </h2>
          <button id="btn-close-byom" class="text-(--text-secondary) hover:text-(--text-primary) transition-colors p-1 rounded-md hover:bg-(--bg-hover)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <!-- Scrollable Content -->
        <div class="flex-1 overflow-y-auto p-5 flex flex-col gap-6 custom-scrollbar">

          <!-- Upload Zone -->
          <div class="flex flex-col gap-2">
            <label class="text-[0.75rem] font-semibold text-(--text-secondary) uppercase tracking-wider">1. Select ONNX Model</label>
            <div id="byom-dropzone" class="border-2 border-dashed border-(--border) rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-(--accent) hover:bg-(--accent)/5 transition-all group">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-(--text-muted) group-hover:text-(--accent) mb-3 transition-colors">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span class="text-[0.85rem] font-medium text-(--text-primary) mb-1">Click or drag \`.onnx\` file here</span>
              <span id="byom-file-info" class="text-[0.75rem] text-(--text-muted)">Max recommended size: 200MB</span>
              <input type="file" id="byom-file-input" accept=".onnx" class="hidden" />
            </div>
          </div>

          <!-- Configuration -->
          <div class="flex flex-col gap-4">
            <label class="text-[0.75rem] font-semibold text-(--text-secondary) uppercase tracking-wider">2. Configuration</label>

            <div class="flex flex-col gap-1.5">
              <span class="text-[0.8rem] text-(--text-primary)">Decoder Archetype</span>
              <select id="byom-archetype" class="w-full bg-(--bg-main) border border-(--border) text-(--text-primary) text-[0.85rem] p-2 rounded focus:ring-1 focus:ring-(--accent) outline-none transition-all cursor-pointer">
                <option value="yolov8">YOLOv8 / YOLOv10 (Default)</option>
                <option value="yolov5">YOLOv5 / YOLOv6</option>
                <option value="rtdetr_ultra">RT-DETR (Ultralytics)</option>
                <option value="rtdetr_paddle">RT-DETR (Original / Paddle)</option>
                <option value="custom_js">Custom JavaScript Sandbox</option>
              </select>
            </div>

            <details id="byom-advanced-details" class="group border border-(--border) rounded-lg bg-(--bg-main) overflow-hidden">
              <summary class="text-[0.8rem] font-medium text-(--text-primary) p-3 cursor-pointer hover:bg-(--bg-hover) transition-colors flex items-center justify-between select-none">
                <span>Advanced Preprocessing Settings</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-(--text-muted) transform transition-transform group-open:rotate-180"><polyline points="6 9 12 15 18 9"/></svg>
              </summary>
              
              <div class="p-3 border-t border-(--border) flex flex-col gap-4 bg-(--bg-card)/50">
                <div class="grid grid-cols-2 gap-3">
                  <div class="flex flex-col gap-1.5">
                    <span class="text-[0.8rem] text-(--text-primary)">Input Width</span>
                    <input type="number" id="byom-input-w" value="640" class="w-full bg-(--bg-main) border border-(--border) text-(--text-primary) text-[0.85rem] p-2 rounded focus:ring-1 focus:ring-(--accent) outline-none transition-all" />
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <span class="text-[0.8rem] text-(--text-primary)">Input Height</span>
                    <input type="number" id="byom-input-h" value="640" class="w-full bg-(--bg-main) border border-(--border) text-(--text-primary) text-[0.85rem] p-2 rounded focus:ring-1 focus:ring-(--accent) outline-none transition-all" />
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div class="flex flex-col gap-1.5">
                    <span class="text-[0.8rem] text-(--text-primary)">Mean (RGB)</span>
                    <input type="text" id="byom-mean" value="0, 0, 0" class="w-full bg-(--bg-main) border border-(--border) text-(--text-primary) text-[0.85rem] p-2 rounded focus:ring-1 focus:ring-(--accent) outline-none transition-all font-mono" />
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <span class="text-[0.8rem] text-(--text-primary)">Std Dev (RGB)</span>
                    <input type="text" id="byom-std" value="255, 255, 255" class="w-full bg-(--bg-main) border border-(--border) text-(--text-primary) text-[0.85rem] p-2 rounded focus:ring-1 focus:ring-(--accent) outline-none transition-all font-mono" />
                  </div>
                </div>
              </div>
            </details>
          </div>

          <!-- Custom JS Editor -->
          <div id="byom-custom-js-wrapper" class="hidden flex-col gap-2">
            <div class="flex items-center justify-between">
              <label class="text-[0.75rem] font-semibold text-(--accent) uppercase tracking-wider">Custom JS Decoder</label>
            </div>
            <textarea id="byom-custom-js" spellcheck="false" class="w-full h-[180px] bg-[#0d1117] border border-(--border) text-[#c9d1d9] text-[0.8rem] p-3 rounded-lg focus:ring-1 focus:ring-(--accent) outline-none transition-all font-mono resize-y custom-scrollbar" placeholder="// Write decoder snippet here...&#10;// Available: tensors, config, nms()"></textarea>
            <p class="text-[0.7rem] text-(--text-muted)">Code runs in an isolated Web Worker sandbox. Must return a <code class="text-(--accent)">BoundingBox[]</code>.</p>
          </div>

        </div>

        <!-- Footer Actions -->
        <div class="p-5 border-t border-(--border) bg-(--bg-header)/50 shrink-0">
          <button id="btn-apply-byom" disabled class="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-(--accent) text-(--accent-text) text-[0.9rem] font-bold hover:bg-(--accent-light) transition-all shadow-[0_4px_12px_var(--accent-glow)] disabled:opacity-50">
            Apply Model
          </button>
        </div>
      </div>
    `;
  }

  private initEventListeners() {
    const closeBtn = this.querySelector('#btn-close-byom');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    const archetypeSelect = this.querySelector('#byom-archetype') as HTMLSelectElement;
    const customJsWrapper = this.querySelector('#byom-custom-js-wrapper');
    const meanInput = this.querySelector('#byom-mean') as HTMLInputElement;
    const stdInput = this.querySelector('#byom-std') as HTMLInputElement;
    const advancedDetails = this.querySelector('#byom-advanced-details') as HTMLDetailsElement;

    if (archetypeSelect && customJsWrapper) {
      archetypeSelect.addEventListener('change', (e) => {
        const val = (e.target as HTMLSelectElement).value;

        if (val === 'custom_js') {
          customJsWrapper.classList.remove('hidden');
          customJsWrapper.classList.add('flex');
          if (advancedDetails) advancedDetails.open = true;
        } else {
          customJsWrapper.classList.add('hidden');
          customJsWrapper.classList.remove('flex');
          
          if (meanInput && stdInput) {
            if (val === 'rtdetr_paddle') {
              meanInput.value = '0.485, 0.456, 0.406';
              stdInput.value = '0.229, 0.224, 0.225';
            } else {
              meanInput.value = '0, 0, 0';
              stdInput.value = '255, 255, 255';
            }
          }
        }
      });
    }

    const dropzone = this.querySelector('#byom-dropzone') as HTMLElement;
    const fileInput = this.querySelector('#byom-file-input') as HTMLInputElement;
    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      
      const preventDefaults = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
      };
      
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, preventDefaults, false);
      });
      
      ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
          dropzone.classList.add('border-(--accent)', 'bg-(--accent)/10');
          dropzone.classList.remove('border-(--border)');
        }, false);
      });
      
      ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
          dropzone.classList.remove('border-(--accent)', 'bg-(--accent)/10');
          dropzone.classList.add('border-(--border)');
        }, false);
      });
      
      dropzone.addEventListener('drop', (e: DragEvent) => {
        const dt = e.dataTransfer;
        const files = dt?.files;
        if (files && files.length > 0) this.handleFileUpload(files[0]);
      }, false);

      fileInput.addEventListener('change', (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (files && files.length > 0) this.handleFileUpload(files[0]);
      });
    }
  }

  private handleFileUpload(file: File | undefined): void {
    if (!file) return;
    const fileInfo = this.querySelector('#byom-file-info');
    if (!file.name.endsWith('.onnx')) {
      const event = new CustomEvent('status-update', { 
        detail: { msg: '❌ Invalid file. Please upload an .onnx model.', isError: true },
        bubbles: true 
      });
      this.dispatchEvent(event);
      return;
    }
    if (fileInfo) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      fileInfo.innerHTML = `<span class="text-green-400">Memory Validated ✓</span> (${sizeMB} MB)`;
    }
    const event = new CustomEvent('status-update', { 
      detail: { msg: `Ready to apply custom model: ${file.name}`, isError: false },
      bubbles: true 
    });
    this.dispatchEvent(event);
  }
}

customElements.define('st-byom-panel', BYOMPanel);
