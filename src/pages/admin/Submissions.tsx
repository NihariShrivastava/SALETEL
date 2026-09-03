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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [domains, setDomains] = useState<any[]>([]);
  const [fileHandlers, setFileHandlers] = useState<any[]>([]);
  const [fileForms, setFileForms] = useState<any[]>([]);

  const [selectedFileHandler, setSelectedFileHandler] = useState('all');
  const [selectedFileForm, setSelectedFileForm] = useState('all');
  
  const [selectedSub, setSelectedSub] = useState<any | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [subsRes, domainsRes, fhRes, formsRes] = await Promise.all([
        supabase.from('submissions').select('*, surveyors!surveyor_id(full_name), domains(id, name), form_templates(fields), file_submissions(file_handler_id, file_form_template_id)').order('submitted_at', { ascending: false }),
        supabase.from('domains').select('id, name').or('is_deleted.is.null,is_deleted.eq.false'),
        supabase.from('surveyors').select('id, full_name, user_roles!inner(name)').ilike('user_roles.name', '%File Handler%'),
        supabase.from('file_form_templates').select('id, name').eq('is_active', true).or('is_deleted.is.null,is_deleted.eq.false')
      ]);

      if (subsRes.error) throw subsRes.error;
      if (domainsRes.error) throw domainsRes.error;

      setSubmissions(subsRes.data || []);
      setDomains(domainsRes.data || []);
      setFileHandlers(fhRes.data || []);
      setFileForms(formsRes.data || []);
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



  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted': return <Badge variant="blue">Submitted</Badge>;
      case 'reviewed': return <Badge variant="yellow">Reviewed</Badge>;
      case 'rejected': return <Badge variant="red">Rejected</Badge>;
      default: return <Badge variant="gray">{status}</Badge>;
    }
  };

  const filteredSubmissions = submissions.filter(sub => {
    const matchesSearch = (sub.surveyors?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || sub.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDomain = selectedDomain === 'all' || sub.domain_id === selectedDomain;
    const matchesStatus = selectedStatus === 'all' || sub.status === selectedStatus;
    
    let matchesFH = true;
    if (selectedFileHandler !== 'all') {
      matchesFH = sub.file_submissions && Array.isArray(sub.file_submissions) && sub.file_submissions.some((fs: any) => fs.file_handler_id === selectedFileHandler);
    }

    let matchesFF = true;
    if (selectedFileForm !== 'all') {
      matchesFF = sub.file_submissions && Array.isArray(sub.file_submissions) && sub.file_submissions.some((fs: any) => fs.file_form_template_id === selectedFileForm);
    }

    return matchesSearch && matchesDomain && matchesStatus && matchesFH && matchesFF;
  });

  const totalPages = Math.ceil(filteredSubmissions.length / itemsPerPage);
  const currentItems = filteredSubmissions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
                onChange={e => { setSelectedDomain(e.target.value); setCurrentPage(1); }}
              >
                <option value="all">All Domains</option>
                {domains.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <select 
                className="bg-bg-primary border border-bg-border text-text-secondary text-xs rounded-lg px-3 py-2 focus:border-accent-blue focus:outline-none"
                value={selectedStatus}
                onChange={e => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
              >
                <option value="all">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="rejected">Rejected</option>
              </select>
              <select 
                className="bg-bg-primary border border-bg-border text-text-secondary text-xs rounded-lg px-3 py-2 focus:border-accent-blue focus:outline-none"
                value={selectedFileForm}
                onChange={e => { setSelectedFileForm(e.target.value); setCurrentPage(1); }}
              >
                <option value="all">All File Forms</option>
                {fileForms.map(ff => (
                  <option key={ff.id} value={ff.id}>{ff.name}</option>
                ))}
              </select>
              <select 
                className="bg-bg-primary border border-bg-border text-text-secondary text-xs rounded-lg px-3 py-2 focus:border-accent-blue focus:outline-none"
                value={selectedFileHandler}
                onChange={e => { setSelectedFileHandler(e.target.value); setCurrentPage(1); }}
              >
                <option value="all">All File Handlers</option>
                {fileHandlers.map(fh => (
                  <option key={fh.id} value={fh.id}>{fh.full_name}</option>
                ))}
              </select>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input 
                type="text" 
                placeholder="Search surveyor or ID..."
                className="w-full bg-bg-primary border border-bg-border rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:border-accent-blue focus:outline-none"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
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
                  <th className="py-3 px-5 font-semibold">Form Status</th>
                  <th className="py-3 px-5 font-semibold">Lead Status</th>
                  <th className="py-3 px-5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.length > 0 ? currentItems.map((sub, i) => (
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
                    <td className="py-3 px-5">
                      <span className="inline-flex items-center px-2 py-1 rounded bg-bg-primary text-[10px] text-text-secondary border border-bg-border uppercase tracking-wider font-bold">
                        {sub.lead_status || 'NEW'}
                      </span>
                    </td>
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-bg-border bg-bg-primary shrink-0">
              <div className="text-sm text-text-muted">
                Showing <span className="text-white font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-white font-medium">{Math.min(currentPage * itemsPerPage, filteredSubmissions.length)}</span> of <span className="text-white font-medium">{filteredSubmissions.length}</span> results
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="bg-bg-secondary text-white border border-bg-border hover:bg-bg-border disabled:opacity-50 text-xs px-3 py-1 rounded-md transition-colors"
                >
                  Previous
                </button>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="bg-bg-secondary text-white border border-bg-border hover:bg-bg-border disabled:opacity-50 text-xs px-3 py-1 rounded-md transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
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
              <div className="flex flex-col items-end gap-2">
                {getStatusBadge(selectedSub.status)}
                <span className="inline-flex items-center px-2 py-1 rounded bg-bg-primary text-[10px] text-text-secondary border border-bg-border uppercase tracking-wider font-bold">
                  {selectedSub.lead_status || 'NEW'}
                </span>
              </div>
            </div>

            <div className="text-xs text-text-muted uppercase tracking-widest border-b border-bg-border pb-2">Submitted Data</div>
            
            <div className="space-y-4">
              {(() => {
                if (!selectedSub.data || Object.keys(selectedSub.data).length === 0) {
                  return <div className="text-text-muted italic text-sm">No data entries found.</div>;
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
                });
              })()}
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

        </div>
      )}
    </div>
  );
}
