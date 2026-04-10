const DEVICE_ID_KEY = "cch_device_id";
const PREFERENCES_KEY = "cch_preferences";

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export interface DevicePreferences {
  categories: string[];
  zones: string[];
  hasCompleted: boolean;
}

export function getPreferences(): DevicePreferences {
  const raw = localStorage.getItem(PREFERENCES_KEY);
  if (!raw) return { categories: [], zones: [], hasCompleted: false };
  try {
    return JSON.parse(raw);
  } catch {
    return { categories: [], zones: [], hasCompleted: false };
  }
}

export function savePreferences(prefs: DevicePreferences) {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
}

export function hasCompletedOnboarding(): boolean {
  return getPreferences().hasCompleted;
}
