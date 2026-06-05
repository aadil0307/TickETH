/** JWT payload shape stored in request.user after authentication */
export interface JwtPayload {
  sub: string;           // user UUID
  wallet_address: string;
  user_role: string;     // UserRole enum value
  role: string;          // 'authenticated' for Supabase compat
  iat?: number;
  exp?: number;
}
