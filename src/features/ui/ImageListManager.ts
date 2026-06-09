import { useAppStore } from '../../core/store';
import { ImageEntry } from '../../core/types';

export class ImageListManager {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  render(images: ImageEntry[]): void {
    if (images.length === 0) {
      this.container.innerHTML = '<div class="empty-state">No images found</div>';
      return;
    }
    this.container.innerHTML = images
      .map((img, idx) => {
        const isActive = idx === useAppStore.getState().currentImageIndex;
        const itemClasses = isActive
          ? 'bg-(--accent)/10 text-(--accent-light) font-semibold ring-1 ring-(--accent)/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] hover:bg-(--accent)/20'
          : 'text-(--text-muted) hover:bg-(--bg-hover) hover:text-(--text-primary)';

        return `
                <div class="image-item group flex items-center justify-between px-3 py-2 rounded-lg text-[0.8rem] cursor-pointer transition-all gap-2.5 ${itemClasses}" data-index="${idx}">
                    <span class="truncate flex-1">${img.name}</span>
                    ${img.status === 'labeled' ? '<span class="w-1.5 h-1.5 rounded-full bg-(--success) shadow-[0_0_8px_var(--success)]"></span>' : ''}
                </div>
            `;
      })
      .join('');
      
    this.container.querySelectorAll('.image-item').forEach((item) => {
      item.addEventListener('click', () => {
        const element = item as HTMLElement;
        const index = parseInt(element.dataset.index || '0');
        useAppStore.getState().set({ currentImageIndex: index });
      });
    });
  }
}
