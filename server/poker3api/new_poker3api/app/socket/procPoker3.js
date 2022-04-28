/**
 * Server Socket Procedure
 *
 */

const Config = require('../../config');
const Consts = require('../../config/consts');
const util = require('../common/util');
const iox = require('../common/iox');

const playerModel = require('../models/poker3/player');

const gameModel = require('../models/poker3/game');
const roomModel = require('../models/poker3/room');
const playLogModel = require('../models/poker3/play_log');

// Log
const log = require('../common/log');
const TAG = 'socket.proc';

// Global variable to store room's Info
let gRoomInfo = {};

// game_io, mobile_io are used in timer
let game_io, mobile_io;

// set game_io, mobile_io variable
exports.set_socket_io = (game, mobile) => {
    game_io = game;
    mobile_io = mobile;
};

/**
 * Parse request
 */
const parseRequest = (req, field, type, def) => {
    let value = req[field];
    if (field === 'token') {
        return ((value && value.toString) ? value : '').trim() || (def || '');
    }
    switch (type) {
        case 'id':
            return util.parseInt(value, def || Consts.INVALID_ID);
        case 'int':
            return util.parseInt(value, def || 0);
        case 'bool':
            return util.parseBoolean(value, def || false);
        case 'str':
            return ((value && value.toString) ? value : '') || (def || '');
        case 'token':
        case 'trim':
            return ((value && value.toString) ? value : '').trim() || (def || '');
    }
    return value || def;
};

/**
 * Validate request
 */
const validateRequest = async (event, req, context) => {
    const token = parseRequest(req, 'token');
    if (!playerModel.is_valid_token(token, context.playerId)) {
        // Invalid Token, so leave room and disconnect
        context.socket.emit('poker3-logout', {
            success: Consts.STATUS_SUCCESS
        });
        context.socket.disconnect(true);
        return false;
    }
    return true;
};

/**
 * Handle error
 */
const handleError = (event, err, context) => {
    log.error(TAG, `ws> error: ${event} > (${context.playerId}, ${context.username}, ${context.gameRoomId})> ${err}`);
    Config.Dev && process.exit(1000);
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
    const username = (context.socket.handshake.query.username || '').trim();
    const token = (context.socket.handshake.query.token || '').trim();
    const type = (context.socket.handshake.query.type || '').trim();

    console.log('onConnect: ' + username + ', token: ' + token);
    try {
        // check if another user logged in already and send disconnect to him
        const currentPlayer = playerModel.secureInfoList[context.playerId];
        if (!!currentPlayer && !!currentPlayer.sid) {
            let pastSocket;
            if (currentPlayer.namespace == Config.GameSpace)
                pastSocket = game_io.connected[currentPlayer.sid];
            else if (currentPlayer.namespace == Config.MobileSpace)
                pastSocket = mobile_io.connected[currentPlayer.sid];

            if (pastSocket) {
                pastSocket.emit('poker3-logout');
                pastSocket.disconnect(true);
            }
            delete playerModel.secureInfoList[context.playerId];
        }

        log.debugVerbose(TAG, `ws> ${username} connected with ${token}, identification OK: playerId=${context.playerId}, reset disconnect timer, freshen socket(${context.socket.id})`);
    }
    catch (err) {
        log.error(TAG, `ws> ${username || 'unknown user'} with ${token || 'no token'}, identification ERROR:`, err);
        context.socket.disconnect(true);
        return;
    }

    try {
        // Read prior context - gameRoomID //
        let playerInfo = Object.assign({}, await playerModel.get_player_info(context.playerId));
        delete playerInfo.items;

        context.type = type;
        context.gameRoomId = playerInfo.room_id || Consts.INVALID_ID;

        log.debugVerbose(TAG, `[${context.username}, ${context.gameRoomId}]> prior context connected:`, context.socket.id);

        playerModel.secureInfoList[context.playerId].namespace = context.socket.adapter.nsp.name;
        playerModel.secureInfoList[context.playerId].sid = context.socket.id;
        playerModel.secureInfoList[context.playerId].token = context.token;

        context.socket.emit('get-profile', {
            profile: playerModel.playerInfoList[context.playerId]
        });

        // omit the itema//
        let playerInfoList = JSON.parse( JSON.stringify(playerModel.playerInfoList) );
        for (eachPlayer in playerInfoList)
            delete playerInfoList[eachPlayer].items;
        context.socket.emit('player-list', {
            players: playerInfoList
        });

        game_io.emit('join-player', playerInfo);
        mobile_io.emit('join-player', playerInfo);

        // cond 1: if user is wondering in map //
        if (context.gameRoomId) {
            log.debugVerbose(TAG, `ws.${context.username}> prior map_id was READ -> ${context.gameMapId}`);

            // cond 2: before-created room is there //
            let roomInfo = roomModel.roomInfoList[context.gameRoomId];
            if (!!roomInfo) {
                // cond 3-0: game not started in a room yet, so players would be ready again
                if (roomInfo.status == Consts.ROUND_PLAYERS_JOINED) {

                    roomInfo = await roomModel.add_player_to_room(context.playerId, context.gameRoomId);
                    if (!!roomInfo) {
                        log.debugVerbose(TAG, `ws.${context.username}> join socket was joined by -> ${context.socket}`);

                        playerModel.update_player_room_info(context.gameRoomId, Consts.PLAYER_GAMER, context.playerId);
                        game_io.to('waitroom').emit('update-room', {
                            room: roomModel.filtered_room_info(roomInfo.id)
                        });
                        game_io.to('room_' + context.gameRoomId).emit('update-room', {
                            room: roomInfo,
                            action: 'add',
                        });
                        mobile_io.to('waitroom').emit('update-room', {
                            room: roomModel.filtered_room_info(roomInfo.id)
                        });
                        mobile_io.to('room_' + context.gameRoomId).emit('update-room', {
                            room: roomInfo,
                            action: 'add',
                        });
                        context.socket.emit('join-room', {
                            success: Consts.STATUS_SUCCESS,
                            room: roomInfo
                        });
                        context.socket.join('room_' + context.gameRoomId);
                        return;
                    }
                }
                // cond 3-1: all players are ready
                else if (roomInfo.status == Consts.ROUND_PLAYERS_READY || roomInfo.status == Consts.ROUND_PLAYING || roomInfo.status == Consts.ROUND_END) {
                    log.debugVerbose(TAG, `ws.${context.username}> rejoin socket was rejoined by -> ${context.socket}`);
                    await roomModel.leave_cancel_player(context.gameRoomId, context.playerId);
                    playerModel.update_player_room_info(context.gameRoomId, Consts.PLAYER_GAMER, context.playerId);

                    roomInfo = Object.assign({}, roomInfo);
                    roomInfo.cnt1 = roomInfo.player1 ? roomModel.get_card_count_of_player(roomInfo.player1, context.gameRoomId) : 0;
                    roomInfo.cnt2 = roomInfo.player2 ? roomModel.get_card_count_of_player(roomInfo.player2, context.gameRoomId) : 0;
                    roomInfo.cnt3 = roomInfo.player3 ? roomModel.get_card_count_of_player(roomInfo.player3, context.gameRoomId) : 0;
                    roomInfo.cards = roomModel.get_card_list_by_player_id(context.playerId, context.gameRoomId);

                    if (roomInfo.status == 3)
                        roomInfo.hcards = roomModel.cardsInfoList[context.gameRoomId].hiddenCards;

                    roomInfo.coverCards = roomModel.get_cover_cards(context.gameRoomId);
                    roomInfo.lastputcards = roomModel.cardsInfoList[context.gameRoomId].lastPutCards;
                    roomInfo.observers = playerModel.get_observers(context.gameRoomId);

                    const lastTurnTime = new Date(roomInfo.turn_time).getTime();
                    const currentTime = new Date().getTime();

                    roomInfo.turn_time = roomInfo.time_limit - ((currentTime-lastTurnTime)/1000);
                    roomInfo.continueGame = true;

                    game_io.to('room_' + context.gameRoomId).emit('leave-cancel', {
                        user_id: context.playerId
                    });
                    mobile_io.to('room_' + context.gameRoomId).emit('leave-cancel', {
                        user_id: context.playerId
                    });

                    context.socket.emit('rejoin-room', {
                        room: roomInfo
                    });

                    context.socket.emit('join-room', {
                        success: Consts.STATUS_SUCCESS,
                        room: roomInfo
                    });

                    context.socket.join('room_' + context.gameRoomId);
                    return;
                }
            }
        }

        // No prior context and join to waitroom
        context.socket.join('waitroom');
        context.socket.emit('join-waitroom');

        playerInfo.status = Consts.PLAYER_IN_HOUSE;
        playerInfo.room_id = Consts.INVALID_ID;
        context.gameRoomId = Consts.INVALID_ID;
        roomModel.update_invitable_player_list();

        log.debugVerbose(TAG, `[${context.username}, ${context.gameRoomId}]> connected:`, context.socket.id);
    }
    catch (err) {
        log.error(TAG, `ws.${context.username}> recovery context ERROR:`, err);
    }
};

