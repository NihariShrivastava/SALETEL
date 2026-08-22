import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ArrowLeft, Download, Loader2, PieChart as PieChartIcon, BarChart as BarChartIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { FormTemplate, FieldConfig, Submission } from '../../types';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const COLORS = ['#4f6ef7', '#22c55e', '#eab308', '#ef4444', '#06b6d4', '#f97316', '#8b5cf6', '#ec4899'];

export default function CustomTemplateDashboard() {
  const { templateId } = useParams();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  
  // filters: field.id -> value (string for text, array for multi-select)
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [surveyorFilter, setSurveyorFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    if (templateId) {
      fetchData();
    }
  }, [templateId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch template
      const { data: templateData, error: templateError } = await supabase
        .from('form_templates')
        .select('*')
        .eq('id', templateId)
        .single();
      
      if (templateError) throw templateError;
      setTemplate(templateData);

      // Fetch submissions
      const { data: subData, error: subError } = await supabase
        .from('submissions')
        .select(`*, surveyors(username, full_name)`)
        .eq('form_template_id', templateId)
        .order('submitted_at', { ascending: false });

      if (subError) throw subError;
      setSubmissions(subData || []);
      
    } catch (error: any) {
      console.error(error);
      toast.error('Failed to load custom dashboard data');
    } finally {
      setIsLoading(false);
    }
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
  }, [filters, dateRange, surveyorFilter]);

  const uniqueSurveyors = useMemo(() => {
    const map = new Map<string, { id: string, name: string }>();
    submissions.forEach(sub => {
      const surveyor = (sub as any).surveyors;
      if (surveyor && sub.surveyor_id) {
        map.set(sub.surveyor_id, { id: sub.surveyor_id, name: surveyor.full_name || surveyor.username });
      }
    });
    return Array.from(map.values());
  }, [submissions]);

  const filteredSubmissions = useMemo(() => {
    return submissions.filter(sub => {
      // 1. Check Surveyor
      if (surveyorFilter && sub.surveyor_id !== surveyorFilter) return false;

      // 2. Check Date Range
      if (dateRange.from || dateRange.to) {
        const subDate = new Date(sub.submitted_at).getTime();
        if (dateRange.from) {
          const fromDate = new Date(dateRange.from).getTime();
          if (subDate < fromDate) return false;
        }
        if (dateRange.to) {
          // Add 24 hours (86400000 ms) to include the entire 'to' day
          const toDate = new Date(dateRange.to).getTime() + 86400000;
          if (subDate >= toDate) return false;
        }
      }

      // 3. Check each dynamic filter
      for (const [fieldId, filterValue] of Object.entries(filters)) {
        if (!filterValue || (Array.isArray(filterValue) && filterValue.length === 0)) continue;

        const subValue = sub.data[fieldId];
        
        if (Array.isArray(filterValue)) {
          // If filter is an array (multi-select), submission value must match one of them
          // If submission value is also an array (multiselect field), check intersection
          if (Array.isArray(subValue)) {
            const hasIntersection = subValue.some(v => filterValue.includes(v));
            if (!hasIntersection) return false;
          } else {
            if (!filterValue.includes(String(subValue))) return false;
          }
        } else if (typeof filterValue === 'string') {
          // Text search (case insensitive)
          if (!subValue || !String(subValue).toLowerCase().includes(filterValue.toLowerCase())) {
            return false;
          }
        }
      }
      return true;
    });
  }, [submissions, filters, surveyorFilter, dateRange]);

  const handleExportExcel = () => {
    if (!template || filteredSubmissions.length === 0) {
      toast.error('No data to export');
      return;
    }

    const dataToExport = filteredSubmissions.map(sub => {
      const row: any = {
        'Submission ID': sub.id.split('-')[0].toUpperCase(),
        'Date': new Date(sub.submitted_at).toLocaleString(),
        'Surveyor': (sub as any).surveyors?.full_name || (sub as any).surveyors?.username || 'Unknown',
        'Status': sub.status,
      };

      template.fields.forEach(field => {
        let val = sub.data[field.id];
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
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Filtered Data');
    XLSX.writeFile(workbook, `${template.name}_Analytics_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Generate charts for categorical fields (select, radio, yes_no)
  const chartableFields = template?.fields.filter(f => ['select', 'radio', 'yes_no'].includes(f.type)) || [];

  const paginatedSubmissions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredSubmissions.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSubmissions, currentPage]);

  const totalPages = Math.ceil(filteredSubmissions.length / itemsPerPage);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/reports')} className="text-text-muted hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {template?.name || 'Custom Dashboard'}
            </h2>
            <p className="text-text-secondary text-sm mt-1">
              Analyzing {filteredSubmissions.length} of {submissions.length} total entries
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleExportExcel} className="bg-accent-green hover:bg-accent-green/90 text-white border-transparent shadow-lg shadow-accent-green/20">
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-text-muted">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : template ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters Sidebar */}
          <Card className="lg:col-span-1 p-4 flex flex-col gap-6 h-fit max-h-[80vh] overflow-y-auto hide-scrollbar sticky top-4">
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-widest mb-4">Filters</h3>
              <div className="space-y-6">
                
                {/* Dynamic Filters */}
                {template.fields.map(field => {
                  const isTextLike = ['text', 'textarea', 'email', 'phone', 'number'].includes(field.type);
                  const isCategorical = ['select', 'radio', 'multiselect', 'checkbox'].includes(field.type);
                  const isYesNo = field.type === 'yes_no';

                  if (isTextLike) {
                    return (
                      <div key={field.id} className="space-y-2">
                        <label className="text-xs text-text-secondary font-medium">{field.label}</label>
                        <Input
                          placeholder={`Search ${field.label}...`}
                          value={filters[field.id] || ''}
                          onChange={(e) => handleFilterChange(field.id, e.target.value)}
                          className="bg-bg-primary"
                        />
                      </div>
                    );
                  }

                  if (isCategorical || isYesNo) {
                    const options = isYesNo ? ['Yes', 'No'] : (field.options || []);
                    const currentSelection = Array.isArray(filters[field.id]) ? filters[field.id] : [];
                    
                    return (
                      <div key={field.id} className="space-y-2">
                        <label className="text-xs text-text-secondary font-medium">{field.label}</label>
                        <div className="flex flex-col gap-2 bg-bg-primary p-2 rounded-lg border border-bg-border max-h-40 overflow-y-auto hide-scrollbar">
                          {options.map((opt, i) => (
                            <label key={i} className="flex items-center gap-2 cursor-pointer group" onClick={(e) => {
                              e.preventDefault();
                              toggleArrayFilter(field.id, opt);
                            }}>
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${currentSelection.includes(opt) ? 'bg-accent-blue border-accent-blue' : 'border-bg-border bg-bg-secondary group-hover:border-accent-blue/50'}`}>
                                {currentSelection.includes(opt) && <div className="w-2 h-2 bg-white rounded-sm" />}
                              </div>
                              <span className="text-sm text-text-secondary group-hover:text-white transition-colors select-none">{opt}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  
                  return null;
                })}
                
                <div className="pt-4 border-t border-bg-border">
                  <Button variant="ghost" size="sm" className="w-full text-text-muted hover:text-white" onClick={() => {
                    setFilters({});
                    setSurveyorFilter('');
                    setDateRange({ from: '', to: '' });
                  }}>
                    Clear All Filters
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Main Content Area */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            
            {/* Analytics Charts */}
            {chartableFields.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {chartableFields.slice(0, 4).map(field => {
                  // Calculate frequencies
                  const counts: Record<string, number> = {};
                  filteredSubmissions.forEach(sub => {
                    const val = sub.data[field.id];
                    if (val) {
                      const key = String(val);
                      counts[key] = (counts[key] || 0) + 1;
                    }
                  });
                  const chartData = Object.entries(counts)
                    .map(([name, value]) => ({ name, value }))
                    .sort((a, b) => b.value - a.value);

                  return (
                    <Card key={field.id} className="p-4 flex flex-col min-h-[320px]">
                      <h4 className="text-sm font-semibold text-white mb-4 truncate" title={field.label}>{field.label}</h4>
                      <div className="flex-1 min-h-[250px]">
                        {chartData.length > 0 ? (
                          field.type === 'yes_no' || chartData.length <= 4 ? (
                            <div className="flex h-full items-center">
                              <div className="w-1/2 h-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie
                                      data={chartData}
                                      cx="50%"
                                      cy="50%"
                                      innerRadius={45}
                                      outerRadius={65}
                                      paddingAngle={5}
                                      dataKey="value"
                                    >
                                      {chartData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                      ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: '#1a1d2e', borderColor: '#252840', color: '#fff', borderRadius: '8px' }} itemStyle={{ color: '#fff' }}/>
                                  </PieChart>
                                </ResponsiveContainer>
                              </div>
                              <div className="w-1/2 max-h-full overflow-y-auto pl-2 py-2 flex flex-col justify-center space-y-4 custom-scrollbar">
                                {chartData.map((entry, index) => (
                                  <div key={index} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-3 overflow-hidden mr-2">
                                      <div className="w-4 h-4 rounded-full shrink-0" style={{backgroundColor: COLORS[index % COLORS.length]}} />
                                      <span className="text-white truncate" title={entry.name}>{entry.name}</span>
                                    </div>
                                    <span className="text-text-secondary font-medium shrink-0 bg-bg-primary px-2.5 py-0.5 rounded-full border border-bg-border">
                                      {entry.value}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#252840" horizontal={false} />
                                <XAxis type="number" stroke="#64748b" fontSize={12} />
                                <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={12} width={80} tickFormatter={(val) => val.length > 10 ? val.substring(0,10)+'...' : val} />
                                <Tooltip contentStyle={{ backgroundColor: '#1a1d2e', borderColor: '#252840', color: '#fff', borderRadius: '8px' }} cursor={{ fill: '#1e2235' }}/>
                                <Bar dataKey="value" fill="#4f6ef7" radius={[0, 4, 4, 0]}>
                                  {chartData.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          )
                        ) : (
                          <div className="h-full flex items-center justify-center text-text-muted text-sm italic">
                            No data available
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Data Table */}
            <Card className="flex flex-col p-0 overflow-hidden flex-1">
              <div className="p-4 border-b border-bg-border flex flex-col md:flex-row md:items-center justify-between gap-4 bg-bg-secondary">
                <h3 className="text-sm font-semibold text-white whitespace-nowrap">Filtered Submissions Data</h3>
                
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-secondary">Surveyor:</span>
                    <select 
                      value={surveyorFilter}
                      onChange={(e) => setSurveyorFilter(e.target.value)}
                      className="bg-bg-primary border border-bg-border rounded-lg px-2 py-1.5 text-white focus:border-accent-blue focus:outline-none transition-colors text-xs"
                    >
                      <option value="">All</option>
                      {uniqueSurveyors.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-secondary">From:</span>
                    <Input 
                      type="date" 
                      value={dateRange.from}
                      onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                      className="bg-bg-primary text-xs py-1.5 w-auto"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-secondary">To:</span>
                    <Input 
                      type="date" 
                      value={dateRange.to}
                      onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                      className="bg-bg-primary text-xs py-1.5 w-auto"
                    />
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse whitespace-nowrap text-sm min-w-[800px]">
                  <thead className="bg-bg-secondary border-b border-bg-border sticky top-0 z-10">
                    <tr className="text-text-muted text-[10px] uppercase tracking-widest">
                      <th className="py-3 px-4 font-semibold">Date</th>
                      <th className="py-3 px-4 font-semibold">Surveyor</th>
                      {template.fields.map(f => (
                        <th key={f.id} className="py-3 px-4 font-semibold max-w-[150px] truncate" title={f.label}>{f.label}</th>
                      ))}
                      <th className="py-3 px-4 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedSubmissions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-text-muted italic">No matching submissions found.</td>
                      </tr>
                    ) : (
                      paginatedSubmissions.map(sub => (
                        <tr key={sub.id} className="border-b border-bg-border last:border-0 hover:bg-bg-hover/50">
                          <td className="py-3 px-4 text-text-secondary text-xs">{new Date(sub.submitted_at).toLocaleString()}</td>
                          <td className="py-3 px-4 text-white font-medium">{(sub as any).surveyors?.full_name || (sub as any).surveyors?.username}</td>
                          {template.fields.map(f => {
                            let val = sub.data[f.id];
                            let display = '-';
                            if (val !== undefined && val !== null) {
                              if (Array.isArray(val)) display = val.join(', ');
                              else if (typeof val === 'object') {
                                if ('lat' in val) display = `Location`;
                                else display = 'Object';
                              } else display = String(val);
                            }
                            return <td key={f.id} className="py-3 px-4 text-text-secondary max-w-[150px] truncate" title={display}>{display}</td>;
                          })}
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                              sub.status === 'approved' ? 'bg-accent-green/20 text-accent-green' :
                              sub.status === 'reverted' ? 'bg-accent-yellow/20 text-accent-yellow' :
                              'bg-accent-blue/20 text-accent-blue'
                            }`}>{sub.status}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              {filteredSubmissions.length > 0 && (
                <div className="p-4 border-t border-bg-border flex items-center justify-between bg-bg-primary shrink-0">
                  <span className="text-xs text-text-secondary">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredSubmissions.length)} of {filteredSubmissions.length} entries
                  </span>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                      disabled={currentPage === 1}
                      className="border-bg-border text-text-secondary hover:text-white"
                    >
                      Previous
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="border-bg-border text-text-secondary hover:text-white"
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
        <div className="text-center py-20 text-text-muted">Template not found.</div>
      )}
    </div>
  );
}
