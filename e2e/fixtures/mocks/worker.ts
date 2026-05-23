/**
 * Playwright browser-side script mock for the background AI Web Worker and main-thread AIEngine.
 * Prevents fetching heavy models and running expensive WASM inference in the test environment.
 */
export function mockWorkerScript() {
  const OriginalWorker = window.Worker;

  class MockWorker extends EventTarget {
    public onmessage: ((this: any, ev: MessageEvent) => any) | null = null;
    public onmessageerror: ((this: any, ev: MessageEvent) => any) | null = null;
    public onerror: ((this: any, ev: ErrorEvent) => any) | null = null;

    constructor(url: string | URL, options?: WorkerOptions) {
      super();
      console.log('🤖 MockWorker created for URL:', url);

      // Auto-respond with "initialized" to simulate background engine ready
      setTimeout(() => {
        const initEvent = new MessageEvent('message', {
          data: { type: 'initialized' },
        });
        if (this.onmessage) this.onmessage(initEvent);
        this.dispatchEvent(initEvent);
      }, 50);
    }

    postMessage(message: any, transfer?: any[]): void {
      console.log('🤖 MockWorker postMessage received:', message);

      if (message.type === 'detect') {
        const { requestId } = message.payload;
        // Mock standard predictions for sample image
        setTimeout(() => {
          const detectEvent = new MessageEvent('message', {
            data: {
              type: 'detected',
              payload: {
                detections: [
                  { id: 101, classId: 0, x: 50, y: 50, width: 100, height: 150 },
                  { id: 102, classId: 2, x: 200, y: 80, width: 120, height: 90 },
                ],
                requestId,
                latency: 12,
              },
            },
          });
          if (this.onmessage) this.onmessage(detectEvent);
          this.dispatchEvent(detectEvent);
        }, 100);
      } else if (message.type === 'encode') {
        const { cacheKey } = message.payload;
        // Mock SAM embeddings response
        setTimeout(() => {
          const encodeEvent = new MessageEvent('message', {
            data: {
              type: 'encoded',
              payload: {
                embeddings: new Float32Array(256),
                dims: [1, 256, 64, 64],
                cacheKey,
                latency: 45,
              },
            },
          });
          if (this.onmessage) this.onmessage(encodeEvent);
          this.dispatchEvent(encodeEvent);
        }, 100);
      }
    }

    terminate(): void {
      console.log('🤖 MockWorker terminated');
    }

    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions
    ): void {
      if (listener) {
        super.addEventListener(type, listener, options);
      }
    }

    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions
    ): void {
      if (listener) {
        super.removeEventListener(type, listener, options);
      }
    }
  }

  // Replace global Worker constructor
  (window as any).Worker = MockWorker;

  // Intercept and mock the AIEngine instance __ai
  let mockedAI: any = null;
  Object.defineProperty(window, '__ai', {
    get() {
      return mockedAI;
    },
    set(aiInstance) {
      mockedAI = aiInstance;
      console.log('🤖 Intercepted __ai instance, mocking methods...');

      aiInstance.loadModels = async () => {
        console.log('🤖 Mocked loadModels called');
        aiInstance.isLoaded = true;
        // Access global state
        const state = (window as any).__state;
        if (state) {
          state.set({
            modelStatus: 'ready',
            aiModel: { name: 'Mocked RT-DETR + MobileSAM' },
          });
        }
        aiInstance.log('✅ AI Engines Mock-Loaded successfully');
      };

      aiInstance.detect = async (bitmap: any) => {
        console.log('🤖 Mocked detect called');
        return [
          { id: 101, classId: 0, x: 50, y: 50, width: 100, height: 150 },
          { id: 102, classId: 2, x: 200, y: 80, width: 120, height: 90 },
        ];
      };

      aiInstance.setSAMImage = async (bitmap: any, cacheKey: string) => {
        console.log('🤖 Mocked setSAMImage called for cacheKey:', cacheKey);
        aiInstance.activeKey = cacheKey;
        const state = (window as any).__state;
        if (state) {
          state.set({ modelStatus: 'ready' });
        }
      };

      aiInstance.predictSAMMask = async () => {
        console.log('🤖 Mocked predictSAMMask called');
        return new Array(256 * 256).fill(0);
      };
    },
    configurable: true,
  });
}
