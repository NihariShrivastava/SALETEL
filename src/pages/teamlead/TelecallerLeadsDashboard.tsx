import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { FileText, Loader2, X, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function TelecallerLeadsDashboard() {
  const { telecallerId } = useParams();
  const navigate = useNavigate();
  
  const [telecaller, setTelecaller] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [selectedSub, setSelectedSub] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Drill-down filters
  const [filters, setFilters] = useState({
    dateRange: { from: '', to: '' },
    surveyor: '',
    status: '',
    template: ''
  });

  const fetchTelecallerAndLeads = async () => {
    if (!telecallerId) return;
    
    try {
      setIsLoading(true);
      
      // Fetch Telecaller details
      const { data: tcData, error: tcErr } = await supabase
        .from('surveyors')
        .select('id, full_name, username')
        .eq('id', telecallerId)
        .single();
        
      if (tcErr) throw tcErr;
      setTelecaller(tcData);

      // Fetch Submissions assigned to this telecaller
      const { data: subData, error: subErr } = await supabase
        .from('submissions')
        .select(`
          *,
          surveyor:surveyors!surveyor_id(full_name, username),
          form_templates(name, fields)
        `)
        .eq('telecaller_id', telecallerId)
        .order('submitted_at', { ascending: false });

      if (subErr) throw subErr;
      setSubmissions(subData || []);
      
    } catch (err) {
      console.error('Failed to load telecaller data', err);
      toast.error('Failed to load telecaller leads.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTelecallerAndLeads();
  }, [telecallerId]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-bg-primary items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent-blue" />
      </div>
    );
  }

  if (!telecaller) {
    return (
      <div className="flex min-h-screen bg-bg-primary items-center justify-center flex-col gap-4">
        <div className="text-xl text-white font-bold">Telecaller Not Found</div>
        <Button onClick={() => navigate(-1)} variant="outline">Go Back</Button>
      </div>
    );
  }

  const uniqueSurveyors = Array.from(new Set(submissions.filter(s => s.surveyor_id).map(s => s.surveyor_id)));
  const uniqueTemplates = Array.from(new Set(submissions.filter(s => s.form_template_id).map(s => s.form_template_id)));

  // Filtered submissions
  const filteredSubmissions = submissions.filter(s => {
    if (filters.surveyor && s.surveyor_id !== filters.surveyor) return false;
    if (filters.status && (s.lead_status || 'new') !== filters.status) return false;
    if (filters.template && s.form_template_id !== filters.template) return false;
    
    if (filters.dateRange.from) {
      const subDate = new Date(s.submitted_at);
      const fromDate = new Date(filters.dateRange.from);
      if (subDate < fromDate) return false;
    }
    
    if (filters.dateRange.to) {
      const subDate = new Date(s.submitted_at);
      const toDate = new Date(filters.dateRange.to);
      toDate.setHours(23, 59, 59, 999);
      if (subDate > toDate) return false;
    }
    
    return true;
  });

  return (
    <div className="min-h-screen bg-bg-primary font-sans flex flex-col">
      {/* Header */}
      <header className="h-16 bg-bg-secondary border-b border-bg-border flex items-center px-6 sticky top-0 z-40 shrink-0">
        <div className="flex items-center gap-4 w-full">
          <Button variant="outline" size="sm" onClick={() => navigate('/teamlead/dashboard')} className="shrink-0">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </Button>
          <div className="h-8 w-px bg-bg-border mx-2"></div>
          <div>
            <h1 className="text-lg font-bold text-white leading-none">
              Leads Assigned to {telecaller.full_name || telecaller.username}
            </h1>
            <p className="text-xs text-text-muted mt-1">Review and filter all forms assigned to this telecaller.</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Filters */}
        <div className="p-4 bg-bg-secondary border-b border-bg-border shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 max-w-7xl mx-auto">
            <div>
              <label className="block text-[10px] uppercase text-text-muted font-bold tracking-widest mb-1">From Date</label>
              <input
                type="date"
                value={filters.dateRange.from}
                onChange={(e) => setFilters(prev => ({ ...prev, dateRange: { ...prev.dateRange, from: e.target.value } }))}
                className="w-full bg-bg-primary border border-bg-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-blue"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-text-muted font-bold tracking-widest mb-1">To Date</label>
              <input
                type="date"
                value={filters.dateRange.to}
                onChange={(e) => setFilters(prev => ({ ...prev, dateRange: { ...prev.dateRange, to: e.target.value } }))}
                className="w-full bg-bg-primary border border-bg-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-blue"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-text-muted font-bold tracking-widest mb-1">Form Template</label>
              <select
                value={filters.template}
                onChange={(e) => setFilters(prev => ({ ...prev, template: e.target.value }))}
                className="w-full bg-bg-primary border border-bg-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-blue"
              >
                <option value="">All Templates</option>
                {uniqueTemplates.map(id => {
                  const templateName = submissions.find(s => s.form_template_id === id)?.form_templates?.name || 'Unknown';
                  return <option key={id as string} value={id as string}>{templateName}</option>;
                })}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase text-text-muted font-bold tracking-widest mb-1">Surveyor</label>
              <select
                value={filters.surveyor}
                onChange={(e) => setFilters(prev => ({ ...prev, surveyor: e.target.value }))}
                className="w-full bg-bg-primary border border-bg-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-blue"
              >
                <option value="">All Surveyors</option>
                {uniqueSurveyors.map(id => {
                  const surveyorName = submissions.find(s => s.surveyor_id === id)?.surveyor?.full_name || 'Unknown';
                  return <option key={id as string} value={id as string}>{surveyorName}</option>;
                })}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase text-text-muted font-bold tracking-widest mb-1">Lead Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full bg-bg-primary border border-bg-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-blue"
              >
                <option value="">All Statuses</option>
                <option value="new">New</option>
                <option value="cold">Cold</option>
                <option value="warm">Warm</option>
                <option value="hot">Hot</option>
                <option value="immediate">Immediate</option>
                <option value="skipped">Skipped/No Connect</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">
            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-bg-secondary border-b border-bg-border">
                    <tr className="text-text-muted text-[10px] uppercase tracking-widest">
                      <th className="py-4 px-6 font-semibold">Date / Time</th>
                      <th className="py-4 px-6 font-semibold">Form Template</th>
                      <th className="py-4 px-6 font-semibold">Surveyor</th>
                      <th className="py-4 px-6 font-semibold">Type of Lead</th>
                      <th className="py-4 px-6 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubmissions.map((sub) => {
                      const status = sub.lead_status || 'new';
                      let statusColor = 'blue';
                      let statusText = 'NEW';
                      if (status === 'cold') { statusColor = 'blue'; statusText = 'COLD'; }
                      else if (status === 'warm') { statusColor = 'yellow'; statusText = 'WARM'; }
                      else if (status === 'hot') { statusColor = 'red'; statusText = 'HOT'; }
                      else if (status === 'immediate') { statusColor = 'red'; statusText = 'IMMEDIATE'; }
                      else if (status === 'skipped' || status === 'wrong_number') { statusColor = 'gray'; statusText = 'SKIPPED'; }
                      else if (status === 'new') { statusColor = 'green'; statusText = 'NEW'; }

                      return (
                        <tr key={sub.id} className="border-b border-bg-border last:border-0 hover:bg-bg-primary/50 transition-colors">
                          <td className="py-3 px-6 text-text-secondary">
                            <div className="font-medium text-white">{format(new Date(sub.submitted_at), 'MMM dd, yyyy')}</div>
                            <div className="text-xs">{format(new Date(sub.submitted_at), 'hh:mm a')}</div>
                          </td>
                          <td className="py-3 px-6">
                            <span className="font-medium text-white">{sub.form_templates?.name || 'Unknown Form'}</span>
                          </td>
                          <td className="py-3 px-6 text-text-secondary">{sub.surveyor?.full_name || sub.surveyor?.username || 'Unknown'}</td>
                          <td className="py-3 px-6">
                            <Badge variant={statusColor as any}>{statusText}</Badge>
                          </td>
                          <td className="py-3 px-6 text-right">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => setSelectedSub(sub)}
                            >
                              <FileText className="w-4 h-4 mr-2" /> View Form
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredSubmissions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-text-muted italic">
                          No submissions match your filters for this telecaller.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      </main>

      {/* Submission Review Modal */}
      {selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 shadow-2xl">
            <div className="p-4 border-b border-bg-border flex justify-between items-center bg-bg-secondary shrink-0">
              <div>
                <h3 className="font-bold text-white text-lg">{selectedSub.form_templates?.name || 'Form Submission'}</h3>
                <p className="text-xs text-text-muted mt-1">Submitted by {selectedSub.surveyor?.full_name} on {format(new Date(selectedSub.submitted_at), 'MMM dd, yyyy hh:mm a')}</p>
              </div>
              <button onClick={() => setSelectedSub(null)} className="text-text-muted hover:text-white p-1 transition-colors bg-bg-primary rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6 bg-bg-primary flex-1">
              <div className="space-y-4">
              {(() => {
                if (!selectedSub.data || Object.keys(selectedSub.data).length === 0) {
                  return <div className="text-text-muted italic text-sm text-center py-8">No data entries found.</div>;
                }

                let entriesToRender: {key: string, label: string, value: any}[] = [];
                if (selectedSub.form_templates?.fields) {
                   entriesToRender = selectedSub.form_templates.fields
                     .filter((f: any) => selectedSub.data[f.id] !== undefined)
                     .map((f: any) => ({
                       key: f.id,
                       label: f.label || f.id,
                       value: selectedSub.data[f.id]
                     }));
                } else {
                   entriesToRender = Object.entries(selectedSub.data).map(([k, v]) => ({
                       key: k,
                       label: k,
                       value: v
                   }));
                }

                return entriesToRender.map(({key, label, value}) => {
                  let displayValue = value as string;
                  if (typeof value === 'object' && value !== null) {
                    if ('lat' in value && 'lng' in value) {
                       displayValue = `Lat: ${(value as any).lat}, Lng: ${(value as any).lng}`;
                    } else if (Array.isArray(value)) {
                       displayValue = value.join(', ');
                    } else {
                       displayValue = JSON.stringify(value);
                    }
                  }

                  return (
                    <div key={key} className="bg-bg-secondary rounded-lg border border-bg-border p-4">
                      <span className="block text-xs uppercase text-text-secondary mb-2 font-bold tracking-widest">{label}</span>
                      {typeof displayValue === 'string' && displayValue.startsWith('http') && displayValue.includes('supabase.co/storage/v1/object/public/') ? (
                        <div className="mt-2 bg-black/20 p-2 rounded border border-bg-border inline-block">
                          {displayValue.match(/\.(jpeg|jpg|gif|png)$/i) ? (
                            <a href={displayValue} target="_blank" rel="noreferrer" className="block">
                              <img src={displayValue} alt={key} className="max-h-48 rounded object-contain" />
                            </a>
                          ) : (
                            <a href={displayValue} target="_blank" rel="noreferrer" className="text-accent-blue hover:underline text-sm break-all">
                              View Uploaded Document
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-base text-white break-words">{displayValue}</span>
                      )}
                    </div>
                  );
                });
              })()}
              </div>
            </div>
            
            <div className="p-4 border-t border-bg-border bg-bg-secondary shrink-0">
              <div className="flex justify-between items-center text-sm">
                <div className="text-text-secondary">
                  Status: <Badge variant={
                    selectedSub.status === 'approved' ? 'green' : 
                    selectedSub.status === 'rejected' ? 'red' :
                    selectedSub.status === 'submitted' ? 'blue' : 'yellow'
                  }>{selectedSub.status === 'reverted' ? 'Reverted' : selectedSub.status}</Badge>
                </div>
                {selectedSub.admin_notes && (
                  <div className="text-text-muted italic max-w-sm truncate">
                    Note: {selectedSub.admin_notes}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
