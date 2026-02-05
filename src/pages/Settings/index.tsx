/**
 * Settings Page
 * Application configuration
 */
import {
  Sun,
  Moon,
  Monitor,
  RefreshCw,
  Terminal,
  ExternalLink,
  Key,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useSettingsStore } from '@/stores/settings';
import { useGatewayStore } from '@/stores/gateway';
import { useUpdateStore } from '@/stores/update';
import { ProvidersSettings } from '@/components/settings/ProvidersSettings';
import { UpdateSettings } from '@/components/settings/UpdateSettings';

export function Settings() {
  const {
    theme,
    setTheme,
    gatewayAutoStart,
    setGatewayAutoStart,
    autoCheckUpdate,
    setAutoCheckUpdate,
    autoDownloadUpdate,
    setAutoDownloadUpdate,
    devModeUnlocked,
  } = useSettingsStore();
  
  const { status: gatewayStatus, restart: restartGateway } = useGatewayStore();
  const currentVersion = useUpdateStore((state) => state.currentVersion);
  
  // Open developer console
  const openDevConsole = () => {
    window.electron.openExternal('http://localhost:18789');
  };
  
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Configure your ClawX experience
        </p>
      </div>
      
      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize the look and feel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Theme</Label>
            <div className="flex gap-2">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('light')}
              >
                <Sun className="h-4 w-4 mr-2" />
                Light
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('dark')}
              >
                <Moon className="h-4 w-4 mr-2" />
                Dark
              </Button>
              <Button
                variant={theme === 'system' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('system')}
              >
                <Monitor className="h-4 w-4 mr-2" />
                System
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* AI Providers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            AI Providers
          </CardTitle>
          <CardDescription>Configure your AI model providers and API keys</CardDescription>
        </CardHeader>
        <CardContent>
          <ProvidersSettings />
        </CardContent>
      </Card>
      
      {/* Gateway */}
      <Card>
        <CardHeader>
          <CardTitle>Gateway</CardTitle>
          <CardDescription>OpenClaw Gateway settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Status</Label>
              <p className="text-sm text-muted-foreground">
                Port: {gatewayStatus.port}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  gatewayStatus.state === 'running'
                    ? 'success'
                    : gatewayStatus.state === 'error'
                    ? 'destructive'
                    : 'secondary'
                }
              >
                {gatewayStatus.state}
              </Badge>
              <Button variant="outline" size="sm" onClick={restartGateway}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Restart
              </Button>
            </div>
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-start Gateway</Label>
              <p className="text-sm text-muted-foreground">
                Start Gateway when ClawX launches
              </p>
            </div>
            <Switch
              checked={gatewayAutoStart}
              onCheckedChange={setGatewayAutoStart}
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Updates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Updates
          </CardTitle>
          <CardDescription>Keep ClawX up to date</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <UpdateSettings />
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-check for updates</Label>
              <p className="text-sm text-muted-foreground">
                Check for updates on startup
              </p>
            </div>
            <Switch
              checked={autoCheckUpdate}
              onCheckedChange={setAutoCheckUpdate}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-download updates</Label>
              <p className="text-sm text-muted-foreground">
                Download updates in the background
              </p>
            </div>
            <Switch
              checked={autoDownloadUpdate}
              onCheckedChange={setAutoDownloadUpdate}
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Developer */}
      {devModeUnlocked && (
        <Card>
          <CardHeader>
            <CardTitle>Developer</CardTitle>
            <CardDescription>Advanced options for developers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>OpenClaw Console</Label>
              <p className="text-sm text-muted-foreground">
                Access the native OpenClaw management interface
              </p>
              <Button variant="outline" onClick={openDevConsole}>
                <Terminal className="h-4 w-4 mr-2" />
                Open Developer Console
                <ExternalLink className="h-3 w-3 ml-2" />
              </Button>
              <p className="text-xs text-muted-foreground">
                Opens http://localhost:18789 in your browser
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>ClawX</strong> - Graphical AI Assistant
          </p>
          <p>Based on OpenClaw</p>
          <p>Version {currentVersion}</p>
          <div className="flex gap-4 pt-2">
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() => window.electron.openExternal('https://docs.clawx.app')}
            >
              Documentation
            </Button>
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() => window.electron.openExternal('https://github.com/ValueCell-ai/ClawX')}
            >
              GitHub
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Settings;
