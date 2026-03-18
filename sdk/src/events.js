'use strict';

class Events {
  constructor({ contract }) {
    this._contract = contract;
    this._listeners = new Map();
  }

  on(eventName, callback) {
    this._contract.on(eventName, (...args) => {
      const event = args[args.length - 1];
      const parsed = {
        eventName,
        args: args.slice(0, -1),
        blockNumber: event.log?.blockNumber,
        transactionHash: event.log?.transactionHash,
      };
      callback(parsed);
    });

    if (!this._listeners.has(eventName)) {
      this._listeners.set(eventName, []);
    }
    this._listeners.get(eventName).push(callback);
  }

  off(eventName, callback) {
    this._contract.off(eventName, callback);
    const listeners = this._listeners.get(eventName);
    if (listeners) {
      const idx = listeners.indexOf(callback);
      if (idx >= 0) listeners.splice(idx, 1);
    }
  }

  async queryPast(eventName, fromBlock = 0) {
    const filter = this._contract.filters[eventName]();
    const events = await this._contract.queryFilter(filter, fromBlock);
    return events.map((e) => ({
      eventName,
      args: e.args,
      blockNumber: e.blockNumber,
      transactionHash: e.transactionHash,
    }));
  }

  removeAll() {
    this._contract.removeAllListeners();
    this._listeners.clear();
  }
}

module.exports = { Events };
