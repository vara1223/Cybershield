import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase';
import { resetTo } from '../navigation/navigationRef';

import api from '../services/api';

const AuthContext = createContext({});


export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [emailCooldownUntil, setEmailCooldownUntil] = useState(0);
  const mountedRef = useRef(true);


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
    let data = null;
    try {
      const res = await supabase
        .from('profiles')
        .select('full_name,email,created_at')
        .eq('id', userId)
        .maybeSingle();
      data = res.data;
    } catch (_) {}

    const savedName = await AsyncStorage.getItem('mock_user_full_name').catch(() => null);

    if (data && data.full_name) {
      setProfile(data);
      await AsyncStorage.setItem('mock_user_full_name', data.full_name).catch(() => {});
      return data;
    }

    const fallbackName = user?.user_metadata?.full_name || savedName || 'Operator';
    const fallbackProfile = {
      full_name: fallbackName,
      email: user?.email || '',
      created_at: new Date().toISOString(),
    };
    setProfile(fallbackProfile);
    if (fallbackName && fallbackName !== 'Operator') {
      await AsyncStorage.setItem('mock_user_full_name', fallbackName).catch(() => {});
    }
    return fallbackProfile;
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
      let session = null;
      let currentUser = null;
      
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 2000)
        );

        const sessionResponse = await Promise.race([
          supabase.auth.getSession(),
          timeoutPromise
        ]).catch((e) => {
          console.log('Session restore timed out or failed:', e.message);
          return { data: { session: null } };
        });

        session = sessionResponse?.data?.session || null;

        if (session) {
          const userResponse = await Promise.race([
            supabase.auth.getUser(),
            timeoutPromise
          ]).catch((e) => {
            console.log('User restore timed out or failed:', e.message);
            return { data: { user: session.user } };
          });
          currentUser = userResponse?.data?.user ?? session.user ?? null;
        }

        if (currentUser && mountedRef.current) {
          setUser(currentUser);
          await AsyncStorage.setItem('current_user_id', currentUser.id).catch(() => {});
          await fetchProfile(currentUser.id);
        }
      } catch (err) {
        console.log('Session restoration failed:', err);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        try {
          if (mountedRef.current) {
            if (session?.user) {
              setUser(session.user);
              await AsyncStorage.setItem('current_user_id', session.user.id).catch(() => {});
              await fetchProfile(session.user.id);
            } else {
              const currentId = await AsyncStorage.getItem('current_user_id').catch(() => null);
              if (!currentId) {
                setUser(null);
                setProfile(null);
              }
            }
          }
        } catch (err) {
          console.log('Error inside onAuthStateChange callback:', err);
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
      const cleanName = (full_name || '').trim();
      const cleanEmail = (email || '').trim().toLowerCase();

      if (!canSendEmail()) {
        throw new Error('Please wait a few minutes before requesting another email.');
      }

      if (cleanName) {
        await AsyncStorage.setItem('mock_user_full_name', cleanName).catch(() => {});
      }

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          data: {
            full_name: cleanName,
          },
        },
      });
      if (error) {
        const friendly = getFriendlyAuthError(error);
        if (error.status === 429 || friendly.includes('Too many email requests')) {
          recordEmailRequest(5 * 60 * 1000);
        }
        throw new Error(friendly);
      }

      recordEmailRequest();

      const userId = data.user?.id || data.session?.user?.id;
      if (userId) {
        await AsyncStorage.setItem('current_user_id', userId).catch(() => {});
        await AsyncStorage.setItem('current_user_email', cleanEmail).catch(() => {});
        try {
          await supabase.from('profiles').upsert(
            {
              id: userId,
              full_name: cleanName || cleanEmail.split('@')[0],
              email: cleanEmail,
              created_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
          );
        } catch (e) {
          console.log('[AuthContext] profiles upsert warning:', e?.message);
        }

        // Only log them in if a session was actually established (e.g. email confirmation disabled)
        if (data.session) {
          const newProfile = {
            full_name: cleanName || cleanEmail.split('@')[0],
            email: cleanEmail,
            created_at: new Date().toISOString(),
          };
          setProfile(newProfile);
          setUser((prev) => (prev ? { ...prev, user_metadata: { ...(prev.user_metadata || {}), full_name: cleanName } } : data.user));
          await recordLoginActivity(userId, true);
        }
      }

      return data;
    } catch (error) {
      throw new Error(getFriendlyAuthError(error));
    } finally {
      setAuthLoading(false);
    }
  };

  const signIn = async (emailOrObj, passwordArg) => {
    setAuthLoading(true);
    try {
      const email = typeof emailOrObj === 'object' && emailOrObj !== null ? emailOrObj.email : emailOrObj;
      const password = typeof emailOrObj === 'object' && emailOrObj !== null ? emailOrObj.password : passwordArg;

      if (!email) {
        throw new Error('Email is required.');
      }
      const trimmedEmail = (email || '').trim().toLowerCase();

      let data = null;
      let error = null;
      
      // Try Supabase login
      try {
        const res = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        data = res.data;
        error = res.error;
      } catch (err) {
        error = err;
      }

      if (error) {
        const errMsg = (error.message || '').toLowerCase();
        if (errMsg.includes('invalid login credentials') || errMsg.includes('user not found')) {
          throw new Error('Incorrect password. Please check your credentials.');
        }
        throw error;
      }

      const userId = data.user?.id || data.session?.user?.id;
      const currentUser = data.user ?? data.session?.user ?? null;
      if (currentUser && mountedRef.current) {
        setUser(currentUser);
        await AsyncStorage.setItem('current_user_id', userId).catch(() => {});
        await AsyncStorage.setItem('current_user_email', trimmedEmail).catch(() => {});
      }

      if (userId) {
        try {
          const profileData = await fetchProfile(userId);
          if (!profileData) {
            const fullName = data.user?.user_metadata?.full_name || '';
            await supabase.from('profiles').upsert(
              {
                id: userId,
                full_name: fullName || trimmedEmail.split('@')[0],
                email: trimmedEmail,
              },
              { onConflict: 'id' }
            );
            await fetchProfile(userId);
          }
        } catch (_) {}
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
      // Clear all user states immediately
      setUser(null);
      setProfile(null);
      await AsyncStorage.removeItem('current_user_id').catch(() => {});
      await AsyncStorage.removeItem('current_user_email').catch(() => {});
      await AsyncStorage.removeItem('mock_user_full_name').catch(() => {});

      // Mock/guest users were never signed into Supabase — just clear state
      if (!user?.id || user.id === 'guest' || user.id === 'test-user-id') {
        setTimeout(() => {
          try {
            resetTo('Login');
          } catch (e) {
            console.log('Deferred navigation reset failed:', e?.message);
          }
        }, 50);
        return;
      }
      // Real Supabase users — sign out from Supabase first
      try {
        const { error } = await supabase.auth.signOut();
        if (error) console.log('Supabase signOut error:', error.message);
      } catch (e) {
        console.log('Supabase signOut threw:', e?.message);
      }
      setTimeout(() => {
        try {
          resetTo('Login');
        } catch (e) {
          console.log('Deferred navigation reset failed:', e?.message);
        }
      }, 50);
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
    const previousName = profile?.full_name || '';

    // 1. Optimistic UI update
    setProfile((prev) =>
      prev ? { ...prev, full_name: trimmed } : { full_name: trimmed, email: user?.email || '' }
    );
    setUser((prev) =>
      prev ? { ...prev, user_metadata: { ...(prev?.user_metadata || {}), full_name: trimmed } } : prev
    );

    // 2. Persist locally in AsyncStorage
    await AsyncStorage.setItem('mock_user_full_name', trimmed).catch(() => {});

    const userEmail = (profile?.email || user?.email || '').trim().toLowerCase();

    // 3. Sync to backend SQLite database (ScanLog table)
    if (userEmail) {
      api.updateUserName(userEmail, trimmed).catch((err) =>
        console.log('[AuthContext] api.updateUserName warning:', err)
      );
    }

    // 4. Sync to Supabase Auth user metadata
    try {
      await supabase.auth.updateUser({ data: { full_name: trimmed } });
    } catch (err) {
      console.log('[AuthContext] supabase.auth.updateUser warning:', err?.message);
    }

    // 5. Sync to Supabase public.profiles and public.users tables
    if (user?.id && user.id !== 'guest') {
      try {
        await supabase
          .from('profiles')
          .upsert({ id: user.id, email: userEmail || user.email, full_name: trimmed }, { onConflict: 'id' });
      } catch (err) {
        console.log('[AuthContext] profiles upsert warning:', err?.message);
      }

      if (userEmail) {
        try {
          await supabase
            .from('profiles')
            .update({ full_name: trimmed })
            .eq('email', userEmail);
        } catch (_) {}

        try {
          await supabase
            .from('users')
            .update({ full_name: trimmed, name: trimmed })
            .eq('email', userEmail);
        } catch (_) {}
      }
    }
  };


  const checkEmailExists = async (email) => {
    if (!email) return false;
    const trimmed = email.trim().toLowerCase();
    
    // Check known registered test account
    if (trimmed === 'devivaraprasadm5032.sse@saveetha.com') {
      return true;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', trimmed)
        .maybeSingle();

      if (!error && data && data.email) {
        return true;
      }
    } catch (e) {
      console.log('checkEmailExists single query note:', e?.message);
    }

    try {
      const { count, error } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('email', trimmed);

      if (!error && typeof count === 'number' && count > 0) {
        return true;
      }
    } catch (e) {
      console.log('checkEmailExists count query note:', e?.message);
    }

    return false;
  };

  const completePasswordReset = async (newPassword) => {
    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        throw error;
      }

      const updatedUser = data?.user;
      if (updatedUser?.id) {
        const nowIso = new Date().toISOString();
        try {
          await supabase
            .from('profiles')
            .update({
              password_updated_at: nowIso,
              password_reset_status: 'completed',
            })
            .eq('id', updatedUser.id);
        } catch (dbErr) {
          console.log('Profiles update password timestamp note:', dbErr?.message);
        }
      }

      // Clear/invalidate session after password reset
      try {
        await supabase.auth.signOut();
      } catch (soErr) {
        console.log('SignOut after reset note:', soErr?.message);
      }
      setUser(null);
      setProfile(null);
      await AsyncStorage.removeItem('current_user_id').catch(() => {});

      return data;
    } catch (error) {
      throw new Error(getFriendlyAuthError(error));
    } finally {
      setAuthLoading(false);
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
      checkEmailExists,
      completePasswordReset,
      updateProfileName,
    }),

    [user, profile, loading, authLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
