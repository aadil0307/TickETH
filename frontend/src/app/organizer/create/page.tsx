'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/Button';
import { Input, Textarea } from '@/components/Input';
import { ImageUpload } from '@/components/ImageUpload';
import { eventsApi, tiersApi, blockchainApi } from '@/lib/api';
import { parseEther } from 'ethers';
import { useAuthStore } from '@/lib/store';
import { useRequireAuth } from '@/lib/hooks';
import { parseError } from '@/lib/error-parser';
import { toast } from 'sonner';

interface TierForm {
  name: string;
  description: string;
  price: string;
  maxSupply: string;
}

const emptyTier: TierForm = { name: '', description: '', price: '', maxSupply: '' };

export default function CreateEventPage() {
  useRequireAuth(['organizer', 'admin']);
  const router = useRouter();
  const { user } = useAuthStore();
  const isOrganizer = user?.role === 'organizer' || user?.role === 'admin';

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);

  // Event form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venue, setVenue] = useState('');
  const [city, setCity] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');

  // Tiers
  const [tiers, setTiers] = useState<TierForm[]>([{ ...emptyTier }]);

  const addTier = () => {
    if (tiers.length < 5) setTiers([...tiers, { ...emptyTier }]);
  };

  const removeTier = (index: number) => {
    if (tiers.length > 1) setTiers(tiers.filter((_, i) => i !== index));
  };

  const updateTier = (index: number, field: keyof TierForm, value: string) => {
    setTiers(tiers.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  };

  const handleCreateEvent = async () => {
    if (!title.trim()) { setError('Event title is required'); return; }
    if (!startTime) { setError('Start time is required'); return; }
    if (tiers.some((t) => !t.name || !t.price || !t.maxSupply)) {
      setError('All tier fields are required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Step 1: Create event
      const eventRes = await eventsApi.create({
        title: title.trim(),
        description: description.trim() || undefined,
        venue: venue.trim() || undefined,
        city: city.trim() || undefined,
        startTime: new Date(startTime).toISOString(),
        endTime: endTime ? new Date(endTime).toISOString() : undefined,
        bannerUrl: bannerUrl.trim() || undefined,
      });

      const eventId = eventRes.id;
      setCreatedEventId(eventId);

      // Step 2: Create tiers
      const tierPayloads = tiers.map((t, i) => ({
        tierIndex: i,
        name: t.name.trim(),
        description: t.description.trim() || undefined,
        price: parseFloat(t.price) || 0,
        priceWei: parseEther(t.price || '0').toString(),
        maxSupply: parseInt(t.maxSupply, 10),
      }));

      await tiersApi.batchCreate(eventId, tierPayloads);

      setStep(2);
    } catch (err) {
      const parsed = parseError(err);
      setError(parsed.message);
      toast.error(parsed.title, { description: parsed.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDeploy = async () => {
    if (!createdEventId) return;
    setDeploying(true);
    setError(null);

    try {
      await blockchainApi.deploy(createdEventId);
      setStep(3);
      toast.success('Contract deployment initiated!');
    } catch (err) {
      const parsed = parseError(err);
      setError(parsed.message);
      toast.error(parsed.title, { description: parsed.message });
    } finally {
      setDeploying(false);
    }
  };

  if (!isOrganizer) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Access Denied</h2>
            <p className="mt-2 text-muted">You need organizer role to create events.</p>
            <Button className="mt-6" onClick={() => router.push('/organizer')}>
              Request Access
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-10">
        <div className="mx-auto max-w-3xl">
          {/* Progress steps */}
          <div className="mb-10 flex items-center justify-center gap-2">
            {[
              { num: 1, label: 'Event Details' },
              { num: 2, label: 'Deploy Contract' },
              { num: 3, label: 'Complete' },
            ].map((s, i) => (
              <div key={s.num} className="flex items-center gap-2">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all ${
                    step >= s.num
                      ? 'bg-gradient-to-br from-primary to-accent text-white shadow-lg shadow-primary/25'
                      : 'bg-surface-light text-muted border border-border/30'
                  }`}
                >
                  {step > s.num ? '✓' : s.num}
                </div>
                <span className={`hidden sm:inline text-sm ${step >= s.num ? 'text-foreground' : 'text-muted'}`}>
                  {s.label}
                </span>
                {i < 2 && <div className={`w-12 h-0.5 ${step > s.num ? 'bg-primary' : 'bg-border'}`} />}
              </div>
            ))}
          </div>

          {/* Step 1: Event Details & Tiers */}
          {step === 1 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <div className="rounded-2xl border border-border/30 bg-surface/80 backdrop-blur-sm p-6 space-y-5">
                <h2 className="text-xl font-bold">
                  Event{' '}
                  <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Details</span>
                </h2>
                <Input label="Event Title *" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My Awesome Event" />
                <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell attendees about your event..." rows={4} />
                <ImageUpload
                  label="Banner Image"
                  folder="banner"
                  currentUrl={bannerUrl}
                  onUpload={(url) => setBannerUrl(url)}
                  hint="Upload the banner image for your event page"
                  shape="rect"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Venue" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Madison Square Garden" />
                  <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} placeholder="New York" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Start Time *" type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                  <Input label="End Time" type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>

              <div className="rounded-2xl border border-border/30 bg-surface/80 backdrop-blur-sm p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">
                    Ticket{' '}
                    <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Tiers</span>
                  </h2>
                  <Button variant="ghost" size="sm" onClick={addTier} disabled={tiers.length >= 5}>
                    + Add Tier
                  </Button>
                </div>
                {tiers.map((tier, i) => (
                  <div key={i} className="rounded-xl border border-border/30 bg-background/80 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-muted">Tier {i + 1}</span>
                      {tiers.length > 1 && (
                        <button onClick={() => removeTier(i)} className="text-xs text-red-400 hover:text-red-300">
                          Remove
                        </button>
                      )}
                    </div>
                    <Input label="Tier Name *" value={tier.name} onChange={(e) => updateTier(i, 'name', e.target.value)} placeholder="VIP, General, etc." />
                    <Input label="Description" value={tier.description} onChange={(e) => updateTier(i, 'description', e.target.value)} placeholder="What's included?" />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input label="Price (POL) *" type="number" value={tier.price} onChange={(e) => updateTier(i, 'price', e.target.value)} placeholder="0.01" hint="Price in POL (e.g. 0.01, 1, 5)" step="any" min="0" />
                      <Input label="Max Supply *" type="number" value={tier.maxSupply} onChange={(e) => updateTier(i, 'maxSupply', e.target.value)} placeholder="100" />
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
                  {error}
                </div>
              )}

              <Button className="w-full" onClick={handleCreateEvent} loading={saving}>
                Create Event & Continue
              </Button>
            </motion.div>
          )}

          {/* Step 2: Deploy Contract */}
          {step === 2 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-border/30 bg-surface/80 backdrop-blur-sm p-8 text-center space-y-6"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-accent/10 shadow-lg shadow-primary/10">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold">
                Deploy{' '}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Smart Contract</span>
              </h2>
              <p className="text-muted max-w-md mx-auto">
                Deploy your event&apos;s NFT contract to Polygon. This creates the on-chain
                infrastructure for ticket minting and verification.
              </p>

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="outline" onClick={() => router.push(`/organizer/${createdEventId}`)}>
                  Skip for Now
                </Button>
                <Button onClick={handleDeploy} loading={deploying}>
                  Deploy to Polygon
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Complete */}
          {step === 3 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-border/30 bg-surface/80 backdrop-blur-sm p-8 text-center space-y-6"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/10 shadow-lg shadow-green-500/10">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold">Event Created!</h2>
              <p className="text-muted">
                Your event has been created and the smart contract is being deployed.
                You can now manage it from your dashboard.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="outline" onClick={() => router.push('/organizer')}>
                  Back to Dashboard
                </Button>
                <Button onClick={() => router.push(`/organizer/${createdEventId}`)}>
                  Manage Event
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
