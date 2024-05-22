const manager = require('./manager');
const Room = require('./room');
const Player = require('./player');
const Observer = require('./observer');
const config = require('./config');
const { containsBannedWords } = require('./ai');

exports.initialize = io => {
    io.on('connection', socket => {
        console.log('socket-connect');

        socket.on('disconnect', () => {
            console.log('socket-disconnect');

            if (socket.player) {
                let player = socket.player;
                let room = player.room;
                room.removePlayer(player);
                if (!room.players.length) {
                    for (let observer of room.observers)
                        observer.send('exit');
                    manager.removeRoom(room);
                }
            }

            if (socket.observer) {
                let observer = socket.observer;
                let room = observer.room;
                room.removeObserver(observer);
            }
        });

        const onCreate = data => {
            const generateRoomId = () => {
                const getRandomRoomId = () => {
                    let id = '';
                    for (let i = 0; i < 4; i++)
                        id += Math.floor(Math.random() * 10);
                    return id;
                };

                let exist;
                let roomId;
                do {
                    exist = false;
                    roomId = getRandomRoomId();
                    for (let room of manager.rooms) {
                        if (roomId === room.id) {
                            exist = true;
                            break;
                        }
                    }
                } while (exist);

                return roomId;
            };

            let roomId = generateRoomId();
            let room = new Room({ id: roomId, nsfwMode: data.nsfwMode, roundCount: data.roundCount, imageEngine: data.imageEngine });

            //check player ID.
            if(!room.nsfwMode && containsBannedWords(data.playerId)) {
                socket.send('created', {status:'failed', msg: "You can't create with bad name"});
                return;
            }

            manager.addRoom(room);

            let player = new Player({
                socket: socket,
                id: data.playerId,
                room: room,
                index: 0
            });

            room.addPlayer(player);

            socket.player = player;

            player.send('created', { status:'success', roomId: room.id, nsfwMode: room.nsfwMode, roundCount: room.roundCount, imageEngine: room.imageEngine });
        };

        const onJoin = data => {
            let room = manager.getRoom(data.roomId);            

            if (room.players.length === config.playerCount) {
                socket.send("joined", {status: "failed", msg: "Room is full"});
                return;
            }

            if(room.state !== "start"){
                socket.send("joined", {status: "failed", msg: "Room is playing"});
                return;
            }

            //check player ID.
            if(!room.nsfwMode && containsBannedWords(data.playerId)) {
                socket.send('joined', {status:'failed', msg: "You can't join with bad name"});
                return;
            }
            
            for (let player of room.players)
                if(data.playerId === player.id)
                    {
                        socket.send('joined', {status:'failed', msg: "This name already exist"});
                        return; 
                    }

            let player = new Player({
                socket: socket,
                id: data.playerId,
                room: room,
                index: room.players.length
            });
            room.addPlayer(player);

            socket.player = player;

            let players = [];
            for (let player of room.players) players.push({ id: player.id });
            player.send('joined', { status:'success', who: 'joiner', players: players, nsfwMode: room.nsfwMode });
            player.broadcast('joined', { status:'success', who: 'other', player: { id: player.id } });
        };

        const onObserve = data => {
            let room = manager.getRoom(data.roomId);

            let observer = new Observer({ socket: socket, room: room });
            room.addObserver(observer);

            socket.observer = observer;

            let players = [];
            for (let player of room.players) players.push({ id: player.id});
            data = {
                room: { id: room.id, state: room.state },
                players: players
            };
            let owner;
            switch (room.state) {
                case 'generate':
                    for (let i = 0; i < room.players.length; i++)
                        data.players[i].check = room.players[i].check;
                    break;
                case 'guess':
                    if(room.roundCount == 1) {
                        owner = room.players[room.owners[(room.round) % room.players.length]];
                    } else {
                        owner = room.players[room.owners[(room.round % room.roundCount) % room.players.length]];
                    }
                    data.room.image = owner.image;
                    for (let i = 0; i < room.players.length; i++)
                        data.players[i].check = room.players[i].check;
                    break;
                case 'vote':
                    if(room.roundCount == 1) {
                        owner = room.players[room.owners[(room.round) % room.players.length]];
                    } else {
                        owner = room.players[room.owners[(room.round % room.roundCount) % room.players.length]];
                    }
                    data.room.image = owner.image;
                    for (let i = 0; i < room.players.length; i++)
                        data.players[i].check = room.players[i].check;
                    data.room.owner = { index: owner.index, prompt: owner.prompt};
                    break;
                case 'round':
                    if(room.roundCount == 1) {
                        owner = room.players[room.owners[(room.round) % room.players.length]];
                    } else {
                        owner = room.players[room.owners[(room.round % room.roundCount) % room.players.length]];
                    }
                    data.room.image = owner.image;
                    data.players = [];
                    for (let player of room.players)
                        data.players.push({ id: player.id, point: player.roundPoint });
                    data.players.sort((player1, player2) => player2.point - player1.point);
                    break;
                case 'final':
                    data.players = [];
                    for (let player of room.players)
                        data.players.push({ id: player.id, point: player.finalPoint });
                    data.players.sort((player1, player2) => player2.point - player1.point);
                    break;
            }
            observer.send('observe', data);
        };

        const onGetRoom = data => {
            let room = manager.getRoom(data.roomId);
            if (!room) {
                socket.emit('message', "getroom", {status: "failed", message: "Room code is not valid"});
                return;
            }

            if (!data.isObserver && room.players.length === config.playerCount) {
                socket.emit('message', "getroom", {status: "failed", message: "Room is full"});
                return;
            }

            if(!data.isObserver && room.state !== "start"){
                socket.emit('message', "getroom", {status: "failed", message: "Room is playing"});
                return;
            }
            socket.emit('message', 'getroom', {status: "success", nsfwMode: room.nsfwMode});
        };

        socket.on('message', (event, data) => {
            let playerId = socket.player ? socket.player.id : (data && data.playerId) ? data.playerId : 'Observer';
            console.log('socket-receive', playerId, event, data ? data : '');

            switch (event) {
                case 'create': onCreate(data); break;
                case 'join': onJoin(data); break;
                case 'observe': onObserve(data); break;
                case 'getroom': onGetRoom(data); break;
            }

            if (socket.player)
                socket.player.on(event, data);
            if (socket.observer)
                socket.observer.on(event, data);
        });
    });
};