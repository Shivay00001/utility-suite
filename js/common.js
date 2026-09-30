/* VisionQuantech Tools — shared helpers (no dependencies). */
(function(){
"use strict";
window.VQT = {
  fmt(n){ // bytes -> human
    if(n===0) return "0 B";
    const u=["B","KB","MB","GB"]; let i=0;
    while(n>=1024 && i<u.length-1){n/=1024;i++;}
    return (i? n.toFixed(n>=100?0:1):n)+" "+u[i];
  },
  pct(a,b){ return b? Math.round((1-a/b)*100):0; },
  download(blob,name){
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob); a.download=name;
    document.body.appendChild(a); a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},4000);
  },
  readAs(buf,file){ return new Promise((res,rej)=>{const r=new FileReader();
    r.onload=()=>res(r.result); r.onerror=rej;
    if(buf==="array")r.readAsArrayBuffer(file); else r.readAsDataURL(file);}); },
  loadImage(file){ return new Promise((res,rej)=>{const img=new Image();
    img.onload=()=>res(img); img.onerror=()=>rej(new Error("Could not read image"));
    img.src=URL.createObjectURL(file);}); },
  // Wire a .drop zone to a hidden file input + file list callback
  dropzone(el,{accept,multiple,onFiles}){
    const input=el.querySelector('input[type=file]');
    el.addEventListener("click",()=>input.click());
    ["dragover","dragenter"].forEach(e=>el.addEventListener(e,ev=>{ev.preventDefault();el.classList.add("over");}));
    ["dragleave","drop"].forEach(e=>el.addEventListener(e,ev=>{ev.preventDefault();el.classList.remove("over");}));
    el.addEventListener("drop",ev=>onFiles([...ev.dataTransfer.files]));
    input.addEventListener("change",()=>onFiles([...input.files]));
  },
  progress(el,frac){ // frac 0..1 or null to hide
    if(frac==null){el.classList.remove("show");return;}
    el.classList.add("show"); el.firstElementChild.style.width=Math.round(frac*100)+"%";
  },
  // AdSense placeholder: replace with real (adsbygoogle=...).push({}) after approval
  ads(){ document.querySelectorAll(".adslot").forEach(s=>{
    /* <!-- ADSENSE: paste your <ins class="adsbygoogle"> unit here, then call (adsbygoogle=window.adsbygoogle||[]).push({}) --> */
  });}
};
document.addEventListener("DOMContentLoaded",()=>{VQT.ads();});
})();
