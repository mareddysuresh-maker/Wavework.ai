/**
 * Controller for public forms builder hub and customer requests entries
 */

import { dbService } from '../services/db.js';

export const formsController = {
  getForms: async (req, res) => {
    try {
      const forms = await dbService.getCollection('forms');
      res.json(forms);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createForm: async (req, res) => {
    try {
      const { listId, name, description, fields } = req.body;
      if (!listId || !name) {
        return res.status(400).json({ error: "listId and template name are required." });
      }

      const cleanSlug = `form-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString().slice(-4)}`;
      const newForm = {
        listId,
        name,
        description: description || "",
        slug: cleanSlug,
        fields: fields || [],
        isPublic: true,
        createdAt: new Date().toISOString()
      };

      const result = await dbService.insertItem('forms', newForm);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getPublicForm: async (req, res) => {
    try {
      const { slug } = req.params;
      const forms = await dbService.getCollection('forms');
      const form = forms.find(f => f.slug === slug);
      if (!form) return res.status(404).json({ error: "Portal registration form not found." });
      res.json(form);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  submitPublicForm: async (req, res) => {
    try {
      const { slug } = req.params;
      const forms = await dbService.getCollection('forms');
      const form = forms.find(f => f.slug === slug);
      if (!form) return res.status(404).json({ error: "Registration portal not found." });

      const answers = req.body;
      let taskName = "Form Submission Inquiry";
      let dBody = ["**Submission Details:**"];
      let priority = "NONE";

      form.fields.forEach((field) => {
        const value = answers[field.id];
        if (value !== undefined && value !== "") {
          dBody.push(`- **${field.label}**: ${value}`);
          
          if (field.label.toLowerCase().includes("title") || field.label.toLowerCase().includes("name") || field.label.toLowerCase().includes("concern")) {
            taskName = String(value);
          }
          if (field.label.toLowerCase().includes("priority") && ["URGENT", "HIGH", "NORMAL", "LOW"].includes(String(value).toUpperCase())) {
            priority = String(value).toUpperCase();
          }
        }
      });

      const tasks = await dbService.getCollection('tasks');
      const maxOrder = tasks.filter(t => t.listId === form.listId).reduce((max, t) => t.order > max ? t.order : max, 0);

      const newTask = {
        listId: form.listId,
        name: taskName,
        description: dBody.join('\n\n'),
        status: "TODO",
        priority,
        order: maxOrder + 100,
        tags: ["External-Submission"],
        customFields: {},
        checklist: [],
        createdById: "u-3", // default system creator PM
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const finalTask = await dbService.insertItem('tasks', newTask);

      // Alert owner / admin
      await dbService.insertItem('notifications', {
        userId: "u-1", // owner Karthik
        type: "ASSIGNMENT",
        title: `Inbound Submission: ${taskName}`,
        body: `A new client file arrived securely in List: ${form.name}`,
        entityId: finalTask.id,
        entityType: "TASK",
        isRead: false,
        isSaved: false,
        createdAt: new Date().toISOString()
      });

      res.status(201).json({ success: true, task: finalTask });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};
