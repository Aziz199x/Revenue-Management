import { Capacitor } from "@capacitor/core";
import { AppData } from "@/data/types";

const CLIENT_ID = "777494765857-lhndrn52q4ptemrekskbf0kgepei21mi.apps.googleusercontent.com";
const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.file",
];
const FOLDER_NAME = "Revenue Management Backups";

const TOKEN_KEY = "google_drive_token";
const ACCOUNT_KEY = "google_account_email";
const NEEDS_RECONNECT_KEY = "google_drive_needs_reconnect";

interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
  email: string;
  expiresAt: number;
}

export interface GoogleConnectionStatus {
  email: string | null;
  state: "connected" | "expired" | "disconnected";
}

function getTokens(): StoredTokens | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const NATIVE_TOKEN_FILE = "google_drive_session.json";

/**
 * Mirrors the session to a real file in the app's private data directory.
 *
 * localStorage lives inside the Android WebView's storage, which the system
 * (and "clear cache" style cleanups, and some WebView/app updates) can evict
 * independently of the app's own data. When that happened the session simply
 * vanished and the user saw yet another logout. The file below survives all of
 * that, so the connection persists the way the user expects.
 */
async function persistTokensNatively(tokens: StoredTokens): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
    await Filesystem.writeFile({
      path: NATIVE_TOKEN_FILE,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
      data: JSON.stringify(tokens),
    });
  } catch (error) {
    console.warn("[Google Drive] unable to mirror session to native storage", error);
  }
}

async function clearNativeTokens(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    await Filesystem.deleteFile({ path: NATIVE_TOKEN_FILE, directory: Directory.Data });
  } catch {
    // nothing stored yet — nothing to clear
  }
}

/**
 * Restores the session from native storage when the WebView's localStorage has
 * been wiped. Call once on startup, before anything reads the connection state.
 */
export async function restoreGoogleSessionFromNativeStorage(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (getTokens()?.accessToken) return;
  try {
    const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
    const file = await Filesystem.readFile({
      path: NATIVE_TOKEN_FILE,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    const raw = typeof file.data === "string" ? file.data : "";
    if (!raw) return;
    const tokens = JSON.parse(raw) as StoredTokens;
    if (!tokens?.email) return;
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
    localStorage.setItem(ACCOUNT_KEY, tokens.email);
    console.log("[Google Drive] session restored from native storage");
  } catch {
    // no mirrored session available
  }
}

function saveTokens(tokens: StoredTokens) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  localStorage.setItem(ACCOUNT_KEY, tokens.email);
  // A successful sign-in or refresh proves the credentials work again.
  localStorage.removeItem(NEEDS_RECONNECT_KEY);
  void persistTokensNatively(tokens);
}

/**
 * Marks the stored Google session as known-broken (refresh token missing or
 * rejected by Google). This is the single source of truth the "connected"
 * badge and the automatic backup scheduler both rely on — unlike a raw
 * expiresAt comparison, it is only set after an actual failed refresh
 * attempt, so it doesn't flap every time the short-lived access token
 * naturally expires (which normally just silently refreshes).
 */
function markNeedsReconnect() {
  try {
    localStorage.setItem(NEEDS_RECONNECT_KEY, "1");
  } catch (error) {
    console.warn("[Google Drive] unable to persist reconnect flag:", error);
  }
}

export function needsGoogleReconnect(): boolean {
  try {
    return localStorage.getItem(NEEDS_RECONNECT_KEY) === "1";
  } catch {
    return false;
  }
}

async function exchangeGoogleAuthCode(serverAuthCode: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: serverAuthCode,
      client_id: CLIENT_ID,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) throw new Error(`Google token exchange failed (${response.status})`);
  return response.json();
}

export function clearTokens() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ACCOUNT_KEY);
    localStorage.removeItem(NEEDS_RECONNECT_KEY);
  } catch (error) {
    console.warn("[Google Logout] unable to clear one or more local token keys:", error);
  }
  void clearNativeTokens();
}

export function getConnectedEmail(): string | null {
  try {
    return localStorage.getItem(ACCOUNT_KEY);
  } catch {
    return null;
  }
}

