// Annotation Types
export interface BoundingBox {
  id: number;
  classId: number;
  x: number;
  y: number;
  width: number;
  height: number;
  score?: number | undefined;
  polygon?: [number, number][] | undefined;
}

export interface AnnotationClass {
  id: number;
  name: string;
  color: string;
}

// State Types
export type TaskMode = 'detection' | 'segmentation';
export type InteractionMode = 'select' | 'draw' | 'magic' | 'polygon';
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
  activeMask: number[] | Uint8Array | null;
  activePolygon: [number, number][] | null;
  promptPoints: PromptPoint[];
  activePromptBox: [number, number, number, number] | null;
  samLatency: { encoder: number; decoder: number };
  statusMessage?: string | null;
  tourActive: boolean;
  tourStep: 'idle' | 'step1-autolabel' | 'step2-interact' | 'complete';
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
      payload: {
        embeddings: Uint16Array | Float32Array;
        dims: number[];
        cacheKey: string;
        latency: number;
      };
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
  | { type: 'magic'; startImgPos: Point; button: number; isDrag: boolean; currentImgPos?: Point }
  | { type: 'move_vertex'; boxId: number; vertexIndex: number; startImgPos: Point; startPolygon: [number, number][] };

// Embedding Cache
export interface EmbeddingCacheEntry {
  width: number;
  height: number;
  embeddings?: any;
}

export type ClassDefinition = AnnotationClass;

export interface ImageCacheEntry {
  bitmap: ImageBitmap;
  detAnnos?: BoundingBox[];
  segAnnos?: BoundingBox[];
}
