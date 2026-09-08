export type WaveAType = 'project'|'transaction'|'document'|'asset'|'automation';
export interface WaveAItem { id:string; type:WaveAType; title:string; amount?:number|undefined; date?:string|undefined; status:string; category:string; notes:string; progress?:number|undefined; createdAt:string; }
export interface WaveAState { version:1; items:WaveAItem[]; }
const KEY='quotidien-v7-wave-a';
const now=()=>new Date().toISOString();
export const labels:Record<WaveAType,string>={project:'Projets de vie',transaction:'Finances',document:'Documents',asset:'Maison',automation:'Automatisations'};
export function loadWaveA():WaveAState{try{const raw=localStorage.getItem(KEY);if(!raw)return{version:1,items:[]};const parsed=JSON.parse(raw) as Partial<WaveAState>;return{version:1,items:Array.isArray(parsed.items)?parsed.items.filter(Boolean) as WaveAItem[]:[]};}catch{return{version:1,items:[]}}}
export function saveWaveA(state:WaveAState):WaveAState{localStorage.setItem(KEY,JSON.stringify(state));return state}
export function addWaveA(state:WaveAState,input:Omit<WaveAItem,'id'|'createdAt'>):WaveAState{const item:WaveAItem={...input,id:crypto.randomUUID(),createdAt:now()};return saveWaveA({...state,items:[item,...state.items]})}
export function removeWaveA(state:WaveAState,id:string):WaveAState{return saveWaveA({...state,items:state.items.filter(item=>item.id!==id)})}
export function updateWaveA(state:WaveAState,id:string,patch:Partial<WaveAItem>):WaveAState{return saveWaveA({...state,items:state.items.map(item=>item.id===id?{...item,...patch}:item)})}
export function totals(state:WaveAState){const tx=state.items.filter(i=>i.type==='transaction');const income=tx.filter(i=>i.amount&&i.amount>0).reduce((s,i)=>s+(i.amount??0),0);const expenses=Math.abs(tx.filter(i=>i.amount&&i.amount<0).reduce((s,i)=>s+(i.amount??0),0));const projects=state.items.filter(i=>i.type==='project');const avg=projects.length?Math.round(projects.reduce((s,i)=>s+(i.progress??0),0)/projects.length):0;return{income,expenses,balance:income-expenses,avg,projects:projects.length,documents:state.items.filter(i=>i.type==='document').length,assets:state.items.filter(i=>i.type==='asset').length,automations:state.items.filter(i=>i.type==='automation').length}}
