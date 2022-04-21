//https://github.com/mrdoob/three.js/blob/master/examples/webgl2_materials_texture3d_partialupdate.html
import {
	Vector2,
	Vector3,
	Color
} from 'three';


const VolumeRenderShader2 = {
	uniforms: {
		'u_cameraPos': {value: new Vector3(0., 0., 0.)},
		'u_threshold': { value: 0.25 },
		'u_range': { value: 0.1 },
		'u_opacity': { value: 0.25 },
		'u_steps': { value: 100 },
		'u_frame': { value: 0 },
		'u_base': { value: new Vector3(0., 0., 0.) },
		'u_data': { value: null },

	},


	vertexShader : /* glsl */`
		uniform vec3 u_cameraPos;

		varying vec3 vOrigin;
		varying vec3 vDirection;

		void main() {
			vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
			vOrigin = vec3( inverse( modelMatrix ) * vec4( u_cameraPos, 1.0 ) ).xyz;
			vDirection = position - vOrigin;
			gl_Position = projectionMatrix * mvPosition;
		}`,

	fragmentShader : /* glsl */`
		precision highp float;
		precision highp sampler3D;

		varying vec3 vOrigin;
		varying vec3 vDirection;

		uniform vec3 u_base;
		uniform sampler3D u_data;
		uniform float u_threshold;
		uniform float u_range;
		uniform float u_opacity;
		uniform float u_steps;
		uniform float u_frame;

		uint wang_hash(uint seed)
		{
				seed = (seed ^ 61u) ^ (seed >> 16u);
				seed *= 9u;
				seed = seed ^ (seed >> 4u);
				seed *= 0x27d4eb2du;
				seed = seed ^ (seed >> 15u);
				return seed;
		}
		float randomFloat(inout uint seed)
		{
				return float(wang_hash(seed)) / 4294967296.;
		}
		vec2 hitBox( vec3 orig, vec3 dir ) {
			const vec3 box_min = vec3( - 0.5 );
			const vec3 box_max = vec3( 0.5 );
			vec3 inv_dir = 1.0 / dir;
			vec3 tmin_tmp = ( box_min - orig ) * inv_dir;
			vec3 tmax_tmp = ( box_max - orig ) * inv_dir;
			vec3 tmin = min( tmin_tmp, tmax_tmp );
			vec3 tmax = max( tmin_tmp, tmax_tmp );
			float t0 = max( tmin.x, max( tmin.y, tmin.z ) );
			float t1 = min( tmax.x, min( tmax.y, tmax.z ) );
			return vec2( t0, t1 );
		}
		float sample1( vec3 p ) {
			return texture( u_data, p ).r;
		}
		float shading( vec3 coord ) {
			float step = 0.01;
			return sample1( coord + vec3( - step ) ) - sample1( coord + vec3( step ) );
		}
		void main(){
			vec3 rayDir = normalize( vDirection );
			vec2 bounds = hitBox( vOrigin, rayDir );
			if ( bounds.x > bounds.y ) discard;
			bounds.x = max( bounds.x, 0.0 );
			vec3 p = vOrigin + bounds.x * rayDir;
			vec3 inc = 1.0 / abs( rayDir );
			float delta = min( inc.x, min( inc.y, inc.z ) );
			delta /= u_steps;
			// Jitter
			// Nice little seed from
			// https://blog.demofox.org/2020/05/25/casual-shadertoy-path-tracing-1-basic-camera-diffuse-emissive/
			uint seed = uint( gl_FragCoord.x ) * uint( 1973 ) + uint( gl_FragCoord.y ) * uint( 9277 ) + uint( u_frame ) * uint( 26699 );
			vec3 size = vec3( textureSize( u_data, 0 ) );
			float randNum = randomFloat( seed ) * 2.0 - 1.0;
			p += rayDir * randNum * ( 1.0 / size );
			//
			vec4 ac = vec4( u_base, 0.0 );
			for ( float t = bounds.x; t < bounds.y; t += delta ) {
				float d = sample1( p + 0.5 );
				d = smoothstep( u_threshold - u_range, u_threshold + u_range, d ) * u_opacity;
				float col = shading( p + 0.5 ) * 3.0 + ( ( p.x + p.y ) * 0.25 ) + 0.2;
				ac.rgb += ( 1.0 - ac.a ) * d * col;
				ac.a += ( 1.0 - ac.a ) * d;
				if ( ac.a >= 0.95 ) break;
				p += rayDir * delta;
			}
			gl_FragColor = ac;
			if ( gl_FragColor.a == 0.0 ) discard;
		}`
};

export { VolumeRenderShader2 };
