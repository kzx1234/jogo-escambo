const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.static(path.join(__dirname, '.')));

const MAPA_LARGURA = 2500;
const MAPA_ALTURA = 1800;
const LINHA_DA_AGUA = 250;

let jogadores = {};
let arvores = [];

// Inicializa as árvores no servidor para que sejam iguais para todos
for(let i=0; i<45; i++) {
    arvores.push({
        id: i,
        x: Math.random() * (MAPA_LARGURA - 200) + 100,
        y: Math.random() * (MAPA_ALTURA - 600) + 500,
        vida: 100, max: 100, viva: true, seed: Math.random()*100
    });
}

io.on('connection', (socket) => {
    console.log(`Jogador conectado: ${socket.id}`);

    // Cria o novo jogador no servidor
    jogadores[socket.id] = {
        id: socket.id,
        x: 500 + (Math.random() * 40 - 20),
        y: 700,
        raio: 16,
        armaduraNivel: 0,
        slotSelecionado: 0,
        temEspada: false,
        espadaNivel: 0,
        temArco: false
    };

    // Envia o estado inicial para quem acabou de entrar
    socket.emit('inicializar', { id: socket.id, jogadores, arvores });

    // Avisa os outros que alguém entrou
    socket.broadcast.emit('novoJogador', jogadores[socket.id]);

    // Atualiza a posição e estado do jogador
    socket.on('movimento', (dados) => {
        if (jogadores[socket.id]) {
            jogadores[socket.id].x = dados.x;
            jogadores[socket.id].y = dados.y;
            jogadores[socket.id].armaduraNivel = dados.armaduraNivel;
            jogadores[socket.id].slotSelecionado = dados.slotSelecionado;
            jogadores[socket.id].temEspada = dados.temEspada;
            jogadores[socket.id].espadaNivel = dados.espadaNivel;
            jogadores[socket.id].temArco = dados.temArco;

            // Replica para os outros jogadores
            socket.broadcast.emit('atualizarJogador', jogadores[socket.id]);
        }
    });

    // Sincroniza o corte de árvore
    socket.on('cortarArvore', (dados) => {
        let arvore = arvores.find(a => a.id === dados.id);
        if (arvore && arvore.viva) {
            arvore.vida -= dados.dano;
            if (arvore.vida <= 0) {
                arvore.viva = false;
                io.emit('arvoreDerrubada', { id: arvore.id, qtdMadeira: Math.floor(Math.random() * 3) + 3 });
                
                // Renasce a árvore após 10 segundos
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
        console.log(`Jogador desconectado: ${socket.id}`);
        delete jogadores[socket.id];
        io.emit('removerJogador', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor multiplayer rodando na porta ${PORT}`);
});
