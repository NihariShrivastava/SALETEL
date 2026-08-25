import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Loader2, PhoneCall } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

export default function LeadStatusCount() {
  const [isLoading, setIsLoading] = useState(true);
  
  const [counts, setCounts] = useState({
    total: 0,
    newLeads: 0,
    immediate: 0,
    hot: 0,
    warm: 0,
    cold: 0,
    skipped: 0,
    wrongNumber: 0,
    reverted: 0,
    closed: 0,
    deleted: 0
  });

  useEffect(() => {
    fetchCounts();
  }, []);

  const fetchCounts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('lead_status, lead_status_updated_at, status');

      if (error) throw error;

      const submissions = data || [];
      const today = new Date();
      today.setHours(0,0,0,0);

      let newLeads = 0;
      let immediate = 0;
      let hot = 0;
      let warm = 0;
      let cold = 0;
      let skipped = 0;
      let wrongNumber = 0;
      let reverted = 0;
      let closed = 0;
      let deletedCount = 0;

      submissions.forEach(sub => {
        let ls = sub.lead_status || 'new';
        
        // Handle skipped logic: if skipped yesterday or before, it becomes new today
        if (ls === 'skipped' && sub.lead_status_updated_at) {
          if (new Date(sub.lead_status_updated_at) < today) ls = 'new';
        }

        let bucket = '';
        if (sub.status === 'reverted') bucket = 'reverted';
        else if (ls === 'closed') bucket = 'closed';
        else bucket = ls;

        if (bucket === 'new') newLeads += 1;
        else if (bucket === 'immediate') immediate += 1;
        else if (bucket === 'hot') hot += 1;
        else if (bucket === 'warm') warm += 1;
        else if (bucket === 'cold') cold += 1;
        else if (bucket === 'skipped') skipped += 1;
        else if (bucket === 'wrong_number') wrongNumber += 1;
        else if (bucket === 'reverted') reverted += 1;
        else if (bucket === 'closed') closed += 1;
        else if (bucket === 'deleted') deletedCount += 1;
      });

      setCounts({
        total: newLeads + immediate + hot + warm + cold + skipped + wrongNumber + reverted + closed + deletedCount,
        newLeads,
        immediate,
        hot,
        warm,
        cold,
        skipped,
        wrongNumber,
        reverted,
        closed,
        deleted: deletedCount
      });
    } catch (error: any) {
      console.error('Error fetching lead counts:', error);
      toast.error('Failed to load lead status counts');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-accent-blue mb-4" />
        <p className="text-text-muted font-medium">Loading status counts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <PhoneCall className="w-6 h-6 text-accent-blue" />
          Lead Status Count
        </h2>
        <p className="text-text-secondary text-sm mt-1">Overview of all active and historic lead dispositions across the system.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <Card className="p-5 border-l-4 border-l-white">
          <div className="text-xs text-text-secondary uppercase tracking-wider font-semibold mb-1">Total Leads</div>
          <div className="text-3xl font-bold text-white tracking-tight">{counts.total.toLocaleString()}</div>
        </Card>
        
        <Card className="p-5 border-l-4 border-l-text-muted">
          <div className="text-xs text-text-secondary uppercase tracking-wider font-semibold mb-1">New / Pending</div>
          <div className="text-3xl font-bold text-white tracking-tight">{counts.newLeads.toLocaleString()}</div>
        </Card>

        <Card className="p-5 border-l-4 border-l-accent-red">
          <div className="text-xs text-accent-red uppercase tracking-wider font-semibold mb-1">Immediate Action</div>
          <div className="text-3xl font-bold text-accent-red tracking-tight">{counts.immediate.toLocaleString()}</div>
        </Card>

        <Card className="p-5 border-l-4 border-l-accent-red">
          <div className="text-xs text-accent-red uppercase tracking-wider font-semibold mb-1">Hot</div>
          <div className="text-3xl font-bold text-accent-red tracking-tight">{counts.hot.toLocaleString()}</div>
        </Card>

        <Card className="p-5 border-l-4 border-l-accent-yellow">
          <div className="text-xs text-accent-yellow uppercase tracking-wider font-semibold mb-1">Warm</div>
          <div className="text-3xl font-bold text-accent-yellow tracking-tight">{counts.warm.toLocaleString()}</div>
        </Card>

        <Card className="p-5 border-l-4 border-l-accent-blue">
          <div className="text-xs text-accent-blue uppercase tracking-wider font-semibold mb-1">Cold</div>
          <div className="text-3xl font-bold text-accent-blue tracking-tight">{counts.cold.toLocaleString()}</div>
        </Card>

        <Card className="p-5 border-l-4 border-l-purple-500">
          <div className="text-xs text-purple-400 uppercase tracking-wider font-semibold mb-1">Skipped</div>
          <div className="text-3xl font-bold text-purple-400 tracking-tight">{counts.skipped.toLocaleString()}</div>
        </Card>

        <Card className="p-5 border-l-4 border-l-orange-500">
          <div className="text-xs text-orange-400 uppercase tracking-wider font-semibold mb-1">Wrong Number</div>
          <div className="text-3xl font-bold text-orange-400 tracking-tight">{counts.wrongNumber.toLocaleString()}</div>
        </Card>

        <Card className="p-5 border-l-4 border-l-purple-400">
          <div className="text-xs text-purple-400 uppercase tracking-wider font-semibold mb-1">Reverted</div>
          <div className="text-3xl font-bold text-purple-400 tracking-tight">{counts.reverted.toLocaleString()}</div>
        </Card>

        <Card className="p-5 border-l-4 border-l-accent-green">
          <div className="text-xs text-accent-green uppercase tracking-wider font-semibold mb-1">Closed</div>
          <div className="text-3xl font-bold text-accent-green tracking-tight">{counts.closed.toLocaleString()}</div>
        </Card>

        <Card className="p-5 border-l-4 border-l-red-500">
          <div className="text-xs text-red-400 uppercase tracking-wider font-semibold mb-1">Deleted</div>
          <div className="text-3xl font-bold text-red-500 tracking-tight">{counts.deleted.toLocaleString()}</div>
        </Card>
      </div>
    </div>
  );
}
