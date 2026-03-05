/**
 * Pending Pairing Approvals Component
 * Shows pending DM pairing requests with approve/reject actions
 */
import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, XCircle, Loader2, RefreshCw, UserPlus, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface PairingRequest {
    id: string;
    code: string;
    channel: string;
    senderId: string;
    senderName: string;
    username: string;
    createdAt: string;
}

const CHANNEL_LABELS: Record<string, string> = {
    telegram: 'Telegram',
    openzalo: 'Zalo',
};

const CHANNEL_COLORS: Record<string, string> = {
    telegram: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    openzalo: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
};

export function PairingApprovals() {
    const [pending, setPending] = useState<PairingRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

    const fetchPending = useCallback(async () => {
        try {
            const res = await fetch('/api/pairing/pending');
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            setPending(data.pending || []);
        } catch {
            // Silent fail — section just won't show data
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPending();
        const interval = setInterval(fetchPending, 15000);
        return () => clearInterval(interval);
    }, [fetchPending]);

    const handleApprove = async (req: PairingRequest) => {
        const key = `${req.channel}-${req.code}`;
        setActionLoading(prev => ({ ...prev, [key]: true }));
        try {
            const res = await fetch('/api/pairing/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channel: req.channel, code: req.code }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Đã duyệt ${req.senderName || req.code}`);
                setPending(prev => prev.filter(p => !(p.channel === req.channel && p.code === req.code)));
            } else {
                toast.error('Lỗi: ' + (data.error || 'Unknown'));
            }
        } catch (err) {
            toast.error('Lỗi duyệt: ' + String(err));
        } finally {
            setActionLoading(prev => ({ ...prev, [key]: false }));
        }
    };

    const handleReject = async (req: PairingRequest) => {
        const key = `${req.channel}-${req.code}`;
        setActionLoading(prev => ({ ...prev, [key]: true }));
        try {
            const res = await fetch('/api/pairing/reject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channel: req.channel, code: req.code }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Đã từ chối ${req.senderName || req.code}`);
                setPending(prev => prev.filter(p => !(p.channel === req.channel && p.code === req.code)));
            } else {
                toast.error('Lỗi: ' + (data.error || 'Unknown'));
            }
        } catch (err) {
            toast.error('Lỗi từ chối: ' + String(err));
        } finally {
            setActionLoading(prev => ({ ...prev, [key]: false }));
        }
    };

    // Don't render anything if loading or no pending requests
    if (loading || pending.length === 0) return null;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Yêu cầu pairing đang chờ duyệt</h3>
                    <Badge variant="destructive" className="text-xs px-1.5 py-0 h-5 min-w-5 flex items-center justify-center">
                        {pending.length}
                    </Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchPending}>
                    <RefreshCw className="h-3.5 w-3.5" />
                </Button>
            </div>

            <AnimatePresence mode="popLayout">
                {pending.map((req) => {
                    const key = `${req.channel}-${req.code}`;
                    const isLoading = actionLoading[key];
                    return (
                        <motion.div
                            key={key}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Card className="border-primary/20 bg-primary/5">
                                <CardContent className="py-3 px-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="shrink-0">
                                                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Badge variant="outline" className={`text-xs ${CHANNEL_COLORS[req.channel] || ''}`}>
                                                        {CHANNEL_LABELS[req.channel] || req.channel}
                                                    </Badge>
                                                    <code className="text-sm font-bold tracking-wider">{req.code}</code>
                                                </div>
                                                {(req.senderName || req.username || req.senderId) && (
                                                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                                        {req.senderName}{req.username ? ` @${req.username}` : ''}{!req.senderName && !req.username ? req.senderId : ''}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <Button
                                                size="sm"
                                                variant="default"
                                                className="h-7 gap-1 text-xs"
                                                onClick={() => handleApprove(req)}
                                                disabled={isLoading}
                                            >
                                                {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                                                Duyệt
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => handleReject(req)}
                                                disabled={isLoading}
                                            >
                                                <XCircle className="h-3 w-3" />
                                                Từ chối
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
