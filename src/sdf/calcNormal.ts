import { FnNode } from "three/src/nodes/TSL.js";
import { float, Fn, normalize, vec3 } from "three/tsl";
import { Node } from "three/webgpu";
import { SDFSampler } from "./sdfSampler";

export const calcSdfNormal = Fn<[samplePos: Node<"vec3">, mapSDF: SDFSampler], Node<"vec3">>(([p, mapSDF]) => {
	// A small epsilon for finite difference.
	// Tune this based on your voxel grid scale!
	const e = float(0.1);

	const eX = vec3(e, 0.0, 0.0);
	const eY = vec3(0.0, e, 0.0);
	const eZ = vec3(0.0, 0.0, e);

	const dx = mapSDF(p.add(eX)).sub(mapSDF(p.sub(eX)));
	const dy = mapSDF(p.add(eY)).sub(mapSDF(p.sub(eY)));
	const dz = mapSDF(p.add(eZ)).sub(mapSDF(p.sub(eZ)));

	return normalize(vec3(dx, dy, dz));
});
