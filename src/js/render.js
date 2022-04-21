import * as THREE from 'three';
import { TrackballControls } from '../lib/TrackballControls.js';
import { VolumeRenderShader1 } from '../shaders/VolumeShader.js';
import { VolumeRenderShader2 } from '../shaders/VolumeShader2.js';


// all "global" variables are contained within params object
var params;
function defineParams(){
	params = new function() {

		this.useShader = 2;

		this.volume = {};

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

		this.renderstyle = 'volumetric'; //'mip', 'iso'

		this.volconfig = [];

		// shader 1
		// better for 128 FIRE gridding
		this.volconfig.push({clim1: 0.3, clim2: 0.8, isothreshold: 0.5, colormap: 'gray' });
		// better for 256 FIRE gridding
		// this.volconfig = {clim1: 0.2, clim2: 0.6, renderstyle: 'mip', isothreshold: 0.5, colormap: 'viridis' };
		
		// shader 2
		this.volconfig.push({threshold: 0.6, range: 0.1, opacity: 1.0, intensity:1.0, steps: 150, clim1: 0., clim2: 1., colormap: 'gray' , base: {r:0, g:0, b:0} });
		


	};


}

// this initializes everything needed for the scene
function init(){

	var screenWidth = window.innerWidth;
	var screenHeight = window.innerHeight;
	var aspect = screenWidth / screenHeight;

	// renderer
	params.renderer = new THREE.WebGLRenderer( {
		antialias:true,
	} );
	params.renderer.setSize(window.innerWidth, window.innerHeight);

	params.container = document.getElementById('WebGLContainer');
	params.container.appendChild( params.renderer.domElement );

	// scene
	params.scene = new THREE.Scene();     

	// Colormap textures
	params.cmtextures = {
		viridis: new THREE.TextureLoader().load( 'src/textures/cm_viridis.png', render ),
		gray: new THREE.TextureLoader().load( 'src/textures/cm_gray.png', render )
	};

	window.addEventListener( 'resize', onWindowResize );

}

function reinit(){

	// clear the scene
	while (params.scene.children.length){
    	params.scene.remove(params.scene.children[0]);
	}

	var aspect = window.innerWidth/window.innerHeight;

	if (params.useShader == 1){
		// Create camera (The volume renderer in shader 1 does not work very well with perspective yet)
		const h = 256; // frustum height (not sure what to use here)
		//params.camera = new THREE.OrthographicCamera( -h*aspect/2, h*aspect/2, h/2, -h/2, params.zmin, params.zmax);
		params.camera = new THREE.OrthographicCamera( -h*aspect/2, h*aspect/2, h/2., -h/2, params.zmin, params.zmax);
		params.camera.position.set( params.volume.size[0]/2., params.volume.size[1]/2., params.volume.size[2] );
	} else {
		params.camera = new THREE.PerspectiveCamera( params.fov, aspect, params.zmin, params.zmax );
		params.camera.position.set( 1.5, 1.5, 1.5 );
	}
	params.camera.up.set( 0, 0, 1 ); // In our data, z is up


	// controls
	if (params.controls) params.controls.dispose();
	params.controls = new TrackballControls( params.camera, params.renderer.domElement );

}

// update the camera on resize 
function onWindowResize() {

	params.renderer.setSize( window.innerWidth, window.innerHeight );

	const aspect = window.innerWidth/window.innerHeight;

	if (params.useShader == 1){
		const frustumHeight = params.camera.top - params.camera.bottom;

		params.camera.left = -frustumHeight*aspect/2;
		params.camera.right = frustumHeight*aspect/2;
	} else {
		params.camera.aspect = aspect;
	}

	params.camera.updateProjectionMatrix();

	render();

}

function createUIStatic(){
	var gui = new dat.GUI({ autoPlace: false });

	var container = d3.select('body').append('div')
		.attr('id','guiContainer')
		.style('position', 'absolute')
		.style('top','2px')
		.style('left','2px');
	container.node().appendChild(gui.domElement);


	gui.add(params,'renderstyle',{volumetric: 'volumetric', mip: 'mip', iso: 'iso' } ).onChange( updateRenderStyle );
}

