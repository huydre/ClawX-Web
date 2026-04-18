/**
 * Telegram Bot API — send message with inline keyboard.
 * Zero dependencies, uses Node.js built-in fetch.
 */

interface ButtonItem {
  text: string;
  callback_data: string;
}

const API_BASE = 'https://api.telegram.org/bot';

async function callTelegram(token: string, method: string, body: Record<string, any>): Promise<any> {
  const res = await fetch(`${API_BASE}${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description || JSON.stringify(data)}`);
  }
  return data.result;
}

/**
 * Send a message with inline keyboard buttons.
 */
export async function sendTelegramButtons(
  token: string,
  chatId: string,
  text: string,
  buttons: ButtonItem[][],
): Promise<number> {
  const result = await callTelegram(token, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: buttons.map(row =>
        row.map(btn => ({
          text: btn.text,
          callback_data: btn.callback_data,
        }))
      ),
    },
  });
  return result.message_id;
}

/**
 * Edit a message (e.g., after button click — remove buttons, show result).
 */
export async function editTelegramMessage(
  token: string,
  chatId: string,
  messageId: number,
  text: string,
): Promise<void> {
  await callTelegram(token, 'editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
  });
}
