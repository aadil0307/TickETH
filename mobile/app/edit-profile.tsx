import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Typography, Spacing, BorderRadius } from '../src/constants/theme';
import { Button } from '../src/components/ui/Button';
import { useAuth } from '../src/providers/AuthProvider';
import { useAuthStore } from '../src/stores/authStore';
import { updateProfile, uploadAvatar } from '../src/api/users';
import { showToast } from '../src/services/toast';
import { analytics } from '../src/services/analytics';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EditProfileScreen() {
  const { user } = useAuth();
  const refreshUser = useAuthStore((s) => s.refreshUser);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    analytics.screenView('edit_profile');
  }, []);

  // Pre-populate from current user
  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || '');
      setEmail(user.email || '');
      setAvatarUrl(user.avatar_url || '');
    }
  }, [user]);

  const validate = useCallback(() => {
    const errs: Record<string, string> = {};

    if (!email.trim()) {
      errs.email = 'Email required — needed for ticket copies';
    } else if (!EMAIL_RE.test(email.trim())) {
      errs.email = 'Enter a valid email address';
    }

    if (displayName.trim() && displayName.trim().length < 2) {
      errs.displayName = 'At least 2 characters';
    }
    if (displayName.trim().length > 50) {
      errs.displayName = '50 characters max';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [email, displayName]);

  const pickImage = async (source: 'camera' | 'gallery') => {
    try {
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          showToast({ type: 'error', title: 'Permission needed', message: 'Allow camera access to take a photo' });
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          showToast({ type: 'error', title: 'Permission needed', message: 'Allow photo access to upload an avatar' });
          return;
        }
      }

      const launchFn = source === 'camera'
        ? ImagePicker.launchCameraAsync
        : ImagePicker.launchImageLibraryAsync;

      const result = await launchFn({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) return;

      setUploadingAvatar(true);
      setAvatarError(false);
      const localUri = result.assets[0].uri;
      setAvatarUrl(localUri);

      const publicUrl = await uploadAvatar(localUri);
      setAvatarUrl(publicUrl);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast({ type: 'success', title: 'Avatar uploaded!' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      showToast({ type: 'error', title: 'Upload failed', message: msg });
      setAvatarUrl(user?.avatar_url || '');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const showAvatarOptions = () => {
    Alert.alert('Change Avatar', 'Choose a source', [
      { text: 'Take Photo', onPress: () => pickImage('camera') },
      { text: 'Choose from Gallery', onPress: () => pickImage('gallery') },
      ...(avatarUrl.trim() ? [{ text: 'Remove Avatar', style: 'destructive' as const, onPress: () => { setAvatarUrl(''); setAvatarError(false); } }] : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const handleSave = async () => {
    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim() || undefined,
        email: email.trim(),
        avatarUrl: avatarUrl.trim() || undefined,
        consentGiven: true,
      });
      await refreshUser();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      analytics.track('profile_updated', {});
      showToast({ type: 'success', title: 'Profile saved!' });
      router.back();
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      const message =
        err instanceof Error ? err.message : 'Could not save profile. Try again.';
      showToast({ type: 'error', title: 'Save failed', message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar preview + upload */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              onPress={showAvatarOptions}
              disabled={uploadingAvatar || saving}
              accessibilityLabel="Change avatar"
              accessibilityRole="button"
              activeOpacity={0.7}
            >
              <View style={styles.avatarWrapper}>
                {avatarUrl.trim() && !avatarError ? (
                  <Image
                    source={{ uri: avatarUrl.trim() }}
                    style={styles.avatarImage}
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <View
                    style={[
                      styles.avatarPlaceholder,
                      {
                        backgroundColor: user?.wallet_address
                          ? `#${user.wallet_address.slice(2, 8)}`
                          : Colors.primary,
                      },
                    ]}
                  >
                    <Text style={styles.avatarInitial}>
                      {user?.wallet_address
                        ? user.wallet_address.slice(2, 4).toUpperCase()
                        : '?'}
                    </Text>
                  </View>
                )}
                {/* Camera badge overlay */}
                <View style={styles.cameraBadge}>
                  {uploadingAvatar ? (
                    <ActivityIndicator size="small" color={Colors.textPrimary} />
                  ) : (
                    <Ionicons name="camera" size={16} color={Colors.textPrimary} />
                  )}
                </View>
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarHint}>
              {uploadingAvatar ? 'Uploading...' : 'Tap to take photo or choose from gallery'}
            </Text>
          </View>

          {/* Display Name */}
          <View style={styles.field}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={[styles.input, errors.displayName ? styles.inputError : null]}
              value={displayName}
              onChangeText={(t) => {
                setDisplayName(t);
                setErrors((p) => ({ ...p, displayName: '' }));
              }}
              placeholder="How should we call you?"
              placeholderTextColor={Colors.textMuted}
              maxLength={50}
              autoCapitalize="words"
              returnKeyType="next"
              accessibilityLabel="Display name"
            />
            <View style={styles.fieldFooter}>
              {errors.displayName ? (
                <Text style={styles.errorText}>{errors.displayName}</Text>
              ) : (
                <Text style={styles.helperText}>
                  Appears on tickets &amp; listings
                </Text>
              )}
              <Text style={styles.counter}>{displayName.length}/50</Text>
            </View>
          </View>

          {/* Email */}
          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Email Address</Text>
              <Text style={styles.required}>Required</Text>
            </View>
            <TextInput
              style={[styles.input, errors.email ? styles.inputError : null]}
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setErrors((p) => ({ ...p, email: '' }));
              }}
              placeholder="your@email.com"
              placeholderTextColor={Colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              accessibilityLabel="Email address"
            />
            {errors.email ? (
              <Text style={styles.errorText}>{errors.email}</Text>
            ) : (
              <Text style={styles.helperText}>
                Ticket copies &amp; event updates are sent here
              </Text>
            )}
          </View>

          {/* Consent notice */}
          <View style={styles.consent}>
            <Ionicons
              name="shield-checkmark-outline"
              size={16}
              color={Colors.textMuted}
            />
            <Text style={styles.consentText}>
              By saving, you consent to TickETH storing your email and display
              name for ticket delivery and event notifications.
            </Text>
          </View>

          {/* Save button */}
          <View style={styles.actions}>
            <Button
              title={saving ? 'Saving…' : 'Save Profile'}
              onPress={handleSave}
              variant="primary"
              fullWidth
              size="lg"
              disabled={saving}
              icon={
                !saving ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={Colors.textPrimary}
                  />
                ) : undefined
              }
            />
            <Button
              title="Cancel"
              onPress={() => router.back()}
              variant="outline"
              fullWidth
              size="lg"
              disabled={saving}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  headerTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  headerRight: {
    width: 40,
  },
  scroll: {
    padding: Spacing.xl,
    paddingBottom: Spacing['3xl'],
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: Colors.glassBorder,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.glassBorder,
  },
  avatarInitial: {
    fontSize: 34,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  avatarHint: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
  },
  field: {
    marginBottom: Spacing.lg,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  label: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  required: {
    fontSize: Typography.sizes.xs,
    color: Colors.error,
    fontWeight: Typography.weights.bold,
  },
  optional: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: Typography.sizes.md,
    color: Colors.textPrimary,
  },
  inputError: {
    borderColor: Colors.error,
  },
  fieldFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  helperText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 4,
  },
  errorText: {
    fontSize: Typography.sizes.xs,
    color: Colors.error,
    marginTop: 4,
  },
  counter: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  consent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.glass,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  consentText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 18,
  },
  actions: {
    gap: Spacing.sm,
  },
});
