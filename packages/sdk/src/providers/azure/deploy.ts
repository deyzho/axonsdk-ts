/**
 * Azure Container Instances deployment logic.
 *
 * Deploys a container image to Azure Container Instances via the Azure Management REST API.
 * Authentication uses a bearer token obtained via `az account get-access-token`.
 *
 * Required env vars:
 *   AZURE_SUBSCRIPTION_ID  — Azure subscription ID
 *   AZURE_BEARER_TOKEN     — Bearer token (az account get-access-token --query accessToken -o tsv)
 *   AZURE_CONTAINER_IMAGE  — Docker image URI
 *   AZURE_RESOURCE_GROUP   — Resource group name (default: axon-rg)
 *   AZURE_REGION           — Azure region (default: eastus)
 */

import { ProviderNotImplementedError } from '../../types.js';
import type { DeploymentConfig, Deployment, CostEstimate } from '../../types.js';

const ACI_API_VERSION = '2023-05-01';

// Azure Container Instances pricing (Linux, per second)
const COST_PER_VCPU_SEC = 0.0000135;
const COST_PER_GIB_SEC = 0.0000015;

export async function azureDeploy(options: { config: DeploymentConfig }): Promise<Deployment> {
  const subscriptionId = process.env['AZURE_SUBSCRIPTION_ID'];
  const bearerToken = process.env['AZURE_BEARER_TOKEN'];
  const containerImage = process.env['AZURE_CONTAINER_IMAGE'];
  const resourceGroup = process.env['AZURE_RESOURCE_GROUP'] ?? 'axon-rg';
  const region = process.env['AZURE_REGION'] ?? 'eastus';

  if (!subscriptionId) throw new ProviderNotImplementedError('azure', 'AZURE_SUBSCRIPTION_ID env var is required.');
  if (!bearerToken) throw new ProviderNotImplementedError('azure', 'AZURE_BEARER_TOKEN env var is required. Run: az account get-access-token');
  if (!containerImage) throw new ProviderNotImplementedError('azure', 'AZURE_CONTAINER_IMAGE env var is required.');

  const config = options.config;
  const containerGroupName = `axon-${Date.now()}`;

  const envVars = Object.entries(config.environment ?? {}).map(([name, value]) => ({ name, value }));

  const body = {
    location: region,
    properties: {
      containers: [
        {
          name: 'axon-container',
          properties: {
            image: containerImage,
            environmentVariables: envVars,
            resources: {
              requests: {
                cpu: 1,
                memoryInGB: 0.5,
              },
            },
            ports: [{ port: 443, protocol: 'TCP' }],
          },
        },
      ],
      osType: 'Linux',
      restartPolicy: 'Always',
      ipAddress: {
        type: 'Public',
        dnsNameLabel: containerGroupName,
        ports: [{ port: 443, protocol: 'TCP' }],
      },
    },
  };

  const url =
    `https://management.azure.com/subscriptions/${subscriptionId}` +
    `/resourceGroups/${resourceGroup}` +
    `/providers/Microsoft.ContainerInstance/containerGroups/${containerGroupName}` +
    `?api-version=${ACI_API_VERSION}`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${bearerToken}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    throw new Error(`Azure ACI CreateOrUpdate failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json() as {
    id: string;
    properties?: {
      ipAddress?: { fqdn?: string; ip?: string };
      provisioningState?: string;
    };
  };

  const fqdn = data.properties?.ipAddress?.fqdn ?? containerGroupName;
  const containerUrl = `https://${fqdn}`;

  return {
    id: data.id ?? containerGroupName,
    provider: 'azure',
    status: data.properties?.provisioningState === 'Succeeded' ? 'live' : 'pending',
    processorIds: [containerUrl],
    createdAt: new Date(),
    url: containerUrl,
  };
}

export async function azureEstimate(config: DeploymentConfig): Promise<CostEstimate> {
  const durationSec = (config.schedule?.durationMs ?? 3_600_000) / 1000;
  const replicas = config.replicas ?? 1;
  const memoryGib = 0.5;

  const computeCost = (COST_PER_VCPU_SEC + COST_PER_GIB_SEC * memoryGib) * durationSec * replicas;

  return {
    provider: 'azure',
    token: 'USD',
    amount: computeCost,
    usdEquivalent: computeCost,
  };
}

export async function azureListDeployments(): Promise<Array<{
  id: string; status: string; processorIds: string[];
}>> {
  const subscriptionId = process.env['AZURE_SUBSCRIPTION_ID'];
  const bearerToken = process.env['AZURE_BEARER_TOKEN'];
  const resourceGroup = process.env['AZURE_RESOURCE_GROUP'] ?? 'axon-rg';

  if (!subscriptionId || !bearerToken) return [];

  try {
    const url =
      `https://management.azure.com/subscriptions/${subscriptionId}` +
      `/resourceGroups/${resourceGroup}` +
      `/providers/Microsoft.ContainerInstance/containerGroups` +
      `?api-version=${ACI_API_VERSION}`;

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${bearerToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];

    const data = await res.json() as {
      value?: Array<{
        id: string;
        name: string;
        properties?: {
          provisioningState?: string;
          ipAddress?: { fqdn?: string };
        };
      }>;
    };

    return (data.value ?? [])
      .filter(g => g.name.startsWith('axon-'))
      .map(g => {
        const fqdn = g.properties?.ipAddress?.fqdn ?? g.name;
        return {
          id: g.id,
          status: g.properties?.provisioningState === 'Succeeded' ? 'live' : 'pending',
          processorIds: [`https://${fqdn}`],
        };
      });
  } catch {
    return [];
  }
}
