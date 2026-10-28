/* ---------- helpers ---------- */
const T=(head,rows,cls)=>`<div class="tw"><table${cls?` class="${cls}"`:''}><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((c,i)=>i===0?`<td class="k">${c}</td>`:`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const B=(t,c)=>`<span class="b ${c||'info'}">${t}</span>`;
const P=a=>`<ul class="pearls">${a.map(x=>`<li>${x}</li>`).join('')}</ul>`;
const N=t=>`<div class="note">${t}</div>`;
const num=v=>{const n=parseFloat(v);return isFinite(n)?n:null};
const fmt=(n,d=1)=>n==null||!isFinite(n)?'–':(+n.toFixed(d)).toString();

/* ---------- decision trees ---------- */
const Q=(q,...o)=>({q,o});
const O=(label,next)=>[label,next];
const R=(r,l)=>({r,l:l||'ok'});
const LV={ok:'No follow-up',warn:'Further imaging',crit:'Refer / tissue / act'};
const TREE_UI=id=>`<div class="tree" data-tree="${id}"></div>`;
const FIGL=(label,...items)=>`<details class="figs" open><summary>${label}${items.length>1?'s':''} · click to enlarge</summary><div class="figrow${items.some(([n])=>n.endsWith('.svg'))?' stack':''}" data-lbgroup>${items.map(([n,c])=>`<figure class="fig"><button type="button" data-lb="img/${n.includes('.')?n:n+'.webp'}" data-cap="${c}" aria-label="Enlarge: ${c}"><img src="img/${n.includes('.')?n:n+'.webp'}" alt="${c}" loading="lazy"></button><figcaption>${c}</figcaption></figure>`).join('')}</div></details>`;
const FIGS=(...items)=>FIGL('Flowchart',...items);
const ILLUS=(...items)=>FIGL('Figure',...items);
function mountTree(el,tree){
  let path=[],full=false;
  const walk=()=>{let n=tree;const steps=[];for(const i of path){steps.push({q:n.q,a:n.o[i][0]});n=n.o[i][1]}return{n,steps}};
  const outline=n=>`<ul>${n.o.map(([a,c])=>`<li><span class="ol-a">${a}</span>${c.r?`<div class="ol-r ${c.l}">${c.r}</div>`:`<div class="ol-q">${c.q}</div>${outline(c)}`}</li>`).join('')}</ul>`;
  const draw=()=>{
    const{n,steps}=walk();
    let h=steps.length?`<ol class="trail">${steps.map((s,i)=>`<li><button type="button" data-back="${i}"><span>${s.q}</span><b>${s.a}</b></button></li>`).join('')}</ol>`:'';
    if(n.r)h+=`<div class="res ${n.l}"><span class="lbl">${LV[n.l]}</span><p>${n.r}</p></div>`;
    else h+=`<div class="ask"><div class="qq">${n.q}</div><div class="opts">${n.o.map((o,i)=>`<button type="button" data-opt="${i}">${o[0]}</button>`).join('')}</div></div>`;
    h+=`<div class="tacts">${steps.length?`<button type="button" data-act="reset">Start over</button>`:''}<button type="button" data-act="full" aria-expanded="${full}">${full?'Hide full chart':'Show full chart'}</button></div>`;
    if(full)h+=`<div class="outline"><div class="ol-q root">${tree.q}</div>${outline(tree)}</div>`;
    el.innerHTML=h;
  };
  el.addEventListener('click',ev=>{const b=ev.target.closest('button');if(!b)return;
    if(b.dataset.opt!=null)path.push(+b.dataset.opt);
    else if(b.dataset.back!=null)path=path.slice(0,+b.dataset.back);
    else if(b.dataset.act==='reset')path=[];
    else if(b.dataset.act==='full')full=!full;
    draw();});
  draw();
}
const MRI_CT='Indeterminate: MRI with and without contrast (preferred), or CT with and without contrast';
const TSTC=Q('Subjective impression?',O('Favors a benign cyst',R('Likely benign cyst; no further workup','ok')),O('Inconclusive on subjective evaluation',R(MRI_CT+' in 6–12 months','warn')));
const TREES={
 renal:Q('Which scenario?',
  O('Mass contains macroscopic fat',Q('Calcification present?',
    O('No calcification: angiomyolipoma',Q('Solitary or multiple?',
      O('Solitary, no documented growth',Q('Size or symptoms?',O('&lt;4 cm',R('No further workup','ok')),O('≥4 cm or clinical symptoms',R('Refer for management','crit')))),
      O('Multiple, or documented growth',R('Refer for management','crit')))),
    O('Calcification present: suspicious for RCC',R('CT or MRI with and without contrast; refer for management','crit')))),
  O('Non-contrast CT',Q('Appearance?',
    O('Too small to characterize',TSTC),
    O('Homogeneous: thin or imperceptible wall, no mural nodule, septa or calcification',Q('Attenuation?',
      O('−10 to 20 HU',R('Likely benign cyst; no further workup','ok')),
      O('21–69 HU',R(MRI_CT,'warn')),
      O('≥70 HU',R('Likely hemorrhagic or proteinaceous cyst; unlikely neoplastic. No further workup','ok')))),
    O('Heterogeneous: thick or irregular wall, mural nodule, septa or calcification',R(MRI_CT,'warn')))),
  O('Contrast-enhanced CT',Q('Appearance?',
    O('Too small to characterize',TSTC),
    O('Homogeneous: thin or imperceptible wall, no mural nodule, septa or calcification',Q('Attenuation?',
      O('−10 to 20 HU',R('Likely benign cyst; no further workup','ok')),
      O('&gt;20 HU: solid or complicated cystic mass',R('Indeterminate: MRI or CT with and without contrast','warn')))),
    O('Heterogeneous: thick or irregular wall, mural nodule, septa or calcification',R('Indeterminate: MRI or CT with and without contrast','warn'))))),
 thyroid:Q('Suspicious features? Abnormal lymph nodes, local invasion, or FDG avidity',
  O('Yes',R('Thyroid ultrasound','warn')),
  O('No',Q('Limited life expectancy or serious comorbidities?',
    O('Yes',R('No further evaluation','ok')),
    O('No',Q('Patient age?',
      O('&lt;35 years',Q('Size (longest axial dimension)?',O('&lt;1 cm',R('No further evaluation','ok')),O('≥1 cm',R('Thyroid ultrasound','warn')))),
      O('≥35 years',Q('Size (longest axial dimension)?',O('&lt;1.5 cm',R('No further evaluation','ok')),O('≥1.5 cm',R('Thyroid ultrasound','warn'))))))))),
 adnexal:Q('Menopausal status? (simple-appearing, asymptomatic cyst)',
  O('Premenopausal',Q('Maximum diameter?',
    O('≤3 cm',R('No follow-up. Normal follicle','ok')),
    O('&gt;3 to ≤5 cm',R('No follow-up; describe to document','ok')),
    O('&gt;5 cm',Q('Size and image quality?',
      O('≤7 cm and superior visualization / confidence',R('No follow-up; describe to document','ok')),
      O('&gt;7 cm, or standard visualization / confidence',R('Follow-up US: 2–6 months if early confirmation of characterization is needed, otherwise 6–12 months','warn')))))),
  O('Postmenopausal',Q('Maximum diameter?',
    O('≤1 cm',R('No follow-up','ok')),
    O('&gt;1 to ≤3 cm',R('No follow-up; describe to document','ok')),
    O('&gt;3 cm',Q('Size and image quality?',
      O('≤5 cm and superior visualization / confidence',R('No follow-up; describe to document','ok')),
      O('&gt;5 cm, or standard visualization / confidence',R('Follow-up US: 3–6 months if early confirmation of characterization is needed, otherwise 6–12 months','warn'))))))),
 liver:Q('Lesion size?',
  O('&lt;1 cm',Q('Patient risk?',O('Low risk',R('Benign; no follow-up','ok')),O('High risk',R('Follow-up MRI in 3–6 months','warn')))),
  O('1–1.5 cm',Q('Imaging features?',
    O('Benign features',R('Benign; no follow-up','ok')),
    O('Suspicious features',R('Hepatic MRI','warn')),
    O('Flash-filling',Q('Patient risk?',O('Low risk',R('Benign; no follow-up','ok')),O('High risk',R('Hepatic MRI','warn')))))),
  O('&gt;1.5 cm',Q('Imaging features?',
    O('Benign features',R('Benign; no follow-up','ok')),
    O('Suspicious features or flash-filling',Q('Patient risk?',O('Low risk',R('Hepatic MRI','warn')),O('High risk',R('Hepatic MRI or biopsy','crit'))))))),
 spleen:Q('Imaging features?',
  O('Benign features: homogeneous, &lt;20 HU, no enhancement, smooth margins (cyst, hemangioma)',R('No follow-up','ok')),
  O('Non-diagnostic',Q('Prior imaging available?',
    O('Yes',Q('Change since prior?',O('Stable ≥1 year',R('No follow-up','ok')),O('Enlarging',R('Consider PET, MRI, or biopsy','crit')))),
    O('No',Q('History of cancer?',
      O('No',Q('Features?',O('Suspicious features',R('Consider PET, MRI, or biopsy','crit')),O('Indeterminate features',R('Follow-up MRI in 6 and 12 months','warn')))),
      O('Yes',Q('Size?',O('&lt;1 cm',R('Follow-up MRI in 6 and 12 months','warn')),O('≥1 cm',R('Consider PET, MRI, or biopsy','crit'))))))))),
 adrenal:Q('Lesion size?',
  O('≤1 cm',R('No follow-up if no suspicious features','ok')),
  O('&gt;1 cm',Q('Imaging features?',
    O('Benign: water-density cyst; macroscopic fat (myelolipoma); ≤10 HU unenhanced or signal drop on opposed-phase MRI (lipid-rich adenoma); coarse, curvilinear or septal calcification',R('No follow-up needed','ok')),
    O('Indeterminate',Q('Size?',
      O('1–4 cm',Q('Prior imaging and history?',
        O('Prior imaging: stable ≥1 year',R('No follow-up needed','ok')),
        O('Prior imaging: new or enlarging',R('Adrenal CT, biopsy, or PET/CT depending on cancer history','crit')),
        O('No prior imaging, no cancer history',Q('Size?',O('1–2 cm',R('Probably benign; consider 12-month follow-up','warn')),O('&gt;2 to &lt;4 cm',R('Adrenal protocol CT','warn')))),
        O('No prior imaging, history of cancer',R('Adrenal protocol CT or MRI; consider PET/CT or biopsy (white paper; not on original chart)','crit')))),
      O('≥4 cm',R('Resection, biopsy, or PET/CT depending on cancer history','crit')))))))
};

/* ---------- sections ---------- */
const SECTIONS=[
 {id:'body',name:'Abdomen & Pelvis'},
 {id:'breast',name:'Breast'},
 {id:'calc',name:'Calculators'},
 {id:'chest',name:'Chest & Vascular'},
 {id:'hn',name:'Head & Neck'},
 {id:'incid',name:'Incidental findings'},
 {id:'msk',name:'MSK & Spine'},
 {id:'neuro',name:'Neuro'}
];

/* ---------- entries ---------- */
const E=[];
const add=o=>E.push(o);

/* ===== NEURO ===== */
add({id:'aspects',sec:'neuro',title:'ASPECTS',alias:'alberta stroke program early ct score mca infarct',ver:'Barber 2000',tags:['CT','Stroke'],
lede:'10-point topographic score for early ischemic change in the MCA territory on non-contrast CT. Start at 10 and subtract 1 for each region with early ischemic change (hypoattenuation or loss of grey–white differentiation; focal swelling alone is not scored in the original method).',
body:`<h3>Regions</h3>
${T(['Level','Regions'],[
 ['Ganglionic','C caudate · L lentiform · IC internal capsule (posterior limb) · I insular ribbon · M1 anterior MCA cortex · M2 MCA cortex lateral to insula · M3 posterior MCA cortex'],
 ['Supraganglionic','M4, M5, M6: anterior, lateral, posterior MCA territory immediately superior to M1, M2, M3 (above the basal ganglia)']])}
<div class="calc" id="c-aspects"><div class="calc-h">Score it</div><div class="asp">
<fieldset><legend>Subcortical</legend>${['C','L','IC'].map(r=>`<label><input type="checkbox" value="${r}"> ${r}</label>`).join('')}</fieldset>
<fieldset><legend>Ganglionic cortex</legend>${['I','M1','M2','M3'].map(r=>`<label><input type="checkbox" value="${r}"> ${r}</label>`).join('')}</fieldset>
<fieldset><legend>Supraganglionic cortex</legend>${['M4','M5','M6'].map(r=>`<label><input type="checkbox" value="${r}"> ${r}</label>`).join('')}</fieldset>
</div><div class="out"><span class="lbl">ASPECTS</span><span class="big" id="asp-o">10</span><span class="msg" id="asp-m"></span></div></div>
<h3>Pearls</h3>${P(['Use two standardized axial levels: the thalamus/basal ganglia level and the level just above the ganglionic structures.','Score of ≤7 was associated with markedly worse functional outcome and higher symptomatic hemorrhage risk after IV thrombolysis in the original cohort.','Narrow window (e.g. W 40 / L 40) improves detection of subtle hypoattenuation.'])}`,
init(el){const o=el.querySelector('#asp-o'),m=el.querySelector('#asp-m');const u=()=>{const n=el.querySelectorAll('#c-aspects input:checked').length,s=10-n;o.textContent=s;m.innerHTML=s<=7?B('≤7','crit')+' Large established early ischemic change':B('8–10','ok')+' Limited early ischemic change';};el.querySelectorAll('#c-aspects input').forEach(i=>i.addEventListener('change',u));u();},
refs:[{c:'Barber PA, Demchuk AM, Zhang J, Buchan AM. Validity and reliability of a quantitative computed tomography score in predicting outcome of hyperacute stroke before thrombolytic therapy. Lancet. 2000;355:1670–1674.',q:'Barber Demchuk validity reliability quantitative computed tomography score hyperacute stroke'}],rp:'ASPECTS'});

add({id:'modified-fisher',sec:'neuro',title:'Modified Fisher scale',alias:'subarachnoid hemorrhage sah vasospasm fisher grade',ver:'Frontera 2006',tags:['CT','SAH'],
lede:'Grades aneurysmal SAH on the admission CT to stratify risk of symptomatic vasospasm. Thick = clot filling any cistern or fissure completely; IVH = blood in both lateral ventricles in the original definition.',
body:`${T(['Grade','Subarachnoid blood','Intraventricular blood'],[
 ['0','None','None'],['1','Focal or diffuse thin','Absent'],['2','Focal or diffuse thin','Present'],['3','Thick, focal or diffuse','Absent'],['4','Thick, focal or diffuse','Present']])}
${N('Risk of symptomatic vasospasm and delayed infarction rises with grade. The original Fisher scale (1980) has 4 grades and counterintuitively places thick clot with IVH in grade 4 below grade 3 risk, which the modified scale corrects.')}
<h3>Original Fisher (1980), for comparison</h3>
${T(['Grade','CT finding'],[['1','No blood detected'],['2','Diffuse or vertical layers <1 mm thick'],['3','Localized clot and/or vertical layers ≥1 mm'],['4','Intracerebral or intraventricular clot with diffuse or no SAH']])}`,
refs:[{c:'Frontera JA, Claassen J, Schmidt JM, et al. Prediction of symptomatic vasospasm after subarachnoid hemorrhage: the modified Fisher scale. Neurosurgery. 2006;59:21–27.',q:'Frontera modified Fisher scale prediction symptomatic vasospasm'},{c:'Fisher CM, Kistler JP, Davis JM. Relation of cerebral vasospasm to subarachnoid hemorrhage visualized by computerized tomographic scanning. Neurosurgery. 1980;6:1–9.',q:'Fisher Kistler Davis relation cerebral vasospasm subarachnoid hemorrhage computerized tomographic'}],rp:'modified Fisher scale'});

add({id:'fazekas',sec:'neuro',title:'Fazekas scale',alias:'white matter hyperintensities small vessel disease leukoaraiosis flair',ver:'Fazekas 1987',tags:['MRI','WMH'],
lede:'Visual grading of T2/FLAIR white matter hyperintensities, scored separately for periventricular and deep white matter. Most reports quote the deep white matter grade.',
body:`${T(['Grade','Periventricular (PVH)','Deep white matter (DWMH)'],[
 ['0','Absent','Absent'],['1','Caps or pencil-thin lining','Punctate foci'],['2','Smooth halo','Beginning confluence of foci'],['3','Irregular, extending into deep white matter','Large confluent areas']])}
<h3>Pearls</h3>${P(['Deep grade 1 can be normal with age; grade 2–3 is generally abnormal at any age and supports small vessel disease in the right context.','Grade the dominant pattern; do not count lacunes or perivascular spaces as WMH.'])}`,
refs:[{c:'Fazekas F, Chawluk JB, Alavi A, Hurtig HI, Zimmerman RA. MR signal abnormalities at 1.5 T in Alzheimer’s dementia and normal aging. AJR Am J Roentgenol. 1987;149:351–356.',q:'Fazekas Chawluk MR signal abnormalities 1.5 T Alzheimer dementia normal aging'}],rp:'Fazekas scale'});

add({id:'spetzler-martin',sec:'neuro',title:'Spetzler–Martin AVM grade',alias:'arteriovenous malformation grading surgical risk',ver:'Spetzler 1986',tags:['AVM','CTA','MRI','DSA'],
lede:'Predicts surgical risk for brain AVMs. Sum of three features gives grade I–V; grade VI denotes inoperable lesions.',
body:`${T(['Feature','Category','Points'],[
 ['Nidus size','Small (<3 cm)','1'],['','Medium (3–6 cm)','2'],['','Large (>6 cm)','3'],
 ['Eloquence','Non-eloquent','0'],['','Eloquent: sensorimotor, language, visual cortex; hypothalamus, thalamus, internal capsule, brainstem, cerebellar peduncles, deep cerebellar nuclei','1'],
 ['Venous drainage','Superficial only','0'],['','Any deep','1']])}
<div class="calc" id="c-sm"><div class="calc-h">Grade it</div><div class="row">
<label for="sm-s">Nidus size<select id="sm-s"><option value="1">&lt;3 cm</option><option value="2">3–6 cm</option><option value="3">&gt;6 cm</option></select></label></div>
<div class="checks"><label><input type="checkbox" id="sm-e"> Eloquent location</label><label><input type="checkbox" id="sm-d"> Deep venous drainage</label></div>
<div class="out"><span class="lbl">Grade</span><span class="big" id="sm-o">I</span></div></div>
${N('Deep drainage = any drainage into the deep venous system (internal cerebral veins, basal veins of Rosenthal, precentral cerebellar vein). In the posterior fossa, only drainage to the straight sinus or transverse sinus via superficial cerebellar veins counts as superficial.')}`,
init(el){const r=['','I','II','III','IV','V'];const u=()=>{const g=+el.querySelector('#sm-s').value+(el.querySelector('#sm-e').checked?1:0)+(el.querySelector('#sm-d').checked?1:0);el.querySelector('#sm-o').textContent=r[g];};el.querySelectorAll('#c-sm select,#c-sm input').forEach(i=>i.addEventListener('change',u));u();},
refs:[{c:'Spetzler RF, Martin NA. A proposed grading system for arteriovenous malformations. J Neurosurg. 1986;65:476–483.',q:'Spetzler Martin proposed grading system arteriovenous malformations'}],rp:'Spetzler-Martin'});

add({id:'davf',sec:'neuro',title:'Dural AV fistula: Cognard & Borden',alias:'davf dural arteriovenous fistula cortical venous reflux',ver:'Cognard 1995 · Borden 1995',tags:['DSA','CTA','MRI'],
lede:'Both systems are driven by venous drainage pattern. Cortical venous reflux (CVR) is the key feature that predicts hemorrhage and venous infarction.',
body:`<h3>Cognard</h3>
${T(['Type','Venous drainage','Risk'],[
 ['I','Into sinus, antegrade flow',B('Benign','ok')],
 ['IIa','Into sinus, retrograde flow within sinus(es)',B('Low','ok')],
 ['IIb','Into sinus, antegrade, with reflux into cortical veins',B('Aggressive','warn')],
 ['IIa+b','Retrograde sinus flow and cortical venous reflux',B('Aggressive','warn')],
 ['III','Direct cortical venous drainage, no venous ectasia',B('Aggressive','crit')],
 ['IV','Direct cortical venous drainage with venous ectasia (>5 mm and >3× diameter of draining vein)',B('Aggressive','crit')],
 ['V','Drainage into spinal perimedullary veins',B('Myelopathy','crit')]])}
<h3>Borden</h3>
${T(['Type','Venous drainage'],[['I','Into dural sinus or meningeal vein, normal antegrade flow'],['II','Into dural sinus with cortical venous reflux'],['III','Directly into cortical veins (no sinus)']])}
${N('On CTA/MRI, suspect CVR when there are dilated tortuous cortical veins without a parenchymal nidus, or venous congestion/edema. DSA remains the reference standard for classification.')}`,
refs:[{c:'Cognard C, Gobin YP, Pierot L, et al. Cerebral dural arteriovenous fistulas: clinical and angiographic correlation with a revised classification of venous drainage. Radiology. 1995;194:671–680.',q:'Cognard cerebral dural arteriovenous fistulas revised classification venous drainage'},{c:'Borden JA, Wu JK, Shucart WA. A proposed classification for spinal and cranial dural arteriovenous fistulous malformations and implications for treatment. J Neurosurg. 1995;82:166–179.',q:'Borden Wu Shucart proposed classification spinal cranial dural arteriovenous fistulous'}],rp:'dural arteriovenous fistula'});

add({id:'bcvi-denver',sec:'neuro',title:'Blunt cerebrovascular injury (Denver/Biffl)',alias:'bcvi denver grade carotid vertebral dissection trauma biffl',ver:'Biffl 1999',tags:['CTA','Trauma'],
lede:'Grades blunt carotid and vertebral artery injury on CTA or DSA. Grade guides antithrombotic therapy versus endovascular/surgical management.',
body:`${T(['Grade','Description'],[
 ['I','Luminal irregularity or dissection/intramural hematoma with <25% luminal narrowing'],
 ['II','Dissection or intramural hematoma with ≥25% narrowing, intraluminal thrombus, or raised intimal flap'],
 ['III','Pseudoaneurysm'],['IV','Occlusion'],['V','Transection with free extravasation']])}
<h3>Expanded Denver screening criteria</h3>
<p>CTA is indicated if one or more are present.</p>
${T(['Group','Criteria'],[
 ['Signs / symptoms','Arterial hemorrhage from neck, nose or mouth · cervical bruit in patient &lt;50 years · expanding cervical hematoma · focal neurologic deficit · neurologic exam incongruous with head CT · stroke on follow-up CT'],
 ['Risk factors<br><small>high-energy mechanism</small>','Le Fort II or III · cervical spine fracture, subluxation or ligamentous injury at any level · mandible fracture · complex skull, skull base or occipital condyle fracture · severe TBI with GCS &lt;6 · near hanging with anoxic brain injury · seat belt abrasion with significant swelling, pain or altered mental status · TBI with thoracic injury · scalp degloving · thoracic vascular injury · blunt cardiac rupture · upper rib fracture']])}
<h3>Pearls</h3>${P(['Look for associated cervical spine fractures through the transverse foramen, C1–C3 fractures, and skull base fractures through the carotid canal.','Grade I–II injuries commonly progress or resolve; short-interval follow-up CTA is standard practice.'])}`,
refs:[{c:'Biffl WL, Moore EE, Offner PJ, Brega KE, Franciose RJ, Burch JM. Blunt carotid arterial injuries: implications of a new grading scale. J Trauma. 1999;47:845–853.',q:'Biffl Moore blunt carotid arterial injuries implications new grading scale'},{c:'Geddes AE, Burlew CC, Wagenaar AE, et al. Expanded screening criteria for blunt cerebrovascular injury: a bigger impact than anticipated. Am J Surg. 2016;212:1167–1174.',q:'Geddes Burlew expanded screening criteria blunt cerebrovascular injury bigger impact than anticipated'}],rp:'blunt cerebrovascular injury'});

