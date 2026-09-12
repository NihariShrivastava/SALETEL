import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { FileText, CheckCircle, XCircle, Clock, Loader2, X, Users, PhoneCall, Activity, Flame, PhoneOff, ChevronLeft, ChevronRight, ArrowRightLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import type { FieldConfig } from '../../types';
import ViewFormModal from '../../components/common/ViewFormModal';

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

export default function TeamLeadDashboard() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [selectedSub, setSelectedSub] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [teamCounts, setTeamCounts] = useState({ surveyors: 0, telecallers: 0 });
  const [activeSlide, setActiveSlide] = useState(0);
  const [selectedSurveyor, setSelectedSurveyor] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const [slidePage, setSlidePage] = useState(1);
  const itemsPerPage = 20;

  const [teamTelecallers, setTeamTelecallers] = useState<any[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [reassignTo, setReassignTo] = useState<string>('');
  const [isReassigning, setIsReassigning] = useState(false);
  const [isLoadingFields, setIsLoadingFields] = useState(false);

  const handleViewForm = async (lead: any) => {
    if (!lead) return;
    setIsLoadingFields(true);
    try {
      let fullLead = lead;
      if (!lead.data) {
        const { data: leadData } = await supabase
          .from('submissions')
          .select('data')
          .eq('id', lead.id)
          .single();
        if (leadData) {
          fullLead = { ...lead, data: leadData.data };
        }
      }
      setSelectedSub(fullLead);

      const tmpl = Array.isArray(lead.form_templates) ? lead.form_templates[0] : lead.form_templates;
      const hasFields = tmpl?.fields && Array.isArray(tmpl.fields) && tmpl.fields.length > 0;

      if (!hasFields && lead.form_template_id) {
        const { data: tmplData } = await supabase
          .from('form_templates')
          .select('id, name, fields')
          .eq('id', lead.form_template_id)
          .single();

        let resolvedTmpl = tmplData;

        if (!resolvedTmpl || !resolvedTmpl.fields) {
          const { data: fileTmpl } = await supabase
            .from('file_form_templates')
            .select('id, name, fields')
            .eq('id', lead.form_template_id)
            .single();
          if (fileTmpl) resolvedTmpl = fileTmpl;
        }

        if (resolvedTmpl?.fields) {
          const updatedTmpl = {
            ...(tmpl || {}),
            name: resolvedTmpl.name || tmpl?.name || 'Form Submission',
            fields: resolvedTmpl.fields
          };

          setSelectedSub((prev: any) => prev && prev.id === lead.id ? {
            ...prev,
            data: fullLead.data,
            form_templates: updatedTmpl
          } : prev);
        }
      }
    } catch (err) {
      console.error('Failed to load form details:', err);
    } finally {
      setIsLoadingFields(false);
    }
  };

  useEffect(() => {
    setSlidePage(1);
  }, [activeSlide, selectedSurveyor, selectedStatus]);

  // Status filter for tabs

  const fetchSubmissions = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      // 1. Live sync profile to get latest assigned_users (lean query)
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
        setTeamTelecallers([]);
        setTeamCounts({ surveyors: 0, telecallers: 0 });
        setIsLoading(false);
        return;
      }

      // 2. Fetch subordinate profiles to separate Surveyors and Telecallers
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

      // 3. Query submissions with lean columns (omits heavy question fields and data JSON for 80%+ faster load)
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
        surveyor:surveyors!surveyor_id(full_name, username),
        telecaller:surveyors!telecaller_id(id, full_name, username),
        form_templates(name)
      `;

      const fetchPromises: Promise<any>[] = [];

      if (assignedSurveyorIds.length > 0) {
        fetchPromises.push(
          supabase
            .from('submissions')
            .select(selectQuery)
            .in('surveyor_id', assignedSurveyorIds)
            .order('submitted_at', { ascending: false })
        );
      }

      if (assignedTelecallerIds.length > 0) {
        let tcQuery = supabase
          .from('submissions')
          .select(selectQuery)
          .in('telecaller_id', assignedTelecallerIds);

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

      let finalData = Array.from(subsMap.values()).sort(
        (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const staleSkippedIds = finalData
        .filter(sub => {
          if (sub.lead_status === 'skipped' && sub.lead_status_updated_at) {
            const updatedDate = new Date(sub.lead_status_updated_at);
            return updatedDate < today;
          }
          return false;
        })
        .map(sub => sub.id);

      if (staleSkippedIds.length > 0) {
        supabase.from('submissions')
          .update({ 
            lead_status: 'new', 
            lead_status_updated_at: new Date().toISOString() 
          })
          .in('id', staleSkippedIds)
          .then(({ error }) => {
            if (error) console.error('Failed to reset skipped leads', error);
          });
          
        finalData.forEach(sub => {
          if (staleSkippedIds.includes(sub.id)) {
            sub.lead_status = 'new';
            sub.lead_status_updated_at = new Date().toISOString();
          }
        });
      }

      // Combine explicitly assigned telecallers with any telecallers extracted directly from submissions in memory
      const uniqueTcsMap = new Map<string, any>();
      assignedTelecallers.forEach(tc => uniqueTcsMap.set(tc.id, tc));
      finalData.forEach(sub => {
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
      setSubmissions(finalData);

      setTeamCounts({
        surveyors: assignedSurveyorIds.length,
        telecallers: uniqueTcs.length
      });
    } catch (err) {
      console.error('Failed to fetch submissions', err);
      toast.error('Failed to load submissions.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);


  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent-blue" />
      </div>
    );
  }



  const uniqueSurveyors = Array.from(new Set(submissions.map(s => s.surveyor_id)))
    .map(id => {
      const sub = submissions.find(s => s.surveyor_id === id);
      return { id, name: sub?.surveyor?.full_name || sub?.surveyor?.username || 'Unknown Surveyor' };
    });

  const filteredSubmissions = submissions.filter(sub => {
    const matchSurveyor = selectedSurveyor === 'all' || sub.surveyor_id === selectedSurveyor;
    const matchStatus = selectedStatus === 'all' || (sub.lead_status || 'new') === selectedStatus;
    return matchSurveyor && matchStatus;
  });

  // Group submissions by telecaller for report, pre-populating with assigned telecallers
  const initialTelecallerReport: Record<string, any> = {};
  teamTelecallers.forEach(tc => {
    initialTelecallerReport[tc.id] = {
      id: tc.id,
      name: tc.full_name || tc.username || 'Unknown Telecaller',
      total: 0,
      new: 0,
      cold: 0,
      warm: 0,
      hot: 0,
      immediate: 0,
      skipped: 0
    };
  });

  const telecallerReport = filteredSubmissions.reduce((acc, sub) => {
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
  }, initialTelecallerReport);

  const telecallerData = Object.values(telecallerReport);

  const assignedLeadsLogs = filteredSubmissions.filter(s => s.telecaller_id);
  const immediateLeads = filteredSubmissions.filter(s => s.lead_status === 'immediate');
  const revertedLeads = filteredSubmissions.filter(s => s.lead_status === 'reverted_to_tl');
  const wrongNumberLeads = filteredSubmissions.filter(s => s.lead_status === 'wrong_number');
  const closedLeads = filteredSubmissions.filter(s => s.lead_status === 'closed');
  const deletedLeads = filteredSubmissions.filter(s => s.lead_status === 'deleted');

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

  const handleCloseLead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('submissions')
        .update({ lead_status: 'closed' }) // "pending for close by admin" conceptually, but keeping it simple as 'closed' per our prior discussion.
        .eq('id', id);
      if (error) throw error;
      toast.success('Lead closed successfully');
      fetchSubmissions();
    } catch (err) {
      console.error(err);
      toast.error('Failed to close lead');
    }
  };

  const handleDeleteLead = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this reverted lead?')) return;
    try {
      const { error } = await supabase
        .from('submissions')
        .update({ lead_status: 'deleted' })
        .eq('id', id);
      if (error) throw error;
      toast.success('Lead deleted successfully');
      fetchSubmissions();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete lead');
    }
  };

  const handleReassignLeads = async () => {
    if (!reassignTo || selectedLeads.length === 0) return;
    setIsReassigning(true);
    try {
      const { error } = await supabase
        .from('submissions')
        .update({ telecaller_id: reassignTo })
        .in('id', selectedLeads);
        
      if (error) throw error;
      toast.success(`${selectedLeads.length} leads reassigned successfully`);
      setSelectedLeads([]);
      setReassignTo('');
      fetchSubmissions();
    } catch (err) {
      console.error('Failed to reassign leads', err);
      toast.error('Failed to reassign leads');
    } finally {
      setIsReassigning(false);
    }
  };

  return (
    <div className="space-y-6">
      {immediateLeads.length > 0 && (
        <div className="bg-accent-red/10 border border-accent-red/50 rounded-xl p-4 flex items-start gap-4 animate-pulse-slow shadow-[0_0_15px_rgba(239,68,68,0.2)]">
          <div className="bg-accent-red/20 p-2 rounded-full shrink-0">
            <Flame className="w-6 h-6 text-accent-red" />
          </div>
          <div>
            <h3 className="text-accent-red font-bold text-lg mb-1">Immediate Leads Alert!</h3>
            <p className="text-white text-sm">
              You have <span className="font-bold">{immediateLeads.length}</span> leads marked as IMMEDIATE.
              Please review these immediately in the Lead Analysis view.
            </p>
          </div>
        </div>
      )}
      <div className="bg-bg-secondary border border-bg-border rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-blue/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Team Lead Portal</h2>
            <p className="text-text-secondary">Review forms and manage leads for your team.</p>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="bg-bg-primary border border-bg-border rounded-lg p-4 flex flex-col items-center min-w-[100px]">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-accent-blue" />
                <div className="text-xl font-bold text-white">{teamCounts.surveyors}</div>
              </div>
              <div className="text-[10px] uppercase text-text-muted font-bold tracking-widest text-center">Surveyors</div>
            </div>
            <div className="bg-bg-primary border border-bg-border rounded-lg p-4 flex flex-col items-center min-w-[100px]">
              <div className="flex items-center gap-2 mb-1">
                <PhoneCall className="w-4 h-4 text-accent-green" />
                <div className="text-xl font-bold text-white">{teamCounts.telecallers}</div>
              </div>
              <div className="text-[10px] uppercase text-text-muted font-bold tracking-widest text-center">Telecallers</div>
            </div>
            <div className="bg-bg-primary border border-bg-border rounded-lg p-4 flex flex-col items-center min-w-[100px]">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-accent-yellow" />
                <div className="text-xl font-bold text-white">{submissions.length}</div>
              </div>
              <div className="text-[10px] uppercase text-text-muted font-bold tracking-widest text-center">Forms Filled</div>
            </div>
          </div>
        </div>
      </div>

      {/* Forms & Assigned Leads Analysis (Side by Side) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Card: Forms Available for Lead Analysis (Unassigned Leads) */}
        <Card className="p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-accent-blue" />
                  Forms Available for Lead Analysis
                </h3>
                <p className="text-xs text-text-muted mt-0.5">Analyze and assign unassigned leads</p>
              </div>
              <Badge variant="blue">
                {submissions.filter(s => !s.telecaller_id).length} Unassigned
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from(new Set(submissions.filter(s => s.form_template_id).map(s => s.form_template_id))).map(templateId => {
                const templateSubs = submissions.filter(s => s.form_template_id === templateId);
                const unassignedSubs = templateSubs.filter(s => !s.telecaller_id);
                const tmpl = Array.isArray(templateSubs[0]?.form_templates) ? templateSubs[0]?.form_templates[0] : templateSubs[0]?.form_templates;
                const templateName = tmpl?.name || 'Unknown Form';
                return (
                  <div key={templateId as string} className="bg-bg-primary border border-bg-border rounded-xl p-5 hover:border-accent-blue/50 transition-colors flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-white text-base mb-1">{templateName}</h4>
                      <p className="text-xs text-text-secondary mb-4">
                        <span className="text-accent-blue font-semibold">{unassignedSubs.length}</span> unassigned entries
                      </p>
                    </div>
                    <Link to={`/teamlead/analyze/${templateId}`}>
                      <Button variant="outline" className="w-full text-accent-blue border-accent-blue/30 hover:bg-accent-blue/10 text-xs py-2">
                        <Activity className="w-4 h-4 mr-1.5" /> Analyze Leads & Assign
                      </Button>
                    </Link>
                  </div>
                );
              })}
              {submissions.length === 0 && (
                <div className="col-span-full py-8 text-center text-text-muted italic border-2 border-dashed border-bg-border rounded-xl text-xs">
                  No forms have been filled by your surveyors yet.
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Right Card: Assigned Leads Custom Analysis */}
        <Card className="p-6 flex flex-col justify-between border-accent-blue/20 shadow-[0_0_15px_rgba(79,110,247,0.05)]">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-accent-green" />
                  Assigned Leads Custom Analysis
                </h3>
                <p className="text-xs text-text-muted mt-0.5">Filter by questions, view telecallers & reassign</p>
              </div>
              <Badge variant="green">
                {submissions.filter(s => s.telecaller_id).length} Assigned
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from(new Set(submissions.filter(s => s.form_template_id).map(s => s.form_template_id))).map(templateId => {
                const templateSubs = submissions.filter(s => s.form_template_id === templateId);
                const assignedSubs = templateSubs.filter(s => s.telecaller_id);
                const tmpl = Array.isArray(templateSubs[0]?.form_templates) ? templateSubs[0]?.form_templates[0] : templateSubs[0]?.form_templates;
                const templateName = tmpl?.name || 'Unknown Form';
                return (
                  <div key={templateId as string} className="bg-bg-primary border border-bg-border rounded-xl p-5 hover:border-accent-green/50 transition-colors flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-white text-base mb-1">{templateName}</h4>
                      <p className="text-xs text-text-secondary mb-4">
                        <span className="text-accent-green font-semibold">{assignedSubs.length}</span> leads assigned
                      </p>
                    </div>
                    <Link to={`/teamlead/assigned-analysis/${templateId}`}>
                      <Button className="w-full bg-accent-blue/15 hover:bg-accent-blue/25 text-accent-blue border border-accent-blue/30 text-xs py-2">
                        <ArrowRightLeft className="w-4 h-4 mr-1.5" /> Custom Assigned Leads
                      </Button>
                    </Link>
                  </div>
                );
              })}
              {submissions.length === 0 && (
                <div className="col-span-full py-8 text-center text-text-muted italic border-2 border-dashed border-bg-border rounded-xl text-xs">
                  No forms filled yet.
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Global Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Filter by Surveyor</label>
          <select 
            value={selectedSurveyor}
            onChange={(e) => setSelectedSurveyor(e.target.value)}
            className="w-full bg-bg-secondary border border-bg-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent-blue"
          >
            <option value="all">All Surveyors</option>
            {uniqueSurveyors.map(s => (
              <option key={s.id as string} value={s.id as string}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Filter by Status</label>
          <select 
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full bg-bg-secondary border border-bg-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent-blue"
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
      </div>

      {/* Slider Section */}
      <Card className="p-0 overflow-hidden border-accent-blue/30 shadow-[0_0_15px_rgba(79,110,247,0.1)]">
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-bg-border bg-bg-secondary">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-bold text-white">{slides[activeSlide].title}</h3>
            {activeSlide === 0 && <Badge variant="blue">{telecallerData.length} Active Telecallers</Badge>}
            {activeSlide === 1 && <Badge variant="blue">{assignedLeadsLogs.length} Leads</Badge>}
            {activeSlide === 2 && <Badge variant="red">{immediateLeads.length} Leads</Badge>}
            {activeSlide === 3 && <Badge variant="purple">{revertedLeads.length} Leads</Badge>}
            {activeSlide === 4 && <Badge variant="gray">{wrongNumberLeads.length} Leads</Badge>}
            {activeSlide === 5 && <Badge variant="green">{closedLeads.length} Leads</Badge>}
            {activeSlide === 6 && <Badge variant="red">{deletedLeads.length} Leads</Badge>}
          </div>
          <div className="flex items-center gap-2">
            {activeSlide === 1 && selectedLeads.length > 0 && (
              <div className="flex items-center gap-2 mr-4">
                <span className="text-xs text-accent-blue font-medium">{selectedLeads.length} selected</span>
                <select 
                  value={reassignTo}
                  onChange={(e) => setReassignTo(e.target.value)}
                  className="bg-bg-primary border border-bg-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-accent-blue min-w-[150px]"
                >
                  <option value="">Select Telecaller</option>
                  {teamTelecallers.map(tc => (
                    <option key={tc.id} value={tc.id}>{tc.full_name || tc.username}</option>
                  ))}
                </select>
                <Button 
                  size="sm" 
                  onClick={handleReassignLeads} 
                  disabled={!reassignTo || isReassigning}
                  className="bg-accent-blue text-white hover:bg-blue-600 border-none py-1 h-auto"
                >
                  {isReassigning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reassign'}
                </Button>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={prevSlide} className="border-bg-border text-text-secondary hover:text-white p-2">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex gap-2 mx-2 hidden md:flex">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveSlide(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${i === activeSlide ? 'bg-accent-blue' : 'bg-bg-border hover:bg-text-muted'}`}
                  title={slides[i].title}
                />
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={nextSlide} className="border-bg-border text-text-secondary hover:text-white p-2">
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
        <div className="p-4 md:p-6 min-h-[400px]">
          {activeSlide === 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-bg-primary border-b border-bg-border text-text-muted text-[10px] uppercase tracking-widest">
                    <th className="py-3 px-4 font-semibold rounded-tl-lg">Telecaller</th>
                    <th className="py-3 px-4 font-semibold text-center">Total Assigned</th>
                    <th className="py-3 px-4 font-semibold text-center text-accent-green">New</th>
                    <th className="py-3 px-4 font-semibold text-center text-blue-500">Cold</th>
                    <th className="py-3 px-4 font-semibold text-center text-orange-500">Warm</th>
                    <th className="py-3 px-4 font-semibold text-center text-red-500">Hot</th>
                    <th className="py-3 px-4 font-semibold text-center text-accent-red">Immediate</th>
                    <th className="py-3 px-4 font-semibold text-center text-purple-500 rounded-tr-lg">Skipped/No Connect</th>
                  </tr>
                </thead>
                <tbody>
                  {getPaginated(telecallerData).map((tc: any, i) => (
                    <tr
                      key={i}
                      className="border-b border-bg-border last:border-0 hover:bg-bg-primary/80 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/teamlead/telecaller/${tc.id}`)}
                    >
                      <td className="py-3 px-4 font-medium text-white group-hover:text-accent-blue transition-colors">
                        {tc.name}
                      </td>
                      <td className="py-3 px-4 text-center font-bold">{tc.total}</td>
                      <td className="py-3 px-4 text-center text-text-secondary">{tc.new}</td>
                      <td className="py-3 px-4 text-center text-text-secondary">{tc.cold}</td>
                      <td className="py-3 px-4 text-center text-text-secondary">{tc.warm}</td>
                      <td className="py-3 px-4 text-center text-text-secondary">{tc.hot}</td>
                      <td className="py-3 px-4 text-center font-bold text-accent-red">{tc.immediate}</td>
                      <td className="py-3 px-4 text-center text-text-secondary">{tc.skipped}</td>
                    </tr>
                  ))}
                  {telecallerData.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-text-muted italic">
                        No leads have been assigned to your telecallers yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeSlide === 1 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-bg-primary border-b border-bg-border text-text-muted text-[10px] uppercase tracking-widest">
                    <th className="py-3 px-4 font-semibold w-10">
                      <input 
                        type="checkbox" 
                        checked={paginatedAssignedLeadsLogs.length > 0 && selectedLeads.length === paginatedAssignedLeadsLogs.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedLeads(paginatedAssignedLeadsLogs.map(l => l.id));
                          } else {
                            setSelectedLeads([]);
                          }
                        }}
                        className="rounded border-bg-border bg-bg-secondary focus:ring-accent-blue focus:ring-offset-bg-primary cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-4 font-semibold">Form / Lead</th>
                    <th className="py-3 px-4 font-semibold">Assigned To (TC)</th>
                    <th className="py-3 px-4 font-semibold">Submitted By</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAssignedLeadsLogs.map(lead => (
                    <tr key={lead.id} className="border-b border-bg-border last:border-0 hover:bg-bg-primary/80 transition-colors">
                      <td className="py-3 px-4">
                        <input 
                          type="checkbox" 
                          checked={selectedLeads.includes(lead.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedLeads([...selectedLeads, lead.id]);
                            } else {
                              setSelectedLeads(selectedLeads.filter(id => id !== lead.id));
                            }
                          }}
                          className="rounded border-bg-border bg-bg-secondary focus:ring-accent-blue focus:ring-offset-bg-primary cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-4 text-white font-medium">{(Array.isArray(lead.form_templates) ? lead.form_templates[0]?.name : lead.form_templates?.name) || 'Form Submission'}</td>
                      <td className="py-3 px-4 text-accent-blue">{lead.telecaller?.full_name || 'Unknown'}</td>
                      <td className="py-3 px-4 text-text-secondary">{lead.surveyor?.full_name || lead.surveyor?.username}</td>
                      <td className="py-3 px-4">
                        <Badge variant={getStatusBadgeVariant(lead.lead_status) as any}>{lead.lead_status?.replace(/_/g, ' ') || 'new'}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleViewForm(lead)} className="text-accent-blue border-accent-blue/30 hover:bg-accent-blue/10">
                          View Form
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {assignedLeadsLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-text-muted italic">No leads assigned yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeSlide === 2 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-bg-primary border-b border-bg-border text-text-muted text-[10px] uppercase tracking-widest">
                    <th className="py-3 px-4 font-semibold">Form / Lead</th>
                    <th className="py-3 px-4 font-semibold">Telecaller</th>
                    <th className="py-3 px-4 font-semibold">Submitted By</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedImmediateLeads.map(lead => (
                    <tr key={lead.id} className="border-b border-bg-border last:border-0 hover:bg-bg-primary/80 transition-colors">
                      <td className="py-3 px-4 text-white font-medium">{(Array.isArray(lead.form_templates) ? lead.form_templates[0]?.name : lead.form_templates?.name) || 'Form Submission'}</td>
                      <td className="py-3 px-4 text-accent-blue">{lead.telecaller?.full_name || 'Unassigned'}</td>
                      <td className="py-3 px-4 text-text-secondary">{lead.surveyor?.full_name || lead.surveyor?.username}</td>
                      <td className="py-3 px-4">
                        <Badge variant={getStatusBadgeVariant(lead.lead_status) as any}>{lead.lead_status?.replace(/_/g, ' ') || 'new'}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleViewForm(lead)} className="text-accent-blue border-accent-blue/30 hover:bg-accent-blue/10">
                          View Form
                        </Button>
                        <Button size="sm" onClick={() => handleCloseLead(lead.id)} className="bg-accent-blue text-white hover:bg-blue-600 border-none">
                          Close
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {immediateLeads.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-text-muted italic">No immediate leads.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeSlide === 3 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-bg-primary border-b border-bg-border text-text-muted text-[10px] uppercase tracking-widest">
                    <th className="py-3 px-4 font-semibold">Form / Lead</th>
                    <th className="py-3 px-4 font-semibold">Telecaller</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">TC Remark</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRevertedLeads.map(lead => (
                    <tr key={lead.id} className="border-b border-bg-border last:border-0 hover:bg-bg-primary/80 transition-colors">
                      <td className="py-3 px-4 text-white font-medium">{(Array.isArray(lead.form_templates) ? lead.form_templates[0]?.name : lead.form_templates?.name) || 'Form Submission'}</td>
                      <td className="py-3 px-4 text-accent-blue">{lead.telecaller?.full_name || 'Unassigned'}</td>
                      <td className="py-3 px-4">
                        <Badge variant={getStatusBadgeVariant(lead.lead_status) as any}>{lead.lead_status?.replace(/_/g, ' ') || 'new'}</Badge>
                      </td>
                      <td className="py-3 px-4 text-text-secondary max-w-xs truncate" title={lead.telecaller_remark}>{lead.telecaller_remark || 'No remark'}</td>
                      <td className="py-3 px-4 text-right flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleViewForm(lead)} className="text-accent-blue border-accent-blue/30 hover:bg-accent-blue/10">
                          View Form
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDeleteLead(lead.id)} className="text-red-500 border-red-500/30 hover:bg-red-500/10">
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {revertedLeads.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-text-muted italic">No reverted leads.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeSlide === 4 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-bg-primary border-b border-bg-border text-text-muted text-[10px] uppercase tracking-widest">
                    <th className="py-3 px-4 font-semibold">Form / Lead</th>
                    <th className="py-3 px-4 font-semibold">Telecaller</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Remark</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedWrongNumberLeads.map(lead => (
                    <tr key={lead.id} className="border-b border-bg-border last:border-0 hover:bg-bg-primary/80 transition-colors">
                      <td className="py-3 px-4 text-white font-medium">{(Array.isArray(lead.form_templates) ? lead.form_templates[0]?.name : lead.form_templates?.name) || 'Form Submission'}</td>
                      <td className="py-3 px-4 text-accent-blue">{lead.telecaller?.full_name || 'Unassigned'}</td>
                      <td className="py-3 px-4">
                        <Badge variant={getStatusBadgeVariant(lead.lead_status) as any}>{lead.lead_status?.replace(/_/g, ' ') || 'new'}</Badge>
                      </td>
                      <td className="py-3 px-4 text-text-secondary max-w-xs truncate" title={lead.telecaller_remark}>{lead.telecaller_remark || '-'}</td>
                      <td className="py-3 px-4 text-right flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleViewForm(lead)} className="text-accent-blue border-accent-blue/30 hover:bg-accent-blue/10">
                          View Form
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDeleteLead(lead.id)} className="text-red-500 border-red-500/30 hover:bg-red-500/10">
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {wrongNumberLeads.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-text-muted italic">No wrong numbers.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeSlide === 5 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-bg-primary border-b border-bg-border text-text-muted text-[10px] uppercase tracking-widest">
                    <th className="py-3 px-4 font-semibold">Form / Lead</th>
                    <th className="py-3 px-4 font-semibold">Telecaller</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Remark</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedClosedLeads.map(lead => (
                    <tr key={lead.id} className="border-b border-bg-border last:border-0 hover:bg-bg-primary/80 transition-colors">
                      <td className="py-3 px-4 text-white font-medium">{(Array.isArray(lead.form_templates) ? lead.form_templates[0]?.name : lead.form_templates?.name) || 'Form Submission'}</td>
                      <td className="py-3 px-4 text-accent-blue">{lead.telecaller?.full_name || 'Unassigned'}</td>
                      <td className="py-3 px-4">
                        <Badge variant={getStatusBadgeVariant(lead.lead_status) as any}>{lead.lead_status?.replace(/_/g, ' ') || 'new'}</Badge>
                      </td>
                      <td className="py-3 px-4 text-text-secondary max-w-xs truncate" title={lead.telecaller_remark}>{lead.telecaller_remark || '-'}</td>
                      <td className="py-3 px-4 text-right flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleViewForm(lead)} className="text-accent-blue border-accent-blue/30 hover:bg-accent-blue/10">
                          View Form
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDeleteLead(lead.id)} className="text-red-500 border-red-500/30 hover:bg-red-500/10">
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {closedLeads.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-text-muted italic">No closed leads.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeSlide === 6 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-bg-primary border-b border-bg-border text-text-muted text-[10px] uppercase tracking-widest">
                    <th className="py-3 px-4 font-semibold">Form / Lead</th>
                    <th className="py-3 px-4 font-semibold">Telecaller</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Remark</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDeletedLeads.map(lead => (
                    <tr key={lead.id} className="border-b border-bg-border last:border-0 hover:bg-bg-primary/80 transition-colors">
                      <td className="py-3 px-4 text-white font-medium">{(Array.isArray(lead.form_templates) ? lead.form_templates[0]?.name : lead.form_templates?.name) || 'Form Submission'}</td>
                      <td className="py-3 px-4 text-accent-blue">{lead.telecaller?.full_name || 'Unassigned'}</td>
                      <td className="py-3 px-4">
                        <Badge variant={getStatusBadgeVariant(lead.lead_status) as any}>{lead.lead_status?.replace(/_/g, ' ') || 'new'}</Badge>
                      </td>
                      <td className="py-3 px-4 text-text-secondary max-w-xs truncate" title={lead.telecaller_remark}>{lead.telecaller_remark || '-'}</td>
                      <td className="py-3 px-4 text-right flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleViewForm(lead)} className="text-accent-blue border-accent-blue/30 hover:bg-accent-blue/10">
                          View Form
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {deletedLeads.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-text-muted italic">No deleted leads.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {(() => {
          const getCurrentArrayLength = () => {
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
          const totalItems = getCurrentArrayLength();
          const totalPages = Math.ceil(totalItems / itemsPerPage);
          if (totalPages <= 1) return null;
          
          return (
            <div className="flex items-center justify-between px-4 py-3 border-t border-bg-border bg-bg-primary shrink-0">
              <div className="text-sm text-text-muted">
                Showing <span className="text-white font-medium">{(slidePage - 1) * itemsPerPage + 1}</span> to <span className="text-white font-medium">{Math.min(slidePage * itemsPerPage, totalItems)}</span> of <span className="text-white font-medium">{totalItems}</span> results
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setSlidePage(p => Math.max(1, p - 1))}
                  disabled={slidePage === 1}
                  className="bg-bg-secondary text-white border border-bg-border hover:bg-bg-border disabled:opacity-50 text-xs px-3 py-1 rounded-md transition-colors"
                >
                  Previous
                </button>
                <button 
                  onClick={() => setSlidePage(p => Math.min(totalPages, p + 1))}
                  disabled={slidePage === totalPages}
                  className="bg-bg-secondary text-white border border-bg-border hover:bg-bg-border disabled:opacity-50 text-xs px-3 py-1 rounded-md transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          );
        })()}
      </Card>


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