/**
 * Client disconnect event handler
 */
exports.onDisconnect = async (reason, context) => {
    try {
        if (!context.token || !playerModel.is_valid_token(context.token, context.playerId)) {
            return;
        }
		
		// player is playing on the room //
        let roomInfo = roomModel.roomInfoList[context.gameRoomId];
        if (context.gameRoomId != Consts.INVALID_ID && roomInfo) {

			// step 1: player's state => player is observer //
			if (context.playerId != roomInfo.player1 && context.playerId != roomInfo.player2 && context.playerId != roomInfo.player3) {
                // Observer disconnected
                delete playerModel.playerInfoList[context.playerId];
                delete playerModel.secureInfoList[context.playerId];
                const observers = playerModel.get_observers(context.gameRoomId);
				
				roomInfo.observers = observers;
                game_io.to('waitroom').emit('update-room', {
                    room: roomInfo
                });

                game_io.to('room_' + context.gameRoomId).emit('update-room', {
                    room: {
                        id: context.gameRoomId
                    },
                    observers: observers,
                    action: 'observer'
                });
			}
			// step 2: player's state => player is gamer //
			else {
                // Gamer disconnected
                let playerInfo = playerModel.playerInfoList[context.playerId];
                let secureInfo = playerModel.secureInfoList[context.playerId];
                await roomModel.leave_request_player(context.gameRoomId, context.playerId);
                
				// step 21: room' state => Round is yet not started, so throw out immediately the room //
				if (roomInfo.pstatus1 == Consts.PLAYER_NOT_READY || roomInfo.pstatus2 == Consts.PLAYER_NOT_READY || roomInfo.pstatus3 == Consts.PLAYER_NOT_READY) {
                    
					// Nobody is in the room //
					if (!roomInfo.player1 && !roomInfo.player2 && !roomInfo.player3) {
                        // This means playerId is the last player
                        // Game room is already removed in "leave_request_player"
                        // Only send 'leave-room' request to client
                        if( roomInfo.category_type == Consts.GAME_CATEGORY_NORMAL) {
                            await roomModel.remove_game_room_strict(context.gameRoomId);                            
                            game_io.to('waitroom').emit('remove-room', {
                                room_id: roomInfo.id
                            });							
                            mobile_io.to('waitroom').emit('remove-room', {
                                room_id: roomInfo.id
                            });
                        }
						else {
							game_io.to('waitroom').emit('update-room', {
								room: roomModel.filtered_room_info(roomInfo.id)
							});
							mobile_io.to('waitroom').emit('update-room', {
								room: roomModel.filtered_room_info(roomInfo.id)
							});
						}
						
						game_io.to('room_' + context.gameRoomId).emit('leave-room');
                        mobile_io.to('room_' + context.gameRoomId).emit('leave-room');
                        playerModel.update_player_room_info(null, Consts.PLAYER_DISCONNECTED, context.playerId);
                    } 
					// Anybody is still in the room //
					else {
                        // Round not started, so leave immediately from room
                        game_io.to('room_' + context.gameRoomId).emit('update-room', {
                            room: {
                                id: context.gameRoomId
                            },
                            action: 'leave',
                            player_id: context.playerId
                        });
                        game_io.to('waitroom').emit('update-room', {
                            room: roomModel.filtered_room_info(roomInfo.id)
                        });
                        mobile_io.to('room_' + context.gameRoomId).emit('update-room', {
                            room: {
                                id: context.gameRoomId
                            },
                            action: 'leave',
                            player_id: context.playerId
                        });
                        mobile_io.to('waitroom').emit('update-room', {
                            room: roomModel.filtered_room_info(roomInfo.id)
                        });
                        playerModel.update_player_room_info(null, Consts.PLAYER_DISCONNECTED, context.playerId);                      
                    }
                    gRoomInfo[context.gameRoomId] = 0;
                } 
				// step 22: room's state -> all players are playing, but all of them want to leave the room //
				else if (roomInfo.player1 != null && roomInfo.pstatus1 == Consts.PLAYER_REQUEST_LEAVE
					&& roomInfo.player2 != null && roomInfo.pstatus2 == Consts.PLAYER_REQUEST_LEAVE 
					&& roomInfo.player3 != null && roomInfo.pstatus3 == Consts.PLAYER_REQUEST_LEAVE) {
						
                    // if all gamers requested to leave room, destory game room
                    // should destroy even if game is tournament mode, because game have been already started //
                    await roomModel.remove_game_room_strict(context.gameRoomId);
                    game_io.to('waitroom').emit('remove-room', {
                        room_id: roomInfo.id
                    });
                    mobile_io.to('waitroom').emit('remove-room', {
                        room_id: roomInfo.id
                    });

					game_io.to('room_' + context.gameRoomId).emit('leave-room');
					mobile_io.to('room_' + context.gameRoomId).emit('leave-room');
					
                    playerModel.update_player_room_info(null, Consts.PLAYER_DISCONNECTED, context.playerId);
                    gRoomInfo[context.gameRoomId] = 0;
                }
				// step 23: room's state -> just someone are trying to leave , while playing the round.
                else {
                    // Game is playing now, so show "request" message only now
                    // Player will be dropped when round ended
                    game_io.to('room_' + context.gameRoomId).emit('leave-request', {
                        user_id: context.playerId
                    });
                    mobile_io.to('room_' + context.gameRoomId).emit('leave-request', {
                        user_id: context.playerId
                    });
                }
                playerInfo.status = Consts.PLAYER_DISCONNECTED;
                secureInfo.sid = '';
            }
        }
        else {
            delete playerModel.playerInfoList[context.playerId];
            delete playerModel.secureInfoList[context.playerId];
        }
        iox.leaveAll(context.socket);
        roomModel.update_invitable_player_list();
    }
    catch (err) {
        log.error(TAG, `ws.${context.username}> disconnect ERROR:`, err);
    }
};

/**
 * Get Player Profile Information
 */
exports.getProfileInfo = async (req, context) => {
    try {
        if (!(await validateRequest('get-profile', req, context))) {
            return;
        }

        context.socket.emit('get-profile', {
            profile: playerModel.playerInfoList[context.playerId]
        });
    }
    catch (err) {
        handleError('get-profile', err, context);
    }
};

/**
 * Get Available Poker3 Room List
 */
exports.getRoomList = async (req, context) => {
    try {
        if (!(await validateRequest('room-list', req, context))) {
            return;
        }

        let general_rooms = roomModel.sorted_room_list().filter(c => c.category_type == Consts.GAME_CATEGORY_NORMAL );
        context.socket.emit('room-list', {
            rooms: general_rooms,
            categories: await gameModel.get_all_categories()
        });
        playerModel.secureInfoList[context.playerId].sid = context.socket.id;
    }
    catch (err) {
        handleError('room-list', err, context);
    }
};

/**
 * Create new Poker3 Game Room
 */
