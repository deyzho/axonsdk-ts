/**
 * Copyright (c) 2024–present AxonSDK. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import type { ProviderName, DeploymentConfig, Deployment, Message } from '../types.js';

// ─── Routing strategy ─────────────────────────────────────────────────────────

export type RoutingStrategy =
  | 'cost'
  | 'latency'
  | 'availability'
  | 'quality'
  | 'round-robin'
  | 'balanced';

// ─── Processor selection ──────────────────────────────────────────────────────

export type ProcessorStrategy = 'round-robin' | 'fastest' | 'random' | 'first';

// ─── Circuit breaker ──────────────────────────────────────────────────────────

export type CircuitState = 'closed' | 'open' | 'half-open';

// ─── Configuration ────────────────────────────────────────────────────────────

export interface RouterConfig {
  /** Ordered list of providers to route across. */
  providers: ProviderName[];

  /** Secret key used to connect all providers. */
  secretKey: string;

  /** How to select a provider on each request. Default: 'balanced'. */
  strategy?: RoutingStrategy;

  /** How to select a processor within a provider. Default: 'round-robin'. */
  processorStrategy?: ProcessorStrategy;

  /** Consecutive failures before opening a circuit. Default: 3. */
  failureThreshold?: number;

  /** Ms before a tripped circuit moves to half-open. Default: 30_000. */
  recoveryTimeoutMs?: number;

  /** Rolling window for health statistics in ms. Default: 60_000. */
  healthWindowMs?: number;

  /** Max send retries across providers on failure. Default: 2. */
  maxRetries?: number;

  /** Ms to wait between retry attempts. Default: 200. */
  retryDelayMs?: number;

  /**
   * When true (default), DePIN providers (Tier 1) are always ranked ahead of
   * cloud providers (Tier 2), so cloud is used only as fallback. Set false to
   * rank all providers in a single pool regardless of tier.
   */
  tierFallback?: boolean;

  /**
   * Fraction (0–1) of sends that also trigger a quality canary probe against the
   * selected provider. Default: 0 (canaries off). Requires registered probes.
   */
  canarySamplePct?: number;

  /**
   * Optional per-provider WebSocket URL overrides.
   * Key: provider name. Value: URL string.
   */
  wsUrls?: Partial<Record<ProviderName, string>>;
}

// ─── Health snapshot ──────────────────────────────────────────────────────────

export interface ProviderHealthSnapshot {
  provider: ProviderName;
  circuitState: CircuitState;
  score: number;
  latencyMs: number;
  successRate: number;
  totalRequests: number;
  estimatedCostUsd: number;
  /** Rolling quality score in [0, 1] from canary probes. Defaults to 1 until measured. */
  qualityScore: number;
}

// ─── Router deployment ────────────────────────────────────────────────────────

export interface RouterDeployment {
  providers: Array<{
    provider: ProviderName;
    deployment: Deployment;
  }>;
  processorCount: number;
  failedProviders: ProviderName[];
}

// ─── Send options ─────────────────────────────────────────────────────────────

export interface RouterSendOptions {
  /** Force a specific provider instead of using the routing strategy. */
  preferProvider?: ProviderName;
  /** Force a specific processorId instead of using the processor strategy. */
  preferProcessorId?: string;
}

// ─── Router events ────────────────────────────────────────────────────────────

export type RouterEventType =
  | 'provider:selected'
  | 'provider:failed'
  | 'provider:recovered'
  | 'circuit:opened'
  | 'circuit:closed'
  | 'retry'
  | 'failover'
  | 'canary:passed'
  | 'canary:failed';

export interface RouterEvent {
  type: RouterEventType;
  provider: ProviderName;
  detail?: string;
  timestamp: Date;
}

export type RouterEventHandler = (event: RouterEvent) => void;

// ─── Re-exports for convenience ───────────────────────────────────────────────

export type { ProviderName, DeploymentConfig, Deployment, Message };
