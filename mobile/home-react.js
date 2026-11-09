/* Real React controls and video cards; no interface baked into a background. */
(function () {
  'use strict';
  var h=React.createElement, cities={'Шумен':'shumen','Варна':'varna','Бургас':'burgas'};
  function App(){
    var f=React.useState({city:'',hood:'',price:'',area:'',type:'',deal:''}), filters=f[0], set=f[1];
    var a=React.useState(false), advanced=a[0], setAdvanced=a[1];
    function update(key,value){set(function(old){var n=Object.assign({},old); n[key]=value;if(key==='city')n.hood='';return n;});}
    function field(key,label,options){return h('label',{className:'field',key:key},h('span',null,label),h('select',{value:filters[key],onChange:function(e){update(key,e.target.value);},'aria-label':label},options.map(function(o){return h('option',{key:o[0],value:o[0]},o[1]);})));}
    var r=React.useState(null), results=r[0], setResults=r[1];
    function search(e,deal){if(e)e.preventDefault();setResults('loading');(window.__ND_READY||Promise.resolve()).then(function(){setResults((window.__ND_LISTINGS||[]).filter(function(p){
      if(filters.city&&p.city!==filters.city)return false;
      if(filters.hood&&p.hood!==filters.hood)return false;
      if(filters.type&&p.type!==filters.type)return false;
      if((deal||filters.deal)&&p.deal!==(deal||filters.deal))return false;
      return ['price','area'].every(function(k){if(!filters[k])return true;var v=filters[k].split('-');return Number.isFinite(Number(p[k]))&&Number(p[k])>=Number(v[0])&&(!v[1]||Number(p[k])<=Number(v[1]));});
    }));}).catch(function(){setResults('error');});}
    var hoods=window.NDPlaces&&NDPlaces.PLACES[filters.city]||[];
    return h('main',{className:'home'},
      h('header',{className:'header'},h('a',{href:'/',className:'brand','aria-label':'Имоти Надежда – начало'},h('img',{src:'/mobile/crm/assets/logo.png',alt:'Недвижими имоти Надежда'})),h('nav',null,h('button',{onClick:function(){search(null,'sale');}},'За продажба'),h('button',{onClick:function(){search(null,'rent');}},'Под наем'),h('button',{type:'button',onClick:function(){setResults('about');}},'За нас'),h('a',{href:'/mobile/crm/crm-nachalo.html','aria-label':'Вход за брокери'},h('img',{src:'/mobile/home-assets/user.svg',alt:''})))),
      results!==null?h('section',{className:'results',role:'dialog','aria-modal':true,'aria-label':results==='about'?'За нас':'Резултати от търсенето'},h('div',{className:'results-inner'},h('button',{className:'close',onClick:function(){setResults(null);},'aria-label':'Затвори'},'×'),h('h2',null,results==='about'?'За нас':'Имоти'),results==='about'?h('div',null,h('p',null,'Недвижими Имоти Надежда — имоти в Шумен, Варна, Бургас и Нови пазар. Продажби, наеми, съдействие за кредит и нотариус.'),h('a',{href:'tel:+359898977370'},'0898 977 370')):results==='loading'?h('p',{role:'status'},'Зареждане…'):results==='error'?h('p',{role:'alert'},'Неуспешно зареждане. Опитайте отново.'):results.length?results.map(function(p){return h('a',{className:'property',key:p.id,href:'/mobile/ilj.html#/property/'+encodeURIComponent(p.id)+'/'+(cities[p.city]||'shumen')},h('img',{src:p.img||'/mobile/home-assets/city-'+(cities[p.city]||'shumen')+'.webp',alt:'',loading:'lazy'}),h('div',null,h('strong',null,p.title),h('p',null,[p.city,p.hood,p.area?p.area+' м²':''].filter(Boolean).join(' · ')),h('b',null,new Intl.NumberFormat('bg-BG').format(p.price)+' €')));}):h('p',null,'Няма публикувани имоти по тези критерии.'))):null,
      h('div',{className:'panorama' ,'aria-hidden':true}),
      h('form',{className:'search',onSubmit:search},
        field('city','Град',[['','Всички градове']].concat(Object.keys(cities).map(function(c){return[c,c];}))),
        field('hood','Квартал',[['','Всички квартали']].concat(hoods.map(function(c){return[c,c];}))),
        field('price','Цена',[['','Без ограничение'],['0-100000','до 100 000 €'],['100000-200000','100 000–200 000 €'],['200000-500000','200 000–500 000 €'],['500000-','над 500 000 €']]),
        field('area','Площ',[['','Без ограничение'],['0-60','до 60 м²'],['60-100','60–100 м²'],['100-200','100–200 м²'],['200-','над 200 м²']]),
        field('type','Вид имот',[['','Всички видове']].concat(['Апартамент','Къща','Парцел','Офис','Магазин','Гараж','Вила'].map(function(v){return[v,v];}))),
        h('div',{className:'actions'},h('button',{type:'button','aria-expanded':advanced,onClick:function(){setAdvanced(!advanced);}},'☷ Филтри'),h('button',{className:'submit',type:'submit'},'Търси')),
        advanced?h('div',{className:'extra'},field('deal','Сделка',[['','Всички'],['sale','Продажба'],['rent','Наем']]),h('button',{type:'button',onClick:function(){set({city:'',hood:'',price:'',area:'',type:'',deal:''});}},'Изчисти филтрите')):null),
      h('section',{className:'cities','aria-label':'Избери град'},Object.keys(cities).map(function(name,i){var slug=cities[name];return h('a',{key:slug,className:'city city-'+i,href:'/mobile/ilj.html#/city/'+slug},h('video',{src:'/mobile/home-assets/city-'+slug+'.mp4',poster:'/mobile/home-assets/city-'+slug+'-poster.webp',autoPlay:true,muted:true,loop:true,playsInline:true,preload:'metadata','aria-hidden':true,onCanPlay:function(e){e.currentTarget.play().catch(function(){});}}),h('div',{className:'city-copy'},h('div',null,h('h2',null,name),h('span',null,'ВИЖ ГРАДА')),h('span',{className:'arrow','aria-hidden':true},'→')));})))
  }
  ReactDOM.createRoot(document.getElementById('home-root')).render(h(App));
})();
