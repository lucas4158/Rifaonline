import { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: any, res: any) {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  console.log("[ADMIN_LOGOUT] Admin initiated logout. Clearing session cookie.");
  res.setHeader(
    "Set-Cookie",
    "admin_session=; Path=/; HttpOnly; SameSite=None; Secure; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
  );
  return res.status(200).json({ success: true, message: "Logout realizado com sucesso" });
}
