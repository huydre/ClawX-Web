/**
 * Agents Config Routes
 * Read/write cross-agent settings in ~/.openclaw/openclaw.json
 *
 * Config paths:
 *   tools.sessions.visibility: "self" | "tree" | "agent" | "all"
 *   tools.agentToAgent.enabled: boolean
 *   tools.agentToAgent.allow: string[]
 */
import { Router } from 'express';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { logger } from '../utils/logger.js';

const router = Router();

function getConfigPath(): string {
  return join(homedir(), '.openclaw', 'openclaw.json');
}

function readConfig(): Record<string, any> {
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

function writeConfig(config: Record<string, any>): void {
  const configPath = getConfigPath();
  const dir = join(homedir(), '.openclaw');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

// GET /api/agents-config/cross-agent
router.get('/cross-agent', (_req, res) => {
  try {
    const config = readConfig();
    const tools = config.tools || {};
    const sessions = tools.sessions || {};
    const agentToAgent = tools.agentToAgent || {};

    res.json({
      sessionsVisibility: sessions.visibility || 'tree',
      agentToAgentEnabled: agentToAgent.enabled || false,
      agentToAgentAllow: agentToAgent.allow || [],
    });
  } catch (error) {
    logger.error('Get cross-agent config error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// PUT /api/agents-config/cross-agent
router.put('/cross-agent', (req, res) => {
  try {
    const { sessionsVisibility, agentToAgentEnabled, agentToAgentAllow } = req.body;
    const config = readConfig();

    if (!config.tools) config.tools = {};

    // Set tools.sessions.visibility
    if (sessionsVisibility !== undefined) {
      if (!config.tools.sessions) config.tools.sessions = {};
      config.tools.sessions.visibility = sessionsVisibility;
    }

    // Set tools.agentToAgent
    if (agentToAgentEnabled !== undefined || agentToAgentAllow !== undefined) {
      if (!config.tools.agentToAgent) config.tools.agentToAgent = {};
      if (agentToAgentEnabled !== undefined) {
        config.tools.agentToAgent.enabled = agentToAgentEnabled;
      }
      if (agentToAgentAllow !== undefined) {
        config.tools.agentToAgent.allow = agentToAgentAllow;
      }
    }

    writeConfig(config);
    res.json({ success: true });
  } catch (error) {
    logger.error('Set cross-agent config error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// ── Bindings ────────────────────────────────────────────────

// GET /api/agents-config/bindings
// Returns all bindings from openclaw.json
router.get('/bindings', (_req, res) => {
  try {
    const config = readConfig();
    const bindings = Array.isArray(config.bindings) ? config.bindings : [];
    res.json({ bindings });
  } catch (error) {
    logger.error('Get bindings error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// GET /api/agents-config/bindings/:agentId
// Returns bindings for a specific agent
router.get('/bindings/:agentId', (req, res) => {
  try {
    const { agentId } = req.params;
    const config = readConfig();
    const allBindings = Array.isArray(config.bindings) ? config.bindings : [];
    const agentBindings = allBindings.filter(
      (b: any) => b.agentId === agentId
    );
    res.json({ bindings: agentBindings });
  } catch (error) {
    logger.error('Get agent bindings error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// PUT /api/agents-config/bindings/:agentId
// Replace all bindings for a specific agent
router.put('/bindings/:agentId', (req, res) => {
  try {
    const { agentId } = req.params;
    const { bindings: newBindings } = req.body as { bindings: Array<{ match: any }> };

    if (!Array.isArray(newBindings)) {
      return res.status(400).json({ error: 'bindings must be an array' });
    }

    const config = readConfig();
    const allBindings = Array.isArray(config.bindings) ? config.bindings : [];

    // Remove existing bindings for this agent, add new ones
    const otherBindings = allBindings.filter((b: any) => b.agentId !== agentId);
    const agentBindings = newBindings.map((b) => ({
      agentId,
      match: b.match,
    }));

    config.bindings = [...otherBindings, ...agentBindings];
    writeConfig(config);

    res.json({ success: true });
  } catch (error) {
    logger.error('Set agent bindings error:', error);
    res.status(500).json({ error: String(error) });
  }
});

export default router;
