let config = structuredClone(DEFAULT_CONFIG);

const $ = (id) => document.getElementById(id);

function readFromUI() {
  const rows = [...document.querySelectorAll(".att")];
  config.attendants = rows.map((r) => ({
    enabled: r.querySelector(".a-on").checked,
    name: r.querySelector(".a-name").value.trim(),
    start: r.querySelector(".a-start").value || "00:00",
    end: r.querySelector(".a-end").value || "00:00"
  }));
  config.enabled = $("enabled").checked;
  config.groups = $("groups").checked;
  config.mode = $("mode").value;
  config.manualIndex = Number($("manualIndex").value) || 0;
}

function renderList() {
  const list = $("list");
  list.textContent = "";
  config.attendants.forEach((a, i) => {
    const row = document.createElement("div");
    row.className = "att";

    const on = document.createElement("input");
    on.type = "checkbox"; on.className = "a-on"; on.checked = a.enabled !== false; on.title = "Ativar este atendente";

    const name = document.createElement("input");
    name.type = "text"; name.className = "a-name"; name.value = a.name; name.placeholder = "Nome do atendente";

    const del = document.createElement("button");
    del.className = "del"; del.textContent = "✕"; del.title = "Remover";
    del.onclick = () => { readFromUI(); config.attendants.splice(i, 1); refresh(); };

    const times = document.createElement("div");
    times.className = "times";
    const start = document.createElement("input");
    start.type = "time"; start.className = "a-start"; start.value = a.start;
    const end = document.createElement("input");
    end.type = "time"; end.className = "a-end"; end.value = a.end;
    times.append("das ", start, " até ", end);

    row.append(on, name, del, times);
    list.appendChild(row);

    [on, name, start, end].forEach((el) => el.addEventListener("input", () => { readFromUI(); renderStatus(); renderManual(); }));
  });
}

function renderManual() {
  const sel = $("manualIndex");
  sel.textContent = "";
  config.attendants.forEach((a, i) => {
    const o = document.createElement("option");
    o.value = i; o.textContent = a.name || `(sem nome ${i + 1})`;
    sel.appendChild(o);
  });
  sel.value = Math.min(config.manualIndex, Math.max(config.attendants.length - 1, 0));
  $("manualRow").style.display = config.mode === "manual" ? "flex" : "none";
}

function renderStatus() {
  const active = getActiveAttendant(config);
  const st = $("status");
  if (!config.enabled) {
    st.className = "status off"; st.textContent = "Extensão desativada.";
    $("preview").textContent = "";
  } else if (!active) {
    st.className = "status off"; st.textContent = "Nenhum atendente ativo neste horário (as mensagens vão sem nome).";
    $("preview").textContent = "";
  } else {
    st.className = "status"; st.textContent = `Atendente ativo agora:\n${active.name}`;
    $("preview").textContent = `*${active.name}*\ntexto da mensagem`;
  }
}

function refresh() {
  $("enabled").checked = config.enabled;
  $("groups").checked = !!config.groups;
  $("mode").value = config.mode;
  renderList();
  renderManual();
  renderStatus();
}

$("add").onclick = () => {
  readFromUI();
  config.attendants.push({ name: `Atendente ${config.attendants.length + 1}`, start: "00:00", end: "23:59", enabled: true });
  refresh();
};

$("mode").onchange = () => { readFromUI(); renderManual(); renderStatus(); };
$("manualIndex").onchange = () => { readFromUI(); renderStatus(); };
$("enabled").onchange = () => { readFromUI(); renderStatus(); };

$("save").onclick = () => {
  readFromUI();
  chrome.storage.sync.set({ config }, () => {
    $("save").textContent = "Salvo ✓";
    setTimeout(() => ($("save").textContent = "Salvar"), 1200);
    renderStatus();
  });
};

chrome.storage.sync.get("config", (res) => {
  if (res.config) config = res.config;
  refresh();
});
