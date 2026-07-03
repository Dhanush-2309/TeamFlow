const API_BASE_URL = 'http://localhost:4000/api';

// Types mapping frontend structures
export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  theme?: 'light' | 'dark';
  email_opt_out?: boolean;
}

export interface Task {
  id: string;
  project_id: string;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  status: 'backlog' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignee_id: string | null;
  due_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  relations?: TaskRelation[];
}

export interface TaskRelation {
  relation_id: string;
  relation_type: 'blocks' | 'blocked_by';
  id: string; // related task id
  title: string;
  status: string;
  project_id: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  role?: 'owner' | 'member';
  view_preference?: 'kanban' | 'calendar' | 'list';
}

export interface ProjectMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'member';
}

export interface RCA {
  id: string;
  project_id: string;
  task_id: string | null;
  title: string;
  severity: 'SEV-1' | 'SEV-2' | 'SEV-3';
  status: 'draft' | 'submitted' | 'in_review' | 'approved' | 'rejected' | 'closed';
  created_by: string;
  created_at: string;
  submitted_at: string | null;
  closed_at: string | null;
  sections?: RCASection[];
  reviews?: RCAReview[];
}

export interface RCASection {
  id: string;
  rca_id: string;
  section_type: 'timeline' | 'contributing_factors' | 'corrective_actions' | 'preventive_measures';
  content: string;
  updated_at: string;
}

export interface RCAReview {
  id: string;
  rca_id: string;
  reviewer_id: string;
  decision: 'approved' | 'rejected' | null;
  comment: string | null;
  assigned_at: string;
  decided_at: string | null;
  reviewer_name: string;
  reviewer_email?: string;
}

export interface Comment {
  id: string;
  task_id: string | null;
  rca_id: string | null;
  author_id: string;
  author_name: string;
  body: string;
  mentioned_user_ids: string[];
  created_at: string;
}

export interface Attachment {
  id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  uploaded_by: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  channel: 'in_app' | 'email';
  message: string;
  read: boolean;
  delivered_at: string | null;
  created_at: string;
}

export interface DashboardStats {
  completion_rate: number;
  tasks_by_status: { status: string; count: number }[];
  workload_per_assignee: { user_id: string; name: string; active_tasks: number }[];
  velocity_trend: { week: string; completed: number }[];
  rca_by_status: { status: string; count: number }[];
  project_health: 'healthy' | 'at_risk' | 'no_data';
}

async function request(path: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('teamflow_token') : null;
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || 'API Request failed');
  }

  if (res.status === 204) return null;
  return res.json();
}

