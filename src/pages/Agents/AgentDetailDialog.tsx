/**
 * AgentDetailDialog — View/edit agent details
 * Tabs: Overview (name, model) + Files (context file editor)
 *
 * OpenClaw agents.update only accepts: { agentId, name?, workspace?, model?, avatar? }
 */
import { useState, useEffect, useCallback } from 'react';
import { Save, FileText, Settings2, FolderOpen, Puzzle } from 'lucide-react';
import { ModalDialog } from '@/components/common/ModalDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAgentsStore } from '@/stores/agents';
import { platform } from '@/lib/platform';
import { api } from '@/lib/api';
import type { Agent, AgentFile } from '@/types/agent';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

interface AgentDetailDialogProps {
  agent: Agent;
  onClose: () => void;
  onUpdated: () => void;
}

export function AgentDetailDialog({ agent, onClose, onUpdated }: AgentDetailDialogProps) {
  const { t } = useTranslation('agents');
  const { updateAgent, getAgentFiles, getAgentFile, setAgentFile } = useAgentsStore();

  const displayName = agent.identity?.name || agent.name || agent.id;
  const emoji = agent.identity?.emoji || '🤖';

  // Overview form state
  const [name, setName] = useState(agent.name || '');
  const [model, setModel] = useState('');
  const [defaultModel, setDefaultModel] = useState('');
  const [saving, setSaving] = useState(false);

  // Agent config detail from openclaw.json
  const [channelInfo, setChannelInfo] = useState<{ type: string; accountId: string; dmPolicy: string } | null>(null);
  const [hasAuth, setHasAuth] = useState(false);
  const [authProviders, setAuthProviders] = useState<string[]>([]);
  const [authSources, setAuthSources] = useState<Array<{ id: string; name: string; providers: string[] }>>([]);
  const [copyingAuth, setCopyingAuth] = useState(false);

  // Available models from gateway
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string; provider: string }>>([]);

  useEffect(() => {
    // Load models list
    (async () => {
      try {
        const result = platform.isElectron
          ? await window.electron.ipcRenderer.invoke('gateway:rpc', 'models.list', {})
          : await api.gatewayRpc('models.list', {});
        const typedResult = result as { success: boolean; result?: { models?: Array<{ id: string; name: string; provider: string }> } };
        if (typedResult.success && typedResult.result?.models) {
          setAvailableModels(typedResult.result.models);
        }
      } catch { /* ignore */ }
    })();

    // Load agent detail from config
    (async () => {
      try {
        const detail = await api.getAgentDetail(agent.id);
        if (detail.found) {
          setModel(detail.model || '');
          setDefaultModel(detail.defaultModel || '');
          if (detail.channelInfo) setChannelInfo(detail.channelInfo);
          setHasAuth(detail.hasAuth || false);
          setAuthProviders(detail.authProviders || []);
          if (detail.workspace) setWorkspace(detail.workspace);
        }
      } catch { /* ignore */ }
    })();

    // Load auth sources (agents with auth configured)
    (async () => {
      try {
        const result = await api.getAuthSources();
        setAuthSources(result.sources || []);
      } catch { /* ignore */ }
    })();
  }, [agent.id]);

  // Files tab state
  const [workspace, setWorkspace] = useState('');
  const [files, setFiles] = useState<AgentFile[]>([]);
  const [skills, setSkills] = useState<Array<{ name: string; hasSkillMd: boolean; description: string }>>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [fileLoading, setFileLoading] = useState(false);
  const [fileSaving, setFileSaving] = useState(false);
  const [fileDirty, setFileDirty] = useState(false);

  useEffect(() => {
    loadFiles();
    loadSkills();
  }, [agent.id]);

  const loadFiles = useCallback(async () => {
    const result = await getAgentFiles(agent.id);
    setWorkspace(result.workspace);
    setFiles(result.files);
    if (result.files.length > 0 && !selectedFile) {
      const first = result.files.find((f) => !f.missing) || result.files[0];
      setSelectedFile(first.name);
    }
  }, [agent.id, getAgentFiles, selectedFile]);

  const loadSkills = useCallback(async () => {
    try {
      const result = await api.getWorkspaceSkills(agent.id);
      setSkills(result.skills || []);
      if (!workspace && result.workspace) setWorkspace(result.workspace);
    } catch { /* ignore */ }
  }, [agent.id]);

  // Load file content when selected
  useEffect(() => {
    if (!selectedFile) return;
    setFileLoading(true);
    setFileDirty(false);
    getAgentFile(agent.id, selectedFile)
      .then((file) => {
        setFileContent(file?.content || '');
        setFileLoading(false);
      })
      .catch(() => setFileLoading(false));
  }, [selectedFile, agent.id, getAgentFile]);

  const handleSaveOverview = async () => {
    setSaving(true);
    try {
      // Update via RPC (name)
      await updateAgent({
        agentId: agent.id,
        ...(name.trim() ? { name: name.trim() } : {}),
        ...(model.trim() ? { model: model.trim() } : {}),
      });
      // Also save model to openclaw.json directly (RPC may not persist model)
      await api.updateAgentDetail(agent.id, { model: model.trim() || undefined });
      toast.success(t('detail.updated'));
      onUpdated();
    } catch (err) {
      toast.error(t('detail.updateError') + ': ' + String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFile = async () => {
    if (!selectedFile) return;
    setFileSaving(true);
    try {
      await setAgentFile(agent.id, selectedFile, fileContent);
      setFileDirty(false);
      toast.success(t('detail.fileSaved'));
    } catch (err) {
      toast.error(t('detail.fileSaveError') + ': ' + String(err));
    } finally {
      setFileSaving(false);
    }
  };

  return (
    <ModalDialog
      open={true}
      onClose={onClose}
      maxWidth="2xl"
      renderHeader={() => (
        <div className="flex items-center gap-3 p-6 pb-2">
          <span className="text-3xl">{emoji}</span>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">{displayName}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className="text-[10px] font-mono">{agent.id}</Badge>
              {agent.isDefault && (
                <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  {t('card.default')}
                </Badge>
              )}
            </div>
          </div>
        </div>
      )}
    >
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="overview" className="flex-1 gap-1.5">
            <Settings2 className="h-3.5 w-3.5" />
            {t('detail.overview')}
          </TabsTrigger>
          <TabsTrigger value="files" className="flex-1 gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            {t('detail.files')}
            {files.length > 0 && (
              <Badge variant="secondary" className="text-[10px] ml-1 h-4 min-w-[16px] px-1">
                {files.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Name */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {t('detail.personality')}
            </h3>
            <div className="space-y-1.5">
              <Label>{t('create.displayName')}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('create.displayNameHint')}
              />
            </div>
          </div>

          {/* Model */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {t('detail.modelConfig')}
            </h3>
            <div className="space-y-1.5">
              <Label>{t('create.model')}</Label>
              {availableModels.length > 0 ? (
                <Select value={model} onChange={(e) => setModel(e.target.value)}>
                  <option value="">{defaultModel ? `Default: ${defaultModel}` : t('create.modelHint')}</option>
                  {availableModels.map((m) => {
                    const label = m.name !== m.id ? `${m.name} (${m.provider})` : m.id;
                    return (
                      <option key={m.id} value={m.id}>{label}</option>
                    );
                  })}
                </Select>
              ) : (
                <Input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={defaultModel ? `Default: ${defaultModel}` : t('create.modelHint')}
                />
              )}
              {model && model !== defaultModel && (
                <p className="text-xs text-muted-foreground">{t('detail.modelOverride', { model })}</p>
              )}
              {!model && defaultModel && (
                <p className="text-xs text-muted-foreground">{t('detail.modelDefault', { model: defaultModel })}</p>
              )}
            </div>
          </div>

          {/* Channel Info */}
          {channelInfo && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {t('detail.channel')}
              </h3>
              <div className="p-3 bg-muted/50 rounded-md space-y-1.5">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs capitalize">{channelInfo.type}</Badge>
                  <Badge variant="secondary" className="text-xs">{channelInfo.accountId}</Badge>
                  <Badge variant={channelInfo.dmPolicy === 'pairing' ? 'default' : 'secondary'} className="text-xs">
                    DM: {channelInfo.dmPolicy}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {/* Auth / AI Provider */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {t('detail.aiProvider')}
            </h3>
            <div className="p-3 bg-muted/50 rounded-md space-y-2">
              {hasAuth ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-xs font-medium">{t('detail.connected')}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {authProviders.map((p) => (
                      <Badge key={p} variant="outline" className="text-[10px] font-mono">{p}</Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-yellow-500" />
                  <span className="text-xs text-muted-foreground">{t('detail.noProvider')}</span>
                </div>
              )}

              {/* Copy from existing agent */}
              {authSources.filter((s) => s.id !== agent.id).length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <Label className="text-xs">{hasAuth ? t('detail.changeProvider') : t('detail.copyFrom')}</Label>
                  <div className="flex gap-2">
                    <Select
                      id="auth-source"
                      className="text-xs flex-1"
                      defaultValue=""
                    >
                      <option value="" disabled>{t('detail.selectSourceAgent')}</option>
                      {authSources.filter((s) => s.id !== agent.id).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.providers.join(', ')})
                        </option>
                      ))}
                    </Select>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="shrink-0 h-9 text-xs"
                      disabled={copyingAuth}
                      onClick={async () => {
                        const select = document.getElementById('auth-source') as HTMLSelectElement;
                        const sourceId = select?.value;
                        if (!sourceId) { toast.error(t('detail.selectSourceError')); return; }
                        setCopyingAuth(true);
                        try {
                          await api.copyAuth(agent.id, sourceId);
                          toast.success(t('detail.authCopied', { source: sourceId }));
                          // Reload detail
                          const detail = await api.getAgentDetail(agent.id);
                          if (detail.found) {
                            setHasAuth(detail.hasAuth || false);
                            setAuthProviders(detail.authProviders || []);
                          }
                        } catch (err) {
                          toast.error(t('detail.authCopyFailed', { error: String(err) }));
                        } finally {
                          setCopyingAuth(false);
                        }
                      }}
                    >
                      {copyingAuth ? t('detail.copying') : t('detail.apply')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSaveOverview} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? t('detail.saving') : t('common:actions.save')}
            </Button>
          </div>
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files" className="mt-4">
          {/* Workspace path */}
          {workspace && (
            <div className="flex items-center gap-2 mb-3 p-2 bg-muted/50 rounded-md">
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <code className="text-xs text-muted-foreground truncate">{workspace}</code>
            </div>
          )}

          {/* Skills list */}
          {skills.length > 0 && (
            <div className="mb-4 space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Puzzle className="h-3 w-3" />
                {t('detail.skills')} ({skills.length})
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {skills.map((s) => (
                  <div
                    key={s.name}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-xs"
                    title={s.description || s.name}
                  >
                    <span>{s.hasSkillMd ? '📦' : '📁'}</span>
                    <span className="font-medium">{s.name}</span>
                    {s.description && (
                      <span className="text-muted-foreground max-w-[150px] truncate">— {s.description}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {files.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {t('detail.noFiles')}
            </div>
          ) : (
            <div className="space-y-3">
              {/* File selector */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {files.map((f) => (
                  <button
                    key={f.name}
                    onClick={() => setSelectedFile(f.name)}
                    className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-mono transition-colors ${
                      selectedFile === f.name
                        ? 'bg-primary text-primary-foreground'
                        : f.missing
                          ? 'bg-muted/50 text-muted-foreground/50 hover:bg-accent'
                          : 'bg-muted hover:bg-accent'
                    }`}
                  >
                    {f.name}
                    {f.missing && ` ${t('detail.fileNew')}`}
                  </button>
                ))}
              </div>

              {/* File editor */}
              {selectedFile && (
                <div className="space-y-2">
                  <Textarea
                    value={fileLoading ? '' : fileContent}
                    onChange={(e) => {
                      setFileContent(e.target.value);
                      setFileDirty(true);
                    }}
                    placeholder={fileLoading ? '...' : t('detail.selectFile')}
                    disabled={fileLoading}
                    className="font-mono text-xs min-h-[280px] resize-y"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleSaveFile}
                      disabled={fileSaving || !fileDirty}
                    >
                      <Save className="h-3.5 w-3.5 mr-1.5" />
                      {fileSaving ? t('detail.saving') : t('detail.saveFile')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </ModalDialog>
  );
}
