// LOTE DE LANÇAMENTO TEMPORÁRIO
let loteLançamentos = [];

async function carregarComboLote() {
    const municipios = await window.api.getMunicipios?.() || [];
    const procs = await window.api.listarItensCatalogo?.() || [];

    const selM = document.getElementById('lancar-municipio-unico');
    const selP = document.getElementById('lancar-procedimento');
    if (!selM || !selP) return;

    selM.innerHTML = '<option value="">Selecione o município</option>';
    municipios.forEach(m => selM.innerHTML += `<option value="${m._id||m.id}">${m.nome}</option>`);
    selP.innerHTML = '<option value="">Selecione o procedimento</option>';
    procs.forEach(p => selP.innerHTML += `<option value="${p._id||p.id}">${p.descricao}</option>`);
}

document.getElementById('btn-add-lote').onclick = function() {
    const selM = document.getElementById('lancar-municipio-unico');
    const selP = document.getElementById('lancar-procedimento');
    const qtd = parseInt(document.getElementById('lancar-qtd').value);
    if(!selM.value || !selP.value || !qtd || qtd <= 0) return alert('Preencha todos!');
    // Para apurar nomes
    const txtMun = selM.options[selM.selectedIndex].text;
    const txtProc = selP.options[selP.selectedIndex].text;
    loteLançamentos.push({
        municipio_id: selM.value,
        municipio_nome: txtMun,
        exame_id: selP.value,
        procedimento_nome: txtProc,
        quantidade: qtd
    });
    atualizarTabelaLote();
};

function atualizarTabelaLote() {
    const body = document.getElementById('tabela-lote-lancamentos');
    if(!body) return;
    body.innerHTML = loteLançamentos.length==0 ?
        `<tr><td colspan="4" class="p-4 text-center text-gray-400">Nenhum lançamento no lote.</td></tr>`
        : loteLançamentos.map((el,ix)=>`
            <tr>
                <td class="p-2 border-r">${el.municipio_nome}</td>
                <td class="p-2 border-r">${el.procedimento_nome}</td>
                <td class="p-2 border-r text-center">${el.quantidade}</td>
                <td class="p-2 text-center">
                    <button onclick="removerDoLote(${ix})" class="text-red-700 underline">Remover</button>
                </td>
            </tr>
    `).join('');
}
window.removerDoLote = function(idx) {
    loteLançamentos.splice(idx,1);
    atualizarTabelaLote();
};

// Botão Lançar Tudo
document.getElementById('btn-lancar-tudo').onclick = async function() {
    if(loteLançamentos.length == 0) 
        return alert("Nenhum lançamento no lote!");

        const mes = document.getElementById("mes-referencia").value;

        if(!mes) {
            return alert("Selecione o mês de referência antes de lançar.");
        }

        const dadosParaEnviar = loteLançamentos.map(x => ({
            municipio_id: x.municipio_id,
            exame_id: x.exame_id,
            quantidade_realizada: x.quantidade,
            qtd_prevista: x.quantidade,
            mes_referencia: mes,
            is_lancamento_rapido: true
        }));

    const res = await window.api.salvarProducao(dadosParaEnviar);

    if(res.success) {

        // 🔥 BUSCA CATÁLOGO PARA PEGAR DESCRIÇÕES
        const itensCatalogo = await window.api.listarItensCatalogo();

        const itens = loteLançamentos.map(x => {
            const item = itensCatalogo.find(i => i._id == x.exame_id || i.id == x.exame_id);
            return {
                exame_id: x.exame_id,
                descricao: item?.descricao || x.procedimento_nome,
                quantidade: x.quantidade,
                valor_unit: item?.valor_unitario ?? 0
            };
        });

        // 🔥 MUNICÍPIOS ÚNICOS
        const municipiosUnicos = [...new Map(
            loteLançamentos.map(m => [m.municipio_id, {
                id: m.municipio_id,
                nome: m.municipio_nome
            }])
        ).values()];

        const protocolo = montarObjetoProtocolo({
            usuario: "Admin",
            municipios: municipiosUnicos,
            mesReferencia: mes,
            itens
        });

        salvarProtocoloLocal(protocolo);
        mostrarProtocoloNaTela(protocolo);

        alert("✅ Lançamento em lote efetuado!");

        loteLançamentos = [];
        atualizarTabelaLote();
    }
};
// --------- UTILITÁRIOS DE PROTOCOLO ---------
function gerarProtocoloID() {
    const dt = new Date();
    const pad = n => String(n).padStart(2, '0');
    const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `PROTOC-${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}-${pad(dt.getHours())}${pad(dt.getMinutes())}${pad(dt.getSeconds())}-${rand}`;
}

