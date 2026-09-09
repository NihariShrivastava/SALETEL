import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { X, Loader2, MapPin, ExternalLink, FileText, Calendar, CheckCircle2, User, Phone } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import type { FieldConfig } from '../../types';

// Global cache for form templates to eliminate duplicate network calls across the user session
export const templateCache = new Map<string, { name: string; fields: FieldConfig[] }>();

/**
 * Resolves form template questions/fields from cache or Supabase (form_templates, fallback to file_form_templates)
 */
export async function getFormTemplateFields(
  templateId: string,
  fallbackName?: string
): Promise<{ name: string; fields: FieldConfig[] } | null> {
  if (!templateId) return null;
  if (templateCache.has(templateId)) {
    return templateCache.get(templateId)!;
  }

  try {
    // 1. Try standard form_templates
    const { data: ftData } = await supabase
      .from('form_templates')
      .select('id, name, fields')
      .eq('id', templateId)
      .maybeSingle();

    let fields = ftData?.fields;
    if (typeof fields === 'string') {
      try { fields = JSON.parse(fields); } catch {}
    }

    if (fields && Array.isArray(fields) && fields.length > 0) {
      const result = { name: ftData?.name || fallbackName || 'Form Submission', fields };
      templateCache.set(templateId, result);
      return result;
    }

    // 2. Fallback to file_form_templates
    const { data: fftData } = await supabase
      .from('file_form_templates')
      .select('id, name, fields')
      .eq('id', templateId)
      .maybeSingle();

    let fftFields = fftData?.fields;
    if (typeof fftFields === 'string') {
      try { fftFields = JSON.parse(fftFields); } catch {}
    }

    if (fftFields && Array.isArray(fftFields) && fftFields.length > 0) {
      const result = { name: fftData?.name || fallbackName || 'File Form Submission', fields: fftFields };
      templateCache.set(templateId, result);
      return result;
    }
  } catch (err) {
    console.error(`Failed to fetch template fields for ${templateId}:`, err);
  }

  return null;
}

interface ViewFormModalProps {
  submission: any | null;
  onClose: () => void;
  actions?: React.ReactNode;
}

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

