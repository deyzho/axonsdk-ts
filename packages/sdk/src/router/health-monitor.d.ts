/**
 * Copyright (c) 2024–present Phonix. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 *
 * This file contains trade secret algorithms that form the core of the Phonix
 * routing engine. Unauthorized copying, distribution, modification, reverse
 * engineering, or disclosure — in whole or in part — is strictly prohibited
 * without prior written consent from Phonix.
 *
 * For licensing enquiries contact: legal@phonix.dev
 */
export declare class ProviderHealthMonitor {
    private samples;
    private emaLatency;
    private emaCostUsd;
    private readonly windowMs;
    constructor(windowMs?: number);
    record(ok: boolean, latencyMs: number): void;
    recordCost(usd: number): void;
    private _evict;
    get successRate(): number;
    get latency(): number;
    get costUsd(): number;
    get total(): number;
    reset(): void;
}
//# sourceMappingURL=health-monitor.d.ts.map