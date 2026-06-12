// Geometry and reachability oracle over the exact offline browser engine.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname,'../../../../../..');
const web = path.join(root,'skills/co-work/orchestrate/execution/bagakit-feature-tracker/scripts/web');
const context = {structuredClone}; vm.createContext(context);
for (const file of ['vendor/dagre.min.js','topology-layout.js','topology-export.js']) vm.runInContext(fs.readFileSync(path.join(web,file),'utf8'),context);
for(const [width,height] of [[720,400],[4380,3030],[50000,90000]]) {
  const raster=context.TrackerExport.rasterSize(width,height);
  assert.ok(raster.width<=8192&&raster.height<=8192&&raster.width*raster.height<=32000000);
  assert.ok(raster.width>0&&raster.height>0);
  if(width===720){assert.equal(raster.width,1440);assert.equal(raster.height,800);}
}
const project = model => context.TrackerLayout.project(model);
function verify(model, options = {}) {
  const result=context.TrackerLayout.project(model,options);
  const visible=model.nodes.filter(n=>!options.focusOpen||!['done','cancelled','transferred'].includes(n.status));
  const visibleIds=new Set(visible.map(n=>n.id));
  assert.equal(result.nodes.flatMap(n=>n.members).length,visible.length);
  assert.equal(new Set(result.nodes.flatMap(n=>n.members.map(m=>m.id))).size,visible.length);
  for(const a of result.nodes)for(const b of result.nodes)if(a.id<b.id)
    assert.ok(Math.abs(a.x-b.x)>=(a.width+b.width)/2 || Math.abs(a.y-b.y)>=(a.height+b.height)/2,`overlap: ${a.id} / ${b.id}`);
  for(const edge of result.edges)for(let i=1;i<edge.points.length;i++) {
    const a=edge.points[i-1],b=edge.points[i];
    for(const node of result.nodes) {
      if(node.id===edge.from||node.id===edge.to)continue;
      // Sample the segment at <= 2px spacing against the interior of cards.
      const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/2));
      for(let j=0;j<=steps;j++) {
        const x=a.x+(b.x-a.x)*j/steps,y=a.y+(b.y-a.y)*j/steps;
        assert.ok(Math.abs(x-node.x)>=node.width/2-1 || Math.abs(y-node.y)>=node.height/2-1,`edge ${edge.from}>${edge.to} through ${node.id}: ${JSON.stringify({a,b,node})}`);
      }
    }
  }
  const full=context.TrackerLayout.project(model,{...options,allLinks:true});
  assert.equal(full.edges.flatMap(e=>e.members).length,model.edges.filter(e=>visibleIds.has(e.from)&&visibleIds.has(e.to)).length);
  assert.equal(JSON.stringify(full.nodes),JSON.stringify(result.nodes),'link visibility moved cards');
  const reach=(start,edges)=>{const seen=new Set(),todo=[start];while(todo.length){const id=todo.pop();edges.filter(e=>e.from===id).forEach(e=>{if(!seen.has(e.to)){seen.add(e.to);todo.push(e.to);}});}return [...seen].sort();};
  for(const n of result.nodes)assert.deepEqual(reach(n.id,full.edges),reach(n.id,result.edges),'lost reachability');
  assert.equal(JSON.stringify(context.TrackerLayout.project(model,options)),JSON.stringify(result),'unstable layout');
  return result;
}
const diamond={nodes:['A','B','C','D'].map((id,i)=>({id,wave:`W${i}`})),edges:[{from:'A',to:'B'},{from:'A',to:'C'},{from:'B',to:'D'},{from:'C',to:'D'},{from:'A',to:'D'}]};
assert.equal(verify(diamond).hiddenEdges,1);
// Reachability is iterative, so a long valid chain stays safe without making
// the oracle depend on an unbounded layout fixture.
const deepNodes=Array.from({length:1600},(_,i)=>({id:`D-${String(i+1).padStart(4,'0')}`,wave:`W${i}`,status:'todo'}));
const deepEdges=deepNodes.slice(1).map((node,index)=>({from:deepNodes[index].id,to:node.id}));
const deepResult=project({nodes:deepNodes,edges:deepEdges});
assert.equal(deepResult.nodes.length,deepNodes.length);
assert.equal(deepResult.edges.length,deepEdges.length);
assert.equal(deepResult.hiddenEdges,0);
const nodes=Array.from({length:120},(_,i)=>({id:`T-${String(i+1).padStart(3,'0')}`,wave:`W${Math.floor(i/30)+1}`}));
const edges=[];
for(let i=30;i<120;i++)for(let j=0;j<i;j++)if(Math.floor(j/30)<Math.floor(i/30)&&j%5===i%5)edges.push({from:nodes[j].id,to:nodes[i].id});
const start=performance.now(), result=verify({nodes,edges});
assert.equal(result.nodes.length,20);
assert.equal(result.edges.length,15);
assert.ok(result.width<1600&&result.height<1300,'dense view is not bounded');
// Mixed-size groups and individual Tasks must have true card clearance,
// including edge endpoints on the smaller cards after one group expands.
const mixed=verify({nodes,edges},{expanded:new Set([result.groups[0].id])});
assert.ok(mixed.nodes.some(n=>n.group)&&mixed.nodes.some(n=>!n.group));
const byId=new Map(mixed.nodes.map(n=>[n.id,n]));
for(const edge of mixed.edges) {
  assert.equal(edge.points[0].x,byId.get(edge.from).x+byId.get(edge.from).width/2);
  assert.equal(edge.points.at(-1).x,byId.get(edge.to).x-byId.get(edge.to).width/2);
}
const summary=context.TrackerLayout.summarize([
  {id:'A',status:'done'}, {id:'B',status:'active',activity:true},
  {id:'C',status:'blocked'}, {id:'D',status:'failed'},
  {id:'E',status:'cancelled'}, {id:'F',status:'transferred'},
  {id:'G',status:'runnable'}, {id:'H',status:'waiting'},
  {id:'I',status:'done',activity:true},
]);
assert.equal(summary.done,2); assert.equal(summary.total,9);
assert.equal(summary.completion,2/9); assert.equal(summary.activity,1);
assert.equal(summary.attention.map(n=>n.id).join(','),'D,C');
assert.equal(Object.values(summary.counts).reduce((a,b)=>a+b),9);
const ungrouped={nodes:nodes.slice(0,48),edges:[]};
for(let i=6;i<48;i++) {ungrouped.edges.push({from:nodes[i-6].id,to:nodes[i].id});if(i>13&&i%3===0)ungrouped.edges.push({from:nodes[i-13].id,to:nodes[i].id});}
verify(ungrouped);
console.log(`ok: Dagre geometry, reachability, stable toggle, 120 Tasks / ${edges.length} dependencies → 20 nodes / 15 paths (${Math.round(performance.now()-start)}ms)`);

