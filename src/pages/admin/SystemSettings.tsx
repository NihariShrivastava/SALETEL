import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Settings, Save, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SystemSettings() {
  const [slaSettings, setSlaSettings] = useState({ hot: 1, warm: 2, cold: 3 });
  const [isSavingSLA, setIsSavingSLA] = useState(false);

  useEffect(() => {
    try {
      const savedSla = localStorage.getItem('sla_settings');
      if (savedSla) {
        setSlaSettings(JSON.parse(savedSla));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleSaveSLA = async () => {
    setIsSavingSLA(true);
    try {
      localStorage.setItem('sla_settings', JSON.stringify(slaSettings));
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success('SLA Settings saved successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save SLA settings');
    } finally {
      setIsSavingSLA(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Telecaller Lead Setting</h2>
          <p className="text-text-secondary text-sm mt-1">Configure global application settings and behaviors.</p>
        </div>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-accent-blue/10 rounded-lg">
            <Settings className="w-5 h-5 text-accent-blue" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Telecaller SLA Settings</h3>
            <p className="text-xs text-text-secondary">Configure the number of days before a lead triggers a notification on the telecaller portal.</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-xs uppercase text-text-muted font-bold tracking-widest mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500"></span> Hot Leads (Days)
            </label>
            <input 
              type="number" 
              min="1"
              value={slaSettings.hot}
              onChange={(e) => setSlaSettings(prev => ({ ...prev, hot: parseInt(e.target.value) || 1 }))}
              className="w-full bg-bg-secondary border border-bg-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-text-muted font-bold tracking-widest mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500"></span> Warm Leads (Days)
            </label>
            <input 
              type="number" 
              min="1"
              value={slaSettings.warm}
              onChange={(e) => setSlaSettings(prev => ({ ...prev, warm: parseInt(e.target.value) || 2 }))}
              className="w-full bg-bg-secondary border border-bg-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-text-muted font-bold tracking-widest mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span> Cold Leads (Days)
            </label>
            <input 
              type="number" 
              min="1"
              value={slaSettings.cold}
              onChange={(e) => setSlaSettings(prev => ({ ...prev, cold: parseInt(e.target.value) || 3 }))}
              className="w-full bg-bg-secondary border border-bg-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>
        
        <div className="flex justify-end pt-4 border-t border-bg-border">
          <Button onClick={handleSaveSLA} disabled={isSavingSLA} className="bg-accent-blue text-white">
            {isSavingSLA ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Settings
          </Button>
        </div>
      </Card>
    </div>
  );
}
