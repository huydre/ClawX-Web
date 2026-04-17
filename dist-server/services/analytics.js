import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync } from 'fs';
import crypto from 'crypto';
const MAX_EVENTS = 10000;
// Default data
const defaultData = {
    events: [],
    dailyStats: {},
    hourlyActivity: {},
    dailyTokenStats: {},
};
// Database setup
const dataDir = join(homedir(), '.clawx');
const dbPath = join(dataDir, 'analytics.json');
mkdirSync(dataDir, { recursive: true });
const adapter = new JSONFile(dbPath);
const db = new Low(adapter, defaultData);
// Initialize
export async function initAnalytics() {
    await db.read();
    db.data ||= defaultData;
    await db.write();
}
// Helper: get YYYY-MM-DD key from timestamp
function getDayKey(timestamp) {
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// Helper: get "dayOfWeek-hour" key from timestamp
function getHourKey(timestamp) {
    const d = new Date(timestamp);
    return `${d.getDay()}-${d.getHours()}`;
}
// Track an event
export async function trackEvent(event) {
    await db.read();
    const fullEvent = {
        ...event,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
    };
    db.data.events.push(fullEvent);
    // FIFO: keep max events
    if (db.data.events.length > MAX_EVENTS) {
        db.data.events = db.data.events.slice(-MAX_EVENTS);
    }
    // Update daily stats
    const dayKey = getDayKey(fullEvent.timestamp);
    if (!db.data.dailyStats[dayKey]) {
        db.data.dailyStats[dayKey] = { sent: 0, received: 0, tools: 0 };
    }
    const dayStat = db.data.dailyStats[dayKey];
    if (fullEvent.type === 'message_sent')
        dayStat.sent++;
    if (fullEvent.type === 'message_received')
        dayStat.received++;
    if (fullEvent.type === 'tool_call')
        dayStat.tools++;
    // Update token stats
    if (fullEvent.type === 'tokens_used' && fullEvent.metadata) {
        const provider = String(fullEvent.metadata.provider || 'unknown');
        if (!db.data.dailyTokenStats)
            db.data.dailyTokenStats = {};
        if (!db.data.dailyTokenStats[dayKey])
            db.data.dailyTokenStats[dayKey] = {};
        if (!db.data.dailyTokenStats[dayKey][provider]) {
            db.data.dailyTokenStats[dayKey][provider] = { inputTokens: 0, outputTokens: 0, estimatedCost: 0, requests: 0 };
        }
        const ts = db.data.dailyTokenStats[dayKey][provider];
        ts.inputTokens += Number(fullEvent.metadata.inputTokens) || 0;
        ts.outputTokens += Number(fullEvent.metadata.outputTokens) || 0;
        ts.estimatedCost += Number(fullEvent.metadata.estimatedCost) || 0;
        ts.requests += 1;
    }
    // Update hourly activity
    const hourKey = getHourKey(fullEvent.timestamp);
    db.data.hourlyActivity[hourKey] = (db.data.hourlyActivity[hourKey] || 0) + 1;
    await db.write();
}
// Get daily stats for last N days
export async function getDailyStats(days) {
    await db.read();
    const result = {};
    const now = Date.now();
    for (let i = 0; i < days; i++) {
        const key = getDayKey(now - i * 86400000);
        result[key] = db.data.dailyStats[key] || { sent: 0, received: 0, tools: 0 };
    }
    return result;
}
// Get hourly activity map
export async function getHourlyActivity() {
    await db.read();
    return { ...db.data.hourlyActivity };
}
// Get recent events
export async function getRecentEvents(limit) {
    await db.read();
    return db.data.events.slice(-limit).reverse();
}
// Get total stats
export async function getTotalStats() {
    await db.read();
    const stats = { totalSent: 0, totalReceived: 0, totalTools: 0, totalSessions: 0 };
    for (const day of Object.values(db.data.dailyStats)) {
        stats.totalSent += day.sent;
        stats.totalReceived += day.received;
        stats.totalTools += day.tools;
    }
    stats.totalSessions = db.data.events.filter((e) => e.type === 'session_created').length;
    return stats;
}
// Cost estimates per 1M tokens (input / output) — popular models
const COST_TABLE = {
    'gpt-4o': { input: 2.5, output: 10 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'gpt-4-turbo': { input: 10, output: 30 },
    'gpt-4': { input: 30, output: 60 },
    'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
    'claude-opus-4': { input: 15, output: 75 },
    'claude-sonnet-4': { input: 3, output: 15 },
    'claude-3-5-sonnet': { input: 3, output: 15 },
    'claude-3-5-haiku': { input: 0.8, output: 4 },
    'claude-3-haiku': { input: 0.25, output: 1.25 },
    'gemini-2.0-flash': { input: 0.1, output: 0.4 },
    'gemini-1.5-pro': { input: 1.25, output: 5 },
    'gemini-1.5-flash': { input: 0.075, output: 0.3 },
};
export function estimateCost(model, inputTokens, outputTokens) {
    // Try exact match, then prefix match
    const key = Object.keys(COST_TABLE).find(k => model.includes(k));
    const rates = key ? COST_TABLE[key] : { input: 1, output: 3 }; // fallback ~GPT-3.5 tier
    return (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
}
// Get token stats for last N days
export async function getTokenStats(days) {
    await db.read();
    const tokenStats = db.data.dailyTokenStats || {};
    const daily = [];
    const byProvider = {};
    const totals = { inputTokens: 0, outputTokens: 0, estimatedCost: 0, requests: 0 };
    const now = Date.now();
    for (let i = days - 1; i >= 0; i--) {
        const dayKey = getDayKey(now - i * 86400000);
        const providers = tokenStats[dayKey] || {};
        let dayInput = 0, dayOutput = 0, dayCost = 0, dayReqs = 0;
        for (const [provider, stats] of Object.entries(providers)) {
            dayInput += stats.inputTokens;
            dayOutput += stats.outputTokens;
            dayCost += stats.estimatedCost;
            dayReqs += stats.requests;
            if (!byProvider[provider]) {
                byProvider[provider] = { inputTokens: 0, outputTokens: 0, estimatedCost: 0, requests: 0 };
            }
            byProvider[provider].inputTokens += stats.inputTokens;
            byProvider[provider].outputTokens += stats.outputTokens;
            byProvider[provider].estimatedCost += stats.estimatedCost;
            byProvider[provider].requests += stats.requests;
        }
        daily.push({ date: dayKey, inputTokens: dayInput, outputTokens: dayOutput, estimatedCost: dayCost, requests: dayReqs });
        totals.inputTokens += dayInput;
        totals.outputTokens += dayOutput;
        totals.estimatedCost += dayCost;
        totals.requests += dayReqs;
    }
    return { daily, byProvider, totals };
}
