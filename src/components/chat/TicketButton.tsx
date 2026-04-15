/**
 * Ticket Button — floating support button on Chat page
 * Click → popup form (describe bug + attach files) → submit → show QR payment
 */
import { useState, useRef } from 'react';
import { LifeBuoy, Upload, Send, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModalDialog } from '@/components/common/ModalDialog';
import { cn } from '@/lib/utils';

type TicketState = 'idle' | 'form' | 'submitting' | 'qr';

interface TicketResult {
  ticketId: string;
  shortId: string;
  qrUrl: string;
}

export function TicketButton() {
  const [state, setState] = useState<TicketState>('idle');
  const [description, setDescription] = useState('');
  const [contact, setContact] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<TicketResult | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

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
      setError('Mo ta can it nhat 10 ky tu');
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
        setError(data.error || 'Gui that bai');
        setState('form');
      }
    } catch (err) {
      setError(String(err));
      setState('form');
    }
  };

  // Floating button
  if (state === 'idle') {
    return (
      <button
        onClick={() => setState('form')}
        className={cn(
          'fixed bottom-20 md:bottom-6 right-4 z-40',
          'w-12 h-12 rounded-full shadow-lg',
          'bg-primary text-primary-foreground',
          'flex items-center justify-center',
          'hover:scale-110 transition-transform'
        )}
        title="Can ho tro?"
      >
        <LifeBuoy className="h-6 w-6" />
      </button>
    );
  }

  return (
    <ModalDialog
      open={state !== 'idle'}
      onClose={reset}
      title={state === 'qr' ? 'Thanh toan' : 'Ho tro nhanh'}
      maxWidth="sm"
    >
      {/* Form */}
      {(state === 'form' || state === 'submitting') && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Mo ta loi *</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Mo ta chi tiet loi ban gap..."
              rows={4}
              className="w-full mt-1 rounded-md border border-input px-3 py-2 text-sm bg-background focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Thong tin lien he</label>
            <input
              type="text"
              value={contact}
              onChange={e => setContact(e.target.value)}
              placeholder="SDT, Zalo, Email..."
              className="w-full mt-1 h-9 rounded-md border border-input px-3 text-sm bg-background"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Anh / Video dinh kem</label>
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
              Chon file ({files.length} da chon)
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
            <span className="text-sm font-medium">Chi phi ho tro</span>
            <span className="text-lg font-bold text-primary">500,000 VND</span>
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}

          <Button className="w-full" onClick={handleSubmit} disabled={state === 'submitting'}>
            {state === 'submitting' ? 'Dang gui...' : (
              <><Send className="h-4 w-4 mr-2" /> Gui yeu cau ho tro</>
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
            Quet QR de thanh toan. Sau khi thanh toan, admin se xac nhan va lien he ho tro ban.
          </p>

          <img
            src={result.qrUrl}
            alt="QR Thanh toan"
            className="mx-auto w-64 h-64 rounded-lg border"
          />

          <div className="text-xs text-muted-foreground space-y-1">
            <div>Ngan hang: Techcombank</div>
            <div>STK: MS01T17213302551927</div>
            <div>Noi dung: TICKET{result.shortId}</div>
            <div>So tien: 500,000 VND</div>
          </div>

          <Button variant="outline" onClick={reset} className="w-full">Dong</Button>
        </div>
      )}
    </ModalDialog>
  );
}
