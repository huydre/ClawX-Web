/**
 * AgentDetailDialog — View/edit agent details
 * Tabs: Overview (name, model) + Files (context file editor)
 *
 * OpenClaw agents.update only accepts: { agentId, name?, workspace?, model?, avatar? }
 */
import { useState, useEffect, useCallback } from 'react';
import { Save, FileText, Settings2 } from 'lucide-react';
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
  const [model, setModel] = useState(agent.model || '');
  const [saving, setSaving] = useState(false);

  // Available models from gateway
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string; provider: string }>>([]);

  useEffect(() => {
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
  }, []);

  // Files tab state
  const [files, setFiles] = useState<AgentFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [fileLoading, setFileLoading] = useState(false);
  const [fileSaving, setFileSaving] = useState(false);
  const [fileDirty, setFileDirty] = useState(false);

  useEffect(() => {
    loadFiles();
  }, [agent.id]);

  const loadFiles = useCallback(async () => {
    const result = await getAgentFiles(agent.id);
    setFiles(result);
    if (result.length > 0 && !selectedFile) {
      // Select first non-missing file
      const first = result.find((f) => !f.missing) || result[0];
      setSelectedFile(first.name);
    }
  }, [agent.id, getAgentFiles, selectedFile]);

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
      await updateAgent({
        agentId: agent.id,
        ...(name.trim() ? { name: name.trim() } : {}),
        ...(model.trim() ? { model: model.trim() } : {}),
      });
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

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {t('detail.modelConfig')}
            </h3>
            <div className="space-y-1.5">
              <Label>{t('create.model')}</Label>
              {availableModels.length > 0 ? (
                <Select value={model} onChange={(e) => setModel(e.target.value)}>
                  <option value="">{t('create.modelHint')}</option>
                  {availableModels.map((m) => {
                    // id is "provider/model", name is display name
                    // Show: "Claude Sonnet 4 (anthropic)" or just id if name equals id
                    const label = m.name !== m.id ? `${m.name} (${m.provider})` : m.id;
                    return (
                      <option key={m.id} value={m.id}>
                        {label}
                      </option>
                    );
                  })}
                </Select>
              ) : (
                <Input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={t('create.modelHint')}
                />
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
                    {f.missing && ' (new)'}
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
