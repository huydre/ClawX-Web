/**
 * ClawX-side Composio client.
 *
 * Talks to a central `composio-proxy` server that holds the real Composio
 * API key. When `COMPOSIO_PROXY_URL` is not set, falls back to a local mock
 * so the full UI flow can be tested without any external dependency.
 *
 * The proxy contract is documented in the composio-proxy README.
 */

import { getSettings } from './storage.js';

const PROXY_URL = (process.env.COMPOSIO_PROXY_URL || '').replace(/\/$/, '');
const PROXY_TOKEN = process.env.COMPOSIO_PROXY_TOKEN || '';

export interface InitiateResult {
  redirectUrl: string;
  connectionId: string;
  mock?: boolean;
}

export interface ConnectionInfo {
  id: string;
  status: 'PENDING' | 'ACTIVE' | 'FAILED' | 'MOCK';
  appSlug: string;
  createdAt?: string;
}

export function isProxyConfigured(): boolean {
  return !!PROXY_URL;
}

async function getUserId(): Promise<string> {
  const settings = await getSettings();
  return settings.serverToken;
}

async function proxyFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!PROXY_URL) throw new Error('Composio proxy not configured');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (PROXY_TOKEN) headers['X-Proxy-Token'] = PROXY_TOKEN;
  if (init?.headers) Object.assign(headers, init.headers);
  return fetch(`${PROXY_URL}${path}`, { ...init, headers });
}

export async function initiateConnection(params: {
  appSlug: string;
  callbackUrl?: string;
}): Promise<InitiateResult> {
  const userId = await getUserId();

  if (!isProxyConfigured()) {
    // Mock mode — return a URL pointing to our own mock OAuth dialog.
    const mockId = `mock_${params.appSlug}_${Date.now()}`;
    return {
      redirectUrl: `/applications/mock-oauth?app=${encodeURIComponent(params.appSlug)}&cid=${encodeURIComponent(mockId)}`,
      connectionId: mockId,
      mock: true,
    };
  }

  const res = await proxyFetch('/api/connect', {
    method: 'POST',
    body: JSON.stringify({
      appSlug: params.appSlug,
      userId,
      callbackUrl: params.callbackUrl,
    }),
  });
  if (!res.ok) {
    throw new Error(`Proxy /connect failed: ${res.status} ${await res.text().catch(() => '')}`);
  }
  return (await res.json()) as InitiateResult;
}

export async function getConnection(connectionId: string): Promise<ConnectionInfo | null> {
  if (!isProxyConfigured()) {
    // Mock — any id is treated as active
    return {
      id: connectionId,
      status: 'ACTIVE',
      appSlug: connectionId.split('_')[1] || 'unknown',
    };
  }
  const res = await proxyFetch(`/api/connections/${encodeURIComponent(connectionId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Proxy get connection failed: ${res.status}`);
  return (await res.json()) as ConnectionInfo;
}

export async function deleteConnection(connectionId: string): Promise<void> {
  if (!isProxyConfigured()) return; // mock — nothing remote to delete
  const res = await proxyFetch(`/api/connections/${encodeURIComponent(connectionId)}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Proxy delete failed: ${res.status}`);
  }
}

export async function proxyStatus(): Promise<{ reachable: boolean; configured: boolean; error?: string }> {
  if (!isProxyConfigured()) return { reachable: false, configured: false };
  try {
    const res = await proxyFetch('/api/status');
    if (!res.ok) return { reachable: false, configured: false, error: `HTTP ${res.status}` };
    const data = (await res.json()) as { configured?: boolean };
    return { reachable: true, configured: !!data.configured };
  } catch (err) {
    return { reachable: false, configured: false, error: String(err) };
  }
}
