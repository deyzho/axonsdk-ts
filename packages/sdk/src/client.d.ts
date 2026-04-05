/**
 * PhonixClient — the main user-facing class.
 *
 * Selects a provider based on `options.provider` (default: acurast) and
 * proxies all calls through the IPhonixProvider interface.
 *
 * Example:
 *   const client = new PhonixClient({ provider: 'acurast', secretKey: process.env.PHONIX_SECRET_KEY });
 *   await client.connect();
 *   const deployment = await client.deploy({ runtime: 'nodejs', code: './src/index.ts', ... });
 *   await client.send(deployment.processorIds[0], { prompt: 'Hello' });
 *   client.onMessage((msg) => console.log(msg.payload));
 */
import type { DeploymentConfig, Deployment, CostEstimate, Message, ProviderName } from './types.js';
export interface PhonixClientOptions {
    /** Provider to use. Defaults to 'acurast'. */
    provider?: ProviderName;
    /** P256 private key hex string. Falls back to PHONIX_SECRET_KEY env var. */
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
export declare class PhonixClient {
    private provider;
    private secretKey;
    private connected;
    private trustedProcessorIds;
    private maxPayloadBytes;
    constructor(options?: PhonixClientOptions);
    private static createProvider;
    /** The name of the active provider. */
    get providerName(): ProviderName;
    /**
     * Connect to the provider network.
     * Must be called before deploy(), send(), or onMessage().
     */
    connect(): Promise<void>;
    /**
     * Disconnect from the provider network and clean up resources.
     */
    disconnect(): void;
    /**
     * Deploy code to the network.
     * @param config — DeploymentConfig with runtime, code path, schedule, etc.
     * @returns A Deployment object with the deployment ID and processor IDs.
     */
    deploy(config: DeploymentConfig): Promise<Deployment>;
    /**
     * Estimate the cost of a deployment without actually deploying.
     */
    estimate(config: DeploymentConfig): Promise<CostEstimate>;
    /**
     * List all deployments owned by the current keypair.
     */
    listDeployments(): Promise<Deployment[]>;
    /**
     * Send a message payload to a specific processor node.
     * @param processorId — processor public key (hex string)
     * @param payload     — any JSON-serialisable data
     */
    send(processorId: string, payload: unknown): Promise<void>;
    /**
     * Subscribe to incoming messages from processors.
     *
     * When `trustedProcessorIds` is set on the client, messages whose `from`
     * field is not in that set are silently dropped before reaching `handler`.
     *
     * @param handler — callback invoked on each message
     * @returns An unsubscribe function
     */
    onMessage(handler: (msg: Message) => void): () => void;
    /**
     * High-level inference helper (Acurast only in v0.1).
     *
     * Deploys the inference template if not already connected,
     * sends a prompt to the first available processor, and returns
     * the result via the onMessage handler.
     *
     * @param options.model  — Model identifier (passed to processor; ignored in echo mode)
     * @param options.prompt — The prompt text to send
     * @returns A promise that resolves to the inference result string
     */
    inference(options: {
        model?: string;
        prompt: string;
    }): Promise<string>;
}
//# sourceMappingURL=client.d.ts.map