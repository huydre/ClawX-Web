import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// EN
import enCommon from './locales/en/common.json';
import enSettings from './locales/en/settings.json';
import enDashboard from './locales/en/dashboard.json';
import enChat from './locales/en/chat.json';
import enChannels from './locales/en/channels.json';
import enSkills from './locales/en/skills.json';
import enCron from './locales/en/cron.json';
import enSetup from './locales/en/setup.json';
import enAgents from './locales/en/agents.json';

// VI
import viCommon from './locales/vi/common.json';
import viSettings from './locales/vi/settings.json';
import viDashboard from './locales/vi/dashboard.json';
import viChat from './locales/vi/chat.json';
import viChannels from './locales/vi/channels.json';
import viSkills from './locales/vi/skills.json';
import viCron from './locales/vi/cron.json';
import viSetup from './locales/vi/setup.json';
import viAgents from './locales/vi/agents.json';

// JA
import jaCommon from './locales/ja/common.json';
import jaSettings from './locales/ja/settings.json';
import jaDashboard from './locales/ja/dashboard.json';
import jaChat from './locales/ja/chat.json';
import jaChannels from './locales/ja/channels.json';
import jaSkills from './locales/ja/skills.json';
import jaCron from './locales/ja/cron.json';
import jaSetup from './locales/ja/setup.json';
import jaAgents from './locales/ja/agents.json';

export const SUPPORTED_LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'vi', label: 'Tiếng Việt' },
    { code: 'ja', label: '日本語' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

const resources = {
    en: {
        common: enCommon,
        settings: enSettings,
        dashboard: enDashboard,
        chat: enChat,
        channels: enChannels,
        skills: enSkills,
        cron: enCron,
        setup: enSetup,
        agents: enAgents,
    },
    vi: {
        common: viCommon,
        settings: viSettings,
        dashboard: viDashboard,
        chat: viChat,
        channels: viChannels,
        skills: viSkills,
        cron: viCron,
        setup: viSetup,
        agents: viAgents,
    },
    ja: {
        common: jaCommon,
        settings: jaSettings,
        dashboard: jaDashboard,
        chat: jaChat,
        channels: jaChannels,
        skills: jaSkills,
        cron: jaCron,
        setup: jaSetup,
        agents: jaAgents,
    },
};

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: 'en', // will be overridden by settings store
        fallbackLng: 'en',
        defaultNS: 'common',
        ns: ['common', 'settings', 'dashboard', 'chat', 'channels', 'skills', 'cron', 'setup', 'agents'],
        interpolation: {
            escapeValue: false, // React already escapes
        },
        react: {
            useSuspense: false,
        },
    });

export default i18n;
