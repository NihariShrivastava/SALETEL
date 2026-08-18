import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Building2, Trash2, Search, Edit2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import type { Counter } from '../../types';

export default function CounterManagement() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [counters, setCounters] = useState<Counter[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from('counters')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setCounters(data || []);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load counters');
    }
  };

  const handleSaveCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !user?.id) {
      toast.error('Please fill all required fields');
      return;
    }
    setIsLoading(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('counters')
          .update({
            username,
            password_hash: password,
            location,
          })
          .eq('id', editingId);
        
        if (error) throw error;
        toast.success('Counter updated successfully');
      } else {
        const { error } = await supabase.from('counters').insert({
          username,
          password_hash: password,
          location,
        });
        
        if (error) throw error;
        toast.success('Counter created successfully');
      }
      
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to save counter. Username might be taken.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setUsername('');
    setPassword('');
    setLocation('');
  };

  const handleEditClick = (counter: Counter) => {
    setEditingId(counter.id);
    setUsername(counter.username);
    setPassword(counter.password_hash);
    setLocation(counter.location || '');
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    const id = deletingId;
    setDeletingId(null);
    
    // Optimistic UI update
    setCounters(prev => prev.filter(c => c.id !== id));
    if (editingId === id) resetForm();

    try {
      const { error } = await supabase.from('counters').delete().eq('id', id);
      if (error) throw error;
      toast.success('Counter deleted');
    } catch (error: any) {
      console.error(error);
      toast.error('Failed to delete counter. It might be in use.');
      fetchData(); // Revert on failure
    }
  };

  const filteredCounters = counters.filter(c => {
    const matchesSearch = c.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (c.location && c.location.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Counter Management</h2>
        <p className="text-text-secondary text-sm mt-1">Manage physical counter locations and their login credentials.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Panel - Create/Edit Counter */}
        <Card title={editingId ? "Edit Counter" : "Create Counter"} className="xl:col-span-1 h-fit">
          <form onSubmit={handleSaveCounter} className="space-y-4 mt-2">
            
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">Username</label>
              <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. counter_delhi" required />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">Password</label>
              <Input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">Location</label>
              <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Delhi Branch" />
            </div>

            <div className="flex gap-3 mt-4">
              <Button type="submit" className="flex-1" isLoading={isLoading}>
                {editingId ? 'Update Counter' : 'Create Counter'}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm} disabled={isLoading}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </Card>

        {/* Right Panel - Active Counters */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <h3 className="text-sm font-semibold text-white uppercase tracking-widest">Active Counters</h3>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input 
                  type="text" 
                  placeholder="Search counters..."
                  className="w-full bg-bg-primary border border-bg-border rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:border-accent-blue focus:outline-none transition-colors"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-bg-primary/50 text-text-muted text-[10px] uppercase tracking-widest border-b border-bg-border">
                    <th className="py-4 px-5 font-semibold">Counter ID / Username</th>
                    <th className="py-4 px-5 font-semibold">Password</th>
                    <th className="py-4 px-5 font-semibold">Location</th>
                    <th className="py-4 px-5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCounters.map((counter) => (
                    <tr key={counter.id} className="border-b border-bg-border last:border-0 hover:bg-bg-hover/50 transition-colors">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-bg-primary border border-bg-border flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-accent-blue" />
                          </div>
                          <span className="font-medium text-white">{counter.username}</span>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <span className="text-white font-mono text-xs px-2 py-1 bg-bg-primary border border-bg-border rounded">{counter.password_hash}</span>
                      </td>
                      <td className="py-4 px-5 text-text-secondary">{counter.location || '-'}</td>
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleEditClick(counter)} className="p-1.5 text-text-muted hover:text-white transition-colors rounded hover:bg-bg-primary" title="Edit">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeletingId(counter.id)} className="p-1.5 text-text-muted hover:text-accent-red transition-colors rounded hover:bg-bg-primary" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredCounters.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-text-muted italic">
                        No counters found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg-secondary w-full max-w-sm rounded-xl shadow-2xl border border-bg-border flex flex-col overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-bold text-white mb-2">Delete Counter?</h3>
              <p className="text-sm text-text-secondary">Are you sure you want to delete this counter? This action cannot be undone.</p>
            </div>
            <div className="p-4 border-t border-bg-border flex justify-end gap-3 bg-bg-primary/50">
              <Button variant="outline" onClick={() => setDeletingId(null)}>Cancel</Button>
              <Button variant="danger" onClick={confirmDelete} className="bg-accent-red hover:bg-red-600 text-white border-0">Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