export function getGoogleConnectionStatus(_now = Date.now()): GoogleConnectionStatus {
  const tokens = getTokens();
  const email = tokens?.email || getConnectedEmail();
  if (!email || !tokens?.accessToken) {
    return { email, state: email ? "expired" : "disconnected" };
  }
  // Do not use a raw expiresAt comparison here: the short-lived access token
  // expires roughly hourly by design and silently refreshes in the
  // background, so that alone is not a sign the session is actually broken.
  // needsGoogleReconnect() only becomes true after a refresh attempt has
  // actually failed against Google.
  return {
    email,
    state: needsGoogleReconnect() ? "expired" : "connected",
  };
}

export function isSignedIn(): boolean {
  return !!getConnectedEmail() && !needsGoogleReconnect();
}

/**
 * Actively verifies the stored session against Google instead of trusting
 * the locally cached "connected" flag — previously the connected badge only
 * updated after the user tapped upload/restore and hit a failure. Never
 * triggers an interactive sign-in: if there is no stored token at all this
 * just reports the disconnected/expired state without prompting anything.
 */
export async function verifyGoogleConnection(): Promise<GoogleConnectionStatus> {
  const tokens = getTokens();
  const email = tokens?.email || getConnectedEmail();
  if (!email || !tokens?.accessToken) {
    return { email, state: email ? "expired" : "disconnected" };
  }
  try {
    await getValidGoogleAccessToken();
    return { email, state: "connected" };
  } catch {
    return { email: getConnectedEmail(), state: getConnectedEmail() ? "expired" : "disconnected" };
  }
}

/**
 * Forces a silent renewal of the stored session, without ever opening the
 * account picker. This is what the "تجديد الجلسة" button calls — unlike
 * verifyGoogleConnection() it does not settle for a token that merely looks
 * valid locally, it actually mints a fresh one through the native session.
 */
export async function renewGoogleSession(): Promise<GoogleConnectionStatus> {
  const email = getTokens()?.email || getConnectedEmail();
  if (!email) return { email: null, state: "disconnected" };
  try {
    await refreshAccessToken();
    return { email: getConnectedEmail(), state: "connected" };
  } catch {
    // Silent renewal is impossible (device account removed or access revoked).
    // Re-authenticate interactively WITHOUT forcing the account picker, so the
    // user simply re-approves the same account through Google's own prompts
    // rather than having to hunt for it in a chooser.
    try {
      await signIn();
      return { email: getConnectedEmail(), state: "connected" };
    } catch {
      return { email: getConnectedEmail(), state: "expired" };
    }
  }
}

