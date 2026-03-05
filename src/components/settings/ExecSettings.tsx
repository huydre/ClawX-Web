/**
 * Exec Tool Settings Component
 * Configure OpenClaw exec tool (host + security mode)
 */
import { useState, useEffect } from 'react';
import { Loader2, Terminal, ShieldCheck, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface ExecConfig {
    host: string;
    security: string;
    configured: boolean;
}

const HOST_OPTIONS = [
    { value: 'gateway', label: 'Gateway', desc: 'Chạy lệnh trực tiếp trên server' },
    { value: 'sandbox', label: 'Sandbox', desc: 'Chạy trong container (cần Docker)' },
];

const SECURITY_OPTIONS = [
    { value: 'full', label: 'Full Access', desc: 'AI chạy mọi lệnh không cần duyệt', icon: ShieldAlert, color: 'text-orange-500' },
    { value: 'allowlist', label: 'Allowlist', desc: 'Chỉ chạy lệnh trong danh sách cho phép', icon: ShieldCheck, color: 'text-green-500' },
    { value: 'deny', label: 'Deny', desc: 'Chặn tất cả exec', icon: ShieldCheck, color: 'text-red-500' },
];

export function ExecSettings() {
    const [config, setConfig] = useState<ExecConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [host, setHost] = useState('gateway');
    const [security, setSecurity] = useState('full');

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const res = await fetch('/api/gateway/exec-config');
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json() as ExecConfig;
            setConfig(data);
            setHost(data.host);
            setSecurity(data.security);
        } catch (err) {
            console.error('Failed to load exec config:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/gateway/exec-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ host, security }),
            });
            if (!res.ok) throw new Error('Failed to save');
            const data = await res.json();
            if (data.success) {
                setConfig({ host, security, configured: true });
                toast.success('Exec tool đã được cấu hình');
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            toast.error('Lỗi lưu cấu hình: ' + String(err));
        } finally {
            setSaving(false);
        }
    };

    const hasChanges = config && (host !== config.host || security !== config.security);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Current status */}
            {config?.configured && (
                <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-muted-foreground">
                        Đang dùng: <Badge variant="outline" className="ml-1">{config.host}</Badge>
                        <Badge variant="outline" className="ml-1">{config.security}</Badge>
                    </span>
                </div>
            )}

            {/* Host selection */}
            <div className="space-y-2">
                <Label>Exec Host</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {HOST_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => setHost(opt.value)}
                            className={`p-3 rounded-lg border text-left transition-all ${host === opt.value
                                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                : 'border-border hover:border-primary/50'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <Terminal className="h-4 w-4" />
                                <span className="font-medium text-sm">{opt.label}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Security mode */}
            <div className="space-y-2">
                <Label>Security Mode</Label>
                <div className="space-y-2">
                    {SECURITY_OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => setSecurity(opt.value)}
                                className={`w-full p-3 rounded-lg border text-left transition-all ${security === opt.value
                                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                    : 'border-border hover:border-primary/50'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Icon className={`h-4 w-4 ${opt.color}`} />
                                    <span className="font-medium text-sm">{opt.label}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Save button */}
            <Button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="w-full"
            >
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {hasChanges ? 'Lưu cấu hình' : 'Đã cấu hình'}
            </Button>

            {security === 'full' && (
                <p className="text-xs text-orange-500">
                    ⚠️ Full Access cho phép AI chạy mọi lệnh trên server. Chỉ nên dùng trên VPS riêng.
                </p>
            )}
        </div>
    );
}
