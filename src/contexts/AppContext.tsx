import React, { createContext, useContext, useState } from 'react';

interface AppFilters {
  workspace: string;
  dateFrom: string;
  dateTo: string;
  teamLead: string;
  location: string;
}

interface AppContextType {
  filters: AppFilters;
  setFilters: React.Dispatch<React.SetStateAction<AppFilters>>;
  updateFilter: (key: keyof AppFilters, value: string) => void;
}

const defaultFilters: AppFilters = {
  workspace: 'all',
  dateFrom: '',
  dateTo: '',
  teamLead: '',
  location: '',
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<AppFilters>(defaultFilters);

  const updateFilter = (key: keyof AppFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <AppContext.Provider value={{ filters, setFilters, updateFilter }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
