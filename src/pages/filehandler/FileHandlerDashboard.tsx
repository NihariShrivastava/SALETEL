import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { FolderOpen, FileCheck, Search, Loader2, Plus, X, Trash2, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import type { FileFormTemplate, FileSubmission, Submission, FieldConfig } from '../../types';
import FormFieldRender from '../../components/form-builder/FormFieldRender';

export default function FileHandlerDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'pending' | 'submitted'>('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [pendingLeads, setPendingLeads] = useState<Submission[]>([]);
  const [submittedFiles, setSubmittedFiles] = useState<FileSubmission[]>([]);
  const [template, setTemplate] = useState<FileFormTemplate | null>(null);

  // Form handling
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Submission | null>(null);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [customFields, setCustomFields] = useState<{ id: string; question: string; answer: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewingLead, setViewingLead] = useState<Submission | null>(null);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // 1. Fetch the assigned file form template
      if (user.assigned_file_template_id) {
        const { data: tplData } = await supabase
          .from('file_form_templates')
          .select('*')
          .eq('id', user.assigned_file_template_id)
          .single();
        if (tplData) setTemplate(tplData);
      }

      // 2. Fetch File Submissions by this handler
      const { data: fsData, error: fsError } = await supabase
        .from('file_submissions')
        .select(`
          *,
          file_form_template:file_form_templates(*),
          original_lead:submissions(*)
        `)
        .eq('file_handler_id', user.id)
        .order('updated_at', { ascending: false });

      if (fsError && fsError.code !== '42P01') throw fsError; // 42P01 is table does not exist
      const submitted = (fsData || []) as FileSubmission[];
      setSubmittedFiles(submitted);

      const submittedLeadIds = submitted.map(fs => fs.original_lead_id);

      // 3. Fetch Pending Leads (Closed by Team Leads assigned to this handler)
      if (user.team_lead_ids && user.team_lead_ids.length > 0) {
        // Fetch the assigned users for those team leads
        const { data: tlData } = await supabase
          .from('surveyors')
          .select('assigned_users')
          .in('id', user.team_lead_ids);
        
        let surveyorIds: string[] = [];
        if (tlData) {
          tlData.forEach(tl => {
            if (tl.assigned_users) {
              surveyorIds = [...surveyorIds, ...tl.assigned_users];
            }
          });
        }
        
        surveyorIds = Array.from(new Set(surveyorIds));

        if (surveyorIds.length > 0) {
          let query = supabase
            .from('submissions')
            .select(`
              *,
              surveyor:surveyors!surveyor_id(full_name, username),
              form_templates(name, fields)
            `)
            .eq('lead_status', 'closed')
            .in('surveyor_id', surveyorIds)
            .order('submitted_at', { ascending: false });

          const { data: leadsData } = await query;
          
          if (leadsData) {
            // Filter out leads that are already submitted
            const pending = leadsData.filter(lead => !submittedLeadIds.includes(lead.id));
            setPendingLeads(pending);
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === '42P01') {
         toast.error("Database schema not fully updated yet. Please ask the admin to run the SQL migration.");
      } else {
         toast.error('Failed to load dashboard data');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenForm = (lead: Submission) => {
    if (!template) {
      toast.error('No File Form assigned to you.');
      return;
    }
    setSelectedLead(lead);
    setFormData(lead.data || {});
    setCustomFields([]);
    setEditingFileId(null);
    setIsFormOpen(true);
  };

  const handleEditFile = (fileSub: FileSubmission) => {
    setSelectedLead(fileSub.original_lead || null);
    setFormData(fileSub.data.fields || {});
    setCustomFields(fileSub.data.custom_fields || []);
    setEditingFileId(fileSub.id);
    setIsFormOpen(true);
  };

  const handleCloseFile = async (id: string) => {
    if (!window.confirm('Are you sure you want to CLOSE this file? It cannot be edited afterwards.')) return;
    try {
      const { error } = await supabase
        .from('file_submissions')
        .update({ status: 'closed', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast.success('File closed successfully');
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to close file');
    }
  };

  const addCustomField = () => {
    setCustomFields([...customFields, { id: Date.now().toString(), question: '', answer: '' }]);
  };

  const updateCustomField = (id: string, key: 'question' | 'answer', value: string) => {
    setCustomFields(customFields.map(f => f.id === id ? { ...f, [key]: value } : f));
  };

  const removeCustomField = (id: string) => {
    setCustomFields(customFields.filter(f => f.id !== id));
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !template || !selectedLead) return;
    setIsSubmitting(true);

    try {
      const payloadData = {
        fields: formData,
        custom_fields: customFields
      };

      if (editingFileId) {
        const { error } = await supabase
          .from('file_submissions')
          .update({ data: payloadData, updated_at: new Date().toISOString() })
          .eq('id', editingFileId);
        if (error) throw error;
        toast.success('File updated successfully!');
      } else {
        const { error } = await supabase
          .from('file_submissions')
          .insert({
            file_form_template_id: template.id,
            file_handler_id: user.id,
            original_lead_id: selectedLead.id,
            data: payloadData,
            status: 'submitted'
          });
        if (error) throw error;
        toast.success('File submitted successfully!');
      }
      setIsFormOpen(false);
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to submit form: ' + (err.message || err.details || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-bg-secondary border border-bg-border rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-green/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight mb-2">File Handler Dashboard</h2>
            <p className="text-text-secondary">Process and close files from team lead submissions.</p>
          </div>
          <div className="flex gap-4">
             <div className="bg-bg-primary border border-bg-border rounded-lg p-4 flex flex-col items-center min-w-[100px]">
                <div className="text-xl font-bold text-white">{pendingLeads.length}</div>
                <div className="text-[10px] uppercase text-text-muted font-bold tracking-widest text-center mt-1">Pending</div>
              </div>
              <div className="bg-bg-primary border border-bg-border rounded-lg p-4 flex flex-col items-center min-w-[100px]">
                <div className="text-xl font-bold text-accent-green">{submittedFiles.length}</div>
                <div className="text-[10px] uppercase text-text-muted font-bold tracking-widest text-center mt-1">Submitted</div>
              </div>
          </div>
        </div>
      </div>

      {!template && (
        <div className="bg-accent-red/10 border border-accent-red/50 rounded-xl p-4 text-accent-red font-medium">
          You have not been assigned a File Form Template. Please contact your admin.
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="flex border-b border-bg-border">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 py-4 px-6 text-sm font-semibold transition-colors flex justify-center items-center gap-2 ${
              activeTab === 'pending'
                ? 'text-accent-blue border-b-2 border-accent-blue bg-accent-blue/5'
                : 'text-text-secondary hover:text-white hover:bg-bg-secondary'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            Pending Leads
            <Badge variant="gray">{pendingLeads.length}</Badge>
          </button>
          <button
            onClick={() => setActiveTab('submitted')}
            className={`flex-1 py-4 px-6 text-sm font-semibold transition-colors flex justify-center items-center gap-2 ${
              activeTab === 'submitted'
                ? 'text-accent-blue border-b-2 border-accent-blue bg-accent-blue/5'
                : 'text-text-secondary hover:text-white hover:bg-bg-secondary'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            Submitted Bucket
            <Badge variant="gray">{submittedFiles.length}</Badge>
          </button>
        </div>

        <div className="p-0">
          {activeTab === 'pending' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-bg-secondary/50 text-text-muted text-[10px] uppercase tracking-widest">
                    <th className="py-4 px-6 font-semibold">Lead Form</th>
                    <th className="py-4 px-6 font-semibold">Surveyor</th>
                    <th className="py-4 px-6 font-semibold">Date Closed</th>
                    <th className="py-4 px-6 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingLeads.map(lead => (
                    <tr key={lead.id} className="border-b border-bg-border last:border-0 hover:bg-bg-primary/80 transition-colors">
                      <td className="py-4 px-6 text-white font-medium">{(lead as any).form_templates?.name || 'Form'}</td>
                      <td className="py-4 px-6 text-text-secondary">{(lead as any).surveyor?.full_name || 'Unknown'}</td>
                      <td className="py-4 px-6 text-text-secondary">{new Date(lead.submitted_at).toLocaleDateString()}</td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setViewingLead(lead)}>
                            <Eye className="w-4 h-4 mr-1.5" /> View
                          </Button>
                          <Button size="sm" onClick={() => handleOpenForm(lead)} disabled={!template}>
                            Open File
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {pendingLeads.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-text-muted italic">No pending leads to process.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'submitted' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-bg-secondary/50 text-text-muted text-[10px] uppercase tracking-widest">
                    <th className="py-4 px-6 font-semibold">File Template</th>
                    <th className="py-4 px-6 font-semibold">Lead ID</th>
                    <th className="py-4 px-6 font-semibold">Status</th>
                    <th className="py-4 px-6 font-semibold">Last Updated</th>
                    <th className="py-4 px-6 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {submittedFiles.map(file => (
                    <tr key={file.id} className="border-b border-bg-border last:border-0 hover:bg-bg-primary/80 transition-colors">
                      <td className="py-4 px-6 text-white font-medium">{file.file_form_template?.name || 'File Form'}</td>
                      <td className="py-4 px-6 text-text-secondary text-xs truncate max-w-[100px]">{file.original_lead_id}</td>
                      <td className="py-4 px-6">
                        <Badge variant={file.status === 'closed' ? 'green' : 'blue'}>
                          {file.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-4 px-6 text-text-secondary">{new Date(file.updated_at).toLocaleString()}</td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleEditFile(file)}
                            disabled={file.status === 'closed'}
                          >
                            Edit
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => handleCloseFile(file.id)}
                            disabled={file.status === 'closed'}
                            className={file.status === 'closed' ? 'bg-bg-secondary text-text-muted border-none' : 'bg-accent-green text-white hover:bg-green-600 border-none'}
                          >
                            Close File
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {submittedFiles.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-text-muted italic">No submitted files yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* Form Modal */}
      {isFormOpen && template && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-bg-secondary w-full max-w-3xl rounded-2xl shadow-2xl border border-bg-border my-8 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-bg-border flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xl font-bold text-white">{template.name}</h3>
                {template.description && <p className="text-sm text-text-secondary mt-1">{template.description}</p>}
              </div>
              <button onClick={() => setIsFormOpen(false)} className="text-text-muted hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <form id="file-form" onSubmit={handleSubmitForm} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {template.fields.map(field => (
                    <div key={field.id} className={`space-y-2 ${field.width === 'full' ? 'col-span-1 md:col-span-2' : 'col-span-1'}`}>
                      <label className="text-sm font-semibold text-white block">
                        {field.label} {field.required && <span className="text-accent-red">*</span>}
                      </label>
                      {field.helpText && <p className="text-xs text-text-muted mb-2">{field.helpText}</p>}
                      <FormFieldRender
                        field={field}
                        value={formData[field.id]}
                        onChange={(val) => setFormData(prev => ({ ...prev, [field.id]: val }))}
                      />
                    </div>
                  ))}
                </div>

                <div className="pt-6 border-t border-bg-border">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-white font-semibold">Custom Questions</h4>
                    <Button type="button" variant="outline" size="sm" onClick={addCustomField}>
                      <Plus className="w-4 h-4 mr-2" /> Add Question
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    {customFields.map((cf, index) => (
                      <div key={cf.id} className="flex gap-4 items-start bg-bg-primary p-4 rounded-xl border border-bg-border">
                        <div className="flex-1 space-y-4">
                          <div>
                            <label className="text-xs text-text-secondary uppercase tracking-widest font-medium mb-1.5 block">Question {index + 1}</label>
                            <Input 
                              value={cf.question}
                              onChange={(e) => updateCustomField(cf.id, 'question', e.target.value)}
                              placeholder="Enter question here"
                              required
                            />
                          </div>
                          <div>
                            <label className="text-xs text-text-secondary uppercase tracking-widest font-medium mb-1.5 block">Answer</label>
                            <Input 
                              value={cf.answer}
                              onChange={(e) => updateCustomField(cf.id, 'answer', e.target.value)}
                              placeholder="Enter answer here"
                              required
                            />
                          </div>
                        </div>
                        <button type="button" onClick={() => removeCustomField(cf.id)} className="p-2 text-text-muted hover:text-accent-red mt-6">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                    {customFields.length === 0 && (
                      <p className="text-sm text-text-muted italic">No custom questions added.</p>
                    )}
                  </div>
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-bg-border shrink-0 flex justify-end gap-3 bg-bg-secondary rounded-b-2xl">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" form="file-form" isLoading={isSubmitting}>
                {editingFileId ? 'Update File Form' : 'Submit File Form'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* View Original Lead Modal */}
      {viewingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-bg-secondary w-full max-w-2xl rounded-2xl shadow-2xl border border-bg-border my-8 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-bg-border flex justify-between items-center shrink-0">
              <h3 className="text-xl font-bold text-white">Original Lead Submission</h3>
              <button onClick={() => setViewingLead(null)} className="text-text-muted hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-bg-primary p-3 rounded-xl border border-bg-border">
                  <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Form Name</p>
                  <p className="text-sm text-white font-medium">{(viewingLead as any).form_templates?.name || 'Form'}</p>
                </div>
                <div className="bg-bg-primary p-3 rounded-xl border border-bg-border">
                  <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Surveyor</p>
                  <p className="text-sm text-white font-medium">{(viewingLead as any).surveyor?.full_name || 'Unknown'}</p>
                </div>
              </div>
              
              <h4 className="text-sm font-bold text-white uppercase tracking-widest border-b border-bg-border pb-2 mb-4">Submitted Data</h4>
              
              {Object.keys(viewingLead.data || {}).length === 0 ? (
                <p className="text-text-muted text-sm italic">No data recorded for this lead.</p>
              ) : (
                <div className="space-y-3">
                  {((viewingLead as any).form_templates?.fields 
                      ? [...(viewingLead as any).form_templates.fields].sort((a: any, b: any) => a.order - b.order)
                      : Object.keys(viewingLead.data).map(key => ({ id: key, label: key }))
                    ).map((field: any) => {
                      const value = viewingLead.data[field.id];
                      if (value === undefined || value === null || value === '') return null;
                      
                      let displayValue = '-';
                      if (typeof value === 'object') {
                        if (value.lat && value.lng) {
                          displayValue = `${value.lat.toFixed(6)}, ${value.lng.toFixed(6)}`;
                        } else if (Array.isArray(value)) {
                          displayValue = value.join(', ');
                        } else {
                          displayValue = JSON.stringify(value);
                        }
                      } else {
                        displayValue = String(value);
                      }

                      return (
                        <div key={field.id} className="bg-bg-primary p-3 rounded-lg border border-bg-border">
                          <span className="text-xs text-text-muted block mb-1">{field.label}</span>
                          <span className="text-sm text-white break-words">
                            {displayValue.toString().startsWith('http') ? (
                              <a href={displayValue} target="_blank" rel="noreferrer" className="text-accent-blue hover:underline">View Uploaded File</a>
                            ) : displayValue}
                          </span>
                        </div>
                      );
                  })}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-bg-border shrink-0 bg-bg-secondary rounded-b-2xl flex justify-end">
              <Button onClick={() => setViewingLead(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
