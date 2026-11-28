import{B as e,F as t,I as n,L as r,R as i,W as a,i as o,mt as s,n as c,r as l,t as u,u as d}from"../ui-BSf9Ds6y.js";import{n as f}from"../session-BsH9hees.js";import{$ as p,A as m,At as h,Bt as g,C as _,Cn as v,Ct as y,D as b,Dt as x,E as S,Et as C,F as w,Ft as T,G as E,Gt as D,H as O,Ht as k,I as A,J as j,Jt as ee,K as M,Kt as N,L as te,Lt as P,M as ne,Mt as re,N as F,Nt as ie,O as I,Ot as L,P as R,Q as ae,Qt as z,R as oe,Rt as se,S as ce,Sn as le,St as B,T as ue,Tn as de,Tt as fe,U as V,Ut as pe,Vt as me,W as he,Wt as H,X as ge,Xt as _e,Y as U,Yt as ve,Z as ye,Zt as be,_ as xe,_n as W,_t as Se,a as Ce,an as we,at as Te,b as G,bn as Ee,bt as De,c as Oe,cn as K,ct as ke,d as Ae,dn as je,dt as Me,et as q,f as Ne,fn as Pe,ft as Fe,g as Ie,gn as Le,gt as Re,h as ze,hn as Be,ht as Ve,i as He,in as Ue,it as We,j as Ge,jt as Ke,k as qe,kt as Je,l as Ye,ln as Xe,lt as Ze,m as Qe,mn as J,mt as $e,nn as et,nt as tt,o as nt,on as rt,p as it,pn as at,pt as ot,q as st,qt as ct,r as lt,rn as ut,rt as dt,s as ft,sn as pt,st as mt,t as ht,tn as gt,tt as _t,u as vt,un as yt,ut as bt,vn as xt,vt as St,w as Ct,wn as wt,x as Tt,xn as Y,xt as X,y as Et,yn as Dt,yt as Ot,z as kt,zt as At}from"../timers-C6jtOaCw.js";import{t as jt}from"../tapflow-DWF2RTy8.js";import{t as Mt}from"../feed-C_pQ7Z_x.js";import{r as Nt,t as Pt}from"../BufferGeometryUtils-CYEOIXFU.js";var Ft=Object.defineProperty,It=(e,t)=>{let n={};for(var r in e)Ft(n,r,{get:e[r],enumerable:!0});return t||Ft(n,Symbol.toStringTag,{value:`Module`}),n},Lt=new De,Rt=class e{constructor(e){e||={},this.zNear=e.webGL===!0?-1:0,this.zFar=1,this.vertices={near:[new Y,new Y,new Y,new Y],far:[new Y,new Y,new Y,new Y]},e.projectionMatrix!==void 0&&this.setFromProjectionMatrix(e.projectionMatrix,e.maxFar||1e4),e.reversedDepth===!0&&(this.zNear=1,this.zFar=0)}setFromProjectionMatrix(e,t){let n=this.zNear,r=this.zFar,i=e.elements[11]===0;return Lt.copy(e).invert(),this.vertices.near[0].set(1,1,n),this.vertices.near[1].set(1,-1,n),this.vertices.near[2].set(-1,-1,n),this.vertices.near[3].set(-1,1,n),this.vertices.near.forEach(function(e){e.applyMatrix4(Lt)}),this.vertices.far[0].set(1,1,r),this.vertices.far[1].set(1,-1,r),this.vertices.far[2].set(-1,-1,r),this.vertices.far[3].set(-1,1,r),this.vertices.far.forEach(function(e){e.applyMatrix4(Lt);let n=Math.abs(e.z);i?e.z*=Math.min(t/n,1):e.multiplyScalar(Math.min(t/n,1))}),this.vertices}split(t,n){for(;t.length>n.length;)n.push(new e);n.length=t.length;let r=this.vertices.near[0].z,i=this.vertices.far[0].z;for(let e=0;e<t.length;e++){let a=n[e];if(e===0)for(let e=0;e<4;e++)a.vertices.near[e].copy(this.vertices.near[e]);else{let n=(t[e-1]*i-r)/(i-r);for(let e=0;e<4;e++)a.vertices.near[e].lerpVectors(this.vertices.near[e],this.vertices.far[e],n)}if(e===t.length-1)for(let e=0;e<4;e++)a.vertices.far[e].copy(this.vertices.far[e]);else{let n=(t[e]*i-r)/(i-r);for(let e=0;e<4;e++)a.vertices.far[e].lerpVectors(this.vertices.near[e],this.vertices.far[e],n)}}}toSpace(e,t){for(let n=0;n<4;n++)t.vertices.near[n].copy(this.vertices.near[n]).applyMatrix4(e),t.vertices.far[n].copy(this.vertices.far[n]).applyMatrix4(e)}},zt=It({CSMShader:()=>Bt}),Bt={lights_fragment_begin:`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );

vec3 geometryClearcoatNormal = vec3( 0.0 );

#ifdef USE_CLEARCOAT

	geometryClearcoatNormal = clearcoatNormal;

#endif

#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		// Iridescence F0 approximation
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif

IncidentLight directLight;

#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )

	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif

	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {

		pointLight = pointLights[ i ];

		getPointLightInfo( pointLight, geometryPosition, directLight );

		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;

		#endif

		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );

	}
	#pragma unroll_loop_end

#endif

#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )

	SpotLight spotLight;
 	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;

	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif

	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {

		spotLight = spotLights[ i ];

		getSpotLightInfo( spotLight, geometryPosition, directLight );

  		// spot lights are ordered [shadows with maps, shadows without maps, maps without shadows, none]
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX

		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;

		#endif

		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );

	}
	#pragma unroll_loop_end

#endif

#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct ) && defined( USE_CSM ) && defined( CSM_CASCADES )

	DirectionalLight directionalLight;
	float linearDepth = (vViewPosition.z) / (shadowFar - cameraNear);
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif

	#if defined( USE_SHADOWMAP ) && defined( CSM_FADE )
		vec2 cascade;
		float cascadeCenter;
		float closestEdge;
		float margin;
		float csmx;
		float csmy;

		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {

			directionalLight = directionalLights[ i ];
			getDirectionalLightInfo( directionalLight, directLight );

			#if ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
				// NOTE: Depth gets larger away from the camera.
				// cascade.x is closer, cascade.y is further
				cascade = CSM_cascades[ i ];
				cascadeCenter = ( cascade.x + cascade.y ) / 2.0;
				closestEdge = linearDepth < cascadeCenter ? cascade.x : cascade.y;
				margin = 0.25 * pow( closestEdge, 2.0 );
				csmx = cascade.x - margin / 2.0;
				csmy = cascade.y + margin / 2.0;
				if( linearDepth >= csmx && ( linearDepth < csmy || UNROLLED_LOOP_INDEX == CSM_CASCADES - 1 ) ) {

					float dist = min( linearDepth - csmx, csmy - linearDepth );
					float ratio = clamp( dist / margin, 0.0, 1.0 );

					vec3 prevColor = directLight.color;
					directionalLightShadow = directionalLightShadows[ i ];
					directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;

					bool shouldFadeLastCascade = UNROLLED_LOOP_INDEX == CSM_CASCADES - 1 && linearDepth > cascadeCenter;
					directLight.color = mix( prevColor, directLight.color, shouldFadeLastCascade ? ratio : 1.0 );

					ReflectedLight prevLight = reflectedLight;
					RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );

					bool shouldBlend = UNROLLED_LOOP_INDEX != CSM_CASCADES - 1 || UNROLLED_LOOP_INDEX == CSM_CASCADES - 1 && linearDepth < cascadeCenter;
					float blendRatio = shouldBlend ? ratio : 1.0;

					reflectedLight.directDiffuse = mix( prevLight.directDiffuse, reflectedLight.directDiffuse, blendRatio );
					reflectedLight.directSpecular = mix( prevLight.directSpecular, reflectedLight.directSpecular, blendRatio );
					reflectedLight.indirectDiffuse = mix( prevLight.indirectDiffuse, reflectedLight.indirectDiffuse, blendRatio );
					reflectedLight.indirectSpecular = mix( prevLight.indirectSpecular, reflectedLight.indirectSpecular, blendRatio );

				}
			#endif

		}
		#pragma unroll_loop_end
	#elif defined (USE_SHADOWMAP)

		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {

			directionalLight = directionalLights[ i ];
			getDirectionalLightInfo( directionalLight, directLight );

			#if ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )

				directionalLightShadow = directionalLightShadows[ i ];
				if(linearDepth >= CSM_cascades[UNROLLED_LOOP_INDEX].x && linearDepth < CSM_cascades[UNROLLED_LOOP_INDEX].y) directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;

				if(linearDepth >= CSM_cascades[UNROLLED_LOOP_INDEX].x && (linearDepth < CSM_cascades[UNROLLED_LOOP_INDEX].y || UNROLLED_LOOP_INDEX == CSM_CASCADES - 1)) RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );

			#endif

		}
		#pragma unroll_loop_end

	#elif ( NUM_DIR_LIGHT_SHADOWS > 0 )
		// note: no loop here - all CSM lights are in fact one light only
		getDirectionalLightInfo( directionalLights[0], directLight );
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );

	#endif

	#if ( NUM_DIR_LIGHTS > NUM_DIR_LIGHT_SHADOWS)
		// compute the lights not casting shadows (if any)

		#pragma unroll_loop_start
		for ( int i = NUM_DIR_LIGHT_SHADOWS; i < NUM_DIR_LIGHTS; i ++ ) {

			directionalLight = directionalLights[ i ];

			getDirectionalLightInfo( directionalLight, directLight );

			RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );

		}
		#pragma unroll_loop_end

	#endif

#endif


#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct ) && !defined( USE_CSM ) && !defined( CSM_CASCADES )

	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif

	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {

		directionalLight = directionalLights[ i ];

		getDirectionalLightInfo( directionalLight, directLight );

		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif

		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );

	}
	#pragma unroll_loop_end

#endif

#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )

	RectAreaLight rectAreaLight;

	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {

		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );

	}
	#pragma unroll_loop_end

#endif

#if defined( RE_IndirectDiffuse )

	vec3 iblIrradiance = vec3( 0.0 );

	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );

	#if defined( USE_LIGHT_PROBES )

		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );

	#endif

	#if ( NUM_HEMI_LIGHTS > 0 )

		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {

			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );

		}
		#pragma unroll_loop_end

	#endif

#endif

#if defined( RE_IndirectSpecular )

	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );

#endif
`,lights_pars_begin:`
#if defined( USE_CSM ) && defined( CSM_CASCADES )
uniform vec2 CSM_cascades[CSM_CASCADES];
uniform float cameraNear;
uniform float shadowFar;
#endif
	`+ze.lights_pars_begin},Vt=new De,Ht=new Rt({webGL:!0}),Ut=new Y,Wt=new Y,Gt=new Tt,Kt=[],qt=[],Jt=new De,Yt=new De,Xt=new Y(0,1,0),Zt=class{constructor(e){this.camera=e.camera,this.parent=e.parent,this.cascades=e.cascades||3,this.maxFar=e.maxFar||1e5,this.mode=e.mode||`practical`,this.shadowMapSize=e.shadowMapSize||2048,this.shadowBias=e.shadowBias||1e-6,this.lightDirection=e.lightDirection||new Y(1,-1,1).normalize(),this.lightIntensity=e.lightIntensity||3,this.lightNear=e.lightNear||1,this.lightFar=e.lightFar||2e3,this.lightMargin=e.lightMargin||200,this.customSplitsCallback=e.customSplitsCallback,this.fade=!1,this.mainFrustum=new Rt({webGL:!0}),this.frustums=[],this.breaks=[],this.lights=[],this.shaders=new Map,this._createLights(),this.updateFrustums(),this._injectInclude()}_createLights(){for(let e=0;e<this.cascades;e++){let e=new kt(16777215,this.lightIntensity);e.castShadow=!0,e.shadow.mapSize.width=this.shadowMapSize,e.shadow.mapSize.height=this.shadowMapSize,e.shadow.camera.near=this.lightNear,e.shadow.camera.far=this.lightFar,e.shadow.bias=this.shadowBias,this.parent.add(e),this.parent.add(e.target),this.lights.push(e)}}_initCascades(){let e=this.camera;e.updateProjectionMatrix(),this.mainFrustum.setFromProjectionMatrix(e.projectionMatrix,this.maxFar),this.mainFrustum.split(this.breaks,this.frustums)}_updateShadowBounds(){let e=this.frustums;for(let t=0;t<e.length;t++){let e=this.lights[t].shadow.camera,n=this.frustums[t],r=n.vertices.near,i=n.vertices.far,a=i[0],o;o=a.distanceTo(i[2])>a.distanceTo(r[2])?i[2]:r[2];let s=a.distanceTo(o);if(this.fade){let e=this.camera,t=Math.max(e.far,this.maxFar),r=.25*(n.vertices.far[0].z/(t-e.near))**2*(t-e.near);s+=r}e.left=-s/2,e.right=s/2,e.top=s/2,e.bottom=-s/2,e.updateProjectionMatrix()}}_getBreaks(){let e=this.camera,t=Math.min(e.far,this.maxFar);switch(this.breaks.length=0,this.mode){case`uniform`:n(this.cascades,e.near,t,this.breaks);break;case`logarithmic`:r(this.cascades,e.near,t,this.breaks);break;case`practical`:i(this.cascades,e.near,t,.5,this.breaks);break;case`custom`:this.customSplitsCallback===void 0&&console.error(`CSM: Custom split scheme callback not defined.`),this.customSplitsCallback(this.cascades,e.near,t,this.breaks)}function n(e,t,n,r){for(let i=1;i<e;i++)r.push((t+(n-t)*i/e)/n);r.push(1)}function r(e,t,n,r){for(let i=1;i<e;i++)r.push(t*(n/t)**(i/e)/n);r.push(1)}function i(e,t,i,a,o){Kt.length=0,qt.length=0,r(e,t,i,qt),n(e,t,i,Kt);for(let t=1;t<e;t++)o.push(Ot.lerp(Kt[t-1],qt[t-1],a));o.push(1)}}update(){let e=this.camera,t=this.frustums;Jt.lookAt(Wt,this.lightDirection,Xt),Yt.copy(Jt).invert();for(let n=0;n<t.length;n++){let r=this.lights[n],i=r.shadow.camera,a=(i.right-i.left)/this.shadowMapSize,o=(i.top-i.bottom)/this.shadowMapSize;Vt.multiplyMatrices(Yt,e.matrixWorld),t[n].toSpace(Vt,Ht);let s=Ht.vertices.near,c=Ht.vertices.far;Gt.makeEmpty();for(let e=0;e<4;e++)Gt.expandByPoint(s[e]),Gt.expandByPoint(c[e]);Gt.getCenter(Ut),Ut.z=Gt.max.z+this.lightMargin,Ut.x=Math.floor(Ut.x/a)*a,Ut.y=Math.floor(Ut.y/o)*o,Ut.applyMatrix4(Jt),r.position.copy(Ut),r.target.position.copy(Ut),r.target.position.x+=this.lightDirection.x,r.target.position.y+=this.lightDirection.y,r.target.position.z+=this.lightDirection.z}}_injectInclude(){ze.lights_fragment_begin=Bt.lights_fragment_begin,ze.lights_pars_begin=Bt.lights_pars_begin}setupMaterial(e){e.defines=e.defines||{},e.defines.USE_CSM=1,e.defines.CSM_CASCADES=this.cascades,this.fade&&(e.defines.CSM_FADE=``);let t=[],n=this,r=this.shaders;e.onBeforeCompile=function(i){let a=Math.min(n.camera.far,n.maxFar);n._getExtendedBreaks(t),i.uniforms.CSM_cascades={value:t},i.uniforms.cameraNear={value:n.camera.near},i.uniforms.shadowFar={value:a},r.set(e,i)},r.set(e,null)}_updateUniforms(){let e=Math.min(this.camera.far,this.maxFar);this.shaders.forEach(function(t,n){if(t!==null){let n=t.uniforms;this._getExtendedBreaks(n.CSM_cascades.value),n.cameraNear.value=this.camera.near,n.shadowFar.value=e}!this.fade&&`CSM_FADE`in n.defines?(delete n.defines.CSM_FADE,n.needsUpdate=!0):this.fade&&!(`CSM_FADE`in n.defines)&&(n.defines.CSM_FADE=``,n.needsUpdate=!0)},this)}_getExtendedBreaks(e){for(;e.length<this.breaks.length;)e.push(new Ee);e.length=this.breaks.length;for(let t=0;t<this.cascades;t++){let n=this.breaks[t],r=this.breaks[t-1]||0;e[t].x=r,e[t].y=n}}updateFrustums(){this._getBreaks(),this._initCascades(),this._updateShadowBounds(),this._updateUniforms()}remove(){for(let e=0;e<this.lights.length;e++)this.parent.remove(this.lights[e].target),this.parent.remove(this.lights[e])}dispose(){let e=this.shaders;e.forEach(function(e,t){delete t.onBeforeCompile,delete t.defines.USE_CSM,delete t.defines.CSM_CASCADES,delete t.defines.CSM_FADE,e!==null&&(delete e.uniforms.CSM_cascades,delete e.uniforms.cameraNear,delete e.uniforms.shadowFar),t.needsUpdate=!0}),e.clear()}};function Qt(e){let t=new Map,n=new Map,r=e.clone();return $t(e,r,function(e,r){t.set(r,e),n.set(e,r)}),r.traverse(function(e){if(!e.isSkinnedMesh)return;let r=e,i=t.get(e),a=i.skeleton.bones;r.skeleton=i.skeleton.clone(),r.bindMatrix.copy(i.bindMatrix),r.skeleton.bones=a.map(function(e){return n.get(e)}),r.bind(r.skeleton,r.bindMatrix)}),r}function $t(e,t,n){n(e,t);for(let r=0;r<e.children.length;r++)$t(e.children[r],t.children[r],n)}var en=class extends Re{constructor(e){super(e),this.dracoLoader=null,this.ktx2Loader=null,this.meshoptDecoder=null,this.pluginCallbacks=[],this.register(function(e){return new sn(e)}),this.register(function(e){return new cn(e)}),this.register(function(e){return new _n(e)}),this.register(function(e){return new vn(e)}),this.register(function(e){return new yn(e)}),this.register(function(e){return new un(e)}),this.register(function(e){return new dn(e)}),this.register(function(e){return new fn(e)}),this.register(function(e){return new pn(e)}),this.register(function(e){return new on(e)}),this.register(function(e){return new mn(e)}),this.register(function(e){return new ln(e)}),this.register(function(e){return new gn(e)}),this.register(function(e){return new hn(e)}),this.register(function(e){return new rn(e)}),this.register(function(e){return new bn(e,Z.EXT_MESHOPT_COMPRESSION)}),this.register(function(e){return new bn(e,Z.KHR_MESHOPT_COMPRESSION)}),this.register(function(e){return new xn(e)})}load(e,t,n,r){let i=this,a;if(this.resourcePath!==``)a=this.resourcePath;else if(this.path!==``){let t=Se.extractUrlBase(e);a=Se.resolveURL(t,this.path)}else a=Se.extractUrlBase(e);this.manager.itemStart(e);let o=function(t){r?r(t):console.error(t),i.manager.itemError(e),i.manager.itemEnd(e)},s=new O(this.manager);s.setPath(this.path),s.setResponseType(`arraybuffer`),s.setRequestHeader(this.requestHeader),s.setWithCredentials(this.withCredentials),s.load(e,function(n){try{i.parse(n,a,function(n){t(n),i.manager.itemEnd(e)},o)}catch(e){o(e)}},n,o)}setDRACOLoader(e){return this.dracoLoader=e,this}setKTX2Loader(e){return this.ktx2Loader=e,this}setMeshoptDecoder(e){return this.meshoptDecoder=e,this}register(e){return this.pluginCallbacks.indexOf(e)===-1&&this.pluginCallbacks.push(e),this}unregister(e){return this.pluginCallbacks.indexOf(e)!==-1&&this.pluginCallbacks.splice(this.pluginCallbacks.indexOf(e),1),this}parse(e,t,n,r){let i,a={},o={},s=new TextDecoder;if(typeof e==`string`)i=JSON.parse(e);else if(e instanceof ArrayBuffer){if(s.decode(new Uint8Array(e,0,4))===Sn){try{a[Z.KHR_BINARY_GLTF]=new Tn(e)}catch(e){r&&r(e);return}i=JSON.parse(a[Z.KHR_BINARY_GLTF].content)}else i=JSON.parse(s.decode(e))}else i=e;if(i.asset===void 0||i.asset.version[0]<2){r&&r(Error(`THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported.`));return}let c=new Zn(i,{path:t||this.resourcePath||``,crossOrigin:this.crossOrigin,requestHeader:this.requestHeader,manager:this.manager,ktx2Loader:this.ktx2Loader,meshoptDecoder:this.meshoptDecoder});c.fileLoader.setRequestHeader(this.requestHeader);for(let e=0;e<this.pluginCallbacks.length;e++){let t=this.pluginCallbacks[e](c);t.name||console.error(`THREE.GLTFLoader: Invalid plugin found: missing name`),o[t.name]=t,a[t.name]=!0}if(i.extensionsUsed)for(let e=0;e<i.extensionsUsed.length;++e){let t=i.extensionsUsed[e],n=i.extensionsRequired||[];switch(t){case Z.KHR_MATERIALS_UNLIT:a[t]=new an;break;case Z.KHR_DRACO_MESH_COMPRESSION:a[t]=new En(i,this.dracoLoader);break;case Z.KHR_TEXTURE_TRANSFORM:a[t]=new Dn;break;case Z.KHR_MESH_QUANTIZATION:a[t]=new On;break;default:n.indexOf(t)>=0&&o[t]===void 0&&console.warn(`THREE.GLTFLoader: Unknown extension "`+t+`".`)}}c.setExtensions(a),c.setPlugins(o),c.parse(n,r)}parseAsync(e,t){let n=this;return new Promise(function(r,i){n.parse(e,t,r,i)})}};function tn(){let e={};return{get:function(t){return e[t]},add:function(t,n){e[t]=n},remove:function(t){delete e[t]},removeAll:function(){e={}}}}function nn(e,t,n){let r=e.json.materials[t];return r.extensions&&r.extensions[n]?r.extensions[n]:null}var Z={KHR_BINARY_GLTF:`KHR_binary_glTF`,KHR_DRACO_MESH_COMPRESSION:`KHR_draco_mesh_compression`,KHR_LIGHTS_PUNCTUAL:`KHR_lights_punctual`,KHR_MATERIALS_CLEARCOAT:`KHR_materials_clearcoat`,KHR_MATERIALS_DISPERSION:`KHR_materials_dispersion`,KHR_MATERIALS_IOR:`KHR_materials_ior`,KHR_MATERIALS_SHEEN:`KHR_materials_sheen`,KHR_MATERIALS_SPECULAR:`KHR_materials_specular`,KHR_MATERIALS_TRANSMISSION:`KHR_materials_transmission`,KHR_MATERIALS_IRIDESCENCE:`KHR_materials_iridescence`,KHR_MATERIALS_ANISOTROPY:`KHR_materials_anisotropy`,KHR_MATERIALS_UNLIT:`KHR_materials_unlit`,KHR_MATERIALS_VOLUME:`KHR_materials_volume`,KHR_TEXTURE_BASISU:`KHR_texture_basisu`,KHR_TEXTURE_TRANSFORM:`KHR_texture_transform`,KHR_MESH_QUANTIZATION:`KHR_mesh_quantization`,KHR_MATERIALS_EMISSIVE_STRENGTH:`KHR_materials_emissive_strength`,EXT_MATERIALS_BUMP:`EXT_materials_bump`,EXT_TEXTURE_WEBP:`EXT_texture_webp`,EXT_TEXTURE_AVIF:`EXT_texture_avif`,EXT_MESHOPT_COMPRESSION:`EXT_meshopt_compression`,KHR_MESHOPT_COMPRESSION:`KHR_meshopt_compression`,EXT_MESH_GPU_INSTANCING:`EXT_mesh_gpu_instancing`},rn=class{constructor(e){this.parser=e,this.name=Z.KHR_LIGHTS_PUNCTUAL,this.cache={refs:{},uses:{}}}_markDefs(){let e=this.parser,t=this.parser.json.nodes||[];for(let n=0,r=t.length;n<r;n++){let r=t[n];r.extensions&&r.extensions[this.name]&&r.extensions[this.name].light!==void 0&&e._addNodeRef(this.cache,r.extensions[this.name].light)}}_loadLight(e){let t=this.parser,n=`light:`+e,r=t.cache.get(n);if(r)return r;let i=t.json,a=((i.extensions&&i.extensions[this.name]||{}).lights||[])[e],o,s=new m(16777215);a.color!==void 0&&s.setRGB(a.color[0],a.color[1],a.color[2],Ve);let c=a.range===void 0?0:a.range;switch(a.type){case`directional`:o=new kt(s),o.target.position.set(0,0,-1),o.add(o.target);break;case`point`:o=new g(s),o.distance=c;break;case`spot`:o=new K(s),o.distance=c,a.spot=a.spot||{},a.spot.innerConeAngle=a.spot.innerConeAngle===void 0?0:a.spot.innerConeAngle,a.spot.outerConeAngle=a.spot.outerConeAngle===void 0?Math.PI/4:a.spot.outerConeAngle,o.angle=a.spot.outerConeAngle,o.penumbra=1-a.spot.innerConeAngle/a.spot.outerConeAngle,o.target.position.set(0,0,-1),o.add(o.target);break;default:throw Error(`THREE.GLTFLoader: Unexpected light type: `+a.type)}return o.position.set(0,0,0),Un(o,a),a.intensity!==void 0&&(o.intensity=a.intensity),o.name=t.createUniqueName(a.name||`light_`+e),r=Promise.resolve(o),t.cache.add(n,r),r}getDependency(e,t){if(e===`light`)return this._loadLight(t)}createNodeAttachment(e){let t=this,n=this.parser,r=n.json.nodes[e],i=(r.extensions&&r.extensions[this.name]||{}).light;return i===void 0?null:this._loadLight(i).then(function(e){return n._getNodeRef(t.cache,i,e)})}},an=class{constructor(){this.name=Z.KHR_MATERIALS_UNLIT}getMaterialType(){return B}extendParams(e,t,n){let r=[];e.color=new m(1,1,1),e.opacity=1;let i=t.pbrMetallicRoughness;if(i){if(Array.isArray(i.baseColorFactor)){let t=i.baseColorFactor;e.color.setRGB(t[0],t[1],t[2],Ve),e.opacity=t[3]}i.baseColorTexture!==void 0&&r.push(n.assignTexture(e,`map`,i.baseColorTexture,z))}return Promise.all(r)}},on=class{constructor(e){this.parser=e,this.name=Z.KHR_MATERIALS_EMISSIVE_STRENGTH}extendMaterialParams(e,t){let n=nn(this.parser,e,this.name);return n===null||n.emissiveStrength!==void 0&&(t.emissiveIntensity=n.emissiveStrength),Promise.resolve()}},sn=class{constructor(e){this.parser=e,this.name=Z.KHR_MATERIALS_CLEARCOAT}getMaterialType(e){return nn(this.parser,e,this.name)===null?null:C}extendMaterialParams(e,t){let n=nn(this.parser,e,this.name);if(n===null)return Promise.resolve();let r=[];if(n.clearcoatFactor!==void 0&&(t.clearcoat=n.clearcoatFactor),n.clearcoatTexture!==void 0&&r.push(this.parser.assignTexture(t,`clearcoatMap`,n.clearcoatTexture)),n.clearcoatRoughnessFactor!==void 0&&(t.clearcoatRoughness=n.clearcoatRoughnessFactor),n.clearcoatRoughnessTexture!==void 0&&r.push(this.parser.assignTexture(t,`clearcoatRoughnessMap`,n.clearcoatRoughnessTexture)),n.clearcoatNormalTexture!==void 0&&(r.push(this.parser.assignTexture(t,`clearcoatNormalMap`,n.clearcoatNormalTexture)),n.clearcoatNormalTexture.scale!==void 0)){let e=n.clearcoatNormalTexture.scale;t.clearcoatNormalScale=new Ee(e,e)}return Promise.all(r)}},cn=class{constructor(e){this.parser=e,this.name=Z.KHR_MATERIALS_DISPERSION}getMaterialType(e){return nn(this.parser,e,this.name)===null?null:C}extendMaterialParams(e,t){let n=nn(this.parser,e,this.name);return n===null||(t.dispersion=n.dispersion===void 0?0:n.dispersion),Promise.resolve()}},ln=class{constructor(e){this.parser=e,this.name=Z.KHR_MATERIALS_IRIDESCENCE}getMaterialType(e){return nn(this.parser,e,this.name)===null?null:C}extendMaterialParams(e,t){let n=nn(this.parser,e,this.name);if(n===null)return Promise.resolve();let r=[];return n.iridescenceFactor!==void 0&&(t.iridescence=n.iridescenceFactor),n.iridescenceTexture!==void 0&&r.push(this.parser.assignTexture(t,`iridescenceMap`,n.iridescenceTexture)),n.iridescenceIor!==void 0&&(t.iridescenceIOR=n.iridescenceIor),t.iridescenceThicknessRange===void 0&&(t.iridescenceThicknessRange=[100,400]),n.iridescenceThicknessMinimum!==void 0&&(t.iridescenceThicknessRange[0]=n.iridescenceThicknessMinimum),n.iridescenceThicknessMaximum!==void 0&&(t.iridescenceThicknessRange[1]=n.iridescenceThicknessMaximum),n.iridescenceThicknessTexture!==void 0&&r.push(this.parser.assignTexture(t,`iridescenceThicknessMap`,n.iridescenceThicknessTexture)),Promise.all(r)}},un=class{constructor(e){this.parser=e,this.name=Z.KHR_MATERIALS_SHEEN}getMaterialType(e){return nn(this.parser,e,this.name)===null?null:C}extendMaterialParams(e,t){let n=nn(this.parser,e,this.name);if(n===null)return Promise.resolve();let r=[];if(t.sheenColor=new m(0,0,0),t.sheenRoughness=0,t.sheen=1,n.sheenColorFactor!==void 0){let e=n.sheenColorFactor;t.sheenColor.setRGB(e[0],e[1],e[2],Ve)}return n.sheenRoughnessFactor!==void 0&&(t.sheenRoughness=n.sheenRoughnessFactor),n.sheenColorTexture!==void 0&&r.push(this.parser.assignTexture(t,`sheenColorMap`,n.sheenColorTexture,z)),n.sheenRoughnessTexture!==void 0&&r.push(this.parser.assignTexture(t,`sheenRoughnessMap`,n.sheenRoughnessTexture)),Promise.all(r)}},dn=class{constructor(e){this.parser=e,this.name=Z.KHR_MATERIALS_TRANSMISSION}getMaterialType(e){return nn(this.parser,e,this.name)===null?null:C}extendMaterialParams(e,t){let n=nn(this.parser,e,this.name);if(n===null)return Promise.resolve();let r=[];return n.transmissionFactor!==void 0&&(t.transmission=n.transmissionFactor),n.transmissionTexture!==void 0&&r.push(this.parser.assignTexture(t,`transmissionMap`,n.transmissionTexture)),Promise.all(r)}},fn=class{constructor(e){this.parser=e,this.name=Z.KHR_MATERIALS_VOLUME}getMaterialType(e){return nn(this.parser,e,this.name)===null?null:C}extendMaterialParams(e,t){let n=nn(this.parser,e,this.name);if(n===null)return Promise.resolve();let r=[];t.thickness=n.thicknessFactor===void 0?0:n.thicknessFactor,n.thicknessTexture!==void 0&&r.push(this.parser.assignTexture(t,`thicknessMap`,n.thicknessTexture)),t.attenuationDistance=n.attenuationDistance||1/0;let i=n.attenuationColor||[1,1,1];return t.attenuationColor=new m().setRGB(i[0],i[1],i[2],Ve),Promise.all(r)}},pn=class{constructor(e){this.parser=e,this.name=Z.KHR_MATERIALS_IOR}getMaterialType(e){return nn(this.parser,e,this.name)===null?null:C}extendMaterialParams(e,t){let n=nn(this.parser,e,this.name);return n===null||(t.ior=n.ior===void 0?1.5:n.ior,t.ior===0&&(t.ior=1e3)),Promise.resolve()}},mn=class{constructor(e){this.parser=e,this.name=Z.KHR_MATERIALS_SPECULAR}getMaterialType(e){return nn(this.parser,e,this.name)===null?null:C}extendMaterialParams(e,t){let n=nn(this.parser,e,this.name);if(n===null)return Promise.resolve();let r=[];t.specularIntensity=n.specularFactor===void 0?1:n.specularFactor,n.specularTexture!==void 0&&r.push(this.parser.assignTexture(t,`specularIntensityMap`,n.specularTexture));let i=n.specularColorFactor||[1,1,1];return t.specularColor=new m().setRGB(i[0],i[1],i[2],Ve),n.specularColorTexture!==void 0&&r.push(this.parser.assignTexture(t,`specularColorMap`,n.specularColorTexture,z)),Promise.all(r)}},hn=class{constructor(e){this.parser=e,this.name=Z.EXT_MATERIALS_BUMP}getMaterialType(e){return nn(this.parser,e,this.name)===null?null:C}extendMaterialParams(e,t){let n=nn(this.parser,e,this.name);if(n===null)return Promise.resolve();let r=[];return t.bumpScale=n.bumpFactor===void 0?1:n.bumpFactor,n.bumpTexture!==void 0&&r.push(this.parser.assignTexture(t,`bumpMap`,n.bumpTexture)),Promise.all(r)}},gn=class{constructor(e){this.parser=e,this.name=Z.KHR_MATERIALS_ANISOTROPY}getMaterialType(e){return nn(this.parser,e,this.name)===null?null:C}extendMaterialParams(e,t){let n=nn(this.parser,e,this.name);if(n===null)return Promise.resolve();let r=[];return n.anisotropyStrength!==void 0&&(t.anisotropy=n.anisotropyStrength),n.anisotropyRotation!==void 0&&(t.anisotropyRotation=n.anisotropyRotation),n.anisotropyTexture!==void 0&&r.push(this.parser.assignTexture(t,`anisotropyMap`,n.anisotropyTexture)),Promise.all(r)}},_n=class{constructor(e){this.parser=e,this.name=Z.KHR_TEXTURE_BASISU}loadTexture(e){let t=this.parser,n=t.json,r=n.textures[e];if(!r.extensions||!r.extensions[this.name])return null;let i=r.extensions[this.name],a=t.options.ktx2Loader;if(!a){if(n.extensionsRequired&&n.extensionsRequired.indexOf(this.name)>=0)throw Error(`THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures`);return null}return t.loadTextureImage(e,i.source,a)}},vn=class{constructor(e){this.parser=e,this.name=Z.EXT_TEXTURE_WEBP}loadTexture(e){let t=this.name,n=this.parser,r=n.json,i=r.textures[e];if(!i.extensions||!i.extensions[t])return null;let a=i.extensions[t],o=r.images[a.source],s=n.textureLoader;if(o.uri){let e=n.options.manager.getHandler(o.uri);e!==null&&(s=e)}return n.loadTextureImage(e,a.source,s)}},yn=class{constructor(e){this.parser=e,this.name=Z.EXT_TEXTURE_AVIF}loadTexture(e){let t=this.name,n=this.parser,r=n.json,i=r.textures[e];if(!i.extensions||!i.extensions[t])return null;let a=i.extensions[t],o=r.images[a.source],s=n.textureLoader;if(o.uri){let e=n.options.manager.getHandler(o.uri);e!==null&&(s=e)}return n.loadTextureImage(e,a.source,s)}},bn=class{constructor(e,t){this.name=t,this.parser=e}loadBufferView(e){let t=this.parser.json,n=t.bufferViews[e];if(n.extensions&&n.extensions[this.name]){let e=n.extensions[this.name],r=this.parser.getDependency(`buffer`,e.buffer),i=this.parser.options.meshoptDecoder;if(!i||!i.supported){if(t.extensionsRequired&&t.extensionsRequired.indexOf(this.name)>=0)throw Error(`THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files`);return null}return r.then(function(t){let n=e.byteOffset||0,r=e.byteLength||0,a=e.count,o=e.byteStride,s=new Uint8Array(t,n,r);return i.decodeGltfBufferAsync?i.decodeGltfBufferAsync(a,o,s,e.mode,e.filter).then(function(e){return e.buffer}):i.ready.then(function(){let t=new ArrayBuffer(a*o);return i.decodeGltfBuffer(new Uint8Array(t),a,o,s,e.mode,e.filter),t})})}return null}},xn=class{constructor(e){this.name=Z.EXT_MESH_GPU_INSTANCING,this.parser=e}createNodeMesh(e){let t=this.parser.json,n=t.nodes[e];if(!n.extensions||!n.extensions[this.name]||n.mesh===void 0)return null;let r=t.meshes[n.mesh];for(let e of r.primitives)if(e.mode!==Mn.TRIANGLES&&e.mode!==Mn.TRIANGLE_STRIP&&e.mode!==Mn.TRIANGLE_FAN&&e.mode!==void 0)return null;let i=n.extensions[this.name].attributes,a=[],o={};for(let e in i)a.push(this.parser.getDependency(`accessor`,i[e]).then(t=>(o[e]=t,o[e])));return a.length<1?null:(a.push(this.parser.createNodeMesh(e)),Promise.all(a).then(e=>{let t=e.pop(),n=t.isGroup?t.children:[t],r=e[0].count,i=[];for(let e of n){let t=new De,n=new Y,a=new H,s=new Y(1,1,1),c=new q(e.geometry,e.material,r);for(let e=0;e<r;e++)o.TRANSLATION&&n.fromBufferAttribute(o.TRANSLATION,e),o.ROTATION&&a.fromBufferAttribute(o.ROTATION,e),o.SCALE&&s.fromBufferAttribute(o.SCALE,e),c.setMatrixAt(e,t.compose(n,a,s));let l=null;for(let e in o)if(e===`_COLOR_0`){let t=o[e];c.instanceColor=new ye(t.array,t.itemSize,t.normalized)}else if(e!==`TRANSLATION`&&e!==`ROTATION`&&e!==`SCALE`){if(l===null){let e=c.geometry;l=new Ct,l.name=e.name;for(let t in e.attributes)l.setAttribute(t,e.attributes[t]);for(let t in e.morphAttributes)l.morphAttributes[t]=e.morphAttributes[t];e.index!==null&&l.setIndex(e.index),l.morphTargetsRelative=e.morphTargetsRelative;for(let t of e.groups)l.addGroup(t.start,t.count,t.materialIndex);e.boundingBox!==null&&(l.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(l.boundingSphere=e.boundingSphere.clone()),l.drawRange.start=e.drawRange.start,l.drawRange.count=e.drawRange.count,l.userData=Object.assign({},e.userData),c.geometry=l}let t=o[e];l.setAttribute(e,new ye(t.array,t.itemSize,t.normalized))}ie.prototype.copy.call(c,e),this.parser.assignFinalMaterial(c),i.push(c)}return t.isGroup?(t.clear(),t.add(...i),t):i[0]}))}},Sn=`glTF`,Cn=12,wn={JSON:1313821514,BIN:5130562},Tn=class{constructor(e){this.name=Z.KHR_BINARY_GLTF,this.content=null,this.body=null;let t=new DataView(e,0,Cn),n=new TextDecoder;if(this.header={magic:n.decode(new Uint8Array(e.slice(0,4))),version:t.getUint32(4,!0),length:t.getUint32(8,!0)},this.header.magic!==Sn)throw Error(`THREE.GLTFLoader: Unsupported glTF-Binary header.`);if(this.header.version<2)throw Error(`THREE.GLTFLoader: Legacy binary file detected.`);let r=this.header.length-Cn,i=new DataView(e,Cn),a=0;for(;a<r;){let t=i.getUint32(a,!0);a+=4;let r=i.getUint32(a,!0);if(a+=4,r===wn.JSON){let r=new Uint8Array(e,Cn+a,t);this.content=n.decode(r)}else if(r===wn.BIN){let n=Cn+a;this.body=e.slice(n,n+t)}a+=t}if(this.content===null)throw Error(`THREE.GLTFLoader: JSON content not found.`)}},En=class{constructor(e,t){if(!t)throw Error(`THREE.GLTFLoader: No DRACOLoader instance provided.`);this.name=Z.KHR_DRACO_MESH_COMPRESSION,this.json=e,this.dracoLoader=t,this.dracoLoader.preload()}decodePrimitive(e,t){let n=this.json,r=this.dracoLoader,i=e.extensions[this.name].bufferView,a=e.extensions[this.name].attributes,o={},s={},c={};for(let e in a){let t=Ln[e]||e.toLowerCase();o[t]=a[e]}for(let t in e.attributes){let r=Ln[t]||t.toLowerCase();if(a[t]!==void 0){let i=n.accessors[e.attributes[t]];c[r]=Nn[i.componentType].name,s[r]=i.normalized===!0}}return t.getDependency(`bufferView`,i).then(function(e){return new Promise(function(t,n){r.decodeDracoFile(e,function(e){for(let t in e.attributes){let n=e.attributes[t],r=s[t];r!==void 0&&(n.normalized=r)}t(e)},o,c,Ve,n)})})}},Dn=class{constructor(){this.name=Z.KHR_TEXTURE_TRANSFORM}extendTexture(e,t){if((t.texCoord===void 0||t.texCoord===e.channel)&&t.offset===void 0&&t.rotation===void 0&&t.scale===void 0)return e;if(e=e.clone(),t.texCoord!==void 0&&(e.channel=t.texCoord),t.offset!==void 0&&e.offset.fromArray(t.offset),t.rotation!==void 0&&(e.rotation=t.rotation),t.scale!==void 0&&e.repeat.fromArray(t.scale),t.rotation!==void 0){let t=Math.cos(e.rotation),n=Math.sin(e.rotation);e.matrix.set(e.repeat.x*t,e.repeat.y*n,e.offset.x,-e.repeat.x*n,e.repeat.y*t,e.offset.y,0,0,1),e.matrixAutoUpdate=!1}return e.needsUpdate=!0,e}},On=class{constructor(){this.name=Z.KHR_MESH_QUANTIZATION}},kn=class extends dt{constructor(e,t,n,r){super(e,t,n,r)}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,r=this.valueSize,i=e*r*3+r;for(let e=0;e!==r;e++)t[e]=n[i+e];return t}interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=o*2,c=o*3,l=r-t,u=(n-t)/l,d=u*u,f=d*u,p=e*c,m=p-c,h=-2*f+3*d,g=f-d,_=1-h,v=g-d+u;for(let e=0;e!==o;e++){let t=a[m+e+o],n=a[m+e+s]*l,r=a[p+e+o],c=a[p+e]*l;i[e]=_*t+v*n+h*r+g*c}return i}},An=new H,jn=class extends kn{interpolate_(e,t,n,r){let i=super.interpolate_(e,t,n,r);return An.fromArray(i).normalize().toArray(i),i}},Mn={FLOAT:5126,FLOAT_MAT3:35675,FLOAT_MAT4:35676,FLOAT_VEC2:35664,FLOAT_VEC3:35665,FLOAT_VEC4:35666,LINEAR:9729,REPEAT:10497,SAMPLER_2D:35678,POINTS:0,LINES:1,LINE_LOOP:2,LINE_STRIP:3,TRIANGLES:4,TRIANGLE_STRIP:5,TRIANGLE_FAN:6,UNSIGNED_BYTE:5121,UNSIGNED_SHORT:5123},Nn={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},Pn={9728:Je,9729:Fe,9984:Ke,9985:$e,9986:h,9987:ot},Fn={33071:qe,33648:L,10497:_e},In={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16},Ln={POSITION:`position`,NORMAL:`normal`,TANGENT:`tangent`,TEXCOORD_0:`uv`,TEXCOORD_1:`uv1`,TEXCOORD_2:`uv2`,TEXCOORD_3:`uv3`,COLOR_0:`color`,WEIGHTS_0:`skinWeight`,JOINTS_0:`skinIndex`},Rn={scale:`scale`,translation:`position`,rotation:`quaternion`,weights:`morphTargetInfluences`},zn={CUBICSPLINE:void 0,LINEAR:Te,STEP:We},Bn={OPAQUE:`OPAQUE`,MASK:`MASK`,BLEND:`BLEND`};function Vn(e){return e.DefaultMaterial===void 0&&(e.DefaultMaterial=new x({color:16777215,emissive:0,metalness:1,roughness:1,transparent:!1,depthTest:!0,side:0})),e.DefaultMaterial}function Hn(e,t,n){for(let r in n.extensions)e[r]===void 0&&(t.userData.gltfExtensions=t.userData.gltfExtensions||{},t.userData.gltfExtensions[r]=n.extensions[r])}function Un(e,t){t.extras!==void 0&&(typeof t.extras==`object`?Object.assign(e.userData,t.extras):console.warn(`THREE.GLTFLoader: Ignoring primitive type .extras, `+t.extras))}function Wn(e,t,n){let r=!1,i=!1,a=!1;for(let e=0,n=t.length;e<n;e++){let n=t[e];if(n.POSITION!==void 0&&(r=!0),n.NORMAL!==void 0&&(i=!0),n.COLOR_0!==void 0&&(a=!0),r&&i&&a)break}if(!r&&!i&&!a)return Promise.resolve(e);let o=[],s=[],c=[];for(let l=0,u=t.length;l<u;l++){let u=t[l];if(r){let t=u.POSITION===void 0?e.attributes.position:n.getDependency(`accessor`,u.POSITION);o.push(t)}if(i){let t=u.NORMAL===void 0?e.attributes.normal:n.getDependency(`accessor`,u.NORMAL);s.push(t)}if(a){let t=u.COLOR_0===void 0?e.attributes.color:n.getDependency(`accessor`,u.COLOR_0);c.push(t)}}return Promise.all([Promise.all(o),Promise.all(s),Promise.all(c)]).then(function(t){let n=t[0],o=t[1],s=t[2];return r&&(e.morphAttributes.position=n),i&&(e.morphAttributes.normal=o),a&&(e.morphAttributes.color=s),e.morphTargetsRelative=!0,e})}function Gn(e,t){if(e.updateMorphTargets(),t.weights!==void 0)for(let n=0,r=t.weights.length;n<r;n++)e.morphTargetInfluences[n]=t.weights[n];if(t.extras&&Array.isArray(t.extras.targetNames)){let n=t.extras.targetNames;if(e.morphTargetInfluences.length===n.length){e.morphTargetDictionary={};for(let t=0,r=n.length;t<r;t++)e.morphTargetDictionary[n[t]]=t}else console.warn(`THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.`)}}function Kn(e){let t,n=e.extensions&&e.extensions[Z.KHR_DRACO_MESH_COMPRESSION];if(t=n?`draco:`+n.bufferView+`:`+n.indices+`:`+qn(n.attributes):e.indices+`:`+qn(e.attributes)+`:`+e.mode,e.targets!==void 0)for(let n=0,r=e.targets.length;n<r;n++)t+=`:`+qn(e.targets[n]);return t}function qn(e){let t=``,n=Object.keys(e).sort();for(let r=0,i=n.length;r<i;r++)t+=n[r]+`:`+e[n[r]]+`;`;return t}function Jn(e){switch(e){case Int8Array:return 1/127;case Uint8Array:return 1/255;case Int16Array:return 1/32767;case Uint16Array:return 1/65535;default:throw Error(`THREE.GLTFLoader: Unsupported normalized accessor component type.`)}}function Yn(e){return e.search(/\.jpe?g($|\?)/i)>0||e.search(/^data\:image\/jpeg/)===0?`image/jpeg`:e.search(/\.webp($|\?)/i)>0||e.search(/^data\:image\/webp/)===0?`image/webp`:e.search(/\.ktx2($|\?)/i)>0||e.search(/^data\:image\/ktx2/)===0?`image/ktx2`:`image/png`}var Xn=new De,Zn=class{constructor(e={},t={}){this.json=e,this.extensions={},this.plugins={},this.options=t,this.cache=new tn,this.associations=new Map,this.primitiveCache={},this.nodeCache={},this.meshCache={refs:{},uses:{}},this.cameraCache={refs:{},uses:{}},this.lightCache={refs:{},uses:{}},this.sourceCache={},this.textureCache={},this.nodeNamesUsed={};let n=!1,r=-1,i=!1,a=-1;if(typeof navigator<`u`&&navigator.userAgent!==void 0){let e=navigator.userAgent;n=/^((?!chrome|android).)*safari/i.test(e)===!0;let t=e.match(/Version\/(\d+)/);r=n&&t?parseInt(t[1],10):-1,i=e.indexOf(`Firefox`)>-1,a=i?e.match(/Firefox\/([0-9]+)\./)[1]:-1}this.textureLoader=typeof createImageBitmap>`u`||n&&r<17||i&&a<98?new Pe(this.options.manager):new ge(this.options.manager),this.textureLoader.setCrossOrigin(this.options.crossOrigin),this.textureLoader.setRequestHeader(this.options.requestHeader),this.fileLoader=new O(this.options.manager),this.fileLoader.setResponseType(`arraybuffer`),this.options.crossOrigin===`use-credentials`&&this.fileLoader.setWithCredentials(!0)}setExtensions(e){this.extensions=e}setPlugins(e){this.plugins=e}parse(e,t){let n=this,r=this.json,i=this.extensions;this.cache.removeAll(),this.nodeCache={},this._invokeAll(function(e){return e._markDefs&&e._markDefs()}),Promise.all(this._invokeAll(function(e){return e.beforeRoot&&e.beforeRoot()})).then(function(){return Promise.all([n.getDependencies(`scene`),n.getDependencies(`animation`),n.getDependencies(`camera`)])}).then(function(t){let a={scene:t[0][r.scene||0],scenes:t[0],animations:t[1],cameras:t[2],asset:r.asset,parser:n,userData:{}};return Hn(i,a,r),Un(a,r),Promise.all(n._invokeAll(function(e){return e.afterRoot&&e.afterRoot(a)})).then(function(){for(let e of a.scenes)e.updateMatrixWorld();e(a)})}).catch(t)}_markDefs(){let e=this.json.nodes||[],t=this.json.skins||[],n=this.json.meshes||[];for(let n=0,r=t.length;n<r;n++){let r=t[n].joints;for(let t=0,n=r.length;t<n;t++)e[r[t]].isBone=!0}for(let t=0,r=e.length;t<r;t++){let r=e[t];r.mesh!==void 0&&(this._addNodeRef(this.meshCache,r.mesh),r.skin!==void 0&&(n[r.mesh].isSkinnedMesh=!0)),r.camera!==void 0&&this._addNodeRef(this.cameraCache,r.camera)}}_addNodeRef(e,t){t!==void 0&&(e.refs[t]===void 0&&(e.refs[t]=e.uses[t]=0),e.refs[t]++)}_getNodeRef(e,t,n){if(e.refs[t]<=1)return n;let r=n.clone(),i=(e,t)=>{let n=this.associations.get(e);n!=null&&this.associations.set(t,n);for(let[n,r]of e.children.entries())i(r,t.children[n])};return i(n,r),r.name+=`_instance_`+e.uses[t]++,r}_invokeOne(e){let t=Object.values(this.plugins);t.push(this);for(let n=0;n<t.length;n++){let r=e(t[n]);if(r)return r}return null}_invokeAll(e){let t=Object.values(this.plugins);t.unshift(this);let n=[];for(let r=0;r<t.length;r++){let i=e(t[r]);i&&n.push(i)}return n}getDependency(e,t){let n=e+`:`+t,r=this.cache.get(n);if(!r){switch(e){case`scene`:r=this.loadScene(t);break;case`node`:r=this._invokeOne(function(e){return e.loadNode&&e.loadNode(t)});break;case`mesh`:r=this._invokeOne(function(e){return e.loadMesh&&e.loadMesh(t)});break;case`accessor`:r=this.loadAccessor(t);break;case`bufferView`:r=this._invokeOne(function(e){return e.loadBufferView&&e.loadBufferView(t)});break;case`buffer`:r=this.loadBuffer(t);break;case`material`:r=this._invokeOne(function(e){return e.loadMaterial&&e.loadMaterial(t)});break;case`texture`:r=this._invokeOne(function(e){return e.loadTexture&&e.loadTexture(t)});break;case`skin`:r=this.loadSkin(t);break;case`animation`:r=this._invokeOne(function(e){return e.loadAnimation&&e.loadAnimation(t)});break;case`camera`:r=this.loadCamera(t);break;default:if(r=this._invokeOne(function(n){return n!=this&&n.getDependency&&n.getDependency(e,t)}),!r)throw Error(`Unknown type: `+e)}this.cache.add(n,r)}return r}getDependencies(e){let t=this.cache.get(e);if(!t){let n=this,r=this.json[e+(e===`mesh`?`es`:`s`)]||[];t=Promise.all(r.map(function(t,r){return n.getDependency(e,r)})),this.cache.add(e,t)}return t}loadBuffer(e){let t=this.json.buffers[e],n=this.fileLoader;if(t.type&&t.type!==`arraybuffer`)throw Error(`THREE.GLTFLoader: `+t.type+` buffer type is not supported.`);if(t.uri===void 0&&e===0)return Promise.resolve(this.extensions[Z.KHR_BINARY_GLTF].body);let r=this.options;return new Promise(function(e,i){n.load(Se.resolveURL(t.uri,r.path),e,void 0,function(){i(Error(`THREE.GLTFLoader: Failed to load buffer "`+t.uri+`".`))})})}loadBufferView(e){let t=this.json.bufferViews[e];return this.getDependency(`buffer`,t.buffer).then(function(e){let n=t.byteLength||0,r=t.byteOffset||0;return e.slice(r,r+n)})}loadAccessor(e){let t=this,n=this.json,r=this.json.accessors[e];if(r.bufferView===void 0&&r.sparse===void 0){let e=In[r.type],t=Nn[r.componentType],n=r.normalized===!0,i=new t(r.count*e);return Promise.resolve(new _(i,e,n))}let i=[];return r.bufferView===void 0?i.push(null):i.push(this.getDependency(`bufferView`,r.bufferView)),r.sparse!==void 0&&(i.push(this.getDependency(`bufferView`,r.sparse.indices.bufferView)),i.push(this.getDependency(`bufferView`,r.sparse.values.bufferView))),Promise.all(i).then(function(e){let i=e[0],a=In[r.type],o=Nn[r.componentType],s=o.BYTES_PER_ELEMENT,c=s*a,l=r.byteOffset||0,u=r.bufferView===void 0?void 0:n.bufferViews[r.bufferView].byteStride,d=r.normalized===!0,f,p;if(u&&u!==c){let e=Math.floor(l/u),n=`InterleavedBuffer:`+r.bufferView+`:`+r.componentType+`:`+e+`:`+r.count,c=t.cache.get(n);c||(f=new o(i,e*u,r.count*u/s),c=new _t(f,u/s),t.cache.add(n,c)),p=new tt(c,a,l%u/s,d)}else f=i===null?new o(r.count*a):new o(i,l,r.count*a),p=new _(f,a,d);if(r.sparse!==void 0){let t=In.SCALAR,n=Nn[r.sparse.indices.componentType],s=r.sparse.indices.byteOffset||0,c=r.sparse.values.byteOffset||0,l=new n(e[1],s,r.sparse.count*t),u=new o(e[2],c,r.sparse.count*a);i!==null&&(p=new _(p.array.slice(),p.itemSize,p.normalized)),p.normalized=!1;for(let e=0,t=l.length;e<t;e++){let t=l[e];if(p.setX(t,u[e*a]),a>=2&&p.setY(t,u[e*a+1]),a>=3&&p.setZ(t,u[e*a+2]),a>=4&&p.setW(t,u[e*a+3]),a>=5)throw Error(`THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.`)}p.normalized=d}return p})}loadTexture(e){let t=this.json,n=this.options,r=t.textures[e].source,i=t.images[r],a=this.textureLoader;if(i.uri){let e=n.manager.getHandler(i.uri);e!==null&&(a=e)}return this.loadTextureImage(e,r,a)}loadTextureImage(e,t,n){let r=this,i=this.json,a=i.textures[e],o=i.images[t],s=(o.uri||o.bufferView)+`:`+a.sampler;if(this.textureCache[s])return this.textureCache[s];let c=this.loadImageSource(t,n).then(function(t){t.flipY=!1,t.name=a.name||o.name||``,t.name===``&&typeof o.uri==`string`&&o.uri.startsWith(`data:image/`)===!1&&(t.name=o.uri);let n=(i.samplers||{})[a.sampler]||{};return t.magFilter=Pn[n.magFilter]||1006,t.minFilter=Pn[n.minFilter]||1008,t.wrapS=Fn[n.wrapS]||1e3,t.wrapT=Fn[n.wrapT]||1e3,t.generateMipmaps=!t.isCompressedTexture&&t.minFilter!==1003&&t.minFilter!==1006,r.associations.set(t,{textures:e}),t}).catch(function(){return null});return this.textureCache[s]=c,c}loadImageSource(e,t){let n=this,r=this.json,i=this.options;if(this.sourceCache[e]!==void 0)return this.sourceCache[e].then(e=>e.clone());let a=r.images[e],o=self.URL||self.webkitURL,s=a.uri||``,c=!1;if(a.bufferView!==void 0)s=n.getDependency(`bufferView`,a.bufferView).then(function(e){c=!0;let t=new Blob([e],{type:a.mimeType});return s=o.createObjectURL(t),s});else if(a.uri===void 0)throw Error(`THREE.GLTFLoader: Image `+e+` is missing URI and bufferView`);let l=Promise.resolve(s).then(function(e){return new Promise(function(n,r){let a=n;t.isImageBitmapLoader===!0&&(a=function(e){let t=new je(e);t.needsUpdate=!0,n(t)}),t.load(Se.resolveURL(e,i.path),a,void 0,r)})}).then(function(e){return c===!0&&o.revokeObjectURL(s),Un(e,a),e.userData.mimeType=a.mimeType||Yn(a.uri),e}).catch(function(e){throw console.error(`THREE.GLTFLoader: Couldn't load texture`,s),e});return this.sourceCache[e]=l,l}assignTexture(e,t,n,r){let i=this;return this.getDependency(`texture`,n.index).then(function(a){if(!a)return null;if(n.texCoord!==void 0&&n.texCoord>0&&(a=a.clone(),a.channel=n.texCoord),i.extensions[Z.KHR_TEXTURE_TRANSFORM]){let e=n.extensions===void 0?void 0:n.extensions[Z.KHR_TEXTURE_TRANSFORM];if(e){let t=i.associations.get(a);a=i.extensions[Z.KHR_TEXTURE_TRANSFORM].extendTexture(a,e),i.associations.set(a,t)}}return r!==void 0&&(a.colorSpace=r),e[t]=a,a})}assignFinalMaterial(e){let t=e.geometry,n=e.material,r=t.attributes.tangent===void 0,i=t.attributes.color!==void 0,a=t.attributes.normal===void 0;if(e.isPoints){let e=`PointsMaterial:`+n.uuid,t=this.cache.get(e);t||(t=new k,St.prototype.copy.call(t,n),t.color.copy(n.color),t.map=n.map,t.sizeAttenuation=!1,this.cache.add(e,t)),n=t}else if(e.isLine){let e=`LineBasicMaterial:`+n.uuid,t=this.cache.get(e);t||(t=new Ze,St.prototype.copy.call(t,n),t.color.copy(n.color),t.map=n.map,this.cache.add(e,t)),n=t}if(r||i||a){let e=`ClonedMaterial:`+n.uuid+`:`;r&&(e+=`derivative-tangents:`),i&&(e+=`vertex-colors:`),a&&(e+=`flat-shading:`);let t=this.cache.get(e);t||(t=n.clone(),i&&(t.vertexColors=!0),a&&(t.flatShading=!0),r&&(t.normalScale&&(t.normalScale.y*=-1),t.clearcoatNormalScale&&(t.clearcoatNormalScale.y*=-1)),this.cache.add(e,t),this.associations.set(t,this.associations.get(n))),n=t}e.material=n}getMaterialType(){return x}loadMaterial(e){let t=this,n=this.json,r=this.extensions,i=n.materials[e],a,o={},s=i.extensions||{},c=[];if(s[Z.KHR_MATERIALS_UNLIT]){let e=r[Z.KHR_MATERIALS_UNLIT];a=e.getMaterialType(),c.push(e.extendParams(o,i,t))}else{let n=i.pbrMetallicRoughness||{};if(o.color=new m(1,1,1),o.opacity=1,Array.isArray(n.baseColorFactor)){let e=n.baseColorFactor;o.color.setRGB(e[0],e[1],e[2],Ve),o.opacity=e[3]}n.baseColorTexture!==void 0&&c.push(t.assignTexture(o,`map`,n.baseColorTexture,z)),o.metalness=n.metallicFactor===void 0?1:n.metallicFactor,o.roughness=n.roughnessFactor===void 0?1:n.roughnessFactor,n.metallicRoughnessTexture!==void 0&&(c.push(t.assignTexture(o,`metalnessMap`,n.metallicRoughnessTexture)),c.push(t.assignTexture(o,`roughnessMap`,n.metallicRoughnessTexture))),a=this._invokeOne(function(t){return t.getMaterialType&&t.getMaterialType(e)}),c.push(Promise.all(this._invokeAll(function(t){return t.extendMaterialParams&&t.extendMaterialParams(e,o)})))}i.doubleSided===!0&&(o.side=2);let l=i.alphaMode||Bn.OPAQUE;if(l===Bn.BLEND?(o.transparent=!0,o.depthWrite=!1):(o.transparent=!1,l===Bn.MASK&&(o.alphaTest=i.alphaCutoff===void 0?.5:i.alphaCutoff)),i.normalTexture!==void 0&&a!==B&&(c.push(t.assignTexture(o,`normalMap`,i.normalTexture)),o.normalScale=new Ee(1,1),i.normalTexture.scale!==void 0)){let e=i.normalTexture.scale;o.normalScale.set(e,e)}if(i.occlusionTexture!==void 0&&a!==B&&(c.push(t.assignTexture(o,`aoMap`,i.occlusionTexture)),i.occlusionTexture.strength!==void 0&&(o.aoMapIntensity=i.occlusionTexture.strength)),i.emissiveFactor!==void 0&&a!==B){let e=i.emissiveFactor;o.emissive=new m().setRGB(e[0],e[1],e[2],Ve)}return i.emissiveTexture!==void 0&&a!==B&&c.push(t.assignTexture(o,`emissiveMap`,i.emissiveTexture,z)),Promise.all(c).then(function(){let n=new a(o);return i.name&&(n.name=i.name),Un(n,i),t.associations.set(n,{materials:e}),i.extensions&&Hn(r,n,i),n})}createUniqueName(e){let t=pe.sanitizeNodeName(e||``);return t in this.nodeNamesUsed?t+`_`+ ++this.nodeNamesUsed[t]:(this.nodeNamesUsed[t]=0,t)}loadGeometries(e){let t=this,n=this.extensions,r=this.primitiveCache;function i(e){return n[Z.KHR_DRACO_MESH_COMPRESSION].decodePrimitive(e,t).then(function(n){return $n(n,e,t)})}let a=[];for(let n=0,o=e.length;n<o;n++){let o=e[n],s=Kn(o),c=r[s];if(c)a.push(c.promise);else{let e;e=o.extensions&&o.extensions[Z.KHR_DRACO_MESH_COMPRESSION]?i(o):$n(new Ct,o,t),o.mode===Mn.TRIANGLE_STRIP?e=e.then(e=>Nt(e,1)):o.mode===Mn.TRIANGLE_FAN&&(e=e.then(e=>Nt(e,2))),r[s]={primitive:o,promise:e},a.push(e)}}return Promise.all(a)}loadMesh(e){let t=this,n=this.json,r=this.extensions,i=n.meshes[e],a=i.primitives,o=[];for(let e=0,t=a.length;e<t;e++){let t=a[e].material===void 0?Vn(this.cache):this.getDependency(`material`,a[e].material);o.push(t)}return o.push(t.loadGeometries(a)),Promise.all(o).then(async function(n){let o=n.slice(0,n.length-1),s=n[n.length-1],c=[];for(let n=0,l=s.length;n<l;n++){let l=s[n],u=a[n],d,f=o[n];if(u.mode===Mn.TRIANGLES||u.mode===Mn.TRIANGLE_STRIP||u.mode===Mn.TRIANGLE_FAN||u.mode===void 0){let e=i.isSkinnedMesh===!0,t=l.hasAttribute(`skinIndex`)&&l.hasAttribute(`skinWeight`);e&&t===!1&&console.warn(`THREE.GLTFLoader: Missing skinIndex or skinWeight attributes. Skinning disabled.`),d=e&&t?new we(l,f):new X(l,f),d.isSkinnedMesh===!0&&d.normalizeSkinWeights()}else if(u.mode===Mn.LINES)d=new Me(l,f);else if(u.mode===Mn.LINE_STRIP)d=new mt(l,f);else if(u.mode===Mn.LINE_LOOP)d=new bt(l,f);else if(u.mode===Mn.POINTS)d=new me(l,f);else throw Error(`THREE.GLTFLoader: Primitive mode unsupported: `+u.mode);Object.keys(d.geometry.morphAttributes).length>0&&Gn(d,i),d.name=t.createUniqueName(i.name||`mesh_`+e),Un(d,i),u.extensions&&Hn(r,d,u),t.assignFinalMaterial(d),c.push(d)}for(let n=0,r=c.length;n<r;n++)t.associations.set(c[n],{meshes:e,primitives:n});if(c.length===1)return i.extensions&&Hn(r,c[0],i),c[0];let l=new M;i.extensions&&Hn(r,l,i),t.associations.set(l,{meshes:e});for(let e=0,t=c.length;e<t;e++)l.add(c[e]);return l})}loadCamera(e){let t,n=this.json.cameras[e],r=n[n.type];if(!r)console.warn(`THREE.GLTFLoader: Missing camera parameters.`);else return n.type===`perspective`?t=new P(Ot.radToDeg(r.yfov),r.aspectRatio||1,r.znear||1,r.zfar||2e6):n.type===`orthographic`&&(t=new T(-r.xmag,r.xmag,r.ymag,-r.ymag,r.znear,r.zfar)),n.name&&(t.name=this.createUniqueName(n.name)),Un(t,n),Promise.resolve(t)}loadSkin(e){let t=this.json.skins[e],n=[];for(let e=0,r=t.joints.length;e<r;e++)n.push(this._loadNodeShallow(t.joints[e]));return t.inverseBindMatrices===void 0?n.push(null):n.push(this.getDependency(`accessor`,t.inverseBindMatrices)),Promise.all(n).then(function(e){let n=e.pop(),r=e,i=[],a=[];for(let e=0,o=r.length;e<o;e++){let o=r[e];if(o){i.push(o);let t=new De;n!==null&&t.fromArray(n.array,e*16),a.push(t)}else console.warn(`THREE.GLTFLoader: Joint "%s" could not be found.`,t.joints[e])}return new Ue(i,a)})}loadAnimation(e){let t=this.json,n=this,r=t.animations[e],i=r.name?r.name:`animation_`+e,a=[],o=[],s=[],c=[],l=[];for(let e=0,t=r.channels.length;e<t;e++){let t=r.channels[e],n=r.samplers[t.sampler],i=t.target,u=i.node,d=r.parameters===void 0?n.input:r.parameters[n.input],f=r.parameters===void 0?n.output:r.parameters[n.output];i.node!==void 0&&(a.push(this.getDependency(`node`,u)),o.push(this.getDependency(`accessor`,d)),s.push(this.getDependency(`accessor`,f)),c.push(n),l.push(i))}return Promise.all([Promise.all(a),Promise.all(o),Promise.all(s),Promise.all(c),Promise.all(l)]).then(function(e){let t=e[0],a=e[1],o=e[2],s=e[3],c=e[4],l=[];for(let e=0,r=t.length;e<r;e++){let r=t[e],i=a[e],u=o[e],d=s[e],f=c[e];if(r===void 0)continue;r.updateMatrix&&r.updateMatrix();let p=n._createAnimationTracks(r,i,u,d,f);if(p)for(let e=0;e<p.length;e++)l.push(p[e])}let u=new Et(i,void 0,l);return Un(u,r),u})}createNodeMesh(e){let t=this.json,n=this,r=t.nodes[e];return r.mesh===void 0?null:n.getDependency(`mesh`,r.mesh).then(function(e){let t=n._getNodeRef(n.meshCache,r.mesh,e);return r.weights!==void 0&&t.traverse(function(e){if(e.isMesh)for(let t=0,n=r.weights.length;t<n;t++)e.morphTargetInfluences[t]=r.weights[t]}),t})}loadNode(e){let t=this.json,n=this,r=t.nodes[e],i=n._loadNodeShallow(e),a=[],o=r.children||[];for(let e=0,t=o.length;e<t;e++)a.push(n.getDependency(`node`,o[e]));let s=r.skin===void 0?Promise.resolve(null):n.getDependency(`skin`,r.skin);return Promise.all([i,Promise.all(a),s]).then(function(e){let t=e[0],n=e[1],r=e[2];r!==null&&t.traverse(function(e){e.isSkinnedMesh&&e.bind(r,Xn)});for(let e=0,r=n.length;e<r;e++)t.add(n[e]);if(t.userData.pivot!==void 0&&n.length>0){let e=t.userData.pivot,r=n[0];t.pivot=new Y().fromArray(e),t.position.x-=e[0],t.position.y-=e[1],t.position.z-=e[2],r.position.set(0,0,0),delete t.userData.pivot}return t})}_loadNodeShallow(e){let t=this.json,n=this.extensions,r=this;if(this.nodeCache[e]!==void 0)return this.nodeCache[e];let i=t.nodes[e],a=i.name?r.createUniqueName(i.name):``,o=[],s=r._invokeOne(function(t){return t.createNodeMesh&&t.createNodeMesh(e)});return s&&o.push(s),i.camera!==void 0&&o.push(r.getDependency(`camera`,i.camera).then(function(e){return r._getNodeRef(r.cameraCache,i.camera,e)})),r._invokeAll(function(t){return t.createNodeAttachment&&t.createNodeAttachment(e)}).forEach(function(e){o.push(e)}),this.nodeCache[e]=Promise.all(o).then(function(t){let o;if(o=i.isBone===!0?new G:t.length>1?new M:t.length===1?t[0]:new ie,o!==t[0])for(let e=0,n=t.length;e<n;e++)o.add(t[e]);if(i.name&&(o.userData.name=i.name,o.name=a),Un(o,i),i.extensions&&Hn(n,o,i),i.matrix!==void 0){let e=new De;e.fromArray(i.matrix),o.applyMatrix4(e)}else i.translation!==void 0&&o.position.fromArray(i.translation),i.rotation!==void 0&&o.quaternion.fromArray(i.rotation),i.scale!==void 0&&o.scale.fromArray(i.scale);if(!r.associations.has(o))r.associations.set(o,{});else if(i.mesh!==void 0&&r.meshCache.refs[i.mesh]>1){let e=r.associations.get(o);r.associations.set(o,{...e})}return r.associations.get(o).nodes=e,o}),this.nodeCache[e]}loadScene(e){let t=this.extensions,n=this.json.scenes[e],r=this,i=new M;n.name&&(i.name=r.createUniqueName(n.name)),Un(i,n),n.extensions&&Hn(t,i,n);let a=n.nodes||[],o=[];for(let e=0,t=a.length;e<t;e++)o.push(r.getDependency(`node`,a[e]));return Promise.all(o).then(function(e){for(let t=0,n=e.length;t<n;t++){let n=e[t];n.parent===null?i.add(n):i.add(Qt(n))}return r.associations=(e=>{let t=new Map;for(let[e,n]of r.associations)(e instanceof St||e instanceof je)&&t.set(e,n);return e.traverse(e=>{let n=r.associations.get(e);n!=null&&t.set(e,n)}),t})(i),i})}_createAnimationTracks(e,t,n,r,i){let a=[],o=e.name?e.name:e.uuid,s=[];function c(e){e.morphTargetInfluences&&s.push(e.name?e.name:e.uuid)}Rn[i.path]===Rn.weights?(c(e),e.isGroup&&e.children.forEach(c)):s.push(o);let l;switch(Rn[i.path]){case Rn.weights:l=re;break;case Rn.rotation:l=D;break;case Rn.translation:case Rn.scale:l=v;break;default:switch(n.itemSize){case 1:l=re;break;default:l=v}}let u=r.interpolation===void 0?Te:zn[r.interpolation],d=this._getArrayFromAccessor(n);for(let e=0,n=s.length;e<n;e++){let n=new l(s[e]+`.`+Rn[i.path],t.array,d,u);r.interpolation===`CUBICSPLINE`&&this._createCubicSplineTrackInterpolant(n),a.push(n)}return a}_getArrayFromAccessor(e){let t=e.array;if(e.normalized){let e=Jn(t.constructor),n=new Float32Array(t.length);for(let r=0,i=t.length;r<i;r++)n[r]=t[r]*e;t=n}return t}_createCubicSplineTrackInterpolant(e){e.createInterpolant=function(e){return new(this instanceof D?jn:kn)(this.times,this.values,this.getValueSize()/3,e)},e.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline=!0}};function Qn(e,t,n){let r=t.attributes,i=new Tt;if(r.POSITION!==void 0){let e=n.json.accessors[r.POSITION],t=e.min,a=e.max;if(t!==void 0&&a!==void 0){if(i.set(new Y(t[0],t[1],t[2]),new Y(a[0],a[1],a[2])),e.normalized){let t=Jn(Nn[e.componentType]);i.min.multiplyScalar(t),i.max.multiplyScalar(t)}}else{console.warn(`THREE.GLTFLoader: Missing min/max properties for accessor POSITION.`);return}}else return;let a=t.targets;if(a!==void 0){let e=new Y,t=new Y;for(let r=0,i=a.length;r<i;r++){let i=a[r];if(i.POSITION!==void 0){let r=n.json.accessors[i.POSITION],a=r.min,o=r.max;if(a!==void 0&&o!==void 0){if(t.setX(Math.max(Math.abs(a[0]),Math.abs(o[0]))),t.setY(Math.max(Math.abs(a[1]),Math.abs(o[1]))),t.setZ(Math.max(Math.abs(a[2]),Math.abs(o[2]))),r.normalized){let e=Jn(Nn[r.componentType]);t.multiplyScalar(e)}e.max(t)}else console.warn(`THREE.GLTFLoader: Missing min/max properties for accessor POSITION.`)}}i.expandByVector(e)}e.boundingBox=i;let o=new rt;i.getCenter(o.center),o.radius=i.min.distanceTo(i.max)/2,e.boundingSphere=o}function $n(e,t,n){let r=t.attributes,i=[];function a(t,r){return n.getDependency(`accessor`,t).then(function(t){e.setAttribute(r,t)})}for(let t in r){let n=Ln[t]||t.toLowerCase();n in e.attributes||i.push(a(r[t],n))}if(t.indices!==void 0&&!e.index){let r=n.getDependency(`accessor`,t.indices).then(function(t){e.setIndex(t)});i.push(r)}return Ge.workingColorSpace!==`srgb-linear`&&`COLOR_0`in r&&console.warn(`THREE.GLTFLoader: Converting vertex colors from "srgb-linear" to "${Ge.workingColorSpace}" not supported.`),Un(e,t),Qn(e,t,n),Promise.all(i).then(function(){return t.targets===void 0?e:Wn(e,t.targets,n)})}function er(e){let t=document.createElement(`div`);t.className=`sg-progress`,t.setAttribute(`role`,`progressbar`),t.setAttribute(`aria-valuemin`,`0`),t.setAttribute(`aria-valuemax`,`100`),t.setAttribute(`aria-label`,`Loading`),t.style.cssText=`position:fixed;left:10%;right:10%;top:50%;height:12px;border-radius:6px;background:#2a2f4a;overflow:hidden;z-index:50`;let n=document.createElement(`div`);return n.style.cssText=`height:100%;width:0;background:#4cc38a;transition:width 0.15s`,t.appendChild(n),e.appendChild(t),{update(e){let r=Math.round(e*100);n.style.width=`${r}%`,t.setAttribute(`aria-valuenow`,String(r))},remove:()=>t.remove()}}var tr=new Tt,nr=new Y,rr=class extends ae{constructor(){super(),this.isLineSegmentsGeometry=!0,this.type=`LineSegmentsGeometry`,this.setIndex([0,2,1,2,3,1,2,4,3,4,5,3,4,6,5,6,7,5]),this.setAttribute(`position`,new V([-1,2,0,1,2,0,-1,1,0,1,1,0,-1,0,0,1,0,0,-1,-1,0,1,-1,0],3)),this.setAttribute(`uv`,new V([-1,2,1,2,-1,1,1,1,-1,-1,1,-1,-1,-2,1,-2],2))}applyMatrix4(e){let t=this.attributes.instanceStart,n=this.attributes.instanceEnd;return t!==void 0&&(t.applyMatrix4(e),n.applyMatrix4(e),t.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}setPositions(e){let t;e instanceof Float32Array?t=e:Array.isArray(e)&&(t=new Float32Array(e));let n=new p(t,6,1);return this.setAttribute(`instanceStart`,new tt(n,3,0)),this.setAttribute(`instanceEnd`,new tt(n,3,3)),this.instanceCount=this.attributes.instanceStart.count,this.computeBoundingBox(),this.computeBoundingSphere(),this}setColors(e){let t;e instanceof Float32Array?t=e:Array.isArray(e)&&(t=new Float32Array(e));let n=new p(t,6,1);return this.setAttribute(`instanceColorStart`,new tt(n,3,0)),this.setAttribute(`instanceColorEnd`,new tt(n,3,3)),this}fromWireframeGeometry(e){return this.setPositions(e.attributes.position.array),this}fromEdgesGeometry(e){return this.setPositions(e.attributes.position.array),this}fromMesh(e){return this.fromWireframeGeometry(new de(e.geometry)),this}fromLineSegments(e){let t=e.geometry;return this.setPositions(t.attributes.position.array),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Tt);let e=this.attributes.instanceStart,t=this.attributes.instanceEnd;e!==void 0&&t!==void 0&&(this.boundingBox.setFromBufferAttribute(e),tr.setFromBufferAttribute(t),this.boundingBox.union(tr))}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new rt),this.boundingBox===null&&this.computeBoundingBox();let e=this.attributes.instanceStart,t=this.attributes.instanceEnd;if(e!==void 0&&t!==void 0){let n=this.boundingSphere.center;this.boundingBox.getCenter(n);let r=0;for(let i=0,a=e.count;i<a;i++)nr.fromBufferAttribute(e,i),r=Math.max(r,n.distanceToSquared(nr)),nr.fromBufferAttribute(t,i),r=Math.max(r,n.distanceToSquared(nr));this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&console.error(`THREE.LineSegmentsGeometry.computeBoundingSphere(): Computed radius is NaN. The instanced position data is likely to have NaN values.`,this)}}toJSON(){}};xe.line={worldUnits:{value:1},linewidth:{value:1},resolution:{value:new Ee},dashOffset:{value:0},dashScale:{value:1},dashSize:{value:1},gapSize:{value:1}},Ie.line={uniforms:W.merge([xe.common,xe.fog,xe.line]),vertexShader:`
		#include <common>
		#include <color_pars_vertex>
		#include <fog_pars_vertex>
		#include <logdepthbuf_pars_vertex>
		#include <clipping_planes_pars_vertex>

		uniform float linewidth;
		uniform vec2 resolution;

		attribute vec3 instanceStart;
		attribute vec3 instanceEnd;

		attribute vec3 instanceColorStart;
		attribute vec3 instanceColorEnd;

		#ifdef WORLD_UNITS

			varying vec4 worldPos;
			varying vec3 worldStart;
			varying vec3 worldEnd;

			#ifdef USE_DASH

				varying vec2 vUv;

			#endif

		#else

			varying vec2 vUv;

		#endif

		#ifdef USE_DASH

			uniform float dashScale;
			attribute float instanceDistanceStart;
			attribute float instanceDistanceEnd;
			varying float vLineDistance;

		#endif

		float trimSegmentAlpha( const in vec4 start, const in vec4 end ) {

			// compute the interpolation factor needed to trim the segment so it terminates
			// between the camera plane and the near plane

			// conservative estimate of the near plane
			float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column
			float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column

			// we need different nearEstimate formula for reversed and default depth buffer
			// a is positive with a reversed depth buffer so it can be used for controlling the code flow
			float nearEstimate = ( a > 0.0 ) ? ( - b / ( a + 1.0 ) ) : ( - 0.5 * b / a );

			return ( nearEstimate - start.z ) / ( end.z - start.z );

		}

		void main() {

			#ifdef USE_COLOR

				vColor.xyz = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;

			#endif

			float aspect = resolution.x / resolution.y;

			// camera space
			vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
			vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );

			#ifdef USE_DASH

				float lineDistanceStart = dashScale * instanceDistanceStart;
				float lineDistanceEnd = dashScale * instanceDistanceEnd;

			#endif

			#ifdef WORLD_UNITS

				worldStart = start.xyz;
				worldEnd = end.xyz;

			#else

				vUv = uv;

			#endif

			// special case for perspective projection, and segments that terminate either in, or behind, the camera plane
			// clearly the gpu firmware has a way of addressing this issue when projecting into ndc space
			// but we need to perform ndc-space calculations in the shader, so we must address this issue directly
			// perhaps there is a more elegant solution -- WestLangley

			bool perspective = ( projectionMatrix[ 2 ][ 3 ] == - 1.0 ); // 4th entry in the 3rd column

			if ( perspective ) {

				if ( start.z < 0.0 && end.z >= 0.0 ) {

					float alpha = trimSegmentAlpha( start, end );
					end.xyz = mix( start.xyz, end.xyz, alpha );

					#ifdef USE_DASH

						lineDistanceEnd = mix( lineDistanceStart, lineDistanceEnd, alpha );

					#endif

				} else if ( end.z < 0.0 && start.z >= 0.0 ) {

					float alpha = trimSegmentAlpha( end, start );
					start.xyz = mix( end.xyz, start.xyz, alpha );

					#ifdef USE_DASH

						lineDistanceStart = mix( lineDistanceEnd, lineDistanceStart, alpha );

					#endif

				}

			}

			#ifdef USE_DASH

				vLineDistance = ( position.y < 0.5 ) ? lineDistanceStart : lineDistanceEnd;
				vUv = uv;

			#endif

			// clip space
			vec4 clipStart = projectionMatrix * start;
			vec4 clipEnd = projectionMatrix * end;

			// ndc space
			vec3 ndcStart = clipStart.xyz / clipStart.w;
			vec3 ndcEnd = clipEnd.xyz / clipEnd.w;

			// direction
			vec2 dir = ndcEnd.xy - ndcStart.xy;

			// account for clip-space aspect ratio
			dir.x *= aspect;
			dir = normalize( dir );

			#ifdef WORLD_UNITS

				vec3 worldDir = normalize( end.xyz - start.xyz );
				vec3 tmpFwd = normalize( mix( start.xyz, end.xyz, 0.5 ) );
				vec3 worldUp = normalize( cross( worldDir, tmpFwd ) );
				vec3 worldFwd = cross( worldDir, worldUp );
				worldPos = position.y < 0.5 ? start: end;

				// height offset
				float hw = linewidth * 0.5;
				worldPos.xyz += position.x < 0.0 ? hw * worldUp : - hw * worldUp;

				// don't extend the line if we're rendering dashes because we
				// won't be rendering the endcaps
				#ifndef USE_DASH

					// cap extension
					worldPos.xyz += position.y < 0.5 ? - hw * worldDir : hw * worldDir;

					// add width to the box
					worldPos.xyz += worldFwd * hw;

					// endcaps
					if ( position.y > 1.0 || position.y < 0.0 ) {

						worldPos.xyz -= worldFwd * 2.0 * hw;

					}

				#endif

				// project the worldpos
				vec4 clip = projectionMatrix * worldPos;

				// shift the depth of the projected points so the line
				// segments overlap neatly
				vec3 clipPose = ( position.y < 0.5 ) ? ndcStart : ndcEnd;
				clip.z = clipPose.z * clip.w;

			#else

				vec2 offset = vec2( dir.y, - dir.x );
				// undo aspect ratio adjustment
				dir.x /= aspect;
				offset.x /= aspect;

				// sign flip
				if ( position.x < 0.0 ) offset *= - 1.0;

				// endcaps
				if ( position.y < 0.0 ) {

					offset += - dir;

				} else if ( position.y > 1.0 ) {

					offset += dir;

				}

				// adjust for linewidth
				offset *= linewidth;

				// adjust for clip-space to screen-space conversion // maybe resolution should be based on viewport ...
				offset /= resolution.y;

				// select end
				vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;

				// back to clip space
				offset *= clip.w;

				clip.xy += offset;

			#endif

			gl_Position = clip;

			vec4 mvPosition = ( position.y < 0.5 ) ? start : end; // this is an approximation

			#include <logdepthbuf_vertex>
			#include <clipping_planes_vertex>
			#include <fog_vertex>

		}
		`,fragmentShader:`
		uniform vec3 diffuse;
		uniform float opacity;
		uniform float linewidth;

		#ifdef USE_DASH

			uniform float dashOffset;
			uniform float dashSize;
			uniform float gapSize;

		#endif

		varying float vLineDistance;

		#ifdef WORLD_UNITS

			varying vec4 worldPos;
			varying vec3 worldStart;
			varying vec3 worldEnd;

			#ifdef USE_DASH

				varying vec2 vUv;

			#endif

		#else

			varying vec2 vUv;

		#endif

		#include <common>
		#include <color_pars_fragment>
		#include <fog_pars_fragment>
		#include <logdepthbuf_pars_fragment>
		#include <clipping_planes_pars_fragment>

		vec2 closestLineToLine(vec3 p1, vec3 p2, vec3 p3, vec3 p4) {

			float mua;
			float mub;

			vec3 p13 = p1 - p3;
			vec3 p43 = p4 - p3;

			vec3 p21 = p2 - p1;

			float d1343 = dot( p13, p43 );
			float d4321 = dot( p43, p21 );
			float d1321 = dot( p13, p21 );
			float d4343 = dot( p43, p43 );
			float d2121 = dot( p21, p21 );

			float denom = d2121 * d4343 - d4321 * d4321;

			float numer = d1343 * d4321 - d1321 * d4343;

			mua = numer / denom;
			mua = clamp( mua, 0.0, 1.0 );
			mub = ( d1343 + d4321 * ( mua ) ) / d4343;
			mub = clamp( mub, 0.0, 1.0 );

			return vec2( mua, mub );

		}

		void main() {

			float alpha = opacity;
			vec4 diffuseColor = vec4( diffuse, alpha );

			#include <clipping_planes_fragment>

			#ifdef USE_DASH

				if ( vUv.y < - 1.0 || vUv.y > 1.0 ) discard; // discard endcaps

				if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard; // todo - FIX

			#endif

			#ifdef WORLD_UNITS

				// Find the closest points on the view ray and the line segment
				vec3 rayEnd = normalize( worldPos.xyz ) * 1e5;
				vec3 lineDir = worldEnd - worldStart;
				vec2 params = closestLineToLine( worldStart, worldEnd, vec3( 0.0, 0.0, 0.0 ), rayEnd );

				vec3 p1 = worldStart + lineDir * params.x;
				vec3 p2 = rayEnd * params.y;
				vec3 delta = p1 - p2;
				float len = length( delta );
				float norm = len / linewidth;

				#ifndef USE_DASH

					#ifdef USE_ALPHA_TO_COVERAGE

						float dnorm = fwidth( norm );
						alpha = 1.0 - smoothstep( 0.5 - dnorm, 0.5 + dnorm, norm );

					#else

						if ( norm > 0.5 ) {

							discard;

						}

					#endif

				#endif

			#else

				#ifdef USE_ALPHA_TO_COVERAGE

					// artifacts appear on some hardware if a derivative is taken within a conditional
					float a = vUv.x;
					float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
					float len2 = a * a + b * b;
					float dlen = fwidth( len2 );

					if ( abs( vUv.y ) > 1.0 ) {

						alpha = 1.0 - smoothstep( 1.0 - dlen, 1.0 + dlen, len2 );

					}

				#else

					if ( abs( vUv.y ) > 1.0 ) {

						float a = vUv.x;
						float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
						float len2 = a * a + b * b;

						if ( len2 > 1.0 ) discard;

					}

				#endif

			#endif

			#include <logdepthbuf_fragment>
			#include <color_fragment>

			gl_FragColor = vec4( diffuseColor.rgb, alpha );

			#include <tonemapping_fragment>
			#include <colorspace_fragment>
			#include <fog_fragment>
			#include <premultiplied_alpha_fragment>

		}
		`};var ir=class extends gt{constructor(e){super({type:`LineMaterial`,uniforms:W.clone(Ie.line.uniforms),vertexShader:Ie.line.vertexShader,fragmentShader:Ie.line.fragmentShader,clipping:!0}),this.isLineMaterial=!0,this.setValues(e)}get color(){return this.uniforms.diffuse.value}set color(e){this.uniforms.diffuse.value=e}get worldUnits(){return`WORLD_UNITS`in this.defines}set worldUnits(e){e===!0!==this.worldUnits&&(this.needsUpdate=!0),e===!0?this.defines.WORLD_UNITS=``:delete this.defines.WORLD_UNITS}get linewidth(){return this.uniforms.linewidth.value}set linewidth(e){this.uniforms.linewidth&&(this.uniforms.linewidth.value=e)}get dashed(){return`USE_DASH`in this.defines}set dashed(e){e===!0!==this.dashed&&(this.needsUpdate=!0),e===!0?this.defines.USE_DASH=``:delete this.defines.USE_DASH}get dashScale(){return this.uniforms.dashScale.value}set dashScale(e){this.uniforms.dashScale.value=e}get dashSize(){return this.uniforms.dashSize.value}set dashSize(e){this.uniforms.dashSize.value=e}get dashOffset(){return this.uniforms.dashOffset.value}set dashOffset(e){this.uniforms.dashOffset.value=e}get gapSize(){return this.uniforms.gapSize.value}set gapSize(e){this.uniforms.gapSize.value=e}get opacity(){return this.uniforms.opacity.value}set opacity(e){this.uniforms&&(this.uniforms.opacity.value=e)}get resolution(){return this.uniforms.resolution.value}set resolution(e){this.uniforms.resolution.value.copy(e)}get alphaToCoverage(){return`USE_ALPHA_TO_COVERAGE`in this.defines}set alphaToCoverage(e){this.defines&&(e===!0!==this.alphaToCoverage&&(this.needsUpdate=!0),e===!0?this.defines.USE_ALPHA_TO_COVERAGE=``:delete this.defines.USE_ALPHA_TO_COVERAGE)}},ar=new le,or=new Y,sr=new Y,cr=new le,lr=new le,ur=new le,dr=new Y,fr=new De,pr=new ke,mr=new Y,hr=new Tt,gr=new rt,_r=new le,vr,yr;function br(e,t,n){return _r.set(0,0,-t,1).applyMatrix4(e.projectionMatrix),_r.multiplyScalar(1/_r.w),_r.x=yr/n.width,_r.y=yr/n.height,_r.applyMatrix4(e.projectionMatrixInverse),_r.multiplyScalar(1/_r.w),Math.abs(Math.max(_r.x,_r.y))}function xr(e,t){let n=e.matrixWorld,r=e.geometry,i=r.attributes.instanceStart,a=r.attributes.instanceEnd,o=Math.min(r.instanceCount,i.count);for(let r=0,s=o;r<s;r++){pr.start.fromBufferAttribute(i,r),pr.end.fromBufferAttribute(a,r),pr.applyMatrix4(n);let o=new Y,s=new Y;vr.distanceSqToSegment(pr.start,pr.end,s,o),s.distanceTo(o)<yr*.5&&t.push({point:s,pointOnLine:o,distance:vr.origin.distanceTo(s),object:e,face:null,faceIndex:r,uv:null,uv1:null})}}function Sr(e,t,n){let r=t.projectionMatrix,i=e.material.resolution,a=e.matrixWorld,o=e.geometry,s=o.attributes.instanceStart,c=o.attributes.instanceEnd,l=Math.min(o.instanceCount,s.count),u=-t.near;vr.at(1,ur),ur.w=1,ur.applyMatrix4(t.matrixWorldInverse),ur.applyMatrix4(r),ur.multiplyScalar(1/ur.w),ur.x*=i.x/2,ur.y*=i.y/2,ur.z=0,dr.copy(ur),fr.multiplyMatrices(t.matrixWorldInverse,a);for(let t=0,o=l;t<o;t++){if(cr.fromBufferAttribute(s,t),lr.fromBufferAttribute(c,t),cr.w=1,lr.w=1,cr.applyMatrix4(fr),lr.applyMatrix4(fr),cr.z>u&&lr.z>u)continue;if(cr.z>u){let e=cr.z-lr.z,t=(cr.z-u)/e;cr.lerp(lr,t)}else if(lr.z>u){let e=lr.z-cr.z,t=(lr.z-u)/e;lr.lerp(cr,t)}cr.applyMatrix4(r),lr.applyMatrix4(r),cr.multiplyScalar(1/cr.w),lr.multiplyScalar(1/lr.w),cr.x*=i.x/2,cr.y*=i.y/2,lr.x*=i.x/2,lr.y*=i.y/2,pr.start.copy(cr),pr.start.z=0,pr.end.copy(lr),pr.end.z=0;let o=pr.closestPointToPointParameter(dr,!0);pr.at(o,mr);let l=Ot.lerp(cr.z,lr.z,o),d=l>=-1&&l<=1,f=dr.distanceTo(mr)<yr*.5;if(d&&f){pr.start.fromBufferAttribute(s,t),pr.end.fromBufferAttribute(c,t),pr.start.applyMatrix4(a),pr.end.applyMatrix4(a);let r=new Y,i=new Y;vr.distanceSqToSegment(pr.start,pr.end,i,r),n.push({point:i,pointOnLine:r,distance:vr.origin.distanceTo(i),object:e,face:null,faceIndex:t,uv:null,uv1:null})}}}var Cr=class extends X{constructor(e=new rr,t=new ir({color:Math.random()*16777215})){super(e,t),this.isLineSegments2=!0,this.type=`LineSegments2`}computeLineDistances(){let e=this.geometry,t=e.attributes.instanceStart,n=e.attributes.instanceEnd,r=new Float32Array(2*t.count);for(let e=0,i=0,a=t.count;e<a;e++,i+=2)or.fromBufferAttribute(t,e),sr.fromBufferAttribute(n,e),r[i]=i===0?0:r[i-1],r[i+1]=r[i]+or.distanceTo(sr);let i=new p(r,2,1);return e.setAttribute(`instanceDistanceStart`,new tt(i,1,0)),e.setAttribute(`instanceDistanceEnd`,new tt(i,1,1)),this}raycast(e,t){let n=this.material.worldUnits,r=e.camera;if(r===null&&!n&&console.error(`LineSegments2: "Raycaster.camera" needs to be set in order to raycast against LineSegments2 while worldUnits is set to false.`),n===!1&&(this.material.resolution.x===0||this.material.resolution.y===0))return;let i=e.params.Line2===void 0?0:e.params.Line2.threshold||0;vr=e.ray;let a=this.matrixWorld,o=this.geometry,s=this.material;yr=s.linewidth+i,o.boundingSphere===null&&o.computeBoundingSphere(),gr.copy(o.boundingSphere).applyMatrix4(a);let c;if(c=n?yr*.5:br(r,Math.max(r.near,gr.distanceToPoint(vr.origin)),s.resolution),gr.radius+=c,vr.intersectsSphere(gr)===!1)return;o.boundingBox===null&&o.computeBoundingBox(),hr.copy(o.boundingBox).applyMatrix4(a);let l;l=n?yr*.5:br(r,Math.max(r.near,hr.distanceToPoint(vr.origin)),s.resolution),hr.expandByScalar(l),vr.intersectsBox(hr)!==!1&&(n?xr(this,t):Sr(this,r,t))}onBeforeRender(e){let t=this.material.uniforms;t&&t.resolution&&(e.getViewport(ar),this.material.uniforms.resolution.value.set(ar.z,ar.w))}},wr=class extends rr{constructor(){super(),this.isLineGeometry=!0,this.type=`LineGeometry`}setPositions(e){let t=e.length-3,n=new Float32Array(2*t);for(let r=0;r<t;r+=3)n[2*r]=e[r],n[2*r+1]=e[r+1],n[2*r+2]=e[r+2],n[2*r+3]=e[r+3],n[2*r+4]=e[r+4],n[2*r+5]=e[r+5];return super.setPositions(n),this}setColors(e){let t=e.length-3,n=new Float32Array(2*t);for(let r=0;r<t;r+=3)n[2*r]=e[r],n[2*r+1]=e[r+1],n[2*r+2]=e[r+2],n[2*r+3]=e[r+3],n[2*r+4]=e[r+4],n[2*r+5]=e[r+5];return super.setColors(n),this}setFromPoints(e){let t=e.length-1,n=new Float32Array(6*t);for(let r=0;r<t;r++)n[6*r]=e[r].x,n[6*r+1]=e[r].y,n[6*r+2]=e[r].z||0,n[6*r+3]=e[r+1].x,n[6*r+4]=e[r+1].y,n[6*r+5]=e[r+1].z||0;return super.setPositions(n),this}fromLine(e){let t=e.geometry;return this.setPositions(t.attributes.position.array),this}},Tr=class extends Cr{constructor(e=new wr,t=new ir({color:Math.random()*16777215})){super(e,t),this.isLine2=!0,this.type=`Line2`}},Er=(e,t,n,r,i=[])=>({par:e,length:t,bend:n,pin:{x:0,z:t},hazards:r,trees:i.map(([e,r,i])=>({x:Dr(n,t,e)+r,z:e,r:i}))}),Dr=(e,t,n)=>e*Math.sin(Math.PI*n/t),Or=(e,t,n,r)=>({kind:`sand`,at:{x:e,z:t,rx:n,rz:r}}),kr=(e,t,n,r)=>({kind:`water`,at:{x:e,z:t,rx:n,rz:r}}),Ar=[Er(4,340,0,[]),Er(3,140,0,[Or(-10,128,9,7)]),Er(4,360,14,[Or(20,230,10,14)],[[150,-28,4],[215,-34,4.5],[290,30,4]]),Er(5,470,-12,[kr(12,340,16,12)]),Er(4,330,0,[kr(-14,200,10,30)]),Er(3,165,0,[kr(0,140,22,10)],[[60,-30,4],[100,32,4.5],[122,-27,4]]),Er(4,380,-16,[Or(-24,250,8,16),Or(8,352,9,8)],[[120,30,4.5],[200,-32,4],[310,28,4]]),Er(5,490,10,[Or(14,250,10,14),kr(-6,400,14,10)]),Er(4,350,0,[Or(0,320,12,8)],[[90,-28,4],[170,30,4.5],[250,-30,4]])];function jr(e,t){let n=Math.min(Math.max(t,0),e.length);return e.bend*Math.sin(Math.PI*n/e.length)}function Mr(e,t,n){return((t-e.x)/e.rx)**2+((n-e.z)/e.rz)**2<=1}function Nr(e,t,n){return e.hazards.some(e=>e.kind===`water`&&Mr(e.at,t,n))?`water`:e.hazards.some(e=>e.kind===`sand`&&Mr(e.at,t,n))?`sand`:Math.hypot(t-e.pin.x,n-e.pin.z)<=16?`green`:Math.abs(t-jr(e,n))<=18&&n>=0&&n<=e.length?`fairway`:`rough`}var Pr=[{id:`driver`,name:`Driver`,carry:240,apex:.22},{id:`iron3`,name:`3-iron`,carry:190,apex:.25},{id:`iron5`,name:`5-iron`,carry:160,apex:.28},{id:`iron7`,name:`7-iron`,carry:130,apex:.32},{id:`wedge`,name:`Wedge`,carry:95,apex:.4},{id:`sand`,name:`Sand wedge`,carry:50,apex:.45},{id:`putter`,name:`Putter`,carry:0,apex:0}],Fr=e=>Pr.find(t=>t.id===e),Ir=Fr(`putter`),Lr=.8,Rr=.5,zr=Math.PI/180;function Br(e){if(e===`green`)return 40;if(e===`sand`)return Fr(`sand`).carry;let t=Pr[0].carry;return e===`rough`?t*Lr:t}function Vr(e,t){if(e===`green`)return{...Ir,carry:t};if(t<=30||e===`sand`)return{...Fr(`sand`),carry:t};let n=e===`rough`?Lr:1;return{...[...Pr].filter(e=>e.id!==`putter`).reverse().find(e=>e.carry*n>=t)??Pr[0],carry:t}}var Hr=(e,t)=>t?Math.max(1,e*.1):Math.max(3,e*.05);function Ur(e,t,n,r){let i=Math.atan2(e.pin.x-t.x,e.pin.z-t.z),a=n===`green`?Rr:10,o=r.x-t.x,s=r.z-t.z,c=Math.hypot(o,s),l=Math.min(Math.max(c,a),Br(n)),u=i;if(c>1e-9){let e=Math.atan2(o,s)-i;e=Math.atan2(Math.sin(e),Math.cos(e));let t=90*zr;u=i+Math.min(Math.max(e,-t),t)}return{x:t.x+l*Math.sin(u),z:t.z+l*Math.cos(u)}}function Wr(e,t,n,r){let i=Ur(e,t,n,r),a=Math.hypot(i.x-t.x,i.z-t.z),o=Vr(n,a);return{club:o,from:{...t},carry:a,dir:Math.atan2(i.x-t.x,i.z-t.z),landing:i,ringR:Hr(a,o.id===`putter`),pin:{...e.pin}}}var Gr=e=>e.club.id===`putter`,Kr=.25,qr=.35,Jr=.45,Yr=.2,Xr=1.7,Zr=e=>(Math.min(Math.max(e,-15),15)/15+1)*Math.PI;function Qr(e,t,n,r,i,a){let{landing:o,dir:s,ringR:c}=e,l={x:Math.sin(s),z:Math.cos(s)};if(!t)return Gr(e)?ti(e,a):ei(e,i,a);let u=`perfect`,d=0;if(n>.25*r){u=`close`;let e=(n-Kr*r)/(.75*r);d=c*Math.min(1,e)*.95}if(d===0)return{quality:u,land:{...o}};let f={x:-Math.cos(s),z:Math.sin(s)},p=Math.cos(i)*d,m=Math.sin(i)*d;return{quality:u,land:{x:o.x+l.x*p+f.x*m,z:o.z+l.z*p+f.z*m}}}function $r(e,t,n,r){let i=Math.sin(t),a=Math.cos(t),o=r.x-e.x,s=r.z-e.z,c=o*i+s*a,l=o*o+s*s-c*c,u=Xr*Xr-l;if(u<=0)return n;let d=c-Math.sqrt(u);return n>d?Math.max(0,d):n}function ei(e,t,n){let r=3+n*7,i=(t/(2*Math.PI)*2-1)*15,a=e.dir-i*zr,o=$r(e.from,a,r,e.pin);return{quality:`duff`,land:{x:e.from.x+o*Math.sin(a),z:e.from.z+o*Math.cos(a)}}}function ti(e,t){let{from:n,dir:r,carry:i}=e,a=i*(Yr+t*.2),o=(e.pin.x-n.x)*Math.sin(r)+(e.pin.z-n.z)*Math.cos(r),s=Math.min(a,Math.max(0,o-Xr));return{quality:`miss`,land:{x:n.x+s*Math.sin(r),z:n.z+s*Math.cos(r)}}}var ni={driver:.1,iron3:.08,iron5:.065,iron7:.05,wedge:.03,sand:.01,putter:0},ri={fairway:1,green:.8,rough:.3,sand:0,water:0,tree:0};function ii(e,t,n){if(Gr(t))return{...n};let r=t.carry*(ni[t.club.id]??0)*ri[Nr(e,n.x,n.z)],i=Math.sin(t.dir),a=Math.cos(t.dir),o={...n};for(let t=0;t<r;){t=Math.min(t+.5,r),o={x:n.x+i*t,z:n.z+a*t};let s=Nr(e,o.x,o.z);if(s===`sand`||s===`water`)break}return o}function ai(e,t){let n=jr(e,t.z);return{x:Math.min(Math.max(t.x,n-60),n+60),z:Math.max(t.z,-10)}}function oi(e,t,n){let{from:r,landing:i}=e,a=Math.min(Math.max(n,0),1);if(Gr(e))return{x:r.x+(t.land.x-r.x)*a,h:0,z:r.z+(t.land.z-r.z)*a};if(t.quality===`duff`){let e=Math.min(a/Jr,1);return{x:r.x+(t.land.x-r.x)*a,h:4*qr*e*(1-e),z:r.z+(t.land.z-r.z)*a}}let o={x:t.land.x-i.x,z:t.land.z-i.z};return{x:r.x+(i.x-r.x)*a+o.x*a*a,h:4*e.club.apex*e.carry*a*(1-a),z:r.z+(i.z-r.z)*a+o.z*a*a}}function si(e,t,n){if(Gr(t)||e.trees.length===0)return null;let r=e.trees.filter(e=>Math.hypot(t.from.x-e.x,t.from.z-e.z)>e.r),i=Math.hypot(n.land.x-t.from.x,n.land.z-t.from.z),a=Math.max(Math.ceil(i),1);for(let e=1;e<=a;e++){let i=e/a,o=oi(t,n,i);if(!(o.h>=12)&&r.some(e=>Math.hypot(o.x-e.x,o.z-e.z)<=e.r))return{t:i,at:{x:o.x,z:o.z}}}return null}function ci(e,t,n){let r=t.x-n.x,i=t.z-n.z,a=Math.hypot(r,i),o={...t};if(a>0)for(let t=1;t<=200;t++){let s=Math.min(t*2,a),c={x:n.x+r/a*s,z:n.z+i/a*s};if(Nr(e,c.x,c.z)!==`water`){o=c;break}if(s>=a)break}return o}function li(e,t,n){let r=ai(e,n.land),i=si(e,t,{...n,land:r});if(i)return{kind:`rest`,land:i.at,at:i.at,surface:`rough`,tree:i.t};if(Nr(e,r.x,r.z)===`water`)return{kind:`water`,land:r,splash:r,drop:ci(e,t.from,r)};let a=Gr(t)||n.quality===`duff`?r:ai(e,ii(e,t,r));if(Math.hypot(a.x-e.pin.x,a.z-e.pin.z)<=1.2)return{kind:`holed`,land:r};let o=Nr(e,a.x,a.z);return o===`water`?{kind:`water`,land:r,splash:a,drop:ci(e,t.from,a)}:{kind:`rest`,land:r,at:a,surface:o}}var ui=(e,t)=>li(e,t,{quality:`perfect`,land:t.landing}),di=40,fi=1e4;function pi(e,t){if(t.kind===`holed`)return-1;let n=t.kind===`water`?t.splash:t.at,r=Math.hypot(n.x-e.pin.x,n.z-e.pin.z);return t.kind===`rest`&&t.tree===void 0&&(t.surface===`fairway`||t.surface===`green`)?r:fi+r}function mi(e,t,n){if(n===`green`)return Ur(e,t,n,e.pin);let r=Br(n),i=Math.hypot(e.pin.x-t.x,e.pin.z-t.z),a=Math.atan2(e.pin.x-t.x,e.pin.z-t.z),o=[e.pin];for(let e=Math.max(10,i-di);e<=Math.min(i,r);e+=1)o.push({x:t.x+e*Math.sin(a),z:t.z+e*Math.cos(a)});for(let n=0;n<=e.length;n+=5){let i={x:jr(e,n),z:n},a=Math.hypot(i.x-t.x,i.z-t.z);a>=.5*r&&a<=r&&o.push(i)}let s=Ur(e,t,n,e.pin),c=1/0,l=1/0;for(let r of o){let i=Wr(e,t,n,r),a=pi(e,ui(e,i));(a<c||a===c&&i.carry<l)&&(s=i.landing,c=a,l=i.carry)}return s}var hi=.047,gi=.05,_i=12,vi={grass:5212730,sand:15257487},yi=.5,bi=360;function xi(){let e=document.createElement(`canvas`);e.width=128,e.height=64;let t=e.getContext(`2d`);if(!t)return null;t.fillStyle=`#ffffff`,t.fillRect(0,0,128,64),t.fillStyle=`#b9c3cf`;for(let e=0;e<8;e++)for(let n=0;n<16;n++)t.beginPath(),t.arc(n*8+e%2*4+2,e*8+4,1.8,0,Math.PI*2),t.fill();return new ue(e)}var Si=.6,Ci=new Y;function wi(e=1){let t=new M,n=new X(new pt(hi,20,14),new x({color:16777215,roughness:.35,map:xi()})),r=null;t.add(n);let i=new X(new I(hi*1.1,16),new B({color:0,transparent:!0,opacity:.35,depthWrite:!1}));i.rotation.x=-Math.PI/2,i.renderOrder=4,t.add(i);let a=new X(new F(.014,.004,gi,8),new x({color:15854294,roughness:.6}));a.position.y=gi/2,a.visible=!1,t.add(a);let o=hi,s=new X(new be(.35,.4,36),new B({color:16777215,transparent:!0,opacity:.7,side:2,depthTest:!1,depthWrite:!1}));s.material.color.multiplyScalar(e),s.rotation.x=-Math.PI/2,s.position.y=.04,s.renderOrder=8,t.add(s);let c=document.createElement(`canvas`);c.width=c.height=64;let l=c.getContext(`2d`);if(l){let e=l.createRadialGradient(32,32,0,32,32,32);e.addColorStop(0,`rgba(255,255,255,0.95)`),e.addColorStop(.35,`rgba(255,255,255,0.45)`),e.addColorStop(1,`rgba(255,255,255,0)`),l.fillStyle=e,l.fillRect(0,0,64,64)}let u=new Xe(new yt({map:new ue(c),transparent:!0,depthTest:!1,depthWrite:!1,sizeAttenuation:!1}));u.scale.setScalar(.035),u.renderOrder=9,u.visible=!1,t.add(u);let d=!0,f=!1,p=new ce(.03,.03,.03),m=new B({color:vi.grass}),h=Array.from({length:_i},()=>{let e=new X(p,m);return e.visible=!1,e}),g=h.map(()=>({x:0,y:0,z:0})),_=-1,v={x:0,y:0,z:0},y=new X(new be(.85,1,28),new B({color:16777215,transparent:!0,opacity:.8,side:2,depthWrite:!1}));y.material.color.multiplyScalar(e),y.rotation.x=-Math.PI/2,y.visible=!1,y.renderOrder=5;let b=new wr;b.setPositions(new Float32Array(bi*3));let S=new ir({color:16730652,linewidth:3,toneMapped:!1,transparent:!0});S.color.multiplyScalar(e>1?4:1);let C=new Tr(b,S);C.frustumCulled=!1,C.visible=!1,C.renderOrder=6;let w=b.getAttribute(`instanceStart`).data,T=[],E=-1;return{object:t,trail(e,n,r=0){if(n&&n.y-r>.127&&E<0&&T.length<bi&&T.push({...n}),T.length<2){C.visible=!1;return}C.parent||t.parent?.add(C);let i=w.array;for(let e=0;e<T.length-1;e++){let t=T[e],n=T[e+1];i.set([t.x,t.y,t.z,n.x,n.y,n.z],e*6)}w.needsUpdate=!0,b.instanceCount=T.length-1,C.visible=!0;let a=E<0?0:e-E-1;S.opacity=Math.min(Math.max(1-a/yi,0),1),a>=.5&&(C.visible=!1,T.length=0,E=-1)},endTrail(e){T.length>1&&(E=e)},clearTrail(){T.length=0,E=-1,C.visible=!1},setResolution(e,t){S.resolution.set(e,t)},place(e,s,c=0){if(s!==void 0){let e=s===`tee`;a.visible=e,o=e?.097:hi}if(r){let t=e.x-r.x,i=e.z-r.z,a=Math.hypot(t,i);a>1e-6&&a<Si&&(Ci.set(i,0,-t).normalize(),n.rotateOnWorldAxis(Ci,a/hi))}r={x:e.x,z:e.z},t.position.set(e.x,c,e.z);let l=e.y-c;n.position.y=Math.max(l,o),i.position.y=.012;let d=1/(1+Math.max(l-hi,0)*.08);i.scale.setScalar(d),f=l>o+.02,u.position.y=n.position.y},sink(e,r){t.position.set(e.x,0,e.z),a.visible=!1,n.position.y=hi+-.16699999999999998*Math.min(Math.max(r,0),1),u.visible=!1,i.visible=r<.2},setAddress(e){d=e},puff(e,n,r,i=0){e!==`none`&&(m.color.setHex(vi[e]),_=r,v={x:n.x,y:n.y??0,z:n.z},h[0].parent||h.forEach(e=>t.parent?.add(e)),h.forEach((e,t)=>{let r=(t%4-1.5)*.35,a=1.2+t%3*.5;g[t]={x:Math.sin(i+r)*a,y:1.4+t%5*.35,z:Math.cos(i+r)*a},e.visible=!0,e.position.set(n.x,v.y+.03,n.z)}))},update(e){i.visible=!0;let r=.675+.225*Math.sin(e*2*Math.PI*1.2);if(s.material.opacity=r,s.visible=t.visible&&d&&!f,u.visible=t.visible&&!d&&n.position.y>-.05,u.material.opacity=.85,_>=0){let t=e-_;h.forEach((e,n)=>{if(t>.6||t<0){e.visible=!1;return}let r=g[n];e.position.set(v.x+r.x*t,v.y+Math.max(.03+r.y*t-4.9*t*t,.02),v.z+r.z*t)}),t>.6&&(_=-1)}},setVisible(e){t.visible=e},splash(e,n=0){e?(y.parent||t.parent?.add(y),y.visible=n<1.2,y.position.set(e.x,.2,e.z),y.scale.setScalar(.5+n*4),y.material.opacity=Math.max(0,.8-n*.7)):y.visible=!1}}}function Ti(e,t){let n=Math.hypot(t.land.x-e.from.x,t.land.z-e.from.z);return Gr(e)?Math.max(n/8,.4):t.quality===`duff`?.5+n/12:.9+e.carry/120}function Ei(e,t,n){let r=oi(e,t,n);return{x:r.x,y:hi+r.h,z:r.z}}var Di={driver:.04,iron3:.035,iron5:.03,iron7:.025,wedge:.012,sand:0,putter:0},Oi={fairway:1,green:.7,rough:.25,sand:0,water:0,tree:0},ki=.3,Ai=1.2,ji=30,Mi=.55,Ni=1.5,Pi=.03;function Fi(e,t,n,r,i=()=>0){let a=Ii(e,t,n,r);return{...a,at(e){let t=a.at(e);return{...t,y:t.y+i(t.x,t.z)}}}}function Ii(e,t,n,r){let{from:i}=e,{land:a}=t,o=n.kind===`holed`?r:n.kind===`water`?n.splash:n.at,s=n.kind===`holed`?`green`:n.kind===`rest`?n.surface:`water`;if(Gr(e)){let n=Ti(e,{...t,land:o});return{seconds:n,airSeconds:0,roll:Math.hypot(o.x-i.x,o.z-i.z),at(e){let t=Math.min(Math.max(e/n,0),1),r=1-(1-t)*(1-t);return{x:i.x+(o.x-i.x)*r,y:hi,z:i.z+(o.z-i.z)*r}}}}if(t.quality===`duff`)return Bi(e,o);let c=Ti(e,t),l=Math.hypot(o.x-a.x,o.z-a.z),u=()=>({seconds:c,airSeconds:c,roll:0,at:n=>Ei(e,t,Math.min(Math.max(n/c,0),1))});if(l<1e-6)return u();let d=(o.x-a.x)/l,f=(o.z-a.z)/l,p=Math.hypot(a.x-i.x,a.z-i.z)/c,m=Math.max(ki*p,2*l/Ai),h=2*l/m,g=e.club.id,_=e.club.apex*e.carry,v=Math.min(_*(Di[g]??0)*Oi[s],Ni),y=[];if(v>=Pi){let e=0;for(let t=0;t<6;t++){let n=v*Mi**(2*t),r=2*Math.sqrt(2*v/ji)*Mi**t;if(n<Pi||e+r>h*.75)break;y.push({start:e,seconds:r,height:n}),e+=r}}return{seconds:c+h,airSeconds:c,roll:l,at(n){if(n<=c)return Ei(e,t,Math.min(Math.max(n/c,0),1));let r=Math.min(n-c,h),i=m*r-m/h*(r*r/2),o=0;for(let e of y)if(r>=e.start&&r<e.start+e.seconds){let t=(r-e.start)/e.seconds;o=e.height*4*t*(1-t)}return{x:a.x+d*i,y:hi+o,z:a.z+f*i}}}}var Li=.08,Ri=Jr+.05,zi=Jr+.3;function Bi(e,t){let{from:n}=e,r=.5+Math.hypot(t.x-n.x,t.z-n.z)/12;return{seconds:r,airSeconds:r*Jr,roll:0,at(e){let i=Math.min(Math.max(e/r,0),1),a=1-(1-i)*(1-i),o=0;if(a<.45){let e=a/Jr;o=4*qr*e*(1-e)}else if(a>Ri&&a<zi){let e=(a-Ri)/(zi-Ri);o=4*Li*e*(1-e)}return{x:n.x+(t.x-n.x)*a,y:hi+o,z:n.z+(t.z-n.z)*a}}}}function Vi(e){return{strokes:0,penalties:0,lie:`tee`,at:{x:jr(e,0),z:0},holed:!1}}function Hi(e,t,n){let r={...e,strokes:e.strokes+1};return n.kind===`holed`?(r.holed=!0,r.at={...t.pin},r.lie=`green`):n.kind===`water`?(r.penalties=e.penalties+1,r.at={...n.drop},r.lie=Nr(t,n.drop.x,n.drop.z)):(r.at={...n.at},r.lie=n.surface),r}function Ui(e){return Math.min(e.strokes+e.penalties,7)}function Wi(e){return e.holed||e.strokes+e.penalties>=7}function Gi(e,t){let n=0;return e.forEach((e,r)=>n+=e-t[r]),n}function Ki(e,t,n){if(!n)return`Pick up`;if(e===1)return`Hole in one`;let r=e-t;return r<=-3?`Albatross`:r===-2?`Eagle`:r===-1?`Birdie`:r===0?`Par`:r===1?`Bogey`:r===2?`Double bogey`:r===3?`Triple bogey`:`+${r}`}function qi(e){return e===0?`E`:e>0?`+${e}`:`-${-e}`}var Ji=qi,Yi=e=>e<0?`under`:e>0?`over`:`even`,Xi=e=>100-e,Zi=e=>100-e;function Qi(e,t){return t===0?`You shot ${e}, level with par.`:`You shot ${e}, ${Math.abs(t)} ${t>0?`over`:`under`} par.`}var $i={fairway:`Fairway!`,rough:`In the rough.`,sand:`Bunker.`,green:`On the green!`,water:`Splash!`,holed:`In the hole!`,puttGood:`Nice putt.`,puttMiss:`Missed it.`,duff:`Duffed it.`},ea=e=>$i[e];function ta(e,t,n){return e.kind===`holed`?`holed`:n?t===`miss`?`puttMiss`:`puttGood`:e.kind===`water`?`water`:t===`duff`?`duff`:e.surface===`tree`?`rough`:e.surface}function na(e){return e.kind===`holed`?`In the hole`:e.kind===`water`?`Water +1`:e.tree===void 0?{fairway:`Fairway`,rough:`Rough`,sand:`Sand`,green:`Green`,water:`Water +1`,tree:`Rough`}[e.surface]:`Hit a tree`}function ra(e,t,n={}){return e.kind===`water`||n.quality===`miss`||n.quality===`duff`?`groan`:t?t===`Par`?e.kind===`holed`?`cheer`:`idle`:[`Bogey`,`Double bogey`,`Triple bogey`,`Pick up`].includes(t)||/^\+/.test(t)?`groan`:`cheer`:e.kind===`holed`||e.surface===`green`&&!n.putt?`cheer`:`idle`}var ia={"Hole in one":`Hole in one!`,Albatross:`Albatross!`,Eagle:`Eagle!`,Birdie:`Birdie!`,Par:`Par.`,Bogey:`Bogey.`,"Double bogey":`Double bogey.`,"Triple bogey":`Triple bogey.`,"Pick up":`Pick up.`},aa=`Over par.`,oa=e=>ia[e]??aa,sa=[`one`,`two`,`three`,`four`,`five`,`six`,`seven`,`eight`,`nine`];function ca(e){return`Hole ${sa[e]}, par ${sa[Ar[e].par-1]}.`}var la=`Last hole.`,ua=`Round over.`,da=`New best!`;function fa(){return{hole:0,scores:[]}}function pa(e){return Vi(e)}function ma(e,t){return null}function ha(){return null}function ga(){return null}function _a(){return!1}function va(){return!1}function ya(){return null}function ba(e,t){return e}function xa(){return!1}function Sa(){return!1}function Ca(){return null}function wa(){return null}function Ta(){return!0}function Ea(){return null}function Da(){return!1}var Oa={hipY:.99,thigh:.47,shin:.45,hipX:.09,shoulderY:.62,shoulderX:.25,upperArm:.36,forearm:.3,hand:.03,headY:.78,headR:.145},ka=(e=0,t=0,n=0)=>({raise:e,out:t,bend:n});function Aa(){return{lift:0,lean:0,twist:0,hips:0,slide:0,headPitch:0,headYaw:0,roll:0,footL:0,footR:0,armL:ka(),armR:ka(),legL:ka(),legR:ka()}}function ja(e){e.lift=e.lean=e.twist=e.headPitch=e.headYaw=e.roll=0,e.hips=e.slide=e.footL=e.footR=0;for(let t of[e.armL,e.armR,e.legL,e.legR])t.raise=t.out=t.bend=0;return e}function Ma(e){let{thigh:t,shin:n}=Oa,r=e*n/(t+n);return t+n-(t*Math.cos(r)+n*Math.cos(e-r))}var Na=e=>e*Oa.shin/(Oa.thigh+Oa.shin);function Pa(e,t){let{hipY:n,thigh:r,shin:i}=Oa,a=n+e-.07*Math.cos(t)-.2*Math.sin(t),o=0,s=2;for(let e=0;e<30;e++){let e=(o+s)/2,t=Na(e);r*Math.cos(t)+i*Math.cos(e-t)>a?o=e:s=e}return(o+s)/2}function Q(e,t,n,r=0,i=0,a=0){let o=new X(e,t);return o.position.set(r,i,a),n.add(o),o}function Fa(e,t,n,r=0){let i=new M;return i.position.set(t,n,r),e.add(i),i}var Ia=new x({color:1776420,roughness:.3}),La=new x({color:16777215,roughness:.3}),Ra=new x({color:15893370,roughness:.8}),za=new x({color:9054762,roughness:.6}),Ba=new B({color:0,transparent:!0,opacity:.28,depthWrite:!1}),Va=new Y(1,0,0),Ha=new Y(0,1,0),Ua=new H,Wa=new H;function Ga(e){let{thigh:t,shin:n,hipX:r,shoulderX:i,shoulderY:a,headY:o,headR:s}=Oa,c=Oa.upperArm*(e.armLength??1),l=Oa.forearm*(e.armLength??1),u=new x({color:e.shirt,roughness:.7}),d=new x({color:e.pants,roughness:.8}),f=new x({color:e.skin??15840394,roughness:.75}),p=new x({color:e.hair??5911574,roughness:.9}),m=new x({color:e.hatColor??e.pants,roughness:.55}),h=new x({color:e.shoe??16053492,roughness:.6}),g=new x({color:16777215,roughness:.7}),_=new x({color:1908002,roughness:.6}),v=e.glove===void 0?f:new x({color:e.glove}),y=new M,b=Fa(y,0,0),C=Fa(b,0,Oa.hipY);C.rotation.order=`YXZ`;let w=i=>{let a=Fa(C,i*r,0);a.rotation.order=`YXZ`;let o=Fa(a,0,-t),s=Fa(o,0,-n);return s.rotation.order=`YXZ`,e.trousers?(Q(new S(.1,t-.2,4,12),d,a,0,-t/2),Q(new S(.08,n-.16,4,12),d,o,0,-n/2+.01)):(Q(new S(.094,t-.188,4,12),f,a,0,-t/2),Q(new S(.112,.12,4,12),d,a,0,-.12),Q(new S(.074,n-.148,4,12),f,o,0,-n/2+.01)),Q(new pt(.07,14,10),h,s,0,-.012,.055).scale.set(.95,.8,2.1),Q(new pt(.072,14,8),g,s,0,-.05,.055).scale.set(.97,.3,2.14),{hip:a,knee:o,ankle:s}},T=w(1),E=w(-1),D=Fa(C,0,0);Q(new S(.15,.3,6,18),u,D,0,.3).scale.set(1.5,1,.85),Q(new F(.15,.15,.2,18),d,D,0,-.04).scale.set(1.45,1,.87),e.trousers&&Q(new F(.153,.153,.035,18),_,D,0,.07).scale.set(1.45,1,.87),Q(new F(.065,.075,.1,12),f,D,0,.6);let O=Q(new J(.09,.024,6,16),u,D,0,.6,0);O.rotation.x=Math.PI/2,O.scale.set(1,1,1.4),Q(new ce(.035,.12,.012),u,D,0,.5,.13);let k=Fa(D,0,o);k.rotation.order=`YXZ`,Q(new pt(s,28,20),f,k).scale.set(1.06,1.02,1);let A=s*.9;for(let e of[-1,1]){let t=e*.052;Q(new pt(.034,12,10),La,k,t,.012,A).scale.set(1,1.15,.5),Q(new pt(.021,10,8),Ia,k,t,.008,A+.012).scale.set(1,1.15,.5),Q(new pt(.007,6,5),La,k,t+e*.004,.02,A+.02);let n=Q(new ce(.05,.012,.012),p,k,t,.058,A+.005);n.rotation.z=e*-.18,Q(new pt(.028,8,6),Ra,k,e*.09,-.03,.105).scale.set(1,.8,.35),Q(new pt(.03,8,6),f,k,s*1.05*e,-.005,-.004).scale.set(.45,1,.8)}Q(new pt(.022,10,8),f,k,0,-.022,s*.98);let j=Q(new J(.04,.0055,6,14,Math.PI),za,k);j.position.set(0,-.032,s*.9),j.rotation.z=Math.PI;let ee=Fa(k,0,0),N=e.hat??`headband`,te=Q(new pt(s+.006,28,16,0,Math.PI*2,0,1.6),p,ee,0,.004,-.006);if(te.scale.set(1.06,1.02,1),te.rotation.x=-.4,N===`headband`){let e=Q(new J(s+.004,.02,8,32),m,ee,0,.085,0);e.rotation.x=Math.PI/2}else if(N===`cap`){Q(new pt(s+.016,28,14,0,Math.PI*2,0,1.08),m,ee,0,.004,-.004).scale.set(1.06,1.02,1);let e=Q(new F(.095,.095,.01,16,1,!1,-Math.PI/2,Math.PI),m,ee,0,.082,s*.86);e.rotation.x=.12}let P=e=>{let t=Fa(D,e*i,a);t.rotation.order=`YXZ`,Q(new pt(.078,12,8),u,t),Q(new S(.058,c-.116,4,10),f,t,0,-c/2),Q(new S(.075,.1,4,10),u,t,0,-.12);let n=Fa(t,0,-c);Q(new S(.052,l-.104,4,10),f,n,0,-l/2);let r=Fa(n,0,-l-Oa.hand);return Q(new pt(.058,12,8),e>0?v:f,r).scale.set(.85,1.1,.85),Q(new pt(.026,8,6),e>0?v:f,r,e*-.026,.01,.04),{shoulder:t,elbow:n,hand:r}},ne=P(1),re=P(-1),ie=new Tt().setFromObject(y),L=(e.height??2)/(ie.max.y-ie.min.y);y.scale.setScalar(L);let R=Q(new I(.4,20),Ba,y);R.rotation.x=-Math.PI/2,R.position.y=.012,R.name=`blob`;let ae=t+n,z=e=>{b.position.y=e.lift,b.rotation.z=-e.roll,C.position.x=e.slide,C.rotation.y=e.hips,D.quaternion.copy(Ua.setFromAxisAngle(Ha,-e.hips)).multiply(Wa.setFromAxisAngle(Va,e.lean)).multiply(Ua.setFromAxisAngle(Ha,e.hips+e.twist)),k.rotation.set(-e.headPitch,e.headYaw,0);for(let[t,n,r]of[[ne,e.armL,1],[re,e.armR,-1]])t.shoulder.rotation.set(-n.raise,0,r*n.out),t.elbow.rotation.set(-n.bend,0,0);for(let[t,n,r,i]of[[T,e.legL,1,e.footL],[E,e.legR,-1,e.footR]]){let a=r*n.out-e.slide/ae;t.hip.rotation.set(-n.raise,-e.hips,a),t.knee.rotation.set(n.bend,0,0),t.ankle.rotation.set(n.raise-n.bend+i,r>0?.35:-.15,-a)}};return z(Aa()),{root:y,scale:L,body:b,pelvis:C,torso:D,head:k,hat:ee,shoulderL:ne.shoulder,shoulderR:re.shoulder,elbowL:ne.elbow,elbowR:re.elbow,handL:ne.hand,handR:re.hand,legs:{L:T,R:E},materials:{shirt:u,hat:m,pants:d},apply:z,recolour(e,t){u.color.setHex(e),m.color.setHex(t),d.color.setHex(t)},handWorld(e,t){return y.updateMatrixWorld(!0),(e===`L`?ne.hand:re.hand).getWorldPosition(t)}}}var Ka=e=>e<.5?2*e*e:1-(-2*e+2)**2/2,qa=(e,t,n)=>e+(t-e)*n;function Ja(e,t){t.raise=e.raise,t.out=e.out,t.bend=e.bend}function Ya(e,t){return t.lift=e.lift,t.lean=e.lean,t.twist=e.twist,t.hips=e.hips,t.slide=e.slide,t.footL=e.footL,t.footR=e.footR,t.headPitch=e.headPitch,t.headYaw=e.headYaw,t.roll=e.roll,Ja(e.armL,t.armL),Ja(e.armR,t.armR),Ja(e.legL,t.legL),Ja(e.legR,t.legR),t}function Xa(e,t,n,r){r.raise=qa(e.raise,t.raise,n),r.out=qa(e.out,t.out,n),r.bend=qa(e.bend,t.bend,n)}function Za(e,t,n,r){return r.lift=qa(e.lift,t.lift,n),r.lean=qa(e.lean,t.lean,n),r.twist=qa(e.twist,t.twist,n),r.hips=qa(e.hips,t.hips,n),r.slide=qa(e.slide,t.slide,n),r.footL=qa(e.footL,t.footL,n),r.footR=qa(e.footR,t.footR,n),r.headPitch=qa(e.headPitch,t.headPitch,n),r.headYaw=qa(e.headYaw,t.headYaw,n),r.roll=qa(e.roll,t.roll,n),Xa(e.armL,t.armL,n,r.armL),Xa(e.armR,t.armR,n,r.armR),Xa(e.legL,t.legL,n,r.legL),Xa(e.legR,t.legR,n,r.legR),r}function Qa(e){let t=Aa(),n=Aa(),r=Aa(),i=1,a=.2;return{transition(e=.2){Ya(t,n),i=0,a=Math.max(e,.001)},step(o,s){s(ja(r)),i=Math.min(1,i+o/a),Za(n,r,Ka(i),t),e.apply(t)}}}var $a=.008,eo=9,to=(e,t,n)=>{let r=Math.min(Math.max((n-e)/(t-e),0),1);return r*r*(3-2*r)},no=.129;function ro(e,t,n,r){let i=e.getAttribute(`skinIndex`),a=e.getAttribute(`skinWeight`),o=e.getAttribute(`position`),s=new Float32Array(o.count*4),c=new Y,l=new Y,u=Math.abs(n.get(`upperarm_l`)?.x??no),d=.1/no*u,f=.16/no*u;for(let e=0;e<o.count;e++){let u=0,p=0,m=0,h=0;l.fromBufferAttribute(o,e);for(let o=0;o<4;o++){let s=a.getComponent(e,o);if(s<=0)continue;let g=t[i.getComponent(e,o)].name;if(/^(spine_0[123]|clavicle_[lr])$/.test(g))u+=s,r===`bib`&&/^spine_0[23]$/.test(g)&&(h+=s*(1-to(d,f,Math.abs(l.x))));else if(/^upperarm_[lr]$/.test(g)){let e=n.get(g),t=n.get(g.replace(`upperarm`,`lowerarm`)),r=0;e&&t&&(c.subVectors(t,e),r=l.sub(e).dot(c)/c.lengthSq()),u+=s*(1-to(.4,.6,r))}else/^(pelvis|thigh_[lr]|calf_[lr])$/.test(g)?p+=s:/^(foot|ball|ball_leaf)_[lr]$/.test(g)?m+=s:r===`glove`&&/^(hand|index_\d\d|middle_\d\d|ring_\d\d|pinky_\d\d|thumb_\d\d)(_leaf)?_l$/.test(g)&&(h+=s)}s.set([u,p,m,h],e*4)}return new V(s,4)}function io(e,t,n,r){let i=e.clone();i.normalScale.multiplyScalar(.5);let a={uShirt:{value:new m(t.shirt)},uTrousers:{value:new m(t.trousers)},uShoes:{value:new m(t.shoes)},uAccent:{value:new m(t.accent)},uAccentOn:{value:+!!t.accentOn},uWeave:{value:n},uWeaveOn:{value:+!!n},uPush:{value:r},uBib:{value:+!!t.bib}};i.userData.cloth=a;let o=ze.normal_fragment_maps.replace(`mapN.xy *= normalScale;`,`mapN.xy *= normalScale * (1.0 - 0.8 * gCloth);
	{
		vec2 weave = texture2D( uWeave, vNormalMapUv * ${eo}.0 ).xy * 2.0 - 1.0;
		mapN.xy += weave * 0.9 * gCloth * uWeaveOn;
	}`);return i.onBeforeCompile=e=>{Object.assign(e.uniforms,a),e.vertexShader=e.vertexShader.replace(`void main() {`,`attribute vec4 aRegion;
varying vec4 vRegion;
uniform float uPush;
uniform float uBib;
void main() {`).replace(`#include <beginnormal_vertex>`,`#include <beginnormal_vertex>
	float bibW = smoothstep( 0.35, 0.65, aRegion.w ) * uBib;
	vec3 origNormal = objectNormal;
	vec3 flatN = normalize( vec3( objectNormal.x * 0.35, objectNormal.y * 0.2, objectNormal.z >= 0.0 ? 1.0 : -1.0 ) );
	objectNormal = normalize( mix( objectNormal, flatN, 0.9 * bibW ) );`).replace(`#include <begin_vertex>`,`#include <begin_vertex>
	vRegion = aRegion;
	float cloth = max( smoothstep( 0.35, 0.65, aRegion.x ), 3.5 * smoothstep( 0.35, 0.65, aRegion.y ) );
	vec3 nrm = normalize( origNormal );
	transformed += normalize( mix( nrm, flatN, bibW ) ) * uPush * max( cloth, bibW * 5.0 );
	// Hang it like a tabard: the bust is smoothed towards a plane in front, and one behind.
	float plane = nrm.z >= 0.0 ? 0.1 : -0.08;
	transformed.z = mix( transformed.z, plane, 0.85 * bibW );`),e.fragmentShader=e.fragmentShader.replace(`void main() {`,`varying vec4 vRegion;
uniform vec3 uShirt;
uniform vec3 uTrousers;
uniform vec3 uShoes;
uniform vec3 uAccent;
uniform float uAccentOn;
uniform sampler2D uWeave;
uniform float uWeaveOn;
float gCloth = 0.0;
float gShoe = 0.0;
void main() {`).replace(`#include <map_fragment>`,`#include <map_fragment>
	{
		float mS = smoothstep( 0.4, 0.6, vRegion.x );
		float mT = smoothstep( 0.4, 0.6, vRegion.y );
		float mH = smoothstep( 0.4, 0.6, vRegion.z );
		float mA = smoothstep( 0.4, 0.6, vRegion.w ) * uAccentOn;
		vec3 c = diffuseColor.rgb;
		c = mix( c, uShirt, mS );
		c = mix( c, uTrousers, mT );
		c = mix( c, uShoes, mH );
		c = mix( c, uAccent, mA );
		diffuseColor.rgb = c;
		gCloth = max( max( mS, mT ), mA );
		gShoe = mH;
	}`).replace(`#include <roughnessmap_fragment>`,`#include <roughnessmap_fragment>
	roughnessFactor = mix( roughnessFactor, 0.85, gCloth );
	roughnessFactor = mix( roughnessFactor, 0.5, gShoe );`).replace(`#include <normal_fragment_maps>`,o)},i.customProgramCacheKey=()=>`fore-cloth`,i}var ao=1e-6,oo=new Y,so=new Y,co=new Y,lo=new Y,uo=new Y,fo=new Y,po=new Y;function mo(e,t,n,r,i){let a=oo.subVectors(t,e).length(),o=so.subVectors(n,t).length();co.subVectors(r,e);let s=Math.min(Math.max(co.length(),Math.abs(a-o)+ao),a+o-ao);co.lengthSq()<ao&&co.set(0,0,1),co.normalize(),lo.subVectors(i,e),lo.addScaledVector(co,-lo.dot(co)),lo.lengthSq()<1e-10&&(lo.set(0,1,0).addScaledVector(co,-co.y),lo.lengthSq()<1e-10&&lo.set(1,0,0).addScaledVector(co,-co.x)),lo.normalize();let c=(a*a-o*o+s*s)/(2*s),l=Math.sqrt(Math.max(a*a-c*c,0));uo.copy(e).addScaledVector(co,c).addScaledVector(lo,l),po.copy(e).addScaledVector(co,s);let u=new H().setFromUnitVectors(oo.subVectors(t,e).normalize(),so.subVectors(uo,e).normalize());return fo.subVectors(n,e).applyQuaternion(u).add(e),[u,new H().setFromUnitVectors(oo.subVectors(fo,uo).normalize(),so.subVectors(po,uo).normalize())]}function ho(e,t){return e.clone().invert().multiply(t)}var go={chest:.88,pelvis:.94,shoulderX:.85,arm:.8,armLength:1.15,thigh:.85,calf:.9},_o={pelvis:{across:go.pelvis,along:1,next:`spine_01`},spine_01:{across:go.chest,along:1,next:`spine_02`},spine_02:{across:go.chest,along:1,next:`spine_03`},spine_03:{across:go.chest,along:1,next:`neck_01`},thigh_l:{across:go.thigh,along:1,next:`calf_l`},thigh_r:{across:go.thigh,along:1,next:`calf_r`},calf_l:{across:go.calf,along:1,next:`foot_l`},calf_r:{across:go.calf,along:1,next:`foot_r`},upperarm_l:{across:go.arm,along:go.armLength,next:`lowerarm_l`},upperarm_r:{across:go.arm,along:go.armLength,next:`lowerarm_r`},lowerarm_l:{across:go.arm,along:go.armLength,next:`hand_l`},lowerarm_r:{across:go.arm,along:go.armLength,next:`hand_r`}},vo=e=>/^(hand|index_\d\d|middle_\d\d|ring_\d\d|pinky_\d\d|thumb_\d\d)(_leaf)?_[lr]$/.test(e);function yo(e){let t=[],n=new Map;return e.traverse(e=>{let r=e;if(r.isSkinnedMesh){t.push(r);for(let e of r.skeleton.bones)n.set(e.name,e)}}),{meshes:t,bones:n}}function bo(e){e.updateMatrixWorld(!0);let{meshes:t,bones:n}=yo(e),r=e=>new Y().setFromMatrixPosition(n.get(e).matrixWorld),i=new Map,a=new Map,o=new Map,s=new Map;for(let[e,t]of Object.entries(_o)){let n=r(e),s=r(t.next).sub(n);i.set(e,n),o.set(e,s.length()),a.set(e,s.normalize())}for(let e of[`l`,`r`]){let t=`upperarm_${e}`,n=`lowerarm_${e}`,c=`hand_${e}`,l=i.get(t),u=new Y(l.x*go.shoulderX,l.y,l.z);s.set(t,u),s.set(n,u.clone().addScaledVector(a.get(t),o.get(t)*go.armLength)),s.set(c,s.get(n).clone().addScaledVector(a.get(n),o.get(n)*go.armLength)),i.set(c,r(c))}for(let[e,t]of i)s.has(e)||s.set(e,t.clone());let c=new Y,l=new Y,u=new Y,d=new Y,f=e=>e.skeleton.bones.map(e=>e.name),p=new Set;for(let e of t){let t=e.geometry;if(p.has(t))continue;p.add(t);let n=t.getAttribute(`position`),r=t.getAttribute(`skinIndex`),o=t.getAttribute(`skinWeight`),m=f(e);for(let e=0;e<n.count;e++){c.fromBufferAttribute(n,e),u.set(0,0,0);let t=0;for(let n=0;n<4;n++){let f=o.getComponent(e,n);if(f<=0)continue;let p=m[r.getComponent(e,n)],h=_o[p];if(h){let e=i.get(p),t=a.get(p);l.subVectors(c,e);let n=l.dot(t);d.copy(s.get(p)).addScaledVector(t,n*h.along),l.addScaledVector(t,-n),d.addScaledVector(l,h.across)}else if(/^clavicle_[lr]$/.test(p))d.set(c.x*go.shoulderX,c.y,c.z);else if(vo(p)){let e=p.endsWith(`_l`)?`l`:`r`;d.copy(c).add(l.subVectors(s.get(`hand_${e}`),i.get(`hand_${e}`)))}else d.copy(c);u.addScaledVector(d,f),t+=f}t>0&&n.setXYZ(e,u.x/t,u.y/t,u.z/t)}n.needsUpdate=!0,t.computeBoundingBox(),t.computeBoundingSphere()}for(let e of[`l`,`r`]){let t=n.get(`upperarm_${e}`),r=t.parent;r.updateWorldMatrix(!0,!1),t.position.copy(r.worldToLocal(s.get(`upperarm_${e}`).clone()));for(let t of[`lowerarm_${e}`,`hand_${e}`])n.get(t).position.multiplyScalar(go.armLength)}e.updateMatrixWorld(!0);for(let e of new Set(t.map(e=>e.skeleton)))e.calculateInverses()}var xo={shirt:2043727,trousers:13220244,shoes:15921906,accent:16777215,accentOn:!0},So={shirt:2062925,trousers:3948876,shoes:4865843,accent:2062925,accentOn:!1},Co=.045,wo=.06,To=.7,Eo=.07,Do=.12,Oo=[.6,.9],ko=.07,Ao=new WeakMap;function jo(e,t){let n=Ao.get(e.scene),r=n?.get(t);if(r)return r;n||(n=new Map,Ao.set(e.scene,n));let i=n.values().next().value,a;i?(a=Qt(i.scene),a.traverse(e=>{let t=e;t.isSkinnedMesh&&(t.geometry=t.geometry.clone())}),a.updateMatrixWorld(!0)):(a=e.scene,a.updateMatrixWorld(!0),bo(a));let{meshes:o,bones:s}=yo(a),c=new Map;for(let[e,t]of s)c.set(e,new Y().setFromMatrixPosition(t.matrixWorld));let l=null;for(let e of o){e.frustumCulled=!1;let n=e.material;/Superhero/i.test(n.name)&&(e.geometry.setAttribute(`aRegion`,ro(e.geometry,e.skeleton.bones,c,t)),e.geometry.computeBoundingBox(),l=e.geometry.boundingBox)}let u=l?l.max.y-l.min.y+Co:1.85,d={scene:a,standing:u,accent:t};return n.set(t,d),d}var Mo=new Y(0,1,0),No=new Y(0,0,1),Po=new H(0,0,1,0),Fo=[[`index`,1.1],[`middle`,1.2],[`ring`,1.2],[`pinky`,1.2]],Io=new Y,Lo=new Y,Ro=new Y,zo=new Y,Bo=new H,Vo=new H,Ho=new H;function Uo(e,t){let n=e.parent;n.updateWorldMatrix(!0,!1),n.getWorldQuaternion(Ho).invert(),e.quaternion.copy(Ho).multiply(t),e.updateWorldMatrix(!1,!1)}function Wo(e,t,n,r){let i=jo(e,t.accent),a=new M,o=Qt(i.scene);a.add(o),n.add(a);let s=t.height/i.standing/r;a.scale.setScalar(s),n.updateMatrixWorld(!0);let{meshes:c,bones:l}=yo(o),u=e=>l.get(e),d=[],f=e=>(d.push(e),e);for(let e of c){let n=e.material;if(/Superhero/i.test(n.name)){let r=f(io(n,t.outfit,t.weave,$a/s));t.skin!==void 0&&r.color.setHex(t.skin),e.material=r}else t.face?e.material=f(n.clone()):e.visible=!1}let p=u(`Head`),m=[],h=[];for(let e of t.hair){let n=t.hairSource?.scene.getObjectByName(e.style);if(!n)continue;let r=f(n.material.clone());r.color.setHex(e.colour);let i=new X(n.geometry,r);i.frustumCulled=!1,p.add(i),h.push(i)}if(t.cap!==null){let e=f(new x({color:t.cap,roughness:.7})),n=new pt(1,24,12,0,Math.PI*2,0,1.39),r=new X(n,e);r.scale.set(.098,.148,.11),r.position.set(0,.1,-.003);let i=f(new x({color:2763310,roughness:.8})),a=new X(new F(.075,.075,.004,16,1,!1,0,Math.PI),[e,e,i]);a.position.set(0,.123,.088),a.rotation.set(.25,-Math.PI/2,0),a.scale.set(1,1,1.3);for(let e of h)e.scale.setScalar(.82),e.position.y=.018;p.add(r,a),m.push(n,a.geometry)}return{root:a,model:o,k:s,bone:u,bones:l,owned:d,geometries:m}}function Go(e,t,n){let r=[];t.root.traverse(e=>{let t=e;t.isMesh&&t.name!==`blob`&&t.visible&&(t.visible=!1,r.push(t))});let{root:i,model:a,bone:o,bones:s,owned:c,geometries:l}=Wo(e,n,t.root,t.scale);a.updateMatrixWorld(!0);let u=(e,t=new H)=>e.getWorldQuaternion(t),d=[`pelvis`,`spine_01`,`spine_02`,`spine_03`,`neck_01`,`Head`,`foot_l`,`foot_r`],f=t.root.getWorldQuaternion(new H).invert(),p=new Map(d.map(e=>[e,ho(new H,f.clone().multiply(u(o(e))))])),m=new Map,h=new Map;for(let e of s.values())m.set(e.name,e.quaternion.clone()),h.set(e.name,e.position.clone());let g=Io.copy(o(`thigh_l`).getWorldPosition(Lo)).add(o(`thigh_r`).getWorldPosition(Ro)).multiplyScalar(.5),_=o(`pelvis`).worldToLocal(g.clone()),v=g.y,y=t.root.getWorldScale(new Y).x,b=o(`thigh_l`).getWorldPosition(new Y).distanceTo(o(`thigh_r`).getWorldPosition(new Y))/2-Oa.hipX*y,x=t.root.getWorldPosition(new Y).y,S=v-x-Oa.hipY*y,C=o(`foot_l`).getWorldPosition(new Y).y-x,w=(Oa.hipY-Oa.thigh-Oa.shin)*t.root.getWorldScale(new Y).y,T=[];for(let e of[`l`,`r`]){let t=o(`hand_${e}`).getWorldQuaternion(new H),n=No.clone().applyQuaternion(t);for(let[t,r]of Fo)for(let i=1;i<=3;i++){let a=s.get(`${t}_0${i}_${e}`);if(!a)continue;let o=n.clone().applyQuaternion(a.getWorldQuaternion(Bo).invert());T.push({bone:a,axis:o,amount:r/1.2,left:e===`l`})}}let E=new H,D=new H,O=new H,k=new Y,A=new Y,j=new Y,ee=new Y,M=new Y,N=new Y,te=new Y,P=new Y,ne=new Y,re=new Y,F=new H,ie=new H,I=new H,L=new De,R=new Y,ae=1,z={L:0,R:0,shift:0},oe=new Y,se=new Y,ce=new Y,le=new Y,B=new H,ue=(e,n)=>{E.copy(t.pelvis.getWorldQuaternion(D)),t.torso.getWorldQuaternion(O),E.slerp(O,n),O.copy(E).multiply(p.get(e.name)),Uo(e,O)},de=(e,t,n,r,i,a=0)=>{if(e.quaternion.copy(m.get(e.name)),t.quaternion.copy(m.get(t.name)),e.position.copy(h.get(e.name)),e.updateWorldMatrix(!0,!0),e.getWorldPosition(k),t.getWorldPosition(A),n.getWorldPosition(j),a>0){let i=k.distanceTo(A)+A.distanceTo(j),o=k.distanceTo(r)-i*.995;if(o>0){let i=Math.min(o,a*ae);z[e.name.endsWith(`_l`)?`L`:`R`]=i/ae,Io.subVectors(r,k).normalize().multiplyScalar(i),k.add(Io),e.parent.updateWorldMatrix(!0,!1),e.position.copy(e.parent.worldToLocal(k.clone())),e.updateWorldMatrix(!0,!0),t.getWorldPosition(A),n.getWorldPosition(j)}}let[o,s]=mo(k,A,j,r,i);e.getWorldQuaternion(Bo),t.getWorldQuaternion(Vo),Uo(e,E.copy(o).multiply(Bo)),Uo(t,D.copy(s).multiply(o).multiply(Vo))},fe=(e,t)=>{let n=o(e===`L`?`hand_l`:`hand_r`);n.updateWorldMatrix(!0,!1),n.getWorldPosition(t);let r=Ro.set(0,1,0).applyQuaternion(n.getWorldQuaternion(Bo));return i.getWorldScale(R),t.addScaledVector(r,wo*R.x)};return{root:i,update:(e=null,n=0)=>{t.root.updateMatrixWorld(!0),t.root.getWorldQuaternion(B),z.L=z.R=0,oe.set(0,0,0),i.getWorldScale(R),ae=R.x;let r=o(`pelvis`);t.pelvis.getWorldQuaternion(E),O.copy(E).multiply(p.get(`pelvis`)),Uo(r,O),t.pelvis.getWorldPosition(Io),Io.y+=S,Lo.copy(_).multiplyScalar(ae).applyQuaternion(O),Io.sub(Lo),r.parent.updateWorldMatrix(!0,!1),r.position.copy(r.parent.worldToLocal(Io)),r.updateWorldMatrix(!1,!1),ue(o(`spine_01`),Oo[0]),ue(o(`spine_02`),Oo[1]),ue(o(`spine_03`),1),t.head.getWorldQuaternion(E),t.torso.getWorldQuaternion(D),D.slerp(E,.5),O.copy(D).multiply(p.get(`neck_01`)),Uo(o(`neck_01`),O),O.copy(E).multiply(p.get(`Head`)),Uo(o(`Head`),O),a.updateMatrixWorld(!0),t.shoulderL.getWorldPosition(Io).add(t.shoulderR.getWorldPosition(Lo)),o(`upperarm_l`).getWorldPosition(Ro).add(o(`upperarm_r`).getWorldPosition(zo)),Io.sub(Ro).multiplyScalar(.5),Io.y=0,z.shift=Io.length()/ae,Io.length()>Eo*ae&&Io.setLength(Eo*ae),r.getWorldPosition(Lo).add(Io),r.parent.updateWorldMatrix(!0,!1),r.position.copy(r.parent.worldToLocal(Lo)),a.updateMatrixWorld(!0);for(let e of[`L`,`R`]){let n=e.toLowerCase(),r=t.legs[e];r.ankle.getWorldPosition(ee),ee.y+=C-w,ee.addScaledVector(ce.set(e===`L`?1:-1,0,0).applyQuaternion(B),b),r.hip.getWorldPosition(zo),r.ankle.getWorldPosition(Io),r.knee.getWorldPosition(M).addScaledVector(zo.add(Io),-.5),o(`thigh_${n}`).getWorldPosition(Lo),M.addScaledVector(Lo.add(ee),.5),M.addScaledVector(le.set(0,0,1).applyQuaternion(B),.2),de(o(`thigh_${n}`),o(`calf_${n}`),o(`foot_${n}`),ee,M),r.ankle.getWorldQuaternion(E),O.copy(E).multiply(p.get(`foot_${n}`)),Uo(o(`foot_${n}`),O)}let s=r=>{for(let i of[`L`,`R`]){let a=i.toLowerCase(),s=o(`hand_${a}`),c=i===`L`?t.handL:t.handR,l=i===`L`?t.elbowL:t.elbowR;t.handWorld(i,zo);let u=zo.clone().add(r);l.getWorldPosition(M),P.subVectors(u,M).normalize();let d;for(let r=0;r<2;r++){if(ee.copy(u).addScaledVector(P,-.06*ae),de(o(`upperarm_${a}`),o(`lowerarm_${a}`),s,ee,M,ko),c.getWorldQuaternion(E),ie.copy(E).multiply(Po),d=ie,e&&n>0){t.root.getWorldQuaternion(Bo),te.set(i===`L`?-1:1,0,0).applyQuaternion(Bo),N.copy(e),N.addScaledVector(te,-N.dot(te)).normalize(),Io.crossVectors(te,N);let r=Math.cos(To),a=Math.sin(To);P.copy(N).multiplyScalar(r).addScaledVector(Io,a),Lo.copy(N).multiplyScalar(r).addScaledVector(Io,-a),Lo.y<P.y&&P.copy(Lo),P.normalize(),ne.copy(te).multiplyScalar(i===`L`?1:-1),re.crossVectors(ne,P),L.makeBasis(ne,P,re),F.setFromRotationMatrix(L),d=I.copy(ie).slerp(F,Math.min(n,1))}P.set(0,1,0).applyQuaternion(d)}let f=o(`lowerarm_${a}`);f.getWorldQuaternion(Bo),Vo.copy(Bo).invert().multiply(d);let p=2*Math.atan2(Vo.y,Vo.w);Ho.setFromAxisAngle(Mo,p*.5),Uo(f,Bo.multiply(Ho)),Uo(s,d);let h=e?Math.min(n,1):0;for(let e of T){if(e.left!==(i===`L`))continue;let t=(.25+.95*h)*e.amount;e.bone.quaternion.copy(m.get(e.bone.name)),e.bone.quaternion.multiply(Bo.setFromAxisAngle(e.axis,e.left?-t:t))}s.updateWorldMatrix(!1,!0)}a.updateMatrixWorld(!0)};s(se.set(0,0,0));for(let e of[`L`,`R`])fe(e,Io),t.handWorld(e,Lo),oe.add(Io.sub(Lo));oe.multiplyScalar(.5),oe.length()>.004?(oe.clampLength(0,Do*ae),s(se.copy(oe))):oe.set(0,0,0)},slide:z,setShadows(e){i.traverse(t=>{t.isMesh&&t.visible&&(t.castShadow=e)})},palm:(e,t)=>fe(e,t),clubShift:oe,dispose(){c.forEach(e=>e.dispose()),l.forEach(e=>e.dispose()),i.removeFromParent(),r.forEach(e=>e.visible=!0)}}}var Ko=3*Math.PI/180,qo=25*Math.PI/180,Jo=3,Yo=new Y(1,0,0),Xo=new Y(0,1,0),Zo=new Y(0,0,1);function Qo(e,t){let n=new M,{root:r,model:i,bone:a,owned:o,geometries:s}=Wo(e,t,n,1);i.updateMatrixWorld(!0);let c=e=>e.getWorldQuaternion(new H),l=a(`spine_02`),u=l.quaternion.clone(),d=[`l`,`r`].map(e=>{let t=a(`upperarm_${e}`),n=a(`lowerarm_${e}`);return{left:e===`l`,upper:t,fore:n,upperQ:c(t),foreQ:c(n),parentQ:c(t.parent)}}),f=new H,p=new H,m=new H,h=(e,n,r)=>{l.quaternion.copy(u).multiply(f.setFromAxisAngle(Zo,Math.sin(e*Math.PI*2*t.rate+t.phase)*Ko));for(let e of d){let t=e.left?-1:1,i=f.setFromAxisAngle(Zo,t*1.3),a=p.setFromAxisAngle(Yo,-.7*n),o=new H().copy(a).multiply(i).multiply(e.upperQ);e.upper.quaternion.copy(m.copy(e.parentQ).invert()).multiply(o);let s=t*(.5*n+n*qo*Math.sin(r*Math.PI*2*Jo)),c=m.setFromAxisAngle(Yo,-(.35+1*n)),l=new H().setFromAxisAngle(Xo,s).multiply(c).multiply(i).multiply(e.foreQ);e.fore.quaternion.copy(o.invert()).multiply(l)}};return h(0,0,0),{root:n,pose:h,dispose(){o.forEach(e=>e.dispose()),s.forEach(e=>e.dispose()),r.removeFromParent()}}}function $o(){let e=Ga({shirt:2062925,pants:3948876,hat:`cap`,hatColor:16053492,trousers:!0,shoe:4865843,height:1.9}),t=e.root,n=Qa(e),r=new M,i=new X(new F(.14,.17,.9,12),new x({color:3099194,roughness:.8}));i.position.y=.45,r.add(i);for(let[e,t]of[[-.06,-.18],[0,.02],[.07,.2]]){let n=new X(new F(.006,.006,.45,5),new x({color:13225686,metalness:.5,roughness:.4}));n.position.set(e,1.05,0),n.rotation.z=t,r.add(n)}r.position.set(-.45,0,.05),t.add(r);let a=null,o=`idle`,s=0,c=0,l=null;return{root:t,person:e,get skin(){return a},react(e){e!==`idle`&&(o=e,s=c)},update(e){c+=e,o!==`idle`&&c-s>=1.3&&(o=`idle`),o!==l&&(n.transition(.12),l=o);let t=c-s;n.step(e,e=>{switch(o){case`idle`:e.lift=Math.sin(c*1.6)*.004,e.armL.raise=.05,e.armR.raise=.05,e.armL.out=.08,e.armR.out=.08,e.legL.out=e.legR.out=.06;break;case`cheer`:e.armL.raise=e.armR.raise=2.6+Math.sin(t*12)*.2,e.armL.out=e.armR.out=.35,e.lift=Math.abs(Math.sin(t*9))*.08,e.headPitch=.2;break;case`groan`:e.lean=.35,e.headPitch=-.6,e.armL.raise=e.armR.raise=.15,e.armL.out=e.armR.out=.05,e.lift=-.03,e.roll=Math.sin(t*6)*.06}}),a?.update()},setModel(t,n=!1){a?.dispose(),a=null,t&&(a=Go(t.golfer,e,{outfit:So,accent:`bib`,cap:3103290,hair:[{style:`Hair_Buzzed`,colour:3810838}],hairSource:t.hair,weave:t.weave,height:1.9,face:!0}),a.setShadows(n))},stand(e,n,r=()=>0){let i={x:Math.cos(n),z:-Math.sin(n)},a={x:Math.sin(n),z:Math.cos(n)},o=e.x+i.x*2+a.x*.5,s=e.z+i.z*2+a.z*.5;t.position.set(o,r(o,s),s),t.rotation.y=n-Math.PI/2}}}var es=(function(){var e=`b9H79Tebbbe8Fv9Gbb9Gvuuuuueu9Giuuub9Geueu9Giuuueuixkbeeeddddillviebeoweuecj:Gdkr;Neqo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9KW9J9V9KW9wWVtW949c919M9MWVbeY9TW79O9V9Wt9F9KW9J9V9KW69U9KW949c919M9MWVbdE9TW79O9V9Wt9F9KW9J9V9KW69U9KW949tWG91W9U9JWbiL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9p9JtblK9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9r919HtbvL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVT949WboY9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVJ9V29VVbrl79IV9Rbwq:VZkdbk:XYi5ud9:du8Jjjjjbcj;kb9Rgv8Kjjjjbc9:hodnalTmbcuhoaiRbbgrc;WeGc:Ge9hmbarcsGgwce0mbc9:hoalcufadcd4cbawEgDadfgrcKcaawEgqaraq0Egk6mbaicefhxcj;abad9Uc;WFbGcjdadca0EhmaialfgPar9Rgoadfhsavaoadz:jjjjbgzceVhHcbhOdndninaeaO9nmeaPax9RaD6mdamaeaO9RaOamfgoae6EgAcsfglc9WGhCabaOad2fhXaAcethQaxaDfhiaOaeaoaeao6E9RhLalcl4cifcd4hKazcj;cbfaAfhYcbh8AazcjdfhEaHh3incbh5dnawTmbaxa8Acd4fRbbh5kcbh8Eazcj;cbfhqinaih8Fdndndndna5a8Ecet4ciGgoc9:fPdebdkaPa8F9RaA6mrazcj;cbfa8EaA2fa8FaAz:jjjjb8Aa8FaAfhixdkazcj;cbfa8EaA2fcbaAz:kjjjb8Aa8FhixekaPa8F9RaK6mva8FaKfhidnaCTmbaPai9RcK6mbaocdtc:q:G:cjbfcj:G:cjbawEhaczhrcbhlinargoc9Wfghaqfhrdndndndndndnaaa8Fahco4fRbbalcoG4ciGcdtfydbPDbedvivvvlvkar9cb83bwar9cb83bbxlkarcbaiRbdai8Xbb9c:c:qj:bw9:9c:q;c1:I1e:d9c:b:c:e1z9:gg9cjjjjjz:dg8J9qE86bbaqaofgrcGfcbaicdfa8J9c8N1:NfghRbbag9cjjjjjw:dg8J9qE86bbarcVfcbaha8J9c8M1:NfghRbbag9cjjjjjl:dg8J9qE86bbarc7fcbaha8J9c8L1:NfghRbbag9cjjjjjd:dg8J9qE86bbarctfcbaha8J9c8K1:NfghRbbag9cjjjjje:dg8J9qE86bbarc91fcbaha8J9c8J1:NfghRbbag9cjjjj;ab:dg8J9qE86bbarc4fcbaha8J9cg1:NfghRbbag9cjjjja:dg8J9qE86bbarc93fcbaha8J9ch1:NfghRbbag9cjjjjz:dgg9qE86bbarc94fcbahag9ca1:NfghRbbai8Xbe9c:c:qj:bw9:9c:q;c1:I1e:d9c:b:c:e1z9:gg9cjjjjjz:dg8J9qE86bbarc95fcbaha8J9c8N1:NfgiRbbag9cjjjjjw:dg8J9qE86bbarc96fcbaia8J9c8M1:NfgiRbbag9cjjjjjl:dg8J9qE86bbarc97fcbaia8J9c8L1:NfgiRbbag9cjjjjjd:dg8J9qE86bbarc98fcbaia8J9c8K1:NfgiRbbag9cjjjjje:dg8J9qE86bbarc99fcbaia8J9c8J1:NfgiRbbag9cjjjj;ab:dg8J9qE86bbarc9:fcbaia8J9cg1:NfgiRbbag9cjjjja:dg8J9qE86bbarcufcbaia8J9ch1:NfgiRbbag9cjjjjz:dgg9qE86bbaiag9ca1:NfhixikaraiRblaiRbbghco4g8Ka8KciSg8KE86bbaqaofgrcGfaiclfa8Kfg8KRbbahcl4ciGg8La8LciSg8LE86bbarcVfa8Ka8Lfg8KRbbahcd4ciGg8La8LciSg8LE86bbarc7fa8Ka8Lfg8KRbbahciGghahciSghE86bbarctfa8Kahfg8KRbbaiRbeghco4g8La8LciSg8LE86bbarc91fa8Ka8Lfg8KRbbahcl4ciGg8La8LciSg8LE86bbarc4fa8Ka8Lfg8KRbbahcd4ciGg8La8LciSg8LE86bbarc93fa8Ka8Lfg8KRbbahciGghahciSghE86bbarc94fa8Kahfg8KRbbaiRbdghco4g8La8LciSg8LE86bbarc95fa8Ka8Lfg8KRbbahcl4ciGg8La8LciSg8LE86bbarc96fa8Ka8Lfg8KRbbahcd4ciGg8La8LciSg8LE86bbarc97fa8Ka8Lfg8KRbbahciGghahciSghE86bbarc98fa8KahfghRbbaiRbigico4g8Ka8KciSg8KE86bbarc99faha8KfghRbbaicl4ciGg8Ka8KciSg8KE86bbarc9:faha8KfghRbbaicd4ciGg8Ka8KciSg8KE86bbarcufaha8KfgrRbbaiciGgiaiciSgiE86bbaraifhixdkaraiRbwaiRbbghcl4g8Ka8KcsSg8KE86bbaqaofgrcGfaicwfa8Kfg8KRbbahcsGghahcsSghE86bbarcVfa8KahfghRbbaiRbeg8Kcl4g8La8LcsSg8LE86bbarc7faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarctfaha8KfghRbbaiRbdg8Kcl4g8La8LcsSg8LE86bbarc91faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc4faha8KfghRbbaiRbig8Kcl4g8La8LcsSg8LE86bbarc93faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc94faha8KfghRbbaiRblg8Kcl4g8La8LcsSg8LE86bbarc95faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc96faha8KfghRbbaiRbvg8Kcl4g8La8LcsSg8LE86bbarc97faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc98faha8KfghRbbaiRbog8Kcl4g8La8LcsSg8LE86bbarc99faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc9:faha8KfghRbbaiRbrgicl4g8Ka8KcsSg8KE86bbarcufaha8KfgrRbbaicsGgiaicsSgiE86bbaraifhixekarai8Pbw83bwarai8Pbb83bbaiczfhikdnaoaC9pmbalcdfhlaoczfhraPai9RcL0mekkaoaC6moaimexokaCmva8FTmvkaqaAfhqa8Ecefg8Ecl9hmbkdndndndnawTmbasa8Acd4fRbbgociGPlbedrbkaATmdaza8Afh8Fazcj;cbfhhcbh8EaEhaina8FRbbhraahocbhlinaoahalfRbbgqce4cbaqceG9R7arfgr86bbaoadfhoaAalcefgl9hmbkaacefhaa8Fcefh8FahaAfhha8Ecefg8Ecl9hmbxikkaATmeaza8Afhaazcj;cbfhhcbhoceh8EaYh8FinaEaofhlaa8Vbbhrcbhoinala8FaofRbbcwtahaofRbbgqVc;:FiGce4cbaqceG9R7arfgr87bbaladfhlaLaocefgofmbka8FaQfh8FcdhoaacdfhaahaQfhha8EceGhlcbh8EalmbxdkkaATmbaocl4h8Eaza8AfRbbhqcwhoa3hlinalRbbaotaqVhqalcefhlaocwfgoca9hmbkcbhhaEh8FaYhainazcj;cbfahfRbbhrcwhoaahlinalRbbaotarVhralaAfhlaocwfgoca9hmbkara8E94aq7hqcbhoa8Fhlinalaqao486bbalcefhlaocwfgoca9hmbka8Fadfh8FaacefhaahcefghaA9hmbkkaEclfhEa3clfh3a8Aclfg8Aad6mbkaXazcjdfaAad2z:jjjjb8AazazcjdfaAcufad2fadz:jjjjb8AaAaOfhOaihxaimbkc9:hoxdkcbc99aPax9RakSEhoxekc9:hokavcj;kbf8Kjjjjbaok:ysezu8Jjjjjbc;ae9Rgv8Kjjjjbc9:hodnalaeci9UgrcHf6mbcuhoaiRbbgwc;WeGc;Ge9hmbawcsGgDce0mbavc;abfcFecjez:kjjjb8Aav9cu83iUav9cu83i8Wav9cu83iyav9cu83iaav9cu83iKav9cu83izav9cu83iwav9cu83ibaialfc9WfhqaicefgwarfhldnaeTmbcmcsaDceSEhkcbhxcbhmcbhrcbhicbhoindnalaq9nmbc9:hoxikdndnawRbbgDc;Ve0mbavc;abfaoaDcu7gPcl4fcsGcitfgsydlhzasydbhHdndnaDcsGgsak9pmbavaiaPfcsGcdtfydbaxasEhDaxasTgOfhxxekdndnascsSmbcehOasc987asamffcefhDxekalcefhDal8SbbgscFeGhPdndnascu9mmbaDhlxekalcvfhlaPcFbGhPcrhsdninaD8SbbgOcFbGastaPVhPaOcu9kmeaDcefhDascrfgsc8J9hmbxdkkaDcefhlkcehOaPce4cbaPceG9R7amfhDkaDhmkavc;abfaocitfgsaDBdbasazBdlavaicdtfaDBdbavc;abfaocefcsGcitfgsaHBdbasaDBdlaocdfhoaOaifhidnadcd9hmbabarcetfgsaH87ebasclfaD87ebascdfaz87ebxdkabarcdtfgsaHBdbascwfaDBdbasclfazBdbxekdnaDcpe0mbavaiaqaDcsGfRbbgscl4gP9RcsGcdtfydbaxcefgOaPEhDavaias9RcsGcdtfydbaOaPTgzfgOascsGgPEhsaPThPdndnadcd9hmbabarcetfgHax87ebaHclfas87ebaHcdfaD87ebxekabarcdtfgHaxBdbaHcwfasBdbaHclfaDBdbkavaicdtfaxBdbavc;abfaocitfgHaDBdbaHaxBdlavaicefgicsGcdtfaDBdbavc;abfaocefcsGcitfgHasBdbaHaDBdlavaiazfgicsGcdtfasBdbavc;abfaocdfcsGcitfgDaxBdbaDasBdlaocifhoaiaPfhiaOaPfhxxekaxcbalRbbgsEgHaDc;:eSgDfhOascsGhAdndnascl4gCmbaOcefhzxekaOhzavaiaC9RcsGcdtfydbhOkdndnaAmbazcefhxxekazhxavaias9RcsGcdtfydbhzkdndnaDTmbalcefhDxekalcdfhDal8SbegPcFeGhsdnaPcu9kmbalcofhHascFbGhscrhldninaD8SbbgPcFbGaltasVhsaPcu9kmeaDcefhDalcrfglc8J9hmbkaHhDxekaDcefhDkasce4cbasceG9R7amfgmhHkdndnaCcsSmbaDhsxekaDcefhsaD8SbbglcFeGhPdnalcu9kmbaDcvfhOaPcFbGhPcrhldninas8SbbgDcFbGaltaPVhPaDcu9kmeascefhsalcrfglc8J9hmbkaOhsxekascefhskaPce4cbaPceG9R7amfgmhOkdndnaAcsSmbashlxekascefhlas8SbbgDcFeGhPdnaDcu9kmbascvfhzaPcFbGhPcrhDdninal8SbbgscFbGaDtaPVhPascu9kmealcefhlaDcrfgDc8J9hmbkazhlxekalcefhlkaPce4cbaPceG9R7amfgmhzkdndnadcd9hmbabarcetfgDaH87ebaDclfaz87ebaDcdfaO87ebxekabarcdtfgDaHBdbaDcwfazBdbaDclfaOBdbkavc;abfaocitfgDaOBdbaDaHBdlavaicdtfaHBdbavc;abfaocefcsGcitfgDazBdbaDaOBdlavaicefgicsGcdtfaOBdbavc;abfaocdfcsGcitfgDaHBdbaDazBdlavaiaCTaCcsSVfgicsGcdtfazBdbaiaATaAcsSVfhiaocifhokawcefhwaocsGhoaicsGhiarcifgrae6mbkkcbc99alaqSEhokavc;aef8Kjjjjbaok:clevu8Jjjjjbcz9Rhvdnalaecvf9pmbc9:skdnaiRbbc;:eGc;qeSmbcuskav9cb83iwaicefhoaialfc98fhrdnaeTmbdnadcdSmbcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcdtfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgiBdbalaiBdbawcefgwae9hmbxdkkcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcetfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgi87ebalaiBdbawcefgwae9hmbkkcbc99aoarSEk:Lvoeue99dud99eud99dndnadcl9hmbaeTmeindndnabcdfgd8Sbb:Yab8Sbbgi:Ygl:l:tabcefgv8Sbbgo:Ygr:l:tgwJbb;:9cawawNJbbbbawawJbbbb9GgDEgq:mgkaqaicb9iEalMgwawNakaqaocb9iEarMgqaqNMM:r:vglNJbbbZJbbb:;aDEMgr:lJbbb9p9DTmbar:Ohixekcjjjj94hikadai86bbdndnaqalNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkavad86bbdndnawalNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohdxekcjjjj94hdkabad86bbabclfhbaecufgembxdkkaeTmbindndnabclfgd8Ueb:Yab8Uebgi:Ygl:l:tabcdfgv8Uebgo:Ygr:l:tgwJb;:FSawawNJbbbbawawJbbbb9GgDEgq:mgkaqaicb9iEalMgwawNakaqaocb9iEarMgqaqNMM:r:vglNJbbbZJbbb:;aDEMgr:lJbbb9p9DTmbar:Ohixekcjjjj94hikadai87ebdndnaqalNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkavad87ebdndnawalNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohdxekcjjjj94hdkabad87ebabcwfhbaecufgembkkk:4ioiue99dud99dud99dnaeTmbcbhiabhlindndnal8Uebgv:YgoJ:ji:1Salcof8UebgrciVgw:Y:vgDNJbbbZJbbb:;avcu9kEMgq:lJbbb9p9DTmbaq:Ohkxekcjjjj94hkkalclf8Uebhvalcdf8UebhxalarcefciGcetfak87ebdndnax:YgqaDNJbbbZJbbb:;axcu9kEMgm:lJbbb9p9DTmbam:Ohxxekcjjjj94hxkabaiarciGgkfcd7cetfax87ebdndnav:YgmaDNJbbbZJbbb:;avcu9kEMgP:lJbbb9p9DTmbaP:Ohvxekcjjjj94hvkalarcufciGcetfav87ebdndnawaw2:ZgPaPMaoaoN:taqaqN:tamamN:tgoJbbbbaoJbbbb9GE:raDNJbbbZMgD:lJbbb9p9DTmbaD:Ohrxekcjjjj94hrkalakcetfar87ebalcwfhlaiclfhiaecufgembkkk9mbdnadcd4ae2gdTmbinababydbgecwtcw91:Yaece91cjjj98Gcjjj;8if::NUdbabclfhbadcufgdmbkkk:Tvirud99eudndnadcl9hmbaeTmeindndnabRbbgiabcefgl8Sbbgvabcdfgo8Sbbgrf9R:YJbbuJabcifgwRbbgdce4adVgDcd4aDVgDcl4aDVgD:Z:vgqNJbbbZMgk:lJbbb9p9DTmbak:Ohxxekcjjjj94hxkaoax86bbdndnaraif:YaqNJbbbZMgk:lJbbb9p9DTmbak:Ohoxekcjjjj94hokalao86bbdndnavaifar9R:YaqNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikabai86bbdndnaDadcetGadceGV:ZaqNJbbbZMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkawad86bbabclfhbaecufgembxdkkaeTmbindndnab8Vebgiabcdfgl8Uebgvabclfgo8Uebgrf9R:YJbFu9habcofgw8Vebgdce4adVgDcd4aDVgDcl4aDVgDcw4aDVgD:Z:vgqNJbbbZMgk:lJbbb9p9DTmbak:Ohxxekcjjjj94hxkaoax87ebdndnaraif:YaqNJbbbZMgk:lJbbb9p9DTmbak:Ohoxekcjjjj94hokalao87ebdndnavaifar9R:YaqNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikabai87ebdndnaDadcetGadceGV:ZaqNJbbbZMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkawad87ebabcwfhbaecufgembkkk9teiucbcbyd:K:G:cjbgeabcifc98GfgbBd:K:G:cjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;LeeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiclfaeclfydbBdbaicwfaecwfydbBdbaicxfaecxfydbBdbaeczfheaiczfhiadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk;aeedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdbaicxfalBdbaicwfalBdbaiclfalBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabkk83dbcj:Gdk8Kbbbbdbbblbbbwbbbbbbbebbbdbbblbbbwbbbbc:K:Gdkl8W:qbb`,t=`b9H79TebbbeKl9Gbb9Gvuuuuueu9Giuuub9Geueuixkbbebeeddddilve9Weeeviebeoweuecj:Gdkr;Neqo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9KW9J9V9KW9wWVtW949c919M9MWVbdY9TW79O9V9Wt9F9KW9J9V9KW69U9KW949c919M9MWVblE9TW79O9V9Wt9F9KW9J9V9KW69U9KW949tWG91W9U9JWbvL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9p9JtboK9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9r919HtbrL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVT949WbwY9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVJ9V29VVbDl79IV9Rbqq:W9Dklbzik94evu8Jjjjjbcz9Rhbcbheincbhdcbhiinabcwfadfaicjuaead4ceGglE86bbaialfhiadcefgdcw9hmbkaeai86b:q:W:cjbaecitab8Piw83i:q:G:cjbaecefgecjd9hmbkk:JBl8Aud97dur978Jjjjjbcj;kb9Rgv8Kjjjjbc9:hodnalTmbcuhoaiRbbgrc;WeGc:Ge9hmbarcsGgwce0mbc9:hoalcufadcd4cbawEgDadfgrcKcaawEgqaraq0Egk6mbaialfgxar9RhodnadTgmmbavaoad;8qbbkaicefhPcj;abad9Uc;WFbGcjdadca0EhsdndndnadTmbaoadfhzcbhHinaeaH9nmdaxaP9RaD6miabaHad2fhOaPaDfhAasaeaH9RaHasfae6EgCcsfgocl4cifcd4hXavcj;cbfaoc9WGgQcetfhLavcj;cbfaQci2fhKavcj;cbfaQfhYcbh8Aaoc;ab6hEincbh3dnawTmbaPa8Acd4fRbbh3kcbh5avcj;cbfh8Eindndndndna3a5cet4ciGgoc9:fPdebdkaxaA9RaQ6mwdnaQTmbavcj;cbfa5aQ2faAaQ;8qbbkaAaCfhAxdkaQTmeavcj;cbfa5aQ2fcbaQ;8kbxekaxaA9RaX6moaoclVcbawEhraAaXfhocbhidnaEmbaxao9Rc;Gb6mbcbhlina8EalfhidndndndndndnaAalco4fRbbgqciGarfPDbedibledibkaipxbbbbbbbbbbbbbbbbpklbxlkaiaopbblaopbbbg8Fclp:mea8FpmbzeHdOiAlCvXoQrLg8Fcdp:mea8FpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogapxiiiiiiiiiiiiiiiip8Jg8Fp5b9cjF;8;4;W;G;ab9:9cU1:Nghcitpbi:q:G:cjbahRb:q:W:cjbghpsa8Fp5e9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPaaa8Fp9spklbahaoclffagRb:q:W:cjbfhoxikaiaopbbwaopbbbg8Fclp:mea8FpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogapxssssssssssssssssp8Jg8Fp5b9cjF;8;4;W;G;ab9:9cU1:Nghcitpbi:q:G:cjbahRb:q:W:cjbghpsa8Fp5e9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPaaa8Fp9spklbahaocwffagRb:q:W:cjbfhoxdkaiaopbbbpklbaoczfhoxekaiaopbbdaoRbbghcitpbi:q:G:cjbahRb:q:W:cjbghpsaoRbeggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPpklbahaocdffagRb:q:W:cjbfhokdndndndndndnaqcd4ciGarfPDbedibledibkaiczfpxbbbbbbbbbbbbbbbbpklbxlkaiczfaopbblaopbbbg8Fclp:mea8FpmbzeHdOiAlCvXoQrLg8Fcdp:mea8FpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogapxiiiiiiiiiiiiiiiip8Jg8Fp5b9cjF;8;4;W;G;ab9:9cU1:Nghcitpbi:q:G:cjbahRb:q:W:cjbghpsa8Fp5e9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPaaa8Fp9spklbahaoclffagRb:q:W:cjbfhoxikaiczfaopbbwaopbbbg8Fclp:mea8FpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogapxssssssssssssssssp8Jg8Fp5b9cjF;8;4;W;G;ab9:9cU1:Nghcitpbi:q:G:cjbahRb:q:W:cjbghpsa8Fp5e9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPaaa8Fp9spklbahaocwffagRb:q:W:cjbfhoxdkaiczfaopbbbpklbaoczfhoxekaiczfaopbbdaoRbbghcitpbi:q:G:cjbahRb:q:W:cjbghpsaoRbeggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPpklbahaocdffagRb:q:W:cjbfhokdndndndndndnaqcl4ciGarfPDbedibledibkaicafpxbbbbbbbbbbbbbbbbpklbxlkaicafaopbblaopbbbg8Fclp:mea8FpmbzeHdOiAlCvXoQrLg8Fcdp:mea8FpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogapxiiiiiiiiiiiiiiiip8Jg8Fp5b9cjF;8;4;W;G;ab9:9cU1:Nghcitpbi:q:G:cjbahRb:q:W:cjbghpsa8Fp5e9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPaaa8Fp9spklbahaoclffagRb:q:W:cjbfhoxikaicafaopbbwaopbbbg8Fclp:mea8FpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogapxssssssssssssssssp8Jg8Fp5b9cjF;8;4;W;G;ab9:9cU1:Nghcitpbi:q:G:cjbahRb:q:W:cjbghpsa8Fp5e9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPaaa8Fp9spklbahaocwffagRb:q:W:cjbfhoxdkaicafaopbbbpklbaoczfhoxekaicafaopbbdaoRbbghcitpbi:q:G:cjbahRb:q:W:cjbghpsaoRbeggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPpklbahaocdffagRb:q:W:cjbfhokdndndndndndnaqco4arfPDbedibledibkaic8Wfpxbbbbbbbbbbbbbbbbpklbxlkaic8Wfaopbblaopbbbg8Fclp:mea8FpmbzeHdOiAlCvXoQrLg8Fcdp:mea8FpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogapxiiiiiiiiiiiiiiiip8Jg8Fp5b9cjF;8;4;W;G;ab9:9cU1:Ngicitpbi:q:G:cjbaiRb:q:W:cjbgipsa8Fp5e9cjF;8;4;W;G;ab9:9cU1:Ngqcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPaaa8Fp9spklbaiaoclffaqRb:q:W:cjbfhoxikaic8Wfaopbbwaopbbbg8Fclp:mea8FpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogapxssssssssssssssssp8Jg8Fp5b9cjF;8;4;W;G;ab9:9cU1:Ngicitpbi:q:G:cjbaiRb:q:W:cjbgipsa8Fp5e9cjF;8;4;W;G;ab9:9cU1:Ngqcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPaaa8Fp9spklbaiaocwffaqRb:q:W:cjbfhoxdkaic8Wfaopbbbpklbaoczfhoxekaic8WfaopbbdaoRbbgicitpbi:q:G:cjbaiRb:q:W:cjbgipsaoRbegqcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPpklbaiaocdffaqRb:q:W:cjbfhokalc;abfhialcjefaQ0meaihlaxao9Rc;Fb0mbkkdnaiaQ9pmbaici4hlinaxao9RcK6mwa8EaifhqdndndndndndnaAaico4fRbbalcoG4ciGarfPDbedibledibkaqpxbbbbbbbbbbbbbbbbpkbbxlkaqaopbblaopbbbg8Fclp:mea8FpmbzeHdOiAlCvXoQrLg8Fcdp:mea8FpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogapxiiiiiiiiiiiiiiiip8Jg8Fp5b9cjF;8;4;W;G;ab9:9cU1:Nghcitpbi:q:G:cjbahRb:q:W:cjbghpsa8Fp5e9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPaaa8Fp9spkbbahaoclffagRb:q:W:cjbfhoxikaqaopbbwaopbbbg8Fclp:mea8FpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogapxssssssssssssssssp8Jg8Fp5b9cjF;8;4;W;G;ab9:9cU1:Nghcitpbi:q:G:cjbahRb:q:W:cjbghpsa8Fp5e9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPaaa8Fp9spkbbahaocwffagRb:q:W:cjbfhoxdkaqaopbbbpkbbaoczfhoxekaqaopbbdaoRbbghcitpbi:q:G:cjbahRb:q:W:cjbghpsaoRbeggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPpkbbahaocdffagRb:q:W:cjbfhokalcdfhlaiczfgiaQ6mbkkaohAaoTmoka8EaQfh8Ea5cefg5cl9hmbkdndndndnawTmbaza8Acd4fRbbglciGPlbedwbkaQTmdavcjdfa8Afhlava8Afpbdbh8Jcbhoinalavcj;cbfaofpblbg8KaYaofpblbg8LpmbzeHdOiAlCvXoQrLg8MaLaofpblbg8NaKaofpblbgypmbzeHdOiAlCvXoQrLg8PpmbezHdiOAlvCXorQLg8Fcep9Ta8Fpxeeeeeeeeeeeeeeeegap9op9Hp9rg8Fa8Jp9Ug8Jp9Abbbaladfgla8Ja8Fa8Fpmlvorlvorlvorlvorp9Ug8Jp9Abbbaladfgla8Ja8Fa8FpmwDqkwDqkwDqkwDqkp9Ug8Jp9Abbbaladfgla8Ja8Fa8FpmxmPsxmPsxmPsxmPsp9Ug8Jp9Abbbaladfgla8Ja8Ma8PpmwDKYqk8AExm35Ps8E8Fg8Fcep9Ta8Faap9op9Hp9rg8Fp9Ug8Jp9Abbbaladfgla8Ja8Fa8Fpmlvorlvorlvorlvorp9Ug8Jp9Abbbaladfgla8Ja8Fa8FpmwDqkwDqkwDqkwDqkp9Ug8Jp9Abbbaladfgla8Ja8Fa8FpmxmPsxmPsxmPsxmPsp9Ug8Jp9Abbbaladfgla8Ja8Ka8LpmwKDYq8AkEx3m5P8Es8Fg8Ka8NaypmwKDYq8AkEx3m5P8Es8Fg8LpmbezHdiOAlvCXorQLg8Fcep9Ta8Faap9op9Hp9rg8Fp9Ug8Jp9Abbbaladfgla8Ja8Fa8Fpmlvorlvorlvorlvorp9Ug8Jp9Abbbaladfgla8Ja8Fa8FpmwDqkwDqkwDqkwDqkp9Ug8Jp9Abbbaladfgla8Ja8Fa8FpmxmPsxmPsxmPsxmPsp9Ug8Jp9Abbbaladfgla8Ja8Ka8LpmwDKYqk8AExm35Ps8E8Fg8Fcep9Ta8Faap9op9Hp9rg8Fp9Ugap9Abbbaladfglaaa8Fa8Fpmlvorlvorlvorlvorp9Ugap9Abbbaladfglaaa8Fa8FpmwDqkwDqkwDqkwDqkp9Ugap9Abbbaladfglaaa8Fa8FpmxmPsxmPsxmPsxmPsp9Ug8Jp9AbbbaladfhlaoczfgoaQ6mbxikkaQTmeavcjdfa8Afhlava8Afpbdbh8Jcbhoinalavcj;cbfaofpblbg8KaYaofpblbg8LpmbzeHdOiAlCvXoQrLg8MaLaofpblbg8NaKaofpblbgypmbzeHdOiAlCvXoQrLg8PpmbezHdiOAlvCXorQLg8Fcep:nea8Fpxebebebebebebebebgap9op:bep9rg8Fa8Jp:oeg8Jp9Abbbaladfgla8Ja8Fa8Fpmlvorlvorlvorlvorp:oeg8Jp9Abbbaladfgla8Ja8Fa8FpmwDqkwDqkwDqkwDqkp:oeg8Jp9Abbbaladfgla8Ja8Fa8FpmxmPsxmPsxmPsxmPsp:oeg8Jp9Abbbaladfgla8Ja8Ma8PpmwDKYqk8AExm35Ps8E8Fg8Fcep:nea8Faap9op:bep9rg8Fp:oeg8Jp9Abbbaladfgla8Ja8Fa8Fpmlvorlvorlvorlvorp:oeg8Jp9Abbbaladfgla8Ja8Fa8FpmwDqkwDqkwDqkwDqkp:oeg8Jp9Abbbaladfgla8Ja8Fa8FpmxmPsxmPsxmPsxmPsp:oeg8Jp9Abbbaladfgla8Ja8Ka8LpmwKDYq8AkEx3m5P8Es8Fg8Ka8NaypmwKDYq8AkEx3m5P8Es8Fg8LpmbezHdiOAlvCXorQLg8Fcep:nea8Faap9op:bep9rg8Fp:oeg8Jp9Abbbaladfgla8Ja8Fa8Fpmlvorlvorlvorlvorp:oeg8Jp9Abbbaladfgla8Ja8Fa8FpmwDqkwDqkwDqkwDqkp:oeg8Jp9Abbbaladfgla8Ja8Fa8FpmxmPsxmPsxmPsxmPsp:oeg8Jp9Abbbaladfgla8Ja8Ka8LpmwDKYqk8AExm35Ps8E8Fg8Fcep:nea8Faap9op:bep9rg8Fp:oegap9Abbbaladfglaaa8Fa8Fpmlvorlvorlvorlvorp:oegap9Abbbaladfglaaa8Fa8FpmwDqkwDqkwDqkwDqkp:oegap9Abbbaladfglaaa8Fa8FpmxmPsxmPsxmPsxmPsp:oeg8Jp9AbbbaladfhlaoczfgoaQ6mbxdkkaQTmbcbhocbalcl4gl9Rc8FGhiavcjdfa8Afhrava8Afpbdbhainaravcj;cbfaofpblbg8JaYaofpblbg8KpmbzeHdOiAlCvXoQrLg8LaLaofpblbg8MaKaofpblbg8NpmbzeHdOiAlCvXoQrLgypmbezHdiOAlvCXorQLg8Faip:Rea8Falp:Tep9qg8Faap9rgap9Abbbaradfgraaa8Fa8Fpmlvorlvorlvorlvorp9rgap9Abbbaradfgraaa8Fa8FpmwDqkwDqkwDqkwDqkp9rgap9Abbbaradfgraaa8Fa8FpmxmPsxmPsxmPsxmPsp9rgap9Abbbaradfgraaa8LaypmwDKYqk8AExm35Ps8E8Fg8Faip:Rea8Falp:Tep9qg8Fp9rgap9Abbbaradfgraaa8Fa8Fpmlvorlvorlvorlvorp9rgap9Abbbaradfgraaa8Fa8FpmwDqkwDqkwDqkwDqkp9rgap9Abbbaradfgraaa8Fa8FpmxmPsxmPsxmPsxmPsp9rgap9Abbbaradfgraaa8Ja8KpmwKDYq8AkEx3m5P8Es8Fg8Ja8Ma8NpmwKDYq8AkEx3m5P8Es8Fg8KpmbezHdiOAlvCXorQLg8Faip:Rea8Falp:Tep9qg8Fp9rgap9Abbbaradfgraaa8Fa8Fpmlvorlvorlvorlvorp9rgap9Abbbaradfgraaa8Fa8FpmwDqkwDqkwDqkwDqkp9rgap9Abbbaradfgraaa8Fa8FpmxmPsxmPsxmPsxmPsp9rgap9Abbbaradfgraaa8Ja8KpmwDKYqk8AExm35Ps8E8Fg8Faip:Rea8Falp:Tep9qg8Fp9rgap9Abbbaradfgraaa8Fa8Fpmlvorlvorlvorlvorp9rgap9Abbbaradfgraaa8Fa8FpmwDqkwDqkwDqkwDqkp9rgap9Abbbaradfgraaa8Fa8FpmxmPsxmPsxmPsxmPsp9rgap9AbbbaradfhraoczfgoaQ6mbkka8Aclfg8Aad6mbkdnaCad2goTmbaOavcjdfao;8qbbkdnammbavavcjdfaCcufad2fad;8qbbkaCaHfhHc9:hoaAhPaAmbxlkkaeTmbaDalfhrcbhocuhlinaralaD9RglfaD6mdasaeao9Raoasfae6Eaofgoae6mbkaial9RhPkcbc99axaP9RakSEhoxekc9:hokavcj;kbf8Kjjjjbaokwbz:bjjjbkNsezu8Jjjjjbc;ae9Rgv8Kjjjjbc9:hodnalaeci9UgrcHf6mbcuhoaiRbbgwc;WeGc;Ge9hmbawcsGgDce0mbavc;abfcFecje;8kbav9cu83iUav9cu83i8Wav9cu83iyav9cu83iaav9cu83iKav9cu83izav9cu83iwav9cu83ibaialfc9WfhqaicefgwarfhldnaeTmbcmcsaDceSEhkcbhxcbhmcbhrcbhicbhoindnalaq9nmbc9:hoxikdndnawRbbgDc;Ve0mbavc;abfaoaDcu7gPcl4fcsGcitfgsydlhzasydbhHdndnaDcsGgsak9pmbavaiaPfcsGcdtfydbaxasEhDaxasTgOfhxxekdndnascsSmbcehOasc987asamffcefhDxekalcefhDal8SbbgscFeGhPdndnascu9mmbaDhlxekalcvfhlaPcFbGhPcrhsdninaD8SbbgOcFbGastaPVhPaOcu9kmeaDcefhDascrfgsc8J9hmbxdkkaDcefhlkcehOaPce4cbaPceG9R7amfhDkaDhmkavc;abfaocitfgsaDBdbasazBdlavaicdtfaDBdbavc;abfaocefcsGcitfgsaHBdbasaDBdlaocdfhoaOaifhidnadcd9hmbabarcetfgsaH87ebasclfaD87ebascdfaz87ebxdkabarcdtfgsaHBdbascwfaDBdbasclfazBdbxekdnaDcpe0mbavaiaqaDcsGfRbbgscl4gP9RcsGcdtfydbaxcefgOaPEhDavaias9RcsGcdtfydbaOaPTgzfgOascsGgPEhsaPThPdndnadcd9hmbabarcetfgHax87ebaHclfas87ebaHcdfaD87ebxekabarcdtfgHaxBdbaHcwfasBdbaHclfaDBdbkavaicdtfaxBdbavc;abfaocitfgHaDBdbaHaxBdlavaicefgicsGcdtfaDBdbavc;abfaocefcsGcitfgHasBdbaHaDBdlavaiazfgicsGcdtfasBdbavc;abfaocdfcsGcitfgDaxBdbaDasBdlaocifhoaiaPfhiaOaPfhxxekaxcbalRbbgsEgHaDc;:eSgDfhOascsGhAdndnascl4gCmbaOcefhzxekaOhzavaiaC9RcsGcdtfydbhOkdndnaAmbazcefhxxekazhxavaias9RcsGcdtfydbhzkdndnaDTmbalcefhDxekalcdfhDal8SbegPcFeGhsdnaPcu9kmbalcofhHascFbGhscrhldninaD8SbbgPcFbGaltasVhsaPcu9kmeaDcefhDalcrfglc8J9hmbkaHhDxekaDcefhDkasce4cbasceG9R7amfgmhHkdndnaCcsSmbaDhsxekaDcefhsaD8SbbglcFeGhPdnalcu9kmbaDcvfhOaPcFbGhPcrhldninas8SbbgDcFbGaltaPVhPaDcu9kmeascefhsalcrfglc8J9hmbkaOhsxekascefhskaPce4cbaPceG9R7amfgmhOkdndnaAcsSmbashlxekascefhlas8SbbgDcFeGhPdnaDcu9kmbascvfhzaPcFbGhPcrhDdninal8SbbgscFbGaDtaPVhPascu9kmealcefhlaDcrfgDc8J9hmbkazhlxekalcefhlkaPce4cbaPceG9R7amfgmhzkdndnadcd9hmbabarcetfgDaH87ebaDclfaz87ebaDcdfaO87ebxekabarcdtfgDaHBdbaDcwfazBdbaDclfaOBdbkavc;abfaocitfgDaOBdbaDaHBdlavaicdtfaHBdbavc;abfaocefcsGcitfgDazBdbaDaOBdlavaicefgicsGcdtfaOBdbavc;abfaocdfcsGcitfgDaHBdbaDazBdlavaiaCTaCcsSVfgicsGcdtfazBdbaiaATaAcsSVfhiaocifhokawcefhwaocsGhoaicsGhiarcifgrae6mbkkcbc99alaqSEhokavc;aef8Kjjjjbaok:clevu8Jjjjjbcz9Rhvdnalaecvf9pmbc9:skdnaiRbbc;:eGc;qeSmbcuskav9cb83iwaicefhoaialfc98fhrdnaeTmbdnadcdSmbcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcdtfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgiBdbalaiBdbawcefgwae9hmbxdkkcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcetfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgi87ebalaiBdbawcefgwae9hmbkkcbc99aoarSEk;Toio97eue97aec98Ghedndnadcl9hmbaeTmecbhdinababpbbbgicKp:RecKp:Sep;6eglaicwp:RecKp:Sep;6ealp;Geaiczp:RecKp:Sep;6egvp;Gep;Kep;Legopxbbbbbbbbbbbbbbbbp:2egralpxbbbjbbbjbbbjbbbjgwp9op9rp;Keglpxbb;:9cbb;:9cbb;:9cbb;:9calalp;Meaoaop;Meavaravawp9op9rp;Keglalp;Mep;Kep;Kep;Jep;Negvp;Mepxbbn0bbn0bbn0bbn0grp;KepxFbbbFbbbFbbbFbbbp9oaipxbbbFbbbFbbbFbbbFp9op9qalavp;Mearp;Kecwp:RepxbFbbbFbbbFbbbFbbp9op9qaoavp;Mearp;Keczp:RepxbbFbbbFbbbFbbbFbp9op9qpkbbabczfhbadclfgdae6mbxdkkaeTmbcbhdinabczfgDaDpbbbgipxbbbbbbFFbbbbbbFFgwp9oabpbbbgoaipmbediwDqkzHOAKY8AEgvczp:Reczp:Sep;6eglaoaipmlvorxmPsCXQL358E8FpxFubbFubbFubbFubbp9op;6eavczp:Sep;6egvp;Gealp;Gep;Kep;Legipxbbbbbbbbbbbbbbbbp:2egralpxbbbjbbbjbbbjbbbjgqp9op9rp;Keglpxb;:FSb;:FSb;:FSb;:FSalalp;Meaiaip;Meavaravaqp9op9rp;Keglalp;Mep;Kep;Kep;Jep;Negvp;Mepxbbn0bbn0bbn0bbn0grp;KepxFFbbFFbbFFbbFFbbp9oaiavp;Mearp;Keczp:Rep9qgialavp;Mearp;KepxFFbbFFbbFFbbFFbbp9oglpmwDKYqk8AExm35Ps8E8Fp9qpkbbabaoawp9oaialpmbezHdiOAlvCXorQLp9qpkbbabcafhbadclfgdae6mbkkk;2ileue97euo97dnaec98GgiTmbcbheinabcKfpx:ji:1S:ji:1S:ji:1S:ji:1SabpbbbglabczfgvpbbbgopmlvorxmPsCXQL358E8Fgrczp:Segwpxibbbibbbibbbibbbp9qp;6egDp;NegqaDaDp;MegDaDp;KealaopmbediwDqkzHOAKY8AEgDczp:Reczp:Sep;6eglalp;MeaDczp:Sep;6egoaop;Mearczp:Reczp:Sep;6egrarp;Mep;Kep;Kep;Lepxbbbbbbbbbbbbbbbbp:4ep;Jep;Mepxbbn0bbn0bbn0bbn0gDp;KepxFFbbFFbbFFbbFFbbgkp9oaqaop;MeaDp;Keczp:Rep9qgoaqalp;MeaDp;Keakp9oaqarp;MeaDp;Keczp:Rep9qgDpmwDKYqk8AExm35Ps8E8Fglp5eawclp:RegqpEi:T:j83ibavalp5baqpEd:T:j83ibabcwfaoaDpmbezHdiOAlvCXorQLgDp5eaqpEe:T:j83ibabaDp5baqpEb:T:j83ibabcafhbaeclfgeai6mbkkkuee97dnadcd4ae2c98GgeTmbcbhdinababpbbbgicwp:Recwp:Sep;6eaicep:SepxbbjFbbjFbbjFbbjFp9opxbbjZbbjZbbjZbbjZp:Uep;Mepkbbabczfhbadclfgdae6mbkkk:Sodw97euaec98Ghedndnadcl9hmbaeTmecbhdinabpxbbuJbbuJbbuJbbuJabpbbbgicKp:TeglaicYp:Tep9qgvcdp:Teavp9qgvclp:Teavp9qgop;6ep;Negvaicwp:RecKp:SegraipxFbbbFbbbFbbbFbbbgwp9ogDp:Uep;6ep;Mepxbbn0bbn0bbn0bbn0gqp;Kecwp:RepxbFbbbFbbbFbbbFbbp9oavaDarp:Xeaiczp:RecKp:Segip:Uep;6ep;Meaqp;Keawp9op9qavaDaraip:Uep:Xep;6ep;Meaqp;Keczp:RepxbbFbbbFbbbFbbbFbp9op9qavaoalcep:Rep9oalpxebbbebbbebbbebbbp9op9qp;6ep;Meaqp;KecKp:Rep9qpkbbabczfhbadclfgdae6mbxdkkaeTmbcbhdinabczfgkpxbFu9hbFu9hbFu9hbFu9habpbbbglakpbbbgrpmlvorxmPsCXQL358E8Fgvczp:TegqavcHp:Tep9qgicdp:Teaip9qgiclp:Teaip9qgicwp:Teaip9qgop;6ep;NegialarpmbediwDqkzHOAKY8AEgDpxFFbbFFbbFFbbFFbbglp9ograDczp:Segwp:Ueavczp:Reczp:SegDp:Xep;6ep;Mepxbbn0bbn0bbn0bbn0gvp;Kealp9oaiarawaDp:Uep:Xep;6ep;Meavp;Keczp:Rep9qgwaiaoaqcep:Rep9oaqpxebbbebbbebbbebbbp9op9qp;6ep;Meavp;Keczp:ReaiaDarp:Uep;6ep;Meavp;Kealp9op9qgipmwDKYqk8AExm35Ps8E8FpkbbabawaipmbezHdiOAlvCXorQLpkbbabcafhbadclfgdae6mbkkk9teiucbcbydj:G:cjbgeabcifc98GfgbBdj:G:cjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaikkxebcj:Gdklz:zbb`,n=new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,3,2,0,0,5,3,1,0,1,12,1,0,10,22,2,12,0,65,0,65,0,65,0,252,10,0,0,11,7,0,65,0,253,15,26,11]),r=new Uint8Array([32,0,65,2,1,106,34,33,3,128,11,4,13,64,6,253,10,7,15,116,127,5,8,12,40,16,19,54,20,9,27,255,113,17,42,67,24,23,146,148,18,14,22,45,70,69,56,114,101,21,25,63,75,136,108,28,118,29,73,115]);if(typeof WebAssembly!=`object`)return{supported:!1};var i=WebAssembly.validate(n)?s(t):s(e),a,o=WebAssembly.instantiate(i,{}).then(function(e){a=e.instance,a.exports.__wasm_call_ctors()});function s(e){for(var t=new Uint8Array(e.length),n=0;n<e.length;++n){var i=e.charCodeAt(n);t[n]=i>96?i-97:i>64?i-39:i+4}for(var a=0,n=0;n<e.length;++n)t[a++]=t[n]<60?r[t[n]]:(t[n]-60)*64+t[++n];return t.buffer.slice(0,a)}function c(e,t,n,r,i,a,o){var s=e.exports.sbrk,c=r+3&-4,l=s(c*i),u=s(a.length),d=new Uint8Array(e.exports.memory.buffer);d.set(a,u);var f=t(l,r,i,u,a.length);if(f==0&&o&&o(l,c,i),n.set(d.subarray(l,l+r*i)),s(l-s(0)),f!=0)throw Error(`Malformed buffer data: `+f)}var l={NONE:``,OCTAHEDRAL:`meshopt_decodeFilterOct`,QUATERNION:`meshopt_decodeFilterQuat`,EXPONENTIAL:`meshopt_decodeFilterExp`,COLOR:`meshopt_decodeFilterColor`},u={ATTRIBUTES:`meshopt_decodeVertexBuffer`,TRIANGLES:`meshopt_decodeIndexBuffer`,INDICES:`meshopt_decodeIndexSequence`},d=[],f=0;function p(e){var t={object:new Worker(e),pending:0,requests:{}};return t.object.onmessage=function(e){var n=e.data;t.pending-=n.count,t.requests[n.id][n.action](n.value),delete t.requests[n.id]},t}function m(e){for(var t=`self.ready = WebAssembly.instantiate(new Uint8Array([`+new Uint8Array(i)+`]), {}).then(function(result) { result.instance.exports.__wasm_call_ctors(); return result.instance; });self.onmessage = `+g.name+`;`+c.toString()+g.toString(),n=new Blob([t],{type:`text/javascript`}),r=URL.createObjectURL(n),a=d.length;a<e;++a)d[a]=p(r);for(var a=e;a<d.length;++a)d[a].object.postMessage({});d.length=e,URL.revokeObjectURL(r)}function h(e,t,n,r,i){for(var a=d[0],o=1;o<d.length;++o)d[o].pending<a.pending&&(a=d[o]);return new Promise(function(o,s){var c=new Uint8Array(n),l=++f;a.pending+=e,a.requests[l]={resolve:o,reject:s},a.object.postMessage({id:l,count:e,size:t,source:c,mode:r,filter:i},[c.buffer])})}function g(e){var t=e.data;self.ready.then(function(e){if(!t.id)return self.close();try{var n=new Uint8Array(t.count*t.size);c(e,e.exports[t.mode],n,t.count,t.size,t.source,e.exports[t.filter]),self.postMessage({id:t.id,count:t.count,action:`resolve`,value:n},[n.buffer])}catch(e){self.postMessage({id:t.id,count:t.count,action:`reject`,value:e})}})}return{ready:o,supported:!0,useWorkers:function(e){m(e)},decodeVertexBuffer:function(e,t,n,r,i){c(a,a.exports.meshopt_decodeVertexBuffer,e,t,n,r,a.exports[l[i]])},decodeIndexBuffer:function(e,t,n,r){c(a,a.exports.meshopt_decodeIndexBuffer,e,t,n,r)},decodeIndexSequence:function(e,t,n,r){c(a,a.exports.meshopt_decodeIndexSequence,e,t,n,r)},decodeGltfBuffer:function(e,t,n,r,i,o){c(a,a.exports[u[i]],e,t,n,r,a.exports[l[o]])},decodeGltfBufferAsync:function(e,t,n,r,i){return d.length>0?h(e,t,n,u[r],l[i]):o.then(function(){var o=new Uint8Array(e*t);return c(a,a.exports[u[r]],o,e,t,n,a.exports[l[i]]),o})}}})(),ts=class extends w{constructor(e){super(e),this.type=st}parse(e){let t=function(e,t){switch(e){case 1:throw Error(`THREE.HDRLoader: Read Error: `+(t||``));case 2:throw Error(`THREE.HDRLoader: Write Error: `+(t||``));case 3:throw Error(`THREE.HDRLoader: Bad File Format: `+(t||``));default:case 4:throw Error(`THREE.HDRLoader: Memory Error: `+(t||``))}},n=function(e,t,n){t||=1024;let r=e.pos,i=-1,a=0,o=``,s=String.fromCharCode.apply(null,new Uint16Array(e.subarray(r,r+128)));for(;0>(i=s.indexOf(`
`))&&a<t&&r<e.byteLength;)o+=s,a+=s.length,r+=128,s=String.fromCharCode.apply(null,new Uint16Array(e.subarray(r,r+128)));return-1<i&&(!1!==n&&(e.pos+=a+i+1),o+s.slice(0,i))},r=function(e){let r=/^#\?(\S+)/,i=/^\s*GAMMA\s*=\s*(\d+(\.\d+)?)\s*$/,a=/^\s*EXPOSURE\s*=\s*(\d+(\.\d+)?)\s*$/,o=/^\s*FORMAT=(\S+)\s*$/,s=/^\s*\-Y\s+(\d+)\s+\+X\s+(\d+)\s*$/,c={valid:0,string:``,comments:``,programtype:`RGBE`,format:``,gamma:1,exposure:1,width:0,height:0},l,u;for((e.pos>=e.byteLength||!(l=n(e)))&&t(1,`no header found`),(u=l.match(r))||t(3,`bad initial token`),c.valid|=1,c.programtype=u[1],c.string+=l+`
`;l=n(e),!1!==l;)if(c.string+=l+`
`,l.charAt(0)===`#`)c.comments+=l+`
`;else if((u=l.match(i))&&(c.gamma=parseFloat(u[1])),(u=l.match(a))&&(c.exposure=parseFloat(u[1])),(u=l.match(o))&&(c.valid|=2,c.format=u[1]),(u=l.match(s))&&(c.valid|=4,c.height=parseInt(u[1],10),c.width=parseInt(u[2],10)),c.valid&2&&c.valid&4)break;return c.valid&2||t(3,`missing format specifier`),c.valid&4||t(3,`missing image size specifier`),c},i=function(e,n,r){let i=n;if(i<8||i>32767||e[0]!==2||e[1]!==2||e[2]&128)return new Uint8Array(e);i!==(e[2]<<8|e[3])&&t(3,`wrong scanline width`);let a=new Uint8Array(4*n*r);a.length||t(4,`unable to allocate buffer space`);let o=0,s=0,c=4*i,l=new Uint8Array(4),u=new Uint8Array(c),d=r;for(;d>0&&s<e.byteLength;){s+4>e.byteLength&&t(1),l[0]=e[s++],l[1]=e[s++],l[2]=e[s++],l[3]=e[s++],(l[0]!=2||l[1]!=2||(l[2]<<8|l[3])!=i)&&t(3,`bad rgbe scanline format`);let n=0,r;for(;n<c&&s<e.byteLength;){r=e[s++];let i=r>128;if(i&&(r-=128),(r===0||n+r>c)&&t(3,`bad scanline data`),i){let t=e[s++];for(let e=0;e<r;e++)u[n++]=t}else u.set(e.subarray(s,s+r),n),n+=r,s+=r}let f=i;for(let e=0;e<f;e++){let t=0;a[o]=u[e+t],t+=i,a[o+1]=u[e+t],t+=i,a[o+2]=u[e+t],t+=i,a[o+3]=u[e+t],o+=4}d--}return a},a=function(e,t,n,r){let i=2**(e[t+3]-128)/255;n[r+0]=e[t+0]*i,n[r+1]=e[t+1]*i,n[r+2]=e[t+2]*i,n[r+3]=1},o=function(e,t,n,r){let i=2**(e[t+3]-128)/255;n[r+0]=A.toHalfFloat(Math.min(e[t+0]*i,65504)),n[r+1]=A.toHalfFloat(Math.min(e[t+1]*i,65504)),n[r+2]=A.toHalfFloat(Math.min(e[t+2]*i,65504)),n[r+3]=A.toHalfFloat(1)},s=new Uint8Array(e);s.pos=0;let c=r(s),l=c.width,u=c.height,d=i(s.subarray(s.pos),l,u),f,p,m;switch(this.type){case he:m=d.length/4;let e=new Float32Array(m*4);for(let t=0;t<m;t++)a(d,t*4,e,t*4);f=e,p=he;break;case st:m=d.length/4;let t=new Uint16Array(m*4);for(let e=0;e<m;e++)o(d,e*4,t,e*4);f=t,p=st;break;default:throw Error(`THREE.HDRLoader: Unsupported type: `+this.type)}return{width:l,height:u,data:f,header:c.string,gamma:c.gamma,exposure:c.exposure,type:p,colorSpace:Ve,minFilter:Fe,magFilter:Fe,generateMipmaps:!1,flipY:!0}}setDataType(e){return this.type=e,this}},ns=class extends ts{constructor(e){console.warn(`RGBELoader has been deprecated. Please use HDRLoader instead.`),super(e)}},rs={low:{pixelRatio:1,msaa:0,post:!1,bloom:!1,ao:!1,dof:!1,shadows:`none`,shadowSize:0,cascades:0,shadowFar:0,water:`env`,treeLeafCards:180,sceneryShare:.5,blades:0,tufts:600,gallery:0},medium:{pixelRatio:1.5,msaa:4,post:!0,bloom:!0,ao:!1,dof:!1,shadows:`single`,shadowSize:2048,cascades:1,shadowFar:60,water:`env`,treeLeafCards:340,sceneryShare:.8,blades:15e3,tufts:1500,gallery:14},high:{pixelRatio:2,msaa:4,post:!0,bloom:!0,ao:!0,dof:!0,shadows:`cascaded`,shadowSize:2048,cascades:3,shadowFar:320,water:`mirror`,treeLeafCards:520,sceneryShare:1,blades:4e4,tufts:3e3,gallery:24}},is=e=>rs[e],as=/swiftshader|llvmpipe|software|mali-[gt]\d{2}\b|adreno \(tm\) [3-5]\d\d|powervr|intel.*(hd|uhd) graphics \d{3}\b/i;function os(e){return as.test(e.gpu)?`low`:e.mobile&&e.minSide<500||e.cores>0&&e.cores<=4?`medium`:`high`}function ss(e,t){return e<=28?t:t===`high`?`medium`:`low`}function cs(e,t,n,r=4){let i=-1,a=0,o=0;for(let s=0;s<n;s++)for(let n=0;n<t;n++){let c=(s*t+n)*r,l=e[c]+e[c+1]+e[c+2];l>i&&(i=l,a=n,o=s)}let s=(a+.5)/t,c=1-(o+.5)/n;return{phi:(s-.5)*2*Math.PI,elevation:(c-.5)*Math.PI}}function ls(e,t,n,r,i=4){let a=.5+r/180,o=Math.min(Math.max(Math.round((1-a)*n-.5),0),n-1),s=0,c=0,l=0;for(let n=0;n<t;n++){let r=(o*t+n)*i;s+=e[r],c+=e[r+1],l+=e[r+2]}return[s/t,c/t,l/t]}var us=145*Math.PI/180,ds=48*Math.PI/180;function fs(e){let t=e?.elevation??ds,n=Math.cos(t);return{dir:[Math.sin(us)*n,Math.sin(t),Math.cos(us)*n],yaw:e?Math.PI/2-e.phi-us:0}}var ps={sky:null,grass:null,sand:null,water:null,trees:null,people:null},ms=()=>`/SchoolGames/fore/`;function hs(e,t,n){return e.wrapS=e.wrapT=_e,e.anisotropy=t,n&&(e.colorSpace=z),e}async function gs(e,t){let n=[],r=0,i=()=>t?.(Math.min(++r/16,1)),a=new Pe,o=async(t,n)=>{try{return hs(await a.loadAsync(ms()+t),e,n)}finally{i()}},s=async(e,t)=>{try{return await t()}catch{return n.push(e),null}},[c,l,u,d,f,p]=await Promise.all([s(`sky`,async()=>{let e=new ns().setDataType(he),[t,n]=await Promise.all([e.loadAsync(`${ms()}sky_env.hdr`).finally(i),a.loadAsync(`${ms()}sky_bg.webp`).finally(i)]);n.colorSpace=z,n.generateMipmaps=!1,n.minFilter=Fe,n.wrapS=_e;let{data:r,width:o,height:s}=t.image;return{hdr:t,dome:n,sun:cs(r,o,s,4),horizon:ls(r,o,s,2,4)}}),s(`grass`,async()=>({color:await o(`turf/grass_color.webp`,!0),normal:await o(`turf/grass_normal.webp`,!1),rough:null})),s(`sand`,async()=>({color:await o(`turf/sand_color.webp`,!0),normal:await o(`turf/sand_normal.webp`,!1),rough:await o(`turf/sand_rough.webp`,!1)})),s(`water`,()=>o(`turf/waternormals.jpg`,!1)),s(`trees`,async()=>{let[e,t,n,r]=await Promise.all([o(`trees/bark_color.webp`,!0),o(`trees/bark_normal.webp`,!1),o(`trees/leaves_oak.webp`,!0),o(`trees/leaves_pine.webp`,!0)]);return{barkColor:e,barkNormal:t,oak:n,pine:r}}),s(`people`,async()=>{let e=new en().setMeshoptDecoder(es),t=t=>e.loadAsync(`${ms()}people/${t}`).finally(i),[n,r,a,s]=await Promise.all([t(`golfer.glb`),t(`caddie.glb`),t(`hair.glb`),o(`people/fabric_normal.webp`,!1)]);return{golfer:n,caddie:r,hair:a,weave:s}})]);return n.length>0&&console.warn(`Fore!: could not load ${n.join(`, `)}; using the plain look instead.`),t?.(1),{sky:c,grass:l,sand:u,water:d,trees:f,people:p}}function _s(e){if([e.sky?.hdr,e.sky?.dome,e.grass?.color,e.grass?.normal,e.sand?.color,e.sand?.normal,e.sand?.rough,e.water,e.trees?.barkColor,e.trees?.barkNormal,e.trees?.oak,e.trees?.pine].forEach(e=>e?.dispose()),e.people){e.people.weave.dispose();for(let t of[e.people.golfer,e.people.caddie,e.people.hair])t.scene.traverse(e=>{let t=e;t.isMesh&&(t.geometry.dispose(),(Array.isArray(t.material)?t.material:[t.material]).forEach(e=>{for(let t of Object.values(e))t?.isTexture&&t.dispose();e.dispose()}))})}}var vs=.25,ys=1.4;function bs(e,t,n){let r=Math.imul(e,374761393)^Math.imul(t,668265263)^Math.imul(n,2147483647);return r=Math.imul(r^r>>>13,1274126177),((r^r>>>16)>>>0)/4294967296}function xs(e,t,n,r){let i=e/n,a=t/n,o=Math.floor(i),s=Math.floor(a),c=i-o,l=a-s,u=c*c*(3-2*c),d=l*l*(3-2*l),f=bs(o,s,r)+(bs(o+1,s,r)-bs(o,s,r))*u;return f+(bs(o,s+1,r)+(bs(o+1,s+1,r)-bs(o,s+1,r))*u-f)*d}var Ss=(e,t,n)=>{let r=Math.min(Math.max((n-e)/(t-e),0),1);return r*r*(3-2*r)};function Cs(e){let t=Ar.indexOf(e);return t>=0?t+1:Math.round(e.length*13+e.bend*101+3)}function ws(e,t,n){let r=Math.abs(t-jr(e,n));return n<0?r=Math.max(r,-n-30):n>e.length&&(r=Math.max(r,n-e.length-45)),r}function Ts(e,t,n){let r=Ss(62,110,ws(e,t,n));if(r<=0)return 0;let i=Cs(e),a=.25+.75*(.65*xs(t,n,70,i)+.35*xs(t,n,25,i+50));return r*4*a}function Es(e,t,n){return Math.hypot((t-e.x)/e.rx,(n-e.z)/e.rz)}function Ds(e,t,n){let r=Es(e,t,n);if(r<=1)return 0;let i=(t-e.x)/(e.rx*e.rx),a=(n-e.z)/(e.rz*e.rz);return(r-1)*r/Math.hypot(i,a)}function Os(e,t,n){let r=Ts(e,t,n);for(let i of e.hazards)if(i.kind===`sand`){let e=Es(i.at,t,n);e<1&&(r=Math.min(r,-.3*(1-e*e)))}else{let e=Ds(i.at,t,n);Es(i.at,t,n)<1?r=Math.min(r,-.25):e<1.4&&(r=Math.min(r,-.25*(1-e/ys)))}return r}var ks=256;function As(e,t){let n=s(t),r=Array.from({length:e*e},()=>n()),i=(t,n)=>r[n%e*e+t%e];return(t,n)=>{let r=t*e,a=n*e,o=Math.floor(r),s=Math.floor(a),c=r-o,l=a-s,u=c*c*(3-2*c),d=l*l*(3-2*l),f=i(o,s)+(i(o+1,s)-i(o,s))*u;return f+(i(o,s+1)+(i(o+1,s+1)-i(o,s+1))*u-f)*d}}function js(e){let t=[4,8,16,32].map((t,n)=>As(t,e+n));return(e,n)=>t.reduce((t,r,i)=>t+r(e,n)*.5**(i+1),0)/.9375}function Ms(e){let t=new Uint8Array(ks*ks*4),n=s(99),r=js(7);for(let i=0;i<ks;i++)for(let a=0;a<ks;a++){let o=a/ks,s=i/ks,[c,l,u]=e(o,s,r(o,s)),d=.94+n()*.06,f=(i*ks+a)*4;t[f]=Math.min(255,c*d*255),t[f+1]=Math.min(255,l*d*255),t[f+2]=Math.min(255,u*d*255),t[f+3]=255}let i=new R(t,ks,ks,ct);return i.wrapS=i.wrapT=_e,i.magFilter=Fe,i.minFilter=ot,i.generateMipmaps=!0,i.colorSpace=z,i.anisotropy=4,i.needsUpdate=!0,i}var Ns=e=>{let t=(e,t,n)=>e.map((e,r)=>e+(t[r]-e)*n),n=[.86,.96,.84],r=[1,1,.97],i=e<.5?t(n,r,e*2):t(r,[.96,1,.8],(e-.5)*2);return[i[0],i[1],i[2]]},Ps=null;function Fs(){return Ps??={grass:Ms((e,t,n)=>Ns(n)),fairway:Ms((e,t,n)=>{let[r,i,a]=Ns(n),o=e<.5?[.5,.78,.37]:[.435,.72,.325];return[r*o[0]*1.2,i*o[1]*1.2,a*o[2]*1.2]}),green:Ms((e,t,n)=>{let r=Math.hypot(e-.5,t-.5)*2,i=(.955+.045*Math.sin(r*16*Math.PI*2))*(.97+.03*n);return[i,i,i]}),sand:Ms((e,t,n)=>{let r=.86+.14*n;return[r,r*.99,r*.95]})},Ps}function Is(){Ps&&Object.values(Ps).forEach(e=>e.dispose())}function Ls(e,t,n){let r=e.getAttribute(`uv`);for(let e=0;e<r.count;e++)r.setXY(e,r.getX(e)*t,r.getY(e)*n);return r.needsUpdate=!0,e}function Rs(e){let t=e.getAttribute(`position`),n=e.index;for(let e=0;e<n.count;e+=3){let r=n.getX(e),i=n.getX(e+1),a=n.getX(e+2),o=t.getX(i)-t.getX(r),s=t.getZ(i)-t.getZ(r),c=t.getX(a)-t.getX(r),l=t.getZ(a)-t.getZ(r);s*c-o*l<0&&(n.setX(e+1,a),n.setX(e+2,i))}let r=[];for(let e=0;e<t.count;e++)r.push(0,1,0);return e.setAttribute(`normal`,new V(r,3)),e}function zs(e,t,n,r=12,i=8){let a=[];for(let t=0;t<e.length;t+=5)a.push(t);a.push(e.length);let o=[],s=[],c=[];a.forEach((a,l)=>{let u=jr(e,a);if(o.push(u+t,0,a,u+n,0,a),s.push((t+18)/r,a/i,(n+18)/r,a/i),l>0){let e=(l-1)*2;c.push(e,e+1,e+2,e+1,e+3,e+2)}});let l=new Ct;return l.setAttribute(`position`,new V(o,3)),l.setAttribute(`uv`,new V(s,2)),l.setIndex(c),Rs(l)}function Bs(e,t){let n=[],r=[];e.forEach((i,a)=>{let o=e[Math.max(a-1,0)],s=e[Math.min(a+1,e.length-1)],c=Math.hypot(s.x-o.x,s.z-o.z)||1,l=-(s.z-o.z)/c*(t/2),u=(s.x-o.x)/c*(t/2);if(n.push(i.x-l,0,i.z-u,i.x+l,0,i.z+u),a>0){let e=(a-1)*2;r.push(e,e+1,e+2,e+1,e+3,e+2)}});let i=new Ct;return i.setAttribute(`position`,new V(n,3)),i.setIndex(r),Rs(i)}var Vs={settings:rs.low,assets:ps,csm:null,sun:new Y(-.45,.62,-.64).normalize(),shadows:!1},Hs=e=>e.isMeshStandardMaterial||e.isMeshLambertMaterial||e.isMeshPhongMaterial;function Us(e,t){if(!e||e.shaders.has(t)||!Hs(t))return t;let n=t.onBeforeCompile;e.setupMaterial(t),t.needsUpdate=!0;let r=t.onBeforeCompile;return t.onBeforeCompile=(e,i)=>{r.call(t,e,i),n.call(t,e,i)},t}function Ws(e,t){e&&t.traverse(t=>{let n=t.material;n&&(Array.isArray(n)?n:[n]).forEach(t=>Us(e,t))})}function Gs(){let{CSMShader:e}=zt,t=ze.lights_fragment_begin,n=ze.lights_pars_begin;return ze.lights_fragment_begin=e.lights_fragment_begin,ze.lights_pars_begin=e.lights_pars_begin,()=>{ze.lights_fragment_begin=t,ze.lights_pars_begin=n}}function Ks(e,t){e?.shaders.delete(t)}var qs={rough:{colour:5271105,roughness:1,normal:1.6,tile:4},fairway:{colour:6589516,roughness:.85,normal:.6,tile:2.5},fringe:{colour:6458442,roughness:.85,normal:.5,tile:2.5},green:{colour:7447129,roughness:.7,normal:.3,tile:1.2},tee:{colour:6457930,roughness:.85,normal:.5,tile:2.5}},Js={rough:0,fairway:1,fringe:2,green:3,tee:4},Ys=1;function Xs(e,t){return e.assets.grass?qs[t].tile:8}var Zs=`
varying vec3 vTurfW;
`,Qs=`
varying vec3 vTurfW;
float tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(tHash(i), tHash(i + vec2(1.0, 0.0)), f.x),
             mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float tPar(float v) { return mod(floor(v), 2.0); }
// A mown band: 1 inside, 0 outside, with a soft 1.5 yd blend at each edge.
float tBand(float x, float width) {
  float u = mod(x, 2.0 * width);
  return smoothstep(0.0, 1.5, u) - smoothstep(width, width + 1.5, u);
}
float turfShade() {
  vec2 w = vTurfW.xz;
  float macro = (tNoise(w / MACRO_A) - 0.5) * 0.6 + (tNoise(w / MACRO_B) - 0.5) * 0.4;
  float k = 1.0 + TURF_MACRO * macro;
  // The stripes read from a distance and fade out close to the camera.
  float far = smoothstep(10.0, 50.0, length(vTurfW - cameraPosition));
  #if TURF_KIND == 1
    k *= 1.0 + 0.05 * far * (tBand(w.y, 6.0) * 2.0 - 1.0);
  #elif TURF_KIND == 3
    float a = tBand((w.x + w.y) * 0.70711, 3.0);
    float b = tBand((w.x - w.y) * 0.70711, 3.0);
    k *= 1.0 + 0.05 * far * (a + b - 1.0);
  #elif TURF_KIND == 4
    k *= 1.0 + 0.05 * far * (tBand(w.y, 2.0) * 2.0 - 1.0);
  #endif
  return k * ${Ys.toFixed(2)};
}
`,$s={sand:.6,water:1.4};function ec(e){return e.hazards.map(e=>ic(e.at,$s[e.kind]))}function tc(e,t){if(t.length===0)return e;let n=e.onBeforeCompile,r=t.map(e=>new le(e.x,e.z,e.rx,e.rz)),i=e.customProgramCacheKey.bind(e);return e.customProgramCacheKey=()=>`${i()}-cut${r.length}`,e.onBeforeCompile=(t,i)=>{n.call(e,t,i),t.uniforms.uCuts={value:r},t.vertexShader=t.vertexShader.replace(`void main() {`,`varying vec3 vCutW;
void main() {`).replace(`#include <project_vertex>`,`#include <project_vertex>
  vCutW = (modelMatrix * vec4(transformed, 1.0)).xyz;`),t.fragmentShader=t.fragmentShader.replace(`void main() {`,`varying vec3 vCutW;\nuniform vec4 uCuts[${r.length}];\nvoid main() {\n  for (int i = 0; i < ${r.length}; i++) {\n    vec2 d = (vCutW.xz - uCuts[i].xy) / uCuts[i].zw;\n    if (dot(d, d) < 1.0) discard;\n  }`)},e}function nc(e,t,n=[]){let r=qs[t],i=e.assets.grass,a=Fs(),o=new C({specularIntensity:.25,color:new m(i||t!==`fairway`?r.colour:16777215),roughness:r.roughness,map:i?i.color:t===`fairway`?a.fairway:t===`green`?a.green:a.grass,normalMap:i?i.normal:null,metalness:0});if(o.normalScale=new Ee(r.normal,r.normal),o.customProgramCacheKey=()=>`turf-${t}-${i?`photo`:`plain`}`,i){let e=t===`rough`;o.defines={TURF_KIND:Js[t],TURF_MACRO:e?`0.32`:`0.12`,MACRO_A:e?`34.0`:`35.0`,MACRO_B:e?`21.0`:`9.0`},o.onBeforeCompile=e=>{e.vertexShader=e.vertexShader.replace(`void main() {`,`${Zs}void main() {`).replace(`#include <project_vertex>`,`#include <project_vertex>
  vTurfW = (modelMatrix * vec4(transformed, 1.0)).xyz;`),e.fragmentShader=e.fragmentShader.replace(`void main() {`,`${Qs}void main() {`).replace(`#include <map_fragment>`,`#include <map_fragment>
  diffuseColor.rgb *= turfShade();`)}}return tc(o,n)}function rc(e){let t=e.assets.sand;return new x({color:14930598,roughness:.9,map:t?t.color:Fs().sand,normalMap:t?.normal??null,roughnessMap:t?.rough??null,metalness:0})}var ic=(e,t)=>({...e,rx:e.rx+t,rz:e.rz+t});function ac(e,t){let n=(e,t,n,r)=>{let i=[];for(let t=e;t<n;t+=12)i.push(t);for(let e=n;e<r;e+=4)i.push(e);for(let e=r;e<t;e+=12)i.push(e);return i.push(t),i},r=n(-500,500,-148,148),i=n(-300,e.length+500,-130,e.length+130),a=e.hazards.map(e=>ic(e.at,$s[e.kind])),o=r.length,s=new Float32Array(o*i.length*3),c=new Float32Array(o*i.length*3),l=new Float32Array(o*i.length*2),u=new Uint8Array(o*i.length),d=.5;i.forEach((n,i)=>{r.forEach((r,f)=>{let p=i*o+f,m=r,h=n,g=Ts(e,r,n);for(let e of a){let t=Math.hypot((m-e.x)/e.rx,(h-e.z)/e.rz);if(t<1){u[p]=1,m=e.x+(m-e.x)/Math.max(t,1e-6),h=e.z+(h-e.z)/Math.max(t,1e-6),g=0;break}}s.set([m,g,h],p*3),l.set([m/t,h/t],p*2);let _=Ts(e,r+d,n)-Ts(e,r-d,n),v=Ts(e,r,n+d)-Ts(e,r,n-d),y=new Y(-_/(2*d),1,-v/(2*d)).normalize();c.set([y.x,y.y,y.z],p*3)})});let f=[];for(let e=0;e<i.length-1;e++)for(let t=0;t<o-1;t++){let n=e*o+t,r=n+1,i=n+o,a=i+1;u[n]&&u[i]&&u[r]||f.push(n,i,r),u[r]&&u[i]&&u[a]||f.push(r,i,a)}let p=new Ct;return p.setAttribute(`position`,new V(s,3)),p.setAttribute(`normal`,new V(c,3)),p.setAttribute(`uv`,new V(l,2)),p.setIndex(f),p}function oc(e,t,n,r=48){let i=[],a=[],o=[];for(let o=0;o<=r;o++){let s=o/r*Math.PI*2,c=Math.cos(s),l=Math.sin(s);for(let[r,o]of t){let t=e.x+(e.rx+r)*c,s=e.z+(e.rz+r)*l;i.push(t,o,s),a.push(t/n,s/n)}}let s=t.length;for(let e=0;e<r;e++)for(let t=0;t<s-1;t++){let n=e*s+t,r=n+s;o.push(n,r,n+1,r,r+1,n+1)}let c=new Ct;return c.setAttribute(`position`,new V(i,3)),c.setAttribute(`uv`,new V(a,2)),c.setIndex(o),c.computeVertexNormals(),c}function sc(e,t,n,r=32,i=16){let a=[],o=[],s=[];for(let s=0;s<=i;s++){let c=s/i;for(let i=0;i<=r;i++){let s=i/r*Math.PI*2,l=e.x+e.rx*c*Math.cos(s),u=e.z+e.rz*c*Math.sin(s);a.push(l,t(l,u),u),o.push(l/n,u/n)}}let c=r+1;for(let e=0;e<i;e++)for(let t=0;t<r;t++){let n=e*c+t,r=n+c;s.push(n,n+1,r,r,n+1,r+1)}let l=new Ct;return l.setAttribute(`position`,new V(a,3)),l.setAttribute(`uv`,new V(o,2)),l.setIndex(s),l.computeVertexNormals(),l}var cc=28,lc=1.5,uc=3,dc=.1,fc=.95,pc=[7048100,10775403,9086059,10787435,8022948,7054490,10780779,9211020],mc=[3095119,9405030,4935509,5595210,6970698],hc=[16777215,15123622,12950134,10187088,7228468],gc=[2759440,5913122,9071164,1710618,7236196],_c=[15790320,3103290,2043727,9383727],vc=[`Hair_Buzzed`,`Hair_Long`,`Hair_SimpleParted`];function yc(e){return-e*55*Math.PI/180}function bc(e,t){let n=1.5,r=e=>((t.x-e.x)/(e.rx+n))**2+((t.z-e.z)/(e.rz+n))**2<1;return e.hazards.some(e=>r(e.at))||e.trees.some(e=>Math.hypot(t.x-e.x,t.z-e.z)<e.r+n)}function xc(e,t,n){let r=s(Math.round(e.length*17+e.bend*311+4242)),i=yc(t),a=55*Math.PI/180,o=(t,n)=>({x:e.pin.x+Math.sin(t)*n,z:e.pin.z+Math.cos(t)*n}),c=Math.floor(2*a*cc/uc)+1,l=[];for(let e=0;e<c;e++)l.push(o(i-a+e/(c-1)*2*a,cc));let u=[],d=2*a/Math.max(n,1);for(let t=0;t<n;t++){let n=o(i-a+(t+.5+(r()-.5)*.6)*d,cc+2+r()*3);if(bc(e,n))continue;let s=r()<.5,c=vc[Math.floor(r()*vc.length)],l=s&&r()<.4?[c,`Hair_Beard`]:[c];u.push({...n,yaw:Math.atan2(e.pin.x-n.x,e.pin.z-n.z),height:1.75+r()*.25,male:s,hair:l,shirt:pc[Math.floor(r()*pc.length)],trousers:mc[Math.floor(r()*mc.length)],skin:hc[Math.floor(r()*hc.length)],hairColour:gc[Math.floor(r()*gc.length)],cap:r()<.25?_c[Math.floor(r()*_c.length)]:null,phase:r()*Math.PI*2,rate:.2+r()*.2,late:r()*.3})}return{stakes:l,spots:u}}function Sc(e,t){return e.kind===`holed`||e.kind===`rest`&&Math.hypot(e.at.x-t.x,e.at.z-t.z)<=2}function Cc(e){return e<0||e>1.5?0:Math.min(e/.15,(lc-e)/.25,1)}function wc(e,t,n){let r=n.assets.people,i=n.settings.gallery;if(!r||i<=0)return null;let{stakes:a,spots:o}=xc(e,t,i),s=new M;s.name=`gallery`;let c=[],l=[],u=new x({color:16053488,roughness:.6});l.push(u);let d=new F(.035,.035,1.05,6);d.translate(0,1.05/2,0),c.push(d);let f=new q(d,u,a.length),p=new De;a.forEach((t,n)=>{f.setMatrixAt(n,p.makeTranslation(t.x,Os(e,t.x,t.z),t.z))}),f.frustumCulled=!1,f.castShadow=n.shadows,s.add(f);let m=[];for(let t=0;t+1<a.length;t++){let n=a[t],r=a[t+1],i=[0,.25,.5,.75,1].map(t=>{let i=n.x+(r.x-n.x)*t,a=n.z+(r.z-n.z)*t;return new Y(i,Os(e,i,a)+fc-dc*4*t*(1-t),a)});m.push(new Be(new b(i),6,.022,4))}let h=Pt(m);m.forEach(e=>e.dispose()),c.push(h);let g=new X(h,u);g.castShadow=n.shadows,s.add(g);let _=[];for(let t of o){let n=Qo(t.male?r.golfer:r.caddie,{outfit:{shirt:t.shirt,trousers:t.trousers,shoes:2763310,accent:16777215,accentOn:!1},accent:t.male?`glove`:`bib`,cap:t.cap,hair:t.hair.map(e=>({style:e,colour:t.hairColour})),hairSource:r.hair,weave:r.weave,height:t.height,face:!1,skin:t.skin,phase:t.phase,rate:t.rate});n.root.position.set(t.x,Os(e,t.x,t.z),t.z),n.root.rotation.y=t.yaw,s.add(n.root),_.push({person:n,spot:t})}Ws(n.csm,s),n.shadows&&s.traverse(e=>{e.isMesh&&(e.castShadow=!0)});let v=0,y=0;s.traverse(e=>{e.isMesh&&v++;let t=e;t.isSkinnedMesh&&t.visible&&(y+=t.skeleton.bones.length)});let S=-1/0,C=new Y(e.pin.x,0,e.pin.z);return{object:s,centre:yc(t),stats:{spectators:_.length,meshes:v,bones:y},update(e,t){let n=t.distanceTo(C)<=150;if(s.visible=n,!n)return;let r=e-S;for(let{person:t,spot:n}of _){let i=r-n.late;t.pose(e,Cc(i),i)}},clap(e){S=e},dispose(){_.forEach(e=>e.person.dispose()),l.forEach(e=>e.dispose()),c.forEach(e=>e.dispose()),f.dispose(),s.clear(),s.removeFromParent()}}}var Tc={full:{seconds:1.2,impact:.8},half:{seconds:1,impact:.65},putt:{seconds:1,impact:.6}};function Ec(e){return e.id===`putter`?`putt`:(e.id===`sand`||e.id===`wedge`)&&e.carry<=40?`half`:`full`}var Dc=e=>Tc[Ec(e)],Oc=[`hips`,`shoulders`,`slide`,`arms`,`cock`,`up`,`head`,`leadKnee`,`trailKnee`,`trailHeel`],kc=[[0,0,0,0,0,0,0,0,.25,.25,0],[.18,12,25,-.03,49,33,0,3,.27,.25,0],[.5,45,90,-.08,128,112,0,10,.45,.22,0],[.56,42,90,-.06,128,114,0,10,.45,.22,0],[.7,18,40,.04,57,52,0,5,.3,.25,.05],[.8,-35,-5,.1,-2,-8,0,0,.12,.3,.2],[.95,-60,-50,.12,-46,-66,.3,-35,.08,.4,.5],[1.1,-80,-85,.13,-101,-125,.7,-75,.05,.5,.9],[1.2,-90,-95,.14,-141,-167,.95,-85,.05,.55,1]],Ac=[[0,0,0,0,0,0,0,0,.2,.2,0],[.34,0,12,0,16,0,0,0,.2,.2,0],[.48,0,6.5,0,8.7,0,0,0,.2,.2,0],[.6,0,-.5,0,-.7,0,0,0,.2,.2,0],[.72,0,-6.5,0,-9,0,0,0,.2,.2,0],[.85,0,-10,0,-14,0,0,0,.2,.2,0],[1,0,-10,0,-14,0,.1,-5,.2,.2,0]];function jc(e,t,n){let r=e.length;if(n<=e[0][0])return e[0][t];if(n>=e[r-1][0])return e[r-1][t];let i=0;for(;n>e[i+1][0];)i++;let a=t=>e[t+1][0]-e[t][0],o=n=>(e[n+1][t]-e[n][t])/a(n),s=e=>{if(e===0||e===r-1)return 0;let t=o(e-1),n=o(e);if(t*n<=0)return 0;let i=2*a(e)+a(e-1),s=a(e)+2*a(e-1);return(i+s)/(i/t+s/n)},c=(n-e[i][0])/a(i),l=c*c,u=l*c;return(2*u-3*l+1)*e[i][t]+(u-2*l+c)*a(i)*s(i)+(-2*u+3*l)*e[i+1][t]+(u-l)*a(i)*s(i+1)}var Mc=Tc.full.impact;function Nc(e){let t=Tc.half;return e<=t.impact?e/t.impact*Mc:Mc+(e-t.impact)/(t.seconds-t.impact)*(Tc.full.seconds-Mc)}function Pc(e,t,n){let{seconds:r,impact:i}=Tc[e],a=Math.min(Math.max(t,0),r),o=e===`putt`?Ac:kc,s=e===`half`?Nc(a):a,c=Oc.map((e,t)=>jc(o,t+1,s)),l=Object.fromEntries(Oc.map((e,t)=>[e,c[t]]));if(e===`half`){let e=.55;l.hips*=e,l.shoulders*=e,l.slide*=e,l.arms*=e,l.cock*=e,l.head*=e,l.up*=e,l.leadKnee=.25+(l.leadKnee-.25)*e,l.trailKnee=.25+(l.trailKnee-.25)*e,l.trailHeel*=e}if(n){let e=Math.exp(-(((a-i)/.07)**2));l.arms+=n.arms*e,l.cock+=n.cock*e}return l}var Fc=Math.PI/180,Ic={driver:.95,iron3:.9,iron5:.85,iron7:.8,wedge:.72,sand:.72,putter:.55},Lc=e=>Ic[e]??.8,Rc={},zc=new x({color:3816772,roughness:.4,metalness:.3}),Bc=new x({color:12567756,roughness:.3,metalness:.7}),Vc=new x({color:1447450,roughness:.5}),Hc=new x({color:2302758,roughness:.9}),Uc=new x({color:14014943,roughness:.3,metalness:.6});function Wc(e,t){return{length:e,faceOff:.01,sole:.03,build(){let e=new M,n=new X(new ce(.012,.06,.09),Bc);return n.position.set(-.004,0,.012),n.rotation.z=t*Fc,e.add(n),e}}}Object.assign(Rc,{driver:{length:1.25,faceOff:.025,sole:.04,build(){let e=new M,t=new X(new pt(.5,16,12),zc);return t.scale.set(.1,.08,.12),t.position.set(-.025,0,.02),e.add(t),e}},iron3:Wc(1.1,22),iron5:Wc(1.07,28),iron7:Wc(1.02,36),wedge:Wc(.97,52),sand:Wc(.97,56),putter:{length:.95,faceOff:.01,sole:.015,build(){let e=new M,t=new X(new ce(.04,.03,.1),Vc);return t.position.set(-.01,0,.02),e.add(t),e}}});var Gc=e=>Rc[e]??Rc.iron7,Kc=.05;function qc(e){let t=Gc(e),n=new M;n.name=`club`;let r=t.length-Kc,i=[],a=e=>(i.push(e),e),o=new M;o.name=`grip`,n.add(o);let s=new X(a(new F(.011,.009,.25,8)),Hc);s.position.y=-.075,n.add(s);let c=new X(a(new F(.005,.0065,r-.2,6)),Uc);c.position.y=-.2-(r-.2)/2,n.add(c);let l=new M;l.name=`clubHead`,l.position.y=-r;let u=new X(a(new F(.007,.007,.07,6)),Bc);u.position.y=.035,l.add(u);let d=t.build();return l.add(d),n.add(l),{group:n,head:l,spec:{length:t.length,faceOff:t.faceOff,sole:t.sole},shaftLength:r,dispose(){i.forEach(e=>e.dispose()),d.traverse(e=>{e instanceof X&&e.geometry.dispose()}),n.removeFromParent()}}}var Jc=new Y(1,0,0),Yc=.98,Xc=-9,Zc=.45,Qc={driver:.5,iron3:.52,iron5:.55,iron7:.58,wedge:.62,sand:.62,putter:.75},$c=.09,el=new Y(.25,-1,.15),tl=new Y(-.2,-1,-.45);function nl(e,t,n=25){let r=[...t],i=r.length,a=.001,o=e(r),s=o.reduce((e,t)=>e+t*t,0);for(let t=0;t<n&&s>1e-10;t++){let t=o.map(()=>Array(i).fill(0));for(let n=0;n<i;n++){let i=1e-4*Math.max(1,Math.abs(r[n])),a=[...r];a[n]+=i;let s=e(a);for(let e=0;e<o.length;e++)t[e][n]=(s[e]-o[e])/i}let n=Array.from({length:i},(e,n)=>Array.from({length:i},(e,r)=>t.reduce((e,t)=>e+t[n]*t[r],0))),c=Array.from({length:i},(e,n)=>t.reduce((e,t,r)=>e+t[n]*o[r],0)),l=!1;for(let t=0;t<8&&!l;t++){let t=n.map((e,t)=>[...e.map((e,n)=>e+(t===n?a:0)),-c[t]]);for(let e=0;e<i;e++){let n=e;for(let r=e+1;r<i;r++)Math.abs(t[r][e])>Math.abs(t[n][e])&&(n=r);[t[e],t[n]]=[t[n],t[e]];for(let n=e+1;n<i;n++){let r=t[n][e]/(t[e][e]||1e-12);for(let a=e;a<=i;a++)t[n][a]-=r*t[e][a]}}let u=Array(i).fill(0);for(let e=i-1;e>=0;e--){let n=t[e][i];for(let r=e+1;r<i;r++)n-=t[e][r]*u[r];u[e]=n/(t[e][e]||1e-12)}let d=r.map((e,t)=>e+u[t]),f=e(d),p=f.reduce((e,t)=>e+t*t,0);Number.isFinite(p)&&p<s?(r.splice(0,i,...d),o=f,s=p,a=Math.max(a/4,1e-9),l=!0):a*=8}if(!l)break}return r}function rl(e,t,n){n.hips=-e.hips*Fc,n.twist=-(e.shoulders-e.hips)*Fc,n.slide=e.slide,n.lean=t*(1-.85*e.up),n.headYaw=(e.shoulders-e.head)*Fc,n.headPitch=-.3*(1-e.up);let r=e.leadKnee;n.lift=-Ma((r+e.trailKnee)/2);let i=e.trailHeel>.02?Math.max(e.trailKnee,Pa(n.lift,e.trailHeel)):e.trailKnee;n.legL.out=n.legR.out=.16,n.legL.raise=Na(r),n.legL.bend=r,n.legR.raise=Na(i),n.legR.bend=i,n.footL=0,n.footR=e.trailHeel}function il(e){e.legL.out=e.legR.out=.06,e.legL.bend=e.legR.bend=.05,e.legL.raise=e.legR.raise=Na(.05),e.lift=-Ma(.05)}function al(){let e=Ga({shirt:15887162,pants:2832981,hat:`cap`,hatColor:16777215,trousers:!0,glove:16777215,shoe:2303533,height:2}),t=new M;e.root.position.z=-.12,t.add(e.root);let n=Qa(e),r=e.scale,i=Oa.upperArm*r,a=(Oa.forearm+Oa.hand)*r,o=i+a,s=qc(`driver`);t.add(s.group);let c=`driver`,l=`full`,u=new Map,d={lean:.55,tilt:55,arm0:Xc,shaft0:8,fix:{arms:0,cock:0}},f=new Y,p=new Y,m=new Y,h=new Y,g=new Y,_=new Y,v=new Y,y=new Y,b=new Y,x=new Y,S=new Y,C=new Y,w=new Y,T=new Y,E=new Y,D=new Y,O=new Y,k=new Y,A=new De,j=new H,ee=new H,N=new H,te=new H,P=new H,ne=new H,re=new H,F=new H,ie=new H,I=new H,L=new Y,R=new Y,ae=e=>t.worldToLocal(e),z=e=>h.set(0,-Math.sin(e*Fc),Math.cos(e*Fc)),oe=(e,t)=>t.copy(h).multiplyScalar(Math.cos(e*Fc)).addScaledVector(Jc,-Math.sin(e*Fc)),se=()=>{t.updateMatrixWorld(!0),ae(e.shoulderL.getWorldPosition(f)),ae(e.shoulderR.getWorldPosition(p)),m.addVectors(f,p).multiplyScalar(.5)},ce=(e,t)=>{oe(e,g),v.subVectors(m,f);let n=v.dot(g),r=v.lengthSq()-t*t,i=-n+Math.sqrt(Math.max(n*n-r,0));y.copy(m).addScaledVector(g,i)},le=()=>{let e=$c;for(let t=0;t<6;t++){let t=1/0;for(let n of[.07,$c,.12]){b.copy(y).addScaledVector(_,n);let r=b.distanceTo(p)-o*.995;r<t&&(t=r,e=n)}let n=Math.max(t,y.distanceTo(f)-o*.995);if(n<=0)break;v.subVectors(m,y).normalize(),y.addScaledVector(v,n+.004)}return e},B=(e,t)=>(oe(e,_),le(),t.copy(y).addScaledVector(_,s.shaftLength)),ue=(e,t)=>{let n=`${e}:${t}`,r=u.get(n);if(r)return r;let i=Gc(e),a=qc(e),c=s;s=a;let l=new de,d=Lc(e),f=new Y,p=new Y,m=(e,t)=>{l.set(e,t),se()},h=Qc[e]??.58,g=Pc(t,0),_=nl(([e,t,n])=>(m(g,e),z(t),ce(Xc,o*Yc),B(n,p),f.set(-(hi+.012+i.faceOff),i.sole,d),[p.x-f.x,p.y-f.y,p.z-f.z,.15*((n-Xc)*Fc-Zc)]),[h,55,8]),v=Math.min(Math.max(_[0],.1),1.3),y=Math.min(Math.max(_[1],20),80),b=_[2],x=Xc,S=b-x,C=Pc(t,Tc[t].impact),w=nl(([e,t])=>{m(C,v),z(y);let n=x+C.arms+e;return ce(n,o*Yc),B(n+S+C.cock+t,p),f.set(-(hi+i.faceOff),i.sole,d),[p.x-f.x,p.y-f.y]},[0,0]);a.dispose(),s=c;let T={lean:v,tilt:y,arm0:x,shaft0:b,fix:{arms:w[0],cock:w[1]}};return u.set(n,T),T};class de{pose={lift:0,lean:0,twist:0,hips:0,slide:0,headPitch:0,headYaw:0,roll:0,footL:0,footR:0,armL:{raise:0,out:0,bend:0},armR:{raise:0,out:0,bend:0},legL:{raise:0,out:0,bend:0},legR:{raise:0,out:0,bend:0}};set(t,n){rl(t,n,this.pose),e.apply(this.pose)}}let fe=1,V=1,pe=null,me=new Y,he=new Y,ge=(n,r,s,c,l,u,d)=>{w.subVectors(r,n);let f=Math.min(Math.max(w.length(),Math.abs(i-a)+.001),o-.001);w.normalize();let p=(i*i-a*a+f*f)/(2*f),m=Math.sqrt(Math.max(i*i-p*p,0));T.copy(s).addScaledVector(w,-s.dot(w)),T.lengthSq()<1e-8&&T.set(0,0,1).addScaledVector(w,-w.z),T.normalize(),c.copy(n).addScaledVector(w,p).addScaledVector(T,m),d.copy(n).addScaledVector(w,f),E.subVectors(c,n).normalize(),O.copy(E).negate(),D.crossVectors(w,T).normalize(),k.crossVectors(D,O);let h=w.subVectors(d,c).normalize(),g=Math.atan2(-h.dot(k),-h.dot(O));g>0&&(D.negate(),k.negate(),g=Math.atan2(-h.dot(k),-h.dot(O))),A.makeBasis(D,O,k),j.setFromRotationMatrix(A),e.torso.getWorldQuaternion(N),t.getWorldQuaternion(ee),te.copy(ee).invert().multiply(N).invert(),l.copy(te).multiply(j),u.setFromAxisAngle(Jc,g)},_e=e=>{se(),z(d.tilt);let t=d.arm0+e.arms,n=t+(d.shaft0-d.arm0)+e.cock;ce(t,o*(Yc-.14*e.up)),oe(n,_);let r=le();b.copy(y).addScaledVector(_,r),ge(f,y,el,x,P,re,C),ge(p,b,tl,S,ne,F,C),O.copy(_).negate(),oe(n-90,D),k.crossVectors(D,O),A.makeBasis(D,O,k),ie.setFromRotationMatrix(A)},U=t=>{if(ae(e.handR.getWorldPosition(L)),t)R.set(-.35,.93,.1);else{let e=Math.min(Math.max((L.y-.06)/s.shaftLength,0),.85);R.set(-1,0,.25).normalize().multiplyScalar(Math.sqrt(1-e*e)),R.y=-e}R.normalize(),O.copy(R).negate(),D.copy(Jc).addScaledVector(O,-Jc.dot(O)).normalize(),k.crossVectors(D,O),A.makeBasis(D,O,k),I.setFromRotationMatrix(A)},ve=()=>{s.head.rotation.x=(90-d.tilt)*Fc},ye=e=>{e.id!==c&&(s.dispose(),s=qc(e.id),t.add(s.group),c=e.id),l=Ec(e),d=ue(e.id,l),ve()};ye({id:`driver`,carry:240});let be=null,xe=0,W={root:t,person:e,get skin(){return pe},setClub:ye,play(r,i,a){r!==be&&(n.transition(be===null||r===`address`?.12:.1),be=r),xe+=a;let o=Tc[l],c=Pc(l,0,d.fix);V=1,n.step(a,e=>{switch(r){case`address`:c=Pc(l,0,d.fix),c.cock+=Math.sin(xe*2*Math.PI*1.3)*2*(l===`putt`?0:1),rl(c,d.lean,e),e.lift+=Math.sin(xe*1.8)*.004;break;case`swing`:c=Pc(l,Math.min(i,o.seconds),d.fix),rl(c,d.lean,e);break;case`follow`:c=Pc(l,o.seconds,d.fix),rl(c,d.lean,e),e.twist+=Math.sin(xe*2)*.02,e.lift+=Math.sin(xe*1.8)*.003;break;case`cheer`:V=0,il(e),e.armL.raise=e.armR.raise=2.6+Math.sin(i*12)*.2,e.armL.out=e.armR.out=.35,e.lift+=Math.abs(Math.sin(i*9))*.08,e.headPitch=.2;break;case`groan`:V=0,il(e),e.lean=.35,e.headPitch=-.6,e.armL.raise=e.armR.raise=.15,e.armL.out=e.armR.out=.05,e.lift-=.03,e.roll=Math.sin(i*3)*.04}});let u=a/.15;fe=V>fe?Math.min(V,fe+u):Math.max(V,fe-u);let f=fe;if(V===1||f>0){_e(c);let n=f*f*(3-2*f);e.shoulderL.quaternion.slerp(P,n),e.shoulderR.quaternion.slerp(ne,n),e.elbowL.quaternion.slerp(re,n),e.elbowR.quaternion.slerp(F,n),t.updateMatrixWorld(!0),U(r===`cheer`),s.group.position.copy(y),s.group.quaternion.copy(ie),n<1&&(ae(e.handR.getWorldPosition(L)),s.group.position.lerpVectors(L,y,n),s.group.quaternion.copy(I).slerp(ie,n))}else t.updateMatrixWorld(!0),U(r===`cheer`),s.group.position.copy(L),s.group.quaternion.copy(I);pe&&(t.getWorldQuaternion(ee),me.set(0,-1,0).applyQuaternion(s.group.quaternion).applyQuaternion(ee),pe.update(me,V===1||f>0?f*f*(3-2*f):0),s.group.position.add(he.copy(pe.clubShift).applyQuaternion(ee.invert())),s.group.updateMatrixWorld(!0))},setModel(t,n=!1){pe?.dispose(),pe=null,t&&(pe=Go(t.golfer,e,{outfit:xo,accent:`glove`,cap:16053492,hair:[{style:`Hair_SimpleParted`,colour:7031340}],hairSource:t.hair,weave:t.weave,height:2,face:!0}),pe.setShadows(n),W.play(`address`,0,0))},stand(e,n,r,i=()=>0){let a=Lc(r),o={x:-Math.cos(n),z:Math.sin(n)};t.rotation.y=n-Math.PI/2;let s=e.x-o.x*a,c=e.z-o.z*a;t.position.set(s,i(s,c),c)},dispose(){pe?.dispose(),s.dispose()}};return W.play(`address`,0,1),W}function ol(e){return e===`water`?16730955:e===`sand`?16758832:16777215}var sl=24,cl=2,ll=.5,ul=16730955,dl=40;function fl(e=1){let t=new M,n=e=>new B({color:16777215,transparent:!0,opacity:e,depthTest:!1,depthWrite:!1,toneMapped:!1}),r=(t,n)=>t.color.setHex(n).multiplyScalar(e),i=n(.95),a=n(.22),o=n(.85),s=n(.9),c=new X(new be(.82,1,40),i);c.rotation.x=-Math.PI/2,c.renderOrder=20;let l=n(.35);l.blending=2;let u=new X(new be(.7,1.25,40),l);u.rotation.x=-Math.PI/2,u.renderOrder=19;let d=new X(new I(.82,32),a);d.rotation.x=-Math.PI/2,d.renderOrder=19;let f=new I(.28,8),p=[];for(let e=0;e<dl;e++){let e=new X(f,o);e.rotation.x=-Math.PI/2,e.renderOrder=18,p.push(e),t.add(e)}let m=new I(.22,8),h=[];for(let e=0;e<sl;e++){let e=new X(m,s);e.rotation.x=-Math.PI/2,e.renderOrder=18,h.push(e),t.add(e)}let g=new X(new be(.6,.9,20),s);g.rotation.x=-Math.PI/2,g.renderOrder=18,t.add(g);let _=n(.4),v=new X(new F(1,1,1,20,1,!0),_);return v.renderOrder=17,t.add(c,u,d,v),{object:t,update(e,t,n,f,m=()=>0){let y=ol(t);for(let e of[i,l])r(e,y);for(let e of[a,_])e.color.setHex(y);let b=e.ringR,x=m(e.landing.x,e.landing.z);c.position.set(e.landing.x,x+.35,e.landing.z),c.scale.setScalar(b),u.position.copy(c.position),u.scale.setScalar(b),d.position.copy(c.position),d.scale.setScalar(b);let S=3+b*.6;v.scale.set(b*.35,S,b*.35),v.position.set(e.landing.x,x+S/2,e.landing.z),r(o,f?ul:16777215);let C=e.landing.x-e.from.x,w=e.landing.z-e.from.z,T=Math.hypot(C,w),E=Math.max(T-b,0),D=Math.min(dl,Math.max(Math.floor(E/4),0));p.forEach((t,n)=>{if(t.visible=n<D,!t.visible)return;let r=(n+1)/(D+1)*E+1.5,i=e.from.x+C/T*r,a=e.from.z+w/T*r;t.position.set(i,m(i,a)+.3,a),t.scale.setScalar(.6+r/Math.max(T,1)*1.6)});let O=n.kind===`rest`&&n.tree===void 0?n.at:n.kind===`water`?n.splash:null,k=O?Math.hypot(O.x-e.landing.x,O.z-e.landing.z):0,A=!!O&&!Gr(e)&&k>=ll;g.visible=A;let j=n.kind===`water`||n.kind===`rest`&&n.surface===`sand`;r(s,j?ul:16777215),h.forEach((t,n)=>{let r=(n+1)*cl;if(t.visible=A&&r<k-.9,!t.visible||!O)return;let i=r/k,a=e.landing.x+(O.x-e.landing.x)*i,o=e.landing.z+(O.z-e.landing.z)*i;t.position.set(a,m(a,o)+.3,o)}),A&&O&&g.position.set(O.x,m(O.x,O.z)+.3,O.z)},setVisible(e){t.visible=e}}}var pl=class extends X{constructor(e,t={}){super(e),this.isWater=!0;let n=this,r=t.textureWidth===void 0?512:t.textureWidth,i=t.textureHeight===void 0?512:t.textureHeight,a=t.clipBias===void 0?0:t.clipBias,o=t.alpha===void 0?1:t.alpha,s=t.time===void 0?0:t.time,c=t.waterNormals===void 0?null:t.waterNormals,l=t.sunDirection===void 0?new Y(.70707,.70707,0):t.sunDirection,u=new m(t.sunColor===void 0?16777215:t.sunColor),d=new m(t.waterColor===void 0?8355711:t.waterColor),f=t.eye===void 0?new Y(0,0,0):t.eye,p=t.distortionScale===void 0?20:t.distortionScale,h=t.side===void 0?0:t.side,g=t.fog!==void 0&&t.fog,_=new se,v=new Y,y=new Y,b=new Y,x=new De,S=new Y(0,0,-1),C=new le,w=new Y,T=new Y,E=new le,D=new De,O=new P,k=new wt(r,i,{type:st}),A={name:`MirrorShader`,uniforms:W.merge([xe.fog,xe.lights,{normalSampler:{value:null},mirrorSampler:{value:null},alpha:{value:1},time:{value:0},size:{value:1},distortionScale:{value:20},textureMatrix:{value:new De},sunColor:{value:new m(8355711)},sunDirection:{value:new Y(.70707,.70707,0)},eye:{value:new Y},waterColor:{value:new m(5592405)}}]),vertexShader:`
				uniform mat4 textureMatrix;
				uniform float time;

				varying vec4 mirrorCoord;
				varying vec4 worldPosition;

				#include <common>
				#include <fog_pars_vertex>
				#include <shadowmap_pars_vertex>
				#include <logdepthbuf_pars_vertex>

				void main() {
					mirrorCoord = modelMatrix * vec4( position, 1.0 );
					worldPosition = mirrorCoord.xyzw;
					mirrorCoord = textureMatrix * mirrorCoord;
					vec4 mvPosition =  modelViewMatrix * vec4( position, 1.0 );
					gl_Position = projectionMatrix * mvPosition;

				#include <beginnormal_vertex>
				#include <defaultnormal_vertex>
				#include <logdepthbuf_vertex>
				#include <fog_vertex>
				#include <shadowmap_vertex>
			}`,fragmentShader:`
				uniform sampler2D mirrorSampler;
				uniform float alpha;
				uniform float time;
				uniform float size;
				uniform float distortionScale;
				uniform sampler2D normalSampler;
				uniform vec3 sunColor;
				uniform vec3 sunDirection;
				uniform vec3 eye;
				uniform vec3 waterColor;

				varying vec4 mirrorCoord;
				varying vec4 worldPosition;

				vec4 getNoise( vec2 uv ) {
					vec2 uv0 = ( uv / 103.0 ) + vec2(time / 17.0, time / 29.0);
					vec2 uv1 = uv / 107.0-vec2( time / -19.0, time / 31.0 );
					vec2 uv2 = uv / vec2( 8907.0, 9803.0 ) + vec2( time / 101.0, time / 97.0 );
					vec2 uv3 = uv / vec2( 1091.0, 1027.0 ) - vec2( time / 109.0, time / -113.0 );
					vec4 noise = texture2D( normalSampler, uv0 ) +
						texture2D( normalSampler, uv1 ) +
						texture2D( normalSampler, uv2 ) +
						texture2D( normalSampler, uv3 );
					return noise * 0.5 - 1.0;
				}

				void sunLight( const vec3 surfaceNormal, const vec3 eyeDirection, float shiny, float spec, float diffuse, inout vec3 diffuseColor, inout vec3 specularColor ) {
					vec3 reflection = normalize( reflect( -sunDirection, surfaceNormal ) );
					float direction = max( 0.0, dot( eyeDirection, reflection ) );
					specularColor += pow( direction, shiny ) * sunColor * spec;
					diffuseColor += max( dot( sunDirection, surfaceNormal ), 0.0 ) * sunColor * diffuse;
				}

				#include <common>
				#include <packing>
				#include <bsdfs>
				#include <fog_pars_fragment>
				#include <logdepthbuf_pars_fragment>
				#include <lights_pars_begin>
				#include <shadowmap_pars_fragment>
				#include <shadowmask_pars_fragment>

				void main() {

					#include <logdepthbuf_fragment>
					vec4 noise = getNoise( worldPosition.xz * size );
					vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );

					vec3 diffuseLight = vec3(0.0);
					vec3 specularLight = vec3(0.0);

					vec3 worldToEye = eye-worldPosition.xyz;
					vec3 eyeDirection = normalize( worldToEye );
					sunLight( surfaceNormal, eyeDirection, 100.0, 2.0, 0.5, diffuseLight, specularLight );

					float distance = length(worldToEye);

					vec2 distortion = surfaceNormal.xz * ( 0.001 + 1.0 / distance ) * distortionScale;
					vec3 reflectionSample = vec3( texture2D( mirrorSampler, mirrorCoord.xy / mirrorCoord.w + distortion ) );

					float theta = max( dot( eyeDirection, surfaceNormal ), 0.0 );
					float rf0 = 0.02;
					float reflectance = rf0 + ( 1.0 - rf0 ) * pow( ( 1.0 - theta ), 5.0 );
					vec3 scatter = max( 0.0, dot( surfaceNormal, eyeDirection ) ) * waterColor;
					vec3 albedo = mix( ( sunColor * diffuseLight * 0.3 + scatter ) * getShadowMask(), reflectionSample + specularLight, reflectance );
					vec3 outgoingLight = albedo;
					gl_FragColor = vec4( outgoingLight, alpha );

					#include <tonemapping_fragment>
					#include <colorspace_fragment>
					#include <fog_fragment>	
				}`},j=new gt({name:A.name,uniforms:W.clone(A.uniforms),vertexShader:A.vertexShader,fragmentShader:A.fragmentShader,lights:!0,side:h,fog:g});j.uniforms.mirrorSampler.value=k.texture,j.uniforms.textureMatrix.value=D,j.uniforms.alpha.value=o,j.uniforms.time.value=s,j.uniforms.normalSampler.value=c,j.uniforms.sunColor.value=u,j.uniforms.waterColor.value=d,j.uniforms.sunDirection.value=l,j.uniforms.distortionScale.value=p,j.uniforms.eye.value=f,n.material=j,n.onBeforeRender=function(e,t,r){if(y.setFromMatrixPosition(n.matrixWorld),b.setFromMatrixPosition(r.matrixWorld),x.extractRotation(n.matrixWorld),v.set(0,0,1),v.applyMatrix4(x),w.subVectors(y,b),w.dot(v)>0)return;w.reflect(v).negate(),w.add(y),x.extractRotation(r.matrixWorld),S.set(0,0,-1),S.applyMatrix4(x),S.add(b),T.subVectors(y,S),T.reflect(v).negate(),T.add(y),O.position.copy(w),O.up.set(0,1,0),O.up.applyMatrix4(x),O.up.reflect(v),O.lookAt(T),O.far=r.far,O.updateMatrixWorld(),O.projectionMatrix.copy(r.projectionMatrix),D.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),D.multiply(O.projectionMatrix),D.multiply(O.matrixWorldInverse),_.setFromNormalAndCoplanarPoint(v,y),_.applyMatrix4(O.matrixWorldInverse),C.set(_.normal.x,_.normal.y,_.normal.z,_.constant);let i=O.projectionMatrix;E.x=(Math.sign(C.x)+i.elements[8])/i.elements[0],E.y=(Math.sign(C.y)+i.elements[9])/i.elements[5],E.z=-1,E.w=(1+i.elements[10])/i.elements[14],C.multiplyScalar(2/C.dot(E)),i.elements[2]=C.x,i.elements[6]=C.y,i.elements[10]=C.z+1-a,i.elements[14]=C.w,f.setFromMatrixPosition(r.matrixWorld);let o=e.getRenderTarget(),s=e.xr.enabled,c=e.shadowMap.autoUpdate;n.visible=!1,e.xr.enabled=!1,e.shadowMap.autoUpdate=!1,e.setRenderTarget(k),e.state.buffers.depth.setMask(!0),e.autoClear===!1&&e.clear(),e.render(t,O),n.visible=!0,e.xr.enabled=s,e.shadowMap.autoUpdate=c,e.setRenderTarget(o);let l=r.viewport;l!==void 0&&e.state.viewport(l)}}},ml=58,hl=1.4;function gl(e){let t=Ar.indexOf(e);return t===0?{x:-85,z:-25,yaw:0}:t===Ar.length-1?{x:0,z:e.length+90,yaw:Math.PI/2}:null}var _l=[16767050,16777215,16748464],vl=(e,t,n)=>t+(n-t)*e();function yl(e,t,n){let r=[],i=(t,n)=>{let i=e(),a=i<.45?`pine`:i<.8?`oak`:`birch`,o=vl(e,.85,1.15);r.push({x:t,z:n,species:a,scale:o,yaw:e()*Math.PI*2,height:vl(e,10.6,13.9)*o,r:vl(e,3.53,5.2)*o})};for(let n of[-1,1]){let r=[];for(let n=vl(e,120,200)-40;n<t.length+60;n+=vl(e,120,200))r.push([n,n+vl(e,25,45)]);for(let a=0;a<2;a++){let o=64+a*24,s=-40+e()*4;for(;s<t.length+60;){let a=r.find(([e,t])=>s>=e&&s<=t);if(a){s=a[1]+1;continue}let c=Math.min(o+vl(e,-2,8),128);i(jr(t,s)+n*c,s),s+=vl(e,9,15)}}}for(let r of[-1,1]){for(let t=0;t<12;t++)i(r*vl(e,62,100),vl(e,-60,-22));let a=r===n?34:12;for(let n=0;n<a;n++)i(r*vl(e,62,90),t.length+vl(e,26,90))}if(r.length<=250)return r;let a=240/r.length;return r.filter(()=>e()<a).slice(0,250)}function bl(e){let t=s(Math.round(e.length*53+e.bend*211+99)),n=[],r=(e,r)=>{let i=t(),a=vl(t,.9,1.2);n.push({x:e,z:r,species:i<.4?`pine`:i<.85?`oak`:`birch`,scale:a,yaw:t()*Math.PI*2,height:vl(t,11,14.5)*a,r:vl(t,3.8,5)*a})};for(let n of[-1,1])for(let i=0;i<2;i++){let a=100+i*30+vl(t,0,12);for(let o=-40+i*4;o<e.length+60;o+=vl(t,7,10)){let i=Math.min(a+vl(t,-6,10),170);r(jr(e,o)+n*i,o)}}for(let n=0;n<2;n++){let i=e.length+100+n*30;for(let e=-170;e<=170;e+=vl(t,7,10))r(e,i+vl(t,-6,10))}return n}function xl(e,t){let n=[],r=[],i=()=>{r.length>1&&n.push(r),r=[]};for(let n=0;n<=e.length;n+=5){let a={x:jr(e,n)+t*26,z:n};e.hazards.some(e=>Mr({...e.at,rx:e.at.rx+1.5,rz:e.at.rz+1.5},a.x,a.z))||e.trees.some(e=>Math.hypot(a.x-e.x,a.z-e.z)<e.r+2.5)?i():r.push(a)}return i(),n}function Sl(e){let t=s(Math.round(e.length*31+e.bend*977+12345)),n=t()<.5?-1:1,r=yl(t,e,n),i=bl(e),a=(t,r)=>r>=-3&&r<=e.length+3&&Math.abs(t-jr(e,r)-n*26)<2.7,o=(t,n,r)=>!e.hazards.some(e=>Mr({...e.at,rx:e.at.rx+2+r,rz:e.at.rz+2+r},t,n))&&!e.trees.some(e=>Math.hypot(t-e.x,n-e.z)<e.r+r+2)&&!a(t,n)&&Math.hypot(t-e.pin.x,n-e.pin.z)>20,c=[],l=90+Math.floor(t()*60);for(let n=0;c.length<l&&n<400;n++){let n=t()<.5?-1:1,r=vl(t,-10,e.length+20),i=jr(e,r)+n*vl(t,27,52),a=3+Math.floor(t()*3);for(let n=0;n<a&&c.length<200;n++){let n=i+vl(t,-2.5,2.5),a=r+vl(t,-2.5,2.5),s=vl(t,.5,1.2),l=Math.abs(n-jr(e,a));l>=22.5&&l<=ml&&o(n,a,s)&&c.push({x:n,z:a,r:s})}}let u=[],d=4+Math.floor(t()*5);for(let n=0;u.length<d&&n<200;n++){let n=t()<.5?-1:1,r=vl(t,10,e.length+10),i=jr(e,r)+n*vl(t,24,56),a=vl(t,.3,.9);o(i,r,a)&&u.push({x:i,z:r,r:a,yaw:t()*Math.PI*2})}let f=[],p=6+Math.floor(t()*5);for(let n=0,r=0;r<p&&n<200;n++){let n=t()<.5?-1:1,i=r<2,a=i?vl(t,-4,6):vl(t,0,e.length),s=i?n*vl(t,6.5,11):jr(e,a)+n*vl(t,30,55);if(!o(s,a,2))continue;r++;let c=_l[Math.floor(t()*_l.length)],l=12+Math.floor(t()*13);for(let e=0;e<l;e++){let e=t()*Math.PI*2,n=Math.sqrt(t())*1.8;f.push({x:s+Math.cos(e)*n,z:a+Math.sin(e)*n,color:t()<.8?c:_l[Math.floor(t()*3)]})}}let m=gl(e);if(!m)return{trees:r,woods:i,bushes:c,rocks:u,flowers:f,groveSide:n};let h=e=>Math.hypot(e.x-m.x,e.z-m.z)>=30;return{trees:r.filter(h),woods:i.filter(h),bushes:c.filter(h),rocks:u.filter(h),flowers:f.filter(h),groveSide:n}}var Cl=[.05,.11],wl=[.3,.6],Tl=(e,t,n,r)=>e.hazards.some(e=>Mr({...e.at,rx:e.at.rx+r,rz:e.at.rz+r},t,n));function El(e,t,n,r){let i=s(r),a=[];for(let r=0;a.length<n&&r<n*4;r++){let n=i()*Math.PI*2,r=22*Math.sqrt(i()),o=t.x+Math.cos(n)*r,s=t.z+Math.sin(n)*r,c=i()*Math.PI*2,l=Cl[0]+(Cl[1]-Cl[0])*i(),u=i();if(Nr(e,o,s)===`rough`&&!Tl(e,o,s,2)&&!(Math.abs(o)<5&&s>-6&&s<6)&&!(Math.hypot(o-e.pin.x,s-e.pin.z)<22)){if(s>=-3&&s<=e.length+3){let t=Math.abs(o-jr(e,s));if(Math.abs(t-26)<1.4)continue}a.push({x:o,z:s,yaw:c,height:l,mix:u})}}return a}function Dl(e,t,n=1){let r=s(n+Math.round(e.length*7+e.bend*13)),i=gl(e),a=[];for(let n=0;a.length<t&&n<t*3;n++){let t=-40+r()*(e.length+130),n=66+74*r(),o=jr(e,t)+(r()<.5?-1:1)*n,s=r()*Math.PI*2,c=wl[0]+(wl[1]-wl[0])*r(),l=r();Tl(e,o,t,3)||i&&Math.hypot(o-i.x,t-i.z)<30||a.push({x:o,z:t,yaw:s,height:c,mix:l})}return a}function Ol(e,t,n,r){let i=e.onBeforeCompile,a=e.customProgramCacheKey.bind(e);return e.customProgramCacheKey=()=>`${a()}-${r}`,e.onBeforeCompile=(r,a)=>{i.call(e,r,a),r.uniforms.uTime=t,r.vertexShader=r.vertexShader.replace(`void main() {`,`uniform float uTime;
void main() {`).replace(`#include <begin_vertex>`,`#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 swayBase = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        #else
          vec3 swayBase = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        #endif
        float swayPhase = swayBase.x * 0.7 + swayBase.z * 0.9;
        ${n}`)},e}function kl(){let e=new Ct;return e.setAttribute(`position`,new V([-.07,0,0,.07,0,0,.3,1,.05],3)),e.setAttribute(`normal`,new V([0,.3,1,0,.3,1,0,.3,1],3)),e.setAttribute(`color`,new V([.55,.55,.55,.55,.55,.55,1,1,1],3)),e}function Al(){let e=s(5),t=[];for(let n=0;n<12;n++){let r=n/12*Math.PI*2+e()*.4,i=.1+e()*.45,a=.7+e()*.3,o=.05+e()*.03,s=new Ct;s.setAttribute(`position`,new V([-o,0,0,o,0,0,i*.35,a,i*.12],3)),s.setAttribute(`normal`,new V([0,.4,1,0,.4,1,0,.4,1],3)),s.setAttribute(`color`,new V([.5,.5,.5,.5,.5,.5,1,1,1],3)),s.rotateY(r);let c=s.getAttribute(`position`);for(let e=0;e<c.count;e++){let t=c.getY(e),n=i*t;c.setXYZ(e,c.getX(e)+Math.cos(r)*n,t,c.getZ(e)+Math.sin(r)*n)}t.push(s)}let n=Pt(t,!1);return t.forEach(e=>e.dispose()),n}var jl=(e,t,n,r)=>e.copy(t).lerp(n,r);function Ml(e,t){let n=Dl(e,t);if(n.length===0)return{mesh:null,update(){},dispose(){}};let r={value:0},i=Al(),a=Ol(new x({color:16777215,vertexColors:!0,side:2,roughness:.9}),r,`transformed.x += sin(uTime * 2.2 + swayPhase) * 0.09 * position.y;
 transformed.z += cos(uTime * 1.7 + swayPhase * 1.3) * 0.06 * position.y;`,`tuft`),o=new q(i,a,n.length),s=new ie,c=new m(12103786),l=new m(9411154),u=new m;return n.forEach((t,n)=>{s.position.set(t.x,Os(e,t.x,t.z),t.z),s.rotation.set(0,t.yaw,0),s.scale.setScalar(t.height),s.updateMatrix(),o.setMatrixAt(n,s.matrix),o.setColorAt(n,jl(u,c,l,t.mix))}),o.frustumCulled=!1,{mesh:o,update:e=>r.value=e,dispose(){o.removeFromParent(),o.dispose(),i.dispose(),a.dispose()}}}function Nl(e){let t=new M;if(e<=0)return{object:t,rebuild(){},update(){},dispose:()=>t.removeFromParent()};let n={value:0},r=kl(),i=Ol(new x({color:16777215,vertexColors:!0,side:2,roughness:.85}),n,`transformed.x += sin(uTime * 2.6 + swayPhase * 3.0) * 0.18 * position.y;`,`blade`),a=new q(r,i,e);a.frustumCulled=!1,a.count=0,t.add(a);let o=new ie,s=new m(6127420),c=new m(8165962),l=new m;return{object:t,rebuild(t,n,r){let i=El(t,n,e,r);i.forEach((e,n)=>{o.position.set(e.x,Os(t,e.x,e.z),e.z),o.rotation.set(0,e.yaw,0),o.scale.set(e.height,e.height,e.height),o.updateMatrix(),a.setMatrixAt(n,o.matrix),a.setColorAt(n,jl(l,s,c,e.mix))}),a.count=i.length,a.instanceMatrix.needsUpdate=!0,a.instanceColor&&(a.instanceColor.needsUpdate=!0)},update:e=>n.value=e,dispose(){t.removeFromParent(),a.dispose(),r.dispose(),i.dispose()}}}var Pl={oak:{height:12,radius:4.6},pine:{height:12,radius:3.8},birch:{height:12,radius:1.9}},Fl=520,Il={oak:100,pine:200,birch:300},Ll=(e,t)=>[e[0]+t[0],e[1]+t[1],e[2]+t[2]],Rl=(e,t)=>[e[0]*t,e[1]*t,e[2]*t],zl=(e,t)=>e[0]*t[0]+e[1]*t[1]+e[2]*t[2],Bl=(e,t)=>[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]],Vl=e=>{let t=Math.hypot(e[0],e[1],e[2])||1;return[e[0]/t,e[1]/t,e[2]/t]},Hl=(e,t,n)=>t+(n-t)*e(),Ul=(e,t)=>[Math.sin(e)*Math.cos(t),Math.cos(e),Math.sin(e)*Math.sin(t)];function Wl(e){let t=Vl(Bl(Math.abs(e[1])>.95?[1,0,0]:[0,1,0],e));return{right:t,up:Bl(e,t)}}function Gl(e){let{right:t,up:n}=Wl(e.normal),r=Math.cos(e.spin),i=Math.sin(e.spin);return{right:Ll(Rl(t,r),Rl(n,i)),up:Ll(Rl(n,r),Rl(t,-i))}}var Kl=(e,t)=>{let{right:n,up:r}=Wl(e);return Math.atan2(zl(t,r),zl(t,n))},ql=(e,t,n=2.2)=>Math.min(e*Math.min(Math.max((Fl/Math.max(t,1))**.35,.9),2),n);function Jl(e,t,n,r,i,a,o,s){let c=s(Ll(t,Rl(n,r))),l=a>0?.7:.35;if(o.segments.push({from:t,to:c,r0:i,r1:i*l}),a===0){o.tips.push(c);return}let u=Vl([c[0]-t[0],c[1]-t[1],c[2]-t[2]]),d=Vl(Bl(u,[e()-.5,1,e()-.5]));for(let t of[-1,1]){let n=Hl(e,.45,.75);Jl(e,c,Vl(Ll(Ll(Rl(u,1-n*.5),Rl(d,t*n)),[0,.35,0])),r*Hl(e,.55,.7),i*l,a-1,o,s)}}function Yl(e){let t=e()*2-1,n=e()*Math.PI*2,r=Math.sqrt(1-t*t);return[r*Math.cos(n),t,r*Math.sin(n)]}function Xl(e,t,n,r,i){let a=[],o=ql(t.card,r,t.max??2.2),s=Math.max(t.axes[0]-o*.62,.3),c=Math.max(t.axes[1]-o*.62,.3),l=Math.max(t.axes[2]-o*.62,.3),[u,d,f]=t.centre;for(let t=0;t<r;t++){let t;if(n.length>0&&e()<i){let r=n[Math.floor(e()*n.length)],i=Ll(r,Rl(Yl(e),.7*e())),a=Math.hypot((i[0]-u)/s,(i[1]-d)/c,(i[2]-f)/l);t=a>1?[u+(i[0]-u)/a,d+(i[1]-d)/a,f+(i[2]-f)/a]:i}else{let n=Yl(e),r=.45+.55*Math.sqrt(e());t=[u+n[0]*s*r,d+n[1]*c*r,f+n[2]*l*r]}let r=Vl(Ll(Vl([(t[0]-u)/(s*s),(t[1]-d)/(c*c)*.6,(t[2]-f)/(l*l)]),Rl(Yl(e),1.1)));a.push({at:t,normal:r,size:o*Hl(e,.85,1.15),spin:e()*Math.PI*2,tile:Math.floor(e()*4)})}return a}function Zl(e,t){let{height:n,radius:r}=Pl.oak,i=[],a=n*Hl(e,.3,.33),o=Hl(e,0,Math.PI*2),s=Hl(e,.1,.35),c=[0,1,2,3].map(e=>{let t=e/3;return[Math.cos(o)*s*t*t,a*t,Math.sin(o)*s*t*t]}),l=[.44,.38,.33,.28];for(let e=0;e<3;e++)i.push({from:c[e],to:c[e+1],r0:l[e],r1:l[e+1]});let u={segments:i,tips:[]},d=e=>{let t=Math.hypot(e[0],e[2]),i=t>r*.78?r*.78/t:1;return[e[0]*i,Math.min(e[1],n*.8),e[2]*i]},f=4+Math.floor(e()*3),p=e()*Math.PI*2;for(let t=0;t<f;t++){let n=p+t/f*Math.PI*2+Hl(e,-.35,.35),r=Hl(e,35,70)*(Math.PI/180),i=c[3];Jl(e,i,Ul(r,n),Hl(e,2.6,3.6),.24,2,u,d)}return{segments:i,cards:Xl(e,{centre:[0,n*.645,0],axes:[r,n*.355,r],card:1.7,max:2.3},u.tips,t,.25)}}function Ql(e,t){let{height:n,radius:r}=Pl.birch,i=[],a=Hl(e,0,Math.PI*2),o=Hl(e,.15,.4),s=n*.86,c=[0,1,2,3,4].map(e=>{let t=e/4;return[Math.cos(a)*o*t*t,s*t,Math.sin(a)*o*t*t]}),l=[.17,.14,.11,.08,.05];for(let e=0;e<4;e++)i.push({from:c[e],to:c[e+1],r0:l[e],r1:l[e+1]});let u={segments:i,tips:[]},d=e=>{let t=Math.hypot(e[0],e[2]),i=t>r*.8?r*.8/t:1;return[e[0]*i,Math.min(e[1],n*.97),e[2]*i]},f=7+Math.floor(e()*3);for(let t=0;t<f;t++){let r=.3+t/f*.7,i=c[Math.min(Math.floor(r*4),3)];Jl(e,[i[0],n*(.36+t/f*.46),i[2]],Ul(Hl(e,20,42)*(Math.PI/180),e()*Math.PI*2),Hl(e,1.2,2),.07,1,u,d)}return{segments:i,cards:Xl(e,{centre:[0,n*.7,0],axes:[r,n*.3,r],card:1.5,max:2},u.tips,t,.6)}}function $l(e,t){let{height:n,radius:r}=Pl.pine,i=[],a=Hl(e,0,Math.PI*2),o=[0,1,2,3,4].map(e=>{let t=e/4;return[Math.cos(a)*.08*t,n*.98*t,Math.sin(a)*.08*t]}),s=[.32,.22,.14,.08,.025];for(let e=0;e<4;e++)i.push({from:o[e],to:o[e+1],r0:s[e],r1:s[e+1]});let c=11+Math.floor(e()*4),l=[];for(let t=0;t<c;t++){let a=t/(c-1),o=n*(.07+.88*a),s=Math.max(5,Math.round(7-2*a)),u=e()*Math.PI*2;for(let t=0;t<s;t++){let n=u+t/s*Math.PI*2+Hl(e,-.2,.2),c=Math.min((r-.5)*(1-a)**.85*Hl(e,.85,1.12),r-.5),d=Math.max(c,.35),f=[0,o,0],p=[Math.cos(n)*d,o-d*.22,Math.sin(n)*d];i.push({from:f,to:p,r0:.06*(1-a)+.02,r1:.01}),l.push({from:f,to:p,azimuth:n,length:d})}}let u=l.reduce((e,t)=>e+t.length,0),d=ql(2.1,t,2.5),f=[],p=0;for(let r of l){p+=r.length/u*t;let i=Math.floor(p);p-=i;for(let t=0;t<i;t++){let a=i===1?.62:.3+.6*(t+e()*.6)/i,o=[r.to[0]*a,Math.min(r.from[1]+(r.to[1]-r.from[1])*a+.12,n-d*.62),r.to[2]*a],s=[Math.cos(r.azimuth),0,Math.sin(r.azimuth)],c=Vl(Ll(Ll(Rl(s,f.length%2?.9:.4),[0,f.length%2?.5:.9,0]),Rl(Yl(e),.12)));f.push({at:o,normal:c,size:d*Hl(e,.85,1.15),spin:Kl(c,Rl(s,-1))+Hl(e,-.25,.25),tile:Math.floor(e()*4)})}}for(;f.length<t;){let t=l[Math.floor(e()*l.length)],r=Hl(e,.35,.9),i=[Math.cos(t.azimuth),0,Math.sin(t.azimuth)],a=Vl(Ll(Ll(Rl(i,f.length%2?.9:.4),[0,f.length%2?.5:.9,0]),Rl(Yl(e),.12)));f.push({at:[t.to[0]*r,Math.min(t.from[1]+(t.to[1]-t.from[1])*r+.12,n-d*.62),t.to[2]*r],normal:a,size:d*Hl(e,.85,1.15),spin:Kl(a,Rl(i,-1))+Hl(e,-.25,.25),tile:Math.floor(e()*4)})}return{segments:i,cards:f.slice(0,t)}}var eu={oak:Zl,pine:$l,birch:Ql};function tu(e,t,n){let r=s(Il[e]+t*17+3);return eu[e](r,Math.max(Math.round(n),0))}var nu={height:1.9,radius:1.15};function ru(e){let t=tu(`oak`,0,e).cards,n=Math.min(...t.map(e=>e.at[1]-e.size/2),Pl.oak.height);return t.map(e=>({...e,at:[e.at[0]*.25,(e.at[1]-n)*.25,e.at[2]*.25],size:e.size*.4}))}var iu={pine:2911036,oak:4164159,birch:7911503},au={pine:1,oak:1,birch:.6},ou={pine:14281429,oak:15332818,birch:16187332},su={pine:5913892,oak:7031339,birch:14210248},cu={pine:14207160,oak:16777215,birch:14472904},lu=1.6,uu=3,du=.04;function fu(e){return Pl[e]}function pu(e,t,n){let r=fu(e);return{sx:t*au[e]/r.radius,sy:n/r.height}}var mu=(e,t)=>{let n=Math.sin(e*12.9898+t*78.233)*43758.5453;return n-Math.floor(n)};function hu(e){let t=[],n=[],r=[],i=new Y,a=new Y,o=new Y,s=new Y,c=new Y;for(let l of e){i.set(...l.from),a.set(...l.to),o.subVectors(a,i);let e=o.length();if(e<1e-6)continue;o.divideScalar(e),s.set(+(Math.abs(o.y)>.9),Math.abs(o.y)>.9?0:1,0).cross(o).normalize(),c.crossVectors(o,s);let u=l.r0>.15?7:4,d=Math.max(1,Math.round(Math.PI*2*l.r0/lu)),f=e/lu,p=(e,t,n)=>{let r=e/u*Math.PI*2,i=s.x*Math.cos(r)+c.x*Math.sin(r),a=s.y*Math.cos(r)+c.y*Math.sin(r),o=s.z*Math.cos(r)+c.z*Math.sin(r);return{p:[n.x+i*t,n.y+a*t,n.z+o*t],n:[i,a,o]}};for(let e=0;e<u;e++){let o=p(e,l.r0,i),s=p(e+1,l.r0,i),c=p(e,l.r1,a),m=p(e+1,l.r1,a),h=e/u*d,g=(e+1)/u*d;for(let[e,i,a]of[[o,h,0],[c,h,f],[s,g,0],[s,g,0],[c,h,f],[m,g,f]])t.push(...e.p),n.push(...e.n),r.push(i,a)}}let l=new Ct;return l.setAttribute(`position`,new V(t,3)),l.setAttribute(`normal`,new V(n,3)),l.setAttribute(`uv`,new V(r,2)),l}function gu(e,t,n=1,r=e=>e.normal){let i=s(n),a=new Float32Array(e.length*12),o=new Float32Array(e.length*12),c=new Float32Array(e.length*8),l=new Float32Array(e.length*12),u=new Uint16Array(e.length*6);e.forEach((e,n)=>{let{right:s,up:d}=Gl(e),f=e.size/2,p=[[-1,-1],[1,-1],[1,1],[-1,1]],m=e.tile%2,h=Math.floor(e.tile/2),g=Math.min(Math.max(t(e)*(.92+.16*i()),0),1.2),_=r(e);p.forEach(([t,r],i)=>{let u=(n*4+i)*3;for(let n=0;n<3;n++)a[u+n]=e.at[n]+s[n]*t*f+d[n]*r*f,o[u+n]=_[n],l[u+n]=g;c[(n*4+i)*2]=m*.5+(t+1)*.25,c[(n*4+i)*2+1]=.5*(1-h)+(r+1)*.25}),u.set([n*4,n*4+1,n*4+2,n*4,n*4+2,n*4+3],n*6)});let d=new Ct;return d.setAttribute(`position`,new V(a,3)),d.setAttribute(`normal`,new V(o,3)),d.setAttribute(`uv`,new V(c,2)),d.setAttribute(`color`,new V(l,3)),d.setIndex(new Le(u,1)),d}var _u=e=>t=>{let{height:n,radius:r}=Pl[e],i=Math.min(Math.max(t.at[1]/n,0),1),a=Math.min(Math.hypot(t.at[0],t.at[2])/r,1),o=e===`pine`?.5+.5*i:.45+.3*i+.35*a;return Math.min(o,1.05)},vu={oak:.645,pine:.5,birch:.7},yu=e=>{let t=Pl[e].height*vu[e],n=e===`pine`?1.6:.6;return r=>{let i=r.at[0],a=(r.at[1]-t)*n+(e===`pine`?.8:0),o=r.at[2],s=Math.hypot(i,a,o)||1;return[i/s,a/s,o/s]}},bu=e=>.55+.45*Math.min(Math.max(e.at[1]/nu.height,0),1);function xu(){let e=new Uint8Array(16384),t=s(3);for(let n=0;n<64;n++)for(let r=0;r<64;r++){let i=Math.hypot(r-32,n-32)/32,a=.78+.2*t(),o=(n*64+r)*4,s=.8+.2*t();e[o]=e[o+1]=e[o+2]=Math.round(255*s),e[o+3]=i<a?255:0}let n=new R(e,64,64,ct);return n.colorSpace=z,n.magFilter=Fe,n.minFilter=ot,n.generateMipmaps=!0,n.needsUpdate=!0,n}function Su(e,t=Vs){let n=new M,r=[],i=[],a=[],o=new ie,s={value:0},c=t.assets.trees,l=t.settings.msaa>0,u=c?null:xu();u&&a.push(u);let d=e=>{let n=c?e===`pine`?c.pine:c.oak:u,r=new x({map:n,color:c?ou[e]:iu[e],vertexColors:!0,alphaTest:.4,alphaToCoverage:l,side:2,roughness:.8,metalness:0});return r.onBeforeCompile=e=>{e.fragmentShader=e.fragmentShader.replace(`#include <normal_fragment_begin>`,ze.normal_fragment_begin.replace(`normal *= faceDirection;`,``))},r.customProgramCacheKey=()=>`fore-leaf`,(t.settings.post||t.settings.shadows!==`none`)&&Ol(r,s,`float leafWave = uTime * ${(Math.PI*.8).toFixed(3)} + swayPhase;
         transformed += vec3(sin(leafWave), 0.3 * sin(leafWave * 1.3 + 1.0), cos(leafWave * 0.9)) * ${du};`,`leaf`),i.push(r),r},f=e=>{let t=c,n=new x({map:t?.barkColor??null,normalMap:t?.barkNormal??null,color:t?cu[e]:su[e],roughness:.95});return i.push(n),n},p=(e,r,i,a,s)=>{let c=new m;r.forEach((t,n)=>{let{sx:r,sy:l}=i(t);if(o.position.set(t.x,t.y??0,t.z),o.rotation.set(0,t.yaw,0),o.scale.set(r,l,r),o.updateMatrix(),e.setMatrixAt(n,o.matrix),s){let r=a(t);e.setColorAt(n,c.setRGB(r,r,r))}}),e.frustumCulled=!1,e.castShadow=e.receiveShadow=t.shadows,n.add(e)},h=e=>Math.floor(mu(e.z,e.x)*uu)%uu,g=e=>.92+.16*mu(e.x,e.z);for(let n of Object.keys(Pl)){let i=e.filter(e=>e.species===n);if(i.length===0)continue;let a=f(n),o=d(n);for(let e of[...new Set(i.map(e=>e.share??1))]){let s=Math.round(t.settings.treeLeafCards*(n===`pine`?.6:1)*e);for(let t=0;t<uu;t++){let c=i.filter(n=>(n.share??1)===e&&h(n)===t);if(c.length===0)continue;let l=tu(n,t,s),u=hu(e<1?l.segments.filter(e=>e.r0>=.15):l.segments),d=gu(l.cards,_u(n),t+1,yu(n));r.push(u,d);let f=e=>pu(n,e.r,e.height);p(new q(u,a,c.length),c,f,g,!1),p(new q(d,o,c.length),c,f,g,!0)}}}let _=e.filter(e=>e.species===`bush`);if(_.length>0){let e=gu(ru(Math.max(14,Math.round(t.settings.treeLeafCards*.12))),bu,9);r.push(e),p(new q(e,d(`oak`),_.length),_,e=>({sx:e.r/nu.radius,sy:e.r/nu.radius*.6}),g,!0)}let v=t.shadows?[]:e.filter(e=>e.blob!==!1&&e.species!==`bush`);if(v.length>0){let e=new I(1,14).rotateX(-Math.PI/2),t=new B({color:0,transparent:!0,opacity:.25,depthWrite:!1,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-2});r.push(e),i.push(t);let a=new q(e,t,v.length);v.forEach((e,t)=>{o.position.set(e.x-e.height*.2,(e.y??0)+.05,e.z+e.height*.17),o.rotation.set(0,0,0),o.scale.set(e.r*1.15,1,e.r*1),o.updateMatrix(),a.setMatrixAt(t,o.matrix)}),a.frustumCulled=!1,n.add(a)}return{object:n,update:e=>s.value=e,dispose(){n.children.forEach(e=>e.dispose?.()),r.forEach(e=>e.dispose()),i.forEach(e=>e.dispose()),a.forEach(e=>e.dispose()),n.removeFromParent()}}}var Cu=13625855,wu=4167144,Tu=7317724,Eu=600,Du=4;function Ou(e,t,n){let r=new m(Tu).multiplyScalar(1/.75);return new gt({uniforms:{map:{value:e.dome},yaw:{value:t},zenith:{value:new Y(r.r,r.g,r.b)},horizon:{value:new Y(n.r,n.g,n.b)}},vertexShader:`
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,fragmentShader:`
      uniform sampler2D map;
      uniform float yaw;
      uniform vec3 zenith;
      uniform vec3 horizon;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float c = cos(yaw);
        float s = sin(yaw);
        vec3 r = vec3(d.x * c + d.z * s, d.y, -d.x * s + d.z * c);
        vec2 uv = vec2(atan(r.z, r.x) * 0.15915494 + 0.5, asin(clamp(r.y, -1.0, 1.0)) * 0.31830989 + 0.5);
        vec3 tex = texture2D(map, uv).rgb;
        float luma = dot(tex, vec3(0.2126, 0.7152, 0.0722));
        float e = clamp(d.y, 0.0, 1.0);
        vec3 blue = mix(horizon, zenith, pow(e, 0.4));
        // Clouds are the bright, grey-white parts of the picture.
        float cloud = smoothstep(0.26, 0.5, luma);
        vec3 white = vec3(1.0, 1.0, 1.0) * mix(1.0, 1.4, smoothstep(0.3, 0.75, luma));
        white = mix(horizon, white, smoothstep(0.0, 0.22, e));
        vec3 col = mix(blue, white, cloud * smoothstep(0.0, 0.1, e));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,side:1,fog:!1,depthWrite:!1,depthTest:!1})}function ku(e=null,t=0,n=new m(Cu)){let r=new M,i=s(5),a=[],o=[],c=new pt(Eu,48,28),l;if(e)l=Ou(e,t,n);else{let e=c.getAttribute(`position`),t=new m(Cu),n=new m(wu),r=new m,i=[];for(let a=0;a<e.count;a++){let o=Math.max(e.getY(a)/Eu,0)**.6;r.copy(t).lerp(n,o),i.push(r.r,r.g,r.b)}c.setAttribute(`color`,new V(i,3)),l=new B({vertexColors:!0,side:1,fog:!1,depthWrite:!1,depthTest:!1})}let u=new X(c,l);u.renderOrder=-10,u.frustumCulled=!1,r.add(u),a.push(c),o.push(l);let d=new Ct;d.setAttribute(`position`,new V([0,0,0,1.8,0,.2,.3,0,-.6],3)),d.computeVertexNormals();let f=new B({color:2764602,side:2});a.push(d),o.push(f);let p=Array.from({length:Du},(e,t)=>{let n=new M,a=new X(d,f),o=new X(d,f);return o.scale.x=-1,n.add(o,a),n.scale.setScalar(4),n.visible=!1,r.add(n),{group:n,left:o,right:a,period:25+i()*15,offset:t*9+i()*6,y:90+i()*50,z:(i()*2-1)*250}});return{object:r,update(e,t,n){r.position.set(0,0,0),u.position.set(t.x,t.y,t.z);for(let t of p){let r=(e+t.offset)%t.period;if(t.group.visible=r<18,!t.group.visible)continue;t.group.position.set(-320+r/18*640,t.y,n+t.z);let i=Math.sin(e*9+t.offset)*.5;t.right.rotation.z=i,t.left.rotation.z=-i,t.group.rotation.y=-Math.PI/2+.4}},dispose(){a.forEach(e=>e.dispose()),o.forEach(e=>e.dispose()),r.removeFromParent()}}}function Au(e,t,n){let r=.6+.28*Math.sin(t*13+e.seed)+.16*Math.sin(t*27+n*3+e.seed*2.3),i=Math.sin(Math.PI*n)**1.1*Math.sin(Math.PI*t)**.4;return Math.max(0,e.peak*r*i)}var ju=new m(6983509),Mu=new m(11125944);function Nu(e,t=Vs){let n=new M,r=s(Math.round(e.length*17+e.bend*311+7)),i=e.length/2+100,a=[{x:-330,z:i,len:e.length+700,depth:170,alongZ:!0,peak:20+r()*40,seed:1},{x:330,z:i,len:e.length+700,depth:170,alongZ:!0,peak:20+r()*40,seed:2},{x:0,z:e.length+330,len:1e3,depth:160,alongZ:!1,peak:20+r()*40,seed:3}],o=[],c=nc(t,`rough`);c.color.set(16777215),c.vertexColors=!0;let l=[];for(let i of a){let a=new At(i.len,i.depth,Math.round(i.len/10),28),s=a.getAttribute(`position`),u=[],d=new m;for(let t=0;t<s.count;t++){let n=s.getX(t)/i.len+.5,r=s.getY(t)/i.depth+.5,a=Au(i,n,r),o=(r-.5)*i.depth,c=Math.abs(i.alongZ?i.x-o:i.z-e.length-o);d.copy(ju).lerp(Mu,Math.min(Math.max((c-250)/170,0),1)),u.push(d.r,d.g,d.b),s.setZ(t,a)}a.setAttribute(`color`,new V(u,3)),Ls(a,i.len/20,i.depth/20),a.computeVertexNormals(),a.rotateX(-Math.PI/2),i.alongZ&&a.rotateY(Math.PI/2),a.translate(i.x,0,i.z),o.push(a);let f=new X(a,c);if(f.receiveShadow=t.shadows,n.add(f),i.alongZ)for(let e=.02;e<.98;e+=.024){let t=e+(r()-.5)*.01,n=i.x<0?.28+r()*.12:.72-r()*.12,a=Au(i,t,n);a<5||l.push({x:i.x-(n-.5)*i.depth,z:i.z-(t-.5)*i.len,y:a,species:`pine`,r:5+r()*3,height:24+r()*10,yaw:r()*6.28,blob:!1,share:.3})}}let u=Su(l,t);return n.add(u.object),{object:n,dispose(){u.dispose(),o.forEach(e=>e.dispose()),c.dispose(),n.removeFromParent()}}}var Pu=[200,150,100],Fu={long:30,wide:14,storey:3.2,porch:6},Iu={x:8,z:2.5},Lu=15722975,Ru=4869458,zu=3103290,Bu=(e,t,n,r,i,a)=>new ce(e,t,n).translate(r,i,a),Vu=e=>{let t=Pt(e,!1);return e.forEach(e=>e.dispose()),t};function Hu(){let{long:e,wide:t,storey:n,porch:r}=Fu,i=t/2,a=.5,o=n*2,s=[Bu(t,o,e,0,a+o/2,0)],c=Bu(t+.5,3,e+.5,0,-1,0),l=.6,u=(i+l)/Math.cos(Math.PI/6),d=a+o+i*Math.tan(Math.PI/6),f=[];for(let t of[-1,1])f.push(new At(u,e+l*2).rotateX(-Math.PI/2).rotateZ(-t*(Math.PI/6)).translate(u/2*t*Math.cos(Math.PI/6),d-u/2*.5,0));let p=a+o+i*Math.tan(Math.PI/6),m=new et().moveTo(-i,0).lineTo(i,0).lineTo(0,p-(a+o));for(let t of[-1,1])s.push(new ut(m).rotateY(t<0?Math.PI:0).translate(0,a+o,t*e/2));let h=[],g=[];for(let e of[-1,1])for(let t=0;t<2;t++){let r=a+n*(t+.55);for(let t=0;t<6;t++){let n=-12.5+t*5;h.push(Bu(.14,1.7,1.5,e*(i+.03),r,n)),g.push(Bu(.1,2,1.85,e*(i+.01),r,n)),g.push(Bu(.42,.1,2.05,e*(i+.14),r-1.02,n))}}let _=[Bu(3,.3,r,i+1.5,.65,0),Bu(3.4,.25,r+.5,i+1.6,4,0)];for(let e of[-2.7,-.9,.9,2.7])_.push(Bu(.22,3.2,.22,i+2.8,2.4,e));let v=d-3*Math.tan(Math.PI/6)-1,y=[Bu(1.3,4.6,1.3,-3,v+2.3,8),Bu(1.7,.2,1.7,-3,v+4.7,8)],b=Bu(.14,2.2,1.6,i+.04,1.6,0),S=new x({color:16777215,roughness:.6});return[{geometry:Vu(s),material:new x({color:Lu,roughness:.9})},{geometry:c,material:new x({color:7039074,roughness:.95})},{geometry:Vu(g),material:S},{geometry:Vu(y),material:new x({color:9066053,roughness:.95})},{geometry:Vu(f),material:new x({color:Ru,roughness:.8,side:2})},{geometry:Vu(h),material:new C({color:1778992,roughness:.05,metalness:0,envMapIntensity:1.3})},{geometry:Vu(_),material:S},{geometry:b,material:new x({color:4862754,roughness:.7})}]}function Uu(){let e=[Bu(2.6,.45,1.2,0,.55,0),Bu(.8,.35,1.15,.9,.95,0),Bu(.7,.55,1.05,-.55,.95,0),Bu(.15,.7,1.1,-.95,1.2,0)];for(let t of[-1.1,1])for(let n of[-.6,.6])e.push(Bu(.07,1,.07,t,1.45,n));let t=[Bu(2.7,.08,1.4,0,1.95,0)],n=[];for(let e of[-.9,.9])for(let t of[-.62,.62])n.push(new F(.3,.3,.22,12).rotateX(Math.PI/2).translate(e,.3,t));return{white:e,canopy:t,tyres:n}}function Wu(e){if(typeof document>`u`)return null;let t=document.createElement(`canvas`);t.width=256,t.height=180;let n=t.getContext(`2d`);if(!n)return null;n.fillStyle=`#f6f3ea`,n.fillRect(0,0,256,180),n.strokeStyle=`#1f4d2e`,n.lineWidth=8,n.strokeRect(6,6,244,168),n.fillStyle=`#1f4d2e`,n.textAlign=`center`,n.textBaseline=`middle`,n.font=`bold 64px sans-serif`,n.fillText(`Hole ${Ar.indexOf(e)+1}`,128,62),n.font=`bold 36px sans-serif`,n.fillText(`Par ${e.par} · ${e.length} yd`,128,128);let r=new ue(t);return r.colorSpace=z,r.anisotropy=4,r}function Gu(e,t=Vs){let n=new M,r=[],i=[],a=[],o=t.shadows,s=(e,t,n)=>{r.push(t),i.includes(n)||i.push(n);let a=new X(t,n);return a.castShadow=a.receiveShadow=o,e.add(a),a},c=gl(e);if(c){let t=new M;t.name=`clubhouse`,t.position.set(c.x,Os(e,c.x,c.z),c.z),t.rotation.y=c.yaw;for(let e of Hu())s(t,e.geometry,e.material);let r=new M;r.name=`carts`;let{white:i,canopy:a,tyres:o}=Uu(),l=(e,t)=>Vu(t.flatMap(([t,n,r])=>e.map(e=>e.clone().rotateY(r).translate(t,0,n)))),u=[[Fu.wide/2+6,-9,.3],[Fu.wide/2+6,-5.5,-.15]];s(r,l(i,u),new x({color:15921906,roughness:.5})),s(r,l(a,u),new x({color:zu,roughness:.6})),s(r,l(o,u),new x({color:1381653,roughness:.9}));for(let e of[...i,...a,...o])e.dispose();s(r,Bu(7,1.2,9,Fu.wide/2+6,-.57,-7.2),new x({color:12894906,roughness:.9}));let d=Fu.wide/2+6,f=-7.2,p=c.x+d*Math.cos(c.yaw)+f*Math.sin(c.yaw),m=c.z-d*Math.sin(c.yaw)+f*Math.cos(c.yaw);r.position.y=Os(e,p,m)-t.position.y,t.add(r),n.add(t)}let l=new M;l.name=`sign`,l.position.set(Iu.x,Os(e,Iu.x,Iu.z),Iu.z),l.rotation.y=-2.7;let u=new x({color:7031339,roughness:.6});s(l,new F(.05,.05,1.4,8).translate(0,.7,0),u);let d=new x({color:16184298,roughness:.6});s(l,Bu(1,.7,.05,0,1.35,0),d);let f=Wu(e);if(f){a.push(f);let e=new x({map:f,roughness:.6});s(l,new At(.96,.67).translate(0,1.35,.03),e)}n.add(l);let p=Pu.map(t=>e.length-t).filter(e=>e>=0);if(p.length>0){let t=new F(.1,.1,.03,12),a=new x({color:2506794,roughness:.6});r.push(t),i.push(a);let s=new q(t,a,p.length),c=new ie;p.forEach((t,n)=>{c.position.set(jr(e,t),.065,t),c.updateMatrix(),s.setMatrixAt(n,c.matrix)}),s.frustumCulled=!1,s.receiveShadow=o,n.add(s)}return{object:n,dispose(){n.traverse(e=>e.isInstancedMesh&&e.dispose()),r.forEach(e=>e.dispose()),i.forEach(e=>e.dispose()),a.forEach(e=>e.dispose()),n.clear(),n.removeFromParent()}}}var Ku=Cu,qu=.06,Ju=.9,Yu=2.4,Xu=.55,Zu=.36,Qu=[[150,16777215],[100,16770140]];function $u(e,t){return e.polygonOffset=!0,e.polygonOffsetFactor=-t,e.polygonOffsetUnits=-t,e}function ed(e,t,n=.9){return $u(new x({color:e,roughness:n,metalness:0}),t)}function td(e,t,n){let r=new X(e,t);return r.rotation.x=-Math.PI/2,r.position.y=n,r}function nd(e,t,n,r=40,i=0){let a=new I(1,r);i>0&&Ls(a,2*e.rx/i,2*e.rz/i);let o=td(a,t,n);return o.scale.set(e.rx,e.rz,1),o.position.x=e.x,o.position.z=e.z,o}var rd=e=>-vs*(1-Math.min(Math.max(e,0)/ys,1)),id=[0,.2,.4,.6,.8,1,1.2,1.4,1.8],ad=.8;function od(e,t){let n=t.settings.water===`mirror`&&t.assets.water,r=new I(1,56);if(n){let n=new pl(r,{textureWidth:512,textureHeight:512,waterNormals:t.assets.water,sunDirection:t.sun.clone(),sunColor:16777215,waterColor:2051930,distortionScale:1.6,alpha:1,fog:!0});return n.material.uniforms.size.value=6,n.rotation.x=-Math.PI/2,n.position.set(e.x,-vs,e.z),n.scale.set(e.rx,e.rz,1),{mesh:n,update:e=>{n.material.uniforms.time.value=e*.5},materials:[n.material]}}let i=t.assets.water;i&&Ls(r,2*e.rx/6,2*e.rz/6);let a=new Ee,o=new Ee,s=new C({color:1919573,roughness:.04,metalness:0,normalMap:i,clearcoat:.3});s.normalScale.set(.35,.35),i&&(s.customProgramCacheKey=()=>`fore-water`,s.onBeforeCompile=e=>{e.uniforms.uOffA={value:a},e.uniforms.uOffB={value:o},e.fragmentShader=e.fragmentShader.replace(`void main() {`,`uniform vec2 uOffA;
uniform vec2 uOffB;
void main() {`).replace(`#include <normal_fragment_maps>`,`#ifdef USE_NORMALMAP_TANGENTSPACE
            vec3 mapN = (texture2D(normalMap, vNormalMapUv + uOffA).xyz + texture2D(normalMap, vNormalMapUv * 0.8 + uOffB).xyz) - 1.0;
            mapN.xy *= normalScale;
            normal = normalize(tbn * mapN);
          #endif`)});let c=td(r,s,-vs);return c.scale.set(e.rx,e.rz,1),c.position.set(e.x,-vs,e.z),{mesh:c,update:e=>{a.set(.012*e,.012*e),o.set(-.009*e,.009*e)},materials:[s]}}function sd(){let e=new U(1,2),t=e.getAttribute(`position`),n=[];for(let e=0;e<t.count;e++){let r=t.getX(e),i=t.getY(e),a=t.getZ(e),o=1+.16*Math.sin(3.1*r+1.7*i+.4)+.11*Math.sin(5.3*i-2.1*a+1.3)+.07*Math.sin(7.7*a+2.3*r-.8);n.push(r*o,i*o,a*o)}return e.setAttribute(`position`,new V(n,3)),e.computeVertexNormals(),e}function cd(e,t=Vs){let n=new M,r=[],i=[],a=s(Math.round(e.length*13+e.bend*101+3)),o=t.shadows,c=(e,t=!1)=>(r.push(e.geometry),i.push(e.material),e.receiveShadow=t&&o,n.add(e),e),l=e=>(i.push(e),e),u=ec(e),d=(e,n,r=!0)=>$u(nc(t,e,r?u:[]),n);c(new X(ac(e,Xs(t,`rough`)),nc(t,`rough`)),!0);let f=Xs(t,`fairway`),p=c(new X(t.assets.grass?zs(e,-18,18,f,f):zs(e,-18,18),d(`fairway`,1)),!0);p.position.y=.04;let h=t=>({x:e.pin.x,z:e.pin.z,rx:t,rz:t}),g=Xs(t,`fringe`),_=c(nd(h(21),d(`fringe`,1.3),.05,56,g),!0);_.name=`apron`;let v=c(nd(h(18),d(`fringe`,1.5),.06,56,g),!0);v.name=`fringe`;let y=c(nd(h(16),d(`green`,2),.08,56,Xs(t,`green`)),!0);y.name=`green`;let b=[],S=[],C=[],w=l(new x({color:4865322,roughness:.4}));for(let o of e.hazards){let s=o.at;if(o.kind===`sand`)c(new X(sc(s,(t,n)=>Os(e,t,n),2),rc(t)),!0),c(new X(oc(s,[[-.1,0],[.1,.07],[.35,.07],[.7,0]],2.5),d(`fringe`,2.6,!1)),!0);else{let e=id.map(e=>[e,rd(e)]),o=[[-.1,-vs-.02],...e.filter(([e])=>e<=ad)];c(new X(oc(s,o,2.5),w),!0);let l=e.filter(([e])=>e>=ad);c(new X(oc(s,l,2.5),d(`rough`,1,!1)),!0);let u=od(s,t);r.push(u.mesh.geometry),i.push(...u.materials),u.mesh.receiveShadow=!1,n.add(u.mesh),S.push(u);for(let e=0;e<2;e++){let t=new B({color:16777215,transparent:!0,opacity:.4,depthWrite:!1,polygonOffset:!0,polygonOffsetFactor:-4.5,polygonOffsetUnits:-4.5}),n=c(td(new be(.86,.9,48),t,-vs+.01));n.position.set(s.x,-vs+.01,s.z),b.push({mesh:n,material:t,at:s,phase:e*.5})}let f=6+Math.floor(a()*5);for(let e=0;e<f;e++){let e=a()*Math.PI*2;for(let t=0;t<4;t++)C.push({x:s.x+(s.rx+.5)*Math.cos(e)+(a()-.5)*.7,z:s.z+(s.rz+.5)*Math.sin(e)+(a()-.5)*.7,tilt:(a()-.5)*.3,size:.8+a()*.7})}}}let T=new ie;if(C.length>0){let t=c(new q(new ne(.05,1.1,4).translate(0,.55,0),new x({color:6261306,roughness:.9}),C.length));C.forEach((n,r)=>{T.position.set(n.x,Os(e,n.x,n.z),n.z),T.rotation.set(n.tilt,0,-n.tilt),T.scale.set(1,n.size,1),T.updateMatrix(),t.setMatrixAt(r,T.matrix)}),t.frustumCulled=!1}let E=Sl(e),D=xl(e,E.groveSide);if(D.length>0){let e=Pt(D.map(e=>Bs(e,hl))),n=e.getAttribute(`position`),r=new Float32Array(n.count*2);for(let e=0;e<n.count;e++)r[e*2]=n.getX(e)/2,r[e*2+1]=n.getZ(e)/2;e.setAttribute(`uv`,new V(r,2));let i=$u(new x({color:10591636,roughness:.9,metalness:0,normalMap:t.assets.sand?.normal??null}),.8);i.normalScale.set(.3,.3);let a=c(new X(e,i),!0);a.position.y=.03}let O=Xs(t,`tee`);c(td(Ls(new At(8,10),8/O,10/O),d(`tee`,2),.08),!0).position.set(0,.08,0);let k=l(new x({color:10132122,roughness:.6})),A=t.assets.trees,j=l(new x({color:A?16777215:7031339,map:A?.barkColor??null,normalMap:A?.barkNormal??null,roughness:.6})),ee=l(new x({color:15921906,roughness:.6})),N=l(new x({color:3104570,roughness:.6})),te=(e,t,i,a,s,c=0)=>{r.push(e);let l=new X(e,t);l.position.set(i,a,s),l.rotation.y=c,l.castShadow=o,n.add(l)};for(let e of[-1,1])te(new pt(.2,10,8),k,e*3.4,.25,.4);te(new F(.13,.15,1,8),N,-5.5,.58,2.4),te(new ce(.34,.12,.34),ee,-5.5,1.14,2.4),te(new ce(1.6,.08,.5),j,-6.6,.5,-2.4,.3),te(new ce(1.6,.45,.06),j,-6.65,.8,-2.6,.3);for(let e of[-.65,.65])te(new ce(.08,.46,.4),j,-6.6+e*Math.cos(.3),.27,-2.4-e*Math.sin(.3),.3);for(let[t,n]of Qu){let r=e.length-t;if(r<30)continue;let i=jr(e,r);c(td(new At(36,.7),tc(ed(n,2.5,.6),u),.07),!0).position.set(i,.07,r);for(let e of[-1,1]){let t=c(new X(new F(.2,.2,1.6,8),new x({color:n,roughness:.6})));t.castShadow=o,t.position.set(i+e*18.6,.8,r)}}let P=e=>e.r*(e.species===`oak`?1.3:e.species===`birch`?1.2:1.1),re=t.settings.sceneryShare,I=e=>e*.6180339887%1<re,L=e.trees.map((t,n)=>({x:t.x,y:Os(e,t.x,t.z),z:t.z,r:t.r,height:12,species:n%2==0?`oak`:`pine`,yaw:a()*Math.PI*2}));E.trees.forEach((t,n)=>{I(n)&&L.push({...t,r:P(t),y:Os(e,t.x,t.z)})}),E.woods.forEach((t,n)=>{I(n)&&L.push({...t,r:P(t),y:Os(e,t.x,t.z),share:.33,blob:!1})}),E.bushes.filter((e,t)=>I(t)).forEach((t,n)=>{L.push({x:t.x,y:Os(e,t.x,t.z),z:t.z,species:`bush`,r:t.r,height:t.r*1.9,yaw:n,blob:!1})});let R=Su(L,t);n.add(R.object);let ae=new m;if(E.rocks.length>0){let n=t.assets.sand,r=c(new q(sd(),new x({color:9143936,map:n?.color??null,normalMap:n?.normal??null,roughness:.9,metalness:0}),E.rocks.length));r.castShadow=o,E.rocks.forEach((t,n)=>{T.position.set(t.x,Os(e,t.x,t.z)+t.r*.25,t.z),T.rotation.set(.2,t.yaw,.15),T.scale.set(t.r,t.r*.6,t.r*.85),T.updateMatrix(),r.setMatrixAt(n,T.matrix);let i=.88+n*5%7/7*.24;r.setColorAt(n,ae.setRGB(i,i,i))}),r.frustumCulled=!1}let z=E.flowers.filter((e,t)=>t%2==0);if(z.length>0){let t=c(new q(new At(.2,.2).rotateX(-Math.PI/2),new x({color:16777215,side:2,roughness:.8}),z.length));z.forEach((n,r)=>{T.position.set(n.x,Os(e,n.x,n.z)+.13,n.z),T.rotation.set(0,r*2.4,0),T.scale.setScalar(1),T.updateMatrix(),t.setMatrixAt(r,T.matrix),t.setColorAt(r,ae.setHex(n.color))}),t.frustumCulled=!1}let oe=Ml(e,t.settings.tufts);oe.mesh&&(oe.mesh.receiveShadow=o,n.add(oe.mesh));let se=Gu(e,t);n.add(se.object);let le=Nu(e,t);n.add(le.object);let ue=c(new X(new F(.015,.015,Yu,8),new x({color:16053492,roughness:.6})));ue.position.set(e.pin.x,Yu/2,e.pin.z),ue.castShadow=o;let de=c(new X(new At(Xu,Zu),new x({color:16727357,side:2,roughness:.8})));de.geometry.translate(Xu/2,0,0),de.position.set(e.pin.x,Yu-Zu/2-.02,e.pin.z),de.castShadow=o;let fe={x:e.pin.x,z:e.pin.z},pe=c(nd({...fe,rx:qu,rz:qu},ed(1776411,5),.14));pe.name=`cup`;let me=c(td(new be(.07,.09,24),ed(16777215,5.5),.145));me.position.set(fe.x,.145,fe.z),me.name=`rim`;let he=c(td(new be(.044,.056,24),ed(16777215,5.2),.147));he.position.set(fe.x,.147,fe.z),he.name=`liner`;let H=new B({color:16777215,transparent:!0,opacity:.55,side:2,depthTest:!1,depthWrite:!1}),ge=c(td(new be(.8,Ju,40),H,.16));ge.position.set(fe.x,.16,fe.z),ge.renderOrder=7,ge.name=`flash`,ge.visible=!1;let _e=wc(e,E.groveSide,t);return _e&&n.add(_e.object),Ws(t.csm,n),{object:n,gallery:_e,update(e){de.rotation.y=Math.sin(e*3)*.3+Math.sin(e*7.3)*.08,H.opacity=.55+.25*Math.sin(e*2*Math.PI*1.2);for(let t of b){let n=(e*.5+t.phase)%1,r=1+.15*n;t.mesh.scale.set(t.at.rx*r,t.at.rz*r,1),t.material.opacity=.4*(1-n)}S.forEach(t=>t.update(e)),R.update(e),oe.update(e)},setCupAid(e){ge.visible=e},dispose(){R.dispose(),oe.dispose(),se.dispose(),_e?.dispose(),le.dispose(),r.forEach(e=>e.dispose()),i.forEach(e=>{Ks(t.csm,e),e.dispose()}),n.traverse(e=>e.isInstancedMesh&&e.dispose()),Is(),n.clear(),n.removeFromParent()}}}function ld(){let e=document.getElementById(`fg-loading`),t=e?.querySelector(`.fg-loading-fill`);return{progress(n){let r=Math.round(Math.min(Math.max(n,0),1)*100);t&&(t.style.width=`${Math.max(r,4)}%`),e?.setAttribute(`aria-valuenow`,String(r))},done(){e&&(e.classList.add(`fg-loading-done`),setTimeout(()=>e.remove(),400))}}}var ud=()=>new Promise(e=>requestAnimationFrame(()=>setTimeout(e,0))),dd=class{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error(`THREE.Pass: .render() must be implemented in derived pass.`)}dispose(){}},fd=new T(-1,1,1,-1,0,1),pd=new class extends Ct{constructor(){super(),this.setAttribute(`position`,new V([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute(`uv`,new V([0,2,0,0,2,0],2))}},md=class{constructor(e){this._mesh=new X(pd,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,fd)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}},hd={name:`BokehShader`,defines:{DEPTH_PACKING:1,PERSPECTIVE_CAMERA:1},uniforms:{tColor:{value:null},tDepth:{value:null},focus:{value:1},aspect:{value:1},aperture:{value:.025},maxblur:{value:.01},nearClip:{value:1},farClip:{value:1e3}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		#include <common>

		varying vec2 vUv;

		uniform sampler2D tColor;
		uniform sampler2D tDepth;

		uniform float maxblur; // max blur amount
		uniform float aperture; // aperture - bigger values for shallower depth of field

		uniform float nearClip;
		uniform float farClip;

		uniform float focus;
		uniform float aspect;

		#include <packing>

		float getDepth( const in vec2 screenPosition ) {
			#if DEPTH_PACKING == 1
			return unpackRGBAToDepth( texture2D( tDepth, screenPosition ) );
			#else
			return texture2D( tDepth, screenPosition ).x;
			#endif
		}

		float getViewZ( const in float depth ) {
			#if PERSPECTIVE_CAMERA == 1
			return perspectiveDepthToViewZ( depth, nearClip, farClip );
			#else
			return orthographicDepthToViewZ( depth, nearClip, farClip );
			#endif
		}


		void main() {

			vec2 aspectcorrect = vec2( 1.0, aspect );

			float viewZ = getViewZ( getDepth( vUv ) );

			float factor = ( focus + viewZ ); // viewZ is <= 0, so this is a difference equation

			vec2 dofblur = vec2 ( clamp( factor * aperture, -maxblur, maxblur ) );

			vec2 dofblur9 = dofblur * 0.9;
			vec2 dofblur7 = dofblur * 0.7;
			vec2 dofblur4 = dofblur * 0.4;

			vec4 col = vec4( 0.0 );

			col += texture2D( tColor, vUv.xy );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.0,   0.4  ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.15,  0.37 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.29,  0.29 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.37,  0.15 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.40,  0.0  ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.37, -0.15 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.29, -0.29 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.15, -0.37 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.0,  -0.4  ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.15,  0.37 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.29,  0.29 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.37,  0.15 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.4,   0.0  ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.37, -0.15 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.29, -0.29 ) * aspectcorrect ) * dofblur );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.15, -0.37 ) * aspectcorrect ) * dofblur );

			col += texture2D( tColor, vUv.xy + ( vec2(  0.15,  0.37 ) * aspectcorrect ) * dofblur9 );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.37,  0.15 ) * aspectcorrect ) * dofblur9 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.37, -0.15 ) * aspectcorrect ) * dofblur9 );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.15, -0.37 ) * aspectcorrect ) * dofblur9 );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.15,  0.37 ) * aspectcorrect ) * dofblur9 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.37,  0.15 ) * aspectcorrect ) * dofblur9 );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.37, -0.15 ) * aspectcorrect ) * dofblur9 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.15, -0.37 ) * aspectcorrect ) * dofblur9 );

			col += texture2D( tColor, vUv.xy + ( vec2(  0.29,  0.29 ) * aspectcorrect ) * dofblur7 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.40,  0.0  ) * aspectcorrect ) * dofblur7 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.29, -0.29 ) * aspectcorrect ) * dofblur7 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.0,  -0.4  ) * aspectcorrect ) * dofblur7 );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.29,  0.29 ) * aspectcorrect ) * dofblur7 );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.4,   0.0  ) * aspectcorrect ) * dofblur7 );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.29, -0.29 ) * aspectcorrect ) * dofblur7 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.0,   0.4  ) * aspectcorrect ) * dofblur7 );

			col += texture2D( tColor, vUv.xy + ( vec2(  0.29,  0.29 ) * aspectcorrect ) * dofblur4 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.4,   0.0  ) * aspectcorrect ) * dofblur4 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.29, -0.29 ) * aspectcorrect ) * dofblur4 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.0,  -0.4  ) * aspectcorrect ) * dofblur4 );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.29,  0.29 ) * aspectcorrect ) * dofblur4 );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.4,   0.0  ) * aspectcorrect ) * dofblur4 );
			col += texture2D( tColor, vUv.xy + ( vec2( -0.29, -0.29 ) * aspectcorrect ) * dofblur4 );
			col += texture2D( tColor, vUv.xy + ( vec2(  0.0,   0.4  ) * aspectcorrect ) * dofblur4 );

			gl_FragColor = col / 41.0;
			gl_FragColor.a = 1.0;

		}`},gd=class extends dd{constructor(e,t,n){super(),this.scene=e,this.camera=t;let r=n.focus===void 0?1:n.focus,i=n.aperture===void 0?.025:n.aperture,a=n.maxblur===void 0?1:n.maxblur;this._renderTargetDepth=new wt(1,1,{minFilter:Je,magFilter:Je,type:st}),this._renderTargetDepth.texture.name=`BokehPass.depth`,this._materialDepth=new y,this._materialDepth.depthPacking=N,this._materialDepth.blending=0;let o=W.clone(hd.uniforms);o.tDepth.value=this._renderTargetDepth.texture,o.focus.value=r,o.aspect.value=t.aspect,o.aperture.value=i,o.maxblur.value=a,o.nearClip.value=t.near,o.farClip.value=t.far,this.materialBokeh=new gt({defines:Object.assign({},hd.defines),uniforms:o,vertexShader:hd.vertexShader,fragmentShader:hd.fragmentShader}),this.uniforms=o,this._fsQuad=new md(this.materialBokeh),this._oldClearColor=new m}render(e,t,n){this.scene.overrideMaterial=this._materialDepth,e.getClearColor(this._oldClearColor);let r=e.getClearAlpha(),i=e.autoClear;e.autoClear=!1,e.setClearColor(16777215),e.setClearAlpha(1),e.setRenderTarget(this._renderTargetDepth),e.clear(),e.render(this.scene,this.camera),this.uniforms.tColor.value=n.texture,this.uniforms.nearClip.value=this.camera.near,this.uniforms.farClip.value=this.camera.far,this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),e.clear(),this._fsQuad.render(e)),this.scene.overrideMaterial=null,e.setClearColor(this._oldClearColor),e.setClearAlpha(r),e.autoClear=i}setSize(e,t){this.materialBokeh.uniforms.aspect.value=e/t,this._renderTargetDepth.setSize(e,t)}dispose(){this._renderTargetDepth.dispose(),this._materialDepth.dispose(),this.materialBokeh.dispose(),this._fsQuad.dispose()}},_d={name:`CopyShader`,uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`},vd=class extends dd{constructor(e,t=`tDiffuse`){super(),this.textureID=t,this.uniforms=null,this.material=null,e instanceof gt?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=W.clone(e.uniforms),this.material=new gt({name:e.name===void 0?`unspecified`:e.name,defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this._fsQuad=new md(this.material)}render(e,t,n){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=n.texture),this._fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}},yd=class extends dd{constructor(e,t){super(),this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,n){let r=e.getContext(),i=e.state;i.buffers.color.setMask(!1),i.buffers.depth.setMask(!1),i.buffers.color.setLocked(!0),i.buffers.depth.setLocked(!0);let a,o;this.inverse?(a=0,o=1):(a=1,o=0),i.buffers.stencil.setTest(!0),i.buffers.stencil.setOp(r.REPLACE,r.REPLACE,r.REPLACE),i.buffers.stencil.setFunc(r.ALWAYS,a,4294967295),i.buffers.stencil.setClear(o),i.buffers.stencil.setLocked(!0),e.setRenderTarget(n),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear&&e.clear(),e.render(this.scene,this.camera),i.buffers.color.setLocked(!1),i.buffers.depth.setLocked(!1),i.buffers.color.setMask(!0),i.buffers.depth.setMask(!0),i.buffers.stencil.setLocked(!1),i.buffers.stencil.setFunc(r.EQUAL,1,4294967295),i.buffers.stencil.setOp(r.KEEP,r.KEEP,r.KEEP),i.buffers.stencil.setLocked(!0)}},bd=class extends dd{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}},xd=class{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),t===void 0){let n=e.getSize(new Ee);this._width=n.width,this._height=n.height,t=new wt(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:st}),t.texture.name=`EffectComposer.rt1`}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name=`EffectComposer.rt2`,this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new vd(_d),this.copyPass.material.blending=0,this.timer=new at}swapBuffers(){let e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){let t=this.passes.indexOf(e);t!==-1&&this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){this.timer.update(),e===void 0&&(e=this.timer.getDelta());let t=this.renderer.getRenderTarget(),n=!1;for(let t=0,r=this.passes.length;t<r;t++){let r=this.passes[t];if(r.enabled!==!1){if(r.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(t),r.render(this.renderer,this.writeBuffer,this.readBuffer,e,n),r.needsSwap){if(n){let t=this.renderer.getContext(),n=this.renderer.state.buffers.stencil;n.setFunc(t.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),n.setFunc(t.EQUAL,1,4294967295)}this.swapBuffers()}yd!==void 0&&(r instanceof yd?n=!0:r instanceof bd&&(n=!1))}}this.renderer.setRenderTarget(t)}reset(e){if(e===void 0){let t=this.renderer.getSize(new Ee);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;let n=this._width*this._pixelRatio,r=this._height*this._pixelRatio;this.renderTarget1.setSize(n,r),this.renderTarget2.setSize(n,r);for(let e=0;e<this.passes.length;e++)this.passes[e].setSize(n,r)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}},Sd={name:`GTAOShader`,defines:{PERSPECTIVE_CAMERA:1,SAMPLES:16,NORMAL_VECTOR_TYPE:1,DEPTH_SWIZZLING:`x`,SCREEN_SPACE_RADIUS:0,SCREEN_SPACE_RADIUS_SCALE:100,SCENE_CLIP_BOX:0},uniforms:{tNormal:{value:null},tDepth:{value:null},tNoise:{value:null},resolution:{value:new Ee},cameraNear:{value:null},cameraFar:{value:null},cameraProjectionMatrix:{value:new De},cameraProjectionMatrixInverse:{value:new De},cameraWorldMatrix:{value:new De},radius:{value:.25},distanceExponent:{value:1},thickness:{value:1},distanceFallOff:{value:1},scale:{value:1},sceneBoxMin:{value:new Y(-1,-1,-1)},sceneBoxMax:{value:new Y(1,1,1)}},vertexShader:`

		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`
		varying vec2 vUv;
		uniform highp sampler2D tNormal;
		uniform highp sampler2D tDepth;
		uniform sampler2D tNoise;
		uniform vec2 resolution;
		uniform float cameraNear;
		uniform float cameraFar;
		uniform mat4 cameraProjectionMatrix;
		uniform mat4 cameraProjectionMatrixInverse;
		uniform mat4 cameraWorldMatrix;
		uniform float radius;
		uniform float distanceExponent;
		uniform float thickness;
		uniform float distanceFallOff;
		uniform float scale;
		#if SCENE_CLIP_BOX == 1
			uniform vec3 sceneBoxMin;
			uniform vec3 sceneBoxMax;
		#endif

		#include <common>
		#include <packing>

		#ifndef FRAGMENT_OUTPUT
		#define FRAGMENT_OUTPUT vec4(vec3(ao), 1.)
		#endif

		vec3 getViewPosition( const in vec2 screenPosition, const in float depth ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				vec4 clipSpacePosition = vec4( vec2( screenPosition ) * 2.0 - 1.0, depth, 1.0 );
			#else
				vec4 clipSpacePosition = vec4( vec3( screenPosition, depth ) * 2.0 - 1.0, 1.0 );
			#endif
			vec4 viewSpacePosition = cameraProjectionMatrixInverse * clipSpacePosition;
			return viewSpacePosition.xyz / viewSpacePosition.w;
		}

		float getDepth(const vec2 uv) {
			return textureLod(tDepth, uv.xy, 0.0).DEPTH_SWIZZLING;
		}

		float fetchDepth(const ivec2 uv) {
			return texelFetch(tDepth, uv.xy, 0).DEPTH_SWIZZLING;
		}

		float getViewZ(const in float depth) {
			#if PERSPECTIVE_CAMERA == 1
				return perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
			#else
				return orthographicDepthToViewZ(depth, cameraNear, cameraFar);
			#endif
		}

		vec3 computeNormalFromDepth(const vec2 uv) {
			vec2 size = vec2(textureSize(tDepth, 0));
			ivec2 p = ivec2(uv * size);
			float c0 = fetchDepth(p);
			float l2 = fetchDepth(p - ivec2(2, 0));
			float l1 = fetchDepth(p - ivec2(1, 0));
			float r1 = fetchDepth(p + ivec2(1, 0));
			float r2 = fetchDepth(p + ivec2(2, 0));
			float b2 = fetchDepth(p - ivec2(0, 2));
			float b1 = fetchDepth(p - ivec2(0, 1));
			float t1 = fetchDepth(p + ivec2(0, 1));
			float t2 = fetchDepth(p + ivec2(0, 2));
			float dl = abs((2.0 * l1 - l2) - c0);
			float dr = abs((2.0 * r1 - r2) - c0);
			float db = abs((2.0 * b1 - b2) - c0);
			float dt = abs((2.0 * t1 - t2) - c0);
			vec3 ce = getViewPosition(uv, c0).xyz;
			vec3 dpdx = (dl < dr) ? ce - getViewPosition((uv - vec2(1.0 / size.x, 0.0)), l1).xyz : -ce + getViewPosition((uv + vec2(1.0 / size.x, 0.0)), r1).xyz;
			vec3 dpdy = (db < dt) ? ce - getViewPosition((uv - vec2(0.0, 1.0 / size.y)), b1).xyz : -ce + getViewPosition((uv + vec2(0.0, 1.0 / size.y)), t1).xyz;
			return normalize(cross(dpdx, dpdy));
		}

		vec3 getViewNormal(const vec2 uv) {
			#if NORMAL_VECTOR_TYPE == 2
				return normalize(textureLod(tNormal, uv, 0.).rgb);
			#elif NORMAL_VECTOR_TYPE == 1
				return unpackRGBToNormal(textureLod(tNormal, uv, 0.).rgb);
			#else
				return computeNormalFromDepth(uv);
			#endif
		}

		vec3 getSceneUvAndDepth(vec3 sampleViewPos) {
			vec4 sampleClipPos = cameraProjectionMatrix * vec4(sampleViewPos, 1.);
			vec2 sampleUv = sampleClipPos.xy / sampleClipPos.w * 0.5 + 0.5;
			float sampleSceneDepth = getDepth(sampleUv);
			return vec3(sampleUv, sampleSceneDepth);
		}

		void main() {
			float depth = getDepth(vUv.xy);

			#ifdef USE_REVERSED_DEPTH_BUFFER
				if (depth <= 0.0) {
					discard;
					return;
				}
			#else
				if (depth >= 1.0) {
					discard;
					return;
				}
			#endif
			
			vec3 viewPos = getViewPosition(vUv, depth);
			vec3 viewNormal = getViewNormal(vUv);

			float radiusToUse = radius;
			float distanceFalloffToUse = thickness;
			#if SCREEN_SPACE_RADIUS == 1
				float radiusScale = getViewPosition(vec2(0.5 + float(SCREEN_SPACE_RADIUS_SCALE) / resolution.x, 0.0), depth).x;
				radiusToUse *= radiusScale;
				distanceFalloffToUse *= radiusScale;
			#endif

			#if SCENE_CLIP_BOX == 1
				vec3 worldPos = (cameraWorldMatrix * vec4(viewPos, 1.0)).xyz;
				float boxDistance = length(max(vec3(0.0), max(sceneBoxMin - worldPos, worldPos - sceneBoxMax)));
				if (boxDistance > radiusToUse) {
					discard;
					return;
				}
			#endif

			vec2 noiseResolution = vec2(textureSize(tNoise, 0));
			vec2 noiseUv = vUv * resolution / noiseResolution;
			vec4 noiseTexel = textureLod(tNoise, noiseUv, 0.0);
			vec3 randomVec = noiseTexel.xyz * 2.0 - 1.0;
			vec3 tangent = normalize(vec3(randomVec.xy, 0.));
			vec3 bitangent = vec3(-tangent.y, tangent.x, 0.);
			mat3 kernelMatrix = mat3(tangent, bitangent, vec3(0., 0., 1.));

			const int DIRECTIONS = SAMPLES < 30 ? 3 : 5;
			const int STEPS = (SAMPLES + DIRECTIONS - 1) / DIRECTIONS;
			float ao = 0.0;
			for (int i = 0; i < DIRECTIONS; ++i) {

				float angle = float(i) / float(DIRECTIONS) * PI;
				vec4 sampleDir = vec4(cos(angle), sin(angle), 0., 0.5 + 0.5 * noiseTexel.w);
				sampleDir.xyz = normalize(kernelMatrix * sampleDir.xyz);

				vec3 viewDir = normalize(-viewPos.xyz);
				vec3 sliceBitangent = normalize(cross(sampleDir.xyz, viewDir));
				vec3 sliceTangent = cross(sliceBitangent, viewDir);
				vec3 normalInSlice = normalize(viewNormal - sliceBitangent * dot(viewNormal, sliceBitangent));

				vec3 tangentToNormalInSlice = cross(normalInSlice, sliceBitangent);
				vec2 cosHorizons = vec2(dot(viewDir, tangentToNormalInSlice), dot(viewDir, -tangentToNormalInSlice));

				for (int j = 0; j < STEPS; ++j) {
					vec3 sampleViewOffset = sampleDir.xyz * radiusToUse * sampleDir.w * pow(float(j + 1) / float(STEPS), distanceExponent);

					vec3 sampleSceneUvDepth = getSceneUvAndDepth(viewPos + sampleViewOffset);
					vec3 sampleSceneViewPos = getViewPosition(sampleSceneUvDepth.xy, sampleSceneUvDepth.z);
					vec3 viewDelta = sampleSceneViewPos - viewPos;
					if (abs(viewDelta.z) < thickness) {
						float sampleCosHorizon = dot(viewDir, normalize(viewDelta));
						cosHorizons.x += max(0., (sampleCosHorizon - cosHorizons.x) * mix(1., 2. / float(j + 2), distanceFallOff));
					}

					sampleSceneUvDepth = getSceneUvAndDepth(viewPos - sampleViewOffset);
					sampleSceneViewPos = getViewPosition(sampleSceneUvDepth.xy, sampleSceneUvDepth.z);
					viewDelta = sampleSceneViewPos - viewPos;
					if (abs(viewDelta.z) < thickness) {
						float sampleCosHorizon = dot(viewDir, normalize(viewDelta));
						cosHorizons.y += max(0., (sampleCosHorizon - cosHorizons.y) * mix(1., 2. / float(j + 2), distanceFallOff));
					}
				}

				vec2 sinHorizons = sqrt(1. - cosHorizons * cosHorizons);
				float nx = dot(normalInSlice, sliceTangent);
				float ny = dot(normalInSlice, viewDir);
				float nxb = 1. / 2. * (acos(cosHorizons.y) - acos(cosHorizons.x) + sinHorizons.x * cosHorizons.x - sinHorizons.y * cosHorizons.y);
				float nyb = 1. / 2. * (2. - cosHorizons.x * cosHorizons.x - cosHorizons.y * cosHorizons.y);
				float occlusion = nx * nxb + ny * nyb;
				ao += occlusion;
			}

			ao = clamp(ao / float(DIRECTIONS), 0., 1.);
		#if SCENE_CLIP_BOX == 1
			ao = mix(ao, 1., smoothstep(0., radiusToUse, boxDistance));
		#endif
			ao = pow(ao, scale);

			gl_FragColor = FRAGMENT_OUTPUT;
		}`},Cd={name:`GTAODepthShader`,defines:{PERSPECTIVE_CAMERA:1},uniforms:{tDepth:{value:null},cameraNear:{value:null},cameraFar:{value:null}},vertexShader:`
		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`
		uniform sampler2D tDepth;
		uniform float cameraNear;
		uniform float cameraFar;
		varying vec2 vUv;

		#include <packing>

		float getLinearDepth( const in vec2 screenPosition ) {
			#if PERSPECTIVE_CAMERA == 1
				float fragCoordZ = texture2D( tDepth, screenPosition ).x;
				float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
				return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );
			#else
				return texture2D( tDepth, screenPosition ).x;
			#endif
		}

		void main() {
			float depth = getLinearDepth( vUv );
			gl_FragColor = vec4( vec3( 1.0 - depth ), 1.0 );

		}`},wd={name:`GTAOBlendShader`,uniforms:{tDiffuse:{value:null},intensity:{value:1}},vertexShader:`
		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`
		uniform float intensity;
		uniform sampler2D tDiffuse;
		varying vec2 vUv;

		void main() {
			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = vec4(mix(vec3(1.), texel.rgb, intensity), texel.a);
		}`};function Td(e=5){let t=Math.floor(e)%2==0?Math.floor(e)+1:Math.floor(e),n=Ed(t),r=n.length,i=new Uint8Array(r*4);for(let e=0;e<r;++e){let t=n[e],a=2*Math.PI*t/r,o=new Y(Math.cos(a),Math.sin(a),0).normalize();i[e*4]=(o.x*.5+.5)*255,i[e*4+1]=(o.y*.5+.5)*255,i[e*4+2]=127,i[e*4+3]=255}let a=new R(i,t,t);return a.wrapS=_e,a.wrapT=_e,a.needsUpdate=!0,a}function Ed(e){let t=Math.floor(e)%2==0?Math.floor(e)+1:Math.floor(e),n=t*t,r=Array(n).fill(0),i=Math.floor(t/2),a=t-1;for(let e=1;e<=n;)i===-1&&a===t?(a=t-2,i=0):(a===t&&(a=0),i<0&&(i=t-1)),r[i*t+a]===0?(r[i*t+a]=e++,a++,i--):(a-=2,i++);return r}var Dd={name:`PoissonDenoiseShader`,defines:{SAMPLES:16,SAMPLE_VECTORS:Od(16,2,1),NORMAL_VECTOR_TYPE:1,DEPTH_VALUE_SOURCE:0},uniforms:{tDiffuse:{value:null},tNormal:{value:null},tDepth:{value:null},tNoise:{value:null},resolution:{value:new Ee},cameraProjectionMatrixInverse:{value:new De},lumaPhi:{value:5},depthPhi:{value:5},normalPhi:{value:5},radius:{value:4},index:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`

		varying vec2 vUv;

		uniform sampler2D tDiffuse;
		uniform sampler2D tNormal;
		uniform sampler2D tDepth;
		uniform sampler2D tNoise;
		uniform vec2 resolution;
		uniform mat4 cameraProjectionMatrixInverse;
		uniform float lumaPhi;
		uniform float depthPhi;
		uniform float normalPhi;
		uniform float radius;
		uniform int index;

		#include <common>
		#include <packing>

		#ifndef SAMPLE_LUMINANCE
		#define SAMPLE_LUMINANCE dot(vec3(0.2125, 0.7154, 0.0721), a)
		#endif

		#ifndef FRAGMENT_OUTPUT
		#define FRAGMENT_OUTPUT vec4(denoised, 1.)
		#endif

		float getLuminance(const in vec3 a) {
			return SAMPLE_LUMINANCE;
		}

		const vec3 poissonDisk[SAMPLES] = SAMPLE_VECTORS;

		vec3 getViewPosition( const in vec2 screenPosition, const in float depth ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				vec4 clipSpacePosition = vec4( vec2( screenPosition ) * 2.0 - 1.0, depth, 1.0 );
			#else
				vec4 clipSpacePosition = vec4( vec3( screenPosition, depth ) * 2.0 - 1.0, 1.0 );
			#endif
			vec4 viewSpacePosition = cameraProjectionMatrixInverse * clipSpacePosition;
			return viewSpacePosition.xyz / viewSpacePosition.w;
		}

		float getDepth(const vec2 uv) {
		#if DEPTH_VALUE_SOURCE == 1
			return textureLod(tDepth, uv.xy, 0.0).a;
		#else
			return textureLod(tDepth, uv.xy, 0.0).r;
		#endif
		}

		float fetchDepth(const ivec2 uv) {
			#if DEPTH_VALUE_SOURCE == 1
				return texelFetch(tDepth, uv.xy, 0).a;
			#else
				return texelFetch(tDepth, uv.xy, 0).r;
			#endif
		}

		vec3 computeNormalFromDepth(const vec2 uv) {
			vec2 size = vec2(textureSize(tDepth, 0));
			ivec2 p = ivec2(uv * size);
			float c0 = fetchDepth(p);
			float l2 = fetchDepth(p - ivec2(2, 0));
			float l1 = fetchDepth(p - ivec2(1, 0));
			float r1 = fetchDepth(p + ivec2(1, 0));
			float r2 = fetchDepth(p + ivec2(2, 0));
			float b2 = fetchDepth(p - ivec2(0, 2));
			float b1 = fetchDepth(p - ivec2(0, 1));
			float t1 = fetchDepth(p + ivec2(0, 1));
			float t2 = fetchDepth(p + ivec2(0, 2));
			float dl = abs((2.0 * l1 - l2) - c0);
			float dr = abs((2.0 * r1 - r2) - c0);
			float db = abs((2.0 * b1 - b2) - c0);
			float dt = abs((2.0 * t1 - t2) - c0);
			vec3 ce = getViewPosition(uv, c0).xyz;
			vec3 dpdx = (dl < dr) ?  ce - getViewPosition((uv - vec2(1.0 / size.x, 0.0)), l1).xyz
									: -ce + getViewPosition((uv + vec2(1.0 / size.x, 0.0)), r1).xyz;
			vec3 dpdy = (db < dt) ?  ce - getViewPosition((uv - vec2(0.0, 1.0 / size.y)), b1).xyz
									: -ce + getViewPosition((uv + vec2(0.0, 1.0 / size.y)), t1).xyz;
			return normalize(cross(dpdx, dpdy));
		}

		vec3 getViewNormal(const vec2 uv) {
		#if NORMAL_VECTOR_TYPE == 2
			return normalize(textureLod(tNormal, uv, 0.).rgb);
		#elif NORMAL_VECTOR_TYPE == 1
			return unpackRGBToNormal(textureLod(tNormal, uv, 0.).rgb);
		#else
			return computeNormalFromDepth(uv);
		#endif
		}

		void denoiseSample(in vec3 center, in vec3 viewNormal, in vec3 viewPos, in vec2 sampleUv, inout vec3 denoised, inout float totalWeight) {
			vec4 sampleTexel = textureLod(tDiffuse, sampleUv, 0.0);
			float sampleDepth = getDepth(sampleUv);
			vec3 sampleNormal = getViewNormal(sampleUv);
			vec3 neighborColor = sampleTexel.rgb;
			vec3 viewPosSample = getViewPosition(sampleUv, sampleDepth);

			float normalDiff = dot(viewNormal, sampleNormal);
			float normalSimilarity = pow(max(normalDiff, 0.), normalPhi);
			float lumaDiff = abs(getLuminance(neighborColor) - getLuminance(center));
			float lumaSimilarity = max(1.0 - lumaDiff / lumaPhi, 0.0);
			float depthDiff = abs(dot(viewPos - viewPosSample, viewNormal));
			float depthSimilarity = max(1. - depthDiff / depthPhi, 0.);
			float w = lumaSimilarity * depthSimilarity * normalSimilarity;

			denoised += w * neighborColor;
			totalWeight += w;
		}

		void main() {
			float depth = getDepth(vUv.xy);
			vec3 viewNormal = getViewNormal(vUv);
			if (depth == 1. || dot(viewNormal, viewNormal) == 0.) {
				discard;
				return;
			}
			vec4 texel = textureLod(tDiffuse, vUv, 0.0);
			vec3 center = texel.rgb;
			vec3 viewPos = getViewPosition(vUv, depth);

			vec2 noiseResolution = vec2(textureSize(tNoise, 0));
			vec2 noiseUv = vUv * resolution / noiseResolution;
			vec4 noiseTexel = textureLod(tNoise, noiseUv, 0.0);
      		vec2 noiseVec = vec2(sin(noiseTexel[index % 4] * 2. * PI), cos(noiseTexel[index % 4] * 2. * PI));
    		mat2 rotationMatrix = mat2(noiseVec.x, -noiseVec.y, noiseVec.x, noiseVec.y);

			float totalWeight = 1.0;
			vec3 denoised = texel.rgb;
			for (int i = 0; i < SAMPLES; i++) {
				vec3 sampleDir = poissonDisk[i];
				vec2 offset = rotationMatrix * (sampleDir.xy * (1. + sampleDir.z * (radius - 1.)) / resolution);
				vec2 sampleUv = vUv + offset;
				denoiseSample(center, viewNormal, viewPos, sampleUv, denoised, totalWeight);
			}

			if (totalWeight > 0.) {
				denoised /= totalWeight;
			}
			gl_FragColor = FRAGMENT_OUTPUT;
		}`};function Od(e,t,n){let r=kd(e,t,n),i=`vec3[SAMPLES](`;for(let t=0;t<e;t++){let n=r[t];i+=`vec3(${n.x}, ${n.y}, ${n.z})${t<e-1?`,`:`)`}`}return i}function kd(e,t,n){let r=[];for(let i=0;i<e;i++){let a=2*Math.PI*t*i/e,o=(i/(e-1))**n;r.push(new Y(Math.cos(a),Math.sin(a),o))}return r}var Ad=class{constructor(e=Math){this.grad3=[[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]],this.grad4=[[0,1,1,1],[0,1,1,-1],[0,1,-1,1],[0,1,-1,-1],[0,-1,1,1],[0,-1,1,-1],[0,-1,-1,1],[0,-1,-1,-1],[1,0,1,1],[1,0,1,-1],[1,0,-1,1],[1,0,-1,-1],[-1,0,1,1],[-1,0,1,-1],[-1,0,-1,1],[-1,0,-1,-1],[1,1,0,1],[1,1,0,-1],[1,-1,0,1],[1,-1,0,-1],[-1,1,0,1],[-1,1,0,-1],[-1,-1,0,1],[-1,-1,0,-1],[1,1,1,0],[1,1,-1,0],[1,-1,1,0],[1,-1,-1,0],[-1,1,1,0],[-1,1,-1,0],[-1,-1,1,0],[-1,-1,-1,0]],this.p=[];for(let t=0;t<256;t++)this.p[t]=Math.floor(e.random()*256);this.perm=[];for(let e=0;e<512;e++)this.perm[e]=this.p[e&255];this.simplex=[[0,1,2,3],[0,1,3,2],[0,0,0,0],[0,2,3,1],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,2,3,0],[0,2,1,3],[0,0,0,0],[0,3,1,2],[0,3,2,1],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,3,2,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,2,0,3],[0,0,0,0],[1,3,0,2],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,3,0,1],[2,3,1,0],[1,0,2,3],[1,0,3,2],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,0,3,1],[0,0,0,0],[2,1,3,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,0,1,3],[0,0,0,0],[0,0,0,0],[0,0,0,0],[3,0,1,2],[3,0,2,1],[0,0,0,0],[3,1,2,0],[2,1,0,3],[0,0,0,0],[0,0,0,0],[0,0,0,0],[3,1,0,2],[0,0,0,0],[3,2,0,1],[3,2,1,0]]}noise(e,t){let n,r,i,a=.5*(Math.sqrt(3)-1),o=(e+t)*a,s=Math.floor(e+o),c=Math.floor(t+o),l=(3-Math.sqrt(3))/6,u=(s+c)*l,d=s-u,f=c-u,p=e-d,m=t-f,h,g;p>m?(h=1,g=0):(h=0,g=1);let _=p-h+l,v=m-g+l,y=p-1+2*l,b=m-1+2*l,x=s&255,S=c&255,C=this.perm[x+this.perm[S]]%12,w=this.perm[x+h+this.perm[S+g]]%12,T=this.perm[x+1+this.perm[S+1]]%12,E=.5-p*p-m*m;E<0?n=0:(E*=E,n=E*E*this._dot(this.grad3[C],p,m));let D=.5-_*_-v*v;D<0?r=0:(D*=D,r=D*D*this._dot(this.grad3[w],_,v));let O=.5-y*y-b*b;return O<0?i=0:(O*=O,i=O*O*this._dot(this.grad3[T],y,b)),70*(n+r+i)}noise3d(e,t,n){let r,i,a,o,s=(e+t+n)*(1/3),c=Math.floor(e+s),l=Math.floor(t+s),u=Math.floor(n+s),d=1/6,f=(c+l+u)*d,p=c-f,m=l-f,h=u-f,g=e-p,_=t-m,v=n-h,y,b,x,S,C,w;g>=_?_>=v?(y=1,b=0,x=0,S=1,C=1,w=0):g>=v?(y=1,b=0,x=0,S=1,C=0,w=1):(y=0,b=0,x=1,S=1,C=0,w=1):_<v?(y=0,b=0,x=1,S=0,C=1,w=1):g<v?(y=0,b=1,x=0,S=0,C=1,w=1):(y=0,b=1,x=0,S=1,C=1,w=0);let T=g-y+d,E=_-b+d,D=v-x+d,O=g-S+2*d,k=_-C+2*d,A=v-w+2*d,j=g-1+3*d,ee=_-1+3*d,M=v-1+3*d,N=c&255,te=l&255,P=u&255,ne=this.perm[N+this.perm[te+this.perm[P]]]%12,re=this.perm[N+y+this.perm[te+b+this.perm[P+x]]]%12,F=this.perm[N+S+this.perm[te+C+this.perm[P+w]]]%12,ie=this.perm[N+1+this.perm[te+1+this.perm[P+1]]]%12,I=.6-g*g-_*_-v*v;I<0?r=0:(I*=I,r=I*I*this._dot3(this.grad3[ne],g,_,v));let L=.6-T*T-E*E-D*D;L<0?i=0:(L*=L,i=L*L*this._dot3(this.grad3[re],T,E,D));let R=.6-O*O-k*k-A*A;R<0?a=0:(R*=R,a=R*R*this._dot3(this.grad3[F],O,k,A));let ae=.6-j*j-ee*ee-M*M;return ae<0?o=0:(ae*=ae,o=ae*ae*this._dot3(this.grad3[ie],j,ee,M)),32*(r+i+a+o)}noise4d(e,t,n,r){let i=this.grad4,a=this.simplex,o=this.perm,s=(Math.sqrt(5)-1)/4,c=(5-Math.sqrt(5))/20,l,u,d,f,p,m=(e+t+n+r)*s,h=Math.floor(e+m),g=Math.floor(t+m),_=Math.floor(n+m),v=Math.floor(r+m),y=(h+g+_+v)*c,b=h-y,x=g-y,S=_-y,C=v-y,w=e-b,T=t-x,E=n-S,D=r-C,O=w>T?32:0,k=w>E?16:0,A=T>E?8:0,j=w>D?4:0,ee=T>D?2:0,M=+(E>D),N=O+k+A+j+ee+M,te=+(a[N][0]>=3),P=+(a[N][1]>=3),ne=+(a[N][2]>=3),re=+(a[N][3]>=3),F=+(a[N][0]>=2),ie=+(a[N][1]>=2),I=+(a[N][2]>=2),L=+(a[N][3]>=2),R=+(a[N][0]>=1),ae=+(a[N][1]>=1),z=+(a[N][2]>=1),oe=+(a[N][3]>=1),se=w-te+c,ce=T-P+c,le=E-ne+c,B=D-re+c,ue=w-F+2*c,de=T-ie+2*c,fe=E-I+2*c,V=D-L+2*c,pe=w-R+3*c,me=T-ae+3*c,he=E-z+3*c,H=D-oe+3*c,ge=w-1+4*c,_e=T-1+4*c,U=E-1+4*c,ve=D-1+4*c,ye=h&255,be=g&255,xe=_&255,W=v&255,Se=o[ye+o[be+o[xe+o[W]]]]%32,Ce=o[ye+te+o[be+P+o[xe+ne+o[W+re]]]]%32,we=o[ye+F+o[be+ie+o[xe+I+o[W+L]]]]%32,Te=o[ye+R+o[be+ae+o[xe+z+o[W+oe]]]]%32,G=o[ye+1+o[be+1+o[xe+1+o[W+1]]]]%32,Ee=.6-w*w-T*T-E*E-D*D;Ee<0?l=0:(Ee*=Ee,l=Ee*Ee*this._dot4(i[Se],w,T,E,D));let De=.6-se*se-ce*ce-le*le-B*B;De<0?u=0:(De*=De,u=De*De*this._dot4(i[Ce],se,ce,le,B));let Oe=.6-ue*ue-de*de-fe*fe-V*V;Oe<0?d=0:(Oe*=Oe,d=Oe*Oe*this._dot4(i[we],ue,de,fe,V));let K=.6-pe*pe-me*me-he*he-H*H;K<0?f=0:(K*=K,f=K*K*this._dot4(i[Te],pe,me,he,H));let ke=.6-ge*ge-_e*_e-U*U-ve*ve;return ke<0?p=0:(ke*=ke,p=ke*ke*this._dot4(i[G],ge,_e,U,ve)),27*(l+u+d+f+p)}_dot(e,t,n){return e[0]*t+e[1]*n}_dot3(e,t,n,r){return e[0]*t+e[1]*n+e[2]*r}_dot4(e,t,n,r,i){return e[0]*t+e[1]*n+e[2]*r+e[3]*i}},jd=class e extends dd{constructor(e,t,n=512,r=512,i,a,o){super(),this.width=n,this.height=r,this.clear=!0,this.camera=t,this.scene=e,this.output=0,this._renderGBuffer=!0,this._visibilityCache=[],this.blendIntensity=1,this.pdRings=2,this.pdRadiusExponent=2,this.pdSamples=16,this.gtaoNoiseTexture=Td(),this.pdNoiseTexture=this._generateNoise(),this.gtaoRenderTarget=new wt(this.width,this.height,{type:st,depthBuffer:!1}),this.pdRenderTarget=this.gtaoRenderTarget.clone(),this.gtaoMaterial=new gt({defines:Object.assign({},Sd.defines),uniforms:W.clone(Sd.uniforms),vertexShader:Sd.vertexShader,fragmentShader:Sd.fragmentShader,blending:0,depthTest:!1,depthWrite:!1}),this.gtaoMaterial.defines.PERSPECTIVE_CAMERA=+!!this.camera.isPerspectiveCamera,this.gtaoMaterial.uniforms.tNoise.value=this.gtaoNoiseTexture,this.gtaoMaterial.uniforms.resolution.value.set(this.width,this.height),this.gtaoMaterial.uniforms.cameraNear.value=this.camera.near,this.gtaoMaterial.uniforms.cameraFar.value=this.camera.far,this.normalMaterial=new fe,this.normalMaterial.blending=0,this.pdMaterial=new gt({defines:Object.assign({},Dd.defines),uniforms:W.clone(Dd.uniforms),vertexShader:Dd.vertexShader,fragmentShader:Dd.fragmentShader,depthTest:!1,depthWrite:!1}),this.pdMaterial.uniforms.tDiffuse.value=this.gtaoRenderTarget.texture,this.pdMaterial.uniforms.tNoise.value=this.pdNoiseTexture,this.pdMaterial.uniforms.resolution.value.set(this.width,this.height),this.pdMaterial.uniforms.lumaPhi.value=10,this.pdMaterial.uniforms.depthPhi.value=2,this.pdMaterial.uniforms.normalPhi.value=3,this.pdMaterial.uniforms.radius.value=8,this.depthRenderMaterial=new gt({defines:Object.assign({},Cd.defines),uniforms:W.clone(Cd.uniforms),vertexShader:Cd.vertexShader,fragmentShader:Cd.fragmentShader,blending:0}),this.depthRenderMaterial.uniforms.cameraNear.value=this.camera.near,this.depthRenderMaterial.uniforms.cameraFar.value=this.camera.far,this.copyMaterial=new gt({uniforms:W.clone(_d.uniforms),vertexShader:_d.vertexShader,fragmentShader:_d.fragmentShader,transparent:!0,depthTest:!1,depthWrite:!1,blendSrc:208,blendDst:200,blendEquation:100,blendSrcAlpha:206,blendDstAlpha:200,blendEquationAlpha:100}),this.blendMaterial=new gt({uniforms:W.clone(wd.uniforms),vertexShader:wd.vertexShader,fragmentShader:wd.fragmentShader,transparent:!0,depthTest:!1,depthWrite:!1,blending:5,blendSrc:208,blendDst:200,blendEquation:100,blendSrcAlpha:206,blendDstAlpha:200,blendEquationAlpha:100}),this._fsQuad=new md(null),this._originalClearColor=new m,this.setGBuffer(i?i.depthTexture:void 0,i?i.normalTexture:void 0),a!==void 0&&this.updateGtaoMaterial(a),o!==void 0&&this.updatePdMaterial(o)}setSize(e,t){this.width=e,this.height=t,this.gtaoRenderTarget.setSize(e,t),this.normalRenderTarget.setSize(e,t),this.pdRenderTarget.setSize(e,t),this.gtaoMaterial.uniforms.resolution.value.set(e,t),this.gtaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix),this.gtaoMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this.pdMaterial.uniforms.resolution.value.set(e,t),this.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse)}dispose(){this.gtaoNoiseTexture.dispose(),this.pdNoiseTexture.dispose(),this.normalRenderTarget.dispose(),this.gtaoRenderTarget.dispose(),this.pdRenderTarget.dispose(),this.normalMaterial.dispose(),this.pdMaterial.dispose(),this.copyMaterial.dispose(),this.depthRenderMaterial.dispose(),this._fsQuad.dispose()}get gtaoMap(){return this.pdRenderTarget.texture}setGBuffer(e,t){e===void 0?(this.depthTexture=new oe,this.depthTexture.format=te,this.depthTexture.type=Dt,this.normalRenderTarget=new wt(this.width,this.height,{minFilter:Je,magFilter:Je,type:st,depthTexture:this.depthTexture}),this.normalTexture=this.normalRenderTarget.texture,this._renderGBuffer=!0):(this.depthTexture=e,this.normalTexture=t,this._renderGBuffer=!1);let n=+!!this.normalTexture,r=this.depthTexture===this.normalTexture?`w`:`x`;this.gtaoMaterial.defines.NORMAL_VECTOR_TYPE=n,this.gtaoMaterial.defines.DEPTH_SWIZZLING=r,this.gtaoMaterial.uniforms.tNormal.value=this.normalTexture,this.gtaoMaterial.uniforms.tDepth.value=this.depthTexture,this.pdMaterial.defines.NORMAL_VECTOR_TYPE=n,this.pdMaterial.defines.DEPTH_SWIZZLING=r,this.pdMaterial.uniforms.tNormal.value=this.normalTexture,this.pdMaterial.uniforms.tDepth.value=this.depthTexture,this.depthRenderMaterial.uniforms.tDepth.value=this.normalRenderTarget.depthTexture}setSceneClipBox(e){e?(this.gtaoMaterial.needsUpdate=this.gtaoMaterial.defines.SCENE_CLIP_BOX!==1,this.gtaoMaterial.defines.SCENE_CLIP_BOX=1,this.gtaoMaterial.uniforms.sceneBoxMin.value.copy(e.min),this.gtaoMaterial.uniforms.sceneBoxMax.value.copy(e.max)):(this.gtaoMaterial.needsUpdate=this.gtaoMaterial.defines.SCENE_CLIP_BOX===0,this.gtaoMaterial.defines.SCENE_CLIP_BOX=0)}updateGtaoMaterial(e){e.radius!==void 0&&(this.gtaoMaterial.uniforms.radius.value=e.radius),e.distanceExponent!==void 0&&(this.gtaoMaterial.uniforms.distanceExponent.value=e.distanceExponent),e.thickness!==void 0&&(this.gtaoMaterial.uniforms.thickness.value=e.thickness),e.distanceFallOff!==void 0&&(this.gtaoMaterial.uniforms.distanceFallOff.value=e.distanceFallOff,this.gtaoMaterial.needsUpdate=!0),e.scale!==void 0&&(this.gtaoMaterial.uniforms.scale.value=e.scale),e.samples!==void 0&&e.samples!==this.gtaoMaterial.defines.SAMPLES&&(this.gtaoMaterial.defines.SAMPLES=e.samples,this.gtaoMaterial.needsUpdate=!0),e.screenSpaceRadius!==void 0&&+!!e.screenSpaceRadius!==this.gtaoMaterial.defines.SCREEN_SPACE_RADIUS&&(this.gtaoMaterial.defines.SCREEN_SPACE_RADIUS=+!!e.screenSpaceRadius,this.gtaoMaterial.needsUpdate=!0)}updatePdMaterial(e){let t=!1;e.lumaPhi!==void 0&&(this.pdMaterial.uniforms.lumaPhi.value=e.lumaPhi),e.depthPhi!==void 0&&(this.pdMaterial.uniforms.depthPhi.value=e.depthPhi),e.normalPhi!==void 0&&(this.pdMaterial.uniforms.normalPhi.value=e.normalPhi),e.radius!==void 0&&e.radius!==this.radius&&(this.pdMaterial.uniforms.radius.value=e.radius),e.radiusExponent!==void 0&&e.radiusExponent!==this.pdRadiusExponent&&(this.pdRadiusExponent=e.radiusExponent,t=!0),e.rings!==void 0&&e.rings!==this.pdRings&&(this.pdRings=e.rings,t=!0),e.samples!==void 0&&e.samples!==this.pdSamples&&(this.pdSamples=e.samples,t=!0),t&&(this.pdMaterial.defines.SAMPLES=this.pdSamples,this.pdMaterial.defines.SAMPLE_VECTORS=Od(this.pdSamples,this.pdRings,this.pdRadiusExponent),this.pdMaterial.needsUpdate=!0)}render(t,n,r){switch(this._renderGBuffer&&(this._overrideVisibility(),this._renderOverride(t,this.normalMaterial,this.normalRenderTarget,7829503,1),this._restoreVisibility()),this.gtaoMaterial.uniforms.cameraNear.value=this.camera.near,this.gtaoMaterial.uniforms.cameraFar.value=this.camera.far,this.gtaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix),this.gtaoMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this.gtaoMaterial.uniforms.cameraWorldMatrix.value.copy(this.camera.matrixWorld),this._renderPass(t,this.gtaoMaterial,this.gtaoRenderTarget,16777215,1),this.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this._renderPass(t,this.pdMaterial,this.pdRenderTarget,16777215,1),this.output){case e.OUTPUT.Off:break;case e.OUTPUT.Diffuse:this.copyMaterial.uniforms.tDiffuse.value=r.texture,this.copyMaterial.blending=0,this._renderPass(t,this.copyMaterial,this.renderToScreen?null:n);break;case e.OUTPUT.AO:this.copyMaterial.uniforms.tDiffuse.value=this.gtaoRenderTarget.texture,this.copyMaterial.blending=0,this._renderPass(t,this.copyMaterial,this.renderToScreen?null:n);break;case e.OUTPUT.Denoise:this.copyMaterial.uniforms.tDiffuse.value=this.pdRenderTarget.texture,this.copyMaterial.blending=0,this._renderPass(t,this.copyMaterial,this.renderToScreen?null:n);break;case e.OUTPUT.Depth:this.depthRenderMaterial.uniforms.cameraNear.value=this.camera.near,this.depthRenderMaterial.uniforms.cameraFar.value=this.camera.far,this._renderPass(t,this.depthRenderMaterial,this.renderToScreen?null:n);break;case e.OUTPUT.Normal:this.copyMaterial.uniforms.tDiffuse.value=this.normalRenderTarget.texture,this.copyMaterial.blending=0,this._renderPass(t,this.copyMaterial,this.renderToScreen?null:n);break;case e.OUTPUT.Default:this.copyMaterial.uniforms.tDiffuse.value=r.texture,this.copyMaterial.blending=0,this._renderPass(t,this.copyMaterial,this.renderToScreen?null:n),this.blendMaterial.uniforms.intensity.value=this.blendIntensity,this.blendMaterial.uniforms.tDiffuse.value=this.pdRenderTarget.texture,this._renderPass(t,this.blendMaterial,this.renderToScreen?null:n);break;default:console.warn(`THREE.GTAOPass: Unknown output type.`)}}_renderPass(e,t,n,r,i){e.getClearColor(this._originalClearColor);let a=e.getClearAlpha(),o=e.autoClear;e.setRenderTarget(n),e.autoClear=!1,r!=null&&(e.setClearColor(r),e.setClearAlpha(i||0),e.clear()),this._fsQuad.material=t,this._fsQuad.render(e),e.autoClear=o,e.setClearColor(this._originalClearColor),e.setClearAlpha(a)}_renderOverride(e,t,n,r,i){e.getClearColor(this._originalClearColor);let a=e.getClearAlpha(),o=e.autoClear;e.setRenderTarget(n),e.autoClear=!1,r=t.clearColor||r,i=t.clearAlpha||i,r!=null&&(e.setClearColor(r),e.setClearAlpha(i||0),e.clear()),this.scene.overrideMaterial=t,e.render(this.scene,this.camera),this.scene.overrideMaterial=null,e.autoClear=o,e.setClearColor(this._originalClearColor),e.setClearAlpha(a)}_overrideVisibility(){let e=this.scene,t=this._visibilityCache;e.traverse(function(e){(e.isPoints||e.isLine||e.isLine2)&&e.visible&&(e.visible=!1,t.push(e))})}_restoreVisibility(){let e=this._visibilityCache;for(let t=0;t<e.length;t++)e[t].visible=!0;e.length=0}_generateNoise(e=64){let t=new Ad,n=e*e*4,r=new Uint8Array(n);for(let n=0;n<e;n++)for(let i=0;i<e;i++){let a=n,o=i;r[(n*e+i)*4]=(t.noise(a,o)*.5+.5)*255,r[(n*e+i)*4+1]=(t.noise(a+e,o)*.5+.5)*255,r[(n*e+i)*4+2]=(t.noise(a,o+e)*.5+.5)*255,r[(n*e+i)*4+3]=(t.noise(a+e,o+e)*.5+.5)*255}let i=new R(r,e,e,ct,xt);return i.wrapS=_e,i.wrapT=_e,i.needsUpdate=!0,i}};jd.OUTPUT={Off:-1,Default:0,Diffuse:1,Depth:2,Normal:3,AO:4,Denoise:5};var Md={name:`OutputShader`,uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#elif defined( CUSTOM_TONE_MAPPING )

				gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`},Nd=class extends dd{constructor(){super(),this.isOutputPass=!0,this.uniforms=W.clone(Md.uniforms),this.material=new ee({name:Md.name,uniforms:this.uniforms,vertexShader:Md.vertexShader,fragmentShader:Md.fragmentShader}),this._fsQuad=new md(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,t,n){this.uniforms.tDiffuse.value=n.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,(this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping)&&(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},Ge.getTransfer(this._outputColorSpace)===`srgb`&&(this.material.defines.SRGB_TRANSFER=``),this._toneMapping===1?this.material.defines.LINEAR_TONE_MAPPING=``:this._toneMapping===2?this.material.defines.REINHARD_TONE_MAPPING=``:this._toneMapping===3?this.material.defines.CINEON_TONE_MAPPING=``:this._toneMapping===4?this.material.defines.ACES_FILMIC_TONE_MAPPING=``:this._toneMapping===6?this.material.defines.AGX_TONE_MAPPING=``:this._toneMapping===7?this.material.defines.NEUTRAL_TONE_MAPPING=``:this._toneMapping===5&&(this.material.defines.CUSTOM_TONE_MAPPING=``),this.material.needsUpdate=!0),this.renderToScreen===!0?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}},Pd=class extends dd{constructor(e,t,n=null,r=null,i=null){super(),this.scene=e,this.camera=t,this.overrideMaterial=n,this.clearColor=r,this.clearAlpha=i,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this.isRenderPass=!0,this._oldClearColor=new m}render(e,t,n){let r=e.autoClear;e.autoClear=!1;let i,a;this.overrideMaterial!==null&&(a=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha())),this.clearAlpha!==null&&(i=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha)),this.clearDepth==1&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:n),this.clear===!0&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),this.clearColor!==null&&e.setClearColor(this._oldClearColor),this.clearAlpha!==null&&e.setClearAlpha(i),this.overrideMaterial!==null&&(this.scene.overrideMaterial=a),e.autoClear=r}},Fd={name:`LuminosityHighPassShader`,uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new m(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`},Id=class e extends dd{constructor(e,t=1,n,r){super(),this.strength=t,this.radius=n,this.threshold=r,this.resolution=e===void 0?new Ee(256,256):new Ee(e.x,e.y),this.clearColor=new m(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let i=Math.round(this.resolution.x/2),a=Math.round(this.resolution.y/2);this.renderTargetBright=new wt(i,a,{type:st,depthBuffer:!1}),this.renderTargetBright.texture.name=`UnrealBloomPass.bright`,this.renderTargetBright.texture.generateMipmaps=!1;for(let e=0;e<this.nMips;e++){let t=new wt(i,a,{type:st,depthBuffer:!1});t.texture.name=`UnrealBloomPass.h`+e,t.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(t);let n=new wt(i,a,{type:st,depthBuffer:!1});n.texture.name=`UnrealBloomPass.v`+e,n.texture.generateMipmaps=!1,this.renderTargetsVertical.push(n),i=Math.round(i/2),a=Math.round(a/2)}let o=Fd;this.highPassUniforms=W.clone(o.uniforms),this.highPassUniforms.luminosityThreshold.value=r,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new gt({uniforms:this.highPassUniforms,vertexShader:o.vertexShader,fragmentShader:o.fragmentShader}),this.separableBlurMaterials=[];let s=[6,10,14,18,22];i=Math.round(this.resolution.x/2),a=Math.round(this.resolution.y/2);for(let e=0;e<this.nMips;e++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(s[e])),this.separableBlurMaterials[e].uniforms.invSize.value=new Ee(1/i,1/a),i=Math.round(i/2),a=Math.round(a/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=t,this.compositeMaterial.uniforms.bloomRadius.value=.1;let c=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=c,this.bloomTintColors=[new Y(1,1,1),new Y(1,1,1),new Y(1,1,1),new Y(1,1,1),new Y(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=W.clone(_d.uniforms),this.blendMaterial=new gt({uniforms:this.copyUniforms,vertexShader:_d.vertexShader,fragmentShader:_d.fragmentShader,premultipliedAlpha:!0,blending:2,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new m,this._oldClearAlpha=1,this._basic=new B,this._fsQuad=new md(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(e,t){let n=Math.round(e/2),r=Math.round(t/2);this.renderTargetBright.setSize(n,r);for(let e=0;e<this.nMips;e++)this.renderTargetsHorizontal[e].setSize(n,r),this.renderTargetsVertical[e].setSize(n,r),this.separableBlurMaterials[e].uniforms.invSize.value=new Ee(1/n,1/r),n=Math.round(n/2),r=Math.round(r/2)}render(t,n,r,i,a){t.getClearColor(this._oldClearColor),this._oldClearAlpha=t.getClearAlpha();let o=t.autoClear;t.autoClear=!1,t.setClearColor(this.clearColor,0),a&&t.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this._fsQuad.material=this._basic,this._basic.map=r.texture,t.setRenderTarget(null),t.clear(),this._fsQuad.render(t)),this.highPassUniforms.tDiffuse.value=r.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,t.setRenderTarget(this.renderTargetBright),t.clear(),this._fsQuad.render(t);let s=this.renderTargetBright;for(let n=0;n<this.nMips;n++)this._fsQuad.material=this.separableBlurMaterials[n],this.separableBlurMaterials[n].uniforms.colorTexture.value=s.texture,this.separableBlurMaterials[n].uniforms.direction.value=e.BlurDirectionX,t.setRenderTarget(this.renderTargetsHorizontal[n]),t.clear(),this._fsQuad.render(t),this.separableBlurMaterials[n].uniforms.colorTexture.value=this.renderTargetsHorizontal[n].texture,this.separableBlurMaterials[n].uniforms.direction.value=e.BlurDirectionY,t.setRenderTarget(this.renderTargetsVertical[n]),t.clear(),this._fsQuad.render(t),s=this.renderTargetsVertical[n];this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,t.setRenderTarget(this.renderTargetsHorizontal[0]),t.clear(),this._fsQuad.render(t),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,a&&t.state.buffers.stencil.setTest(!0),this.renderToScreen?(t.setRenderTarget(null),this._fsQuad.render(t)):(t.setRenderTarget(r),this._fsQuad.render(t)),t.setClearColor(this._oldClearColor,this._oldClearAlpha),t.autoClear=o}_getSeparableBlurMaterial(e){let t=[],n=e/3;for(let r=0;r<e;r++)t.push(.39894*Math.exp(-.5*r*r/(n*n))/n);let r=[],i=[];for(let n=1;n<e;n+=2){let a=t[n],o=n+1<e?t[n+1]:0,s=a+o;r.push((n*a+(n+1)*o)/s),i.push(s)}return new gt({defines:{KERNEL_PAIRS:r.length},uniforms:{colorTexture:{value:null},invSize:{value:new Ee(.5,.5)},direction:{value:new Ee(.5,.5)},centerWeight:{value:t[0]},gaussianOffsets:{value:r},gaussianWeights:{value:i}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				#include <common>

				varying vec2 vUv;

				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float centerWeight;
				uniform float gaussianOffsets[KERNEL_PAIRS];
				uniform float gaussianWeights[KERNEL_PAIRS];

				void main() {

					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * centerWeight;

					for ( int i = 0; i < KERNEL_PAIRS; i ++ ) {

						vec2 uvOffset = direction * invSize * gaussianOffsets[ i ];
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += ( sample1 + sample2 ) * gaussianWeights[ i ];

					}

					gl_FragColor = vec4( diffuseSum, 1.0 );

				}`})}_getCompositeMaterial(e){return new gt({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				varying vec2 vUv;

				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor( const in float factor ) {

					float mirrorFactor = 1.2 - factor;
					return mix( factor, mirrorFactor, bloomRadius );

				}

				void main() {

					// 3.0 for backwards compatibility with previous alpha-based intensity
					vec3 bloom = 3.0 * bloomStrength * (
						lerpBloomFactor( bloomFactors[ 0 ] ) * bloomTintColors[ 0 ] * texture2D( blurTexture1, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 1 ] ) * bloomTintColors[ 1 ] * texture2D( blurTexture2, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 2 ] ) * bloomTintColors[ 2 ] * texture2D( blurTexture3, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 3 ] ) * bloomTintColors[ 3 ] * texture2D( blurTexture4, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 4 ] ) * bloomTintColors[ 4 ] * texture2D( blurTexture5, vUv ).rgb
					);

					float bloomAlpha = max( bloom.r, max( bloom.g, bloom.b ) );
					gl_FragColor = vec4( bloom, bloomAlpha );

				}`})}};Id.BlurDirectionX=new Ee(1,0),Id.BlurDirectionY=new Ee(0,1);var Ld=6e-4,Rd=.008,zd=.3,Bd=1.6;function Vd(e,t,n,r,i,a){let o=e.getPixelRatio(),s=new xd(e,new wt(i*o,a*o,{type:st,samples:r.msaa}));s.setPixelRatio(o),s.setSize(i,a),s.addPass(new Pd(t,n));let c=null;r.ao&&(c=new jd(t,n,i,a),c.updateGtaoMaterial({radius:.6,scale:.9}),c.blendIntensity=.9,s.addPass(c));let l=null;r.bloom&&(l=new Id(new Ee(i,a),.25,.4,Bd),s.addPass(l));let u=null,d={};r.dof&&(u=new gd(t,n,{focus:5,aperture:0,maxblur:0}),d=u.uniforms,u.enabled=!1,s.addPass(u)),s.addPass(new Nd);let f=!1,p=0;return{render(e){if(u){let t=+!!f,n=e/zd;p=p<t?Math.min(t,p+n):Math.max(t,p-n),u.enabled=p>.01,d.aperture.value=Ld*p,d.maxblur.value=Rd*p}s.render(e)},setSize(t,n){s.setPixelRatio(e.getPixelRatio()),s.setSize(t,n),c?.setSize(t,n),l?.setSize(t,n)},setDof(e,t){f=e&&!!u,u&&(d.focus.value=t)},dispose(){s.passes.forEach(e=>e.dispose?.()),s.renderTarget1.dispose(),s.renderTarget2.dispose()}}}function $(e,t,n){let r=document.createElement(e);return r.className=t,n.appendChild(r),r}var Hd=`http://www.w3.org/2000/svg`;function Ud(e,t,n){let r=document.createElementNS(Hd,e);for(let[e,n]of Object.entries(t))r.setAttribute(e,String(n));return n.appendChild(r),r}var Wd={fairway:`Fairway`,rough:`Rough`,sand:`Sand`,green:`Green`,water:`Water!`,tree:`Trees`},Gd=104,Kd=116,qd=60;function Jd(e,t){return{z0:t-20,z1:Math.min(e.length+30,t+280)}}function Yd(e,t,n){return e?`matrix(0 -1 1 0 ${-t} ${qd})`:`matrix(-1 0 0 -1 ${qd} ${n})`}function Xd(e,t,n,r,i){let a=e?t.z1-t.z0:120,o=e?120:t.z1-t.z0,s=Math.min(n.w/a,n.h/o),c=(r-(n.w-a*s)/2)/s,l=(i-(n.h-o*s)/2)/s;return e?{x:qd-l,z:c+t.z0}:{x:qd-c,z:t.z1-l}}function Zd(e,t,n,r){return{x:qd-n/Math.max(t.w,1)*2*qd,z:e.length*(1-r/Math.max(t.h,1))}}var Qd=6,$d=10,ef=300;function tf(){let e=document.body,t=()=>window.matchMedia?.(`(min-aspect-ratio: 6/5)`).matches??!1,n=$(`div`,`fg-card`,e);n.setAttribute(`role`,`img`);let r=Array.from({length:9},(e,t)=>{let r=$(`div`,`fg-f`,n);return $(`div`,`fg-fn`,r).textContent=String(t+1),{cell:r,par:$(`div`,`fg-par`,r),score:$(`div`,`fg-s`,r)}}),i=$(`div`,`fg-f fg-tot`,n);$(`div`,`fg-fn`,i).innerHTML=`<span class="fg-tot-long">Total</span><span class="fg-tot-short">Tot</span>`;let a=$(`div`,`fg-s`,i),o=$(`div`,`fg-total`,n),s=$(`div`,`fg-map`,e);s.setAttribute(`role`,`img`),s.setAttribute(`aria-label`,`Map of the hole`);let c=Ud(`svg`,{class:`fg-map-svg`,preserveAspectRatio:`none`},s),l=null,u=null,d=null,f=null,p=null,m=(e,t,n,r,i,a)=>{Ud(`rect`,{x:n,y:i,width:r-n,height:a-i,fill:`#4d8a3a`},e);let o=[],s=[];for(let e=Math.max(i,0);e<=Math.min(a,t.length);e+=10)o.push(`${jr(t,e)-18},${e}`),s.unshift(`${jr(t,e)+18},${e}`);Ud(`polygon`,{points:[...o,...s].join(` `),fill:`#78c45a`},e),Ud(`ellipse`,{cx:t.pin.x,cy:t.pin.z,rx:16,ry:16,fill:`#a8e88a`},e);for(let n of t.hazards)Ud(`ellipse`,{cx:n.at.x,cy:n.at.z,rx:n.at.rx,ry:n.at.rz,fill:n.kind===`sand`?`#e8cf8f`:`#3f8fe0`},e)},h=e=>{l=e,c.replaceChildren(),c.setAttribute(`viewBox`,`-60 0 120 ${e.length}`);let t=Ud(`g`,{transform:`translate(0 ${e.length}) scale(-1 -1)`},c);u=t,m(t,e,-60,qd,0,e.length),f=Ud(`line`,{stroke:`#fff`,"stroke-width":2,"stroke-dasharray":`6 5`,"vector-effect":`non-scaling-stroke`},t),Ud(`ellipse`,{cx:e.pin.x,cy:e.pin.z,rx:3.5,ry:3.5,fill:`#ff3d3d`},t),p=Ud(`ellipse`,{fill:`rgba(255,255,255,0.25)`,stroke:`#fff`,"stroke-width":1.5,"vector-effect":`non-scaling-stroke`},t),d=Ud(`ellipse`,{rx:4,ry:4,fill:`#fff`,stroke:`#222`,"stroke-width":1},t)},g=$(`div`,`fg-controls`,e),_=$(`div`,`fg-chips`,g),v=$(`div`,`fg-chip fg-pin`,$(`div`,`fg-chipcol fg-chipleft`,_)),y=$(`div`,`fg-chipcol`,_),b=$(`div`,`fg-chip fg-club`,y),x=$(`div`,`fg-chip fg-lie`,y),S=$(`div`,`fg-dist`,_),C=$(`button`,`fg-nudge fg-farther`,S);C.type=`button`,C.textContent=`▲`,C.setAttribute(`aria-label`,`Farther`);let w=$(`button`,`fg-nudge fg-shorter`,S);w.type=`button`,w.textContent=`▼`,w.setAttribute(`aria-label`,`Shorter`);let T=$(`div`,`fg-row`,g),E=$(`button`,`fg-nudge fg-left`,T);E.type=`button`,E.textContent=`◀`,E.setAttribute(`aria-label`,`Aim left`);let D=$(`button`,`fg-swing`,T);D.type=`button`,D.textContent=`Swing!`;let O=$(`button`,`fg-nudge fg-right`,T);O.type=`button`,O.textContent=`▶`,O.setAttribute(`aria-label`,`Aim right`);let k=$(`div`,`fg-q`,e);k.setAttribute(`aria-live`,`polite`);let A=$(`span`,`fg-q-text`,k),j=$(`button`,`fg-hear`,k);j.type=`button`,j.textContent=`🔊`,j.setAttribute(`aria-label`,`Hear the question`);let ee=$(`div`,`fg-clock`,k);ee.setAttribute(`role`,`timer`),ee.setAttribute(`aria-label`,`Time left`);let M=$(`i`,``,ee),N=$(`div`,`fg-answers`,e),te=Array.from({length:4},()=>{let e=$(`button`,`fg-answer`,N);return e.type=`button`,e});k.hidden=!0,N.hidden=!0,g.hidden=!0,s.hidden=!0;let P=$(`div`,`fg-banner`,e);P.setAttribute(`role`,`status`);let ne=$(`div`,`fg-banner-title`,P),re=$(`div`,`fg-banner-detail`,P);P.hidden=!0;let F=$(`div`,`fg-pill`,e);F.setAttribute(`role`,`status`),F.hidden=!0;let ie=null,I=null,L=null,R=e=>{let t=c.getBoundingClientRect();return!l||!t.width?null:Zd(l,{w:t.width,h:t.height},e.clientX-t.left,e.clientY-t.top)};s.addEventListener(`pointerdown`,e=>{e.stopPropagation(),!L&&e.isPrimary&&(L={id:e.pointerId,x:e.clientX,y:e.clientY,at:e.timeStamp,dragging:!1},s.setPointerCapture?.(e.pointerId))}),s.addEventListener(`pointermove`,e=>{if(e.stopPropagation(),!L||L.id!==e.pointerId)return;!L.dragging&&Math.hypot(e.clientX-L.x,e.clientY-L.y)>Qd&&(L.dragging=!0);let t=L.dragging?R(e):null;t&&ie?.(t)});let ae=e=>{if(e.stopPropagation(),!L||L.id!==e.pointerId)return;let t=!L.dragging&&Math.hypot(e.clientX-L.x,e.clientY-L.y)<=$d&&e.timeStamp-L.at<=ef;L=null,t&&e.type===`pointerup`&&I?.()};s.addEventListener(`pointerup`,ae),s.addEventListener(`pointercancel`,ae);let z=$(`div`,`fg-bigmap`,e);z.hidden=!0;let oe=$(`div`,`fg-bigmap-panel`,z),se=Ud(`svg`,{class:`fg-bigmap-svg`,preserveAspectRatio:`xMidYMid meet`},oe),ce=$(`button`,`fg-bigmap-done`,oe);ce.type=`button`,ce.textContent=`Done`;let le={z0:0,z1:100},B=!1,ue=()=>{z.hidden=!0,g.style.visibility=``},de=e=>{let t=se.getBoundingClientRect();return Xd(B,le,{w:t.width,h:t.height},e.clientX-t.left,e.clientY-t.top)},fe=null;z.addEventListener(`pointerdown`,e=>{e.stopPropagation(),e.target===z?ue():e.target.closest(`.fg-bigmap-done`)||fe!==null||(fe=e.pointerId,oe.setPointerCapture?.(e.pointerId),ie?.(de(e)))}),z.addEventListener(`pointermove`,e=>{e.stopPropagation(),fe===e.pointerId&&ie?.(de(e))});let V=e=>{e.stopPropagation(),fe===e.pointerId&&(fe=null)};z.addEventListener(`pointerup`,V),z.addEventListener(`pointercancel`,V);let pe=it(ce,ue),me=(e,n,r,i,a)=>{B=t(),le=Jd(e,n.z);let{z0:o,z1:s}=le;se.replaceChildren(),se.setAttribute(`viewBox`,B?`0 0 ${s-o} 120`:`0 0 120 ${s-o}`);let c=Ud(`clipPath`,{id:`fg-bigmap-clip`,clipPathUnits:`userSpaceOnUse`},se),l=Ud(`g`,{transform:Yd(B,o,s),"clip-path":`url(#fg-bigmap-clip)`},se);Ud(`rect`,{x:-60,y:o,width:120,height:s-o},c),m(l,e,-60,qd,o,s);for(let t of e.trees)Ud(`circle`,{cx:t.x,cy:t.z,r:t.r,fill:`#1f5a2a`},l);Ud(`circle`,{cx:e.pin.x,cy:e.pin.z,r:1.6,fill:`#ff3d3d`},l);let u=Br(a),d=Math.atan2(e.pin.x-n.x,e.pin.z-n.z),f=[];for(let e=0;e<=36;e++){let t=d+(e/36*2-1)*(90*Math.PI/180);f.push(`${n.x+u*Math.sin(t)},${n.z+u*Math.cos(t)}`)}Ud(`polyline`,{points:f.join(` `),fill:`none`,stroke:`rgba(255,255,255,0.55)`,"stroke-width":.8},l);let p=`#${ol(Nr(e,r.landing.x,r.landing.z)).toString(16).padStart(6,`0`)}`;Ud(`line`,{x1:n.x,y1:n.z,x2:r.landing.x,y2:r.landing.z,stroke:`#fff`,"stroke-width":.8,"stroke-dasharray":`2 2`},l),Ud(`circle`,{cx:r.landing.x,cy:r.landing.z,r:r.ringR,fill:`rgba(255,255,255,0.25)`,stroke:p,"stroke-width":1.2},l);let h=i.kind===`rest`&&i.tree===void 0?i.at:i.kind===`water`?i.splash:null;if(h&&!Gr(r)&&Math.hypot(h.x-r.landing.x,h.z-r.landing.z)>=.5){let e=i.kind===`water`||i.kind===`rest`&&i.surface===`sand`?`#ff4b4b`:`#fff`;Ud(`line`,{x1:r.landing.x,y1:r.landing.z,x2:h.x,y2:h.z,stroke:e,"stroke-width":1,"stroke-dasharray":`1 2`},l),Ud(`circle`,{cx:h.x,cy:h.z,r:1.6,fill:`none`,stroke:e,"stroke-width":.9},l)}Ud(`circle`,{cx:n.x,cy:n.z,r:2,fill:`#fff`,stroke:`#222`,"stroke-width":.6},l)},he=[],H=e=>e.getBoundingClientRect(),ge=()=>{let e=n.getBoundingClientRect().bottom;document.documentElement.style.setProperty(`--fg-card-bottom`,`${e}px`)};return{buttons:te,hear:j,avoid:[n,s,k,P],swing:D,nudgeLeft:E,nudgeRight:O,farther:C,shorter:w,renderCard(e,t){e.forEach((e,t)=>{let n=r[t];n.par.textContent=`Par ${e.par}`,n.score.textContent=e.strokes===null?``:String(e.strokes),n.cell.classList.toggle(`cur`,e.current)});let i=e.filter(e=>e.strokes!==null&&!e.current).length;a.textContent=Ji(t),a.dataset.tone=Yi(t);let o=t===0?`level par`:`${Math.abs(t)} ${t<0?`under`:`over`} par`;n.setAttribute(`aria-label`,`Scorecard, ${i} holes played, ${o}`),ge()},setCardBig(e,t=``){n.classList.toggle(`big`,e),o.textContent=t,ge()},showCard(e){n.hidden=!e},renderChips(e,t){b.textContent=e.club,x.textContent=e.surface,v.textContent=e.pin,D.textContent=t?`Putt!`:`Swing!`,D.setAttribute(`aria-label`,t?`Putt`:`Swing`),x.dataset.surface=e.surface},renderMap(e,t,n){if(l!==e&&h(e),!u||!d||!f||!p)return;let r=s.getBoundingClientRect(),i=(r.width||84)/120,a=(r.height||150)/e.length;if(d.setAttribute(`cx`,String(t.x)),d.setAttribute(`cy`,String(t.z)),d.setAttribute(`rx`,`4`),d.setAttribute(`ry`,String(4*i/a)),n){f.setAttribute(`x1`,String(t.x)),f.setAttribute(`y1`,String(t.z)),f.setAttribute(`x2`,String(n.at.x)),f.setAttribute(`y2`,String(n.at.z)),f.style.display=``;let e=Math.max(n.r,3/i),r=`#${ol(n.over).toString(16).padStart(6,`0`)}`;p.setAttribute(`cx`,String(n.at.x)),p.setAttribute(`cy`,String(n.at.z)),p.setAttribute(`rx`,String(e)),p.setAttribute(`ry`,String(e*i/a)),p.setAttribute(`stroke`,r),p.style.display=``}else f.style.display=`none`,p.style.display=`none`},showMap(e){s.hidden=!e},onMapPlace(e){ie=e},onMapTap(e){I=e},showBigMap(e,t,n,r,i){z.hidden=!1,g.style.visibility=`hidden`,me(e,t,n,r,i)},hideBigMap:ue,get bigMapOpen(){return!z.hidden},showControls(e){g.hidden=!e},setQuestion(e){A.textContent=e},setOptions(e){he=e,Oe(te,e,`fg-answer`)},showQuestion(e,t=!1){k.hidden=!e,N.hidden=!e&&!t,te.forEach((e,t)=>e.hidden=he[t]===void 0),e||ee.classList.remove(`on`,`urgent`)},setClock(e,t){ee.classList.toggle(`on`,e!==null),ee.classList.toggle(`urgent`,t),M.style.width=e===null?`100%`:`${Math.max(0,Math.min(1,e))*100}%`},lock(){Ye(te)},mark(e,t,n){vt(te,e,t,n)},showBanner(e,n,r,i){ne.textContent=e,re.textContent=n,re.hidden=!n,P.className=`fg-banner ${r}`,P.hidden=!1;let a=window.innerHeight,o=window.innerWidth,s=t(),c,l=o/2;if(i===`ask`&&!N.hidden)c=s?a-12:H(N).top,s&&(l=(H(N).right+o)/2);else{let e=g.hidden;g.hidden=!1;let t=H(g);g.hidden=e,c=s?a-12:t.top,s&&(l=(t.left+0)/2)}let u=r===`miss`&&i===`ask`?Math.min(o,a)>=520?Kd:Gd:0;P.style.bottom=`${Math.max(a-c+8+u,8)}px`,P.style.left=`${l}px`},hideBanner(){P.hidden=!0},showPill(e){F.textContent=e,F.hidden=!1,F.classList.remove(`on`),F.offsetWidth,F.classList.add(`on`),F.style.top=`${n.getBoundingClientRect().bottom+8+12}px`},hidePill(){F.hidden=!0,F.classList.remove(`on`)},measureBands(){ge();let e={q:k.hidden,a:N.hidden,c:g.hidden,m:s.hidden};k.hidden=!1,N.hidden=!1,g.hidden=!1;let r=n.getBoundingClientRect().bottom,i=window.innerHeight,a=window.innerWidth,o=t()?{aim:{top:r+8,bottom:i-12,left:0,right:H(g).left-8},ask:{top:r+8,bottom:i-12,left:H(k).right+8,right:a},play:{top:r+8,bottom:i-12}}:{aim:{top:r+8,bottom:H(g).top-8},ask:{top:H(k).bottom+8,bottom:H(N).top-8},play:{top:r+8,bottom:i-12}};return k.hidden=e.q,N.hidden=e.a,g.hidden=e.c,s.hidden=e.m,o},dispose(){pe();for(let e of[n,s,z,g,k,N,P,F])e.remove()}}}function nf(e,t){return e/2-(t.top+t.bottom)/2}function rf(e,t){return e/2-((t.left??0)+(t.right??e))/2}var af=(e,t,n)=>Math.min(Math.max(e,t),n),of=new P,sf=new Y;function cf(e,t,n,r,i,a){of.fov=r,of.aspect=i/Math.max(a,1),of.near=.3,of.far=1200,of.clearViewOffset(),of.updateProjectionMatrix(),of.position.set(t.x,t.y,t.z),of.lookAt(n.x,n.y,n.z),of.updateMatrixWorld();let o=sf.set(e.x,e.y,e.z).project(of);return{x:(o.x+1)/2*i,y:(1-o.y)/2*a,behind:o.z>1}}var lf=6,uf=70,df=.06,ff=.1;function pf(e,t,n,r,i){let a={x:0,y:0,z:0};for(let e of t)a.x+=e.x/t.length,a.y+=e.y/t.length,a.z+=e.z/t.length;let o=Math.atan2(a.x-e.x,a.z-e.z),s=t.map(t=>Math.atan2(t.y-e.y,Math.hypot(t.x-e.x,t.z-e.z))),c=(Math.min(...s)+Math.max(...s))/2,l=t=>({x:e.x+Math.sin(o)*Math.cos(t)*10,y:e.y+Math.sin(t)*10,z:e.z+Math.cos(o)*Math.cos(t)*10}),u=Math.max(i.bottom-i.top,1),d=Math.max((i.right??n)-(i.left??0),1),f=u*df,p=d*ff,m=lf,h=l(c);for(;m<=uf;m+=1){let i=r/2/Math.tan(m*Math.PI/360);for(let a=0;a<8;a++){let a=t.map(t=>cf(t,e,h,m,n,r)),s=a.map(e=>e.y),u=a.map(e=>e.x),d=(Math.min(...s)+Math.max(...s))/2,f=(Math.min(...u)+Math.max(...u))/2;c-=Math.atan((d-r/2)/i),o-=Math.atan((f-n/2)/i),h=l(c)}let a=t.map(t=>cf(t,e,h,m,n,r)),s=Math.max(...a.map(e=>e.y))-Math.min(...a.map(e=>e.y)),g=Math.max(...a.map(e=>e.x))-Math.min(...a.map(e=>e.x));if(s<=u-2*f&&g<=d-2*p&&!a.some(e=>e.behind))break}return{pos:e,look:h,fov:af(m,lf,uf),shift:nf(r,i),shiftX:rf(n,i)}}var mf=3.5,hf=e=>({x:Math.sin(e),z:Math.cos(e)});function gf(e,t,n,r,i,a,o){let s=hf(e.dir),c={x:e.from.x-s.x*9,y:mf,z:e.from.z-s.z*9},l=e.ringR,u={x:Math.cos(e.dir),z:-Math.sin(e.dir)},d=[{x:e.landing.x-u.x*l,y:0,z:e.landing.z-u.z*l},{x:e.landing.x+u.x*l,y:0,z:e.landing.z+u.z*l},{x:e.landing.x,y:1,z:e.landing.z},{x:e.from.x,y:0,z:e.from.z},{x:n.x,y:2.1,z:n.z},{x:n.x,y:r/Math.max(i,1)>1.2?.9:.1,z:n.z}];return o&&d.push({x:o.x,y:0,z:o.z}),Math.hypot(t.pin.x-e.from.x,t.pin.z-e.from.z)<=120&&d.push({x:t.pin.x,y:0,z:t.pin.z},{x:t.pin.x,y:2.4,z:t.pin.z}),pf(c,d,r,i,a)}function _f(e,t,n,r,i,a,o){let s=hf(e.dir);return pf({x:e.from.x-s.x*14,y:16,z:e.from.z-s.z*14},[{x:e.from.x,y:0,z:e.from.z},{x:e.from.x+s.x*o,y:0,z:e.from.z+s.z*o},{x:e.landing.x,y:0,z:e.landing.z},{x:n.x,y:.1,z:n.z}],r,i,a)}function vf(e,t,n,r,i,a){let o=hf(t),s=n?5:12,c=n?2.5:5;return{pos:{x:e.x-o.x*s,y:c+e.y*.5,z:e.z-o.z*s},look:{x:e.x+o.x*20,y:.5+e.y*.4,z:e.z+o.z*20},fov:50,shift:nf(i,a),shiftX:rf(r,a)}}function yf(e,t,n,r,i){let a=hf(t);return{pos:{x:e.x-a.x*14,y:8,z:e.z-a.z*14},look:{x:e.x,y:0,z:e.z},fov:42,shift:nf(r,i),shiftX:rf(n,i)}}function bf(e,t,n,r,i=0){let a=af(i,0,1),o=a*a*(3-2*a),s=Math.min(e.length*.3,70),c=s+(e.length-10-s)*o,l=-45+(Math.max(-45,e.length-95)+45)*o;return{pos:{x:jr(e,Math.max(l,0)),y:55-10*o,z:l},look:{x:jr(e,c),y:0,z:c},fov:55,shift:nf(n,r),shiftX:rf(t,r)}}var xf=`fore`,Sf=2.6,Cf=2.4,wf=1.2,Tf=2,Ef=3,Df=1.6,Of=.5,kf=.6,Af=.3,jf=.3,Mf=.15,Nf=(e,t,n)=>({x:Ot.lerp(e.x,t.x,n),y:Ot.lerp(e.y,t.y,n),z:Ot.lerp(e.z,t.z,n)}),Pf=e=>e<.5?2*e*e:1-(-2*e+2)**2/2,Ff=`fore.gfx`;function If(){try{let e=localStorage.getItem(Ff);return e===`low`||e===`medium`||e===`high`?e:null}catch{return null}}function Lf(e){try{localStorage.setItem(Ff,e)}catch{}}function Rf(e){let t=``;try{let n=e.getContext(),r=n.getExtension(`WEBGL_debug_renderer_info`);r&&(t=String(n.getParameter(r.UNMASKED_RENDERER_WEBGL)??``))}catch{t=``}return{gpu:t,cores:navigator.hardwareConcurrency??0,minSide:Math.min(window.screen.width,window.screen.height),mobile:/Android|iPhone|iPad|Mobile/.test(navigator.userAgent)||navigator.maxTouchPoints>1}}var zf=.75,Bf=3.2,Vf=120;function Hf(o){let s=document.getElementById(`game`);if(!s)throw Error(`Missing #game container`);let f=lt(s,{fov:40,near:.5,far:900}),{scene:p,camera:h,renderer:g}=f;p.background=new m(Ku),p.fog=new E(Ku,260,1500),g.toneMapping=7,g.toneMappingExposure=zf;let _=Ea(),v=_??If()??os(Rf(g)),y=is(v),b=y,x=Ta()&&y.shadows!==`none`;g.shadowMap.enabled=x,g.shadowMap.type=2;let S=new Y(...fs(null).dir),C=new kt(16773596,Bf),w=x&&b.shadows===`single`,T=null;if(x&&b.shadows===`cascaded`)T=new Zt({camera:h,parent:p,cascades:b.cascades,maxFar:b.shadowFar,shadowMapSize:b.shadowSize,shadowBias:-3e-4,lightDirection:S.clone().negate(),lightIntensity:3.2}),T.lights.forEach(e=>{e.color.set(16773596),e.shadow.normalBias=.02});else if(p.add(C,C.target),w){C.castShadow=!0,C.shadow.mapSize.set(b.shadowSize,b.shadowSize);let e=C.shadow.camera;e.left=e.bottom=-30,e.right=e.top=30,e.near=1,e.far=220,C.shadow.bias=-3e-4,C.shadow.normalBias=.02}let D=Gs(),O=null,k=null,A=null,ee=ps,M=()=>({settings:y,assets:ee,csm:T,sun:S,shadows:x}),N=Vs,te=y.post?1.5:1,P=wi(te);p.add(P.object);let ne=fl(te);p.add(ne.object);let re=Nl(y.blades);p.add(re.object);let F=``,ie=()=>{let e=`${Te}:${K.at.x.toFixed(2)},${K.at.z.toFixed(2)}`;if(e===F)return;F=e;let t=Te*7919+Math.round(K.at.x*100)*31+Math.round(K.at.z*100);re.rebuild(G,K.at,t)},I=al();p.add(I.root);let L=$o();p.add(L.root);for(let e of[I.root,L.root])e.traverse(e=>{e.name===`blob`?e.visible=!x:e.isMesh&&(e.castShadow=x)});Ws(T,p);let R=null,ae=.016,z=()=>{let e=s.clientWidth,t=s.clientHeight;g.setPixelRatio(Math.min(window.devicePixelRatio,y.pixelRatio));let n=g.getDrawingBufferSize(new Ee);P.setResolution(n.x,n.y),R?.setSize(e,t)},oe=()=>{R?.dispose(),R=null,f.setRender(null),z(),y.post&&(R=Vd(g,p,h,y,Math.max(s.clientWidth,1),Math.max(s.clientHeight,1)),f.setRender(()=>R?.render(ae)))};oe();let se=new ResizeObserver(z);se.observe(s),window.addEventListener(`orientationchange`,z);let ce=!1,le=null,B=null,ue=e=>{ee=e;let t=e.sky,{dir:n,yaw:r}=fs(t?.sun??null);if(S.set(...n),T?.lightDirection.copy(S).negate(),t){let e=new Qe(g);k=e.fromEquirectangular(t.hdr),e.dispose(),p.environment=k.texture,p.environmentIntensity=1,p.environmentRotation.set(0,r,0);let[n,i,a]=t.horizon;p.fog=new E(new m().setRGB(Math.min(n/zf,1),Math.min(i/zf,1),Math.min(a/zf,1)),260,1500),p.background=p.fog.color}else O=new j(14676223,6195782,.4),p.add(O);A=ku(t,r,p.fog?p.fog.color:void 0),p.add(A.object),N=M(),I.setModel(e.people,x),L.setModel(e.people,x),Ws(T,I.root),Ws(T,L.root),ce=!0,le?.remove(),le=null,B?.(),B=null},de=ld(),fe=gs(Math.min(8,g.capabilities.getMaxAnisotropy()),e=>{le?.update(e),de.progress(e*.5)}).then(ue).catch(()=>ue(ps)),V=e=>{ce?e():(le??=er(document.body),B=e)},pe=[],me=_!==null,he=new Map,H=null,ge=null,_e=e=>{H!==N&&(he.forEach(e=>e!==ge&&e.dispose()),he.clear(),H=N);let t=he.get(e);return t||(t=cd(Ar[e],N),t.object.visible=!1,p.add(t.object),he.set(e,t)),t},U=tf(),ye=jt();u();let be=c(),xe=l({onPause:()=>{f.stop(),r()},onResume:()=>f.start()}),W=`preview`,Se=Mt(()=>o.chooseFacts()),we=o.highScore(),Te=0,G=Ar[0],De=(e,t)=>Os(G,e,t),Oe=(e,t)=>{let n=De(e.x,e.z);P.place({x:e.x,y:e.y+n,z:e.z},t,n)},K=Vi(G),ke=[],je={...G.pin},Me=null,q=ba(Wr(G,K.at,K.lie,je),K.lie),Pe=ui(G,q),Fe=!1,Ie={x:0,y:0},Le=new ve,Re=xa(),ze=!0,Be,Ve=[],Ue=-1,We=0,Ge=0,Ke=!1,qe=0,Je=10,Ye=0,Xe=ga(),Ze=null,J=null,$e=K,et=!1,tt=0,rt=0,at=1,ot=null,st=null,ct=-1,ut=!1,dt=`address`,pt=0,mt=-1,gt=0,_t=!1,vt=!1,yt=0,bt=ht(),xt=bt.after,St=0,Ct=0,wt={aim:{top:0,bottom:0},ask:{top:0,bottom:0},play:{top:0,bottom:0}},Tt=`intro`,X=0,Et={pos:{x:0,y:55,z:-45},look:{x:0,y:0,z:100},fov:50,shift:0,shiftX:0},Dt={...Et},At={...Et},Nt=1,Pt=.5,Ft=new Y,It={x:0,y:hi,z:0},Lt=()=>({x:I.root.position.x,y:0,z:I.root.position.z}),Rt=e=>{let t=I.root.position,n={x:-Math.cos(q.dir),z:Math.sin(q.dir)},r={x:Math.sin(q.dir),z:Math.cos(q.dir)},i=K.at,a=(e,t)=>({x:e,y:1.2,z:t}),o=ge?.gallery;if(e===`crowd`&&o){let e={x:Math.sin(o.centre),z:Math.cos(o.centre)},t=(t,n)=>({x:G.pin.x+e.x*t,y:n,z:G.pin.z+e.z*t});return{pos:t(cc-9,1.5),look:t(cc+3.5,1.1),fov:45,shift:nf(Ct,wt.aim),shiftX:rf(St,wt.aim)}}let[s,c]=e===`face`?[a(t.x+n.x*5,t.z+n.z*5),{x:t.x,y:1,z:t.z}]:e===`dtl`?[a(i.x-r.x*5,i.z-r.z*5),{x:i.x+r.x*5,y:.9,z:i.z+r.z*5}]:[a(t.x+r.x*5,t.z+r.z*5),{x:t.x,y:1,z:t.z}];return{pos:s,look:c,fov:40,shift:nf(Ct,wt.aim),shiftX:rf(St,wt.aim)}},zt=()=>Pe.kind===`rest`&&Pe.tree===void 0?Pe.at:Pe.kind===`water`?Pe.splash:void 0,Bt=e=>{let t=Ca();if(t&&e!==`intro`)return Rt(t);switch(e){case`intro`:return bf(G,St,Ct,wt.play,wa()??(yt-X)/Cf);case`aim`:return gf(q,G,Lt(),St,Ct,wt.aim,zt());case`place`:return _f(q,G,Lt(),St,Ct,wt.aim,Br(K.lie));case`ask`:return gf(q,G,Lt(),St,Ct,wt.ask,zt());case`follow`:return vf(It,q.dir,Gr(q),St,Ct,wt.play);case`land`:return yf({x:$e.at.x,y:0,z:$e.at.z},q.dir,St,Ct,wt.play)}},Vt=(e,t)=>{Tt=e,St&&(Dt={pos:{...Et.pos},look:{...Et.look},fov:Et.fov,shift:Et.shift,shiftX:Et.shiftX},At=Bt(e),Nt=+(t<=0),Pt=t)},Ht=e=>Vt(Tt,e),Ut=(e=!1)=>{let t=s.clientWidth,n=s.clientHeight;(e||t!==St||n!==Ct)&&(St=t,Ct=n,wt=U.measureBands(),h.aspect=t/Math.max(n,1),At=Bt(Tt),Dt=At,Nt=1)},Wt=()=>{(Tt===`follow`||Tt===`intro`)&&(At=Bt(Tt));let e=Nt>=1?1:Pf(Nt),t=Nt>=1?At:Dt;Et.pos=Nf(t.pos,At.pos,e),Et.look=Nf(t.look,At.look,e),Et.fov=Ot.lerp(t.fov,At.fov,e),Et.shift=Ot.lerp(t.shift,At.shift,e),Et.shiftX=Ot.lerp(t.shiftX,At.shiftX,e),h.fov=Et.fov,h.setViewOffset(St,Ct,Et.shiftX,Et.shift,St,Ct),h.updateProjectionMatrix(),h.position.set(Et.pos.x,Et.pos.y,Et.pos.z),Ft.set(Et.look.x,Et.look.y,Et.look.z),h.lookAt(Ft),h.updateMatrixWorld()},Gt=Ar.map(e=>e.par),Kt=()=>{let e=Ar.map((e,t)=>({par:e.par,strokes:t<ke.length?ke[t]:t===Te&&K.strokes+K.penalties>0?K.strokes+K.penalties:null,current:t===Te&&ke.length<=t}));U.renderCard(e,Gi(ke,Gt))},qt=e=>{dt=e,pt=yt},Jt=()=>ba(Wr(G,K.at,K.lie,je),K.lie),Yt=()=>{ie(),I.setClub(q.club),I.stand(K.at,q.dir,q.club.id,De),L.stand(I.root.position,q.dir,De);let e=Math.hypot(G.pin.x-K.at.x,G.pin.z-K.at.z);ge?.setCupAid(K.lie===`green`||e<=40)},Xt=()=>{q=Jt(),je={...q.landing};let e=Nr(G,q.landing.x,q.landing.z);Pe=ui(G,q);let t=Pe.kind===`rest`&&Pe.tree!==void 0;ne.update(q,e,Pe,t,De);let n=Gr(q),r=Math.hypot(G.pin.x-K.at.x,G.pin.z-K.at.z);U.renderChips({club:`${n?`Putter`:q.club.name} · ${Math.round(q.carry)} yd`,surface:Wd[e],pin:`Pin ${Math.round(r)} yd`},n),U.renderMap(G,K.at,{at:q.landing,r:q.ringR,over:e}),U.bigMapOpen&&U.showBigMap(G,K.at,q,Pe,K.lie),Yt()},Qt=e=>{W===`aim`&&(je=e,Xt(),Tt===`aim`&&Ht(.15))},$t=(e,t,r)=>{let i=++Ge,a=o=>{i===Ge&&We===t&&(o>=e.length?r():n(e[o],()=>a(o+1)))};a(0)},en=e=>{Te=e,G=Ar[e];let t=ge;ge=_e(e),t&&t!==ge&&(t.object.visible=!1,[...he.values()].includes(t)||t.dispose()),ge.object.visible=!0;let n=ze;K=n?pa(G):Vi(G),Me=n?ma(G,K):null,je=Ur(G,K.at,K.lie,G.pin);let r=n&&_a();ze=!1;let i=++We;if(bt.clear(),ye.disarm(),U.hideBanner(),U.hidePill(),U.showQuestion(!1),U.showControls(!1),U.showMap(!1),ne.setVisible(!1),q=Jt(),Yt(),P.setVisible(!0),P.splash(null),Oe({x:K.at.x,y:hi,z:K.at.z},K.lie),U.renderMap(G,K.at,null),Kt(),qt(`address`),P.setAddress(!1),r){tn(0);return}W=`intro`,X=yt,Vt(`intro`,0),U.showBanner(`Hole ${e+1}`,`Par ${G.par} · ${G.length} yd`,`info`,`aim`);let a=[ca(e)];e===Ar.length-1&&a.push(la),$t(a,i,()=>void 0),xt(Sf,()=>{We===i&&W===`intro`&&wa()===null&&tn(.9)})},tn=e=>{W=`aim`,je=Me??mi(G,K.at,K.lie),Me=null,U.hideBanner(),U.showQuestion(!1),ne.setVisible(!0),P.setVisible(!0),P.splash(null),Oe({x:K.at.x,y:hi,z:K.at.z},K.lie),P.setAddress(!0),Xt(),Kt(),U.showControls(!0),U.showMap(!0),qt(`address`),Vt(Sa()?`place`:`aim`,e),Re&&(Re=!1,U.showBigMap(G,K.at,q,Pe,K.lie))},nn=e=>{if(!Be)return;let t=++Ge;n(a(Be),()=>{t===Ge&&We===e&&W===`ask`&&(Ke=!0)})},Z=()=>{if(W!==`aim`)return;i(),bt.clear(),ye.disarm(),r(),U.hideBanner(),U.hidePill(),U.showControls(!1),U.showMap(!1),U.hideBigMap(),Fe=!1;let t=++We;Be=Se.take(),Ve=e(o.topic,Be,4),Ue=-1,Je=o.timerSecondsFor(Be),qe=0,Ke=!1,Ye=Math.ceil(Je),W=`ask`,U.setOptions(Ve),U.setQuestion(Be.prompt),ft(Be),U.setClock(1,!1),U.showQuestion(!0),wt=U.measureBands(),Vt(`ask`,.35),nn(t)},rn=e=>{if(W!==`ask`)return;Ke&&(qe+=e);let n=Je-(Ke?qe:0),r=Math.max(Math.ceil(n),0);r<Ye&&r>0&&r<=3&&t.tick(),Ye=r,U.setClock(Math.max(n,0)/Je,r<=3&&Ke),Ke&&n<=0&&on()},an=e=>{if(W!==`ask`||!Be||Ve[e]===void 0)return;try{i(),r()}catch{}Ge++;let t=Ke?qe:0;Ue=e,U.lock(),sn(Ve[e]===Be.answer,t,!1)},on=()=>{W===`ask`&&Be&&(Ue=-1,U.lock(),sn(!1,Je,!0))},sn=(e,t,n)=>{let r=Be;if(!r)return;let i=We;e?(Se.recordHit(r),nt(),o.recordAnswer(r,!0)):(Se.recordMiss(r),nt(),o.recordAnswer(r,!1)),U.mark(Ue,Ve.indexOf(r.answer),e),U.setClock(null,!1),ne.setVisible(!1);let a=Xe;Xe=null;let s=a?a!==`miss`:e,c=a===`perfect`?0:a===`close`?Je*.6:t,l=ha(),u=l===null?Math.random()*2*Math.PI:Gr(q)||s?l:Zr(l/(Math.PI/180));Ze=Qr(q,s,c,Je,u,Math.random()),J=li(G,q,Ze),$e=Hi(K,G,J),et=!e,J.kind===`rest`&&J.tree!==void 0?(ot=Ze,st=null,at=Ti(q,ot)*J.tree):(ot={...Ze,land:J.land},st=Fi(q,ot,J,G.pin,De),at=st.seconds),xt(Of,()=>{We===i&&U.showQuestion(!1,!e)}),e||(U.showBanner(n?`Time's up!`:`Not quite!`,r.visual?``:r.statement,`miss`,`ask`),ye.reveal(U.buttons,Ve,r,{avoid:U.avoid,problem:r.prompt,chosen:Ve[Ue],delay:Dc(q.club).seconds+at})),cn()},cn=()=>{W=`swing`,ut=!1,tt=yt,rt=0,It={x:q.from.x,y:hi,z:q.from.z},P.clearTrail(),P.setAddress(!1),qt(`swing`),Vt(`follow`,.6)},ln=()=>{W===`swing`&&!ut&&yt-tt>=Dc(q.club).impact&&(ut=!0,t.kick(),Gr(q)||P.puff(K.lie===`sand`?`sand`:`grass`,{...q.from,y:De(q.from.x,q.from.z)},yt,q.dir),W=`flight`,rt=0,It={x:q.from.x,y:hi,z:q.from.z})},un=e=>{if(W!==`flight`||!Ze||!ot)return;rt+=e;let t=rt/at,n=J?.kind===`rest`?J.tree??1:1,r=Ei(q,ot,Math.min(t,1)*n),i=st?st.at(rt):{...r,y:r.y+De(r.x,r.z)};It=i;let a=De(i.x,i.z);P.place(i,`rough`,a),!Gr(q)&&ot.quality!==`duff`&&P.trail(yt,i,a),t>=1&&dn()},dn=()=>{(W===`flight`||W===`swing`)&&Ze&&J&&(W=`landed`,P.endTrail(yt),K=$e,Yt(),J.kind===`holed`?(Oe({x:G.pin.x,y:hi,z:G.pin.z},`green`),ct=yt):J.kind===`water`?(P.setVisible(!1),mt=yt,P.splash(J.splash,0)):Oe({x:J.at.x,y:hi,z:J.at.z},J.surface),J.kind===`water`||Ze.quality===`miss`||Ze.quality===`duff`?t.miss():J.kind===`holed`?t.cheer():t.tick(),It={x:K.at.x,y:0,z:K.at.z},Vt(`land`,1),Kt(),et||fn())},fn=()=>{if(!Ze||!J)return;let e=We;W=`result`,gt=yt;let t=ea(ta(J,Ze.quality,Gr(q))),n=J.kind===`holed`,r=Ze.quality===`miss`||Ze.quality===`duff`;U.showBanner(t,``,n?`good`:r?`miss`:`info`,`aim`),U.showPill(`${na(J)} · Shot ${K.strokes}`),xt(Df,()=>U.hidePill()),r||J.kind===`water`?qt(`groan`):n||J.kind===`rest`&&J.surface===`green`&&!Gr(q)?qt(`cheer`):qt(`follow`),Sc(J,G.pin)&&ge?.gallery?.clap(yt),L.react(ra(J,Wi(K)?Ki(Ui(K),G.par,K.holed):null,{quality:Ze.quality,putt:Gr(q)})),_t=!1,vt=!1,$t([t],e,()=>_t=!0),xt(wf,()=>vt=!0)},pn=()=>{(W===`swing`||W===`flight`)&&dn(),U.hideBanner(),U.showQuestion(!1),et=!1,fn()},mn=()=>{W===`result`&&(bt.clear(),Ge++,r(),U.hideBanner(),U.hidePill(),U.showQuestion(!1),Wi(K)?hn():(P.setVisible(!0),P.splash(null),mt=-1,tn(.7)))},hn=()=>{let e=++We;W=`holecall`,gt=yt;let n=Ui(K),r=oa(Ki(n,G.par,K.holed));ke=[...ke,n],Kt();let i=n-G.par;U.showBanner(r.replace(/[.!]$/,``),``,i<=-1&&K.holed?`good`:`info`,`aim`),K.holed&&i<=-1&&t.cheer(),qt(i<=-1&&K.holed?`cheer`:i>=2||!K.holed?`groan`:`follow`),_t=!1,vt=!1,$t([r],e,()=>_t=!0),xt(Tf,()=>vt=!0)},gn=()=>{W===`holecall`&&(bt.clear(),Ge++,r(),U.hideBanner(),Te>=Ar.length-1?yn():en(Te+1))},_n=()=>{W===`result`&&!et&&_t&&vt?mn():W===`holecall`&&_t&&vt&&gn()},vn=()=>({rel:Gi(ke,Gt),strokes:ke.reduce((e,t)=>e+t,0)}),yn=()=>{nt(),W=`over`;let e=++We;ye.disarm(),U.hideBanner(),U.showControls(!1),U.showMap(!1),U.showQuestion(!1),ne.setVisible(!1);let{rel:r,strokes:i}=vn();U.setCardBig(!0,`${i} strokes · ${qi(r)}`),U.showBanner(`Round over`,``,`info`,`aim`);let a=Xi(r)>we;n(a?da:ua),t.cheer(),xt(Ef,()=>{We===e&&W===`over`&&bn()})},bn=()=>{if(nt(),W!==`over`)return;W=`done`,bt.clear(),r(),U.hideBanner(),U.showCard(!1);let{rel:e,strokes:t}=vn(),n=Xi(e),i=d(Se.correct,Se.answered);o.recordStars(i),o.recordScore(n);let a=Math.max(o.highScore(),n);He({topicId:o.topic.id,steps:o.takeStepReport(),correct:Se.correct,total:Se.answered,stars:i,newBest:!1,missed:Se.missed(),playerName:o.player?.name,score:n,scoreText:qi(e),outcome:Qi(t,e),highScore:a,highScoreText:`Best: ${qi(Zi(a))}`,newHighScore:n>we,playAgainLabel:`Play again ⛳`,onPlayAgain:()=>xn(!1)})},xn=e=>{bt.clear(),We++,Ge++,ye.disarm(),r(),Se=Mt(()=>o.chooseFacts()),we=o.highScore(),Be=void 0,Ve=[],Ze=null,J=null,et=!1,mt=-1,Xe=ga(),Fe=!1,U.hideBigMap();let t=e||ze?fa():{hole:0,scores:[]};if(ke=t.scores,U.setCardBig(!1),U.showCard(!0),U.hideBanner(),U.hidePill(),U.showQuestion(!1),U.showControls(!1),va()){let e=[1,0,-1,2,0,1,0,-1,1];ke=Ar.map((t,n)=>t.par+e[n]),Te=Ar.length-1,G=Ar[Te],W=`over`,bn()}else e?(W=`preview`,Te=t.hole,G=Ar[Te],q=Jt(),Vt(`intro`,0),Ce({topic:o.topic,facts:Se.peek(10),onDone:()=>V(()=>en(t.hole))})):(ze=!1,en(0))},Sn=()=>{W===`aim`&&!U.bigMapOpen&&Z()},Cn=e=>{if(W!==`aim`)return;let t=q.dir-Math.PI/180*e;Qt({x:q.from.x+q.carry*Math.sin(t),z:q.from.z+q.carry*Math.cos(t)})},wn=e=>{if(W!==`aim`)return;let t=Gr(q)?1:5,n=Math.max(q.carry+e*t,0);Qt({x:q.from.x+n*Math.sin(q.dir),z:q.from.z+n*Math.cos(q.dir)})},Tn=()=>{let e=f.renderer.domElement.getBoundingClientRect(),t=new Ee((Ie.x-e.left)/Math.max(e.width,1)*2-1,-((Ie.y-e.top)/Math.max(e.height,1)*2-1));Le.setFromCamera(t,h);let{origin:n,direction:r}=Le.ray;if(r.y<-1e-4){let e=-n.y/r.y;Qt({x:n.x+r.x*e,z:n.z+r.z*e})}else{let e=Math.hypot(r.x,r.z)||1,t=Br(K.lie);Qt({x:q.from.x+r.x/e*t,z:q.from.z+r.z/e*t})}},En=()=>{Fe&&(Fe=!1,W===`aim`&&Vt(`aim`,.35))},Dn=()=>{ye.armed||(W===`intro`&&yt-X>=Af&&wa()===null?(Ge++,r(),tn(.6)):(W===`flight`||W===`swing`)&&yt-tt>=jf?dn():W===`result`&&yt-gt>=kf?mn():W===`holecall`&&yt-gt>=kf&&gn())},On=e=>{ye.armed?ye.tap(e)&&pn():W===`ask`?an(e):Dn()},kn=[],An=(e,t)=>{e.addEventListener(`pointerup`,i),kn.push(it(e,t))};kn.push(Ae(U.buttons,On)),An(U.swing,Sn),An(U.nudgeLeft,()=>Cn(-1)),An(U.nudgeRight,()=>Cn(1)),An(U.farther,()=>wn(1)),An(U.shorter,()=>wn(-1)),U.onMapPlace(Qt),U.onMapTap(()=>{W!==`aim`||U.bigMapOpen||U.showBigMap(G,K.at,q,Pe,K.lie)}),U.hear.addEventListener(`click`,()=>{if(i(),!Be||W!==`ask`)return;let e=We,t=++Ge;n(a(Be),()=>{t===Ge&&We===e&&W===`ask`&&(Ke=!0)})});let jn=Ne(f.renderer.domElement,{onDragStart:e=>{i(),W===`aim`&&(Fe=!0,Ie={x:e.x,y:e.y},Tn(),Vt(`place`,.25))},onDrag:e=>{Ie={x:e.x,y:e.y}},onDragEnd:En,onTap:Dn});window.addEventListener(`pointercancel`,En);let Mn=e=>{if(xe.isPaused)return;let t=Number(e.key)-1;(W===`ask`||ye.armed)&&t>=0&&t<U.buttons.length?On(t):W===`intro`&&(e.key===`Enter`||e.key===` `)?(e.preventDefault(),Dn()):W===`aim`&&(e.key===`Enter`||e.key===` `?(e.preventDefault(),Sn()):e.key===`ArrowLeft`||e.key===`a`||e.key===`A`?(e.preventDefault(),Cn(-1)):e.key===`ArrowRight`||e.key===`d`||e.key===`D`?(e.preventDefault(),Cn(1)):e.key===`ArrowUp`||e.key===`w`||e.key===`W`?(e.preventDefault(),wn(1)):(e.key===`ArrowDown`||e.key===`s`||e.key===`S`)&&(e.preventDefault(),wn(-1)))};window.addEventListener(`keydown`,Mn);let Nn=new Y,Pn=new Y,Fn=()=>{Pn.set(Et.look.x,0,Et.look.z),T?(T.update(),T.updateFrustums()):(C.position.copy(Pn).addScaledVector(S,100),C.target.position.copy(Pn));let e=W===`swing`||Ca()!==null;Nn.set(I.root.position.x,I.root.position.y+1.2,I.root.position.z),R?.setDof(e,h.position.distanceTo(Nn))},In=e=>{if(me||W!==`aim`||(pe.push(e*1e3),pe.length<Vf))return;me=!0;let t=[...pe].sort((e,t)=>e-t)[Vf/2],n=ss(t,v);n!==v&&(v=n,y=is(v),Lf(v),oe(),N=M())};f.onUpdate(e=>{if(Ut(),yt+=e,ye.update(e),bt.update(e),Nt<1&&(Nt=Math.min(1,Nt+e/Math.max(Pt,.001))),Fe&&W===`aim`&&Tn(),rn(e),ln(),un(e),_n(),mt>=0&&J?.kind===`water`&&P.splash(J.splash,yt-mt),P.trail(yt),ct>=0){let e=(yt-ct)/Mf;P.sink(G.pin,e),e>=1&&(P.setVisible(!1),ct=-1)}P.update(yt);let t=ya();t===null?I.play(dt,yt-pt,e):I.play(`swing`,t,e),L.update(e),ge?.update(yt),Da()&&ge?.gallery?.clap(yt-.6),ge?.gallery?.update(yt,h.position),re.update(yt),A?.update(yt,h.position,G.length/2),Wt(),ae=e,Fn(),In(e)});let Ln=async()=>{await fe;let e=Ar.length+2,t=t=>de.progress(.5+.5*t/e);t(.5),await ud();for(let e=0;e<Ar.length;e++)_e(e),t(e+1),await ud();Yt(),Wt(),Fn();let n=[];p.traverse(e=>{e.visible||=(n.push(e),!0)});let r=new Set;p.traverse(e=>{let t=e.material;for(let e of[t??[]].flat()){let t=e.map;t&&r.add(t)}});try{await f.renderer.compileAsync(p,h)}catch{}t(Ar.length+1),await ud(),r.forEach(e=>f.renderer.initTexture(e)),R?R.render(ae):f.renderer.render(p,h),n.forEach(e=>e.visible=!1),de.progress(1),await ud(),de.done()},Rn=!1;Ut(!0),Ln().then(()=>{Rn||(f.start(),xn(!0))}),window.addEventListener(`pagehide`,()=>{Rn=!0,r(),window.removeEventListener(`keydown`,Mn),window.removeEventListener(`pointercancel`,En),jn(),ye.dispose(),kn.forEach(e=>e()),xe.dispose(),be.dispose(),U.dispose(),he.forEach(e=>e.dispose()),ge&&![...he.values()].includes(ge)&&ge.dispose(),re.dispose(),A?.dispose(),se.disconnect(),window.removeEventListener(`orientationchange`,z),R?.dispose(),T?.remove(),D(),T?.dispose(),k?.dispose(),O?.dispose(),_s(ee),f.dispose()})}var Uf=f(xf);Uf?Hf(Uf):location.replace(o());