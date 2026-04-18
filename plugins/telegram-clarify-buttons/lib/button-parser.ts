/**
 * Parse [BUTTONS]...[/BUTTONS] block from agent message.
 *
 * Format:
 * Some question text
 * [BUTTONS]
 * Lỗi kỹ thuật | loi_ky_thuat
 * Tra cứu đơn | tra_cuu_don
 * ---
 * Tư vấn sản phẩm | tu_van
 * Vấn đề khác | khac
 * [/BUTTONS]
 *
 * Each line = one button: "display text | callback_data"
 * "---" = new row
 */

export interface ButtonItem {
  text: string;
  callback_data: string;
}

export interface ParsedButtons {
  message: string;
  buttons: ButtonItem[][];
}

export function parseButtons(text: string): ParsedButtons | null {
  const match = text.match(/\[BUTTONS\]([\s\S]*?)\[\/BUTTONS\]/i);
  if (!match) return null;

  const beforeButtons = text.substring(0, text.indexOf('[BUTTONS]')).trim();
  const afterButtons = text.substring(text.indexOf('[/BUTTONS]') + 10).trim();
  const message = [beforeButtons, afterButtons].filter(Boolean).join('\n').trim();

  const block = match[1].trim();
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean);

  const buttons: ButtonItem[][] = [[]];

  for (const line of lines) {
    if (line === '---') {
      buttons.push([]);
      continue;
    }

    const parts = line.split('|').map(p => p.trim());
    if (parts.length >= 2) {
      buttons[buttons.length - 1].push({
        text: parts[0],
        callback_data: parts[1],
      });
    } else if (parts[0]) {
      // No callback_data specified — use text as callback
      const cb = parts[0].toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
      buttons[buttons.length - 1].push({
        text: parts[0],
        callback_data: cb,
      });
    }
  }

  // Remove empty rows
  const filtered = buttons.filter(row => row.length > 0);
  if (filtered.length === 0) return null;

  return { message: message || 'Vui lòng chọn:', buttons: filtered };
}
