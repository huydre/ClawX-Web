/**
 * AgentCreateDialog — Modal form for creating a new agent
 * OpenClaw agents.create only accepts: { name, workspace, emoji?, avatar? }
 */
import { useState } from 'react';
import { ModalDialog } from '@/components/common/ModalDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAgentsStore } from '@/stores/agents';
import { AGENT_EMOJIS } from '@/types/agent';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

interface AgentCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function AgentCreateDialog({ open, onClose, onCreated }: AgentCreateDialogProps) {
  const { t } = useTranslation('agents');
  const createAgent = useAgentsStore((s) => s.createAgent);

  const [name, setName] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [emoji, setEmoji] = useState('🤖');
  const [creating, setCreating] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !workspace.trim()) return;

    setCreating(true);
    try {
      await createAgent({
        name: name.trim(),
        workspace: workspace.trim(),
        emoji,
      });
      toast.success(t('create.success'));
      onCreated();
      onClose();
    } catch (err) {
      toast.error(t('create.error') + ': ' + String(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title={t('create.title')}
      description={t('create.description')}
      maxWidth="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>{t('common:actions.cancel')}</Button>
          <Button onClick={handleCreate} disabled={creating || !name.trim() || !workspace.trim()}>
            {creating ? t('create.creating') : t('common:actions.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Emoji + Name row */}
        <div className="flex gap-3">
          <div className="shrink-0">
            <Label className="text-xs mb-1.5 block">{t('create.emoji')}</Label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="h-10 w-10 rounded-md border border-input bg-background text-xl flex items-center justify-center hover:bg-accent transition-colors"
              >
                {emoji}
              </button>
              {showEmojiPicker && (
                <div className="absolute top-12 left-0 z-50 p-2 rounded-md border bg-popover shadow-md grid grid-cols-6 gap-1 w-[200px] animate-in fade-in-0 zoom-in-95">
                  {AGENT_EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      className="text-xl h-8 w-8 rounded hover:bg-accent flex items-center justify-center"
                      onClick={() => { setEmoji(e); setShowEmojiPicker(false); }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 space-y-1.5">
            <Label htmlFor="agentName">{t('create.displayName')}</Label>
            <Input
              id="agentName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('create.displayNameHint')}
            />
          </div>
        </div>

        {/* Workspace */}
        <div className="space-y-1.5">
          <Label htmlFor="workspace">{t('create.workspace')}</Label>
          <Input
            id="workspace"
            value={workspace}
            onChange={(e) => setWorkspace(e.target.value)}
            placeholder={t('create.workspaceHint')}
            className="font-mono text-sm"
          />
        </div>
      </div>
    </ModalDialog>
  );
}
