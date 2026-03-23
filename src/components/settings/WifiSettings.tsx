/**
 * WiFi Settings Component
 * Scan, connect, disconnect, forget WiFi networks via nmcli
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Loader2,
  Lock,
  Trash2,
  Signal,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface WifiNetwork {
  inUse: boolean;
  bssid: string;
  ssid: string;
  signal: number;
  security: string;
}

interface WifiStatus {
  connected: boolean;
  ssid: string;
  device: string;
  ip: string;
}

function SignalBars({ signal }: { signal: number }) {
  const bars = signal >= 75 ? 4 : signal >= 50 ? 3 : signal >= 25 ? 2 : 1;
  return (
    <div className="flex items-end gap-0.5 h-4">
      {[1, 2, 3, 4].map((b) => (
        <div
          key={b}
          className={cn(
            'w-1 rounded-sm transition-colors',
            b <= bars ? 'bg-green-500' : 'bg-muted-foreground/20'
          )}
          style={{ height: `${b * 25}%` }}
        />
      ))}
    </div>
  );
}

export function WifiSettings() {
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [status, setStatus] = useState<WifiStatus | null>(null);
  const [savedNetworks, setSavedNetworks] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [forgetting, setForgetting] = useState<string | null>(null);

  // Connect dialog
  const [connectSSID, setConnectSSID] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [connectError, setConnectError] = useState<string | null>(null);

  const [showSaved, setShowSaved] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const resp = await fetch('/api/wifi/status');
      const data = await resp.json();
      if (data.success) setStatus(data);
    } catch { /* ignore */ }
  }, []);

  const fetchSaved = useCallback(async () => {
    try {
      const resp = await fetch('/api/wifi/saved');
      const data = await resp.json();
      if (data.success) setSavedNetworks(data.saved || []);
    } catch { /* ignore */ }
  }, []);

  const scan = useCallback(async () => {
    setScanning(true);
    try {
      const resp = await fetch('/api/wifi/scan');
      const data = await resp.json();
      if (data.success) setNetworks(data.networks || []);
    } catch { /* ignore */ }
    setScanning(false);
  }, []);

  useEffect(() => {
    fetchStatus();
    scan();
    fetchSaved();
  }, [fetchStatus, scan, fetchSaved]);

  const handleConnect = async () => {
    if (!connectSSID) return;
    setConnecting(connectSSID);
    setConnectError(null);
    try {
      const resp = await fetch('/api/wifi/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ssid: connectSSID, password: password || undefined }),
      });
      const data = await resp.json();
      if (data.success) {
        toast.success(`Đã kết nối: ${connectSSID}`);
        setConnectSSID(null);
        setPassword('');
        setTimeout(() => { fetchStatus(); scan(); fetchSaved(); }, 1500);
      } else {
        setConnectError(data.error || 'Kết nối thất bại');
      }
    } catch (err) {
      setConnectError(String(err));
    }
    setConnecting(null);
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const resp = await fetch('/api/wifi/disconnect', { method: 'POST' });
      const data = await resp.json();
      if (data.success) {
        toast.success('Đã ngắt kết nối WiFi');
        setTimeout(() => { fetchStatus(); scan(); }, 1500);
      }
    } catch { /* ignore */ }
    setDisconnecting(false);
  };

  const handleForget = async (ssid: string) => {
    setForgetting(ssid);
    try {
      const resp = await fetch(`/api/wifi/saved/${encodeURIComponent(ssid)}`, { method: 'DELETE' });
      const data = await resp.json();
      if (data.success) {
        toast.success(`Đã quên mạng: ${ssid}`);
        setSavedNetworks(prev => prev.filter(s => s !== ssid));
        scan();
      }
    } catch { /* ignore */ }
    setForgetting(null);
  };

  return (
    <div className="space-y-4">
      {/* Current status */}
      <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
        <div className="flex items-center gap-3">
          {status?.connected ? (
            <Wifi className="h-5 w-5 text-green-500" />
          ) : (
            <WifiOff className="h-5 w-5 text-muted-foreground" />
          )}
          <div>
            {status?.connected ? (
              <>
                <div className="font-medium text-sm">{status.ssid}</div>
                <div className="text-xs text-muted-foreground">
                  {status.ip || 'Đang lấy IP...'}
                </div>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Chưa kết nối WiFi</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {status?.connected && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 mr-1" />
              )}
              Ngắt
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={scan} disabled={scanning}>
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1', scanning && 'animate-spin')} />
            Quét
          </Button>
        </div>
      </div>

      {/* Network list */}
      <div className="space-y-1">
        {scanning && networks.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Đang quét mạng WiFi...
          </div>
        ) : networks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Không tìm thấy mạng WiFi nào
          </div>
        ) : (
          networks.map((net) => (
            <div key={net.bssid}>
              <button
                className={cn(
                  'w-full flex items-center justify-between rounded-lg px-4 py-2.5 text-left transition-colors',
                  'hover:bg-muted/50',
                  net.inUse && 'bg-primary/5 border border-primary/20',
                  connectSSID === net.ssid && 'bg-muted'
                )}
                onClick={() => {
                  if (net.inUse) return;
                  setConnectSSID(connectSSID === net.ssid ? null : net.ssid);
                  setPassword('');
                  setConnectError(null);
                }}
                disabled={connecting !== null}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <SignalBars signal={net.signal} />
                  <span className="font-medium text-sm truncate">{net.ssid}</span>
                  {net.security && net.security !== '--' && (
                    <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                  )}
                  {net.inUse && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                      <Check className="h-2.5 w-2.5 mr-0.5" />
                      Đang dùng
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                  {net.signal}%
                </span>
              </button>

              {/* Inline connect form */}
              {connectSSID === net.ssid && !net.inUse && (
                <div className="mx-4 mb-2 mt-1 p-3 rounded-md border border-dashed border-muted-foreground/30 space-y-2">
                  {net.security && net.security !== '--' && net.security !== 'open' && (
                    <Input
                      type="password"
                      placeholder="Nhập mật khẩu WiFi..."
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                      autoFocus
                    />
                  )}
                  {connectError && (
                    <p className="text-xs text-destructive">{connectError}</p>
                  )}
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setConnectSSID(null); setPassword(''); setConnectError(null); }}
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Hủy
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleConnect}
                      disabled={connecting === net.ssid}
                    >
                      {connecting === net.ssid ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : (
                        <Wifi className="h-3.5 w-3.5 mr-1" />
                      )}
                      Kết nối
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Saved networks */}
      {savedNetworks.length > 0 && (
        <div className="space-y-2">
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            onClick={() => setShowSaved(!showSaved)}
          >
            <Signal className="h-3 w-3" />
            Mạng đã lưu ({savedNetworks.length})
            <span className="text-[10px]">{showSaved ? '▲' : '▼'}</span>
          </button>
          {showSaved && (
            <div className="space-y-1">
              {savedNetworks.map((ssid) => (
                <div
                  key={ssid}
                  className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-1.5 text-xs"
                >
                  <span className="font-mono truncate">{ssid}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => handleForget(ssid)}
                    disabled={forgetting === ssid}
                  >
                    {forgetting === ssid ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3 text-destructive" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
