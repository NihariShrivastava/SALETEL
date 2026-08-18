export interface AdminUser {
  id: string;
  username: string;
  created_at: string;
}


export interface Domain {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  created_at: string;
}

export interface UserRole {
  id: string;
  name: string;
  description: string | null;
}

export interface Counter {
  id: string;
  username: string;
  password_hash: string;
  location: string | null;
  created_at: string;
}

export type FieldType = 
  | 'text' | 'textarea' | 'number' | 'email' | 'phone' | 'date' 
  | 'time' | 'datetime' | 'select' | 'multiselect' | 'radio' 
  | 'checkbox' | 'file' | 'signature' | 'location' | 'rating' 
  | 'yes_no' | 'section_header' | 'paragraph_info';

export interface FieldConfig {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  order: number;
  options?: string[]; // For select, radio, multiselect, etc.
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
    customError?: string;
  };
  conditional?: {
    dependsOn: string;
    showWhen: string;
    operator: 'equals' | 'contains' | 'not_equals';
  };
  width: 'full' | 'half' | 'third';
  sectionId?: string;
}

export interface FormTemplate {
  id: string;
  domain_id: string;
  name: string;
  description: string | null;
  fields: FieldConfig[];
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface Surveyor {
  id: string;
  username: string;
  password_hash: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  domain_id: string | null;
  user_role_id: string | null;
  counter_ids: string[] | null;
  assigned_template_ids: string[] | null;
  team_lead_ids: string[] | null;
  telecaller_ids: string[] | null;
  assigned_users: string[] | null;
  location: string | null;
  is_active: boolean;
  created_at: string;
  assigned_domains?: string[];
}

export interface Submission {
  id: string;
  form_template_id: string | null;
  domain_id: string | null;
  surveyor_id: string | null;
  data: Record<string, any>;
  status: 'submitted' | 'reviewed' | 'approved' | 'rejected' | 'reverted';
  admin_notes: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  location_lat: number | null;
  location_lng: number | null;
  device_info: string | null;
}