function montarObjetoProtocolo({ usuario = "Admin", municipios, mesReferencia, itens }) {
    return {
        protocoloID: gerarProtocoloID(),
        dataHora: new Date().toISOString(),
        usuario,
        municipios: municipios.map(m => ({
            id: m.value || m.id,
            nome: m.dataset?.nome || m.nome
        })),
        mesReferencia,
        itens
    };
}

function salvarProtocoloLocal(protocolo) {
    const lista = JSON.parse(localStorage.getItem('protocolosLotes') || '[]');
    lista.push(protocolo);
    localStorage.setItem('protocolosLotes', JSON.stringify(lista));
}

function recuperarProtocolosLocais() {
    return JSON.parse(localStorage.getItem('protocolosLotes') || '[]');
}

function mostrarProtocoloNaTela(protocolo) {
    const bloco = document.createElement('div');
    bloco.className = "my-4 p-4 rounded bg-green-50 border border-green-200 text-xs protocolo_card";
    bloco.innerHTML = `
        <div><b>Protocolo:</b> <span class="text-green-700">${protocolo.protocoloID}</span></div>
        <div><b>Data:</b> ${new Date(protocolo.dataHora).toLocaleString()}</div>
        <div><b>Usuário:</b> ${protocolo.usuario}</div>
        <div><b>Municípios:</b> ${protocolo.municipios.map(m=>m.nome).join(', ')}</div>
        <div><b>Mês de Referência:</b> ${protocolo.mesReferencia}</div>
        <div class="mt-2">
            <b>Itens lançados:</b>
            <ul style="margin-left: 1em">
                ${protocolo.itens.map(i=>`<li>${i.descricao} — Qtd: <b>${i.quantidade}</b></li>`).join('')}
            </ul>
        </div>
    `;
    const protocolArea = document.getElementById('protocolo-container');
    if (protocolArea) {
        protocolArea.prepend(bloco); // Adiciona novo protocolo em cima
    }
}

function exibirTodosProtocolos() {
    const lista = recuperarProtocolosLocais();
    let painel = document.getElementById('painel-protocolos');
    if (!painel) {
        painel = document.createElement('div');
        painel.id = "painel-protocolos";
        painel.className = "max-h-64 overflow-auto bg-gray-100 border rounded mb-3 p-3";
        document.getElementById('protocolo-container')?.appendChild(painel);
    }
    painel.innerHTML = "<b>Histórico de Protocolos:</b><hr>";
    if (lista.length === 0) {
        painel.innerHTML += "<i>Nenhum protocolo encontrado.</i>";
        return;
    }
    lista.slice().reverse().forEach(prot => {
        painel.innerHTML += `
            <div class="mb-2 p-2 bg-white border rounded">
                <div><b>${prot.protocoloID}</b> | ${new Date(prot.dataHora).toLocaleString()}</div>
                <div style="font-size:11px">Municípios: ${prot.municipios.map(m=>m.nome).join(', ')}</div>
                <div style="font-size:11px">Mês: ${prot.mesReferencia}</div>
                <div style="font-size:11px">Itens: ${prot.itens.map(i=>i.descricao+'('+i.quantidade+')').join(', ')}</div>
            </div>
        `;
    });
}


