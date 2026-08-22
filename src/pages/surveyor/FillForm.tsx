import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ArrowLeft, MapPin, UploadCloud, Send, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import SignatureCanvas from 'react-signature-canvas';
import type { FieldConfig } from '../../types';

interface FillFormProps {
  domainId?: string;
  templateId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  isInline?: boolean;
}

export default function FillForm({ domainId, templateId, onSuccess, onCancel, isInline }: FillFormProps = {}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  const activeDomainId = domainId || searchParams.get('domainId');
  const activeTemplateIdParam = templateId || searchParams.get('templateId');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fields, setFields] = useState<FieldConfig[]>([]);
  const [formName, setFormName] = useState('Loading Form...');
  const [formDescription, setFormDescription] = useState('');
  const [resolvedTemplateId, setResolvedTemplateId] = useState<string | null>(null);
  
  // Dynamic form state
  const [formData, setFormData] = useState<Record<string, any>>({});
  
  // Specific states for complex fields
  const [locations, setLocations] = useState<Record<string, {lat: number, lng: number}>>({});
  const [uploadingFields, setUploadingFields] = useState<Record<string, boolean>>({});
  const signatureRefs = useRef<Record<string, SignatureCanvas | null>>({});

  const uploadFileToSupabase = async (file: File | Blob, fieldId: string, ext: string = 'png') => {
    setUploadingFields(prev => ({ ...prev, [fieldId]: true }));
    try {
      const fileName = `${user?.id}_${fieldId}_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('uploads').upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(fileName);
      handleInputChange(fieldId, publicUrl);
      toast.success('Upload complete!');
    } catch (err: any) {
      console.error('Upload Error details:', err);
      toast.error(`Failed to upload: ${err.message || 'Unknown error'}`);
    } finally {
      setUploadingFields(prev => ({ ...prev, [fieldId]: false }));
    }
  };

  const handleSaveSignature = async (fieldId: string) => {
    const canvas = signatureRefs.current[fieldId];
    if (!canvas || canvas.isEmpty()) {
      toast.error('Please draw a signature first.');
      return;
    }
    
    // Get blob
    const dataUrl = canvas.getTrimmedCanvas().toDataURL('image/png');
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    
    await uploadFileToSupabase(blob, fieldId, 'png');
  };

  const handleClearSignature = (fieldId: string) => {
    const canvas = signatureRefs.current[fieldId];
    if (canvas) canvas.clear();
    handleInputChange(fieldId, '');
  };

  useEffect(() => {
    if (!activeDomainId && !activeTemplateIdParam) return;
    
    const fetchTemplate = async () => {
      try {
        let query = supabase.from('form_templates').select('*').eq('is_active', true);
        if (activeTemplateIdParam) {
          query = query.eq('id', activeTemplateIdParam);
        } else if (activeDomainId) {
          query = query.eq('domain_id', activeDomainId);
        }
        
        const { data, error } = await query.single();
          
        if (error) {
          if (error.code === 'PGRST116') {
             // Not found
             setFormName('No Assigned Form');
             setFormDescription('Your role does not have an active form template assigned.');
          } else {
            throw error;
          }
        } else if (data) {
          setResolvedTemplateId(data.id);
          setFormName(data.name);
          setFormDescription(data.description || '');
          setFields(data.fields || []);
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to load form template');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTemplate();
  }, [activeDomainId, activeTemplateIdParam]);

  const handleInputChange = (fieldId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const handleCheckboxChange = (fieldId: string, value: string, isChecked: boolean) => {
    setFormData(prev => {
      const current = prev[fieldId] || [];
      if (isChecked) {
        return { ...prev, [fieldId]: [...current, value] };
      } else {
        return { ...prev, [fieldId]: current.filter((v: string) => v !== value) };
      }
    });
  };

  const handleGetLocation = (fieldId: string) => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    
    toast.loading('Acquiring location...', { id: 'loc' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocations(prev => ({ ...prev, [fieldId]: loc }));
        handleInputChange(fieldId, loc);
        toast.success('Location captured!', { id: 'loc' });
      },
      (err) => {
        toast.error('Failed to get location', { id: 'loc' });
        console.error(err);
      }
    );
  };

  const isFieldVisible = (field: FieldConfig, currentData: Record<string, any>): boolean => {
    if (!field.conditional) return true;
    const { dependsOn, operator, showWhen } = field.conditional;
    if (!dependsOn) return true;

    const dependentValue = currentData[dependsOn];
    
    // If the dependent field has no value, the condition fails (unless checking for empty string, but let's keep it simple)
    if (dependentValue === undefined || dependentValue === null) return false;

    const valStr = String(dependentValue).toLowerCase();
    const targetStr = String(showWhen).toLowerCase();

    switch (operator) {
      case 'equals':
        return valStr === targetStr;
      case 'not_equals':
        return valStr !== targetStr;
      case 'contains':
        return valStr.includes(targetStr);
      default:
        return true;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedTemplateId || !user) return;
    
    setIsSubmitting(true);
    try {
      // Clean formData to only include visible fields
      const cleanedData: Record<string, any> = {};
      fields.forEach(field => {
        if (isFieldVisible(field, formData)) {
          if (formData[field.id] !== undefined) {
            cleanedData[field.id] = formData[field.id];
          }
        }
      });

      const { error } = await supabase.from('submissions').insert({
        form_template_id: resolvedTemplateId,
        domain_id: activeDomainId || null,
        surveyor_id: user.id,
        data: cleanedData,
        status: 'submitted'
      });
      
      if (error) throw error;
      
      toast.success('Form submitted successfully!');
      if (onSuccess) {
        onSuccess();
      } else {
        navigate('/surveyor/dashboard');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit form');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderFieldInput = (field: FieldConfig) => {
    const val = formData[field.id] || '';
    
    switch (field.type) {
      case 'textarea':
        return (
          <textarea 
            required={field.required}
            value={val}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            className="w-full bg-bg-primary border border-bg-border rounded-lg p-3 text-white focus:border-accent-blue focus:outline-none text-sm min-h-[100px]" 
            placeholder={field.placeholder || ''}
          />
        );
      case 'select':
        return (
          <select 
            required={field.required}
            value={val}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            className="w-full bg-bg-primary border border-bg-border rounded-lg px-3 py-2.5 text-white focus:border-accent-blue focus:outline-none transition-colors text-sm"
          >
            <option value="">Select option...</option>
            {field.options?.map((opt, i) => (
              <option key={i} value={opt}>{opt}</option>
            ))}
          </select>
        );
      case 'radio':
      case 'yes_no':
        const options = field.type === 'yes_no' ? ['Yes', 'No'] : (field.options || []);
        return (
          <div className="space-y-2">
            {options.map((opt, i) => (
              <label key={i} className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input 
                  type="radio" 
                  name={field.id} 
                  value={opt}
                  required={field.required}
                  checked={val === opt}
                  onChange={(e) => handleInputChange(field.id, e.target.value)}
                  className="accent-accent-blue" 
                />
                {opt}
              </label>
            ))}
          </div>
        );
      case 'checkbox':
      case 'multiselect':
        const checkedArr = formData[field.id] || [];
        return (
          <div className="space-y-2">
            {field.options?.map((opt, i) => (
              <label key={i} className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input 
                  type="checkbox" 
                  value={opt}
                  checked={checkedArr.includes(opt)}
                  onChange={(e) => handleCheckboxChange(field.id, opt, e.target.checked)}
                  className="accent-accent-blue rounded bg-bg-primary border-bg-border" 
                />
                {opt}
              </label>
            ))}
          </div>
        );
      case 'file':
        return (
          <div className="relative border-2 border-dashed border-bg-border bg-bg-primary/50 rounded-xl p-6 flex flex-col items-center justify-center hover:border-accent-blue transition-colors text-center">
            {uploadingFields[field.id] ? (
               <div className="flex flex-col items-center py-4">
                 <Loader2 className="w-8 h-8 animate-spin text-accent-blue mb-2" />
                 <span className="text-sm text-text-muted">Uploading...</span>
               </div>
            ) : val ? (
               <div className="flex flex-col items-center">
                 <div className="bg-accent-green/10 text-accent-green p-3 rounded-full mb-2">
                   <UploadCloud className="w-6 h-6" />
                 </div>
                 <span className="text-sm text-white font-medium mb-1">File Uploaded</span>
                 <a href={val} target="_blank" rel="noreferrer" className="text-xs text-accent-blue hover:underline mb-2">View File</a>
                 <label className="text-xs text-text-muted hover:text-white cursor-pointer underline">
                   Upload different file
                   <input 
                     type="file" 
                     className="hidden" 
                     onChange={(e) => {
                       if (e.target.files && e.target.files[0]) {
                         uploadFileToSupabase(e.target.files[0], field.id, e.target.files[0].name.split('.').pop() || 'tmp');
                       }
                     }}
                   />
                 </label>
               </div>
            ) : (
              <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer py-4">
                <UploadCloud className="w-8 h-8 text-text-muted mb-2" />
                <span className="text-sm text-white font-medium">Click to upload or drag & drop</span>
                <input 
                  type="file" 
                  className="hidden" 
                  required={field.required}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      uploadFileToSupabase(e.target.files[0], field.id, e.target.files[0].name.split('.').pop() || 'tmp');
                    }
                  }}
                />
              </label>
            )}
          </div>
        );
      case 'signature':
        return (
          <div className="space-y-2">
            {val ? (
               <div className="bg-white rounded-lg border-2 border-bg-border p-2 relative">
                 <img src={val} alt="Signature" className="h-24 mx-auto object-contain" />
                 <div className="text-center mt-2">
                   <button type="button" onClick={() => handleClearSignature(field.id)} className="text-xs text-text-muted hover:text-red-500 underline">
                     Clear & Retake
                   </button>
                 </div>
               </div>
            ) : (
               <div className="relative">
                 <div className="bg-white rounded-lg border-2 border-bg-border overflow-hidden">
                   <SignatureCanvas 
                     penColor="black"
                     canvasProps={{className: 'w-full h-32'}}
                     ref={(ref) => { signatureRefs.current[field.id] = ref; }}
                   />
                 </div>
                 <div className="flex justify-between items-center mt-2">
                   <button type="button" onClick={() => handleClearSignature(field.id)} className="text-xs text-text-muted hover:text-white underline">
                     Clear
                   </button>
                   <Button 
                     type="button" 
                     size="sm"
                     onClick={() => handleSaveSignature(field.id)}
                     isLoading={uploadingFields[field.id]}
                     className="bg-bg-secondary hover:bg-bg-hover text-white border border-bg-border"
                   >
                     Save Signature
                   </Button>
                 </div>
               </div>
            )}
          </div>
        );
      case 'location':
        const loc = locations[field.id];
        return loc ? (
          <div className="bg-accent-green/10 border border-accent-green/30 text-accent-green rounded-lg p-3 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span>Location captured</span>
            </div>
            <button type="button" onClick={() => handleGetLocation(field.id)} className="text-xs underline hover:text-white">Retake</button>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={() => handleGetLocation(field.id)} className="w-full border-dashed">
            <MapPin className="w-4 h-4 mr-2" /> Capture Location
          </Button>
        );
      case 'rating':
        const currentRating = parseInt(val) || 0;
        return (
          <div className="flex gap-2">
            {[1,2,3,4,5].map(star => (
              <span 
                key={star} 
                onClick={() => handleInputChange(field.id, star.toString())}
                className={`text-2xl cursor-pointer transition-colors ${star <= currentRating ? 'text-accent-yellow' : 'text-text-muted hover:text-accent-yellow/50'}`}
              >
                ★
              </span>
            ))}
          </div>
        );
      case 'section_header':
        return null;
      case 'paragraph_info':
        return <p className="text-sm text-text-secondary whitespace-pre-wrap">{field.helpText}</p>;
      default:
        // text, number, email, phone, date, time, datetime
        return (
          <Input 
            type={field.type === 'datetime' ? 'datetime-local' : field.type} 
            placeholder={field.placeholder || ''}
            required={field.required}
            value={val}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
          />
        );
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4">
        {!isInline && (
          <button onClick={() => navigate('/surveyor/dashboard')} className="p-2 text-text-muted hover:text-white bg-bg-secondary rounded-lg border border-bg-border transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">{formName}</h2>
          {formDescription && <p className="text-text-secondary text-sm mt-0.5">{formDescription}</p>}
        </div>
      </div>

      {isLoading ? (
        <Card className="p-12 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent-blue mb-4" />
          <p className="text-text-muted">Loading form template...</p>
        </Card>
      ) : fields.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center">
          <p className="text-text-muted italic border border-dashed border-bg-border rounded-xl p-8 text-center w-full">
            No fields found in this form. Please contact your administrator.
          </p>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="border-t-4 border-t-accent-blue p-6 md:p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {fields.map(field => {
                if (!isFieldVisible(field, formData)) return null;

                const widthClass = field.width === 'half' ? 'col-span-1' : field.width === 'third' ? 'col-span-1 md:col-span-1' : 'col-span-1 md:col-span-2';
                
                if (field.type === 'section_header') {
                  return (
                    <div key={field.id} className={`${widthClass} border-b border-bg-border pb-2 mt-4`}>
                      <h3 className="text-lg font-bold text-white">{field.label}</h3>
                      {field.helpText && <p className="text-xs text-text-secondary mt-1">{field.helpText}</p>}
                    </div>
                  );
                }

                if (field.type === 'paragraph_info') {
                  return (
                    <div key={field.id} className={`${widthClass} bg-bg-secondary/50 p-4 rounded-lg border border-bg-border/50`}>
                      {field.label && <h4 className="text-sm font-semibold text-white mb-2">{field.label}</h4>}
                      {renderFieldInput(field)}
                    </div>
                  );
                }

                return (
                  <div key={field.id} className={`space-y-2 ${widthClass}`}>
                    <label className="text-sm font-semibold text-white">
                      {field.label} {field.required && <span className="text-accent-red">*</span>}
                    </label>
                    {field.helpText && <p className="text-xs text-text-muted mb-2">{field.helpText}</p>}
                    {renderFieldInput(field)}
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="ghost" onClick={() => onCancel ? onCancel() : navigate('/surveyor/dashboard')}>Cancel</Button>
            <Button type="submit" size="lg" isLoading={isSubmitting} className="shadow-lg shadow-accent-blue/20">
              <Send className="w-4 h-4 mr-2" /> Submit Field Data
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
