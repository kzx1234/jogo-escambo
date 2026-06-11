const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Libera conexões vindas de qualquer lugar (inclusive do GitHub Pages)
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static(path.join(__dirname, '.')));

const MAPA_LARGURA = 2500;
const MAPA_ALTURA = 1800;

let jogadores = {};
let arvores = [];

for(let i = 0; i < 45; i++) {
    arvores.push({
        id: i,
        x: Math.random() * (MAPA_LARGURA - 200) + 100,
        y: Math.random() * (MAPA_ALTURA - 600) + 500,
        vida: 100, max: 100, viva: true
    });
}

io.on('connection', (socket) => {
    console.log(`Conexão multiplayer estabelecida: ${socket.id}`);

    jogadores[socket.id] = {
        id: socket.id,
        x: 500 + (Math.random() * 40 - 20),
        y: 700,
        raio: 16,
        armaduraNivel: 0,
        slotSelecionado: 0
    };

    socket.emit('inicializar', { id: socket.id, jogadores, arvores });
    socket.broadcast.emit('novoJogador', jogadores[socket.id]);

    socket.on('movimento', (dados) => {
        if (jogadores[socket.id]) {
            jogadores[socket.id].x = dados.x;
            jogadores[socket.id].y = dados.y;
            jogadores[socket.id].armaduraNivel = dados.armaduraNivel;
            jogadores[socket.id].slotSelecionado = dados.slotSelecionado;
            socket.broadcast.emit('atualizarJogador', jogadores[socket.id]);
        }
    });

    socket.on('cortarArvore', (dados) => {
        let arvore = arvores.find(a => a.id === dados.id);
        if (arvore && arvore.viva) {
            arvore.vida -= dados.dano;
            if (arvore.vida <= 0) {
                arvore.viva = false;
                io.emit('arvoreDerrubada', { id: arvore.id });
                setTimeout(() => {
                    arvore.viva = true;
                    arvore.vida = arvore.max;
                    io.emit('arvoreRenasceu', { id: arvore.id });
                }, 10000);
            } else {
                io.emit('atualizarArvore', { id: arvore.id, vida: arvore.vida });
            }
        }
    });

    socket.on('disconnect', () => {
        delete jogadores[socket.id];
        io.emit('removerJogador', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor aberto rodando na porta ${PORT}`);
});
