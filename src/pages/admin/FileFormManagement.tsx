import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Plus, Edit2, Trash2, Search, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import type { FileFormTemplate } from '../../types';

export default function FileFormManagement() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<FileFormTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('file_form_templates')
        .select('*')
        .or('is_deleted.is.null,is_deleted.eq.false')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load file form templates');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    try {
      const { error } = await supabase
        .from('file_form_templates')
        .update({ is_deleted: true })
        .eq('id', id);
      if (error) throw error;
      toast.success('Template deleted successfully');
      fetchTemplates();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete template');
    }
  };

  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">File Form Management</h2>
          <p className="text-text-secondary text-sm mt-1">Manage templates assigned to File Handlers</p>
        </div>
        <Button onClick={() => navigate('/admin/file-forms/new')}>
          <Plus className="w-4 h-4 mr-2" />
          Create File Form
        </Button>
      </div>

      <Card className="p-0 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-bg-border bg-bg-secondary">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search forms..."
              className="w-full bg-bg-primary border border-bg-border rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-accent-blue"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-bg-primary/50 text-text-muted text-[10px] uppercase tracking-widest border-b border-bg-border">
                <th className="py-4 px-5 font-semibold">Form Name</th>
                <th className="py-4 px-5 font-semibold">Description</th>
                <th className="py-4 px-5 font-semibold text-center">Fields</th>
                <th className="py-4 px-5 font-semibold">Last Updated</th>
                <th className="py-4 px-5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTemplates.map(t => (
                <tr key={t.id} className="border-b border-bg-border last:border-0 hover:bg-bg-hover/50">
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-bg-primary border border-bg-border flex items-center justify-center">
                        <FileText className="w-4 h-4 text-accent-blue" />
                      </div>
                      <span className="font-medium text-white">{t.name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-5 text-text-secondary truncate max-w-[200px]">{t.description || '-'}</td>
                  <td className="py-4 px-5 text-center text-white">{t.fields?.length || 0}</td>
                  <td className="py-4 px-5 text-text-secondary">
                    {new Date(t.updated_at).toLocaleDateString()}
                  </td>
                  <td className="py-4 px-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => navigate(`/admin/file-forms/edit/${t.id}`)} className="p-1.5 text-text-muted hover:text-white rounded hover:bg-bg-primary">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(t.id)} className="p-1.5 text-text-muted hover:text-accent-red rounded hover:bg-bg-primary">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTemplates.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-text-muted italic">No file forms found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
