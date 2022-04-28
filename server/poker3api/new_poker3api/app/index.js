const Config = require('../config');
const proc = require('./socket/proc');
const poker3RoomModel = require('./models/poker3/room');

// Log
const log = require('./common/log');
const TAG = '';

/**
 * SERVER STARTUP WORKFLOW
 */
(async () => {

    // step 1: Configure a server socket
    const server = require('http').createServer((request, response) => {
        response.writeHead(404); // HTTP 404 Error as default
        return response.end('HTTP Request Not Allowed');
    });
    const io = require('socket.io')(server, {
        path: Config.SocketPath,
        serveClient: false,
        pingInterval: Config.PingInterval,
        pingTimeout: Config.PingTimeout
    });

    // step 2: create the io //
    const game_io = io.of(Config.GameSpace);
    const mobile_io = io.of(Config.MobileSpace);
    
    // step 3: configure the socket handler. //
    game_io.on('connection', (socket) => {
        log.info(TAG, 'connected');
        require('./socket/main')(game_io, socket);
    });

    // step 4: settle the controller. //
    poker3RoomModel.set_socket_io(game_io, mobile_io);

    // step 5: create the tournament //
    await poker3RoomModel.create_tournament_rooms();

    // step 6: listen the port. //
    server.listen(Config.ServerPort, () => {
        log.info(TAG, `${Config.AppTitle} server is running on port ${Config.ServerPort}, server URL is ${Config.ServerUrl}`);
        log.info(TAG, ` - Log Level is ${log.getLevelTag()}`);
        log.info(TAG, ` - Log Verbose is ${log.isVerboseOn() ? 'ON' : 'OFF'}`);
        log.info(TAG, ''/*empty line*/);
    });

    // step 6: connect to handler. //
    proc.set_socket_io(game_io, mobile_io);

    // // Set interval to update rank
    // setInterval(proc.updateRank, 5000 /* 1000 * 60 * Config.UpdateRankInterval*/);
    //
    // // Set interval to check rooms
    // if (Config.CheckRoomEnabled == 'on')
    //     setInterval(roomModel.check_rooms, 5000 /* 1000 * 60 * Config.CheckRoomInterval */);
    //
    // setInterval(proc.update_poker3_players, 5000 /* 1000 * Config.UpdatePlayersInterval */);
})();
