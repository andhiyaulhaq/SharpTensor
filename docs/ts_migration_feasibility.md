# Feasibility Study: JavaScript → TypeScript Migration for SharpTensor

**Version:** 1.0  
**Date:** 2026-05-23  
**Status:** RECOMMENDED — High Value, Low Risk

---

## 1. Executive Summary

SharpTensor is a local-first, browser-based AI annotation tool. Its codebase is **~4,200 lines of JavaScript** split across 13 source files. A migration to TypeScript is **highly feasible** and represents a high-value, low-risk investment. The codebase has a clean modular architecture, existing unit tests, a modern Vite-based toolchain, and rich internal data contracts (detection boxes, annotations, AI state, worker messages) — all of which are exactly the type of code that benefits most from static typing.

**Verdict: Fully Proceed.** TypeScript can be introduced incrementally, file-by-file, with zero disruption to the running application, and offers immediate returns in developer confidence, IDE intelligence, and long-term maintainability.

---

## 2. Codebase Analysis

### 2.1 File Inventory

| File                              | Lines | Complexity | Type Risk                                                        |
| --------------------------------- | ----- | ---------- | ---------------------------------------------------------------- |
| `js/core/state.js`                | 116   | Low        | **High** — untyped `data` object with 20+ mixed-type fields      |
| `js/core/ai.js`                   | 361   | High       | **High** — implicit `ort.Tensor`, Map caches, worker messages    |
| `js/core/ai.worker.js`            | 326   | High       | **High** — global `ort` from `importScripts`, untyped results    |
| `js/core/sam_utils.js`            | 303   | Medium     | Medium — matrix math with raw arrays                             |
| `js/engine/canvas.js`             | 793   | Very High  | **High** — implicit interaction objects, DOM queries, box shapes |
| `js/utils/yolo.js`                | 158   | Low        | Medium — parsing functions with null returns                     |
| `js/main.js`                      | 1,577 | Very High  | **High** — implicit DOM handles, cache maps, complex async flows |
| `js/components/AppModal.js`       | 79    | Low        | Low — Simple Custom Element                                      |
| `js/components/ToolButton.js`     | 73    | Low        | Low — Simple Custom Element                                      |
| `js/components/SidebarSection.js` | ~50   | Low        | Low                                                              |
| `js/components/WelcomeModal.js`   | ~50   | Low        | Low                                                              |
| `js/tests/setup.js`               | 82    | Low        | Low                                                              |
| `js/tests/*.test.js`              | ~250  | Medium     | Medium — typed mocks, assertions                                 |

**Total: ~4,218 lines across 13 files**

### 2.2 Identified Type-Safety Gaps (Current JS)

The following patterns exist in the codebase today that TypeScript would immediately catch:

#### Gap 1: Untyped State Object (`state.js`)

```js
// Current — any field can be written with any value
this.data = {
  currentTask: 'detection', // string but should be 'detection' | 'segmentation'
  images: [],               // no element type — what is an "image"?
  annotations: [],          // no element type — box? polygon? both?
  modelStatus: 'idle',      // string but should be union type
  ...
}
```

#### Gap 2: Implicit Worker Message Protocol (`ai.js`, `ai.worker.js`)

```js
// Main thread sends:
this.worker.postMessage({ type: 'encode', payload: { imageData, width, height, cacheKey } });

// Worker receives with no validation:
const { type, payload } = event.data; // payload is `any`
```

There is no shared type contract between the two threads — a typo in a message type silently fails.

#### Gap 3: Annotation Shape Is Ambiguous (`canvas.js`, `yolo.js`, `main.js`)

```js
// A box can be either of these shapes — callers must know implicitly:
{
  (id, x, y, width, height, classId);
} // Detection box
{
  (id, x, y, width, height, classId, polygon);
} // Segmentation polygon
```

#### Gap 4: ESLint Rules Are Disabled to Compensate

```js
// eslint.config.js
rules: {
  'no-unused-vars': 'off',  // Turned off because JS can't detect this well
  'no-undef': 'off',        // `ort` global is unverifiable without types
}
```

TypeScript would replace these ESLint safety nets with compile-time guarantees.

#### Gap 5: Implicit DOM Handles (`main.js`)

```js
this.dom = {
  btnOpen: document.getElementById('btn-open'), // HTMLElement | null — no type check
  modal: document.getElementById('app-modal'),  // AppModal? HTMLElement? Unknown
}
// Later...
this.dom.btnOpen.addEventListener(...) // No null safety check enforced
```

---

## 3. Type Design Blueprint

The following type interfaces would be the core of the TypeScript migration:

