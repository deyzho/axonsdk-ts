/**
 * GCP Cloud Run deployment logic.
 *
 * Deploys a container image to Google Cloud Run via the Cloud Run v2 REST API.
 * Authentication uses an OAuth2 access token obtained via `gcloud auth print-access-token`.
 *
 * Required env vars:
 *   GCP_PROJECT_ID      — GCP project ID
 *   GCP_ACCESS_TOKEN    — OAuth2 access token (gcloud auth print-access-token)
 *   GCP_CONTAINER_IMAGE — Docker image URI (e.g. gcr.io/my-project/my-image:latest)
 *   GCP_REGION          — GCP region (default: us-central1)
 */

import { ProviderNotImplementedError } from '../../types.js';
import type { DeploymentConfig, Deployment, CostEstimate } from '../../types.js';
import { getPricing } from '../../pricing/index.js';

const CLOUD_RUN_API = 'https://run.googleapis.com/v2';

export async function gcpDeploy(options: { config: DeploymentConfig }): Promise<Deployment> {
  const projectId = process.env['GCP_PROJECT_ID'];
  const accessToken = process.env['GCP_ACCESS_TOKEN'];
  const containerImage = process.env['GCP_CONTAINER_IMAGE'];
  const region = process.env['GCP_REGION'] ?? 'us-central1';

  if (!projectId) throw new ProviderNotImplementedError('gcp', 'GCP_PROJECT_ID env var is required.');
  if (!accessToken) throw new ProviderNotImplementedError('gcp', 'GCP_ACCESS_TOKEN env var is required. Run: gcloud auth print-access-token');
  if (!containerImage) throw new ProviderNotImplementedError('gcp', 'GCP_CONTAINER_IMAGE env var is required.');

  const config = options.config;
  const serviceName = `axon-${Date.now()}`;
  const parent = `projects/${projectId}/locations/${region}`;

  const serviceBody = {
    template: {
      containers: [
        {
          image: containerImage,
          env: Object.entries(config.environment ?? {}).map(([name, value]) => ({ name, value })),
          resources: {
            limits: { cpu: '1', memory: '256Mi' },
          },
        },
      ],
      scaling: {
        minInstanceCount: 0,
        maxInstanceCount: config.replicas ?? 1,
      },
    },
    ingress: 'INGRESS_TRAFFIC_ALL',
  };

  const createUrl = `${CLOUD_RUN_API}/${parent}/services?serviceId=${serviceName}`;

  const res = await fetch(createUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(serviceBody),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    throw new Error(`Cloud Run CreateService failed: ${res.status} ${await res.text()}`);
  }

  // The create call returns a long-running operation; poll for the service URI
  const opData = await res.json() as { name?: string };
  const operationName = opData.name ?? '';

  // Poll the operation until done (max 2 minutes)
  let serviceUri = `https://${serviceName}-${projectId.replace(/-/g, '')}-${region.replace(/-/g, '')}.a.run.app`;
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 5_000));
    const opRes = await fetch(`https://run.googleapis.com/v2/${operationName}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (opRes.ok) {
      const opBody = await opRes.json() as { done?: boolean; response?: { uri?: string } };
      if (opBody.done && opBody.response?.uri) {
        serviceUri = opBody.response.uri;
        break;
      }
    }
  }

  return {
    id: `${parent}/services/${serviceName}`,
    provider: 'gcp',
    status: 'live',
    processorIds: [serviceUri],
    createdAt: new Date(),
    url: serviceUri,
  };
}

export async function gcpEstimate(config: DeploymentConfig): Promise<CostEstimate> {
  const durationSec = (config.schedule?.durationMs ?? 3_600_000) / 1000;
  const replicas = config.replicas ?? 1;

  const pricing = await getPricing();
  const computeCost = (pricing.gcpRunVcpuSec + pricing.gcpRunGibSec * 0.25) * durationSec * replicas;
  const requestCost = pricing.gcpRunRequest * replicas;
  const usdEquivalent = computeCost + requestCost;

  return {
    provider: 'gcp',
    token: 'USD',
    amount: usdEquivalent,
    usdEquivalent,
  };
}

export async function gcpListDeployments(): Promise<Array<{
  id: string; status: string; processorIds: string[];
}>> {
  const projectId = process.env['GCP_PROJECT_ID'];
  const accessToken = process.env['GCP_ACCESS_TOKEN'];
  const region = process.env['GCP_REGION'] ?? 'us-central1';

  if (!projectId || !accessToken) return [];

  try {
    const res = await fetch(
      `${CLOUD_RUN_API}/projects/${projectId}/locations/${region}/services`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!res.ok) return [];
    const data = await res.json() as {
      services?: Array<{ name: string; uid: string; uri?: string; terminalCondition?: { state?: string } }>;
    };
    return (data.services ?? [])
      .filter(s => s.name.includes('/axon-'))
      .map(s => ({
        id: s.name,
        status: s.terminalCondition?.state === 'CONDITION_SUCCEEDED' ? 'live' : 'pending',
        processorIds: s.uri ? [s.uri] : [],
      }));
  } catch {
    return [];
  }
}
