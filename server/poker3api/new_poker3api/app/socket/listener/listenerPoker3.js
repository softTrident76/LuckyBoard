/**
 * Server Socket Main Controller
 */

const Config = require('../../../config');
const Consts = require('../../../config/consts');
const procPoker3 = require('../procPoker3');
const util = require('../../common/util');

// Log
const log = require('../../common/log');
const TAG = 'socket.main';

module.exports = (io, socket, context) => {

    socket.on('join-waitroom', (req) => {
        log.debugVerbose(TAG, `[${context.joinRoomusername}, ${context.gameRoomId}]> join-waitroom:`, req);
        procPoker3.joinWaitRoom(req, context);
    });

    socket.on('get-profile', (req) => {
        log.debugVerbose(TAG, `[${context.username}, ${context.gameRoomId}]> get-profile:`, req);
        procPoker3.getProfileInfo(req, context);
    });

    socket.on('room-list', (req) => {
        log.debugVerbose(TAG, `[${context.username}, ${context.gameRoomId}]> room-list:`, req);
        procPoker3.getRoomList(req, context);
    });

    socket.on('create-room', (req) => {
        log.debugVerbose(TAG, `[${context.username}, ${context.gameRoomId}]> create-room:`, req);
        procPoker3.createRoom(req, context);
    });

    socket.on('join-room', (req) => {
        log.debugVerbose(TAG, `[${context.username}, ${context.gameRoomId}]> join-room:`, req);
        procPoker3.joinRoom(req, context);
    });

    socket.on('set-ready', (req) => {
        log.debugVerbose(TAG, `[${context.username}, ${context.gameRoomId}]> set-ready:`, req);
        procPoker3.setReady(req, context);
    });

    socket.on('get-cards', (req) => {
        log.debugVerbose(TAG, `[${context.username}, ${context.gameRoomId}]> get-cards:`, req);
        procPoker3.getCards(req, context);
    });

    socket.on('pass-bet', (req) => {
        log.debugVerbose(TAG, `[${context.username}, ${context.gameRoomId}]> pass-bet:`, req);
        procPoker3.passBet(req, context);
    });

    socket.on('level-up', (req) => {
        log.debugVerbose(TAG, `[${context.username}, ${context.gameRoomId}]> level-up:`, req);
        procPoker3.levelUpBet(req, context);
    });

    socket.on('pick-cards', (req) => {
        // NOTICE: 'pick-cards' request are sent so often, we don't log its data
        log.debugVerbose(TAG, `[${context.username}, ${context.gameRoomId}]> pick-cards:`, req);
        procPoker3.pickupCards(req, context);
    });

    socket.on('pass-turn', (req) => {
        log.debugVerbose(TAG, `[${context.username}, ${context.gameRoomId}]> pass-turn:`, req);
        procPoker3.passTurn(req, context);
    });

    socket.on('put-card', (req) => {
        log.debugVerbose(TAG, `[${context.username}, ${context.gameRoomId}]> put-card:`, req);
        procPoker3.putCard(req, context);
    });

    socket.on('leave-request', (req) => {
        log.debugVerbose(TAG, `[${context.username}, ${context.gameRoomId}]> leave-request:`, req);
        procPoker3.leaveRequest(req, context);
    });

    socket.on('leave-cancel', (req) => {
        log.debugVerbose(TAG, `[${context.username}, ${context.gameRoomId}]> leave-cancel:`, req);
        procPoker3.leaveCancel(req, context);
    });

    socket.on('history-view', (req) => {
        log.debugVerbose(TAG, `[${context.username}, ${context.gameRoomId}]> history-view:`, req);
        procPoker3.historyView(req, context);
    });

    socket.on('emoticon', (req) => {
        if (context.gameRoomId != Consts.INVALID_ID)
            procPoker3.doEmoticon(req, context);
    });

    socket.on('emot-text', (req) => {
        if (context.gameRoomId != Consts.INVALID_ID)
            procPoker3.emotText(req, context);
    });

    socket.on('call-player', (req) => {
        if (context.gameRoomId != Consts.INVALID_ID)
            procPoker3.callPlayer(req, context);
    });

    socket.on('player-list', (req) => {
        log.debugVerbose(TAG, `[${context.username}, ${context.gameRoomId}]> player-list:`, req);
        procPoker3.getPlayerList(req, context);
    });

    socket.on('player-info', (req) => {
        log.debugVerbose(TAG, `[${context.username}, ${context.gameRoomId}]> player-info:`, req);
        procPoker3.getPlayerInfo(req, context);
    });

    socket.on('illegal-vote',(req) =>{
        log.debugVerbose(TAG, `[${context.username}, ${context.gameRoomId}]> illegal-vote:`, req);
        proc.illegalVote(req, context);
    });

    socket.on('illegal-reject',(req) =>{
        log.debugVerbose(TAG, `[${context.username}, ${context.gameRoomId}]> illegal-reject:`, req);
        procPoker3.illegalNegativeVote(req, context);
    });

    socket.on('use-item', (req) => {
        log.debugVerbose(TAG, `[${context.username}, ${context.gameRoomId}]> use-icon:`, req);
        procPoker3.useItem(req, context);
    });

    // Tournament sockets for web client //
    socket.on('tournament-room-list', (req) => {
        log.debugVerbose(TAG, `[${context.username}, ${context.gameRoomId}]> tournament-room-list:`, req);
        procPoker3.getTournamentRoomList(req, context);
    });

    socket.on('join-tournament-room', (req) => {
        log.debugVerbose(TAG, `[${context.username}, ${context.gameRoomId}]> join-tournament-room:`, req);
        procPoker3.joinTournamentRoom(req, context);
    });

    socket.on('get-tournament-profile', (req) => {
        log.debugVerbose(TAG, `[${context.username}, ${context.gameRoomId}]> get-tournament-profile:`, req);
        procPoker3.getTournamentProfileInfo(req, context);
    });

    socket.on('chat-message', (req) => {
        log.debugVerbose(TAG, `[${context.username}, ${context.gameRoomId}]> chat-message:`, req);
        procPoker3.getChatMessage(req, context);
    });

    // Additional sockets for web client
    if (socket.adapter.nsp.name == Config.GameSpace) {
        socket.on('join-observer', (req) => {
            log.debugVerbose(TAG, `[${context.username}, ${context.gameRoomId}]> join-observer:`, req);
            procPoker3.joinObserver(req, context);
        });

        socket.on('idle-players', (req) => {
            log.debugVerbose(TAG, `[${context.username}, ${context.gameRoomId}]> idle-players:`, req);
            procPoker3.getIdlePlayers(req, context);
        });

        socket.on('invite-user', (req) => {
            log.debugVerbose(TAG, `[${context.username}, ${context.gameRoomId}]> invite-user:`, req);
            procPoker3.InvitePlayerToRoom(req, context);
        });

        socket.on('invite-join-room', (req) => {
            log.debugVerbose(TAG, `[${context.username}, ${context.gameRoomId}]> invite-join-room:`, req);
            procPoker3.InviteObserverToRoom(req, context);
        });
    }
};
