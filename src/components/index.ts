import { AppModal } from './AppModal';
import { ToolButton } from './ToolButton';
import { SidebarSection } from './SidebarSection';
import { BYOMPanel } from './BYOMPanel';
import { AppHeader } from './AppHeader';
import { WelcomeModal } from './WelcomeModal';

export * from './AppModal';
export * from './ToolButton';
export * from './SidebarSection';
export * from './BYOMPanel';
export * from './AppHeader';
export * from './WelcomeModal';

declare global {
  interface HTMLElementTagNameMap {
    'st-modal': AppModal;
    'st-tool-button': ToolButton;
    'st-sidebar-section': SidebarSection;
    'st-byom-panel': BYOMPanel;
    'st-app-header': AppHeader;
    'st-welcome-modal': WelcomeModal;
  }
}
