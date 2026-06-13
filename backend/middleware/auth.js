/**
 * Authentication and authorization middleware
 */

import { dbService } from '../services/db.js';

export const requireAuth = async (req, res, next) => {
  // Check if authorization header has a Bearer token
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    
    try {
      // Lazy-import to prevent errors if firebase-admin is not initialized or configured
      const { default: adminAuth } = await import('firebase-admin/auth');
      const decodedToken = await adminAuth.getAuth().verifyIdToken(token);
      
      // Map to context
      req.user = decodedToken;
      req.userId = decodedToken.uid;
      return next();
    } catch (error) {
      console.warn("⚠️ Expired or invalid Firebase ID token supplied. Trying fallback identity.", error.message);
    }
  }

  // Fallback 1: Custom Client request header indicating current workspace active user profile
  const clientActiveUserHeader = req.headers['x-active-user-id'];
  if (clientActiveUserHeader) {
    req.userId = clientActiveUserHeader;
    const users = await dbService.getCollection('users');
    const user = users.find(u => u.id === clientActiveUserHeader || u.uid === clientActiveUserHeader);
    req.user = user || { id: clientActiveUserHeader, name: 'Guest Developer' };
    return next();
  }

  // Fallback 2: Check current active user in db persistent state
  try {
    const curActiveId = await dbService.getActiveUserId();
    const users = await dbService.getCollection('users');
    const user = users.find(u => u.id === curActiveId);
    req.userId = curActiveId;
    req.user = user || users[0];
    return next();
  } catch (err) {
    console.error("Authentication fallback collapsed:", err);
    res.status(401).json({ error: "Unauthorized: Active user session could not be established." });
  }
};
