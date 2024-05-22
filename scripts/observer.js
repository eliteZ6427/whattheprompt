class Observer {
    constructor(data) {
        this.socket = data.socket;
        this.room = data.room;
    }

    send(event, data) {
        console.log('socket-send', 'Observer', event, data);
        this.socket.emit('message', event, data);
    }

    on(event, data) {
		switch (event) {
			case 'endobserve': this.onEndObserve(data); break;
		}
	}

	onEndObserve() {
		this.room.removeObserver(this);
		this.send('endobserve');
	}
}

module.exports = Observer;