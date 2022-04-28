/**
 * ORIGINATED from `poker3ws` written in node v6,
 * then upgraded to v8 by ICB
 */

const Config = require('../../../config/index');
const Consts = require('../../../config/consts');
const db = require('../../common/db');
const sql = require('../../common/sql');

const roomModel = require('./room');
const playerModel = require('./player');

// Log
const log = require('../../common/log');
const TAG = 'model.game';

const poker3CardType = ["CARD_ONE", "CARD_TWO", "CARD_THREE", "CARD_THREE_ONE", "CARD_THREE_TWO", "CARD_THREE_THREE", "CARD_THREE_THREE_ONE", "CARD_THREE_THREE_ONE_ONE", "CARD_THREE_THREE_TWO", "CARD_THREE_THREE_TWO_TWO", "CARD_THREE_THREE_THREE", "CARD_FOUR_ONE", "CARD_FOUR_ONE_ONE", "CARD_FOUR_TWO", "CARD_FOUR_TWO_TWO", "CARD_RAMPAGE_ONE", "CARD_RAMPAGE_ONE_ONE", "CARD_RAMPAGE_TWO", "CARD_RAMPAGE_TWO_TWO", "CARD_ROW", "CARD_DOUBLEROW", "CARD_BOMB", "CARD_RAMPAGE", "CARD_ILLEGAL"];
const initialCards = ['3a','3s','3e','3r','4a','4s','4e','4r','5a','5s','5e','5r','6a','6s','6e','6r','7a','7s','7e','7r','8a','8s','8e','8r','9a','9s','9e','9r','10a','10s','10e','10r','Ja','Js','Je','Jr','Qa','Qs','Qe','Qr','Ka','Ks','Ke','Kr','Aa','As','Ae','Ar','2a','2s','2e','2r','0a','0s'];

// poker3_card_type //
const CARDTYPE_SINGLE = 1;
const CARDTYPE_DOUBLE = 2;
const CARDTYPE_TRIPLE = 3;
const CARDTYPE_BOMB = 4;
const CARDTYPE_SEQUENCE = 5;
const CARDTYPE_RAMPAGE = 6;

const poker3CardValue = [
    3,3,3,3,
    4,4,4,4,
    5,5,5,5,
    6,6,6,6,
    7,7,7,7,
    8,8,8,8,
    9,9,9,9,
    10,10,10,10,
    11,11,11,11,  // J
    12,12,12,12,  // Q
    13,13,13,13,  // K
    14,14,14,14,  // A
    15,15,15,15,  // 2
    16,17
];

compare_cards = (e, t) => {
    return t-e;
};

/**
 * check if cards are sequence, i.e "34567", "10JQKA"
 */
is_single_line = (cards) => {
    if (poker3CardValue[cards[0]] > 14)
        return false;
    for (let i = 0; i < cards.length - 1; i++) {
        if (poker3CardValue[cards[i]] != poker3CardValue[cards[i + 1]] + 1)
            return false;
    }
    return true;
};

/**
 * check if cards are sequence of double cards, i.e "334455", "JJQQKKAA"
 */
is_double_line = (cards) => {
    let buf = [];
    for (let i = 0; i < cards.length; i += 2) {
        if (poker3CardValue[cards[i]] != poker3CardValue[cards[i+1]])
            return false;
        buf.push(cards[i]);
    }
    return is_single_line(buf);
};

count_double = (cards) => {
    let t = 0;
    for (let i = 0; i < cards.length - 1; i++) {
        if (poker3CardValue[cards[i]] == poker3CardValue[cards[i + 1]]) {
            t++;
        }
    }
    return t;
};

count_tripple = (cards) => {
    let t = 0;
    for (let i = 0; i < cards.length - 2; i++) {
        if (poker3CardValue[cards[i]] == poker3CardValue[cards[i + 1]] && poker3CardValue[cards[i + 1]] == poker3CardValue[cards[i + 2]]) {
            t++;
        }
    }
    return t;
}

