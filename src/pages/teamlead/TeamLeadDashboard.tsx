import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { FileText, CheckCircle, XCircle, Clock, Loader2, X, ShieldAlert } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function TeamLeadDashboard() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [selectedSub, setSelectedSub] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Status filter for tabs
  const [activeTab, setActiveTab] = useState<'pending' | 'reviewed'>('pending');

  const fetchSubmissions = async () => {
    if (!user?.assigned_users || user.assigned_users.length === 0) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          *,
          surveyor:surveyors(full_name, username),
          form_templates(name, fields)
        `)
        .in('surveyor_id', user.assigned_users)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (err) {
      console.error('Failed to fetch submissions', err);
      toast.error('Failed to load submissions.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [user]);

  const handleUpdateStatus = async (status: 'approved' | 'reverted', subToUpdate: any, notes?: string) => {
    const targetSub = subToUpdate || selectedSub;
    if (!targetSub) return;
    
    try {
      const { error } = await supabase
        .from('submissions')
        .update({
          status,
          admin_notes: notes || targetSub.admin_notes,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', targetSub.id);

      if (error) throw error;
      
      toast.success(`Submission ${status}`);
      if (selectedSub?.id === targetSub.id) {
        setSelectedSub(null);
      }
      fetchSubmissions();
    } catch (err: any) {
      console.error('Update status error:', err);
      toast.error(err.message || 'Failed to update status');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent-blue" />
      </div>
    );
  }

  const pendingSubs = submissions.filter(s => s.status === 'submitted');
  const reviewedSubs = submissions.filter(s => s.status === 'approved' || s.status === 'reverted' || s.status === 'rejected');

  const displaySubs = activeTab === 'pending' ? pendingSubs : reviewedSubs;

  return (
    <div className="space-y-6">
      <div className="bg-bg-secondary border border-bg-border rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-blue/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Team Lead Portal</h2>
            <p className="text-text-secondary">Review and approve forms submitted by your field agents.</p>
          </div>
          
          <div className="flex gap-4">
            <div className="bg-bg-primary border border-bg-border rounded-lg p-4 flex flex-col items-center min-w-[100px]">
              <div className="text-2xl font-bold text-white">{pendingSubs.length}</div>
              <div className="text-[10px] uppercase text-text-muted font-bold tracking-widest mt-1">Pending</div>
            </div>
            <div className="bg-bg-primary border border-bg-border rounded-lg p-4 flex flex-col items-center min-w-[100px]">
              <div className="text-2xl font-bold text-white">{reviewedSubs.length}</div>
              <div className="text-[10px] uppercase text-text-muted font-bold tracking-widest mt-1">Reviewed</div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex gap-2 border-b border-bg-border pb-px">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'pending' ? 'border-accent-blue text-white' : 'border-transparent text-text-secondary hover:text-white'}`}
        >
          Requires Action ({pendingSubs.length})
        </button>
        <button
          onClick={() => setActiveTab('reviewed')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'reviewed' ? 'border-accent-blue text-white' : 'border-transparent text-text-secondary hover:text-white'}`}
        >
          Review History
        </button>
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-bg-primary/50 text-text-muted text-[10px] uppercase tracking-widest border-b border-bg-border">
              <th className="py-3 px-5 font-semibold">Surveyor</th>
              <th className="py-3 px-5 font-semibold">Form / Date</th>
              <th className="py-3 px-5 font-semibold">Status</th>
              <th className="py-3 px-5 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {displaySubs.map((sub, i) => (
              <tr key={i} className="border-b border-bg-border last:border-0 hover:bg-bg-hover/50 transition-colors">
                <td className="py-4 px-5">
                  <div className="font-medium text-white">{sub.surveyor?.full_name}</div>
                  <div className="text-xs text-text-muted">@{sub.surveyor?.username}</div>
                </td>
                <td className="py-4 px-5">
                  <div className="text-white">{sub.form_templates?.name || 'Unknown'}</div>
                  <div className="text-xs text-text-secondary">{format(new Date(sub.submitted_at), 'MMM dd, yyyy hh:mm a')}</div>
                </td>
                <td className="py-4 px-5">
                  <Badge variant={
                    sub.status === 'submitted' ? 'blue' :
                    sub.status === 'approved' ? 'green' : 
                    sub.status === 'rejected' ? 'red' : 'yellow'
                  }>
                    {sub.status === 'reverted' ? 'Reverted' : sub.status}
                  </Badge>
                </td>
                <td className="py-4 px-5 text-right">
                  {activeTab === 'pending' ? (
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedSub(sub)}>
                        Review
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-accent-red hover:text-white hover:bg-accent-red/20 border-accent-red/30 px-2"
                        onClick={() => {
                          const notes = prompt("Enter notes for reverting this form (why does it need changes?):");
                          if (notes !== null) handleUpdateStatus('reverted', sub, notes);
                        }}
                      >
                        Revert
                      </Button>
                      <Button 
                        size="sm" 
                        className="bg-accent-green hover:bg-accent-green/90 text-white shadow-lg shadow-accent-green/20 px-2"
                        onClick={() => handleUpdateStatus('approved', sub)}
                      >
                        Approve
                      </Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => setSelectedSub(sub)}>
                      View Details
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {displaySubs.length === 0 && (
              <tr>
                <td colSpan={4} className="py-12 text-center text-text-muted italic">
                  {activeTab === 'pending' ? 'No pending submissions to review. Great job!' : 'No reviewed submissions yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Submission Review Modal */}
      {selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 shadow-2xl">
            <div className="p-4 border-b border-bg-border flex justify-between items-center bg-bg-secondary">
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
                {selectedSub.data && Object.keys(selectedSub.data).length > 0 ? Object.entries(selectedSub.data).map(([key, value]) => {
                  let label = key;
                  if (selectedSub.form_templates?.fields) {
                    const fieldConfig = selectedSub.form_templates.fields.find((f: any) => f.id === key);
                    if (fieldConfig && fieldConfig.label) {
                      label = fieldConfig.label;
                    }
                  }

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
                }) : (
                  <div className="text-text-muted italic text-sm text-center py-8">No data entries found.</div>
                )}
              </div>
            </div>
            
            <div className="p-4 border-t border-bg-border bg-bg-secondary">
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