// --- REFERÊNCIAS GERAIS ---
const corpoTabela = document.getElementById('tabela-producao');
const corpoConsolidado = document.getElementById('tabela-consolidada');
const selectMunicipio = document.getElementById('select-municipio');
const btnCarregar = document.getElementById('btn-carregar');
const inputBusca = document.getElementById('input-busca-exame');

// Referências da Aba Lançar
const selectMuniLancar = document.getElementById('lancar-municipio');
const inputBuscaLancar = document.getElementById('input-busca-lancar-procedimento') || document.querySelector('#tab-lancar input[type="text"]');
const containerItensLancar = document.getElementById('container-itens-lancar') || document.querySelector('#tab-lancar .max-h-60');

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

// --- VARIÁVEL DE ESTADO (MEMÓRIA TEMPORÁRIA) ---
// Isso impede que os dados sumam ao filtrar a lista
let lancamentoTemporario = {}; 

// Utilitários
const formatarMoeda = (val) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const limparMoeda = (texto) => {
    if (!texto) return 0;
    return parseFloat(texto.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;
};

// --- INICIALIZAÇÃO ---
// --- INICIALIZAÇÃO GLOBAL CORRIGIDA ---
window.addEventListener("load", async () => {
    try {
        // Carrega combos do lote
        await carregarComboLote();

        // Carrega municípios
        const municipios = await window.api.getMunicipios();
        

        if (selectMunicipio) {
            selectMunicipio.innerHTML = '<option value="">Selecione...</option>';
            municipios.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m._id || m.id;
                opt.textContent = m.nome;
                selectMunicipio.appendChild(opt);
            });
        }

        
        // Prepara aba lançar
        await prepararAbaLancar();

        // Atualiza lista catálogo
        await atualizarListaItens();

    } catch (e) {
        console.error("Erro na inicialização:", e);
    }
});

// --- ABA: LANÇAMENTO RÁPIDO (LÓGICA CORRIGIDA) ---

// --- NOVO: Função para Marcar/Desmarcar todos os municípios ---
window.marcarTodosMunicipios = (status) => {
    const checkboxes = document.querySelectorAll('.check-muni');
    checkboxes.forEach(cb => cb.checked = status);
};

// --- ALTERADO: prepararAbaLancar para suportar Multi-seleção ---
async function prepararAbaLancar() {
    try {
        const municipios = await window.api.getMunicipios();
        
        // Selecionamos o container onde ficavam os municípios (adaptado para lista de checkboxes)
        if (selectMuniLancar) {
            // Transformamos o select em um container de lista para facilitar a vida
            const containerParent = selectMuniLancar.parentElement;
            containerParent.innerHTML = `
                <label class="block font-bold text-xs text-[#0033CC] mb-1">MUNICÍPIOS (Lançamento em Lote)</label>
                <div id="lista-municipios-lote" class="grid grid-cols-2 gap-2 border p-3 rounded bg-gray-50 max-h-40 overflow-y-auto border-gray-300">
                    </div>
                <div class="mt-2 text-[10px] text-gray-500 flex gap-2">
                    <button type="button" onclick="marcarTodosMunicipios(true)" class="underline hover:text-blue-700">Marcar Todos</button>
                    <button type="button" onclick="marcarTodosMunicipios(false)" class="underline hover:text-blue-700">Desmarcar</button>
                </div>
            `;

            const listaContainer = document.getElementById('lista-municipios-lote');
            municipios.forEach(m => {
                const id = m._id || m.id;
                listaContainer.innerHTML += `
                    <label class="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-100 p-1 rounded">
                        <input type="checkbox" class="check-muni" value="${id}" data-nome="${m.nome}">
                        <span class="truncate">${m.nome}</span>
                    </label>
                `;
            });
        }
        
        lancamentoTemporario = {}; 
        filtrarItensLancar('');
    } catch (e) { console.error("Erro ao preparar aba lançar:", e); }
}

