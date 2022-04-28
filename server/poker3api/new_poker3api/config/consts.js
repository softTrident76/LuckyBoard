/**
 * Constant Definition for Poker3API
 * Defined by ICB
 */

// ID related Consts
exports.INVALID_ID                      =   0;
exports.INVALID_CARD                    =   -1;

// Status used for socket io event result
exports.STATUS_FAILED                   =   0;
exports.STATUS_SUCCESS                  =   1;

// Room Status used in poker3_room
exports.ROUND_CREATED                   =   0;
exports.ROUND_PLAYERS_JOINED            =   1;
exports.ROUND_PLAYERS_READY             =   2;
exports.ROUND_PLAYING                   =   3;
exports.ROUND_END                       =   4;

// Player status, i.e pstatus1, pstatus2, pstatus3 in poker3_room
exports.PLAYER_NOT_READY                =   0;
exports.PLAYER_SET_READY                =   1;
exports.PLAYER_REQUEST_LEAVE            =   2;

// Player status used in poker3_player's status field
exports.PLAYER_DISCONNECTED             =   0;
exports.PLAYER_IN_HOUSE                 =   1;
exports.PLAYER_GAMER                    =   2;
exports.PLAYER_OBSERVER                 =   3;
exports.PLAYER_IN_MAP                   =   4;

// Status used for normal pass or pass by timer
exports.NEXT_NORMAL                     =   0;
exports.NEXT_PASS                       =   1;

// Delay between end-round and new-round
exports.DELAY_FOR_NEW_ROUND             =   1;

// Minimum multiply value to create room
exports.MIN_JEWEL_MULTIPLE              =   1;

// Destroy game room is players pass turn more than this Value
exports.PASS_TURN_LIMIT                 =   10;

// Pass Turn Seconds for Dropped Player (caused by nextwork connectivity)
exports.TURN_LIMIT_FOR_DROPPED          =   15;

// Start Room Number everyday
exports.START_ROOM_NUMBER               =   1;

// Game Type //
exports.GAME_TYPE_POKER3                =   0x10;
exports.GAME_TYPE_POKER4                =   0x11;
exports.GAME_TYPE_TETRIS                =   0x12;

// ITEM-USED STATE //
exports.ITEM_USED                       = 0x01;
exports.ITEM_WAIT                       = 0x02;
exports.ITEM_REJECT                     = 0x00;

// ITEM TYPE //
exports.ITEM_TYPE_SOON                  = 0x01;
exports.ITEM_TYPE_TBT                   = 0x02;
exports.ITEM_TYPE_RBR                   = 0x03;

// Game Type //
exports.GAME_CATEGORY_NORMAL                    = 0x0;
exports.GAME_CATEGORY_TOURNAMENT                = 0x1;

