(() => {
  const LOG = (...a) => console.log("[Atendente WhatsApp]", ...a);
  let config = DEFAULT_CONFIG;
  let busy = false;
  let pending = "";      // teclas digitadas enquanto o nome está sendo inserido
  let armed = false;     // campo estava vazio antes de digitar/colar

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clean = (s) => (s || "").replace(/[\u200b\u200c\ufeff]/g, "");
  const getText = (c) => clean(c.innerText).trim();
  const isPrefixOnly = (t) => /^\*[^*\n]+\*$/.test(t);

  // Campo de mensagem principal (não pega a busca de conversas)
  function inComposer(el) {
    if (!el || !el.closest) return null;
    const c = el.closest('[contenteditable="true"]');
    if (!c) return null;
    if (c.closest("footer") || c.getAttribute("data-tab") === "10") return c;
    return null;
  }
  const getComposer = () =>
    document.querySelector('footer [contenteditable="true"]') ||
    document.querySelector('[contenteditable="true"][data-tab="10"]');


  // Painel da conversa aberta: sobe a partir do campo de mensagem até achar o cabeçalho
  function getChatPanel() {
    let el = getComposer();
    while (el && el !== document.body) {
      if (el.querySelector && el.querySelector("header") && el.querySelector("footer")) return el;
      el = el.parentElement;
    }
    return null;
  }

  let lastReason = "";
  function verdict(isGroup, reason) {
    if (reason !== lastReason) { lastReason = reason; LOG(isGroup ? "GRUPO ignorado:" : "conversa individual:", reason); }
    return isGroup;
  }

  // Servidor (g.us, c.us, lid...) da CONVERSA de um id de mensagem.
  // Ex.: "false_1203630@g.us_3EB0AB_5511999@lid" -> g.us (o participante, depois, é ignorado).
  // Leitura flexível: funciona com ou sem o prefixo true_/false_.
  function chatServerOf(id) {
    const m = /(?:^|_)([^_@]+)@([a-z0-9.]+)/i.exec(id || "");
    if (!m) return null;
    if (m[1].toLowerCase() === "status") return null; // resposta a status não conta
    return m[2].toLowerCase();
  }

  // Descobre se a conversa aberta é grupo/lista/canal
  function isGroupChat() {
    if (config.groups) return false; // usuário liberou grupos
    const panel = getChatPanel();
    if (!panel) return false;

    // 1) Id das mensagens (mais confiável). Decide por maioria.
    const count = {};
    const sample = [];
    for (const el of panel.querySelectorAll("[data-id]")) {
      const id = el.getAttribute("data-id");
      if (sample.length < 2) sample.push(String(id).slice(0, 50));
      const server = chatServerOf(id);
      if (server) count[server] = (count[server] || 0) + 1;
    }
    const entries = Object.entries(count).sort((a, b) => b[1] - a[1]);
    if (entries.length) {
      const isGroup = /^(g\.us|broadcast|newsletter)$/.test(entries[0][0]);
      return verdict(isGroup, "ids das mensagens: " + JSON.stringify(count));
    }

    // 2) Sem ids reconhecíveis (conversa vazia ou formato diferente): olha o cabeçalho
    const header = panel.querySelector("header");
    if (header) {
      if (header.querySelector('[data-icon^="default-group"], [data-icon^="default-community"], [data-icon^="default-broadcast"]'))
        return verdict(true, "ícone de grupo no cabeçalho");

      const texts = [...header.querySelectorAll("span[title], span[dir], div[title]")]
        .map((n) => (n.getAttribute("title") || n.textContent || "").trim())
        .filter(Boolean);
      for (const t of texts) {
        // lista de participantes: "Maria, João, Você"
        if (t.includes(",") && /(^|,\s*)(Você|You|Tú|Vous)(\s*,|$)/i.test(t)) return verdict(true, "participantes no cabeçalho: " + t.slice(0, 40));
        // só o texto específico de grupo (não "clique aqui para dados do contato")
        if (/(dados do grupo|group info|info\. do grupo)/i.test(t)) return verdict(true, "texto do cabeçalho: " + t.slice(0, 40));
      }
    }

    // 3) Nome de quem enviou aparece acima das mensagens recebidas só em grupos
    if (panel.querySelector('[data-testid="author"]')) return verdict(true, "nome do remetente nas mensagens");

    if (sample.length) LOG("ids não reconhecidos (me envie se der problema):", sample);
    return verdict(false, "sem sinais de grupo");
  }

  chrome.storage.sync.get("config", (res) => {
    if (res.config) config = res.config;
  });
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.config) config = changes.config.newValue || DEFAULT_CONFIG;
  });

  function currentName() {
    const a = getActiveAttendant(config);
    return a && a.name && a.name.trim() ? a.name.trim() : null;
  }

  function selectAll(c) {
    const sel = window.getSelection();
    const r = document.createRange();
    r.selectNodeContents(c);
    sel.removeAllRanges();
    sel.addRange(r);
  }
  function caret(c, atStart) {
    const sel = window.getSelection();
    const r = document.createRange();
    r.selectNodeContents(c);
    r.collapse(atStart);
    sel.removeAllRanges();
    sel.addRange(r);
  }

  const hasBreakAfterName = (c) => {
    const t = clean(c.innerText);
    const i = t.indexOf("*", 1);
    return i > -1 && /\n/.test(t.slice(i + 1, i + 3));
  };

  async function insertBreak(c) {
    const attempts = [
      () => c.dispatchEvent(new InputEvent("beforeinput", { inputType: "insertLineBreak", bubbles: true, cancelable: true, composed: true })),
      () => document.execCommand("insertLineBreak"),
      () => document.execCommand("insertParagraph"),
      () => {
        for (const type of ["keydown", "keypress", "keyup"]) {
          c.dispatchEvent(new KeyboardEvent(type, { key: "Enter", code: "Enter", keyCode: 13, which: 13, shiftKey: true, bubbles: true, cancelable: true }));
        }
      },
      () => {
        const dt = new DataTransfer();
        dt.setData("text/plain", "\n");
        c.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
      }
    ];
    for (const attempt of attempts) {
      try { attempt(); } catch (_) {}
      await sleep(60);
      if (hasBreakAfterName(c)) return true;
    }
    return false;
  }

  // Caminho 1 (campo vazio): escreve "*Nome*" + quebra e depois o que o usuário digitou
  async function startWithPrefix(c, name, firstChars) {
    busy = true;
    try {
      c.focus();
      selectAll(c);
      await sleep(30);
      document.execCommand("insertText", false, `*${name}*`);
      await sleep(60);
      await insertBreak(c);
      caret(c, false);
      await sleep(30);
      const typed = firstChars + pending;
      pending = "";
      if (typed) document.execCommand("insertText", false, typed);
      LOG("nome inserido:", name);
    } finally {
      busy = false;
    }
  }

  // Caminho 2 (colar, acentos etc.): o texto já está no campo, coloca o nome na frente
  async function prependToExisting(c, name) {
    busy = true;
    try {
      c.focus();
      caret(c, true);
      await sleep(60);
      document.execCommand("insertText", false, `*${name}*`);
      await sleep(60);
      await insertBreak(c);
      caret(c, false);
      LOG("nome inserido (prepend):", name);
    } finally {
      busy = false;
    }
  }

  function checkAfterChange(c) {
    if (busy || !armed) return;
    if (isGroupChat()) { armed = false; return; }
    const name = currentName();
    if (!name) { armed = false; return; }
    const text = getText(c);
    if (!text) return; // ainda não apareceu nada, tenta de novo no próximo check
    armed = false;
    if (!text.startsWith(`*${name}*`)) prependToExisting(c, name);
  }

  function arm(c) {
    if (busy || isGroupChat()) return;
    armed = getText(c) === "";
    if (!armed) return;
    [40, 120, 300].forEach((ms) => setTimeout(() => checkAfterChange(c), ms));
    setTimeout(() => (armed = false), 600);
  }

  // Digitação de caractere simples em campo vazio
  document.addEventListener(
    "keydown",
    (e) => {
      if (!e.isTrusted) return;
      const c = inComposer(e.target);
      if (!c) return;

      // bloqueia envio de mensagem só com o nome
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing && isPrefixOnly(getText(c))) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }

      if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") arm(c); // colar
        return;
      }

      const printable = e.key.length === 1 && e.key !== " ";
      if (!busy && isGroupChat()) return;

      // caractere chegou enquanto o nome está sendo escrito: guarda na fila
      if (busy && printable) {
        e.preventDefault();
        e.stopImmediatePropagation();
        pending += e.key;
        return;
      }

      if (!printable) return;
      const name = currentName();
      if (!name) return;
      if (getText(c) !== "") return;

      e.preventDefault();
      e.stopImmediatePropagation();
      startWithPrefix(c, name, e.key);
    },
    true
  );

  // Colar ou outras entradas (acentos mortos, IME) em campo vazio
  document.addEventListener("paste", (e) => {
    if (!e.isTrusted) return;
    const c = inComposer(e.target);
    if (c) arm(c);
  }, true);

  document.addEventListener("beforeinput", (e) => {
    if (!e.isTrusted || busy) return;
    const c = inComposer(e.target);
    if (c && e.inputType && e.inputType.startsWith("insert") && !/Break|Paragraph/.test(e.inputType)) arm(c);
  }, true);

  document.addEventListener("compositionend", (e) => {
    const c = inComposer(e.target);
    if (c) { armed = armed || false; setTimeout(() => checkAfterChange(c), 30); }
  }, true);

  // Botão de enviar com só o nome no campo
  document.addEventListener(
    "click",
    (e) => {
      const btn = e.target.closest && e.target.closest("button, [role='button']");
      if (!btn || !btn.querySelector('span[data-icon="send"]')) return;
      const c = getComposer();
      if (c && isPrefixOnly(getText(c))) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true
  );

  LOG("carregada");
})();
