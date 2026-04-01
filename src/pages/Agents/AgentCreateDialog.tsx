/**
 * AgentCreateDialog — Create agent + assign channel in one step
 * Includes: validate bot token + DM Policy selector
 */
import { useState } from 'react';
import { Check, Loader2, ShieldCheck, AlertCircle, CheckCircle } from 'lucide-react';
import { ModalDialog } from '@/components/common/ModalDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { SecretInput } from '@/components/common/SecretInput';
import { useAgentsStore } from '@/stores/agents';
import { AGENT_EMOJIS } from '@/types/agent';
import type { ChannelType } from '@/types/channel';
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
  { value: 'openzalo', label: 'Zalo', tokenKey: '', tokenLabel: '' },
];

const DM_POLICY_OPTIONS = [
  { value: 'open', label: 'Open — anyone can message' },
  { value: 'pairing', label: 'Pairing — approve users individually' },
  { value: 'allowlist', label: 'Allowlist — only specific user IDs' },
  { value: 'disabled', label: 'Disabled — block all DMs' },
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
  const [dmPolicy, setDmPolicy] = useState('open');

  // Validation
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: string[];
    details?: Record<string, string>;
  } | null>(null);

  const slugify = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  const selectedChannel = CHANNEL_OPTIONS.find((c) => c.value === channelType);

  const handleValidate = async () => {
    if (!channelType || !selectedChannel?.tokenKey || !channelToken.trim()) return;

    setValidating(true);
    setValidationResult(null);
    try {
      const result = await api.validateChannelCredentials(
        channelType,
        { [selectedChannel.tokenKey]: channelToken.trim() }
      );
      setValidationResult({
        valid: result.valid || false,
        errors: result.errors || [],
        details: result.details,
      });
    } catch (err) {
      setValidationResult({ valid: false, errors: [String(err)] });
    } finally {
      setValidating(false);
    }
  };

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

      // 2. If channel selected with token, save channel account + binding
      let needsRestart = false;

      if (channelType && selectedChannel?.tokenKey && channelToken.trim()) {
        const channelConfig: Record<string, unknown> = {
          [selectedChannel.tokenKey]: channelToken.trim(),
          dmPolicy,
        };

        // Set allowFrom based on dmPolicy
        if (dmPolicy === 'open') {
          channelConfig.allowFrom = ['*'];
        }

        await api.saveChannelConfig(channelType, channelConfig, agentId);
        await api.setAgentBindings(agentId, [
          { match: { channel: channelType, accountId: agentId } },
        ]);

        needsRestart = true;
        toast.success(t('create.successWithChannel', { defaultValue: 'Agent created with channel binding' }));
      } else if (channelType && !selectedChannel?.tokenKey) {
        await api.setAgentBindings(agentId, [
          { match: { channel: channelType } },
        ]);
        toast.success(t('create.successWithBinding', { defaultValue: 'Agent created. Configure channel in Settings.' }));
      } else {
        toast.success(t('create.success'));
      }

      // 3. Restart gateway to apply new channel config
      if (needsRestart) {
        try {
          toast.info(t('create.restarting', { defaultValue: 'Restarting gateway to apply changes...' }));
          await api.restartOpenClaw();
        } catch {
          toast.info(t('create.restartManual', { defaultValue: 'Restart gateway manually in Settings to apply channel config.' }));
        }
      }

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
        {/* Emoji + Name */}
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
            onChange={(e) => { setWorkspace(e.target.value); setWorkspaceManual(true); }}
            placeholder={t('create.workspaceHint')}
            className="font-mono text-sm"
          />
        </div>

        {/* Channel section */}
        <div className="border-t pt-4 space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            {t('create.channelSection', { defaultValue: 'Channel (optional)' })}
          </h3>

          {/* Channel type */}
          <div className="space-y-1.5">
            <Label>{t('create.channelType', { defaultValue: 'Channel' })}</Label>
            <Select
              value={channelType}
              onChange={(e) => {
                setChannelType(e.target.value as ChannelType | '');
                setChannelToken('');
                setValidationResult(null);
              }}
            >
              {CHANNEL_OPTIONS.map((ch) => (
                <option key={ch.value} value={ch.value}>{ch.label}</option>
              ))}
            </Select>
          </div>

          {/* Token + Validate */}
          {selectedChannel?.tokenKey && channelType && (
            <div className="space-y-2">
              <Label>{selectedChannel.tokenLabel} <span className="text-red-500">*</span></Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <SecretInput
                    value={channelToken}
                    onChange={(e) => { setChannelToken(e.target.value); setValidationResult(null); }}
                    placeholder={`Enter ${selectedChannel.tokenLabel.toLowerCase()}...`}
                    className="font-mono text-sm"
                    fullWidth
                  />
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleValidate}
                  disabled={validating || !channelToken.trim()}
                  className="shrink-0 h-10"
                >
                  {validating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Validation result */}
              {validationResult && (
                <div className={`p-3 rounded-lg text-sm ${
                  validationResult.valid
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                    : 'bg-red-500/10 text-red-600 dark:text-red-400'
                }`}>
                  <div className="flex items-center gap-2">
                    {validationResult.valid ? (
                      <CheckCircle className="h-4 w-4 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 shrink-0" />
                    )}
                    <div>
                      {validationResult.valid ? (
                        <span>
                          <Check className="h-3 w-3 inline mr-1" />
                          Valid
                          {validationResult.details?.botUsername && ` — @${validationResult.details.botUsername}`}
                        </span>
                      ) : (
                        <span>{validationResult.errors.join(', ')}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DM Policy */}
          {channelType && channelType !== '' && (
            <div className="space-y-1.5">
              <Label>{t('create.dmPolicy', { defaultValue: 'DM Policy' })}</Label>
              <Select value={dmPolicy} onChange={(e) => setDmPolicy(e.target.value)}>
                {DM_POLICY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                {t('create.dmPolicyHint', { defaultValue: 'Controls who can send direct messages to this bot' })}
              </p>
            </div>
          )}

          {/* QR note */}
          {channelType && !selectedChannel?.tokenKey && channelType !== '' && (
            <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
              {t('create.channelQrNote', { defaultValue: 'This channel uses QR code login. Configure it in Channel Settings after creating.' })}
            </p>
          )}
        </div>
      </div>
    </ModalDialog>
  );
}
