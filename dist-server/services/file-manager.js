/**
 * File Manager Service
 * Browse whitelisted server directories, serve files with streaming,
 * generate image thumbnails via sharp.
 */
import { existsSync, readdirSync, statSync } from 'fs';
import { join, extname, relative, resolve } from 'path';
import { lookup as mimeLookup } from 'mime-types';
import { homedir } from 'os';
import { logger } from '../utils/logger.js';
/** Extension-to-category mapping */
const EXT_CATEGORIES = {
    image: ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp', '.ico', '.tiff'],
    video: ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.wmv', '.flv'],
    audio: ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.wma', '.m4a'],
    documents: ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt', '.xls', '.xlsx', '.ppt', '.pptx', '.md'],
    code: ['.ts', '.js', '.py', '.java', '.c', '.cpp', '.go', '.rs', '.rb', '.php', '.html', '.css', '.json', '.yaml', '.yml', '.toml', '.xml', '.sh'],
    data: ['.csv', '.tsv', '.sql', '.db', '.sqlite', '.parquet', '.jsonl', '.log'],
};
function categorize(filename) {
    const ext = extname(filename).toLowerCase();
    for (const [cat, exts] of Object.entries(EXT_CATEGORIES)) {
        if (exts.includes(ext))
            return cat;
    }
    return 'other';
}
export class FileManager {
    roots = [];
    constructor() {
        this.initRoots();
    }
    initRoots() {
        const home = homedir();
        this.roots = [
            { id: 'home', label: 'Home', path: home, icon: 'Home' },
            { id: 'media', label: 'USB / Media', path: '/media', icon: 'Usb' },
        ];
        // Add workspace root if exists
        const wsPath = join(home, '.openclaw', 'workspace');
        if (existsSync(wsPath)) {
            this.roots.push({ id: 'workspace', label: 'Agent Workspace', path: wsPath, icon: 'Bot' });
        }
    }
    getRoots() {
        return this.roots.filter(r => existsSync(r.path));
    }
    /** Resolve and validate path — returns absolute path or null if invalid */
    resolvePath(rootId, subPath) {
        const root = this.roots.find(r => r.id === rootId);
        if (!root || !existsSync(root.path))
            return null;
        const target = subPath ? resolve(root.path, subPath) : root.path;
        // Path traversal check: resolved path must stay within root
        if (!target.startsWith(root.path))
            return null;
        return target;
    }
    listDirectory(rootId, subPath) {
        const dirPath = this.resolvePath(rootId, subPath);
        if (!dirPath || !existsSync(dirPath))
            return [];
        try {
            const stat = statSync(dirPath);
            if (!stat.isDirectory())
                return [];
            const entries = readdirSync(dirPath);
            const root = this.roots.find(r => r.id === rootId);
            const files = [];
            for (const entry of entries) {
                if (entry.startsWith('.'))
                    continue;
                try {
                    const absPath = join(dirPath, entry);
                    const st = statSync(absPath);
                    const relPath = relative(root.path, absPath);
                    const cat = st.isDirectory() ? 'other' : categorize(entry);
                    const mime = st.isDirectory() ? null : (mimeLookup(entry) || null);
                    files.push({
                        name: entry,
                        path: relPath,
                        size: st.size,
                        isDirectory: st.isDirectory(),
                        modified: st.mtime.toISOString(),
                        mimeType: mime,
                        category: cat,
                        isMedia: ['image', 'video', 'audio'].includes(cat),
                    });
                }
                catch { /* skip unreadable entries */ }
            }
            return files.sort((a, b) => {
                if (a.isDirectory !== b.isDirectory)
                    return a.isDirectory ? -1 : 1;
                return a.name.localeCompare(b.name);
            });
        }
        catch (err) {
            logger.warn('FileManager: listDirectory failed', { rootId, subPath, error: err });
            return [];
        }
    }
    /** Get absolute path for a file (for display/copy purposes) */
    getAbsolutePath(rootId, filePath) {
        return this.resolvePath(rootId, filePath);
    }
    /** Copy a file/directory within or across roots */
    copyFile(srcRootId, srcPath, destRootId, destPath) {
        const srcAbs = this.resolvePath(srcRootId, srcPath);
        const destAbs = this.resolvePath(destRootId, destPath);
        if (!srcAbs || !destAbs)
            return { success: false, error: 'Invalid source or destination path' };
        if (!existsSync(srcAbs))
            return { success: false, error: 'Source not found' };
        try {
            const { cpSync, mkdirSync } = require('fs');
            const { dirname } = require('path');
            mkdirSync(dirname(destAbs), { recursive: true });
            const stat = statSync(srcAbs);
            cpSync(srcAbs, destAbs, { recursive: stat.isDirectory() });
            return { success: true };
        }
        catch (err) {
            logger.warn('FileManager: copy failed', { srcAbs, destAbs, error: err });
            return { success: false, error: err.message };
        }
    }
    /** Rename/move a file within the same root */
    renameFile(rootId, oldPath, newName) {
        const oldAbs = this.resolvePath(rootId, oldPath);
        if (!oldAbs || !existsSync(oldAbs))
            return { success: false, error: 'File not found' };
        const { renameSync } = require('fs');
        const { dirname, join: pathJoin } = require('path');
        const newAbs = pathJoin(dirname(oldAbs), newName);
        // Security: new path must stay within root
        const root = this.roots.find(r => r.id === rootId);
        if (!root || !newAbs.startsWith(root.path)) {
            return { success: false, error: 'Rename would escape root directory' };
        }
        // Prevent renaming system files
        if (this.isSystemPath(oldAbs)) {
            return { success: false, error: 'Cannot rename system files' };
        }
        try {
            renameSync(oldAbs, newAbs);
            return { success: true };
        }
        catch (err) {
            logger.warn('FileManager: rename failed', { oldAbs, newAbs, error: err });
            return { success: false, error: err.message };
        }
    }
    /** Check if a path is a protected system path */
    isSystemPath(absPath) {
        const systemPaths = ['/etc', '/usr', '/bin', '/sbin', '/lib', '/boot', '/proc', '/sys', '/dev', '/var/lib', '/var/log'];
        return systemPaths.some(sp => absPath.startsWith(sp));
    }
    /** Returns absolute path + MIME type for file streaming, or null */
    getServePath(rootId, filePath) {
        const absPath = this.resolvePath(rootId, filePath);
        if (!absPath || !existsSync(absPath))
            return null;
        try {
            if (statSync(absPath).isDirectory())
                return null;
        }
        catch {
            return null;
        }
        const mimeType = mimeLookup(absPath) || 'application/octet-stream';
        return { absPath, mimeType };
    }
}
export const fileManager = new FileManager();
