'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { TableRowSkeleton } from '@/components/Skeleton';
import { Modal } from '@/components/Modal';
import { useAuthStore } from '@/lib/store';
import { useRequireAuth } from '@/lib/hooks';
import { adminApi } from '@/lib/api';
import { BLOCK_EXPLORER } from '@/lib/constants';
import { shortenAddress, formatDate } from '@/lib/utils';
import { parseError } from '@/lib/error-parser';
import { toast } from 'sonner';
import type { User, UserRole } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';

export default function AdminUsersPage() {
  useRequireAuth(['admin']);
  const { user: currentUser } = useAuthStore();
  const isAdmin = currentUser?.role === 'admin';

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<UserRole>('attendee');
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.users();
      const data = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : (res as any)?.data ?? [];
      setUsers(data);
    } catch (err) {
      toast.error(parseError(err).message);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin, loadUsers]);

  const handleChangeRole = async () => {
    if (!selectedUser) return;
    setChanging(true);
    setError(null);
    try {
      await adminApi.changeRole(selectedUser.id, newRole);
      toast.success(`Role changed to ${newRole} for ${shortenAddress(selectedUser.walletAddress || selectedUser.wallet_address || '')}`);
      setSelectedUser(null);
      loadUsers();
    } catch (err) {
      const parsed = parseError(err);
      setError(parsed.message);
      toast.error(parsed.title, { description: parsed.message });
    } finally {
      setChanging(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await adminApi.deleteUser(userId);
      toast.success('User deleted');
      loadUsers();
    } catch (err) {
      toast.error(parseError(err).message);
    }
  };

  const filtered = Array.isArray(users)
    ? users.filter((u) => {
        const matchSearch =
          !search ||
          (u.walletAddress || u.wallet_address || '').toLowerCase().includes(search.toLowerCase()) ||
          u.email?.toLowerCase().includes(search.toLowerCase()) ||
          (u.displayName || u.display_name || '').toLowerCase().includes(search.toLowerCase());
        const matchRole = roleFilter === 'all' || u.role === roleFilter;
        return matchSearch && matchRole;
      })
    : [];

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Access Denied</h2>
            <p className="mt-2 text-muted">Admin access required.</p>
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
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <div>
            <button
              onClick={() => history.back()}
              className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back to Admin
            </button>
            <PageHeader category="Manage" title="User" highlight="Management" description={`${users.length} total users`} />
          </div>

          {/* Alerts */}
          {error && (
            <div className="mb-6 rounded-xl border border-error/30 bg-error/5 p-4 text-sm text-error flex items-center justify-between">
              {error}
              <button onClick={() => setError(null)} className="hover:text-error/70">✕</button>
            </div>
          )}

          {/* Filters */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
              <input
                type="text"
                placeholder="Search by wallet, email, or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-border/50 bg-background/80 pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 backdrop-blur-sm"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-xl border border-border/50 bg-background/80 px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 backdrop-blur-sm"
            >
              <option value="all">All Roles</option>
              <option value="attendee">Attendee</option>
              <option value="volunteer">Volunteer</option>
              <option value="organizer">Organizer</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-border/30 bg-surface/80 backdrop-blur-sm overflow-hidden shadow-xl shadow-primary/5">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/30 bg-gradient-to-r from-surface-light/80 to-surface/80">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Wallet</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Display Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Joined</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRowSkeleton key={i} cols={5} />
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-sm text-muted">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    filtered.map((u) => (
                      <motion.tr
                        key={u.id}
                        className="border-b border-border last:border-0 hover:bg-surface-light/50 transition-colors"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      >
                        <td className="px-6 py-4 text-sm font-mono">
                          <a
                            href={`${BLOCK_EXPLORER}/address/${u.walletAddress || u.wallet_address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                          {shortenAddress(u.walletAddress || u.wallet_address || '')}
                        </a>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {u.displayName || u.display_name || <span className="text-muted">—</span>}
                        </td>
                        <td className="px-6 py-4">
                          <Badge status={u.role} />
                        </td>
                        <td className="px-6 py-4 text-sm text-muted">
                          {u.createdAt || u.created_at ? formatDate(u.createdAt || u.created_at || '') : '—'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => { setSelectedUser(u); setNewRole(u.role as UserRole); }}
                              className="text-xs text-primary hover:underline"
                            >
                              Change Role
                            </button>
                            {u.id !== currentUser?.id && (
                              <button
                                onClick={() => handleDelete(u.id)}
                                className="text-xs text-red-400 hover:underline"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Change Role Modal */}
      <Modal
        open={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title="Change User Role"
      >
        {selectedUser && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-surface-light p-3">
              <p className="text-sm font-mono">{shortenAddress(selectedUser.walletAddress || selectedUser.wallet_address || '')}</p>
              <p className="text-xs text-muted mt-1">Current role: <span className="capitalize font-medium">{selectedUser.role}</span></p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">New Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                <option value="attendee">Attendee</option>
                <option value="volunteer">Volunteer</option>
                <option value="organizer">Organizer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {newRole === selectedUser.role && (
              <p className="text-xs text-yellow-400">This is already the user&apos;s current role.</p>
            )}
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setSelectedUser(null)}>Cancel</Button>
              <Button onClick={handleChangeRole} loading={changing}>Save</Button>
            </div>
          </div>
        )}
      </Modal>

      <Footer />
    </div>
  );
}
