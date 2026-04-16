// API client for ClawX Web
// In development, connect directly to backend server
// In production, use relative path (same host as frontend)
const API_BASE = import.meta.env.DEV ? 'http://localhost:2003/api' : '/api';

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('clawx_token', token);
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('clawx_token');
    }
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (options.headers) {
      Object.assign(headers, options.headers);
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Settings API
  async getSettings() {
    return this.request<any>('/settings');
  }

  async getSetting(key: string) {
    return this.request<{ value: any }>(`/settings/${key}`);
  }

  async setSetting(key: string, value: any) {
    return this.request<{ success: boolean }>(`/settings/${key}`, {
      method: 'POST',
      body: JSON.stringify({ value }),
    });
  }

  // Providers API
  async getProviders() {
    return this.request<any[]>('/providers');
  }

  async getProvider(id: string) {
    return this.request<any>(`/providers/${id}`);
  }

  async saveProvider(config: any, apiKey?: string) {
    return this.request<{ success: boolean }>('/providers', {
      method: 'POST',
      body: JSON.stringify({ config, apiKey }),
    });
  }

  async deleteProvider(id: string) {
    return this.request<{ success: boolean }>(`/providers/${id}`, {
      method: 'DELETE',
    });
  }

  async setDefaultProvider(id: string) {
    return this.request<{ success: boolean }>('/providers/default', {
      method: 'POST',
      body: JSON.stringify({ id }),
    });
  }

  async getDefaultProvider() {
    return this.request<{ id: string }>('/providers/default');
  }

  async importFromOpenClaw() {
    return this.request<{ success: boolean; imported?: { provider: string; model?: string; hasKey: boolean }[]; count?: number; error?: string }>(
      '/providers/import-from-openclaw',
      { method: 'POST' }
    );
  }

  // Gateway API
  async getGatewayStatus() {
    return this.request<{ state: string; connected: boolean }>('/gateway/status');
  }

  async restartOpenClaw() {
    return this.request<{ success: boolean; method?: string; error?: string }>(
      '/gateway/restart-openclaw',
      { method: 'POST' }
    );
  }

  async getCurrentModel() {
    return this.request<{
      model: string | null;
      provider: string | null;
      modelId: string | null;
      source: string;
    }>('/gateway/current-model');
  }

  async startGateway() {
    return this.request<{ success: boolean }>('/gateway/start', {
      method: 'POST',
    });
  }

  async stopGateway() {
    return this.request<{ success: boolean }>('/gateway/stop', {
      method: 'POST',
    });
  }

  async gatewayRpc(method: string, params?: any, timeoutMs?: number) {
    return this.request<{ success: boolean; result: any }>('/gateway/rpc', {
      method: 'POST',
      body: JSON.stringify({ method, params, timeoutMs }),
    });
  }

  // Files API
  async uploadFile(file: File) {
    const token = this.getToken();
    const formData = new FormData();
    formData.append('file', file);

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}/files/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async stageFile(file: File) {
    const token = this.getToken();
    const formData = new FormData();
    formData.append('file', file);

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE}/files/stage`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Stage failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json() as Promise<{
      id: string;
      fileName: string;
      mimeType: string;
      fileSize: number;
      stagedPath: string;
      preview: string | null;
    }>;
  }

  async sendChatWithMedia(params: {
    sessionKey: string;
    message: string;
    deliver?: boolean;
    idempotencyKey: string;
    media: Array<{ filePath: string; mimeType: string; fileName: string }>;
  }) {
    return this.request<{ success: boolean; result?: { runId?: string }; error?: string }>(
      '/gateway/send-with-media',
      {
        method: 'POST',
        body: JSON.stringify(params),
      },
    );
  }

  async deleteFile(filename: string) {
    return this.request<{ success: boolean }>(`/files/${filename}`, {
      method: 'DELETE',
    });
  }

  getFileUrl(filename: string): string {
    return `${API_BASE}/files/${filename}`;
  }

  // Cron API (via Gateway RPC)
  // Transforms frontend format to Gateway format (matching Electron IPC handlers)
  async getCronJobs() {
    const result = await this.gatewayRpc('cron.list', { includeDisabled: true });
    return result.result?.jobs || [];
  }

  async createCronJob(input: any) {
    // Transform frontend input to Gateway cron.add format
    // New jobs use sessionTarget='isolated' + payload.kind='agentTurn'
    const recipientId = input.target?.channelId || '';
    const deliveryTo = input.target?.channelType === 'discord' && recipientId
      ? `channel:${recipientId}`
      : recipientId;

    const gatewayInput = {
      name: input.name,
      schedule: typeof input.schedule === 'string'
        ? { kind: 'cron', expr: input.schedule }
        : input.schedule,
      payload: { kind: 'agentTurn', message: input.message || '' },
      enabled: input.enabled ?? true,
      wakeMode: 'next-heartbeat',
      sessionTarget: 'isolated',
      delivery: {
        mode: 'announce',
        channel: input.target?.channelType || 'telegram',
        to: deliveryTo,
      },
    };
    const result = await this.gatewayRpc('cron.add', gatewayInput);
    return result.result;
  }

  // Build payload object based on sessionTarget
  // isolated → { kind: 'agentTurn', message: '...' }
  // main     → { kind: 'systemEvent', text: '...' }
  private _cronPayload(sessionTarget: string, msg?: string): Record<string, any> {
    if (sessionTarget === 'main') {
      return msg !== undefined
        ? { kind: 'systemEvent', text: msg }
        : { kind: 'systemEvent' };
    }
    return msg !== undefined
      ? { kind: 'agentTurn', message: msg }
      : { kind: 'agentTurn' };
  }

  async updateCronJob(id: string, input: any) {
    // Gateway cron.update format: { id, patch: { ... } }
    // payload.kind depends on sessionTarget (isolated=agentTurn, main=systemEvent)
    const session = input.sessionTarget || 'isolated';
    const patch: Record<string, any> = {
      payload: this._cronPayload(session, input.message),
    };

    if (input.name !== undefined) patch.name = input.name;
    if (input.enabled !== undefined) patch.enabled = input.enabled;

    if (input.schedule !== undefined) {
      patch.schedule = typeof input.schedule === 'string'
        ? { kind: 'cron', expr: input.schedule }
        : input.schedule;
    }

    const result = await this.gatewayRpc('cron.update', { id, patch });
    return result.result;
  }

  async deleteCronJob(id: string) {
    const result = await this.gatewayRpc('cron.remove', { id });
    return result.result;
  }

  async toggleCronJob(id: string, enabled: boolean, sessionTarget = 'isolated') {
    const result = await this.gatewayRpc('cron.update', {
      id,
      patch: {
        enabled,
        payload: this._cronPayload(sessionTarget),
      },
    });
    return result.result;
  }

  async triggerCronJob(id: string) {
    const result = await this.gatewayRpc('cron.run', { id, mode: 'force' });
    return result.result;
  }

  // ClawHub API
  async clawhubSearch(query: string, limit?: number) {
    return this.request<{ success: boolean; results: any[] }>('/clawhub/search', {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    });
  }

  async clawhubInstall(slug: string, version?: string, force?: boolean) {
    return this.request<{ success: boolean }>('/clawhub/install', {
      method: 'POST',
      body: JSON.stringify({ slug, version, force }),
    });
  }

  async clawhubUninstall(slug: string) {
    return this.request<{ success: boolean }>('/clawhub/uninstall', {
      method: 'POST',
      body: JSON.stringify({ slug }),
    });
  }

  async clawhubList() {
    return this.request<{ success: boolean; results: any[] }>('/clawhub/list');
  }

  // Tunnel API
  async getTunnelStatus() {
    return this.request<{
      configured: boolean;
      enabled: boolean;
      running: boolean;
      mode?: 'quick' | 'named';
      publicUrl?: string;
      dashboardUrl?: string;
      uptime?: number;
      state: 'stopped' | 'starting' | 'connected' | 'error';
      error?: string;
    }>('/tunnel/status');
  }

  async startQuickTunnel(localUrl?: string) {
    return this.request<{ success: boolean; publicUrl?: string }>('/tunnel/quick/start', {
      method: 'POST',
      body: JSON.stringify({ localUrl }),
    });
  }

  async stopQuickTunnel() {
    return this.request<{ success: boolean }>('/tunnel/quick/stop', {
      method: 'POST',
    });
  }

  async setupTunnel(config: {
    apiToken: string;
    tunnelName: string;
    domain?: string;
  }) {
    return this.request<{ success: boolean; tunnelId: string; publicUrl?: string }>('/tunnel/setup', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async autoSetupTunnel(config: {
    apiToken: string;
    baseDomain?: string;
    localUrl?: string;
  }) {
    return this.request<{ success: boolean; tunnelId: string; publicUrl: string; subdomain: string }>('/tunnel/auto-setup', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async startTunnel() {
    return this.request<{ success: boolean; publicUrl?: string }>('/tunnel/start', {
      method: 'POST',
    });
  }

  async stopTunnel() {
    return this.request<{ success: boolean }>('/tunnel/stop', {
      method: 'POST',
    });
  }

  async teardownTunnel() {
    return this.request<{ success: boolean }>('/tunnel/teardown', {
      method: 'POST',
    });
  }

  async validateTunnelToken(apiToken: string) {
    return this.request<{ valid: boolean; accountId?: string }>('/tunnel/validate-token', {
      method: 'POST',
      body: JSON.stringify({ apiToken }),
    });
  }

  // Channels API
  async validateChannelCredentials(type: string, config: Record<string, string>) {
    return this.request<{
      valid: boolean;
      errors: string[];
      warnings: string[];
      details?: Record<string, string>;
    }>('/channels/validate', {
      method: 'POST',
      body: JSON.stringify({ type, config }),
    });
  }

  async saveChannelConfig(type: string, config: Record<string, unknown>, accountId?: string) {
    return this.request<{ success: boolean }>('/channels/save', {
      method: 'POST',
      body: JSON.stringify({ type, config, ...(accountId ? { accountId } : {}) }),
    });
  }

  async deleteChannelConfig(type: string) {
    return this.request<{ success: boolean }>(`/channels/${type}`, {
      method: 'DELETE',
    });
  }

  async getChannelFormValues(type: string) {
    return this.request<{ success: boolean; values: Record<string, string> | null }>(`/channels/${type}/form-values`);
  }

  // Analytics API
  async getAnalyticsDaily(days = 7) {
    return this.request<{ data: Array<{ date: string; sent: number; received: number }> }>('/analytics/daily?days=' + days);
  }

  async getAnalyticsTotals() {
    return this.request<{ sent: number; received: number }>('/analytics/totals');
  }

  async getAnalyticsHourly() {
    return this.request<{ data: Record<string, number> }>('/analytics/hourly');
  }

  async getTokenStats(days = 7) {
    return this.request<{
      daily: Array<{ date: string; inputTokens: number; outputTokens: number; cacheReadTokens: number; estimatedCost: number; requests: number }>;
      byProvider: Record<string, { inputTokens: number; outputTokens: number; estimatedCost: number; requests: number }>;
      totals: { inputTokens: number; outputTokens: number; cacheReadTokens: number; estimatedCost: number; requests: number };
    }>('/analytics/token-stats?days=' + days);
  }

  // Agents Config API
  async getCrossAgentConfig() {
    return this.request<{
      sessionsVisibility: string;
      agentToAgentEnabled: boolean;
      agentToAgentAllow: string[];
    }>('/agents-config/cross-agent');
  }

  async setCrossAgentConfig(config: {
    sessionsVisibility?: string;
    agentToAgentEnabled?: boolean;
    agentToAgentAllow?: string[];
  }) {
    return this.request<{ success: boolean }>('/agents-config/cross-agent', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  // Agent Detail Config API (reads from openclaw.json directly)
  async getAgentDetail(agentId: string) {
    return this.request<{
      found: boolean;
      model?: string;
      defaultModel?: string;
      workspace?: string;
      channelInfo?: { type: string; accountId: string; dmPolicy: string } | null;
      hasAuth?: boolean;
      authProviders?: string[];
    }>(`/agents-config/detail/${agentId}`);
  }

  async updateAgentDetail(agentId: string, updates: { model?: string }) {
    return this.request<{ success: boolean }>(`/agents-config/detail/${agentId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // Agent Auth API
  async getAuthSources() {
    return this.request<{
      sources: Array<{ id: string; name: string; providers: string[] }>;
    }>('/agents-config/auth-sources');
  }

  async copyAuth(agentId: string, sourceAgentId: string) {
    return this.request<{ success: boolean }>(`/agents-config/copy-auth/${agentId}`, {
      method: 'POST',
      body: JSON.stringify({ sourceAgentId }),
    });
  }

  // Agent Workspace Skills API
  async getWorkspaceSkills(agentId: string) {
    return this.request<{
      skills: Array<{ name: string; hasSkillMd: boolean; description: string }>;
      workspace: string;
    }>(`/agents-config/workspace-skills/${agentId}`);
  }

  // Agent Bindings API
  async getAgentBindings(agentId: string) {
    return this.request<{
      bindings: Array<{ agentId: string; match: { channel?: string; accountId?: string; peer?: { kind: string; id: string } } }>;
    }>(`/agents-config/bindings/${agentId}`);
  }

  async setAgentBindings(agentId: string, bindings: Array<{ match: { channel?: string; accountId?: string; peer?: { kind: string; id: string } } }>) {
    return this.request<{ success: boolean }>(`/agents-config/bindings/${agentId}`, {
      method: 'PUT',
      body: JSON.stringify({ bindings }),
    });
  }

  // System Metrics API
  async getSystemMetrics() {
    return this.request<{
      cpu: { usage: number; cores: number; model: string; speed: number; temp: number | null };
      memory: { total: number; used: number; free: number; usagePercent: number; swapTotal: number; swapUsed: number };
      disk: Array<{ fs: string; mount: string; type: string; size: number; used: number; available: number; usagePercent: number }>;
      network: { rxSec: number; txSec: number; rxTotal: number; txTotal: number; interface: string };
      os: { platform: string; distro: string; release: string; hostname: string; arch: string; uptime: number };
      gpu: Array<{ model: string; vendor: string; vram: number; temp: number | null }>;
      containers: Array<{ id: string; name: string; image: string; state: string; cpuPercent: number; memUsage: number; memLimit: number; netIO: { rx: number; tx: number } }>;
      timestamp: number;
    }>('/system/metrics');
  }

  // USB API
  async getUsbDevices() {
    return this.request<{ devices: any[] }>('/usb/devices');
  }

  async getUsbFiles(deviceId: string, path?: string) {
    const params = path ? `?path=${encodeURIComponent(path)}` : '';
    return this.request<{ files: any[] }>(`/usb/files/${deviceId}${params}`);
  }

  async readUsbFile(deviceId: string, filePath: string) {
    const params = new URLSearchParams({ path: filePath });
    return this.request<{ content: string; truncated: boolean }>(`/usb/file/${deviceId}?${params}`);
  }

  async copyUsbFiles(deviceId: string, files: string[], workspace: string) {
    return this.request<{ success: boolean }>('/usb/copy', {
      method: 'POST',
      body: JSON.stringify({ deviceId, files, workspace }),
    });
  }

  async ejectUsb(deviceId: string) {
    return this.request<{ success: boolean }>(`/usb/eject`, {
      method: 'POST',
      body: JSON.stringify({ deviceId }),
    });
  }

  // File Manager API
  async getFmRoots() {
    return this.request<{ roots: any[] }>('/fm/roots');
  }

  async getFmFiles(rootId: string, path?: string) {
    const params = path && path !== '/' ? `?path=${encodeURIComponent(path)}` : '';
    return this.request<{ files: any[] }>(`/fm/list/${rootId}${params}`);
  }

  /** Build URL for streaming a file (used as <img>/<video>/<audio> src) */
  getFmServeUrl(rootId: string, filePath: string): string {
    return `/api/fm/serve/${rootId}?path=${encodeURIComponent(filePath)}`;
  }

  /** Build URL for image thumbnail */
  getFmThumbUrl(rootId: string, filePath: string, w = 200, h = 200): string {
    return `/api/fm/thumb/${rootId}?path=${encodeURIComponent(filePath)}&w=${w}&h=${h}`;
  }

  /** Build URL for file download */
  getFmDownloadUrl(rootId: string, filePath: string): string {
    return `/api/fm/download/${rootId}?path=${encodeURIComponent(filePath)}`;
  }

  /** Get absolute path of a file */
  async getFmPath(rootId: string, filePath: string) {
    return this.request<{ absolutePath: string }>(`/fm/path/${rootId}?path=${encodeURIComponent(filePath)}`);
  }

  /** Copy file/directory */
  async fmCopy(srcRootId: string, srcPath: string, destRootId: string, destPath: string) {
    return this.request<{ success: boolean; error?: string }>('/fm/copy', {
      method: 'POST',
      body: JSON.stringify({ srcRootId, srcPath, destRootId, destPath }),
    });
  }

  /** Rename file/directory */
  async fmRename(rootId: string, path: string, newName: string) {
    return this.request<{ success: boolean; error?: string }>('/fm/rename', {
      method: 'POST',
      body: JSON.stringify({ rootId, path, newName }),
    });
  }

  // System / Update API (web-only)
  async getSystemInfo() {
    return this.request<{
      localSha: string;
      localShort: string;
      remoteSha: string;
      remoteShort: string;
      remoteMessage: string;
      remoteAuthor: string;
      remoteDate: string;
      updateAvailable: boolean;
      checkedAt: number | null;
    }>('/system/info');
  }

  async checkUpdate() {
    return this.request<{
      localSha: string;
      localShort: string;
      remoteSha: string;
      remoteShort: string;
      remoteMessage: string;
      remoteAuthor: string;
      remoteDate: string;
      updateAvailable: boolean;
      checkedAt: number | null;
    }>('/system/check-update', { method: 'POST' });
  }

  async startUpdate() {
    return this.request<{ ok: boolean; message: string }>('/system/update', { method: 'POST' });
  }
}

export const api = new ApiClient();
