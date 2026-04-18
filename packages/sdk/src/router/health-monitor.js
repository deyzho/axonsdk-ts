/**
 * Copyright (c) 2024–present Phonix. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */
const EMA_α = 0.2;
const OPTIMISTIC_INITIAL_LATENCY = 500;
const OPTIMISTIC_INITIAL_COST = 0;
export class ProviderHealthMonitor {
    samples = [];
    emaLatency = OPTIMISTIC_INITIAL_LATENCY;
    emaCostUsd = OPTIMISTIC_INITIAL_COST;
    windowMs;
    constructor(windowMs = 60_000) {
        this.windowMs = windowMs;
    }
    record(ok, latencyMs) {
        this.samples.push({ ts: Date.now(), ok, latencyMs });
        this._evict();
        this.emaLatency = EMA_α * latencyMs + (1 - EMA_α) * this.emaLatency;
    }
    recordCost(usd) {
        this.emaCostUsd = EMA_α * usd + (1 - EMA_α) * this.emaCostUsd;
    }
    _evict() {
        const cutoff = Date.now() - this.windowMs;
        let i = 0;
        while (i < this.samples.length && this.samples[i].ts < cutoff)
            i++;
        if (i > 0)
            this.samples = this.samples.slice(i);
    }
    get successRate() {
        this._evict();
        if (this.samples.length === 0)
            return 1;
        let ok = 0;
        for (const s of this.samples)
            if (s.ok)
                ok++;
        return ok / this.samples.length;
    }
    get latency() {
        return this.emaLatency;
    }
    get costUsd() {
        return this.emaCostUsd;
    }
    get total() {
        return this.samples.length;
    }
    reset() {
        this.samples = [];
        this.emaLatency = OPTIMISTIC_INITIAL_LATENCY;
        this.emaCostUsd = OPTIMISTIC_INITIAL_COST;
    }
}
//# sourceMappingURL=health-monitor.js.map