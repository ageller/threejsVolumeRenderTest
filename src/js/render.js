import * as THREE from 'three';
import { TrackballControls } from '../lib/TrackballControls.js';
import { VolumeRenderShader1 } from '../shaders/VolumeShader.js';


// all "global" variables are contained within params object
var params;
function defineParams(){
	params = new function() {

		this.volume = {}; //will be populated wihth data

		this.container = null;
		this.renderer = null;
		this.scene = null;

		// for camera      
		this.zmax = 1000;
		this.zmin = 1;

		// for gui
		this.gui = null;

		// better for 128 FIRE gridding
		this.volconfig = {clim1: 0.3, clim2: 0.8, renderstyle: 'mip', isothreshold: 0.5, colormap: 'viridis' };
		// better for 256 FIRE gridding
		//this.volconfig = {clim1: 0.2, clim2: 0.6, renderstyle: 'mip', isothreshold: 0.5, colormap: 'viridis' };
		this.cmtextures = null
		this.material = null;
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
	params.renderer.setSize(screenWidth, screenHeight);

	params.container = document.getElementById('WebGLContainer');
	params.container.appendChild( params.renderer.domElement );

	// scene
	params.scene = new THREE.Scene();     

	// Create camera (The volume renderer does not work very well with perspective yet)
	const h = 256; // frustum height (not sure what to use here)
	//params.camera = new THREE.OrthographicCamera( -h*aspect/2, h*aspect/2, h/2, -h/2, params.zmin, params.zmax);
	params.camera = new THREE.OrthographicCamera( -h*aspect/2, h*aspect/2, h/2., -h/2, params.zmin, params.zmax);
	params.camera.position.set( params.volume.xLength/2., params.volume.yLength/2., params.volume.zLength );
	params.camera.up.set( 0, 0, 1 ); // In our data, z is up


	// controls
	params.controls = new TrackballControls( params.camera, params.renderer.domElement );

	window.addEventListener( 'resize', onWindowResize );
}

// update the camera on resize (this doesn't really work properly)
function onWindowResize() {

	params.renderer.setSize( window.innerWidth, window.innerHeight );

	const aspect = window.innerWidth/window.innerHeight;

	const frustumHeight = params.camera.top - params.camera.bottom;

	params.camera.left = -frustumHeight*aspect/2;
	params.camera.right = frustumHeight*aspect/2;

	camera.updateProjectionMatrix();

	render();

}

// this creates the user interface (gui)
function createUI(){

	params.gui = new dat.GUI();
	params.gui.add( params.volconfig, 'clim1', 0, 1, 0.01 ).onChange( updateUniforms );
	params.gui.add( params.volconfig, 'clim2', 0, 1, 0.01 ).onChange( updateUniforms );
	params.gui.add( params.volconfig, 'colormap', { gray: 'gray', viridis: 'viridis' } ).onChange( updateUniforms );
	params.gui.add( params.volconfig, 'renderstyle', { mip: 'mip', iso: 'iso' } ).onChange( updateUniforms );
	params.gui.add( params.volconfig, 'isothreshold', 0, 1, 0.01).onChange( updateUniforms );

}
function updateUniforms() {

	params.material.uniforms[ 'u_clim' ].value.set( params.volconfig.clim1, params.volconfig.clim2 );
	params.material.uniforms[ 'u_renderstyle' ].value = params.volconfig.renderstyle == 'mip' ? 0 : 1; // 0: MIP, 1: ISO
	params.material.uniforms[ 'u_renderthreshold' ].value = params.volconfig.isothreshold; // For ISO renderstyle
	params.material.uniforms[ 'u_cmdata' ].value = params.cmtextures[ params.volconfig.colormap ];

	render();

}


// this will draw the scene 
function drawScene(){

	console.log(params.volume)

	const texture = new THREE.Data3DTexture(params.volume.data, params.volume.xLength, params.volume.yLength, params.volume.zLength);
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
	uniforms[ 'u_size' ].value.set(params.volume.xLength, params.volume.yLength, params.volume.zLength);
	uniforms[ 'u_clim' ].value.set(params.volconfig.clim1, params.volconfig.clim2);
	uniforms[ 'u_renderstyle' ].value = params.volconfig.renderstyle == 'mip' ? 0 : 1; // 0: MIP, 1: ISO
	uniforms[ 'u_renderthreshold' ].value = params.volconfig.isothreshold; // For ISO renderstyle
	uniforms[ 'u_cmdata' ].value = params.cmtextures[params.volconfig.colormap];

	params.material = new THREE.ShaderMaterial( {
		uniforms: uniforms,
		vertexShader: shader.vertexShader,
		fragmentShader: shader.fragmentShader,
			side: THREE.BackSide // The volume shader uses the backface as its "reference point"
	} );

	// THREE.Mesh
	const geometry = new THREE.BoxGeometry(params.volume.xLength, params.volume.yLength, params.volume.zLength );
	geometry.translate(params.volume.xLength/2 - 0.5, params.volume.yLength/2 - 0.5, params.volume.zLength/2 - 0.5);

	const mesh = new THREE.Mesh(geometry, params.material);
	mesh.position.set(-(params.volume.xLength/2 - 0.5), -(params.volume.yLength/2 - 0.5), -(params.volume.zLength/2 - 0.5));
	params.scene.add( mesh );

}

// this is the animation loop
function animate(time) {
	requestAnimationFrame( animate );
	params.controls.update();
	render();
}

function render() {
	params.renderer.render( params.scene, params.camera );

}

// this is called to start everything
function WebGLStart(){

// initialize the scence
	init();

// create the UI
	createUI();

// draw everything
	drawScene();

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

	//the volume shader requires a Float34Array for the data
	params.volume.data = new Float32Array(d[0].length);
	d[0].forEach(function(dd,i){
		params.volume.data[i] = +dd.data;
	})

	params.volume.xLength = parseInt(d[1][0].xLength);
	params.volume.yLength = parseInt(d[1][0].yLength);
	params.volume.zLength = parseInt(d[1][0].zLength);

	WebGLStart();
})
.catch(function(error){
	console.log('ERROR:', error)
})



