/**
 * Ticket Button — floating support button on Chat page
 * Shows tooltip once per session, click → form → QR payment
 */
import { useState, useRef, useEffect } from 'react';
import { Upload, Send, CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModalDialog } from '@/components/common/ModalDialog';
import { cn } from '@/lib/utils';

type TicketState = 'idle' | 'form' | 'submitting' | 'done';

const TOOLTIP_KEY = 'ticket_tooltip_dismissed';

/** ClawX mascot icon with CSS animations */
function MascotIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <style>{`
        @keyframes claw-wave {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-15deg); }
          75% { transform: rotate(15deg); }
        }
        @keyframes eye-blink {
          0%, 90%, 100% { transform: scaleY(1); }
          95% { transform: scaleY(0.1); }
        }
        @keyframes body-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes antenna-wiggle {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(5deg); }
        }
        .mascot-body { animation: body-bounce 2s ease-in-out infinite; }
        .mascot-claw-l { animation: claw-wave 2.5s ease-in-out infinite; transform-origin: 25px 50px; }
        .mascot-claw-r { animation: claw-wave 2.5s ease-in-out infinite 0.3s; transform-origin: 95px 50px; }
        .mascot-eye { animation: eye-blink 4s ease-in-out infinite; transform-origin: center; }
        .mascot-antenna { animation: antenna-wiggle 3s ease-in-out infinite; }
      `}</style>
      <g className="mascot-body">
        <path d="M60 10 C30 10 15 35 15 55 C15 75 30 95 45 100 L45 110 L55 110 L55 100 C55 100 60 102 65 100 L65 110 L75 110 L75 100 C90 95 105 75 105 55 C105 35 90 10 60 10Z" fill="#e53e3e" />
      </g>
      <g className="mascot-claw-l">
        <path d="M20 45 C5 40 0 50 5 60 C10 70 20 65 25 55 C28 48 25 45 20 45Z" fill="#e53e3e" />
      </g>
      <g className="mascot-claw-r">
        <path d="M100 45 C115 40 120 50 115 60 C110 70 100 65 95 55 C92 48 95 45 100 45Z" fill="#e53e3e" />
      </g>
      <g className="mascot-antenna" style={{ transformOrigin: '45px 15px' }}>
        <path d="M45 15 Q35 5 30 8" stroke="#ff6b6b" strokeWidth="2" strokeLinecap="round" />
      </g>
      <g className="mascot-antenna" style={{ transformOrigin: '75px 15px' }}>
        <path d="M75 15 Q85 5 90 8" stroke="#ff6b6b" strokeWidth="2" strokeLinecap="round" />
      </g>
      <g className="mascot-eye" style={{ transformOrigin: '45px 35px' }}>
        <circle cx="45" cy="35" r="6" fill="#050810" />
        <circle cx="46" cy="34" r="2" fill="#00e5cc" />
      </g>
      <g className="mascot-eye" style={{ transformOrigin: '75px 35px' }}>
        <circle cx="75" cy="35" r="6" fill="#050810" />
        <circle cx="76" cy="34" r="2" fill="#00e5cc" />
      </g>
    </svg>
  );
}

export function TicketButton() {
  const [state, setState] = useState<TicketState>('idle');
  const [description, setDescription] = useState('');
  const [contact, setContact] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [ticketId, setTicketId] = useState('');
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
    setTicketId('');
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

      if (data.success || data.ok) {
        setTicketId(data.ticket?.shortId || data.ticket_id?.substring(0, 8).toUpperCase() || '');
        setState('done');
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
        {/* Chat bubble from mascot */}
        {showTooltip && (
          <div className="absolute bottom-16 right-0 w-60 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-popover border rounded-2xl shadow-xl p-3 relative">
              <button
                onClick={dismissTooltip}
                className="absolute top-2 right-2 p-0.5 rounded-full hover:bg-accent transition-colors"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <div className="flex items-start gap-2 pr-5">
                <span className="text-lg shrink-0">&#128075;</span>
                <div>
                  <p className="text-sm font-medium mb-0.5">Xin chào!</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Bạn đang gặp sự cố? Mình có thể giúp bạn xử lý nhanh chóng.
                  </p>
                </div>
              </div>
              {/* Chat tail pointing to mascot */}
              <div className="absolute -bottom-2 right-6 w-4 h-4 bg-popover border-r border-b rotate-45 rounded-br-sm" />
            </div>
          </div>
        )}

        <button
          onClick={() => {
            dismissTooltip();
            setState('form');
          }}
          className={cn(
            'w-12 h-12 md:w-14 md:h-14',
            'flex items-center justify-center',
            'hover:scale-110 transition-transform drop-shadow-lg'
          )}
          title="Cần hỗ trợ?"
        >
          <MascotIcon className="w-full h-full" />
        </button>
      </div>
    );
  }

  return (
    <ModalDialog
      open={state !== 'idle'}
      onClose={reset}
      title={state === 'done' ? 'Thành công' : 'Hỗ trợ nhanh'}
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

          {error && <div className="text-sm text-destructive">{error}</div>}

          <Button className="w-full" onClick={handleSubmit} disabled={state === 'submitting'}>
            {state === 'submitting' ? 'Đang gửi...' : (
              <><Send className="h-4 w-4 mr-2" /> Gửi yêu cầu hỗ trợ</>
            )}
          </Button>
        </div>
      )}

      {/* Success */}
      {state === 'done' && (
        <div className="space-y-4 text-center py-4">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
          <div>
            <p className="text-lg font-medium">Đã gửi yêu cầu!</p>
            {ticketId && (
              <p className="text-sm text-muted-foreground mt-1">Mã ticket: #{ticketId}</p>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            CSKH sẽ liên hệ với bạn sớm nhất khi nhận được yêu cầu. Cảm ơn bạn!
          </p>
          <Button variant="outline" onClick={reset} className="w-full">Đóng</Button>
        </div>
      )}
    </ModalDialog>
  );
}
