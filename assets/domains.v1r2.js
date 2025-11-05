
const $=(s,c=document)=>c.querySelector(s), $$=(s,c=document)=>Array.from(c.querySelectorAll(s));
const state={xmlHandle:null,xmlDoc:null,data:null,filters:{measure:null,ucGroup:'all',useCase:'all',org:'all',q:''}};
function h(t,a={},...ch){const e=document.createElement(t);for(const[k,v]of Object.entries(a||{})){if(k==='class')e.className=v;else if(k==='style')e.setAttribute('style',v);else if(k.startsWith('on')&&typeof v==='function')e.addEventListener(k.substring(2),v);else e.setAttribute(k,v)}for(const c of ch){if(c==null)continue;if(typeof c==='string')e.appendChild(document.createTextNode(c));else e.appendChild(c)}return e}
function parseXML(x){const d=new DOMParser().parseFromString(x,'application/xml');if(d.querySelector('parsererror'))throw new Error('Invalid XML');return d}
function ensureStateData(){if(!state.data){state.data={version:'v0000',orgs:{},ucGroups:{},domains:[],datasets:{}};}else{state.data.orgs=state.data.orgs||{};state.data.ucGroups=state.data.ucGroups||{};state.data.domains=state.data.domains||[];state.data.datasets=state.data.datasets||{};}}
const slugify=v=>(v||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const xmlText=(e,s,d='')=>{const n=e.querySelector(s);return n?(n.textContent||'').trim():d}, xmlAttr=(e,n,d='')=>e.hasAttribute(n)?e.getAttribute(n):d;
const textToList=v=>{if(!v) return [];return String(v).split(/[|,\n]/).map(s=>s.trim()).filter(Boolean);};
const listToText=arr=>(arr&&arr.length?arr.filter(Boolean).join(' | '):'');
const cloneLayer=layer=>({storage:[...(layer?.storage||[])], ingestion:[...(layer?.ingestion||[])], frontend:[...(layer?.frontend||[])]});
const cloneMeasures=m=>({quality:Number(m?.quality||0), timeliness:Number(m?.timeliness||0), accessibility:Number(m?.accessibility||0), completeness:Number(m?.completeness||0)});
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
      const baseLayer={
        storage:layer?textToList(xmlText(layer,'storage')):[],
        ingestion:layer?textToList(xmlText(layer,'ingestion')):[],
        frontend:layer?textToList(xmlText(layer,'frontend')):[],
      };
      const ds={id,domainId:dom.id,name:xmlText(s,'name'),description:xmlText(s,'description'),owner:xmlText(s,'owner'),entries:Number(xmlText(s,'entries','0')),
        measures:{quality:Number(s.querySelector('measures')?.getAttribute('quality')||0),timeliness:Number(s.querySelector('measures')?.getAttribute('timeliness')||0),accessibility:Number(s.querySelector('measures')?.getAttribute('accessibility')||0),completeness:Number(s.querySelector('measures')?.getAttribute('completeness')||0)},
        layer:baseLayer,
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
          layer: {
            storage: lay?textToList(xmlText(lay,'storage')):[],
            ingestion: lay?textToList(xmlText(lay,'ingestion')):[],
            frontend: lay?textToList(xmlText(lay,'frontend')):[],
          }
        };
      });
      ds.search=[ds.name,ds.description,ds.owner,ds.layer.storage.join(' '),ds.layer.ingestion.join(' '),ds.layer.frontend.join(' ')].join(' ').toLowerCase();
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
      out += `${i(4)}<layer>\n${i(5)}<storage>${e(listToText(s.layer?.storage))}</storage>\n${i(5)}<ingestion>${e(listToText(s.layer?.ingestion))}</ingestion>\n${i(5)}<frontend>${e(listToText(s.layer?.frontend))}</frontend>\n${i(4)}</layer>\n`;
      // orgData
      for(const [oid,meta] of Object.entries(s.orgMeta||{})){
        out += `${i(4)}<orgData org="${e(oid)}">\n`;
        out += `${i(5)}<owner>${e(meta.owner||'')}</owner>\n${i(5)}<entries>${Number(meta.entries||0)}</entries>\n`;
        out += `${i(5)}<measures quality="${Number(meta.measures?.quality||0)}" timeliness="${Number(meta.measures?.timeliness||0)}" accessibility="${Number(meta.measures?.accessibility||0)}" completeness="${Number(meta.measures?.completeness||0)}"/>\n`;
        out += `${i(5)}<layer>\n${i(6)}<storage>${e(listToText(meta.layer?.storage))}</storage>\n${i(6)}<ingestion>${e(listToText(meta.layer?.ingestion))}</ingestion>\n${i(6)}<frontend>${e(listToText(meta.layer?.frontend))}</frontend>\n${i(5)}</layer>\n`;
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
  } rebuild(); gSel.onchange=()=>{ state.filters.ucGroup=gSel.value; state.filters.useCase='all'; rebuild(); render(); }; uSel.onchange=()=>{ state.filters.useCase=uSel.value; render(); };
  const bar=$('#orgbar'); bar.innerHTML=''; const all=h('div',{class:'org-chip'+(state.filters.org==='all'?' active':''),title:'Show all'},'All'); all.onclick=()=>{state.filters.org='all'; render();}; bar.appendChild(all);
  for(const o of Object.values(state.data.orgs)){ const chip=h('div',{class:'org-chip'+(state.filters.org===o.id?' active':''),title:o.name}, o.name);
    const actions=h('div',{class:'actions'}, h('button',{onclick:e=>{e.stopPropagation(); const nn=prompt('Rename org',o.name); if(nn&&nn.trim()){o.name=nn.trim(); render();}}},'Rename'),
      h('button',{onclick:e=>{e.stopPropagation(); if(confirm(`Remove org "${o.name}"?`)){ delete state.data.orgs[o.id]; for(const s of Object.values(state.data.datasets)){ s.orgs=(s.orgs||[]).filter(id=>id!==o.id); delete s.orgMeta?.[o.id]; } if(state.filters.org===o.id) state.filters.org='all'; render(); }}},'Remove') );
    chip.appendChild(actions); chip.onclick=()=>{ state.filters.org = (state.filters.org===o.id?'all':o.id); render(); }; bar.appendChild(chip);
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
        b.onclick=e=>{e.stopPropagation(); if(present){ if(confirm(`Remove dataset "${ds.name}" from org "${o.name}"?`)){ ds.orgs=ds.orgs.filter(x=>x!==oid); delete ds.orgMeta?.[oid]; render(); } } else { if(confirm(`Add dataset "${ds.name}" to org "${o.name}"?`)){ ds.orgs=ds.orgs||[]; if(!ds.orgs.includes(oid)) ds.orgs.push(oid); ds.orgMeta=ds.orgMeta||{}; ds.orgMeta[oid]=ds.orgMeta[oid]||{description:ds.description,owner:ds.owner,entries:ds.entries,measures:cloneMeasures(ds.measures),layer:cloneLayer(ds.layer)}; render(); } } };
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
  function open(){ dd.classList.add('open'); const r=btn.getBoundingClientRect(); const spaceBelow=window.innerHeight - r.bottom; if(spaceBelow < 220){ panel.style.top='auto'; panel.style.bottom='calc(100% + 4px)'; } else { panel.style.bottom='auto'; panel.style.top='calc(100% + 4px)'; } document.addEventListener('click',onDoc,true); }
  function close(){ dd.classList.remove('open'); document.removeEventListener('click',onDoc,true); }
  function onDoc(e){ if(!dd.contains(e.target)){ close(); } }
  btn.onclick=()=> dd.classList.contains('open') ? close() : open();
  for(const g of Object.values(state.data.ucGroups)){ const gdiv=h('div',{class:'group'}, h('div',{class:'gtitle'}, g.name)); for(const u of Object.values(g.useCases)){ const ref=`${g.id}/${u.id}`; gdiv.appendChild(h('div',{class:'item'}, h('input',{type:'checkbox',checked:sel.has(ref),onchange:e=>{ if(e.target.checked) sel.add(ref); else sel.delete(ref); }}), h('span',{}, u.name))); } panel.appendChild(gdiv); }
  container.appendChild(dd); return ()=> Array.from(sel);
}

