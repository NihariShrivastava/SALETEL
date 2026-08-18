import React from 'react';
import { Shield, User, LogOut, RefreshCw, BarChart3, Wifi } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-bg-primary border-b border-bg-border flex items-center justify-between px-6 sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gradient-to-br from-accent-blue to-accent-purple rounded-lg flex items-center justify-center shadow-lg">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white tracking-tight leading-none">SALETEL</h1>
          <p className="text-[10px] font-medium text-text-muted tracking-widest uppercase mt-0.5">DATA COLLECTION ENGINE</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3 px-3 py-1.5 bg-bg-secondary rounded-full border border-bg-border">
          <div className="bg-bg-primary p-1.5 rounded-full">
            <User className="w-4 h-4 text-accent-blue" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-white leading-none">{user?.username || 'Admin'}</span>
            <span className="text-[10px] text-accent-blue font-medium uppercase tracking-wider">ADMINISTRATOR</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-text-secondary border-l border-bg-border pl-6">
          <div className="flex items-center gap-2 text-xs font-medium bg-bg-hover px-3 py-1.5 rounded-full border border-bg-border">
            <Wifi className="w-3.5 h-3.5 text-accent-green" />
            <span>Server: Supabase</span>
          </div>
          
          <button className="hover:text-white transition-colors" title="Refresh">
            <RefreshCw className="w-5 h-5" />
          </button>
          <button className="hover:text-white transition-colors flex items-center gap-2" onClick={() => navigate('/admin/reports')}>
            <BarChart3 className="w-5 h-5" />
            <span className="text-xs font-medium hidden sm:inline">Master Reports</span>
          </button>
          <button onClick={handleLogout} className="hover:text-accent-red transition-colors flex items-center gap-2">
            <LogOut className="w-5 h-5" />
            <span className="text-xs font-medium hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
