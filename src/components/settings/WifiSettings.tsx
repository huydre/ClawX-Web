/**
 * WiFi Settings Component
 * Display-only: shows current WiFi connection status.
 */
import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

interface WifiStatus {
  connected: boolean;
  ssid: string;
  device: string;
  ip: string;
}

export function WifiSettings() {
  const [status, setStatus] = useState<WifiStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/wifi/status')
      .then(r => r.json())
      .then(d => { if (d.success) setStatus(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Đang kiểm tra...
      </div>
    );
  }

  if (!status || !status.connected) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <WifiOff className="h-4 w-4" />
        Chưa kết nối WiFi
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 py-2">
      <Wifi className="h-4 w-4 text-green-500" />
      <div>
        <div className="text-sm font-medium">{status.ssid}</div>
        {status.ip && (
          <div className="text-xs text-muted-foreground">IP: {status.ip}</div>
        )}
      </div>
    </div>
  );
}
