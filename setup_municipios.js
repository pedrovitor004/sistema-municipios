const db = require('./database');
const lista = [
    "Araruna", "Bananeiras", "Cacimba de Dentro", "Solânea", // Adicione os 18 aqui
    "Belém", "Dona Inês", "Tacima", "Riachão"
];

db.serialize(() => {
    lista.forEach(nome => {
        db.run("INSERT OR IGNORE INTO municipios (nome) VALUES (?)", [nome]);
    });
    console.log("18 Municípios configurados!");
});