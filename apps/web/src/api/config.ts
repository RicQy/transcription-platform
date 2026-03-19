export const getApiBaseUrl = () => {
  // Use VITE_API_URL if defined, otherwise fallback to local proxy path
  return (import.meta.env.VITE_API_URL as string) || '/api';
};

export const getApiUrl = (path: string) => {
  const baseUrl = getApiBaseUrl();
  // Ensure we don't end up with double slashes if baseURL is just a path
  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  // If it's a full URL, use it directly
  if (baseUrl.startsWith('http')) {
    return `${cleanBase}${cleanPath}`;
  }
  
  // Otherwise, fallback to the proxy path (usually /api/...)
  // If the user didn't provide VITE_API_URL, we use what was there before
  return `${cleanBase}${cleanPath}`;
};
