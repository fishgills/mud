module.exports = (request, options) => {
  const defaultResolver = options.defaultResolver;
  try {
    return defaultResolver(request, options);
  } catch (error) {
    if (request.endsWith('.js')) {
      const tsRequest = request.replace(/\.js$/, '.ts');
      try {
        return defaultResolver(tsRequest, options);
      } catch (innerError) {
        if (innerError.code === 'MODULE_NOT_FOUND') {
          throw error;
        }
        throw innerError;
      }
    }
    throw error;
  }
};
