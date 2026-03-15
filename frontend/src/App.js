import { useState, useEffect } from "react";
import "./App.css";

const API = "http://localhost:3001";

const PRIORITIES = ["low", "medium", "high"];
const STATUSES = ["todo", "inprogress", "done"];

function App() {
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [projectForm, setProjectForm] = useState({ name: "", description: "", deadline: "" });
  const [taskForm, setTaskForm] = useState({ title: "", description: "", priority: "medium", assignedTo: "", dueDate: "" });
  const [memberInput, setMemberInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchProjects(); }, []);

  // 📥 Fetch all projects
  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API}/projects`);
      const data = await res.json();
      setProjects(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // 📥 Fetch single project
  const fetchProject = async (id) => {
    try {
      const res = await fetch(`${API}/projects/${id}`);
      const data = await res.json();
      setActiveProject(data);
    } catch (err) {
      console.error(err);
    }
  };

  // ➕ Create project
  const createProject = async () => {
    if (!projectForm.name) { alert("Project name is required!"); return; }
    setLoading(true);
    try {
      await fetch(`${API}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectForm),
      });
      setProjectForm({ name: "", description: "", deadline: "" });
      setShowProjectForm(false);
      fetchProjects();
    } catch (err) { alert("Failed!"); }
    setLoading(false);
  };

  // 🗑️ Delete project
  const deleteProject = async (id) => {
    if (!window.confirm("Delete this project?")) return;
    await fetch(`${API}/projects/${id}`, { method: "DELETE" });
    setActiveProject(null);
    fetchProjects();
  };

  // ➕ Create task
  const createTask = async () => {
    if (!taskForm.title) { alert("Task title is required!"); return; }
    setLoading(true);
    try {
      await fetch(`${API}/projects/${activeProject.id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskForm),
      });
      setTaskForm({ title: "", description: "", priority: "medium", assignedTo: "", dueDate: "" });
      setShowTaskForm(false);
      fetchProject(activeProject.id);
    } catch (err) { alert("Failed!"); }
    setLoading(false);
  };

  // 🔄 Update task status
  const updateTaskStatus = async (taskId, status) => {
    await fetch(`${API}/projects/${activeProject.id}/tasks/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchProject(activeProject.id);
  };

  // 🗑️ Delete task
  const deleteTask = async (taskId) => {
    await fetch(`${API}/projects/${activeProject.id}/tasks/${taskId}`, { method: "DELETE" });
    fetchProject(activeProject.id);
  };

  // ➕ Add member
  const addMember = async () => {
    if (!memberInput.trim()) return;
    await fetch(`${API}/projects/${activeProject.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member: memberInput.trim() }),
    });
    setMemberInput("");
    setShowMemberForm(false);
    fetchProject(activeProject.id);
  };

  // 🗑️ Remove member
  const removeMember = async (member) => {
    await fetch(`${API}/projects/${activeProject.id}/members/${encodeURIComponent(member)}`, { method: "DELETE" });
    fetchProject(activeProject.id);
  };

  // 📊 Progress calculation
  const getProgress = (tasks) => {
    if (!tasks || tasks.length === 0) return 0;
    const done = tasks.filter(t => t.status === "done").length;
    return Math.round((done / tasks.length) * 100);
  };

  // Kanban columns
  const getTasksByStatus = (status) => activeProject?.tasks?.filter(t => t.status === status) || [];

  return (
    <div className="app">
      {/* ── Sidebar ── */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>⚡ TaskFlow</h2>
          <p>Project Manager</p>
          <button className="new-project-btn" onClick={() => setShowProjectForm(true)}>+ New Project</button>
        </div>

        <div className="project-list">
          {projects.length === 0 && <p className="no-items">No projects yet!</p>}
          {projects.map(p => (
            <div
              key={p.id}
              className={`project-item ${activeProject?.id === p.id ? "active" : ""}`}
              onClick={() => fetchProject(p.id)}
            >
              <div className="project-item-info">
                <span className="project-item-name">{p.name}</span>
                <span className="project-item-tasks">{p.tasks?.length || 0} tasks</span>
              </div>
              <div className="project-item-progress">
                <div className="mini-progress">
                  <div className="mini-progress-fill" style={{ width: `${getProgress(p.tasks)}%` }}></div>
                </div>
                <span>{getProgress(p.tasks)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="main">
        {!activeProject ? (
          <div className="welcome">
            <h1>⚡ TaskFlow</h1>
            <p>Software Engineering Project Manager</p>
            <button className="start-btn" onClick={() => setShowProjectForm(true)}>+ Create Your First Project</button>
          </div>
        ) : (
          <>
            {/* Project Header */}
            <div className="project-header">
              <div className="project-header-left">
                <h2>{activeProject.name}</h2>
                <p>{activeProject.description}</p>
                {activeProject.deadline && <span className="deadline">📅 Deadline: {activeProject.deadline}</span>}
              </div>
              <div className="project-header-right">
                <div className="progress-circle">
                  <span>{getProgress(activeProject.tasks)}%</span>
                  <p>Complete</p>
                </div>
                <button className="danger-btn" onClick={() => deleteProject(activeProject.id)}>🗑️ Delete Project</button>
              </div>
            </div>

            {/* Stats */}
            <div className="task-stats">
              <div className="stat-box todo">
                <span>{getTasksByStatus("todo").length}</span>
                <p>To Do</p>
              </div>
              <div className="stat-box inprogress">
                <span>{getTasksByStatus("inprogress").length}</span>
                <p>In Progress</p>
              </div>
              <div className="stat-box done">
                <span>{getTasksByStatus("done").length}</span>
                <p>Done</p>
              </div>
              <div className="stat-box total">
                <span>{activeProject.tasks?.length || 0}</span>
                <p>Total Tasks</p>
              </div>
            </div>

            {/* Members */}
            <div className="members-section">
              <div className="section-header">
                <h3>👥 Team Members</h3>
                <button className="add-btn" onClick={() => setShowMemberForm(true)}>+ Add Member</button>
              </div>
              <div className="members-list">
                {activeProject.members?.length === 0 && <p className="no-items">No members yet!</p>}
                {activeProject.members?.map((m, i) => (
                  <div key={i} className="member-tag">
                    <span>👤 {m}</span>
                    <button onClick={() => removeMember(m)}>×</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Kanban Board */}
            <div className="kanban-header">
              <h3>📋 Kanban Board</h3>
              <button className="add-btn" onClick={() => setShowTaskForm(true)}>+ Add Task</button>
            </div>

            <div className="kanban">
              {/* To Do */}
              <div className="kanban-col todo">
                <div className="kanban-col-header">
                  <span>🔵 To Do</span>
                  <span className="count">{getTasksByStatus("todo").length}</span>
                </div>
                {getTasksByStatus("todo").map(task => (
                  <TaskCard key={task.id} task={task} onStatusChange={updateTaskStatus} onDelete={deleteTask} members={activeProject.members} />
                ))}
              </div>

              {/* In Progress */}
              <div className="kanban-col inprogress">
                <div className="kanban-col-header">
                  <span>🟡 In Progress</span>
                  <span className="count">{getTasksByStatus("inprogress").length}</span>
                </div>
                {getTasksByStatus("inprogress").map(task => (
                  <TaskCard key={task.id} task={task} onStatusChange={updateTaskStatus} onDelete={deleteTask} members={activeProject.members} />
                ))}
              </div>

              {/* Done */}
              <div className="kanban-col done">
                <div className="kanban-col-header">
                  <span>🟢 Done</span>
                  <span className="count">{getTasksByStatus("done").length}</span>
                </div>
                {getTasksByStatus("done").map(task => (
                  <TaskCard key={task.id} task={task} onStatusChange={updateTaskStatus} onDelete={deleteTask} members={activeProject.members} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── New Project Modal ── */}
      {showProjectForm && (
        <div className="modal-overlay" onClick={() => setShowProjectForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>🚀 New Project</h2>
            <div className="form-group">
              <label>Project Name *</label>
              <input type="text" placeholder="e.g. E-Commerce Website" value={projectForm.name}
                onChange={e => setProjectForm({ ...projectForm, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea placeholder="Describe your project..." value={projectForm.description}
                onChange={e => setProjectForm({ ...projectForm, description: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Deadline</label>
              <input type="date" value={projectForm.deadline}
                onChange={e => setProjectForm({ ...projectForm, deadline: e.target.value })} />
            </div>
            <div className="form-actions">
              <button className="cancel-btn" onClick={() => setShowProjectForm(false)}>Cancel</button>
              <button className="submit-btn" onClick={createProject} disabled={loading}>
                {loading ? "Creating..." : "🚀 Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Task Modal ── */}
      {showTaskForm && (
        <div className="modal-overlay" onClick={() => setShowTaskForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>📌 New Task</h2>
            <div className="form-group">
              <label>Task Title *</label>
              <input type="text" placeholder="e.g. Design login page" value={taskForm.title}
                onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea placeholder="Task details..." value={taskForm.description}
                onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Priority</label>
                <select value={taskForm.priority} onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Due Date</label>
                <input type="date" value={taskForm.dueDate}
                  onChange={e => setTaskForm({ ...taskForm, dueDate: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label>Assign To</label>
              <select value={taskForm.assignedTo} onChange={e => setTaskForm({ ...taskForm, assignedTo: e.target.value })}>
                <option value="">Unassigned</option>
                {activeProject?.members?.map((m, i) => <option key={i} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-actions">
              <button className="cancel-btn" onClick={() => setShowTaskForm(false)}>Cancel</button>
              <button className="submit-btn" onClick={createTask} disabled={loading}>
                {loading ? "Adding..." : "📌 Add Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Member Modal ── */}
      {showMemberForm && (
        <div className="modal-overlay" onClick={() => setShowMemberForm(false)}>
          <div className="modal small" onClick={e => e.stopPropagation()}>
            <h2>👥 Add Member</h2>
            <div className="form-group">
              <label>Member Name *</label>
              <input type="text" placeholder="e.g. John Doe" value={memberInput}
                onChange={e => setMemberInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addMember()} />
            </div>
            <div className="form-actions">
              <button className="cancel-btn" onClick={() => setShowMemberForm(false)}>Cancel</button>
              <button className="submit-btn" onClick={addMember}>➕ Add Member</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Task Card Component ──
function TaskCard({ task, onStatusChange, onDelete, members }) {
  const priorityColors = { low: "green", medium: "amber", high: "red" };
  const nextStatus = { todo: "inprogress", inprogress: "done", done: "todo" };
  const nextLabel = { todo: "▶ Start", inprogress: "✅ Done", done: "🔄 Reopen" };

  return (
    <div className={`task-card priority-${task.priority}`}>
      <div className="task-card-header">
        <span className={`priority-badge ${task.priority}`}>{task.priority}</span>
        <button className="task-delete-btn" onClick={() => onDelete(task.id)}>×</button>
      </div>
      <h4>{task.title}</h4>
      {task.description && <p className="task-desc">{task.description}</p>}
      <div className="task-meta">
        {task.assignedTo && <span>👤 {task.assignedTo}</span>}
        {task.dueDate && <span>📅 {task.dueDate}</span>}
      </div>
      <button className="move-btn" onClick={() => onStatusChange(task.id, nextStatus[task.status])}>
        {nextLabel[task.status]}
      </button>
    </div>
  );
}

export default App;