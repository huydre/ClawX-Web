/**
 * Skills Page
 * Browse and manage AI skills
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Puzzle,
  RefreshCw,
  Lock,
  Package,
  Settings,
  AlertCircle,
  ShieldCheck,
  Trash2,
  Globe,
  FolderOpen,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSkillsStore } from '@/stores/skills';
import { useGatewayStore } from '@/stores/gateway';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Skill } from '@/types/skill';
import { useTranslation } from 'react-i18next';
import { SearchInput } from '@/components/common/SearchInput';

import { BundleCard, RECOMMENDED_SKILLS } from './BundleCard';
import { SkillDetailDialog } from './SkillDetailDialog';
import { MarketplaceSkillCard } from './MarketplaceSkillCard';


export function Skills() {
  const {
    skills,
    loading,
    error,
    fetchSkills,
    enableSkill,
    disableSkill,
    searchResults,
    searchSkills,
    installSkill,
    uninstallSkill,
    searching,
    searchError,
    installing
  } = useSkillsStore();
  const { t } = useTranslation('skills');
  const isGatewayRunning = useGatewayStore((state) => state.isRunning());
  const [searchQuery, setSearchQuery] = useState('');
  const [marketplaceQuery, setMarketplaceQuery] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedSource, setSelectedSource] = useState<'all' | 'built-in' | 'marketplace'>('all');
  const marketplaceDiscoveryAttemptedRef = useRef(false);

  const [showGatewayWarning, setShowGatewayWarning] = useState(false);

  // Debounce the gateway warning to avoid flickering during brief restarts (like skill toggles)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!isGatewayRunning) {
      // Wait 1.5s before showing the warning
      timer = setTimeout(() => {
        setShowGatewayWarning(true);
      }, 1500);
    } else {
      // Use setTimeout to avoid synchronous setState in effect
      timer = setTimeout(() => {
        setShowGatewayWarning(false);
      }, 0);
    }
    return () => clearTimeout(timer);
  }, [isGatewayRunning]);

  // Fetch skills on mount
  useEffect(() => {
    if (isGatewayRunning) {
      fetchSkills();
    }
  }, [fetchSkills, isGatewayRunning]);

  // Filter skills
  const filteredSkills = skills.filter((skill) => {
    const matchesSearch = skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesSource = true;
    if (selectedSource === 'built-in') {
      matchesSource = !!skill.isBundled;
    } else if (selectedSource === 'marketplace') {
      matchesSource = !skill.isBundled;
    }

    return matchesSearch && matchesSource;
  }).sort((a, b) => {
    // Enabled skills first
    if (a.enabled && !b.enabled) return -1;
    if (!a.enabled && b.enabled) return 1;
    // Then core/bundled
    if (a.isCore && !b.isCore) return -1;
    if (!a.isCore && b.isCore) return 1;
    // Finally alphabetical
    return a.name.localeCompare(b.name);
  });

  const sourceStats = {
    all: skills.length,
    builtIn: skills.filter(s => s.isBundled).length,
    marketplace: skills.filter(s => !s.isBundled).length,
  };

  // Handle toggle
  const handleToggle = useCallback(async (skillId: string, enable: boolean) => {
    try {
      if (enable) {
        await enableSkill(skillId);
        toast.success(t('toast.enabled'));
      } else {
        await disableSkill(skillId);
        toast.success(t('toast.disabled'));
      }
    } catch (err) {
      toast.error(String(err));
    }
  }, [enableSkill, disableSkill, t]);

  const hasInstalledSkills = skills.some(s => !s.isBundled);

  // Set of installed skill slugs (for bundle matching)
  // Check slug, id, and name (skillKey) since they might differ
  const installedSlugs = new Set(
    skills.flatMap(s => {
      const identifiers = [s.slug, s.id, s.name].filter((v): v is string => Boolean(v));
      // Also add lowercase/kebab-case variants
      return identifiers.flatMap(id => [
        id,
        id.toLowerCase(),
        id.toLowerCase().replace(/\s+/g, '-'),
      ]);
    })
  );

  // Install all uninstalled recommended skills sequentially with delay to avoid rate limit
  const handleInstallAll = useCallback(async () => {
    const toInstall = RECOMMENDED_SKILLS.filter(s => !installedSlugs.has(s.slug));
    let successCount = 0;
    for (let i = 0; i < toInstall.length; i++) {
      const skill = toInstall[i];
      try {
        await installSkill(skill.slug);
        await enableSkill(skill.slug);
        successCount++;
        toast.success(`Đã cài ${skill.name} (${successCount}/${toInstall.length})`);
      } catch (err) {
        const msg = String(err);
        if (msg.toLowerCase().includes('rate limit')) {
          toast.error(`Rate limit — chờ 10 giây rồi thử lại ${skill.name}...`);
          await new Promise(r => setTimeout(r, 10000));
          try {
            await installSkill(skill.slug);
            await enableSkill(skill.slug);
            successCount++;
            toast.success(`Đã cài ${skill.name} (${successCount}/${toInstall.length})`);
          } catch (retryErr) {
            toast.error(`Bỏ qua ${skill.name}: ${String(retryErr)}`);
          }
        } else if (msg.toLowerCase().includes('already installed')) {
          // Skill đã cài rồi — chỉ cần enable
          try {
            await enableSkill(skill.slug);
            successCount++;
            toast.success(`${skill.name} đã có sẵn — đã bật (${successCount}/${toInstall.length})`);
          } catch (enableErr) {
            toast.warning(`${skill.name} đã cài nhưng không thể bật: ${String(enableErr)}`);
          }
        } else if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('skill not found')) {
          toast.warning(`${skill.name}: slug "${skill.slug}" không tìm thấy trên ClawHub — bỏ qua`);
        } else {
          toast.error(`Lỗi khi cài ${skill.name}: ${msg}`);
        }
      }
      // 3s delay between each install to respect rate limits
      if (i < toInstall.length - 1) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    if (successCount > 0) {
      toast.success(`Hoàn tất! Đã cài ${successCount}/${toInstall.length} skill.`);
    }
  }, [installSkill, enableSkill, installedSlugs]);

  const handleOpenSkillsFolder = useCallback(async () => {
    if (!window.electron?.ipcRenderer) {
      toast.info('Skills folder can only be opened in desktop mode.');
      return;
    }
    try {
      const skillsDir = await window.electron.ipcRenderer.invoke('openclaw:getSkillsDir') as string;
      if (!skillsDir) {
        throw new Error('Skills directory not available');
      }
      const result = await window.electron.ipcRenderer.invoke('shell:openPath', skillsDir) as string;
      if (result && typeof result === 'string') {
        if (result.toLowerCase().includes('no such file') || result.toLowerCase().includes('not found') || result.toLowerCase().includes('failed to open')) {
          toast.error(t('toast.failedFolderNotFound'));
        } else {
          throw new Error(result);
        }
      }
    } catch (err) {
      toast.error(t('toast.failedOpenFolder') + ': ' + String(err));
    }
  }, [t]);

  // Handle marketplace search
  const handleMarketplaceSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    searchSkills(marketplaceQuery);
  }, [marketplaceQuery, searchSkills]);

  // Auto-reset when query is cleared
  useEffect(() => {
    if (activeTab === 'marketplace' && marketplaceQuery === '' && marketplaceDiscoveryAttemptedRef.current) {
      searchSkills('');
    }
  }, [marketplaceQuery, activeTab, searchSkills]);

  // Handle install
  const handleInstall = useCallback(async (slug: string) => {
    try {
      await installSkill(slug);
      // Automatically enable after install
      // We need to find the skill id which is usually the slug
      await enableSkill(slug);
      toast.success(t('toast.installed'));
    } catch (err) {
      toast.error(t('toast.failedInstall') + ': ' + String(err));
    }
  }, [installSkill, enableSkill, t]);

  // Initial marketplace load (Discovery)
  useEffect(() => {
    if (activeTab !== 'marketplace') {
      return;
    }
    if (marketplaceQuery.trim()) {
      return;
    }
    if (searching) {
      return;
    }
    if (marketplaceDiscoveryAttemptedRef.current) {
      return;
    }
    marketplaceDiscoveryAttemptedRef.current = true;
    searchSkills('');
  }, [activeTab, marketplaceQuery, searching, searchSkills]);

  // Handle uninstall
  const handleUninstall = useCallback(async (slug: string) => {
    try {
      await uninstallSkill(slug);
      toast.success(t('toast.uninstalled'));
    } catch (err) {
      toast.error(t('toast.failedUninstall') + ': ' + String(err));
    }
  }, [uninstallSkill, t]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 pb-16 md:pb-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground hidden sm:block">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="icon" className="md:hidden" onClick={fetchSkills} disabled={!isGatewayRunning}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="hidden md:flex" onClick={fetchSkills} disabled={!isGatewayRunning}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('refresh')}
          </Button>
          {hasInstalledSkills && (
            <>
              <Button variant="outline" size="icon" className="md:hidden" onClick={handleOpenSkillsFolder}>
                <FolderOpen className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="hidden md:flex" onClick={handleOpenSkillsFolder}>
                <FolderOpen className="h-4 w-4 mr-2" />
                {t('openFolder')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Gateway Warning */}
      {showGatewayWarning && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10">
          <CardContent className="py-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <span className="text-yellow-700 dark:text-yellow-400">
              {t('gatewayWarning')}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all" className="gap-2">
            <Puzzle className="h-4 w-4" />
            {t('tabs.installed')}
          </TabsTrigger>
          <TabsTrigger value="marketplace" className="gap-2">
            <Globe className="h-4 w-4" />
            {t('tabs.marketplace')}
          </TabsTrigger>
          <TabsTrigger value="bundles" className="gap-2">
            <Layers className="h-4 w-4" />
            Gói đề xuất
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4 md:space-y-6 mt-4 md:mt-6">
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <SearchInput
              placeholder={t('search')}
              value={searchQuery}
              onChange={setSearchQuery}
              fullWidth
            />

            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedSource === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedSource('all')}
              >
                All ({sourceStats.all})
              </Button>
              <Button
                variant={selectedSource === 'built-in' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedSource('built-in')}
                className="gap-1.5"
              >
                <Puzzle className="h-3 w-3" />
                {t('filter.builtIn', { count: sourceStats.builtIn })}
              </Button>
              <Button
                variant={selectedSource === 'marketplace' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedSource('marketplace')}
                className="gap-1.5"
              >
                <Globe className="h-3 w-3" />
                {t('filter.marketplace', { count: sourceStats.marketplace })}
              </Button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <Card className="border-destructive">
              <CardContent className="py-4 text-destructive flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                {error}
              </CardContent>
            </Card>
          )}

          {/* Skills Grid */}
          {filteredSkills.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Puzzle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">{t('noSkills')}</h3>
                <p className="text-muted-foreground">
                  {searchQuery ? t('noSkillsSearch') : t('noSkillsAvailable')}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredSkills.map((skill) => (
                <Card
                  key={skill.id}
                  className={cn(
                    'cursor-pointer hover:border-primary/50 transition-colors',
                    skill.enabled && 'border-primary/50 bg-primary/5'
                  )}
                  onClick={() => setSelectedSkill(skill)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {skill.icon
                          ? <span className="text-2xl">{skill.icon}</span>
                          : <Puzzle className="h-6 w-6 text-muted-foreground" />
                        }
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            {skill.name}
                            {skill.isCore ? (
                              <Lock className="h-3 w-3 text-muted-foreground" />
                            ) : skill.isBundled ? (
                              <Puzzle className="h-3 w-3 text-blue-500/70" />
                            ) : (
                              <Globe className="h-3 w-3 text-purple-500/70" />
                            )}
                          </CardTitle>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!skill.isBundled && !skill.isCore && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUninstall(skill.id);
                            }}
                            asChild
                          >
                            <motion.button whileTap={{ scale: 0.9 }}>
                              <Trash2 className="h-4 w-4" />
                            </motion.button>
                          </Button>
                        )}
                        <Switch
                          checked={skill.enabled}
                          onCheckedChange={(checked) => {
                            handleToggle(skill.id, checked);
                          }}
                          disabled={skill.isCore}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {skill.description}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {skill.version && (
                        <Badge variant="outline" className="text-xs">
                          v{skill.version}
                        </Badge>
                      )}
                      {skill.configurable && (
                        <Badge variant="secondary" className="text-xs">
                          <Settings className="h-3 w-3 mr-1" />
                          {t('detail.configurable')}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="marketplace" className="space-y-6 mt-6">
          <div className="flex flex-col gap-4">
            <Card className="border-muted/50 bg-muted/20">
              <CardContent className="py-4 flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="text-muted-foreground">
                  {t('marketplace.securityNote')}
                </div>
              </CardContent>
            </Card>
            <div className="flex gap-4">
              <form onSubmit={handleMarketplaceSearch} className="flex-1 flex gap-2">
                <SearchInput
                  placeholder={t('searchMarketplace')}
                  value={marketplaceQuery}
                  onChange={setMarketplaceQuery}
                  fullWidth
                />
                <Button type="submit" disabled={searching} className="min-w-[100px]" asChild>
                  <motion.button whileTap={{ scale: 0.98 }}>
                    <AnimatePresence mode="wait" initial={false}>
                      {searching ? (
                        <motion.div
                          key="searching"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center justify-center gap-1"
                        >
                          {[0, 1, 2].map((i) => (
                            <motion.span
                              key={i}
                              className="w-1.5 h-1.5 bg-current rounded-full"
                              animate={{
                                opacity: [0.3, 1, 0.3],
                                scale: [0.8, 1, 0.8],
                              }}
                              transition={{
                                duration: 0.8,
                                repeat: Infinity,
                                delay: i * 0.15,
                              }}
                            />
                          ))}
                        </motion.div>
                      ) : (
                        <motion.div
                          key="search"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          {t('searchButton')}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                </Button>
              </form>
            </div>

            {searchError && (
              <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="py-3 text-sm text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>{t('marketplace.searchError')}</span>
                </CardContent>
              </Card>
            )}

            {searchResults.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {searchResults.map((skill) => {
                  const isInstalled = skills.some(s => s.id === skill.slug || s.name === skill.name); // Simple check, ideally check by ID/slug
                  return (
                    <MarketplaceSkillCard
                      key={skill.slug}
                      skill={skill}
                      isInstalling={!!installing[skill.slug]}
                      isInstalled={isInstalled}
                      onInstall={() => handleInstall(skill.slug)}
                      onUninstall={() => handleUninstall(skill.slug)}
                    />
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">{t('marketplace.title')}</h3>
                  <p className="text-muted-foreground text-center max-w-sm">
                    {searching
                      ? t('marketplace.searching')
                      : marketplaceQuery
                        ? t('marketplace.noResults')
                        : t('marketplace.emptyPrompt')}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="bundles" className="space-y-4 mt-4 md:mt-6">
          <BundleCard
            installedSlugs={installedSlugs}
            installingMap={installing}
            onInstall={handleInstall}
            onInstallAll={handleInstallAll}
          />
        </TabsContent>
      </Tabs>



      {/* Skill Detail Dialog */}
      {selectedSkill && (
        <SkillDetailDialog
          skill={selectedSkill}
          onClose={() => setSelectedSkill(null)}
          onToggle={(enabled) => {
            handleToggle(selectedSkill.id, enabled);
            setSelectedSkill({ ...selectedSkill, enabled });
          }}
        />
      )}
    </div>
  );
}

export default Skills;
