/**
 * Copyright (c) 2024–present Phonix. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */
const DECAY_ON_SUCCESS = 1;
export class CircuitBreaker {
    _state = 'closed';
    failures = 0;
    lastOpenedAt = 0;
    threshold;
    recoveryTimeout;
    constructor(threshold = 3, recoveryTimeoutMs = 30_000) {
        this.threshold = threshold;
        this.recoveryTimeout = recoveryTimeoutMs;
    }
    get state() {
        if (this._state === 'open') {
            if (Date.now() - this.lastOpenedAt >= this.recoveryTimeout) {
                this._state = 'half-open';
            }
        }
        return this._state;
    }
    get isCallable() {
        return this.state !== 'open';
    }
    recordSuccess() {
        if (this._state === 'half-open') {
            this._state = 'closed';
            this.failures = 0;
        }
        else if (this._state === 'closed') {
            this.failures = Math.max(0, this.failures - DECAY_ON_SUCCESS);
        }
    }
    recordFailure() {
        this.failures++;
        if (this._state === 'half-open' || this.failures >= this.threshold) {
            this._state = 'open';
            this.lastOpenedAt = Date.now();
        }
    }
    reset() {
        this._state = 'closed';
        this.failures = 0;
        this.lastOpenedAt = 0;
    }
    /** For testing — force a specific state. */
    forceState(state) {
        this._state = state;
        if (state === 'open')
            this.lastOpenedAt = Date.now();
    }
}
//# sourceMappingURL=circuit-breaker.js.map