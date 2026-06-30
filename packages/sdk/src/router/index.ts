/**
 * Copyright (c) 2024–present AxonSDK. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import type { IAxonProvider } from '../providers/base.js';
import type { DeploymentConfig, Message, ProviderName } from '../types.js';
import { AxonError } from '../types.js';
import { AcurastProvider } from '../providers/acurast/index.js';
import { FluenceProvider } from '../providers/fluence/index.js';
import { KoiiProvider } from '../providers/koii/index.js';
import { AkashProvider } from '../providers/akash/index.js';
import { IoNetProvider } from '../providers/ionet/index.js';
import { AwsProvider } from '../providers/aws/index.js';
import { GcpProvider } from '../providers/gcp/index.js';
import { AzureProvider } from '../providers/azure/index.js';
import { CloudflareProvider } from '../providers/cloudflare/index.js';
import { FlyioProvider } from '../providers/flyio/index.js';
import { providerTier, isExperimental } from '../providers/registry.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { ProviderHealthMonitor } from './health-monitor.js';
import { ProcessorSelector } from './processor-selector.js';
import { score } from './strategy.js';
import { CanaryRunner } from './canary.js';
import type { CanaryProbe, CanaryResult } from './canary.js';
import type {
  RouterConfig,
  RouterDeployment,
  RouterSendOptions,
  ProviderHealthSnapshot,
  RouterEvent,
  RouterEventHandler,
} from './types.js';

interface ProviderEntry {
  provider: IAxonProvider;
  circuit: CircuitBreaker;
  health: ProviderHealthMonitor;
  selector: ProcessorSelector;
  processorIds: string[];
}

function createProvider(name: ProviderName, wsUrl?: string): IAxonProvider {
  switch (name) {
    // Tier 1 — DePIN / edge / TEE
    case 'acurast':    return new AcurastProvider(wsUrl);
    case 'ionet':      return new IoNetProvider();
    case 'akash':      return new AkashProvider();
    case 'fluence':    return new FluenceProvider();
    case 'koii':       return new KoiiProvider();
    // Tier 2 — cloud fallback
    case 'cloudflare': return new CloudflareProvider();
    case 'aws':        return new AwsProvider();
    case 'gcp':        return new GcpProvider();
    case 'azure':      return new AzureProvider();
    case 'flyio':      return new FlyioProvider();
    default: throw new AxonError(`Unknown provider: ${String(name)}`);
  }
}

export class AxonRouter {
  private entries: Map<ProviderName, ProviderEntry> = new Map();
  private rrOrder: ProviderName[] = [];
  private rrProviderIndex = 0;
  private readonly cfg: Required<Omit<RouterConfig, 'wsUrls'>> & { wsUrls: RouterConfig['wsUrls'] };
  private eventHandlers: RouterEventHandler[] = [];
  private readonly canary: CanaryRunner;

  constructor(config: RouterConfig) {
    const {
      providers,
      secretKey,
      strategy = 'balanced',
      processorStrategy = 'round-robin',
      failureThreshold = 3,
      recoveryTimeoutMs = 30_000,
      healthWindowMs = 60_000,
      maxRetries = 2,
      retryDelayMs = 200,
      tierFallback = true,
      canarySamplePct = 0,
      wsUrls,
    } = config;

    this.cfg = { providers, secretKey, strategy, processorStrategy, failureThreshold, recoveryTimeoutMs, healthWindowMs, maxRetries, retryDelayMs, tierFallback, canarySamplePct, wsUrls };

    this.canary = new CanaryRunner(canarySamplePct, (r) =>
      this._emit({
        type: r.passed ? 'canary:passed' : 'canary:failed',
        provider: r.provider,
        detail: r.probeId,
        timestamp: r.at,
      }),
    );

    for (const name of providers) {
      // Demoted providers are usable but explicitly outside the supported two-tier
      // model (see docs/STRATEGY.md). Warn once so operators choose them deliberately.
      if (isExperimental(name)) {
        console.warn(
          `[axon] provider '${name}' is experimental and not part of the supported set ` +
            `(Acurast, io.net, Akash, Cloudflare). See docs/STRATEGY.md.`,
        );
      }
      const wsUrl = wsUrls?.[name];
      this.entries.set(name, {
        provider: createProvider(name, wsUrl),
        circuit: new CircuitBreaker(failureThreshold, recoveryTimeoutMs),
        health: new ProviderHealthMonitor(healthWindowMs),
        selector: new ProcessorSelector(),
        processorIds: [],
      });
    }
    this.rrOrder = [...providers];
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    const results = await Promise.allSettled(
      [...this.entries.values()].map(e => e.provider.connect(this.cfg.secretKey))
    );
    let anyOk = false;
    for (const r of results) {
      if (r.status === 'fulfilled') anyOk = true;
    }
    if (!anyOk) throw new AxonError('All providers failed to connect');
  }

  disconnect(): void {
    for (const e of this.entries.values()) e.provider.disconnect();
  }

  // ─── Deploy ─────────────────────────────────────────────────────────────────

  async deploy(config: DeploymentConfig): Promise<RouterDeployment> {
    const results = await Promise.allSettled(
      [...this.entries.entries()].map(async ([name, e]) => {
        const deployment = await e.provider.deploy(config);
        e.processorIds = deployment.processorIds;
        return { provider: name, deployment };
      })
    );

    const providers: RouterDeployment['providers'] = [];
    const failedProviders: ProviderName[] = [];
    let processorCount = 0;

    for (const r of results) {
      if (r.status === 'fulfilled') {
        providers.push(r.value);
        processorCount += r.value.deployment.processorIds.length;
      } else {
        const name = this.cfg.providers[results.indexOf(r)];
        failedProviders.push(name);
      }
    }

    if (providers.length === 0) throw new AxonError('All providers failed to deploy');

    return { providers, processorCount, failedProviders };
  }

  // ─── Send with routing + failover ───────────────────────────────────────────

  async send(payload: unknown, options: RouterSendOptions = {}): Promise<void> {
    const ordered = this._rankProviders(options.preferProvider);
    if (ordered.length === 0) throw new AxonError('No callable providers available');

    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.cfg.maxRetries; attempt++) {
      const name = ordered[attempt % ordered.length];
      const entry = this.entries.get(name)!;

      if (!entry.circuit.isCallable) {
        if (attempt > 0) this._emit({ type: 'failover', provider: name, timestamp: new Date() });
        continue;
      }

      const processorIds = options.preferProcessorId
        ? [options.preferProcessorId]
        : entry.processorIds.length > 0
          ? entry.processorIds
          : ['default'];

      const processorId = entry.selector.next(processorIds, this.cfg.processorStrategy);
      if (attempt === 0) this._emit({ type: 'provider:selected', provider: name, timestamp: new Date() });
      else this._emit({ type: 'retry', provider: name, detail: `attempt ${attempt}`, timestamp: new Date() });

      const t0 = Date.now();
      try {
        await entry.provider.send(processorId, payload);
        const ms = Date.now() - t0;
        entry.health.record(true, ms);
        entry.selector.recordLatency(processorId, ms);
        entry.circuit.recordSuccess();
        if (entry.circuit.state === 'closed') {
          this._emit({ type: 'provider:recovered', provider: name, timestamp: new Date() });
        }
        return;
      } catch (err) {
        const ms = Date.now() - t0;
        entry.health.record(false, ms);
        entry.circuit.recordFailure();
        if (entry.circuit.state === 'open') {
          this._emit({ type: 'circuit:opened', provider: name, timestamp: new Date() });
        }
        this._emit({ type: 'provider:failed', provider: name, detail: String(err), timestamp: new Date() });
        lastErr = err;

        if (attempt < this.cfg.maxRetries && this.cfg.retryDelayMs > 0) {
          await new Promise(r => setTimeout(r, this.cfg.retryDelayMs));
        }
      }
    }

    throw lastErr ?? new AxonError('send failed after retries');
  }

  // ─── Message subscription ───────────────────────────────────────────────────

  onMessage(handler: (msg: Message) => void): () => void {
    const unsubs = [...this.entries.values()].map(e => e.provider.onMessage(handler));
    return () => unsubs.forEach(u => u());
  }

  // ─── Health + observability ─────────────────────────────────────────────────

  health(): ProviderHealthSnapshot[] {
    return [...this.entries.entries()].map(([name, e]) => ({
      provider: name,
      circuitState: e.circuit.state,
      score: score(this.cfg.strategy, { health: e.health, circuit: e.circuit }),
      latencyMs: e.health.latency,
      successRate: e.health.successRate,
      totalRequests: e.health.total,
      estimatedCostUsd: e.health.costUsd,
      qualityScore: e.health.quality,
    }));
  }

  onEvent(handler: RouterEventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      this.eventHandlers = this.eventHandlers.filter(h => h !== handler);
    };
  }

  reset(): void {
    for (const e of this.entries.values()) {
      e.circuit.reset();
      e.health.reset();
      e.selector.reset();
    }
  }

  // ─── Canary quality probes ────────────────────────────────────────────────

  /** Register a known-answer probe used to measure provider output quality. */
  registerCanary(probe: CanaryProbe): void {
    this.canary.register(probe);
  }

  /**
   * Run a single canary probe against a provider: send the probe payload, await
   * the correlated response, validate it, and feed the verdict into the
   * provider's rolling quality score (which `quality`/`balanced` routing uses).
   *
   * Correlation is heuristic — the first incoming message that `validate()`s is
   * treated as the response; a timeout counts as a failed probe. Robust
   * cross-provider correlation is the documented follow-up (see canary.ts).
   *
   * @returns the result, or null if the provider isn't registered / no probe exists.
   */
  async runCanary(
    provider: ProviderName,
    probe?: CanaryProbe,
    timeoutMs = 5_000,
  ): Promise<CanaryResult | null> {
    const entry = this.entries.get(provider);
    if (!entry) return null;
    const chosen = probe ?? this.canary.pick();
    if (!chosen) return null;

    const processorIds = entry.processorIds.length > 0 ? entry.processorIds : ['default'];
    const processorId = entry.selector.next(processorIds, this.cfg.processorStrategy);

    const t0 = Date.now();
    const response = await this._awaitProbeResponse(entry, processorId, chosen, timeoutMs);
    const latencyMs = Date.now() - t0;
    return this.canary.record(provider, chosen, response, latencyMs, entry.health);
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

  private _awaitProbeResponse(
    entry: ProviderEntry,
    processorId: string,
    probe: CanaryProbe,
    timeoutMs: number,
  ): Promise<unknown> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (resp: unknown) => {
        if (settled) return;
        settled = true;
        unsub();
        clearTimeout(timer);
        resolve(resp);
      };
      const unsub = entry.provider.onMessage((msg) => {
        if (probe.validate(msg.payload)) finish(msg.payload);
      });
      const timer = setTimeout(() => finish(undefined), timeoutMs);
      entry.provider.send(processorId, probe.payload).catch(() => finish(undefined));
    });
  }

  private _rankProviders(prefer?: ProviderName): ProviderName[] {
    const all = [...this.entries.keys()];

    // Advance the round-robin cursor once per ranking (not once per tier).
    let rrStart = 0;
    if (this.cfg.strategy === 'round-robin') {
      rrStart = this.rrProviderIndex;
      this.rrProviderIndex = (this.rrProviderIndex + 1) % Math.max(1, this.rrOrder.length);
    }

    const rank = (names: ProviderName[]): ProviderName[] => {
      if (names.length === 0) return [];
      if (this.cfg.strategy === 'round-robin') {
        const start = rrStart % names.length;
        const out: ProviderName[] = [];
        for (let i = 0; i < names.length; i++) out.push(names[(start + i) % names.length]);
        return out;
      }
      return names
        .map((name) => {
          const e = this.entries.get(name)!;
          return { name, s: score(this.cfg.strategy, { health: e.health, circuit: e.circuit }) };
        })
        .sort((a, b) => b.s - a.s)
        .map((x) => x.name);
    };

    // Two-tier: rank within DePIN (Tier 1) and cloud (Tier 2) separately, then
    // concatenate so cloud is reached only after every Tier-1 provider is
    // exhausted. Disable via `tierFallback: false` to rank as a single pool.
    let ordered: ProviderName[];
    if (this.cfg.tierFallback) {
      ordered = [
        ...rank(all.filter((n) => providerTier(n) === 'depin')),
        ...rank(all.filter((n) => providerTier(n) === 'cloud')),
      ];
    } else {
      ordered = rank(all);
    }

    if (prefer && this.entries.has(prefer)) {
      return [prefer, ...ordered.filter((n) => n !== prefer)];
    }
    return ordered;
  }

  private _emit(event: RouterEvent): void {
    for (const h of this.eventHandlers) h(event);
  }
}

export type { RouterConfig, RouterDeployment, RouterSendOptions, ProviderHealthSnapshot, RouterEvent, RouterEventHandler };
