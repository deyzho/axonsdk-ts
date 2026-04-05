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
import type { RoutingStrategy } from './types.js';
import type { ProviderHealthMonitor } from './health-monitor.js';
import type { CircuitBreaker } from './circuit-breaker.js';
interface ScoringInput {
    health: ProviderHealthMonitor;
    circuit: CircuitBreaker;
}
export declare function score(strategy: RoutingStrategy, input: ScoringInput): number;
export {};
//# sourceMappingURL=strategy.d.ts.map