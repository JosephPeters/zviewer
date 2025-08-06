# Session Hiding/Unhiding Feature Plan

## 🎯 **Overview**

This plan outlines the implementation of session visibility management for the Zellij Session Viewer, allowing users to:
1. **Manually hide/unhide individual sessions** from the sessions list
2. **Auto-hide exited sessions** to reduce UI clutter
3. **Toggle visibility of hidden sessions** with a show/hide control

## 📋 **Current State Analysis**

### **Existing Session Data Structure**
```javascript
// server.js - Current session object
{
  name: "session_name",
  createdAgo: "2 hours",
  status: "active" | "exited" | other,
  raw: "original zellij output line"
}

// main.js - Current app state
appState = {
  sessions: [],           // All fetched sessions
  selectedSession: null,  // Currently viewed session
  loading: false,
  sidebarCollapsed: false,
  error: null,
  autoRefresh: true,
  refreshInterval: null
}
```

### **Current Session Rendering Logic**
- Sessions are displayed in a list with status indicators
- Exited sessions show with different styling (`session-exited` class)
- No current mechanism for hiding/showing sessions

## 🏗️ **Architecture Design**

### **Data Storage Strategy**

#### **Local Storage Approach (Recommended)**
```javascript
// localStorage keys
HIDDEN_SESSIONS_KEY = 'zview_hidden_sessions'
AUTO_HIDE_EXITED_KEY = 'zview_auto_hide_exited'
SHOW_HIDDEN_KEY = 'zview_show_hidden'

// Storage format
localStorage.setItem(HIDDEN_SESSIONS_KEY, JSON.stringify([
  'session1',
  'session2'
]));
```

**Pros:**
- Persists across browser sessions
- No backend changes required
- Simple implementation
- Per-user preferences

**Cons:**
- Not shared across devices/browsers
- Cleared if user clears browser data

#### **Alternative: Backend Storage**
Could store in a JSON file or database, but adds complexity and requires backend changes.

### **Enhanced App State**
```javascript
appState = {
  sessions: [],                    // All fetched sessions
  selectedSession: null,
  loading: false,
  sidebarCollapsed: false,
  error: null,
  autoRefresh: true,
  refreshInterval: null,
  
  // NEW: Session visibility state
  hiddenSessions: new Set(),       // Set of hidden session names
  autoHideExited: true,            // Auto-hide exited sessions
  showHiddenSessions: false,       // Toggle to show/hide hidden sessions
  
  // NEW: Computed properties
  visibleSessions: [],             // Filtered sessions for display
  hiddenSessionsCount: 0           // Count of hidden sessions
}
```

## 🎨 **UI/UX Design**

### **Session List Item Controls**
Each session item will have a visibility toggle:

```html
<div class="session-item">
  <div class="session-content">
    <div class="session-name">session_name</div>
    <div class="session-time">2 hours ago</div>
  </div>
  <div class="session-controls">
    <button class="hide-session-btn" title="Hide session">👁️</button>
    <!-- or -->
    <button class="show-session-btn" title="Show session">👁️‍🗨️</button>
  </div>
</div>
```

### **Sidebar Header Controls**
Enhanced header with visibility controls:

```html
<div class="sidebar-header">
  <h2>Sessions (5 visible, 3 hidden)</h2>
  <div class="header-controls">
    <button id="toggle-hidden-btn" class="icon-btn" title="Show/Hide hidden sessions">
      👁️ 3
    </button>
    <button id="auto-hide-toggle" class="icon-btn ${autoHideExited ? 'active' : ''}" title="Auto-hide exited sessions">
      🔄
    </button>
    <button id="refresh-btn" class="icon-btn" title="Refresh">↻</button>
    <div class="auto-refresh-indicator">●</div>
  </div>
</div>
```

