/**
 * Authentication and authorization middleware
 */

import { dbService } from '../services/db.js';
import logger from '../utils/logger.js';

export const requireAuth = async (req, res, next) => {
  const proceed = async () => {
    if (req.user && req.user.id) {
      try {
        const memberships = await dbService.getCollection('workspaceMemberships', { userId: req.user.id });
        if (memberships.length > 0) {
          let activeMembership = memberships.find(m => m.workspaceId === req.user.activeWorkspaceId);
          if (!activeMembership) {
            activeMembership = memberships[0];
            await dbService.updateItem('users', req.user.id, { activeWorkspaceId: activeMembership.workspaceId });
            req.user.activeWorkspaceId = activeMembership.workspaceId;
          }
          req.user.workspaceId = activeMembership.workspaceId;
          req.user.role = activeMembership.role;
        } else {
          // If no memberships exist, create a default membership for the legacy workspaceId
          const fallbackWorkspaceId = req.user.workspaceId || 'w-1';
          const role = req.user.role || 'EMPLOYEE';
          const membershipId = `wm-${req.user.id}-${fallbackWorkspaceId}`;
          await dbService.insertItem('workspaceMemberships', {
            id: membershipId,
            userId: req.user.id,
            workspaceId: fallbackWorkspaceId,
            role: role
          });
          req.user.workspaceId = fallbackWorkspaceId;
          req.user.activeWorkspaceId = fallbackWorkspaceId;
          req.user.role = role;
        }
      } catch (err) {
        console.error("Error resolving workspace membership inside auth middleware:", err);
      }
    }
    return next();
  };

  // Check if authorization header has a Bearer token
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    
    try {
      // Lazy-import to prevent errors if firebase-admin is not initialized or configured
      const { default: adminAuth } = await import('firebase-admin/auth');
      const decodedToken = await adminAuth.getAuth().verifyIdToken(token);
      
      // Map to context
      req.userId = decodedToken.uid;
      const user = await dbService.getItemById('users', req.userId);
      req.user = user || { id: req.userId, name: 'Firebase User', role: 'EMPLOYEE', workspaceId: 'w-1' };
      return proceed();
    } catch (error) {
      console.warn("⚠️ Expired or invalid Firebase ID token supplied. Trying fallback identity.", error.message);
    }
  }

  if (process.env.NODE_ENV === 'development' && process.env.ALLOW_DEV_BYPASS === 'true') {
    // Fallback 1: Custom Client request header indicating current workspace active user profile
    const clientActiveUserHeader = req.headers['x-active-user-id'];
    if (clientActiveUserHeader) {
      req.userId = clientActiveUserHeader;
      const user = await dbService.getItemById('users', clientActiveUserHeader);
      req.user = user || { id: clientActiveUserHeader, name: 'Guest Developer', role: 'EMPLOYEE', workspaceId: 'w-1' };
      return proceed();
    }

    // Fallback 2: Check current active user in db persistent state
    try {
      const curActiveId = await dbService.getActiveUserId();
      const user = await dbService.getItemById('users', curActiveId);
      if (user) {
        req.userId = curActiveId;
        req.user = user;
        return proceed();
      } else {
        const users = await dbService.getCollection('users');
        if (users.length > 0) {
          req.userId = users[0].id;
          req.user = users[0];
          return proceed();
        }
      }
    } catch (err) {
      logger.error("Authentication fallback collapsed:", err);
    }
  }

  // Final check: if req.userId has been set but req.user is not yet fully populated from db
  if (req.userId && !req.user?.workspaceId) {
    const user = await dbService.getItemById('users', req.userId);
    if (user) {
      req.user = user;
      return proceed();
    }
  }

  if (req.userId && req.user) {
    return proceed();
  }

  res.status(401).json({ error: "Unauthorized: Access token is missing or invalid." });
};

