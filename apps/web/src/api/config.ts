export const getApiBaseUrl = () => {
  return (import.meta.env.VITE_INSFORGE_URL as string) || '';
};

export const getApiUrl = (path: string) => {
  const baseUrl = getApiBaseUrl();
  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  return `${cleanBase}${cleanPath}`;
};
