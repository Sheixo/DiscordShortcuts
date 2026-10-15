const assert = require('node:assert/strict');
const { createRuntime } = require('./runtime.cjs');
module.exports = async function engineTests(code) {
    let checks = 0, sequence = 0;
    const snapshot = r => [...r.sockets.at(-1).messages].reverse().find(message => message.type === 'state');
    const command = (r, change, extra = {}) => {
        const before = snapshot(r), requestId = 'test-' + ++sequence;
        r.sockets.at(-1).onmessage({data:JSON.stringify({type:'command',protocolVersion:2,requestId,session:before.session,
            baseRevision:before.revision,...change,...extra})});
        return r.sockets.at(-1).messages.findLast(message => message.type === 'ack' && message.requestId === requestId);
    };
    const off = r => command(r,{command:'setDisabled',value:true});
    const on = r => command(r,{command:'setDisabled',value:false});
    for (const order of ['storeFirst','registerFirst']) {
        const r = createRuntime(code,{order,managed:false}); await r.start(); r.sockets.at(-1).onopen();
        assert.equal(snapshot(r).ready,true); assert.equal(snapshot(r).protocolVersion,2); checks++;
        assert.equal(r.state[1].enabled,true);assert.equal(r.state[2].enabled,true);assert.equal(r.state[3].enabled,false);checks++;
        assert.deepEqual(Array.from(r.settings().selectedKeybindIds),['1','2','3']); checks++;
        assert.ok(!r.entries.has(1396921420),'No PC hotkey should be installed'); checks++;
        const initial = r.calls.length; r.press(1); r.press(2); assert.equal(r.calls.length,initial+4); checks++;
        assert.equal(off(r).ok,true); const blocked = r.calls.length;
        r.press(1); r.press(2); assert.equal(r.calls.length,blocked); checks++;
        for (let id=4;id<24;id++) {
            r.put({id,shortcut:[[0,162],[0,64+id]],action:id%2?'PUSH_TO_MUTE':'TOGGLE_MUTE',enabled:true,managed:false});
            const before = r.calls.length; r.press(id); assert.equal(r.calls.length,before,'New key leaked before reconciliation'); checks++;
            await r.tick(); assert.equal(snapshot(r).disabled,true);
            assert.ok(r.settings().selectedKeybindIds.includes(String(id))); r.press(id); assert.equal(r.calls.length,before); checks++;
        }
        assert.equal(command(r,{command:'selection',ids:['2'],selected:false}).ok,true);
        const unselected = r.calls.length; r.press(2); assert.equal(r.calls.length,unselected+2); checks++;
        r.patch(2,{shortcut:[[0,90]],action:'PUSH_TO_TALK'}); await r.tick();
        assert.ok(!r.settings().selectedKeybindIds.includes('2')); r.press(2); assert.equal(r.calls.at(-2).action,'PUSH_TO_TALK'); checks++;
        const oldCallback = r.entries.get(1).callback;
        r.patch(1,{shortcut:[[0,74]],action:'TOGGLE_DEAFEN'}); await r.tick();
        const changed = r.calls.length; r.press(1); oldCallback(true); oldCallback(false); assert.equal(r.calls.length,changed); checks++;
        r.remove(4); await r.tick(); assert.ok(!snapshot(r).keybinds.some(keybind=>keybind.id==='4'));
        assert.equal(snapshot(r).disabled,true); assert.ok(!r.settings().selectedKeybindIds.includes('4')); checks++;
        on(r); await r.tick(); assert.equal(r.state[3].enabled,false); assert.ok(!r.entries.has(3)); checks++;
        r.press(1); assert.equal(r.calls.at(-2).action,'TOGGLE_DEAFEN'); assert.deepEqual(r.calls.at(-2).shortcut,[[0,74]]); checks++;
        // A key held while OFF is requested gets one release, with no phantom key-up after ON.
        r.fire(5,true); const held = r.calls.length; off(r); assert.equal(r.calls.length,held+1); assert.equal(r.calls.at(-1).down,false);
        r.fire(5,false); r.fire(5,true); on(r); r.fire(5,false); assert.equal(r.calls.length,held+1); checks++;
        r.fire(5,true); r.patch(5,{action:'PUSH_TO_TALK'}); await r.tick(); assert.equal(r.calls.at(-1).down,false); checks++;
        // Disabled and incomplete Discord entries are still listed and automatically selected.
        off(r); r.put({id:30,shortcut:[],action:'UNASSIGNED',enabled:true,managed:false}); await r.tick();
        assert.ok(snapshot(r).keybinds.some(keybind=>keybind.id==='30'&&keybind.selected)); checks++;
        r.patch(30,{shortcut:[[1,3]],action:'PUSH_TO_MUTE'}); const assigned = r.calls.length;
        r.press(30); assert.equal(r.calls.length,assigned); await r.tick(); r.press(30); assert.equal(r.calls.length,assigned); checks++;
        r.native.inputEventUnregister(6); await r.tick(); assert.equal(snapshot(r).ready,true);
        on(r); off(r); await r.tick(); assert.ok(!r.entries.has(6),'External unregister must be respected'); checks++;
        const stale = snapshot(r).revision;
        r.put({id:31,shortcut:[[0,85]],action:'TOGGLE_MUTE',enabled:true,managed:false}); await r.tick();
        assert.equal(command(r,{command:'selection',ids:['1'],selected:false},{baseRevision:stale}).ok,false);
        assert.ok(r.settings().selectedKeybindIds.includes('1')); checks++;
        assert.equal(command(r,{command:'selection',ids:['999'],selected:false}).ok,false); checks++;
        const session = snapshot(r).session;
        assert.equal(command(r,{command:'setDisabled',value:false},{session:'obsolete-session'}).ok,false);
        assert.equal(snapshot(r).disabled,true); checks++;
        const repeatedId = 'duplicate';
        const wire = {type:'command',protocolVersion:2,requestId:repeatedId,session,command:'setDisabled',value:false};
        const sock = r.sockets.at(-1); sock.onmessage({data:JSON.stringify(wire)}); assert.equal(snapshot(r).disabled,false);
        off(r); sock.onmessage({data:JSON.stringify(wire)}); assert.equal(snapshot(r).disabled,true,'Duplicate request reapplied'); checks++;
        const oldMessage = sock.onmessage; sock.onclose(); await r.tick(2000); r.sockets.at(-1).onopen();
        assert.equal(snapshot(r).disabled,true); oldMessage({data:JSON.stringify({...wire,requestId:'late'})});
        assert.equal(snapshot(r).disabled,true); checks++;
        r.plugin.stop(); assert.equal(r.native.inputEventRegister,r.originals.register); assert.equal(r.native.inputEventUnregister,r.originals.unregister);
        assert.equal(r.listeners.size,0); checks++;
        await r.start(); assert.equal(snapshot(r).disabled,false,'Discord restart must return to ON, as before');
        assert.notEqual(snapshot(r).session,session); checks++;
        r.plugin.stop(); assert.equal(r.errors.length,0,r.errors.join('\n')); checks++;
    }
    const layout = createRuntime(code,{managed:false});
    layout.state[1].shortcut=[[0,71,'fr']];
    await layout.start();layout.sockets.at(-1).onopen();
    assert.equal(snapshot(layout).ready,true);assert.equal(snapshot(layout).keybinds.find(k=>k.id==='1').key,'G');checks++;
    off(layout);const layoutCalls=layout.calls.length;layout.press(1);assert.equal(layout.calls.length,layoutCalls);checks++;
    on(layout);layout.press(1);assert.equal(layout.calls.length,layoutCalls+2);layout.plugin.stop();checks++;
    const desktop = createRuntime(code,{desktop:false}); await desktop.start();
    assert.equal(snapshot(desktop).ready,false); assert.match(snapshot(desktop).error,/Discord officiel/); desktop.plugin.stop(); checks++;
    const delayed = createRuntime(code,{delay:true}); delayed.plugin.start(); await delayed.tick();
    delayed.plugin.stop(); delayed.plugin.start(); delayed.releaseDeferred(); await delayed.tick(500); await delayed.tick();
    assert.equal(snapshot(delayed).disabled,false); delayed.plugin.stop(); checks++;
    return checks;
};
