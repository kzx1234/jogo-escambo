const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// Serve os arquivos da pasta atual (como o index.html) automaticamente
app.use(express.static(path.join(__dirname, '.')));

const MAPA_LARGURA = 2500;
const MAPA_ALTURA = 1800;

let jogadores = {};
let arvores = [];

// Inicializa as 45 árvores diretamente no servidor
// Isso garante que todos os jogadores vejam as mesmas árvores nos mesmos lugares
for(let i = 0; i < 45; i++) {
    arvores.push({
        id: i,
        x: Math.random() * (MAPA_LARGURA - 200) + 100,
        y: Math.random() * (MAPA_ALTURA - 600) + 500,
        vida: 100, 
        max: 100, 
        viva: true, 
        seed: Math.random() * 100
    });
}

io.on('connection', (socket) => {
    console.log(`Colono conectado ao servidor: ${socket.id}`);

    // Configura o estado inicial do novo jogador
    jogadores[socket.id] = {
        id: socket.id,
        x: 500 + (Math.random() * 50 - 25), // Pequena variação para não nascerem exatamente colados
        y: 700,
        raio: 16,
        armaduraNivel: 0,
        slotSelecionado: 0,
        temEspada: false,
        espadaNivel: 0,
        temArco: false
    };

    // Envia os dados do mapa e dos jogadores atuais apenas para o jogador que acabou de conectar
    socket.emit('inicializar', { id: socket.id, jogadores, arvores });

    // Avisa todos os outros jogadores que um novo colono entrou
    socket.broadcast.emit('novoJogador', jogadores[socket.id]);

    // Atualiza e replica a posição e os equipamentos de um jogador para os demais
    socket.on('movimento', (dados) => {
        if (jogadores[socket.id]) {
            jogadores[socket.id].x = dados.x;
            jogadores[socket.id].y = dados.y;
            jogadores[socket.id].armaduraNivel = dados.armaduraNivel;
            jogadores[socket.id].slotSelecionado = dados.slotSelecionado;
            jogadores[socket.id].temEspada = dados.temEspada;
            jogadores[socket.id].espadaNivel = dados.espadaNivel;
            jogadores[socket.id].temArco = dados.temArco;

            // Transmite as modificações para os outros usuários conectados
            socket.broadcast.emit('atualizarJogador', jogadores[socket.id]);
        }
    });

    // Gerencia o sistema de colheita e corte de Pau-Brasil compartilhado
    socket.on('cortarArvore', (dados) => {
        let arvore = arvores.find(a => a.id === dados.id);
        if (arvore && arvore.viva) {
            arvore.vida -= dados.dano;
            
            if (arvore.vida <= 0) {
                arvore.viva = false;
                // Notifica todo mundo que a árvore caiu
                io.emit('arvoreDerrubada', { id: arvore.id });
                
                // Configura o tempo de ressurgimento (10 segundos) gerenciado pelo servidor
                setTimeout(() => {
                    arvore.viva = true;
                    arvore.vida = arvore.max;
                    io.emit('arvoreRenasceu', { id: arvore.id });
                }, 10000);
            } else {
                // Se ainda tiver vida, atualiza a barra de vida dela para todos
                io.emit('atualizarArvore', { id: arvore.id, vida: arvore.vida });
            }
        }
    });

    // Remove o jogador do mapa mundial quando ele fecha a aba ou desconecta
    socket.on('disconnect', () => {
        console.log(`Colono desconectado: ${socket.id}`);
        delete jogadores[socket.id];
        io.emit('removerJogador', socket.id);
    });
});

// O servidor vai rodar na porta de ambiente (ex: Render/Heroku) ou na porta 3000 localmente
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` SERVIDOR MULTIPLAYER RODANDO COM SUCESSO!`);
    console.log(` Endereço Local: http://localhost:${PORT}`);
    console.log(`====================================================`);
});
