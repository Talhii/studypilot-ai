/**
 * Session identity + local profile.
 *
 * Stands in for Firebase Auth: a stable per-device user id is generated once
 * and persisted, then sent as `X-User-ID` on every request. A lightweight
 * student profile (name / university / semester) is also persisted locally on
 * the device. When real Firebase sign-in is wired, call `setUserId(uid)` /
 * `setAuthToken(idToken)` and the same headers flow through unchanged.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const USER_KEY = "studypilot.userId";
const PROFILE_KEY = "studypilot.profile";

export interface LocalProfile {
  name: string;
  university: string;
  semester: string;
}

const EMPTY_PROFILE: LocalProfile = { name: "", university: "", semester: "" };

let cachedUserId: string | null = null;
let authToken: string | null = null;
let cachedProfile: LocalProfile = { ...EMPTY_PROFILE };

function generateUserId(): string {
  return `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Load (or create) the device user id + local profile. Call at startup. */
export async function initSession(): Promise<string> {
  if (!cachedUserId) {
    try {
      let id = await AsyncStorage.getItem(USER_KEY);
      if (!id) {
        id = generateUserId();
        await AsyncStorage.setItem(USER_KEY, id);
      }
      cachedUserId = id;
    } catch {
      cachedUserId = cachedUserId ?? generateUserId();
    }
  }
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (raw) {
      cachedProfile = {
        ...EMPTY_PROFILE,
        ...(JSON.parse(raw) as Partial<LocalProfile>),
      };
    }
  } catch {
    // keep defaults
  }
  return cachedUserId;
}

export function getUserId(): string | null {
  return cachedUserId;
}

/** Replace the active id (e.g. after a real Firebase sign-in). */
export function setUserId(id: string): void {
  cachedUserId = id;
}

export function getAuthToken(): string | null {
  return authToken;
}

export function setAuthToken(token: string | null): void {
  authToken = token;
}

// --- Local profile --------------------------------------------------------
export function getLocalProfile(): LocalProfile {
  return cachedProfile;
}

export async function saveLocalProfile(profile: LocalProfile): Promise<void> {
  cachedProfile = { ...profile };
  try {
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(cachedProfile));
  } catch {
    // in-memory cache still updated even if persistence fails
  }
}

/**
 * Purge local session data: clears the saved profile and rotates the device
 * user id, returning the app to a fresh dev-user baseline.
 */
export async function resetSession(): Promise<string> {
  cachedProfile = { ...EMPTY_PROFILE };
  authToken = null;
  const newId = generateUserId();
  cachedUserId = newId;
  try {
    await AsyncStorage.removeItem(PROFILE_KEY);
    await AsyncStorage.setItem(USER_KEY, newId);
  } catch {
    // ignore persistence failure
  }
  return newId;
}
