import { AuthResponse, AuthUser } from '../types/auth';

const AUTH_STORAGE_KEY = 'portal_auth';
const SESSION_DURATION = 20 * 60 * 1000;

export function saveAuthToStorage(auth: AuthResponse): void {
  const authData: AuthUser = {
    lastName: auth.lastName,
    firstName: auth.firstName,
    middleName: auth.middleName,
    photo: auth.photo,
    cookies: auth.cookies,
    expires: Date.now() + SESSION_DURATION,
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
}

export function getAuthFromStorage(): AuthUser | null {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    const data: AuthUser = JSON.parse(raw);
    if (Date.now() > data.expires) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function clearAuthStorage(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function setPortalCookies(cookies: Record<string, string>): void {
  if (cookies.width) {
    document.cookie = `width=${cookies.width}; path=/`;
  }
  if (cookies.__portal3_login) {
    document.cookie = `__portal3_login=${cookies.__portal3_login}; path=/`;
  }
  if (cookies.__portal3_info) {
    document.cookie = `__portal3_info=${cookies.__portal3_info}; path=/`;
  }
}

export function clearPortalCookies(): void {
  document.cookie = 'width=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie =
    '__portal3_login=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie =
    '__portal3_info=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
}

export function getPortal3Cookies(): Record<string, string> {
  const auth = getAuthFromStorage();
  if (!auth?.cookies) return {};

  const portalCookies: Record<string, string> = {};
  Object.entries(auth.cookies).forEach(([key, value]) => {
    if (key.startsWith('__portal3_') && value) {
      portalCookies[key] = value;
    }
  });
  if (auth.cookies.width) {
    portalCookies.width = auth.cookies.width;
  }
  return portalCookies;
}
