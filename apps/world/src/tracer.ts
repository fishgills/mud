import tracer from 'dd-trace';

// Initialize Datadog tracer with proper configuration for Cloud Run
tracer.init({
  // Let environment variables configure most settings (DD_SERVICE, DD_ENV, DD_VERSION, etc.)
  // but explicitly enable features needed for serverless APM
  runtimeMetrics: true,
  profiling: true,
  logInjection: true,
});

export default tracer;
