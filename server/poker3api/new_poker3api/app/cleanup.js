const Config = require('../config');
const db = require('./common/db');
const sql = require('./common/sql');


/**
 * SERVER STARTUP WORKFLOW
 */
(async () => {
    let startTime = process.uptime();
    console.log("--- Start Updating score");
    await db.exec(`
        UPDATE tbl_users,
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
            tbl_users.poker3_score = log.score
        WHERE
            tbl_users.id = log.player_id;
    `);
    console.log("--- Finished to update score");
    console.log("--- Start Updating rank");
    await db.exec(`
        TRUNCATE rank_buf;

        INSERT INTO rank_buf (score)
        SELECT
            poker3_score
        FROM
            tbl_users
        ORDER BY
            poker3_score DESC;

        UPDATE tbl_users,
        (
            SELECT
                *
            FROM
                rank_buf
        ) AS r
        SET
            tbl_users.poker3_rank = r.rank
        WHERE
            tbl_users.poker3_score = r.score;
    `);
    console.log("--- Finished!");
    let elapsedTime = process.uptime() - startTime;
    console.log(elapsedTime);
})();