function updateRenderStyle(){
	var currentShader = params.useShader;
	console.log(params.renderstyle)
	if (params.renderstyle == 'mip' || params.renderstyle == 'iso'){
		params.useShader = 1;
		if (currentShader == params.useShader) params.volumeMesh.material.uniforms['u_renderstyle'].value = params.volconfig[0].renderstyle == 'mip' ? 0 : 1; // 0: MIP, 1: ISO
	} else {
		params.useShader = 2;
	}

	WebGLStart();
}
////////////////
// For VolumeRenderShader1
// this creates the user interface (gui)
function createUI1(){

	if (params.gui) params.gui.destroy();

	params.gui = new dat.GUI();
	params.gui.add( params.volconfig[0], 'clim1', 0, 1, 0.01 ).onChange( updateUniforms1 );
	params.gui.add( params.volconfig[0], 'clim2', 0, 1, 0.01 ).onChange( updateUniforms1 );
	params.gui.add( params.volconfig[0], 'colormap', { gray: 'gray', viridis: 'viridis' } ).onChange( updateUniforms1 );
	if (params.renderstyle == 'iso') params.gui.add( params.volconfig[0], 'isothreshold', 0, 1, 0.01).onChange( updateUniforms1 );

}
function updateUniforms1() {

	params.volumeMesh.material.uniforms[ 'u_clim' ].value.set( params.volconfig[0].clim1, params.volconfig[0].clim2 );
	params.volumeMesh.material.uniforms[ 'u_renderthreshold' ].value = params.volconfig[0].isothreshold; // For ISO renderstyle
	params.volumeMesh.material.uniforms[ 'u_cmdata' ].value = params.cmtextures[ params.volconfig[0].colormap ];

	render();

}


// this will draw the scene using the first type of shader
function drawScene1(){

	console.log(params.volume)

	const texture = new THREE.Data3DTexture(params.volume.data, params.volume.size[0], params.volume.size[1], params.volume.size[2]);
	texture.format = THREE.RedFormat;
	texture.type = THREE.FloatType;
	texture.minFilter = texture.magFilter = THREE.LinearFilter;
	texture.unpackAlignment = 1;
	texture.needsUpdate = true;

	// Material
	const shader = VolumeRenderShader1;

	const uniforms = THREE.UniformsUtils.clone( shader.uniforms );

	uniforms[ 'u_data' ].value = texture;
	uniforms[ 'u_size' ].value.set(params.volume.size[0], params.volume.size[1], params.volume.size[2]);
	uniforms[ 'u_clim' ].value.set(params.volconfig[0].clim1, params.volconfig[0].clim2);
	uniforms[ 'u_renderstyle' ].value = params.renderstyle == 'mip' ? 0 : 1; // 0: MIP, 1: ISO
	uniforms[ 'u_renderthreshold' ].value = params.volconfig[0].isothreshold; // For ISO renderstyle
	uniforms[ 'u_cmdata' ].value = params.cmtextures[params.volconfig[0].colormap];

	const material = new THREE.ShaderMaterial( {
		uniforms: uniforms,
		vertexShader: shader.vertexShader,
		fragmentShader: shader.fragmentShader,
			side: THREE.BackSide // The volume shader uses the backface as its "reference point"
	} );

	// THREE.Mesh
	const geometry = new THREE.BoxGeometry(params.volume.size[0], params.volume.size[1], params.volume.size[2] );
	geometry.translate(params.volume.size[0]/2 - 0.5, params.volume.size[1]/2 - 0.5, params.volume.size[2]/2 - 0.5);

	params.volumeMesh = new THREE.Mesh(geometry, material);
	params.volumeMesh.position.set(-(params.volume.size[0]/2 - 0.5), -(params.volume.size[1]/2 - 0.5), -(params.volume.size[2]/2 - 0.5));
	params.scene.add( params.volumeMesh );

}

////////////////
// For VolumeRenderShader2
// this creates the user interface (gui)
function createUI2(){

	if (params.gui) params.gui.destroy();

	params.gui = new dat.GUI();
	params.gui.add( params.volconfig[1], 'threshold', 0, 1, 0.01 ).onChange( updateUniforms2 );
	params.gui.add( params.volconfig[1], 'opacity', 0, 1, 0.01 ).onChange( updateUniforms2 );
	params.gui.add( params.volconfig[1], 'intensity', 0, 3, 0.1 ).onChange( updateUniforms2 );
	params.gui.add( params.volconfig[1], 'range', 0, 1, 0.01 ).onChange( updateUniforms2 );
	params.gui.add( params.volconfig[1], 'steps', 0, 300, 1 ).onChange( updateUniforms2 );
	params.gui.add( params.volconfig[1], 'clim1', 0, 1, 0.01 ).onChange( updateUniforms2 );
	params.gui.add( params.volconfig[1], 'clim2', 0, 1, 0.01 ).onChange( updateUniforms2 );
	params.gui.add( params.volconfig[1], 'colormap', { gray: 'gray', viridis: 'viridis' } ).onChange( updateUniforms2 );

}
function updateUniforms2() {

	params.volumeMesh.material.uniforms[ 'u_threshold' ].value = params.volconfig[1].threshold;
	params.volumeMesh.material.uniforms[ 'u_range' ].value = params.volconfig[1].range;
	params.volumeMesh.material.uniforms[ 'u_opacity' ].value = params.volconfig[1].opacity;
	params.volumeMesh.material.uniforms[ 'u_intensity' ].value = params.volconfig[1].intensity;
	params.volumeMesh.material.uniforms[ 'u_steps' ].value = params.volconfig[1].steps; 
	params.volumeMesh.material.uniforms[ 'u_clim' ].value.set( params.volconfig[1].clim1, params.volconfig[1].clim2 );
	params.volumeMesh.material.uniforms[ 'u_cmdata' ].value = params.cmtextures[ params.volconfig[1].colormap ];
	
	render();

}


