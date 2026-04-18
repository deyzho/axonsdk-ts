/**
 * Config loader and generator for axon.json.
 *
 * Exports:
 *  - loadConfig(cwd)  — read + validate axon.json from a directory
 *  - generateConfig() — produce a axon.json string from options
 *  - generateEnv()    — produce a .env stub with inline comments
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AxonConfig, ProviderName, RuntimeType } from './types.js';
import { ConfigValidationError } from './types.js';

// ─── Validation helpers ──────────────────────────────────────────────────────

const VALID_PROVIDERS: ProviderName[] = [
  'acurast', 'fluence', 'koii', 'akash', 'ionet',
  'aws', 'gcp', 'azure', 'cloudflare', 'flyio',
];
const VALID_RUNTIMES: RuntimeType[] = ['nodejs', 'python', 'docker', 'wasm'];
const VALID_SCHEDULE_TYPES = ['onetime', 'interval', 'on-demand'] as const;

function assertString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ConfigValidationError(field, 'must be a non-empty string');
  }
  return value;
}

function assertProvider(value: unknown, field: string): ProviderName {
  assertString(value, field);
  if (!VALID_PROVIDERS.includes(value as ProviderName)) {
    throw new ConfigValidationError(
      field,
      `must be one of ${VALID_PROVIDERS.join(', ')}`
    );
  }
  return value as ProviderName;
}

function assertRuntime(value: unknown, field: string): RuntimeType {
  assertString(value, field);
  if (!VALID_RUNTIMES.includes(value as RuntimeType)) {
    throw new ConfigValidationError(
      field,
      `must be one of ${VALID_RUNTIMES.join(', ')}`
    );
  }
  return value as RuntimeType;
}

// ─── loadConfig ──────────────────────────────────────────────────────────────

/**
 * Read and validate `axon.json` from `cwd`.
 * Throws ConfigValidationError if the file is invalid.
 */
