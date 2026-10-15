const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
module.exports=function interfaceTests(){
    let checks=0;
    class Element{
        constructor(){this.children=[];this.handlers={};this.textContent='';this.value='';this.checked=false;this.disabled=false;this.hidden=false;this.className='';
            this.classList={toggle:()=>{}};}
        append(...children){this.children.push(...children);}
        replaceChildren(...children){this.children=children;}
        addEventListener(event,callback){this.handlers[event]=callback;}
        set innerHTML(_){throw new Error('Dynamic HTML is forbidden');}
    }
    const elements=new Map(),sockets=[],timers=new Map();let timerId=0;
    const document={getElementById:id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);},createElement:()=>new Element()};
    class WebSocket{
        static OPEN=1;
        constructor(url){this.url=url;this.readyState=0;this.sent=[];sockets.push(this);}
        send(raw){this.sent.push(JSON.parse(raw));}
        close(){this.readyState=3;this.onclose?.();}
    }
    const window={};
    const source=fs.readFileSync(path.join(__dirname,'../stream-deck/fr.ethan.discord-shortcuts.sdPlugin/ui/settings.js'),'utf8');
    vm.runInNewContext(source,{document,window,WebSocket,JSON,setTimeout:(callback)=>{const id=++timerId;timers.set(id,callback);return id;},clearTimeout:id=>timers.delete(id)});
    const el=id=>document.getElementById(id);
    // Elgato assigns distinct identifiers to the inspector connection and the action.
    const connect=(port='12345',context='ctx',action='fr.ethan.discord-shortcuts.toggle')=>window.connectElgatoStreamDeckSocket(port,'inspector-uuid','registerPropertyInspector',JSON.stringify({plugin:{uuid:'fr.ethan.discord-shortcuts'}}),JSON.stringify({action,context}));
    assert.equal(el('toggle').disabled,true);checks++;
    connect('65536');connect('123', 'ctx','foreign.action');connect('123','');assert.equal(sockets.length,0);checks++;
    connect();const socket=sockets.at(-1);socket.readyState=1;socket.onopen();
    assert.equal(socket.sent[0].event,'registerPropertyInspector');assert.equal(socket.sent[1].payload.type,'getManagedSettings');checks++;
    assert.equal(socket.sent[0].uuid,'inspector-uuid');assert.equal(socket.sent[1].context,'inspector-uuid');checks++;
    const state={connected:true,disabled:true,busy:false,revision:7,bridgeVersion:'0.3.0',error:'',keybinds:[
        {id:'1',key:'G',action:'PUSH_TO_MUTE',actionLabel:'Appuyer-pour-rendre-muet',enabled:true,selected:true},
        {id:'2',key:'CTRL + MOUSE5',action:'TOGGLE_MUTE',actionLabel:'Activer/désactiver le micro',enabled:true,selected:true},
        {id:'3',key:'F13',action:'DISCONNECT',actionLabel:'Déconnexion du vocal',enabled:false,selected:true}
    ]};
    // SDK 3 sends inspector replies without an action property.
    const receive=(view,extra={})=>socket.onmessage({data:JSON.stringify({event:'sendToPropertyInspector',context:'ctx',
        payload:{type:'managedSettings',state:view},...extra})});
    receive(state);assert.equal(el('state-badge').textContent,'OFF');assert.equal(el('keybinds').children.length,3);checks++;
    assert.equal(el('connection-label').textContent,'Discord connecté');assert.equal(el('status-title').textContent,'Raccourcis suspendus');checks++;
    receive({...state,disabled:false},{action:'foreign.action'});assert.equal(el('state-badge').textContent,'OFF');checks++;
    assert.equal(el('count').textContent,'3 / 3');assert.equal(el('toggle').disabled,false);checks++;
    el('search').value='ctrl';el('search').handlers.input();assert.equal(el('keybinds').children.length,1);checks++;
    el('select-none').handlers.click();let sent=socket.sent.at(-1).payload;
    assert.equal(sent.type,'selection');assert.deepEqual(sent.ids,['2']);assert.equal(sent.selected,false);assert.equal(sent.revision,7);checks++;
    const previousCount=socket.sent.length;el('toggle').handlers.click();assert.equal(socket.sent.length,previousCount,'Second command must not queue while pending');checks++;
    receive({...state,revision:8,keybinds:state.keybinds.map(k=>({...k,selected:k.id!=='2'}))});
    assert.equal(el('state-badge').textContent,'OFF');assert.equal(el('count').textContent,'2 / 3');checks++;
    el('search').value='DECONNEXION';el('search').handlers.input();assert.equal(el('keybinds').children.length,1);checks++;
    el('search').value='';el('search').handlers.input();
    const firstBox=el('keybinds').children[0].children[0];firstBox.checked=false;firstBox.handlers.change();
    assert.deepEqual(socket.sent.at(-1).payload.ids,['1']);assert.equal(socket.sent.at(-1).payload.selected,false);checks++;
    receive({...state,revision:9});receive({...state,disabled:false},{context:'someone-else'});assert.equal(el('state-badge').textContent,'OFF');checks++;
    receive({...state,keybinds:[{...state.keybinds[0],actionLabel:'<img src=x onerror=alert(1)>'}]});
    assert.equal(el('keybinds').children[0].children[1].children[0].textContent,'<img src=x onerror=alert(1)>');checks++;
    receive({...state,connected:false,error:'Discord fermé'});assert.equal(el('toggle').disabled,true);assert.equal(el('error').textContent,'Discord fermé');checks++;
    assert.equal(el('connection-label').textContent,'Discord déconnecté');assert.equal(el('status-title').textContent,'En attente de Discord');checks++;
    const offlineCount=socket.sent.length;el('toggle').handlers.click();assert.equal(socket.sent.length,offlineCount);checks++;
    el('github').handlers.click();assert.deepEqual(socket.sent.at(-1).payload,{type:'openLink',link:'github'});checks++;
    socket.close();assert.match(el('error').textContent,/interrompue/);assert.equal(el('toggle').disabled,true);checks++;
    // The host rejects outgoing messages addressed to the action context. It
    // validates the inspector UUID first, then forwards with the action context.
    assert.ok(socket.sent.filter(message=>message.event==='sendToPlugin').every(message=>message.context==='inspector-uuid'));
    assert.deepEqual(socket.sent.filter(message=>message.event==='sendToPlugin').map(message=>message.payload.type),
        ['getManagedSettings','selection','selection','openLink']);checks++;
    for(const callback of [...timers.values()])callback();assert.equal(sockets.length,2);checks++;
    assert.equal(sockets.at(-1).sent.length,0,'Reconnect must never replay a command');checks++;
    return checks;
};
