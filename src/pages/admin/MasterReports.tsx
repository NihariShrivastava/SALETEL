import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Download, Filter, Database, Users, Building2, Loader2, X, PieChart, FileText, PhoneCall, CheckCircle, XCircle, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, Legend } from 'recharts';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { startOfDay, endOfDay } from 'date-fns';

const COLORS = ['#4f6ef7', '#22c55e', '#eab308', '#ef4444', '#06b6d4', '#f97316'];

interface SurveyorData {
  name: string;
  role: string;
  submissions: number;
  lastActive: string;
}

interface TelecallerData {
  id: string;
  name: string;
  assigned: number;
  newLeads: number;
  immediate: number;
  hot: number;
  warm: number;
  cold: number;
  skipped: number;
  wrongNumber: number;
  reverted: number;
  closed: number;
  callsToNew?: number;
  callsToCold?: number;
  callsToWarm?: number;
  callsToHot?: number;
  callsToSkipped?: number;
  callsToImmediate?: number;
  callsToWrongNumber?: number;
  callsToReverted?: number;
  callsToClosed?: number;
}

interface TeamLeadData {
  id: string;
  name: string;
  totalEntries: number;
  assigned: number;
  immediate: number;
  closed: number;
  deleted: number;
  telecallers: Record<string, {
    id: string;
    name: string;
    assigned: number;
    immediate: number;
    closed: number;
    deleted: number;
  }>;
}

interface CallLogData {
  telecallerId: string;
  telecallerName: string;
  totalCalls: number;
  byPreviousStatus: Record<string, number>;
  byNewStatus: Record<string, number>;
}

