/**
 * Socket.io Extention Module
 */

/**
 * Get rooms of given socket
 */
exports.getRooms = (socket) => {
    let rooms = Object.keys(socket.rooms);
    rooms.shift();
    return rooms;
}

/**
 * Promised version of `socket.emit(event, data, (ack) => {})`
 */
exports.emit = (socket, event, data) => {
    return new Promise((resolve, reject) => {
        socket.emit(event, data, (ack) => {
            resolve(ack);
        });
    })
};

/**
 * Promised version of `socket.join(room, (err) => {})`
 */
exports.join = (socket, room) => {
    return new Promise((resolve, reject) => {
        socket.join(room, (err) => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    })
};

/**
 * Promised version of `socket.leave(room, (err) => {})`
 */
exports.leave = (socket, room) => {
    return new Promise((resolve, reject) => {
        socket.leave(room, (err) => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    })
};

/**
 * Promised version of `socket.leave(room, (err) => {})`
 */
exports.leaveAll = (socket) => {
    const rooms = exports.getRooms(socket);
    return new Promise((resolve, reject) => {
        socket.leave(rooms, (err) => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    })
};
