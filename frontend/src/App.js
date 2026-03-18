import React, { useState } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';
const API_KEY = process.env.REACT_APP_API_KEY || 'demo-key';

const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
};

function Section({ title, children }) {
    return (
        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <h2>{title}</h2>
            {children}
        </div>
    );
}

function RegisterAgent() {
    const [name, setName] = useState('');
    const [capabilities, setCapabilities] = useState('');
    const [result, setResult] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_BASE}/v1/agents`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ name, capabilities: capabilities.split(',').map(s => s.trim()) }),
            });
            setResult(await res.json());
        } catch (err) {
            setResult({ error: err.message });
        }
    };

    return (
        <Section title="Register Agent">
            <form onSubmit={handleSubmit}>
                <input
                    placeholder="Agent name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    style={{ marginRight: 8 }}
                />
                <input
                    placeholder="Capabilities (comma-separated)"
                    value={capabilities}
                    onChange={e => setCapabilities(e.target.value)}
                    style={{ marginRight: 8 }}
                />
                <button type="submit">Register</button>
            </form>
            {result && <pre style={{ background: '#f5f5f5', padding: 8, marginTop: 8 }}>{JSON.stringify(result, null, 2)}</pre>}
        </Section>
    );
}

function CreateTask() {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [result, setResult] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_BASE}/v1/tasks`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ title, description }),
            });
            setResult(await res.json());
        } catch (err) {
            setResult({ error: err.message });
        }
    };

    return (
        <Section title="Create Task">
            <form onSubmit={handleSubmit}>
                <input
                    placeholder="Task title"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    style={{ marginRight: 8 }}
                />
                <input
                    placeholder="Description"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    style={{ marginRight: 8 }}
                />
                <button type="submit">Create</button>
            </form>
            {result && <pre style={{ background: '#f5f5f5', padding: 8, marginTop: 8 }}>{JSON.stringify(result, null, 2)}</pre>}
        </Section>
    );
}

function App() {
    return (
        <div style={{ maxWidth: 800, margin: '40px auto', fontFamily: 'sans-serif', padding: '0 16px' }}>
            <h1>🔗 Agent TrustChain Dashboard</h1>
            <p>Decentralized trust infrastructure for AI agents.</p>
            <RegisterAgent />
            <CreateTask />
        </div>
    );
}

export default App;
