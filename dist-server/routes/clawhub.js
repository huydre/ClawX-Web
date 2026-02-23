"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const child_process_1 = require("child_process");
const zod_1 = require("zod");
const logger_1 = require("../utils/logger");
const path_1 = __importDefault(require("path"));
const os_1 = require("os");
const router = (0, express_1.Router)();
// Get ClawHub CLI path
const getClawHubCliPath = () => {
    return path_1.default.join(__dirname, '../../node_modules/.bin/clawhub');
};
// Strip ANSI codes from output
const stripAnsi = (str) => {
    const ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
    return str.replace(ansiRegex, '');
};
// Run ClawHub CLI command
const runClawHubCommand = (args) => {
    return new Promise((resolve, reject) => {
        const cliPath = getClawHubCliPath();
        const workDir = path_1.default.join((0, os_1.homedir)(), '.openclaw');
        logger_1.logger.info('Running ClawHub command', { args, workDir });
        const child = (0, child_process_1.spawn)(cliPath, args, {
            cwd: workDir,
            env: {
                ...process.env,
                CLAWHUB_WORKDIR: workDir,
                FORCE_COLOR: '0',
            },
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        child.on('error', (error) => {
            logger_1.logger.error('ClawHub process error', { error });
            reject(error);
        });
        child.on('close', (code) => {
            if (code !== 0 && code !== null) {
                logger_1.logger.error('ClawHub command failed', { code, stderr });
                reject(new Error(`Command failed: ${stderr || stdout}`));
            }
            else {
                resolve(stdout.trim());
            }
        });
    });
};
// Parse search/explore output
const parseSkillList = (output) => {
    if (!output || output.includes('No skills found')) {
        return [];
    }
    const lines = output.split('\n').filter(l => l.trim() && !l.includes('Searching') && !l.includes('Fetching'));
    return lines.map(line => {
        const cleanLine = stripAnsi(line);
        // Format: slug vversion description (score)
        // Or: slug vversion time description (for explore)
        const match = cleanLine.match(/^(\S+)\s+v?(\d+\.\S+)\s+(.+)$/);
        if (match) {
            const slug = match[1];
            const version = match[2];
            let description = match[3];
            // Clean up score if present
            description = description.replace(/\(\d+\.\d+\)$/, '').trim();
            // Clean up time if present (for explore)
            description = description.replace(/^(.+? ago|just now|yesterday)\s+/, '').trim();
            return {
                slug,
                name: slug,
                version,
                description,
            };
        }
        return null;
    }).filter((s) => s !== null);
};
// POST /api/clawhub/search
const searchSchema = zod_1.z.object({
    query: zod_1.z.string(),
    limit: zod_1.z.number().optional(),
});
router.post('/search', async (req, res) => {
    try {
        const { query, limit } = searchSchema.parse(req.body);
        // If query is empty, use explore
        if (!query || query.trim() === '') {
            const args = ['explore'];
            if (limit)
                args.push('--limit', String(limit));
            const output = await runClawHubCommand(args);
            const results = parseSkillList(output);
            return res.json({ success: true, results });
        }
        const args = ['search', query];
        if (limit)
            args.push('--limit', String(limit));
        const output = await runClawHubCommand(args);
        const results = parseSkillList(output);
        res.json({ success: true, results });
    }
    catch (error) {
        logger_1.logger.error('ClawHub search error', { error });
        res.status(500).json({ success: false, error: String(error) });
    }
});
// POST /api/clawhub/install
const installSchema = zod_1.z.object({
    slug: zod_1.z.string(),
    version: zod_1.z.string().optional(),
    force: zod_1.z.boolean().optional(),
});
router.post('/install', async (req, res) => {
    try {
        const { slug, version, force } = installSchema.parse(req.body);
        const args = ['install', slug];
        if (version)
            args.push('--version', version);
        if (force)
            args.push('--force');
        await runClawHubCommand(args);
        res.json({ success: true });
    }
    catch (error) {
        logger_1.logger.error('ClawHub install error', { error });
        res.status(500).json({ success: false, error: String(error) });
    }
});
// POST /api/clawhub/uninstall
const uninstallSchema = zod_1.z.object({
    slug: zod_1.z.string(),
});
router.post('/uninstall', async (req, res) => {
    try {
        const { slug } = uninstallSchema.parse(req.body);
        // Delete skill directory and update lock file
        const fs = await import('fs/promises');
        const skillDir = path_1.default.join((0, os_1.homedir)(), '.openclaw', 'skills', slug);
        if (await fs.stat(skillDir).catch(() => null)) {
            await fs.rm(skillDir, { recursive: true, force: true });
        }
        // Remove from lock.json
        const lockFile = path_1.default.join((0, os_1.homedir)(), '.openclaw', '.clawhub', 'lock.json');
        try {
            const lockData = JSON.parse(await fs.readFile(lockFile, 'utf8'));
            if (lockData.skills && lockData.skills[slug]) {
                delete lockData.skills[slug];
                await fs.writeFile(lockFile, JSON.stringify(lockData, null, 2));
            }
        }
        catch (err) {
            logger_1.logger.warn('Failed to update lock file', { err });
        }
        res.json({ success: true });
    }
    catch (error) {
        logger_1.logger.error('ClawHub uninstall error', { error });
        res.status(500).json({ success: false, error: String(error) });
    }
});
// GET /api/clawhub/list
router.get('/list', async (_req, res) => {
    try {
        const output = await runClawHubCommand(['list']);
        const results = parseSkillList(output);
        res.json({ success: true, results });
    }
    catch (error) {
        logger_1.logger.error('ClawHub list error', { error });
        res.status(500).json({ success: false, error: String(error) });
    }
});
exports.default = router;