exports.createRoom = async (req, context) => {
    console.log('createRoom');
    try {
        if (!(await validateRequest('create-room', req, context))) {
            return;
        }
        const categoryId = parseRequest(req, 'category_id', 'id');
        const roomCategory = await gameModel.get_category_by_id(categoryId);

        // Check if Player is now playing in another room
        if (context.gameRoomId === Consts.INVALID_ID) {
            const playerInfo = playerModel.playerInfoList[context.playerId];
            // Check if player's jewels are enough to create room
            const minJewels = roomCategory.unit_jewel*Consts.MIN_JEWEL_MULTIPLE;

            if(roomCategory.category_type != Consts.GAME_CATEGORY_NORMAL)
                return;

            if (playerInfo.free_jewel < minJewels) {
                context.socket.emit('create-room', {
                    success: Consts.STATUS_FAILED,
                    min_jewels: minJewels,
                    category_type: roomCategory.category_type
                });
                return;
            }

            if (context.gameRoomId !== Consts.INVALID_ID)
                return;

            const roomId = await roomModel.create_room(playerInfo, categoryId);
            context.gameRoomId = roomId;
            playerModel.update_player_room_info(roomId, Consts.PLAYER_GAMER, playerInfo.user_id);
            await iox.leaveAll(context.socket);
            const roomInfo = {
                id: roomId,
                point: roomCategory.unit_jewel,
                category_type: roomCategory.category_type,
                player1: context.playerId,
                player2: null,
                player3: null,
                status: Consts.ROUND_PLAYERS_JOINED
            };
            context.socket.emit('create-room', {
                success: Consts.STATUS_SUCCESS,
                room: roomInfo
            });
            game_io.to('waitroom').emit('add-room', {
                room: roomInfo
            });
            mobile_io.to('waitroom').emit('add-room', {
                room: roomInfo
            });
            context.socket.join('room_' + context.gameRoomId);
            gRoomInfo[roomId] = 0;
            await roomModel.update_invitable_player_list();
        }
    }
    catch (err) {
        handleError('create-room', err, context);
    }
};

/**
 * Join to Game Room
 */
exports.joinRoom = async (req, context) => {
    try {
        if (!(await validateRequest('join-room', req, context))) {
            return;
        }
        const roomId = parseRequest(req, 'room_id', 'id');
        let roomInfo = roomModel.roomInfoList[roomId];

        if (context.gameRoomId === Consts.INVALID_ID && !!roomInfo) {
            const playerInfo = playerModel.playerInfoList[context.playerId];

            // Check if IP Blocking feature enabled
            if (Config.IPBlockEnabled == 'on') {
                if (playerInfo.ipaddr == roomInfo.ipaddr1 || playerInfo.ipaddr == roomInfo.ipaddr2 || playerInfo.ipaddr == roomInfo.ipaddr3) {
                    // Check if player is re-joining to room
                    if (context.playerId != roomInfo.player1 && context.playerId != roomInfo.player2 && context.playerId != roomInfo.player3) {
                        return;
                    }
                }
                // Check if player comes from same IP domain with other players //
                let playerIpAddr = playerInfo.ipaddr.split(/\./);
                if (playerIpAddr.length > 1) {
                    playerIpAddr.pop();
                    for (otherIP of [roomInfo.ipaddr1, roomInfo.ipaddr2, roomInfo.ipaddr3]) {
                        if (!!otherIP) {
                            let domain = otherIP.split(/\./);
                            if (domain.length > 1) {
                                domain.pop();
                                if (playerIpAddr.join('.') != Config.WhiteIpDomain && playerIpAddr.join('.') == domain.join('.')) {
                                    return;
                                }
                            }
                        }
                    }
                }
            }

            // check if player's jewels are enough to join room
            const minJewels = roomInfo.point * Consts.MIN_JEWEL_MULTIPLE;

            if(roomInfo.category_type != Consts.GAME_CATEGORY_NORMAL)
                return;

            if (playerInfo.free_jewel < minJewels) {
                context.socket.emit('join-room', {
                    success: Consts.STATUS_FAILED,
                    room_id: roomId,
                });
                return;
            }

            roomInfo = await roomModel.add_player_to_room(context.playerId, roomId);
            if (context.gameRoomId === Consts.INVALID_ID && !!roomInfo) {
                context.gameRoomId = roomId;
                playerModel.update_player_room_info(roomId, Consts.PLAYER_GAMER, context.playerId);
                if ((roomInfo.player1 == context.playerId && roomInfo.pstatus1 == Consts.PLAYER_REQUEST_LEAVE) || (roomInfo.player2 == context.playerId && roomInfo.pstatus2 == Consts.PLAYER_REQUEST_LEAVE) || (roomInfo.player3 == context.playerId && roomInfo.pstatus3 == Consts.PLAYER_REQUEST_LEAVE)) {
                    roomInfo.cnt1 = roomInfo.player1 ? roomModel.get_card_count_of_player(roomInfo.player1, roomId) : 0;
                    roomInfo.cnt2 = roomInfo.player2 ? roomModel.get_card_count_of_player(roomInfo.player2, roomId) : 0;
                    roomInfo.cnt3 = roomInfo.player3 ? roomModel.get_card_count_of_player(roomInfo.player3, roomId) : 0;
                    roomInfo.cards = roomModel.get_card_list_by_player_id(context.playerId, roomId);
                    if (roomInfo.status == 3)
                        roomInfo.hcards = roomModel.cardsInfoList[roomId].hiddenCards;
                    roomInfo.coverCards = roomModel.get_cover_cards(roomId)
                    roomInfo.lastputcards = roomModel.cardsInfoList[roomId].lastPutCards;
                    roomInfo.observers = playerModel.get_observers(roomId);
                    await iox.leaveAll(context.socket);
                    const lastTurnTime = new Date(roomInfo.turn_time).getTime();
                    const currentTime = new Date().getTime();
                    roomInfo.turn_time = roomInfo.time_limit - ((currentTime-lastTurnTime)/1000);
                    roomInfo.continueGame = true;
                    context.socket.emit('rejoin-room', {
                        room: roomInfo
                    });
                    context.socket.join('room_' + roomId);
                } else {                    
                    await iox.leaveAll(context.socket);

                    game_io.to('waitroom').emit('update-room', {
                        room: roomModel.filtered_room_info(roomId),
                    });
                    mobile_io.to('waitroom').emit('update-room', {
                        room: roomModel.filtered_room_info(roomId),
                    });
                    context.socket.emit('join-room', {
                        success: Consts.STATUS_SUCCESS,
                        room: roomInfo
                    });
                    game_io.to('room_' + context.gameRoomId).emit('update-room', {
                        room: roomInfo,
                        action: 'add',
                    });
                    mobile_io.to('room_' + context.gameRoomId).emit('update-room', {
                        room: roomInfo,
                        action: 'add',
                    });
                    context.socket.join('room_' + context.gameRoomId);
                    await roomModel.update_invitable_player_list();
                }
            }
        }
    }
    catch (err) {
        handleError('join-room', err, context);
    }
};

/**
 * When player click "Ready" button
 */
exports.setReady = async (req, context) => {
    try {
        if (!(await validateRequest('set-ready', req, context))) {
            return;
        }

        let roomInfo = await roomModel.set_ready_player(context.gameRoomId, context.playerId);
        if (!!roomInfo && roomInfo.status == Consts.ROUND_PLAYERS_JOINED) {
            // context.socket.emit('set-ready', {
            //     player_id: context.playerId,
            //     room_id: roomInfo.id,
            // });

            game_io.to('room_' + context.gameRoomId).emit('set-ready', {
                player_id: context.playerId,
                room_id: roomInfo.id,
            });
            mobile_io.to('room_' + context.gameRoomId).emit('set-ready', {
                player_id: context.playerId,
                room_id: roomInfo.id,
            });

            gRoomInfo[context.gameRoomId]++;

            // Check if 3 players are all ready
            if (gRoomInfo[context.gameRoomId] >= 3) {
                gRoomInfo[context.gameRoomId] = 0;
                // Update room options to start new round
                await roomModel.init_new_round(context.gameRoomId);
                log.debugVerbose(TAG, `> ready> all players in room${context.gameRoomId} ready, start new round`);
            }
        }
    }
    catch (err) {
        handleError('set-ready', err, context);
    }
};

