'use strict';
const regionalOrigin={lat:25+(4+10.535/60)/60,lon:121+(33+9.085/60)/60};
const eastScale=111319.49*Math.cos(regionalOrigin.lat*Math.PI/180);
function geoPoint(lat,lon){return {x:(lon-regionalOrigin.lon)*eastScale,z:(regionalOrigin.lat-lat)*110772};}
function latLon(x,z){return {lat:regionalOrigin.lat-z/110772,lon:regionalOrigin.lon+x/eastScale};}
function airport(code,name,lat,lon,degrees,length,width,elevation,designator,reciprocal,apron=175,region='tw'){
  return {code,name,lat,lon,...geoPoint(lat,lon),heading:degrees*Math.PI/180,length,width,elevation,designator,reciprocal,apron,region};
}
const AIRPORT_REGIONS=[
  {id:'all',label:'🌏 全球機場'},
  {id:'tw',label:'🇹🇼 台灣與離島'},
  {id:'ea',label:'🇯🇵🇰🇷🇨🇳 東亞'},
  {id:'sea',label:'🌴 東南亞／南亞'},
  {id:'me',label:'🏜 中東'},
  {id:'eu',label:'🏰 歐洲'},
  {id:'na',label:'🗽 北美'},
  {id:'oc',label:'🦘 大洋洲'},
  {id:'sa',label:'🌎 中南美／非洲'}
];
function haversineKm(a,b){
  if(!a||!b) return 0;
  const r=Math.PI/180,dLat=(b.lat-a.lat)*r,dLon=(b.lon-a.lon)*r;
  const s=Math.sin(dLat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(s),Math.sqrt(Math.max(0,1-s)));
}
function greatCircleWaypoints(from,to,steps=3){
  if(!from||!to||from===to) return [];
  const r=Math.PI/180,lat1=from.lat*r,lon1=from.lon*r,lat2=to.lat*r,lon2=to.lon*r;
  const p1=[Math.cos(lat1)*Math.cos(lon1),Math.cos(lat1)*Math.sin(lon1),Math.sin(lat1)];
  const p2=[Math.cos(lat2)*Math.cos(lon2),Math.cos(lat2)*Math.sin(lon2),Math.sin(lat2)];
  const dot=Math.max(-1,Math.min(1,p1[0]*p2[0]+p1[1]*p2[1]+p1[2]*p2[2]));
  const omega=Math.acos(dot);
  if(omega<0.02) return [];
  const sinO=Math.sin(omega),out=[];
  for(let k=1;k<=steps;k++){
    const f=k/(steps+1),a=Math.sin((1-f)*omega)/sinO,b=Math.sin(f*omega)/sinO;
    const x=a*p1[0]+b*p2[0],y=a*p1[1]+b*p2[1],z=a*p1[2]+b*p2[2];
    const lat=Math.atan2(z,Math.hypot(x,y))/r,lon=Math.atan2(y,x)/r;
    out.push({name:`大圓航路點 ${k}`,lat,lon,...geoPoint(lat,lon)});
  }
  return out;
}
const taiwanAirports=[
  {...airport('RCSS','松山',regionalOrigin.lat,regionalOrigin.lon,92.22,4000,90,4.11,'10','28',260),
    referenceLength:2605,referenceWidth:60,gameExpanded:true},
  airport('RCYU','花蓮',24+(1+25.335/60)/60,121+(37+.955/60)/60,206.29,2751,45,14.48,'21','03',-170),
  airport('RCTP','桃園',25+5.02175/60,121+13.78283/60,49.08,3660,60,20.88,'05L','23R'),
  airport('RCMQ','臺中',24+15.90367/60,120+37.24308/60,176.69,3659,61,200.56,'18','36'),
  airport('RCKH','高雄',22+34.62258/60,120+21.05717/60,91.90,3150,60,7.93,'09','27'),
  airport('RCFN','臺東',22+45.29233/60,121+6.099/60,38.64,2438,45,41.61,'04','22'),
  airport('RCBS','金門',24+25.675833/60,118+21.534167/60,63.39,3004,45,17.07,'06','24'),
  airport('RCQC','澎湖',23+34.11742/60,119+37.69433/60,18.22,3000,45,22.71,'02','20'),
  {...airport('RCGI','綠島',22+(40+23.625/60)/60,121+(27+58.30/60)/60,164.18,917,23,8.38,'17','35',-47),
    shortField:true,parkingAlong:-9},
  {...airport('RCLY','蘭嶼',22+(1+43/60)/60,121+(32+1.85/60)/60,309.96,1132,30,12.95,'31','13',51),
    shortField:true,parkingAlong:-261},
  {...airport('CVN78','福特號航空母艦',24+(21/60),122+(9/60),0,333,78,18.5,'01','19',-40),
    carrier:true,shortField:true,catapult:true,arrestor:true,parkingAlong:20},
];
const internationalAirports=[
  airport('RJAA','東京成田',35+(45+31.88/60)/60,140+(22+46.255/60)/60,329.51,4000,60,41,'34L','16R',-205,'ea'),
  airport('RJTT','東京羽田',35.5494,139.7798,337.0,3360,60,6.4,'34R','16L',-195,'ea'),
  airport('RJBB','大阪關西',34.4347,135.2440,59.0,4000,60,5.2,'06R','24L',-190,'ea'),
  airport('VHHH','香港赤鱲角',22+(18+29/60)/60,113+(55+6/60)/60,71.0,3800,60,9,'07L','25R',185,'ea'),
  airport('ROAH','沖繩那霸',26+(11+45/60)/60,127+(38+45/60)/60,183.0,3000,45,3.5,'18R','36L',-170,'ea'),
  airport('RKSI','首爾仁川',37.4602,126.4407,333.0,4000,60,7.0,'33L','15R',-200,'ea'),
  airport('WSSS','新加坡樟宜',1.3592,103.9893,23.0,4000,60,6.7,'02L','20R',190,'sea'),
  airport('RPLL','馬尼拉尼諾伊',14.5086,121.0194,61.0,3737,60,22.9,'06','24',-185,'sea'),
  airport('VTBS','曼谷蘇凡納布',13.6900,100.7501,15.0,4000,60,2.1,'01R','19L',-195,'sea'),
  airport('WMKK','吉隆坡國際',2.762835,101.7120015,146.0,4124,60,21.0,'14L','32R',175,'sea'),
  airport('WIII','雅加達蘇加諾哈達',-6.13646,106.659,68.0,3660,60,10.4,'07R','25L',175,'sea'),
  // East Asia expansion
  airport('ZSPD','上海浦東',31.1434,121.8052,167.0,4000,60,4.0,'17L','35R',-190,'ea'),
  airport('ZBAA','北京首都',40.0799,116.6031,359.0,3800,60,35.4,'36R','18L',185,'ea'),
  airport('ZGGG','廣州白雲',23.3924,113.2988,19.0,3800,60,15.2,'02R','20L',185,'ea'),
  airport('ZGSZ','深圳寶安',22.6393,113.8107,153.0,3800,60,4.0,'15','33',-180,'ea'),
  airport('VMMC','澳門國際',22.1496,113.5915,160.0,3360,45,6.1,'16','34',-160,'ea'),
  airport('RJCC','札幌新千歲',42.7752,141.6923,5.0,3000,60,25.0,'01L','19R',175,'ea'),
  airport('RJFF','福岡機場',33.5859,130.4507,157.0,2800,60,9.4,'16','34',-175,'ea'),
  airport('RJOO','大阪伊丹',34.7855,135.4382,135.0,3000,60,15.2,'14L','32R',175,'ea'),
  airport('RKPC','濟州國際',33.5113,126.4930,68.0,3180,45,36.0,'07','25',175,'ea'),
  // South & Southeast Asia
  airport('VVNB','河內內排',21.2212,105.8072,110.0,3800,45,12.2,'11R','29L',-175,'sea'),
  airport('VVTS','胡志明新山一',10.8188,106.6519,70.0,3800,45,10.1,'07R','25L',175,'sea'),
  airport('VIDP','新德里英迪拉甘地',28.5562,77.1000,104.0,4430,60,237.1,'11R','29L',-195,'sea'),
  airport('VABB','孟買賈特拉帕蒂',19.0887,72.8679,88.0,3448,60,11.9,'09','27',175,'sea'),
  // Middle East
  airport('OMDB','杜拜國際',25.2528,55.3644,121.0,4000,60,19.0,'12R','30L',-195,'me'),
  airport('OTHH','杜哈哈馬德',25.2731,51.6081,160.0,4850,60,4.0,'16L','34R',190,'me'),
  airport('LTFM','伊斯坦堡新機場',41.2753,28.7519,170.0,4100,60,99.1,'17L','35R',190,'me'),
  // Europe
  airport('EGLL','倫敦希斯洛',51.4700,-0.4543,270.0,3902,50,25.3,'27R','09L',195,'eu'),
  airport('LFPG','巴黎戴高樂',49.0097,2.5479,86.0,4200,60,119.5,'09R','27L',-195,'eu'),
  airport('EDDF','法蘭克福',50.0379,8.5622,68.0,4000,60,110.9,'07C','25C',195,'eu'),
  airport('EHAM','阿姆斯特丹史基浦',52.3105,4.7683,183.0,3800,60,-3.4,'18R','36L',185,'eu'),
  airport('LSZH','蘇黎世國際',47.4647,8.5492,155.0,3700,60,431.6,'16','34',-175,'eu'),
  airport('LIRF','羅馬費米奇諾',41.8003,12.2389,163.0,3900,60,4.6,'16R','34L',185,'eu'),
  airport('LEMD','馬德里巴拉哈斯',40.4983,-3.5676,143.0,4179,60,609.0,'14R','32L',-190,'eu'),
  // North America
  airport('KJFK','紐約甘迺迪',40.6413,-73.7781,134.0,4423,61,4.0,'13R','31L',195,'na'),
  airport('KLAX','洛杉磯國際',33.9416,-118.4085,70.0,3685,61,38.4,'07R','25L',195,'na'),
  airport('KSFO','舊金山國際',37.6213,-122.3790,104.0,3618,61,4.0,'10L','28R',-185,'na'),
  airport('KORD','芝加哥歐海爾',41.9742,-87.9073,90.0,3963,61,206.7,'09C','27C',195,'na'),
  airport('KSEA','西雅圖塔科馬',47.4502,-122.3088,164.0,3627,46,132.0,'16L','34R',185,'na'),
  airport('PANC','安克拉治泰德史蒂文斯',61.1743,-149.9964,71.0,3531,46,46.0,'07R','25L',-175,'na'),
  airport('PHNL','檀香山丹尼爾井上',21.3187,-157.9225,79.0,3753,46,4.0,'08L','26R',185,'na'),
  airport('CYVR','溫哥華國際',49.1967,-123.1815,83.0,3505,61,4.3,'08R','26L',-180,'na'),
  airport('CYYZ','多倫多皮爾遜',43.6777,-79.6248,57.0,3389,61,173.4,'05','23',185,'na'),
  // Oceania
  airport('YSSY','雪梨金斯福德史密斯',-33.9399,151.1753,168.0,3962,45,6.4,'16R','34L',-185,'oc'),
  airport('YMML','墨爾本圖拉馬林',-37.6690,144.8410,160.0,3657,45,132.3,'16','34',180,'oc'),
  airport('NZAA','奧克蘭國際',-37.0082,174.7850,51.0,3635,45,7.0,'05R','23L',-180,'oc'),
  // South America & Africa
  airport('SBGR','聖保羅瓜魯柳斯',-23.4356,-46.4731,90.0,3700,45,750.0,'09R','27L',185,'sa'),
  airport('MMMX','墨西哥城貝尼托華雷斯',19.4363,-99.0721,52.0,3985,45,2230.0,'05R','23L',-180,'sa'),
  airport('SCEL','聖地牙哥阿圖羅梅里諾',-33.3930,-70.7858,173.0,3800,45,474.0,'17R','35L',180,'sa'),
  airport('HECA','開羅國際',30.1219,31.4056,50.0,4000,60,116.4,'05C','23C',185,'sa'),
  airport('FAOR','約翰尼斯堡奧利弗坦博',-26.1367,28.2411,33.0,4418,60,1694.0,'03L','21R',190,'sa')
];
var allAirports=[...taiwanAirports,...internationalAirports];
function runwayCoordinates(x,z,r){
  const dx=x-r.x,dz=z-r.z,s=Math.sin(r.heading),c=Math.cos(r.heading);
  return {along:dx*s-dz*c,cross:dx*c+dz*s};
}
function airportPoint(r,along,cross){
  const s=Math.sin(r.heading),c=Math.cos(r.heading);
  return {x:r.x+along*s+cross*c,z:r.z-along*c+cross*s};
}
const parkingPoint=r=>airportPoint(r,r.parkingAlong??65,r.apron);
const regionalWaypoints=[
  {name:'東北角外海',...geoPoint(25.023,122.035)},
  {name:'宜蘭外海',...geoPoint(24.759,122.027)},
  {name:'南澳外海',...geoPoint(24.425,121.858)}
];
function regionalRoute(from,to){
  const finish=[{name:'進場定位點',...airportPoint(to,-6600,0)},
    {name:to.name+' '+to.designator+' 跑道',...airportPoint(to,-to.length/2+200,0)}];
  if(from.code==='RCSS'&&to.code==='RCYU') return [...regionalWaypoints,...finish];
  if(from.code==='RJTT'&&to.code==='RJAA') return [
    {name:'東京灣彩虹大橋航點',...geoPoint(35.6366,139.7633)},
    {name:'東京鐵塔與丸之內天際線',...geoPoint(35.6586,139.7454)},
    {name:'東京晴空塔導航點',...geoPoint(35.7101,139.8107)},
    {name:'船橋幕張灣岸航點',...geoPoint(35.68,140.05)},
    ...finish
  ];
  if(from.code==='RJBB'&&to.code==='RJTT') return [
    {name:'關西跨海聯絡橋離場點',...geoPoint(34.415,135.300)},
    {name:'大阪城天守閣與梅田天際線',...geoPoint(34.6873,135.5262)},
    {name:'伊勢灣與名古屋南航段',...geoPoint(34.85,136.85)},
    {name:'富士山南麓觀景航點',...geoPoint(35.22,138.75)},
    {name:'東京灣彩虹大橋進場點',...geoPoint(35.52,139.80)},
    ...finish
  ];
  if(to.code==='RJBB') return [
    {name:'東海航段',...geoPoint(27.55,126.30)},
    {name:'四國足摺岬外海',...geoPoint(32.55,133.10)},
    {name:'淡路島明石海峽進場點',...geoPoint(34.32,134.95)},
    {name:'大阪灣關西人工島進場走廊',...geoPoint(34.38,135.16)},
    ...finish
  ];
  if(to.code==='VTBS') return [
    {name:'南海西沙北航段',...geoPoint(19.20,113.50)},
    {name:'中南半島峴港航段',...geoPoint(15.80,107.50)},
    {name:'曼谷湄南河大皇宮觀景航點',...geoPoint(13.745,100.505)},
    {name:'曼谷像素大廈進場走廊',...geoPoint(13.723,100.560)},
    ...finish
  ];
  if(to.code==='RJAA'||to.code==='RJTT') return [
    {name:'東海航段',...geoPoint(27.55,126.30)},
    {name:'琉球東方航段',...geoPoint(29.68,131.37)},
    {name:'駿河灣富士山觀景航點',...geoPoint(35.12,138.82)},
    {name:to.code==='RJTT'?'東京灣彩虹大橋進場點':'房總外海下降點',...geoPoint(to.code==='RJTT'?35.48:34.83,to.code==='RJTT'?139.84:140.65)},
    ...finish
  ];
  if(to.code==='VHHH') return [
    {name:'海峽西南航段',...geoPoint(23.20,118.80)},
    {name:'東沙北航段',...geoPoint(22.60,116.20)},
    {name:'維多利亞港進場走廊',...geoPoint(22.29,114.16)},
    ...finish
  ];
  if(to.code==='ROAH') return [
    {name:'宮古島北航段',...geoPoint(25.30,125.20)},
    {name:'慶良間諸島航段',...geoPoint(26.05,127.20)},
    ...finish
  ];
  if(to.code==='RKSI') return [
    {name:'東海北方航段',...geoPoint(28.80,123.50)},
    {name:'濟州島西側航段',...geoPoint(33.40,126.10)},
    {name:'黃海仁川進場點',...geoPoint(36.90,126.30)},
    ...finish
  ];
  if(to.code==='WSSS') return [
    {name:'南海北段航點',...geoPoint(18.50,116.50)},
    {name:'南沙西側航段',...geoPoint(9.20,109.80)},
    {name:'馬六甲海峽進場點',...geoPoint(1.80,104.20)},
    ...finish
  ];
  if(to.code==='RPLL') return [
    {name:'巴士海峽航段',...geoPoint(20.20,121.10)},
    {name:'呂宋北岸航段',...geoPoint(17.40,120.60)},
    {name:'馬尼拉灣進場點',...geoPoint(14.48,120.85)},
    ...finish
  ];
  if(from.code==='RJAA'||from.code==='RJTT') return [
    {name:'東京灣離場航點',...geoPoint(35.35,139.65)},
    {name:'富士山南麓航段',...geoPoint(35.15,138.75)},
    {name:'琉球東方航段',...geoPoint(29.68,131.37)},
    {name:'彭佳嶼東北下降點',...geoPoint(26.00,122.50)},
    ...finish
  ];
  if(from.code==='RJBB') return [
    {name:'大阪灣離場航點',...geoPoint(34.58,135.38)},
    {name:'四國南岸航段',...geoPoint(32.55,133.10)},
    {name:'琉球東方航段',...geoPoint(28.50,128.50)},
    ...finish
  ];
  if(from.code==='VHHH') return [
    {name:'大嶼山出發航段',...geoPoint(22.25,114.15)},
    {name:'東沙北航段',...geoPoint(22.60,116.20)},
    {name:'海峽西南航段',...geoPoint(23.20,118.80)},
    ...finish
  ];
  if(from.code==='ROAH') return [
    {name:'慶良間諸島航段',...geoPoint(26.05,127.20)},
    {name:'宮古島北航段',...geoPoint(25.30,125.20)},
    {name:'宜蘭外海下降點',...geoPoint(24.85,122.30)},
    ...finish
  ];
  if(from.code==='RKSI') return [
    {name:'仁川大橋離場點',...geoPoint(37.10,126.35)},
    {name:'濟州海峽航段',...geoPoint(33.40,126.10)},
    {name:'彭佳嶼北方下降點',...geoPoint(26.10,122.10)},
    ...finish
  ];
  if(from.code==='WSSS') return [
    {name:'濱海灣離場點',...geoPoint(1.55,104.10)},
    {name:'南海中段航點',...geoPoint(11.00,112.00)},
    {name:'高雄西南下降點',...geoPoint(21.80,119.80)},
    ...finish
  ];
  if(from.code==='RPLL') return [
    {name:'馬尼拉灣離場點',...geoPoint(14.75,120.80)},
    {name:'呂宋海峽航段',...geoPoint(19.50,120.90)},
    ...finish
  ];
  if(from.code==='VTBS') return [
    {name:'湄南河大皇宮離場點',...geoPoint(13.745,100.505)},
    {name:'暹羅灣北航點',...geoPoint(13.20,100.85)},
    {name:'南海西南航段',...geoPoint(10.50,108.50)},
    ...finish
  ];
  const enroute=from&&to&&from!==to&&haversineKm(from,to)>1200?greatCircleWaypoints(from,to,3):[];
  return [...enroute,...finish];
}
const regionalGridStep=240;
function islandGridAt(x,z){
  if(typeof islandElevationData==='undefined') return;
  return islandElevationData.find(([left,top,columns,rows])=>
    x>=left&&z>=top&&x<left+(columns-1)*40&&z<top+(rows-1)*40);
}
function islandHeight(x,z,grid){
  const [left,top,columns]=grid;
  if(typeof grid[4]==='string'){
    const raw=atob(grid[4]),samples=new Uint16Array(raw.length/2);
    for(let i=0;i<samples.length;i++) samples[i]=raw.charCodeAt(i*2)|raw.charCodeAt(i*2+1)<<8;
    grid[4]=samples;
  }
  const u=(x-left)/40,v=(z-top)/40;
  const col=Math.floor(u),row=Math.floor(v),a=u-col,b=v-row,k=row*columns+col,h=grid[4];
  return (h[k]*(1-a)+h[k+1]*a)*(1-b)+(h[k+columns]*(1-a)+h[k+columns+1]*a)*b;
}
function shortFieldBlend(r,along,cross,padding=0){
  const runwayEdge=Math.max(Math.abs(along)-r.length/2-18,Math.abs(cross)-r.width/2-14);
  const apronEdge=Math.max(Math.abs(along-r.parkingAlong)-48,Math.abs(cross-r.apron/2)-Math.abs(r.apron)/2-20);
  return 1-Math.max(0,Math.min(1,(Math.min(runwayEdge,apronEdge)-padding)/66));
}
let centralMountainTiles;
function registerCentralMountains(tiles){centralMountainTiles=tiles;}
function centralMountainTile(col,row){return centralMountainTiles?.[col+':'+row];}
function detailedMountainHeight(x,z,base){
  const span=11520,step=120,side=span/step+1;
  const col=Math.floor(x/span),row=Math.floor(z/span),key=col+':'+row;
  let samples=centralMountainTile(col,row);
  if(!samples||base<350) return base;
  if(typeof samples==='string'){
    const raw=atob(samples);
    samples=new Uint16Array(side*side);
    for(let i=0;i<samples.length;i++) samples[i]=raw.charCodeAt(2*i)|raw.charCodeAt(2*i+1)<<8;
    centralMountainTiles[key]=samples;
  }
  const u=x/step-col*(side-1),v=z/step-row*(side-1);
  const i=Math.min(side-2,Math.floor(u)),j=Math.min(side-2,Math.floor(v)),a=u-i,b=v-j,k=j*side+i;
  const detail=(samples[k]*(1-a)+samples[k+1]*a)*(1-b)+(samples[k+side]*(1-a)+samples[k+side+1]*a)*b;
  const edge=Math.min(u,v,side-1-u,side-1-v);
  const blend=Math.min(1,edge/4,(base-350)/250);
  return base+(detail-base)*blend;
}
function internationalTerrainHeight(x,z){
  if(typeof pilotTerrainHeight==='function'){const sample=pilotTerrainHeight(x,z);if(sample!==null)return sample;}
  if(Math.abs(x)<360000&&Math.abs(z)<360000) return 0;
  const {lat,lon}=latLon(x,z);
  const noise=(Math.sin(x*.00043)+Math.cos(z*.00039)+Math.sin((x+z)*.00021))*.33;
  // 1. Japan Kanto / Tokyo Bay / Haneda / Narita / Mt. Fuji
  if(lat>=34.6&&lat<=36.5&&lon>=138.3&&lon<=141.0){
    const fujiKm=Math.hypot((lat-35.3606)*111,(lon-138.7274)*90.5);
    if(fujiKm<32){
      const cone=3776*Math.exp(-Math.pow(fujiKm/9.2,1.62));
      const crater=fujiKm<0.9?(0.9-fujiKm)*220:0;
      return Math.max(45,cone-crater+noise*28);
    }
    const hakoneKm=Math.hypot((lat-35.23)*111,(lon-139.02)*90.5);
    const tanzawaKm=Math.hypot((lat-35.47)*111,(lon-139.16)*90.5);
    const isOdaiba=lat>=35.612&&lat<=35.648&&lon>=139.760&&lon<=139.825;
    const isUrayasu=lat>=35.620&&lon>=139.850;
    const isKawasakiPort=lat>=35.485&&lat<=35.555&&lon<=139.798;
    const inTokyoBay=!isOdaiba&&!isUrayasu&&!isKawasakiPort&&lat>=35.22&&lat<=35.63&&lon>=139.77&&lon<=140.04&&Math.hypot((lat-35.5494)*111,(lon-139.7798)*90.5)>3.5;
    if(inTokyoBay) return 0;
    let h=14+noise*9;
    if(hakoneKm<18) h+=1150*Math.exp(-Math.pow(hakoneKm/8.5,1.8));
    if(tanzawaKm<22) h+=1420*Math.exp(-Math.pow(tanzawaKm/10,1.8));
    if(lon>140.0&&lat<35.35) h+=190*Math.max(0,1-Math.hypot((lat-35.15)*111,(lon-140.12)*90.5)/24);
    return Math.max(4,h);
  }
  // 2. Okinawa Main Island (ROAH)
  if(lat>=26.04&&lat<=26.88&&lon>=127.60&&lon<=128.35){
    const spineLon=127.67+(lat-26.15)*0.76;
    const crossKm=Math.abs(lon-spineLon)*99.5;
    if(crossKm>9.5) return 0;
    const northHill=Math.max(0,(lat-26.32)*620);
    const shuriHill=128*Math.exp(-Math.pow(Math.hypot((lat-26.217)*111,(lon-127.719)*99.5)/2.1,1.9));
    return Math.max(4,(1-Math.pow(crossKm/9.5,1.8))*(16+northHill+noise*9)+shuriHill);
  }
  // 3. Hong Kong (VHHH / Lantau / Victoria Harbour / Victoria Peak / Kowloon)
  if(lat>=22.15&&lat<=22.56&&lon>=113.84&&lon<=114.36){
    const clkKm=Math.hypot((lat-22.308)*111,(lon-113.9185)*102.5);
    if(clkKm<3.4) return 8.5;
    const inHarbour=lat>=22.2862&&lat<=22.2935&&lon>=114.135&&lon<=114.215;
    if(inHarbour) return 0;
    const lantauPeak=934*Math.exp(-Math.pow(Math.hypot((lat-22.246)*111,(lon-113.922)*102.5)/4.4,1.75));
    const sunsetPeak=869*Math.exp(-Math.pow(Math.hypot((lat-22.261)*111,(lon-113.957)*102.5)/4.5,1.75));
    const vicRaw=552*Math.exp(-Math.pow(Math.hypot((lat-22.2759)*111,(lon-114.1455)*102.5)/1.38,1.95));
    const harborSlope=lat>22.280?Math.max(0,1-(lat-22.280)/0.006):1;
    const vicPeak=vicRaw*harborSlope;
    const taiMoShan=957*Math.exp(-Math.pow(Math.hypot((lat-22.411)*111,(lon-114.123)*102.5)/6.8,1.75));
    const lionRock=495*Math.exp(-Math.pow(Math.hypot((lat-22.352)*111,(lon-114.187)*102.5)/3.4,1.8));
    const tungChung=(lat>=22.280&&lat<=22.302&&lon>=113.924&&lon<=113.962)?9.5:0;
    const hkIslandShore=(lat>=22.274&&lat<22.2862&&lon>=114.125&&lon<=114.245)?8.5+noise*2:0;
    const kowloonFlat=(lat>=22.293&&lat<=22.48&&lon>=113.96&&lon<=114.29)?11+noise*4:0;
    const h=Math.max(lantauPeak,sunsetPeak,vicPeak,taiMoShan,lionRock,tungChung,hkIslandShore,kowloonFlat);
    return h>4?h:0;
  }
  // 4. Seoul / Incheon (RKSI / Songdo / Han River / Namsan / Bukhansan)
  if(lat>=37.25&&lat<=37.78&&lon>=126.35&&lon<=127.22){
    const yeongjongKm=Math.hypot((lat-37.465)*111,(lon-126.465)*88.2);
    if(yeongjongKm<8.2){
      const baegun=142*Math.exp(-Math.pow(Math.hypot((lat-37.488)*111,(lon-126.512)*88.2)/2.4,1.8));
      return Math.max(6.5,8+baegun);
    }
    if(lon<126.60) return 0;
    const namsan=262*Math.exp(-Math.pow(Math.hypot((lat-37.5512)*111,(lon-126.9882)*88.2)/2.3,1.75));
    const bukhansan=836*Math.exp(-Math.pow(Math.hypot((lat-37.6587)*111,(lon-126.9770)*88.2)/5.2,1.75));
    const gwanaksan=632*Math.exp(-Math.pow(Math.hypot((lat-37.444)*111,(lon-126.963)*88.2)/4.5,1.75));
    return Math.max(12,18+noise*8+namsan+bukhansan+gwanaksan);
  }
  // 5. Singapore (WSSS / Marina Bay / Bukit Timah)
  if(lat>=1.20&&lat<=1.49&&lon>=103.60&&lon<=104.06){
    const rx=(lon-103.83)*111.3/23.5,ry=(lat-1.355)*110.6/13.2;
    if(rx*rx+ry*ry>1.08) return 0;
    const bukitTimah=163*Math.exp(-Math.pow(Math.hypot((lat-1.3547)*110.6,(lon-103.7764)*111.3)/3.2,1.8));
    return Math.max(5.5,11+noise*4+bukitTimah);
  }
  // 6. Manila (RPLL / Manila Bay / Makati / Bataan / Sierra Madre)
  if(lat>=14.25&&lat<=14.88&&lon>=120.40&&lon<=121.35){
    const bataan=1388*Math.exp(-Math.pow(Math.hypot((lat-14.52)*111,(lon-120.48)*107.5)/8.5,1.75));
    if(bataan>8) return bataan;
    if(lon<120.962) return 0;
    const sierra=lon>121.12?(lon-121.12)*2400+noise*35:0;
    return Math.max(8,16+noise*6+sierra);
  }
  // 7. Japan Osaka Bay / Kansai / Kobe / Mt. Rokko / Awaji Island (RJBB)
  if(lat>=34.15&&lat<=34.92&&lon>=134.82&&lon<=135.82){
    const kixKm=Math.hypot((lat-34.4347)*111,(lon-135.2440)*91.5);
    if(kixKm<3.8) return 5.2;
    const awajiKm=Math.hypot((lat-34.34)*111,(lon-134.88)*91.5);
    if(awajiKm<12.5) return Math.max(8,520*Math.exp(-Math.pow(awajiKm/6.2,1.75))+noise*12);
    const isKobePort=lat>=34.655&&lon>=135.14&&lon<=135.38;
    const isRinku=lat>=34.395&&lat<=34.432&&lon>=135.285&&lon<=135.345;
    if(isRinku) return 7.5+Math.abs(noise)*1.8;
    const shoreLon=lat>=34.56?(135.43-Math.max(0,lat-34.64)*4.5):(135.43-(34.56-lat)*0.85);
    const inOsakaBay=!isKobePort&&!isRinku&&lat>=34.26&&lat<=34.675&&lon>=135.01&&lon<shoreLon;
    if(inOsakaBay) return 0;
    const rokko=931*Math.exp(-Math.pow(Math.hypot((lat-34.778)*111,(lon-135.264)*91.5)/6.2,1.75));
    const ikoma=642*Math.exp(-Math.pow(Math.hypot((lat-34.679)*111,(lon-135.680)*91.5)/5.8,1.75));
    const izumi=780*Math.exp(-Math.pow(Math.hypot((lat-34.32)*111,(lon-135.45)*91.5)/8.5,1.75));
    return Math.max(6,14+noise*6+rokko+ikoma+izumi);
  }
  // 8. Thailand Bangkok / Chao Phraya River Delta & Suvarnabhumi (VTBS)
  if(lat>=13.38&&lat<=14.08&&lon>=100.32&&lon<=101.05){
    if(lat<13.50&&lon<100.82) return 0; // Upper Gulf of Thailand
    const riverLon=100.515+Math.sin((lat-13.50)*26)*0.032;
    const riverDistKm=Math.abs(lon-riverLon)*108.0;
    if(riverDistKm<0.42&&lat<13.95) return 0;
    const khaoKhiao=645*Math.exp(-Math.pow(Math.hypot((lat-13.42)*111,(lon-100.98)*108.0)/6.8,1.75));
    return Math.max(2.5,7.5+noise*3.5+khaoKhiao);
  }
  return 0;
}

