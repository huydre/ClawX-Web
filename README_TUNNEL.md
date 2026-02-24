# Cloudflare Tunnel Integration

**Status:** ✅ Production Ready  
**Version:** 1.0.0  
**Date:** 2026-02-24  
**Phase:** 7/7 Complete

---

## Overview

The Cloudflare Tunnel integration allows ClawX-Web to be securely exposed to the internet without opening ports or configuring firewalls. This feature supports both quick temporary tunnels and persistent named tunnels with custom domains.

## Features

### Quick Tunnel
- **One-click setup** - No configuration required
- **Random URL** - Automatically generated secure URL
- **Temporary** - Perfect for testing and demos
- **Auto-download** - Cloudflared binary downloaded automatically

### Named Tunnel
- **Custom domain** - Use your own domain name
- **Persistent** - Tunnel configuration saved
- **DNS automation** - Automatic DNS record creation
- **API token validation** - Verify credentials before setup

### Robust Operation
- **Auto-reconnect** - Reconnects automatically on failure (5 attempts)
- **Binary management** - Automatic download with retry (3 attempts)
- **Status monitoring** - Real-time status with uptime tracking
- **Error handling** - Comprehensive error messages and recovery

## Quick Start

### Quick Tunnel (No Configuration)

1. Navigate to **Settings** → **Cloudflare Tunnel**
2. Click the **Quick Tunnel** tab
3. Toggle **Enable Quick Tunnel** to ON
4. Wait for the public URL to appear
5. Copy the URL and share it

### Named Tunnel (Custom Domain)

1. Get a Cloudflare API token:
   - Go to https://dash.cloudflare.com/profile/api-tokens
   - Create token with **Cloudflare Tunnel** permissions
   
2. Navigate to **Settings** → **Cloudflare Tunnel**
3. Click the **Named Tunnel** tab
4. Enter your API token and click **Validate**
5. Enter a tunnel name (e.g., `my-clawx-tunnel`)
6. (Optional) Enter a custom domain from your Cloudflare account
7. Click **Setup Tunnel**
8. Toggle **Enable Named Tunnel** to ON

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         ClawX-Web                           │
│                                                             │
│  ┌──────────────┐      ┌──────────────┐                   │
│  │   Frontend   │◄────►│   Backend    │                   │
│  │              │      │              │                   │
│  │ TunnelSettings│      │ Tunnel Routes│                   │
│  │   Component  │      │   /api/tunnel│                   │
│  └──────────────┘      └──────┬───────┘                   │
│                               │                            │
│                        ┌──────▼───────┐                    │
│                        │Tunnel Manager│                    │
│                        └──────┬───────┘                    │
│                               │                            │
│                        ┌──────▼───────┐                    │
│                        │  cloudflared │                    │
│                        │    binary    │                    │
│                        └──────┬───────┘                    │
└───────────────────────────────┼─────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Cloudflare Network   │
                    │  (Edge Servers)       │
                    └───────────┬───────────┘
                                │
                                ▼
                          Internet Users
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tunnel/status` | Get current tunnel status |
| POST | `/api/tunnel/quick/start` | Start quick tunnel |
| POST | `/api/tunnel/quick/stop` | Stop quick tunnel |
| POST | `/api/tunnel/setup` | Setup named tunnel |
| POST | `/api/tunnel/start` | Start named tunnel |
| POST | `/api/tunnel/stop` | Stop named tunnel |
| DELETE | `/api/tunnel/teardown` | Remove tunnel config |
| POST | `/api/tunnel/validate-token` | Validate API token |

## File Structure

```
server/
├── services/
│   ├── cloudflared-binary-manager.ts  # Binary download & management
│   └── tunnel-manager.ts              # Tunnel lifecycle management
├── lib/
│   └── cloudflare-api.ts              # Cloudflare API client
└── routes/
    └── tunnel.ts                      # API routes

src/
├── stores/
│   └── tunnel.ts                      # State management
└── components/
    └── settings/
        └── TunnelSettings.tsx         # UI component
