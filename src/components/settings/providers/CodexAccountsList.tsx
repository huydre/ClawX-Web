/**
 * Codex Multi-Account List — shows all connected OpenAI accounts
 * with auto-rotation status.
 */
import { useState, useEffect } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export function CodexAccountsList() {
  const [accounts, setAccounts] = useState<Array<{
    profileId: string;
    email: string;
    expires: number;
    savedAt?: number;
    isExpired: boolean;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  const fetchAccounts = async () => {
    try {
      const resp = await fetch('/api/providers/codex/accounts');
      const data = await resp.json();
      if (data.success) setAccounts(data.accounts || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchAccounts(); }, []);

  const handleRemove = async (profileId: string) => {
    setRemoving(profileId);
    try {
      const resp = await fetch(`/api/providers/codex/accounts/${encodeURIComponent(profileId)}`, {
        method: 'DELETE',
      });
      if (resp.ok) {
        setAccounts(prev => prev.filter(a => a.profileId !== profileId));
        toast.success('Đã xóa tài khoản');
      }
    } catch { /* ignore */ }
    setRemoving(null);
  };

  if (loading) return null;
  if (accounts.length === 0) return null;

  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Tài khoản ({accounts.length}) — Auto-rotation
        </span>
      </div>
      {accounts.map((account) => (
        <div
          key={account.profileId}
          className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-1.5 text-xs"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate font-mono">{account.email}</span>
            <Badge
              variant={account.isExpired ? 'destructive' : 'secondary'}
              className="text-[10px] px-1.5 py-0"
            >
              {account.isExpired ? 'Expired' : 'Active'}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => handleRemove(account.profileId)}
            disabled={removing === account.profileId}
          >
            {removing === account.profileId ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3 text-destructive" />
            )}
          </Button>
        </div>
      ))}
    </div>
  );
}
