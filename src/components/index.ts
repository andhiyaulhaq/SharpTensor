import { AppModal } from './AppModal';
import { ToolButton } from './ToolButton';
import { SidebarSection } from './SidebarSection';

export * from './AppModal';
export * from './ToolButton';
export * from './SidebarSection';

declare global {
  interface HTMLElementTagNameMap {
    'st-modal': AppModal;
    'st-tool-button': ToolButton;
    'st-sidebar-section': SidebarSection;
  }
}
