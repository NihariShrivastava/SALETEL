import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { FileText, CalendarDays, History, ArrowRight, Loader2, X, ChevronDown, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import FillForm from './FillForm';

export default function SurveyorDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [assignedDomains, setAssignedDomains] = useState<{id: string, name: string}[]>([]);
  const [activeDomainId, setActiveDomainId] = useState<string | null>(null);
  const [isDomainDropdownOpen, setIsDomainDropdownOpen] = useState(false);
  
  const [assignedTemplates, setAssignedTemplates] = useState<{id: string, name: string}[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [domainName, setDomainName] = useState('Loading...');
  
  const [allSubmissions, setAllSubmissions] = useState<any[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<any[]>([]);
  const [selectedSub, setSelectedSub] = useState<any | null>(null);
  const [showFillForm, setShowFillForm] = useState(false);

  // Filters
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'reverted' | 'approved'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [domainFilter, setDomainFilter] = useState('all');
  const [templateFilter, setTemplateFilter] = useState('all');

  // Initial load to fetch domains and templates
  useEffect(() => {
    if (!user) return;
    
    const fetchAssignedData = async () => {
      try {
        const domainIdsToFetch = user.assigned_domains || [];

        if (domainIdsToFetch.length === 0) {
          setIsLoading(false);
          return;
        }

        const { data: domainsData } = await supabase
          .from('domains')
          .select('id, name')
          .in('id', domainIdsToFetch);

        if (domainsData) {
          setAssignedDomains(domainsData);
          if (domainsData.length > 0 && !activeDomainId) {
            setActiveDomainId(domainsData[0].id);
            setDomainName(domainsData[0].name);
          }
        }
        
        // Fetch Submissions History
        const { data: subs, error } = await supabase
          .from('submissions')
          .select('id, submitted_at, status, data, admin_notes, domain_id, form_template_id, form_templates(name, fields)')
          .eq('surveyor_id', user.id)
          .order('submitted_at', { ascending: false });
          
        if (!error && subs) {
          setAllSubmissions(subs);
        }

      } catch (err) {
        console.error('Failed to fetch assigned data', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAssignedData();
  }, [user]);

  // Fetch templates when domain changes
  useEffect(() => {
    if (!user || !activeDomainId) return;

    const fetchTemplates = async () => {
      const templateIds = user.assigned_template_ids || [];
      if (templateIds.length === 0) {
        setAssignedTemplates([]);
        setActiveTemplateId(null);
        return;
      }
      
      const { data: tData } = await supabase
        .from('form_templates')
        .select('id, name')
        .eq('domain_id', activeDomainId)
        .in('id', templateIds);
        
      if (tData) {
        setAssignedTemplates(tData);
        if (tData.length > 0) {
          setActiveTemplateId(tData[0].id);
        } else {
          setActiveTemplateId(null);
        }
      }
    };
    
    fetchTemplates();
  }, [user, activeDomainId]);

  // Apply filters to submissions
  useEffect(() => {
    let filtered = [...allSubmissions];

    if (activeTab === 'pending') {
      filtered = filtered.filter(s => s.status === 'submitted');
    } else if (activeTab === 'reverted') {
      filtered = filtered.filter(s => s.status === 'reverted');
    } else if (activeTab === 'approved') {
      filtered = filtered.filter(s => s.status === 'approved' || s.status === 'reviewed');
    }

    if (domainFilter !== 'all') {
      filtered = filtered.filter(s => s.domain_id === domainFilter);
    }
    
    if (templateFilter !== 'all') {
      filtered = filtered.filter(s => s.form_template_id === templateFilter);
    }

    if (dateFilter !== 'all') {
      const now = new Date();
      let start = startOfDay(now);
      if (dateFilter === 'week') {
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        start = startOfDay(start);
      } else if (dateFilter === 'month') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      
      filtered = filtered.filter(s => {
        const date = new Date(s.submitted_at);
        return date >= start && date <= endOfDay(now);
      });
    }

    setFilteredSubmissions(filtered);
  }, [allSubmissions, dateFilter, domainFilter, templateFilter, activeTab]);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-bg-secondary border border-bg-border rounded-2xl p-8 relative overflow-hidden flex flex-col gap-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-blue/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        
        <div className="relative z-10 space-y-4">
          <h2 className="text-3xl font-bold text-white tracking-tight">Ready for your next task?</h2>
          
          <div className="flex flex-col gap-4 max-w-sm">
            {assignedDomains.length > 0 && (
              <div className="relative">
                <p className="text-sm text-text-secondary mb-1">Select Domain:</p>
                <button 
                  onClick={() => setIsDomainDropdownOpen(!isDomainDropdownOpen)}
                  className="w-full flex items-center justify-between bg-bg-primary border border-bg-border hover:border-accent-blue px-4 py-3 rounded-lg text-sm text-white font-medium transition-colors"
                >
                  <span>{domainName}</span>
                  <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${isDomainDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isDomainDropdownOpen && (
                  <div className="absolute top-full mt-2 w-full bg-bg-primary border border-bg-border rounded-lg shadow-xl z-50 left-0">
                    {assignedDomains.map(d => (
                      <button
                        key={d.id}
                        onClick={() => {
                          setActiveDomainId(d.id);
                          setDomainName(d.name);
                          setIsDomainDropdownOpen(false);
                          setShowFillForm(false);
                        }}
                        className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                          activeDomainId === d.id 
                            ? 'bg-accent-blue/10 text-accent-blue border-l-2 border-accent-blue font-medium' 
                            : 'text-text-secondary hover:bg-bg-hover hover:text-white border-l-2 border-transparent'
                        }`}
                      >
                        {d.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {assignedTemplates.length > 0 ? (
              <div className="flex flex-col">
                <p className="text-sm text-text-secondary mb-1">Select Template:</p>
                <select 
                  value={activeTemplateId || ''} 
                  onChange={e => {
                    setActiveTemplateId(e.target.value);
                    setShowFillForm(false);
                  }}
                  className="w-full bg-bg-primary border border-bg-border text-white text-sm rounded-lg px-4 py-3 focus:border-accent-blue focus:outline-none"
                >
                  {assignedTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-sm text-accent-red">No templates assigned for this domain.</p>
            )}

            <Button 
              className="w-full py-4 text-lg bg-gradient-to-r from-accent-blue to-accent-purple hover:from-accent-blue/90 hover:to-accent-purple/90 border-transparent shadow-[0_0_20px_rgba(79,110,247,0.3)] mt-2"
              onClick={() => setShowFillForm(true)}
              disabled={!activeDomainId || !activeTemplateId}
            >
              Fill New Form <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </div>

      {showFillForm && activeDomainId && activeTemplateId && (
        <div className="border-t border-bg-border pt-8">
          <FillForm 
            domainId={activeDomainId} 
            templateId={activeTemplateId} 
            isInline={true}
            onSuccess={() => setShowFillForm(false)}
            onCancel={() => setShowFillForm(false)}
          />
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-white uppercase tracking-widest">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card 
            className="flex items-center justify-between bg-bg-secondary/50 hover:bg-bg-hover cursor-pointer transition-colors"
            onClick={() => navigate('/surveyor/history')}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-accent-blue/10">
                <History className="w-6 h-6 text-accent-blue" />
              </div>
              <div>
                <p className="text-xs text-text-secondary uppercase tracking-widest font-medium">View Submissions</p>
                <h4 className="text-lg font-bold text-white leading-tight mt-1">Submission History & Filters</h4>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-text-muted" />
          </Card>
        </div>
      </div>
    </div>
  );
}
