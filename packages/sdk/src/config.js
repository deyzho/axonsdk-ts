/**
 * Config loader and generator for phonix.json.
 *
 * Exports:
 *  - loadConfig(cwd)  — read + validate phonix.json from a directory
 *  - generateConfig() — produce a phonix.json string from options
 *  - generateEnv()    — produce a .env stub with inline comments
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ConfigValidationError } from './types.js';
// ─── Validation helpers ──────────────────────────────────────────────────────
const VALID_PROVIDERS = ['acurast', 'fluence', 'koii', 'akash'];
const VALID_RUNTIMES = ['nodejs', 'python', 'docker', 'wasm'];
const VALID_SCHEDULE_TYPES = ['onetime', 'interval', 'on-demand'];
function assertString(value, field) {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new ConfigValidationError(field, 'must be a non-empty string');
    }
    return value;
}
function assertProvider(value, field) {
    assertString(value, field);
    if (!VALID_PROVIDERS.includes(value)) {
        throw new ConfigValidationError(field, `must be one of ${VALID_PROVIDERS.join(', ')}`);
    }
    return value;
}
function assertRuntime(value, field) {
    assertString(value, field);
    if (!VALID_RUNTIMES.includes(value)) {
        throw new ConfigValidationError(field, `must be one of ${VALID_RUNTIMES.join(', ')}`);
    }
    return value;
}
// ─── loadConfig ──────────────────────────────────────────────────────────────
/**
 * Read and validate `phonix.json` from `cwd`.
 * Throws ConfigValidationError if the file is invalid.
 */
export async function loadConfig(cwd) {
    const configPath = join(cwd, 'phonix.json');
    let raw;
    try {
        raw = await readFile(configPath, 'utf8');
    }
    catch {
        throw new Error(`phonix.json not found in ${cwd}.\n` +
            'Run \`phonix init\` to create one.');
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        throw new ConfigValidationError('(root)', 'phonix.json is not valid JSON');
    }
    if (typeof parsed !== 'object' || parsed === null) {
        throw new ConfigValidationError('(root)', 'phonix.json must be a JSON object');
    }
    const obj = parsed;
    const projectName = assertString(obj['projectName'], 'projectName');
    const provider = assertProvider(obj['provider'], 'provider');
    const runtime = assertRuntime(obj['runtime'], 'runtime');
    const entryFile = assertString(obj['entryFile'], 'entryFile');
    // Validate schedule
    if (typeof obj['schedule'] !== 'object' || obj['schedule'] === null) {
        throw new ConfigValidationError('schedule', 'must be an object');
    }
    const sched = obj['schedule'];
    if (!VALID_SCHEDULE_TYPES.includes(sched['type'])) {
        throw new ConfigValidationError('schedule.type', `must be one of ${VALID_SCHEDULE_TYPES.join(', ')}`);
    }
    const config = {
        projectName,
        provider,
        runtime,
        entryFile,
        schedule: {
            type: sched['type'],
            intervalMs: typeof sched['intervalMs'] === 'number' ? sched['intervalMs'] : undefined,
            durationMs: typeof sched['durationMs'] === 'number' ? sched['durationMs'] : undefined,
        },
    };
    if (typeof obj['replicas'] === 'number')
        config.replicas = obj['replicas'];
    if (typeof obj['maxCostPerExecution'] === 'number')
        config.maxCostPerExecution = obj['maxCostPerExecution'];
    if (typeof obj['environment'] === 'object' && obj['environment'] !== null) {
        // Build a null-prototype map to prevent prototype pollution.
        // A phonix.json with {"environment": {"__proto__": {...}}} would otherwise
        // poison Object.prototype when the map is later spread or Object.assign'd.
        const envMap = Object.create(null);
        const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
        for (const [k, v] of Object.entries(obj['environment'])) {
            if (BLOCKED_KEYS.has(k)) {
                throw new ConfigValidationError(`environment.${k}`, 'reserved key — this key name is not permitted in environment config');
            }
            if (typeof v === 'string')
                envMap[k] = v;
        }
        config.environment = envMap;
    }
    if (Array.isArray(obj['destinations']))
        config.destinations = obj['destinations'];
    return config;
}
/**
 * Generate the content of a `phonix.json` file as a formatted JSON string.
 */
