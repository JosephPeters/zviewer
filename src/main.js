import './style.css'
import { SessionVisibilityStore } from './storage.js';

// Configuration for reverse proxy architecture
const API_BASE_URL = import.meta.env.VITE_API_BASE_PATH || '/zviewer/api';
const ZELLIJ_WEB_URL = import.meta.env.VITE_ZELLIJ_WEB_URL || ''; // Root path - zellij at domain root
const SESSION_REFRESH_INTERVAL = parseInt(import.meta.env.VITE_SESSION_REFRESH_INTERVAL) || 300;

// Initialize visibility store
const visibilityStore = new SessionVisibilityStore();

// Helper function to create Lucide SVG icons
function icon(name, size = 16, className = '') {
  const paths = {
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>',
    refreshCw: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    rotateCcw: '<path d="M3 12a9 9 0 1 0 3-7.23L6 5"/><path d="M6 5H3v3"/>',
    menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    circle: '<circle cx="12" cy="12" r="10"/>',
    pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'
  };
  
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-${name} ${className}">
    ${paths[name] || ''}
  </svg>`;
}

// Application state
let appState = {
  sessions: [], // Will store current session list for comparison
  selectedSession: null,
  loading: false,
  sidebarCollapsed: false,
  error: null,
  autoRefresh: true,
  refreshInterval: null,
  
  // Session visibility state
  hiddenSessions: new Set(visibilityStore.getHiddenSessions()),
  autoHideExited: visibilityStore.getAutoHideExited(),
  showHiddenSessions: visibilityStore.getShowHidden(),
  visibleSessions: [],
  hiddenSessionsCount: 0
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

// Compute which sessions should be visible based on visibility rules
function computeVisibleSessions() {
  const { sessions, hiddenSessions, autoHideExited, showHiddenSessions } = appState;
  
  let visible = [];
  let hidden = [];
  
  sessions.forEach(session => {
    const isManuallyHidden = hiddenSessions.has(session.name);
    const isAutoHidden = autoHideExited && session.status !== 'active';
    const shouldHide = isManuallyHidden || isAutoHidden;
    
    if (shouldHide) {
      hidden.push({ ...session, hiddenReason: isManuallyHidden ? 'manual' : 'auto' });
    } else {
      visible.push(session);
    }
  });
  
  // Add hidden sessions if toggled to show
  if (showHiddenSessions) {
    visible = [...visible, ...hidden.map(s => ({ ...s, isHidden: true }))];
  }
  
  appState.visibleSessions = visible;
  appState.hiddenSessionsCount = hidden.length;
}

// Session visibility management functions
function hideSession(sessionName) {
  visibilityStore.hideSession(sessionName);
  appState.hiddenSessions.add(sessionName);
  
  // If hiding the selected session, deselect it
  if (appState.selectedSession?.name === sessionName) {
    appState.selectedSession = null;
  }
  
  refreshSessionsDisplay();
}

function unhideSession(sessionName) {
  visibilityStore.unhideSession(sessionName);
  appState.hiddenSessions.delete(sessionName);
  refreshSessionsDisplay();
}

function toggleHiddenSessionsVisibility() {
  appState.showHiddenSessions = !appState.showHiddenSessions;
  visibilityStore.setShowHidden(appState.showHiddenSessions);
  refreshSessionsDisplay();
}

function toggleAutoHideExited() {
  appState.autoHideExited = !appState.autoHideExited;
  visibilityStore.setAutoHideExited(appState.autoHideExited);
  refreshSessionsDisplay();
}

function refreshSessionsDisplay() {
  computeVisibleSessions();
  renderSidebar({ 
    success: true, 
    sessions: appState.sessions, 
    count: appState.sessions.length 
  });
  renderMainContent();
}

// Render individual session item
function renderSessionItem(session) {
  const isHidden = session.isHidden || false;
  const isSelected = appState.selectedSession?.name === session.name;
  const statusClass = session.status !== 'active' ? 'session-exited' : '';
  const selectedClass = isSelected ? 'selected' : '';
  const hiddenClass = isHidden ? 'hidden' : '';
  
  const statusIcon = session.status === 'active' ? 
    icon('play', 12, 'status-active') : 
    icon('pause', 12, 'status-inactive');
    
  return `
    <div class="session-item ${statusClass} ${selectedClass} ${hiddenClass}" data-session="${session.name}">
      <div class="session-status-icon">
        ${statusIcon}
      </div>
      <div class="session-content">
        <div class="session-name">${session.name}</div>
        <div class="session-time">${session.createdAgo} ago</div>
        ${session.status !== 'active' ? `<div class="session-status">${session.status}</div>` : ''}
        ${isHidden ? `<div class="hidden-indicator">Hidden (${session.hiddenReason})</div>` : ''}
      </div>
      <div class="session-controls">
        <button class="toggle-visibility-btn" 
                data-session="${session.name}" 
                data-action="${isHidden ? 'show' : 'hide'}"
                title="${isHidden ? 'Show session' : 'Hide session'}">
          ${isHidden ? icon('eye', 16) : icon('eyeOff', 16)}
        </button>
      </div>
    </div>
  `;
}

// Render sessions list with grouping
function renderSessionsList() {
  const { visibleSessions, showHiddenSessions } = appState;
  
  if (visibleSessions.length === 0) {
    return '<div class="no-sessions"><p>No sessions to display</p></div>';
  }
  
  // Group sessions by visibility
  const activeVisible = visibleSessions.filter(s => !s.isHidden);
  const hiddenVisible = visibleSessions.filter(s => s.isHidden);
  
  let html = '';
  
  // Render visible sessions
  if (activeVisible.length > 0) {
    html += `
      <div class="visible-sessions-section">
        ${activeVisible.map(renderSessionItem).join('')}
      </div>
    `;
  }
  
  // Render hidden sessions section if shown
  if (showHiddenSessions && hiddenVisible.length > 0) {
    html += `
      <div class="hidden-sessions-section">
        <div class="hidden-sessions-header">
          Hidden Sessions (${hiddenVisible.length})
        </div>
        ${hiddenVisible.map(renderSessionItem).join('')}
      </div>
    `;
  }
  
  return `<div class="sessions-list">${html}</div>`;
}

// Render sidebar header with visibility controls
function renderSidebarHeader(sessionsData) {
  const totalCount = sessionsData.count;
  const visibleCount = appState.visibleSessions.filter(s => !s.isHidden).length;
  const hiddenCount = appState.hiddenSessionsCount;
  
  const countText = hiddenCount > 0 
    ? `${visibleCount}`
    : `${totalCount}`;
    
  return `
    <div class="sidebar-header">
      <h2>Sessions (${countText})</h2>
      <div class="header-controls">
        ${hiddenCount > 0 ? `
          <button id="toggle-hidden-btn" 
                  class="icon-btn ${appState.showHiddenSessions ? 'active' : ''}" 
                  title="Show/Hide hidden sessions">
            ${icon('eye', 14)} ${hiddenCount}
          </button>
        ` : ''}
        
        <button id="refresh-btn" class="icon-btn" title="Refresh (Ctrl+R)">${icon('refreshCw', 14)}</button>
        <div class="auto-refresh-indicator ${appState.autoRefresh ? 'active' : ''}" title="Auto-refresh every 30s"></div>
      </div>
    </div>
  `;
}

// Render sidebar sessions list
function renderSidebar(sessionsData) {
  const sidebar = document.querySelector('#sidebar');

  if (!sessionsData.success) {
    sidebar.innerHTML = `
      <div class="sidebar-header">
        <h2>Sessions</h2>
        <button id="refresh-btn" class="icon-btn" title="Refresh">${icon('refreshCw', 14)}</button>
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
        <button id="refresh-btn" class="icon-btn" title="Refresh">${icon('refreshCw', 14)}</button>
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

  // Update app state and compute visibility
  appState.sessions = sessionsData.sessions;
  computeVisibleSessions();

  sidebar.innerHTML = `
    ${renderSidebarHeader(sessionsData)}
    <div class="sidebar-content">
      ${renderSessionsList()}
    </div>
    <div class="sidebar-footer">
      <button id="new-session-btn" class="btn-secondary" title="Create new session">${icon('plus', 16)} New Session</button>
      <div class="keyboard-hints">
        <small>↑↓ Navigate • ESC Clear • Ctrl+R Refresh • Ctrl+N New</small>
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
        <div class="welcome-icon">${icon('monitor', 64)}</div>
        <h2>Welcome to Zellij Session Manager</h2>
        <p>Select a session from the sidebar to view its terminal interface.</p>
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

  // Handle new session creation
  if (appState.selectedSession.isNew) {
    mainContent.innerHTML = `
      <div class="session-viewer">
        <div class="session-header">
          <h3>Create New Session</h3>
          
        </div>
        <iframe
          id="session-iframe"
          src="${ZELLIJ_WEB_URL}/"
          frameborder="0"
          title="Create New Zellij Session"
          onload="this.style.opacity = '1'; handleNewSessionIframeLoad()">
        </iframe>
      </div>
    `;

    // Set initial iframe opacity for smooth loading
    setTimeout(() => {
      const iframe = document.querySelector('#session-iframe');
      if (iframe) {
        iframe.style.opacity = '0';
      }
    }, 100);
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

// Auto-hide newly exited sessions if auto-hide is enabled
function autoHideExitedSessions(previousSessions, currentSessions) {
  if (!appState.autoHideExited) return;

  currentSessions.forEach(currentSession => {
    // Check if this session was previously active but is now exited
    const previousSession = previousSessions.find(p => p.name === currentSession.name);
    
    if (previousSession && 
        previousSession.status === 'active' && 
        currentSession.status !== 'active' &&
        !appState.hiddenSessions.has(currentSession.name)) {
      
      // Auto-hide this newly exited session
      console.log(`Auto-hiding exited session: ${currentSession.name}`);
      visibilityStore.hideSession(currentSession.name);
      appState.hiddenSessions.add(currentSession.name);
    }
  });
}

// Load and display sessions
async function loadSessions() {
  const refreshButton = document.querySelector('#refresh-btn');

  if (refreshButton) {
    refreshButton.disabled = true;
  }

  // Store previous sessions for new session detection and auto-hide logic
  const previousSessions = [...appState.sessions];

  const sessionsData = await fetchSessions();

  // Update app state with new sessions
  if (sessionsData.success) {
    appState.sessions = sessionsData.sessions;
    
    // Auto-hide exited sessions if enabled
    autoHideExitedSessions(previousSessions, sessionsData.sessions);
  }

  renderSidebar(sessionsData);

  // Handle session state based on current selection
  if (appState.selectedSession && sessionsData.success) {
    if (appState.selectedSession.isNew) {
      // Option A: Preserve new session state during refresh
      // Option B: Check if a new session was created
      const newSession = detectNewSession(previousSessions, sessionsData.sessions);
      if (newSession) {
        // Auto-switch to the newly created session
        console.log(`New session detected: ${newSession.name} - switching to it`);
        appState.selectedSession = newSession;
        renderMainContent();
      }
      // If no new session detected, keep the new session interface active
    } else {
      // Regular session validation - clear if session no longer exists
      const stillExists = sessionsData.sessions.find(s => s.name === appState.selectedSession.name);
      if (!stillExists) {
        appState.selectedSession = null;
        renderMainContent();
      } else {
        // Check if selected session was auto-hidden
        if (appState.hiddenSessions.has(appState.selectedSession.name)) {
          appState.selectedSession = null;
          renderMainContent();
        }
      }
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
        <button id="sidebar-toggle" class="icon-btn" title="Toggle Sidebar">${icon('menu', 18)}</button>
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
  // Session visibility toggle - handle before session selection
  if (e.target.closest('.toggle-visibility-btn')) {
    e.stopPropagation(); // Prevent session selection
    const btn = e.target.closest('.toggle-visibility-btn');
    const sessionName = btn.dataset.session;
    const action = btn.dataset.action;
    
    if (action === 'hide') {
      hideSession(sessionName);
    } else {
      unhideSession(sessionName);
    }
    return;
  }

  // Session selection
  if (e.target.closest('.session-item')) {
    const sessionItem = e.target.closest('.session-item');
    const sessionName = sessionItem.dataset.session;
    if (sessionName) {
      selectSession(sessionName);
    }
  }

  // Toggle hidden sessions visibility
  if (e.target.id === 'toggle-hidden-btn') {
    toggleHiddenSessionsVisibility();
    return;
  }

  // Auto-hide toggle
  if (e.target.id === 'auto-hide-toggle') {
    toggleAutoHideExited();
    return;
  }

  // Refresh button
  if (e.target.id === 'refresh-btn') {
    loadSessions();
  }

  // New session button
  if (e.target.id === 'new-session-btn') {
    createNewSession();
  }

  // Sidebar toggle (for mobile)
  if (e.target.id === 'sidebar-toggle') {
    appState.sidebarCollapsed = !appState.sidebarCollapsed;
    document.querySelector('#sidebar').classList.toggle('collapsed', appState.sidebarCollapsed);
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + R: Refresh sessions
  if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
    e.preventDefault();
    loadSessions();
  }

  // Ctrl/Cmd + N: New session
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    createNewSession();
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

// Detect newly created sessions by comparing before/after
function detectNewSession(previousSessions, currentSessions) {
  // Find sessions that exist now but didn't exist before
  const newSessions = currentSessions.filter(current =>
    !previousSessions.find(prev => prev.name === current.name)
  );

  // Return the most recently created new session (first in list is usually newest)
  return newSessions.length > 0 ? newSessions[0] : null;
}

// Create new session
function createNewSession() {
  // Set state to show we're creating a new session
  appState.selectedSession = {
    name: 'New Session',
    isNew: true
  };
  renderMainContent();
}

// Handle new session iframe load
function handleNewSessionIframeLoad() {
  console.log('New session interface loaded - user can now create a session');
  // Optional: Could add additional logic here like detecting when a session is created
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
