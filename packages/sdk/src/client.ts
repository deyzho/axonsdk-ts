/**
 * AxonClient — the main user-facing class.
 *
 * Selects a provider based on `options.provider` (default: acurast) and
 * proxies all calls through the IAxonProvider interface.
 *
 * Example:
 *   const client = new AxonClient({ provider: 'acurast', secretKey: process.env.AXON_SECRET_KEY });
 *   await client.connect();
 *   const deployment = await client.deploy({ runtime: 'nodejs', code: './src/index.ts', ... });
 *   await client.send(deployment.processorIds[0], { prompt: 'Hello' });
 *   client.onMessage((msg) => console.log(msg.payload));
 */

import type { IAxonProvider } from './providers/base.js';
import type {
  DeploymentConfig,
  Deployment,
  CostEstimate,
  Message,
  ProviderName,
} from './types.js';
import { AxonError } from './types.js';
import { AcurastProvider } from './providers/acurast/index.js';
import { FluenceProvider } from './providers/fluence/index.js';
import { KoiiProvider } from './providers/koii/index.js';
import { AkashProvider } from './providers/akash/index.js';
import { IoNetProvider } from './providers/ionet/index.js';
import { AwsProvider } from './providers/aws/index.js';
import { GcpProvider } from './providers/gcp/index.js';
import { AzureProvider } from './providers/azure/index.js';
import { CloudflareProvider } from './providers/cloudflare/index.js';
import { FlyioProvider } from './providers/flyio/index.js';

export interface AxonClientOptions {
  /** Provider to use. Defaults to 'acurast'. */
  provider?: ProviderName;
  /** P256 private key hex string. Falls back to AXON_SECRET_KEY env var. */
  secretKey?: string;
  /** Override the WebSocket URL (advanced, Acurast only). Must be wss://. */
  wsUrl?: string;
  /**
   * When set, incoming messages whose `from` field is not in this list are
   * silently discarded. Pass the `processorIds` from your Deployment here to
   * ensure only your own TEE processors can push messages to your handlers.
   */
  trustedProcessorIds?: string[];
  /**
   * Maximum serialised payload size in bytes for outgoing send() calls.
   * Defaults to 1 MiB. Prevents accidental dispatch of very large objects.
   */
  maxPayloadBytes?: number;
}

const DEFAULT_MAX_PAYLOAD_BYTES = 1 * 1024 * 1024; // 1 MiB

export class AxonClient {
  private provider: IAxonProvider;
  private secretKey: string;
  private connected: boolean = false;
  private trustedProcessorIds: Set<string> | null;
  private maxPayloadBytes: number;

  constructor(options: AxonClientOptions = {}) {
    const providerName: ProviderName = options.provider ?? 'acurast';
    this.secretKey =
      options.secretKey ?? process.env['AXON_SECRET_KEY'] ?? '';
    this.trustedProcessorIds = options.trustedProcessorIds
      ? new Set(options.trustedProcessorIds)
      : null;
    this.maxPayloadBytes = options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES;
    this.provider = AxonClient.createProvider(providerName, options.wsUrl);
  }

  private static createProvider(
    name: ProviderName,
    wsUrl?: string
  ): IAxonProvider {
    switch (name) {
      case 'acurast':
        return new AcurastProvider(wsUrl);
      case 'fluence':
        return new FluenceProvider();
      case 'koii':
        return new KoiiProvider();
      case 'akash':
        return new AkashProvider();
      case 'ionet':
        return new IoNetProvider();
      case 'aws':
        return new AwsProvider();
      case 'gcp':
        return new GcpProvider();
      case 'azure':
        return new AzureProvider();
      case 'cloudflare':
        return new CloudflareProvider();
      case 'flyio':
        return new FlyioProvider();
      default: {
        // TypeScript exhaustiveness check
        const _exhaustive: never = name;
        throw new AxonError(`Unknown provider: ${String(_exhaustive)}`);
      }
    }
  }

