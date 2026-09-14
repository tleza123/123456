'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, onIdTokenChanged } from 'firebase/auth';
import { getClientAuth, signInWithGoogle, signOut as firebaseSignOut, getCurrentIdToken } from '@/lib/firebase/client';

interface AuthContextType {
  user: User | null;
  idToken: string | null;
  loading: boolean;
  isOwner: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  idToken: null,
  loading: true,
  isOwner: false,
  signIn: async () => {},
  logout: async () => {},
  refreshToken: async () => null
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  // Check token and verify with backend bootstrap
  const checkOwnerStatus = useCallback(async (token: string) => {
    try {
      const res = await fetch('/api/bootstrap', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setIsOwner(true);
        return true;
      } else if (res.status === 403 || res.status === 401) {
        setIsOwner(false);
        return false;
      }
    } catch {
      setIsOwner(false);
    }
    return false;
  }, []);

  useEffect(() => {
    const auth = getClientAuth();
    const unsubscribe = onIdTokenChanged(auth, async currentUser => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          setIdToken(token);
          await checkOwnerStatus(token);
        } catch {
          setIdToken(null);
          setIsOwner(false);
        }
      } else {
        setIdToken(null);
        setIsOwner(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [checkOwnerStatus]);

  const signIn = async () => {
    setLoading(true);
    try {
      const user = await signInWithGoogle();
      const token = await user.getIdToken();
      setIdToken(token);
      await checkOwnerStatus(token);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await firebaseSignOut();
      setUser(null);
      setIdToken(null);
      setIsOwner(false);
    } finally {
      setLoading(false);
    }
  };

  const refreshToken = async () => {
    const token = await getCurrentIdToken(true);
    setIdToken(token);
    return token;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        idToken,
        loading,
        isOwner,
        signIn,
        logout,
        refreshToken
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
