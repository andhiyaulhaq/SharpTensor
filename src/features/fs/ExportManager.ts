import { state } from '../../core/state';
import { BoundingBox, AnnotationClass, ImageEntry, ImageCacheEntry } from '../../core/types';
import { FileSystemManager } from './FileSystemManager';
import {
  ExportFormat,
  ExportPayload,
  exportYOLO,
  exportCOCO,
  exportVOC,
  exportCSV,
} from '../../utils/exporters';

export class ExportManager {
  constructor(private fileSystemManager: FileSystemManager) {}

  async collectPayloads(
    images: ImageEntry[],
    classes: AnnotationClass[],
    imageCache: Map<number, ImageCacheEntry>
  ): Promise<ExportPayload[]> {
    const payloads: ExportPayload[] = [];

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (!img) continue;

      let annotations: BoundingBox[] = [];
      let width = 0;
      let height = 0;

      const cached = imageCache.get(i);
      if (cached) {
        const taskAnnos =
          state.data.currentTask === 'detection' ? cached.detAnnos : cached.segAnnos;
        annotations = taskAnnos || [];
        width = cached.bitmap.width;
        height = cached.bitmap.height;
      } else {
        try {
          const file = await (img.handle as any).getFile();
          const bitmap = await createImageBitmap(file);
          width = bitmap.width;
          height = bitmap.height;
          annotations = await this.fileSystemManager.loadAnnotations(img.name, bitmap);
          bitmap.close();
        } catch {
          continue;
        }
      }

      payloads.push({
        annotations,
        classes,
        image: { name: img.name, width, height },
      });
    }

    return payloads;
  }

  async exportAll(
    format: ExportFormat,
    images: ImageEntry[],
    classes: AnnotationClass[],
    imageCache: Map<number, ImageCacheEntry>,
    destHandle: FileSystemDirectoryHandle
  ): Promise<{ imageCount: number; annotationCount: number }> {
    const payloads = await this.collectPayloads(images, classes, imageCache);
    let totalAnnos = 0;
    for (const p of payloads) totalAnnos += p.annotations.length;

    switch (format) {
      case 'yolo': {
        for (const p of payloads) {
          const content = exportYOLO(p);
          const txtName = p.image.name.replace(/\.[^/.]+$/, '') + '.txt';
          await this.writeFile(destHandle, txtName, content);
        }
        if (classes.length > 0) {
          await this.writeFile(destHandle, 'classes.txt', classes.map((c) => c.name).join('\n'));
        }
        break;
      }
      case 'coco': {
        const json = exportCOCO(payloads);
        await this.writeFile(destHandle, 'annotations.json', json);
        break;
      }
      case 'voc': {
        for (const p of payloads) {
          const xml = exportVOC(p);
          const xmlName = p.image.name.replace(/\.[^/.]+$/, '') + '.xml';
          await this.writeFile(destHandle, xmlName, xml);
        }
        break;
      }
      case 'csv': {
        const csv = exportCSV(payloads);
        await this.writeFile(destHandle, 'annotations.csv', csv);
        break;
      }
    }

    return { imageCount: payloads.length, annotationCount: totalAnnos };
  }

  private async writeFile(
    dirHandle: FileSystemDirectoryHandle,
    fileName: string,
    content: string
  ): Promise<void> {
    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }
}
