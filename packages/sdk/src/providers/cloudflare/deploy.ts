/**
 * Cloudflare Workers deployment logic.
 *
 * Bundles a TypeScript/JavaScript entry file with esbuild to a single ESM file,
 * then uploads it as a Cloudflare Worker via the Cloudflare REST API using
 * multipart form upload (metadata + script).
 *
 * Required env vars:
 *   CF_API_TOKEN  — Cloudflare API token with Workers:Edit permission
 *   CF_ACCOUNT_ID — Cloudflare account ID
 */

import { ProviderNotImplementedError } from '../../types.js';
import type { DeploymentConfig, Deployment, CostEstimate } from '../../types.js';
import { getPricing } from '../../pricing/index.js';

const CF_API = 'https://api.cloudflare.com/client/v4';

export async function cloudflareDeploy(options: { config: DeploymentConfig }): Promise<Deployment> {
  const apiToken = process.env['CF_API_TOKEN'];
  const accountId = process.env['CF_ACCOUNT_ID'];

  if (!apiToken) throw new ProviderNotImplementedError('cloudflare', 'CF_API_TOKEN env var is required.');
  if (!accountId) throw new ProviderNotImplementedError('cloudflare', 'CF_ACCOUNT_ID env var is required.');

  const config = options.config;

  // Bundle entry file with esbuild to ESM
  const { build } = await import('esbuild');
  const bundleResult = await build({
    entryPoints: [config.code],
    bundle: true,
    platform: 'browser',
    format: 'esm',
    write: false,
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });

  const workerScript = bundleResult.outputFiles[0]?.text ?? '';
  const scriptName = `axon-${Date.now()}`;

  // Build multipart form data manually (no FormData in Node 18 with binary compatibility concerns)
  const boundary = `----AxonFormBoundary${Date.now().toString(16)}`;

  const metadata = JSON.stringify({
    body_part: 'script',
    bindings: Object.entries(config.environment ?? {}).map(([name, text]) => ({
      type: 'plain_text',
      name,
      text,
    })),
    compatibility_date: '2024-01-01',
    usage_model: 'bundled',
  });

  const parts: Buffer[] = [];

  // Metadata part
  parts.push(Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="metadata"\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${metadata}\r\n`
  ));

  // Script part
  parts.push(Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="script"; filename="worker.js"\r\n` +
    `Content-Type: application/javascript\r\n\r\n` +
    `${workerScript}\r\n`
  ));

  // Closing boundary
  parts.push(Buffer.from(`--${boundary}--\r\n`));

  const formBody = Buffer.concat(parts);

  const uploadRes = await fetch(
    `${CF_API}/accounts/${accountId}/workers/scripts/${scriptName}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: formBody,
      signal: AbortSignal.timeout(60_000),
    }
  );

  if (!uploadRes.ok) {
    throw new Error(`Cloudflare Worker upload failed: ${uploadRes.status} ${await uploadRes.text()}`);
  }

  // Get the workers.dev subdomain
  let subdomain = 'workers';
  try {
    const subdomainRes = await fetch(
      `${CF_API}/accounts/${accountId}/workers/subdomain`,
      {
        headers: { 'Authorization': `Bearer ${apiToken}` },
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (subdomainRes.ok) {
      const subdomainData = await subdomainRes.json() as { result?: { subdomain?: string } };
      if (subdomainData.result?.subdomain) {
        subdomain = subdomainData.result.subdomain;
      }
    }
  } catch {
    // Fall through with default
  }

  const workerUrl = `https://${scriptName}.${subdomain}.workers.dev`;

  return {
    id: scriptName,
    provider: 'cloudflare',
    status: 'live',
    processorIds: [workerUrl],
    createdAt: new Date(),
    url: workerUrl,
  };
}

export async function cloudflareEstimate(config: DeploymentConfig): Promise<CostEstimate> {
  const replicas = config.replicas ?? 1;
  const pricing = await getPricing();
  const est = replicas * pricing.cfWorkerRequest;
  const usdEquivalent = est;

  return {
    provider: 'cloudflare',
    token: 'USD',
    amount: usdEquivalent,
    usdEquivalent,
  };
}

export async function cloudflareListDeployments(): Promise<Array<{
  id: string; status: string; processorIds: string[];
}>> {
  const apiToken = process.env['CF_API_TOKEN'];
  const accountId = process.env['CF_ACCOUNT_ID'];

  if (!apiToken || !accountId) return [];

  try {
    const res = await fetch(
      `${CF_API}/accounts/${accountId}/workers/scripts`,
      {
        headers: { 'Authorization': `Bearer ${apiToken}` },
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!res.ok) return [];

    const data = await res.json() as {
      result?: Array<{ id: string; etag?: string }>;
    };

    // Get subdomain once
    let subdomain = 'workers';
    try {
      const subRes = await fetch(
        `${CF_API}/accounts/${accountId}/workers/subdomain`,
        {
          headers: { 'Authorization': `Bearer ${apiToken}` },
          signal: AbortSignal.timeout(5_000),
        }
      );
      if (subRes.ok) {
        const subData = await subRes.json() as { result?: { subdomain?: string } };
        if (subData.result?.subdomain) subdomain = subData.result.subdomain;
      }
    } catch {
      // Ignore
    }

    return (data.result ?? [])
      .filter(s => s.id.startsWith('axon-'))
      .map(s => ({
        id: s.id,
        status: 'live',
        processorIds: [`https://${s.id}.${subdomain}.workers.dev`],
      }));
  } catch {
    return [];
  }
}
