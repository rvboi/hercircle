import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

type AuthData = {
  id?: string;
  email: string;
  role: 'customer' | 'pharmacy' | 'distributor' | 'admin';
  loggedInAt: number;
};

type AuthContextType = {
  auth: AuthData | null;
  loading: boolean;
  login: (data: AuthData) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({
  auth: null,
  loading: true,
  login: () => { },
  logout: () => { },
});

export function useAuth() {
  return useContext(AuthContext);
}

// Remove useProtectedRoute from here - we'll handle it differently

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAuthData = async () => {
      try {
        // Persist data during development to maintain mock database state
        if (__DEV__) {
          await AsyncStorage.removeItem('user_auth');
        }
        const authDataString = await AsyncStorage.getItem('user_auth');
        if (authDataString) {
          setAuth(JSON.parse(authDataString));
        }
      } catch (error) {
        console.error('Failed to load auth data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAuthData();
  }, []);

  const login = async (data: AuthData) => {
    setAuth(data);
    await AsyncStorage.setItem('user_auth', JSON.stringify(data));
  };

  const logout = async () => {
    setAuth(null);
    await AsyncStorage.removeItem('user_auth');
  };

  return (
    <AuthContext.Provider value={{ auth, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}