import React, { createContext, useContext, useState, useEffect } from 'react';

type UserRole = 'admin' | 'surveyor' | 'counter' | 'telecaller' | 'team_lead' | 'file_handler' | null;

interface AuthState {
  user: any | null; // Will type properly based on Surveyor or AdminUser later
  role: UserRole;
}

interface AuthContextType extends AuthState {
  login: (user: any, role: UserRole) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>(() => {
    const storedUser = localStorage.getItem('saletel_user');
    const storedRole = localStorage.getItem('saletel_role') as UserRole;
    if (storedUser && storedRole) {
      try {
        return { user: JSON.parse(storedUser), role: storedRole };
      } catch (e) {
        return { user: null, role: null };
      }
    }
    return { user: null, role: null };
  });

  // We don't need the useEffect for initial load anymore since we use lazy initialization

  const login = (user: any, role: UserRole) => {
    localStorage.setItem('saletel_user', JSON.stringify(user));
    localStorage.setItem('saletel_role', role || '');
    setAuthState({ user, role });
  };

  const logout = () => {
    localStorage.removeItem('saletel_user');
    localStorage.removeItem('saletel_role');
    setAuthState({ user: null, role: null });
  };

  return (
    <AuthContext.Provider value={{ ...authState, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
