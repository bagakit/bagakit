/* Read-only DAG projection. Dagre owns geometry; Tracker owns task truth. */
globalThis.TrackerLayout = (() => {
  const width = 272, height = 140;
  const groupWidth = 288, groupHeight = 212;
  const statusLabels = {done:'完成', active:'进行', runnable:'可领', waiting:'等待', failed:'失败', blocked:'阻塞', cancelled:'取消', transferred:'转交'};
  function summarize(members) {
    const counts=Object.fromEntries(Object.keys(statusLabels).map(status=>[status,0]));
    for(const member of members)counts[member.status]=(counts[member.status]||0)+1;
    const attention=members.filter(n=>n.status==='failed'||n.status==='blocked').sort((a,b)=>
      (a.status==='failed'?0:1)-(b.status==='failed'?0:1)||a.id.localeCompare(b.id));
    return {total:members.length,done:counts.done,counts,attention,
      completion:members.length?counts.done/members.length:0,
      activity:members.filter(n=>n.status==='active'&&n.activity===true).length};
  }
  function project(model, {expanded = new Set(), allLinks = false, focusOpen = false} = {}) {
    const incoming = new Map(model.nodes.map(n => [n.id, []]));
    const outgoing = new Map(model.nodes.map(n => [n.id, []]));
    model.edges.forEach(e => { incoming.get(e.to).push(e.from); outgoing.get(e.from).push(e.to); });
    const visible=new Set(model.nodes.filter(n=>!focusOpen||!['done','cancelled','transferred'].includes(n.status)).map(n=>n.id));
    const routingOutgoing=new Map([...outgoing].map(([id,children])=>[id,visible.has(id)?children.filter(child=>visible.has(child)):[]]));
    // A declared edge is visually redundant only if another directed path
    // already reaches the same target. Keep the original edges in the model.
    // Compute transitive reachability in dependency order.  The old recursive
    // DFS overflowed the browser stack on a long, valid Task chain; the
    // iterative Kahn pass keeps the projection bounded by the graph itself.
    const descendants = new Map(model.nodes.map(n => [n.id, new Set()]));
    const indegree = new Map(model.nodes.map(n => [n.id, 0]));
    for (const [id, children] of routingOutgoing) {
      for (const child of children) indegree.set(child, indegree.get(child) + 1);
    }
    const ready = [...indegree].filter(([, degree]) => degree === 0).map(([id]) => id).sort();
    const topological = [];
    while (ready.length) {
      const id = ready.shift();
      topological.push(id);
      for (const child of routingOutgoing.get(id)) {
        indegree.set(child, indegree.get(child) - 1);
        if (indegree.get(child) === 0) {
          ready.push(child);
          ready.sort();
        }
      }
    }
    // A malformed cyclic model is handled by the renderer's explicit error
    // projection.  Keep the fallback finite so diagnostics never recurse.
    if (topological.length !== model.nodes.length) {
      for (const node of model.nodes) {
        const seen = new Set(), queue = [...(routingOutgoing.get(node.id) || [])];
        while (queue.length) {
          const next = queue.shift();
          if (seen.has(next)) continue;
          seen.add(next);
          queue.push(...(routingOutgoing.get(next) || []));
        }
        descendants.set(node.id, seen);
      }
    } else {
      for (let index = topological.length - 1; index >= 0; index--) {
        const id = topological[index], result = descendants.get(id);
        for (const child of routingOutgoing.get(id)) {
          result.add(child);
          for (const descendant of descendants.get(child)) result.add(descendant);
        }
      }
    }
    const redundant = new Set(model.edges.filter(e => routingOutgoing.get(e.from).some(
      other => other !== e.to && descendants.get(other).has(e.to)
    )).map(e => e.from + '>' + e.to));
    const buckets = new Map();
    for (const n of model.nodes) {
      const key = JSON.stringify([incoming.get(n.id).slice().sort(), outgoing.get(n.id).slice().sort(), n.wave]);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(n);
    }
    const nodes = [], owner = new Map(), groups = [];
    for (const bucket of buckets.values()) {
      bucket.sort((a,b) => a.id.localeCompare(b.id));
      const members=bucket.filter(n=>visible.has(n.id));
      if(!members.length)continue;
      // Expansion identity belongs to the full group, even when its first member is hidden.
      const id = 'parallel:' + bucket[0].id;
      const groupable = model.nodes.length > 24 && members.length >= 3;
      if (groupable) groups.push({id, members});
      if (groupable && !expanded.has(id)) {
        nodes.push({id, members, wave:members[0].wave, group:true, width:groupWidth, height:groupHeight, summary:summarize(members),
          prerequisiteCount:incoming.get(members[0].id).length, dependentCount:outgoing.get(members[0].id).length});
        members.forEach(n => owner.set(n.id, id));
      } else {
        members.forEach(n => { nodes.push({...n, members:[n], width, height}); owner.set(n.id, n.id); });
      }
    }
    const links = new Map();
    for (const e of model.edges) {
      if(!owner.has(e.from)||!owner.has(e.to))continue;
      const from = owner.get(e.from), to = owner.get(e.to), key = from + '>' + to;
      if (!links.has(key)) links.set(key, {from, to, key, members:[], essential:false, activity:false, critical:false});
      const link = links.get(key);
      link.members.push(e);
      link.essential ||= !redundant.has(e.from + '>' + e.to);
      link.activity ||= e.activity;
      link.critical ||= e.critical;
    }
    // Geometry depends on the reduced graph. Revealing redundant edges never
    // moves nodes or enlarges the canvas just to reserve one lane per edge.
    const g = new dagre.graphlib.Graph().setGraph({rankdir:'LR', ranksep:84, nodesep:26, edgesep:14, marginx:32, marginy:32});
    g.setDefaultEdgeLabel(() => ({}));
    nodes.sort((a,b) => a.id.localeCompare(b.id)).forEach(n => g.setNode(n.id, {width:n.width, height:n.height}));
    [...links.values()].filter(e => e.essential).sort((a,b) => a.key.localeCompare(b.key)).forEach(e => g.setEdge(e.from,e.to));
    dagre.layout(g);
    nodes.forEach(n => Object.assign(n, g.node(n.id)));
    const nodeById = new Map(nodes.map(n => [n.id,n]));
    const columns = [...new Set(nodes.map(n=>n.x))].sort((a,b)=>a-b);
    const halfWidths = columns.map(x=>Math.max(...nodes.filter(n=>n.x===x).map(n=>n.width/2)));
    const visibleLinks=[...links.values()].filter(e=>e.essential||allLinks);
    const allRoutes=[...links.values()].sort((a,b)=>a.key.localeCompare(b.key));
    const gapEdges=columns.slice(0,-1).map((x,i)=>allRoutes.filter(e=>nodeById.get(e.from).x<=x&&nodeById.get(e.to).x>=columns[i+1]));
    function freeY(x, desired) {
      const obstacles=nodes.filter(n=>n.x===x).map(n=>[n.y-n.height/2-18,n.y+n.height/2+18]);
      const candidates=[desired,...obstacles.flat()];
      return candidates.filter(y=>!obstacles.some(([lo,hi])=>y>lo&&y<hi)).sort((a,b)=>Math.abs(a-desired)-Math.abs(b-desired)||a-b)[0];
    }
    function port(id,key,side) {
      const peers=allRoutes.filter(e=>e[side]===id);
      return (peers.indexOf(peers.find(e=>e.key===key))-(peers.length-1)/2)*Math.min(10,64/Math.max(1,peers.length-1));
    }
    const edges=visibleLinks.map(e=>{
      const a=nodeById.get(e.from), b=nodeById.get(e.to);
      const from=columns.indexOf(a.x), to=columns.indexOf(b.x);
      const sourceY=a.y+port(e.from,e.key,'from'),targetY=b.y+port(e.to,e.key,'to');
      const hints=g.edge(e.from,e.to)?.points || [{x:a.x,y:a.y},{x:b.x,y:b.y}];
      const points=[{x:a.x+a.width/2,y:sourceY}];
      let y=sourceY;
      for(let rank=from;rank<to;rank++) {
        const peers=gapEdges[rank], slot=peers.findIndex(link=>link.key===e.key);
        const left=columns[rank]+halfWidths[rank],right=columns[rank+1]-halfWidths[rank+1];
        const gutter=(left+right)/2+(slot-(peers.length-1)/2)*Math.min(6,(right-left-40)/Math.max(1,peers.length-1));
        let nextY=targetY;
        if(rank+1<to) {
          const hint=hints.reduce((best,p)=>Math.abs(p.x-columns[rank+1])<Math.abs(best.x-columns[rank+1])?p:best);
          nextY=freeY(columns[rank+1],hint.y);
        }
        points.push({x:gutter,y},{x:gutter,y:nextY},{x:columns[rank+1]-(rank+1===to?b.width/2:halfWidths[rank+1]),y:nextY});
        if(rank+1<to)points.push({x:columns[rank+1]+halfWidths[rank+1],y:nextY});
        y=nextY;
      }
      return {...e,points};
    });
    return {nodes, edges, groups, owner, width:Math.max(320,g.graph().width||0), height:Math.max(180,g.graph().height||0),
      hiddenTasks:model.nodes.length-owner.size,
      hiddenEdges:[...links.values()].filter(e=>!e.essential).reduce((count,e)=>count+e.members.length,0),
      taskCount:model.nodes.length, edgeCount:model.edges.length};
  }
  function path(points) {
    // Round corners inside the engine's routing corridor; no global rails.
    if (!points.length) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i=1;i<points.length-1;i++) {
      const a=points[i-1],b=points[i],c=points[i+1];
      const before=Math.hypot(b.x-a.x,b.y-a.y), after=Math.hypot(c.x-b.x,c.y-b.y);
      const r=Math.min(10,before/3,after/3);
      if (!r) { d+=` L ${b.x} ${b.y}`; continue; }
      d+=` L ${b.x+(a.x-b.x)*r/before} ${b.y+(a.y-b.y)*r/before} Q ${b.x} ${b.y} ${b.x+(c.x-b.x)*r/after} ${b.y+(c.y-b.y)*r/after}`;
    }
    const end=points.at(-1); return d+` L ${end.x} ${end.y}`;
  }
  return {project,path,width,height,summarize,statusLabels};
})();
