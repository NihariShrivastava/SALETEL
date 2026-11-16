import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { FolderOpen, FileCheck, Loader2, Plus, X, Trash2, Eye, RotateCcw, Filter, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import type { FileFormTemplate, FileSubmission, Submission } from '../../types';
import FormFieldRender from '../../components/form-builder/FormFieldRender';

const findValueByLabelRegex = (lead: any, regex: RegExp) => {
  if (!lead || !lead.data) return '-';
  
  const tmpl = Array.isArray(lead.form_templates) ? lead.form_templates[0] : lead.form_templates;
  if (tmpl && Array.isArray(tmpl.fields)) {
    const field = tmpl.fields.find((f: any) => regex.test(f.label));
    if (field && lead.data[field.id]) {
      return lead.data[field.id];
    }
  }
  
  if (typeof lead.data === 'object') {
    const key = Object.keys(lead.data).find(k => regex.test(k));
    if (key && lead.data[key]) return lead.data[key];
  }
  
  return '-';
};

export default function FileHandlerDashboard() {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'pending' | 'submitted' | 'cleared' | 'deleted'>('pending');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [isLoading, setIsLoading] = useState(true);

  // Filter States
  const [filterSurveyor, setFilterSurveyor] = useState('');
  const [filterTeamLead, setFilterTeamLead] = useState('');
  const [filterTelecaller, setFilterTelecaller] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, filterSurveyor, filterTeamLead, filterTelecaller, startDate, endDate]);
  const [pendingLeads, setPendingLeads] = useState<Submission[]>([]);
  const [submittedFiles, setSubmittedFiles] = useState<FileSubmission[]>([]);
  const [template, setTemplate] = useState<FileFormTemplate | null>(null);

  // Form handling
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Submission | null>(null);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [customFields, setCustomFields] = useState<{ id: string; question: string; answer: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchData = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      // Live sync profile for file handler
      const { data: freshFH } = await supabase
        .from('surveyors')
        .select('*, user_role:user_roles(name)')
        .eq('id', user.id)
        .single();

      const activeFileTemplateId = freshFH?.assigned_file_template_id || user.assigned_file_template_id;
      const activeTeamLeadIds = freshFH?.team_lead_ids || user.team_lead_ids || [];

      // 1. Fetch the assigned file form template
      if (activeFileTemplateId) {
        const { data: tplData } = await supabase
          .from('file_form_templates')
          .select('*')
          .eq('id', activeFileTemplateId)
          .single();
        if (tplData) setTemplate(tplData);
      }

      // Fetch team leads & assigned users map
      const { data: tlData } = await supabase
        .from('surveyors')
        .select('id, full_name, assigned_users, user_role:user_roles(name)');

      const tlNameMap = new Map<string, string>();
      if (tlData) {
        tlData.forEach(tl => {
          tlNameMap.set(tl.id, tl.full_name);
          if (tl.assigned_users && Array.isArray(tl.assigned_users)) {
            tl.assigned_users.forEach((sId: string) => {
              tlNameMap.set(sId, tl.full_name);
            });
          }
        });
      }

      // 2. Fetch File Submissions by this handler
      const { data: fsData, error: fsError } = await supabase
        .from('file_submissions')
        .select(`
          *,
          file_form_template:file_form_templates(*),
          original_lead:submissions(
            *,
            surveyor:surveyors!surveyor_id(id, full_name, username),
            telecaller:surveyors!telecaller_id(id, full_name, username),
            form_templates(name, fields)
          )
        `)
        .eq('file_handler_id', user.id)
        .order('updated_at', { ascending: false });

      if (fsError && fsError.code !== '42P01') throw fsError; // 42P01 is table does not exist

      const rawSubmitted = (fsData || []) as any[];
      const submittedLeadIds = rawSubmitted
        .map(fs => fs.original_lead_id)
        .filter(Boolean);

      // 3. Fetch Pending Leads (Closed by Team Leads assigned to this handler)
      let surveyorIds: string[] = [];
      if (activeTeamLeadIds && activeTeamLeadIds.length > 0) {
        tlData?.filter(tl => activeTeamLeadIds.includes(tl.id)).forEach(tl => {
          surveyorIds.push(tl.id);
          if (tl.assigned_users && Array.isArray(tl.assigned_users)) {
            surveyorIds = [...surveyorIds, ...tl.assigned_users];
          }
        });
        surveyorIds = Array.from(new Set(surveyorIds));
      }

      let leadsData: any[] = [];
      if (surveyorIds.length > 0) {
        let query = supabase
          .from('submissions')
          .select(`
            *,
            surveyor:surveyors!surveyor_id(id, full_name, username),
            telecaller:surveyors!telecaller_id(id, full_name, username),
            form_templates(name, fields)
          `)
          .eq('lead_status', 'closed')
          .in('surveyor_id', surveyorIds)
          .order('submitted_at', { ascending: false });

        const { data: ld } = await query;
        if (ld) leadsData = ld;
      }

      // Collect all lead IDs to fetch outreach call logs (to get the telecaller who actually called)
      const leadIdsForLogs = new Set<string>();
      leadsData.forEach((l: any) => leadIdsForLogs.add(l.id));
      rawSubmitted.forEach((fs: any) => {
        if (fs.original_lead_id) leadIdsForLogs.add(fs.original_lead_id);
      });

      const callersMap = new Map<string, string>();
      if (leadIdsForLogs.size > 0) {
        const { data: callLogs } = await supabase
          .from('lead_call_logs')
          .select('submission_id, created_at, telecaller:surveyors!telecaller_id(id, full_name, username)')
          .in('submission_id', Array.from(leadIdsForLogs))
          .order('created_at', { ascending: false });

        if (callLogs) {
          const callersByLead = new Map<string, string[]>();
          callLogs.forEach((log: any) => {
            const tc = Array.isArray(log.telecaller) ? log.telecaller[0] : log.telecaller;
            const callerName = tc?.full_name || tc?.username;
            if (callerName) {
              const existing = callersByLead.get(log.submission_id) || [];
              if (!existing.includes(callerName)) {
                existing.push(callerName);
                callersByLead.set(log.submission_id, existing);
              }
            }
          });
          callersByLead.forEach((callers, leadId) => {
            callersMap.set(leadId, callers.join(', '));
          });
        }
      }

      // Map submitted files with TL and telecaller who called
      const submitted = rawSubmitted.map(fs => {
        if (fs.original_lead) {
          fs.original_lead.tl_name = tlNameMap.get(fs.original_lead.surveyor_id) 
            || (fs.original_lead.reviewed_by ? tlNameMap.get(fs.original_lead.reviewed_by) : null) 
            || '-';
          fs.original_lead.telecaller_name = callersMap.get(fs.original_lead.id) 
            || fs.original_lead.telecaller?.full_name 
            || fs.original_lead.telecaller?.username 
            || '-';
        }
        return fs;
      }) as FileSubmission[];
      setSubmittedFiles(submitted);

      // Map pending leads with TL and telecaller who called
      const pending = leadsData
        .filter(lead => !submittedLeadIds.includes(lead.id))
        .map(lead => ({
          ...lead,
          tl_name: tlNameMap.get(lead.surveyor_id) 
            || (lead.reviewed_by ? tlNameMap.get(lead.reviewed_by) : null) 
            || 'Unknown TL',
          telecaller_name: callersMap.get(lead.id) 
            || lead.telecaller?.full_name 
            || lead.telecaller?.username 
            || '-'
        }));
      setPendingLeads(pending);
    } catch (err: any) {
      console.error(err);
      if (err.code === '42P01') {
         toast.error("Database schema not fully updated yet. Please ask the admin to run the SQL migration.");
      } else {
         toast.error('Failed to load dashboard data');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenForm = (lead: Submission) => {
    if (!template) {
      toast.error('No File Form assigned to you.');
      return;
    }
    setSelectedLead(lead);
    setFormData(lead.data || {});
    setCustomFields([]);
    setEditingFileId(null);
    setIsViewOnly(false);
    setIsFormOpen(true);
  };

  const handleEditFile = (fileSub: FileSubmission) => {
    if (fileSub.original_lead) {
      setSelectedLead(fileSub.original_lead);
    } else {
      setSelectedLead({
        id: 'new-file',
        data: {},
        form_templates: { name: 'Independent File' }
      } as any);
    }
    setFormData(fileSub.data.fields || {});
    setCustomFields(fileSub.data.custom_fields || []);
    setEditingFileId(fileSub.id);
    setIsViewOnly(false);
    setIsFormOpen(true);
  };

  const handleViewFile = (fileSub: FileSubmission) => {
    if (fileSub.original_lead) {
      setSelectedLead(fileSub.original_lead);
    } else {
      setSelectedLead({
        id: 'new-file',
        data: {},
        form_templates: { name: 'Independent File' }
      } as any);
    }
    setFormData(fileSub.data.fields || {});
    setCustomFields(fileSub.data.custom_fields || []);
    setEditingFileId(fileSub.id);
    setIsViewOnly(true);
    setIsFormOpen(true);
  };

  const handleNewFile = () => {
    if (!template) {
      toast.error('No File Form assigned to you.');
      return;
    }
    setSelectedLead({
      id: 'new-file',
      data: {},
      form_templates: { name: 'Independent File' }
    } as any);
    setFormData({});
    setCustomFields([]);
    setEditingFileId(null);
    setIsViewOnly(false);
    setIsFormOpen(true);
  };

  const handleClearFile = async (id: string) => {
    if (!window.confirm('Are you sure you want to CLEAR this file? It cannot be edited afterwards.')) return;
    try {
      const { error } = await supabase
        .from('file_submissions')
        .update({ status: 'cleared', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast.success('File cleared successfully');
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to clear file');
    }
  };

  const handleDeleteFile = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this file? It will be moved to Deleted Files.')) return;
    try {
      const { error } = await supabase
        .from('file_submissions')
        .update({ status: 'deleted', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast.success('File moved to Deleted Files');
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete file');
    }
  };

  const handleRestoreFile = async (id: string) => {
    try {
      const { error } = await supabase
        .from('file_submissions')
        .update({ status: 'submitted', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast.success('File restored to Open File Bucket');
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to restore file');
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to PERMANENTLY delete this file? This action cannot be undone.')) return;
    try {
      const { error } = await supabase
        .from('file_submissions')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('File permanently deleted');
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to permanently delete file');
    }
  };

  const addCustomField = () => {
    setCustomFields([...customFields, { id: Date.now().toString(), question: '', answer: '' }]);
  };

  const updateCustomField = (id: string, key: 'question' | 'answer', value: string) => {
    setCustomFields(customFields.map(f => f.id === id ? { ...f, [key]: value } : f));
  };

  const removeCustomField = (id: string) => {
    setCustomFields(customFields.filter(f => f.id !== id));
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !template || !selectedLead) return;
    setIsSubmitting(true);

    try {
      const payloadData = {
        fields: formData,
        custom_fields: customFields
      };

      if (editingFileId) {
        const { error } = await supabase
          .from('file_submissions')
          .update({ data: payloadData, updated_at: new Date().toISOString() })
          .eq('id', editingFileId);
        if (error) throw error;
        toast.success('File updated successfully!');
      } else {
        const payload: any = {
          file_form_template_id: template.id,
          file_handler_id: user.id,
          data: payloadData,
          status: 'submitted'
        };
        if (selectedLead.id !== 'new-file') {
          payload.original_lead_id = selectedLead.id;
        } else {
          payload.original_lead_id = null;
        }
        
        const { error } = await supabase
          .from('file_submissions')
          .insert(payload);
        if (error) throw error;
        toast.success('File submitted successfully!');
      }
      setIsFormOpen(false);
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to submit form: ' + (err.message || err.details || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openFiles = useMemo(() => submittedFiles.filter(f => f.status === 'submitted'), [submittedFiles]);
  const clearedFiles = useMemo(() => submittedFiles.filter(f => f.status === 'closed' || f.status === 'cleared'), [submittedFiles]);
  const deletedFiles = useMemo(() => submittedFiles.filter(f => f.status === 'deleted'), [submittedFiles]);

  const surveyorOptions = useMemo(() => {
    const set = new Set<string>();
    pendingLeads.forEach(l => {
      const name = l.surveyor?.full_name || l.surveyor?.username;
      if (name && name !== '-' && name !== 'Unknown') set.add(name);
    });
    submittedFiles.forEach(f => {
      const name = f.original_lead?.surveyor?.full_name || f.original_lead?.surveyor?.username;
      if (name && name !== '-' && name !== 'Unknown') set.add(name);
    });
    return Array.from(set).sort();
  }, [pendingLeads, submittedFiles]);

  const teamLeadOptions = useMemo(() => {
    const set = new Set<string>();
    pendingLeads.forEach(l => {
      if (l.tl_name && l.tl_name !== '-' && l.tl_name !== 'Unknown') set.add(l.tl_name);
    });
    submittedFiles.forEach(f => {
      const tl = (f.original_lead as any)?.tl_name;
      if (tl && tl !== '-' && tl !== 'Unknown') set.add(tl);
    });
    return Array.from(set).sort();
  }, [pendingLeads, submittedFiles]);

  const telecallerOptions = useMemo(() => {
    const set = new Set<string>();
    pendingLeads.forEach(l => {
      const name = l.telecaller_name || l.telecaller?.full_name || l.telecaller?.username;
      if (name && name !== '-' && name !== 'Unknown') set.add(name);
    });
    submittedFiles.forEach(f => {
      const name = f.original_lead?.telecaller_name || f.original_lead?.telecaller?.full_name || f.original_lead?.telecaller?.username;
      if (name && name !== '-' && name !== 'Unknown') set.add(name);
    });
    return Array.from(set).sort();
  }, [pendingLeads, submittedFiles]);

  const checkDateInRange = (dateStr?: string) => {
    if (!startDate && !endDate) return true;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const itemDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    if (startDate && itemDateStr < startDate) return false;
    if (endDate && itemDateStr > endDate) return false;
    return true;
  };

  const matchesLead = (lead: Submission) => {
    if (filterSurveyor) {
      const name = lead.surveyor?.full_name || lead.surveyor?.username;
      if (name !== filterSurveyor) return false;
    }
    if (filterTeamLead) {
      if (lead.tl_name !== filterTeamLead) return false;
    }
    if (filterTelecaller) {
      const name = lead.telecaller_name || lead.telecaller?.full_name || lead.telecaller?.username;
      if (name !== filterTelecaller) return false;
    }
    if (!checkDateInRange(lead.lead_status_updated_at || lead.submitted_at)) {
      return false;
    }
    return true;
  };

  const matchesFile = (file: FileSubmission) => {
    if (filterSurveyor) {
      const name = file.original_lead?.surveyor?.full_name || file.original_lead?.surveyor?.username;
      if (name !== filterSurveyor) return false;
    }
    if (filterTeamLead) {
      const tl = (file.original_lead as any)?.tl_name;
      if (tl !== filterTeamLead) return false;
    }
    if (filterTelecaller) {
      const name = file.original_lead?.telecaller_name || file.original_lead?.telecaller?.full_name || file.original_lead?.telecaller?.username;
      if (name !== filterTelecaller) return false;
    }
    if (!checkDateInRange(file.updated_at || file.submitted_at)) {
      return false;
    }
    return true;
  };

  const filteredPending = useMemo(() => pendingLeads.filter(matchesLead), [pendingLeads, filterSurveyor, filterTeamLead, filterTelecaller, startDate, endDate]);
  const filteredOpen = useMemo(() => openFiles.filter(matchesFile), [openFiles, filterSurveyor, filterTeamLead, filterTelecaller, startDate, endDate]);
  const filteredCleared = useMemo(() => clearedFiles.filter(matchesFile), [clearedFiles, filterSurveyor, filterTeamLead, filterTelecaller, startDate, endDate]);
  const filteredDeleted = useMemo(() => deletedFiles.filter(matchesFile), [deletedFiles, filterSurveyor, filterTeamLead, filterTelecaller, startDate, endDate]);

  const hasActiveFilters = Boolean(
    filterSurveyor || filterTeamLead || filterTelecaller || startDate || endDate
  );

  const handleClearFilters = () => {
    setFilterSurveyor('');
    setFilterTeamLead('');
    setFilterTelecaller('');
    setStartDate('');
    setEndDate('');
  };

  const currentFilteredCount = 
    activeTab === 'pending' ? filteredPending.length :
    activeTab === 'submitted' ? filteredOpen.length :
    activeTab === 'cleared' ? filteredCleared.length :
    filteredDeleted.length;

  const currentTotalCount = 
    activeTab === 'pending' ? pendingLeads.length :
    activeTab === 'submitted' ? openFiles.length :
    activeTab === 'cleared' ? clearedFiles.length :
    deletedFiles.length;

  const paginatedPending = filteredPending.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const paginatedOpen = filteredOpen.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const paginatedCleared = filteredCleared.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const paginatedDeleted = filteredDeleted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const renderPagination = (totalItems: number) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) return null;
    
    return (
      <div className="flex items-center justify-between px-6 py-4 border-t border-bg-border bg-bg-secondary/30">
        <div className="text-sm text-text-muted">
          Showing <span className="text-white font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-white font-medium">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of <span className="text-white font-medium">{totalItems}</span> entries
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <div className="text-sm font-medium text-white px-2">
            Page {currentPage} of {totalPages}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-bg-secondary border border-bg-border rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-green/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight mb-2">File Handler Dashboard</h2>
            <p className="text-text-secondary">Process and clear files from team lead submissions.</p>
          </div>
          <div className="flex flex-wrap gap-4 items-center">
             <button 
               onClick={handleNewFile}
               className="bg-accent-blue/10 border border-accent-blue/20 rounded-lg p-4 flex flex-col items-center justify-center min-w-[100px] hover:bg-accent-blue/20 hover:border-accent-blue/40 transition-all cursor-pointer group"
             >
                <Plus className="w-6 h-6 text-accent-blue mb-1 group-hover:scale-110 transition-transform" />
                <div className="text-[10px] uppercase text-accent-blue font-bold tracking-widest text-center mt-1">New File</div>
             </button>
             <div className="bg-bg-primary border border-bg-border rounded-lg p-4 flex flex-col items-center min-w-[100px]">
                <div className="text-xl font-bold text-white">{pendingLeads.length}</div>
                <div className="text-[10px] uppercase text-text-muted font-bold tracking-widest text-center mt-1">Pending</div>
              </div>
              <div className="bg-bg-primary border border-bg-border rounded-lg p-4 flex flex-col items-center min-w-[100px]">
                <div className="text-xl font-bold text-accent-green">{openFiles.length}</div>
                <div className="text-[10px] uppercase text-text-muted font-bold tracking-widest text-center mt-1">Open Files</div>
              </div>
              <div className="bg-bg-primary border border-bg-border rounded-lg p-4 flex flex-col items-center min-w-[100px]">
                <div className="text-xl font-bold text-pink-500">{clearedFiles.length}</div>
                <div className="text-[10px] uppercase text-text-muted font-bold tracking-widest text-center mt-1">Cleared</div>
              </div>
              <div className="bg-bg-primary border border-bg-border rounded-lg p-4 flex flex-col items-center min-w-[100px]">
                <div className="text-xl font-bold text-accent-red">{deletedFiles.length}</div>
                <div className="text-[10px] uppercase text-text-muted font-bold tracking-widest text-center mt-1">Deleted</div>
              </div>
          </div>
        </div>
      </div>

      {!template && (
        <div className="bg-accent-red/10 border border-accent-red/50 rounded-xl p-4 text-accent-red font-medium">
          You have not been assigned a File Form Template. Please contact your admin.
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="flex border-b border-bg-border">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 py-4 px-6 text-sm font-semibold transition-colors flex justify-center items-center gap-2 ${
              activeTab === 'pending'
                ? 'text-accent-blue border-b-2 border-accent-blue bg-accent-blue/5'
                : 'text-text-secondary hover:text-white hover:bg-bg-secondary'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            Pending Leads
            <Badge variant="gray">
              {hasActiveFilters && filteredPending.length !== pendingLeads.length
                ? `${filteredPending.length} / ${pendingLeads.length}`
                : pendingLeads.length}
            </Badge>
          </button>
          <button
            onClick={() => setActiveTab('submitted')}
            className={`flex-1 py-4 px-6 text-sm font-semibold transition-colors flex justify-center items-center gap-2 ${
              activeTab === 'submitted'
                ? 'text-accent-blue border-b-2 border-accent-blue bg-accent-blue/5'
                : 'text-text-secondary hover:text-white hover:bg-bg-secondary'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            Open File Bucket
            <Badge variant="gray">
              {hasActiveFilters && filteredOpen.length !== openFiles.length
                ? `${filteredOpen.length} / ${openFiles.length}`
                : openFiles.length}
            </Badge>
          </button>
          <button
            onClick={() => setActiveTab('cleared')}
            className={`flex-1 py-4 px-6 text-sm font-semibold transition-colors flex justify-center items-center gap-2 ${
              activeTab === 'cleared'
                ? 'text-accent-blue border-b-2 border-accent-blue bg-accent-blue/5'
                : 'text-text-secondary hover:text-white hover:bg-bg-secondary'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            Cleared Bucket
            <Badge variant="gray">
              {hasActiveFilters && filteredCleared.length !== clearedFiles.length
                ? `${filteredCleared.length} / ${clearedFiles.length}`
                : clearedFiles.length}
            </Badge>
          </button>
          <button
            onClick={() => setActiveTab('deleted')}
            className={`flex-1 py-4 px-6 text-sm font-semibold transition-colors flex justify-center items-center gap-2 ${
              activeTab === 'deleted'
                ? 'text-accent-red border-b-2 border-accent-red bg-accent-red/5'
                : 'text-text-secondary hover:text-white hover:bg-bg-secondary'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            Deleted Files
            <Badge variant={activeTab === 'deleted' ? 'red' : 'gray'}>
              {hasActiveFilters && filteredDeleted.length !== deletedFiles.length
                ? `${filteredDeleted.length} / ${deletedFiles.length}`
                : deletedFiles.length}
            </Badge>
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 bg-bg-secondary/40 border-b border-bg-border flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider mr-1">
            <Filter className="w-3.5 h-3.5 text-accent-blue" />
            <span>Filters:</span>
          </div>

          {/* Surveyor Filter */}
          <div className="relative">
            <select
              value={filterSurveyor}
              onChange={(e) => setFilterSurveyor(e.target.value)}
              className="bg-bg-primary border border-bg-border rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent-blue min-w-[130px]"
            >
              <option value="">All Surveyors</option>
              {surveyorOptions.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* Team Lead Filter */}
          <div className="relative">
            <select
              value={filterTeamLead}
              onChange={(e) => setFilterTeamLead(e.target.value)}
              className="bg-bg-primary border border-bg-border rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent-blue min-w-[130px]"
            >
              <option value="">All Team Leads</option>
              {teamLeadOptions.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* Telecaller Filter */}
          <div className="relative">
            <select
              value={filterTelecaller}
              onChange={(e) => setFilterTelecaller(e.target.value)}
              className="bg-bg-primary border border-bg-border rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent-blue min-w-[130px]"
            >
              <option value="">All Telecallers</option>
              {telecallerOptions.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-bg-primary border border-bg-border rounded-lg px-2.5 py-1">
              <Calendar className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-[11px] text-text-muted">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none [color-scheme:dark]"
                title="From Date"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-bg-primary border border-bg-border rounded-lg px-2.5 py-1">
              <Calendar className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-[11px] text-text-muted">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none [color-scheme:dark]"
                title="To Date"
              />
            </div>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClearFilters}
              className="text-xs text-accent-red hover:text-white hover:bg-accent-red/20 h-8 px-2.5"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Reset Filters
            </Button>
          )}

          <div className="ml-auto text-xs text-text-muted hidden sm:block">
            {hasActiveFilters ? (
              <>Showing <span className="text-white font-medium">{currentFilteredCount}</span> of <span className="text-white font-medium">{currentTotalCount}</span> records</>
            ) : (
              <>Showing <span className="text-white font-medium">{currentTotalCount}</span> records</>
            )}
          </div>
        </div>

        <div className="p-0">
          {activeTab === 'pending' && (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm min-w-[700px]">
                  <thead>
                    <tr className="bg-bg-secondary/50 text-text-muted text-[10px] uppercase tracking-widest">
                      <th className="py-4 px-6 font-semibold">Lead Form</th>
                      <th className="py-4 px-6 font-semibold">Customer Name</th>
                      <th className="py-4 px-6 font-semibold">Phone Number</th>
                      <th className="py-4 px-6 font-semibold">Surveyor</th>
                      <th className="py-4 px-6 font-semibold">Team Lead</th>
                      <th className="py-4 px-6 font-semibold">Telecaller</th>
                      <th className="py-4 px-6 font-semibold">Date Cleared</th>
                      <th className="py-4 px-6 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPending.map(lead => (
                      <tr key={lead.id} className="border-b border-bg-border last:border-0 hover:bg-bg-primary/80 transition-colors">
                        <td className="py-4 px-6 text-white font-medium">{(Array.isArray(lead.form_templates) ? lead.form_templates[0]?.name : lead.form_templates?.name) || 'Form'}</td>
                        <td className="py-4 px-6 text-white font-medium">{findValueByLabelRegex(lead, /name|customer/i)}</td>
                        <td className="py-4 px-6 text-white">{findValueByLabelRegex(lead, /phone|contact|mobile/i)}</td>
                        <td className="py-4 px-6 text-text-secondary">{lead.surveyor?.full_name || lead.surveyor?.username || 'Unknown'}</td>
                        <td className="py-4 px-6 text-text-secondary">{lead.tl_name || 'Unknown'}</td>
                        <td className="py-4 px-6 text-text-secondary">{lead.telecaller_name || lead.telecaller?.full_name || lead.telecaller?.username || '-'}</td>
                        <td className="py-4 px-6 text-text-secondary">{new Date(lead.lead_status_updated_at || lead.submitted_at).toLocaleDateString()}</td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" onClick={() => handleOpenForm(lead)} disabled={!template} className="bg-accent-blue hover:bg-accent-blue/90 text-white border-none shadow-lg shadow-accent-blue/20">
                              Open File
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredPending.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-text-muted italic">
                          {hasActiveFilters ? 'No pending leads match the selected filters.' : 'No pending leads to process.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {renderPagination(filteredPending.length)}
            </div>
          )}

          {activeTab === 'submitted' && (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm min-w-[700px]">
                  <thead>
                    <tr className="bg-bg-secondary/50 text-text-muted text-[10px] uppercase tracking-widest">
                      <th className="py-4 px-6 font-semibold">File Template</th>
                      <th className="py-4 px-6 font-semibold">Lead ID</th>
                      <th className="py-4 px-6 font-semibold">Surveyor</th>
                      <th className="py-4 px-6 font-semibold">Team Lead</th>
                      <th className="py-4 px-6 font-semibold">Telecaller</th>
                      <th className="py-4 px-6 font-semibold">Status</th>
                      <th className="py-4 px-6 font-semibold">Last Updated</th>
                      <th className="py-4 px-6 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedOpen.map(file => (
                      <tr key={file.id} className="border-b border-bg-border last:border-0 hover:bg-bg-primary/80 transition-colors">
                        <td className="py-4 px-6 text-white font-medium">{file.file_form_template?.name || 'File Form'}</td>
                        <td className="py-4 px-6 text-text-secondary text-xs truncate max-w-[100px]">{file.original_lead_id || 'Independent'}</td>
                        <td className="py-4 px-6 text-text-secondary">{file.original_lead?.surveyor?.full_name || file.original_lead?.surveyor?.username || '-'}</td>
                        <td className="py-4 px-6 text-text-secondary">{(file.original_lead as any)?.tl_name || '-'}</td>
                        <td className="py-4 px-6 text-text-secondary">{file.original_lead?.telecaller_name || file.original_lead?.telecaller?.full_name || file.original_lead?.telecaller?.username || '-'}</td>
                        <td className="py-4 px-6">
                          <Badge variant="blue">
                            OPEN
                          </Badge>
                        </td>
                        <td className="py-4 px-6 text-text-secondary">{new Date(file.updated_at).toLocaleString()}</td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleEditFile(file)}
                            >
                              Edit
                            </Button>
                            <Button 
                              size="sm" 
                              onClick={() => handleClearFile(file.id)}
                              className="bg-pink-500 text-white hover:bg-pink-600 border-none shadow-lg shadow-pink-500/20"
                            >
                              Clear File
                            </Button>
                            <Button 
                              size="sm" 
                              onClick={() => handleDeleteFile(file.id)}
                              className="bg-accent-red/10 text-accent-red hover:bg-accent-red hover:text-white border border-accent-red/20 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1 inline" />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredOpen.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-text-muted italic">
                          {hasActiveFilters ? 'No open files match the selected filters.' : 'No open files yet.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {renderPagination(filteredOpen.length)}
            </div>
          )}

          {activeTab === 'cleared' && (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm min-w-[700px]">
                  <thead>
                    <tr className="bg-bg-secondary/50 text-text-muted text-[10px] uppercase tracking-widest">
                      <th className="py-4 px-6 font-semibold">File Template</th>
                      <th className="py-4 px-6 font-semibold">Lead ID</th>
                      <th className="py-4 px-6 font-semibold">Surveyor</th>
                      <th className="py-4 px-6 font-semibold">Team Lead</th>
                      <th className="py-4 px-6 font-semibold">Telecaller</th>
                      <th className="py-4 px-6 font-semibold">Status</th>
                      <th className="py-4 px-6 font-semibold">Last Updated</th>
                      <th className="py-4 px-6 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCleared.map(file => (
                      <tr key={file.id} className="border-b border-bg-border last:border-0 hover:bg-bg-primary/80 transition-colors">
                        <td className="py-4 px-6 text-white font-medium">{file.file_form_template?.name || 'File Form'}</td>
                        <td className="py-4 px-6 text-text-secondary text-xs truncate max-w-[100px]">{file.original_lead_id || 'Independent'}</td>
                        <td className="py-4 px-6 text-text-secondary">{file.original_lead?.surveyor?.full_name || file.original_lead?.surveyor?.username || '-'}</td>
                        <td className="py-4 px-6 text-text-secondary">{(file.original_lead as any)?.tl_name || '-'}</td>
                        <td className="py-4 px-6 text-text-secondary">{file.original_lead?.telecaller_name || file.original_lead?.telecaller?.full_name || file.original_lead?.telecaller?.username || '-'}</td>
                        <td className="py-4 px-6">
                          <Badge variant="pink">
                            CLEARED
                          </Badge>
                        </td>
                        <td className="py-4 px-6 text-text-secondary">{new Date(file.updated_at).toLocaleString()}</td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleViewFile(file)}
                            >
                              <Eye className="w-3.5 h-3.5 mr-1 inline" />
                              View
                            </Button>
                            <Button 
                              size="sm" 
                              disabled={true}
                              className="bg-bg-secondary text-text-muted border-none"
                            >
                              Cleared
                            </Button>
                            <Button 
                              size="sm" 
                              onClick={() => handleDeleteFile(file.id)}
                              className="bg-accent-red/10 text-accent-red hover:bg-accent-red hover:text-white border border-accent-red/20 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1 inline" />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredCleared.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-text-muted italic">
                          {hasActiveFilters ? 'No cleared files match the selected filters.' : 'No cleared files yet.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {renderPagination(filteredCleared.length)}
            </div>
          )}

          {activeTab === 'deleted' && (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm min-w-[700px]">
                  <thead>
                    <tr className="bg-bg-secondary/50 text-text-muted text-[10px] uppercase tracking-widest">
                      <th className="py-4 px-6 font-semibold">File Template</th>
                      <th className="py-4 px-6 font-semibold">Lead ID</th>
                      <th className="py-4 px-6 font-semibold">Surveyor</th>
                      <th className="py-4 px-6 font-semibold">Team Lead</th>
                      <th className="py-4 px-6 font-semibold">Telecaller</th>
                      <th className="py-4 px-6 font-semibold">Status</th>
                      <th className="py-4 px-6 font-semibold">Deleted At</th>
                      <th className="py-4 px-6 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDeleted.map(file => (
                      <tr key={file.id} className="border-b border-bg-border last:border-0 hover:bg-bg-primary/80 transition-colors">
                        <td className="py-4 px-6 text-white font-medium">{file.file_form_template?.name || 'File Form'}</td>
                        <td className="py-4 px-6 text-text-secondary text-xs truncate max-w-[100px]">{file.original_lead_id || 'Independent'}</td>
                        <td className="py-4 px-6 text-text-secondary">{file.original_lead?.surveyor?.full_name || file.original_lead?.surveyor?.username || '-'}</td>
                        <td className="py-4 px-6 text-text-secondary">{(file.original_lead as any)?.tl_name || '-'}</td>
                        <td className="py-4 px-6 text-text-secondary">{file.original_lead?.telecaller_name || file.original_lead?.telecaller?.full_name || file.original_lead?.telecaller?.username || '-'}</td>
                        <td className="py-4 px-6">
                          <Badge variant="red">
                            DELETED
                          </Badge>
                        </td>
                        <td className="py-4 px-6 text-text-secondary">{new Date(file.updated_at).toLocaleString()}</td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleViewFile(file)}
                            >
                              <Eye className="w-3.5 h-3.5 mr-1 inline" />
                              View
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleRestoreFile(file.id)}
                              className="border-accent-blue/30 text-accent-blue hover:bg-accent-blue/10"
                            >
                              <RotateCcw className="w-3.5 h-3.5 mr-1 inline" />
                              Restore
                            </Button>
                            <Button 
                              size="sm" 
                              onClick={() => handlePermanentDelete(file.id)}
                              className="bg-accent-red/20 text-accent-red hover:bg-accent-red hover:text-white border border-accent-red/30 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1 inline" />
                              Delete Permanently
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredDeleted.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-text-muted italic">
                          {hasActiveFilters ? 'No deleted files match the selected filters.' : 'No deleted files found.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {renderPagination(filteredDeleted.length)}
            </div>
          )}
        </div>
      </Card>

      {/* Form Modal */}
      {isFormOpen && template && selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-bg-secondary w-full max-w-[95vw] md:max-w-7xl rounded-2xl shadow-2xl border border-bg-border my-8 flex flex-col h-[90vh]">
            <div className="p-6 border-b border-bg-border flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xl font-bold text-white">{template.name}</h3>
                {template.description && <p className="text-sm text-text-secondary mt-1">{template.description}</p>}
              </div>
              <button onClick={() => setIsFormOpen(false)} className="text-text-muted hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 flex overflow-hidden flex-col md:flex-row">
              {/* Left Side: File Form */}
              <div className="w-full md:w-1/2 p-6 overflow-y-auto border-r border-bg-border">
                <h4 className="text-sm font-bold text-white uppercase tracking-widest border-b border-bg-border pb-2 mb-4 flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-accent-green" /> File Data Entry
                </h4>
                <form id="file-form" onSubmit={handleSubmitForm} className="space-y-6">
                  <fieldset disabled={isViewOnly} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {template.fields.map(field => (
                        <div key={field.id} className={`space-y-2 ${field.width === 'full' ? 'col-span-1 md:col-span-2' : 'col-span-1'}`}>
                          <label className="text-sm font-semibold text-white block">
                            {field.label} {field.required && <span className="text-accent-red">*</span>}
                          </label>
                          {field.helpText && <p className="text-xs text-text-muted mb-2">{field.helpText}</p>}
                          <FormFieldRender
                            field={field}
                            value={formData[field.id]}
                            onChange={(val) => setFormData(prev => ({ ...prev, [field.id]: val }))}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="pt-6 border-t border-bg-border">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-white font-semibold">Custom Questions</h4>
                        {!isViewOnly && (
                          <Button type="button" variant="outline" size="sm" onClick={addCustomField}>
                            <Plus className="w-4 h-4 mr-2" /> Add Question
                          </Button>
                        )}
                      </div>
                      
                      <div className="space-y-4">
                        {customFields.map((cf, index) => (
                          <div key={cf.id} className="flex gap-4 items-start bg-bg-primary p-4 rounded-xl border border-bg-border">
                            <div className="flex-1 space-y-4">
                              <div>
                                <label className="text-xs text-text-secondary uppercase tracking-widest font-medium mb-1.5 block">Question {index + 1}</label>
                                <Input 
                                  value={cf.question}
                                  onChange={(e) => updateCustomField(cf.id, 'question', e.target.value)}
                                  placeholder="Enter question here"
                                  required
                                  disabled={isViewOnly}
                                />
                              </div>
                              <div>
                                <label className="text-xs text-text-secondary uppercase tracking-widest font-medium mb-1.5 block">Answer</label>
                                <Input 
                                  value={cf.answer}
                                  onChange={(e) => updateCustomField(cf.id, 'answer', e.target.value)}
                                  placeholder="Enter answer here"
                                  required
                                  disabled={isViewOnly}
                                />
                              </div>
                            </div>
                            {!isViewOnly && (
                              <button type="button" onClick={() => removeCustomField(cf.id)} className="p-2 text-text-muted hover:text-accent-red mt-6">
                                <Trash2 className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        ))}
                        {customFields.length === 0 && (
                          <p className="text-sm text-text-muted italic">No custom questions added.</p>
                        )}
                      </div>
                    </div>
                  </fieldset>
                </form>
              </div>
              
              {/* Right Side: Original Lead View */}
              <div className="w-full md:w-1/2 p-6 overflow-y-auto bg-bg-primary/30">
                <h4 className="text-sm font-bold text-white uppercase tracking-widest border-b border-bg-border pb-2 mb-4 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-accent-blue" /> Original Lead Data
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="bg-bg-primary p-3 rounded-xl border border-bg-border shadow-sm">
                    <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1 font-bold">Surveyor</p>
                    <p className="text-sm text-white font-medium">{selectedLead.surveyor?.full_name || selectedLead.surveyor?.username || (selectedLead.id === 'new-file' ? 'N/A' : '-')}</p>
                  </div>
                  <div className="bg-bg-primary p-3 rounded-xl border border-bg-border shadow-sm">
                    <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1 font-bold">Team Lead</p>
                    <p className="text-sm text-white font-medium">{selectedLead.tl_name || (selectedLead.id === 'new-file' ? 'N/A' : '-')}</p>
                  </div>
                  <div className="bg-bg-primary p-3 rounded-xl border border-bg-border shadow-sm">
                    <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1 font-bold">Telecaller</p>
                    <p className="text-sm text-white font-medium">{selectedLead.telecaller_name || selectedLead.telecaller?.full_name || selectedLead.telecaller?.username || (selectedLead.id === 'new-file' ? 'N/A' : '-')}</p>
                  </div>
                </div>

                {selectedLead.id === 'new-file' ? (
                  <p className="text-text-muted text-sm italic">This is an independent file not linked to any existing lead.</p>
                ) : Object.keys(selectedLead.data || {}).length === 0 ? (
                  <p className="text-text-muted text-sm italic">No data recorded for this lead.</p>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      const tmpl = Array.isArray((selectedLead as any).form_templates)
                        ? (selectedLead as any).form_templates[0]
                        : (selectedLead as any).form_templates;
                      const fields = tmpl?.fields && Array.isArray(tmpl.fields)
                        ? [...tmpl.fields].sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
                        : Object.keys(selectedLead.data).map(key => ({ id: key, label: key }));
                      return fields.map((field: any) => {
                        const value = selectedLead.data[field.id];
                        if (value === undefined || value === null || value === '') return null;
                        
                        let displayValue = '-';
                        if (typeof value === 'object') {
                          if (value.lat && value.lng) {
                            displayValue = `${value.lat.toFixed(6)}, ${value.lng.toFixed(6)}`;
                          } else if (Array.isArray(value)) {
                            displayValue = value.join(', ');
                          } else {
                            displayValue = JSON.stringify(value);
                          }
                        } else {
                          displayValue = String(value);
                        }

                        return (
                          <div key={field.id} className="bg-bg-secondary p-3.5 rounded-lg border border-bg-border shadow-sm group hover:border-accent-blue/50 transition-colors">
                            <span className="text-[10px] uppercase font-bold text-text-muted block mb-1 tracking-widest">{field.label}</span>
                            <span className="text-sm text-white break-words font-medium">
                              {displayValue.toString().startsWith('http') ? (
                                <a href={displayValue} target="_blank" rel="noreferrer" className="text-accent-blue hover:underline">View Uploaded File</a>
                              ) : displayValue}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-bg-border shrink-0 flex justify-end gap-3 bg-bg-secondary rounded-b-2xl">
              {isViewOnly ? (
                <Button type="button" onClick={() => setIsFormOpen(false)}>
                  Close
                </Button>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button type="submit" form="file-form" isLoading={isSubmitting}>
                    {editingFileId ? 'Update File Form' : 'Submit File Form'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
