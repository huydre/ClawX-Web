/**
 * BundleCard - Recommended Skills Bundle component
 */
import {
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  Download,
  Zap,
  Info,
  Star,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────

export interface RecommendedSkillDef {
  slug: string;
  name: string;
  description: string;
  icon: string;
  downloads?: number;
  difficulty: 1 | 2 | 3;
  note?: string;
}

export interface BundleCardProps {
  installedSlugs: Set<string>;
  installingMap: Record<string, boolean>;
  onInstall: (slug: string) => Promise<void>;
  onInstallAll: () => Promise<void>;
}

// ── Helper ────────────────────────────────────────────────────────

function DifficultyStars({ level }: { level: 1 | 2 | 3 }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3].map((i) => (
        <Star
          key={i}
          className={cn(
            'h-2.5 w-2.5',
            i <= level ? 'fill-amber-400 text-amber-400' : 'fill-muted text-muted',
          )}
        />
      ))}
    </span>
  );
}

// ── Data ──────────────────────────────────────────────────────────

export const RECOMMENDED_SKILLS: RecommendedSkillDef[] = [
  {
    slug: 'summarize',
    name: 'Summarize',
    description: 'Tóm tắt tài liệu dài, email, báo cáo thành nội dung ngắn gọn',
    icon: '🔍',
    downloads: 10956,
    difficulty: 1,
  },
  {
    slug: 'weather',
    name: 'Weather',
    description: 'Thời tiết theo vị trí, tích hợp vào briefing buổi sáng',
    icon: '🌤️',
    downloads: 9002,
    difficulty: 1,
  },
  {
    slug: 'humanize-ai-text',
    name: 'Humanize AI Text',
    description: 'Chuyển văn bản AI thành giọng văn tự nhiên — viết mô tả sản phẩm, content marketing',
    icon: '✍️',
    downloads: 8771,
    difficulty: 1,
  },
  {
    slug: 'news-aggregator',
    name: 'News Aggregator',
    description: 'Tổng hợp tin tức từ nhiều nguồn, hỗ trợ RSS feed tùy chỉnh',
    icon: '📰',
    difficulty: 1,
  },
  {
    slug: 'proactive-agent',
    name: 'Proactive Agent',
    description: 'Trợ lý chủ động — tự gửi briefing sáng, nhắc nhở lịch, cập nhật đơn hàng',
    icon: '🤖',
    downloads: 7010,
    difficulty: 2,
  },
  {
    slug: 'tavily',
    name: 'Tavily Web Search',
    description: 'Tìm kiếm web nâng cao với kết quả có cấu trúc, phù hợp để AI xử lý',
    icon: '🔎',
    downloads: 8142,
    difficulty: 2,
    note: 'Cần Tavily API key miễn phí',
  },
  {
    slug: 'obsidian',
    name: 'Obsidian',
    description: 'Tạo, tìm kiếm, tổ chức ghi chú bằng ngôn ngữ tự nhiên — "bộ não thứ hai"',
    icon: '📝',
    downloads: 5791,
    difficulty: 2,
  },
  {
    slug: 'gog',
    name: 'Gog — Google Workspace',
    description: 'Gmail, Calendar, Drive, Contacts, Sheets, Docs — bộ tích hợp chính thức của @steipete',
    icon: '🔄',
    downloads: 14313,
    difficulty: 2,
  },
  {
    slug: 'agent-browser',
    name: 'Agent Browser',
    description: 'Tự động duyệt web, điền form, thu thập dữ liệu từ website',
    icon: '🌐',
    downloads: 11836,
    difficulty: 2,
    note: 'Khuyến nghị 4GB+ RAM',
  },
  {
    slug: 'openclaw-homeassistant',
    name: 'Home Assistant',
    description: 'Điều khiển đèn, điều hòa, khóa cửa qua Home Assistant API',
    icon: '🏠',
    difficulty: 3,
    note: 'Cần Home Assistant server riêng',
  },
];

// ── Component ─────────────────────────────────────────────────────

export function BundleCard({ installedSlugs, installingMap, onInstall, onInstallAll }: BundleCardProps) {
  const uninstalledCount = RECOMMENDED_SKILLS.filter(s => !installedSlugs.has(s.slug)).length;
  const isAnyInstalling = Object.values(installingMap).some(Boolean);

  return (
    <div className="space-y-4">
      {/* Header card */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-purple-500/5">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Layers className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Bộ Skill Thiết Yếu Cho Trợ Lý AI</h3>
                <p className="text-sm text-muted-foreground">
                  {RECOMMENDED_SKILLS.length - uninstalledCount}/{RECOMMENDED_SKILLS.length} skill đã cài •{' '}
                  Chọn lọc theo quy tắc 100/3
                </p>
              </div>
            </div>
            {uninstalledCount > 0 && (
              <Button
                onClick={onInstallAll}
                disabled={isAnyInstalling}
                className="gap-2 shrink-0"
                size="sm"
              >
                {isAnyInstalling ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Đang cài...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Cài tất cả ({uninstalledCount})
                  </>
                )}
              </Button>
            )}
            {uninstalledCount === 0 && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-medium">Đã cài đầy đủ</span>
              </div>
            )}
          </div>

          {/* Security notice */}
          <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2.5">
            <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0 text-yellow-500" />
            <span>Áp dụng quy tắc 100/3: chỉ skill có 100+ downloads và tồn tại 3+ tháng. Luôn kiểm tra VirusTotal trước khi cài.</span>
          </div>
        </CardContent>
      </Card>

      {/* Skill rows */}
      <div className="space-y-2">
        {RECOMMENDED_SKILLS.map((skill) => {
          const isInstalled = installedSlugs.has(skill.slug);
          const isInstalling = !!installingMap[skill.slug];

          return (
            <Card
              key={skill.slug}
              className={cn(
                'transition-colors',
                isInstalled && 'border-primary/30 bg-primary/5',
              )}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <span className="text-xl w-7 text-center shrink-0">{skill.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-medium text-sm">{skill.name}</span>
                      <DifficultyStars level={skill.difficulty} />
                      {skill.downloads && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Download className="h-3 w-3" />
                          {skill.downloads.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{skill.description}</p>
                    {skill.note && (
                      <p className="text-[10px] text-yellow-600 dark:text-yellow-400 flex items-center gap-1 mt-0.5">
                        <Info className="h-2.5 w-2.5 shrink-0" />
                        {skill.note}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {isInstalled ? (
                      <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-xs hidden sm:inline">Đã cài</span>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => onInstall(skill.slug)}
                        disabled={isInstalling}
                      >
                        {isInstalling ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <Download className="h-3 w-3" />
                        )}
                        <span className="hidden sm:inline">{isInstalling ? 'Đang cài...' : 'Cài'}</span>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
