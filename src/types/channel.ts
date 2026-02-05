/**
 * Channel Type Definitions
 * Types for messaging channels (WhatsApp, Telegram, etc.)
 */

/**
 * Supported channel types
 */
export type ChannelType = 'whatsapp' | 'telegram' | 'discord' | 'slack' | 'wechat';

/**
 * Channel connection status
 */
export type ChannelStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

/**
 * Channel data structure
 */
export interface Channel {
  id: string;
  type: ChannelType;
  name: string;
  status: ChannelStatus;
  lastActivity?: string;
  error?: string;
  avatar?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Channel configuration for each type
 */
export interface ChannelConfig {
  whatsapp: {
    phoneNumber?: string;
  };
  telegram: {
    botToken?: string;
    chatId?: string;
  };
  discord: {
    botToken?: string;
    guildId?: string;
  };
  slack: {
    botToken?: string;
    appToken?: string;
  };
  wechat: {
    appId?: string;
  };
}

/**
 * Channel icons mapping
 */
export const CHANNEL_ICONS: Record<ChannelType, string> = {
  whatsapp: '📱',
  telegram: '✈️',
  discord: '🎮',
  slack: '💼',
  wechat: '💬',
};

/**
 * Channel display names
 */
export const CHANNEL_NAMES: Record<ChannelType, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  discord: 'Discord',
  slack: 'Slack',
  wechat: 'WeChat',
};
