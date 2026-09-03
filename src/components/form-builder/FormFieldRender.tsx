import React from 'react';
import { Input } from '../ui/Input';
import type { FieldConfig } from '../../types';

interface FormFieldRenderProps {
  field: FieldConfig;
  value: any;
  onChange: (val: any) => void;
}

export default function FormFieldRender({ field, value, onChange }: FormFieldRenderProps) {
  const val = value || '';

  const handleCheckboxChange = (opt: string, isChecked: boolean) => {
    const current = Array.isArray(value) ? value : [];
    if (isChecked) {
      onChange([...current, opt]);
    } else {
      onChange(current.filter((v: string) => v !== opt));
    }
  };

  switch (field.type) {
    case 'textarea':
      return (
        <textarea 
          required={field.required}
          value={val}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-bg-primary border border-bg-border rounded-lg p-3 text-white focus:border-accent-blue focus:outline-none text-sm min-h-[100px]" 
          placeholder={field.placeholder || ''}
        />
      );
    case 'select':
      return (
        <select 
          required={field.required}
          value={val}
          onChange={(e) => onChange(e.target.value)}
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
                onChange={(e) => onChange(e.target.value)}
                className="accent-accent-blue" 
              />
              {opt}
            </label>
          ))}
        </div>
      );
    case 'checkbox':
    case 'multiselect':
      const checkedArr = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2">
          {field.options?.map((opt, i) => (
            <label key={i} className="flex items-center gap-2 text-sm text-white cursor-pointer">
              <input 
                type="checkbox" 
                value={opt}
                checked={checkedArr.includes(opt)}
                onChange={(e) => handleCheckboxChange(opt, e.target.checked)}
                className="accent-accent-blue rounded bg-bg-primary border-bg-border" 
              />
              {opt}
            </label>
          ))}
        </div>
      );
    case 'rating':
      const currentRating = parseInt(val) || 0;
      return (
        <div className="flex gap-2">
          {[1,2,3,4,5].map(star => (
            <span 
              key={star} 
              onClick={() => onChange(star.toString())}
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
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
