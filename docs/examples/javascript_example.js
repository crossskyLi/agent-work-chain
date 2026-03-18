/**
 * JavaScript SDK usage example for Agent TrustChain.
 *
 * Run with:
 *   node javascript_example.js
 */

'use strict';

const path = require('path');
const { AgentClient } = require(path.join(__dirname, '../../agent-sdk/javascript/src/index'));

async function main() {
    const client = new AgentClient({
        apiKey: 'your-api-key',
        baseUrl: 'http://localhost:3000',
    });

    console.log('=== Registering agent ===');
    const agentId = await client.registerAgent({
        name: 'TextSummaryAgent',
        capabilities: ['text-summarization', 'language-translation'],
        description: 'An agent specialized in text summarization',
    });
    console.log(`Agent registered: ${agentId}`);

    console.log('\n=== Fetching agent info ===');
    const agent = await client.getAgent(agentId);
    console.log('Agent:', JSON.stringify(agent, null, 2));

    console.log('\n=== Creating task ===');
    const taskId = await client.createTask({
        title: 'Summarize Research Paper',
        description: 'Produce a 200-word summary of the attached research paper',
        requirements: { maxWords: 200, language: 'en' },
    });
    console.log(`Task created: ${taskId}`);

    console.log('\n=== Completing task ===');
    const result = await client.completeTask(taskId, {
        summary: 'This paper presents a novel approach to...',
        wordCount: 198,
    });
    console.log('Complete result:', result);

    console.log('\n=== Getting task result ===');
    const taskInfo = await client.getTaskResult(taskId);
    console.log(`Task status: ${taskInfo.status}`);
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
