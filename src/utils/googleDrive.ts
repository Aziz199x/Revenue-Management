import { Capacitor } from "@capacitor/core";
import { AppData } from "@/data/types";

const CLIENT_ID = "777494765857-lhndrn52q4ptemrekskbf0kgepei21mi.apps.googleusercontent.com";
const SCOPES = ["openid", "email", "profile", "https://www.googleapis.com/auth/drive.file"];
const FOLDER_NAME = "Revenue Management Backups";

const TOKEN_KEY = "google_drive_token";
const ACCOUNT_KEY = "google_account_email";

interface StoredTokens {
  accessToken: string;
  email: string;
  expiresAt: number;
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

function saveTokens(tokens: StoredTokens) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  localStorage.setItem(ACCOUNT_KEY, tokens.email);
}

export function clearTokens() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ACCOUNT_KEY);
  } catch (error) {
    console.warn("[Google Logout] unable to clear one or more local token keys:", error);
  }
}

export function getConnectedEmail(): string | null {
  try {
    return localStorage.getItem(ACCOUNT_KEY);
  } catch {
    return null;
  }
}

export function isSignedIn(): boolean {
  return !!getConnectedEmail();
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
    const accessToken = user.authentication.accessToken;
    const email = user.email;

    const tokens: StoredTokens = {
      accessToken,
      email,
      expiresAt: Date.now() + 55 * 60 * 1000,
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

async function refreshAccessToken(): Promise<string> {
  try {
    const { GoogleAuth } = await import("@codetrix-studio/capacitor-google-auth");

    await GoogleAuth.initialize({
      clientId: CLIENT_ID,
      scopes: SCOPES,
    });

    const auth = await GoogleAuth.refresh();
    const current = getTokens();
    const tokens: StoredTokens = {
      accessToken: auth.accessToken,
      email: current?.email || "",
      expiresAt: Date.now() + 55 * 60 * 1000,
    };
    saveTokens(tokens);
    return auth.accessToken;
  } catch {
    clearTokens();
    throw new Error("انتهت صلاحية الجلسة، الرجاء تسجيل الدخول مرة أخرى");
  }
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
      clearTokens();
      return signIn();
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
      clearTokens();
      throw new Error(
        "Google session expired. Please reconnect your Google account.",
      );
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
          email: email || '',
          expiresAt: Date.now() + 55 * 60 * 1000,
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

async function driveFetch(path: string, options: RequestInit = {}): Promise<Response> {
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
      clearTokens();
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

  const jsonContent = createBackupPayload(data);
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

export async function downloadBackup(fileId: string): Promise<string> {
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
      clearTokens();
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

export function createBackupPayload(data: AppData): object {
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
      settings: data.settings,
    },
  };
}

function dateStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}`;
}
