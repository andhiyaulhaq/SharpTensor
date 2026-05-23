import { state } from '../../core/state';
import { BoundingBox } from '../../core/types';

export class AnnotationListManager {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  render(annotations: BoundingBox[], selectedId: number | null): void {
    const { classes } = state.data;
    if (annotations.length === 0) {
      this.container.innerHTML = '<div class="empty-state-small">No annotations yet</div>';
      return;
    }
    this.container.innerHTML = annotations
      .map((box) => {
        const currentCls = classes.find((c) => c.id === box.classId);
        return `
                <div class="anno-item group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all border ${box.id === selectedId ? 'bg-(--bg-card) border-(--border) text-(--text-primary) shadow-sm' : 'border-transparent text-(--text-secondary) hover:bg-(--bg-hover)'}" data-id="${box.id}">
                    <span class="w-3.5 h-3.5 rounded-md shadow-sm shrink-0" style="background-color: ${currentCls?.color || '#ffffff'}"></span>
                    <select class="anno-class-select flex-1 bg-transparent border-none text-(--text-primary) text-[0.85rem] outline-none cursor-pointer p-1 rounded hover:bg-(--bg-main) hover:ring-1 hover:ring-(--border)" data-box-id="${box.id}">
                        ${classes.map((cls) => `<option value="${cls.id}" ${cls.id === box.classId ? 'selected' : ''}>${cls.name}</option>`).join('')}
                        ${!currentCls ? '<option value="-1" selected disabled>Pending...</option>' : ''}
                    </select>
                    <span class="text-[0.7rem] bg-(--bg-main) px-1.5 py-0.5 rounded text-(--text-muted) font-mono">${Math.round(box.x)}, ${Math.round(box.y)}</span>
                </div>
            `;
      })
      .join('');

    this.container.querySelectorAll('.anno-item').forEach((item) => {
      const element = item as HTMLElement;
      const boxId = parseInt(element.dataset.id || '0');
      
      element.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'SELECT') state.set({ selectedBoxId: boxId });
      });
      
      const select = element.querySelector('.anno-class-select') as HTMLSelectElement;
      select.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const newClassId = parseInt(target.value);
        const newAnnotations = state.data.annotations.map((b) =>
          b.id === boxId ? { ...b, classId: newClassId } : b
        );
        state.set({ annotations: newAnnotations });
      });
    });
  }

  updateSelection(selectedId: number | null): void {
    this.container.querySelectorAll('.anno-item').forEach((item) => {
      const element = item as HTMLElement;
      const isActive = parseInt(element.dataset.id || '0') === selectedId;
      element.classList.toggle('bg-(--bg-card)', isActive);
      element.classList.toggle('border-(--border)', isActive);
      element.classList.toggle('text-(--text-primary)', isActive);
      element.classList.toggle('shadow-sm', isActive);
    });
  }
}
