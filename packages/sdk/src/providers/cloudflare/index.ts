/**
 * CloudflareProvider — edge compute via Cloudflare Workers.
 *
 * Bundles and deploys JavaScript/TypeScript entry files to Cloudflare Workers
 * via the Cloudflare REST API. Workers run at the edge in 300+ locations.
 *
 * Required credentials:
 *   CF_API_TOKEN  — Cloudflare API token (Workers:Edit permission)
 *   CF_ACCOUNT_ID — Cloudflare account ID
 */

import type { IAxonProvider } from '../base.js';
import type { DeploymentConfig, Deployment, CostEstimate, Message } from '../../types.js';
import { CloudflareMessagingClient } from './client.js';
import { cloudflareDeploy, cloudflareEstimate, cloudflareListDeployments } from './deploy.js';

export class CloudflareProvider implements IAxonProvider {
  readonly name = 'cloudflare' as const;

  private client: CloudflareMessagingClient;

  constructor() {
    this.client = new CloudflareMessagingClient();
  }

  async connect(secretKey: string): Promise<void> {
    await this.client.connect(secretKey);
  }

  disconnect(): void {
    this.client.disconnect();
  }

  async deploy(config: DeploymentConfig): Promise<Deployment> {
    return cloudflareDeploy({ config });
  }

  async estimate(config: DeploymentConfig): Promise<CostEstimate> {
    return cloudflareEstimate(config);
  }

  async listDeployments(): Promise<Deployment[]> {
    const raw = await cloudflareListDeployments();
    return raw.map((d) => ({
      id: d.id,
      provider: 'cloudflare' as const,
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
