require('dotenv').load();
const Consts = require('./consts');

const Config = { // ------------------------------- USER CONFIG || DEFAULT CONFIG
    AppTitle:               'Poker3Api',

    // Logging & Develop mode
    LogLevel:               process.env.LOG_LEVEL,
    LogVerbose:             !!process.env.LOG_VERBOSE && process.env.LOG_VERBOSE.trim().toLowerCase() === 'on',
    Dev:                    !!process.env.DEV && process.env.DEV.trim().toLowerCase() === 'on',
    TestCards: [
        (process.env.TEST_CARDS1 || '').replace(/ /g, '').split(',').map(c => parseInt(c)).filter(c => c >= Consts.CARD_MIN && c <= Consts.CARD_MAX),
        (process.env.TEST_CARDS2 || '').replace(/ /g, '').split(',').map(c => parseInt(c)).filter(c => c >= Consts.CARD_MIN && c <= Consts.CARD_MAX),
        (process.env.TEST_CARDS3 || '').replace(/ /g, '').split(',').map(c => parseInt(c)).filter(c => c >= Consts.CARD_MIN && c <= Consts.CARD_MAX),
        (process.env.TEST_CARDS4 || '').replace(/ /g, '').split(',').map(c => parseInt(c)).filter(c => c >= Consts.CARD_MIN && c <= Consts.CARD_MAX)
    ],

    // Secret Keys
    SessionSecret:          (process.env.SESSION_SECRET || '').trim()           ||  'never-guess',

    // MySQL Database
    DbHost:                 (process.env.DB_HOST || '').trim()                  ||  '127.0.0.1',
    DbUser:                 (process.env.DB_USER || '').trim()                  ||  'root',
    DbPswd:                 (process.env.DB_PSWD || '').trim()                  ||  '',
    DbName:                 (process.env.DB_NAME || '').trim()                  ||  'jaeryon_website',
    DbConnLimit:            500,

    // Game Server
    ServerUrl:              (process.env.SERVER_URL || '').trim()               ||  'http://127.0.0.1/boardgame',
    ServerPort:             parseInt(process.env.SERVER_PORT)                   ||  3001,
    SocketPath:             (process.env.SOCKET_PATH || '').trim()              ||  '/jrn.socket.io',
    GameSpace:              (process.env.GAME_SPACE || '').trim()               ||  '/jrn.boardgame',
    MobileSpace:            (process.env.MOBILE_SPACE || '').trim()             ||  '/jrn.boardgame.mobile',
    // StatenetTestUrl:        (process.env.STATENET_TEST_URL || '').trim()        ||  'http://naedongmu.com',
    // StatenetTestInterval:   parseInt(process.env.STATENET_TEST_INTERVAL)        ||  10000,  // in milliseconds

    // Game Logic
    ConnectTimeout:         Math.abs(parseInt(process.env.CONNECT_TIMEOUT))     ||  30000,  // in milliseconds
    DisconnectJewel:        Math.abs(parseInt(process.env.DISCONNECT_JEWEL))    ||  12,
    GameType:               parseInt(process.env.GAME_TYPE)                     ||  5,
    GameTypeAny:            parseInt(process.env.GAME_TYPE_ANY)                 ||  4,
    EmoticonCount:          30,

    // IP Block Feature
    // IPBlockEnabled:         (process.env.IDB_NAMEP_BLOCK_ENABLED || '').trim()         ||  'on',
    // WhiteIpDomain:          (process.env.WHITE_IP_DOMAIN || '').trim()          ||  '10.90.161',

    // Silver env
    // SilverHost:             (process.env.SILVER_HOST || '').trim()              ||  '192.0.0.55',
    // SilverPort:             parseInt(process.env.SILVER_PORT)                   ||  80,
    // SilverApiPath:          (process.env.SILVER_APIPATH || '').trim()           || '/mms2_new/shop/index.php?act=game&op=addUserPoints',

    // Game Logic
    UpdateRankInterval:     parseInt(process.env.UPDATE_RANK_INTERVAL)          ||  60,  // in minutes
    CheckRoomEnabled:       (process.env.CHECK_ROOM_ENABLED || '').trim()       ||  'on',
    CheckRoomInterval:      parseInt(process.env.CHECK_ROOM_INTERVAL)           ||  20,  // in minutes
    UpdatePlayersInterval:  parseInt(process.env.UPDATE_PLAYERS_INTERVAL)          ||  10,   // Seconds
};

// Socket Options
Config.PingInterval     =   10000;
Config.PingTimeout      =   5000;


const log = require('../app/common/log');
log.setOptions({
    level: Config.LogLevel,
    verbose: Config.LogVerbose
});
Config.LogLevel         = log.getLevelTag();
Config.LogVerbose       = log.isVerboseOn();
Config.Debug            = log.isLevelOn(log.DEBUG);
Config.DebugVerbose     = log.isLevelOn(log.DEBUG);


module.exports = Config;
