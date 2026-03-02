import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { suggestTaskBreakdown } from "./src/services/geminiService";

const db = new Database("flowpipe.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password TEXT,
    name TEXT,
    avatar TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT,
    owner_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(owner_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    name TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    parent_id TEXT,
    title TEXT,
    description TEXT,
    status TEXT DEFAULT 'todo',
    priority TEXT DEFAULT 'medium',
    due_date DATETIME,
    assignee_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id),
    FOREIGN KEY(parent_id) REFERENCES tasks(id),
    FOREIGN KEY(assignee_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT,
    color TEXT
  );

  CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id TEXT,
    user_id TEXT,
    role TEXT DEFAULT 'member',
    PRIMARY KEY(workspace_id, user_id),
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    task_id TEXT,
    user_id TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(task_id) REFERENCES tasks(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT,
    message TEXT,
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  app.use(express.json());

  const JWT_SECRET = process.env.JWT_SECRET || "flowpipe-secret-key-123";

  // Auth Middleware
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // Auth Routes
  app.post("/api/auth/register", async (req, res) => {
    const { email, password, name } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = uuidv4();
    const workspaceId = 'default';
    try {
      db.transaction(() => {
        db.prepare("INSERT INTO users (id, email, password, name) VALUES (?, ?, ?, ?)").run(id, email, hashedPassword, name);
        // Ensure default workspace exists
        const existingWorkspace = db.prepare("SELECT id FROM workspaces WHERE id = ?").get(workspaceId);
        if (!existingWorkspace) {
          db.prepare("INSERT INTO workspaces (id, name, owner_id) VALUES (?, ?, ?)").run(workspaceId, "General Workspace", id);
        }
        // Add user to workspace members
        db.prepare("INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)").run(workspaceId, id, 'owner');
      })();
      
      const token = jwt.sign({ id, email, name }, JWT_SECRET);
      res.json({ token, user: { id, email, name } });
    } catch (err) {
      console.error(err);
      res.status(400).json({ error: "Email already exists or registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  });

  // Task Routes
  app.get("/api/tasks", authenticate, (req: any, res) => {
    const tasks = db.prepare("SELECT * FROM tasks ORDER BY created_at DESC").all();
    res.json(tasks);
  });

  app.post("/api/tasks", authenticate, (req: any, res) => {
    const { title, description, status, priority, due_date, project_id, assignee_id, subtasks } = req.body;
    const id = uuidv4();
    
    db.transaction(() => {
      db.prepare(`
        INSERT INTO tasks (id, title, description, status, priority, due_date, project_id, assignee_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, title, description, status || 'todo', priority || 'medium', due_date || null, project_id || null, assignee_id || null);
      
      if (subtasks && Array.isArray(subtasks)) {
        for (const sub of subtasks) {
          if (sub.trim()) {
            db.prepare(`
              INSERT INTO tasks (id, title, parent_id, status, priority, project_id)
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(uuidv4(), sub, id, 'todo', 'medium', project_id || null);
          }
        }
      }
    })();
    
    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
    io.emit("task:created", task);
    res.json(task);
  });

  app.delete("/api/tasks/:id", authenticate, (req: any, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM tasks WHERE id = ? OR parent_id = ?").run(id, id);
    io.emit("task:deleted", id);
    res.json({ success: true });
  });

  app.patch("/api/tasks/:id", authenticate, (req: any, res) => {
    const { id } = req.params;
    const updates = req.body;
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(", ");
    const values = Object.values(updates);
    
    db.prepare(`UPDATE tasks SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values, id);
    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
    io.emit("task:updated", task);
    res.json(task);
  });

  // Project Routes
  app.get("/api/projects", authenticate, (req: any, res) => {
    const projects = db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all();
    res.json(projects);
  });

  app.post("/api/projects", authenticate, (req: any, res) => {
    const { name, description, workspace_id } = req.body;
    const id = uuidv4();
    const wId = workspace_id || 'default';
    
    // Ensure workspace exists (for backward compatibility)
    const existingWorkspace = db.prepare("SELECT id FROM workspaces WHERE id = ?").get(wId);
    if (!existingWorkspace) {
      db.prepare("INSERT INTO workspaces (id, name, owner_id) VALUES (?, ?, ?)").run(wId, "General Workspace", req.user.id);
      db.prepare("INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)").run(wId, req.user.id, 'owner');
    }

    db.prepare("INSERT INTO projects (id, name, description, workspace_id) VALUES (?, ?, ?, ?)").run(id, name, description, wId);
    const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
    res.json(project);
  });

  // Comment Routes
  app.get("/api/tasks/:taskId/comments", authenticate, (req: any, res) => {
    const { taskId } = req.params;
    const comments = db.prepare(`
      SELECT c.*, u.name as user_name, u.avatar as user_avatar 
      FROM comments c 
      JOIN users u ON c.user_id = u.id 
      WHERE c.task_id = ? 
      ORDER BY c.created_at ASC
    `).all(taskId);
    res.json(comments);
  });

  app.post("/api/tasks/:taskId/comments", authenticate, (req: any, res) => {
    const { taskId } = req.params;
    const { content } = req.body;
    const id = uuidv4();
    db.prepare("INSERT INTO comments (id, task_id, user_id, content) VALUES (?, ?, ?, ?)").run(id, taskId, req.user.id, content);
    const comment = db.prepare(`
      SELECT c.*, u.name as user_name, u.avatar as user_avatar 
      FROM comments c 
      JOIN users u ON c.user_id = u.id 
      WHERE c.id = ?
    `).get(id);
    io.emit(`task:${taskId}:comment`, comment);
    res.json(comment);
  });

  // User/Member Routes
  app.get("/api/users", authenticate, (req: any, res) => {
    const users = db.prepare("SELECT id, email, name, avatar FROM users").all();
    res.json(users);
  });

  app.post("/api/workspace/members", authenticate, (req: any, res) => {
    const { email, role } = req.body;
    const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as any;
    if (!user) return res.status(404).json({ error: "User not found" });
    
    try {
      db.prepare("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)").run('default', user.id, role || 'member');
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: "User already a member" });
    }
  });

  // Discussion Routes
  app.get("/api/discussions", authenticate, (req: any, res) => {
    const messages = db.prepare(`
      SELECT m.*, u.name as user_name, u.avatar as user_avatar 
      FROM comments m 
      JOIN users u ON m.user_id = u.id 
      WHERE m.task_id = 'discussion' 
      ORDER BY m.created_at ASC
    `).all();
    res.json(messages);
  });

  app.post("/api/discussions", authenticate, (req: any, res) => {
    const { content } = req.body;
    const id = uuidv4();
    db.prepare("INSERT INTO comments (id, task_id, user_id, content) VALUES (?, ?, ?, ?)").run(id, 'discussion', req.user.id, content);
    const message = db.prepare(`
      SELECT m.*, u.name as user_name, u.avatar as user_avatar 
      FROM comments m 
      JOIN users u ON m.user_id = u.id 
      WHERE m.id = ?
    `).get(id);
    io.emit("discussion:message", message);
    res.json(message);
  });

  // Notification Routes
  app.get("/api/notifications", authenticate, (req: any, res) => {
    const notifications = db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC").all(req.user.id);
    res.json(notifications);
  });

  app.patch("/api/notifications", authenticate, (req: any, res) => {
    db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?").run(req.user.id);
    res.json({ success: true });
  });

  app.patch("/api/notifications/:id", authenticate, (req: any, res) => {
    const { id } = req.params;
    db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?").run(id, req.user.id);
    res.json({ success: true });
  });

  app.post("/api/ai/suggest-breakdown", authenticate, async (req: any, res) => {
    const { title, description } = req.body;
    const subtasks = await suggestTaskBreakdown(title, description);
    res.json({ subtasks });
  });

  // Real-time
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);
    socket.on("disconnect", () => console.log("User disconnected"));
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
