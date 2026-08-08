import { AppLauncher } from "@capacitor/app-launcher";
import { Capacitor } from "@capacitor/core";

const GOOGLE_CLIENT_ID = "777494765857-lhndrn52q4ptemrekskbf0kgepei21mi.apps.googleusercontent.com";
const GMAIL_KEY = "automatic_email_gmail_account";
const GMAIL_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.send",
];
const OUTLOOK_KEY = "automatic_email_outlook_account";
const WHATSAPP_KEY = "automatic_whatsapp_business_account";
const OUTLOOK_REDIRECT_URI = "revenuemanagement://oauth/callback";
const GOOGLE_CLOUD_PROJECT_NUMBER = "777494765857";
export const GMAIL_API_CONSOLE_URL =
  `https://console.cloud.google.com/apis/library/gmail.googleapis.com?project=${GOOGLE_CLOUD_PROJECT_NUMBER}`;

export class EmailProviderError extends Error {
  constructor(
    message: string,
    public readonly code: "gmail_api_disabled" | "gmail_permission" | "email_send_failed",
    public readonly helpUrl?: string,
  ) {
    super(message);
    this.name = "EmailProviderError";
  }
}

interface OutlookAccount {
  clientId: string;
  email: string;
  displayName?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

interface GmailAccount {
  email: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export interface WhatsAppBusinessAccount {
  phoneNumberId: string;
  accessToken: string;
  graphVersion: string;
  languageCode: string;
  paymentTemplate: string;
  overdueTemplate: string;
  contractTemplate: string;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function utf8ToBase64Url(value: string): string {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function utf8ToBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function randomUrlSafe(size = 32): string {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

function readJson<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getGmailAccountEmail(): string | null {
  const status = getGmailAccountStatus();
  return status.state === "connected" ? status.email : null;
}

export function getGmailAccountStatus() {
  const account = readJson<GmailAccount>(GMAIL_KEY);
  if (!account?.email || !account.accessToken) {
    return { email: account?.email || null, state: account?.email ? "expired" as const : "disconnected" as const };
  }
  // Deliberately NOT a raw expiresAt comparison. The access token expires
  // every hour by design and is now renewed silently through the native
  // session, so treating that as "expired" made this report a disconnected
  // account hourly — which in turn made the manual check reset emailProvider
  // to null and quietly switch automatic email sending off.
  return { email: account.email, state: "connected" as const };
}

export async function connectGmail(): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("يتطلب ربط Gmail استخدام تطبيق Android");
  }
  const { GoogleAuth } = await import("@codetrix-studio/capacitor-google-auth");
  // NOTE: deliberately no GoogleAuth.signOut() here.
  //
  // The Google Sign-In plugin holds ONE shared native session for the whole
  // app. Signing out to force the account picker for Gmail also destroyed the
  // Drive backup session, because Drive's silent renewal relies on
  // getLastSignedInAccount(). That is why connecting or reconnecting the email
  // sender kept knocking Google Drive offline a short while later.
  await GoogleAuth.initialize({
    clientId: GOOGLE_CLIENT_ID,
    scopes: GMAIL_SCOPES,
    grantOfflineAccess: true,
  });
  const user = await GoogleAuth.signIn();
  if (!user.email || !user.authentication?.accessToken) {
    throw new Error("تعذر قراءة بيانات حساب Gmail");
  }

  let accessToken = user.authentication.accessToken;
  let refreshToken: string | undefined;
  let expiresAt = Date.now() + 55 * 60 * 1000;
  if (user.serverAuthCode) {
    try {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: user.serverAuthCode,
          client_id: GOOGLE_CLIENT_ID,
          grant_type: "authorization_code",
        }),
      });
      if (response.ok) {
        const token = await response.json();
        accessToken = token.access_token || accessToken;
        refreshToken = token.refresh_token || undefined;
        expiresAt = Date.now() + Math.max(60, Number(token.expires_in) || 3300) * 1000;
      }
    } catch (error) {
      console.warn("[Gmail] offline token exchange failed; using the current access token", error);
    }
  }
  writeJson(GMAIL_KEY, { email: user.email, accessToken, refreshToken, expiresAt } satisfies GmailAccount);
  return user.email;
}

export function disconnectGmail(): void {
  localStorage.removeItem(GMAIL_KEY);
}

/**
 * Silent native renewal for the Gmail sender account. Same rationale as the
 * Drive one: the authorization-code exchange above runs without a
 * client_secret, so a refresh_token is rarely obtained and the sender account
 * would otherwise go dead about an hour after connecting — silently breaking
 * automatic email sending until the user manually reconnected.
 */
async function refreshGmailViaNativeSession(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  const account = readJson<GmailAccount>(GMAIL_KEY);
  if (!account?.email) return null;
  try {
    const { GoogleAuth } = await import("@codetrix-studio/capacitor-google-auth");
    await GoogleAuth.initialize({
      clientId: GOOGLE_CLIENT_ID,
      scopes: GMAIL_SCOPES,
      grantOfflineAccess: true,
    });
    const auth = await GoogleAuth.refresh();
    if (!auth?.accessToken) return null;
    writeJson(GMAIL_KEY, {
      ...account,
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken || account.refreshToken,
      expiresAt: Date.now() + 55 * 60 * 1000,
    } satisfies GmailAccount);
    return auth.accessToken;
  } catch (error) {
    console.warn("[Gmail] native silent refresh failed", error);
    return null;
  }
}

