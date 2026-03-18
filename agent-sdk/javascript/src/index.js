'use strict';

const https = require('https');
const http = require('http');
const { URL } = require('url');

class AgentClient {
    constructor({ apiKey, baseUrl = 'https://api.agent-trustchain.com' }) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
    }

    async _request(method, path, body = null) {
        const url = new URL(path, this.baseUrl);
        const options = {
            method,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
        };

        return new Promise((resolve, reject) => {
            const protocol = url.protocol === 'https:' ? https : http;
            const req = protocol.request(url, options, (res) => {
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(parsed);
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
                        }
                    } catch (e) {
                        reject(new Error(`Failed to parse response: ${data}`));
                    }
                });
            });
            req.on('error', reject);
            if (body) req.write(JSON.stringify(body));
            req.end();
        });
    }

    async registerAgent({ name, capabilities, description }) {
        const result = await this._request('POST', '/v1/agents', { name, capabilities, description });
        return result.agent_id;
    }

    async getAgent(agentId) {
        return this._request('GET', `/v1/agents/${agentId}`);
    }

    async createTask({ title, description, requirements }) {
        const result = await this._request('POST', '/v1/tasks', { title, description, requirements });
        return result.task_id;
    }

    async getTaskResult(taskId) {
        return this._request('GET', `/v1/tasks/${taskId}`);
    }

    async completeTask(taskId, result) {
        return this._request('PUT', `/v1/tasks/${taskId}/complete`, result);
    }

    async submitArbitration({ taskId, reason }) {
        const result = await this._request('POST', '/v1/arbitration', { taskId, reason });
        return result.dispute_id;
    }
}

module.exports = { AgentClient };
