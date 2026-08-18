import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Search, MapPin, X, Check, XCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

export default function Submissions() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [domains, setDomains] = useState<any[]>([]);
  
  const [selectedSub, setSelectedSub] = useState<any | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchData = async () => {
    try {
      const [subsRes, domainsRes] = await Promise.all([
        supabase.from('submissions').select('*, surveyors(full_name), domains(id, name), form_templates(fields)').order('submitted_at', { ascending: false }),
        supabase.from('domains').select('id, name')
      ]);

      if (subsRes.error) throw subsRes.error;
      if (domainsRes.error) throw domainsRes.error;

      setSubmissions(subsRes.data || []);
      setDomains(domainsRes.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load submissions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedSub || !user) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('submissions')
        .update({ 
          status: newStatus,
          admin_notes: adminNotes,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id
        })
        .eq('id', selectedSub.id);
        
      if (error) throw error;
      
      toast.success(`Submission ${newStatus} successfully`);
      
      // Update local state
      setSubmissions(prev => prev.map(s => s.id === selectedSub.id ? { ...s, status: newStatus, admin_notes: adminNotes } : s));
      setSelectedSub(prev => ({ ...prev, status: newStatus, admin_notes: adminNotes }));
      
    } catch (err) {
      console.error(err);
      toast.error('Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted': return <Badge variant="blue">Submitted</Badge>;
      case 'reviewed': return <Badge variant="yellow">Reviewed</Badge>;
      case 'approved': return <Badge variant="green">Approved</Badge>;
      case 'rejected': return <Badge variant="red">Rejected</Badge>;
      default: return <Badge variant="gray">{status}</Badge>;
    }
  };

  const filteredSubmissions = submissions.filter(sub => {
    const matchesSearch = (sub.surveyors?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || sub.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDomain = selectedDomain === 'all' || sub.domain_id === selectedDomain;
    const matchesStatus = selectedStatus === 'all' || sub.status === selectedStatus;
    return matchesSearch && matchesDomain && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent-blue" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] relative">
      {/* Main Table Area */}
      <div className={cn("flex-1 space-y-6 transition-all duration-300", selectedSub ? "pr-96 lg:pr-[32rem]" : "")}>
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Submissions Log</h2>
          <p className="text-text-secondary text-sm mt-1">Review, approve, or reject field data submissions.</p>
        </div>

        <Card className="p-0 overflow-hidden flex flex-col h-[calc(100%-4rem)]">
          <div className="p-4 border-b border-bg-border flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-3">
              <select 
                className="bg-bg-primary border border-bg-border text-text-secondary text-xs rounded-lg px-3 py-2 focus:border-accent-blue focus:outline-none"
                value={selectedDomain}
                onChange={e => setSelectedDomain(e.target.value)}
              >
                <option value="all">All Domains</option>
                {domains.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <select 
                className="bg-bg-primary border border-bg-border text-text-secondary text-xs rounded-lg px-3 py-2 focus:border-accent-blue focus:outline-none"
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input 
                type="text" 
                placeholder="Search surveyor or ID..."
                className="w-full bg-bg-primary border border-bg-border rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:border-accent-blue focus:outline-none"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="sticky top-0 bg-bg-primary z-10 shadow-sm">
                <tr className="text-text-muted text-[10px] uppercase tracking-widest border-b border-bg-border">
                  <th className="py-3 px-5 font-semibold">Surveyor</th>
                  <th className="py-3 px-5 font-semibold">Domain</th>
                  <th className="py-3 px-5 font-semibold">Submitted At</th>
                  <th className="py-3 px-5 font-semibold">Status</th>
                  <th className="py-3 px-5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions.length > 0 ? filteredSubmissions.map((sub, i) => (
                  <tr 
                    key={i} 
                    className={cn(
                      "border-b border-bg-border last:border-0 hover:bg-bg-hover/50 transition-colors cursor-pointer",
                      selectedSub?.id === sub.id ? "bg-bg-hover" : ""
                    )}
                    onClick={() => {
                      setSelectedSub(sub);
                      setAdminNotes(sub.admin_notes || '');
                    }}
                  >
                    <td className="py-3 px-5 text-white font-medium">{sub.surveyors?.full_name || 'Unknown'}</td>
                    <td className="py-3 px-5 text-text-secondary">{sub.domains?.name || '-'}</td>
                    <td className="py-3 px-5 text-text-secondary">{format(new Date(sub.submitted_at), 'MMM dd, hh:mm a')}</td>
                    <td className="py-3 px-5">{getStatusBadge(sub.status)}</td>
                    <td className="py-3 px-5 text-right">
                      <Button variant="ghost" size="sm" onClick={(e) => { 
                        e.stopPropagation(); 
                        setSelectedSub(sub); 
                        setAdminNotes(sub.admin_notes || '');
                      }}>
                        View
                      </Button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-text-muted italic border-2 border-dashed border-bg-border rounded-xl">
                      No submissions found matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Slide-out Detail Panel */}
      {selectedSub && (
        <div className="absolute top-0 right-0 w-96 lg:w-[32rem] h-full bg-bg-secondary border-l border-bg-border shadow-2xl flex flex-col z-20 transition-transform transform translate-x-0">
          <div className="p-4 border-b border-bg-border flex justify-between items-center bg-bg-primary">
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-widest">Submission Details</h3>
              <p className="text-xs text-text-secondary mt-0.5">ID: {selectedSub.id}</p>
            </div>
            <button onClick={() => setSelectedSub(null)} className="text-text-muted hover:text-white p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-bold text-white leading-tight">{selectedSub.surveyors?.full_name}</h2>
                <div className="flex gap-2 mt-2">
                  <Badge variant="blue">{selectedSub.domains?.name}</Badge>
                </div>
              </div>
              <div>{getStatusBadge(selectedSub.status)}</div>
            </div>

            <div className="text-xs text-text-muted uppercase tracking-widest border-b border-bg-border pb-2">Submitted Data</div>
            
            <div className="space-y-4">
              {selectedSub.data && Object.keys(selectedSub.data).length > 0 ? Object.entries(selectedSub.data).map(([key, value]) => {
                let label = key;
                if (selectedSub.form_templates?.fields) {
                  const fieldConfig = selectedSub.form_templates.fields.find((f: any) => f.id === key);
                  if (fieldConfig && fieldConfig.label) {
                    label = fieldConfig.label;
                  }
                }

                // If value is an object (like a location object {lat, lng}), stringify it, or ignore if we want to handle map separately
                // but the form outputs raw data.
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
                  <div key={key} className="bg-bg-primary rounded-lg border border-bg-border p-3">
                    <span className="block text-[10px] uppercase text-text-secondary mb-1 font-semibold">{label}</span>
                    {typeof displayValue === 'string' && displayValue.startsWith('http') && displayValue.includes('supabase.co/storage/v1/object/public/') ? (
                      <div className="mt-1">
                        {displayValue.match(/\.(jpeg|jpg|gif|png)$/i) ? (
                          <a href={displayValue} target="_blank" rel="noreferrer" className="block">
                            <img src={displayValue} alt={key} className="max-h-32 rounded border border-bg-border object-contain bg-white" />
                          </a>
                        ) : (
                          <a href={displayValue} target="_blank" rel="noreferrer" className="text-accent-blue hover:underline text-sm break-all">
                            View Uploaded File
                          </a>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-white break-words">{displayValue}</span>
                    )}
                  </div>
                );
              }) : (
                <div className="text-text-muted italic text-sm">No data entries found.</div>
              )}
            </div>

            <div className="pt-4 space-y-2">
              <label className="text-xs text-text-muted uppercase tracking-widest font-semibold">Admin Notes</label>
              <textarea 
                className="w-full bg-bg-primary border border-bg-border rounded-lg p-3 text-white focus:border-accent-blue focus:outline-none text-sm min-h-[100px]"
                placeholder="Add internal notes about this submission..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              ></textarea>
            </div>
          </div>

          <div className="p-4 border-t border-bg-border bg-bg-primary flex gap-3">
            <Button 
              className="flex-1 bg-accent-green hover:bg-accent-green/90 text-white border-transparent"
              onClick={() => handleUpdateStatus('approved')}
              isLoading={isUpdating}
            >
              <Check className="w-4 h-4 mr-2" /> Approve
            </Button>
            <Button 
              className="flex-1 bg-accent-red hover:bg-accent-red/90 text-white border-transparent"
              onClick={() => handleUpdateStatus('rejected')}
              isLoading={isUpdating}
            >
              <XCircle className="w-4 h-4 mr-2" /> Reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
