import { supabaseAdmin } from "../lib/supabase.js";

/**
 * authMiddleware
 *
 * Verifies the Supabase JWT sent by the admin dashboard on every
 * request to /api/admin/*. Expects:
 *   Authorization: Bearer <supabase-access-token>
 *
 * Uses supabaseAdmin.auth.getUser() which validates the token
 * signature against the project's JWT secret server-side — it does
 * NOT just decode the payload client-side.
 *
 * Returns 401 if the header is missing, malformed, or the token is
 * expired / invalid.
 */
export async function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: missing or malformed Authorization header.",
    });
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: invalid or expired session token.",
      });
    }

    // Attach the verified user to the request for downstream use
    req.user = data.user;

    next();
  } catch (err) {
    console.error("authMiddleware error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error during authentication.",
    });
  }
}