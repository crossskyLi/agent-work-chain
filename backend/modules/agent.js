'use strict';

const { v4: uuidv4 } = require('uuid');

class AgentModule {
    constructor() {
        this.agents = new Map();
    }

    register({ name, capabilities, description }) {
        if (!name || !capabilities) {
            throw new Error('name and capabilities are required');
        }
        const agent_id = uuidv4();
        const did = `did:agent:${agent_id}`;
        const agent = {
            agent_id,
            did,
            name,
            capabilities,
            description,
            createdAt: Date.now(),
            active: true,
        };
        this.agents.set(agent_id, agent);
        return agent;
    }

    get(agent_id) {
        return this.agents.get(agent_id) || null;
    }

    update(agent_id, updates) {
        const agent = this.agents.get(agent_id);
        if (!agent) throw new Error('Agent not found');
        Object.assign(agent, updates);
        return agent;
    }

    deactivate(agent_id) {
        const agent = this.agents.get(agent_id);
        if (!agent) throw new Error('Agent not found');
        agent.active = false;
        return agent;
    }

    list() {
        return Array.from(this.agents.values());
    }
}

module.exports = AgentModule;
