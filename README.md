# Atendente Personalizado Whatsapp

Extensão para Google Chrome que adiciona automaticamente o **nome do atendente** no início das mensagens enviadas pelo **WhatsApp Web**, com troca de atendente **por horário**.

As mensagens ficam neste formato:

```
*Atendente 1*
texto da mensagem
```

O nome entra em negrito (padrão do WhatsApp), seguido de uma quebra de linha.

---

## Recursos

- **Nome automático na digitação:** ao digitar a primeira letra num campo de mensagem vazio, a extensão insere `*Nome*` e a quebra de linha, e a sua letra vem logo em seguida. Nada é escrito ao clicar no campo ou trocar de conversa, então não são criados rascunhos.
- **Atendentes por horário:** cadastre quantos atendentes quiser, cada um com seu período (ex.: *Atendente 1 das 06:00 às 15:00*, *Atendente 2 das 15:00 às 22:00*). A extensão escolhe sozinha quem está ativo no momento.
- **Virada de meia-noite:** períodos como 22:00 até 06:00 funcionam.
- **Modo manual:** fixe um atendente e ignore o horário.
- **Liga/desliga geral** e opção de ativar/desativar cada atendente.
- **Ignora grupos por padrão:** a extensão não age em grupos, listas de transmissão e canais. Há uma opção no popup para usar também em grupos.
- **Proteção contra mensagem vazia:** se sobrar apenas o nome no campo, o envio é bloqueado para não mandar `*Atendente*` sozinho.
- **Privacidade:** nenhum dado é enviado para fora. As configurações ficam salvas em `chrome.storage.sync`.

## Instalação (modo desenvolvedor)

1. Baixe ou clone este repositório e extraia os arquivos em uma pasta.
2. Abra `chrome://extensions` no Chrome.
3. Ative o **Modo do desenvolvedor** (canto superior direito).
4. Clique em **Carregar sem compactação** e selecione a pasta do projeto.
5. Abra o [WhatsApp Web](https://web.whatsapp.com) e recarregue a página (`Ctrl+Shift+R`).

## Como usar

Clique no ícone da extensão para abrir o popup:

| Opção | O que faz |
|---|---|
| **Ativo** | Liga ou desliga a extensão. |
| **Modo** | *Automático por horário* ou *Atendente fixo (manual)*. |
| **Usar também em grupos** | Por padrão desligado. |
| **Atendentes** | Nome, horário de início e fim, e caixa para ativar/desativar. |
| **+ Adicionar atendente** | Cadastra um novo atendente. |
| **Salvar** | Aplica as alterações. |

O popup mostra qual atendente está ativo no momento e uma prévia do formato da mensagem. Fora de qualquer horário cadastrado, as mensagens vão sem nome.

Na primeira instalação a extensão vem com um único atendente ("Atendente 1"), ativo o dia todo.

## Como funciona

- O `content.js` roda apenas em `https://web.whatsapp.com/*` e observa o campo de mensagem principal.
- Ao detectar a primeira tecla num campo vazio, insere o prefixo e a quebra de linha usando eventos de edição compatíveis com o editor do WhatsApp (que não aceita edição direta do DOM). Teclas digitadas durante a inserção ficam numa fila e são aplicadas logo depois.
- Para identificar grupos, lê o tipo da conversa nos identificadores das mensagens (`g.us` para grupos, `broadcast` para listas, `newsletter` para canais) e, quando não há mensagens para ler, usa o cabeçalho da conversa (ícone padrão de grupo e lista de participantes).
- O horário usado é o do relógio do computador.

## Estrutura do projeto

```
├── manifest.json     # Manifest V3, permissões e ícones
├── content.js        # Lógica no WhatsApp Web (inserção do nome, detecção de grupos)
├── shared.js         # Configuração padrão e cálculo do atendente ativo
├── popup.html        # Interface de configuração
├── popup.js          # Lógica do popup
└── icons/            # Ícones 16, 32, 48 e 128 px
```

**Permissões:** `storage` (salvar as configurações) e acesso a `https://web.whatsapp.com/*`.

## Limitações conhecidas

- A extensão depende da estrutura interna do WhatsApp Web, que não é documentada e pode mudar. Se uma atualização do WhatsApp quebrar algum comportamento, pode ser necessário ajustar o `content.js`.
- **Legenda de imagens e vídeos** ainda não é suportada.
- A detecção de grupos é feita por heurísticas. Em conversas sem mensagens e sem sinais no cabeçalho, a conversa é tratada como individual.

## Depuração

A extensão escreve no Console do navegador (`F12` → *Console*) mensagens que começam com `[Atendente WhatsApp]`, informando quando o nome foi inserido e por que uma conversa foi tratada como grupo ou individual. Inclua essas linhas ao abrir uma issue.

## Aviso

Este é um projeto independente. Não é afiliado, associado, autorizado ou endossado pelo WhatsApp ou pela Meta. *WhatsApp* é marca registrada de seus respectivos proprietários.
