/**
 * main.js - Processo Principal CISCO
 * Versão: 4.1 (Correção de Tipagem de Dados e IDs)
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const db = require('./database'); 
const XLSX = require('xlsx');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1250,
        height: 850,
        resizable: true,
        autoHideMenuBar: true,
        title: "Gestão Municípios CISCO",
        icon: path.join(__dirname, 'assets/ciscoico.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false 
        }
    });

    mainWindow.loadFile('login.html');
}

// --- AUTENTICAÇÃO ---
ipcMain.handle('login', async (e, { user, pass }) => {
    return new Promise(resolve => {
        db.usuarios.findOne({ login: user, senha: pass }, (err, doc) => {
            if (doc) {
                mainWindow.maximize();
                mainWindow.loadFile('dashboard.html');
                resolve({ success: true });
            } else {
                resolve({ success: false });
            }
        });
    });
});

// --- MUNICÍPIOS (Correção: Garante que docs não sejam nulos) ---
ipcMain.handle('get-municipios', async () => {
    return new Promise(resolve => {
        db.municipios.find({}).sort({ nome: 1 }).exec((err, docs) => {
            if (err) {
                console.error("Erro ao buscar municípios:", err);
                resolve([]);
            }
            resolve(docs || []);
        });
    });
});

ipcMain.handle("buscarEstatisticas", async (event, mes) => {

    const municipios = await new Promise(res =>
        db.municipios.find({}, (err, docs) => res(docs || []))
    );

    const exames = await new Promise(res =>
        db.exames.find({}, (err, docs) => res(docs || []))
    );

    const producoes = await new Promise(res =>
        db.producao.find({ mes_referencia: mes }, (err, docs) => res(docs || []))
    );

    const resultado = [];

    for (const prod of producoes) {

        const municipio = municipios.find(m => 
            String(m._id) === String(prod.municipio_id)
        );

        const exame = exames.find(e => 
            String(e._id) === String(prod.exame_id)
        );

        if (municipio && exame) {
            resultado.push({
                municipio: municipio.nome,
                procedimento: exame.descricao,
                quantidade: prod.quantidade_realizada || 0,
                total: (prod.quantidade_realizada || 0) * (exame.valor_unitario || 0)
            });
        }
    }

    console.log("Resultado final estatísticas:", resultado);

    return resultado;
});

// --- BUSCA PARA GESTÃO (Tabela com Rateio e Metas unificadas) ---
ipcMain.handle('buscar-exames', async (e, { municipioId, mes }) => {
    return new Promise((resolve) => {
        db.exames.find({}).sort({ descricao: 1 }).exec((err, exames) => {
            db.producao.find({ municipio_id: municipioId, mes_referencia: mes }, (err, producoes) => {
                const resultado = exames.map(exame => {
                    const prod = producoes.find(p => p.exame_id === exame._id);
                    return {
                        ...exame,
                        id: exame._id, // Padronização de ID para o renderer
                        qtd_realizada: prod ? prod.quantidade_realizada : 0,
                        qtd_extra: prod ? prod.quantidade_extra : 0,
                        // Mantém os dados de meta que já estão no cadastro do exame
                        qtd_prevista: exame.qtd_prevista || 0,
                        rateio: exame.rateio || 'Não'
                    };
                });
                resolve(resultado);
            });
        });
    });
});

// --- GERENCIAMENTO DO CATÁLOGO ---
ipcMain.handle('listar-itens-catalogo', async () => {
    return new Promise(resolve => {
        db.exames.find({}).sort({ descricao: 1 }).exec((err, docs) => {
            resolve(docs || []);
        });
    });
});

ipcMain.handle('cadastrar-item', async (e, item) => {
    return new Promise(resolve => {
        const novo = { 
            descricao: item.descricao, 
            valor_unitario: item.valor, 
            rateio: 'Não', 
            qtd_prevista: 0, 
            valor_previsto: 0 
        };
        db.exames.insert(novo, (err, doc) => {
            if (err) resolve({ success: false, erro: err.message });
            else resolve({ success: true, id: doc._id });
        });
    });
});

ipcMain.handle('editar-item', async (e, item) => {
    return new Promise(resolve => {
        db.exames.update({ _id: item.id }, { $set: { descricao: item.descricao, valor_unitario: item.valor } }, {}, (err) => {
            if (err) resolve({ success: false, erro: err.message });
            else resolve({ success: true });
        });
    });
});

ipcMain.handle('excluir-item', async (e, id) => {
    return new Promise(resolve => {
        db.exames.remove({ _id: id }, {}, (err) => {
            if (err) resolve({ success: false, erro: err.message });
            else resolve({ success: true });
        });
    });
});

// --- SALVAR PRODUÇÃO (Polimórfico: Aceita Array ou Objeto) ---
ipcMain.handle('salvar-producao', async (e, dados) => {
    try {
        // Detecta se vem do Lançamento Rápido (Array) ou Gestão (Objeto com .lista)
        const lista = Array.isArray(dados) ? dados : dados.lista;
        const lancamentoRapido = Array.isArray(dados) ? dados[0]?.is_lancamento_rapido : dados.isLancamentoRapido;

        for (const item of lista) {
            // 1. Atualiza Metas no Catálogo (Apenas se for Gestão Geral)
            if (!lancamentoRapido) {
                await new Promise(res => {
                    db.exames.update({ _id: item.exame_id }, { 
                        $set: { 
                            rateio: item.rateio, 
                            qtd_prevista: item.qtd_prevista, 
                            valor_previsto: item.valor_previsto 
                        } 
                    }, {}, res);
                });
            }

            // 2. Atualiza ou Insere a Produção Mensal
            await new Promise(res => {
                db.producao.update(
                    { 
                        municipio_id: item.municipio_id, 
                        exame_id: item.exame_id, 
                        mes_referencia: item.mes_referencia 
                    },
                    { 
                        $set: { 
                            quantidade_realizada: item.quantidade_realizada, 
                            quantidade_extra: item.quantidade_extra || 0 
                        } 
                    },
                    { upsert: true },
                    res
                );
            });
        }
        return { success: true };
    } catch (err) {
        console.error("Erro ao salvar produção:", err);
        return { success: false, erro: err.message };
    }
});

// --- RELATÓRIO CONSOLIDADO ---
ipcMain.handle('buscar-consolidado', async (e, mes) => {
    return new Promise(async (resolve) => {
        db.municipios.find({}).sort({ nome: 1 }).exec(async (err, munis) => {
            const relatorio = [];
            for (const m of munis) {
                const prods = await new Promise(res => db.producao.find({ municipio_id: m._id, mes_referencia: mes }, (e, d) => res(d)));
                
                let totalExec = 0;
                let totalPrev = 0;

                for (const p of prods) {
                    const exame = await new Promise(res => db.exames.findOne({ _id: p.exame_id }, (e, d) => res(d)));
                    if (exame) {
                        totalExec += (p.quantidade_realizada || 0) * (exame.valor_unitario || 0);
                        totalPrev += (exame.valor_previsto || 0);
                    }
                }

                relatorio.push({
                    municipio: m.nome,
                    total_executado: totalExec,
                    taxas: (totalPrev * 0.2) + 1621,
                    repasses: 0
                });
            }
            resolve(relatorio);
        });
    });
});

// --- EXPORTAÇÃO EXCEL ---
ipcMain.handle('exportar-excel', async (e, { municipioId, nomeMunicipio, mes }) => {
    try {
        const exames = await new Promise(res => db.exames.find({}).sort({ descricao: 1 }).exec((err, d) => res(d)));
        const producoes = await new Promise(res => db.producao.find({ municipio_id: municipioId, mes_referencia: mes }, (err, d) => res(d)));

        const dadosPlanilha = exames.map(ex => {
            const p = producoes.find(prod => prod.exame_id === ex._id);
            const realizada = p ? p.quantidade_realizada : 0;
            return {
                Procedimento: ex.descricao,
                'Valor Unitário': ex.valor_unitario,
                'Qtd Prevista': ex.qtd_prevista,
                'Qtd Realizada': realizada,
                'Valor Executado': realizada * ex.valor_unitario
            };
        });

        const ws = XLSX.utils.json_to_sheet(dadosPlanilha);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Produção");

        const { filePath } = await dialog.showSaveDialog({
            title: 'Salvar Relatório Excel',
            defaultPath: `Relatorio_${nomeMunicipio}_${mes}.xlsx`,
            filters: [{ name: 'Excel', extensions: ['xlsx'] }]
        });

        if (filePath) {
            XLSX.writeFile(wb, filePath);
            return { success: true };
        }
        return { success: false, erro: 'Operação cancelada' };
    } catch (err) {
        return { success: false, erro: err.message };
    }
});

// INICIALIZAÇÃO
app.whenReady().then(createWindow);

app.on('window-all-closed', () => { 
    if (process.platform !== 'darwin') app.quit(); 
});