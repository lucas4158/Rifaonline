import { getAdminFirestore, getAdminAuth } from "./_firebaseAdmin.js";

const ALLOWED_ORIGINS = [
  "https://rifamaster.vercel.app",
  "https://ais-dev-yqjhiz7q6asd2baqisutaf-537417047994.us-west2.run.app",
  "https://ais-pre-yqjhiz7q6asd2baqisutaf-537417047994.us-west2.run.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
];

function setAdminCors(req: any, res: any) {
  const origin = req.headers.origin;
  const isAllowed = origin && (ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".run.app") || origin.endsWith(".vercel.app"));
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

  // Handle logout request
  if (req.query?.action === "logout" || req.body?.action === "logout" || (req.url && req.url.includes("admin-logout"))) {
    console.log("[ADMIN_LOGOUT] Admin initiated logout.");
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

  if (!sessionToken) {
    const cookies = parseCookies(req.headers.cookie);
    sessionToken = cookies["admin_session"];
  }

  if (!sessionToken) {
    return res.status(401).json({ authenticated: false, error: "Sessão inválida ou ausente." });
  }

  try {
    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(sessionToken);
    if (decodedToken && decodedToken.uid) {
      console.log("🟢 [ADMIN_SESSION_VALID] Admin session token validated successfully via Firebase Auth.");
      return res.status(200).json({ authenticated: true });
    }
    return res.status(401).json({ authenticated: false, error: "Sessão inválida." });
  } catch (err: any) {
    console.warn("❌ [ADMIN_SESSION_ERROR] Invalid session token:", err?.message || err);
    return res.status(401).json({ authenticated: false, error: "Sessão expirada ou inválida." });
  }
}