/**
 * When player click "pass" button or right button to pass betting
 */
exports.passBet = async (req, context) => {
    try {
        if (!(await validateRequest('pass-bet', req, context))) {
            return;
        }
        let roomInfo = await roomModel.pass_bet(context.gameRoomId, context.playerId);
        if (roomInfo) {
            const res = {
                turn_id: roomInfo.turn_id,
                next_id: roomInfo.next_id,
                turn_time: roomInfo.time_limit,
                round_point: roomInfo.round_point,
                room_id: context.gameRoomId,
            };
            // context.socket.emit('pass-bet', res);
            game_io.to('room_' + context.gameRoomId).emit('pass-bet', res);
            mobile_io.to('room_' + context.gameRoomId).emit('pass-bet', res);
        }
    }
    catch (err) {
        handleError('pass-bet', err, context);
    }
};

/**
 * When player click "call" button to level up for bet
 */
exports.levelUpBet = async (req, context) => {
    try {
        if (!(await validateRequest('level-up', req, context))) {
            return;
        }
        let roomInfo = roomModel.roomInfoList[context.gameRoomId];
        if (roomInfo.turn_id == context.playerId) {
            await roomModel.level_up(context.gameRoomId, context.playerId);
        }
    }
    catch (err) {
        handleError('level-up', err, context);
    }
};

/**
 * Get Own player's Card list
 */
exports.getCards = async (req, context) => {
    try {
        if (!(await validateRequest('get-cards', req, context))) {
            return;
        }
        const cards = roomModel.get_card_list_by_player_id(context.playerId, context.gameRoomId);
        log.debugVerbose(TAG, `${context.username}.CARD_LIST>`, cards);

        context.socket.emit('get-cards', {
            cards: cards,
            room_id: context.gameRoomId
        });
    }
    catch (err) {
        handleError('get-cards', err, context);
    }
};

/**
 * Called when player pick up cards
 */
exports.pickupCards = async (req, context) => {
    try {
        if (!(await validateRequest('pick-cards', req, context))) {
            return;
        }
        game_io.to('room_' + context.gameRoomId).emit('pick-cards', {
            cards: req['cards'],
            user_id: context.playerId,
            room_id: context.gameRoomId
        });
        // mobile_io.to('room_' + context.gameRoomId).emit('pick-cards', {
        //     cards: req['cards'],
        //     user_id: context.playerId,
        //     room_id: context.gameRoomId
        // });
    }
    catch (err) {
        handleError('pick-cards', err, context);
    }
};

/**
 * Pass player's turn to next by clicking "pass" button or Right Mouse Button
 */
exports.passTurn = async (req, context) => {
    try {
        if (!(await validateRequest('pass-turn', req, context))) {
            return;
        }
        let roomInfo = await roomModel.pass_turn(context.gameRoomId, context.playerId, Consts.NEXT_PASS);
        if (!!roomInfo) {
            // PASS_TURN_LIMIT 만큼 통과하면 자동탈퇴시킨다. //
            if (roomInfo.turn_cnt >= Consts.PASS_TURN_LIMIT) {
                // 방을 삭제한다. //
                await roomModel.remove_game_room_strict(context.gameRoomId);
                game_io.to('room_' + context.gameRoomId).emit('leave-room');
                mobile_io.to('room_' + context.gameRoomId).emit('leave-room');
                game_io.to('waitroom').emit('remove-room', {
                    room_id: roomInfo.id
                });
                mobile_io.to('waitroom').emit('remove-room', {
                    room_id: roomInfo.id
                });
                context.gameRoomId = Consts.INVALID_ID;
            }
            // 일반 통과상태이면 상태를 다음상태로 이전시킨다. //
            else {

                // Log Round History
                roomModel.roundHistories[context.gameRoomId].push({
                    action: 4,
                    player_id: context.playerId
                });
                const res = {
                    turn_id: roomInfo.turn_id,
                    next_id: roomInfo.next_id,
                    turn_time: playerModel.playerInfoList[roomInfo.next_id].status ? roomInfo.time_limit : Consts.TURN_LIMIT_FOR_DROPPED,
                    room_id: context.gameRoomId,
                };
                game_io.to('room_' + context.gameRoomId).emit('pass-turn', res);
                mobile_io.to('room_' + context.gameRoomId).emit('pass-turn', res);
            }
        }
    }
    catch (err) {
        handleError('pass-turn', err, context);
    }
};

/**
 * Put cards on the board
 */
exports.putCard = async (req, context) => {
    try {
        if (!(await validateRequest('put-card', req, context))) {
            return;
        }

        // get the room object  //
        let roomInfo = roomModel.roomInfoList[context.gameRoomId];

        // this is my turn and //
        if (roomInfo.turn_id == context.playerId && roomInfo.status == Consts.ROUND_PLAYING) {
            if (roomModel.roomLocks[context.gameRoomId])
                return;

            roomModel.roomLocks[context.gameRoomId] = true;

            // get the holding card //
            const cards = req['cards'];
            const playerCards = roomModel.get_card_list_by_player_id(context.playerId, context.gameRoomId);
            let playerCardCount = 0;
            let isLastCards = false;

            // check if the request is same as my holding card //
            for (eachCard of playerCards) {
                if (cards.indexOf(eachCard) != -1) {
                    playerCardCount++;
                }
            }
            if (playerCardCount != cards.length) {
                context.socket.emit('put-card', {
                    success: Consts.STATUS_FAILED,
                    message: 'Invalid card list',
                    room_id: context.gameRoomId,
                });
                roomModel.roomLocks[context.gameRoomId] = false;
                return;
            }

            // check if last card //
            isLastCards = playerCards.length == cards.length ? true: false;

            // check the type of card //
            const card_type = gameModel.check_card_type(cards, cards.length)
            if (card_type == "CARD_ILLEGAL") {
                context.socket.emit('put-card', {
                    success: Consts.STATUS_FAILED,
                    message: 'card illegal',
                    room_id: context.gameRoomId,
                });
                roomModel.roomLocks[context.gameRoomId] = false;
                return;
            }

            // //
            const pastCards = roomModel.cardsInfoList[context.gameRoomId].lastPutCards.cards || [];
            if (!gameModel.is_correct_rule(cards, card_type, pastCards)) {
                context.socket.emit('put-card', {
                    success: Consts.STATUS_FAILED,
                    message: 'last card check error',
                    room_id: context.gameRoomId,
                });
                roomModel.roomLocks[context.gameRoomId] = false;
                return;
            }

            // //
            roomModel.put_cards(context.gameRoomId, context.playerId, cards);

            // //
            roomInfo.round_point *= (card_type == "CARD_BOMB" || card_type == "CARD_RAMPAGE" ) ? 2 : 1;
            roomInfo.turn_time = new Date();
            roomInfo.put_id = context.playerId;

            // //
            roomModel.roundHistories[context.gameRoomId].push({
                action: 3,
                player_id: context.playerId,
                cards: cards,
                card_type: gameModel.get_card_type_value(card_type),
                round_point: roomInfo.round_point
            });

            //  //
            if (isLastCards) {
                //
                await roomModel.pass_turn(context.gameRoomId, context.playerId, Consts.NEXT_NORMAL, true);
                const otherPlayersCards = roomModel.get_other_players_cards(context.gameRoomId, context.playerId);
                const res = {
                    turn_id: context.playerId,
                    cards: cards,
                    card_type: gameModel.get_card_type_value(card_type),
                    round_point: roomInfo.round_point,
                    others: otherPlayersCards,
                    room_id: context.gameRoomId,
                };

                // context.socket.emit('last-card', res);
                game_io.to('room_' + context.gameRoomId).emit('last-card', res);
                mobile_io.to('room_' + context.gameRoomId).emit('last-card', res);

                // //
                setTimeout(roomModel.end_round, 3000, context.gameRoomId, context.playerId, context.socket);

            }
            else {
                const result = await roomModel.pass_turn(context.gameRoomId, context.playerId, Consts.NEXT_NORMAL);
                const res = {
                    success: Consts.STATUS_SUCCESS,
                    turn_id: context.playerId,
                    cards: cards,
                    card_type: gameModel.get_card_type_value(card_type),
                    next_id: result.next_id,
                    turn_time: playerModel.playerInfoList[result.next_id].status ? roomInfo.time_limit : Consts.TURN_LIMIT_FOR_DROPPED,
                    round_point: roomInfo.round_point,
                    room_id: context.gameRoomId,
                };

                // context.socket.emit('put-card', res);
                game_io.to('room_' + context.gameRoomId).emit('put-card', res);
                mobile_io.to('room_' + context.gameRoomId).emit('put-card', res);
            }
            roomModel.roomLocks[context.gameRoomId] = false;
        }
    }
    catch (err) {
        handleError('put-card', err, context);
    }
};

