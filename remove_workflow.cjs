const fs = require('fs');

// 1. TeamLeadDashboard.tsx
let tlCode = fs.readFileSync('src/pages/teamlead/TeamLeadDashboard.tsx', 'utf-8');
tlCode = tlCode.replace(/ *const \[activeTab, setActiveTab\] = useState.*?\n/g, '');
tlCode = tlCode.replace(/ *const handleUpdateStatus = async[\s\S]*?\} catch \(err: any\) \{[\s\S]*?toast\.error.*?\n *\}[\s\S]*?\n *};\n/g, '');
tlCode = tlCode.replace(/ *const pendingSubs = submissions\.filter.*?\n/g, '');
tlCode = tlCode.replace(/ *const reviewedSubs = submissions\.filter.*?\n/g, '');
tlCode = tlCode.replace(/ *const displaySubs = activeTab === .*?\n/g, '');
tlCode = tlCode.replace(/ *<div className="flex gap-2 border-b border-bg-border pb-px overflow-x-auto hide-scrollbar">[\s\S]*?<\/div>\n/g, '');
tlCode = tlCode.replace(/ *\{activeTab === 'leads' \? \(\n/g, '');
tlCode = tlCode.replace(/ *\) : \([\s\S]*?<Card className="p-0 overflow-hidden">[\s\S]*?<\/Card>\n *\)\}/g, '');
// Handle the selectedSub modal (which had revert/approve buttons)
tlCode = tlCode.replace(/ *\{selectedSub && activeTab !== 'leads' && \([\s\S]*?<\/div>\n *\)\}/g, '');
fs.writeFileSync('src/pages/teamlead/TeamLeadDashboard.tsx', tlCode);
console.log('TeamLeadDashboard updated');

// 2. Submissions.tsx
let subCode = fs.readFileSync('src/pages/admin/Submissions.tsx', 'utf-8');
subCode = subCode.replace(/ *const handleUpdateStatus = async[\s\S]*?\} catch \(err\) \{[\s\S]*?toast\.error.*?\n *\}\n *};\n/g, '');
// Remove Approve/Revert options from status filter
subCode = subCode.replace(/ *<option value="approved">Approved<\/option>\n/g, '');
subCode = subCode.replace(/ *<option value="reverted">Reverted<\/option>\n/g, '');
// Remove badges logic
subCode = subCode.replace(/ *case 'approved': return <Badge variant="green">Approved<\/Badge>;\n/g, '');
subCode = subCode.replace(/ *case 'reverted': return <Badge variant="yellow">Reverted<\/Badge>;\n/g, '');
// Remove footer buttons in selectedSub modal
subCode = subCode.replace(/ *<div className="p-4 border-t border-bg-border flex justify-end gap-3 bg-bg-secondary shrink-0">[\s\S]*?<\/div>\n/g, '');
fs.writeFileSync('src/pages/admin/Submissions.tsx', subCode);
console.log('Submissions updated');

// 3. Dashboard.tsx
let dashCode = fs.readFileSync('src/pages/admin/Dashboard.tsx', 'utf-8');
dashCode = dashCode.replace(/, pending: 0, approvedToday: 0/, '');
dashCode = dashCode.replace(/ *let pending = 0;\n *let approvedToday = 0;\n/g, '');
dashCode = dashCode.replace(/ *if \(sub\.status === 'submitted'\) pending\+\+;\n/g, '');
dashCode = dashCode.replace(/ *if \(sub\.status === 'approved' && isToday\(date\)\) approvedToday\+\+;\n/g, '');
dashCode = dashCode.replace(/ *pending,\n *approvedToday,\n/g, '');
dashCode = dashCode.replace(/ *\{ label: 'Pending Review'.*?\n/g, '');
dashCode = dashCode.replace(/ *\{ label: 'Approved Today'.*?\n/g, '');
fs.writeFileSync('src/pages/admin/Dashboard.tsx', dashCode);
console.log('Dashboard updated');

// 4. SurveyorHistory.tsx
let histCode = fs.readFileSync('src/pages/surveyor/SurveyorHistory.tsx', 'utf-8');
histCode = histCode.replace(/ *const \[activeTab, setActiveTab\] = useState.*?\n/g, '');
// Remove filtering
histCode = histCode.replace(/ *\} else if \(activeTab === 'pending'\) \{[\s\S]*?\} else if \(activeTab === 'reverted'\) \{[\s\S]*?\} else if \(activeTab === 'approved'\) \{[\s\S]*?\}\n/g, '');
// Remove tab UI
histCode = histCode.replace(/ *<div className="flex border-b border-bg-border mb-6">[\s\S]*?<\/div>\n/g, '');
// Remove badge colors related to approved/reverted
// We'll leave the badge rendering to just show the status directly
histCode = histCode.replace(/ *sub\.status === 'approved' \? 'green' :[\s\S]*?sub\.status === 'reverted' \? 'yellow' : 'gray'/g, "sub.status === 'submitted' ? 'blue' : 'gray'");
histCode = histCode.replace(/ *\{sub\.status === 'reverted' \? 'Reverted' : sub\.status\}/g, "{sub.status}");
histCode = histCode.replace(/ *selectedSub\.status === 'approved' \? 'green' :[\s\S]*?selectedSub\.status === 'reverted' \? 'yellow' : 'gray'/g, "selectedSub.status === 'submitted' ? 'blue' : 'gray'");
histCode = histCode.replace(/ *\{selectedSub\.status === 'reverted' \? 'Reverted' : selectedSub\.status\}/g, "{selectedSub.status}");
fs.writeFileSync('src/pages/surveyor/SurveyorHistory.tsx', histCode);
console.log('SurveyorHistory updated');

// 5. SurveyorDashboard.tsx
let survDash = fs.readFileSync('src/pages/surveyor/SurveyorDashboard.tsx', 'utf-8');
survDash = survDash.replace(/ *const \[activeTab, setActiveTab\] = useState.*?\n/g, '');
// Remove filtering
survDash = survDash.replace(/ *\} else if \(activeTab === 'pending'\) \{[\s\S]*?\} else if \(activeTab === 'reverted'\) \{[\s\S]*?\} else if \(activeTab === 'approved'\) \{[\s\S]*?\}\n/g, '');
// Remove tab UI
survDash = survDash.replace(/ *<div className="flex gap-2 border-b border-bg-border pb-px mb-6 overflow-x-auto hide-scrollbar">[\s\S]*?<\/div>\n/g, '');
// Badges
survDash = survDash.replace(/ *sub\.status === 'approved' \? 'green' :[\s\S]*?sub\.status === 'reverted' \? 'yellow' : 'gray'/g, "sub.status === 'submitted' ? 'blue' : 'gray'");
survDash = survDash.replace(/ *\{sub\.status === 'reverted' \? 'Reverted' : sub\.status\}/g, "{sub.status}");
survDash = survDash.replace(/ *selectedSub\.status === 'approved' \? 'green' :[\s\S]*?selectedSub\.status === 'reverted' \? 'yellow' : 'gray'/g, "selectedSub.status === 'submitted' ? 'blue' : 'gray'");
survDash = survDash.replace(/ *\{selectedSub\.status === 'reverted' \? 'Reverted' : selectedSub\.status\}/g, "{selectedSub.status}");
fs.writeFileSync('src/pages/surveyor/SurveyorDashboard.tsx', survDash);
console.log('SurveyorDashboard updated');

