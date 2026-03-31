/**
 * AgentCard — Displays a single agent in the grid view
 */
import { MoreVertical, Star, Pencil, Trash2, Shield } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Agent } from '@/types/agent';
import { useTranslation } from 'react-i18next';

interface AgentCardProps {
  agent: Agent;
  onEdit: (agent: Agent) => void;
  onDelete: (agent: Agent) => void;
  onSetDefault: (agent: Agent) => void;
}

export function AgentCard({ agent, onEdit, onDelete, onSetDefault }: AgentCardProps) {
  const { t } = useTranslation('agents');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const statusColor = agent.status === 'active'
    ? 'bg-green-500'
    : agent.status === 'error'
      ? 'bg-red-500'
      : 'bg-gray-400';

  return (
    <Card
      className="relative group cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/30"
      onClick={() => onEdit(agent)}
    >
      <div className="p-4">
        {/* Header: emoji + name + menu */}
        <div className="flex items-start gap-3">
          <div className="text-3xl shrink-0 select-none">{agent.emoji || '🤖'}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm truncate">{agent.display_name}</h3>
              <span className={cn('h-2 w-2 rounded-full shrink-0', statusColor)} />
            </div>
            {agent.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {agent.description}
              </p>
            )}
          </div>

          {/* Menu button */}
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="p-1 rounded-md hover:bg-accent transition-colors opacity-0 group-hover:opacity-100"
            >
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-8 z-50 min-w-[160px] rounded-md border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95">
                <button
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onSetDefault(agent);
                  }}
                >
                  <Star className="h-3.5 w-3.5" />
                  {t('card.setDefault')}
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onEdit(agent);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {t('card.edit')}
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onDelete(agent);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t('card.delete')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          {agent.is_default && (
            <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800">
              <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />
              {t('card.default')}
            </Badge>
          )}
          <Badge variant="secondary" className="text-[10px]">
            <Shield className="h-2.5 w-2.5 mr-0.5" />
            {agent.agent_type === 'predefined' ? t('card.predefined') : t('card.open')}
          </Badge>
          {agent.model ? (
            <Badge variant="outline" className="text-[10px] font-mono">
              {agent.model}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              {t('card.noModel')}
            </Badge>
          )}
          {agent.context_window && (
            <Badge variant="outline" className="text-[10px]">
              {agent.context_window >= 1000
                ? `${Math.round(agent.context_window / 1024)}K`
                : agent.context_window}
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}
