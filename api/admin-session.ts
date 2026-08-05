import { getAdminFirestore } from "./_firebaseAdmin.js";

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
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
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