get_tripple_info = (cards) => {
    let trips = {count: 0, index: []};
    for (let i=0; i<cards.length-2; i++) {
        if (poker3CardValue[cards[i]] == poker3CardValue[cards[i+1]] && poker3CardValue[cards[i+1]]==poker3CardValue[cards[i+2]]) {
            trips.index[trips.count] = i;
            trips.count++;
        }
    }
    if (trips.count == 1) {
        return trips;
    }
    else if (trips.count == 2 && poker3CardValue[cards[trips.index[0]]]==(poker3CardValue[cards[trips.index[1]]]+1)) {
        return trips;
    }
    else if (trips.count == 3 && poker3CardValue[cards[trips.index[0]]]==(poker3CardValue[cards[trips.index[1]]]+1) && poker3CardValue[cards[trips.index[1]]]==(poker3CardValue[cards[trips.index[2]]] + 1)) {
        return trips;
    }
    return {count: 0, index: []};
}

get_ultra_info = (cards) => {
    let t = {count: 0, index: []};
    for(let i=0; i<cards.length-3; i++) {
        if (poker3CardValue[cards[i]]==poker3CardValue[cards[i+1]] && poker3CardValue[cards[i+1]]==poker3CardValue[cards[i+2]] && poker3CardValue[cards[i+2]]==poker3CardValue[cards[i+3]]) {
            t.index[t.count] = i;
            t.count++;
        }
    }
    return t;
}

is_rampage = (cards) => {
    return cards[0] == 53 && cards[1] == 52 ? true : false;
}

convertCardNumber = (card) => {
    if (card == undefined || card == null)
        return 0;

    if (card == '0a') { return 16; }
    if (card == '0s') { return 17; }
    switch (card = card.substr(card.length-1, 1)) {
        case 'J': return 11;
        case 'Q': return 12;
        case 'K': return 13;
        case 'A': return 14;
        case '2': return 15;
        default: return parseInt(card);
    }
    return 0;
}

/**
 * Shuffles array in place. ES6 version
 * @param {Array} a items An array containing the items.
 */
shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * Initialize whole game context
 */
exports.initGame = async () => {
    // To reset clients on server startup
    await db.exec('DELETE FROM sys_token WHERE type=?', Config.GameType);
};


/**
 * Check if cards are valid to throw to board
 */