// --- ALTERADO: Evento de Salvar Lançamento (Lógica de Automação em Lote) ---
document.getElementById('form-lancar-producao')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Coleta todos os municípios marcados
    const munisMarcados = Array.from(document.querySelectorAll('.check-muni:checked'));
    const mes = document.getElementById('lancar-mes').value;
    
    if (munisMarcados.length === 0 || !mes) {
        return alert("⚠️ Selecione pelo menos um Município e o Mês!");
    }

    const idsExames = Object.keys(lancamentoTemporario);
    if (idsExames.length === 0) return alert("❌ Insira a quantidade em pelo menos um item!");

    // --- AUTOMAÇÃO: Replica os itens para cada município selecionado ---
    const dadosParaSalvar = [];
    
    munisMarcados.forEach(muni => {
        const muniId = muni.value;
        const muniNome = muni.dataset.nome;

        idsExames.forEach(idExame => {
            const qtd = lancamentoTemporario[idExame];
            dadosParaSalvar.push({
                municipio_id: muniId,
                mes_referencia: mes,
                exame_id: idExame,
                quantidade_realizada: qtd,
                qtd_prevista: qtd, // FACILITADOR: Define meta igual à realizada automaticamente
                is_lancamento_rapido: true 
            });
        });
    });

    const res = await window.api.salvarProducao(dadosParaSalvar);
    
    if (res.success) {
        // --------------- PROTOCOLO DETALHADO ---------------
        // Buscar nomes e info dos exames:
        const itensCatalogo = await window.api.listarItensCatalogo();
        const itens = idsExames.map(id => {
            const item = itensCatalogo.find(i => i._id == id || i.id == id);
            return {
                exame_id: id,
                descricao: item?.descricao || id,
                quantidade: lancamentoTemporario[id],
                valor_unit: item?.valor_unitario ?? null
            }
        });

        const municipiosFormatados = munisMarcados.map(m => ({
            id: m.value,
            nome: m.dataset.nome
        }));

        const protocolo = montarObjetoProtocolo({
            usuario: "Admin",
            municipios: municipiosFormatados,
            mesReferencia: mes,
            itens
        });
        salvarProtocoloLocal(protocolo);
        mostrarProtocoloNaTela(protocolo);
        // -----------------------------------------------------

        lancamentoTemporario = {};
        e.target.reset();
        marcarTodosMunicipios(false);
        filtrarItensLancar('');
    }
});

async function filtrarItensLancar(termo) {
    if (!containerItensLancar) return;
    const itens = await window.api.listarItensCatalogo();
    const filtrados = itens.filter(i => i.descricao.toLowerCase().includes(termo.toLowerCase()));
    containerItensLancar.innerHTML = '';
    filtrados.forEach(item => {
        const id = item._id || item.id;
        // Recupera o valor que já estava digitado na memória, se existir
        const valorSalvo = lancamentoTemporario[id] || '';

        const div = document.createElement('div');
        div.className = "p-3 hover:bg-blue-50 flex justify-between items-center border-b border-gray-100 transition";
        div.innerHTML = `
            <span class="text-sm font-medium text-gray-700">${item.descricao}</span>
            <div class="flex items-center gap-2">
                <span class="text-[10px] text-gray-400">V.Unit: ${formatarMoeda(item.valor_unitario)}</span>
                <input type="number" min="0" value="${valorSalvo}" placeholder="Qtd" 
                    class="w-20 border border-gray-300 p-1 rounded text-center text-sm focus:border-blue-500 outline-none" 
                    oninput="atualizarRascunho('${id}', this.value)">
            </div>
        `;
        containerItensLancar.appendChild(div);
    });
}

