import { state } from '../../core/state';
import { ClassDefinition } from '../../core/types';
import { YoloHelper } from '../../utils/yolo';

export interface ClassListManagerConfig {
  container: HTMLElement;
  onSaveClasses: (classes: ClassDefinition[]) => void;
  onDeleteClass: (id: number) => void;
}

export class ClassListManager {
  private config: ClassListManagerConfig;

  constructor(config: ClassListManagerConfig) {
    this.config = config;
  }

  render(classes: ClassDefinition[], selectedId: number | null): void {
    this.config.container.innerHTML = classes
      .map((cls) => {
        const isSelected = cls.id === selectedId;
        const contrastColor = YoloHelper.getContrastColor(cls.color);

        const itemClasses = `class-item group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all border ${isSelected ? 'shadow-sm' : 'border-transparent text-(--text-secondary) hover:bg-(--bg-hover)'}`;
        const itemStyle = isSelected
          ? `background-color: ${cls.color}; color: ${contrastColor}; border-color: rgba(255,255,255,0.2);`
          : '';

        return `
                <div class="${itemClasses}" style="${itemStyle}" data-id="${cls.id}">
                    <span class="w-3.5 h-3.5 rounded-md shadow-sm shrink-0" style="background-color: ${isSelected ? contrastColor : cls.color}"></span>
                    <span class="class-name flex-1 font-semibold text-[0.85rem] truncate" title="Double-click to rename">${cls.name}</span>
                    <span class="text-[0.7rem] px-1.5 py-0.5 rounded border border-white/10 font-mono" style="background: rgba(0,0,0,0.2); color: inherit;">${cls.id}</span>
                    <button class="btn-delete-class opacity-0 group-hover:opacity-100 hover:scale-125 transition-all text-[1.2rem] leading-none px-1" style="color: inherit;" title="Delete Class">&times;</button>
                </div>
            `;
      })
      .join('');

    this.config.container.querySelectorAll('.class-item').forEach((item) => {
      const element = item as HTMLElement;
      const nameSpan = element.querySelector('.class-name') as HTMLElement;
      const deleteBtn = element.querySelector('.btn-delete-class') as HTMLElement;
      const id = parseInt(element.dataset.id || '0');

      element.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && !target.classList.contains('btn-delete-class')) {
          if (state.data.selectedBoxId !== null) {
            this.reassignSelectedBox(id);
          } else {
            state.set({ selectedClassId: id });
          }
        }
      });

      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.config.onDeleteClass(id);
      });

      nameSpan.addEventListener('dblclick', () => {
        const input = document.createElement('input');
        input.value = nameSpan.textContent || '';
        input.className =
          'w-full bg-(--bg-main) text-(--text-primary) border border-(--accent) rounded px-2 py-0.5 text-[0.85rem] outline-none';
        nameSpan.replaceWith(input);
        input.focus();

        const finishRename = () => {
          const newName = input.value.trim() || nameSpan.textContent || '';
          const newClasses = state.data.classes.map((c) =>
            c.id === id ? { ...c, name: newName } : c
          );
          state.set({ classes: newClasses });
          this.config.onSaveClasses(newClasses);
        };

        input.addEventListener('blur', finishRename);
        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') finishRename();
        });
      });
    });
  }

  assignClassToSelected(classIndex: number): void {
    const cls = state.data.classes[classIndex];
    if (cls && state.data.selectedBoxId !== null) {
      this.reassignSelectedBox(cls.id);
    } else if (cls) {
      state.set({ selectedClassId: cls.id });
    }
  }

  private reassignSelectedBox(newClassId: number): void {
    const { selectedBoxId, annotations } = state.data;
    const newAnnotations = annotations.map((box) =>
      box.id === selectedBoxId ? { ...box, classId: newClassId } : box
    );
    state.set({ annotations: newAnnotations });
    this.config.onSaveClasses(state.data.classes);
  }
}
