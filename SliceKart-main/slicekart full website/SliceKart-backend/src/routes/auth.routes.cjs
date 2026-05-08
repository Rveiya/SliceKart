const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { query } = require("../config/db.cjs");

const router = express.Router();

/* ===================== REGISTER ===================== */
router.post("/register", async (req, res) => {
  try {
    const { fullname, email, password, phone } = req.body;

    if (!fullname || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Full name, email and password are required"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters"
      });
    }

    const exists = await query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
      [email]
    );

    if (exists.rows.length) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await query(
      `INSERT INTO users (fullname, email, password_hash, role, phone)
       VALUES ($1, LOWER($2), $3, 'CUSTOMER', $4)
       RETURNING id, fullname, email, role, phone`,
      [fullname, email, hashedPassword, phone || null]
    );

    res.status(201).json({
      success: true,
      message: "Registered successfully",
      user: result.rows[0]
    });

  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({
      success: false,
      message: "Server error during registration"
    });
  }
});

/* ===================== LOGIN ===================== */
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Email/mobile number and password are required"
      });
    }

    // Detect if identifier is a phone number (all digits) or email
    const isPhone = /^\d{10}$/.test(identifier.trim());

    const result = await query(
      `SELECT id, email, password_hash, role, fullname, phone
       FROM users WHERE ${isPhone ? 'phone = $1' : 'LOWER(email) = LOWER($1)'}`,
      [identifier.trim()]
    );

    if (!result.rows.length) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Create JWT payload
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    // Generate access token (short-lived: 15 minutes)
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "15m"
    });

    // Generate refresh token (long-lived: 7 days)
    const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
      expiresIn: "7d"
    });

    // Hash the refresh token for secure storage
    const refreshHash = await bcrypt.hash(refreshToken, 10);

    // Update or insert session in database
    const session = await query(
      "SELECT id FROM user_sessions WHERE user_id = $1",
      [user.id]
    );

    if (session.rows.length > 0) {
      await query(
        `UPDATE user_sessions
         SET refresh_token_hash = $1,
             is_active = true,
             expires_at = NOW() + INTERVAL '7 days',
             updated_at = NOW()
         WHERE user_id = $2`,
        [refreshHash, user.id]
      );
    } else {
      await query(
        `INSERT INTO user_sessions (user_id, refresh_token_hash, is_active, expires_at)
         VALUES ($1, $2, true, NOW() + INTERVAL '7 days')`,
        [user.id, refreshHash]
      );
    }

    res.json({
      success: true,
      message: "Login successful",
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        role: user.role,
        phone: user.phone
      }
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({
      success: false,
      message: "Server error during login"
    });
  }
});

/* ===================== REFRESH TOKEN ===================== */
router.post("/refresh", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const refreshToken = authHeader?.split(' ')[1];

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "No refresh token provided"
      });
    }

    // Verify the refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token"
      });
    }

    // Check if session exists and is active
    const session = await query(
      `SELECT * FROM user_sessions
       WHERE user_id = $1 AND is_active = true AND expires_at > NOW()`,
      [decoded.userId]
    );

    if (!session.rows.length) {
      return res.status(403).json({
        success: false,
        message: "Session expired. Please login again."
      });
    }

    // Verify the refresh token hash matches
    const valid = await bcrypt.compare(
      refreshToken,
      session.rows[0].refresh_token_hash
    );

    if (!valid) {
      return res.status(403).json({
        success: false,
        message: "Invalid token. Please login again."
      });
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.json({
      success: true,
      message: "Token refreshed successfully",
      accessToken: newAccessToken
    });

  } catch (err) {
    console.error("Refresh error:", err);
    res.status(401).json({
      success: false,
      message: "Token refresh failed"
    });
  }
});

/* ===================== LOGOUT ===================== */
router.post("/logout", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const refreshToken = authHeader?.split(' ')[1];

    if (refreshToken) {
      try {
        // Decode the token to get user ID
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

        // Invalidate only this user's session
        await query(
          `UPDATE user_sessions
           SET is_active = false, updated_at = NOW()
           WHERE user_id = $1`,
          [decoded.userId]
        );
      } catch (err) {
        // Token might be expired, but continue logout
        console.log("Token expired during logout, continuing logout");
      }
    }

    res.json({
      success: true,
      message: "Logged out successfully"
    });
  } catch (err) {
    console.error("Logout error:", err);
    res.json({
      success: true,
      message: "Logged out"
    });
  }
});

/* ===================== VERIFY TOKEN (Check auth status) ===================== */
router.get("/verify", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.split(' ')[1];

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        authenticated: false,
        message: "No access token"
      });
    }

    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);

    // Get user data
    const result = await query(
      `SELECT id, fullname, email, role, phone FROM users WHERE id = $1`,
      [decoded.userId]
    );

    if (!result.rows.length) {
      return res.status(401).json({
        success: false,
        authenticated: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      authenticated: true,
      user: result.rows[0]
    });

  } catch (err) {
    return res.status(401).json({
      success: false,
      authenticated: false,
      message: "Invalid token"
    });
  }
});

module.exports = router;