exports.check_card_type = (cards, length) => {
    cards.sort(compare_cards);
    let res = "CARD_ILLEGAL", three_cards = get_tripple_info(cards), four_cards = get_ultra_info(cards);
    switch (length) {
        case 1:
            res = "CARD_ONE";
            break;
        case 2:
            res = count_double(cards) ? "CARD_TWO" : is_rampage(cards) ? "CARD_RAMPAGE" : "CARD_ILLEGAL";
            break;
        case 3:
            res = three_cards.count == 1 ? "CARD_THREE" : is_rampage(cards) ? "CARD_RAMPAGE_ONE" : "CARD_ILLEGAL";
            break;
        case 4:
            res = four_cards.count == 1 ? "CARD_BOMB" : three_cards.count == 1 ? "CARD_THREE_ONE" : count_double(cards)==0 && is_rampage(cards) ? "CARD_RAMPAGE_ONE_ONE" : (count_double(cards)==1) && is_rampage(cards) ? "CARD_RAMPAGE_TWO" : "CARD_ILLEGAL";
            break;
        case 5:
            res = is_single_line(cards) ? "CARD_ROW" : four_cards.count==1 ? "CARD_FOUR_ONE" : three_cards.count==1 && count_double(cards)==3 ? "CARD_THREE_TWO" : "CARD_ILLEGAL";
            break;
        case 6:
            res = is_single_line(cards) ? "CARD_ROW" : is_double_line(cards) ? "CARD_DOUBLEROW" : !is_rampage(cards) && four_cards.count==1 && count_double(cards)==3 ? "CARD_FOUR_ONE_ONE" : four_cards.count==1 && count_double(cards)==4 ? "CARD_FOUR_TWO" : three_cards.count==2 ? "CARD_THREE_THREE" : is_rampage(cards) && count_double(cards)==2 ? "CARD_RAMPAGE_TWO_TWO" : "CARD_ILLEGAL";
            break;
        case 7:
            res = is_single_line(cards) ? "CARD_ROW" : four_cards.count==0 && (poker3CardValue[cards[0]] != 15 || poker3CardValue[cards[0]] != poker3CardValue[cards[1]]) && three_cards.count==2 ? "CARD_THREE_THREE_ONE" : "CARD_ILLEGAL";
            break;
        case 8:
            res = is_single_line(cards) ? "CARD_ROW" : is_double_line(cards) ? "CARD_DOUBLEROW" : four_cards.count==0 && poker3CardValue[cards[three_cards.index[0]]]!=15 && !is_rampage(cards) && three_cards.count==2 && count_double(cards)==4 ? "CARD_THREE_THREE_ONE_ONE" : four_cards.count==0 && poker3CardValue[cards[three_cards.index[0]]]!=15 && three_cards.count==2 && count_double(cards)==5 ? "CARD_THREE_THREE_TWO" : four_cards.count==1 && count_tripple(cards)==2 && count_double(cards)==5 ? "CARD_FOUR_TWO_TWO" : "CARD_ILLEGAL";
            break;
        case 9:
            res = is_single_line(cards) ? "CARD_ROW" : four_cards.count==0 && poker3CardValue[cards[three_cards.index[0]]]!=15 && three_cards.count==3 ? "CARD_THREE_THREE_THREE" : "CARD_ILLEGAL";
            break;
        case 10:
            res = is_single_line(cards) ? "CARD_ROW" : is_double_line(cards) ? "CARD_DOUBLEROW" : four_cards.count==0 && poker3CardValue[cards[three_cards.index[0]]]!=15 && three_cards.count==2 && count_double(cards)==6 ? "CARD_THREE_THREE_TWO_TWO" : "CARD_ILLEGAL";
            break;
        case 11:
            res = is_single_line(cards) ? "CARD_ROW" : "CARD_ILLEGAL";
            break;
        case 12:
            res = is_single_line(cards) ? "CARD_ROW" : is_double_line(cards) ? "CARD_DOUBLEROW" : "CARD_ILLEGAL";
            break;
        case 14:
        case 16:
        case 18:
        case 20:
            res = is_double_line(cards) ? "CARD_DOUBLEROW" : "CARD_ILLEGAL";
            break;
        default:
            res = "CARD_ILLEGAL"
    }
    return res;
};


