
const $=(s,c=document)=>c.querySelector(s), $$=(s,c=document)=>Array.from(c.querySelectorAll(s));
const state={xmlHandle:null,xmlDoc:null,data:null,filters:{measure:null,ucGroup:'all',useCase:'all',org:'all',q:''}};
function h(t,a={},...ch){const e=document.createElement(t);for(const[k,v]of Object.entries(a||{})){if(k==='class')e.className=v;else if(k==='style')e.setAttribute('style',v);else if(k.startsWith('on')&&typeof v==='function')e.addEventListener(k.substring(2),v);else e.setAttribute(k,v)}for(const c of ch){if(c==null)continue;if(typeof c==='string')e.appendChild(document.createTextNode(c));else e.appendChild(c)}return e}
function parseXML(x){const d=new DOMParser().parseFromString(x,'application/xml');if(d.querySelector('parsererror'))throw new Error('Invalid XML');return d}
const xmlText=(e,s,d='')=>{const n=e.querySelector(s);return n?(n.textContent||'').trim():d}, xmlAttr=(e,n,d='')=>e.hasAttribute(n)?e.getAttribute(n):d;
/* Load model (with per-org overrides) */
function loadModel(doc){
  const version=doc.querySelector('meta > version')?.getAttribute('id')||'v0000';
  const orgs={}; doc.querySelectorAll('orgs > org').forEach(o=>{const id=xmlAttr(o,'id');orgs[id]={id,name:xmlAttr(o,'name')||id,color:xmlAttr(o,'color')||'#22c55e'}});
  const ucGroups={}; doc.querySelectorAll('useCaseGroups > group').forEach(g=>{const gid=xmlAttr(g,'id');ucGroups[gid]={id:gid,name:xmlAttr(g,'name')||gid,useCases:{}};g.querySelectorAll('useCase').forEach(u=>{const uid=xmlAttr(u,'id');ucGroups[gid].useCases[uid]={id:uid,name:xmlAttr(u,'name')||uid,groupId:gid}})});
  const domains=[], datasets={};
  doc.querySelectorAll('domains > domain').forEach(d=>{
    const dom={id:xmlAttr(d,'id'),name:xmlAttr(d,'name')||xmlAttr(d,'id'),sets:[]};
    d.querySelectorAll(':scope > set').forEach(s=>{
      const id=xmlAttr(s,'id')||xmlText(s,'name').toLowerCase().replace(/\s+/g,'-');
      const layer=s.querySelector('layer');
      const ds={id,domainId:dom.id,name:xmlText(s,'name'),description:xmlText(s,'description'),owner:xmlText(s,'owner'),entries:Number(xmlText(s,'entries','0')),
        measures:{quality:Number(s.querySelector('measures')?.getAttribute('quality')||0),timeliness:Number(s.querySelector('measures')?.getAttribute('timeliness')||0),accessibility:Number(s.querySelector('measures')?.getAttribute('accessibility')||0),completeness:Number(s.querySelector('measures')?.getAttribute('completeness')||0)},
        layer:{storage:layer?xmlText(layer,'storage'):'',ingestion:layer?xmlText(layer,'ingestion'):'',frontend:layer?xmlText(layer,'frontend'):''},
        orgs:[], useCases:[], orgMeta:{} };
      s.querySelectorAll('orgRefs > org').forEach(o=>ds.orgs.push(o.getAttribute('ref')));
      s.querySelectorAll('useCaseRefs > useCase').forEach(u=>ds.useCases.push(u.getAttribute('ref')));
      // per-org overrides
      s.querySelectorAll(':scope > orgData').forEach(od=>{
        const oid = xmlAttr(od,'org'); const lay=od.querySelector('layer');
        ds.orgMeta[oid] = {
          description: xmlText(od,'description'),
          owner: xmlText(od,'owner'),
          entries: Number(xmlText(od,'entries','0')),
          measures: {
            quality: Number(od.querySelector('measures')?.getAttribute('quality')||0),
            timeliness: Number(od.querySelector('measures')?.getAttribute('timeliness')||0),
            accessibility: Number(od.querySelector('measures')?.getAttribute('accessibility')||0),
            completeness: Number(od.querySelector('measures')?.getAttribute('completeness')||0)
          },
          layer: { storage: lay?xmlText(lay,'storage'):'', ingestion: lay?xmlText(lay,'ingestion'):'', frontend: lay?xmlText(lay,'frontend'):'' }
        };
      });
      ds.search=[ds.name,ds.description,ds.owner,ds.layer.storage,ds.layer.ingestion,ds.layer.frontend].join(' ').toLowerCase();
      datasets[id]=ds; dom.sets.push(id);
    });
    domains.push(dom);
  });
  return {version,orgs,ucGroups,domains,datasets};
}
/* Serialize model back to XML (including <orgData>) */
function serializeModel(m){
  const i=n=>'  '.repeat(n), e=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  let out=`<?xml version="1.0" encoding="UTF-8"?>\n<tdadata>\n${i(1)}<meta>\n${i(2)}<name>TDA Data Catalog</name>\n${i(2)}<version id="${e(m.version||'v0000')}"/>\n${i(2)}<updated>${new Date().toISOString()}</updated>\n${i(1)}</meta>\n\n${i(1)}<orgs>\n`;
  for(const o of Object.values(m.orgs)){ out += `${i(2)}<org id="${e(o.id)}" name="${e(o.name)}" color="${e(o.color||'#22c55e')}"/>\n`; }
  out += `${i(1)}</orgs>\n\n${i(1)}<useCaseGroups>\n`;
  for(const g of Object.values(m.ucGroups)){ out += `${i(2)}<group id="${e(g.id)}" name="${e(g.name)}">\n`; for(const u of Object.values(g.useCases)){ out += `${i(3)}<useCase id="${e(u.id)}" name="${e(u.name)}"/>\n`; } out += `${i(2)}</group>\n`; }
  out += `${i(1)}</useCaseGroups>\n\n${i(1)}<domains>\n`;
  for(const d of m.domains){
    out += `${i(2)}<domain id="${e(d.id)}" name="${e(d.name)}">\n`;
    for(const sid of d.sets){ const s=m.datasets[sid]; if(!s) continue;
      out += `${i(3)}<set id="${e(s.id)}">\n${i(4)}<name>${e(s.name)}</name>\n${i(4)}<description>${e(s.description||'')}</description>\n${i(4)}<owner>${e(s.owner||'')}</owner>\n${i(4)}<entries>${Number(s.entries||0)}</entries>\n`;
      out += `${i(4)}<measures quality="${Number(s.measures.quality||0)}" timeliness="${Number(s.measures.timeliness||0)}" accessibility="${Number(s.measures.accessibility||0)}" completeness="${Number(s.measures.completeness||0)}"/>\n`;
      out += `${i(4)}<orgRefs>` + (s.orgs||[]).map(o=>`<org ref="${e(o)}"/>`).join('') + `</orgRefs>\n`;
      out += `${i(4)}<useCaseRefs>` + (s.useCases||[]).map(r=>`<useCase ref="${e(r)}"/>`).join('') + `</useCaseRefs>\n`;
      out += `${i(4)}<layer>\n${i(5)}<storage>${e(s.layer?.storage||'')}</storage>\n${i(5)}<ingestion>${e(s.layer?.ingestion||'')}</ingestion>\n${i(5)}<frontend>${e(s.layer?.frontend||'')}</frontend>\n${i(4)}</layer>\n`;
      // orgData
      for(const [oid,meta] of Object.entries(s.orgMeta||{})){
        out += `${i(4)}<orgData org="${e(oid)}">\n`;
        out += `${i(5)}<owner>${e(meta.owner||'')}</owner>\n${i(5)}<entries>${Number(meta.entries||0)}</entries>\n`;
        out += `${i(5)}<measures quality="${Number(meta.measures?.quality||0)}" timeliness="${Number(meta.measures?.timeliness||0)}" accessibility="${Number(meta.measures?.accessibility||0)}" completeness="${Number(meta.measures?.completeness||0)}"/>\n`;
        out += `${i(5)}<layer>\n${i(6)}<storage>${e(meta.layer?.storage||'')}</storage>\n${i(6)}<ingestion>${e(meta.layer?.ingestion||'')}</ingestion>\n${i(6)}<frontend>${e(meta.layer?.frontend||'')}</frontend>\n${i(5)}</layer>\n`;
        out += `${i(5)}<description>${e(meta.description||'')}</description>\n${i(4)}</orgData>\n`;
      }
      out += `${i(3)}</set>\n`;
    }
    out += `${i(2)}</domain>\n`;
  }
  out += `${i(1)}</domains>\n</tdadata>\n`; return out;
}
function setStatus(m){const s=$('#status');if(s)s.textContent=m} window.setStatus=setStatus;
/* Filters & manager button */
function renderFilters(){
  $$('.toggle[data-measure]').forEach(b=>{const m=b.getAttribute('data-measure');b.classList.toggle('active',state.filters.measure===m);b.onclick=()=>{state.filters.measure=state.filters.measure===m?null:m;render()}});
  const gSel=$('#uc-group'),uSel=$('#use-case'); gSel.innerHTML=''; uSel.innerHTML='';
  gSel.appendChild(h('option',{value:'all'},'Use case group: All')); for(const g of Object.values(state.data.ucGroups)) gSel.appendChild(h('option',{value:g.id},g.name)); gSel.value=state.filters.ucGroup||'all';
  function rebuild(){ uSel.innerHTML=''; uSel.appendChild(h('option',{value:'all'},'Use case: All'));
    if(state.filters.ucGroup!=='all'){ const g=state.data.ucGroups[state.filters.ucGroup]; for(const u of Object.values(g.useCases)) uSel.appendChild(h('option',{value:`${g.id}/${u.id}`},u.name)); }
    else{ for(const g of Object.values(state.data.ucGroups)){ for(const u of Object.values(g.useCases)){ uSel.appendChild(h('option',{value:`${g.id}/${u.id}`},`${g.name} / ${u.name}`)); } } }
    uSel.value=state.filters.useCase||'all';
  }
  rebuild();
  gSel.onchange=()=>{ state.filters.ucGroup=gSel.value; state.filters.useCase='all'; rebuild(); render(); };
  uSel.onchange=()=>{ state.filters.useCase=uSel.value; render(); };
  const bar=$('#orgbar'); bar.innerHTML='';
  const selectAll=()=>{state.filters.org='all'; render();};
  const all=h('div',{class:'org-chip'+(state.filters.org==='all'?' active':''),title:'Show all',tabindex:'0'},'All');
  all.onclick=selectAll;
  all.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectAll();}};
  bar.appendChild(all);
  for(const o of Object.values(state.data.orgs)){
    const chip=h('div',{class:'org-chip'+(state.filters.org===o.id?' active':''),title:o.name,tabindex:'0'}, o.name);
    const actions=h('div',{class:'actions'},
      h('button',{onclick:e=>{e.stopPropagation(); const nn=prompt('Rename org',o.name); if(nn&&nn.trim()){o.name=nn.trim(); render();}}},'Rename'),
      h('button',{onclick=e=>{e.stopPropagation(); if(confirm(`Remove org "${o.name}"?`)){ delete state.data.orgs[o.id]; for(const s of Object.values(state.data.datasets)){ s.orgs=(s.orgs||[]).filter(id=>id!==o.id); delete s.orgMeta?.[o.id]; } if(state.filters.org===o.id) state.filters.org='all'; render(); } }},'Remove')
    );
    let hideTimer=null;
    const showActions=()=>{clearTimeout(hideTimer); chip.classList.add('show-actions');};
    const hideActions=()=>{hideTimer=setTimeout(()=>chip.classList.remove('show-actions'),200);};
    const toggle=()=>{ state.filters.org = (state.filters.org===o.id?'all':o.id); render(); };
    chip.appendChild(actions);
    chip.onclick=toggle;
    chip.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault(); toggle();}};
    chip.addEventListener('mouseenter',showActions);
    chip.addEventListener('mouseleave',hideActions);
    chip.addEventListener('focusin',showActions);
    chip.addEventListener('focusout',hideActions);
    bar.appendChild(chip);
  }
  const add=h('button',{class:'btn',onclick:()=>{const id=prompt('New org ID:'); if(!id) return; const name=prompt('Display name:',id)||id; const color=prompt('Color (CSS):','#22c55e')||'#22c55e'; if(state.data.orgs[id]) return alert('Exists'); state.data.orgs[id]={id,name,color}; render(); }}, '+ Org'); bar.appendChild(add);
  const q=$('#search'); q.value=state.filters.q||''; q.oninput=()=>{ state.filters.q = q.value.toLowerCase(); render(); };
  $('#btn-reset').onclick=()=>{ state.filters={measure:null,ucGroup:'all',useCase:'all',org:'all',q:''}; render(); };
  $('#btn-uc-manager').onclick=()=> openUseCaseManager();
}
function openUseCaseManager(){
  const m=$('#modal-ucm'); m.classList.add('show'); const b=$('#ucm-body'); b.innerHTML='';
  const add=h('div',{class:'fieldset'}, h('div',{class:'grid'}, h('div',{},h('label',{},'Group ID'),h('input',{id:'ucm-gid',placeholder:'e.g., risk'})), h('div',{},h('label',{},'Display name'),h('input',{id:'ucm-gname',placeholder:'Risk'}))), h('div',{style:'text-align:right;margin-top:8px'}, h('button',{class:'btn primary',onclick:()=>{ const id=$('#ucm-gid').value.trim(); const name=$('#ucm-gname').value.trim()||id; if(!id) return; if(state.data.ucGroups[id]) return alert('exists'); state.data.ucGroups[id]={id,name,useCases:{}}; openUseCaseManager(); }}, 'Add group')));
  b.appendChild(add);
  for(const g of Object.values(state.data.ucGroups)){
    const ul=h('ul',{}); for(const u of Object.values(g.useCases)){ ul.appendChild(h('li',{}, `${u.name} (${u.id}) `, h('button',{class:'btn',onclick:()=>{ if(confirm('Remove use case?')){ delete state.data.ucGroups[g.id].useCases[u.id]; openUseCaseManager(); } }}, 'Remove'))); }
    const list=h('div',{class:'fieldset',style:'margin-top:8px'}, h('h4',{}, g.name), ul,
      h('div',{class:'grid',style:'margin-top:8px'}, h('div',{},h('label',{},'Use case ID'), h('input',{id:`uc-${g.id}-id`,placeholder:'e.g., churn-predict'})), h('div',{},h('label',{},'Display name'), h('input',{id:`uc-${g.id}-name`,placeholder:'Churn Prediction'}))),
      h('div',{style:'text-align:right;margin-top:6px'}, h('button',{class:'btn',onclick:()=>{ const id=$(`#uc-${g.id}-id`).value.trim(); const name=$(`#uc-${g.id}-name`).value.trim()||id; if(!id) return; state.data.ucGroups[g.id].useCases[id]={id,name,groupId:g.id}; openUseCaseManager(); }}, 'Add use case'))
    );
    b.appendChild(list);
  }
  $('#ucm-close').onclick=()=> m.classList.remove('show');
}
function datasetMatchesFilters(ds){
  if(state.filters.useCase && state.filters.useCase!=='all'){ if(!ds.useCases?.includes(state.filters.useCase)) return false; }
  else if(state.filters.ucGroup && state.filters.ucGroup!=='all'){ const p=state.filters.ucGroup+'/'; if(!ds.useCases?.some(r=>r.startsWith(p))) return false; }
  if(state.filters.org!=='all'){ if(!ds.orgs?.includes(state.filters.org)) return false; }
  if(state.filters.q){ const q=state.filters.q; if(!(ds.search.includes(q) || (ds.name||'').toLowerCase().includes(q))) return false; }
  return true;
}
function renderDomains(){
  const w=$('#domains'); w.innerHTML='';
  for(const dom of state.data.domains){
    const header=h('header',{}, h('h3',{}, dom.name), h('button',{class:'btn add',onclick:()=>openAddDatasetModal(dom.id)}, '+ Dataset'));
    const list=h('div',{class:'list'}); const box=h('section',{class:'domain'}, header, list);
    for(const sid of dom.sets){
      const ds=state.data.datasets[sid]; if(!ds) continue; if(!datasetMatchesFilters(ds)) continue;
      const dbox=h('div',{class:'dataset',onclick:()=>openDatasetDetails(ds)}, h('div',{class:'title'}, ds.name||ds.id), h('div',{class:'meta'}, ds.description||''));
      const badges=h('div',{class:'orgs'}); const orgIds=Object.keys(state.data.orgs);
      for(const oid of orgIds){
        const present=ds.orgs?.includes(oid); if(state.filters.org!=='all'&&oid!==state.filters.org) continue;
        const o=state.data.orgs[oid]; const key=state.filters.measure;
        let v=null; if(present && key){ v = (ds.orgMeta?.[oid]?.measures?.[key] ?? ds.measures?.[key] ?? 0); }
        const b=h('span',{class:'badge-org'+(present?'':' missing'),title: present? `${o.name}${v!=null?` • ${key}: ${v}%`:''}` : `${o.name}: not present`}, o.name, v!=null ? h('span',{class:'val'}, `${v}%`) : null);
        if(present && v!=null){ b.style.background=colorAt(v); b.style.borderColor='#0000'; }
        b.onclick=e=>{e.stopPropagation(); if(present){ if(confirm(`Remove dataset "${ds.name}" from org "${o.name}"?`)){ ds.orgs=ds.orgs.filter(x=>x!==oid); delete ds.orgMeta?.[oid]; render(); } } else { if(confirm(`Add dataset "${ds.name}" to org "${o.name}"?`)){ ds.orgs=ds.orgs||[]; if(!ds.orgs.includes(oid)) ds.orgs.push(oid); ds.orgMeta=ds.orgMeta||{}; ds.orgMeta[oid]=ds.orgMeta[oid]||{description:ds.description,owner:ds.owner,entries:ds.entries,measures:JSON.parse(JSON.stringify(ds.measures)),layer:JSON.parse(JSON.stringify(ds.layer))}; render(); } } };
        badges.appendChild(b);
      }
      dbox.appendChild(badges); list.appendChild(dbox);
    }
    w.appendChild(box);
  }
}
function render(){ renderFilters(); renderDomains(); setStatus(`Version ${state.data.version} • ${Object.keys(state.data.datasets).length} datasets • Orgs: ${Object.keys(state.data.orgs).length}`); }
/* Use-case multi dropdown with smart placement */
function buildUseCaseMulti(container, selected){
  container.innerHTML=''; const btn=h('button',{class:'btn',type:'button'}, 'Select use cases…'); const dd=h('div',{class:'uc-dropdown'}, btn, h('div',{class:'panel'})); const panel=dd.querySelector('.panel'); const sel=new Set(selected||[]);
  const lookupName=ref=>{const [gid,uid]=ref.split('/'); const group=state.data.ucGroups[gid]; return group?.useCases?.[uid]?.name||ref;};
  const refreshLabel=()=>{
    if(sel.size===0) btn.textContent='Select use cases…';
    else if(sel.size<=2) btn.textContent=Array.from(sel).map(lookupName).join(', ');
    else btn.textContent=`${sel.size} use cases selected`;
  };
  function open(){ dd.classList.add('open'); const r=btn.getBoundingClientRect(); const spaceBelow=window.innerHeight - r.bottom; if(spaceBelow < 220){ panel.style.top='auto'; panel.style.bottom='calc(100% + 4px)'; } else { panel.style.bottom='auto'; panel.style.top='calc(100% + 4px)'; } document.addEventListener('click',onDoc,true); }
  function close(){ dd.classList.remove('open'); document.removeEventListener('click',onDoc,true); }
  function onDoc(e){ if(!dd.contains(e.target)){ close(); } }
  btn.onclick=()=> dd.classList.contains('open') ? close() : open();
  for(const g of Object.values(state.data.ucGroups)){ const gdiv=h('div',{class:'group'}, h('div',{class:'gtitle'}, g.name)); for(const u of Object.values(g.useCases)){ const ref=`${g.id}/${u.id}`; gdiv.appendChild(h('div',{class:'item'}, h('input',{type:'checkbox',checked:sel.has(ref),onchange:e=>{ if(e.target.checked) sel.add(ref); else sel.delete(ref); refreshLabel(); }}), h('span',{}, u.name))); } panel.appendChild(gdiv); }
  refreshLabel();
  container.appendChild(dd); return ()=> Array.from(sel);
}
/* Details modal (editable and per-org) */
function openDatasetDetails(ds){
  const m=$('#modal-details'); m.classList.add('show');
  const name=$('#dt-name'); name.textContent=ds.name||ds.id;
  const desc=$('#dt-desc-in'), owner=$('#dt-owner-in'), entries=$('#dt-entries-in');
  const q=$('#dt-quality-in'), t=$('#dt-timeliness-in'), a=$('#dt-accessibility-in'), c=$('#dt-completeness-in');
  const stSel=$('#dt-storage-sel'), inSel=$('#dt-ingestion-sel'), feSel=$('#dt-frontend-sel');
  const ui=typeof ensureUIData==='function'?ensureUIData():UI.data;
  function fillSel(sel, opts, val){ sel.innerHTML=''; for(const v of (opts||[])) sel.appendChild(h('option',{value:v},v)); if(val && !opts.includes(val)) sel.appendChild(h('option',{value:val},val)); sel.value = val||opts?.[0]||''; }
  fillSel(stSel, ui?.vocab?.storages||[], ds.layer.storage); fillSel(inSel, ui?.vocab?.ingestions||[], ds.layer.ingestion); fillSel(feSel, ui?.vocab?.frontends||[], ds.layer.frontend);
  const scopeWrap=$('#dt-orgs'); scopeWrap.innerHTML='';
  const scopeList=[{id:'all',name:'All orgs'}, ...Object.values(state.data.orgs||{})];
  let currentScope = (state.filters.org!=='all' && state.data.orgs[state.filters.org]) ? state.filters.org : 'all';
  function snapshotFrom(orgId){
    if(orgId==='all'||!orgId) return {description:ds.description, owner:ds.owner, entries:ds.entries, measures:{...ds.measures}, layer:{...ds.layer}};
    const m=ds.orgMeta?.[orgId]; if(m) return {description:m.description||'', owner:m.owner||'', entries:m.entries||0, measures:{...m.measures}, layer:{...m.layer}};
    return {description:'', owner:'', entries:0, measures:{quality:0,timeliness:0,accessibility:0,completeness:0}, layer:{storage:'',ingestion:'',frontend:''}};
  }
  function readPayload(){
    return {
      description:desc.value.trim(),
      owner:owner.value.trim(),
      entries:Number(entries.value||0),
      measures:{quality:Number(q.value||0), timeliness:Number(t.value||0), accessibility:Number(a.value||0), completeness:Number(c.value||0)},
      layer:{storage:stSel.value||'', ingestion:inSel.value||'', frontend:feSel.value||''}
    };
  }
  function commitScope(scopeId){
    if(!scopeId) return;
    const payload=readPayload();
    if(scopeId==='all'){
      Object.assign(ds,{description:payload.description, owner:payload.owner, entries:payload.entries});
      ds.measures={...payload.measures}; ds.layer={...payload.layer};
      ds.search=[ds.name,ds.description,ds.owner,ds.layer.storage,ds.layer.ingestion,ds.layer.frontend].join(' ').toLowerCase();
    }else{
      ds.orgMeta = ds.orgMeta||{};
      ds.orgMeta[scopeId]={description:payload.description, owner:payload.owner, entries:payload.entries, measures:{...payload.measures}, layer:{...payload.layer}};
    }
  }
  function fill(scopeId){
    const snap=snapshotFrom(scopeId);
    desc.value=snap.description||''; owner.value=snap.owner||''; entries.value=snap.entries||0;
    q.value=snap.measures.quality||0; t.value=snap.measures.timeliness||0; a.value=snap.measures.accessibility||0; c.value=snap.measures.completeness||0;
    fillSel(stSel, ui?.vocab?.storages||[], snap.layer.storage);
    fillSel(inSel, ui?.vocab?.ingestions||[], snap.layer.ingestion);
    fillSel(feSel, ui?.vocab?.frontends||[], snap.layer.frontend);
  }
  function updateScopeButtons(){
    $$('.scope-btn',scopeWrap).forEach(btn=>{
      const scopeId=btn.dataset.scope;
      const has=scopeId==='all'||(ds.orgs?.includes(scopeId))||Boolean(ds.orgMeta?.[scopeId]);
      btn.classList.toggle('active',scopeId===currentScope);
      btn.classList.toggle('has-data',has);
    });
  }
  function switchScope(next){
    if(next===currentScope) return;
    commitScope(currentScope);
    currentScope=next;
    fill(currentScope);
    updateScopeButtons();
  }
  scopeList.forEach(item=>{
    const btn=h('button',{type:'button',class:'scope-btn', 'data-scope':item.id,title:item.name}, item.name);
    btn.onclick=()=>switchScope(item.id);
    scopeWrap.appendChild(btn);
  });
  if(!scopeList.some(s=>s.id===currentScope)) currentScope='all';
  fill(currentScope);
  updateScopeButtons();
  const membership=$('#dt-membership');
  const rebuildMembership=()=>{
    membership.innerHTML=''; const ids=Object.keys(state.data.orgs);
    for(const oid of ids){ const present=ds.orgs?.includes(oid); const o=state.data.orgs[oid];
      const row=h('div',{style:'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px solid var(--line)'},
        h('div',{}, o.name),
        h('div',{}, present ? h('button',{class:'btn',onclick:()=>{ if(confirm('Remove from org?')){ ds.orgs=ds.orgs.filter(x=>x!==oid); delete ds.orgMeta?.[oid]; rebuildMembership(); updateScopeButtons(); if(currentScope===oid){ currentScope='all'; fill(currentScope); updateScopeButtons(); } render(); } }}, 'Remove')
                            : h('button',{class:'btn',onclick:()=>{ ds.orgs=ds.orgs||[]; if(!ds.orgs.includes(oid)) ds.orgs.push(oid); ds.orgMeta=ds.orgMeta||{}; ds.orgMeta[oid]=ds.orgMeta[oid]||{description:ds.description,owner:ds.owner,entries:ds.entries,measures:{...ds.measures},layer:{...ds.layer}}; rebuildMembership(); updateScopeButtons(); render(); }}, 'Add'))
      ); membership.appendChild(row);
    }
  };
  rebuildMembership();
  const chosenUC = buildUseCaseMulti($('#dt-usecases'), ds.useCases||[]);
  $('#dt-save').onclick=()=>{
    commitScope(currentScope);
    ds.useCases = chosenUC();
    m.classList.remove('show');
    render();
  };
  $('#dt-delete').onclick=()=>{
    if(!confirm(`Delete dataset "${ds.name}"? This cannot be undone.`)) return;
    const dom=state.data.domains.find(d=>d.id===ds.domainId); if(dom){ dom.sets = dom.sets.filter(x=>x!==ds.id); }
    delete state.data.datasets[ds.id];
    m.classList.remove('show'); render();
  };
  $('#dt-close').onclick=()=> m.classList.remove('show');
}
/* Dropdown with add (type=button to prevent submit closing) */
function rebuildDropdownWithAdd(container,label,options,current,onChange,extras=[]){
  container.innerHTML='';
  const lab=h('label',{}, label);
  const merged=Array.from(new Set([...(options||[]), ...extras.filter(Boolean)]));
  const sel=h('select',{}); for(const v of merged) sel.appendChild(h('option',{value:v},v)); if(current && !merged.includes(current)){ sel.appendChild(h('option',{value:current},current)); }
  const initial=current||merged[0]||'';
  sel.value=initial; sel.onchange=()=> onChange(sel.value);
  onChange(initial);
  const add=h('button',{class:'btn',type:'button',onclick:()=>{ const v=prompt(`Add new value for ${label}:`); if(v && v.trim()){ const nv=v.trim(); if(!Array.from(sel.options).some(o=>o.value===nv)) sel.appendChild(h('option',{value:nv},nv)); sel.value=nv; onChange(nv); sel.focus(); } }}, '+');
  const row=h('div',{style:'display:flex;gap:6px'}, sel, add);
  container.appendChild(lab); container.appendChild(row);
}
function openAddDatasetModal(domainId){
  const m=$('#modal-add'); m.classList.add('show'); const f=$('#form-add'); f.reset(); f.dataset.domainId=domainId;
  const ui=typeof ensureUIData==='function'?ensureUIData():UI.data;
  const storages=Array.from(new Set(Object.values(state.data?.datasets||{}).map(d=>d.layer?.storage).filter(Boolean)));
  const ingestions=Array.from(new Set(Object.values(state.data?.datasets||{}).map(d=>d.layer?.ingestion).filter(Boolean)));
  const frontends=Array.from(new Set(Object.values(state.data?.datasets||{}).map(d=>d.layer?.frontend).filter(Boolean)));
  rebuildDropdownWithAdd($('#add-storage'),'Storage',ui?.vocab?.storages||[], '', v=>f.dataset.storage=v, storages);
  rebuildDropdownWithAdd($('#add-ingestion'),'Ingestion',ui?.vocab?.ingestions||[], '', v=>f.dataset.ingestion=v, ingestions);
  rebuildDropdownWithAdd($('#add-frontend'),'Frontend',ui?.vocab?.frontends||[], '', v=>f.dataset.frontend=v, frontends);
  const chosen=buildUseCaseMulti($('#add-usecases'),[]);
  const oc=$('#add-orgs'); oc.innerHTML=''; for(const o of Object.values(state.data.orgs)){ oc.appendChild(h('label',{}, h('input',{type:'checkbox',value:o.id}), ' ', o.name)); }
  $('#add-cancel').onclick=()=> m.classList.remove('show');
  f.onsubmit=e=>{
    e.preventDefault();
    const id=(f.name.value||crypto.randomUUID()).replace(/\s+/g,'-').toLowerCase();
    const ds={ id, domainId, name:f.name.value.trim(), description:f.description.value.trim(), owner:f.owner.value.trim(), entries:Number(f.entries.value||0),
      measures:{quality:Number(f.quality.value||0), timeliness:Number(f.timeliness.value||0), accessibility:Number(f.accessibility.value||0), completeness:Number(f.completeness.value||0)},
      layer:{ storage:f.dataset.storage||'', ingestion:f.dataset.ingestion||'', frontend:f.dataset.frontend||'' },
      orgs: $$('input[type=checkbox]', oc).filter(x=>x.checked).map(x=>x.value), useCases: chosen(), orgMeta:{} };
    ds.search=[ds.name,ds.description,ds.owner,ds.layer.storage,ds.layer.ingestion,ds.layer.frontend].join(' ').toLowerCase();
    for(const oid of ds.orgs){ ds.orgMeta[oid]={description:ds.description,owner:ds.owner,entries:ds.entries,measures:{...ds.measures},layer:{...ds.layer}}; }
    state.data.datasets[id]=ds; const dom=state.data.domains.find(d=>d.id===domainId); if(dom) dom.sets.push(id);
    m.classList.remove('show'); render();
  };
}
/* File operations */
async function openXML(){try{const[h]=await window.showOpenFilePicker({types:[{description:'XML',accept:{'text/xml':['.xml']}}]}); state.xmlHandle=h; const text=await (await h.getFile()).text(); state.xmlDoc=parseXML(text); state.data=loadModel(state.xmlDoc); render();}catch(e){if(e.name!=='AbortError')alert('Open failed: '+e.message)}}
async function saveXML(){if(!state.data) return alert('Nothing to save'); const prev=state.data.version||'v0000'; const ts=new Date().toISOString().replace(/[-:.]/g,'').slice(0,15); state.data.version='v'+ts; const xml=serializeModel(state.data); if(state.xmlHandle){const w=await state.xmlHandle.createWritable(); await w.write(xml); await w.close();} else { const h=await window.showSaveFilePicker({suggestedName:'tda-data.xml',types:[{description:'XML',accept:{'text/xml':['.xml']}}]}); state.xmlHandle=h; const w=await h.createWritable(); await w.write(xml); await w.close(); } setStatus(`Saved ${prev} → ${state.data.version}`);}
/* Settings modal */
function openSettings(){
  const m=$('#modal-settings'); m.classList.add('show');
  const cfg=(typeof ensureUIData==='function'?ensureUIData():UI.data)||createDefaultUIData?.();
  if(!cfg) return;
  $('#bg-from').value=cfg.theme.background.from;
  $('#bg-to').value=cfg.theme.background.to;
  $('#accent').value=cfg.theme.background.accent;
  $('#cols').value=cfg.theme.layout.domainColumns||5;
  const apply=()=>{
    cfg.theme.background.from=$('#bg-from').value;
    cfg.theme.background.to=$('#bg-to').value;
    cfg.theme.background.accent=$('#accent').value;
    cfg.theme.layout.domainColumns=Number($('#cols').value)||5;
    applyTheme(cfg);
    setStatus('Applied theme');
    m.classList.remove('show');
  };
  $('#apply-theme').onclick=apply;
  $('#open-config').onclick=async()=>{ await openUIConfig(); const fresh=(typeof ensureUIData==='function'?ensureUIData():UI.data); if(fresh){ $('#bg-from').value=fresh.theme.background.from; $('#bg-to').value=fresh.theme.background.to; $('#accent').value=fresh.theme.background.accent; $('#cols').value=fresh.theme.layout.domainColumns||5; setStatus('Opened config'); }};
  $('#save-config').onclick=async()=>{ await saveUIConfig(); setStatus('Saved config'); };
}
async function boot(){
  await loadDefaultUIConfig();
  if(typeof ensureUIData==='function') ensureUIData();
  try{
    const r=await fetch('./assets/sample-data.xml',{cache:'no-store'});
    if(r.ok){const t=await r.text(); state.xmlDoc=parseXML(t); state.data=loadModel(state.xmlDoc); render(); }
  }catch(e){ setStatus('Failed to load sample-data.xml'); }
  $('#btn-open').onclick=openXML;
  $('#btn-save').onclick=saveXML;
  const fab=$('#fab-settings'); if(fab) fab.onclick=openSettings;
  const headerBtn=$('#btn-settings'); if(headerBtn) headerBtn.onclick=openSettings;
}
document.addEventListener('DOMContentLoaded',boot);
