// ==========================
// 📄 Player Detail (Simplified View)
// ==========================
app.get("/admin/player/:userId", requireAdmin, (_req, res) => {
  res.send(/* html */`
  <!doctype html>
  <html lang="th">
  <head>
    <meta charset="utf-8"/>
    <title>Player Detail</title>
    <style>
      :root { color-scheme: dark; }
      body{margin:0;background:#0a0f1f;color:#e2e8f0;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto}
      header{position:sticky;top:0;background:linear-gradient(180deg,#0a0f1f,rgba(10,15,31,.7));backdrop-filter:blur(6px);z-index:10;padding:12px 16px;border-bottom:1px solid #102242;display:flex;gap:10px;align-items:center}
      h1{font-size:18px;margin:0;color:#a5e1ff}
      .spacer{flex:1}
      .btn{background:#0ea5e9;border:none;color:#fff;padding:8px 12px;border-radius:8px;cursor:pointer}
      .btn.red{background:#ef4444}
      .container{max-width:1000px;margin:16px auto;padding:0 16px}
      .panel{background:#0f172a;border:1px solid #15223d;border-radius:14px;box-shadow:0 0 18px rgba(2,132,199,.18);padding:16px;margin-bottom:20px}
      .title{font-weight:700;color:#93c5fd;margin-bottom:10px}
      .row{display:flex;justify-content:space-between;margin:4px 0;color:#cbd5e1;font-size:14px}
      .avatar{width:140px;height:140px;border-radius:50%;display:block;margin:0 auto 10px;background:#0b1220}
      .mono{font-family: ui-monospace, SFMono-Regular, Menlo, monospace;}
      .small{font-size:12px;color:#9fb2cc}
      .pill{display:inline-block;background:#0b1220;border:1px solid #1a2748;border-radius:999px;padding:4px 8px;font-size:12px;color:#a5b4fc}
    </style>
  </head>
  <body>
    <header>
      <button class="btn" onclick="history.back()">← Back</button>
      <h1 id="head">Player</h1>
      <div class="spacer"></div>
      <button class="btn red" onclick="location.href='/admin/logout'">Logout</button>
    </header>

    <div class="container">
      <div class="panel">
        <img id="avatar" class="avatar" src="" alt="avatar"/>
        <div class="title" id="pname">Unknown</div>
        <div class="small mono" id="pid"></div>
        <div class="small" id="updated"></div>
      </div>

      <div class="panel">
        <div class="title">ID</div>
        <div id="idblock" class="mono small">-</div>
      </div>

      <div class="panel">
        <div class="title">Bank</div>
        <div id="bank" class="mono small">-</div>
      </div>

      <div class="panel">
        <div class="title">Suit</div>
        <div id="suit" class="mono small">-</div>
      </div>

      <div class="panel">
        <div class="title">Vault</div>
        <div id="vault"></div>
      </div>

      <div class="panel">
        <div class="title">Inventory</div>
        <div id="inv"></div>
      </div>
    </div>

    <script>
      const userId = location.pathname.split('/').pop();

      function rbxHead(u){ 
        return \`https://www.roblox.com/headshot-thumbnail/image?userId=\${u}&width=180&height=180&format=png\`; 
      }

      function kv(obj){
        return Object.entries(obj).map(([k,v]) => 
          \`<div class="row"><span>\${k}</span><span>\${v}</span></div>\`
        ).join('');
      }

      function renderList(containerId, data){
        const el = document.getElementById(containerId);
        if(!data || Object.keys(data).length === 0){
          el.innerHTML = "<div class='small'>No data</div>";
          return;
        }
        el.innerHTML = kv(data);
      }

      async function load(){
        const res = await fetch('/api/player/' + userId);
        if(!res.ok){ alert('Player not found'); history.back(); return; }
        const p = await res.json();
        const d = p.data || {};

        document.getElementById('avatar').src = rbxHead(p.user_id);
        document.getElementById('pname').textContent = p.username || 'Unknown';
        document.getElementById('pid').textContent = 'UserID: ' + p.user_id;
        document.getElementById('updated').textContent = 'Updated: ' + new Date(p.updated_at).toLocaleString();
        document.getElementById('head').textContent = (p.username||'Unknown') + ' (UserID: ' + p.user_id + ')';

        document.getElementById('idblock').innerHTML = kv(d.ID || {});
        document.getElementById('bank').textContent = d.Bank || '-';
        document.getElementById('suit').innerHTML = kv({
          SuitP: d.SuitP,
          SuitS: d.SuitS
        });

        renderList('vault', d.Vault);
        renderList('inv', d.Inventory);
      }

      load();
    </script>
  </body>
  </html>
  `);
});
