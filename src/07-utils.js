// ─── UTILS ────────────────────────────────────────────────────
function setText(id,val){const el=document.getElementById(id);if(el)el.textContent=val;}
function formatDate(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function formatDateDisplay(str){
  if(!str)return'–';
  try{
    const[y,m,d]=str.split('-');
    const mn=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return`${d}/${mn[parseInt(m)-1]}/${y}`;
  }catch{return str;}
}
function esc(str){return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function showToast(msg,isError=false,isWarn=false){
  const e=document.querySelector('.toast');if(e)e.remove();
  const t=document.createElement('div');
  t.className='toast'+(isError?' error':isWarn?'':' ok');
  if(isWarn)t.style.background='#c89010';
  t.innerHTML=msg;document.body.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity .3s';setTimeout(()=>t.remove(),300);},5000);
}