exports.is_correct_rule = (e, cardType, o) => {
    if (o.length == 0) {
        return true;
    }
    let t = 0;
    let otherCardsType = poker3CardType.indexOf(exports.check_card_type(o, o.length)) + 1;
    let otherCardsCount = o.length;
    let s = get_tripple_info(e), i = get_ultra_info(e);
    let lt = get_tripple_info(o), lu = get_ultra_info(o);

    switch (otherCardsType) {
        case 1:
            "CARD_BOMB" == cardType || "CARD_RAMPAGE" == cardType ? t = 1 : "CARD_ONE" == cardType && poker3CardValue[e[e.length - 1]] > poker3CardValue[o[o.length - 1]] && (t = 1);
            break;
        case 2:
            "CARD_BOMB" == cardType || "CARD_RAMPAGE" == cardType ? t = 1 : "CARD_TWO" == cardType && poker3CardValue[e[e.length - 1]] > poker3CardValue[o[o.length - 1]] && (t = 1);
            break;
        case 3:
            "CARD_BOMB" == cardType || "CARD_RAMPAGE" == cardType ? t = 1 : "CARD_THREE" == cardType && poker3CardValue[e[e.length - 1]] > poker3CardValue[o[o.length - 1]] && (t = 1);
            break;
        case 4:
            "CARD_BOMB" == cardType || "CARD_RAMPAGE" == cardType ? t = 1 : "CARD_THREE_ONE" == cardType && poker3CardValue[e[s.index[0]]] > poker3CardValue[o[lt.index[0]]] && (t = 1);
            break;
        case 5:
            "CARD_BOMB" == cardType || "CARD_RAMPAGE" == cardType ? t = 1 : "CARD_THREE_TWO" == cardType && poker3CardValue[e[s.index[0]]] > poker3CardValue[o[lt.index[0]]] && (t = 1);
            break;
        case 6:
            "CARD_BOMB" == cardType || "CARD_RAMPAGE" == cardType ? t = 1 : "CARD_THREE_THREE" == cardType && poker3CardValue[e[s.index[0]]] > poker3CardValue[o[lt.index[0]]] && (t = 1);
            break;
        case 7:
            "CARD_BOMB" == cardType || "CARD_RAMPAGE" == cardType ? t = 1 : "CARD_THREE_THREE_ONE" == cardType && poker3CardValue[e[s.index[0]]] > poker3CardValue[o[lt.index[0]]] && (t = 1);
            break;
        case 8:
            "CARD_BOMB" == cardType || "CARD_RAMPAGE" == cardType ? t = 1 : "CARD_THREE_THREE_ONE_ONE" == cardType && poker3CardValue[e[s.index[0]]] > poker3CardValue[o[lt.index[0]]] && (t = 1);
            break;
        case 9:
            "CARD_BOMB" == cardType || "CARD_RAMPAGE" == cardType ? t = 1 : "CARD_THREE_THREE_TWO" == cardType && poker3CardValue[e[s.index[0]]] > poker3CardValue[o[lt.index[0]]] && (t = 1);
            break;
        case 10:
            "CARD_BOMB" == cardType || "CARD_RAMPAGE" == cardType ? t = 1 : "CARD_THREE_THREE_TWO_TWO" == cardType && poker3CardValue[e[s.index[0]]] > poker3CardValue[o[lt.index[0]]] && (t = 1);
            break;
        case 11:
            "CARD_BOMB" == cardType || "CARD_RAMPAGE" == cardType ? t = 1 : (cardType == "CARD_THREE_THREE_THREE") && poker3CardValue[e[s.index[0]]] > poker3CardValue[o[lt.index[0]]] && (t = 1);
            break;
        case 12:
            "CARD_BOMB" == cardType ? t = 1 : "CARD_RAMPAGE" == cardType ? t = 1 : "CARD_FOUR_ONE" == cardType && poker3CardValue[e[i.index]] > poker3CardValue[o[lu.index]] && (t = 1);
            break;
        case 13:
            "CARD_BOMB" == cardType ? t = 1 : "CARD_RAMPAGE" == cardType ? t = 1 : "CARD_FOUR_ONE_ONE" == cardType && poker3CardValue[e[i.index]] > poker3CardValue[o[lu.index]] && (t = 1);
            break;
        case 14:
            "CARD_BOMB" == cardType ? t = 1 : "CARD_RAMPAGE" == cardType ? t = 1 : "CARD_FOUR_TWO" == cardType && poker3CardValue[e[i.index]] > poker3CardValue[o[lu.index]] && (t = 1);
            break;
        case 15:
            "CARD_BOMB" == cardType ? t = 1 : "CARD_RAMPAGE" == cardType ? t = 1 : "CARD_FOUR_TWO_TWO" == cardType && poker3CardValue[e[i.index]] > poker3CardValue[o[lu.index]] && (t = 1);
            break;
        case 16:
            "CARD_BOMB" == cardType && (t = 1);
            break;
        case 17:
            "CARD_BOMB" == cardType && (t = 1);
            break;
        case 18:
            "CARD_BOMB" == cardType && (t = 1);
            break;
        case 19:
            "CARD_BOMB" == cardType && (t = 1);
            break;
        case 20:
            "CARD_BOMB" == cardType || "CARD_RAMPAGE" == cardType ? t = 1 : "CARD_ROW" == cardType && e.length == otherCardsCount && poker3CardValue[e[e.length - 1]] > poker3CardValue[o[o.length - 1]] && (t = 1);
            break;
        case 21:
            "CARD_BOMB" == cardType || "CARD_RAMPAGE" == cardType ? t = 1 : "CARD_DOUBLEROW" == cardType && e.length == otherCardsCount && poker3CardValue[e[e.length - 1]] > poker3CardValue[o[o.length - 1]] && (t = 1);
            break;
        case 22:
            "CARD_RAMPAGE" == cardType ? t = 1 : "CARD_BOMB" == cardType && poker3CardValue[e[e.length - 1]] > poker3CardValue[o[o.length - 1]] && (t = 1);
            break;
        case 23:
            t = 0
    }
    return t;
}

