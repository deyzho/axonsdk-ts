/**
 * Fluence deployment helpers.
 *
 * Flow:
 *  1. Bundle the entry file with esbuild (IIFE, phonix runtime prepended)
 *  2. Write to a temp directory as a Fluence spell JS file
 *  3. Shell out to the `fluence` CLI to deploy the spell
 *  4. Parse output for deal ID and worker peer IDs
 *  5. Return a Deployment object
 *
 * Requires the Fluence CLI: npm install -g @fluencelabs/cli
 */
import type { DeploymentConfig, Deployment } from '../../types.js';
export interface FluenceDeployOptions {
    config: DeploymentConfig;
    secretKey?: string;
    cwd?: string;
}
export declare function fluenceDeploy(options: FluenceDeployOptions): Promise<Deployment>;
/**
 * Estimate the cost of a Fluence deployment.
 * Returns an approximate FLT amount based on duration and replicas.
 */
export declare function fluenceEstimate(config: DeploymentConfig): Promise<number>;
/**
 * List active Fluence deployments (deals) for the current key.
 */
export declare function fluenceListDeployments(secretKey?: string): Promise<Array<{
    id: string;
    processorIds: string[];
    status: string;
}>>;
//# sourceMappingURL=deploy.d.ts.map