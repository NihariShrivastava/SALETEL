import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { X, FileCheck, Eye, User, Calendar, ExternalLink, ShieldCheck, HelpCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { FieldConfig } from '../../types';

interface ViewFileSubmissionModalProps {
  file: any | null;
  onClose: () => void;
}

export default function ViewFileSubmissionModal({ file, onClose }: ViewFileSubmissionModalProps) {
  const [resolvedTemplate, setResolvedTemplate] = useState<{ name: string; description?: string; fields: FieldConfig[] } | null>(null);
  const [resolvedLead, setResolvedLead] = useState<any | null>(null);
  const [fetchedData, setFetchedData] = useState<any>(null);
  const [, setIsLoading] = useState(false);

  useEffect(() => {
    if (!file) {
      setResolvedTemplate(null);
      setResolvedLead(null);
      setFetchedData(null);
      return;
    }

    let isMounted = true;

    const loadDetails = async () => {
      setIsLoading(true);
      try {
        // 1. Fetch file submission data if missing
        if ((!file.data || Object.keys(file.data).length === 0) && file.id) {
          const { data: fsData } = await supabase
            .from('file_submissions')
            .select('data')
            .eq('id', file.id)
            .maybeSingle();
          if (fsData?.data && isMounted) {
            setFetchedData(fsData.data);
          }
        }

        // 2. Resolve File Form Template
        const rawTmpl = Array.isArray(file.file_form_template) ? file.file_form_template[0] : file.file_form_template;
        if (rawTmpl && Array.isArray(rawTmpl.fields) && rawTmpl.fields.length > 0) {
          if (isMounted) {
            setResolvedTemplate({
              name: rawTmpl.name || 'File Form',
              description: rawTmpl.description,
              fields: rawTmpl.fields
            });
          }
        } else {
          const templateId = file.file_form_template_id || rawTmpl?.id;
          if (templateId) {
            const { data: tmplData } = await supabase
              .from('file_form_templates')
              .select('id, name, description, fields')
              .eq('id', templateId)
              .maybeSingle();

            if (tmplData && isMounted) {
              let fields = tmplData.fields;
              if (typeof fields === 'string') {
                try { fields = JSON.parse(fields); } catch {}
              }
              setResolvedTemplate({
                name: tmplData.name || 'File Form',
                description: tmplData.description,
                fields: Array.isArray(fields) ? fields : []
              });
            }
          }
        }

        // 3. Resolve Original Lead if present
        if (file.original_lead && file.original_lead.data) {
          if (isMounted) setResolvedLead(file.original_lead);
        } else if (file.original_lead_id) {
          const { data: leadData } = await supabase
            .from('submissions')
            .select(`
              id,
              data,
              submitted_at,
              lead_status,
              lead_status_updated_at,
              surveyor:surveyors!surveyor_id(id, full_name, username),
              telecaller:surveyors!telecaller_id(id, full_name, username),
              form_templates(name, fields)
            `)
            .eq('id', file.original_lead_id)
            .maybeSingle();

          if (leadData && isMounted) {
            setResolvedLead(leadData);
          }
        }
      } catch (err) {
        console.error('Failed to load file submission details:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadDetails();

    return () => {
      isMounted = false;
    };
  }, [file]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Extract raw data from file or fetchedData
  const rawFileData = useMemo(() => {
    let d = fetchedData !== null ? fetchedData : file?.data;
    if (typeof d === 'string') {
      try {
        d = JSON.parse(d);
      } catch (e) {
        console.error('Failed to parse file.data JSON:', e);
      }
    }
    return d || {};
  }, [file, fetchedData]);

  // Extract form answers map (supports fields, data, or flat)
  const formAnswers: Record<string, any> = useMemo(() => {
    let answers: Record<string, any> = {};
    if (!rawFileData || typeof rawFileData !== 'object') return answers;

    // 1. FileHandlerDashboard saves payload: { fields: formData, custom_fields: ... }
    if (rawFileData.fields && typeof rawFileData.fields === 'object') {
      let f = rawFileData.fields;
      if (typeof f === 'string') {
        try { f = JSON.parse(f); } catch {}
      }
      if (typeof f === 'object' && f !== null) {
        answers = { ...answers, ...f };
      }
    }

    // 2. Alternative nested format: { data: formData, custom_fields: ... }
    if (rawFileData.data && typeof rawFileData.data === 'object') {
      let d = rawFileData.data;
      if (typeof d === 'string') {
        try { d = JSON.parse(d); } catch {}
      }
      if (typeof d === 'object' && d !== null) {
        answers = { ...answers, ...d };
      }
    }

    // 3. Flat keys directly on rawFileData
    Object.keys(rawFileData).forEach(key => {
      if (key !== 'fields' && key !== 'custom_fields' && key !== 'data') {
        answers[key] = rawFileData[key];
      }
    });

    return answers;
  }, [rawFileData]);

  const customFields: { id: string; question: string; answer: string }[] = useMemo(() => {
    if (Array.isArray(rawFileData?.custom_fields)) return rawFileData.custom_fields;
    if (Array.isArray(file?.custom_fields)) return file.custom_fields;
    return [];
  }, [rawFileData, file]);

  if (!file) return null;

  const fields = resolvedTemplate?.fields || [];
  const sortedFields = [...fields].sort((a, b) => (a.order || 0) - (b.order || 0));

  const statusVariant = 
    file.status === 'submitted' ? 'blue' :
    file.status === 'deleted' ? 'red' :
    file.status === 'cleared' || file.status === 'closed' ? 'pink' : 'gray';

  const statusLabel = 
    file.status === 'submitted' ? 'OPEN FILE' :
    file.status === 'deleted' ? 'DELETED' :
    file.status === 'cleared' || file.status === 'closed' ? 'CLEARED' : (file.status || 'FILE').toUpperCase();

  const fileHandlerName = file.file_handler?.full_name || file.file_handler?.username || 'File Handler';

  const leadToDisplay = resolvedLead || file.original_lead;
  const surveyorName = leadToDisplay?.surveyor?.full_name || leadToDisplay?.surveyor?.username || '-';
  const telecallerName = file.telecaller_name || leadToDisplay?.telecaller_name || leadToDisplay?.telecaller?.full_name || leadToDisplay?.telecaller?.username || '-';

  const getFieldAnswer = (field: FieldConfig) => {
    // 1. Direct match by ID
    if (formAnswers[field.id] !== undefined && formAnswers[field.id] !== null && formAnswers[field.id] !== '') {
      return formAnswers[field.id];
    }
    // 2. Direct match by field label
    if (field.label && formAnswers[field.label] !== undefined && formAnswers[field.label] !== null && formAnswers[field.label] !== '') {
      return formAnswers[field.label];
    }
    // 3. Case-insensitive / trimmed match by label
    if (field.label) {
      const normalized = field.label.trim().toLowerCase();
      for (const [k, v] of Object.entries(formAnswers)) {
        if (k.trim().toLowerCase() === normalized && v !== undefined && v !== null && v !== '') {
          return v;
        }
      }
    }
    return undefined;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <Card className="w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col p-0 shadow-2xl border-bg-border/80 bg-bg-secondary">
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-bg-border flex justify-between items-start bg-bg-secondary shrink-0">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
              <h3 className="font-bold text-white text-lg sm:text-xl leading-tight">
                {resolvedTemplate?.name || file.file_form_template?.name || 'File Form Submission'}
              </h3>
              <Badge variant={statusVariant as any}>
                {statusLabel}
              </Badge>
              <span className="text-[10px] uppercase font-bold tracking-widest text-accent-blue bg-accent-blue/10 px-2 py-0.5 rounded border border-accent-blue/20">
                View Mode
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-text-muted flex-wrap">
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-accent-green" />
                <span className="text-text-secondary">File Handler:</span>
                <strong className="text-white font-medium">{fileHandlerName}</strong>
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-accent-yellow" />
                <span className="text-text-secondary">Updated:</span>
                <strong className="text-white font-medium">{new Date(file.updated_at || file.submitted_at).toLocaleString()}</strong>
              </span>
              {file.original_lead_id ? (
                <span className="text-text-muted">
                  Lead ID: <span className="text-text-secondary font-mono">{file.original_lead_id.slice(0, 8)}...</span>
                </span>
              ) : (
                <span className="text-text-muted italic">Independent File</span>
              )}
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-text-muted hover:text-white p-1 rounded-lg hover:bg-bg-primary transition-colors shrink-0"
            title="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body - Two Columns on large screens */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Left Column: File Form Data (Read Only) */}
          <div className="w-full md:w-1/2 p-6 overflow-y-auto border-b md:border-b-0 md:border-r border-bg-border">
            <div className="flex items-center justify-between pb-3 border-b border-bg-border mb-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-accent-green" />
                File Form Entry
              </h4>
              <span className="text-[11px] text-text-muted">
                {sortedFields.length} Form Fields
              </span>
            </div>

            {/* Template Fields */}
            <div className="space-y-4">
              {sortedFields.map(field => {
                const answer = getFieldAnswer(field);
                const hasAnswer = answer !== undefined && answer !== null && answer !== '';

                let displayAnswer: string;
                if (!hasAnswer) {
                  displayAnswer = 'Not filled';
                } else if (typeof answer === 'boolean') {
                  displayAnswer = answer ? 'Yes' : 'No';
                } else if (typeof answer === 'object') {
                  if (Array.isArray(answer)) {
                    displayAnswer = answer.join(', ');
                  } else {
                    displayAnswer = JSON.stringify(answer);
                  }
                } else {
                  displayAnswer = String(answer);
                }

                return (
                  <div 
                    key={field.id} 
                    className="bg-bg-primary/80 rounded-xl p-3.5 border border-bg-border shadow-sm group hover:border-accent-blue/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
                        {field.label}
                      </label>
                      {field.type && (
                        <span className="text-[9px] uppercase font-semibold text-text-muted bg-bg-secondary px-1.5 py-0.5 rounded">
                          {field.type.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                    <div className={`text-sm font-medium break-words ${hasAnswer ? 'text-white' : 'text-text-muted italic'}`}>
                      {displayAnswer.startsWith('http') ? (
                        <a href={displayAnswer} target="_blank" rel="noreferrer" className="text-accent-blue hover:underline inline-flex items-center gap-1">
                          View Attachment <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        displayAnswer
                      )}
                    </div>
                  </div>
                );
              })}

              {sortedFields.length === 0 && Object.keys(formAnswers).length > 0 && (
                <div className="space-y-3">
                  {Object.entries(formAnswers).map(([key, val]) => (
                    <div key={key} className="bg-bg-primary/80 rounded-xl p-3.5 border border-bg-border shadow-sm">
                      <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">
                        {key}
                      </span>
                      <span className="text-sm font-medium break-words text-white block">
                        {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {sortedFields.length === 0 && Object.keys(formAnswers).length === 0 && (
                <p className="text-sm text-text-muted italic py-4 text-center">
                  No standard template fields found.
                </p>
              )}
            </div>

            {/* Custom Questions Section */}
            {customFields.length > 0 && (
              <div className="mt-6 pt-6 border-t border-bg-border">
                <h5 className="text-xs font-bold text-white uppercase tracking-widest mb-3 flex items-center gap-2">
                  <HelpCircle className="w-3.5 h-3.5 text-accent-yellow" />
                  Custom Questions & Answers
                </h5>
                <div className="space-y-3">
                  {customFields.map((cf, idx) => (
                    <div key={cf.id || idx} className="bg-bg-primary/80 rounded-xl p-3.5 border border-bg-border">
                      <span className="text-[11px] text-text-muted uppercase tracking-wider font-semibold block mb-1">
                        Q{idx + 1}: {cf.question}
                      </span>
                      <span className="text-sm text-white font-medium block">
                        {cf.answer || <span className="text-text-muted italic">No answer</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Original Lead View */}
          <div className="w-full md:w-1/2 p-6 overflow-y-auto bg-bg-primary/20">
            <div className="flex items-center justify-between pb-3 border-b border-bg-border mb-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <Eye className="w-4 h-4 text-accent-blue" />
                Original Lead Information
              </h4>
              {leadToDisplay?.form_templates && (
                <span className="text-[11px] text-accent-blue font-medium">
                  {(Array.isArray(leadToDisplay.form_templates) ? leadToDisplay.form_templates[0]?.name : leadToDisplay.form_templates?.name) || 'Lead Form'}
                </span>
              )}
            </div>

            {/* Metadata Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              <div className="bg-bg-primary p-3 rounded-xl border border-bg-border shadow-sm">
                <span className="text-[10px] text-text-muted uppercase tracking-wider font-bold block mb-1">Surveyor</span>
                <span className="text-xs text-white font-medium truncate block">{surveyorName}</span>
              </div>
              <div className="bg-bg-primary p-3 rounded-xl border border-bg-border shadow-sm">
                <span className="text-[10px] text-text-muted uppercase tracking-wider font-bold block mb-1">Telecaller</span>
                <span className="text-xs text-white font-medium truncate block">{telecallerName}</span>
              </div>
              <div className="bg-bg-primary p-3 rounded-xl border border-bg-border shadow-sm">
                <span className="text-[10px] text-text-muted uppercase tracking-wider font-bold block mb-1">Lead Status</span>
                <span className="text-xs text-accent-green font-medium capitalize block">{leadToDisplay?.lead_status?.replace(/_/g, ' ') || 'Closed'}</span>
              </div>
            </div>

            {/* Original Lead Data Fields */}
            {!file.original_lead_id ? (
              <div className="p-8 text-center border-2 border-dashed border-bg-border rounded-xl">
                <p className="text-sm text-text-muted italic">This is an independent file not linked to an existing surveyor lead.</p>
              </div>
            ) : !leadToDisplay || !leadToDisplay.data || Object.keys(leadToDisplay.data).length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-bg-border rounded-xl">
                <p className="text-sm text-text-muted italic">No data recorded for this lead.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const tmpl = Array.isArray(leadToDisplay.form_templates)
                    ? leadToDisplay.form_templates[0]
                    : leadToDisplay.form_templates;
                  const leadFields = tmpl?.fields && Array.isArray(tmpl.fields)
                    ? [...tmpl.fields].sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
                    : Object.keys(leadToDisplay.data).map(key => ({ id: key, label: key }));

                  return leadFields.map((field: any) => {
                    const value = leadToDisplay.data[field.id];
                    if (value === undefined || value === null || value === '') return null;

                    let displayVal: any = value;
                    if (typeof value === 'object') {
                      if (value.lat && value.lng) {
                        displayVal = `Lat: ${value.lat.toFixed(6)}, Lng: ${value.lng.toFixed(6)}`;
                      } else if (Array.isArray(value)) {
                        displayVal = value.join(', ');
                      } else {
                        displayVal = JSON.stringify(value);
                      }
                    } else {
                      displayVal = String(value);
                    }

                    return (
                      <div 
                        key={field.id} 
                        className="bg-bg-secondary p-3.5 rounded-lg border border-bg-border shadow-sm group hover:border-accent-blue/40 transition-colors"
                      >
                        <span className="text-[10px] uppercase font-bold text-text-muted block mb-1 tracking-wider">
                          {field.label}
                        </span>
                        <span className="text-sm text-white break-words font-medium">
                          {displayVal.toString().startsWith('http') ? (
                            <a href={displayVal} target="_blank" rel="noreferrer" className="text-accent-blue hover:underline inline-flex items-center gap-1">
                              View Uploaded File <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            displayVal
                          )}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-bg-border shrink-0 flex items-center justify-between bg-bg-secondary rounded-b-2xl">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <ShieldCheck className="w-4 h-4 text-accent-blue" />
            <span>Read-only mode for Team Lead review</span>
          </div>
          <Button type="button" onClick={onClose} variant="outline" className="px-6 text-white hover:bg-bg-primary">
            Close
          </Button>
        </div>
      </Card>
    </div>
  );
}