// Função para salvar no estado global enquanto o usuário digita
window.atualizarRascunho = (id, qtd) => {
    const valor = parseInt(qtd);
    if (valor > 0) {
        lancamentoTemporario[id] = valor;
    } else {
        delete lancamentoTemporario[id]; // Remove se zerar
    }
};

// Escuta busca na aba lançar
inputBuscaLancar?.addEventListener('input', (e) => filtrarItensLancar(e.target.value));

// Evento de Salvar Lançamento Rápido
document.getElementById('form-lancar-producao')?.addEventListener('submit', async (e) => {
    // Já tratado acima (apenas para compatibilidade se existe submit duplo, mantenha só um submit!)
});


// --- ABA: GESTÃO DE PRODUÇÃO (TABELA) ---

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

// --- ABA: GERENCIAMENTO DE ITENS ---

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
    }
}

window.salvarEdicaoItem = async (id) => {
    const novaDesc = document.getElementById(`edit-desc-${id}`).value;
    const novoVal = parseFloat(document.getElementById(`edit-val-${id}`).value);
    if (!novaDesc || novoVal <= 0) return alert("Dados inválidos!");
    const res = await window.api.editarItem({ id, descricao: novaDesc, valor: novoVal });
    if (res.success) { alert("Item atualizado!"); await atualizarListaItens(); }
};

window.deletarItem = async (id) => {
    if (!confirm("Tem certeza que deseja excluir este item permanentemente?")) return;
    const res = await window.api.excluirItem(id);
    if (res.success) { alert("Item removido!"); await atualizarListaItens(); }
};

window.carregarEstatisticas = async function () {

    const mes = document.getElementById("mes-estatisticas").value;

    console.log("Mês selecionado:", mes);

    const dados = await window.api.buscarEstatisticas(mes);

    console.log("Dados recebidos:", dados);

};

document.getElementById("btn-carregar-estat")
.addEventListener("click", async () => {

    const mes = document.getElementById("estat-mes").value;

    if (!mes) {
        alert("Selecione um mês!");
        return;
    }

    const dados = await window.api.buscarEstatisticas(mes);

    if (!dados || dados.length === 0) {
        alert("Nenhum dado encontrado para esse mês.");
        return;
    }

    // =========================
    // KPIs
    // =========================

    const totalProduzido = dados.reduce((acc, item) => acc + item.total, 0);
    const totalQuantidade = dados.reduce((acc, item) => acc + item.quantidade, 0);
    const municipiosUnicos = new Set(dados.map(d => d.municipio)).size;
    const ticketMedio = totalQuantidade > 0 ? totalProduzido / totalQuantidade : 0;

    document.getElementById("kpi-total").innerText = totalProduzido.toLocaleString("pt-BR", {style:"currency", currency:"BRL"});
    document.getElementById("kpi-qtd").innerText = totalQuantidade;
    document.getElementById("kpi-municipios").innerText = municipiosUnicos;
    document.getElementById("kpi-ticket").innerText = ticketMedio.toLocaleString("pt-BR", {style:"currency", currency:"BRL"});

    // =========================
    // TABELA
    // =========================

    const tbody = document.getElementById("estat-tbody");
    tbody.innerHTML = "";

    dados.forEach(item => {
        tbody.innerHTML += `
            <tr class="border-b">
                <td class="p-2">${item.municipio}</td>
                <td class="p-2">${item.procedimento}</td>
                <td class="p-2 text-center">${item.quantidade}</td>
                <td class="p-2 text-right">
                    ${item.total.toLocaleString("pt-BR", {style:"currency", currency:"BRL"})}
                </td>
            </tr>
        `;
    });

    // =========================
    // GRÁFICO POR MUNICÍPIO
    // =========================

    const totalPorMunicipio = {};

    dados.forEach(item => {
        if (!totalPorMunicipio[item.municipio]) {
            totalPorMunicipio[item.municipio] = 0;
        }
        totalPorMunicipio[item.municipio] += item.total;
    });

    const ctx1 = document.getElementById("graficoMunicipios");

    if (window.graficoMun) window.graficoMun.destroy();

    window.graficoMun = new Chart(ctx1, {
        type: "bar",
        data: {
            labels: Object.keys(totalPorMunicipio),
            datasets: [{
                label: "Total por Município",
                data: Object.values(totalPorMunicipio)
            }]
        }
    });

    // =========================
    // GRÁFICO POR PROCEDIMENTO
    // =========================

    const totalPorProcedimento = {};

    dados.forEach(item => {
        if (!totalPorProcedimento[item.procedimento]) {
            totalPorProcedimento[item.procedimento] = 0;
        }
        totalPorProcedimento[item.procedimento] += item.total;
    });

    const ctx2 = document.getElementById("graficoProcedimentos");

    if (window.graficoProc) window.graficoProc.destroy();

    window.graficoProc = new Chart(ctx2, {
        type: "pie",
        data: {
            labels: Object.keys(totalPorProcedimento),
            datasets: [{
                data: Object.values(totalPorProcedimento)
            }]
        }
    });

});

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
    input?.addEventListener('input', recalcularRodapeCompleto);
});