### 3.1 Domain Types (`src/core/types.ts`)

```typescript
// Annotation Types
export interface BoundingBox {
  id: number;
  classId: number;
  x: number;
  y: number;
  width: number;
  height: number;
  score?: number;
  polygon?: [number, number][];
}

export interface AnnotationClass {
  id: number;
  name: string;
  color: string;
}

// State Types
export type TaskMode = 'detection' | 'segmentation';
export type InteractionMode = 'select' | 'draw' | 'magic';
export type ModelStatus = 'idle' | 'loading' | 'ready' | 'processing' | 'error';

export interface ImageEntry {
  name: string;
  handle: FileSystemFileHandle | { getFile: () => Promise<File> };
  status: 'pending' | 'labeled';
}

export interface PromptPoint {
  x: number;
  y: number;
  label: 0 | 1;
}

export interface AppStateData {
  folderHandle: FileSystemDirectoryHandle | null;
  labelFolderHandle: FileSystemDirectoryHandle | null;
  labelSegFolderHandle: FileSystemDirectoryHandle | null;
  currentTask: TaskMode;
  images: ImageEntry[];
  currentImageIndex: number;
  currentImageBitmap: ImageBitmap | null;
  annotations: BoundingBox[];
  selectedBoxId: number | null;
  hoveredBoxId: number | null;
  classes: AnnotationClass[];
  selectedClassId: number | null;
  zoom: number;
  pan: { x: number; y: number };
  isPanning: boolean;
  interactionMode: InteractionMode;
  mode?: InteractionMode;
  loading: boolean;
  aiModel: { name: string } | null;
  isAutoLabeling: boolean;
  autoLabelProgress: number;
  modelStatus: ModelStatus;
  activeMask: number[] | null;
  promptPoints: PromptPoint[];
  activePromptBox: [number, number, number, number] | null;
  samLatency: { encoder: number; decoder: number };
}

// Worker Message Protocol (Discriminated Unions)
export type WorkerInboundMessage =
  | { type: 'init'; payload: { samUrl: string; rtdetrUrl: string; modelType: 'yolov8' | 'rtdetr' } }
  | {
      type: 'encode';
      payload: { imageData: ImageData; width: number; height: number; cacheKey: string };
    }
  | {
      type: 'detect';
      payload: { imageData: ImageData; width: number; height: number; requestId: string };
    };

export type WorkerOutboundMessage =
  | { type: 'initialized' }
  | {
      type: 'encoded';
      payload: { embeddings: Uint16Array; dims: number[]; cacheKey: string; latency: number };
    }
  | { type: 'detected'; payload: { detections: BoundingBox[]; requestId: string; latency: number } }
  | { type: 'error'; payload: string };

// Canvas Interaction Types
export interface Point {
  x: number;
  y: number;
}
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export type CanvasInteraction =
  | { type: 'pan' }
  | { type: 'draw'; boxId: number; startImgPos: Point }
  | { type: 'move'; boxId: number; startImgPos: Point; startBox: BoundingBox }
  | {
      type: 'resize';
      boxId: number;
      handle: ResizeHandle;
      startImgPos: Point;
      startBox: BoundingBox;
    }
  | { type: 'magic'; startImgPos: Point; button: number; isDrag: boolean; currentImgPos?: Point };

// Embedding Cache
export interface EmbeddingCacheEntry {
  width: number;
  height: number;
  embeddings?: import('onnxruntime-web').Tensor;
}
```

---

## 4. Toolchain Changes Required

### 4.1 Current vs. Target Configuration

| Concern           | Current (JS)             | After Migration (TS)                    |
| ----------------- | ------------------------ | --------------------------------------- |
| **Language**      | `.js` files, ES Modules  | `.ts` files, ES Modules                 |
| **Build**         | Vite (native JS)         | Vite (native TS — zero config needed)   |
| **Linter**        | `@eslint/js` + `globals` | `typescript-eslint`                     |
| **Test**          | Vitest (native JS)       | Vitest (native TS — zero config needed) |
| **Type Checking** | None                     | `tsc --noEmit` (type-check only)        |
| **Worker**        | `importScripts()` CDN    | ESM `import` + Vite worker bundling     |

### 4.2 New Dependencies

```json
{
  "devDependencies": {
    "typescript": "^5.5.0",
    "typescript-eslint": "^8.0.0"
  }
}
```

> Note: `onnxruntime-web` (already in `dependencies`) ships with its own TypeScript definitions — no `@types/onnxruntime-web` needed.

