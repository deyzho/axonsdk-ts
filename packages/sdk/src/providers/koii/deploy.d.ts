/**
 * Koii deployment helpers.
 *
 * Flow:
 *  1. Bundle the entry file with esbuild (IIFE, phonix runtime prepended)
 *  2. Upload the bundle to IPFS
 *  3. Register the task on the K2 chain via the Koii task creation CLI
 *  4. Return a Deployment object with the task public key
 *
 * Requires:
 *  - KOII_PRIVATE_KEY  — base58-encoded Solana-compatible private key
 *  - KOII_IPFS_URL     — IPFS upload endpoint
 *  - KOII_IPFS_API_KEY — IPFS API key (optional)
 *
 * The Koii task creation CLI (@_koii/create-task-cli) must be available,
 * or the task can be created manually via the Koii desktop app.
 */
import type { DeploymentConfig, Deployment } from '../../types.js';
export interface KoiiDeployOptions {
    config: DeploymentConfig;
    secretKey?: string;
    cwd?: string;
}
export declare function koiiDeploy(options: KoiiDeployOptions): Promise<Deployment>;
/**
 * Estimate the cost of a Koii deployment.
 * Returns an approximate KOII amount (staking requirement + fees).
 */
export declare function koiiEstimate(config: DeploymentConfig): Promise<number>;
/**
 * List active Koii tasks for the current key.
 */
export declare function koiiListDeployments(secretKey?: string): Promise<Array<{
    id: string;
    processorIds: string[];
    status: string;
}>>;
//# sourceMappingURL=deploy.d.ts.map