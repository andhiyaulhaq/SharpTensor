# ADR 001: Adopting Zustand + Immer for Immutable State Management

## Status
**Proposed**

## Context
SharpTensor currently relies on a custom `AppState` class (`src/core/state.ts`) acting as a global singleton utilizing the Observer pattern. The state holds a monolithic `AppStateData` object containing over 30 properties representing UI state, AI inference status, canvas interactions, and FileSystem handles. 

Side effects (such as background saving, cache synchronization, and UI rendering) are orchestrated within a large `state.subscribe` block in `main.ts`. Undo/Redo functionality is achieved by deep-cloning (JSON stringifying) the entire `annotations` array on every change.

As the project scales in complexity (handling hundreds of complex polygons and rapid task switching), several architectural pain points have emerged:
1. **Race Conditions & Stale Closures**: Background asynchronous operations (like `debouncedSave`) occasionally capture stale references to `state.data`, leading to unintended data deletion when switching tasks rapidly.
2. **Monolithic Orchestration**: The centralized `subscribe` block evaluating `if (data.X !== oldData.X)` has become a "god function," making debugging and tracing side-effects extremely difficult.
3. **Mutation Vulnerabilities**: The lack of strict runtime immutability allows developers to accidentally mutate arrays directly (e.g., `state.data.annotations.push()`), bypassing necessary observers and saves.
4. **"Spread Operator Hell"**: Managing deep nested structures (like modifying a specific node's coordinate within a specific polygon) requires highly verbose and error-prone spread operators to satisfy immutability conceptually.
5. **Inefficient History Tracking**: JSON-stringifying large segmentation polygon arrays for every interaction consumes significant memory and processing time.

## Decision
We will migrate the application's core state management from the custom Observer pattern to **Zustand** paired with the **Immer.js** middleware.

- **Zustand (`zustand/vanilla`)**: A highly scalable, unopinionated, and lightweight state-management library that works flawlessly in Vanilla TypeScript environments (no React required).
- **Immer (`zustand/middleware/immer`)**: A library that allows developers to write code that "mutates" state directly (using Proxies) while outputting perfectly immutable data structures through structural sharing.

## Consequences

### Positive
- **Guaranteed Immutability**: Immer strictly enforces immutability at runtime. Mutations are safely captured, preventing accidental state leakage.
- **Simplified Developer Experience**: Developers can interact with complex, deeply nested objects intuitively without relying on massive, unreadable chains of spread (`...`) operators.
```typescript
// Zustand + Immer approach
updatePolygonNode: (boxId, nodeIdx, x, y) => set((state) => {
    const box = state.annotations.find(b => b.id === boxId);
    if (box && box.polygon) box.polygon[nodeIdx] = [x, y]; 
})
```
- **Decoupled Side Effects**: We can eliminate the monolithic `state.subscribe` in `main.ts`. Actions (like `confirmPolygon`) will directly encapsulate their state changes and trigger their intended side effects (like initiating a save) synchronously.
- **Race Condition Mitigation**: Background async operations will reference the deterministic, immutable state snapshot retrieved via `get()`, completely eliminating stale closure bugs.
- **Memory Efficiency**: Immer's structural sharing enables the future integration of libraries like `zundo`, which only store the "deltas" (diffs) of the state for Undo/Redo, reducing memory overhead by up to 90%.

### Negative / Risks
- **Refactoring Effort**: Every existing call to `state.data.X` and `state.set()` across the codebase (UI Managers, Renderers, AI pipelines) will need to be refactored to interface with `store.getState()` and dedicated Action dispatchers.
- **Dependency Overhead**: Adds two new third-party dependencies (`zustand` and `immer`) to the otherwise dependency-light Vanilla Vite project. However, both libraries are exceptionally small and highly tree-shakeable.

## Implementation Strategy

### Phase 1: Store Setup
Define the initial Zustand store in `src/core/store.ts` wrapped in the Immer middleware, porting over all properties from `AppStateData`.

### Phase 2: Action Creators & Side Effects
Draft specific Action methods attached to the store (e.g., `loadAnnotations`, `switchTask`, `updateBoundingBox`). Move the orchestrating logic out of `main.ts`'s `subscribe` block and into these explicit actions.

### Phase 3: Component Migration
Systematically update the UI, FileSystem, and Workspace managers to pull state via `store.getState()` and invoke actions instead of calling `state.set()`.

### Phase 4: History Upgrade
Replace the custom JSON-stringify Undo/Redo logic with a delta-based tracking middleware (such as `zundo`) attached to the Zustand store.
