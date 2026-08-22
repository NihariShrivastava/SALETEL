const fs = require('fs');
let code = fs.readFileSync('src/pages/teamlead/TLCustomTemplateDashboard.tsx', 'utf-8');

// 1. imports
code = code.replace("import { useParams, useNavigate } from 'react-router-dom';", "import { useParams, useNavigate } from 'react-router-dom';\nimport { useAuth } from '../../contexts/AuthContext';");

// 2. add states
code = code.replace("const itemsPerPage = 20;", `const itemsPerPage = 20;

  const { user } = useAuth();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [telecallers, setTelecallers] = useState<any[]>([]);
  const [selectedTelecaller, setSelectedTelecaller] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);`);

// 3. fetchData
code = code.replace("const fetchData = async () => {", `const fetchData = async () => {
    if (!user?.assigned_users || user.assigned_users.length === 0) {
      setSubmissions([]);
      setIsLoading(false);
      return;
    }
`);

code = code.replace(`.eq('form_template_id', templateId)`, `.eq('form_template_id', templateId)
        .in('surveyor_id', user.assigned_users)`);

code = code.replace("setSubmissions(subData || []);", `setSubmissions(subData || []);
      
      if (user?.telecaller_ids && user.telecaller_ids.length > 0) {
        const { data: tcData } = await supabase.from('surveyors').select('id, full_name, username').in('id', user.telecaller_ids);
        setTelecallers(tcData || []);
      }`);

// 4. Update Header Buttons
code = code.replace('<Download className="w-4 h-4 mr-2" />', `<Download className="w-4 h-4 mr-2" />`);
code = code.replace('</Button>\n        </div>', `</Button>
          {selectedIds.size > 0 && (
            <Button onClick={() => setIsModalOpen(true)} className="bg-accent-blue hover:bg-accent-blue/90 text-white shadow-lg shadow-accent-blue/20">
              Transfer {selectedIds.size} Leads
            </Button>
          )}
        </div>`);

// 5. Update Table Header
code = code.replace('<th className="py-3 px-4 font-semibold">Date</th>', `<th className="py-3 px-4 font-semibold w-10">
                        <input 
                          type="checkbox" 
                          className="rounded border-bg-border bg-bg-primary text-accent-blue focus:ring-accent-blue"
                          checked={paginatedSubmissions.length > 0 && paginatedSubmissions.every(s => selectedIds.has(s.id))}
                          onChange={(e) => {
                            const newSet = new Set(selectedIds);
                            if (e.target.checked) {
                              paginatedSubmissions.forEach(s => newSet.add(s.id));
                            } else {
                              paginatedSubmissions.forEach(s => newSet.delete(s.id));
                            }
                            setSelectedIds(newSet);
                          }}
                        />
                      </th>
                      <th className="py-3 px-4 font-semibold">Date</th>`);

code = code.replace('<th className="py-3 px-4 font-semibold">Status</th>', `<th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold">Telecaller</th>`);

// 6. Update Table Body
code = code.replace('<td className="py-3 px-4 text-text-secondary text-xs">{new Date(sub.submitted_at).toLocaleString()}</td>', `
                          <td className="py-3 px-4">
                            <input 
                              type="checkbox" 
                              className="rounded border-bg-border bg-bg-primary text-accent-blue focus:ring-accent-blue"
                              checked={selectedIds.has(sub.id)}
                              onChange={(e) => {
                                const newSet = new Set(selectedIds);
                                if (e.target.checked) newSet.add(sub.id);
                                else newSet.delete(sub.id);
                                setSelectedIds(newSet);
                              }}
                            />
                          </td>
                          <td className="py-3 px-4 text-text-secondary text-xs">{new Date(sub.submitted_at).toLocaleString()}</td>`);

code = code.replace('</span>\n                          </td>', `</span>
                          </td>
                          <td className="py-3 px-4 text-text-secondary text-xs">
                            {sub.telecaller_id ? (telecallers.find(t => t.id === sub.telecaller_id)?.full_name || 'Assigned') : '-'}
                          </td>`);


// 7. Add Modal at the end
code = code.replace('</div>\n    </div>\n  );\n}\n', `</div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-2xl p-6">
            <h3 className="text-xl font-bold text-white mb-4">Transfer Leads to Telecaller</h3>
            <p className="text-text-secondary mb-6">Select a telecaller to assign the {selectedIds.size} selected leads. They will appear as 'New Leads' in their dashboard.</p>
            
            <div className="space-y-4 mb-6">
              <select
                value={selectedTelecaller}
                onChange={(e) => setSelectedTelecaller(e.target.value)}
                className="w-full bg-bg-primary border border-bg-border rounded-lg px-3 py-3 text-white focus:border-accent-blue focus:outline-none"
              >
                <option value="">Select Telecaller...</option>
                {telecallers.map(tc => (
                  <option key={tc.id} value={tc.id}>{tc.full_name || tc.username}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button 
                onClick={async () => {
                  if (!selectedTelecaller) return toast.error('Please select a telecaller');
                  setIsTransferring(true);
                  try {
                    const { error } = await supabase.from('submissions').update({
                      telecaller_id: selectedTelecaller,
                      lead_status: 'new',
                      lead_status_updated_at: new Date().toISOString()
                    }).in('id', Array.from(selectedIds));
                    
                    if (error) throw error;
                    toast.success('Leads transferred successfully!');
                    setIsModalOpen(false);
                    setSelectedIds(new Set());
                    fetchData();
                  } catch (e) {
                    toast.error('Failed to transfer leads');
                  } finally {
                    setIsTransferring(false);
                  }
                }}
                disabled={!selectedTelecaller || isTransferring}
                className="bg-accent-blue text-white"
              >
                {isTransferring ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Transfer'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
`);

fs.writeFileSync('src/pages/teamlead/TLCustomTemplateDashboard.tsx', code);
console.log('Done');
