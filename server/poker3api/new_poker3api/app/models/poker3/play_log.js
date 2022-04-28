const db = require('../../common/db');
const sql = require('../../common/sql');

// Log
const log = require('../../common/log');
const TAG = 'model.play_log';

/**
 * Insert Round History Record
 */
exports.create_round_history = async (roundInfo) => {
    const query = sql.insert('poker3_round_history', {history: roundInfo});
    let result = await db.exec(query);
    return result.insertId;
}

/**
 * Insert Player's Play Log
 */
exports.create_player_play_log = async (logData) => {
    const query = sql.insert('poker3_play_log', logData);
    let result = await db.exec(query);
    return result.insertId;
};

/**
 * Retrieve round history record
 */
exports.get_round_history = async (historyId) => {
    const query = "SELECT * FROM poker3_round_history WHERE id = ?";
    const result = await db.exec(query, [historyId]);
    return result.shift();
};

exports.is_valid_vote = async (historyId, userId) => {
    const query = "SELECT * FROM poker3_illegal_play_log WHERE history_id = ? and user_id = ?";
    const result = await db.exec(query, [historyId, userId]);
    return result.length >= 1 ? true : false;
};

exports.add_cnt_vote = async (historyId, userId) => {
    var query = "UPDATE poker3_round_history SET illegalVote = illegalVote + 1 WHERE id = ?";
    const result = await db.exec(query, [historyId]);
    query = "INSERT INTO poker3_illegal_play_log (history_id, user_id) VALUES (?, ?)";
    await db.exec(query, [historyId, userId]);
};

exports.add_cnt_devote = async (historyId, userId) => {
    var query = "UPDATE poker3_round_history SET illegalNegativeVote=illegalNegativeVote+1 WHERE id = ?";
    const result = await db.exec(query, [historyId]);
    query = "INSERT INTO poker3_illegal_play_log (history_id, user_id) VALUES (?, ?)";
    await db.exec(query, [historyId, userId]);
};