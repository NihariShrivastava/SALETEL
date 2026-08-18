import React, { createContext, useContext, useState } from 'react';
import type { FieldConfig, FieldType } from '../../types';
import { arrayMove } from '@dnd-kit/sortable';

interface FormBuilderContextType {
  fields: FieldConfig[];
  selectedFieldId: string | null;
  addField: (type: FieldType) => void;
  updateField: (id: string, updates: Partial<FieldConfig>) => void;
  deleteField: (id: string) => void;
  duplicateField: (id: string) => void;
  reorderFields: (activeId: string, overId: string) => void;
  selectField: (id: string | null) => void;
  formName: string;
  setFormName: (name: string) => void;
  formDescription: string;
  setFormDescription: (desc: string) => void;
  setFields: React.Dispatch<React.SetStateAction<FieldConfig[]>>;
}

const FormBuilderContext = createContext<FormBuilderContextType | undefined>(undefined);

export function FormBuilderProvider({ children }: { children: React.ReactNode }) {
  const [fields, setFields] = useState<FieldConfig[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [formName, setFormName] = useState('Untitled Form');
  const [formDescription, setFormDescription] = useState('');

  const addField = (type: FieldType) => {
    const newField: FieldConfig = {
      id: crypto.randomUUID(),
      type,
      label: `New ${type} field`,
      required: false,
      order: fields.length,
      width: 'full',
      options: ['Option 1'], // Default options for choice fields
    };
    setFields((prev) => [...prev, newField]);
    setSelectedFieldId(newField.id);
  };

  const updateField = (id: string, updates: Partial<FieldConfig>) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const deleteField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
  };

  const duplicateField = (id: string) => {
    const fieldToDup = fields.find(f => f.id === id);
    if (fieldToDup) {
      const newField = { ...fieldToDup, id: crypto.randomUUID(), label: `${fieldToDup.label} (Copy)` };
      const index = fields.findIndex(f => f.id === id);
      const newFields = [...fields];
      newFields.splice(index + 1, 0, newField);
      setFields(newFields);
      setSelectedFieldId(newField.id);
    }
  };

  const reorderFields = (activeId: string, overId: string) => {
    setFields((prev) => {
      const oldIndex = prev.findIndex((f) => f.id === activeId);
      const newIndex = prev.findIndex((f) => f.id === overId);
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const selectField = (id: string | null) => setSelectedFieldId(id);

  return (
    <FormBuilderContext.Provider value={{
      fields, selectedFieldId, addField, updateField, deleteField, duplicateField, reorderFields, selectField,
      formName, setFormName, formDescription, setFormDescription, setFields
    }}>
      {children}
    </FormBuilderContext.Provider>
  );
}

export const useFormBuilder = () => {
  const context = useContext(FormBuilderContext);
  if (!context) throw new Error('useFormBuilder must be used within FormBuilderProvider');
  return context;
};
