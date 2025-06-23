import axios, { AxiosError, AxiosRequestConfig } from 'axios';

// server api URL
const API_URL = process.env.REACT_APP_API_URL || 'https://qa-genie-api.onrender.com/api';

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Enable CORS for all requests
  withCredentials: true,
  // Increase timeout for production environments
  timeout: 30000, // 30 seconds
});

// Add response interceptor for debugging
apiClient.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.config.url, response.status, response.data);
    return response;
  },
  async (error: AxiosError) => {
    // Enhanced error handling with retries for network errors
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
    
    // Log detailed error information
    console.error('API Error:', {
      url: originalRequest?.url,
      method: originalRequest?.method,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      error: error.message,
      // If it's a CORS error, it won't have response data
      isCors: error.message.includes('Network Error') || error.message.includes('CORS'),
    });

    // Handle CORS errors specifically
    if (error.message.includes('Network Error') && !originalRequest?._retry) {
      console.warn('Possible CORS or network error. Retrying with OPTIONS preflight.');
      
      // Mark as retried to prevent infinite loops
      originalRequest._retry = true;
      
      try {
        // Try to make a preflight request first
        await axios({
          method: 'OPTIONS',
          url: `${API_URL}${originalRequest.url}`,
          headers: {
            'Access-Control-Request-Method': originalRequest.method || 'GET',
            'Access-Control-Request-Headers': 'Content-Type, Authorization',
            'Origin': window.location.origin,
          }
        });
        
        // If preflight succeeds, retry the original request
        return apiClient(originalRequest);
      } catch (preflightError) {
        console.error('Preflight request failed:', preflightError);
      }
    }
    
    return Promise.reject(error);
  }
);

// Add authentication interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      // Fix TypeScript error by using type assertion 
      config.headers = config.headers || {};
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Add origin header to help with CORS
    config.headers = config.headers || {};
    config.headers['Origin'] = window.location.origin;
    
    console.log('API Request:', config.url, config.method, config.data);
    return config;
  },
  (error) => Promise.reject(error)
);

// Authentication API - Include the full path to ensure it works with both server configurations
export const authAPI = {
  login: (email: string, password: string) => 
    apiClient.post('/auth/login', { email, password }),
  register: (name: string, email: string, password: string) => 
    apiClient.post('/auth/register', { name, email, password }),
  getCurrentUser: () => 
    apiClient.get('/auth/me'),
};

// PRD API
export const prdAPI = {
  uploadPRD: (formData: FormData) => 
    apiClient.post('/prd', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
  getAllPRDs: () => 
    apiClient.get('/prd'),
  getPRD: (id: string) => 
    apiClient.get(`/prd/${id}`),
};

// Test Case API
export const testCaseAPI = {
  generateTestCases: (prdId: string) => 
    apiClient.post(`/prd/${prdId}/generate-test-cases`),
  getAllTestCases: () => 
    apiClient.get('/testcases'),
  getTestCasesByPRD: (prdId: string) => 
    apiClient.get(`/testcases/prd/${prdId}`),
  getTestCase: (id: string) => 
    apiClient.get(`/testcases/${id}`),
  updateTestCase: (id: string, data: any) => 
    apiClient.put(`/testcases/${id}`, data),
};

// Feature File API
export const featureFileAPI = {
  generateFeatureFile: (testCaseIds: string[]) => 
    apiClient.post('/cucumber/generate', { testCaseIds }),
};

// CI API
export const ciAPI = {
  configureCICredentials: (ciToken: string, ciInstance: string, ciProvider: string) => 
    apiClient.post('/ci/configure', { ciToken, ciInstance, ciProvider }),
  triggerBuild: (repository: string, branch: string) => 
    apiClient.post('/ci/build', { repository, branch }),
  getBuilds: (repository: string) => 
    apiClient.get(`/ci/build?repository=${repository}`),
  getBuild: (buildNumber: string, repository: string) => 
    apiClient.get(`/ci/build/${buildNumber}?repository=${repository}`),
};

export default apiClient; 