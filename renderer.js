// renderer.js - VERSÃO COM BUSCA EM TEMPO REAL

const corpoTabela = document.getElementById('tabela-producao');
const selectMunicipio = document.getElementById('select-municipio');
const btnCarregar = document.getElementById('btn-carregar');
const inputBusca = document.getElementById('input-busca-exame'); // Nova referência

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

    // Limpa a busca ao carregar novo município
    inputBusca.value = '';

    corpoTabela.innerHTML = '<tr><td colspan="10" class="text-center p-4 text-blue-600">Carregando...</td></tr>';
    const dados = await window.api.buscarExames({ municipioId, mes });
    corpoTabela.innerHTML = '';
    if (!dados || dados.length === 0) return alert("Nenhum dado encontrado.");

    dados.forEach(item => {
        const vUnit = Number(item.valor_unitario) || 0;
        const qtdPrev = item.qtd_prevista !== null ? Number(item.qtd_prevista) : 0;
        const qtdReal = Number(item.qtd_realizada) || 0;

        const valPrev = qtdPrev * vUnit;
        const qtdExtra = Math.max(0, qtdReal - qtdPrev);
        const valExecutado = qtdReal * vUnit;
        const saldoLinha = valPrev - valExecutado;

        const tr = document.createElement('tr');
        tr.className = "hover:bg-blue-50 transition odd:bg-white even:bg-gray-50 group border-b";
        tr.innerHTML = `
            <td class="p-2 border-r text-center text-gray-500 text-[10px]">${item.id}</td>
            <td class="p-2 border-r text-left truncate max-w-xs font-medium text-xs">${item.descricao}</td>
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
                 <input type="hidden" class="val-previsto-row" id="input-val-prev-${item.id}" value="${valPrev}">
            </td>
            <td class="p-1 border-r text-center bg-white">
                <input type="number" min="0" value="${qtdReal || ''}" class="input-calc w-full border border-blue-200 rounded text-center text-blue-900 font-bold text-xs" data-id="${item.id}" data-tipo="real" data-preco="${vUnit}">
            </td>
            <td class="p-1 border-r text-center bg-gray-50 font-bold text-orange-600 text-xs" id="extra-${item.id}">${qtdExtra}</td>
            <td class="p-2 border-r text-right font-bold text-gray-700 bg-gray-100 text-[11px] val-executado-row" id="exec-${item.id}">${formatarMoeda(valExecutado)}</td>
            <td class="p-2 text-right font-bold ${saldoLinha >= 0 ? 'text-green-600' : 'text-red-600'} bg-gray-100 text-[11px] val-saldo-row" id="saldo-${item.id}">${formatarMoeda(saldoLinha)}</td>
        `;
        corpoTabela.appendChild(tr);
    });
    recalcularRodapeCompleto();
});

// --- LÓGICA DE BUSCA/FILTRO ---
inputBusca.addEventListener('input', (e) => {
    const termoBusca = e.target.value.toLowerCase();
    const linhas = corpoTabela.querySelectorAll('tr');

    linhas.forEach(linha => {
        // A segunda célula (index 1) contém o nome do exame
        const descricaoExame = linha.cells[1].textContent.toLowerCase();
        if (descricaoExame.includes(termoBusca)) {
            linha.style.display = "";
        } else {
            linha.style.display = "none";
        }
    });
});

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
    let totalPrevistoNoMes = 0;
    let totalSaldoDoMes = 0;
    let totalGeralProcedimentos = 0;

    document.querySelectorAll('.val-previsto-row').forEach(inp => totalPrevistoNoMes += parseFloat(inp.value) || 0);
    document.querySelectorAll('.val-executado-row').forEach(td => totalGeralProcedimentos += limparMoeda(td.innerText));
    document.querySelectorAll('.val-saldo-row').forEach(td => totalSaldoDoMes += limparMoeda(td.innerText));

    footerTotalPrevisto.innerText = formatarMoeda(totalPrevistoNoMes);
    footerSaldoMes.innerText = formatarMoeda(totalSaldoDoMes);
    footerTotalExecutado.innerText = formatarMoeda(totalGeralProcedimentos);

    const taxaAdmCalc = (totalPrevistoNoMes * 0.2) + 1621;
    inputTaxaAdm.value = taxaAdmCalc.toFixed(2);

    const taxaExtraCalc = (totalGeralProcedimentos - totalPrevistoNoMes) * 0.2;
    inputTaxaExtra.value = taxaExtraCalc.toFixed(2);

    const repasseCriamc = parseFloat(inputRepasseCriamc.value) || 0;
    const repasseAgro = parseFloat(inputRepasseAgro.value) || 0;

    const totalFinal = totalGeralProcedimentos + taxaAdmCalc + taxaExtraCalc + repasseCriamc + repasseAgro;
    footerTotalFinal.innerText = formatarMoeda(totalFinal);
}

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
            const qtdExtra = parseInt(document.getElementById(`extra-${id}`).innerText) || 0;

            dadosParaSalvar.push({
                municipio_id: parseInt(municipioId),
                mes_referencia: mes,
                exame_id: parseInt(id),
                rateio: selectRateio.value,
                qtd_prevista: parseInt(inpPrevista.value) || 0,
                valor_previsto: parseFloat(inpValPrev.value) || 0,
                quantidade_realizada: parseInt(inpReal.value) || 0,
                quantidade_extra: qtdExtra
            });
        }
    });

    const res = await window.api.salvarProducao(dadosParaSalvar);
    if (res.success) alert("✅ Produção salva com sucesso!");
    else alert("❌ Erro ao salvar: " + res.erro);
});

window.showTab = function(tabId) {
    const tabProducao = document.getElementById('tab-producao');
    const tabCadastro = document.getElementById('tab-cadastro-itens');
    const btnProd = document.querySelector('button[onclick*="producao"]');
    const btnCad = document.querySelector('button[onclick*="cadastro-itens"]');

    if (tabId === 'producao') {
        tabProducao.classList.remove('hidden');
        tabCadastro.classList.add('hidden');
        btnProd.classList.add('bg-blue-800', 'border');
        btnCad.classList.remove('bg-blue-800', 'border');
    } else {
        tabProducao.classList.add('hidden');
        tabCadastro.classList.remove('hidden');
        btnCad.classList.add('bg-blue-800', 'border');
        btnProd.classList.remove('bg-blue-800', 'border');
    }
};