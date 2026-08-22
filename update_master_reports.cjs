const fs = require('fs');

let code = fs.readFileSync('src/pages/admin/MasterReports.tsx', 'utf-8');

// 1. Interfaces
code = code.replace(
  'interface TeamLeadData {\n  name: string;\n  approvals: number;\n  reverts: number;\n}',
  `interface TeamLeadData {\n  name: string;\n  approvals: number;\n  reverts: number;\n}\n\ninterface TelecallerData {\n  name: string;\n  assigned: number;\n  newLeads: number;\n  immediate: number;\n  hot: number;\n  warm: number;\n  cold: number;\n  skipped: number;\n  wrongNumber: number;\n}`
);

// 2. State
code = code.replace(
  'const [dataTeamLeads, setDataTeamLeads] = useState<TeamLeadData[]>([]);',
  'const [dataTeamLeads, setDataTeamLeads] = useState<TeamLeadData[]>([]);\n  const [dataTelecallers, setDataTelecallers] = useState<TelecallerData[]>([]);'
);

// 3. Icons import
code = code.replace(
  'PieChart, FileText } from \'lucide-react\';',
  'PieChart, FileText, PhoneCall } from \'lucide-react\';'
);

// 4. In fetchData, fetch telecaller ids
code = code.replace(
  `      const tlNameMap = new Map<string, string>();
      if (tlIdsToFetch.size > 0) {
        const { data: tlData } = await supabase.from('surveyors').select('id, full_name').in('id', Array.from(tlIdsToFetch));
        tlData?.forEach(tl => tlNameMap.set(tl.id, tl.full_name));
      }`,
  `      const tlNameMap = new Map<string, string>();
      if (tlIdsToFetch.size > 0) {
        const { data: tlData } = await supabase.from('surveyors').select('id, full_name').in('id', Array.from(tlIdsToFetch));
        tlData?.forEach(tl => tlNameMap.set(tl.id, tl.full_name));
      }

      const tcIdsToFetch = new Set<string>();
      submissions.forEach(sub => {
        if (sub.telecaller_id) tcIdsToFetch.add(sub.telecaller_id);
      });
      const tcNameMap = new Map<string, string>();
      if (tcIdsToFetch.size > 0) {
        const { data: tcData } = await supabase.from('surveyors').select('id, full_name').in('id', Array.from(tcIdsToFetch));
        tcData?.forEach(tc => tcNameMap.set(tc.id, tc.full_name));
      }`
);

// 5. In fetchData, processing loop
code = code.replace(
  `      const teamLeadMap: Record<string, TeamLeadData> = {};`,
  `      const teamLeadMap: Record<string, TeamLeadData> = {};\n      const telecallerMap: Record<string, TelecallerData> = {};`
);

code = code.replace(
  `          if (sub.status === 'reverted') teamLeadMap[sub.reviewed_by].reverts += 1;
        }`,
  `          if (sub.status === 'reverted') teamLeadMap[sub.reviewed_by].reverts += 1;
        }

        if (sub.telecaller_id) {
          if (!telecallerMap[sub.telecaller_id]) {
            telecallerMap[sub.telecaller_id] = {
              name: tcNameMap.get(sub.telecaller_id) || 'Unknown Telecaller',
              assigned: 0, newLeads: 0, immediate: 0, hot: 0, warm: 0, cold: 0, skipped: 0, wrongNumber: 0
            };
          }
          const tMap = telecallerMap[sub.telecaller_id];
          tMap.assigned += 1;
          
          let ls = sub.lead_status || 'new';
          // Today check for skipped
          const today = new Date();
          today.setHours(0,0,0,0);
          if (ls === 'skipped' && sub.lead_status_updated_at) {
            if (new Date(sub.lead_status_updated_at) < today) ls = 'new';
          }

          if (ls === 'new') tMap.newLeads += 1;
          else if (ls === 'immediate') tMap.immediate += 1;
          else if (ls === 'hot') tMap.hot += 1;
          else if (ls === 'warm') tMap.warm += 1;
          else if (ls === 'cold') tMap.cold += 1;
          else if (ls === 'skipped') tMap.skipped += 1;
          else if (ls === 'wrong_number') tMap.wrongNumber += 1;
        }`
);

// 6. Set data
code = code.replace(
  `      setDataTeamLeads(Object.values(teamLeadMap).sort((a,b) => (b.approvals + b.reverts) - (a.approvals + a.reverts)));`,
  `      setDataTeamLeads(Object.values(teamLeadMap).sort((a,b) => (b.approvals + b.reverts) - (a.approvals + a.reverts)));\n      setDataTelecallers(Object.values(telecallerMap).sort((a,b) => b.assigned - a.assigned));`
);

// 7. Tabs definition
code = code.replace(
  `{ id: 'teamlead', label: 'By Team Lead', icon: Users }`,
  `{ id: 'teamlead', label: 'By Team Lead', icon: Users },\n        { id: 'telecaller', label: 'Telecaller Performance', icon: PhoneCall }`
);

// 8. Chart rendering
const chartReplaceTarget = `              ) : activeTab === 'teamlead' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataTeamLeads} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#252840" horizontal={false} />
                    <XAxis type="number" stroke="#64748b" fontSize={12} />
                    <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={12} width={100} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1a1d2e', borderColor: '#252840', color: '#fff', borderRadius: '8px' }}
                      cursor={{ fill: '#1e2235' }}
                    />
                    <Legend />
                    <Bar dataKey="approvals" fill="#22c55e" name="Approved" />
                    <Bar dataKey="reverts" fill="#eab308" name="Reverted" />
                  </BarChart>
                </ResponsiveContainer>
              ) : null}`;

