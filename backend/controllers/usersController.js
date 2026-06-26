/**
 * Controller for User profiles, context switching, and Pomodoro Timer settings & sessions DB tracking
 */

import { dbService, bootstrapWorkspace } from '../services/db.js';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { logActivity } from '../utils/activityLogger.js';

const passwordResetOTPs = new Map(); // key: email -> { otp: string, expiresAt: number }

const signupSchema = z.object({
  email: z.string().email({ message: "Invalid email address format." }),
  password: z.string()
    .min(8, "Minimum 8 characters")
    .max(128, "Maximum 128 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[a-z]/, "Must contain at least one lowercase letter")
    .regex(/[0-9]/, "Must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Must contain at least one special character"),
  name: z.string().min(2, { message: "Name must be at least 2 characters long." }),
});

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address format." }),
  password: z.string().min(1, { message: "Password is required." }),
});

export const usersController = {
  checkWorkspaceExists: async (req, res) => {
    try {
      const workspaces = await dbService.getCollection('workspaces');
      res.json({ workspaceExists: workspaces.length > 0 });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getInvitationById: async (req, res) => {
    try {
      const invitation = await dbService.getItemById('invitations', req.params.id);
      if (!invitation || invitation.status !== 'PENDING') {
        return res.status(404).json({ error: "Invitation not found or no longer pending." });
      }
      if (new Date(invitation.expiresAt) < new Date()) {
        return res.status(400).json({ error: "Invitation has expired." });
      }
      res.json(invitation);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  setupFirstWorkspace: async (req, res) => {
    try {
      // Lazy import prisma client to match other server components if needed
      const workspaces = await dbService.getCollection('workspaces');
      if (workspaces.length > 0) {
        return res.status(400).json({ error: "Workspaces already exist in the system. Please use the login portal." });
      }

      const { workspaceName, name, email, password } = req.body;
      if (!workspaceName || !name || !email || !password) {
        return res.status(400).json({ error: "All fields are required." });
      }

      // Enforce user password rules
      const parseResult = signupSchema.safeParse({ name, email, password });
      if (!parseResult.success) {
        const issues = parseResult.error.issues || parseResult.error.errors || [];
        const errorMsg = issues.map(e => e.message).join(' | ');
        return res.status(400).json({ error: errorMsg });
      }

      const userId = `u-${Date.now()}`;
      const workspaceId = `w-${Date.now()}`;
      const hashedPassword = bcrypt.hashSync(password, 10);

      // 1. Create user
      const user = await dbService.insertItem('users', {
        id: userId,
        name,
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        avatarUrl: name.charAt(0).toUpperCase() || 'U',
        color: "bg-indigo-600 text-white",
        timezone: "UTC",
        role: "SUPER_ADMIN",
        workspaceId: workspaceId,
        activeWorkspaceId: workspaceId
      });

      // 2. Create workspace using db service or direct prisma
      const { PrismaClient } = await import('@prisma/client');
      const prismaClient = new PrismaClient();
      await prismaClient.workspace.create({
        data: {
          id: workspaceId,
          name: workspaceName,
          ownerId: userId,
          createdAt: new Date()
        }
      });

      // Create default Space: General
      const spaceId = `s-gen-${Date.now()}`;
      await prismaClient.space.create({
        data: {
          id: spaceId,
          workspaceId: workspaceId,
          name: "General",
          color: "#6366f1",
          icon: "Cpu",
          isPrivate: false,
          memberIds: JSON.stringify([userId])
        }
      });

      // Create default List: Getting Started
      const listId = `l-start-${Date.now()}`;
      await prismaClient.list.create({
        data: {
          id: listId,
          spaceId: spaceId,
          folderId: "",
          name: "Getting Started",
          createdAt: new Date().toISOString(),
          customFields: "[]"
        }
      });

      // Create default Channel: #general
      const channelId = `ch-gen-${Date.now()}`;
      await prismaClient.channel.create({
        data: {
          id: channelId,
          workspaceId: workspaceId,
          name: "general",
          description: "Workspace-wide announcements and team general chat.",
          isPrivate: false,
          isDM: false,
          memberIds: JSON.stringify([userId]),
          createdAt: new Date().toISOString()
        }
      });

      // 3. Create workspace membership for creator as SUPER_ADMIN
      await dbService.insertItem('workspaceMemberships', {
        id: `wm-${userId}-${workspaceId}`,
        userId,
        workspaceId,
        role: 'SUPER_ADMIN'
      });

      await dbService.setActiveUserId(userId);

      const token = jwt.sign(
        { id: user.id, email: user.email, role: 'SUPER_ADMIN', workspaceId: workspaceId },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      const { password: _, ...safeUser } = user;

      await logActivity(userId, workspaceId, 'WORKSPACE_SETUP', { workspaceName });

      res.status(201).json({
        success: true,
        user: { ...safeUser, role: 'SUPER_ADMIN', workspaceId, activeWorkspaceId: workspaceId },
        token,
        workspaces: [{ id: workspaceId, name: workspaceName, role: 'SUPER_ADMIN' }]
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createWorkspace: async (req, res) => {
    try {
      const callerRole = req.user.role;
      if (callerRole !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: "Only Super Admins can create new workspaces." });
      }

      const { name, description, logoUrl } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Workspace name is required." });
      }

      const workspaceId = `w-${Date.now()}`;
      const userId = req.user.id;

      // 1. Create Workspace
      const { PrismaClient } = await import('@prisma/client');
      const prismaClient = new PrismaClient();
      await prismaClient.workspace.create({
        data: {
          id: workspaceId,
          name,
          description: description || "",
          logoUrl: logoUrl || "",
          ownerId: userId,
          createdAt: new Date()
        }
      });

      // 2. Create WorkspaceMembership
      await dbService.insertItem('workspaceMemberships', {
        id: `wm-${userId}-${workspaceId}`,
        userId,
        workspaceId,
        role: 'SUPER_ADMIN'
      });

      // 3. Bootstrap default Space, List, and Channel
      const spaceId = `s-gen-${Date.now()}`;
      await prismaClient.space.create({
        data: {
          id: spaceId,
          workspaceId: workspaceId,
          name: "General",
          color: "#6366f1",
          icon: "Cpu",
          isPrivate: false,
          memberIds: JSON.stringify([userId])
        }
      });

      const listId = `l-start-${Date.now()}`;
      await prismaClient.list.create({
        data: {
          id: listId,
          spaceId: spaceId,
          folderId: "",
          name: "Getting Started",
          createdAt: new Date().toISOString(),
          customFields: "[]"
        }
      });

      const channelId = `ch-gen-${Date.now()}`;
      await prismaClient.channel.create({
        data: {
          id: channelId,
          workspaceId: workspaceId,
          name: "general",
          description: "Workspace-wide announcements and team general chat.",
          isPrivate: false,
          isDM: false,
          memberIds: JSON.stringify([userId]),
          createdAt: new Date().toISOString()
        }
      });

      // 4. Update user's activeWorkspaceId to the new workspace
      await dbService.updateItem('users', userId, { activeWorkspaceId: workspaceId });

      await logActivity(userId, workspaceId, 'WORKSPACE_CREATED', { name });

      // Generate a new token with the updated workspace context
      const token = jwt.sign(
        { id: req.user.id, email: req.user.email, role: 'SUPER_ADMIN', workspaceId: workspaceId },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      const user = await dbService.getItemById('users', userId);
      const { password: _, ...safeUser } = user;

      // Fetch updated workspaces list
      const memberships = await dbService.getCollection('workspaceMemberships', { userId });
      const workspacesList = [];
      for (const m of memberships) {
        const w = await dbService.getItemById('workspaces', m.workspaceId);
        if (w) {
          workspacesList.push({
            id: w.id,
            name: w.name,
            logoUrl: w.logoUrl,
            role: m.role
          });
        }
      }

      res.status(201).json({
        success: true,
        user: { ...safeUser, role: 'SUPER_ADMIN', workspaceId, activeWorkspaceId: workspaceId },
        token,
        workspaces: workspacesList
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  switchWorkspace: async (req, res) => {
    try {
      const { workspaceId } = req.body;
      const userId = req.userId;

      if (!workspaceId) {
        return res.status(400).json({ error: "workspaceId is required to switch workspace." });
      }

      // Check if user has membership in target workspace
      const memberships = await dbService.getCollection('workspaceMemberships', { userId });
      const targetMembership = memberships.find(m => m.workspaceId === workspaceId);
      if (!targetMembership) {
        return res.status(403).json({ error: "Access denied: you are not a member of the target workspace." });
      }

      // Update activeWorkspaceId
      await dbService.updateItem('users', userId, { activeWorkspaceId: workspaceId });

      await logActivity(userId, workspaceId, 'WORKSPACE_SWITCHED', { workspaceId });

      // Generate new token with correct role/workspace context
      const token = jwt.sign(
        { id: userId, email: req.user.email, role: targetMembership.role, workspaceId: workspaceId },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      const user = await dbService.getItemById('users', userId);
      const { password: _, ...safeUser } = user;

      const workspacesList = [];
      for (const m of memberships) {
        const w = await dbService.getItemById('workspaces', m.workspaceId);
        if (w) {
          workspacesList.push({
            id: w.id,
            name: w.name,
            logoUrl: w.logoUrl,
            role: m.role
          });
        }
      }

      res.json({
        success: true,
        user: { ...safeUser, role: targetMembership.role, workspaceId, activeWorkspaceId: workspaceId },
        token,
        workspaces: workspacesList
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getUsers: async (req, res) => {
    try {
      const users = await dbService.getCollection('users');
      const safeUsers = users.map(({ password, ...u }) => u);
      res.json(safeUsers);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getActiveUser: async (req, res) => {
    try {
      const activeId = req.userId || await dbService.getActiveUserId();
      const users = await dbService.getCollection('users');
      const activeUser = users.find(u => u.id === activeId) || users[0];
      if (activeUser) {
        const { password, ...safeUser } = activeUser;
        
        // Resolve memberships and role
        const memberships = await dbService.getCollection('workspaceMemberships', { userId: activeUser.id });
        let activeMembership = memberships.find(m => m.workspaceId === activeUser.activeWorkspaceId);
        if (!activeMembership && memberships.length > 0) {
          activeMembership = memberships[0];
        }
        
        const resolvedRole = activeMembership ? activeMembership.role : activeUser.role;
        const resolvedWorkspaceId = activeMembership ? activeMembership.workspaceId : (activeUser.workspaceId || 'w-1');

        const workspacesList = [];
        for (const m of memberships) {
          const w = await dbService.getItemById('workspaces', m.workspaceId);
          if (w) {
            workspacesList.push({
              id: w.id,
              name: w.name,
              logoUrl: w.logoUrl,
              role: m.role
            });
          }
        }

        const token = jwt.sign(
          { id: activeUser.id, email: activeUser.email, role: resolvedRole, workspaceId: resolvedWorkspaceId },
          process.env.JWT_SECRET,
          { expiresIn: '24h' }
        );
        return res.json({
          ...safeUser,
          role: resolvedRole,
          workspaceId: resolvedWorkspaceId,
          activeWorkspaceId: resolvedWorkspaceId,
          token,
          workspaces: workspacesList
        });
      }
      res.json(activeUser);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  switchActiveUser: async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId is required for context switching." });
      }

      const users = await dbService.getCollection('users');
      const exists = users.some(u => u.id === userId);
      if (!exists) {
        return res.status(404).json({ error: "User profile not found." });
      }

      await dbService.setActiveUserId(userId);
      const activeUser = users.find(u => u.id === userId);
      const token = jwt.sign(
        { id: activeUser.id, email: activeUser.email, role: activeUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      const { password, ...safeUser } = activeUser;
      res.json({ success: true, activeUser: safeUser, token });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Pomodoro Settings fetch & save
  getPomodoroSettings: async (req, res) => {
    try {
      const settingsList = await dbService.getCollection('pomodoroSettings');
      let settings = settingsList.find(s => s.userId === req.userId);

      if (!settings) {
        // Auto-initialize standard Pomodoro values
        settings = await dbService.insertItem('pomodoroSettings', {
          id: `ps-${req.userId}`,
          userId: req.userId,
          workDuration: 25,
          shortBreak: 5,
          longBreak: 15,
          autoStartTime: false
        });
      }
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  updatePomodoroSettings: async (req, res) => {
    try {
      const { workDuration, shortBreak, longBreak, autoStartTime } = req.body;
      const settingsList = await dbService.getCollection('pomodoroSettings');
      let settings = settingsList.find(s => s.userId === req.userId);

      const updates = {
        workDuration: parseInt(workDuration) || 25,
        shortBreak: parseInt(shortBreak) || 5,
        longBreak: parseInt(longBreak) || 15,
        autoStartTime: !!autoStartTime
      };

      if (settings) {
        const result = await dbService.updateItem('pomodoroSettings', settings.id, updates);
        res.json(result);
      } else {
        const created = await dbService.insertItem('pomodoroSettings', {
          id: `ps-${req.userId}`,
          userId: req.userId,
          ...updates
        });
        res.json(created);
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Pomodoro Completed Sessions tracking
  getPomodoroSessions: async (req, res) => {
    try {
      const sessions = await dbService.getCollection('pomodoroSessions');
      const userSessions = sessions.filter(s => s.userId === req.userId);
      res.json(userSessions);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createPomodoroSession: async (req, res) => {
    try {
      const { taskId, durationMinutes, type } = req.body;
      if (!durationMinutes || !type) {
        return res.status(400).json({ error: "durationMinutes and session type required." });
      }

      const newSession = {
        userId: req.userId,
        taskId: taskId || "",
        durationMinutes: parseInt(durationMinutes),
        type, // e.g. "WORK", "SHORT_BREAK", "LONG_BREAK"
        completedAt: new Date().toISOString()
      };

      const result = await dbService.insertItem('pomodoroSessions', newSession);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  signup: async (req, res) => {
    try {
      const workspaces = await dbService.getCollection('workspaces');
      if (workspaces.length > 0) {
        return res.status(403).json({ error: "Direct registration is disabled. You must join via invitation." });
      } else {
        return res.status(400).json({ error: "No workspace exists. Please create a workspace first." });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  login: async (req, res) => {
    try {
      // Validate inputs using Zod
      const parseResult = loginSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errorMsg = parseResult.error.errors.map(e => e.message).join(' | ');
        return res.status(400).json({ error: errorMsg });
      }

      const { email, password } = parseResult.data;

      const users = await dbService.getCollection('users');
      let user = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());

      // Auto-create Client Demo account if it doesn't exist
      if (!user && email.toLowerCase().trim() === 'client@flowup.io') {
        const hashedPassword = bcrypt.hashSync('password123', 10);
        user = await dbService.insertItem('users', {
          id: 'u-client',
          name: 'Client Demo',
          email: 'client@flowup.io',
          password: hashedPassword,
          avatarUrl: 'C',
          color: 'bg-emerald-500 text-white',
          timezone: 'UTC',
          role: 'SUPER_ADMIN',
          workspaceId: 'w-1',
          activeWorkspaceId: 'w-1'
        });
        await dbService.insertItem('workspaceMemberships', {
          id: 'wm-u-client-w-1',
          userId: 'u-client',
          workspaceId: 'w-1',
          role: 'SUPER_ADMIN'
        });
      }

      if (!user) {
        return res.status(401).json({ error: "User profile with this email address does not exist." });
      }

      const isMatch = bcrypt.compareSync(password, user.password);

      if (!isMatch) {
        return res.status(401).json({ error: "Incorrect password. Please try again." });
      }

      // Log session in
      await dbService.setActiveUserId(user.id);

      // Resolve memberships and role
      const memberships = await dbService.getCollection('workspaceMemberships', { userId: user.id });
      let activeMembership = memberships.find(m => m.workspaceId === user.activeWorkspaceId);
      if (!activeMembership && memberships.length > 0) {
        activeMembership = memberships[0];
      }

      const resolvedRole = activeMembership ? activeMembership.role : user.role;
      const resolvedWorkspaceId = activeMembership ? activeMembership.workspaceId : (user.workspaceId || 'w-1');

      const workspacesList = [];
      for (const m of memberships) {
        const w = await dbService.getItemById('workspaces', m.workspaceId);
        if (w) {
          workspacesList.push({
            id: w.id,
            name: w.name,
            logoUrl: w.logoUrl,
            role: m.role
          });
        }
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: resolvedRole, workspaceId: resolvedWorkspaceId },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      const { password: _, ...safeUser } = user;

      await logActivity(user.id, resolvedWorkspaceId, 'USER_LOGIN', { email: user.email });

      res.json({
        success: true,
        user: {
          ...safeUser,
          role: resolvedRole,
          workspaceId: resolvedWorkspaceId,
          activeWorkspaceId: resolvedWorkspaceId
        },
        token,
        workspaces: workspacesList
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  forgotPassword: async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required." });
      }

      const users = await dbService.getCollection('users');
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());

      if (!user) {
        return res.status(404).json({ error: "User profile with this email address does not exist." });
      }

      // Generate a 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
      passwordResetOTPs.set(email.toLowerCase().trim(), {
        otp: hashedOtp,
        expiresAt: Date.now() + 600000 // 10 minutes duration
      });

      console.log(`[PASSWORD RESET OTP] Generated OTP for ${email}: ${otp}`);

      // Try sending with nodemailer
      const host = process.env.SMTP_HOST;
      const port = process.env.SMTP_PORT || 587;
      const smtpUser = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;
      const from = process.env.SMTP_FROM || 'no-reply@flowup.io';

      let transporter;
      let finalFrom = from;

      if (host && smtpUser && pass) {
        try {
          transporter = nodemailer.createTransport({
            host,
            port: parseInt(port),
            secure: parseInt(port) === 465,
            auth: { user: smtpUser, pass }
          });
        } catch (err) {
          console.error("[SMTP ERROR] Transport build failed in password reset:", err.message);
        }
      }

      if (!transporter) {
        try {
          const testAccount = await nodemailer.createTestAccount();
          transporter = nodemailer.createTransport({
            host: testAccount.smtp.host,
            port: testAccount.smtp.port,
            secure: testAccount.smtp.secure,
            auth: {
              user: testAccount.user,
              pass: testAccount.pass
            }
          });
          finalFrom = `"FlowUp automated" <${testAccount.user}>`;
        } catch (err) {
          console.warn("[SMTP FALLBACK ERROR] Ethereal service unreachable. Using local response bypass.");
        }
      }

      let previewUrl = null;
      if (transporter) {
        try {
          const mailOptions = {
            from: finalFrom,
            to: email.toLowerCase().trim(),
            subject: "FlowUp - Reset Your Password OTP Code",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
                <h2 style="color: #4f46e5; margin-top: 0; text-align: center;">Reset Your Password</h2>
                <p style="font-size: 15px; color: #1e293b;">Hello <strong>${user.name}</strong>,</p>
                <p style="font-size: 15px; color: #334155; line-height: 1.5;">You requested to reset your password. Please use the following one-time passcode (OTP) to choose a new password. This code remains active for 10 minutes:</p>
                <div style="margin: 30px 0; text-align: center;">
                  <div style="background-color: #f1f5f9; color: #1e1b4b; padding: 18px 36px; text-decoration: none; border-radius: 8px; font-weight: bolder; font-size: 28px; display: inline-block; letter-spacing: 5px; border: 1px dashed #4f46e5;">
                    ${otp}
                  </div>
                </div>
                <p style="color: #64748b; font-size: 13px; line-height: 1.5;">If you did not request this OTP, you can safely ignore this email. Your current password remains secure.</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
                <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-bottom: 0;">Sent securely via ClickUp FlowUp Workspace Messenger</p>
              </div>
            `
          };
          const info = await transporter.sendMail(mailOptions);
          previewUrl = nodemailer.getTestMessageUrl(info);
          if (previewUrl) {
            console.log(`[SMTP RESET PREVIEW] Click here to view sent test reset email: ${previewUrl}`);
          }
        } catch (mailErr) {
          console.error("[SMTP ERROR] Mail delivery dispatch failed in password reset:", mailErr.message);
        }
      }

      res.json({
        message: "If this email exists, a reset code has been sent."
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  verifyResetPassword: async (req, res) => {
    try {
      const { email, otp, newPassword } = req.body;
      if (!email || !otp || !newPassword) {
        return res.status(400).json({ error: "Email, OTP and a new password are required." });
      }

      const cleanEmail = email.toLowerCase().trim();
      const storedOtpInfo = passwordResetOTPs.get(cleanEmail);

      if (!storedOtpInfo) {
        return res.status(400).json({ error: "OTP transaction was not initiated or has expired. Please try again." });
      }

      if (storedOtpInfo.expiresAt < Date.now()) {
        passwordResetOTPs.delete(cleanEmail);
        return res.status(400).json({ error: "This OTP has expired. Please request a new code." });
      }

      const hashedIncoming = crypto.createHash('sha256').update(otp.trim()).digest('hex');
      if (storedOtpInfo.otp !== hashedIncoming) {
        return res.status(400).json({ error: "Incorrect OTP entered. Please check the code and try again." });
      }

      const users = await dbService.getCollection('users');
      const user = users.find(u => u.email.toLowerCase() === cleanEmail);
      if (!user) {
        return res.status(404).json({ error: "User profile linked to this email was not found." });
      }

      const hashedPassword = bcrypt.hashSync(newPassword, 10);
      await dbService.updateItem('users', user.id, { password: hashedPassword });

      // Clean up verification state
      passwordResetOTPs.delete(cleanEmail);

      res.json({
        success: true,
        message: "Your password has been successfully updated. You can now securely log in!"
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  promoteToSuperAdmin: async (req, res) => {
    try {
      const caller = await dbService.getItemById('users', req.userId);
      if (!caller || caller.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: "Super Admin privileges required." });
      }

      const targetId = req.params.id;
      const targetUser = await dbService.getItemById('users', targetId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found." });
      }

      const updated = await dbService.updateItem('users', targetId, { role: 'SUPER_ADMIN' });
      await logActivity(req.userId, caller.workspaceId, 'USER_PROMOTED', { userId: targetId });
      res.json({ success: true, user: updated });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  demoteFromSuperAdmin: async (req, res) => {
    try {
      const caller = await dbService.getItemById('users', req.userId);
      if (!caller || caller.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: "Super Admin privileges required." });
      }

      const targetId = req.params.id;
      const targetUser = await dbService.getItemById('users', targetId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found." });
      }

      if (targetUser.role === 'SUPER_ADMIN') {
        const users = await dbService.getCollection('users');
        const superAdmins = users.filter(u => u.role === 'SUPER_ADMIN');
        if (superAdmins.length === 1 && superAdmins[0].id === targetId) {
          return res.status(400).json({ error: "Cannot remove the last Super Admin. Promote another user to Super Admin first." });
        }
      }

      const updated = await dbService.updateItem('users', targetId, { role: 'ADMIN' });
      await logActivity(req.userId, caller.workspaceId, 'USER_DEMOTED', { userId: targetId });
      res.json({ success: true, user: updated });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  deactivateUser: async (req, res) => {
    try {
      const caller = await dbService.getItemById('users', req.userId);
      if (!caller || caller.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: "Super Admin privileges required." });
      }

      const targetId = req.params.id;
      const targetUser = await dbService.getItemById('users', targetId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found." });
      }

      if (targetUser.role === 'SUPER_ADMIN') {
        const users = await dbService.getCollection('users');
        const superAdmins = users.filter(u => u.role === 'SUPER_ADMIN');
        if (superAdmins.length === 1 && superAdmins[0].id === targetId) {
          return res.status(400).json({ error: "Cannot remove the last Super Admin. Promote another user to Super Admin first." });
        }
      }

      // Since schema has no active state, deactivating deletes the user or changes role to suspended.
      // Let's perform user deletion as a deactivation representation.
      await dbService.deleteItem('users', targetId);
      await logActivity(req.userId, caller.workspaceId, 'USER_DEACTIVATED', { userId: targetId });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  deleteUser: async (req, res) => {
    try {
      const caller = await dbService.getItemById('users', req.userId);
      if (!caller || caller.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: "Super Admin privileges required." });
      }

      const targetId = req.params.id;
      const targetUser = await dbService.getItemById('users', targetId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found." });
      }

      if (targetUser.role === 'SUPER_ADMIN') {
        const users = await dbService.getCollection('users');
        const superAdmins = users.filter(u => u.role === 'SUPER_ADMIN');
        if (superAdmins.length === 1 && superAdmins[0].id === targetId) {
          return res.status(400).json({ error: "Cannot remove the last Super Admin. Promote another user to Super Admin first." });
        }
      }

      await dbService.deleteItem('users', targetId);
      await logActivity(req.userId, caller.workspaceId, 'USER_DELETED', { userId: targetId });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getWorkspaceSettings: async (req, res) => {
    try {
      const workspaceId = req.user.workspaceId || 'w-1';
      const workspace = await dbService.getItemById('workspaces', workspaceId);
      if (!workspace) {
        return res.status(404).json({ error: "Workspace not found." });
      }
      res.json(workspace);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  updateWorkspaceSettings: async (req, res) => {
    try {
      if (req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: "Only Super Admin can update workspace settings." });
      }
      const workspaceId = req.user.workspaceId || 'w-1';
      const { name, description, logoUrl } = req.body;
      const workspace = await dbService.getItemById('workspaces', workspaceId);
      if (!workspace) {
        return res.status(404).json({ error: "Workspace not found." });
      }
      const updated = await dbService.updateItem('workspaces', workspaceId, {
        name: name !== undefined ? name : workspace.name,
        description: description !== undefined ? description : workspace.description,
        logoUrl: logoUrl !== undefined ? logoUrl : workspace.logoUrl
      });

      await logActivity(req.userId, workspaceId, 'WORKSPACE_SETTINGS_UPDATED', { name, description });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createInvitation: async (req, res) => {
    try {
      const callerRole = req.user.role;
      const workspaceId = req.user.workspaceId || 'w-1';
      const { email, role } = req.body;

      if (!email || !role) {
        return res.status(400).json({ error: "Email and role are required." });
      }

      const roleUpper = role.toUpperCase();
      if (roleUpper !== 'ADMIN' && roleUpper !== 'EMPLOYEE') {
        return res.status(400).json({ error: "Invalid role specified. Must be ADMIN or EMPLOYEE." });
      }

      if (callerRole === 'ADMIN' && roleUpper !== 'EMPLOYEE') {
        return res.status(403).json({ error: "Admins can only invite Employees." });
      }

      if (callerRole !== 'SUPER_ADMIN' && callerRole !== 'ADMIN') {
        return res.status(403).json({ error: "Access denied: insufficient permissions to invite users." });
      }

      const id = `inv-${Date.now()}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitation = await dbService.insertItem('invitations', {
        id,
        email: email.toLowerCase().trim(),
        role: roleUpper,
        workspaceId,
        createdBy: req.userId,
        expiresAt,
        createdAt: new Date(),
        status: 'PENDING'
      });

      const baseUrl = req.headers.origin || 'http://localhost:5173';
      const inviteUrl = `${baseUrl}/?inviteId=${id}`;

      // SMTP transporter configuration
      const host = process.env.SMTP_HOST;
      const port = process.env.SMTP_PORT || 587;
      const smtpUser = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;
      const from = process.env.SMTP_FROM || 'no-reply@flowup.io';

      let transporter;
      let finalFrom = from;

      if (host && smtpUser && pass) {
        try {
          transporter = nodemailer.createTransport({
            host,
            port: parseInt(port),
            secure: parseInt(port) === 465,
            auth: { user: smtpUser, pass }
          });
        } catch (err) {
          console.error("[SMTP ERROR] Transport build failed in invitation:", err.message);
        }
      }

      if (!transporter) {
        try {
          const testAccount = await nodemailer.createTestAccount();
          transporter = nodemailer.createTransport({
            host: testAccount.smtp.host,
            port: testAccount.smtp.port,
            secure: testAccount.smtp.secure,
            auth: {
              user: testAccount.user,
              pass: testAccount.pass
            }
          });
          finalFrom = `"FlowUp automated" <${testAccount.user}>`;
        } catch (err) {
          console.warn("[SMTP FALLBACK ERROR] Ethereal service unreachable. Using local response bypass.");
        }
      }

      let previewUrl = null;
      if (transporter) {
        try {
          const mailOptions = {
            from: finalFrom,
            to: email.toLowerCase().trim(),
            subject: "FlowUp - You have been invited to join the workspace!",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
                <h2 style="color: #4f46e5; margin-top: 0; text-align: center;">Workspace Invitation</h2>
                <p style="font-size: 15px; color: #1e293b;">Hello,</p>
                <p style="font-size: 15px; color: #334155; line-height: 1.5;">You have been invited to join the workspace as an <strong>${roleUpper}</strong>. Click the link below to accept the invitation and set up your account:</p>
                <div style="margin: 30px 0; text-align: center;">
                  <a href="${inviteUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">Accept Invitation</a>
                </div>
                <p style="color: #64748b; font-size: 13px; line-height: 1.5;">If the button above does not work, copy and paste this URL into your browser:</p>
                <p style="color: #4f46e5; font-size: 13px; word-break: break-all;">${inviteUrl}</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
                <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-bottom: 0;">Sent securely via ClickUp FlowUp Workspace Messenger</p>
              </div>
            `
          };

          const info = await transporter.sendMail(mailOptions);
          previewUrl = nodemailer.getTestMessageUrl(info);
          if (previewUrl) {
            console.log(`[SMTP INVITATION PREVIEW] Click here to view sent test invitation email: ${previewUrl}`);
          }
        } catch (mailErr) {
          console.error("[SMTP ERROR] Mail delivery dispatch failed in invitation:", mailErr.message);
        }
      }

      await logActivity(req.userId, workspaceId, 'INVITATION_CREATED', { inviteeEmail: email, inviteeRole: roleUpper });
      res.status(201).json({
        ...invitation,
        signupUrl: inviteUrl,
        previewUrl
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getInvitations: async (req, res) => {
    try {
      const workspaceId = req.user.workspaceId || 'w-1';
      const invitations = await dbService.getCollection('invitations', { workspaceId });
      res.json(invitations);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  acceptInvitation: async (req, res) => {
    try {
      const invitationId = req.params.id;
      const { password, name } = req.body;

      if (!password || !name) {
        return res.status(400).json({ error: "Name and password are required to accept invitation." });
      }

      const invitation = await dbService.getItemById('invitations', invitationId);
      if (!invitation || invitation.status !== 'PENDING') {
        return res.status(400).json({ error: "Invitation is invalid or has already been accepted." });
      }

      if (new Date(invitation.expiresAt) < new Date()) {
        await dbService.updateItem('invitations', invitationId, { status: 'EXPIRED' });
        return res.status(400).json({ error: "Invitation has expired." });
      }

      // Enforce name & password complexity matching signupSchema
      const parseResult = signupSchema.safeParse({ name, email: invitation.email, password });
      if (!parseResult.success) {
        const errorMsg = parseResult.error.errors.map(e => e.message).join(' | ');
        return res.status(400).json({ error: errorMsg });
      }

      const users = await dbService.getCollection('users');
      const existingUser = users.find(u => u.email.toLowerCase() === invitation.email.toLowerCase());
      if (existingUser) {
        return res.status(400).json({ error: "A user with this email address already exists." });
      }

      const userId = `u-${Date.now()}`;
      const hashedPassword = bcrypt.hashSync(password, 10);
      const colors = [
        "bg-indigo-600 text-white", "bg-purple-500 text-white",
        "bg-emerald-500 text-white", "bg-sky-500 text-white",
        "bg-amber-500 text-white", "bg-pink-500 text-white", "bg-rose-500 text-white"
      ];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      const user = await dbService.insertItem('users', {
        id: userId,
        name,
        email: invitation.email,
        password: hashedPassword,
        avatarUrl: name.charAt(0).toUpperCase() || 'U',
        color: randomColor,
        timezone: "UTC",
        role: invitation.role,
        workspaceId: invitation.workspaceId,
        activeWorkspaceId: invitation.workspaceId
      });

      // Create WorkspaceMembership mapping
      await dbService.insertItem('workspaceMemberships', {
        id: `wm-${userId}-${invitation.workspaceId}`,
        userId,
        workspaceId: invitation.workspaceId,
        role: invitation.role
      });

      await dbService.updateItem('invitations', invitationId, { status: 'ACCEPTED' });

      // Automatically add user to workspace-wide general channels
      const channels = await dbService.getCollection('channels', { workspaceId: invitation.workspaceId });
      for (const ch of channels) {
        if (!ch.isPrivate && !ch.isDM) {
          const currentMembers = Array.isArray(ch.memberIds) ? ch.memberIds : JSON.parse(ch.memberIds || '[]');
          if (!currentMembers.includes(userId)) {
            currentMembers.push(userId);
            await dbService.updateItem('channels', ch.id, { memberIds: currentMembers });
          }
        }
      }

      await logActivity(userId, invitation.workspaceId, 'INVITATION_ACCEPTED', { email: invitation.email, role: invitation.role });

      await dbService.setActiveUserId(userId);
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, workspaceId: user.workspaceId },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      const { password: _, ...safeUser } = user;

      // Load workspaces details
      const workspacesList = [];
      const w = await dbService.getItemById('workspaces', invitation.workspaceId);
      if (w) {
        workspacesList.push({
          id: w.id,
          name: w.name,
          logoUrl: w.logoUrl,
          role: invitation.role
        });
      }

      res.json({
        success: true,
        user: { ...safeUser, role: invitation.role, workspaceId: invitation.workspaceId, activeWorkspaceId: invitation.workspaceId },
        token,
        workspaces: workspacesList
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getActivityLogs: async (req, res) => {
    try {
      const workspaceId = req.user.workspaceId || 'w-1';
      if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: "Access denied: insufficient privileges to view activity logs." });
      }

      const logs = await dbService.getCollection('activityLogs', { workspaceId });
      const sortedLogs = logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      res.json(sortedLogs);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  updateUserRole: async (req, res) => {
    try {
      const caller = await dbService.getItemById('users', req.userId);
      if (!caller || caller.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: "Super Admin privileges required." });
      }

      const targetId = req.params.id;
      const { role } = req.body;
      if (!role || !['ADMIN', 'EMPLOYEE', 'SUPER_ADMIN'].includes(role)) {
        return res.status(400).json({ error: "Invalid role specified." });
      }

      const targetUser = await dbService.getItemById('users', targetId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found." });
      }

      if (targetUser.role === 'SUPER_ADMIN' && role !== 'SUPER_ADMIN') {
        const users = await dbService.getCollection('users');
        const superAdmins = users.filter(u => u.role === 'SUPER_ADMIN');
        if (superAdmins.length === 1 && superAdmins[0].id === targetId) {
          return res.status(400).json({ error: "Cannot demote the last Super Admin. Promote another user to Super Admin first." });
        }
      }

      const updated = await dbService.updateItem('users', targetId, { role });
      await logActivity(req.userId, caller.workspaceId, 'USER_ROLE_UPDATED', { userId: targetId, newRole: role });
      res.json({ success: true, user: updated });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};
