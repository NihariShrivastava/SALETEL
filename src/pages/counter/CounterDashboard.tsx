import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { User, MapPin, Briefcase, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface SurveyorWithDetails {
  id: string;
  full_name: string;
  username: string;
  location: string;
  assigned_domains: string[];
  domain_names?: string[];
}

export default function CounterDashboard() {
  const { user } = useAuth();
  const [surveyors, setSurveyors] = useState<SurveyorWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    const fetchCounterData = async () => {
      try {
        // Find surveyors whose counter_ids array contains this counter's ID
        const { data: sData, error } = await supabase
          .from('surveyors')
          .select('id, full_name, username, location, assigned_domains')
          .contains('counter_ids', [user.id]);
          
        if (error) throw error;
        
        if (sData && sData.length > 0) {
          // Fetch domains to map IDs to names
          const allDomainIds = new Set<string>();
          sData.forEach(s => s.assigned_domains?.forEach(d => allDomainIds.add(d)));
          
          if (allDomainIds.size > 0) {
            const { data: dData } = await supabase
              .from('domains')
              .select('id, name')
              .in('id', Array.from(allDomainIds))
              .or('is_deleted.is.null,is_deleted.eq.false');
              
            const domainMap = new Map(dData?.map(d => [d.id, d.name]) || []);
            
            const withNames = sData.map(s => ({
              ...s,
              domain_names: s.assigned_domains?.map(id => domainMap.get(id) || 'Unknown') || []
            }));
            
            setSurveyors(withNames);
          } else {
            setSurveyors(sData);
          }
        }
      } catch (err) {
        console.error('Failed to fetch surveyors for counter', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchCounterData();
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-bg-secondary border border-bg-border rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-blue/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10">
          <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Counter Workstation Hub</h2>
          <p className="text-text-secondary">View the Field Agents currently operating under your workstation.</p>
        </div>
      </div>
      
      <div className="flex justify-between items-center mb-4 mt-8">
        <h3 className="text-sm font-semibold text-white uppercase tracking-widest">Connected Surveyors</h3>
        <Badge variant="blue">{surveyors.length} Total</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {surveyors.map(surv => (
          <Card key={surv.id} className="flex flex-col gap-4">
            <div className="flex items-center gap-4 border-b border-bg-border pb-4">
              <div className="w-12 h-12 rounded-full bg-bg-primary border flex items-center justify-center">
                <User className="w-6 h-6 text-accent-blue" />
              </div>
              <div>
                <h4 className="text-white font-bold">{surv.full_name}</h4>
                <p className="text-xs text-text-muted">@{surv.username}</p>
              </div>
            </div>
            
            <div className="space-y-3 flex-1">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-text-secondary mt-0.5" />
                <div>
                  <div className="text-[10px] uppercase text-text-muted font-bold tracking-widest">Location</div>
                  <div className="text-sm text-white">{surv.location || 'Not specified'}</div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Briefcase className="w-4 h-4 text-text-secondary mt-0.5" />
                <div>
                  <div className="text-[10px] uppercase text-text-muted font-bold tracking-widest mb-1">Assigned Domains</div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {surv.domain_names && surv.domain_names.length > 0 ? (
                      surv.domain_names.map((d, i) => (
                        <Badge key={i} variant="gray" className="text-[10px] py-0">{d}</Badge>
                      ))
                    ) : (
                      <span className="text-xs text-text-muted italic">No domains assigned</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
        
        {surveyors.length === 0 && (
          <div className="col-span-full py-12 text-center border border-dashed border-bg-border rounded-xl">
            <p className="text-text-muted italic">No surveyors are currently connected to this counter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
