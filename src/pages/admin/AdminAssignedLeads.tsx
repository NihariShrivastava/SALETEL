import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { 
  Users, 
  ArrowRightLeft, 
  Search, 
  Loader2, 
  FileText, 
  PhoneCall, 
  Activity, 
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface FormTemplateWithCount {
  id: string;
  name: string;
  description?: string;
  domainName?: string;
  totalEntries: number;
  assignedCount: number;
  unassignedCount: number;
}

export default function AdminAssignedLeads() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [templates, setTemplates] = useState<FormTemplateWithCount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalStats, setTotalStats] = useState({
    totalAssigned: 0,
    totalForms: 0,
    totalTelecallers: 0
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch form templates
      const { data: tmplData, error: tmplErr } = await supabase
        .from('form_templates')
        .select('id, name, description, domains(name)')
        .or('is_deleted.is.null,is_deleted.eq.false')
        .order('name');

      if (tmplErr) throw tmplErr;

      // 2. Fetch all submissions with telecaller info
      const { data: subData, error: subErr } = await supabase
        .from('submissions')
        .select('id, form_template_id, telecaller_id');

      if (subErr) throw subErr;
      const submissions = subData || [];

      // 3. Count unique telecallers
      const assignedTelecallers = new Set(
        submissions.filter(s => s.telecaller_id).map(s => s.telecaller_id)
      );

      let totalAssigned = 0;
      const formattedTemplates: FormTemplateWithCount[] = (tmplData || []).map(tmpl => {
        const matchingSubs = submissions.filter(s => s.form_template_id === tmpl.id);
        const assignedSubs = matchingSubs.filter(s => s.telecaller_id);
        const unassignedSubs = matchingSubs.filter(s => !s.telecaller_id);

        totalAssigned += assignedSubs.length;

        return {
          id: tmpl.id,
          name: tmpl.name,
          description: tmpl.description,
          domainName: (tmpl.domains as any)?.name || 'General',
          totalEntries: matchingSubs.length,
          assignedCount: assignedSubs.length,
          unassignedCount: unassignedSubs.length
        };
      });

      // Sort templates: those with assigned leads first, then by assignedCount descending
      formattedTemplates.sort((a, b) => b.assignedCount - a.assignedCount);

      setTemplates(formattedTemplates);
      setTotalStats({
        totalAssigned,
        totalForms: formattedTemplates.filter(t => t.assignedCount > 0).length,
        totalTelecallers: assignedTelecallers.size
      });
    } catch (err: any) {
      console.error('Failed to fetch assigned leads forms:', err);
      toast.error('Failed to load forms for assigned leads analysis');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.domainName && t.domainName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-bg-secondary border border-bg-border rounded-2xl p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-accent-blue/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-accent-blue/10 rounded-xl border border-accent-blue/20">
                <Users className="w-6 h-6 text-accent-blue" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                Assigned Leads Custom Analysis
              </h2>
            </div>
            <p className="text-text-secondary text-sm max-w-2xl">
              Inspect already assigned leads by form questions and answers, view telecaller & surveyor assignments, and reassign leads across your telecaller team.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button 
              onClick={fetchData} 
              variant="outline" 
              size="sm"
              className="border-bg-border text-text-secondary hover:text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
            <div className="bg-bg-primary border border-bg-border rounded-xl p-3.5 flex items-center gap-4">
              <div className="text-center">
                <div className="text-xl font-bold text-accent-green">{totalStats.totalAssigned}</div>
                <div className="text-[10px] uppercase text-text-muted font-bold tracking-wider">Leads Assigned</div>
              </div>
              <div className="w-px h-8 bg-bg-border"></div>
              <div className="text-center">
                <div className="text-xl font-bold text-accent-blue">{totalStats.totalForms}</div>
                <div className="text-[10px] uppercase text-text-muted font-bold tracking-wider">Forms Active</div>
              </div>
              <div className="w-px h-8 bg-bg-border"></div>
              <div className="text-center">
                <div className="text-xl font-bold text-white">{totalStats.totalTelecallers}</div>
                <div className="text-[10px] uppercase text-text-muted font-bold tracking-wider">Telecallers</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container Card (matching the TL portal design) */}
      <Card className="p-6 border-accent-blue/20 shadow-[0_0_20px_rgba(79,110,247,0.06)]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-accent-green" />
              <h3 className="text-lg font-bold text-white">Assigned Leads Custom Analysis</h3>
              <Badge variant="green" className="ml-2 font-mono">
                {totalStats.totalAssigned} ASSIGNED
              </Badge>
            </div>
            <p className="text-xs text-text-secondary mt-1">
              Filter by questions, view telecallers & reassign
            </p>
          </div>

          {/* Search bar */}
          <div className="w-full sm:w-72 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input
              placeholder="Search forms..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 bg-bg-primary text-xs py-2"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-text-muted">
            <Loader2 className="w-8 h-8 animate-spin text-accent-blue" />
            <span className="text-sm">Loading assigned leads forms...</span>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="py-16 text-center text-text-muted italic border-2 border-dashed border-bg-border rounded-xl">
            {searchQuery ? 'No forms match your search.' : 'No form templates found.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTemplates.map(tmpl => (
              <div 
                key={tmpl.id}
                className="bg-bg-primary border border-bg-border rounded-xl p-5 hover:border-accent-green/50 transition-all flex flex-col justify-between group shadow-sm hover:shadow-[0_4px_20px_rgba(34,197,94,0.08)]"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] uppercase font-bold text-accent-blue bg-accent-blue/10 px-2 py-0.5 rounded border border-accent-blue/20 truncate max-w-[150px]">
                      {tmpl.domainName}
                    </span>
                    <span className="text-xs font-semibold text-text-muted">
                      {tmpl.totalEntries} total entries
                    </span>
                  </div>

                  <h4 className="font-bold text-white text-lg group-hover:text-accent-green transition-colors mb-1.5">
                    {tmpl.name}
                  </h4>

                  <p className="text-xs text-text-secondary line-clamp-2 mb-4">
                    {tmpl.description || 'Custom template for field lead collection and analysis.'}
                  </p>

                  <div className="mb-4">
                    <span className="text-sm font-bold text-accent-green">
                      {tmpl.assignedCount} leads assigned
                    </span>
                    {tmpl.unassignedCount > 0 && (
                      <span className="text-xs text-text-muted ml-2">
                        ({tmpl.unassignedCount} unassigned)
                      </span>
                    )}
                  </div>
                </div>

                <Button
                  onClick={() => navigate(`/admin/assigned-leads/${tmpl.id}`)}
                  className="w-full bg-accent-blue/15 hover:bg-accent-blue/25 text-accent-blue border border-accent-blue/30 text-xs py-2.5 flex items-center justify-center gap-2 group-hover:border-accent-green/40 group-hover:text-accent-green group-hover:bg-accent-green/10 transition-all"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>Custom Assigned Leads</span>
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
