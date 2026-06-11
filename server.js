const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const MAPA_LARGURA = 2500;
const MAPA_ALTURA = 1800;
const LINHA_DA_AGUA = 250;

let jogadores = {};
let arvores = [];

// Inicializa as árvores do servidor
for(let i = 0; i < 45; i++) {
    arvores.push({
        id: i,
        x: Math.random() * (MAPA_LARGURA - 200) + 100,
        y: Math.random() * (MAPA_ALTURA - 600) + 500,
        vida: 100, max: 100, viva: true
    });
}

// Quando alguém acessa o link do Render, o servidor lê o seu index.html original 
// e injeta o Multiplayer, o Barco e a Ilha automaticamente sem quebrar suas 1286 linhas!
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    
    fs.readFile(indexPath, 'utf8', (err, html) => {
        if (err) {
            return res.status(500).send('Erro ao carregar o index.html do jogo.');
        }

        // CÓDIGO DA EXPANSÃO MARÍTIMA INJETADO AUTOMATICAMENTE
        const scriptInvasao = `
        <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
        <script>
            console.log("Modo Invasão Marítima Ativado!");
            const socket = io();
            let outrosJogadores = {};

            // Variáveis da nova mecânica
            let barco = { x: 600, y: 200, largura: 60, altura: 35, pilotando: false, vel: 3 };
            let ilhaInimiga = { x: 2000, y: 120, raio: 160, descoberta: false };
            let inimigosIlha = [];
            let itensParaRoubar = [];
            let msgInvasao = "";
            let msgInvasaoTimer = 0;

            window.addEventListener('load', () => {
                // Sincronização inicial com o servidor
                socket.on('inicializar', (dados) => {
                    for (let id in dados.jogadores) {
                        if (id !== socket.id) outrosJogadores[id] = dados.jogadores[id];
                    }
                });

                socket.on('novoJogador', (dados) => { outrosJogadores[dados.id] = dados; });
                socket.on('atualizarJogador', (dados) => { if (outrosJogadores[dados.id]) outrosJogadores[dados.id] = dados; });
                socket.on('removerJogador', (id) => { delete outrosJogadores[id]; });

                // Escuta ações na ilha
                socket.on('ilhaInvadidaServidor', (dados) => {
                    ilhaInimiga.descoberta = true;
                    msgInvasao = "A ILHA INIMIGA ESTÁ SOWNDO ATACADA!";
                    msgInvasaoTimer = 180;
                    inimigosIlha = dados.inimigos;
                    itensParaRoubar = dados.tesouros;
                });

                socket.on('atualizarInimigosIlha', (novosInimigos) => { inimigosIlha = novosInimigos; });
                socket.on('atualizarTesourosIlha', (novosTesouros) => { itensParaRoubar = novosTesouros; });

                // INTERCEPTA A FUNÇÃO ATUALIZAR (FÍSICA) DO SEU JOGO
                const originalAtualizar = atualizar;
                atualizar = function() {
                    if (jogoPausado) return;

                    // Tecla F para entrar/sair do barco
                    if (teclas['f']) {
                        teclas['f'] = false;
                        if (!barco.pilotando) {
                            if (Math.hypot(jogador.x - barco.x, jogador.y - barco.y) < 60) {
                                barco.pilotando = true;
                            }
                        } else {
                            if (barco.y >= 230 || Math.hypot(barco.x - ilhaInimiga.x, barco.y - ilhaInimiga.y) < ilhaInimiga.raio + 30) {
                                barco.pilotando = false;
                                jogador.x = barco.x;
                                jogador.y = barco.y + 25;
                            }
                        }
                    }

                    if (barco.pilotando) {
                        // Controla o Barco no Mar
                        let dx = 0, dy = 0;
                        if (teclas['w']) dy -= barco.vel; if (teclas['s']) dy += barco.vel;
                        if (teclas['a']) dx -= barco.vel; if (teclas['d']) dx += barco.vel;

                        barco.x = Math.max(30, Math.min(2470, barco.x + dx));
                        barco.y = Math.max(30, Math.min(235, barco.y + dy)); // Limita ao mar

                        jogador.x = barco.x;
                        jogador.y = barco.y;

                        // Se aproximou da ilha inimiga, avisa o servidor para gerar o ataque
                        if (Math.hypot(barco.x - ilhaInimiga.x, barco.y - ilhaInimiga.y) < ilhaInimiga.raio && !ilhaInimiga.descoberta) {
                            socket.emit('dispararInvasao');
                        }
                    } else {
                        originalAtualizar(); // Roda o seu andar a pé original de 1286 linhas
                    }

                    // Detecção de dano dos inimigos da ilha no jogador local
                    if (ilhaInimiga.descoberta && !barco.pilotando) {
                        inimigosIlha.forEach(inimigo => {
                            if (inimigo.vida > 0) {
                                if (Math.hypot(jogador.x - inimigo.x, jogador.y - inimigo.y) < 250) {
                                    let ang = Math.atan2(jogador.y - inimigo.y, jogador.x - inimigo.x);
                                    inimigo.x += Math.cos(ang) * 1.8;
                                    inimigo.y += Math.sin(ang) * 1.8;

                                    if (Math.hypot(jogador.x - inimigo.x, jogador.y - inimigo.y) < 25) {
                                        jogador.vida -= 0.2;
                                        if(typeof atualizarUI === 'function') atualizarUI();
                                    }
                                }
                            }
                        });
                    }

                    // Envia dados pro servidor multiplayer
                    socket.emit('movimento', { x: jogador.x, y: jogador.y, barcoX: barco.x, barcoY: barco.y, pilotando: barco.pilotando });
                };

                // Intercepta a tecla Espaço do seu jogo para dar dano nos inimigos da ilha e roubar itens
                window.addEventListener('keydown', (e) => {
                    if (e.key === " " && ilhaInimiga.descoberta && !barco.pilotando) {
                        // Atacar defensores
                        inimigosIlha.forEach((inimigo, idx) => {
                            if (inimigo.vida > 0 && Math.hypot(jogador.x - inimigo.x, jogador.y - inimigo.y) < 60) {
                                socket.emit('atacarInimigoIlha', { index: idx, dano: 25 });
                            }
                        });

                        // Roubar tesouros da ilha inimiga
                        itensParaRoubar.forEach((item, idx) => {
                            if (!item.pego && Math.hypot(jogador.x - item.x, jogador.y - item.y) < 40) {
                                socket.emit('saquearTesouro', { index: idx });
                                jogador.inventario.madeira += 50; // Dá 50 moedas/recursos
                                if(typeof atualizarUI === 'function') atualizarUI();
                            }
                        });
                    }
                });

                // INTERCEPTA A FUNÇÃO DESENHAR DO SEU JOGO
                const originalDesenhar = desenhar;
                desenhar = function() {
                    originalDesenhar(); // Desenha todo o seu mapa original

                    ctx.save();
                    ctx.translate(-camera.x, -camera.y);

                    // Desenhar a Ilha Inimiga
                    ctx.fillStyle = "#ebd69b"; ctx.beginPath(); ctx.arc(ilhaInimiga.x, ilhaInimiga.y, ilhaInimiga.raio, 0, Math.PI*2); ctx.fill();
                    ctx.fillStyle = "#27ae60"; ctx.beginPath(); ctx.arc(ilhaInimiga.x, ilhaInimiga.y, ilhaInimiga.raio - 25, 0, Math.PI*2); ctx.fill();

                    // Desenhar o Barco
                    ctx.fillStyle = "#795548"; ctx.fillRect(barco.x - 30, barco.y - 18, 60, 35);
                    ctx.fillStyle = "#ffffff"; ctx.fillRect(barco.x - 2, barco.y - 35, 4, 20); // Vela

                    // Desenhar Tesouros Ocultos
                    itensParaRoubar.forEach(item => {
                        if (!item.pego) {
                            ctx.fillStyle = "#f1c40f"; ctx.fillRect(item.x, item.y, 16, 16);
                            ctx.strokeStyle = "#fff"; ctx.strokeRect(item.x, item.y, 16, 16);
                        }
                    });

                    // Desenhar Inimigos Adicionais da Ilha
                    if (ilhaInimiga.descoberta) {
                        inimigosIlha.forEach(inimigo => {
                            if (inimigo.vida > 0) {
                                ctx.fillStyle = "#c0392b"; ctx.beginPath(); ctx.arc(inimigo.x, inimigo.y, 15, 0, Math.PI*2); ctx.fill();
                                // HP Bar
                                ctx.fillStyle = "#555"; ctx.fillRect(inimigo.x - 15, inimigo.y - 24, 30, 4);
                                ctx.fillStyle = "#2ecc71"; ctx.fillRect(inimigo.x - 15, inimigo.y - 24, (inimigo.vida / inimigo.maxVida) * 30, 4);
                            }
                        });
                    }

                    // Desenhar outros jogadores conectados via rede
                    for(let id in outrosJogadores) {
                        let p = outrosJogadores[id];
                        if (!p.pilotando) {
                            ctx.fillStyle = "#e67e22"; ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, Math.PI*2); ctx.fill();
                        }
                    }

                    ctx.restore();

                    // Interface de Invasão
                    if (msgInvasaoTimer > 0) {
                        ctx.fillStyle = "rgba(192, 41, 43, 0.95)"; ctx.fillRect(canvas.width/2 - 250, 20, 500, 45);
                        ctx.fillStyle = "#fff"; ctx.font = "bold 16px Arial"; ctx.textAlign = "center";
                        ctx.fillText(msgInvasao, canvas.width/2, 48);
                        msgInvasaoTimer--;
                    }
                };
            });
        </script>
        `;

        const htmlModificado = html.replace('</body>', `${scriptInvasao}</body>`);
        res.send(htmlModificado);
    });
});

