/**
 * Fly.io deployment logic.
 *
 * Deploys a container image as a Fly.io Machine via the Machines REST API.
 * Creates the app if it doesn't exist, then creates a Machine with the given image.
 *
 * Required env vars:
 *   FLY_API_TOKEN — Fly.io API token (flyctl auth token)
 *   FLY_APP_NAME  — Name of the Fly.io app to deploy to
 *   FLY_IMAGE     — Docker image to deploy (default: flyio/hellofly:latest)
 *   FLY_REGION    — Fly.io region (default: iad)
 */

import { ProviderNotImplementedError } from '../../types.js';
import type { DeploymentConfig, Deployment, CostEstimate } from '../../types.js';
import { getPricing } from '../../pricing/index.js';

const MACHINES_API = 'https://api.machines.dev/v1';

export async function flyioDeploy(options: { config: DeploymentConfig }): Promise<Deployment> {
  const apiToken = process.env['FLY_API_TOKEN'];
  const appName = process.env['FLY_APP_NAME'];
  const image = process.env['FLY_IMAGE'] ?? 'flyio/hellofly:latest';
  const region = process.env['FLY_REGION'] ?? 'iad';

  if (!apiToken) throw new ProviderNotImplementedError('flyio', 'FLY_API_TOKEN env var is required. Run: flyctl auth token');
  if (!appName) throw new ProviderNotImplementedError('flyio', 'FLY_APP_NAME env var is required.');

  const config = options.config;
  const authHeaders = {
    'Authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  };

  // Ensure the app exists — create it if not
  const appCheckRes = await fetch(`${MACHINES_API}/apps/${appName}`, {
    headers: authHeaders,
    signal: AbortSignal.timeout(10_000),
  });

  if (appCheckRes.status === 404) {
    const createAppRes = await fetch(`${MACHINES_API}/apps`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ app_name: appName, org_slug: 'personal' }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!createAppRes.ok && createAppRes.status !== 409) {
      throw new Error(`Fly.io CreateApp failed: ${createAppRes.status} ${await createAppRes.text()}`);
    }
  }

  // Convert environment variables
  const env: Record<string, string> = config.environment ?? {};

  // Create a Machine
  const machineBody = {
    region,
    config: {
      image,
      env,
      services: [
        {
          ports: [
            { port: 443, handlers: ['tls', 'http'] },
            { port: 80, handlers: ['http'] },
          ],
          protocol: 'tcp',
          internal_port: 8080,
        },
      ],
      checks: {
        health: {
          type: 'http',
          port: 8080,
          path: '/health',
          interval: '15s',
          timeout: '5s',
        },
      },
    },
  };

  const machineRes = await fetch(`${MACHINES_API}/apps/${appName}/machines`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(machineBody),
    signal: AbortSignal.timeout(60_000),
  });

  if (!machineRes.ok) {
    throw new Error(`Fly.io CreateMachine failed: ${machineRes.status} ${await machineRes.text()}`);
  }

  const machine = await machineRes.json() as {
    id: string;
    state?: string;
    region?: string;
  };

  const appUrl = `https://${appName}.fly.dev`;

  return {
    id: machine.id,
    provider: 'flyio',
    status: machine.state === 'started' ? 'live' : 'pending',
    processorIds: [appUrl],
    createdAt: new Date(),
    url: appUrl,
  };
}

export async function flyioEstimate(config: DeploymentConfig): Promise<CostEstimate> {
  const pricing = await getPricing();
  const hours = (config.schedule?.durationMs ?? 3_600_000) / 3_600_000;
  const usdEquivalent = pricing.flySharedCpu1xHour * hours * (config.replicas ?? 1);

  return {
    provider: 'flyio',
    token: 'USD',
    amount: usdEquivalent,
    usdEquivalent,
  };
}

export async function flyioListDeployments(): Promise<Array<{
  id: string; status: string; processorIds: string[];
}>> {
  const apiToken = process.env['FLY_API_TOKEN'];
  const appName = process.env['FLY_APP_NAME'];

  if (!apiToken || !appName) return [];

  try {
    const res = await fetch(`${MACHINES_API}/apps/${appName}/machines`, {
      headers: { 'Authorization': `Bearer ${apiToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];

    const machines = await res.json() as Array<{
      id: string;
      state?: string;
    }>;

    const appUrl = `https://${appName}.fly.dev`;
    return machines.map(m => ({
      id: m.id,
      status: m.state === 'started' ? 'live' : (m.state ?? 'pending'),
      processorIds: [appUrl],
    }));
  } catch {
    return [];
  }
}