### **Visual Indicators**
```css
/* Hidden session styling */
.session-item.hidden {
  opacity: 0.5;
  border-left: 3px solid var(--color-warning);
}

/* Hidden sessions section */
.hidden-sessions-section {
  border-top: 1px solid var(--color-border);
  margin-top: 1rem;
  padding-top: 1rem;
}

.hidden-sessions-header {
  font-size: 0.9rem;
  color: var(--color-muted);
  margin-bottom: 0.5rem;
}
```

## 🔧 **Implementation Plan**

### **Phase 1: Core Infrastructure**

#### **1.1 Local Storage Utilities**
```javascript
// src/storage.js (new file)
const STORAGE_KEYS = {
  HIDDEN_SESSIONS: 'zview_hidden_sessions',
  AUTO_HIDE_EXITED: 'zview_auto_hide_exited',
  SHOW_HIDDEN: 'zview_show_hidden'
};

class SessionVisibilityStore {
  getHiddenSessions() {
    const stored = localStorage.getItem(STORAGE_KEYS.HIDDEN_SESSIONS);
    return stored ? JSON.parse(stored) : [];
  }
  
  hideSession(sessionName) {
    const hidden = new Set(this.getHiddenSessions());
    hidden.add(sessionName);
    localStorage.setItem(STORAGE_KEYS.HIDDEN_SESSIONS, JSON.stringify([...hidden]));
  }
  
  unhideSession(sessionName) {
    const hidden = new Set(this.getHiddenSessions());
    hidden.delete(sessionName);
    localStorage.setItem(STORAGE_KEYS.HIDDEN_SESSIONS, JSON.stringify([...hidden]));
  }
  
  getAutoHideExited() {
    return localStorage.getItem(STORAGE_KEYS.AUTO_HIDE_EXITED) !== 'false';
  }
  
  setAutoHideExited(enabled) {
    localStorage.setItem(STORAGE_KEYS.AUTO_HIDE_EXITED, enabled.toString());
  }
  
  getShowHidden() {
    return localStorage.getItem(STORAGE_KEYS.SHOW_HIDDEN) === 'true';
  }
  
  setShowHidden(show) {
    localStorage.setItem(STORAGE_KEYS.SHOW_HIDDEN, show.toString());
  }
}
```

#### **1.2 Enhanced App State Management**
```javascript
// main.js - Enhanced state initialization
function initializeAppState() {
  const store = new SessionVisibilityStore();
  
  return {
    // ... existing state
    hiddenSessions: new Set(store.getHiddenSessions()),
    autoHideExited: store.getAutoHideExited(),
    showHiddenSessions: store.getShowHidden(),
    visibleSessions: [],
    hiddenSessionsCount: 0
  };
}

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
```

### **Phase 2: UI Controls**

#### **2.1 Session Item Controls**
```javascript
// Enhanced session item rendering
function renderSessionItem(session) {
  const isHidden = session.isHidden || false;
  const isSelected = appState.selectedSession?.name === session.name;
  const statusClass = session.status !== 'active' ? 'session-exited' : '';
  const selectedClass = isSelected ? 'selected' : '';
  const hiddenClass = isHidden ? 'hidden' : '';
  
  return `
    <div class="session-item ${statusClass} ${selectedClass} ${hiddenClass}" data-session="${session.name}">
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
          ${isHidden ? '👁️‍🗨️' : '👁️'}
        </button>
      </div>
    </div>
  `;
}
```

#### **2.2 Sidebar Header Enhancement**
```javascript
function renderSidebarHeader(sessionsData) {
  const totalCount = sessionsData.count;
  const visibleCount = appState.visibleSessions.length;
  const hiddenCount = appState.hiddenSessionsCount;
  
  const countText = hiddenCount > 0 
    ? `${visibleCount} visible, ${hiddenCount} hidden`
    : `${totalCount}`;
    
  return `
    <div class="sidebar-header">
      <h2>Sessions (${countText})</h2>
      <div class="header-controls">
        ${hiddenCount > 0 ? `
          <button id="toggle-hidden-btn" 
                  class="icon-btn ${appState.showHiddenSessions ? 'active' : ''}" 
                  title="Show/Hide hidden sessions">
            👁️ ${hiddenCount}
          </button>
        ` : ''}
        <button id="auto-hide-toggle" 
                class="icon-btn ${appState.autoHideExited ? 'active' : ''}" 
                title="Auto-hide exited sessions">
          🔄
        </button>
        <button id="refresh-btn" class="icon-btn" title="Refresh">↻</button>
        <div class="auto-refresh-indicator ${appState.autoRefresh ? 'active' : ''}">●</div>
      </div>
    </div>
  `;
}
```

