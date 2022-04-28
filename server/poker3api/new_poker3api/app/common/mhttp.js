var http = require('http');
var querystring = require('querystring');
const Config = require('../../config');

// Log
const log = require('../common/log');
const TAG = 'mhttp';

exports.post = function(url, data, callback) {
    var postData = querystring.stringify(data);
    options = {
        hostname: Config.SilverHost,
        port: Config.SilverPort,
        path: url,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = http.request(options, (res) => {
        const { statusCode } = res;

        let error;
        if (statusCode !== 200) {
            error = new Error('Request Failed.\n' + 'Status Code: ' + statusCode);
        }

        if (error) {
            log.error(TAG, error.message);
            // consume response data to free up memory
            res.resume();
            return;
        }

        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk.replace(/^\uFEFF/, ''); } );
        res.on('end', () => {
            try {
                const parsedData = JSON.parse(rawData);
                callback(parsedData);
            } catch (e) {
                log.error(TAG, e.message);
            }
        });
    });

    req.on('error', (e) => {
        log.error(TAG, `problem with request: ${e.message}`);
    });

    // write data to request body
    req.write(postData);
    req.end();
}