function createMultiSelect(container,label,options,onAdd){
  container.innerHTML='';
  let opts=Array.from(new Set((options||[]).filter(Boolean)));
  const selected=new Set();
  const wrap=h('div',{class:'multi-select'}, h('label',{}, label));
  const chips=h('div',{class:'chips'});
  const actions=h('div',{class:'actions'});
  const add=h('button',{class:'btn',type:'button'}, '+');
  actions.appendChild(add);
  wrap.appendChild(chips);
  wrap.appendChild(actions);
  container.appendChild(wrap);

  function renderChips(){
    chips.innerHTML='';
    if(!opts.length){ chips.appendChild(h('span',{class:'chip placeholder'},'No options yet')); }
    for(const opt of opts){ const chip=h('button',{class:'chip'+(selected.has(opt)?' selected':''),type:'button'}, opt); chip.onclick=()=>{ if(selected.has(opt)){ selected.delete(opt); } else { selected.add(opt); } renderChips(); }; chips.appendChild(chip); }
  }
  add.onclick=()=>{ const v=prompt(`Add new value for ${label}:`); if(v && v.trim()){ const nv=v.trim(); if(!opts.includes(nv)){ opts.push(nv); if(typeof onAdd==='function') onAdd(nv); } selected.add(nv); renderChips(); } };
  renderChips();

  return {
    set(values){ selected.clear(); (values||[]).filter(Boolean).forEach(v=>selected.add(v)); renderChips(); },
    get(){ return Array.from(selected); },
    setDisabled(flag){ wrap.classList.toggle('disabled', !!flag); },
    syncOptions(newOpts){ opts=Array.from(new Set((newOpts||[]).filter(Boolean))); renderChips(); }
  };
}
/* Details modal (editable and per-org) */
function openDatasetDetails(ds){
  const m=$('#modal-details'); m.classList.add('show');
  $('#dt-name').textContent=ds.name||ds.id;

  const desc=$('#dt-desc-in'), owner=$('#dt-owner-in'), entries=$('#dt-entries-in');
  const q=$('#dt-quality-in'), t=$('#dt-timeliness-in'), a=$('#dt-accessibility-in'), c=$('#dt-completeness-in');

  const vocab=UI.data?.vocab||{};
  const storageMulti=createMultiSelect($('#dt-storage'),'Storage',vocab.storages||[],v=>{ if(vocab.storages && !vocab.storages.includes(v)){ vocab.storages.push(v); storageMulti.syncOptions(vocab.storages); } });
  const ingestionMulti=createMultiSelect($('#dt-ingestion'),'Ingestion',vocab.ingestions||[],v=>{ if(vocab.ingestions && !vocab.ingestions.includes(v)){ vocab.ingestions.push(v); ingestionMulti.syncOptions(vocab.ingestions); } });
  const frontendMulti=createMultiSelect($('#dt-frontend'),'Frontend',vocab.frontends||[],v=>{ if(vocab.frontends && !vocab.frontends.includes(v)){ vocab.frontends.push(v); frontendMulti.syncOptions(vocab.frontends); } });

  const draft={
    description:ds.description||'',
    owner:ds.owner||'',
    entries:Number(ds.entries||0),
    measures:cloneMeasures(ds.measures),
    layer:cloneLayer(ds.layer),
    useCases:[...(ds.useCases||[])],
    orgs:new Set(ds.orgs||[]),
    orgMeta:{}
  };
  for(const [oid,meta] of Object.entries(ds.orgMeta||{})){
    draft.orgMeta[oid]={
      description:meta.description||'',
      owner:meta.owner||'',
      entries:Number(meta.entries||0),
      measures:cloneMeasures(meta.measures),
      layer:cloneLayer(meta.layer)
    };
  }

  const scopeBar=$('#dt-org-scope'); scopeBar.innerHTML='';
  const scopeChips={};
  function addScope(id,label){
    const chip=h('button',{class:'scope-chip',type:'button'},label);
    chip.onclick=()=> setScope(id);
    scopeBar.appendChild(chip);
    scopeChips[id]=chip;
  }
  addScope('all','All orgs');
  for(const o of Object.values(state.data.orgs)){ addScope(o.id,o.name); }

  const scopeAction=$('#dt-scope-action');
  const inputs=[desc,owner,entries,q,t,a,c];

  function setDisabled(flag){ inputs.forEach(el=>{ el.disabled=flag; }); storageMulti.setDisabled(flag); ingestionMulti.setDisabled(flag); frontendMulti.setDisabled(flag); }

  function snapshot(scope){
    if(scope==='all'){ return {description:draft.description,owner:draft.owner,entries:draft.entries,measures:cloneMeasures(draft.measures),layer:cloneLayer(draft.layer)}; }
    const meta=draft.orgMeta[scope];
    if(meta){ return {description:meta.description,owner:meta.owner,entries:meta.entries,measures:cloneMeasures(meta.measures),layer:cloneLayer(meta.layer)}; }
    return {description:draft.description,owner:draft.owner,entries:draft.entries,measures:cloneMeasures(draft.measures),layer:cloneLayer(draft.layer)};
  }

  function applyToDraft(scope){
    const payload={
      description:desc.value.trim(),
      owner:owner.value.trim(),
      entries:Number(entries.value||0),
      measures:cloneMeasures({quality:Number(q.value||0), timeliness:Number(t.value||0), accessibility:Number(a.value||0), completeness:Number(c.value||0)}),
      layer:cloneLayer({storage:storageMulti.get(), ingestion:ingestionMulti.get(), frontend:frontendMulti.get()})
    };
    if(scope==='all'){
      draft.description=payload.description;
      draft.owner=payload.owner;
      draft.entries=payload.entries;
      draft.measures=payload.measures;
      draft.layer=payload.layer;
    } else if(draft.orgs.has(scope)){
      draft.orgMeta[scope]=payload;
    }
  }

  function fill(scope){
    const snap=snapshot(scope);
    desc.value=snap.description||'';
    owner.value=snap.owner||'';
    entries.value=snap.entries??0;
    q.value=snap.measures.quality??0;
    t.value=snap.measures.timeliness??0;
    a.value=snap.measures.accessibility??0;
    c.value=snap.measures.completeness??0;
    storageMulti.set(snap.layer.storage);
    ingestionMulti.set(snap.layer.ingestion);
    frontendMulti.set(snap.layer.frontend);
    setDisabled(scope!=='all' && !draft.orgs.has(scope));
  }

  function updateScopeAction(){
    scopeAction.innerHTML='';
    if(currentScope==='all'){
      scopeAction.appendChild(h('span',{},'Editing the base dataset values. These apply to every organization unless overridden.'));
      return;
    }
    const org=state.data.orgs[currentScope]; if(!org) return;
    const inOrg=draft.orgs.has(currentScope);
    scopeAction.appendChild(h('span',{}, inOrg?`Editing overrides for ${org.name}.`:`${org.name} does not currently contain this dataset.`));
    const btn=h('button',{class:'btn '+(inOrg?'danger':'primary'),type:'button'}, inOrg?'Remove dataset from this org':'Add dataset to this org');
    btn.onclick=()=>{
      if(inOrg){
        if(!confirm(`Remove dataset "${ds.name}" from org "${org.name}"?`)) return;
        draft.orgs.delete(currentScope);
        delete draft.orgMeta[currentScope];
        fill(currentScope);
        updateScopeAction();
        updateChipState();
      }else{
        draft.orgs.add(currentScope);
        if(!draft.orgMeta[currentScope]){
          draft.orgMeta[currentScope]={
            description:draft.description,
            owner:draft.owner,
            entries:draft.entries,
            measures:cloneMeasures(draft.measures),
            layer:cloneLayer(draft.layer)
          };
        }
        fill(currentScope);
        updateScopeAction();
        updateChipState();
      }
    };
    scopeAction.appendChild(btn);
  }

  function updateChipState(){
    for(const [id,chip] of Object.entries(scopeChips)){ chip.classList.toggle('active', id===currentScope); }
  }

  let currentScope='all';
  const preferredScope=(state.filters.org!=='all' && state.data.orgs[state.filters.org])?state.filters.org:'all';

  function setScope(id,skipCommit=false){
    if(!skipCommit){ applyToDraft(currentScope); }
    currentScope=id;
    fill(id);
    updateChipState();
    updateScopeAction();
  }

  setScope('all',true);
  if(preferredScope!=='all') setScope(preferredScope,true);

  const chosenUC = buildUseCaseMulti($('#dt-usecases'), draft.useCases);

  function closeModal(){ m.classList.remove('show'); }

  $('#dt-save').onclick=()=>{
    applyToDraft(currentScope);
    draft.useCases = chosenUC();
    ds.description=draft.description;
    ds.owner=draft.owner;
    ds.entries=draft.entries;
    ds.measures=cloneMeasures(draft.measures);
    ds.layer=cloneLayer(draft.layer);
    ds.useCases=[...draft.useCases];
    ds.orgs=Array.from(draft.orgs);
    const orgMeta={};
    for(const oid of ds.orgs){ if(draft.orgMeta[oid]) orgMeta[oid]={
      description:draft.orgMeta[oid].description||'',
      owner:draft.orgMeta[oid].owner||'',
      entries:Number(draft.orgMeta[oid].entries||0),
      measures:cloneMeasures(draft.orgMeta[oid].measures),
      layer:cloneLayer(draft.orgMeta[oid].layer)
    }; }
    ds.orgMeta=orgMeta;
    ds.search=[ds.name,ds.description,ds.owner,ds.layer.storage.join(' '),ds.layer.ingestion.join(' '),ds.layer.frontend.join(' ')].join(' ').toLowerCase();
    closeModal();
    render();
  };

  $('#dt-delete').onclick=()=>{
    if(!confirm(`Delete dataset "${ds.name}"? This cannot be undone.`)) return;
    const dom=state.data.domains.find(d=>d.id===ds.domainId); if(dom){ dom.sets = dom.sets.filter(x=>x!==ds.id); }
    delete state.data.datasets[ds.id];
    closeModal();
    render();
  };

  const closeButtons=[$('#dt-close'), $('#dt-close-top')];
  closeButtons.forEach(btn=>{ if(btn) btn.onclick=closeModal; });
}
function openAddDatasetModal(domainId){
  ensureStateData();
  const m=$('#modal-add'); m.classList.add('show'); const f=$('#form-add'); f.reset(); f.dataset.domainId=domainId;
  const vocab=UI.data?.vocab||{};
  const storageMulti=createMultiSelect($('#add-storage'),'Storage',vocab.storages||[],v=>{ if(vocab.storages && !vocab.storages.includes(v)){ vocab.storages.push(v); storageMulti.syncOptions(vocab.storages); } });
  const ingestionMulti=createMultiSelect($('#add-ingestion'),'Ingestion',vocab.ingestions||[],v=>{ if(vocab.ingestions && !vocab.ingestions.includes(v)){ vocab.ingestions.push(v); ingestionMulti.syncOptions(vocab.ingestions); } });
  const frontendMulti=createMultiSelect($('#add-frontend'),'Frontend',vocab.frontends||[],v=>{ if(vocab.frontends && !vocab.frontends.includes(v)){ vocab.frontends.push(v); frontendMulti.syncOptions(vocab.frontends); } });
  const chosen=buildUseCaseMulti($('#add-usecases'),[]);
  const oc=$('#add-orgs'); oc.innerHTML=''; for(const o of Object.values(state.data.orgs)){ oc.appendChild(h('label',{}, h('input',{type:'checkbox',value:o.id}), ' ', o.name)); }
  $('#add-cancel').onclick=()=> m.classList.remove('show');
  f.onsubmit=e=>{
    e.preventDefault();
    const id=(f.name.value||crypto.randomUUID()).replace(/\s+/g,'-').toLowerCase();
    const ds={ id, domainId, name:f.name.value.trim(), description:f.description.value.trim(), owner:f.owner.value.trim(), entries:Number(f.entries.value||0),
      measures:{quality:Number(f.quality.value||0), timeliness:Number(f.timeliness.value||0), accessibility:Number(f.accessibility.value||0), completeness:Number(f.completeness.value||0)},
      layer:{ storage:storageMulti.get(), ingestion:ingestionMulti.get(), frontend:frontendMulti.get() },
      orgs: $$('input[type=checkbox]', oc).filter(x=>x.checked).map(x=>x.value), useCases: chosen(), orgMeta:{} };
    ds.search=[ds.name,ds.description,ds.owner,ds.layer.storage.join(' '),ds.layer.ingestion.join(' '),ds.layer.frontend.join(' ')].join(' ').toLowerCase();
    for(const oid of ds.orgs){ ds.orgMeta[oid]={description:ds.description,owner:ds.owner,entries:ds.entries,measures:cloneMeasures(ds.measures),layer:cloneLayer(ds.layer)}; }
    state.data.datasets[id]=ds; const dom=state.data.domains.find(d=>d.id===domainId); if(dom) dom.sets.push(id);
    m.classList.remove('show'); render();
  };
}