/* ===== HEAD & NECK ===== */
add({id:'csf-leak',sec:'neuro',title:'CSF leak types (spontaneous intracranial hypotension)',alias:'csf leak sih spontaneous intracranial hypotension schievink classification ventral dural tear posterolateral lateral leak meningeal diverticulum csf-venous fistula cvf bern score myelography dsm ctm decubitus hyperdense paraspinal vein rhinorrhea otorrhea skull base',ver:'Schievink 2016 · Bern score 2019',tags:['MRI','CT myelography','DSM'],
lede:'Spinal CSF leaks fall into four types by mechanism. Brain MRI sets the pre-test probability (Bern score); spine imaging then decides between a fast leak (extradural fluid: types 1 and 2) and a slow leak without extradural fluid (CSF-venous fistula, type 3).',
body:`<h3>Spinal CSF leaks: Schievink classification</h3>
${T(['Type','Lesion','Extradural CSF on spine MRI / CTM','Typical imaging and work-up'],[
 ['1a','Ventral dural tear, usually from a calcified disc-osteophyte spicule, mostly thoracic','Yes, often long-segment','Look for a calcified ventral spicule on CT. Prone dynamic myelography (DSM or dynamic CTM) localizes the tear'],
 ['1b','Posterolateral (lateral) dural tear, often near the nerve root sleeve','Yes','Lateral decubitus dynamic myelography on the side of the extradural collection'],
 ['2a','Simple meningeal diverticulum (nerve root sleeve)','Yes','Leaking diverticulum, usually thoracic'],
 ['2b','Complex meningeal diverticulum or dural ectasia','Yes','Often seen in connective tissue disorders'],
 ['3','CSF-venous fistula: direct communication between the subarachnoid space and a paraspinal or epidural vein','No','Lateral decubitus CTM or DSM, ideally with high temporal and spatial resolution (photon-counting CT where available). Signs: hyperdense paraspinal vein, opacified epidural or foraminal vein; often next to a nerve root diverticulum, most often lower thoracic, more often right-sided'],
 ['4','Indeterminate: SIH with no leak found','No','Repeat targeted myelography; consider an empiric epidural blood patch']])}
${P(['Fast leak (types 1–2): extradural CSF on fat-saturated T2 spine MRI or CTM. The collection can extend far from the leak site, so it does not localize the leak by itself.','Slow leak (type 3): no extradural CSF. Use decubitus positioning, image immediately after injection, and use bone-subtracted or thin-section CT.','A normal brain MRI does not exclude SIH, and a normal opening pressure does not exclude a leak.'])}
<h3>Bern SIH score (brain MRI)</h3>
${T(['Finding','Threshold','Points'],[
 ['Pachymeningeal enhancement','Diffuse, smooth dural enhancement',B('2','warn')],
 ['Venous sinus engorgement','Convex inferior margin of the dominant transverse sinus',B('2','warn')],
 ['Suprasellar cistern effacement','≤ 4.0 mm',B('2','warn')],
 ['Subdural fluid collection','Hygroma or haematoma',B('1','info')],
 ['Prepontine cistern effacement','≤ 5.0 mm',B('1','info')],
 ['Mamillopontine distance','≤ 6.5 mm',B('1','info')]])}
${T(['Total (0–9)','Probability of a spinal CSF leak'],[['≤ 2',B('Low','ok')],['3–4',B('Intermediate','warn')],['≥ 5',B('High','crit')]])}
<h3>Cranial (skull base) CSF leaks</h3>
${T(['Site','Clinical presentation','Best imaging'],[
 ['Cribriform plate / fovea ethmoidalis','CSF rhinorrhea, recurrent meningitis','Thin-section CT of the skull base for the bony defect; CT or MR cisternography if there are several candidate defects'],
 ['Lateral recess of the sphenoid sinus','CSF rhinorrhea, often with obesity and idiopathic intracranial hypertension','Thin-section CT; look for arachnoid pits and meningoencephalocele'],
 ['Tegmen tympani / mastoideum','CSF otorrhea or middle-ear effusion (rhinorrhea through the Eustachian tube)','Temporal bone CT, with MRI for encephalocele'],
 ['Post-traumatic or post-operative','Fracture or surgical defect','CT; CT cisternography for an active leak']])}
${N('Skull base leaks cause rhinorrhea or otorrhea and usually do not cause orthostatic headache. Spinal leaks cause SIH. Associated idiopathic intracranial hypertension is common in spontaneous skull base leaks and can unmask after repair.')}`,
refs:[{c:'Schievink WI, Maya MM, Jean-Pierre S, Nuño M, Prasad RS, Moser FG. A classification system of spontaneous spinal CSF leaks. Neurology. 2016;87:673–679.',q:'Schievink classification system of spontaneous spinal CSF leaks Neurology 2016'},
 {c:'Dobrocky T, Grunder L, Breiding PS, et al. Assessing spinal cerebrospinal fluid leaks in spontaneous intracranial hypotension with a scoring system based on brain magnetic resonance imaging findings. JAMA Neurol. 2019;76:580–587.',q:'Dobrocky Bern score spontaneous intracranial hypotension JAMA Neurology 2019'},
 {c:'Schievink WI, Maya MM, Tay ASS, et al. Lateral spinal CSF leaks in patients with spontaneous intracranial hypotension: radiologic-anatomic study of different variants. AJNR Am J Neuroradiol. 2024;45:951–956.',q:'Schievink lateral spinal CSF leaks AJNR 2024'},
 {c:'Kranz PG, Gray L, Malinzak MD, Houk JL, Kim DK, Amrhein TJ. CSF-venous fistulas: anatomy and diagnostic imaging. AJR Am J Roentgenol. 2021;217:1418–1429.',q:'Kranz CSF-venous fistulas anatomy and diagnostic imaging AJR 2021'}],rp:'spontaneous intracranial hypotension'});
add({id:'neck-nodes',sec:'hn',title:'Cervical lymph node levels',alias:'neck node stations level ia ib iia iib iii iv va vb vi vii som retropharyngeal supraclavicular',ver:'Som 1999 · AJCC',tags:['CT','MRI','Staging'],
lede:'Imaging-based level classification using landmarks visible on axial CT/MRI. Levels track the clinical (AAO-HNS) system.',
body:`${ILLUS(['fig-neck-nodes','Cervical lymph node levels. Image: Frank Gaillard, Radiopaedia.org, CC BY-NC-SA'])}${T(['Level','Boundaries on axial imaging'],[
 ['IA','Submental. Between the medial margins of the anterior bellies of the digastric muscles, above the hyoid body and below the mylohyoid.'],
 ['IB','Submandibular. Below mylohyoid, above hyoid body, posterior to the anterior belly of digastric and anterior to the back of the submandibular gland.'],
 ['IIA','Skull base to bottom of hyoid body. Posterior to back of submandibular gland, anterior to back of SCM. Node anterior, medial, lateral to the IJV, or posterior but inseparable from it.'],
 ['IIB','Same craniocaudal range as IIA. Node posterior to the IJV with a fat plane between node and vein.'],
 ['III','Bottom of hyoid body to bottom of cricoid arch. Anterior to back of SCM, lateral to medial margin of common/internal carotid.'],
 ['IV','Bottom of cricoid to clavicle. Anterior to a line from back of SCM to posterolateral margin of anterior scalene; lateral to medial carotid margin.'],
 ['VA','Posterior triangle, skull base to bottom of cricoid. Posterior to back of SCM, anterior to anterior edge of trapezius.'],
 ['VB','Posterior triangle, bottom of cricoid to clavicle. Posterior to line from back of SCM to posterolateral margin of anterior scalene.'],
 ['VI','Central (visceral). Between the medial margins of the carotids, bottom of hyoid body to top of manubrium.'],
 ['VII','Superior mediastinal. Between the carotids, below top of manubrium, above the innominate vein.'],
 ['SC','Supraclavicular. At or caudal to the clavicle on the scan where it is seen in full, above and medial to the ribs.'],
 ['RP','Retropharyngeal. Within 2 cm of skull base, medial to the internal carotid arteries.']])}
<h3>Landmarks to anchor on</h3>${P(['<b>Hyoid body bottom</b>: II → III transition. <b>Cricoid bottom</b>: III → IV and VA → VB transition.','<b>Back of submandibular gland</b>: I vs II. <b>Back of SCM</b>: II/III/IV vs V.','<b>Medial carotid margin</b>: lateral levels vs VI/RP.'])}
${N('Size thresholds commonly used: short axis >10 mm (>11 mm for jugulodigastric IIA). Necrosis, extranodal extension and rounded shape matter more than size.')}`,
refs:[{c:'Som PM, Curtin HD, Mancuso AA. An imaging-based classification for the cervical nodes designed as an adjunct to recent clinically based nodal classifications. Arch Otolaryngol Head Neck Surg. 1999;125:388–396.',q:'Som Curtin Mancuso imaging-based classification cervical nodes adjunct clinically based nodal'},{c:'Som PM, Curtin HD, Mancuso AA. Imaging-based nodal classification for evaluation of neck metastatic adenopathy. AJR Am J Roentgenol. 2000;174:837–844.',q:'Som Curtin Mancuso imaging-based nodal classification evaluation neck metastatic adenopathy'}],rp:'cervical lymph node levels'});

add({id:'le-fort',sec:'hn',title:'Le Fort fractures',alias:'lefort midface maxillary fracture pterygoid craniofacial disjunction',ver:'Rhea & Novelline 2005',tags:['CT','Trauma'],
lede:'All three types disrupt the pterygoid plates. Each has one fracture unique to it, which makes CT identification fast. Types frequently coexist and may differ side to side.',
body:`${ILLUS(['fig-lefort-overview','Le Fort I, II and III planes on one skull'],['fig-lefort-stock','Le Fort I–III fracture lines. Stock illustration preview, Dreamstime #24901408'],['fig-lefort-1','Le Fort I: horizontal maxillary fracture'],['fig-lefort-2','Le Fort II: pyramidal fracture'],['fig-lefort-3','Le Fort III: craniofacial disjunction'])}${T(['Type','Pattern','Unique component','Mobile segment'],[
 ['I','Horizontal through maxilla above the alveolar ridge','Anterolateral margin of the nasal fossa (piriform aperture)','Palate + alveolar process ("floating palate")'],
 ['II','Pyramidal: nasofrontal junction, medial orbit, inferior orbital rim, zygomaticomaxillary region','Inferior orbital rim','Maxilla + nose ("floating maxilla")'],
 ['III','Transverse craniofacial disjunction: nasofrontal junction, medial and lateral orbital walls, zygomatic arch','Zygomatic arch','Entire midface ("floating face")']])}
<h3>Reading algorithm</h3>${P(['Step 1: Are the pterygoid plates fractured? If not, it is not a Le Fort fracture.','Step 2: Check anterolateral nasal fossa margin (I), inferior orbital rim (II), zygomatic arch (III).','Step 3: Confirm the remaining expected components. Report each side separately.'])}`,
refs:[{c:'Rhea JT, Novelline RA. How to simplify the CT diagnosis of Le Fort fractures. AJR Am J Roentgenol. 2005;184:1700–1705.',q:'Rhea Novelline how to simplify CT diagnosis Le Fort fractures'}],rp:'Le Fort fracture'});

add({id:'noe',sec:'hn',title:'Naso-orbito-ethmoid fracture',alias:'noe nasoorbitoethmoid naso-orbital-ethmoid markowitz manson medial canthal tendon telecanthus central fragment',ver:'Markowitz–Manson 1991',tags:['CT','Trauma'],
lede:'Classified by the central fragment: the piece of medial orbital rim that carries the medial canthal tendon (MCT). Whether that fragment is intact, comminuted or avulsed decides the repair.',
body:`${ILLUS(['fig-noe','Markowitz–Manson types I–III. Image: American Academy of Ophthalmology, aao.org'])}
${T(['Type','Central fragment','MCT'],[
 ['I','Single large fragment, minimal comminution','Attached to the large fragment'],
 ['II','Comminuted, but the tendon-bearing piece is still sizeable','Attached to a fragment large enough to fix'],
 ['III','Severe comminution of the central fragment','Avulsed or disrupted; needs canthopexy']])}
<h3>Report</h3>${P(['Central fragment size, comminution and displacement on axial and coronal images.','Lacrimal fossa and nasolacrimal duct involvement.','Frontal sinus outflow tract and posterior table; cribriform plate and fovea ethmoidalis (CSF leak risk).','Clinically, telecanthus (widened intercanthal distance) suggests MCT displacement.'])}`,
refs:[{c:'Markowitz BL, Manson PN, Sargent L, et al. Management of the medial canthal tendon in nasoethmoid orbital fractures: the importance of the central fragment in classification and treatment. Plast Reconstr Surg. 1991;87:843–853.',q:'Markowitz Manson management medial canthal tendon nasoethmoid orbital fractures central fragment'}],rp:'naso-orbito-ethmoid fracture'});

add({id:'shunt-valves',sec:'hn',title:'Programmable shunt valve settings',alias:'vp shunt ventriculoperitoneal ventriculostomy programmable valve setting skull radiograph shunt series codman hakim certas plus medtronic strata polaris sophysa sophy su8 sm8 aesculap miethke progav prosa gravitational unit mri shunt check',ver:'Lollis 2010 · Costello 2020',tags:['XR','MRI safety'],
lede:'Get a radiograph perpendicular to the valve, identify the valve type, confirm orientation with its marker, then read the setting against the manufacturer template. Report the valve type and the setting.',
body:`${P(['Obliquity distorts the dial and hides orientation markers. Repeat a centred view perpendicular to the valve rather than guess.','A flipped image reverses the reading on Hakim, Strata and Miethke valves. Check the orientation marker first.','Compare with the prior shunt series; settings change deliberately and after MRI.'])}

<h3>Medtronic Strata</h3>
${ILLUS(['fig-shunt-strata','Strata valve at performance levels 0.5 to 2.5. The arrow marks the notch in the dark dial. Source: Lollis SS et al. AJNR 2010;31:1343–6, Fig 2; via UW Emergency Radiology.'])}
${P(['Find the two small round markers beside the dial; the notch in the dark dial points to the performance level.','Levels: 0.5, 1.0, 1.5, 2.0, 2.5 (higher level = higher opening pressure).','MRI can change the setting: confirm after every MRI.'])}

<h3>Codman Hakim</h3>
${ILLUS(['fig-shunt-hakim','A, Hakim valve radiograph. B, Manufacturer X-ray setting template: place the round indicator marker on the right, then read the notch in the white ring. Source: Lollis SS et al. AJNR 2010;31:1343–6, Fig 1; via UW Emergency Radiology.'])}
${P(['The round indicator marker belongs on the right-hand side. If it is on the left, the image is reversed: flip it before reading.','The notch in the radiopaque ring points to the setting: 30–200 mmH₂O in 10 mmH₂O steps (18 settings), arranged clockwise from 30 at 3 o&#39;clock.','MRI can reset the valve: confirm after every MRI.'])}

<h3>Codman Certas / Certas Plus</h3>
${ILLUS(['fig-shunt-certas','Certas Plus: the red circle marks the right-hand X-ray marker; the green box marks the setting indicator at each of positions 1–8. Source: Codman Certas Plus X-ray procedure guide (Johnson &amp; Johnson, 2015); via UW Emergency Radiology.'])}
${P(['Orient the small round marker to the upper right.','Read which position the T-shaped setting indicator points to.'])}
${T(['Position','1','2','3','4','5','6','7','8'],[['mmH₂O','25','50','80','110','145','180','215','Virtual off (&gt;400)']])}

<h3>Sophysa (Sophy and Polaris)</h3>
${ILLUS(['fig-shunt-sophysa','A, Sophy valve: rotor (two white squares) in positions 1–8 with opening pressures. B, Polaris valve: positions 1–5. Source: Lollis SS et al. AJNR 2010;31:1343–6, Fig 3; via UW Emergency Radiology.'])}
${P(['The rotor is the pair of radiopaque squares; its angle gives the position.','Sophy standard pressure model (8 positions): 30, 50, 70, 90, 110, 140, 170, 200 mmH₂O.','Polaris: position 1 is nearest the inlet; the dots beside the inlet give the model, which sets the pressures (table). It has a magnetic lock, but recheck after MRI.'])}
${T(['Polaris model (dots by inlet)','Pos 1','Pos 2','Pos 3','Pos 4','Pos 5'],[
 ['SPV-140 (no dot)','10','40','80','110','140'],
 ['SPV (1 dot)','30','70','110','150','200'],
 ['SPV-300 (2 dots)','50','100','150','220','300'],
 ['SPV-400 (3 dots)','80','150','230','330','400']])}

<h3>Aesculap / Miethke proGAV</h3>
${ILLUS(['fig-shunt-progav','A, proGAV radiograph. B, Manufacturer template: the rotor tip shows the opening pressure (0–20 cmH₂O); note the orientation of the flat side. C, Gravitational unit coding. Source: Lollis SS et al. AJNR 2010;31:1343–6, Fig 4; via UW Emergency Radiology.'])}
${P(['Lay the template over the valve with the flat side matching; the rotor tip points to the adjustable unit setting, 0–20 cmH₂O.','The fixed gravitational unit adds opening pressure in the upright position. Its size and number of rings give the value (table).','Report both: adjustable setting and gravitational unit.'])}
${T(['Gravitational unit','Size / rings','Added upright pressure'],[['Small','No ring','10 cmH₂O'],['Large','No ring','15 cmH₂O'],['Large','1 ring','20 cmH₂O'],['Large','2 rings','25 cmH₂O'],['Large','3 rings','30 cmH₂O'],['Large','4 rings','35 cmH₂O']])}

<h3>Aesculap / Miethke proSA</h3>
${ILLUS(['fig-shunt-prosa','proSA (programmable shunt assistant) template and radiograph. The cut-out marks orientation; the rotor tip gives the setting on a 0–40 cmH₂O scale. Source: Aesculap; via UW Emergency Radiology.'])}
${P(['Align the cut-out in the outer ring, then read where the rotor tip points on the 0–40 cmH₂O scale.','The proSA is the adjustable gravitational unit, usually paired with a proGAV or another valve: report both components.'])}

<h3>MRI and the setting</h3>
${T(['Valve','After MRI'],[
 ['Codman Hakim',B('Reset possible: check','crit')],
 ['Medtronic Strata',B('Change possible: check','crit')],
 ['Sophysa Sophy',B('Change possible: check','crit')],
 ['Codman Certas Plus',B('Designed to resist; confirm','warn')],
 ['Sophysa Polaris',B('Magnetic lock; confirm','warn')],
 ['Aesculap proGAV 2.0 / proSA',B('Locked; confirm if in doubt','warn')]])}
${N('Figures reproduced from Lollis et al. (AJNR 2010), Codman and Aesculap materials as collected by the UW Emergency Radiology Trauma Radiology Reference Resource. Follow the current manufacturer instructions for the specific model.')}`,
refs:[{c:'Lollis SS, Mamourian AC, Vaccaro TJ, Duhaime AC. Programmable CSF shunt valves: radiographic identification and interpretation. AJNR Am J Neuroradiol. 2010;31(7):1343–1346.',q:'Lollis Mamourian programmable CSF shunt valves radiographic identification interpretation'},
 {c:'CODMAN CERTAS Plus X-ray procedure guide. Johnson &amp; Johnson; 2015.',q:''},
 {c:'Costello JE, Rassner UA. An update on programmable CSF shunt valves: identification, MR imaging safety and potential pitfalls. Neurographics. 2020;10:26–32.',q:'Costello Rassner programmable CSF shunt valves'},
 {c:'Determining settings of programmable VP shunts. UW Emergency Radiology, Trauma Radiology Reference Resource. https://faculty.washington.edu/jeff8rob/trauma-radiology-reference-resource/1-cns/determining-settings-of-programmable-vp-shunts/',q:''}],rp:'programmable shunt valve'});

add({id:'zmc',sec:'hn',title:'Zygomaticomaxillary complex fracture',alias:'zmc tripod tetrapod fracture zygoma malar',ver:'Review',tags:['CT','Trauma'],
lede:'"Tetrapod" fracture separating the zygoma from its four articulations. Older term "tripod" omits the arch or the posterior maxillary wall depending on author.',
body:`${ILLUS(['fig-zmc','ZMC fracture components: lateral orbital rim, zygomatic arch, inferior orbital rim/floor, maxillary sinus walls'])}${T(['Component','Where to look'],[
 ['Zygomaticofrontal / lateral orbital wall','Lateral orbital rim and zygomaticosphenoid suture'],
 ['Zygomatic arch','Axial images at arch level; often 3 fracture lines'],
 ['Inferior orbital rim and floor','Coronal reformats; check infraorbital canal'],
 ['Zygomaticomaxillary buttress','Anterior and posterolateral maxillary sinus walls']])}
<h3>Report</h3>${P(['Displacement and rotation of the zygoma, depression of the malar eminence.','Orbital floor defect size, herniated fat or inferior rectus, orbital volume change.','Involvement of the infraorbital canal (V2 numbness).','Coronoid process impingement by a depressed arch (trismus).'])}`,
refs:[{c:'Hopper RA, Salemy S, Sze RW. Diagnosis of midface fractures with CT: what the surgeon needs to know. Radiographics. 2006;26:783–793.',q:'Hopper Salemy Sze diagnosis midface fractures CT what the surgeon needs to know'}],rp:'zygomaticomaxillary complex fracture'});

add({id:'tirads',sec:'hn',title:'ACR TI-RADS',alias:'thyroid nodule ultrasound fna tirads tr1 tr2 tr3 tr4 tr5',ver:'ACR 2017',tags:['US','Thyroid'],
lede:'Add points from all five feature categories (choose one per category, except echogenic foci where all present are summed). Points determine TR level; maximum diameter determines FNA or follow-up.',
body:`${T(['Category','Feature → points'],[
 ['Composition','Cystic or almost completely cystic 0 · Spongiform 0 · Mixed cystic and solid 1 · Solid or almost completely solid 2'],
 ['Echogenicity','Anechoic 0 · Hyper- or isoechoic 1 · Hypoechoic 2 · Very hypoechoic 3'],
 ['Shape','Wider-than-tall 0 · Taller-than-wide 3'],
 ['Margin','Smooth 0 · Ill-defined 0 · Lobulated or irregular 2 · Extrathyroidal extension 3'],
 ['Echogenic foci','None or large comet-tail 0 · Macrocalcifications 1 · Peripheral (rim) 2 · Punctate echogenic foci 3']])}
${T(['Level','Points','FNA if','Follow-up if'],[
 ['TR1',`0 · ${B('Benign','ok')}`,'No FNA','None'],
 ['TR2',`2 · ${B('Not suspicious','ok')}`,'No FNA','None'],
 ['TR3',`3 · ${B('Mildly suspicious','warn')}`,'≥2.5 cm','≥1.5 cm'],
 ['TR4',`4–6 · ${B('Moderately suspicious','warn')}`,'≥1.5 cm','≥1.0 cm'],
 ['TR5',`≥7 · ${B('Highly suspicious','crit')}`,'≥1.0 cm','≥0.5 cm']])}
<div class="calc" id="c-ti"><div class="calc-h">Score a nodule</div><div class="row">
<label for="ti-c">Composition<select id="ti-c"><option value="0">Cystic / almost completely cystic</option><option value="0">Spongiform</option><option value="1">Mixed cystic and solid</option><option value="2" selected>Solid / almost completely solid</option></select></label>
<label for="ti-e">Echogenicity<select id="ti-e"><option value="0">Anechoic</option><option value="1">Hyper- or isoechoic</option><option value="2" selected>Hypoechoic</option><option value="3">Very hypoechoic</option></select></label>
<label for="ti-s">Shape<select id="ti-s"><option value="0">Wider-than-tall</option><option value="3">Taller-than-wide</option></select></label>
<label for="ti-m">Margin<select id="ti-m"><option value="0">Smooth</option><option value="0">Ill-defined</option><option value="2">Lobulated / irregular</option><option value="3">Extrathyroidal extension</option></select></label>
<label for="ti-d">Max diameter (cm)<input id="ti-d" type="number" step="0.1" min="0" value="1.2"></label></div>
<div class="checks"><span class="lbl" style="font-size:13.5px;color:var(--muted)">Echogenic foci:</span><label><input type="checkbox" data-p="1"> Macrocalcifications</label><label><input type="checkbox" data-p="2"> Peripheral (rim)</label><label><input type="checkbox" data-p="3"> Punctate</label></div>
<div class="out"><span class="lbl">Points</span><span class="big" id="ti-p">–</span><span class="lbl">Level</span><span class="big" id="ti-l">–</span><span class="msg" id="ti-r"></span></div></div>
<h3>Pearls</h3>${P(['Spongiform nodules score 0 for composition and are not scored further for echogenicity (they are always TR1 unless other features add points).','Report no more than four nodules with highest TR levels; FNA at most two.','Follow-up for TR3: 1, 3, 5 years. TR4: 1, 2, 3, 5 years. TR5: annually for 5 years. Growth = ≥20% and ≥2 mm increase in two dimensions, or ≥50% volume increase.'])}`,
init(el){const R={1:['–','–'],2:['–','–'],3:[2.5,1.5],4:[1.5,1.0],5:[1.0,0.5]};const u=()=>{let p=['ti-c','ti-e','ti-s','ti-m'].reduce((a,i)=>a+ +el.querySelector('#'+i).value,0);el.querySelectorAll('#c-ti input[type=checkbox]:checked').forEach(c=>p+=+c.dataset.p);const tr=p<=0?1:p<=2?2:p===3?3:p<=6?4:5;const d=num(el.querySelector('#ti-d').value);el.querySelector('#ti-p').textContent=p;el.querySelector('#ti-l').textContent='TR'+tr;let msg;if(tr<=2)msg=B('No FNA','ok')+' No follow-up.';else{const[f,fu]=R[tr];if(d==null)msg='Enter diameter.';else if(d>=f)msg=B('FNA','crit')+` Meets ${f} cm threshold.`;else if(d>=fu)msg=B('Follow-up','warn')+` Below FNA threshold (${f} cm), meets follow-up threshold (${fu} cm).`;else msg=B('No action','ok')+` Below ${fu} cm follow-up threshold.`;}el.querySelector('#ti-r').innerHTML=msg;};el.querySelectorAll('#c-ti select,#c-ti input').forEach(i=>i.addEventListener('input',u));u();},
refs:[{c:'Tessler FN, Middleton WD, Grant EG, et al. ACR Thyroid Imaging, Reporting and Data System (TI-RADS): white paper of the ACR TI-RADS Committee. J Am Coll Radiol. 2017;14:587–595.',q:'Tessler ACR Thyroid Imaging Reporting and Data System TI-RADS white paper'}],rp:'ACR TI-RADS'});

