/**
 * Copyright (c) 2024–present AxonSDK. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import type { RoutingStrategy } from './types.js';
import type { ProviderHealthMonitor } from './health-monitor.js';
import type { CircuitBreaker } from './circuit-breaker.js';

interface ScoringInput {
  health: ProviderHealthMonitor;
  circuit: CircuitBreaker;
}

// Weights are [availability, latency, cost, quality] and sum to 1 per strategy.
// `quality` is the moat signal (see docs/STRATEGY.md): route on whether distributed
// inference output is actually correct, not just on cost/latency/availability.
const W: Record<RoutingStrategy, [number, number, number, number]> = {
  availability: [0.78, 0.10, 0.05, 0.07],
  latency:      [0.10, 0.78, 0.05, 0.07],
  cost:         [0.10, 0.05, 0.78, 0.07],
  quality:      [0.15, 0.10, 0.05, 0.70],
  balanced:     [0.25, 0.25, 0.20, 0.30],
  'round-robin':[0.25, 0.25, 0.20, 0.30],
};

const MAX_LATENCY = 10_000;
const MAX_COST    = 1;

export function score(strategy: RoutingStrategy, input: ScoringInput): number {
  const { health, circuit } = input;
  if (!circuit.isCallable) return 0;

  const cm = circuit.state === 'half-open' ? 0.5 : 1.0;
  const [wa, wl, wc, wq] = W[strategy] ?? W.balanced;

  const a = health.successRate;
  const l = Math.max(0, 1 - health.latency / MAX_LATENCY);
  const c = Math.max(0, 1 - health.costUsd / MAX_COST);
  const q = health.quality;

  return cm * (wa * a + wl * l + wc * c + wq * q);
}
