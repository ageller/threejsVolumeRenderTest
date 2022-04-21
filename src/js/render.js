import * as THREE from 'three';
import { TrackballControls } from '../lib/TrackballControls.js';
import { VolumeRenderShader1 } from '../shaders/VolumeShader.js';
import { VolumeRenderShader2 } from '../shaders/VolumeShader2.js';


// all "global" variables are contained within params object
var params;
function defineParams(){
	params = new function() {

		this.useShader = 2;

		this.container = null;
		this.renderer = null;
		this.scene = null;

		// for camera      
		this.zmax = 1000;
		this.zmin = 1e-3;
		this.fov = 60;

		// for gui
		this.gui = null;

		this.cmtextures = null
		this.volumeMesh = null;

		if (this.useShader == 1){
			// better for 128 FIRE gridding
			this.volconfig = {clim1: 0.3, clim2: 0.8, renderstyle: 'mip', isothreshold: 0.5, colormap: 'viridis' };
			// better for 256 FIRE gridding
			// this.volconfig = {clim1: 0.2, clim2: 0.6, renderstyle: 'mip', isothreshold: 0.5, colormap: 'viridis' };
		} else {
			this.volconfig = {threshold: 0.6, range: 0.1, opacity: 0.25, steps: 100, base: {r:0, g:0, b:0} };
		}


	};


}

// this initializes everything needed for the scene
function init(volume){

	var screenWidth = window.innerWidth;
	var screenHeight = window.innerHeight;
	var aspect = screenWidth / screenHeight;

	// renderer
	params.renderer = new THREE.WebGLRenderer( {
		antialias:true,
	} );
	params.renderer.setSize(screenWidth, screenHeight);

	params.container = document.getElementById('WebGLContainer');
	params.container.appendChild( params.renderer.domElement );

	// scene
	params.scene = new THREE.Scene();     

	if (params.useShader == 1){
		// Create camera (The volume renderer in shader 1 does not work very well with perspective yet)
		const h = 256; // frustum height (not sure what to use here)
		//params.camera = new THREE.OrthographicCamera( -h*aspect/2, h*aspect/2, h/2, -h/2, params.zmin, params.zmax);
		params.camera = new THREE.OrthographicCamera( -h*aspect/2, h*aspect/2, h/2., -h/2, params.zmin, params.zmax);
		params.camera.position.set( volume.size[0]/2., volume.size[1]/2., volume.size[2] );
	} else {
		params.camera = new THREE.PerspectiveCamera( params.fov, aspect, params.zmin, params.zmax );
		params.camera.position.set( 1.5, 1.5, 1.5 );
	}
	params.camera.up.set( 0, 0, 1 ); // In our data, z is up


	// controls
	params.controls = new TrackballControls( params.camera, params.renderer.domElement );

	window.addEventListener( 'resize', onWindowResize );
}

// update the camera on resize 
function onWindowResize() {

	params.renderer.setSize( window.innerWidth, window.innerHeight );

	const aspect = window.innerWidth/window.innerHeight;

	const frustumHeight = params.camera.top - params.camera.bottom;

	params.camera.left = -frustumHeight*aspect/2;
	params.camera.right = frustumHeight*aspect/2;

	params.camera.updateProjectionMatrix();

	render();

}

////////////////
// For VolumeRenderShader1
// this creates the user interface (gui)
function createUI1(){

	params.gui = new dat.GUI();
	params.gui.add( params.volconfig, 'clim1', 0, 1, 0.01 ).onChange( updateUniforms1 );
	params.gui.add( params.volconfig, 'clim2', 0, 1, 0.01 ).onChange( updateUniforms1 );
	params.gui.add( params.volconfig, 'colormap', { gray: 'gray', viridis: 'viridis' } ).onChange( updateUniforms1 );
	params.gui.add( params.volconfig, 'renderstyle', { mip: 'mip', iso: 'iso' } ).onChange( updateUniforms1 );
	params.gui.add( params.volconfig, 'isothreshold', 0, 1, 0.01).onChange( updateUniforms1 );

}
function updateUniforms1() {

	params.volumeMesh.material.uniforms[ 'u_clim' ].value.set( params.volconfig.clim1, params.volconfig.clim2 );
	params.volumeMesh.material.uniforms[ 'u_renderstyle' ].value = params.volconfig.renderstyle == 'mip' ? 0 : 1; // 0: MIP, 1: ISO
	params.volumeMesh.material.uniforms[ 'u_renderthreshold' ].value = params.volconfig.isothreshold; // For ISO renderstyle
	params.volumeMesh.material.uniforms[ 'u_cmdata' ].value = params.cmtextures[ params.volconfig.colormap ];

	render();

}


