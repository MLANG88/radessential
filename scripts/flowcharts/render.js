// Renders flowchart specs (flowcharts/specs/*.json) to PNG in the style of the site's incidental-finding charts.
// Usage: node flowcharts/render.js <spec.json> <out.png>
const {chromium} = require('playwright');
const fs = require('fs');
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = process.argv[3];

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#fff;font-family:Carlito,Calibri,sans-serif;color:#000}
#c{position:relative}
.n{position:absolute;box-sizing:border-box;border:2px solid #000;border-radius:10px;background:#fff;text-align:center;font-size:19px;line-height:1.25;padding:7px 12px;max-width:var(--mw,230px)}
.n.title{font-size:25px;font-weight:700;padding:10px 26px;max-width:none;border-radius:10px}
.n.blue{background:#b4c7e7;border-radius:14px;padding:12px 14px}
.n.orange{background:#f8cbad;border-radius:14px;padding:12px 14px}
.n.red{background:#ff7c80;border-radius:14px;padding:12px 14px}
.n b{font-weight:700}
.n ul{margin:4px 0 0;padding-left:18px;text-align:left}
.note{position:absolute;font-size:17px;line-height:1.3;max-width:520px}
.cite{position:absolute;font-size:16px;line-height:1.3;max-width:720px;color:#111}
svg{position:absolute;left:0;top:0;overflow:visible}
</style></head><body><div id="c"></div><script>
const spec=${JSON.stringify(spec)};
const C=document.getElementById('c');
let id=0;const nodes=[];
function make(n,depth,parent){n.id=id++;n.depth=depth;n.parent=parent;nodes.push(n);
  const d=document.createElement('div');d.className='n '+(n.k||'');d.innerHTML=n.t;if(n.w)d.style.setProperty('--mw',n.w+'px');C.appendChild(d);n.el=d;
  (n.c||[]).forEach(ch=>make(ch,depth+1,n));}
make(spec.tree,0,null);
nodes.forEach(n=>{const r=n.el.getBoundingClientRect();n.W=r.width;n.H=r.height});
const GAP=spec.gap||26, VG=spec.vgap||62;
// leaves = outcome boxes; push them to the bottom row when spec.leafRow
function width(n){if(!n.c||!n.c.length)return n.sw=n.W;let s=0;n.c.forEach((c,i)=>{s+=width(c)+(i?GAP:0)});return n.sw=Math.max(s,n.W)}
width(spec.tree);
const maxDepth=Math.max(...nodes.map(n=>n.depth));
const leaf=n=>!n.c||!n.c.length;
nodes.forEach(n=>{if(leaf(n)&&spec.leafRow&&n.k&&n.k!=='q')n.row=maxDepth;else n.row=n.depth});
const rowH=[];nodes.forEach(n=>{rowH[n.row]=Math.max(rowH[n.row]||0,n.H)});
const rowY=[];let y=20;for(let i=0;i<rowH.length;i++){rowY[i]=y;y+=(rowH[i]||0)+VG}
function place(n,x0){n.x=x0+(n.sw-n.W)/2;if(n.c&&n.c.length){let tot=n.c.reduce((s,c,i)=>s+c.sw+(i?GAP:0),0),x=x0+(n.sw-tot)/2;n.c.forEach(c=>{place(c,x);x+=c.sw+GAP});
  const f=n.c[0],l=n.c[n.c.length-1];n.x=(f.x+f.W/2+l.x+l.W/2)/2-n.W/2}}
place(spec.tree,30);
{const mn=Math.min(...nodes.map(n=>n.x));if(mn<30)nodes.forEach(n=>n.x+=30-mn)}
nodes.forEach(n=>{n.y=rowY[n.row]+(n.k==='title'?0:0);n.el.style.left=n.x+'px';n.el.style.top=n.y+'px'});
let W=Math.max(...nodes.map(n=>n.x+n.W))+30,H=Math.max(...nodes.map(n=>n.y+n.H))+20;
const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
let p='';
nodes.forEach(n=>{if(!n.c||!n.c.length)return;const px=n.x+n.W/2,py=n.y+n.H;
  const ys=n.c.map(c=>c.y);const mid=py+Math.min(VG*0.5, (Math.min(...ys)-py)/2);
  p+=\`M\${px} \${py}V\${mid}\`;
  n.c.forEach(c=>{const cx=c.x+c.W/2;p+=\`M\${px} \${mid}H\${cx}V\${c.y-2}\`;})});
svg.innerHTML='<defs><marker id="a" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L8,4 L0,8 z" fill="#000"/></marker></defs>';
// draw each child arrow separately so every one gets an arrowhead
nodes.forEach(n=>{if(!n.c||!n.c.length)return;const px=n.x+n.W/2,py=n.y+n.H;const mid=py+Math.min(VG*0.5,(Math.min(...n.c.map(c=>c.y))-py)/2);
  n.c.forEach(c=>{const cx=c.x+c.W/2;const e=document.createElementNS('http://www.w3.org/2000/svg','path');e.setAttribute('d',\`M\${px} \${py}V\${mid}H\${cx}V\${c.y-3}\`);e.setAttribute('fill','none');e.setAttribute('stroke','#000');e.setAttribute('stroke-width','2');e.setAttribute('marker-end','url(#a)');svg.appendChild(e)})});
C.appendChild(svg);
// notes and citation under the chart
let by=H+10;
if(spec.note){const d=document.createElement('div');d.className='note';d.innerHTML=spec.note;d.style.left='30px';d.style.top=by+'px';d.style.maxWidth=Math.max(520,W*0.5)+'px';C.appendChild(d);var nh=d.getBoundingClientRect().height}
const c=document.createElement('div');c.className='cite';c.innerHTML='Adapted from '+spec.cite;C.appendChild(c);
const cw=Math.min(720,W*0.45);c.style.maxWidth=cw+'px';const cr=c.getBoundingClientRect();
const noteRight=spec.note?30+document.querySelector('.note').getBoundingClientRect().width:0;
const sideBySide=!spec.note||noteRight+30<W-cr.width-30;
c.style.left=(W-cr.width-30)+'px';c.style.top=(sideBySide?by+(spec.note?Math.max(0,(nh||0)-cr.height):0)+10:by+(nh||0)+16)+'px';
H=Math.max(by+(nh||0),parseFloat(c.style.top)+cr.height)+30;
svg.setAttribute('width',W);svg.setAttribute('height',H);
C.style.width=W+'px';C.style.height=H+'px';
window.__size=[W,H];
</script></body></html>`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({deviceScaleFactor: 1});
  await p.setContent(html);
  await p.evaluate(() => document.fonts.ready);
  const [W, H] = await p.evaluate(() => window.__size);
  await p.setViewportSize({width: Math.ceil(W), height: Math.ceil(H)});
  await p.screenshot({path: out, clip: {x: 0, y: 0, width: Math.ceil(W), height: Math.ceil(H)}});
  console.log(out, Math.ceil(W), Math.ceil(H));
  await b.close();
})();
