import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { FileText, CalendarDays, History, ArrowRight, Loader2, X, ChevronDown, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';

export default function SurveyorDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [assignedDomains, setAssignedDomains] = useState<{id: string, name: string}[]>([]);
  const [activeDomainId, setActiveDomainId] = useState<string | null>(null);
  const [isDomainDropdownOpen, setIsDomainDropdownOpen] = useState(false);
  
  const [assignedTemplates, setAssignedTemplates] = useState<{id: string, name: string}[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [domainName, setDomainName] = useState('Loading...');
  
  const [allSubmissions, setAllSubmissions] = useState<any[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<any[]>([]);
  const [selectedSub, setSelectedSub] = useState<any | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'reverted' | 'approved'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [domainFilter, setDomainFilter] = useState('all');
  const [templateFilter, setTemplateFilter] = useState('all');

  // Initial load to fetch domains and templates
  useEffect(() => {
    if (!user) return;
    
    const fetchAssignedData = async () => {
      try {
        const domainIdsToFetch = user.assigned_domains || [];

        if (domainIdsToFetch.length === 0) {
          setIsLoading(false);
          return;
        }

        const { data: domainsData } = await supabase
          .from('domains')
          .select('id, name')
          .in('id', domainIdsToFetch);

        if (domainsData) {
          setAssignedDomains(domainsData);
          if (domainsData.length > 0 && !activeDomainId) {
            setActiveDomainId(domainsData[0].id);
            setDomainName(domainsData[0].name);
          }
        }
        
        // Fetch Submissions History
        const { data: subs, error } = await supabase
          .from('submissions')
          .select('id, submitted_at, status, data, admin_notes, domain_id, form_template_id, form_templates(name, fields)')
          .eq('surveyor_id', user.id)
          .order('submitted_at', { ascending: false });
          
        if (!error && subs) {
          setAllSubmissions(subs);
        }

      } catch (err) {
        console.error('Failed to fetch assigned data', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAssignedData();
  }, [user]);

  // Fetch templates when domain changes
  useEffect(() => {
    if (!user || !activeDomainId) return;

    const fetchTemplates = async () => {
      const templateIds = user.assigned_template_ids || [];
      if (templateIds.length === 0) {
        setAssignedTemplates([]);
        setActiveTemplateId(null);
        return;
      }
      
      const { data: tData } = await supabase
        .from('form_templates')
        .select('id, name')
        .eq('domain_id', activeDomainId)
        .in('id', templateIds);
        
      if (tData) {
        setAssignedTemplates(tData);
        if (tData.length > 0) {
          setActiveTemplateId(tData[0].id);
        } else {
          setActiveTemplateId(null);
        }
      }
    };
    
    fetchTemplates();
  }, [user, activeDomainId]);

  // Apply filters to submissions
  useEffect(() => {
    let filtered = [...allSubmissions];

    if (activeTab === 'pending') {
      filtered = filtered.filter(s => s.status === 'submitted');
    } else if (activeTab === 'reverted') {
      filtered = filtered.filter(s => s.status === 'reverted');
    } else if (activeTab === 'approved') {
      filtered = filtered.filter(s => s.status === 'approved' || s.status === 'reviewed');
    }

    if (domainFilter !== 'all') {
      filtered = filtered.filter(s => s.domain_id === domainFilter);
    }
    
    if (templateFilter !== 'all') {
      filtered = filtered.filter(s => s.form_template_id === templateFilter);
    }

    if (dateFilter !== 'all') {
      const now = new Date();
      let start = startOfDay(now);
      if (dateFilter === 'week') {
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        start = startOfDay(start);
      } else if (dateFilter === 'month') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      
      filtered = filtered.filter(s => {
        const date = new Date(s.submitted_at);
        return date >= start && date <= endOfDay(now);
      });
    }

    setFilteredSubmissions(filtered);
  }, [allSubmissions, dateFilter, domainFilter, templateFilter, activeTab]);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent-blue" />
      </div>
    );
  }

  const startFillForm = () => {
    if (!activeDomainId || !activeTemplateId) return;
    navigate(`/surveyor/fill?domainId=${activeDomainId}&templateId=${activeTemplateId}`);
  };

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-bg-secondary border border-bg-border rounded-2xl p-8 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-blue/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        
        <div className="relative z-10 space-y-4 text-center md:text-left flex-1">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <h2 className="text-3xl font-bold text-white tracking-tight">Ready for your next task?</h2>
            
            {assignedDomains.length > 0 && (
              <div className="relative">
                <button 
                  onClick={() => setIsDomainDropdownOpen(!isDomainDropdownOpen)}
                  className="flex items-center gap-2 bg-bg-primary border border-bg-border hover:border-accent-blue px-4 py-2 rounded-lg text-sm text-white font-medium transition-colors"
                >
                  <span className="text-accent-blue">Domain:</span> {domainName}
                  <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${isDomainDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isDomainDropdownOpen && (
                  <div className="absolute top-full mt-2 w-full min-w-[200px] bg-bg-primary border border-bg-border rounded-lg shadow-xl z-50 left-0">
                    {assignedDomains.map(d => (
                      <button
                        key={d.id}
                        onClick={() => {
                          setActiveDomainId(d.id);
                          setDomainName(d.name);
                          setIsDomainDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                          activeDomainId === d.id 
                            ? 'bg-accent-blue/10 text-accent-blue border-l-2 border-accent-blue font-medium' 
                            : 'text-text-secondary hover:bg-bg-hover hover:text-white border-l-2 border-transparent'
                        }`}
                      >
                        {d.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {assignedTemplates.length > 0 ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-text-secondary">Select Template:</span>
              <select 
                value={activeTemplateId || ''} 
                onChange={e => setActiveTemplateId(e.target.value)}
                className="bg-bg-primary border border-bg-border text-white text-sm rounded-lg px-3 py-2 focus:border-accent-blue focus:outline-none"
              >
                {assignedTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-sm text-accent-red">No templates assigned for this domain.</p>
          )}
        </div>
        
        <div className="relative z-10 w-full md:w-auto">
          <Button 
            className="w-full md:w-auto py-4 px-8 text-lg bg-gradient-to-r from-accent-blue to-accent-purple hover:from-accent-blue/90 hover:to-accent-purple/90 border-transparent shadow-[0_0_20px_rgba(79,110,247,0.3)]"
            onClick={startFillForm}
            disabled={!activeDomainId || !activeTemplateId}
          >
            Fill New Form <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
          <h3 className="text-sm font-semibold text-white uppercase tracking-widest">Submission History & Filters</h3>
          <div className="flex flex-wrap items-center gap-3">
            <select value={dateFilter} onChange={e => setDateFilter(e.target.value as any)} className="bg-bg-primary border border-bg-border text-text-secondary text-xs rounded-lg px-3 py-2 focus:outline-none">
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Past 7 Days</option>
              <option value="month">This Month</option>
            </select>
            <select value={domainFilter} onChange={e => setDomainFilter(e.target.value)} className="bg-bg-primary border border-bg-border text-text-secondary text-xs rounded-lg px-3 py-2 focus:outline-none">
              <option value="all">All Domains</option>
              {assignedDomains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={templateFilter} onChange={e => setTemplateFilter(e.target.value)} className="bg-bg-primary border border-bg-border text-text-secondary text-xs rounded-lg px-3 py-2 focus:outline-none">
              <option value="all">All Templates</option>
              {Array.from(new Set(allSubmissions.map(s => s.form_template_id))).map(tId => {
                const sub = allSubmissions.find(s => s.form_template_id === tId);
                return <option key={tId} value={tId}>{sub?.form_templates?.name || 'Unknown Template'}</option>
              })}
            </select>
          </div>
        </div>

        <div className="flex gap-2 border-b border-bg-border pb-px mb-4">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'all' ? 'border-accent-blue text-white' : 'border-transparent text-text-secondary hover:text-white'}`}
          >
            All Forms
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'pending' ? 'border-accent-yellow text-white' : 'border-transparent text-text-secondary hover:text-white'}`}
          >
            Pending Approval
          </button>
          <button
            onClick={() => setActiveTab('reverted')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'reverted' ? 'border-accent-red text-white' : 'border-transparent text-text-secondary hover:text-white'}`}
          >
            Reverted
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'approved' ? 'border-accent-green text-white' : 'border-transparent text-text-secondary hover:text-white'}`}
          >
            Approved
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
          <Card className="flex items-center gap-4 bg-bg-secondary/50">
            <div className="p-3 rounded-lg bg-accent-blue/10">
              <FileText className="w-6 h-6 text-accent-blue" />
            </div>
            <div>
              <p className="text-xs text-text-secondary uppercase tracking-widest font-medium">Filtered Results</p>
              <h4 className="text-2xl font-bold text-white leading-none mt-1">{filteredSubmissions.length}</h4>
            </div>
          </Card>
        </div>
        
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-bg-primary/50 text-text-muted text-[10px] uppercase tracking-widest border-b border-bg-border">
                <th className="py-3 px-5 font-semibold">Date / Time</th>
                <th className="py-3 px-5 font-semibold">Template</th>
                <th className="py-3 px-5 font-semibold">Status</th>
                <th className="py-3 px-5 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubmissions.map((sub, i) => (
                <tr key={i} className="border-b border-bg-border last:border-0 hover:bg-bg-hover/50 transition-colors">
                  <td className="py-3 px-5 text-text-secondary font-medium">{format(new Date(sub.submitted_at), 'MMM dd, yyyy hh:mm a')}</td>
                  <td className="py-3 px-5 text-white">{sub.form_templates?.name || 'Unknown'}</td>
                  <td className="py-3 px-5">
                    <Badge variant={
                      sub.status === 'submitted' ? 'blue' :
                      sub.status === 'approved' ? 'green' : 
                      sub.status === 'rejected' ? 'red' : 
                      sub.status === 'reverted' ? 'yellow' : 'gray'
                    }>
                      {sub.status === 'reverted' ? 'Reverted' : sub.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-5 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedSub(sub)}>View</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredSubmissions.length === 0 && (
            <div className="p-8 text-center text-text-muted text-sm">
              No submissions match your filters.
            </div>
          )}
        </Card>
      </div>

      {/* Submission Detail Modal */}
      {selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col p-0 border-accent-blue/50 shadow-2xl shadow-accent-blue/10">
            <div className="p-4 border-b border-bg-border flex justify-between items-center bg-bg-secondary">
              <h3 className="font-bold text-white">Submission Details</h3>
              <button onClick={() => setSelectedSub(null)} className="text-text-muted hover:text-white p-1 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 bg-bg-secondary">
              <div className="flex justify-between items-center pb-4 border-b border-bg-border">
                <span className="text-text-secondary text-sm font-medium">{format(new Date(selectedSub.submitted_at), 'MMM dd, yyyy hh:mm a')}</span>
                <Badge variant={
                  selectedSub.status === 'submitted' ? 'blue' : 
                  selectedSub.status === 'approved' ? 'green' : 
                  selectedSub.status === 'rejected' ? 'red' : 
                  selectedSub.status === 'reverted' ? 'yellow' : 'gray'
                }>
                  {selectedSub.status === 'reverted' ? 'Reverted' : selectedSub.status}
                </Badge>
              </div>
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
                    <div key={key} className="bg-bg-primary rounded-lg border border-bg-border p-3">
                      <span className="block text-[10px] uppercase text-text-secondary mb-1 font-semibold tracking-widest">{label}</span>
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
              
              {selectedSub.admin_notes && (
                <div className="pt-4 mt-4 border-t border-bg-border">
                  <h4 className="text-[10px] uppercase tracking-widest text-text-muted font-semibold mb-2">Admin Notes</h4>
                  <div className="bg-bg-primary rounded-lg p-4 text-sm text-text-secondary border border-bg-border">
                    {selectedSub.admin_notes}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