#### **2.3 Enhanced Session List Rendering**
```javascript
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
```

### **Phase 3: Event Handlers**

#### **3.1 Visibility Toggle Handlers**
```javascript
// Enhanced click event delegation
document.addEventListener('click', (e) => {
  // ... existing handlers
  
  // Session visibility toggle
  if (e.target.closest('.toggle-visibility-btn')) {
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
});
```

#### **3.2 Action Functions**
```javascript
function hideSession(sessionName) {
  const store = new SessionVisibilityStore();
  store.hideSession(sessionName);
  appState.hiddenSessions.add(sessionName);
  
  // If hiding the selected session, deselect it
  if (appState.selectedSession?.name === sessionName) {
    appState.selectedSession = null;
  }
  
  refreshSessionsDisplay();
}

function unhideSession(sessionName) {
  const store = new SessionVisibilityStore();
  store.unhideSession(sessionName);
  appState.hiddenSessions.delete(sessionName);
  refreshSessionsDisplay();
}

function toggleHiddenSessionsVisibility() {
  appState.showHiddenSessions = !appState.showHiddenSessions;
  const store = new SessionVisibilityStore();
  store.setShowHidden(appState.showHiddenSessions);
  refreshSessionsDisplay();
}

function toggleAutoHideExited() {
  appState.autoHideExited = !appState.autoHideExited;
  const store = new SessionVisibilityStore();
  store.setAutoHideExited(appState.autoHideExited);
  refreshSessionsDisplay();
}

function refreshSessionsDisplay() {
  computeVisibleSessions();
  renderSidebar({ 
    success: true, 
    sessions: appState.sessions, 
    count: appState.sessions.length 
  });
}
```

### **Phase 4: Auto-Hide Logic**

#### **4.1 Enhanced Session Loading**
```javascript
async function loadSessions() {
  const refreshButton = document.querySelector('#refresh-btn');
  
  if (refreshButton) {
    refreshButton.disabled = true;
  }
  
  const sessionsData = await fetchSessions();
  appState.sessions = sessionsData.sessions || [];
  
  // Auto-hide newly exited sessions
  if (appState.autoHideExited) {
    autoHideExitedSessions();
  }
  
  computeVisibleSessions();
  renderSidebar(sessionsData);
  
  // Handle selected session state
  if (appState.selectedSession) {
    const stillExists = appState.sessions.find(s => s.name === appState.selectedSession.name);
    if (!stillExists) {
      appState.selectedSession = null;
      renderMainContent();
    }
  }
  
  if (refreshButton) {
    refreshButton.disabled = false;
  }
}

function autoHideExitedSessions() {
  const store = new SessionVisibilityStore();
  
  appState.sessions.forEach(session => {
    if (session.status !== 'active' && !appState.hiddenSessions.has(session.name)) {
      // Auto-hide this exited session
      store.hideSession(session.name);
      appState.hiddenSessions.add(session.name);
    }
  });
}
```

## 🎨 **CSS Enhancements**

### **New CSS Classes**
```css
/* Session visibility controls */
.session-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  opacity: 0;
  transition: opacity 0.2s;
}

.session-item:hover .session-controls {
  opacity: 1;
}

.toggle-visibility-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 3px;
  font-size: 1rem;
}

.toggle-visibility-btn:hover {
  background: var(--color-bg-secondary);
}

/* Hidden session styling */
.session-item.hidden {
  opacity: 0.6;
  border-left: 3px solid var(--color-warning);
}

.hidden-indicator {
  font-size: 0.8rem;
  color: var(--color-muted);
  font-style: italic;
}

/* Hidden sessions section */
.hidden-sessions-section {
  border-top: 1px solid var(--color-border);
  margin-top: 1rem;
  padding-top: 1rem;
}

.hidden-sessions-header {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-muted);
  margin-bottom: 0.5rem;
  padding-left: 1rem;
}

/* Header controls */
.header-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.icon-btn.active {
  background: var(--color-accent);
  color: white;
}

.icon-btn.active:hover {
  background: var(--color-accent-hover);
}
```