export const apiClient = {
  // Authentication
  getToken: () => typeof window !== 'undefined' ? localStorage.getItem('teamflow_token') : null,
  getCurrentUserId: () => typeof window !== 'undefined' ? localStorage.getItem('teamflow_current_user_id') : null,

  async login(email: string, password = 'password') {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('teamflow_token', data.token);
    localStorage.setItem('teamflow_current_user_id', data.user.id);
    return data.user as User;
  },

  async register(name: string, email: string, password: string) {
    const data = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    localStorage.setItem('teamflow_token', data.token);
    localStorage.setItem('teamflow_current_user_id', data.user.id);
    return data.user as User;
  },

  logout() {
    localStorage.removeItem('teamflow_token');
    localStorage.removeItem('teamflow_current_user_id');
  },

  async me() {
    return request('/users/me') as Promise<User>;
  },

  async updateMe(data: { theme?: 'light' | 'dark'; email_opt_out?: boolean }) {
    return request('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }) as Promise<User>;
  },

  async listAllUsers(q: string = '') {
    return request(`/users?q=${encodeURIComponent(q)}`) as Promise<{ id: string; name: string; email: string }[]>;
  },

  async searchProjectUsers(projectId: string, q: string = '') {
    return request(`/users/search?project_id=${projectId}&q=${encodeURIComponent(q)}`) as Promise<
      { id: string; name: string; email: string }[]
    >;
  },

  // Projects
  async listProjects() {
    return request('/projects') as Promise<Project[]>;
  },

  async createProject(name: string, description: string = '') {
    return request('/projects', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    }) as Promise<Project>;
  },

  async getProject(projectId: string) {
    return request(`/projects/${projectId}`) as Promise<Project & { membership: { role: string; view_preference: string } }>;
  },

  async listMembers(projectId: string) {
    return request(`/projects/${projectId}/members`) as Promise<ProjectMember[]>;
  },

  async addMember(projectId: string, userId: string, role: 'owner' | 'member' = 'member') {
    return request(`/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, role }),
    }) as Promise<ProjectMember>;
  },

  async updateViewPreference(projectId: string, view: 'kanban' | 'calendar' | 'list') {
    return request(`/projects/${projectId}/view-preference`, {
      method: 'PATCH',
      body: JSON.stringify({ view_preference: view }),
    });
  },

  // Tasks
  async listTasks(projectId: string, filters: Record<string, string> = {}) {
    const qs = new URLSearchParams({ project_id: projectId, ...filters }).toString();
    return request(`/tasks?${qs}`) as Promise<Task[]>;
  },

  async createTask(data: {
    project_id: string;
    title: string;
    description?: string;
    priority?: string;
    assignee_id?: string;
    due_date?: string;
    parent_task_id?: string;
  }) {
    return request('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }) as Promise<{ task: Task; warnings: { type: string; message: string }[] }>;
  },

  async getTask(taskId: string) {
    return request(`/tasks/${taskId}`) as Promise<Task>;
  },

  async updateTask(taskId: string, data: Partial<Task>) {
    return request(`/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }) as Promise<{ task: Task; warnings: { type: string; message: string }[] }>;
  },

  async updateTaskStatus(taskId: string, status: string) {
    return request(`/tasks/${taskId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }) as Promise<{ task: Task; warnings: { type: string; message: string }[] }>;
  },

  async deleteTask(taskId: string) {
    return request(`/tasks/${taskId}`, {
      method: 'DELETE',
    });
  },

  async addTaskRelation(taskId: string, relatedTaskId: string, relationType: 'blocks' | 'blocked_by') {
    return request(`/tasks/${taskId}/relations`, {
      method: 'POST',
      body: JSON.stringify({ related_task_id: relatedTaskId, relation_type: relationType }),
    });
  },

  async deleteTaskRelation(taskId: string, relationId: string) {
    return request(`/tasks/${taskId}/relations/${relationId}`, {
      method: 'DELETE',
    });
  },

  // Comments
  async listComments(parentType: 'tasks' | 'rca', parentId: string) {
    return request(`/${parentType}/${parentId}/comments`) as Promise<Comment[]>;
  },

  async addComment(parentType: 'tasks' | 'rca', parentId: string, body: string, mentionedUserIds: string[] = []) {
    return request(`/${parentType}/${parentId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body, mentioned_user_ids: mentionedUserIds }),
    }) as Promise<Comment>;
  },

  // Attachments
  async listAttachments(parentType: 'tasks' | 'rca', parentId: string) {
    return request(`/${parentType}/${parentId}/attachments`) as Promise<Attachment[]>;
  },

  async uploadAttachment(parentType: 'tasks' | 'rca', parentId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return request(`/${parentType}/${parentId}/attachments`, {
      method: 'POST',
      body: formData,
    }) as Promise<Attachment>;
  },

  getAttachmentDownloadUrl(parentType: 'tasks' | 'rca', parentId: string, attachmentId: string) {
    return `${API_BASE_URL}/${parentType}/${parentId}/attachments/${attachmentId}/download`;
  },

  // RCAs
  async listRcas(projectId: string, status?: string) {
    const qs = new URLSearchParams({ project_id: projectId, ...(status ? { status } : {}) }).toString();
    return request(`/rca?${qs}`) as Promise<RCA[]>;
  },

  async createRca(projectId: string, title: string, severity: string, taskId?: string) {
    return request('/rca', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, title, severity, task_id: taskId }),
    }) as Promise<RCA>;
  },

  async getRca(rcaId: string) {
    return request(`/rca/${rcaId}`) as Promise<RCA>;
  },

  async updateRcaSection(rcaId: string, sectionType: string, content: string) {
    return request(`/rca/${rcaId}/sections/${sectionType}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    }) as Promise<RCASection>;
  },

  async submitRca(rcaId: string, reviewerIds: string[]) {
    return request(`/rca/${rcaId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ reviewer_ids: reviewerIds }),
    }) as Promise<RCA>;
  },

  async decideReview(rcaId: string, reviewId: string, decision: 'approved' | 'rejected', comment: string) {
    return request(`/rca/${rcaId}/reviews/${reviewId}/decide`, {
      method: 'POST',
      body: JSON.stringify({ decision, comment }),
    }) as Promise<{ rca: RCA; all_decided: boolean }>;
  },

  async closeRca(rcaId: string) {
    return request(`/rca/${rcaId}/close`, {
      method: 'POST',
    }) as Promise<RCA>;
  },

  // Notifications
  async listNotifications(unreadOnly: boolean = false) {
    return request(`/notifications${unreadOnly ? '?unread_only=true' : ''}`) as Promise<Notification[]>;
  },

  async markNotificationRead(notificationId: string) {
    return request(`/notifications/${notificationId}/read`, {
      method: 'PATCH',
    }) as Promise<Notification>;
  },

  async markAllNotificationsRead() {
    return request('/notifications/mark-all-read', {
      method: 'POST',
    });
  },

  // Analytics
  async getDashboard(projectId: string) {
    return request(`/projects/${projectId}/analytics/dashboard`) as Promise<DashboardStats>;
  },

  // Export
  exportTasksCsvUrl(projectId: string, filters: Record<string, string> = {}) {
    const qs = new URLSearchParams(filters).toString();
    const token = typeof window !== 'undefined' ? (localStorage.getItem('teamflow_token') || '') : '';
    return `${API_BASE_URL}/projects/${projectId}/export/tasks.csv?token=${token}&${qs}`;
  }
};
