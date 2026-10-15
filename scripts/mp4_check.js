// Prints MP4 box facts (box order, edit lists, codec, durations) for each file given.
// Usage: node scripts/mp4_check.js <file.mp4> [...]
const fs=require('fs');
for (const f of process.argv.slice(2)){
 const b=fs.readFileSync(f); const out={file:f,size:b.length,top:[]};
 function walk(s,e,depth,path){let p=s;while(p+8<=e){let sz=b.readUInt32BE(p),t=b.toString('latin1',p+4,p+8),h=8;if(sz==1){sz=Number(b.readBigUInt64BE(p+8));h=16}if(sz==0)sz=e-p;
  if(depth==0)out.top.push(t+'@'+p+'('+sz+')');
  const np=path+'/'+t;
  if(['moov','trak','mdia','minf','stbl','edts','udta'].includes(t))walk(p+h,p+sz,depth+1,np);
  else if(t=='tkhd'){const v=b[p+h];const o=p+h+(v?92:80);out[np]={w:b.readUInt32BE(o)/65536,h:b.readUInt32BE(o+4)/65536,matrix:[...Array(9)].map((_,i)=>b.readInt32BE(p+h+(v?52:40)+i*4))}}
  else if(t=='mdhd'){const v=b[p+h];const ts=b.readUInt32BE(p+h+(v?20:12));const d=v?Number(b.readBigUInt64BE(p+h+24)):b.readUInt32BE(p+h+16);(out.mdhd=out.mdhd||[]).push({ts,dur:d/ts})}
  else if(t=='mvhd'){const v=b[p+h];const ts=b.readUInt32BE(p+h+(v?20:12));const d=v?Number(b.readBigUInt64BE(p+h+24)):b.readUInt32BE(p+h+16);out.mvhd={ts,dur:d/ts}}
  else if(t=='elst'){const v=b[p+h];const n=b.readUInt32BE(p+h+4);const es=[];for(let i=0;i<n;i++){const o=p+h+8+i*(v?20:12);es.push(v?[Number(b.readBigUInt64BE(o)),Number(b.readBigInt64BE(o+8))]:[b.readUInt32BE(o),b.readInt32BE(o+4)])}(out.elst=out.elst||[]).push(es)}
  else if(t=='hdlr'){(out.hdlr=out.hdlr||[]).push(b.toString('latin1',p+h+8,p+h+12))}
  else if(t=='stsd'){const et=b.toString('latin1',p+h+12,p+h+16);const info={type:et};if(et=='avc1'||et=='hvc1'){const o=p+h+8;info.w=b.readUInt16BE(o+32);info.h=b.readUInt16BE(o+34);const c=b.indexOf(et=='avc1'?'avcC':'hvcC',o);if(et=='avc1'){info.profile=b[c+5];info.level=b[c+7]}const col=b.indexOf('colr',o);if(col>0&&col<p+sz)info.colr=b.toString('latin1',col+4,col+8)+' '+b.slice(col+8,col+15).toString('hex')}(out.stsd=out.stsd||[]).push(info)}
  else if(t=='stss'){out.keyframes=b.readUInt32BE(p+h+4);out.firstKey=b.readUInt32BE(p+h+8)}
  else if(t=='stts'){const n=b.readUInt32BE(p+h+4);let c=0,deltas=new Set();for(let i=0;i<n;i++){c+=b.readUInt32BE(p+h+8+i*8);deltas.add(b.readUInt32BE(p+h+12+i*8))}(out.stts=out.stts||[]).push({samples:c,deltas:[...deltas].slice(0,6)})}
  else if(t=='ctts'){(out.ctts=out.ctts||[]).push(b.readUInt32BE(p+h+4)+' entries v'+b[p+h])}
  p+=sz}}
 walk(0,b.length,0,'');console.log(JSON.stringify(out));}