/**
 * Join player to waitroom
 */
exports.joinWaitRoom = async (req, context) => {
    try {
        if (!(await validateRequest('join-waitroom', req, context))) {
            return;
        }
        await iox.leaveAll(context.socket);
        context.gameRoomId = Consts.INVALID_ID;
        context.socket.join('waitroom');
        // context.socket.emit('join-waitroom');
        await roomModel.update_invitable_player_list();
    }
    catch (err) {
        handleError('join-waitroom', err, context);
    }
};

exports.illegalVote = async (req,context) => {
    try{
        if (!(await validateRequest('illegal-vote', req, context))) {
            return;
        }
        if (!await playLogModel.is_valid_vote(req['history_id'], context.playerId)) {
            await playLogModel.add_cnt_vote(req['history_id'], context.playerId);
            context.socket.emit("illegal-vote", {
                success:Consts.STATUS_SUCCESS
            });
        }
        else {
            context.socket.emit("illegal-vote", {
                success:Consts.STATUS_FAILED
            });            
        }
    }
    catch(err){
        handleError('illegal-vote', err, context);        
    }
}

exports.illegalNegativeVote = async (req,context) => {
    try{
        if (!(await validateRequest('illegal-reject', req, context))) {
            return;
        }
        if (!await playLogModel.is_valid_vote(req['history_id'], context.playerId)) {
            await playLogModel.add_cnt_devote(req['history_id'], context.playerId);
            context.socket.emit("illegal-reject", {
                success:Consts.STATUS_SUCCESS
            });
        }
        else {
            context.socket.emit("illegal-reject", {
                success:Consts.STATUS_FAILED
            });            
        }
    }
    catch(err){
        handleError('illegal-reject', err, context);        
    }
}

/**
 * process request to leave game room
 */
exports.leaveRequest = async (req, context) => {
    try {
        if (!(await validateRequest('leave-request', req, context))) {
            return;
        }
        if (context.gameRoomId != Consts.INVALID_ID) {
            let roomInfo = roomModel.roomInfoList[context.gameRoomId];

            // Step1: player's state -> Player is observer //
            if (roomInfo.player1 != context.playerId && roomInfo.player2 != context.playerId && roomInfo.player3 != context.playerId) {
                playerModel.update_player_room_info(null, Consts.PLAYER_IN_HOUSE, context.playerId);
                context.socket.leave('room_' + context.gameRoomId);
                
				let observers = playerModel.get_observers(context.gameRoomId);
				roomInfo.observers = observers;
				
				game_io.to('waitroom').emit('update-room', {
                    room: roomInfo
                });
				
				game_io.to('room_' + context.gameRoomId).emit('update-room', {
                    room: {
                        id: context.gameRoomId
                    },
                    observers: observers,
                    action: 'observer'
                });
                context.socket.emit('leave-room');
                context.gameRoomId = Consts.INVALID_ID;
            }
            // step 2: player's state -> Player is "Gamer" //
            else {
                await roomModel.leave_request_player(context.gameRoomId, context.playerId);

                // step 21: room's state -> Round is yet not started, so throw out immediately the room //
                if (roomInfo.pstatus1 == Consts.PLAYER_NOT_READY || roomInfo.pstatus2 == Consts.PLAYER_NOT_READY || roomInfo.pstatus3 == Consts.PLAYER_NOT_READY) {
                    gRoomInfo[context.gameRoomId] = 0;

                    // Nobody is in the room //
                    if (!roomInfo.player1 && !roomInfo.player2 && !roomInfo.player3) {
                        // This means playerId is the last player
                        // Game room is already removed in "leave_request_player"
                        // Only send 'leave-room' request to client
						
						// warning: Shuldn't remove the room in the tournament mode //
						if( roomInfo.category_type == Consts.GAME_CATEGORY_NORMAL) {
							await roomModel.remove_game_room_strict(context.gameRoomId);

							game_io.to('waitroom').emit('remove-room', {
								room_id: roomInfo.id
							});
							mobile_io.to('waitroom').emit('remove-room', {
								room_id: roomInfo.id
							});
						}
						else {
							game_io.to('waitroom').emit('update-room', {
								room: roomModel.filtered_room_info(roomInfo.id)
							});
							mobile_io.to('waitroom').emit('update-room', {
								room: roomModel.filtered_room_info(roomInfo.id)
							});
						}
                        
                        game_io.to('room_' + context.gameRoomId).emit('leave-room');
                        mobile_io.to('room_' + context.gameRoomId).emit('leave-room');
                    }
                    // Anybody is still in the room //
                    else {
                        context.socket.leave('room_' + context.gameRoomId);
                        game_io.to('waitroom').emit('update-room', {
                            room: roomModel.filtered_room_info(roomInfo.id)
                        });
                        mobile_io.to('waitroom').emit('update-room', {
                            room: roomModel.filtered_room_info(roomInfo.id)
                        });
                        context.socket.emit('leave-room');
                        game_io.to('room_' + context.gameRoomId).emit('update-room', {
                            room: {
                                id: context.gameRoomId
                            },
                            action: 'leave',
                            player_id: context.playerId
                        });
                        mobile_io.to('room_' + context.gameRoomId).emit('update-room', {
                            room: {
                                id: context.gameRoomId
                            },
                            action: 'leave',
                            player_id: context.playerId
                        });
                    }

                    context.gameRoomId = Consts.INVALID_ID;
                    playerModel.update_player_room_info(null, Consts.PLAYER_IN_HOUSE, context.playerId);
                    await roomModel.update_invitable_player_list();
                }
                // step 22: room's state -> all players are playing, but all of them want to leave the room //
                else if (roomInfo.player1 != null && roomInfo.pstatus1 == Consts.PLAYER_REQUEST_LEAVE
                    && roomInfo.player2 != null && roomInfo.pstatus2 == Consts.PLAYER_REQUEST_LEAVE
                    && roomInfo.player3 != null && roomInfo.pstatus3 == Consts.PLAYER_REQUEST_LEAVE)
                {
					// warning: Shuldn't remove the room in the tournament mode //
					// should destroy even if game is tournament mode, because game have been already started //
					
					await roomModel.remove_game_room_strict(context.gameRoomId);
					
					game_io.to('waitroom').emit('remove-room', {
						room_id: roomInfo.id
					});
					mobile_io.to('waitroom').emit('remove-room', {
						room_id: roomInfo.id
					});
					
                    game_io.to('room_' + context.gameRoomId).emit('leave-room');
                    mobile_io.to('room_' + context.gameRoomId).emit('leave-room');

                    context.gameRoomId = Consts.INVALID_ID;
                    await roomModel.update_invitable_player_list();
                }
                // step 23: room's state -> just someone are trying to leave , while playing the round.
                else {
                    // Game is playing now, so show "request" message only now
                    // Player will be dropped when round ended
                    // context.socket.emit('leave-request', {
                    //     user_id: context.playerId
                    // });
                    game_io.to('room_' + context.gameRoomId).emit('leave-request', {
                        user_id: context.playerId
                    });
                    mobile_io.to('room_' + context.gameRoomId).emit('leave-request', {
                        user_id: context.playerId
                    });
                }
            }
        }
    }
    catch (err) {
        handleError('leave-request', err, context);
    }
};

