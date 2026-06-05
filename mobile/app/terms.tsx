import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius } from '../src/constants/theme';
import { Header } from '../src/components/ui/Header';
import { analytics } from '../src/services/analytics';

const EFFECTIVE_DATE = 'June 15, 2025';

export default function TermsScreen() {
  useEffect(() => {
    analytics.screenView('terms_of_service');
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Terms of Service" leftIcon="arrow-back" onLeftPress={() => router.back()} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.effectiveDate}>Effective: {EFFECTIVE_DATE}</Text>

        <Section title="1. Acceptance of Terms">
          By accessing or using the TickETH application ("Service"), you agree to be bound by these
          Terms of Service. If you do not agree, do not use the Service.
        </Section>

        <Section title="2. Description of Service">
          TickETH is a blockchain-based event ticketing platform on the Polygon network. Tickets are
          minted as ERC-721 NFTs. The Service provides ticket purchase, transfer, resale, and
          check-in functionality.
        </Section>

        <Section title="3. Wallet & Authentication">
          You are responsible for maintaining the security of your wallet and private keys. TickETH
          does not store your private keys. Authentication is performed via Sign-In with Ethereum
          (SIWE). Loss of wallet access may result in loss of tickets.
        </Section>

        <Section title="4. Ticket Purchases">
          All ticket purchases are final. Tickets are minted on-chain and ownership is governed by
          the smart contract. Prices are denominated in the native currency of the blockchain network
          (e.g., MATIC / POL on Polygon).
        </Section>

        <Section title="5. Marketplace & Resale">
          Ticket resale is subject to price caps and royalty percentages set by event organizers.
          These rules are enforced on-chain and cannot be circumvented. TickETH does not guarantee
          the sale of listed tickets.
        </Section>

        <Section title="6. Check-in & Event Access">
          Check-in requires a valid ticket NFT and wallet-based identity verification. Check-in is a
          two-step process: QR code scan followed by wallet confirmation. A ticket can only be used
          for check-in once.
        </Section>

        <Section title="7. User Conduct">
          You agree not to: (a) use the Service for fraudulent purposes; (b) attempt to duplicate,
          counterfeit, or forge tickets; (c) interfere with the smart contracts or backend systems;
          (d) violate any applicable laws or regulations.
        </Section>

        <Section title="8. Data Protection & Privacy (DPDP)">
          We collect minimal personal data: wallet address, display name, and optional profile
          information. Data processing complies with the Digital Personal Data Protection Act, 2023.
          You may request deletion of your personal data at any time by contacting support.
        </Section>

        <Section title="9. Limitation of Liability">
          TickETH is provided "as is" without warranties. We are not liable for: blockchain network
          outages, gas fee fluctuations, wallet security breaches, or event cancellations by
          organizers.
        </Section>

        <Section title="10. Modifications">
          We reserve the right to modify these Terms at any time. Continued use of the Service after
          modifications constitutes acceptance of the updated Terms.
        </Section>

        <Section title="11. Contact">
          For questions or concerns regarding these Terms, contact us at support@ticketh.io.
        </Section>

        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2025 TickETH. All rights reserved.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['6xl'],
  },
  effectiveDate: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing['2xl'],
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    color: Colors.primary,
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    marginBottom: Spacing.sm,
  },
  sectionBody: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    lineHeight: 22,
  },
  footer: {
    alignItems: 'center',
    paddingTop: Spacing['3xl'],
    paddingBottom: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: Spacing.xl,
  },
  footerText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
  },
});