// this will draw the scene using the first type of shader
function drawScene2(){

	console.log(params.volume)

	const texture = new THREE.Data3DTexture(params.volume.data, params.volume.size[0], params.volume.size[1], params.volume.size[2]);
	texture.format = THREE.RedFormat;
	texture.type = THREE.FloatType;
	texture.minFilter = texture.magFilter = THREE.LinearFilter;
	texture.unpackAlignment = 1;
	texture.needsUpdate = true;

	// Material
	const shader = VolumeRenderShader2;

	const uniforms = THREE.UniformsUtils.clone( shader.uniforms );

	uniforms[ 'u_data' ].value = texture;
	uniforms[ 'u_threshold' ].value = params.volconfig[1].threshold;
	uniforms[ 'u_range' ].value = params.volconfig[1].range;
	uniforms[ 'u_opacity' ].value = params.volconfig[1].opacity;
	uniforms[ 'u_intensity' ].value = params.volconfig[1].intensity;
	uniforms[ 'u_steps' ].value = params.volconfig[1].steps; 
	uniforms[ 'u_base' ].value.set(params.volconfig[1].base.r/255., params.volconfig[1].base.g/255., params.volconfig[1].base.b/255.); 
	uniforms[ 'u_cameraPos' ].value.copy(params.camera.position); 
	uniforms[ 'u_clim' ].value.set(params.volconfig[1].clim1, params.volconfig[1].clim2);
	uniforms[ 'u_cmdata' ].value = params.cmtextures[params.volconfig[1].colormap];

	const material = new THREE.ShaderMaterial( {
		uniforms: uniforms,
		vertexShader: shader.vertexShader,
		fragmentShader: shader.fragmentShader,
			side: THREE.BackSide // The volume shader uses the backface as its "reference point"
	} );

	// THREE.Mesh
	const geometry = new THREE.BoxGeometry(params.volume.size[0], params.volume.size[1], params.volume.size[2] );
	geometry.translate(params.volume.size[0]/2 - 0.5, params.volume.size[1]/2 - 0.5, params.volume.size[2]/2 - 0.5);

	params.volumeMesh = new THREE.Mesh(geometry, material);
	//params.volumeMesh.position.set(-(params.volume.size[0]/2 - 0.5), -(params.volume.size[1]/2 - 0.5), -(params.volume.size[2]/2 - 0.5));
	params.scene.add( params.volumeMesh );

}

// this is the animation loop
function animate(time) {
	requestAnimationFrame( animate );
	params.controls.update();

	if (params.useShader == 2){
		params.volumeMesh.material.uniforms.u_cameraPos.value.copy( params.camera.position );
		//this will increment the randomizer, but causes some shimmering with low step number
		params.volumeMesh.material.uniforms.u_frame.value ++;
	}
	render();
}

function render() {
	params.renderer.render( params.scene, params.camera );

}

// this is called to start everything
function WebGLStart(){

// initialize the scence
	reinit();

	if (params.useShader == 1){
	// create the UI
		createUI1();

	// draw everything
		drawScene1();
	} else {
	// create the UI
		createUI2();

	// draw everything
		drawScene2();
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
	createUIStatic();
	init();

	//the volume shader requires a Float34Array for the data
	params.volume.data = new Float32Array(d[0].length);
	d[0].forEach(function(dd,i){
		params.volume.data[i] = +dd.data;
	})
	params.volume.size = [
		parseInt(d[1][0].xLength),
		parseInt(d[1][0].yLength),
		parseInt(d[1][0].zLength)
	]


	WebGLStart();
})
.catch(function(error){
	console.log('ERROR:', error)
})