add({id:'incidental-thyroid',sec:'incid',title:'Incidental thyroid nodule',alias:'ito incidental thyroid nodule ct mri pet acr white paper hoang',ver:'ACR 2015',tags:['CT','MRI','PET'],
lede:'Three-tiered approach for nodules found incidentally on CT, MRI or PET/CT. Size is measured in the longest axial dimension.',
body:`${FIGS(['fc-thyroid','Incidental thyroid nodule on CT/MRI'])}${TREE_UI('thyroid')}
${P(['Abnormal lymph nodes on CT/MRI: calcification, cystic change, or increased enhancement.'])}
${N('Not for nodules in patients with known high risk (e.g. prior neck irradiation, MEN2, familial thyroid cancer) where clinical evaluation directs workup.')}`,
refs:[{c:'Hoang JK, Langer JE, Middleton WD, et al. Managing incidental thyroid nodules detected on imaging: white paper of the ACR Incidental Thyroid Findings Committee. J Am Coll Radiol. 2015;12:143–150.',q:'Hoang managing incidental thyroid nodules detected on imaging white paper ACR'}],rp:'incidental thyroid nodule'});

add({id:'dental',sec:'hn',title:'Dental numbering',alias:'teeth universal fdi tooth numbering iso 3950 palmer',ver:'Universal · FDI/ISO 3950',tags:['CT','Panorex'],
lede:'Universal (US) numbers permanent teeth 1–32 clockwise from the patient’s upper right third molar. FDI uses two digits: quadrant then tooth (1 = central incisor, 8 = third molar).',
body:`${ILLUS(['fig-dental-universal','Universal numbering on a panoramic radiograph. Image: Francis Deng, Radiopaedia.org, CC BY-NC-SA'],['fig-dental-names','Tooth names and eruption landmarks. Image: Francis Deng, Radiopaedia.org, CC BY-NC-SA'])}<h3>Permanent dentition (patient’s right on the left of chart)</h3>
<div class="tw" style="padding:10px"><div class="teethlbl"><span>Upper right</span><span>Upper left</span></div>
<div class="teeth">${Array.from({length:16},(_,i)=>{const u=i+1,f=i<8?`1${8-i}`:`2${i-7}`;return `<div class="${i===8?'mid':''}"><b>${u}</b><i>${f}</i></div>`}).join('')}</div>
<div class="teeth" style="margin-top:3px">${Array.from({length:16},(_,i)=>{const u=32-i,f=i<8?`4${8-i}`:`3${i-7}`;return `<div class="${i===8?'mid':''}"><b>${u}</b><i>${f}</i></div>`}).join('')}</div>
<div class="teethlbl"><span>Lower right</span><span>Lower left</span></div>
<p style="font-size:13px;color:var(--muted);margin:6px 0 0">Bold = Universal · small = FDI</p></div>
${T(['Tooth (each quadrant)','FDI digit','Universal, upper right','Universal, lower right'],[
 ['Central incisor','1','8','25'],['Lateral incisor','2','7','26'],['Canine','3','6','27'],['First premolar','4','5','28'],['Second premolar','5','4','29'],['First molar','6','3','30'],['Second molar','7','2','31'],['Third molar','8','1','32']])}
<h3>Primary (deciduous) teeth</h3>${P(['Universal: letters A–T, A = upper right second molar → J = upper left second molar; K = lower left second molar → T = lower right second molar.','FDI: quadrants 5 (UR), 6 (UL), 7 (LL), 8 (LR); teeth 1–5 from central incisor to second molar.'])}`,
refs:[{c:'ISO 3950:2016. Dentistry — Designation system for teeth and areas of the oral cavity. International Organization for Standardization.',q:''}],rp:'dental notation'});

/* ===== CHEST & VASCULAR ===== */
add({id:'fleischner',sec:'incid',title:'Fleischner 2017 pulmonary nodules',alias:'incidental lung nodule ground glass part solid subsolid follow-up',ver:'Fleischner 2017',tags:['CT','Incidental'],
lede:'For incidental nodules in adults ≥35 years. Not for lung cancer screening (use Lung-RADS), patients with known cancer, or immunocompromised patients. Size = average of long and short axes, rounded to nearest mm.',
body:`${FIGS(['fc-fleischner','Fleischner 2017 solid and subsolid nodule tables'])}<h3>Solid nodules</h3>
${T(['Size','Single · low risk','Single · high risk','Multiple · low risk','Multiple · high risk'],[
 ['&lt;6 mm<br><small>&lt;100 mm³</small>','No routine follow-up','Optional CT at 12 mo','No routine follow-up','Optional CT at 12 mo'],
 ['6–8 mm<br><small>100–250 mm³</small>','CT 6–12 mo, then consider 18–24 mo','CT 6–12 mo, then 18–24 mo','CT 3–6 mo, then consider 18–24 mo','CT 3–6 mo, then 18–24 mo'],
 ['&gt;8 mm<br><small>&gt;250 mm³</small>','Consider CT at 3 mo, PET/CT, or tissue sampling','Consider CT at 3 mo, PET/CT, or tissue sampling','CT 3–6 mo, then consider 18–24 mo','CT 3–6 mo, then 18–24 mo']])}
<h3>Subsolid nodules</h3>
${T(['Type','&lt;6 mm','≥6 mm'],[
 ['Single ground-glass','No routine follow-up','CT 6–12 mo to confirm persistence, then every 2 yr until 5 yr'],
 ['Single part-solid','No routine follow-up','CT 3–6 mo to confirm persistence. If unchanged and solid component &lt;6 mm: annual CT for 5 yr. Solid component ≥6 mm: highly suspicious'],
 ['Multiple subsolid','CT 3–6 mo. If stable, consider CT at 2 and 4 yr','CT 3–6 mo. Manage by the most suspicious nodule']])}
${P(['Single ground-glass &lt;6 mm with suspicious morphology: consider follow-up at 2 and 4 years.','Part-solid cannot be assigned below 6 mm. A persistent part-solid nodule with solid component ≥6 mm is highly suspicious.','Any subsolid nodule that enlarges: consider biopsy or resection.'])}
<h3>High-risk factors</h3>${P(['Heavy smoking history; asbestos, radon or uranium exposure; family history of lung cancer; older age.','Nodule factors: spiculation, upper lobe location, emphysema or pulmonary fibrosis, multiplicity.'])}
<h3>Pearls</h3>${P(['Multiple nodules: manage by the most suspicious nodule.','Perifissural or subpleural nodules with typical benign morphology (triangular/lentiform, smooth) &lt;10 mm need no follow-up, even in high-risk patients.','Solid nodule stability over 2 years is considered benign; subsolid nodules need 5 years.'])}`,
refs:[{c:'MacMahon H, Naidich DP, Goo JM, et al. Guidelines for management of incidental pulmonary nodules detected on CT images: from the Fleischner Society 2017. Radiology. 2017;284:228–243.',q:'MacMahon guidelines management incidental pulmonary nodules Fleischner Society 2017'}],rp:'Fleischner Society pulmonary nodule recommendations'});

add({id:'aortic-dissection',sec:'chest',title:'Aortic dissection: Stanford & DeBakey',alias:'aortic dissection type a type b stanford debakey acute aortic syndrome',ver:'Daily 1970 · DeBakey 1965',tags:['CTA','Aorta'],
lede:'Stanford is anatomic and management-driven: any ascending aortic involvement is type A (surgical), regardless of entry site.',
body:`${T(['System','Type','Extent'],[
 ['Stanford','A','Involves the ascending aorta (with or without arch/descending)'],
 ['','B','Does not involve the ascending aorta'],
 ['DeBakey','I','Originates in ascending aorta, extends at least to the arch, often beyond'],
 ['','II','Confined to the ascending aorta'],
 ['','IIIa','Originates in descending aorta, limited to the thorax'],
 ['','IIIb','Originates in descending aorta, extends below the diaphragm']])}
<h3>Report</h3>${P(['Entry tear location; true vs false lumen (false lumen: larger, slower enhancing, beak sign, cobwebs).','Branch vessel origins from true/false lumen; static vs dynamic obstruction; end-organ malperfusion.','Pericardial effusion, aortic valve, coronary involvement, hemomediastinum, periaortic hematoma.','Same framework applies to intramural hematoma and penetrating atherosclerotic ulcer.'])}`,
refs:[{c:'Daily PO, Trueblood HW, Stinson EB, Wuerflein RD, Shumway NE. Management of acute aortic dissections. Ann Thorac Surg. 1970;10:237–247.',q:'Daily Trueblood Stinson Shumway management acute aortic dissections'},{c:'DeBakey ME, Henly WS, Cooley DA, et al. Surgical management of dissecting aneurysms of the aorta. J Thorac Cardiovasc Surg. 1965;49:130–149.',q:'DeBakey Henly Cooley surgical management dissecting aneurysms aorta'}],rp:'aortic dissection'});

add({id:'endoleak',sec:'chest',title:'Endoleak classification',alias:'evar endoleak type 1 2 3 4 5 endotension stent graft',ver:'SVS reporting standards',tags:['CTA','EVAR'],
lede:'Persistent flow in the aneurysm sac outside the stent graft after EVAR/TEVAR. Types I and III are high pressure and need prompt treatment.',
body:`${T(['Type','Source','Imaging clue'],[
 ['Ia / Ib','Inadequate seal at proximal (Ia) or distal (Ib) attachment site. Ic: iliac occluder','Contrast contiguous with graft end; arterial phase'],
 ['II','Retrograde flow from branch vessels (IMA, lumbar arteries)','Peripheral sac contrast near IMA/lumbar origin; often delayed phase only'],
 ['III','Graft failure: junctional separation (IIIa) or fabric tear (IIIb)','Contrast adjacent to graft body or overlap zone'],
 ['IV','Graft porosity, within 30 days of placement','Diffuse blush on completion angiogram'],
 ['V','Endotension: sac expansion without visible leak','Enlarging sac, no contrast on any phase']])}
${N('Triple-phase CTA (non-contrast, arterial, delayed) separates endoleak from calcification and catches slow type II leaks. Sac growth &gt;5 mm warrants investigation.')}`,
refs:[{c:'Chaikof EL, Blankensteijn JD, Harris PL, et al. Reporting standards for endovascular aortic aneurysm repair. J Vasc Surg. 2002;35:1048–1060.',q:'Chaikof reporting standards endovascular aortic aneurysm repair'}],rp:'endoleak'});

add({id:'extremity-vessels',sec:'chest',title:'Extremity vascular anatomy',alias:'lower extremity runoff arterial anatomy deep veins superficial veins upper extremity dvt femoral vein saphenous cephalic basilic',ver:'Anatomy',tags:['CTA','US','Vascular'],
lede:'Named vessels in order, for runoff CTA and venous duplex reports.',
body:`${ILLUS(['fig-runoff','Lower extremity arterial runoff on CTA'],['fig-le-veins','Lower extremity veins'],['fig-ue-veins','Upper extremity veins'])}
<h3>Lower extremity arteries</h3>
${T(['Segment','Vessels'],[
 ['Inflow','Abdominal aorta → common iliac → external iliac (internal iliac to pelvis)'],
 ['Thigh','Common femoral → superficial femoral and profunda femoris'],
 ['Knee','Popliteal (above-knee, below-knee segments)'],
 ['Leg','Anterior tibial; tibioperoneal trunk → posterior tibial and peroneal'],
 ['Foot','Dorsalis pedis (from anterior tibial); medial and lateral plantar (from posterior tibial)']])}
<h3>Lower extremity veins</h3>
${T(['Group','Vessels'],[
 ['Deep','Common femoral, femoral, deep femoral, popliteal; paired anterior tibial, posterior tibial and peroneal veins; gastrocnemius and soleal veins'],
 ['Superficial','Great saphenous (joins common femoral at the saphenofemoral junction); small saphenous (usually joins popliteal)']])}
<h3>Upper extremity veins</h3>
${T(['Group','Vessels'],[
 ['Deep','Paired radial, ulnar and brachial veins → axillary → subclavian → brachiocephalic'],
 ['Superficial','Cephalic (into axillary); basilic (joins brachial to form axillary); median cubital connecting the two']])}
${N('"Superficial femoral vein" is a deep vein. Report it as the femoral vein so a thrombus there is not mistaken for superficial thrombophlebitis.')}`,
refs:[{c:'Caggiati A, Bergan JJ, Gloviczki P, et al. Nomenclature of the veins of the lower limbs: an international interdisciplinary consensus statement. J Vasc Surg. 2002;36:416–422.',q:'Caggiati nomenclature of the veins of the lower limbs international interdisciplinary consensus'}],rp:'lower limb arterial anatomy'});

add({id:'cad-rads',sec:'chest',title:'CAD-RADS 2.0',alias:'coronary cta ccta cad-rads coronary artery disease reporting plaque burden hrp high-risk plaque ct-ffr stenosis calcium score',ver:'SCCT/ACR/NASCI 2022',tags:['CTA','Cardiac'],
lede:'Report the highest-grade stenosis in any vessel over 1.5 mm, then plaque burden, then modifiers, e.g. CAD-RADS 3/P2/HRP/I+. Version 2.0 added plaque burden (P1–P4) and ischemia (I), and replaced the old V modifier with HRP.',
body:`${ILLUS(['fig-cadrads-stenosis.svg','Stenosis categories and stable chest pain management'],['fig-cadrads-plaque.svg','Plaque burden, modifiers and high-risk plaque features'])}
<h3>Stenosis category</h3>
${T(['Category','Stenosis','Stable chest pain: next step'],[
 ['0','0%, no plaque',B('No further cardiac testing','ok')],
 ['1','1–24%, or plaque with positive remodeling but no stenosis',B('Preventive therapy','ok')],
 ['2','25–49%',B('Preventive therapy','ok')],
 ['3','50–69%',B('Consider functional testing','warn')],
 ['4A','70–99% in 1 or 2 vessels',B('ICA or functional assessment','crit')],
 ['4B','Left main ≥50%, or 3-vessel ≥70%',B('Invasive angiography','crit')],
 ['5','100% (total occlusion)',B('ICA and/or viability','crit')],
 ['N','Non-diagnostic study',B('Additional evaluation','warn')]])}
<h3>Plaque burden</h3>
${T(['Grade','Descriptor','CAC score','Segment involvement score'],[['P1','Mild','1–100','1–2'],['P2','Moderate','101–300','3–4'],['P3','Severe','301–999','5–7'],['P4','Extensive','≥1000','≥8']])}
<h3>Modifiers</h3>
${T(['Modifier','Meaning'],[
 ['N','One or more non-diagnostic segments; if a diagnostic segment shows ≥50%, report 3/N rather than N alone'],
 ['HRP','High-risk plaque: 2 or more of low attenuation (&lt;30 HU), positive remodeling, spotty calcification, napkin-ring sign'],
 ['I+ / I− / I±','Ischemia from CT-FFR or stress CT perfusion: present, absent, or indeterminate'],
 ['S','Stent present'],['G','Bypass graft present; bypassed native stenoses are not graded'],
 ['E','Exception: non-atherosclerotic cause such as anomalous origin, dissection, aneurysm, vasculitis, fistula or extrinsic compression']])}
${N('Acute chest pain uses different management recommendations, e.g. CAD-RADS 3 warrants functional testing or admission depending on troponin and HRP. Check the consensus tables before applying in the emergency setting.')}`,
refs:[{c:'Cury RC, Leipsic J, Abbara S, et al. CAD-RADS™ 2.0 – 2022 Coronary Artery Disease-Reporting and Data System: an expert consensus document of the Society of Cardiovascular Computed Tomography (SCCT), the American College of Radiology (ACR) and the North American Society for Cardiovascular Imaging (NASCI). J Cardiovasc Comput Tomogr. 2022;16:536–557.',q:'Cury Leipsic CAD-RADS 2.0 2022 coronary artery disease reporting and data system expert consensus'}],rp:'CAD-RADS'});

add({id:'carotid-us',sec:'chest',title:'Carotid stenosis: SRU Doppler & NASCET',alias:'carotid ultrasound doppler psv edv ica cca ratio nascet stenosis',ver:'SRU 2003',tags:['US','CTA','Vascular'],
lede:'SRU consensus Doppler criteria for ICA stenosis (NASCET-equivalent percentages). ICA PSV and plaque estimate are the primary parameters.',
body:`${T(['Stenosis','ICA PSV','Plaque estimate','ICA/CCA PSV ratio','ICA EDV'],[
 ['Normal','&lt;125 cm/s','None','&lt;2.0','&lt;40 cm/s'],
 ['&lt;50%','&lt;125 cm/s','&lt;50%','&lt;2.0','&lt;40 cm/s'],
 ['50–69%','125–230 cm/s','≥50%','2.0–4.0','40–100 cm/s'],
 ['≥70% (not near occlusion)','&gt;230 cm/s','≥50%','&gt;4.0','&gt;100 cm/s'],
 ['Near occlusion','High, low, or undetectable','Visible','Variable','Variable'],
 ['Total occlusion','Undetectable','Visible, no lumen','N/A','N/A']])}
<h3>NASCET on CTA/DSA</h3><p class="mono">% stenosis = (1 − narrowest ICA lumen ÷ normal distal cervical ICA diameter) × 100</p>
<div class="calc" id="c-nascet"><div class="calc-h">Calculate</div><div class="row">
<label for="na-r">Narrowest lumen (mm)<input id="na-r" type="number" step="0.1" min="0" value="1.5"></label>
<label for="na-d">Normal distal ICA (mm)<input id="na-d" type="number" step="0.1" min="0" value="5"></label></div>
<div class="out"><span class="lbl">NASCET</span><span class="big" id="na-o">–</span><span class="msg" id="na-m"></span></div></div>
${N('In near occlusion, the distal ICA is collapsed and NASCET underestimates severity; report as near occlusion rather than a percentage.')}`,
init(el){const u=()=>{const r=num(el.querySelector('#na-r').value),d=num(el.querySelector('#na-d').value);if(r==null||!d){el.querySelector('#na-o').textContent='–';el.querySelector('#na-m').textContent='';return}const s=Math.max(0,(1-r/d)*100);el.querySelector('#na-o').textContent=Math.round(s)+'%';el.querySelector('#na-m').innerHTML=s>=70?B('Severe ≥70%','crit'):s>=50?B('Moderate 50–69%','warn'):B('Mild <50%','ok');};el.querySelectorAll('#c-nascet input').forEach(i=>i.addEventListener('input',u));u();},
refs:[{c:'Grant EG, Benson CB, Moneta GL, et al. Carotid artery stenosis: gray-scale and Doppler US diagnosis — Society of Radiologists in Ultrasound Consensus Conference. Radiology. 2003;229:340–346.',q:'Grant Benson Moneta carotid artery stenosis gray-scale Doppler consensus conference'},{c:'North American Symptomatic Carotid Endarterectomy Trial Collaborators. Beneficial effect of carotid endarterectomy in symptomatic patients with high-grade carotid stenosis. N Engl J Med. 1991;325:445–453.',q:'beneficial effect carotid endarterectomy symptomatic patients high-grade carotid stenosis'}],rp:'carotid stenosis ultrasound'});

/* ===== BODY ===== */
add({id:'lirads',sec:'body',title:'LI-RADS CT/MRI v2018',alias:'liver hcc lr-5 lr-4 aphe washout capsule threshold growth li-rads',ver:'ACR v2018',tags:['CT','MRI','Liver'],
lede:'Applies only to patients at high risk for HCC (cirrhosis, chronic HBV, current or prior HCC). Assign LR-M, LR-TIV, LR-1/2 first; use the diagnostic table for the rest.',
body:`${T(['APHE','Size','0 additional features','1 additional feature','≥2 additional features'],[
 ['None','&lt;20 mm',B('LR-3','warn'),B('LR-4','warn'),B('LR-4','warn')],
 ['None','≥20 mm',B('LR-3','warn'),B('LR-4','warn'),B('LR-4','warn')],
 ['Nonrim','&lt;10 mm',B('LR-3','warn'),B('LR-4','warn'),B('LR-4','warn')],
 ['Nonrim','10–19 mm',B('LR-3','warn'),`${B('LR-4','warn')} capsule only<br>${B('LR-5','crit')} washout or growth`,B('LR-5','crit')],
 ['Nonrim','≥20 mm',B('LR-4','warn'),B('LR-5','crit'),B('LR-5','crit')]])}
<p style="font-size:14px;color:var(--muted)">Additional major features: nonperipheral washout · enhancing capsule · threshold growth (≥50% size increase in ≤6 months).</p>
<div class="calc" id="c-li"><div class="calc-h">Categorize</div><div class="row">
<label for="li-a">Arterial phase<select id="li-a"><option value="0">No APHE</option><option value="1" selected>Nonrim APHE</option></select></label>
<label for="li-s">Size (mm)<input id="li-s" type="number" min="0" step="1" value="15"></label></div>
<div class="checks"><label><input type="checkbox" id="li-w" checked> Nonperipheral washout</label><label><input type="checkbox" id="li-c"> Enhancing capsule</label><label><input type="checkbox" id="li-g"> Threshold growth</label></div>
<div class="out"><span class="lbl">Category</span><span class="big" id="li-o">–</span><span class="msg">Before ancillary features. Ancillary features can upgrade by one category (not to LR-5) or downgrade.</span></div></div>
<h3>Other categories</h3>
${T(['Category','Meaning'],[['LR-NC','Not categorizable: image degradation or omission'],['LR-1','Definitely benign'],['LR-2','Probably benign'],['LR-M','Probably or definitely malignant, not HCC specific (targetoid features, e.g. rim APHE, peripheral washout, delayed central enhancement)'],['LR-TIV','Tumor in vein: enhancing soft tissue in vein, regardless of parenchymal mass']])}`,
init(el){const f=()=>{const a=+el.querySelector('#li-a').value,s=num(el.querySelector('#li-s').value),w=el.querySelector('#li-w').checked,c=el.querySelector('#li-c').checked,g=el.querySelector('#li-g').checked,n=w+c+g;if(s==null)return'–';if(!a)return n?4:3;if(s<10)return n?4:3;if(s<20){if(!n)return 3;if(n>=2)return 5;return(w||g)?5:4}return n?5:4};const u=()=>{const r=f();el.querySelector('#li-o').textContent=r==='–'?'–':'LR-'+r;};el.querySelectorAll('#c-li input,#c-li select').forEach(i=>i.addEventListener('input',u));u();},
refs:[{c:'Chernyak V, Fowler KJ, Kamaya A, et al. Liver Imaging Reporting and Data System (LI-RADS) version 2018: imaging of hepatocellular carcinoma in at-risk patients. Radiology. 2018;289:816–830.',q:'Chernyak Fowler Kamaya LI-RADS version 2018 imaging hepatocellular carcinoma at-risk patients'}],rp:'LI-RADS'});

