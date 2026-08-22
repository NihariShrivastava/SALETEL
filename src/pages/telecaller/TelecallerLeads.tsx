import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ArrowLeft, Loader2, Search, Calendar, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import LeadViewModal from '../../components/telecaller/LeadViewModal';
import { format } from 'date-fns';

const bucketNames: Record<string, string> = {
  new: 'New Leads',
  immediate: 'Immediate Leads',
  hot: 'Hot Leads',
  warm: 'Warm Leads',
  cold: 'Cold Leads',
  skipped: 'Call Skipped / Not Connected',
  wrong_number: 'Wrong Number'
};

export default function TelecallerLeads() {
  const { status } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [leads, setLeads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLeads = async () => {
    if (!user || !status) return;
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

        const filtered = data.filter(lead => {
          let currentStatus = lead.lead_status || 'new';
          
          if (currentStatus === 'skipped' && lead.lead_status_updated_at) {
            const updatedDate = new Date(lead.lead_status_updated_at);
            if (updatedDate < today) {
              currentStatus = 'new';
            }
          }
          
          return currentStatus === status;
        });

        setLeads(filtered);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [user, status]);

  const filteredLeads = leads.filter(l => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const surveyorName = l.surveyor?.full_name?.toLowerCase() || '';
    const templateName = l.form_templates?.name?.toLowerCase() || '';
    return surveyorName.includes(search) || templateName.includes(search) || JSON.stringify(l.data).toLowerCase().includes(search);
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/telecaller/dashboard')} className="text-text-muted hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              {bucketNames[status || ''] || 'Leads'}
              <span className="bg-bg-primary text-text-secondary px-2 py-0.5 rounded-full text-sm border border-bg-border">
                {leads.length}
              </span>
            </h2>
            <p className="text-sm text-text-secondary mt-1">Review and action your assigned leads.</p>
          </div>
        </div>
        
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input 
            type="text" 
            placeholder="Search leads..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-bg-secondary border border-bg-border rounded-lg text-sm text-white focus:outline-none focus:border-accent-blue"
          />
        </div>
      </div>

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
                  <th className="py-3 px-5 font-semibold">Form / Date</th>
                  <th className="py-3 px-5 font-semibold">Surveyor</th>
                  <th className="py-3 px-5 font-semibold">Remark</th>
                  <th className="py-3 px-5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map(lead => (
                  <tr key={lead.id} className="border-b border-bg-border last:border-0 hover:bg-bg-hover/50 transition-colors">
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-2 text-white font-medium mb-1">
                        <FileText className="w-4 h-4 text-accent-blue" />
                        {lead.form_templates?.name || 'Unknown Form'}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-text-muted">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(lead.submitted_at), 'MMM dd, yyyy')}
                      </div>
                    </td>
                    <td className="py-4 px-5 text-text-secondary">
                      {lead.surveyor?.full_name || 'Unknown'}
                    </td>
                    <td className="py-4 px-5">
                      {lead.telecaller_remark ? (
                        <span className="text-text-secondary italic text-xs max-w-[200px] truncate block" title={lead.telecaller_remark}>
                          "{lead.telecaller_remark}"
                        </span>
                      ) : (
                        <span className="text-text-muted text-xs">-</span>
                      )}
                    </td>
                    <td className="py-4 px-5 text-right">
                      <Button variant="outline" size="sm" onClick={() => setSelectedLead(lead)} className="text-accent-blue border-accent-blue/30 hover:bg-accent-blue/10">
                        View Lead
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredLeads.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-text-muted italic">
                      No leads found in this bucket.
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