// /**
//  * Get Score calculation base data for Poker3
//  */
// exports.get_rule_score = async () => {
//     const query = "SELECT * FROM poker3_rule_score";
//     const result = await db.exec(query);
//     return result.shift();
// };

// /***
//  * Get Player Id to UserID
//  */
// exports.get_cghId = async () => {
//     const query = "SELECT id FROM tbl_users WHERE userid = ?";
//     const result = await db.exec(query, ['cgh0510']);
//     return result.shift();
// }
//
// exports.get_kcrId = async () => {
//     const query = "SELECT id FROM tbl_users WHERE userid = ?";
//     const result = await db.exec(query, ['kcr87703']);
//     return result.shift();
// }

/**
 * Get Category by category_id
 */
exports.get_category_by_id = async (category_id) => {
    const query = "SELECT * FROM poker3_category WHERE id = ?";
    const result = await db.exec(query, [category_id]);
    return result.shift();
}

/**
 * Get All Poker3 Categories
 */
exports.get_all_categories = async () => {
    const query = "SELECT id, category_name, unit_jewel, category_type  FROM poker3_category where is_open = '1'";
    const result = await db.exec(query, []);
    return result;
}


/**
 * Mix 54 cards and slice them for 3 players
 */
exports.mix_cards = (room_point, category_type) => {
    let cards = new Array(54);
    let mcards = new Array(54);

    for ( i = 0; i < 54; i++) {
        cards[i] = 53-i;
        mcards[i] = 0;
    }

    const flag = Math.round(Math.random() * 100);
    if(category_type == 0) {
        if(room_point <= 10) {
            if(flag < 90) room_point2 = 50;
            else room_point2 = 100;

        } else if(room_point <= 50) {
            if(flag < 85) room_point2 = 50;
            else room_point2 = 100;
        } else {
            if(flag < 80) room_point2 = 50;
            else room_point2 = 100;
        }
    } else {
        if(room_point <= 10) {
            if(flag < 95) room_point2 = 50;
            else room_point2 = 100;
        } else if(room_point <= 50) {
            if(flag < 90) room_point2 = 50;
            else room_point2 = 100;
        } else {
            if(flag < 85) room_point2 = 50;
            else room_point2 = 100;
        }
    }
    room_point = room_point2;

    let pos = 0;

    if(room_point <= 50) {
        for (i=0; i<54; i++) {
            let delta = Math.round(Math.random() * cards.length);
            pos = delta % cards.length;

            mcards[i] = cards[pos];
            cards.splice(pos, 1);
        }
    }
    else {

        for (i=0; i<54; i+=2) {
            let delta = Math.round(Math.random() * (cards.length-2));
            pos = delta % cards.length;

            if(i == 52) pos = 0;

            mcards[i] = cards[pos];
            mcards[i+1] = cards[pos+1];

            cards.splice(pos, 2);
        }
    }
    return mcards;
}

/**
 * Generate the cards correspoinding the picking rule
 * param {cards_house}: array of initial poker3CardValue
 * param {cars_cond}: record in poker3_player_init_card, namely condition
 */
