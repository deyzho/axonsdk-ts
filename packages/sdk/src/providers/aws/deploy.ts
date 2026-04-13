/**
 * AWS Lambda deployment logic.
 *
 * Deploys a TypeScript/JavaScript entry file to AWS Lambda via the Lambda REST API.
 * Uses AWS SigV4 request signing (implemented using Node.js `node:crypto`).
 * The bundle is produced by esbuild and packaged into a minimal ZIP file
 * using Node.js built-in `zlib.deflateRawSync` + manual ZIP format construction.
 *
 * Required env vars:
 *   AWS_ACCESS_KEY_ID      — AWS access key ID
 *   AWS_SECRET_ACCESS_KEY  — AWS secret access key
 *   AWS_REGION             — AWS region (default: us-east-1)
 *   AWS_LAMBDA_ROLE_ARN    — IAM role ARN for Lambda execution
 */

import { ProviderNotImplementedError } from '../../types.js';
import type { DeploymentConfig, Deployment, CostEstimate } from '../../types.js';
import { createHmac, createHash } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { getPricing } from '../../pricing/index.js';

// ─── CRC32 lookup table ──────────────────────────────────────────────────────
const CRC32_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]!) & 0xFF]! ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function writeUint16LE(val: number): Buffer {
  const b = Buffer.allocUnsafe(2);
  b.writeUInt16LE(val, 0);
  return b;
}

function writeUint32LE(val: number): Buffer {
  const b = Buffer.allocUnsafe(4);
  b.writeUInt32LE(val >>> 0, 0);
  return b;
}

/**
 * Build a minimal ZIP archive containing a single file named `index.js`.
 * Uses DEFLATE compression (method 8).
 */
function buildZip(filename: string, content: Buffer): Buffer {
  const compressed = deflateRawSync(content, { level: 6 });
  const crc = crc32(content);
  const nameBytes = Buffer.from(filename, 'utf8');

  // DOS date/time (arbitrary fixed value: 2024-01-01 00:00:00)
  const dosTime = Buffer.from([0x00, 0x00]);
  const dosDate = Buffer.from([0x21, 0x58]); // 2024-01-01

  // ── Local file header (signature 0x04034b50) ─────────────────────────────
  const localHeader = Buffer.concat([
    Buffer.from([0x50, 0x4B, 0x03, 0x04]), // signature
    writeUint16LE(20),                      // version needed: 2.0
    writeUint16LE(0),                       // flags
    writeUint16LE(8),                       // compression: DEFLATE
    dosTime,
    dosDate,
    writeUint32LE(crc),
    writeUint32LE(compressed.length),
    writeUint32LE(content.length),
    writeUint16LE(nameBytes.length),
    writeUint16LE(0),                       // extra field length
    nameBytes,
  ]);

  const localEntryOffset = 0;
  const localEntry = Buffer.concat([localHeader, compressed]);

  // ── Central directory entry ──────────────────────────────────────────────
  const centralDir = Buffer.concat([
    Buffer.from([0x50, 0x4B, 0x01, 0x02]), // signature
    writeUint16LE(20),                      // version made by
    writeUint16LE(20),                      // version needed
    writeUint16LE(0),                       // flags
    writeUint16LE(8),                       // compression
    dosTime,
    dosDate,
    writeUint32LE(crc),
    writeUint32LE(compressed.length),
    writeUint32LE(content.length),
    writeUint16LE(nameBytes.length),
    writeUint16LE(0),                       // extra field length
    writeUint16LE(0),                       // file comment length
    writeUint16LE(0),                       // disk number start
    writeUint16LE(0),                       // internal attrs
    writeUint32LE(0),                       // external attrs
    writeUint32LE(localEntryOffset),        // relative offset of local header
    nameBytes,
  ]);

  // ── End of central directory ─────────────────────────────────────────────
  const centralDirOffset = localEntry.length;
  const eocd = Buffer.concat([
    Buffer.from([0x50, 0x4B, 0x05, 0x06]), // signature
    writeUint16LE(0),                       // disk number
    writeUint16LE(0),                       // disk with central dir
    writeUint16LE(1),                       // entries on this disk
    writeUint16LE(1),                       // total entries
    writeUint32LE(centralDir.length),
    writeUint32LE(centralDirOffset),
    writeUint16LE(0),                       // comment length
  ]);

  return Buffer.concat([localEntry, centralDir, eocd]);
}

