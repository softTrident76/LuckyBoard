const Config = require('../../../config/index');
const Consts = require('../../../config/consts');

const playerModel = require('./player');
const gameModel = require('./game');
const playLogModel = require('./play_log');
const util = require('../../common/util');

// Log
const log = require('../../common/log');
const TAG = 'model.room';

// roundInfo contains timer callback for pass/bet of each round in a game room
exports.roomTimers = {};
exports.roundHistories = {};
exports.roomInfoList = {};
exports.roomLocks = {};
exports.nextRoomId = Consts.START_ROOM_NUMBER;
exports.cardsInfoList = {};

// game_io, mobile_io are used in timer //
let game_io, mobile_io;

// global time variable set whenever create_room called
let lastRoomCreated = new Date();

// set game_io, mobile_io variable
exports.set_socket_io = (game, mobile) => {
    game_io = game;
    mobile_io = mobile;
};

/**
 * Generate room id
 */
generate_room_id = () => {
    // Find unused room id
    while (exports.roomInfoList[exports.nextRoomId])
        exports.nextRoomId++;
    return exports.nextRoomId++;
};

/**
 * Get the player's socket
 */
get_player_socket = (playerId) => {
    const currentPlayer = playerModel.secureInfoList[playerId];
    let playerSocket;
    if (currentPlayer.namespace == Config.GameSpace)
        playerSocket = game_io.connected[currentPlayer.sid];
    else if (currentPlayer.namespace == Config.MobileSpace)
        playerSocket = mobile_io.connected[currentPlayer.sid];
    return playerSocket;
}

/**
 * Return filter room info by keys
 */
exports.filtered_room_info = (roomId) => {
    const keys = ['id', 'category_type', 'point', 'player1', 'player2', 'player3'];
    const roomInfo = exports.roomInfoList[roomId];
    let result = {};
    for (const key of keys) {
        result[key] = roomInfo[key];
    }

    if( roomInfo.observers )
        result.observers = roomInfo.observers.length;
    else
        result.observers = 0;

    return result;
};

/**
 * Sort room list by category type and room point
 */
exports.sorted_room_list = () => {
    let buf = Object.values(exports.roomInfoList);
    let result = [];
    buf.sort((a, b) => {
        return (a.category_type - b.category_type) * 1000 + a.point - b.point;
    });
    for (const room of buf) {
        result.push({
            id: room.id,
            category_id: room.category_id,
            category_type: room.category_type,
            point: room.point,
            player1: room.player1,
            player2: room.player2,
            player3: room.player3,
            observers: room.observers
        });
    }
    return result;
};

/**
 * Create Poker3 Game Room
 * @param {Object} playerInfo : room creator - player1
 * @param {int} category_id
 */
exports.create_room = async (playerInfo, category_id) => {
    // Reset room Id everyday
    if (lastRoomCreated.getDate() != (new Date()).getDate()) {
        exports.nextRoomId = Consts.START_ROOM_NUMBER;
        lastRoomCreated = new Date();
    }
    // const ruleScore = await gameModel.get_rule_score();
    const categoryInfo = await gameModel.get_category_by_id(category_id);
    const roomInfo = {
        id: generate_room_id(),
        category_id: category_id,
        category_type: Consts.GAME_CATEGORY_NORMAL,
        fee: categoryInfo.fee,
        time_limit: categoryInfo.time_limit,
        status: Consts.ROUND_PLAYERS_JOINED, // 1 means room is created
        point: categoryInfo.unit_jewel,
        home_level: 0,
        start_pos: 0,
        turn_index: 0,
        round_count: 1,
        player1: playerInfo.user_id,
        player2: null,
        player3: null,
        ipaddr1: playerInfo.ip_address,
        pstatus1: Consts.PLAYER_NOT_READY,
        pstatus2: Consts.PLAYER_NOT_READY,
        pstatus3: Consts.PLAYER_NOT_READY,
        itemReqPool: {turn_by_turn: [], round_by_round: []},
    };
    exports.roomInfoList[roomInfo.id] = roomInfo;
    return roomInfo.id;
};

/**
 * kick the player from room
 */
exports.kick_player_to_room = async (playerid, roomid) => {
    let roomInfo = roomModel.roomInfoList[roomid];
    const playerInfo = playerModel.playerInfoList[playerId];

    // kick the player out the room //
    if (roomInfo && playerInfo) {
        await this.leave_request_player(roomid, playerid);

        // Send 'leave-room' request to client //
        let playerSocket = get_player_socket(playerid);

        if (playerSocket) {
            playerSocket.leave('room_' + playerid);
            playerSocket.emit('leave-room');
        }

        game_io.to('waitroom').emit('update-room', {
            room: roomModel.filtered_room_info(roomInfo.id)
        });
        mobile_io.to('waitroom').emit('update-room', {
            room: roomModel.filtered_room_info(roomInfo.id)
        });

        game_io.to('room_' + roomInfo.id).emit('update-room', {
            room: {
                id: roomInfo.id
            },
            action: 'leave',
            player_id: playerid
        });
        mobile_io.to('room_' + roomInfo.id).emit('update-room', {
            room: {
                id: roomInfo.id
            },
            action: 'leave',
            player_id: playerid
        });

        playerModel.update_player_room_info(null, Consts.PLAYER_IN_HOUSE, playerid);
        await roomModel.update_invitable_player_list();

    }
}
/**
 * Add player to Game Room
 */
exports.add_player_to_room = async (playerId, roomId) => {
    let roomInfo = exports.roomInfoList[roomId];
    const playerInfo = playerModel.playerInfoList[playerId];
    let updateInfo = false;

    if (!!roomInfo && !!playerInfo) {

        // check if player is already in room
        if (roomInfo.player1 == playerId || roomInfo.player2 == playerId || roomInfo.player3 == playerId) {
            // this means player is rejoining to room by refreshing or something else
            // if player rejoined to room it's status must be PLAYER_REQUEST_LEAVE
            if (roomInfo.player1 == playerId) {
                updateInfo = {
                    pstatus1: roomInfo.status >= Consts.ROUND_PLAYERS_READY ? Consts.PLAYER_SET_READY : Consts.PLAYER_NOT_READY,
                    ipaddr1: playerInfo.ip_address
                };
            } else if (roomInfo.player2 == playerId) {
                updateInfo = {
                    pstatus2: roomInfo.status >= Consts.ROUND_PLAYERS_READY ? Consts.PLAYER_SET_READY : Consts.PLAYER_NOT_READY,
                    ipaddr2: playerInfo.ip_address
                };
            } else if (roomInfo.player3 == playerId) {
                updateInfo = {
                    pstatus3: roomInfo.status >= Consts.ROUND_PLAYERS_READY ? Consts.PLAYER_SET_READY : Consts.PLAYER_NOT_READY,
                    ipaddr3: playerInfo.ip_address
                };
            }
        } else if (!roomInfo.player1) {
            // player1 is blank and player will be placed as 1st player
            updateInfo = {
                player1: playerId,
                ipaddr1: playerInfo.ip_address,
                pstatus1: Consts.PLAYER_NOT_READY,
                pstatus2: Consts.PLAYER_NOT_READY,
                pstatus3: Consts.PLAYER_NOT_READY,
                home_id: null,
                home_level: 1
            };

        } else if (!roomInfo.player2) {
            // player2 is blank and player will be placed as 2nd player
            updateInfo = {
                player2: playerId,
                ipaddr2: playerInfo.ip_address,
                pstatus1: Consts.PLAYER_NOT_READY,
                pstatus2: Consts.PLAYER_NOT_READY,
                pstatus3: Consts.PLAYER_NOT_READY,
                home_id: null,
                home_level: 1
            };
        } else if (!roomInfo.player3) {
            // player3 is blank and player will be placed as 3rd player
            updateInfo = {
                player3: playerId,
                ipaddr3: playerInfo.ip_address,
                pstatus1: Consts.PLAYER_NOT_READY,
                pstatus2: Consts.PLAYER_NOT_READY,
                pstatus3: Consts.PLAYER_NOT_READY,
                home_id: null,
                home_level: 1
            };
        }

        // 대전방식인 경우에는 대전경기점수를 반영한다. //
        if( roomInfo.category_type == Consts.GAME_CATEGORY_TOURNAMENT )
            updateInfo.tournament_jewel = roomInfo.entry_money;

        if (updateInfo) {
            Object.assign(roomInfo, updateInfo);
            return Object.assign({}, roomInfo);
        }
    }
    return false;
};

