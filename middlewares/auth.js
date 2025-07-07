// middlewares/auth.js
import jwt from 'jsonwebtoken';
import redisClient from '../config/redis.js'; // make sure redis is connected

const userAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.token;

    if (!authHeader) {
      return res.status(401).json({ success: false, message: 'Not Authorized. Token missing' });
    }

    // Support both "Bearer token" and raw token formats
    const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;

    // Check Redis cache first
    const cachedSession = await redisClient.get(`session:${token}`);
    if (cachedSession) {
      req.user = JSON.parse(cachedSession);
      return next();
    }

    // Decode and verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.id) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    // Attach to req.user
    req.user = { id: decoded.id };

    // Cache the session
    await redisClient.setEx(`session:${token}`, 3600, JSON.stringify({ id: decoded.id })); // 1 hour TTL

    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    return res.status(401).json({ success: false, message: 'Unauthorized or expired token' });
  }
};

export default userAuth;
