// sessionStorage can throw (private mode, blocked storage); every access is guarded.
const TOKEN_KEY = "kk.mod.token";
const STATE_KEY = "kk.mod.oauthState";

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // ignore: the user just has to log in again after a reload
  }
}
function remove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export const loadToken = () => read(TOKEN_KEY);
export const saveToken = (t: string) => write(TOKEN_KEY, t);
export const clearToken = () => remove(TOKEN_KEY);
export const loadOAuthState = () => read(STATE_KEY);
export const saveOAuthState = (s: string) => write(STATE_KEY, s);
export const clearOAuthState = () => remove(STATE_KEY);