## 🔍 **Testing Strategy**

### **Manual Testing Scenarios**

#### **Basic Functionality**
1. **Hide Session**: Click hide button on active session
2. **Unhide Session**: Toggle show hidden, click unhide button
3. **Auto-hide**: Exit a session, verify it gets hidden automatically
4. **Toggle Hidden Visibility**: Verify hidden sessions appear/disappear
5. **Persistence**: Refresh browser, verify hidden sessions remain hidden

#### **Edge Cases**
1. **Hide Selected Session**: Verify main content updates appropriately
2. **All Sessions Hidden**: Verify appropriate empty state message
3. **No Hidden Sessions**: Verify hidden toggle button disappears
4. **Auto-hide Disabled**: Verify exited sessions remain visible
5. **Session Comes Back**: If exited session becomes active again, verify it shows

#### **State Management**
1. **Multiple Tabs**: Test behavior across multiple browser tabs
2. **Auto-refresh**: Verify hidden state persists during auto-refresh
3. **Storage Limits**: Test with many sessions and long session names
4. **Invalid Storage**: Test behavior if localStorage data is corrupted

### **Performance Considerations**
- **Local Storage Size**: Monitor storage usage with many sessions
- **Render Performance**: Ensure smooth UI with large session lists
- **Memory Usage**: Watch for memory leaks with Set operations

## 📝 **Implementation Checklist**

### **Phase 1: Infrastructure**
- [ ] Create `src/storage.js` with SessionVisibilityStore class
- [ ] Enhance app state initialization in `main.js`
- [ ] Implement `computeVisibleSessions()` function
- [ ] Add localStorage integration tests

### **Phase 2: UI Controls**
- [ ] Update `renderSessionItem()` with visibility controls
- [ ] Enhance `renderSidebarHeader()` with toggle buttons
- [ ] Implement `renderSessionsList()` with grouped sections
- [ ] Add CSS classes for hidden session styling

### **Phase 3: Event Handling**
- [ ] Add click handlers for visibility toggles
- [ ] Implement `hideSession()` and `unhideSession()` functions
- [ ] Add `toggleHiddenSessionsVisibility()` handler
- [ ] Implement `toggleAutoHideExited()` handler

### **Phase 4: Auto-Hide Logic**
- [ ] Enhance `loadSessions()` with auto-hide logic
- [ ] Implement `autoHideExitedSessions()` function
- [ ] Add persistence for auto-hide setting
- [ ] Test with session state changes

### **Phase 5: Polish & Testing**
- [ ] Add keyboard shortcuts for visibility toggles
- [ ] Implement smooth animations/transitions
- [ ] Add accessibility attributes (ARIA labels)
- [ ] Comprehensive manual testing
- [ ] Performance testing with large session lists

## 🚀 **Future Enhancements**

### **Advanced Features**
1. **Session Categories**: Group hidden sessions by reason (manual vs auto)
2. **Hide by Pattern**: Hide sessions matching regex patterns
3. **Bulk Operations**: Hide/show multiple sessions at once
4. **Session Favorites**: Pin important sessions to always show
5. **Export Settings**: Backup/restore visibility preferences

### **Integration Opportunities**
1. **Backend Storage**: Store preferences on server for multi-device sync
2. **Session Metadata**: Store additional session information
3. **Notification System**: Alert when important hidden sessions become available
4. **Analytics**: Track which sessions are hidden most often

---

**This plan provides a comprehensive roadmap for implementing session visibility management while maintaining backward compatibility and following the existing codebase patterns.**