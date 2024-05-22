const { generateImage } = require('./ai');
const { containsBannedWords } = require('./ai');
const { generatePrompt } = require('./ai');
const config = require('./config');

class Player {
	constructor(data) {
		this.socket = data.socket;
		this.id = data.id;
		this.room = data.room;
		this.index = data.index;

		this.check = false;
		this.prompt = '';
		this.image = null;
		this.guess = '';
		this.roundPoint = 0;
		this.finalPoint = 0;
	}

	setRoundPoint(point) {
		this.roundPoint = point;
		this.room.sendPlayerState();
	}

	getRoundPoint() {
		return this.roundPoint;
	}

	setFinalPoint(point) {
		this.finalPoint = point;
		this.room.sendPlayerState();
	}

	getFinalPoint() {
		return this.finalPoint;
	}

	setCheck(check) {
		this.check = check;
		this.room.sendPlayerState();
	}

	getCheck() {
		return this.check;
	}

	send(event, data) {
		this.socket.emit('message', event, data);
		console.log('socket-send', this.id, event, data ? data : '');
	}

	broadcast(event, data) {
		for (let player of this.room.players)
			if (player !== this) player.send(event, data);
		for (let observer of this.room.observers)
			observer.send(event, data);
	}

	on(event, data) {
		switch (event) {
			case 'start': this.onStart(data); break;
			case 'imagegenerate': this.onImageGenerate(data); break;
			case 'imageselect': this.onImageSelect(data); break;
			case 'guess': this.onGuess(data); break;
			case 'vote': this.onVote(data); break;
			case 'continue': this.onContinue(data); break;
			case 'replay': this.onReplay(data); break;
			case 'exit': this.onExit(data); break;
		}
	}

	onStart() {
		this.room.setState('generate');
		this.send('started', { roomId: this.room.id, round: this.room.round });
		this.broadcast('started', { roomId: this.room.id, round: this.room.round });
	}

	async onImageGenerate(data) {
		if (!data.prompt.length) {
			let prompt;
			while (1) {
				prompt = await generatePrompt();
				if (!this.room.nsfwMode) {
					if (!containsBannedWords(prompt))
						break;
				} else {
					break;
				}
			}
			data.prompt = prompt;
		}
		let result = await generateImage(data.prompt, this.room.nsfwMode, this.room.imageEngine);
		this.send('imagegenerated', result);
	}

	onImageSelect(data) {
		this.setCheck(true);
		this.prompt = data.prompt;
		this.image = data.image;

		this.send('imageselected', { playerIndex: this.index });
		this.broadcast('imageselected', { playerIndex: this.index });

		if (this.room.check()) {
			setTimeout(() => {
				this.room.setState('guess');
			}, 3000);
		}
	}

	async onGuess(data) {
		if (!this.room.nsfwMode && containsBannedWords(data.prompt)) {
			this.send('guess', { who: 'other', status: 'failed' });
			return;
		}
		if (data.prompt === " ") {
			let prompt;
			while (1) {
				prompt = await generatePrompt();
				if (!this.room.nsfwMode) {
					if (!containsBannedWords(prompt))
						break;
				} else {
					break;
				}
			}
			data.prompt = prompt;
		}
		this.setCheck(true);
		let owner = this.room.players[this.room.owners[(this.room.round) % this.room.players.length]];
		this.guess = data.prompt;
		if (owner.prompt === this.guess && owner.index != data.index) {
			this.send('guess', { who: 'other', status: 'success', playerIndex: this.index, point: this.finalPoint, correct: true });
			this.broadcast('guess', { who: 'other', status: 'success', playerIndex: this.index, point: this.finalPoint, correct: false });
			this.setRoundPoint(this.getRoundPoint() + 500);
			this.setFinalPoint(this.getFinalPoint() + 500);
			owner.setRoundPoint(owner.getRoundPoint() + 500);
			owner.setFinalPoint(owner.getFinalPoint() + 500);
		}
		else {
			this.send('guess', { who: 'other', status: 'success', playerIndex: this.index, point: this.finalPoint, correct: false });
			this.broadcast('guess', { who: 'other', status: 'success', playerIndex: this.index, point: this.finalPoint, correct: false });
		}

		if (this.room.check()) {
			setTimeout(() => {
				this.room.setState('vote');
			}, 3000);
		}
	}

	onVote(data) {
		this.setCheck(true);

		let room = this.room;
		let owner = room.players[room.owners[(room.round) % room.players.length]];
		if (data.voteIndex == owner.index) {
			owner.setRoundPoint(owner.getRoundPoint() + 500);
			owner.setFinalPoint(owner.getFinalPoint() + 500);
			this.setRoundPoint(this.getRoundPoint() + 500);
			this.setFinalPoint(this.getFinalPoint() + 500);
			this.room.voteResultData.filter(player => { return player.isCorrect === 1 })
				.forEach(player => player.votePlayers.push(this.index));
		} else if (data.voteIndex > -1) {
			this.room.players[data.voteIndex].setRoundPoint(this.room.players[data.voteIndex].getRoundPoint() + 250);
			this.room.players[data.voteIndex].setFinalPoint(this.room.players[data.voteIndex].getFinalPoint() + 250);
			this.room.voteResultData.filter(player => { return player.index === data.voteIndex })
				.forEach(player => player.votePlayers.push(this.index));
		} else {
			this.room.voteResultData.filter(player => { return player.isCorrect === 1 })
				.forEach(player => player.votePlayers.push(this.index));
		}

		this.send('vote', { who: 'other', playerIndex: this.index, point: this.room.players[this.index].finalPoint });
		this.broadcast('vote', { who: 'other', playerIndex: this.index, point: this.room.players[this.index].finalPoint });

		if (this.room.check()) {
			let count = this.room.voteResultData.filter(item => { return item.votePlayers.length > 0 || item.isCorrect === 1 }).length;
			if (!this.room.voteResultData.filter(item => { return item.votePlayers.length > 0 && item.isCorrect !== 1 }).length) {
				setTimeout(() => {
					this.room.setState('round');
				}, 3000);
			} else {
				this.room.broadcast('vote', { who: 'finished', result: this.room.voteResultData.filter(item => { return item.votePlayers.length > 0 || item.isCorrect === 1 }) });
				setTimeout(() => {
					this.room.setState('round');
				}, count * 3400);
			}
		}
	}

	onContinue() {
		this.setCheck(true);

		this.broadcast('continue', { playerIndex: this.index, round: this.room.round });

		if (this.room.check()) {
			if ((this.room.round % this.room.players.length) == 0 && (this.room.round / this.room.players.length) == this.room.roundCount)
				this.room.setState('final');
			else if ((this.room.round % this.room.players.length) == 0)
				this.onStart();
			else
				this.room.setState('guess');
		}
	}

	onReplay() {
		this.setCheck(true);

		let players = [];
		for (let player of this.room.players)
			if (player.check) players.push({ id: player.id });
		for (let player of this.room.players)
			if (player.check) player.send('replay', { players: players });
	}

	onExit() {
		this.room.removePlayer(this);
		this.send('exit', { status: 'exit' });
	}
}

module.exports = Player;