/**
 * Set ready status to player in Game Room
 */
exports.set_ready_player = async (roomId, playerId) => {
    let roomInfo = exports.roomInfoList[roomId];
    if (!!roomInfo) {
        let updateInfo = false;
        if (roomInfo.player1 == playerId) {
            updateInfo = {
                pstatus1: Consts.PLAYER_SET_READY
            };
        } else if (roomInfo.player2 == playerId) {
            updateInfo = {
                pstatus2: Consts.PLAYER_SET_READY
            };
        } else if (roomInfo.player3 == playerId) {
            updateInfo = {
                pstatus3: Consts.PLAYER_SET_READY
            };
        }
        if (!!updateInfo) {
            return Object.assign(roomInfo, updateInfo);
        }
    }
    return false;
};

/**
 * Create New Round of Game in Room
 */
exports.init_new_round = async (roomId) => {
    let roomInfo = exports.roomInfoList[roomId];

    // Clear and Start new timer for bet/pass //
    if (exports.roomTimers[roomId]) {
        clearTimeout(exports.roomTimers[roomId]);
    }

    const startPos = (roomInfo.start_pos + 1) % 3;
    const players = [roomInfo.player1, roomInfo.player2, roomInfo.player3];
    const updateInfo = {
        start_pos: startPos,
        home_id: players[(startPos + 1) % 3],
        home_level: 1,
        round_point: roomInfo.point,
        turn_id: players[startPos],
        turn_index: 0,
        turn_time: new Date(),
        status: Consts.ROUND_PLAYERS_READY
    };

    Object.assign(roomInfo, updateInfo);

    await gameModel.generate_cards_of_room(roomId);
    exports.roomTimers[roomId] = setTimeout(exports.pass_bet_timeout, roomInfo.time_limit * 1000, roomId, players[startPos]);

    game_io.to('room_' + roomId).emit('new-round', {
        round: roomInfo,
    });
    mobile_io.to('room_' + roomId).emit('new-round', {
        round: roomInfo,
    });

    const roomPlayerIds = [roomInfo.player1, roomInfo.player2, roomInfo.player3];
    for (playerId of roomPlayerIds) {
        let playerSocket = get_player_socket(playerId);

        if (playerSocket) {
            playerSocket.emit('get-cards', {
                cards: exports.get_card_list_by_player_id(playerId, roomId),
                room_id: roomId
            });
        }
    }

    for (playerId of roomPlayerIds) {
        let playerInfo = playerModel.playerInfoList[playerId];
        let items = playerInfo.items;
        for( itemId in items)
            items[itemId].used = 0;
    }
    roomInfo.itemReqPool = {turn_by_turn: [], round_by_round: []};
};

/**
 * Start Round when all players are ready and finished betting
 */
exports.start_round = async (roomId) => {
    if (exports.roomTimers[roomId]) {
        clearTimeout(exports.roomTimers[roomId]);
    }
    let roomInfo = exports.roomInfoList[roomId];
    let cardsInfo = exports.cardsInfoList[roomId];

    // Get Hidden Cards
    const hiddenCards = cardsInfo.hiddenCards;

    // Assign Hidden Cards to Home Player
    for (const card of hiddenCards) {
        cardsInfo[roomInfo.home_id].push({
            status: 1,
            card: card
        });
    }

    const updateInfo = {
        start_pos: (roomInfo.start_pos + 1) % 3,
        turn_id: roomInfo.home_id,
        turn_index: 0,
        turn_time: new Date(),
        status: Consts.ROUND_PLAYING,
    };

    Object.assign(roomInfo, updateInfo);

    // Get Player Profiles and Cards Information to store as Round History
    const playerProfiles = [
        Object.assign({}, playerModel.playerInfoList[roomInfo.player1]),
        Object.assign({}, playerModel.playerInfoList[roomInfo.player2]),
        Object.assign({}, playerModel.playerInfoList[roomInfo.player3])
    ];
    const playerCards = [
        exports.get_card_list_by_player_id(roomInfo.player1, roomId),
        exports.get_card_list_by_player_id(roomInfo.player2, roomId),
        exports.get_card_list_by_player_id(roomInfo.player3, roomId)
    ];

    // Log Round History
    exports.roundHistories[roomId] = [{
        action: 0,
        hcards: hiddenCards,
        room_id: roomId,
        category_type: roomInfo.category_type,
        round_level: roomInfo.home_level,
        round_point: roomInfo.round_point,
        players: [roomInfo.player1, roomInfo.player2, roomInfo.player3],
        turn_id: roomInfo.turn_id,
        player_profiles: playerProfiles,
        cards: playerCards
    }];

    exports.roomTimers[roomId] = setTimeout(exports.pass_turn_timeout, roomInfo.time_limit * 1000, roomId, roomInfo.turn_id);
    const res = {
        round: roomInfo,
        hcards: hiddenCards
    };
    game_io.to('room_' + roomId).emit('start-round', res);
    mobile_io.to('room_' + roomId).emit('start-round', res);
};

/**
 * Timer for bet/pass in a game room
 */
exports.pass_bet_timeout = async (roomId, playerId) => {
    let roomInfo = await exports.pass_bet(roomId, playerId);
    if (!!roomInfo) {
        const res = {
            turn_id: roomInfo.turn_id,
            next_id: roomInfo.next_id,
            turn_time: roomInfo.time_limit,
            round_point: roomInfo.round_point,
            room_id: roomId,
        };
        game_io.to('room_' + roomId).emit('pass-bet', res);
        mobile_io.to('room_' + roomId).emit('pass-bet', res);
    }
};

/**
 * Pass Bet
 */
exports.pass_bet = async (roomId, playerId) => {
    let roomInfo = exports.roomInfoList[roomId];
    if (!!roomInfo && roomInfo.status == Consts.ROUND_PLAYERS_READY && roomInfo.turn_id == playerId) {
        // "pass-bet" command can be invoked by timer or client's request
        // so timer callback should be removed asap if we get 'pass-bet' request
        if (exports.roomTimers[roomId]) {
            clearTimeout(exports.roomTimers[roomId]);
        }
        const players = [roomInfo.player1, roomInfo.player2, roomInfo.player3];
        let infoBuf = Object.assign({}, roomInfo);
        infoBuf.turn_index++;
        infoBuf.next_id = players[(infoBuf.start_pos + infoBuf.turn_index) % 3];
        infoBuf.turn_time = new Date();
        // Check if condition to start round is met
        if ( (infoBuf.turn_index == 3 && infoBuf.home_level == 1) ||
            (infoBuf.turn_index == 3 && infoBuf.home_level == 8) ||
            (infoBuf.turn_index == 3 && infoBuf.home_id == infoBuf.next_id) ||
            (infoBuf.turn_index == 4) ) {
            await exports.start_round(roomId);
        } else {
            const updateInfo = {
                turn_id: infoBuf.next_id,
                turn_index: infoBuf.turn_index,
                turn_time: infoBuf.turn_time
            };

            Object.assign(roomInfo, updateInfo);

            // Set timer for next pass-bet event handler
            exports.roomTimers[roomId] = setTimeout(exports.pass_bet_timeout, infoBuf.time_limit * 1000, roomId, infoBuf.next_id);
            return infoBuf;
        }
    }
    return false;
};

