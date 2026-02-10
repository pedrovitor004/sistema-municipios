/**
 * renderer.js - Gestão de Produção CISCO
 * Versão: 3.3 (Carga Automática e IDs Corrigidos)
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
        // Carrega Municípios
        const municipios = await window.api.getMunicipios();
        municipios.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m._id || m.id; 
            opt.textContent = m.nome;
            selectMunicipio.appendChild(opt);
        });

        // Tenta carregar o catálogo logo no início para garantir que os dados existam
        await atualizarListaItens();
        
    } catch (e) { console.error("Erro na inicialização:", e); }
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

        dados.forEach((item, index) => {
            const idAtual = item._id || item.id; 
            const numeroSequencial = String(index + 1).padStart(3, '0');
            
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
                <td class="p-2 border-r text-center text-gray-500 font-bold text-[11px]">${numeroSequencial}</td>
                <td class="p-2 border-r text-left font-medium text-xs">${item.descricao}</td>
                <td class="p-2 border-r text-right text-gray-600 font-mono text-xs">${formatarMoeda(vUnit)}</td>
                <td class="p-1 border-r text-center bg-yellow-50">
                    <select class="w-full text-[10px] bg-transparent outline-none text-center" data-id="${idAtual}" data-tipo="rateio">
                        <option value="Não" ${item.rateio === 'Não' ? 'selected' : ''}>Não</option>
                        <option value="Sim" ${item.rateio === 'Sim' ? 'selected' : ''}>Sim</option>
                    </select>
                </td>
                <td class="p-1 border-r text-center bg-yellow-50">
                    <input type="number" min="0" value="${qtdPrev}" class="input-calc w-full bg-transparent text-center outline-none text-xs" data-id="${idAtual}" data-tipo="prevista" data-preco="${vUnit}">
                </td>
                <td class="p-1 border-r text-right bg-yellow-50 font-bold text-blue-700 text-[11px]">
                     <span id="val-prev-display-${idAtual}">${formatarMoeda(valPrev)}</span>
                     <input type="hidden" class="val-previsto-row" id="input-val-prev-${idAtual}" value="${valPrev.toFixed(2)}">
                </td>
                <td class="p-1 border-r text-center bg-white">
                    <input type="number" min="0" value="${qtdReal || ''}" class="input-calc w-full border border-blue-200 rounded text-center text-blue-900 font-bold text-xs outline-none" data-id="${idAtual}" data-tipo="real" data-preco="${vUnit}">
                </td>
                <td class="p-1 border-r text-center bg-gray-50 font-bold text-orange-600 text-xs" id="extra-${idAtual}">${qtdExtra}</td>
                <td class="p-2 border-r text-right font-bold text-gray-700 bg-gray-100 text-[11px] val-executado-row" id="exec-${idAtual}">${formatarMoeda(valExecutado)}</td>
                <td class="p-2 text-right font-bold ${saldoLinha >= 0 ? 'text-green-600' : 'text-red-600'} bg-gray-100 text-[11px] val-saldo-row" id="saldo-${idAtual}">${formatarMoeda(saldoLinha)}</td>
            `;
            corpoTabela.appendChild(tr);
        });
        recalcularRodapeCompleto();
    } catch (err) { console.error(err); }
});

// --- ABA: CADASTRO E GERENCIAMENTO DE ITENS ---

async function atualizarListaItens() {
    const listaContainer = document.getElementById('lista-itens-gerenciamento');
    if (!listaContainer) return;

    try {
        const itens = await window.api.listarItensCatalogo();
        listaContainer.innerHTML = ''; 

        if (!itens || itens.length === 0) {
            listaContainer.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-500">Nenhum item no catálogo.</td></tr>';
            return;
        }

        itens.forEach((item, index) => {
            const idAtual = item._id || item.id;
            const numeroSequencial = String(index + 1).padStart(3, '0');
            
            const tr = document.createElement('tr');
            tr.className = "border-b hover:bg-gray-50 text-sm";
            tr.innerHTML = `
                <td class="p-2 text-center text-gray-500 font-bold text-[11px]">${numeroSequencial}</td>
                <td class="p-2">
                    <input type="text" value="${item.descricao}" class="w-full border rounded px-1" id="edit-desc-${idAtual}">
                </td>
                <td class="p-2">
                    <input type="number" step="0.01" value="${item.valor_unitario}" class="w-full border rounded px-1 font-mono" id="edit-val-${idAtual}">
                </td>
                <td class="p-2 text-center flex gap-1 justify-center">
                    <button onclick="salvarEdicaoItem('${idAtual}')" class="bg-blue-600 text-white px-2 py-1 rounded text-[10px] hover:bg-blue-700">Salvar</button>
                    <button onclick="deletarItem('${idAtual}')" class="bg-red-600 text-white px-2 py-1 rounded text-[10px] hover:bg-red-700">Excluir</button>
                </td>
            `;
            listaContainer.appendChild(tr);
        });
    } catch (err) {
        console.error("Erro ao carregar lista:", err);
        listaContainer.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-red-500">Erro ao comunicar com o banco de dados.</td></tr>';
    }
}

window.salvarEdicaoItem = async (id) => {
    const novaDesc = document.getElementById(`edit-desc-${id}`).value;
    const novoVal = parseFloat(document.getElementById(`edit-val-${id}`).value);
    if (!novaDesc || novoVal <= 0) return alert("Dados inválidos!");

    const res = await window.api.editarItem({ id, descricao: novaDesc, valor: novoVal });
    if (res.success) {
        alert("Item atualizado!");
        await atualizarListaItens();
    }
};

window.deletarItem = async (id) => {
    if (!confirm("Tem certeza que deseja excluir este item permanentemente?")) return;
    const res = await window.api.excluirItem(id);
    if (res.success) {
        alert("Item removido!");
        await atualizarListaItens();
    } else {
        alert("Erro ao excluir: " + res.erro);
    }
};

document.getElementById('form-cadastro-item')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('novo-desc').value;
    const valor = parseFloat(document.getElementById('novo-preco').value) || 0;

    if (!nome || valor <= 0) return alert("Preencha corretamente!");

    const res = await window.api.cadastrarItem({ descricao: nome, valor: valor });
    if (res.success) {
        alert("✅ Adicionado!");
        document.getElementById('novo-desc').value = '';
        document.getElementById('novo-preco').value = '0.00';
        await atualizarListaItens();
    }
});

// --- CÁLCULOS E FILTROS ---

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

document.getElementById('btn-carregar-consolidado')?.addEventListener('click', async () => {
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

// --- SALVAR ---

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
                municipio_id: municipioId,
                mes_referencia: mes,
                exame_id: id,
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
        
        if (tabEl) {
            if (key === tabId) {
                tabEl.classList.remove('hidden');
                if (btnEl) btnEl.classList.add('bg-blue-800', 'border', 'border-blue-400');
                if (tabId === 'cadastro-itens') atualizarListaItens();
            } else {
                tabEl.classList.add('hidden');
                if (btnEl) btnEl.classList.remove('bg-blue-800', 'border', 'border-blue-400');
            }
        }
    });
};