import React from 'react';
import { useFormBuilder } from './FormBuilderContext';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Copy, Edit2 } from 'lucide-react';
import type { FieldConfig } from '../../types';
import { cn } from '../../lib/utils';

function SortableFieldCard({ field }: { field: FieldConfig }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const { selectedFieldId, selectField, deleteField, duplicateField } = useFormBuilder();
  
  const isSelected = selectedFieldId === field.id;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative flex gap-3 p-4 bg-bg-secondary border rounded-xl transition-colors group",
        isSelected ? "border-accent-blue shadow-[0_0_0_1px_#4f6ef7]" : "border-bg-border hover:border-text-muted",
        isDragging ? "opacity-50" : ""
      )}
      onClick={() => selectField(field.id)}
    >
      {/* Drag Handle */}
      <div 
        {...attributes} 
        {...listeners}
        className="flex items-center text-text-muted hover:text-white cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-5 h-5" />
      </div>

      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{field.label || 'Untitled Field'}</span>
          {field.required && <span className="text-accent-red">*</span>}
        </div>
        {field.helpText && <p className="text-xs text-text-secondary">{field.helpText}</p>}
        <div className="mt-2 text-xs uppercase tracking-widest text-text-muted font-mono bg-bg-primary inline-block px-2 py-1 rounded border border-bg-border">
          {field.type}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={(e) => { e.stopPropagation(); deleteField(field.id); }}
          className="p-1.5 text-text-muted hover:text-accent-red bg-bg-primary rounded border border-bg-border hover:border-accent-red/30 transition-colors"
          title="Delete Field"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); duplicateField(field.id); }}
          className="p-1.5 text-text-muted hover:text-white bg-bg-primary rounded border border-bg-border hover:border-text-muted transition-colors"
          title="Duplicate Field"
        >
          <Copy className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function FieldCanvas() {
  const { fields, formName, setFormName, formDescription, setFormDescription } = useFormBuilder();
  const { setNodeRef } = useDroppable({ id: 'canvas' });

  return (
    <div className="flex-1 bg-bg-primary h-full overflow-y-auto p-8 relative">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Form Header */}
        <div className="bg-bg-secondary border-t-4 border-t-accent-blue border-x border-b border-bg-border rounded-xl p-6 shadow-sm">
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            className="w-full text-3xl font-bold text-white bg-transparent border-b border-transparent hover:border-bg-border focus:border-accent-blue focus:outline-none transition-colors pb-2"
            placeholder="Form Title"
          />
          <textarea
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            className="w-full mt-4 text-sm text-text-secondary bg-transparent border-b border-transparent hover:border-bg-border focus:border-accent-blue focus:outline-none transition-colors resize-none"
            placeholder="Form description"
            rows={2}
          />
        </div>

        {/* Droppable Canvas */}
        <div ref={setNodeRef} className="min-h-[200px]">
          <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {fields.map(field => (
                <SortableFieldCard key={field.id} field={field} />
              ))}
            </div>
          </SortableContext>
          
          {fields.length === 0 && (
            <div className="h-40 border-2 border-dashed border-bg-border rounded-xl flex items-center justify-center text-text-muted mt-4">
              Drag and drop fields here from the palette
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