/**
 * Level up betting in game round
 */
exports.level_up = async (roomId, playerId) => {
    if (exports.roomTimers[roomId]) {
        clearTimeout(exports.roomTimers[roomId]);
    }
    let roomInfo = exports.roomInfoList[roomId];
    if (roomInfo.status == Consts.ROUND_PLAYERS_READY && roomInfo.turn_index <= 3 && roomInfo.turn_id == playerId && roomInfo.home_level < 8) {
        const players = [roomInfo.player1, roomInfo.player2, roomInfo.player3];
        let infoBuf = Object.assign({}, roomInfo);
        infoBuf.home_level *= 2;
        infoBuf.round_point = infoBuf.point * infoBuf.home_level;
        infoBuf.turn_index++;
        infoBuf.next_id = players[(infoBuf.start_pos + infoBuf.turn_index) % 3];

        const updateInfo = {
            home_id: playerId,
            home_level: infoBuf.home_level,
            round_point: infoBuf.round_point,
            turn_id: infoBuf.next_id,
            turn_index: infoBuf.turn_index
        };

        Object.assign(roomInfo, updateInfo);

        const res = {
            level: infoBuf.home_level,
            turn_id: playerId,
            next_id: infoBuf.next_id,
            turn_time: infoBuf.time_limit,
            round_point: infoBuf.round_point,
            turn_index: infoBuf.turn_index,
            room_id: roomId,
        };
        game_io.to('room_' + roomId).emit('level-up', res);
        mobile_io.to('room_' + roomId).emit('level-up', res);

        // Check if condition to start round is met
        if ( (infoBuf.turn_index == 3 && infoBuf.home_level == 1) ||
        (infoBuf.turn_index == 3 && infoBuf.home_level == 8) ||
        (infoBuf.turn_index == 4) ) {
            await exports.start_round(roomId);
        } else {
            // Set timer for next pass-bet event handler
            exports.roomTimers[roomId] = setTimeout(exports.pass_bet_timeout, infoBuf.time_limit * 1000, roomId, infoBuf.next_id);
        }
    }
};

/**
 * Timer for turn pass in a game room
 */
exports.pass_turn_timeout = async (roomId, playerId) => {
    if (exports.roomLocks[roomId]) {
        setTimeout(pass_turn_timeout, 100, roomId, playerId);
    }
    exports.roomLocks[roomId] = true;

    let roomInfo = await exports.pass_turn(roomId, playerId, Consts.NEXT_PASS);
    if (roomInfo)
    {
        if (roomInfo.turn_cnt >= Consts.PASS_TURN_LIMIT) {

            // Destroy game room
            await exports.remove_game_room_strict(roomId);
            game_io.to('room_' + roomId).emit('leave-room');
            game_io.to('waitroom').emit('remove-room', {
                room_id: roomInfo.id
            });
            mobile_io.to('room_' + roomId).emit('leave-room');
            mobile_io.to('waitroom').emit('remove-room', {
                room_id: roomInfo.id
            });

        } else {
            // Log Round History
            exports.roundHistories[roomId].push({
                action: 4,
                player_id: playerId
            });

            const res = {
                turn_id: roomInfo.turn_id,
                next_id: roomInfo.next_id,
                turn_time: playerModel.playerInfoList[roomInfo.next_id].status ? roomInfo.time_limit : Consts.TURN_LIMIT_FOR_DROPPED,
                is_cover: roomInfo.next_id == roomInfo.put_id ? true : false,
                room_id: roomId
            };
            game_io.to('room_' + roomId).emit('pass-turn', res);
            mobile_io.to('room_' + roomId).emit('pass-turn', res);
        }
    }
    exports.roomLocks[roomId] = false;
};

/**
 * pass turn for put card
 */
exports.pass_turn = async (roomId, playerId, flag, is_last=false) => {
    let roomInfo = exports.roomInfoList[roomId];
    if (roomInfo.status == Consts.ROUND_PLAYING && roomInfo.turn_id == playerId) {
        if (exports.roomTimers[roomId]) {
            clearTimeout(exports.roomTimers[roomId]);
        }

        const players = [roomInfo.player1, roomInfo.player2, roomInfo.player3];
        const homePos = players.indexOf(roomInfo.home_id);
        let infoBuf = Object.assign({}, roomInfo);

        let available_items = []; let index = 0;
        for( eachItem of roomInfo.itemReqPool.turn_by_turn ) {
            let items = playerModel.playerInfoList[eachItem.player_id].items;
            let itemInfo = items[eachItem.item_id];
            if( itemInfo.type == Consts.ITEM_TYPE_TBT) {
                switch (itemInfo.use_func_name) {
                    case 'useFreeze':
                        // let next_player_id = players[(homePos + infoBuf.turn_index + 1) % 3];
                        // if( next_player_id == eachItem.target_id )
                        //     available_items.push(eachItem);
                        available_items.push(eachItem);
                        roomInfo.itemReqPool.turn_by_turn.splice(index, 1);
                        break;
                }
            }
            index ++;
        }
        if( available_items.length > 0 ) {
            infoBuf.turn_index++;
            for( eachItem of available_items ) {
                let items = playerModel.playerInfoList[eachItem.player_id].items;
                let itemInfo = items[eachItem.item_id];
                itemInfo.used ++;
                itemInfo.item_count--;

                let playerSocket = get_player_socket(eachItem.player_id);
                if (playerSocket) {
                    playerSocket.emit('use-item', {
                        action: Consts.ITEM_USED, 
                        result: {room_id: roomId, player_id: eachItem.player_id, item_id: eachItem.item_id}
                    });
                }

                await playerModel.update_player_item(eachItem.player_id, eachItem.item_id, {
                    item_count: itemInfo.item_count
                });
            }

            let next_player_id = players[(homePos + infoBuf.turn_index) % 3];
            let lastPutCards = exports.cardsInfoList[roomId].lastPutCards;
            if( lastPutCards.playerId == next_player_id)
                exports.cardsInfoList[roomId].lastPutCards = {};
        }
        
        infoBuf.turn_index++;
        infoBuf.next_id = players[(homePos + infoBuf.turn_index) % 3];
        infoBuf.turn_time = new Date();

        if (flag == Consts.NEXT_PASS && infoBuf.next_id == infoBuf.put_id)
            exports.cardsInfoList[roomId].lastPutCards = {};

        const updateInfo = {
            turn_id: infoBuf.next_id,
            turn_index: infoBuf.turn_index,
            turn_time: infoBuf.turn_time,
            turn_cnt: infoBuf.turn_cnt + 1
        };

        Object.assign(roomInfo, updateInfo);

        // Update timer for next pass time out
        if(!is_last) {
            // If next player is dropped by connectivity issue, timer should be quicker than normal
            const timeLimit = playerModel.playerInfoList[infoBuf.next_id].status ? infoBuf.time_limit : Consts.TURN_LIMIT_FOR_DROPPED;
            exports.roomTimers[roomId] = setTimeout(exports.pass_turn_timeout, timeLimit*1000, roomId, infoBuf.next_id);
        }
        return infoBuf;
    }
    return false;
};

/**
 * Process End Round - update players info and log round history
 */