export function generateConfig(options) {
    const config = {
        projectName: options.projectName,
        provider: options.provider ?? 'acurast',
        runtime: options.runtime ?? 'nodejs',
        entryFile: options.entryFile ?? 'src/index.ts',
        schedule: {
            type: options.scheduleType ?? 'on-demand',
            durationMs: options.durationMs ?? 86_400_000, // 24 hours
        },
        replicas: options.replicas ?? 3,
        maxCostPerExecution: 1_000_000,
        environment: {},
        destinations: [],
    };
    return JSON.stringify(config, null, 2) + '\n';
}
// ─── generateEnv ─────────────────────────────────────────────────────────────
/**
 * Generate the content of a `.env` file with provider-specific placeholders.
 * Pass a `provider` to get provider-specific variables; defaults to Acurast.
 */
export function generateEnv(provider = 'acurast') {
    const common = [
        '# ─── Phonix environment variables ────────────────────────────────────────────',
        '# Run: phonix auth  to fill these in interactively.',
        '#',
        '# P256 private key — used for authentication with the provider network',
        'PHONIX_SECRET_KEY=',
        '',
    ];
    const providerVars = {
        acurast: [
            '# Acurast wallet mnemonic (12 or 24 words)',
            '# Get one at: https://console.acurast.com',
            'ACURAST_MNEMONIC=',
            '',
            '# IPFS gateway URL (e.g. https://ipfs.infura.io:5001)',
            'ACURAST_IPFS_URL=',
            '',
            '# IPFS API key',
            'ACURAST_IPFS_API_KEY=',
            '',
        ],
        fluence: [
            '# Fluence EVM-compatible private key (hex, 0x-prefixed)',
            '# Run: phonix auth fluence  to generate one',
            'FLUENCE_PRIVATE_KEY=',
            '',
            '# Fluence relay node multiaddr (uses kras-00 default if empty)',
            'FLUENCE_RELAY_ADDR=',
            '',
            '# Fluence network: testnet | mainnet (default: testnet)',
            'FLUENCE_NETWORK=testnet',
            '',
        ],
        koii: [
            '# Koii Solana-compatible private key (base58)',
            '# Run: phonix auth koii  to generate one',
            'KOII_PRIVATE_KEY=',
            '',
            '# IPFS endpoint for uploading task bundles',
            'KOII_IPFS_URL=',
            '',
            '# IPFS API key',
            'KOII_IPFS_API_KEY=',
            '',
            '# Koii network: mainnet | testnet (default: mainnet)',
            'KOII_NETWORK=mainnet',
            '',
        ],
        akash: [
            '# Akash wallet mnemonic (12 or 24 words, BIP-39)',
            '# Run: phonix auth akash  to import or generate one',
            'AKASH_MNEMONIC=',
            '',
            '# IPFS API endpoint for uploading deployment bundles',
            'AKASH_IPFS_URL=',
            '',
            '# IPFS API key',
            'AKASH_IPFS_API_KEY=',
            '',
            '# Akash RPC node (default: https://rpc.akashnet.net:443)',
            'AKASH_NODE=https://rpc.akashnet.net:443',
            '',
            '# Akash chain ID (default: akashnet-2)',
            'AKASH_CHAIN_ID=akashnet-2',
            '',
            '# Key name in provider-services keyring (default: phonix)',
            'AKASH_KEY_NAME=phonix',
            '',
        ],
    };
    return [...common, ...(providerVars[provider] ?? providerVars.acurast)].join('\n');
}
//# sourceMappingURL=config.js.map