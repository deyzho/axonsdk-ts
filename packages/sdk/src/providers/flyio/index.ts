/**
 * FlyioProvider — container compute via Fly.io Machines.
 *
 * Deploys Docker container images to Fly.io via the Machines REST API.
 * Machines run globally close to users in 30+ regions.
 *
 * Required credentials:
 *   FLY_API_TOKEN — Fly.io API token (flyctl auth token)
 *   FLY_APP_NAME  — Name of the Fly.io app to deploy to
 *   FLY_IMAGE     — Docker image to deploy (default: flyio/hellofly:latest)
 *   FLY_REGION    — Fly.io region (default: iad)
 */

import type { IAxonProvider } from '../base.js';
import type { DeploymentConfig, Deployment, CostEstimate, Message } from '../../types.js';
import { FlyioMessagingClient } from './client.js';
import { flyioDeploy, flyioEstimate, flyioListDeployments } from './deploy.js';

export class FlyioProvider implements IAxonProvider {
  readonly name = 'flyio' as const;

  private client: FlyioMessagingClient;

  constructor() {
    this.client = new FlyioMessagingClient();
  }

  async connect(secretKey: string): Promise<void> {
    await this.client.connect(secretKey);
  }

  disconnect(): void {
    this.client.disconnect();
  }

  async deploy(config: DeploymentConfig): Promise<Deployment> {
    return flyioDeploy({ config });
  }

  async estimate(config: DeploymentConfig): Promise<CostEstimate> {
    return flyioEstimate(config);
  }

  async listDeployments(): Promise<Deployment[]> {
    const raw = await flyioListDeployments();
    return raw.map((d) => ({
      id: d.id,
      provider: 'flyio' as const,
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
