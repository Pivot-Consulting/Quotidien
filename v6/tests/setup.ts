import 'fake-indexeddb/auto';
Object.defineProperty(globalThis,'localStorage',{value:new(class{private values=new Map<string,string>();getItem(key:string){return this.values.get(key)??null}setItem(key:string,value:string){this.values.set(key,value)}removeItem(key:string){this.values.delete(key)}clear(){this.values.clear()}})()});
