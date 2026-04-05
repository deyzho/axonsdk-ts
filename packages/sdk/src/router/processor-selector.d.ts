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
export type ProcessorStrategy = 'round-robin' | 'fastest' | 'random' | 'first';
export declare class ProcessorSelector {
    private rrIndex;
    private latencies;
    next(processorIds: string[], strategy: ProcessorStrategy): string;
    recordLatency(processorId: string, latencyMs: number): void;
    reset(): void;
}
//# sourceMappingURL=processor-selector.d.ts.map