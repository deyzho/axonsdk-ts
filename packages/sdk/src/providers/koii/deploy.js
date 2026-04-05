/**
 * Koii deployment helpers.
 *
 * Flow:
 *  1. Bundle the entry file with esbuild (IIFE, phonix runtime prepended)
 *  2. Upload the bundle to IPFS
 *  3. Register the task on the K2 chain via the Koii task creation CLI
 *  4. Return a Deployment object with the task public key
 *
 * Requires:
 *  - KOII_PRIVATE_KEY  — base58-encoded Solana-compatible private key
 *  - KOII_IPFS_URL     — IPFS upload endpoint
 *  - KOII_IPFS_API_KEY — IPFS API key (optional)
 *
 * The Koii task creation CLI (@_koii/create-task-cli) must be available,
 * or the task can be created manually via the Koii desktop app.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, normalize } from 'node:path';
import { createHash } from 'node:crypto';
import { generateRuntimeBootstrap } from '../../runtime/index.js';
const execFileAsync = promisify(execFile);
// ─── Bundling ─────────────────────────────────────────────────────────────────
async function bundleForKoii(entryPath, environment = {}) {
    let esbuild;
    try {
        esbuild = await import('esbuild');
    }
    catch {
        throw new Error('esbuild is required. Install it with: npm install esbuild');
    }
    const SAFE_ENV_KEY_RE = /^[A-Z][A-Z0-9_]{0,127}$/;
    const SECRET_KEY_PATTERNS = [/_KEY$/, /_SECRET$/, /_TOKEN$/, /_PASSWORD$/, /_MNEMONIC$/, /_PRIVATE_KEY$/];
    const defines = {
        'process.env.NODE_ENV': '"production"',
    };
    for (const [key, value] of Object.entries(environment)) {
        if (!SAFE_ENV_KEY_RE.test(key)) {
            throw new Error(`Invalid environment variable name: "${key}". Keys must be SCREAMING_SNAKE_CASE.`);
        }
        if (SECRET_KEY_PATTERNS.some((re) => re.test(key))) {
            throw new Error(`"${key}" looks like a secret. Do not bake credentials into the public bundle via phonix.json > environment.`);
        }
        if (value !== '')
            defines[`process.env.${key}`] = JSON.stringify(value);
    }
    const result = await esbuild.build({
        entryPoints: [entryPath],
        bundle: true,
        platform: 'node',
        format: 'iife',
        write: false,
        minify: false,
        globalName: '__phonix_bundle',
        define: defines,
        // Koii tasks run in Node.js — keep node built-ins external
        external: ['node:*'],
    });
    if (result.errors.length > 0) {
        throw new Error(`esbuild failed:\n${result.errors.map((e) => e.text).join('\n')}`);
    }
    const outputFile = result.outputFiles?.[0];
    if (!outputFile)
        throw new Error('esbuild produced no output');
    return generateRuntimeBootstrap('koii') + outputFile.text;
}
// ─── URL safety guard ─────────────────────────────────────────────────────────
/**
 * Assert that a URL is safe to connect to from the SDK host.
 * Blocks: non-https schemes, private/loopback IP ranges.
 * Note: this does NOT defend against DNS rebinding — see SSRF guidance.
 */
