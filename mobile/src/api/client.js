import Constants from 'expo-constants';

// Automatically detect host computer IP address when running in Expo Go on physical mobile device
const getBaseUrl = () => {
  try {
    const hostUri =
      Constants.expoConfig?.hostUri ||
      Constants.hostUri ||
      Constants.manifest?.debuggerHost ||
      Constants.manifest2?.extra?.expoGo?.developer?.tool;
    if (hostUri) {
      const ip = hostUri.split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1' && ip !== '::1') {
        return `http://${ip}:5000/api`;
      }
    }
  } catch (e) {}
  return 'http://localhost:5000/api';
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
      `Unable to connect to backend server at ${API_BASE_URL}. Please ensure your Express backend is running on port 5000.`
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
