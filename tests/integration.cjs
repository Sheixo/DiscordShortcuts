const assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {createRuntime}=require('./runtime.cjs');
module.exports=async function integrationTests(code,{ShortcutHub}){
    let checks=0;
    for(const order of ['storeFirst','registerFirst']){
        const r=createRuntime(code,{order,managed:false});await r.start();
        const browser=r.sockets.at(-1),hub=new ShortcutHub(Date.now,100);
        class ServerSocket extends EventEmitter{
            readyState=1;
            send(data,callback){browser.onmessage?.({data});callback?.();}
            ping(){this.emit('pong');}
            terminate(){if(this.readyState===3)return;this.readyState=3;this.emit('close');}
        }
        const transport=new ServerSocket(),oldSend=browser.send.bind(browser);
        browser.send=raw=>{oldSend(raw);transport.emit('message',raw);};
        hub.attach(transport);browser.onopen();
        assert.equal(hub.getView().connected,true);assert.equal(hub.getView().keybinds.length,3);checks++;
        assert.equal(await hub.toggle(),true);assert.equal(hub.getView().disabled,true);checks++;
        r.put({id:42,shortcut:[[0,163],[1,5]],action:'PUSH_TO_MUTE',enabled:true,managed:false});
        const before=r.calls.length;r.press(42);assert.equal(r.calls.length,before);await r.tick();
        assert.ok(hub.getView().keybinds.some(keybind=>keybind.id==='42'&&keybind.selected));
        assert.equal(hub.getView().disabled,true);checks++;
        assert.equal(await hub.select(['42'],false,hub.getView().revision),true);
        r.press(42);assert.equal(r.calls.length,before+2);checks++;
        r.patch(42,{shortcut:[[0,70]],action:'PUSH_TO_TALK'});await r.tick();
        assert.equal(hub.getView().keybinds.find(keybind=>keybind.id==='42').selected,false);checks++;
        assert.equal(await hub.select(['42'],true,hub.getView().revision),true);
        const selected=r.calls.length;r.press(42);assert.equal(r.calls.length,selected);checks++;
        r.remove(42);await r.tick();assert.ok(!hub.getView().keybinds.some(keybind=>keybind.id==='42'));
        assert.equal(hub.getView().disabled,true);checks++;
        assert.equal(await hub.toggle(),true);r.press(1);assert.equal(r.calls.at(-2).id,1);checks++;
        r.plugin.stop();hub.stop();
    }
    return checks;
};
