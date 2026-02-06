const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    login: (dados) => ipcRenderer.invoke('login', dados),
    getMunicipios: () => ipcRenderer.invoke('get-municipios'),
    buscarExames: (filtros) => ipcRenderer.invoke('buscar-exames', filtros),
    salvarProducao: (dados) => ipcRenderer.invoke('salvar-producao', dados),
    cadastrarItem: (item) => ipcRenderer.invoke('cadastrar-item', item),
    exportarExcel: (dados) => ipcRenderer.invoke('exportar-excel', dados)
});