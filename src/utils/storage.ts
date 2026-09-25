const memoryStorage: Record<string, string> = {};

export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      let val = window.localStorage.getItem(key);
      if (key === "raffle_admin_token" && val) {
        val = val.trim();
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1).trim();
        }
        // Strictly sanitize token to contain only safe header-compliant characters
        val = val.replace(/[^A-Za-z0-9\-_./+=]/g, "");
      }
      return val;
    } catch (e) {
      let val = memoryStorage[key] || null;
      if (key === "raffle_admin_token" && val) {
        val = val.trim();
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1).trim();
        }
        val = val.replace(/[^A-Za-z0-9\-_./+=]/g, "");
      }
      return val;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      let val = value;
      if (key === "raffle_admin_token" && val) {
        val = val.trim();
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1).trim();
        }
        val = val.replace(/[^A-Za-z0-9\-_./+=]/g, "");
      }
      window.localStorage.setItem(key, val);
    } catch (e) {
      let val = value;
      if (key === "raffle_admin_token" && val) {
        val = val.trim();
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1).trim();
        }
        val = val.replace(/[^A-Za-z0-9\-_./+=]/g, "");
      }
      memoryStorage[key] = val;
    }
  },
  removeItem: (key: string): void => {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      delete memoryStorage[key];
    }
  }
};

export const localStorage = safeLocalStorage;

