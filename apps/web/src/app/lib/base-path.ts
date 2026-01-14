export const resolveBasePath = () => {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  if (basePath && basePath !== '/') {
    return basePath;
  }
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    if (pathname.startsWith('/www')) {
      return '/www';
    }
  }
  return '';
};

export const withBasePath = (path: string) => {
  const resolved = resolveBasePath();
  return resolved ? `${resolved}${path}` : path;
};
