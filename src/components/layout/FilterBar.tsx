import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { Filter, Calendar, MapPin, Building2, Briefcase } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function FilterBar() {
  const { filters, updateFilter } = useAppContext();
  
  const [counters, setCounters] = useState<any[]>([]);
  const [teamLeads, setTeamLeads] = useState<any[]>([]);

  useEffect(() => {
    const fetchFilterData = async () => {
      try {
        const [cRes, tlRes] = await Promise.all([
          supabase.from('counters').select('id, username'),
          supabase.from('surveyors').select('id, full_name, user_role:user_roles!inner(name)').ilike('user_role.name', '%team lead%')
        ]);
        
        if (cRes.data) setCounters(cRes.data);
        if (tlRes.data) setTeamLeads(tlRes.data);
        
      } catch (err) {
        console.error('Failed to load filter data', err);
      }
    };
    
    fetchFilterData();
  }, []);

  return (
    <div className="bg-bg-secondary border-b border-bg-border px-6 py-4">
      <div className="flex flex-col gap-4">
        {/* Top Row: Workspace & Dates */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="p-2 bg-bg-primary rounded-lg border border-bg-border">
              <Briefcase className="w-4 h-4 text-accent-blue" />
            </div>
            <select 
              className="bg-bg-primary border border-bg-border text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-blue min-w-[250px]"
              value={filters.workspace}
              onChange={(e) => updateFilter('workspace', e.target.value)}
            >
              <option value="all">All Desks (Counters)</option>
              {counters.map(c => (
                <option key={c.id} value={c.id}>{c.username}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-bg-primary border border-bg-border rounded-lg px-3 py-1.5">
              <Calendar className="w-4 h-4 text-text-muted" />
              <span className="text-xs text-text-secondary">FROM</span>
              <input 
                type="date" 
                className="bg-transparent text-white text-sm focus:outline-none"
                value={filters.dateFrom}
                onChange={(e) => updateFilter('dateFrom', e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 bg-bg-primary border border-bg-border rounded-lg px-3 py-1.5">
              <Calendar className="w-4 h-4 text-text-muted" />
              <span className="text-xs text-text-secondary">TO</span>
              <input 
                type="date" 
                className="bg-transparent text-white text-sm focus:outline-none"
                value={filters.dateTo}
                onChange={(e) => updateFilter('dateTo', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Bottom Row: Additional Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-text-muted" />
            <span className="text-xs uppercase tracking-widest text-text-muted font-semibold">Filters:</span>
          </div>
          
          {/* Removed Brand and Region filters */}

          <select 
            className="bg-bg-primary border border-bg-border text-text-secondary text-xs rounded-full px-3 py-1.5 focus:outline-none focus:border-accent-blue"
            value={filters.teamLead}
            onChange={(e) => updateFilter('teamLead', e.target.value)}
          >
            <option value="">All Team Leads</option>
            {teamLeads.map(tl => (
              <option key={tl.id} value={tl.id}>{tl.full_name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
