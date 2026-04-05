/**
 * AkashProvider — full implementation of IPhonixProvider for the Akash Network.
 *
 * Akash is a decentralised cloud computing marketplace where providers bid to
 * run containerised workloads. Phonix wraps the full deployment lifecycle:
 *
 *  1. Bundle the user's TypeScript/JavaScript entry file with esbuild
 *  2. Upload the bundle to IPFS (CID used as the immutable source of truth)
 *  3. Generate an Akash SDL that downloads the bundle at container startup
 *  4. Create the deployment via the provider-services CLI
 *  5. Communicate with running containers over HTTPS (POST /message)
 *
 * Required credentials (in .env — run `phonix auth akash` to set up):
 *   AKASH_MNEMONIC       — BIP-39 wallet mnemonic (12 or 24 words)
 *   AKASH_IPFS_URL       — IPFS API endpoint for uploading bundles
 *   AKASH_IPFS_API_KEY   — IPFS API key (optional for public nodes)
 *   AKASH_NODE           — Akash RPC node (default: https://rpc.akashnet.net:443)
 *   AKASH_NET            — mainnet | testnet (default: mainnet)
 */
import type { IPhonixProvider } from '../base.js';
import type { DeploymentConfig, Deployment, CostEstimate, Message } from '../../types.js';
export declare class AkashProvider implements IPhonixProvider {
    readonly name: "akash";
    private client;
    constructor();
    connect(secretKey: string): Promise<void>;
    disconnect(): void;
    deploy(config: DeploymentConfig): Promise<Deployment>;
    estimate(config: DeploymentConfig): Promise<CostEstimate>;
    listDeployments(): Promise<Deployment[]>;
    send(leaseEndpoint: string, payload: unknown): Promise<void>;
    onMessage(handler: (msg: Message) => void): () => void;
}
//# sourceMappingURL=index.d.ts.map