import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { User, Lock, Eye, EyeOff, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Simple sha256 hashing on client side as requested (Note: Subtles crypto requires HTTPS or localhost)
  const hashPassword = async (pass: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pass);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Please enter username and password');
      return;
    }

    setIsLoading(true);
    try {
      const hashed = await hashPassword(password);

      // Check admin_users
      const { data: adminData, error: adminErr } = await supabase
        .from('admin_users')
        .select('*')
        .ilike('username', username)
        .eq('password_hash', hashed)
        .single();

      if (adminData) {
        login(adminData, 'admin');
        toast.success('Logged in as Admin');
        navigate('/admin/dashboard');
        return;
      }

      // Check counters first
      const { data: counterData } = await supabase
        .from('counters')
        .select('*')
        .ilike('username', username)
        .eq('password_hash', password)
        .single();

      if (counterData) {
        login(counterData, 'counter');
        toast.success(`Welcome to Counter Workstation`);
        navigate('/counter/dashboard');
        return;
      }

      // Check surveyors/telecallers/team leads (they all use the surveyors table)
      const { data: surveyorData } = await supabase
        .from('surveyors')
        .select('*, user_role:user_roles(name)')
        .ilike('username', username)
        .eq('password_hash', password)
        .single();

      if (surveyorData) {
        if (!surveyorData.is_active) {
          toast.error('Account is disabled');
          return;
        }

        const roleName = (surveyorData.user_role as any)?.name?.toLowerCase() || 'surveyor';
        
        let normalizedRole: 'surveyor' | 'telecaller' | 'team_lead' = 'surveyor';
        if (roleName.includes('telecaller')) normalizedRole = 'telecaller';
        if (roleName.includes('team lead')) normalizedRole = 'team_lead';

        login(surveyorData, normalizedRole);
        toast.success(`Welcome, ${surveyorData.full_name}`);
        
        if (normalizedRole === 'team_lead') {
          navigate('/teamlead/dashboard');
        } else if (normalizedRole === 'telecaller') {
          navigate('/telecaller/dashboard');
        } else {
          navigate('/surveyor/dashboard');
        }
        return;
      }

      toast.error('Invalid credentials');
    } catch (error) {
      console.error(error);
      toast.error('An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle radial gradient background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[600px] bg-accent-blue/5 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-accent-blue to-accent-purple rounded-2xl flex items-center justify-center shadow-lg mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">SALETEL</h1>
          <p className="text-text-muted text-sm font-medium tracking-widest mt-1 uppercase">DATA COLLECTION ENGINE</p>
        </div>

        <div className="bg-bg-secondary border border-bg-border rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-2">Welcome Back</h2>
          <p className="text-text-secondary text-sm mb-8">Access your administrative or counter billing workstation.</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">Username</label>
              <Input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. admin or counter"
                icon={<User className="w-4 h-4" />}
                required
              />
            </div>

            <div className="space-y-1.5 relative">
              <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter password"
                  icon={<Lock className="w-4 h-4" />}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-accent-blue to-accent-purple hover:from-accent-blue/90 hover:to-accent-purple/90 mt-2"
              size="lg"
              isLoading={isLoading}
            >
              Enter Workstation &rarr;
            </Button>
          </form>
        </div>
      </div>

      <div className="absolute top-6 right-6 flex items-center space-x-2 bg-bg-secondary/50 backdrop-blur border border-bg-border px-3 py-1.5 rounded-full text-xs font-medium text-text-secondary">
        <div className="w-2 h-2 rounded-full bg-accent-green shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
        <span>Server: Supabase</span>
      </div>
    </div>
  );
}
