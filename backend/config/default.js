'use strict';

module.exports = {
    port: process.env.PORT || 3000,
    jwtSecret: (() => {
        const secret = process.env.JWT_SECRET;
        if (!secret && process.env.NODE_ENV === 'production') {
            throw new Error('JWT_SECRET environment variable must be set in production');
        }
        if (!secret) {
            console.warn('WARNING: JWT_SECRET is not set. Using insecure default — do not use in production.');
        }
        return secret || 'dev-secret-change-in-production';
    })(),
    blockchain: {
        network: process.env.BLOCKCHAIN_NETWORK || 'localhost',
        rpcUrl: process.env.RPC_URL || 'http://localhost:8545',
    },
    database: {
        url: process.env.DATABASE_URL || 'mongodb://localhost:27017/agent-trustchain',
    },
};
