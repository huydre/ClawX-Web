/**
 * AgentCard — Displays a single agent in the grid view
 */
import { MoreVertical, Pencil, Trash2, Star, MessageSquare } from 'lucide-react';
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
  onChat: (agent: Agent) => void;
}

export function AgentCard({ agent, onEdit, onDelete, onChat }: AgentCardProps) {
  const { t } = useTranslation('agents');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const emoji = agent.identity?.emoji || '🤖';
  const displayName = agent.identity?.name || agent.name || agent.id;

  return (
    <Card
      className="relative group cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/30"
      onClick={() => onEdit(agent)}
    >
      <div className="p-4">
        {/* Header: emoji + name + menu */}
        <div className="flex items-start gap-3">
          <div className="text-3xl shrink-0 select-none">{emoji}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm truncate">{displayName}</h3>
              <span className={cn('h-2 w-2 rounded-full shrink-0', 'bg-green-500')} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">{agent.id}</p>
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
                    onChat(agent);
                  }}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  {t('card.chat')}
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
                {!agent.isDefault && (
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
                )}
              </div>
            )}
          </div>
        </div>

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          {agent.isDefault && (
            <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800">
              <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />
              {t('card.default')}
            </Badge>
          )}
          {agent.identity?.theme && (
            <Badge variant="secondary" className="text-[10px]">
              {agent.identity.theme}
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}
