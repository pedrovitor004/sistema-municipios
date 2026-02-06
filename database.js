// database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Tenta carregar o electron, mas não trava se não conseguir (ex: rodando via node puro)
let electron;
try {
    electron = require('electron');
} catch (e) {
    electron = null;
}

const app = electron ? (electron.app || (electron.remote ? electron.remote.app : null)) : null;

let dbPath;

// LÓGICA DE DETECÇÃO DE AMBIENTE:
if (app && app.isPackaged) {
    // 1. MODO PRODUÇÃO (.exe): Pasta AppData
    dbPath = path.join(app.getPath('userData'), 'sistema.db');
} else if (app) {
    // 2. MODO DESENVOLVIMENTO (npm start): Pasta do projeto
    dbPath = path.join(__dirname, 'sistema.db');
} else {
    // 3. MODO SCRIPT (node setup_dados.js): Pasta do projeto via Node puro
    dbPath = path.resolve(__dirname, 'sistema.db');
}

console.log("📂 Banco de dados localizado em:", dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Erro crítico ao abrir o banco:', err.message);
    } else {
        console.log('✅ Banco de dados conectado com sucesso!');
    }
});

// Mantemos sua lógica de criação de tabelas e inserção de municípios abaixo
db.serialize(() => {
    // Tabela de Itens (Exames)
    db.run(`CREATE TABLE IF NOT EXISTS exames (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        descricao TEXT,
        valor_unitario REAL,
        rateio TEXT,
        qtd_prevista INTEGER,
        valor_previsto REAL
    )`);

    // Tabela de Produção
    db.run(`CREATE TABLE IF NOT EXISTS producao (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        municipio_id INTEGER,
        exame_id INTEGER,
        mes_referencia TEXT,
        quantidade_realizada INTEGER,
        quantidade_extra INTEGER, -- Adicionei esse campo pois vi no seu renderer
        FOREIGN KEY(exame_id) REFERENCES exames(id),
        UNIQUE(municipio_id, exame_id, mes_referencia)
    )`);

    // Tabela de Municípios
    db.run(`CREATE TABLE IF NOT EXISTS municipios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT,
        cnpj TEXT
    )`);

    // Tabela de Usuários
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        login TEXT UNIQUE,
        senha TEXT,
        nome_completo TEXT
    )`);

    // Cria o usuário ADMIN padrão
    db.get("SELECT * FROM usuarios WHERE login = 'admin'", (err, row) => {
        if (!row) {
            console.log("⚠️ Criando usuário padrão: admin / 1234");
            const stmt = db.prepare("INSERT INTO usuarios (login, senha, nome_completo) VALUES (?, ?, ?)");
            stmt.run('admin', '1234', 'Administrador do Sistema');
            stmt.finalize();
        }
    });

    // INSERÇÃO DOS MUNICÍPIOS DO CISCO
    db.get("SELECT count(*) as qtd FROM municipios", (err, row) => {
        if (row && row.qtd === 0) {
            console.log("Inserindo municípios do CISCO...");
            
            const municipiosCisco = [
                { nome: "CISCO", cnpj: "02.471.378/0001-07" },
                { nome: "AMPARO", cnpj: "01.612.473/0001-02" },
                { nome: "MONTEIRO", cnpj: "09.073.628/0001-91" },
                { nome: "CAMALAÚ", cnpj: "09.073.271/0001-41" },
                { nome: "CARAÚBAS", cnpj: "01.612.638/0001-46" },
                { nome: "CONGO", cnpj: "08.870.164/0001-81" },
                { nome: "COXIXOLA", cnpj: "01.612.757/0001-07" },
                { nome: "GURJÃO", cnpj: "09.073.685/0001-70" },
                { nome: "LIVRAMENTO", cnpj: "08.738.916/0001-55" },
                { nome: "OURO VELHO", cnpj: "08.872.459/0001-97" },
                { nome: "PARARI", cnpj: "01.612.532/0001-42" },
                { nome: "PRATA", cnpj: "18.260.505/0001-50" },
                { nome: "SÃO JOÃO DO CARIRI", cnpj: "09.074.345/0001-64" },
                { nome: "SÃO JOSÉ DOS CORDEIROS", cnpj: "08.873.226/0001-09" },
                { nome: "SÃO JOÃO DO TIGRE", cnpj: "09.074.592/0001-60" },
                { nome: "SÃO SEBASTIÃO DO UMBUZEIRO", cnpj: "09.074.998/0001-43" },
                { nome: "SERRA BRANCA", cnpj: "08.874.695/0001-42" },
                { nome: "SUMÉ", cnpj: "08.874.935/0001-09" },
                { nome: "ZABELÊ", cnpj: "01.612.642/0001-04" }
            ];

            const stmt = db.prepare("INSERT INTO municipios (nome, cnpj) VALUES (?, ?)");
            municipiosCisco.forEach(city => {
                stmt.run(city.nome, city.cnpj);
            });
            stmt.finalize();
            console.log("Municípios inseridos com sucesso!");
        }
    });
});

module.exports = db;