# 🏥 Sistema de Gestão Municipal - CISCO

Sistema Desktop profissional desenvolvido para o **Consórcio Intermunicipal de Saúde do Cariri Ocidental (CISCO)**. O software automatiza o lançamento de produção de exames, calcula metas físicas/financeiras e gera relatórios de repasse mensal para os municípios consorciados.

---

## 📸 Interface do Sistema
O sistema conta com uma interface moderna dividida em:
* **Lançar Produção:** Tela principal para inserção de quantidades realizadas e extras.
* **Cadastrar Itens:** Área para gerenciamento de novos procedimentos e valores.
* **Rodapé Inteligente:** Cálculos automáticos de Taxas Administrativas, Repasses CRIAMC e CICSCOAgro.

---

## 🚀 Como Rodar em Outro Computador

Se você clonar este projeto em uma máquina nova, siga este guia:

### 1. Pré-requisitos
Certifique-se de ter instalado:
* [Node.js](https://nodejs.org/) (Versão 18 ou superior)
* [Git](https://git-scm.com/)

### 2. Instalação
No terminal da pasta do projeto, execute:
```bash
# Baixar todas as dependências do package.json
npm install

# Cria tabelas e popula a lista de municípios do CISCO
node setup_dados.js

npm start
