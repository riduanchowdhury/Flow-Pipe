import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  CheckSquare, 
  Kanban, 
  Calendar as CalendarIcon, 
  Settings, 
  Plus, 
  Search, 
  Bell, 
  User as UserIcon,
  ChevronRight,
  MoreVertical,
  Clock,
  AlertCircle,
  Zap,
  BarChart3,
  Users,
  Command,
  MessageSquare,
  Paperclip,
  GripVertical,
  Filter,
  ArrowUpDown,
  CalendarDays,
  Download,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { io, Socket } from 'socket.io-client';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Task, User } from './types';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Auth = ({ onLogin }: { onLogin: (user: User, token: string) => void }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });
      const data = await res.json();
      if (res.ok) {
        onLogin(data.user, data.token);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Something went wrong');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-slate-100"
      >
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <Zap className="text-white fill-white" size={28} />
          </div>
          <h1 className="text-2xl font-black tracking-tighter text-slate-800">FLOWPIPE</h1>
        </div>

        <h2 className="text-xl font-bold text-center mb-6">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Full Name</label>
              <input 
                required
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-slate-50 border-slate-200 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all"
                placeholder="John Doe"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Email Address</label>
            <input 
              required
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-slate-50 border-slate-200 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all"
              placeholder="name@company.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Password</label>
            <input 
              required
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-50 border-slate-200 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-red-500 text-xs font-medium">{error}</p>}

          <button 
            type="submit"
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-[0.98]"
          >
            {isLogin ? 'Sign In' : 'Get Started'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-slate-500">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-indigo-600 font-bold hover:underline"
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </motion.div>
    </div>
  );
};

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active?: boolean, onClick?: () => void }) => (
  <button 
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-all duration-200 group",
      active ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "text-slate-600 hover:bg-slate-100"
    )}
  >
    <Icon size={20} className={cn(active ? "text-white" : "text-slate-400 group-hover:text-indigo-600")} />
    <span className="font-medium text-sm">{label}</span>
  </button>
);

