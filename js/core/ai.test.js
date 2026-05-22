import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIEngine, ai } from './ai.js';
import { state } from './state.js';

// Mock the state module to avoid side effects
vi.mock('./state.js', () => ({
  state: {
    set: vi.fn(),
    currentImage: { name: 'test.jpg' },
  },
}));

describe('AIEngine', () => {
  let engine;

  beforeEach(() => {
    vi.clearAllMocks();
    // Since ai is a singleton, we can create a fresh instance for testing
    engine = new AIEngine();

    // Mock the worker methods
    engine.worker = {
      postMessage: vi.fn(),
      onmessage: null,
    };
  });

  it('should initialize and create worker', () => {
    expect(engine.embeddingCache.size).toBe(0);
    expect(engine.isLoaded).toBe(false);
  });

  it('should handle worker initialized message', () => {
    engine.handleWorkerMessage({
      data: { type: 'initialized' },
    });
    expect(engine.isWorkerReady).toBe(true);
  });

  it('should load models and update state', async () => {
    // Mock fetch for prompt encoder weights
    global.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        'model.pe_layer.positional_encoding_gaussian_matrix': [[1]],
        'model.point_embeddings.0.weight': [[0]],
        'model.point_embeddings.1.weight': [[0]],
        'model.point_embeddings.2.weight': [[0]],
        'model.point_embeddings.3.weight': [[0]],
        'model.not_a_point_embed.weight': [[0]],
        'model.no_mask_embed.weight': [[0]],
      }),
    });

    // Use Promise.all to handle the async load models
    const loadPromise = engine.loadModels();
    expect(state.set).toHaveBeenCalledWith({ modelStatus: 'loading' });
    expect(engine.worker.postMessage).toHaveBeenCalledWith({
      type: 'init',
      payload: expect.any(Object),
    });

    await loadPromise;
    expect(engine.isLoaded).toBe(true);
    expect(state.set).toHaveBeenCalledWith(
      expect.objectContaining({
        modelStatus: 'ready',
      })
    );
  });

  it('should handle worker encode response', () => {
    // Mock tensor globally since we mocked ONNX runtime
    engine.activeKey = 'test.jpg';
    engine.embeddingCache.set('test.jpg', { width: 800, height: 600 });

    engine.handleWorkerMessage({
      data: {
        type: 'encoded',
        payload: {
          cacheKey: 'test.jpg',
          embeddings: new Float32Array(10),
          dims: [1, 256, 64, 64],
          latency: 100,
        },
      },
    });

    const entry = engine.embeddingCache.get('test.jpg');
    expect(entry).toHaveProperty('embeddings');
    expect(state.set).toHaveBeenCalledWith({ modelStatus: 'ready' });
  });

  it('should handle worker detect response', () => {
    const resolveFn = vi.fn();
    engine.pendingDetections.set('req123', resolveFn);

    engine.handleWorkerMessage({
      data: {
        type: 'detected',
        payload: {
          requestId: 'req123',
          detections: [{ classId: 0, x: 10, y: 10 }],
          latency: 50,
        },
      },
    });

    expect(resolveFn).toHaveBeenCalledWith([{ classId: 0, x: 10, y: 10 }]);
    expect(engine.pendingDetections.has('req123')).toBe(false);
  });

  it('should dispatch log events', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    engine.log('test message', 'info');

    expect(dispatchSpy).toHaveBeenCalled();
    const event = dispatchSpy.mock.calls[0][0];
    expect(event.type).toBe('ai-log');
    expect(event.detail.message).toBe('test message');
  });
});
