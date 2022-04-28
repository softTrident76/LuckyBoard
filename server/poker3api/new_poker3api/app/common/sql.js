const util = require('./util');
const mysql = require('mysql');

/**
 * Escape query values
 */
exports.escape = (val) => {
    return mysql.escape(val);
};

/**
 * Escape SQL identifiers (database / table / column name)
 */
exports.escapeId = (val) => {
    return mysql.escapeId(val);
};

/**
 * Parse the given query with given parameters
 *
 * For example,
 *
 *      query: `SELECT * FROM :table WHERE :id = ?`
 *      params: `{ table: 'users', id: 'uid' }`
 *      => parsed query: `SELECT * FROM users WHERE uid = ?`
 *
 *
 * @param {String} query SQL statement or partial
 * @param {Object} params an object mapping keys to their own values
 */
exports.parse = (query, params) => {
    if (!query) {
        return '';
    }
    if (!params || typeof params !== 'object') {
        return query;
    }
    return query.replace(/\:(\w+)/g, (txt, key) => {
        if (key in params) {
            return mysql.escape(params[key]);
        }
        return txt;
    });
};

/**
 * Generate an INSERT statement with given table and field-values in the given record
 */
exports.insert = (table, record) => {
    const keys = Object.keys(record);
    const vals = util.listValues(record, keys).map(v => mysql.escape(v));
    return `INSERT INTO ${mysql.escapeId(table)}(${keys.map(k => mysql.escapeId(k)).join(',')}) VALUES (${vals.join(',')}) `;
};

/**
 * Generate a batch INSERT statement with given table and field-values in the given array of records
 */
exports.insertBatch = (table, records) => {
    if (!Array.isArray(records) || records.length === 0) {
        return '';
    }
    const keys = Object.keys(records[0]);
    const vals = records.map(record => '(' + util.listValues(record, keys).map(v => mysql.escape(v)).join(',') + ')');
    return `INSERT INTO ${mysql.escapeId(table)}(${keys.map(k => mysql.escapeId(k)).join(',')}) VALUES ${vals.join(',')}`;
};

/**
 * Generate an UPDATE statement with given table, field-values in the given record and optional where conditions
 */
exports.update = (table, record, conds) => {
    const setters = Object.keys(record).map(key => `${mysql.escapeId(key)} = ${mysql.escape(record[key])}`);
    return `UPDATE ${mysql.escapeId(table)} SET ${setters.join(',')} ${exports.where(conds)}`;
};

/**
 * Generate a DELETE statement with given table and where conditions
 */
exports.delete = (table, conds) => {
    return `DELETE FROM ${mysql.escapeId(table)} ${exports.where(conds)}`;
};

/**
 * Generate a full WHERE clause with given conditions
 */
exports.where = (conds) => {
    if (!conds) {
        return '';
    }
    if (typeof conds === 'object') {
        return ' WHERE ' + Object.keys(conds)
            .map(wkey => `${mysql.escapeId(wkey)} = ${mysql.escape(conds[wkey])}`)
            .join(' AND ');
    }
    const clause = '' + (conds || '');
    return (clause.search(/where/i) === -1) ? ' WHERE ' + conds : conds;
};
