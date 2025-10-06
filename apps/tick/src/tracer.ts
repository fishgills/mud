import tracer from 'dd-trace';

// Log Datadog configuration for debugging
console.log('🐕 [DATADOG] Initializing dd-trace...');
console.log('🐕 [DATADOG] DD_ENV:', process.env.DD_ENV);
console.log('🐕 [DATADOG] DD_SERVICE:', process.env.DD_SERVICE);
console.log('🐕 [DATADOG] DD_VERSION:', process.env.DD_VERSION);
console.log('🐕 [DATADOG] DD_SITE:', process.env.DD_SITE);
console.log(
  '🐕 [DATADOG] DD_API_KEY:',
  process.env.DD_API_KEY ? '***SET***' : 'MISSING',
);
console.log('🐕 [DATADOG] DD_TRACE_ENABLED:', process.env.DD_TRACE_ENABLED);
console.log(
  '🐕 [DATADOG] DD_RUNTIME_METRICS_ENABLED:',
  process.env.DD_RUNTIME_METRICS_ENABLED,
);
console.log(
  '🐕 [DATADOG] DD_PROFILING_ENABLED:',
  process.env.DD_PROFILING_ENABLED,
);
console.log('🐕 [DATADOG] DD_LOGS_INJECTION:', process.env.DD_LOGS_INJECTION);

// Initialize Datadog tracer; rely on environment variables for configuration
// (DD_SERVICE, DD_ENV, DD_VERSION, DD_TRACE_AGENT_URL, DD_LOGS_INJECTION, etc.)
const tracerInstance = tracer.init();

console.log('🐕 [DATADOG] Tracer initialized successfully');

export default tracerInstance;
