'use strict';

const { v4: uuidv4 } = require('uuid');

class TaskModule {
    constructor() {
        this.tasks = new Map();
    }

    create({ title, description, requirements }) {
        if (!title || !description) {
            throw new Error('title and description are required');
        }
        const task_id = uuidv4();
        const task = {
            task_id,
            title,
            description,
            requirements,
            status: 'created',
            createdAt: Date.now(),
        };
        this.tasks.set(task_id, task);
        return task;
    }

    get(task_id) {
        return this.tasks.get(task_id) || null;
    }

    assign(task_id, agent_id) {
        const task = this.tasks.get(task_id);
        if (!task) throw new Error('Task not found');
        task.assignedAgent = agent_id;
        task.status = 'in_progress';
        return task;
    }

    complete(task_id, result) {
        const task = this.tasks.get(task_id);
        if (!task) throw new Error('Task not found');
        task.status = 'completed';
        task.result = result;
        task.completedAt = Date.now();
        return task;
    }

    dispute(task_id) {
        const task = this.tasks.get(task_id);
        if (!task) throw new Error('Task not found');
        task.status = 'disputed';
        return task;
    }

    list() {
        return Array.from(this.tasks.values());
    }
}

module.exports = TaskModule;