add({id:'bosniak',sec:'body',title:'Bosniak 2019',alias:'renal cyst cystic renal mass bosniak iif iii iv kidney',ver:'Bosniak v2019',tags:['CT','MRI','Kidney'],
lede:'Applies to cystic masses (&lt;25% enhancing tissue) with dedicated renal mass protocol. Wall/septum: thin ≤2 mm, minimally thickened 3 mm, thick ≥4 mm. Nodule: ≥4 mm convex protrusion with obtuse margins, or any convex protrusion with acute margins.',
body:`${T(['Class','CT criteria','Management'],[
 ['I','Thin (≤2 mm) smooth wall; homogeneous simple fluid (−9 to 20 HU); no septa or calcification; wall may enhance',B('Benign','ok')],
 ['II','<b>Six types:</b> (1) thin smooth wall with 1–3 thin septa, may enhance, any calcification; (2) homogeneous hyperattenuating ≥70 HU unenhanced; (3) homogeneous nonenhancing &gt;20 HU on renal protocol, may have calcification; (4) homogeneous −9 to 20 HU unenhanced; (5) homogeneous 21–30 HU portal venous; (6) homogeneous low attenuation too small to characterize',B('Benign','ok')],
 ['IIF','Smooth minimally thickened (3 mm) enhancing wall, or smooth minimal thickening of one or more enhancing septa, or many (≥4) smooth thin enhancing septa',B('Follow-up','warn')],
 ['III','One or more enhancing thick (≥4 mm) or enhancing irregular walls or septa (≤3 mm obtuse convex protrusion)',B('Surgery or surveillance','crit')],
 ['IV','One or more enhancing nodules (≥4 mm obtuse protrusion, or any size with acute margins)',B('Surgery or ablation','crit')]])}
<h3>Pearls</h3>${P(['Enhancement = ≥20 HU increase on CT, or unequivocal subtraction enhancement on MRI.','Calcification no longer drives classification in v2019.','IIF follow-up: imaging at 6 months, 12 months, then annually for 5 years. Malignancy rates fall to ~10% for IIF and ~50% for III in v2019 series.','Heterogeneous hyperattenuating masses or any mass not meeting cystic criteria need solid-mass workup.'])}`,
refs:[{c:'Silverman SG, Pedrosa I, Ellis JH, et al. Bosniak classification of cystic renal masses, version 2019: an update proposal and needs assessment. Radiology. 2019;292:475–488.',q:'Silverman Pedrosa Bosniak classification cystic renal masses version 2019 update proposal'}],rp:'Bosniak classification 2019'});

add({id:'adrenal',sec:'incid',title:'Adrenal incidentaloma & washout',alias:'adrenal adenoma washout absolute relative apw rpw lipid-rich incidental myelolipoma',ver:'ACR 2017',tags:['CT','MRI'],
lede:'Unenhanced attenuation ≤10 HU is diagnostic of lipid-rich adenoma. For indeterminate lesions, adrenal-protocol CT with 15-minute delayed phase calculates washout.',
body:`${FIGS(['fc-adrenal','Incidental adrenal lesion'])}<h3>Management</h3>${TREE_UI('adrenal')}
<h3>Diagnostic thresholds</h3>${T(['Finding','Interpretation'],[
 ['Unenhanced ≤10 HU',B('Lipid-rich adenoma','ok')+' No follow-up'],
 ['Absolute washout ≥60%',B('Adenoma','ok')],
 ['Relative washout ≥40% (no unenhanced phase)',B('Adenoma','ok')],
 ['Stable ≥1 year',B('Benign','ok')],
 ['Macroscopic fat',B('Myelolipoma','ok')],
 ['≥4 cm without benign features, no cancer history',B('Consider resection','crit')]])}
<p class="mono">APW = (Enhanced − Delayed) ÷ (Enhanced − Unenhanced) × 100<br>RPW = (Enhanced − Delayed) ÷ Enhanced × 100</p>
${ILLUS(['fig-adrenal-washout','Absolute and relative washout formulas'])}
<div class="calc" id="c-adr"><div class="calc-h">Washout</div><div class="row">
<label for="ad-u">Unenhanced (HU, optional)<input id="ad-u" type="number" value="25"></label>
<label for="ad-e">Portal venous, ~60–75 s (HU)<input id="ad-e" type="number" value="90"></label>
<label for="ad-d">Delayed, 15 min (HU)<input id="ad-d" type="number" value="40"></label></div>
<div class="out"><span class="lbl">APW</span><span class="big" id="ad-a">–</span><span class="lbl">RPW</span><span class="big" id="ad-r">–</span><span class="msg" id="ad-m"></span></div></div>
${N('Some pheochromocytomas, hypervascular metastases (RCC, HCC) and carcinomas can wash out. Interpret in clinical context; check biochemistry for functioning lesions.')}`,
init(el){const u=()=>{const U=num(el.querySelector('#ad-u').value),En=num(el.querySelector('#ad-e').value),D=num(el.querySelector('#ad-d').value);let apw=null,rpw=null;if(En!=null&&D!=null&&En!==0)rpw=(En-D)/En*100;if(U!=null&&En!=null&&D!=null&&En!==U)apw=(En-D)/(En-U)*100;el.querySelector('#ad-a').textContent=apw==null?'–':Math.round(apw)+'%';el.querySelector('#ad-r').textContent=rpw==null?'–':Math.round(rpw)+'%';let m='';if(U!=null&&U<=10)m=B('≤10 HU unenhanced','ok')+' Lipid-rich adenoma; washout not needed.';else if(apw!=null)m=apw>=60?B('Adenoma','ok')+' APW ≥60%':B('Indeterminate','warn')+' APW <60%';else if(rpw!=null)m=rpw>=40?B('Adenoma','ok')+' RPW ≥40%':B('Indeterminate','warn')+' RPW <40%';el.querySelector('#ad-m').innerHTML=m;};el.querySelectorAll('#c-adr input').forEach(i=>i.addEventListener('input',u));u();},
refs:[{c:'Mayo-Smith WW, Song JH, Boland GL, et al. Management of incidental adrenal masses: a white paper of the ACR Incidental Findings Committee. J Am Coll Radiol. 2017;14:1038–1044.',q:'Mayo-Smith management incidental adrenal masses white paper ACR Incidental Findings Committee'}],rp:'adrenal washout'});

add({id:'aast',sec:'body',title:'AAST solid organ injury (2018)',alias:'trauma liver spleen kidney laceration grade aast organ injury scale',ver:'AAST 2018',tags:['CT','Trauma'],
lede:'2018 revision incorporates CT vascular injury findings. Vascular injury = pseudoaneurysm or AV fistula; active bleeding = contrast extravasation increasing in delayed phase. Advance one grade for multiple injuries up to grade III.',
body:`<h3>Spleen</h3>
${T(['Grade','Findings'],[
 ['I','Subcapsular hematoma &lt;10% surface area · laceration &lt;1 cm depth · capsular tear'],
 ['II','Subcapsular hematoma 10–50% surface area · intraparenchymal hematoma &lt;5 cm · laceration 1–3 cm depth'],
 ['III','Subcapsular hematoma &gt;50% or ruptured · intraparenchymal hematoma ≥5 cm · laceration &gt;3 cm depth'],
 ['IV','Any injury with splenic vascular injury or active bleeding confined within splenic capsule · laceration of segmental/hilar vessels with &gt;25% devascularization'],
 ['V','Shattered spleen · any injury with splenic vascular injury and active bleeding extending beyond the spleen into the peritoneum']])}
<h3>Liver</h3>
${T(['Grade','Findings'],[
 ['I','Subcapsular hematoma &lt;10% surface area · laceration &lt;1 cm depth · capsular tear'],
 ['II','Subcapsular hematoma 10–50% surface area · intraparenchymal hematoma &lt;10 cm · laceration 1–3 cm depth and ≤10 cm length'],
 ['III','Subcapsular hematoma &gt;50% or ruptured with active bleeding · intraparenchymal hematoma &gt;10 cm · laceration &gt;3 cm depth · any vascular injury or active bleeding contained within liver parenchyma'],
 ['IV','Parenchymal disruption 25–75% of a hepatic lobe · active bleeding extending beyond the liver into the peritoneum'],
 ['V','Parenchymal disruption &gt;75% of a hepatic lobe · juxtahepatic venous injury (retrohepatic IVC, central major hepatic veins)']])}
<h3>Kidney</h3>
${T(['Grade','Findings'],[
 ['I','Subcapsular hematoma and/or contusion without laceration'],
 ['II','Perirenal hematoma confined to Gerota fascia · laceration ≤1 cm without urinary extravasation'],
 ['III','Laceration &gt;1 cm without collecting system rupture or urinary extravasation · any vascular injury or active bleeding contained within Gerota fascia'],
 ['IV','Laceration into collecting system with urinary extravasation · renal pelvis laceration and/or complete UPJ disruption · segmental artery or vein injury · active bleeding beyond Gerota fascia · segmental or complete infarction from vessel thrombosis without active bleeding'],
 ['V','Main renal artery or vein laceration or hilar avulsion · devascularized kidney with active bleeding · shattered kidney with loss of identifiable parenchymal anatomy']])}`,
refs:[{c:'Kozar RA, Crandall M, Shanmuganathan K, et al. Organ injury scaling 2018 update: spleen, liver, and kidney. J Trauma Acute Care Surg. 2018;85:1119–1122.',q:'Kozar Crandall Shanmuganathan organ injury scaling 2018 update spleen liver kidney'}],rp:'AAST injury scale'});

add({id:'atlanta',sec:'body',title:'Revised Atlanta: pancreatitis collections',alias:'acute pancreatitis apfc pseudocyst anc walled-off necrosis won atlanta',ver:'Banks 2013',tags:['CT','MRI','Pancreas'],
lede:'Collections are named by pancreatitis type (interstitial edematous vs necrotizing) and time from onset (4-week cutoff). Any collection can be sterile or infected; gas within it suggests infection.',
body:`${ILLUS(['fig-atlanta','Revised Atlanta collections at a glance'])}${T(['','&lt;4 weeks','≥4 weeks'],[
 ['Interstitial edematous','<b>APFC</b> acute peripancreatic fluid collection. Homogeneous fluid, no wall, adjacent to pancreas','<b>Pseudocyst</b>. Well-circumscribed, encapsulated, homogeneous fluid, no non-liquid component'],
 ['Necrotizing','<b>ANC</b> acute necrotic collection. Heterogeneous, fluid and non-liquid content, no defined wall, intra- and/or extrapancreatic','<b>WON</b> walled-off necrosis. Encapsulated, heterogeneous with non-liquid content']])}
<h3>Pearls</h3>${P(['Pseudocyst is rare after true interstitial pancreatitis; a "pseudocyst" with debris is usually WON — MRI or US shows solid debris better than CT.','Pancreatic parenchymal necrosis may not be evident until 72 h; early CT can underestimate it.','Disconnected pancreatic duct: necrosis of the neck/body with viable upstream gland; predicts recurrent collections.'])}`,
refs:[{c:'Banks PA, Bollen TL, Dervenis C, et al. Classification of acute pancreatitis — 2012: revision of the Atlanta classification and definitions by international consensus. Gut. 2013;62:102–111.',q:'Banks Bollen Dervenis classification acute pancreatitis 2012 revision Atlanta'}],rp:'revised Atlanta classification'});

add({id:'ctsi',sec:'body',title:'CT severity index (Balthazar)',alias:'ctsi balthazar grade pancreatitis necrosis severity',ver:'Balthazar 1990',tags:['CT','Pancreas'],
lede:'Balthazar grade (0–4) plus necrosis score (0–6) gives CTSI 0–10.',
body:`${T(['Balthazar grade','Finding','Points'],[
 ['A','Normal pancreas','0'],['B','Focal or diffuse enlargement','1'],['C','Pancreatic abnormality with peripancreatic inflammation','2'],['D','Single fluid collection','3'],['E','Two or more collections and/or gas','4']])}
${T(['Necrosis','Points'],[['None','0'],['≤30%','2'],['30–50%','4'],['&gt;50%','6']])}
<div class="calc" id="c-ct"><div class="calc-h">Score</div><div class="row">
<label for="ct-g">Balthazar grade<select id="ct-g"><option value="0">A · normal</option><option value="1">B · enlargement</option><option value="2" selected>C · peripancreatic inflammation</option><option value="3">D · single collection</option><option value="4">E · ≥2 collections or gas</option></select></label>
<label for="ct-n">Necrosis<select id="ct-n"><option value="0">None</option><option value="2">≤30%</option><option value="4">30–50%</option><option value="6">&gt;50%</option></select></label></div>
<div class="out"><span class="lbl">CTSI</span><span class="big" id="ct-o">–</span><span class="msg" id="ct-m"></span></div></div>
${N('Severity: 0–3 mild, 4–6 moderate, 7–10 severe. The modified CTSI (Mortele 2004) adds extrapancreatic complications and simplifies necrosis to ≤30% / &gt;30%.')}`,
init(el){const u=()=>{const s=+el.querySelector('#ct-g').value+ +el.querySelector('#ct-n').value;el.querySelector('#ct-o').textContent=s;el.querySelector('#ct-m').innerHTML=s<=3?B('Mild','ok'):s<=6?B('Moderate','warn'):B('Severe','crit');};el.querySelectorAll('#c-ct select').forEach(i=>i.addEventListener('change',u));u();},
refs:[{c:'Balthazar EJ, Robinson DL, Megibow AJ, Ranson JH. Acute pancreatitis: value of CT in establishing prognosis. Radiology. 1990;174:331–336.',q:'Balthazar Robinson Megibow Ranson acute pancreatitis value of CT establishing prognosis'},{c:'Mortele KJ, Wiesner W, Intriere L, et al. A modified CT severity index for evaluating acute pancreatitis. AJR Am J Roentgenol. 2004;183:1261–1265.',q:'Mortele modified CT severity index evaluating acute pancreatitis'}],rp:'CT severity index pancreatitis'});

add({id:'pirads',sec:'body',title:'PI-RADS v2.1',alias:'prostate mri pirads dwi adc t2 dce peripheral transition zone',ver:'v2.1 2019',tags:['MRI','Prostate'],
lede:'Dominant sequence: DWI for peripheral zone, T2W for transition zone. DCE only upgrades PZ score 3 to 4. Size cutoff for 4 vs 5 is 1.5 cm.',
body:`<h3>PZ · DWI score</h3>
${T(['Score','Finding'],[['1','Normal on ADC and high b-value'],['2','Linear or wedge-shaped hypointense on ADC and/or hyperintense on high b'],['3','Focal, mildly/moderately hypointense on ADC and/or iso/mildly hyperintense on high b; may be markedly abnormal on one but not both'],['4','Focal markedly hypointense on ADC and markedly hyperintense on high b; &lt;1.5 cm'],['5','As 4 but ≥1.5 cm, or definite extraprostatic extension/invasive behavior']])}
<h3>TZ · T2W score</h3>
${T(['Score','Finding'],[['1','Normal TZ, or round completely encapsulated nodule (typical nodule)'],['2','Mostly encapsulated nodule, or homogeneous circumscribed nodule without encapsulation (atypical nodule), or homogeneous mildly hypointense area between nodules'],['3','Heterogeneous signal with obscured margins; anything not fitting 2, 4 or 5'],['4','Lenticular or non-circumscribed, homogeneous, moderately hypointense; &lt;1.5 cm'],['5','As 4 but ≥1.5 cm, or definite extraprostatic extension/invasive behavior']])}
<div class="calc" id="c-pi"><div class="calc-h">Overall category</div><div class="row">
<label for="pi-z">Zone<select id="pi-z"><option value="pz">Peripheral zone</option><option value="tz">Transition zone</option></select></label>
<label for="pi-t">T2W score<select id="pi-t">${[1,2,3,4,5].map(i=>`<option${i===3?' selected':''}>${i}</option>`).join('')}</select></label>
<label for="pi-d">DWI score<select id="pi-d">${[1,2,3,4,5].map(i=>`<option${i===3?' selected':''}>${i}</option>`).join('')}</select></label>
<label for="pi-c">DCE<select id="pi-c"><option value="0">Negative</option><option value="1" selected>Positive</option></select></label></div>
<div class="out"><span class="lbl">PI-RADS</span><span class="big" id="pi-o">–</span><span class="msg" id="pi-m"></span></div></div>
${N('PZ: DWI 3 + DCE positive → 4. TZ: T2W 2 + DWI ≥4 → 3; T2W 3 + DWI 5 → 4. DCE positive = focal early enhancement corresponding to a T2W/DWI finding.')}`,
init(el){const u=()=>{const z=el.querySelector('#pi-z').value,t=+el.querySelector('#pi-t').value,d=+el.querySelector('#pi-d').value,c=+el.querySelector('#pi-c').value;let s;if(z==='pz'){s=d;if(d===3&&c)s=4;}else{s=t;if(t===2&&d>=4)s=3;if(t===3&&d===5)s=4;}el.querySelector('#pi-o').textContent=s;el.querySelector('#pi-m').innerHTML=s<=2?B('Clinically significant cancer unlikely','ok'):s===3?B('Equivocal','warn'):B('Clinically significant cancer likely','crit');};el.querySelectorAll('#c-pi select').forEach(i=>i.addEventListener('change',u));u();},
refs:[{c:'Turkbey B, Rosenkrantz AB, Haider MA, et al. Prostate Imaging Reporting and Data System version 2.1: 2019 update of Prostate Imaging Reporting and Data System version 2. Eur Urol. 2019;76:340–351.',q:'Turkbey Rosenkrantz Prostate Imaging Reporting Data System version 2.1 2019 update'}],rp:'PI-RADS'});

add({id:'crads',sec:'body',title:'C-RADS (CT colonography)',alias:'ct colonography virtual colonoscopy ctc c-rads polyp c0 c1 c2 c3 c4 extracolonic e0 e1 e2 e3 e4',ver:'Zalis 2005',tags:['CT','Colon'],
lede:'Colonic findings get a C category and extracolonic findings an E category; report both. Polyps are measured by the largest diameter of the head, excluding any stalk, on 2D or 3D views. Polyps under 6 mm are not reported.',
body:`${ILLUS(['fig-crads.svg','C-RADS colonic and extracolonic categories'])}
<h3>Colonic findings</h3>
${T(['Category','Findings','Management'],[
 ['C0','Inadequate prep or insufflation (cannot exclude a ≥10 mm lesion), or awaiting prior studies',B('Complete or repeat','warn')],
 ['C1','Normal colon or benign lesion; no polyp ≥6 mm. Lipoma, inverted diverticulum, diverticulosis',B('Routine screening, 5–10 yr','ok')],
 ['C2','Intermediate polyp 6–9 mm, fewer than 3; or indeterminate finding (cannot exclude ≥6 mm polyp)',B('Surveillance or colonoscopy','warn')],
 ['C3','Polyp ≥10 mm, or 3 or more polyps each 6–9 mm (possibly advanced adenoma)',B('Colonoscopy','crit')],
 ['C4','Colonic mass, likely malignant: compromises the lumen or shows extracolonic invasion',B('Surgical consultation','crit')]])}
<h3>Extracolonic findings</h3>
${T(['Category','Meaning','Examples'],[
 ['E0','Limited exam: artifact severely limits soft tissues','—'],
 ['E1','Normal exam or anatomic variant','Retroaortic left renal vein'],
 ['E2','Clinically unimportant; no work-up','Simple liver or renal cyst, cholelithiasis without cholecystitis, vertebral hemangioma'],
 ['E3','Likely unimportant, incompletely characterized; work-up per local practice and patient preference','Minimally complex or homogeneously hyperattenuating renal cyst'],
 ['E4','Potentially important; communicate to the referring physician','Solid renal mass, lymphadenopathy, aortic aneurysm, non-uniformly calcified lung nodule ≥1 cm']])}
${N('C2 surveillance: evidence supports delaying CTC follow-up at least 3 years, subject to the individual patient. Report polyp morphology (sessile, pedunculated, flat) and segment location.')}`,
refs:[{c:'Zalis ME, Barish MA, Choi JR, et al. CT colonography reporting and data system: a consensus proposal. Radiology. 2005;236:3–9.',q:'Zalis Barish Choi CT colonography reporting and data system consensus proposal'}],rp:'C-RADS'});

/* ===== MSK ===== */
add({id:'salter-harris',sec:'msk',title:'Salter–Harris fractures',alias:'physeal growth plate fracture pediatric salter harris',ver:'Salter & Harris 1963',tags:['XR','Pediatric'],
lede:'Physeal fractures in skeletally immature patients. Mnemonic SALTR: Straight across, Above, Lower, Through, Ruined/Rammed.',
body:`${T(['Type','Fracture plane','Note'],[
 ['I','Through the physis only','Radiographs may be normal; widened physis. Good prognosis'],
 ['II','Physis + metaphysis (above)','Most common (~75%). Metaphyseal fragment = Thurston Holland fragment'],
 ['III','Physis + epiphysis (below)','Intra-articular'],
 ['IV','Through metaphysis, physis and epiphysis','Intra-articular; risk of growth arrest/bar'],
 ['V','Crush injury of the physis','Often diagnosed retrospectively; worst prognosis']])}`,
refs:[{c:'Salter RB, Harris WR. Injuries involving the epiphyseal plate. J Bone Joint Surg Am. 1963;45:587–622.',q:'Salter Harris injuries involving the epiphyseal plate'}],rp:'Salter-Harris classification'});

add({id:'weber',sec:'msk',title:'Weber ankle fracture',alias:'danis weber lateral malleolus fibula syndesmosis ankle',ver:'Danis–Weber',tags:['XR','Trauma'],
lede:'Based on the level of the distal fibular fracture relative to the tibiofibular syndesmosis.',
body:`${ILLUS(['fig-weber','Weber A, B and C relative to the syndesmosis. Image: Frank Gaillard, Radiopaedia.org, CC BY-NC-SA'])}${T(['Type','Fibular fracture level','Syndesmosis'],[
 ['A','Below the syndesmosis (infrasyndesmotic)','Intact. Usually stable'],
 ['B','At the level of the syndesmosis, often spiral','Variable; assess medial clear space'],
 ['C','Above the syndesmosis','Disrupted. Unstable']])}
<h3>Pearls</h3>${P(['Medial clear space &gt;4 mm (or wider than superior clear space) indicates deltoid injury and instability.','Weber C with proximal fibular fracture and syndesmotic/medial injury = Maisonneuve; image the whole fibula.'])}`,
refs:[{c:'Weber BG. Die Verletzungen des oberen Sprunggelenkes. 2nd ed. Bern: Huber; 1972.',q:''}],rp:'Weber classification'});

add({id:'garden',sec:'msk',title:'Garden femoral neck fracture',alias:'hip fracture femoral neck garden subcapital',ver:'Garden 1961',tags:['XR','Trauma'],
lede:'Graded on AP radiograph. In practice grouped as non-displaced (I–II) vs displaced (III–IV), which drives fixation vs arthroplasty.',
body:`${T(['Type','Description','Group'],[
 ['I','Incomplete or valgus impacted',B('Non-displaced','ok')],
 ['II','Complete, non-displaced',B('Non-displaced','ok')],
 ['III','Complete, partially displaced; trabeculae malaligned',B('Displaced','crit')],
 ['IV','Complete, fully displaced; trabeculae of head realign with acetabulum',B('Displaced','crit')]])}
${N('Occult fracture with negative radiographs: MRI (T1 low-signal fracture line) is the preferred next test.')}`,
refs:[{c:'Garden RS. Low-angle fixation in fractures of the femoral neck. J Bone Joint Surg Br. 1961;43-B:647–663.',q:'Garden low-angle fixation fractures femoral neck'}],rp:'Garden classification'});

add({id:'schatzker',sec:'msk',title:'Schatzker tibial plateau',alias:'tibial plateau fracture schatzker split depression bicondylar',ver:'Schatzker 1979',tags:['XR','CT','Trauma'],
lede:'Types I–III involve the lateral plateau, IV the medial plateau, V–VI both. Higher types mean higher-energy injury.',
body:`${T(['Type','Description','Associated'],[
 ['I','Lateral plateau split (wedge), no depression','Younger, dense bone; lateral meniscus can trap in split'],
 ['II','Lateral split-depression','Most common'],
 ['III','Lateral pure depression','Older, osteoporotic bone'],
 ['IV','Medial plateau fracture','Often fracture-dislocation; check popliteal artery and peroneal nerve'],
 ['V','Bicondylar, metaphysis intact','Inverted Y pattern'],
 ['VI','Plateau fracture with metaphyseal–diaphyseal dissociation','High energy; compartment syndrome risk']])}
<h3>Report</h3>${P(['Articular depression (mm) and step-off, condylar widening, fragment count.','Lipohemarthrosis (fat–fluid level) on cross-table lateral if fracture is subtle.'])}`,
refs:[{c:'Schatzker J, McBroom R, Bruce D. The tibial plateau fracture: the Toronto experience 1968–1975. Clin Orthop Relat Res. 1979;(138):94–104.',q:'Schatzker McBroom Bruce tibial plateau fracture Toronto experience'}],rp:'Schatzker classification'});

