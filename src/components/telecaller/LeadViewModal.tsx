import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface LeadViewModalProps {
  lead: any;
  onClose: () => void;
  onStatusUpdate: () => void;
}

export default function LeadViewModal({ lead, onClose, onStatusUpdate }: LeadViewModalProps) {
  const [remark, setRemark] = useState(lead.telecaller_remark || '');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async (status: string) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('submissions')
        .update({
          lead_status: status,
          telecaller_remark: remark,
          lead_status_updated_at: new Date().toISOString()
        })
        .eq('id', lead.id);

      if (error) throw error;
      toast.success('Lead updated successfully');
      onStatusUpdate();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update lead');
    } finally {
      setIsUpdating(false);
    }
  };

  // Ensure fields are sorted by their defined order
  const fields = lead.form_templates?.fields ? [...lead.form_templates.fields].sort((a, b) => a.order - b.order) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <Card className="w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col p-0 shadow-2xl">
        <div className="p-4 border-b border-bg-border flex justify-between items-center bg-bg-secondary shrink-0">
          <div>
            <h3 className="font-bold text-white text-lg">Lead Details</h3>
            <p className="text-xs text-text-muted mt-1">From {lead.form_templates?.name || 'Unknown Form'}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-white p-1 transition-colors bg-bg-primary rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-6 bg-bg-primary flex-1 custom-scrollbar">
          <div className="space-y-4">
            {fields.map(field => {
              const value = lead.data?.[field.id];
              let displayValue = value;
              
              if (value !== undefined && value !== null) {
                if (typeof value === 'object') {
                  if ('lat' in value && 'lng' in value) {
                    displayValue = `Lat: ${(value as any).lat}, Lng: ${(value as any).lng}`;
                  } else if (Array.isArray(value)) {
                    displayValue = value.join(', ');
                  } else {
                    displayValue = JSON.stringify(value);
                  }
                }
              }

              return (
                <div key={field.id} className="bg-bg-secondary rounded-lg border border-bg-border p-4">
                  <span className="block text-xs uppercase text-text-secondary mb-2 font-bold tracking-widest">{field.label}</span>
                  {typeof displayValue === 'string' && displayValue.startsWith('http') && displayValue.includes('supabase.co/storage/v1/object/public/') ? (
                    <div className="mt-2 bg-black/20 p-2 rounded border border-bg-border inline-block">
                      {displayValue.match(/\.(jpeg|jpg|gif|png)$/i) ? (
                        <a href={displayValue} target="_blank" rel="noreferrer" className="block">
                          <img src={displayValue} alt={field.label} className="max-h-48 rounded object-contain" />
                        </a>
                      ) : (
                        <a href={displayValue} target="_blank" rel="noreferrer" className="text-accent-blue hover:underline text-sm break-all">
                          View Uploaded Document
                        </a>
                      )}
                    </div>
                  ) : (
                    <span className="text-base text-white break-words">{displayValue || '-'}</span>
                  )}
                </div>
              );
            })}
            
            {fields.length === 0 && (
              <div className="text-text-muted italic text-sm text-center py-8">No specific fields found for this lead.</div>
            )}
          </div>
          
          <div className="space-y-2 pt-4 border-t border-bg-border">
            <label className="text-sm font-medium text-white">Remarks / Notes</label>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Enter your conversation notes here..."
              className="w-full bg-bg-secondary border border-bg-border rounded-lg p-3 text-white focus:border-accent-blue focus:outline-none min-h-[100px] text-sm"
            />
          </div>
        </div>
        
        <div className="p-4 border-t border-bg-border bg-bg-secondary shrink-0">
          <p className="text-xs text-text-muted mb-3 uppercase tracking-widest font-bold">Update Lead Status</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Button size="sm" onClick={() => handleUpdate('cold')} disabled={isUpdating} className="w-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 border-transparent">Cold Lead</Button>
            <Button size="sm" onClick={() => handleUpdate('warm')} disabled={isUpdating} className="w-full bg-orange-600 text-white shadow-lg shadow-orange-600/30 hover:bg-orange-500 border-transparent">Warm Lead</Button>
            <Button size="sm" onClick={() => handleUpdate('hot')} disabled={isUpdating} className="w-full bg-red-600 text-white shadow-lg shadow-red-600/30 hover:bg-red-500 border-transparent">Hot Lead</Button>
            <Button size="sm" onClick={() => handleUpdate('immediate')} disabled={isUpdating} className="w-full bg-accent-red text-white shadow-[0_0_15px_rgba(239,68,68,0.6)] hover:bg-red-500 border-transparent">Immediate Lead</Button>
            <Button size="sm" onClick={() => handleUpdate('skipped')} disabled={isUpdating} className="w-full bg-purple-600 text-white shadow-lg shadow-purple-600/30 hover:bg-purple-500 border-transparent">Skipped</Button>
            <Button size="sm" onClick={() => handleUpdate('wrong_number')} disabled={isUpdating} className="w-full bg-slate-600 text-white shadow-lg shadow-slate-600/30 hover:bg-slate-500 border-transparent">Wrong Number</Button>
          </div>
          <div className="flex justify-end mt-4 pt-4 border-t border-bg-border">
            <Button size="sm" onClick={() => handleUpdate('reverted_to_tl')} disabled={isUpdating} variant="outline" className="text-text-secondary hover:text-white border-bg-border bg-bg-primary">Revert to Team Lead</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
