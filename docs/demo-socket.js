(() => {
  "use strict";
  const initial = () => ({connected:true,disabled:false,busy:false,revision:1,bridgeVersion:"0.3.0",error:"",keybinds:[
    {id:"1",key:"G",action:"TOGGLE_MUTE",actionLabel:"Activer / désactiver le micro",enabled:true,selected:true},
    {id:"2",key:"B",action:"TOGGLE_DEAFEN",actionLabel:"Activer / désactiver le casque",enabled:true,selected:true},
    {id:"3",key:"MOUSE4",action:"PUSH_TO_MUTE",actionLabel:"Appuyer pour rendre muet",enabled:true,selected:true},
    {id:"4",key:"CTRL + H",action:"TOGGLE_STREAMER_MODE",actionLabel:"Mode streamer",enabled:true,selected:false}
  ]});
  let state=initial(),active=null;
  const updates={installedVersion:"0.4.0.0",automaticChecks:true,initialized:true,status:"current",message:"Aperçu local : aucune recherche en ligne."};
  class DemoSocket {
    static OPEN=1;
    constructor(){active=this;this.readyState=1;setTimeout(()=>this.onopen?.(),0);}
    send(raw){const message=JSON.parse(raw);if(message.event==="registerPropertyInspector")return;
      if(message.event!=="sendToPlugin"||message.context!=="demo-inspector")return;
      const p=message.payload;
      if(p.type==="toggle"&&state.connected){state.disabled=!state.disabled;state.revision++;}
      if(p.type==="selection"&&state.connected&&p.revision===state.revision){state.keybinds=state.keybinds.map(k=>p.ids.includes(k.id)?{...k,selected:p.selected}:k);state.revision++;}
      if(p.type==="setAutomaticChecks")updates.automaticChecks=p.enabled;
      if(p.type==="openLink")updates.message="Les liens sont désactivés dans cette démonstration.";
      this.emit();
    }
    emit(){setTimeout(()=>this.onmessage?.({data:JSON.stringify({event:"sendToPropertyInspector",context:"demo-action",payload:{type:"managedSettings",state,updates}})}),40);}
    close(){this.readyState=3;this.onclose?.();}
  }
  window.WebSocket=DemoSocket;
  window.addEventListener("message",event=>{if(event.source!==parent||event.data?.type!=="preview-state")return;
    if(event.data.value==="offline"){state.connected=false;state.error="Ouvre Discord et vérifie que le connecteur est activé.";}
    else if(event.data.value==="on"||event.data.value==="off"){state.connected=true;state.error="";state.disabled=event.data.value==="off";}
    else return;
    state.revision++;active?.emit();
  });
})();
