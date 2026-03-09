/** User shape from Supabase auth (user_metadata / raw_user_meta_data). */
type AuthUserMeta = {
  user_metadata?: Record<string, unknown>;
  raw_user_meta_data?: Record<string, unknown>;
} | null;

export function getDisplayName(user: AuthUserMeta): string {
  if (!user) return "Guest";
  const meta = user.user_metadata ?? user.raw_user_meta_data ?? {};
  return (meta.full_name as string) ?? (meta.name as string) ?? "Guest";
}

export function getAvatarUrl(user: AuthUserMeta): string | null {
  if (!user) return null;
  const meta = user.user_metadata ?? user.raw_user_meta_data ?? {};
  return (meta.avatar_url as string) ?? (meta.picture as string) ?? null;
}
