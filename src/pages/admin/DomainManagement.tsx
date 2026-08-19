import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import type { Domain } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const presetColors = ['#4f6ef7', '#6c63ff', '#22c55e', '#eab308', '#ef4444', '#06b6d4', '#f97316', '#8b5cf6'];
const iconList = ['Briefcase', 'Car', 'Wrench', 'ClipboardCheck', 'UserCheck', 'Truck', 'ShieldCheck', 'Banknote'];

interface DomainWithStats extends Domain {
  surveyors?: { id: string }[];
  form_templates?: { id: string, name: string, is_active: boolean }[];
}

export default function DomainManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [domains, setDomains] = useState<DomainWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form State
  const [editingDomainId, setEditingDomainId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('Briefcase');
  const [selectedColor, setSelectedColor] = useState('#4f6ef7');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch Domains with counts
      const { data: rData, error } = await supabase
        .from('domains')
        .select(`
          *,
          surveyors(id),
          form_templates(id, name, is_active)
        `)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setDomains(rData || []);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load domains');
    }
  };

  const handleCreateDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !user?.id) return;
    setIsLoading(true);
    try {
      if (editingDomainId) {
        const { error } = await supabase.from('domains').update({
          name,
          description,
          icon: selectedIcon,
          color: selectedColor,
        }).eq('id', editingDomainId);
        if (error) throw error;
        toast.success('Domain updated successfully');
      } else {
        const { error } = await supabase.from('domains').insert({
          name,
          description,
          icon: selectedIcon,
          color: selectedColor,
          created_by: user.id
        });
        if (error) throw error;
        toast.success('Domain created successfully');
      }
      setName('');
      setDescription('');
      setEditingDomainId(null);
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error(editingDomainId ? 'Failed to update domain' : 'Failed to create domain');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (domain: DomainWithStats) => {
    setEditingDomainId(domain.id);
    setName(domain.name);
    setDescription(domain.description || '');
    setSelectedIcon(domain.icon || 'Briefcase');
    setSelectedColor(domain.color || '#4f6ef7');
  };

  const handleDeleteDomain = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this domain? This might affect existing users.')) return;
    try {
      const { error } = await supabase.from('domains').delete().eq('id', id);
      if (error) throw error;
      toast.success('Domain deleted');
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete domain. It may be in use.');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!window.confirm('Are you sure you want to delete this template? This will remove all associated submissions.')) return;
    try {
      const { error } = await supabase.from('form_templates').delete().eq('id', templateId);
      if (error) throw error;
      toast.success('Template deleted');
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete template. It may be in use.');
    }
  };

  const renderIcon = (iconName: string, color: string) => {
    const IconComponent = (Icons as any)[iconName] || Icons.HelpCircle;
    return <IconComponent className="w-5 h-5" style={{ color }} />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Domains Console</h2>
        <p className="text-text-secondary text-sm mt-1">Manage functional domains and their templates.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Create/Edit Domain */}
        <Card title={editingDomainId ? "Edit Domain" : "Create Domain"} className="lg:col-span-1 h-fit">
          <form onSubmit={handleCreateDomain} className="space-y-5 mt-2">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">Domain Name</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Three Wheeler" required />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">Description</label>
              <textarea 
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full bg-bg-primary border border-bg-border rounded-lg px-3 py-2 text-white placeholder:text-text-muted focus:border-accent-blue focus:outline-none transition-colors text-sm"
                rows={3}
                placeholder="Brief description of this role..."
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">Domain Color</label>
              <div className="flex flex-wrap gap-2">
                {presetColors.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${selectedColor === color ? 'border-white scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">Domain Icon</label>
              <div className="grid grid-cols-4 gap-2">
                {iconList.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setSelectedIcon(icon)}
                    className={`p-2 rounded-lg border flex items-center justify-center transition-colors ${selectedIcon === icon ? 'bg-bg-hover border-accent-blue' : 'bg-bg-primary border-bg-border hover:border-text-muted'}`}
                  >
                    {renderIcon(icon, selectedIcon === icon ? selectedColor : '#64748b')}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              {editingDomainId && (
                <Button type="button" variant="outline" className="flex-1" onClick={() => {
                  setEditingDomainId(null);
                  setName('');
                  setDescription('');
                }}>Cancel</Button>
              )}
              <Button type="submit" className="flex-1" isLoading={isLoading}>
                {editingDomainId ? 'Update Domain' : 'Create Domain'}
              </Button>
            </div>
          </form>
        </Card>

        {/* Right Panel - Active Domains */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-white uppercase tracking-widest mb-4">Active Domains</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {domains.map(domain => {
              const surveyorCount = domain.surveyors?.length || 0;
              const templateList = domain.form_templates || [];
              const hasTemplate = templateList.length > 0;

              return (
                <Card key={domain.id} className="flex flex-col relative group">
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                    <button onClick={() => handleEditClick(domain)} className="text-text-muted hover:text-accent-blue p-1 bg-bg-primary rounded">
                      <Icons.Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteDomain(domain.id)} className="text-text-muted hover:text-accent-red p-1 bg-bg-primary rounded">
                      <Icons.Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="flex justify-between items-start mb-4 pr-8">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-bg-primary border border-bg-border">
                        {renderIcon(domain.icon || 'HelpCircle', domain.color || '#fff')}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white leading-tight">{domain.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-text-muted">{surveyorCount} users</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-sm text-text-secondary mb-6 flex-1">{domain.description || 'No description provided.'}</p>
                  
                  <div className="pt-4 border-t border-bg-border flex flex-col gap-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-text-secondary font-medium">Templates ({templateList.length}):</span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="py-1 px-2 h-auto text-[10px]"
                        onClick={() => navigate(`/admin/domains/${domain.id}/template`)}
                      >
                        + New
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      {templateList.map(tpl => (
                        <div key={tpl.id} className="flex justify-between items-center bg-bg-primary border border-bg-border p-2 rounded-lg text-sm">
                          <span className="text-white truncate pr-2">{tpl.name || 'Unnamed Template'}</span>
                          <div className="flex items-center gap-2">
                            {tpl.is_active ? <Badge variant="green">Active</Badge> : <Badge variant="yellow">Draft</Badge>}
                            <button 
                              onClick={() => navigate(`/admin/domains/${domain.id}/template?templateId=${tpl.id}`)}
                              className="text-text-muted hover:text-accent-blue"
                            >
                              <Icons.Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteTemplate(tpl.id)}
                              className="text-text-muted hover:text-accent-red"
                            >
                              <Icons.Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {templateList.length === 0 && (
                        <div className="text-xs text-text-muted italic text-center py-2">No templates yet.</div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
            
            {domains.length === 0 && (
              <div className="col-span-1 md:col-span-2 text-center py-12 border border-dashed border-bg-border rounded-xl text-text-muted">
                No domains found. Create one to get started.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
