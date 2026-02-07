/**
 * renderer.js - Gestão de Produção CISCO
 * Versão: 3.0 (Com Produção Consolidada e Filtros)
 */

// --- REFERÊNCIAS GERAIS ---
const corpoTabela = document.getElementById('tabela-producao');
const corpoConsolidado = document.getElementById('tabela-consolidada');
const selectMunicipio = document.getElementById('select-municipio');
const btnCarregar = document.getElementById('btn-carregar');
const inputBusca = document.getElementById('input-busca-exame');

// Referências ao Rodapé de Lançamento
const footerTotalPrevisto = document.getElementById('footer-total-previsto');
const footerSaldoMes = document.getElementById('footer-saldo-mes');
const footerTotalExecutado = document.getElementById('footer-total-executado');
const footerTotalFinal = document.getElementById('footer-total-final');

// Inputs de Taxas e Repasses
const inputTaxaAdm = document.getElementById('input-taxa-adm');
const inputTaxaExtra = document.getElementById('input-taxa-extra');
const inputRepasseCriamc = document.getElementById('input-repasse-criamc');
const inputRepasseAgro = document.getElementById('input-repasse-agro');

// Utilitários
const formatarMoeda = (val) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const limparMoeda = (texto) => {
    if (!texto) return 0;
    return parseFloat(texto.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;
};

// --- INICIALIZAÇÃO ---
window.onload = async () => {
    try {
        const municipios = await window.api.getMunicipios();
        municipios.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.nome;
            selectMunicipio.appendChild(opt);
        });
    } catch (e) { console.error("Erro ao carregar municípios:", e); }
};

// --- ABA: LANÇAMENTO DE PRODUÇÃO ---

btnCarregar.addEventListener('click', async () => {
    const municipioId = selectMunicipio.value;
    const mes = document.getElementById('mes-ref').value;

    if (!municipioId || !mes) return alert("Por favor, selecione o Município e o Mês!");

    inputBusca.value = ''; 
    corpoTabela.innerHTML = '<tr><td colspan="10" class="text-center p-4 text-blue-600 font-bold">Buscando dados...</td></tr>';

    try {
        const dados = await window.api.buscarExames({ municipioId, mes });
        corpoTabela.innerHTML = '';

        if (!dados || dados.length === 0) {
            corpoTabela.innerHTML = '<tr><td colspan="10" class="text-center p-4 text-gray-500">Nenhum dado encontrado.</td></tr>';
            return;
        }

        dados.forEach(item => {
            const vUnit = Number(item.valor_unitario) || 0;
            const qtdPrev = item.qtd_prevista !== null ? Number(item.qtd_prevista) : 0;
            const qtdReal = Number(item.qtd_realizada) || 0;
            const valPrev = qtdPrev * vUnit;
            const qtdExtra = Math.max(0, qtdReal - qtdPrev);
            const valExecutado = qtdReal * vUnit;
            const saldoLinha = valPrev - valExecutado;

            const tr = document.createElement('tr');
            tr.className = "hover:bg-blue-50 transition odd:bg-white even:bg-gray-50 border-b";
            tr.innerHTML = `
                <td class="p-2 border-r text-center text-gray-500 text-[10px]">${item.id}</td>
                <td class="p-2 border-r text-left font-medium text-xs">${item.descricao}</td>
                <td class="p-2 border-r text-right text-gray-600 font-mono text-xs">${formatarMoeda(vUnit)}</td>
                <td class="p-1 border-r text-center bg-yellow-50">
                    <select class="w-full text-[10px] bg-transparent outline-none text-center" data-id="${item.id}" data-tipo="rateio">
                        <option value="Não" ${item.rateio === 'Não' ? 'selected' : ''}>Não</option>
                        <option value="Sim" ${item.rateio === 'Sim' ? 'selected' : ''}>Sim</option>
                    </select>
                </td>
                <td class="p-1 border-r text-center bg-yellow-50">
                    <input type="number" min="0" value="${qtdPrev}" class="input-calc w-full bg-transparent text-center outline-none text-xs" data-id="${item.id}" data-tipo="prevista" data-preco="${vUnit}">
                </td>
                <td class="p-1 border-r text-right bg-yellow-50 font-bold text-blue-700 text-[11px]">
                     <span id="val-prev-display-${item.id}">${formatarMoeda(valPrev)}</span>
                     <input type="hidden" class="val-previsto-row" id="input-val-prev-${item.id}" value="${valPrev.toFixed(2)}">
                </td>
                <td class="p-1 border-r text-center bg-white">
                    <input type="number" min="0" value="${qtdReal || ''}" class="input-calc w-full border border-blue-200 rounded text-center text-blue-900 font-bold text-xs outline-none" data-id="${item.id}" data-tipo="real" data-preco="${vUnit}">
                </td>
                <td class="p-1 border-r text-center bg-gray-50 font-bold text-orange-600 text-xs" id="extra-${item.id}">${qtdExtra}</td>
                <td class="p-2 border-r text-right font-bold text-gray-700 bg-gray-100 text-[11px] val-executado-row" id="exec-${item.id}">${formatarMoeda(valExecutado)}</td>
                <td class="p-2 text-right font-bold ${saldoLinha >= 0 ? 'text-green-600' : 'text-red-600'} bg-gray-100 text-[11px] val-saldo-row" id="saldo-${item.id}">${formatarMoeda(saldoLinha)}</td>
            `;
            corpoTabela.appendChild(tr);
        });
        recalcularRodapeCompleto();
    } catch (err) { console.error(err); }
});

