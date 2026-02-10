const db = require('./database');
const XLSX = require('xlsx');

const nomeArquivo = 'Planilha Modelo.xlsx';

console.log("---------------------------------------------------");
console.log("🚀 INICIANDO IMPORTAÇÃO PARA NEDB (VERSÃO 3.0)");
console.log("---------------------------------------------------");

async function importar() {
    try {
        console.log(`📂 Lendo arquivo: ${nomeArquivo}`);
        const workbook = XLSX.readFile(nomeArquivo);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];

        // range: 2 pula as duas primeiras linhas (começa na 3)
        const dadosBrutos = XLSX.utils.sheet_to_json(worksheet, { range: 2 });

        console.log(`📊 Linhas de dados encontradas: ${dadosBrutos.length}`);

        if (dadosBrutos.length === 0) {
            throw new Error("❌ O Excel parece vazio ou o cabeçalho não está na linha 3.");
        }

        // --- DIAGNÓSTICO DE COLUNAS ---
        const chavesEncontradas = Object.keys(dadosBrutos[0]);
        const chaveExame = chavesEncontradas.find(k => k.trim().toUpperCase() === 'EXAMES');

        if (!chaveExame) {
            console.log("👀 Colunas detectadas:", chavesEncontradas);
            throw new Error("Coluna 'EXAMES' não encontrada. Verifique o Excel.");
        }

        // --- LIMPEZA DO BANCO (PROMISIFIED) ---
        console.log("🧹 Limpando catálogo de exames antigo...");
        await new Promise((resolve, reject) => {
            db.exames.remove({}, { multi: true }, (err, numRemoved) => {
                if (err) reject(err);
                else {
                    console.log(`🗑️  ${numRemoved} itens antigos removidos.`);
                    resolve();
                }
            });
        });

        // --- PROCESSAMENTO E INSERÇÃO ---
        let inseridos = 0;
        const novosItens = [];

        dadosBrutos.forEach((linha) => {
            // Normaliza chaves para MAIÚSCULO
            const l = {};
            Object.keys(linha).forEach(chave => {
                l[chave.trim().toUpperCase()] = linha[chave];
            });

            const nomeExame = l['EXAMES'];

            // Filtra linhas vazias ou que contenham a palavra TOTAL
            if (nomeExame && !nomeExame.toString().toUpperCase().includes('TOTAL')) {
                
                const tratarValor = (val) => {
                    if (typeof val === 'number') return val;
                    if (typeof val === 'string') {
                        return parseFloat(val.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;
                    }
                    return 0;
                };

                const valorUnit = tratarValor(l['V. UNT']);
                const rateio = l['PREVISTO NO CONT. DE RATEIO?'] || "Não";
                const qtdPrev = parseInt(l['QUANTIDADE MENSAL PREVISTA']) || 0;
                
                let valPrev = tratarValor(l['VALOR MENSAL PREVISTO']);
                if (valPrev === 0) valPrev = qtdPrev * valorUnit;

                novosItens.push({
                    descricao: nomeExame.toString().trim(),
                    valor_unitario: valorUnit,
                    rateio: rateio,
                    qtd_prevista: qtdPrev,
                    valor_previsto: valPrev
                });
            }
        });

        // Inserção em massa no NeDB
        await new Promise((resolve, reject) => {
            db.exames.insert(novosItens, (err, docs) => {
                if (err) reject(err);
                else {
                    inseridos = docs.length;
                    resolve();
                }
            });
        });

        console.log("---------------------------------------------------");
        console.log(`✅ SUCESSO! ${inseridos} exames importados para o NeDB.`);
        console.log("👉 O banco agora é NoSQL. Rode 'npm start' para testar.");
        console.log("---------------------------------------------------");

    } catch (e) {
        console.error("❌ FALHA NA IMPORTAÇÃO:", e.message);
    }
}

// Executa a função assíncrona
importar();