async function getValidGmailAccessToken(): Promise<string> {
  const account = readJson<GmailAccount>(GMAIL_KEY);
  if (!account?.accessToken || !account.email) {
    throw new Error("اربط حساب Gmail من إعدادات الإرسال أولًا");
  }
  if (Date.now() < account.expiresAt) return account.accessToken;

  const nativeToken = await refreshGmailViaNativeSession();
  if (nativeToken) return nativeToken;

  if (account.refreshToken) {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        refresh_token: account.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (response.ok) {
      const token = await response.json();
      const refreshed: GmailAccount = {
        ...account,
        accessToken: token.access_token,
        refreshToken: token.refresh_token || account.refreshToken,
        expiresAt: Date.now() + Math.max(60, Number(token.expires_in) || 3300) * 1000,
      };
      writeJson(GMAIL_KEY, refreshed);
      return refreshed.accessToken;
    }
  }
  throw new Error("انتهت صلاحية حساب Gmail. أعد ربط حساب الإرسال من الإعدادات");
}

export async function sendGmailEmail(to: string, subject: string, body: string): Promise<void> {
  const accessToken = await getValidGmailAccessToken();
  const from = readJson<GmailAccount>(GMAIL_KEY)?.email || "";
  const mime = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${utf8ToBase64(subject)}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    body,
  ].join("\r\n");
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: utf8ToBase64Url(mime) }),
  });
  if (!response.ok) {
    const details = await response.text();
    if (response.status === 403 && /has not been used|is disabled|accessNotConfigured/i.test(details)) {
      throw new EmailProviderError(
        "خدمة الإرسال المباشر عبر Gmail غير متاحة حاليًا. استخدم تطبيق البريد أو تواصل مع مسؤول التطبيق إذا استمر الخطأ.",
        "gmail_api_disabled",
        GMAIL_API_CONSOLE_URL,
      );
    }
    if (response.status === 401 || response.status === 403) {
      if (response.status === 401) {
        const account = readJson<GmailAccount>(GMAIL_KEY);
        if (account) writeJson(GMAIL_KEY, { ...account, expiresAt: 0 });
      }
      throw new EmailProviderError(
        "حساب Gmail لا يملك صلاحية الإرسال. أعد ربط Gmail من إعدادات الإرسال ووافق على صلاحية إرسال البريد.",
        "gmail_permission",
      );
    }
    throw new EmailProviderError(
      `تعذر إرسال البريد عبر Gmail (رمز ${response.status}).`,
      "email_send_failed",
    );
  }
}

