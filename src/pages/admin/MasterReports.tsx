import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Download, Calendar, Filter, Database, Users, Building2, Loader2, Info, X, MapPin } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, Legend } from 'recharts';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

const COLORS = ['#4f6ef7', '#22c55e', '#eab308', '#ef4444', '#06b6d4', '#f97316'];

interface SurveyorData {
  name: string;
  role: string;
  submissions: number;
  approved: number;
  reverted: number;
  pending: number;
  lastActive: string;
}

interface TeamLeadData {
  name: string;
  approvals: number;
  reverts: number;
}

export default function MasterReports() {
  const [activeTab, setActiveTab] = useState('domain');
  const [isLoading, setIsLoading] = useState(true);

  const [dataDomains, setDataDomains] = useState<{name: string, count: number}[]>([]);
  const [dataRoles, setDataRoles] = useState<{name: string, count: number}[]>([]);
  const [dataSurveyors, setDataSurveyors] = useState<SurveyorData[]>([]);
  const [dataTeamLeads, setDataTeamLeads] = useState<TeamLeadData[]>([]);
  const [masterDump, setMasterDump] = useState<any[]>([]);
  const [dynamicColumns, setDynamicColumns] = useState<string[]>([]);
  const [selectedSub, setSelectedSub] = useState<any | null>(null);
  
  const [stats, setStats] = useState({
    totalSubmissions: 0,
    activeDomains: 0,
    totalWorkstations: 0,
    dataHealth: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { count: domainCount, error: domainError } = await supabase.from('domains').select('*', { count: 'exact', head: true });
      if (domainError) throw domainError;

      const { count: survCount, error: survError } = await supabase.from('surveyors').select('*', { count: 'exact', head: true });
      if (survError) throw survError;

      const { data: subData, error: subError } = await supabase
        .from('submissions')
        .select(`
          id,
          status,
          submitted_at,
          domains(name),
          surveyors(username, full_name, user_roles(name)),
          data,
          form_templates(fields),
          reviewed_by,
          admin_notes
        `);
      
      if (subError) throw subError;

      const submissions = subData || [];

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
      const teamLeadMap: Record<string, TeamLeadData> = {};
      const rawDump: any[] = [];

      const dynamicKeysSet = new Set<string>();

      const tlIdsToFetch = new Set<string>();
      submissions.forEach(sub => {
        if (sub.reviewed_by) tlIdsToFetch.add(sub.reviewed_by);
      });

      const tlNameMap = new Map<string, string>();
      if (tlIdsToFetch.size > 0) {
        const { data: tlData } = await supabase.from('surveyors').select('id, full_name').in('id', Array.from(tlIdsToFetch));
        tlData?.forEach(tl => tlNameMap.set(tl.id, tl.full_name));
      }

      submissions.forEach(sub => {
        const dName = (sub.domains as any)?.name || 'Unassigned';
        const survData = sub.surveyors as any;
        const sName = survData?.full_name || survData?.username || 'Unknown';
        const rName = survData?.user_roles?.name || 'Unknown Role';

        domainMap[dName] = (domainMap[dName] || 0) + 1;
        roleMap[rName] = (roleMap[rName] || 0) + 1;

        if (!survMap[sName]) {
          survMap[sName] = { name: sName, role: rName, submissions: 0, approved: 0, reverted: 0, pending: 0, lastActive: sub.submitted_at };
        }
        survMap[sName].submissions += 1;
        if (sub.status === 'approved') survMap[sName].approved += 1;
        else if (sub.status === 'reverted') survMap[sName].reverted += 1;
        else survMap[sName].pending += 1;

        if (new Date(sub.submitted_at) > new Date(survMap[sName].lastActive)) {
          survMap[sName].lastActive = sub.submitted_at;
        }

        const tlName = sub.reviewed_by ? tlNameMap.get(sub.reviewed_by) || 'Unknown Team Lead' : null;

        if (sub.reviewed_by && sub.status !== 'submitted') {
          if (!teamLeadMap[sub.reviewed_by]) {
            teamLeadMap[sub.reviewed_by] = { name: tlName!, approvals: 0, reverts: 0 };
          }
          if (sub.status === 'approved') teamLeadMap[sub.reviewed_by].approvals += 1;
          if (sub.status === 'reverted') teamLeadMap[sub.reviewed_by].reverts += 1;
        }

        let rowData: any = {
          ID: sub.id.split('-')[0].toUpperCase(),
          Date: new Date(sub.submitted_at).toLocaleString(),
          Role: rName,
          Surveyor: sName,
          Domain: dName,
          Status: sub.status,
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

      setDynamicColumns(Array.from(dynamicKeysSet));

      setDataDomains(Object.entries(domainMap).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count));
      setDataRoles(Object.entries(roleMap).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count));
      
      setDataSurveyors(Object.values(survMap).sort((a,b) => b.submissions - a.submissions));
      setDataTeamLeads(Object.values(teamLeadMap).sort((a,b) => (b.approvals + b.reverts) - (a.approvals + a.reverts)));
      
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
      dataToExport = dataSurveyors.map(d => ({ Surveyor: d.name, Role: d.role, Submissions: d.submissions, Approved: d.approved, Reverted: d.reverted, Pending: d.pending }));
      sheetName = 'By Surveyor';
    } else if (activeTab === 'teamlead') {
      dataToExport = dataTeamLeads.map(d => ({ 'Team Lead': d.name, Approvals: d.approvals, Reverts: d.reverts }));
      sheetName = 'By Team Lead';
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

  const tabs = [
    { id: 'domain', label: 'By Domain', icon: Database },
    { id: 'role', label: 'By Role', icon: Users },
    { id: 'person', label: 'By Surveyor', icon: Filter },
    { id: 'teamlead', label: 'By Team Lead', icon: Building2 },
    { id: 'master', label: 'Master Dump', icon: Database },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Master Reports Hub</h2>
          <p className="text-text-secondary text-sm mt-1">Analyze data collection performance across all vectors.</p>
        </div>
        <div className="flex items-center gap-3">
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          <div className="p-5 border-b border-bg-border">
            <h3 className="text-sm font-semibold text-white">Master Data Entries</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap text-sm">
              <thead className="bg-bg-secondary border-b border-bg-border">
                <tr className="text-text-muted text-[10px] uppercase tracking-widest">
                  <th className="py-3 px-4 font-semibold">ID</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Role</th>
                  <th className="py-3 px-4 font-semibold">Surveyor</th>
                  <th className="py-3 px-4 font-semibold">Domain</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Reviewed By</th>
                  <th className="py-3 px-4 font-semibold max-w-[200px]">Remarks</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-text-muted italic">Loading data...</td>
                  </tr>
                ) : masterDump.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-text-muted italic">No submissions recorded yet.</td>
                  </tr>
                ) : (
                  masterDump.map((d, i) => (
                    <tr key={i} className="border-b border-bg-border last:border-0 hover:bg-bg-hover/50 cursor-pointer" onClick={() => setSelectedSub(d._raw)}>
                      <td className="py-3 px-4 text-white font-mono text-xs">{d.ID}</td>
                      <td className="py-3 px-4 text-text-secondary text-xs">{d.Date}</td>
                      <td className="py-3 px-4 text-text-secondary">{d.Role}</td>
                      <td className="py-3 px-4 text-white font-medium">{d.Surveyor}</td>
                      <td className="py-3 px-4 text-text-secondary">{d.Domain}</td>
                      <td className="py-3 px-4 text-text-secondary">
                        <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                          d.Status === 'approved' ? 'bg-accent-green/20 text-accent-green' :
                          d.Status === 'reverted' ? 'bg-accent-yellow/20 text-accent-yellow' :
                          'bg-accent-blue/20 text-accent-blue'
                        }`}>{d.Status}</span>
                      </td>
                      <td className="py-3 px-4 text-text-secondary">{d['Reviewed By']}</td>
                      <td className="py-3 px-4 text-text-secondary max-w-[200px] truncate" title={d.Remarks}>{d.Remarks}</td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedSub(d._raw); }}>
                          View Form
                        </Button>
                      </td>
                    </tr>
                  ))
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
                  <Bar dataKey="approved" stackId="a" fill="#22c55e" name="Approved" />
                  <Bar dataKey="pending" stackId="a" fill="#4f6ef7" name="Pending" />
                  <Bar dataKey="reverted" stackId="a" fill="#eab308" name="Reverted" />
                </BarChart>
              </ResponsiveContainer>
            ) : activeTab === 'teamlead' ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataTeamLeads} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#252840" horizontal={false} />
                  <XAxis type="number" stroke="#64748b" fontSize={12} />
                  <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={12} width={100} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1d2e', borderColor: '#252840', color: '#fff', borderRadius: '8px' }}
                    cursor={{ fill: '#1e2235' }}
                  />
                  <Legend />
                  <Bar dataKey="approvals" fill="#22c55e" name="Approved" />
                  <Bar dataKey="reverts" fill="#eab308" name="Reverted" />
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </Card>

        <Card title="Data Breakdown" className="lg:col-span-1 flex flex-col p-0 overflow-hidden">
          <div className="overflow-y-auto max-h-[400px]">
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
                      <div className="flex justify-end gap-1 text-[10px]">
                         <span className="text-accent-green" title="Approved">{d.approved}</span>/
                         <span className="text-accent-yellow" title="Reverted">{d.reverted}</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {!isLoading && activeTab === 'teamlead' && dataTeamLeads.map((d, i) => (
                  <tr key={i} className="border-b border-bg-border last:border-0 hover:bg-bg-hover/50">
                    <td className="py-3 px-4 text-white font-medium">{d.name}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex flex-col items-end gap-1 text-[11px] font-mono">
                         <span className="text-accent-green bg-accent-green/10 px-2 rounded w-full text-right">{d.approvals} A</span>
                         <span className="text-accent-yellow bg-accent-yellow/10 px-2 rounded w-full text-right">{d.reverts} REV</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {!isLoading && activeTab !== 'master' && 
                 ((activeTab === 'domain' && dataDomains.length === 0) ||
                  (activeTab === 'role' && dataRoles.length === 0) ||
                  (activeTab === 'person' && dataSurveyors.length === 0) ||
                  (activeTab === 'teamlead' && dataTeamLeads.length === 0)) && (
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

      {/* Read-Only Slide-out Detail Panel */}
      {selectedSub && (
        <div className="fixed top-0 right-0 w-96 lg:w-[32rem] h-full bg-bg-secondary border-l border-bg-border shadow-2xl flex flex-col z-50 transition-transform transform translate-x-0">
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
              {selectedSub.data && Object.keys(selectedSub.data).length > 0 ? Object.entries(selectedSub.data).map(([key, value]) => {
                let label = key;
                if (selectedSub.form_templates?.fields) {
                  const templates = selectedSub.form_templates;
                  const fieldsData = Array.isArray(templates) ? templates[0]?.fields : templates?.fields;
                  if (fieldsData) {
                    const fieldConfig = fieldsData.find((f: any) => f.id === key);
                    if (fieldConfig && fieldConfig.label) {
                      label = fieldConfig.label;
                    }
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
              }) : (
                <div className="text-text-muted italic text-sm">No data entries found.</div>
              )}
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
      )}
    </div>
  );
}
