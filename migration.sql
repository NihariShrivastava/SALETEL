-- 1. Ensure 'roles' is renamed to 'domains'
DO $$
BEGIN
  IF EXISTS (SELECT * FROM information_schema.tables WHERE table_name = 'roles') THEN
    ALTER TABLE roles RENAME TO domains;
  END IF;
END $$;

-- 2. Ensure 'role_id' is renamed to 'domain_id' in form_templates
DO $$
BEGIN
  IF EXISTS (SELECT * FROM information_schema.columns WHERE table_name='form_templates' and column_name='role_id') THEN
    ALTER TABLE form_templates RENAME COLUMN role_id TO domain_id;
  END IF;
END $$;

-- 3. Ensure 'role_id' is renamed to 'domain_id' in submissions
DO $$
BEGIN
  IF EXISTS (SELECT * FROM information_schema.columns WHERE table_name='submissions' and column_name='role_id') THEN
    ALTER TABLE submissions RENAME COLUMN role_id TO domain_id;
  END IF;
END $$;

-- 4. Ensure 'role_id' is renamed to 'domain_id' in surveyors
DO $$
BEGIN
  IF EXISTS (SELECT * FROM information_schema.columns WHERE table_name='surveyors' and column_name='role_id') THEN
    ALTER TABLE surveyors RENAME COLUMN role_id TO domain_id;
  END IF;
END $$;

-- 5. Ensure 'assigned_roles' is renamed to 'assigned_domains'
DO $$
BEGIN
  IF EXISTS (SELECT * FROM information_schema.columns WHERE table_name='surveyors' and column_name='assigned_roles') THEN
    ALTER TABLE surveyors RENAME COLUMN assigned_roles TO assigned_domains;
  END IF;
END $$;

-- 6. Drop incorrect 'counter_id' column if it was created (our app expects counter_ids array)
DO $$
BEGIN
  IF EXISTS (SELECT * FROM information_schema.columns WHERE table_name='surveyors' and column_name='counter_id') THEN
    ALTER TABLE surveyors DROP COLUMN counter_id;
  END IF;
END $$;

-- 7. Add correct columns if they are missing
ALTER TABLE surveyors ADD COLUMN IF NOT EXISTS counter_ids uuid[] DEFAULT '{}';
ALTER TABLE surveyors ADD COLUMN IF NOT EXISTS assigned_domains uuid[] DEFAULT '{}';
ALTER TABLE surveyors ADD COLUMN IF NOT EXISTS assigned_template_ids uuid[] DEFAULT '{}';
ALTER TABLE surveyors ADD COLUMN IF NOT EXISTS team_lead_ids uuid[] DEFAULT '{}';
ALTER TABLE surveyors ADD COLUMN IF NOT EXISTS telecaller_ids uuid[] DEFAULT '{}';
ALTER TABLE surveyors ADD COLUMN IF NOT EXISTS assigned_users uuid[] DEFAULT '{}';

-- 8. Add user_role_id if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT * FROM information_schema.columns WHERE table_name='surveyors' and column_name='user_role_id') THEN
    ALTER TABLE surveyors ADD COLUMN user_role_id uuid REFERENCES user_roles(id);
  END IF;
END $$;
