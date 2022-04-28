/**
 * Server Socket Procedure
 *
 */

const Consts = require('../../config/consts');
const util = require('../common/util');

const playerModel = require('../models/poker3/player');

const procPoker3 = require('./procPoker3');
// const procMap = require('./procMap');

// Log
const log = require('../common/log');
const TAG = 'socket.proc';

exports.set_socket_io = (game, mobile) => {
  procPoker3.set_socket_io(game, mobile);
};

/********************************************************************
 *                    SERVER SOCKET HANDLERS                        *
 ********************************************************************/

/**
 * Client connect event handler
 *      - identify client and refuse connect request from unknown/logged-out user
 *      - recover prior context for reconnected players
 */
exports.onConnect = async (context) => {

    // step 1: get username and token //
    const username = (context.socket.handshake.query.username || '').trim();
    const token = (context.socket.handshake.query.token || '').trim();
    // const type = (context.socket.handshake.query.type || '').trim();

    console.log('onConnect: ' + username + ', token: ' + token);

    try {
        // step 2: check the token and username on database //
        const result = (!username || !token) ? null : await playerModel.identify(username, token);
        if (!result) {
            context.socket.disconnect(true);
            log.debugVerbose(TAG, `ws> ${username || 'unknown user'} attempted to connect with ${token || 'no token'} but unable to identify ... REJECTED`);
            return;
        }

        context.playerId = result.user_id;
        context.username = result.username;
        context.token = result.token;

        // step 4: branch the connect by player's status (village / poker3 / poker4 / tetris) //
        procPoker3.onConnect(context);

        // switch (parseInt(type)) {
        //     case Consts.GAME_TYPE_POKER3:
        //         procPoker3.onConnect(context);
        //         return;
        //     // case Consts.GAME_TYPE_POKER4:
        //     //     // procPoker4.onConnect(context);
        //     //     break;
        //     // case Consts.GAME_TYPE_TETRIS:
        //     //     // procTetris.onConnect(context);
        //     //     break;
        //     // default:
        //     //     procMap.onConnect(context);
        // }

        // context.socket.disconnect(true);
        // log.debugVerbose(TAG, `ws> ${username} attempted to connect with but unable to identify ... REJECTED`);
    }
    catch (err) {
        log.error(TAG, `ws> ${username || 'unknown user'} with ${token || 'invalid token'}, identification ERROR:`, err);
        context.socket.disconnect(true);
        return;
    }
};