// Busca em Tempo Real (Filtro)
inputBusca.addEventListener('input', (e) => {
    const termo = e.target.value.toLowerCase();
    const linhas = corpoTabela.querySelectorAll('tr');
    linhas.forEach(linha => {
        if (linha.cells.length > 1) {
            const desc = linha.cells[1].textContent.toLowerCase();
            linha.style.display = desc.includes(termo) ? "" : "none";
        }
    });
});

// Cálculos de Linha
corpoTabela.addEventListener('input', (e) => {
    if (e.target.classList.contains('input-calc')) {
        const tr = e.target.closest('tr');
        const id = e.target.dataset.id;
        const vUnit = parseFloat(e.target.dataset.preco) || 0;
        const qtdPrev = parseFloat(tr.querySelector('input[data-tipo="prevista"]').value) || 0;
        const qtdReal = parseFloat(tr.querySelector('input[data-tipo="real"]').value) || 0;

        const valPrevisto = qtdPrev * vUnit;
        const valExecutado = qtdReal * vUnit;
        const saldoLinha = valPrevisto - valExecutado;

        document.getElementById(`input-val-prev-${id}`).value = valPrevisto.toFixed(2);
        document.getElementById(`val-prev-display-${id}`).innerText = formatarMoeda(valPrevisto);
        document.getElementById(`extra-${id}`).innerText = Math.max(0, qtdReal - qtdPrev);
        document.getElementById(`exec-${id}`).innerText = formatarMoeda(valExecutado);
        
        const tdSaldo = document.getElementById(`saldo-${id}`);
        tdSaldo.innerText = formatarMoeda(saldoLinha);
        tdSaldo.className = `p-2 text-right font-bold text-[11px] bg-gray-100 val-saldo-row ${saldoLinha >= 0 ? 'text-green-600' : 'text-red-600'}`;

        recalcularRodapeCompleto();
    }
});

[inputRepasseCriamc, inputRepasseAgro].forEach(input => {
    input.addEventListener('input', recalcularRodapeCompleto);
});

function recalcularRodapeCompleto() {
    let tPrevisto = 0, tSaldo = 0, tExecutado = 0;

    document.querySelectorAll('.val-previsto-row').forEach(inp => tPrevisto += parseFloat(inp.value) || 0);
    document.querySelectorAll('.val-executado-row').forEach(td => tExecutado += limparMoeda(td.innerText));
    document.querySelectorAll('.val-saldo-row').forEach(td => tSaldo += limparMoeda(td.innerText));

    footerTotalPrevisto.innerText = formatarMoeda(tPrevisto);
    footerSaldoMes.innerText = formatarMoeda(tSaldo);
    footerTotalExecutado.innerText = formatarMoeda(tExecutado);

    const taxaAdm = (tPrevisto * 0.2) + 1621;
    const taxaExtra = Math.max(0, (tExecutado - tPrevisto) * 0.2);
    
    inputTaxaAdm.value = taxaAdm.toFixed(2);
    inputTaxaExtra.value = taxaExtra.toFixed(2);

    const totalFinal = tExecutado + taxaAdm + taxaExtra + (parseFloat(inputRepasseCriamc.value) || 0) + (parseFloat(inputRepasseAgro.value) || 0);
    footerTotalFinal.innerText = formatarMoeda(totalFinal);
}

