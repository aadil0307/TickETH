import { apiClient, setTokens } from './client';
import type { NonceResponse, VerifyResponse, User } from '../types';

/** Get a SIWE nonce for the given wallet address */
export async function getNonce(address: string): Promise<NonceResponse> {
  const { data } = await apiClient.get<NonceResponse>('/auth/nonce', {
    params: { address },
  });
  return data;
}

/** Verify a SIWE signature and receive JWT tokens */
export async function verify(message: string, signature: string): Promise<VerifyResponse> {
  const { data } = await apiClient.post<VerifyResponse>('/auth/verify', {
    message,
    signature,
  });
  // Persist tokens immediately
  await setTokens(data.accessToken, data.refreshToken);
  return data;
}

/** Refresh the JWT access token */
export async function refreshToken(): Promise<{ accessToken: string; refreshToken: string }> {
  const { data } = await apiClient.post('/auth/refresh');
  await setTokens(data.accessToken, data.refreshToken);
  return data;
}

/** Get the current authenticated user */
export async function getMe(): Promise<User> {
  const { data } = await apiClient.get<User>('/auth/me');
  return data;
}
