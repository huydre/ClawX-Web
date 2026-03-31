/**
 * Agents Page
 * Manage AI agents — view, create, edit, delete
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  RefreshCw,
  AlertCircle,
  Bot,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAgentsStore } from '@/stores/agents';
import { useGatewayStore } from '@/stores/gateway';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { AsyncButton } from '@/components/common/AsyncButton';
import { EmptyState } from '@/components/common/EmptyState';
import { SearchInput } from '@/components/common/SearchInput';
import { ModalDialog } from '@/components/common/ModalDialog';
import type { Agent } from '@/types/agent';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AgentCard } from './AgentCard';
import { AgentCreateDialog } from './AgentCreateDialog';
import { AgentDetailDialog } from './AgentDetailDialog';

export function Agents() {
  const { t } = useTranslation('agents');
  const navigate = useNavigate();
  const { agents, loading, error, fetchAgents, deleteAgent } = useAgentsStore();
  const isGatewayRunning = useGatewayStore((state) => state.isRunning());

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');

  const handleChat = useCallback(async (agent: Agent) => {
    // Switch chat session to this agent and navigate to chat
    const { useChatStore } = await import('@/stores/chat');
    const sessionKey = `agent:${agent.id}:main`;
    useChatStore.getState().switchSession(sessionKey);
    navigate('/');
  }, [navigate]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const filteredAgents = agents.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const displayName = a.identity?.name || a.name || '';
    return (
      displayName.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q)
    );
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAgent(deleteTarget.id);
      toast.success(t('delete.success'));
      setDeleteTarget(null);
    } catch (err) {
      toast.error(t('delete.error') + ': ' + String(err));
    } finally {
      setDeleting(false);
    }
  };

  if (loading && agents.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-5 md:space-y-6 pb-16 md:pb-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1 hidden sm:block">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <AsyncButton
            variant="outline"
            iconOnly
            loading={loading}
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={fetchAgents}
            aria-label={t('refresh')}
          />
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">{t('addAgent')}</span>
          </Button>
        </div>
      </div>

      {/* Gateway Warning */}
      {!isGatewayRunning && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/20">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-sm text-amber-700 dark:text-amber-300">
            {t('gatewayWarning')}
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50/50 px-4 py-3 dark:border-red-800 dark:bg-red-950/20">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
          <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
        </div>
      )}

      {/* Search */}
      {agents.length > 0 && (
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t('common:actions.search') + '...'}
          fullWidth
          size="sm"
        />
      )}

      {/* Agent grid */}
      {filteredAgents.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            {t('configured')}
            <span className="ml-2 text-xs font-normal">({filteredAgents.length})</span>
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filteredAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onEdit={setSelectedAgent}
                onDelete={setDeleteTarget}
                onChat={handleChat}
              />
            ))}
          </div>
        </div>
      ) : agents.length === 0 && !loading ? (
        <EmptyState
          icon={<Bot className="h-full w-full" />}
          title={t('empty.title')}
          description={t('empty.desc')}
          action={
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('empty.cta')}
            </Button>
          }
          variant="card"
        />
      ) : search && filteredAgents.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No agents matching "{search}"
        </div>
      ) : null}

      {/* Create Dialog */}
      {showCreateDialog && (
        <AgentCreateDialog
          open={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          onCreated={() => {
            fetchAgents();
            setShowCreateDialog(false);
          }}
        />
      )}

      {/* Detail/Edit Dialog */}
      {selectedAgent && (
        <AgentDetailDialog
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          onUpdated={() => {
            fetchAgents();
            setSelectedAgent(null);
          }}
        />
      )}

      {/* Delete Confirmation */}
      <ModalDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t('delete.title')}
        maxWidth="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t('common:actions.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? t('common:status.loading') : t('delete.confirm')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          {t('delete.message', { name: deleteTarget?.identity?.name || deleteTarget?.name || deleteTarget?.id })}
        </p>
      </ModalDialog>
    </div>
  );
}

export default Agents;