exports.give_init_cards = (cards_cond, cards_house) => {

    let res = [];
    let card_type = parseInt(cards_cond.card_type_id);

    if( card_type == CARDTYPE_RAMPAGE ) {
        if( cards_house[52] > 0 && cards_house[53] > 0 ) {
            res.push( {status: 1, card: 52});
            res.push( {status: 1, card: 53});
            cards_house[52] = 0; cards_house[53] = 0;
        }
    }
    else if (card_type == CARDTYPE_SEQUENCE) {
        let card_number  = convertCardNumber(cards_cond.card_value), card_count = parseInt(cards_cond.card_count);

        if( !card_number || isNaN(card_number) ) return res;
        if( !card_count || isNaN(card_count) ) return res;

        let  pos = -1;
        cards_house.some((element, index) => {
            if( element == card_number ) {
                pos = index;
                return true;
            }
        });
        if( pos < 0 ) return res;

        if( card_count < 5 ) return res;
        if( pos + card_count * 4 > 51 ) return res;

        let sequence_group_array = [];
        for( let s = pos, i = 0; i < card_count;  i++) {
            let card_house_group = cards_house.slice(s, s+4);

            let card_pos_group = [];
            card_house_group.some((element, index) => {
                if( element > 0 ) card_pos_group.push( s + index );
            });

            if( card_pos_group.length == 0 ) return res;

            sequence_group_array.push(card_pos_group);
            s += 4;
        }

        sequence_group_array.some((group, index) => {
            let p = Math.floor(Math.random() * 10) % group.length;
            let t = group[p];
            res.push( {
                status: 1,
                card: t
            });
            cards_house[t] = 0;
        });
    }
    else
    {
        let card_number = convertCardNumber(cards_cond.card_value), card_count = parseInt(cards_cond.card_count);
        let card_pos_list = [];

        if( !card_number || isNaN(card_number) ) return res;
        if( !card_count || isNaN(card_count) ) return res;

        cards_house.forEach((element, index) => {
            if( element == card_number )
               card_pos_list.push(index);
        });

        if( card_pos_list.length < card_count ) return res;

        for( var i = 0; i < card_count; i++ ) {
            let p = Math.floor(Math.random() * 10) % card_pos_list.length;
            let t = card_pos_list[p];
            res.push( {
                status: 1,
                card: t
            });
            cards_house[t] = 0;
            card_pos_list.splice(p, 1);
        }
    }
    return res;
}

/**
 * Generate new cards, when starting the round
 */
