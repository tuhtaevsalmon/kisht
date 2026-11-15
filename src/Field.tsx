import {Component,type ErrorInfo,type ReactNode,useState} from 'react';
import Scene,{type FieldProps} from './FieldScene';
import type {Lang} from './domain';
import './field-fallback.css';

class SceneBoundary extends Component<{children:ReactNode;fallback:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true}}
 componentDidCatch(error:Error,_info:ErrorInfo){console.error('[kisht] 3D scene failed',error)}
 render(){return this.state.failed?this.props.fallback:this.props.children}
}

export default function Field({lang,...props}:FieldProps&{lang?:Lang}){
 const [attempt,setAttempt]=useState(0);
 const ru=(lang??(typeof document==='undefined'?'ru':document.documentElement.lang))==='ru';
 const fallback=<div className="field-fallback" role="status"><h3>{ru?'3D недоступно на этом устройстве':'3D is unavailable on this device'}</h3><p>{ru?'Погода, полив и риски по выбранной дате остаются доступны. Можно повторить запуск 3D.':'Weather, irrigation and risks for the selected day remain available. You can retry the 3D view.'}</p><button type="button" onClick={()=>setAttempt(n=>n+1)}>{ru?'Повторить 3D':'Retry 3D'}</button></div>;
 return <SceneBoundary key={attempt} fallback={fallback}><Scene {...props}/></SceneBoundary>;
}
