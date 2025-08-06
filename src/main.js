import './style.css'

// Configuration for reverse proxy architecture
const API_BASE_URL = import.meta.env.VITE_API_BASE_PATH || '/zviewer/api';
const ZELLIJ_WEB_URL = import.meta.env.VITE_ZELLIJ_WEB_URL || ''; // Root path - zellij at domain root
const SESSION_REFRESH_INTERVAL = parseInt(import.meta.env.VITE_SESSION_REFRESH_INTERVAL) || 30;

// Application state
let appState = {
  sessions: [],
  selectedSession: null,
  loading: false,
  sidebarCollapsed: false,
  error: null,
  autoRefresh: true,
  refreshInterval: null
};

// Fetch zellij sessions from the backend
async function fetchSessions() {
  try {
    const response = await fetch(`${API_BASE_URL}/sessions`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return { success: false, error: error.message };
  }
}

// Render sidebar sessions list
function renderSidebar(sessionsData) {
  const sidebar = document.querySelector('#sidebar');

  if (!sessionsData.success) {
    sidebar.innerHTML = `
      <div class="sidebar-header">
        <h2>Sessions</h2>
        <button id="refresh-btn" class="icon-btn" title="Refresh">↻</button>
      </div>
      <div class="sidebar-content">
        <div class="error">
          <p>Error loading sessions</p>
          <small>${sessionsData.error}</small>
        </div>
      </div>
    `;
    return;
  }

  if (sessionsData.sessions.length === 0) {
    sidebar.innerHTML = `
      <div class="sidebar-header">
        <h2>Sessions</h2>
        <button id="refresh-btn" class="icon-btn" title="Refresh">↻</button>
      </div>
      <div class="sidebar-content">
        <div class="no-sessions">
          <p>No active sessions</p>
          <small>Start with: <code>zellij</code></small>
        </div>
      </div>
    `;
    return;
  }

  // Update app state
  appState.sessions = sessionsData.sessions;

  const sessionsList = sessionsData.sessions.map(session => {
    const isExited = session.status !== 'active';
    const isSelected = appState.selectedSession?.name === session.name;
    const statusClass = isExited ? 'session-exited' : '';
    const selectedClass = isSelected ? 'selected' : '';

    return `
      <div class="session-item ${statusClass} ${selectedClass}" data-session="${session.name}">
        <div class="session-name">${session.name}</div>
        <div class="session-time">${session.createdAgo} ago</div>
        ${isExited ? `<div class="session-status">${session.status}</div>` : ''}
      </div>
    `;
  }).join('');

  sidebar.innerHTML = `
    <div class="sidebar-header">
      <h2>Sessions (${sessionsData.count})</h2>
      <div class="header-controls">
        <button id="refresh-btn" class="icon-btn" title="Refresh (Ctrl+R)">↻</button>
        <div class="auto-refresh-indicator ${appState.autoRefresh ? 'active' : ''}" title="Auto-refresh every 30s">●</div>
      </div>
    </div>
    <div class="sidebar-content">
      <div class="sessions-list">
        ${sessionsList}
      </div>
    </div>
    <div class="sidebar-footer">
      <button id="new-session-btn" class="btn-secondary" title="Coming soon">+ New Session</button>
      <div class="keyboard-hints">
        <small>↑↓ Navigate • ESC Clear • Ctrl+R Refresh</small>
      </div>
    </div>
  `;
}

// Render main content area
function renderMainContent() {
  const mainContent = document.querySelector('#main-content');

  if (!appState.selectedSession) {
    mainContent.innerHTML = `
      <div class="welcome-screen">
        <h2>Welcome to Zellij Session Manager</h2>
        <p>Select a session from the sidebar to view its terminal interface.</p>
        <div class="welcome-icon">🖥️</div>
      </div>
    `;
    return;
  }

  if (appState.loading) {
    mainContent.innerHTML = `
      <div class="loading-screen">
        <div class="loading-spinner"></div>
        <p>Loading session: ${appState.selectedSession.name}</p>
      </div>
    `;
    return;
  }

  const sessionUrl = `${ZELLIJ_WEB_URL}/${appState.selectedSession.name}`;
  mainContent.innerHTML = `
    <div class="session-viewer">
      <div class="session-header">
        <h3>${appState.selectedSession.name}</h3>
        <span class="session-url">${sessionUrl}</span>
      </div>
      <iframe
        id="session-iframe"
        src="${sessionUrl}"
        frameborder="0"
        title="Zellij Session: ${appState.selectedSession.name}"
        onload="this.style.opacity = '1'"
        onerror="handleIframeError('${appState.selectedSession.name}')">
      </iframe>
    </div>
  `;

  // Set initial iframe opacity for smooth loading
  setTimeout(() => {
    const iframe = document.getElementById('session-iframe');
    if (iframe) {
      iframe.style.opacity = '0';
      iframe.style.transition = 'opacity 0.3s';
    }
  }, 0);
}

// Select a session
function selectSession(sessionName) {
  const session = appState.sessions.find(s => s.name === sessionName);
  if (!session) return;

  appState.selectedSession = session;
  appState.loading = true;

  // Re-render sidebar to update selection
  renderSidebar({ success: true, sessions: appState.sessions, count: appState.sessions.length });
  renderMainContent();

  // Simulate loading time and then remove loading state
  setTimeout(() => {
    appState.loading = false;
    renderMainContent();
  }, 500);
}

// Load and display sessions
async function loadSessions() {
  const refreshButton = document.querySelector('#refresh-btn');

  if (refreshButton) {
    refreshButton.disabled = true;
  }

  const sessionsData = await fetchSessions();
  renderSidebar(sessionsData);

  // If we had a selected session, try to keep it selected
  if (appState.selectedSession) {
    const stillExists = sessionsData.sessions?.find(s => s.name === appState.selectedSession.name);
    if (!stillExists) {
      appState.selectedSession = null;
      renderMainContent();
    }
  }

  if (refreshButton) {
    refreshButton.disabled = false;
  }
}

// Initialize the app
document.querySelector('#app').innerHTML = `
  <div class="app-container">
    <header class="app-header">
      <h1>Zellij Session Manager</h1>
      <div class="header-controls">
        <button id="sidebar-toggle" class="icon-btn" title="Toggle Sidebar">☰</button>
      </div>
    </header>

    <aside id="sidebar" class="sidebar">
      <!-- Sidebar content will be rendered by renderSidebar() -->
    </aside>

    <main id="main-content" class="main-content">
      <!-- Main content will be rendered by renderMainContent() -->
    </main>
  </div>
`;

// Event delegation for dynamic content
document.addEventListener('click', (e) => {
  // Session selection
  if (e.target.closest('.session-item')) {
    const sessionItem = e.target.closest('.session-item');
    const sessionName = sessionItem.dataset.session;
    if (sessionName) {
      selectSession(sessionName);
    }
  }

  // Refresh button
  if (e.target.id === 'refresh-btn') {
    loadSessions();
  }

  // Sidebar toggle (for mobile)
  if (e.target.id === 'sidebar-toggle') {
    appState.sidebarCollapsed = !appState.sidebarCollapsed;
    document.querySelector('#sidebar').classList.toggle('collapsed', appState.sidebarCollapsed);
  }

  // New session button (placeholder for future)
  if (e.target.id === 'new-session-btn') {
    console.log('New session functionality coming soon!');
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + R: Refresh sessions
  if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
    e.preventDefault();
    loadSessions();
  }

  // Escape: Deselect session
  if (e.key === 'Escape' && appState.selectedSession) {
    appState.selectedSession = null;
    renderSidebar({ success: true, sessions: appState.sessions, count: appState.sessions.length });
    renderMainContent();
  }

  // Arrow keys: Navigate sessions
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault();
    navigateSessionsWithKeyboard(e.key === 'ArrowUp' ? -1 : 1);
  }
});

