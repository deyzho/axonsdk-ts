/**
 * Copyright (c) 2024–present AxonSDK. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * Canary probes — the measurement layer behind the `quality` routing strategy
 * (the moat in `docs/STRATEGY.md`).
 *
 * A canary is a known-answer request: we send a probe whose correct response we
 * already know, and check whether a given provider returned it. Pass/fail feeds
 * the per-provider rolling quality score, which `quality`/`balanced` routing then
 * uses to prefer backends that are actually returning correct output.
 *
 * Scope: this module lands the **deterministic known-answer** path — probes whose
 * `validate()` is an exact/structural check (ideal for embeddings and
 * classification, where correctness is tractable). Live cross-provider correlation
 * for open-ended text generation is the documented follow-up (the "unproven part"
 * called out in STRATEGY.md), not implemented here.
 */

import type { ProviderName } from '../types.js';

export interface CanaryProbe {
  /** Stable identifier, used to correlate the probe with its response. */
  id: string;
  /** Payload sent to the provider, exactly as a normal request would be. */
  payload: unknown;
  /** Returns true iff `response` is the correct, expected answer for this probe. */
  validate(response: unknown): boolean;
}

export interface CanaryResult {
  provider: ProviderName;
  probeId: string;
  passed: boolean;
  latencyMs: number;
  at: Date;
}

/** Minimal surface the runner needs to feed quality back into a provider's health. */
export interface QualitySink {
  recordQuality(score0to1: number): void;
}

export type CanaryResultHandler = (result: CanaryResult) => void;

/**
 * Holds registered probes, decides when to sample, and converts probe outcomes
 * into quality observations on a provider's health monitor.
 *
 * The runner is transport-agnostic: the router owns sending the probe and
 * obtaining the response, then calls {@link CanaryRunner.record} with the verdict.
 */
export class CanaryRunner {
  private readonly probes: Map<string, CanaryProbe> = new Map();
  private samplePct: number;
  private readonly onResult?: CanaryResultHandler;

  /**
   * @param samplePct Fraction (0–1) of opportunities that should fire a canary.
   * @param onResult  Optional observer invoked for every recorded result.
   */
  constructor(samplePct = 0, onResult?: CanaryResultHandler) {
    this.samplePct = clampPct(samplePct);
    this.onResult = onResult;
  }

  /** Register (or replace) a probe by id. */
  register(probe: CanaryProbe): void {
    this.probes.set(probe.id, probe);
  }

  /** Remove a probe by id. */
  unregister(probeId: string): void {
    this.probes.delete(probeId);
  }

  /** All registered probes, in insertion order. */
  list(): CanaryProbe[] {
    return [...this.probes.values()];
  }

  get hasProbes(): boolean {
    return this.probes.size > 0;
  }

  setSamplePct(pct: number): void {
    this.samplePct = clampPct(pct);
  }

  /** Whether this opportunity should fire a canary, given the sample rate. */
  shouldSample(rng: () => number = Math.random): boolean {
    if (this.samplePct <= 0 || !this.hasProbes) return false;
    return rng() < this.samplePct;
  }

  /** Pick a probe to run (round-robin-free: random across registered probes). */
  pick(rng: () => number = Math.random): CanaryProbe | undefined {
    const all = this.list();
    if (all.length === 0) return undefined;
    return all[Math.floor(rng() * all.length)];
  }

  /**
   * Validate a probe response and feed the verdict into the provider's health.
   * Returns the structured result (also passed to the `onResult` observer).
   */
  record(
    provider: ProviderName,
    probe: CanaryProbe,
    response: unknown,
    latencyMs: number,
    sink: QualitySink,
  ): CanaryResult {
    const passed = probe.validate(response);
    sink.recordQuality(passed ? 1 : 0);
    const result: CanaryResult = {
      provider,
      probeId: probe.id,
      passed,
      latencyMs,
      at: new Date(),
    };
    this.onResult?.(result);
    return result;
  }
}

function clampPct(pct: number): number {
  if (Number.isNaN(pct)) return 0;
  return Math.max(0, Math.min(1, pct));
}
