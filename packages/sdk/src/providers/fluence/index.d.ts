/**
 * FluenceProvider — full implementation.
 *
 * Deploys Phonix spells to the Fluence P2P network and exchanges messages
 * with workers via @fluencelabs/js-client.
 *
 * Required credentials (in .env):
 *   FLUENCE_PRIVATE_KEY  — hex EVM-compatible private key
 *   FLUENCE_RELAY_ADDR   — Fluence relay multiaddr (optional, uses kras-00 default)
 *   FLUENCE_NETWORK      — 'testnet' | 'mainnet' (optional, default: 'testnet')
 */
import type { IPhonixProvider } from '../base.js';
import type { DeploymentConfig, Deployment, CostEstimate, Message } from '../../types.js';
export declare class FluenceProvider implements IPhonixProvider {
    readonly name: "fluence";
    private client;
    constructor(relayAddr?: string);
    connect(secretKey: string): Promise<void>;
    disconnect(): void;
    deploy(config: DeploymentConfig): Promise<Deployment>;
    estimate(config: DeploymentConfig): Promise<CostEstimate>;
    listDeployments(): Promise<Deployment[]>;
    send(workerId: string, payload: unknown): Promise<void>;
    onMessage(handler: (msg: Message) => void): () => void;
}
//# sourceMappingURL=index.d.ts.map