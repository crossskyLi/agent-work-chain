'use strict';

const AgentModule = require('../../backend/modules/agent');

describe('AgentModule', () => {
    let agentModule;

    beforeEach(() => {
        agentModule = new AgentModule();
    });

    test('should register a new agent', () => {
        const agent = agentModule.register({
            name: 'Test Agent',
            capabilities: ['text-generation'],
            description: 'A test agent',
        });

        expect(agent).toHaveProperty('agent_id');
        expect(agent).toHaveProperty('did');
        expect(agent.name).toBe('Test Agent');
        expect(agent.capabilities).toEqual(['text-generation']);
        expect(agent.active).toBe(true);
    });

    test('should throw error when name is missing', () => {
        expect(() => agentModule.register({ capabilities: ['text-gen'] })).toThrow('name and capabilities are required');
    });

    test('should get an agent by id', () => {
        const registered = agentModule.register({ name: 'Test', capabilities: ['a'] });
        const found = agentModule.get(registered.agent_id);
        expect(found).toEqual(registered);
    });

    test('should return null for non-existent agent', () => {
        expect(agentModule.get('non-existent')).toBeNull();
    });

    test('should deactivate an agent', () => {
        const agent = agentModule.register({ name: 'Test', capabilities: ['a'] });
        agentModule.deactivate(agent.agent_id);
        expect(agentModule.get(agent.agent_id).active).toBe(false);
    });

    test('should list all agents', () => {
        agentModule.register({ name: 'Agent 1', capabilities: ['a'] });
        agentModule.register({ name: 'Agent 2', capabilities: ['b'] });
        expect(agentModule.list()).toHaveLength(2);
    });
});
