/**
 * KoiiProvider — full implementation.
 *
 * Deploys Phonix scripts as Koii Tasks on the K2 network and exchanges
 * messages with task nodes via their HTTP API.
 *
 * Required credentials (in .env):
 *   KOII_PRIVATE_KEY   — base58-encoded Solana-compatible private key
 *   KOII_IPFS_URL      — IPFS upload endpoint for task bundles
 *   KOII_IPFS_API_KEY  — IPFS API key (optional)
 *   KOII_NETWORK       — 'mainnet' | 'testnet' (optional, default: 'mainnet')
 *   KOII_TASK_ID       — Task public key, set automatically after first deploy
 */
import type { IPhonixProvider } from '../base.js';
import type { DeploymentConfig, Deployment, CostEstimate, Message } from '../../types.js';
export declare class KoiiProvider implements IPhonixProvider {
    readonly name: "koii";
    private client;
    private secretKey;
    constructor(rpcUrl?: string);
    connect(secretKey: string): Promise<void>;
    disconnect(): void;
    deploy(config: DeploymentConfig): Promise<Deployment>;
    estimate(config: DeploymentConfig): Promise<CostEstimate>;
    listDeployments(): Promise<Deployment[]>;
    send(nodeEndpoint: string, payload: unknown): Promise<void>;
    onMessage(handler: (msg: Message) => void): () => void;
}
//# sourceMappingURL=index.d.ts.map