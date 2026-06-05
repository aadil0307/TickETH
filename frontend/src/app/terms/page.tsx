'use client';

import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

export default function TermsOfServicePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <div className="mb-12">
            <span className="text-xs font-bold text-primary uppercase tracking-[0.3em] mb-3 block">Legal</span>
            <h1 className="text-3xl font-extrabold sm:text-4xl">Terms of Service</h1>
            <p className="mt-3 text-sm text-muted">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>

          <div className="space-y-8 text-sm text-muted leading-relaxed">
            <Section title="1. Acceptance of Terms">
              By accessing or using the TickETH platform (&quot;Service&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.
              TickETH is a blockchain-based event ticketing platform deployed on the Polygon network.
            </Section>

            <Section title="2. Eligibility">
              You must be at least 18 years old or have parental/guardian consent to use TickETH. By using the Service, you represent that you meet these requirements and have the legal capacity to enter into this agreement.
            </Section>

            <Section title="3. Account & Wallet">
              Your account is linked to your blockchain wallet address. You are solely responsible for maintaining the security of your wallet, private keys, and recovery phrases. TickETH does not store or have access to your private keys. Loss of wallet access may result in permanent loss of your tickets and assets.
            </Section>

            <Section title="4. NFT Tickets">
              Tickets on TickETH are minted as ERC-721 NFTs on the Polygon blockchain. Purchasing a ticket grants you the right to attend the associated event, subject to the event organizer&apos;s terms. NFT tickets are non-refundable once minted unless the event organizer explicitly offers refunds. Ownership of an NFT ticket does not grant intellectual property rights to the event or its content.
            </Section>

            <Section title="5. Marketplace & Resale">
              TickETH provides a marketplace for ticket resale. Resale is subject to limits set by event organizers, including maximum price caps and transfer restrictions. TickETH is not responsible for disputes between buyers and sellers. All marketplace transactions are final once confirmed on-chain.
            </Section>

            <Section title="6. Event Organizers">
              Event organizers are responsible for the accuracy of event information, fulfillment of event promises, and compliance with local laws and regulations. TickETH is a platform provider and is not a co-organizer of events listed on the platform.
            </Section>

            <Section title="7. Prohibited Conduct">
              You agree not to: use the Service for any unlawful purpose; attempt to exploit smart contract vulnerabilities; create fraudulent events or tickets; harass other users; use automated systems to manipulate the platform; or circumvent security measures.
            </Section>

            <Section title="8. Blockchain Risks">
              You acknowledge that blockchain transactions are irreversible, gas fees are non-refundable, smart contracts may contain bugs despite auditing, and the value of digital assets can fluctuate. TickETH is not liable for losses resulting from blockchain network issues, wallet errors, or smart contract failures.
            </Section>

            <Section title="9. Limitation of Liability">
              TickETH is provided &quot;as is&quot; without warranties of any kind. To the maximum extent permitted by law, TickETH shall not be liable for indirect, incidental, special, or consequential damages arising from your use of the Service.
            </Section>

            <Section title="10. Privacy">
              Your use of TickETH is also governed by our <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>. Wallet addresses and on-chain transaction data are publicly visible on the blockchain.
            </Section>

            <Section title="11. Changes to Terms">
              We reserve the right to modify these Terms at any time. Material changes will be communicated through the platform. Continued use of the Service after changes constitutes acceptance of the updated Terms.
            </Section>

            <Section title="12. Contact">
              For questions about these Terms, please contact us through the <a href="/admin/support" className="text-primary hover:underline">Support</a> page or reach out via our GitHub repository.
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
      <p>{children}</p>
    </div>
  );
}
