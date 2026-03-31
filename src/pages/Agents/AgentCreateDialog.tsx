/**
 * AgentCreateDialog — Modal form for creating a new agent
 */
import { useState } from 'react';
import { ModalDialog } from '@/components/common/ModalDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { useAgentsStore } from '@/stores/agents';
import { AGENT_EMOJIS, CONTEXT_WINDOW_OPTIONS } from '@/types/agent';
import type { AgentType } from '@/types/agent';
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

  const [displayName, setDisplayName] = useState('');
  const [emoji, setEmoji] = useState('🤖');
  const [agentType, setAgentType] = useState<AgentType>('open');
  const [description, setDescription] = useState('');
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [contextWindow, setContextWindow] = useState(131072);
  const [maxToolIterations, setMaxToolIterations] = useState(25);
  const [creating, setCreating] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleCreate = async () => {
    if (!displayName.trim()) return;

    setCreating(true);
    try {
      await createAgent({
        display_name: displayName.trim(),
        emoji,
        description: description.trim() || undefined,
        agent_type: agentType,
        provider: provider.trim() || undefined,
        model: model.trim() || undefined,
        context_window: contextWindow,
        max_tool_iterations: maxToolIterations,
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
          <Button onClick={handleCreate} disabled={creating || !displayName.trim()}>
            {creating ? t('create.creating') : t('common:actions.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Emoji + Display Name row */}
        <div className="flex gap-3">
          {/* Emoji picker */}
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
            <Label htmlFor="displayName">{t('create.displayName')}</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('create.displayNameHint')}
            />
          </div>
        </div>

        {/* Agent Type */}
        <div className="space-y-1.5">
          <Label>{t('create.agentType')}</Label>
          <Select value={agentType} onChange={(e) => setAgentType(e.target.value as AgentType)}>
            <option value="open">{t('create.agentTypeOpen')}</option>
            <option value="predefined">{t('create.agentTypePredefined')}</option>
          </Select>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="description">{t('create.description')}</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('create.descriptionHint')}
            rows={2}
          />
        </div>

        {/* Provider + Model */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="provider">{t('create.provider')}</Label>
            <Input
              id="provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder={t('create.providerHint')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="model">{t('create.model')}</Label>
            <Input
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={t('create.modelHint')}
            />
          </div>
        </div>

        {/* Context Window + Max Tool Iterations */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{t('create.contextWindow')}</Label>
            <Select value={String(contextWindow)} onChange={(e) => setContextWindow(Number(e.target.value))}>
              {CONTEXT_WINDOW_OPTIONS.map((opt) => (
                <option key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="maxIterations">{t('create.maxToolIterations')}</Label>
            <Input
              id="maxIterations"
              type="number"
              min={1}
              max={100}
              value={maxToolIterations}
              onChange={(e) => setMaxToolIterations(Number(e.target.value))}
            />
          </div>
        </div>
      </div>
    </ModalDialog>
  );
}
