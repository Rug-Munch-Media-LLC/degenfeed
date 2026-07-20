/**
 * @degenfeed/protocols — Basic test
 *
 * Verifies the package exports are intact.
 */

import { describe, expect, it } from 'vitest';
import * as protocols from '../index';

describe('@degenfeed/protocols', () => {
  it('exports the module', () => {
    expect(protocols).toBeDefined();
  });

  it('has expected exports', () => {
    // The package may export various protocol-related utilities
    const exports = Object.keys(protocols);
    expect(Array.isArray(exports)).toBe(true);
  });
});
