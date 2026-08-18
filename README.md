# SALETEL - Data Collection Engine

SALETEL (formerly FieldSync) is a comprehensive, multi-role web portal designed to streamline field operations, data collection, inventory management, and operational reporting. Built for scale and operational efficiency, SALETEL enables real-time synchronization between on-ground surveyors, backend administrative teams, counters, team leads, and telecallers.

## Features

- **Admin Dashboard**: Gain full oversight of the entire operation. Manage surveyors, domains, and counters. Features a robust form template builder, submission auditing tools, and advanced master reporting exports.
- **Surveyor Portal**: A mobile-first, easy-to-use interface for field agents to fill out dynamic forms and track their submissions.
- **Counter Workstation**: Specialized dashboard for inventory handling, counter operations, and daily auditing.
- **Team Lead Portal**: Management interface for team leaders to track team performance, handle escalations, and review surveyor outputs.
- **Telecaller Portal**: Tools for telecallers to follow up on form submissions, verify data, and communicate with stakeholders.

## Tech Stack

- **Frontend**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
- **Routing**: [React Router DOM](https://reactrouter.com/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Backend/Database**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Data Visualization & Exporting**: [Recharts](https://recharts.org/), [XLSX (SheetJS)](https://sheetjs.com/)
- **State/Auth Management**: React Context API & LocalStorage (`saletel_user`, `saletel_role`)

## Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure Environment:
   Create a `.env` file in the root directory and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. Start the Development Server:
   ```bash
   npm run dev
   ```

4. Build for Production:
   ```bash
   npm run build
   ```

## Project Structure

- `/src/pages` - Role-specific pages (admin, surveyor, counter, teamlead, telecaller)
- `/src/components` - Shared reusable React components (layouts, UI elements)
- `/src/contexts` - Context providers for Auth and App-wide state
- `/src/lib` - Utility functions and Supabase client configuration
- `/src/types` - TypeScript interfaces and type definitions
- `schema.sql` / `migration.sql` - Database schema definitions for Supabase

## License

This project is proprietary and confidential.
