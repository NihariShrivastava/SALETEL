import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Loader2, PhoneCall, X, FileText, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { startOfDay, endOfDay } from 'date-fns';
import * as XLSX from 'xlsx';


interface SubmissionData {
  id: string;
  status: string;
  submitted_at: string;
  lead_status: string;
  lead_status_updated_at: string;
  admin_notes: string;
  data: any;
  form_templates: any;
  domains: { name: string } | null;
  surveyors: { id: string; username: string; full_name: string } | null;
  _bucket: string;
}

export default function LeadStatusCount() {
  const [isLoading, setIsLoading] = useState(true);
  const [submissions, setSubmissions] = useState<SubmissionData[]>([]);
  
  // Filters
  const [globalStartDate, setGlobalStartDate] = useState<string>('');
  const [globalEndDate, setGlobalEndDate] = useState<string>('');
  const [filterDomain, setFilterDomain] = useState<string>('all');
  const [filterSurveyor, setFilterSurveyor] = useState<string>('all');
  const [filterLeadStatus, setFilterLeadStatus] = useState<string>('all');

  // Modal State
  const [selectedStatusType, setSelectedStatusType] = useState<string | null>(null);
  const [selectedSub, setSelectedSub] = useState<SubmissionData | null>(null);

  const [counts, setCounts] = useState({
    total: 0,
    newLeads: 0,
    immediate: 0,
    hot: 0,
    warm: 0,
    cold: 0,
    skipped: 0,
    wrongNumber: 0,
    reverted: 0,
    closed: 0,
    deleted: 0
  });

  useEffect(() => {
    fetchCounts();
  }, []);

  const handleClearDates = () => {
    setGlobalStartDate('');
    setGlobalEndDate('');
    fetchCounts('', '');
  };

  const fetchCounts = async (start = globalStartDate, end = globalEndDate) => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('submissions')
        .select(`
          id,
          status,
          submitted_at,
          lead_status,
          lead_status_updated_at,
          admin_notes,
          data,
          form_templates(name, fields),
          domains(name),
          surveyors!surveyor_id(id, username, full_name)
        `);

      const parseLocalDate = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
      };

      if (start) {
        query = query.gte('submitted_at', startOfDay(parseLocalDate(start)).toISOString());
      }
      if (end) {
        query = query.lte('submitted_at', endOfDay(parseLocalDate(end)).toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      const rawSubs = data || [];
      const today = new Date();
      today.setHours(0,0,0,0);

      const subs: SubmissionData[] = rawSubs.map((sub: any) => {
        let ls = sub.lead_status || 'new';
        if (ls === 'skipped' && sub.lead_status_updated_at) {
          if (new Date(sub.lead_status_updated_at) < today) ls = 'new';
        }

        let bucket = '';
        if (sub.status === 'reverted') bucket = 'reverted';
        else if (ls === 'closed') bucket = 'closed';
        else bucket = ls;

        return { ...sub, _bucket: bucket } as SubmissionData;
      });

      setSubmissions(subs);
    } catch (error: any) {
      console.error('Error fetching lead counts:', error);
      toast.error('Failed to load lead status counts');
    } finally {
      setIsLoading(false);
    }
  };

  const exportToExcel = (dataList: SubmissionData[], filename: string) => {
    if (dataList.length === 0) {
      toast.error('No data to export');
      return;
    }

    const sortedDataList = [...dataList].sort((a, b) => a._bucket.localeCompare(b._bucket));
    const dataToExport = sortedDataList.map(sub => {
      let tName = 'Unknown';
      if (sub.form_templates) {
        tName = Array.isArray(sub.form_templates) ? (sub.form_templates[0] as any)?.name : (sub.form_templates as any)?.name;
      }

      const row: any = {
        'ID': sub.id.split('-')[0].toUpperCase(),
        'Submitted At': new Date(sub.submitted_at).toLocaleString(),
        'Surveyor': (sub.surveyors as any)?.full_name || (sub.surveyors as any)?.username || 'Unknown',
        'Domain': (sub.domains as any)?.name || 'Unassigned',
        'Template': tName,
        'Form Status': sub.status,
        'Lead Status': sub._bucket.replace('_', ' ').toUpperCase(),
        'Remarks': sub.admin_notes || '-'
      };

      if (sub.data && typeof sub.data === 'object') {
        const templates: any = sub.form_templates;
        const fieldsData = Array.isArray(templates) ? templates[0]?.fields : templates?.fields;
        
        for (const [k, v] of Object.entries(sub.data)) {
          let label = k;
          if (fieldsData) {
             const fieldConfig = (fieldsData as any[]).find((f: any) => f.id === k);
             if (fieldConfig && fieldConfig.label) {
               label = fieldConfig.label;
             }
          }

          if (typeof v === 'object' && v !== null) {
            if ('lat' in v && 'lng' in v) {
              row[label] = `Lat: ${(v as any).lat}, Lng: ${(v as any).lng}`;
            } else if (Array.isArray(v)) {
              row[label] = v.join(', ');
            } else {
              row[label] = JSON.stringify(v);
            }
          } else {
            row[label] = v;
          }
        }
      }

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');
    XLSX.writeFile(workbook, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Compute filtered counts
  const filteredSubmissions = submissions.filter(sub => {
    const domainMatch = filterDomain === 'all' || (sub.domains as any)?.name === filterDomain;
    const surveyorMatch = filterSurveyor === 'all' || (sub.surveyors as any)?.id === filterSurveyor;
    const statusMatch = filterLeadStatus === 'all' || sub._bucket === filterLeadStatus;
    return domainMatch && surveyorMatch && statusMatch;
  });

  const currentCounts = {
    total: filteredSubmissions.length,
    newLeads: filteredSubmissions.filter(s => s._bucket === 'new').length,
    immediate: filteredSubmissions.filter(s => s._bucket === 'immediate').length,
    hot: filteredSubmissions.filter(s => s._bucket === 'hot').length,
    warm: filteredSubmissions.filter(s => s._bucket === 'warm').length,
    cold: filteredSubmissions.filter(s => s._bucket === 'cold').length,
    skipped: filteredSubmissions.filter(s => s._bucket === 'skipped').length,
    wrongNumber: filteredSubmissions.filter(s => s._bucket === 'wrong_number').length,
    reverted: filteredSubmissions.filter(s => s._bucket === 'reverted').length,
    closed: filteredSubmissions.filter(s => s._bucket === 'closed').length,
    deleted: filteredSubmissions.filter(s => s._bucket === 'deleted').length,
  };

  const domainOptions = Array.from(new Set(submissions.map(s => (s.domains as any)?.name).filter(Boolean))).sort();
  const surveyorOptions = Array.from(new Map<string, string>(submissions.map(s => {
    const surv = s.surveyors as any;
    return [(surv?.id as string), (surv?.full_name || surv?.username || 'Unknown') as string] as [string, string];
  }).filter(([id]) => id)).entries()).sort((a, b) => a[1].localeCompare(b[1]));

  const statusListSubs = selectedStatusType === 'total' 
    ? filteredSubmissions 
    : filteredSubmissions.filter(s => s._bucket === selectedStatusType);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <PhoneCall className="w-6 h-6 text-accent-blue" />
            Lead Status Count
          </h2>
          <p className="text-text-secondary text-sm mt-1">Overview of all active and historic lead dispositions across the system.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 flex-wrap justify-end">
          <div className="flex items-center gap-2 bg-bg-primary border border-bg-border rounded-lg px-2 py-1">
            <span className="text-xs text-text-muted font-medium ml-1 uppercase tracking-widest">Date Range:</span>
            <input 
              type="date" 
              className="bg-transparent border-none text-white text-sm focus:outline-none [color-scheme:dark]"
              value={globalStartDate}
              onChange={(e) => setGlobalStartDate(e.target.value)}
            />
            <span className="text-text-muted">-</span>
            <input 
              type="date" 
              className="bg-transparent border-none text-white text-sm focus:outline-none [color-scheme:dark]"
              value={globalEndDate}
              onChange={(e) => setGlobalEndDate(e.target.value)}
            />
            <button
              onClick={handleClearDates}
              className="ml-1 px-3 py-1 bg-bg-secondary text-text-muted hover:text-white hover:bg-bg-border text-xs font-semibold rounded-md transition-colors"
            >
              Clear
            </button>
            <button
              onClick={() => fetchCounts()}
              className="ml-2 px-3 py-1 bg-accent-blue/10 text-accent-blue hover:bg-accent-blue hover:text-white text-xs font-semibold rounded-md transition-colors"
            >
              Apply
            </button>
          </div>
          <Button onClick={() => exportToExcel(filteredSubmissions, 'SALETEL_All_Leads')} className="bg-accent-green hover:bg-accent-green/90 text-white border-transparent shadow-lg shadow-accent-green/20">
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <select 
          className="bg-bg-secondary border border-bg-border text-white text-sm rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-accent-blue outline-none"
          value={filterDomain}
          onChange={(e) => setFilterDomain(e.target.value)}
        >
          <option value="all">All Domains</option>
          {domainOptions.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        
        <select 
          className="bg-bg-secondary border border-bg-border text-white text-sm rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-accent-blue outline-none"
          value={filterSurveyor}
          onChange={(e) => setFilterSurveyor(e.target.value)}
        >
          <option value="all">All Surveyors</option>
          {surveyorOptions.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>

        <select 
          className="bg-bg-secondary border border-bg-border text-white text-sm rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-accent-blue outline-none"
          value={filterLeadStatus}
          onChange={(e) => setFilterLeadStatus(e.target.value)}
        >
          <option value="all">All Lead Status</option>
          <option value="new">New / Pending</option>
          <option value="immediate">Immediate Action</option>
          <option value="hot">Hot</option>
          <option value="warm">Warm</option>
          <option value="cold">Cold</option>
          <option value="skipped">Skipped</option>
          <option value="wrong_number">Wrong Number</option>
          <option value="reverted">Reverted</option>
          <option value="closed">Closed</option>
          <option value="deleted">Deleted</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-[30vh]">
          <Loader2 className="w-8 h-8 animate-spin text-accent-blue mb-4" />
          <p className="text-text-muted font-medium">Loading status counts...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <Card className="p-5 border-l-4 border-l-white cursor-pointer hover:bg-bg-hover/50 transition-colors" onClick={() => setSelectedStatusType('total')}>
            <div className="text-xs text-text-secondary uppercase tracking-wider font-semibold mb-1">Total Leads</div>
            <div className="text-3xl font-bold text-white tracking-tight">{currentCounts.total.toLocaleString()}</div>
          </Card>
          
          <Card className="p-5 border-l-4 border-l-text-muted cursor-pointer hover:bg-bg-hover/50 transition-colors" onClick={() => setSelectedStatusType('new')}>
            <div className="text-xs text-text-secondary uppercase tracking-wider font-semibold mb-1">New / Pending</div>
            <div className="text-3xl font-bold text-white tracking-tight">{currentCounts.newLeads.toLocaleString()}</div>
          </Card>

          <Card className="p-5 border-l-4 border-l-accent-red cursor-pointer hover:bg-bg-hover/50 transition-colors" onClick={() => setSelectedStatusType('immediate')}>
            <div className="text-xs text-accent-red uppercase tracking-wider font-semibold mb-1">Immediate Action</div>
            <div className="text-3xl font-bold text-accent-red tracking-tight">{currentCounts.immediate.toLocaleString()}</div>
          </Card>

          <Card className="p-5 border-l-4 border-l-accent-red cursor-pointer hover:bg-bg-hover/50 transition-colors" onClick={() => setSelectedStatusType('hot')}>
            <div className="text-xs text-accent-red uppercase tracking-wider font-semibold mb-1">Hot</div>
            <div className="text-3xl font-bold text-accent-red tracking-tight">{currentCounts.hot.toLocaleString()}</div>
          </Card>

          <Card className="p-5 border-l-4 border-l-accent-yellow cursor-pointer hover:bg-bg-hover/50 transition-colors" onClick={() => setSelectedStatusType('warm')}>
            <div className="text-xs text-accent-yellow uppercase tracking-wider font-semibold mb-1">Warm</div>
            <div className="text-3xl font-bold text-accent-yellow tracking-tight">{currentCounts.warm.toLocaleString()}</div>
          </Card>

          <Card className="p-5 border-l-4 border-l-accent-blue cursor-pointer hover:bg-bg-hover/50 transition-colors" onClick={() => setSelectedStatusType('cold')}>
            <div className="text-xs text-accent-blue uppercase tracking-wider font-semibold mb-1">Cold</div>
            <div className="text-3xl font-bold text-accent-blue tracking-tight">{currentCounts.cold.toLocaleString()}</div>
          </Card>

          <Card className="p-5 border-l-4 border-l-purple-500 cursor-pointer hover:bg-bg-hover/50 transition-colors" onClick={() => setSelectedStatusType('skipped')}>
            <div className="text-xs text-purple-400 uppercase tracking-wider font-semibold mb-1">Skipped</div>
            <div className="text-3xl font-bold text-purple-400 tracking-tight">{currentCounts.skipped.toLocaleString()}</div>
          </Card>

          <Card className="p-5 border-l-4 border-l-orange-500 cursor-pointer hover:bg-bg-hover/50 transition-colors" onClick={() => setSelectedStatusType('wrong_number')}>
            <div className="text-xs text-orange-400 uppercase tracking-wider font-semibold mb-1">Wrong Number</div>
            <div className="text-3xl font-bold text-orange-400 tracking-tight">{currentCounts.wrongNumber.toLocaleString()}</div>
          </Card>

          <Card className="p-5 border-l-4 border-l-purple-400 cursor-pointer hover:bg-bg-hover/50 transition-colors" onClick={() => setSelectedStatusType('reverted')}>
            <div className="text-xs text-purple-400 uppercase tracking-wider font-semibold mb-1">Reverted</div>
            <div className="text-3xl font-bold text-purple-400 tracking-tight">{currentCounts.reverted.toLocaleString()}</div>
          </Card>

          <Card className="p-5 border-l-4 border-l-accent-green cursor-pointer hover:bg-bg-hover/50 transition-colors" onClick={() => setSelectedStatusType('closed')}>
            <div className="text-xs text-accent-green uppercase tracking-wider font-semibold mb-1">Closed</div>
            <div className="text-3xl font-bold text-accent-green tracking-tight">{currentCounts.closed.toLocaleString()}</div>
          </Card>

          <Card className="p-5 border-l-4 border-l-red-500 cursor-pointer hover:bg-bg-hover/50 transition-colors" onClick={() => setSelectedStatusType('deleted')}>
            <div className="text-xs text-red-400 uppercase tracking-wider font-semibold mb-1">Deleted</div>
            <div className="text-3xl font-bold text-red-500 tracking-tight">{currentCounts.deleted.toLocaleString()}</div>
          </Card>
        </div>
      )}

      {/* List Modal */}
      {selectedStatusType && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-secondary w-full max-w-5xl max-h-[85vh] rounded-xl border border-bg-border shadow-2xl flex flex-col overflow-hidden">
            <div className="p-5 border-b border-bg-border flex justify-between items-center bg-bg-primary shrink-0">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <PhoneCall className="w-5 h-5 text-accent-blue" />
                  {selectedStatusType === 'total' ? 'All Leads' : `${selectedStatusType.replace('_', ' ').toUpperCase()} Leads`}
                </h3>
                <p className="text-xs text-text-secondary mt-1">Found {statusListSubs.length} leads</p>
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={() => exportToExcel(statusListSubs, `SALETEL_${selectedStatusType?.toUpperCase()}_Leads`)} size="sm" className="bg-accent-green hover:bg-accent-green/90 text-white">
                  <Download className="w-4 h-4 mr-2" />
                  Export Excel
                </Button>
                <button onClick={() => setSelectedStatusType(null)} className="text-text-muted hover:text-white p-2 rounded-full hover:bg-bg-secondary transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap text-sm">
                <thead className="sticky top-0 bg-bg-secondary z-10 border-b border-bg-border shadow-sm">
                  <tr className="text-text-muted text-[10px] uppercase tracking-widest">
                    <th className="py-3 px-4 font-semibold">ID</th>
                    <th className="py-3 px-4 font-semibold">Surveyor</th>
                    <th className="py-3 px-4 font-semibold">Domain</th>
                    <th className="py-3 px-4 font-semibold">Lead Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {statusListSubs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-text-muted italic">No leads found in this category.</td>
                    </tr>
                  ) : (
                    statusListSubs.map((sub, i) => (
                      <tr key={sub.id || i} className="border-b border-bg-border last:border-0 hover:bg-bg-hover/50 transition-colors">
                        <td className="py-3 px-4 text-white font-medium">{sub.id.split('-')[0].toUpperCase()}</td>
                        <td className="py-3 px-4 text-white">{(sub.surveyors as any)?.full_name || (sub.surveyors as any)?.username || 'Unknown'}</td>
                        <td className="py-3 px-4 text-text-secondary">{(sub.domains as any)?.name || 'Unassigned'}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                            sub._bucket === 'new' ? 'bg-bg-primary text-text-secondary border border-bg-border' :
                            sub._bucket === 'cold' ? 'bg-accent-blue/10 text-accent-blue' :
                            sub._bucket === 'warm' ? 'bg-accent-yellow/10 text-accent-yellow' :
                            sub._bucket === 'hot' ? 'bg-accent-red/10 text-accent-red' :
                            sub._bucket === 'skipped' ? 'bg-purple-500/10 text-purple-400' :
                            sub._bucket === 'closed' ? 'bg-accent-green/10 text-accent-green' :
                            sub._bucket === 'immediate' ? 'bg-accent-red/10 text-accent-red' :
                            sub._bucket === 'wrong_number' ? 'bg-orange-500/10 text-orange-400' :
                            'bg-bg-primary text-text-muted border border-bg-border'
                          }`}>
                            {sub._bucket.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedSub(sub)}>
                            View Form
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Read-Only Modal Detail Panel */}
      {selectedSub && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-bg-secondary w-full max-w-2xl max-h-[85vh] rounded-xl border border-bg-border shadow-2xl flex flex-col overflow-hidden">
            <div className="p-5 border-b border-bg-border flex justify-between items-center bg-bg-primary shrink-0">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-accent-blue" />
                  Submission Details
                </h3>
                <p className="text-xs text-text-secondary mt-1">ID: {selectedSub.id}</p>
              </div>
              <button onClick={() => setSelectedSub(null)} className="text-text-muted hover:text-white p-2 rounded-full hover:bg-bg-secondary transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-bold text-white leading-tight">
                  {(selectedSub.surveyors as any)?.full_name || (selectedSub.surveyors as any)?.username}
                </h2>
                <div className="flex gap-2 mt-2">
                  <span className="px-2 py-1 rounded bg-accent-blue/10 text-accent-blue text-xs font-semibold">
                    {(selectedSub.domains as any)?.name}
                  </span>
                </div>
              </div>
              <div>
                <span className={`px-2 py-1 rounded-full text-xs uppercase font-bold tracking-wider ${
                  selectedSub.status === 'approved' ? 'bg-accent-green/20 text-accent-green' :
                  selectedSub.status === 'reverted' ? 'bg-accent-yellow/20 text-accent-yellow' :
                  'bg-accent-blue/20 text-accent-blue'
                }`}>{selectedSub.status}</span>
              </div>
            </div>

            <div className="text-xs text-text-muted uppercase tracking-widest border-b border-bg-border pb-2">Submitted Data</div>
            
            <div className="space-y-4">
              {(() => {
                if (!selectedSub.data || Object.keys(selectedSub.data).length === 0) {
                  return <div className="text-text-muted italic text-sm">No data entries found.</div>;
                }

                let entriesToRender: {key: string, label: string, value: any}[] = [];
                const templates = selectedSub.form_templates;
                const fieldsData = Array.isArray(templates) ? templates[0]?.fields : templates?.fields;

                if (fieldsData) {
                   entriesToRender = (fieldsData as any[])
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

            {selectedSub.admin_notes && (
              <div className="pt-4 space-y-2">
                <label className="text-xs text-text-muted uppercase tracking-widest font-semibold">Remarks / Revert Reason</label>
                <div className="w-full bg-bg-primary border border-bg-border rounded-lg p-3 text-white text-sm">
                  {selectedSub.admin_notes}
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
