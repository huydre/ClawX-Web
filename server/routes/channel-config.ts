import { Router } from 'express';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { logger } from '../utils/logger.js';

const router = Router();

function getConfigPath(): string {
  return join(homedir(), '.openclaw', 'openclaw.json');
}

function readConfig(): Record<string, unknown> {
  const configPath = getConfigPath();
  try {
    if (existsSync(configPath)) {
      return JSON.parse(readFileSync(configPath, 'utf-8'));
    }
  } catch (err) {
    logger.warn('Failed to read openclaw.json', { err });
  }
  return {};
}

function writeConfig(config: Record<string, unknown>): void {
  const configPath = getConfigPath();
  const dir = join(homedir(), '.openclaw');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

// GET /api/channel-config/:channelType
// Returns channel config from openclaw.json
router.get('/:channelType', (req, res) => {
  try {
    const { channelType } = req.params;
    const config = readConfig();
    const channels = (config.channels || {}) as Record<string, unknown>;
    const channelCfg = (channels[channelType] || {}) as Record<string, unknown>;

    res.json({
      groupPolicy: channelCfg.groupPolicy || 'allowlist',
      pairingPolicy: channelCfg.pairingPolicy || 'code',
      allowFrom: Array.isArray(channelCfg.allowFrom) ? channelCfg.allowFrom : [],
      groupAllowFrom: Array.isArray(channelCfg.groupAllowFrom) ? channelCfg.groupAllowFrom : [],
    });
  } catch (error) {
    logger.error('Get channel config error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// PUT /api/channel-config/:channelType
// Updates channel config in openclaw.json
router.put('/:channelType', (req, res) => {
  try {
    const { channelType } = req.params;
    const { groupPolicy, pairingPolicy, allowFrom, groupAllowFrom } = req.body;

    const config = readConfig();
    const channels = (config.channels || {}) as Record<string, unknown>;
    const channelCfg = (channels[channelType] || {}) as Record<string, unknown>;

    // Only update fields that are provided
    if (groupPolicy !== undefined) channelCfg.groupPolicy = groupPolicy;
    if (pairingPolicy !== undefined) channelCfg.pairingPolicy = pairingPolicy;
    if (allowFrom !== undefined) channelCfg.allowFrom = allowFrom;
    if (groupAllowFrom !== undefined) channelCfg.groupAllowFrom = groupAllowFrom;

    channels[channelType] = channelCfg;
    config.channels = channels;

    writeConfig(config);
    logger.info('Updated channel config', { channelType, groupPolicy, pairingPolicy });

    res.json({ success: true });
  } catch (error) {
    logger.error('Update channel config error:', error);
    res.status(500).json({ error: String(error) });
  }
});

export default router;
