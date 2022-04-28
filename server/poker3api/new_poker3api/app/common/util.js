/**
 * Utilities Module
 *
 */
exports.create_token = (map_id, house_id = 0, room_id = 0) => {
    let token_data = 'JAE';
    token_data = parseInt(map_id) > 0 ? token_data + map_id.length + '' + map_id : token_data;
    token_data = parseInt(house_id) > 0 ? token_data + house_id.length + '' + house_id : token_data
    token_data = parseInt(room_id) > 0 ? token_data + room_id.length + '' + room_id : token_data;
    return token_data;
}

exports.parse_token = (str_token) => {
    let res = {prefix: null, map_id: 0, house_id: 0, room_id : 0};
    let pos = 0;
    if( str_token.substr(0, 3) !== 'JAE' )
        return res;

    res.prefix = 'JAE';
    pos += 3

    // step 1: map_id //
    let len = str_token.substr(pos, 1);
    if( len == '' ) return res;

    pos += 1;
    len = parseInt(len);
    res.map_id = str_token.substr(pos, len);
    pos += len;

    // step 2: house_id //
    len = str_token.substr(pos, 1);
    if( len == '' ) return res;

    pos += 1;
    len = parseInt(len);
    res.house_id = str_token.substr(pos, len);
    pos += len;

    // step 3: room_id //
    len = str_token.substr(pos, 1);
    if( len == '' ) return res;

    pos += 1;
    len = parseInt(len);
    res.room_id = str_token.substr(pos, len);

    return res;
}

exports.encrypt_token = (str_data, str_sessionid) => {
    let token = '';
    for( let idx = 0; idx < str_data.length; idx++ ) {
        let code = parseInt( str_data.charCodeAt(idx) );
        let operator = parseInt( str_sessionid.charCodeAt(idx) );

        // char is 0 - 9 //
        if( code >= 48 && code <= 57 )
            code = String.fromCharCode ( (code - 48 + operator) % 10 + 48 );
        // char is A - Z //
        else if ( code >= 65 && code <= 90 )
            code = String.fromCharCode ( (code - 65 + operator) % 26 + 65 );
        else
            code = '';

        token = token + code ;
    }
    return token;
}

exports.decrypt_token = (str_data, str_sessionid) => {
    let token = '';
    for( let idx = 0; idx < str_data.length; idx++ ) {
        let code = parseInt( str_data.charCodeAt(idx) );
        let operator = parseInt( str_sessionid.charCodeAt(idx) );

        // char is 0 - 9 //
        if( code >= 48 && code <= 57 ) {
            let ch = (code - 48 - operator) % 10;
            ch = ch < 0 ? ch + 10 : ch;
            code = String.fromCharCode ( ch + 48 );
        }
        // char is A - Z //
        else if ( code >= 65 && code <= 90 ) {
            let ch = (code - 65 - operator) % 26;
            ch = ch < 0 ? ch + 26 : ch;
            code = String.fromCharCode(ch + 65);
        }
        else
            code = '';

        token = token + code ;
    }
    return token;
}

/**
 * Return the list of values of the given object in sequence of keys
 */
exports.listValues = (obj, keys) => {
    if (!obj) {
        return [];
    }
    if (!keys || !Array.isArray(keys)) {
        keys = Object.keys(obj);
    }
    let values = [];
    for (let key of keys) {
        values.push(obj[key]);
    }
    return values;
};

/**
 * Format integer with given digit
 */
exports.formatInteger = (value, digit) => {
    let str = '' + (value || 0);
    if (digit) {
        for (let i = str.length; i < digit; ++i) {
            str = '0' + str;
        }
    }
    return str;
};

/**
 * Convert date to string with given format.
 *
 * The possible format is as following:
 *
 *      Y/y     year        yyyy/y
 *      M/m     month       01-12/1-12
 *      D/d     date        01-31/1-31
 *      H/h     hours       00-23/0-23
 *      I/i     minutes     00-59
 *      S/s     seconds     00-59
 *      N/n     milliseconds    000-999
 */
exports.formatDate = (format, date) => {
    if (!format) {
        return '';
    }
    if (!date) {
        date = new Date();
    }
    return format
        .replace(/Y/g, exports.formatInteger(date.getFullYear(), 4))
        .replace(/y/g, '' + date.getFullYear())
        .replace(/M/g, exports.formatInteger(date.getMonth() + 1, 2))
        .replace(/m/g, '' + (date.getMonth() + 1))
        .replace(/D/g, exports.formatInteger(date.getDate(), 2))
        .replace(/d/g, '' + date.getDate())
        .replace(/H/g, exports.formatInteger(date.getHours(), 2))
        .replace(/h/g, '' + date.getHours())
        .replace(/i/gi, exports.formatInteger(date.getMinutes(), 2))
        .replace(/s/gi, exports.formatInteger(date.getSeconds(), 2))
        .replace(/n/gi, exports.formatInteger(date.getMilliseconds(), 3));
};

/**
 * Convert timestamp (in ms) to string with given format.
 *
 * The possible format is as following:
 *
 *      H/h     hours       00-23/0-23
 *      I/i     minutes     00-59
 *      S/s     seconds     00-59
 */
exports.formatTimestamp = (format, timestamp) => {
    const h = parseInt(timestamp / 3600000);
    const m = parseInt(timestamp / 60000) % 60;
    const s = parseInt(timestamp / 1000) % 60;
    return format
        .replace(/H/g, exports.formatInteger(h % 24, 2))
        .replace(/h/g, '' + h % 24)
        .replace(/i/gi, exports.formatInteger(m, 2))
        .replace(/s/gi, exports.formatInteger(s, 2));
};