export async function loadConfig(cwd: string): Promise<AxonConfig> {
  const configPath = join(cwd, 'axon.json');
  let raw: string;
  try {
    raw = await readFile(configPath, 'utf8');
  } catch {
    throw new Error(
      `axon.json not found in ${cwd}.\n` +
        'Run \`axon init\` to create one.'
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ConfigValidationError('(root)', 'axon.json is not valid JSON');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new ConfigValidationError('(root)', 'axon.json must be a JSON object');
  }

  const obj = parsed as Record<string, unknown>;

  const projectName = assertString(obj['projectName'], 'projectName');
  const provider = assertProvider(obj['provider'], 'provider');
  const runtime = assertRuntime(obj['runtime'], 'runtime');
  const entryFile = assertString(obj['entryFile'], 'entryFile');

  // Validate schedule
  if (typeof obj['schedule'] !== 'object' || obj['schedule'] === null) {
    throw new ConfigValidationError('schedule', 'must be an object');
  }
  const sched = obj['schedule'] as Record<string, unknown>;
  if (!VALID_SCHEDULE_TYPES.includes(sched['type'] as (typeof VALID_SCHEDULE_TYPES)[number])) {
    throw new ConfigValidationError(
      'schedule.type',
      `must be one of ${VALID_SCHEDULE_TYPES.join(', ')}`
    );
  }

  const config: AxonConfig = {
    projectName,
    provider,
    runtime,
    entryFile,
    schedule: {
      type: sched['type'] as AxonConfig['schedule']['type'],
      intervalMs:
        typeof sched['intervalMs'] === 'number' ? sched['intervalMs'] : undefined,
      durationMs:
        typeof sched['durationMs'] === 'number' ? sched['durationMs'] : undefined,
    },
  };

  if (typeof obj['replicas'] === 'number') config.replicas = obj['replicas'];
  if (typeof obj['maxCostPerExecution'] === 'number')
    config.maxCostPerExecution = obj['maxCostPerExecution'];
  if (typeof obj['environment'] === 'object' && obj['environment'] !== null) {
    // Build a null-prototype map to prevent prototype pollution.
    // An axon.json with {"environment": {"__proto__": {...}}} would otherwise
    // poison Object.prototype when the map is later spread or Object.assign'd.
    const envMap = Object.create(null) as Record<string, string>;
    const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
    for (const [k, v] of Object.entries(obj['environment'] as Record<string, unknown>)) {
      if (BLOCKED_KEYS.has(k)) {
        throw new ConfigValidationError(
          `environment.${k}`,
          'reserved key — this key name is not permitted in environment config'
        );
      }
      if (typeof v === 'string') envMap[k] = v;
    }
    config.environment = envMap;
  }
  if (Array.isArray(obj['destinations']))
    config.destinations = obj['destinations'] as string[];

  return config;
}

// ─── generateConfig ──────────────────────────────────────────────────────────

export interface GenerateConfigOptions {
  projectName: string;
  provider?: ProviderName;
  runtime?: RuntimeType;
  entryFile?: string;
  scheduleType?: AxonConfig['schedule']['type'];
  durationMs?: number;
  replicas?: number;
}

/**
 * Generate the content of a `axon.json` file as a formatted JSON string.
 */
export function generateConfig(options: GenerateConfigOptions): string {
  const config: AxonConfig = {
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
export function generateEnv(provider: ProviderName = 'acurast'): string {
  const common = [
    '# ─── Axon environment variables ────────────────────────────────────────────',
    '# Run: axon auth  to fill these in interactively.',
    '#',
    '# P256 private key — used for authentication with the provider network',
    'AXON_SECRET_KEY=',
    '',
  ];

  const providerVars: Record<ProviderName, string[]> = {
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
      '# Run: axon auth fluence  to generate one',
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
      '# Run: axon auth koii  to generate one',
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
      '# Run: axon auth akash  to import or generate one',
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
      '# Key name in provider-services keyring (default: axon)',
      'AKASH_KEY_NAME=axon',
      '',
    ],
    ionet: [
      '# io.net API key — get one at https://cloud.io.net',
      '# Run: axon auth ionet  to save interactively',
      'IONET_API_KEY=',
      '',
      '# io.net cluster ID to target (leave blank to auto-select cheapest)',
      'IONET_CLUSTER_ID=',
      '',
    ],
    aws: [
      '# AWS access key ID',
      'AWS_ACCESS_KEY_ID=',
      '',
      '# AWS secret access key',
      'AWS_SECRET_ACCESS_KEY=',
      '',
      '# AWS region (default: us-east-1)',
      'AWS_REGION=us-east-1',
      '',
      '# IAM role ARN for Lambda execution (requires lambda:InvokeFunction)',
      'AWS_LAMBDA_ROLE_ARN=',
      '',
    ],
    gcp: [
      '# GCP project ID',
      'GCP_PROJECT_ID=',
      '',
      '# GCP OAuth2 access token — run: gcloud auth print-access-token',
      'GCP_ACCESS_TOKEN=',
      '',
      '# Docker image URI to deploy to Cloud Run (e.g. gcr.io/my-project/my-image:latest)',
      'GCP_CONTAINER_IMAGE=',
      '',
      '# GCP region (default: us-central1)',
      'GCP_REGION=us-central1',
      '',
    ],
    azure: [
      '# Azure subscription ID',
      'AZURE_SUBSCRIPTION_ID=',
      '',
      '# Azure bearer token — run: az account get-access-token --query accessToken -o tsv',
      'AZURE_BEARER_TOKEN=',
      '',
      '# Docker image URI to deploy to ACI',
      'AZURE_CONTAINER_IMAGE=',
      '',
      '# Azure resource group (default: axon-rg)',
      'AZURE_RESOURCE_GROUP=axon-rg',
      '',
      '# Azure region (default: eastus)',
      'AZURE_REGION=eastus',
      '',
    ],
    cloudflare: [
      '# Cloudflare API token with Workers:Edit permission',
      'CF_API_TOKEN=',
      '',
      '# Cloudflare account ID (find in the Cloudflare dashboard)',
      'CF_ACCOUNT_ID=',
      '',
    ],
    flyio: [
      '# Fly.io API token — run: flyctl auth token',
      'FLY_API_TOKEN=',
      '',
      '# Fly.io app name (must be unique across all of Fly.io)',
      'FLY_APP_NAME=',
      '',
      '# Docker image to deploy (default: flyio/hellofly:latest)',
      'FLY_IMAGE=',
      '',
      '# Fly.io region (default: iad)',
      'FLY_REGION=iad',
      '',
    ],
  };

  return [...common, ...(providerVars[provider] ?? providerVars.acurast)].join('\n');
}
