import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import FormFieldRender from '../../components/form-builder/FormFieldRender';
import { 
  FileText, 
  Search, 
  ArrowLeft, 
  RefreshCw, 
  Edit3, 
  Trash2, 
  RotateCcw, 
  CheckCircle2, 
  X, 
  Plus, 
  Eye, 
  Clock, 
  User, 
  FileCheck,
  Calendar,
  ExternalLink,
  HelpCircle,
  FolderOpen,
  Filter
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import type { FieldConfig } from '../../types';
import ViewFileSubmissionModal from '../../components/common/ViewFileSubmissionModal';

export default function FileSubmissionsManagement() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTemplateId = searchParams.get('templateId') || 'all';

  const [submissions, setSubmissions] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [fileHandlers, setFileHandlers] = useState<any[]>([]);
  const [surveyors, setSurveyors] = useState<any[]>([]);
  const [telecallers, setTelecallers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'open' | 'cleared' | 'deleted' | 'all'>('open');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>(initialTemplateId);
  const [selectedFH, setSelectedFH] = useState<string>('all');
  const [selectedSurveyor, setSelectedSurveyor] = useState<string>('all');
  const [selectedTelecaller, setSelectedTelecaller] = useState<string>('all');
  const [page, setPage] = useState(1);
  const itemsPerPage = 20;

  // View File Modal State
  const [viewingFile, setViewingFile] = useState<any | null>(null);

  // Edit Modal State
  const [editingFile, setEditingFile] = useState<any | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<{ id: string; name: string; description?: string; fields: FieldConfig[] } | null>(null);
  const [editFileHandlerId, setEditFileHandlerId] = useState<string>('');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [customFields, setCustomFields] = useState<{ id: string; question: string; answer: string }[]>([]);
  const [editStatus, setEditStatus] = useState<string>('submitted');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [activeTab, searchTerm, selectedTemplate, selectedFH, selectedSurveyor, selectedTelecaller]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch File Form Templates
      const { data: tmpls } = await supabase
        .from('file_form_templates')
        .select('id, name, description, fields')
        .or('is_deleted.is.null,is_deleted.eq.false')
        .order('name');
      setTemplates(tmpls || []);

      // 2. Fetch Staff: File Handlers, Surveyors, Telecallers
      const { data: staff } = await supabase
        .from('surveyors')
        .select('id, full_name, username, user_roles(name)');

      const fhs: any[] = [];
      const svs: any[] = [];
      const tcs: any[] = [];

      (staff || []).forEach((s: any) => {
        const role = (Array.isArray(s.user_roles) ? s.user_roles[0]?.name : s.user_roles?.name)?.toLowerCase() || '';
        if (role.includes('file handler') || role.includes('filehandler') || role.includes('file_handler')) {
          fhs.push(s);
        }
        if (role.includes('surveyor')) {
          svs.push(s);
        }
        if (role.includes('telecaller')) {
          tcs.push(s);
        }
      });

      setFileHandlers(fhs);
      setSurveyors(svs);
      setTelecallers(tcs);

      // 3. Fetch File Submissions
      await fetchSubmissions();
    } catch (err: any) {
      console.error('Failed to load initial data:', err);
      toast.error('Failed to load file submissions');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('file_submissions')
        .select(`
          id,
          file_handler_id,
          file_form_template_id,
          original_lead_id,
          status,
          data,
          submitted_at,
          updated_at,
          file_handler:surveyors!file_handler_id(id, full_name, username),
          file_form_template:file_form_templates(id, name, description, fields),
          original_lead:submissions!original_lead_id(
            id,
            data,
            submitted_at,
            lead_status,
            surveyor_id,
            telecaller_id,
            surveyor:surveyors!surveyor_id(id, full_name, username),
            telecaller:surveyors!telecaller_id(id, full_name, username),
            form_templates(name, fields)
          )
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (err: any) {
      console.error('Failed to fetch file submissions:', err);
      toast.error('Failed to refresh submissions');
    }
  };

  // Helper to extract customer name from lead data
  const getCustomerName = (sub: any) => {
    const lead = sub.original_lead;
    if (!lead || !lead.data) return null;
    const tmpl = Array.isArray(lead.form_templates) ? lead.form_templates[0] : lead.form_templates;
    const fields = tmpl?.fields || [];
    for (const f of fields) {
      if (/name|customer|ग्राहक/i.test(f.label || '')) {
        const val = lead.data[f.id];
        if (val) return String(val);
      }
    }
    for (const [k, v] of Object.entries(lead.data)) {
      if (/name|customer|ग्राहक/i.test(k) && v) return String(v);
    }
    return null;
  };

  // Unique File Handlers from staff + submissions
  const availableFileHandlers = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    fileHandlers.forEach(fh => map.set(fh.id, { id: fh.id, name: fh.full_name || fh.username }));
    submissions.forEach(item => {
      const fh = item.file_handler;
      const fhId = item.file_handler_id || fh?.id;
      if (fhId && !map.has(fhId)) {
        map.set(fhId, { id: fhId, name: fh?.full_name || fh?.username || 'Unknown Handler' });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [fileHandlers, submissions]);

  // Unique Surveyors from staff + submissions
  const availableSurveyors = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    surveyors.forEach(s => map.set(s.id, { id: s.id, name: s.full_name || s.username }));
    submissions.forEach(item => {
      const s = item.original_lead?.surveyor;
      const sId = item.original_lead?.surveyor_id || s?.id;
      if (sId && !map.has(sId)) {
        map.set(sId, { id: sId, name: s?.full_name || s?.username || 'Unknown Surveyor' });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [surveyors, submissions]);

  // Unique Telecallers from staff + submissions
  const availableTelecallers = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    telecallers.forEach(t => map.set(t.id, { id: t.id, name: t.full_name || t.username }));
    submissions.forEach(item => {
      const t = item.original_lead?.telecaller;
      const tId = item.original_lead?.telecaller_id || t?.id;
      if (tId && !map.has(tId)) {
        map.set(tId, { id: tId, name: t?.full_name || t?.username || 'Unknown Telecaller' });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [telecallers, submissions]);

  // Base filtered submissions (matching all dropdown filters and search term, across all statuses)
  const baseFilteredSubmissions = useMemo(() => {
    return submissions.filter(item => {
      // Template filter
      if (selectedTemplate !== 'all' && item.file_form_template_id !== selectedTemplate) return false;

      // FH filter
      if (selectedFH !== 'all' && item.file_handler_id !== selectedFH) return false;

      // Surveyor filter
      if (selectedSurveyor !== 'all') {
        const surveyorId = item.original_lead?.surveyor?.id || item.original_lead?.surveyor_id;
        if (surveyorId !== selectedSurveyor) return false;
      }

      // Telecaller filter
      if (selectedTelecaller !== 'all') {
        const telecallerId = item.original_lead?.telecaller?.id || item.original_lead?.telecaller_id;
        if (telecallerId !== selectedTelecaller) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const templateName = item.file_form_template?.name?.toLowerCase() || '';
        const fhName = (item.file_handler?.full_name || item.file_handler?.username || '').toLowerCase();
        const customerName = (getCustomerName(item) || '').toLowerCase();
        const leadId = (item.original_lead_id || '').toLowerCase();
        const surveyor = (item.original_lead?.surveyor?.full_name || item.original_lead?.surveyor?.username || '').toLowerCase();
        const telecaller = (item.original_lead?.telecaller?.full_name || item.original_lead?.telecaller?.username || '').toLowerCase();

        const matches = templateName.includes(q) ||
          fhName.includes(q) ||
          customerName.includes(q) ||
          leadId.includes(q) ||
          surveyor.includes(q) ||
          telecaller.includes(q);

        if (!matches) return false;
      }

      return true;
    });
  }, [submissions, selectedTemplate, selectedFH, selectedSurveyor, selectedTelecaller, searchTerm]);

  // Counts corresponding to the chosen filters
  const counts = useMemo(() => {
    let open = 0;
    let cleared = 0;
    let deleted = 0;
    baseFilteredSubmissions.forEach(s => {
      if (s.status === 'submitted') open++;
      else if (s.status === 'cleared' || s.status === 'closed') cleared++;
      else if (s.status === 'deleted') deleted++;
    });
    return {
      all: baseFilteredSubmissions.length,
      open,
      cleared,
      deleted
    };
  }, [baseFilteredSubmissions]);

  // Filtered lists respecting the activeTab
  const filteredSubmissions = useMemo(() => {
    return baseFilteredSubmissions.filter(item => {
      if (activeTab === 'open') return item.status === 'submitted';
      if (activeTab === 'cleared') return item.status === 'cleared' || item.status === 'closed';
      if (activeTab === 'deleted') return item.status === 'deleted';
      return true; // 'all'
    });
  }, [baseFilteredSubmissions, activeTab]);

  // Pagination
  const totalPages = Math.ceil(filteredSubmissions.length / itemsPerPage) || 1;
  const paginatedSubmissions = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return filteredSubmissions.slice(start, start + itemsPerPage);
  }, [filteredSubmissions, page]);

  // Open Edit Form Modal
  const handleOpenEditModal = (file: any) => {
    setEditingFile(file);
    setEditStatus(file.status || 'submitted');
    setEditFileHandlerId(file.file_handler_id || file.file_handler?.id || '');

    // Resolve template fields
    const rawTmpl = Array.isArray(file.file_form_template) ? file.file_form_template[0] : file.file_form_template;
    let fields: FieldConfig[] = [];
    if (rawTmpl && rawTmpl.fields) {
      fields = Array.isArray(rawTmpl.fields) ? rawTmpl.fields : [];
      if (typeof rawTmpl.fields === 'string') {
        try { fields = JSON.parse(rawTmpl.fields); } catch {}
      }
    }
    setEditingTemplate({
      id: file.file_form_template_id || rawTmpl?.id || '',
      name: rawTmpl?.name || 'File Form',
      description: rawTmpl?.description,
      fields: fields.sort((a, b) => (a.order || 0) - (b.order || 0))
    });

    // Unpack formData
    let raw = file.data;
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw); } catch {}
    }
    raw = raw || {};

    let initialFormAnswers: Record<string, any> = {};
    if (raw.fields && typeof raw.fields === 'object') {
      initialFormAnswers = { ...initialFormAnswers, ...raw.fields };
    }
    if (raw.data && typeof raw.data === 'object') {
      initialFormAnswers = { ...initialFormAnswers, ...raw.data };
    }
    Object.keys(raw).forEach(k => {
      if (k !== 'fields' && k !== 'custom_fields' && k !== 'data') {
        initialFormAnswers[k] = raw[k];
      }
    });

    setFormData(initialFormAnswers);
    setCustomFields(raw.custom_fields || file.custom_fields || []);
  };

  // Add / Edit / Remove Custom Questions
  const addCustomField = () => {
    setCustomFields([...customFields, { id: Date.now().toString(), question: '', answer: '' }]);
  };

  const updateCustomField = (id: string, key: 'question' | 'answer', value: string) => {
    setCustomFields(customFields.map(f => f.id === id ? { ...f, [key]: value } : f));
  };

  const removeCustomField = (id: string) => {
    setCustomFields(customFields.filter(f => f.id !== id));
  };

  // Save changes to file submission
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFile) return;

    setIsSaving(true);
    try {
      const payloadData = {
        fields: formData,
        custom_fields: customFields
      };

      const { error } = await supabase
        .from('file_submissions')
        .update({
          file_handler_id: editFileHandlerId || null,
          data: payloadData,
          status: editStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingFile.id);

      if (error) throw error;

      toast.success('File form updated successfully!');
      setEditingFile(null);
      await fetchSubmissions();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to update file form: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  // Quick Status Actions
  const handleQuickStatusChange = async (id: string, status: string, message: string) => {
    try {
      const { error } = await supabase
        .from('file_submissions')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast.success(message);
      await fetchSubmissions();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to update status');
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to PERMANENTLY delete this file submission? This cannot be undone.')) return;
    try {
      const { error } = await supabase
        .from('file_submissions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('File permanently deleted');
      await fetchSubmissions();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to delete file');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <button 
            onClick={() => navigate('/admin/file-forms')}
            className="text-xs text-text-muted hover:text-white flex items-center gap-1 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to File Form Management
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white tracking-tight">File Submissions & Form Editor</h2>
            <span className="text-[10px] uppercase font-bold tracking-widest text-accent-blue bg-accent-blue/10 px-2.5 py-1 rounded-full border border-accent-blue/20">
              Admin Control
            </span>
          </div>
          <p className="text-text-secondary text-sm mt-1">
            Review, manage, and edit file submissions across all statuses (Open, Cleared, and Deleted).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchSubmissions}
            className="border-bg-border hover:bg-bg-primary text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-bg-border/70 bg-bg-secondary/60">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-text-secondary uppercase tracking-wider font-semibold">Total Submissions</span>
            <FolderOpen className="w-4 h-4 text-accent-blue" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">{counts.all}</div>
          <div className="text-xs text-text-muted mt-0.5">Across all statuses</div>
        </Card>

        <Card className="p-4 border-bg-border/70 bg-bg-secondary/60">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-text-secondary uppercase tracking-wider font-semibold">Open Files</span>
            <Clock className="w-4 h-4 text-accent-blue" />
          </div>
          <div className="text-2xl font-bold text-accent-blue tracking-tight">{counts.open}</div>
          <div className="text-xs text-text-muted mt-0.5">Ready to be processed or edited</div>
        </Card>

        <Card className="p-4 border-bg-border/70 bg-bg-secondary/60">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-text-secondary uppercase tracking-wider font-semibold">Cleared Files</span>
            <CheckCircle2 className="w-4 h-4 text-pink-500" />
          </div>
          <div className="text-2xl font-bold text-pink-500 tracking-tight">{counts.cleared}</div>
          <div className="text-xs text-text-muted mt-0.5">Cleared by file handlers</div>
        </Card>

        <Card className="p-4 border-bg-border/70 bg-bg-secondary/60">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-text-secondary uppercase tracking-wider font-semibold">Deleted Files</span>
            <Trash2 className="w-4 h-4 text-accent-red" />
          </div>
          <div className="text-2xl font-bold text-accent-red tracking-tight">{counts.deleted}</div>
          <div className="text-xs text-text-muted mt-0.5">Moved to deleted bucket</div>
        </Card>
      </div>

      {/* Main Content Card */}
      <Card className="p-0 overflow-hidden flex flex-col border border-bg-border/80">
        {/* Navigation Tabs & Filter Bar */}
        <div className="p-4 border-b border-bg-border bg-bg-secondary flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
          {/* Status Tabs */}
          <div className="flex bg-bg-primary/80 p-1 rounded-xl border border-bg-border shrink-0 gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab('open')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'open' ? 'bg-accent-blue text-white shadow-sm' : 'text-text-secondary hover:text-white'
              }`}
            >
              Open Files
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{counts.open}</span>
            </button>
            <button
              onClick={() => setActiveTab('cleared')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'cleared' ? 'bg-pink-600 text-white shadow-sm' : 'text-text-secondary hover:text-white'
              }`}
            >
              Cleared Files
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{counts.cleared}</span>
            </button>
            <button
              onClick={() => setActiveTab('deleted')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'deleted' ? 'bg-accent-red text-white shadow-sm' : 'text-text-secondary hover:text-white'
              }`}
            >
              Deleted Files
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{counts.deleted}</span>
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'all' ? 'bg-bg-hover text-white shadow-sm' : 'text-text-secondary hover:text-white'
              }`}
            >
              All Files
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{counts.all}</span>
            </button>
          </div>

          {/* Search and Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
            <div className="relative flex-1 sm:max-w-[200px] min-w-[150px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input 
                type="text" 
                placeholder="Search lead, customer..."
                className="w-full bg-bg-primary border border-bg-border rounded-lg pl-9 pr-3 py-1.5 text-white text-xs focus:outline-none focus:border-accent-blue placeholder:text-text-muted"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Template Dropdown */}
            <div className="flex items-center gap-1.5 bg-bg-primary border border-bg-border rounded-lg px-2.5 py-1.5">
              <FileText className="w-3.5 h-3.5 text-accent-blue shrink-0" />
              <select
                className="bg-transparent text-white text-xs focus:outline-none cursor-pointer max-w-[130px] truncate"
                value={selectedTemplate}
                onChange={e => setSelectedTemplate(e.target.value)}
                title="Filter by File Template"
              >
                <option value="all" className="bg-bg-secondary text-white">All Templates</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id} className="bg-bg-secondary text-white">{t.name}</option>
                ))}
              </select>
            </div>

            {/* File Handler Dropdown */}
            <div className="flex items-center gap-1.5 bg-bg-primary border border-bg-border rounded-lg px-2.5 py-1.5">
              <User className="w-3.5 h-3.5 text-accent-green shrink-0" />
              <select
                className="bg-transparent text-white text-xs focus:outline-none cursor-pointer max-w-[130px] truncate"
                value={selectedFH}
                onChange={e => setSelectedFH(e.target.value)}
                title="Filter by File Handler"
              >
                <option value="all" className="bg-bg-secondary text-white">All File Handlers</option>
                {availableFileHandlers.map(fh => (
                  <option key={fh.id} value={fh.id} className="bg-bg-secondary text-white">{fh.name}</option>
                ))}
              </select>
            </div>

            {/* Surveyor Dropdown */}
            <div className="flex items-center gap-1.5 bg-bg-primary border border-bg-border rounded-lg px-2.5 py-1.5">
              <User className="w-3.5 h-3.5 text-accent-yellow shrink-0" />
              <select
                className="bg-transparent text-white text-xs focus:outline-none cursor-pointer max-w-[130px] truncate"
                value={selectedSurveyor}
                onChange={e => setSelectedSurveyor(e.target.value)}
                title="Filter by Surveyor"
              >
                <option value="all" className="bg-bg-secondary text-white">All Surveyors</option>
                {availableSurveyors.map(s => (
                  <option key={s.id} value={s.id} className="bg-bg-secondary text-white">{s.name}</option>
                ))}
              </select>
            </div>

            {/* Telecaller Dropdown */}
            <div className="flex items-center gap-1.5 bg-bg-primary border border-bg-border rounded-lg px-2.5 py-1.5">
              <User className="w-3.5 h-3.5 text-pink-400 shrink-0" />
              <select
                className="bg-transparent text-white text-xs focus:outline-none cursor-pointer max-w-[130px] truncate"
                value={selectedTelecaller}
                onChange={e => setSelectedTelecaller(e.target.value)}
                title="Filter by Telecaller"
              >
                <option value="all" className="bg-bg-secondary text-white">All Telecallers</option>
                {availableTelecallers.map(tc => (
                  <option key={tc.id} value={tc.id} className="bg-bg-secondary text-white">{tc.name}</option>
                ))}
              </select>
            </div>

            {/* Reset Filters Button */}
            {(selectedTemplate !== 'all' || selectedFH !== 'all' || selectedSurveyor !== 'all' || selectedTelecaller !== 'all' || searchTerm.trim() !== '') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedTemplate('all');
                  setSelectedFH('all');
                  setSelectedSurveyor('all');
                  setSelectedTelecaller('all');
                  setSearchTerm('');
                }}
                className="px-2.5 py-1.5 text-xs text-accent-red hover:bg-accent-red/10 rounded-lg border border-accent-red/20 transition-colors flex items-center gap-1 shrink-0 font-medium"
                title="Reset all filters"
              >
                <X className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm min-w-[850px]">
            <thead>
              <tr className="bg-bg-primary/50 text-text-muted text-[10px] uppercase tracking-widest border-b border-bg-border">
                <th className="py-3.5 px-4 font-semibold">File Template</th>
                <th className="py-3.5 px-4 font-semibold">Customer / Lead</th>
                <th className="py-3.5 px-4 font-semibold">File Handler</th>
                <th className="py-3.5 px-4 font-semibold">Surveyor</th>
                <th className="py-3.5 px-4 font-semibold">Telecaller</th>
                <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                <th className="py-3.5 px-4 font-semibold">Updated At</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedSubmissions.map(item => {
                const customerName = getCustomerName(item);
                const fhName = item.file_handler?.full_name || item.file_handler?.username || 'Unassigned';
                const surveyor = item.original_lead?.surveyor?.full_name || item.original_lead?.surveyor?.username || '-';
                const telecaller = item.original_lead?.telecaller?.full_name || item.original_lead?.telecaller?.username || '-';

                const isCleared = item.status === 'cleared' || item.status === 'closed';
                const isDeleted = item.status === 'deleted';
                const statusBadgeVariant = isDeleted ? 'red' : isCleared ? 'pink' : 'blue';
                const statusLabel = isDeleted ? 'DELETED' : isCleared ? 'CLEARED' : 'OPEN FILE';

                return (
                  <tr key={item.id} className="border-b border-bg-border last:border-0 hover:bg-bg-hover/40 transition-colors">
                    {/* Template */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded bg-bg-primary border border-bg-border flex items-center justify-center shrink-0">
                          <FileText className="w-3.5 h-3.5 text-accent-blue" />
                        </div>
                        <span className="font-medium text-white text-xs sm:text-sm">
                          {item.file_form_template?.name || 'File Form'}
                        </span>
                      </div>
                    </td>

                    {/* Customer / Lead */}
                    <td className="py-3 px-4 text-white">
                      <div>
                        <span className="font-medium text-sm block">
                          {customerName || (item.original_lead_id ? item.original_lead_id.slice(0, 8) + '...' : 'Independent File')}
                        </span>
                        {item.original_lead_id && (
                          <span className="text-[10px] text-text-muted font-mono block">
                            ID: {item.original_lead_id.slice(0, 8)}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* File Handler */}
                    <td className="py-3 px-4 text-text-secondary text-xs font-medium">
                      <span className="inline-flex items-center gap-1 text-white">
                        <User className="w-3 h-3 text-accent-green" />
                        {fhName}
                      </span>
                    </td>

                    {/* Surveyor */}
                    <td className="py-3 px-4 text-text-secondary text-xs">
                      {surveyor}
                    </td>

                    {/* Telecaller */}
                    <td className="py-3 px-4 text-text-secondary text-xs">
                      {telecaller}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4 text-center">
                      <Badge variant={statusBadgeVariant as any}>
                        {statusLabel}
                      </Badge>
                    </td>

                    {/* Updated At */}
                    <td className="py-3 px-4 text-text-secondary text-xs">
                      {new Date(item.updated_at || item.submitted_at).toLocaleString()}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setViewingFile(item)}
                          className="border-accent-blue/30 text-accent-blue hover:bg-accent-blue/10 text-xs py-1 px-2 flex items-center gap-1"
                          title="View File Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => handleOpenEditModal(item)}
                          className="bg-accent-blue/10 text-accent-blue hover:bg-accent-blue hover:text-white border border-accent-blue/30 text-xs py-1 px-2 flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit Form
                        </Button>

                        {/* Quick Action Buttons */}
                        {item.status === 'submitted' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleQuickStatusChange(item.id, 'cleared', 'File marked as Cleared')}
                            className="border-pink-500/30 text-pink-500 hover:bg-pink-500/10 text-xs py-1 px-2"
                            title="Mark as Cleared"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </Button>
                        )}

                        {item.status !== 'deleted' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleQuickStatusChange(item.id, 'deleted', 'File moved to Deleted')}
                            className="border-accent-red/20 text-accent-red hover:bg-accent-red/10 text-xs py-1 px-2"
                            title="Move to Deleted"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleQuickStatusChange(item.id, 'submitted', 'File restored to Open bucket')}
                              className="border-accent-blue/30 text-accent-blue hover:bg-accent-blue/10 text-xs py-1 px-2"
                              title="Restore File"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handlePermanentDelete(item.id)}
                              className="bg-accent-red/10 text-accent-red hover:bg-accent-red hover:text-white border border-accent-red/30 text-xs py-1 px-2"
                              title="Delete Permanently"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {paginatedSubmissions.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-text-muted italic">
                    No file submissions found for the selected filters.
                  </td>
                </tr>
              )}

              {isLoading && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-text-muted">
                    Loading file submissions...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {filteredSubmissions.length > itemsPerPage && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-bg-border bg-bg-secondary/40 shrink-0">
            <div className="text-xs text-text-muted">
              Showing <span className="text-white font-medium">{(page - 1) * itemsPerPage + 1}</span> to <span className="text-white font-medium">{Math.min(page * itemsPerPage, filteredSubmissions.length)}</span> of <span className="text-white font-medium">{filteredSubmissions.length}</span> results
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="bg-bg-secondary text-white border border-bg-border hover:bg-bg-border disabled:opacity-50 text-xs px-3 py-1 rounded-md transition-colors"
              >
                Previous
              </button>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="bg-bg-secondary text-white border border-bg-border hover:bg-bg-border disabled:opacity-50 text-xs px-3 py-1 rounded-md transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* ================= EDITABLE FILE FORM MODAL ================= */}
      {editingFile && editingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-bg-secondary w-full max-w-[95vw] md:max-w-7xl rounded-2xl shadow-2xl border border-bg-border flex flex-col h-[92vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-bg-border flex justify-between items-start bg-bg-secondary shrink-0">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap mb-1">
                  <h3 className="text-lg sm:text-xl font-bold text-white leading-tight">
                    {editingTemplate.name}
                  </h3>
                  <Badge variant={editStatus === 'deleted' ? 'red' : (editStatus === 'cleared' || editStatus === 'closed') ? 'pink' : 'blue'}>
                    {(editStatus === 'cleared' || editStatus === 'closed') ? 'CLEARED' : editStatus === 'deleted' ? 'DELETED' : 'OPEN FILE'}
                  </Badge>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-accent-green bg-accent-green/10 px-2 py-0.5 rounded border border-accent-green/20">
                    Edit Mode
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-text-muted flex-wrap">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-accent-green" />
                    <span className="text-text-secondary">Handler:</span>
                    <strong className="text-white font-medium">
                      {availableFileHandlers.find(fh => fh.id === editFileHandlerId)?.name || editingFile.file_handler?.full_name || editingFile.file_handler?.username || 'Unassigned'}
                    </strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-accent-yellow" />
                    <span className="text-text-secondary">Surveyor:</span>
                    <strong className="text-white font-medium">
                      {editingFile.original_lead?.surveyor?.full_name || editingFile.original_lead?.surveyor?.username || '-'}
                    </strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-pink-400" />
                    <span className="text-text-secondary">Telecaller:</span>
                    <strong className="text-white font-medium">
                      {editingFile.original_lead?.telecaller?.full_name || editingFile.original_lead?.telecaller?.username || '-'}
                    </strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-text-muted" />
                    <span className="text-text-secondary">Updated:</span>
                    <strong className="text-white font-medium">
                      {new Date(editingFile.updated_at || editingFile.submitted_at).toLocaleString()}
                    </strong>
                  </span>
                  {editingFile.original_lead_id && (
                    <span>
                      Lead ID: <span className="font-mono text-text-secondary">{editingFile.original_lead_id.slice(0, 8)}</span>
                    </span>
                  )}
                </div>
              </div>

              <button 
                onClick={() => setEditingFile(null)} 
                className="text-text-muted hover:text-white p-1 rounded-lg hover:bg-bg-primary transition-colors shrink-0"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body: Two Columns */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
              {/* Left Column: Form Editor (Editable Form) */}
              <div className="w-full md:w-1/2 p-6 overflow-y-auto border-b md:border-b-0 md:border-r border-bg-border">
                <div className="flex items-center justify-between pb-3 border-b border-bg-border mb-5 flex-wrap gap-2">
                  <h4 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-accent-green" />
                    Edit File Form Entry
                  </h4>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs text-text-muted">Handler:</label>
                      <select
                        value={editFileHandlerId}
                        onChange={e => setEditFileHandlerId(e.target.value)}
                        className="bg-bg-primary border border-bg-border rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-accent-blue font-medium max-w-[150px] truncate"
                      >
                        <option value="">Unassigned</option>
                        {availableFileHandlers.map(fh => (
                          <option key={fh.id} value={fh.id}>{fh.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs text-text-muted">Status:</label>
                      <select
                        value={editStatus}
                        onChange={e => setEditStatus(e.target.value)}
                        className="bg-bg-primary border border-bg-border rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-accent-blue font-medium"
                      >
                        <option value="submitted">Open File</option>
                        <option value="cleared">Cleared</option>
                        <option value="deleted">Deleted</option>
                      </select>
                    </div>
                  </div>
                </div>

                <form id="edit-file-form" onSubmit={handleSaveForm} className="space-y-6">
                  {/* Template Standard Fields */}
                  <div className="space-y-4">
                    {editingTemplate.fields.map(field => (
                      <div key={field.id} className="bg-bg-primary/70 rounded-xl p-4 border border-bg-border/80 shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-white uppercase tracking-wider block">
                            {field.label} {field.required && <span className="text-accent-red">*</span>}
                          </label>
                          {field.type && (
                            <span className="text-[9px] uppercase font-semibold text-text-muted bg-bg-secondary px-1.5 py-0.5 rounded">
                              {field.type.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                        {field.helpText && <p className="text-xs text-text-muted">{field.helpText}</p>}
                        <FormFieldRender
                          field={field}
                          value={formData[field.id]}
                          onChange={(val) => setFormData(prev => ({ ...prev, [field.id]: val }))}
                        />
                      </div>
                    ))}

                    {editingTemplate.fields.length === 0 && (
                      <p className="text-sm text-text-muted italic py-4 text-center">
                        No standard fields defined on this template.
                      </p>
                    )}
                  </div>

                  {/* Custom Questions Section */}
                  <div className="pt-6 border-t border-bg-border">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                        <HelpCircle className="w-3.5 h-3.5 text-accent-yellow" />
                        Custom Questions
                      </h4>
                      <Button type="button" variant="outline" size="sm" onClick={addCustomField} className="text-xs py-1">
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Question
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {customFields.map((cf, index) => (
                        <div key={cf.id} className="bg-bg-primary/70 p-3.5 rounded-xl border border-bg-border space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] text-text-secondary uppercase tracking-wider font-bold">
                              Question {index + 1}
                            </label>
                            <button
                              type="button"
                              onClick={() => removeCustomField(cf.id)}
                              className="text-text-muted hover:text-accent-red p-1 transition-colors"
                              title="Delete Question"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <Input
                            value={cf.question}
                            onChange={(e) => updateCustomField(cf.id, 'question', e.target.value)}
                            placeholder="Enter question here..."
                            required
                          />
                          <Input
                            value={cf.answer}
                            onChange={(e) => updateCustomField(cf.id, 'answer', e.target.value)}
                            placeholder="Enter answer here..."
                            required
                          />
                        </div>
                      ))}

                      {customFields.length === 0 && (
                        <p className="text-xs text-text-muted italic">No custom questions added yet.</p>
                      )}
                    </div>
                  </div>
                </form>
              </div>

              {/* Right Column: Original Lead Reference */}
              <div className="w-full md:w-1/2 p-6 overflow-y-auto bg-bg-primary/20">
                <div className="flex items-center justify-between pb-3 border-b border-bg-border mb-4">
                  <h4 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                    <Eye className="w-4 h-4 text-accent-blue" />
                    Original Lead Information (Reference)
                  </h4>
                  {editingFile.original_lead?.form_templates && (
                    <span className="text-[11px] text-accent-blue font-medium">
                      {(Array.isArray(editingFile.original_lead.form_templates) ? editingFile.original_lead.form_templates[0]?.name : editingFile.original_lead.form_templates?.name) || 'Lead Form'}
                    </span>
                  )}
                </div>

                {/* Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                  <div className="bg-bg-primary p-3 rounded-xl border border-bg-border shadow-sm">
                    <span className="text-[10px] text-text-muted uppercase tracking-wider font-bold block mb-1">Surveyor</span>
                    <span className="text-xs text-white font-medium truncate block">
                      {editingFile.original_lead?.surveyor?.full_name || editingFile.original_lead?.surveyor?.username || '-'}
                    </span>
                  </div>
                  <div className="bg-bg-primary p-3 rounded-xl border border-bg-border shadow-sm">
                    <span className="text-[10px] text-text-muted uppercase tracking-wider font-bold block mb-1">Telecaller</span>
                    <span className="text-xs text-white font-medium truncate block">
                      {editingFile.original_lead?.telecaller?.full_name || editingFile.original_lead?.telecaller?.username || '-'}
                    </span>
                  </div>
                  <div className="bg-bg-primary p-3 rounded-xl border border-bg-border shadow-sm">
                    <span className="text-[10px] text-text-muted uppercase tracking-wider font-bold block mb-1">Lead Status</span>
                    <span className="text-xs text-accent-green font-medium capitalize block">
                      {editingFile.original_lead?.lead_status?.replace(/_/g, ' ') || 'Closed'}
                    </span>
                  </div>
                </div>

                {/* Lead Form Answers */}
                {!editingFile.original_lead_id ? (
                  <div className="p-8 text-center border-2 border-dashed border-bg-border rounded-xl">
                    <p className="text-sm text-text-muted italic">This is an independent file created without a linked surveyor lead.</p>
                  </div>
                ) : !editingFile.original_lead?.data || Object.keys(editingFile.original_lead.data).length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-bg-border rounded-xl">
                    <p className="text-sm text-text-muted italic">No data recorded for this lead.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      const tmpl = Array.isArray(editingFile.original_lead.form_templates)
                        ? editingFile.original_lead.form_templates[0]
                        : editingFile.original_lead.form_templates;
                      const leadFields = tmpl?.fields && Array.isArray(tmpl.fields)
                        ? [...tmpl.fields].sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
                        : Object.keys(editingFile.original_lead.data).map(key => ({ id: key, label: key }));

                      return leadFields.map((field: any) => {
                        const value = editingFile.original_lead.data[field.id];
                        if (value === undefined || value === null || value === '') return null;

                        let displayVal: any = value;
                        if (typeof value === 'object') {
                          if (value.lat && value.lng) {
                            displayVal = `Lat: ${value.lat.toFixed(6)}, Lng: ${value.lng.toFixed(6)}`;
                          } else if (Array.isArray(value)) {
                            displayVal = value.join(', ');
                          } else {
                            displayVal = JSON.stringify(value);
                          }
                        } else {
                          displayVal = String(value);
                        }

                        return (
                          <div 
                            key={field.id} 
                            className="bg-bg-secondary p-3.5 rounded-lg border border-bg-border shadow-sm group hover:border-accent-blue/40 transition-colors"
                          >
                            <span className="text-[10px] uppercase font-bold text-text-muted block mb-1 tracking-wider">
                              {field.label}
                            </span>
                            <span className="text-sm text-white break-words font-medium">
                              {displayVal.toString().startsWith('http') ? (
                                <a href={displayVal} target="_blank" rel="noreferrer" className="text-accent-blue hover:underline inline-flex items-center gap-1">
                                  View Uploaded File <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                displayVal
                              )}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-bg-border shrink-0 flex items-center justify-between bg-bg-secondary rounded-b-2xl">
              <div className="text-xs text-text-muted">
                Admin mode: All changes are synced to database
              </div>
              <div className="flex gap-2.5">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingFile(null)} 
                  disabled={isSaving}
                  className="px-5 text-white"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  form="edit-file-form" 
                  isLoading={isSaving}
                  className="px-6 bg-accent-blue hover:bg-accent-blue/90"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View File Submission Modal */}
      {viewingFile && (
        <ViewFileSubmissionModal
          file={viewingFile}
          onClose={() => setViewingFile(null)}
        />
      )}
    </div>
  );
}
