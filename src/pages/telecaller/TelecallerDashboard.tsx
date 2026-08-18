import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Phone, User, MapPin, Building2, Loader2, PhoneCall } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function TelecallerDashboard() {
  const { user } = useAuth();
  const [assignedSurveyors, setAssignedSurveyors] = useState<any[]>([]);
  const [assignedCounters, setAssignedCounters] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
      try {
        // Telecallers no longer have direct assigned_users.
        // Instead, we find Team Leads who have assigned this Telecaller,
        // and fetch the other Surveyors assigned to those Team Leads.
        let surveyorIdsToFetch: string[] = [];

        const { data: teamLeads } = await supabase
          .from('surveyors')
          .select('assigned_users')
          .contains('assigned_users', [user.id]);

        if (teamLeads && teamLeads.length > 0) {
          const allAssigned = new Set<string>();
          teamLeads.forEach(tl => {
             tl.assigned_users?.forEach((id: string) => {
               if (id !== user.id) allAssigned.add(id);
             });
          });
          surveyorIdsToFetch = Array.from(allAssigned);
        }

        const [survRes, counterRes] = await Promise.all([
          surveyorIdsToFetch.length > 0 
            ? supabase.from('surveyors').select('id, full_name, username, phone, location').in('id', surveyorIdsToFetch).eq('user_role_id', (await supabase.from('user_roles').select('id').eq('name', 'Surveyor').single()).data?.id || '')
            : Promise.resolve({ data: [] }),
          counterIds.length > 0
            ? supabase.from('counters').select('id, username, location').in('id', counterIds)
            : Promise.resolve({ data: [] })
        ]);

        setAssignedSurveyors(survRes.data || []);
        setAssignedCounters(counterRes.data || []);
      } catch (err) {
        console.error('Failed to fetch telecaller data', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
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
          <h2 className="text-3xl font-bold text-white tracking-tight mb-2 flex items-center gap-3">
            <PhoneCall className="w-8 h-8 text-accent-blue" />
            Telecaller Portal
          </h2>
          <p className="text-text-secondary">Manage and contact your assigned field agents and counters.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Surveyors List */}
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-white uppercase tracking-widest flex items-center gap-2">
              <User className="w-4 h-4 text-accent-blue" />
              Assigned Surveyors
            </h3>
            <Badge variant="blue">{assignedSurveyors.length}</Badge>
          </div>
          
          <div className="grid gap-4">
            {assignedSurveyors.map(surv => (
              <Card key={surv.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-accent-blue/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-bg-secondary border border-bg-border flex items-center justify-center">
                    <User className="w-5 h-5 text-text-secondary" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold">{surv.full_name}</h4>
                    <p className="text-xs text-text-muted">@{surv.username}</p>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                  {surv.phone && (
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <Phone className="w-4 h-4 text-accent-blue" />
                      <a href={`tel:${surv.phone}`} className="hover:text-white transition-colors">{surv.phone}</a>
                    </div>
                  )}
                  {surv.location && (
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <MapPin className="w-4 h-4 text-text-muted" />
                      <span>{surv.location}</span>
                    </div>
                  )}
                </div>
              </Card>
            ))}
            
            {assignedSurveyors.length === 0 && (
              <div className="p-8 text-center border border-dashed border-bg-border rounded-xl">
                <p className="text-text-muted italic">No surveyors assigned.</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Counters List */}
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-white uppercase tracking-widest flex items-center gap-2">
              <Building2 className="w-4 h-4 text-accent-purple" />
              Assigned Counters
            </h3>
            <Badge variant="purple">{assignedCounters.length}</Badge>
          </div>
          
          <div className="grid gap-4">
            {assignedCounters.map(counter => (
              <Card key={counter.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-accent-purple/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-bg-secondary border border-bg-border flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-text-secondary" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold">{counter.username}</h4>
                    <p className="text-xs text-text-muted">Counter Workstation</p>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                  {counter.location && (
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <MapPin className="w-4 h-4 text-text-muted" />
                      <span>{counter.location}</span>
                    </div>
                  )}
                </div>
              </Card>
            ))}
            
            {assignedCounters.length === 0 && (
              <div className="p-8 text-center border border-dashed border-bg-border rounded-xl">
                <p className="text-text-muted italic">No counters assigned.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
