import { Color, DoubleSide, HemisphereLight, Mesh, Object3D, Scene, SpotLight } from "three";
import { MeshPhysicalNodeMaterial, MeshStandardNodeMaterial, PerspectiveCamera, RenderPipeline } from "three/webgpu";
import { WebGPURenderer } from "three/webgpu";
import { GLTFLoader, OrbitControls, TeapotGeometry } from "three/examples/jsm/Addons.js";
import { color, Fn, mix, pass, uv, vec3 } from "three/tsl";
import { EasyFire } from "threejs-easyfire";
import { Inspector } from "three/examples/jsm/inspector/Inspector.js";
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js";

export async function demo(scene: Scene, camera: PerspectiveCamera, renderer: WebGPURenderer, ldr: GLTFLoader) {
	const LAYER_VOLUMETRIC_LIGHTING = 10;

	const glb = await ldr.loadAsync("demo-scene.glb");
	scene.add(glb.scene);

	const vcam = glb.cameras[0] as PerspectiveCamera;
	const sim = glb.scene.getObjectByName("sim")!;

	const ctrl = new OrbitControls(camera, renderer.domElement);
	ctrl.enableDamping = true;
	ctrl.dampingFactor = 0.05;
	ctrl.maxPolarAngle = Math.PI / 2;
	ctrl.minPolarAngle = Math.PI / 2.5;

	camera.position.copy(vcam.position);
	camera.rotation.copy(vcam.rotation);
	camera.fov = vcam.fov + 20;
	camera.translateZ(-11);
	camera.updateProjectionMatrix();
	ctrl.target.y = 2;

	scene.background = new Color("#000000");

	const spotLight = new SpotLight(0xffffff, 5);
	spotLight.position.set(2, 1, 6);
	spotLight.angle = Math.PI / 1;
	spotLight.penumbra = 1;
	spotLight.decay = 1;
	spotLight.distance = 0;
	spotLight.castShadow = true;
	spotLight.shadow.intensity = 0.98;
	spotLight.shadow.mapSize.width = 1024;
	spotLight.shadow.mapSize.height = 1024;
	spotLight.shadow.camera.near = 1;
	spotLight.shadow.camera.far = 66;
	spotLight.shadow.focus = 1;
	spotLight.layers.enable(LAYER_VOLUMETRIC_LIGHTING);

	spotLight.position.set(0, 12, 0);
	spotLight.target.position.set(0, 0, 0);
	scene.add(spotLight);

	// const reflection = reflector({ resolutionScale: 0.5 });
	// reflection.target.rotateX(-Math.PI / 2);
	// reflection.target.position.y = 0.005;
	// //reflection.uvNode = reflection.uvNode.add( floorNormalOffset );
	// scene.add(reflection.target);

	// //----------------
	(scene.getObjectByName("backdrop") as Mesh).material = new MeshStandardNodeMaterial({
		side: DoubleSide,
		//emissiveNode: reflection.mul(2.95),
		colorNode: Fn(() => {
			// 2. Material texturing using fixed UVs
			const uvNode = uv();

			const size = 20.0;
			// Scale UVs by 10 so the checkerboard maintains exactly 1x1 world-unit squares
			const checker = uvNode.x.mul(size).floor().add(uvNode.y.mul(size).floor()).mod(2.0);

			const light = color("#bdbdbd").mul(0.1);
			const dark = color("#8c8c8c").mul(0.1);

			return mix(light, dark, checker);
		})(),
	});

	const collidersMaterial = new MeshPhysicalNodeMaterial({
		colorNode: color("#222222"),
		roughness: 1,
		metalness: 0,
	});

	const fire = scene.getObjectByName("fire") as Mesh;

	const worldHalfExtents = sim.scale.clone();
	const fullSize = worldHalfExtents.clone().multiplyScalar(2);
	const voxelSizeRender = Math.max(fullSize.x, fullSize.y, fullSize.z) / 100;
	const voxelSizePhysics = Math.max(fullSize.x, fullSize.y, fullSize.z) / 80;
	const teapot = new Mesh(new TeapotGeometry(0.5, 5), collidersMaterial);

	scene.getObjectByName("teapot")!.add(teapot);

	const myFire = new EasyFire(renderer, {
		renderLayer: LAYER_VOLUMETRIC_LIGHTING,
		size: {
			boundingBox: fullSize,
			renderResolution: fullSize.clone().divideScalar(voxelSizeRender).round(),
			physicsResolution: fullSize.clone().divideScalar(voxelSizePhysics).round(),
		},

		steps: 22,
		burnableMeshes: [
			{ geometriesInsideOf: fire, maxCount: 1, id: "fireryThings" },
			{ geometriesInsideOf: teapot, maxCount: 1, id: "teapot" },
		],
		noise: {
			size: 64,
			frecuency: 30,
		},
		vertexEmissionWorldRadius: 0.01,
		blurStrength: 0,
		debug: {
			//noise: true,
		},
		collisions: {
			disabled: false,
		},
	});

	myFire.keyLightPosition = spotLight.position;
	myFire.position.y = 4;

	scene.add(myFire);
	myFire.position.copy(sim.position);
	myFire.rotation.copy(sim.rotation);

	fire.material = new MeshStandardNodeMaterial({
		color: "#222222",
		//wireframe: true,
	});
	fire.add(
		myFire.getFireFor("fireryThings", {
			emitMultiplier: 21,
			tintFactor: 0,
		})!,
	);

	teapot.add(
		myFire.getFireFor("teapot", {
			emitMultiplier: 11,
			tintFactor: 1,
		})!,
	);
	scene.add(new HemisphereLight(0, "#ffce8e", 5));

	const colliders: Object3D[] = [];
	scene.traverse((o) => {
		if (o.userData.collider) {
			const obj = o.children[0] as Mesh;
			colliders.push(o);
			myFire.makeObjectCollidable(obj, o.userData.collider);
			obj.material = collidersMaterial;
			o.userData.ang = 1 + Math.random();
		}
	});

	await myFire.initialize();

	// //---------------
	const renderPipeline = new RenderPipeline(renderer);

	const scenePass = pass(scene, camera);
	const sceneDepth = scenePass.getTextureNode("depth");

	// //scenePass.setResolutionScale(0.8);

	const fireScene = myFire.getRenderPass(scene, camera, sceneDepth).toInspector("fire scene");
	const scenePassColor = scenePass.add(fireScene);

	renderPipeline.outputNode = scenePassColor.add(bloom(fireScene, 0.001, 0.01, 13).setResolutionScale(0.5));

	//---------------------------------------------------------
	myFire.applySettingsSnapshot({
		resolution: 0.75,
		grid: {
			world: {
				x: 7.62003755569458,
				y: 5.97511625289917,
				z: 3.7697033882141113,
			},
			dye: {
				x: 100,
				y: 78,
				z: 49,
			},
			phy: {
				x: 56,
				y: 45,
				z: 28,
			},
		},
		vorticityConfinementStrength: 11.87,
		blurStrength: 0,
		steps: 22,
		simulationSpeed: 1.5,
		temperature: 12,
		fireDensity: 0.031,
		turbulenceFrecuency: 6.81,
		turbulenceDecay: 0.76,
		turbulence: 0.2,
		friction: 0.9,
		angularVelocityMultiplier: 1.36,
		collisionMargin: 0.059,
		densityDissipation: 1.02,
		cooling: 0.4831,
		velocityDamping: 0.25,
		buoyancy: 2.3729,
		smokeWeight: 0.15,
		pressureIterations: 4,
		curlNoiseMultiplier: 5.82,
		colorBase: "#878787",
		colorTier1: "#ff0000",
		colorTier2: "#ff7b00",
		colorTier3: "#ffffff",
		colorSpecial: "#006eff",
		colorRadianceMultiplier: 78.39,
		tier1Stop: {
			from: 0.01,
			to: 0.27,
		},
		tier2Stop: {
			from: 0.34,
			to: 0.8675,
		},
		tier3Stop: {
			from: 0.96,
			to: 1,
		},
		temperatureAtMaxColor: 10,
		specialColorMultiplier: 5.5,
		timestamp: "2026-08-02T17:14:38.758Z",
		inspector: {
			scale: {
				world: 1,
				phy: 1,
				dye: 1,
			},
			baseSize: {
				world: {
					x: 7.62003755569458,
					y: 5.97511625289917,
					z: 3.7697033882141113,
				},
				phy: {
					x: 56,
					y: 45,
					z: 28,
				},
				dye: {
					x: 100,
					y: 78,
					z: 49,
				},
			},
		},
	});

	myFire.addSettingsToInspector(renderer.inspector as Inspector, "Easy fire");

	return (delta: number) => {
		teapot.rotateZ(delta);
		teapot.rotateY(delta * 0.2);
		teapot.position.y = 1 + Math.cos(performance.now() / 1000) * 0.3;

		colliders.forEach((c) => {
			c.rotateY(delta * c.userData.ang);
		});

		ctrl.update(delta);

		myFire?.update?.(delta);
		renderPipeline.render();
	};
}
