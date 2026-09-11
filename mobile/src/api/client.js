import Constants from 'expo-constants';

const PROD_API_URL = 'https://neuroscreen-backend.onrender.com/api';

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  // Default to live production backend hosted on Render
  return PROD_API_URL;
};

const API_BASE_URL = getBaseUrl();
console.log('[NEUROSCREEN API Client] Target Base URL:', API_BASE_URL);

let authToken = null;

export const setAuthToken = (token) => {
  authToken = token;
};

const performRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(options.headers || {}),
  };

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (fetchErr) {
    const errorObj = new Error(
      `Unable to connect to backend server at ${API_BASE_URL}. Please check your internet connection.`
    );
    errorObj.isNetworkError = true;
    throw errorObj;
  }

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorObj = new Error(json.error?.message || `HTTP Error ${response.status}`);
    errorObj.response = { data: json, status: response.status };
    throw errorObj;
  }
  return { data: json };
};

const apiClient = {
  get: (url, config = {}) => {
    let queryString = '';
    if (config.params) {
      const activeParams = Object.fromEntries(
        Object.entries(config.params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
      );
      const searchParams = new URLSearchParams(activeParams).toString();
      if (searchParams) queryString = `?${searchParams}`;
    }
    return performRequest(`${url}${queryString}`, { method: 'GET' });
  },

  post: (url, body, config = {}) => {
    const isFormData = body instanceof FormData;
    const headers = isFormData ? {} : { 'Content-Type': 'application/json' };
    return performRequest(url, {
      method: 'POST',
      headers: { ...headers, ...(config.headers || {}) },
      body: isFormData ? body : JSON.stringify(body || {}),
    });
  },
};

export default apiClient;
