const jwt = require("jsonwebtoken");

/**
 * Middleware to authenticate JWT access token from Authorization header
 * Sets req.user with decoded token data on success
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const accessToken = authHeader?.split(' ')[1];

  if (!accessToken) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please login."
    });
  }

  try {
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please refresh your token.",
        code: "TOKEN_EXPIRED"
      });
    }
    return res.status(401).json({
      success: false,
      message: "Invalid authentication token"
    });
  }
};

/**
 * Middleware to require specific roles
 * Must be used after authenticateToken
 * @param {string[]} roles - Array of allowed roles
 */
const requireRole = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Insufficient permissions."
      });
    }

    next();
  };
};

/**
 * Optional authentication - doesn't fail if no token, but sets req.user if valid
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const accessToken = authHeader?.split(' ')[1];

  if (!accessToken) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };
  } catch (err) {
    req.user = null;
  }

  next();
};

module.exports = {
  authenticateToken,
  requireRole,
  optionalAuth
};