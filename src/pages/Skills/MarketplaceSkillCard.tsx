/**
 * MarketplaceSkillCard - Marketplace skill card component
 */
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  Sparkles,
  Download,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { MarketplaceSkill } from '@/types/skill';

// ── Types ─────────────────────────────────────────────────────────

export interface MarketplaceSkillCardProps {
  skill: MarketplaceSkill;
  isInstalling: boolean;
  isInstalled: boolean;
  onInstall: () => void;
  onUninstall: () => void;
}

// ── Component ─────────────────────────────────────────────────────

export function MarketplaceSkillCard({
  skill,
  isInstalling,
  isInstalled,
  onInstall,
  onUninstall
}: MarketplaceSkillCardProps) {
  const handleCardClick = () => {
    window.electron.ipcRenderer.invoke('shell:openExternal', `https://clawhub.ai/s/${skill.slug}`);
  };

  return (
    <Card
      className="hover:border-primary/50 transition-colors cursor-pointer group"
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base group-hover:text-primary transition-colors">{skill.name}</CardTitle>
              <CardDescription className="text-xs flex items-center gap-2">
                <span>v{skill.version}</span>
                {skill.author && (
                  <>
                    <span>•</span>
                    <span>{skill.author}</span>
                  </>
                )}
              </CardDescription>
            </div>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <AnimatePresence mode="wait">
              {isInstalled ? (
                <motion.div
                  key="uninstall"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onUninstall}
                    disabled={isInstalling}
                    asChild
                  >
                    <motion.button whileTap={{ scale: 0.9 }}>
                      {isInstalling ? (
                        <div className="flex items-center justify-center gap-0.5">
                          {[0, 1, 2].map((i) => (
                            <motion.span
                              key={i}
                              className="w-1 h-1 bg-current rounded-full"
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
                        </div>
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </motion.button>
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="install"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Button
                    variant="default"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onInstall}
                    disabled={isInstalling}
                    asChild
                  >
                    <motion.button whileTap={{ scale: 0.9 }}>
                      {isInstalling ? (
                        <div className="flex items-center justify-center gap-0.5">
                          {[0, 1, 2].map((i) => (
                            <motion.span
                              key={i}
                              className="w-1 h-1 bg-current rounded-full"
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
                        </div>
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </motion.button>
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {skill.description}
        </p>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {skill.downloads !== undefined && (
            <div className="flex items-center gap-1">
              <Download className="h-3 w-3" />
              {skill.downloads.toLocaleString()}
            </div>
          )}
          {skill.stars !== undefined && (
            <div className="flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              {skill.stars.toLocaleString()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
