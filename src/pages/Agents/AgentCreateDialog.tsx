/**
 * AgentCreateDialog — Create agent + assign channel in one step
 *
 * Flow: name/emoji → channel type + token → creates:
 *   1. Agent via agents.create RPC
 *   2. Channel account in openclaw.json (channels.{type}.accounts.{agentId})
 *   3. Binding in openclaw.json (bindings[])
 */
import { useState } from 'react';
import { ModalDialog } from '@/components/common/ModalDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { SecretInput } from '@/components/common/SecretInput';
import { useAgentsStore } from '@/stores/agents';
import { AGENT_EMOJIS } from '@/types/agent';
import { CHANNEL_META, type ChannelType } from '@/types/channel';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

const CHANNEL_OPTIONS: { value: ChannelType | ''; label: string; tokenKey: string; tokenLabel: string }[] = [
  { value: '', label: 'No channel (configure later)', tokenKey: '', tokenLabel: '' },
  { value: 'telegram', label: 'Telegram', tokenKey: 'botToken', tokenLabel: 'Bot Token' },
  { value: 'discord', label: 'Discord', tokenKey: 'token', tokenLabel: 'Bot Token' },
  { value: 'whatsapp', label: 'WhatsApp (QR later)', tokenKey: '', tokenLabel: '' },
  { value: 'signal', label: 'Signal', tokenKey: 'number', tokenLabel: 'Phone Number' },
  { value: 'feishu', label: 'Feishu / Lark', tokenKey: 'appId', tokenLabel: 'App ID' },
  { value: 'msteams', label: 'Microsoft Teams', tokenKey: 'appId', tokenLabel: 'App ID' },
  { value: 'openzalo', label: 'Zalo', tokenKey: '', tokenLabel: '' },
];

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
  const [workspaceManual, setWorkspaceManual] = useState(false);
  const [emoji, setEmoji] = useState('🤖');
  const [creating, setCreating] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Channel config
  const [channelType, setChannelType] = useState<ChannelType | ''>('');
  const [channelToken, setChannelToken] = useState('');

  const slugify = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  const selectedChannel = CHANNEL_OPTIONS.find((c) => c.value === channelType);

  const handleCreate = async () => {
    if (!name.trim() || !workspace.trim()) return;

    setCreating(true);
    try {
      // 1. Create agent
      const agent = await createAgent({
        name: name.trim(),
        workspace: workspace.trim(),
        emoji,
      });

      const agentId = agent.id;

      // 2. If channel selected, save channel account + binding
      if (channelType && selectedChannel?.tokenKey && channelToken.trim()) {
        // Save channel account: channels.{type}.accounts.{agentId} = { tokenKey: value }
        await api.saveChannelConfig(
          channelType,
          { [selectedChannel.tokenKey]: channelToken.trim(), dmPolicy: 'open' },
          agentId
        );

        // Save binding: agentId → channel + accountId
        await api.setAgentBindings(agentId, [
          { match: { channel: channelType, accountId: agentId } },
        ]);

        toast.success(t('create.successWithChannel', { defaultValue: 'Agent created with channel binding' }));
      } else if (channelType && !selectedChannel?.tokenKey) {
        // Channel without token (WhatsApp/Zalo — QR later), just create binding
        await api.setAgentBindings(agentId, [
          { match: { channel: channelType } },
        ]);
        toast.success(t('create.successWithBinding', { defaultValue: 'Agent created. Configure channel token in Channel Settings.' }));
      } else {
        toast.success(t('create.success'));
      }

      onCreated();
      onClose();
    } catch (err) {
      toast.error(t('create.error') + ': ' + String(err));
    } finally {
      setCreating(false);
    }
  };

  const canSave = name.trim() && workspace.trim();

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
          <Button onClick={handleCreate} disabled={creating || !canSave}>
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
              onChange={(e) => {
                setName(e.target.value);
                if (!workspaceManual) {
                  const slug = slugify(e.target.value);
                  setWorkspace(slug ? `~/.openclaw/workspace-${slug}` : '');
                }
              }}
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
            onChange={(e) => {
              setWorkspace(e.target.value);
              setWorkspaceManual(true);
            }}
            placeholder={t('create.workspaceHint')}
            className="font-mono text-sm"
          />
        </div>

        {/* Channel section */}
        <div className="border-t pt-4 space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            {t('create.channelSection', { defaultValue: 'Channel (optional)' })}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t('create.channelDesc', { defaultValue: 'Assign a messaging channel to this agent. Each agent can have its own bot.' })}
          </p>

          {/* Channel type */}
          <div className="space-y-1.5">
            <Label>{t('create.channelType', { defaultValue: 'Channel' })}</Label>
            <Select
              value={channelType}
              onChange={(e) => {
                setChannelType(e.target.value as ChannelType | '');
                setChannelToken('');
              }}
            >
              {CHANNEL_OPTIONS.map((ch) => (
                <option key={ch.value} value={ch.value}>{ch.label}</option>
              ))}
            </Select>
          </div>

          {/* Token field — only show for channels that need token */}
          {selectedChannel?.tokenKey && channelType && (
            <div className="space-y-1.5">
              <Label>{selectedChannel.tokenLabel} <span className="text-red-500">*</span></Label>
              <SecretInput
                value={channelToken}
                onChange={(e) => setChannelToken(e.target.value)}
                placeholder={`Enter ${selectedChannel.tokenLabel.toLowerCase()}...`}
                className="font-mono text-sm"
                fullWidth
              />
              {CHANNEL_META[channelType]?.configFields[0]?.envVar && (
                <p className="text-xs text-muted-foreground">
                  Env: {CHANNEL_META[channelType].configFields[0].envVar}
                </p>
              )}
            </div>
          )}

          {/* Info for QR-based channels */}
          {channelType && !selectedChannel?.tokenKey && channelType !== '' && (
            <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
              {t('create.channelQrNote', { defaultValue: 'This channel uses QR code login. After creating the agent, configure it in Channel Settings.' })}
            </p>
          )}
        </div>
      </div>
    </ModalDialog>
  );
}
