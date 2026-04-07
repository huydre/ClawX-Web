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
import enUsb from './locales/en/usb.json';
import enFiles from './locales/en/files.json';
import enBrowser from './locales/en/browser.json';

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
import viUsb from './locales/vi/usb.json';
import viFiles from './locales/vi/files.json';
import viBrowser from './locales/vi/browser.json';

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
import jaUsb from './locales/ja/usb.json';
import jaFiles from './locales/ja/files.json';
import jaBrowser from './locales/ja/browser.json';

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
        usb: enUsb,
        files: enFiles,
        browser: enBrowser,
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
        usb: viUsb,
        files: viFiles,
        browser: viBrowser,
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
        usb: jaUsb,
        files: jaFiles,
        browser: jaBrowser,
    },
};

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: 'en', // will be overridden by settings store
        fallbackLng: 'en',
        defaultNS: 'common',
        ns: ['common', 'settings', 'dashboard', 'chat', 'channels', 'skills', 'cron', 'setup', 'agents', 'usb', 'files', 'browser'],
        interpolation: {
            escapeValue: false, // React already escapes
        },
        react: {
            useSuspense: false,
        },
    });

export default i18n;
