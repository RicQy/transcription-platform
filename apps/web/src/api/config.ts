export const getApiBaseUrl = () => {
  return (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:3002';
};

export const getApiUrl = (path: string) => {
  const baseUrl = getApiBaseUrl();
  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  return `${cleanBase}${cleanPath}`;
};