exports.generate_cards_of_room = async (roomId) => {
    const roomInfo = roomModel.roomInfoList[roomId];

    roomModel.cardsInfoList[roomId] = {};

    let cardsInfo = roomModel.cardsInfoList[roomId];
    let player1, player2, player3;

    player1 = roomInfo.player1;
    player2 = roomInfo.player2;
    player3 = roomInfo.player3;

    const playerInfo1 = playerModel.playerInfoList[player1];
    const playerInfo2 = playerModel.playerInfoList[player2];
    const playerInfo3 = playerModel.playerInfoList[player3];

    let cardsHouse = Object.assign([], poker3CardValue);
    let level_sorted_players = [playerInfo1, playerInfo2, playerInfo3].sort((a, b) => {
        return parseInt(a.poker3_level) - parseInt(b.poker3_level);
    });

    cardsInfo[player1] = [];
    cardsInfo[player2] = [];
    cardsInfo[player3] = [];

    var get_item_info = (item_in_pool) => {
        let items = playerModel.playerInfoList[item_in_pool.player_id].items;
        return items[eachItem.item_id];
    }

    let item_RBR_list = [];
    for( eachItem of roomInfo.itemReqPool.round_by_round ) {
        let itemInfo = get_item_info(eachItem)
        if( itemInfo.type == Consts.ITEM_TYPE_RBR )
            item_RBR_list.push(eachItem);
    }

    item_RBR_list.sort((a, b) => {
        let a_playerInfo = playerModel.playerInfoList[a.player_id], b_playerInfo = playerModel.playerInfoList[b.player_id];
        let a_itemInfo = get_item_info(a), b_itemInfo = get_item_info(b);
        return (parseInt(a_itemInfo.type) - parseInt(b_itemInfo.type)) * 1000 + (a_playerInfo.poker3_level - b_playerInfo.poker3_level);
    });

    for(let eachItem of item_RBR_list ) {
        let itemInfo = get_item_info(eachItem);
        switch (itemInfo.use_func_name) {
            case 'useTakeCard':
                let player_id = eachItem.player_id;
                let item_id = eachItem.item_id;
                let playerSocket = get_player_socket(player_id);
                let argument = itemInfo.use_func_argument.split(',');
                let cardCond = {
                    card_type_id: parseInt(argument[1]),
                    card_value: argument[2],
                    card_count: parseInt(argument[3])
                };
                let cardInfo_array = exports.give_init_cards(cardCond, cardsHouse);

                if(cardInfo_array.length > 0) {
                    cardsInfo[player_id] = cardsInfo[player_id].concat(cardInfo_array);
					
                    if(playerSocket) {
                        playerSocket.emit('use-item', {
                            action: Consts.ITEM_USED, 
                            result: { item_id: item_id, room_id: roomId, player_id: player_id}
                        });
                    }
					
                    let playerInfo = playerModel.playerInfoList[player_id];
                    let items = playerInfo.items, updateItemInfo = items[item_id];
                    updateItemInfo.used = updateItemInfo.used + 1;
                    updateItemInfo.item_count = updateItemInfo.item_count - 1;

                    await playerModel.update_player_item(player_id, item_id, {
                        item_count: updateItemInfo.item_count
                    });
                }
                else {
                    if(playerSocket) {
                        playerSocket.emit('use-item', {
                            action: Consts.ITEM_REJECT, 
                            result: { item_id: item_id, room_id: roomId, player_id: player_id}
                        });
                    }
                }
                break;
        }
    }

    let total_init_cards = [];
    for (let eachPlayer of level_sorted_players) {
        let player_init_cards = await exports.get_round_init_cards(eachPlayer.user_id);
        if(player_init_cards && player_init_cards.length > 0)
            total_init_cards = total_init_cards.concat(player_init_cards);
    }

    for(let eachInit of total_init_cards ) {
        let cardInfo_array = exports.give_init_cards(eachInit, cardsHouse);
        let player = parseInt(eachInit.user_id);
        if(cardInfo_array.length > 0)
            cardsInfo[player] = cardsInfo[player].concat(cardInfo_array);
    }

    // shuffle the rest, remained afterlet total_init_cards = []; initial //
    let rest_cards_pos = [];
    cardsHouse.forEach((element, index) => {
        if( element != 0 )
            rest_cards_pos.push(index);
    });
    rest_cards_pos = shuffle(rest_cards_pos);

    for(eachInfo of [cardsInfo[player1], cardsInfo[player2], cardsInfo[player3]]) {
        for( let i = eachInfo.length; i < 17; i ++ ) {
            eachInfo.push({
                status: 1,
                card: rest_cards_pos.shift()
            });
        }
    }

    cardsInfo.hiddenCards = rest_cards_pos;
    cardsInfo.lastPutCards = {};
}

/**
 * Simple function to return card_type priority
 */
exports.get_card_type_value = (card_type) => {
    return poker3CardType.indexOf(card_type) + 1;
}

/**
 * Update Admin's Free/Paid Fees after every round
 */
exports.update_admin_jewels = async (jewels) => {
    const query = "update sys_admin_jewel set admin_jewel=admin_jewel+? where id=1";
    await db.exec(query, [jewels]);
}

/**
 * Get the player's initial cards, just when begining the round
 */
exports.get_round_init_cards = async (playerId) => {
    const query = `SELECT * FROM poker3_player_init_card WHERE user_id = ?`;
    let result = await db.exec(query, [playerId]);
    return result;
}

/**
 * Check if player has complete the mission
 * @param mission: array of mission, each player gets the 3 missions(mission1, mission2, mission) for a level
 * @param cards: array of holding cards
 * @param playerId:
 * @param playerLevel
 * @returns {Promise<number>}
 */
