/* Small, read-only cross-Feature graph. Dagre is already bundled for Task maps. */
(() => {
  function bind(root=document) {
    document.querySelectorAll('.feature-view-tabs [data-feature-view]').forEach(button => { if(button.dataset.bound) return; button.dataset.bound='true'; button.addEventListener('click',()=>{ const shell=document.querySelector('.app-shell'); const mode=button.dataset.featureView; shell.dataset.featureView=mode; document.querySelectorAll('.feature-view-tabs [data-feature-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button))); document.getElementById(mode==='relations'?'cross-feature-overview':'status-board')?.scrollIntoView({behavior:'smooth',block:'start'}); }); });
    root.querySelectorAll('.cross-feature-overview').forEach(surface => {
      if (surface.dataset.bound) return; surface.dataset.bound='true';
      const svg=surface.querySelector('.feature-map-svg'), scroll=surface.querySelector('.feature-map-scroll');
      const model=JSON.parse(surface.querySelector('[data-feature-relations]').content.textContent);
      const isolated=surface.querySelector('[data-feature-map-isolated]'), scaleOut=surface.querySelector('[data-feature-map-scale]');
      let scale=1;
      function draw(){
        const linked=new Set(model.edges.flatMap(e=>[e.from,e.to]));
        const visible=model.nodes.filter(n=>isolated.checked||linked.has(n.id));
        const ids=new Set(visible.map(n=>n.id));
        const edges=model.edges.filter(e=>ids.has(e.from)&&ids.has(e.to));
        const g=new dagre.graphlib.Graph().setGraph({rankdir:'LR',ranksep:70,nodesep:28,marginx:28,marginy:28}).setDefaultEdgeLabel(()=>({}));
        visible.forEach(n=>g.setNode(n.id,{width:230,height:76}));edges.forEach(e=>g.setEdge(e.from,e.to));dagre.layout(g);
        const width=Math.max(620,(g.graph().width||620)),height=Math.max(220,(g.graph().height||220));svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.style.width=`${width*scale}px`;svg.style.height=`${height*scale}px`;
        svg.replaceChildren();
        const NS='http://www.w3.org/2000/svg';const el=(n,a={})=>{const x=document.createElementNS(NS,n);for(const [k,v] of Object.entries(a))x.setAttribute(k,v);return x};
        edges.forEach(e=>{const route=g.edge(e.from,e.to)?.points||[];if(!route.length)return;const p=el('path',{d:'M '+route.map(x=>`${x.x} ${x.y}`).join(' L '),class:'feature-map-edge','marker-end':'url(#feature-map-arrow)'});svg.append(p)});
        const defs=el('defs'),marker=el('marker',{id:'feature-map-arrow',viewBox:'0 0 8 8',refX:'7',refY:'4',markerWidth:'5',markerHeight:'5',orient:'auto'});marker.append(el('path',{d:'M 0 0 L 8 4 L 0 8 z'}));defs.append(marker);svg.prepend(defs);
        visible.forEach(n=>{const p=g.node(n.id), group=el('g',{class:`feature-map-node feature-map-node--${n.status.replaceAll('_','-')}`,'data-feature-open':n.id,tabindex:'0',role:'button','aria-label':`${n.id} · ${n.title} · ${n.label}`});group.append(el('rect',{x:p.x-115,y:p.y-38,width:230,height:76,rx:10}));const text=(v,x,y,c)=>{const t=el('text',{x:p.x+x,y:p.y+y,class:c});t.textContent=v;group.append(t)};text(n.id,-99,-12,'feature-map-id');text(n.title.slice(0,31)+(n.title.length>31?'…':''),-99,10,'feature-map-title');text(n.unavailable?'unavailable':`${n.done}/${n.total} Tasks · ${n.label}`, -99,29,'feature-map-meta');svg.append(group)});
        scaleOut.textContent=`${Math.round(scale*100)}%`;surface.querySelector('[data-feature-map-status]').textContent=`${visible.length} 个 Feature · ${edges.length} 条依赖${isolated.checked?' · 含独立 Feature':''}`;
      }
      isolated.addEventListener('change',draw);surface.querySelectorAll('[data-feature-map-zoom]').forEach(b=>b.addEventListener('click',()=>{const a=b.dataset.featureMapZoom;if(a==='fit')scale=1;else scale=Math.max(.5,Math.min(1.8,scale*(a==='in'?1.2:1/1.2)));draw()}));
      surface.addEventListener('click',e=>{const n=e.target.closest('.feature-map-node');if(n)window.__bagakitOpenFeatureReview?.(n.dataset.featureOpen)});surface.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.closest('.feature-map-node')){e.preventDefault();window.__bagakitOpenFeatureReview?.(e.target.closest('.feature-map-node').dataset.featureOpen)}});draw();
    });
  }
  window.__bagakitUpdateFeatureRelations=()=>bind();
  document.addEventListener('DOMContentLoaded',()=>bind());
})();
