import { Router } from 'express';
import { spawn } from 'child_process';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import path from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const router = Router();
// Get ClawHub CLI path
const getClawHubCliPath = () => {
    return path.join(__dirname, '../../node_modules/.bin/clawhub');
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
        const workDir = path.join(homedir(), '.openclaw');
        logger.info('Running ClawHub command', { args, workDir });
        const child = spawn(cliPath, args, {
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
            logger.error('ClawHub process error', { error });
            reject(error);
        });
        child.on('close', (code) => {
            if (code !== 0 && code !== null) {
                logger.error('ClawHub command failed', { code, stderr });
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
const searchSchema = z.object({
    query: z.string(),
    limit: z.number().optional(),
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
        logger.error('ClawHub search error', { error });
        res.status(500).json({ success: false, error: String(error) });
    }
});
// POST /api/clawhub/install
const installSchema = z.object({
    slug: z.string(),
    version: z.string().optional(),
    force: z.boolean().optional(),
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
        logger.error('ClawHub install error', { error });
        res.status(500).json({ success: false, error: String(error) });
    }
});
// POST /api/clawhub/uninstall
const uninstallSchema = z.object({
    slug: z.string(),
});
router.post('/uninstall', async (req, res) => {
    try {
        const { slug } = uninstallSchema.parse(req.body);
        // Delete skill directory and update lock file
        const fs = await import('fs/promises');
        const skillDir = path.join(homedir(), '.openclaw', 'skills', slug);
        if (await fs.stat(skillDir).catch(() => null)) {
            await fs.rm(skillDir, { recursive: true, force: true });
        }
        // Remove from lock.json
        const lockFile = path.join(homedir(), '.openclaw', '.clawhub', 'lock.json');
        try {
            const lockData = JSON.parse(await fs.readFile(lockFile, 'utf8'));
            if (lockData.skills && lockData.skills[slug]) {
                delete lockData.skills[slug];
                await fs.writeFile(lockFile, JSON.stringify(lockData, null, 2));
            }
        }
        catch (err) {
            logger.warn('Failed to update lock file', { err });
        }
        res.json({ success: true });
    }
    catch (error) {
        logger.error('ClawHub uninstall error', { error });
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
        logger.error('ClawHub list error', { error });
        res.status(500).json({ success: false, error: String(error) });
    }
});
export default router;
