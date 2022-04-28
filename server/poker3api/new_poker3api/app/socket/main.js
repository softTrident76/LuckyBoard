/**
 * Server Socket Main Controller
 */

const Consts = require('../../config/consts');
const proc = require('./proc');
const procPoker3 = require('./procPoker3');

// Log
const log = require('../common/log');
const TAG = 'socket.main';

module.exports = (io, socket) => {
    /**
     * Socket Client Context
     */
    let context = {
        io,
        socket,
        playerId: '',
        username: '',
        realname: '',
        token: '',
        type: '',
        gameRoomId: Consts.INVALID_ID
    };

    // Identify connect request
    proc.onConnect(context);

    // ON disconnect
    socket.on('disconnect', (reason) => {
        log.debugVerbose(TAG, `[${context.username}, ${context.gameRoomId}]> disconnect:`, reason);
        procPoker3.onDisconnect(reason, context);

        // step 4: branch the connect by player's status (village / poker3 / poker4 / tetris) //
        // switch (parseInt(context.type)) {
        //     case Consts.GAME_TYPE_POKER3:
        //         procPoker3.onDisconnect(reason, context);
        //         return;
        //
        //     // case Consts.GAME_TYPE_POKER4:
        //     //     // procPoker4.onDisconnect(reason, context);
        //     //     break;
        //     // case Consts.GAME_TYPE_TETRIS:
        //     //     // procTetris.onDisconnect(reason, context);
        //     //     break;
        //     // default:
        //     //     // procVillage.onDisconnect(reason, context);
        // }
    });

    // socket listener for poker3 //prior context connected
    require('./listener/listenerPoker3')(io, socket, context);

    // socket listener for poker4 //

    // socket listener for tetris //
};