function openAddDomainModal(){
  ensureStateData();
  const m=$('#modal-add-domain'); const f=$('#form-add-domain'); if(!m||!f)return; f.reset();
  const name=$('#domain-name'), idInput=$('#domain-id'); if(name)name.value=''; if(idInput)idInput.value='';
  m.classList.add('show'); if(name)name.focus();
  const cancel=$('#add-domain-cancel'); if(cancel)cancel.onclick=()=>m.classList.remove('show');
  f.onsubmit=e=>{e.preventDefault(); const domainName=(name?.value||'').trim(); let domainId=(idInput?.value||'').trim(); if(!domainName){alert('Domain name is required.'); name?.focus(); return;} domainId=slugify(domainId||domainName); if(!domainId){alert('Domain identifier is required.'); idInput?.focus(); return;} if(state.data.domains.some(d=>d.id===domainId)){alert('Domain identifier already exists.'); idInput?.focus(); return;} state.data.domains.push({id:domainId,name:domainName,sets:[]}); m.classList.remove('show'); render();};
}
/* File operations + CSV */
async function openXML(){try{const[h]=await window.showOpenFilePicker({types:[{description:'XML',accept:{'text/xml':['.xml']}}]}); state.xmlHandle=h; const text=await (await h.getFile()).text(); state.xmlDoc=parseXML(text); state.data=loadModel(state.xmlDoc); render();}catch(e){if(e.name!=='AbortError')alert('Open failed: '+e.message)}}
async function saveXML(){if(!state.data) return alert('Nothing to save'); const prev=state.data.version||'v0000'; const ts=new Date().toISOString().replace(/[-:.]/g,'').slice(0,15); state.data.version='v'+ts; const xml=serializeModel(state.data); if(state.xmlHandle){const w=await state.xmlHandle.createWritable(); await w.write(xml); await w.close();} else { const h=await window.showSaveFilePicker({suggestedName:'tda-data.xml',types:[{description:'XML',accept:{'text/xml':['.xml']}}]}); state.xmlHandle=h; const w=await h.createWritable(); await w.write(xml); await w.close(); } setStatus(`Saved ${prev} → ${state.data.version}`);}
function toCSVRows(m){
  const rows=[['orgId','domainId','domainName','datasetId','datasetName','description','owner','entries','quality','timeliness','accessibility','completeness','storage','ingestion','frontend','useCaseGroups','useCases']];
  for(const d of m.domains){
    for(const sid of d.sets){
      const s=m.datasets[sid]; if(!s) continue;
      const ucg=Array.from(new Set((s.useCases||[]).map(r=>r.split('/')[0])));
      const u=s.useCases||[];
      const baseStorage=listToText(s.layer?.storage);
      const baseIngestion=listToText(s.layer?.ingestion);
      const baseFrontend=listToText(s.layer?.frontend);
      if(s.orgs?.length){
        for(const oid of s.orgs){
          const meta=s.orgMeta?.[oid]||{};
          rows.push([
            oid,
            d.id,
            d.name,
            s.id,
            s.name,
            meta.description||s.description,
            meta.owner||s.owner,
            meta.entries||s.entries,
            meta.measures?.quality??s.measures.quality,
            meta.measures?.timeliness??s.measures.timeliness,
            meta.measures?.accessibility??s.measures.accessibility,
            meta.measures?.completeness??s.measures.completeness,
            listToText(meta.layer?.storage??s.layer.storage),
            listToText(meta.layer?.ingestion??s.layer.ingestion),
            listToText(meta.layer?.frontend??s.layer.frontend),
            ucg.join('|'),
            u.join('|')
          ]);
        }
      } else {
        rows.push([
          '',
          d.id,
          d.name,
          s.id,
          s.name,
          s.description,
          s.owner,
          s.entries,
          s.measures.quality,
          s.measures.timeliness,
          s.measures.accessibility,
          s.measures.completeness,
          baseStorage,
          baseIngestion,
          baseFrontend,
          ucg.join('|'),
          u.join('|')
        ]);
      }
    }
  }
  return rows;
}
function csvString(rows){const q=v=>{v=(v??'').toString();return /[",\n\r]/.test(v)? '\"'+v.replace(/\"/g,'\"\"')+'\"':v};return rows.map(r=>r.map(q).join(',')).join('\n')}
async function exportCSV(){if(!state.data)return alert('Load or create data first.');const prev=state.data.version||'v0000';const newId='v'+new Date().toISOString().replace(/[-:.]/g,'').slice(0,15);const name=`tda-datasets.${prev}-to-${newId}.csv`;const blob=new Blob([csvString(toCSVRows(state.data))],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(a.href);setStatus(`Exported CSV: ${name}`)}
/* Settings modal */
function openSettings(){const m=$('#modal-settings'); m.classList.add('show'); const c=UI.data; if(!c) return; $('#bg-from').value=c.theme.background.from; $('#bg-to').value=c.theme.background.to; $('#accent').value=c.theme.background.accent; $('#cols').value=c.theme.layout.domainColumns; $('#stop-min').value=c.theme.heatmap[0]?.color||'#ff4d4f'; $('#stop-mid').value=c.theme.heatmap[1]?.color||'#ffd666'; $('#stop-max').value=c.theme.heatmap[c.theme.heatmap.length-1]?.color||'#52c41a'; $('#apply-theme').onclick=()=>{ c.theme.background.from=$('#bg-from').value; c.theme.background.to=$('#bg-to').value; c.theme.background.accent=$('#accent').value; c.theme.layout.domainColumns=Number($('#cols').value)||5; c.theme.heatmap=[{at:0,color:$('#stop-min').value},{at:50,color:$('#stop-mid').value},{at:100,color:$('#stop-max').value}]; applyTheme(c); setStatus('Applied theme'); m.classList.remove('show'); }; $('#open-config').onclick=async()=>{ await openUIConfig(); setStatus('Opened config'); }; $('#save-config').onclick=async()=>{ await saveUIConfig(); setStatus('Saved config'); };}
async function boot(){await loadDefaultUIConfig(); try{const r=await fetch('./assets/sample-data.xml',{cache:'no-store'}); if(r.ok){const t=await r.text(); state.xmlDoc=parseXML(t); state.data=loadModel(state.xmlDoc); render(); }}catch(e){ setStatus('Failed to load sample-data.xml'); }
  $('#btn-open').onclick=openXML; $('#btn-save').onclick=saveXML; const addDomain=$('#btn-add-domain'); if(addDomain) addDomain.onclick=openAddDomainModal; $('#fab-settings').onclick=openSettings; $('#btn-settings').onclick=openSettings; }
document.addEventListener('DOMContentLoaded',boot);
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ const open=Array.from(document.querySelectorAll('.modal-backdrop.show')); const last=open.pop(); if(last) last.classList.remove('show'); } });