exports.end_round = async (roomId, winPlayerId, socket) => {

    let roomInfo = exports.roomInfoList[roomId];
    const isHomeWin = roomInfo.home_id == winPlayerId ? true : false;

    const player1 = playerModel.playerInfoList[roomInfo.player1]; //await playerModel.get_player_info(roomInfo.player1);
    const player2 = playerModel.playerInfoList[roomInfo.player2]; //await playerModel.get_player_info(roomInfo.player2);
    const player3 = playerModel.playerInfoList[roomInfo.player3]; //await playerModel.get_player_info(roomInfo.player3);

    if(winPlayerId == roomInfo.player1){
        const cardList1 = await exports.get_card_list_by_player_id(roomInfo.player2,roomId);
        const cardList2 = await exports.get_card_list_by_player_id(roomInfo.player3,roomId);
        if(cardList1.length == 1 && cardList2.length == 1)
            roomInfo.round_point *=2;
        else if(cardList1.length == 17 && cardList2.length == 17)
            roomInfo.round_point *=2;
    }
    if(winPlayerId == roomInfo.player2){
        const cardList1 = await exports.get_card_list_by_player_id(roomInfo.player1,roomId);
        const cardList2 = await exports.get_card_list_by_player_id(roomInfo.player3,roomId);
        if(cardList1.length == 1 && cardList2.length == 1)
            roomInfo.round_point *=2;
        else if(cardList1.length == 17 && cardList2.length == 17)
            roomInfo.round_point *=2;
    }
    if(winPlayerId == roomInfo.player3){
        const cardList1 = await exports.get_card_list_by_player_id(roomInfo.player1,roomId);
        const cardList2 = await exports.get_card_list_by_player_id(roomInfo.player2,roomId);
        if(cardList1.length == 1 && cardList2.length == 1)
            roomInfo.round_point *=2;
        else if(cardList1.length == 17 && cardList2.length == 17)
            roomInfo.round_point *=2;
    }

    let homePlayer, otherPlayer1, otherPlayer2, homeSecure, otherSecure1, otherSecure2;
    if (player1.user_id == roomInfo.home_id) {
        homePlayer = player1;
        otherPlayer1 = player2;
        otherPlayer2 = player3;
    } else if (player2.user_id == roomInfo.home_id) {
        homePlayer = player2;
        otherPlayer1 = player3;
        otherPlayer2 = player1;
    } else {
        homePlayer = player3;
        otherPlayer1 = player1;
        otherPlayer2 = player2;
    }

    homeSecure = playerModel.secureInfoList[homePlayer.user_id];
    otherSecure1 = playerModel.secureInfoList[otherPlayer1.user_id];
    otherSecure2 = playerModel.secureInfoList[otherPlayer2.user_id];
	
    const finishTime = new Date();
    let logData0 = {
        round_point: roomInfo.point,
        player_id: homePlayer.user_id,
        team: 1,
        round_level: roomInfo.home_level,
        finish_time: finishTime,
        other_players: (otherPlayer1.userid) + "," + (otherPlayer2.userid),
        other_player1: otherPlayer1.user_id,
        other_player2: otherPlayer2.user_id
    };
    let logData1 = {
        round_point: roomInfo.point,
        player_id: otherPlayer1.user_id,
        team: 2,
        round_level: 0,
        finish_time: finishTime,
        other_players: (otherPlayer2.userid) + "," + (homePlayer.userid),
        other_player1: otherPlayer2.user_id,
        other_player2: homePlayer.user_id
    };
    let logData2 = {
        round_point: roomInfo.point,
        player_id: otherPlayer2.user_id,
        team: 2,
        round_level: 0,
        finish_time: finishTime,
        other_players: (otherPlayer1.userid) + "," + (homePlayer.userid),
        other_player1: otherPlayer1.user_id,
        other_player2: homePlayer.user_id
    };

    let jewel_type = roomInfo.category_type == Consts.GAME_CATEGORY_NORMAL ? 'jewel' : 'tournament_jewel' ;
    let free_total = 0, pay_total = 0, free_fee, pay_fee, limit_point;

    if (isHomeWin) {
        limit_point = homePlayer[jewel_type];
        if(limit_point > roomInfo.round_point)
            limit_point = roomInfo.round_point;

        // if(roomInfo.category_type == 0)
        {
         
            if (otherPlayer1[jewel_type] >= limit_point) {
                free_total = limit_point;               
                otherPlayer1.point_change = { point_type: -1, free_point: limit_point, pay_point: 0 };
                otherPlayer1[jewel_type] -= limit_point;
            }
            else {
                free_total = otherPlayer1[jewel_type];
				otherPlayer1.point_change = { point_type: -1, free_point: otherPlayer1[jewel_type], pay_point: 0};
                otherPlayer1[jewel_type] = 0;
                this.leave_request_player(roomId, otherPlayer1.user_id);
				if(roomInfo.category_type == Consts.GAME_CATEGORY_TOURNAMENT) {
					this.leave_request_player(roomId, homePlayer.user_id);
					this.leave_request_player(roomId, otherPlayer2.user_id);
				}
            }
			
            if (otherPlayer2[jewel_type] >= limit_point) {
                free_total += limit_point;
                otherPlayer2.point_change = { point_type: -1, free_point: limit_point, pay_point: 0 };
                otherPlayer2[jewel_type] -= limit_point;
            }
            else {

                free_total += otherPlayer2[jewel_type];
                otherPlayer2.point_change = { point_type: -1, free_point: otherPlayer2[jewel_type], pay_point: 0};
                otherPlayer2[jewel_type] = 0;
                this.leave_request_player(roomId, otherPlayer2.user_id);
				
				if(roomInfo.category_type == Consts.GAME_CATEGORY_TOURNAMENT) {
					this.leave_request_player(roomId, homePlayer.user_id);
					this.leave_request_player(roomId, otherPlayer1.user_id);
				}
            }
        }

        free_fee = Math.round(free_total * (roomInfo.fee / roomInfo.point));

        logData0['free_fee'] = free_fee;
        logData0['pay_fee'] = 0;
        logData1['free_fee'] = 0;
        logData1['pay_fee'] = 0;
        logData2['free_fee'] = 0;
        logData2['pay_fee'] = 0;

        let bp = 10.0;
        let max_room_point = 500;
        let poker3_score_0 = 0.2 * roomInfo.point + 0.8 * roomInfo.point;
        let poker3_score_1 = 0.2 * roomInfo.point;
        let poker3_score_2 = 0.2 * roomInfo.point;

        let cards = exports.cardsInfoList[roomId][homePlayer.user_id];
        if( await gameModel.isMissionComplete(
            homePlayer.mission, cards, homePlayer.user_id, homePlayer.level, roomInfo.id)
        ){
            poker3_score_0 += 0.5 * homePlayer.level *  homePlayer.level * max_room_point / bp;
        }

        poker3_score_0 = poker3_score_0 / max_room_point;
        poker3_score_1 = poker3_score_1 / max_room_point;
        poker3_score_2 = poker3_score_2 / max_room_point;

        // bujh
        logData0['win_type'] = 1;
        logData1['win_type'] = 0;
        logData2['win_type'] = 0;

        homePlayer[jewel_type] += (free_total - free_fee);
        homePlayer.point_change = { point_type: 1, free_point: free_total - free_fee, pay_point: 0};

        logData0['score'] = poker3_score_0;
        logData1['score'] = poker3_score_1;
        logData2['score'] = poker3_score_2;

    }
    else
    {
        
        let limit_point1, limit_point2;
        // if(roomInfo.category_type == 0)
        {
            limit_point1 = otherPlayer1[jewel_type];
            limit_point2 = otherPlayer2[jewel_type];
        }

        
        if(limit_point1 > roomInfo.round_point)
            limit_point1 = roomInfo.round_point;

        if(limit_point2 > roomInfo.round_point)
            limit_point2 = roomInfo.round_point;

        limit_point = limit_point1 + limit_point2;

        
        // if(roomInfo.category_type == 0)
        {
            
            if (homePlayer[jewel_type] >= limit_point) {
                free_total = limit_point;
                homePlayer.point_change = { point_type: -1, free_point: free_total, pay_point: 0 };
                homePlayer[jewel_type] -= free_total;
            }
            
            else
            {
                
                free_total = homePlayer[jewel_type];
                homePlayer.point_change = { point_type: -1, free_point: homePlayer[jewel_type], pay_point: 0};
                homePlayer[jewel_type] = 0;
                this.leave_request_player(roomId, homePlayer.user_id);
				
				if(roomInfo.category_type == Consts.GAME_CATEGORY_TOURNAMENT) {
					this.leave_request_player(roomId, otherPlayer2.user_id);
					this.leave_request_player(roomId, otherPlayer1.user_id);
				}
            }
        }

        let other1_free = Math.floor(free_total / (limit_point1 + limit_point2) * limit_point1);
        let other1_free_fee = Math.floor(other1_free * (roomInfo.fee / roomInfo.point));

        let other2_free = free_total - other1_free;
        let other2_free_fee = Math.floor(other2_free * (roomInfo.fee / roomInfo.point));

        logData0['free_fee'] = 0;
        logData0['pay_fee'] = 0;
        logData1['free_fee'] = other1_free_fee;
        logData1['pay_fee'] = 0;
        logData2['free_fee'] = other2_free_fee;
        logData2['pay_fee'] = 0;

        otherPlayer1[jewel_type] += (other1_free - other1_free_fee);
        otherPlayer1.point_change = { point_type: 1, free_point: (other1_free - other1_free_fee), pay_point: 0 };

        otherPlayer2[jewel_type] += (other2_free - other2_free_fee);
        otherPlayer2.point_change = { point_type: 1, free_point: (other2_free - other2_free_fee), pay_point: 0 };

        let bp = 10.0;
        let max_room_point = 500;
        let poker3_score_0 = 0.2 * roomInfo.point;
        let poker3_score_1 = 0.2 * roomInfo.point + 0.8 * roomInfo.point;
        let poker3_score_2 = 0.2 * roomInfo.point + 0.8 * roomInfo.point;

        var cards = exports.cardsInfoList[roomId][otherPlayer1.user_id];
        if( await gameModel.isMissionComplete(
            otherPlayer1.mission, cards, otherPlayer1.user_id, otherPlayer1.level, roomInfo.id)
        ){
            poker3_score_0 += 0.5 * otherPlayer1.level *  otherPlayer1.level * max_room_point / bp;
        }

        var cards = exports.cardsInfoList[roomId][otherPlayer2.user_id];
        if( await gameModel.isMissionComplete(
            otherPlayer2.mission, cards, otherPlayer2.user_id, otherPlayer2.level, roomInfo.id)
        ){
            poker3_score_0 += 0.5 * otherPlayer2.level *  otherPlayer2.level * max_room_point / bp;
        }

        poker3_score_0 = poker3_score_0 / max_room_point;
        poker3_score_1 = poker3_score_1 / max_room_point;
        poker3_score_2 = poker3_score_2 / max_room_point;

        logData0['win_type'] = 0;
        logData1['win_type'] = 1;
        logData2['win_type'] = 1;

        logData0['score'] = poker3_score_0;
        logData1['score'] = poker3_score_1;
        logData2['score'] = poker3_score_2;
    }

    logData0[jewel_type] = homePlayer.point_change.point_type * homePlayer.point_change.free_point;
    logData1[jewel_type] = otherPlayer1.point_change.point_type * otherPlayer1.point_change.free_point;
    logData2[jewel_type] = otherPlayer2.point_change.point_type * otherPlayer2.point_change.free_point;

    logData0['category_type'] = roomInfo.category_type;
    logData1['category_type'] = roomInfo.category_type;
    logData2['category_type'] = roomInfo.category_type;


    homePlayer.score += logData0['score'];
    otherPlayer1.score += logData1['score'];
    otherPlayer2.score += logData2['score'];


    for (eachPlayer of [homePlayer, otherPlayer1, otherPlayer2]) {
        // let secureInfo = playerModel.secureInfoList[eachPlayer.user_id];

        let level = Math.floor( Math.sqrt(eachPlayer.score) + 1 );
        if( level > eachPlayer.level ) {
            await playerModel.create_player_missions(eachPlayer.user_id, eachPlayer.level);
        }
        eachPlayer.level = level;
    }

    logData0['player_level'] = homePlayer.level;
    logData1['player_level'] = otherPlayer1.level;
    logData2['player_level'] = otherPlayer2.level;

    logData0['room_id'] = roomInfo.id;
    logData1['room_id'] = roomInfo.id;
    logData2['room_id'] = roomInfo.id;

    logData0['round_level'] = roomInfo.round_count;
    logData1['round_level'] = roomInfo.round_count;
    logData2['round_level'] = roomInfo.round_count;

    const res = {
        players : [
            {
                user_id: homePlayer.user_id,
                jewel: homePlayer.jewel,
                coin: homePlayer.coin,
                tournament_jewel: homePlayer.tournament_jewel,
                level: homePlayer.level,
            },
            {
                user_id: otherPlayer1.user_id,
                jewel: otherPlayer1.jewel,
                coin: otherPlayer1.coin,
                tournament_jewel: otherPlayer1.tournament_jewel,
                level: otherPlayer1.level,
            },
            {
                user_id: otherPlayer2.user_id,
                jewel: otherPlayer2.jewel,
                coin: otherPlayer2.coin,
                tournament_jewel: otherPlayer2.tournament_jewel,
                level: otherPlayer2.level,
            }
        ]
    };

    game_io.emit('update-player-info', res);
    mobile_io.emit('update-player-info', res);

    res['room_id'] = roomId;
    res.players[0]['point_change'] = homePlayer.point_change;
    res.players[1]['point_change'] = otherPlayer1.point_change;
    res.players[2]['point_change'] = otherPlayer2.point_change;

    game_io.to('room_' + roomId).emit('end-round', res);
    mobile_io.to('room_' + roomId).emit('end-round', res);

    for (eachPlayer of [homePlayer, otherPlayer1, otherPlayer2])
    {
        await playerModel.update_user_fields(eachPlayer.user_id, {
            jewel: eachPlayer.jewel
        });

        await playerModel.update_player_fields(eachPlayer.user_id, {
            tournament_jewel: eachPlayer.tournament_jewel,
            score: eachPlayer.score,
            level: eachPlayer.level
        });
    }

    exports.roundHistories[roomId].push({
        action: 5,
        finish_time: finishTime,
        jewels_state: [
            {
                player_id: homePlayer.user_id,
                point_change: Object.assign({}, homePlayer.point_change),
                jewel: homePlayer.jewel,
                tournament_jewel: homePlayer.tournament_jewel
            },
            {
                player_id: otherPlayer1.user_id,
                point_change: Object.assign({}, otherPlayer1.point_change),
                jewel: otherPlayer1.jewel,
                tournament_jewel: otherPlayer1.tournament_jewel
            },
            {
                player_id: otherPlayer2.user_id,
                point_change: Object.assign({}, otherPlayer2.point_change),
                jewel: otherPlayer2.jewel,
                tournament_jewel: otherPlayer2.tournament_jewel
            }
        ]
    });

    const roundHistoryId = await playLogModel.create_round_history(JSON.stringify(exports.roundHistories[roomId]));
    exports.roundHistories[roomId] = null;

    let total_fee = 0;
    let item_log = [];
    for (playerLog of [logData0, logData1, logData2]) {
        playerLog['history_id'] = roundHistoryId;
        let playerHistoryId =  await playLogModel.create_player_play_log(playerLog);

        total_fee += playerLog[jewel_type];

        let playerInfo = playerModel.playerInfoList[playerLog.player_id];
        let mission = playerInfo.mission;
        let player_id = playerInfo.user_id;
        let player_level = playerInfo.level;
        let items = playerInfo.items;

        for( let key in items ) {
            if( items[key].used > 0 )
                item_log.push({item_id: key, play_log_id: playerHistoryId});
        }
        if(item_log.length > 0)
            await playerModel.create_player_item_log(item_log);

        if( mission && count(mission) > 0 ) {
            let missionComplete = false;
            for (let eachMission of mission) {
                if (eachMission.mission_history_id < 0) {
                    eachMission.mission_history_id = playerHistoryId;
                    missionComplete = true;
                }
            }
            if (missionComplete)
                await playerModel.update_player_missions(player_id, player_level, mission);
        }
    }

    if( roomInfo.category_type == Consts.GAME_CATEGORY_NORMAL )
        await gameModel.update_admin_jewels(total_fee);

    roomInfo.round_count += 1;
    roomInfo.status = Consts.ROUND_END;
    roomInfo.home_level = 1;
    roomInfo.round_point = roomInfo.point;

    delete homePlayer.point_change;
    delete otherPlayer1.point_change;
    delete otherPlayer2.point_change;

	if( roomInfo.category_type == Consts.GAME_CATEGORY_TOURNAMENT && roomInfo.round_count > roomInfo.max_round_count ) {
		this.leave_request_player(roomId, otherPlayer2.user_id);
		this.leave_request_player(roomId, otherPlayer1.user_id);
		this.leave_request_player(roomId, homePlayer.user_id);
	}
	
    setTimeout(exports.check_new_round, Consts.DELAY_FOR_NEW_ROUND*1000, roomId);
}