// --- ABA: PRODUÇÃO CONSOLIDADA ---

document.getElementById('btn-carregar-consolidado').addEventListener('click', async () => {
    const mes = document.getElementById('mes-ref-consolidado').value;
    if (!mes) return alert("Selecione o mês para o consolidado!");

    corpoConsolidado.innerHTML = '<tr><td colspan="5" class="p-4 text-center">Processando dados globais...</td></tr>';
    
    try {
        const dados = await window.api.buscarConsolidado(mes);
        corpoConsolidado.innerHTML = '';
        
        let somaGeral = 0;

        dados.forEach(resumo => {
            const totalMuni = resumo.total_executado + resumo.taxas + resumo.repasses;
            somaGeral += totalMuni;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="p-3 font-bold text-blue-800">${resumo.municipio}</td>
                <td class="p-3 text-right">${formatarMoeda(resumo.total_executado)}</td>
                <td class="p-3 text-right">${formatarMoeda(resumo.taxas)}</td>
                <td class="p-3 text-right">${formatarMoeda(resumo.repasses)}</td>
                <td class="p-3 text-right font-bold bg-blue-50">${formatarMoeda(totalMuni)}</td>
            `;
            corpoConsolidado.appendChild(tr);
        });

        document.getElementById('footer-consolidado').innerHTML = `
            <td class="p-3 text-right uppercase" colspan="4">Total Geral do Consórcio:</td>
            <td class="p-3 text-right text-lg text-blue-700">${formatarMoeda(somaGeral)}</td>
        `;
    } catch (e) { console.error(e); }
});

// --- SALVAR E EXPORTAR ---

document.getElementById('btn-salvar').addEventListener('click', async () => {
    const municipioId = selectMunicipio.value;
    const mes = document.getElementById('mes-ref').value;
    if (!municipioId || !mes) return alert("Faltam dados!");

    const dados = [];
    corpoTabela.querySelectorAll('tr').forEach(tr => {
        const inpReal = tr.querySelector('input[data-tipo="real"]');
        if (inpReal) {
            const id = inpReal.dataset.id;
            dados.push({
                municipio_id: parseInt(municipioId),
                mes_referencia: mes,
                exame_id: parseInt(id),
                rateio: tr.querySelector('select[data-tipo="rateio"]').value,
                qtd_prevista: parseInt(tr.querySelector('input[data-tipo="prevista"]').value) || 0,
                valor_previsto: parseFloat(document.getElementById(`input-val-prev-${id}`).value) || 0,
                quantidade_realizada: parseInt(inpReal.value) || 0,
                quantidade_extra: parseInt(document.getElementById(`extra-${id}`).innerText) || 0
            });
        }
    });

    const res = await window.api.salvarProducao(dados);
    if (res.success) alert("✅ Salvo com sucesso!");
});

// --- NAVEGAÇÃO ENTRE ABAS ---
window.showTab = function(tabId) {
    const abas = {
        'producao': 'tab-producao',
        'cadastro-itens': 'tab-cadastro-itens',
        'producao-consolidada': 'tab-producao-consolidada'
    };
    
    const botoes = {
        'producao': 'btn-tab-producao',
        'cadastro-itens': 'btn-tab-cadastro',
        'producao-consolidada': 'btn-tab-consolidada'
    };

    Object.keys(abas).forEach(key => {
        const tabEl = document.getElementById(abas[key]);
        const btnEl = document.getElementById(botoes[key]);
        
        if (key === tabId) {
            tabEl.classList.remove('hidden');
            if (btnEl) btnEl.classList.add('bg-blue-800', 'border', 'border-blue-400');
        } else {
            tabEl.classList.add('hidden');
            if (btnEl) btnEl.classList.remove('bg-blue-800', 'border', 'border-blue-400');
        }
    });
};