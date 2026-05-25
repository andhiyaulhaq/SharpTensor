import { BoundingBox, AnnotationClass } from '../core/types';

export type ExportFormat = 'yolo' | 'coco' | 'voc' | 'csv';

export interface ExportImageInfo {
  name: string;
  width: number;
  height: number;
}

export interface ExportPayload {
  annotations: BoundingBox[];
  classes: AnnotationClass[];
  image: ExportImageInfo;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function exportYOLO(payload: ExportPayload): string {
  const { annotations, image } = payload;
  return annotations
    .map((box) => {
      if (box.polygon) {
        const coords = box.polygon
          .map(([x, y]) => `${(x / image.width).toFixed(6)} ${(y / image.height).toFixed(6)}`)
          .join(' ');
        return `${box.classId} ${coords}`;
      }
      const xCenter = ((box.x + box.width / 2) / image.width).toFixed(6);
      const yCenter = ((box.y + box.height / 2) / image.height).toFixed(6);
      const w = (box.width / image.width).toFixed(6);
      const h = (box.height / image.height).toFixed(6);
      return `${box.classId} ${xCenter} ${yCenter} ${w} ${h}`;
    })
    .join('\n');
}

export function exportCOCO(perImagePayloads: ExportPayload[]): string {
  const images: {
    id: number;
    file_name: string;
    width: number;
    height: number;
  }[] = [];
  const annotations: {
    id: number;
    image_id: number;
    category_id: number;
    bbox: [number, number, number, number];
    area: number;
    iscrowd: number;
    segmentation?: number[][];
  }[] = [];
  const categories: {
    id: number;
    name: string;
    supercategory: string;
  }[] = [];

  const seenCategories = new Map<number, boolean>();
  let annId = 1;

  for (const payload of perImagePayloads) {
    const imageId = images.length + 1;
    images.push({
      id: imageId,
      file_name: payload.image.name,
      width: payload.image.width,
      height: payload.image.height,
    });

    for (const box of payload.annotations) {
      if (!seenCategories.has(box.classId)) {
        const cls = payload.classes.find((c) => c.id === box.classId);
        categories.push({
          id: box.classId,
          name: cls ? cls.name : `class_${box.classId}`,
          supercategory: 'object',
        });
        seenCategories.set(box.classId, true);
      }

      const entry: (typeof annotations)[number] = {
        id: annId++,
        image_id: imageId,
        category_id: box.classId,
        bbox: [box.x, box.y, box.width, box.height],
        area: box.width * box.height,
        iscrowd: 0,
      };

      if (box.polygon) {
        entry.segmentation = [box.polygon.flatMap(([x, y]) => [x, y])];
      }

      annotations.push(entry);
    }
  }

  return JSON.stringify({ images, annotations, categories }, null, 2);
}

export function exportVOC(payload: ExportPayload): string {
  const { annotations, classes, image } = payload;

  const objectsXml = annotations
    .map((box) => {
      const cls = classes.find((c) => c.id === box.classId);
      const name = cls ? escapeXml(cls.name) : `class_${box.classId}`;
      const xmin = Math.round(box.x);
      const ymin = Math.round(box.y);
      const xmax = Math.round(box.x + box.width);
      const ymax = Math.round(box.y + box.height);
      return `
  <object>
    <name>${name}</name>
    <pose>Unspecified</pose>
    <truncated>0</truncated>
    <difficult>0</difficult>
    <bndbox>
      <xmin>${xmin}</xmin>
      <ymin>${ymin}</ymin>
      <xmax>${xmax}</xmax>
      <ymax>${ymax}</ymax>
    </bndbox>
  </object>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<annotation>
  <folder>exported</folder>
  <filename>${escapeXml(image.name)}</filename>
  <source>
    <database>SharpTensor</database>
  </source>
  <size>
    <width>${image.width}</width>
    <height>${image.height}</height>
    <depth>3</depth>
  </size>
  <segmented>0</segmented>${objectsXml}
</annotation>`;
}

export function exportCSV(perImagePayloads: ExportPayload[]): string {
  const header = 'image,class_id,class_name,x_center,y_center,width,height';

  const rows = perImagePayloads.flatMap((payload) => {
    const { annotations, classes, image } = payload;
    return annotations.map((box) => {
      const cls = classes.find((c) => c.id === box.classId);
      const className = cls ? cls.name : `class_${box.classId}`;
      const xCenter = ((box.x + box.width / 2) / image.width).toFixed(6);
      const yCenter = ((box.y + box.height / 2) / image.height).toFixed(6);
      const w = (box.width / image.width).toFixed(6);
      const h = (box.height / image.height).toFixed(6);
      return `${image.name},${box.classId},${className},${xCenter},${yCenter},${w},${h}`;
    });
  });

  return [header, ...rows].join('\n');
}