/**
 * Leave player from Game Room
 */
exports.leave_request_player = async (roomId, playerId) => {
    let roomInfo = exports.roomInfoList[roomId];
    // Gamer requested to leave room
    if (roomInfo.pstatus1 == Consts.PLAYER_NOT_READY || roomInfo.pstatus2 == Consts.PLAYER_NOT_READY || roomInfo.pstatus3 == Consts.PLAYER_NOT_READY) {
        if (roomInfo.player1 == playerId) {
            Object.assign(roomInfo, {
                player1: null,
                ipaddr1: null,
                pstatus1: Consts.PLAYER_NOT_READY,
                pstatus2: Consts.PLAYER_NOT_READY,
                pstatus3: Consts.PLAYER_NOT_READY
            });
        } else if (roomInfo.player2 == playerId) {
            Object.assign(roomInfo, {
                player2: null,
                ipaddr2: null,
                pstatus1: Consts.PLAYER_NOT_READY,
                pstatus2: Consts.PLAYER_NOT_READY,
                pstatus3: Consts.PLAYER_NOT_READY
            });
        } else if (roomInfo.player3 == playerId) {
            Object.assign(roomInfo, {
                player3: null,
                ipaddr3: null,
                pstatus1: Consts.PLAYER_NOT_READY,
                pstatus2: Consts.PLAYER_NOT_READY,
                pstatus3: Consts.PLAYER_NOT_READY
            });
        }
    } else {
        if (roomInfo.player1 == playerId) {
            Object.assign(roomInfo, {
                pstatus1: Consts.PLAYER_REQUEST_LEAVE
            });
        } else if (roomInfo.player2 == playerId) {
            Object.assign(roomInfo, {
                pstatus2: Consts.PLAYER_REQUEST_LEAVE
            });
        } else if (roomInfo.player3 == playerId) {
            Object.assign(roomInfo, {
                pstatus3: Consts.PLAYER_REQUEST_LEAVE
            });
        }
    }
};

