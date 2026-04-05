/**
 * AcurastProvider — full v0.1 implementation of IPhonixProvider.
 *
 * Wires together:
 *  - AcurastMessagingClient (WebSocket auth + messaging via @acurast/dapp)
 *  - acurastDeploy / acurastEstimate / acurastListDeployments (CLI shell-outs)
 */
import type { IPhonixProvider } from '../base.js';
import type { DeploymentConfig, Deployment, CostEstimate, Message } from '../../types.js';
export declare class AcurastProvider implements IPhonixProvider {
    readonly name: "acurast";
    private messagingClient;
    private wsUrl;
    constructor(wsUrl?: string);
    /**
     * Connect to the Acurast network using a P256 private key hex string.
     */
    connect(secretKey: string): Promise<void>;
    /**
     * Disconnect from the Acurast WebSocket.
     */
    disconnect(): void;
    /**
     * Deploy a script to the Acurast network.
     * Bundles the entry file with esbuild and shells out to the acurast CLI.
     */
    deploy(config: DeploymentConfig): Promise<Deployment>;
    /**
     * Estimate the cost of a deployment in microACU.
     */
    estimate(config: DeploymentConfig): Promise<CostEstimate>;
    /**
     * Return a list of all deployments owned by the current wallet.
     */
    listDeployments(): Promise<Deployment[]>;
    /**
     * Send a message to a specific Acurast processor node.
     * @param processorId — processor public key hex string
     * @param payload     — JSON-serialisable data
     */
    send(processorId: string, payload: unknown): Promise<void>;
    /**
     * Register a handler for incoming messages from processors.
     * Returns an unsubscribe function.
     */
    onMessage(handler: (msg: Message) => void): () => void;
}
//# sourceMappingURL=index.d.ts.map