import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { 
  ArrowLeft, 
  Download, 
  Loader2, 
  Users, 
  UserCheck, 
  Eye, 
  ArrowRightLeft, 
  X, 
  Phone, 
  User, 
  Calendar, 
  CheckSquare, 
  Square, 
  Filter, 
  RefreshCw,
  PieChart as PieChartIcon
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { FormTemplate, FieldConfig, Submission } from '../../types';
import ViewFormModal from '../../components/common/ViewFormModal';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const COLORS = ['#4f6ef7', '#22c55e', '#eab308', '#ef4444', '#06b6d4', '#f97316', '#8b5cf6', '#ec4899', '#14b8a6'];

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

export default function TLAssignedCustomTemplateDashboard() {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [teamTelecallers, setTeamTelecallers] = useState<any[]>([]);

  // Question & drill-down filters
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [surveyorFilter, setSurveyorFilter] = useState('all');
  const [telecallerFilter, setTelecallerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Lead selection & Reassignment
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reassignTarget, setReassignTarget] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [singleReassignSub, setSingleReassignSub] = useState<any | null>(null);

  // View Form Modal
  const [selectedSub, setSelectedSub] = useState<any | null>(null);

  const fetchData = async () => {
    if (!user) {
      setSubmissions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // 1. Refresh profile to ensure assigned_users list is up-to-date (lean query)
      const { data: freshTL } = await supabase
        .from('surveyors')
        .select('assigned_users')
        .eq('id', user.id)
        .single();

      if (freshTL && updateUser && user) {
        if (JSON.stringify(user.assigned_users) !== JSON.stringify(freshTL.assigned_users)) {
          updateUser({ ...user, assigned_users: freshTL.assigned_users });
        }
      }

      const activeAssignedUsers = freshTL?.assigned_users || user.assigned_users || [];
      if (activeAssignedUsers.length === 0) {
        setSubmissions([]);
        setIsLoading(false);
        return;
      }

      // 2. Fetch Form Template
      let tmpl: FormTemplate | null = null;
      const { data: templateData } = await supabase
        .from('form_templates')
        .select('*')
        .eq('id', templateId)
        .or('is_deleted.is.null,is_deleted.eq.false')
        .maybeSingle();

      if (templateData) {
        let parsedFields = templateData.fields;
        if (typeof parsedFields === 'string') {
          try { parsedFields = JSON.parse(parsedFields); } catch {}
        }
        tmpl = { ...templateData, fields: parsedFields || [] };
      }

      // Fallback to file_form_templates if not found
      if (!tmpl || !tmpl.fields || tmpl.fields.length === 0) {
        const { data: fileTmplData } = await supabase
          .from('file_form_templates')
          .select('*')
          .eq('id', templateId)
          .maybeSingle();

        if (fileTmplData) {
          let parsedFields = fileTmplData.fields;
          if (typeof parsedFields === 'string') {
            try { parsedFields = JSON.parse(parsedFields); } catch {}
          }
          tmpl = { ...fileTmplData, fields: parsedFields || [] };
        }
      }

      setTemplate(tmpl);

      // Fetch subordinate profiles to separate Surveyors and Telecallers
      const { data: subordinateProfiles } = await supabase
        .from('surveyors')
        .select('id, full_name, username, user_role:user_roles(name)')
        .in('id', activeAssignedUsers);

      const assignedSurveyors: any[] = [];
      const assignedTelecallers: any[] = [];

      subordinateProfiles?.forEach(u => {
        const roleName = (Array.isArray(u.user_role) ? u.user_role[0]?.name : (u.user_role as any)?.name)?.toLowerCase() || '';
        if (roleName.includes('telecaller')) {
          assignedTelecallers.push(u);
        } else {
          assignedSurveyors.push(u);
        }
      });

      const assignedSurveyorIds = assignedSurveyors.map(s => s.id);
      const assignedTelecallerIds = assignedTelecallers.map(t => t.id);

      // 3. Fetch ASSIGNED submissions with lean select (omit duplicate form_templates.fields since tmpl is already loaded)
      const fetchPromises: Promise<any>[] = [];
      const selectQuery = `
        id,
        form_template_id,
        surveyor_id,
        telecaller_id,
        lead_status,
        lead_status_updated_at,
        telecaller_remark,
        submitted_at,
        status,
        data,
        surveyor:surveyors!surveyor_id(id, full_name, username),
        telecaller:surveyors!telecaller_id(id, full_name, username),
        form_templates(name)
      `;

      if (assignedSurveyorIds.length > 0) {
        fetchPromises.push(
          supabase
            .from('submissions')
            .select(selectQuery)
            .eq('form_template_id', templateId)
            .in('surveyor_id', assignedSurveyorIds)
            .not('telecaller_id', 'is', null)
            .order('submitted_at', { ascending: false })
        );
      }

      if (assignedTelecallerIds.length > 0) {
        let tcQuery = supabase
          .from('submissions')
          .select(selectQuery)
          .eq('form_template_id', templateId)
          .in('telecaller_id', assignedTelecallerIds)
          .not('telecaller_id', 'is', null);

        // Exclude leads already matched by surveyor_id to prevent querying/transferring duplicate rows
        if (assignedSurveyorIds.length > 0) {
          tcQuery = tcQuery.not('surveyor_id', 'in', `(${assignedSurveyorIds.join(',')})`);
        }

        fetchPromises.push(tcQuery.order('submitted_at', { ascending: false }));
      }

      const results = await Promise.all(fetchPromises);
      for (const res of results) {
        if (res.error) throw res.error;
      }

      const subsMap = new Map<string, any>();
      results.forEach(res => {
        (res.data || []).forEach((sub: any) => {
          subsMap.set(sub.id, sub);
        });
      });

      const finalSubs = Array.from(subsMap.values()).sort(
        (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
      );
      setSubmissions(finalSubs);

      // 4. Resolve available Telecallers for reassigning in memory without extra database call
      const uniqueTcsMap = new Map<string, any>();
      assignedTelecallers.forEach(tc => uniqueTcsMap.set(tc.id, tc));
      finalSubs.forEach(sub => {
        if (sub.telecaller && sub.telecaller.id && !uniqueTcsMap.has(sub.telecaller.id)) {
          uniqueTcsMap.set(sub.telecaller.id, {
            id: sub.telecaller.id,
            full_name: sub.telecaller.full_name,
            username: sub.telecaller.username
          });
        }
      });

      const uniqueTcs = Array.from(uniqueTcsMap.values());
      setTeamTelecallers(uniqueTcs);

    } catch (err: any) {
      console.error('Failed to load assigned leads custom data:', err);
      toast.error('Failed to load assigned leads data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (templateId) {
      fetchData();
    }
  }, [templateId, user?.id]);

  // Reset page when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, surveyorFilter, telecallerFilter, statusFilter, dateRange]);

  const handleFilterChange = (fieldId: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const toggleArrayFilter = (fieldId: string, option: string) => {
    setFilters(prev => {
      const current = Array.isArray(prev[fieldId]) ? prev[fieldId] : [];
      if (current.includes(option)) {
        return { ...prev, [fieldId]: current.filter((item: string) => item !== option) };
      } else {
        return { ...prev, [fieldId]: [...current, option] };
      }
    });
  };

  // Distinct Surveyors and Telecallers from assigned leads
  const uniqueSurveyors = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    submissions.forEach(sub => {
      if (sub.surveyor_id) {
        map.set(sub.surveyor_id, {
          id: sub.surveyor_id,
          name: sub.surveyor?.full_name || sub.surveyor?.username || 'Unknown Surveyor'
        });
      }
    });
    return Array.from(map.values());
  }, [submissions]);

  const uniqueTelecallers = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    submissions.forEach(sub => {
      if (sub.telecaller_id) {
        map.set(sub.telecaller_id, {
          id: sub.telecaller_id,
          name: sub.telecaller?.full_name || sub.telecaller?.username || 'Assigned Telecaller'
        });
      }
    });
    return Array.from(map.values());
  }, [submissions]);

  // Main filtered leads list
  const filteredSubmissions = useMemo(() => {
    return submissions.filter(sub => {
      // 1. Check Surveyor filter
      if (surveyorFilter !== 'all' && sub.surveyor_id !== surveyorFilter) return false;

      // 2. Check Telecaller filter
      if (telecallerFilter !== 'all' && sub.telecaller_id !== telecallerFilter) return false;

      // 3. Check Lead Status filter
      if (statusFilter !== 'all' && (sub.lead_status || 'new') !== statusFilter) return false;

      // 4. Check Date Range
      if (dateRange.from || dateRange.to) {
        const subDate = new Date(sub.submitted_at).getTime();
        if (dateRange.from) {
          const fromDate = new Date(dateRange.from).getTime();
          if (subDate < fromDate) return false;
        }
        if (dateRange.to) {
          const toDate = new Date(dateRange.to).getTime() + 86400000;
          if (subDate >= toDate) return false;
        }
      }

      // 5. Dynamic form question filters
      for (const [fieldId, filterValue] of Object.entries(filters)) {
        if (!filterValue || (Array.isArray(filterValue) && filterValue.length === 0)) continue;

        let subValue = sub.data?.[fieldId];
        // Check case-insensitive fallback if direct key not matched
        if (subValue === undefined && template?.fields) {
          const matchedField = template.fields.find(f => f.id === fieldId);
          if (matchedField?.label && sub.data?.[matchedField.label] !== undefined) {
            subValue = sub.data[matchedField.label];
          }
        }

        if (Array.isArray(filterValue)) {
          if (Array.isArray(subValue)) {
            const hasIntersection = subValue.some(v => filterValue.includes(String(v)));
            if (!hasIntersection) return false;
          } else {
            if (!filterValue.includes(String(subValue ?? ''))) return false;
          }
        } else if (typeof filterValue === 'string') {
          if (!subValue || !String(subValue).toLowerCase().includes(filterValue.toLowerCase())) {
            return false;
          }
        }
      }

      return true;
    });
  }, [submissions, filters, surveyorFilter, telecallerFilter, statusFilter, dateRange, template]);

  // Lead Reassignment Handler
  const handleReassign = async (targetTcId?: string) => {
    const targetId = targetTcId || reassignTarget;
    const leadsToReassign = singleReassignSub ? [singleReassignSub.id] : Array.from(selectedIds);

    if (!targetId || leadsToReassign.length === 0) {
      toast.error('Please select a telecaller to reassign leads.');
      return;
    }

    setIsReassigning(true);
    try {
      const { error } = await supabase
        .from('submissions')
        .update({ 
          telecaller_id: targetId,
          lead_status_updated_at: new Date().toISOString()
        })
        .in('id', leadsToReassign);

      if (error) throw error;

      const tcObj = teamTelecallers.find(t => t.id === targetId);
      const tcName = tcObj?.full_name || tcObj?.username || 'Telecaller';
      toast.success(`Successfully reassigned ${leadsToReassign.length} lead(s) to ${tcName}!`);

      setSelectedIds(new Set());
      setReassignTarget('');
      setIsReassignModalOpen(false);
      setSingleReassignSub(null);

      // Refresh list
      await fetchData();
    } catch (err: any) {
      console.error('Failed to reassign leads:', err);
      toast.error(err.message || 'Failed to reassign leads');
    } finally {
      setIsReassigning(false);
    }
  };

  // Excel Export
  const handleExportExcel = () => {
    if (!template || filteredSubmissions.length === 0) {
      toast.error('No data to export');
      return;
    }

    const dataToExport = filteredSubmissions.map(sub => {
      const row: any = {
        'Submission ID': sub.id.split('-')[0].toUpperCase(),
        'Date': new Date(sub.submitted_at).toLocaleString(),
        'Surveyor': sub.surveyor?.full_name || sub.surveyor?.username || 'Unknown',
        'Assigned Telecaller': sub.telecaller?.full_name || sub.telecaller?.username || 'Unassigned',
        'Lead Status': sub.lead_status?.replace(/_/g, ' ') || 'new',
        'TC Remark': sub.telecaller_remark || ''
      };

      template.fields.forEach(field => {
        let val = sub.data?.[field.id] ?? sub.data?.[field.label];
        if (Array.isArray(val)) val = val.join(', ');
        else if (typeof val === 'object' && val !== null) {
          if ('lat' in val && 'lng' in val) val = `Lat: ${val.lat}, Lng: ${val.lng}`;
          else val = JSON.stringify(val);
        }
        row[field.label] = val !== undefined && val !== null ? val : '';
      });

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Assigned Leads');
    XLSX.writeFile(workbook, `${template.name}_Assigned_Leads_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Charts data
  const chartableFields = template?.fields.filter(f => ['select', 'radio', 'yes_no'].includes(f.type)) || [];

  // Telecaller distribution data for filtered leads
  const telecallerDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredSubmissions.forEach(sub => {
      const name = sub.telecaller?.full_name || sub.telecaller?.username || 'Unassigned';
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredSubmissions]);

  // Paginated leads
  const paginatedSubmissions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredSubmissions.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSubmissions, currentPage]);

  const totalPages = Math.ceil(filteredSubmissions.length / itemsPerPage);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-bg-secondary p-6 rounded-2xl border border-bg-border relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-accent-blue/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="flex items-center gap-4 relative z-10">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate('/teamlead/dashboard')} 
            className="border-bg-border text-text-secondary hover:text-white"
          >
            <ArrowLeft className="w-5 h-5 mr-1" /> Back
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {template?.name || 'Custom Form'} - Assigned Leads Analysis
              </h2>
              <Badge variant="blue">{submissions.length} Total Assigned</Badge>
            </div>
            <p className="text-text-secondary text-sm mt-1">
              Filter assigned leads by form questions, view assigned telecallers, and reassign leads.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 relative z-10">
          <Button 
            onClick={fetchData} 
            variant="outline" 
            size="sm"
            className="border-bg-border text-text-secondary hover:text-white"
            title="Refresh leads"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>

          <Button 
            onClick={handleExportExcel} 
            className="bg-accent-green hover:bg-accent-green/90 text-white border-transparent shadow-lg shadow-accent-green/20"
          >
            <Download className="w-4 h-4 mr-2" /> Export to Excel
          </Button>

          {selectedIds.size > 0 && (
            <Button 
              onClick={() => {
                setSingleReassignSub(null);
                setIsReassignModalOpen(true);
              }} 
              className="bg-accent-blue hover:bg-accent-blue/90 text-white shadow-lg shadow-accent-blue/20"
            >
              <ArrowRightLeft className="w-4 h-4 mr-2" /> Reassign {selectedIds.size} Selected Lead(s)
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-text-muted">
          <Loader2 className="w-8 h-8 animate-spin text-accent-blue" />
          <span className="text-sm">Loading assigned leads analysis...</span>
        </div>
      ) : template ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Question Dynamic Filters Sidebar */}
          <Card className="lg:col-span-1 p-5 flex flex-col gap-6 h-fit max-h-[85vh] overflow-y-auto hide-scrollbar sticky top-4 border-bg-border bg-bg-secondary">
            <div className="flex items-center justify-between border-b border-bg-border pb-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-accent-blue" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Form Question Filters</h3>
              </div>
              <span className="text-xs text-text-muted">{filteredSubmissions.length} matches</span>
            </div>

            <div className="space-y-5">
              {template.fields.map(field => {
                const isTextLike = ['text', 'textarea', 'email', 'phone', 'number'].includes(field.type);
                const isCategorical = ['select', 'radio', 'multiselect', 'checkbox'].includes(field.type);
                const isYesNo = field.type === 'yes_no';

                if (isTextLike) {
                  return (
                    <div key={field.id} className="space-y-1.5">
                      <label className="text-xs text-text-secondary font-semibold uppercase tracking-wider">{field.label}</label>
                      <Input
                        placeholder={`Filter by ${field.label}...`}
                        value={filters[field.id] || ''}
                        onChange={(e) => handleFilterChange(field.id, e.target.value)}
                        className="bg-bg-primary text-xs py-1.5"
                      />
                    </div>
                  );
                }

                if (isCategorical || isYesNo) {
                  const options = isYesNo ? ['Yes', 'No'] : (field.options || []);
                  const currentSelection = Array.isArray(filters[field.id]) ? filters[field.id] : [];

                  return (
                    <div key={field.id} className="space-y-1.5">
                      <label className="text-xs text-text-secondary font-semibold uppercase tracking-wider">{field.label}</label>
                      <div className="flex flex-col gap-1.5 bg-bg-primary p-2.5 rounded-lg border border-bg-border max-h-40 overflow-y-auto hide-scrollbar">
                        {options.map((opt, i) => {
                          const isChecked = currentSelection.includes(opt);
                          return (
                            <label
                              key={i}
                              className="flex items-center gap-2 cursor-pointer group py-0.5"
                              onClick={(e) => {
                                e.preventDefault();
                                toggleArrayFilter(field.id, opt);
                              }}
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                                isChecked ? 'bg-accent-blue border-accent-blue' : 'border-bg-border bg-bg-secondary group-hover:border-accent-blue/50'
                              }`}>
                                {isChecked && <div className="w-2 h-2 bg-white rounded-sm" />}
                              </div>
                              <span className="text-xs text-text-secondary group-hover:text-white transition-colors select-none truncate">
                                {opt}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                return null;
              })}

              <div className="pt-4 border-t border-bg-border flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full text-text-muted hover:text-white text-xs" 
                  onClick={() => {
                    setFilters({});
                    setSurveyorFilter('all');
                    setTelecallerFilter('all');
                    setStatusFilter('all');
                    setDateRange({ from: '', to: '' });
                  }}
                >
                  Clear All Filters
                </Button>
              </div>
            </div>
          </Card>

          {/* Main Area: Charts & Leads Table */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            
            {/* Visual Analytics Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Telecaller Lead Allocation Chart */}
              <Card className="p-4 flex flex-col min-h-[280px] bg-bg-secondary border-bg-border">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-accent-blue" /> Telecaller Allocation
                  </h4>
                  <span className="text-[10px] text-text-muted">{telecallerDistribution.length} telecallers</span>
                </div>
                <div className="flex-1 min-h-[200px]">
                  {telecallerDistribution.length > 0 ? (
                    <div className="flex h-full items-center">
                      <div className="w-1/2 h-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={telecallerDistribution}
                              cx="50%"
                              cy="50%"
                              innerRadius={35}
                              outerRadius={55}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {telecallerDistribution.map((_, index) => (
                                <Cell key={`tc-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#1a1d2e', borderColor: '#252840', color: '#fff', borderRadius: '8px' }} 
                              itemStyle={{ color: '#fff' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="w-1/2 max-h-[190px] overflow-y-auto pl-2 py-1 space-y-2 custom-scrollbar">
                        {telecallerDistribution.map((entry, index) => (
                          <div key={index} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 overflow-hidden mr-1">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                              <span className="text-text-secondary truncate" title={entry.name}>{entry.name}</span>
                            </div>
                            <span className="text-white font-bold shrink-0 bg-bg-primary px-2 py-0.5 rounded border border-bg-border">
                              {entry.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-text-muted text-xs italic">
                      No telecaller data
                    </div>
                  )}
                </div>
              </Card>

              {/* Form Question Breakdown Charts */}
              {chartableFields.slice(0, 2).map(field => {
                const counts: Record<string, number> = {};
                filteredSubmissions.forEach(sub => {
                  const val = sub.data?.[field.id] ?? sub.data?.[field.label];
                  if (val !== undefined && val !== null && val !== '') {
                    const key = String(val);
                    counts[key] = (counts[key] || 0) + 1;
                  }
                });
                const chartData = Object.entries(counts)
                  .map(([name, value]) => ({ name, value }))
                  .sort((a, b) => b.value - a.value);

                return (
                  <Card key={field.id} className="p-4 flex flex-col min-h-[280px] bg-bg-secondary border-bg-border">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3 truncate" title={field.label}>
                      {field.label}
                    </h4>
                    <div className="flex-1 min-h-[200px]">
                      {chartData.length > 0 ? (
                        <div className="flex h-full items-center">
                          <div className="w-1/2 h-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={chartData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={35}
                                  outerRadius={55}
                                  paddingAngle={4}
                                  dataKey="value"
                                >
                                  {chartData.map((_, index) => (
                                    <Cell key={`q-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip 
                                  contentStyle={{ backgroundColor: '#1a1d2e', borderColor: '#252840', color: '#fff', borderRadius: '8px' }} 
                                  itemStyle={{ color: '#fff' }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="w-1/2 max-h-[190px] overflow-y-auto pl-2 py-1 space-y-2 custom-scrollbar">
                            {chartData.map((entry, index) => (
                              <div key={index} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2 overflow-hidden mr-1">
                                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                  <span className="text-text-secondary truncate" title={entry.name}>{entry.name}</span>
                                </div>
                                <span className="text-white font-bold shrink-0 bg-bg-primary px-2 py-0.5 rounded border border-bg-border">
                                  {entry.value}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center text-text-muted text-xs italic">
                          No answer data
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Filter Toolbar & Assigned Leads Table */}
            <Card className="flex flex-col p-0 overflow-hidden border-bg-border bg-bg-secondary">
              
              {/* Toolbar */}
              <div className="p-4 border-b border-bg-border flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-bg-primary/50">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-bold text-white whitespace-nowrap">
                    Assigned Leads ({filteredSubmissions.length})
                  </h3>
                  {selectedIds.size > 0 && (
                    <Badge variant="blue">{selectedIds.size} Selected</Badge>
                  )}
                </div>

                {/* Filter controls */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Filter by Telecaller */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-text-muted uppercase">Telecaller:</span>
                    <select
                      value={telecallerFilter}
                      onChange={(e) => setTelecallerFilter(e.target.value)}
                      className="bg-bg-primary border border-bg-border rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-accent-blue focus:outline-none"
                    >
                      <option value="all">All Telecallers</option>
                      {uniqueTelecallers.map(tc => (
                        <option key={tc.id} value={tc.id}>{tc.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Filter by Surveyor */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-text-muted uppercase">Surveyor:</span>
                    <select
                      value={surveyorFilter}
                      onChange={(e) => setSurveyorFilter(e.target.value)}
                      className="bg-bg-primary border border-bg-border rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-accent-blue focus:outline-none"
                    >
                      <option value="all">All Surveyors</option>
                      {uniqueSurveyors.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Filter by Lead Status */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-text-muted uppercase">Status:</span>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-bg-primary border border-bg-border rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-accent-blue focus:outline-none"
                    >
                      <option value="all">All Statuses</option>
                      <option value="new">New</option>
                      <option value="cold">Cold</option>
                      <option value="warm">Warm</option>
                      <option value="hot">Hot</option>
                      <option value="immediate">Immediate</option>
                      <option value="reverted_to_tl">Reverted to TL</option>
                      <option value="wrong_number">Wrong Number</option>
                      <option value="closed">Closed</option>
                      <option value="deleted">Deleted</option>
                    </select>
                  </div>

                  {/* Date range */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-text-muted uppercase">From:</span>
                    <Input
                      type="date"
                      value={dateRange.from}
                      onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                      className="bg-bg-primary text-xs py-1 w-auto"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-text-muted uppercase">To:</span>
                    <Input
                      type="date"
                      value={dateRange.to}
                      onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                      className="bg-bg-primary text-xs py-1 w-auto"
                    />
                  </div>
                </div>
              </div>

              {/* Batch Reassignment Action Bar (Appears when leads are selected) */}
              {selectedIds.size > 0 && (
                <div className="p-3 bg-accent-blue/10 border-b border-accent-blue/30 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-accent-blue" />
                    <span className="text-sm font-semibold text-white">
                      {selectedIds.size} lead(s) selected for reassignment
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={reassignTarget}
                      onChange={(e) => setReassignTarget(e.target.value)}
                      className="bg-bg-primary border border-bg-border rounded-lg px-3 py-1.5 text-xs text-white focus:border-accent-blue focus:outline-none min-w-[200px]"
                    >
                      <option value="">Select Target Telecaller</option>
                      {teamTelecallers.map(tc => (
                        <option key={tc.id} value={tc.id}>{tc.full_name || tc.username}</option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      onClick={() => handleReassign()}
                      disabled={!reassignTarget || isReassigning}
                      className="bg-accent-blue hover:bg-accent-blue/90 text-white text-xs py-1.5"
                    >
                      {isReassigning ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <ArrowRightLeft className="w-3.5 h-3.5 mr-1" />}
                      Reassign Now
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedIds(new Set())}
                      className="text-text-muted hover:text-white text-xs py-1.5"
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>
              )}

              {/* Table */}
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse whitespace-nowrap text-sm min-w-[950px]">
                  <thead className="bg-bg-secondary border-b border-bg-border sticky top-0 z-10">
                    <tr className="text-text-muted text-[10px] uppercase tracking-widest">
                      <th className="py-3 px-4 font-semibold w-10">
                        <input
                          type="checkbox"
                          className="rounded border-bg-border bg-bg-primary text-accent-blue focus:ring-accent-blue cursor-pointer"
                          checked={paginatedSubmissions.length > 0 && paginatedSubmissions.every(s => selectedIds.has(s.id))}
                          onChange={(e) => {
                            const newSet = new Set(selectedIds);
                            if (e.target.checked) {
                              paginatedSubmissions.forEach(s => newSet.add(s.id));
                            } else {
                              paginatedSubmissions.forEach(s => newSet.delete(s.id));
                            }
                            setSelectedIds(newSet);
                          }}
                        />
                      </th>
                      <th className="py-3 px-4 font-semibold">Date</th>
                      <th className="py-3 px-4 font-semibold">Surveyor (Submitted By)</th>
                      <th className="py-3 px-4 font-semibold">Assigned Telecaller</th>
                      {template.fields.slice(0, 5).map(f => (
                        <th key={f.id} className="py-3 px-4 font-semibold max-w-[160px] truncate" title={f.label}>
                          {f.label}
                        </th>
                      ))}
                      <th className="py-3 px-4 font-semibold">Lead Status</th>
                      <th className="py-3 px-4 font-semibold">TC Remark</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedSubmissions.length === 0 ? (
                      <tr>
                        <td colSpan={template.fields.slice(0, 5).length + 7} className="py-12 text-center text-text-muted italic">
                          No matching assigned leads found.
                        </td>
                      </tr>
                    ) : (
                      paginatedSubmissions.map(sub => {
                        const isSelected = selectedIds.has(sub.id);
                        const surveyorName = sub.surveyor?.full_name || sub.surveyor?.username || 'Unknown';
                        const telecallerName = sub.telecaller?.full_name || sub.telecaller?.username || 'Unassigned';

                        return (
                          <tr 
                            key={sub.id} 
                            className={`border-b border-bg-border last:border-0 hover:bg-bg-primary/70 transition-colors ${
                              isSelected ? 'bg-accent-blue/10' : ''
                            }`}
                          >
                            <td className="py-3 px-4">
                              <input
                                type="checkbox"
                                className="rounded border-bg-border bg-bg-primary text-accent-blue focus:ring-accent-blue cursor-pointer"
                                checked={isSelected}
                                onChange={(e) => {
                                  const newSet = new Set(selectedIds);
                                  if (e.target.checked) newSet.add(sub.id);
                                  else newSet.delete(sub.id);
                                  setSelectedIds(newSet);
                                }}
                              />
                            </td>
                            <td className="py-3 px-4 text-text-secondary text-xs">
                              {new Date(sub.submitted_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-accent-blue shrink-0" />
                                <span className="text-white font-medium text-xs">{surveyorName}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-accent-green shrink-0" />
                                <span className="text-accent-blue font-semibold text-xs bg-accent-blue/10 px-2 py-0.5 rounded border border-accent-blue/20">
                                  {telecallerName}
                                </span>
                              </div>
                            </td>
                            {/* Question answers */}
                            {template.fields.slice(0, 5).map(f => {
                              let val = sub.data?.[f.id] ?? sub.data?.[f.label];
                              let display = '-';
                              if (val !== undefined && val !== null && val !== '') {
                                if (Array.isArray(val)) display = val.join(', ');
                                else if (typeof val === 'object') {
                                  if ('lat' in val) display = `Lat: ${val.lat}, Lng: ${val.lng}`;
                                  else display = JSON.stringify(val);
                                } else display = String(val);
                              }
                              return (
                                <td key={f.id} className="py-3 px-4 text-text-secondary text-xs max-w-[160px] truncate" title={display}>
                                  {display}
                                </td>
                              );
                            })}
                            <td className="py-3 px-4">
                              <Badge variant={getStatusBadgeVariant(sub.lead_status) as any}>
                                {sub.lead_status?.replace(/_/g, ' ') || 'new'}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-text-secondary text-xs max-w-[160px] truncate" title={sub.telecaller_remark || ''}>
                              {sub.telecaller_remark || '-'}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedSub({ ...sub, form_templates: template })}
                                  className="text-accent-blue border-accent-blue/30 hover:bg-accent-blue/10 text-xs py-1"
                                >
                                  <Eye className="w-3.5 h-3.5 mr-1" /> View
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSingleReassignSub(sub);
                                    setIsReassignModalOpen(true);
                                  }}
                                  className="text-white border-bg-border hover:bg-bg-primary text-xs py-1"
                                >
                                  <ArrowRightLeft className="w-3.5 h-3.5 mr-1 text-accent-green" /> Reassign
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {filteredSubmissions.length > 0 && (
                <div className="p-4 border-t border-bg-border flex items-center justify-between bg-bg-primary shrink-0">
                  <span className="text-xs text-text-secondary">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredSubmissions.length)} of {filteredSubmissions.length} assigned leads
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="border-bg-border text-text-secondary hover:text-white text-xs"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="border-bg-border text-text-secondary hover:text-white text-xs"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 text-text-muted">Form Template not found.</div>
      )}

      {/* Reassign Modal */}
      {isReassignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-bg-secondary p-0 overflow-hidden shadow-2xl border-bg-border">
            <div className="p-4 border-b border-bg-border flex justify-between items-center bg-bg-primary">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-accent-blue" />
                {singleReassignSub ? 'Reassign Lead' : `Reassign ${selectedIds.size} Leads`}
              </h3>
              <button 
                onClick={() => {
                  setIsReassignModalOpen(false);
                  setSingleReassignSub(null);
                }} 
                className="text-text-muted hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {singleReassignSub && (
                <div className="p-3 bg-bg-primary rounded-lg border border-bg-border text-xs space-y-1">
                  <div className="text-text-muted">Currently Assigned To:</div>
                  <div className="text-accent-blue font-bold">
                    {singleReassignSub.telecaller?.full_name || singleReassignSub.telecaller?.username || 'Unassigned'}
                  </div>
                  <div className="text-text-muted mt-2">Surveyor:</div>
                  <div className="text-white font-medium">
                    {singleReassignSub.surveyor?.full_name || singleReassignSub.surveyor?.username || 'Unknown'}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">
                  Select New Telecaller
                </label>
                <select
                  value={reassignTarget}
                  onChange={e => setReassignTarget(e.target.value)}
                  className="w-full bg-bg-primary border border-bg-border rounded-lg px-4 py-2.5 text-white text-sm focus:border-accent-blue focus:outline-none"
                >
                  <option value="">-- Choose Telecaller --</option>
                  {teamTelecallers.map(tc => (
                    <option key={tc.id} value={tc.id}>
                      {tc.full_name || tc.username}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-bg-border">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsReassignModalOpen(false);
                    setSingleReassignSub(null);
                  }}
                  className="border-bg-border text-text-secondary"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleReassign()}
                  disabled={!reassignTarget || isReassigning}
                  className="bg-accent-blue hover:bg-accent-blue/90 text-white"
                >
                  {isReassigning ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Reassigning...
                    </span>
                  ) : (
                    'Confirm Reassign'
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Submission Review Modal */}
      {selectedSub && (
        <ViewFormModal
          submission={selectedSub}
          onClose={() => setSelectedSub(null)}
        />
      )}
    </div>
  );
}
