// API client for ClawX Web
const API_BASE = '/api';

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

  // Gateway API
  async getGatewayStatus() {
    return this.request<{ state: string; connected: boolean }>('/gateway/status');
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
}

export const api = new ApiClient();
