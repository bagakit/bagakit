(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const controllers = new WeakMap();
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = (name, attrs = {}) => {
    const node = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([key,value]) => node.setAttribute(key, value));
    return node;
  };
  function bind(root = document) {
    root.querySelectorAll('.task-topology').forEach(topology => {
      if (controllers.has(topology)) return;
      const svg=topology.querySelector('.task-topology-svg'), scroller=topology.querySelector('.task-topology-scroll');
      const nodeLayer=svg.querySelector('[data-graph-nodes]'), edgeLayer=svg.querySelector('[data-graph-edges]');
      const inspector=topology.querySelector('[data-edge-inspector]'), panel=topology.querySelector('[data-group-panel]');
      let model, cards, layout, camera=1, pinned=null, hovered=null, hoverTimer, drag=null;
      let expanded = new Set(), allLinks=false;
      let panelContentKey = '';
      let exporting=false;
      let cameraFrame=0, cameraTimer=0, lastPinned=null;
      const mini=topology.querySelector('[data-minimap-svg]');
      const miniView=el('rect',{class:'minimap-viewport'});
      let nodeElements=new Map(), edgeElements=new Map();
      function miniViewport() {
        if(!layout)return;
        const attrs={x:Math.min(layout.width,scroller.scrollLeft/camera),y:Math.min(layout.height,scroller.scrollTop/camera),
          width:Math.min(layout.width,scroller.clientWidth/camera),height:Math.min(layout.height,scroller.clientHeight/camera)};
        attrs.width=Math.min(attrs.width,layout.width-attrs.x);attrs.height=Math.min(attrs.height,layout.height-attrs.y);
        Object.entries(attrs).forEach(([key,value])=>miniView.setAttribute(key,value));
      }
      function renderMinimap() {
        mini.setAttribute('viewBox',`0 0 ${layout.width} ${layout.height}`);
        const fragments=document.createDocumentFragment();
        for(const edge of layout.edges)fragments.append(el('path',{d:TrackerLayout.path(edge.points),class:'minimap-edge'}));
        for(const n of layout.nodes)fragments.append(el('rect',{x:n.x-n.width/2,y:n.y-n.height/2,width:n.width,height:n.height,rx:12,
          class:`minimap-node${n.members.some(m=>m.status==='active')?' minimap-node--active':''}`}));
        fragments.append(miniView);mini.replaceChildren(fragments);miniViewport();
      }
      function cancelCamera(){cancelAnimationFrame(cameraFrame);clearTimeout(cameraTimer);cameraFrame=0;cameraTimer=0;}
      function moveCamera(next,left,top,animate=true) {
        cancelCamera();
        next=Math.min(2,Math.max(.02,next));
        left=Math.max(0,Math.min(left,layout.width*next-scroller.clientWidth));
        top=Math.max(0,Math.min(top,layout.height*next-scroller.clientHeight));
        const start={zoom:camera,left:scroller.scrollLeft,top:scroller.scrollTop},time=performance.now();
        const apply=p=>{
          camera=start.zoom+(next-start.zoom)*p;topology.dataset.topologyZoom=String(camera);
          svg.style.width=`${layout.width*camera}px`;svg.style.height=`${layout.height*camera}px`;
          scroller.scrollLeft=start.left+(left-start.left)*p;scroller.scrollTop=start.top+(top-start.top)*p;
          topology.querySelector('[data-topology-zoom-level]').textContent=`${Math.round(camera*100)}%`;miniViewport();
        };
        if(!animate||reducedMotion()){apply(1);return;}
        const finish=()=>{cancelCamera();apply(1);};
        const frame=now=>{const t=Math.max(0,Math.min(1,(now-time)/300));apply(1-Math.pow(1-t,3));if(t<1)cameraFrame=requestAnimationFrame(frame);else finish();};
        // A throttled background tab may skip frames; still settle the camera
        // at its destination instead of leaving an intermediate zoom behind.
        cameraTimer=setTimeout(finish,320);
        cameraFrame=requestAnimationFrame(frame);
      }
      function read() {
        model=JSON.parse(topology.querySelector('[data-topology-model]').content.textContent);
        cards=new Map([...topology.querySelector('[data-topology-cards]').content.querySelectorAll('.topology-node')].map(n=>[n.dataset.taskId,n]));
      }
      function zoom(value, anchor) {
        const next=Math.min(2,Math.max(.02,value));
        const left=(scroller.scrollLeft+(anchor?.x ?? scroller.clientWidth/2))/camera;
        const top=(scroller.scrollTop+(anchor?.y ?? scroller.clientHeight/2))/camera;
        camera=next;
        topology.dataset.topologyZoom=String(camera);
        svg.style.width=`${layout.width*camera}px`; svg.style.height=`${layout.height*camera}px`;
        scroller.scrollLeft=left*camera-(anchor?.x ?? scroller.clientWidth/2);
        scroller.scrollTop=top*camera-(anchor?.y ?? scroller.clientHeight/2);
        topology.querySelector('[data-topology-zoom-level]').textContent=`${Math.round(camera*100)}%`;
        miniViewport();
      }
      function fit(all=false) {
        const scale=Math.min(1,(scroller.clientWidth-24)/layout.width,all?(scroller.clientHeight-24)/layout.height:1);
        moveCamera(scale,0,0);
      }
      function focusCurrent() {
        const score=node=>node.members.reduce((value,n)=>value+({active:4,blocked:3,failed:3,runnable:1}[n.status]||0),0);
        const node=[...layout.nodes].sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id))[0];
        const scale=scroller.clientWidth<600?.85:1;
        if(node)moveCamera(scale,(node.x-node.width/2)*scale-36,(node.y-node.height/2)*scale-56);
      }
      function groupCard(node) {
        const summary=node.summary;
        const card=el('g',{class:'topology-group-node',tabindex:0,role:'button',
          'data-group-id':node.id,'data-wave':node.wave,
          'data-group-attention':String(summary.attention.length>0),
          'data-group-summary':JSON.stringify(summary.counts)});
        if(node.members.every(n=>n.stable))card.classList.add('topology-node--stable-done');
        const counts=Object.entries(TrackerLayout.statusLabels).filter(([status])=>summary.counts[status])
          .map(([status,label])=>`${label} ${summary.counts[status]}`).join(' · ');
        card.setAttribute('aria-label',`${node.wave} 并行组 · ${summary.total} 项任务 · ${counts} · 已回报进展 ${summary.activity} 项 · 点击查看成员`);
        const title=el('title');title.textContent=card.getAttribute('aria-label')+'\n'+node.members.map(n=>`${n.id} · ${n.title} · ${TrackerLayout.statusLabels[n.status]||n.status}`).join('\n');card.append(title);
        const text=(content,x,y,cls,attrs={})=>{const t=el('text',{x,y,class:cls,...attrs});t.textContent=content;card.append(t);return t;};
        card.append(el('rect',{x:8,y:0,width:272,height:204,rx:13,class:'group-stack group-stack--back'}),
          el('rect',{x:4,y:4,width:280,height:204,rx:13,class:'group-stack'}),
          el('rect',{x:0,y:8,width:288,height:204,rx:13,class:'topology-node-card group-face'}),
          el('path',{d:'M 13 8 H 275 Q 288 8 288 21 V 43 H 0 V 21 Q 0 8 13 8 Z',class:'group-header'}),
          el('path',{d:'M 16 22 L 22 19 L 28 22 L 22 25 Z M 16 26 L 22 29 L 28 26 M 16 30 L 22 33 L 28 30',class:'group-collection-icon'}));
        text('并行组',36,31,'group-type');text(node.wave,96,31,'group-wave');text(`${summary.total} 项任务`,272,31,'group-count',{'text-anchor':'end'});
        let common=node.members[0].title;
        for(const member of node.members)while(common&&!member.title.startsWith(common))common=common.slice(0,-1);
        const placeholderGroup=node.members.every(n=>n.title==='未保留详情的历史节点');
        const caption=placeholderGroup?'未保留详情的历史节点':common.trim().length>=6?common.trim():'相同上下游 · 并行工作';
        // Wrap by display units so mixed Chinese/Latin labels use the width.
        const lines=[];let line='',units=0;
        for(const char of caption){const size=char.codePointAt(0)>255?2:1;if(units+size>38){lines.push(line);line='';units=0;}line+=char;units+=size;}
        if(line)lines.push(line);
        text(lines[0],16,64,'group-title');
        text(lines.length>1?lines[1]+(lines.length>2?'…':''):`${node.members[0].id} … ${node.members.at(-1).id}`,16,81,lines.length>1?'group-title':'group-members');
        text(`${summary.done} / ${summary.total}`,16,108,'group-completion');text('已完成',91,108,'group-caption');
        if(summary.activity)text(`进展 ${summary.activity}`,193,108,'group-activity',{'text-anchor':'end'});
        text(`${Math.round(summary.completion*100)}%`,272,108,'group-percentage',{'text-anchor':'end'});
        card.append(el('rect',{x:16,y:118,width:256,height:6,rx:3,class:'group-progress-track'}));
        let offset=16;
        for(const [status] of Object.entries(TrackerLayout.statusLabels)) {
          const count=summary.counts[status];if(!count)continue;
          const width=count/summary.total*256;
          card.append(el('rect',{x:offset,y:118,width,height:6,class:`group-state-segment group-state--${status}`,'data-status':status,'data-count':count}));offset+=width;
        }
        const shown=Object.entries(TrackerLayout.statusLabels).filter(([status])=>status!=='done'&&summary.counts[status]);
        shown.forEach(([status,label],index)=>{
          const x=16+(index%4)*65,y=144+Math.floor(index/4)*20;
          card.append(el('circle',{cx:x+3,cy:y-3,r:2.5,class:`group-state-segment group-state--${status}`}));
          text(`${label} ${summary.counts[status]}`,x+10,y,'group-state-label');
        });
        if(!shown.length)text('全部任务已完成',16,146,'group-caption');
        if(shown.length<=4)text(`共同上游 ${node.prerequisiteCount} · 后继 ${node.dependentCount}${node.members.some(n=>n.critical)?' · 含关键路径':''}`,16,165,'group-context');
        card.append(el('path',{d:'M 16 177 H 272',class:'group-divider'}));
        const attention=summary.attention[0];
        const signal=attention?`${summary.attention.length>1?`关注 ${summary.attention.length} 项`:attention.status==='failed'?'待重规划':'需解阻'} · ${attention.id}`:
          summary.activity?`${summary.activity} 项已有进展回报`:
          summary.counts.active?`${summary.counts.active} 项进行中 · 尚无进展回报`:
          summary.counts.runnable?`${summary.counts.runnable} 项可领取`:
          summary.counts.waiting?'等待共同前置条件':summary.done===summary.total?'已全部完成 · 可查看证据':'历史任务 · 可查看成员';
        text(signal,16,198,attention?'group-attention':'group-footer');text('查看 ›',272,198,'group-open',{'text-anchor':'end'});
        return card;
      }
      function renderGraph({initial=false, geometry=true}={}) {
        const oldLayout=layout;
        layout=TrackerLayout.project(model,{expanded,allLinks,focusOpen:topology.classList.contains('is-focusing-open-work')});
        if(pinned&&!layout.nodes.some(n=>n.id===pinned)&&!layout.edges.some(e=>e.key===pinned))pinned=null;
        svg.setAttribute('viewBox',`0 0 ${layout.width} ${layout.height}`);
        svg.setAttribute('width',layout.width); svg.setAttribute('height',layout.height);
        topology.dataset.layoutEngine='dagre';
        const nextNodes=new Map(), nextEdges=new Map();
        for (const node of layout.nodes) {
          let item=nodeElements.get(node.id);
          const content=node.group?groupCard(node):cards.get(node.id).cloneNode(true);
          if (!item) { item=content; nodeLayer.append(item); }
          else {
            // Stable outer identity keeps focus, pointer hit testing and the
            // animation timeline intact across actual status updates.
            if (item.innerHTML!==content.innerHTML) item.replaceChildren(...content.childNodes);
            item.setAttribute('class',content.getAttribute('class'));
            ['data-task-status','data-task-dependency-summary','data-task-evidence-summary','data-group-summary','data-group-attention','aria-label'].forEach(k=>{
              if(content.hasAttribute(k))item.setAttribute(k,content.getAttribute(k));
            });
          }
          const x=node.x-node.width/2,y=node.y-node.height/2;
          const old=oldLayout?.nodes.find(n=>n.id===node.id);
          if(old && JSON.stringify(old.members.map(n=>n.status))!==JSON.stringify(node.members.map(n=>n.status)) && !reducedMotion()) {
            const face=item.querySelector('.topology-node-card');
            face.animate([{stroke:'#f5d897',strokeWidth:3},{stroke:getComputedStyle(face).stroke,strokeWidth:1.5}],{duration:700,easing:'ease-out'});
          }
          item.setAttribute('transform',`translate(${x} ${y})`);
          if (geometry && !initial && old && !reducedMotion() && (old.x!==node.x||old.y!==node.y)) {
            item.animate([{transform:`translate(${old.x-node.width/2}px,${old.y-node.height/2}px)`},{transform:`translate(${x}px,${y}px)`}],{duration:260,easing:'cubic-bezier(.2,.7,.2,1)'});
          }
          nextNodes.set(node.id,item);
        }
        nodeElements.forEach((item,key)=>{if(!nextNodes.has(key))item.remove();}); nodeElements=nextNodes;
        for(const edge of layout.edges) {
          let group=edgeElements.get(edge.key);
          if(!group) {
            group=el('g',{class:'topology-edge-group','data-edge-from':edge.from,'data-edge-to':edge.to});
            group.append(el('path',{class:'topology-edge','marker-end':`url(#${topology.dataset.featureId}-task-arrow)`}),el('path',{class:'edge-hit-target',tabindex:0,role:'button'}));
            edgeLayer.append(group);
          }
          const line=group.querySelector('.topology-edge'),hit=group.querySelector('.edge-hit-target');
          const path=TrackerLayout.path(edge.points);
          line.setAttribute('d',path); hit.setAttribute('d',path);
          line.classList.toggle('topology-edge--critical',edge.critical);
          line.classList.toggle('topology-edge--activity',edge.activity);
          line.dataset.edgeActivity=String(edge.activity);
          group.classList.toggle('is-redundant',!edge.essential);
          group.dataset.edgeKey=edge.key;
          hit.setAttribute('aria-label',`${edge.from} → ${edge.to} · ${edge.members.length} direct dependencies; click to pin`);
          nextEdges.set(edge.key,group);
        }
        edgeElements.forEach((item,key)=>{if(!nextEdges.has(key))item.remove();}); edgeElements=nextEdges;
        topology.querySelector('[data-layout-summary]').textContent=`${model.nodes.length} Tasks · ${layout.nodes.length} 可见节点${layout.hiddenTasks?` · 已收起 ${layout.hiddenTasks} 项已结束任务`:''} · ${layout.edges.length} 路径${layout.hiddenEdges?` · ${layout.hiddenEdges} 条传递冗余依赖${allLinks?'已显示':'已收起'}`:''}`;
        const toggle=topology.querySelector('[data-topology-wire-toggle]');
        toggle.setAttribute('aria-pressed',String(allLinks)); toggle.textContent=allLinks?'Focus key links':'Show all links';
        toggle.hidden=layout.hiddenEdges===0;
        const groups=topology.querySelector('[data-topology-group-toggle]');
        groups.disabled=!layout.groups.length;
        groups.hidden=!layout.groups.length;
        groups.setAttribute('aria-pressed',String(expanded.size>0)); groups.textContent=expanded.size?'收拢并行组':'展开并行组';
        const openToggle=topology.querySelector('[data-topology-stable-toggle]');
        const focusing=topology.classList.contains('is-focusing-open-work');
        if(openToggle){
          openToggle.hidden=!focusing&&!model.nodes.some(n=>['done','cancelled','transferred'].includes(n.status));
          openToggle.setAttribute('aria-pressed',String(focusing));
          openToggle.textContent=focusing?'Show all Tasks':'Focus open work';
        }
        zoom(camera,{x:0,y:0});
        renderMinimap();
        if(initial) requestAnimationFrame(()=>topology.classList.contains('task-topology--historical')?fit(true):model.nodes.length>24?focusCurrent():fit(true));
        trace(pinned||hovered);
        if(!panel.hidden&&panel.dataset.groupId){const scroll=panel.scrollTop;groupPanel(panel.dataset.groupId);panel.scrollTop=scroll;}
        if(!panel.hidden&&panel.dataset.taskId)requestAnimationFrame(()=>{
          const source=document.getElementById(`${topology.dataset.featureId}-task-${panel.dataset.taskId}`);
          if(source){const scroll=panel.scrollTop;inspectTask(source,false);panel.scrollTop=scroll;}
        });
      }
      function render(options={}) {
        const errorBox=topology.querySelector('[data-topology-error]');
        try {
          read();
          renderGraph(options);
          topology.classList.remove('task-topology--error');
          if(errorBox){errorBox.hidden=true;errorBox.textContent='';}
        } catch(error) {
          const detail=error && error.message ? error.message : String(error || 'unknown error');
          topology.classList.add('task-topology--error');
          if(errorBox){
            errorBox.hidden=false;
            errorBox.textContent=`拓扑投影失败：${detail}。Task 详情仍可查看；修复后刷新。`;
          }
          inspector.textContent='拓扑投影失败；Task 详情仍可查看。';
          console.error('Tracker topology projection failed',error);
        }
      }
      function trace(key) {
        const edgeByKey=new Map(layout.edges.map(e=>[e.key,e]));
        const up=new Set(),down=new Set();
        if(pinned && nodeElements.has(key)) {
          const walk=(direction,result)=>{const queue=[key];while(queue.length){const id=queue.pop();for(const edge of layout.edges){const from=direction==='up'?edge.to:edge.from,to=direction==='up'?edge.from:edge.to;if(from===id&&!result.has(to)){result.add(to);queue.push(to);}}}};
          walk('up',up);walk('down',down);
        }
        if(!key) {
          inspector.textContent=layout.nodes.length?'悬停查看；点击连线固定路径 · 拖动画布移动':'当前没有未完成任务 · Show all Tasks 可查看完整记录';
        } else if(nodeElements.has(key)) {
          const node=layout.nodes.find(n=>n.id===key);
          inspector.textContent=pinned?`路径已选定 · ${up.size} 个上游节点 → 当前 → ${down.size} 个下游节点 · Esc 退出追踪`:node.group?nodeElements.get(key).getAttribute('aria-label'):`${node.id} · ${node.title} · ${node.dependency} · ${node.stats}`;
        } else {
          const edge=layout.edges.find(e=>e.key===key);
          if(edge) inspector.textContent=`${pinned?'路径已固定 · 点击空白取消 · ':''}${edge.members.map(e=>`${e.from} → ${e.to}`).join(' · ')}`;
        }
        for(const [id,item] of nodeElements) {
          const edge=edgeByKey.get(key);
          item.classList.toggle('is-node-focused',id===key||edge?.from===id||edge?.to===id);
          item.classList.toggle('is-node-upstream',up.has(id));item.classList.toggle('is-node-downstream',down.has(id));
          item.classList.toggle('is-node-muted',Boolean(pinned)&&id!==key&&!up.has(id)&&!down.has(id)&&edge?.from!==id&&edge?.to!==id);
        }
        for(const [id,item] of edgeElements) {
          const edge=edgeByKey.get(id);
          const upstream=up.has(edge.from)&&(up.has(edge.to)||edge.to===key);
          const downstream=down.has(edge.to)&&(down.has(edge.from)||edge.from===key);
          const related=id===key||edge.from===key||edge.to===key||upstream||downstream;
          item.classList.toggle('is-edge-focused',related);
          item.classList.toggle('is-upstream',upstream);item.classList.toggle('is-downstream',downstream);
          item.classList.toggle('is-pinned',Boolean(pinned)&&related);
          if(pinned!==lastPinned&&pinned&&related&&!reducedMotion()) {
            item.querySelector('.topology-edge').animate([{opacity:.2},{opacity:1}],{duration:450,easing:'ease-out'});
          }
        }
        // Hover never dims every unrelated node: retain the user's mental map.
        topology.classList.toggle('has-pinned-path',Boolean(pinned));
        lastPinned=pinned;
      }
      function groupPanel(id) {
        const group=layout.groups.find(g=>g.id===id); if(!group){panel.hidden=true;return;}
        const contentKey = 'group:' + id + ':' + JSON.stringify(group.members);
        if(!panel.hidden && panel.dataset.groupId===id && panelContentKey===contentKey)return;
        panelContentKey=contentKey;
        panel.dataset.groupId=id;
        delete panel.dataset.taskId;
        const entering=panel.hidden;panel.replaceChildren(); panel.hidden=false;
        if(entering&&!reducedMotion())panel.animate([{opacity:0,transform:'translateX(18px)'},{opacity:1,transform:'translateX(0)'}],{duration:260,easing:'cubic-bezier(.2,.7,.2,1)'});
        pinned=id;trace(pinned);
        const heading=document.createElement('strong'); heading.textContent=`${group.members.length} 个并行任务 · ${group.members[0].wave}`;
        const expand=document.createElement('button'); expand.textContent='展开';
        expand.onclick=()=>{expanded.add(id);panel.hidden=true;render();fit(true);};
        const close=document.createElement('button');close.textContent='关闭';close.onclick=()=>{panel.hidden=true;pinned=null;trace(null);};
        const head=document.createElement('div');head.append(heading,expand,close);panel.append(head);
        const summary=TrackerLayout.summarize(group.members);
        const description=document.createElement('p');description.className='group-panel-summary';
        description.textContent=[`已完成 ${summary.done}/${summary.total}`,...Object.entries(TrackerLayout.statusLabels).filter(([status])=>status!=='done'&&summary.counts[status]).map(([status,label])=>`${label} ${summary.counts[status]}`),`已回报进展 ${summary.activity} 项`].join(' · ');
        head.after(description);
        const priority={failed:0,blocked:1,active:2,runnable:3,waiting:4,done:5,cancelled:6,transferred:7};
        [...group.members].sort((a,b)=>priority[a.status]-priority[b.status]||a.id.localeCompare(b.id)).forEach(n=>{
          const link=document.createElement('a');link.className='topology-wave-row';link.dataset.taskId=n.id;link.href=cards.get(n.id).getAttribute('href');
          const title=document.createElement('span');title.textContent=n.title;
          const id=document.createElement('strong');id.textContent=n.id;
          const status=document.createElement('em');status.textContent=TrackerLayout.statusLabels[n.status]||n.status; status.dataset.status=n.status; link.append(id,title,status); panel.append(link);
        });
      }
      function inspectTask(source, focus=true) {
        const taskId=source.id.slice((topology.dataset.featureId+'-task-').length);
        if(focus&&!layout.owner.has(taskId)&&topology.classList.contains('is-focusing-open-work')) {
          topology.classList.remove('is-focusing-open-work');panel.hidden=true;render();
        }
        const contentKey = 'task:' + taskId + ':' + source.innerHTML;
        if(!focus && !panel.hidden && panel.dataset.taskId===taskId && panelContentKey===contentKey)return;
        panelContentKey=contentKey;
        panel.dataset.taskId=taskId;delete panel.dataset.groupId;
        const detail=source.cloneNode(true);detail.open=true;
        detail.removeAttribute('id');detail.className='inspector-task';
        detail.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
        const heading=document.createElement('strong');heading.textContent=`${taskId} · 任务详情`;
        const close=document.createElement('button');close.textContent='关闭';close.setAttribute('aria-label','关闭节点详情');
        close.onclick=()=>{panel.hidden=true;pinned=null;trace(null);nodeElements.get(layout.owner.get(taskId))?.focus({preventScroll:true});};
        const header=document.createElement('div');header.append(heading,close);
        const group=layout.groups.find(g=>g.members.some(n=>n.id===taskId));
        if(group){const back=document.createElement('button');back.textContent='返回组';back.onclick=()=>groupPanel(group.id);header.insertBefore(back,close);}
        panel.replaceChildren(header,detail);panel.hidden=false;
        pinned=layout.owner.get(taskId);trace(pinned);
        if(focus&&!reducedMotion())panel.animate([{opacity:.4,transform:'translateX(12px)'},{opacity:1,transform:'translateX(0)'}],{duration:240,easing:'ease-out'});
        if(focus){panel.scrollTop=0;close.focus({preventScroll:true});}
      }
      panel.addEventListener('keydown',event=>{
        if(event.key==='Escape'){event.preventDefault();event.stopPropagation();panel.hidden=true;pinned=null;trace(null);scroller.focus({preventScroll:true});}
      });
      function hit(event) {
        const node=event.target.closest('.topology-node,.topology-group-node');
        if(node)return node.dataset.taskId||node.dataset.groupId;
        return event.target.closest('.topology-edge-group')?.dataset.edgeKey||null;
      }
      scroller.addEventListener('pointermove',event=>{
        if(drag) {scroller.scrollLeft=drag.left-event.clientX+drag.x;scroller.scrollTop=drag.top-event.clientY+drag.y;return;}
        const key=hit(event); if(key===hovered)return;
        hovered=key;clearTimeout(hoverTimer);
        if(!pinned)hoverTimer=setTimeout(()=>trace(hovered),70);
      });
      scroller.addEventListener('pointerleave',()=>{hovered=null;clearTimeout(hoverTimer);if(!pinned)trace(null);});
      scroller.addEventListener('focusin',event=>{if(!pinned)trace(hit(event));});
      scroller.addEventListener('click',event=>{
        const group=event.target.closest('.topology-group-node');
        if(group) {event.preventDefault();event.stopPropagation();groupPanel(group.dataset.groupId);return;}
        const edge=event.target.closest('.topology-edge-group');
        if(edge) {event.preventDefault();event.stopPropagation();pinned=pinned===edge.dataset.edgeKey?null:edge.dataset.edgeKey;trace(pinned);return;}
        if(!hit(event)){pinned=null;trace(null);}
      });
      scroller.addEventListener('keydown',event=>{
        if(event.key==='Escape'){pinned=null;trace(null);event.stopPropagation();}
        if((event.key==='Enter'||event.key===' ')&&event.target.matches('.edge-hit-target,.topology-group-node')){event.preventDefault();event.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}
      });
      scroller.addEventListener('pointerdown',event=>{
        cancelCamera();
        if(event.button!==0||hit(event))return;
        drag={x:event.clientX,y:event.clientY,left:scroller.scrollLeft,top:scroller.scrollTop};
        scroller.setPointerCapture(event.pointerId);scroller.classList.add('is-panning');
      });
      const stop=()=>{drag=null;scroller.classList.remove('is-panning');};
      ['pointerup','pointercancel','lostpointercapture'].forEach(name=>scroller.addEventListener(name,stop));
      scroller.addEventListener('wheel',event=>{
        cancelCamera();
        if(!event.ctrlKey&&!event.metaKey)return;
        event.preventDefault();const r=scroller.getBoundingClientRect();
        zoom(camera*Math.exp(-event.deltaY*.004),{x:event.clientX-r.left,y:event.clientY-r.top});
      },{passive:false});
      topology.addEventListener('click',event=>{
        const button=event.target.closest('button');if(!button)return;
        if(button.hasAttribute('data-topology-current')){panel.hidden=true;pinned=null;trace(null);focusCurrent();}
        else if(button.hasAttribute('data-topology-zoom')){
          const action=button.dataset.topologyZoom;
          if(action==='fit'||action==='overview')fit(action==='overview');else {
            const next=Math.min(2,Math.max(.02,camera*(action==='in'?1.2:1/1.2)));
            moveCamera(next,(scroller.scrollLeft+scroller.clientWidth/2)*next/camera-scroller.clientWidth/2,(scroller.scrollTop+scroller.clientHeight/2)*next/camera-scroller.clientHeight/2);
          }
        }else if(button.hasAttribute('data-topology-wire-toggle')){allLinks=!allLinks;render({geometry:false});}
        else if(button.hasAttribute('data-topology-group-toggle')){expanded=expanded.size?new Set():new Set(layout.groups.map(g=>g.id));panel.hidden=true;render();fit(true);}
        else if(button.hasAttribute('data-topology-stable-toggle')){
          topology.classList.toggle('is-focusing-open-work');
          panel.hidden=true;pinned=null;hovered=null;render();fit(true);
        }
      });
      topology.addEventListener('click',async event=>{
        const button=event.target.closest('[data-topology-export]');if(!button||exporting)return;
        const status=topology.querySelector('[data-export-status]'),buttons=[...topology.querySelectorAll('[data-topology-export]')];
        exporting=true;buttons.forEach(b=>b.disabled=true);button.setAttribute('aria-busy','true');status.textContent='正在生成完整拓扑快照…';
        try {
          const result=await TrackerExport.download(button.dataset.topologyExport,{topology,svg,layout,model,selected:pinned,allLinks,expanded});
          status.textContent=`已发起下载 · ${button.dataset.topologyExport==='png'?`PNG · ${result.width} × ${result.height}`:'SVG 矢量图'}`;
          status.title=result.filename;
        } catch(error) {status.textContent=`导出失败：${error.message}。可重试或选择 SVG。`;}
        finally {exporting=false;buttons.forEach(b=>b.disabled=false);button.removeAttribute('aria-busy');}
      });
      topology.querySelector('[data-topology-search]').addEventListener('keydown',event=>{
        if(event.key!=='Enter')return;event.preventDefault();
        const query=event.target.value.trim().toLocaleLowerCase();if(!query)return;
        const task=model.nodes.find(n=>n.id.toLowerCase()===query)||model.nodes.find(n=>(n.id+' '+n.title).toLocaleLowerCase().includes(query));
        if(!task){inspector.textContent='没有找到匹配的任务';return;}
        if(!layout.owner.has(task.id)&&topology.classList.contains('is-focusing-open-work')) {
          topology.classList.remove('is-focusing-open-work');panel.hidden=true;render();
        }
        const owner=layout.owner.get(task.id),node=layout.nodes.find(n=>n.id===owner);
        moveCamera(1,node.x-node.width/2-36,node.y-node.height/2-56);
        const source=document.getElementById(`${topology.dataset.featureId}-task-${task.id}`);if(source)inspectTask(source);
        trace(owner);
      });
      scroller.addEventListener('scroll',miniViewport,{passive:true});
      const resizeObserver=new ResizeObserver(miniViewport);resizeObserver.observe(scroller);
      mini.addEventListener('click',event=>{
        const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(mini.getScreenCTM().inverse());
        moveCamera(camera,point.x*camera-scroller.clientWidth/2,point.y*camera-scroller.clientHeight/2);
      });
      mini.addEventListener('keydown',event=>{
        const delta={ArrowLeft:[-.6,0],ArrowRight:[.6,0],ArrowUp:[0,-.6],ArrowDown:[0,.6]}[event.key];
        if(!delta)return;event.preventDefault();moveCamera(camera,scroller.scrollLeft+delta[0]*scroller.clientWidth,scroller.scrollTop+delta[1]*scroller.clientHeight);
      });
      topology.querySelector('[data-minimap-toggle]').addEventListener('click',event=>{
        mini.hidden=!mini.hidden;mini.style.display=mini.hidden?'none':'';event.currentTarget.setAttribute('aria-expanded',String(!mini.hidden));event.currentTarget.textContent=mini.hidden?'+':'−';
      });
      render({initial:true});
      controllers.set(topology,{
        fit, inspectTask, update(next){
          if(topology.dataset.graphSignature===next.dataset.graphSignature)return;
          for(const selector of ['[data-topology-model]','[data-topology-cards]','.task-topology-legend'])topology.querySelector(selector).replaceWith(next.querySelector(selector));
          topology.dataset.graphSignature=next.dataset.graphSignature;render({geometry:true});
          topology.dataset.featureTitle=next.dataset.featureTitle;topology.dataset.planRevision=next.dataset.planRevision;
        },snapshot:()=>({zoom:camera,left:scroller.scrollLeft,top:scroller.scrollTop}),
        restore(view){if(cameraFrame)return;zoom(view.zoom,{x:0,y:0});scroller.scrollLeft=view.left;scroller.scrollTop=view.top;},
        dispose(){cancelCamera();clearTimeout(hoverTimer);resizeObserver.disconnect();controllers.delete(topology);}
      });
    });
  }
  window.__bagakitBindTopologyControls=bind;
  window.__bagakitFitTopology=(topology,all)=>controllers.get(topology)?.fit(all);
  window.__bagakitSyncTopology=(current,next)=>controllers.get(current)?.update(next);
  window.__bagakitInspectTask=(topology,source)=>controllers.get(topology)?.inspectTask(source);
  window.__bagakitDisposeTopology=root=>root.querySelectorAll('.task-topology').forEach(t=>controllers.get(t)?.dispose());
  window.__bagakitTopologyViews={get:topology=>controllers.get(topology)?.snapshot(),restore:(topology,view)=>controllers.get(topology)?.restore(view)};
  bind();
})();
