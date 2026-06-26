import { dbService } from '../services/db.js';

export async function logActivity(actorId, workspaceId, eventType, metadata = {}) {
  try {
    const id = `act-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const log = await dbService.insertItem('activityLogs', {
      id,
      actorId,
      workspaceId: workspaceId || 'w-1',
      eventType,
      metadata,
      createdAt: new Date()
    });
    return log;
  } catch (error) {
    console.error('[ACTIVITY LOGGER] Failed to log activity:', error);
  }
}