/**
 * cancel leave request while playing game
 */
exports.leaveCancel = async (req, context) => {
    try {
        if (!(await validateRequest('leave-cancel', req, context))) {
            return;
        }
        if (context.gameRoomId != Consts.INVALID_ID) {
            let roomInfo = await roomModel.leave_cancel_player(context.gameRoomId, context.playerId);
            if (!!roomInfo) {
                // context.socket.emit('leave-cancel', {
                //     user_id: context.playerId
                // });
                game_io.to('room_' + context.gameRoomId).emit('leave-cancel', {
                    user_id: context.playerId
                });
                mobile_io.to('room_' + context.gameRoomId).emit('leave-cancel', {
                    user_id: context.playerId
                });
            }
        }
        // playerModel.secureInfoList[context.playerId].sid = context.socket.id;
    }
    catch (err) {
        handleError('leave-cancel', err, context);
    }
};


/**
 * Retrieve round history logs to player
 */
exports.historyView = async (req, context) => {
    try {
        if (!(await validateRequest('history-view', req, context))) {
            return;
        }
        const historyId = parseRequest(req, 'history_id', 'int');
        const historyData = await playLogModel.get_round_history(historyId);
        if (!!historyData) {
            context.socket.emit('history-view', {
                history: historyData.history
            });
        }
    }
    catch (err) {
        handleError('history-view', err, context);
    }
};

/**
 * Retrieve emoticon and send to players
 */
exports.doEmoticon = async (req, context) => {
    try {
        if (!(await validateRequest('emoticon', req, context))) {
            return;
        }
        // context.socket.emit('emoticon', req);
        game_io.to('room_' + context.gameRoomId).emit('emoticon', req);
        mobile_io.to('room_' + context.gameRoomId).emit('emoticon', req);
    }
    catch (err) {
        handleError('emoticon', err, context);
    }
};

/**
 * Retrieve chat text and send to players
 */
exports.emotText = async (req, context) => {
    try {
        if (!(await validateRequest('emot-text', req, context))) {
            return;
        }
        // context.socket.emit('emot-text', req);
        game_io.to('room_' + context.gameRoomId).emit('emot-text', req);
        mobile_io.to('room_' + context.gameRoomId).emit('emot-text', req);
    }
    catch (err) {
        handleError('emot-text', err, context);
    }
};

/**
 * Retrieve call player and send to players
 */
exports.callPlayer = async (req, context) => {
    try {
        if (!(await validateRequest('call-player', req, context))) {
            return;
        }
        // context.socket.emit('call-player', req);
        game_io.to('room_' + context.gameRoomId).emit('call-player', req);
        mobile_io.to('room_' + context.gameRoomId).emit('call-player', req);
    }
    catch (err) {
        handleError('call-player', err, context);
    }
};

/**
 * Join Player as Observer to Game Room
 */
exports.joinObserver = async (req, context) => {
    try {
        if (!(await validateRequest('join-observer', req, context))) {
            return;
        }
        const roomId = parseRequest(req, 'room_id', 'int');
        let roomInfo = Object.assign({}, roomModel.roomInfoList[roomId]);
        if (context.gameRoomId === Consts.INVALID_ID && !!roomInfo) {
            if (roomInfo.player1 == context.playerId || roomInfo.player2 == context.playerId || roomInfo.player3 == context.playerId) {
                // user is already player, so it's impossible to join as observer at the same time
                return;
            } else if (!roomInfo.player1 && !roomInfo.player2 && !roomInfo.player3) {
                return;
            }
            context.gameRoomId = roomId;
            playerModel.add_observer(roomId, context.playerId);
            roomInfo.playerState = "observer";
            roomInfo.observers = playerModel.get_observers(roomId);

            if (roomInfo.pstatus1 != Consts.PLAYER_NOT_READY && roomInfo.pstatus2 != Consts.PLAYER_NOT_READY && roomInfo.pstatus3 != Consts.PLAYER_NOT_READY) {
                roomInfo.cnt1 = roomInfo.player1 ? roomModel.get_card_count_of_player(roomInfo.player1, roomId) : 0;
                roomInfo.cnt2 = roomInfo.player2 ? roomModel.get_card_count_of_player(roomInfo.player2, roomId) : 0;
                roomInfo.cnt3 = roomInfo.player3 ? roomModel.get_card_count_of_player(roomInfo.player3, roomId) : 0;
                if (roomInfo.status == 3)
                    roomInfo.hcards = roomModel.cardsInfoList[roomId].hiddenCards;

                roomInfo.coverCards = roomModel.get_cover_cards(roomId);
                roomInfo.lastputcards = roomModel.cardsInfoList[roomId].lastPutCards;

                const lastTurnTime = new Date(roomInfo.turn_time).getTime();
                const currentTime = new Date().getTime();

                roomInfo.turn_time = roomInfo.time_limit - ((currentTime-lastTurnTime)/1000);
            }
			roomModel.roomInfoList[roomId].observers = roomInfo.observers;
			
            await iox.leaveAll(context.socket);

            game_io.to('waitroom').emit('update-room', {
                room: roomInfo
            });
            mobile_io.to('waitroom').emit('update-room', {
                room: roomInfo
            });

            game_io.to('room_' + roomId).emit('update-room', {
                room: {
                    id: context.gameRoomId
                },
                observers: roomInfo.observers,
                action: 'observer'
            });
            // mobile_io.to('room_' + roomId).emit('update-room', {
            //     room: {
            //         id: context.gameRoomId
            //     },
            //     observers: roomInfo.observers,
            //     action: 'observer'
            // });
            context.socket.emit('join-observer', {
                room: roomInfo
            });
            context.socket.join('room_' + roomId);
        }
    }
    catch (err) {
        handleError('join-observer', err, context);
    }
};

/**
 * Invite player to game room
 */
exports.InvitePlayerToRoom = async (req, context) => {
    try {
        if (!(await validateRequest('invite-user', req, context))) {
            return;
        }
        const invitedPlayerId = parseRequest(req, 'invite_id', 'int');
        const invitedPlayerInfo = playerModel.playerInfoList[invitedPlayerId];
        if (!!invitedPlayerInfo && (invitedPlayerInfo.status != Consts.PLAYER_GAMER)) {
            let roomInfo = roomModel.roomInfoList[context.gameRoomId];
            // check if player's jewels are enough to join room
            const minJewels = roomInfo.point * Consts.MIN_JEWEL_MULTIPLE;

            if(roomInfo.category_type == 0 && (invitedPlayerInfo.free_jewel + invitedPlayerInfo.pay_jewel) < minJewels || roomInfo.category_type == 1 && invitedPlayerInfo.pay_jewel < minJewels)
                return;

            const currentPlayer = playerModel.secureInfoList[invitedPlayerId];
            let playerSocket;

            if (currentPlayer.namespace == Config.GameSpace)
                playerSocket = game_io.connected[currentPlayer.sid];
            else if (currentPlayer.namespace == Config.MobileSpace)
                playerSocket = mobile_io.connected[currentPlayer.sid];

            if (playerSocket) {
                let inviteInfo = playerModel.playerInfoList[context.playerId];
                if (!!inviteInfo && !!roomInfo) {
                    if (invitedPlayerInfo.status == Consts.PLAYER_OBSERVER) {
                        playerSocket.emit('invite-room', {
                            inviteinfo: {
                                player: context.playerId,
                                room_id: context.gameRoomId,
                                point: roomInfo.point
                            }
                        });
                    } else {
                        playerSocket.emit('invite-waitroom', {
                            inviteinfo: {
                                player: context.playerId,
                                room_id: context.gameRoomId,
                                point: roomInfo.point
                            }
                        });
                    }
                }
            }
        }
    }
    catch (err) {
        handleError('invite-user', err, context);
    }
};

