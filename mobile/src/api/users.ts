import { apiClient } from './client';
import { Platform } from 'react-native';

/** Send the Expo push token to backend for this user */
export async function setPushToken(pushToken: string): Promise<void> {
  await apiClient.post('/users/push-token', { pushToken });
}

/** Update the current user's profile (display name, email, avatar) */
export async function updateProfile(body: {
  displayName?: string;
  email?: string;
  avatarUrl?: string;
  consentGiven?: boolean;
}): Promise<void> {
  await apiClient.patch('/users/me', body);
}

/** Upload an avatar image and return the public URL */
export async function uploadAvatar(uri: string): Promise<string> {
  const form = new FormData();

  // Extract filename and determine mime type
  const filename = uri.split('/').pop() || 'avatar.jpg';
  const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
  };
  const type = mimeMap[ext] || 'image/jpeg';

  // React Native FormData expects { uri, name, type } for file uploads
  form.append('file', {
    uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
    name: filename,
    type,
  } as unknown as Blob);

  const res = await apiClient.post<{ url: string; message: string }>(
    '/uploads/avatar',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );

  return res.data.url;
}
