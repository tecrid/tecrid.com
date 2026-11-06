import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
export function database(){
 const sqlite=new DatabaseSync(':memory:');
 const db={prepare(sql){let args=[];const statement={bind(...values){args=values;return statement;},async run(){const r=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)},success:true};},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};}};return statement;},async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}},exec(sql){sqlite.exec(sql);},close(){sqlite.close();}};
 for(const file of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint',''));
 return db;
}
