import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/auth';

export const http: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// 请求拦截：自动附加 JWT
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

// 响应拦截：401 时尝试刷新 Token
let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

http.interceptors.response.use(
  (res) => res,
  async (error: unknown) => {
    const axiosError = error as { response?: { status: number }; config?: RetryableConfig };
    if (axiosError.response?.status === 401 && !axiosError.config?._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push((token) => {
            if (!token || !axiosError.config) {
              reject(error);
              return;
            }
            axiosError.config.headers.set('Authorization', `Bearer ${token}`);
            resolve(http(axiosError.config));
          });
        });
      }

      isRefreshing = true;
      if (axiosError.config) axiosError.config._retry = true;

      try {
        const authStore = useAuthStore();
        const newToken = await authStore.refreshAccessToken();
        refreshQueue.forEach((cb) => cb(newToken));
        refreshQueue = [];

        if (newToken && axiosError.config) {
          axiosError.config.headers.set('Authorization', `Bearer ${newToken}`);
          return http(axiosError.config);
        }
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);