export async function openExternalUrl(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const result = await AppLauncher.openUrl({ url });
    if (!result.completed) throw new Error("تعذر فتح الرابط");
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export async function openEmailComposer(
  recipients: string[],
  subject: string,
  body: string,
): Promise<void> {
  const to = recipients.join(",");
  const url = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  await openExternalUrl(url);
}

export function getOutlookAccount(): Pick<OutlookAccount, "email" | "displayName" | "clientId"> | null {
  const account = readJson<OutlookAccount>(OUTLOOK_KEY);
  return account ? { email: account.email, displayName: account.displayName, clientId: account.clientId } : null;
}

export function disconnectOutlook(): void {
  localStorage.removeItem(OUTLOOK_KEY);
}

async function exchangeOutlookCode(clientId: string, code: string, verifier: string): Promise<OutlookAccount> {
  const form = new URLSearchParams({
    client_id: clientId,
    code,
    redirect_uri: OUTLOOK_REDIRECT_URI,
    grant_type: "authorization_code",
    code_verifier: verifier,
    scope: "openid email offline_access User.Read Mail.Send",
  });
  const tokenResponse = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const token = await tokenResponse.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!tokenResponse.ok || !token.access_token) {
    throw new Error(token.error_description || "تعذر الحصول على صلاحية Outlook");
  }
  const profileResponse = await fetch("https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const profile = await profileResponse.json() as { displayName?: string; mail?: string; userPrincipalName?: string };
  if (!profileResponse.ok) throw new Error("تعذر قراءة بيانات حساب Outlook");
  return {
    clientId,
    email: profile.mail || profile.userPrincipalName || "",
    displayName: profile.displayName,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + Math.max(60, Number(token.expires_in || 3600) - 120) * 1000,
  };
}

export async function connectOutlook(clientId: string): Promise<string> {
  if (!Capacitor.isNativePlatform()) throw new Error("ربط Outlook متاح من تطبيق الهاتف");
  if (!clientId.trim()) throw new Error("أدخل Microsoft Application (Client) ID أولًا");
  const verifier = randomUrlSafe(48);
  const state = randomUrlSafe(24);
  const challenge = await sha256(verifier);
  const authorize = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  authorize.search = new URLSearchParams({
    client_id: clientId.trim(),
    response_type: "code",
    redirect_uri: OUTLOOK_REDIRECT_URI,
    response_mode: "query",
    scope: "openid email offline_access User.Read Mail.Send",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();

  const { App } = await import("@capacitor/app");
  const { AppLauncher } = await import("@capacitor/app-launcher");
  return new Promise<string>(async (resolve, reject) => {
    let finished = false;
    const timeout = window.setTimeout(() => finish(new Error("انتهت مهلة ربط Outlook")), 5 * 60 * 1000);
    let listener: { remove: () => Promise<void> } | undefined;
    const finish = (error?: Error, email?: string) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      void listener?.remove();
      if (error) reject(error);
      else resolve(email || "");
    };
    listener = await App.addListener("appUrlOpen", async ({ url }) => {
      if (!url.startsWith(OUTLOOK_REDIRECT_URI)) return;
      try {
        const parsed = new URL(url);
        if (parsed.searchParams.get("state") !== state) throw new Error("تعذر التحقق من جلسة Outlook");
        const oauthError = parsed.searchParams.get("error_description") || parsed.searchParams.get("error");
        if (oauthError) throw new Error(oauthError);
        const code = parsed.searchParams.get("code");
        if (!code) throw new Error("لم يصل رمز التفويض من Outlook");
        const account = await exchangeOutlookCode(clientId.trim(), code, verifier);
        writeJson(OUTLOOK_KEY, account);
        finish(undefined, account.email);
      } catch (error) {
        finish(error instanceof Error ? error : new Error("تعذر ربط Outlook"));
      }
    });
    const result = await AppLauncher.openUrl({ url: authorize.toString() });
    if (!result.completed) finish(new Error("تعذر فتح صفحة تسجيل الدخول إلى Outlook"));
  });
}

async function getValidOutlookToken(): Promise<string> {
  const account = readJson<OutlookAccount>(OUTLOOK_KEY);
  if (!account) throw new Error("اربط حساب Outlook أولًا");
  if (account.accessToken && Date.now() < account.expiresAt) return account.accessToken;
  if (!account.refreshToken) throw new Error("انتهت جلسة Outlook. أعد ربط الحساب.");
  const response = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: account.clientId,
      refresh_token: account.refreshToken,
      grant_type: "refresh_token",
      scope: "openid email offline_access User.Read Mail.Send",
    }),
  });
  const refreshed = await response.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!response.ok || !refreshed.access_token) throw new Error(refreshed.error_description || "تعذر تحديث جلسة Outlook");
  writeJson(OUTLOOK_KEY, {
    ...account,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token || account.refreshToken,
    expiresAt: Date.now() + Math.max(60, Number(refreshed.expires_in || 3600) - 120) * 1000,
  });
  return refreshed.access_token;
}

export async function sendOutlookEmail(to: string, subject: string, body: string): Promise<void> {
  const accessToken = await getValidOutlookToken();
  const response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: "Text", content: body },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: true,
    }),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`فشل إرسال Outlook (${response.status}): ${details.slice(0, 180)}`);
  }
}

export function getWhatsAppBusinessAccount(): Omit<WhatsAppBusinessAccount, "accessToken"> & { configured: boolean } | null {
  const account = readJson<WhatsAppBusinessAccount>(WHATSAPP_KEY);
  return account ? {
    phoneNumberId: account.phoneNumberId,
    graphVersion: account.graphVersion,
    languageCode: account.languageCode,
    paymentTemplate: account.paymentTemplate,
    overdueTemplate: account.overdueTemplate,
    contractTemplate: account.contractTemplate,
    configured: !!account.accessToken,
  } : null;
}

export function saveWhatsAppBusinessAccount(account: WhatsAppBusinessAccount): void {
  const current = readJson<WhatsAppBusinessAccount>(WHATSAPP_KEY);
  writeJson(WHATSAPP_KEY, {
    ...current,
    ...account,
    accessToken: account.accessToken || current?.accessToken || "",
  });
}

export function disconnectWhatsAppBusiness(): void {
  localStorage.removeItem(WHATSAPP_KEY);
}

export async function sendWhatsAppTemplate(
  recipient: string,
  templateKind: "paymentReminder" | "overduePayment" | "contractExpiry",
  message: string,
): Promise<void> {
  const account = readJson<WhatsAppBusinessAccount>(WHATSAPP_KEY);
  if (!account?.accessToken || !account.phoneNumberId) throw new Error("اربط WhatsApp Business API أولًا");
  const templateName = templateKind === "overduePayment"
    ? account.overdueTemplate
    : templateKind === "contractExpiry"
    ? account.contractTemplate
    : account.paymentTemplate;
  if (!templateName) throw new Error("اسم قالب WhatsApp المعتمد غير مسجل");
  const phone = recipient.replace(/[^\d]/g, "");
  const response = await fetch(
    `https://graph.facebook.com/${account.graphVersion || "v23.0"}/${account.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: templateName,
          language: { code: account.languageCode || "ar" },
          components: [{
            type: "body",
            parameters: [{ type: "text", text: message }],
          }],
        },
      }),
    },
  );
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`فشل إرسال واتساب (${response.status}): ${details.slice(0, 180)}`);
  }
}
