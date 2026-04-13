/**
 * GcpProvider — serverless compute via Google Cloud Run.
 *
 * Deploys container images to Cloud Run via the v2 REST API.
 * Authentication uses a GCP OAuth2 access token.
 *
 * Required credentials:
 *   GCP_PROJECT_ID      — GCP project ID
 *   GCP_ACCESS_TOKEN    — OAuth2 access token (gcloud auth print-access-token)
 *   GCP_CONTAINER_IMAGE — Docker image URI
 *   GCP_REGION          — GCP region (default: us-central1)
 */

import type { IAxonProvider } from '../base.js';
import type { DeploymentConfig, Deployment, CostEstimate, Message } from '../../types.js';
import { GcpMessagingClient } from './client.js';
import { gcpDeploy, gcpEstimate, gcpListDeployments } from './deploy.js';

export class GcpProvider implements IAxonProvider {
  readonly name = 'gcp' as const;

  private client: GcpMessagingClient;

  constructor() {
    this.client = new GcpMessagingClient();
  }

  async connect(secretKey: string): Promise<void> {
    await this.client.connect(secretKey);
  }

  disconnect(): void {
    this.client.disconnect();
  }

  async deploy(config: DeploymentConfig): Promise<Deployment> {
    return gcpDeploy({ config });
  }

  async estimate(config: DeploymentConfig): Promise<CostEstimate> {
    return gcpEstimate(config);
  }

  async listDeployments(): Promise<Deployment[]> {
    const raw = await gcpListDeployments();
    return raw.map((d) => ({
      id: d.id,
      provider: 'gcp' as const,
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
