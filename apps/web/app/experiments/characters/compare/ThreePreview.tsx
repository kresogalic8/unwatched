"use client";
import { useEffect,useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { PreviewProps } from "./Comparison";
import s from "./comparison.module.css";
export default function ThreePreview(props:PreviewProps){
 const host=useRef<HTMLDivElement>(null),state=useRef(props),wake=useRef(()=>{});state.current=props;
 useEffect(()=>wake.current(),[props.playing,props.animation,props.speed,props.debug,props.wide,props.smile]);
 useEffect(()=>{
  const el=host.current;if(!el)return;
  let disposed=false,frame=0,renderer:THREE.WebGLRenderer|undefined,resize:ResizeObserver|undefined,observer:IntersectionObserver|undefined,controls:OrbitControls|undefined,root:THREE.Group|undefined,mixer:THREE.AnimationMixer|undefined,helper:THREE.SkeletonHelper|undefined;
  const disposeRoot=(r:THREE.Object3D)=>r.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
  const visibility=()=>wake.current();
  void(async()=>{
   try{
    const scene=new THREE.Scene();scene.background=new THREE.Color(0xdce2d1);
    const camera=new THREE.PerspectiveCamera(33,1,.1,100);camera.position.set(1.9,1.8,4.2);
    const r=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer=r;r.setPixelRatio(Math.min(devicePixelRatio,2));r.shadowMap.enabled=true;r.shadowMap.type=THREE.PCFSoftShadowMap;r.outputColorSpace=THREE.SRGBColorSpace;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.25;el.appendChild(r.domElement);
    controls=new OrbitControls(camera,r.domElement);controls.target.set(0,.95,0);controls.enablePan=false;controls.minDistance=2.8;controls.maxDistance=14;controls.maxPolarAngle=Math.PI*.49;controls.update();
    scene.add(new THREE.HemisphereLight(0xfff5e0,0x718463,2));
    const key=new THREE.DirectionalLight(0xffeed6,3.5);key.position.set(-3,5,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-2;key.shadow.camera.right=2;key.shadow.camera.top=3;key.shadow.camera.bottom=-2;key.shadow.normalBias=.008;scene.add(key);
    const fill=new THREE.DirectionalLight(0xc6d9ef,1.5);fill.position.set(4,2,-2);scene.add(fill);
    const gltf=await new GLTFLoader().loadAsync("/studies/blender-citizen.glb");
    if(disposed){disposeRoot(gltf.scene);return;}
    root=gltf.scene;
    // Exported Blender lighting is replaced with this comparison studio lighting.
    const lights:THREE.Object3D[]=[];const faces:THREE.Mesh[]=[];
    root.traverse(o=>{if(o instanceof THREE.Light||o instanceof THREE.Camera)lights.push(o);if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;if(o.morphTargetDictionary?.Smile!==undefined)faces.push(o);}});lights.forEach(o=>o.removeFromParent());scene.add(root);
    helper=new THREE.SkeletonHelper(root);helper.visible=false;scene.add(helper);
    mixer=new THREE.AnimationMixer(root);
    // The Blender exporter may split actions by object; combine tracks into one
    // shared timeline before extracting the authored motion intervals.
    const tracks=gltf.animations.flatMap(c=>c.tracks).filter(t=>!t.name.includes("morphTargetInfluences"));
    if(!tracks.length)throw new Error("Missing exported character animation");
    const full=new THREE.AnimationClip("Life",-1,tracks);
    const clips:Record<string,THREE.AnimationClip>={idle:THREE.AnimationUtils.subclip(full,"Idle",0,48,24),walk:THREE.AnimationUtils.subclip(full,"Walk",60,132,24),wave:THREE.AnimationUtils.subclip(full,"Wave",144,240,24)};
    let action:THREE.AnimationAction|undefined,lastAnimation="",lastWide:boolean|undefined,visible=true,last=performance.now();
    const render=()=>{if(!disposed)r.render(scene,camera);};
    const sync=()=>{
      const p=state.current;
      if(lastAnimation!==p.animation){const next=mixer!.clipAction(clips[p.animation]??clips.idle!);next.reset().setEffectiveWeight(1).play();if(action&&action!==next){if(p.playing){action.fadeOut(.25);next.fadeIn(.25);}else action.stop();}action=next;lastAnimation=p.animation;mixer!.update(0);}
      helper!.visible=p.debug;
      for(const mesh of faces)mesh.morphTargetInfluences![mesh.morphTargetDictionary!.Smile!]=p.smile;
      if(lastWide!==p.wide){camera.position.set(p.wide?5.5:1.9,p.wide?3.3:1.8,p.wide?10:4.2);controls!.target.set(0,.95,0);controls!.update();lastWide=p.wide;}
      render();
    };
    const tick=(now:number)=>{frame=0;if(disposed)return;const dt=Math.min((now-last)/1000,.05);last=now;mixer!.update(dt*state.current.speed);render();if(state.current.playing&&visible&&!document.hidden)frame=requestAnimationFrame(tick);};
    wake.current=()=>{cancelAnimationFrame(frame);frame=0;sync();last=performance.now();if(state.current.playing&&visible&&!document.hidden)frame=requestAnimationFrame(tick);};
    controls.addEventListener("change",render);
    resize=new ResizeObserver(()=>{const w=el.clientWidth,h=el.clientHeight;r.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();render();});resize.observe(el);
    observer=new IntersectionObserver(([e])=>{visible=!!e?.isIntersecting;wake.current();});observer.observe(el);
    document.addEventListener("visibilitychange",visibility);wake.current();state.current.onReady();
   }catch{if(!disposed)state.current.onError();}
  })();
  return()=>{disposed=true;wake.current=()=>{};cancelAnimationFrame(frame);resize?.disconnect();observer?.disconnect();document.removeEventListener("visibilitychange",visibility);controls?.dispose();mixer?.stopAllAction();if(root){mixer?.uncacheRoot(root);disposeRoot(root);}helper?.dispose();renderer?.dispose();renderer?.domElement.remove();};
 },[]);
 return <div className={s.host} ref={host} role="img" aria-label="Original Blender citizen rendered in Three.js; drag to rotate"/>;
}
