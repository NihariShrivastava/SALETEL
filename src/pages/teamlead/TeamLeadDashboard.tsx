import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { FileText, CheckCircle, XCircle, Clock, Loader2, X, Users, PhoneCall, Activity, Flame } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function TeamLeadDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [selectedSub, setSelectedSub] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [teamCounts, setTeamCounts] = useState({ surveyors: 0, telecallers: 0 });
  
  // Status filter for tabs

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
          surveyor:surveyors!surveyor_id(full_name, username),
          form_templates(name, fields)
        `)
        .in('surveyor_id', user.assigned_users)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      let finalData = data || [];
      const uniqueTelecallerIds = Array.from(new Set(finalData.filter(s => s.telecaller_id).map(s => s.telecaller_id)));

      if (uniqueTelecallerIds.length > 0) {
        const { data: telecallersData } = await supabase
          .from('surveyors')
          .select('id, full_name, username')
          .in('id', uniqueTelecallerIds);
        
        if (telecallersData) {
          // Add telecaller details to submissions manually
          finalData.forEach(sub => {
            if (sub.telecaller_id) {
              sub.telecaller = telecallersData.find(t => t.id === sub.telecaller_id);
            }
          });
        }
      }
      
      setSubmissions(finalData);
      
      let surveyorsCount = user?.assigned_users?.length || 0;
      setTeamCounts({ surveyors: surveyorsCount, telecallers: uniqueTelecallerIds.length });
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


  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent-blue" />
      </div>
    );
  }



  // Group submissions by telecaller for report
  const telecallerReport = submissions.reduce((acc, sub) => {
    if (!sub.telecaller_id) return acc;
    
    if (!acc[sub.telecaller_id]) {
      acc[sub.telecaller_id] = {
        id: sub.telecaller_id,
        name: sub.telecaller?.full_name || sub.telecaller?.username || 'Unknown Telecaller',
        total: 0,
        new: 0,
        cold: 0,
        warm: 0,
        hot: 0,
        immediate: 0,
        skipped: 0
      };
    }
    
    acc[sub.telecaller_id].total++;
    const status = sub.lead_status || 'new';
    if (status === 'new') acc[sub.telecaller_id].new++;
    else if (status === 'cold') acc[sub.telecaller_id].cold++;
    else if (status === 'warm') acc[sub.telecaller_id].warm++;
    else if (status === 'hot') acc[sub.telecaller_id].hot++;
    else if (status === 'immediate') acc[sub.telecaller_id].immediate++;
    else if (status === 'skipped' || status === 'wrong_number') acc[sub.telecaller_id].skipped++;
    
    return acc;
  }, {} as Record<string, any>);
  
  const telecallerData = Object.values(telecallerReport);
  const immediateLeads = submissions.filter(s => s.lead_status === 'immediate');

  return (
    <div className="space-y-6">
      {immediateLeads.length > 0 && (
        <div className="bg-accent-red/10 border border-accent-red/50 rounded-xl p-4 flex items-start gap-4 animate-pulse-slow shadow-[0_0_15px_rgba(239,68,68,0.2)]">
          <div className="bg-accent-red/20 p-2 rounded-full shrink-0">
            <Flame className="w-6 h-6 text-accent-red" />
          </div>
          <div>
            <h3 className="text-accent-red font-bold text-lg mb-1">Immediate Leads Alert!</h3>
            <p className="text-white text-sm">
              You have <span className="font-bold">{immediateLeads.length}</span> leads marked as IMMEDIATE. 
              Please review these immediately in the Lead Analysis view.
            </p>
          </div>
        </div>
      )}
      <div className="bg-bg-secondary border border-bg-border rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-blue/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Team Lead Portal</h2>
            <p className="text-text-secondary">Review forms and manage leads for your team.</p>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <div className="bg-bg-primary border border-bg-border rounded-lg p-4 flex flex-col items-center min-w-[100px]">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-accent-blue" />
                <div className="text-xl font-bold text-white">{teamCounts.surveyors}</div>
              </div>
              <div className="text-[10px] uppercase text-text-muted font-bold tracking-widest text-center">Surveyors</div>
            </div>
            <div className="bg-bg-primary border border-bg-border rounded-lg p-4 flex flex-col items-center min-w-[100px]">
              <div className="flex items-center gap-2 mb-1">
                <PhoneCall className="w-4 h-4 text-accent-green" />
                <div className="text-xl font-bold text-white">{teamCounts.telecallers}</div>
              </div>
              <div className="text-[10px] uppercase text-text-muted font-bold tracking-widest text-center">Telecallers</div>
            </div>
            <div className="bg-bg-primary border border-bg-border rounded-lg p-4 flex flex-col items-center min-w-[100px]">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-accent-yellow" />
                <div className="text-xl font-bold text-white">{submissions.length}</div>
              </div>
              <div className="text-[10px] uppercase text-text-muted font-bold tracking-widest text-center">Forms Filled</div>
            </div>
          </div>
        </div>
      </div>
      

        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white">Forms Available for Lead Analysis</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from(new Set(submissions.filter(s => s.form_template_id).map(s => s.form_template_id))).map(templateId => {
              const templateSubs = submissions.filter(s => s.form_template_id === templateId);
              const templateName = templateSubs[0]?.form_templates?.name || 'Unknown Form';
              return (
                <div key={templateId as string} className="bg-bg-primary border border-bg-border rounded-xl p-5 hover:border-accent-blue/50 transition-colors">
                  <h4 className="font-bold text-white text-lg mb-1">{templateName}</h4>
                  <p className="text-sm text-text-secondary mb-4">{templateSubs.length} entries available</p>
                  <Link to={`/teamlead/analyze/${templateId}`}>
                    <Button variant="outline" className="w-full text-accent-blue border-accent-blue/30 hover:bg-accent-blue/10">
                      <Activity className="w-4 h-4 mr-2" /> Analyze Leads & Assign
                    </Button>
                  </Link>
                </div>
              );
            })}
            {submissions.length === 0 && (
              <div className="col-span-full py-8 text-center text-text-muted italic border-2 border-dashed border-bg-border rounded-xl">
                No forms have been filled by your surveyors yet.
              </div>
            )}
          </div>
        </Card>

        {/* Telecaller Performance Report */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white">Telecaller Performance Report</h3>
            <Badge variant="blue">{telecallerData.length} Active Telecallers</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-bg-primary border-b border-bg-border text-text-muted text-[10px] uppercase tracking-widest">
                  <th className="py-3 px-4 font-semibold rounded-tl-lg">Telecaller</th>
                  <th className="py-3 px-4 font-semibold text-center">Total Assigned</th>
                  <th className="py-3 px-4 font-semibold text-center text-accent-green">New</th>
                  <th className="py-3 px-4 font-semibold text-center text-blue-500">Cold</th>
                  <th className="py-3 px-4 font-semibold text-center text-orange-500">Warm</th>
                  <th className="py-3 px-4 font-semibold text-center text-red-500">Hot</th>
                  <th className="py-3 px-4 font-semibold text-center text-accent-red">Immediate</th>
                  <th className="py-3 px-4 font-semibold text-center text-purple-500 rounded-tr-lg">Skipped/No Connect</th>
                </tr>
              </thead>
              <tbody>
                {telecallerData.map((tc: any, i) => (
                  <tr 
                    key={i} 
                    className="border-b border-bg-border last:border-0 hover:bg-bg-primary/80 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/teamlead/telecaller/${tc.id}`)}
                  >
                    <td className="py-3 px-4 font-medium text-white group-hover:text-accent-blue transition-colors">
                      {tc.name}
                    </td>
                    <td className="py-3 px-4 text-center font-bold">{tc.total}</td>
                    <td className="py-3 px-4 text-center text-text-secondary">{tc.new}</td>
                    <td className="py-3 px-4 text-center text-text-secondary">{tc.cold}</td>
                    <td className="py-3 px-4 text-center text-text-secondary">{tc.warm}</td>
                    <td className="py-3 px-4 text-center text-text-secondary">{tc.hot}</td>
                    <td className="py-3 px-4 text-center font-bold text-accent-red">{tc.immediate}</td>
                    <td className="py-3 px-4 text-center text-text-secondary">{tc.skipped}</td>
                  </tr>
                ))}
                {telecallerData.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-text-muted italic">
                      No leads have been assigned to your telecallers yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