// Navigate sessions with keyboard
function navigateSessionsWithKeyboard(direction) {
  if (appState.sessions.length === 0) return;

  let currentIndex = -1;
  if (appState.selectedSession) {
    currentIndex = appState.sessions.findIndex(s => s.name === appState.selectedSession.name);
  }

  const newIndex = Math.max(0, Math.min(appState.sessions.length - 1, currentIndex + direction));
  const newSession = appState.sessions[newIndex];

  if (newSession) {
    selectSession(newSession.name);
  }
}

// Auto-refresh functionality
function startAutoRefresh() {
  if (appState.refreshInterval) {
    clearInterval(appState.refreshInterval);
  }

  if (appState.autoRefresh) {
    appState.refreshInterval = setInterval(() => {
      loadSessions();
    }, SESSION_REFRESH_INTERVAL * 1000); // Refresh interval from environment variable
  }
}

function stopAutoRefresh() {
  if (appState.refreshInterval) {
    clearInterval(appState.refreshInterval);
    appState.refreshInterval = null;
  }
}

// Enhanced error handling for iframe
function handleIframeError(sessionName) {
  const mainContent = document.querySelector('#main-content');
  mainContent.innerHTML = `
    <div class="error-screen">
      <h2>Session Unavailable</h2>
      <p>Unable to connect to session: <strong>${sessionName}</strong></p>
      <p>The session may have ended or the zellij web server may be offline.</p>
      <div class="error-actions">
        <button onclick="selectSession('${sessionName}')" class="btn-secondary">Retry</button>
        <button onclick="appState.selectedSession = null; renderMainContent()" class="btn-secondary">Back to Welcome</button>
      </div>
    </div>
  `;
}

// Load sessions and render initial content
loadSessions();
renderMainContent();
startAutoRefresh();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  stopAutoRefresh();
});