// Focus is a member-level projection: expansion order cannot leave completed
// members behind or change a group's identity when its first member is hidden.
const focusModel={nodes:Array.from({length:30},(_,i)=>({id:`F-${String(i).padStart(2,'0')}`,wave:'W01',status:['done','active','waiting','failed','blocked','cancelled','transferred'][i%7]})),edges:[]};
const original=JSON.stringify(focusModel),whole=verify(focusModel);
const focused=verify(focusModel,{focusOpen:true});
assert.equal(focused.groups[0].id,whole.groups[0].id);
const expanded=new Set([whole.groups[0].id]);
const openExpanded=verify(focusModel,{focusOpen:true,expanded});
assert.ok(openExpanded.nodes.every(n=>!n.group&&!['done','cancelled','transferred'].includes(n.status)));
assert.ok(openExpanded.nodes.some(n=>n.status==='waiting')&&openExpanded.nodes.some(n=>n.status==='failed')&&openExpanded.nodes.some(n=>n.status==='blocked'));
assert.equal(focused.hiddenTasks,focusModel.nodes.length-openExpanded.nodes.length);
assert.equal(verify(focusModel,{expanded}).nodes.length,30);
assert.equal(JSON.stringify(focusModel),original,'focus mutated planning truth');
const hiddenBridge={nodes:[{id:'A',status:'active',wave:'W01'},{id:'B',status:'done',wave:'W02'},{id:'C',status:'waiting',wave:'W03'}],edges:[{from:'A',to:'B'},{from:'B',to:'C'},{from:'A',to:'C'}]};
assert.equal(verify(hiddenBridge,{focusOpen:true}).edges.length,1,'hidden intermediate suppressed a visible direct dependency');
const closed=verify({nodes:[{id:'D',status:'done'}],edges:[]},{focusOpen:true});
assert.equal(closed.nodes.length,0);assert.ok(Number.isFinite(closed.width)&&closed.width>0&&closed.height>0);
console.log('ok: open-work filtering commutes with group expansion, preserves exceptions and restores full history');