// this will draw the scene using the first type of shader
function drawScene1(volume){

	console.log(volume)

	const texture = new THREE.Data3DTexture(volume.data, volume.size[0], volume.size[1], volume.size[2]);
	texture.format = THREE.RedFormat;
	texture.type = THREE.FloatType;
	texture.minFilter = texture.magFilter = THREE.LinearFilter;
	texture.unpackAlignment = 1;
	texture.needsUpdate = true;

	// Colormap textures
	params.cmtextures = {
		viridis: new THREE.TextureLoader().load( 'src/textures/cm_viridis.png', render ),
		gray: new THREE.TextureLoader().load( 'src/textures/cm_gray.png', render )
	};

	// Material
	const shader = VolumeRenderShader1;

	const uniforms = THREE.UniformsUtils.clone( shader.uniforms );

	uniforms[ 'u_data' ].value = texture;
	uniforms[ 'u_size' ].value.set(volume.size[0], volume.size[1], volume.size[2]);
	uniforms[ 'u_clim' ].value.set(params.volconfig.clim1, params.volconfig.clim2);
	uniforms[ 'u_renderstyle' ].value = params.volconfig.renderstyle == 'mip' ? 0 : 1; // 0: MIP, 1: ISO
	uniforms[ 'u_renderthreshold' ].value = params.volconfig.isothreshold; // For ISO renderstyle
	uniforms[ 'u_cmdata' ].value = params.cmtextures[params.volconfig.colormap];

	const material = new THREE.ShaderMaterial( {
		uniforms: uniforms,
		vertexShader: shader.vertexShader,
		fragmentShader: shader.fragmentShader,
			side: THREE.BackSide // The volume shader uses the backface as its "reference point"
	} );

	// THREE.Mesh
	const geometry = new THREE.BoxGeometry(volume.size[0], volume.size[1], volume.size[2] );
	geometry.translate(volume.size[0]/2 - 0.5, volume.size[1]/2 - 0.5, volume.size[2]/2 - 0.5);

	params.volumeMesh = new THREE.Mesh(geometry, material);
	params.volumeMesh.position.set(-(volume.size[0]/2 - 0.5), -(volume.size[1]/2 - 0.5), -(volume.size[2]/2 - 0.5));
	params.scene.add( params.volumeMesh );

}

////////////////
// For VolumeRenderShader2
// this creates the user interface (gui)
function createUI2(){

	params.gui = new dat.GUI();
	params.gui.add( params.volconfig, 'threshold', 0, 1, 0.01 ).onChange( updateUniforms2 );
	params.gui.add( params.volconfig, 'opacity', 0, 1, 0.01 ).onChange( updateUniforms2 );
	params.gui.add( params.volconfig, 'range', 0, 1, 0.01 ).onChange( updateUniforms2 );
	params.gui.add( params.volconfig, 'steps', 0, 200, 1 ).onChange( updateUniforms2 );
	params.gui.addColor( params.volconfig, 'base').onChange( updateUniforms2 );

}
function updateUniforms2() {

	params.volumeMesh.material.uniforms[ 'u_threshold' ].value = params.volconfig.threshold;
	params.volumeMesh.material.uniforms[ 'u_range' ].value = params.volconfig.range;
	params.volumeMesh.material.uniforms[ 'u_opacity' ].value = params.volconfig.opacity;
	params.volumeMesh.material.uniforms[ 'u_steps' ].value = params.volconfig.steps; 
	params.volumeMesh.material.uniforms[ 'u_base' ].value.set(params.volconfig.base.r/255., params.volconfig.base.g/255., params.volconfig.base.b/255.); 

	render();

}


