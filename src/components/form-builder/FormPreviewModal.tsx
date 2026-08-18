import React from 'react';
import { X, UploadCloud, MapPin } from 'lucide-react';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { FieldConfig } from '../../types';

interface FormPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  formName: string;
  formDescription: string;
  fields: FieldConfig[];
}

export default function FormPreviewModal({ isOpen, onClose, formName, formDescription, fields }: FormPreviewModalProps) {
  if (!isOpen) return null;

  const renderFieldInput = (field: FieldConfig) => {
    switch (field.type) {
      case 'textarea':
        return <textarea className="w-full bg-bg-primary border border-bg-border rounded-lg p-3 text-white focus:border-accent-blue focus:outline-none text-sm min-h-[100px]" placeholder={field.placeholder || ''}></textarea>;
      case 'select':
        return (
          <select className="w-full bg-bg-primary border border-bg-border rounded-lg px-3 py-2.5 text-white focus:border-accent-blue focus:outline-none transition-colors text-sm">
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
              <label key={i} className="flex items-center gap-2 text-sm text-white">
                <input type="radio" name={field.id} className="accent-accent-blue" />
                {opt}
              </label>
            ))}
          </div>
        );
      case 'checkbox':
      case 'multiselect':
        return (
          <div className="space-y-2">
            {field.options?.map((opt, i) => (
              <label key={i} className="flex items-center gap-2 text-sm text-white">
                <input type="checkbox" className="accent-accent-blue rounded bg-bg-primary border-bg-border" />
                {opt}
              </label>
            ))}
          </div>
        );
      case 'file':
        return (
          <div className="border-2 border-dashed border-bg-border bg-bg-primary/50 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors text-center">
            <UploadCloud className="w-8 h-8 text-text-muted mb-2" />
            <span className="text-sm text-white font-medium">Click to upload or drag & drop</span>
          </div>
        );
      case 'signature':
        return (
          <div className="bg-white rounded-lg border-2 border-bg-border h-32 relative flex items-center justify-center">
            <span className="text-gray-300 text-sm italic absolute select-none">Draw signature here</span>
          </div>
        );
      case 'location':
        return (
          <Button type="button" variant="outline" className="w-full border-dashed">
            <MapPin className="w-4 h-4 mr-2" /> Capture Location
          </Button>
        );
      case 'rating':
        return (
          <div className="flex gap-2">
            {[1,2,3,4,5].map(star => (
              <span key={star} className="text-2xl text-text-muted hover:text-accent-yellow cursor-pointer">★</span>
            ))}
          </div>
        );
      case 'section_header':
        return null;
      case 'paragraph_info':
        return <p className="text-sm text-text-secondary whitespace-pre-wrap">{field.helpText}</p>;
      default:
        // text, number, email, phone, date, time, datetime
        return <Input type={field.type === 'datetime' ? 'datetime-local' : field.type} placeholder={field.placeholder || ''} />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-bg-secondary w-full max-w-3xl rounded-xl shadow-2xl border border-bg-border flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-bg-border shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white">Preview Mode</h3>
            <p className="text-xs text-text-secondary">This is exactly how the surveyor will see the form.</p>
          </div>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-white bg-bg-primary rounded-lg border border-bg-border transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-bg-primary custom-scrollbar">
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">{formName || 'Untitled Form'}</h2>
              {formDescription && <p className="text-text-secondary text-sm mt-1">{formDescription}</p>}
            </div>

            <Card className="border-t-4 border-t-accent-blue p-6 md:p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {fields.length === 0 ? (
                  <div className="col-span-1 md:col-span-2 text-center py-10 text-text-muted italic border-2 border-dashed border-bg-border rounded-xl">
                    No fields added to this form yet.
                  </div>
                ) : (
                  fields.map(field => {
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
                  })
                )}
              </div>
            </Card>

            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" size="lg" className="shadow-lg shadow-accent-blue/20 w-full md:w-auto" onClick={(e) => e.preventDefault()}>
                Submit Field Data
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
