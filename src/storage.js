const STORAGE_KEYS = {
  HIDDEN_SESSIONS: 'zview_hidden_sessions',
  AUTO_HIDE_EXITED: 'zview_auto_hide_exited',
  SHOW_HIDDEN: 'zview_show_hidden'
};

class SessionVisibilityStore {
  getHiddenSessions() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.HIDDEN_SESSIONS);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Error reading hidden sessions from localStorage:', error);
      return [];
    }
  }
  
  hideSession(sessionName) {
    try {
      const hidden = new Set(this.getHiddenSessions());
      hidden.add(sessionName);
      localStorage.setItem(STORAGE_KEYS.HIDDEN_SESSIONS, JSON.stringify([...hidden]));
    } catch (error) {
      console.error('Error hiding session:', error);
    }
  }
  
  unhideSession(sessionName) {
    try {
      const hidden = new Set(this.getHiddenSessions());
      hidden.delete(sessionName);
      localStorage.setItem(STORAGE_KEYS.HIDDEN_SESSIONS, JSON.stringify([...hidden]));
    } catch (error) {
      console.error('Error unhiding session:', error);
    }
  }
  
  getAutoHideExited() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.AUTO_HIDE_EXITED);
      return stored !== 'false'; // Default to true
    } catch (error) {
      console.warn('Error reading auto-hide setting:', error);
      return true;
    }
  }
  
  setAutoHideExited(enabled) {
    try {
      localStorage.setItem(STORAGE_KEYS.AUTO_HIDE_EXITED, enabled.toString());
    } catch (error) {
      console.error('Error setting auto-hide:', error);
    }
  }
  
  getShowHidden() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SHOW_HIDDEN);
      return stored === 'true';
    } catch (error) {
      console.warn('Error reading show-hidden setting:', error);
      return false;
    }
  }
  
  setShowHidden(show) {
    try {
      localStorage.setItem(STORAGE_KEYS.SHOW_HIDDEN, show.toString());
    } catch (error) {
      console.error('Error setting show-hidden:', error);
    }
  }
  
  clearAll() {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
    } catch (error) {
      console.error('Error clearing session visibility settings:', error);
    }
  }
}

export { SessionVisibilityStore, STORAGE_KEYS };