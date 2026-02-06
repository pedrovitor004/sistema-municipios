// renderer.js - VERSÃO COM TABELA E RODAPÉ COMPLETOS

const corpoTabela = document.getElementById('tabela-producao');
const selectMunicipio = document.getElementById('select-municipio');
const btnCarregar = document.getElementById('btn-carregar');

// Referências ao Rodapé
const footerTotalPrevisto = document.getElementById('footer-total-previsto');
const footerSaldoMes = document.getElementById('footer-saldo-mes');
const footerTotalExecutado = document.getElementById('footer-total-executado');
const footerTotalFinal = document.getElementById('footer-total-final');

// Inputs do Rodapé
const inputTaxaAdm = document.getElementById('input-taxa-adm');
const inputTaxaExtra = document.getElementById('input-taxa-extra');
const inputRepasseCriamc = document.getElementById('input-repasse-criamc');
const inputRepasseAgro = document.getElementById('input-repasse-agro');

// Formatação R$
const formatarMoeda = (val) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const limparMoeda = (texto) => parseFloat(texto.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;

window.onload = async () => {
    try {
        const municipios = await window.api.getMunicipios();
        municipios.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.nome;
            selectMunicipio.appendChild(opt);
        });
    } catch (e) { console.error(e); }
};

btnCarregar.addEventListener('click', async () => {
    const municipioId = selectMunicipio.value;
    const mes = document.getElementById('mes-ref').value;

    if (!municipioId || !mes) return alert("Selecione Município e Mês!");

    corpoTabela.innerHTML = '<tr><td colspan="10" class="text-center p-4 text-blue-600">Carregando planilha...</td></tr>';

    const dados = await window.api.buscarExames({ municipioId, mes });
    corpoTabela.innerHTML = '';

    if (!dados || dados.length === 0) return alert("Nenhum dado encontrado.");

    dados.forEach(item => {
        // Valores base
        const vUnit = Number(item.valor_unitario) || 0;
        
        // Planejamento
        const rateio = item.rateio || 'Não'; 
        const qtdPrev = item.qtd_prevista !== null ? Number(item.qtd_prevista) : 0;
        // Se existe valor previsto no banco, usa ele. Se não, calcula.
        const valPrev = item.valor_previsto !== null ? Number(item.valor_previsto) : (qtdPrev * vUnit);

        // Execução
        const qtdReal = Number(item.qtd_realizada) || 0;
        const qtdExtra = Number(item.qtd_extra) || 0;

        // Cálculos linha
        const valExecutado = (qtdReal + qtdExtra) * vUnit;
        const saldo = valPrev - valExecutado;

        const tr = document.createElement('tr');
        tr.className = "hover:bg-blue-50 transition odd:bg-white even:bg-gray-50 group";

        tr.innerHTML = `
            <td class="p-2 border-r text-center text-gray-500 text-[10px]">${item.id}</td>

            <td class="p-2 border-r text-left truncate max-w-xs font-medium text-xs" title="${item.descricao}">
                ${item.descricao}
            </td>

            <td class="p-2 border-r text-right text-gray-600 font-mono text-xs">
                ${formatarMoeda(vUnit)}
            </td>

            <td class="p-1 border-r text-center bg-yellow-50">
                <select class="w-full text-[10px] bg-transparent outline-none text-center cursor-pointer" 
                    data-id="${item.id}" data-tipo="rateio">
                    <option value="Não" ${rateio === 'Não' ? 'selected' : ''}>Não</option>
                    <option value="Sim" ${rateio === 'Sim' ? 'selected' : ''}>Sim</option>
                </select>
            </td>

            <td class="p-1 border-r text-center bg-yellow-50">
                <input type="number" min="0" value="${qtdPrev}" 
                    class="input-calc w-full bg-transparent text-center outline-none text-gray-700 font-mono text-xs focus:bg-white focus:ring-1 focus:ring-yellow-400"
                    data-id="${item.id}" data-tipo="prevista" data-preco="${vUnit}">
            </td>

            <td class="p-1 border-r text-right bg-yellow-50">
                 <input type="number" step="0.01" value="${valPrev.toFixed(2)}" 
                    class="input-calc val-previsto-row w-full bg-transparent text-right outline-none text-blue-700 font-bold text-[11px] focus:bg-white focus:ring-1 focus:ring-yellow-400"
                    id="input-val-prev-${item.id}"
                    data-id="${item.id}" data-tipo="val-previsto">
            </td>

            <td class="p-1 border-r text-center bg-white">
                <input type="number" min="0" value="${qtdReal > 0 ? qtdReal : ''}" 
                    class="input-calc w-full border border-blue-200 rounded text-center text-blue-900 font-bold text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    data-id="${item.id}" data-tipo="real" data-preco="${vUnit}">
            </td>

            <td class="p-1 border-r text-center bg-white">
                <input type="number" min="0" value="${qtdExtra > 0 ? qtdExtra : ''}" 
                    class="input-calc w-full border border-orange-200 rounded text-center text-orange-900 font-bold text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                    data-id="${item.id}" data-tipo="extra" data-preco="${vUnit}">
            </td>

            <td class="p-2 border-r text-right font-bold text-gray-700 bg-gray-100 text-[11px] val-executado-row" id="exec-${item.id}">
                ${formatarMoeda(valExecutado)}
            </td>

            <td class="p-2 text-right font-bold ${saldo >= 0 ? 'text-green-600' : 'text-red-600'} bg-gray-100 text-[11px]" id="saldo-${item.id}">
                ${formatarMoeda(saldo)}
            </td>
        `;
        corpoTabela.appendChild(tr);
    });

    // Calcula o rodapé logo após carregar
    recalcularRodapeCompleto();
});

