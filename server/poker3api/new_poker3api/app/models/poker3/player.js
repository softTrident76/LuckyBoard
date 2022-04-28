const Config = require('../../../config/index');
const Consts = require('../../../config/consts');
const db = require('../../common/db');
const sql = require('../../common/sql');
const util = require('../../common/util');

// Log
const log = require('../../common/log');
const TAG = 'model.player';

exports.playerInfoList = {};
exports.secureInfoList = {};

/**
 * Identify user by username & token
 */
exports.identify = async (username, token) => {
    const query = 'SELECT user_id, username, token FROM sys_token WHERE token = ? AND username = ?';
    const result = await db.exec(query, [token, username]);
    return result.shift();
};

/**
 * check validity of user
 */
exports.is_valid_token = async (token, playerId) => {
    if (exports.secureInfoList[playerId] && exports.secureInfoList[playerId].token == token)
        return true;
    return false;
};

/**get_player_info
 * Get Player Info by player_id
 */
exports.get_player_info = async (playerId) => {
    const query =
        `SELECT
                u.userid,
                u.avatar,
                u.gender,
                u.coin,
                u.jewel,
                p.level,
                p.score,
                t.token,
                u.ip_address,
                r.entry_money as tournament_jewel,
                r.round_id as tournament_round_id,
                r.round_1,r.round_2,r.round_3,r.round_4,r.round_5,r.round_6,r.round_7,r.round_8,r.round_9,r.round_10
        FROM
                sys_users u
        LEFT JOIN sys_token t ON u.id = t.user_id
        LEFT JOIN poker3_players p ON u.id = p.user_id
        LEFT JOIN (
                SELECT
                        gr.user_id AS round_user_id,
                        gr.entry_money,
                        gr.id as round_id,
                        gp.round_1,gp.round_2,gp.round_3,gp.round_4,gp.round_5,gp.round_6,gp.round_7,gp.round_8,gp.round_9,gp.round_10
                FROM
                        sys_game_tournament_round AS gr
                LEFT JOIN
                        sys_game_tournament gt ON gr.tournament_id = gt.id
                LEFT JOIN
                        sys_game_tournament_process gp ON gr.tournament_id = gp.id
                WHERE gr.status = 1 AND gt.type = 0x10
        ) r ON r.round_user_id = u.id
        WHERE u.id = ?`;

    let result = await db.exec(query, [playerId]);
    result = result.shift();

    let buf = {
        user_id: playerId,
        userid: result.userid,
        avatar: result.avatar,
        coin: parseInt(result.coin),
        jewel: parseInt(result.jewel),
        level: parseInt(result.level),
        score: parseFloat(result.score),
        tournament_round_id: result.tournament_round_id == null ?  0 : result.tournament_round_id,
        tournament_jewel: result.tournament_jewel == null ?  0 : result.tournament_jewel,
        ip_address: result.ip_address,
        tournament_round_number: 0
    };

    /* 현재 승자전이 몇번째 단계까지 진행되였는지를 평가 */
    for( let rn = 1;  rn <= 10; rn ++ ) {
        let round_number = 'round_' + rn;
        if( result[round_number] == 0 ) {
            buf.tournament_round_number = rn;
            break;
        }
    }

    if (exports.playerInfoList[playerId])
        Object.assign(exports.playerInfoList[playerId], buf);
    else
        exports.playerInfoList[playerId] = Object.assign({}, buf);

    buf = {
        token: result.token,
        score: parseFloat(result.score),
    };
    
    if (exports.secureInfoList[playerId])
        Object.assign(exports.secureInfoList[playerId], buf);
    else
        exports.secureInfoList[playerId] = Object.assign({}, buf);

    // 방상태 설정 //
    if (!exports.playerInfoList[playerId].room_id) {
        buf = {room_id: 0, status: Consts.PLAYER_IN_HOUSE};
        Object.assign(exports.playerInfoList[playerId], buf);
    }

    // 대젼경기점수를 추가한다 //
    // if (!exports.playerInfoList[playerId].tournament_jewel)
    //     exports.playerInfoList[playerId].tournament_jewel = 0;

    // 임무를 배당한다. - 방에 들어온 경우에만 //
    if( !await exports.get_player_missions(playerId, result.level) )
        await exports.create_player_missions(playerId, result.level);

    // 아이텀을 추가한다. - 방에 들어온 경우에만 //
    let items = await exports.get_player_items(playerId);
    let itemInfo = {};
    for( eachItem of items ) {
        const id = eachItem.id;
        if( !itemInfo.hasOwnProperty(id) )
            itemInfo[id] = {};

        eachItem.used = 0;
        itemInfo[id] = Object.assign({}, eachItem);
    }
    if (!exports.playerInfoList[playerId].items)
        exports.playerInfoList[playerId].items = Object.assign({}, itemInfo);

    return exports.playerInfoList[playerId];
};

