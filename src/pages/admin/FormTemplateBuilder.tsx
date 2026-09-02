import React, { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DndContext, DragOverlay, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Button } from '../../components/ui/Button';
import { ArrowLeft, Save, Eye } from 'lucide-react';
import { FormBuilderProvider, useFormBuilder } from '../../components/form-builder/FormBuilderContext';
import FieldPalette from '../../components/form-builder/FieldPalette';
import FieldCanvas from '../../components/form-builder/FieldCanvas';
import FieldSettings from '../../components/form-builder/FieldSettings';
import FormPreviewModal from '../../components/form-builder/FormPreviewModal';
import type { FieldType } from '../../types';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

function BuilderInner() {
  const navigate = useNavigate();
  const { domainId } = useParams();
  const [searchParams] = useSearchParams();
  const templateIdParam = searchParams.get('templateId');
  const { user } = useAuth();
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const { fields, formName, formDescription, reorderFields, setFields, setFormName, setFormDescription } = useFormBuilder();

  React.useEffect(() => {
    if (!domainId) return;
    
    const loadTemplate = async () => {
      try {
        if (templateIdParam) {
          const { data, error } = await supabase
            .from('form_templates')
            .select('*')
            .eq('id', templateIdParam)
            .or('is_deleted.is.null,is_deleted.eq.false')
            .single();
          
        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is not found
        
          if (data) {
            setTemplateId(data.id);
            setFormName(data.name);
            setFormDescription(data.description || '');
            setFields(data.fields || []);
          }
        } else {
          // Fetch domain to default form name
          const { data: domainData } = await supabase.from('domains').select('name').eq('id', domainId).or('is_deleted.is.null,is_deleted.eq.false').single();
          if (domainData) {
            setFormName(`${domainData.name} Template`);
          }
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to load template');
      }
    };
    
    loadTemplate();
  }, [domainId, templateIdParam, setFields, setFormName, setFormDescription]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    // Only used for sorting now, no specific start logic needed for palette
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    if (active.id !== over.id) {
      // Reordering existing fields
      reorderFields(active.id as string, over.id as string);
    }
  };

  const handleSave = async () => {
    if (!domainId || !user) return;
    setIsSaving(true);
    try {
      if (templateId) {
        const { error } = await supabase
          .from('form_templates')
          .update({
            name: formName,
            description: formDescription,
            fields: fields,
            updated_at: new Date().toISOString()
          })
          .eq('id', templateId);
        if (error) throw error;
        toast.success('Template updated successfully!');
      } else {
        const { data, error } = await supabase
          .from('form_templates')
          .insert({
            domain_id: domainId,
            name: formName,
            description: formDescription,
            fields: fields,
            created_by: user.id
          })
          .select('id')
          .single();
        if (error) throw error;
        setTemplateId(data.id);
        toast.success('Template saved successfully!');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DndContext 
      sensors={sensors} 
      collisionDetection={closestCenter} 
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-screen bg-bg-primary flex flex-col font-sans overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-bg-secondary border-b border-bg-border flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/admin/domains')} className="text-text-muted hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-bg-border mx-2"></div>
            <div>
              <h1 className="text-sm font-bold text-white leading-none">{formName || 'Untitled Form'}</h1>
              <span className="text-[10px] text-text-muted uppercase tracking-widest mt-0.5 inline-block">Draft • V1</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
              <Eye className="w-4 h-4 mr-2" />
              Preview Form
            </Button>
            <Button size="sm" onClick={handleSave} isLoading={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              Save Template
            </Button>
          </div>
        </header>

        {/* Builder Area */}
        <div className="flex-1 flex overflow-hidden">
          <FieldPalette />
          <FieldCanvas />
          <FieldSettings />
        </div>
      </div>

      <DragOverlay>
        {/* We can add a custom drag overlay for reordering here if desired in the future */}
      </DragOverlay>

      <FormPreviewModal 
        isOpen={showPreview} 
        onClose={() => setShowPreview(false)} 
        formName={formName}
        formDescription={formDescription}
        fields={fields}
      />
    </DndContext>
  );
}

export default function FormTemplateBuilder() {
  const { domainId } = useParams();
  
  return (
    <FormBuilderProvider>
      <BuilderInner />
    </FormBuilderProvider>
  );
}
