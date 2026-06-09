# ADR 004: Decoupled Canvas Interaction Engine

## Status
**Accepted**

## Context
Image annotation tools require complex spatial mathematics. Users must be able to pan, zoom, draw bounding boxes, resize them via corner handles, draw complex polygons, and manipulate individual polygon edges and vertices.

Initially, simple interactions were handled directly inside the native DOM `mousemove` and `mousedown` event listeners attached to the `<canvas>` element. The listener would calculate the math, mutate the object directly, and immediately force the canvas `CanvasRenderingContext2D` to redraw. 

As the application scaled to support semantic instance segmentation (polygons), the canvas math became incredibly complex. Placing input capture, geometric hit-testing, state mutation, and visual rendering logic all inside the same monolithic event handlers created spaghetti code that was impossible to maintain, test, or extend.

## Decision
We implemented a strict **Decoupled Engine Architecture** inspired by modern game engine design patterns.

The canvas system is split into three strictly separated domains:

1. **`InteractionManager` (The Controller):**
   - Binds to the DOM mouse/keyboard events.
   - Translates screen coordinates to abstract image coordinates using the current zoom/pan state.
   - Dispatches mutations to the global Zustand state store (e.g., `set({ annotations: newArray, activeHandle: 'vertex_2' })`).
   - Does *not* draw anything to the screen.

2. **`HitTester` (The Physics Engine):**
   - A stateless utility class invoked by the `InteractionManager`.
   - Uses optimized geometric math (like `distanceToLineSegment`) to determine if a mouse coordinate intersects with a bounding box, a resize handle, a polygon vertex, or a polygon edge.
   - Returns a semantic target ID (e.g., `{ boxId: 12, handle: 'edge_4' }`).

3. **`Renderer` (The View):**
   - A passive class that subscribes to the Zustand state.
   - Whenever the state changes (e.g., `activeHandle` changes, or a coordinate updates), the Renderer clears the canvas and completely redraws the entire frame based purely on the current state snapshot.
   - Does *not* handle any math or input logic. It simply visually represents the data it is given.

## Consequences

### Positive
- **High Maintainability:** Adding a new interaction (like double-clicking a polygon edge to inject a new node) requires localized changes to the `InteractionManager` and `HitTester`, without touching the visual drawing code at all.
- **Predictable Visuals:** The `Renderer` can easily implement complex UI states (like highlighting an edge pure white when `state.hoveredHandle === 'edge_2'`) because the state is deterministic.
- **State Serialization:** Because the canvas visuals are a pure function of the Zustand state, implementing features like "Undo/Redo" is trivial; we just revert the Zustand state, and the `Renderer` automatically redraws the past frame flawlessly.

### Negative / Risks
- **Redraw Overhead:** The imperative approach completely clears and redraws every box, polygon, and label on every single mouse movement. While perfectly fine for ~100 annotations (sub-millisecond execution times), this brute-force redrawing could become a performance bottleneck if an image has 10,000+ complex polygon nodes. We may eventually need to implement layered canvas buffering.
