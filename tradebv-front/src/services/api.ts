// Base API configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export interface ApiError {
  message: string;
  status: number;
  details?: any;
}

type LogoutCallback = () => void;

class ApiClient {
  private baseURL: string;
  private onUnauthorized?: LogoutCallback;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    if (!baseURL) {
      console.warn('⚠️ ApiClient: baseURL is empty or undefined');
    } else {
      console.log('✅ ApiClient initialized with baseURL:', baseURL);
    }
  }

  setUnauthorizedCallback(callback: LogoutCallback) {
    this.onUnauthorized = callback;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = localStorage.getItem('auth_token');

    const headers: HeadersInit = {
      ...options.headers,
      'ngrok-skip-browser-warning': 'true',
    };

    // Only set Content-Type to JSON if body is not FormData
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      // If endpoint is a full URL (starts with http:// or https://), use it directly
      // Otherwise, prepend baseURL
      const fullUrl = endpoint.startsWith('http://') || endpoint.startsWith('https://')
        ? endpoint
        : `${this.baseURL}${endpoint}`;
      console.log(`🌐 API Request: ${options.method || 'GET'} ${fullUrl}`);
      const response = await fetch(fullUrl, config);

      if (!response.ok) {
        const error: ApiError = {
          message: `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
        };

        try {
          const errorData = await response.json();
          error.details = errorData;

          // Handle FastAPI validation errors (422)
          if (response.status === 422 && Array.isArray(errorData.detail)) {
            // Format validation errors as readable string
            const validationErrors = errorData.detail
              .map((err: any) => `${err.loc.join('.')}: ${err.msg}`)
              .join(', ');
            error.message = `Validation error: ${validationErrors}`;
          } else {
            error.message = errorData.message || errorData.detail || error.message;
          }
        } catch {
          // Ignore JSON parse errors
        }

        // Handle unauthorized/expired token
        if (response.status === 401 && this.onUnauthorized) {
          this.onUnauthorized();
        }

        throw error;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if ((error as ApiError).status) {
        throw error;
      }
      throw {
        message: 'Network error or server unavailable',
        status: 0,
        details: error,
      } as ApiError;
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  /** Fetch an authenticated file response without trying to parse JSON. */
  async getBlob(endpoint: string): Promise<Blob> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {
      'ngrok-skip-browser-warning': 'true',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const fullUrl = endpoint.startsWith('http://') || endpoint.startsWith('https://')
      ? endpoint
      : `${this.baseURL}${endpoint}`;
    const response = await fetch(fullUrl, { method: 'GET', headers });

    if (!response.ok) {
      const error: ApiError = {
        message: `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
      };
      try {
        const errorData = await response.json();
        error.details = errorData;
        error.message = errorData.message || errorData.detail || error.message;
      } catch {
        // Keep the HTTP status message when the server returned a non-JSON body.
      }
      if (response.status === 401 && this.onUnauthorized) {
        this.onUnauthorized();
      }
      throw error;
    }

    return response.blob();
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data instanceof FormData ? data : (data ? JSON.stringify(data) : undefined),
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data instanceof FormData ? data : (data ? JSON.stringify(data) : undefined),
    });
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
