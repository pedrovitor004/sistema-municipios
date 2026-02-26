const { contextBridge, ipcRenderer } = require('electron');

// Expõe as APIs de forma segura para o processo de renderização (Frontend)
contextBridge.exposeInMainWorld('api', {
    // Autenticação
    login: (dados) => ipcRenderer.invoke('login', dados),

    // Busca de Dados
    getMunicipios: () => ipcRenderer.invoke('get-municipios'),
    buscarExames: (filtros) => ipcRenderer.invoke('buscar-exames', filtros),

    // Persistência e Operações
    salvarProducao: (lista) => ipcRenderer.invoke('salvar-producao', lista),
    cadastrarItem: (item) => ipcRenderer.invoke('cadastrar-item', item),
    excluirItem: (id) => ipcRenderer.invoke('excluir-item', id),
    editarItem: (item) => ipcRenderer.invoke('editar-item', item),
    listarItensCatalogo: () => ipcRenderer.invoke('listar-itens-catalogo'),

    // Relatórios
    exportarExcel: (dados) => ipcRenderer.invoke('exportar-excel', dados),
    buscarConsolidado: (mes) => ipcRenderer.invoke('buscar-consolidado', mes),
    buscarEstatisticas: (mes) => ipcRenderer.invoke('buscarEstatisticas', mes)
});