import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { FileText, Loader2, Search, Calendar, PhoneCall, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import LeadViewModal from '../../components/telecaller/LeadViewModal';
import { format, differenceInDays } from 'date-fns';

export default function TelecallerDashboard() {
  const { user } = useAuth();
  
  const [leads, setLeads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [activeTab, setActiveTab] = useState<'actionable' | 'closed'>('actionable');

  const fetchLeads = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          *,
          surveyor:surveyors!surveyor_id(full_name),
          form_templates(name, fields)
        `)
        .eq('telecaller_id', user.id)
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const staleSkippedIds = data
          .filter(lead => {
            if (lead.lead_status === 'skipped' && lead.lead_status_updated_at) {
              const updatedDate = new Date(lead.lead_status_updated_at);
              return updatedDate < today;
            }
            return false;
          })
          .map(lead => lead.id);

        if (staleSkippedIds.length > 0) {
          supabase.from('submissions')
            .update({ 
              lead_status: 'new', 
              lead_status_updated_at: new Date().toISOString() 
            })
            .in('id', staleSkippedIds)
            .then(({ error }) => {
              if (error) console.error('Failed to reset skipped leads', error);
            });
            
          data.forEach(lead => {
            if (staleSkippedIds.includes(lead.id)) {
              lead.lead_status = 'new';
              lead.lead_status_updated_at = new Date().toISOString();
            }
          });
        }

        const processed = data.map(lead => {
          let currentStatus = lead.lead_status || 'new';
          return { ...lead, computed_status: currentStatus };
        });

        setLeads(processed);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [user]);

  // Read SLA Settings
  const slaSettings = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('sla_settings') || '{"hot": 1, "warm": 2, "cold": 3}');
    } catch (e) {
      return { hot: 1, warm: 2, cold: 3 };
    }
  }, []);

  const getSLAWarning = (lead: any) => {
    const status = lead.computed_status;
    if (!['hot', 'warm', 'cold'].includes(status)) return null;

    const targetDays = slaSettings[status];
    if (!targetDays) return null;

    const baseDate = new Date(lead.lead_status_updated_at || lead.submitted_at);
    const diff = differenceInDays(new Date(), baseDate);

    if (diff >= targetDays) {
      return `Pending action for ${diff} days (SLA: ${targetDays} day${targetDays > 1 ? 's' : ''})`;
    }
    return null;
  };

  // Status priority map (lower is higher priority)
  const statusPriority: Record<string, number> = {
    hot: 1,
    warm: 2,
    cold: 3,
    skipped: 4,
    new: 5
  };

  // Organize Leads
  const processedLeads = useMemo(() => {
    const actionable: any[] = [];
    const closed: any[] = [];

    leads.forEach(lead => {
      // Check if it matches search
      const search = searchTerm.toLowerCase();
      const matchesSearch = !search || 
        (lead.surveyor?.full_name?.toLowerCase() || '').includes(search) || 
        (lead.form_templates?.name?.toLowerCase() || '').includes(search) || 
        JSON.stringify(lead.data).toLowerCase().includes(search);

      const status = lead.computed_status;
      if (status === 'deleted') return;
      
      const matchesFilter = filterStatus === 'all' || status === filterStatus;

      if (!matchesSearch || !matchesFilter) return;

      if (['immediate', 'reverted_to_tl', 'wrong_number', 'closed'].includes(status)) {
        closed.push(lead);
      } else {
        actionable.push(lead);
      }
    });

    // Sort Actionable by Priority, then by Date
    actionable.sort((a, b) => {
      const pA = statusPriority[a.computed_status] || 99;
      const pB = statusPriority[b.computed_status] || 99;
      if (pA !== pB) return pA - pB;
      return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
    });

    // Sort Closed by most recent update
    closed.sort((a, b) => {
      const dA = new Date(a.lead_status_updated_at || a.submitted_at).getTime();
      const dB = new Date(b.lead_status_updated_at || b.submitted_at).getTime();
      return dB - dA;
    });

    return { actionable, closed };
  }, [leads, searchTerm, filterStatus]);

  const displayLeads = activeTab === 'actionable' ? processedLeads.actionable : processedLeads.closed;

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'hot': return <Badge variant="red">HOT</Badge>;
      case 'warm': return <Badge variant="yellow">WARM</Badge>;
      case 'cold': return <Badge variant="blue">COLD</Badge>;
      case 'immediate': return <Badge variant="red">IMMEDIATE</Badge>;
      case 'new': return <Badge variant="green">NEW</Badge>;
      case 'skipped': return <Badge variant="gray">SKIPPED</Badge>;
      case 'wrong_number': return <Badge variant="gray">WRONG NUMBER</Badge>;
      case 'reverted_to_tl': return <Badge variant="blue">SENT TO TL</Badge>;
      case 'closed': return <Badge variant="gray">CLOSED</Badge>;
      default: return <Badge variant="blue">{status.toUpperCase()}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header Banner */}
      <div className="bg-bg-secondary border border-bg-border rounded-2xl p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-blue/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <PhoneCall className="w-6 h-6 sm:w-8 sm:h-8 text-accent-blue" />
              Telecaller Portal
            </h2>
            <p className="text-text-secondary mt-1 text-sm sm:text-base">Review and take action on your assigned leads.</p>
          </div>
          
          <div className="flex bg-bg-primary rounded-lg p-1 border border-bg-border">
            <button
              onClick={() => setActiveTab('actionable')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'actionable' ? 'bg-accent-blue text-white shadow' : 'text-text-secondary hover:text-white'
              }`}
            >
              Actionable Leads ({processedLeads.actionable.length})
            </button>
            <button
              onClick={() => setActiveTab('closed')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'closed' ? 'bg-accent-blue text-white shadow' : 'text-text-secondary hover:text-white'
              }`}
            >
              Sent to TL / Closed ({processedLeads.closed.length})
            </button>
          </div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input 
            type="text" 
            placeholder="Search leads, surveyors, forms..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-bg-secondary border border-bg-border rounded-lg text-sm text-white focus:outline-none focus:border-accent-blue"
          />
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full sm:w-48 bg-bg-secondary border border-bg-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-blue"
          >
            <option value="all">All Statuses</option>
            {activeTab === 'actionable' ? (
              <>
                <option value="hot">Hot</option>
                <option value="warm">Warm</option>
                <option value="cold">Cold</option>
                <option value="new">New</option>
                <option value="skipped">Skipped</option>
              </>
            ) : (
              <>
                <option value="immediate">Immediate</option>
                <option value="reverted_to_tl">Sent to TL</option>
                <option value="wrong_number">Wrong Number</option>
                <option value="closed">Closed</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* Leads Table */}
      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-accent-blue" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-bg-secondary border-b border-bg-border text-text-muted text-[10px] uppercase tracking-widest">
                  <th className="py-3 px-5 font-semibold">Lead Details</th>
                  <th className="py-3 px-5 font-semibold">Surveyor</th>
                  <th className="py-3 px-5 font-semibold">Status</th>
                  <th className="py-3 px-5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {displayLeads.map(lead => {
                  const slaWarning = getSLAWarning(lead);
                  
                  return (
                    <tr key={lead.id} className={`border-b border-bg-border last:border-0 hover:bg-bg-hover/50 transition-colors ${slaWarning ? 'bg-red-500/5' : ''}`}>
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2 text-white font-medium mb-1">
                          <FileText className="w-4 h-4 text-accent-blue" />
                          {lead.form_templates?.name || 'Unknown Form'}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-text-muted">
                          <Calendar className="w-3 h-3" />
                          Assigned: {format(new Date(lead.submitted_at), 'MMM dd, yyyy')}
                        </div>
                      </td>
                      <td className="py-4 px-5 text-text-secondary">
                        {lead.surveyor?.full_name || 'Unknown'}
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex flex-col gap-1 items-start">
                          {renderStatusBadge(lead.computed_status)}
                          {slaWarning && (
                            <div className="flex items-center gap-1 text-xs text-red-400 mt-1" title={slaWarning}>
                              <AlertTriangle className="w-3 h-3" /> SLA Overdue
                            </div>
                          )}
                          {lead.lead_status_updated_at && (
                            <span className="text-[10px] text-text-muted">
                              Updated {format(new Date(lead.lead_status_updated_at), 'MMM dd, hh:mm a')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-5 text-right">
                        <Button variant="outline" size="sm" onClick={() => setSelectedLead(lead)} className="text-accent-blue border-accent-blue/30 hover:bg-accent-blue/10">
                          View Lead
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {displayLeads.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-text-muted italic">
                      No leads found in this view.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selectedLead && (
        <LeadViewModal 
          lead={selectedLead} 
          onClose={() => setSelectedLead(null)} 
          onStatusUpdate={fetchLeads} 
        />
      )}
    </div>
  );
}
