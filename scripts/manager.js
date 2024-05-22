class Manager {
    constructor() {
        this.rooms = [];
    }

    addRoom(room) {
        this.rooms.push(room);
        console.log('manager-add-room', room.id);
    }

    removeRoom(room) {
        for (let i = 0; i < this.rooms.length; i++) {
            if (room === this.rooms[i]) {
                this.rooms.splice(i, 1);
                break;
            }
        }
        console.log('manager-remove-room', room.id);
    }

    getRoom(roomId) {
        for (let room of this.rooms)
            if (roomId === room.id) return room;
        return null;
    }
}

module.exports = new Manager();