export async function signIn(options: { forceAccountSelection?: boolean } = {}): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("يتطلب تسجيل الدخول جهازًا فعليًا");
  }

  if (!CLIENT_ID || CLIENT_ID.startsWith("YOUR_")) {
    throw new Error("لم يتم تهيئة خدمة Google Drive بعد");
  }

  try {
    const { GoogleAuth } = await import("@codetrix-studio/capacitor-google-auth");

    await GoogleAuth.initialize({
      clientId: CLIENT_ID,
      scopes: SCOPES,
      grantOfflineAccess: true,
    });

    if (options.forceAccountSelection === true) {
      console.log("[GoogleAuth] clearing SDK session before account selection");
      try {
        await GoogleAuth.signOut();
      } catch (signOutError) {
        console.warn("[GoogleAuth] pre-sign-in signOut failed; continuing to account picker:", signOutError);
      }
      await GoogleAuth.initialize({
        clientId: CLIENT_ID,
        scopes: SCOPES,
        grantOfflineAccess: true,
      });
    }

    const user = await GoogleAuth.signIn();
    let accessToken = user.authentication.accessToken;
    // Google only returns a refresh_token on the account's first consent for
    // this app; a later reconnect of the SAME account (very common — this is
    // exactly what happens when the user taps "reconnect" after a session
    // expired) normally gets no refresh_token back at all. Falling back to
    // undefined here used to silently discard a perfectly valid existing
    // refresh token, guaranteeing the next hourly access-token expiry would
    // hard-fail again — a likely cause of the frequent disconnects. Keep the
    // previous one when re-authenticating the same email.
    const previousTokensForSameAccount = getTokens()?.email === user.email ? getTokens() : null;
    let refreshToken: string | undefined = previousTokensForSameAccount?.refreshToken;
    let expiresAt = Date.now() + 55 * 60 * 1000;
    const email = user.email;
    if (user.serverAuthCode) {
      try {
        const token = await exchangeGoogleAuthCode(user.serverAuthCode);
        accessToken = token.access_token || accessToken;
        refreshToken = token.refresh_token || refreshToken;
        expiresAt = Date.now() + Math.max(60, Number(token.expires_in) || 3300) * 1000;
      } catch (error) {
        console.warn("[Google Drive] offline token exchange failed; using the current access token", error);
      }
    }

    const tokens: StoredTokens = {
      accessToken,
      refreshToken,
      email,
      expiresAt,
    };
    saveTokens(tokens);

    return accessToken;
  } catch (e: unknown) {
    console.error('[GoogleAuth] signIn error:', e);
    const err = e as Record<string, unknown>;
    const msg = String(err.message ?? '');
    const code = String(err.code ?? '');
    const data = err.data !== undefined ? JSON.stringify(err.data) : '';

    console.error('[GoogleAuth] message:', msg);
    console.error('[GoogleAuth] code:', code);
    console.error('[GoogleAuth] data:', data);

    if (code === '12501' || code === 'SIGN_IN_CANCELLED' || msg.toLowerCase().includes('cancel')) {
      throw new Error('تم إلغاء تسجيل الدخول');
    }

    let detailMsg = msg || 'خطأ غير معروف';
    if (code) detailMsg += ` (code: ${code})`;
    if (data) detailMsg += ` | data: ${data}`;

    throw new Error(`تعذر ربط حساب Google: ${detailMsg}`);
  }
}

/**
 * Silently renews the access token through the native Google Sign-In session.
 *
 * This is the durable path and the reason the connection used to die after
 * roughly an hour. `exchangeGoogleAuthCode()` posts to Google's token endpoint
 * WITHOUT a client_secret — which Google rejects for this client type — so a
 * `refresh_token` was almost never actually obtained, leaving nothing but the
 * ~1 hour access token and no way to renew it. `GoogleAuth.refresh()` instead
 * asks the Android account manager for a fresh token against the device's
 * already-signed-in Google account: no refresh token, no client secret and no
 * user interaction required, and it keeps working for as long as the account
 * stays added on the device.
 */
async function refreshViaNativeSession(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  const current = getTokens();
  if (!current?.email) return null;
  try {
    const { GoogleAuth } = await import("@codetrix-studio/capacitor-google-auth");
    await GoogleAuth.initialize({
      clientId: CLIENT_ID,
      scopes: SCOPES,
      grantOfflineAccess: true,
    });
    const auth = await GoogleAuth.refresh();
    const accessToken = auth?.accessToken;
    if (!accessToken) return null;
    saveTokens({
      ...current,
      accessToken,
      refreshToken: auth.refreshToken || current.refreshToken,
      // The native call does not report a lifetime; Google's tokens are one
      // hour, so keep a small safety margin and renew again after ~55 min.
      expiresAt: Date.now() + 55 * 60 * 1000,
    });
    return accessToken;
  } catch (error) {
    console.warn("[Google Drive] native silent refresh failed", error);
    return null;
  }
}

async function refreshAccessToken(): Promise<string> {
  const current = getTokens();

  // Preferred: silent native renewal (works without a refresh token).
  const nativeToken = await refreshViaNativeSession();
  if (nativeToken) return nativeToken;

  // Fallback: standard refresh-token grant, when one was actually stored.
  if (current?.refreshToken) {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        refresh_token: current.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (response.ok) {
      const token = await response.json();
      const refreshed: StoredTokens = {
        ...current,
        accessToken: token.access_token,
        refreshToken: token.refresh_token || current.refreshToken,
        expiresAt: Date.now() + Math.max(60, Number(token.expires_in) || 3300) * 1000,
      };
      saveTokens(refreshed);
      return refreshed.accessToken;
    }
  }

  // Both renewal paths failed — the device account is gone or access was
  // revoked. Only now is this a real, persistent problem worth surfacing.
  markNeedsReconnect();
  throw new Error("انتهت صلاحية حساب Google Drive. أعد ربطه من صفحة النسخ الاحتياطي");
}

