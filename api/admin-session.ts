import { getAdminFirestore } from "./_firebaseAdmin.js";

const ALLOWED_ORIGINS = [
  "https://ais-dev-yqjhiz7q6asd2baqisutaf-537417047994.us-west2.run.app",
  "https://ais-pre-yqjhiz7q6asd2baqisutaf-537417047994.us-west2.run.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
];

function setAdminCors(req: any, res: any) {
  const origin = req.headers.origin;
  const isAllowed = origin && ALLOWED_ORIGINS.some(o => origin === o || origin.startsWith(o) || origin.endsWith(".run.app") || origin.includes("localhost"));
  if (isAllowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  } else {
    res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGINS[0]);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function parseCookies(cookieHeader?: string) {
  const cookies: { [key: string]: string } = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    const name = parts[0].trim();
    if (name) {
      cookies[name] = parts.slice(1).join("=").trim();
    }
  });
  return cookies;
}

export default async function handler(req: any, res: any) {
  setAdminCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // CSRF / Origin validation for state-changing requests
  if (req.method === "POST") {
    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const host = req.headers.host;

    if (origin) {
      const isAllowed = ALLOWED_ORIGINS.some(o => origin.startsWith(o)) || (host && origin.includes(host));
      if (!isAllowed) {
        return res.status(403).json({ error: "CSRF protection: Invalid Origin." });
      }
    } else if (referer && host) {
      if (!referer.includes(host)) {
        return res.status(403).json({ error: "CSRF protection: Referer mismatch." });
      }
    }
  }

  // Handle logout request
  if (req.query?.action === "logout" || req.body?.action === "logout" || (req.url && req.url.includes("admin-logout"))) {
    console.log("[ADMIN_LOGOUT] Admin initiated logout. Clearing session cookie.");
    res.setHeader(
      "Set-Cookie",
      "admin_session=; Path=/; HttpOnly; SameSite=Lax; Secure; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
    );
    return res.status(200).json({ success: true, message: "Logout realizado com sucesso" });
  }

  const authHeader = req.headers.authorization;
  let sessionToken = authHeader && authHeader.split(" ")[1];

  if (!sessionToken || sessionToken === "undefined" || sessionToken === "null" || sessionToken === "") {
    sessionToken = undefined;
  }

  // Fallback to cookie-based session token if authorization header is empty
  if (!sessionToken) {
    const cookies = parseCookies(req.headers.cookie);
    sessionToken = cookies["admin_session"];
  }

  if (!sessionToken) {
    return res.status(401).json({ authenticated: false, error: "Sessão inválida ou ausente." });
  }

  try {
    const adminDb = getAdminFirestore();
    if (!sessionToken.startsWith("SES_")) {
       return res.status(401).json({ authenticated: false, error: "Token format error." });
    }
    const sessionDoc = await adminDb.collection("admin_sessions").doc(sessionToken).get();

    if (!sessionDoc.exists) {
      console.warn("🔴 [ADMIN_SESSION_INVALID] Session token not found in admin_sessions.");
      return res.status(401).json({ authenticated: false, error: "Sessão inválida ou expirada." });
    }

    const sessionData = sessionDoc.data();
    if (!sessionData || !sessionData.expiresAt || sessionData.expiresAt <= Date.now()) {
      console.warn("🔴 [ADMIN_SESSION_EXPIRED] Session token in admin_sessions has expired.");
      return res.status(401).json({ authenticated: false, error: "Sessão expirada." });
    }

    console.log("🟢 [ADMIN_SESSION_VALID] Admin session token validated successfully via Admin SDK.");
    return res.status(200).json({ authenticated: true });
  } catch (err: any) {
    console.error("❌ [ADMIN_SESSION_ERROR] Error checking admin_sessions collection:", err);
    return res.status(500).json({ authenticated: false, error: "Erro interno ao validar sessão." });
  }
}