### 4.3 `tsconfig.json` (New File)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitAny": true,
    "skipLibCheck": false,
    "noEmit": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**Key flags rationale:**

- `strict: true` — enables `strictNullChecks`, `strictFunctionTypes`, `noImplicitAny`
- `noUncheckedIndexedAccess: true` — catches `state.data.images[index]` patterns (could be `undefined`)
- `lib: ["WebWorker"]` — required for `self`, `OffscreenCanvas`, `importScripts` types in `ai.worker.ts`

### 4.4 Directory Structure Change

```
Before:                 After:
js/                     src/
├── core/               ├── core/
│   ├── state.js        │   ├── state.ts
│   ├── ai.js           │   ├── ai.ts
│   ├── ai.worker.js    │   ├── ai.worker.ts
│   └── sam_utils.js    │   ├── sam_utils.ts
│                       │   └── types.ts        ← NEW
├── engine/             ├── engine/
│   └── canvas.js       │   └── canvas.ts
├── utils/              ├── utils/
│   └── yolo.js         │   └── yolo.ts
├── components/         ├── components/
│   └── *.js            │   └── *.ts
├── tests/              ├── tests/
│   └── *.test.js       │   └── *.test.ts
└── main.js             └── main.ts
```

`index.html` entry point updates from `./js/main.js` → `./src/main.ts` (Vite handles this natively).

---

## 5. Module-by-Module Migration Analysis

### 5.1 `core/state.ts` — Effort: Low (3h)

Typed `AppStateData` on `this.data`. Typed `listeners` array. Typed `subscribe()` callback. The Observer pattern maps cleanly.

```typescript
// Before
set(partialData) {
  this.data = { ...this.data, ...partialData };
}

// After — TypeScript validates partial keys/types
set(partialData: Partial<AppStateData>): void {
  const oldState = { ...this.data };
  this.data = { ...this.data, ...partialData };
  this.notify(oldState);
}
```

**Immediate benefit:** Calling `state.set({ invalidKey: 123 })` becomes a compile error.

---

### 5.2 `core/ai.ts` — Effort: Medium (5h)

Typed `embeddingCache` map. Typed worker message dispatch. Typed `ort.Tensor`.

```typescript
// Before
this.embeddingCache = new Map();

// After
private embeddingCache = new Map<string, EmbeddingCacheEntry>();
private pendingDetections = new Map<string, (result: BoundingBox[]) => void>();
```

**Key change:** Import `ort` from `onnxruntime-web` directly instead of reading `globalThis.ort` from a CDN `<script>` tag. This removes the split-version risk (main thread vs. worker using different ORT versions).

---

### 5.3 `core/ai.worker.ts` — Effort: Medium-High (6h)

The biggest architectural change. Replace `importScripts()` (CDN, incompatible with ES Module workers) with a standard `import`. Vite bundles worker files automatically.

```typescript
// Before (Classic Worker — CDN import)
importScripts('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.25.1/dist/ort.min.js');

// After (ES Module Worker — bundled by Vite)
import * as ort from 'onnxruntime-web';

// Typed discriminated union narrows payload automatically per type
self.onmessage = async (event: MessageEvent<WorkerInboundMessage>): Promise<void> => {
  const msg = event.data;
  if (msg.type === 'encode') {
    // TypeScript knows: msg.payload = { imageData, width, height, cacheKey }
  }
};
```

**Benefit:** No more silent failures from message type typos. Discriminated unions enforce protocol at compile time.

---

### 5.4 `core/sam_utils.ts` — Effort: Low (3h)

Typed constructor params. Typed return arrays. `Float32Array` operations are already typed by the DOM lib.

```typescript
export class ResizeLongestSide {
  constructor(private readonly targetLength: number) {}

  applyCoords(coords: [number, number][], originalSize: [number, number]): [number, number][] { ... }
  applyBoxes(boxes: [number, number, number, number][], originalSize: [number, number]): [number, number, number, number][] { ... }
}
```

---

### 5.5 `engine/canvas.ts` — Effort: High (10h)

793 lines — the most complex module. TypeScript surfaces two classes of latent bugs:

**Null safety on DOM elements:**

```typescript
// Before — no null check enforced
this.canvas = document.getElementById(canvasId);

// After — TypeScript forces defensive check
const el = document.getElementById(canvasId);
if (!(el instanceof HTMLCanvasElement)) throw new Error(`Canvas #${canvasId} not found`);
this.canvas = el;
```

**Typed interaction state (discriminated union):**

```typescript
// Before — implicit shape, accessing non-existent properties silently
this.interaction = { type: 'resize', handle: hit.handle, ... }

