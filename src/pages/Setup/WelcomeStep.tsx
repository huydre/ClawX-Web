import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSettingsStore } from '@/stores/settings';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import clawxIcon from '@/assets/logo.svg';

export function WelcomeContent() {
  const { t } = useTranslation(['setup', 'settings']);
  const { language, setLanguage } = useSettingsStore();

  return (
    <div className="text-center space-y-4">
      <div className="mb-4 flex justify-center">
        <img src={clawxIcon} alt="ClawX" className="h-16 w-16" />
      </div>
      <h2 className="text-xl font-semibold">{t('welcome.title')}</h2>
      <p className="text-muted-foreground">
        {t('welcome.description')}
      </p>

      {/* Language Selector */}
      <div className="flex justify-center gap-2 py-2">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <Button
            key={lang.code}
            variant={language === lang.code ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setLanguage(lang.code)}
            className="h-7 text-xs"
          >
            {lang.label}
          </Button>
        ))}
      </div>

      <ul className="text-left space-y-2 text-muted-foreground pt-2">
        <li className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-400" />
          {t('welcome.features.noCommand')}
        </li>
        <li className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-400" />
          {t('welcome.features.modernUI')}
        </li>
        <li className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-400" />
          {t('welcome.features.bundles')}
        </li>
        <li className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-400" />
          {t('welcome.features.crossPlatform')}
        </li>
      </ul>
    </div>
  );
}
