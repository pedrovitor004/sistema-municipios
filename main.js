const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const db = require('./database'); // Certifique-se que seu database.js exporta { usuarios, municipios, exames, producao }
const XLSX = require('xlsx');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
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

// --- ROTA DE LOGIN ---
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

// --- LISTAR MUNICÍPIOS ---
ipcMain.handle('get-municipios', async () => {
    return new Promise(resolve => {
        db.municipios.find({}).sort({ nome: 1 }).exec((err, docs) => {
            resolve(docs || []);
        });
    });
});

// --- BUSCAR DADOS PARA A TELA DE LANÇAMENTO ---
ipcMain.handle('buscar-exames', async (e, { municipioId, mes }) => {
    return new Promise(async (resolve) => {
        // No NeDB, fazemos o "Join" manualmente: buscamos exames e depois a produção
        db.exames.find({}).sort({ descricao: 1 }).exec((err, exames) => {
            db.producao.find({ municipio_id: municipioId, mes_referencia: mes }, (err, producoes) => {
                const resultado = exames.map(exame => {
                    const prod = producoes.find(p => p.exame_id === (exame._id || exame.id));
                    return {
                        ...exame,
                        id: exame._id || exame.id, // Garante compatibilidade de ID
                        qtd_realizada: prod ? prod.quantidade_realizada : 0,
                        qtd_extra: prod ? prod.quantidade_extra : 0
                    };
                });
                resolve(resultado);
            });
        });
    });
});

// --- BUSCAR TODOS OS ITENS (PARA A LISTA DE GERENCIAMENTO) ---
ipcMain.handle('listar-itens-catalogo', async () => {
    return new Promise(resolve => {
        db.exames.find({}).sort({ descricao: 1 }).exec((err, docs) => {
            resolve(docs || []);
        });
    });
});

// --- CADASTRAR/EDITAR/EXCLUIR ITENS ---
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

// --- SALVAR PRODUÇÃO COMPLETA ---
ipcMain.handle('salvar-producao', async (e, lista) => {
    try {
        for (const item of lista) {
            // 1. Atualiza dados no catálogo de exames (rateio/previsto)
            await new Promise(res => {
                db.exames.update({ _id: item.exame_id }, { 
                    $set: { 
                        rateio: item.rateio, 
                        qtd_prevista: item.qtd_prevista, 
                        valor_previsto: item.valor_previsto 
                    } 
                }, {}, res);
            });

            // 2. Upsert na tabela de produção
            await new Promise(res => {
                db.producao.update(
                    { municipio_id: item.municipio_id, exame_id: item.exame_id, mes_referencia: item.mes_referencia },
                    { $set: { quantidade_realizada: item.quantidade_realizada, quantidade_extra: item.quantidade_extra } },
                    { upsert: true },
                    res
                );
            });
        }
        return { success: true };
    } catch (err) {
        return { success: false, erro: err.message };
    }
});

// --- BUSCAR CONSOLIDADO (GLOBAL) ---
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
                        totalExec += p.quantidade_realizada * exame.valor_unitario;
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

// --- EXPORTAR EXCEL ---
ipcMain.handle('exportar-excel', async (e, { municipioId, nomeMunicipio, mes }) => {
    // A lógica de exportação segue o padrão do buscar-exames, convertendo para planilha
    // Use o código de busca de exames acima e formate os dados antes de XLSX.writeFile
    // (Omitido por brevidade, mas segue a mesma lógica de Join manual do NeDB)
});

// Inicialização
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });