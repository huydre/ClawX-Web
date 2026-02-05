/**
 * Skills Page
 * Browse and manage AI skills
 */
import { useEffect, useState, useCallback } from 'react';
import { 
  Search, 
  Puzzle, 
  RefreshCw, 
  Lock, 
  Package,
  Info,
  X,
  Settings,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSkillsStore } from '@/stores/skills';
import { useGatewayStore } from '@/stores/gateway';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Skill, SkillCategory, SkillBundle } from '@/types/skill';

const categoryLabels: Record<SkillCategory, string> = {
  productivity: 'Productivity',
  developer: 'Developer',
  'smart-home': 'Smart Home',
  media: 'Media',
  communication: 'Communication',
  security: 'Security',
  information: 'Information',
  utility: 'Utility',
  custom: 'Custom',
};

const categoryIcons: Record<SkillCategory, string> = {
  productivity: '📋',
  developer: '💻',
  'smart-home': '🏠',
  media: '🎬',
  communication: '💬',
  security: '🔒',
  information: '📰',
  utility: '🔧',
  custom: '⚡',
};

// Predefined skill bundles
const skillBundles: SkillBundle[] = [
  {
    id: 'productivity',
    name: 'Productivity Pack',
    nameZh: '效率工具包',
    description: 'Essential tools for daily productivity including calendar, reminders, and notes',
    descriptionZh: '日常效率必备工具，包含日历、提醒和笔记',
    icon: '📋',
    skills: ['calendar', 'reminders', 'notes', 'tasks', 'timer'],
    recommended: true,
  },
  {
    id: 'developer',
    name: 'Developer Tools',
    nameZh: '开发者工具',
    description: 'Code assistance, git operations, and technical documentation lookup',
    descriptionZh: '代码辅助、Git 操作和技术文档查询',
    icon: '💻',
    skills: ['code-assist', 'git-ops', 'docs-lookup', 'snippet-manager'],
    recommended: true,
  },
  {
    id: 'information',
    name: 'Information Hub',
    nameZh: '信息中心',
    description: 'Stay informed with web search, news, weather, and knowledge base',
    descriptionZh: '通过网页搜索、新闻、天气和知识库保持信息畅通',
    icon: '📰',
    skills: ['web-search', 'news', 'weather', 'wikipedia', 'translate'],
  },
  {
    id: 'smart-home',
    name: 'Smart Home',
    nameZh: '智能家居',
    description: 'Control your smart home devices and automation routines',
    descriptionZh: '控制智能家居设备和自动化场景',
    icon: '🏠',
    skills: ['lights', 'thermostat', 'security-cam', 'routines'],
  },
];

// Skill detail dialog component
interface SkillDetailDialogProps {
  skill: Skill;
  onClose: () => void;
  onToggle: (enabled: boolean) => void;
}

