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
import { KoiiMessagingClient } from './client.js';
import { koiiDeploy, koiiEstimate, koiiListDeployments } from './deploy.js';
const DEFAULT_KOII_RPC = 'https://mainnet.koii.network';
export class KoiiProvider {
    name = 'koii';
    client;
    secretKey = '';
    constructor(rpcUrl) {
        const rpc = rpcUrl ?? process.env['KOII_RPC_URL'] ?? DEFAULT_KOII_RPC;
        this.client = new KoiiMessagingClient(rpc);
    }
    async connect(secretKey) {
        this.secretKey = secretKey;
        await this.client.connect(secretKey);
    }
    disconnect() {
        this.client.disconnect();
    }
    async deploy(config) {
        return koiiDeploy({ config, secretKey: this.secretKey });
    }
    async estimate(config) {
        const amountKoii = await koiiEstimate(config);
        // Approximate KOII/USD rate — replace with live oracle in production
        const KOII_USD_RATE = 0.02;
        return {
            provider: 'koii',
            token: 'KOII',
            amount: amountKoii,
            usdEquivalent: amountKoii * KOII_USD_RATE,
        };
    }
    async listDeployments() {
        const raw = await koiiListDeployments(this.secretKey);
        return raw.map((d) => ({
            id: d.id,
            provider: 'koii',
            status: d.status,
            processorIds: d.processorIds,
            createdAt: new Date(),
            url: `https://app.koii.network/tasks/${d.id}`,
        }));
    }
    async send(nodeEndpoint, payload) {
        await this.client.send(nodeEndpoint, payload);
    }
    onMessage(handler) {
        return this.client.onMessage(handler);
    }
}
//# sourceMappingURL=index.js.map