function recalcularRodapeCompleto() {
    let tPrevisto = 0, tSaldo = 0, tExecutado = 0;

    document.querySelectorAll('.val-previsto-row').forEach(inp => tPrevisto += parseFloat(inp.value) || 0);
    document.querySelectorAll('.val-executado-row').forEach(td => tExecutado += limparMoeda(td.innerText));
    document.querySelectorAll('.val-saldo-row').forEach(td => tSaldo += limparMoeda(td.innerText));

    if(footerTotalPrevisto) footerTotalPrevisto.innerText = formatarMoeda(tPrevisto);
    if(footerSaldoMes) footerSaldoMes.innerText = formatarMoeda(tSaldo);
    if(footerTotalExecutado) footerTotalExecutado.innerText = formatarMoeda(tExecutado);

    const taxaAdm = (tPrevisto * 0.2) + 1621;
    const taxaExtra = Math.max(0, (tExecutado - tPrevisto) * 0.2);
    
    if(inputTaxaAdm) inputTaxaAdm.value = taxaAdm.toFixed(2);
    if(inputTaxaExtra) inputTaxaExtra.value = taxaExtra.toFixed(2);

    const totalFinal = tExecutado + taxaAdm + taxaExtra + (parseFloat(inputRepasseCriamc?.value) || 0) + (parseFloat(inputRepasseAgro?.value) || 0);
    if(footerTotalFinal) footerTotalFinal.innerText = formatarMoeda(totalFinal);
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

// --- SALVAR GERAL (ABA GESTÃO) ---

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
        'lancar': 'tab-lancar',
        'cadastro-itens': 'tab-cadastro-itens',
        'producao-consolidada': 'tab-producao-consolidada',
        'estatisticas': 'tab-estatisticas'
    };
    
    const botoes = {
        'producao': 'btn-tab-producao',
        'lancar': 'btn-tab-lancar',
        'cadastro-itens': 'btn-tab-cadastro',
        'producao-consolidada': 'btn-tab-consolidada',
        'estatisticas': 'btn-tab-estatisticas'
    };

    Object.keys(abas).forEach(key => {
        const tabEl = document.getElementById(abas[key]);
        const btnEl = document.getElementById(botoes[key]);
        
        if (tabEl) {
            if (key === tabId) {
                tabEl.classList.remove('hidden');
                if (btnEl) btnEl.classList.add('bg-blue-800', 'border', 'border-blue-400');
                
                if (tabId === 'cadastro-itens') atualizarListaItens();
                if (tabId === 'lancar') prepararAbaLancar();
            } else {
                tabEl.classList.add('hidden');
                if (btnEl) btnEl.classList.remove('bg-blue-800', 'border', 'border-blue-400');
            }
        }
    });
};