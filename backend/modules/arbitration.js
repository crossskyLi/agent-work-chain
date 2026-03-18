'use strict';

const { v4: uuidv4 } = require('uuid');

class ArbitrationModule {
    constructor() {
        this.disputes = new Map();
        this.arbitrators = new Set();
    }

    submit({ taskId, reason, initiator }) {
        if (!taskId || !reason) {
            throw new Error('taskId and reason are required');
        }
        const dispute_id = uuidv4();
        const dispute = {
            dispute_id,
            taskId,
            reason,
            initiator,
            status: 'pending',
            createdAt: Date.now(),
        };
        this.disputes.set(dispute_id, dispute);
        return dispute;
    }

    get(dispute_id) {
        return this.disputes.get(dispute_id) || null;
    }

    resolve(dispute_id, resolution, arbitrator) {
        const dispute = this.disputes.get(dispute_id);
        if (!dispute) throw new Error('Dispute not found');
        dispute.status = 'resolved';
        dispute.resolution = resolution;
        dispute.arbitrator = arbitrator;
        dispute.resolvedAt = Date.now();
        return dispute;
    }

    certifyArbitrator(address) {
        this.arbitrators.add(address);
    }

    isArbitrator(address) {
        return this.arbitrators.has(address);
    }

    list() {
        return Array.from(this.disputes.values());
    }
}

module.exports = ArbitrationModule;