export async function signOut() {
  // Native signOut in the current plugin can terminate the Android activity.
  // Clearing app-owned credentials is sufficient to disconnect this app safely.
  if (!Capacitor.isNativePlatform()) {
    try {
      const { GoogleAuth } = await import("@codetrix-studio/capacitor-google-auth");
      await GoogleAuth.signOut();
    } catch (error) {
      console.warn("[Google Logout] plugin signOut failed; clearing local state:", error);
    }
  }
  clearTokens();
}

async function getValidToken(): Promise<string> {
  const tokens = getTokens();
  if (!tokens || !tokens.email) {
    throw new Error("الرجاء تسجيل الدخول أولاً");
  }

  if (Date.now() < tokens.expiresAt && tokens.accessToken) {
    return tokens.accessToken;
  }

  return refreshAccessToken();
}

export async function getValidGoogleAccessToken(): Promise<string> {
  const tokens = getTokens();
  const email = tokens?.email || getConnectedEmail();

  console.log('Google account:', email);
  console.log('Has accessToken:', !!tokens?.accessToken);
  console.log('Token expiresAt:', tokens?.expiresAt);

  if (!tokens || !tokens.accessToken) {
    console.log('[GoogleAuth] No stored token, signing in...');
    return signIn();
  }

  // Check expiration
  if (Date.now() >= tokens.expiresAt) {
    console.log('[GoogleAuth] Token expired, refreshing...');
    try {
      return refreshAccessToken();
    } catch {
      throw new Error("انتهت صلاحية حساب Google Drive. أعد ربطه من صفحة النسخ الاحتياطي");
    }
  }

  // Verify token against Drive API
  console.log('[GoogleAuth] Verifying Drive access...');
  try {
    const verifyResp = await fetch(
      'https://www.googleapis.com/drive/v3/about?fields=user',
      { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
    );
    const verifyBody = await verifyResp.text();
    console.log('Drive diagnostic status:', verifyResp.status);
    console.log('Drive diagnostic body:', verifyBody);

    if (verifyResp.ok) {
      console.log('[GoogleAuth] Token is valid for Drive API');
      return tokens.accessToken;
    }

    if (verifyResp.status === 401) {
      // The cached access token looked valid locally (expiresAt hadn't
      // passed yet) but Google already rejected it — this happens on clock
      // drift or early invalidation and does NOT mean the refresh token is
      // dead. Try one real refresh-token-based renewal before giving up;
      // immediately wiping the whole session here (as this used to do) is
      // exactly what forced a full reconnect every couple of hours even
      // though the refresh token itself was still perfectly usable.
      try {
        return await refreshAccessToken();
      } catch {
        throw new Error(
          "Google session expired. Please reconnect your Google account.",
        );
      }
    }

    if (verifyResp.status === 403) {
      console.log('[GoogleAuth] Token lacks Drive scope, trying account re-auth...');
      // Re-sign-in with grantOfflineAccess to get a serverAuthCode,
      // then exchange it for a Drive-scoped token.
      try {
        const { GoogleAuth } = await import("@codetrix-studio/capacitor-google-auth");
        await GoogleAuth.initialize({
          clientId: CLIENT_ID,
          scopes: SCOPES,
          grantOfflineAccess: true,
        });
        const user = await GoogleAuth.signIn();
        const serverAuthCode = user.serverAuthCode;

        if (!serverAuthCode) {
          throw new Error('لم يتم الحصول على رمز التفويض من Google');
        }

        console.log('[GoogleAuth] Exchanging serverAuthCode for Drive-scoped token...');
        const exchangeResp = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code: serverAuthCode,
            client_id: CLIENT_ID,
            grant_type: 'authorization_code',
          }),
        });

        const exchangeBody = await exchangeResp.text();
        console.log('[GoogleAuth] Exchange response:', exchangeResp.status, exchangeBody);

        if (!exchangeResp.ok) {
          throw new Error(
            `فشل الحصول على صلاحية Google Drive: الحالة ${exchangeResp.status} - ${exchangeBody.slice(0, 200)}`,
          );
        }

        const exchangeData = JSON.parse(exchangeBody);
        const newToken = exchangeData.access_token;

        // Save the new Drive-scoped token
        saveTokens({
          accessToken: newToken,
          refreshToken: exchangeData.refresh_token || tokens.refreshToken,
          email: email || '',
          expiresAt: Date.now() + Math.max(60, Number(exchangeData.expires_in) || 3300) * 1000,
        });

        console.log('[GoogleAuth] Drive-scoped token obtained successfully');

        // Verify the new token
        const finalResp = await fetch(
          'https://www.googleapis.com/drive/v3/about?fields=user',
          { headers: { Authorization: `Bearer ${newToken}` } },
        );
        const finalBody = await finalResp.text();
        console.log('Drive diagnostic status:', finalResp.status);
        console.log('Drive diagnostic body:', finalBody);

        if (!finalResp.ok) {
          throw new Error(
            `Google Drive permission is missing. Please disconnect and reconnect Google. (${finalResp.status})`,
          );
        }

        return newToken;
      } catch (exchangeErr) {
        if (exchangeErr instanceof Error && exchangeErr.message.includes('Google Drive permission is missing')) {
          throw exchangeErr;
        }
        const msg = exchangeErr instanceof Error ? exchangeErr.message : String(exchangeErr);
        throw new Error(
          `تعذر رفع النسخة الاحتياطية. حساب Google يحتاج إلى صلاحية Drive. الرجاء فصل الحساب وإعادة ربطه: ${msg.slice(0, 150)}`,
        );
      }
    }

    // Other errors
    throw new Error(
      `تعذر رفع النسخة الاحتياطية: الحالة ${verifyResp.status} - ${verifyBody.slice(0, 200)}`,
    );
  } catch (e) {
    if (e instanceof Error && (e.message.includes('session expired') || e.message.includes('permission is missing'))) {
      throw e;
    }
    console.error('[GoogleAuth] verify error:', e);
    throw new Error(
      `تعذر رفع النسخة الاحتياطية: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

async function driveFetch(path: string, options: RequestInit = {}, isRetry = false): Promise<Response> {
  const token = await getValidToken();
  const url = `https://www.googleapis.com/drive/v3${path}`;
  console.log('[GoogleDrive] Request:', options.method || 'GET', url);

  const resp = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!resp.ok) {
    const body = await resp.text();
    console.error(`[GoogleDrive] Response ${resp.status}:`, body);

    if (resp.status === 401) {
      // A 401 here means Google rejected a token `getValidToken()` believed
      // was still fresh. Try one real refresh before treating the session
      // as dead — this is the same "verify then immediately wipe everything"
      // pattern that used to force a full reconnect every couple of hours.
      if (!isRetry) {
        try {
          await refreshAccessToken();
          return driveFetch(path, options, true);
        } catch {
          // fall through to the error below
        }
      }
      throw new Error("انتهت صلاحية الجلسة، الرجاء تسجيل الدخول مرة أخرى");
    }

    if (resp.status === 403) {
      clearTokens();
      throw new Error(
        "Google Drive permission is missing. Please disconnect and reconnect Google.",
      );
    }

    throw new Error(`خطأ في الخادم (${resp.status}): ${body.slice(0, 300)}`);
  }

  return resp;
}