  /** The name of the active provider. */
  get providerName(): ProviderName {
    return this.provider.name;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Connect to the provider network.
   * Must be called before deploy(), send(), or onMessage().
   */
  async connect(): Promise<void> {
    if (!this.secretKey) {
      throw new AxonError(
        'No secret key provided. Set AXON_SECRET_KEY in your .env or pass secretKey to AxonClient.'
      );
    }
    await this.provider.connect(this.secretKey);
    this.connected = true;
  }

  /**
   * Disconnect from the provider network and clean up resources.
   */
  disconnect(): void {
    if (this.connected) {
      this.provider.disconnect();
      this.connected = false;
    }
  }

  // ─── Core operations ───────────────────────────────────────────────────────

  /**
   * Deploy code to the network.
   * @param config — DeploymentConfig with runtime, code path, schedule, etc.
   * @returns A Deployment object with the deployment ID and processor IDs.
   */
  async deploy(config: DeploymentConfig): Promise<Deployment> {
    return this.provider.deploy(config);
  }

  /**
   * Estimate the cost of a deployment without actually deploying.
   */
  async estimate(config: DeploymentConfig): Promise<CostEstimate> {
    return this.provider.estimate(config);
  }

  /**
   * List all deployments owned by the current keypair.
   */
  async listDeployments(): Promise<Deployment[]> {
    return this.provider.listDeployments();
  }

  /**
   * Delete/stop a deployment by its ID.
   * @param deploymentId — The deployment ID returned by deploy()
   */
  async teardown(deploymentId: string): Promise<void> {
    return this.provider.teardown(deploymentId);
  }

  /**
   * Send a message payload to a specific processor node.
   * @param processorId — processor public key (hex string)
   * @param payload     — any JSON-serialisable data
   */
  async send(processorId: string, payload: unknown): Promise<void> {
    // Validate processorId format: hex string (public key) or domain-safe identifier.
    // Rejects path traversal sequences, null bytes, and shell-special characters
    // that could be used for injection if the id is later embedded in a URL or command.
    if (!processorId || typeof processorId !== 'string') {
      throw new AxonError('processorId must be a non-empty string.');
    }
    if (processorId.length > 512) {
      throw new AxonError('processorId exceeds maximum length of 512 characters.');
    }
    if (/[\x00-\x1f\x7f]|\.\.[\\/]|[\\/]/.test(processorId)) {
      throw new AxonError(
        `Invalid processorId: must not contain control characters, null bytes, or path traversal sequences.`
      );
    }

    const serialised =
      typeof payload === 'string' ? payload : JSON.stringify(payload);
    const byteLength = Buffer.byteLength(serialised, 'utf8');
    if (byteLength > this.maxPayloadBytes) {
      throw new AxonError(
        `Payload size ${byteLength} bytes exceeds the limit of ${this.maxPayloadBytes} bytes. ` +
          `Adjust maxPayloadBytes in AxonClientOptions if intentional.`
      );
    }
    return this.provider.send(processorId, payload);
  }

  /**
   * Subscribe to incoming messages from processors.
   *
   * When `trustedProcessorIds` is set on the client, messages whose `from`
   * field is not in that set are silently dropped before reaching `handler`.
   *
   * @param handler — callback invoked on each message
   * @returns An unsubscribe function
   */
  onMessage(handler: (msg: Message) => void): () => void {
    const trusted = this.trustedProcessorIds;
    const filteredHandler = trusted
      ? (msg: Message) => {
          if (trusted.has(msg.from)) {
            handler(msg);
          }
        }
      : handler;
    return this.provider.onMessage(filteredHandler);
  }

  // ─── Template helpers ──────────────────────────────────────────────────────

  /**
   * High-level inference helper (Acurast only in v0.1).
   *
   * Deploys the inference template if not already connected,
   * sends a prompt to the first available processor, and returns
   * the result via the onMessage handler.
   *
   * @param options.model  — Model identifier (passed to processor; ignored in echo mode)
   * @param options.prompt — The prompt text to send
   * @param options.code   — Path to the inference handler entry point (e.g. './dist/inference-handler.js')
   * @returns A promise that resolves to the inference result string
   */
  async inference(options: { model?: string; prompt: string; code: string }): Promise<string> {
    if (!this.connected) {
      throw new AxonError('Call connect() before using inference()');
    }

    // Deploy the inference template
    const deployment = await this.deploy({
      runtime: 'nodejs',
      code: options.code,
      schedule: { type: 'on-demand', durationMs: 3_600_000 },
      replicas: 1,
    });

    if (deployment.processorIds.length === 0) {
      throw new AxonError(
        'No processors were assigned to the deployment. ' +
          'Check ACURAST_MNEMONIC and ensure your wallet has enough ACU.'
      );
    }

    return new Promise<string>((resolve, reject) => {
      const requestId = crypto.randomUUID();
      let unsubscribe: (() => void) | undefined;

      const timeout = setTimeout(() => {
        unsubscribe?.();
        reject(new AxonError('inference() timed out after 30 seconds'));
      }, 30_000);

      unsubscribe = this.onMessage((msg) => {
        const payload = msg.payload as { requestId?: string; result?: string };
        if (payload?.requestId === requestId && payload.result !== undefined) {
          clearTimeout(timeout);
          unsubscribe?.();
          resolve(payload.result);
        }
      });

      this.send(deployment.processorIds[0], {
        requestId,
        model: options.model ?? 'default',
        prompt: options.prompt,
      }).catch((err: Error) => {
        clearTimeout(timeout);
        unsubscribe?.();
        reject(err);
      });
    });
  }
}