```

## Configuration

### Storage Locations

- **Binary:** `~/.clawx-web/bin/cloudflared`
- **Config:** `~/.clawx-web/cloudflare/`
- **Database:** `~/.clawx/db.json`

### Database Schema

```typescript
interface CloudflareSettings {
  enabled: boolean;
  tunnelId?: string;
  tunnelName?: string;
  tunnelToken?: string;
  accountId?: string;
  domain?: string;
  createdAt?: string;
  updatedAt?: string;
}
```

## Troubleshooting

### Binary Download Fails

**Problem:** Binary download fails or times out

**Solution:**
- Check internet connection
- Verify GitHub is accessible
- Wait and retry (automatic retry with exponential backoff)
- Manually download from: https://github.com/cloudflare/cloudflared/releases

### Tunnel Won't Start

**Problem:** Tunnel fails to start or connect

**Solution:**
- Check if port 2003 is accessible
- Verify firewall settings
- Check logs for error messages
- Ensure cloudflared binary has execute permissions

### Invalid API Token

**Problem:** API token validation fails

**Solution:**
- Verify token has Cloudflare Tunnel permissions
- Check token hasn't expired
- Create new token at: https://dash.cloudflare.com/profile/api-tokens
- Required permissions: `Account.Cloudflare Tunnel:Edit`

### DNS Not Resolving

**Problem:** Custom domain doesn't resolve

**Solution:**
- Wait for DNS propagation (can take up to 5 minutes)
- Verify domain is in your Cloudflare account
- Check DNS records in Cloudflare dashboard
- Ensure CNAME record was created correctly

### Auto-Reconnect Not Working

**Problem:** Tunnel doesn't reconnect after crash

**Solution:**
- Check if max reconnect attempts (5) exceeded
- Restart tunnel manually from UI
- Check system resources (CPU, memory)
- Review logs for error patterns

## Security Considerations

### API Token Storage
- API tokens are stored locally only
- Never transmitted to external servers
- Not persisted after tunnel teardown
- Stored in encrypted database file

### Tunnel Security
- All connections encrypted with TLS
- Cloudflare handles certificate management
- No ports opened on local machine
- Traffic routed through Cloudflare network

### Best Practices
- Use named tunnels for production
- Rotate API tokens regularly
- Monitor tunnel logs for suspicious activity
- Use strong, unique tunnel names
- Limit API token permissions to minimum required

## Performance

### Resource Usage
- **Memory:** ~50-100MB (cloudflared process)
- **CPU:** <5% (idle), ~10-20% (active traffic)
- **Network:** Depends on traffic volume
- **Disk:** ~50MB (binary + config)

### Limitations
- Single tunnel per instance
- 4 connections per tunnel (Cloudflare default)
- No bandwidth metrics available
- Platform detection hardcoded (linux-arm64)

## Development

### Running Tests

```bash
# Build frontend
npm run build

# Build server
npm run build:server

# Run linter
npm run lint

# Type check
npm run typecheck
```

### Adding New Features

1. Update `tunnel-manager.ts` for backend logic
2. Update `TunnelSettings.tsx` for UI
3. Add translations to `settings.json` files
4. Update API routes in `tunnel.ts`
5. Add tests and documentation

## Translations

Supported languages:
- 🇬🇧 English (`en`)
- 🇯🇵 Japanese (`ja`)
- 🇨🇳 Chinese (`zh`)

Translation files: `src/i18n/locales/*/settings.json`

## Future Improvements

### Priority 1 (High)
- [ ] Dynamic platform detection for binary downloads
- [ ] WebSocket for real-time status updates
- [ ] Health checks on tunnel URLs

### Priority 2 (Medium)
- [ ] Tunnel metrics dashboard
- [ ] Multiple concurrent tunnels
- [ ] Configuration backup/restore

### Priority 3 (Low)
- [ ] Cloudflared logs viewer in UI
- [ ] Advanced DNS management
- [ ] Bandwidth usage tracking

## Documentation

- **Test Report:** [TUNNEL_TEST_REPORT.md](./TUNNEL_TEST_REPORT.md)
- **Phase Summary:** [PHASE_7_SUMMARY.md](./PHASE_7_SUMMARY.md)
- **Bug Fixes:** [BUGS_FIXED.md](./BUGS_FIXED.md)
- **Completion Report:** [PHASE_7_COMPLETE.txt](./PHASE_7_COMPLETE.txt)

## Support

### Resources
- Cloudflare Tunnel Docs: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
- Cloudflared GitHub: https://github.com/cloudflare/cloudflared
- ClawX Website: https://claw-x.com
- ClawX GitHub: https://github.com/ValueCell-ai/ClawX

### Common Issues
- Check [Troubleshooting](#troubleshooting) section above
- Review logs in Settings → Gateway → Logs
- Check Cloudflare dashboard for tunnel status
- Verify API token permissions

## License

This feature is part of ClawX-Web and follows the same license.

---

**Version:** 1.0.0  
**Last Updated:** 2026-02-24  
**Maintained By:** ClawX Team
