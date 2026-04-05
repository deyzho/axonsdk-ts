/**
 * Config loader and generator for phonix.json.
 *
 * Exports:
 *  - loadConfig(cwd)  — read + validate phonix.json from a directory
 *  - generateConfig() — produce a phonix.json string from options
 *  - generateEnv()    — produce a .env stub with inline comments
 */
import type { PhonixConfig, ProviderName, RuntimeType } from './types.js';
/**
 * Read and validate `phonix.json` from `cwd`.
 * Throws ConfigValidationError if the file is invalid.
 */
export declare function loadConfig(cwd: string): Promise<PhonixConfig>;
export interface GenerateConfigOptions {
    projectName: string;
    provider?: ProviderName;
    runtime?: RuntimeType;
    entryFile?: string;
    scheduleType?: PhonixConfig['schedule']['type'];
    durationMs?: number;
    replicas?: number;
}
/**
 * Generate the content of a `phonix.json` file as a formatted JSON string.
 */
export declare function generateConfig(options: GenerateConfigOptions): string;
/**
 * Generate the content of a `.env` file with provider-specific placeholders.
 * Pass a `provider` to get provider-specific variables; defaults to Acurast.
 */
export declare function generateEnv(provider?: ProviderName): string;
//# sourceMappingURL=config.d.ts.map