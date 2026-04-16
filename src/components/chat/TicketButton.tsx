/**
 * Ticket Button — floating support button on Chat page
 * Shows tooltip once per session, click → form → QR payment
 */
import { useState, useRef, useEffect } from 'react';
import { Upload, Send, CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModalDialog } from '@/components/common/ModalDialog';
import { cn } from '@/lib/utils';

type TicketState = 'idle' | 'form' | 'submitting' | 'qr';

interface TicketResult {
  ticketId: string;
  shortId: string;
  qrUrl: string;
}

const TOOLTIP_KEY = 'ticket_tooltip_dismissed';

/** ClawX mascot icon for support button */
function MascotIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M60 10 C30 10 15 35 15 55 C15 75 30 95 45 100 L45 110 L55 110 L55 100 C55 100 60 102 65 100 L65 110 L75 110 L75 100 C90 95 105 75 105 55 C105 35 90 10 60 10Z" fill="#e53e3e" />
      <path d="M20 45 C5 40 0 50 5 60 C10 70 20 65 25 55 C28 48 25 45 20 45Z" fill="#e53e3e" />
      <path d="M100 45 C115 40 120 50 115 60 C110 70 100 65 95 55 C92 48 95 45 100 45Z" fill="#e53e3e" />
      <path d="M45 15 Q35 5 30 8" stroke="#ff6b6b" strokeWidth="2" strokeLinecap="round" />
      <path d="M75 15 Q85 5 90 8" stroke="#ff6b6b" strokeWidth="2" strokeLinecap="round" />
      <circle cx="45" cy="35" r="6" fill="#050810" />
      <circle cx="75" cy="35" r="6" fill="#050810" />
      <circle cx="46" cy="34" r="2" fill="#00e5cc" />
      <circle cx="76" cy="34" r="2" fill="#00e5cc" />
    </svg>
  );
}

