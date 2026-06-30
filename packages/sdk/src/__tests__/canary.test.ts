import { describe, it, expect, vi } from 'vitest';
import { CanaryRunner } from '../router/canary.ts';
import type { CanaryProbe, CanaryResult } from '../router/canary.ts';
import { ProviderHealthMonitor } from '../router/health-monitor.ts';

const passProbe: CanaryProbe = {
  id: 'echo-42',
  payload: { ask: 'meaning' },
  validate: (r) => r === 42,
};

describe('CanaryRunner', () => {
  it('registers, lists, and unregisters probes', () => {
    const runner = new CanaryRunner();
    expect(runner.hasProbes).toBe(false);
    runner.register(passProbe);
    expect(runner.hasProbes).toBe(true);
    expect(runner.list().map((p) => p.id)).toEqual(['echo-42']);
    runner.unregister('echo-42');
    expect(runner.hasProbes).toBe(false);
  });

  it('records a passing probe as quality 1 and emits the result', () => {
    const results: CanaryResult[] = [];
    const runner = new CanaryRunner(1, (r) => results.push(r));
    const health = new ProviderHealthMonitor();

    const result = runner.record('acurast', passProbe, 42, 120, health);

    expect(result.passed).toBe(true);
    expect(result.provider).toBe('acurast');
    expect(results).toHaveLength(1);
    // quality stays at 1 when the probe passes
    expect(health.quality).toBe(1);
  });

  it('records a failing probe as quality 0 and drags the score down', () => {
    const runner = new CanaryRunner();
    const health = new ProviderHealthMonitor();

    const result = runner.record('ionet', passProbe, 'garbage', 90, health);

    expect(result.passed).toBe(false);
    // EMA = 0.2*0 + 0.8*1 = 0.8 — below the optimistic default of 1
    expect(health.quality).toBeCloseTo(0.8);
    expect(health.quality).toBeLessThan(1);
  });

  it('shouldSample honours the sample rate and probe presence', () => {
    const off = new CanaryRunner(0);
    off.register(passProbe);
    expect(off.shouldSample(() => 0)).toBe(false); // 0% never samples

    const on = new CanaryRunner(0.5);
    expect(on.shouldSample(() => 0.1)).toBe(false); // no probes registered
    on.register(passProbe);
    expect(on.shouldSample(() => 0.1)).toBe(true);  // 0.1 < 0.5
    expect(on.shouldSample(() => 0.9)).toBe(false); // 0.9 >= 0.5
  });

  it('clamps out-of-range sample rates', () => {
    const runner = new CanaryRunner(5);
    runner.register(passProbe);
    expect(runner.shouldSample(() => 0.99)).toBe(true); // clamped to 1 → always
    runner.setSamplePct(-2);
    expect(runner.shouldSample(() => 0)).toBe(false);   // clamped to 0 → never
  });

  it('pick returns a registered probe', () => {
    const runner = new CanaryRunner();
    expect(runner.pick()).toBeUndefined();
    runner.register(passProbe);
    expect(runner.pick()?.id).toBe('echo-42');
  });
});
