/**
 * Global (Server-Wide) Context
 *
 */

const Config = require('../../config');
const util = require('../common/util');
const http = require('http');

// Log
const log = require('../common/log');
const TAG = 'common.mms';

/**
 * MMS Global Contexts
 */
let mms = {
    // server contexts
    statenetAvailable: true,

    // player contexts
    socketIds: {},
    disconnectTimers: {}
};

exports.reset = (userId) => {
    if (mms.socketIds[userId]) {
        delete mms.socketIds[userId];
    }
    exports.clearDisconnectTimer(userId);
};

/**
 * Freshen user socket
 */
exports.freshenSocket = (userId, socket) => {
    mms.socketIds[userId] = socket.id;
};

/**
 * Get socket id by userId
 */
exports.socketIdOfUser = (userId) => {
    return mms.socketIds[userId];
}

/**
 * Check if user socket got stale
 */
exports.socketGotStale = (userId, socket) => {
    return mms.socketIds[userId] !== socket.id;
};

/**
 * Set disconnect timer for the given user
 */
exports.setDisconnectTimer = (userId, handler, timeout) => {
    exports.clearDisconnectTimer(userId);
    mms.disconnectTimers[userId] = setTimeout(handler, timeout || Config.ConnectTimeout);
};

/**
 * Clear disconnect timer for the given user
 */
exports.clearDisconnectTimer = (userId) => {
    if (mms.disconnectTimers[userId]) {
        clearTimeout(mms.disconnectTimers[userId]);
        delete mms.disconnectTimers[userId];
    }
};

/**
 * Check if Statenet (State Network) is available
 */
exports.isStatenetAvailable = () => {
    return mms.statenetAvailable;
};

/**
 * Start Statenet monitor
 */
exports.startStatenetMonitor = () => {
    const TestUrl = util.fulfilUrl(Config.StatenetTestUrl);
    const TestInterval = Config.StatenetTestInterval;
    const TestTimeout = Config.ConnectTimeout;

    const _testStatenet = (testUrl) => {
        return new Promise((resolve, reject) => {
            const request = http.get(testUrl, (res) => {
                const {statusCode} = res;
                !mms.statenetAvailable && log.info(TAG, `statenet> testing ${testUrl} ... response status: ${statusCode} -> availability: false -> true`);
                mms.statenetAvailable = true;
                res.resume();
                resolve();
            }).on('error', (err) => {
                mms.statenetAvailable && log.info(TAG, `statenet> testing ${testUrl} ... got ERROR: ${err.message} -> availability: true -> false`);
                mms.statenetAvailable = false;
                resolve();
            }).setTimeout(TestTimeout, () => {
                // No need to handle `resolve()`
                // since `error` event is fired by aborting request
                // log.warning(TAG, `statenet> testing request aborted due to timeout`);
                request.abort();
            });
        });
    };

    const _runMonitor = () => {
        setTimeout(() => {
            _testStatenet(TestUrl)
                .then(_runMonitor)
                .catch(err => {});
        }, TestInterval);
    };

    _runMonitor();
};