/**
 * Leave Cancel for player
 */
exports.leave_cancel_player = async (roomId, playerId) => {
    let roomInfo = exports.roomInfoList[roomId];
    if (roomInfo.player1 == playerId || roomInfo.player2 == playerId || roomInfo.player3 == playerId) {
        let updateInfo = false;
        if (playerId == roomInfo.player1 && roomInfo.pstatus1 == Consts.PLAYER_REQUEST_LEAVE) {
            updateInfo = {
                pstatus1: roomInfo.status >= Consts.ROUND_PLAYERS_READY ? Consts.PLAYER_SET_READY : Consts.PLAYER_NOT_READY
            };
        } else if (playerId == roomInfo.player2 && roomInfo.pstatus2 == Consts.PLAYER_REQUEST_LEAVE) {
            updateInfo = {
                pstatus2: roomInfo.status >= Consts.ROUND_PLAYERS_READY ? Consts.PLAYER_SET_READY : Consts.PLAYER_NOT_READY
            };
        } else if (playerId == roomInfo.player3 && roomInfo.pstatus3 == Consts.PLAYER_REQUEST_LEAVE) {
            updateInfo = {
                pstatus3: roomInfo.status >= Consts.ROUND_PLAYERS_READY ? Consts.PLAYER_SET_READY : Consts.PLAYER_NOT_READY
            };
        }
        if (!!updateInfo) {
            return Object.assign(roomInfo, updateInfo);
        }
    }
    return false;
};

/**
 * Remove game room strictly
 */
exports.remove_game_room_strict = async (roomId) => {
    // reset poker3_player's room_id to null
    playerModel.remove_gamers_from_room(roomId);

    delete exports.roomInfoList[roomId];
    // Clear timer for a room if room is removed
    clearTimeout(exports.roomTimers[roomId]);
    delete exports.roomTimers[roomId];
    delete exports.cardsInfoList[roomId];
};

/**
 * Check New Round
 */
exports.check_new_round = async (roomId) => {
    let roomInfo = exports.roomInfoList[roomId];
    const roomPlayerIds = [roomInfo.player1, roomInfo.player2, roomInfo.player3];
    const roomPlayerStatus = [roomInfo.pstatus1, roomInfo.pstatus2, roomInfo.pstatus3];
    const jewel_type =  roomInfo.category_type == Consts.GAME_CATEGORY_NORMAL ? 'jewel' : 'tournament_jewel';
    for (playerId of roomPlayerIds) {
        let playerInfo = playerModel.playerInfoList[playerId];
        if (!!playerInfo) {
            let total_jewels = playerInfo[jewel_type];
            if (roomPlayerStatus[roomPlayerIds.indexOf(playerId)] == Consts.PLAYER_REQUEST_LEAVE    // 방탈퇴 요청이 들어온 경우에
                || total_jewels < roomInfo.point * Consts.MIN_JEWEL_MULTIPLE                        // 경기를 위한 최소보석조건을 만족하지 않는 경우
            )
            {
                // 1st case: Player asked to leave himself
                // 2nd case: Player is lack of jewel to play game
                await exports.remove_player_from_room(roomId, playerId);
                const currentPlayer = playerModel.secureInfoList[playerId];
                if (!!currentPlayer && !!currentPlayer.sid) {
                    log.debugVerbose(TAG, `[${playerInfo.username}, ${roomId}]> leave game room`);

                    // Send 'leave-room' request to client
                    let playerSocket = get_player_socket(playerId);
                    if (playerSocket) {
                        playerSocket.leave('room_' + roomId);
                        playerSocket.emit('leave-room');
                    }
                }
                else {
                    delete playerModel.playerInfoList[playerId];
                    delete playerModel.secureInfoList[playerId];
                }

                game_io.to('room_' + roomId).emit('update-room', {
                    room: {
                        id: roomId
                    },
                    action: 'leave',
                    player_id: playerId,
                });
                mobile_io.to('room_' + roomId).emit('update-room', {
                    room: {
                        id: roomId
                    },
                    action: 'leave',
                    player_id: playerId,
                });
                game_io.to('waitroom').emit('update-room', {
                    room: exports.filtered_room_info(roomInfo.id)
                });
                mobile_io.to('waitroom').emit('update-room', {
                    room: exports.filtered_room_info(roomInfo.id)
                });
            }
        }
        else {
            await exports.remove_player_from_room(roomId, playerId, false);
        }
    }

    // step 1: room's state => all players have clicked 'set ready' button  //
    if (roomInfo.pstatus1 == Consts.PLAYER_SET_READY && roomInfo.pstatus2 == Consts.PLAYER_SET_READY && roomInfo.pstatus3 == Consts.PLAYER_SET_READY) {
        await exports.init_new_round(roomId);
    }
    // step 2: room's state => all players have left already the room //
    else if (!roomInfo.player1 && !roomInfo.player2 && !roomInfo.player3) {
        // then remove that room
        await exports.remove_game_room_strict(roomId);

        game_io.to('waitroom').emit('remove-room', {
            room_id: roomInfo.id
        });
        mobile_io.to('waitroom').emit('remove-room', {
            room_id: roomInfo.id
        });
        log.debugVerbose(TAG, `[${roomId}]> remove game room becasue nobody is at room`);
    }

    // step 3: room's state => round is in tournament mode, and anyone have left off the room //
    if(roomInfo.category_type == Consts.GAME_CATEGORY_TOURNAMENT &&
        (!roomInfo.player1 || !roomInfo.player2 || !roomInfo.player3 ) )
    {
        for (playerId of roomPlayerIds) {
            let playerInfo = playerModel.playerInfoList[playerId];
            if (playerInfo) {

                /* store the process */
                const end_at = util.formatDate('Y-M-D H:i:s'), status = 2, tournament_id = roomInfo.tournament_id, user_id = playerId;
                await gameModel.update_tournament_rounds(end_at, status, playerInfo.tournament_jewel, tournament_id, user_id);

                /* store the process */
                const round_number = playerInfo.tournament_round_number;
                const round_id = playerInfo.tournament_round_id;
                await gameModel.update_tournament_process(round_number, round_id, tournament_id, user_id);

                /* remove the player from the room */
                await exports.remove_player_from_room(roomId, playerId);
                const currentPlayer = playerModel.secureInfoList[playerId];
                if (!!currentPlayer && !!currentPlayer.sid) {
                    // Send 'leave-room' request to client
                    let playerSocket = get_player_socket(playerId);
                    if (playerSocket) {
                        playerSocket.leave('room_' + roomId);
                        playerSocket.emit('leave-room');
                    }
                }
                else {
                    delete playerModel.playerInfoList[playerId];
                    delete playerModel.secureInfoList[playerId];
                }
            }
        }

        // then remove that room
        await exports.remove_game_room_strict(roomId);
        game_io.to('waitroom').emit('remove-room', {
            room_id: roomInfo.id
        });
        mobile_io.to('waitroom').emit('remove-room', {
            room_id: roomInfo.id
        });

        log.debugVerbose(TAG, `[${roomId}]> remove game room becasue anybody have left off the room`);
    }
}