function SkillDetailDialog({ skill, onClose, onToggle }: SkillDetailDialogProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-start justify-between">
          <div className="flex items-center gap-4">
            <span className="text-4xl">{skill.icon || '🔧'}</span>
            <div>
              <CardTitle className="flex items-center gap-2">
                {skill.name}
                {skill.isCore && <Lock className="h-4 w-4 text-muted-foreground" />}
              </CardTitle>
              <CardDescription>{categoryLabels[skill.category]}</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{skill.description}</p>
          
          <div className="flex flex-wrap gap-2">
            {skill.version && (
              <Badge variant="outline">v{skill.version}</Badge>
            )}
            {skill.author && (
              <Badge variant="secondary">by {skill.author}</Badge>
            )}
            {skill.isCore && (
              <Badge variant="secondary">
                <Lock className="h-3 w-3 mr-1" />
                Core Skill
              </Badge>
            )}
          </div>
          
          {skill.dependencies && skill.dependencies.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Dependencies:</p>
              <div className="flex flex-wrap gap-2">
                {skill.dependencies.map((dep) => (
                  <Badge key={dep} variant="outline">{dep}</Badge>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2">
              {skill.enabled ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="text-green-600 dark:text-green-400">Enabled</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                  <span className="text-muted-foreground">Disabled</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {skill.configurable && (
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Configure
                </Button>
              )}
              <Switch
                checked={skill.enabled}
                onCheckedChange={() => onToggle(!skill.enabled)}
                disabled={skill.isCore}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Bundle card component
interface BundleCardProps {
  bundle: SkillBundle;
  skills: Skill[];
  onApply: () => void;
}

function BundleCard({ bundle, skills, onApply }: BundleCardProps) {
  const bundleSkills = skills.filter((s) => bundle.skills.includes(s.id));
  const enabledCount = bundleSkills.filter((s) => s.enabled).length;
  const isFullyEnabled = bundleSkills.length > 0 && enabledCount === bundleSkills.length;
  
  return (
    <Card className={cn(
      'hover:border-primary/50 transition-colors cursor-pointer',
      isFullyEnabled && 'border-primary/50 bg-primary/5'
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{bundle.icon}</span>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {bundle.name}
                {bundle.recommended && (
                  <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Recommended
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                {enabledCount}/{bundleSkills.length} skills enabled
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {bundle.description}
        </p>
        <div className="flex flex-wrap gap-1">
          {bundleSkills.slice(0, 4).map((skill) => (
            <Badge 
              key={skill.id} 
              variant={skill.enabled ? 'default' : 'outline'} 
              className="text-xs"
            >
              {skill.icon} {skill.name}
            </Badge>
          ))}
          {bundleSkills.length > 4 && (
            <Badge variant="outline" className="text-xs">
              +{bundleSkills.length - 4} more
            </Badge>
          )}
        </div>
        <Button 
          variant={isFullyEnabled ? 'secondary' : 'default'} 
          size="sm" 
          className="w-full"
          onClick={onApply}
        >
          {isFullyEnabled ? 'Disable Bundle' : 'Enable Bundle'}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}

export function Skills() {
  const { skills, loading, error, fetchSkills, enableSkill, disableSkill } = useSkillsStore();
  const gatewayStatus = useGatewayStore((state) => state.status);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory | 'all'>('all');
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  
  const isGatewayRunning = gatewayStatus.state === 'running';
  
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
    const matchesCategory = selectedCategory === 'all' || skill.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });
  
  // Get unique categories with counts
  const categoryStats = skills.reduce((acc, skill) => {
    acc[skill.category] = (acc[skill.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Handle toggle
  const handleToggle = useCallback(async (skillId: string, enable: boolean) => {
    try {
      if (enable) {
        await enableSkill(skillId);
        toast.success('Skill enabled');
      } else {
        await disableSkill(skillId);
        toast.success('Skill disabled');
      }
    } catch (err) {
      toast.error(String(err));
    }
  }, [enableSkill, disableSkill]);
  
  // Handle bundle apply
  const handleBundleApply = useCallback(async (bundle: SkillBundle) => {
    const bundleSkills = skills.filter((s) => bundle.skills.includes(s.id));
    const allEnabled = bundleSkills.every((s) => s.enabled);
    
    try {
      for (const skill of bundleSkills) {
        if (allEnabled) {
          if (!skill.isCore) {
            await disableSkill(skill.id);
          }
        } else {
          if (!skill.enabled) {
            await enableSkill(skill.id);
          }
        }
      }
      toast.success(allEnabled ? 'Bundle disabled' : 'Bundle enabled');
    } catch {
      toast.error('Failed to apply bundle');
    }
  }, [skills, enableSkill, disableSkill]);
  
  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Skills</h1>
          <p className="text-muted-foreground">
            Browse and manage AI capabilities
          </p>
        </div>
        <Button variant="outline" onClick={fetchSkills} disabled={!isGatewayRunning}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
      
      {/* Gateway Warning */}
      {!isGatewayRunning && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10">
          <CardContent className="py-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <span className="text-yellow-700 dark:text-yellow-400">
              Gateway is not running. Skills cannot be loaded without an active Gateway.
            </span>
          </CardContent>
        </Card>
      )}
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all" className="gap-2">
            <Puzzle className="h-4 w-4" />
            All Skills
          </TabsTrigger>
          <TabsTrigger value="bundles" className="gap-2">
            <Package className="h-4 w-4" />
            Bundles
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="space-y-6 mt-6">
          {/* Search and Filter */}
          <div className="flex gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search skills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('all')}
              >
                All ({skills.length})
              </Button>
              {Object.entries(categoryStats).map(([category, count]) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category as SkillCategory)}
                  className="gap-1"
                >
                  <span>{categoryIcons[category as SkillCategory]}</span>
                  {categoryLabels[category as SkillCategory]} ({count})
                </Button>
              ))}
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
                <h3 className="text-lg font-medium mb-2">No skills found</h3>
                <p className="text-muted-foreground">
                  {searchQuery ? 'Try a different search term' : 'No skills available'}
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
                        <span className="text-2xl">{skill.icon || categoryIcons[skill.category]}</span>
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            {skill.name}
                            {skill.isCore && (
                              <Lock className="h-3 w-3 text-muted-foreground" />
                            )}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {categoryLabels[skill.category]}
                          </CardDescription>
                        </div>
                      </div>
                      <Switch
                        checked={skill.enabled}
                        onCheckedChange={(checked) => {
                          handleToggle(skill.id, checked);
                        }}
                        disabled={skill.isCore}
                        onClick={(e) => e.stopPropagation()}
                      />
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
                          Configurable
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="bundles" className="space-y-6 mt-6">
          <p className="text-muted-foreground">
            Skill bundles are pre-configured collections of skills for common use cases. 
            Enable a bundle to quickly set up multiple related skills at once.
          </p>
          
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {skillBundles.map((bundle) => (
              <BundleCard
                key={bundle.id}
                bundle={bundle}
                skills={skills}
                onApply={() => handleBundleApply(bundle)}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Statistics */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  {skills.filter((s) => s.enabled).length}
                </span>
                {' '}of {skills.length} skills enabled
              </span>
              <span className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  {skills.filter((s) => s.isCore).length}
                </span>
                {' '}core skills
              </span>
            </div>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <Info className="h-4 w-4 mr-1" />
              Learn about skills
            </Button>
          </div>
        </CardContent>
      </Card>
      
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
