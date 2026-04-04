/**
 * USB Device Monitor — watches for USB block devices on Linux.
 * Uses lsblk + udisksctl for detection/mounting (no root required).
 * Gracefully returns empty results on non-Linux platforms.
 */
import { EventEmitter } from 'events';
import { execSync, execFile } from 'child_process';
import { existsSync, readdirSync, statSync, copyFileSync, mkdirSync } from 'fs';
import { join, extname, relative } from 'path';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';
import { platform } from 'os';
const execFileAsync = promisify(execFile);
const FILE_CATEGORIES = {
    documents: ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt', '.xls', '.xlsx', '.ppt', '.pptx', '.md'],
    code: ['.ts', '.js', '.py', '.java', '.c', '.cpp', '.h', '.go', '.rs', '.rb', '.php', '.html', '.css', '.json', '.yaml', '.yml', '.toml', '.xml', '.sh', '.bash'],
    data: ['.csv', '.tsv', '.sql', '.db', '.sqlite', '.parquet', '.avro', '.jsonl', '.ndjson', '.log'],
    media: ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.mp3', '.mp4', '.wav', '.avi', '.mkv', '.mov', '.webm', '.webp', '.bmp', '.ico'],
};
const MAX_FILE_SCAN = 10000;
const POLL_INTERVAL_MS = 3000;
function categorizeFile(filename) {
    const ext = extname(filename).toLowerCase();
    for (const [category, extensions] of Object.entries(FILE_CATEGORIES)) {
        if (extensions.includes(ext)) {
            return category;
        }
    }
    return 'other';
}
function parseSize(sizeStr) {
    if (!sizeStr)
        return 0;
    const match = sizeStr.match(/^([\d.]+)([KMGTP]?)$/i);
    if (!match)
        return parseInt(sizeStr, 10) || 0;
    const num = parseFloat(match[1]);
    const unit = (match[2] || '').toUpperCase();
    const multipliers = { '': 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4, P: 1024 ** 5 };
    return Math.round(num * (multipliers[unit] || 1));
}
export class UsbMonitor extends EventEmitter {
    devices = new Map();
    pollTimer = null;
    isLinux;
    constructor() {
        super();
        this.isLinux = platform() === 'linux';
    }
    start() {
        if (!this.isLinux) {
            logger.info('USB monitor: not on Linux, running in no-op mode');
            return;
        }
        logger.info('USB monitor started (polling every 3s)');
        this.poll(); // initial poll
        this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
    }
    stop() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        logger.info('USB monitor stopped');
    }
    getDevices() {
        return Array.from(this.devices.values());
    }
    getFiles(deviceId, subPath) {
        const device = this.devices.get(deviceId);
        if (!device || device.status !== 'ready')
            return [];
        const targetDir = subPath ? join(device.mountPath, subPath) : device.mountPath;
        try {
            if (!existsSync(targetDir))
                return [];
            const entries = readdirSync(targetDir);
            const files = [];
            for (const entry of entries) {
                // Skip hidden files
                if (entry.startsWith('.'))
                    continue;
                try {
                    const absPath = join(targetDir, entry);
                    const stat = statSync(absPath);
                    const relPath = relative(device.mountPath, absPath);
                    files.push({
                        name: entry,
                        path: relPath,
                        absolutePath: absPath,
                        size: stat.size,
                        isDirectory: stat.isDirectory(),
                        modified: stat.mtime.toISOString(),
                        category: stat.isDirectory() ? 'other' : categorizeFile(entry),
                    });
                }
                catch {
                    // Skip files we can't stat
                }
            }
            return files.sort((a, b) => {
                if (a.isDirectory !== b.isDirectory)
                    return a.isDirectory ? -1 : 1;
                return a.name.localeCompare(b.name);
            });
        }
        catch (err) {
            logger.warn('USB monitor: failed to list files', { deviceId, subPath, error: err });
            return [];
        }
    }
    readFile(deviceId, filePath, maxBytes = 100 * 1024) {
        const device = this.devices.get(deviceId);
        if (!device || device.status !== 'ready')
            return null;
        const absPath = join(device.mountPath, filePath);
        // Security: ensure path is within mount
        if (!absPath.startsWith(device.mountPath))
            return null;
        try {
            if (!existsSync(absPath))
                return null;
            const stat = statSync(absPath);
            if (stat.isDirectory())
                return null;
            const truncated = stat.size > maxBytes;
            const buffer = Buffer.alloc(Math.min(stat.size, maxBytes));
            const fd = require('fs').openSync(absPath, 'r');
            require('fs').readSync(fd, buffer, 0, buffer.length, 0);
            require('fs').closeSync(fd);
            return { content: buffer.toString('utf-8'), truncated };
        }
        catch (err) {
            logger.warn('USB monitor: failed to read file', { deviceId, filePath, error: err });
            return null;
        }
    }
    async eject(deviceId) {
        const device = this.devices.get(deviceId);
        if (!device)
            return false;
        try {
            device.status = 'ejecting';
            this.emit('status-change', deviceId, 'ejecting');
            await execFileAsync('udisksctl', ['unmount', '-b', `/dev/${deviceId}`], { timeout: 15000 });
            // Also power off if possible
            try {
                // Get parent device (e.g. sda from sda1)
                const parentDev = deviceId.replace(/\d+$/, '');
                await execFileAsync('udisksctl', ['power-off', '-b', `/dev/${parentDev}`], { timeout: 10000 });
            }
            catch {
                // power-off is optional
            }
            this.devices.delete(deviceId);
            this.emit('disconnected', deviceId);
            logger.info('USB device ejected', { deviceId });
            return true;
        }
        catch (err) {
            logger.error('USB monitor: eject failed', { deviceId, error: err });
            // Restore status
            if (device)
                device.status = 'ready';
            return false;
        }
    }
    async copyToWorkspace(deviceId, filePaths, destDir) {
        const device = this.devices.get(deviceId);
        const copied = [];
        const errors = [];
        if (!device || device.status !== 'ready') {
            return { copied, errors: ['Device not ready'] };
        }
        try {
            if (!existsSync(destDir)) {
                mkdirSync(destDir, { recursive: true });
            }
        }
        catch (err) {
            return { copied, errors: [`Failed to create destination: ${err}`] };
        }
        for (const filePath of filePaths) {
            try {
                const srcPath = join(device.mountPath, filePath);
                // Security check
                if (!srcPath.startsWith(device.mountPath)) {
                    errors.push(`${filePath}: path traversal blocked`);
                    continue;
                }
                if (!existsSync(srcPath)) {
                    errors.push(`${filePath}: not found`);
                    continue;
                }
                const stat = statSync(srcPath);
                if (stat.isDirectory()) {
                    // Copy directory recursively
                    this.copyDirRecursive(srcPath, join(destDir, filePath));
                    copied.push(filePath);
                }
                else {
                    const destPath = join(destDir, filePath);
                    const destParent = join(destPath, '..');
                    if (!existsSync(destParent)) {
                        mkdirSync(destParent, { recursive: true });
                    }
                    copyFileSync(srcPath, destPath);
                    copied.push(filePath);
                }
            }
            catch (err) {
                errors.push(`${filePath}: ${err}`);
            }
        }
        return { copied, errors };
    }
    // ── Private ──────────────────────────────────────────────────────────
    copyDirRecursive(src, dest) {
        if (!existsSync(dest)) {
            mkdirSync(dest, { recursive: true });
        }
        const entries = readdirSync(src);
        for (const entry of entries) {
            const srcPath = join(src, entry);
            const destPath = join(dest, entry);
            const stat = statSync(srcPath);
            if (stat.isDirectory()) {
                this.copyDirRecursive(srcPath, destPath);
            }
            else {
                copyFileSync(srcPath, destPath);
            }
        }
    }
    async poll() {
        try {
            const usbPartitions = this.detectUsbPartitions();
            const currentIds = new Set(usbPartitions.map((p) => p.name));
            // Detect disconnections
            for (const [id] of this.devices) {
                if (!currentIds.has(id)) {
                    this.devices.delete(id);
                    this.emit('disconnected', id);
                    logger.info('USB device disconnected', { deviceId: id });
                }
            }
            // Detect new connections
            for (const part of usbPartitions) {
                if (!this.devices.has(part.name)) {
                    await this.handleNewDevice(part);
                }
            }
        }
        catch (err) {
            // Silently ignore poll errors — device might be in transition
        }
    }
    detectUsbPartitions() {
        try {
            const result = execSync('lsblk --json --output NAME,SIZE,LABEL,MOUNTPOINT,TRAN,TYPE 2>/dev/null', { encoding: 'utf-8', timeout: 5000 });
            const parsed = JSON.parse(result);
            const partitions = [];
            for (const dev of parsed.blockdevices || []) {
                if (dev.tran !== 'usb')
                    continue;
                // Check children (partitions)
                if (dev.children) {
                    for (const child of dev.children) {
                        if (child.type === 'part') {
                            partitions.push({
                                name: child.name,
                                size: child.size || '0',
                                label: child.label || '',
                                mountpoint: child.mountpoint || null,
                            });
                        }
                    }
                }
                else if (dev.type === 'part') {
                    // Device itself is a partition
                    partitions.push({
                        name: dev.name,
                        size: dev.size || '0',
                        label: dev.label || '',
                        mountpoint: dev.mountpoint || null,
                    });
                }
            }
            return partitions;
        }
        catch {
            return [];
        }
    }
    async handleNewDevice(part) {
        const deviceId = part.name;
        const label = part.label || 'USB Drive';
        const device = {
            deviceId,
            label,
            mountPath: part.mountpoint || '',
            totalSize: parseSize(part.size),
            usedSize: 0,
            fileCount: 0,
            status: 'mounting',
        };
        this.devices.set(deviceId, device);
        logger.info('USB device connected', { deviceId, label });
        // Auto-mount if not mounted
        if (!device.mountPath) {
            try {
                device.status = 'mounting';
                const { stdout } = await execFileAsync('udisksctl', ['mount', '-b', `/dev/${deviceId}`], { timeout: 15000 });
                // Parse mountpoint from output like "Mounted /dev/sda1 at /media/user/LABEL"
                const match = stdout.match(/at (.+?)\.?\s*$/);
                if (match) {
                    device.mountPath = match[1].trim();
                }
            }
            catch (err) {
                logger.warn('USB monitor: auto-mount failed', { deviceId, error: err });
                this.devices.delete(deviceId);
                return;
            }
        }
        if (!device.mountPath || !existsSync(device.mountPath)) {
            logger.warn('USB monitor: mount path invalid after mount', { deviceId });
            this.devices.delete(deviceId);
            return;
        }
        this.emit('connected', device);
        // Scan files
        device.status = 'scanning';
        const summary = this.scanDevice(device);
        device.status = 'ready';
        this.emit('scan-complete', deviceId, summary);
        logger.info('USB device ready', { deviceId, label, fileCount: device.fileCount });
    }
    scanDevice(device) {
        const categories = { documents: 0, code: 0, data: 0, media: 0, other: 0 };
        let totalFiles = 0;
        let totalSize = 0;
        const scan = (dir, depth) => {
            if (totalFiles >= MAX_FILE_SCAN || depth > 20)
                return;
            try {
                const entries = readdirSync(dir);
                for (const entry of entries) {
                    if (totalFiles >= MAX_FILE_SCAN)
                        break;
                    if (entry.startsWith('.'))
                        continue;
                    try {
                        const fullPath = join(dir, entry);
                        const stat = statSync(fullPath);
                        if (stat.isDirectory()) {
                            scan(fullPath, depth + 1);
                        }
                        else {
                            totalFiles++;
                            totalSize += stat.size;
                            const cat = categorizeFile(entry);
                            categories[cat] = (categories[cat] || 0) + 1;
                        }
                    }
                    catch {
                        // Skip inaccessible entries
                    }
                }
            }
            catch {
                // Skip inaccessible directories
            }
        };
        scan(device.mountPath, 0);
        device.fileCount = totalFiles;
        // Compute used size from df if possible
        try {
            const dfOut = execSync(`df -B1 "${device.mountPath}" 2>/dev/null | tail -1`, { encoding: 'utf-8', timeout: 3000 });
            const parts = dfOut.trim().split(/\s+/);
            if (parts.length >= 4) {
                device.totalSize = parseInt(parts[1], 10) || device.totalSize;
                device.usedSize = parseInt(parts[2], 10) || 0;
            }
        }
        catch {
            device.usedSize = totalSize;
        }
        return { totalFiles, totalSize, categories };
    }
}
export const usbMonitor = new UsbMonitor();
