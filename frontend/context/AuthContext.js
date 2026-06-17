import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [emailCooldownUntil, setEmailCooldownUntil] = useState(0);
  const mountedRef = useRef(true);

  const loginAsGuest = () => {
    const guestUser = {
      id: 'guest',
      email: 'guest@cybershield.local',
      user_metadata: { full_name: 'Guest' },
    };
    setUser(guestUser);
    setProfile({ full_name: 'Guest', email: 'guest@cybershield.local' });
  };

  const getFriendlyAuthError = (error) => {
    if (!error) return 'An unexpected authentication error occurred.';
    const message = (error.message || '').toString();
    const normalized = message.toLowerCase();

    if (error.status === 429 || normalized.includes('rate limit') || normalized.includes('too many requests')) {
      return `Too many email requests. Please wait a few minutes and try again. (${message})`;
    }
    if (normalized.includes('already registered') || normalized.includes('user already registered')) {
      return 'That email is already registered. Try logging in or resetting your password.';
    }
    if (normalized.includes('email not confirmed') || normalized.includes('email not verified') || normalized.includes('confirm your email')) {
      return 'Your email is not confirmed yet. Please check your inbox and confirm your account before logging in.';
    }
    if (normalized.includes('invalid email')) {
      return 'Please enter a valid email address.';
    }
    return message || 'An unexpected authentication error occurred.';
  };

  const canSendEmail = () => {
    const now = Date.now();
    return now >= emailCooldownUntil;
  };

  const recordEmailRequest = (cooldownMs = 60 * 1000) => {
    const now = Date.now();
    setEmailCooldownUntil(now + cooldownMs);
  };

  const fetchProfile = async (userId) => {
    if (!userId) {
      setProfile(null);
      return null;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name,email,created_at')
      .eq('id', userId)
      .single();

    if (error) {
      console.log('Supabase profile fetch error:', error.message);
      setProfile(null);
      return null;
    }

    setProfile(data);
    return data;
  };

  const recordLoginActivity = async (userId, successful = true) => {
    if (!userId) return;
    try {
      const { error } = await supabase.from('login_activity').insert([
        {
          user_id: userId,
          successful,
        },
      ]);
      if (error) {
        console.log('Supabase login_activity insert error:', error.message);
      }
    } catch (err) {
      console.log('Unexpected login activity error:', err);
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    const restoreSession = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      const { data: userData, error: getUserError } = await supabase.auth.getUser();
      const currentUser = session?.user ?? userData?.user ?? null;

      if (getUserError) {
        console.log('Supabase getUser restore error:', getUserError.message);
      }

      if (mountedRef.current) {
        setUser(currentUser);
        if (currentUser?.id) {
          await fetchProfile(currentUser.id);
        }
        setLoading(false);
      }
    };

    restoreSession();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const nextUser = session?.user ?? null;
        if (mountedRef.current) {
          setUser(nextUser);
          if (nextUser?.id) {
            await fetchProfile(nextUser.id);
          } else {
            setProfile(null);
          }
        }
      }
    );

    return () => {
      mountedRef.current = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signUp = async ({ full_name, email, password }) => {
    setAuthLoading(true);
    try {
      if (!canSendEmail()) {
        throw new Error('Please wait a few minutes before requesting another email.');
      }

      const { data, error } = await supabase.auth.signUp(
        { email, password },
        { data: { full_name } }
      );
      if (error) {
        const friendly = getFriendlyAuthError(error);
        if (error.status === 429 || friendly.includes('Too many email requests')) {
          recordEmailRequest(5 * 60 * 1000);
        }
        throw new Error(friendly);
      }

      recordEmailRequest();

      const userId = data.user?.id || data.session?.user?.id;
      const hasSession = Boolean(data.session?.user?.id);
      if (userId && hasSession) {
        const { error: profileError } = await supabase.from('profiles').upsert(
          {
            id: userId,
            full_name,
            email,
          },
          { onConflict: 'id' }
        );
        if (profileError) {
          throw new Error(getFriendlyAuthError(profileError));
        }
        await recordLoginActivity(userId, true);
      }
      if (userId) {
        await fetchProfile(userId);
      }

      return data;
    } catch (error) {
      throw new Error(getFriendlyAuthError(error));
    } finally {
      setAuthLoading(false);
    }
  };

  const signIn = async ({ email, password }) => {
    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      const userId = data.user?.id || data.session?.user?.id;
      const currentUser = data.user ?? data.session?.user ?? null;
      if (currentUser && mountedRef.current) {
        setUser(currentUser);
      }

      if (userId) {
        const profileData = await fetchProfile(userId);
        if (!profileData) {
          const fullName = data.user?.user_metadata?.full_name || '';
          const { error: profileError } = await supabase.from('profiles').upsert(
            {
              id: userId,
              full_name: fullName || email,
              email,
            },
            { onConflict: 'id' }
          );
          if (profileError) {
            throw profileError;
          }
          await fetchProfile(userId);
        }
        await recordLoginActivity(userId, true);
      }

      return data;
    } catch (error) {
      throw new Error(getFriendlyAuthError(error));
    } finally {
      setAuthLoading(false);
    }
  };

  const signOut = async () => {
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      setUser(null);
      setProfile(null);
    } finally {
      setAuthLoading(false);
    }
  };

  // send a password reset email which redirects back into the app
  const resetPassword = async (email, redirectTo) => {
    setAuthLoading(true);
    try {
      if (!canSendEmail()) {
        throw new Error('Please wait a few minutes before requesting another email.');
      }
      const opts = redirectTo ? { redirectTo } : undefined;
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, opts);
      if (error) {
        const friendly = getFriendlyAuthError(error);
        if (error.status === 429 || friendly.includes('Too many email requests')) {
          recordEmailRequest(5 * 60 * 1000);
        }
        throw new Error(friendly);
      }

      recordEmailRequest();
      return data;
    } catch (error) {
      throw new Error(getFriendlyAuthError(error));
    } finally {
      setAuthLoading(false);
    }
  };

  const verifyRecoveryOtp = async (email, token) => {
    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'recovery',
      });
      if (error) {
        throw error;
      }
      const currentUser = data?.session?.user || data?.user || null;
      if (currentUser && mountedRef.current) {
        setUser(currentUser);
      }
      return data;
    } catch (error) {
      throw new Error(getFriendlyAuthError(error));
    } finally {
      setAuthLoading(false);
    }
  };

  const updatePassword = async (password) => {
    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ password });
      if (error) {
        throw error;
      }
      const currentUser = data?.user || null;
      if (currentUser && mountedRef.current) {
        setUser(currentUser);
      }
      return data;
    } catch (error) {
      throw new Error(getFriendlyAuthError(error));
    } finally {
      setAuthLoading(false);
    }
  };

  const updateProfileName = async (newName) => {
    if (!newName || !newName.trim()) return;
    const trimmed = newName.trim();
    if (user?.id === 'guest') {
      setProfile((prev) => prev ? { ...prev, full_name: trimmed } : { full_name: trimmed, email: 'guest@cybershield.local' });
      return;
    }
    if (user?.id) {
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, full_name: trimmed, email: user.email }, { onConflict: 'id' });
      if (error) {
        throw new Error(error.message);
      }
      await fetchProfile(user.id);
    }
  };

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      authLoading,
      signUp,
      signIn,
      signOut,
      resetPassword,
      verifyRecoveryOtp,
      updatePassword,
      loginAsGuest,
      updateProfileName,
    }),
    [user, profile, loading, authLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
