/**
 * ChannelIcon - Renders a professional brand SVG icon for a channel type.
 * Uses simple-icons for supported brands, custom SVGs for others.
 */
import {
  siTelegram,
  siWhatsapp,
  siDiscord,
  siSignal,
  siImessage,
  siLine,
  siMattermost,
  siGooglechat,
  siMatrix,
} from 'simple-icons';
import { cn } from '@/lib/utils';
import type { ChannelType } from '@/types/channel';

interface ChannelIconProps {
  type: ChannelType | string;
  className?: string;
  /** Override the brand color fill (default: brand color) */
  color?: string;
  /** Use monochrome (currentColor) instead of brand color */
  mono?: boolean;
}

// simple-icons icon data per channel
const SIMPLE_ICONS: Record<string, { path: string; hex: string }> = {
  telegram: siTelegram,
  whatsapp: siWhatsapp,
  discord: siDiscord,
  signal: siSignal,
  imessage: siImessage,
  line: siLine,
  mattermost: siMattermost,
  googlechat: siGooglechat,
  matrix: siMatrix,
};

// Custom SVG paths for brands not in simple-icons
const CUSTOM_ICONS: Record<string, { path: string; hex: string; viewBox?: string }> = {
  // Microsoft Teams — stylized T with Microsoft purple
  msteams: {
    hex: '6264A7',
    path: 'M19.5 4.5h-6A1.5 1.5 0 0 0 12 6v.75H8.25A2.25 2.25 0 0 0 6 9v7.5a2.25 2.25 0 0 0 2.25 2.25H15a2.25 2.25 0 0 0 2.25-2.25v-.75H19.5A1.5 1.5 0 0 0 21 15V6a1.5 1.5 0 0 0-1.5-1.5zm-4.5 12a.75.75 0 0 1-.75.75H8.25A.75.75 0 0 1 7.5 16.5V9a.75.75 0 0 1 .75-.75H12v6.75A1.5 1.5 0 0 0 13.5 16.5zm4.5-1.5h-2.25V9A2.25 2.25 0 0 0 15 6.75V6H19.5z',
    viewBox: '0 0 24 24',
  },
  // Feishu / Lark — stylized leaf/wing icon
  feishu: {
    hex: '3370FF',
    path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l7 4.5-7 4.5z',
    viewBox: '0 0 24 24',
  },
  // Zalo — stylized Z in a chat bubble
  openzalo: {
    hex: '0068FF',
    path: 'M12.49 10.272v-.45h1.347v6.322h-.77l-.19-.49a3.3 3.3 0 0 1-2.098.69 3.361 3.361 0 0 1 0-6.722 3.26 3.26 0 0 1 1.711.65zm-1.572 5.431c1.24 0 1.6-.96 1.6-2.72 0-1.76-.4-2.72-1.6-2.72-1.2 0-1.6.96-1.6 2.72 0 1.76.44 2.72 1.6 2.72zM4.58 7.879V6.652h4.726v1l-3.208 4.16h3.37v1.226H4.42v-1l3.207-4.16H4.58zM17.4 13.038h1.347V6.652H17.4v6.386zM16.53 16.144a3.261 3.261 0 1 1 0-6.522 3.261 3.261 0 0 1 0 6.522zm0-1.301a1.96 1.96 0 1 0 0-3.92 1.96 1.96 0 0 0 0 3.92z',
    viewBox: '0 0 24 24',
  },
};

export function ChannelIcon({ type, className, color, mono = false }: ChannelIconProps) {
  const simpleIcon = SIMPLE_ICONS[type];
  const customIcon = CUSTOM_ICONS[type];
  const iconData = simpleIcon || customIcon;

  if (!iconData) {
    // Fallback: generic message icon
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className={cn('inline-block', className)}
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    );
  }

  const fill = mono ? 'currentColor' : (color || `#${iconData.hex}`);
  const viewBox = ('viewBox' in iconData && iconData.viewBox) ? iconData.viewBox : '0 0 24 24';

  return (
    <svg
      viewBox={viewBox}
      fill={fill}
      className={cn('inline-block', className)}
      aria-hidden="true"
      role="img"
    >
      <path d={iconData.path} />
    </svg>
  );
}