/**
 * Convert Observer to Player by invitation
 */
exports.InviteObserverToRoom = async (req, context) => {
    try {
        if (!(await validateRequest('invite-join-room', req, context))) {
            return;
        }
        const roomId = parseRequest(req, 'room_id', 'int');
        let newRoomInfo = roomModel.roomInfoList[roomId];
        const playerInfo = playerModel.playerInfoList[context.playerId];
        if (!!newRoomInfo) {

            // Check if IP Blocking feature enabled
            if (Config.IPBlockEnabled == 'on') {
                if (playerInfo.ipaddr == newRoomInfo.ipaddr1 || playerInfo.ipaddr == newRoomInfo.ipaddr2 || playerInfo.ipaddr == newRoomInfo.ipaddr3) {
                    // Check if player is re-joining to room
                    if (context.playerId != newRoomInfo.player1 && context.playerId != newRoomInfo.player2 && context.playerId != newRoomInfo.player3) {
                        // New player asked to join to room with same IP of any players in room
                        return;
                    }
                }
                // Check if player comes from same IP domain with other players
                let playerIpAddr = playerInfo.ipaddr.split(/\./);
                if (playerIpAddr.length > 1) {
                    playerIpAddr.pop();
                    for (otherIP of [newRoomInfo.ipaddr1, newRoomInfo.ipaddr2, newRoomInfo.ipaddr3]) {
                        if (!!otherIP) {
                            let domain = otherIP.split(/\./);
                            if (domain.length > 1) {
                                domain.pop();
                                if (playerIpAddr.join('.') != Config.WhiteIpDomain && playerIpAddr.join('.') == domain.join('.')) {
                                    return;
                                }
                            }
                        }
                    }
                }
            }
            const minJewels = newRoomInfo.point * Consts.MIN_JEWEL_MULTIPLE;

            if(newRoomInfo.category_type == 0)
            {
                if ((playerInfo.free_jewel + playerInfo.pay_jewel) < minJewels) {
                    context.socket.emit('join-room', {
                        success: Consts.STATUS_FAILED,
                        room_id: roomId,
                    });
                    return;
                }
            }
            else
            {
                if (playerInfo.pay_jewel < minJewels) {
                    context.socket.emit('join-room', {
                        success: Consts.STATUS_FAILED,
                        room_id: roomId,
                    });
                    return;
                }
            }

            // add observer as player to new room
            newRoomInfo = await roomModel.add_player_to_room(context.playerId, roomId);
            if (!!newRoomInfo) {
            // check if player's jewels are enough to join room
            // modified by hjc on 2020/04/21
                playerModel.update_player_room_info(roomId, Consts.PLAYER_GAMER,  context.playerId);

                // remove observer from his old game room
                const observers = playerModel.get_observers(context.gameRoomId);
                await iox.leaveAll(context.socket);

                game_io.to('room_' + context.gameRoomId).emit('update-room', {
                    room: {
                        id: context.gameRoomId
                    },
                    observers: observers,
                    action: 'observer'
                });
                // mobile_io.to('room_' + context.gameRoomId).emit('update-room', {
                //     room: {
                //         id: context.gameRoomId
                //     },
                //     observers: observers,
                //     action: 'observer'
                // });

                newRoomInfo.observers = playerModel.get_observers(roomId);

                game_io.to('room_' + roomId).emit('update-room', {
                    room: newRoomInfo,
                    action: 'add',
                });
                game_io.to('waitroom').emit('update-room', {
                    room: roomModel.filtered_room_info(newRoomInfo.id)
                });
                mobile_io.to('room_' + roomId).emit('update-room', {
                    room: newRoomInfo,
                    action: 'add',
                });
                mobile_io.to('waitroom').emit('update-room', {
                    room: roomModel.filtered_room_info(newRoomInfo.id)
                });

                context.gameRoomId = roomId;
                context.socket.emit('join-room', {
                    success: Consts.STATUS_SUCCESS,
                    room: newRoomInfo
                });
                context.socket.join('room_' + roomId);
                await roomModel.update_invitable_player_list();
            }
        }
    }
    catch (err) {
        handleError('invite-join-room', err, context);
    }
};

/**
 * Get a list of idle players
 * This API is called just after room created by room creator
 */
exports.getIdlePlayers = async (req, context) => {
    try {
        if (!(await validateRequest('idle-players', req, context))) {
            return;
        }
        context.socket.emit('idle-players', {
            players: playerModel.get_invite_players_list()
        });
    }
    catch (err) {
        handleError('idle-players', err, context);
    }
};


/**
 * Get a list of players online
 * This API is called just after client's socket connected
 */
exports.getPlayerList = async (req, context) => {
    try {
        if (!(await validateRequest('player-list', req, context))) {
            return;
        }
        context.socket.emit('player-list', {
            players: playerModel.playerInfoList
        });
    }
    catch (err) {
        handleError('player-list', err, context);
    }
};


/**
 * Get a list of players online
 * This API is called just after client's socket connected
 */
exports.getPlayerInfo = async (req, context) => {
    try {
        if (!(await validateRequest('player-info', req, context))) {
            return;
        }
        let playerId = parseRequest(req, 'player_id', 'id');
        let playerInfo = playerModel.playerInfoList[playerId];

        if (!playerInfo)
            playerInfo = playerModel.get_player_info(playerId);

        let tmp = Object.assign({}, playerInfo);
        delete tmp.items;

        context.socket.emit('player-info', tmp);
    }
    catch (err) {
        handleError('player-info', err, context);
    }
};

exports.updateRank = async () => {
    try {
        log.debugVerbose(TAG, `-------Start updating rank`);
        await playerModel.update_poker3_rank();
        game_io.emit('update-player-rank', await playerModel.get_players_rank());
        mobile_io.emit('update-player-rank', await playerModel.get_players_rank());
        log.debugVerbose(TAG, `-------Finished updating rank`);
    }
    catch (err) {
        log.error(TAG, `updateRank `, err);
    }
};

exports.update_poker3_players = async () => {
    try {
        await playerModel.update_players();
    }
    catch(err){
        log.error(TAG, `updatePlayers`, err);
    }
};

/**
 * Retrieve chat text and send to players
 */
exports.useItem = async (req, context) => {
    try {
        if (!(await validateRequest('use-item', req, context))) {
            return;
        }

        // //
        let roomInfo = roomModel.roomInfoList[context.gameRoomId];
        let playerId = context.playerId;
        let roomId = context.gameRoomId;

        const itemId = parseRequest(req, 'item_id', 'int');
        const targetPlayerId  = parseRequest(req, 'target_id', 'int');

        //  //
        let itemInfo = null;
        if (roomInfo.status == Consts.ROUND_PLAYING && (itemInfo = roomModel.is_available_item(playerId, itemId)) ) {
            switch (itemInfo.type) {
                case Consts.ITEM_TYPE_SOON:     // 
                        await roomModel.useItem_soon(roomId, playerId, itemId, targetPlayerId);
                    break;
                case Consts.ITEM_TYPE_TBT:     // TURN BY TURN 
                        await roomModel.useItem_turn(roomId, playerId, itemId, targetPlayerId);
                    break;
                case Consts.ITEM_TYPE_RBR:     // ROUND BY ROUND
                        await roomModel.useItem_round(roomId, playerId, itemId, targetPlayerId);
                    break;
            }
        }
        else {
            context.socket.emit('use-item', {
                action: Consts.ITEM_REJECT,  // 
                result: {room_id: roomId, player_id: playerId, item_id:  itemId}
            });
        }
    }
    catch (err) {
        handleError('use-item', err, context);
    }
};

/**
 * get the tournament rooms
 * @param req
 * @param context
 * @returns {Promise<void>}
 */
