/**
 * telegram-clarify-buttons — OpenClaw Plugin
 * Detects [BUTTONS]...[/BUTTONS] pattern in agent messages,
 * sends Telegram inline keyboard, converts callback to text.
 */
import { sendTelegramButtons, editTelegramMessage } from './lib/telegram-api.js';
import { parseButtons } from './lib/button-parser.js';

interface PluginContext {
  config: Record<string, any>;
  channels: Record<string, any>;
  log: (...args: any[]) => void;
}

interface MessageEvent {
  channel: string;
  channelAccountId?: string;
  to: string;
  text: string;
  replyTo?: string;
  sessionKey?: string;
}

export default function plugin(ctx: PluginContext) {
  const log = ctx.log || console.log;

  // Resolve bot token from plugin config or channel config
  const botToken =
    ctx.config?.botToken ||
    ctx.channels?.telegram?.botToken ||
    process.env.TELEGRAM_BOT_TOKEN || '';

  if (!botToken) {
    log('[clarify-buttons] WARNING: No bot token found. Plugin disabled.');
    return {};
  }

  log('[clarify-buttons] Plugin loaded, token:', botToken.substring(0, 10) + '...');

  return {
    hooks: {
      /**
       * Intercept outgoing messages.
       * If message contains [BUTTONS]...[/BUTTONS], replace with inline keyboard.
       */
      message_sending: async (event: MessageEvent) => {
        if (event.channel !== 'telegram') return event;

        const parsed = parseButtons(event.text);
        if (!parsed) return event; // No buttons pattern found

        log('[clarify-buttons] Detected buttons in message, sending inline keyboard');

        try {
          await sendTelegramButtons(botToken, event.to, parsed.message, parsed.buttons);

          // Return null/empty to prevent original text from being sent
          // Or return modified event without buttons markup
          return {
            ...event,
            text: '', // Suppress original message (already sent via API)
            _suppress: true,
          };
        } catch (err) {
          log('[clarify-buttons] Failed to send buttons, falling back to text:', err);
          // Fallback: send original text without button markup
          return {
            ...event,
            text: parsed.message + '\n\n' + parsed.buttons.flat().map(b => `• ${b.text}`).join('\n'),
          };
        }
      },
    },
  };
}
