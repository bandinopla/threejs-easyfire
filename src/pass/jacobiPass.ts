import { DataTexture, EasyFireShaderContext } from "src/EasyFireShaderContext";
import { Fn } from "three/src/nodes/TSL.js";
import { float, If, vec3, vec4 } from "three/tsl";
import { Node } from "three/webgpu";

export const jacobiPass =
	(
		context: EasyFireShaderContext,
		textures: {
			pressureIn: DataTexture;
			pressureOut: DataTexture;
			divergence: DataTexture;
		},
	) =>
	() => {
		const coord = context.grid.phy.coord;
		const uvw = context.grid.phy.uvw;
		const grid = context.grid.phy;
		const voxelLocalPos = uvw.sub(0.5).mul(context.uVolumeWorldSize);
		const voxelWorldSize = grid.worldTexelSizeX2.mul(0.5);
		const invSq = vec3(1).div(voxelWorldSize.mul(voxelWorldSize));

		// 1. Check if the CURRENT voxel itself is inside an obstacle
		//const worldPos = context.worldMatrix.mul(vec4(voxelLocalPos, 1.0)).xyz;
		const currentDist = context.collisions.distanceAtPoint(uvw);

		If(currentDist.lessThanEqual(0.0), () => {
			// Voxels inside solids have zero pressure
			textures.pressureOut.write(coord, vec4(0.0));
		}).Else(() => {
			const sumPressure = float(0.0).toVar();
			const fluidCount = float(0.0).toVar();

			// Helper to test each 6-way neighbor direction
			const checkNeighbor = (u: number, v: number, w: number, invSqComponent: Node<"float">) => {
				context.collisions.checkCollisionAt(
					grid,
					context.uVolumeWorldSize,
					context.worldMatrix,
					voxelLocalPos,
					uvw,
					vec3(u, v, w), // Step direction (ensure checkCollisionAt scales by texelSize!)
					false,

					// HIT (Solid obstacle): Do NOT add to sum or fluid count
					(otherUvw, hitDistance, normal) => {},

					// MISS (Open fluid): Accumulate pressure & increment fluid neighbor count
					(otherUvw) => {
						const cellPressure = textures.pressureIn.sample(otherUvw).x;

						sumPressure.addAssign(cellPressure.mul(invSqComponent));
						fluidCount.addAssign(invSqComponent);
					},
				);
			};

			// Sample 6 neighbors
			checkNeighbor(1, 0, 0, invSq.x);
			checkNeighbor(-1, 0, 0, invSq.x);
			checkNeighbor(0, 1, 0, invSq.y);
			checkNeighbor(0, -1, 0, invSq.y);
			checkNeighbor(0, 0, 1, invSq.z);
			checkNeighbor(0, 0, -1, invSq.z);

			const divergence = textures.divergence.sample(uvw).x;

			const finalPressure = float(0.0).toVar();

			// Divide by the number of OPEN fluid faces (Neumann boundary condition)
			If(fluidCount.greaterThan(0.0), () => {
				finalPressure.assign(sumPressure.sub(divergence).div(fluidCount));
			});

			textures.pressureOut.write(coord, vec4(finalPressure, 0, 0, 0));
		});
	};
