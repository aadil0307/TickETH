'use client';

import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

export default function PrivacyPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <div className="mb-12">
            <span className="text-xs font-bold text-primary uppercase tracking-[0.3em] mb-3 block">Legal</span>
            <h1 className="text-3xl font-extrabold sm:text-4xl">Privacy Policy</h1>
            <p className="mt-3 text-sm text-muted">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>

          <div className="space-y-8 text-sm text-muted leading-relaxed">
            <Section title="1. Introduction">
              TickETH (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our blockchain-based event ticketing platform.
            </Section>

            <Section title="2. Information We Collect">
              <strong className="text-foreground">Wallet Data:</strong> Your public wallet address is collected when you connect your wallet. This is inherently public on the blockchain.
              <br /><br />
              <strong className="text-foreground">Profile Information:</strong> Optional data you provide such as display name, email address, and avatar.
              <br /><br />
              <strong className="text-foreground">Transaction Data:</strong> Records of ticket purchases, transfers, and marketplace activity — all publicly verifiable on-chain.
              <br /><br />
              <strong className="text-foreground">Usage Data:</strong> Anonymous analytics about how you interact with the platform to improve our services.
            </Section>

            <Section title="3. How We Use Your Information">
              We use collected information to: authenticate your identity via SIWE (Sign-In With Ethereum); process ticket minting, transfers, and marketplace transactions; provide customer support; send event-related notifications (with your consent); improve platform functionality and user experience; and comply with legal obligations.
            </Section>

            <Section title="4. Blockchain Data">
              By using TickETH, you acknowledge that certain data is permanently recorded on the Polygon blockchain, including wallet addresses, NFT ownership, and transaction history. This data is publicly accessible and cannot be deleted or modified due to the immutable nature of blockchain technology.
            </Section>

            <Section title="5. Data Storage & Security">
              Off-chain data (profiles, support tickets) is stored securely in our database with row-level security policies. Authentication tokens are managed via secure, signed JWTs. We do not store private keys or seed phrases — wallet security is your responsibility. We implement industry-standard security measures including HTTPS, rate limiting, and input sanitization.
            </Section>

            <Section title="6. Data Sharing">
              We do not sell your personal information. We may share data with: event organizers (limited to information necessary for event management); blockchain networks (transaction data as part of normal operation); and law enforcement (when required by law or to protect rights and safety).
            </Section>

            <Section title="7. Your Rights">
              You have the right to: access the personal data we hold about you; request correction of inaccurate data; request deletion of your off-chain data (on-chain data cannot be deleted); withdraw consent for optional data processing; and export your data in a portable format. To exercise these rights, contact us through our support channels.
            </Section>

            <Section title="8. Cookies & Tracking">
              TickETH uses minimal cookies for essential functionality (authentication tokens). We do not use third-party advertising trackers. Anonymous analytics may be collected to improve the platform.
            </Section>

            <Section title="9. Third-Party Services">
              We integrate with third-party services including: Thirdweb (wallet connection infrastructure); Polygon (blockchain network); and IPFS (decentralized metadata storage). Each service has its own privacy policy that governs its data handling practices.
            </Section>

            <Section title="10. Children&apos;s Privacy">
              TickETH is not intended for users under 18 years of age. We do not knowingly collect personal information from minors. If we discover that a minor has provided personal information, we will delete it promptly.
            </Section>

            <Section title="11. Changes to This Policy">
              We may update this Privacy Policy periodically. We will notify you of significant changes through the platform. Continued use after changes constitutes acceptance.
            </Section>

            <Section title="12. Contact Us">
              For privacy-related inquiries, please use our <a href="/admin/support" className="text-primary hover:underline">Support</a> page or contact us through our GitHub repository.
            </Section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/20 bg-surface/30 p-6">
      <h2 className="text-base font-bold text-foreground mb-3">{title}</h2>
      <div>{children}</div>
    </div>
  );
}