// --- LÓGICA DE CÁLCULO E EVENTOS ---

// 1. Monitora mudanças na TABELA
corpoTabela.addEventListener('input', (e) => {
    if (e.target.classList.contains('input-calc')) {
        const tr = e.target.closest('tr');
        const id = e.target.dataset.id;
        const vUnit = parseFloat(e.target.dataset.preco) || 0;
        const tipoAlterado = e.target.dataset.tipo;

        // Auto-cálculo de Valor Previsto
        if (tipoAlterado === 'prevista') {
            const novaQtdPrevista = parseFloat(e.target.value) || 0;
            const novoValorPrevisto = novaQtdPrevista * vUnit;
            const inputValPrev = document.getElementById(`input-val-prev-${id}`);
            if(inputValPrev) inputValPrev.value = novoValorPrevisto.toFixed(2);
        }

        // Recupera valores para recalcular linha
        const inputValPrev = document.getElementById(`input-val-prev-${id}`);
        const inpReal = tr.querySelector('input[data-tipo="real"]');
        const inpExtra = tr.querySelector('input[data-tipo="extra"]');

        const valPrevisto = parseFloat(inputValPrev.value) || 0;
        const qtdReal = parseFloat(inpReal.value) || 0;
        const qtdExtra = parseFloat(inpExtra.value) || 0;

        // Contas da linha
        const valExecutado = (qtdReal + qtdExtra) * vUnit;
        const saldo = valPrevisto - valExecutado;

        // Atualiza HTML da linha
        const tdExec = document.getElementById(`exec-${id}`);
        const tdSaldo = document.getElementById(`saldo-${id}`);

        tdExec.innerText = formatarMoeda(valExecutado);
        tdSaldo.innerText = formatarMoeda(saldo);
        tdSaldo.className = `p-2 text-right font-bold text-[11px] bg-gray-100 val-saldo-row ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`;

        // Recalcula o rodapé geral
        recalcularRodapeCompleto();
    }
});

// 2. Monitora mudanças nos INPUTS DO RODAPÉ (Taxas e Repasses)
[inputTaxaAdm, inputTaxaExtra, inputRepasseCriamc, inputRepasseAgro].forEach(input => {
    input.addEventListener('input', recalcularRodapeCompleto);
});

