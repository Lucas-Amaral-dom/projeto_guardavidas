# Sistema de Registro de Ponto - Guarda-vidas

Um aplicativo React para guarda-vidas registrarem entrada e saída com captura de foto, com controle de horários específicos e relatório de ocorrências do dia.

## 🚀 Funcionalidades

- ✅ **Login com Autenticação**: Sistema de login com usuários de teste
- ✅ **Registro de Ponto com Foto**: Captura de foto via câmera do dispositivo
- ✅ **Controle de Horários**: 
  - Entrada disponível a partir das 07:30
  - Saída disponível a partir das 19:30
- ✅ **Relatório Diário**: Formulário para descrever ocorrências do dia
- ✅ **Histórico**: Visualização de todas as entradas e relatórios
- ✅ **Armazenamento Local**: Dados salvos em localStorage

## 📋 Pré-requisitos

- Node.js (versão 12 ou superior)
- npm ou yarn

## 🔧 Instalação

1. Clone ou extraia o projeto:
```bash
cd lifeguard-project
```

2. Instale as dependências:
```bash
npm install
```

3. Inicie o servidor de desenvolvimento:
```bash
npm start
```

O aplicativo abrirá automaticamente em `http://localhost:3000`

## 👤 Usuários de Teste

O sistema vem com 3 usuários de teste pré-configurados:

| Email | Senha | Nome |
|-------|-------|------|
| joao@test.com | 123456 | João Silva |
| maria@test.com | 123456 | Maria Santos |
| pedro@test.com | 123456 | Pedro Costa |

## 📁 Estrutura do Projeto

```
lifeguard-project/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── Login.js              # Tela de login
│   │   ├── Dashboard.js          # Dashboard principal
│   │   ├── TimeEntry.js          # Registro de entrada com câmera
│   │   ├── DailyReport.js        # Formulário de relatório
│   │   ├── History.js            # Histórico de registros
│   │   └── ProtectedRoute.js     # Rota protegida
│   ├── context/
│   │   ├── AuthContext.js        # Contexto de autenticação
│   │   └── TimesheetContext.js   # Contexto de dados de ponto
│   ├── App.js                    # Componente principal
│   ├── index.js                  # Ponto de entrada
│   └── index.css                 # Estilos globais
├── package.json
└── README.md
```

## 🎯 Como Usar

### 1. Login
- Acesse a página inicial
- Clique em um dos usuários de teste ou insira as credenciais manualmente
- Clique em "Entrar"

### 2. Marcar Entrada
- No dashboard, clique em "📸 Marcar Entrada"
- Clique em "📷 Abrir Câmera"
- Clique em "📸 Capturar Foto"
- Clique em "✓ Registrar Entrada"

### 3. Marcar Saída
- No dashboard, clique em "📋 Marcar Saída" (disponível após 19:30)
- Preencha os campos de ocorrências e observações
- Clique em "✓ Enviar Relatório"

### 4. Ver Histórico
- No dashboard, clique em "📊 Ver Histórico"
- Alterne entre "Entradas" e "Relatórios"

## 🔐 Segurança

**Nota**: Este é um projeto de teste. Em produção:
- Implemente autenticação real com backend
- Use HTTPS para todas as comunicações
- Armazene dados em banco de dados seguro
- Implemente controle de acesso baseado em função (RBAC)

## 📱 Compatibilidade

- Chrome/Chromium
- Firefox
- Safari
- Edge
- Navegadores mobile (iOS Safari, Chrome Android)

## 🛠️ Desenvolvimento

Para fazer alterações no código:

1. Edite os arquivos em `src/`
2. O servidor de desenvolvimento recarregará automaticamente
3. Verifique o console do navegador para erros

## 📦 Build para Produção

```bash
npm run build
```

Isso criará uma pasta `build/` com os arquivos otimizados para produção.

## 🐛 Troubleshooting

### Câmera não funciona
- Verifique as permissões do navegador
- Certifique-se de estar usando HTTPS em produção
- Tente outro navegador

### Dados não persistem
- Verifique se o localStorage está habilitado
- Limpe o cache do navegador e tente novamente

### Erro ao instalar dependências
- Delete a pasta `node_modules` e `package-lock.json`
- Execute `npm install` novamente

## 📄 Licença

Este projeto é fornecido como está para fins de teste e desenvolvimento.

## 👨‍💻 Suporte

Para dúvidas ou problemas, verifique:
- Console do navegador (F12 > Console)
- Documentação do React: https://react.dev
- Documentação do React Router: https://reactrouter.com