const chartReplaceWith = `              ) : activeTab === 'teamlead' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataTeamLeads} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#252840" horizontal={false} />
                    <XAxis type="number" stroke="#64748b" fontSize={12} />
                    <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={12} width={100} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1a1d2e', borderColor: '#252840', color: '#fff', borderRadius: '8px' }}
                      cursor={{ fill: '#1e2235' }}
                    />
                    <Legend />
                    <Bar dataKey="approvals" fill="#22c55e" name="Approved" />
                    <Bar dataKey="reverts" fill="#eab308" name="Reverted" />
                  </BarChart>
                </ResponsiveContainer>
              ) : activeTab === 'telecaller' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataTelecallers} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#252840" horizontal={false} />
                    <XAxis type="number" stroke="#64748b" fontSize={12} />
                    <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={12} width={100} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1a1d2e', borderColor: '#252840', color: '#fff', borderRadius: '8px' }}
                      cursor={{ fill: '#1e2235' }}
                    />
                    <Legend />
                    <Bar dataKey="immediate" stackId="a" fill="#ef4444" name="Immediate" />
                    <Bar dataKey="hot" stackId="a" fill="#f87171" name="Hot" />
                    <Bar dataKey="warm" stackId="a" fill="#f97316" name="Warm" />
                    <Bar dataKey="cold" stackId="a" fill="#3b82f6" name="Cold" />
                    <Bar dataKey="newLeads" stackId="a" fill="#22c55e" name="New" />
                    <Bar dataKey="skipped" stackId="a" fill="#a855f7" name="Skipped" />
                    <Bar dataKey="wrongNumber" stackId="a" fill="#64748b" name="Wrong No." />
                  </BarChart>
                </ResponsiveContainer>
              ) : null}`;

code = code.replace(chartReplaceTarget, chartReplaceWith);


// 9. Sidebar list rendering
const sidebarReplaceTarget = `                  {!isLoading && activeTab === 'teamlead' && dataTeamLeads.map((d, i) => (
                    <tr key={i} className="border-b border-bg-border last:border-0 hover:bg-bg-hover/50">
                      <td className="py-3 px-4 text-white font-medium">{d.name}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex flex-col items-end gap-1 text-[11px] font-mono">
                           <span className="text-accent-green bg-accent-green/10 px-2 rounded w-full text-right">{d.approvals} A</span>
                           <span className="text-accent-yellow bg-accent-yellow/10 px-2 rounded w-full text-right">{d.reverts} REV</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!isLoading && activeTab !== 'master' && `;

const sidebarReplaceWith = `                  {!isLoading && activeTab === 'teamlead' && dataTeamLeads.map((d, i) => (
                    <tr key={i} className="border-b border-bg-border last:border-0 hover:bg-bg-hover/50">
                      <td className="py-3 px-4 text-white font-medium">{d.name}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex flex-col items-end gap-1 text-[11px] font-mono">
                           <span className="text-accent-green bg-accent-green/10 px-2 rounded w-full text-right">{d.approvals} A</span>
                           <span className="text-accent-yellow bg-accent-yellow/10 px-2 rounded w-full text-right">{d.reverts} REV</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!isLoading && activeTab === 'telecaller' && dataTelecallers.map((d, i) => (
                    <tr key={i} className="border-b border-bg-border last:border-0 hover:bg-bg-hover/50">
                      <td className="py-3 px-4 text-white font-medium">{d.name}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex flex-col items-end gap-1 text-[11px] font-mono">
                           <span className="text-white bg-bg-secondary px-2 rounded w-full text-right">{d.assigned} Total</span>
                           <span className="text-accent-red bg-accent-red/10 px-2 rounded w-full text-right">{d.immediate + d.hot} Hot/Imm</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!isLoading && activeTab !== 'master' && `;

code = code.replace(sidebarReplaceTarget, sidebarReplaceWith);

// 10. Update Export Excel
const exportReplaceTarget = `      } else if (activeTab === 'teamlead') {
        dataToExport = dataTeamLeads.map(d => ({ 'Team Lead': d.name, Approvals: d.approvals, Reverts: d.reverts }));
        sheetName = 'By Team Lead';
      } else {`;

const exportReplaceWith = `      } else if (activeTab === 'teamlead') {
        dataToExport = dataTeamLeads.map(d => ({ 'Team Lead': d.name, Approvals: d.approvals, Reverts: d.reverts }));
        sheetName = 'By Team Lead';
      } else if (activeTab === 'telecaller') {
        dataToExport = dataTelecallers.map(d => ({ 
          'Telecaller': d.name, 
          'Total Assigned': d.assigned,
          'New': d.newLeads,
          'Immediate': d.immediate,
          'Hot': d.hot,
          'Warm': d.warm,
          'Cold': d.cold,
          'Skipped': d.skipped,
          'Wrong Number': d.wrongNumber
        }));
        sheetName = 'By Telecaller';
      } else {`;

code = code.replace(exportReplaceTarget, exportReplaceWith);

// 11. Fix "No data available" check
const noDataReplaceTarget = `                    (activeTab === 'teamlead' && dataTeamLeads.length === 0)) && (`;
const noDataReplaceWith = `                    (activeTab === 'teamlead' && dataTeamLeads.length === 0) ||
                    (activeTab === 'telecaller' && dataTelecallers.length === 0)) && (`;

code = code.replace(noDataReplaceTarget, noDataReplaceWith);

fs.writeFileSync('src/pages/admin/MasterReports.tsx', code);
console.log('Done modifying MasterReports.tsx');