const internationalRegions=[
  {
    id:'TW', name:'🇹🇼 臺灣本島與離島', airportCode:'RCTP',
    centerLat:24.10, centerLon:120.95, spanKm:380,
    landmarks:[
      {name:'台北 101',lat:25.0339,lon:121.5645},
      {name:'玉山主峰 3952m',lat:23.4700,lon:120.9573},
      {name:'高雄 85 大樓',lat:22.6111,lon:120.3035},
      {name:'台中歌劇院',lat:24.1628,lon:120.6404}
    ]
  },
  {
    id:'JP_TYO', name:'🇯🇵 日本東京灣與富士山', airportCode:'RJTT',
    centerLat:35.58, centerLon:139.78, spanKm:145,
    box:{s:34.65,n:36.25,w:138.45,e:140.75},
    urbanZones:[
      {lat:35.67,lon:139.76,rKm:18,label:'東京都心 23 區'},
      {lat:35.45,lon:139.64,rKm:11,label:'橫濱港未來'},
      {lat:35.61,lon:140.11,rKm:10,label:'千葉幕張'}
    ],
    rivers:[
      [[35.78,139.72],[35.71,139.80],[35.66,139.78],[35.62,139.77]],
      [[35.79,139.85],[35.70,139.85],[35.64,139.84]]
    ],
    bridges:[
      {name:'彩虹大橋',pts:[[35.641,139.754],[35.632,139.773]]},
      {name:'東京灣跨海公路 Aqualine',pts:[[35.518,139.785],[35.442,139.928]]}
    ],
    landmarks:[
      {name:'東京晴空塔 634m',lat:35.7101,lon:139.8107},
      {name:'東京鐵塔 333m',lat:35.6586,lon:139.7454},
      {name:'彩虹大橋',lat:35.6366,lon:139.7633},
      {name:'富士山 3776m',lat:35.3606,lon:138.7274},
      {name:'成田山新勝寺',lat:35.7858,lon:140.3183}
    ]
  },
  {
    id:'JP_KIX', name:'🇯🇵 日本大阪關西與神戶港', airportCode:'RJBB',
    centerLat:34.56, centerLon:135.36, spanKm:95,
    box:{s:34.18,n:34.90,w:134.84,e:135.78},
    urbanZones:[
      {lat:34.69,lon:135.50,rKm:15,label:'大阪梅田·難波都心'},
      {lat:34.69,lon:135.19,rKm:9,label:'神戶三宮港區'},
      {lat:34.41,lon:135.32,rKm:7,label:'泉佐野臨空城'}
    ],
    rivers:[
      [[34.82,135.65],[34.72,135.52],[34.66,135.42]]
    ],
    bridges:[
      {name:'關西機場聯絡橋',pts:[[34.434,135.258],[34.412,135.298]]},
      {name:'明石海峽大橋',pts:[[34.632,135.022],[34.598,135.012]]}
    ],
    landmarks:[
      {name:'大阪城天守閣',lat:34.6873,lon:135.5262},
      {name:'梅田藍天大廈',lat:34.7055,lon:135.4896},
      {name:'關西跨海聯絡橋',lat:34.4230,lon:135.2780},
      {name:'六甲山夜景 931m',lat:34.7780,lon:135.2640}
    ]
  },
  {
    id:'JP_OKA', name:'🇯🇵 沖繩那霸與慶良間諸島', airportCode:'ROAH',
    centerLat:26.25, centerLon:127.72, spanKm:82,
    box:{s:26.02,n:26.86,w:127.15,e:128.32},
    urbanZones:[
      {lat:26.215,lon:127.685,rKm:8.5,label:'那霸國際通都會區'},
      {lat:26.335,lon:127.800,rKm:7.0,label:'沖繩北谷美國村'}
    ],
    rivers:[],
    bridges:[
      {name:'古宇利大橋',pts:[[26.678,128.015],[26.696,128.018]]}
    ],
    landmarks:[
      {name:'首里城正殿',lat:26.2170,lon:127.7195},
      {name:'那霸國際通',lat:26.2145,lon:127.6840},
      {name:'慶良間珊瑚礁海',lat:26.1850,lon:127.3600}
    ]
  },
  {
    id:'HK_HKG', name:'🇭🇰 香港維多利亞港與大嶼山', airportCode:'VHHH',
    centerLat:22.31, centerLon:114.08, spanKm:68,
    box:{s:22.16,n:22.54,w:113.85,e:114.34},
    urbanZones:[
      {lat:22.282,lon:114.165,rKm:7.5,label:'香港島中環·灣仔'},
      {lat:22.318,lon:114.172,rKm:9.5,label:'九龍尖沙咀·旺角'},
      {lat:22.289,lon:113.942,rKm:5.5,label:'東涌新市鎮'}
    ],
    rivers:[],
    bridges:[
      {name:'青馬大橋',pts:[[22.348,114.058],[22.356,114.092]]},
      {name:'港珠澳大橋香港段',pts:[[22.305,113.945],[22.265,113.865]]}
    ],
    landmarks:[
      {name:'中環 IFC & 中銀大廈',lat:22.2852,lon:114.1581},
      {name:'九龍 ICC 484m',lat:22.3034,lon:114.1602},
      {name:'青馬大橋',lat:22.3514,lon:114.0736},
      {name:'太平山頂 552m',lat:22.2759,lon:114.1455},
      {name:'大嶼山鳳凰山 934m',lat:22.2460,lon:113.9220}
    ]
  },
  {
    id:'KR_ICN', name:'🇰🇷 韓國首爾漢江與仁川港', airportCode:'RKSI',
    centerLat:37.50, centerLon:126.76, spanKm:96,
    box:{s:37.26,n:37.76,w:126.36,e:127.20},
    urbanZones:[
      {lat:37.55,lon:126.99,rKm:16,label:'首爾江南·光化門都心'},
      {lat:37.40,lon:126.65,rKm:10,label:'仁川松島國際都市'},
      {lat:37.52,lon:126.92,rKm:7,label:'汝矣島金融特區'}
    ],
    rivers:[
      [[37.55,127.18],[37.52,127.02],[37.53,126.92],[37.58,126.80],[37.68,126.64]]
    ],
    bridges:[
      {name:'仁川跨海大橋',pts:[[37.432,126.492],[37.396,126.628]]},
      {name:'永宗大橋',pts:[[37.515,126.525],[37.562,126.625]]}
    ],
    landmarks:[
      {name:'樂天世界塔 555m',lat:37.5125,lon:127.1025},
      {name:'N首爾塔 239m',lat:37.5512,lon:126.9882},
      {name:'仁川跨海大橋',lat:37.4138,lon:126.5655},
      {name:'松島國際摩天群',lat:37.4420,lon:126.4860}
    ]
  },
  {
    id:'SG_SIN', name:'🇸🇬 新加坡濱海灣與樟宜', airportCode:'WSSS',
    centerLat:1.33, centerLon:103.89, spanKm:58,
    box:{s:1.21,n:1.48,w:103.61,e:104.05},
    urbanZones:[
      {lat:1.285,lon:103.855,rKm:9.5,label:'濱海灣金融中心 CBD'},
      {lat:1.352,lon:103.945,rKm:7.5,label:'淡濱尼與樟宜城區'}
    ],
    rivers:[
      [[1.305,103.835],[1.288,103.852],[1.282,103.868]]
    ],
    bridges:[
      {name:'薛爾思跨海大橋',pts:[[1.289,103.862],[1.294,103.876]]},
      {name:'新柔長堤',pts:[[1.445,103.769],[1.461,103.764]]}
    ],
    landmarks:[
      {name:'濱海灣金沙酒店 MBS',lat:1.2834,lon:103.8607},
      {name:'濱海灣花園超級擎天樹',lat:1.2816,lon:103.8636},
      {name:'星耀樟宜與控制塔',lat:1.3592,lon:103.9893},
      {name:'武吉知馬山 163m',lat:1.3547,lon:103.7764}
    ]
  },
  {
    id:'PH_MNL', name:'🇵🇭 菲律賓馬尼拉灣與馬卡蒂', airportCode:'RPLL',
    centerLat:14.54, centerLon:120.99, spanKm:76,
    box:{s:14.26,n:14.86,w:120.42,e:121.32},
    urbanZones:[
      {lat:14.555,lon:121.025,rKm:11,label:'馬卡蒂 & BGC 金融特區'},
      {lat:14.595,lon:120.985,rKm:9,label:'馬尼拉王城區與海灣'}
    ],
    rivers:[
      [[14.595,120.960],[14.588,121.015],[14.555,121.085]]
    ],
    bridges:[
      {name:'CCLEX 宿霧馬尼拉海灣走廊',pts:[[14.525,120.982],[14.485,120.955]]}
    ],
    landmarks:[
      {name:'馬尼拉灣摩天輪 & BGC',lat:14.5350,lon:121.0020},
      {name:'巴丹山脈 1388m',lat:14.5200,lon:120.4800}
    ]
  },
  {
    id:'TH_BKK', name:'🇹🇭 泰國曼谷湄南河與大皇宮', airportCode:'VTBS',
    centerLat:13.72, centerLon:100.62, spanKm:78,
    box:{s:13.40,n:14.04,w:100.35,e:101.02},
    urbanZones:[
      {lat:13.745,lon:100.535,rKm:14,label:'曼谷暹羅·是隆摩天都會區'},
      {lat:13.700,lon:100.735,rKm:8.5,label:'蘇凡納布空港新城'}
    ],
    rivers:[
      [[13.96,100.52],[13.84,100.51],[13.75,100.49],[13.70,100.51],[13.64,100.54],[13.54,100.58]]
    ],
    bridges:[
      {name:'拉瑪八世斜張橋',pts:[[13.769,100.494],[13.768,100.503]]},
      {name:'普密蓬跨河雙橋',pts:[[13.665,100.535],[13.655,100.548]]}
    ],
    landmarks:[
      {name:'曼谷大皇宮與鄭王廟',lat:13.7500,lon:100.4913},
      {name:'MahaNakhon 像素大廈 314m',lat:13.7236,lon:100.5283},
      {name:'拉瑪八世斜張橋',lat:13.7688,lon:100.4982}
    ]
  }
];
internationalRegions.push(...[{"id": "MY_KUL", "name": "馬來西亞 · 吉隆坡城市試作區", "airportCode": "WMKK", "centerLat": 3.155, "centerLon": 101.7075, "spanKm": 68, "box": {"s": 2, "n": 4, "w": 101, "e": 102}, "landmarks": [], "urbanZones": [], "rivers": [], "bridges": []}, {"id": "ID_CGK", "name": "印尼 · 雅加達城市試作區", "airportCode": "WIII", "centerLat": -6.175, "centerLon": 106.825, "spanKm": 50, "box": {"s": -7, "n": -6, "w": 106, "e": 107}, "landmarks": [], "urbanZones": [], "rivers": [], "bridges": []}]);
// Project region metadata once for maps and relief patches.
for(const reg of internationalRegions){
 reg.center=geoPoint(reg.centerLat,reg.centerLon);
 const span=reg.spanKm*1000;
 if(reg.box){const nw=geoPoint(reg.box.n,reg.box.w),se=geoPoint(reg.box.s,reg.box.e);reg.bounds=[nw.x,nw.z,se.x-nw.x,se.z-nw.z];}
 else reg.bounds=[reg.center.x-span/2,reg.center.z-span/2,span,span];
 for(const zone of reg.urbanZones||[])Object.assign(zone,geoPoint(zone.lat,zone.lon),{r:zone.rKm*1000});
}
function regionalHeight(x,z){
  let height=0;
  if(x>=-18000&&x<=18000&&z>=-18000&&z<=18000){
    height=groundHeight(x,z);
  }else{
    const u=(x-regionalElevation.x)/regionalGridStep,v=(z-regionalElevation.z)/regionalGridStep;
    const i=Math.floor(u),j=Math.floor(v);
    const {columns,rows,heights}=regionalElevation;
    if(i>=0&&j>=0&&i<columns-1&&i>=0&&j<rows-1){
      const a=u-i,b=v-j,k=j*columns+i;
      height=(heights[k]*(1-a)+heights[k+1]*a)*(1-b)+(heights[k+columns]*(1-a)+heights[k+columns+1]*a)*b;
    }
  }
  if(typeof kinmenElevation!=='undefined'&&x< -270000){
    const {lat,lon}=latLon(x,z);
    const grid=kinmenElevation;
    const u=(lon-grid.west)/grid.step,v=(grid.north-lat)/grid.step;
    const i=Math.floor(u),j=Math.floor(v),n=grid.columns;
    if(i>=0&&j>=0&&i<n-1&&j<grid.rows-1){
      const a=u-i,b=v-j,k=j*n+i,h=grid.heights;
      height=(h[k]*(1-a)+h[k+1]*a)*(1-b)+(h[k+n]*(1-a)+h[k+n+1]*a)*b;
    }
  }
  const intlH=internationalTerrainHeight(x,z);
  if(intlH>height) height=intlH;
  if(typeof naritaHeight==='function'&&x>1500000){
    const nh=naritaHeight(x,z);
    if(nh>0) height=nh;
  }
  if(centralMountainTiles&&height>350) height=detailedMountainHeight(x,z,height);
  const island=islandGridAt(x,z);
  if(island) height=islandHeight(x,z,island);
  if(height<0.8&&typeof WorldAtlas!=='undefined'&&typeof WorldAtlas.globalLandElevation==='function'){
    const {lat,lon}=latLon(x,z);
    if(lat<21.8||lat>25.4||lon<119.3||lon>122.1){
      const glH=WorldAtlas.globalLandElevation(lon,lat,x,z);
      if(glH>height){
        height=glH;
        // Smooth metropolitan basin around global airports so cities & approach corridors sit on realistic plains
        for(const r of internationalAirports){
          if(r.carrier||r.region==='tw') continue;
          const d=Math.hypot(x-r.x,z-r.z);
          if(d<22000){
            const t=Math.max(0,Math.min(1,(d-5200)/16800));
            const smooth=t*t*(3-2*t);
            const basinElev=Math.max(1.8,r.elevation);
            height=basinElev+(height-basinElev)*smooth;
            break;
          }
        }
      }
    }
  }
  for(const r of allAirports){
    const reach=r.length/2+550;
    if(Math.abs(x-r.x)>reach||Math.abs(z-r.z)>reach) continue;
    const {along,cross}=runwayCoordinates(x,z,r);
    if(r.carrier){
      if(Math.abs(along)<=r.length/2+8&&Math.abs(cross)<=r.width/2+6){
        return r.elevation;
      }
      continue;
    }
    const blend=r.shortField?shortFieldBlend(r,along,cross):
      Math.max(0,1-Math.max((Math.abs(along)-r.length/2-60)/270,(Math.abs(cross)-(r.gameExpanded?Math.max(265,Math.abs(r.apron)+190):265))/165));
    if(blend>0) return height+(r.elevation-height)*Math.min(1,blend);
  }
  return height;
}
if(typeof module!=='undefined') Object.assign(globalThis,{geoPoint,latLon,taiwanAirports,internationalAirports,allAirports,AIRPORT_REGIONS,haversineKm,greatCircleWaypoints,internationalRegions,internationalTerrainHeight,airportPoint,parkingPoint,runwayCoordinates,regionalRoute,regionalHeight});



// Reserve the enlarged game airport pavement from data-generated city objects.
function expandedAirportFootprint(x,z,padding=0){
 for(const a of allAirports){if(!a.gameExpanded)continue;const p=runwayCoordinates(x,z,a),side=Math.sign(a.apron)||1;
  if(Math.abs(p.along)<=a.length/2+80+padding&&p.cross*side>=-a.width/2-30-padding&&p.cross*side<=Math.abs(a.apron)+130+padding)return true;
 }
 return false;
}
