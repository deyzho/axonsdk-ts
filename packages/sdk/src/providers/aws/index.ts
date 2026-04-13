/**
 * AwsProvider — serverless compute via AWS Lambda.
 *
 * Deploys TypeScript/JavaScript entry files to AWS Lambda with a public
 * Function URL. Uses SigV4-signed REST API calls — no AWS SDK required.
 *
 * Required credentials:
 *   AWS_ACCESS_KEY_ID      — AWS access key ID
 *   AWS_SECRET_ACCESS_KEY  — AWS secret access key
 *   AWS_REGION             — AWS region (default: us-east-1)
 *   AWS_LAMBDA_ROLE_ARN    — IAM role ARN for Lambda execution
 */

import type { IAxonProvider } from '../base.js';
import type { DeploymentConfig, Deployment, CostEstimate, Message } from '../../types.js';
import { AwsMessagingClient } from './client.js';
import { awsDeploy, awsEstimate, awsListDeployments } from './deploy.js';

export class AwsProvider implements IAxonProvider {
  readonly name = 'aws' as const;

  private client: AwsMessagingClient;

  constructor() {
    this.client = new AwsMessagingClient();
  }

  async connect(secretKey: string): Promise<void> {
    await this.client.connect(secretKey);
  }

  disconnect(): void {
    this.client.disconnect();
  }

  async deploy(config: DeploymentConfig): Promise<Deployment> {
    return awsDeploy({ config });
  }

  async estimate(config: DeploymentConfig): Promise<CostEstimate> {
    return awsEstimate(config);
  }

  async listDeployments(): Promise<Deployment[]> {
    const raw = await awsListDeployments();
    return raw.map((d) => ({
      id: d.id,
      provider: 'aws' as const,
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
