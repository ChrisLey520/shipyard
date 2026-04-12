import axios, { type AxiosInstance, type InternalAxiosRequestConfig, isAxiosError } from 'axios';
import { isShipyardAuthPublicApiPath } from '@shipyard/shared';
import { useAuthStore } from '../stores/auth';
import {
  applyShipyardAxiosError,
  applyShipyardNetworkError,
  applyShipyardSessionExpiredRedirect,
  type ShipyardAxiosMeta,
} from '../common/http-error-ui';

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** Shipyard 统一错误呈现与鉴权刷新策略 */
    shipyard?: ShipyardAxiosMeta;
  }
  export interface InternalAxiosRequestConfig {
    _retry?: boolean;
  }
}

export const http: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

function shouldSkipAuthRefresh(config: InternalAxiosRequestConfig | undefined): boolean {
  if (!config) return true;
  if (config.shipyard?.skipAuthRefresh) return true;
  const url = config.url ?? '';
  return isShipyardAuthPublicApiPath(url);
}

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

http.interceptors.response.use(
  (res) => res,
  async (error: unknown) => {
    const axiosError = isAxiosError(error) ? error : null;
    const cfg = axiosError?.config;
    const status = axiosError?.response?.status;

    if (axiosError && status === 401 && cfg && !cfg._retry && !shouldSkipAuthRefresh(cfg)) {
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

        applyShipyardSessionExpiredRedirect();
      } finally {
        isRefreshing = false;
      }

      return Promise.reject(error);
    }

    if (axiosError) {
      if (axiosError.response) {
        applyShipyardAxiosError(axiosError);
      } else {
        applyShipyardNetworkError();
      }
    }

    return Promise.reject(error);
  },
);
