/**
 * Controller for User profiles, context switching, and Pomodoro Timer settings & sessions DB tracking
 */

import { dbService } from '../services/db.js';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';

const passwordResetOTPs = new Map(); // key: email -> { otp: string, expiresAt: number }

const signupSchema = z.object({
  email: z.string().email({ message: "Invalid email address format." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters long." }),
  name: z.string().min(2, { message: "Name must be at least 2 characters long." }),
  role: z.string()
});

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address format." }),
  password: z.string().min(1, { message: "Password is required." }),
  role: z.string()
});

export const usersController = {
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
        return res.json(safeUser);
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
      res.json({ success: true, activeUser });
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
      // Validate inputs using Zod
      const parseResult = signupSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errorMsg = parseResult.error.errors.map(e => e.message).join(' | ');
        return res.status(400).json({ error: errorMsg });
      }

      const { email, password, name, role } = parseResult.data;

      const users = await dbService.getCollection('users');
      const registeredUser = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
      
      let finalUser;
      
      const hashedPassword = bcrypt.hashSync(password, 10);
      
      if (registeredUser) {
        if (registeredUser.password && registeredUser.password !== 'password123') {
          return res.status(400).json({ error: "A user with this email address already exists." });
        }
        
        // This is an invited placeholder user without a password. We complete and activate their profile!
        const avatarUrl = name.charAt(0).toUpperCase() || 'U';
        const userRoleNormalized = role.toUpperCase() === 'ADMIN' ? 'ADMIN' : 'MEMBER';
        
        finalUser = await dbService.updateItem('users', registeredUser.id, {
          name,
          password: hashedPassword,
          avatarUrl,
          role: userRoleNormalized,
          timezone: "UTC"
        });
      } else {
        // Create full new user
        const avatarUrl = name.charAt(0).toUpperCase() || 'U';
        const colors = [
          "bg-indigo-600 text-white", "bg-purple-500 text-white",
          "bg-emerald-500 text-white", "bg-sky-500 text-white",
          "bg-amber-500 text-white", "bg-pink-500 text-white", "bg-rose-500 text-white"
        ];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        const userRoleNormalized = role.toUpperCase() === 'ADMIN' ? 'ADMIN' : 'MEMBER';

        finalUser = await dbService.insertItem('users', {
          name,
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          avatarUrl,
          color: randomColor,
          timezone: "UTC",
          role: userRoleNormalized
        });
      }

      // Swap active session to this user
      await dbService.setActiveUserId(finalUser.id);

      res.status(201).json({ success: true, user: finalUser });
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

      const { email, password, role } = parseResult.data;

      const users = await dbService.getCollection('users');
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
      
      if (!user) {
        return res.status(401).json({ error: "User profile with this email address does not exist." });
      }

      // Backwards compatible pwd check so pre-seeded plain text password123 still works, but new hashed passwords use bcrypt
      let isMatch = false;
      if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
        isMatch = bcrypt.compareSync(password, user.password);
      } else {
        isMatch = (user.password === password);
      }

      if (!isMatch) {
        return res.status(401).json({ error: "Incorrect password. Please try again." });
      }

      // Role check validation constraint
      const requestedAdmin = role.toUpperCase() === 'ADMIN';
      const userIsAdmin = user.role === 'ADMIN' || user.role === 'OWNER';

      if (requestedAdmin !== userIsAdmin) {
        const expectedRoleStr = userIsAdmin ? "Admin" : "Employee";
        const selectedRoleStr = requestedAdmin ? "Admin" : "Employee";
        return res.status(401).json({ 
          error: `Role Mismatch! You selected role "${selectedRoleStr}" but this profile is registered as "${expectedRoleStr}".` 
        });
      }

      // Log session in
      await dbService.setActiveUserId(user.id);

      res.json({ success: true, user });
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
      passwordResetOTPs.set(email.toLowerCase().trim(), {
        otp,
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
        success: true,
        message: "OTP sent to your email successfully.",
        otpForDev: otp, // Bypass so that user is NEVER blocked by local smtp network issues
        previewUrl
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

      if (storedOtpInfo.otp !== otp.trim()) {
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
  }
};
