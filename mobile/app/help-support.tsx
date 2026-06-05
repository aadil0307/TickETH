import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../src/constants/theme';
import { Button } from '../src/components/ui/Button';
import { Header } from '../src/components/ui/Header';
import { useAuth } from '../src/providers/AuthProvider';
import { showToast } from '../src/services/toast';
import { analytics } from '../src/services/analytics';

const ISSUE_CATEGORIES = [
  'Ticket Purchase',
  'Check-in Problem',
  'Marketplace',
  'Wallet & Account',
  'Other',
] as const;

export default function HelpSupportScreen() {
  const { user } = useAuth();
  const [category, setCategory] = useState<string>(ISSUE_CATEGORIES[0]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    analytics.screenView('help_support');
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert('Missing Info', 'Please fill in both subject and message.');
      return;
    }

    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    try {
      // TODO: POST to backend /api/v1/support when endpoint is ready
      // For now, simulate a submission
      await new Promise((r) => setTimeout(r, 1200));
      showToast({ type: 'success', title: 'Request Submitted', message: 'We\'ll get back to you soon.' });
      analytics.track('screen_view', { screen: 'support_submitted', category });
      router.back();
    } catch {
      showToast({ type: 'error', title: 'Submission Failed', message: 'Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }, [subject, message, category]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Help & Support" leftIcon="arrow-back" onLeftPress={() => router.back()} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Quick links */}
          <View style={styles.quickLinks}>
            <Text style={styles.sectionTitle}>Quick Links</Text>
            <View style={styles.linkRow}>
              <LinkCard
                icon="help-circle-outline"
                label="FAQ"
                onPress={() => router.push('/faq')}
              />
              <LinkCard
                icon="document-text-outline"
                label="Terms"
                onPress={() => router.push('/terms')}
              />
            </View>
          </View>

          {/* Submit a request */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Submit a Request</Text>
            <Text style={styles.sectionSubtitle}>
              Having an issue? Fill out the form below and our team will get back to you within 24
              hours.
            </Text>

            {/* Category */}
            <Text style={styles.label}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryRow}
            >
              {ISSUE_CATEGORIES.map((cat) => (
                <Button
                  key={cat}
                  title={cat}
                  variant={category === cat ? 'primary' : 'outline'}
                  size="sm"
                  onPress={() => setCategory(cat)}
                />
              ))}
            </ScrollView>

            {/* Subject */}
            <Text style={styles.label}>Subject</Text>
            <TextInput
              style={styles.input}
              placeholder="Brief summary of your issue"
              placeholderTextColor={Colors.textMuted}
              value={subject}
              onChangeText={setSubject}
              maxLength={120}
              autoCapitalize="sentences"
            />

            {/* Message */}
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe your issue in detail..."
              placeholderTextColor={Colors.textMuted}
              value={message}
              onChangeText={setMessage}
              maxLength={2000}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              autoCapitalize="sentences"
            />

            <Button
              title={submitting ? 'Submitting...' : 'Submit Request'}
              variant="primary"
              onPress={handleSubmit}
              disabled={submitting || !subject.trim() || !message.trim()}
              style={styles.submitButton}
            />
          </View>

          {/* Contact info */}
          <View style={styles.contactSection}>
            <Ionicons name="mail-outline" size={20} color={Colors.textMuted} />
            <Text style={styles.contactText}>support@ticketh.io</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function LinkCard({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Button
      title={label}
      variant="outline"
      onPress={onPress}
      icon={<Ionicons name={icon} size={18} color={Colors.primary} />}
      style={styles.linkCard}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: Spacing['6xl'],
  },
  quickLinks: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    marginBottom: Spacing.sm,
  },
  sectionSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  linkRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  linkCard: {
    flex: 1,
  },
  formSection: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing['2xl'],
  },
  label: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  categoryRow: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    minHeight: 120,
    paddingTop: Spacing.md,
  },
  submitButton: {
    marginTop: Spacing['2xl'],
  },
  contactSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing['3xl'],
  },
  contactText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
  },
});