app.use(express.static(path.join(__dirname, '.')));

// GERENCIAMENTO DAS AÇÕES MULTIPLAYER NO SERVIDOR
let ilhaEstado = { descoberta: false, inimigos: [], tesouros: [] };

io.on('connection', (socket) => {
    jogadores[socket.id] = { id: socket.id, x: 500, y: 700, barcoX: 600, barcoY: 200, pilotando: false };

    socket.emit('inicializar', { id: socket.id, jogadores, arvores });
    if(ilhaEstado.descoberta) {
        socket.emit('ilhaInvadidaServidor', ilhaEstado);
    }

    socket.on('movimento', (dados) => {
        if (jogadores[socket.id]) {
            jogadores[socket.id].x = dados.x; jogadores[socket.id].y = dados.y;
            jogadores[socket.id].barcoX = dados.barcoX; jogadores[socket.id].barcoY = dados.barcoY;
            jogadores[socket.id].pilotando = dados.pilotando;
            socket.broadcast.emit('atualizarJogador', jogadores[socket.id]);
        }
    });

    socket.on('dispararInvasao', () => {
        if (!ilhaEstado.descoberta) {
            ilhaEstado.descoberta = true;
            ilhaEstado.inimigos = [
                { x: 1950, y: 120, vida: 100, maxVida: 100 },
                { x: 2050, y: 140, vida: 100, maxVida: 100 },
                { x: 2000, y: 80,  vida: 150, maxVida: 150 } // Capitão
            ];
            ilhaEstado.tesouros = [
                { x: 1990, y: 110, tpo: "Ouro", pego: false },
                { x: 2010, y: 130, tpo: "Especiarias", pego: false }
            ];
            io.emit('ilhaInvadidaServidor', ilhaEstado);
        }
    });

    socket.on('atacarInimigoIlha', (dados) => {
        if (ilhaEstado.inimigos[dados.index]) {
            ilhaEstado.inimigos[dados.index].vida -= dados.dano;
            io.emit('atualizarInimigosIlha', ilhaEstado.inimigos);
        }
    });

    socket.on('saquearTesouro', (dados) => {
        if (ilhaEstado.tesouros[dados.index]) {
            ilhaEstado.tesouros[dados.index].pego = true;
            io.emit('atualizarTesourosIlha', ilhaEstado.tesouros);
        }
    });

    socket.on('disconnect', () => {
        delete jogadores[socket.id];
        io.emit('removerJogador', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Servidor de Invasão ativo na porta ${PORT}`); });
