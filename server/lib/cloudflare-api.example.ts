/**
 * Example usage of the Cloudflare API client
 *
 * This file demonstrates how to use the CloudflareAPI class for tunnel
 * and DNS management operations.
 */

import { CloudflareAPI } from './cloudflare-api.js';

/**
 * Example: Basic tunnel creation and management
 */
async function exampleBasicTunnelManagement() {
  // Initialize the API client with your Cloudflare API token
  const apiToken = process.env.CLOUDFLARE_API_TOKEN || 'your-api-token-here';
  const api = new CloudflareAPI(apiToken);

  try {
    // 1. Validate the API token
    console.log('Validating API token...');
    const isValid = await api.validateToken();
    if (!isValid) {
      throw new Error('Invalid API token');
    }
    console.log('✓ Token is valid');

    // 2. Get account ID
    console.log('Getting account ID...');
    const accountId = await api.getAccountId();
    console.log(`✓ Account ID: ${accountId}`);

    // 3. Create a new tunnel
    console.log('Creating tunnel...');
    const tunnel = await api.createTunnel(accountId, 'my-clawx-tunnel');
    console.log(`✓ Tunnel created: ${tunnel.id}`);

    // 4. Get tunnel token (needed for cloudflared daemon)
    console.log('Getting tunnel token...');
    const token = await api.getTunnelToken(accountId, tunnel.id);
    console.log(`✓ Tunnel token retrieved (length: ${token.length})`);

    // 5. Get tunnel info
    console.log('Getting tunnel info...');
    const tunnelInfo = await api.getTunnel(accountId, tunnel.id);
    console.log(`✓ Tunnel info:`, tunnelInfo);

    // 6. List all tunnels
    console.log('Listing all tunnels...');
    const tunnels = await api.listTunnels(accountId);
    console.log(`✓ Found ${tunnels.length} tunnel(s)`);

    // 7. Delete the tunnel (cleanup)
    console.log('Deleting tunnel...');
    await api.deleteTunnel(accountId, tunnel.id);
    console.log('✓ Tunnel deleted');

  } catch (error) {
    console.error('Error:', (error as Error).message);
    throw error;
  }
}

/**
 * Example: DNS record management for custom domains
 */
async function exampleDnsManagement() {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN || 'your-api-token-here';
  const api = new CloudflareAPI(apiToken);

  try {
    // Get account and zone IDs
    const accountId = await api.getAccountId();
    const domain = 'example.com';
    const zoneId = await api.getZoneId(domain);

    // Create a tunnel
    const tunnel = await api.createTunnel(accountId, 'my-app-tunnel');
    console.log(`Tunnel created: ${tunnel.id}`);

    // Create DNS record pointing to the tunnel
    const subdomain = 'app.example.com';
    const dnsRecord = await api.createDnsRecord(zoneId, subdomain, tunnel.id);
    console.log(`DNS record created: ${dnsRecord.name} -> ${dnsRecord.content}`);

    // Later, when cleaning up...
    await api.deleteDnsRecord(zoneId, dnsRecord.id);
    await api.deleteTunnel(accountId, tunnel.id);
    console.log('Cleanup complete');

  } catch (error) {
    console.error('Error:', (error as Error).message);
    throw error;
  }
}

/**
 * Example: Error handling and validation
 */
async function exampleErrorHandling() {
  try {
    // Invalid token
    const invalidApi = new CloudflareAPI('invalid-token');
    const isValid = await invalidApi.validateToken();

    if (!isValid) {
      console.log('Token validation failed as expected');
    }

  } catch (error) {
    console.error('Caught error:', (error as Error).message);
  }

  try {
    // Empty token should throw immediately
    new CloudflareAPI('');
  } catch (error) {
    console.log('Empty token rejected:', (error as Error).message);
  }
}

/**
 * Example: Integration with cloudflared daemon
 */
async function exampleCloudflaredIntegration() {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN || 'your-api-token-here';
  const api = new CloudflareAPI(apiToken);

  try {
    const accountId = await api.getAccountId();

    // Create tunnel
    const tunnel = await api.createTunnel(accountId, 'clawx-web-tunnel');

    // Get token for cloudflared
    const tunnelToken = await api.getTunnelToken(accountId, tunnel.id);

    // Now you can start cloudflared with this token:
    // cloudflared tunnel run --token <tunnelToken>

    console.log('Tunnel ready for cloudflared daemon');
    console.log(`Command: cloudflared tunnel run --token ${tunnelToken.substring(0, 20)}...`);

    // The tunnel token contains all necessary configuration
    // including the tunnel ID, credentials, and routing information

    return { tunnel, tunnelToken };

  } catch (error) {
    console.error('Error:', (error as Error).message);
    throw error;
  }
}

/**
 * Example: Rate limit handling
 */
async function exampleRateLimitHandling() {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN || 'your-api-token-here';
  const api = new CloudflareAPI(apiToken);

  try {
    const accountId = await api.getAccountId();

    // The API client automatically tracks rate limits
    // Maximum 1200 requests per 5 minutes

    // If you hit the rate limit, the client will:
    // 1. Wait for the Retry-After period (if provided by Cloudflare)
    // 2. Retry the request automatically
    // 3. Throw an error if max retries exceeded

    for (let i = 0; i < 10; i++) {
      const tunnels = await api.listTunnels(accountId);
      console.log(`Request ${i + 1}: Found ${tunnels.length} tunnels`);

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

  } catch (error) {
    if ((error as Error).message.includes('Rate limit')) {
      console.log('Rate limit reached, please wait before retrying');
    }
    throw error;
  }
}

// Export examples for testing
export {
  exampleBasicTunnelManagement,
  exampleDnsManagement,
  exampleErrorHandling,
  exampleCloudflaredIntegration,
  exampleRateLimitHandling,
};

// Run examples if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Running Cloudflare API examples...\n');

  // Uncomment the example you want to run:
  // await exampleBasicTunnelManagement();
  // await exampleDnsManagement();
  // await exampleErrorHandling();
  // await exampleCloudflaredIntegration();
  // await exampleRateLimitHandling();

  console.log('\nNote: Set CLOUDFLARE_API_TOKEN environment variable to run examples');
}
