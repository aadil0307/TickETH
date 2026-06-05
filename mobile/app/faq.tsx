import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../src/constants/theme';
import { Header } from '../src/components/ui/Header';
import { analytics } from '../src/services/analytics';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const FAQ_DATA: FAQItem[] = [
  {
    category: 'General',
    question: 'What is TickETH?',
    answer:
      'TickETH is a blockchain-based event ticketing platform built on Polygon. Each ticket is a verifiable NFT, ensuring authenticity and preventing fraud.',
  },
  {
    category: 'General',
    question: 'How do I create an account?',
    answer:
      'Connect your wallet (MetaMask, Coinbase Wallet, or use our in-app wallet with email/Google/Apple) on the sign-in screen. Your wallet address becomes your identity.',
  },
  {
    category: 'Tickets',
    question: 'How do I buy a ticket?',
    answer:
      'Browse events on the Discover tab, select an event, choose a ticket tier, and tap "Mint NFT Ticket." You\'ll need to sign a transaction with your wallet. The ticket is minted as an ERC-721 NFT on Polygon.',
  },
  {
    category: 'Tickets',
    question: 'How do I view my tickets?',
    answer:
      'Go to the "Tickets" tab in the bottom navigation. You\'ll see all your tickets with their status (Active, Used, Listed, Sent).',
  },
  {
    category: 'Tickets',
    question: 'Can I transfer my ticket?',
    answer:
      'Yes! Open your ticket details and tap "Transfer Ticket." Enter the recipient\'s wallet address. The NFT will be transferred on-chain.',
  },
  {
    category: 'Check-in',
    question: 'How does check-in work?',
    answer:
      'Open your ticket to see your dynamic QR code. A volunteer scans it, then you confirm the check-in by signing with your wallet. This two-step process ensures only the ticket owner can enter.',
  },
  {
    category: 'Check-in',
    question: 'What if I\'m offline during check-in?',
    answer:
      'Volunteers can verify tickets offline using cached ownership data. Scans performed offline will sync when connectivity is restored.',
  },
  {
    category: 'Marketplace',
    question: 'How do I resell a ticket?',
    answer:
      'Go to the Marketplace tab, tap the "+" button, select the ticket to list, set your price (subject to the organizer\'s price cap), and confirm. The listing will appear in the marketplace.',
  },
  {
    category: 'Marketplace',
    question: 'Are there fees for reselling?',
    answer:
      'The organizer may set a maximum resale price and a royalty percentage. These are enforced on-chain, so both buyer and seller are protected.',
  },
  {
    category: 'Wallet',
    question: 'Is my wallet secure?',
    answer:
      'TickETH uses thirdweb\'s secure wallet infrastructure. Your private keys are never stored on our servers. Sign-In with Ethereum (SIWE) ensures only you can access your account.',
  },
  {
    category: 'Wallet',
    question: 'Which blockchain does TickETH use?',
    answer:
      'TickETH operates on the Polygon network (Amoy testnet during beta). Polygon offers fast and low-cost transactions.',
  },
];

const CATEGORIES = Array.from(new Set(FAQ_DATA.map((f) => f.category)));

export default function FAQScreen() {
  const [selectedCategory, setSelectedCategory] = useState<string>('General');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  useEffect(() => {
    analytics.screenView('faq');
  }, []);

  const toggleExpanded = useCallback((index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedIndex((prev) => (prev === index ? null : index));
  }, []);

  const filtered = FAQ_DATA.filter((f) => f.category === selectedCategory);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="FAQ" leftIcon="arrow-back" onLeftPress={() => router.back()} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Category pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryPill, selectedCategory === cat && styles.categoryPillActive]}
              onPress={() => {
                setSelectedCategory(cat);
                setExpandedIndex(null);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Category: ${cat}`}
            >
              <Text style={[styles.categoryText, selectedCategory === cat && styles.categoryTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* FAQ items */}
        <View style={styles.faqList}>
          {filtered.map((item, index) => {
            const isExpanded = expandedIndex === index;
            return (
              <TouchableOpacity
                key={index}
                style={[styles.faqItem, isExpanded && styles.faqItemExpanded]}
                onPress={() => toggleExpanded(index)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={item.question}
                accessibilityState={{ expanded: isExpanded }}
              >
                <View style={styles.faqHeader}>
                  <Text style={[styles.faqQuestion, isExpanded && styles.faqQuestionActive]}>
                    {item.question}
                  </Text>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={isExpanded ? Colors.primary : Colors.textMuted}
                  />
                </View>
                {isExpanded && (
                  <Text style={styles.faqAnswer}>{item.answer}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
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
  categoryRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  categoryPill: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  categoryPillActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.borderActive,
  },
  categoryText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
  },
  categoryTextActive: {
    color: Colors.primary,
  },
  faqList: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  faqItem: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  faqItemExpanded: {
    borderColor: Colors.borderActive,
    backgroundColor: Colors.surfaceLight,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.md,
  },
  faqQuestion: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semibold,
    lineHeight: 22,
  },
  faqQuestionActive: {
    color: Colors.primary,
  },
  faqAnswer: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    lineHeight: 20,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
