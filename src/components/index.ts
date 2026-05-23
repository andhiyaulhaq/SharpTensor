import { AppModal } from './AppModal';
import { ToolButton } from './ToolButton';
import { SidebarSection } from './SidebarSection';
import { BYOMPanel } from './BYOMPanel';
import { AppHeader } from './AppHeader';
import { WelcomeModal } from './WelcomeModal';
import { HotkeysGuide } from './HotkeysGuide';
import { RightSidebar } from './RightSidebar';

export * from './AppModal';
export * from './ToolButton';
export * from './SidebarSection';
export * from './BYOMPanel';
export * from './AppHeader';
export * from './WelcomeModal';
export * from './HotkeysGuide';
export * from './RightSidebar';

declare global {
  interface HTMLElementTagNameMap {
    'st-modal': AppModal;
    'st-tool-button': ToolButton;
    'st-sidebar-section': SidebarSection;
    'st-byom-panel': BYOMPanel;
    'st-app-header': AppHeader;
    'st-welcome-modal': WelcomeModal;
    'st-hotkeys-guide': HotkeysGuide;
    'st-right-sidebar': RightSidebar;
  }
}