/**
 * Remove player from Game Room
 * update the player's info if updatePlayerInfo is true,
 * update the just roomInfo else false.
 */
exports.remove_player_from_room = async (roomId, playerId, updatePlayerInfo = true) => {
    let roomInfo = exports.roomInfoList[roomId];
    let updateInfo = false;
    if (roomInfo.player1 == playerId) {
        updateInfo = {
            player1: null,
            ipaddr1: null,
            pstatus1: Consts.PLAYER_NOT_READY,
            pstatus2: Consts.PLAYER_NOT_READY,
            pstatus3: Consts.PLAYER_NOT_READY,
            status: Consts.ROUND_PLAYERS_JOINED
        };
    } else if (roomInfo.player2 == playerId) {
        updateInfo = {
            player2: null,
            ipaddr2: null,
            pstatus1: Consts.PLAYER_NOT_READY,
            pstatus2: Consts.PLAYER_NOT_READY,
            pstatus3: Consts.PLAYER_NOT_READY,
            status: Consts.ROUND_PLAYERS_JOINED
        };
    } else if (roomInfo.player3 == playerId) {
        updateInfo = {
            player3: null,
            ipaddr3: null,
            pstatus1: Consts.PLAYER_NOT_READY,
            pstatus2: Consts.PLAYER_NOT_READY,
            pstatus3: Consts.PLAYER_NOT_READY,
            status: Consts.ROUND_PLAYERS_JOINED
        };
    }
    if (updateInfo) {
        Object.assign(roomInfo, updateInfo);

        if (updatePlayerInfo)
            playerModel.update_player_room_info(null, Consts.PLAYER_SET_READY, playerId);
    }
};

/**
 * Get room players
 */
exports.get_room_players = async (roomId) => {
    let roomInfo = exports.roomInfoList[roomId];
    let roomPlayers = {
        player1: null,
        player2: null,
        player3: null
    };
    if (roomInfo.player1) {
        roomPlayers.player1 = playerModel.playerInfoList[roomInfo.player1];
        roomPlayers.player1.status = roomInfo.pstatus1;
    }
    if (roomInfo.player2) {
        roomPlayers.player2 = playerModel.playerInfoList[roomInfo.player2];
        roomPlayers.player2.status = roomInfo.pstatus2;
    }
    if (roomInfo.player3) {
        roomPlayers.player3 = playerModel.playerInfoList[roomInfo.player3];
        roomPlayers.player3.status = roomInfo.pstatus3;
    }
    return roomPlayers;
};

/**
 * Get list of players not in game and send it not-ready game rooms
 * It's used for invitation modal processing
 */
exports.update_invitable_player_list = async () => {
    const idlePlayers = playerModel.get_invite_players_list();
    if (!!idlePlayers) {        
        for (const roomId in exports.roomInfoList) {
            if (exports.roomInfoList[roomId].status < 2) {
                game_io.to('room_' + roomId).emit('idle-players', {
                    players: idlePlayers
                });
                // mobile_io.to('room_' + roomId).emit('idle-players', {
                //     players: idlePlayers
                // });
            }
        }
    }
};

/**
 * Get Cover Cards
 */
exports.get_cover_cards = (roomId) => {
    let cardsInfo = exports.cardsInfoList[roomId];
    let cards = [];
    for (const key in cardsInfo) {
        if (key != 'lastPutCards' && key != 'hiddenCards') {
            for (const cardInfo of cardsInfo[key]) {
                if (cardInfo.status == 2)
                    cards.push(cardInfo.card);
            }
        }
    }
}

/**
 * Update Card status to put card on the board
 */
exports.put_cards = (roomId, playerId, cards) => {
    exports.roomInfoList[roomId].turn_cnt = 0;
    let cardsInfo = exports.cardsInfoList[roomId];

    cardsInfo.lastPutCards = {
        playerId: playerId,
        cards: cards
    }

    // 이미 소비된 카드라고 표식한다. //
    for (let cardInfo of cardsInfo[playerId]) {
        if (cards.indexOf(cardInfo.card) != -1)
            cardInfo.status = 2;
    }
};

/**
 * Get Other Players Card List
 */
exports.get_other_players_cards = (roomId, playerId) => {
    let cardsInfo = exports.cardsInfoList[roomId];
    let result = {};
    for (const key in cardsInfo) {
        if (key != 'lastPutCards' && key != 'hiddenCards') {
            for (const cardInfo of cardsInfo[key]) {
                if (cardInfo.status == 1) {
                    if (result[key] == undefined)
                        result[key] = [];
                    result[key].push(cardInfo.card);
                }
            }
        }
    }
    return result;
};

/**
 * Get Card information for a player in game round
 * Get the Card Lists, which player is holding
 */
exports.get_card_list_by_player_id = (playerId, roomId) => {

    let cards = exports.cardsInfoList[roomId][playerId].filter((card) => {
        return card.status == 1;
    });
    return cards.map((eachCard) => eachCard.card);
};

/**
 * Get Card Count information for a player in a game round
 */
exports.get_card_count_of_player = (playerId, roomId) => {
    let cards = exports.cardsInfoList[roomId][playerId].filter((card) => {
        return card.status == 1;
    });
    return cards.length;
};

/**
 * Clear all cards for a game room
 */
