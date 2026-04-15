import { describe, it, expect } from 'vitest';
import {
  AxonError,
  ProviderNotImplementedError,
  ConfigValidationError,
} from '../types.ts';

describe('AxonError', () => {
  it('should be an instance of Error', () => {
    const err = new AxonError('test error');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AxonError);
  });

  it('should have the correct name and message', () => {
    const err = new AxonError('something went wrong');
    expect(err.name).toBe('AxonError');
    expect(err.message).toBe('something went wrong');
  });

  it('should be catchable as Error', () => {
    expect(() => {
      throw new AxonError('thrown');
    }).toThrow(Error);
  });
});

describe('ProviderNotImplementedError', () => {
  it('should be an instance of AxonError and Error', () => {
    const err = new ProviderNotImplementedError('fluence', 'deploy');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AxonError);
    expect(err).toBeInstanceOf(ProviderNotImplementedError);
  });

  it('should include the provider name and method in the message', () => {
    const err = new ProviderNotImplementedError('fluence', 'deploy');
    expect(err.message).toContain('fluence');
    expect(err.message).toContain('deploy');
    expect(err.message).toContain('v0.2');
  });

  it('should have the correct name', () => {
    const err = new ProviderNotImplementedError('koii', 'connect');
    expect(err.name).toBe('ProviderNotImplementedError');
  });

  it('should work for all provider names', () => {
    const providers = ['fluence', 'koii'] as const;
    const methods = ['connect', 'deploy', 'estimate', 'listDeployments', 'send', 'onMessage'];

    for (const provider of providers) {
      for (const method of methods) {
        const err = new ProviderNotImplementedError(provider, method);
        expect(err.message).toContain(provider);
        expect(err.message).toContain(method);
      }
    }
  });
});

describe('ConfigValidationError', () => {
  it('should be an instance of AxonError', () => {
    const err = new ConfigValidationError('provider', 'must be a string');
    expect(err).toBeInstanceOf(AxonError);
    expect(err).toBeInstanceOf(ConfigValidationError);
  });

  it('should include field and reason in message', () => {
    const err = new ConfigValidationError('runtime', 'must be one of nodejs, python');
    expect(err.message).toContain('runtime');
    expect(err.message).toContain('must be one of nodejs, python');
  });
});
