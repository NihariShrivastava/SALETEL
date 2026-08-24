import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { UserCog, Trash2, Search, Edit2, ChevronDown, Users, PhoneCall, ClipboardCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import type { Surveyor, Domain, UserRole, Counter, FormTemplate } from '../../types';

interface SurveyorExtended extends Surveyor {
  user_role?: { name: string };
}

export default function SurveyorManagement() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const [surveyors, setSurveyors] = useState<SurveyorExtended[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  
  // Relations
  const [selectedUserRoleId, setSelectedUserRoleId] = useState('');
  const [assignedDomains, setAssignedDomains] = useState<string[]>([]);
  const [assignedTemplates, setAssignedTemplates] = useState<string[]>([]);
  const [assignedCounters, setAssignedCounters] = useState<string[]>([]);
  const [assignedTeamLeads, setAssignedTeamLeads] = useState<string[]>([]);
  const [assignedTelecallers, setAssignedTelecallers] = useState<string[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<string[]>([]); // For Team Leads and Telecallers to pick their subordinates

  // Dropdown toggles
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [
        { data: dData },
        { data: urData },
        { data: cData },
        { data: tData },
        { data: sData, error }
      ] = await Promise.all([
        supabase.from('domains').select('*'),
        supabase.from('user_roles').select('*'),
        supabase.from('counters').select('*'),
        supabase.from('form_templates').select('id, name, domain_id'),
        supabase.from('surveyors').select('*, user_role:user_roles(name)').order('created_at', { ascending: false })
      ]);

      if (error) throw error;

      setDomains(dData || []);
      setUserRoles(urData || []);
      setCounters(cData || []);
      setTemplates((tData as any) || []);
      setSurveyors(sData || []);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load data');
    }
  };

  const handleSaveSurveyor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !fullName || !selectedUserRoleId || !user?.id) {
      toast.error('Please fill all required fields');
      return;
    }
    setIsLoading(true);
    try {
      const payload = {
        username,
        password_hash: password,
        full_name: fullName,
        phone,
        email,
        location,
        user_role_id: selectedUserRoleId,
        assigned_domains: assignedDomains,
        assigned_template_ids: assignedTemplates,
        counter_ids: assignedCounters,
        team_lead_ids: assignedTeamLeads,
        telecaller_ids: assignedTelecallers,
        assigned_users: assignedUsers
      };

      if (editingId) {
        const { error } = await supabase.from('surveyors').update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success('User updated successfully');
      } else {
        const { error } = await supabase.from('surveyors').insert({ ...payload, created_by: user.id });
        if (error) throw error;
        toast.success('User created successfully');
      }
      
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to save user. Username might be taken.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setUsername('');
    setPassword('');
    setFullName('');
    setPhone('');
    setEmail('');
    setLocation('');
    setSelectedUserRoleId('');
    setAssignedDomains([]);
    setAssignedTemplates([]);
    setAssignedCounters([]);
    setAssignedTeamLeads([]);
    setAssignedTelecallers([]);
    setAssignedUsers([]);
    setOpenDropdown(null);
  };

  const handleEditClick = (surv: SurveyorExtended) => {
    setEditingId(surv.id);
    setUsername(surv.username);
    setPassword(surv.password_hash);
    setFullName(surv.full_name);
    setPhone(surv.phone || '');
    setEmail(surv.email || '');
    setLocation(surv.location || '');
    setSelectedUserRoleId(surv.user_role_id || '');
    setAssignedDomains(surv.assigned_domains || (surv.domain_id ? [surv.domain_id] : []));
    setAssignedTemplates(surv.assigned_template_ids || []);
    setAssignedCounters(surv.counter_ids || []);
    setAssignedTeamLeads(surv.team_lead_ids || []);
    setAssignedTelecallers(surv.telecaller_ids || []);
    setAssignedUsers(surv.assigned_users || []);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    const id = deletingId;
    setDeletingId(null);
    
    // Save previous state for rollback
    const previousSurveyors = [...surveyors];
    setSurveyors(prev => prev.filter(s => s.id !== id));
    if (editingId === id) resetForm();

    try {
      // Clear foreign key references to prevent constraint errors when deleting a telecaller or team lead
      await supabase.from('submissions').update({ telecaller_id: null }).eq('telecaller_id', id);
      await supabase.from('submissions').update({ reviewed_by: null }).eq('reviewed_by', id);

      // Delete any submissions created by this user
      await supabase.from('submissions').delete().eq('surveyor_id', id);
      
      const { error } = await supabase.from('surveyors').delete().eq('id', id);
      if (error) throw error;
      toast.success('User deleted successfully');
    } catch (error: any) {
      console.error(error);
      setSurveyors(previousSurveyors); // Rollback
      toast.error(error.message || 'Failed to delete user due to a database constraint.');
    }
  };

  const toggleDropdown = (name: string) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  const teamLeadsList = surveyors.filter(s => {
    const roleName = s.user_role?.name?.toLowerCase() || '';
    return roleName.includes('team lead') && s.id !== editingId;
  });
  
  const telecallersList = surveyors.filter(s => {
    const roleName = s.user_role?.name?.toLowerCase() || '';
    return roleName.includes('telecaller') && s.id !== editingId;
  });
  
  const subordinateOptions = surveyors.filter(s => {
    const roleName = s.user_role?.name?.toLowerCase() || '';
    // If a user doesn't have a role, we can optionally allow them to be assigned as a fallback, 
    // but here we specifically look for 'surveyor' or 'telecaller'.
    return (roleName.includes('surveyor') || roleName.includes('telecaller') || !roleName) && s.id !== editingId;
  });
  
  const availableTemplates = templates.filter(t => assignedDomains.includes(t.domain_id));

  // Remove unassigned templates if domain is removed
  useEffect(() => {
    setAssignedTemplates(prev => prev.filter(tId => availableTemplates.some(at => at.id === tId)));
  }, [assignedDomains, templates]);

  const filteredSurveyors = surveyors.filter(s => {
    const matchesSearch = s.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.full_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || s.user_role_id === roleFilter;
    return matchesSearch && matchesRole;
  });

  const totalPages = Math.ceil(filteredSurveyors.length / itemsPerPage);
  const currentItems = filteredSurveyors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Role Management</h2>
        <p className="text-text-secondary text-sm mt-1">Manage field agents, telecallers, and team leads.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card title={editingId ? "Edit User" : "Create User"} className="xl:col-span-1 h-fit overflow-visible">
          <form onSubmit={handleSaveSurveyor} className="space-y-4 mt-2">
            
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">User Role</label>
              <select 
                value={selectedUserRoleId} 
                onChange={e => setSelectedUserRoleId(e.target.value)}
                className="w-full bg-bg-primary border border-bg-border rounded-lg px-3 py-2 text-white text-sm focus:border-accent-blue focus:outline-none"
                required
              >
                <option value="">Select Role...</option>
                {userRoles.map(ur => (
                  <option key={ur.id} value={ur.id}>{ur.name}</option>
                ))}
              </select>
            </div>

            {(() => {
              const selectedRoleName = userRoles.find(ur => ur.id === selectedUserRoleId)?.name?.toLowerCase() || '';
              const isSurveyor = selectedRoleName.includes('surveyor');
              const isTelecaller = selectedRoleName.includes('telecaller');
              const isTeamLead = selectedRoleName.includes('team lead');
              
              if (!selectedUserRoleId) return null;

              return (
                <>
                  {/* Common: Assigned Counters */}
                  <div className="space-y-1.5 relative">
                    <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">Assigned Counters</label>
                    <div className="relative">
                      <button type="button" onClick={() => toggleDropdown('counters')} className="w-full bg-bg-primary border border-bg-border rounded-lg px-3 py-2 text-white text-sm flex items-center justify-between">
                        <span className="truncate">{assignedCounters.length === 0 ? "Select Counters..." : `${assignedCounters.length} selected`}</span>
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      {openDropdown === 'counters' && (
                        <div className="absolute top-full mt-1 w-full bg-bg-primary border border-bg-border rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto p-2 space-y-1">
                          {counters.length === 0 && <p className="text-xs text-text-muted p-2">No counters found.</p>}
                          {counters.map(c => (
                            <label key={c.id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-bg-secondary rounded">
                              <input type="checkbox" checked={assignedCounters.includes(c.id)} onChange={(e) => {
                                setAssignedCounters(prev => e.target.checked ? [...prev, c.id] : prev.filter(id => id !== c.id));
                              }} />
                              <span className="text-sm text-white">{c.username}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Surveyor Only: Domains, Templates, Team Leads, Telecallers */}
                  {isSurveyor && (
                    <>
                      <div className="space-y-1.5 relative">
                        <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">Assigned Domains</label>
                        <div className="relative">
                          <button type="button" onClick={() => toggleDropdown('domains')} className="w-full bg-bg-primary border border-bg-border rounded-lg px-3 py-2 text-white text-sm flex items-center justify-between">
                            <span className="truncate">{assignedDomains.length === 0 ? "Select Domains..." : `${assignedDomains.length} selected`}</span>
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          {openDropdown === 'domains' && (
                            <div className="absolute top-full mt-1 w-full bg-bg-primary border border-bg-border rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto p-2 space-y-1">
                              {domains.map(d => (
                                <label key={d.id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-bg-secondary rounded">
                                  <input type="checkbox" checked={assignedDomains.includes(d.id)} onChange={(e) => {
                                    setAssignedDomains(prev => e.target.checked ? [...prev, d.id] : prev.filter(id => id !== d.id));
                                  }} />
                                  <span className="text-sm text-white">{d.name}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-xs uppercase tracking-widest text-text-secondary font-medium block">Domain Templates</label>
                        {assignedDomains.length === 0 ? (
                          <div className="text-xs text-text-muted italic border border-dashed border-bg-border rounded p-3 text-center">Select a domain to view its templates.</div>
                        ) : (
                          <div className="space-y-4">
                            {assignedDomains.map(dId => {
                              const domain = domains.find(d => d.id === dId);
                              const domainTemplates = availableTemplates.filter(t => t.domain_id === dId);
                              if (!domain) return null;
                              return (
                                <div key={dId} className="bg-bg-primary border border-bg-border rounded-lg p-3">
                                  <div className="text-xs font-bold text-white mb-2">{domain.name} Templates</div>
                                  {domainTemplates.length === 0 ? (
                                    <div className="text-[10px] text-text-muted italic">No templates available.</div>
                                  ) : (
                                    <div className="flex flex-wrap gap-2">
                                      {domainTemplates.map(t => (
                                        <label key={t.id} className={`cursor-pointer px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-2 border ${assignedTemplates.includes(t.id) ? 'bg-accent-blue/10 border-accent-blue text-accent-blue font-medium' : 'bg-bg-secondary border-bg-border text-text-secondary hover:text-white'}`}>
                                          <input type="checkbox" className="hidden" checked={assignedTemplates.includes(t.id)} onChange={(e) => {
                                            setAssignedTemplates(prev => e.target.checked ? [...prev, t.id] : prev.filter(id => id !== t.id));
                                          }} />
                                          {t.name}
                                        </label>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                    </>
                  )}

                  {/* Team Lead: Subordinates */}
                  {isTeamLead && (() => {
                    const surveyorSubs = subordinateOptions.filter(s => {
                      const roleName = s.user_role?.name?.toLowerCase() || '';
                      return roleName.includes('surveyor') || !roleName;
                    });
                    const telecallerSubs = subordinateOptions.filter(s => {
                      const roleName = s.user_role?.name?.toLowerCase() || '';
                      return roleName.includes('telecaller');
                    });
                    
                    const selectedSurveyorsCount = assignedUsers.filter(id => surveyorSubs.some(s => s.id === id)).length;
                    const selectedTelecallersCount = assignedUsers.filter(id => telecallerSubs.some(s => s.id === id)).length;

                    return (
                      <>
                        <div className="space-y-1.5 relative">
                          <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">Assign Surveyors</label>
                          <div className="relative">
                            <button type="button" onClick={() => toggleDropdown('assignSurveyors')} className="w-full bg-bg-primary border border-bg-border rounded-lg px-3 py-2 text-white text-sm flex items-center justify-between">
                              <span className="truncate">{selectedSurveyorsCount === 0 ? "Select Surveyors..." : `${selectedSurveyorsCount} selected`}</span>
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            {openDropdown === 'assignSurveyors' && (
                              <div className="absolute top-full mt-1 w-full bg-bg-primary border border-bg-border rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto p-2 space-y-1">
                                {surveyorSubs.length === 0 && <p className="text-xs text-text-muted p-2">No surveyors found.</p>}
                                {surveyorSubs.map(opt => (
                                    <label key={opt.id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-bg-secondary rounded">
                                      <input type="checkbox" checked={assignedUsers.includes(opt.id)} onChange={(e) => {
                                        setAssignedUsers(prev => e.target.checked ? [...prev, opt.id] : prev.filter(id => id !== opt.id));
                                      }} />
                                      <span className="text-sm text-white">{opt.full_name}</span>
                                    </label>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1.5 relative mt-4">
                          <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">Assign Telecallers</label>
                          <div className="relative">
                            <button type="button" onClick={() => toggleDropdown('assignTelecallers')} className="w-full bg-bg-primary border border-bg-border rounded-lg px-3 py-2 text-white text-sm flex items-center justify-between">
                              <span className="truncate">{selectedTelecallersCount === 0 ? "Select Telecallers..." : `${selectedTelecallersCount} selected`}</span>
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            {openDropdown === 'assignTelecallers' && (
                              <div className="absolute top-full mt-1 w-full bg-bg-primary border border-bg-border rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto p-2 space-y-1">
                                {telecallerSubs.length === 0 && <p className="text-xs text-text-muted p-2">No telecallers found.</p>}
                                {telecallerSubs.map(opt => (
                                    <label key={opt.id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-bg-secondary rounded">
                                      <input type="checkbox" checked={assignedUsers.includes(opt.id)} onChange={(e) => {
                                        setAssignedUsers(prev => e.target.checked ? [...prev, opt.id] : prev.filter(id => id !== opt.id));
                                      }} />
                                      <span className="text-sm text-white">{opt.full_name}</span>
                                    </label>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </>
              );
            })()}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">Username</label>
                <Input value={username} onChange={e => setUsername(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">Password</label>
                <Input type="text" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">Full Name</label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">Phone</label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">Email</label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <Button type="submit" className="flex-1" isLoading={isLoading}>
                {editingId ? 'Update User' : 'Create User'}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm} disabled={isLoading}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </Card>

        {/* Right Panel - Active Users */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <h3 className="text-sm font-semibold text-white uppercase tracking-widest">Active Users</h3>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select 
                value={roleFilter}
                onChange={e => { setRoleFilter(e.target.value); setCurrentPage(1); }}
                className="bg-bg-primary border border-bg-border text-text-secondary text-xs rounded-lg px-3 py-2 focus:border-accent-blue focus:outline-none"
              >
                <option value="all">All Roles</option>
                {userRoles.map(ur => (
                  <option key={ur.id} value={ur.id}>{ur.name}</option>
                ))}
              </select>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input 
                  type="text" 
                  placeholder="Search users..."
                  className="w-full bg-bg-primary border border-bg-border rounded-lg pl-9 pr-3 py-2 text-white text-sm"
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
              </div>
            </div>
          </div>

          <Card className="p-0 overflow-hidden flex flex-col">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-bg-primary/50 text-text-muted text-[10px] uppercase tracking-widest border-b border-bg-border">
                    <th className="py-4 px-5 font-semibold">User</th>
                    <th className="py-4 px-5 font-semibold">Role</th>
                    <th className="py-4 px-5 font-semibold">Assignments</th>
                    <th className="py-4 px-5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.map((surv) => (
                    <tr key={surv.id} className="border-b border-bg-border last:border-0 hover:bg-bg-hover/50">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-bg-primary border flex items-center justify-center">
                            {(() => {
                              const r = surv.user_role?.name?.toLowerCase() || '';
                              if (r.includes('team lead')) return <Users className="w-4 h-4 text-accent-purple" />;
                              if (r.includes('telecaller')) return <PhoneCall className="w-4 h-4 text-accent-yellow" />;
                              if (r.includes('surveyor')) return <ClipboardCheck className="w-4 h-4 text-accent-blue" />;
                              return <UserCog className="w-4 h-4 text-text-muted" />;
                            })()}
                          </div>
                          <div>
                            <span className="font-medium text-white block">{surv.full_name}</span>
                            <span className="text-xs text-text-muted">{surv.username}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <span className="text-white text-xs px-2 py-1 bg-bg-primary border rounded">{surv.user_role?.name || 'Unknown'}</span>
                      </td>
                      <td className="py-4 px-5">
                        {(() => {
                          const rName = surv.user_role?.name?.toLowerCase() || '';
                          if (rName.includes('team lead')) {
                            const assignedUserIds = surv.assigned_users || [];
                            const countersCount = surv.counter_ids?.length || 0;
                            const surveyorSubs = surveyors.filter(s => assignedUserIds.includes(s.id) && (s.user_role?.name?.toLowerCase().includes('surveyor') || !s.user_role?.name));
                            const telecallerSubs = surveyors.filter(s => assignedUserIds.includes(s.id) && s.user_role?.name?.toLowerCase().includes('telecaller'));
                            return (
                              <div className="text-xs text-text-secondary">
                                <div>Surveyors: {surveyorSubs.length}</div>
                                <div>Telecallers: {telecallerSubs.length}</div>
                                <div>Counters: {countersCount}</div>
                              </div>
                            );
                          }
                          if (rName.includes('telecaller')) {
                            return (
                              <div className="text-xs text-text-secondary">
                                <div>Counters: {surv.counter_ids?.length || 0}</div>
                              </div>
                            );
                          }
                          return (
                            <div className="text-xs text-text-secondary">
                              <div>Domains: {surv.assigned_domains?.length || 0}</div>
                              <div>Templates: {surv.assigned_template_ids?.length || 0}</div>
                              <div>Counters: {surv.counter_ids?.length || 0}</div>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleEditClick(surv)} className="p-1.5 text-text-muted hover:text-white rounded hover:bg-bg-primary">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeletingId(surv.id)} className="p-1.5 text-text-muted hover:text-accent-red rounded hover:bg-bg-primary">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {currentItems.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-text-muted italic">No users found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-bg-border bg-bg-primary shrink-0">
                <div className="text-sm text-text-muted">
                  Showing <span className="text-white font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-white font-medium">{Math.min(currentPage * itemsPerPage, filteredSurveyors.length)}</span> of <span className="text-white font-medium">{filteredSurveyors.length}</span> results
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="bg-bg-secondary text-white border border-bg-border hover:bg-bg-border disabled:opacity-50 text-xs px-3 py-1 rounded-md transition-colors"
                  >
                    Previous
                  </button>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="bg-bg-secondary text-white border border-bg-border hover:bg-bg-border disabled:opacity-50 text-xs px-3 py-1 rounded-md transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-bg-secondary w-full max-w-sm rounded-xl shadow-2xl border p-6">
            <h3 className="text-lg font-bold text-white mb-2">Delete User?</h3>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={() => setDeletingId(null)}>Cancel</Button>
              <Button variant="danger" onClick={confirmDelete}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
