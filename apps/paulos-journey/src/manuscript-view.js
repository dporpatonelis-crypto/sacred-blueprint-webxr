import * as THREE from 'three';
import { ManuscriptConnections } from '../../../shared/journey/manuscript-connections.js';

const CW=1024,CH=924,BW=2.05,BH=BW*CH/CW,FONT='Georgia, "Times New Roman", serif';
function linesFor(ctx,text,width){const lines=[];let line='';for(const word of text.split(/\s+/u)){const next=line?line+' '+word:word;if(line&&ctx.measureText(next).width>width){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);return lines;}

// Keep the same world-space glyphs and reveal; give a narrow screen one legible
// passage at a time rather than reducing three whole passages to tiny text.
export class PaulManuscript extends ManuscriptConnections {
  makePage(page){
    if(!this.content.compact||page>=0)return super.makePage(page);
    const index=this.choiceIndex??0,entries=this.content.entries;
    const key=`compact:${index}:${this.session.selected}:${entries.map(e=>Number(this.session.solved(e.stationId))).join('')}:${this.session.complete}`;
    if(this.pages.has(key))return this.pages.get(key);
    const canvas=document.createElement('canvas');canvas.width=CW;canvas.height=CH;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#f7e6bd';ctx.fillRect(0,0,CW,CH);ctx.strokeStyle='#a77b3b';ctx.lineWidth=4;ctx.strokeRect(22,22,CW-44,CH-44);
    ctx.textAlign='center';ctx.fillStyle='#50381f';ctx.font=`46px ${FONT}`;ctx.fillText(this.content.title,CW/2,76);
    ctx.font='29px system-ui';ctx.fillText('Διάβασε · γέμισε το αντίστοιχο δοχείο',CW/2,119);
    const hits=[],layout=new Map();
    entries.forEach((entry,i)=>{
      const tab={x:54+i*307,y:140,w:293,h:120};ctx.fillStyle=i===index?'#dfba6b':'#fff1cf';ctx.strokeStyle='#aa8245';ctx.beginPath();ctx.roundRect(tab.x,tab.y,tab.w,tab.h,12);ctx.fill();ctx.stroke();
      ctx.fillStyle='#50381f';ctx.font='44px system-ui';ctx.textAlign='center';ctx.fillText(`${i+1} · Χωρίο`,tab.x+tab.w/2,tab.y+76);hits.push({rect:tab,action:{type:'hymn-choice',index:i}});
      let size=56,lines;do{ctx.font=`${size}px ${FONT}`;lines=linesFor(ctx,entry.text,864);if(lines.length*size*1.22<=438||size<=42)break;size-=2;}while(true);
      const anchors=[],top=326,leading=size*1.22,draw=i===index;
      ctx.textAlign='left';
      if(draw){ctx.fillStyle='#806131';ctx.font='28px system-ui';ctx.fillText(`${i+1} · ${entry.sourceLabel||''}`,78,294);ctx.font=`${size}px ${FONT}`;ctx.fillStyle=this.session.solved(entry.stationId)?'#3c4c2b':'#50381f';}
      for(const[lineIndex,line]of lines.entries()){
        const baseline=top+size+lineIndex*leading;let x=78;
        for(const[tokenIndex,token]of line.split(' ').entries()){
          if(tokenIndex)x+=ctx.measureText(' ').width;
          const keyword=entry.keywords.find(word=>token.includes(word));
          if(!keyword){if(draw)ctx.fillText(token,x,baseline);}else{
            const at=token.indexOf(keyword),before=token.slice(0,at),after=token.slice(at+keyword.length),start=x+ctx.measureText(before).width,g=this.glyphs.get(keyword),factor=size/64;
            anchors.push({text:keyword,rect:{x:start-g.pad*factor,y:baseline-(g.ascent+g.pad)*factor,w:g.width*factor,h:g.height*factor}});
            if(draw){if(before)ctx.fillText(before,x,baseline);if(after)ctx.fillText(after,start+ctx.measureText(keyword).width,baseline);}
          }
          x+=ctx.measureText(token).width;
        }
      }
      layout.set(entry.stationId,anchors);
      if(draw)hits.push({rect:{x:54,y:270,w:916,h:498},action:{type:'word',id:entry.stationId}});
    });
    const footer=(label,rect,page)=>{ctx.fillStyle='#fff1cf';ctx.strokeStyle='#aa8245';ctx.beginPath();ctx.roundRect(rect.x,rect.y,rect.w,rect.h,12);ctx.fill();ctx.stroke();ctx.fillStyle='#50381f';ctx.textAlign='center';ctx.font='32px system-ui';ctx.fillText(label,rect.x+rect.w/2,846);hits.push({rect,action:{type:'hymn-page',page}});};
    footer(this.content.readLabel,{x:84,y:801,w:this.session.complete?405:856,h:65},0);
    if(this.session.complete)footer('Τελικό ερώτημα',{x:533,y:801,w:405,h:65},this.finalPage);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
    const result={texture,layout,hits};this.pages.set(key,result);return result;
  }
  sync(){
    super.sync();if(!this.content.compact||this.reading)return;
    const visibleId=this.content.entries[this.choiceIndex??0].stationId;
    for(const book of this.books)for(const[id,sources]of book.sources)for(const source of sources)source.visible=id===visibleId;
    for(const hit of this.pickables)if(hit.userData.action.type==='hymn-choice')hit.userData.disabled=this.session.busy;
  }
  setChoice(index){if(this.active)return;this.choiceIndex=Math.max(0,Math.min(this.content.entries.length-1,index));this.signature='';this.sync();}
  setCompact(value,position=value?[-2,2.35,-5.6]:[-2.25,1.6,-3.3]){
    if(this.active||this.content.compact===value&&this.books.every(b=>b.root.position.toArray().every((v,i)=>v===position[i])))return;
    this.content.compact=value;this.signature='';this.layout=this.makePage(-1).layout;
    for(const book of this.books){
      book.root.position.set(...position);
      const post=book.root.children.find(o=>o.geometry?.type==='CylinderGeometry'&&o.rotation.z===0),height=book.root.position.y-BH/2;
      post.geometry.dispose();post.geometry=new THREE.CylinderGeometry(.045,.07,height,10);post.position.y=-BH/2-height/2;
      for(const[id,sources]of book.sources)for(const source of sources){const item=this.layout.get(id).find(a=>a.text===source.userData.keyword),r=item.rect;source.scale.setScalar(r.h/CH*BH);source.position.set((r.x+r.w/2-CW/2)/CW*BW,(CH/2-r.y-r.h/2)/CH*BH,.014);}
      const beam=this.beams.get(book.id);for(const mesh of [beam.beam,beam.halo,beam.bead]){mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();}this.makeBeam(this.world.stations.find(s=>s.id===book.id),book);
    }
    this.sync();
  }
  start(id,...args){if(this.content.compact)this.setChoice(this.content.entries.findIndex(e=>e.stationId===id));super.start(id,...args);}
}