export default function MasterReports() {
  const [activeTab, setActiveTab] = useState('domain');
  const [isLoading, setIsLoading] = useState(true);

  const [dataDomains, setDataDomains] = useState<{name: string, count: number}[]>([]);
  const [dataRoles, setDataRoles] = useState<{name: string, count: number}[]>([]);
  const [dataSurveyors, setDataSurveyors] = useState<SurveyorData[]>([]);
  const [dataTelecallers, setDataTelecallers] = useState<TelecallerData[]>([]);
  const [dataTeamLeads, setDataTeamLeads] = useState<TeamLeadData[]>([]);
  const [selectedSub, setSelectedSub] = useState<any | null>(null);
  const [masterDump, setMasterDump] = useState<any[]>([]);
  const [dynamicColumns, setDynamicColumns] = useState<string[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [expandedTlRows, setExpandedTlRows] = useState<Set<string>>(new Set());

  const toggleTlRow = (id: string) => {
    setExpandedTlRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  
  // Master Dump Filters
  const [globalStartDate, setGlobalStartDate] = useState<string>('');
  const [globalEndDate, setGlobalEndDate] = useState<string>('');
  const [filterDomain, setFilterDomain] = useState<string>('all');
  const [filterFormStatus, setFilterFormStatus] = useState<string>('all');
  const [filterLeadStatus, setFilterLeadStatus] = useState<string>('all');
  
  const navigate = useNavigate();
  
  const [stats, setStats] = useState({
    totalSubmissions: 0,
    activeDomains: 0,
    totalWorkstations: 0,
    dataHealth: 0
  });

  useEffect(() => {
    fetchData();
  }, []);
  const handleClearDates = () => {
    setGlobalStartDate('');
    setGlobalEndDate('');
    fetchData('', '');
  };

  const fetchData = async (start = globalStartDate, end = globalEndDate) => {
    setIsLoading(true);
    try {
      const { count: domainCount, error: domainError } = await supabase.from('domains').select('*', { count: 'exact', head: true });
      if (domainError) throw domainError;

      const { count: survCount, error: survError } = await supabase.from('surveyors').select('*', { count: 'exact', head: true });
      if (survError) throw survError;

      let subsQuery = supabase
        .from('submissions')
        .select(`
          id,
          status,
          submitted_at,
          domains(name),
          surveyors!surveyor_id(username, full_name, user_roles(name)),
          data,
          form_templates(name, fields),
          reviewed_by,
          admin_notes,
          telecaller_id,
          lead_status,
          lead_status_updated_at,
          surveyor_id
        `);

      if (start) {
        subsQuery = subsQuery.gte('submitted_at', startOfDay(new Date(start)).toISOString());
      }
      if (end) {
        subsQuery = subsQuery.lte('submitted_at', endOfDay(new Date(end)).toISOString());
      }

      const { data: subData, error: subError } = await subsQuery;
      
      if (subError) throw subError;

      const submissions = subData || [];

      // Fetch call logs
      let logsQuery = supabase
        .from('lead_call_logs')
        .select('*');

      if (start) {
        logsQuery = logsQuery.gte('created_at', startOfDay(new Date(start)).toISOString());
      }
      if (end) {
        logsQuery = logsQuery.lte('created_at', endOfDay(new Date(end)).toISOString());
      }

      const { data: logsData, error: logsError } = await logsQuery;
        
      if (logsError) {
        console.warn('Could not fetch call logs:', logsError.message);
        toast.error(`Logs Fetch Error: ${logsError.message}`);
      }
      const callLogs = logsData || [];

      const validCount = submissions.filter(s => s.status !== 'rejected').length;
      const dataHealth = submissions.length > 0 ? ((validCount / submissions.length) * 100) : 100;

      setStats({
        totalSubmissions: submissions.length,
        activeDomains: domainCount || 0,
        totalWorkstations: survCount || 0,
        dataHealth: parseFloat(dataHealth.toFixed(1))
      });

      const domainMap: Record<string, number> = {};
      const roleMap: Record<string, number> = {};
      const survMap: Record<string, SurveyorData> = {};
      const telecallerMap: Record<string, TelecallerData> = {};
      const teamLeadMap: Record<string, TeamLeadData> = {};
      const rawDump: any[] = [];

      const dynamicKeysSet = new Set<string>();
      
      const { data: allTeamLeads } = await supabase
        .from('surveyors')
        .select('id, full_name, assigned_users')
        .not('assigned_users', 'is', null);

      const surveyorToTlMap = new Map<string, {id: string, name: string}>();
      if (allTeamLeads) {
        allTeamLeads.forEach(tl => {
          if (Array.isArray(tl.assigned_users)) {
            tl.assigned_users.forEach((surveyorId: string) => {
              surveyorToTlMap.set(surveyorId, { id: tl.id, name: tl.full_name });
            });
          }
        });
      }

      const tcIdsToFetch = new Set<string>();
      submissions.forEach(sub => {
        if (sub.telecaller_id) tcIdsToFetch.add(sub.telecaller_id);
      });
      const tcNameMap = new Map<string, string>();
      if (tcIdsToFetch.size > 0) {
        const { data: tcData } = await supabase.from('surveyors').select('id, full_name').in('id', Array.from(tcIdsToFetch));
        tcData?.forEach(tc => tcNameMap.set(tc.id, tc.full_name));
      }

      const callLogMap: Record<string, CallLogData> = {};
      callLogs.forEach((log: any) => {
        const tcId = log.telecaller_id;
        const tcName = tcNameMap.get(tcId) || 'Unknown Telecaller';
        
        if (!callLogMap[tcId]) {
          callLogMap[tcId] = {
            telecallerId: tcId,
            telecallerName: tcName,
            totalCalls: 0,
            byPreviousStatus: {},
            byNewStatus: {}
          };
        }
        
        const clm = callLogMap[tcId];
        clm.totalCalls += 1;
        
        const pStat = log.previous_status || 'unknown';
        const nStat = log.new_status || 'unknown';
        
        clm.byPreviousStatus[pStat] = (clm.byPreviousStatus[pStat] || 0) + 1;
        clm.byNewStatus[nStat] = (clm.byNewStatus[nStat] || 0) + 1;
      });

      submissions.forEach(sub => {
        const dName = (sub.domains as any)?.name || 'Unassigned';
        const survData = sub.surveyors as any;
        const sName = survData?.full_name || survData?.username || 'Unknown';
        const rName = survData?.user_roles?.name || 'Unknown Role';

        domainMap[dName] = (domainMap[dName] || 0) + 1;
        roleMap[rName] = (roleMap[rName] || 0) + 1;

        if (!survMap[sName]) {
          survMap[sName] = { name: sName, role: rName, submissions: 0, lastActive: sub.submitted_at };
        }
        survMap[sName].submissions += 1;

        if (new Date(sub.submitted_at) > new Date(survMap[sName].lastActive)) {
          survMap[sName].lastActive = sub.submitted_at;
        }

        const tlName = sub.reviewed_by ? 'Team Lead' : null;



        let ls = sub.lead_status || 'new';
        // Today check for skipped
        const today = new Date();
        today.setHours(0,0,0,0);
        if (ls === 'skipped' && sub.lead_status_updated_at) {
          if (new Date(sub.lead_status_updated_at) < today) ls = 'new';
        }

        let bucket = '';
        if (sub.status === 'reverted') bucket = 'reverted';
        else if (ls === 'closed') bucket = 'closed';
        else bucket = ls;

        if (sub.telecaller_id) {
          // Telecaller stats
          if (!telecallerMap[sub.telecaller_id]) {
            telecallerMap[sub.telecaller_id] = {
              id: sub.telecaller_id,
              name: tcNameMap.get(sub.telecaller_id) || 'Unknown Telecaller',
              assigned: 0, newLeads: 0, immediate: 0, hot: 0, warm: 0, cold: 0, skipped: 0, wrongNumber: 0, reverted: 0, closed: 0
            };
          }
          const tMap = telecallerMap[sub.telecaller_id];
          tMap.assigned += 1;
          
          if (bucket === 'new') tMap.newLeads += 1;
          else if (bucket === 'immediate') tMap.immediate += 1;
          else if (bucket === 'hot') tMap.hot += 1;
          else if (bucket === 'warm') tMap.warm += 1;
          else if (bucket === 'cold') tMap.cold += 1;
          else if (bucket === 'skipped') tMap.skipped += 1;
          else if (bucket === 'wrong_number') tMap.wrongNumber += 1;
          else if (bucket === 'reverted') tMap.reverted += 1;
          else if (bucket === 'closed') tMap.closed += 1;
        }
        
        const actualTl = sub.surveyor_id ? surveyorToTlMap.get(sub.surveyor_id) : null;
        if (actualTl) {
          if (!teamLeadMap[actualTl.id]) {
            teamLeadMap[actualTl.id] = {
              id: actualTl.id,
              name: actualTl.name,
              totalEntries: 0,
              assigned: 0,
              immediate: 0,
              closed: 0,
              deleted: 0,
              telecallers: {}
            };
          }
          const tlMap = teamLeadMap[actualTl.id];
          tlMap.totalEntries += 1;
          
          if (sub.telecaller_id) {
            tlMap.assigned += 1;
            
            if (!tlMap.telecallers[sub.telecaller_id]) {
              tlMap.telecallers[sub.telecaller_id] = {
                id: sub.telecaller_id,
                name: tcNameMap.get(sub.telecaller_id) || 'Unknown Telecaller',
                assigned: 0,
                immediate: 0,
                closed: 0,
                deleted: 0
              };
            }
            
            const tlTcMap = tlMap.telecallers[sub.telecaller_id];
            tlTcMap.assigned += 1;
            if (bucket === 'immediate') tlTcMap.immediate += 1;
            else if (bucket === 'closed') tlTcMap.closed += 1;
            else if (bucket === 'deleted') tlTcMap.deleted += 1;
          }

          if (bucket === 'immediate') tlMap.immediate += 1;
          else if (bucket === 'closed') tlMap.closed += 1;
          else if (bucket === 'deleted') tlMap.deleted += 1;
        }

        let tName = 'Unknown';
        if (sub.form_templates) {
          tName = Array.isArray(sub.form_templates) ? (sub.form_templates[0] as any)?.name : (sub.form_templates as any)?.name;
        }

        let rowData: any = {
          ID: sub.id.split('-')[0].toUpperCase(),
          Date: new Date(sub.submitted_at).toLocaleString(),
          Role: rName,
          Surveyor: sName,
          Domain: dName,
          Template: tName || '-',
          Status: sub.status,
          'Lead Status': sub.lead_status || 'new',
          'Reviewed By': tlName || '-',
          Remarks: sub.admin_notes || '-',
          _raw: sub
        };

        if (sub.data && typeof sub.data === 'object') {
          for (const [k, v] of Object.entries(sub.data)) {
            let label = k;
            const templates: any = (sub as any).form_templates;
            
            const fieldsData = Array.isArray(templates) ? templates[0]?.fields : templates?.fields;
            
            if (fieldsData) {
               const fieldsArray = fieldsData as any[];
               const fieldConfig = fieldsArray.find((f: any) => f.id === k);
               if (fieldConfig && fieldConfig.label) {
                 label = fieldConfig.label;
               }
            }

            dynamicKeysSet.add(label);
            if (typeof v === 'object' && v !== null) {
              if ('lat' in v && 'lng' in v) {
                rowData[label] = `Lat: ${(v as any).lat}, Lng: ${(v as any).lng}`;
              } else if (Array.isArray(v)) {
                rowData[label] = v.join(', ');
              } else {
                rowData[label] = JSON.stringify(v);
              }
            } else {
              rowData[label] = v;
            }
          }
        }

        rawDump.push(rowData);
      });

      // Merge call logs into telecallerMap
      callLogs.forEach((log: any) => {
        const tcId = log.telecaller_id;
        if (telecallerMap[tcId]) {
          const pStat = log.previous_status || 'new';
          if (pStat === 'new') telecallerMap[tcId].callsToNew = (telecallerMap[tcId].callsToNew || 0) + 1;
          else if (pStat === 'cold') telecallerMap[tcId].callsToCold = (telecallerMap[tcId].callsToCold || 0) + 1;
          else if (pStat === 'warm') telecallerMap[tcId].callsToWarm = (telecallerMap[tcId].callsToWarm || 0) + 1;
          else if (pStat === 'hot') telecallerMap[tcId].callsToHot = (telecallerMap[tcId].callsToHot || 0) + 1;
          else if (pStat === 'skipped') telecallerMap[tcId].callsToSkipped = (telecallerMap[tcId].callsToSkipped || 0) + 1;
          else if (pStat === 'immediate') telecallerMap[tcId].callsToImmediate = (telecallerMap[tcId].callsToImmediate || 0) + 1;
          else if (pStat === 'wrong_number') telecallerMap[tcId].callsToWrongNumber = (telecallerMap[tcId].callsToWrongNumber || 0) + 1;
          else if (pStat === 'reverted_to_tl') telecallerMap[tcId].callsToReverted = (telecallerMap[tcId].callsToReverted || 0) + 1;
          else if (pStat === 'closed') telecallerMap[tcId].callsToClosed = (telecallerMap[tcId].callsToClosed || 0) + 1;
        }
      });

      setDynamicColumns(Array.from(dynamicKeysSet));

      setDataDomains(Object.entries(domainMap).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count));
      setDataRoles(Object.entries(roleMap).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count));
      
      setDataSurveyors(Object.values(survMap).sort((a,b) => b.submissions - a.submissions));
      setDataTelecallers(Object.values(telecallerMap).sort((a,b) => b.assigned - a.assigned));
      setDataTeamLeads(Object.values(teamLeadMap).sort((a,b) => b.totalEntries - a.totalEntries));
      
      setMasterDump(rawDump.sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime()));

    } catch (error: any) {
      console.error('MasterReports error:', error);
      toast.error(error.message || 'Failed to load master reports data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportExcel = () => {
    let dataToExport: any[] = [];
    let sheetName = '';

    if (activeTab === 'domain') {
      dataToExport = dataDomains.map(d => ({ Domain: d.name, Submissions: d.count }));
      sheetName = 'By Domain';
    } else if (activeTab === 'role') {
      dataToExport = dataRoles.map(d => ({ Role: d.name, Submissions: d.count }));
      sheetName = 'By Role';
    } else if (activeTab === 'person') {
      dataToExport = dataSurveyors.map(d => ({ Surveyor: d.name, Role: d.role, Submissions: d.submissions }));
      sheetName = 'By Surveyor';
    } else if (activeTab === 'teamlead') {
      dataToExport = dataTeamLeads.map(d => ({
        'Team Lead': d.teamLeadName,
        'Telecaller': d.telecallerName,
        'Total Assigned': d.assigned,
        'New': d.newLeads,
        'Cold': d.cold,
        'Warm': d.warm,
        'Hot': d.hot,
        'Immediate': d.immediate,
        'Skipped': d.skipped,
        'Wrong Number': d.wrongNumber,
        'Reverted': d.reverted,
        'Closed': d.closed
      }));
      sheetName = 'By Team Lead';
    } else if (activeTab === 'telecaller') {
      dataToExport = dataTelecallers.map(d => ({
        'Telecaller': d.name,
        'Total Assigned': d.assigned,
        'New': d.newLeads,
        'Cold': d.cold,
        'Warm': d.warm,
        'Hot': d.hot,
        'Immediate': d.immediate,
        'Skipped': d.skipped,
        'Wrong Number': d.wrongNumber,
        'Reverted': d.reverted,
        'Closed': d.closed
      }));
      sheetName = 'By Telecaller';
    } else {
      dataToExport = masterDump.map(({ _raw, ...rest }) => rest);
      sheetName = 'Master Dump';
    }

    if (dataToExport.length === 0) {
      toast.error('No data to export');
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    
    XLSX.writeFile(workbook, `SALETEL_Report_${sheetName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleDeleteSubmission = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this submission? This action cannot be undone.')) return;
    try {
      const { error } = await supabase.from('submissions').delete().eq('id', id);
      if (error) throw error;
      toast.success('Submission deleted successfully');
      fetchData(); // Refresh data
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error('Failed to delete submission');
    }
  };

  const handleOpenTemplateModal = async () => {
    setShowTemplateModal(true);
    if (templates.length === 0) {
      setIsLoadingTemplates(true);
      try {
        const { data, error } = await supabase.from('form_templates').select('id, name, description').eq('is_active', true);
        if (error) throw error;
        setTemplates(data || []);
      } catch (err) {
        console.error(err);
        toast.error('Failed to load templates');
      } finally {
        setIsLoadingTemplates(false);
      }
    }
  };

  const tabs = [
    { id: 'domain', label: 'By Domain', icon: Database },
    { id: 'role', label: 'By Role', icon: Users },
    { id: 'person', label: 'By Surveyor', icon: Filter },
    { id: 'teamlead', label: 'By Team Lead', icon: Building2 },
    { id: 'telecaller', label: 'By Telecaller', icon: PhoneCall },
    { id: 'master', label: 'Master Dump', icon: Database },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Master Reports Hub</h2>
          <p className="text-text-secondary text-sm mt-1">Analyze data collection performance across all vectors.</p>
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
              onClick={() => fetchData()}
              className="ml-2 px-3 py-1 bg-accent-blue/10 text-accent-blue hover:bg-accent-blue hover:text-white text-xs font-semibold rounded-md transition-colors"
            >
              Apply
            </button>
          </div>
          <Button onClick={handleOpenTemplateModal} className="bg-accent-blue hover:bg-accent-blue/90 text-white border-transparent shadow-lg shadow-accent-blue/20">
            <PieChart className="w-4 h-4 mr-2" />
            Analyze by Custom Dashboard
          </Button>
          <Button onClick={handleExportExcel} className="bg-accent-green hover:bg-accent-green/90 text-white border-transparent shadow-lg shadow-accent-green/20">
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-accent-blue text-white shadow-lg shadow-accent-blue/20' 
                  : 'bg-bg-primary text-text-secondary border border-bg-border hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs text-text-secondary uppercase tracking-wider font-semibold mb-1">Total Submissions</div>
          <div className="text-2xl font-bold text-white tracking-tight">{stats.totalSubmissions.toLocaleString()}</div>
          <div className="text-xs text-text-muted mt-1 flex items-center">Total processed forms</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-text-secondary uppercase tracking-wider font-semibold mb-1">Active Domains</div>
          <div className="text-2xl font-bold text-white tracking-tight">{stats.activeDomains.toLocaleString()}</div>
          <div className="text-xs text-text-muted mt-1 flex items-center">Configured domain scopes</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-text-secondary uppercase tracking-wider font-semibold mb-1">Total Workstations</div>
          <div className="text-2xl font-bold text-white tracking-tight">{stats.totalWorkstations.toLocaleString()}</div>
          <div className="text-xs text-text-muted mt-1 flex items-center">Active field agents / counters</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-text-secondary uppercase tracking-wider font-semibold mb-1">Data Health</div>
          <div className="text-2xl font-bold text-accent-blue tracking-tight">{stats.dataHealth}%</div>
          <div className="text-xs text-text-muted mt-1 flex items-center">Non-rejected completion rate</div>
        </Card>
      </div>

      {activeTab === 'master' ? (
        <Card className="flex flex-col p-0 overflow-hidden">
          <div className="p-5 border-b border-bg-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h3 className="text-sm font-semibold text-white">Master Data Entries</h3>
            
            <div className="flex flex-wrap gap-3">
              <select 
                className="bg-bg-secondary border border-bg-border text-white text-sm rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-accent-blue outline-none"
                value={filterDomain}
                onChange={(e) => setFilterDomain(e.target.value)}
              >
                <option value="all">All Domains</option>
                {Array.from(new Set(masterDump.map(d => d.Domain))).sort().map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              
              <select 
                className="bg-bg-secondary border border-bg-border text-white text-sm rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-accent-blue outline-none"
                value={filterFormStatus}
                onChange={(e) => setFilterFormStatus(e.target.value)}
              >
                <option value="all">All Form Status</option>
                {Array.from(new Set(masterDump.map(d => d.Status))).sort().map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <select 
                className="bg-bg-secondary border border-bg-border text-white text-sm rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-accent-blue outline-none"
                value={filterLeadStatus}
                onChange={(e) => setFilterLeadStatus(e.target.value)}
              >
                <option value="all">All Lead Status</option>
                {Array.from(new Set(masterDump.map(d => d['Lead Status']))).sort().map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap text-sm min-w-[1000px]">
              <thead className="bg-bg-secondary border-b border-bg-border">
                <tr className="text-text-muted text-[10px] uppercase tracking-widest">
                  <th className="py-3 px-4 font-semibold">ID</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Role</th>
                  <th className="py-3 px-4 font-semibold">Surveyor</th>
                  <th className="py-3 px-4 font-semibold">Domain</th>
                  <th className="py-3 px-4 font-semibold">Template</th>
                  <th className="py-3 px-4 font-semibold">Form Status</th>
                  <th className="py-3 px-4 font-semibold">Lead Status</th>
                  <th className="py-3 px-4 font-semibold">Reviewed By</th>
                  <th className="py-3 px-4 font-semibold max-w-[200px]">Remarks</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-text-muted italic">Loading data...</td>
                  </tr>
                ) : masterDump.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-text-muted italic">No submissions recorded yet.</td>
                  </tr>
                ) : (
                  (() => {
                    const filteredDump = masterDump.filter(d => 
                      (filterDomain === 'all' || d.Domain === filterDomain) &&
                      (filterFormStatus === 'all' || d.Status === filterFormStatus) &&
                      (filterLeadStatus === 'all' || d['Lead Status'] === filterLeadStatus)
                    );
                    
                    if (filteredDump.length === 0) {
                      return (
                        <tr>
                          <td colSpan={11} className="py-8 text-center text-text-muted italic">No matching records found for the selected filters.</td>
                        </tr>
                      );
                    }
                    
                    return filteredDump.map((sub, i) => (
                    <tr key={i} className="border-b border-bg-border last:border-0 hover:bg-bg-hover/50 transition-colors cursor-pointer" onClick={() => setSelectedSub(sub._raw)}>
                      <td className="py-3 px-4 text-white font-medium">{sub.ID}</td>
                      <td className="py-3 px-4 text-text-secondary">{sub.Date}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 rounded bg-bg-primary text-[10px] text-text-secondary border border-bg-border uppercase tracking-wider">{sub.Role}</span>
                      </td>
                      <td className="py-3 px-4 text-white">{sub.Surveyor}</td>
                      <td className="py-3 px-4 text-text-secondary">{sub.Domain}</td>
                      <td className="py-3 px-4 text-accent-blue">{sub.Template}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                          sub.Status === 'approved' ? 'bg-accent-green/10 text-accent-green' :
                          sub.Status === 'rejected' ? 'bg-accent-red/10 text-accent-red' :
                          'bg-accent-yellow/10 text-accent-yellow'
                        }`}>
                          {sub.Status === 'approved' && <CheckCircle className="w-3 h-3 mr-1" />}
                          {sub.Status === 'rejected' && <XCircle className="w-3 h-3 mr-1" />}
                          {sub.Status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                          {sub.Status === 'reviewed' && <FileText className="w-3 h-3 mr-1" />}
                          {sub.Status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                          sub['Lead Status'] === 'new' ? 'bg-bg-primary text-text-secondary border border-bg-border' :
                          sub['Lead Status'] === 'cold' ? 'bg-accent-blue/10 text-accent-blue' :
                          sub['Lead Status'] === 'warm' ? 'bg-accent-yellow/10 text-accent-yellow' :
                          sub['Lead Status'] === 'hot' ? 'bg-accent-red/10 text-accent-red' :
                          sub['Lead Status'] === 'skipped' ? 'bg-purple-500/10 text-purple-400' :
                          sub['Lead Status'] === 'closed' ? 'bg-accent-green/10 text-accent-green' :
                          'bg-bg-primary text-text-muted border border-bg-border'
                        }`}>
                          {sub['Lead Status']}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-text-secondary">{sub['Reviewed By']}</td>
                      <td className="py-3 px-4 text-text-muted max-w-[200px] truncate">{sub.Remarks}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-2 items-center">
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedSub(sub._raw); }}>
                            View Form
                          </Button>
                          <Button 
                            variant="danger" 
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleDeleteSubmission(sub._raw.id, e); }}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ));
                  })()
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : activeTab === 'teamlead' ? (
        <Card className="flex flex-col p-0 overflow-hidden min-h-[400px]">
          <div className="p-5 border-b border-bg-border">
            <h3 className="text-sm font-semibold text-white">Team Lead Performance Report</h3>
            <p className="text-xs text-text-muted mt-1">Review team lead submission volumes and lead dispositions.</p>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="sticky top-0 bg-bg-secondary border-b border-bg-border shadow-sm z-10">
                <tr className="text-text-muted text-[10px] uppercase tracking-widest">
                  <th className="py-3 px-4 font-semibold">Team Lead</th>
                  <th className="py-3 px-4 font-semibold text-center">Total Entries</th>
                  <th className="py-3 px-4 font-semibold text-center">Assigned to TC</th>
                  <th className="py-3 px-4 font-semibold text-center text-accent-red">Immediate</th>
                  <th className="py-3 px-4 font-semibold text-center text-accent-green">Closed</th>
                  <th className="py-3 px-4 font-semibold text-center text-red-500">Deleted</th>
                </tr>
              </thead>
              <tbody>
                {dataTeamLeads.length > 0 ? dataTeamLeads.map((d, i) => (
                  <React.Fragment key={d.id || i}>
                    <tr 
                      className="border-b border-bg-border last:border-0 hover:bg-bg-hover/50 transition-colors cursor-pointer"
                      onClick={() => toggleTlRow(d.id)}
                    >
                      <td className="py-3 px-4 text-white font-medium flex items-center gap-2">
                        {expandedTlRows.has(d.id) ? <ChevronDown className="w-4 h-4 text-text-muted" /> : <ChevronRight className="w-4 h-4 text-text-muted" />}
                        {d.name}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-white">{d.totalEntries.toLocaleString()}</td>
                      <td className="py-3 px-4 text-center font-medium text-text-secondary">{d.assigned.toLocaleString()}</td>
                      <td className="py-3 px-4 text-center font-medium text-accent-red">{d.immediate.toLocaleString()}</td>
                      <td className="py-3 px-4 text-center font-medium text-accent-green">{d.closed.toLocaleString()}</td>
                      <td className="py-3 px-4 text-center font-medium text-red-500">{d.deleted.toLocaleString()}</td>
                    </tr>
                    {expandedTlRows.has(d.id) && Object.keys(d.telecallers).length > 0 && (
                      <tr className="bg-bg-primary border-b border-bg-border">
                        <td colSpan={6} className="p-0">
                          <div className="py-4 pl-12 pr-4">
                            <h4 className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-3">Telecaller Breakdown</h4>
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="text-text-muted border-b border-bg-border/50 uppercase tracking-widest text-[9px]">
                                  <th className="py-2 px-3 font-semibold">Telecaller Name</th>
                                  <th className="py-2 px-3 font-semibold text-center">Assigned Leads</th>
                                  <th className="py-2 px-3 font-semibold text-center text-accent-red">Immediate</th>
                                  <th className="py-2 px-3 font-semibold text-center text-accent-green">Closed</th>
                                  <th className="py-2 px-3 font-semibold text-center text-red-500">Deleted</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.values(d.telecallers).sort((a,b) => b.assigned - a.assigned).map((tc, tcIdx) => (
                                  <tr key={tcIdx} className="border-b border-bg-border/50 last:border-0 hover:bg-bg-hover/30">
                                    <td className="py-2 px-3 text-white font-medium">{tc.name}</td>
                                    <td className="py-2 px-3 text-center text-text-secondary font-medium">{tc.assigned}</td>
                                    <td className="py-2 px-3 text-center text-accent-red font-medium">{tc.immediate}</td>
                                    <td className="py-2 px-3 text-center text-accent-green font-medium">{tc.closed}</td>
                                    <td className="py-2 px-3 text-center text-red-500 font-medium">{tc.deleted}</td>
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
                  <tr><td colSpan={6} className="py-8 text-center text-text-muted">No team lead data available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : activeTab === 'telecaller' ? (
        <Card className="flex flex-col p-0 overflow-hidden min-h-[400px]">
          <div className="p-5 border-b border-bg-border">
            <h3 className="text-sm font-semibold text-white">Telecaller Performance Report</h3>
            <p className="text-xs text-text-muted mt-1">Review overall lead conversion and handling metrics per telecaller.</p>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="sticky top-0 bg-bg-secondary border-b border-bg-border shadow-sm z-10">
                <tr className="text-text-muted text-[10px] uppercase tracking-widest">
                  <th className="py-3 px-4 font-semibold">Telecaller</th>
                  <th className="py-3 px-4 font-semibold text-center">Total Assigned</th>
                  <th className="py-3 px-4 font-semibold text-center text-accent-green">New</th>
                  <th className="py-3 px-4 font-semibold text-center text-accent-blue">Cold</th>
                  <th className="py-3 px-4 font-semibold text-center text-accent-yellow">Warm</th>
                  <th className="py-3 px-4 font-semibold text-center text-accent-red">Hot</th>
                  <th className="py-3 px-4 font-semibold text-center text-accent-red">Immediate</th>
                  <th className="py-3 px-4 font-semibold text-center text-text-muted">Skipped</th>
                  <th className="py-3 px-4 font-semibold text-center text-orange-400">Wrong No.</th>
                  <th className="py-3 px-4 font-semibold text-center text-purple-400">Reverted</th>
                  <th className="py-3 px-4 font-semibold text-center text-accent-green">Closed</th>
                </tr>
              </thead>
              <tbody>
                {dataTelecallers.length > 0 ? dataTelecallers.map((d, i) => (
                  <tr key={i} className="border-b border-bg-border last:border-0 hover:bg-bg-hover/50 transition-colors cursor-pointer" onClick={() => navigate(`/admin/telecaller/${d.id}`)}>
                    <td className="py-3 px-4 text-white font-medium">{d.name}</td>
                    <td className="py-3 px-4 text-center font-bold text-white">{d.assigned.toLocaleString()}</td>
                    <td className="py-3 px-4 text-center text-accent-green font-medium">{d.callsToNew || 0} / {d.newLeads}</td>
                    <td className="py-3 px-4 text-center text-accent-blue font-medium">{d.callsToCold || 0} / {d.cold}</td>
                    <td className="py-3 px-4 text-center text-accent-yellow font-medium">{d.callsToWarm || 0} / {d.warm}</td>
                    <td className="py-3 px-4 text-center text-accent-red font-medium">{d.callsToHot || 0} / {d.hot}</td>
                    <td className="py-3 px-4 text-center text-accent-red font-medium">{d.callsToImmediate || 0} / {d.immediate}</td>
                    <td className="py-3 px-4 text-center text-text-muted">{d.callsToSkipped || 0} / {d.skipped}</td>
                    <td className="py-3 px-4 text-center text-orange-400">{d.callsToWrongNumber || 0} / {d.wrongNumber}</td>
                    <td className="py-3 px-4 text-center text-purple-400 font-medium">{d.callsToReverted || 0} / {d.reverted}</td>
                    <td className="py-3 px-4 text-center text-accent-green font-bold">{d.callsToClosed || 0} / {d.closed}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={11} className="py-8 text-center text-text-muted">No telecaller data available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <Card title={`Analytics: ${tabs.find(t => t.id === activeTab)?.label}`} className="lg:col-span-2 h-[400px] flex flex-col">
          <div className="flex-1 mt-4">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center text-text-muted border-2 border-dashed border-bg-border rounded-xl">
                <Loader2 className="w-8 h-8 animate-spin text-accent-blue mb-4" />
                <p>Loading analytics...</p>
              </div>
            ) : activeTab === 'domain' || activeTab === 'role' ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activeTab === 'domain' ? dataDomains : dataRoles}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#252840" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1d2e', borderColor: '#252840', color: '#fff', borderRadius: '8px' }}
                    cursor={{ fill: '#1e2235' }}
                  />
                  <Bar dataKey="count" fill="#4f6ef7" radius={[4, 4, 0, 0]}>
                    {(activeTab === 'domain' ? dataDomains : dataRoles).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : activeTab === 'person' ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataSurveyors} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#252840" horizontal={false} />
                  <XAxis type="number" stroke="#64748b" fontSize={12} />
                  <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={12} width={100} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1d2e', borderColor: '#252840', color: '#fff', borderRadius: '8px' }}
                    cursor={{ fill: '#1e2235' }}
                  />
                  <Legend />
                  <Bar dataKey="submissions" fill="#4f6ef7" name="Total Submissions" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </Card>

        <Card className="lg:col-span-1 flex flex-col p-0 overflow-hidden h-[400px]">
          <div className="p-4 border-b border-bg-border shrink-0">
            <h3 className="text-sm font-semibold text-white">Data Breakdown</h3>
          </div>
          <div className="overflow-y-auto overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="sticky top-0 bg-bg-secondary z-10 border-b border-bg-border">
                <tr className="text-text-muted text-[10px] uppercase tracking-widest">
                  <th className="py-3 px-4 font-semibold">
                    {activeTab === 'person' ? 'Surveyor' : activeTab === 'teamlead' ? 'Team Lead' : 'Entity'}
                  </th>
                  <th className="py-3 px-4 font-semibold text-right">
                    {activeTab === 'teamlead' ? 'Action Count' : 'Submissions'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={2} className="py-8 text-center text-text-muted italic">Loading data...</td>
                  </tr>
                )}
                
                {!isLoading && (activeTab === 'domain' || activeTab === 'role') && (activeTab === 'domain' ? dataDomains : dataRoles).map((d, i) => (
                  <tr key={i} className="border-b border-bg-border last:border-0 hover:bg-bg-hover/50">
                    <td className="py-3 px-4 text-white font-medium">{d.name}</td>
                    <td className="py-3 px-4 text-right text-text-secondary font-mono">{d.count}</td>
                  </tr>
                ))}
                {!isLoading && activeTab === 'person' && dataSurveyors.map((d, i) => (
                  <tr key={i} className="border-b border-bg-border last:border-0 hover:bg-bg-hover/50">
                    <td className="py-3 px-4">
                      <div className="text-white font-medium">{d.name}</div>
                      <div className="text-[10px] text-text-muted">{d.role}</div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="font-mono text-white mb-1">{d.submissions}</div>
                    </td>
                  </tr>
                ))}
                {!isLoading && activeTab !== 'master' && 
                 ((activeTab === 'domain' && dataDomains.length === 0) ||
                  (activeTab === 'role' && dataRoles.length === 0) ||
                  (activeTab === 'person' && dataSurveyors.length === 0)) && (
                  <tr>
                    <td colSpan={2} className="py-8 text-center text-text-muted italic">No data available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
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

      {/* Custom Template Selection Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-bg-secondary w-full max-w-lg rounded-xl border border-bg-border shadow-2xl flex flex-col overflow-hidden">
            <div className="p-5 border-b border-bg-border flex justify-between items-center bg-bg-primary shrink-0">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <PieChart className="w-5 h-5 text-accent-blue" />
                Select Custom Dashboard
              </h3>
              <button onClick={() => setShowTemplateModal(false)} className="text-text-muted hover:text-white p-2 rounded-full hover:bg-bg-secondary transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {isLoadingTemplates ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 text-accent-blue animate-spin mb-4" />
                  <p className="text-text-muted">Loading templates...</p>
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8 text-text-muted italic border-2 border-dashed border-bg-border rounded-xl">
                  No active templates found.
                </div>
              ) : (
                <div className="space-y-3">
                  {templates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => navigate(`/admin/reports/custom/${t.id}`)}
                      className="w-full text-left bg-bg-primary border border-bg-border p-4 rounded-xl hover:border-accent-blue/50 transition-colors group flex justify-between items-center"
                    >
                      <div>
                        <h4 className="font-bold text-white group-hover:text-accent-blue transition-colors">{t.name}</h4>
                        <p className="text-xs text-text-secondary mt-1">{t.description || 'No description'}</p>
                      </div>
                      <PieChart className="w-5 h-5 text-text-muted group-hover:text-accent-blue transition-colors" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
