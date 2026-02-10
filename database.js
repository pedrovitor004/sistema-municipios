const Datastore = require('nedb');
const path = require('path');
const util = require('util');

/** * --- PATCH DE COMPATIBILIDADE NEDB ---
 * Resolve o erro "util.isDate is not a function" nas versões recentes do Node.js
 */
if (!util.isDate) {
    util.isDate = (obj) => Object.prototype.toString.call(obj) === '[object Date]';
}
if (!util.isRegExp) {
    util.isRegExp = (obj) => Object.prototype.toString.call(obj) === '[object RegExp]';
}

// Lógica de detecção de ambiente (mantida exatamente como a sua)
let electron;
try {
    electron = require('electron');
} catch (e) {
    electron = null;
}

const app = electron ? (electron.app || (electron.remote ? electron.remote.app : null)) : null;

let baseDir;
if (app && app.isPackaged) {
    baseDir = app.getPath('userData');
} else if (app) {
    baseDir = __dirname;
} else {
    baseDir = path.resolve(__dirname);
}

console.log("📂 Banco de dados (NeDB) localizado em:", baseDir);

// Inicializando as "Tabelas" (Coleções)
const db = {};
db.exames = new Datastore({ filename: path.join(baseDir, 'exames.db'), autoload: true });
db.producao = new Datastore({ filename: path.join(baseDir, 'producao.db'), autoload: true });
db.municipios = new Datastore({ filename: path.join(baseDir, 'municipios.db'), autoload: true });
db.usuarios = new Datastore({ filename: path.join(baseDir, 'usuarios.db'), autoload: true });

// --- LÓGICA DE INICIALIZAÇÃO DE DADOS ---

// 1. Criar usuário ADMIN padrão
db.usuarios.findOne({ login: 'admin' }, (err, doc) => {
    if (!doc) {
        console.log("⚠️ Criando usuário padrão: admin / 1234");
        db.usuarios.insert({
            login: 'admin',
            senha: '1234',
            nome_completo: 'Administrador do System'
        });
    }
});

// 2. Inserção dos Municípios do CISCO
db.municipios.count({}, (err, count) => {
    if (count === 0) {
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
        
        db.municipios.insert(municipiosCisco, (err, newDocs) => {
            if (!err) console.log("✅ Municípios inseridos com sucesso!");
        });
    }
});

module.exports = db;