async function getOrCreateFolder(): Promise<string> {
  const q = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const resp = await driveFetch(`/files?q=${q}&fields=files(id,name)`);
  const data = await resp.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  const meta = { name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" };
  const createResp = await driveFetch("/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(meta),
  });
  const folder = await createResp.json();
  return folder.id;
}

export async function uploadBackup(data: AppData): Promise<void> {
  // First, ensure we have a valid Drive-scoped token
  const accessToken = await getValidGoogleAccessToken();
  console.log('[GoogleDrive] Has accessToken:', !!accessToken);

  const jsonContent = await createBackupPayload(data);
  const stamp = dateStamp();
  const fileName = `rental-backup-${stamp}.json`;
  console.log('[GoogleDrive] File name:', fileName);

  const folderId = await getOrCreateFolder();

  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: "application/json",
  };

  const formData = new FormData();
  formData.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" }),
  );
  formData.append(
    "file",
    new Blob([JSON.stringify(jsonContent, null, 2)], { type: "application/json" }),
  );

  const uploadUrl =
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink";
  console.log('[GoogleDrive] Upload URL:', uploadUrl);

  const resp = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  const respBody = await resp.text();
  console.log('[GoogleDrive] Upload response status:', resp.status);
  console.log('[GoogleDrive] Upload response body:', respBody);

  if (!resp.ok) {
    throw new Error(
      `تعذر رفع النسخة الاحتياطية (${resp.status}): ${respBody.slice(0, 300)}`,
    );
  }
}

