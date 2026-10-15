/* Ajustes de leitura, filtros e responsividade do extrato. */
(function () {
  const STYLE = document.createElement('style');
  STYLE.textContent = `
    #containerExtrato{overflow-x:hidden!important;padding:12px 4px 110px}
    #lista{min-width:0!important;width:100%}
    .extratoIntro{max-width:100%!important;padding:16px}
    .extratoIntro h2{margin:0 0 4px;font-size:20px}
    .extratoIntro p{color:#475569;margin:0 0 12px}
    .extratoIntro input{margin-bottom:8px}
    .extratoIntro button{margin:4px 4px 0 0}
    .filtroGrupo{width:100%}
    .filtroGrupo .btnFiltro{flex:1;min-height:40px}
    #filtroDataInicio,#filtroDataFim{min-width:0!important}
    #lista .boxMes{max-width:100%}
    #lista .listaMovimentos{grid-template-columns:minmax(0,1fr)}
    #lista .cabecalhoExtrato{display:none!important}
    #lista .movItem{display:grid!important;grid-template-columns:1fr 1fr!important;gap:10px!important;padding:14px!important;min-width:0!important}
    #lista .movItem>div{width:100%!important;min-width:0}
    #lista .movItem>div:nth-child(3),#lista .movItem>div:nth-child(4){grid-column:1/-1}
    #lista .movItem>div:nth-child(4){overflow-wrap:anywhere}
    #lista .movItem input[type=date]{width:100%!important;min-width:0!important}
    #lista .movItem>div:nth-child(5){justify-content:flex-start!important}
    #lista .movItem>div:nth-child(6),#lista .movItem>div:nth-child(7),#lista .movItem>div:nth-child(8){justify-content:flex-start!important}
    .qrActions{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
    .qrActions button{flex:1}
    .qrModal{position:fixed;inset:0;z-index:1000000;background:rgba(15,23,42,.72);display:flex;align-items:center;justify-content:center;padding:16px}
    .qrBox{width:min(520px,100%);max-height:90vh;overflow:auto;background:#fff;padding:18px;border-radius:18px;box-shadow:0 20px 60px #0005}
    .qrBox h2{margin:0 0 8px}.qrBox video{width:100%;max-height:45vh;background:#0f172a;border-radius:12px;object-fit:contain}
    .qrBox textarea{min-height:85px;font-size:12px;overflow-wrap:anywhere}
    .qrStatus{min-height:24px;color:#334155;font-size:13px;margin:8px 0}
    @media(min-width:901px){#lista .movItem{grid-template-columns:100px 100px 130px minmax(140px,1fr) 140px 110px 90px 50px!important}}
  `;
  document.head.appendChild(STYLE);

  let filtroTipo = 'TODAS';
  let fluxoCamera = null;
  let rafCamera = 0;

  window.render = function renderExtratoCompleto() {
    if (!usuario || !usuario.id) return;
    const tela = safe('telaExtrato'), lista = safe('lista'), resumo = safe('resumo');
    if (!tela || !tela.classList.contains('telaAtiva') || !lista || !resumo) return;
    const inicio = safe('filtroDataInicio')?.value || '';
    const fim = safe('filtroDataFim')?.value || '';
    const busca = (safe('buscaMovimento')?.value || '').trim().toLocaleLowerCase('pt-BR');
    const filtrados = (dados || []).filter(x => {
      const dt = String(x.data_vencimento || x.data || '').slice(0, 10);
      if (inicio && dt < inicio) return false;
      if (fim && dt > fim) return false;
      if (filtroTipo === 'RECEITA' && x.tipo !== 'RECEITA') return false;
      if (filtroTipo === 'DESPESA' && x.tipo !== 'DESPESA') return false;
      if (filtroTipo === 'RECORRENTES' && !x.recorrente) return false;
      const texto = `${x.descricao || ''} ${x.categoria || ''}`.toLocaleLowerCase('pt-BR');
      return !busca || texto.includes(busca);
    });
    if (!filtrados.length) {
      lista.innerHTML = `<div class="card">Nenhum lançamento encontrado para este filtro.</div>`;
      resumo.innerHTML = resumoHTML(filtrados);
      return;
    }
    const porMes = {};
    filtrados.forEach(x => {
      const dt = String(x.data_vencimento || x.data || '').slice(0, 10);
      if (!dt) return;
      const chave = dt.slice(0, 7);
      (porMes[chave] ||= []).push(x);
    });
    let html = '';
    Object.keys(porMes).sort((a,b) => b.localeCompare(a)).forEach(chave => {
      const [ano, mes] = chave.split('-');
      const itens = porMes[chave].sort((a,b) => String(a.data_vencimento || a.data).localeCompare(String(b.data_vencimento || b.data)));
      const receita = itens.filter(x=>x.tipo==='RECEITA').reduce((s,x)=>s+Number(x.valor||0),0);
      const despesa = itens.filter(x=>x.tipo==='DESPESA').reduce((s,x)=>s+Number(x.valor||0),0);
      const saldo = receita - despesa;
      const recolhido = mesesOcultos[chave] === true;
      html += `<section class="boxMes"><div class="topoMes" role="button" tabindex="0" onclick="toggleMes('${chave}')"><div class="tituloMes"><span style="background:${corMes(mes)}">📅</span>${nomeMes(mes)} ${ano}<small style="color:#64748b"> · ${itens.length} lanç.</small></div><div class="totalMes"><div class="valorMes" style="color:${saldo>=0?'#16a34a':'#dc2626'}">${ocultarSaldo?'R$ ***':formatarMoeda(saldo)}</div><button class="btnMes" aria-label="Alternar exibição do saldo" onclick="event.stopPropagation();toggleMesValor('${chave}')">👁</button></div></div>`;
      if (!recolhido) {
        html += '<div class="listaMovimentos">';
        itens.forEach(x => {
          const v = Number(x.valor || 0), st = x.status || 'pendente';
          const oculto = visibilidade[x.id] === true;
          const dataV = String(x.data_vencimento || x.data || '').slice(0,10);
          const dataP = String(x.data || '').slice(0,10);
          const seguro = valor => String(valor ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
          html += `<article class="movItem"><div><small>Vencimento</small><input aria-label="Vencimento" type="date" value="${dataV}" onchange="editarCampo('${seguro(x.id)}','data_vencimento',this.value)"></div><div><small>Data do lançamento</small><input aria-label="Data do lançamento" type="date" value="${dataP}" onchange="editarCampo('${seguro(x.id)}','data',this.value)"></div><div><span style="padding:4px 8px;border-radius:999px;background:${corCategoria(x.categoria)}22;color:${corCategoria(x.categoria)};font-weight:800;font-size:11px">${seguro(x.categoria||'GERAL')}</span><div style="margin-top:6px;font-size:11px;font-weight:800;color:${x.tipo==='RECEITA'?'#16a34a':'#dc2626'}">${x.tipo==='RECEITA'?'RECEITA':'DESPESA'}</div></div><div style="min-width:0;font-size:14px;font-weight:800;color:#0f172a;overflow-wrap:anywhere">${modoEdicao?`<input aria-label="Descrição" value="${seguro(x.descricao||'')}" onchange="editarCampo('${seguro(x.id)}','descricao',this.value)">`:seguro(x.descricao||'-')}</div><div style="display:flex;justify-content:flex-end;align-items:center"><div style="font-size:17px;font-weight:900;color:${x.tipo==='RECEITA'?'#16a34a':'#dc2626'}">${modoEdicao?`<input aria-label="Valor" value="${v}" type="number" step="0.01" onchange="editarCampo('${seguro(x.id)}','valor',this.value)">`:(ocultarSaldo||oculto?'R$ ***':formatarMoeda(v))}</div></div><div>${x.tipo==='DESPESA'?`<button onclick="toggleStatus('${seguro(x.id)}','${st}')" class="btnStatus ${st==='pago'?'btnPago':'btnPendente'}">${st==='pago'?'PAGO':'PENDENTE'}</button>`:'<span class="btnStatus btnPago">RECEBIDA</span>'}</div><div><button onclick="toggleRecorrencia('${seguro(x.id)}',${!!x.recorrente})" class="btnRecorrencia">${x.recorrente?'RECORRENTE':'AVULSA'}</button></div><div><button aria-label="Alternar valor" onclick="toggleValor('${seguro(x.id)}')" class="btnMini btnEditar">👁</button><button aria-label="Excluir lançamento" onclick="excluirLancamento('${seguro(x.id)}')" class="btnMini btnExcluir">🗑</button></div></article>`;
        });
        const pagas = itens.filter(x=>x.tipo==='DESPESA'&&x.status==='pago').reduce((s,x)=>s+Number(x.valor||0),0);
        const pendentes = itens.filter(x=>x.tipo==='DESPESA'&&x.status!=='pago').reduce((s,x)=>s+Number(x.valor||0),0);
        html += `<div class="card" style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:13px"><b style="color:#16a34a">Pagas: ${formatarMoeda(pagas)}</b><b style="color:#d97706">A pagar: ${formatarMoeda(pendentes)}</b></div></div>`;
      }
      html += '</section>';
    });
    lista.innerHTML = html;
    resumo.innerHTML = resumoHTML(filtrados);
  };
  function resumoHTML(itens) {
    const r = itens.filter(x=>x.tipo==='RECEITA').reduce((s,x)=>s+Number(x.valor||0),0);
    const d = itens.filter(x=>x.tipo==='DESPESA').reduce((s,x)=>s+Number(x.valor||0),0);
    const pago = itens.filter(x=>x.tipo==='DESPESA'&&x.status==='pago').reduce((s,x)=>s+Number(x.valor||0),0);
    const pend = d-pago, saldo=r-d;
    return `<div class="card" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px"><div>Receitas<br><b style="color:#16a34a">${ocultarSaldo?'R$ ***':formatarMoeda(r)}</b></div><div>Despesas<br><b style="color:#dc2626">${ocultarSaldo?'R$ ***':formatarMoeda(d)}</b></div><div>Saldo<br><b style="color:${saldo>=0?'#0284c7':'#dc2626'}">${ocultarSaldo?'R$ ***':formatarMoeda(saldo)}</b></div><div>Pagas<br><b>${ocultarSaldo?'R$ ***':formatarMoeda(pago)}</b></div><div>A pagar<br><b>${ocultarSaldo?'R$ ***':formatarMoeda(pend)}</b></div></div>`;
  }
  window.mostrarTudo = function(){
    ['filtroDataInicio','filtroDataFim','buscaMovimento'].forEach(id=>{if(safe(id))safe(id).value='';});
    filtroTipo='TODAS'; mesesOcultos={}; render();
  };
  window.expandirMeses = function(recolher){ mesesOcultos={}; (dados||[]).forEach(x=>{const dt=String(x.data_vencimento||x.data||'').slice(0,7);if(dt)mesesOcultos[dt]=!!recolher;});render(); };
  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('.filtroGrupo .btnFiltro').forEach((b,i)=>b.addEventListener('click',()=>{
      filtroTipo=['TODAS','RECEITA','DESPESA','RECORRENTES'][i]||'TODAS';
      document.querySelectorAll('.filtroGrupo .btnFiltro').forEach(x=>x.classList.remove('btnFiltroAtivo')); b.classList.add('btnFiltroAtivo');render();
    }));
    const mes=safe('selectMesRapido'); if(mes)mes.addEventListener('change',()=>{
      const [ano,m]=mes.value.split('-');if(!ano||!m)return;
      const ultimo=new Date(Number(ano),Number(m),0).getDate();
      safe('filtroDataInicio').value=`${ano}-${m}-01`;safe('filtroDataFim').value=`${ano}-${m}-${String(ultimo).padStart(2,'0')}`;render();
    });
  });

  async function carregarImagemQR(file) {
    if (!window.jsQR) throw new Error('Leitor QR não carregado. Verifique a conexão e tente novamente.');
    const img = new Image(); const url=URL.createObjectURL(file);
    try {
      await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});
      const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
      const scale=Math.min(1,1800/Math.max(img.naturalWidth,img.naturalHeight));
      canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      const frame=ctx.getImageData(0,0,canvas.width,canvas.height);
      let code=jsQR(frame.data,frame.width,frame.height,{inversionAttempts:'attemptBoth'});
      if(!code && scale<1){canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;ctx.drawImage(img,0,0);const full=ctx.getImageData(0,0,canvas.width,canvas.height);code=jsQR(full.data,full.width,full.height,{inversionAttempts:'attemptBoth'});}
      if(!code)throw new Error('Não encontrei um QR Code legível. Tente uma foto mais próxima, reta e iluminada.');
      return code.data;
    } finally { URL.revokeObjectURL(url); }
  }
  function parsePix(payload) {
    if(!payload.startsWith('000201'))return {};
    let i=0, fields={};
    while(i+4<=payload.length){const id=payload.slice(i,i+2),n=Number(payload.slice(i+2,i+4));if(!Number.isFinite(n)||n<0)break;const val=payload.slice(i+4,i+4+n);if(val.length!==n)break;fields[id]=val;i+=4+n;}
    const amount=Number(fields['54']);
    return {isPix:true,amount:Number.isFinite(amount)&&amount>0?amount:null,beneficiario:fields['59']||'',cidade:fields['60']||''};
  }
  window.abrirQR = function(){
    if(safe('qrModal'))safe('qrModal').remove();
    const modal=document.createElement('div');modal.id='qrModal';modal.className='qrModal';
    modal.innerHTML=`<div class="qrBox"><h2>Leitor de QR Code</h2><p>Use a câmera ou escolha uma foto da conta. Os dados serão preenchidos para você revisar.</p><video id="qrVideo" playsinline></video><div class="qrStatus" id="qrStatus" aria-live="polite"></div><label for="qrArquivo">Foto do QR Code</label><input id="qrArquivo" type="file" accept="image/*"><div id="qrResultado"></div><div style="display:flex;gap:8px;margin-top:10px"><button type="button" onclick="fecharQR()">Fechar</button><button type="button" id="qrCamera">Ativar câmera</button></div></div>`;
    document.body.appendChild(modal);
    safe('qrArquivo').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;setQRStatus('Lendo imagem…');try{mostrarPayloadQR(await carregarImagemQR(f));}catch(err){setQRStatus(err.message);}});
    safe('qrCamera').onclick=ativarCamera;
  };
  function setQRStatus(s){const el=safe('qrStatus');if(el)el.textContent=s;}
  function mostrarPayloadQR(payload){
    const pix=parsePix(payload);setQRStatus(pix.isPix?'Pix identificado. Revise os campos antes de salvar.':'QR Code reconhecido. Revise os campos manualmente.');
    const box=safe('qrResultado');box.innerHTML=`<label>Conteúdo reconhecido</label><textarea readonly>${payload}</textarea>`;
    if(pix.isPix){safe('tipoNovo').value='DESPESA';safe('statusNovo').value='pendente';if(pix.amount)safe('valorNovo').value=pix.amount.toFixed(2);if(pix.beneficiario&&!safe('descNovo').value)safe('descNovo').value=`Pix - ${pix.beneficiario}`;if(!safe('dataNovo').value)safe('dataNovo').value=hojeISO();if(!safe('vencimentoNovo').value)safe('vencimentoNovo').value=hojeISO();}
  }
  async function ativarCamera(){
    try{if(!navigator.mediaDevices?.getUserMedia)throw new Error('Câmera indisponível. Use a opção de enviar uma foto.');if(!window.jsQR)throw new Error('Leitor QR não carregado.');
      fluxoCamera=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
      const video=safe('qrVideo');video.srcObject=fluxoCamera;await video.play();setQRStatus('Aponte a câmera para o QR Code.');
      const scan=()=>{if(!video.isConnected||video.readyState<2){rafCamera=requestAnimationFrame(scan);return;}const c=document.createElement('canvas');c.width=video.videoWidth;c.height=video.videoHeight;const cx=c.getContext('2d',{willReadFrequently:true});cx.drawImage(video,0,0);const code=jsQR(cx.getImageData(0,0,c.width,c.height).data,c.width,c.height,{inversionAttempts:'attemptBoth'});if(code){mostrarPayloadQR(code.data);pararCamera();}else rafCamera=requestAnimationFrame(scan);};scan();
    }catch(e){setQRStatus(e.message||'Não foi possível abrir a câmera.');}
  }
  function pararCamera(){cancelAnimationFrame(rafCamera);if(fluxoCamera){fluxoCamera.getTracks().forEach(t=>t.stop());fluxoCamera=null;}const v=safe('qrVideo');if(v)v.srcObject=null;}
  window.fecharQR=function(){pararCamera();safe('qrModal')?.remove();};
  window.addEventListener('pagehide',pararCamera);

  const CONTAS_ANEXADAS = [
    {descricao:'Fatura Elo Diners Club - setembro/2026',categoria:'Cartão de crédito',valor:16508.47,vencimento:'2026-09-28'},
    {descricao:'Unimed Curitiba - setembro/2026',categoria:'Plano de saúde',valor:471.18,vencimento:'2026-10-01'},
    {descricao:'Unimed Tubarão - setembro/2026',categoria:'Plano de saúde',valor:1859.39,vencimento:'2026-09-28'},
    {descricao:'TIM Fibra 500M - setembro/2026',categoria:'Internet/Telefone',valor:150.09,vencimento:'2026-10-01'},
    {descricao:'TIM Black - setembro/2026',categoria:'Internet/Telefone',valor:69.98,vencimento:'2026-10-01'},
    {descricao:'TIM Black Família - setembro/2026',categoria:'Internet/Telefone',valor:264.99,vencimento:'2026-10-01'},
    {descricao:'Claro Internet - setembro/2026',categoria:'Internet/Telefone',valor:56.04,vencimento:'2026-10-05'},
    {descricao:'Fatura C6 Bank - setembro/2026',categoria:'Cartão de crédito',valor:2149.33,vencimento:'2026-10-05'},
    {descricao:'Colégio Legado - outubro/2026',categoria:'Educação',valor:1411.23,vencimento:'2026-10-13'},
    {descricao:'Celesc - referência agosto/2026 - casa (titular da fatura: André Machado)',categoria:'Energia elétrica',valor:180.06,vencimento:'2026-09-10'},
    {descricao:'Celesc - referência setembro/2026 - casa (titular da fatura: André Machado)',categoria:'Energia elétrica',valor:514.86,vencimento:'2026-10-13'},
    {descricao:'Celesc - conta em nome de André Machado - casa',categoria:'Energia elétrica',valor:5.91,vencimento:'2026-11-10'},
    {descricao:'Celesc - conta de energia',categoria:'Energia elétrica',valor:506.57,vencimento:'2026-11-16'},
    {descricao:'Unimed Tubarão - outubro/2026',categoria:'Plano de saúde',valor:1844.19,vencimento:'2026-10-28'}
  ];
  window.prepararImportacaoContas = function(){
    if(safe('importarContasModal'))safe('importarContasModal').remove();
    const rows=CONTAS_ANEXADAS.map((x,i)=>`<tr><td><input data-bill="${i}" data-field="inclui" type="checkbox" checked aria-label="Incluir ${x.descricao}"></td><td>${x.descricao}</td><td>${new Date(x.vencimento+'T12:00:00').toLocaleDateString('pt-BR')}</td><td>${formatarMoeda(x.valor)}</td><td><select data-bill="${i}" data-field="status" aria-label="Situação ${x.descricao}"><option value="pendente" selected>A pagar</option><option value="pago">Pago</option></select></td></tr>`).join('');
    const modal=document.createElement('div');modal.id='importarContasModal';modal.className='qrModal';
    modal.innerHTML=`<section class="qrBox" style="width:min(920px,100%)"><h2>Revisar contas anexadas</h2><p>Confira valores, vencimentos e situação antes de gravar. O sistema verificará possíveis duplicatas.</p><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th>Incluir</th><th>Conta</th><th>Vencimento</th><th>Valor</th><th>Situação</th></tr></thead><tbody>${rows}</tbody></table></div><p style="margin-top:10px"><b>Total selecionado: ${formatarMoeda(CONTAS_ANEXADAS.reduce((s,x)=>s+x.valor,0))}</b></p><div class="qrStatus" id="importStatus" aria-live="polite"></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button onclick="fecharImportacaoContas()">Cancelar</button><button style="background:#2563eb;color:white" onclick="gravarContasAnexadas()">Gravar lançamentos selecionados</button></div></section>`;
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-field="inclui"]').forEach(el=>el.addEventListener('change',()=>{const total=CONTAS_ANEXADAS.reduce((s,x,i)=>s+(modal.querySelector(`[data-bill="${i}"][data-field="inclui"]`).checked?x.valor:0),0);modal.querySelector('p b').textContent=`Total selecionado: ${formatarMoeda(total)}`;}));
  };
  window.fecharImportacaoContas=function(){safe('importarContasModal')?.remove();};
  window.gravarContasAnexadas=async function(){
    const uid=localStorage.getItem('usuario_id_lancamentos');if(!uid){safe('importStatus').textContent='Entre no aplicativo para gravar na sua conta.';return;}
    const botao=safe('importarContasModal').querySelector('button[onclick="gravarContasAnexadas()"]');botao.disabled=true;safe('importStatus').textContent='Conferindo registros existentes…';
    const {data:atuais,error}=await db.from('lancamentos').select('tipo,data,data_vencimento,categoria,descricao,valor').eq('usuario_id',uid).gte('data_vencimento','2026-09-01').lte('data_vencimento','2026-11-30');
    if(error){safe('importStatus').textContent='Falha ao conferir duplicatas: '+error.message;botao.disabled=false;return;}
    const novos=[];let duplicados=0;
    CONTAS_ANEXADAS.forEach((x,i)=>{
      const include=safe('importarContasModal').querySelector(`[data-bill="${i}"][data-field="inclui"]`).checked;if(!include)return;
      const status=safe('importarContasModal').querySelector(`[data-bill="${i}"][data-field="status"]`).value;
      const existe=(atuais||[]).some(y=>y.tipo==='DESPESA'&&String(y.data_vencimento||y.data||'').slice(0,10)===x.vencimento&&Math.abs(Number(y.valor||0)-x.valor)<0.005&&String(y.descricao||'').toLocaleLowerCase('pt-BR').includes(x.descricao.split(' - ')[0].split(' -')[0].toLocaleLowerCase('pt-BR').slice(0,8)));
      if(existe){duplicados++;return;}
      novos.push({usuario_id:uid,tipo:'DESPESA',data:x.vencimento,data_vencimento:x.vencimento,categoria:x.categoria,descricao:x.descricao,valor:x.valor,status,recorrente:false,modo_lancamento:'unico'});
    });
    if(!novos.length){safe('importStatus').textContent=`Nenhuma conta nova para gravar. ${duplicados} possível(is) duplicata(s) ignorada(s).`;botao.disabled=false;return;}
    const {error:saveError}=await db.from('lancamentos').insert(novos);
    if(saveError){safe('importStatus').textContent='Não foi possível gravar: '+saveError.message;botao.disabled=false;return;}
    safe('importStatus').textContent=`${novos.length} conta(s) gravada(s). ${duplicados} duplicata(s) ignorada(s).`;
    await carregar();setTimeout(()=>window.fecharImportacaoContas(),1200);
  };

  /* Select paginado: PostgREST limita a resposta por chamada; percorremos as páginas. */
  window.carregar = async function carregarLancamentosCompletos(){
    const uid=localStorage.getItem('usuario_id_lancamentos'); if(!uid)return;
    safe('estadoCarga').textContent='Carregando todos os lançamentos…';
    const pageSize=1000;let todos=[],desde=0;
    while(true){
      const {data,error}=await db.from('lancamentos').select('*').eq('usuario_id',uid).order('data_vencimento',{ascending:false}).order('data',{ascending:false}).range(desde,desde+pageSize-1);
      if(error){console.error(error);safe('estadoCarga').textContent='Não foi possível carregar os lançamentos. Tente novamente.';return;}
      todos=todos.concat(data||[]);if(!data||data.length<pageSize)break;desde+=pageSize;
    }
    dados=todos;safe('estadoCarga').textContent=`${dados.length} lançamento(s) no sistema.`;
    render();renderDashboardAnual();renderVencimentos();setTimeout(renderGraficoFinanceiro,200);atualizarMeta();await carregarCategoriasDinamicas();
  };
  window.limparPeriodo=function(){if(safe('filtroDataInicio'))safe('filtroDataInicio').value='';if(safe('filtroDataFim'))safe('filtroDataFim').value='';};
  window.carregarMesAtual=function(){
    const box=safe('selectMesRapido');if(!box)return;let html='<option value="">Escolher mês…</option>';
    for(let i=1;i<=12;i++)html+=`<option value="2026-${String(i).padStart(2,'0')}">${nomeMes(i)} 2026</option>`;
    box.innerHTML=html;
  };
})();
