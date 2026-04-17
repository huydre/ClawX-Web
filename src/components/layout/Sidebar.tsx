/**
 * Sidebar Component
 * Navigation sidebar with menu items.
 * No longer fixed - sits inside the flex layout below the title bar.
 */
import { NavLink } from 'react-router-dom';
import {
  Home,
  MessageSquare,
  Radio,
  Puzzle,
  Settings,
  ChevronLeft,
  ChevronRight,
  Terminal,
  ExternalLink,
  BookOpen,
  Bot,
  Usb,
  Clock,
  FolderOpen,
  Route,
  Plug,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settings';
import { useUsbStore } from '@/stores/usb';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  collapsed?: boolean;
}

function NavItem({ to, icon, label, badge, collapsed }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          isActive
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground',
          collapsed && 'justify-center px-2'
        )
      }
    >
      {icon}
      {!collapsed && (
        <>
          <span className="flex-1">{label}</span>
          {badge && (
            <Badge variant="secondary" className="ml-auto">
              {badge}
            </Badge>
          )}
        </>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const sidebarCollapsed = useSettingsStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useSettingsStore((state) => state.setSidebarCollapsed);
  const devModeUnlocked = useSettingsStore((state) => state.devModeUnlocked);

  const openDevConsole = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('gateway:getControlUiUrl') as {
        success: boolean;
        url?: string;
        error?: string;
      };
      if (result.success && result.url) {
        window.electron.openExternal(result.url);
      } else {
        console.error('Failed to get Dev Console URL:', result.error);
      }
    } catch (err) {
      console.error('Error opening Dev Console:', err);
    }
  };

  const { t } = useTranslation();
  const usbDeviceCount = useUsbStore((state) => state.devices.length);

  const navItems = [
    { to: '/dashboard', icon: <Home className="h-5 w-5" />, label: t('sidebar.dashboard') },
    { to: '/', icon: <MessageSquare className="h-5 w-5" />, label: t('sidebar.chat') },
    { to: '/agents', icon: <Bot className="h-5 w-5" />, label: t('sidebar.agents') },
    { to: '/cron', icon: <Clock className="h-5 w-5" />, label: t('sidebar.cronTasks') },
    { to: '/skills', icon: <Puzzle className="h-5 w-5" />, label: t('sidebar.skills') },
    { to: '/channels', icon: <Radio className="h-5 w-5" />, label: t('sidebar.channels') },
    { to: '/applications', icon: <Plug className="h-5 w-5" />, label: t('sidebar.applications') },
    ...(usbDeviceCount > 0
      ? [{ to: '/usb', icon: <Usb className="h-5 w-5" />, label: t('sidebar.usb') }]
      : []),
    { to: '/files', icon: <FolderOpen className="h-5 w-5" />, label: t('sidebar.files', 'Files') },
    { to: '/settings', icon: <Settings className="h-5 w-5" />, label: t('sidebar.settings') },
  ];

  return (
    <aside
      className={cn(
        'hidden md:flex shrink-0 flex-col border-r bg-background transition-all duration-300',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-auto p-2">
        {navItems.map((item) => (
          <NavItem
            key={item.to}
            {...item}
            collapsed={sidebarCollapsed}
          />
        ))}
      </nav>

      {/* Footer */}
      <div className="p-2 space-y-1">
        {/* 9Router link */}
        <a
          href={(() => {
            const host = window.location.hostname;
            const isLan = host.match(/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.|localhost|127\.0\.0\.1)/);
            if (isLan) return `http://${host}:20128`;
            return `https://router-${host}`;
          })()}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            sidebarCollapsed && 'justify-center px-2'
          )}
        >
          <Route className="h-5 w-5" />
          {!sidebarCollapsed && (
            <>
              <span className="flex-1">9Router</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground/50" />
            </>
          )}
        </a>

        {/* Docs link */}
        <a
          href="https://docs.openclaw-box.com"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            sidebarCollapsed && 'justify-center px-2'
          )}
        >
          <BookOpen className="h-5 w-5" />
          {!sidebarCollapsed && (
            <>
              <span className="flex-1">{t('sidebar.docs', 'Hướng dẫn')}</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground/50" />
            </>
          )}
        </a>

        {devModeUnlocked && !sidebarCollapsed && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={openDevConsole}
          >
            <Terminal className="h-4 w-4 mr-2" />
            {t('sidebar.devConsole')}
            <ExternalLink className="h-3 w-3 ml-auto" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="w-full"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
    </aside>
  );
}