const TaskCard = ({ task, onClick, onStatusChange }: { task: Task, onClick: () => void, onStatusChange: (id: string, status: string) => void }) => {
  const priorityColors = {
    low: "bg-blue-100 text-blue-700",
    medium: "bg-yellow-100 text-yellow-700",
    high: "bg-orange-100 text-orange-700",
    urgent: "bg-red-100 text-red-700"
  };

  const nextStatus = {
    'todo': 'in-progress',
    'in-progress': 'review',
    'review': 'done',
    'done': 'todo'
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group relative"
    >
      <div className="flex justify-between items-start mb-2">
        <span className={cn("text-[10px] uppercase font-bold px-2 py-0.5 rounded-full", priorityColors[task.priority])}>
          {task.priority}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onStatusChange(task.id, nextStatus[task.status as keyof typeof nextStatus]);
            }}
            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
            title="Move to next stage"
          >
            <ChevronRight size={16} />
          </button>
          <button className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded">
            <MoreVertical size={16} />
          </button>
        </div>
      </div>
      <div onClick={onClick}>
        <h4 className="font-semibold text-slate-800 mb-1 line-clamp-2">{task.title}</h4>
        <p className="text-xs text-slate-500 line-clamp-2 mb-3">{task.description}</p>
        
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-50">
          <div className="flex items-center gap-2 text-slate-400">
            <Clock size={14} />
            <span className="text-[10px] font-medium">
              {task.due_date ? format(new Date(task.due_date), 'MMM d') : 'No date'}
            </span>
          </div>
          <div className="flex -space-x-2">
            <div className="w-6 h-6 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-indigo-600">
              {task.assignee_id ? 'U' : '?'}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const KanbanColumn = ({ title, status, tasks, onAddTask, onStatusChange, onTaskClick }: { title: string, status: string, tasks: Task[], onAddTask: () => void, onStatusChange: (id: string, status: string) => void, onTaskClick: (task: Task) => void }) => (
  <div className="flex flex-col gap-4 w-80 shrink-0">
    <div className="flex items-center justify-between px-2">
      <div className="flex items-center gap-2">
        <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider">{title}</h3>
        <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>
      <button 
        onClick={onAddTask}
        className="text-slate-400 hover:text-indigo-600 transition-colors p-1 hover:bg-indigo-50 rounded"
      >
        <Plus size={18} />
      </button>
    </div>
    <div className="flex flex-col gap-3 min-h-[500px] bg-slate-50/50 p-2 rounded-2xl border border-dashed border-slate-200">
      {tasks.map(task => (
        <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} onStatusChange={onStatusChange} />
      ))}
      <button 
        onClick={onAddTask}
        className="flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-white transition-all text-sm font-medium"
      >
        <Plus size={16} />
        Add Task
      </button>
    </div>
  </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [view, setView] = useState<'dashboard' | 'tasks' | 'kanban' | 'calendar' | 'analytics' | 'discussion' | 'members'>('kanban');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [discussionMessages, setDiscussionMessages] = useState<any[]>([]);
  const [newDiscussionMessage, setNewDiscussionMessage] = useState('');
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '' });
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskComments, setTaskComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [newTask, setNewTask] = useState({ 
    title: '', 
    description: '', 
    priority: 'medium' as const, 
    status: 'todo', 
    project_id: '', 
    assignee_id: '', 
    due_date: '',
    subtasks: [] as string[]
  });
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestedSubtasks, setSuggestedSubtasks] = useState<string[]>([]);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      const s = io();
      setSocket(s);

      s.on('task:created', (task: Task) => {
        setTasks(prev => [task, ...prev]);
      });

      s.on('task:updated', (updatedTask: Task) => {
        setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
      });

      s.on('task:deleted', (id: string) => {
        setTasks(prev => prev.filter(t => t.id !== id && t.parent_id !== id));
      });

      s.on('discussion:message', (message: any) => {
        setDiscussionMessages(prev => [...prev, message]);
      });

      fetchInitialData();
      fetchDiscussions();

      return () => {
        s.disconnect();
      };
    }
  }, [token]);

  useEffect(() => {
    if (selectedTask && token) {
      fetchComments();
      if (socket) {
        socket.on(`task:${selectedTask.id}:comment`, (comment: any) => {
          setTaskComments(prev => [...prev, comment]);
        });
        return () => {
          socket.off(`task:${selectedTask.id}:comment`);
        };
      }
    }
  }, [selectedTask, token, socket]);

  const fetchInitialData = async () => {
    try {
      const [tasksRes, projectsRes, usersRes, notificationsRes] = await Promise.all([
        fetch('/api/tasks', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/projects', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/notifications', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      
      if (tasksRes.ok) setTasks(await tasksRes.json());
      if (projectsRes.ok) setProjects(await projectsRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
      if (notificationsRes.ok) setNotifications(await notificationsRes.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchComments = async () => {
    if (!selectedTask) return;
    const res = await fetch(`/api/tasks/${selectedTask.id}/comments`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) setTaskComments(await res.json());
  };

  const handleLogin = (user: User, token: string) => {
    setUser(user);
    setToken(token);
    localStorage.setItem('token', token);
  };

  const fetchDiscussions = async () => {
    try {
      const res = await fetch('/api/discussions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDiscussionMessages(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendDiscussionMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDiscussionMessage.trim()) return;
    try {
      const res = await fetch('/api/discussions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: newDiscussionMessage })
      });
      if (res.ok) {
        setNewDiscussionMessage('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/workspace/members', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: newMemberEmail })
      });
      if (res.ok) {
        setIsAddingMember(false);
        setNewMemberEmail('');
        fetchInitialData();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to add member');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...newProject, workspace_id: 'default' })
      });
      if (res.ok) {
        const project = await res.json();
        setProjects(prev => [project, ...prev]);
        setIsAddingProject(false);
        setNewProject({ name: '', description: '' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment || !selectedTask) return;
    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}/comments`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: newComment })
      });
      if (res.ok) {
        setNewComment('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssignMember = async (taskId: string, userId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ assignee_id: userId })
      });
      if (res.ok) {
        const updatedTask = await res.json();
        setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
        if (selectedTask?.id === taskId) {
          setSelectedTask(updatedTask);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportReport = () => {
    const data = tasks.map(t => ({
      Title: t.title,
      Status: t.status,
      Priority: t.priority,
      DueDate: t.due_date,
      Assignee: t.assignee_id
    }));
    const csv = [
      ['Title', 'Status', 'Priority', 'Due Date', 'Assignee'],
      ...data.map(row => Object.values(row))
    ].map(e => e.join(",")).join("\n");
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'flowpipe-report.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleMarkAllNotificationsAsRead = async () => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setTaskToDelete(null);
        if (selectedTask?.id === id) setSelectedTask(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateTask = async (id: string, updates: Partial<Task>) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to update task');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newTask)
      });
      if (res.ok) {
        setIsAddingTask(false);
        setNewTask({ 
          title: '', 
          description: '', 
          priority: 'medium', 
          status: 'todo', 
          project_id: '', 
          assignee_id: '', 
          due_date: '',
          subtasks: []
        });
        setSuggestedSubtasks([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSuggestSubtasks = async () => {
    if (!newTask.title) return;
    setIsSuggesting(true);
    try {
      const res = await fetch('/api/ai/suggest-breakdown', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: newTask.title, description: newTask.description })
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestedSubtasks(data.subtasks);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSuggesting(false);
    }
  };

  const updateTaskStatus = async (id: string, status: string) => {
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Task, direction: 'asc' | 'desc' } | null>(null);

  const filteredTasks = useMemo(() => {
    let result = [...tasks];
    
    if (selectedProject) {
      result = result.filter(t => t.project_id === selectedProject);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(query) || 
        (t.description && t.description.toLowerCase().includes(query))
      );
    }
    
    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (!aVal) return 1;
        if (!bVal) return -1;
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return result;
  }, [tasks, searchQuery, sortConfig]);

  const handleSort = (key: keyof Task) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const columns = useMemo(() => {
    return {
      todo: filteredTasks.filter(t => t.status === 'todo'),
      'in-progress': filteredTasks.filter(t => t.status === 'in-progress'),
      review: filteredTasks.filter(t => t.status === 'review'),
      done: filteredTasks.filter(t => t.status === 'done'),
    };
  }, [filteredTasks]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'done').length;
    const inProgress = tasks.filter(t => t.status === 'in-progress').length;
    const pending = total - completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { total, completed, inProgress, pending, completionRate };
  }, [tasks]);

  const analyticsData = useMemo(() => {
    const statusData = [
      { name: 'To Do', value: columns.todo.length, color: '#94a3b8' },
      { name: 'In Progress', value: columns['in-progress'].length, color: '#6366f1' },
      { name: 'Review', value: columns.review.length, color: '#eab308' },
      { name: 'Done', value: columns.done.length, color: '#10b981' },
    ];

    const priorityData = [
      { name: 'Low', value: tasks.filter(t => t.priority === 'low').length, color: '#3b82f6' },
      { name: 'Medium', value: tasks.filter(t => t.priority === 'medium').length, color: '#eab308' },
      { name: 'High', value: tasks.filter(t => t.priority === 'high').length, color: '#f97316' },
      { name: 'Urgent', value: tasks.filter(t => t.priority === 'urgent').length, color: '#ef4444' },
    ];

    return { statusData, priorityData };
  }, [tasks, columns]);

  if (!token) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-white text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-200 flex flex-col bg-slate-50/30">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <Zap className="text-white fill-white" size={24} />
          </div>
          <h1 className="text-xl font-black tracking-tighter text-slate-800">FLOWPIPE</h1>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <div className="mb-6">
            <p className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Main Menu</p>
            <SidebarItem 
              icon={LayoutDashboard} 
              label="Dashboard" 
              active={view === 'dashboard' && !selectedProject} 
              onClick={() => {
                setView('dashboard');
                setSelectedProject(null);
              }} 
            />
            <SidebarItem 
              icon={CheckSquare} 
              label="My Tasks" 
              active={view === 'tasks' && !selectedProject} 
              onClick={() => {
                setView('tasks');
                setSelectedProject(null);
              }} 
            />
            <SidebarItem 
              icon={Kanban} 
              label="Kanban Board" 
              active={view === 'kanban' && !selectedProject} 
              onClick={() => {
                setView('kanban');
                setSelectedProject(null);
              }} 
            />
            <SidebarItem 
              icon={CalendarIcon} 
              label="Calendar" 
              active={view === 'calendar' && !selectedProject} 
              onClick={() => {
                setView('calendar');
                setSelectedProject(null);
              }} 
            />
            <SidebarItem 
              icon={BarChart3} 
              label="Analytics" 
              active={view === 'analytics' && !selectedProject} 
              onClick={() => {
                setView('analytics');
                setSelectedProject(null);
              }} 
            />
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between px-3 mb-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Projects</p>
              <Plus 
                size={14} 
                className="text-slate-400 cursor-pointer hover:text-indigo-600" 
                onClick={() => setIsAddingProject(true)}
              />
            </div>
            {projects.map(project => (
              <SidebarItem 
                key={project.id}
                icon={ChevronRight} 
                label={project.name} 
                active={selectedProject === project.id}
                onClick={() => {
                  setSelectedProject(project.id);
                  setView('tasks');
                }}
              />
            ))}
            {projects.length === 0 && (
              <p className="px-3 text-[10px] text-slate-400 italic">No projects yet</p>
            )}
          </div>

          <div>
            <p className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Team</p>
            <SidebarItem icon={Users} label="Workspace Members" active={view === 'members'} onClick={() => setView('members')} />
            <SidebarItem icon={MessageSquare} label="Discussions" active={view === 'discussion'} onClick={() => setView('discussion')} />
          </div>
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div 
            onClick={handleLogout}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-red-50 transition-colors cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-200 group-hover:bg-red-100 flex items-center justify-center text-slate-500 group-hover:text-red-600">
              <UserIcon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate group-hover:text-red-600">{user?.name || 'User'}</p>
              <p className="text-[10px] text-slate-500 truncate">Sign Out</p>
            </div>
            <Settings size={16} className="text-slate-400" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Header */}
        <header className="h-16 border-bottom border-slate-200 flex items-center justify-between px-8 bg-white/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search tasks, projects, people... (⌘K)"
                className="w-full bg-slate-100 border-none rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors relative"
              >
                <Bell size={20} />
                {notifications.filter(n => !n.is_read).length > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </button>
              
              <AnimatePresence>
                {showNotifications && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden"
                  >
                    <div className="p-4 border-b border-slate-50 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800">Notifications</h3>
                      <button 
                        onClick={handleMarkAllNotificationsAsRead}
                        className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest hover:text-indigo-700"
                      >
                        Mark all as read
                      </button>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length > 0 ? notifications.map(n => (
                        <div key={n.id} className={cn("p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors", !n.is_read && "bg-indigo-50/30")}>
                          <p className="text-sm font-bold text-slate-800">{n.title}</p>
                          <p className="text-xs text-slate-500 mt-1">{n.message}</p>
                          <p className="text-[10px] text-slate-400 mt-2">{format(new Date(n.created_at), 'MMM d, h:mm a')}</p>
                        </div>
                      )) : (
                        <div className="p-8 text-center">
                          <p className="text-sm text-slate-400">No notifications yet</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button 
              onClick={() => setIsAddingTask(true)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
            >
              <Plus size={18} />
              New Task
            </button>
          </div>
        </header>

        {/* View Content */}
        <div className="flex-1 overflow-x-auto p-8">
          <AnimatePresence mode="wait">
            {view === 'kanban' && (
              <motion.div 
                key="kanban"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex gap-8 h-full"
              >
                <KanbanColumn title="To Do" status="todo" tasks={columns.todo} onAddTask={() => { setNewTask(prev => ({ ...prev, status: 'todo' })); setIsAddingTask(true); }} onStatusChange={updateTaskStatus} onTaskClick={setSelectedTask} />
                <KanbanColumn title="In Progress" status="in-progress" tasks={columns['in-progress']} onAddTask={() => { setNewTask(prev => ({ ...prev, status: 'in-progress' })); setIsAddingTask(true); }} onStatusChange={updateTaskStatus} onTaskClick={setSelectedTask} />
                <KanbanColumn title="Review" status="review" tasks={columns.review} onAddTask={() => { setNewTask(prev => ({ ...prev, status: 'review' })); setIsAddingTask(true); }} onStatusChange={updateTaskStatus} onTaskClick={setSelectedTask} />
                <KanbanColumn title="Done" status="done" tasks={columns.done} onAddTask={() => { setNewTask(prev => ({ ...prev, status: 'done' })); setIsAddingTask(true); }} onStatusChange={updateTaskStatus} onTaskClick={setSelectedTask} />
              </motion.div>
            )}
            
            {view === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex justify-between items-end">
                  <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">Welcome back, {user?.name}! 👋</h2>
                    <p className="text-slate-500 mt-1">Here's what's happening in your workspace today.</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Workspace Health</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-600" style={{ width: `${stats.completionRate}%` }} />
                      </div>
                      <span className="text-sm font-bold text-slate-700">{stats.completionRate}%</span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-indigo-50 rounded-2xl">
                        <CheckSquare className="text-indigo-600" size={24} />
                      </div>
                    </div>
                    <p className="text-sm font-medium text-slate-500">Total Tasks</p>
                    <h3 className="text-3xl font-black text-slate-800">{stats.total}</h3>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-emerald-50 rounded-2xl">
                        <CheckSquare className="text-emerald-600" size={24} />
                      </div>
                    </div>
                    <p className="text-sm font-medium text-slate-500">Completed</p>
                    <h3 className="text-3xl font-black text-slate-800">{stats.completed}</h3>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-amber-50 rounded-2xl">
                        <Clock className="text-amber-600" size={24} />
                      </div>
                    </div>
                    <p className="text-sm font-medium text-slate-500">In Progress</p>
                    <h3 className="text-3xl font-black text-slate-800">{stats.inProgress}</h3>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-rose-50 rounded-2xl">
                        <AlertCircle className="text-rose-600" size={24} />
                      </div>
                    </div>
                    <p className="text-sm font-medium text-slate-500">Pending</p>
                    <h3 className="text-3xl font-black text-slate-800">{stats.pending}</h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Task Distribution</h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analyticsData.statusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {analyticsData.statusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Recent Tasks</h3>
                    <div className="space-y-4">
                      {filteredTasks.slice(0, 5).map(task => (
                        <div key={task.id} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            task.status === 'done' ? 'bg-emerald-500' : 'bg-amber-500'
                          )} />
                          <div className="flex-1">
                            <p className="text-sm font-bold text-slate-800 truncate">{task.title}</p>
                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{task.status}</p>
                          </div>
                          <span className="text-[10px] font-bold text-slate-400">{format(new Date(task.created_at), 'MMM d')}</span>
                        </div>
                      ))}
                      {tasks.length === 0 && <p className="text-center text-slate-400 py-8 italic">No tasks yet.</p>}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'tasks' && (
              <motion.div 
                key="tasks"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-4">
                    <h2 className="text-xl font-black text-slate-800">All Tasks</h2>
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">
                      <Filter size={14} />
                      Filter
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 cursor-pointer hover:bg-slate-50" onClick={() => handleSort('status')}>
                    <ArrowUpDown size={14} />
                    Sort
                  </div>
                  <div className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer hover:bg-indigo-700" onClick={handleExportReport}>
                    <Download size={14} />
                    Export Report
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/30">
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('title')}>Task</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('status')}>Status</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('priority')}>Priority</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('due_date')}>Due Date</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Assignee</th>
                        <th className="px-6 py-4"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks.map(task => (
                        <tr 
                          key={task.id} 
                          onClick={() => setSelectedTask(task)}
                          className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group cursor-pointer"
                        >
                          <td className="px-6 py-4">
                            <div>
                              <p className="text-sm font-bold text-slate-800">{task.title}</p>
                              <p className="text-xs text-slate-400 truncate max-w-xs">{task.description}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "text-[10px] font-black uppercase px-2 py-1 rounded-lg",
                              task.status === 'done' ? 'bg-emerald-100 text-emerald-700' : 
                              task.status === 'in-progress' ? 'bg-indigo-100 text-indigo-700' :
                              task.status === 'review' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                            )}>
                              {task.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "text-[10px] font-black uppercase px-2 py-1 rounded-lg",
                              task.priority === 'urgent' ? 'bg-rose-100 text-rose-700' :
                              task.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                              task.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                            )}>
                              {task.priority}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs font-medium text-slate-500">
                            {task.due_date ? format(new Date(task.due_date), 'MMM d, yyyy') : 'No date'}
                          </td>
                          <td className="px-6 py-4">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 border border-slate-200">
                              {task.assignee_id ? 'U' : '?'}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button className="text-slate-300 hover:text-slate-600 transition-colors">
                              <MoreVertical size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {tasks.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">No tasks found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {view === 'calendar' && (
              <motion.div 
                key="calendar"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full min-h-[700px]"
              >
                <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between bg-slate-50/50 gap-4">
                  <div className="flex items-center gap-4">
                    <h2 className="text-lg md:text-xl font-black text-slate-800">{format(currentMonth, 'MMMM yyyy')}</h2>
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
                      <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 hover:bg-slate-50 rounded-lg transition-colors"><ChevronRight size={18} className="rotate-180" /></button>
                      <button onClick={() => setCurrentMonth(new Date())} className="px-2 md:px-3 py-1.5 text-[10px] md:text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">Today</button>
                      <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1.5 hover:bg-slate-50 rounded-lg transition-colors"><ChevronRight size={18} /></button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">
                    <CalendarDays size={14} />
                    <span className="hidden md:inline">Month View</span>
                    <span className="md:hidden">Month</span>
                  </div>
                </div>
                
                <div className="flex-1 overflow-auto custom-scrollbar">
                  <div className="min-w-[800px] h-full grid grid-cols-7 border-collapse">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-r border-slate-100 bg-slate-50/20 text-center">
                        {day}
                      </div>
                    ))}
                    {(() => {
                      const monthStart = startOfMonth(currentMonth);
                      const monthEnd = endOfMonth(monthStart);
                      const startDate = startOfWeek(monthStart);
                      const endDate = endOfWeek(monthEnd);
                      const days = eachDayOfInterval({ start: startDate, end: endDate });

                      return days.map((day, idx) => {
                        const dayTasks = filteredTasks.filter(t => t.due_date && isSameDay(new Date(t.due_date), day));
                        const isCurrentMonth = isSameMonth(day, monthStart);
                        return (
                          <div 
                            key={day.toString()} 
                            className={cn(
                              "p-2 border-r border-b border-slate-100 transition-colors hover:bg-slate-50/50 flex flex-col gap-1 min-h-[120px]",
                              !isCurrentMonth && "bg-slate-50/30 text-slate-300"
                            )}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className={cn(
                                "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-lg",
                                isSameDay(day, new Date()) ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : isCurrentMonth ? "text-slate-500" : "text-slate-300"
                              )}>
                                {format(day, 'd')}
                              </span>
                            </div>
                            <div className="space-y-1 overflow-y-auto max-h-[100px] custom-scrollbar">
                              {dayTasks.map(task => (
                                <div 
                                  key={task.id} 
                                  onClick={() => setSelectedTask(task)}
                                  className="px-2 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-[10px] font-bold text-indigo-700 truncate cursor-pointer hover:bg-indigo-100 transition-colors"
                                >
                                  {task.title}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'members' && (
              <motion.div 
                key="members"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex justify-between items-end">
                  <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">Workspace Members</h2>
                    <p className="text-slate-500 mt-1">Manage your team and their roles within the workspace.</p>
                  </div>
                  <button 
                    onClick={() => setIsAddingMember(true)}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-2"
                  >
                    <Plus size={20} />
                    Add Member
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {users.map(u => (
                    <div key={u.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-lg">
                        {u.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-800 truncate">{u.name}</h4>
                        <p className="text-xs text-slate-400 truncate">{u.email}</p>
                      </div>
                      <div className="px-2 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-slate-500 uppercase">
                        Member
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {view === 'discussion' && (
              <motion.div 
                key="discussion"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full"
              >
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <h2 className="text-xl font-black text-slate-800">Workspace Discussion</h2>
                  <p className="text-xs text-slate-500 mt-1">Real-time collaboration with your entire team.</p>
                </div>
                <div className="flex-1 p-8 overflow-y-auto space-y-6 custom-scrollbar">
                  {discussionMessages.map((msg, idx) => {
                    const isMe = msg.user_id === user?.id;
                    return (
                      <div key={msg.id || idx} className={cn("flex gap-4", isMe && "flex-row-reverse")}>
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-bold", isMe ? "bg-emerald-100 text-emerald-600" : "bg-indigo-100 text-indigo-600")}>
                          {msg.user_name?.charAt(0) || 'U'}
                        </div>
                        <div className={cn("flex-1 flex flex-col", isMe && "items-end")}>
                          <div className="flex items-center gap-2 mb-1">
                            {!isMe && <span className="text-sm font-bold text-slate-800">{msg.user_name}</span>}
                            <span className="text-[10px] text-slate-400 font-medium">{format(new Date(msg.created_at), 'h:mm a')}</span>
                            {isMe && <span className="text-sm font-bold text-slate-800">You</span>}
                          </div>
                          <div className={cn(
                            "p-4 rounded-2xl border max-w-2xl",
                            isMe ? "bg-indigo-600 text-white border-indigo-500 rounded-tr-none shadow-lg shadow-indigo-100" : "bg-slate-50 text-slate-600 border-slate-100 rounded-tl-none"
                          )}>
                            <p className="text-sm leading-relaxed">{msg.content}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {discussionMessages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                      <MessageSquare size={48} className="opacity-20" />
                      <p className="italic">No messages yet. Start the conversation!</p>
                    </div>
                  )}
                </div>
                <form onSubmit={handleSendDiscussionMessage} className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4">
                  <div className="flex-1 relative">
                    <input 
                      type="text" 
                      value={newDiscussionMessage}
                      onChange={e => setNewDiscussionMessage(e.target.value)}
                      placeholder="Type your message..." 
                      className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <Paperclip size={20} className="text-slate-400 cursor-pointer hover:text-slate-600" />
                      <button 
                        type="submit"
                        disabled={!newDiscussionMessage.trim()}
                        className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50"
                      >
                        <Send size={18} />
                      </button>
                    </div>
                  </div>
                </form>
              </motion.div>
            )}
            {view === 'analytics' && (
              <motion.div 
                key="analytics"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex justify-between items-end">
                  <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">Workspace Analytics</h2>
                    <p className="text-slate-500 mt-1">Deep dive into your team's productivity and performance.</p>
                  </div>
                  <button 
                    onClick={handleExportReport}
                    className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2"
                  >
                    <Download size={16} />
                    Export Report
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Task Status Overview</h3>
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analyticsData.statusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={80}
                            outerRadius={110}
                            paddingAngle={8}
                            dataKey="value"
                            label
                          >
                            {analyticsData.statusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Priority Distribution</h3>
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analyticsData.priorityData}>
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#94a3b8' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#94a3b8' }} />
                          <Tooltip 
                            cursor={{ fill: '#f8fafc' }}
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                            {analyticsData.priorityData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-800 mb-6">Performance Metrics</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Average Cycle Time</p>
                      <h4 className="text-4xl font-black text-slate-800">2.4 <span className="text-lg font-medium text-slate-400">days</span></h4>
                      <p className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                        <Zap size={12} className="fill-emerald-600" />
                        15% faster than last week
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Throughput</p>
                      <h4 className="text-4xl font-black text-slate-800">18 <span className="text-lg font-medium text-slate-400">tasks/wk</span></h4>
                      <p className="text-xs text-indigo-600 font-bold flex items-center gap-1">
                        <CheckSquare size={12} />
                        On track for Q1 goals
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">SLA Compliance</p>
                      <h4 className="text-4xl font-black text-slate-800">98.2<span className="text-lg font-medium text-slate-400">%</span></h4>
                      <p className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                        <AlertCircle size={12} />
                        Excellent performance
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Task Detail Modal */}
      <AnimatePresence>
        {selectedTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTask(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 overflow-y-auto">
                <div className="flex justify-between items-start mb-6">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[10px] font-black uppercase px-2 py-1 rounded-lg",
                        selectedTask.status === 'done' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
                      )}>
                        {selectedTask.status}
                      </span>
                      <span className={cn(
                        "text-[10px] font-black uppercase px-2 py-1 rounded-lg",
                        selectedTask.priority === 'urgent' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                      )}>
                        {selectedTask.priority}
                      </span>
                    </div>
                    <h2 className="text-2xl font-black text-slate-800">{selectedTask.title}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setTaskToDelete(selectedTask.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      title="Delete Task"
                    >
                      <Plus className="rotate-45" size={20} />
                    </button>
                    <button onClick={() => setSelectedTask(null)} className="text-slate-400 hover:text-slate-600">
                      <Plus className="rotate-45" size={28} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-8 mb-8">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assignee</p>
                    <div className="relative group">
                      <div className="flex items-center gap-2 cursor-pointer p-1 hover:bg-slate-50 rounded-lg transition-colors">
                        <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                          {selectedTask.assignee_id ? users.find(u => u.id === selectedTask.assignee_id)?.name?.charAt(0) : '?'}
                        </div>
                        <span className="text-sm font-medium text-slate-700">{selectedTask.assignee_id ? users.find(u => u.id === selectedTask.assignee_id)?.name : 'Unassigned'}</span>
                      </div>
                      <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 hidden group-hover:block overflow-hidden">
                        {users.map(u => (
                          <div 
                            key={u.id} 
                            onClick={() => handleAssignMember(selectedTask.id, u.id)}
                            className="p-3 hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer flex items-center gap-2"
                          >
                            <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[8px] font-bold text-indigo-600">{u.name.charAt(0)}</div>
                            {u.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Due Date</p>
                    <div className="flex items-center gap-2 text-slate-700">
                      <CalendarIcon size={16} className="text-slate-400" />
                      <span className="text-sm font-medium">{selectedTask.due_date ? format(new Date(selectedTask.due_date), 'MMM d, yyyy') : 'No date'}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Project</p>
                    <div className="flex items-center gap-2 text-slate-700">
                      <ChevronRight size={16} className="text-slate-400" />
                      <span className="text-sm font-medium">Marketing Campaign</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description</p>
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-sm text-slate-600 leading-relaxed">
                    {selectedTask.description || 'No description provided.'}
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Subtasks</p>
                  <div className="space-y-2">
                    {tasks.filter(t => t.parent_id === selectedTask.id).map(sub => (
                      <div key={sub.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                        <input 
                          type="checkbox" 
                          checked={sub.status === 'done'}
                          onChange={() => handleUpdateTask(sub.id, { status: sub.status === 'done' ? 'todo' : 'done' })}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className={cn("text-sm font-medium flex-1", sub.status === 'done' ? "text-slate-400 line-through" : "text-slate-700")}>
                          {sub.title}
                        </span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setTaskToDelete(sub.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all"
                        >
                          <Plus size={14} className="rotate-45" />
                        </button>
                      </div>
                    ))}
                    {tasks.filter(t => t.parent_id === selectedTask.id).length === 0 && (
                      <p className="text-xs text-slate-400 italic">No subtasks added.</p>
                    )}
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-800">Activity & Comments</h3>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{taskComments.length} Comments</span>
                  </div>
                  <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    {taskComments.map(comment => (
                      <div key={comment.id} className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600 shrink-0">
                          {comment.user_name.charAt(0)}
                        </div>
                        <div className="flex-1 bg-slate-50 p-3 rounded-2xl rounded-tl-none border border-slate-100">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold text-slate-800">{comment.user_name}</span>
                            <span className="text-[10px] text-slate-400">{format(new Date(comment.created_at), 'MMM d, h:mm a')}</span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{comment.content}</p>
                        </div>
                      </div>
                    ))}
                    {taskComments.length === 0 && (
                      <p className="text-xs text-slate-400 italic text-center py-4">No comments yet. Start the conversation!</p>
                    )}
                  </div>
                </div>
              </div>
              <form onSubmit={handleAddComment} className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                <input 
                  type="text" 
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="Add a comment..." 
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
                <button 
                  type="submit"
                  disabled={!newComment}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  Send
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Confirmation Dialog */}
      <AnimatePresence>
        {taskToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTaskToDelete(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">Delete Task?</h3>
              <p className="text-sm text-slate-500 mb-8">This action cannot be undone. All subtasks and comments will also be removed.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setTaskToDelete(null)}
                  className="flex-1 px-6 py-3 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleDeleteTask(taskToDelete)}
                  className="flex-1 bg-red-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-red-200 hover:bg-red-700 transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Member Modal */}
      <AnimatePresence>
        {isAddingMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingMember(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-black text-slate-800">Add Team Member</h2>
                  <button onClick={() => setIsAddingMember(false)} className="text-slate-400 hover:text-slate-600">
                    <Plus className="rotate-45" size={24} />
                  </button>
                </div>
                <form onSubmit={handleAddMember} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email Address</label>
                    <input 
                      type="email" 
                      required
                      value={newMemberEmail}
                      onChange={e => setNewMemberEmail(e.target.value)}
                      placeholder="colleague@company.com"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-[0.98]"
                  >
                    Add to Workspace
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Project Modal */}
      <AnimatePresence>
        {isAddingProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingProject(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl font-black text-slate-800">Create Project</h2>
                  <button onClick={() => setIsAddingProject(false)} className="text-slate-400 hover:text-slate-600">
                    <Plus className="rotate-45" size={28} />
                  </button>
                </div>

                <form onSubmit={handleAddProject} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Project Name</label>
                    <input 
                      type="text" 
                      required
                      value={newProject.name}
                      onChange={e => setNewProject({ ...newProject, name: e.target.value })}
                      placeholder="e.g. Marketing Campaign"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description</label>
                    <textarea 
                      value={newProject.description}
                      onChange={e => setNewProject({ ...newProject, description: e.target.value })}
                      placeholder="What is this project about?"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all min-h-[120px]"
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-[0.98]"
                  >
                    Create Project
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddingTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingTask(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <form onSubmit={handleAddTask} className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-black text-slate-800">Create New Task</h2>
                  <button type="button" onClick={() => { setIsAddingTask(false); setSuggestedSubtasks([]); }} className="text-slate-400 hover:text-slate-600">
                    <Plus className="rotate-45" size={24} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Task Title</label>
                    <input 
                      autoFocus
                      required
                      type="text" 
                      value={newTask.title}
                      onChange={e => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="What needs to be done?"
                      className="w-full bg-slate-50 border-slate-200 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Description</label>
                      <button 
                        type="button"
                        disabled={isSuggesting || !newTask.title}
                        onClick={handleSuggestSubtasks}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 disabled:opacity-50"
                      >
                        <Zap size={10} className="fill-indigo-600" />
                        {isSuggesting ? 'Suggesting...' : 'Suggest Subtasks'}
                      </button>
                    </div>
                    <textarea 
                      rows={3}
                      value={newTask.description}
                      onChange={e => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Add more details..."
                      className="w-full bg-slate-50 border-slate-200 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Subtasks</label>
                      <button 
                        type="button"
                        onClick={() => setNewTask(prev => ({ ...prev, subtasks: [...prev.subtasks, ''] }))}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                      >
                        <Plus size={10} />
                        Add Subtask
                      </button>
                    </div>
                    <div className="space-y-2">
                      {newTask.subtasks.map((sub, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input 
                            type="text"
                            value={sub}
                            onChange={e => {
                              const newSubs = [...newTask.subtasks];
                              newSubs[i] = e.target.value;
                              setNewTask(prev => ({ ...prev, subtasks: newSubs }));
                            }}
                            placeholder="What needs to be done?"
                            className="flex-1 bg-slate-50 border-slate-200 rounded-xl py-2 px-4 text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all"
                          />
                          <button 
                            type="button"
                            onClick={() => setNewTask(prev => ({ ...prev, subtasks: prev.subtasks.filter((_, idx) => idx !== i) }))}
                            className="text-slate-400 hover:text-red-500"
                          >
                            <Plus size={16} className="rotate-45" />
                          </button>
                        </div>
                      ))}
                      {suggestedSubtasks.length > 0 && (
                        <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                          <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-2">AI Suggested</p>
                          <div className="flex flex-wrap gap-2">
                            {suggestedSubtasks.map((sub, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => {
                                  setNewTask(prev => ({ ...prev, subtasks: [...prev.subtasks, sub] }));
                                  setSuggestedSubtasks(prev => prev.filter((_, idx) => idx !== i));
                                }}
                                className="px-3 py-1.5 rounded-lg bg-white border border-indigo-100 text-[10px] font-bold text-indigo-700 hover:bg-indigo-50 transition-colors flex items-center gap-1"
                              >
                                <Plus size={10} />
                                {sub}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Project</label>
                      <select 
                        value={newTask.project_id}
                        onChange={e => setNewTask(prev => ({ ...prev, project_id: e.target.value }))}
                        className="w-full bg-slate-50 border-slate-200 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all"
                      >
                        <option value="">No Project</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Assignee</label>
                      <select 
                        value={newTask.assignee_id}
                        onChange={e => setNewTask(prev => ({ ...prev, assignee_id: e.target.value }))}
                        className="w-full bg-slate-50 border-slate-200 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all"
                      >
                        <option value="">Unassigned</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Priority</label>
                      <select 
                        value={newTask.priority}
                        onChange={e => setNewTask(prev => ({ ...prev, priority: e.target.value as any }))}
                        className="w-full bg-slate-50 border-slate-200 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Due Date</label>
                      <input 
                        type="date" 
                        value={newTask.due_date || ''}
                        onChange={e => setNewTask(prev => ({ ...prev, due_date: e.target.value }))}
                        className="w-full bg-slate-50 border-slate-200 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsAddingTask(false)}
                    className="flex-1 py-3 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
                  >
                    Create Task
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