exports.clear_cards_of_room = (roomId) => {
    delete exports.cardsInfoList[roomId];
}



exports.check_rooms = async () => {
    try {
        log.debugVerbose(TAG, `-------Start checking room`);

        for (const roomId in exports.roomInfoList) {
            let roomInfo = exports.roomInfoList[roomId];

            if (roomInfo.status >= Consts.ROUND_PLAYERS_READY)
                continue;

            let changed = false;

            const roomPlayerIds = [roomInfo.player1, roomInfo.player2, roomInfo.player3];
            for (const playerId of roomPlayerIds) {
                if (!playerId)
                    continue;
                
                const playerInfo = playerModel.playerInfoList[playerId];
                if (!playerInfo || playerInfo.room_id != roomId) {
                    await exports.remove_player_from_room(roomId, playerId, false);
                    changed = true;
                    game_io.to('room_' + roomId).emit('update-room', {
                        room: {
                            id: roomId
                        },
                        action: 'leave',
                        player_id: playerId,
                    });
                    mobile_io.to('room_' + roomId).emit('update-room', {
                        room: {
                            id: roomId
                        },
                        action: 'leave',
                        player_id: playerId,
                    });
                }
            }

            if (!changed) continue;

            if (!roomInfo.player1 && !roomInfo.player2 && !roomInfo.player3) {
                await exports.remove_game_room_strict(roomId);

                game_io.to('waitroom').emit('remove-room', {
                    room_id: roomInfo.id
                });
                mobile_io.to('waitroom').emit('remove-room', {
                    room_id: roomInfo.id
                });
            }
            else {
                game_io.to('waitroom').emit('update-room', {
                    room: exports.filtered_room_info(roomId)
                });
                mobile_io.to('waitroom').emit('update-room', {
                    room: exports.filtered_room_info(roomId)
                });
            }
        }

        log.debugVerbose(TAG, `-------Finished checking room`);
    }
    catch (err) {
        log.error(TAG, `check room `, err);
    }
};

/**
 * check if player can use the item
 * @param playerId
 * @param itemId
 */
exports.is_available_item = (playerId, itemId) => {

    const playerInfo = playerModel.playerInfoList[playerId];
    const items = playerInfo.items;
    const itemInfo = items[itemId];

    if(itemInfo) {
        // 회수제한조건을 만족하는가? 사용개수가 부합되는가를 확인
        const use_count_limit = parseInt( itemInfo.use_func_argument.split(',')[0] );
        if(itemInfo.used < use_count_limit && itemInfo.item_count > 0) {
            return itemInfo;
        }
    }
    return null;
}

/**
 * use the item immediatly and make effect on the round
 * @param playerId
 * @param itemId
 */
exports.useItem_soon = async (roomId, playerId, itemId, targetPlayerId) => {
    const playerInfo = playerModel.playerInfoList[playerId];
    const items = playerInfo.items, itemInfo = items[itemId];
    switch (itemInfo.use_func_name) {
        case 'useBinocular':
            await exports.useBinocular(roomId, playerId, itemId, targetPlayerId);
            break;
    }
}

exports.useItem_turn = async (roomId, playerId, itemId, targetPlayerId) => {
    const playerInfo = playerModel.playerInfoList[playerId];
    const items = playerInfo.items, itemInfo = items[itemId];
    switch (itemInfo.use_func_name) {
        case 'useFreeze':
            await exports.useFreeze(roomId, playerId, itemId, targetPlayerId);
            break;
    }
}

exports.useItem_round = async (roomId, playerId, itemId, targetPlayerId) => {
    const playerInfo = playerModel.playerInfoList[playerId];
    const items = playerInfo.items, itemInfo = items[itemId];
    switch (itemInfo.use_func_name) {
        case 'useTakeCard':
            await exports.useTakeCard(roomId, playerId, itemId);
            break;
    }
}

/**
 * Peek the other player's card in random position
 * @param roomId
 * @param playerId
 * @param itemId
 * @param targetPlayerId
 */
exports.useBinocular = async (roomId, playerId, itemId, targetPlayerId) => {
    let playerSocket = get_player_socket(playerId);
    if( targetPlayerId == 0 ) {
        if (playerSocket) {
            playerSocket.emit('use-item', {
                action: Consts.ITEM_REJECT,
                result: {room_id: roomId, player_id: playerId, item_id:  itemId}
            });
        }
        return;
    }

    let cards = exports.get_card_list_by_player_id(targetPlayerId, roomId);
    let pos = parseInt( Math.random() * cards.length );
    let card_value = cards[pos];

    if (playerSocket) {
        playerSocket.emit('use-item', {
            action: Consts.ITEM_USED,
            result: {room_id: roomId, player_id: playerId, item_id:  itemId, cards: card_value}
        });
    }

    let playerInfo = playerModel.playerInfoList[playerId];
    let items = playerInfo.items;
    let itemInfo = items[itemId];
    itemInfo.used = itemInfo.used + 1;
    itemInfo.item_count = itemInfo.item_count - 1;

    await playerModel.update_player_item(playerId, itemId, {
        item_count: itemInfo.item_count
    });

}

/**
 * Skip the other player's turn, Can use just one time in a round
 * @param roomId
 * @param playerId
 * @param itemId
 * @param targetPlayerId
 */
exports.useFreeze = (roomId, playerId, itemId, targetPlayerId) => {
    let roomInfo = exports.roomInfoList[roomId];

    roomInfo.itemReqPool.turn_by_turn.push( {
        item_id: itemId,
        player_id: playerId,
        target_id: targetPlayerId
    });

    let playerSocket = get_player_socket(playerId);
    if (playerSocket) {
		 playerSocket.emit('use-item', {
			action: Consts.ITEM_WAIT,  // 대기
			result: {room_id: roomId, player_id: playerId, item_id:  itemId}
		});
	}
}

/**
 * Take the promised card in next round
 * @param roomId
 * @param playerId
 * @param itemId
 * @param targetPlayerId
 */
exports.useTakeCard = (roomId, playerId, itemId, targetPlayerId=-1) => {
    let roomInfo = exports.roomInfoList[roomId];
    roomInfo.itemReqPool.round_by_round.push( {
        item_id: itemId,
        player_id: playerId
    });

    let playerSocket = get_player_socket(playerId);
    if (playerSocket) {
        playerSocket.emit('use-item', {
            action: Consts.ITEM_WAIT,  // 대기
            result: {room_id: roomId, item_id:  itemId, player_id: playerId}
        });
    }
}

/**
 * Create the tournament room
 * This is called whenever new round is hold or server is restarted
 * @param playerInfo
 */
exports.create_tournament_rooms = async (tournament_id = 0) => {

    const rows = await gameModel.get_tournament_rounds(tournament_id);
    let new_tournament_rooms = [];
    for(let eachRow of rows) {
        const roomInfo = {
            id: eachRow.room_id,
            category_id: 0,
            category_type: Consts.GAME_CATEGORY_TOURNAMENT,
            tournament_id: eachRow.tournament_id,
            fee: 0,
            time_limit: 30,
            status: Consts.ROUND_CREATED,
            point: eachRow.round_money,
            entry_money: eachRow.entry_money,
            max_round_count: eachRow.max_round_count,
            home_level: 0,
            start_pos: 0,
            turn_index: 0,
            round_count: 1,
            player1: null,
            player2: null,
            player3: null,
            ipaddr1: '',
            pstatus1: Consts.PLAYER_NOT_READY,
            pstatus2: Consts.PLAYER_NOT_READY,
            pstatus3: Consts.PLAYER_NOT_READY,
            itemReqPool: {turn_by_turn: [], round_by_round: []},
        };

        new_tournament_rooms.push(roomInfo);
        exports.roomInfoList[roomInfo.id] = roomInfo;
    }
    //console.log(new_tournament_rooms);
    return new_tournament_rooms;
}
