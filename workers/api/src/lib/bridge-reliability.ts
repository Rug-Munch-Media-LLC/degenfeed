/**
 * @degenfeed/api-worker — Bridge Reliability System
 *
 * Thin barrel — re-exports reliability modules.
 * Use `withReliability()` to chain circuit breaker → retry → execution.
 */

export { CircuitBreaker, getCircuitBreaker } from './bridge-reliability-circuit';
export { expectOk, withReliability } from './bridge-reliability-exec';
export { BridgeHealthMonitor } from './bridge-reliability-monitor';
export { calculateBackoff, sleep, withRetry } from './bridge-reliability-retry';
export {
  getAllBridgeStats,
  getProtocolStats,
  recordBridgeOperation,
} from './bridge-reliability-stats';
export type {
  BridgeHealthReport,
  BridgeStats,
  CircuitBreakerConfig,
  ProtocolHealth,
  ProtocolStats,
  ProtocolStatus,
  RetryOptions,
} from './bridge-reliability-types';
export {
  CircuitBreakerOpenError,
  HttpStatusError,
  MaxRetriesExceededError,
} from './bridge-reliability-types';
