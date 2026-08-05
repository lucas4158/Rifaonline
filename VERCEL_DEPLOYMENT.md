# 🚀 Como Publicar sua Rifa Online na Vercel

Sua aplicação de Rifa Online foi preparada com sucesso para ser hospedada na **Vercel**! 

Como a API do Mercado Pago foi removida e todo o sistema de banco de dados (gerenciamento de pedidos, travas de cotas em tempo real, sorteador inteligente e configurações) roda **diretamente no cliente (browser) via Firebase**, seu projeto agora é um **SPA (Single Page Application) 100% Client-Side**.

Isso torna a **Vercel** a melhor opção de hospedagem: é extremamente rápida, segura e possui um plano gratuito excelente para produções deste nível.

---

## 📁 Arquivos de Configuração Adicionados

1. **`vercel.json`** (Na raiz do projeto):
   Garante o redirecionamento correto em SPAs. Se o usuário navegar para uma URL interna ou recarregar a página, a Vercel redirecionará internamente para o `index.html` para que o React assuma a rota, evitando erros de tela preta ou `404 Not Found`.

2. **`firebase-applet-config.json`**:
   **Atenção:** Certifique-se de que este arquivo contendo as chaves de acesso públicas do seu projeto do Firebase seja subido no seu repositório Git, pois o React em produção precisa dele para inicializar a conexão em tempo real com o banco de dados.

---

## 🛠️ Passo a Passo para Deploy na Vercel

Siga estas instruções simples para colocar o seu site no ar em menos de 2 minutos:

### Passo 1: Enviar as alterações para o seu GitHub
Antes de tudo, garanta que seu repositório no GitHub (`https://github.com/lucas4158/Rifasonline.git`) esteja com as últimas alterações que realizamos aqui. Execute no seu terminal local:

```bash
git add .
git commit -m "chore: preparado para deploy na Vercel"
git push origin main
```

### Passo 2: Importar o Projeto na Vercel
1. Acesse o painel da **[Vercel](https://vercel.com/)** e faça login com sua conta do GitHub.
2. No painel principal, clique em **"Add New..."** e selecione **"Project"**.
3. Na lista de repositórios do seu GitHub, selecione o repositório **`Rifasonline`**.
4. Clique em **"Import"**.

### Passo 3: Configurar os Parâmetros do Build
A Vercel reconhecerá automaticamente que o seu projeto utiliza **Vite** e configurará o ambiente.

Na seção **"Build & Development Settings"**, você pode manter as opções padrão ou customizá-las para obter a melhor performance e menor tempo de compilação:

* **Framework Preset:** Selecione `Vite` (geralmente detectado de forma automática).
* **Build Command:** *(Opcional)* Substitua o comando padrão por:
  ```bash
  vite build
  ```
  *(Isso evita que a Vercel compile o código do servidor Node local `server.ts`, que só é usado no ambiente de desenvolvimento integrado para simuladores. O build de produção do seu site será 100% focado no frontend estático).*
* **Output Directory:** Mantenha `dist` (padrão do Vite).

### Passo 4: Deploy!
1. Clique no botão azul **"Deploy"**.
2. Aguarde cerca de 1 a 2 minutos enquanto a Vercel baixa as dependências, compila o site e otimiza as imagens.
3. **Pronto!** A Vercel fornecerá um link gratuito seguro com certificado SSL ativo em formato `meu-projeto.vercel.app`.

---

## 🔒 Segurança do Firebase em Produção
Como o acesso ao banco de dados agora acontece totalmente pela conexão frontend direta, recomendamos garantir que suas **regras de segurança no Firestore** estejam ativas e protegendo as coleções `orders` (pedidos), `locks` (trava temporária de número) e `raffle` (configurações do prêmio). 

Isso impede que usuários não-autenticados façam alterações não permitidas no site, deixando tudo 100% blindado contra modificações maliciosas!
