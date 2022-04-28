const Config = require('../../config');
const mysql = require('mysql');
const sql = require('./sql');

// Log
const log = require('./log');
const TAG = 'common.db';

// Errors
const UnsupportedDbOperationError = new Error('FATAL: Unsupported DB Operation');

/**
 * Connection Pool
 */
const pool = mysql.createPool({
    debug: false,
    host: Config.DbHost,
    user: Config.DbUser,
    password: Config.DbPswd,
    database: Config.DbName,
    connectionLimit: Config.DbConnLimit,
    supportBigNumbers: true,
    multipleStatements: true
});

/**
 * Get a connection to the database
 */
const getConnection = () => {
    return new Promise((resolve, reject) => {
        pool.getConnection((err, conn) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(conn);
            }
        });
    });
}

/**
 * Execute the given SQL statement with full support of prepared statements and return a `result` object.
 *
 * For example:
 *      if `query` is given as `SELECT * FROM user WHERE id = ?`,
 *      then `data` must be give like as `[17]`
 *
 * * `result` will be `[row]` for `SELECT` statements or `[]` if no result
 * * `result.insertId` to get the id of an inserted row
 * * `result.affectedRows` to get the number of affected rows from an `INSERT`, `UPDATE` or `DELETE` statement
 * * `result.changedRows` to get the number of changed rows from an `UPDATE` statement
 *
 * @param {String} query SQL statement
 * @param {Array} data Data to pass to each `?` in the statement
 * @param {Context} context `Optional` context object
 */
exports.exec = async (query, data, context) => {
    const contextGiven = !!context && !!context.conn;
    const conn = contextGiven ? context.conn : await getConnection();
    return new Promise((resolve, reject) => {
        conn.query(query, data || [], (err, result) => {
            if (!contextGiven) {
                conn.release();
            }
            if (err) {
                log.error(TAG, 'ERROR on db.exec():\n  <query>\t', query, '\n  <data>\t', data);
                reject(err);
            }
            else {
                resolve(result);
            }
        });
    });
};

/**
 * As an extention of `exec()` function, execute the given SQL statement by parsing with paremeters
 */
exports.execWithParams = (query, params, data, context) => {
    return exports.exec(sql.parse(query, params), data, context);
};

/**
 * `helper`
 *
 * Check db execution result to see whether database has been updated or NOT
 *
 * @param {} result db execution result
 */
exports.hasUpdated = (result) => {
    return !!result && (!!result.insertId || !!result.affectedRows || !!result.changedRows);
};

/**
 * Begin a transaction and return a context if succeed
 */
exports.beginTransaction = async () => {
    const conn = await getConnection();
    return new Promise((resolve, reject) => {
        conn.beginTransaction((err) => {
            if (err) {
                // conn.release();
                reject(err);
            }
            else {
                resolve({
                    conn
                });
            }
        });
    });
};

/**
 * End/commit the transaction with the given context
 */
exports.endTransaction = (context) => {
    if (!context || !context.conn || !context.conn.commit) {
        return Promise.reject(UnsupportedDbOperationError);
    }
    const conn = context.conn;
    return new Promise((resolve, reject) => {
        conn.commit((err) => {
            if (err) {
                conn.rollback(() => {
                    conn.release();
                    reject(err);
                });
            }
            else {
                conn.release();
                resolve();
            }
        });
    });
};

/**
 * Rollback the transaction with the given context
 */
exports.rollback = (context) => {
    if (!context || !context.conn || !context.conn.rollback) {
        return Promise.reject(UnsupportedDbOperationError);
    }
    const conn = context.conn;
    return new Promise((resolve, reject) => {
        conn.rollback(() => {
            conn.release();
            resolve();
        });
    });
};
