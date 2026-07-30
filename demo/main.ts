import { GLTFLoader, KTX2Loader, OrbitControls } from "three/examples/jsm/Addons.js";
import * as THREE from "three/webgpu";
import { DRACOLoader } from "./util/DRACOLoader";
import { demo } from "./demo";
//import { demo } from "./sdfTest";
import WebGPU from "three/examples/jsm/capabilities/WebGPU.js";
import { Inspector } from "three/examples/jsm/inspector/Inspector.js";

// DOM Elements
const canvasContainer = document.getElementById("canvas-container") as HTMLDivElement;

// App variables
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGPURenderer;
let clock: THREE.Clock;

// 1. Initialize ThreeJS scene
async function init() {
	scene = new THREE.Scene();

	camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
	camera.position.set(0, 3, 7);

	renderer = new THREE.WebGPURenderer({ antialias: true });
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.shadowMap.enabled = true;
	// renderer.toneMapping = THREE.ACESFilmicToneMapping;
	// renderer.toneMappingExposure = 2.3;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.transmitted = true;
	renderer.inspector = new Inspector();

	canvasContainer.appendChild(renderer.domElement);

	// Listeners
	window.addEventListener("resize", onWindowResize);

	await renderer.init();

	camera.position.set(4, 4, 4);
	camera.lookAt(0, 0, 0);

	// function saveCamState() {
	// 	const data = {
	// 		position: camera.position.toArray(),
	// 		quaternion: camera.quaternion.toArray(),
	// 		target: ctrl.target.toArray(),
	// 		zoom: camera.zoom,
	// 	};
	// 	// copy JSON.stringify(data, null, 2) to clipboard
	// 	navigator.clipboard.writeText(JSON.stringify(data, null, 2));
	// }

	// window.addEventListener("keydown", (e) => {
	// 	if (e.key === "p") saveCamState();
	// });

	//------------------------ load assets
	const loadManager = new THREE.LoadingManager();
	const ldr = new GLTFLoader(loadManager);
	//@ts-ignore
	ldr.setDRACOLoader(new DRACOLoader());

	const ktx2Loader = new KTX2Loader().setTranscoderPath(
		"https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/libs/basis/",
	);

	ktx2Loader.detectSupport(renderer);
	ldr.setKTX2Loader(ktx2Loader);

	const demoApp = await demo(scene, camera, renderer, ldr);
	// // on mouse click cast  ray on ground
	// renderer.domElement.addEventListener("click", (e) => {
	// 	const raycaster = new THREE.Raycaster();
	// 	const mouse = new THREE.Vector2();
	// 	mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
	// 	mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
	// 	raycaster.setFromCamera(mouse, camera);
	// 	const intersects = raycaster.intersectObject(ground);
	// 	if (intersects.length > 0) {
	// 		console.log(intersects[0].point);
	// 		//add a sphere there
	// 		const sphere = new THREE.Mesh(
	// 			new THREE.SphereGeometry(0.1, 16, 16),
	// 			new THREE.MeshBasicMaterial({ color: 0xff0000 }),
	// 		);
	// 		sphere.position.copy(intersects[0].point);
	// 		scene.add(sphere);
	// 	}
	// });

	//------------------ start loop

	let lastTime = 0;
	renderer.setAnimationLoop((time) => {
		const dt = (time - lastTime) / 1000;
		lastTime = time;

		demoApp(dt);

		//renderer.render(scene, camera);
	});
}

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
}

// Run
///await init();

if (!WebGPU.isAvailable()) {
	document.body.appendChild(WebGPU.getErrorMessage());
} else {
	await init();
}