add({id:'rockwood',sec:'msk',title:'Rockwood AC joint injury',alias:'acromioclavicular separation ac joint rockwood coracoclavicular shoulder',ver:'Rockwood 1984',tags:['XR','Trauma'],
lede:'Grades acromioclavicular injury by which ligaments are torn and where the clavicle moves. Compare coracoclavicular (CC) distance with the uninjured side.',
body:`${ILLUS(['fig-rockwood','Rockwood types I–VI. Image: Andrew Murphy, Radiopaedia.org, CC BY-NC-SA'])}
${T(['Type','Ligaments','Radiographs','Usual management'],[
 ['I','AC ligament sprain; CC intact','Normal',B('Non-operative','ok')],
 ['II','AC torn; CC intact or sprained','AC widening, mild clavicle elevation; CC distance normal',B('Non-operative','ok')],
 ['III','AC and CC torn','Clavicle elevated; CC distance increased 25–100%',B('Debated','warn')],
 ['IV','AC and CC torn','Clavicle displaced posteriorly into or through trapezius (axillary view or CT)',B('Operative','crit')],
 ['V','AC and CC torn; deltotrapezial fascia stripped','CC distance increased 100–300%',B('Operative','crit')],
 ['VI','AC and CC torn','Clavicle displaced inferiorly, subacromial or subcoracoid',B('Operative','crit')]])}
<h3>Pearls</h3>${P(['Normal CC distance is roughly 11–13 mm; a side-to-side difference over about 5 mm suggests CC ligament disruption.','Type IV is easy to miss on AP views; get an axillary view or CT when the AP looks near-normal but the exam does not.'])}`,
refs:[{c:'Rockwood CA Jr. Injuries to the acromioclavicular joint. In: Rockwood CA Jr, Green DP, eds. Fractures in Adults. 2nd ed. Philadelphia: Lippincott; 1984:860–910.',q:''}],rp:'Rockwood classification acromioclavicular'});

add({id:'odontoid',sec:'msk',title:'Odontoid fracture (Anderson–D’Alonzo)',alias:'dens fracture c2 odontoid type 2 anderson dalonzo',ver:'Anderson & D’Alonzo 1974',tags:['CT','Spine','Trauma'],
lede:'Classified by level of the fracture through C2.',
body:`${T(['Type','Level','Stability'],[
 ['I','Avulsion of the dens tip (alar ligament)',B('Usually stable','ok')+' Exclude occipitocervical dissociation'],
 ['II','Base of the dens, at junction with C2 body',B('Unstable','crit')+' Highest non-union risk'],
 ['IIA','Comminuted type II at the base (Hadley)',B('Unstable','crit')],
 ['III','Extends into the C2 vertebral body',B('Usually stable','warn')+' Good healing potential']])}
${N('Non-union risk in type II rises with displacement ≥5 mm, posterior displacement, age &gt;50 and fracture gap. Report displacement and angulation.')}`,
refs:[{c:'Anderson LD, D’Alonzo RT. Fractures of the odontoid process of the axis. J Bone Joint Surg Am. 1974;56:1663–1674.',q:'Anderson D\'Alonzo fractures of the odontoid process of the axis'}],rp:'odontoid fracture'});

add({id:'kellgren-lawrence',sec:'msk',title:'Kellgren–Lawrence osteoarthritis',alias:'kl grade knee osteoarthritis radiographic',ver:'Kellgren 1957',tags:['XR'],
lede:'Radiographic grading of osteoarthritis, most used at the knee. Grade ≥2 is the conventional threshold for definite OA.',
body:`${T(['Grade','Findings'],[
 ['0','No radiographic features of OA'],
 ['1','Doubtful joint space narrowing, possible osteophytic lipping'],
 ['2','Definite osteophytes, possible joint space narrowing'],
 ['3','Moderate multiple osteophytes, definite joint space narrowing, some sclerosis, possible bone-end deformity'],
 ['4','Large osteophytes, marked joint space narrowing, severe sclerosis, definite bone-end deformity']])}`,
refs:[{c:'Kellgren JH, Lawrence JS. Radiological assessment of osteo-arthrosis. Ann Rheum Dis. 1957;16:494–502.',q:'Kellgren Lawrence radiological assessment of osteo-arthrosis'}],rp:'Kellgren and Lawrence system'});

add({id:'modic',sec:'msk',title:'Modic endplate changes',alias:'modic type 1 2 3 vertebral endplate marrow degenerative disc',ver:'Modic 1988',tags:['MRI','Spine'],
lede:'Signal change in vertebral body marrow adjacent to degenerated discs.',
body:`${T(['Type','T1','T2','Histology'],[
 ['1','Low','High','Edema, inflammation, fibrovascular tissue'],
 ['2','High','Iso to high','Fatty marrow replacement'],
 ['3','Low','Low','Subchondral sclerosis']])}
${N('Type 1 can mimic discitis–osteomyelitis. Favor infection when the disc is T2 hyperintense and enhancing, endplates are eroded, and there is paraspinal or epidural soft tissue. DWI "claw sign" favors degenerative change.')}`,
refs:[{c:'Modic MT, Steinberg PM, Ross JS, Masaryk TJ, Carter JR. Degenerative disk disease: assessment of changes in vertebral body marrow with MR imaging. Radiology. 1988;166:193–199.',q:'Modic Steinberg Ross degenerative disk disease vertebral body marrow MR imaging'}],rp:'Modic changes'});

/* ===== BREAST & WOMEN'S ===== */
add({id:'birads',sec:'breast',title:'BI-RADS assessment categories',alias:'breast mammography ultrasound mri birads category 0 1 2 3 4a 4b 4c 5 6 density',ver:'ACR 5th ed. 2013',tags:['MG','US','MRI'],
lede:'Final assessment categories with likelihood of malignancy and management.',
body:`${ILLUS(['fig-birads-categories.svg','Assessment categories, likelihood of malignancy and breast composition'],['fig-birads-mammo.svg','Mammography lexicon: masses and calcifications'],['fig-birads-us-mri.svg','Ultrasound and MRI lexicon'])}${T(['Category','Assessment','Malignancy','Management'],[
 ['0','Incomplete: need additional imaging or prior comparison','N/A','Recall'],
 ['1','Negative','Essentially 0%',B('Routine screening','ok')],
 ['2','Benign','Essentially 0%',B('Routine screening','ok')],
 ['3','Probably benign','&gt;0% to ≤2%',B('Short-interval follow-up (6 mo)','warn')],
 ['4A','Low suspicion','&gt;2% to ≤10%',B('Tissue diagnosis','crit')],
 ['4B','Moderate suspicion','&gt;10% to ≤50%',B('Tissue diagnosis','crit')],
 ['4C','High suspicion','&gt;50% to &lt;95%',B('Tissue diagnosis','crit')],
 ['5','Highly suggestive of malignancy','≥95%',B('Tissue diagnosis','crit')],
 ['6','Known biopsy-proven malignancy','N/A','Surgical excision when appropriate']])}
<h3>Breast composition (mammography)</h3>
${T(['Code','Description'],[['a','Almost entirely fatty'],['b','Scattered areas of fibroglandular density'],['c','Heterogeneously dense, may obscure small masses'],['d','Extremely dense, lowers sensitivity']])}
${N('Subcategories 4A/4B/4C are used for mammography and US; not for MRI. Category 3 follow-up: 6, 12, 24 months (± 36) before downgrading to 2.')}`,
refs:[{c:'D’Orsi CJ, Sickles EA, Mendelson EB, Morris EA, et al. ACR BI-RADS® Atlas, Breast Imaging Reporting and Data System. 5th ed. Reston, VA: American College of Radiology; 2013.',q:''}],rp:'BI-RADS'});

add({id:'ovarian-cyst',sec:'incid',title:'Simple adnexal cyst',alias:'ovarian cyst simple cyst follow up premenopausal postmenopausal sru consensus 2019 adnexal',ver:'SRU 2019',tags:['US'],
lede:'Asymptomatic, simple-appearing adnexal cysts on ultrasound. "Superior visualization" means the whole cyst wall is clearly seen and the reader is confident the cyst is simple.',
body:`${FIGS(['fc-adnexal-pre','Premenopausal simple cyst'],['fc-adnexal-post','Postmenopausal simple cyst'])}${TREE_UI('adnexal')}
${N('Applies only to cysts that are simple on US: anechoic, smooth thin wall, posterior enhancement, no solid component or internal flow. Anything else needs O-RADS US or further characterization.')}`,
refs:[{c:'Levine D, Patel MD, Suh-Burgmann EJ, et al. Simple adnexal cysts: SRU consensus conference update on follow-up and reporting. Radiology. 2019;293:359–371.',q:'Levine Patel Suh-Burgmann simple adnexal cysts SRU consensus conference update follow-up reporting'}],rp:'simple adnexal cyst'});

add({id:'incidental-renal',sec:'incid',title:'Incidental renal mass',alias:'kidney renal mass incidental ct non-contrast contrast fat angiomyolipoma aml hyperdense cyst herts acr',ver:'ACR 2018',tags:['CT'],
lede:'For renal masses found incidentally on CT not performed with a renal mass protocol. Choose the scenario: fat-containing mass, unenhanced CT, or contrast-enhanced CT.',
body:`${FIGS(['fc-renal-fat','Fat-containing renal mass'],['fc-renal-noncon','Renal mass on non-contrast CT'],['fc-renal-con','Renal mass on contrast-enhanced CT'])}${TREE_UI('renal')}
<h3>Pearls</h3>${P(['Homogeneous −10 to 20 HU on any CT, or ≥70 HU on unenhanced CT, is benign enough to stop.','21–69 HU on unenhanced CT and &gt;20 HU on portal venous CT are the two indeterminate attenuation ranges.','Once a mass is characterized as cystic with renal mass protocol, use <a href="#bosniak">Bosniak 2019</a>.'])}`,
refs:[{c:'Herts BR, Silverman SG, Hindman NM, et al. Management of the incidental renal mass on CT: a white paper of the ACR Incidental Findings Committee. J Am Coll Radiol. 2018;15:264–273.',q:'Herts Silverman Hindman management incidental renal mass CT white paper'}],rp:'incidental renal mass'});

add({id:'incidental-liver',sec:'incid',title:'Incidental liver lesion',alias:'liver lesion incidental ct hepatic flash filling hemangioma gore acr white paper',ver:'ACR 2017',tags:['CT'],
lede:'For incidental liver lesions on CT in adults. Risk status and lesion features drive management at each size.',
body:`${FIGS(['fc-liver','Incidental liver lesion on CT'])}${TREE_UI('liver')}
<h3>Definitions</h3>
${T(['Term','Criteria'],[
 ['Benign features','Sharp margin; homogeneous low attenuation (≤20 HU) on unenhanced and/or portal venous phase; characteristic features of hemangioma, FNH, focal fatty sparing or deposition, or perfusional change'],
 ['Suspicious features','Ill-defined margins; heterogeneous density; intermediate to high attenuation on portal venous phase (&gt;20 HU); enhancement &gt;20 HU; mural thickening or nodularity; thick septa'],
 ['Flash-filling','Homogeneous arterial-phase enhancement of a small lesion, isoattenuating to blood pool; typically hemangioma but can mimic hypervascular tumor'],
 ['Low risk','No known malignancy, hepatic dysfunction, or hepatic risk factors'],
 ['High risk','Known primary malignancy with propensity for liver metastasis, cirrhosis, and/or other hepatic risk factors']])}`,
refs:[{c:'Gore RM, Pickhardt PJ, Mortele KJ, et al. Management of incidental liver lesions on CT: a white paper of the ACR Incidental Findings Committee. J Am Coll Radiol. 2017;14:1429–1437.',q:'Gore Pickhardt Mortele management incidental liver lesions CT white paper'}],rp:'incidental liver lesion'});

add({id:'incidental-spleen',sec:'incid',title:'Incidental splenic lesion',alias:'spleen splenic lesion incidental ct mri heller acr white paper',ver:'ACR 2013',tags:['CT','MRI'],
lede:'For incidental splenic lesions on CT or MRI. Benign features end the workup; otherwise prior imaging and cancer history decide the path.',
body:`${FIGS(['fc-spleen','Incidental splenic lesion on CT or MRI'])}${TREE_UI('spleen')}
${N('Benign features: homogeneous, low attenuation (&lt;20 HU), no enhancement, smooth margins. These cover cysts and hemangiomas.')}`,
refs:[{c:'Heller MT, Harisinghani M, Neitlich JD, et al. Managing incidental findings on abdominal and pelvic CT and MRI, part 3: white paper of the ACR Incidental Findings Committee II on splenic and nodal findings. J Am Coll Radiol. 2013;10:833–839.',q:'Heller Harisinghani Neitlich managing incidental findings abdominal pelvic CT MRI part 3 splenic nodal'}],rp:'incidental splenic lesion'});

/* ===== CALCULATORS ===== */
add({id:'ich-volume',sec:'calc',title:'ICH volume (ABC/2)',alias:'intracerebral hemorrhage hematoma volume abc/2 kothari',ver:'Kothari 1996',tags:['CT','Neuro'],
lede:'Ellipsoid approximation of hematoma volume. A = largest diameter on the slice with largest hemorrhage; B = diameter perpendicular to A on the same slice; C = craniocaudal extent.',
body:`<div class="calc" id="c-abc"><div class="calc-h">Volume</div><div class="row">
<label for="abc-a">A (cm)<input id="abc-a" type="number" step="0.1" min="0" value="4.2"></label>
<label for="abc-b">B (cm)<input id="abc-b" type="number" step="0.1" min="0" value="3.1"></label>
<label for="abc-c">C (cm)<input id="abc-c" type="number" step="0.1" min="0" value="3.5"></label></div>
<div class="out"><span class="lbl">Volume</span><span class="big" id="abc-o">–</span><span class="lbl">mL</span><span class="msg" id="abc-m"></span></div></div>
<h3>Measuring C by slice count</h3>${P(['Weight each slice versus the largest slice: ≥75% of the largest area counts as 1, 25–75% counts as 0.5, &lt;25% counts as 0.','C = weighted slice count × slice thickness (cm).','ICH volume ≥30 mL is a component of the ICH score; ≥60 mL is associated with high early mortality.'])}`,
init(el){const u=()=>{const a=num(el.querySelector('#abc-a').value),b=num(el.querySelector('#abc-b').value),c=num(el.querySelector('#abc-c').value);if([a,b,c].some(x=>x==null)){el.querySelector('#abc-o').textContent='–';return}const v=a*b*c/2;el.querySelector('#abc-o').textContent=fmt(v,1);el.querySelector('#abc-m').innerHTML=v>=30?B('≥30 mL','crit')+' ICH score volume point':B('<30 mL','ok');};el.querySelectorAll('#c-abc input').forEach(i=>i.addEventListener('input',u));u();},
refs:[{c:'Kothari RU, Brott T, Broderick JP, et al. The ABCs of measuring intracerebral hemorrhage volumes. Stroke. 1996;27:1304–1305.',q:'Kothari Brott Broderick ABCs of measuring intracerebral hemorrhage volumes'}],rp:'ABC/2'});

add({id:'ellipsoid',sec:'calc',title:'Ellipsoid volume & PSA density',alias:'prostate volume psa density psad ellipsoid formula 0.52 bladder thyroid volume',ver:'PI-RADS v2.1',tags:['US','MRI'],
lede:'Volume = L × W × H × π/6 (≈0.52). Used for prostate, thyroid lobes, bladder and lesions. For prostate MRI, measure maximum AP and length on mid-sagittal T2W and maximum transverse on axial T2W.',
body:`<div class="calc" id="c-el"><div class="calc-h">Volume</div><div class="row">
<label for="el-l">Length (cm)<input id="el-l" type="number" step="0.1" min="0" value="4.8"></label>
<label for="el-w">Width (cm)<input id="el-w" type="number" step="0.1" min="0" value="5.2"></label>
<label for="el-h">Height / AP (cm)<input id="el-h" type="number" step="0.1" min="0" value="3.9"></label>
<label for="el-p">PSA (ng/mL, optional)<input id="el-p" type="number" step="0.1" min="0" value="6.4"></label></div>
<div class="out"><span class="lbl">Volume</span><span class="big" id="el-o">–</span><span class="lbl">mL</span><span class="lbl" style="margin-left:12px">PSAD</span><span class="big" id="el-d">–</span><span class="msg" id="el-m"></span></div></div>
${N('PSA density ≥0.15 ng/mL/cc is a commonly used threshold favoring biopsy, especially with PI-RADS 3 lesions.')}`,
init(el){const u=()=>{const l=num(el.querySelector('#el-l').value),w=num(el.querySelector('#el-w').value),h=num(el.querySelector('#el-h').value),p=num(el.querySelector('#el-p').value);if([l,w,h].some(x=>x==null)){el.querySelector('#el-o').textContent='–';el.querySelector('#el-d').textContent='–';el.querySelector('#el-m').textContent='';return}const v=l*w*h*Math.PI/6;el.querySelector('#el-o').textContent=fmt(v,1);if(p!=null&&v>0){const d=p/v;el.querySelector('#el-d').textContent=d.toFixed(2);el.querySelector('#el-m').innerHTML=d>=0.15?B('≥0.15','warn')+' Elevated PSA density':B('<0.15','ok');}else{el.querySelector('#el-d').textContent='–';el.querySelector('#el-m').textContent='';}};el.querySelectorAll('#c-el input').forEach(i=>i.addEventListener('input',u));u();},
refs:[{c:'Turkbey B, Rosenkrantz AB, Haider MA, et al. Prostate Imaging Reporting and Data System version 2.1. Eur Urol. 2019;76:340–351.',q:'Turkbey Rosenkrantz Prostate Imaging Reporting Data System version 2.1 2019 update'}],rp:'ellipsoid formula'});

/* cross-list existing calculators in the Calculators section */
const CALC_LINKS=['aspects','tirads','lirads','pirads','spetzler-martin','ctsi','adrenal','carotid-us'];

