import { isJapaneseHoliday as h } from "../src/utils/holiday";
const list=(y:number)=>{const r:string[]=[];for(let m=1;m<=12;m++)for(let d=1;d<=31;d++){if(new Date(y,m-1,d).getMonth()!==m-1)continue;if(h(y,m,d))r.push(`${m}/${d}`)}return r.join(" ")};
for(const y of [2024,2025,2026])console.log(y,list(y));