export function TicketButton() {
  const [state, setState] = useState<TicketState>('idle');
  const [description, setDescription] = useState('');
  const [contact, setContact] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<TicketResult | null>(null);
  const [error, setError] = useState('');
  const [showTooltip, setShowTooltip] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Show tooltip once per session (after 3s delay, dismiss on click)
  useEffect(() => {
    const dismissed = sessionStorage.getItem(TOOLTIP_KEY);
    if (dismissed) return;

    const timer = setTimeout(() => setShowTooltip(true), 3000);
    // Auto-hide after 8s
    const hideTimer = setTimeout(() => {
      setShowTooltip(false);
      sessionStorage.setItem(TOOLTIP_KEY, '1');
    }, 11000);

    return () => { clearTimeout(timer); clearTimeout(hideTimer); };
  }, []);

  const dismissTooltip = () => {
    setShowTooltip(false);
    sessionStorage.setItem(TOOLTIP_KEY, '1');
  };

  const reset = () => {
    setState('idle');
    setDescription('');
    setContact('');
    setFiles([]);
    setResult(null);
    setError('');
  };

  const handleSubmit = async () => {
    if (description.trim().length < 10) {
      setError('Mô tả cần ít nhất 10 ký tự');
      return;
    }
    setState('submitting');
    setError('');

    try {
      const formData = new FormData();
      formData.append('description', description.trim());
      if (contact) formData.append('contact_info', contact);
      files.forEach(f => formData.append('files', f));

      const res = await fetch('/api/tickets', { method: 'POST', body: formData });
      const data = await res.json();

      if (data.success) {
        setResult({
          ticketId: data.ticket.id,
          shortId: data.ticket.shortId,
          qrUrl: data.qrUrl,
        });
        setState('qr');
      } else {
        setError(data.error || 'Gửi thất bại');
        setState('form');
      }
    } catch (err) {
      setError(String(err));
      setState('form');
    }
  };

  // Floating button + tooltip
  if (state === 'idle') {
    return (
      <div className="fixed bottom-36 md:bottom-6 right-4 z-40">
        {/* Tooltip bubble */}
        {showTooltip && (
          <div className="absolute bottom-14 right-0 w-56 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-popover border rounded-lg shadow-lg p-3 relative">
              <button
                onClick={dismissTooltip}
                className="absolute top-1 right-1 p-0.5 rounded hover:bg-accent"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
              <p className="text-sm pr-4">
                Bạn cần hỗ trợ? Nhấn vào đây để gửi yêu cầu.
              </p>
              <div className="absolute bottom-0 right-5 translate-y-1/2 rotate-45 w-2.5 h-2.5 bg-popover border-r border-b" />
            </div>
          </div>
        )}

        <button
          onClick={() => {
            dismissTooltip();
            setState('form');
          }}
          className={cn(
            'w-10 h-10 md:w-12 md:h-12 rounded-full shadow-lg',
            'bg-primary text-primary-foreground',
            'flex items-center justify-center',
            'hover:scale-110 transition-transform'
          )}
          title="Cần hỗ trợ?"
        >
          <MascotIcon className="h-7 w-7 md:h-8 md:w-8" />
        </button>
      </div>
    );
  }

  return (
    <ModalDialog
      open={state !== 'idle'}
      onClose={reset}
      title={state === 'qr' ? 'Thanh toán' : 'Hỗ trợ nhanh'}
      maxWidth="sm"
    >
      {/* Form */}
      {(state === 'form' || state === 'submitting') && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Mô tả lỗi *</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Mô tả chi tiết lỗi bạn gặp phải..."
              rows={4}
              className="w-full mt-1 rounded-md border border-input px-3 py-2 text-sm bg-background focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Thông tin liên hệ</label>
            <input
              type="text"
              value={contact}
              onChange={e => setContact(e.target.value)}
              placeholder="SĐT, Zalo, Email..."
              className="w-full mt-1 h-9 rounded-md border border-input px-3 text-sm bg-background"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Ảnh / Video đính kèm</label>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={e => setFiles(Array.from(e.target.files || []))}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              className="mt-1 w-full"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Chọn file ({files.length} đã chọn)
            </Button>
            {files.length > 0 && (
              <div className="mt-2 text-xs text-muted-foreground space-y-1">
                {files.map((f, i) => (
                  <div key={i}>{f.name} ({(f.size / 1024).toFixed(0)} KB)</div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t pt-3 flex items-center justify-between">
            <span className="text-sm font-medium">Chi phí hỗ trợ</span>
            <span className="text-lg font-bold text-primary">500,000 VND</span>
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}

          <Button className="w-full" onClick={handleSubmit} disabled={state === 'submitting'}>
            {state === 'submitting' ? 'Đang gửi...' : (
              <><Send className="h-4 w-4 mr-2" /> Gửi yêu cầu hỗ trợ</>
            )}
          </Button>
        </div>
      )}

      {/* QR Payment */}
      {state === 'qr' && result && (
        <div className="space-y-4 text-center">
          <div className="flex items-center justify-center gap-2 text-green-500">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Ticket #{result.shortId}</span>
          </div>

          <p className="text-sm text-muted-foreground">
            Quét QR để thanh toán. Sau khi thanh toán, admin sẽ xác nhận và liên hệ hỗ trợ bạn.
          </p>

          <img
            src={result.qrUrl}
            alt="QR Thanh toán"
            className="mx-auto w-64 h-64 rounded-lg border"
          />

          <div className="text-xs text-muted-foreground space-y-1">
            <div>Ngân hàng: Techcombank</div>
            <div>STK: MS01T17213302551927</div>
            <div>Nội dung: TICKET{result.shortId}</div>
            <div>Số tiền: 500,000 VND</div>
          </div>

          <Button variant="outline" onClick={reset} className="w-full">Đóng</Button>
        </div>
      )}
    </ModalDialog>
  );
}
