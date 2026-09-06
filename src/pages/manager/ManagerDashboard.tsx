import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { 
  Users, FolderOpen, FileText, ChevronLeft, ChevronRight, ChevronDown, 
  Activity, PieChart, Loader2, Eye, X, Building2, FileCheck, Layers
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const getStatusBadgeVariant = (status?: string) => {
  switch (status?.toLowerCase()) {
    case 'new': return 'gray';
    case 'cold': return 'blue';
    case 'warm': return 'yellow';
    case 'hot': return 'orange';
    case 'immediate': return 'red';
    case 'reverted_to_tl': return 'purple';
    case 'wrong_number': return 'purple';
    case 'skipped': return 'purple';
    case 'closed': return 'green';
    case 'deleted': return 'red';
    default: return 'blue';
  }
};

interface TeamLeadSummary {
  id: string;
  name: string;
  totalEntries: number;
  assigned: number;
  newLeads: number;
  immediate: number;
  wrongNumber: number;
  reverted: number;
  closed: number;
  deleted: number;
  telecallers: Record<string, {
    id: string;
    name: string;
    assigned: number;
    newLeads: number;
    immediate: number;
    wrongNumber: number;
    reverted: number;
    closed: number;
    deleted: number;
  }>;
}

interface FileHandlerSummary {
  id: string;
  name: string;
  assignedLeads: number;
  totalSubmitted: number;
  totalClosed: number;
  linkedFilesCount?: number;
}

export default function ManagerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'slider' | 'tl_reports' | 'fh_reports' | 'custom_analytics'>('slider');
  const [isLoading, setIsLoading] = useState(true);

  // Assigned teams
  const [assignedTLs, setAssignedTLs] = useState<any[]>([]);
  const [assignedFHs, setAssignedFHs] = useState<any[]>([]);
  const [selectedTLFilter, setSelectedTLFilter] = useState<string>('all');

  // Submissions under assigned TLs
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [surveyorToTlMap, setSurveyorToTlMap] = useState<Map<string, { id: string, name: string }>>(new Map());

  // Slider state
  const [activeSlide, setActiveSlide] = useState(0);
  const [slidePage, setSlidePage] = useState(1);
  const itemsPerPage = 20;

  // Selected Submission Modal
  const [selectedSub, setSelectedSub] = useState<any | null>(null);

  // Admin-style reports
  const [teamLeadData, setTeamLeadData] = useState<TeamLeadSummary[]>([]);
  const [expandedTlRows, setExpandedTlRows] = useState<Set<string>>(new Set());
  const [fileHandlerData, setFileHandlerData] = useState<FileHandlerSummary[]>([]);

  // Custom Dashboard analysis templates
  const [surveyorTemplates, setSurveyorTemplates] = useState<any[]>([]);
  const [fileTemplates, setFileTemplates] = useState<any[]>([]);
  const [customDashboardTab, setCustomDashboardTab] = useState<'surveyor' | 'file'>('surveyor');

  useEffect(() => {
    fetchManagerData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    setSlidePage(1);
  }, [activeSlide, selectedTLFilter]);

  const fetchManagerData = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      // 1. Fetch fresh manager record to get assigned team leads (team_lead_ids) and file handlers (assigned_users)
      const { data: managerRecord, error: mErr } = await supabase
        .from('surveyors')
        .select('*')
        .eq('id', user.id)
        .single();

      if (mErr) throw mErr;

      const tlIds: string[] = managerRecord?.team_lead_ids || [];
      const fhIds: string[] = managerRecord?.assigned_users || [];

      // 2. Fetch Team Leads and File Handlers records
      const allSubordinateIds = [...tlIds, ...fhIds];
      let subordinates: any[] = [];
      if (allSubordinateIds.length > 0) {
        const { data: subsData } = await supabase
          .from('surveyors')
          .select('*, user_role:user_roles(name)')
          .in('id', allSubordinateIds);
        subordinates = subsData || [];
      }

      const teamLeads = subordinates.filter(s => {
        const r = (s.user_role as any)?.name?.toLowerCase() || '';
        return r.includes('team lead') || tlIds.includes(s.id);
      });
      setAssignedTLs(teamLeads);

      const fileHandlers = subordinates.filter(s => {
        const r = (s.user_role as any)?.name?.toLowerCase() || '';
        return r.includes('file handler') || fhIds.includes(s.id);
      });
      setAssignedFHs(fileHandlers);

      // 3. Collect surveyor IDs managed under these team leads
      let allManagedSurveyorIds: string[] = [];
      const sMap = new Map<string, { id: string, name: string }>();

      teamLeads.forEach(tl => {
        if (tl.assigned_users && Array.isArray(tl.assigned_users)) {
          tl.assigned_users.forEach((sId: string) => {
            allManagedSurveyorIds.push(sId);
            sMap.set(sId, { id: tl.id, name: tl.full_name || tl.username });
          });
        }
      });
      allManagedSurveyorIds = Array.from(new Set(allManagedSurveyorIds));
      setSurveyorToTlMap(sMap);

      // 4. Fetch Submissions for these surveyors
      let subsData: any[] = [];
      if (allManagedSurveyorIds.length > 0) {
        const { data, error } = await supabase
          .from('submissions')
          .select(`
            id,
            status,
            submitted_at,
            lead_status,
            lead_status_updated_at,
            surveyor_id,
            telecaller_id,
            form_template_id,
            admin_notes,
            data,
            surveyor:surveyors!surveyor_id(full_name, username),
            telecaller:surveyors!telecaller_id(id, full_name, username),
            form_templates(name)
          `)
          .in('surveyor_id', allManagedSurveyorIds)
          .order('submitted_at', { ascending: false });

        if (error) throw error;
        subsData = data || [];
      }
      setSubmissions(subsData);

      // 5. Compute Admin-Style "Team Lead Performance Report" data
      const tlReportMap: Record<string, TeamLeadSummary> = {};
      teamLeads.forEach(tl => {
        tlReportMap[tl.id] = {
          id: tl.id,
          name: tl.full_name || tl.username,
          totalEntries: 0,
          assigned: 0,
          newLeads: 0,
          immediate: 0,
          wrongNumber: 0,
          reverted: 0,
          closed: 0,
          deleted: 0,
          telecallers: {}
        };
      });

      subsData.forEach(sub => {
        const tlInfo = sub.surveyor_id ? sMap.get(sub.surveyor_id) : null;
        if (!tlInfo || !tlReportMap[tlInfo.id]) return;

        const tlObj = tlReportMap[tlInfo.id];
        tlObj.totalEntries += 1;

        const stat = sub.lead_status || 'new';
        if (sub.telecaller_id) {
          tlObj.assigned += 1;
        }

        if (stat === 'new') tlObj.newLeads += 1;
        else if (stat === 'immediate') tlObj.immediate += 1;
        else if (stat === 'wrong_number') tlObj.wrongNumber += 1;
        else if (stat === 'reverted_to_tl' || sub.status === 'reverted') tlObj.reverted += 1;
        else if (stat === 'closed') tlObj.closed += 1;
        else if (stat === 'deleted') tlObj.deleted += 1;

        if (sub.telecaller_id) {
          const tcId = sub.telecaller_id;
          const tcName = sub.telecaller?.full_name || sub.telecaller?.username || 'Unknown Telecaller';
          if (!tlObj.telecallers[tcId]) {
            tlObj.telecallers[tcId] = {
              id: tcId,
              name: tcName,
              assigned: 0,
              newLeads: 0,
              immediate: 0,
              wrongNumber: 0,
              reverted: 0,
              closed: 0,
              deleted: 0
            };
          }

          const tcObj = tlObj.telecallers[tcId];
          tcObj.assigned += 1;
          if (stat === 'new') tcObj.newLeads += 1;
          else if (stat === 'immediate') tcObj.immediate += 1;
          else if (stat === 'wrong_number') tcObj.wrongNumber += 1;
          else if (stat === 'reverted_to_tl' || sub.status === 'reverted') tcObj.reverted += 1;
          else if (stat === 'closed') tcObj.closed += 1;
          else if (stat === 'deleted') tcObj.deleted += 1;
        }
      });

      setTeamLeadData(Object.values(tlReportMap));

      // 6. Compute File Handler Performance Report data
      const fhReportMap: Record<string, FileHandlerSummary> = {};
      fileHandlers.forEach(fh => {
        fhReportMap[fh.id] = {
          id: fh.id,
          name: fh.full_name || fh.username,
          assignedLeads: 0,
          totalSubmitted: 0,
          totalClosed: 0,
          linkedFilesCount: 0
        };
      });

      if (fhIds.length > 0) {
        const { data: fsData } = await supabase
          .from('file_submissions')
          .select('id, file_handler_id, original_lead_id, status')
          .in('file_handler_id', fhIds);

        if (fsData) {
          fsData.forEach(fs => {
            if (fhReportMap[fs.file_handler_id]) {
              fhReportMap[fs.file_handler_id].totalSubmitted += 1;
              if (fs.status === 'closed' || fs.status === 'cleared') {
                fhReportMap[fs.file_handler_id].totalClosed += 1;
              }
              if (fs.original_lead_id) {
                fhReportMap[fs.file_handler_id].linkedFilesCount = (fhReportMap[fs.file_handler_id].linkedFilesCount || 0) + 1;
              }
            }
          });
        }
      }

      setFileHandlerData(Object.values(fhReportMap));

      // 7. Fetch active templates for Custom Dashboard Analysis
      const [
        { data: sTemplates },
        { data: fTemplates }
      ] = await Promise.all([
        supabase.from('form_templates').select('id, name, description').eq('is_active', true).or('is_deleted.is.null,is_deleted.eq.false'),
        supabase.from('file_form_templates').select('id, name, description').eq('is_active', true).or('is_deleted.is.null,is_deleted.eq.false')
      ]);

      setSurveyorTemplates(sTemplates || []);
      setFileTemplates(fTemplates || []);

    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load manager dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSub = async (sub: any) => {
    if (!sub) return;
    setSelectedSub(sub);
    if (!sub.form_templates?.fields && sub.form_template_id) {
      try {
        const { data: tmpl } = await supabase
          .from('form_templates')
          .select('fields')
          .eq('id', sub.form_template_id)
          .single();
        if (tmpl?.fields) {
          setSelectedSub((prev: any) => prev && prev.id === sub.id ? { ...prev, form_templates: { ...prev.form_templates, fields: tmpl.fields } } : prev);
        }
      } catch (err) {
        console.error('Failed to fetch template fields:', err);
      }
    }
  };

  const toggleTlRow = (id: string) => {
    setExpandedTlRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filter submissions by chosen Team Lead
  const displayedSubmissions = submissions.filter(sub => {
    if (selectedTLFilter === 'all') return true;
    const tlInfo = sub.surveyor_id ? surveyorToTlMap.get(sub.surveyor_id) : null;
    return tlInfo?.id === selectedTLFilter;
  });

  // Slider data structures
  const telecallerReport = displayedSubmissions.reduce((acc, sub) => {
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
  const assignedLeadsLogs = displayedSubmissions.filter(s => s.telecaller_id);
  const immediateLeads = displayedSubmissions.filter(s => s.lead_status === 'immediate');
  const revertedLeads = displayedSubmissions.filter(s => s.lead_status === 'reverted_to_tl');
  const wrongNumberLeads = displayedSubmissions.filter(s => s.lead_status === 'wrong_number');
  const closedLeads = displayedSubmissions.filter(s => s.lead_status === 'closed');
  const deletedLeads = displayedSubmissions.filter(s => s.lead_status === 'deleted');

  const getPaginated = (arr: any[]) => arr.slice((slidePage - 1) * itemsPerPage, slidePage * itemsPerPage);

  const paginatedTelecallerData = getPaginated(telecallerData);
  const paginatedAssignedLeadsLogs = getPaginated(assignedLeadsLogs);
  const paginatedImmediateLeads = getPaginated(immediateLeads);
  const paginatedRevertedLeads = getPaginated(revertedLeads);
  const paginatedWrongNumberLeads = getPaginated(wrongNumberLeads);
  const paginatedClosedLeads = getPaginated(closedLeads);
  const paginatedDeletedLeads = getPaginated(deletedLeads);

  const slides = [
    { id: 'performance', title: 'Telecaller Performance Report' },
    { id: 'assigned', title: 'Leads Assigned Logs' },
    { id: 'immediate', title: 'Immediate Leads' },
    { id: 'reverted', title: 'Reverted by TC' },
    { id: 'wrong_number', title: 'Wrong Numbers' },
    { id: 'closed_leads', title: 'Closed Leads' },
    { id: 'deleted_leads', title: 'Deleted Leads' }
  ];

  const nextSlide = () => setActiveSlide(prev => (prev + 1) % slides.length);
  const prevSlide = () => setActiveSlide(prev => (prev - 1 + slides.length) % slides.length);

  const getCurrentSlideCount = () => {
    switch (activeSlide) {
      case 0: return telecallerData.length;
      case 1: return assignedLeadsLogs.length;
      case 2: return immediateLeads.length;
      case 3: return revertedLeads.length;
      case 4: return wrongNumberLeads.length;
      case 5: return closedLeads.length;
      case 6: return deletedLeads.length;
      default: return 0;
    }
  };

  const currentSlideTotalPages = Math.ceil(getCurrentSlideCount() / itemsPerPage);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-bg-secondary border border-bg-border rounded-2xl p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-accent-blue/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="blue" className="px-3 py-1 font-semibold tracking-wider uppercase text-xs">Manager Workstation</Badge>
              <span className="text-text-muted text-xs">&bull; Oversight & Analytical Reporting</span>
            </div>
            <h2 className="text-3xl font-bold text-white tracking-tight">
              Welcome, {user?.full_name || 'Manager'}
            </h2>
            <p className="text-text-secondary text-sm mt-1">
              Supervising {assignedTLs.length} Team Leads and {assignedFHs.length} File Handlers.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex flex-wrap gap-3">
            <div className="bg-bg-primary border border-bg-border rounded-xl p-3 flex flex-col items-center min-w-[110px]">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Users className="w-4 h-4 text-accent-purple" />
                <span className="text-xl font-bold text-white">{assignedTLs.length}</span>
              </div>
              <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Team Leads</span>
            </div>

            <div className="bg-bg-primary border border-bg-border rounded-xl p-3 flex flex-col items-center min-w-[110px]">
              <div className="flex items-center gap-1.5 mb-0.5">
                <FolderOpen className="w-4 h-4 text-accent-green" />
                <span className="text-xl font-bold text-white">{assignedFHs.length}</span>
              </div>
              <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">File Handlers</span>
            </div>

            <div className="bg-bg-primary border border-bg-border rounded-xl p-3 flex flex-col items-center min-w-[110px]">
              <div className="flex items-center gap-1.5 mb-0.5">
                <FileText className="w-4 h-4 text-accent-blue" />
                <span className="text-xl font-bold text-white">{submissions.length}</span>
              </div>
              <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Total Leads</span>
            </div>

            <div className="bg-bg-primary border border-bg-border rounded-xl p-3 flex flex-col items-center min-w-[110px]">
              <div className="flex items-center gap-1.5 mb-0.5">
                <FileCheck className="w-4 h-4 text-accent-yellow" />
                <span className="text-xl font-bold text-white">
                  {fileHandlerData.reduce((acc, curr) => acc + curr.totalSubmitted, 0)}
                </span>
              </div>
              <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Files Handled</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto hide-scrollbar gap-2 border-b border-bg-border pb-3">
        <button
          onClick={() => setActiveTab('slider')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'slider'
              ? 'bg-accent-blue text-white shadow-lg shadow-accent-blue/20'
              : 'bg-bg-secondary text-text-secondary border border-bg-border hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          Team Lead Slider Reports
        </button>

        <button
          onClick={() => setActiveTab('tl_reports')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'tl_reports'
              ? 'bg-accent-blue text-white shadow-lg shadow-accent-blue/20'
              : 'bg-bg-secondary text-text-secondary border border-bg-border hover:text-white'
          }`}
        >
          <Building2 className="w-4 h-4" />
          By Team Lead Matrix
        </button>

        <button
          onClick={() => setActiveTab('fh_reports')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'fh_reports'
              ? 'bg-accent-blue text-white shadow-lg shadow-accent-blue/20'
              : 'bg-bg-secondary text-text-secondary border border-bg-border hover:text-white'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          File Handler Reports
        </button>

        <button
          onClick={() => setActiveTab('custom_analytics')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'custom_analytics'
              ? 'bg-accent-blue text-white shadow-lg shadow-accent-blue/20'
              : 'bg-bg-secondary text-text-secondary border border-bg-border hover:text-white'
          }`}
        >
          <PieChart className="w-4 h-4" />
          Custom Dashboard Analysis
        </button>
      </div>

      {/* TAB 1: TEAM LEAD SLIDER (READ-ONLY, NO ACTION BUTTONS) */}
      {activeTab === 'slider' && (
        <div className="space-y-6">
          {/* Team Lead Filter */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-bg-secondary border border-bg-border rounded-xl p-4">
            <div>
              <h3 className="text-sm font-bold text-white">Team Lead Operational Slider</h3>
              <p className="text-xs text-text-muted mt-0.5">Read-only oversight across all 7 operational report slides.</p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="text-xs text-text-muted uppercase tracking-wider font-semibold whitespace-nowrap">Filter Team Lead:</label>
              <select
                value={selectedTLFilter}
                onChange={(e) => setSelectedTLFilter(e.target.value)}
                className="bg-bg-primary border border-bg-border rounded-lg px-3 py-1.5 text-white text-xs focus:border-accent-blue focus:outline-none min-w-[180px]"
              >
                <option value="all">All Assigned Team Leads ({assignedTLs.length})</option>
                {assignedTLs.map(tl => (
                  <option key={tl.id} value={tl.id}>{tl.full_name || tl.username}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Slider Container */}
          <Card className="p-0 overflow-hidden border-accent-blue/30 shadow-[0_0_15px_rgba(79,110,247,0.08)]">
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-bg-border bg-bg-secondary flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-white">{slides[activeSlide].title}</h3>
                {activeSlide === 0 && <Badge variant="blue">{telecallerData.length} Telecallers</Badge>}
                {activeSlide === 1 && <Badge variant="blue">{assignedLeadsLogs.length} Leads</Badge>}
                {activeSlide === 2 && <Badge variant="red">{immediateLeads.length} Leads</Badge>}
                {activeSlide === 3 && <Badge variant="purple">{revertedLeads.length} Leads</Badge>}
                {activeSlide === 4 && <Badge variant="gray">{wrongNumberLeads.length} Leads</Badge>}
                {activeSlide === 5 && <Badge variant="green">{closedLeads.length} Leads</Badge>}
                {activeSlide === 6 && <Badge variant="red">{deletedLeads.length} Leads</Badge>}
              </div>

              {/* Slider Controls */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted font-medium mr-2">Slide {activeSlide + 1} of {slides.length}</span>
                <Button size="sm" variant="outline" onClick={prevSlide} className="p-2 border-bg-border hover:bg-bg-hover text-white">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={nextSlide} className="p-2 border-bg-border hover:bg-bg-hover text-white">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Slide Body */}
            <div className="overflow-x-auto min-h-[350px]">
              {/* SLIDE 0: TELECALLER PERFORMANCE */}
              {activeSlide === 0 && (
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-bg-primary/50 text-text-muted text-[10px] uppercase tracking-widest border-b border-bg-border">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Telecaller</th>
                      <th className="py-3 px-4 font-semibold text-center">Total Assigned</th>
                      <th className="py-3 px-4 font-semibold text-center text-accent-blue">New</th>
                      <th className="py-3 px-4 font-semibold text-center text-accent-blue">Cold</th>
                      <th className="py-3 px-4 font-semibold text-center text-accent-yellow">Warm</th>
                      <th className="py-3 px-4 font-semibold text-center text-accent-red">Hot</th>
                      <th className="py-3 px-4 font-semibold text-center text-accent-red">Immediate</th>
                      <th className="py-3 px-4 font-semibold text-center text-purple-400">Skipped</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTelecallerData.length > 0 ? paginatedTelecallerData.map(tc => (
                      <tr key={tc.id} className="border-b border-bg-border last:border-0 hover:bg-bg-hover/40 transition-colors">
                        <td className="py-3 px-4 text-white font-medium">{tc.name}</td>
                        <td className="py-3 px-4 text-center font-bold text-white">{tc.total}</td>
                        <td className="py-3 px-4 text-center text-accent-blue font-medium">{tc.new}</td>
                        <td className="py-3 px-4 text-center text-accent-blue font-medium">{tc.cold}</td>
                        <td className="py-3 px-4 text-center text-accent-yellow font-medium">{tc.warm}</td>
                        <td className="py-3 px-4 text-center text-accent-red font-medium">{tc.hot}</td>
                        <td className="py-3 px-4 text-center text-accent-red font-bold">{tc.immediate}</td>
                        <td className="py-3 px-4 text-center text-purple-400 font-medium">{tc.skipped}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={8} className="py-12 text-center text-text-muted italic">No telecaller data available for selected team lead.</td></tr>
                    )}
                  </tbody>
                </table>
              )}

              {/* SLIDE 1: LEADS ASSIGNED LOGS */}
              {activeSlide === 1 && (
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-bg-primary/50 text-text-muted text-[10px] uppercase tracking-widest border-b border-bg-border">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Lead ID</th>
                      <th className="py-3 px-4 font-semibold">Assigned Telecaller</th>
                      <th className="py-3 px-4 font-semibold">Surveyor</th>
                      <th className="py-3 px-4 font-semibold">Form Name</th>
                      <th className="py-3 px-4 font-semibold">Lead Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedAssignedLeadsLogs.length > 0 ? paginatedAssignedLeadsLogs.map(sub => (
                      <tr key={sub.id} className="border-b border-bg-border last:border-0 hover:bg-bg-hover/40 transition-colors">
                        <td className="py-3 px-4 text-white font-medium">{sub.id.split('-')[0].toUpperCase()}</td>
                        <td className="py-3 px-4 text-accent-blue font-medium">{sub.telecaller?.full_name || sub.telecaller?.username || 'Unknown'}</td>
                        <td className="py-3 px-4 text-text-secondary">{sub.surveyor?.full_name || sub.surveyor?.username || 'Unknown'}</td>
                        <td className="py-3 px-4 text-text-secondary">{sub.form_templates?.name || 'Unknown'}</td>
                        <td className="py-3 px-4">
                          <Badge variant={getStatusBadgeVariant(sub.lead_status) as any}>{sub.lead_status || 'New'}</Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button size="sm" variant="ghost" onClick={() => handleSelectSub(sub)} className="text-text-muted hover:text-white">
                            <Eye className="w-4 h-4 mr-1" /> View
                          </Button>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={6} className="py-12 text-center text-text-muted italic">No assigned leads logged.</td></tr>
                    )}
                  </tbody>
                </table>
              )}

              {/* SLIDE 2: IMMEDIATE LEADS */}
              {activeSlide === 2 && (
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-bg-primary/50 text-text-muted text-[10px] uppercase tracking-widest border-b border-bg-border">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Lead ID</th>
                      <th className="py-3 px-4 font-semibold">Surveyor</th>
                      <th className="py-3 px-4 font-semibold">Telecaller</th>
                      <th className="py-3 px-4 font-semibold">Form Name</th>
                      <th className="py-3 px-4 font-semibold">Date</th>
                      <th className="py-3 px-4 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedImmediateLeads.length > 0 ? paginatedImmediateLeads.map(sub => (
                      <tr key={sub.id} className="border-b border-bg-border last:border-0 hover:bg-bg-hover/40 transition-colors">
                        <td className="py-3 px-4 text-white font-medium">{sub.id.split('-')[0].toUpperCase()}</td>
                        <td className="py-3 px-4 text-text-secondary">{sub.surveyor?.full_name || sub.surveyor?.username}</td>
                        <td className="py-3 px-4 text-accent-blue">{sub.telecaller?.full_name || sub.telecaller?.username || 'Unassigned'}</td>
                        <td className="py-3 px-4 text-text-secondary">{sub.form_templates?.name || 'Unknown'}</td>
                        <td className="py-3 px-4 text-text-secondary text-xs">{new Date(sub.submitted_at).toLocaleDateString()}</td>
                        <td className="py-3 px-4 text-right">
                          <Button size="sm" variant="ghost" onClick={() => handleSelectSub(sub)} className="text-text-muted hover:text-white">
                            <Eye className="w-4 h-4 mr-1" /> View
                          </Button>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={6} className="py-12 text-center text-text-muted italic">No immediate leads.</td></tr>
                    )}
                  </tbody>
                </table>
              )}

              {/* SLIDE 3: REVERTED BY TC (READ-ONLY: NO CLOSE / DELETE BUTTONS) */}
              {activeSlide === 3 && (
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-bg-primary/50 text-text-muted text-[10px] uppercase tracking-widest border-b border-bg-border">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Lead ID</th>
                      <th className="py-3 px-4 font-semibold">Surveyor</th>
                      <th className="py-3 px-4 font-semibold">Telecaller</th>
                      <th className="py-3 px-4 font-semibold">Revert Reason</th>
                      <th className="py-3 px-4 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRevertedLeads.length > 0 ? paginatedRevertedLeads.map(sub => (
                      <tr key={sub.id} className="border-b border-bg-border last:border-0 hover:bg-bg-hover/40 transition-colors">
                        <td className="py-3 px-4 text-white font-medium">{sub.id.split('-')[0].toUpperCase()}</td>
                        <td className="py-3 px-4 text-text-secondary">{sub.surveyor?.full_name || sub.surveyor?.username}</td>
                        <td className="py-3 px-4 text-accent-blue">{sub.telecaller?.full_name || sub.telecaller?.username || 'Unassigned'}</td>
                        <td className="py-3 px-4 text-purple-400 text-xs">{sub.telecaller_remark || 'Reverted to TL'}</td>
                        <td className="py-3 px-4 text-right">
                          <Button size="sm" variant="ghost" onClick={() => handleSelectSub(sub)} className="text-text-muted hover:text-white">
                            <Eye className="w-4 h-4 mr-1" /> View Form
                          </Button>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} className="py-12 text-center text-text-muted italic">No reverted leads.</td></tr>
                    )}
                  </tbody>
                </table>
              )}

              {/* SLIDE 4: WRONG NUMBERS (READ-ONLY: NO CLOSE / DELETE BUTTONS) */}
              {activeSlide === 4 && (
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-bg-primary/50 text-text-muted text-[10px] uppercase tracking-widest border-b border-bg-border">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Lead ID</th>
                      <th className="py-3 px-4 font-semibold">Surveyor</th>
                      <th className="py-3 px-4 font-semibold">Telecaller</th>
                      <th className="py-3 px-4 font-semibold">Remark</th>
                      <th className="py-3 px-4 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedWrongNumberLeads.length > 0 ? paginatedWrongNumberLeads.map(sub => (
                      <tr key={sub.id} className="border-b border-bg-border last:border-0 hover:bg-bg-hover/40 transition-colors">
                        <td className="py-3 px-4 text-white font-medium">{sub.id.split('-')[0].toUpperCase()}</td>
                        <td className="py-3 px-4 text-text-secondary">{sub.surveyor?.full_name || sub.surveyor?.username}</td>
                        <td className="py-3 px-4 text-accent-blue">{sub.telecaller?.full_name || sub.telecaller?.username || 'Unassigned'}</td>
                        <td className="py-3 px-4 text-orange-400 text-xs">{sub.telecaller_remark || 'Wrong Number'}</td>
                        <td className="py-3 px-4 text-right">
                          <Button size="sm" variant="ghost" onClick={() => handleSelectSub(sub)} className="text-text-muted hover:text-white">
                            <Eye className="w-4 h-4 mr-1" /> View Form
                          </Button>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} className="py-12 text-center text-text-muted italic">No wrong number leads.</td></tr>
                    )}
                  </tbody>
                </table>
              )}

              {/* SLIDE 5: CLOSED LEADS */}
              {activeSlide === 5 && (
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-bg-primary/50 text-text-muted text-[10px] uppercase tracking-widest border-b border-bg-border">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Lead ID</th>
                      <th className="py-3 px-4 font-semibold">Surveyor</th>
                      <th className="py-3 px-4 font-semibold">Telecaller</th>
                      <th className="py-3 px-4 font-semibold">Form Name</th>
                      <th className="py-3 px-4 font-semibold">Date Closed</th>
                      <th className="py-3 px-4 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedClosedLeads.length > 0 ? paginatedClosedLeads.map(sub => (
                      <tr key={sub.id} className="border-b border-bg-border last:border-0 hover:bg-bg-hover/40 transition-colors">
                        <td className="py-3 px-4 text-white font-medium">{sub.id.split('-')[0].toUpperCase()}</td>
                        <td className="py-3 px-4 text-text-secondary">{sub.surveyor?.full_name || sub.surveyor?.username}</td>
                        <td className="py-3 px-4 text-accent-blue">{sub.telecaller?.full_name || sub.telecaller?.username || 'Unassigned'}</td>
                        <td className="py-3 px-4 text-text-secondary">{sub.form_templates?.name || 'Unknown'}</td>
                        <td className="py-3 px-4 text-accent-green font-medium text-xs">
                          {sub.lead_status_updated_at ? new Date(sub.lead_status_updated_at).toLocaleDateString() : 'Closed'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button size="sm" variant="ghost" onClick={() => handleSelectSub(sub)} className="text-text-muted hover:text-white">
                            <Eye className="w-4 h-4 mr-1" /> View Form
                          </Button>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={6} className="py-12 text-center text-text-muted italic">No closed leads recorded.</td></tr>
                    )}
                  </tbody>
                </table>
              )}

              {/* SLIDE 6: DELETED LEADS */}
              {activeSlide === 6 && (
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-bg-primary/50 text-text-muted text-[10px] uppercase tracking-widest border-b border-bg-border">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Lead ID</th>
                      <th className="py-3 px-4 font-semibold">Surveyor</th>
                      <th className="py-3 px-4 font-semibold">Form Name</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDeletedLeads.length > 0 ? paginatedDeletedLeads.map(sub => (
                      <tr key={sub.id} className="border-b border-bg-border last:border-0 hover:bg-bg-hover/40 transition-colors">
                        <td className="py-3 px-4 text-white font-medium">{sub.id.split('-')[0].toUpperCase()}</td>
                        <td className="py-3 px-4 text-text-secondary">{sub.surveyor?.full_name || sub.surveyor?.username}</td>
                        <td className="py-3 px-4 text-text-secondary">{sub.form_templates?.name || 'Unknown'}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-accent-red/10 text-accent-red">Deleted</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button size="sm" variant="ghost" onClick={() => handleSelectSub(sub)} className="text-text-muted hover:text-white">
                            <Eye className="w-4 h-4 mr-1" /> View Form
                          </Button>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} className="py-12 text-center text-text-muted italic">No deleted leads.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination footer */}
            {currentSlideTotalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-bg-border bg-bg-primary shrink-0">
                <div className="text-xs text-text-muted">
                  Page <span className="text-white font-medium">{slidePage}</span> of <span className="text-white font-medium">{currentSlideTotalPages}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSlidePage(p => Math.max(1, p - 1))}
                    disabled={slidePage === 1}
                    className="bg-bg-secondary text-white border border-bg-border hover:bg-bg-border disabled:opacity-50 text-xs px-3 py-1 rounded transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setSlidePage(p => Math.min(currentSlideTotalPages, p + 1))}
                    disabled={slidePage === currentSlideTotalPages}
                    className="bg-bg-secondary text-white border border-bg-border hover:bg-bg-border disabled:opacity-50 text-xs px-3 py-1 rounded transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 2: BY TEAM LEAD REPORT (ADMIN STYLE MATRIX) */}
      {activeTab === 'tl_reports' && (
        <Card className="flex flex-col p-0 overflow-hidden min-h-[400px]">
          <div className="p-5 border-b border-bg-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-bg-secondary">
            <div>
              <h3 className="text-sm font-semibold text-white">Team Lead Performance Matrix</h3>
              <p className="text-xs text-text-muted mt-0.5">Admin-level breakdown for your assigned team leads and their telecallers.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-bg-secondary border-b border-bg-border shadow-sm">
                <tr className="text-text-muted text-[10px] uppercase tracking-widest text-center border-b border-bg-border">
                  <th className="py-3 px-4 font-semibold text-left border-r border-bg-border">TL Name</th>
                  <th className="py-3 px-4 font-semibold border-r border-bg-border">Assigned lead</th>
                  <th className="py-3 px-4 font-semibold text-accent-blue border-r border-bg-border">Pending to call</th>
                  <th className="py-3 px-4 font-semibold text-white border-r border-bg-border">Called</th>
                  <th colSpan={5} className="py-2 px-4 font-semibold text-white border-r border-bg-border">Outcome of called No.</th>
                  <th className="py-3 px-4 font-semibold text-accent-yellow">Called in Loop</th>
                </tr>
                <tr className="text-text-muted text-[10px] uppercase tracking-widest text-center border-b border-bg-border">
                  <th className="py-2 px-3 border-r border-bg-border"></th>
                  <th className="py-2 px-3 border-r border-bg-border"></th>
                  <th className="py-2 px-3 border-r border-bg-border"></th>
                  <th className="py-2 px-3 border-r border-bg-border"></th>
                  <th className="py-2 px-3 font-semibold text-accent-red border-r border-bg-border">Imme</th>
                  <th className="py-2 px-3 font-semibold text-orange-400 border-r border-bg-border">Wrong</th>
                  <th className="py-2 px-3 font-semibold text-purple-400 border-r border-bg-border">Reverted</th>
                  <th className="py-2 px-3 font-semibold text-accent-green border-r border-bg-border">Closed</th>
                  <th className="py-2 px-3 font-semibold text-red-500 border-r border-bg-border">Deleted</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {teamLeadData.length > 0 ? teamLeadData.map((d, i) => (
                  <React.Fragment key={d.id || i}>
                    <tr 
                      className="border-b border-bg-border last:border-0 hover:bg-bg-hover/50 transition-colors cursor-pointer"
                      onClick={() => toggleTlRow(d.id)}
                    >
                      <td className="py-3 px-4 text-white font-medium flex items-center gap-2 border-r border-bg-border">
                        {expandedTlRows.has(d.id) ? <ChevronDown className="w-4 h-4 text-text-muted" /> : <ChevronRight className="w-4 h-4 text-text-muted" />}
                        {d.name}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-white border-r border-bg-border">{d.totalEntries.toLocaleString()}</td>
                      <td className="py-3 px-4 text-center font-medium text-accent-blue border-r border-bg-border">{d.newLeads.toLocaleString()}</td>
                      <td className="py-3 px-4 text-center font-medium text-white border-r border-bg-border">{Math.max(0, d.totalEntries - (d.newLeads || 0)).toLocaleString()}</td>
                      <td className="py-3 px-4 text-center font-medium text-accent-red border-r border-bg-border">{d.immediate.toLocaleString()}</td>
                      <td className="py-3 px-4 text-center font-medium text-orange-400 border-r border-bg-border">{d.wrongNumber.toLocaleString()}</td>
                      <td className="py-3 px-4 text-center font-medium text-purple-400 border-r border-bg-border">{d.reverted.toLocaleString()}</td>
                      <td className="py-3 px-4 text-center font-medium text-accent-green border-r border-bg-border">{d.closed.toLocaleString()}</td>
                      <td className="py-3 px-4 text-center font-medium text-red-500 border-r border-bg-border">{d.deleted.toLocaleString()}</td>
                      <td className="py-3 px-4 text-center font-medium text-accent-yellow">
                        {Math.max(0, (d.totalEntries - (d.newLeads || 0)) - d.immediate - d.wrongNumber - d.reverted - d.closed - d.deleted).toLocaleString()}
                      </td>
                    </tr>

                    {/* Expandable Telecaller Breakdown */}
                    {expandedTlRows.has(d.id) && Object.keys(d.telecallers).length > 0 && (
                      <tr className="bg-bg-primary border-b border-bg-border">
                        <td colSpan={10} className="p-0">
                          <div className="py-4 pl-12 pr-4">
                            <h4 className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-3">Telecaller Breakdown for {d.name}</h4>
                            <table className="w-full text-left border-collapse text-xs border border-bg-border">
                              <thead className="bg-bg-secondary/50">
                                <tr className="text-text-muted border-b border-bg-border uppercase tracking-widest text-[9px]">
                                  <th className="py-2 px-3 font-semibold border-r border-bg-border">TC Name</th>
                                  <th className="py-2 px-3 font-semibold text-center border-r border-bg-border">Assigned Lead</th>
                                  <th className="py-2 px-3 font-semibold text-center text-accent-blue border-r border-bg-border">Pending</th>
                                  <th className="py-2 px-3 font-semibold text-center text-white border-r border-bg-border">Called</th>
                                  <th colSpan={5} className="py-1 px-3 font-semibold text-center text-white border-r border-bg-border">Outcome</th>
                                  <th className="py-2 px-3 font-semibold text-center text-accent-yellow">In Loop</th>
                                </tr>
                                <tr className="text-text-muted text-[9px] uppercase tracking-widest text-center border-b border-bg-border">
                                  <th className="py-1 px-2 border-r border-bg-border"></th>
                                  <th className="py-1 px-2 border-r border-bg-border"></th>
                                  <th className="py-1 px-2 border-r border-bg-border"></th>
                                  <th className="py-1 px-2 border-r border-bg-border"></th>
                                  <th className="py-1 px-2 font-semibold text-accent-red border-r border-bg-border">Imme</th>
                                  <th className="py-1 px-2 font-semibold text-orange-400 border-r border-bg-border">Wrong</th>
                                  <th className="py-1 px-2 font-semibold text-purple-400 border-r border-bg-border">Reverted</th>
                                  <th className="py-1 px-2 font-semibold text-accent-green border-r border-bg-border">Closed</th>
                                  <th className="py-1 px-2 font-semibold text-red-500 border-r border-bg-border">Deleted</th>
                                  <th className="py-1 px-2"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.values(d.telecallers).sort((a,b) => b.assigned - a.assigned).map((tc, tcIdx) => (
                                  <tr key={tcIdx} className="border-b border-bg-border last:border-0 hover:bg-bg-hover/30">
                                    <td className="py-2 px-3 text-white font-medium border-r border-bg-border">{tc.name}</td>
                                    <td className="py-2 px-3 text-center text-text-secondary font-medium border-r border-bg-border">{tc.assigned}</td>
                                    <td className="py-2 px-3 text-center text-accent-blue font-medium border-r border-bg-border">{tc.newLeads}</td>
                                    <td className="py-2 px-3 text-center text-white font-medium border-r border-bg-border">{Math.max(0, tc.assigned - (tc.newLeads || 0))}</td>
                                    <td className="py-2 px-3 text-center text-accent-red font-medium border-r border-bg-border">{tc.immediate}</td>
                                    <td className="py-2 px-3 text-center text-orange-400 font-medium border-r border-bg-border">{tc.wrongNumber}</td>
                                    <td className="py-2 px-3 text-center text-purple-400 font-medium border-r border-bg-border">{tc.reverted}</td>
                                    <td className="py-2 px-3 text-center text-accent-green font-medium border-r border-bg-border">{tc.closed}</td>
                                    <td className="py-2 px-3 text-center text-red-500 font-medium border-r border-bg-border">{tc.deleted}</td>
                                    <td className="py-2 px-3 text-center text-accent-yellow font-medium">
                                      {Math.max(0, (tc.assigned - (tc.newLeads || 0)) - tc.immediate - tc.wrongNumber - tc.reverted - tc.closed - tc.deleted)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )) : (
                  <tr><td colSpan={10} className="py-12 text-center text-text-muted italic">No team lead report data available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 3: FILE HANDLER PERFORMANCE */}
      {activeTab === 'fh_reports' && (
        <Card className="flex flex-col p-0 overflow-hidden min-h-[400px]">
          <div className="p-5 border-b border-bg-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-bg-secondary">
            <div>
              <h3 className="text-sm font-semibold text-white">File Handler Performance Report</h3>
              <p className="text-xs text-text-muted mt-0.5">Submission and file closure records for your assigned File Handlers.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-bg-secondary border-b border-bg-border">
                <tr className="text-text-muted text-[10px] uppercase tracking-widest">
                  <th className="py-3 px-4 font-semibold">File Handler</th>
                  <th className="py-3 px-4 font-semibold text-center text-accent-blue">Leads Assigned</th>
                  <th className="py-3 px-4 font-semibold text-center text-orange-400">Leads Pending</th>
                  <th className="py-3 px-4 font-semibold text-center text-white">Open File</th>
                  <th className="py-3 px-4 font-semibold text-center text-pink-500">Cleared Files</th>
                </tr>
              </thead>
              <tbody>
                {fileHandlerData.length > 0 ? fileHandlerData.map((fh, i) => {
                  const pendingCount = Math.max(0, fh.assignedLeads - (fh.linkedFilesCount || 0));
                  return (
                    <tr key={fh.id || i} className="border-b border-bg-border last:border-0 hover:bg-bg-hover/50 transition-colors">
                      <td className="py-3 px-4 text-white font-medium flex items-center gap-2">
                        <FolderOpen className="w-4 h-4 text-accent-green" />
                        {fh.name}
                      </td>
                      <td className="py-3 px-4 text-center text-accent-blue font-bold">{fh.assignedLeads}</td>
                      <td className="py-3 px-4 text-center text-orange-400 font-bold">{pendingCount}</td>
                      <td className="py-3 px-4 text-center text-white font-bold">{fh.totalSubmitted.toLocaleString()}</td>
                      <td className="py-3 px-4 text-center text-pink-500 font-bold">{fh.totalClosed.toLocaleString()}</td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={5} className="py-12 text-center text-text-muted italic">No assigned file handlers or files found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 4: CUSTOM DASHBOARD ANALYSIS (SURVEYOR & FILE FORMS) */}
      {activeTab === 'custom_analytics' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-bg-secondary border border-bg-border rounded-xl p-4">
            <div>
              <h3 className="text-sm font-bold text-white">Customizable Dashboard Analysis Hub</h3>
              <p className="text-xs text-text-muted mt-0.5">Explore granular field breakdowns, charts, and filter analysis for both form types.</p>
            </div>
            {/* Toggle */}
            <div className="flex bg-bg-primary border border-bg-border rounded-lg p-1 gap-1">
              <button
                onClick={() => setCustomDashboardTab('surveyor')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  customDashboardTab === 'surveyor'
                    ? 'bg-accent-blue text-white'
                    : 'text-text-muted hover:text-white'
                }`}
              >
                Surveyor Forms ({surveyorTemplates.length})
              </button>
              <button
                onClick={() => setCustomDashboardTab('file')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  customDashboardTab === 'file'
                    ? 'bg-accent-blue text-white'
                    : 'text-text-muted hover:text-white'
                }`}
              >
                File Forms ({fileTemplates.length})
              </button>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {customDashboardTab === 'surveyor' ? (
              surveyorTemplates.length > 0 ? surveyorTemplates.map(t => (
                <div key={t.id} className="bg-bg-secondary border border-bg-border rounded-xl p-5 hover:border-accent-blue/50 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-accent-blue bg-accent-blue/10 px-2 py-0.5 rounded">Surveyor Form</span>
                      <PieChart className="w-4 h-4 text-text-muted" />
                    </div>
                    <h4 className="font-bold text-white text-lg mb-1">{t.name}</h4>
                    <p className="text-xs text-text-secondary line-clamp-2 mb-4">{t.description || 'Dynamic field survey form template.'}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => navigate(`/manager/analyze-surveyor/${t.id}`)}
                    className="w-full text-accent-blue border-accent-blue/30 hover:bg-accent-blue/10"
                  >
                    <Activity className="w-4 h-4 mr-2" /> Open Custom Analysis
                  </Button>
                </div>
              )) : (
                <div className="col-span-full py-12 text-center text-text-muted italic border-2 border-dashed border-bg-border rounded-xl">
                  No active surveyor templates available.
                </div>
              )
            ) : (
              fileTemplates.length > 0 ? fileTemplates.map(ft => (
                <div key={ft.id} className="bg-bg-secondary border border-bg-border rounded-xl p-5 hover:border-accent-blue/50 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-accent-green bg-accent-green/10 px-2 py-0.5 rounded">File Form</span>
                      <PieChart className="w-4 h-4 text-text-muted" />
                    </div>
                    <h4 className="font-bold text-white text-lg mb-1">{ft.name}</h4>
                    <p className="text-xs text-text-secondary line-clamp-2 mb-4">{ft.description || 'File handler workflow form template.'}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => navigate(`/manager/analyze-file/${ft.id}`)}
                    className="w-full text-accent-green border-accent-green/30 hover:bg-accent-green/10"
                  >
                    <Activity className="w-4 h-4 mr-2" /> Open Custom Analysis
                  </Button>
                </div>
              )) : (
                <div className="col-span-full py-12 text-center text-text-muted italic border-2 border-dashed border-bg-border rounded-xl">
                  No active file form templates available.
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Read-Only Lead Detail Modal */}
      {selectedSub && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-bg-secondary w-full max-w-2xl max-h-[85vh] rounded-xl border border-bg-border shadow-2xl flex flex-col overflow-hidden">
            <div className="p-5 border-b border-bg-border flex justify-between items-center bg-bg-primary shrink-0">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-accent-blue" />
                  Submission Data Overview
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">ID: {selectedSub.id}</p>
              </div>
              <button onClick={() => setSelectedSub(null)} className="text-text-muted hover:text-white p-2 rounded-full hover:bg-bg-secondary transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="flex justify-between items-start bg-bg-primary p-4 rounded-xl border border-bg-border">
                <div>
                  <h4 className="text-white font-bold">{selectedSub.surveyor?.full_name || selectedSub.surveyor?.username || 'Surveyor'}</h4>
                  <div className="text-xs text-text-muted mt-1">Form: {selectedSub.form_templates?.name || 'Survey Form'}</div>
                </div>
                <Badge variant={getStatusBadgeVariant(selectedSub.lead_status) as any}>
                  {selectedSub.lead_status || selectedSub.status}
                </Badge>
              </div>

              {/* Data fields */}
              <div className="space-y-3">
                <h5 className="text-xs uppercase font-bold tracking-widest text-text-muted border-b border-bg-border pb-1">Submitted Answers</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(() => {
                    const fields = selectedSub.form_templates?.fields;
                    if (fields && Array.isArray(fields)) {
                      return fields.map((f: any) => {
                        const val = selectedSub.data?.[f.id];
                        let display = val;
                        if (Array.isArray(val)) display = val.join(', ');
                        else if (typeof val === 'object' && val !== null) display = JSON.stringify(val);
                        else if (val === undefined || val === null || val === '') display = '-';

                        return (
                          <div key={f.id} className="bg-bg-primary border border-bg-border rounded-lg p-3">
                            <span className="block text-[10px] uppercase text-text-secondary font-semibold mb-1">{f.label}</span>
                            <span className="text-sm text-white font-medium break-words">{String(display)}</span>
                          </div>
                        );
                      });
                    }

                    if (selectedSub.data && typeof selectedSub.data === 'object') {
                      return Object.entries(selectedSub.data).map(([k, v]) => (
                        <div key={k} className="bg-bg-primary border border-bg-border rounded-lg p-3">
                          <span className="block text-[10px] uppercase text-text-secondary font-semibold mb-1">{k}</span>
                          <span className="text-sm text-white font-medium break-words">{String(v)}</span>
                        </div>
                      ));
                    }

                    return <p className="text-xs text-text-muted italic">No data entries recorded.</p>;
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