function assertSafeUrl(rawUrl, label) {
    let parsed;
    try {
        parsed = new URL(rawUrl);
    }
    catch {
        throw new Error(`${label}: invalid URL "${rawUrl}"`);
    }
    if (parsed.protocol !== 'https:') {
        throw new Error(`${label}: only https:// URLs are permitted (got "${parsed.protocol}")`);
    }
    // Block RFC-1918, loopback, link-local, and APIPA ranges
    const PRIVATE_RE = /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|\[?::1\]?|0\.0\.0\.0)$/i;
    if (PRIVATE_RE.test(parsed.hostname)) {
        throw new Error(`${label}: requests to private/internal addresses are blocked ("${parsed.hostname}")`);
    }
    return parsed;
}
// ─── IPFS upload ──────────────────────────────────────────────────────────────
async function uploadToIpfs(content, ipfsUrl, ipfsApiKey) {
    // Validate before any network access — SSRF via attacker-controlled IPFS URL
    assertSafeUrl(ipfsUrl, 'KOII_IPFS_URL');
    const headers = {
        'Content-Type': 'application/octet-stream',
    };
    if (ipfsApiKey)
        headers['Authorization'] = `Bearer ${ipfsApiKey}`;
    // Standard IPFS HTTP API: POST /api/v0/add
    const url = ipfsUrl.replace(/\/$/, '') + '/api/v0/add';
    const body = Buffer.from(content, 'utf8');
    const res = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
        throw new Error(`IPFS upload failed with status ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json());
    const cid = json.Hash ?? (json.cid ? json.cid['/'] : undefined);
    if (!cid)
        throw new Error('IPFS response did not contain a CID');
    return cid;
}
// ─── Koii CLI helpers ─────────────────────────────────────────────────────────
async function resolveKoiiCli() {
    try {
        const { createRequire } = await import('node:module');
        const req = createRequire(import.meta.url);
        const pkgPath = req.resolve('@_koii/create-task-cli/package.json');
        const cliDir = pkgPath.replace('/package.json', '');
        const pkgRaw = await readFile(pkgPath, 'utf8');
        const pkg = JSON.parse(pkgRaw);
        if (pkg.bin) {
            const binPath = typeof pkg.bin === 'string'
                ? pkg.bin
                : pkg.bin['create-task-cli'] ?? Object.values(pkg.bin)[0];
            if (binPath)
                return resolve(cliDir, binPath);
        }
    }
    catch {
        // Fall through
    }
    return 'create-task-cli'; // Assume on PATH
}
async function runKoiiCli(args, env) {
    const cliPath = await resolveKoiiCli();
    const mergedEnv = { ...process.env, ...(env ?? {}) };
    try {
        const { stdout } = await execFileAsync(cliPath, args, {
            env: mergedEnv,
            timeout: 120_000,
        });
        return stdout;
    }
    catch (err) {
        const execErr = err;
        const detail = execErr.stderr ? `\nstderr: ${execErr.stderr}` : '';
        throw new Error(`Koii CLI failed: ${execErr.message}${detail}`);
    }
}
// ─── Parsing ──────────────────────────────────────────────────────────────────
function parseTaskId(output) {
    // "Task ID: 3FkR..." or "task public key: ..."
    const match = output.match(/task[^\n]*(?:id|key|address)[^\n]*?:\s*([A-Za-z0-9]{32,})/i);
    if (match)
        return match[1];
    const base58Match = output.match(/\b([A-Za-z0-9]{32,44})\b/);
    if (base58Match)
        return base58Match[1];
    return createHash('sha256').update(output).digest('base64url').slice(0, 44);
}
function parseNodeIds(output) {
    const ids = [];
    const nodeRegex = /node[^\n]*?:\s*([A-Za-z0-9]{32,44})/gi;
    let match;
    while ((match = nodeRegex.exec(output)) !== null)
        ids.push(match[1]);
    return [...new Set(ids)];
}
export async function koiiDeploy(options) {
    const { config, cwd = process.cwd() } = options;
    const privateKey = options.secretKey ??
        process.env['KOII_PRIVATE_KEY'] ??
        process.env['PHONIX_SECRET_KEY'] ??
        '';
    const ipfsUrl = process.env['KOII_IPFS_URL'] ?? process.env['ACURAST_IPFS_URL'] ?? '';
    const ipfsApiKey = process.env['KOII_IPFS_API_KEY'] ?? process.env['ACURAST_IPFS_API_KEY'];
    if (!privateKey) {
        throw new Error('KOII_PRIVATE_KEY is not set. Add it to your .env file.\n' +
            'Run: phonix auth koii  to generate and configure credentials.');
    }
    if (!ipfsUrl) {
        throw new Error('KOII_IPFS_URL is not set. Add it to your .env file.\n' +
            'Get an IPFS endpoint at: https://web3.storage or https://infura.io');
    }
    // Validate and bundle entry file
    const entryPath = resolve(cwd, config.code);
    const normalizedCwd = normalize(cwd) + (cwd.endsWith('/') ? '' : '/');
    if (!normalize(entryPath).startsWith(normalizedCwd)) {
        throw new Error(`Entry file path escapes the project directory.`);
    }
    let bundledCode;
    try {
        bundledCode = await bundleForKoii(entryPath, config.environment ?? {});
    }
    catch (err) {
        throw new Error(`Failed to bundle for Koii: ${err.message}`);
    }
    const tmpDir = await mkdtemp(join(tmpdir(), 'phonix-koii-'));
    const bundlePath = join(tmpDir, 'task.js');
    await writeFile(bundlePath, bundledCode, 'utf8');
    try {
        // Upload to IPFS
        let cid;
        try {
            cid = await uploadToIpfs(bundledCode, ipfsUrl, ipfsApiKey);
        }
        catch (err) {
            throw new Error(`IPFS upload failed: ${err.message}`);
        }
        const env = {
            KOII_PRIVATE_KEY: privateKey,
        };
        if (process.env['KOII_NETWORK'])
            env['KOII_CLUSTER'] = process.env['KOII_NETWORK'];
        // Create the Koii task on-chain
        // Use a sanitised alphanumeric task name derived from the entry-file path.
        // Never pass config.code (a file path) directly — it could contain path
        // traversal sequences or shell-interpretable characters that confuse the CLI.
        const taskName = (config.code ?? 'phonix-task')
            .replace(/[^a-zA-Z0-9._-]/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 64) || 'phonix-task';
        const args = [
            '--task-name', taskName,
            '--cid', cid,
            '--replicas', String(config.replicas ?? 1),
            '--minimum-stake-amount', '1',
            '--no-prompt',
        ];
        const output = await runKoiiCli(args, env);
        const taskId = parseTaskId(output);
        const nodeIds = parseNodeIds(output);
        return {
            id: taskId,
            provider: 'koii',
            status: nodeIds.length > 0 ? 'live' : 'pending',
            processorIds: nodeIds,
            createdAt: new Date(),
            url: `https://app.koii.network/tasks/${taskId}`,
        };
    }
    finally {
        await rm(tmpDir, { recursive: true, force: true });
    }
}
/**
 * Estimate the cost of a Koii deployment.
 * Returns an approximate KOII amount (staking requirement + fees).
 */
export async function koiiEstimate(config) {
    // Koii costs are primarily staking-based: each task requires a minimum stake.
    // ~1 KOII per replica as a baseline staking requirement.
    const replicas = config.replicas ?? 1;
    return replicas * 1; // 1 KOII per replica minimum stake
}
/**
 * List active Koii tasks for the current key.
 */
export async function koiiListDeployments(secretKey) {
    const env = {};
    const key = secretKey ?? process.env['KOII_PRIVATE_KEY'] ?? '';
    if (key)
        env['KOII_PRIVATE_KEY'] = key;
    try {
        const output = await runKoiiCli(['list', '--no-prompt'], env);
        const deployments = [];
        const lines = output.split('\n').filter((l) => l.trim());
        for (const line of lines) {
            const idMatch = line.match(/\b([A-Za-z0-9]{32,44})\b/);
            if (!idMatch)
                continue;
            const id = idMatch[1];
            const statusMatch = line.match(/\b(active|pending|completed|failed|ended)\b/i);
            const status = statusMatch ? statusMatch[1].toLowerCase() : 'pending';
            deployments.push({ id, processorIds: [], status });
        }
        return deployments;
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=deploy.js.map