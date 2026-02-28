/**
 * BottomNav - Mobile bottom navigation bar
 * Only visible on screens < md (768px), hidden on desktop.
 */
import { NavLink } from 'react-router-dom';
import { MessageSquare, Radio, Puzzle, Clock, Home, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface BottomNavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
}

function BottomNavItem({ to, icon, label }: BottomNavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[9px] font-medium transition-colors overflow-hidden',
          isActive ? 'text-primary' : 'text-muted-foreground',
        )
      }
    >
      <span className="h-5 w-5 shrink-0">{icon}</span>
      <span className="leading-none truncate w-full text-center px-0.5">{label}</span>
    </NavLink>
  );
}

export function BottomNav() {
  const { t } = useTranslation();

  const items = [
    { to: '/', icon: <MessageSquare className="h-5 w-5" />, label: t('sidebar.chat') },
    { to: '/cron', icon: <Clock className="h-5 w-5" />, label: t('sidebar.cronTasks') },
    { to: '/skills', icon: <Puzzle className="h-5 w-5" />, label: t('sidebar.skills') },
    { to: '/channels', icon: <Radio className="h-5 w-5" />, label: t('sidebar.channels') },
    { to: '/dashboard', icon: <Home className="h-5 w-5" />, label: t('sidebar.dashboard') },
    { to: '/settings', icon: <Settings className="h-5 w-5" />, label: t('sidebar.settings') },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex h-14 items-stretch border-t bg-background">
      {items.map((item) => (
        <BottomNavItem key={item.to} {...item} />
      ))}
    </nav>
  );
}
