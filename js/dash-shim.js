/* Minimal stand-in for the dashboard runtime the app was built on.
   Datasets come from data/data.js (window.__DATA). */
window.dash={
  data(id){const r=window.__DATA[id];if(!r)return{status:'missing',data:[]};return{status:'ok',data:r,columns:Object.keys(r[0]||{})}},
  onData(fn){setTimeout(fn,0)},refresh(){},setLink(){},params(){return{}},setParams(){},colors:[]
};
