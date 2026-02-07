const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const db = require('./database');
const XLSX = require('xlsx');

// Variável global para controlar a janela principal
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
        db.get("SELECT * FROM usuarios WHERE login=? AND senha=?", [user, pass], (err, row) => {
            if (row) {
                mainWindow.setResizable(true);
                mainWindow.center();
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
        db.all("SELECT * FROM municipios ORDER BY nome ASC", [], (err, rows) => {
            resolve(rows || []);
        });
    });
});

// --- BUSCAR DADOS PARA A TELA DE LANÇAMENTO ---
ipcMain.handle('buscar-exames', async (e, { municipioId, mes }) => {
    return new Promise(resolve => {
        const sql = `
            SELECT 
                e.id, 
                e.descricao, 
                e.valor_unitario, 
                e.rateio, 
                e.qtd_prevista,
                e.valor_previsto,
                IFNULL(p.quantidade_realizada, 0) as qtd_realizada,
                IFNULL(p.quantidade_extra, 0) as qtd_extra
            FROM exames e 
            LEFT JOIN producao p ON e.id = p.exame_id 
                                 AND p.municipio_id = ? 
                                 AND p.mes_referencia = ?`;
        
        db.all(sql, [municipioId, mes], (err, rows) => {
            resolve(rows || []);
        });
    });
});

// --- NOVO: BUSCAR PRODUÇÃO CONSOLIDADA (GLOBAL) ---
ipcMain.handle('buscar-consolidado', async (e, mes) => {
    return new Promise(resolve => {
        const sql = `
            SELECT 
                m.nome as municipio,
                SUM(IFNULL(p.quantidade_realizada, 0) * e.valor_unitario) as total_executado,
                -- Cálculo simplificado de taxas: 20% do previsto + fixo (ajuste se necessário)
                (SUM(IFNULL(e.valor_previsto, 0)) * 0.2 + 1621) as taxas,
                0 as repasses
            FROM municipios m
            LEFT JOIN producao p ON m.id = p.municipio_id AND p.mes_referencia = ?
            LEFT JOIN exames e ON p.exame_id = e.id
            GROUP BY m.id, m.nome
            ORDER BY m.nome ASC
        `;
        
        db.all(sql, [mes], (err, rows) => {
            if (err) {
                console.error("Erro no consolidado:", err);
                resolve([]);
            } else {
                resolve(rows || []);
            }
        });
    });
});

ipcMain.handle('cadastrar-item', async (e, item) => {
    return new Promise(resolve => {
        const sql = `INSERT INTO exames (descricao, valor_unitario, rateio, qtd_prevista, valor_previsto) 
                     VALUES (?, ?, 'Não', 0, 0)`;
        
        db.run(sql, [item.descricao, item.valor], function(err) {
            if (err) {
                console.error("Erro ao cadastrar item:", err.message);
                resolve({ success: false, erro: err.message });
            } else {
                resolve({ success: true, id: this.lastID });
            }
        });
    });
});

ipcMain.handle('excluir-item', async (e, id) => {
    return new Promise(resolve => {
        db.run("DELETE FROM exames WHERE id = ?", [id], function(err) {
            if (err) resolve({ success: false, erro: err.message });
            else resolve({ success: true });
        });
    });
});

// --- ATUALIZAR ITEM (EDIÇÃO) ---
ipcMain.handle('editar-item', async (e, item) => {
    return new Promise(resolve => {
        const sql = `UPDATE exames SET descricao = ?, valor_unitario = ? WHERE id = ?`;
        db.run(sql, [item.descricao, item.valor, item.id], function(err) {
            if (err) resolve({ success: false, erro: err.message });
            else resolve({ success: true });
        });
    });
});

// --- BUSCAR TODOS OS ITENS (PARA A LISTA DE GERENCIAMENTO) ---
ipcMain.handle('listar-itens-catalogo', async () => {
    return new Promise(resolve => {
        db.all("SELECT id, descricao, valor_unitario FROM exames ORDER BY descricao ASC", [], (err, rows) => {
            resolve(rows || []);
        });
    });
});

// --- SALVAR PRODUÇÃO COMPLETA (TRANSAÇÃO) ---
ipcMain.handle('salvar-producao', async (e, lista) => {
    return new Promise(resolve => {
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            
            const stmtProducao = db.prepare(`
                INSERT INTO producao (municipio_id, exame_id, mes_referencia, quantidade_realizada, quantidade_extra) 
                VALUES (?,?,?,?,?) 
                ON CONFLICT(municipio_id, exame_id, mes_referencia) 
                DO UPDATE SET 
                    quantidade_realizada=excluded.quantidade_realizada,
                    quantidade_extra=excluded.quantidade_extra
            `);

            const stmtExames = db.prepare(`
                UPDATE exames 
                SET rateio = ?, qtd_prevista = ?, valor_previsto = ?
                WHERE id = ?
            `);

            lista.forEach(item => {
                stmtProducao.run(
                    item.municipio_id, 
                    item.exame_id, 
                    item.mes_referencia, 
                    item.quantidade_realizada,
                    item.quantidade_extra || 0
                );

                stmtExames.run(
                    item.rateio,
                    item.qtd_prevista,
                    item.valor_previsto,
                    item.exame_id
                );
            });

            stmtProducao.finalize();
            stmtExames.finalize();

            db.run("COMMIT", err => {
                if (err) {
                    console.error("Erro no Commit:", err.message);
                    resolve({ success: false, erro: err.message });
                } else {
                    resolve({ success: true });
                }
            });
        });
    });
});

// --- EXPORTAR EXCEL ---
ipcMain.handle('exportar-excel', async (e, { municipioId, nomeMunicipio, mes }) => {
    return new Promise(async (resolve) => {
        try {
            const sql = `
                SELECT 
                    e.descricao, e.valor_unitario, e.rateio, e.qtd_prevista, e.valor_previsto,
                    IFNULL(p.quantidade_realizada, 0) as realizado,
                    IFNULL(p.quantidade_extra, 0) as extra
                FROM exames e
                LEFT JOIN producao p ON e.id = p.exame_id 
                                     AND p.municipio_id = ? 
                                     AND p.mes_referencia = ?
            `;

            db.all(sql, [municipioId, mes], async (err, rows) => {
                if (err) return resolve({ success: false, erro: err.message });

                const dadosExcel = rows.map((item, index) => {
                    const totalExecutado = item.valor_unitario * (item.realizado + item.extra);
                    const saldo = item.valor_previsto - totalExecutado;

                    return {
                        "ITEM": String(index + 1).padStart(3, '0'),
                        "EXAMES": item.descricao,
                        "V. UNT": item.valor_unitario,
                        "RATEIO?": item.rateio,
                        "QTD PREVISTA": item.qtd_prevista,
                        "VALOR PREVISTO": item.valor_previsto,
                        "QTD REALIZADA": item.realizado,
                        "CONSULTAS EXTRAS": item.extra,
                        "VALOR EXECUTADO": totalExecutado,
                        "SALDO": saldo
                    };
                });

                const { filePath } = await dialog.showSaveDialog({
                    title: `Relatório ${nomeMunicipio}`,
                    defaultPath: `Relatorio_${nomeMunicipio}_${mes}.xlsx`,
                    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
                });

                if (!filePath) return resolve({ success: false, cancelado: true });

                const ws = XLSX.utils.json_to_sheet(dadosExcel);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Relatório");
                XLSX.writeFile(wb, filePath);
                
                resolve({ success: true });
            });
        } catch (error) {
            console.error(error);
            resolve({ success: false, erro: error.message });
        }
    });
});

// Inicialização da App
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});