/* ---------- state ---------- */
const store={get(k,d){try{const v=localStorage.getItem('rad.'+k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem('rad.'+k,JSON.stringify(v))}catch(e){}}};
let pins=store.get('pins',[]),recent=store.get('recent',[]);
const byId=Object.fromEntries(E.map(e=>[e.id,e]));
const secName=id=>SECTIONS.find(s=>s.id===id).name;
const inSec=sid=>E.filter(e=>e.sec===sid);

/* ---------- cases: data layer ---------- */
const CASE_SECS=[
 {id:'body',name:'Abdomen & Pelvis'},{id:'breast',name:'Breast'},{id:'cardiac',name:'Cardiac'},{id:'chest',name:'Chest'},
 {id:'hn',name:'Head & Neck'},{id:'msk',name:'MSK'},{id:'neuro',name:'Neuro'},{id:'nm',name:'Nuclear Medicine'},
 {id:'peds',name:'Pediatrics'},{id:'vascular',name:'Vascular'}];
const CASE_SEC=Object.fromEntries(CASE_SECS.map(s=>[s.id,s]));
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paras=s=>String(s||'').trim().split(/\n\s*\n/).filter(Boolean).map(p=>`<p>${esc(p).replace(/\n/g,'<br>')}</p>`).join('');
const blob=id=>'/_blob/'+id;
const imgSrc=im=>esc(im.src||blob(im.id));
let CASES=[],casesState='loading',dbNS=null,assetsNS=null,canWrite=false,FORM=null;
const casesIn=sec=>CASES.filter(c=>c.sec===sec).sort((a,b)=>(b.created||'').localeCompare(a.created||''));
const findCase=id=>CASES.find(c=>c.id===id);
const newId=()=>'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const errMsg=e=>(e&&(e.message||e.code))||'Something went wrong.';

(async()=>{
  if(window.RAD_STATIC){
    try{const r=await fetch('data/cases.json',{cache:'no-cache'});CASES=await r.json();casesState='ready'}catch(e){casesState='error'}
    onCases();return;
  }
  let c=window.claude;
  for(let i=0;i<40&&!c?.use;i++){await new Promise(r=>setTimeout(r,100));c=window.claude}
  if(!c?.use){casesState='unavailable';onCases();return}
  const [db,user]=await Promise.all([c.use('db'),c.use('user')]);
  if(!db){casesState='unavailable';onCases();return}
  dbNS=db;
  canWrite=user?!!(await user.canEdit()):false;
  if(canWrite){assetsNS=await c.use('assets');if(!assetsNS)canWrite=false}
  db.collection('cases').onSnapshot(s=>{CASES=s.docs.map(d=>({id:d.id,...d.data()}));casesState='ready';onCases()},
    e=>{casesState='error';onCases()});
  onCases();
})();
function onCases(){
  renderNav();
  const h=location.hash.slice(1);
  const isForm=h.startsWith('case-new-')||h.startsWith('case-edit-');
  if(isForm){if(!FORM)render(h);return}
  if(h===''||h==='cases'||h.startsWith('cases-')||h.startsWith('case-'))render(h);
}

/* ---------- nav ---------- */
let openSecs=store.get('open',['pinned','cases']);
let NAV={entry:null,caseSec:null,anat:null};
function renderNav(){
  const nav=document.getElementById('nav'),cur=NAV.entry;
  const curSec=cur?byId[cur].sec:null;
  const want=[curSec,NAV.caseSec?'cases':null,NAV.anat?'anatomy':null].filter(Boolean).filter(s=>!openSecs.includes(s));
  if(want.length){openSecs=[...openSecs,...want];store.set('open',openSecs)}
  const chev=`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3l5 5-5 5"/></svg>`;
  const grp=(id,name,list,isCur)=>`<details class="grp" data-sec="${id}"${openSecs.includes(id)?' open':''}><summary><span>${name}</span><span class="cnt">${list.length}</span>${chev}</summary><div class="items">${list.map(e=>`<a href="#${e.id}" class="${isCur(e)?'cur':''}">${e.title}</a>`).join('')}</div></details>`;
  let h=`<a class="home${!cur&&!NAV.caseSec&&!NAV.anat?' cur':''}" href="#">Index</a><div class="navtools"><button type="button" id="expAll">Expand all</button><button type="button" id="colAll">Collapse all</button></div>`;
  h+=`<details class="grp atlas-grp" data-sec="anatomy"${openSecs.includes('anatomy')?' open':''}><summary><span>Atlas</span><span class="cnt">${ATLAS.length}</span>${chev}</summary><div class="items">${ATLAS.map(a=>`<a href="#anatomy-${a.id}" class="${NAV.anat===a.id?'cur':''}">${a.title}</a>`).join('')}</div></details>`;
  if(pins.length)h+=grp('pinned','Pinned',pins.filter(id=>byId[id]).map(id=>byId[id]),e=>e.id===cur);
  {const list=[...inSec('calc'),...CALC_LINKS.map(i=>byId[i])];h+=grp('calc','Calculators',list,e=>e.id===cur&&e.sec==='calc').replace('class="grp"','class="grp calc-grp"')}
  h+=`<div class="navh">Body regions</div>`;
  SECTIONS.filter(s=>s.id!=='calc').forEach(s=>{h+=grp(s.id,s.name,inSec(s.id),e=>e.id===cur&&s.id===e.sec)});
  const n=casesState==='ready'?CASES.length:'';
  h+=`<a class="cases-link${NAV.caseSec?' cur':''}" href="#cases"><span>Cases</span><span class="soon">Coming soon</span></a>`;
  nav.innerHTML=h;
  nav.querySelectorAll('details.grp').forEach(d=>d.addEventListener('toggle',()=>{const id=d.dataset.sec;openSecs=d.open?[...new Set([...openSecs,id])]:openSecs.filter(x=>x!==id);store.set('open',openSecs)}));
  const setAll=o=>nav.querySelectorAll('details.grp').forEach(d=>d.open=o);
  nav.querySelector('#expAll').onclick=()=>setAll(true);
  nav.querySelector('#colAll').onclick=()=>setAll(false);
}

/* ---------- views ---------- */
const V=()=>document.getElementById('view');
const SEC_IMG={neuro:'brain',hn:'neck',chest:'thoracic',body:'abdomen',incid:'pet',msk:'kneexr',breast:'breast'};
const CASE_IMG={neuro:'brain',hn:'neck',chest:'thoracic',cardiac:'cardiac',vascular:'angio',body:'abdomen',msk:'knee',breast:'mammo',peds:'pedi',nm:'pet'};
const IMGV=k=>k?` style="--img:url('${new URL('img/sec-'+k+'.webp',document.baseURI).href}')"`:'';
const COVER=(name,count,k)=>`<div class="cover${k?'':' plain'}"${IMGV(k)}><h2>${name}</h2>${count!==''?`<span>${count}</span>`:''}</div>`;
function home(){
  const chip=ids=>`<div class="chips">${ids.filter(i=>byId[i]).map(i=>`<a href="#${i}">${byId[i].title}</a>`).join('')}</div>`;
  const quick=['neck-nodes','le-fort','fleischner','bosniak','lirads','tirads','aspects'].filter(i=>byId[i]);
  const nCases=casesState==='ready'?CASES.length:'';
  V().innerHTML=`<div class="wrap wide">
  <section class="hero2">
    <div>
      <span class="eyebrow">Reading-room reference</span>
      <h1>The classifications you look up <em>mid-read.</em></h1>
      <p>Grading systems, node stations, follow-up algorithms and calculators, each traced to its primary publication or society white paper. Press <span class="mono">/</span> to search from anywhere.</p>
      <div class="hstats"><span><b>${E.length}</b> references</span><span><b>${E.filter(e=>e.body.includes('data-tree')).length}</b> decision trees</span><span><b>${E.filter(e=>e.init).length}</b> calculators</span>${nCases!==''?`<span><b>${nCases}</b> cases</span>`:''}</div>
      <div class="quick">${quick.map(i=>`<a href="#${i}">${byId[i].title}</a>`).join('')}</div>
    </div>
    <div class="mosaic" aria-hidden="true"><div${IMGV('brain')}><small>MRI</small></div><div${IMGV('cardiac')}><small>Cardiac</small></div><div${IMGV('vascular')}><small>CTA</small></div></div>
  </section>
  ${pins.length?`<div class="strip"><h2>Pinned</h2>${chip(pins)}</div>`:''}
  ${recent.length?`<div class="strip"><h2>Recently viewed</h2>${chip(recent)}</div>`:''}
  <div class="sechead"><h2>Reference</h2></div>
  <div class="secs">${SECTIONS.filter(s=>s.id!=='calc').map(s=>`<section class="sec">${COVER(s.name,inSec(s.id).length,SEC_IMG[s.id])}<ul>${inSec(s.id).map(e=>`<li><a href="#${e.id}">${e.title}<small>${e.ver}</small></a></li>`).join('')}</ul></section>`).join('')}
  <section class="sec">${COVER('Calculators',E.filter(e=>e.init).length,null)}<ul>${E.filter(e=>e.init).map(e=>`<li><a href="#${e.id}">${e.title}<small>${secName(e.sec)}</small></a></li>`).join('')}</ul></section></div>
  <div class="sechead"><h2>Atlas</h2><a href="#anatomy">All atlases →</a></div>
  <div class="anat-cards">${ATLAS.map(a=>`<a class="csec" href="#anatomy-${a.id}">${COVER(a.title,'',a.img)}<span class="anat-sub">${a.sub}</span></a>`).join('')}</div>
  <div class="sechead"><h2>Cases</h2><span class="soon-t">Coming soon</span></div>
  ${footer()}</div>`;
}
function footer(){return `<p class="foot">Radessential summarizes published classification systems for practicing radiologists. Summaries are condensed; confirm details against the cited source before relying on them for patient care.</p>`}
function entry(e){
  const v=V(),list=inSec(e.sec),i=list.indexOf(e),prev=list[i-1],next=list[i+1];
  const pinned=pins.includes(e.id);
  const fm=e.body.match(/^<details class="figs"[\s\S]*?<\/details>/),figTop=fm?fm[0]:'',bodyRest=fm?e.body.slice(fm[0].length):e.body;
  const pm=q=>`https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(q)}`;
  const rp=q=>`https://radiopaedia.org/search?lang=us&scope=articles&q=${encodeURIComponent(q)}`;
  v.innerHTML=`<article class="wrap entry">
  <header class="ebanner"${IMGV(SEC_IMG[e.sec])}>
  <div class="crumb"><a href="#">Index</a> / ${secName(e.sec)}</div>
  <div class="ehead"><h1>${e.title}</h1><div class="acts"><button class="btn" id="pinBtn" aria-pressed="${pinned}">${pinned?'Pinned':'Pin'}</button><button class="btn" id="copyBtn">Copy link</button></div></div>
  <div class="meta"><span class="tag v">${e.ver}</span>${e.tags.map(t=>`<span class="tag">${t}</span>`).join('')}</div>
  </header>
  ${figTop}<p class="lede">${e.lede}</p>
  ${bodyRest}
  <section class="src"><h3>Sources</h3><ol>${e.refs.map(r=>`<li>${r.c}${r.q?`<span class="lk"><a href="${pm(r.q)}" target="_blank" rel="noopener">PubMed ↗</a></span>`:''}</li>`).join('')}</ol>
  <p style="font-size:14px;margin:12px 0 0">Background reading: <a href="${rp(e.rp)}" target="_blank" rel="noopener">Radiopaedia: ${e.rp} ↗</a></p></section>
  <div class="pager">${prev?`<a href="#${prev.id}"><small>Previous</small>${prev.title}</a>`:'<span></span>'}${next?`<a class="nx" href="#${next.id}"><small>Next</small>${next.title}</a>`:''}</div>
  ${footer()}</article>`;
  v.querySelectorAll('[data-tree]').forEach(t=>mountTree(t,TREES[t.dataset.tree]));
  if(e.init)e.init(v);
  v.querySelector('#pinBtn').onclick=ev=>{pins=pins.includes(e.id)?pins.filter(x=>x!==e.id):[e.id,...pins];store.set('pins',pins);const p=pins.includes(e.id);ev.currentTarget.setAttribute('aria-pressed',p);ev.currentTarget.textContent=p?'Pinned':'Pin';renderNav()};
  v.querySelector('#copyBtn').onclick=ev=>{const b=ev.currentTarget,url=location.href;const done=t=>{b.textContent=t;setTimeout(()=>b.textContent='Copy link',1500)};if(navigator.clipboard)navigator.clipboard.writeText(url).then(()=>done('Copied'),()=>done('Copy failed'));else done('Copy failed')};
  recent=[e.id,...recent.filter(x=>x!==e.id)].slice(0,8);store.set('recent',recent);
}

/* ---------- cases: views ---------- */
function casesGate(){
  if(casesState==='loading')return `<p class="empty">Loading cases…</p>`;
  if(casesState==='unavailable')return `<p class="empty">Cases are stored with the site on claude.ai and load when you're signed in there.</p>`;
  if(casesState==='error')return `<p class="empty">Cases couldn't be loaded. Reload the page to try again.</p>`;
  return '';
}
function caseCard(c){
  const img=c.images&&c.images[0];
  return `<a class="ccard" href="#case-${esc(c.id)}"><div class="cthumb">${img?`<img src="${imgSrc(img)}" alt="" loading="lazy">`:'<span>No images</span>'}</div>
  <div class="cbody"><b>${esc(c.title)}</b><div class="cmeta">${(c.modality||[]).map(m=>`<span class="tag">${esc(m)}</span>`).join('')}${c.images&&c.images.length>1?`<span class="tag">${c.images.length} images</span>`:''}</div></div></a>`;
}
function casesSoon(){
  V().innerHTML=`<div class="wrap">
  <header class="ebanner"${IMGV('brain')}><div class="crumb"><a href="#">Index</a> / Cases</div>
  <div class="ehead"><h1>Cases</h1></div></header>
  <div class="soonbox"><h2>Coming soon</h2><p>Teaching cases with images, findings and discussion are on the way.</p></div>
  </div>`;
}
function casesHome(){
  V().innerHTML=`<div class="wrap">
  <header class="ebanner"${IMGV('brain')}><div class="crumb"><a href="#">Index</a> / Cases</div>
  <div class="ehead"><h1>Cases</h1></div></header>
  <p class="lede">Teaching cases with images, findings and discussion. Diagnoses stay hidden until you reveal them, so each case works as an unknown.</p>
  ${casesGate()||`<div class="csecs">${CASE_SECS.map(s=>{const l=casesIn(s.id);return `<a class="csec" href="#cases-${s.id}">${COVER(s.name,l.length,CASE_IMG[s.id])}</a>`}).join('')}</div>
  ${CASES.length?`<h3 class="subh">Latest</h3><div class="cgrid">${[...CASES].sort((a,b)=>(b.created||'').localeCompare(a.created||'')).slice(0,6).map(caseCard).join('')}</div>`:''}`}
  </div>`;
}
function caseList(sec){
  const s=CASE_SEC[sec],l=casesIn(sec);
  V().innerHTML=`<div class="wrap">
  <header class="ebanner"${IMGV(CASE_IMG[sec])}><div class="crumb"><a href="#">Index</a> / <a href="#cases">Cases</a> / ${s.name}</div>
  <div class="ehead"><h1>${s.name} cases</h1>${canWrite?`<div class="acts"><a class="btn pri" href="#case-new-${sec}">Add case</a></div>`:''}</div></header>
  ${casesGate()||(l.length?`<div class="cgrid">${l.map(caseCard).join('')}</div>`:`<p class="empty">No ${s.name.toLowerCase()} cases yet.${canWrite?` <a href="#case-new-${sec}">Add the first one.</a>`:''}</p>`)}
  </div>`;
}
function caseView(id){
  const v=V(),c=findCase(id);
  if(!c){v.innerHTML=`<div class="wrap"><div class="crumb"><a href="#cases">Cases</a></div>${casesGate()||'<p class="empty">This case no longer exists.</p>'}</div>`;return}
  const s=CASE_SEC[c.sec]||{name:'Cases'},imgs=c.images||[];
  const refs=(c.refs||[]).filter(Boolean).map(r=>/^https?:\/\/\S+$/.test(r.trim())?`<li><a href="${esc(r.trim())}" target="_blank" rel="noopener">${esc(r.trim())}</a></li>`:`<li>${esc(r)}</li>`).join('');
  const l=casesIn(c.sec),i=l.findIndex(x=>x.id===c.id),prev=l[i-1],next=l[i+1];
  v.innerHTML=`<article class="wrap case">
  <header class="ebanner"${IMGV(CASE_IMG[c.sec])}><div class="crumb"><a href="#">Index</a> / <a href="#cases">Cases</a> / <a href="#cases-${c.sec}">${s.name}</a></div>
  <div class="ehead"><h1>${esc(c.title)}</h1>${canWrite?`<div class="acts"><a class="btn" href="#case-edit-${esc(c.id)}">Edit</a><button class="btn" type="button" id="delBtn">Delete</button></div>`:''}</div>
  <div class="meta">${(c.modality||[]).map(m=>`<span class="tag">${esc(m)}</span>`).join('')}${c.created?`<span class="tag">${esc(c.created.slice(0,10))}</span>`:''}</div></header>
  <div id="delConfirm" class="confirm" hidden><span>Delete this case and its images permanently?</span><button class="btn danger" type="button" id="delYes">Delete case</button><button class="btn" type="button" id="delNo">Keep</button><span class="st" id="delSt"></span></div>
  ${imgs.length?`<div class="gal" data-lbgroup data-dark>
    <button type="button" class="gmain" data-lb="${imgSrc(imgs[0])}" data-cap="${esc(imgs[0].caption)}"><img src="${imgSrc(imgs[0])}" alt="${esc(imgs[0].caption||c.title)}"></button>
    ${imgs[0].caption?`<p class="gcap">${esc(imgs[0].caption)}</p>`:''}
    ${imgs.length>1?`<div class="gthumbs">${imgs.slice(1).map(im=>`<button type="button" data-lb="${imgSrc(im)}" data-cap="${esc(im.caption)}"><img src="${imgSrc(im)}" alt="${esc(im.caption||'')}" loading="lazy"></button>`).join('')}</div>`:''}
  </div>`:''}
  ${c.history?`<h3>Clinical history</h3>${paras(c.history)}`:''}
  ${c.findings?`<h3>Imaging findings</h3>${paras(c.findings)}`:''}
  ${(c.diagnosis||c.discussion||refs)?`<button type="button" class="reveal" id="revealBtn" aria-expanded="false">Show diagnosis and discussion</button>
  <div id="answer" hidden>
    ${c.diagnosis?`<div class="dx"><span class="lbl">Diagnosis</span><p>${esc(c.diagnosis)}</p></div>`:''}
    ${c.discussion?`<h3>Discussion</h3>${paras(c.discussion)}`:''}
    ${refs?`<h3>References</h3><ol class="crefs">${refs}</ol>`:''}
  </div>`:''}
  <div class="pager">${prev?`<a href="#case-${esc(prev.id)}"><small>Newer</small>${esc(prev.title)}</a>`:'<span></span>'}${next?`<a class="nx" href="#case-${esc(next.id)}"><small>Older</small>${esc(next.title)}</a>`:''}</div>
  </article>`;
  const rb=v.querySelector('#revealBtn');
  if(rb)rb.onclick=()=>{const a=v.querySelector('#answer'),open=a.hidden;a.hidden=!open;rb.setAttribute('aria-expanded',open);rb.textContent=open?'Hide diagnosis and discussion':'Show diagnosis and discussion'};
  if(canWrite){
    const box=v.querySelector('#delConfirm');
    v.querySelector('#delBtn').onclick=()=>{box.hidden=false};
    v.querySelector('#delNo').onclick=()=>{box.hidden=true};
    v.querySelector('#delYes').onclick=async ev=>{
      ev.currentTarget.disabled=true;v.querySelector('#delSt').textContent='Deleting…';
      try{await dbNS.collection('cases').doc(c.id).delete();
        for(const im of imgs){try{await assetsNS.delete(im.id)}catch(e){}}
        location.hash='cases-'+c.sec;
      }catch(e){v.querySelector('#delSt').textContent='Not deleted: '+errMsg(e);ev.currentTarget.disabled=false}};
  }
}

/* ---------- cases: editor ---------- */
const OK_TYPES=['image/png','image/jpeg','image/gif','image/webp'];
function caseForm(id,sec){
  const v=V();
  if(!canWrite){v.innerHTML=`<div class="wrap"><div class="crumb"><a href="#cases">Cases</a></div>${casesGate()||'<p class="empty">Only site editors can add or edit cases.</p>'}</div>`;return}
  let orig=null;
  if(id){orig=findCase(id);if(!orig){v.innerHTML=`<div class="wrap">${casesGate()||'<p class="empty">This case no longer exists.</p>'}</div>`;return}sec=orig.sec}
  const d=orig?JSON.parse(JSON.stringify(orig)):{sec,title:'',modality:[],history:'',findings:'',diagnosis:'',discussion:'',refs:[],images:[]};
  d.images=(d.images||[]).map(im=>({id:im.id,caption:im.caption||'',src:blob(im.id)}));
  FORM={orig,d,uploaded:new Set(),pending:0};
  const fld=(k,label,hint,rows)=>`<label class="fl" for="cf-${k}"><span>${label}</span>${hint?`<small>${hint}</small>`:''}<textarea id="cf-${k}" rows="${rows}">${esc(d[k])}</textarea></label>`;
  v.innerHTML=`<div class="wrap cform">
  <div class="crumb"><a href="#cases">Cases</a> / ${orig?'Edit case':'New case'}</div>
  <div class="ehead"><h1>${orig?'Edit case':'New case'}</h1></div>
  <form id="cf" novalidate>
  <div class="frow">
    <label class="fl" for="cf-sec"><span>Section</span><select id="cf-sec">${CASE_SECS.map(s=>`<option value="${s.id}"${s.id===d.sec?' selected':''}>${s.name}</option>`).join('')}</select></label>
    <label class="fl" for="cf-mod"><span>Modality</span><small>Comma-separated, e.g. CT, MRI</small><input id="cf-mod" type="text" value="${esc((d.modality||[]).join(', '))}"></label>
  </div>
  <label class="fl" for="cf-title"><span>Case title</span><small>Shown in lists. Keep the diagnosis out of it to use the case as an unknown, e.g. "54M with sudden headache".</small><input id="cf-title" type="text" value="${esc(d.title)}" required></label>
  <div class="fl"><span>Images</span><small>PNG, JPEG, GIF or WebP, up to 20 MB each. The first image is the cover. Use de-identified images only.</small>
    <div class="drop" id="cf-drop"><input id="cf-files" type="file" accept="${OK_TYPES.join(',')}" multiple><label for="cf-files" class="btn">Choose images</label><span>or drop them here</span></div>
    <div class="edimgs" id="cf-imgs"></div></div>
  ${fld('history','Clinical history','',3)}
  ${fld('findings','Imaging findings','Leave a blank line between paragraphs.',6)}
  <label class="fl" for="cf-diagnosis"><span>Diagnosis</span><small>Hidden until the reader reveals it.</small><input id="cf-diagnosis" type="text" value="${esc(d.diagnosis)}"></label>
  ${fld('discussion','Discussion','Teaching points, differential, pitfalls. Hidden with the diagnosis.',8)}
  <label class="fl" for="cf-refs"><span>References</span><small>One per line. Full URLs become links.</small><textarea id="cf-refs" rows="3">${esc((d.refs||[]).join('\n'))}</textarea></label>
  <label class="chk"><input type="checkbox" id="cf-deid"${orig?' checked':''}> All images and text are de-identified: no names, MRNs, accession numbers, dates of birth or burned-in identifiers.</label>
  <div class="fbar"><button type="submit" class="btn pri" id="cf-save">${orig?'Save changes':'Publish case'}</button><button type="button" class="btn" id="cf-cancel">Cancel</button><span class="st" id="cf-st" role="status"></span></div>
  </form></div>`;
  const imgsEl=v.querySelector('#cf-imgs'),st=v.querySelector('#cf-st');
  const drawImgs=()=>{
    imgsEl.innerHTML=d.images.map((im,i)=>`<div class="edimg"><img src="${esc(im.src)}" alt=""><input type="text" id="cf-cap-${i}" data-cap="${i}" placeholder="Caption (series, sequence, finding)" value="${esc(im.caption)}" aria-label="Caption for image ${i+1}">
      <div class="edbtns"><button type="button" class="btn" data-mv="${i}" data-dir="-1" ${i===0?'disabled':''} aria-label="Move earlier">←</button><button type="button" class="btn" data-mv="${i}" data-dir="1" ${i===d.images.length-1?'disabled':''} aria-label="Move later">→</button><button type="button" class="btn" data-rm="${i}">Remove</button></div></div>`).join('')+
      (FORM.pending?`<div class="edimg busy">Uploading ${FORM.pending}…</div>`:'');
  };
  imgsEl.addEventListener('input',ev=>{const i=ev.target.dataset.cap;if(i!=null)d.images[+i].caption=ev.target.value});
  imgsEl.addEventListener('click',ev=>{const b=ev.target.closest('button');if(!b)return;
    if(b.dataset.rm!=null){d.images.splice(+b.dataset.rm,1)}
    else if(b.dataset.mv!=null){const i=+b.dataset.mv,j=i+ +b.dataset.dir;[d.images[i],d.images[j]]=[d.images[j],d.images[i]]}
    drawImgs()});
  const upload=async files=>{
    for(const f of files){
      if(!OK_TYPES.includes(f.type)){st.textContent=`${f.name}: use PNG, JPEG, GIF or WebP.`;continue}
      if(f.size>20*1024*1024){st.textContent=`${f.name} is over 20 MB.`;continue}
      FORM.pending++;drawImgs();
      try{const r=await assetsNS.upload(f);FORM.uploaded.add(r.id);d.images.push({id:r.id,caption:'',src:r.url});st.textContent=''}
      catch(e){st.textContent=`${f.name} didn't upload: ${errMsg(e)}`}
      FORM.pending--;drawImgs();
    }
  };
  v.querySelector('#cf-files').addEventListener('change',ev=>{upload([...ev.target.files]);ev.target.value=''});
  const drop=v.querySelector('#cf-drop');
  drop.addEventListener('dragover',ev=>{ev.preventDefault();drop.classList.add('over')});
  drop.addEventListener('dragleave',()=>drop.classList.remove('over'));
  drop.addEventListener('drop',ev=>{ev.preventDefault();drop.classList.remove('over');upload([...ev.dataTransfer.files])});
  drawImgs();
  v.querySelector('#cf-cancel').onclick=()=>{location.hash=orig?'case-'+orig.id:'cases-'+d.sec};
  v.querySelector('#cf').addEventListener('submit',async ev=>{
    ev.preventDefault();
    const val=k=>v.querySelector('#cf-'+k).value.trim();
    if(!val('title')){st.textContent='Add a case title.';v.querySelector('#cf-title').focus();return}
    if(FORM.pending){st.textContent='Wait for images to finish uploading.';return}
    if(!v.querySelector('#cf-deid').checked){st.textContent='Confirm the case is de-identified before publishing.';return}
    const now=new Date().toISOString();
    const body={sec:val('sec'),title:val('title'),modality:val('mod').split(',').map(x=>x.trim()).filter(Boolean),
      history:val('history'),findings:val('findings'),diagnosis:val('diagnosis'),discussion:val('discussion'),
      refs:val('refs').split('\n').map(x=>x.trim()).filter(Boolean),
      images:d.images.map(im=>({id:im.id,caption:im.caption.trim()})),created:orig&&orig.created||now,updated:now};
    const cid=orig?orig.id:newId(),btn=v.querySelector('#cf-save');
    btn.disabled=true;st.textContent='Saving…';
    try{
      await dbNS.collection('cases').doc(cid).set(body);
      const keep=new Set(body.images.map(im=>im.id));
      const dropped=[...(orig&&orig.images||[]).map(im=>im.id),...FORM.uploaded].filter(x=>!keep.has(x));
      FORM=null;
      for(const a of new Set(dropped)){try{await assetsNS.delete(a)}catch(e){}}
      location.hash='case-'+cid;
    }catch(e){btn.disabled=false;st.textContent='Not saved: '+errMsg(e)}
  });
}
async function discardForm(){
  if(!FORM)return;const f=FORM;FORM=null;
  const keep=new Set((f.orig&&f.orig.images||[]).map(im=>im.id));
  for(const a of f.uploaded)if(!keep.has(a)){try{await assetsNS.delete(a)}catch(e){}}
}

/* ---------- lightbox ---------- */
const lb=document.getElementById('lb');let LB={list:[],i:0};
function lbShow(){const it=LB.list[LB.i];lb.querySelector('img').src=it.src;lb.querySelector('img').alt=it.cap||'';lb.querySelector('.lbcap').textContent=it.cap||'';lb.querySelector('.lbn').textContent=LB.list.length>1?`${LB.i+1} / ${LB.list.length}`:'';lb.querySelectorAll('.lbnav').forEach(b=>b.hidden=LB.list.length<2)}
document.addEventListener('click',ev=>{const b=ev.target.closest('[data-lb]');if(!b||b.closest('#lb'))return;
  const g=b.closest('[data-lbgroup]'),items=[...(g||b.parentNode).querySelectorAll('[data-lb]')];
  LB={list:items.map(x=>({src:x.dataset.lb,cap:x.dataset.cap})),i:items.indexOf(b)};
  lb.classList.toggle('paper',!(g&&g.hasAttribute('data-dark')));lb.hidden=false;lbShow();lb.querySelector('.lbx').focus()});
const lbMove=d=>{LB.i=(LB.i+d+LB.list.length)%LB.list.length;lbShow()};
lb.addEventListener('click',ev=>{const b=ev.target.closest('button');if(b){if(b.classList.contains('lbx'))lb.hidden=true;else lbMove(+b.dataset.d);return}if(ev.target===lb)lb.hidden=true});
document.addEventListener('keydown',ev=>{if(lb.hidden)return;if(ev.key==='Escape')lb.hidden=true;else if(ev.key==='ArrowRight')lbMove(1);else if(ev.key==='ArrowLeft')lbMove(-1)});

/* ---------- anatomy viewer ---------- */
const ATLAS=[
 {id:'ct-chest',title:'CT chest',sub:'Contrast-enhanced CT, thoracic inlet to upper abdomen · 1.5 mm',img:'thoracic',
  presets:[['Mediastinum',350,40],['Lung',1500,-600],['Soft tissue',400,50],['Bone',1800,400]],defCats:['art','vein','heart','lung','gi','solid','endo','cns'],start:'Aortic arch',
  credit:'CT and expert-reviewed structure masks: TotalSegmentator dataset v2.0.1 (Wasserthal J, et al. Radiol Artif Intell 2023;5:e230024), CC BY 4.0. Display resampled to 0.75 mm in-plane.'},
 {id:'ct-abdomen',title:'CT abdomen and pelvis',sub:'Portal venous CT, liver dome to proximal femurs · 1.5 mm',img:'abdomen',
  presets:[['Soft tissue',400,50],['Narrow',250,40],['Bone',1800,400],['Lung',1500,-600]],defCats:['art','vein','gi','solid','gu','endo','muscle','cns'],start:'Pancreas',
  credit:'CT and expert-reviewed structure masks: TotalSegmentator dataset v2.0.1 (Wasserthal J, et al. Radiol Artif Intell 2023;5:e230024), CC BY 4.0. Display resampled to 0.75 mm in-plane.'},
 {id:'ct-neck',title:'CT head and neck',sub:'Contrast-enhanced CT, skull base to aortic arch · 1.5 mm',img:'neck',
  presets:[['Soft tissue',350,50],['Narrow',250,60],['Bone',2800,600],['Brain',80,40]],defCats:['art','vein','aero','endo','gi','muscle','orbit','sinus','cns'],start:'Left parotid gland',
  credit:'CT and expert-reviewed masks for the spine, thyroid, airway, oesophagus and great vessels: TotalSegmentator dataset v2.0.1 (Wasserthal J, et al. Radiol Artif Intell 2023;5:e230024), CC BY 4.0. Glands, pharynx, mandible, sinuses, muscles, cartilages, internal carotid arteries and jugular veins: TotalSegmentator head and neck models (Apache-2.0), automatic segmentation, borders approximate. Display resampled to 0.75 mm in-plane.'},
 {id:'mra-brain',minMM:2,title:'MRA brain arteries',sub:'3D time-of-flight MRA · 0.3 mm · 40 named arteries',img:'atlas-mra',mip:[10,20],
  presets:[['Standard',255,128],['Vessels',170,170]],defCats:['ant','post','comm','eca'],start:'Anterior communicating artery',
  credit:'Images and expert vessel labels: TopBrain 2025 challenge data (University Hospital Zurich; TopCoW/TopBrain challenge organisers), open use for non-commercial purposes with attribution. Circle of Willis complete in this case.'},
 {id:'cta-brain',minMM:3,title:'CTA head vessels',sub:'CT angiography · 0.5 mm · arteries, deep veins and sinuses',img:'atlas-cta',mip:[10,20],
  presets:[['Angio',700,200],['Brain',80,40],['Bone',2800,600]],defCats:['ant','post','comm','eca','vein'],start:'Basilar artery',
  credit:'Images and expert vessel labels: TopBrain 2025 challenge data (University Hospital Zurich; TopCoW/TopBrain challenge organisers), open use for non-commercial purposes with attribution. '},
 {id:'mri-brain',title:'MRI brain',sub:'T1- and T2-weighted MNI ICBM152 template · 1 mm · 97 regions',img:'atlas-brain',
  presets:[['T1',235,120],['Grey–white',150,150],['Full range',255,128]],
  series:[{name:'T1',key:'ct',presets:[['Standard',235,120],['Grey–white contrast',150,150]]},{name:'T2',key:'img2',presets:[['Standard',240,125],['Grey–white contrast',150,110]]}],defCats:['frontal','parietal','temporal','occipital','limbic','insula','deep','csf','cereb','stem'],start:'Left hippocampus',
  credit:'MRI: MNI ICBM152 2009c nonlinear symmetric template (Fonov V, et al. NeuroImage 2011;54:313–327), Copyright (C) 1993–2004 Louis Collins, McConnell Brain Imaging Centre, Montreal Neurological Institute, McGill University. Labels: CerebrA atlas (Manera AL, et al. Sci Data 2020;7:237), CC0; cortical regions follow the Desikan–Killiany–Tourville protocol. White matter from the template tissue map. Display resampled to 0.5 mm.'},
 {id:'mri-cspine',title:'MRI cervical spine',sub:'3D T2-weighted, healthy volunteer, 3 T · 0.8 mm isotropic',img:'atlas-cspine',startPlane:'sag',
  presets:[['T2',255,128]],defCats:['bone','disc','cns'],start:'C4 vertebra',
  credit:'MRI and expert-corrected spinal cord segmentation and disc labels: Spine Generic public database (Cohen-Adad J, et al. Sci Data 2021;8:219), CC BY 4.0. Vertebrae and disc outlines: TotalSegmentator MR models (Apache-2.0), automatic, borders approximate.'},
 {id:'mri-spine',title:'MRI lumbar spine',sub:'Sagittal T2-weighted, 3 T, healthy discs · 3.3 mm sections',img:'atlas-spine',
  presets:[['T2',255,128]],defCats:['bone','disc','cns'],start:'L3 vertebra',
  credit:'MRI and expert segmentations: SPIDER dataset (van der Graaf JW, et al. Sci Data 2024;11:264), CC BY 4.0. SPIDER numbers vertebrae upward from the lowest lumbar level; levels here assume five lumbar vertebrae.'}
];
const lcName=n=>/^[A-Z]\d/.test(n)?n:n.charAt(0).toLowerCase()+n.slice(1);
const ATLAS_BY=Object.fromEntries(ATLAS.map(a=>[a.id,a]));
const ANAT_CACHE={};
let ANAT=null;
async function anatLoad(id,onProgress){
  if(ANAT_CACHE[id])return ANAT_CACHE[id];
  const base='anatomy/'+id+'/';
  const meta=await (await fetch(base+'meta.json')).json();
  const [Z,H,W]=meta.shape;
  const chunks=meta.chunks||[{ct:'ct.png',lab:'labels.png',z0:0,n:Z,cols:meta.cols}];
  const totalFiles=chunks.length*(chunks[0].img2?3:2);let doneFiles=0;
  const ct=new Uint8Array(Z*H*W),lab=new Uint8Array(Z*H*W),img2=chunks[0].img2?new Uint8Array(Z*H*W):null;
  const get=async(f,c,out)=>{
    const r=await fetch(base+f);if(!r.ok)throw new Error(f+' '+r.status);
    const blob=await r.blob();
    const bmp=await createImageBitmap(blob,{colorSpaceConversion:'none',premultiplyAlpha:'none'});
    const cv=document.createElement('canvas');cv.width=bmp.width;cv.height=bmp.height;const g=cv.getContext('2d',{willReadFrequently:true});g.drawImage(bmp,0,0);
    const px=g.getImageData(0,0,cv.width,cv.height).data;
    for(let i=0;i<c.n;i++){const z=c.z0+i,r0=Math.floor(i/c.cols)*H,c0=(i%c.cols)*W;for(let y=0;y<H;y++){let si=((r0+y)*cv.width+c0)*4,di=(z*H+y)*W;for(let x=0;x<W;x++,si+=4)out[di+x]=px[si]}}
    doneFiles++;onProgress('Loading scan',doneFiles/totalFiles);
  };
  // load chunks a few at a time
  const jobs=[];chunks.forEach(c=>{jobs.push(()=>get(c.ct,c,ct));jobs.push(()=>get(c.lab,c,lab));if(img2)jobs.push(()=>get(c.img2,c,img2))});
  let next=0;const worker=async()=>{while(next<jobs.length){const j=jobs[next++];await j()}};
  await Promise.all([worker(),worker(),worker(),worker()]);

  const S={};meta.structures.forEach(s=>S[s.id]=s);
  // per-label voxel counts along each axis (for best slice in every plane)
  const area=new Uint32Array(256*Z),a1=new Uint32Array(256*H),a2=new Uint32Array(256*W);
  for(let z=0,i=0;z<Z;z++)for(let y=0;y<H;y++)for(let x=0;x<W;x++,i++){const l=lab[i];if(l){area[l*Z+z]++;a1[l*H+y]++;a2[l*W+x]++}}
  const bestOf=(arr,n,id)=>{let b=0,bz=0;for(let k=0;k<n;k++){const a=arr[id*n+k];if(a>b){b=a;bz=k}}return [bz,b]};
  meta.structures.forEach(s=>{const [b0,m0]=bestOf(area,Z,s.id);s.best=b0;s.maxArea=m0;s.bestP=[b0,bestOf(a1,H,s.id)[0],bestOf(a2,W,s.id)[0]]});
  const verts=meta.structures.filter(s=>/^(C|T|L|S)\d+ vertebra$/.test(s.name));
  const level=new Array(Z).fill('');
  if(meta.scroll!=='sagittal')for(let z=0;z<Z;z++){let b=0;verts.forEach(v=>{const a=area[v.id*Z+z];if(a>b){b=a;level[z]=v.name.split(' ')[0]}})}
  const midY=Math.round(H*(meta.scoutRow||0.52)),mr=meta.modality!=='CT',half=mr?2:3;
  const scout=new Uint8Array(Z*W);
  for(let z=0;z<Z;z++)for(let x=0;x<W;x++){let m=0,sum=0,n=0;for(let y=midY-half;y<=midY+half;y++){const v=ct[z*H*W+y*W+x];if(v>m)m=v;sum+=v;n++}scout[(Z-1-z)*W+x]=mr?Math.round(sum/n):m}
  const lut=new Float32Array(meta.lut);
  return ANAT_CACHE[id]={meta,ct,lab,S,area,level,scout,lut,Z,H,W,vols:{ct,img2}};
}
// viewing planes: fix = volume axis held constant (0 z, 1 row, 2 col); r/c = [axis, flip] for image rows/cols
function anatPlanes(scroll){
  return scroll==='sagittal'
    ?[{k:'sag',name:'Sagittal',fix:0,r:[1,0],c:[2,0]}]   // thick sagittal sections: reformats would be too coarse to read
    :[{k:'ax',name:'Axial',fix:0,r:[1,0],c:[2,0]},{k:'cor',name:'Coronal',fix:1,r:[0,1],c:[2,0]},{k:'sag',name:'Sagittal',fix:2,r:[0,1],c:[1,0]}];
}
function anatCentre(D,fix){
  const n=[D.Z,D.H,D.W][fix];let sum=0,cnt=0;
  if(fix===2){for(let z=0;z<D.Z;z+=4)for(let y=0;y<D.H;y+=4)for(let x=0;x<D.W;x+=2){if(D.lab[(z*D.H+y)*D.W+x]){sum+=x;cnt++}}}
  else{for(let z=0;z<D.Z;z+=4)for(let y=0;y<D.H;y+=2)for(let x=0;x<D.W;x+=4){if(D.lab[(z*D.H+y)*D.W+x]){sum+=y;cnt++}}}
  return cnt?Math.round(sum/cnt):Math.floor(n/2);
}
function anatSlice(D,p,idx,vol,slab){
  vol=vol||D.ct;
  if(slab>0){  // maximum-intensity projection over idx±slab; label = labelled voxel with the highest signal
    const n=[D.Z,D.H,D.W][p.fix],out=anatSlice(D,p,idx,vol,0),N=out.R*out.C,lv=new Uint8Array(N);
    for(let i=0;i<N;i++)lv[i]=out.lab[i]?out.img[i]:0;
    for(let d=-slab;d<=slab;d++){const j=idx+d;if(!d||j<0||j>=n)continue;const t=anatSlice(D,p,j,vol,0);
      for(let i=0;i<N;i++){const v=t.img[i];if(v>out.img[i])out.img[i]=v;if(t.lab[i]&&v>lv[i]){lv[i]=v;out.lab[i]=t.lab[i]}}}
    return out;
  }
  const dims=[D.Z,D.H,D.W],str=[D.H*D.W,D.W,1],sp=D.meta.spacing;
  const R=dims[p.r[0]],C=dims[p.c[0]],img=new Uint8Array(R*C),lab=new Uint8Array(R*C);
  const base=idx*str[p.fix],sr=str[p.r[0]],sc=str[p.c[0]];
  for(let r=0;r<R;r++){const rr=p.r[1]?R-1-r:r;for(let c=0;c<C;c++){const cc=p.c[1]?C-1-c:c;const i=base+rr*sr+cc*sc;img[r*C+c]=vol[i];lab[r*C+c]=D.lab[i]}}
  return {img,lab,R,C,mmR:sp[p.r[0]],mmC:sp[p.c[0]],n:dims[p.fix]};
}
// crisp outline of one label on one slice (marching squares through pixel centres)
const anatRank=n=>{const m=/^(C|T|L|S)(\d+)/.exec(n);return m?'CTLS'.indexOf(m[1])*100+(+m[2]):null};
const anatCmp=(a,b)=>{const x=anatRank(a.name),y=anatRank(b.name);return x!==null&&y!==null?x-y:a.name.localeCompare(b.name,undefined,{numeric:true})};
function anatContour(lab,off,W,H,k){
  const segs=[];const at=(x,y)=>x>=0&&y>=0&&x<W&&y<H&&lab[off+y*W+x]===k?1:0;
  for(let y=-1;y<H;y++)for(let x=-1;x<W;x++){
    const a=at(x,y),b=at(x+1,y),c=at(x+1,y+1),d=at(x,y+1),code=a|b<<1|c<<2|d<<3;
    if(code===0||code===15)continue;
    const T=[x+1,y+.5],R=[x+1.5,y+1],B=[x+1,y+1.5],L=[x+.5,y+1];
    switch(code){case 1:case 14:segs.push(L,T);break;case 2:case 13:segs.push(T,R);break;case 3:case 12:segs.push(L,R);break;
      case 4:case 11:segs.push(R,B);break;case 6:case 9:segs.push(T,B);break;case 7:case 8:segs.push(L,B);break;
      case 5:segs.push(L,T,R,B);break;case 10:segs.push(T,R,B,L);break}
  }
  return segs;
}

function anatomyHome(){
  V().innerHTML=`<div class="wrap wide">
  <header class="ebanner"${IMGV('brain')}><div class="crumb"><a href="#">Index</a> / Atlas</div><div class="ehead"><h1>Atlas</h1></div></header>
  <p class="lede">Scroll through CT and MRI and hover over anything to name it. Every structure is outlined on every slice, with a quiz mode to test yourself.</p>
  <div class="anat-cards">${ATLAS.map(a=>`<a class="csec" href="#anatomy-${a.id}">${COVER(a.title,'',a.img)}<span class="anat-sub">${a.sub}</span></a>`).join('')}</div></div>`;
}

function anatomyView(id){
  const A=ATLAS_BY[id];const v=V();
  v.innerHTML=`<div class="wrap wide anat">
  <header class="ebanner"${IMGV(A.img)}><div class="crumb"><a href="#">Index</a> / <a href="#anatomy">Atlas</a></div>
  <div class="ehead"><h1>${A.title}</h1></div><div class="meta"><span class="tag v">Interactive atlas</span><span class="tag">${A.sub}</span></div></header>
  <div class="an-shell">
  <div class="anat-bar">
    <div class="seg" role="group" aria-label="Plane" id="an-planes"></div>
    ${A.series?`<div class="seg" role="group" aria-label="Sequence">${A.series.map((x,i)=>`<button type="button" data-ser="${i}" aria-pressed="${i===0}">${x.name}</button>`).join('')}</div>`:''}
    <div class="seg" role="group" aria-label="Window" id="an-wins"></div>
    ${A.mip?`<div class="seg" role="group" aria-label="Projection">${[[0,'Slice'],...A.mip.map(m=>[m,`MIP ${m} mm`])].map(([m,t])=>`<button type="button" data-mip="${m}" aria-pressed="${!m}">${t}</button>`).join('')}</div>`:''}
    <div class="seg" role="group" aria-label="Labels"><button type="button" data-lab="all" aria-pressed="true">All labels</button><button type="button" data-lab="hover" aria-pressed="false">Hover only</button></div>
    <button type="button" class="btn" id="an-quiz" aria-pressed="false">Quiz me</button>
    <button type="button" class="btn an-max" id="an-max" aria-pressed="false" title="Expand the viewer (F)"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/></svg><span>Expand</span></button>
    <div class="an-search"><input id="an-q" type="search" placeholder="Find a structure…" autocomplete="off" aria-label="Find a structure"><div class="an-res" id="an-res" hidden></div></div>
  </div>
  <div class="anat-grid">
    <div class="an-stage" id="an-stage" tabindex="0" aria-label="Image viewer. Scroll or use arrow keys to change slice">
      <canvas id="an-cv"></canvas>
      <div class="an-hud"><span id="an-pos">Loading…</span><span id="an-lvl"></span></div>
      <div class="an-ori" id="an-ori"></div>
      <div class="an-tip" id="an-tip" hidden></div>
      <div class="an-load" id="an-load"><div class="an-prog"><i id="an-pbar"></i></div><span id="an-ptxt">Loading scan…</span></div>
      <div class="an-quiz" id="an-qz" hidden></div>
    </div>
    <aside class="an-side">
      <div class="an-scoutwrap"><canvas id="an-scout"></canvas><div class="an-scap" id="an-scap"></div></div>
      <input type="range" id="an-range" min="0" max="1" value="0" aria-label="Slice">
      <div class="an-cats" id="an-cats"></div>
      <div class="an-listh"><span>On this slice</span><span id="an-cnt"></span></div>
      <div class="an-list" id="an-list"></div>
    </aside>
  </div>
  </div>
  <p class="foot">${A.credit} Scroll with the mouse wheel, arrow keys or a vertical drag. Keys: A/C/S planes, F expand, L labels, Q quiz, 1–4 windows.</p>
  </div>`;
  const PR=()=>A.series?A.series[st.ser].presets:A.presets;
  const st={id,A,ser:0,pi:0,pos:[0,0,0],win:0,labels:'all',hover:0,sel:0,quiz:null,cats:new Set(A.defCats),D:null,score:[0,0],max:false};
  ANAT=st;
  const $=s=>v.querySelector(s);
  const root=$('.anat'),cv=$('#an-cv'),ctx=cv.getContext('2d'),stage=$('#an-stage'),tip=$('#an-tip'),sc=$('#an-scout'),rng=$('#an-range');
  const off=document.createElement('canvas'),octx=off.getContext('2d');
  const hl=document.createElement('canvas'),hctx=hl.getContext('2d');
  let geo={sx:1,sy:1,ox:0,oy:0,dpr:1},P=null,SL=null;
  const hex=c=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];
  const cur=()=>st.pos[P.fix];

  anatLoad(id,(l,f)=>{$('#an-ptxt').textContent=`${l}… ${Math.round(f*100)}%`;$('#an-pbar').style.width=Math.round(f*100)+'%'}).then(D=>{
    if(ANAT!==st)return;
    st.D=D;st.planes=anatPlanes(D.meta.scroll);
    const s0=D.meta.structures.find(s=>s.name===A.start);
    st.pos=s0?s0.bestP.slice():[Math.floor(D.Z/2),Math.floor(D.H/2),Math.floor(D.W/2)];
    $('#an-planes').hidden=st.planes.length<2;
    $('#an-planes').innerHTML=st.planes.map((p,i)=>`<button type="button" data-plane="${i}" aria-pressed="${i===0}">${p.name}</button>`).join('');
    $('#an-load').hidden=true;
    buildCats();const sp=A.startPlane?st.planes.findIndex(p=>p.k===A.startPlane):0;setPlane(sp>0?sp:0);
  }).catch(e=>{$('#an-ptxt').textContent='The atlas could not be loaded. Reload the page to try again.';console.error(e)});

  function setPlane(i){
    st.pi=i;P=st.planes[i];
    st.seen=st.seen||{};
    if(!st.seen[P.k]&&!st.jumped&&P.fix>0){const c=anatCentre(st.D,P.fix);if(c>=0)st.pos[P.fix]=c}
    st.seen[P.k]=1;
    v.querySelectorAll('[data-plane]').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.plane===i));
    const n=[st.D.Z,st.D.H,st.D.W][P.fix];rng.max=n-1;
    load();resize();draw();
  }
  function load(){const ser=A.series&&A.series[st.ser];SL=anatSlice(st.D,P,cur(),ser?st.D.vols[ser.key]:null,st.mip?Math.round(st.mip/2/st.D.meta.spacing[P.fix]):0);off.width=hl.width=SL.C;off.height=hl.height=SL.R}
  function buildCats(){
    const D=st.D,used=new Set(D.meta.structures.map(s=>s.cat));
    $('#an-cats').innerHTML=Object.entries(D.meta.cats).filter(([k])=>used.has(k)).map(([k,c])=>`<button type="button" data-cat="${k}" aria-pressed="${st.cats.has(k)}"><i style="background:${c.color}"></i>${c.name}</button>`).join('');
  }
  function resize(){
    const D=st.D;if(!D||!SL)return;
    const dpr=window.devicePixelRatio||1,r=stage.getBoundingClientRect(),w=r.width;
    const mmW=SL.C*SL.mmC,mmH=SL.R*SL.mmR;
    // side gutters hold the label columns so text never sits on the image
    const gut=st.labels==='all'&&w>=560&&!st.quiz?Math.round(Math.max(130,Math.min(250,w*(st.max?0.19:0.21)))):0;
    const iw=w-2*gut;
    const maxH=st.max?Math.max(240,window.innerHeight-r.top-14):window.innerHeight*0.8;
    const h=st.max?maxH:Math.min(iw*mmH/mmW,maxH);
    stage.style.height=h+'px';
    cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);cv.style.width=w+'px';cv.style.height=h+'px';
    const k=Math.min(iw/mmW,(h-(gut?8:0))/mmH);
    geo={sx:SL.mmC*k,sy:SL.mmR*k,ox:(w-mmW*k)/2,oy:(h-mmH*k)/2,dpr,gut,w,h};
    drawScout();
  }
  // reference image: native plane shows the coronal (or axial) projection; other planes show the native slice with a line
  function drawScout(){
    const D=st.D;if(!D||!P)return;const g=sc.getContext('2d');const sp=D.meta.spacing;
    const [,W,L]=PR()[0];const lo=L-W/2;
    let w,h,src,mmw,mmh;
    if(P.fix===0){w=D.W;h=D.Z;src=D.scout;mmw=sp[2];mmh=sp[0]}
    else{w=D.W;h=D.H;src=D.ct.subarray(st.pos[0]*D.H*D.W,(st.pos[0]+1)*D.H*D.W);mmw=sp[2];mmh=sp[1]}
    const tmp=document.createElement('canvas');tmp.width=w;tmp.height=h;const tg=tmp.getContext('2d');const im=tg.createImageData(w,h);
    for(let i=0;i<w*h;i++){const hu=D.lut[src[i]];const g8=Math.max(0,Math.min(255,(hu-lo)/W*255));im.data[i*4]=im.data[i*4+1]=im.data[i*4+2]=g8;im.data[i*4+3]=255}
    tg.putImageData(im,0,0);
    sc.width=600;sc.height=Math.round(600*(h*mmh)/(w*mmw));
    g.imageSmoothingEnabled=true;g.drawImage(tmp,0,0,sc.width,sc.height);
    g.strokeStyle='#3cc6da';g.lineWidth=2;g.beginPath();
    if(P.fix===0){const y=(D.Z-1-st.pos[0]+.5)/D.Z*sc.height;g.moveTo(0,y);g.lineTo(sc.width,y)}
    else if(P.fix===1){const y=(st.pos[1]+.5)/D.H*sc.height;g.moveTo(0,y);g.lineTo(sc.width,y)}
    else{const x=(st.pos[2]+.5)/D.W*sc.width;g.moveTo(x,0);g.lineTo(x,sc.height)}
    g.stroke();
    const other=st.planes.find(p=>p.fix===(P.fix===0?1:0));
    $('#an-scap').textContent=`${P.fix===0?(D.meta.scroll==='sagittal'?'Axial':'Coronal'):st.planes[0].name} reference · drag to move`;
    sc.style.cursor=P.fix===2?'ew-resize':'ns-resize';
  }
  function sliceStructs(){
    const D=st.D,R=SL.R,C=SL.C,L=SL.lab,mm2=SL.mmR*SL.mmC,acc={};
    for(let y=0;y<R;y++)for(let x=0;x<C;x++){const l=L[y*C+x];if(!l)continue;const a=acc[l]||(acc[l]={n:0,sx:0,sy:0});a.n++;a.sx+=x;a.sy+=y}
    const out=[];
    for(const k in acc){const s=D.S[k];if(!s||acc[k].n*mm2<Math.min(13,A.minMM||13))continue;const a=acc[k];let cx=a.sx/a.n,cy=a.sy/a.n;
      let best=1e9,bx=cx,by=cy;const rad=Math.ceil(Math.sqrt(a.n))+4;
      for(let y=Math.max(0,Math.floor(cy-rad));y<Math.min(R,cy+rad);y++)for(let x=Math.max(0,Math.floor(cx-rad));x<Math.min(C,cx+rad);x++){if(L[y*C+x]==k){const d=((x-cx)*SL.mmC)**2+((y-cy)*SL.mmR)**2;if(d<best){best=d;bx=x;by=y}}}
      out.push({s,n:a.n,mm:a.n*mm2,x:bx+.5,y:by+.5})}
    return out.sort((a,b)=>b.n-a.n);
  }
  function draw(){
    const D=st.D;if(!D||!SL)return;
    const [,W,L]=PR()[st.win],lo=L-W/2,N=SL.R*SL.C,img=octx.createImageData(SL.C,SL.R);
    const g=new Uint8ClampedArray(256);for(let i=0;i<256;i++)g[i]=(D.lut[i]-lo)/W*255;
    for(let i=0;i<N;i++){const val=g[SL.img[i]];img.data[i*4]=img.data[i*4+1]=img.data[i*4+2]=val;img.data[i*4+3]=255}
    octx.putImageData(img,0,0);
    const {sx,sy,ox,oy,dpr}=geo,dw=SL.C*sx,dh=SL.R*sy;
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#000';ctx.fillRect(0,0,cv.width,cv.height);
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(off,ox,oy,dw,dh);
    const q=st.quiz,focus=q?q.target.id:(st.hover||st.sel);
    if(focus>0&&D.S[focus]){
      const s0=D.S[focus],c=hex(D.meta.cats[s0.cat].color),hm=hctx.createImageData(SL.C,SL.R);let any=false;
      for(let i=0;i<N;i++){if(SL.lab[i]!=focus)continue;any=true;hm.data[i*4]=c[0];hm.data[i*4+1]=c[1];hm.data[i*4+2]=c[2];hm.data[i*4+3]=80}
      if(any){
        hctx.putImageData(hm,0,0);ctx.drawImage(hl,ox,oy,dw,dh);
        const segs=anatContour(SL.lab,0,SL.C,SL.R,focus);
        ctx.beginPath();for(let i=0;i<segs.length;i+=2){ctx.moveTo(ox+segs[i][0]*sx,oy+segs[i][1]*sy);ctx.lineTo(ox+segs[i+1][0]*sx,oy+segs[i+1][1]*sy)}
        ctx.lineCap='round';ctx.strokeStyle='rgba(0,0,0,.55)';ctx.lineWidth=3.2;ctx.stroke();
        ctx.strokeStyle=D.meta.cats[s0.cat].color;ctx.lineWidth=1.7;ctx.stroke();
      }
    }
    const items=sliceStructs().filter(it=>st.cats.has(it.s.cat));
    st.items=items;
    if(!q&&st.labels==='all')(geo.gut?drawGutterLabels(items):drawLabels(items));
    const n=[D.Z,D.H,D.W][P.fix],i=cur();
    $('#an-pos').textContent=`${P.name} · ${P.fix===0?n-i:i+1} of ${n}`;
    $('#an-lvl').textContent=P.fix===0&&D.level[i]?`Level ${D.level[i]}`:'';
    $('#an-ori').innerHTML=orient();
    rng.value=P.fix===0?n-1-i:i;
    renderList(items);drawScout();
  }
  function orient(){
    if(st.D.meta.scroll==='sagittal'&&P.k==='ax')return '<b class="t">A</b><b class="b">P</b>';
    if(st.D.meta.scroll==='sagittal'&&P.k==='cor')return '<b class="t">S</b><b class="b">I</b>';
    if(P.k==='ax')return '<b class="l">R</b><b class="r">L</b><b class="t">A</b><b class="b">P</b>';
    if(P.k==='cor')return '<b class="l">R</b><b class="r">L</b><b class="t">S</b><b class="b">I</b>';
    return '<b class="l">A</b><b class="r">P</b><b class="t">S</b><b class="b">I</b>';
  }
  function drawGutterLabels(items){
    const {sx,sy,ox,oy,gut,w,h}=geo,D=st.D,dw=SL.C*sx;
    const fs=st.max?12.5:11.5,lh=fs+3,gap=3,pad=8,maxTw=gut-pad*2-10;
    ctx.font=`600 ${fs}px Manrope, system-ui, sans-serif`;ctx.textBaseline='middle';
    const wrap=t=>{if(ctx.measureText(t).width<=maxTw)return [t];const ws=t.split(' ');let a='',lines=[];for(const x of ws){const tr=a?a+' '+x:x;if(ctx.measureText(tr).width>maxTw&&a){lines.push(a);a=x}else a=tr}lines.push(a);return lines.slice(0,3)};
    const cx=ox+dw/2,cols={L:[],R:[]};
    for(const it of items){if(it.mm<(A.minMM||40))continue;const px=ox+it.x*sx,py=oy+it.y*sy,lines=wrap(it.s.name);cols[px<cx?'L':'R'].push({it,px,py,lines,hh:lines.length*lh})}
    for(const side of ['L','R']){
      let c=cols[side];
      // keep the largest structures when a column cannot hold every name
      const cap=h-36;c.sort((a,b)=>b.it.mm-a.it.mm);let used=0;c=c.filter(e=>{if(used+e.hh+gap>cap)return false;used+=e.hh+gap;return true});
      c.sort((a,b)=>a.py-b.py);
      let y=28;for(const e of c){e.y=Math.max(e.py-e.hh/2,y);y=e.y+e.hh+gap}
      let lim=h-8;for(let i=c.length-1;i>=0;i--){const e=c[i];if(e.y+e.hh>lim)e.y=lim-e.hh;lim=e.y-gap}
      for(const e of c){
        const col=D.meta.cats[e.it.s.cat].color,ly=e.y+e.hh/2;
        const tx=side==='L'?gut-pad:w-gut+pad, ex=side==='L'?gut-pad+4:w-gut+pad-4;
        ctx.globalAlpha=.8;ctx.beginPath();ctx.moveTo(e.px,e.py);ctx.lineTo(side==='L'?Math.min(ox-2,e.px):Math.max(ox+dw+2,e.px),ly);ctx.lineTo(ex,ly);ctx.strokeStyle=col;ctx.lineWidth=1;ctx.stroke();ctx.globalAlpha=1;
        ctx.beginPath();ctx.arc(e.px,e.py,2.8,0,7);ctx.fillStyle=col;ctx.fill();ctx.lineWidth=1;ctx.strokeStyle='#000';ctx.stroke();
        ctx.fillStyle=e.it.s.id===st.sel||e.it.s.id===st.hover?col:'#e3edf1';ctx.textAlign=side==='L'?'right':'left';
        e.lines.forEach((t,i)=>ctx.fillText(t,tx,e.y+lh/2+i*lh+.5));
        ctx.textAlign='left';
      }
    }
  }
  function drawLabels(items){
    const {sx,sy,ox,oy}=geo,D=st.D,placed=[];
    const fs=st.max?13:11.5,th=st.max?21:19;
    ctx.font=`600 ${fs}px Manrope, system-ui, sans-serif`;ctx.textBaseline='middle';
    const W=cv.width/geo.dpr,H=cv.height/geo.dpr;
    for(const it of items){
      if(it.mm<(A.minMM||40))continue;
      const px=ox+it.x*sx,py=oy+it.y*sy,tw=ctx.measureText(it.s.name).width+14;
      const cands=[[14,-th/2],[-14-tw,-th/2],[-tw/2,-th-12],[-tw/2,12],[18,-th-6],[-18-tw,-th-6],[18,6],[-18-tw,6],[26,-th*1.6],[-26-tw,-th*1.6],[26,th*0.8],[-26-tw,th*0.8]];
      let ok=null;
      for(const [dx,dy] of cands){const r={x:px+dx,y:py+dy,w:tw,h:th};if(r.x<2||r.y<2||r.x+r.w>W-2||r.y+r.h>H-2)continue;
        if(placed.every(p=>r.x>p.x+p.w+2||r.x+r.w<p.x-2||r.y>p.y+p.h+2||r.y+r.h<p.y-2)){ok=r;break}}
      const col=D.meta.cats[it.s.cat].color;
      ctx.beginPath();ctx.arc(px,py,3.2,0,7);ctx.fillStyle=col;ctx.fill();ctx.lineWidth=1.2;ctx.strokeStyle='#000';ctx.stroke();
      if(!ok)continue;placed.push(ok);
      const ax=ok.x>px?ok.x:ok.x+ok.w,ay=ok.y+ok.h/2;
      ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(ax,ay);ctx.strokeStyle=col;ctx.lineWidth=1;ctx.stroke();
      ctx.fillStyle='rgba(6,12,16,.78)';rr(ok.x,ok.y,ok.w,ok.h,5);ctx.fill();
      ctx.fillStyle=it.s.id===st.sel?col:'#e8f1f4';ctx.fillText(it.s.name,ok.x+7,ok.y+ok.h/2+.5);
    }
  }
  function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
  function renderList(items){
    const D=st.D,box=$('#an-list');
    if(st.quiz){box.innerHTML='<p class="an-empty">Labels are hidden during the quiz.</p>';$('#an-cnt').textContent='';return}
    const by={};items.forEach(it=>(by[it.s.cat]=by[it.s.cat]||[]).push(it.s));
    $('#an-cnt').textContent=items.length;
    box.innerHTML=Object.keys(D.meta.cats).filter(k=>by[k]).map(k=>`<div class="an-grp"><div class="an-gh"><i style="background:${D.meta.cats[k].color}"></i>${D.meta.cats[k].name}</div>${by[k].sort(anatCmp).map(s=>`<button type="button" data-s="${s.id}" class="${s.id===st.sel?'on':''}">${s.name}</button>`).join('')}</div>`).join('')||'<p class="an-empty">No structures from the selected groups on this slice.</p>';
  }
  function setIdx(i){const D=st.D;if(!D)return;const n=[D.Z,D.H,D.W][P.fix];i=Math.max(0,Math.min(n-1,i));if(i!==cur()){st.pos[P.fix]=i;load();draw()}}
  const step=d=>setIdx(cur()+(P.fix===0?-d:d));   // d>0 = scroll down: inferior / posterior / leftward
  function pick(ev){
    if(!SL)return 0;const r=cv.getBoundingClientRect(),{sx,sy,ox,oy}=geo;
    const x=Math.floor((ev.clientX-r.left-ox)/sx),y=Math.floor((ev.clientY-r.top-oy)/sy);
    if(x<0||y<0||x>=SL.C||y>=SL.R)return 0;const l=SL.lab[y*SL.C+x],D=st.D;return l&&D.S[l]&&st.cats.has(D.S[l].cat)?l:0;
  }
  // ---- interaction
  stage.addEventListener('wheel',ev=>{if(!st.D)return;ev.preventDefault();st.acc=(st.acc||0)+ev.deltaY;const k=Math.trunc(st.acc/40);if(k){st.acc-=k*40;step(k)}},{passive:false});
  let dragY=null,dragI=0,moved=false;
  stage.addEventListener('pointerdown',ev=>{if(!st.D)return;dragY=ev.clientY;dragI=cur();moved=false;stage.setPointerCapture(ev.pointerId)});
  stage.addEventListener('pointermove',ev=>{
    if(!st.D)return;
    if(dragY!==null&&(ev.buttons||ev.pointerType==='touch')){const d=Math.round((ev.clientY-dragY)/4);if(Math.abs(dragY-ev.clientY)>4)moved=true;if(moved){setIdx(dragI+(P.fix===0?-d:d));tip.hidden=true;return}}
    if(st.quiz)return;
    const l=pick(ev);
    if(l!==st.hover){st.hover=l;draw()}
    if(l){const r=stage.getBoundingClientRect();tip.hidden=false;tip.textContent=st.D.S[l].name;tip.style.left=Math.min(ev.clientX-r.left+14,r.width-tip.offsetWidth-6)+'px';tip.style.top=(ev.clientY-r.top+14)+'px'}else tip.hidden=true;
  });
  stage.addEventListener('pointerup',ev=>{if(!st.D)return;const wasDrag=moved;dragY=null;moved=false;if(wasDrag)return;
    if(st.quiz&&st.quiz.mode==='find'){quizClick(pick(ev));return}
    const l=pick(ev);st.sel=l===st.sel?0:l;draw()});
  stage.addEventListener('pointerleave',()=>{tip.hidden=true;if(st.hover){st.hover=0;draw()}});
  function setMax(on){
    st.max=on;root.classList.toggle('max',on);document.body.classList.toggle('an-maxed',on);
    const b=$('#an-max');b.setAttribute('aria-pressed',on);b.querySelector('span').textContent=on?'Close':'Expand';
    requestAnimationFrame(()=>{resize();draw()});
  }
  const onKey=ev=>{
    if(ANAT!==st||!st.D)return;if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))return;
    const k=ev.key;
    if(k==='ArrowUp'||k==='ArrowLeft'){step(-1);ev.preventDefault()}
    else if(k==='ArrowDown'||k==='ArrowRight'){step(1);ev.preventDefault()}
    else if(k==='PageUp'){step(-10);ev.preventDefault()}else if(k==='PageDown'){step(10);ev.preventDefault()}
    else if(k==='Escape'&&st.max)setMax(false);
    else if(k==='f'||k==='F')setMax(!st.max);
    else if(/^[acsACS]$/.test(k)){const want={a:'ax',c:'cor',s:'sag'}[k.toLowerCase()];const i=st.planes.findIndex(p=>p.k===want);if(i>=0&&i!==st.pi)setPlane(i)}
    else if(k==='l'||k==='L')setLabels(st.labels==='all'?'hover':'all');
    else if(k==='q'||k==='Q')toggleQuiz();
    else if(/^[1-4]$/.test(k)&&PR()[+k-1])setWin(+k-1);
  };
  document.addEventListener('keydown',onKey);
  const onResize=()=>{if(ANAT===st){resize();draw()}};window.addEventListener('resize',onResize);
  st.destroy=()=>{document.removeEventListener('keydown',onKey);window.removeEventListener('resize',onResize);document.body.classList.remove('an-maxed')};
  rng.addEventListener('input',()=>{const n=+rng.max+1;setIdx(P.fix===0?n-1-(+rng.value):+rng.value)});
  let scDrag=false;
  const scMove=ev=>{const D=st.D,r=sc.getBoundingClientRect(),fy=(ev.clientY-r.top)/r.height,fx=(ev.clientX-r.left)/r.width;
    if(P.fix===0)setIdx(D.Z-1-Math.floor(fy*D.Z));else if(P.fix===1)setIdx(Math.floor(fy*D.H));else setIdx(Math.floor(fx*D.W))};
  sc.addEventListener('pointerdown',ev=>{if(!st.D)return;scDrag=true;sc.setPointerCapture(ev.pointerId);scMove(ev)});
  sc.addEventListener('pointermove',ev=>{if(scDrag)scMove(ev)});sc.addEventListener('pointerup',()=>scDrag=false);
  function renderWins(){const w=$('#an-wins');w.hidden=PR().length<2;w.innerHTML=PR().map((p,i)=>`<button type="button" data-win="${i}" aria-pressed="${i===st.win}" title="${A.series||A.id.startsWith('mri')?(i?'Narrower window: more contrast between grey and white matter':'Default brightness and contrast'):`Window ${p[1]}, level ${p[2]}`}">${p[0]}</button>`).join('')}
  renderWins();
  function setWin(i){st.win=i;v.querySelectorAll('[data-win]').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.win===i));draw()}
  function setSer(i){st.ser=i;st.win=0;v.querySelectorAll('[data-ser]').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.ser===i));renderWins();load();draw()}
  function setLabels(m){st.labels=m;v.querySelectorAll('[data-lab]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.lab===m));resize();draw()}
  v.querySelector('.anat-bar').addEventListener('click',ev=>{const b=ev.target.closest('button');if(!b||!st.D)return;
    if(b.dataset.plane!==undefined)setPlane(+b.dataset.plane);
    else if(b.dataset.ser!==undefined)setSer(+b.dataset.ser);
    else if(b.dataset.mip!==undefined){st.mip=+b.dataset.mip;v.querySelectorAll('[data-mip]').forEach(x=>x.setAttribute('aria-pressed',x===b));load();draw()}
    else if(b.dataset.win)setWin(+b.dataset.win);else if(b.dataset.lab)setLabels(b.dataset.lab);else if(b.id==='an-quiz')toggleQuiz();else if(b.id==='an-max')setMax(!st.max)});
  $('#an-cats').addEventListener('click',ev=>{const b=ev.target.closest('button');if(!b)return;const k=b.dataset.cat;st.cats.has(k)?st.cats.delete(k):st.cats.add(k);b.setAttribute('aria-pressed',st.cats.has(k));if(st.sel&&!st.cats.has(st.D.S[st.sel].cat))st.sel=0;draw()});
  const list=$('#an-list');
  list.addEventListener('mouseover',ev=>{const b=ev.target.closest('[data-s]');const l=b?+b.dataset.s:0;if(l!==st.hover){st.hover=l;draw()}});
  list.addEventListener('mouseleave',()=>{if(st.hover){st.hover=0;draw()}});
  list.addEventListener('click',ev=>{const b=ev.target.closest('[data-s]');if(!b)return;const l=+b.dataset.s;st.sel=st.sel===l?0:l;draw()});
  // search: jump to the best slice in the current plane
  const qi=$('#an-q'),qr=$('#an-res');
  qi.addEventListener('input',()=>{const D=st.D;if(!D)return;const t=qi.value.trim().toLowerCase();if(!t){qr.hidden=true;return}
    const hits=D.meta.structures.filter(s=>s.name.toLowerCase().includes(t)).slice(0,8);
    qr.hidden=false;qr.innerHTML=hits.length?hits.map(s=>`<button type="button" data-go="${s.id}"><i style="background:${D.meta.cats[s.cat].color}"></i>${s.name}</button>`).join(''):'<div class="an-empty">No match in this scan.</div>'});
  qr.addEventListener('click',ev=>{const b=ev.target.closest('[data-go]');if(!b)return;const s=st.D.S[+b.dataset.go];st.cats.add(s.cat);buildCats();st.sel=s.id;st.pos=s.bestP.slice();st.jumped=1;qi.value='';qr.hidden=true;load();draw();stage.focus()});
  qi.addEventListener('keydown',ev=>{if(ev.key==='Enter'){const b=qr.querySelector('[data-go]');if(b)b.click()}else if(ev.key==='Escape'){qi.value='';qr.hidden=true}});
  // ---- quiz
  function toggleQuiz(){
    const b=$('#an-quiz');
    if(st.quiz){st.quiz=null;b.setAttribute('aria-pressed','false');b.textContent='Quiz me';$('#an-qz').hidden=true;resize();draw();return}
    b.setAttribute('aria-pressed','true');b.textContent='End quiz';st.score=[0,0];st.sel=0;st.hover=0;tip.hidden=true;st.quiz={};resize();st.quiz=null;nextQ(false);
  }
  function nextQ(move){
    const D=st.D,n=[D.Z,D.H,D.W][P.fix];
    const pool=()=>sliceStructs().filter(it=>st.cats.has(it.s.cat)&&it.mm>=(A.minMM?A.minMM*3:135));
    if(move){for(let t=0;t<40;t++){st.pos[P.fix]=Math.floor(n*0.08+Math.random()*n*0.84);load();if(pool().length>=4)break}}
    let p=pool();if(p.length<2){st.quiz=null;$('#an-qz').hidden=false;$('#an-qz').innerHTML='<p>Not enough labelled structures here. Scroll to another slice and press Quiz me again.</p>';$('#an-quiz').setAttribute('aria-pressed','false');$('#an-quiz').textContent='Quiz me';draw();return}
    const target=p[Math.floor(Math.random()*p.length)].s;
    const mode=Math.random()<0.5?'name':'find';
    const others=D.meta.structures.filter(s=>s.id!==target.id&&s.name!==target.name);
    const same=others.filter(s=>s.cat===target.cat),rest=others.filter(s=>s.cat!==target.cat);
    const shuffle=a=>a.map(x=>[Math.random(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
    const opts=shuffle([target,...shuffle(same).slice(0,3),...shuffle(rest)].slice(0,4));
    st.quiz={target:mode==='find'?{id:-1,real:target}:target,mode,opts,done:false};renderQuiz();draw();
  }
  function renderQuiz(msg){
    const q=st.quiz,box=$('#an-qz');box.hidden=false;
    const real=q.target.real||q.target;
    const sc=`<span class="an-score">${st.score[0]} / ${st.score[1]}</span>`;
    if(q.mode==='name'){
      box.innerHTML=`<div class="an-qh"><b>Name the highlighted structure</b>${sc}</div><div class="an-opts">${q.opts.map(s=>`<button type="button" data-a="${s.id}" ${q.done?'disabled':''} class="${q.done&&s.id===real.id?'ok':''}${q.done&&q.pick===s.id&&s.id!==real.id?' bad':''}">${s.name}</button>`).join('')}</div>${q.done?`<div class="an-qf">${msg}<button type="button" class="btn pri" data-next>Next</button></div>`:''}`;
    }else{
      box.innerHTML=`<div class="an-qh"><b>Click the ${lcName(real.name)}</b>${sc}</div>${q.done?`<div class="an-qf">${msg}<button type="button" class="btn pri" data-next>Next</button></div>`:'<p class="an-qhint">Click on the image.</p>'}`;
    }
  }
  $('#an-qz').addEventListener('click',ev=>{const b=ev.target.closest('button');if(!b||!st.quiz)return;
    if(b.dataset.next!==undefined){nextQ(true);return}
    const q=st.quiz;if(q.done)return;q.pick=+b.dataset.a;q.done=true;st.score[1]++;
    const right=q.pick===q.target.id;if(right)st.score[0]++;
    renderQuiz(right?'<span class="ok">Correct.</span>':`<span class="bad">It is the ${lcName(q.target.name)}.</span>`)});
  function quizClick(l){const q=st.quiz;if(q.done)return;q.done=true;st.score[1]++;const real=q.target.real;const right=l===real.id;if(right)st.score[0]++;
    q.target=real;draw();renderQuiz(right?'<span class="ok">Correct.</span>':`<span class="bad">${l?`That is the ${lcName(st.D.S[l].name)}. `:''}The ${lcName(real.name)} is highlighted.</span>`)}
}

/* ---------- routing ---------- */
let lastHash=null;
function render(h){
  NAV={entry:null,caseSec:null,anat:null};
  if(ANAT){ANAT.destroy&&ANAT.destroy();ANAT=null}
  if(h==='anatomy'){NAV.anat='home';anatomyHome()}
  else if(h.startsWith('anatomy-')&&ATLAS_BY[h.slice(8)]){NAV.anat=h.slice(8);anatomyView(h.slice(8))}
  else if(byId[h]){NAV.entry=h;entry(byId[h])}
  else if(h==='cases'||(h.startsWith('cases-')&&CASE_SEC[h.slice(6)])){NAV.caseSec='all';casesSoon()}
  else if(h.startsWith('case-new-')&&CASE_SEC[h.slice(9)]){NAV.caseSec=h.slice(9);caseForm(null,h.slice(9))}
  else if(h.startsWith('case-edit-')){const c=findCase(h.slice(10));NAV.caseSec=c?c.sec:'all';caseForm(h.slice(10))}
  else if(h.startsWith('case-')){const c=findCase(h.slice(5));NAV.caseSec=c?c.sec:'all';caseView(h.slice(5))}
  else home();
  renderNav();
}
function route(){
  const h=location.hash.slice(1);
  if(h===lastHash)return;lastHash=h;
  if(FORM)discardForm();
  lb.hidden=true;
  render(h);
  document.body.classList.remove('navopen');
  window.scrollTo(0,0);
}

/* ---------- search ---------- */
const q=document.getElementById('q'),res=document.getElementById('results');
let hits=[],sel=0;
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[’'–—-]/g,' ');
const idx=E.map(e=>({e,t:norm(e.title),a:norm(e.alias+' '+e.tags.join(' ')+' '+e.ver+' '+secName(e.sec))}));
function search(s){
  const terms=norm(s).split(/\s+/).filter(Boolean);if(!terms.length)return[];
  const cidx=CASES.map(c=>({e:{id:'case-'+c.id,title:esc(c.title),label:'Case · '+((CASE_SEC[c.sec]||{}).name||'')},t:norm(c.title),a:norm('case cases '+(c.modality||[]).join(' ')+' '+((CASE_SEC[c.sec]||{}).name||''))}));
  const base=idx.map(x=>({e:{id:x.e.id,title:x.e.title,label:secName(x.e.sec)},t:x.t,a:x.a}));
  return [...base,...cidx].map(x=>{let sc=0;for(const t of terms){if(x.t.startsWith(t))sc+=6;else if(x.t.includes(t))sc+=4;else if(x.a.includes(t))sc+=2;else return null}return{e:x.e,sc}}).filter(Boolean).sort((a,b)=>b.sc-a.sc).slice(0,10).map(x=>x.e)}
function drawRes(){if(!q.value.trim()){res.hidden=true;return}res.hidden=false;res.innerHTML=hits.length?hits.map((e,i)=>`<a href="#${esc(e.id)}" class="${i===sel?'on':''}">${e.title}<span>${esc(e.label)}</span></a>`).join(''):`<div class="none">No match. Try a system name, organ or eponym.</div>`}
q.addEventListener('input',()=>{hits=search(q.value);sel=0;drawRes()});
q.addEventListener('keydown',ev=>{if(ev.key==='ArrowDown'){sel=Math.min(sel+1,hits.length-1);drawRes();ev.preventDefault()}else if(ev.key==='ArrowUp'){sel=Math.max(sel-1,0);drawRes();ev.preventDefault()}else if(ev.key==='Enter'&&hits[sel]){location.hash=hits[sel].id;q.value='';res.hidden=true;q.blur()}else if(ev.key==='Escape'){q.value='';res.hidden=true;q.blur()}});
res.addEventListener('click',ev=>{if(ev.target.closest('a')){q.value='';res.hidden=true}});
document.addEventListener('click',ev=>{if(!ev.target.closest('.search'))res.hidden=true});
document.addEventListener('keydown',ev=>{if(ev.key==='/'&&document.activeElement!==q&&!/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)){ev.preventDefault();q.focus()}});
document.getElementById('menuBtn').onclick=()=>document.body.classList.toggle('navopen');
document.getElementById('nav').addEventListener('click',ev=>{if(ev.target.closest('a'))document.body.classList.remove('navopen')});

window.addEventListener('hashchange',route);
route();
