import { createServer } from 'vite';

async function testImports() {
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom'
  });

  try {
    const module = await server.ssrLoadModule('/src/pages/admin/MasterReports.tsx');
    console.log('MasterReports loaded successfully');
  } catch (e) {
    console.error('MasterReports ERROR:', e);
  }
  
  try {
    const module = await server.ssrLoadModule('/src/pages/admin/Dashboard.tsx');
    console.log('Dashboard loaded successfully');
  } catch (e) {
    console.error('Dashboard ERROR:', e);
  }

  try {
    const module = await server.ssrLoadModule('/src/App.tsx');
    console.log('App loaded successfully');
  } catch (e) {
    console.error('App ERROR:', e);
  }

  await server.close();
  process.exit(0);
}

testImports();
