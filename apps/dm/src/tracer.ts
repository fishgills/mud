import tracer from 'dd-trace';
tracer.init({
  service: 'dm',
  env: process.env.NODE_ENV || 'development',
  logInjection: false,
  dbmPropagationMode: 'full',
});
export default tracer;