// ─── AWS SigV4 signer ────────────────────────────────────────────────────────

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

interface SigV4Options {
  method: string;
  url: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  body?: Buffer | string;
  extraHeaders?: Record<string, string>;
}

function signV4(opts: SigV4Options): Record<string, string> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z'; // YYYYMMDDTHHmmssZ
  const dateStamp = amzDate.slice(0, 8); // YYYYMMDD

  const parsed = new URL(opts.url);
  const canonicalUri = parsed.pathname || '/';
  const canonicalQueryString = parsed.searchParams.toString();

  const bodyBuffer = opts.body
    ? (typeof opts.body === 'string' ? Buffer.from(opts.body, 'utf8') : opts.body)
    : Buffer.alloc(0);
  const payloadHash = sha256Hex(bodyBuffer);

  const baseHeaders: Record<string, string> = {
    host: parsed.host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    ...opts.extraHeaders,
  };

  const sortedHeaderKeys = Object.keys(baseHeaders).map(k => k.toLowerCase()).sort();
  const signedHeaders = sortedHeaderKeys.join(';');

  const canonicalHeaders = sortedHeaderKeys
    .map(k => `${k}:${(baseHeaders[k] ?? baseHeaders[k.toLowerCase()] ?? '').trim()}`)
    .join('\n') + '\n';

  const canonicalRequest = [
    opts.method.toUpperCase(),
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${opts.region}/${opts.service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(Buffer.from(canonicalRequest, 'utf8')),
  ].join('\n');

  const kDate = hmacSha256(`AWS4${opts.secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, opts.region);
  const kService = hmacSha256(kRegion, opts.service);
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  const authHeader =
    `AWS4-HMAC-SHA256 Credential=${opts.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    ...baseHeaders,
    Authorization: authHeader,
  };
}

// ─── Lambda API helpers ──────────────────────────────────────────────────────

async function lambdaRequest(opts: {
  method: string;
  path: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  body?: Buffer | string;
  contentType?: string;
}): Promise<{ status: number; body: string }> {
  const url = `https://lambda.${opts.region}.amazonaws.com${opts.path}`;
  const extraHeaders: Record<string, string> = {};
  if (opts.contentType) extraHeaders['content-type'] = opts.contentType;

  const headers = signV4({
    method: opts.method,
    url,
    region: opts.region,
    service: 'lambda',
    accessKeyId: opts.accessKeyId,
    secretAccessKey: opts.secretAccessKey,
    body: opts.body,
    extraHeaders,
  });

  const res = await fetch(url, {
    method: opts.method,
    headers,
    body: opts.body ?? undefined,
    signal: AbortSignal.timeout(60_000),
  });

  return { status: res.status, body: await res.text() };
}

// ─── Deploy ──────────────────────────────────────────────────────────────────

export async function awsDeploy(options: { config: DeploymentConfig }): Promise<Deployment> {
  const accessKeyId = process.env['AWS_ACCESS_KEY_ID'];
  const secretAccessKey = process.env['AWS_SECRET_ACCESS_KEY'];
  const region = process.env['AWS_REGION'] ?? 'us-east-1';
  const roleArn = process.env['AWS_LAMBDA_ROLE_ARN'];

  if (!accessKeyId) throw new ProviderNotImplementedError('aws', 'AWS_ACCESS_KEY_ID env var is required.');
  if (!secretAccessKey) throw new ProviderNotImplementedError('aws', 'AWS_SECRET_ACCESS_KEY env var is required.');
  if (!roleArn) throw new ProviderNotImplementedError('aws', 'AWS_LAMBDA_ROLE_ARN env var is required.');

  const config = options.config;

  // Bundle entry file with esbuild
  const { build } = await import('esbuild');
  const bundleResult = await build({
    entryPoints: [config.code],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
  });

  const bundleCode = bundleResult.outputFiles[0]?.text ?? '';
  const bundleBuffer = Buffer.from(bundleCode, 'utf8');

  // Build ZIP
  const zipBuffer = buildZip('index.js', bundleBuffer);

  // Derive a stable function name from the project
  const fnName = `axon-${Date.now()}`;

  // Create or update the Lambda function
  const createBody = JSON.stringify({
    FunctionName: fnName,
    Runtime: 'nodejs20.x',
    Role: roleArn,
    Handler: 'index.handler',
    Code: { ZipFile: zipBuffer.toString('base64') },
    Timeout: Math.min(Math.floor((config.schedule?.durationMs ?? 30_000) / 1000), 900),
    MemorySize: 256,
    Environment: { Variables: config.environment ?? {} },
    Publish: true,
  });

  const createRes = await lambdaRequest({
    method: 'POST',
    path: '/2015-03-31/functions',
    region,
    accessKeyId,
    secretAccessKey,
    body: createBody,
    contentType: 'application/json',
  });

  if (createRes.status !== 201 && createRes.status !== 200) {
    throw new Error(`Lambda CreateFunction failed: ${createRes.status} ${createRes.body}`);
  }

  const fnData = JSON.parse(createRes.body) as { FunctionArn: string };

  // Add a Function URL (no auth = public endpoint; callers supply Bearer token at app level)
  const urlBody = JSON.stringify({ AuthType: 'NONE', Cors: { AllowOrigins: ['*'] } });
  const urlRes = await lambdaRequest({
    method: 'POST',
    path: `/2021-10-31/functions/${fnName}/url`,
    region,
    accessKeyId,
    secretAccessKey,
    body: urlBody,
    contentType: 'application/json',
  });

  let functionUrl = `https://lambda.${region}.amazonaws.com/2015-03-31/functions/${fnName}/invocations`;
  if (urlRes.status === 201 || urlRes.status === 200) {
    const urlData = JSON.parse(urlRes.body) as { FunctionUrl?: string };
    if (urlData.FunctionUrl) functionUrl = urlData.FunctionUrl;
  }

  return {
    id: fnData.FunctionArn,
    provider: 'aws',
    status: 'live',
    processorIds: [functionUrl],
    createdAt: new Date(),
    url: functionUrl,
  };
}

export async function awsEstimate(config: DeploymentConfig): Promise<CostEstimate> {
  const durationSec = (config.schedule?.durationMs ?? 3_600_000) / 1000;
  const replicas = config.replicas ?? 1;
  const memorySizeGb = 256 / 1024; // 256 MB default
  const invocations = replicas;

  const pricing = await getPricing();
  const computeCost = pricing.awsLambdaGbSec * memorySizeGb * durationSec * replicas;
  const requestCost = pricing.awsLambdaRequest * invocations;
  const usdEquivalent = computeCost + requestCost;

  return {
    provider: 'aws',
    token: 'USD',
    amount: usdEquivalent,
    usdEquivalent,
  };
}

export async function awsListDeployments(): Promise<Array<{
  id: string; status: string; processorIds: string[];
}>> {
  const accessKeyId = process.env['AWS_ACCESS_KEY_ID'];
  const secretAccessKey = process.env['AWS_SECRET_ACCESS_KEY'];
  const region = process.env['AWS_REGION'] ?? 'us-east-1';

  if (!accessKeyId || !secretAccessKey) return [];

  try {
    const res = await lambdaRequest({
      method: 'GET',
      path: '/2015-03-31/functions?MaxItems=50',
      region,
      accessKeyId,
      secretAccessKey,
    });
    if (res.status !== 200) return [];
    const data = JSON.parse(res.body) as {
      Functions?: Array<{ FunctionArn: string; FunctionName: string; State?: string }>;
    };
    return (data.Functions ?? [])
      .filter(f => f.FunctionName.startsWith('axon-'))
      .map(f => ({
        id: f.FunctionArn,
        status: f.State === 'Active' ? 'live' : (f.State?.toLowerCase() ?? 'pending'),
        processorIds: [f.FunctionArn],
      }));
  } catch {
    return [];
  }
}