exports.get_player_items = async (playerId) => {
    const query = "select s.item_count, i.id, i.type, i.name, i.icon, i.cost, i.desc, i.use_func_name, i.use_func_argument \
        from sys_game_sack s \
        left join poker3_player_items i ON i.id = s.item_id \
        where s.user_id=? and s.game_type=? and s.item_count > 0 and i.status > 0";
    return await db.exec(query, [playerId, Consts.GAME_TYPE_POKER3]);
};

exports.update_player_item = async (playerId, itemId, fields) => {
    const query = sql.update('sys_game_sack', fields, {user_id: playerId, item_id: itemId});
    await db.exec(query);
}

/**
 *
 * @param {int} roomId
 */
exports.update_player_room_info = (roomId, status, playerId) => {
    let playerInfo = exports.playerInfoList[playerId];
    if (playerInfo) {
        playerInfo.room_id = roomId;
        playerInfo.status = status;
    }
};

/**
 * Update Player record's proper field
 */
exports.update_user_fields = async (playerId, fields) => {
    const query = sql.update('sys_users', fields, {id: playerId});
    await db.exec(query);
};

exports.update_player_fields = async (playerId, fields) => {
    const query = sql.update('poker3_players', fields, {user_id: playerId});
    await db.exec(query);
};

/**
 * Get player's mission records
 */
exports.get_player_missions = async (playerId, playerLevel) => {
    const query = "select * from poker3_player_missions where user_id=? and user_level=?";
    const result = await db.exec(query, [playerId, playerLevel]);

    if( !result || result.length <= 0)
        return false;

    const mission_row = result.shift();

    // each play should have 3 missions //
    let player_mission_list = [];
    for( let i = 0; i < 3; i++ ) {
        let k = `mission${i+1}_id`;
        let h = `mission${i+1}_history_id`;
        player_mission_list.push( {
            mission_id: mission_row[k],
            mission_history_id: mission_row[h]
        })
    };

    // asssing the mission //
    let buf = {
        mission: player_mission_list
    };
    Object.assign(exports.playerInfoList[playerId], buf);

    return true;
};

/**
 * Create player's poker3 mission records
 */
exports.create_player_missions = async (playerId, playerLevel) => {
    // get the mission list for level //
    let query = "select * from poker3_mission_list where level =? order by mission_type_id";
    let result = await db.exec(query, [playerLevel]);
    if( !result || result.length == 0) return;
    let mission_type_object = {};
    for(let eachMission of result) {
        if( !mission_type_object[eachMission.mission_type_id] )
            mission_type_object[eachMission.mission_type_id] = [];

        mission_type_object[eachMission.mission_type_id].push(eachMission);
    }

    // take the random 3-types of mission //
    let player_mission_list = [];
    for( let i = 0; i < 3; i++ ) {
        player_mission_list.push( {
            mission_id: 0,
            mission_history_id: 0
        })
    }

    let index  = 0;
    for(let key in mission_type_object) {
        let pos = Math.floor( Math.random() * 10 ) % mission_type_object[key].length;
        player_mission_list[index].mission_id = mission_type_object[key][pos].id;
        index ++;
    }
    query = sql.insert('poker3_player_missions', {
        user_id: playerId,
        user_level: playerLevel,
        mission1_id: player_mission_list[0].mission_id,
        mission1_history_id: player_mission_list[0].mission_history_id,
        mission2_id: player_mission_list[1].mission_id,
        mission2_history_id: player_mission_list[1].mission_history_id,
        mission3_id: player_mission_list[2].mission_id,
        mission3_history_id: player_mission_list[2].mission_history_id,
    });

    await db.exec(query);

    // asssing the mission //
    let buf = {
        mission: player_mission_list,
    };
    Object.assign(exports.playerInfoList[playerId], buf);
};

/**
 * Update player's poker3 mission records
 */
exports.update_player_missions = async (playerId, playerLevel, missionArray) => {
    // update the database //
    let query = `update poker3_player_missions 
                    set 
                        mission1_history_id = ${missionArray[0]['mission_history_id']},
                        mission2_history_id = ${missionArray[1]['mission_history_id']},
                        mission3_history_id = ${missionArray[2]['mission_history_id']}  
                    where user_id=? AND user_level=?`;

    let result = await db.exec(query, [playerId, playerLevel]);
    return result;
};

