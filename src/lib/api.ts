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
    return this.request<{ success: boolean; provider?: string; modelId?: string; hasKey?: boolean; error?: string }>(
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

  async deleteFile(filename: string) {
    return this.request<{ success: boolean }>(`/files/${filename}`, {
      method: 'DELETE',
    });
  }

  getFileUrl(filename: string): string {
    return `${API_BASE}/files/${filename}`;
  }

  // Cron API (via Gateway RPC)
  async getCronJobs() {
    const result = await this.gatewayRpc('cron.list');
    return result.result || [];
  }

  async createCronJob(input: any) {
    const result = await this.gatewayRpc('cron.create', input);
    return result.result;
  }

  async updateCronJob(id: string, input: any) {
    const result = await this.gatewayRpc('cron.update', { id, ...input });
    return result.result;
  }

  async deleteCronJob(id: string) {
    const result = await this.gatewayRpc('cron.delete', { id });
    return result.result;
  }

  async toggleCronJob(id: string, enabled: boolean) {
    const result = await this.gatewayRpc('cron.toggle', { id, enabled });
    return result.result;
  }

  async triggerCronJob(id: string) {
    const result = await this.gatewayRpc('cron.trigger', { id });
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
}

export const api = new ApiClient();
