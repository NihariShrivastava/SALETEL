import React from 'react';
import { useFormBuilder } from './FormBuilderContext';
import { Input } from '../ui/Input';
import { X, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';

export default function FieldSettings() {
  const { fields, selectedFieldId, updateField, selectField } = useFormBuilder();
  
  const field = fields.find(f => f.id === selectedFieldId);

  if (!field) {
    return (
      <div className="w-80 bg-bg-secondary border-l border-bg-border h-full flex flex-col items-center justify-center p-6 text-center">
        <p className="text-sm text-text-muted">Select a field on the canvas to edit its properties.</p>
      </div>
    );
  }

  const handleOptionChange = (index: number, value: string) => {
    if (!field.options) return;
    const newOptions = [...field.options];
    newOptions[index] = value;
    updateField(field.id, { options: newOptions });
  };

  const addOption = () => {
    const opts = field.options || [];
    updateField(field.id, { options: [...opts, `Option ${opts.length + 1}`] });
  };

  const removeOption = (index: number) => {
    if (!field.options) return;
    const newOptions = field.options.filter((_, i) => i !== index);
    updateField(field.id, { options: newOptions });
  };

  const hasOptions = ['select', 'multiselect', 'radio', 'checkbox'].includes(field.type);

  return (
    <div className="w-80 bg-bg-secondary border-l border-bg-border h-full overflow-y-auto flex flex-col">
      <div className="p-4 border-b border-bg-border flex justify-between items-center sticky top-0 bg-bg-secondary z-10">
        <h3 className="text-sm font-semibold text-white uppercase tracking-widest">Field Settings</h3>
        <button onClick={() => selectField(null)} className="text-text-muted hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-6">
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">Field Label</label>
          <Input 
            value={field.label} 
            onChange={(e) => updateField(field.id, { label: e.target.value })} 
          />
        </div>

        {field.type !== 'section_header' && field.type !== 'paragraph_info' && (
          <div className="flex items-center justify-between">
            <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">Required Field</label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer"
                checked={field.required}
                onChange={(e) => updateField(field.id, { required: e.target.checked })}
              />
              <div className="w-9 h-5 bg-bg-primary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent-blue border border-bg-border"></div>
            </label>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">Help Text (Optional)</label>
          <Input 
            value={field.helpText || ''} 
            onChange={(e) => updateField(field.id, { helpText: e.target.value })} 
            placeholder="e.g. As on ID proof"
          />
        </div>

        {hasOptions && (
          <div className="space-y-3 pt-4 border-t border-bg-border">
            <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">Options</label>
            <div className="space-y-2">
              {field.options?.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input 
                    value={opt} 
                    onChange={(e) => handleOptionChange(i, e.target.value)} 
                    className="flex-1 text-sm py-1.5"
                  />
                  <button 
                    onClick={() => removeOption(i)}
                    className="p-1.5 text-text-muted hover:text-accent-red bg-bg-primary rounded border border-bg-border transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={addOption} className="w-full mt-2">
              <Plus className="w-4 h-4 mr-1" /> Add Option
            </Button>
          </div>
        )}

        {/* Validation block based on type */}
        {(field.type === 'text' || field.type === 'textarea') && (
          <div className="space-y-4 pt-4 border-t border-bg-border">
            <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">Validation</label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <span className="text-[10px] text-text-muted">Min Length</span>
                <Input type="number" 
                  value={field.validation?.minLength || ''} 
                  onChange={e => updateField(field.id, { validation: { ...field.validation, minLength: Number(e.target.value) }})} 
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-[10px] text-text-muted">Max Length</span>
                <Input type="number" 
                  value={field.validation?.maxLength || ''} 
                  onChange={e => updateField(field.id, { validation: { ...field.validation, maxLength: Number(e.target.value) }})} 
                />
              </div>
            </div>
          </div>
        )}

        <div className="space-y-1.5 pt-4 border-t border-bg-border">
          <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">Field Width</label>
          <select 
            className="w-full bg-bg-primary border border-bg-border rounded-lg px-3 py-2 text-white focus:border-accent-blue focus:outline-none transition-colors text-sm"
            value={field.width}
            onChange={(e) => updateField(field.id, { width: e.target.value as any })}
          >
            <option value="full">100% (Full Width)</option>
            <option value="half">50% (Half Width)</option>
            <option value="third">33% (Third Width)</option>
          </select>
        </div>

        {/* Conditional Logic */}
        <div className="space-y-3 pt-4 border-t border-bg-border">
          <div className="flex items-center justify-between">
            <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">Conditional Logic</label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer"
                checked={!!field.conditional}
                onChange={(e) => {
                  if (e.target.checked) {
                    updateField(field.id, { conditional: { dependsOn: '', showWhen: '', operator: 'equals' } });
                  } else {
                    updateField(field.id, { conditional: undefined });
                  }
                }}
              />
              <div className="w-9 h-5 bg-bg-primary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent-blue border border-bg-border"></div>
            </label>
          </div>
          
          {field.conditional && (
            <div className="space-y-3 mt-3 bg-bg-primary p-3 rounded-lg border border-bg-border">
              <div className="space-y-1.5">
                <span className="text-[10px] text-text-muted">Depends On Question</span>
                <select 
                  className="w-full bg-bg-secondary border border-bg-border rounded-md px-2 py-1.5 text-white focus:border-accent-blue focus:outline-none transition-colors text-xs"
                  value={field.conditional.dependsOn}
                  onChange={(e) => updateField(field.id, { conditional: { ...field.conditional!, dependsOn: e.target.value } })}
                >
                  <option value="">Select a field...</option>
                  {fields.filter(f => f.id !== field.id && f.type !== 'section_header' && f.type !== 'paragraph_info').map(f => (
                    <option key={f.id} value={f.id}>{f.label || 'Unnamed Field'}</option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-1.5">
                <span className="text-[10px] text-text-muted">Operator</span>
                <select 
                  className="w-full bg-bg-secondary border border-bg-border rounded-md px-2 py-1.5 text-white focus:border-accent-blue focus:outline-none transition-colors text-xs"
                  value={field.conditional.operator}
                  onChange={(e) => updateField(field.id, { conditional: { ...field.conditional!, operator: e.target.value as any } })}
                >
                  <option value="equals">Equals</option>
                  <option value="not_equals">Does Not Equal</option>
                  <option value="contains">Contains</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-text-muted">Target Value</span>
                <Input 
                  value={field.conditional.showWhen} 
                  onChange={(e) => updateField(field.id, { conditional: { ...field.conditional!, showWhen: e.target.value } })} 
                  placeholder="e.g. Yes"
                  className="text-xs py-1.5"
                />
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
