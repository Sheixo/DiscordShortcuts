const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
module.exports = async function hubTests({ShortcutHub,validState}) {
    let checks=0;
    class Socket extends EventEmitter {
        readyState=1; sent=[]; automaticPong=true;
        send(raw,callback){this.sent.push(JSON.parse(raw));callback?.();}
        ping(){if(this.automaticPong)this.emit('pong');}
        terminate(){if(this.readyState===3)return;this.readyState=3;this.emit('close');}
        receive(value){this.emit('message',JSON.stringify(value));}
    }
    const state = (session='session-a',revision=1,disabled=false) => ({type:'state',protocolVersion:2,session,revision,disabled,
        bridgeVersion:'0.3.0',ready:true,error:'',keybinds:[{id:'1',key:'G',action:'PUSH_TO_MUTE',actionLabel:'Appuyer-pour-rendre-muet',enabled:true,selected:true}]});
    const connect=(hub,session='session-a')=>{const socket=new Socket();hub.attach(socket);
        socket.receive({type:'hello',protocolVersion:2,role:'control',session});socket.receive(state(session));return socket;};
    assert.equal(validState(state()),true);checks++;
    for(const invalid of [{...state(),revision:-1},{...state(),session:''},{...state(),protocolVersion:1},
        {...state(),keybinds:[...state().keybinds,...state().keybinds]}, {...state(),keybinds:new Array(201).fill(state().keybinds[0])},
        {...state(),keybinds:[{...state().keybinds[0],key:7}]}]){assert.equal(validState(invalid),false);checks++;}
    let hub=new ShortcutHub(Date.now,30),socket=new Socket();hub.attach(socket);socket.receive(state());assert.equal(hub.getView().connected,false);checks++;hub.stop();
    hub=new ShortcutHub(Date.now,30);socket=connect(hub);
    const pending=hub.toggle();assert.equal(hub.getView().disabled,false);assert.equal(hub.getView().busy,true);checks++;
    const request=socket.sent.at(-1);assert.equal(request.value,true);assert.equal(request.command,'setDisabled');checks++;
    assert.equal(await hub.toggle(),false);assert.equal(socket.sent.filter(m=>m.type==='command').length,1);checks++;
    socket.receive({type:'ack',protocolVersion:2,requestId:'wrong',ok:true,error:'',state:state('session-a',2,true)});
    assert.equal(hub.getView().busy,true);checks++;
    socket.receive({type:'ack',protocolVersion:2,requestId:request.requestId,ok:true,error:'',state:state('session-a',2,true)});
    assert.equal(await pending,true);assert.equal(hub.getView().disabled,true);assert.equal(hub.getView().busy,false);checks++;
    assert.equal(await hub.select(['404'],false,2),false);assert.equal(await hub.select(['1'],false,1),false);checks++;
    const selecting=hub.select(['1','1'],false,2),selectionRequest=socket.sent.at(-1);
    assert.deepEqual(selectionRequest.ids,['1']);checks++;
    const changed={...state('session-a',3,true),keybinds:[{...state().keybinds[0],selected:false}]};
    socket.receive({type:'ack',protocolVersion:2,requestId:selectionRequest.requestId,ok:true,error:'',state:changed});
    assert.equal(await selecting,true);assert.equal(hub.getView().keybinds[0].selected,false);checks++;
    socket.receive(state('session-a',1,false));assert.equal(hub.getView().disabled,true);checks++;
    const timeout=hub.toggle();assert.equal(await timeout,false);assert.equal(hub.getView().connected,false);
    assert.equal(socket.sent.filter(message=>message.command==='setDisabled').length,2,'Timed-out toggle was replayed');checks++;
    socket.receive({...changed,revision:4});assert.equal(hub.getView().connected,true);assert.match(hub.getView().error,/non confirmée/);checks++;
    const other=connect(hub,'session-b');const abandoned=hub.toggle();socket.terminate();assert.equal(await abandoned,false);
    assert.equal(hub.getView().session,'session-b');assert.equal(other.sent.filter(message=>message.type==='command').length,0);checks++;hub.stop();
    let now=0;hub=new ShortcutHub(()=>now,30);socket=connect(hub);now=2100;hub.tick();
    assert.equal(socket.sent.at(-1).type,'getState');now=7101;hub.tick();assert.equal(hub.getView().connected,false);checks++;hub.stop();
    hub=new ShortcutHub(Date.now,30);socket=new Socket();hub.attach(socket);socket.receive({type:'hello',protocolVersion:1,role:'control'});
    socket.receive({type:'state',disabled:false});assert.equal(hub.getView().connected,false);assert.match(hub.getView().error,/0.3.0/);checks++;hub.stop();
    hub=new ShortcutHub(Date.now,30);socket=connect(hub);const interrupted=hub.toggle();hub.stop();assert.equal(await interrupted,false);checks++;
    return checks;
};
