const db = require('./database');
const XLSX = require('xlsx');

const nomeArquivo = 'Planilha Modelo.xlsx';

console.log("---------------------------------------------------");
console.log("🚀 INICIANDO IMPORTAÇÃO DE DADOS (TENTATIVA 3)");
console.log("---------------------------------------------------");

try {
    console.log(`📂 Lendo arquivo: ${nomeArquivo}`);
    const workbook = XLSX.readFile(nomeArquivo);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];

    // AJUSTE CRÍTICO: range: 2 significa "Começar a ler na Linha 3 do Excel"
    const dadosBrutos = XLSX.utils.sheet_to_json(worksheet, { range: 2 });

    console.log(`📊 Linhas de dados encontradas: ${dadosBrutos.length}`);

    if (dadosBrutos.length === 0) {
        throw new Error("❌ O Excel parece vazio ou o range está errado.");
    }

    // --- BLOCO DE DIAGNÓSTICO ---
    // Pega a primeira linha para ver quais colunas o sistema detectou
    const primeiraLinha = dadosBrutos[0];
    const chavesEncontradas = Object.keys(primeiraLinha);
    
    // Procura a coluna EXAMES (ignorando maiúsculas/minúsculas)
    const chaveExame = chavesEncontradas.find(k => k.trim().toUpperCase() === 'EXAMES');

    if (!chaveExame) {
        console.log("\n❌ ERRO: Coluna 'EXAMES' não encontrada!");
        console.log("👀 Colunas que o sistema VIU na linha 3:", chavesEncontradas);
        console.log("⚠️ DICA: Verifique se o cabeçalho 'EXAMES' está mesmo na linha 3 do Excel.\n");
        throw new Error("Estrutura do Excel incompatível.");
    } else {
        console.log(`✅ Coluna correta encontrada: '${chaveExame}'`);
    }
    // ----------------------------

    db.serialize(() => {
        console.log("🧹 Limpando tabela antiga...");
        db.run("DELETE FROM exames");
        db.run("DELETE FROM sqlite_sequence WHERE name='exames'");

        const stmt = db.prepare(`
            INSERT INTO exames (descricao, valor_unitario, rateio, qtd_prevista, valor_previsto) 
            VALUES (?, ?, ?, ?, ?)
        `);

        let inseridos = 0;
        db.run("BEGIN TRANSACTION");

        dadosBrutos.forEach((linha) => {
            // Normaliza chaves para garantir leitura
            const l = {};
            Object.keys(linha).forEach(chave => {
                l[chave.trim().toUpperCase()] = linha[chave];
            });

            const nomeExame = l['EXAMES']; // Usa a chave normalizada

            // Filtra linhas vazias ou totais
            if (nomeExame && !nomeExame.toString().toUpperCase().includes('TOTAL')) {
                
                const tratarValor = (val) => {
                    if (typeof val === 'number') return val;
                    if (typeof val === 'string') {
                        // Remove R$, pontos de milhar e troca vírgula por ponto
                        return parseFloat(val.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;
                    }
                    return 0;
                };

                const valorUnit = tratarValor(l['V. UNT']);
                const rateio = l['PREVISTO NO CONT. DE RATEIO?'] || "Não";
                const qtdPrev = parseInt(l['QUANTIDADE MENSAL PREVISTA']) || 0;
                
                let valPrev = tratarValor(l['VALOR MENSAL PREVISTO']);
                if (valPrev === 0) valPrev = qtdPrev * valorUnit;

                stmt.run(nomeExame.toString().trim(), valorUnit, rateio, qtdPrev, valPrev);
                inseridos++;
            }
        });

        stmt.finalize();
        
        db.run("COMMIT", () => {
            console.log("---------------------------------------------------");
            console.log(`✅ SUCESSO! ${inseridos} exames foram gravados.`);
            console.log("👉 Agora sim: rode 'npm start'");
            console.log("---------------------------------------------------");
        });
    });

} catch (e) {
    console.error("❌ FALHA:", e.message);
}