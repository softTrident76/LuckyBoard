/**
 * Helper for Game Specifications
 *
 * ORIGINATED from `poker4.backend_helper` written in CodeIgniter,
 * then ADAPTED to Node.js
 */

const Consts = require('../../config/consts');
const md5 = require('md5');
const util = require('./util');

/**
 * Generate password
 */
exports.generatePassword = (rawText) => {
    return md5(rawText);
}

/**
 * token 생성모듈
 */
exports.generateToken = (userId) => {
    return md5(userId + util.formatDate('Y-M-D H:i:s') + 'jrn');
};

/**
 * 카드가 한개짜리인가
 */
exports.isSingleCard = (cardList) => {
    return Array.isArray(cardList) && cardList.length === 1;
};

/**
 * 닐리리일때
 */
exports.isStraightCards = (cardList) => {
    if (!Array.isArray(cardList) || cardList.length < 3) {
        return false;
    }

    for (let i = 0; i < cardList.length - 1; ++i) {
        if (exports.getCardNumber(cardList[i]) !== exports.getCardNumber(cardList[i + 1]) - 1) {
            return false;
        }
    }

    return true;
};

exports.getCardNumber = (cardId) => {
    return Math.floor(cardId / 4) + Consts.CARD_NUMBER_3;
};

exports.getCardShape = (cardId) => {
    return (cardId % 4) + Consts.CARD_SHAPE_DIAMOND;
};

exports.getCardIdByShapeAndNumber = (shape, number) => {
    return 4 * (number - Consts.CARD_NUMBER_3) + shape - Consts.CARD_SHAPE_DIAMOND;
};

/**
 * Converts card list (string or any type) to array
 */
exports.parseCardList = (cardList) => {
    const cards = ((cardList && cardList.toString) ? cardList.toString() : '').replace(/ /g, '').split(',');
    return cards.map(c => parseInt(c)).filter(c => c >= Consts.CARD_MIN && c <= Consts.CARD_MAX);
};

exports.cardText = (shape, number) => {
    let str = 'None';
    switch (shape) {
        case Consts.CARD_SHAPE_DIAMOND: str = 'Diamond'; break;
        case Consts.CARD_SHAPE_CLUB:    str = 'Club'; break;
        case Consts.CARD_SHAPE_HEART:   str = 'Heart'; break;
        case Consts.CARD_SHAPE_SPADE:   str = 'Spade'; break;
    }
    switch (number) {
        case Consts.CARD_NUMBER_3:      str += '-3'; break;
        case Consts.CARD_NUMBER_4:      str += '-4'; break;
        case Consts.CARD_NUMBER_5:      str += '-5'; break;
        case Consts.CARD_NUMBER_6:      str += '-6'; break;
        case Consts.CARD_NUMBER_7:      str += '-7'; break;
        case Consts.CARD_NUMBER_8:      str += '-8'; break;
        case Consts.CARD_NUMBER_9:      str += '-9'; break;
        case Consts.CARD_NUMBER_10:     str += '-10'; break;
        case Consts.CARD_NUMBER_J:      str += '-J'; break;
        case Consts.CARD_NUMBER_Q:      str += '-Q'; break;
        case Consts.CARD_NUMBER_K:      str += '-K'; break;
        case Consts.CARD_NUMBER_A:      str += '-A'; break;
    }
    return str;
};

exports.cardTextById = (cardId) => {
    const shape = exports.getCardShape(cardId);
    const number = exports.getCardNumber(cardId);
    return exports.cardText(shape, number);
};

exports.isBettingEvent = (eventType) => {
    return eventType >= Consts.EVENT_TYPE_BETTING_START && eventType <= Consts.EVENT_TYPE_BETTING_END;
};