exports.isMissionComplete = async (mission, cards, playerId, playerLevel, roomId) => {
    if( !mission || count(mission) == 0 ) return 0;

    let incomplete_id_list = [];
    for(let eachMission of mission) {
        if( eachMission.mission_history_id == 0)
            incomplete_id_list.push(eachMission.mission_id);
    }

    if(incomplete_id_list.length == 0)
        return 0;

    let mission_detail_list = await exports.get_mission_detail(incomplete_id_list);
    let ret = 0;
    for(let eachDetail of mission_detail_list) {
        let ret = await exports.check_mission_complete(cards, playerId, playerLevel, roomId, eachDetail);
        if(ret) {
            switch (eachDetail.id) {
                case mission[0].mission_id: mission[0].mission_history_id = -1; break;
                case mission[1].mission_id: mission[1].mission_history_id = -1; break;
                case mission[2].mission_id: mission[2].mission_history_id = -1; break;
            }
        }
    }
    return ret;
}

exports.get_mission_detail = async (incomplete_mission_id_list) => {
    const query = ` SELECT m.id, m.argument, t.mission_func_name 
                    FROM poker3_mission_list m
                    LEFT JOIN poker3_mission_type t ON m.mission_type_id = t.id 
                    WHERE m.id in ( ${incomplete_mission_id_list.join() }) AND m.status > 0`;
    let result = await db.exec(query);
    return result;
}

exports.check_mission_complete = async (cards, playerId, playerLevel, roomId, missionDetail) => {

    let card_value_list = [];
    for( eachCard of cards ) {
        card_value_list.push(initialCards[eachCard.card]);
    }

    // var query = 'SELECT is_get_function()';
    // var result = await db.exec(query);

    var query = `SELECT ${missionDetail.mission_func_name} 
                        (?, ?, ?, ?, ?) as mission_complete`;

    let result = await db.exec(query, [card_value_list.join(), playerId, playerLevel, roomId, missionDetail.argument]);
    result = result.shift();

    return result['mission_complete'];
}


exports.get_tournament_rounds = async (tournament_id) => {
    let query;
    if( tournament_id > 0 )
        query = `SELECT r.room_id, r.tournament_id, r.entry_money, r.max_round_count, r.round_money  
                    FROM sys_game_tournament_round r 
                    LEFT JOIN sys_game_tournament t ON r.tournament_id = r.id 
                    WHERE r.status = 1 AND r.tournament_id = ${tournament_id}  
                    GROUP BY r.room_id `;
    else
        query = `SELECT r.room_id, r.tournament_id, r.entry_money, r.max_round_count, r.round_money 
                    FROM sys_game_tournament_round r 
                    LEFT JOIN sys_game_tournament t ON r.tournament_id = r.id 
                    WHERE r.status = 1  
                    GROUP BY r.room_id `;
    let result = await db.exec(query);
    return result;
}

exports.update_tournament_rounds = async (end_at, status, tournament_jewel, tournament_id, user_id) => {
    const query = `UPDATE sys_game_tournament_round 
                    SET end_at='${end_at}', status = ${status}, tournament_jewel = ${tournament_jewel} 
                    WHERE tournament_id = ${tournament_id} AND user_id = ${user_id}`;
    let result = await db.exec(query);
    return result;
}

exports.update_tournament_process = async (round_number, round_id, tournament_id, user_id) => {
    const  query = `UPDATE sys_game_tournament_process 
                    SET round_${round_number} = ${round_id} WHERE tournament_id = ${tournament_id} AND user_id = ${user_id} `;
    let result = await db.exec(query);
    return result;
}

exports.isCanTournament = async (playerId, tournamentId) => {
    let query = `SELECT *
                    FROM sys_game_tournament_round r
                    WHERE r.status = 1 AND r.user_id = ${playerId} AND r.tournament_id = ${tournamentId}`;
    let result = await db.exec(query);
    result = result.shift();
    if( !result )
        return false;
    else
        return true;
}

exports.get_tournament_round_in_room = async (playerId, roomId) => {
    let query = `SELECT *
                    FROM sys_game_tournament_round r
                    WHERE r.status = 1 AND r.user_id = ${playerId} AND r.room_id = ${roomId}`;

    let result = await db.exec(query);
    result = result.shift();
    return result;
}


exports.get_chat_message = async () => {
    const query = "SELECT * FROM poker3_message ORDER BY type";
    const result = await db.exec(query, []);
    return result;
}