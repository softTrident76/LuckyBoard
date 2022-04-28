/**
 * Log Module
 *
 * @author xyz
 *
 */

const util = require('./util');
const fs = require('fs');
const path = require('path');

/** Log level constant - `INFO` */      exports.INFO    = 3;
/** Log level constant - `DEBUG` */     exports.DEBUG   = 2;
/** Log level constant - `WARNING` */   exports.WARNING = 1;
/** Log level constant - `ERROR` */     exports.ERROR   = 0;
const LEVEL_MIN = exports.ERROR;
const LEVEL_MAX = exports.INFO;
exports.DEFAULT = LEVEL_MAX;

let _ = {
    LogDir: './logs',
    path: null,
    fd: null,
    time: null,
    level: exports.DEFAULT,
    verbose: true,
    LineBreak: '\r\n',
    LineIndent: '\t',
};

const _parseLevel = (level) => {
    if (!!level && typeof level === 'string') {
        level = level.trim().toLowerCase();
        if      (level === 'info'   ) { return exports.INFO;     }
        else if (level === 'debug'  ) { return exports.DEBUG;    }
        else if (level === 'warning') { return exports.WARNING;  }
        else if (level === 'error'  ) { return exports.ERROR;    }
    }
    else {
        level = util.parseInt(level, exports.DEFAULT);
        if (level >= LEVEL_MIN && level <= LEVEL_MAX) {
            return level;
        }
    }
    return exports.DEFAULT;
};

/**
 * Get tag string for given level
 *
 * @param {*} level `options.level` is used if NOT given
 */
exports.getLevelTag = (level) => {
    level = (level == undefined) ? _.level : _parseLevel(level);
    switch (level) {
        case exports.INFO:      return 'INFO';
        case exports.DEBUG:     return 'DEBUG';
        case exports.WARNING:   return 'WARNING';
        case exports.ERROR:     return 'ERROR';
    }
};

/**
 * Set options
 *  - `level`: log level
 *  - `verbose`: `true` or `false`
 *
 * @param {Object} options options to set
 */
exports.setOptions = (options) => {
    if (options) {
        if ('level' in options) _.level = _parseLevel(options.level);
        if ('verbose' in options) _.verbose = !!options.verbose;
    }
};

/**
 * Check if given level is ON
 */
exports.isLevelOn = (level) => {
    return _parseLevel(level) <= _.level;
};

/**
 * Get verbose mode enabled or disabled
 */
exports.isVerboseOn = (on) => {
    return _.verbose;
};

/**
 * Log Implementation
 *
 * @param {Number}  level   log level
 * @param {Boolean} verbose verbose flag
 * @param {String}  tag     tag
 * @param {String}  msg     message
 * @param {*}       args    optional arguments
 */
const _log = (level, verbose, tag, msg, ...args) => {
    if (!exports.isLevelOn(level)) {
        return;
    }

    const header = util.formatDate('[Y-M-D H:I:S.N]') + '  ' + exports.getLevelTag(level) + `     ${_.LineIndent}`;

    // Log into console
    if (!verbose || _.verbose) {
        console.log(header, msg, ...args);
    }

    // Log into files
    try {
        // Get log file ready before write logs into file
        _getLogFileReady();

        // Data to write
        let data = header + ' ' + _formatArg(msg, 1);
        for (let i = 0; i < args.length; ++i) {
            data += ' '; // delimiter
            data += _formatArg(args[i], 1);
        }
        data += _.LineBreak;

        // Write log into file
        fs.writeFile(_.fd, data, 'utf8', (err) => {});
    }
    catch (err) {
        console.log(`${_.LineBreak}WARNING: cannot write log into ${_.path}${_.LineBreak}`, err);
    }
};

const _getLogFileReady = () => {
    if (_.fd && _.time) {
        // try to create new file every a hour
        if (new Date().getTime() - _.time > 3600 * 1000) {
            fs.closeSync(_.fd);
            _.fd = null;
        }
    }

    if (!_.fd) {
        if (!fs.existsSync(_.LogDir)) {
            fs.mkdirSync(_.LogDir);
        }
        const now = new Date();
        _.time = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0).getTime();
        _.path = path.resolve(_.LogDir + '/poker3-' + util.formatDate('YMD-H') + '.log');
        _.fd = fs.openSync(_.path, 'a');
    }
};

