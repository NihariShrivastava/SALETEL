import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { FileText, CheckCircle2, Clock, Users, Loader2, Briefcase, PhoneCall } from 'lucide-react';
import toast from 'react-hot-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '../../lib/supabase';
import { format, isToday } from 'date-fns';

const COLORS = ['#4f6ef7', '#22c55e', '#eab308', '#06b6d4', '#a855f7', '#f97316'];

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, activeSurveyors: 0, totalTeamLead: 0, totalTelecaller: 0 });
  const [lineData, setLineData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [subsRes, surveyorsRes, rolesRes] = await Promise.all([
          supabase.from('submissions').select('*, surveyors!surveyor_id(full_name), domains(name)').order('submitted_at', { ascending: false }),
          supabase.from('surveyors').select('user_role_id').eq('is_active', true),
          supabase.from('user_roles').select('id, name')
        ]);

        if (subsRes.error) throw subsRes.error;
        if (surveyorsRes.error) throw surveyorsRes.error;
        if (rolesRes.error) throw rolesRes.error;

        const subs = subsRes.data || [];
        
        // Calculate Top Stats
        
        // Map for charts
        const dateMap: Record<string, number> = {};
        const domainMap: Record<string, number> = {};

        subs.forEach(sub => {
          
          const date = new Date(sub.submitted_at);

          // Line Chart aggregation
          const dateStr = format(date, 'MMM dd');
          dateMap[dateStr] = (dateMap[dateStr] || 0) + 1;

          // Pie Chart aggregation
          const domainName = sub.domains?.name || 'Unassigned';
          domainMap[domainName] = (domainMap[domainName] || 0) + 1;
        });

        const rolesMap: Record<string, string> = {};
        (rolesRes.data || []).forEach(r => rolesMap[r.id] = r.name);

        let activeSurveyors = 0;
        let totalTeamLead = 0;
        let totalTelecaller = 0;

        (surveyorsRes.data || []).forEach(s => {
          const roleName = rolesMap[s.user_role_id];
          if (roleName === 'Surveyor') activeSurveyors++;
          if (roleName === 'Team Lead') totalTeamLead++;
          if (roleName === 'Telecaller') totalTelecaller++;
        });

        setStats({
          total: subs.length,
          activeSurveyors,
          totalTeamLead,
          totalTelecaller
        });

        // Format Line Data (reverse to show chronological order)
        const formattedLineData = Object.entries(dateMap)
          .map(([name, submissions]) => ({ name, submissions }))
          .reverse();
        setLineData(formattedLineData);

        // Format Pie Data
        const formattedPieData = Object.entries(domainMap)
          .map(([name, value]) => ({ name, value }));
        setPieData(formattedPieData);

        // Set Recent
        setRecentSubmissions(subs.slice(0, 10));

      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Dashboard Overview</h2>
          <p className="text-text-secondary text-sm mt-1">Real-time metrics and submission activity.</p>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Submissions', value: stats.total.toString(), icon: FileText, color: 'text-accent-blue', bg: 'bg-accent-blue/10' },
          { label: 'Active Surveyors', value: stats.activeSurveyors.toString(), icon: Users, color: 'text-accent-purple', bg: 'bg-accent-purple/10' },
          { label: 'Total Team Lead', value: stats.totalTeamLead.toString(), icon: Briefcase, color: 'text-accent-yellow', bg: 'bg-accent-yellow/10' },
          { label: 'Total Telecaller', value: stats.totalTelecaller.toString(), icon: PhoneCall, color: 'text-accent-green', bg: 'bg-accent-green/10' },
        ].map((stat, i) => (
          <Card key={i} className="flex items-center p-5">
            <div className={`p-3 rounded-lg ${stat.bg} mr-4`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-text-muted font-semibold">{stat.label}</p>
              <h4 className="text-2xl font-bold text-white mt-1 leading-none">{stat.value}</h4>
            </div>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Submissions Over Time" className="lg:col-span-2 h-[350px] flex flex-col">
          <div className="flex-1 mt-4">
            {lineData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#252840" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1d2e', borderColor: '#252840', color: '#fff', borderRadius: '8px' }}
                    itemStyle={{ color: '#4f6ef7' }}
                  />
                  <Line type="monotone" dataKey="submissions" stroke="#4f6ef7" strokeWidth={3} dot={{ r: 4, fill: '#4f6ef7', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-text-muted italic border-2 border-dashed border-bg-border rounded-xl">
                No submission data available
              </div>
            )}
          </div>
        </Card>
        <Card title="Submissions by Domain" className="h-[350px] flex flex-col">
          <div className="flex-1 mt-4">
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="80%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1a1d2e', borderColor: '#252840', color: '#fff', borderRadius: '8px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {pieData.map((entry, index) => (
                    <div key={index} className="flex items-center text-xs">
                      <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-text-secondary truncate">{entry.name} ({entry.value})</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-text-muted italic border-2 border-dashed border-bg-border rounded-xl">
                No domain data available
              </div>
            )}
          </div>
        </Card>
    </div>
      
      {/* Recent Submissions */}
      <Card className="overflow-hidden p-0">
        <div className="p-5 border-b border-bg-border flex justify-between items-center">
          <div>
            <h3 className="text-sm font-semibold text-white">Recent Submissions</h3>
            <p className="text-xs text-text-secondary mt-1">Latest data from the field.</p>
          </div>
          <button className="text-xs text-accent-blue hover:text-accent-purple font-medium">View All &rarr;</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm min-w-[600px]">
            <thead>
              <tr className="bg-bg-primary/50 text-text-muted text-[10px] uppercase tracking-widest border-b border-bg-border">
                <th className="py-3 px-5 font-semibold">Surveyor</th>
                <th className="py-3 px-5 font-semibold">Domain</th>
                <th className="py-3 px-5 font-semibold">Date</th>
                <th className="py-3 px-5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentSubmissions.length > 0 ? recentSubmissions.map((sub, i) => (
                <tr key={i} className="border-b border-bg-border last:border-0 hover:bg-bg-hover/50 transition-colors">
                  <td className="py-3 px-5 text-white font-medium">{sub.surveyors?.full_name || 'Unknown'}</td>
                  <td className="py-3 px-5 text-text-secondary">{sub.domains?.name || '-'}</td>
                  <td className="py-3 px-5 text-text-secondary">{format(new Date(sub.submitted_at), 'MMM dd, hh:mm a')}</td>
                  <td className="py-3 px-5">
                    <Badge variant={
                      sub.status === 'submitted' ? 'blue' :
                      sub.status === 'approved' ? 'green' :
                      sub.status === 'rejected' ? 'red' : 'yellow'
                    }>
                      {sub.status}
                    </Badge>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-text-muted italic">
                    No recent submissions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
