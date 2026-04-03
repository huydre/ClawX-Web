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
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { logger } from '../utils/logger.js';
const router = Router();
function getConfigPath() {
    return join(homedir(), '.openclaw', 'openclaw.json');
}
function readConfig() {
    const configPath = getConfigPath();
    try {
        if (existsSync(configPath)) {
            return JSON.parse(readFileSync(configPath, 'utf-8'));
        }
    }
    catch (err) {
        logger.warn('Failed to read openclaw.json', { err });
    }
    return {};
}
function writeConfig(config) {
    const configPath = getConfigPath();
    const dir = join(homedir(), '.openclaw');
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
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
    }
    catch (error) {
        logger.error('Get cross-agent config error:', error);
        res.status(500).json({ error: String(error) });
    }
});
// PUT /api/agents-config/cross-agent
router.put('/cross-agent', (req, res) => {
    try {
        const { sessionsVisibility, agentToAgentEnabled, agentToAgentAllow } = req.body;
        const config = readConfig();
        if (!config.tools)
            config.tools = {};
        // Set tools.sessions.visibility
        if (sessionsVisibility !== undefined) {
            if (!config.tools.sessions)
                config.tools.sessions = {};
            config.tools.sessions.visibility = sessionsVisibility;
        }
        // Set tools.agentToAgent
        if (agentToAgentEnabled !== undefined || agentToAgentAllow !== undefined) {
            if (!config.tools.agentToAgent)
                config.tools.agentToAgent = {};
            if (agentToAgentEnabled !== undefined) {
                config.tools.agentToAgent.enabled = agentToAgentEnabled;
            }
            if (agentToAgentAllow !== undefined) {
                config.tools.agentToAgent.allow = agentToAgentAllow;
            }
        }
        writeConfig(config);
        res.json({ success: true });
    }
    catch (error) {
        logger.error('Set cross-agent config error:', error);
        res.status(500).json({ error: String(error) });
    }
});
// ── Agent Detail from config ────────────────────────────────
// GET /api/agents-config/detail/:agentId
// Returns agent config details from openclaw.json (model, workspace, etc.)
router.get('/detail/:agentId', (req, res) => {
    try {
        const { agentId } = req.params;
        const config = readConfig();
        const agents = config.agents;
        const agentList = agents?.list || [];
        const agent = agentList.find((a) => a.id === agentId);
        if (!agent) {
            logger.warn('Agent not found in config', { agentId, availableIds: agentList.map((a) => a.id) });
            return res.json({ found: false });
        }
        // Get default model
        const defaultModel = typeof agents?.defaults?.model === 'string'
            ? agents.defaults.model
            : agents?.defaults?.model?.primary || '';
        // Get channel binding info
        const bindings = Array.isArray(config.bindings) ? config.bindings : [];
        const agentBindings = bindings.filter((b) => b.agentId === agentId);
        // Get channel account info (botToken masked)
        const channels = config.channels || {};
        let channelInfo = null;
        for (const binding of agentBindings) {
            const chType = binding.match?.channel;
            const acctId = binding.match?.accountId;
            if (chType && channels[chType]?.accounts?.[acctId]) {
                const acct = channels[chType].accounts[acctId];
                channelInfo = {
                    type: chType,
                    accountId: acctId,
                    dmPolicy: acct.dmPolicy || 'pairing',
                };
                break;
            }
        }
        // Check auth profiles
        const authPath = join(agent.agentDir || join(homedir(), '.openclaw', 'agents', agentId, 'agent'), 'auth-profiles.json');
        let hasAuth = false;
        let authProviders = [];
        try {
            if (existsSync(authPath)) {
                const authData = JSON.parse(readFileSync(authPath, 'utf-8'));
                const profiles = authData.profiles || {};
                authProviders = [...new Set(Object.keys(profiles).map((k) => k.split(':')[0]))];
                hasAuth = authProviders.length > 0;
            }
        }
        catch { /* ignore */ }
        res.json({
            found: true,
            model: agent.model || defaultModel,
            defaultModel,
            workspace: agent.workspace || agents?.defaults?.workspace || '',
            channelInfo,
            hasAuth,
            authProviders,
        });
    }
    catch (error) {
        logger.error('Get agent detail error:', error);
        res.status(500).json({ error: String(error) });
    }
});
// PUT /api/agents-config/detail/:agentId
// Update agent config in openclaw.json directly (model, etc.)
router.put('/detail/:agentId', (req, res) => {
    try {
        const { agentId } = req.params;
        const { model } = req.body;
        const config = readConfig();
        const agents = config.agents;
        const agentList = agents?.list || [];
        const agentIdx = agentList.findIndex((a) => a.id === agentId);
        if (agentIdx < 0) {
            return res.status(404).json({ error: 'Agent not found' });
        }
        if (model !== undefined) {
            if (model) {
                agentList[agentIdx].model = model;
            }
            else {
                delete agentList[agentIdx].model;
            }
        }
        writeConfig(config);
        res.json({ success: true });
    }
    catch (error) {
        logger.error('Update agent detail error:', error);
        res.status(500).json({ error: String(error) });
    }
});
// ── Copy Auth Profile ───────────────────────────────────────
// POST /api/agents-config/copy-auth/:agentId
// Copy auth-profiles.json from source agent (default: main) to target agent
router.post('/copy-auth/:agentId', (req, res) => {
    try {
        const { agentId } = req.params;
        const { sourceAgentId = 'main' } = req.body || {};
        const home = homedir();
        const config = readConfig();
        const agents = config.agents?.list || [];
        // Resolve agent dirs
        const sourceAgent = agents.find((a) => a.id === sourceAgentId);
        const targetAgent = agents.find((a) => a.id === agentId);
        const sourceDir = sourceAgent?.agentDir || join(home, '.openclaw', 'agents', sourceAgentId, 'agent');
        const targetDir = targetAgent?.agentDir || join(home, '.openclaw', 'agents', agentId, 'agent');
        const sourceFile = join(sourceDir, 'auth-profiles.json');
        const targetFile = join(targetDir, 'auth-profiles.json');
        if (!existsSync(sourceFile)) {
            return res.status(400).json({ error: `Source agent "${sourceAgentId}" has no auth-profiles.json` });
        }
        // Ensure target dir exists
        mkdirSync(targetDir, { recursive: true });
        // Copy
        copyFileSync(sourceFile, targetFile);
        logger.info('Copied auth profiles', { from: sourceAgentId, to: agentId });
        res.json({ success: true });
    }
    catch (error) {
        logger.error('Copy auth error:', error);
        res.status(500).json({ error: String(error) });
    }
});
// GET /api/agents-config/auth-sources
// List agents that have auth-profiles configured
router.get('/auth-sources', (_req, res) => {
    try {
        const config = readConfig();
        const agents = config.agents?.list || [];
        const sources = [];
        const home = homedir();
        for (const agent of agents) {
            const agentDir = agent.agentDir || join(home, '.openclaw', 'agents', agent.id, 'agent');
            const authFile = join(agentDir, 'auth-profiles.json');
            try {
                if (existsSync(authFile)) {
                    const data = JSON.parse(readFileSync(authFile, 'utf-8'));
                    const profiles = data.profiles || {};
                    const providers = [...new Set(Object.keys(profiles).map((k) => k.split(':')[0]))];
                    if (providers.length > 0) {
                        sources.push({ id: agent.id, name: agent.name || agent.id, providers });
                    }
                }
            }
            catch { /* skip */ }
        }
        res.json({ sources });
    }
    catch (error) {
        logger.error('Get auth sources error:', error);
        res.status(500).json({ error: String(error) });
    }
});
// ── Workspace Skills ────────────────────────────────────────
// GET /api/agents-config/workspace-skills/:agentId
// Lists skill directories in agent's workspace/skills/
router.get('/workspace-skills/:agentId', (req, res) => {
    try {
        const { agentId } = req.params;
        const config = readConfig();
        const agents = config.agents;
        const agentList = agents?.list || [];
        const agent = agentList.find((a) => a.id === agentId);
        if (!agent) {
            return res.json({ skills: [], workspace: '' });
        }
        const workspace = agent.workspace || agents?.defaults?.workspace || '';
        if (!workspace) {
            return res.json({ skills: [], workspace: '' });
        }
        const skillsDir = join(workspace, 'skills');
        const skills = [];
        try {
            const entries = readdirSync(skillsDir);
            for (const entry of entries) {
                try {
                    const entryPath = join(skillsDir, entry);
                    if (statSync(entryPath).isDirectory()) {
                        const skillMdPath = join(entryPath, 'SKILL.md');
                        let hasSkillMd = false;
                        let description = '';
                        try {
                            const content = readFileSync(skillMdPath, 'utf-8');
                            hasSkillMd = true;
                            // Extract first non-empty, non-heading line as description
                            const lines = content.split('\n');
                            for (const line of lines) {
                                const trimmed = line.trim();
                                if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---')) {
                                    description = trimmed.slice(0, 120);
                                    break;
                                }
                            }
                        }
                        catch { /* no SKILL.md */ }
                        skills.push({ name: entry, hasSkillMd, description });
                    }
                }
                catch { /* skip */ }
            }
        }
        catch { /* skills dir doesn't exist */ }
        res.json({ skills, workspace });
    }
    catch (error) {
        logger.error('Get workspace skills error:', error);
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
    }
    catch (error) {
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
        const agentBindings = allBindings.filter((b) => b.agentId === agentId);
        res.json({ bindings: agentBindings });
    }
    catch (error) {
        logger.error('Get agent bindings error:', error);
        res.status(500).json({ error: String(error) });
    }
});
// PUT /api/agents-config/bindings/:agentId
// Replace all bindings for a specific agent
router.put('/bindings/:agentId', (req, res) => {
    try {
        const { agentId } = req.params;
        const { bindings: newBindings } = req.body;
        if (!Array.isArray(newBindings)) {
            return res.status(400).json({ error: 'bindings must be an array' });
        }
        const config = readConfig();
        const allBindings = Array.isArray(config.bindings) ? config.bindings : [];
        // Remove existing bindings for this agent, add new ones
        const otherBindings = allBindings.filter((b) => b.agentId !== agentId);
        const agentBindings = newBindings.map((b) => ({
            agentId,
            match: b.match,
        }));
        config.bindings = [...otherBindings, ...agentBindings];
        writeConfig(config);
        res.json({ success: true });
    }
    catch (error) {
        logger.error('Set agent bindings error:', error);
        res.status(500).json({ error: String(error) });
    }
});
export default router;
