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
import type { CircuitState } from './types.js';
export declare class CircuitBreaker {
    private _state;
    private failures;
    private lastOpenedAt;
    private readonly threshold;
    private readonly recoveryTimeout;
    constructor(threshold?: number, recoveryTimeoutMs?: number);
    get state(): CircuitState;
    get isCallable(): boolean;
    recordSuccess(): void;
    recordFailure(): void;
    reset(): void;
    /** For testing — force a specific state. */
    forceState(state: CircuitState): void;
}
//# sourceMappingURL=circuit-breaker.d.ts.map