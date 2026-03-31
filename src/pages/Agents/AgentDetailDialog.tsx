/**
 * AgentDetailDialog — Full detail/edit view for a single agent
 * Tabs: Overview (edit fields) + Files (context file editor)
 */
import { useState, useEffect, useCallback } from 'react';
import { Save, FileText, Settings2 } from 'lucide-react';
import { ModalDialog } from '@/components/common/ModalDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select } from '@/components/ui/select';
import { useAgentsStore } from '@/stores/agents';
import { AGENT_EMOJIS, CONTEXT_WINDOW_OPTIONS } from '@/types/agent';
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

  // Overview form state
  const [displayName, setDisplayName] = useState(agent.display_name);
  const [emoji, setEmoji] = useState(agent.emoji || '🤖');
  const [description, setDescription] = useState(agent.description || '');
  const [provider, setProvider] = useState(agent.provider || '');
  const [model, setModel] = useState(agent.model || '');
  const [contextWindow, setContextWindow] = useState(agent.context_window || 131072);
  const [maxToolIterations, setMaxToolIterations] = useState(agent.max_tool_iterations || 25);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // Files tab state
  const [files, setFiles] = useState<AgentFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [fileLoading, setFileLoading] = useState(false);
  const [fileSaving, setFileSaving] = useState(false);
  const [fileDirty, setFileDirty] = useState(false);

  // Load files on mount
  useEffect(() => {
    loadFiles();
  }, [agent.agent_key]);

  const loadFiles = useCallback(async () => {
    const result = await getAgentFiles(agent.agent_key);
    setFiles(result);
    if (result.length > 0 && !selectedFile) {
      setSelectedFile(result[0].name);
    }
  }, [agent.agent_key, getAgentFiles, selectedFile]);

  // Load file content when selected file changes
  useEffect(() => {
    if (!selectedFile) return;
    setFileLoading(true);
    setFileDirty(false);
    getAgentFile(agent.agent_key, selectedFile)
      .then((content) => {
        setFileContent(content);
        setFileLoading(false);
      })
      .catch(() => setFileLoading(false));
  }, [selectedFile, agent.agent_key, getAgentFile]);

  const handleSaveOverview = async () => {
    setSaving(true);
    try {
      await updateAgent(agent.id, {
        display_name: displayName.trim(),
        emoji,
        description: description.trim() || undefined,
        provider: provider.trim() || undefined,
        model: model.trim() || undefined,
        context_window: contextWindow,
        max_tool_iterations: maxToolIterations,
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
      await setAgentFile(agent.agent_key, selectedFile, fileContent);
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
            <h2 className="text-lg font-semibold truncate">{agent.display_name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className="text-[10px] font-mono">{agent.agent_key}</Badge>
              <Badge variant="secondary" className="text-[10px]">
                {agent.agent_type === 'predefined' ? t('card.predefined') : t('card.open')}
              </Badge>
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
          {/* Personality section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {t('detail.personality')}
            </h3>

            {/* Emoji + Name */}
            <div className="flex gap-3">
              <div className="relative shrink-0">
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
              <div className="flex-1">
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t('create.displayNameHint')}
                />
              </div>
            </div>

            <div>
              <Label>{t('create.description')}</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('create.descriptionHint')}
                rows={2}
                className="mt-1.5"
              />
            </div>
          </div>

          {/* Model config section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {t('detail.modelConfig')}
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('create.provider')}</Label>
                <Input
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  placeholder={t('create.providerHint')}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('create.model')}</Label>
                <Input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={t('create.modelHint')}
                />
              </div>
            </div>

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
                <Label>{t('create.maxToolIterations')}</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={maxToolIterations}
                  onChange={(e) => setMaxToolIterations(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Save button */}
          <div className="flex justify-end pt-2">
            <Button onClick={handleSaveOverview} disabled={saving || !displayName.trim()}>
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
                        : 'bg-muted hover:bg-accent'
                    }`}
                  >
                    {f.name}
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