export interface BackupFileInfo {
  id: string;
  name: string;
  size: string;
  createdTime: string;
}

export async function listBackups(): Promise<BackupFileInfo[]> {
  const folderId = await getOrCreateFolder();
  const q = encodeURIComponent(
    `'${folderId}' in parents and mimeType='application/json' and trashed=false`,
  );
  const resp = await driveFetch(
    `/files?q=${q}&orderBy=createdTime desc&fields=files(id,name,size,createdTime)`,
  );
  const data = await resp.json();
  return data.files || [];
}

export async function deleteBackup(fileId: string): Promise<void> {
  await driveFetch(`/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
}

export async function downloadBackup(fileId: string, isRetry = false): Promise<string> {
  const token = await getValidToken();
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  console.log('[GoogleDrive] Download:', url);

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    const body = await resp.text();
    console.error(`[GoogleDrive] Download failed (${resp.status}):`, body);

    if (resp.status === 401) {
      // Same rationale as driveFetch: try one real refresh before declaring
      // the session dead instead of wiping it on the first rejected token.
      if (!isRetry) {
        try {
          await refreshAccessToken();
          return downloadBackup(fileId, true);
        } catch {
          // fall through to the error below
        }
      }
      throw new Error("Google session expired. Please reconnect your Google account.");
    }

    if (resp.status === 403) {
      clearTokens();
      throw new Error("Google Drive permission is missing. Please disconnect and reconnect Google.");
    }

    throw new Error(`تعذر تحميل النسخة الاحتياطية (${resp.status}): ${body.slice(0, 200)}`);
  }

  return resp.text();
}

export async function createBackupPayload(data: AppData): Promise<object> {
  const evidenceAttachments = await Promise.all(
    (data.evidenceAttachments || []).map(async (attachment) => {
      if (attachment.dataUrl || !attachment.storagePath) return attachment;
      try {
        const { readEvidenceAttachment } = await import("@/utils/evidenceAttachments");
        return { ...attachment, dataUrl: await readEvidenceAttachment(attachment) };
      } catch (error) {
        console.warn("[Backup] unable to embed evidence file", attachment.id, error);
        return attachment;
      }
    }),
  );
  return {
    appName: "Revenue Management",
    appVersion: "1.0.0",
    backupVersion: 1,
    createdAt: new Date().toISOString(),
    data: {
      buildings: data.buildings,
      units: data.units,
      tenants: data.tenants,
      contracts: data.contracts,
      payments: data.payments,
      bills: data.bills,
      repairs: data.repairs,
      tenantRequests: data.tenantRequests,
      contractAttachments: data.contractAttachments,
      evidenceAttachments,
      collectionFeeSettlements: data.collectionFeeSettlements,
      financialAuditLog: data.financialAuditLog,
      financialMonthClosures: data.financialMonthClosures,
      communicationLogs: data.communicationLogs,
      settings: data.settings,
    },
  };
}

function dateStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}`;
}