// 3. FUNÇÃO PRINCIPAL DE CÁLCULO TOTAL
function recalcularRodapeCompleto() {
    let totalPrevisto = 0;
    let totalExecutado = 0;

    // A. Soma Previsto (inputs hidden na tabela)
    document.querySelectorAll('.val-previsto-row').forEach(inp => {
        totalPrevisto += (parseFloat(inp.value) || 0);
    });
    
    // B. Soma Executado (texto da célula da tabela)
    document.querySelectorAll('.val-executado-row').forEach(td => {
        totalExecutado += limparMoeda(td.innerText);
    });

    // C. Saldo Geral
    const saldoGeral = totalPrevisto - totalExecutado;

    // Atualiza Painel Superior
    footerTotalPrevisto.innerText = formatarMoeda(totalPrevisto);
    footerSaldoMes.innerText = formatarMoeda(saldoGeral);
    footerSaldoMes.className = saldoGeral >= 0 ? "text-xl font-bold text-green-600" : "text-xl font-bold text-red-600";

    // D. Atualiza Painel Inferior (Repasse)
    footerTotalExecutado.innerText = formatarMoeda(totalExecutado);

    // Soma Extras do Rodapé
    const taxaAdm = parseFloat(inputTaxaAdm.value) || 0;
    const taxaExtra = parseFloat(inputTaxaExtra.value) || 0;
    const repasseCriamc = parseFloat(inputRepasseCriamc.value) || 0;
    const repasseAgro = parseFloat(inputRepasseAgro.value) || 0;

    // CALCULO FINAL: Executado + Taxas + Repasses = Total a Pagar
    const totalFinal = totalExecutado + taxaAdm + taxaExtra + repasseCriamc + repasseAgro;

    footerTotalFinal.innerText = formatarMoeda(totalFinal);
}

// --- BOTÃO SALVAR (MANTIDO) ---
document.getElementById('btn-salvar').addEventListener('click', async () => {
    const dadosParaSalvar = [];
    const municipioId = selectMunicipio.value;
    const mes = document.getElementById('mes-ref').value;

    if (!municipioId || !mes) return alert("Preencha os filtros!");

    corpoTabela.querySelectorAll('tr').forEach(tr => {
        const inpReal = tr.querySelector('input[data-tipo="real"]');
        if (inpReal) {
            const id = inpReal.dataset.id;
            const selectRateio = tr.querySelector('select[data-tipo="rateio"]');
            const inpPrevista = tr.querySelector('input[data-tipo="prevista"]');
            const inpValPrev = document.getElementById(`input-val-prev-${id}`);
            const inpExtra = tr.querySelector('input[data-tipo="extra"]');

            dadosParaSalvar.push({
                municipio_id: parseInt(municipioId),
                mes_referencia: mes,
                exame_id: parseInt(id),
                rateio: selectRateio.value,
                qtd_prevista: parseInt(inpPrevista.value) || 0,
                valor_previsto: parseFloat(inpValPrev.value) || 0,
                quantidade_realizada: parseInt(inpReal.value) || 0,
                quantidade_extra: parseInt(inpExtra.value) || 0
            });
        }
    });

    if (dadosParaSalvar.length === 0) return alert("Nada para salvar.");

    const res = await window.api.salvarProducao(dadosParaSalvar);
    if (res.success) {
        alert("✅ Produção salva com sucesso!");
        // Opcional: Aqui você poderia salvar as taxas do rodapé em outra tabela do banco se necessário
    } else {
        alert("❌ Erro ao salvar: " + res.erro);
    }
});
// Faz o HTML "enxergar" a função de trocar abas
window.showTab = function(tabId) {
    const tabProducao = document.getElementById('tab-producao');
    const tabCadastro = document.getElementById('tab-cadastro-itens');
    const btnProd = document.querySelector('button[onclick*="producao"]');
    const btnCad = document.querySelector('button[onclick*="cadastro-itens"]');

    if (tabId === 'producao') {
        tabProducao.classList.remove('hidden');
        tabCadastro.classList.add('hidden');
        // Ajuste visual dos botões
        btnProd.classList.add('bg-blue-800', 'border');
        btnCad.classList.remove('bg-blue-800', 'border');
    } else {
        tabProducao.classList.add('hidden');
        tabCadastro.classList.remove('hidden');
        // Ajuste visual dos botões
        btnCad.classList.add('bg-blue-800', 'border');
        btnProd.classList.remove('bg-blue-800', 'border');
    }
};