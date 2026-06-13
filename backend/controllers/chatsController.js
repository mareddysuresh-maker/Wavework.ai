/**
 * Controller for Interactive Instant Messaging system
 * Fulfills: 1-on-1 invitations via mail (accept/decline), group chat creation, changing group logo,
 * administrator assignments, and document file attachments.
 */

import { dbService } from '../services/db.js';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { uploadAttachment } from '../services/minioService.js';
import { redisService } from '../services/redisService.js';
import { getSocketIO } from '../services/socketService.js';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

async function sendEmailInvitation(senderName, receiverEmail, receiverName, signupUrl) {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || 'no-reply@flowup.io';

  console.log(`[SMTP] Attempting to send invitation email to ${receiverName} (${receiverEmail}) from ${senderName}...`);

  let transporter;
  let finalFrom = from;

  if (host && user && pass) {
    try {
      transporter = nodemailer.createTransport({
        host,
        port: parseInt(port),
        secure: parseInt(port) === 465,
        auth: {
          user,
          pass
        }
      });
    } catch (err) {
      console.error("[SMTP ERROR] Transport build failed with custom credentials:", err.message);
    }
  }

  if (!transporter) {
    console.log(`[SMTP] No active custom SMTP credentials configured. Reaching out to Nodemailer Ethereal SMTP test service...`);
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
    } catch (etherealError) {
      console.warn("[SMTP FALLBACK ERROR] Ethereal service unreachable. Reverting to fully local simulation logs:", etherealError.message);
      console.log(`
      ----------------------------------------------------------------------
      To: ${receiverName} <${receiverEmail}>
      Subject: 1-on-1 Chat Invitation from ${senderName} on FlowUp
      Body:
        Hello ${receiverName},
        
        ${senderName} has invited you to connect on FlowUp!
        
        Below is your instant login and workspace simulation link:
        ${signupUrl}
        
        We look forward to having you!
      ----------------------------------------------------------------------
      `);
      return { success: false, reason: "SMTP offline fallback executed" };
    }
  }

  try {
    const mailOptions = {
      from: finalFrom,
      to: receiverEmail,
      subject: `1-on-1 Chat Invitation from ${senderName} on FlowUp`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #4f46e5; margin-top: 0;">Invitation to Connect on FlowUp</h2>
          <p style="font-size: 15px; color: #1e293b;">Hello <strong>${receiverName}</strong>,</p>
          <p style="font-size: 15px; color: #334155;"><strong>${senderName}</strong> has invited you to connect and chat on FlowUp!</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${signupUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              Accept and Chat
            </a>
          </div>
          <p style="color: #64748b; font-size: 13px;">If the button above does not work, copy and paste this URL into your browser:</p>
          <p style="word-break: break-all; color: #4f46e5; font-size: 13px; font-family: monospace; background-color: #f8fafc; padding: 10px; border-radius: 6px;">${signupUrl}</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
          <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-bottom: 0;">Sent securely via ClickUp FlowUp Workspace Messenger</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[SMTP SUCCESS] Mail delivered successfully to ${receiverEmail}: ${info.messageId}`);
    
    // Obtain test ethereal message URL if possible
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[SMTP PREVIEW] View dispatched test email online at: ${previewUrl}`);
      return { success: true, messageId: info.messageId, previewUrl };
    }
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[SMTP ERROR] Failed to send email via transport:", error);
    return { success: false, error: error.message };
  }
}

export const chatsController = {
  // Get channels/DMs active for the logged-in user
  getChannels: async (req, res) => {
    try {
      const channels = await dbService.getCollection('channels');
      const userId = req.userId;
      const SEEDED_USER_IDS = ["u-1", "u-2", "u-3", "u-4"];
      const isSeededUser = SEEDED_USER_IDS.includes(userId);

      // Filter channels:
      // - Seeded users see public channels + channels they belong to
      // - New users only see channels where they are a member (excluding old mock channels unless explicitly added)
      const visibleChannels = channels.filter(ch => {
        if (isSeededUser) {
          if (!ch.isPrivate && !ch.isDM) return true;
          return Array.isArray(ch.memberIds) && ch.memberIds.includes(userId);
        } else {
          return Array.isArray(ch.memberIds) && ch.memberIds.includes(userId);
        }
      });

      res.json(visibleChannels);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Create channel or DM
  createChannel: async (req, res) => {
    try {
      const { name, description, isPrivate, isDM, isGroup, memberIds, logoUrl } = req.body;
      if (!name && !isDM) return res.status(400).json({ error: "Channel or group name is required." });

      const users = await dbService.getCollection('users');
      let resolvedMembers = memberIds || [req.userId];
      
      // If creating a public group or general channel, default to all users if empty
      if (!isPrivate && !isDM && (!memberIds || memberIds.length === 0)) {
        resolvedMembers = users.map(u => u.id);
      }

      // Ensure the creator themselves is in the group members
      if (!resolvedMembers.includes(req.userId)) {
        resolvedMembers.push(req.userId);
      }

      const newChannel = {
        workspaceId: "w-1",
        name: name || `Group-${Date.now()}`,
        description: description || "Interactive team discussion room.",
        isPrivate: !!isPrivate,
        isDM: !!isDM,
        isGroup: !!isGroup,
        memberIds: resolvedMembers,
        logoUrl: logoUrl || "",
        adminIds: [req.userId], // Creator is the initial admin
        createdAt: new Date().toISOString()
      };

      const result = await dbService.insertItem('channels', newChannel);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Update channel settings (changing group logo, making member admin, adding people)
  updateChannelSettings: async (req, res) => {
    try {
      const { channelId } = req.params;
      const { name, description, logoUrl, adminIds, memberIds } = req.body;

      const channel = await dbService.getItemById('channels', channelId);
      if (!channel) return res.status(404).json({ error: "Channel/group not found." });

      // Only administrators can manage group settings
      const userIsAdmin = Array.isArray(channel.adminIds) && channel.adminIds.includes(req.userId);
      if (!userIsAdmin && channel.isGroup) {
        return res.status(403).json({ error: "Only group administrators can modify group details." });
      }

      const updates = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (logoUrl !== undefined) updates.logoUrl = logoUrl;
      if (adminIds !== undefined) updates.adminIds = adminIds;
      if (memberIds !== undefined) {
        updates.memberIds = memberIds;
        // Ensure admin members are also part of channel members
        const currentAdmins = adminIds || channel.adminIds || [];
        currentAdmins.forEach(adminId => {
          if (!updates.memberIds.includes(adminId)) {
            updates.memberIds.push(adminId);
          }
        });
      }

      const result = await dbService.updateItem('channels', channelId, updates);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Fetch messages inside a channel
  getMessagesByChannel: async (req, res) => {
    try {
      const channelId = req.params.channelId;
      // 4. Check Redis cache first
      const cached = await redisService.getCachedMessages(channelId);
      if (cached) {
        return res.json(cached);
      }

      const messages = await dbService.getCollection('messages');
      const filtered = messages.filter(m => m.channelId === channelId);
      
      // Save collection cache
      await redisService.saveMessagesCollectionCache(channelId, filtered);

      res.json(filtered);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Send message
  sendMessage: async (req, res) => {
    try {
      const { content, parentId, taskId, attachments } = req.body;
      const channelId = req.params.channelId;
      if (!content && (!attachments || attachments.length === 0)) {
        return res.status(400).json({ error: "Message content or attachments required." });
      }

      const newMessage = {
        channelId,
        authorId: req.userId,
        content: content || "",
        parentId: parentId || "",
        taskId: taskId || "",
        savedByIds: [],
        reactions: [],
        attachments: attachments || [],
        createdAt: new Date().toISOString()
      };

      const result = await dbService.insertItem('messages', newMessage);

      // Cache the message
      await redisService.cacheMessage(channelId, result);

      // Pub/Sub Broadcast
      const channel = await dbService.getItemById('channels', channelId);
      const isPublished = await redisService.publishMessage(channel, result);

      // Fallback local emit if Redis is unavailable
      if (!isPublished) {
        const io = getSocketIO();
        if (io) {
          const roomName = redisService.resolvePubSubChannel(channel) || `channel:${channelId}`;
          io.to(roomName).emit('message:received', result);
        }
      }

      // Mentions notify flow
      const mentionRegex = /@(\w+)/g;
      let match;
      const users = await dbService.getCollection('users');
      
      while ((match = mentionRegex.exec(content)) !== null) {
        const mentionedPart = match[1].toLowerCase();
        const mentionedUser = users.find(u => u.name.toLowerCase().includes(mentionedPart));
        
        if (mentionedUser && mentionedUser.id !== req.userId) {
          await dbService.insertItem('notifications', {
            userId: mentionedUser.id,
            type: "MENTIONS",
            title: "Chat Mention",
            body: `${req.user?.name || "Someone"} mentioned you in chat: ${content.slice(0, 40)}`,
            entityId: result.id,
            entityType: "MESSAGE",
            isRead: false,
            isSaved: false,
            createdAt: new Date().toISOString()
          });
        }
      }

      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Toggle emoji response
  toggleReactionOnMessage: async (req, res) => {
    try {
      const { emoji } = req.body;
      const { messageId } = req.params;
      if (!emoji) return res.status(400).json({ error: "Emoji is required." });

      const message = await dbService.getItemById('messages', messageId);
      if (!message) return res.status(404).json({ error: "Message not found." });

      const reactions = message.reactions || [];
      const index = reactions.findIndex(r => r.emoji === emoji);
      const currUser = req.userId;

      if (index > -1) {
        const reaction = reactions[index];
        if (reaction.userIds.includes(currUser)) {
          reaction.userIds = reaction.userIds.filter(id => id !== currUser);
          if (reaction.userIds.length === 0) {
            reactions.splice(index, 1);
          }
        } else {
          reaction.userIds.push(currUser);
        }
      } else {
        reactions.push({ emoji, userIds: [currUser] });
      }

      const updated = await dbService.updateItem('messages', messageId, { reactions });

      // Invalidate messages cache
      await redisService.invalidateMessagesCache(message.channelId);

      // Broadcast update
      const channel = await dbService.getItemById('channels', message.channelId);
      const roomName = redisService.resolvePubSubChannel(channel) || `channel:${message.channelId}`;
      const io = getSocketIO();
      if (io) {
        io.to(roomName).emit('message:updated', updated);
      }

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Toggle pinned state
  toggleSaveMessage: async (req, res) => {
    try {
      const { messageId } = req.params;
      const message = await dbService.getItemById('messages', messageId);
      if (!message) return res.status(404).json({ error: "Message not found." });

      const savedByIds = message.savedByIds || [];
      const currUser = req.userId;
      let isSaved = false;

      if (savedByIds.includes(currUser)) {
        const idx = savedByIds.indexOf(currUser);
        savedByIds.splice(idx, 1);
      } else {
        savedByIds.push(currUser);
        isSaved = true;
        
        await dbService.insertItem('notifications', {
          userId: currUser,
          type: "CHAT_SAVE",
          title: "Saved Message",
          body: `"${message.content.slice(0, 30)}..." has been pinned directly to your inbox items list.`,
          entityId: message.id,
          entityType: "MESSAGE",
          isRead: false,
          isSaved: true,
          createdAt: new Date().toISOString()
        });
      }

      const updated = await dbService.updateItem('messages', messageId, { savedByIds });

      // Invalidate messages cache
      await redisService.invalidateMessagesCache(message.channelId);

      // Broadcast update
      const channel = await dbService.getItemById('channels', message.channelId);
      const roomName = redisService.resolvePubSubChannel(channel) || `channel:${message.channelId}`;
      const io = getSocketIO();
      if (io) {
        io.to(roomName).emit('message:updated', updated);
      }

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Fetch sent/received chat invitations
  getChatRequests: async (req, res) => {
    try {
      const requests = await dbService.getCollection('chatRequests');
      const users = await dbService.getCollection('users');
      const currentUser = users.find(u => u.id === req.userId);
      const userEmail = currentUser?.email?.toLowerCase() || '';

      const myRequests = requests.filter(reqst => 
        reqst.senderId === req.userId || 
        reqst.receiverEmail?.toLowerCase() === userEmail
      );

      res.json(myRequests);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Submit new 1-on-1 invitation request via mail
  createChatRequest: async (req, res) => {
    try {
      const { email, name } = req.body;
      if (!email || !name) return res.status(400).json({ error: "Email address and recipient name are required." });

      const users = await dbService.getCollection('users');
      const currentUser = users.find(u => u.id === req.userId);

      if (currentUser?.email?.toLowerCase() === email.toLowerCase()) {
        return res.status(400).json({ error: "You cannot send a chat invitation to your own email address." });
      }

      // See if request matches existing pendiente
      const requests = await dbService.getCollection('chatRequests');
      const alreadyPending = requests.find(r => 
        r.senderId === req.userId && 
        r.receiverEmail.toLowerCase() === email.toLowerCase() &&
        r.status === 'PENDING'
      );
      if (alreadyPending) {
        return res.status(400).json({ error: "You already have an active pending invitation sent to this user." });
      }

      // Register receiver in system if they don't already exist so they can login and accept it
      let targetUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!targetUser) {
        const initials = name.substring(0,1).toUpperCase() || 'U';
        const colors = [
          "bg-indigo-600 text-white", "bg-purple-600 text-white",
          "bg-emerald-600 text-white", "bg-sky-600 text-white",
          "bg-amber-600 text-white", "bg-pink-600 text-white"
        ];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        targetUser = await dbService.insertItem('users', {
          name,
          email,
          avatarUrl: initials,
          color: randomColor,
          timezone: "GMT",
          role: "MEMBER"
        });
      }

      const newRequest = {
        senderId: req.userId,
        receiverEmail: email,
        receiverName: name,
        status: "PENDING",
        createdAt: new Date().toISOString()
      };

      const result = await dbService.insertItem('chatRequests', newRequest);

      // Post notification to receiver
      await dbService.insertItem('notifications', {
        userId: targetUser.id,
        type: "MENTIONS",
        title: "1-on-1 Chat Invitation",
        body: `${currentUser?.name || "A user"} sent you a 1-on-1 direct chat invitation. Visit the Chat tab to accept!`,
        entityId: result.id,
        entityType: "MESSAGE",
        isRead: false,
        isSaved: false,
        createdAt: new Date().toISOString()
      });

      // Construct simulation / signup link and send out email via Nodemailer
      const requestHost = req.headers.origin || process.env.APP_URL || 'http://localhost:3000';
      const signupUrl = `${requestHost}/?inviteEmail=${encodeURIComponent(email)}&inviteName=${encodeURIComponent(name)}`;
      
      // Dispatch email (uses Ethereal fallback dynamically when SMTP is not configured)
      const emailResult = await sendEmailInvitation(currentUser?.name || "Colleague", email, name, signupUrl);
      
      let finalResult = result;
      if (emailResult && emailResult.previewUrl) {
        finalResult = await dbService.updateItem('chatRequests', result.id, { previewUrl: emailResult.previewUrl });
      }

      const io = getSocketIO();
      if (io) {
        io.to(`user:${targetUser.id}`).emit('invite:received', finalResult);
      }

      res.status(201).json({
        success: true,
        message: `Successfully invited ${name} to FlowUp!`,
        invitee: targetUser,
        request: finalResult
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Accept 1-on-1 Chat Request
  acceptChatRequest: async (req, res) => {
    try {
      const { requestId } = req.params;
      const requestItem = await dbService.getItemById('chatRequests', requestId);
      
      if (!requestItem) return res.status(404).json({ error: "Invitation request not found." });
      if (requestItem.status !== 'PENDING') {
        return res.status(400).json({ error: `Invite cannot be accepted. Status is already ${requestItem.status}.` });
      }

      // Verify that active user is indeed the targeted recipient
      const users = await dbService.getCollection('users');
      const senderUser = users.find(u => u.id === requestItem.senderId);
      const activeUser = users.find(u => u.id === req.userId);

      if (requestItem.receiverEmail.toLowerCase() !== activeUser?.email?.toLowerCase()) {
        return res.status(403).json({ error: "Access Denied. This invitation was sent to a different email address." });
      }

      // Update status
      await dbService.updateItem('chatRequests', requestId, { status: 'ACCEPTED' });

      // Create a private, dedicated 1-on-1 DM channel
      const dmName = `DM with ${senderUser?.name || "Colleague"}`;
      const dmChannel = {
        workspaceId: "w-1",
        name: dmName,
        description: `Instant DM between ${senderUser?.name} and ${activeUser?.name}`,
        isPrivate: true,
        isDM: true,
        isGroup: false,
        memberIds: [requestItem.senderId, req.userId],
        logoUrl: "",
        adminIds: [requestItem.senderId, req.userId],
        createdAt: new Date().toISOString()
      };

      const channelObj = await dbService.insertItem('channels', dmChannel);

      // Create a welcome notification for sender
      await dbService.insertItem('notifications', {
        userId: requestItem.senderId,
        type: "MENTIONS",
        title: "Invite Accepted!",
        body: `${activeUser?.name} accepted your 1-on-1 chat invitation request! Start messaging now.`,
        entityId: channelObj.id,
        entityType: "MESSAGE",
        isRead: false,
        isSaved: false,
        createdAt: new Date().toISOString()
      });

      const io = getSocketIO();
      if (io) {
        io.to(`user:${requestItem.senderId}`).emit('invite:accepted', channelObj);
      }

      res.json({ success: true, channel: channelObj });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Decline 1-on-1 Chat Request
  declineChatRequest: async (req, res) => {
    try {
      const { requestId } = req.params;
      const requestItem = await dbService.getItemById('chatRequests', requestId);
      if (!requestItem) return res.status(404).json({ error: "Invitation request not found." });

      const activeUser = await dbService.getItemById('users', req.userId);
      if (requestItem.receiverEmail.toLowerCase() !== activeUser?.email?.toLowerCase()) {
        return res.status(403).json({ error: "Access Denied." });
      }

      const updated = await dbService.updateItem('chatRequests', requestId, { status: 'DECLINED' });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Handle high-speed document / photo asset uploads (MinIO equivalent API)
  handleFileUpload: async (req, res) => {
    try {
      const { fileName, fileType, fileData } = req.body; // Expect JSON-based Base64 post for ultra-smooth container compatibility
      if (!fileName || !fileData) {
        return res.status(400).json({ error: "File name and file content payload are required." });
      }

      // Strip potential mime-header prefix (e.g., data:image/png;base64,)
      const cleanBase64 = fileData.replace(/^data:.*?;base64,/, "");
      const buffer = Buffer.from(cleanBase64, 'base64');

      const result = await uploadAttachment(fileName, buffer, fileType, UPLOADS_DIR);

      res.status(201).json(result);
    } catch (error) {
      console.error("File upload failed:", error);
      res.status(500).json({ error: error.message });
    }
  },

  injectUploadsStatic: (app) => {
    // Custom route to serve local attachments fast without relying on root nginx / server configs
    app.get('/api/uploads/:filename', (req, res) => {
      const filePath = path.join(UPLOADS_DIR, req.params.filename);
      if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
      } else {
        res.status(404).send("File not found");
      }
    });
  }
};