// After — TypeScript narrows this.interaction.handle only in resize branch
private interaction: CanvasInteraction | null = null;
```

---

### 5.6 `utils/yolo.ts` — Effort: Low (2h)

Pure utility object — all functions take and return well-defined primitives:

```typescript
export const YoloHelper = {
  toYolo(box: BoundingBox, imgWidth: number, imgHeight: number): string { ... },
  fromYolo(line: string, imgWidth: number, imgHeight: number): BoundingBox | null { ... },
  parseClasses(content: string): AnnotationClass[] { ... },
  generateColor(id: number): string { ... },
  withAlpha(color: string, alpha?: number): string { ... },
  getContrastColor(hex: string): string { ... },
};
```

---

### 5.7 `main.ts` — Effort: High (12h)

1,577 lines. Key improvements:

```typescript
// Typed DOM references
private dom: {
  btnOpen: HTMLButtonElement;
  btnDraw: HTMLButtonElement | null;
  modal: AppModal;           // Custom Element type — full IDE support
  imageList: HTMLDivElement;
};

// Type-safe image cache
private imageCache = new Map<number, {
  bitmap: ImageBitmap;
  detAnnos?: BoundingBox[];
  segAnnos?: BoundingBox[];
}>();
```

The `initStateListeners()` callback benefits from typed `data: AppStateData` and `oldData: AppStateData`, providing full autocomplete on all state fields.

---

### 5.8 `components/*.ts` — Effort: Low (4h)

Web Components extend `HTMLElement`. TypeScript's DOM lib fully supports this. Adding a type declaration to the global element registry enables type-safe `querySelector`:

```typescript
// After this declaration:
declare global {
  interface HTMLElementTagNameMap {
    'st-modal': AppModal;
    'st-tool-button': ToolButton;
  }
}

// document.querySelector returns AppModal | null instead of Element | null
const modal = document.querySelector('st-modal');
```

---

### 5.9 Test Files (`*.test.ts`) — Effort: Low (3h)

Vitest supports TypeScript natively with zero configuration. Typed mocks improve test correctness:

```typescript
// Before — untyped mock object
const mockOrt = { InferenceSession: { create: vi.fn() } };

// After — typed mock satisfies the ort module interface
const mockOrt: typeof ort = {
  InferenceSession: { create: vi.fn<typeof ort.InferenceSession.create>() },
  Tensor: class MockTensor { ... },
  env: { wasm: { wasmPaths: '' } },
};
```

---

## 6. Migration Strategy

### Recommended Approach: Incremental (File-by-File)

TypeScript supports mixing `.js` and `.ts` files via `allowJs: true`. This means migration can be done **one file at a time** without ever breaking the running application.

```
Phase 1       Phase 2        Phase 3       Phase 4         Phase 5
Foundation → Core/Utils  → AI Engine  → Engine/UI     → Main + Cleanup
(Week 1)     (Week 2)      (Week 3)      (Week 4)         (Week 5)
```

### Phase 1: Foundation (Week 1) — Zero risk

1. Install `typescript`, `typescript-eslint`
2. Create `tsconfig.json` with `allowJs: true`, `checkJs: false` initially
3. Create `src/core/types.ts` with all domain interfaces
4. Rename config files: `vite.config.js` → `vite.config.ts`, `vitest.config.js` → `vitest.config.ts`
5. **Verify:** `pnpm dev` and all tests pass unchanged

### Phase 2: Core Modules (Week 2) — Low risk

Convert leaf modules first (no dependents that need to change):

1. `js/utils/yolo.js` → `src/utils/yolo.ts`
2. `js/core/sam_utils.js` → `src/core/sam_utils.ts`
3. `js/core/state.js` → `src/core/state.ts`
4. `js/tests/setup.js` → `src/tests/setup.ts` + all `*.test.ts`
5. **Verify:** All unit tests pass, `tsc --noEmit` clean

### Phase 3: AI Engine (Week 3) — Medium risk

1. `js/core/ai.worker.js` → `src/core/ai.worker.ts` (switch `importScripts` → ESM import)
2. `js/core/ai.js` → `src/core/ai.ts` (typed cache maps, typed worker messages)
3. Update `vite.config.ts` if needed for ES Module worker
4. **Verify:** AI inference works in browser — `ai.detect()`, SAM encoding

### Phase 4: Engine & Components (Week 4) — Medium risk

1. `js/components/*.js` → `src/components/*.ts`
2. `js/engine/canvas.js` → `src/engine/canvas.ts`
3. **Verify:** Canvas interactions — draw, select, resize, magic mode

### Phase 5: Main Orchestrator (Week 5) — High complexity

1. `js/main.js` → `src/main.ts`
2. Update `index.html` script entry point
3. Remove `allowJs: true` from `tsconfig.json`
4. Enable strict ESLint: `typescript-eslint/recommended-type-checked`
5. **Verify:** Full end-to-end — open folder, annotate, save, auto-label

---

## 7. Effort Estimation

| Module                      | Est. Hours    | Risk               |
| --------------------------- | ------------- | ------------------ |
| `types.ts` (new)            | 4h            | None               |
| `tsconfig.json` + toolchain | 2h            | None               |
| `yolo.ts`                   | 2h            | Low                |
| `sam_utils.ts`              | 3h            | Low                |
| `state.ts`                  | 3h            | Low                |
| `ai.worker.ts`              | 6h            | Medium             |
| `ai.ts`                     | 5h            | Medium             |
| `components/*.ts`           | 4h            | Low                |
| `canvas.ts`                 | 10h           | Medium             |
| `main.ts`                   | 12h           | Medium             |
| Test file updates           | 3h            | Low                |
| ESLint config update        | 1h            | Low                |
| CI pipeline update          | 1h            | Low                |
| **Total**                   | **~56 hours** | **Medium overall** |

A single experienced developer can complete this in **~2 sprint weeks** (4–5 focused hours/day).

---

## 8. Risk Assessment

| Risk                                                      | Likelihood | Impact | Mitigation                                                              |
| --------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------- |
| `importScripts` → ESM worker breaks ORT loading           | Medium     | High   | Test Phase 3 isolated; Vite worker bundling is well-documented          |
| CDN `ort` script conflicts with bundled `onnxruntime-web` | Medium     | High   | Remove CDN `<script>` tag; use `import * as ort from 'onnxruntime-web'` |
| `strict: true` reveals null-dereference bugs in `main.ts` | High       | Medium | These are real latent bugs — fixing them is a **benefit**, not a cost   |
| `noUncheckedIndexedAccess` breaks array lookups           | High       | Low    | Add explicit `?.` or null checks where array access could be undefined  |
| TypeScript compile time slows CI                          | Low        | Low    | `tsc --noEmit` on ~4,200 lines completes in under 3 seconds             |

### Benefits Summary

| Benefit                                                        | Impact   |
| -------------------------------------------------------------- | -------- |
| Catches type errors at build time vs. runtime                  | Critical |
| Shared Worker message contract eliminates silent protocol bugs | Critical |
| Full IDE autocomplete on `state.data.*`, `box.*`               | High     |
| Refactoring safety — rename a field, compiler finds all usages | High     |
| Self-documenting interfaces replace JSDoc comments             | Medium   |
| Stricter ESLint rules enabled (TS replaces disabled JS rules)  | Medium   |
| Better Vitest mock typing                                      | Medium   |

---

## 9. Comparison with Existing Feasibility Studies

| Migration                         | Effort | Risk       | Benefit                                |
| --------------------------------- | ------ | ---------- | -------------------------------------- |
| **JS → TypeScript** (this study)  | ~56h   | Low–Medium | High — developer velocity, correctness |
| JS → Rust/WASM (existing study)   | 200h+  | Very High  | Very High — raw performance            |
| C4 Documentation (existing study) | 20h    | None       | Medium — onboarding docs               |

TypeScript is the **highest ROI investment** available — it costs the least and provides the most day-to-day benefit for a solo developer or small team.

---

## 10. Recommendation

### ✅ PROCEED — Incremental Migration

**Start with Phase 1 immediately** (types + toolchain): zero runtime risk, immediate development benefit from IDE intelligence.

**Prioritize Phase 3** (AI worker migration): switching from CDN `importScripts` to Vite-bundled ESM worker is the most architecturally significant improvement — it pins the ORT version, enables proper typing of the entire inference pipeline, and eliminates the split-version risk between the main thread and worker.

**Do not attempt a big-bang rewrite** of `main.ts` first — it depends on all other modules. Follow the dependency order: types → utils → core → engine → main.

### Suggested CI/CD Updates

```yaml
# .github/workflows/ci.yml — add typecheck step
- name: Type Check
  run: pnpm typecheck
```

```json
// package.json — add typecheck scripts
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "typecheck:watch": "tsc --noEmit --watch",
    "lint": "eslint . && tsc --noEmit"
  }
}
```

---

_Study authored after full codebase review of all 13 source files, test infrastructure, CI pipeline, Vite/Vitest configuration, and cross-referencing with the existing Rust/WASM and C4 feasibility documents._
