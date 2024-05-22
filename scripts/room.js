const config = require('./config');

class Room {
    constructor(data) {
        this.id = data.id;

        this.players = [];
        this.observers = [];

        this.round = 0;
        this.owners = [];

        this.nsfwMode = data.nsfwMode;
        this.roundCount = data.roundCount;
        this.imageEngine = data.imageEngine;

        this.state = '';

        this.startTime = null;
        this.timeoutId = null;

        this.voteResultData = [];

        this.setState('start');
    }

    setTimeout() {
        this.startTime = new Date();
        this.timeoutId = setTimeout(this.onTimeout, config.time * 1000);
    }

    clearTimeout() {
        clearTimeout(this.timeoutId);
    }

    onTimeout() {
        
    }

    setState(state) {
        this.state = state;
        for (let player of this.players) player.setCheck(false);
        
        let players = [];
        for (let i = 0; i < this.players.length; i++) 
            players.push({id: this.players[i].id, finalPoint: this.players[i].finalPoint, check: this.players.check});

        const onGenerate = () => {
            this.owners = [];
            for (let i = 0; i < this.players.length; i++) this.owners.push(i);
            this.owners.sort(() => Math.random() - 0.5);
        };

        const onGuess = () => {
            let index = this.owners[this.round % this.players.length];
            let owner = this.players[index];
            owner.send('guess', { who: 'owner', players: players });
            owner.broadcast('guess', { who: 'guesser', image: owner.image, players: players  });
        };

        const onVote = () => {
            let index = this.owners[this.round % this.players.length];
            let owner = this.players[index];
            
            let guesses = [];
            guesses.push({index: index, guess: owner.guess});
            for (let player of this.players)  {                
                if(owner.prompt !== player.guess)
                    guesses.push({index: player.index, guess: player.guess});
            }                
            guesses.sort(() => Math.random() - 0.5);

            this.voteResultData = [];
            for(let player of this.players) {
                let data = {
                    id: player.id,
                    index: player.index,
                    prompt: player.guess,
                    isCorrect: player.index == index ? 1 : 0,
                    point: player.index == index ? config.point : config.point / 2,
                    votePlayers: []
                }
                this.voteResultData.push(data);
            }
            this.broadcast('vote', { who: 'roomer', guesses: guesses, owner: { index: owner.index, prompt: owner.prompt }, players: players });
        };

        const onRound = () => {
            let players = [];
            for (let player of this.players)
                players.push({ id: player.id, point: player.roundPoint });
            players.sort((player1, player2) => player2.point - player1.point);
            this.broadcast('round', { players: players });

            for (let player of this.players) player.roundPoint = 0;

            this.round++;
        };

        const onFinal = () => {
            let players = [];
            for (let player of this.players)
                players.push({ id: player.id, point: player.finalPoint });
            players.sort((player1, player2) => player2.point - player1.point);
            this.broadcast('final', { players: players });
            
            for (let player of this.players) player.finalPoint = 0;
            this.round = 0;
        };

        switch (this.state) {
            case 'generate': onGenerate(); break;
            case 'guess': onGuess(); break;
            case 'vote': onVote(); break;
            case 'round': onRound(); break;
            case 'final': onFinal(); break;
        }
    }

    addPlayer(player) {
        this.players.push(player);
        console.log('room-add-player', this.id, player.id);
        this.sendPlayerState();
    }

    removePlayer(player) {
        for (let i = 0; i < this.players.length; i++) {
            if (player === this.players[i]) {
                this.players.splice(i, 1);
                break;
            }
        }

        let players = [];
        for (let i = 0; i < this.players.length; i++) {
            this.players[i].index = i;
            players.push({id: this.players[i].id});
        }
        this.sendPlayerState();
        console.log('room-remove-player', this.id, player.id);
    }

    addObserver(observer) {
        this.observers.push(observer);
        this.sendPlayerState();
        console.log('room-add-observer', this.id, this.observers.length);
    }

    removeObserver(observer) {
        for (let i = 0; i < this.observers.length; i++) {
            if (observer === this.observers[i]) {
                this.observers.splice(i, 1);
                break;
            }
        }
        this.sendPlayerState();
        console.log('room-remove-observer', this.id, observer.id);
    }

    sendPlayerState() {
        let players = [];
        for(let i = 0; i < this.players.length; i++) {
            this.players[i].index = i;
            players.push({
                id: this.players[i].id,
                index: this.players[i].index,
                roundPoint: this.players[i].roundPoint,
                finalPoint: this.players[i].finalPoint,
                check: this.players[i].check
            });
        }
        this.broadcast('playerstate', {players: players, observers: this.observers.length});
    }

    broadcast(event, data) {
        for (let player of this.players)
            player.send(event, data);
        for (let observer of this.observers)
            observer.send(event, data);
    }

    check(event, data) {
        for (let player of this.players)
            if (!player.getCheck()) return false;
        return true;
    }
}

module.exports = Room;