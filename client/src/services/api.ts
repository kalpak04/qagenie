import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add response interceptor for debugging
apiClient.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.config.url, response.status, response.data);
    return response;
  },
  (error) => {
    console.error('API Error:', error.config?.url, error.response?.status, error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Add authentication interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log('API Request:', config.url, config.method, config.data);
    return config;
  },
  (error) => Promise.reject(error)
);

// Authentication API
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