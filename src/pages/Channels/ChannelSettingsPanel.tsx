import { useState, useEffect } from 'react';
import {
  Plus,
  Loader2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  CHANNEL_NAMES,
  type Channel,
} from '@/types/channel';
import { toast } from 'sonner';

interface ChannelSettingsPanelProps {
  channel: Channel;
  onClose: () => void;
}

export function ChannelSettingsPanel({ channel, onClose }: ChannelSettingsPanelProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [groupPolicy, setGroupPolicy] = useState('allowlist');
  const [pairingPolicy, setPairingPolicy] = useState('code');
  const [allowFrom, setAllowFrom] = useState<string[]>([]);
  const [groupAllowFrom, setGroupAllowFrom] = useState<string[]>([]);
  const [newAllowFrom, setNewAllowFrom] = useState('');
  const [newGroupAllowFrom, setNewGroupAllowFrom] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/channel-config/${channel.type}`);
        const data = await res.json();
        setGroupPolicy(data.groupPolicy || 'allowlist');
        setPairingPolicy(data.pairingPolicy || 'code');
        setAllowFrom(data.allowFrom || []);
        setGroupAllowFrom(data.groupAllowFrom || []);
      } catch {
        toast.error('Failed to load channel config');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [channel.type]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/channel-config/${channel.type}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupPolicy, pairingPolicy, allowFrom, groupAllowFrom }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Channel config saved');
        onClose();
      } else {
        toast.error(data.error || 'Failed to save');
      }
    } catch {
      toast.error('Failed to save channel config');
    } finally {
      setSaving(false);
    }
  };

  const addToList = (list: string[], setList: (v: string[]) => void, value: string, setInput: (v: string) => void) => {
    const trimmed = value.trim();
    if (trimmed && !list.includes(trimmed)) {
      setList([...list, trimmed]);
      setInput('');
    }
  };

  const removeFromList = (list: string[], setList: (v: string[]) => void, index: number) => {
    setList(list.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-background rounded-lg p-8">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-background rounded-lg border shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">Channel Settings — {CHANNEL_NAMES[channel.type]}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-5">
          {/* Group Policy */}
          <div className="space-y-2">
            <Label className="font-medium">Group Policy</Label>
            <p className="text-xs text-muted-foreground">Cho phép bot phản hồi trong group</p>
            <div className="flex gap-2">
              <Button
                variant={groupPolicy === 'open' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setGroupPolicy('open')}
              >
                Open
              </Button>
              <Button
                variant={groupPolicy === 'allowlist' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setGroupPolicy('allowlist')}
              >
                Allowlist
              </Button>
            </div>
          </div>

          {/* Pairing Policy */}
          <div className="space-y-2">
            <Label className="font-medium">Pairing Policy</Label>
            <p className="text-xs text-muted-foreground">Cách pair user với bot</p>
            <div className="flex gap-2">
              {['open', 'code', 'disabled'].map((p) => (
                <Button
                  key={p}
                  variant={pairingPolicy === p ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPairingPolicy(p)}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {/* Allow From (DM) */}
          <div className="space-y-2">
            <Label className="font-medium">Allow From (DM)</Label>
            <p className="text-xs text-muted-foreground">Danh sách user ID được phép gửi DM</p>
            <div className="flex gap-2">
              <Input
                placeholder="User ID"
                value={newAllowFrom}
                onChange={(e) => setNewAllowFrom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addToList(allowFrom, setAllowFrom, newAllowFrom, setNewAllowFrom);
                  }
                }}
              />
              <Button size="sm" variant="outline" onClick={() => addToList(allowFrom, setAllowFrom, newAllowFrom, setNewAllowFrom)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {allowFrom.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {allowFrom.map((id, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 pr-1">
                    {id}
                    <button onClick={() => removeFromList(allowFrom, setAllowFrom, i)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Group Allow From */}
          <div className="space-y-2">
            <Label className="font-medium">Group Allow From</Label>
            <p className="text-xs text-muted-foreground">Danh sách group ID được phép (khi groupPolicy = allowlist)</p>
            <div className="flex gap-2">
              <Input
                placeholder="Group ID"
                value={newGroupAllowFrom}
                onChange={(e) => setNewGroupAllowFrom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addToList(groupAllowFrom, setGroupAllowFrom, newGroupAllowFrom, setNewGroupAllowFrom);
                  }
                }}
              />
              <Button size="sm" variant="outline" onClick={() => addToList(groupAllowFrom, setGroupAllowFrom, newGroupAllowFrom, setNewGroupAllowFrom)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {groupAllowFrom.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {groupAllowFrom.map((id, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 pr-1">
                    {id}
                    <button onClick={() => removeFromList(groupAllowFrom, setGroupAllowFrom, i)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
