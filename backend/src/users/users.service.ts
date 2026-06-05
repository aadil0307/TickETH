import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { UserRole } from '../common/enums';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /** Find user by wallet address */
  async findByWallet(wallet: string) {
    const { data, error } = await this.supabase.admin
      .from('users')
      .select('*')
      .eq('wallet_address', wallet.toLowerCase())
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /** Find user by UUID */
  async findById(id: string) {
    const { data, error } = await this.supabase.admin
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /** Create a new user from wallet address */
  async create(wallet: string) {
    const { data, error } = await this.supabase.admin
      .from('users')
      .insert({
        wallet_address: wallet.toLowerCase(),
        role: UserRole.ATTENDEE,
        consent_given: false,
      })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  /** Update user profile */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const { data, error } = await this.supabase.admin
      .from('users')
      .update({
        display_name: dto.displayName,
        email: dto.email,
        avatar_url: dto.avatarUrl,
        consent_given: dto.consentGiven,
        consent_at: dto.consentGiven ? new Date().toISOString() : undefined,
      })
      .eq('id', userId)
      .select('*')
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundException('User not found');
    return data;
  }

  /** Update user role (admin operation) */
  async updateRole(userId: string, role: UserRole) {
    const { data, error } = await this.supabase.admin
      .from('users')
      .update({ role })
      .eq('id', userId)
      .select('*')
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundException('User not found');
    return data;
  }

  /** List all users (admin) with pagination */
  async findAll(page = 1, limit = 20) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await this.supabase.admin
      .from('users')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return {
      data: data ?? [],
      total: count ?? 0,
      page,
      limit,
      totalPages: Math.ceil((count ?? 0) / limit),
    };
  }

  /** Delete user (DPDP compliance — data deletion request) */
  async delete(userId: string) {
    const { error } = await this.supabase.admin
      .from('users')
      .delete()
      .eq('id', userId);

    if (error) throw error;
    this.logger.warn(`User ${userId} deleted (DPDP request)`);
  }

  /** Store push notification token for a user */
  async setPushToken(userId: string, pushToken: string) {
    const { data, error } = await this.supabase.admin
      .from('users')
      .update({ push_token: pushToken })
      .eq('id', userId)
      .select('id, push_token')
      .single();

    if (error) {
      // If push_token column doesn't exist yet, log warning but don't crash
      this.logger.warn(`Could not save push token: ${error.message}`);
      return { id: userId, push_token: pushToken };
    }
    return data;
  }

  /** Assign volunteer role to a user (organizer/admin operation) */
  async assignVolunteer(targetWallet: string, assignedBy: string) {
    const user = await this.findByWallet(targetWallet);
    if (!user) {
      throw new NotFoundException(`No user found with wallet ${targetWallet}`);
    }

    // Only attendees can be promoted to volunteer
    if (user.role !== UserRole.ATTENDEE) {
      this.logger.warn(`User ${targetWallet} already has role ${user.role}`);
      return user;
    }

    const { data, error } = await this.supabase.admin
      .from('users')
      .update({ role: UserRole.VOLUNTEER })
      .eq('id', user.id)
      .select('*')
      .single();

    if (error) throw error;
    this.logger.log(`User ${targetWallet} promoted to volunteer by ${assignedBy}`);
    return data;
  }

  /** Revoke volunteer role (demote back to attendee) */
  async revokeVolunteer(targetWallet: string) {
    const user = await this.findByWallet(targetWallet);
    if (!user) throw new NotFoundException(`No user found with wallet ${targetWallet}`);
    if (user.role !== UserRole.VOLUNTEER) return user;

    const { data, error } = await this.supabase.admin
      .from('users')
      .update({ role: UserRole.ATTENDEE })
      .eq('id', user.id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }
}