// 6. MasterReports.tsx
let reportsCode = fs.readFileSync('src/pages/admin/MasterReports.tsx', 'utf-8');
reportsCode = reportsCode.replace(/ *interface TeamLeadData \{[\s\S]*?\}\n\n/g, '');
reportsCode = reportsCode.replace(/ *const \[dataTeamLeads, setDataTeamLeads\] = useState<TeamLeadData\[\]>\(\[\]\);\n/g, '');
reportsCode = reportsCode.replace(/ *approvals: number;\n *reverts: number;\n/g, ''); // Wait, I already removed interface.
reportsCode = reportsCode.replace(/ *approved: number;\n *reverted: number;\n *pending: number;\n/g, '');
reportsCode = reportsCode.replace(/ *const teamLeadMap: Record<string, TeamLeadData> = \{\};\n/g, '');
// In the map creation
reportsCode = reportsCode.replace(/, approved: 0, reverted: 0, pending: 0/g, '');
reportsCode = reportsCode.replace(/ *if \(sub\.status === 'approved'\) survMap\[sName\]\.approved \+= 1;\n *else if \(sub\.status === 'reverted'\) survMap\[sName\]\.reverted \+= 1;\n *else survMap\[sName\]\.pending \+= 1;\n/g, '');

reportsCode = reportsCode.replace(/ *if \(sub\.reviewed_by && sub\.status !== 'submitted'\) \{[\s\S]*?reverts \+= 1;\n *\}/g, '');
reportsCode = reportsCode.replace(/ *setDataTeamLeads.*?;\n/g, '');
reportsCode = reportsCode.replace(/ *\{ id: 'teamlead', label: 'By Team Lead', icon: Users \},\n/g, '');
reportsCode = reportsCode.replace(/ *\) : activeTab === 'teamlead' \? \([\s\S]*?<\/ResponsiveContainer>\n/g, '');
reportsCode = reportsCode.replace(/ *\{\!isLoading && activeTab === 'teamlead' && dataTeamLeads\.map[\s\S]*?REV<\/span>\n *<\/div>\n *<\/td>\n *<\/tr>\n *\)\)\}\n/g, '');
reportsCode = reportsCode.replace(/ *\} else if \(activeTab === 'person'\) \{\n *dataToExport = dataSurveyors\.map\(d => \(\{ Surveyor: d\.name, Role: d\.role, Submissions: d\.submissions, Approved: d\.approved, Reverted: d\.reverted, Pending: d\.pending \}\)\);\n/g, 
"      } else if (activeTab === 'person') {\n        dataToExport = dataSurveyors.map(d => ({ Surveyor: d.name, Role: d.role, Submissions: d.submissions }));\n");
reportsCode = reportsCode.replace(/ *\} else if \(activeTab === 'teamlead'\) \{[\s\S]*?sheetName = 'By Team Lead';\n/g, '');
reportsCode = reportsCode.replace(/ *\(activeTab === 'teamlead' && dataTeamLeads\.length === 0\) \|\|\n/g, '');
fs.writeFileSync('src/pages/admin/MasterReports.tsx', reportsCode);
console.log('MasterReports updated');