export default function ViewFormModal({ submission, onClose, actions }: ViewFormModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [resolvedTemplate, setResolvedTemplate] = useState<{ name: string; fields: FieldConfig[] } | null>(null);
  const [subData, setSubData] = useState<Record<string, any>>({});
  const [currentSub, setCurrentSub] = useState<any>(submission);

  useEffect(() => {
    if (!submission) {
      setResolvedTemplate(null);
      setSubData({});
      setCurrentSub(null);
      return;
    }

    let isMounted = true;
    setCurrentSub(submission);

    // Parse data safely if stringified
    let initialData = submission.data || {};
    if (typeof initialData === 'string') {
      try {
        initialData = JSON.parse(initialData);
      } catch (e) {
        console.error('Failed to parse submission data JSON:', e);
      }
    }
    setSubData(initialData);

    const loadFormData = async () => {
      let activeSub = submission;
      let templateId = activeSub.form_template_id;

      // If data is empty or templateId is missing, and we have an ID, fetch the full submission record
      if ((!activeSub.data || Object.keys(initialData).length === 0 || !templateId) && activeSub.id) {
        setIsLoading(true);
        try {
          const { data: fullSub } = await supabase
            .from('submissions')
            .select(`
              id,
              data,
              form_template_id,
              status,
              lead_status,
              telecaller_remark,
              admin_notes,
              submitted_at,
              surveyors!surveyor_id(full_name, username),
              telecaller:surveyors!telecaller_id(id, full_name, username),
              form_templates(name, fields)
            `)
            .eq('id', activeSub.id)
            .maybeSingle();

          if (fullSub && isMounted) {
            activeSub = { ...activeSub, ...fullSub };
            setCurrentSub(activeSub);
            let parsedData = fullSub.data || {};
            if (typeof parsedData === 'string') {
              try { parsedData = JSON.parse(parsedData); } catch {}
            }
            initialData = parsedData;
            setSubData(parsedData);
            templateId = fullSub.form_template_id || templateId;
          }
        } catch (err) {
          console.error('Failed to fetch full submission details:', err);
        }
      }

      // Check if template fields are already embedded in the submission object
      const rawTmpl = Array.isArray(activeSub.form_templates)
        ? activeSub.form_templates[0]
        : activeSub.form_templates;

      const templateName = rawTmpl?.name || 'Form Submission';
      let embeddedFields = rawTmpl?.fields;
      if (typeof embeddedFields === 'string') {
        try { embeddedFields = JSON.parse(embeddedFields); } catch {}
      }

      if (embeddedFields && Array.isArray(embeddedFields) && embeddedFields.length > 0) {
        if (isMounted) {
          setResolvedTemplate({ name: templateName, fields: embeddedFields });
          setIsLoading(false);
        }
        if (templateId) {
          templateCache.set(templateId, { name: templateName, fields: embeddedFields });
        }
        return;
      }

      // If fields are not embedded, resolve via templateId
      if (templateId) {
        setIsLoading(true);
        const resolved = await getFormTemplateFields(templateId, templateName);
        if (isMounted) {
          if (resolved) {
            setResolvedTemplate(resolved);
          } else {
            setResolvedTemplate({ name: templateName, fields: [] });
          }
          setIsLoading(false);
        }
      } else {
        if (isMounted) {
          setResolvedTemplate({ name: templateName, fields: [] });
          setIsLoading(false);
        }
      }
    };

    loadFormData();

    return () => {
      isMounted = false;
    };
  }, [submission]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!submission) return null;

  const displaySub = currentSub || submission;
  const templateName = resolvedTemplate?.name || 'Form Submission';
  const fields = resolvedTemplate?.fields || [];
  const sortedFields = [...fields].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

  const surveyorName =
    displaySub.surveyor?.full_name ||
    displaySub.surveyors?.full_name ||
    displaySub.surveyor?.username ||
    displaySub.surveyors?.username ||
    'Surveyor';
  const telecallerName =
    displaySub.telecaller?.full_name ||
    displaySub.telecaller?.username;
  const leadStatus = displaySub.lead_status || displaySub.status || 'new';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-200">
      <Card className="w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col p-0 shadow-2xl border-bg-border/80 bg-bg-secondary">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-bg-border flex justify-between items-start bg-bg-secondary shrink-0">
          <div className="pr-4">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-bold text-white text-lg sm:text-xl leading-tight">{templateName}</h3>
              <Badge variant={getStatusBadgeVariant(leadStatus) as any}>
                {leadStatus.replace(/_/g, ' ')}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-text-muted flex-wrap">
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-accent-blue" />
                Submitted by <strong className="text-white font-medium">{surveyorName}</strong>
              </span>
              {displaySub.submitted_at && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-text-secondary" />
                  {format(new Date(displaySub.submitted_at), 'MMM dd, yyyy hh:mm a')}
                </span>
              )}
              {telecallerName && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-accent-green" />
                  TC: <span className="text-accent-blue font-medium">{telecallerName}</span>
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-white p-1.5 transition-colors bg-bg-primary hover:bg-bg-border rounded-lg shrink-0"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 bg-bg-primary flex-1 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-text-muted">
              <Loader2 className="w-8 h-8 animate-spin text-accent-blue" />
              <span className="text-sm font-medium">Loading form questions...</span>
            </div>
          ) : sortedFields.length > 0 ? (
            <div className="space-y-3.5">
              {sortedFields.map(field => {
                // Section Header Divider
                if (field.type === 'section_header') {
                  return (
                    <div key={field.id} className="pt-4 pb-1 border-b border-bg-border/60">
                      <h4 className="text-xs font-bold text-accent-blue uppercase tracking-widest flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {field.label}
                      </h4>
                    </div>
                  );
                }

                // Paragraph Information block
                if (field.type === 'paragraph_info') {
                  return (
                    <div key={field.id} className="p-3 bg-bg-secondary/60 border border-bg-border rounded-lg text-xs text-text-secondary">
                      {field.label}
                    </div>
                  );
                }

                // Look up answer by field.id, field.label, field.name, or case-insensitive matching
                let rawValue = subData[field.id];
                if (rawValue === undefined && field.label) rawValue = subData[field.label];
                if (rawValue === undefined && (field as any).name) rawValue = subData[(field as any).name];
                if (rawValue === undefined) {
                  const targetId = (field.id || '').trim().toLowerCase();
                  const targetLabel = (field.label || '').trim().toLowerCase();
                  const matchedKey = Object.keys(subData).find(k => {
                    const lowerK = k.trim().toLowerCase();
                    return lowerK === targetId || lowerK === targetLabel;
                  });
                  if (matchedKey) rawValue = subData[matchedKey];
                }

                let displayValue: any = rawValue;

                if (rawValue !== undefined && rawValue !== null && rawValue !== '') {
                  if (typeof rawValue === 'object') {
                    if ('lat' in rawValue && 'lng' in rawValue) {
                      displayValue = rawValue;
                    } else if (Array.isArray(rawValue)) {
                      displayValue = rawValue.join(', ');
                    } else {
                      displayValue = JSON.stringify(rawValue);
                    }
                  }
                } else {
                  displayValue = null;
                }

                const isLocation = displayValue && typeof displayValue === 'object' && 'lat' in displayValue;
                const isUrl = typeof displayValue === 'string' && displayValue.startsWith('http');
                const isImage = isUrl && (displayValue.match(/\.(jpeg|jpg|gif|png|webp)$/i) || displayValue.includes('image'));

                return (
                  <div
                    key={field.id}
                    className="bg-bg-secondary/90 rounded-lg border border-bg-border p-4 hover:border-accent-blue/30 transition-colors shadow-sm"
                  >
                    {/* Question Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <span className="block text-xs uppercase text-text-secondary font-bold tracking-wider">
                          {field.label}
                          {field.required && <span className="text-accent-red ml-1 font-bold">*</span>}
                        </span>
                        {field.helpText && (
                          <span className="block text-[11px] text-text-muted mt-0.5">{field.helpText}</span>
                        )}
                      </div>
                      {field.type && (
                        <span className="text-[10px] uppercase font-semibold text-text-muted bg-bg-primary/80 border border-bg-border px-1.5 py-0.5 rounded shrink-0">
                          {field.type.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>

                    {/* Answer Body */}
                    {displayValue === null ? (
                      <span className="text-xs text-text-muted italic">Not answered</span>
                    ) : isLocation ? (
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-accent-red" />
                          Lat: {displayValue.lat}, Lng: {displayValue.lng}
                        </span>
                        <a
                          href={`https://www.google.com/maps?q=${displayValue.lat},${displayValue.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-accent-blue hover:underline inline-flex items-center gap-1 bg-accent-blue/10 px-2 py-1 rounded border border-accent-blue/20"
                        >
                          View on Google Maps <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ) : isImage ? (
                      <div className="mt-2 bg-black/30 p-2 rounded-lg border border-bg-border inline-block">
                        <a href={displayValue} target="_blank" rel="noreferrer" className="block group">
                          <img
                            src={displayValue}
                            alt={field.label}
                            className="max-h-56 rounded object-contain transition-transform group-hover:scale-[1.02]"
                          />
                          <span className="text-[11px] text-accent-blue mt-1 block flex items-center gap-1">
                            Click to expand image <ExternalLink className="w-3 h-3" />
                          </span>
                        </a>
                      </div>
                    ) : isUrl ? (
                      <div className="mt-1">
                        <a
                          href={displayValue}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-accent-blue hover:underline text-sm font-medium bg-accent-blue/10 px-3 py-1.5 rounded-lg border border-accent-blue/20 break-all"
                        >
                          <FileText className="w-4 h-4" />
                          View Uploaded Document <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ) : (
                      <div className="text-sm sm:text-base text-white font-medium break-words leading-relaxed whitespace-pre-wrap">
                        {String(displayValue)}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Any extra fields in submission.data that weren't in template definition */}
              {(() => {
                const knownFieldKeys = new Set<string>();
                sortedFields.forEach(f => {
                  if (f.id) knownFieldKeys.add(f.id.trim().toLowerCase());
                  if (f.label) knownFieldKeys.add(f.label.trim().toLowerCase());
                  if ((f as any).name) knownFieldKeys.add(String((f as any).name).trim().toLowerCase());
                });

                const extraEntries = Object.entries(subData).filter(([k]) => !knownFieldKeys.has(k.trim().toLowerCase()));
                if (extraEntries.length === 0) return null;

                return (
                  <div className="pt-4 border-t border-bg-border space-y-3">
                    <div className="text-xs uppercase tracking-widest text-text-muted font-bold">
                      Additional Submitted Data
                    </div>
                    {extraEntries.map(([k, v]) => {
                      let displayVal = v;
                      if (typeof v === 'object' && v !== null) {
                        displayVal = JSON.stringify(v);
                      }
                      return (
                        <div key={k} className="bg-bg-secondary/70 rounded-lg border border-bg-border p-3.5">
                          <span className="block text-xs uppercase text-text-secondary mb-1 font-bold tracking-wider">
                            {k}
                          </span>
                          <span className="text-sm text-white break-words">
                            {String(displayVal ?? 'Not answered')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          ) : Object.keys(subData).length > 0 ? (
            /* Fallback: Template has no defined fields, render entries from data directly */
            <div className="space-y-3">
              {Object.entries(subData).map(([k, v]) => {
                let displayVal = v;
                if (typeof v === 'object' && v !== null) {
                  if ('lat' in v && 'lng' in v) {
                    displayVal = `Lat: ${(v as any).lat}, Lng: ${(v as any).lng}`;
                  } else if (Array.isArray(v)) {
                    displayVal = v.join(', ');
                  } else {
                    displayVal = JSON.stringify(v);
                  }
                }
                return (
                  <div key={k} className="bg-bg-secondary rounded-lg border border-bg-border p-4">
                    <span className="block text-xs uppercase text-text-secondary mb-1.5 font-bold tracking-wider">
                      {k}
                    </span>
                    <span className="text-base text-white break-words font-medium">
                      {String(displayVal ?? 'Not answered')}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-text-muted italic text-sm text-center py-12">
              No questions or submitted data found for this form submission.
            </div>
          )}

          {/* Remarks & Notes */}
          {(displaySub.telecaller_remark || displaySub.admin_notes) && (
            <div className="pt-3 border-t border-bg-border space-y-2">
              {displaySub.telecaller_remark && (
                <div className="bg-bg-secondary/80 p-3 rounded-lg border border-bg-border">
                  <span className="text-xs uppercase font-bold tracking-wider text-text-muted block mb-1">
                    Telecaller Remark
                  </span>
                  <p className="text-sm text-white break-words">{displaySub.telecaller_remark}</p>
                </div>
              )}
              {displaySub.admin_notes && (
                <div className="bg-bg-secondary/80 p-3 rounded-lg border border-bg-border">
                  <span className="text-xs uppercase font-bold tracking-wider text-text-muted block mb-1">
                    Notes / Revert Reason
                  </span>
                  <p className="text-sm text-white break-words">{displaySub.admin_notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-bg-border bg-bg-secondary shrink-0 flex items-center justify-between gap-3">
          <div className="text-xs text-text-secondary truncate">
            ID: <span className="font-mono text-text-muted">{displaySub.id}</span>
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <Button variant="outline" size="sm" onClick={onClose} className="border-bg-border hover:bg-bg-primary text-white">
              Close
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
