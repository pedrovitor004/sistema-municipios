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

    // Relatórios
    exportarExcel: (dados) => ipcRenderer.invoke('exportar-excel', dados)
});