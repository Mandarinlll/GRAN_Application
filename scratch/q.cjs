const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('data/gran.db');
for(const t of ['tournaments','entries','cancellations']){console.log(d.prepare("select sql from sqlite_master where name=?").get(t)?.sql)}
console.log(d.prepare('select distinct status from tournaments').all(), d.prepare('select distinct status from entries').all());
console.log(d.prepare('select * from cancellations limit 3').all());
console.log(d.prepare('select * from tournaments limit 1').all());
