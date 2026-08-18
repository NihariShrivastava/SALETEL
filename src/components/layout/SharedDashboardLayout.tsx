import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Shield, User, LogOut } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';

interface SharedDashboardLayoutProps {
  title: string;
  homePath: string;
}

export default function SharedDashboardLayout({ title, homePath }: SharedDashboardLayoutProps) {
  const { user, logout, role } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col font-sans">
      <header className="h-16 bg-bg-secondary border-b border-bg-border flex items-center justify-between px-6 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-accent-blue to-accent-purple rounded-lg flex items-center justify-center shadow-lg cursor-pointer" onClick={() => navigate(homePath)}>
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-bold text-white tracking-tight leading-none">SALETEL</h1>
            <p className="text-[10px] font-medium text-text-muted tracking-widest uppercase mt-0.5">{title}</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Badge variant="blue">{role?.replace('_', ' ').toUpperCase()}</Badge>
            <div className="flex items-center gap-2 text-sm text-white font-medium pl-3 border-l border-bg-border">
              <User className="w-4 h-4 text-accent-blue" />
              {user?.full_name || user?.username || 'User'}
            </div>
          </div>
          
          <button onClick={handleLogout} className="text-text-muted hover:text-accent-red transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>
      
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
