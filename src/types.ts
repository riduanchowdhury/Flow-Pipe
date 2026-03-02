export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string;
  assignee_id?: string;
  project_id?: string;
  parent_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
}
