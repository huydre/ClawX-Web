import crypto from 'crypto';
import { logger } from '../utils/logger.js';
// Constants
const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';
const RATE_LIMIT_MAX_REQUESTS = 1200;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
export class CloudflareAPI {
    apiToken;
    rateLimitInfo = {
        requestCount: 0,
        windowStart: Date.now(),
    };
    constructor(apiToken) {
        if (!apiToken || apiToken.trim().length === 0) {
            throw new Error('Cloudflare API token is required');
        }
        this.apiToken = apiToken.trim();
    }
    // ============================================================================
    // Authentication & Validation
    // ============================================================================
    /**
     * Validate the API token
     */
    async validateToken() {
        try {
            const response = await this.makeRequest('GET', '/user/tokens/verify');
            return response.status === 'active';
        }
        catch (error) {
            logger.error('Token validation failed', { error: error.message });
            return false;
        }
    }
    /**
     * Get the account ID for the authenticated user
     */
    async getAccountId() {
        try {
            const response = await this.makeRequest('GET', '/accounts');
            if (!response || response.length === 0) {
                throw new Error('No accounts found for this API token');
            }
            // Return the first account ID
            const accountId = response[0].id;
            logger.info('Retrieved Cloudflare account ID', { accountId });
            return accountId;
        }
        catch (error) {
            logger.error('Failed to get account ID', { error: error.message });
            throw new Error(`Failed to get account ID: ${error.message}`);
        }
    }
    /**
     * Get the zone ID for a domain
     */
    async getZoneId(domain) {
        try {
            // Try to find zone by checking domain and parent domains
            // Start from most specific (longest) to least specific (shortest)
            const domainParts = domain.split('.');
            // Try from most specific to least specific
            // e.g., for "veoforge.ggff.net", try: veoforge.ggff.net -> ggff.net -> net
            for (let i = 0; i < domainParts.length - 1; i++) {
                const testDomain = domainParts.slice(i).join('.');
                logger.debug('Checking for zone', { testDomain });
                const response = await this.makeRequest('GET', `/zones?name=${encodeURIComponent(testDomain)}`);
                if (response && response.length > 0) {
                    const zoneId = response[0].id;
                    const zoneName = response[0].name;
                    logger.info('Retrieved zone ID', {
                        requestedDomain: domain,
                        foundZone: zoneName,
                        zoneId
                    });
                    return { zoneId, zoneName };
                }
            }
            throw new Error(`No zone found for domain: ${domain}`);
        }
        catch (error) {
            logger.error('Failed to get zone ID', { domain, error: error.message });
            throw new Error(`Failed to get zone ID for ${domain}: ${error.message}`);
        }
    }
    // ============================================================================
    // Tunnel Management
    // ============================================================================
    /**
     * Create a new Cloudflare Tunnel
     */
    async createTunnel(accountId, name) {
        try {
            logger.info('Creating Cloudflare tunnel', { accountId, name });
            const response = await this.makeRequest('POST', `/accounts/${accountId}/cfd_tunnel`, {
                name,
                tunnel_secret: this.generateTunnelSecret(),
            });
            logger.info('Tunnel created successfully', {
                tunnelId: response.id,
                name: response.name,
            });
            return response;
        }
        catch (error) {
            logger.error('Failed to create tunnel', {
                accountId,
                name,
                error: error.message,
            });
            throw new Error(`Failed to create tunnel: ${error.message}`);
        }
    }
    /**
     * Get tunnel information
     */
    async getTunnel(accountId, tunnelId) {
        try {
            const response = await this.makeRequest('GET', `/accounts/${accountId}/cfd_tunnel/${tunnelId}`);
            return response;
        }
        catch (error) {
            logger.error('Failed to get tunnel info', {
                accountId,
                tunnelId,
                error: error.message,
            });
            throw new Error(`Failed to get tunnel info: ${error.message}`);
        }
    }
    /**
     * List all tunnels for an account
     */
    async listTunnels(accountId) {
        try {
            const response = await this.makeRequest('GET', `/accounts/${accountId}/cfd_tunnel`);
            return response || [];
        }
        catch (error) {
            logger.error('Failed to list tunnels', {
                accountId,
                error: error.message,
            });
            throw new Error(`Failed to list tunnels: ${error.message}`);
        }
    }
    /**
     * Find tunnel by name
     */
    async findTunnelByName(accountId, name) {
        try {
            const tunnels = await this.listTunnels(accountId);
            const tunnel = tunnels.find(t => t.name === name);
            return tunnel || null;
        }
        catch (error) {
            logger.error('Failed to find tunnel by name', {
                accountId,
                name,
                error: error.message,
            });
            return null;
        }
    }
    /**
     * Get tunnel token for cloudflared daemon
     */
    async getTunnelToken(accountId, tunnelId) {
        try {
            logger.info('Getting tunnel token', { accountId, tunnelId });
            const response = await this.makeRequest('GET', `/accounts/${accountId}/cfd_tunnel/${tunnelId}/token`);
            logger.info('Tunnel token retrieved successfully', { tunnelId });
            return response;
        }
        catch (error) {
            logger.error('Failed to get tunnel token', {
                accountId,
                tunnelId,
                error: error.message,
            });
            throw new Error(`Failed to get tunnel token: ${error.message}`);
        }
    }
    /**
     * Update tunnel ingress configuration via Cloudflare API.
     * This allows routing multiple hostnames to different local services
     * without using the --url flag in cloudflared.
     * The last entry must be a catch-all with no hostname (e.g. http_status:404).
     */
    async updateTunnelConfig(accountId, tunnelId, ingress) {
        try {
            logger.info('Updating tunnel ingress config', { accountId, tunnelId, ingressCount: ingress.length });
            await this.makeRequest('PUT', `/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`, { config: { ingress } });
            logger.info('Tunnel ingress config updated successfully', { tunnelId });
        }
        catch (error) {
            logger.error('Failed to update tunnel config', {
                accountId,
                tunnelId,
                error: error.message,
            });
            throw new Error(`Failed to update tunnel config: ${error.message}`);
        }
    }
    /**
     * Delete a tunnel
     */
    async deleteTunnel(accountId, tunnelId) {
        try {
            logger.info('Deleting tunnel', { accountId, tunnelId });
            await this.makeRequest('DELETE', `/accounts/${accountId}/cfd_tunnel/${tunnelId}`);
            logger.info('Tunnel deleted successfully', { tunnelId });
        }
        catch (error) {
            logger.error('Failed to delete tunnel', {
                accountId,
                tunnelId,
                error: error.message,
            });
            throw new Error(`Failed to delete tunnel: ${error.message}`);
        }
    }
    // ============================================================================
    // DNS Management
    // ============================================================================
    /**
     * Create a DNS record pointing to a tunnel
     */
    async createDnsRecord(zoneId, subdomain, tunnelId) {
        try {
            logger.info('Creating DNS record', { zoneId, subdomain, tunnelId });
            // Log token length for debugging (not the actual token)
            logger.debug('API token info', {
                tokenLength: this.apiToken.length,
                tokenPrefix: this.apiToken.substring(0, 8) + '...'
            });
            const response = await this.makeRequest('POST', `/zones/${zoneId}/dns_records`, {
                type: 'CNAME',
                name: subdomain,
                content: `${tunnelId}.cfargotunnel.com`,
                proxied: true,
                ttl: 1, // Auto TTL when proxied
            });
            logger.info('DNS record created successfully', {
                recordId: response.id,
                name: response.name,
            });
            return response;
        }
        catch (error) {
            logger.error('Failed to create DNS record', {
                zoneId,
                subdomain,
                tunnelId,
                error: error.message,
            });
            throw new Error(`Failed to create DNS record: ${error.message}`);
        }
    }
    /**
     * Delete a DNS record
     */
    async deleteDnsRecord(zoneId, recordId) {
        try {
            logger.info('Deleting DNS record', { zoneId, recordId });
            await this.makeRequest('DELETE', `/zones/${zoneId}/dns_records/${recordId}`);
            logger.info('DNS record deleted successfully', { recordId });
        }
        catch (error) {
            logger.error('Failed to delete DNS record', {
                zoneId,
                recordId,
                error: error.message,
            });
            throw new Error(`Failed to delete DNS record: ${error.message}`);
        }
    }
    /**
     * Find DNS record by name
     */
    async findDnsRecord(zoneId, name) {
        try {
            const response = await this.makeRequest('GET', `/zones/${zoneId}/dns_records?name=${encodeURIComponent(name)}`);
            if (response && response.length > 0) {
                return response[0];
            }
            return null;
        }
        catch (error) {
            logger.error('Failed to find DNS record', {
                zoneId,
                name,
                error: error.message,
            });
            return null;
        }
    }
    /**
     * Update DNS record to point to a different tunnel
     */
    async updateDnsRecord(zoneId, recordId, tunnelId) {
        try {
            logger.info('Updating DNS record', { zoneId, recordId, tunnelId });
            const response = await this.makeRequest('PATCH', `/zones/${zoneId}/dns_records/${recordId}`, {
                content: `${tunnelId}.cfargotunnel.com`,
            });
            logger.info('DNS record updated successfully', { recordId });
            return response;
        }
        catch (error) {
            logger.error('Failed to update DNS record', {
                zoneId,
                recordId,
                tunnelId,
                error: error.message,
            });
            throw new Error(`Failed to update DNS record: ${error.message}`);
        }
    }
    // ============================================================================
    // Private Helper Methods
    // ============================================================================
    /**
     * Make an HTTP request to the Cloudflare API with retry logic
     */
    async makeRequest(method, endpoint, body) {
        let lastError = null;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                // Check rate limit
                this.checkRateLimit();
                const url = `${CLOUDFLARE_API_BASE}${endpoint}`;
                // Never log the API token
                logger.debug('Making Cloudflare API request', {
                    method,
                    endpoint,
                    attempt,
                    hasBody: !!body,
                });
                const options = {
                    method,
                    headers: {
                        'Authorization': `Bearer ${this.apiToken}`,
                        'Content-Type': 'application/json',
                    },
                };
                if (body) {
                    options.body = JSON.stringify(body);
                }
                const response = await fetch(url, options);
                // Track rate limit
                this.trackRequest();
                // Handle rate limiting
                if (response.status === 429) {
                    const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
                    logger.warn('Rate limit exceeded, waiting before retry', {
                        retryAfter,
                        attempt,
                    });
                    if (attempt < MAX_RETRIES) {
                        await this.sleep(retryAfter * 1000);
                        continue;
                    }
                    throw new Error('Rate limit exceeded');
                }
                const data = await response.json();
                // Handle API errors
                if (!data.success) {
                    const errorMessages = data.errors.map(e => `${e.code}: ${e.message}`).join(', ');
                    throw new Error(`Cloudflare API error: ${errorMessages}`);
                }
                logger.debug('Cloudflare API request successful', {
                    method,
                    endpoint,
                    attempt,
                });
                return data.result;
            }
            catch (error) {
                lastError = error;
                logger.warn('Cloudflare API request failed', {
                    method,
                    endpoint,
                    attempt,
                    maxRetries: MAX_RETRIES,
                    error: lastError.message,
                });
                // Don't retry on authentication errors
                if (lastError.message.includes('authentication') ||
                    lastError.message.includes('unauthorized') ||
                    lastError.message.includes('invalid token')) {
                    throw lastError;
                }
                // Retry with exponential backoff
                if (attempt < MAX_RETRIES) {
                    const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
                    logger.debug('Retrying request', { delay, attempt: attempt + 1 });
                    await this.sleep(delay);
                }
            }
        }
        throw new Error(`Failed to complete Cloudflare API request after ${MAX_RETRIES} attempts: ${lastError?.message}`);
    }
    /**
     * Check if we're within rate limits
     */
    checkRateLimit() {
        const now = Date.now();
        const windowElapsed = now - this.rateLimitInfo.windowStart;
        // Reset window if 5 minutes have passed
        if (windowElapsed >= RATE_LIMIT_WINDOW_MS) {
            this.rateLimitInfo = {
                requestCount: 0,
                windowStart: now,
            };
            return;
        }
        // Check if we've exceeded the limit
        if (this.rateLimitInfo.requestCount >= RATE_LIMIT_MAX_REQUESTS) {
            const waitTime = RATE_LIMIT_WINDOW_MS - windowElapsed;
            logger.warn('Rate limit reached, requests will be delayed', {
                waitTime,
                requestCount: this.rateLimitInfo.requestCount,
            });
            throw new Error(`Rate limit reached. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
        }
    }
    /**
     * Track a request for rate limiting
     */
    trackRequest() {
        this.rateLimitInfo.requestCount++;
        logger.debug('Request tracked', {
            requestCount: this.rateLimitInfo.requestCount,
            maxRequests: RATE_LIMIT_MAX_REQUESTS,
        });
    }
    /**
     * Generate a random tunnel secret (base64 encoded 32 bytes)
     */
    generateTunnelSecret() {
        const bytes = crypto.randomBytes(32);
        return bytes.toString('base64');
    }
    /**
     * Sleep for a specified duration
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
