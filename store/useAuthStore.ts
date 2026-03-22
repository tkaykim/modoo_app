import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createClient } from '@/lib/supabase-client';

export interface UserData {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  phone?: string;
  role?: 'admin' | 'customer';
  created_at?: string;
}

interface AuthState {
  user: UserData | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Initialize auth state by checking current session
  initialize: () => Promise<void>;

  // Set user data and mark as authenticated
  setUser: (user: UserData) => void;

  // Clear user data and mark as not authenticated
  logout: () => void;

  // Update user profile
  updateUser: (updates: Partial<UserData>) => void;

  // Set loading state
  setLoading: (loading: boolean) => void;

  // Login with email and password
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;

  // Sign up with email and password
  signUp: (email: string, password: string, name?: string, phone?: string) => Promise<{ success: boolean; error?: string; needsEmailConfirmation?: boolean }>;

  // Sign in with OAuth provider
  signInWithOAuth: (provider: 'google' | 'kakao', mode?: 'login' | 'signup') => Promise<{ success: boolean; error?: string }>;

  // Request password reset email
  resetPasswordForEmail: (email: string) => Promise<{ success: boolean; error?: string }>;

  // Update password (for authenticated users after reset link)
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,

      initialize: async () => {
        try {
          const supabase = createClient();
          const { data: { session } } = await supabase.auth.getSession();

          if (session?.user) {
            // Fetch profile data from profiles table
            const { data: profile } = await supabase
              .from('profiles')
              .select('name, email, phone_number, role')
              .eq('id', session.user.id)
              .single();

            // User is authenticated - prefer profile data over user_metadata
            const userData: UserData = {
              id: session.user.id,
              email: profile?.email || session.user.email!,
              name: profile?.name || session.user.user_metadata?.name,
              avatar_url: session.user.user_metadata?.avatar_url,
              phone: profile?.phone_number || session.user.phone,
              role: profile?.role as 'admin' | 'customer' | undefined,
              created_at: session.user.created_at,
            };

            set({
              user: userData,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            // No session, user is not authenticated
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        } catch (error) {
          console.error('Auth initialization error:', error);
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      setUser: (user) =>
        set({
          user,
          isAuthenticated: true,
          isLoading: false,
        }),

      logout: async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      setLoading: (loading) =>
        set({
          isLoading: loading,
        }),

      login: async (email: string, password: string) => {
        try {
          set({ isLoading: true });
          const supabase = createClient();

          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            set({ isLoading: false });
            return { success: false, error: error.message };
          }

          if (data.user) {
            // Fetch profile data from profiles table
            const { data: profile } = await supabase
              .from('profiles')
              .select('name, email, phone_number, role')
              .eq('id', data.user.id)
              .single();

            // Set user data in store - prefer profile data over user_metadata
            const userData: UserData = {
              id: data.user.id,
              email: profile?.email || data.user.email!,
              name: profile?.name || data.user.user_metadata?.name,
              avatar_url: data.user.user_metadata?.avatar_url,
              phone: profile?.phone_number || data.user.phone,
              role: profile?.role as 'admin' | 'customer' | undefined,
              created_at: data.user.created_at,
            };

            set({
              user: userData,
              isAuthenticated: true,
              isLoading: false,
            });

            return { success: true };
          }

          set({ isLoading: false });
          return { success: false, error: 'Login failed' };
        } catch (err) {
          set({ isLoading: false });
          return { success: false, error: (err as Error).message };
        }
      },

      signUp: async (email: string, password: string, name?: string, phone?: string) => {
        try {
          set({ isLoading: true });
          const supabase = createClient();

          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`,
              data: {
                name: name || '',
                phone_number: phone || '',
              },
            },
          });

          if (error) {
            set({ isLoading: false });
            return { success: false, error: error.message };
          }

          if (data.user) {
            // Check if email confirmation is needed
            const needsEmailConfirmation = !data.session;

            if (data.session) {
              // User is auto-confirmed, set user data
              const userData: UserData = {
                id: data.user.id,
                email: data.user.email!,
                name: data.user.user_metadata?.name || name,
                avatar_url: data.user.user_metadata?.avatar_url,
                phone: data.user.phone || phone,
                created_at: data.user.created_at,
              };

              set({
                user: userData,
                isAuthenticated: true,
                isLoading: false,
              });
            } else {
              set({ isLoading: false });
            }

            return { success: true, needsEmailConfirmation };
          }

          set({ isLoading: false });
          return { success: false, error: 'Sign up failed' };
        } catch (err) {
          set({ isLoading: false });
          return { success: false, error: (err as Error).message };
        }
      },

      signInWithOAuth: async (provider: 'google' | 'kakao', mode: 'login' | 'signup' = 'login') => {
        try {
          set({ isLoading: true });
          const supabase = createClient();
          const origin = typeof window !== 'undefined' ? window.location.origin : '';

          // Carry the saved return URL through the OAuth redirect
          let returnTo = '/home';
          try {
            const saved = sessionStorage.getItem('login:returnTo');
            if (saved && saved.startsWith('/') && !saved.startsWith('//')) {
              returnTo = saved;
            }
          } catch {}

          const { error } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
              redirectTo: `${origin}/auth/callback?mode=${mode}&next=${encodeURIComponent(returnTo)}`,
            },
          });

          if (error) {
            set({ isLoading: false });
            return { success: false, error: error.message };
          }

          // OAuth will redirect, so loading state stays true
          return { success: true };
        } catch (err) {
          set({ isLoading: false });
          return { success: false, error: (err as Error).message };
        }
      },

      resetPasswordForEmail: async (email: string) => {
        try {
          set({ isLoading: true });
          const supabase = createClient();

          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/confirm`,
          });

          set({ isLoading: false });

          if (error) {
            return { success: false, error: error.message };
          }

          return { success: true };
        } catch (err) {
          set({ isLoading: false });
          return { success: false, error: (err as Error).message };
        }
      },

      updatePassword: async (newPassword: string) => {
        try {
          set({ isLoading: true });
          const supabase = createClient();

          const { error } = await supabase.auth.updateUser({ password: newPassword });

          set({ isLoading: false });

          if (error) {
            return { success: false, error: error.message };
          }

          return { success: true };
        } catch (err) {
          set({ isLoading: false });
          return { success: false, error: (err as Error).message };
        }
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