const _formatArg = (arg, indent, newline) => {
    indent = indent || 0;
    newline = !!newline;

    let indentStr = '';
    if (newline) {
        for (let i = 0; i < indent; ++i) {
            indentStr += _.LineIndent;
        }
    }

    if (!!arg) {
        if (Array.isArray(arg)) {
            return indentStr + '[' + arg.map(e => _formatArg(e)).join(', ') + ']';
        }
        if (typeof arg === 'object') {
            return indentStr + '{' + _.LineBreak +
                Object.keys(arg).map(k => _formatArg(k, indent+1, true) + ': ' + _formatArg(arg[k], indent+1)).join(`, ${_.LineBreak}`) +
                _.LineBreak + _formatArg('}', indent, true);
        }
        if (typeof arg === 'function') {
            return indentStr + '[Function]';
        }
        if (arg.toString) {
            return indentStr + arg.toString();
        }
    }

    return indentStr + arg;
};

/**
 * Log message
 *
 * @param {Number} level log level
 * @param {String} tag  tag
 * @param {String} msg  message
 * @param {*}      args optional arguments
 */
exports.log = (level, tag, msg, ...args) => {
    _log(level, false, tag, msg, ...args);
};

/**
 * Log message as verbose mode
 *
 * @param {Number} level log level
 * @param {String} tag  tag
 * @param {String} msg  message
 * @param {*}      args optional arguments
 */
exports.logVerbose = (level, tag, msg, ...args) => {
    _log(level, true, tag, msg, ...args);
};

/**
 * Log `INFO` message
 *
 * @param {String} tag  tag
 * @param {String} msg  message
 * @param {*}      args optional arguments
 */
exports.info = (tag, msg, ...args) => {
    exports.log(exports.INFO, tag, msg, ...args);
};

/**
 * Log `INFO` message as verbose mode
 *
 * @param {String} tag  tag
 * @param {String} msg  message
 * @param {*}      args optional arguments
 */
exports.infoVerbose = (tag, msg, ...args) => {
    exports.logVerbose(exports.INFO, tag, msg, ...args);
};

/**
 * Log `DEBUG` message
 *
 * @param {String} tag  tag
 * @param {String} msg  message
 * @param {*}      args optional arguments
 */
exports.debug = (tag, msg, ...args) => {
    exports.log(exports.DEBUG, tag, msg, ...args);
};

/**
 * Log `DEBUG` message as verbose mode
 *
 * @param {String} tag  tag
 * @param {String} msg  message
 * @param {*}      args optional arguments
 */
exports.debugVerbose = (tag, msg, ...args) => {
    exports.logVerbose(exports.DEBUG, tag, msg, ...args);
};

/**
 * Log `WARNING` message
 *
 * @param {String} tag  tag
 * @param {String} msg  message
 * @param {*}      args optional arguments
 */
exports.warning = (tag, msg, ...args) => {
    exports.log(exports.WARNING, tag, msg, ...args);
};

/**
 * Log `WARNING` message as verbose mode
 *
 * @param {String} tag  tag
 * @param {String} msg  message
 * @param {*}      args optional arguments
 */
exports.warningVerbose = (tag, msg, ...args) => {
    exports.logVerbose(exports.WARNING, tag, msg, ...args);
};

/**
 * Log `ERROR` message
 *
 * @param {String} tag  tag
 * @param {String} msg  message
 * @param {*}      args optional arguments
 */
exports.error = (tag, msg, ...args) => {
    exports.log(exports.ERROR, tag, msg, ...args);
};

/**
 * Log `ERROR` message as verbose mode
 *
 * @param {String} tag  tag
 * @param {String} msg  message
 * @param {*}      args optional arguments
 */
exports.errorVerbose = (tag, msg, ...args) => {
    exports.logVerbose(exports.ERROR, tag, msg, ...args);
};
