/**
 * AzureProvider — containerised compute via Azure Container Instances.
 *
 * Deploys Docker container images to ACI via the Azure Management REST API.
 * Authentication uses a bearer token from `az account get-access-token`.
 *
 * Required credentials:
 *   AZURE_SUBSCRIPTION_ID  — Azure subscription ID
 *   AZURE_BEARER_TOKEN     — Bearer token (az account get-access-token)
 *   AZURE_CONTAINER_IMAGE  — Docker image URI
 *   AZURE_RESOURCE_GROUP   — Resource group name (default: axon-rg)
 *   AZURE_REGION           — Azure region (default: eastus)
 */

import type { IAxonProvider } from '../base.js';
import type { DeploymentConfig, Deployment, CostEstimate, Message } from '../../types.js';
import { AzureMessagingClient } from './client.js';
import { azureDeploy, azureEstimate, azureListDeployments } from './deploy.js';

export class AzureProvider implements IAxonProvider {
  readonly name = 'azure' as const;

  private client: AzureMessagingClient;

  constructor() {
    this.client = new AzureMessagingClient();
  }

  async connect(secretKey: string): Promise<void> {
    await this.client.connect(secretKey);
  }

  disconnect(): void {
    this.client.disconnect();
  }

  async deploy(config: DeploymentConfig): Promise<Deployment> {
    return azureDeploy({ config });
  }

  async estimate(config: DeploymentConfig): Promise<CostEstimate> {
    return azureEstimate(config);
  }

  async listDeployments(): Promise<Deployment[]> {
    const raw = await azureListDeployments();
    return raw.map((d) => ({
      id: d.id,
      provider: 'azure' as const,
      status: d.status as Deployment['status'],
      processorIds: d.processorIds,
      createdAt: new Date(),
      url: d.processorIds[0],
    }));
  }

  async send(processorId: string, payload: unknown): Promise<void> {
    await this.client.send(processorId, payload);
  }

  onMessage(handler: (msg: Message) => void): () => void {
    return this.client.onMessage(handler);
  }
}