exports.getTournamentRoomList = async (req, context) => {
    try {
        if (!(await validateRequest('tournament-room-list', req, context))) {
            return;
        }

        let tournament_rooms = roomModel.sorted_room_list().filter(c => c.category_type == Consts.GAME_CATEGORY_TOURNAMENT );
        context.socket.emit('tournament-room-list', {
            rooms: tournament_rooms,
            categories: null
        });

        playerModel.secureInfoList[context.playerId].sid = context.socket.id;
    }
    catch (err) {
        handleError('tournament-room-list', err, context);
    }
}

/**
 * player send the request to join the tournament
 * @param req
 * @param context
 * @returns {Promise<void>}
 */
exports.joinTournamentRoom = async (req, context) => {
    try {

        //  //
        if (!(await validateRequest('join-tournament-room', req, context))) {
            return;
        }

        //  //
        const roomId = parseRequest(req, 'room_id', 'int');
        let roomInfo = roomModel.roomInfoList[roomId];

        // //
        if (context.gameRoomId === Consts.INVALID_ID && !!roomInfo) {
            let playerInfo = playerModel.playerInfoList[context.playerId];

            // Check if IP Blocking feature enabled //
            if (Config.IPBlockEnabled == 'on') {
                if (playerInfo.ipaddr == roomInfo.ipaddr1 || playerInfo.ipaddr == roomInfo.ipaddr2 || playerInfo.ipaddr == roomInfo.ipaddr3) {

                    // Check if player is re-joining to room //
                    if (context.playerId != roomInfo.player1 && context.playerId != roomInfo.player2 && context.playerId != roomInfo.player3) {
                        return;
                    }
                }
                // Check if player comes from same IP domain with other players
                let playerIpAddr = playerInfo.ipaddr.split(/\./);
                if (playerIpAddr.length > 1) {
                    playerIpAddr.pop();
                    for (otherIP of [roomInfo.ipaddr1, roomInfo.ipaddr2, roomInfo.ipaddr3]) {
                        if (!!otherIP) {
                            let domain = otherIP.split(/\./);
                            if (domain.length > 1) {
                                domain.pop();
                                if (playerIpAddr.join('.') != Config.WhiteIpDomain && playerIpAddr.join('.') == domain.join('.')) {
                                    return;
                                }
                            }
                        }
                    }
                }
            }


            if(roomInfo.category_type != Consts.GAME_CATEGORY_TOURNAMENT)
                return;

            // check if player can take part in the tournament //
            let tournamentId = roomInfo.tournament_id;
            if( !await gameModel.isCanTournament(context.playerId, tournamentId) ) {
                context.socket.emit('join-tournament-room', {
                    success: Consts.STATUS_FAILED,
                    room_id: roomId,
                });
                return;
            }

            // add the player into tournament-room //
            roomInfo = await roomModel.add_player_to_room(context.playerId, roomId);
            if (context.gameRoomId === Consts.INVALID_ID && !!roomInfo) {
                context.gameRoomId = roomId;

                // step 1: player is the first one, joined into this room, namely nobody is at room //
                let in_players = [roomInfo.player1, roomInfo.player2, roomInfo.player3];
                let in_players_count = 0;
                for(eachPlayer of in_players)
                    if( eachPlayer ) in_players_count ++;
                if( in_players_count == 1 ) {
                    gRoomInfo[context.gameRoomId] = 0;
                    roomModel.roomInfoList[roomId].status = Consts.ROUND_PLAYERS_JOINED;
                }

                // step 2: update the player's information //
                playerModel.update_player_room_info(roomId, Consts.PLAYER_GAMER, context.playerId);

                // step 3: player already has been in the room, waiting to rejoin the room //
                if ( (roomInfo.player1 == context.playerId && roomInfo.pstatus1 == Consts.PLAYER_REQUEST_LEAVE)
                        || (roomInfo.player2 == context.playerId && roomInfo.pstatus2 == Consts.PLAYER_REQUEST_LEAVE)
                        || (roomInfo.player3 == context.playerId && roomInfo.pstatus3 == Consts.PLAYER_REQUEST_LEAVE)
                )
                {
                    // step 1: pick up his own cards //
                    roomInfo.cnt1 = roomInfo.player1 ? roomModel.get_card_count_of_player(roomInfo.player1, roomId) : 0;
                    roomInfo.cnt2 = roomInfo.player2 ? roomModel.get_card_count_of_player(roomInfo.player2, roomId) : 0;
                    roomInfo.cnt3 = roomInfo.player3 ? roomModel.get_card_count_of_player(roomInfo.player3, roomId) : 0;

                    roomInfo.cards = roomModel.get_card_list_by_player_id(context.playerId, roomId);

                    if (roomInfo.status == 3)
                        roomInfo.hcards = roomModel.cardsInfoList[roomId].hiddenCards;

                    roomInfo.coverCards = roomModel.get_cover_cards(roomId);
                    roomInfo.lastputcards = roomModel.cardsInfoList[roomId].lastPutCards;
                    roomInfo.observers = playerModel.get_observers(roomId);

                    await iox.leaveAll(context.socket);

                    const lastTurnTime = new Date(roomInfo.turn_time).getTime();
                    const currentTime = new Date().getTime();

                    roomInfo.turn_time = roomInfo.time_limit - ((currentTime-lastTurnTime)/1000);
                    roomInfo.continueGame = true;

                    // step 2: move the player from lobby scene to board scene, while rejoining //
                    context.socket.emit('rejoin-room', {
                        room: roomInfo
                    });
                    context.socket.join('room_' + roomId);

                } else {

                    await iox.leaveAll(context.socket);

                    // step 1: inform the idle players in the waiting-room
                    game_io.to('waitroom').emit('update-room', {
                        room: roomModel.filtered_room_info(roomId),
                    });
                    mobile_io.to('waitroom').emit('update-room', {
                        room: roomModel.filtered_room_info(roomId),
                    });

                    // step 2: inform the joined player to players inside room //
                    playerInfo.tournament_jewel = roomInfo.tournament_jewel;
                    game_io.emit('join-player', playerInfo);
                    mobile_io.emit('join-player', playerInfo);

                    // step 3: move the player from lobby scene to board scene //
                    context.socket.emit('join-tournament-room', {
                        success: Consts.STATUS_SUCCESS,
                        room: roomInfo
                    });

                    // step 3: inform the updated room-state to players inside room  //
                    game_io.to('room_' + context.gameRoomId).emit('update-room', {
                        room: roomInfo,
                        action: 'add',
                    });
                    mobile_io.to('room_' + context.gameRoomId).emit('update-room', {
                        room: roomInfo,
                        action: 'add',
                    });

                    // step 4: join the player into room //
                    context.socket.join('room_' + context.gameRoomId);
                }
            }
        }
    }
    catch (err) {
        handleError('join-room', err, context);
    }
}

/**
 * Get Player Profile Information
 */
exports.getTournamentProfileInfo = async (req, context) => {
    try {
        if (!(await validateRequest('get-tournament-profile', req, context))) {
            return;
        }

        const playerId = context.playerId;
        const roomId = parseRequest(req, 'room_id', 'int');
        let round = await gameModel.get_tournament_round_in_room(playerId, roomId);
        if(round)
            playerModel.playerInfoList[context.playerId].tournament_jewel = parseInt( round.entry_money );
        context.socket.emit('get-tournament-profile', {
            profile: playerModel.playerInfoList[context.playerId]
        });
    }
    catch (err) {
        handleError('get-tournament-profile', err, context);
    }
};

exports.getChatMessage = async (req, context) => {
    try {
        if (!(await validateRequest('chat-message', req, context))) {
            return;
        }

        let chat_rows = await gameModel.get_chat_message();
        let chatMessage = {};
        for( row of chat_rows ) {
            let type = row.type;
            if( !chatMessage[type] )
                chatMessage[type] = [];
            chatMessage[type].push(row);
        }

        context.socket.emit('chat-message', {
            chatMessage: chatMessage
        });
    }
    catch (err) {
        handleError('chat-message', err, context);
    }
}