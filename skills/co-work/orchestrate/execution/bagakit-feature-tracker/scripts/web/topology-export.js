/* Portable, read-only artifacts from the visible graph. No server writes. */
globalThis.TrackerExport = (() => {
  const NS='http://www.w3.org/2000/svg';
  const properties=['fill','fill-opacity','stroke','stroke-opacity','stroke-width','stroke-linecap','stroke-linejoin',
    'stroke-dasharray','stroke-dashoffset','opacity','font-family','font-size','font-weight','font-style',
    'font-variant','letter-spacing','text-anchor','dominant-baseline','paint-order','vector-effect'];
  function element(name,attrs={},text) {
    const node=document.createElementNS(NS,name);
    for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));
    if(text!==undefined)node.textContent=text;
    return node;
  }
  function snapshot({topology,svg,layout,model,selected,allLinks,expanded}) {
    const capturedAt=new Date().toISOString();
    const palette=getComputedStyle(document.documentElement);
    const color=name=>palette.getPropertyValue(name).trim();
    const metadata={schema:'bagakit.feature-topology-export.v1',featureId:topology.dataset.featureId,
      title:topology.dataset.featureTitle,planRevision:topology.dataset.planRevision,
      graphRevision:topology.dataset.graphSignature,capturedAt,theme:document.documentElement.dataset.theme||'light',scope:'full-current-graph',
      selected,allLinks,expandedGroups:[...expanded],focusOpen:topology.classList.contains('is-focusing-open-work'),
      taskCount:model.nodes.length,declaredEdges:model.edges.length,visibleNodes:layout.nodes.length,visiblePaths:layout.edges.length};
    const clone=svg.cloneNode(true), originals=[svg,...svg.querySelectorAll('*')], copies=[clone,...clone.querySelectorAll('*')];
    originals.forEach((source,index)=>{
      const target=copies[index],style=getComputedStyle(source);
      target.removeAttribute('style');
      for(const property of properties)target.style.setProperty(property,style.getPropertyValue(property));
      // Preserve final layout coordinates, not a mid-transition CSS transform.
      target.style.animation='none';target.style.transition='none';
      for(const attr of [...target.attributes])if(attr.name.startsWith('on'))target.removeAttribute(attr.name);
      target.removeAttribute('href');target.removeAttributeNS('http://www.w3.org/1999/xlink','href');
    });
    clone.querySelectorAll('.edge-hit-target,animate,animateMotion,animateTransform,script').forEach(n=>n.remove());
    clone.removeAttribute('class');clone.setAttribute('x','24');clone.setAttribute('y','104');
    clone.setAttribute('width',layout.width);clone.setAttribute('height',layout.height);
    // Full-graph dimensions are independent of the current camera/zoom.
    const width=Math.max(720,layout.width+48),height=layout.height+128;
    const root=element('svg',{xmlns:NS,width,height,viewBox:`0 0 ${width} ${height}`,role:'img'});
    root.append(element('title',{},`${metadata.title} · ${metadata.featureId}`),element('metadata',{},JSON.stringify(metadata)),
      element('rect',{width,height,fill:getComputedStyle(topology.querySelector('.task-topology-scroll')).backgroundColor}),
      element('rect',{width,height:88,fill:color('--canvas')}));
    const title=element('text',{x:24,y:33,fill:color('--ink'),'font-family':'system-ui,sans-serif','font-size':22,'font-weight':650},metadata.title||metadata.featureId);
    // Export headers must remain readable even for a narrow one-node graph.
    const measuring=document.createElement('canvas').getContext('2d');measuring.font='650 22px system-ui';
    let text=title.textContent;
    while(text.length&&measuring.measureText(text+'…').width>width-48)text=text.slice(0,-1);
    if(text!==title.textContent)title.textContent=text+'…';
    root.append(title,element('text',{x:24,y:57,fill:color('--muted'),'font-family':'system-ui,sans-serif','font-size':12},
      `${metadata.featureId} · plan r${metadata.planRevision} · ${metadata.taskCount} Tasks · ${metadata.visibleNodes} nodes / ${metadata.visiblePaths} paths`),
      element('text',{x:24,y:76,fill:color('--muted'),'font-family':'system-ui,sans-serif','font-size':11},
        `${capturedAt} · ${allLinks?'all declared links':'reduced links'} · ${selected?'selected path':'no selected path'} · snapshot ${metadata.graphRevision}`),clone);
    const blob=new Blob([new XMLSerializer().serializeToString(root)],{type:'image/svg+xml;charset=utf-8'});
    return {blob,width,height,metadata};
  }
  function rasterSize(width,height) {
    // Bound allocation to 32 MP and 8192px per side; SVG remains lossless.
    const scale=Math.min(2,8192/width,8192/height,Math.sqrt(32000000/(width*height)));
    return {width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale)),scale};
  }
  async function png(artifact) {
    const size=rasterSize(artifact.width,artifact.height),url=URL.createObjectURL(artifact.blob);
    try {
      const image=new Image();
      await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('无法渲染 SVG 快照'));image.src=url;});
      const canvas=document.createElement('canvas');canvas.width=size.width;canvas.height=size.height;
      const context=canvas.getContext('2d');if(!context)throw new Error('浏览器无法分配画布');
      context.drawImage(image,0,0,size.width,size.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      canvas.width=canvas.height=1;
      if(!blob)throw new Error('PNG 编码失败，请使用 SVG 导出');
      return {blob,...size};
    } finally {URL.revokeObjectURL(url);}
  }
  async function download(kind,context) {
    const artifact=snapshot(context); // Freeze before awaiting PNG encoding.
    const result=kind==='png'?await png(artifact):artifact;
    const filename=`${artifact.metadata.featureId}-r${artifact.metadata.planRevision}-${artifact.metadata.capturedAt.replace(/[:.]/g,'-')}.${kind}`;
    const url=URL.createObjectURL(result.blob),link=document.createElement('a');
    link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();
    // Keep the object URL alive until the browser has consumed the download.
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    return {filename,width:result.width,height:result.height};
  }
  return {snapshot,png,rasterSize,download};
})();