/**
 * Get players who is free to play game
 */
exports.get_invite_players_list = () => {
    let idList = [];
    for (const playerId in exports.playerInfoList) {
        const playerInfo = exports.playerInfoList[playerId];
        if (playerInfo.status != Consts.PLAYER_GAMER && playerInfo.status != Consts.PLAYER_DISCONNECTED)
            idList.push(parseInt(playerId));            
    }
    return idList;
};

/**
 * Update poker3_score
 */
exports.update_poker3_score = async () => {
    await db.exec(`
        UPDATE sys_users,
        (
            SELECT
                player_id,
                SUM(score) AS score
            FROM
                poker3_play_log
            GROUP BY
                player_id
        ) AS log
        SET
            sys_users.score = log.score
        WHERE
            sys_users.id = log.player_id;
    `);
};

/**
 * Update poker3_rank
 */
exports.update_poker3_rank = async () => {
    await db.exec(`
        LOCK TABLES sys_users WRITE, rank_buf WRITE;

        TRUNCATE rank_buf;

        INSERT INTO rank_buf (score)
        SELECT
            poker3_score
        FROM
            sys_users
        ORDER BY
            poker3_score DESC;

        UPDATE sys_users,
        (
            SELECT
                *
            FROM
                rank_buf
        ) AS r
        SET
            sys_users.poker3_rank = r.rank
        WHERE
            sys_users.poker3_score = r.score;
        
        UNLOCK TABLES;
    `);
};

/**
 * return all players in poker3_rank
 */
exports.get_players_rank = async () => {
    const query = `
        SELECT
            sys_token.user_id,
            sys_users.poker3_rank
        FROM tbl_token
        LEFT JOIN tbl_users ON tbl_token.user_id = tbl_users.id
        WHERE tbl_token.type = ?
    `;
    
    const result = await db.exec(query, Config.GameType);
    
    for (const row of result) {
        let playerInfo = exports.playerInfoList[row.user_id];
        if (playerInfo)
            playerInfo.poker3_rank = row.poker3_rank;
    }
    return result;
};

/**
 * Drop game players from room
 */
exports.remove_gamers_from_room = (roomId) => {
    for (const playerId in exports.playerInfoList) {
        const playerInfo = exports.playerInfoList[playerId];
        if (playerInfo.room_id == roomId) {
            playerInfo.room_id = Consts.INVALID_ID;
            playerInfo.status = 1;
        }
    }
};

/**
 * Get Room Observers
 * @param {int} roomId
 */
exports.get_observers = (roomId) => {
    let observers = [];
    for (const playerId in exports.playerInfoList) {
        const playerInfo = exports.playerInfoList[playerId];
        if (playerInfo.room_id == roomId && playerInfo.status == Consts.PLAYER_OBSERVER)
            observers.push(parseInt(playerId));
    }
    return observers;
};


/**
 * Add Observer to Game Room
 */
exports.add_observer = (roomId, playerId) => {
    let playerInfo = exports.playerInfoList[playerId];
    playerInfo.room_id = roomId;
    playerInfo.status = Consts.PLAYER_OBSERVER;
};

exports.create_player_item_log = async (insert_batch_list) => {
    const query = sql.insertBatch('poker3_play_item_log', insert_batch_list);
    if (query)
        await db.exec(query);
}

/**
 * Update poker3_players table 
 */
exports.update_players = async () => {
    // const emptyQuery = `
    //     DELETE
    //     FROM
    //     poker3_players`;
    // await db.exec(emptyQuery);
    //
    // let playerInfos = [];
    //
    // for (const playerId in exports.playerInfoList) {
    //     const playerInfo = exports.playerInfoList[playerId];
    //     const secureInfo = exports.secureInfoList[playerId];
    //     log.debugVerbose(TAG, `update player info: `, playerInfo);
    //     if (!!playerInfo && !!secureInfo && playerInfo.status != Consts.PLAYER_DISCONNECTED) {
    //         playerInfos.push({
    //             user_id: playerInfo.user_id,
    //             username: playerInfo.username,
    //             realname: playerInfo.realname,
    //             token: secureInfo.token,
    //             sid: secureInfo.sid ? secureInfo.sid : '',
    //             room_id: playerInfo.room_id | 0,
    //             status: playerInfo.status
    //         });
    //     }
    // }
    //
    // const query = sql.insertBatch('poker3_players', playerInfos);
    //
    // if (query)
    //     await db.exec(query);
}