/**
 * Swap two elements at `indexAt` and `indexTo` in array
 */
exports.swapInArray = (indexAt, indexTo, arr) => {
    if (!arr || !Array.isArray(arr) || indexAt > arr.length || indexTo > arr.length) {
        return;
    }
    const temp = arr[indexTo];
    arr[indexTo] = arr[indexAt];
    arr[indexAt] = temp;
};

/**
 * Get Monday of this week
 */
exports.mondayOfThisWeek = (baseDate) => {
    const date = !!baseDate ? new Date(baseDate) : new Date();
    const afterMonday = (date.getDay() + 6) % 7; // Mon-Sun: 0-6
    date.setDate(date.getDate() - afterMonday);
    return date;
};

/**
 * Get Monday of next week
 */
exports.mondayOfNextWeek = (baseDate) => {
    const date = !!baseDate ? new Date(baseDate) : new Date();
    const beforeNextMonday = (7 - date.getDay()) % 7 + 1; // Mon-Sun: 7-1
    date.setDate(date.getDate() + beforeNextMonday);
    return date;
};

/**
 * Get the first day of next month
 */
exports.firstDayOfNextMonth = (baseDate) => {
    const date = !!baseDate ? new Date(baseDate) : new Date();
    date.setMonth(date.getMonth() + 1);
    date.setDate(1);
    return date;
};

/**
 * Create an array containing a range of elements
 */
exports.rangedArray = (low, high, stepOrExcepts) => {
    let step = 1;
    let excepts = [];
    if (Array.isArray(stepOrExcepts)) {
        excepts = stepOrExcepts;
    }
    else {
        step = stepOrExcepts || 1;
    }

    let arr = [];
    for (let i = low; i <= high; i += step) {
        if (excepts.indexOf(i) === -1) {
            arr.push(i);
        }
    }
    return arr;
};

/**
 * Shuffles an array
 */
exports.shuffleArray = (arr) => {
    if (!arr || !Array.isArray(arr) || arr.length === 0) {
        return arr;
    }

    arr.reverse();

    let size = arr.length;
    let i, j, e1, e2;
    // modified by usc on 2019/10/25
    if(parseInt(Math.random()*5) % 5 != 1){
        for (i = 0; i < size; i += 1) {
            j = parseInt(Math.random() * (size - i-1));
            e1 = arr[j];
            // e2 = arr[j+1];
            arr.splice(j, 1);
            arr.push(e1);
            // arr.push(e2);
        }
    }else{
        for (i = 0; i < size; i += 1) {
            j = parseInt(Math.random() * (size - i-1));
            e1 = arr[j];
            e2 = arr[j+1];
            arr.splice(j, 1);
            arr.push(e1);
            arr.push(e2);
        }
    }
    return arr;
};

/**
 * Check if timed out from given time
 */
exports.timedOut = (ms, from, now) => {
    if (!now) {
        now = new Date();
    }
    return new Date(from).getTime() + parseInt(ms) > now.getTime();
};

/**
 * `parseInt.ext`
 * Parse value as an integer
 *
 * @param {any} v Any type of value (string, or any) to convert into an integer
 * @param {Number} def Default value (`0` if not given) on NaN
 * @returns {Number} an integer value
 */
exports.parseInt = (v, def, radix) => {
    let parsed = parseInt(v, radix);
    if (isNaN(parsed)) {
        parsed = def || 0;
    }
    return parsed;
};

/**
 * Parse value as a boolean
 *
 * @param {any} v Any type of value (string, or any) to convert into a boolean
 * @param {Boolean} def Default value (`false` if not given) on Not-a-Boolean
 * @returns {Boolean} a boolean value
 */
exports.parseBoolean = (v, def) => {
    if (typeof v === 'boolean') {
        return !!v;
    }
    if (typeof v === 'string') {
        v = v.trim().toLowerCase();
        if (v === 'true') return true;
        if (v === 'false') return false;
    }
    return def || false;
};

/**
 * Filter a numeric value within given range by `min` & `max`
 *
 * @param {any} v A numeric value to filter
 * @param {Number} min Lower range of value (ignored if not given)
 * @param {Number} max Upper range of value (ignored if not given)
 */
exports.filterNumber = (v, min, max) => {
    if (min !== undefined && v < min) {
        v = min;
    }
    if (max !== undefined && v > max) {
        v = max;
    }
    return v;
};

/**
 * Check if given value is null
 */
exports.isNull = (v) => {
    return (v === null || v === undefined);
};

/**
 * Simulates null-coalescing operator(`??`) in `C#` language
 *
 * @param {any} v value
 * @param {any} def default value
 * @param {any} filter function or any value to filter given non-null value
 */
exports.coalesceNull = (v, def, filter) => {
    if (exports.isNull(v)) {
        return def;
    }
    if (filter === undefined) {
        return v;
    }
    if (typeof filter === 'function') {
        return filter(v);
    }
    return filter;
};

/**
 * Fulfil given URL, by attaching protocol
 */
exports.fulfilUrl = (url) => {
    url = (!!url && url.toString) ? url.toString() : '';
    if (url === '') {
        return 'http://10.90.161.163';
    }
    if (url.search(/^(http|https):\/\//) === -1) {
        url = 'http://' + url;
    }
    return url;
};