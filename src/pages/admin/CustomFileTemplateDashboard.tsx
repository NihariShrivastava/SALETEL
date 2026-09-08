import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { 
  ArrowLeft, Download, Loader2, 
  FolderOpen, Eye, Filter, X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { FileFormTemplate, FileSubmission } from '../../types';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const COLORS = ['#4f6ef7', '#22c55e', '#eab308', '#ef4444', '#06b6d4', '#f97316', '#8b5cf6', '#ec4899'];

interface CustomFileTemplateDashboardProps {
  backPath?: string;
  isReadOnly?: boolean;
}

export default function CustomFileTemplateDashboard({ backPath = '/admin/reports' }: CustomFileTemplateDashboardProps) {
  const { templateId } = useParams();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [template, setTemplate] = useState<FileFormTemplate | null>(null);
  const [submissions, setSubmissions] = useState<FileSubmission[]>([]);
  
  // Filters
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [handlerFilter, setHandlerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Detailed Modal
  const [selectedFile, setSelectedFile] = useState<any | null>(null);

  useEffect(() => {
    if (templateId) {
      fetchData();
    }
  }, [templateId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch File Form Template and File Submissions in parallel
      const [
        { data: templateData, error: templateError },
        { data: subData, error: subError }
      ] = await Promise.all([
        supabase
          .from('file_form_templates')
          .select('*')
          .eq('id', templateId)
          .or('is_deleted.is.null,is_deleted.eq.false')
          .single(),
        supabase
          .from('file_submissions')
          .select(`
            *,
            file_handler:surveyors!file_handler_id(username, full_name)
          `)
          .eq('file_form_template_id', templateId)
          .order('submitted_at', { ascending: false })
      ]);
      
      if (templateError) throw templateError;
      setTemplate(templateData);

      if (subError && subError.code !== '42P01') throw subError;
      setSubmissions(subData || []);
      
    } catch (error: any) {
      console.error(error);
      toast.error('Failed to load file template dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const getFieldValue = (sub: any, fieldId: string) => {
    if (!sub || !sub.data) return undefined;
    if (sub.data.fields && sub.data.fields[fieldId] !== undefined) {
      return sub.data.fields[fieldId];
    }
    return sub.data[fieldId];
  };

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

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, dateRange, handlerFilter, statusFilter, itemsPerPage]);

  const uniqueHandlers = useMemo(() => {
    const map = new Map<string, { id: string, name: string }>();
    submissions.forEach(sub => {
      const handler = (sub as any).file_handler;
      if (handler && sub.file_handler_id) {
        map.set(sub.file_handler_id, { 
          id: sub.file_handler_id, 
          name: handler.full_name || handler.username 
        });
      }
    });
    return Array.from(map.values());
  }, [submissions]);

  const filteredSubmissions = useMemo(() => {
    return submissions.filter(sub => {
      // 1. Check File Handler
      if (handlerFilter && sub.file_handler_id !== handlerFilter) return false;

      // 2. Check Status
      if (statusFilter !== 'all' && sub.status !== statusFilter) return false;

      // 3. Check Date Range
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

      // 4. Check dynamic field filters
      for (const [fieldId, filterValue] of Object.entries(filters)) {
        if (!filterValue || (Array.isArray(filterValue) && filterValue.length === 0)) continue;

        const subValue = getFieldValue(sub, fieldId);
        
        if (Array.isArray(filterValue)) {
          if (Array.isArray(subValue)) {
            const hasIntersection = subValue.some(v => filterValue.includes(v));
            if (!hasIntersection) return false;
          } else {
            if (!filterValue.includes(String(subValue))) return false;
          }
        } else if (typeof filterValue === 'string') {
          if (!subValue || !String(subValue).toLowerCase().includes(filterValue.toLowerCase())) {
            return false;
          }
        }
      }
      return true;
    });
  }, [submissions, filters, handlerFilter, statusFilter, dateRange]);

  const handleExportExcel = () => {
    if (!template || filteredSubmissions.length === 0) {
      toast.error('No data to export');
      return;
    }

    const dataToExport = filteredSubmissions.map(sub => {
      const handlerName = (sub as any).file_handler?.full_name || (sub as any).file_handler?.username || 'Unknown';
      const row: any = {
        'File ID': sub.id.split('-')[0].toUpperCase(),
        'Date': new Date(sub.submitted_at).toLocaleString(),
        'File Handler': handlerName,
        'File Status': sub.status,
      };

      template.fields.forEach(field => {
        let val = getFieldValue(sub, field.id);
        if (Array.isArray(val)) val = val.join(', ');
        else if (typeof val === 'object' && val !== null) {
          val = JSON.stringify(val);
        }
        row[field.label] = val !== undefined && val !== null ? val : '';
      });

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'File Submissions');
    XLSX.writeFile(workbook, `${template.name}_File_Analytics_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Generate charts for categorical fields (select, radio, yes_no)
  const chartableFields = template?.fields.filter(f => ['select', 'radio', 'yes_no'].includes(f.type)) || [];

  // Summary Metrics
  const totalCount = filteredSubmissions.length;
  const openCount = filteredSubmissions.filter(s => s.status === 'submitted').length;
  const closedCount = filteredSubmissions.filter(s => s.status === 'closed').length;
  const clearedCount = filteredSubmissions.filter(s => s.status === 'cleared').length;

  // Status Distribution Chart Data
  const statusChartData = [
    { name: 'Submitted / Open', value: openCount, color: '#4f6ef7' },
    { name: 'Closed', value: closedCount, color: '#22c55e' },
    { name: 'Cleared', value: clearedCount, color: '#ec4899' },
  ].filter(d => d.value > 0);

  // Paginated records
  const totalPages = Math.ceil(filteredSubmissions.length / itemsPerPage);
  const currentSubmissions = filteredSubmissions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary">
        <Loader2 className="w-8 h-8 animate-spin text-accent-blue" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-bg-primary text-text-secondary gap-4">
        <p className="text-lg">File template not found or was removed.</p>
        <Button onClick={() => navigate(backPath)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-bg-border pb-5">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(backPath)}
            className="p-2 rounded-lg bg-bg-secondary border border-bg-border hover:bg-bg-hover text-text-secondary hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white tracking-tight">{template.name}</h1>
              <Badge variant="blue">File Form Analytics</Badge>
            </div>
            <p className="text-xs text-text-secondary mt-1">
              {template.description || 'Custom data breakdown and reporting for file form submissions.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleExportExcel} className="bg-accent-green hover:bg-accent-green/90 text-white border-transparent">
            <Download className="w-4 h-4 mr-2" /> Export Excel
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-bg-secondary/60 border border-bg-border">
          <div className="text-xs uppercase tracking-wider font-semibold text-text-secondary mb-1">Total Files</div>
          <div className="text-3xl font-bold text-white tracking-tight">{totalCount.toLocaleString()}</div>
          <div className="text-xs text-text-muted mt-1">Matching current filters</div>
        </Card>

        <Card className="p-4 bg-bg-secondary/60 border border-bg-border">
          <div className="text-xs uppercase tracking-wider font-semibold text-accent-blue mb-1">Open / In Progress</div>
          <div className="text-3xl font-bold text-accent-blue tracking-tight">{openCount.toLocaleString()}</div>
          <div className="text-xs text-text-muted mt-1">Status: submitted</div>
        </Card>

        <Card className="p-4 bg-bg-secondary/60 border border-bg-border">
          <div className="text-xs uppercase tracking-wider font-semibold text-accent-green mb-1">Closed Files</div>
          <div className="text-3xl font-bold text-accent-green tracking-tight">{closedCount.toLocaleString()}</div>
          <div className="text-xs text-text-muted mt-1">Completed / Closed</div>
        </Card>

        <Card className="p-4 bg-bg-secondary/60 border border-bg-border">
          <div className="text-xs uppercase tracking-wider font-semibold text-pink-400 mb-1">Cleared Files</div>
          <div className="text-3xl font-bold text-pink-400 tracking-tight">{clearedCount.toLocaleString()}</div>
          <div className="text-xs text-text-muted mt-1">Fully reconciled</div>
        </Card>
      </div>

      {/* Layout: Filters on Left, Visualizations on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Dynamic Filter Sidebar */}
        <Card className="p-5 flex flex-col gap-5 lg:col-span-1 border border-bg-border bg-bg-secondary/50">
          <div className="flex items-center justify-between border-b border-bg-border pb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Filter className="w-4 h-4 text-accent-blue" />
              Dynamic Filters
            </h3>
            <button 
              onClick={() => { setFilters({}); setDateRange({ from: '', to: '' }); setHandlerFilter(''); setStatusFilter('all'); }}
              className="text-xs text-text-muted hover:text-accent-blue"
            >
              Reset
            </button>
          </div>

          {/* Standard Filters */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1 block">File Handler</label>
              <select 
                value={handlerFilter} 
                onChange={e => setHandlerFilter(e.target.value)}
                className="w-full bg-bg-primary border border-bg-border rounded-lg px-3 py-2 text-white text-sm focus:border-accent-blue focus:outline-none"
              >
                <option value="">All Handlers</option>
                {uniqueHandlers.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1 block">File Status</label>
              <select 
                value={statusFilter} 
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full bg-bg-primary border border-bg-border rounded-lg px-3 py-2 text-white text-sm focus:border-accent-blue focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="submitted">Submitted / Open</option>
                <option value="closed">Closed</option>
                <option value="cleared">Cleared</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1 block">Date Range</label>
              <div className="grid grid-cols-2 gap-2">
                <input 
                  type="date"
                  value={dateRange.from}
                  onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                  className="bg-bg-primary border border-bg-border rounded-lg px-2 py-1.5 text-xs text-white [color-scheme:dark] focus:outline-none focus:border-accent-blue"
                />
                <input 
                  type="date"
                  value={dateRange.to}
                  onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                  className="bg-bg-primary border border-bg-border rounded-lg px-2 py-1.5 text-xs text-white [color-scheme:dark] focus:outline-none focus:border-accent-blue"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-bg-border pt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3">Field Answers</h4>
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
              {template.fields.map(field => {
                if (['select', 'radio', 'yes_no'].includes(field.type)) {
                  const options = field.type === 'yes_no' ? ['Yes', 'No'] : (field.options || []);
                  const currentSelected = Array.isArray(filters[field.id]) ? filters[field.id] : [];

                  return (
                    <div key={field.id} className="space-y-1.5">
                      <label className="text-xs font-medium text-white block">{field.label}</label>
                      <div className="flex flex-wrap gap-1.5">
                        {options.map((opt: string) => {
                          const isSelected = currentSelected.includes(opt);
                          return (
                            <button
                              key={opt}
                              onClick={() => toggleArrayFilter(field.id, opt)}
                              className={`px-2 py-1 rounded text-xs transition-colors border ${
                                isSelected 
                                  ? 'bg-accent-blue/20 border-accent-blue text-accent-blue font-semibold' 
                                  : 'bg-bg-primary border-bg-border text-text-secondary hover:text-white'
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                if (['text', 'textarea', 'number', 'phone'].includes(field.type)) {
                  return (
                    <div key={field.id} className="space-y-1">
                      <label className="text-xs font-medium text-white block">{field.label}</label>
                      <Input
                        placeholder={`Search ${field.label}...`}
                        value={filters[field.id] || ''}
                        onChange={e => handleFilterChange(field.id, e.target.value)}
                        className="text-xs py-1.5"
                      />
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>
        </Card>

        {/* Visual Charts & Overview */}
        <div className="lg:col-span-3 space-y-6">
          {/* Status Breakdown & Key Category Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status Distribution Chart */}
            <Card title="File Status Distribution" className="h-[320px] flex flex-col">
              <div className="w-full h-[240px] min-h-[240px] mt-2">
                {statusChartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-text-muted italic text-xs">No status data</div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={85}
                        innerRadius={50}
                        paddingAngle={4}
                      >
                        {statusChartData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#1a1d2e', borderColor: '#252840', color: '#fff', borderRadius: '8px' }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            {/* First categorical chart if available */}
            {chartableFields.length > 0 && (() => {
              const f = chartableFields[0];
              const counts: Record<string, number> = {};
              filteredSubmissions.forEach(sub => {
                const val = getFieldValue(sub, f.id);
                if (val !== undefined && val !== null && val !== '') {
                  const str = String(val);
                  counts[str] = (counts[str] || 0) + 1;
                }
              });

              const chartData = Object.entries(counts).map(([name, count]) => ({ name, count }));

              return (
                <Card title={f.label} className="h-[320px] flex flex-col">
                  <div className="w-full h-[240px] min-h-[240px] mt-2">
                    {chartData.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-text-muted italic text-xs">No records for this field</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#252840" vertical={false} />
                          <XAxis dataKey="name" stroke="#64748b" fontSize={11} angle={-25} textAnchor="end" />
                          <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                          <Tooltip contentStyle={{ backgroundColor: '#1a1d2e', borderColor: '#252840', color: '#fff', borderRadius: '8px' }} />
                          <Bar dataKey="count" fill="#4f6ef7" radius={[4, 4, 0, 0]}>
                            {chartData.map((_, i) => (
                              <Cell key={`c-${i}`} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </Card>
              );
            })()}
          </div>

          {/* Remaining categorical fields in horizontal cards */}
          {chartableFields.length > 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {chartableFields.slice(1).map(f => {
                const counts: Record<string, number> = {};
                filteredSubmissions.forEach(sub => {
                  const val = getFieldValue(sub, f.id);
                  if (val !== undefined && val !== null && val !== '') {
                    const str = String(val);
                    counts[str] = (counts[str] || 0) + 1;
                  }
                });
                const chartData = Object.entries(counts).map(([name, count]) => ({ name, count }));

                return (
                  <Card key={f.id} title={f.label} className="h-[260px] flex flex-col">
                    <div className="w-full h-[190px] min-h-[190px] mt-1">
                      {chartData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-text-muted italic text-xs">No records</div>
                      ) : (
                        <ResponsiveContainer width="100%" height={190}>
                          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#252840" vertical={false} />
                            <XAxis dataKey="name" stroke="#64748b" fontSize={10} angle={-20} textAnchor="end" />
                            <YAxis stroke="#64748b" fontSize={10} allowDecimals={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#1a1d2e', borderColor: '#252840', color: '#fff', borderRadius: '8px' }} />
                            <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]}>
                              {chartData.map((_, i) => (
                                <Cell key={`c-${i}`} fill={COLORS[(i + 2) % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Submissions Table */}
          <Card className="p-0 overflow-hidden flex flex-col border-bg-border">
            <div className="p-4 border-b border-bg-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-bg-secondary">
              <div>
                <h3 className="text-sm font-semibold text-white">File Records</h3>
                <p className="text-xs text-text-secondary mt-0.5">Showing {filteredSubmissions.length} files matching current filters</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">Rows per page:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="bg-bg-primary border border-bg-border rounded px-2.5 py-1 text-xs text-white focus:border-accent-blue focus:outline-none cursor-pointer"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
                <thead className="bg-bg-primary/60 border-b border-bg-border text-text-muted text-[10px] uppercase tracking-widest">
                  <tr>
                    <th className="py-3 px-4 font-semibold">File ID</th>
                    <th className="py-3 px-4 font-semibold">Date</th>
                    <th className="py-3 px-4 font-semibold">File Handler</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    {template.fields.slice(0, 3).map(f => (
                      <th key={f.id} className="py-3 px-4 font-semibold">{f.label}</th>
                    ))}
                    <th className="py-3 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {currentSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={5 + Math.min(3, template.fields.length)} className="py-8 text-center text-text-muted italic">
                        No files matching filters.
                      </td>
                    </tr>
                  ) : (
                    currentSubmissions.map((sub: any) => {
                      const handler = sub.file_handler?.full_name || sub.file_handler?.username || 'Unknown';
                      return (
                        <tr key={sub.id} className="border-b border-bg-border last:border-0 hover:bg-bg-hover/40 transition-colors">
                          <td className="py-3 px-4 font-medium text-white">{sub.id.split('-')[0].toUpperCase()}</td>
                          <td className="py-3 px-4 text-text-secondary text-xs">{new Date(sub.submitted_at).toLocaleDateString()}</td>
                          <td className="py-3 px-4 text-white text-xs font-medium">{handler}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                              sub.status === 'cleared' ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20' :
                              sub.status === 'closed' ? 'bg-accent-green/10 text-accent-green border border-accent-green/20' :
                              'bg-accent-blue/10 text-accent-blue border border-accent-blue/20'
                            }`}>
                              {sub.status}
                            </span>
                          </td>
                          {template.fields.slice(0, 3).map(f => {
                            const val = getFieldValue(sub, f.id);
                            const display = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '-');
                            return (
                              <td key={f.id} className="py-3 px-4 text-text-secondary text-xs max-w-[150px] truncate" title={display}>
                                {display}
                              </td>
                            );
                          })}
                          <td className="py-3 px-4 text-right">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => setSelectedFile(sub)}
                              className="text-accent-blue border-accent-blue/30 hover:bg-accent-blue/10"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" /> View File
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredSubmissions.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-bg-border bg-bg-primary shrink-0">
                <div className="text-xs text-text-muted">
                  Showing <span className="text-white font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-white font-medium">{Math.min(currentPage * itemsPerPage, filteredSubmissions.length)}</span> of <span className="text-white font-medium">{filteredSubmissions.length}</span> files
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="bg-bg-secondary text-white border border-bg-border hover:bg-bg-border disabled:opacity-40 disabled:cursor-not-allowed text-xs px-3 py-1.5 rounded transition-colors"
                  >
                    Previous
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                      .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                      .map((p, idx, arr) => {
                        const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                        return (
                          <React.Fragment key={p}>
                            {showEllipsis && <span className="text-xs text-text-muted px-1">...</span>}
                            <button
                              onClick={() => setCurrentPage(p)}
                              className={`text-xs w-7 h-7 rounded flex items-center justify-center font-medium transition-colors ${
                                currentPage === p
                                  ? 'bg-accent-blue text-white shadow-sm shadow-accent-blue/30'
                                  : 'bg-bg-secondary text-text-secondary hover:text-white border border-bg-border'
                              }`}
                            >
                              {p}
                            </button>
                          </React.Fragment>
                        );
                      })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="bg-bg-secondary text-white border border-bg-border hover:bg-bg-border disabled:opacity-40 disabled:cursor-not-allowed text-xs px-3 py-1.5 rounded transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* File Details Modal */}
      {selectedFile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-bg-secondary w-full max-w-2xl max-h-[85vh] rounded-xl border border-bg-border shadow-2xl flex flex-col overflow-hidden">
            <div className="p-5 border-b border-bg-border flex justify-between items-center bg-bg-primary shrink-0">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-accent-blue" />
                  File Submission Details
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  ID: {selectedFile.id} &bull; Handler: {selectedFile.file_handler?.full_name || selectedFile.file_handler?.username}
                </p>
              </div>
              <button onClick={() => setSelectedFile(null)} className="text-text-muted hover:text-white p-2 rounded-full hover:bg-bg-secondary transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="flex justify-between items-center bg-bg-primary p-3 rounded-lg border border-bg-border">
                <div className="text-xs text-text-secondary">
                  Submitted on <span className="text-white font-medium">{new Date(selectedFile.submitted_at).toLocaleString()}</span>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs uppercase font-bold tracking-wider ${
                  selectedFile.status === 'cleared' ? 'bg-pink-500/20 text-pink-400' :
                  selectedFile.status === 'closed' ? 'bg-accent-green/20 text-accent-green' :
                  'bg-accent-blue/20 text-accent-blue'
                }`}>
                  {selectedFile.status}
                </span>
              </div>

              {/* Fields */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase font-bold tracking-widest text-text-muted border-b border-bg-border pb-1">Form Data</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {template.fields.map(f => {
                    const val = getFieldValue(selectedFile, f.id);
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
                  })}
                </div>
              </div>

              {/* Custom fields if present */}
              {selectedFile.data?.custom_fields && selectedFile.data.custom_fields.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs uppercase font-bold tracking-widest text-text-muted border-b border-bg-border pb-1">Additional Fields</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedFile.data.custom_fields.map((cf: any, i: number) => (
                      <div key={cf.id || i} className="bg-bg-primary border border-bg-border rounded-lg p-3">
                        <span className="block text-[10px] uppercase text-text-secondary font-semibold mb-1">{cf.question}</span>
                        <span className="text-sm text-white font-medium break-words">{cf.answer || '-'}</span>
                      </div>
                    ))}
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