// this will draw the scene using the first type of shader
function drawScene2(volume){

	console.log(volume)

	const texture = new THREE.Data3DTexture(volume.data, volume.size[0], volume.size[1], volume.size[2]);
	texture.format = THREE.RedFormat;
	texture.type = THREE.FloatType;
	texture.minFilter = texture.magFilter = THREE.LinearFilter;
	texture.unpackAlignment = 1;
	texture.needsUpdate = true;

	// Colormap textures
	params.cmtextures = {
		viridis: new THREE.TextureLoader().load( 'src/textures/cm_viridis.png', render ),
		gray: new THREE.TextureLoader().load( 'src/textures/cm_gray.png', render )
	};

	// Material
	const shader = VolumeRenderShader2;

	const uniforms = THREE.UniformsUtils.clone( shader.uniforms );

	uniforms[ 'u_data' ].value = texture;
	uniforms[ 'u_threshold' ].value = params.volconfig.threshold;
	uniforms[ 'u_range' ].value = params.volconfig.range;
	uniforms[ 'u_opacity' ].value = params.volconfig.opacity;
	uniforms[ 'u_steps' ].value = params.volconfig.steps; 
	uniforms[ 'u_base' ].value.set(params.volconfig.base.r/255., params.volconfig.base.g/255., params.volconfig.base.b/255.); 
	uniforms[ 'u_cameraPos' ].value.copy(params.camera.position); 

	const material = new THREE.ShaderMaterial( {
		uniforms: uniforms,
		vertexShader: shader.vertexShader,
		fragmentShader: shader.fragmentShader,
			side: THREE.BackSide // The volume shader uses the backface as its "reference point"
	} );

	// THREE.Mesh
	const geometry = new THREE.BoxGeometry(volume.size[0], volume.size[1], volume.size[2] );
	geometry.translate(volume.size[0]/2 - 0.5, volume.size[1]/2 - 0.5, volume.size[2]/2 - 0.5);

	params.volumeMesh = new THREE.Mesh(geometry, material);
	//params.volumeMesh.position.set(-(volume.size[0]/2 - 0.5), -(volume.size[1]/2 - 0.5), -(volume.size[2]/2 - 0.5));
	params.scene.add( params.volumeMesh );

}
// this is the animation loop
function animate(time) {
	requestAnimationFrame( animate );
	params.controls.update();

	if (params.useShader == 2){
		params.volumeMesh.material.uniforms.u_cameraPos.value.copy( params.camera.position );
		params.volumeMesh.material.uniforms.u_frame.value ++;
	}
	render();
}

function render() {
	params.renderer.render( params.scene, params.camera );

}

// this is called to start everything
function WebGLStart(volume){

// initialize the scence
	init(volume);

	if (params.useShader == 1){
	// create the UI
		createUI1();

	// draw everything
		drawScene1(volume);
	} else {
	// create the UI
		createUI2();

	// draw everything
		drawScene2(volume);
	}

// start the animation loop
	animate();
}

Promise.all([
	//FIRE data interpolated to grid
	d3.csv('src/data/FIREdata3D_128.csv'),
	d3.csv('src/data/FIREdata3Dsizes_128.csv'),
	//fake data the I created in python
	// d3.csv('src/data/data3D.csv'),
	// d3.csv('src/data/data3Dsizes.csv'),
]).then(function(d) {
	defineParams();

	const volume = {};

	//the volume shader requires a Float34Array for the data
	volume.data = new Float32Array(d[0].length);
	d[0].forEach(function(dd,i){
		volume.data[i] = +dd.data;
	})
	volume.size = [
		parseInt(d[1][0].xLength),
		parseInt(d[1][0].yLength),
		parseInt(d[1][0].zLength)
	]


	WebGLStart(volume);
})
.catch(function(error){
	console.log('ERROR:', error)
})



