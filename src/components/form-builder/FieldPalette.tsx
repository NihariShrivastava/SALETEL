import React from 'react';
import { Type, AlignLeft, Hash, Mail, Phone, Calendar, Clock, CalendarClock, ChevronDown, ListChecks, CircleDot, CheckSquare, Upload, PenTool, MapPin, Star, ToggleLeft, Minus, Info } from 'lucide-react';
import type { FieldType } from '../../types';
import { useFormBuilder } from './FormBuilderContext';

const fieldCategories = [
  {
    name: 'Basic Input',
    items: [
      { type: 'text', label: 'Short Answer', icon: Type },
      { type: 'textarea', label: 'Paragraph', icon: AlignLeft },
      { type: 'number', label: 'Number', icon: Hash },
      { type: 'email', label: 'Email', icon: Mail },
      { type: 'phone', label: 'Phone', icon: Phone },
    ]
  },
  {
    name: 'Choice',
    items: [
      { type: 'select', label: 'Dropdown', icon: ChevronDown },
      { type: 'multiselect', label: 'Multiple Choice', icon: ListChecks },
      { type: 'radio', label: 'Radio Group', icon: CircleDot },
      { type: 'checkbox', label: 'Checkboxes', icon: CheckSquare },
      { type: 'yes_no', label: 'Yes / No', icon: ToggleLeft },
    ]
  },
  {
    name: 'Date & Time',
    items: [
      { type: 'date', label: 'Date', icon: Calendar },
      { type: 'time', label: 'Time', icon: Clock },
      { type: 'datetime', label: 'Date & Time', icon: CalendarClock },
    ]
  },
  {
    name: 'Advanced',
    items: [
      { type: 'file', label: 'File Upload', icon: Upload },
      { type: 'signature', label: 'Signature', icon: PenTool },
      { type: 'location', label: 'Location GPS', icon: MapPin },
      { type: 'rating', label: 'Rating', icon: Star },
    ]
  },
  {
    name: 'Layout',
    items: [
      { type: 'section_header', label: 'Section Header', icon: Minus },
      { type: 'paragraph_info', label: 'Info Text', icon: Info },
    ]
  }
];

function FieldItem({ type, label, icon: Icon }: { type: string, label: string, icon: any }) {
  const { addField } = useFormBuilder();

  return (
    <div
      onClick={() => addField(type as FieldType)}
      className="flex items-center gap-3 p-3 bg-bg-primary border border-bg-border rounded-lg cursor-pointer hover:border-accent-blue hover:bg-bg-hover transition-colors"
    >
      <Icon className="w-4 h-4 text-text-muted" />
      <span className="text-xs font-medium text-white">{label}</span>
    </div>
  );
}

export default function FieldPalette() {
  return (
    <div className="w-64 bg-bg-secondary border-r border-bg-border h-full overflow-y-auto p-4 custom-scrollbar">
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-white uppercase tracking-widest">Field Palette</h3>
        <p className="text-xs text-text-secondary mt-1">Click a field to add it to the canvas.</p>
      </div>

      <div className="space-y-6">
        {fieldCategories.map(cat => (
          <div key={cat.name}>
            <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3">{cat.name}</h4>
            <div className="grid grid-cols-1 gap-2">
              {cat.items.map(item => (
                <FieldItem key={item.type} {...item} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
