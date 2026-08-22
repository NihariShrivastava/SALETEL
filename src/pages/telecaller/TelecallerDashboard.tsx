import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { PhoneCall, Loader2, Users, Flame, ThermometerSun, Snowflake, PhoneOff, PhoneForwarded } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function TelecallerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [leadCounts, setLeadCounts] = useState<Record<string, number>>({
    new: 0,
    cold: 0,
    warm: 0,
    hot: 0,
    immediate: 0,
    skipped: 0,
    wrong_number: 0
  });

  useEffect(() => {
    if (!user) return;
    
    const fetchLeads = async () => {
      try {
        const { data } = await supabase
          .from('submissions')
          .select('id, lead_status, lead_status_updated_at')
          .eq('telecaller_id', user.id);

        if (data) {
          const counts: Record<string, number> = {
            new: 0, cold: 0, warm: 0, hot: 0, immediate: 0, skipped: 0, wrong_number: 0
          };
          
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          data.forEach(lead => {
            let status = lead.lead_status || 'new';
            
            // Automated Reset Logic
            if (status === 'skipped' && lead.lead_status_updated_at) {
              const updatedDate = new Date(lead.lead_status_updated_at);
              if (updatedDate < today) {
                status = 'new';
              }
            }
            
            counts[status] = (counts[status] || 0) + 1;
          });

          setLeadCounts(counts);
        }
      } catch (err) {
        console.error('Failed to fetch leads', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchLeads();
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent-blue" />
      </div>
    );
  }

  const buckets = [
    { id: 'new', label: 'New Leads', count: leadCounts.new, color: 'bg-accent-green', border: 'border-l-accent-green', text: 'text-accent-green', icon: Users },
    { id: 'immediate', label: 'Immediate Leads', count: leadCounts.immediate, color: 'bg-accent-red', border: 'border-l-accent-red', text: 'text-accent-red', icon: Flame, pulse: true },
    { id: 'hot', label: 'Hot Leads', count: leadCounts.hot, color: 'bg-red-500', border: 'border-l-red-500', text: 'text-red-500', icon: Flame },
    { id: 'warm', label: 'Warm Leads', count: leadCounts.warm, color: 'bg-orange-500', border: 'border-l-orange-500', text: 'text-orange-500', icon: ThermometerSun },
    { id: 'cold', label: 'Cold Leads', count: leadCounts.cold, color: 'bg-blue-500', border: 'border-l-blue-500', text: 'text-blue-500', icon: Snowflake },
    { id: 'skipped', label: 'Call Skipped/Not Connected', count: leadCounts.skipped, color: 'bg-purple-500', border: 'border-l-purple-500', text: 'text-purple-500', icon: PhoneOff },
    { id: 'wrong_number', label: 'Wrong Number', count: leadCounts.wrong_number, color: 'bg-slate-500', border: 'border-l-slate-500', text: 'text-slate-500', icon: PhoneForwarded },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-bg-secondary border border-bg-border rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-blue/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10">
          <h2 className="text-3xl font-bold text-white tracking-tight mb-2 flex items-center gap-3">
            <PhoneCall className="w-8 h-8 text-accent-blue" />
            Telecaller Portal
          </h2>
          <p className="text-text-secondary">Manage and track your assigned leads.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {buckets.map(bucket => {
          const Icon = bucket.icon;
          return (
            <Card 
              key={bucket.id} 
              className={`p-6 cursor-pointer transition-all bg-bg-secondary border-y border-r border-y-bg-border border-r-bg-border border-l-4 hover:-translate-y-1 hover:bg-bg-hover ${bucket.border} ${bucket.pulse ? 'animate-pulse-slow' : ''}`}
              onClick={() => navigate(`/telecaller/leads/${bucket.id}`)}
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${bucket.color}/20`}>
                  <Icon className={`w-6 h-6 ${bucket.text}`} />
                </div>
                <div className="text-3xl font-bold text-white">{bucket.count}</div>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">{bucket.label}</h3>
              <p className="text-xs text-text-muted uppercase tracking-widest">Click to view leads</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
